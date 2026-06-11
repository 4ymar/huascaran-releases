import { useState, useEffect, useCallback } from 'react';
import { getCreditos, getCredito, getResumenCreditos, createAbono, updateCredito, deleteAbono, getPublicConfig } from '../services/api';
import { formatCurrency, formatDateTime, medioPagoLabel } from '../utils/helpers';
import { useToast } from '../components/Toast';
import jsPDF from 'jspdf';
import { Search, X, Plus, Trash2, Calendar, AlertTriangle, CheckCircle, Clock, Banknote, Smartphone, DollarSign, Printer } from 'lucide-react';

// ── Helpers de estado ──────────────────────────────────────
const ESTADO_CONFIG = {
    PENDIENTE:      { label: 'Pendiente',  color: '#f59e0b', bg: '#fef3c7', icon: '🕐' },
    PAGADO_PARCIAL: { label: 'Parcial',    color: '#3b82f6', bg: '#dbeafe', icon: '📊' },
    PAGADO_TOTAL:   { label: 'Pagado',     color: '#16a34a', bg: '#dcfce7', icon: '✅' },
    VENCIDO:        { label: 'Vencido',    color: '#dc2626', bg: '#fee2e2', icon: '🔴' },
    ANULADO:        { label: 'Anulado',    color: '#6b7280', bg: '#f3f4f6', icon: '❌' },
};

// ── Solo efectivo y yape/plin (sin tarjeta) ────────────────
const MEDIO_PAGO_OPTS = [
    { val: 'EFECTIVO',      label: '💵 Efectivo',      icon: Banknote,   color: '#10B981' },
    { val: 'YAPE_PLIN',     label: '📱 Yape / Plin',   icon: Smartphone, color: '#C516E1' },
    { val: 'TRANSFERENCIA', label: '🏦 Transferencia',  icon: DollarSign, color: '#F59E0B' },
];

function BadgeEstado({ estado }) {
    const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.PENDIENTE;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: cfg.color, background: cfg.bg }}>
            {cfg.icon} {cfg.label}
        </span>
    );
}

const diasRestantes = (fecha) => {
    if (!fecha) return null;
    const OFFSET = -300; // UTC-5 Perú
    const ahora  = new Date();
    const localMs = ahora.getTime() + (OFFSET * 60 * 1000);
    const hoy    = new Date(localMs);
    const venc   = new Date(fecha + 'T00:00:00');
    return Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));
};

// ── Barra de progreso del crédito ─────────────────────────
function BarraPago({ monto_total, monto_pagado }) {
    const pct = monto_total > 0 ? Math.min(100, (monto_pagado / monto_total) * 100) : 0;
    const color = pct >= 100 ? '#16a34a' : pct >= 50 ? '#3b82f6' : '#f59e0b';
    return (
        <div style={{ marginTop: 6 }}>
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>Abonado {pct.toFixed(0)}%</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{formatCurrency(monto_pagado)} / {formatCurrency(monto_total)}</span>
            </div>
        </div>
    );
}

