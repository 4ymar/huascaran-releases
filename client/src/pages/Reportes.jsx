import { useState } from 'react';
import { getReporteVentas, getReporteInventario, guardarArchivoLocal } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { BarChart3, Calendar, Package, FileText, TrendingUp, DollarSign, ShoppingCart, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '../components/Toast';

const COLORS = ['#7c3aed', '#0369a1', '#15803d', '#d97706', '#dc2626', '#0891b2', '#7c3aed', '#db2777', '#059669', '#ea580c'];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed', margin: 0 }}>{payload[0].value}</p>
            </div>
        );
    }
    return null;
};

export default function Reportes() {
    const toast = useToast();
    const [tab, setTab] = useState('ventas');
    const [fechaDesde, setFechaDesde] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; });
    const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0]);
    const [reporteVentas, setReporteVentas] = useState(null);
    const [reporteInventario, setReporteInventario] = useState(null);
    const [loading, setLoading] = useState(false);

    const periodoRapido = (dias) => {
        const hasta = new Date();
        const desde = new Date();
        desde.setDate(desde.getDate() - dias);
        setFechaDesde(desde.toISOString().split('T')[0]);
        setFechaHasta(hasta.toISOString().split('T')[0]);
    };

    const exportarPDF = async (titulo, filename, columns, rows) => {
        const doc = new jsPDF();
        doc.setFillColor(30, 30, 30);
        doc.rect(0, 0, 210, 32, 'F');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(titulo, 14, 15);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 180);
        doc.text(`Generado: ${new Date().toLocaleString('es-PE')}`, 14, 25);

        autoTable(doc, {
            startY: 40,
            head: [columns],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [115, 93, 255], fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8.5 },
            alternateRowStyles: { fillColor: [248, 247, 255] }
        });

        const suggestedName = `${filename}_${new Date().toISOString().slice(0, 10)}.pdf`;

        // Guardar en servidor (backup silencioso)
        try {
            const pdfBase64 = doc.output('datauristring');
            await guardarArchivoLocal({
                modulo: 'reportes',
                filename: suggestedName,
                content: pdfBase64,
                isBase64: true
            });
        } catch (e) {
            console.error('Error al guardar PDF en servidor:', e);
        }

        // Diálogo nativo Electron
        if (window.electronAPI?.savePDFDialog) {
            try {
                const pdfBase64 = doc.output('datauristring').split(',')[1];
                const result = await window.electronAPI.savePDFDialog({
                    buffer: pdfBase64,
                    suggestedName
                });
                if (result.canceled) return;
                if (!result.ok) {
                    toast('Error al guardar el PDF', 'error');
                }
            } catch (err) {
                console.error('Error al guardar PDF:', err);
                toast('Error al guardar el PDF', 'error');
            }
        }
    };

    const loadReporteVentas = async () => {
        setLoading(true);
        const data = await getReporteVentas({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta });
        setReporteVentas(data);
        setLoading(false);
    };

    const loadReporteInventario = async () => {
        setLoading(true);
        const data = await getReporteInventario();
        setReporteInventario(data);
        setLoading(false);
    };

    return (
        <div className="page-enter">

            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>Reportes</h1>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>Analisis y estadisticas del negocio</p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                    { key: 'ventas', label: 'Reporte de Ventas', icon: <BarChart3 size={15} /> },
                    { key: 'inventario', label: 'Reporte de Inventario', icon: <Package size={15} /> },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: '1px solid', borderColor: tab === t.key ? '#7c3aed' : '#e2e8f0', background: tab === t.key ? '#7c3aed' : 'white', color: tab === t.key ? 'white' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ── REPORTE VENTAS ── */}
            {tab === 'ventas' && (
                <div>
                    {/* Filtros */}
                    <div className="card mb-5">
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Periodo</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                            <div>
                                <label className="form-label">Desde</label>
                                <input className="form-input" type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                            </div>
                            <div>
                                <label className="form-label">Hasta</label>
                                <input className="form-input" type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {[
                                    { label: 'Hoy', dias: 0 },
                                    { label: '7 dias', dias: 7 },
                                    { label: '30 dias', dias: 30 },
                                    { label: '90 dias', dias: 90 },
                                ].map(p => (
                                    <button key={p.label} onClick={() => periodoRapido(p.dias)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <button className="btn btn-primary" onClick={loadReporteVentas} disabled={loading} style={{ padding: '9px 20px', fontWeight: 700 }}>
                                <Calendar size={15} /> {loading ? 'Cargando...' : 'Generar Reporte'}
                            </button>
                        </div>
                    </div>

                    {!reporteVentas && (
                        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                            <BarChart3 size={56} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                            <p style={{ fontSize: 15, fontWeight: 600 }}>Seleccione un periodo y genere el reporte</p>
                        </div>
                    )}

                    {reporteVentas && (
                        <>
                            {/* KPIs */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                                {[
                                    { label: 'Total Ventas', valor: reporteVentas.totalVentas, icon: <ShoppingCart size={18} />, color: '#7c3aed', bg: '#f5f3ff', border: '#e9d5ff', formato: 'numero' },
                                    { label: 'Total Facturado', valor: reporteVentas.totalFacturado, icon: <DollarSign size={18} />, color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', formato: 'moneda' },
                                    { label: 'Total IGV', valor: reporteVentas.totalIgv, icon: <FileText size={18} />, color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd', formato: 'moneda' },
                                    { label: 'Ticket Promedio', valor: reporteVentas.ticketPromedio, icon: <TrendingUp size={18} />, color: '#d97706', bg: '#fffbeb', border: '#fde68a', formato: 'moneda' },
                                ].map((k, i) => (
                                    <div key={i} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: k.color, borderRadius: '12px 0 0 12px' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>{k.label}</p>
                                            <div style={{ color: k.color }}>{k.icon}</div>
                                        </div>
                                        <p style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                                            {k.formato === 'moneda' ? formatCurrency(k.valor) : k.valor}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Graficos */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                                <div className="card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <div>
                                            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Top 10 Productos Mas Vendidos</h3>
                                            <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Por cantidad de unidades</p>
                                        </div>
                                        <button onClick={() => exportarPDF('Top 10 Productos Mas Vendidos', 'top_productos', ['SKU', 'Producto', 'Categoria', 'Cantidad', 'Total'], reporteVentas.topProductos.map(p => [p.sku, p.nombre, p.categoria, p.cantidad, formatCurrency(p.total)]))}
                                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: 6, cursor: 'pointer', color: '#7c3aed', fontSize: 12, fontWeight: 600 }}>
                                            <FileText size={13} /> PDF
                                        </button>
                                    </div>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={reporteVentas.topProductos} barSize={24}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis dataKey="nombre" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={70} />
                                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <defs>
                                                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#7c3aed" />
                                                    <stop offset="100%" stopColor="#a78bfa" />
                                                </linearGradient>
                                            </defs>
                                            <Bar dataKey="cantidad" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="card">
                                    <div style={{ marginBottom: 16 }}>
                                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Ventas por Forma de Pago</h3>
                                        <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Distribucion del periodo</p>
                                    </div>
                                    {Object.keys(reporteVentas.porFormaPago).length > 0 ? (
                                        <>
                                            <ResponsiveContainer width="100%" height={200}>
                                                <PieChart>
                                                    <Pie data={Object.entries(reporteVentas.porFormaPago).map(([k, v]) => ({ name: k, value: v.total }))} cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                                                        {Object.keys(reporteVentas.porFormaPago).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                    </Pie>
                                                    <Tooltip formatter={v => formatCurrency(v)} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                                                {Object.entries(reporteVentas.porFormaPago).map(([k, v], i) => (
                                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#f8fafc', borderRadius: 6 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                                                            <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>{k}</span>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{formatCurrency(v.total)}</span>
                                                            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>{v.cantidad} ventas</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : <div className="empty-state"><p>Sin datos de pago</p></div>}
                                </div>
                            </div>

                            {/* Tabla ventas */}
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Detalle de Ventas</h3>
                                        <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>{reporteVentas.ventas.length} registros en el periodo</p>
                                    </div>
                                    <button onClick={() => exportarPDF('Detalle de Ventas', 'ventas_reporte', ['N° Venta', 'Fecha', 'Comprobante', 'Forma Pago', 'Total', 'Estado'], reporteVentas.ventas.map(v => [v.numero_venta, new Date(v.fecha_hora).toLocaleDateString('es-PE'), v.tipo_comprobante, v.forma_pago, formatCurrency(v.total), v.estado]))}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: 8, cursor: 'pointer', color: '#7c3aed', fontSize: 13, fontWeight: 600 }}>
                                        <FileText size={14} /> Exportar PDF
                                    </button>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="data-table" style={{ margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>N° Venta</th>
                                                <th>Fecha</th>
                                                <th>Comprobante</th>
                                                <th>Forma de Pago</th>
                                                <th style={{ textAlign: 'right' }}>Total</th>
                                                <th style={{ textAlign: 'center' }}>Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reporteVentas.ventas.map(v => (
                                                <tr key={v.id_venta}>
                                                    <td><span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>{v.numero_venta}</span></td>
                                                    <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(v.fecha_hora).toLocaleDateString('es-PE')}</td>
                                                    <td><span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: v.tipo_comprobante === 'FACTURA' ? '#f0f9ff' : '#f8fafc', color: v.tipo_comprobante === 'FACTURA' ? '#0369a1' : '#475569', border: '1px solid #e2e8f0' }}>{v.tipo_comprobante}</span></td>
                                                    <td style={{ fontSize: 12, color: '#475569' }}>{v.forma_pago}</td>
                                                    <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{formatCurrency(v.total)}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: v.estado === 'ACTIVA' ? '#f0fdf4' : '#fef2f2', color: v.estado === 'ACTIVA' ? '#15803d' : '#dc2626', border: `1px solid ${v.estado === 'ACTIVA' ? '#bbf7d0' : '#fecaca'}` }}>
                                                            {v.estado}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {reporteVentas.ventas.length === 0 && (
                                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>No hay ventas en el periodo seleccionado</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── REPORTE INVENTARIO ── */}
            {tab === 'inventario' && (
                <div>
                    <div className="card mb-5" style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', margin: 0 }}>Reporte de Inventario Actual</p>
                                <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Genera un snapshot del estado actual del inventario</p>
                            </div>
                            <button className="btn btn-primary" onClick={loadReporteInventario} disabled={loading} style={{ fontWeight: 700 }}>
                                <Package size={15} /> {loading ? 'Cargando...' : 'Generar Reporte'}
                            </button>
                        </div>
                    </div>

                    {!reporteInventario && (
                        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                            <Package size={56} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                            <p style={{ fontSize: 15, fontWeight: 600 }}>Haga clic en Generar Reporte para ver el estado del inventario</p>
                        </div>
                    )}

                    {reporteInventario && (
                        <>
                            {/* KPIs */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                                {[
                                    { label: 'Total Productos', valor: reporteInventario.totalProductos, formato: 'numero', icon: <Package size={18} />, color: '#7c3aed', bg: '#f5f3ff', border: '#e9d5ff' },
                                    { label: 'Valor a Costo', valor: reporteInventario.valorTotalCompra, formato: 'moneda', icon: <DollarSign size={18} />, color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
                                    { label: 'Valor a Venta', valor: reporteInventario.valorTotalVenta, formato: 'moneda', icon: <TrendingUp size={18} />, color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
                                    { label: 'Stock Critico', valor: reporteInventario.stockCritico.length, formato: 'numero', icon: <AlertTriangle size={18} />, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                                ].map((k, i) => (
                                    <div key={i} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: k.color, borderRadius: '12px 0 0 12px' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>{k.label}</p>
                                            <div style={{ color: k.color }}>{k.icon}</div>
                                        </div>
                                        <p style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                                            {k.formato === 'moneda' ? formatCurrency(k.valor) : k.valor}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                                {/* Pie por categoria */}
                                <div className="card">
                                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Valor por Categoria</h3>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <PieChart>
                                            <Pie data={Object.entries(reporteInventario.porCategoria).map(([k, v]) => ({ name: k, value: Math.round(v.valor) }))} cx="50%" cy="50%" outerRadius={90} innerRadius={45}>
                                                {Object.keys(reporteInventario.porCategoria).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={v => formatCurrency(v)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                                        {Object.entries(reporteInventario.porCategoria).map(([k, v], i) => (
                                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: '#f8fafc', borderRadius: 6 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                                                    <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{k}</span>
                                                </div>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{formatCurrency(v.valor)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Sin stock */}
                                <div className="card">
                                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Productos Sin Stock</h3>
                                    {reporteInventario.stockCritico.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                                            {reporteInventario.stockCritico.map(p => (
                                                <div key={p.id_producto} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
                                                    <div>
                                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: 0 }}>{p.nombre}</p>
                                                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{p.sku} • {p.categoria}</p>
                                                    </div>
                                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#dc2626', color: 'white' }}>SIN STOCK</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-state">
                                            <span style={{ fontSize: 40 }}>🎉</span>
                                            <p style={{ color: '#15803d', fontWeight: 600, marginTop: 8 }}>No hay productos sin stock</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tabla inventario */}
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Inventario Completo</h3>
                                        <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>{reporteInventario.productos.length} productos</p>
                                    </div>
                                    <button onClick={() => exportarPDF('Inventario Completo', 'inventario_reporte', ['SKU', 'Producto', 'Categoria', 'Stock', 'P. Compra', 'Valor Stock'], reporteInventario.productos.map(p => [p.sku, p.nombre, p.categoria, p.stock_actual, formatCurrency(p.precio_compra), formatCurrency(p.stock_actual * p.precio_compra)]))}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: 8, cursor: 'pointer', color: '#7c3aed', fontSize: 13, fontWeight: 600 }}>
                                        <FileText size={14} /> Exportar PDF
                                    </button>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="data-table" style={{ margin: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>SKU</th>
                                                <th>Producto</th>
                                                <th>Categoria</th>
                                                <th style={{ textAlign: 'center' }}>Stock</th>
                                                <th style={{ textAlign: 'right' }}>P. Compra</th>
                                                <th style={{ textAlign: 'right' }}>Valor Stock</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reporteInventario.productos.map(p => (
                                                <tr key={p.id_producto} style={{ background: p.stock_actual === 0 ? '#fff5f5' : 'white' }}>
                                                    <td><span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '2px 5px', borderRadius: 4 }}>{p.sku}</span></td>
                                                    <td style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{p.nombre}</td>
                                                    <td><span style={{ fontSize: 11, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 5, padding: '2px 7px', color: '#475569' }}>{p.categoria}</span></td>
                                                    <td style={{ textAlign: 'center', fontSize: 15, fontWeight: 800, color: p.stock_actual === 0 ? '#dc2626' : '#1e293b' }}>{p.stock_actual}</td>
                                                    <td style={{ textAlign: 'right', fontSize: 13, color: '#64748b' }}>{formatCurrency(p.precio_compra)}</td>
                                                    <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{formatCurrency(p.stock_actual * p.precio_compra)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}