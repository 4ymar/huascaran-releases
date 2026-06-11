import { hoyLocalNegocio, downloadExcel } from '../utils/helpers';
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Filter, AlertCircle, History, Search, X, Calendar, Download } from 'lucide-react';
import { getLogs } from '../services/api';
import { useToast } from '../components/Toast';

const BADGE = {
    CREAR:    { bg: '#dcfce7', color: '#166534' },
    MODIFICAR:{ bg: '#fef08a', color: '#854d0e' },
    ELIMINAR: { bg: '#fee2e2', color: '#991b1b' },
    LOGIN:    { bg: '#dbeafe', color: '#1e40af' },
};

const MODULOS_CAJA = ['CAJA'];

export default function Auditoria() {
    const toast = useToast();
    const [logs, setLogs]       = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    // Filtros — por defecto carga SOLO el día de hoy
    const [fechaDesde, setFechaDesde] = useState(hoyLocalNegocio());
    const [fechaHasta, setFechaHasta] = useState(hoyLocalNegocio());
    const [modulo,     setModulo]     = useState('');
    const [usuario,    setUsuario]    = useState('');
    const [accion,     setAccion]     = useState(''); // M6: Filtro acción
    const [busqueda,   setBusqueda]   = useState(''); // búsqueda local sobre los resultados

    // Opciones de selects (derivadas de los logs ya cargados — sin llamada extra)
    const [modulosUnicos,  setModulosUnicos]  = useState([]);
    const [usuariosUnicos, setUsuariosUnicos] = useState([]);

    // Fila expandida (acordeón)
    const [filaExpandida, setFilaExpandida] = useState(null);

    // Paginación
    const LIMITE = 50; // M5
    const [offset, setOffset] = useState(0);
    const [hayMas, setHayMas] = useState(false);
    const [total, setTotal]   = useState(0);

    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = {
                limite: LIMITE,
                offset: offset,
                ...(fechaDesde && { desde: fechaDesde }),
                ...(fechaHasta && { hasta: fechaHasta }),
                ...(modulo     && { modulo }),
                ...(usuario    && { usuario }),
                ...(accion     && { accion }),
            };

            const data = await getLogs(params);
            // Compatibilidad con viejo/nuevo backend
            const raw = data.logs || (Array.isArray(data) ? data : []);

            setHayMas(data.hayMas || false);
            setTotal(data.total || 0);
            
            // Si el backend es viejo y devuelve 201 registros:
            if (Array.isArray(data)) {
                setHayMas(raw.length > LIMITE);
                setLogs(raw.slice(0, LIMITE));
            } else {
                setLogs(raw);
            }

            // Construir opciones de filtro a partir de lo que ya llegó
            const ms = [...new Set(raw.map(l => l.modulo).filter(Boolean))].sort();
            const us = [...new Set(raw.map(l => l.usuario).filter(Boolean))].sort();
            setModulosUnicos(prev => [...new Set([...prev, ...ms])]);
            setUsuariosUnicos(prev => [...new Set([...prev, ...us])]);
        } catch (err) {
            console.error('Error cargando logs:', err);
            const msg = err.response?.data?.error || 'Error de conexión';
            setError(msg);
            if (err.response?.status === 403) {
                toast('Acceso denegado: se requieren permisos de administrador', 'error');
            }
        } finally {
            setLoading(false);
        }
    }, [fechaDesde, fechaHasta, modulo, usuario, accion, offset]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Resetear página al cambiar filtros
    useEffect(() => {
        setOffset(0);
    }, [fechaDesde, fechaHasta, modulo, usuario, accion]);

    // Filtro local por texto (sobre los logs ya cargados, sin otra llamada)
    const logsFiltrados = busqueda.trim()
        ? logs.filter(l =>
            [l.usuario, l.accion, l.modulo, l.detalles, l.ip]
                .join(' ').toLowerCase()
                .includes(busqueda.toLowerCase())
          )
        : logs;

    // Indicador de si los filtros de fecha son el día de hoy
    const esSoloHoy = fechaDesde === hoyLocalNegocio() && fechaHasta === hoyLocalNegocio();

    const limpiarFiltros = () => {
        setFechaDesde(hoyLocalNegocio());
        setFechaHasta(hoyLocalNegocio());
        setModulo('');
        setUsuario('');
        setAccion('');
        setBusqueda('');
        setOffset(0);
    };

    const hayFiltrosActivos = modulo || usuario || accion || !esSoloHoy;

    return (
        <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>

            {/* ── Encabezado ─────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <History size={24} style={{ color: '#6366f1' }} />
                    Auditoría del Sistema
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* M7: Exportar Excel */}
                    <button
                        onClick={() => downloadExcel(
                            logsFiltrados.map(l => ({
                                'Fecha/Hora': new Date(l.fecha_hora).toLocaleString('es-PE'),
                                'Usuario':    l.usuario,
                                'Acción':     l.accion,
                                'Módulo':     l.modulo,
                                'Referencia': l.id_referencia || '-',
                                'Detalle':    l.detalles,
                                'IP':         l.ip,
                            })),
                            'auditoria',
                            'AUDITORIA',
                            toast
                        )}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 13, padding: '6px 12px', borderRadius: 6,
                            background: '#10b981', color: 'white', border: 'none',
                            fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        <Download size={14} /> Exportar Excel
                    </button>
                    {esSoloHoy && (
                        <span style={{
                            fontSize: 12, fontWeight: 600, padding: '4px 10px',
                            background: '#dbeafe', color: '#1e40af', borderRadius: 20
                        }}>
                            📅 Hoy
                        </span>
                    )}
                    {hayFiltrosActivos && (
                        <button
                            onClick={limpiarFiltros}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                fontSize: 12, padding: '4px 10px', borderRadius: 6,
                                border: '1px solid #e2e8f0', background: 'white',
                                color: '#64748b', cursor: 'pointer'
                            }}
                        >
                            <X size={12} /> Limpiar filtros
                        </button>
                    )}
                </div>
            </div>

            {/* ── Barra de filtros ────────────────────────────────── */}
            <div style={{
                background: 'white', borderRadius: 10, padding: '14px 18px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 16,
                display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end'
            }}>
                {/* Fecha desde */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Desde</label>
                    <div style={{ position: 'relative' }}>
                        <Calendar size={14} style={{ position: 'absolute', left: 8, top: 9, color: '#94a3b8' }} />
                        <input
                            type="date"
                            value={fechaDesde}
                            onChange={e => setFechaDesde(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: 28 }}
                        />
                    </div>
                </div>

                {/* Fecha hasta */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Hasta</label>
                    <div style={{ position: 'relative' }}>
                        <Calendar size={14} style={{ position: 'absolute', left: 8, top: 9, color: '#94a3b8' }} />
                        <input
                            type="date"
                            value={fechaHasta}
                            onChange={e => setFechaHasta(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: 28 }}
                        />
                    </div>
                </div>

                {/* Módulo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Módulo</label>
                    <div style={{ position: 'relative' }}>
                        <Filter size={14} style={{ position: 'absolute', left: 8, top: 9, color: '#94a3b8' }} />
                        <select
                            value={modulo}
                            onChange={e => setModulo(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: 28, cursor: 'pointer' }}
                        >
                            <option value="">Todos</option>
                            {modulosUnicos.map(m => (
                                <option key={m} value={m}>
                                    {MODULOS_CAJA.includes(m) ? `💰 ${m}` : m}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* M6: Acción */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Acción</label>
                    <select
                        value={accion}
                        onChange={e => setAccion(e.target.value)}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                        <option value="">Todas</option>
                        {Object.keys(BADGE).map(a => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>
                </div>

                {/* Usuario */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Usuario</label>
                    <select
                        value={usuario}
                        onChange={e => setUsuario(e.target.value)}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                        <option value="">Todos</option>
                        {usuariosUnicos.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>

                {/* Búsqueda local (sin llamada extra) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>
                    <label style={labelStyle}>Buscar en resultados</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Texto libre..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: 28 }}
                        />
                    </div>
                </div>

                {/* Atajos rápidos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={labelStyle}>Rápido</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {[
                            { label: 'Hoy',         desde: hoyLocalNegocio(), hasta: hoyLocalNegocio() },
                            { label: 'Esta semana', desde: semanaAtras(), hasta: hoyLocalNegocio() },
                            { label: 'Este mes',    desde: mesAtras(),   hasta: hoyLocalNegocio() },
                        ].map(op => (
                            <button
                                key={op.label}
                                onClick={() => { setFechaDesde(op.desde); setFechaHasta(op.hasta); }}
                                style={{
                                    fontSize: 11, padding: '5px 9px', borderRadius: 6,
                                    border: '1px solid #e2e8f0',
                                    background: fechaDesde === op.desde && fechaHasta === op.hasta ? '#6366f1' : 'white',
                                    color:      fechaDesde === op.desde && fechaHasta === op.hasta ? 'white'   : '#64748b',
                                    cursor: 'pointer', whiteSpace: 'nowrap'
                                }}
                            >
                                {op.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Contador y Paginación M5 ────────────────────────── */}
            {!loading && !error && (
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <span>
                            {total === 0
                                ? 'Sin registros para este período'
                                : `${total} registro${total !== 1 ? 's' : ''} en total`
                            }
                        </span>
                        {total > 0 && (
                            <span style={{ marginLeft: 8 }}>
                                — Mostrando {offset + 1} a {Math.min(offset + LIMITE, total)}
                            </span>
                        )}
                    </div>
                    
                    {total > LIMITE && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button 
                                onClick={() => setOffset(Math.max(0, offset - LIMITE))}
                                disabled={offset === 0}
                                style={{
                                    padding: '4px 10px', borderRadius: 4, border: '1px solid #cbd5e1',
                                    background: offset === 0 ? '#f8fafc' : 'white',
                                    color: offset === 0 ? '#94a3b8' : '#334155', cursor: offset === 0 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                ← Anterior
                            </button>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>
                                Página {Math.floor(offset / LIMITE) + 1} de {Math.ceil(total / LIMITE)}
                            </span>
                            <button 
                                onClick={() => setOffset(offset + LIMITE)}
                                disabled={!hayMas}
                                style={{
                                    padding: '4px 10px', borderRadius: 4, border: '1px solid #cbd5e1',
                                    background: !hayMas ? '#f8fafc' : 'white',
                                    color: !hayMas ? '#94a3b8' : '#334155', cursor: !hayMas ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Siguiente →
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Contenido ───────────────────────────────────────── */}
            {error ? (
                <div style={{ background: '#fee2e2', color: '#991b1b', padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertCircle size={20} />
                    {error}
                </div>
            ) : loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    <Loader2 size={32} style={{ margin: '0 auto 12px', display: 'block', animation: 'spin 1s linear infinite' }} />
                    Cargando registros...
                </div>
            ) : logsFiltrados.length === 0 ? (
                <div style={{
                    padding: 48, textAlign: 'center', color: '#94a3b8',
                    background: 'white', borderRadius: 10, border: '1px dashed #cbd5e1'
                }}>
                    <History size={36} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Sin actividad registrada</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                        {esSoloHoy
                            ? 'No hubo movimientos hoy. Prueba ampliar el rango de fechas.'
                            : 'No hay registros para los filtros seleccionados.'
                        }
                    </p>
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                            <tr style={{
                                background: '#f8fafc', borderBottom: '2px solid #e2e8f0',
                                textAlign: 'left', color: '#64748b', fontSize: 12,
                                textTransform: 'uppercase', letterSpacing: '0.05em'
                            }}>
                                <th style={thStyle}>Fecha / Hora</th>
                                <th style={thStyle}>Usuario</th>
                                <th style={thStyle}>Acción</th>
                                <th style={thStyle}>Módulo</th>
                                <th style={thStyle}>Detalle</th>
                                <th style={thStyle}>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logsFiltrados.map((log) => {
                                const badge     = BADGE[log.accion] || { bg: '#f1f5f9', color: '#475569' };
                                const expandida = filaExpandida === log.id_log;

                                // Partir el detalle por '|' para mostrar cada segmento en su propia línea
                                const segmentos = (log.detalles || '').split('|').map(s => s.trim()).filter(Boolean);

                                return (
                                    <>
                                        <tr
                                            key={log.id_log}
                                            onClick={() => setFilaExpandida(expandida ? null : log.id_log)}
                                            style={{
                                                borderBottom: expandida ? 'none' : '1px solid #f1f5f9',
                                                cursor: 'pointer',
                                                background: expandida ? '#f8f7ff' : '',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => { if (!expandida) e.currentTarget.style.background = '#fafafa'; }}
                                            onMouseLeave={e => { if (!expandida) e.currentTarget.style.background = ''; }}
                                        >
                                            <td style={{ ...tdStyle, color: '#475569', whiteSpace: 'nowrap' }}>
                                                {new Date(log.fecha_hora).toLocaleString('es-PE', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                })}
                                            </td>
                                            <td style={{ ...tdStyle, fontWeight: 600, color: '#1e293b' }}>
                                                {log.usuario}
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    padding: '3px 8px', borderRadius: 4, fontSize: 11,
                                                    fontWeight: 700, letterSpacing: '0.03em',
                                                    background: badge.bg, color: badge.color
                                                }}>
                                                    {log.accion}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    fontSize: 12, fontWeight: 600,
                                                    color: MODULOS_CAJA.includes(log.modulo) ? '#6366f1' : '#334155'
                                                }}>
                                                    {MODULOS_CAJA.includes(log.modulo) ? '💰' : ''} {log.modulo}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, color: '#475569', fontSize: 13, maxWidth: 300 }}>
                                                <span style={{
                                                    display: 'block', overflow: 'hidden',
                                                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    color: expandida ? '#6366f1' : '#475569',
                                                    fontWeight: expandida ? 600 : 400,
                                                }}>
                                                    {segmentos[0] || '—'}
                                                </span>
                                                {!expandida && segmentos.length > 1 && (
                                                    <span style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 600 }}>
                                                        +{segmentos.length - 1} más…
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ ...tdStyle, color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                    {log.ip || '—'}
                                                    <span style={{
                                                        fontSize: 11, color: expandida ? '#6366f1' : '#cbd5e1',
                                                        transition: 'transform 0.2s, color 0.2s',
                                                        display: 'inline-block',
                                                        transform: expandida ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    }}>▼</span>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Fila expandida — acordeón */}
                                        {expandida && (
                                            <tr key={`${log.id_log}-detalle`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td colSpan={6} style={{ padding: '0 14px 14px 14px', background: '#f8f7ff' }}>
                                                    <div style={{
                                                        borderRadius: 10, border: '1px solid #e0e7ff',
                                                        background: 'white', overflow: 'hidden',
                                                    }}>
                                                        {/* Cabecera del detalle */}
                                                        <div style={{
                                                            padding: '8px 14px', background: '#eef2ff',
                                                            borderBottom: '1px solid #e0e7ff',
                                                            fontSize: 11, fontWeight: 700, color: '#6366f1',
                                                            textTransform: 'uppercase', letterSpacing: '0.05em'
                                                        }}>
                                                            Detalle completo
                                                        </div>

                                                        {/* Segmentos */}
                                                        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {segmentos.length === 0 ? (
                                                                <span style={{ color: '#94a3b8', fontSize: 13 }}>Sin detalles</span>
                                                            ) : segmentos.map((seg, i) => {
                                                                // Intentar separar "Clave: valor" para destacar la clave
                                                                const colonIdx = seg.indexOf(':');
                                                                const tieneDosPuntos = colonIdx > 0 && colonIdx < 40;
                                                                const clave = tieneDosPuntos ? seg.slice(0, colonIdx).trim() : null;
                                                                const valor = tieneDosPuntos ? seg.slice(colonIdx + 1).trim() : seg;

                                                                return (
                                                                    <div key={i} style={{
                                                                        display: 'flex', alignItems: 'baseline', gap: 8,
                                                                        padding: '5px 8px', borderRadius: 6,
                                                                        background: i % 2 === 0 ? '#f8fafc' : 'white',
                                                                        fontSize: 13,
                                                                    }}>
                                                                        {clave && (
                                                                            <span style={{
                                                                                fontWeight: 700, color: '#6366f1',
                                                                                whiteSpace: 'nowrap', minWidth: 120,
                                                                                fontSize: 12,
                                                                            }}>
                                                                                {clave}
                                                                            </span>
                                                                        )}
                                                                        <span style={{ color: '#334155', wordBreak: 'break-word' }}>
                                                                            {clave ? valor : seg}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Helpers de fechas ────────────────────────────────────────
function semanaAtras() {
    const hace6 = new Date(new Date().getTime() - 6 * 86400000);
    const local = new Date(hace6.getTime() + (-300 * 60 * 1000));
    return local.getUTCFullYear() + '-' +
        String(local.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(local.getUTCDate()).padStart(2, '0');
}

function mesAtras() {
    const local = new Date(new Date().getTime() + (-300 * 60 * 1000));
    return local.getUTCFullYear() + '-' +
        String(local.getUTCMonth() + 1).padStart(2, '0') + '-01';
}

// ── Estilos reutilizables ─────────────────────────────────────
const labelStyle = {
    fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.06em'
};

const inputStyle = {
    padding: '7px 10px', borderRadius: 6,
    border: '1px solid #e2e8f0', background: 'white',
    color: '#334155', fontSize: 13, outline: 'none',
    minWidth: 130
};

const thStyle = { padding: '11px 14px', fontWeight: 700 };
const tdStyle = { padding: '11px 14px' };
