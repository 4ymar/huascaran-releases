import { buildTicketHTML } from './ticketTemplate';
import { buildTicketPDF } from './ticketPDF';

/**
 * Genera y muestra el ticket térmico.
 * Firma idéntica al archivo anterior — Ventas.jsx y Comprobantes.jsx
 * no requieren ningún cambio.
 *
 * Flujo:
 *   1. buildTicketHTML()  → genera HTML+CSS completo
 *   2. electronAPI.printTicket() → Electron abre ventana oculta,
 *      llama webContents.printToPDF() y abre el visor nativo
 *
 * @param {object} venta   — objeto de venta con detalles, cliente, etc.
 * @param {object} config  — configuración del sistema (empresa, ticket, igv…)
 * @param {object} opts    — { silent: bool } — true = imprime directo sin diálogo
 */
export async function generateTicketPDF(venta, config, opts = {}) {
    try {
        console.log('[generateTicketPDF] iniciando, config keys:', Object.keys(config || {}));
        const { html, anchoMM } = await buildTicketHTML(venta, config);
        console.log('[generateTicketPDF] HTML generado, largo:', html?.length);
        console.log('[generateTicketPDF] llamando printTicket...');

        if (!window.electronAPI?.printTicket) {
            console.warn('[generateTicketPDF] electronAPI.printTicket no disponible');
            return;
        }

        if (opts.silent === true) {
            const result = await window.electronAPI.printTicket({
                html,
                anchoMM,
                silent: true,
            });
            if (!result?.ok) {
                console.error('[generateTicketPDF] Error impresión:', result?.error);
            }
            return result;
        }

        const { base64 } = await buildTicketPDF(venta, config);
        const numDoc = (venta.numero_comprobante || venta.numero_venta || 'doc').replace(/\//g, '-');
        await window.electronAPI.openPDF({ base64, anchoMM, filename: `ticket_${numDoc}.pdf` });
        return { ok: true };

    } catch (err) {
        console.error('[generateTicketPDF] Error generando ticket:', err);
        alert('Error ticket: ' + err?.message); // ← temporal para ver el error
    }
}
