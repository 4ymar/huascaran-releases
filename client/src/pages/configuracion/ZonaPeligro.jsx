import { useState, useEffect } from 'react';
import {
    AlertTriangle, FlaskConical, Trash2,
    Eye, EyeOff,
} from 'lucide-react';
import { useToast } from '../../components/Toast';
import { resetDB, cargarDemo, verificarPasswordBackup, getEstadisticas } from '../../services/api';

export default function ZonaPeligro() {
    const toast = useToast();

    // ── Estado local ─────────────────────────────────────────────────────────
    const [mostrarDemo, setMostrarDemo]           = useState(null);
    const [procesando, setProcesando]             = useState(false);

    // Modal demo
    const [modalDemo, setModalDemo]               = useState(false);
    const [confirmDemo, setConfirmDemo]           = useState(false);

    // Modal reset — paso 1: contraseña
    const [modalReset, setModalReset]             = useState(false);
    const [passwordReset, setPasswordReset]       = useState('');
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [verificandoReset, setVerificandoReset] = useState(false);
    const [resetAutorizado, setResetAutorizado]   = useState(false);
    const [confirmText, setConfirmText]           = useState('');

    // ── Detectar si hay datos reales ─────────────────────────────────────────
    useEffect(() => {
        getEstadisticas()
            .then(data => {
                const tieneProductos = (data?.total_productos ?? 0) > 0;
                const tieneVentas    = (data?.total_ventas    ?? 0) > 0;
                setMostrarDemo(!tieneProductos && !tieneVentas);
            })
            .catch(() => setMostrarDemo(false));
    }, []);

    // ── Handler: verificar contraseña reset ──────────────────────────────────
    const handleVerificarPasswordReset = async () => {
        setVerificandoReset(true);
        try {
            const data = await verificarPasswordBackup(passwordReset);
            if (data.ok) {
                setResetAutorizado(true);
            } else {
                toast('Contraseña incorrecta', 'error');
            }
        } catch {
            toast('Error al verificar contraseña', 'error');
        } finally {
            setVerificandoReset(false);
        }
    };

    const cerrarModalReset = () => {
        setModalReset(false);
        setPasswordReset('');
        setConfirmText('');
        setResetAutorizado(false);
        setShowPasswordReset(false);
    };

    // ── Handler: restablecer DB ──────────────────────────────────────────────
    const handleReset = async () => {
        if (confirmText !== 'RESTABLECER') return;
        setProcesando(true);
        try {
            const data = await resetDB();
            if (data.ok) {
                toast('Base de datos restablecida. Recargando...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                toast('Error al restablecer: ' + (data.error || 'desconocido'), 'error');
            }
        } catch {
            toast('Error al restablecer', 'error');
        } finally {
            setProcesando(false);
            cerrarModalReset();
        }
    };

    // ── Handler: cargar demo ─────────────────────────────────────────────────
    const handleDemo = async () => {
        setProcesando(true);
        try {
            const data = await cargarDemo();
            if (data.ok) {
                toast(`Datos cargados: ${data.productos} productos, ${data.ventas} ventas. Recargando...`, 'success');
                setTimeout(() => window.location.reload(), 1800);
            } else {
                toast('Error al cargar demo: ' + (data.error || 'desconocido'), 'error');
            }
        } catch {
            toast('Error al cargar demo', 'error');
        } finally {
            setProcesando(false);
            setModalDemo(false);
            setConfirmDemo(false);
        }
    };

    return (
        <>
            {/* Card — Zona de peligro */}
            <div className="card mb-6" style={{ borderLeft: '4px solid #FF4B6C', borderRadius: '0 16px 16px 0' }}>
                <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={20} className="text-red-500" />
                    <h2 className="text-lg font-bold text-red-700">Zona de peligro</h2>
                </div>
                <p className="text-sm text-slate-500 mb-5">
                    Estas acciones modifican permanentemente los datos del sistema.
                    Se recomienda generar una copia de seguridad antes de continuar.
                </p>

                <div className={`grid gap-4 ${mostrarDemo === true ? 'grid-cols-2' : 'grid-cols-1 max-w-md'}`}>

                    {/* Cargar demo — solo si no hay datos reales */}
                    {mostrarDemo === true && (
                        <div className="p-5 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.3)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <FlaskConical size={18} className="text-green-600" />
                                <span className="font-semibold text-green-800">Cargar datos de demostración</span>
                            </div>
                            <p className="text-sm text-green-700 mb-1">
                                Carga productos, clientes y ventas de ejemplo para explorar el sistema.
                            </p>
                            <p className="text-xs text-green-600 mb-4">
                                Esta opción solo está disponible mientras el sistema no tenga datos reales.
                            </p>
                            <button
                                className="btn btn-success w-full"
                                onClick={() => setModalDemo(true)}
                                disabled={procesando}
                            >
                                <FlaskConical size={14} />
                                Cargar datos demo
                            </button>
                        </div>
                    )}

                    {/* Restablecer — siempre visible */}
                    <div className="p-5 rounded-xl" style={{ background: 'rgba(255,75,108,0.05)', border: '1px solid rgba(255,75,108,0.25)' }}>
                        <div className="flex items-center gap-2 mb-2">
                            <Trash2 size={18} className="text-red-600" />
                            <span className="font-semibold text-red-800">Restablecer base de datos</span>
                        </div>
                        <p className="text-sm text-red-700 mb-4">
                            Elimina todos los productos, ventas, compras y clientes.
                            La configuración de la empresa se conserva.
                        </p>
                        <button
                            className="btn btn-danger w-full"
                            onClick={() => { setModalReset(true); setConfirmText(''); setPasswordReset(''); setResetAutorizado(false); }}
                            disabled={procesando}
                        >
                            <Trash2 size={14} />
                            Restablecer datos
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal — Cargar demo */}
            {modalDemo && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Cargar datos de demostración"
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                >
                    <div className="card" style={{ width: 420, maxWidth: '90vw' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <FlaskConical size={20} className="text-green-600" />
                            <h3 className="text-lg font-bold">Cargar datos de demostración</h3>
                        </div>
                        <p className="text-sm font-semibold text-amber-700 mb-4">
                            Los datos actuales serán reemplazados. Esta acción no se puede deshacer.
                        </p>
                        <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={confirmDemo}
                                onChange={e => setConfirmDemo(e.target.checked)}
                                className="w-4 h-4 accent-green-600"
                            />
                            <span className="text-sm text-slate-700">Entiendo que los datos actuales serán reemplazados</span>
                        </label>
                        <div className="flex gap-3 justify-end">
                            <button
                                className="btn btn-secondary"
                                onClick={() => { setModalDemo(false); setConfirmDemo(false); }}
                                disabled={procesando}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-success"
                                onClick={handleDemo}
                                disabled={procesando || !confirmDemo}
                            >
                                {procesando ? 'Cargando...' : 'Confirmar y cargar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal — Restablecer base de datos (2 pasos) */}
            {modalReset && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Restablecer base de datos"
                    style={{ position: 'fixed', inset: 0, background: 'rgba(29,17,54,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                >
                    <div className="card" style={{ width: 460, maxWidth: '90vw', padding: 32 }}>

                        {/* Cabecera */}
                        <div className="flex items-center gap-3 mb-6">
                            <div style={{ background: 'rgba(255,75,108,0.1)', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Trash2 size={20} style={{ color: '#FF4B6C' }} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1D1136' }}>Restablecer base de datos</h3>
                                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                                    {resetAutorizado ? 'Paso 2 de 2 — Confirmación' : 'Paso 1 de 2 — Verificación'}
                                </p>
                            </div>
                        </div>

                        {/* Aviso siempre visible */}
                        <div style={{ background: 'rgba(255,75,108,0.06)', border: '1px solid rgba(255,75,108,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#FF4B6C', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertTriangle size={14} /> Acción irreversible
                            </p>
                            <p style={{ fontSize: 13, color: '#ef4444', margin: '0 0 6px', lineHeight: 1.6 }}>
                                Se eliminarán permanentemente <strong>todos los productos, ventas, compras, clientes y movimientos</strong>.
                            </p>
                            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                                ✓ La configuración de la empresa (nombre, RUC, series) se conservará intacta.
                            </p>
                        </div>

                        {/* Paso 1 — Contraseña */}
                        {!resetAutorizado && (
                            <>
                                <label className="form-label" style={{ marginBottom: 8 }}>Contraseña de administrador</label>
                                <div style={{ position: 'relative', marginBottom: 24 }}>
                                    <input
                                        type={showPasswordReset ? 'text' : 'password'}
                                        className="form-input"
                                        placeholder="Ingrese su contraseña para continuar"
                                        value={passwordReset}
                                        onChange={e => setPasswordReset(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && passwordReset && handleVerificarPasswordReset()}
                                        autoFocus
                                        style={{ paddingRight: 40 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordReset(v => !v)}
                                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
                                        aria-label={showPasswordReset ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    >
                                        {showPasswordReset ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div className="flex gap-3 justify-end">
                                    <button className="btn btn-secondary" onClick={cerrarModalReset} disabled={verificandoReset}>
                                        Cancelar
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        onClick={handleVerificarPasswordReset}
                                        disabled={verificandoReset || !passwordReset}
                                    >
                                        {verificandoReset ? 'Verificando...' : 'Continuar →'}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Paso 2 — Confirmación escrita */}
                        {resetAutorizado && (
                            <>
                                <div style={{ marginBottom: 24 }}>
                                    <label className="form-label" style={{ color: '#FF4B6C', marginBottom: 8 }}>
                                        Escriba <strong>RESTABLECER</strong> para confirmar:
                                    </label>
                                    <input
                                        className="form-input"
                                        style={{ borderColor: confirmText === 'RESTABLECER' ? '#10B981' : undefined }}
                                        value={confirmText}
                                        onChange={e => setConfirmText(e.target.value)}
                                        placeholder="RESTABLECER"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-3 justify-end">
                                    <button className="btn btn-secondary" onClick={cerrarModalReset} disabled={procesando}>
                                        Cancelar
                                    </button>
                                    <button
                                        className={`btn ${confirmText === 'RESTABLECER' ? 'btn-danger' : 'btn-secondary'}`}
                                        style={{ cursor: confirmText === 'RESTABLECER' ? 'pointer' : 'not-allowed' }}
                                        onClick={handleReset}
                                        disabled={procesando || confirmText !== 'RESTABLECER'}
                                    >
                                        {procesando ? 'Restableciendo...' : 'Restablecer todo'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}