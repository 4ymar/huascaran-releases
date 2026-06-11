const router       = require('express').Router();
const db           = require('../data/database');
const { randomUUID: uuidv4 } = require('crypto');
const { auditLog } = require('../middleware/logger');
const { requireRole } = require('../middleware/auth');

// GET all purchases
router.get('/', (req, res) => {
    try {
        let compras = db.compras.listar({ limite: 1000, offset: 0 });
        const { fecha_desde, fecha_hasta, proveedor, estado } = req.query;

        if (fecha_desde) compras = compras.filter(c => c.fecha_hora >= fecha_desde);
        if (fecha_hasta) compras = compras.filter(c => c.fecha_hora <= fecha_hasta + 'T23:59:59');
        if (proveedor)   compras = compras.filter(c => c.proveedor && c.proveedor.toLowerCase().includes(proveedor.toLowerCase()));
        if (estado)      compras = compras.filter(c => c.estado === estado);

        res.json(compras);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET purchase by ID
router.get('/:id', (req, res) => {
    try {
        const compra = db.compras.obtener(req.params.id);
        if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
        const detalles = db.compras.obtenerDetalle(compra.id_compra);
        res.json({ ...compra, detalles });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST new purchase
router.post('/', requireRole('ADMIN'), (req, res) => {
    try {
        const { items, id_proveedor, proveedor, ruc_proveedor, doc_proveedor, notas, id_almacen } = req.body;
        if (!items || items.length === 0)
            return res.status(400).json({ error: 'La compra debe tener al menos un producto' });

        const proveedorRow = id_proveedor
            ? db.db.prepare(`SELECT * FROM proveedores WHERE id_proveedor = ? AND estado = 1`).get(id_proveedor)
            : null;

        const now     = new Date();
        const mesAnio = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

        const comprasMesRow = db.db.prepare(`SELECT COUNT(*) as c FROM compras WHERE numero_oc LIKE ?`).get(`OC-${mesAnio}-%`);
        const numOC         = `OC-${mesAnio}-${String((comprasMesRow.c || 0) + 1).padStart(3, '0')}`;
        const idCompra      = uuidv4();

        let subtotalCompra = 0;
        const detalles     = [];

        for (const item of items) {
            const prod = db.productos.obtener(item.id_producto);
            if (!prod) continue;

            const subtotalLinea = item.precio_unitario * item.cantidad;
            subtotalCompra     += subtotalLinea;

            detalles.push({
                id_detalle:      uuidv4(),
                id_compra:       idCompra,
                id_producto:     prod.id_producto,
                nombre_producto: prod.nombre,
                cantidad:        item.cantidad,
                precio_unitario: item.precio_unitario,
                subtotal_linea:  subtotalLinea,
            });

            if (item.actualizar_precio && item.precio_unitario !== prod.precio_compra) {
                db.db.prepare(`UPDATE productos SET precio_compra = ? WHERE id_producto = ?`).run(item.precio_unitario, prod.id_producto);
            }
        }

        const igv       = Math.round(subtotalCompra * 0.18 * 100) / 100;
        const compraData = {
            id_compra:      idCompra,
            numero_oc:      numOC,
            fecha_hora:     now.toISOString(),
            id_proveedor:   proveedorRow ? proveedorRow.id_proveedor : null,
            id_almacen:     id_almacen || undefined,
            proveedor:      proveedorRow ? proveedorRow.razon_social : (proveedor || ''),
            ruc_proveedor:  proveedorRow ? (proveedorRow.ruc || '') : (ruc_proveedor || ''),
            doc_proveedor:  doc_proveedor || '',
            subtotal:       subtotalCompra,
            igv,
            total:          subtotalCompra + igv,
            estado:         'ACTIVA',
            usuario:        req.user?.username || 'admin',
            notas:          notas || '',
        };

        db.compras.registrar(compraData, detalles);

        // ── Auditoría ──────────────────────────────────────────
        const resumenItems = detalles.map(d => `${d.nombre_producto} x${d.cantidad}`).join(', ');
        auditLog(req, 'CREAR', 'COMPRAS',
            `Compra ${numOC} — ` +
            `Total: S/ ${(subtotalCompra + igv).toFixed(2)} | ` +
            `Proveedor: ${proveedor || 'Sin proveedor'} | ` +
            `Productos: ${resumenItems}`
        );

        res.status(201).json({ ...compraData, detalles });
    } catch (e) {
        console.error('Error al registrar compra:', e);
        res.status(500).json({ error: 'Error interno: ' + e.message });
    }
});

// PUT void purchase
router.put('/:id/anular', requireRole('ADMIN'), (req, res) => {
    try {
        const { motivo } = req.body;
        if (!motivo) return res.status(400).json({ error: 'El motivo es obligatorio' });

        const compra = db.compras.obtener(req.params.id);
        if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
        if (compra.estado === 'ANULADA') return res.status(400).json({ error: 'La compra ya está anulada' });

        const detalles = db.compras.obtenerDetalle(compra.id_compra);

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
                    const stockAnterior = prod.stock_actual;
                    const stockNuevo    = Math.max(0, stockAnterior - d.cantidad);
                    updateStock.run(stockNuevo, d.id_producto);
                    db.db.prepare(`
                        INSERT INTO stock_almacen (id_almacen, id_producto, stock_actual, stock_minimo)
                        VALUES (?, ?, 0, 0)
                        ON CONFLICT(id_almacen, id_producto) DO NOTHING
                    `).run(db.config.obtener('almacen_principal_id') || 'alm-principal', d.id_producto);
                    db.db.prepare(`
                        UPDATE stock_almacen SET stock_actual = MAX(stock_actual - ?, 0)
                        WHERE id_almacen = ? AND id_producto = ?
                    `).run(d.cantidad, db.config.obtener('almacen_principal_id') || 'alm-principal', d.id_producto);
                    insMov.run({
                        id_movimiento:   uuidv4(),
                        fecha_hora:      now,
                        id_producto:     d.id_producto,
                        nombre_producto: d.nombre_producto,
                        tipo_movimiento: 'SALIDA',
                        cantidad:        d.cantidad,
                        stock_anterior:  stockAnterior,
                        stock_nuevo:     stockNuevo,
                        referencia:      `ANULACION-${compra.numero_oc}`,
                        motivo,
                        usuario:         req.user?.username || 'admin',
                    });
                }
            }
            db.db.prepare(`UPDATE compras SET estado = 'ANULADA', notas = ? WHERE id_compra = ?`)
                .run(`ANULADO: ${motivo}`, compra.id_compra);
        });

        anularTransaccion();

        // ── Auditoría anulación ────────────────────────────────
        const resumenItems = detalles.map(d => `${d.nombre_producto} x${d.cantidad}`).join(', ');
        auditLog(req, 'ELIMINAR', 'COMPRAS',
            `Anulación de compra ${compra.numero_oc} — ` +
            `Total: S/ ${compra.total.toFixed(2)} | ` +
            `Proveedor: ${compra.proveedor || 'Sin proveedor'} | ` +
            `Motivo: ${motivo} | ` +
            `Productos retirados del stock: ${resumenItems}`
        );

        res.json({ ...compra, estado: 'ANULADA', notas: `ANULADO: ${motivo}` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al anular compra: ' + e.message });
    }
});

module.exports = router;
