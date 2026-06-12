import { Building2, FileText, Printer, Shield, Settings, AlertTriangle, LayoutGrid } from 'lucide-react';

const SECCIONES = [
    {
        id: 'empresa',
        label: 'Empresa',
        descripcion: 'Datos fiscales y ubicación',
        icono: Building2,
        color: '#735DFF',
    },
    {
        id: 'comprobantes',
        label: 'Comprobantes',
        descripcion: 'Series, correlativos y SUNAT',
        icono: FileText,
        color: '#735DFF',
    },
    {
        id: 'ticket',
        label: 'Ticket térmico',
        descripcion: 'Impresora POS y logo',
        icono: Printer,
        color: '#735DFF',
    },
    {
        id: 'catalogo',
        label: 'Catálogo',
        descripcion: 'Categorías de productos',
        icono: LayoutGrid,
        color: '#735DFF',
    },
    {
        id: 'backups',
        label: 'Copias de seguridad',
        descripcion: 'Backups y restauración',
        icono: Shield,
        color: '#735DFF',
    },
    {
        id: 'sistema',
        label: 'Sistema',
        descripcion: 'Actualizaciones y diagnóstico',
        icono: Settings,
        color: '#735DFF',
    },
    {
        id: 'peligro',
        label: 'Zona de peligro',
        descripcion: 'Restablecer o cargar demo',
        icono: AlertTriangle,
        color: '#FF4B6C',
    },
];

export default function ConfigSidebar({ activo, onChange }) {
    return (
        <nav
            style={{
                width: 220,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
            }}
        >
            {SECCIONES.map(({ id, label, descripcion, icono: Icono, color }) => {
                const estaActivo = activo === id;
                const esPeligro  = id === 'peligro';

                return (
                    <button
                        key={id}
                        onClick={() => onChange(id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s',
                            background: estaActivo
                                ? esPeligro
                                    ? 'rgba(255,75,108,0.08)'
                                    : 'rgba(115,93,255,0.08)'
                                : 'transparent',
                            borderLeft: estaActivo
                                ? `3px solid ${color}`
                                : '3px solid transparent',
                        }}
                        onMouseEnter={e => {
                            if (!estaActivo) e.currentTarget.style.background = 'rgba(115,93,255,0.04)';
                        }}
                        onMouseLeave={e => {
                            if (!estaActivo) e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        {/* Ícono */}
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                background: estaActivo
                                    ? esPeligro
                                        ? 'rgba(255,75,108,0.12)'
                                        : 'rgba(115,93,255,0.12)'
                                    : '#f1f5f9',
                                transition: 'background 0.15s',
                            }}
                        >
                            <Icono
                                size={16}
                                style={{ color: estaActivo ? color : '#94a3b8' }}
                            />
                        </div>

                        {/* Texto */}
                        <div style={{ minWidth: 0 }}>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    fontWeight: estaActivo ? 700 : 500,
                                    color: estaActivo ? color : '#374151',
                                    lineHeight: 1.3,
                                }}
                            >
                                {label}
                            </p>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 11,
                                    color: '#94a3b8',
                                    lineHeight: 1.3,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {descripcion}
                            </p>
                        </div>
                    </button>
                );
            })}
        </nav>
    );
}