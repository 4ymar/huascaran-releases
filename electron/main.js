const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

app.setPath('userData', path.join(app.getPath('appData'), 'HuascaranPOS'));

const isDev = !app.isPackaged;

// ── LOG A ARCHIVO ──────────────────────────────────────────
const logPath = path.join(app.getPath('userData'), 'app.log');
function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(msg);
    try { fs.appendFileSync(logPath, line); } catch (_) { }
}

log('=== INICIANDO HUASCARAN ===');
log(`isDev: ${isDev}`);
log(`userData: ${app.getPath('userData')}`);
log(`resourcesPath: ${process.resourcesPath || 'N/A'}`);

let mainWindow;

// ── Abrir URL externa en el navegador del sistema ──────────
// window.open() en Electron abre una ventana de Electron, no el navegador.
// La forma correcta es shell.openExternal() desde el proceso principal.
ipcMain.handle('open-external', async (_event, url) => {
    try {
        await shell.openExternal(url);
        return { ok: true };
    } catch (err) {
        log('Error abriendo URL externa: ' + err.message);
        return { ok: false, error: err.message };
    }
});

// ── Abrir PDF con visor nativo del sistema ─────────────────
const os = require('os');
ipcMain.handle('open-pdf', async (_event, base64Data) => {
    try {
        const tmpPath = path.join(os.tmpdir(), `comprobante_${Date.now()}.pdf`);
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(tmpPath, buffer);
        await shell.openPath(tmpPath);
        return { ok: true };
    } catch (err) {
        log('Error abriendo PDF: ' + err.message);
        return { ok: false, error: err.message };
    }
});

// ── Guardar CSV con diálogo nativo de Electron ─────────────
const { dialog } = require('electron');

ipcMain.handle('save-csv', async (_event, { content, suggestedName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar archivo CSV',
        defaultPath: suggestedName,
        filters: [{ name: 'Archivo CSV', extensions: ['csv'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return { ok: true };
    } catch (err) {
        log('Error guardando CSV: ' + err.message);
        return { ok: false, error: err.message };
    }
});

// ── Guardar Excel con diálogo nativo de Electron ───────────
ipcMain.handle('save-excel', async (_event, { buffer, suggestedName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar archivo Excel',
        defaultPath: suggestedName,
        filters: [{ name: 'Archivo Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    try {
        fs.writeFileSync(filePath, Buffer.from(buffer, 'base64'));
        return { ok: true };
    } catch (err) {
        log('Error guardando Excel: ' + err.message);
        return { ok: false, error: err.message };
    }
});

// ── Guardar PDF con diálogo nativo de Electron ─────────────
ipcMain.handle('save-pdf-dialog', async (_event, { buffer, suggestedName }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar reporte PDF',
        defaultPath: suggestedName,
        filters: [{ name: 'Archivo PDF', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    try {
        fs.writeFileSync(filePath, Buffer.from(buffer, 'base64'));
        return { ok: true };
    } catch (err) {
        log('Error guardando PDF: ' + err.message);
        return { ok: false, error: err.message };
    }
});

// ── Seleccionar imagen con diálogo nativo ───────────────────
ipcMain.handle('select-image', async (_event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Seleccionar logo',
        filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg'] }],
        properties: ['openFile']
    });
    if (canceled || !filePaths.length) return { ok: false, canceled: true };
    try {
        const buffer = fs.readFileSync(filePaths[0]);
        const ext = path.extname(filePaths[0]).replace('.', '').toLowerCase();
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const base64 = `data:${mime};base64,${buffer.toString('base64')}`;
        return { ok: true, base64 };
    } catch (err) {
        log('Error leyendo imagen: ' + err.message);
        return { ok: false, error: err.message };
    }
});

// ── CONFIGURACIÓN DE ACTUALIZACIONES ─────────────────────────
autoUpdater.autoDownload = false;
autoUpdater.logger = {
    info: (msg) => log(`[Updater Info] ${msg}`),
    warn: (msg) => log(`[Updater Warn] ${msg}`),
    error: (msg) => log(`[Updater Error] ${msg}`)
};

// Eventos de autoUpdater para notificar a la ventana principal
autoUpdater.on('checking-for-update', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', { state: 'checking' });
    }
});

autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', { state: 'available', info });
    }
});

autoUpdater.on('update-not-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', { state: 'not-available', info });
    }
});

autoUpdater.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', { state: 'error', error: err.message });
    }
});

autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', { state: 'downloading', progress: progressObj });
    }
});

autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:status', { state: 'downloaded', info });
    }
});