export default function Creditos() {
    const toast = useToast();

    const [creditos, setCreditos] = useState([]);
    const [resumen, setResumen]   = useState({ totalDeuda: 0, totalVencido: 0, totalPendiente: 0, countVencido: 0 });
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [orden, setOrden]       = useState('urgencia');

    const [showDetalle, setShowDetalle]       = useState(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [showAbono, setShowAbono]           = useState(false);
    const [montoAbono, setMontoAbono]         = useState('');
    const [medioPago, setMedioPago]           = useState('EFECTIVO');
    const [notasAbono, setNotasAbono]         = useState('');
    const [processingAbono, setProcessingAbono] = useState(false);

    const [showEditVenc, setShowEditVenc]     = useState(false);
    const [nuevaFechaVenc, setNuevaFechaVenc] = useState('');

    const cargarDatos = useCallback(async () => {
        setLoading(true);
        try {
            const [lista, res] = await Promise.all([getCreditos(), getResumenCreditos()]);
            setCreditos(lista);
            setResumen(res);
        } catch {
            toast('Error al cargar créditos', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargarDatos(); }, [cargarDatos]);

    const abrirDetalle = async (c) => {
        setLoadingDetalle(true);
        setShowDetalle(c);
        setShowAbono(false);
        setMontoAbono('');
        setNotasAbono('');
        try {
            const full = await getCredito(c.id_credito);
            setShowDetalle(full);
        } catch {
            toast('Error al cargar detalle', 'error');
        } finally {
            setLoadingDetalle(false);
        }
    };

    const handleAbono = async () => {
        if (!montoAbono || Number(montoAbono) <= 0) { toast('Ingresa un monto válido', 'warning'); return; }
        if (Number(montoAbono) > showDetalle.saldo + 0.01) {
            toast(`El abono no puede superar el saldo pendiente (S/ ${Number(showDetalle.saldo).toFixed(2)})`, 'warning');
            return;
        }
        setProcessingAbono(true);
        try {
            await createAbono(showDetalle.id_credito, { monto_abonado: Number(montoAbono), medio_pago: medioPago, notas: notasAbono });
            toast(`Abono de ${formatCurrency(Number(montoAbono))} registrado`, 'success');
            const saldoAnterior = showDetalle.saldo;
            setShowAbono(false); setMontoAbono(''); setNotasAbono('');
            await generarConstanciaAbono(Number(montoAbono), medioPago, saldoAnterior);
            const full = await getCredito(showDetalle.id_credito);
            setShowDetalle(full);
            cargarDatos();
        } catch (err) {
            toast(err.response?.data?.error || 'Error al registrar abono', 'error');
        } finally {
            setProcessingAbono(false);
        }
    };

    const handleEliminarAbono = async (id_abono) => {
        if (!window.confirm('¿Eliminar este abono? El saldo se recalculará.')) return;
        try {
            await deleteAbono(showDetalle.id_credito, id_abono);
            toast('Abono eliminado');
            const full = await getCredito(showDetalle.id_credito);
            setShowDetalle(full);
            cargarDatos();
        } catch (err) {
            toast(err.response?.data?.error || 'Error', 'error');
        }
    };

    const handleGuardarVencimiento = async () => {
        try {
            await updateCredito(showDetalle.id_credito, { fecha_vencimiento: nuevaFechaVenc || null });
            toast('Fecha de vencimiento actualizada');
            setShowEditVenc(false);
            const full = await getCredito(showDetalle.id_credito);
            setShowDetalle(full);
            cargarDatos();
        } catch {
            toast('Error al actualizar', 'error');
        }
    };
        const generarConstanciaAbono = async (montoAbonado, medioP, saldoAnterior) => {
            try {
                const config     = await getPublicConfig();
                const doc        = new jsPDF({ format: [148, 105], orientation: 'landscape' }); // A6 apaisado
                const empresa    = config.empresa_nombre || 'MI EMPRESA';
                const ruc        = config.empresa_ruc || '';
                const ahora      = new Date();
                const fechaStr   = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const horaStr    = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                const AZUL       = [26, 60, 94];
                const GRIS       = [100, 100, 100];
                const saldoNuevo = Math.max(0, saldoAnterior - montoAbonado);

                // Header
                doc.setFillColor(26, 60, 94); doc.rect(0, 0, 148, 18, 'F');
                doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
                doc.text('CONSTANCIA DE ABONO', 74, 8, { align: 'center' });
                doc.setFontSize(8); doc.setFont('helvetica', 'normal');
                doc.text(`${empresa.toUpperCase()}  |  RUC: ${ruc}`, 74, 14, { align: 'center' });

                // Cuerpo
                let y = 26;
                const fila = (label, valor, negrita = false) => {
                    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRIS);
                    doc.text(label, 10, y);
                    doc.setTextColor(30, 30, 30);
                    if (negrita) doc.setFont('helvetica', 'bold');
                    doc.text(String(valor), 60, y);
                    doc.setFont('helvetica', 'normal');
                    y += 7;
                };

                fila('Comprobante origen:', showDetalle.venta?.numero_comprobante || showDetalle.venta?.numero_venta || 'S/N');
                fila('N° Venta:',           showDetalle.venta?.numero_venta || 'S/N');
                fila('Cliente:',            `${showDetalle.cliente?.nombre_razon_social || 'Sin nombre'} — ${showDetalle.cliente?.tipo_documento || ''}: ${showDetalle.cliente?.numero_documento || ''}`);
                fila('Fecha de abono:',     `${fechaStr}  ${horaStr}`);
                fila('Medio de pago:',      medioPagoLabel(medioP));
                y += 2;
                doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2); doc.line(10, y, 138, y); y += 5;
                fila('Monto abonado:',      `S/ ${Number(montoAbonado).toFixed(2)}`, true);
                fila('Saldo anterior:',     `S/ ${Number(saldoAnterior).toFixed(2)}`);

                doc.setTextColor(saldoNuevo > 0 ? 180 : 22, saldoNuevo > 0 ? 30 : 163, saldoNuevo > 0 ? 30 : 74);
                doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
                doc.text('Saldo pendiente:', 10, y);
                doc.text(`S/ ${saldoNuevo.toFixed(2)}`, 60, y);
                y += 10;

                // Pie
                doc.setFillColor(240, 240, 240); doc.rect(0, y, 148, 10, 'F');
                doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRIS);
                doc.text('Gracias por su pago — Este documento es una constancia interna.', 74, y + 6, { align: 'center' });

                const base64 = doc.output('datauristring').split(',')[1];
                if (window.electronAPI) await window.electronAPI.openPDF(base64);
                else window.open(doc.output('bloburl'), '_blank');
            } catch (e) {
                console.error('Error generando constancia:', e);
            }
        };
    

    const ORDEN_PRIORIDAD = { VENCIDO: 0, PAGADO_PARCIAL: 1, PENDIENTE: 2, PAGADO_TOTAL: 3, ANULADO: 4 };

    const filtrados = creditos.filter(c => {
        const matchEstado = filtroEstado ? c.estado === filtroEstado : true;
        const q = search.toLowerCase();
        const matchSearch = !q ||
            c.cliente?.nombre_razon_social?.toLowerCase().includes(q) ||
            c.numero_venta?.toLowerCase().includes(q) ||
            c.numero_comprobante?.toLowerCase().includes(q) ||
            c.cliente?.numero_documento?.includes(q);
        return matchEstado && matchSearch;
    }).sort((a, b) => {
        if (orden === 'urgencia') {
            const pa = ORDEN_PRIORIDAD[a.estado] ?? 9, pb = ORDEN_PRIORIDAD[b.estado] ?? 9;
            if (pa !== pb) return pa - pb;
            if (a.estado === 'VENCIDO' && b.estado === 'VENCIDO') return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento);
            if (a.fecha_vencimiento && b.fecha_vencimiento) return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento);
            return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
        }
        if (orden === 'saldo_desc') return b.saldo - a.saldo;
        if (orden === 'saldo_asc')  return a.saldo - b.saldo;
        if (orden === 'fecha_desc') return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
        if (orden === 'fecha_asc')  return new Date(a.fecha_creacion) - new Date(b.fecha_creacion);
        if (orden === 'cliente')    return (a.cliente?.nombre_razon_social || '').localeCompare(b.cliente?.nombre_razon_social || '');
        return 0;
    });

    return (
        <div className="page-enter">
            {/* ── Encabezado ─────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1>📋 Cuentas por Cobrar</h1>
                    <p>Gestión de ventas al fiado y créditos</p>
                </div>
            </div>

            {/* ── Tarjetas resumen ────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <div className="card" style={{ borderLeft: '4px solid #f59e0b', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 28, opacity: 0.08 }}>💰</div>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total por cobrar</p>
                    <p style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b', margin: '6px 0 0' }}>{formatCurrency(resumen.totalDeuda)}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{creditos.filter(c => c.estado !== 'PAGADO_TOTAL' && c.estado !== 'ANULADO').length} créditos activos</p>
                </div>
                <div className="card" style={{ borderLeft: '4px solid #dc2626', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 28, opacity: 0.08 }}>🔴</div>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {resumen.countVencido > 0 && <AlertTriangle size={12} color="#dc2626" />} Deuda vencida ({resumen.countVencido})
                    </p>
                    <p style={{ fontSize: 26, fontWeight: 800, color: '#dc2626', margin: '6px 0 0' }}>{formatCurrency(resumen.totalVencido)}</p>
                    {resumen.countVencido > 0 && <p style={{ fontSize: 11, color: '#dc2626', margin: '2px 0 0', fontWeight: 600 }}>⚠️ Requiere atención</p>}
                </div>
                <div className="card" style={{ borderLeft: '4px solid #3b82f6', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 28, opacity: 0.08 }}>🕐</div>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Deuda vigente</p>
                    <p style={{ fontSize: 26, fontWeight: 800, color: '#3b82f6', margin: '6px 0 0' }}>{formatCurrency(resumen.totalPendiente)}</p>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>Sin vencer</p>
                </div>
            </div>

            {/* ── Filtros ─────────────────────────────────────── */}
            <div className="card mb-4">
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
                        <Search size={16} className="search-icon" />
                        <input className="form-input" placeholder="Buscar por cliente o N° venta..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[
                            { val: '',               label: 'Todos' },
                            { val: 'VENCIDO',        label: '🔴 Vencidos' },
                            { val: 'PENDIENTE',      label: '🕐 Pendientes' },
                            { val: 'PAGADO_PARCIAL', label: '📊 Parciales' },
                            { val: 'PAGADO_TOTAL',   label: '✅ Pagados' },
                        ].map(f => (
                            <button key={f.val} onClick={() => setFiltroEstado(f.val)}
                                className={`btn btn-sm ${filtroEstado === f.val ? 'btn-primary' : 'btn-secondary'}`}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <select className="form-input" style={{ width: 'auto', fontSize: 13 }} value={orden} onChange={e => setOrden(e.target.value)}>
                        <option value="urgencia">⚠️ Por urgencia</option>
                        <option value="saldo_desc">💰 Mayor saldo primero</option>
                        <option value="saldo_asc">💰 Menor saldo primero</option>
                        <option value="fecha_desc">📅 Más recientes</option>
                        <option value="fecha_asc">📅 Más antiguos</option>
                        <option value="cliente">🔤 Por cliente (A–Z)</option>
                    </select>
                </div>
            </div>

            {/* ── Tabla ───────────────────────────────────────── */}
            <div className="card overflow-auto">
                {loading ? (
                    <div className="loader"><div className="spinner"></div></div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>N° Venta</th>
                                <th>Fecha</th>
                                <th>Vencimiento</th>
                                <th>Total</th>
                                <th>Abonado</th>
                                <th>Saldo</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.map(c => {
                                const dias = diasRestantes(c.fecha_vencimiento);
                                const vencido = c.estado === 'VENCIDO';
                                const proximoVencer = dias !== null && dias >= 0 && dias <= 7;
                                return (
                                    <tr key={c.id_credito} style={{ background: vencido ? '#fff5f5' : undefined }}>
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>{c.cliente?.nombre_razon_social || '—'}</div>
                                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.cliente?.numero_documento || ''}</div>
                                        </td>
                                        <td className="font-mono text-xs text-purple-600">{c.numero_venta}</td>
                                        <td className="text-sm">{formatDateTime(c.fecha_creacion)}</td>
                                        <td>
                                            {c.fecha_vencimiento ? (
                                                <div>
                                                    <div style={{ fontSize: 12, fontWeight: 600, color: vencido ? '#dc2626' : proximoVencer ? '#f59e0b' : '#334155' }}>
                                                        {new Date(c.fecha_vencimiento).toLocaleDateString('es-PE')}
                                                    </div>
                                                    {dias !== null && c.estado !== 'PAGADO_TOTAL' && (
                                                        <div style={{ fontSize: 11, color: vencido ? '#dc2626' : proximoVencer ? '#f59e0b' : '#94a3b8' }}>
                                                            {vencido ? `Venció hace ${Math.abs(dias)}d` : `En ${dias}d`}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: 11, color: '#cbd5e1' }}>Sin límite</span>
                                            )}
                                        </td>
                                        <td className="font-bold">{formatCurrency(c.monto_total)}</td>
                                        <td style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(c.monto_pagado)}</td>
                                        <td style={{ fontWeight: 800, color: c.saldo > 0 ? '#dc2626' : '#16a34a', fontSize: 15 }}>{formatCurrency(c.saldo)}</td>
                                        <td><BadgeEstado estado={c.estado} /></td>
                                        <td>
                                            <button className="btn btn-primary btn-sm" onClick={() => abrirDetalle(c)}>Ver / Abonar</button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtrados.length === 0 && (
                                <tr><td colSpan={9} className="text-center py-8 text-slate-400">{search || filtroEstado ? 'No hay créditos con ese filtro' : 'No hay créditos registrados'}</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ══ Modal Detalle / Abono ════════════════════════ */}
            {showDetalle && (
                <div className="modal-overlay" onClick={() => { setShowDetalle(null); setShowAbono(false); }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>

                        {/* Header */}
                        <div className="modal-header">
                            <div>
                                <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    📋 {showDetalle.cliente?.nombre_razon_social || 'Cliente'}
                                </h2>
                                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                                    {showDetalle.numero_comprobante || showDetalle.numero_venta} · {formatDateTime(showDetalle.fecha_creacion)}
                                </p>
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setShowDetalle(null); setShowAbono(false); }}><X size={18} /></button>
                        </div>

                        {loadingDetalle ? (
                            <div className="loader"><div className="spinner"></div></div>
                        ) : (
                            <div className="space-y-5">

                                {/* ── Resumen financiero (tarjetas) ───────── */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                        <p style={{ fontSize: 10, color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total crédito</p>
                                        <p style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '4px 0 0' }}>{formatCurrency(showDetalle.monto_total)}</p>
                                    </div>
                                    <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 14px', textAlign: 'center', border: '1px solid #86efac' }}>
                                        <p style={{ fontSize: 10, color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ya pagado</p>
                                        <p style={{ fontSize: 22, fontWeight: 800, color: '#16a34a', margin: '4px 0 0' }}>{formatCurrency(showDetalle.monto_pagado)}</p>
                                    </div>
                                    <div style={{ background: showDetalle.saldo > 0 ? '#fef2f2' : '#f0fdf4', borderRadius: 12, padding: '12px 14px', textAlign: 'center', border: `1px solid ${showDetalle.saldo > 0 ? '#fca5a5' : '#86efac'}` }}>
                                        <p style={{ fontSize: 10, color: '#64748b', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo pendiente</p>
                                        <p style={{ fontSize: 22, fontWeight: 800, color: showDetalle.saldo > 0 ? '#dc2626' : '#16a34a', margin: '4px 0 0' }}>{formatCurrency(showDetalle.saldo)}</p>
                                    </div>
                                </div>

                                {/* Barra de progreso global */}
                                <BarraPago monto_total={showDetalle.monto_total} monto_pagado={showDetalle.monto_pagado} />

                                {/* Desglose por canal */}
                                {showDetalle.desglose_abonos && (showDetalle.desglose_abonos.total_efectivo > 0 || showDetalle.desglose_abonos.total_yape_plin > 0) && (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {showDetalle.desglose_abonos.total_efectivo > 0 && (
                                            <div style={{ flex: 1, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Banknote size={16} style={{ color: '#10B981' }} />
                                                <div>
                                                    <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>Efectivo abonado</p>
                                                    <p style={{ fontSize: 14, fontWeight: 700, color: '#10B981', margin: 0 }}>{formatCurrency(showDetalle.desglose_abonos.total_efectivo)}</p>
                                                </div>
                                            </div>
                                        )}
                                        {showDetalle.desglose_abonos.total_yape_plin > 0 && (
                                            <div style={{ flex: 1, background: 'rgba(197,22,225,0.06)', border: '1px solid rgba(197,22,225,0.2)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Smartphone size={16} style={{ color: '#C516E1' }} />
                                                <div>
                                                    <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>Yape/Plin abonado</p>
                                                    <p style={{ fontSize: 14, fontWeight: 700, color: '#C516E1', margin: 0 }}>{formatCurrency(showDetalle.desglose_abonos.total_yape_plin)}</p>
                                                </div>
                                            </div>
                                        )}
                                        {(showDetalle.desglose_abonos.total_transferencia ?? 0) > 0 && (
                                            <div style={{ flex: 1, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <DollarSign size={16} style={{ color: '#F59E0B' }} />
                                                <div>
                                                    <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>Transferencia abonada</p>
                                                    <p style={{ fontSize: 14, fontWeight: 700, color: '#F59E0B', margin: 0 }}>{formatCurrency(showDetalle.desglose_abonos.total_transferencia)}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Estado + vencimiento */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <BadgeEstado estado={showDetalle.estado} />
                                    {showEditVenc ? (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <input type="date" className="form-input" style={{ fontSize: 13 }} value={nuevaFechaVenc}
                                                min={new Date().toISOString().split('T')[0]}
                                                onChange={e => setNuevaFechaVenc(e.target.value)} />
                                            <button className="btn btn-primary btn-sm" onClick={handleGuardarVencimiento}>Guardar</button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setShowEditVenc(false)}>Cancelar</button>
                                        </div>
                                    ) : (
                                        <button className="btn btn-secondary btn-sm" onClick={() => { setNuevaFechaVenc(showDetalle.fecha_vencimiento?.split('T')[0] || ''); setShowEditVenc(true); }}>
                                            <Calendar size={13} />
                                            {showDetalle.fecha_vencimiento
                                                ? `Vence: ${new Date(showDetalle.fecha_vencimiento).toLocaleDateString('es-PE')}`
                                                : 'Establecer fecha límite'}
                                        </button>
                                    )}
                                </div>

                                {/* Productos de la venta */}
                                {showDetalle.venta?.detalles?.length > 0 && (
                                    <div>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Productos vendidos</p>
                                        <table className="data-table">
                                            <thead><tr><th>Producto</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>
                                            <tbody>
                                                {showDetalle.venta.detalles.map(d => (
                                                    <tr key={d.id_detalle}>
                                                        <td style={{ fontSize: 13 }}>{d.nombre_producto}</td>
                                                        <td>{d.cantidad}</td>
                                                        <td>{formatCurrency(d.precio_unitario)}</td>
                                                        <td className="font-bold">{formatCurrency(d.subtotal_linea)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Historial de abonos */}
                                <div>
                                    <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Historial de abonos ({showDetalle.abonos?.length || 0})
                                    </p>
                                    {showDetalle.abonos?.length === 0 ? (
                                        <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>Sin abonos registrados aún</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {showDetalle.abonos.map(a => {
                                                const esYape = ['YAPE_PLIN', 'YAPE', 'PLIN'].includes(a.medio_pago);
                                                const esTransferencia = a.medio_pago === 'TRANSFERENCIA';
                                                return (
                                                    <div key={a.id_abono} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 8, padding: '8px 12px', border: '1px solid #e2e8f0' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            {esYape
                                                                ? <Smartphone size={15} style={{ color: '#C516E1' }} />
                                                                : esTransferencia
                                                                ? <DollarSign size={15} style={{ color: '#F59E0B' }} />
                                                                : <Banknote   size={15} style={{ color: '#10B981' }} />}
                                                            <div>
                                                                <span style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>{formatCurrency(a.monto_abonado)}</span>
                                                                <span style={{ fontSize: 12, color: esYape ? '#C516E1' : esTransferencia ? '#F59E0B' : '#10B981', marginLeft: 6, fontWeight: 600 }}>
                                                                    {esYape ? 'Yape/Plin' : esTransferencia ? 'Transferencia' : 'Efectivo'}
                                                                </span>
                                                                {a.notas && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>· {a.notas}</span>}
                                                            </div>
                                                        </div>
                                                        
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatDateTime(a.fecha_abono)}</span>
                                                            <button
                                                                onClick={() => {
                                                                    // Calcular saldo anterior: saldo actual + suma de abonos anteriores a este (los que están antes en el array DESC)
                                                                    const idx = showDetalle.abonos.indexOf(a);
                                                                    const abonosPosteriores = showDetalle.abonos.slice(0, idx); // más recientes que este
                                                                    const sumaPosterior = abonosPosteriores.reduce((s, x) => s + x.monto_abonado, 0);
                                                                    const saldoAnt = showDetalle.saldo + sumaPosterior + a.monto_abonado;
                                                                    generarConstanciaAbono(a.monto_abonado, a.medio_pago, saldoAnt);
                                                                }}
                                                                title="Reimprimir constancia"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '2px 4px' }}>
                                                                <Printer size={13} />
                                                            </button>
                                                            {showDetalle.estado !== 'PAGADO_TOTAL' && (
                                                                <button onClick={() => handleEliminarAbono(a.id_abono)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px 4px' }}>
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Panel registrar abono */}
                                {showDetalle.estado !== 'PAGADO_TOTAL' && showDetalle.estado !== 'ANULADO' && (
                                    <div>
                                        {!showAbono ? (
                                            <button className="btn btn-primary w-full justify-center" onClick={() => setShowAbono(true)} style={{ fontWeight: 700, padding: '12px' }}>
                                                <Plus size={16} /> Registrar Abono
                                            </button>
                                        ) : (
                                            <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '2px solid #86efac', borderRadius: 14, padding: 18, boxShadow: '0 2px 12px rgba(22,163,74,0.08)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                                    <span style={{ fontSize: 20 }}>💳</span>
                                                    <div>
                                                        <p style={{ fontSize: 14, fontWeight: 800, color: '#15803d', margin: 0 }}>Registrar abono</p>
                                                        <p style={{ fontSize: 11, color: '#16a34a', margin: 0 }}>Saldo pendiente: {formatCurrency(showDetalle.saldo)}</p>
                                                    </div>
                                                </div>

                                                {/* Monto */}
                                                <div style={{ marginBottom: 12 }}>
                                                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, display: 'block' }}>
                                                        💰 Monto del abono (S/)
                                                    </label>
                                                    <input className="form-input" type="number" step="0.01" min="0.01" max={showDetalle.saldo}
                                                        value={montoAbono} onChange={e => setMontoAbono(e.target.value)}
                                                        placeholder={showDetalle.saldo.toFixed(2)}
                                                        style={{ fontSize: 20, fontWeight: 700, textAlign: 'right' }} autoFocus />
                                                    {/* Botones rápidos */}
                                                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                                        {[25, 50, 75].map(pct => {
                                                            const val = (showDetalle.saldo * pct / 100).toFixed(2);
                                                            return (
                                                                <button key={pct} type="button" onClick={() => setMontoAbono(val)}
                                                                    style={{ flex: 1, padding: '5px', borderRadius: 7, border: '1px solid #86efac', background: 'white', cursor: 'pointer', fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                                                                    {pct}% ({formatCurrency(Number(val))})
                                                                </button>
                                                            );
                                                        })}
                                                        <button type="button" onClick={() => setMontoAbono(showDetalle.saldo.toFixed(2))}
                                                            style={{ flex: 1, padding: '5px', borderRadius: 7, border: '1px solid #86efac', background: '#dcfce7', cursor: 'pointer', fontSize: 12, color: '#15803d', fontWeight: 700 }}>
                                                            Total
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Medio de pago — solo EFECTIVO y YAPE_PLIN */}
                                                <div style={{ marginBottom: 12 }}>
                                                    <label className="form-label" style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, display: 'block' }}>
                                                        Medio de pago
                                                    </label>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                                        {MEDIO_PAGO_OPTS.map(m => {
                                                            const activo = medioPago === m.val;
                                                            return (
                                                                <button key={m.val} type="button" onClick={() => setMedioPago(m.val)}
                                                                    style={{ padding: '10px 12px', borderRadius: 10, border: `2px solid ${activo ? m.color : '#e2e8f0'}`, background: activo ? `rgba(${m.color === '#10B981' ? '16,185,129' : '197,22,225'}, 0.08)` : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}>
                                                                    <m.icon size={18} style={{ color: activo ? m.color : '#94a3b8' }} />
                                                                    <span style={{ fontSize: 13, fontWeight: 600, color: activo ? m.color : '#64748b' }}>{m.label}</span>
                                                                    {activo && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Notas */}
                                                <div style={{ marginBottom: 14 }}>
                                                    <input className="form-input" value={notasAbono} onChange={e => setNotasAbono(e.target.value)}
                                                        placeholder="📝 Notas del abono (opcional)" style={{ fontSize: 13 }} />
                                                </div>

                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAbono(false)}>Cancelar</button>
                                                    <button className="btn btn-success" style={{ flex: 2, fontWeight: 700, fontSize: 14 }}
                                                        onClick={handleAbono} disabled={processingAbono || !montoAbono}>
                                                        {processingAbono ? 'Registrando...' : `✅ Confirmar ${montoAbono ? formatCurrency(Number(montoAbono)) : '...'}`}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Notas del crédito */}
                                {showDetalle.notas && (
                                    <p style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '8px 12px', borderRadius: 8 }}>
                                        📝 {showDetalle.notas}
                                    </p>
                                )}

                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
