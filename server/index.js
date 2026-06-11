const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('bytenode');
const LICENCIA_MOD = fs.existsSync(path.join(__dirname, 'licencia.jsc')) ? './licencia.jsc' : './licencia.js';
const app = express();
const { getMachineId, verificarLicencia } = require(LICENCIA_MOD);
process.env.MACHINE_ID = getMachineId();

const logFile = fs.createWriteStream(
    path.join(process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : __dirname, 'app-error.log'),
    { flags: 'a' }
);

const os = require('os');
const Database = require('better-sqlite3');

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

process.on('uncaughtException', (err) => {
    logFile.write(`[${new Date().toISOString()}] Excepción no capturada: ${err.stack}\n`);
    console.error('ERROR FATAL:', err.stack); // ← agregar esta línea
});

const originalConsoleError = console.error;
console.error = function () {
    logFile.write(`[${new Date().toISOString()}] ERROR: ${Object.values(arguments).join(' ')}\n`);
    originalConsoleError.apply(console, arguments);
};

// ── Verificar licencia al iniciar ──────────────────────────
const licencia = verificarLicencia();
if (!licencia.valida) {
    console.log('\n================================================');
    console.log(' SISTEMA BLOQUEADO - LICENCIA REQUERIDA');
    console.log('================================================');
    console.log(` Motivo: ${licencia.motivo}`);
    console.log(` Codigo de maquina: ${getMachineId()}`);
    console.log(' Contacte al proveedor para activar.');
    console.log('================================================\n');
} else {
    console.log(` Licencia activa: ${licencia.empresa}`);
    console.log(` Expira: ${licencia.fechaExpira}`);
}