// ── IPC HANDLERS PARA ACTUALIZACIONES Y SOPORTE ──────────────
ipcMain.handle('updater:check', async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        return { ok: true, result };
    } catch (err) {
        log('Error checking updates: ' + err.message);
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('updater:download', async () => {
    try {
        const result = await autoUpdater.downloadUpdate();
        return { ok: true, result };
    } catch (err) {
        log('Error downloading update: ' + err.message);
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('updater:install', async () => {
    try {
        autoUpdater.quitAndInstall();
        return { ok: true };
    } catch (err) {
        log('Error installing update: ' + err.message);
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('save-support-zip', async (_event, { tempZipPath }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Guardar paquete de soporte',
        defaultPath: `huascaran_soporte_${Date.now()}.zip`,
        filters: [{ name: 'Archivo ZIP', extensions: ['zip'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    try {
        fs.copyFileSync(tempZipPath, filePath);
        try { fs.unlinkSync(tempZipPath); } catch (_) {}
        return { ok: true };
    } catch (err) {
        log('Error guardando paquete de soporte: ' + err.message);
        return { ok: false, error: err.message };
    }
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.ico')
    });

    mainWindow.loadURL('http://localhost:3020');

    // Temporal para diagnóstico — quitar en versión final
    mainWindow.webContents.openDevTools();

    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show(); 
    });

    mainWindow.on('close', (e) => {
        // Emitir evento de cierre para que el servidor haga backup final
        // El servidor escucha este evento en index.js via process.emit
        e.preventDefault();
        try {
            process.emit('message', 'shutdown');
        } catch (_) {}
        setTimeout(() => {
            mainWindow = null;
            app.quit();
        }, 2500); // 1.5s para que el backup se complete
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {

    // ── CSP: definir política de seguridad de contenido ───────────────────────
    // Elimina la advertencia "Insecure Content-Security-Policy" de Electron.
    // Se aplica ANTES de crear la ventana para que cubra todas las peticiones.
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    [
                        "default-src 'self' http://localhost:3020",
                        "script-src 'self' 'unsafe-inline' http://localhost:3020",
                        "style-src 'self' 'unsafe-inline' http://localhost:3020 https://fonts.googleapis.com",
                        "style-src-elem 'self' 'unsafe-inline' http://localhost:3020 https://fonts.googleapis.com",
                        "img-src 'self' data: blob: http://localhost:3020",
                        "connect-src 'self' http://localhost:3020 ws://localhost:3020",
                        "font-src 'self' data: https://fonts.gstatic.com http://localhost:3020",
                    ].join('; ')
                ]
            }
        });
    });
    // ─────────────────────────────────────────────────────────────────────────

    const serverPath = isDev
        ? path.join(__dirname, '../server/index.js')
        : path.join(process.resourcesPath, 'server/index.js');

    const dbPath = isDev
        ? path.join(__dirname, '../server/data/inventario.db')
        : path.join(app.getPath('userData'), 'inventario.db');

    const backupDir = isDev
        ? path.join(__dirname, '../server/data/backups')
        : path.join(app.getPath('userData'), 'backups');

    const clientDist = isDev
        ? path.join(__dirname, '../client/dist')
        : path.join(process.resourcesPath, 'client/dist');

    const serverModulesPath = isDev
    ? path.join(__dirname, '../server/node_modules')
    : path.join(process.resourcesPath, 'server/node_modules');

    log(`serverPath: ${serverPath}`);
    log(`serverPath existe: ${fs.existsSync(serverPath)}`);
    log(`dbPath: ${dbPath}`);
    log(`clientDist: ${clientDist}`);
    log(`clientDist existe: ${fs.existsSync(clientDist)}`);
    log(`node_modules existe: ${fs.existsSync(serverModulesPath)}`);

    const sqlitePath = path.join(serverModulesPath, 'better-sqlite3');
    log(`better-sqlite3 existe: ${fs.existsSync(sqlitePath)}`);

    process.env.IS_ELECTRON = 'true';
    process.env.DB_PATH = dbPath;
    process.env.BACKUP_DIR = backupDir;
    process.env.CLIENT_DIST = clientDist;
    process.env.NODE_PATH = serverModulesPath;
    process.env.LOG_PATH = logPath;
    process.env.APP_VERSION = app.getVersion();

    log('Iniciando servidor en proceso principal...');
    try {
        const serverDir = path.dirname(serverPath);
        Object.keys(require.cache).forEach(k => {
            if (k.startsWith(serverDir)) delete require.cache[k];
        });
        require(serverPath);
        log('Servidor iniciado correctamente');
    } catch (err) {
        log(`ERROR iniciando servidor: ${err.message}`);
        log(err.stack || '');
        mainWindow = new BrowserWindow({ width: 600, height: 300 });
        mainWindow.loadURL(`data:text/html,<h2>Error al iniciar servidor</h2><p>${err.message}</p><p>Log: <b>${logPath}</b></p>`);
        mainWindow.show();
        return;
    }

    const { net } = require('electron');

    function esperarServidor(intentos = 0) {
        if (intentos > 30) { // máximo 15 segundos
            log('Servidor no respondió a tiempo, abriendo ventana de todas formas...');
            createWindow();
            return;
        }
        const req = net.request('http://localhost:3020/api/health');
        req.on('response', (res) => {
            if (res.statusCode === 200) {
                log(`Servidor listo en intento ${intentos + 1}`);
                createWindow();
            } else {
                setTimeout(() => esperarServidor(intentos + 1), 500);
            }
        });
        req.on('error', () => {
            setTimeout(() => esperarServidor(intentos + 1), 500);
        });
        req.end();
    }

    log('Esperando que el servidor esté listo...');
    esperarServidor();

    // Verificar actualizaciones solo en producción
    if (app.isPackaged) {
        setTimeout(() => {
            autoUpdater.checkForUpdates().catch(err => {
                log('Error al verificar actualizaciones: ' + err.message);
            });
        }, 8000); // esperar 8s a que la app esté lista
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
