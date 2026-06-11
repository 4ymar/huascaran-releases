import { useState, useEffect } from 'react';
import { getDashboard, getPublicConfig } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { TrendingUp, ShoppingCart, AlertTriangle, DollarSign, Package, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed', margin: 0 }}>{formatCurrency(payload[0].value)}</p>
            </div>
        );
    }
    return null;
};

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const cargarDatos = () => {
        if (refreshing) return;
        setRefreshing(true);
        Promise.all([getDashboard(), getPublicConfig()])
            .then(([d, c]) => { setData(d); setConfig(c); })
            .catch(err => {
            console.error('Error cargando dashboard:', err);
        })
            .finally(() => { setLoading(false); setRefreshing(false); });
    };

    useEffect(() => { cargarDatos(); }, []);

    if (loading) return <div className="loader"><div className="spinner"></div></div>;
    if (!data) return null;

    const empresa = config?.empresa_nombre_corto || config?.empresa_nombre || 'Ferreteria';
    const ahora = new Date();
    const hora = ahora.getHours();
    const saludo = hora < 12 ? 'Buenos dias' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

    const kpis = [
        {
            label: 'Ventas Hoy',
            valor: formatCurrency(data.ventasHoy.total),
            sub: `${data.ventasHoy.cantidad} transacciones`,
            icon: <ShoppingCart size={20} />,
            color: '#7c3aed', bg: '#f5f3ff', border: '#e9d5ff'
        },
        {
            label: 'Ventas del Mes',
            valor: formatCurrency(data.ventasMes.total),
            sub: `${data.ventasMes.cantidad} transacciones`,
            icon: <TrendingUp size={20} />,
            color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd'
        },
        {
            label: 'Valor del Inventario',
            valor: formatCurrency(data.valorInventario),
            sub: `${data.totalProductos} productos activos`,
            icon: <DollarSign size={20} />,
            color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0'
        },
        {
            label: 'Alertas de Stock',
            valor: `${data.stockCritico + data.stockBajo}`,
            sub: `${data.stockCritico} sin stock • ${data.stockBajo} bajo minimo`,
            icon: <AlertTriangle size={20} />,
            color: data.stockCritico > 0 ? '#dc2626' : '#d97706',
            bg: data.stockCritico > 0 ? '#fef2f2' : '#fffbeb',
            border: data.stockCritico > 0 ? '#fecaca' : '#fde68a'
        },
    ];

    return (
        <div className="page-enter">

            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div className="flex items-center justify-between">
                    <div>
                        <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 4px' }}>
                            {saludo} — {ahora.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', margin: 0 }}>
                            Panel de Control
                        </h1>
                        <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0' }}>
                            {empresa} — resumen general del negocio
                        </p>
                    </div>
                    <button
                        onClick={cargarDatos}
                        disabled={refreshing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 16px',
                            background: refreshing ? '#f1f5f9' : 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            cursor: refreshing ? 'not-allowed' : 'pointer',
                            fontSize: 13,
                            color: refreshing ? '#94a3b8' : '#64748b',
                            fontWeight: 600,
                            opacity: refreshing ? 0.7 : 1,
                            pointerEvents: refreshing ? 'none' : 'auto',
                        }}
                    >
                        <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        {refreshing ? 'Actualizando...' : 'Actualizar'}
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {kpis.map((k, i) => (
                    <div key={i} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: k.color, borderRadius: '14px 0 0 14px' }} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>{k.label}</p>
                            <div style={{ background: k.color, color: 'white', borderRadius: 8, padding: 7, display: 'flex' }}>{k.icon}</div>
                        </div>
                        <p style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>{k.valor}</p>
                        <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{k.sub}</p>
                    </div>
                ))}
            </div>

            {/* Graficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

                {/* Ventas 7 dias */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Ventas Ultimos 7 Dias</h3>
                            <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Total diario en soles</p>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data.ventasPorDia} barSize={28}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `S/${v}`} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <defs>
                                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#7c3aed" />
                                    <stop offset="100%" stopColor="#a78bfa" />
                                </linearGradient>
                            </defs>
                            <Bar dataKey="total" fill="url(#grad1)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Top productos */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Top 5 Productos</h3>
                            <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Mas vendidos del mes</p>
                        </div>
                    </div>
                    {data.topProductos.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {data.topProductos.slice(0, 5).map((p, i) => {
                                const max = data.topProductos[0].cantidad;
                                const pct = Math.round((p.cantidad / max) * 100);
                                const colores = ['#7c3aed', '#0369a1', '#15803d', '#d97706', '#dc2626'];
                                return (
                                    <div key={i}>
                                        <div className="flex justify-between" style={{ marginBottom: 4 }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                                                <span style={{ color: colores[i], marginRight: 6, fontWeight: 800 }}>#{i + 1}</span>
                                                {p.nombre.length > 28 ? p.nombre.substring(0, 28) + '...' : p.nombre}
                                            </span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: colores[i] }}>{p.cantidad} uds</span>
                                        </div>
                                        <div style={{ background: '#f1f5f9', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: colores[i], borderRadius: 4, transition: 'width 0.6s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="empty-state"><Package size={40} /><p>No hay datos de ventas aun</p></div>
                    )}
                </div>
            </div>

            {/* Alertas y ultimas ventas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Alertas stock */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Alertas de Stock</h3>
                        {data.productosStockBajo.length > 0 && (
                            <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                                {data.productosStockBajo.length} alertas
                            </span>
                        )}
                    </div>
                    {data.productosStockBajo.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                            {data.productosStockBajo.map(p => (
                                <div key={p.id_producto} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: p.stock_actual === 0 ? '#fef2f2' : '#fffbeb', border: `1px solid ${p.stock_actual === 0 ? '#fecaca' : '#fde68a'}`, borderRadius: 8 }}>
                                    <div>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: 0 }}>{p.nombre}</p>
                                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{p.sku} • {p.categoria}</p>
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: p.stock_actual === 0 ? '#dc2626' : '#d97706', color: 'white', whiteSpace: 'nowrap' }}>
                                        {p.stock_actual === 0 ? 'SIN STOCK' : `${p.stock_actual} uds`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <Package size={40} />
                            <p style={{ color: '#15803d', fontWeight: 600 }}>Todo el stock esta en orden</p>
                        </div>
                    )}
                </div>

                {/* Ultimas ventas */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Ultimas Ventas</h3>
                        {data.ultimasVentas.length > 0 && (
                            <span style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #e9d5ff', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                                {data.ultimasVentas.length} recientes
                            </span>
                        )}
                    </div>
                    {data.ultimasVentas.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                            {data.ultimasVentas.map(v => (
                                <div key={v.id_venta} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#fafafa', border: '1px solid #f1f5f9', borderRadius: 8 }}>
                                    <div>
                                        <p style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', margin: 0 }}>{v.numero_venta}</p>
                                        <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{formatDateTime(v.fecha_hora)} • {v.tipo_comprobante}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', margin: 0 }}>{formatCurrency(v.total)}</p>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: v.estado === 'ACTIVA' ? '#f0fdf4' : '#fef2f2', color: v.estado === 'ACTIVA' ? '#15803d' : '#dc2626', border: `1px solid ${v.estado === 'ACTIVA' ? '#bbf7d0' : '#fecaca'}` }}>
                                            {v.estado}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state"><p>No hay ventas registradas aun</p></div>
                    )}
                </div>
            </div>
        </div>
    );
}