const PORT = 3020;
const DB_PATH    = process.env.DB_PATH    || path.join(__dirname, 'data', 'inventario.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'data', 'backups');

// ── Subcarpetas de backups ─────────────────────────────────
const BACKUP_AUTO    = path.join(BACKUP_DIR, 'automaticos');
const BACKUP_DIARIOS = path.join(BACKUP_DIR, 'diarios');
const BACKUP_MANUAL  = path.join(BACKUP_DIR, 'manuales');

[BACKUP_DIR, BACKUP_AUTO, BACKUP_DIARIOS, BACKUP_MANUAL].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Helper: nombre de archivo con timestamp ────────────────
function nombreBackup(sufijo) {
    const n = new Date();
    const pad = v => String(v).padStart(2, '0');
    const base = `db_backup_${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}_${pad(n.getHours())}-${pad(n.getMinutes())}-${pad(n.getSeconds())}`;
    return sufijo ? `${base}_${sufijo}.db` : `${base}.db`;
}

function validarBackupSQLite(rutaArchivo) {
    let conn;
    try {
        conn = new Database(rutaArchivo, { readonly: true, fileMustExist: true });
        return conn.pragma('integrity_check', { simple: true }) === 'ok';
    } catch (_) {
        return false;
    } finally {
        try { if (conn) conn.close(); } catch (_) {}
    }
}

function copiarBackupExternoSiCorresponde(rutaArchivo, nombre) {
    try {
        const cfg = require('./data/database').config.obtenerTodo();
        if (cfg.backup_externo_activo !== '1' || !cfg.backup_externo_dir) return;
        if (!fs.existsSync(cfg.backup_externo_dir)) {
            console.warn('[BACKUP] Carpeta externa no disponible.');
            return;
        }
        fs.copyFileSync(rutaArchivo, path.join(cfg.backup_externo_dir, nombre));
        console.log(`[BACKUP] Copia externa actualizada: ${nombre}`);
    } catch (err) {
        console.error('[BACKUP] Error al copiar backup externo:', err.message);
    }
}

// ── Backup diario (1 por día, últimos 30 días) ─────────────
async function hacerBackupDiario() {
    try {
        if (!fs.existsSync(DB_PATH)) return;
        const hoy = new Date();
        const pad = v => String(v).padStart(2, '0');
        const fechaHoy = `${hoy.getFullYear()}-${pad(hoy.getMonth()+1)}-${pad(hoy.getDate())}`;
        const yaExiste = fs.readdirSync(BACKUP_DIARIOS).some(f => f.includes(fechaHoy));
        if (!yaExiste) {
            const nombre = `db_backup_${fechaHoy}_diario.db`;
            const destinoDiario = path.join(BACKUP_DIARIOS, nombre);
            const dbInstance = require('./data/database').db;
            await dbInstance.backup(destinoDiario);
            if (!validarBackupSQLite(destinoDiario)) {
                try { fs.unlinkSync(destinoDiario); } catch (_) {}
                throw new Error('Backup diario fallo integrity_check');
            }
            copiarBackupExternoSiCorresponde(destinoDiario, nombre);
            console.log(`[BACKUP] Diario guardado: ${nombre}`);
            const archivos = fs.readdirSync(BACKUP_DIARIOS)
                .filter(f => f.startsWith('db_backup_') && f.endsWith('.db'))
                .sort();
            if (archivos.length > 30) {
                archivos.slice(0, archivos.length - 30).forEach(f => {
                    try { fs.unlinkSync(path.join(BACKUP_DIARIOS, f)); } catch (_) {}
                });
            }
        }
    } catch (err) {
        console.error('[BACKUP] Error en backup diario:', err.message);
    }
}

// ── Backup automático (cada 30 min → carpeta automaticos/) ─
async function hacerBackup(sufijo) {
    try {
        if (!fs.existsSync(DB_PATH)) return;
        const nombre  = nombreBackup(sufijo);
        const destino = path.join(BACKUP_AUTO, nombre);
        const dbInstance = require('./data/database').db;
        await dbInstance.backup(destino);
        if (!validarBackupSQLite(destino)) {
            try { fs.unlinkSync(destino); } catch (_) {}
            throw new Error('Backup automatico fallo integrity_check');
        }
        const archivos = fs.readdirSync(BACKUP_AUTO)
            .filter(f => f.startsWith('db_backup_') && f.endsWith('.db'))
            .sort();
        if (archivos.length > 48) {
            archivos.slice(0, archivos.length - 48).forEach(f => {
                try { fs.unlinkSync(path.join(BACKUP_AUTO, f)); } catch (_) {}
            });
        }
        console.log(`[BACKUP] Automático guardado: ${nombre}`);
        await hacerBackupDiario();
    } catch (err) {
        console.error('[BACKUP] Error en backup automático:', err.message);
    }
}

setTimeout(() => hacerBackup(), 5000);
setInterval(hacerBackup, 30 * 60 * 1000);


// ── Middleware base (debe ir ANTES de las rutas) ───────────
app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        try {
            const url = new URL(origin);
            const host = url.hostname;
            const permitidos = new Set(['localhost', '127.0.0.1', getLocalIP()]);
            if (permitidos.has(host) || /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
                return callback(null, true);
            }
        } catch (_) {}
        return callback(new Error('Origen no permitido por CORS'));
    }
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// ── Content Security Policy (permite Google Fonts) ────────
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "img-src 'self' data: blob:",
            "connect-src 'self' https://api.nubefact.com"
        ].join('; ')
    );
    next();
});

// ── Heartbeat (auto apagado si no hay navegador) ───────────
const isElectron = process.env.IS_ELECTRON === 'true';
let shutdownTimer = null;
const HEARTBEAT_TIMEOUT = process.env.IS_ELECTRON === 'true' ? 90000 : 300000;

function resetShutdownTimer() {
    if (isElectron) return;
    if (shutdownTimer) clearTimeout(shutdownTimer);
    shutdownTimer = setTimeout(() => {
        console.log('Navegador cerrado. Apagando sistema...');
        process.exit(0);
    }, HEARTBEAT_TIMEOUT);
}

if (!isElectron) {
    resetShutdownTimer();
}

app.post('/api/heartbeat', (req, res) => {
    resetShutdownTimer();
    res.json({ status: 'ok' });
});

// ── Rutas públicas de licencia (sin bloqueo) ───────────────
app.get('/api/licencia/estado', (req, res) => {
    const { verificarLicencia, getMachineId } = require(LICENCIA_MOD);
    const estado = verificarLicencia();
    res.json({ ...estado, machineId: getMachineId() });
});

