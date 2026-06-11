const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const db = require('../data/database');
const { requireRole } = require('../middleware/auth');
const { decryptText } = require('../security/secrets');
const { getProvider } = require('../services/cpe/providerFactory');

function getConfigSunat() {
    const raw = db.db;
    const rows = raw.prepare(
        `SELECT clave, valor FROM config WHERE clave IN
        ('sunat_activo','sunat_token','sunat_url','sunat_modo','cpe_proveedor')`
    ).all();
    const cfg = {};
    rows.forEach(r => { cfg[r.clave] = r.valor; });
    if (cfg.sunat_token) cfg.sunat_token = decryptText(cfg.sunat_token);
    return cfg;
}

function obtenerConfigCompleta() {
    const configRows = db.db.prepare(`SELECT clave, valor FROM config`).all();
    const config = {};
    configRows.forEach(r => { config[r.clave] = r.clave === 'sunat_token' ? '' : r.valor; });
    return config;
}

function registrarEvento({ id_venta, operacion, estado, request, response, mensaje, usuario }) {
    try {
        db.db.prepare(`
            INSERT INTO cpe_eventos
                (id_evento, id_venta, operacion, estado, request_json, response_json, mensaje, usuario, fecha_hora)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            randomUUID(),
            id_venta,
            operacion,
            estado,
            request ? JSON.stringify(request) : null,
            response ? JSON.stringify(response) : null,
            mensaje || '',
            usuario || 'sistema',
            new Date().toISOString()
        );
    } catch (err) {
        console.error('[FACTURACION] No se pudo registrar evento CPE:', err.message);
    }
}

function separarComprobante(numeroComprobante = '') {
    const [serie = '', numero = ''] = String(numeroComprobante).split('-');
    return { serie, numero };
}

function upsertDocumentoCpe({ venta, proveedor, payload, estado, response, error, usuario }) {
    const raw = db.db;
    const ahora = new Date().toISOString();
    const { serie, numero } = separarComprobante(venta.numero_comprobante);
    const previo = raw.prepare(`
        SELECT * FROM cpe_documentos
        WHERE proveedor = ? AND tipo_comprobante = ? AND serie = ? AND numero = ?
    `).get(proveedor, venta.tipo_comprobante, serie, numero);

    if (!previo) {
        const id = randomUUID();
        raw.prepare(`
            INSERT INTO cpe_documentos
                (id_cpe, id_venta, proveedor, tipo_comprobante, serie, numero, estado,
                 request_json, response_json, ultimo_error, intentos, fecha_creacion,
                 fecha_actualizacion, usuario)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `).run(
            id,
            venta.id_venta,
            proveedor,
            venta.tipo_comprobante,
            serie,
            numero,
            estado,
            payload ? JSON.stringify(payload) : null,
            response ? JSON.stringify(response) : null,
            error || '',
            ahora,
            ahora,
            usuario || 'sistema'
        );
        return id;
    }

    raw.prepare(`
        UPDATE cpe_documentos SET
            estado = ?,
            request_json = COALESCE(?, request_json),
            response_json = ?,
            ultimo_error = ?,
            intentos = intentos + 1,
            fecha_actualizacion = ?,
            usuario = ?
        WHERE id_cpe = ?
    `).run(
        estado,
        payload ? JSON.stringify(payload) : null,
        response ? JSON.stringify(response) : null,
        error || '',
        ahora,
        usuario || 'sistema',
        previo.id_cpe
    );
    return previo.id_cpe;
}

function marcarDocumentoAceptado({ venta, proveedor, result, usuario }) {
    const raw = db.db;
    const ahora = new Date().toISOString();
    const idCpe = upsertDocumentoCpe({
        venta,
        proveedor,
        payload: result.payload,
        estado: 'ACEPTADO',
        response: result.raw?.body,
        usuario,
    });
    raw.prepare(`
        UPDATE cpe_documentos SET
            codigo_hash = ?,
            enlace_pdf = ?,
            enlace_xml = ?,
            enlace_cdr = ?,
            fecha_aceptacion = ?,
            fecha_actualizacion = ?
        WHERE id_cpe = ?
    `).run(result.hash || '', result.pdfUrl || '', result.xmlUrl || '', result.cdrUrl || '', ahora, ahora, idCpe);
    return idCpe;
}

router.post('/emitir/:id_venta', requireRole('ADMIN', 'CAJERO'), async (req, res) => {
    let payload = null;
    let venta = null;
    let proveedorId = 'nubefact';

    try {
        const raw = db.db;
        const cfg = getConfigSunat();
        proveedorId = cfg.cpe_proveedor || 'nubefact';
        const provider = getProvider(proveedorId);

        if (cfg.sunat_activo !== '1') {
            return res.status(400).json({ error: 'Facturacion electronica no esta activada.' });
        }
        if (!cfg.sunat_token || !cfg.sunat_url) {
            return res.status(400).json({ error: 'Falta configurar token o URL de NubeFact.' });
        }

        venta = raw.prepare(`
            SELECT v.*, c.nombre_razon_social, c.tipo_documento,
                   c.numero_documento, c.direccion, c.email
            FROM ventas v
            LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
            WHERE v.id_venta = ?
        `).get(req.params.id_venta);

        if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });
        if (venta.estado === 'ANULADA') return res.status(400).json({ error: 'No se puede emitir una venta anulada.' });
        if (venta.cpe_estado === 'ACEPTADO') return res.status(400).json({ error: 'Esta venta ya tiene comprobante electronico emitido.' });
        if (venta.tipo_comprobante === 'FACTURA' && !/^\d{11}$/.test(String(venta.numero_documento || ''))) {
            return res.status(400).json({ error: 'Para factura el cliente debe tener RUC valido de 11 digitos.' });
        }

        const detalles = raw.prepare(`
            SELECT dv.*, p.sku, p.unidad_medida, p.nombre AS nombre_producto
            FROM detalle_ventas dv
            JOIN productos p ON dv.id_producto = p.id_producto
            WHERE dv.id_venta = ?
        `).all(req.params.id_venta);

        venta.detalles = detalles;
        venta.cliente = venta.numero_documento ? {
            nombre_razon_social: venta.nombre_razon_social,
            tipo_documento: venta.tipo_documento,
            numero_documento: venta.numero_documento,
            direccion: venta.direccion,
            email: venta.email,
        } : null;

        const config = obtenerConfigCompleta();
        payload = provider.buildPayload(venta, config);

        upsertDocumentoCpe({
            venta,
            proveedor: proveedorId,
            payload,
            estado: 'ENVIANDO',
            usuario: req.user?.username,
        });

        const resultado = await provider.emitir({
            venta,
            config,
            token: cfg.sunat_token,
            url: cfg.sunat_url,
        });

        if (resultado.ok) {
            raw.prepare(`
                UPDATE ventas SET
                    cpe_estado = ?,
                    cpe_codigo_hash = ?,
                    cpe_enlace_pdf = ?,
                    cpe_enlace_xml = ?
                WHERE id_venta = ?
            `).run(
                'ACEPTADO',
                resultado.hash || '',
                resultado.pdfUrl || '',
                resultado.xmlUrl || '',
                req.params.id_venta
            );

            marcarDocumentoAceptado({ venta, proveedor: proveedorId, result: resultado, usuario: req.user?.username });

            registrarEvento({
                id_venta: req.params.id_venta,
                operacion: 'EMITIR',
                estado: 'ACEPTADO',
                request: payload,
                response: resultado.raw?.body,
                usuario: req.user?.username,
            });

            return res.json({
                exito: true,
                estado: 'ACEPTADO',
                proveedor: proveedorId,
                enlace_pdf: resultado.pdfUrl,
                enlace_xml: resultado.xmlUrl,
                enlace_cdr: resultado.cdrUrl,
                hash: resultado.hash,
                nubefact: resultado.raw?.body,
            });
        }

        if (resultado.alreadyExists) {
            raw.prepare(`UPDATE ventas SET cpe_estado = ? WHERE id_venta = ?`)
                .run('ACEPTADO', req.params.id_venta);
            marcarDocumentoAceptado({ venta, proveedor: proveedorId, result: resultado, usuario: req.user?.username });
            registrarEvento({
                id_venta: req.params.id_venta,
                operacion: 'EMITIR',
                estado: 'ACEPTADO',
                request: payload,
                response: resultado.raw?.body,
                mensaje: 'Comprobante ya existia en NubeFact',
                usuario: req.user?.username,
            });
            return res.json({
                exito: true,
                estado: 'ACEPTADO',
                proveedor: proveedorId,
                mensaje: 'Comprobante ya existia en NubeFact - marcado como aceptado.',
                nubefact: resultado.raw?.body,
            });
        }

        raw.prepare(`UPDATE ventas SET cpe_estado = ? WHERE id_venta = ?`)
            .run('RECHAZADO', req.params.id_venta);
        upsertDocumentoCpe({
            venta,
            proveedor: proveedorId,
            payload,
            estado: 'RECHAZADO',
            response: resultado.raw?.body,
            error: typeof resultado.raw?.body?.errors === 'string'
                ? resultado.raw.body.errors
                : JSON.stringify(resultado.raw?.body || {}),
            usuario: req.user?.username,
        });
        registrarEvento({
            id_venta: req.params.id_venta,
            operacion: 'EMITIR',
            estado: 'RECHAZADO',
            request: payload,
            response: resultado.raw?.body,
            usuario: req.user?.username,
        });

        return res.status(422).json({
            exito: false,
            estado: 'RECHAZADO',
            proveedor: proveedorId,
            nubefact: resultado.raw?.body,
        });
    } catch (err) {
        console.error('[FACTURACION] Error al emitir:', err.message);
        if (err.message.includes('Timeout')) {
            try {
                db.db.prepare(`UPDATE ventas SET cpe_estado = 'PENDIENTE' WHERE id_venta = ?`)
                    .run(req.params.id_venta);
                if (venta) {
                    upsertDocumentoCpe({
                        venta,
                        proveedor: proveedorId,
                        payload,
                        estado: 'PENDIENTE_CONSULTA',
                        error: err.message,
                        usuario: req.user?.username,
                    });
                }
                registrarEvento({
                    id_venta: req.params.id_venta,
                    operacion: 'EMITIR',
                    estado: 'PENDIENTE',
                    request: payload,
                    mensaje: err.message,
                    usuario: req.user?.username,
                });
            } catch (_) {}
            return res.status(408).json({
                error: 'NubeFact tardo demasiado en responder. El comprobante puede haberse emitido. Reintente en unos segundos.',
                cpe_estado: 'PENDIENTE',
            });
        }
        if (venta) {
            try {
                upsertDocumentoCpe({
                    venta,
                    proveedor: proveedorId,
                    payload,
                    estado: 'ERROR',
                    error: err.message,
                    usuario: req.user?.username,
                });
            } catch (_) {}
        }
        registrarEvento({
            id_venta: req.params.id_venta,
            operacion: 'EMITIR',
            estado: 'ERROR',
            request: payload,
            mensaje: err.message,
            usuario: req.user?.username,
        });
        res.status(500).json({ error: err.message });
    }
});

router.post('/probar-configuracion', requireRole('ADMIN'), async (req, res) => {
    try {
        const cfg = getConfigSunat();
        const proveedorId = cfg.cpe_proveedor || 'nubefact';
        const provider = getProvider(proveedorId);

        if (!cfg.sunat_token || !cfg.sunat_url) {
            return res.status(400).json({ ok: false, error: 'Falta configurar token o URL del proveedor.' });
        }

        const config = obtenerConfigCompleta();
        const resultado = await provider.probarConexion({
            config,
            token: cfg.sunat_token,
            url: cfg.sunat_url,
        });

        res.json({
            ok: true,
            proveedor: proveedorId,
            mensaje: 'Conexion con el proveedor CPE disponible. Si el comprobante de prueba no existe, la respuesta del proveedor puede indicarlo sin que sea un problema.',
            resultado,
        });
    } catch (err) {
        res.status(500).json({
            ok: false,
            error: err.message,
        });
    }
});

router.get('/estado/:id_venta', requireRole('ADMIN', 'CAJERO'), (req, res) => {
    try {
        const fila = db.db.prepare(`
            SELECT cpe_estado, cpe_codigo_hash, cpe_enlace_pdf, cpe_enlace_xml,
                   nota_credito_serie, nota_credito_numero, nota_credito_fecha, nota_credito_observacion
            FROM ventas WHERE id_venta = ?
        `).get(req.params.id_venta);

        if (!fila) return res.status(404).json({ error: 'Venta no encontrada.' });
        const documentos = db.db.prepare(`
            SELECT id_cpe, proveedor, tipo_comprobante, serie, numero, estado,
                   codigo_hash, enlace_pdf, enlace_xml, enlace_cdr, ultimo_error,
                   intentos, fecha_creacion, fecha_actualizacion, fecha_aceptacion
            FROM cpe_documentos
            WHERE id_venta = ?
            ORDER BY fecha_creacion DESC
        `).all(req.params.id_venta);
        res.json({ ...fila, documentos });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/corregir-cliente/:id_venta', requireRole('ADMIN'), (req, res) => {
    try {
        const raw = db.db;
        const { tipo_documento, numero_documento, nombre_razon_social } = req.body;

        if (!numero_documento || !nombre_razon_social) {
            return res.status(400).json({ error: 'Numero de documento y nombre son obligatorios.' });
        }

        const venta = raw.prepare(`SELECT * FROM ventas WHERE id_venta = ?`).get(req.params.id_venta);
        if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' });
        if (venta.cpe_estado !== 'RECHAZADO') {
            return res.status(400).json({ error: 'Solo se puede corregir una venta con CPE rechazado.' });
        }
        if (!venta.id_cliente) {
            return res.status(400).json({ error: 'Esta venta no tiene cliente asociado.' });
        }

        raw.prepare(`
            UPDATE clientes
            SET tipo_documento = ?,
                numero_documento = ?,
                nombre_razon_social = ?
            WHERE id_cliente = ?
        `).run(tipo_documento, numero_documento, nombre_razon_social, venta.id_cliente);

        raw.prepare(`UPDATE ventas SET cpe_estado = NULL WHERE id_venta = ?`)
            .run(req.params.id_venta);

        registrarEvento({
            id_venta: req.params.id_venta,
            operacion: 'CORREGIR_CLIENTE',
            estado: 'REGISTRADO',
            request: { tipo_documento, numero_documento, nombre_razon_social },
            usuario: req.user?.username,
        });

        res.json({ ok: true, mensaje: 'Datos del cliente corregidos. Ya puedes reemitir el CPE.' });
    } catch (err) {
        console.error('[FACTURACION] Error al corregir cliente:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
