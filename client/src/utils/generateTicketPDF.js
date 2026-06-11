import jsPDF from 'jspdf';
import { getPublicConfig } from '../services/api';
import { condicionPago, medioPagoLabel } from './helpers';
import QRCode from 'qrcode';

/**
 * Genera un PDF de ticket térmico (58mm u 80mm) para impresoras POS.
 * El ancho se toma de config.ticket_ancho (por defecto 80mm).
 *
 * Fixes aplicados (v3):
 *  [FIX-1] IGV fallback usa tasaIGV dinámico, no 1.18 fijo
 *  [FIX-2] tipo_comprobante normalizado a toUpperCase()
 *  [FIX-3] Tabla 2 SUNAT completa en mapeo tipo doc del QR
 *  [FIX-4] Consumidor Final → tipo '0', nro '-' en QR
 *  [FIX-5] Validación formato serie-numero antes del split
 *  [FIX-6] URL SUNAT corregida: www1.sunat.gob.pe
 *  [FIX-7] Tildes en textos legales del pie
 *  [FIX-8] Watermark ANULADO con altTotal calculada antes del dibujo
 *  [FIX-9] Logo detecta JPEG vs PNG desde data URL
 *  [UX-1]  Separadores más compactos (GAP/GAP_AFTER reducidos)
 *  [UX-2]  Items: nombre en bold, importe en azul claro
 *  [UX-3]  Separación entre items con GAP_ITEM antes del nombre (no sepItem flotante)
 */
