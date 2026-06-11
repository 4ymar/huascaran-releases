import { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import { ToastProvider } from './components/Toast';
import Dashboard from './pages/Dashboard';
import Productos from './pages/Productos';
import Inventario from './pages/Inventario';
import Ventas from './pages/Ventas';
import Compras from './pages/Compras';
import Clientes from './pages/Clientes';
import Reportes from './pages/Reportes';
import Comprobantes from './pages/Comprobantes';
import Configuracion from './pages/Configuracion';
import Activacion from './pages/Activacion';
import Bienvenida from './pages/Bienvenida';
import Creditos from './pages/Creditos';
import Caja from './pages/Caja';
import Login from './pages/Login';
import Usuarios from './pages/Usuarios';
import Auditoria from './pages/Auditoria';

// ── Pantalla de error fatal (backend no disponible) ───────────────────────────
function ErrorBackend({ onReintentar }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100vh', gap: 16,
            background: '#fafafa', fontFamily: 'sans-serif'
        }}>
            <span style={{ fontSize: 48 }}>⚠️</span>
            <h2 style={{ margin: 0, color: '#dc2626' }}>No se pudo conectar al sistema</h2>
            <p style={{ color: '#64748b', textAlign: 'center', maxWidth: 400 }}>
                El servicio interno no respondió correctamente.<br />
                Cierra y vuelve a abrir la aplicación. Si el error persiste,
                contacta al soporte técnico.
            </p>
            <button
                onClick={onReintentar}
                style={{
                    padding: '10px 24px', borderRadius: 8, border: 'none',
                    background: '#6366f1', color: 'white', cursor: 'pointer', fontSize: 15
                }}
            >
                Reintentar
            </button>
        </div>
    );
}

