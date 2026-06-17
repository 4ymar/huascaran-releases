import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { condicionPago, medioPagoLabel } from './helpers';

/**
 * Función de dibujo pura — recibe el doc y todos los datos ya calculados.
 * Se llama dos veces: primera para medir el alto real, segunda para el PDF final.
 * Devuelve el valor final de y (cursor vertical).
 */
function drawTicket(doc, data) {
    const {
        anchoMM, pad, contentW,
        fsNormal, fsSm, fsTitle, fsTotal,
        AZUL, GRIS, NEGRO, ROJO, AZULC,
        empresa, ruc, direccion, telefono,
        fechaStr, horaStr,
        nombreCliente, docCliente,
        tasaIGV, subtotalVal, igvVal, totalVal, mostrarIGV,
        tipoComprobante, mensajePie,
        qrDataUrl, qrInterno, isAnulado,
        items, venta, config,
    } = data;

    let y = pad;

    // ── Helpers ──────────────────────────────────────────────
    function setColor(rgb) { doc.setTextColor(...rgb); }
    function setDraw(rgb)  { doc.setDrawColor(...rgb); }

    function lineSep(color = GRIS, lw = 0.2) {
        setDraw(color);
        doc.setLineWidth(lw);
        doc.line(pad, y, anchoMM - pad, y);
        y += 3;
    }

    function textCenter(str, opts = {}) {
        if (!str) return;
        const { color = NEGRO, bold = false, size = fsNormal } = opts;
        doc.setFontSize(size);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        setColor(color);
        doc.text(String(str), anchoMM / 2, y, { align: 'center' });
    }

    function textPair(label, value, opts = {}) {
        const { colorVal = NEGRO, bold = true, size = fsNormal } = opts;
        doc.setFontSize(size);
        doc.setFont('helvetica', 'normal');
        setColor(GRIS);
        doc.text(label, pad, y);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        setColor(colorVal);
        doc.text(value, anchoMM - pad, y, { align: 'right' });
        y += 4.5;
    }

    function nl(h = 4) { y += h; }

    // ── Logo ─────────────────────────────────────────────────
    if (config.ticket_logo && config.ticket_logo.startsWith('data:image/')) {
        try {
            const logoW  = anchoMM * 0.3;
            const props  = doc.getImageProperties(config.ticket_logo);
            const logoH  = logoW * (props.height / props.width);
            const logoX = (anchoMM - logoW) / 2;
            const ext   = config.ticket_logo.includes('image/png') ? 'PNG' : 'JPEG';
            doc.addImage(config.ticket_logo, ext, logoX, y, logoW, logoH, '', 'FAST');
            y += logoH + 3;
        } catch (_) { /* sin logo */ }
    }

    // ── Encabezado empresa ───────────────────────────────────
    textCenter(empresa, { color: AZUL, bold: true, size: fsTitle }); nl(4.5);
    textCenter(`RUC: ${ruc}`, { color: GRIS, size: fsSm }); nl(3.5);
    if (direccion) {
        doc.setFontSize(fsSm);
        doc.setFont('helvetica', 'normal');
        setColor(GRIS);
        const lines = doc.splitTextToSize(direccion, contentW);
        lines.forEach(l => { doc.text(l, anchoMM / 2, y, { align: 'center' }); y += 3.5; });
    }
    if (telefono) { textCenter(`Telf: ${telefono}`, { color: GRIS, size: fsSm }); nl(3.5); }

    // ── Tipo comprobante ─────────────────────────────────────
    nl(1);
    lineSep(AZUL, 0.5);
    textCenter(tipoComprobante, { color: AZUL, bold: true, size: fsNormal + 1 }); nl(4);
    textCenter(venta.numero_comprobante || venta.numero_venta || '', { bold: true }); nl(4);
    lineSep(AZUL, 0.5);

    // ── Serie máquina ────────────────────────────────────────
    if (config.ticket_serie_maquina) {
        textCenter(`Serie máquina: ${config.ticket_serie_maquina}`, { color: GRIS, size: fsSm }); nl(4);
    }

    // ── Fecha / Hora / Condición / Pago ─────────────────────
    textPair('Fecha:', fechaStr);
    textPair('Hora:', horaStr);
    textPair('Condición:', condicionPago(venta.forma_pago));

    if (venta.forma_pago === 'CREDITO' && venta.credito) {
        const cr = venta.credito;
        const fmtFecha = cr.fecha_vencimiento
            ? new Date(cr.fecha_vencimiento + 'T00:00:00')
                .toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'Sin fecha';
        const saldo = Number(cr.saldo_pendiente);
        textPair('Adelanto:', `S/ ${Number(cr.monto_adelanto).toFixed(2)}`);
        textPair('Saldo:', `S/ ${saldo.toFixed(2)}`, { colorVal: saldo > 0 ? ROJO : [30, 120, 32] });
        textPair('Vence:', fmtFecha);
    } else {
        textPair('Medio:', medioPagoLabel(venta.forma_pago, venta.monto_efectivo, venta.monto_yape_plin));
    }

    // ── Cliente ──────────────────────────────────────────────
    nl(1);
    lineSep(GRIS, 0.2);
    doc.setFontSize(fsSm); doc.setFont('helvetica', 'normal'); setColor(GRIS);
    doc.text('Cliente:', pad, y); nl(3.5);
    doc.setFontSize(fsNormal); doc.setFont('helvetica', 'bold'); setColor(NEGRO);
    const nombreLines = doc.splitTextToSize(nombreCliente, contentW);
    nombreLines.forEach(l => { doc.text(l, pad, y); y += 4; });
    if (docCliente) {
        doc.setFontSize(fsSm); doc.setFont('helvetica', 'normal'); setColor(GRIS);
        doc.text(docCliente, pad, y); nl(4);
    }

    // ── Items ────────────────────────────────────────────────
    nl(1);
    lineSep(GRIS, 0.2);
    doc.setFontSize(fsSm); doc.setFont('helvetica', 'bold'); setColor(AZUL);
    doc.text('Cant. Descripción', pad, y);
    doc.text('Importe', anchoMM - pad, y, { align: 'right' });
    nl(2);
    setDraw(AZUL); doc.setLineWidth(0.3); doc.line(pad, y, anchoMM - pad, y); nl(3);

    items.forEach((d, idx) => {
        if (idx > 0) nl(2);
        const precio     = Number(d.precio_unitario ?? d.precio_venta ?? 0);
        const subtotal   = Number(d.subtotal_linea  ?? (precio * d.cantidad));
        const nombre     = d.nombre_producto || d.nombre || '';
        const importeStr = `S/ ${subtotal.toFixed(2)}`;
        const linea1     = `${d.cantidad} x ${nombre}`;

        doc.setFontSize(fsNormal); doc.setFont('helvetica', 'bold'); setColor(NEGRO);
        const wrapped = doc.splitTextToSize(linea1, contentW - 18);
        doc.text(wrapped[0], pad, y);
        setColor(AZULC); doc.text(importeStr, anchoMM - pad, y, { align: 'right' }); y += 4;
        for (let i = 1; i < wrapped.length; i++) { setColor(NEGRO); doc.text(wrapped[i], pad, y); y += 4; }

        doc.setFontSize(fsSm); doc.setFont('helvetica', 'normal'); setColor(GRIS);
        doc.text(`S/ ${precio.toFixed(2)} c/u`, pad + 2, y); nl(3.5);

        if (d.descuento_linea > 0) {
            setColor(ROJO);
            doc.text(`Descuento: -S/ ${Number(d.descuento_linea).toFixed(2)}`, pad + 2, y); nl(3.5);
        }
    });

    // ── Totales ──────────────────────────────────────────────
    nl(1);
    lineSep(AZUL, 0.5);
    if (mostrarIGV) {
        textPair('Op. Gravada:', `S/ ${subtotalVal.toFixed(2)}`, { size: fsSm });
        textPair(`IGV (${tasaIGV}%):`, `S/ ${igvVal.toFixed(2)}`, { size: fsSm });
    }
    doc.setFontSize(fsTotal); doc.setFont('helvetica', 'bold'); setColor(AZUL);
    doc.text('TOTAL:', pad, y);
    doc.text(`S/ ${totalVal.toFixed(2)}`, anchoMM - pad, y, { align: 'right' }); nl(6);

    // ── Pie ──────────────────────────────────────────────────
    lineSep(GRIS, 0.2);
    textCenter(mensajePie, { color: GRIS, bold: true, size: fsSm }); nl(3.5);
    if (venta.cpe_estado === 'ACEPTADO') {
        textCenter('Representación impresa del CPE electrónico.', { color: GRIS, size: fsSm }); nl(3.5);
        textCenter('Consulte en: www1.sunat.gob.pe', { color: GRIS, size: fsSm }); nl(3.5);
    } else {
        textCenter('Documento interno de respaldo de operación comercial.', { color: GRIS, size: fsSm }); nl(3.5);
        textCenter('No es comprobante de pago electrónico (CPE).', { color: GRIS, size: fsSm }); nl(3.5);
    }
    if (qrInterno) { textCenter('Verificación interna — no válido ante SUNAT', { color: GRIS, size: fsSm }); nl(3.5); }

    // ── QR ───────────────────────────────────────────────────
    if (qrDataUrl) {
        const qrSize = anchoMM === 58 ? 28 : 34;
        const qrX    = (anchoMM - qrSize) / 2;
        nl(2);
        doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize);
        y += qrSize + 4;
    }

    // ── Marca ANULADO ────────────────────────────────────────
    if (isAnulado) {
        const midY = y / 2;
        doc.setFontSize(28); doc.setFont('helvetica', 'bold');
        doc.setTextColor(200, 40, 40);
        doc.text('ANULADO', anchoMM / 2, midY, { align: 'center', angle: 35 });
    }

    return y;
}