app.post('/api/licencia/activar', (req, res) => {
    const { activarLicencia } = require(LICENCIA_MOD);
    const { clave } = req.body;
    if (!clave) {
        return res.status(400).json({ exito: false, error: 'Falta la clave de activación' });
    }
    const resultado = activarLicencia(clave);
    res.json(resultado);
});

// ── Health check (público) ─────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        db: fs.existsSync(DB_PATH) ? 'ok' : 'no encontrado'
    });
});

// ── Info del servidor (IP local para acceso desde otros dispositivos) ──
app.get('/api/server-info', (req, res) => {
    const ip = getLocalIP();
    res.json({ ip, port: PORT, url: `http://${ip}:${PORT}` });
});


// ── Middleware de licencia (protege todas las rutas /api/) ──
app.use((req, res, next) => {
    if (
        !req.path.startsWith('/api/') ||
        req.path.startsWith('/api/auth') ||
        req.path.startsWith('/api/setup') ||
        req.path === '/api/licencia/estado' ||
        req.path === '/api/licencia/activar' ||
        req.path === '/api/health' ||
        req.path === '/api/heartbeat' ||
        req.path === '/api/server-info'  
    ) 
    {
        return next();
    }

    const { verificarLicencia } = require(LICENCIA_MOD);
    const lic = verificarLicencia();
    if (!lic.valida) {
        return res.status(403).json({
            bloqueado: true,
            motivo: lic.motivo,
            machineId: require(LICENCIA_MOD).getMachineId()
        });
    }
    next();
});

const { requireAuth } = require('./middleware/auth');

// ── Exponer rutas base a los routers vía app.locals ────────
app.locals.DB_PATH    = DB_PATH;
app.locals.BACKUP_DIR = BACKUP_DIR;

// ── Rutas públicas ─────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/setup', require('./routes/setup'));

// ── Estadísticas públicas (solo lectura, sin datos sensibles) ──
app.get('/api/estadisticas', requireAuth, (req, res) => {
    try {
        const db  = require('./data/database');
        const raw = db.db;
        const { total_productos } = raw.prepare('SELECT COUNT(*) AS total_productos FROM productos').get();
        const { total_ventas }    = raw.prepare("SELECT COUNT(*) AS total_ventas FROM ventas WHERE estado != 'anulada'").get();
        res.json({ total_productos, total_ventas });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Rutas protegidas (Requieren JWT) ───────────────────────
app.use('/api/*path', requireAuth);

app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/sistema', require('./routes/sistema'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/compras', require('./routes/compras'));
app.use('/api/facturacion', require('./routes/facturacion'));
app.use('/api/almacenes', require('./routes/almacenes'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/movimientos', require('./routes/movimientos'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/config', require('./routes/config'));
app.use('/api/archivos', require('./routes/archivos'));
app.use('/api/creditos', require('./routes/creditos'));
app.use('/api/caja', require('./routes/caja'));
app.use('/api/logs',    require('./routes/logs'));
app.use('/api/backups', require('./routes/backups'));


// ── Archivos estáticos del frontend ───────────────────────
const clientDist = process.env.CLIENT_DIST || path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

// ── Frontend Catch-all (React Router) ──────────────────────
app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) {
        res.sendFile(path.join(clientDist, 'index.html'));
    } else {
        next();
    }
});

// ── Middleware de errores centralizado (DEBE ir al final) ──
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);


const server = app.listen(PORT, '0.0.0.0', () => { 
    const ip = getLocalIP();
    console.log(`Sistema Huascaran API corriendo en http://${ip}:${PORT}`);
    console.log(`Base de datos: ${DB_PATH}`);
    console.log(`Backups en:    ${BACKUP_DIR}`);
});

// ── Apagado gracioso desde Electron ───────────────────────
process.on('message', (msg) => {
    if (msg === 'shutdown') {
        console.log('Señal de cierre de Electron. Cerrando...');
        server.closeAllConnections();
        server.close(() => {
            process.exit(0);
        });
    }
});
