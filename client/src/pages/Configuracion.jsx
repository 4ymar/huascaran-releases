import { useState, useEffect, useCallback } from 'react';
import { Save, Settings } from 'lucide-react';
import { useToast } from '../components/Toast';
import { getConfig, updateConfig, updateSunatToken, getBackups, crearBackup } from '../services/api';

import ConfigSidebar      from './configuracion/ConfigSidebar';
import SeccionEmpresa     from './configuracion/SeccionEmpresa';
import SeccionComprobantes from './configuracion/SeccionComprobantes';
import SeccionTicket      from './configuracion/SeccionTicket';
import SeccionCatalogo from './configuracion/SeccionCatalogo';
import SeccionBackups     from './configuracion/SeccionBackups';
import SeccionSistema     from './configuracion/SeccionSistema';
import ZonaPeligro        from './configuracion/ZonaPeligro';

export default function Configuracion() {
    const toast = useToast();

    // ── Estado global (solo lo que se comparte entre secciones) ─────────────
    const [config, setConfig]                     = useState(null);
    const [loading, setLoading]                   = useState(true);
    const [saving, setSaving]                     = useState(false);
    const [hayDatosPendientes, setHayDatosPendientes] = useState(false);
    const [sunatTokenNuevo, setSunatTokenNuevo]   = useState('');
    const [probandoCpe, setProbandoCpe]           = useState(false);
    const [subiendoLogo, setSubiendoLogo]         = useState(false);

    // ── Estado backups (se pasa a SeccionBackups) ────────────────────────────
    const [backups, setBackups]                   = useState({ ultimoDiario: null, ultimoManual: null });
    const [loadingBackups, setLoadingBackups]     = useState(false);
    const [generandoBackup, setGenerandoBackup]   = useState(false);
    const [ultimoGenerado, setUltimoGenerado]     = useState(null);

    // ── Sección activa del nav lateral ───────────────────────────────────────
    const [seccionActiva, setSeccionActiva]       = useState('empresa');

    // ── Carga inicial ────────────────────────────────────────────────────────
    useEffect(() => {
        getConfig()
            .then(data => setConfig(data))
            .catch(err => console.error('Error cargando configuración:', err))
            .finally(() => setLoading(false));
    }, []);

    const cargarBackups = useCallback(async () => {
        setLoadingBackups(true);
        try {
            const data = await getBackups();
            setBackups(data);
        } catch { /* silencioso */ }
        finally { setLoadingBackups(false); }
    }, []);

    useEffect(() => { cargarBackups(); }, [cargarBackups]);

    // ── Handlers compartidos ─────────────────────────────────────────────────
    const handleChange = (field, value) => {
        setConfig(prev => ({ ...prev, [field]: value }));
        setHayDatosPendientes(true);
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
        } catch {
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
            const { probarConfiguracionCPE } = await import('../services/api');
            await probarConfiguracionCPE();
            toast('Conexion con proveedor CPE disponible', 'success');
        } catch (err) {
            toast(err.response?.data?.error || 'No se pudo probar la configuracion CPE', 'error');
        } finally {
            setProbandoCpe(false);
        }
    };

    const handleSeleccionarLogo = async () => {
        setSubiendoLogo(true);
        try {
            const result = await window.electronAPI.selectImage();
            if (!result?.ok) return;
            const img = new window.Image();
            img.onload = () => {
                const MAX    = 400;
                const scale  = img.width > MAX ? MAX / img.width : 1;
                const canvas = document.createElement('canvas');
                canvas.width  = Math.round(img.width  * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                handleChange('ticket_logo', canvas.toDataURL('image/png'));
            };
            img.src = result.base64;
        } catch {
            toast('Error al cargar la imagen', 'error');
        } finally {
            setSubiendoLogo(false);
        }
    };

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

    // ── Render de la sección activa ──────────────────────────────────────────
    const renderSeccion = () => {
        if (!config) return null;
        switch (seccionActiva) {
            case 'empresa':
                return (
                    <SeccionEmpresa
                        config={config}
                        hayDatosPendientes={hayDatosPendientes}
                        handleChange={handleChange}
                    />
                );
            case 'comprobantes':
                return (
                    <SeccionComprobantes
                        config={config}
                        handleChange={handleChange}
                        hayDatosPendientes={hayDatosPendientes}
                        sunatTokenNuevo={sunatTokenNuevo}
                        onTokenChange={(val) => {
                            setSunatTokenNuevo(val);
                            setHayDatosPendientes(true);
                        }}
                        probandoCpe={probandoCpe}
                        handleProbarCPE={handleProbarCPE}
                    />
                );
            case 'catalogo':
                return <SeccionCatalogo />;
            case 'ticket':
                return (
                    <SeccionTicket
                        config={config}
                        handleChange={handleChange}
                        handleSeleccionarLogo={handleSeleccionarLogo}
                        subiendoLogo={subiendoLogo}
                    />
                );
            case 'backups':
                return (
                    <SeccionBackups
                        backups={backups}
                        loadingBackups={loadingBackups}
                        generandoBackup={generandoBackup}
                        ultimoGenerado={ultimoGenerado}
                        handleBackupManual={handleBackupManual}
                    />
                );
            case 'sistema':
                return <SeccionSistema />;
            case 'peligro':
                return <ZonaPeligro />;
            default:
                return null;
        }
    };

    if (loading) return <div className="loader"><div className="spinner"></div></div>;

    // Barra de guardado solo visible en secciones con campos editables
    const seccionesConGuardado = ['empresa', 'comprobantes', 'ticket'];
    const mostrarBarraGuardado = hayDatosPendientes && seccionesConGuardado.includes(seccionActiva);

    return (
        <div className="page-enter">

            {/* Cabecera */}
            <div className="page-header" style={{ marginBottom: 28 }}>
                <div className="flex items-start gap-4">
                    <div style={{
                        background: 'linear-gradient(135deg, #735DFF 0%, #C516E1 100%)',
                        borderRadius: 14, padding: '10px 12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, boxShadow: '0 4px 14px rgba(115,93,255,0.35)',
                    }}>
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

            {/* Layout dos columnas */}
            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

                {/* Nav lateral */}
                <ConfigSidebar
                    activo={seccionActiva}
                    onChange={(id) => setSeccionActiva(id)}
                />

                {/* Contenido de la sección activa */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {renderSeccion()}
                </div>
            </div>

            {/* Barra flotante de guardado */}
            {mostrarBarraGuardado && (
                <div style={{
                    position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    color: '#fff', borderRadius: 14, padding: '10px 14px 10px 18px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
                    zIndex: 900, whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.08)',
                }}>
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