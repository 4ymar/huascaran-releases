import { useState, useEffect } from 'react';
import { getVentas, getVenta, anularVenta, getCreditos, guardarArchivoLocal, emitirCPE, getPublicConfig, corregirClienteCPE  } from '../services/api';
import { formatCurrency, formatDateTime, hoyLocalNegocio, fechaNegocio, condicionPago, medioPagoLabel } from '../utils/helpers';
import { useToast } from '../components/Toast';
import { FileText, Eye, Search, X, Ban, Printer } from 'lucide-react';
import { generateComprobantePDF } from '../utils/generateComprobantePDF';


// ── Helper: acortar nombre de cliente ─────────────────────
function nombreCorto(nombre, maxLen = 22) {
    if (!nombre) return 'Consumidor Final';
    if (nombre.length <= maxLen) return nombre;
    // Si tiene varias palabras, tomar las dos primeras
    const partes = nombre.trim().split(' ');
    if (partes.length >= 2) {
        const corto = `${partes[0]} ${partes[1]}`;
        return corto.length <= maxLen ? corto : partes[0];
    }
    return nombre.substring(0, maxLen) + '…';
}

export default function Comprobantes() {
    const toast = useToast();
    const [ventas, setVentas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [fechaFiltro, setFechaFiltro] = useState(() => {
        const hoy = new Date();
        return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    });
    const [showDetalle, setShowDetalle] = useState(null);
    const [showAnular, setShowAnular] = useState(null);
    const [motivoAnulacion, setMotivoAnulacion] = useState('');
    const [showExport, setShowExport]     = useState(false);
    const [exportDesde, setExportDesde] = useState(hoyLocalNegocio());
    const [exportHasta, setExportHasta] = useState(hoyLocalNegocio());
    const [sunatActivo, setSunatActivo] = useState(false);
    const [anulandoId, setAnulandoId] = useState(null);
    const [showCorregir, setShowCorregir]       = useState(null); // venta a corregir
    const [corrigiendo, setCorrigiendo]         = useState(false);
    const [formCorreccion, setFormCorreccion]   = useState({
        tipo_documento: 'RUC',
        numero_documento: '',
        nombre_razon_social: '',
    });
    const [sunatModo, setSunatModo] = useState('demo');

    const handleExportExcel = async () => {
        if (!exportDesde || !exportHasta) { toast('Selecciona el rango de fechas', 'warning'); return; }
        if (exportDesde > exportHasta) { toast('La fecha inicial no puede ser mayor a la final', 'warning'); return; }

        const data = ventas.filter(v => {
            const fecha = fechaNegocio(v.fecha_hora);
            return fecha >= exportDesde && fecha <= exportHasta && v.estado === 'ACTIVA';
        });

        if (!data.length) { toast('No hay ventas ACTIVAS en ese rango de fechas', 'warning'); return; }

        const tipoDoc  = { DNI: '1', RUC: '6', PASAPORTE: '7', CE: '4' };
        const tipoComp = { BOLETA: '03', FACTURA: '01' };

        const ExcelJS   = (await import('exceljs')).default;
        const desde     = exportDesde.replace(/-/g, '');
        const hasta     = exportHasta.replace(/-/g, '');
        const suggestedName = `RVI_Ventas_${desde}_${hasta}.xlsx`;

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Sistema HUASCARAN';
        wb.created = new Date();

        const headerFill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF735DFF' } };
        const headerFont  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
        const headerAlign = { vertical: 'middle', horizontal: 'center' };
        const bodyFont    = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
        const thinBorder  = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

        const estilizarHeader = (row) => {
            row.height = 22;
            row.eachCell(cell => {
                cell.fill = headerFill; cell.font = headerFont;
                cell.alignment = headerAlign;
                cell.border = { bottom: { style: 'medium', color: { argb: 'FF5A45D6' } } };
            });
        };

        const estilizarFila = (row, idx) => {
            row.height = 18;
            const esPar = idx % 2 === 0;
            row.eachCell({ includeEmpty: true }, cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: esPar ? 'FFFFFFFF' : 'FFF8F7FF' } };
                cell.font = bodyFont; cell.alignment = { vertical: 'middle' }; cell.border = thinBorder;
                if (typeof cell.value === 'number') {
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    if (!Number.isInteger(cell.value)) cell.numFmt = '#,##0.00';
                }
            });
        };

        const ws1 = wb.addWorksheet('Registro de Ventas', { views: [{ state: 'frozen', ySplit: 1 }] });
        const cols1 = [
            { header: 'Período',            key: 'periodo',   width: 10 },
            { header: 'Fecha Emisión',       key: 'fecha',     width: 14 },
            { header: 'Hora',               key: 'hora',      width: 10 },
            { header: 'Cód. Comprobante',   key: 'cod_comp',  width: 16 },
            { header: 'Tipo Comprobante',   key: 'tipo_comp', width: 16 },
            { header: 'Serie',              key: 'serie',     width: 10 },
            { header: 'Número',             key: 'numero',    width: 14 },
            { header: 'N° Venta (interno)', key: 'num_venta', width: 18 },
            { header: 'Cód. Doc. Cliente',  key: 'cod_doc',   width: 16 },
            { header: 'Tipo Doc. Cliente',  key: 'tipo_doc',  width: 16 },
            { header: 'N° Doc. Cliente',    key: 'num_doc',   width: 16 },
            { header: 'Cliente',            key: 'cliente',   width: 30 },
            { header: 'Condición Pago',     key: 'condicion', width: 14 },
            { header: 'Medio Pago',         key: 'medio',     width: 22 },
            { header: 'Op. Gravada (S/)',   key: 'gravada',   width: 16 },
            { header: 'IGV 18% (S/)',       key: 'igv',       width: 14 },
            { header: 'Descuento (S/)',     key: 'descuento', width: 14 },
            { header: 'Total (S/)',         key: 'total',     width: 14 },
            { header: 'Estado',             key: 'estado',    width: 12 },
            { header: 'Usuario',            key: 'usuario',   width: 14 },
        ];
        ws1.columns = cols1;
        estilizarHeader(ws1.getRow(1));

        data.forEach((r, idx) => {
            const row = ws1.addRow({
                periodo:   fechaNegocio(r.fecha_hora).replace(/-/g, '').slice(0, 6),
                fecha:     new Date(r.fecha_hora).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }),
                hora:      new Date(r.fecha_hora).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' }),
                cod_comp:  tipoComp[r.tipo_comprobante] || r.tipo_comprobante || '',
                tipo_comp: r.tipo_comprobante || '',
                serie:     (r.numero_comprobante || '').split('-')[0] || '',
                numero:    (r.numero_comprobante || '').split('-')[1] || '',
                num_venta: r.numero_venta || '',
                cod_doc:   tipoDoc[r.cliente?.tipo_documento] || '',
                tipo_doc:  r.cliente?.tipo_documento || '',
                num_doc:   r.cliente?.numero_documento || '',
                cliente:   r.cliente?.nombre_razon_social || 'CONSUMIDOR FINAL',
                condicion: condicionPago(r.forma_pago),
                medio:     medioPagoLabel(r.forma_pago, r.monto_efectivo, r.monto_yape_plin),
                gravada:   isNaN(Number(r.subtotal))  ? 0 : Number(r.subtotal),
                igv:       isNaN(Number(r.igv))       ? 0 : Number(r.igv),
                descuento: isNaN(Number(r.descuento)) ? 0 : Number(r.descuento || 0),
                total:     isNaN(Number(r.total))     ? 0 : Number(r.total),
                estado:    r.estado || '',
                usuario:   r.usuario || '',
            });
            estilizarFila(row, idx);
        });

        const ws2 = wb.addWorksheet('Detalle de Productos', { views: [{ state: 'frozen', ySplit: 1 }] });
        const cols2 = [
            { header: 'Fecha',             key: 'fecha',       width: 14 },
            { header: 'Comprobante',       key: 'comprobante', width: 18 },
            { header: 'N° Venta',          key: 'num_venta',   width: 18 },
            { header: 'Cliente',           key: 'cliente',     width: 30 },
            { header: 'Producto',          key: 'producto',    width: 40 },
            { header: 'Cantidad',          key: 'cantidad',    width: 10 },
            { header: 'Precio Unit. (S/)', key: 'precio',      width: 16 },
            { header: 'Descuento (S/)',    key: 'descuento',   width: 14 },
            { header: 'Subtotal (S/)',     key: 'subtotal',    width: 14 },
        ];
        ws2.columns = cols2;
        estilizarHeader(ws2.getRow(1));

        let filaIdx = 0;
        data.forEach(r => {
            const detalles = r.detalles || [];
            if (detalles.length === 0) {
                const row = ws2.addRow({
                    fecha: new Date(r.fecha_hora).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }),
                    comprobante: r.numero_comprobante || '', num_venta: r.numero_venta || '',
                    cliente: r.cliente?.nombre_razon_social || 'CONSUMIDOR FINAL',
                    producto: '(sin detalle)', cantidad: '', precio: '', descuento: '', subtotal: '',
                });
                estilizarFila(row, filaIdx++);
            } else {
                detalles.forEach(d => {
                    const row = ws2.addRow({
                        fecha: new Date(r.fecha_hora).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }),
                        comprobante: r.numero_comprobante || '', num_venta: r.numero_venta || '',
                        cliente: r.cliente?.nombre_razon_social || 'CONSUMIDOR FINAL',
                        producto: d.nombre_producto || '',
                        cantidad: Number(d.cantidad) || 0,
                        precio:   isNaN(Number(d.precio_unitario)) ? 0 : Number(d.precio_unitario),
                        descuento: isNaN(Number(d.descuento_linea)) ? 0 : Number(d.descuento_linea || 0),
                        subtotal: isNaN(Number(d.subtotal_linea)) ? 0 : Number(d.subtotal_linea),
                    });
                    estilizarFila(row, filaIdx++);
                });
            }
        });

        try {
            const headers = cols1.map(c => c.header);
            const csvRows = data.map(r => cols1.map(c => `"${String(ws1.getRow(data.indexOf(r) + 2).getCell(c.key)?.value ?? '').replace(/"/g, '""')}"`).join(','));
            const csv = [headers.join(','), ...csvRows].join('\n');
            await guardarArchivoLocal({ modulo: 'registro_ventas', filename: `RVI_${desde}_${hasta}.csv`, content: csv, isBase64: false });
        } catch (e) { console.error(e); }

        if (window.electronAPI?.saveExcel) {
            try {
                const buffer = await wb.xlsx.writeBuffer();
                const base64 = btoa(new Uint8Array(buffer).reduce((acc, byte) => acc + String.fromCharCode(byte), ''));
                const result = await window.electronAPI.saveExcel({ buffer: base64, suggestedName });
                if (result.canceled) return;
                if (!result.ok) toast('Error al guardar el archivo', 'error');
                else toast('Excel exportado correctamente', 'success');
            } catch (err) {
                console.error(err);
                toast('Error al exportar Excel', 'error');
            }
        }
        setShowExport(false);
    };

    useEffect(() => {
        getVentas().then(setVentas).finally(() => setLoading(false));
        getPublicConfig().then(cfg => {
        setSunatActivo(cfg?.sunat_activo === '1');
        setSunatModo(cfg?.sunat_modo || 'demo');
        });
    }, []);

    const filtered = ventas.filter(v => {
        const ventaFecha = v.fecha_hora ? new Date(new Date(v.fecha_hora).getTime() + (-300 * 60 * 1000)).toISOString().slice(0, 10) : '';
        const matchFecha  = !fechaFiltro || ventaFecha === fechaFiltro;
        const matchSearch = !search ||
            v.numero_venta.toLowerCase().includes(search.toLowerCase()) ||
            (v.numero_comprobante || '').toLowerCase().includes(search.toLowerCase()) ||
            (v.cliente_nombre || '').toLowerCase().includes(search.toLowerCase());
        return matchFecha && matchSearch;
    });

    const viewDetalle = async (v) => {
        const data = await getVenta(v.id_venta);
        setShowDetalle(data);
    };

    const handleAnular = async () => {
        setAnulandoId(showAnular.id_venta);
        try {
            const result = await anularVenta(showAnular.id_venta, motivoAnulacion);
            if (result?.baja_cpe?.motivo === 'fuera_de_plazo') {
                toast('Venta anulada. El CPE fue emitido en otro día — requiere Nota de Crédito manual en NubeFact.', 'warning');
            } else if (result?.baja_cpe?.ok) {
                toast('Venta anulada y comunicación de baja enviada a SUNAT correctamente', 'success');
            } else {
                toast('Venta anulada correctamente', 'success');
            }
            setShowAnular(null);
            setMotivoAnulacion('');
            getVentas().then(setVentas);
        } catch (err) {
            toast(err.response?.data?.error || 'Error', 'error');
        } finally {
            setAnulandoId(null);
        }
    };

    // ── Columnas totales para colSpan del mensaje vacío ───────
    const colSpanTotal = 6 + (sunatActivo ? 1 : 0);

    return (
        <div className="page-enter">
            <div className="page-header">
                <div>
                    <h1>🧾 Comprobantes</h1>
                    <p>Historial de ventas y emisión de comprobantes</p>
                    {sunatActivo && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            borderRadius: 20,
                            padding: '3px 10px',
                            marginTop: 4,
                            ...(sunatModo === 'produccion'
                                ? { color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d' }
                                : { color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe' })
                        }}>
                            <span style={{
                                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                background: sunatModo === 'produccion' ? '#f59e0b' : '#3b82f6'
                            }} />
                            {sunatModo === 'produccion' ? 'PRODUCCIÓN — comprobantes reales ante SUNAT' : 'DEMO — comprobantes de prueba'}
                        </span>
                    )}
                </div>
                <button className="btn btn-secondary" onClick={() => setShowExport(true)}>
                    📊 Exportar Excel
                </button>
            </div>

            {/* ── Filtros ──────────────────────────────────────────── */}
            <div className="card mb-6">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="search-bar flex-1 min-w-48">
                        <Search size={16} className="search-icon" />
                        <input
                            className="form-input"
                            placeholder="Buscar por N° venta, comprobante o cliente..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-500 whitespace-nowrap">📅 Fecha:</label>
                        <input
                            type="date"
                            className="form-input"
                            value={fechaFiltro}
                            onChange={e => setFechaFiltro(e.target.value)}
                            style={{ width: 'auto' }}
                        />
                        {(() => {
                            const h = new Date();
                            const hoyLocal = `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-${String(h.getDate()).padStart(2,'0')}`;
                            return fechaFiltro !== hoyLocal;
                        })() && (
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => { const h = new Date(); setFechaFiltro(`${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-${String(h.getDate()).padStart(2,'0')}`); }}
                                title="Volver a hoy"
                            >
                                Hoy
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Tabla compacta ───────────────────────────────────── */}
            <div className="card overflow-auto">
                {loading ? <div className="loader"><div className="spinner"></div></div> : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Comprobante</th>
                                <th>Fecha</th>
                                <th>Cliente</th>
                                <th>Total</th>
                                <th>Estado</th>
                                {sunatActivo && <th>CPE</th>}
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(v => (
                                <tr key={v.id_venta} className={v.estado === 'ANULADA' ? 'opacity-50' : ''}>

                                    {/* Comprobante — tipo + número fusionados */}
                                    <td>
                                        <span className={`badge ${v.tipo_comprobante === 'FACTURA' ? 'badge-info' : 'badge-neutral'}`} style={{ fontSize: 10, marginRight: 4 }}>
                                            {v.tipo_comprobante === 'FACTURA' ? 'F' : 'B'}
                                        </span>
                                        <span className="font-mono text-xs font-semibold text-purple-600">
                                            {v.numero_comprobante || v.numero_venta}
                                        </span>
                                    </td>

                                    {/* Fecha */}
                                    <td className="text-sm whitespace-nowrap">{formatDateTime(v.fecha_hora)}</td>

                                    {/* Cliente — nombre corto con tooltip */}
                                    <td
                                        className="text-sm"
                                        title={v.cliente_nombre || 'Consumidor Final'}
                                        style={{ maxWidth: 160 }}
                                    >
                                        {nombreCorto(v.cliente_nombre)}
                                    </td>

                                    {/* Total */}
                                    <td className="font-bold text-right">{formatCurrency(v.total)}</td>

                                    {/* Estado */}
                                    <td>
                                        <span className={`badge ${v.estado === 'ACTIVA' ? 'badge-success' : 'badge-danger'}`}>
                                            {v.estado}
                                        </span>
                                    </td>

                                    {/* CPE — solo si SUNAT activo */}
                                    {sunatActivo && (
                                        <td>
                                            {v.cpe_estado === 'ACEPTADO' ? (
                                                <div className="flex items-center gap-1">
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 20, padding: '2px 8px' }}>✓ CPE</span>
                                                    {v.cpe_enlace_pdf && (
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            style={{ fontSize: 10, padding: '2px 6px' }}
                                                            title="Ver PDF oficial NubeFact"
                                                            onClick={() => window.electronAPI.openExternal(v.cpe_enlace_pdf)}
                                                        >
                                                            🔗
                                                        </button>
                                                    )}
                                                </div>
                                            ) : v.cpe_estado === 'ANULADO' ? (
                                                <span style={{ fontSize: 10, fontWeight: 600, color: '#7f1d1d', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 20, padding: '2px 8px' }}>
                                                    ✕ Anulado
                                                </span>
                                            ) : v.cpe_estado === 'BAJA_PENDIENTE' ? (
                                                <span style={{ fontSize: 10, fontWeight: 600, color: '#78350f', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 20, padding: '2px 8px' }}>
                                                    ⚠ Baja pendiente
                                                </span>
                                            ) : v.cpe_estado === 'PENDIENTE' ? (
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ fontSize: 11, padding: '2px 8px', color: '#92400e', borderColor: '#fcd34d' }}
                                                    title="Timeout anterior — reintentar emisión"
                                                    onClick={async () => {
                                                        try {
                                                            await emitirCPE(v.id_venta);
                                                            toast('Comprobante emitido correctamente', 'success');
                                                            getVentas().then(setVentas);
                                                        } catch (err) {
                                                            toast(err.response?.data?.error || 'Error al emitir CPE', 'error');
                                                        }
                                                    }}
                                                >
                                                    ⏳ Reintentar
                                                </button>
                                            ) : v.cpe_estado === 'RECHAZADO' ? (
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ fontSize: 11, padding: '2px 8px', color: '#7f1d1d', borderColor: '#fca5a5', background: '#fee2e2' }}
                                                    title="Corregir datos del cliente y reemitir"
                                                    onClick={async () => {
                                                        const data = await getVenta(v.id_venta);
                                                        setFormCorreccion({
                                                            tipo_documento:      data.cliente?.tipo_documento      || 'RUC',
                                                            numero_documento:    data.cliente?.numero_documento    || '',
                                                            nombre_razon_social: data.cliente?.nombre_razon_social || '',
                                                        });
                                                        setShowCorregir(v);
                                                    }}
                                                >
                                                    ✎ Corregir
                                                </button>
                                            ) : v.estado === 'ACTIVA' ? (
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ fontSize: 11, padding: '2px 8px' }}
                                                    onClick={async () => {
                                                        try {
                                                            await emitirCPE(v.id_venta);
                                                            toast('Comprobante electrónico emitido correctamente', 'success');
                                                            getVentas().then(setVentas);
                                                        } catch (err) {
                                                            toast(err.response?.data?.error || 'Error al emitir CPE', 'error');
                                                        }
                                                    }}
                                                >
                                                    Emitir CPE
                                                </button>
                                            ) : (
                                                <span style={{ fontSize: 10, color: '#94a3b8' }}>—</span>
                                            )}
                                        </td>
                                    )}

                                    {/* Acciones */}
                                    <td>
                                        <div className="flex gap-1">
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => viewDetalle(v)}
                                                title="Ver detalle"
                                            >
                                                <Eye size={14} />
                                            </button>
                                            {v.estado === 'ACTIVA' && (
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => setShowAnular(v)}
                                                    title="Anular"
                                                >
                                                    <Ban size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={colSpanTotal} className="text-center py-8 text-slate-400">
                                        No hay comprobantes {fechaFiltro ? `para el ${new Date(fechaFiltro + 'T00:00:00').toLocaleDateString('es-PE')}` : ''}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Modal Detalle ────────────────────────────────────── */}
            {showDetalle && (
                <div className="modal-overlay" onClick={() => setShowDetalle(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
                        <div className="modal-header">
                            <div>
                                <h2>📋 {showDetalle.numero_venta}</h2>
                                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{showDetalle.numero_comprobante}</p>
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowDetalle(null)}><X size={18} /></button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <span className="text-xs text-slate-400">Tipo</span>
                                <p className="font-medium">{showDetalle.tipo_comprobante}</p>
                            </div>
                            <div>
                                <span className="text-xs text-slate-400">Fecha</span>
                                <p className="font-medium">{formatDateTime(showDetalle.fecha_hora)}</p>
                            </div>
                            <div>
                                <span className="text-xs text-slate-400">Cliente</span>
                                <p className="font-medium">{showDetalle.cliente?.nombre_razon_social || 'Consumidor Final'}</p>
                            </div>
                            <div>
                                <span className="text-xs text-slate-400">Condición de Pago</span>
                                <p className="font-medium">{condicionPago(showDetalle.forma_pago)}</p>
                            </div>
                            <div>
                                <span className="text-xs text-slate-400">Medio de Pago</span>
                                <p className="font-medium">{medioPagoLabel(showDetalle.forma_pago, showDetalle.monto_efectivo, showDetalle.monto_yape_plin)}</p>
                            </div>
                            <div>
                                <span className="text-xs text-slate-400">Estado</span>
                                <p className="font-medium">
                                    <span className={`badge ${showDetalle.estado === 'ACTIVA' ? 'badge-success' : 'badge-danger'}`}>
                                        {showDetalle.estado}
                                    </span>
                                </p>
                            </div>
                        </div>

                        <table className="data-table mb-4">
                            <thead>
                                <tr><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th></tr>
                            </thead>
                            <tbody>
                                {showDetalle.detalles?.map(d => (
                                    <tr key={d.id_detalle}>
                                        <td className="text-sm">{d.nombre_producto}</td>
                                        <td>{d.cantidad}</td>
                                        <td>{formatCurrency(d.precio_unitario)}</td>
                                        <td className="font-bold">{formatCurrency(d.subtotal_linea)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="p-4 rounded-xl bg-purple-50 space-y-1">
                            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCurrency(showDetalle.subtotal)}</span></div>
                            <div className="flex justify-between text-sm"><span>IGV (18%)</span><span>{formatCurrency(showDetalle.igv)}</span></div>
                            <div className="flex justify-between text-lg font-bold pt-2 border-t border-purple-200"><span>TOTAL</span><span>{formatCurrency(showDetalle.total)}</span></div>
                        </div>

                        {/* Banner CPE */}
                        {showDetalle.cpe_estado === 'ACEPTADO' && showDetalle.cpe_enlace_pdf && (
                            <div className="mt-3 p-3 rounded-lg flex items-center justify-between gap-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#065f46' }}>✓ Comprobante electrónico emitido</span>
                                <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: 12, color: '#065f46', borderColor: '#6ee7b7' }}
                                    onClick={() => window.electronAPI.openExternal(showDetalle.cpe_enlace_pdf)}
                                >
                                    Ver PDF oficial SUNAT
                                </button>
                            </div>
                        )}

                        {showDetalle.cpe_estado === 'BAJA_PENDIENTE' && (
                            <div className="mt-3 p-3 rounded-lg" style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: '#78350f', margin: 0 }}>
                                    ⚠ Baja pendiente — Este CPE fue emitido en un día anterior. Emite una Nota de Crédito en NubeFact para anularlo formalmente ante SUNAT.
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-4">
                            <button className="btn btn-secondary" onClick={async () => {
                                try {
                                    const { generateTicketPDF } = await import('../utils/generateTicketPDF');
                                    await generateTicketPDF(showDetalle);
                                } catch (err) {
                                    toast(err?.message || 'Error al generar el ticket', 'error');
                                }
                            }}>
                                <Printer size={16} /> Ticket térmico
                            </button>
                            <button className="btn btn-primary" 
                            onClick={async () => {
                                try {
                                    const dataConCredito = { ...showDetalle };
                                    if (dataConCredito.forma_pago === 'CREDITO' && dataConCredito.id_cliente) {
                                        try {
                                            const creditos = await getCreditos({ id_cliente: dataConCredito.id_cliente });
                                            const cr = creditos.find(c => c.id_venta === dataConCredito.id_venta);
                                            if (cr) dataConCredito.credito = {
                                                fecha_vencimiento:   cr.fecha_vencimiento,
                                                monto_adelanto:      cr.monto_pagado > 0 ? cr.monto_pagado : 0,
                                                saldo_pendiente:     cr.saldo,
                                                medio_pago_adelanto: cr.desglose_abonos?.total_efectivo > 0 ? 'EFECTIVO' : cr.desglose_abonos?.total_yape_plin > 0 ? 'YAPE_PLIN' : 'EFECTIVO',
                                            };
                                        } catch (_) {}
                                    }
                                    await generateComprobantePDF(dataConCredito);
                                } catch (err) {
                                    toast(err?.message || 'Error al generar el PDF', 'error');
                                }
                            }}>
                                <Printer size={16} /> Descargar PDF A4
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Anular ─────────────────────────────────────── */}
            {showAnular && (
                <div className="modal-overlay" onClick={() => setShowAnular(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>⚠️ Anular Venta</h2>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowAnular(null)}><X size={18} /></button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">
                            ¿Estás seguro de anular la venta <strong>{showAnular.numero_venta}</strong> por <strong>{formatCurrency(showAnular.total)}</strong>?
                            Esta acción revertirá el stock de los productos.
                        </p>
                        {showAnular.cpe_estado === 'ACEPTADO' && (
                            <div className="mb-4 p-3 rounded-lg" style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: '#78350f', margin: 0 }}>
                                    ⚠ Esta venta tiene CPE emitido. Si es del día de hoy se enviará la baja a SUNAT automáticamente.
                                    Si es de otro día, deberás emitir una Nota de Crédito en NubeFact.
                                </p>
                            </div>
                        )}
                        <div className="mb-4">
                            <label className="form-label">Motivo de Anulación (obligatorio)</label>
                            <input
                                className="form-input"
                                required
                                value={motivoAnulacion}
                                onChange={e => setMotivoAnulacion(e.target.value)}
                                placeholder="Ingrese el motivo..."
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button className="btn btn-secondary" onClick={() => setShowAnular(null)} disabled={!!anulandoId}>
                                Cancelar
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleAnular}
                                disabled={!motivoAnulacion || !!anulandoId}
                            >
                                {anulandoId ? 'Anulando...' : 'Confirmar Anulación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Exportar ───────────────────────────────────── */}
            {showExport && (
                <div className="modal-overlay" onClick={() => setShowExport(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h2>📊 Exportar Registro de Ventas</h2>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(false)}><X size={18} /></button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">
                            Exporta las ventas <strong>ACTIVAS</strong> del rango seleccionado en formato Excel para registro en SUNAT.
                        </p>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="form-label">Desde</label>
                                <input type="date" className="form-input" value={exportDesde} onChange={e => setExportDesde(e.target.value)} />
                            </div>
                            <div>
                                <label className="form-label">Hasta</label>
                                <input type="date" className="form-input" value={exportHasta} onChange={e => setExportHasta(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button className="btn btn-secondary" onClick={() => setShowExport(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleExportExcel}>📥 Descargar Excel</button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Modal Corregir Cliente CPE Rechazado ─────────────── */}
            {showCorregir && (
                <div className="modal-overlay" onClick={() => !corrigiendo && setShowCorregir(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className="modal-header">
                            <h2>✎ Corregir datos del cliente</h2>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowCorregir(null)} disabled={corrigiendo}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="mb-3 p-3 rounded-lg" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
                            <p style={{ fontSize: 12, color: '#78350f', margin: 0 }}>
                                El CPE <strong>{showCorregir.numero_comprobante}</strong> fue rechazado por NubeFact.
                                Corrige el documento del cliente y se reemitirá con el mismo número de comprobante.
                            </p>
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Tipo de documento</label>
                            <select
                                className="form-input"
                                value={formCorreccion.tipo_documento}
                                onChange={e => setFormCorreccion(p => ({ ...p, tipo_documento: e.target.value }))}
                                disabled={corrigiendo}
                            >
                                <option value="RUC">RUC</option>
                                <option value="DNI">DNI</option>
                                <option value="CE">CE</option>
                                <option value="PASAPORTE">Pasaporte</option>
                            </select>
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Número de documento</label>
                            <input
                                className="form-input"
                                value={formCorreccion.numero_documento}
                                onChange={e => setFormCorreccion(p => ({ ...p, numero_documento: e.target.value }))}
                                placeholder="Ej: 20123456789"
                                disabled={corrigiendo}
                                autoFocus
                            />
                        </div>

                        <div className="mb-4">
                            <label className="form-label">Nombre / Razón social</label>
                            <input
                                className="form-input"
                                value={formCorreccion.nombre_razon_social}
                                onChange={e => setFormCorreccion(p => ({ ...p, nombre_razon_social: e.target.value }))}
                                placeholder="Ej: EMPRESA SAC"
                                disabled={corrigiendo}
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <button className="btn btn-secondary" onClick={() => setShowCorregir(null)} disabled={corrigiendo}>
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                disabled={corrigiendo || !formCorreccion.numero_documento || !formCorreccion.nombre_razon_social}
                                onClick={async () => {
                                    setCorrigiendo(true);
                                    try {
                                        await corregirClienteCPE(showCorregir.id_venta, formCorreccion);
                                        await emitirCPE(showCorregir.id_venta);
                                        toast('CPE corregido y emitido correctamente', 'success');
                                        setShowCorregir(null);
                                        getVentas().then(setVentas);
                                    } catch (err) {
                                        console.log('ERROR COMPLETO:', JSON.stringify(err.response?.data, null, 2));
                                        const data          = err.response?.data;
                                        const nubefactError = data?.nubefact?.errors;
                                        const mensajeError  = typeof nubefactError === 'string'
                                            ? `NubeFact: ${nubefactError}`
                                            : typeof nubefactError === 'object'
                                            ? `NubeFact: ${JSON.stringify(nubefactError)}`
                                            : data?.error || 'Error al corregir o emitir';
                                        toast(mensajeError, 'error');
                                    } finally {
                                        setCorrigiendo(false);
                                    }
                                }}
                            >
                                {corrigiendo ? 'Emitiendo...' : 'Corregir y emitir'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