/**
 * Genera el PDF del ticket térmico directamente con jsPDF.
 * Usa dos pasadas para calcular el alto real antes de generar el PDF final.
 */
export async function buildTicketPDF(venta, config) {

    const anchoMM  = parseInt(config.ticket_ancho || '80');
    const pad      = anchoMM === 58 ? 4 : 5;
    const contentW = anchoMM - pad * 2;
    const items    = venta.detalles || venta.items || [];
    const isBoleta = (venta.tipo_comprobante || '').toUpperCase() === 'BOLETA';
    const isAnulado = venta.estado === 'ANULADA';

    const empresa   = (config.empresa_nombre || 'MI EMPRESA').toUpperCase();
    const ruc       = config.empresa_ruc || '00000000000';
    const direccion = [config.empresa_direccion, config.empresa_distrito, config.empresa_provincia]
        .filter(Boolean).join(', ');
    const telefono  = config.empresa_telefono || '';

    const fecha    = new Date(venta.fecha_hora || new Date());
    const fechaStr = fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaStr  = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const nombreCliente = venta.cliente?.nombre_razon_social || 'CONSUMIDOR FINAL';
    const docCliente    = venta.cliente
        ? `${venta.cliente.tipo_documento}: ${venta.cliente.numero_documento}`
        : '';

    const tasaIGV     = parseFloat(config.igv || 18);
    const divisorIGV  = 1 + (tasaIGV / 100);
    const subtotalVal = venta.subtotal ?? (venta.total / divisorIGV);
    const igvVal      = venta.igv      ?? (venta.total - subtotalVal);
    const totalVal    = venta.total    ?? 0;
    const mostrarIGV  = config.ticket_mostrar_igv === '1' || config.ticket_mostrar_igv === true;

    const tipoComprobante = venta.cpe_estado === 'ACEPTADO'
        ? (isBoleta ? 'BOLETA DE VENTA' : 'FACTURA DE VENTA')
        : (isBoleta ? 'NOTA DE VENTA (Boleta)' : 'NOTA DE VENTA (Factura)');

    const mensajePie = config.ticket_mensaje_pie || '¡Gracias por su compra!';

    // ── QR ────────────────────────────────────────────────────
    let qrDataUrl = '';
    let qrInterno = false;
    try {
        let qrData = '';
        if (venta.cpe_estado === 'ACEPTADO') {
            const numComp  = venta.numero_comprobante || '';
            const guionIdx = numComp.indexOf('-');
            const serie    = guionIdx > -1 ? numComp.slice(0, guionIdx) : numComp;
            const numero   = guionIdx > -1 ? String(parseInt(numComp.slice(guionIdx + 1), 10) || 0) : '';
            const TABLA2   = { 'DNI': '1', 'RUC': '6', 'CE': '4', 'PASAPORTE': '7', 'CARNET_EXTRANJERIA': '4', 'PARTIDA_NACIMIENTO': '0' };
            const tipoDocCli  = venta.cliente?.tipo_documento ? (TABLA2[venta.cliente.tipo_documento] || '-') : '0';
            const nroDocCli   = venta.cliente?.numero_documento || '-';
            const tipoDocComp = isBoleta ? '03' : '01';
            const fechaQR     = fecha.toISOString().slice(0, 10);
            qrData = [ruc, tipoDocComp, serie, numero, igvVal.toFixed(2), totalVal.toFixed(2), fechaQR, tipoDocCli, nroDocCli].join('|');
        } else {
            qrInterno = true;
            qrData = `HUASCARAN|${venta.numero_venta}|${totalVal.toFixed(2)}|${fecha.toISOString().slice(0, 10)}`;
        }
        qrDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });
    } catch (_) { /* sin QR */ }

    const fsNormal = anchoMM === 58 ? 7  : 8;
    const fsSm     = anchoMM === 58 ? 6  : 7;
    const fsTitle  = anchoMM === 58 ? 9  : 10;
    const fsTotal  = anchoMM === 58 ? 12 : 13;
    const AZUL  = [26,  60,  94];
    const GRIS  = [110, 110, 110];
    const NEGRO = [30,  30,  30];
    const ROJO  = [200, 40,  40];
    const AZULC = [55,  105, 153];

    const drawData = {
        anchoMM, pad, contentW,
        fsNormal, fsSm, fsTitle, fsTotal,
        AZUL, GRIS, NEGRO, ROJO, AZULC,
        empresa, ruc, direccion, telefono,
        fechaStr, horaStr,
        nombreCliente, docCliente,
        tasaIGV, subtotalVal, igvVal, totalVal, mostrarIGV,
        tipoComprobante, mensajePie,
        qrDataUrl, qrInterno, isAnulado,
        items, venta, config,
    };

    // ── Primera pasada: medir alto real ──────────────────────
    const docMedicion = new jsPDF({ unit: 'mm', format: [anchoMM, 2000], orientation: 'portrait' });
    const yFinal = drawTicket(docMedicion, drawData);
    const altoReal = yFinal + pad;
    console.log('[ticketPDF] altoReal calculado:', altoReal, 'mm');

    // ── Segunda pasada: PDF final con alto exacto ────────────
    const docFinal = new jsPDF({ unit: 'mm', format: [anchoMM, altoReal], orientation: 'portrait' });
    drawTicket(docFinal, drawData);

    const base64 = docFinal.output('datauristring').split(',')[1];
    return { base64, anchoMM };
}
