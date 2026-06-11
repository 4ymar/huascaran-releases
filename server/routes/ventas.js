const router       = require('express').Router();
const db           = require('../data/database');
const { randomUUID: uuidv4 } = require('crypto');
const { auditLog } = require('../middleware/logger');
const { requireRole } = require('../middleware/auth');
const { decryptText } = require('../security/secrets');
const fs = require('fs');

const https = require('https');

// ── Helper: enviar comunicación de baja a NubeFact ────────
async function enviarBajaNubefact(venta, config) {
    return new Promise((resolve) => {
        const sunatToken = decryptText(config.sunat_token || '');
        // Verificar si es el mismo día en hora Perú (UTC-5)
        const ahoraLima   = new Date(Date.now() - 5 * 60 * 60 * 1000);
        const emisionLima = new Date(new Date(venta.fecha_hora).getTime() - 5 * 60 * 60 * 1000);
        const mismodia    = ahoraLima.toISOString().slice(0, 10) === emisionLima.toISOString().slice(0, 10);

        if (!mismodia) {
            return resolve({ ok: false, motivo: 'fuera_de_plazo' });
        }

        const isBoleta = venta.tipo_comprobante === 'BOLETA';
        const serie    = isBoleta ? (config.serie_boleta || 'B001') : (config.serie_factura || 'F001');
        const numero   = (venta.numero_comprobante || '').split('-')[1] || '1';

        const payload = JSON.stringify({
            operacion:           'generar_anulacion',
            tipo_de_comprobante: isBoleta ? 2 : 1,
            serie,
            numero:              parseInt(numero),
            motivo:              venta.notas || 'Anulación',
        });

        const urlObj  = new URL(config.sunat_url);
        const options = {
            hostname: urlObj.hostname,
            path:     urlObj.pathname,
            method:   'POST',
            headers: {
                'Content-Type':   'application/json',
                'Authorization':  `Token token="${sunatToken}"`,
                'Content-Length': Buffer.byteLength(payload),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const body = JSON.parse(data);
                    resolve({ ok: res.statusCode === 200, body });
                } catch (_) {
                    resolve({ ok: false, motivo: 'parse_error' });
                }
            });
        });

        req.on('error', () => resolve({ ok: false, motivo: 'network_error' }));
        req.setTimeout(20000, () => { req.destroy(); resolve({ ok: false, motivo: 'timeout' }); });
        req.write(payload);
        req.end();
    });
}

// ── Formas de pago válidas ────────────────────────────────────
// EFECTIVO | YAPE_PLIN | TRANSFERENCIA | MIXTO | CREDITO
const FORMAS_PAGO_VALIDAS = ['EFECTIVO', 'YAPE_PLIN', 'TRANSFERENCIA', 'MIXTO', 'CREDITO'];