function UpdateBanner() {
    const [updateStatus, setUpdateStatus] = useState(null); // null, 'checking', 'available', 'not-available', 'downloading', 'downloaded', 'error'
    const [updateInfo, setUpdateInfo] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');
    const [ocultado, setOcultado] = useState(false);

    useEffect(() => {
        if (!window.electronAPI || !window.electronAPI.updater) {
            return;
        }

        const unsubscribe = window.electronAPI.updater.onStatus((status) => {
            console.log('Updater status received:', status);
            if (status.state) {
                setUpdateStatus(status.state);
                if (status.state === 'available') {
                    setUpdateInfo(status.info);
                    setOcultado(false);
                } else if (status.state === 'downloaded') {
                    setUpdateInfo(status.info);
                    setOcultado(false);
                } else if (status.state === 'downloading') {
                    if (status.progress) {
                        setDownloadProgress(Math.round(status.progress.percent || 0));
                    }
                } else if (status.state === 'error') {
                    setErrorMessage(status.error || 'Error desconocido');
                }
            }
        });

        // Trigger automatic check
        window.electronAPI.updater.check().catch((err) => {
            console.error('Failed to check for updates:', err);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    if (ocultado || !updateStatus) return null;
    if (updateStatus === 'not-available' || updateStatus === 'checking') return null;

    const handleDownload = () => {
        window.electronAPI.updater.download().catch((err) => {
            setUpdateStatus('error');
            setErrorMessage(err.message);
        });
    };

    const handleInstall = () => {
        window.electronAPI.updater.install().catch((err) => {
            setUpdateStatus('error');
            setErrorMessage(err.message);
        });
    };

    return (
        <div style={{
            background: 'linear-gradient(135deg, #735DFF 0%, #C516E1 100%)',
            color: 'white',
            borderRadius: '12px',
            padding: '12px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 15px rgba(115,93,255,0.2)',
            position: 'relative',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>🚀</span>
                <div>
                    {updateStatus === 'available' && (
                        <p style={{ margin: 0, fontWeight: 600 }}>
                            Nueva versión disponible: <span style={{ textDecoration: 'underline' }}>v{updateInfo?.version || ''}</span>. ¡Actualiza con un solo clic!
                        </p>
                    )}
                    {updateStatus === 'downloading' && (
                        <div>
                            <p style={{ margin: 0, fontWeight: 600 }}>
                                Descargando actualización... {downloadProgress}%
                            </p>
                            <div style={{ width: '200px', height: '6px', background: 'rgba(255,255,255,0.3)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                                <div style={{ width: `${downloadProgress}%`, height: '100%', background: '#FFD522', borderRadius: '3px', transition: 'width 0.2s' }} />
                            </div>
                        </div>
                    )}
                    {updateStatus === 'downloaded' && (
                        <p style={{ margin: 0, fontWeight: 600 }}>
                            ¡Descarga completada! Reinicia la aplicación para instalar.
                        </p>
                    )}
                    {updateStatus === 'error' && (
                        <p style={{ margin: 0, fontWeight: 600, color: '#FFD522' }}>
                            Error de actualización: {errorMessage}
                        </p>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {updateStatus === 'available' && (
                    <button onClick={handleDownload} className="btn btn-sm" style={{ background: '#FFD522', color: '#1D1136', border: 'none' }}>
                        Descargar
                    </button>
                )}
                {updateStatus === 'downloaded' && (
                    <button onClick={handleInstall} className="btn btn-sm btn-success" style={{ border: 'none' }}>
                        Instalar y Reiniciar
                    </button>
                )}
                <button onClick={() => setOcultado(true)} style={{ background: 'transparent', border: 'none', color: 'white', opacity: 0.7, cursor: 'pointer', fontSize: '18px' }}>
                    ✕
                </button>
            </div>
        </div>
    );
}

function AppContent() {
    const [licenciaValida, setLicenciaValida]       = useState(null); // null = cargando
    const [errorBackend, setErrorBackend]           = useState(false);
    const [mostrarBienvenida, setMostrarBienvenida] = useState(true);
    const navigate  = useNavigate();
    const location  = useLocation();
    const esLogin   = location.pathname === '/login';

    const verificarLicencia = () => {
        setErrorBackend(false);
        setLicenciaValida(null);

        axios.get('/api/licencia/estado', { timeout: 8000 })
            .then(r => setLicenciaValida(r.data.valida === true))
            .catch(() => setErrorBackend(true));

        const visto = sessionStorage.getItem('bienvenida_vista');
        if (visto) setMostrarBienvenida(false);
    };

    useEffect(() => {
        verificarLicencia();
    }, []);

    // Heartbeat — mantiene el servidor vivo mientras el navegador está abierto
    useEffect(() => {
        const sendHeartbeat = () => axios.post('/api/heartbeat').catch(() => {});
        sendHeartbeat();
        const interval = setInterval(sendHeartbeat, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleLoginExitoso = useCallback(() => {
        navigate('/');
    }, [navigate]);

    const handleEntrar = () => {
        setMostrarBienvenida(false);
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        navigate(token ? '/' : '/login');
    };

    // ── Redirección por autenticación ─────────────────────────────────────────
    useEffect(() => {
        if (mostrarBienvenida) return;
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token && location.pathname !== '/login') {
            navigate('/login');
        }
    }, [location.pathname, navigate]);

    // ── Estados de carga y error ──────────────────────────────────────────────
    if (errorBackend) {
        return <ErrorBackend onReintentar={verificarLicencia} />;
    }

    if (licenciaValida === null) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: '#fafafa'
            }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!licenciaValida) {
        return <Activacion onActivada={() => setLicenciaValida(true)} />;
    }

    if (mostrarBienvenida) {
        return <Bienvenida onEntrar={handleEntrar} />;
    }
    if (esLogin) {
        return <Login onLoginExitoso={handleLoginExitoso} />;
    }

    return (
        <div className="app-layout">
            {!esLogin && <Sidebar />}
            <main className={esLogin ? '' : 'main-content'}>
                {!esLogin && <UpdateBanner />}
                <Routes>
                    <Route path="/"              element={<Dashboard />} />
                    <Route path="/productos"     element={<Productos />} />
                    <Route path="/inventario"    element={<Inventario />} />
                    <Route path="/ventas"        element={<Ventas />} />
                    <Route path="/compras"       element={<Compras />} />
                    <Route path="/clientes"      element={<Clientes />} />
                    <Route path="/reportes"      element={<Reportes />} />
                    <Route path="/comprobantes"  element={<Comprobantes />} />
                    <Route path="/configuracion" element={<Configuracion />} />
                    <Route path="/creditos"      element={<Creditos />} />
                    <Route path="/caja"          element={<Caja />} />
                    <Route path="/usuarios"      element={<Usuarios />} />
                    <Route path="/auditoria"     element={<Auditoria />} />
                </Routes>
            </main>
        </div>
    );
}

export default function App() {
    return (
        <HashRouter>
            <ToastProvider>
                <AppContent />
            </ToastProvider>
        </HashRouter>
    );
}
