const https = require('https');

function tipoDocCodigo(tipo) {
    const map = { DNI: '1', RUC: '6', CE: '4', PASAPORTE: '7' };
    return map[tipo] || '-';
}

function unidadCodigo(unidad) {
    const map = {
        UND: 'NIU',
        UNIDAD: 'NIU',
        KG: 'KGM',
        KILO: 'KGM',
        M: 'MTR',
        METRO: 'MTR',
        M2: 'MTK',
        LT: 'LTR',
        LITRO: 'LTR',
        BOLSA: 'NIU',
        VARILLA: 'NIU',
        PLANCHA: 'NIU',
        ROLLO: 'NIU',
        JUEGO: 'NIU',
    };
    return map[(unidad || '').toUpperCase()] || 'NIU';
}

function formatFechaNubefact(fechaISO) {
    const d = new Date(fechaISO);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

function buildPayload(venta, config) {
    const isBoleta = venta.tipo_comprobante === 'BOLETA';
    const igvTotal = Number(venta.igv || 0);
    const items = (venta.detalles || []).map((d, idx, arr) => {
        const precioConIgv = Number(d.precio_unitario);
        const subtotalLinea = Number(d.subtotal_linea);

        let igvLinea;
        if (idx === arr.length - 1) {
            const igvAcumulado = arr.slice(0, idx).reduce((sum, prev) => {
                const sub = Number(prev.subtotal_linea);
                return Math.round((sum + Math.round(sub * 18 / 118 * 100) / 100) * 100) / 100;
            }, 0);
            igvLinea = Math.round((igvTotal - igvAcumulado) * 100) / 100;
        } else {
            igvLinea = Math.round(subtotalLinea * 18 / 118 * 100) / 100;
        }

        const cantidad = Number(d.cantidad || 1);
        const valorUnitario = Math.round((subtotalLinea - igvLinea) / cantidad * 100) / 100;

        return {
            unidad_de_medida: unidadCodigo(d.unidad_medida),
            codigo: d.sku || d.id_producto,
            descripcion: d.nombre_producto || d.nombre,
            cantidad,
            valor_unitario: valorUnitario,
            precio_unitario: precioConIgv,
            subtotal: Math.round((subtotalLinea - igvLinea) * 100) / 100,
            tipo_de_igv: 1,
            igv: igvLinea,
            total: subtotalLinea,
            anticipo_regularizacion: false,
        };
    });

    const cliente = venta.cliente || {};
    const tieneCliente = cliente.numero_documento;

    return {
        operacion: 'generar_comprobante',
        tipo_de_comprobante: isBoleta ? 2 : 1,
        serie: isBoleta ? (config.serie_boleta || 'B001') : (config.serie_factura || 'F001'),
        numero: isBoleta ? Number(config.correlativo_boleta || 1) : Number(config.correlativo_factura || 1),
        sunat_transaction: 1,
        cliente_tipo_de_documento: tieneCliente ? tipoDocCodigo(cliente.tipo_documento) : '-',
        cliente_numero_de_documento: tieneCliente ? cliente.numero_documento : '-',
        cliente_denominacion: tieneCliente ? cliente.nombre_razon_social : 'CONSUMIDOR FINAL',
        cliente_direccion: cliente.direccion || '',
        cliente_email: cliente.email || '',
        cliente_email_1: '',
        cliente_email_2: '',
        fecha_de_emision: formatFechaNubefact(venta.fecha_hora),
        fecha_de_vencimiento: '',
        moneda: 1,
        porcentaje_de_igv: Number(config.igv || 18),
        descuento_global: Number(venta.descuento || 0),
        total_descuento: Number(venta.descuento || 0),
        total_anticipo: 0,
        total_gravada: Number(venta.subtotal || 0),
        total_inafecta: 0,
        total_exonerada: 0,
        total_igv: Number(venta.igv || 0),
        total_gratuita: 0,
        total_otros_cargos: 0,
        total: Number(venta.total || 0),
        percepcion_tipo: '',
        percepcion_base_imponible: 0,
        total_percepcion: 0,
        total_incluido_percepcion: 0,
        detraccion: false,
        observaciones: venta.notas || '',
        documento_que_se_modifica_tipo: '',
        documento_que_se_modifica_serie: '',
        documento_que_se_modifica_numero: '',
        tipo_de_nota_de_credito: '',
        tipo_de_nota_de_debito: '',
        enviar_automaticamente_a_la_sunat: true,
        enviar_automaticamente_al_cliente: config.cpe_envio_email_cliente !== '0' && !!cliente.email,
        formato_de_pdf: config.cpe_formato_pdf || 'A4',
        items,
    };
}

function requestJson(url, token, payload, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: `${urlObj.pathname}${urlObj.search || ''}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Token token="${token}"`,
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch (_) { resolve({ status: res.statusCode, body: data }); }
            });
        });

        req.on('error', reject);
        req.setTimeout(timeoutMs, () => { req.destroy(new Error('Timeout NubeFact - intente nuevamente')); });
        req.write(body);
        req.end();
    });
}

async function emitir({ venta, config, token, url }) {
    const payload = buildPayload(venta, config);
    const result = await requestJson(url, token, payload);
    return {
        provider: 'nubefact',
        payload,
        raw: result,
        ok: result.status === 200 && !!(result.body?.enlace_del_pdf || result.body?.codigo_hash),
        alreadyExists: result.body?.codigo === 23,
        hash: result.body?.codigo_hash || '',
        pdfUrl: result.body?.enlace_del_pdf || '',
        xmlUrl: result.body?.enlace_del_xml || '',
        cdrUrl: result.body?.enlace_del_cdr || '',
    };
}

async function probarConexion({ config, token, url }) {
    const serie = config.serie_factura || 'F001';
    const result = await requestJson(url, token, {
        operacion: 'consultar_comprobante',
        tipo_de_comprobante: 1,
        serie,
        numero: 1,
    }, 15000);

    return {
        provider: 'nubefact',
        reachable: true,
        status: result.status,
        body: result.body,
    };
}

module.exports = {
    id: 'nubefact',
    buildPayload,
    emitir,
    probarConexion,
};