// GET all sales
router.get('/', (req, res) => {
    try {
        const { fecha_desde, fecha_hasta, cliente, estado, search, page = 1, limit = 50 } = req.query;

        const limitNum = Math.min(Number(limit) || 50, 1000);
        const pageNum = Math.max(Number(page) || 1, 1);
        const offset = (pageNum - 1) * limitNum;

        let baseQuery = `
            FROM ventas v
            LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
            WHERE 1=1
        `;
        const params = [];

        if (fecha_desde) { baseQuery += ` AND v.fecha_hora >= ?`; params.push(fecha_desde); }
        if (fecha_hasta) { baseQuery += ` AND v.fecha_hora <= ?`; params.push(fecha_hasta + 'T23:59:59'); }
        if (cliente)     { baseQuery += ` AND v.id_cliente = ?`;  params.push(cliente); }
        if (estado)      { baseQuery += ` AND v.estado = ?`;      params.push(estado); }
        if (search) {
            baseQuery += ` AND (v.numero_venta LIKE ? OR v.numero_comprobante LIKE ? OR c.nombre_razon_social LIKE ?)`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
        const total = db.db.prepare(countQuery).get(...params).total;

        let query = `
            SELECT v.*,
                   c.nombre_razon_social  AS cliente_nombre,
                   c.tipo_documento       AS cliente_tipo_doc,
                   c.numero_documento     AS cliente_num_doc
            ${baseQuery}
            ORDER BY v.fecha_hora DESC
            LIMIT ? OFFSET ?
        `;

        let ventas = db.db.prepare(query).all(...params, limitNum, offset);

        // Adjuntar cliente como objeto y detalles
        ventas = ventas.map(v => {
            const detalles = db.db.prepare(
                `SELECT nombre_producto, cantidad, precio_unitario, descuento_linea, subtotal_linea 
                 FROM detalle_ventas WHERE id_venta = ?`
            ).all(v.id_venta);

            return {
                ...v,
                cliente: v.id_cliente ? {
                    nombre_razon_social: v.cliente_nombre,
                    tipo_documento:      v.cliente_tipo_doc,
                    numero_documento:    v.cliente_num_doc,
                } : null,
                detalles,
            };
        });

        res.json(ventas);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET sale by ID
router.get('/:id', (req, res) => {
    try {
        const venta = db.ventas.obtener(req.params.id);
        if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
        const detalles = db.ventas.obtenerDetalle(venta.id_venta);
        const cliente  = venta.id_cliente ? db.clientes.obtener(venta.id_cliente) : null;

        let credito = null;
        if (venta.forma_pago === 'CREDITO') {
            credito = db.db.prepare(`SELECT * FROM creditos WHERE id_venta = ? LIMIT 1`).get(venta.id_venta) || null;
            if (credito) {
                const abonos = db.db.prepare(`SELECT * FROM abonos WHERE id_credito = ? ORDER BY fecha_abono ASC`).all(credito.id_credito);
                const totalAbonado = abonos.reduce((sum, a) => sum + Number(a.monto_abonado), 0);
                const adelanto     = abonos.find(a => a.notas === 'Adelanto al momento de la venta') || null;
                credito = {
                    ...credito,
                    total_abonado:      Math.round(totalAbonado * 100) / 100,
                    saldo_pendiente:    Math.round((credito.monto_total - totalAbonado) * 100) / 100,
                    monto_adelanto:     adelanto ? Number(adelanto.monto_abonado) : 0,
                    medio_pago_adelanto: adelanto ? adelanto.medio_pago : null,
                };
            }
        }

        res.json({ ...venta, detalles, cliente, credito });
    } catch (e) {
        console.error('[VENTAS] Error al obtener venta:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// POST new sale
router.post('/', (req, res) => {
    try {
        const {
            items, id_cliente, tipo_comprobante, forma_pago, notas, descuento = 0,
            es_credito, monto_adelanto, medio_pago_adelanto, fecha_vencimiento, notas_credito,
            // Mixto: efectivo + yape/plin (ya NO existe monto_tarjeta)
            monto_efectivo = null, monto_yape_plin = null,
        } = req.body;

        if (!items || items.length === 0)
            return res.status(400).json({ error: 'La venta debe tener al menos un producto' });

        // ── Validar forma de pago ───────────────────────────────
        const _fp = es_credito ? 'CREDITO' : (forma_pago || 'EFECTIVO');
        if (!FORMAS_PAGO_VALIDAS.includes(_fp))
            return res.status(400).json({ error: `Forma de pago inválida. Válidas: ${FORMAS_PAGO_VALIDAS.join(', ')}` });

        // (Validación de stock movida a database.js para atomicidad)

        const now     = new Date();
        const mesAnio = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

        const ventasMesRow = db.db.prepare(`SELECT COUNT(*) as c FROM ventas WHERE numero_venta LIKE ?`).get(`VTA-${mesAnio}-%`);
        const numVenta     = `VTA-${mesAnio}-${String((ventasMesRow.c || 0) + 1).padStart(3, '0')}`;

        // ── Correlativo comprobante ─────────────────────────────
        const cfg        = db.config.obtenerTodo();
        const esFact     = tipo_comprobante === 'FACTURA';
        const serie      = esFact ? (cfg.serie_factura || 'F001') : (cfg.serie_boleta || 'B001');
        const claveCorr  = esFact ? 'correlativo_factura' : 'correlativo_boleta';
        const correlativo = parseInt(cfg[claveCorr] || '1', 10);
        const numComprobante = `${serie}-${String(correlativo).padStart(8, '0')}`;
        db.config.guardar(claveCorr, String(correlativo + 1));

        const idVenta = uuidv4();
        let subtotalTotal = 0;
        const detalles = [];

        for (const item of items) {
            const prod          = db.productos.obtener(item.id_producto);
            const subtotalLinea = prod.precio_venta * item.cantidad - (item.descuento_linea || 0);
            subtotalTotal      += subtotalLinea;
            detalles.push({
                id_detalle:      uuidv4(),
                id_venta:        idVenta,
                id_producto:     prod.id_producto,
                nombre_producto: prod.nombre,
                cantidad:        item.cantidad,
                precio_unitario: prod.precio_venta,
                descuento_linea: item.descuento_linea || 0,
                subtotal_linea:  subtotalLinea,
            });
        }

        const subtotalSinIgv = Math.round((subtotalTotal / 1.18) * 100) / 100;
        const igv             = Math.round((subtotalTotal - subtotalSinIgv) * 100) / 100;
        const totalFinal      = subtotalTotal - (descuento || 0);
        const sesionCaja      = db.caja.obtenerSesionAbierta();

        // ── Calcular montos por canal ────────────────────────────
        // EFECTIVO | YAPE_PLIN | TRANSFERENCIA | MIXTO (ef+yape) | CREDITO
        let _mEfectivo, _mYape;

        if (_fp === 'EFECTIVO') {
            _mEfectivo = totalFinal;
            _mYape     = 0;
        } else if (_fp === 'YAPE_PLIN') {
            _mEfectivo = 0;
            _mYape     = totalFinal;
        } else if (_fp === 'TRANSFERENCIA') {
            // Se registra en total_otros de caja (canal digital)
            _mEfectivo = 0;
            _mYape     = 0;
        } else if (_fp === 'MIXTO') {
            // MIXTO = efectivo + yape/plin; se valida que sumen el total
            _mEfectivo = monto_efectivo  !== null ? Number(monto_efectivo)  : 0;
            _mYape     = monto_yape_plin !== null ? Number(monto_yape_plin) : 0;
            const sumaM = Math.round((_mEfectivo + _mYape) * 100) / 100;
            if (Math.abs(sumaM - totalFinal) > 0.02)
                return res.status(400).json({
                    error: `Los montos del pago mixto (S/ ${sumaM.toFixed(2)}) no coinciden con el total (S/ ${totalFinal.toFixed(2)})`,
                });
        } else {
            // CREDITO
            _mEfectivo = 0;
            _mYape     = 0;
        }

        const ventaData = {
            id_venta:           idVenta,
            numero_venta:       numVenta,
            fecha_hora:         now.toISOString(),
            id_cliente:         id_cliente || null,
            tipo_comprobante,
            numero_comprobante: numComprobante,
            subtotal:           subtotalSinIgv,
            igv,
            descuento:          descuento || 0,
            total:              totalFinal,
            forma_pago:         _fp,
            monto_efectivo:     Math.round(_mEfectivo * 100) / 100,
            monto_yape_plin:    Math.round(_mYape     * 100) / 100,
            estado:             'ACTIVA',
            usuario:            req.user?.username || 'admin',
            notas:              notas || '',
            id_sesion_caja:     sesionCaja ? sesionCaja.id_sesion : null,
        };

        db.ventas.registrar(ventaData, detalles);

        // ── Crédito / fiado ─────────────────────────────────────
        if (es_credito) {
            if (!id_cliente)
                return res.status(400).json({ error: 'Se requiere un cliente para venta al fiado' });

            const adelanto  = Number(monto_adelanto) || 0;
            const ahora     = now.toISOString();
            const idCredito = uuidv4();

            db.db.prepare(`
                INSERT INTO creditos (id_credito, id_cliente, id_venta, monto_total, estado, fecha_vencimiento, notas, fecha_creacion)
                VALUES (?, ?, ?, ?, 'PENDIENTE', ?, ?, ?)
            `).run(idCredito, id_cliente, idVenta, totalFinal, fecha_vencimiento || null, notas_credito || '', ahora);

            if (adelanto > 0) {
                // Validar medio de pago del adelanto (sin tarjeta)
                const medioAdelanto = ['EFECTIVO', 'YAPE_PLIN', 'TRANSFERENCIA'].includes(medio_pago_adelanto)
                    ? medio_pago_adelanto
                    : 'EFECTIVO';

                db.db.prepare(`
                    INSERT INTO abonos (id_abono, id_credito, monto_abonado, fecha_abono, medio_pago, notas, fecha_creacion)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(uuidv4(), idCredito, adelanto, ahora, medioAdelanto, 'Adelanto al momento de la venta', ahora);

                const nuevoEstado = adelanto >= totalFinal - 0.01 ? 'PAGADO_TOTAL' : 'PAGADO_PARCIAL';
                db.db.prepare(`UPDATE creditos SET estado = ? WHERE id_credito = ?`).run(nuevoEstado, idCredito);

                // ── Registrar adelanto en caja activa ──────────────
                try {
                    const sesionAdelanto = db.caja.obtenerSesionAbierta();
                    if (sesionAdelanto) {
                        const clienteNombreAd = db.clientes.obtener(id_cliente)?.nombre_razon_social || 'Cliente';
                        db.caja.registrarMovimiento({
                            id_movimiento_caja: uuidv4(),
                            id_sesion:          sesionAdelanto.id_sesion,
                            tipo:               'INGRESO',
                            monto:              adelanto,
                            concepto:           `Adelanto venta al fiado — ${clienteNombreAd}`,
                            medio_pago:         medioAdelanto,
                            referencia_tipo:    'ABONO_CREDITO',
                            referencia_id:      idCredito,
                            fecha_hora:         ahora,
                            usuario:            req.user?.username || req.user?.nombre_completo || 'sistema',
                        });
                    }
                } catch (cajErr) {
                    console.error('Error al registrar adelanto en caja:', cajErr.message);
                }
            }
        }

        // ── Auditoría ───────────────────────────────────────────
        const cliente         = id_cliente ? db.clientes.obtener(id_cliente) : null;
        const nombreCliente   = cliente?.nombre_razon_social || 'Sin cliente';
        const resumenItems    = detalles.map(d => `${d.nombre_producto} x${d.cantidad}`).join(', ');

        let formaPagoTexto;
        if (es_credito) {
            const medioAd = ['EFECTIVO', 'YAPE_PLIN', 'TRANSFERENCIA'].includes(medio_pago_adelanto) ? medio_pago_adelanto : 'EFECTIVO';
            formaPagoTexto = `Al fiado (adelanto S/ ${Number(monto_adelanto || 0).toFixed(2)} vía ${medioAd})`;
        } else if (_fp === 'MIXTO') {
            formaPagoTexto = `Mixto (Efectivo S/ ${_mEfectivo.toFixed(2)} + Yape/Plin S/ ${_mYape.toFixed(2)})`;
        } else {
            formaPagoTexto = _fp;
        }

        auditLog(req, 'CREAR', 'VENTAS',
            `Venta ${numVenta} (${numComprobante}) — ` +
            `Total: S/ ${totalFinal.toFixed(2)} | ` +
            `Cliente: ${nombreCliente} | ` +
            `Pago: ${formaPagoTexto} | ` +
            `Productos: ${resumenItems}`,
            { id_referencia: ventaData.id_venta, tipo_referencia: 'VENTA' }
        );

        res.status(201).json({ ...ventaData, detalles, cliente });
    } catch (err) {
        console.error('Error al procesar venta:', err);
        if (err.message.includes('Stock insuficiente') || err.message.includes('Producto no encontrado')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Error interno al registrar la venta: ' + err.message });
    }
});

// PUT void sale
router.put('/:id/anular', requireRole('ADMIN'), async (req, res) => {
    try {
        const { motivo } = req.body;
        if (!motivo) return res.status(400).json({ error: 'El motivo de anulación es obligatorio' });

        const venta = db.ventas.obtener(req.params.id);
        if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
        if (venta.estado === 'ANULADA') return res.status(400).json({ error: 'La venta ya está anulada' });

        const detalles = db.ventas.obtenerDetalle(venta.id_venta);

        const anularTransaccion = db.db.transaction(() => {
            const insMov      = db.db.prepare(`
                INSERT INTO movimientos (id_movimiento, fecha_hora, id_producto, nombre_producto,
                tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia, motivo, usuario)
                VALUES (@id_movimiento, @fecha_hora, @id_producto, @nombre_producto,
                @tipo_movimiento, @cantidad, @stock_anterior, @stock_nuevo, @referencia, @motivo, @usuario)
            `);
            const updateStock = db.db.prepare(`UPDATE productos SET stock_actual = ? WHERE id_producto = ?`);
            const getStock    = db.db.prepare(`SELECT stock_actual FROM productos WHERE id_producto = ?`);
            const now         = new Date().toISOString();

            for (const d of detalles) {
                const prod = getStock.get(d.id_producto);
                if (prod) {
                    const nuevoStock = prod.stock_actual + d.cantidad;
                    updateStock.run(nuevoStock, d.id_producto);
                    db.db.prepare(`
                        INSERT INTO stock_almacen (id_almacen, id_producto, stock_actual, stock_minimo)
                        VALUES (?, ?, 0, 0)
                        ON CONFLICT(id_almacen, id_producto) DO NOTHING
                    `).run(db.config.obtener('almacen_principal_id') || 'alm-principal', d.id_producto);
                    db.db.prepare(`
                        UPDATE stock_almacen SET stock_actual = stock_actual + ?
                        WHERE id_almacen = ? AND id_producto = ?
                    `).run(d.cantidad, db.config.obtener('almacen_principal_id') || 'alm-principal', d.id_producto);
                    insMov.run({
                        id_movimiento:   uuidv4(),
                        fecha_hora:      now,
                        id_producto:     d.id_producto,
                        nombre_producto: d.nombre_producto,
                        tipo_movimiento: 'ENTRADA',
                        cantidad:        d.cantidad,
                        stock_anterior:  prod.stock_actual,
                        stock_nuevo:     nuevoStock,
                        referencia:      `ANULACION-${venta.numero_venta}`,
                        motivo,
                        usuario:         req.user?.username || 'admin',
                    });
                }
            }
            db.db.prepare(`UPDATE ventas SET estado = 'ANULADA', notas = ? WHERE id_venta = ?`)
                .run(`ANULADO: ${motivo}`, venta.id_venta);
        });

        anularTransaccion();

        // ── Comunicación de baja a NubeFact (si tiene CPE emitido) ──
        let bajaCPE = null;
        if (venta.cpe_estado === 'ACEPTADO') {
            try {
                const configRows = db.db.prepare(`SELECT clave, valor FROM config`).all();
                const cfg = {};
                configRows.forEach(r => { cfg[r.clave] = r.valor; });

                if (cfg.sunat_activo === '1' && cfg.sunat_token && cfg.sunat_url) {
                    // Pasar el motivo en la venta para el payload
                    venta.notas = motivo;
                    bajaCPE = await enviarBajaNubefact(venta, cfg);

                    if (bajaCPE.ok) {
                        db.db.prepare(`UPDATE ventas SET cpe_estado = 'ANULADO' WHERE id_venta = ?`)
                           .run(venta.id_venta);
                    } else if (bajaCPE.motivo === 'fuera_de_plazo') {
                        db.db.prepare(`UPDATE ventas SET cpe_estado = 'NOTA_CREDITO_REQUERIDA' WHERE id_venta = ?`)
                           .run(venta.id_venta);
                    }
                }
            } catch (bajaErr) {
                console.error('[FACTURACION] Error al enviar baja:', bajaErr.message);
            }
        }

        // ── Auditoría anulación ────────────────────────────────
        const resumenItems = detalles.map(d => `${d.nombre_producto} x${d.cantidad}`).join(', ');
        auditLog(req, 'ELIMINAR', 'VENTAS',
            `Anulación de venta ${venta.numero_venta} — ` +
            `Total: S/ ${Number(venta.total).toFixed(2)} | ` +
            `Motivo: ${motivo} | ` +
            `Stock revertido: ${resumenItems}`,
            { id_referencia: venta.id_venta, tipo_referencia: 'VENTA' }
        );

        res.json({
            ...venta,
            estado: 'ANULADA',
            notas:  `ANULADO: ${motivo}`,
            baja_cpe: bajaCPE,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al anular: ' + err.message });
    }
});

router.post('/:id/devoluciones', requireRole('ADMIN'), (req, res) => {
    try {
        const { motivo, items = [] } = req.body;
        if (!motivo) return res.status(400).json({ error: 'El motivo de devolucion es obligatorio' });
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Debe indicar al menos un item a devolver' });
        }

        const venta = db.ventas.obtener(req.params.id);
        if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
        if (venta.estado === 'ANULADA') return res.status(400).json({ error: 'No se puede devolver una venta anulada' });

        const detallesVenta = db.ventas.obtenerDetalle(venta.id_venta);
        const detallesById = new Map(detallesVenta.map(d => [d.id_detalle, d]));

        const yaDevuelto = db.db.prepare(`
            SELECT id_detalle_venta, COALESCE(SUM(cantidad), 0) AS cantidad
            FROM detalle_devoluciones dd
            JOIN devoluciones d ON d.id_devolucion = dd.id_devolucion
            WHERE d.id_venta = ?
            GROUP BY id_detalle_venta
        `).all(venta.id_venta).reduce((acc, row) => {
            acc[row.id_detalle_venta] = Number(row.cantidad || 0);
            return acc;
        }, {});

        const detalleDevolucion = [];
        for (const item of items) {
            const detalleVenta = detallesById.get(item.id_detalle_venta);
            const cantidad = Number(item.cantidad || 0);
            if (!detalleVenta) return res.status(400).json({ error: `Item de venta no encontrado: ${item.id_detalle_venta}` });
            if (cantidad <= 0) return res.status(400).json({ error: 'La cantidad devuelta debe ser mayor a cero' });
            const disponible = Number(detalleVenta.cantidad) - Number(yaDevuelto[item.id_detalle_venta] || 0);
            if (cantidad > disponible) {
                return res.status(400).json({ error: `Cantidad excede lo vendido para ${detalleVenta.nombre_producto}. Disponible para devolver: ${disponible}` });
            }
            detalleDevolucion.push({ detalleVenta, cantidad });
        }

        const ahoraLima = new Date(Date.now() - 5 * 60 * 60 * 1000);
        const emisionLima = new Date(new Date(venta.fecha_hora).getTime() - 5 * 60 * 60 * 1000);
        const mismoDia = ahoraLima.toISOString().slice(0, 10) === emisionLima.toISOString().slice(0, 10);
        const requiereNotaCredito = venta.cpe_estado === 'ACEPTADO' && !mismoDia;
        const idDevolucion = uuidv4();
        const now = new Date().toISOString();

        const resultado = db.db.transaction(() => {
            let total = 0;
            db.db.prepare(`
                INSERT INTO devoluciones
                    (id_devolucion, id_venta, fecha_hora, motivo, total, usuario, requiere_nota_credito, estado)
                VALUES (?, ?, ?, ?, 0, ?, ?, 'REGISTRADA')
            `).run(idDevolucion, venta.id_venta, now, motivo, req.user?.username || 'admin', requiereNotaCredito ? 1 : 0);

            const insDetalle = db.db.prepare(`
                INSERT INTO detalle_devoluciones
                    (id_detalle, id_devolucion, id_detalle_venta, id_producto, nombre_producto,
                     cantidad, precio_unitario, subtotal_linea)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const insMov = db.db.prepare(`
                INSERT INTO movimientos (id_movimiento, fecha_hora, id_producto, nombre_producto,
                tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia, motivo, usuario)
                VALUES (?, ?, ?, ?, 'ENTRADA', ?, ?, ?, ?, ?, ?)
            `);

            for (const item of detalleDevolucion) {
                const d = item.detalleVenta;
                const subtotalLinea = Math.round(Number(d.precio_unitario) * item.cantidad * 100) / 100;
                total += subtotalLinea;

                const prod = db.db.prepare(`SELECT stock_actual FROM productos WHERE id_producto = ?`).get(d.id_producto);
                const stockAnterior = Number(prod?.stock_actual || 0);
                const stockNuevo = stockAnterior + item.cantidad;
                db.db.prepare(`UPDATE productos SET stock_actual = ?, fecha_actualizacion = datetime('now') WHERE id_producto = ?`)
                    .run(stockNuevo, d.id_producto);
                db.db.prepare(`
                    INSERT INTO stock_almacen (id_almacen, id_producto, stock_actual, stock_minimo)
                    VALUES (?, ?, ?, 0)
                    ON CONFLICT(id_almacen, id_producto)
                    DO UPDATE SET stock_actual = stock_actual + excluded.stock_actual
                `).run(db.config.obtener('almacen_principal_id') || 'alm-principal', d.id_producto, item.cantidad);

                insDetalle.run(uuidv4(), idDevolucion, d.id_detalle, d.id_producto, d.nombre_producto, item.cantidad, d.precio_unitario, subtotalLinea);
                insMov.run(uuidv4(), now, d.id_producto, d.nombre_producto, item.cantidad, stockAnterior, stockNuevo, `DEVOLUCION-${venta.numero_venta}`, motivo, req.user?.username || 'admin');
            }

            db.db.prepare(`UPDATE devoluciones SET total = ? WHERE id_devolucion = ?`)
                .run(Math.round(total * 100) / 100, idDevolucion);

            if (requiereNotaCredito) {
                db.db.prepare(`UPDATE ventas SET cpe_estado = 'NOTA_CREDITO_REQUERIDA' WHERE id_venta = ?`)
                    .run(venta.id_venta);
            }

            return db.db.prepare(`SELECT * FROM devoluciones WHERE id_devolucion = ?`).get(idDevolucion);
        })();

        auditLog(req, 'CREAR', 'DEVOLUCIONES',
            `Devolucion de venta ${venta.numero_venta} - Total: S/ ${Number(resultado.total).toFixed(2)} | Motivo: ${motivo}`,
            { id_referencia: idDevolucion, tipo_referencia: 'DEVOLUCION' }
        );

        res.status(201).json({
            ...resultado,
            requiere_nota_credito: !!requiereNotaCredito,
            mensaje: requiereNotaCredito
                ? 'Devolucion registrada. Requiere emitir nota de credito manual en NubeFact.'
                : 'Devolucion registrada correctamente.',
        });
    } catch (err) {
        console.error('[VENTAS] Error al registrar devolucion:', err.message);
        res.status(500).json({ error: 'Error al registrar devolucion: ' + err.message });
    }
});

router.post('/:id/nota-credito-manual', requireRole('ADMIN'), (req, res) => {
    try {
        const { serie, numero, fecha, observacion = '' } = req.body;
        if (!serie || !numero || !fecha) {
            return res.status(400).json({ error: 'Serie, numero y fecha son obligatorios' });
        }

        const venta = db.ventas.obtener(req.params.id);
        if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

        db.db.prepare(`
            UPDATE ventas SET
                cpe_estado = 'NOTA_CREDITO_REGISTRADA',
                nota_credito_serie = ?,
                nota_credito_numero = ?,
                nota_credito_fecha = ?,
                nota_credito_observacion = ?
            WHERE id_venta = ?
        `).run(String(serie).trim(), String(numero).trim(), String(fecha).trim(), String(observacion).trim(), venta.id_venta);

        auditLog(req, 'ACTUALIZAR', 'VENTAS',
            `Nota de credito manual registrada para ${venta.numero_venta}: ${serie}-${numero}`,
            { id_referencia: venta.id_venta, tipo_referencia: 'VENTA' }
        );

        res.json({ ok: true, mensaje: 'Nota de credito manual registrada.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
