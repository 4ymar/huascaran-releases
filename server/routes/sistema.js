/**
 * routes/sistema.js
 * Rutas para herramientas del sistema:
 *   POST /api/sistema/reset        → Limpia datos, conserva config
 *   POST /api/sistema/cargar-demo  → Carga datos de demostración
 */

const router = require('express').Router();
const { db, config: dbConfig } = require('../data/database');
const { generateSeedData } = require('../data/seed');
const { requireRole } = require('../middleware/auth');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');

router.use(requireRole('ADMIN'));

// ══════════════════════════════════════════════════════════════════
//  POST /api/sistema/reset
//  Elimina todos los datos transaccionales conservando la config
// ══════════════════════════════════════════════════════════════════
router.post('/reset', (req, res) => {
    try {
        // Guardar config actual antes de limpiar
        const configActual = dbConfig.obtenerTodo();

        // Limpiar todas las tablas transaccionales en orden
        // (respetar foreign keys: primero detalles, luego cabeceras)
        db.exec(`
            DELETE FROM movimientos;
            DELETE FROM detalle_ventas;
            DELETE FROM detalle_compras;
            DELETE FROM ventas;
            DELETE FROM compras;
            DELETE FROM clientes;
            DELETE FROM productos;
        `);

        // Restaurar config (no se tocó, pero por seguridad la reescribimos)
        dbConfig.guardarTodo(configActual);

        res.json({ ok: true, mensaje: 'Base de datos restablecida correctamente' });

    } catch (err) {
        console.error('Error en /api/sistema/reset:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════
//  POST /api/sistema/cargar-demo
//  Limpia datos y carga el set de demostración desde seed.js
// ══════════════════════════════════════════════════════════════════
router.post('/cargar-demo', (req, res) => {
    try {
        // Guardar config actual para no pisarla
        const configActual = dbConfig.obtenerTodo();

        // Generar datos de demo
        const seed = generateSeedData();

        // Insertar todo dentro de una transacción atómica
        const cargarTodo = db.transaction(() => {

            // 1. Limpiar datos anteriores
            db.exec(`
                DELETE FROM movimientos;
                DELETE FROM detalle_ventas;
                DELETE FROM detalle_compras;
                DELETE FROM ventas;
                DELETE FROM compras;
                DELETE FROM clientes;
                DELETE FROM productos;
            `);

            // 2. Insertar productos
            const insProducto = db.prepare(`
                INSERT INTO productos
                    (id_producto, sku, nombre, categoria, unidad_medida,
                     precio_compra, precio_venta, stock_actual, stock_minimo,
                     descripcion, imagen_url, estado,
                     fecha_creacion, fecha_actualizacion)
                VALUES
                    (@id_producto, @sku, @nombre, @categoria, @unidad_medida,
                     @precio_compra, @precio_venta, @stock_actual, @stock_minimo,
                     @descripcion, @imagen_url, @estado,
                     @fecha_creacion, @fecha_actualizacion)
            `);
            for (const p of seed.productos) {
                insProducto.run({
                    ...p,
                    estado: p.estado ? 1 : 0,
                });
            }

            // 3. Insertar clientes
            const insCliente = db.prepare(`
                INSERT INTO clientes
                    (id_cliente, tipo_cliente, nombre_razon_social, tipo_documento,
                     numero_documento, direccion, telefono, email, estado, fecha_registro)
                VALUES
                    (@id_cliente, @tipo_cliente, @nombre_razon_social, @tipo_documento,
                     @numero_documento, @direccion, @telefono, @email, @estado, @fecha_registro)
            `);
            for (const c of seed.clientes) {
                insCliente.run({
                    ...c,
                    estado: c.estado ? 1 : 0,
                });
            }

            // 4. Insertar ventas
            const insVenta = db.prepare(`
                INSERT INTO ventas
                    (id_venta, numero_venta, fecha_hora, id_cliente, tipo_comprobante,
                     numero_comprobante, subtotal, igv, descuento, total,
                     forma_pago, estado, usuario, notas)
                VALUES
                    (@id_venta, @numero_venta, @fecha_hora, @id_cliente, @tipo_comprobante,
                     @numero_comprobante, @subtotal, @igv, @descuento, @total,
                     @forma_pago, @estado, @usuario, @notas)
            `);
            for (const v of seed.ventas) {
                insVenta.run(v);
            }

            // 5. Insertar detalle de ventas
            const insDetalleVenta = db.prepare(`
                INSERT INTO detalle_ventas
                    (id_detalle, id_venta, id_producto, nombre_producto,
                     cantidad, precio_unitario, descuento_linea, subtotal_linea)
                VALUES
                    (@id_detalle, @id_venta, @id_producto, @nombre_producto,
                     @cantidad, @precio_unitario, @descuento_linea, @subtotal_linea)
            `);
            for (const d of seed.detalle_ventas) {
                insDetalleVenta.run(d);
            }

            // 6. Insertar compras
            const insCompra = db.prepare(`
                INSERT INTO compras
                    (id_compra, numero_oc, fecha_hora, proveedor, ruc_proveedor,
                     doc_proveedor, subtotal, igv, total, estado, usuario, notas)
                VALUES
                    (@id_compra, @numero_oc, @fecha_hora, @proveedor, @ruc_proveedor,
                     @doc_proveedor, @subtotal, @igv, @total, @estado, @usuario, @notas)
            `);
            for (const c of seed.compras) {
                insCompra.run(c);
            }

            // 7. Insertar detalle de compras
            const insDetalleCompra = db.prepare(`
                INSERT INTO detalle_compras
                    (id_detalle, id_compra, id_producto, nombre_producto,
                     cantidad, precio_unitario, subtotal_linea)
                VALUES
                    (@id_detalle, @id_compra, @id_producto, @nombre_producto,
                     @cantidad, @precio_unitario, @subtotal_linea)
            `);
            for (const d of seed.detalle_compras) {
                insDetalleCompra.run(d);
            }

            // 8. Insertar movimientos
            const insMov = db.prepare(`
                INSERT INTO movimientos
                    (id_movimiento, fecha_hora, id_producto, nombre_producto,
                     tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
                     referencia, motivo, usuario)
                VALUES
                    (@id_movimiento, @fecha_hora, @id_producto, @nombre_producto,
                     @tipo_movimiento, @cantidad, @stock_anterior, @stock_nuevo,
                     @referencia, @motivo, @usuario)
            `);
            for (const m of seed.movimientos) {
                insMov.run(m);
            }

            // 9. Actualizar config con contadores de demo, sin pisar datos de empresa
            const configDemo = {
                ...configActual,
                correlativo_boleta:  seed.config.boleta_counter  || 1,
                correlativo_factura: seed.config.factura_counter || 1,
            };
            dbConfig.guardarTodo(configDemo);
        });

        // Ejecutar la transacción completa
        cargarTodo();

        res.json({
            ok: true,
            productos: seed.productos.length,
            clientes:  seed.clientes.length,
            ventas:    seed.ventas.length,
            compras:   seed.compras.length,
        });

    } catch (err) {
        console.error('Error en /api/sistema/cargar-demo:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════
//  GET /api/sistema/diagnostico
//  Obtiene el reporte de diagnóstico del sistema
// ══════════════════════════════════════════════════════════════════
router.get('/diagnostico', (req, res) => {
    try {
        const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/inventario.db');
        const logPath = process.env.LOG_PATH || path.join(path.dirname(dbPath), 'app-error.log');
        const appVersion = process.env.APP_VERSION || '1.2.1';

        // 1. Verificar integridad de la BD
        let dbIntegridad = 'error';
        try {
            const result = db.pragma('integrity_check', { simple: true });
            dbIntegridad = result === 'ok' ? 'ok' : 'fallido: ' + JSON.stringify(result);
        } catch (err) {
            dbIntegridad = 'error: ' + err.message;
        }

        // 2. Verificar CPEs atascados en ENVIANDO por más de 10 minutos
        let cpePendientes = 0;
        try {
            const row = db.prepare(`
                SELECT COUNT(*) AS c FROM cpe_documentos 
                WHERE estado = 'ENVIANDO' 
                  AND datetime(fecha_actualizacion) <= datetime('now', '-10 minutes')
            `).get();
            cpePendientes = row ? row.c : 0;
        } catch (err) {
            console.error('Error verificando CPEs pendientes:', err.message);
        }

        res.json({
            ok: true,
            db_path: dbPath,
            log_path: logPath,
            app_version: appVersion,
            db_integridad: dbIntegridad,
            cpe_pendientes: cpePendientes
        });
    } catch (err) {
        console.error('Error en /api/sistema/diagnostico:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════
//  GET /api/sistema/diagnostico/exportar
//  Exporta el paquete de soporte en un archivo ZIP
// ══════════════════════════════════════════════════════════════════
router.get('/diagnostico/exportar', async (req, res) => {
    const tempDbPath = path.join(os.tmpdir(), 'huascaran_temp.db');
    const tempZipPath = path.join(os.tmpdir(), `huascaran_soporte_${Date.now()}.zip`);

    try {
        const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/inventario.db');
        const logPath = process.env.LOG_PATH || path.join(path.dirname(dbPath), 'app-error.log');
        const normalLogPath = path.join(path.dirname(dbPath), 'app.log');

        // 1. Crear una copia de la base de datos para sanitizarla
        if (!fs.existsSync(dbPath)) {
            return res.status(404).json({ ok: false, error: 'Base de datos original no encontrada' });
        }

        fs.copyFileSync(dbPath, tempDbPath);

        // 2. Abrir la base de datos temporal y sanitizar
        const tempDb = new Database(tempDbPath);
        try {
            tempDb.exec(`
                -- Redactar contraseñas de usuarios
                UPDATE usuarios SET password_hash = 'REDACTED';
                -- Eliminar llaves de configuración sensibles, dejando solo las requeridas
                DELETE FROM config WHERE clave NOT IN ('cpe_proveedor', 'sunat_activo', 'sunat_modo', 'sunat_url');
            `);
        } finally {
            tempDb.close();
        }

        // 3. Crear el archivo ZIP usando archiver
        const output = fs.createWriteStream(tempZipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            res.json({ ok: true, tempZipPath });
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);

        // Agregar BD sanitizada
        archive.file(tempDbPath, { name: 'inventario_soporte.db' });

        // Agregar archivos de logs si existen
        if (fs.existsSync(logPath)) {
            archive.file(logPath, { name: 'app-error.log' });
        }
        if (fs.existsSync(normalLogPath)) {
            archive.file(normalLogPath, { name: 'app.log' });
        }

        await archive.finalize();

        // Eliminar la BD temporal después de zipearla
        try { fs.unlinkSync(tempDbPath); } catch (_) {}

    } catch (err) {
        console.error('Error al exportar paquete de soporte:', err);
        // Limpiar archivos temporales en caso de error
        try { if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath); } catch (_) {}
        try { if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath); } catch (_) {}
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
