import { useState, useEffect, useCallback } from 'react';
import api,{ getConfig, updateConfig, updateSunatToken, resetDB, cargarDemo, getBackups, crearBackup, verificarPasswordBackup, restaurarBackup, descargarBackupUrl, getEstadisticas, probarConfiguracionCPE, getDiagnostico, exportarSoporte } from '../services/api';
import { useToast } from '../components/Toast';
import { Save, Building2, FileText, Trash2, FlaskConical, Shield, RotateCcw, Lock, Eye, EyeOff, AlertTriangle, Settings, Info, CheckCircle, Clock, AlertCircle, DatabaseBackup, Printer, Image, Copy } from 'lucide-react';

export default function Configuracion() {
    const toast = useToast();
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hayDatosPendientes, setHayDatosPendientes] = useState(false);
    const [sunatTokenNuevo, setSunatTokenNuevo] = useState('');
    const [probandoCpe, setProbandoCpe] = useState(false);

    // ── Estado demo: se oculta si el sistema ya tiene datos reales ────────
    // null = cargando | true = mostrar | false = ocultar
    const [mostrarDemo, setMostrarDemo] = useState(null);

    // ── Estados de backup ─────────────────────────────────────────────────
    const [backups, setBackups]                 = useState({ ultimoDiario: null, ultimoManual: null });
    const [loadingBackups, setLoadingBackups]   = useState(false);
    const [generandoBackup, setGenerandoBackup] = useState(false);
    const [ultimoGenerado, setUltimoGenerado]   = useState(null);

    // Flujo de restauración — 3 pasos
    // paso 0: cerrado | paso 1: ingresar contraseña | paso 2: elegir backup | paso 3: confirmar RESTAURAR
    const [pasoRestore, setPasoRestore]         = useState(0);
    const [passwordRestore, setPasswordRestore] = useState('');
    const [showPassword, setShowPassword]       = useState(false);
    const [verificandoPass, setVerificandoPass] = useState(false);
    const [restoreToken, setRestoreToken]       = useState(null);
    const [backupsDisponibles, setBackupsDisponibles] = useState({ diarios: [], manuales: [] });
    const [tabBackup, setTabBackup]             = useState('diarios');
    const [visiblesBackup, setVisiblesBackup]   = useState(3); // items visibles por defecto
    const [backupSeleccionado, setBackupSeleccionado] = useState(null);
    const [confirmTexto, setConfirmTexto]       = useState('');
    const [restaurando, setRestaurando]         = useState(false);

    // Estados para modales de confirmación
    const [modalReset, setModalReset] = useState(false);
    const [modalDemo, setModalDemo]   = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [procesando, setProcesando]   = useState(false);

    // ── Estados de diagnóstico y actualización ────────────────────────────
    const [diagReport, setDiagReport] = useState(null);
    const [loadingDiag, setLoadingDiag] = useState(false);
    const [exportandoSoporte, setExportandoSoporte] = useState(false);

    const [updaterStatus, setUpdaterStatus] = useState(null); // null, 'checking', 'available', 'not-available', 'downloading', 'downloaded', 'error'
    const [updaterInfo, setUpdaterInfo] = useState(null);
    const [downloadPercent, setDownloadPercent] = useState(0);
    const [updaterError, setUpdaterError] = useState('');

    // ── Contraseña para modal de restablecer ─────────────────────────────
    const [passwordReset, setPasswordReset]       = useState('');
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [verificandoReset, setVerificandoReset] = useState(false);
    const [resetAutorizado, setResetAutorizado]   = useState(false);

    // FIX 7 — Checkbox de confirmación para modal demo
    const [confirmDemo, setConfirmDemo] = useState(false);
    const [subiendoLogo, setSubiendoLogo] = useState(false);

    // ── Carga inicial de configuración ───────────────────────────────────
    useEffect(() => {
        getConfig()
            .then(data => setConfig(data))
            .catch(err => console.error('Error cargando configuración:', err))
            .finally(() => setLoading(false));
    }, []);

    const cargarDiagnostico = useCallback(() => {
        setLoadingDiag(true);
        getDiagnostico()
            .then(data => setDiagReport(data))
            .catch(err => {
                console.error('Error al obtener diagnóstico:', err);
                toast('Error al obtener reporte de diagnóstico', 'error');
            })
            .finally(() => setLoadingDiag(false));
    }, [toast]);

    useEffect(() => {
        cargarDiagnostico();
    }, [cargarDiagnostico]);

    useEffect(() => {
        if (!window.electronAPI || !window.electronAPI.updater) return;

        const unsubscribe = window.electronAPI.updater.onStatus((status) => {
            if (status.state) {
                setUpdaterStatus(status.state);
                if (status.state === 'available') {
                    setUpdaterInfo(status.info);
                } else if (status.state === 'downloaded') {
                    setUpdaterInfo(status.info);
                } else if (status.state === 'downloading') {
                    if (status.progress) {
                        setDownloadPercent(Math.round(status.progress.percent || 0));
                    }
                } else if (status.state === 'error') {
                    setUpdaterError(status.error || 'Error desconocido');
                }
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const buscarActualizaciones = async () => {
        if (!window.electronAPI || !window.electronAPI.updater) {
            toast('La función de actualización solo está disponible en la aplicación de escritorio', 'warning');
            return;
        }
        setUpdaterStatus('checking');
        try {
            const resp = await window.electronAPI.updater.check();
            if (!resp.ok) {
                setUpdaterStatus('error');
                setUpdaterError(resp.error || 'Error al buscar actualizaciones');
                toast('Error al buscar actualizaciones', 'error');
            } else {
                toast('Búsqueda de actualizaciones iniciada', 'success');
            }
        } catch (err) {
            setUpdaterStatus('error');
            setUpdaterError(err.message);
            toast('Error al buscar actualizaciones: ' + err.message, 'error');
        }
    };

    const descargarActualizacion = async () => {
        try {
            await window.electronAPI.updater.download();
            toast('Descarga de actualización iniciada', 'success');
        } catch (err) {
            setUpdaterStatus('error');
            setUpdaterError(err.message);
            toast('Error al descargar: ' + err.message, 'error');
        }
    };

    const instalarActualizacion = async () => {
        try {
            await window.electronAPI.updater.install();
        } catch (err) {
            setUpdaterStatus('error');
            setUpdaterError(err.message);
            toast('Error al instalar: ' + err.message, 'error');
        }
    };

    const handleExportarSoporte = async () => {
        setExportandoSoporte(true);
        try {
            const res = await exportarSoporte();
            if (res.ok && res.tempZipPath) {
                if (window.electronAPI && window.electronAPI.saveSupportZip) {
                    const saveRes = await window.electronAPI.saveSupportZip({ tempZipPath: res.tempZipPath });
                    if (saveRes.ok) {
                        toast('Paquete de soporte guardado correctamente', 'success');
                    } else if (saveRes.canceled) {
                        toast('Guardado cancelado por el usuario', 'info');
                    } else {
                        toast('Error al guardar paquete de soporte: ' + saveRes.error, 'error');
                    }
                } else {
                    toast('Función no disponible en navegador', 'warning');
                }
            } else {
                toast('Error al generar paquete de soporte', 'error');
            }
        } catch (err) {
            console.error('Error exportando soporte:', err);
            toast('Error exportando soporte: ' + err.message, 'error');
        } finally {
            setExportandoSoporte(false);
        }
    };

    const copiarAlPortapapeles = (texto) => {
        if (!texto) return;
        navigator.clipboard.writeText(texto)
            .then(() => toast('Copiado al portapapeles', 'success'))
            .catch(() => toast('Error al copiar', 'error'));
    };

    // ── Detectar si el sistema ya tiene datos reales ─────────────────────
    useEffect(() => {
        getEstadisticas()
            .then(data => {
                const tieneProductos = (data?.total_productos ?? 0) > 0;
                const tieneVentas    = (data?.total_ventas    ?? 0) > 0;
                setMostrarDemo(!tieneProductos && !tieneVentas);
            })
            .catch(() => {
                setMostrarDemo(false);
            });
    }, []);

    const handleChange = (field, value) => {
        setConfig(prev => ({ ...prev, [field]: value }));
        setHayDatosPendientes(true);
    };

    const handleSeleccionarLogo = async () => {
        setSubiendoLogo(true);
        try {
            const result = await window.electronAPI.selectImage();
            if (!result?.ok) return;
            // Redimensionar a máximo 400px de ancho via canvas
            const img = new window.Image();
            img.onload = () => {
                const MAX = 400;
                const scale = img.width > MAX ? MAX / img.width : 1;
                const canvas = document.createElement('canvas');
                canvas.width  = Math.round(img.width  * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/png');
                handleChange('ticket_logo', base64);
            };
            img.src = result.base64;
        } catch (err) {
            toast('Error al cargar la imagen', 'error');
        } finally {
            setSubiendoLogo(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { sunat_token, ...configSinToken } = config;
            let data = await updateConfig(configSinToken);
            if (sunatTokenNuevo.trim()) {
                data = await updateSunatToken(sunatTokenNuevo.trim());
                setSunatTokenNuevo('');
            }
            setConfig(data);
            setHayDatosPendientes(false);
            toast('Configuración guardada correctamente', 'success');
        } catch (err) {
            toast('Error al guardar', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleProbarCPE = async () => {
        if (hayDatosPendientes || sunatTokenNuevo.trim()) {
            toast('Guarda los cambios antes de probar la conexion CPE', 'warning');
            return;
        }
        setProbandoCpe(true);
        try {
            await probarConfiguracionCPE();
            toast('Conexion con proveedor CPE disponible', 'success');
        } catch (err) {
            toast(err.response?.data?.error || 'No se pudo probar la configuracion CPE', 'error');
        } finally {
            setProbandoCpe(false);
        }
    };

    // ── Restablecer base de datos ────────────────────────────────────────
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
        } catch (err) {
            toast('Error al restablecer', 'error');
        } finally {
            setProcesando(false);
            setModalReset(false);
            setConfirmText('');
            setPasswordReset('');
            setResetAutorizado(false);
        }
    };

    // ── Cargar datos de demostración ─────────────────────────────────────
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
        } catch (err) {
            toast('Error al cargar demo', 'error');
        } finally {
            setProcesando(false);
            setModalDemo(false);
            // FIX 7 — Resetear checkbox al cerrar
            setConfirmDemo(false);
        }
    };

    // ── Cargar resumen de backups ────────────────────────────────────────
    const cargarBackups = useCallback(async () => {
        setLoadingBackups(true);
        try {
            const data = await getBackups();
            setBackups(data);
        } catch { /* silencioso */ }
        finally { setLoadingBackups(false); }
    }, []);

    useEffect(() => { cargarBackups(); }, [cargarBackups]);

    // ── Generar backup manual ────────────────────────────────────────────
    const handleBackupManual = async () => {
        setGenerandoBackup(true);
        try {
            const data = await crearBackup();
            if (data.ok) {
                toast('Copia de seguridad generada correctamente', 'success');
                setUltimoGenerado(data.archivo);
                cargarBackups();
            } else {
                toast('Error al generar backup: ' + (data.error || ''), 'error');
            }
        } catch {
            toast('Error al generar copia de seguridad', 'error');
        } finally {
            setGenerandoBackup(false);
        }
    };

    // ── Flujo de restauración ────────────────────────────────────────────
    const abrirRestore = () => {
        setPasoRestore(1);
        setPasswordRestore('');
        setShowPassword(false);
        setRestoreToken(null);
        setBackupSeleccionado(null);
        setConfirmTexto('');
        setVisiblesBackup(3);
    };

    const cerrarRestore = () => {
        setPasoRestore(0);
        setPasswordRestore('');
        setShowPassword(false);
        setRestoreToken(null);
        setBackupSeleccionado(null);
        setConfirmTexto('');
    };

    // Paso 1 → 2: verificar contraseña del admin
    const handleVerificarPassword = async () => {
        if (!passwordRestore) return;
        setVerificandoPass(true);
        try {
            const data = await verificarPasswordBackup(passwordRestore);
            if (data.ok) {
                setRestoreToken(data.restoreToken);
                // Límite garantizado en frontend: diarios últimos 15, manuales últimos 3
                setBackupsDisponibles({
                    diarios:  (data.diarios  || []).slice(0, 15),
                    manuales: (data.manuales || []).slice(0, 3),
                });
                setTabBackup('diarios');
                setPasoRestore(2);
            } else {
                toast(data.error || 'Contraseña incorrecta', 'error');
            }
        } catch (e) {
            const msg = e?.response?.data?.error || 'Contraseña incorrecta';
            toast(msg, 'error');
        } finally {
            setVerificandoPass(false);
        }
    };

    // Paso 2 → 3: seleccionar backup
    const seleccionarBackup = (b) => {
        setBackupSeleccionado(b);
        setConfirmTexto('');
        setPasoRestore(3);
    };

    // Paso 3: ejecutar restauración
    const handleRestaurar = async () => {
        if (!backupSeleccionado || confirmTexto !== 'RESTAURAR' || !restoreToken) return;
        setRestaurando(true);
        try {
            const data = await restaurarBackup({
                archivo:      backupSeleccionado.archivo,
                tipo:         backupSeleccionado.tipo,
                confirmacion: confirmTexto,
                restoreToken,
            });
            if (data.ok) {
                toast('Base de datos restaurada. El sistema se reiniciará...', 'success');
                setTimeout(() => window.location.reload(), 3000);
            } else {
                toast('Error al restaurar: ' + (data.error || ''), 'error');
            }
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error al restaurar';
            toast(msg, 'error');
        } finally {
            setRestaurando(false);
            cerrarRestore();
        }
    };

    // ── Helper: estado del backup (fresco / advertencia / crítico) ───────
    const estadoBackup = (fechaIso) => {
        if (!fechaIso) return { nivel: 'sin-datos', icono: null, color: '#94a3b8' };
        const diff = (Date.now() - new Date(fechaIso).getTime()) / (1000 * 60 * 60);
        if (diff < 24)  return { nivel: 'ok',          icono: 'ok',   color: '#10B981' };
        if (diff < 168) return { nivel: 'advertencia', icono: 'warn', color: '#F59E0B' };
        return               { nivel: 'critico',       icono: 'error',color: '#FF4B6C'  };
    };

    // ── Helper: formatear fecha legible ──────────────────────────────────
    const formatFecha = (isoStr) => {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
    };

    // FIX 5 — Helper: antigüedad relativa legible para el usuario
    const formatAntiguedad = (isoStr) => {
        if (!isoStr) return '';
        const horas = (Date.now() - new Date(isoStr).getTime()) / (1000 * 60 * 60);
        if (horas < 1)   return 'hace menos de 1 hora';
        if (horas < 24)  return `hace ${Math.floor(horas)}h`;
        const dias = Math.floor(horas / 24);
        return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
    };

    if (loading) return <div className="loader"><div className="spinner"></div></div>;

    return (
        <div className="page-enter">

            {/* ── Cabecera ─────────────────────────────────────────────── */}
            <div className="page-header" style={{ marginBottom: 28 }}>
                <div className="flex items-start gap-4">
                    <div
                        style={{
                            background: 'linear-gradient(135deg, #735DFF 0%, #C516E1 100%)',
                            borderRadius: 14,
                            padding: '10px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 4px 14px rgba(115,93,255,0.35)',
                        }}
                    >
                        <Settings size={22} color="white" />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1D1136', letterSpacing: '-0.3px' }}>
                            Configuración del sistema
                        </h1>
                        <p style={{ margin: '3px 0 0', fontSize: 14, color: '#64748b' }}>
                            Datos de la empresa para comprobantes y reportes
                        </p>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 1 — Datos de la empresa
            ══════════════════════════════════════════════════════════ */}
            <div className="card mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Building2 size={20} className="text-purple-500" />
                        <h2 className="text-lg font-bold">Datos de la empresa</h2>
                    </div>
                    {/* FIX 2 — El badge de "cambios sin guardar" se mantiene aquí como indicador
                        contextual. El botón de acción se mueve a la barra flotante (FIX 1). */}
                    {hayDatosPendientes && (
                        <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#92400e',
                            background: '#fffbeb',
                            border: '1px solid #fcd34d',
                            borderRadius: 20,
                            padding: '3px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            letterSpacing: '0.01em',
                        }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
                            Sin guardar
                        </span>
                    )}
                </div>

                {/* Identificación */}
                {/* FIX 3 — Razón social a col-span-2; email junto a teléfono en la misma fila */}
                <div className="flex items-center gap-3 mb-4" style={{ marginTop: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#735DFF', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, whiteSpace: 'nowrap' }}>Identificación</p>
                    <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="col-span-2">
                        <label className="form-label">Razón social</label>
                        <input
                            className="form-input"
                            value={config.empresa_nombre || ''}
                            onChange={e => handleChange('empresa_nombre', e.target.value)}
                            placeholder="Ej: FERRETERÍA YUNGAY E.I.R.L."
                        />
                    </div>
                    <div>
                        <label className="form-label">Nombre comercial</label>
                        <input
                            className="form-input"
                            value={config.empresa_nombre_corto || ''}
                            onChange={e => handleChange('empresa_nombre_corto', e.target.value)}
                            placeholder="Ej: Ferretería Yungay"
                        />
                    </div>
                    <div>
                        {/* FIX 8 — Placeholder con RUC de empresa pública conocida (Electroperú) */}
                        <label className="form-label">RUC</label>
                        <input
                            className="form-input"
                            value={config.empresa_ruc || ''}
                            onChange={e => handleChange('empresa_ruc', e.target.value)}
                            placeholder="Ej: 20600897543"
                            maxLength={11}
                            inputMode="numeric"
                        />
                        {config.empresa_ruc && config.empresa_ruc.length !== 11 && (
                            <p className="text-xs text-amber-600 mt-1">El RUC debe tener 11 dígitos</p>
                        )}
                    </div>
                    <div>
                        <label className="form-label">Teléfono</label>
                        <input
                            className="form-input"
                            value={config.empresa_telefono || ''}
                            onChange={e => handleChange('empresa_telefono', e.target.value)}
                            placeholder="Ej: 043-123456"
                        />
                    </div>
                    <div>
                        <label className="form-label">Correo electrónico</label>
                        <input
                            className="form-input"
                            type="email"
                            value={config.empresa_email || ''}
                            onChange={e => handleChange('empresa_email', e.target.value)}
                            placeholder="Ej: contacto@empresa.com"
                        />
                    </div>
                </div>

                {/* Ubicación */}
                <div className="flex items-center gap-3 mb-4" style={{ marginTop: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#735DFF', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, whiteSpace: 'nowrap' }}>Ubicación</p>
                    <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="form-label">Dirección</label>
                        <input
                            className="form-input"
                            value={config.empresa_direccion || ''}
                            onChange={e => handleChange('empresa_direccion', e.target.value)}
                            placeholder="Ej: Jr. Lima 123"
                        />
                    </div>
                    <div>
                        <label className="form-label">Distrito</label>
                        <input
                            className="form-input"
                            value={config.empresa_distrito || ''}
                            onChange={e => handleChange('empresa_distrito', e.target.value)}
                            placeholder="Ej: Yungay"
                        />
                    </div>
                    <div>
                        <label className="form-label">Provincia</label>
                        <input
                            className="form-input"
                            value={config.empresa_provincia || ''}
                            onChange={e => handleChange('empresa_provincia', e.target.value)}
                            placeholder="Ej: Yungay"
                        />
                    </div>
                    <div>
                        <label className="form-label">Departamento</label>
                        <input
                            className="form-input"
                            value={config.empresa_departamento || ''}
                            onChange={e => handleChange('empresa_departamento', e.target.value)}
                            placeholder="Ej: Áncash"
                        />
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 2 — Series de comprobantes
            ══════════════════════════════════════════════════════════ */}
            <div className="card mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <FileText size={20} className="text-purple-500" />
                    <h2 className="text-lg font-bold">Series de comprobantes</h2>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                    Defina las series para sus boletas y facturas. El correlativo se incrementa automáticamente con cada emisión.
                </p>
                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <label className="form-label">Serie boleta</label>
                        <input
                            className="form-input"
                            value={config.serie_boleta || 'B001'}
                            onChange={e => handleChange('serie_boleta', e.target.value)}
                            placeholder="B001"
                            maxLength={4}
                        />
                    </div>
                    <div>
                        <label className="form-label">Serie factura</label>
                        <input
                            className="form-input"
                            value={config.serie_factura || 'F001'}
                            onChange={e => handleChange('serie_factura', e.target.value)}
                            placeholder="F001"
                            maxLength={4}
                        />
                    </div>
                    <div>
                        <label className="form-label">Correlativo actual boleta</label>
                        <input
                            className="form-input"
                            type="number"
                            min={1}
                            value={config.correlativo_boleta || 1}
                            onChange={e => handleChange('correlativo_boleta', parseInt(e.target.value) || 1)}
                        />
                    </div>
                    <div>
                        <label className="form-label">Correlativo actual factura</label>
                        <input
                            className="form-input"
                            type="number"
                            min={1}
                            value={config.correlativo_factura || 1}
                            onChange={e => handleChange('correlativo_factura', parseInt(e.target.value) || 1)}
                        />
                    </div>
                </div>

                {/* Aviso SUNAT — cambia según si la integración está activa */}
                {config.sunat_activo === '1' ? (
                    <div className="mt-6 p-4 rounded-lg flex items-start gap-3 bg-green-50 border border-green-200">
                        <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-green-700">
                            <span className="font-semibold">Facturación electrónica activa.</span>{' '}
                            Los comprobantes emitidos se enviarán a SUNAT vía NubeFact.
                            La serie y correlativo configurados arriba deben coincidir con los registrados en NubeFact.
                        </p>
                    </div>
                ) : (
                    <div className="mt-6 p-4 rounded-lg flex items-start gap-3 bg-amber-50 border border-amber-200">
                        <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-700">
                            <span className="font-semibold">Aviso sobre comprobantes:</span>{' '}
                            Los comprobantes generados son para control interno del negocio y no tienen validez tributaria
                            ante SUNAT. Active la integración en la sección de Facturación Electrónica para emitir CPE válidos.
                        </p>
                    </div>
                )}

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 2B — Facturación Electrónica SUNAT / NubeFact
            ══════════════════════════════════════════════════════════ */}
            <div className="card mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <FileText size={20} className="text-purple-500" />
                    <h2 className="text-lg font-bold">Facturación Electrónica (SUNAT)</h2>
                </div>
                <p className="text-sm text-slate-500 mb-5">
                    Integración con NubeFact para emitir boletas y facturas electrónicas válidas ante SUNAT.
                    Requiere cuenta activa en <strong>nubefact.com</strong>.
                </p>

                {/* Toggle activar */}
                <div className="flex items-center gap-3 mb-5">
                    <input
                        type="checkbox"
                        id="sunat_activo"
                        checked={config.sunat_activo === '1'}
                        onChange={e => handleChange('sunat_activo', e.target.checked ? '1' : '0')}
                        style={{ width: 16, height: 16, accentColor: '#735DFF', cursor: 'pointer' }}
                    />
                    <label htmlFor="sunat_activo" className="text-sm font-semibold text-slate-700" style={{ cursor: 'pointer' }}>
                        Activar emisión electrónica via NubeFact
                    </label>
                    {config.sunat_activo === '1' && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 20, padding: '2px 10px' }}>
                            ACTIVO
                        </span>
                    )}
                </div>

                {/* Campos solo visibles si está activo */}
                {config.sunat_activo === '1' && (
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="form-label">Proveedor CPE</label>
                            <select
                                className="form-input"
                                value={config.cpe_proveedor || 'nubefact'}
                                onChange={e => handleChange('cpe_proveedor', e.target.value)}
                            >
                                <option value="nubefact">NubeFact</option>
                            </select>
                            <p className="text-xs text-slate-400 mt-1">La arquitectura queda preparada para agregar otro PSE sin cambiar el flujo de ventas.</p>
                        </div>
                        <div>
                            <label className="form-label">URL del API NubeFact</label>
                            <input
                                className="form-input"
                                value={config.sunat_url || ''}
                                onChange={e => handleChange('sunat_url', e.target.value)}
                                placeholder="https://api.nubefact.com/api/v1/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            />
                            <p className="text-xs text-slate-400 mt-1">La URL única de tu empresa en NubeFact. La encuentras en tu panel → Empresas → Ver API.</p>
                        </div>
                        <div>
                            <label className="form-label">Token de autenticación</label>
                            <input
                                className="form-input font-mono text-xs"
                                type="password"
                                value={sunatTokenNuevo}
                                onChange={e => { setSunatTokenNuevo(e.target.value); setHayDatosPendientes(true); }}
                                placeholder={config.sunat_token_configurado === '1' ? (config.sunat_token_masked || 'Token configurado') : 'Pegar nuevo token NubeFact'}
                            />
                            <p className="text-xs text-slate-400 mt-1">Token secreto de NubeFact. Trátalo como una contraseña.</p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={(config.cpe_envio_email_cliente || '1') === '1'}
                                onChange={e => handleChange('cpe_envio_email_cliente', e.target.checked ? '1' : '0')}
                                style={{ width: 16, height: 16, accentColor: '#735DFF', cursor: 'pointer' }}
                            />
                            <span className="text-sm text-slate-700">Enviar automaticamente el PDF al email del cliente cuando tenga correo registrado</span>
                        </label>
                        <div className="flex justify-start">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleProbarCPE}
                                disabled={probandoCpe || hayDatosPendientes || !!sunatTokenNuevo.trim()}
                                title={hayDatosPendientes || sunatTokenNuevo.trim() ? 'Guarda los cambios antes de probar' : 'Probar conexion con proveedor CPE'}
                            >
                                <CheckCircle size={14} />
                                {probandoCpe ? 'Probando...' : 'Probar conexion'}
                            </button>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2">
                            <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-blue-700">
                                El modo demo o producción lo controla <strong>NubeFact</strong> desde su panel web
                                (Empresas → Pase a Producción). Mientras no hayas activado producción en NubeFact,
                                todos los comprobantes son de prueba y no tienen validez ante SUNAT.
                            </p>
                        </div>
                        </div>
                )}
                {/* ── Formato del PDF electrónico ── */}
<div>
    <div className="flex items-center gap-3 mb-3" style={{ marginTop: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#735DFF', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, whiteSpace: 'nowrap' }}>
            Representación impresa
        </p>
        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
    </div>
    <label className="form-label">Formato del PDF electrónico (NubeFact)</label>
    <select
        className="form-input"
        value={config.cpe_formato_pdf || 'A4'}
        onChange={e => handleChange('cpe_formato_pdf', e.target.value)}
    >
        <option value="A4">A4 — Hoja completa (21 × 29.7 cm)</option>
        <option value="A5">A5 — Media hoja (14.8 × 21 cm)</option>
        <option value="TICKET">Ticket — Papel térmico (80 mm)</option>
    </select>
    <p className="text-xs text-slate-400 mt-1">
        Define el tamaño del PDF que NubeFact genera y envía por correo al cliente.
        El ticket térmico es ideal si tu negocio usa impresora POS.
    </p>
</div>
            </div>

            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 3 — Ticket térmico
            ══════════════════════════════════════════════════════════ */}
            <div className="card mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <Printer size={20} className="text-purple-500" />
                    <h2 className="text-lg font-bold">Ticket térmico</h2>
                </div>
                <p className="text-sm text-slate-500 mb-5">
                    Configura el formato de impresión para impresoras térmicas (POS).
                </p>

                {/* Ancho del papel */}
                <div className="flex items-center gap-3 mb-4">
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#735DFF', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, whiteSpace: 'nowrap' }}>Papel</p>
                    <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                        <label className="form-label">Ancho del papel</label>
                        <select
                            className="form-input"
                            value={config.ticket_ancho || '80'}
                            onChange={e => handleChange('ticket_ancho', e.target.value)}
                        >
                            <option value="58">58 mm (pequeño)</option>
                            <option value="80">80 mm (estándar)</option>
                        </select>
                        <p className="text-xs text-slate-400 mt-1">El 80 mm es el más común en impresoras POS de escritorio.</p>
                    </div>
                    <div>
                        <label className="form-label">Mostrar desglose IGV</label>
                        <div className="flex items-center gap-3 mt-2">
                            <input
                                type="checkbox"
                                id="ticket_igv"
                                checked={config.ticket_mostrar_igv === '1' || config.ticket_mostrar_igv === true}
                                onChange={e => handleChange('ticket_mostrar_igv', e.target.checked ? '1' : '0')}
                                style={{ width: 16, height: 16, accentColor: '#735DFF', cursor: 'pointer' }}
                            />
                            <label htmlFor="ticket_igv" className="text-sm text-slate-600" style={{ cursor: 'pointer' }}>
                                Mostrar subtotal e IGV en el ticket
                            </label>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">Si está desactivado, solo se muestra el total.</p>
                    </div>
                    <div className="col-span-2">
                        <label className="form-label">N° de serie de máquina registradora</label>
                        <input
                            className="form-input"
                            value={config.ticket_serie_maquina || ''}
                            onChange={e => handleChange('ticket_serie_maquina', e.target.value)}
                            placeholder="Ej: POS-001"
                            maxLength={20}
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Requerido por SUNAT. Identifica el terminal POS emisor del ticket.
                        </p>
                    </div>
                </div>

                {/* Logo */}
                <div className="flex items-center gap-3 mb-4">
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#735DFF', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, whiteSpace: 'nowrap' }}>Logo</p>
                    <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>
                <div className="flex items-start gap-5 mb-5">
                    {/* Preview */}
                    <div style={{ width: 100, height: 100, border: '2px dashed #e2e8f0', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F7FF', flexShrink: 0, overflow: 'hidden' }}>
                        {config.ticket_logo
                            ? <img src={config.ticket_logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            : <Image size={28} style={{ color: '#cbd5e1' }} />
                        }
                    </div>
                    <div className="flex flex-col gap-2 justify-center" style={{ paddingTop: 8 }}>
                        <button
                            className="btn btn-secondary"
                            onClick={handleSeleccionarLogo}
                            disabled={subiendoLogo}
                            style={{ fontSize: 13 }}
                        >
                            <Image size={14} />
                            {subiendoLogo ? 'Cargando...' : config.ticket_logo ? 'Cambiar logo' : 'Seleccionar logo'}
                        </button>
                        {config.ticket_logo && (
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleChange('ticket_logo', '')}
                                style={{ fontSize: 13, color: '#FF4B6C', borderColor: 'rgba(255,75,108,0.3)' }}
                            >
                                Quitar logo
                            </button>
                        )}
                        <p className="text-xs text-slate-400">PNG o JPG. Se redimensiona automáticamente.</p>
                    </div>
                </div>

                {/* Mensaje pie */}
                <div className="flex items-center gap-3 mb-4">
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#735DFF', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, whiteSpace: 'nowrap' }}>Pie de ticket</p>
                    <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>
                <div>
                    <label className="form-label">Mensaje de cierre</label>
                    <input
                        className="form-input"
                        value={config.ticket_mensaje_pie || ''}
                        onChange={e => handleChange('ticket_mensaje_pie', e.target.value)}
                        placeholder="Ej: ¡Gracias por su compra! Vuelva pronto."
                        maxLength={100}
                    />
                    <p className="text-xs text-slate-400 mt-1">Aparece al final del ticket. Máximo 100 caracteres.</p>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 4 — Copias de seguridad
            ══════════════════════════════════════════════════════════ */}
            <div className="card mb-6">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div style={{ background: 'linear-gradient(135deg, #735DFF 0%, #C516E1 100%)', borderRadius: 10, padding: '7px 9px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(115,93,255,0.25)' }}>
                            <Shield size={17} color="white" />
                        </div>
                        <h2 className="text-lg font-bold">Copias de seguridad</h2>
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="btn btn-secondary"
                            onClick={abrirRestore}
                            style={{ fontSize: 12, padding: '6px 12px' }}
                        >
                            <RotateCcw size={13} /> Restaurar
                        </button>
                        {/* FIX 10 — Ícono DatabaseBackup es semánticamente correcto: generar ≠ descargar */}
                        <button
                            className="btn btn-primary"
                            onClick={handleBackupManual}
                            disabled={generandoBackup}
                            style={{ fontSize: 13, padding: '6px 14px' }}
                        >
                            <DatabaseBackup size={14} />
                            {generandoBackup ? 'Generando...' : 'Generar copia ahora'}
                        </button>
                    </div>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                    El sistema guarda copias automáticas cada 30 min y una diaria por los últimos 30 días.
                    Use <strong>"Generar copia ahora"</strong> antes de hacer cambios importantes.
                </p>

                {loadingBackups ? (
                    <p className="text-sm text-slate-400">Cargando...</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>

                        {/* Último backup diario */}
                        {(() => {
                            const estado = estadoBackup(backups.ultimoDiario?.fecha_archivo);
                            return (
                                <div style={{ background: '#F8F7FF', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Clock size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                                        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Último backup diario</p>
                                    </div>
                                    {backups.ultimoDiario ? (
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: 3 }}>{formatFecha(backups.ultimoDiario.fecha_archivo)}</p>
                                                {/* FIX 5 — Antigüedad relativa junto al tamaño */}
                                                <p className="text-xs text-slate-400">
                                                    {formatAntiguedad(backups.ultimoDiario.fecha_archivo)} · {backups.ultimoDiario.tamano_kb} KB
                                                </p>
                                            </div>
                                            {estado.icono === 'ok'   && <CheckCircle size={18} style={{ color: estado.color, flexShrink: 0 }} />}
                                            {estado.icono === 'warn' && <Clock        size={18} style={{ color: estado.color, flexShrink: 0 }} />}
                                            {estado.icono === 'error'&& <AlertCircle  size={18} style={{ color: estado.color, flexShrink: 0 }} />}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400">Sin backups aún</p>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Último backup manual */}
                        {(() => {
                            const estado = estadoBackup(backups.ultimoManual?.fecha_archivo);
                            return (
                                <div style={{ background: '#F8F7FF', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <DatabaseBackup size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                                        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Último backup manual</p>
                                    </div>
                                    {backups.ultimoManual ? (
                                        <>
                                            <div className="flex items-start justify-between gap-2" style={{ marginBottom: 10 }}>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-700" style={{ marginBottom: 3 }}>{formatFecha(backups.ultimoManual.fecha_archivo)}</p>
                                                    {/* FIX 5 — Antigüedad relativa junto al tamaño */}
                                                    <p className="text-xs text-slate-400">
                                                        {formatAntiguedad(backups.ultimoManual.fecha_archivo)} · {backups.ultimoManual.tamano_kb} KB
                                                    </p>
                                                </div>
                                                {estado.icono === 'ok'   && <CheckCircle size={18} style={{ color: estado.color, flexShrink: 0 }} />}
                                                {estado.icono === 'warn' && <Clock        size={18} style={{ color: estado.color, flexShrink: 0 }} />}
                                                {estado.icono === 'error'&& <AlertCircle  size={18} style={{ color: estado.color, flexShrink: 0 }} />}
                                            </div>
                                            
                                                <button
                                                onClick={async () => {
                                                    try {
                                                        const archivo = ultimoGenerado || backups.ultimoManual.archivo;
                                                        const resp = await api.get(`/backups/descargar?archivo=${encodeURIComponent(archivo)}&tipo=manual`, { responseType: 'blob' });
                                                        const url  = URL.createObjectURL(resp.data);
                                                        const a    = document.createElement('a');
                                                        a.href     = url;
                                                        a.download = archivo;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                    } catch {
                                                        toast('Error al descargar el backup', 'error');
                                                    }
                                                }}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#735DFF', background: 'rgba(115,93,255,0.08)', borderRadius: 6, padding: '4px 10px', border: 'none', cursor: 'pointer' }}
                                            >
                                                <DatabaseBackup size={12} /> Descargar para USB
                                            </button>
                                        </>
                                    ) : (
                                        <p className="text-sm text-slate-400">Sin copias manuales aún</p>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 3B — Actualización de software
            ══════════════════════════════════════════════════════════ */}
            {window.electronAPI?.isElectron && (
                <div className="card mb-6">
                    <div className="flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 16 }}>
                        <div className="flex items-center gap-2">
                            <RotateCcw size={20} className="text-purple-500" />
                            <h2 className="text-lg font-bold text-slate-800">Actualización de Software</h2>
                        </div>
                        <span className="badge badge-info">v{diagReport?.app_version || '1.2.1'}</span>
                    </div>

                    <p className="text-sm text-slate-500 mb-4">
                        Busca e instala las últimas actualizaciones del sistema directamente desde GitHub Releases.
                    </p>

                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <button
                                className="btn btn-primary"
                                onClick={buscarActualizaciones}
                                disabled={updaterStatus === 'checking' || updaterStatus === 'downloading'}
                            >
                                <RotateCcw size={16} />
                                {updaterStatus === 'checking' ? 'Buscando...' : 'Buscar actualizaciones'}
                            </button>

                            {updaterStatus === 'available' && (
                                <button className="btn btn-success" onClick={descargarActualizacion}>
                                    Descargar actualización
                                </button>
                            )}

                            {updaterStatus === 'downloaded' && (
                                <button className="btn btn-success" onClick={instalarActualizacion}>
                                    Instalar y Reiniciar
                                </button>
                            )}
                        </div>

                        {updaterStatus && (
                            <div className="p-3 rounded-lg" style={{ background: '#F8F7FF', border: '1px solid #e2e8f0' }}>
                                <p className="text-sm font-semibold text-slate-700">
                                    {updaterStatus === 'checking' && 'Buscando nuevas versiones en el servidor...'}
                                    {updaterStatus === 'not-available' && 'Tu sistema se encuentra actualizado en la última versión.'}
                                    {updaterStatus === 'available' && `¡Nueva versión disponible: v${updaterInfo?.version}!`}
                                    {updaterStatus === 'downloading' && `Descargando actualización: ${downloadPercent}%`}
                                    {updaterStatus === 'downloaded' && 'Descarga completada. El sistema está listo para instalar.'}
                                    {updaterStatus === 'error' && `Error al actualizar: ${updaterError}`}
                                </p>
                                {updaterStatus === 'downloading' && (
                                    <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                                        <div style={{ width: `${downloadPercent}%`, height: '100%', background: '#735DFF', borderRadius: '3px', transition: 'width 0.2s' }} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 3C — Panel de Diagnóstico
            ══════════════════════════════════════════════════════════ */}
            <div className="card mb-6">
                <div className="flex items-center justify-between mb-4" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                    <div className="flex items-center gap-2">
                        <Settings size={20} className="text-purple-500" />
                        <h2 className="text-lg font-bold text-slate-800">Panel de Diagnóstico del Sistema</h2>
                    </div>
                    <button 
                        className="btn btn-secondary btn-sm"
                        onClick={cargarDiagnostico}
                        disabled={loadingDiag}
                    >
                        <RotateCcw size={12} /> Refrescar
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="form-label">Ruta de Base de Datos</label>
                        <div className="flex gap-2 items-center">
                            <input
                                className="form-input"
                                readOnly
                                value={diagReport?.db_path || 'Cargando...'}
                                style={{ fontFamily: 'monospace', fontSize: '11px', background: '#F8F7FF' }}
                            />
                            <button
                                className="btn btn-secondary"
                                style={{ padding: '10px' }}
                                onClick={() => copiarAlPortapapeles(diagReport?.db_path)}
                                title="Copiar ruta"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="form-label">Ruta de Log de Errores</label>
                        <div className="flex gap-2 items-center">
                            <input
                                className="form-input"
                                readOnly
                                value={diagReport?.log_path || 'Cargando...'}
                                style={{ fontFamily: 'monospace', fontSize: '11px', background: '#F8F7FF' }}
                            />
                            <button
                                className="btn btn-secondary"
                                style={{ padding: '10px' }}
                                onClick={() => copiarAlPortapapeles(diagReport?.log_path)}
                                title="Copiar ruta"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 mb-6">
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            if (diagReport?.log_path) {
                                window.electronAPI.openExternal('file://' + diagReport.log_path);
                            } else {
                                toast('Ruta de log no disponible', 'warning');
                            }
                        }}
                    >
                        <FileText size={16} /> Ver log en vivo
                    </button>

                    <button
                        className="btn btn-primary"
                        onClick={handleExportarSoporte}
                        disabled={exportandoSoporte}
                    >
                        <DatabaseBackup size={16} />
                        {exportandoSoporte ? 'Exportando...' : 'Exportar paquete de soporte'}
                    </button>
                </div>

                {/* Integridad de la Base de Datos */}
                <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Estado de la Base de Datos</h3>
                    {loadingDiag ? (
                        <p className="text-sm text-slate-400">Verificando integridad...</p>
                    ) : diagReport?.db_integridad === 'ok' ? (
                        <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46' }}>
                            <CheckCircle size={18} />
                            <span className="text-sm font-medium">Base de datos íntegra e intacta.</span>
                        </div>
                    ) : (
                        <div className="p-3 rounded-lg flex flex-col gap-2" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B' }}>
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={18} />
                                <span className="text-sm font-bold">Error de Integridad detectado!</span>
                            </div>
                            <p className="text-xs font-semibold">
                                Detalle: {diagReport?.db_integridad || 'Fallo desconocido'}.
                            </p>
                            <div className="mt-1 p-2 rounded bg-white text-red-700 text-xs font-bold border border-red-200" style={{ borderLeft: '4px solid #FF4B6C' }}>
                                Instrucción: Exporta un paquete de soporte y contacta al proveedor.
                            </div>
                        </div>
                    )}
                </div>

                {/* Comprobantes stuck */}
                {!loadingDiag && diagReport?.cpe_pendientes > 0 && (
                    <div className="p-3 rounded-lg flex flex-col gap-1 mt-4" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                        <div className="flex items-center gap-2">
                            <Clock size={18} />
                            <span className="text-sm font-bold">¡Alerta de Facturación CPE!</span>
                        </div>
                        <p className="text-xs">
                            Se detectaron {diagReport.cpe_pendientes} comprobante(s) en estado "ENVIANDO" por más de 10 minutos. Esto puede indicar problemas de conexión o con el proveedor CPE.
                        </p>
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECCIÓN 4 — Zona de peligro
            ══════════════════════════════════════════════════════════ */}
            <div className="card mb-6" style={{ borderLeft: '4px solid #FF4B6C', borderRadius: '0 16px 16px 0' }}>
                <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={20} className="text-red-500" />
                    <h2 className="text-lg font-bold text-red-700">Zona de peligro</h2>
                </div>
                <p className="text-sm text-slate-500 mb-5">
                    Estas acciones modifican permanentemente los datos del sistema. Se recomienda generar una copia de seguridad antes de continuar.
                </p>

                {/* FIX 6 — Grilla adaptativa: 2 col si hay demo, 1 col centrada si solo hay reset */}
                <div className={`grid gap-4 ${mostrarDemo === true ? 'grid-cols-2' : 'grid-cols-1 max-w-md'}`}>

                    {/* Cargar demo — solo visible si el sistema está vacío */}
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

            {/* ══════════════════════════════════════════════════════════
                MODAL — Flujo de restauración (3 pasos)
            ══════════════════════════════════════════════════════════ */}
            {pasoRestore > 0 && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Restaurar copia de seguridad"
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                >

                    {/* PASO 1: Contraseña */}
                    {pasoRestore === 1 && (
                        <div className="card" style={{ width: 460, maxWidth: '92vw', padding: 32 }}>
                            {/* Cabecera */}
                            <div className="flex items-center gap-3 mb-6">
                                <div style={{ background: 'rgba(245,158,11,0.12)', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Lock size={20} style={{ color: '#F59E0B' }} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1D1136' }}>Restaurar copia de seguridad</h3>
                                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Paso 1 de 3 — Verificación</p>
                                </div>
                            </div>

                            {/* Aviso */}
                            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: '#b45309', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <AlertTriangle size={14} /> Acción sensible
                                </p>
                                <p style={{ fontSize: 13, color: '#d97706', margin: 0, lineHeight: 1.6 }}>
                                    Restaurar reemplaza <strong>todos los datos actuales</strong> con los del backup elegido.
                                    Solo el administrador puede realizar esta acción.
                                </p>
                            </div>

                            {/* Campo contraseña */}
                            <label className="form-label" style={{ marginBottom: 8 }}>Contraseña de administrador</label>
                            <div style={{ position: 'relative', marginBottom: 24 }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="Ingrese su contraseña para continuar"
                                    value={passwordRestore}
                                    onChange={e => setPasswordRestore(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleVerificarPassword()}
                                    autoFocus
                                    style={{ paddingRight: 40 }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {/* Botones */}
                            <div className="flex gap-3 justify-end">
                                <button className="btn btn-secondary" onClick={cerrarRestore} disabled={verificandoPass}>Cancelar</button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleVerificarPassword}
                                    disabled={verificandoPass || !passwordRestore}
                                >
                                    {verificandoPass ? 'Verificando...' : 'Continuar →'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: Elegir backup */}
                    {pasoRestore === 2 && (
                        <div className="card" style={{ width: 580, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <RotateCcw size={18} className="text-indigo-500" />
                                    <h3 className="text-lg font-bold">Elegir punto de restauración</h3>
                                </div>
                                <button
                                    onClick={cerrarRestore}
                                    aria-label="Cerrar"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8', lineHeight: 1 }}
                                >✕</button>
                            </div>
                            <p className="text-sm text-slate-500 mb-4">
                                Seleccione un punto de restauración — mostrando los 3 más recientes:
                            </p>

                            {/* Tabs */}
                            <div className="flex gap-1 mb-3" style={{ borderBottom: '2px solid #e2e8f0' }}>
                                {['diarios', 'manuales'].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => { setTabBackup(tab); setVisiblesBackup(3); }}
                                        style={{
                                            padding: '6px 14px', borderRadius: '6px 6px 0 0', fontSize: 12,
                                            fontWeight: tabBackup === tab ? 700 : 400,
                                            background: tabBackup === tab ? '#735DFF' : 'transparent',
                                            color: tabBackup === tab ? 'white' : '#64748b',
                                            border: 'none', cursor: 'pointer', marginBottom: -2,
                                        }}
                                    >
                                        {{ diarios: 'Diarios (30 días)', manuales: 'Manuales' }[tab]}
                                    </button>
                                ))}
                            </div>

                            <div style={{ overflowY: 'auto', flex: 1 }}>
                                {(backupsDisponibles[tabBackup] || []).length === 0 ? (
                                    <p className="text-center text-slate-400 py-8 text-sm">No hay copias en esta categoría</p>
                                ) : (() => {
                                    const todos      = backupsDisponibles[tabBackup] || [];
                                    const visibles   = todos.slice(0, visiblesBackup);
                                    const restantes  = todos.length - visibles.length;
                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {visibles.map(b => (
                                                <div
                                                    key={b.archivo}
                                                    onClick={() => seleccionarBackup(b)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                                                        background: '#F8F7FF',
                                                        border: '1px solid #e2e8f0',
                                                        transition: 'all 0.15s',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#735DFF'; e.currentTarget.style.background = 'rgba(115,93,255,0.04)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#F8F7FF'; }}
                                                >
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-700">{formatFecha(b.fecha_archivo)}</p>
                                                        <p className="text-xs text-slate-400">
                                                            {formatAntiguedad(b.fecha_archivo)} · {b.tamano_kb} KB
                                                        </p>
                                                    </div>
                                                    <span style={{ fontSize: 11, color: '#735DFF', fontWeight: 600 }}>Seleccionar →</span>
                                                </div>
                                            ))}
                                            {restantes > 0 && (
                                                <button
                                                    onClick={() => setVisiblesBackup(v => v + 5)}
                                                    style={{
                                                        background: 'none', border: '1px dashed #e2e8f0',
                                                        borderRadius: 10, padding: '10px 16px', cursor: 'pointer',
                                                        fontSize: 12, color: '#735DFF', fontWeight: 600,
                                                        transition: 'border-color 0.15s',
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.borderColor = '#735DFF'}
                                                    onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                                >
                                                    Ver más ({restantes} restante{restantes !== 1 ? 's' : ''})
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="flex justify-start mt-3">
                                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setPasoRestore(1)}>← Volver</button>
                            </div>
                        </div>
                    )}

                    {/* PASO 3: Confirmación escrita */}
                    {pasoRestore === 3 && backupSeleccionado && (
                        <div className="card" style={{ width: 480, maxWidth: '92vw' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle size={20} className="text-red-500" />
                                <h3 className="text-lg font-bold text-red-700">Confirmar restauración</h3>
                            </div>

                            <p className="text-sm text-slate-600 mb-1">Se restaurará desde:</p>
                            <p className="text-xs font-mono font-bold mb-3 p-2 rounded" style={{ background: 'rgba(115,93,255,0.08)', color: '#735DFF', wordBreak: 'break-all' }}>
                                {backupSeleccionado.archivo}
                            </p>
                            <p className="text-sm text-slate-600 mb-1">Fecha del backup:</p>
                            <p className="text-sm font-semibold text-slate-700 mb-3">{formatFecha(backupSeleccionado.fecha_archivo)}</p>

                            <div className="p-3 rounded-lg mb-4" style={{ background: 'rgba(255,75,108,0.06)', border: '1px solid rgba(255,75,108,0.25)' }}>
                                <p className="text-sm font-semibold text-red-700 mb-1">Esta acción no se puede deshacer</p>
                                <p className="text-sm text-red-600">
                                    Todos los datos posteriores a esa fecha se perderán. El sistema guardará
                                    una copia del estado actual antes de proceder.
                                </p>
                            </div>

                            <p className="text-sm text-slate-600 mb-1">
                                Escriba <strong className="text-red-600 font-mono">RESTAURAR</strong> para confirmar:
                            </p>
                            <input
                                type="text"
                                className="input w-full mb-4"
                                placeholder="RESTAURAR"
                                value={confirmTexto}
                                onChange={e => setConfirmTexto(e.target.value)}
                                style={{ fontFamily: 'monospace', letterSpacing: 2 }}
                                autoFocus
                            />

                            <div className="flex gap-3 justify-between">
                                <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setPasoRestore(2)} disabled={restaurando}>
                                    ← Volver
                                </button>
                                <div className="flex gap-2">
                                    <button className="btn btn-secondary" onClick={cerrarRestore} disabled={restaurando}>Cancelar</button>
                                    <button
                                        className={`btn ${confirmTexto === 'RESTAURAR' ? 'btn-danger' : 'btn-secondary'}`}
                                        style={{ cursor: confirmTexto === 'RESTAURAR' ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
                                        onClick={handleRestaurar}
                                        disabled={restaurando || confirmTexto !== 'RESTAURAR'}
                                    >
                                        <RotateCcw size={14} />
                                        {restaurando ? 'Restaurando...' : 'Confirmar restauración'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                MODAL — Confirmar cargar demo
            ══════════════════════════════════════════════════════════ */}
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
                        {/* FIX 7 — Checkbox de confirmación, consistente con el modal de reset */}
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

            {/* ══════════════════════════════════════════════════════════
                MODAL — Confirmar restablecer
            ══════════════════════════════════════════════════════════ */}
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

                        {/* PASO 1 — Contraseña */}
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
                                    <button className="btn btn-secondary" onClick={() => { setModalReset(false); setPasswordReset(''); setResetAutorizado(false); }} disabled={verificandoReset}>
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

                        {/* PASO 2 — Confirmación */}
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
                                    <button className="btn btn-secondary" onClick={() => { setModalReset(false); setConfirmText(''); setPasswordReset(''); setResetAutorizado(false); }} disabled={procesando}>
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

            {/* ══════════════════════════════════════════════════════════
                FIX 1 & 2 — Barra flotante de guardado
                Aparece en la parte inferior cuando hay cambios pendientes,
                visible sin importar el scroll. Reemplaza al botón que
                antes solo existía en la cabecera de la sección 1.
            ══════════════════════════════════════════════════════════ */}
            {hayDatosPendientes && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 28,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        color: '#fff',
                        borderRadius: 14,
                        padding: '10px 14px 10px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
                        zIndex: 900,
                        whiteSpace: 'nowrap',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <div className="flex items-center gap-2">
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fbbf24', display: 'inline-block', boxShadow: '0 0 6px #fbbf24' }} />
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>Tienes cambios sin guardar</span>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                        style={{ fontSize: 13, padding: '6px 16px', borderRadius: 8 }}
                    >
                        <Save size={14} />
                        {saving ? 'Guardando...' : 'Guardar ahora'}
                    </button>
                </div>
            )}

        </div>
    );
}
