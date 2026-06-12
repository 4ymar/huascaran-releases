import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Check, LayoutGrid, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '../../components/Toast';

// ── Endpoints ────────────────────────────────────────────────────────────────
const API = {
    listar:    ()           => fetch('/api/categorias', { headers: authHeaders() }).then(r => r.json()),
    crear:     (body)       => fetch('/api/categorias', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(body) }).then(r => r.json()),
    actualizar:(id, body)   => fetch(`/api/categorias/${id}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(body) }).then(r => r.json()),
    eliminar:  (id)         => fetch(`/api/categorias/${id}`, { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),
};

function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
function jsonHeaders() {
    return { 'Content-Type': 'application/json', ...authHeaders() };
}

// ── Emojis predefinidos agrupados por rubro ──────────────────────────────────
const EMOJIS = [
    // Genérico
    '📦','⭐','🏷️','🛒','💼','📋','🗂️',
    // Construcción / ferretería
    '🔧','🪛','🔨','🪚','⚡','🚿','🎨','🧱','🔒','🪟',
    // Alimentos / bebidas
    '🍎','🥩','🥛','🍞','🥤','🍺','☕','🍫','🌽','🧂',
    // Salud / belleza / farmacia
    '💊','🩺','💈','🧴','🪥','🧹','🧼',
    // Ropa / hogar
    '👕','👟','🪑','🛋️','🪴','🌱',
    // Tecnología
    '📱','💻','🖨️','🎮','📷',
    // Otros rubros
    '📚','✏️','🐾','🍽️','🚗','⛽','🧪','🌿',
];

const emptyForm = { nombre: '', icono: '📦' };

export default function SeccionCatalogo() {
    const toast = useToast();
    const [categorias, setCategorias]   = useState([]);
    const [loading, setLoading]         = useState(true);
    const [showForm, setShowForm]       = useState(false);
    const [editando, setEditando]       = useState(null); // objeto categoría o null
    const [form, setForm]               = useState(emptyForm);
    const [showPicker, setShowPicker]   = useState(false);
    const [guardando, setGuardando]     = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null); // id a eliminar

    // ── Carga ─────────────────────────────────────────────────────────────────
    const cargar = async () => {
        setLoading(true);
        try {
            const data = await API.listar();
            setCategorias(Array.isArray(data) ? data : []);
        } catch {
            toast('Error al cargar categorías', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    // ── Abrir formulario ──────────────────────────────────────────────────────
    const abrirCrear = () => {
        setForm(emptyForm);
        setEditando(null);
        setShowPicker(false);
        setShowForm(true);
    };

    const abrirEditar = (cat) => {
        setForm({ nombre: cat.nombre, icono: cat.icono });
        setEditando(cat);
        setShowPicker(false);
        setShowForm(true);
    };

    const cerrarForm = () => {
        setShowForm(false);
        setEditando(null);
        setShowPicker(false);
    };

    // ── Guardar ───────────────────────────────────────────────────────────────
    const handleGuardar = async () => {
        if (!form.nombre.trim()) {
            toast('El nombre es requerido', 'error');
            return;
        }
        setGuardando(true);
        try {
            let res;
            if (editando) {
                res = await API.actualizar(editando.id_categoria, {
                    nombre: form.nombre,
                    icono:  form.icono,
                    activo: editando.activo,
                });
            } else {
                res = await API.crear({ nombre: form.nombre, icono: form.icono });
            }
            if (res.error) { toast(res.error, 'error'); return; }
            toast(editando ? 'Categoría actualizada' : 'Categoría creada', 'success');
            cerrarForm();
            cargar();
        } catch {
            toast('Error al guardar', 'error');
        } finally {
            setGuardando(false);
        }
    };

    // ── Toggle activo ─────────────────────────────────────────────────────────
    const toggleActivo = async (cat) => {
        try {
            const res = await API.actualizar(cat.id_categoria, {
                nombre: cat.nombre,
                icono:  cat.icono,
                activo: cat.activo ? 0 : 1,
            });
            if (res.error) { toast(res.error, 'error'); return; }
            toast(cat.activo ? 'Categoría desactivada' : 'Categoría activada');
            cargar();
        } catch {
            toast('Error al cambiar estado', 'error');
        }
    };

    // ── Eliminar ──────────────────────────────────────────────────────────────
    const handleEliminar = async (id) => {
        try {
            const res = await API.eliminar(id);
            if (res.error) { toast(res.error, 'error'); return; }
            toast('Categoría eliminada');
            setConfirmDelete(null);
            cargar();
        } catch {
            toast('Error al eliminar', 'error');
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    const activas   = categorias.filter(c => c.activo);
    const inactivas = categorias.filter(c => !c.activo);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Cabecera de sección */}
            <div style={{
                background: '#fff', borderRadius: 14, padding: '20px 24px',
                border: '1px solid #f1f5f9',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            background: 'rgba(115,93,255,0.1)', borderRadius: 8,
                            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <LayoutGrid size={18} style={{ color: '#735DFF' }} />
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Categorías de productos</p>
                            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                                {activas.length} activa{activas.length !== 1 ? 's' : ''} · {inactivas.length} inactiva{inactivas.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={abrirCrear}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: 'linear-gradient(135deg, #735DFF 0%, #C516E1 100%)',
                            color: '#fff', border: 'none', borderRadius: 8,
                            padding: '8px 14px', fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', boxShadow: '0 2px 8px rgba(115,93,255,0.3)',
                        }}
                    >
                        <Plus size={15} /> Nueva categoría
                    </button>
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                    Las categorías permiten organizar tu catálogo según el rubro de tu negocio.
                    Solo las categorías <strong>activas</strong> aparecerán al crear o editar productos.
                </p>
            </div>

            {/* Lista */}
            <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
            }}>
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                        Cargando categorías...
                    </div>
                ) : categorias.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                        <p style={{ fontSize: 32, margin: '0 0 8px' }}>📦</p>
                        <p style={{ margin: 0, fontSize: 14, color: '#64748b', fontWeight: 600 }}>Sin categorías</p>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Crea la primera para organizar tu catálogo</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                                <th style={thStyle}>Categoría</th>
                                <th style={{ ...thStyle, textAlign: 'center', width: 90 }}>Estado</th>
                                <th style={{ ...thStyle, textAlign: 'center', width: 110 }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categorias.map((cat, idx) => (
                                <tr
                                    key={cat.id_categoria}
                                    style={{
                                        borderBottom: idx < categorias.length - 1 ? '1px solid #f8fafc' : 'none',
                                        opacity: cat.activo ? 1 : 0.5,
                                        transition: 'opacity 0.2s',
                                    }}
                                >
                                    {/* Nombre + ícono */}
                                    <td style={{ padding: '12px 20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{
                                                fontSize: 22, width: 38, height: 38,
                                                background: '#f8fafc', borderRadius: 8,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                {cat.icono}
                                            </span>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                                                {cat.nombre}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Toggle activo */}
                                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                        <button
                                            onClick={() => toggleActivo(cat)}
                                            title={cat.activo ? 'Desactivar' : 'Activar'}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                                        >
                                            {cat.activo
                                                ? <ToggleRight size={24} style={{ color: '#735DFF' }} />
                                                : <ToggleLeft  size={24} style={{ color: '#cbd5e1' }} />
                                            }
                                        </button>
                                    </td>

                                    {/* Acciones */}
                                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                            <button
                                                onClick={() => abrirEditar(cat)}
                                                title="Editar"
                                                style={btnIconStyle('#f1f5f9', '#475569')}
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            {confirmDelete === cat.id_categoria ? (
                                                <>
                                                    <button
                                                        onClick={() => handleEliminar(cat.id_categoria)}
                                                        title="Confirmar eliminación"
                                                        style={btnIconStyle('#fef2f2', '#dc2626')}
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDelete(null)}
                                                        title="Cancelar"
                                                        style={btnIconStyle('#f1f5f9', '#94a3b8')}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => setConfirmDelete(cat.id_categoria)}
                                                    title="Eliminar"
                                                    style={btnIconStyle('#fff', '#cbd5e1')}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal crear/editar */}
            {showForm && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={cerrarForm}
                >
                    <div
                        style={{
                            background: '#fff', borderRadius: 16, padding: 28,
                            width: '100%', maxWidth: 420,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header modal */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                                {editando ? 'Editar categoría' : 'Nueva categoría'}
                            </h3>
                            <button onClick={cerrarForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Ícono seleccionado */}
                        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Ícono
                        </p>
                        <button
                            onClick={() => setShowPicker(p => !p)}
                            style={{
                                width: '100%', padding: '10px 14px', marginBottom: 6,
                                background: '#f8fafc', border: '1px solid #e2e8f0',
                                borderRadius: 8, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 10,
                                fontSize: 13, color: '#475569',
                            }}
                        >
                            <span style={{ fontSize: 24 }}>{form.icono}</span>
                            <span style={{ flex: 1, textAlign: 'left' }}>
                                {showPicker ? 'Cerrar selector' : 'Cambiar ícono'}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{showPicker ? '▲' : '▼'}</span>
                        </button>

                        {/* Picker de emojis */}
                        {showPicker && (
                            <div style={{
                                background: '#f8fafc', border: '1px solid #e2e8f0',
                                borderRadius: 10, padding: 12, marginBottom: 16,
                                display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4,
                            }}>
                                {EMOJIS.map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => { setForm(f => ({ ...f, icono: emoji })); setShowPicker(false); }}
                                        style={{
                                            background: form.icono === emoji ? 'rgba(115,93,255,0.15)' : 'transparent',
                                            border: form.icono === emoji ? '2px solid #735DFF' : '2px solid transparent',
                                            borderRadius: 6, padding: '4px 2px',
                                            cursor: 'pointer', fontSize: 20,
                                            transition: 'all 0.1s',
                                        }}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Nombre */}
                        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Nombre
                        </p>
                        <input
                            autoFocus
                            value={form.nombre}
                            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleGuardar()}
                            placeholder="Ej: Abarrotes, Ferretería, Ropa..."
                            maxLength={50}
                            style={{
                                width: '100%', padding: '10px 14px', fontSize: 14,
                                border: '1px solid #e2e8f0', borderRadius: 8,
                                outline: 'none', boxSizing: 'border-box',
                                fontFamily: 'inherit', color: '#1e293b',
                                marginBottom: 20,
                            }}
                        />

                        {/* Botones */}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button
                                onClick={cerrarForm}
                                style={{
                                    padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
                                    background: '#fff', fontSize: 13, fontWeight: 600,
                                    color: '#475569', cursor: 'pointer',
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleGuardar}
                                disabled={guardando || !form.nombre.trim()}
                                style={{
                                    padding: '8px 20px', borderRadius: 8, border: 'none',
                                    background: guardando || !form.nombre.trim()
                                        ? '#e2e8f0'
                                        : 'linear-gradient(135deg, #735DFF 0%, #C516E1 100%)',
                                    color: guardando || !form.nombre.trim() ? '#94a3b8' : '#fff',
                                    fontSize: 13, fontWeight: 600, cursor: guardando ? 'wait' : 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear categoría'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Estilos helpers ───────────────────────────────────────────────────────────
const thStyle = {
    padding: '10px 20px', fontSize: 11, fontWeight: 700,
    color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5,
    textAlign: 'left',
};

const btnIconStyle = (bg, color) => ({
    background: bg, border: `1px solid ${color === '#94a3b8' ? '#e2e8f0' : 'transparent'}`,
    borderRadius: 6, padding: '5px 7px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', color,
    transition: 'all 0.15s',
});