export async function generateTicketPDF(venta) {
    if (!venta || venta.total == null) {
        throw new Error('generateTicketPDF: venta inválida o sin total.');
    }

    const config = await getPublicConfig();

    // ── Dimensiones ───────────────────────────────────────────
    const anchoMM    = parseInt(config.ticket_ancho || '80');
    const anchoDoc   = anchoMM;
    const margen     = anchoMM === 58 ? 3 : 5;
    const contenido  = anchoDoc - margen * 2;
    const fontSize   = anchoMM === 58 ? 6.5 : 7.5;
    const fontSizeSm = anchoMM === 58 ? 5.5 : 6.5;

    // Interlineado: convierte pt → mm + respiro mínimo
    const lineH   = (size) => size * 0.3528 + 1.6;
    const lineHSm = (size) => size * 0.3528 + 1.2;

    // Espaciado de secciones
    const GAP       = 1.2;   // antes del trazo separador
    const GAP_AFTER = 2.6;   // después del trazo separador
    const GAP_SM    = 0.8;   // micro-espacio entre elementos

    // Separación visual entre productos de la lista.
    // Se aplica ANTES del nombre de cada item (excepto el primero).
    const GAP_ITEM  = 2.4;

    const items = venta.detalles || venta.items || [];

    // [FIX-2]
    const isBoleta  = (venta.tipo_comprobante || '').toUpperCase() === 'BOLETA';
    const isAnulado = venta.estado === 'ANULADA';

    const empresa   = config.empresa_nombre || 'MI EMPRESA';
    const ruc       = config.empresa_ruc || '00000000000';
    const direccion = [
        config.empresa_direccion,
        config.empresa_distrito,
        config.empresa_provincia,
    ].filter(Boolean).join(', ');
    const telefono = config.empresa_telefono || '';

    const fecha    = new Date(venta.fecha_hora || new Date());
    const fechaStr = fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaStr  = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const nombreCliente = venta.cliente?.nombre_razon_social || 'CONSUMIDOR FINAL';
    const docCliente    = venta.cliente
        ? `${venta.cliente.tipo_documento}: ${venta.cliente.numero_documento}`
        : '';

    // [FIX-1]
    const tasaIGV     = parseFloat(config.igv || 18);
    const divisorIGV  = 1 + (tasaIGV / 100);
    const subtotalVal = venta.subtotal ?? (venta.total / divisorIGV);
    const igvVal      = venta.igv      ?? (venta.total - subtotalVal);
    const totalVal    = venta.total    ?? 0;
    const mostrarIGV  = config.ticket_mostrar_igv === '1' || config.ticket_mostrar_igv === true;

    // ── Altura dinámica ───────────────────────────────────────
    let alt = margen;
    if (config.ticket_logo) alt += 22;
    alt += lineH(fontSize + 1);                                 // empresa
    alt += lineHSm(fontSizeSm);                                 // RUC
    if (direccion) alt += lineHSm(fontSizeSm);
    if (telefono)  alt += lineHSm(fontSizeSm);
    alt += GAP + 0.8 + GAP_AFTER;                               // sepDoble
    alt += GAP_SM + lineH(fontSize + 1);                        // tipo comprobante
    alt += lineH(fontSize + 1);                                 // número
    alt += GAP + 0.8 + GAP_AFTER;                               // sepDoble
    if (config.ticket_serie_maquina) alt += lineHSm(fontSizeSm) + GAP_SM;
    const filasPago = venta.forma_pago === 'CREDITO' && venta.credito ? 6 : 4;
    alt += lineH(fontSize) * filasPago;
    alt += GAP + GAP_AFTER;                                     // sepH cliente
    alt += lineHSm(fontSizeSm);                                 // "Cliente:"
    alt += lineH(fontSize) * 3;                                 // nombre (máx 3 líneas)
    if (docCliente) alt += lineHSm(fontSizeSm);
    alt += GAP + GAP_AFTER;                                     // sepH tabla
    alt += lineHSm(fontSizeSm) + GAP_SM;                        // cabecera tabla
    alt += 0.3 + lineH(fontSize);                               // línea cabecera + espacio real
    items.forEach((_, idx) => {
        if (idx > 0) alt += GAP_ITEM;                          // separación entre items
        alt += lineH(fontSize);                                 // nombre (1 línea estimada)
        alt += lineHSm(fontSizeSm);                            // precio c/u + importe
    });
    if (items.length > 0) alt += GAP_SM;                       // respiro pre-sepDoble
    alt += GAP + 0.8 + GAP_AFTER;                               // sepDoble totales
    if (mostrarIGV) alt += lineHSm(fontSizeSm) * 2 + GAP_SM;
    alt += lineH(fontSize + 3) + GAP_SM;                        // TOTAL
    alt += GAP + GAP_AFTER;                                     // sepH pie
    alt += lineHSm(fontSizeSm) * 3;                             // 3 líneas pie
    alt += anchoDoc * 0.45 + 4;                                 // QR
    alt += margen;

    // [FIX-8] altTotal fijo antes del dibujo — watermark centrado correctamente
    const altTotal = Math.ceil(alt);

    const doc = new jsPDF({
        unit:     'mm',
        format:   [anchoDoc, altTotal],
        compress: true,
    });

    // ── Paleta ────────────────────────────────────────────────
    const AZUL       = [26,  60,  94];
    const AZUL_CLARO = [55, 105, 155];
    const GRIS       = [110, 110, 110];
    const NEGRO      = [30,  30,  30];
    const ROJO       = [200, 40,  40];

    let y = margen;

    // ── Helpers de dibujo ─────────────────────────────────────
    const sepH = () => {
        y += GAP;
        doc.setDrawColor(...GRIS);
        doc.setLineWidth(0.2);
        doc.line(margen, y, margen + contenido, y);
        y += GAP_AFTER;
    };

    const sepDoble = () => {
        y += GAP;
        doc.setDrawColor(...AZUL);
        doc.setLineWidth(0.3);
        doc.line(margen, y,       margen + contenido, y);
        doc.line(margen, y + 0.8, margen + contenido, y + 0.8);
        y += 0.8 + GAP_AFTER;
    };

    const centro = (texto, tamaño, bold = false, color = NEGRO) => {
        doc.setFontSize(tamaño);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setTextColor(...color);
        doc.splitTextToSize(texto, contenido).forEach(l => {
            doc.text(l, margen + contenido / 2, y, { align: 'center' });
            y += lineH(tamaño);
        });
    };

    const par = (izq, der, tamaño = fontSize, colorIzq = GRIS, colorDer = NEGRO) => {
        doc.setFontSize(tamaño);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colorIzq);
        doc.text(izq, margen, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colorDer);
        doc.text(der, margen + contenido, y, { align: 'right' });
        y += lineH(tamaño);
    };

    // ── LOGO ─────────────────────────────────────────────────
    if (config.ticket_logo) {
        try {
            const logoAncho = Math.min(contenido * 0.6, 40);
            await new Promise((resolve) => {
                const img = new window.Image();
                img.onload = () => {
                    const ratio    = img.naturalHeight / img.naturalWidth;
                    const logoAlto = Math.round(logoAncho * ratio * 10) / 10;
                    const logoX    = (anchoDoc - logoAncho) / 2;
                    // [FIX-9]
                    const fmt = (config.ticket_logo.startsWith('data:image/jpeg') ||
                                 config.ticket_logo.startsWith('data:image/jpg'))
                        ? 'JPEG' : 'PNG';
                    doc.addImage(config.ticket_logo, fmt, logoX, y, logoAncho, logoAlto, '', 'FAST');
                    y += logoAlto + GAP;
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = config.ticket_logo;
            });
        } catch (_) { /* continúa sin logo */ }
    }

    // ── CABECERA EMPRESA ──────────────────────────────────────
    centro(empresa.toUpperCase(), fontSize + 1, true, AZUL);
    centro(`RUC: ${ruc}`, fontSizeSm, false, GRIS);
    if (direccion) centro(direccion, fontSizeSm, false, GRIS);
    if (telefono)  centro(`Telf: ${telefono}`, fontSizeSm, false, GRIS);
    sepDoble();

    // ── TIPO DE COMPROBANTE ───────────────────────────────────
    // Mientras no haya CPE aprobado: "NOTA DE VENTA" evita
    // vulnerar el Reglamento de Comprobantes de Pago (RCP).
    y += GAP_SM;
    centro(
        venta.cpe_estado === 'ACEPTADO'
            ? (isBoleta ? 'BOLETA DE VENTA' : 'FACTURA DE VENTA')
            : (isBoleta ? 'NOTA DE VENTA (Boleta)' : 'NOTA DE VENTA (Factura)'),
        fontSize + 1, true, AZUL
    );
    centro(venta.numero_comprobante || venta.numero_venta || '', fontSize + 1, true, NEGRO);
    sepDoble();

    // ── SERIE MÁQUINA ─────────────────────────────────────────
    if (config.ticket_serie_maquina) {
        centro(`Serie máquina: ${config.ticket_serie_maquina}`, fontSizeSm, false, GRIS);
        y += GAP_SM;
    }

    // ── DATOS GENERALES ───────────────────────────────────────
    par('Fecha:',     fechaStr);
    par('Hora:',      horaStr);
    par('Condición:', condicionPago(venta.forma_pago));

    if (venta.forma_pago === 'CREDITO' && venta.credito) {
        const cr       = venta.credito;
        const fmtFecha = cr.fecha_vencimiento
            ? new Date(cr.fecha_vencimiento + 'T00:00:00')
                .toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'Sin fecha';
        par('Adelanto:', `S/ ${Number(cr.monto_adelanto).toFixed(2)}`);
        const saldo = Number(cr.saldo_pendiente);
        par('Saldo:',    `S/ ${saldo.toFixed(2)}`, fontSize, GRIS, saldo > 0 ? ROJO : [30, 120, 30]);
        par('Vence:',    fmtFecha);
    } else {
        par('Medio:', medioPagoLabel(venta.forma_pago, venta.monto_efectivo, venta.monto_yape_plin));
    }

    sepH();

    // ── DATOS CLIENTE ─────────────────────────────────────────
    doc.setFontSize(fontSizeSm);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRIS);
    doc.text('Cliente:', margen, y);
    y += lineHSm(fontSizeSm);

    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NEGRO);
    doc.splitTextToSize(nombreCliente, contenido)
       .forEach(l => { doc.text(l, margen, y); y += lineH(fontSize); });

    if (docCliente) {
        doc.setFontSize(fontSizeSm);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRIS);
        doc.text(docCliente, margen, y);
        y += lineHSm(fontSizeSm);
    }

    sepH();

    // ── CABECERA TABLA ────────────────────────────────────────
    doc.setFontSize(fontSizeSm);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...AZUL);
    doc.text('Cant. Descripción', margen, y);
    doc.text('Importe', margen + contenido, y, { align: 'right' });
    y += lineHSm(fontSizeSm) + GAP_SM;
    doc.setDrawColor(...AZUL);
    doc.setLineWidth(0.3);
    doc.line(margen, y, margen + contenido, y);
    y += lineH(fontSize);   // espacio suficiente para que el primer item no se superponga

    // ── ITEMS ─────────────────────────────────────────────────
    //
    // Estructura de cada item:
    //
    //   [GAP_ITEM]  ← solo si no es el primero
    //   Nombre producto (bold, negro)
    //   S/ X.XX c/u (gris, sm izq)    S/ X.XX (azul, sm der)
    //
    // GAP_ITEM va ANTES del nombre — nunca después del precio.
    // Así el espacio queda visualmente entre items, no al final.
    //
    items.forEach((d, idx) => {
        const precio   = Number(d.precio_unitario ?? d.precio_venta ?? 0);
        const subtotal = Number(d.subtotal_linea  ?? (precio * d.cantidad));
        const nombre   = d.nombre_producto || d.nombre || '';

        // Separación antes del segundo item en adelante
        if (idx > 0) y += GAP_ITEM;

        // Nombre — bold para jerarquía visual
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...NEGRO);
        doc.splitTextToSize(`${d.cantidad} x ${nombre}`, contenido)
           .forEach(l => { doc.text(l, margen, y); y += lineH(fontSize); });

        // Precio unitario (izq) + importe (der) — misma línea, tamaño sm
        doc.setFontSize(fontSizeSm);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRIS);
        doc.text(`S/ ${precio.toFixed(2)} c/u`, margen + 2, y);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...AZUL_CLARO);
        doc.text(`S/ ${subtotal.toFixed(2)}`, margen + contenido, y, { align: 'right' });

        y += lineHSm(fontSizeSm);   // avanzar con el tamaño real de esta fila

        // Descuento de línea (si existe)
        if (d.descuento_linea > 0) {
            doc.setFontSize(fontSizeSm);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...ROJO);
            doc.text(`  Descuento: -S/ ${Number(d.descuento_linea).toFixed(2)}`, margen, y);
            y += lineHSm(fontSizeSm);
        }
    });

    if (items.length > 0) y += GAP_SM;   // respiro antes del sepDoble

    sepDoble();

    // ── TOTALES ───────────────────────────────────────────────
    if (mostrarIGV) {
        par('Op. Gravada:', `S/ ${subtotalVal.toFixed(2)}`, fontSizeSm);
        par(`IGV (${tasaIGV}%):`, `S/ ${igvVal.toFixed(2)}`, fontSizeSm);
        y += GAP_SM;
    }

    doc.setFontSize(fontSize + 3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...AZUL);
    doc.text('TOTAL:', margen, y);
    doc.text(`S/ ${totalVal.toFixed(2)}`, margen + contenido, y, { align: 'right' });
    y += lineH(fontSize + 3) + GAP_SM;

    sepH();

    // ── PIE ───────────────────────────────────────────────────
    // Al integrar CPE con SUNAT reemplazar por:
    //   'Representación impresa del comprobante de pago electrónico.'
    //   'Consulte en: https://www1.sunat.gob.pe/ol-ti-itconsultaunificada'
    const mensajePie = config.ticket_mensaje_pie || '¡Gracias por su compra!';
    centro(mensajePie, fontSizeSm, true, GRIS);
    if (venta.cpe_estado === 'ACEPTADO') {
        centro('Representación impresa del CPE electrónico.', fontSizeSm - 0.5, false, GRIS);
        centro('Consulte en: www1.sunat.gob.pe', fontSizeSm - 0.5, false, GRIS);  // [FIX-6]
    } else {
        centro('Documento interno de respaldo de operación comercial.', fontSizeSm - 0.5, false, GRIS);  // [FIX-7]
        centro('No es comprobante de pago electrónico (CPE).', fontSizeSm - 0.5, false, GRIS);
    }

    // ── QR SUNAT ─────────────────────────────────────────────
    // Formato: RUC|TIPO_DOC|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC_CLI|NRO_DOC_CLI
    // Ref: Res. 097-2012/SUNAT, Anexo 8 Tabla 2
    try {
        let qrData = '';

        if (venta.cpe_estado === 'ACEPTADO') {
            // [FIX-5] · [FIX-10] Número sin ceros: '00000042' → '42' (Res. 097-2012/SUNAT Anexo 8)
            const numComp  = venta.numero_comprobante || '';
            const guionIdx = numComp.indexOf('-');
            const serie    = guionIdx > -1 ? numComp.slice(0, guionIdx) : numComp;
            const numero   = guionIdx > -1
                ? String(parseInt(numComp.slice(guionIdx + 1), 10) || 0)
                : '';

            // [FIX-3]
            const TABLA2_SUNAT = {
                'DNI':               '1',
                'RUC':               '6',
                'CE':                '4',
                'PASAPORTE':         '7',
                'CARNET_EXTRANJERIA':'4',
                'PARTIDA_NACIMIENTO':'0',
            };

            // [FIX-4]
            const tipoDocCli = venta.cliente?.tipo_documento
                ? (TABLA2_SUNAT[venta.cliente.tipo_documento] || '-')
                : '0';
            const nroDocCli  = venta.cliente?.numero_documento || '-';

            const tipoDocComp = isBoleta ? '03' : '01';
            const fechaQR     = fecha.toISOString().slice(0, 10);

            qrData = [
                ruc, tipoDocComp, serie, numero,
                igvVal.toFixed(2), totalVal.toFixed(2),
                fechaQR, tipoDocCli, nroDocCli,
            ].join('|');
        } else {
            // QR interno para notas de venta o CPE no aceptados
            const fechaQR = fecha.toISOString().slice(0, 10);
            qrData = `HUASCARAN|${venta.numero_venta}|${totalVal.toFixed(2)}|${fechaQR}`;
            
            // Subtítulo adicional aclaratorio
            y += 2;
            centro('Verificación interna — no válido ante SUNAT', fontSizeSm - 0.5, false, GRIS);
            y += 2;
        }

        const qrSize    = Math.round(anchoDoc * 0.45);
        const qrDataUrl = await QRCode.toDataURL(qrData, { width: 120, margin: 1 });
        const qrX       = (anchoDoc - qrSize) / 2;
        doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize);
        y += qrSize + 2;
    } catch (_) { /* continúa sin QR */ }

    // ── ANULADO watermark ─────────────────────────────────────
    if (isAnulado) {
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 50, 50);
        doc.text('ANULADO', anchoDoc / 2, altTotal / 2, { align: 'center', angle: 45 }); // [FIX-8]
    }

    // ── ABRIR ─────────────────────────────────────────────────
    const base64 = doc.output('datauristring').split(',')[1];
    if (window.electronAPI) await window.electronAPI.openPDF(base64);
    else window.open(doc.output('bloburl'), '_blank');
}
