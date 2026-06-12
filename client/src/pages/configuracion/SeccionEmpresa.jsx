import { Building2 } from 'lucide-react';

export default function SeccionEmpresa({ config, hayDatosPendientes, handleChange }) {
    return (
        <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Building2 size={20} className="text-purple-500" />
                    <h2 className="text-lg font-bold">Datos de la empresa</h2>
                </div>
                {hayDatosPendientes && (
                    <span style={{
                        fontSize: 11, fontWeight: 600, color: '#92400e',
                        background: '#fffbeb', border: '1px solid #fcd34d',
                        borderRadius: 20, padding: '3px 10px',
                        display: 'flex', alignItems: 'center', gap: 5, letterSpacing: '0.01em',
                    }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
                        Sin guardar
                    </span>
                )}
            </div>

            {/* Identificación */}
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
    );
}