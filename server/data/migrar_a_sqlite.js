/**
 * SCRIPT DE MIGRACIÓN: db.json → inventario.db (SQLite)
 * 
 * USO:
 *   1. npm install better-sqlite3
 *   2. Coloca este archivo junto a tu db.json
 *   3. node migrar_a_sqlite.js
 *
 * Resultado: se crea el archivo "inventario.db" con todos tus datos migrados.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// ── Rutas ──────────────────────────────────────────────────────────────────
const JSON_PATH = path.join(__dirname, 'db.json');
const DB_PATH   = path.join(__dirname, 'inventario.db');

// ── Verificar que existe el JSON ───────────────────────────────────────────
if (!fs.existsSync(JSON_PATH)) {
  console.error('❌  No se encontró db.json en:', JSON_PATH);
  process.exit(1);
}

// ── Borrar BD anterior si existe (para re-migrar limpio) ───────────────────
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('🗑   BD anterior eliminada, creando nueva...');
}

const db   = new Database(DB_PATH);
const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));

// ── Activar WAL mode (escrituras más rápidas) ──────────────────────────────
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('📦  Creando tablas...');

// ══════════════════════════════════════════════════════════════════════════════
//  CREACIÓN DE TABLAS
// ══════════════════════════════════════════════════════════════════════════════

db.exec(`
  -- ── CLIENTES ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS clientes (
    id_cliente          TEXT PRIMARY KEY,
    tipo_cliente        TEXT NOT NULL,
    nombre_razon_social TEXT NOT NULL,
    tipo_documento      TEXT,
    numero_documento    TEXT,
    direccion           TEXT,
    telefono            TEXT,
    email               TEXT,
    estado              INTEGER NOT NULL DEFAULT 1,
    fecha_registro      TEXT NOT NULL
  );
  CREATE INDEX idx_clientes_documento ON clientes(numero_documento);

  -- ── PRODUCTOS ─────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS productos (
    id_producto         TEXT PRIMARY KEY,
    sku                 TEXT NOT NULL UNIQUE,
    nombre              TEXT NOT NULL,
    categoria           TEXT,
    unidad_medida       TEXT,
    precio_compra       REAL NOT NULL DEFAULT 0,
    precio_venta        REAL NOT NULL DEFAULT 0,
    stock_actual        REAL NOT NULL DEFAULT 0,
    stock_minimo        REAL NOT NULL DEFAULT 0,
    descripcion         TEXT DEFAULT '',
    imagen_url          TEXT DEFAULT '',
    estado              INTEGER NOT NULL DEFAULT 1,
    fecha_creacion      TEXT NOT NULL,
    fecha_actualizacion TEXT NOT NULL
  );
  CREATE INDEX idx_productos_sku       ON productos(sku);
  CREATE INDEX idx_productos_categoria ON productos(categoria);
  CREATE INDEX idx_productos_nombre    ON productos(nombre);

  -- ── VENTAS ────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS ventas (
    id_venta           TEXT PRIMARY KEY,
    numero_venta       TEXT NOT NULL UNIQUE,
    fecha_hora         TEXT NOT NULL,
    id_cliente         TEXT,
    tipo_comprobante   TEXT NOT NULL,
    numero_comprobante TEXT,
    subtotal           REAL NOT NULL DEFAULT 0,
    igv                REAL NOT NULL DEFAULT 0,
    descuento          REAL NOT NULL DEFAULT 0,
    total              REAL NOT NULL DEFAULT 0,
    forma_pago         TEXT,
    estado             TEXT NOT NULL DEFAULT 'ACTIVA',
    usuario            TEXT,
    notas              TEXT DEFAULT '',
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
  );
  CREATE INDEX idx_ventas_fecha    ON ventas(fecha_hora);
  CREATE INDEX idx_ventas_cliente  ON ventas(id_cliente);
  CREATE INDEX idx_ventas_estado   ON ventas(estado);

  -- ── DETALLE VENTAS ────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS detalle_ventas (
    id_detalle       TEXT PRIMARY KEY,
    id_venta         TEXT NOT NULL,
    id_producto      TEXT NOT NULL,
    nombre_producto  TEXT NOT NULL,
    cantidad         REAL NOT NULL,
    precio_unitario  REAL NOT NULL,
    descuento_linea  REAL NOT NULL DEFAULT 0,
    subtotal_linea   REAL NOT NULL,
    FOREIGN KEY (id_venta)    REFERENCES ventas(id_venta),
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
  );
  CREATE INDEX idx_detalle_ventas_venta    ON detalle_ventas(id_venta);
  CREATE INDEX idx_detalle_ventas_producto ON detalle_ventas(id_producto);

  -- ── COMPRAS ───────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS compras (
    id_compra      TEXT PRIMARY KEY,
    numero_oc      TEXT NOT NULL UNIQUE,
    fecha_hora     TEXT NOT NULL,
    proveedor      TEXT,
    ruc_proveedor  TEXT,
    doc_proveedor  TEXT DEFAULT '',
    subtotal       REAL NOT NULL DEFAULT 0,
    igv            REAL NOT NULL DEFAULT 0,
    total          REAL NOT NULL DEFAULT 0,
    estado         TEXT NOT NULL DEFAULT 'ACTIVA',
    usuario        TEXT,
    notas          TEXT DEFAULT ''
  );
  CREATE INDEX idx_compras_fecha ON compras(fecha_hora);

  -- ── DETALLE COMPRAS ───────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS detalle_compras (
    id_detalle      TEXT PRIMARY KEY,
    id_compra       TEXT NOT NULL,
    id_producto     TEXT NOT NULL,
    nombre_producto TEXT NOT NULL,
    cantidad        REAL NOT NULL,
    precio_unitario REAL NOT NULL,
    subtotal_linea  REAL NOT NULL,
    FOREIGN KEY (id_compra)   REFERENCES compras(id_compra),
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
  );
  CREATE INDEX idx_detalle_compras_compra ON detalle_compras(id_compra);

  -- ── MOVIMIENTOS DE STOCK ──────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS movimientos (
    id_movimiento   TEXT PRIMARY KEY,
    fecha_hora      TEXT NOT NULL,
    id_producto     TEXT NOT NULL,
    nombre_producto TEXT NOT NULL,
    tipo_movimiento TEXT NOT NULL,
    cantidad        REAL NOT NULL,
    stock_anterior  REAL NOT NULL,
    stock_nuevo     REAL NOT NULL,
    referencia      TEXT DEFAULT '',
    motivo          TEXT DEFAULT '',
    usuario         TEXT,
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
  );
  CREATE INDEX idx_movimientos_fecha    ON movimientos(fecha_hora);
  CREATE INDEX idx_movimientos_producto ON movimientos(id_producto);
  CREATE INDEX idx_movimientos_tipo     ON movimientos(tipo_movimiento);

  -- ── CONFIGURACIÓN ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS config (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );
`);

// ══════════════════════════════════════════════════════════════════════════════
//  MIGRACIÓN DE DATOS
// ══════════════════════════════════════════════════════════════════════════════

// Helper: booleano → 0/1
const bool = v => (v === true || v === 1) ? 1 : 0;

// Usamos transacciones para velocidad (insertar todo en un solo commit)
const migrate = db.transaction(() => {

  // ── Clientes ──────────────────────────────────────────────────────────────
  const insCliente = db.prepare(`
    INSERT OR IGNORE INTO clientes
      (id_cliente, tipo_cliente, nombre_razon_social, tipo_documento,
       numero_documento, direccion, telefono, email, estado, fecha_registro)
    VALUES
      (@id_cliente, @tipo_cliente, @nombre_razon_social, @tipo_documento,
       @numero_documento, @direccion, @telefono, @email, @estado, @fecha_registro)
  `);
  for (const c of data.clientes || []) {
    insCliente.run({ ...c, estado: bool(c.estado) });
  }
  console.log(`  ✔  clientes      : ${(data.clientes || []).length} registros`);

  // ── Productos ─────────────────────────────────────────────────────────────
  const insProducto = db.prepare(`
    INSERT OR IGNORE INTO productos
      (id_producto, sku, nombre, categoria, unidad_medida, precio_compra,
       precio_venta, stock_actual, stock_minimo, descripcion, imagen_url,
       estado, fecha_creacion, fecha_actualizacion)
    VALUES
      (@id_producto, @sku, @nombre, @categoria, @unidad_medida, @precio_compra,
       @precio_venta, @stock_actual, @stock_minimo, @descripcion, @imagen_url,
       @estado, @fecha_creacion, @fecha_actualizacion)
  `);
  for (const p of data.productos || []) {
    insProducto.run({ ...p, estado: bool(p.estado) });
  }
  console.log(`  ✔  productos     : ${(data.productos || []).length} registros`);

  // ── Ventas ────────────────────────────────────────────────────────────────
  const insVenta = db.prepare(`
    INSERT OR IGNORE INTO ventas
      (id_venta, numero_venta, fecha_hora, id_cliente, tipo_comprobante,
       numero_comprobante, subtotal, igv, descuento, total, forma_pago, estado, usuario, notas)
    VALUES
      (@id_venta, @numero_venta, @fecha_hora, @id_cliente, @tipo_comprobante,
       @numero_comprobante, @subtotal, @igv, @descuento, @total, @forma_pago, @estado, @usuario, @notas)
  `);
  let vcount = 0;
  for (const v of data.ventas || []) {
    try {
      // sanitize empty strings to null for id_cliente to prevent foreign key errors
      const sanitizedV = { ...v, id_cliente: v.id_cliente === '' ? null : v.id_cliente };
      insVenta.run(sanitizedV);
      vcount++;
    } catch (e) { console.log('Error insertando venta:', v.id_venta, e.message); }
  }
  console.log(`  ✔  ventas        : ${vcount} registros`);

  // ── Detalle Ventas ────────────────────────────────────────────────────────
  const insDetalleVenta = db.prepare(`
    INSERT OR IGNORE INTO detalle_ventas
      (id_detalle, id_venta, id_producto, nombre_producto,
       cantidad, precio_unitario, descuento_linea, subtotal_linea)
    VALUES
      (@id_detalle, @id_venta, @id_producto, @nombre_producto,
       @cantidad, @precio_unitario, @descuento_linea, @subtotal_linea)
  `);
  let dcount = 0;
  for (const d of data.detalle_ventas || []) {
    try {
      insDetalleVenta.run(d);
      dcount++;
    } catch (e) { console.log('Error insertando detalle_venta dev producto:', d.id_producto, e.message); }
  }
  console.log(`  ✔  detalle_ventas: ${dcount} registros`);

  // ── Compras ───────────────────────────────────────────────────────────────
  const insCompra = db.prepare(`
    INSERT OR IGNORE INTO compras
      (id_compra, numero_oc, fecha_hora, proveedor, ruc_proveedor,
       doc_proveedor, subtotal, igv, total, estado, usuario, notas)
    VALUES
      (@id_compra, @numero_oc, @fecha_hora, @proveedor, @ruc_proveedor,
       @doc_proveedor, @subtotal, @igv, @total, @estado, @usuario, @notas)
  `);
  for (const c of data.compras || []) {
    insCompra.run(c);
  }
  console.log(`  ✔  compras       : ${(data.compras || []).length} registros`);

  // ── Detalle Compras ───────────────────────────────────────────────────────
  const insDetalleCompra = db.prepare(`
    INSERT OR IGNORE INTO detalle_compras
      (id_detalle, id_compra, id_producto, nombre_producto,
       cantidad, precio_unitario, subtotal_linea)
    VALUES
      (@id_detalle, @id_compra, @id_producto, @nombre_producto,
       @cantidad, @precio_unitario, @subtotal_linea)
  `);
  for (const d of data.detalle_compras || []) {
    insDetalleCompra.run(d);
  }
  console.log(`  ✔  detalle_compras: ${(data.detalle_compras || []).length} registros`);

  // ── Movimientos ───────────────────────────────────────────────────────────
  const insMov = db.prepare(`
    INSERT OR IGNORE INTO movimientos
      (id_movimiento, fecha_hora, id_producto, nombre_producto,
       tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
       referencia, motivo, usuario)
    VALUES
      (@id_movimiento, @fecha_hora, @id_producto, @nombre_producto,
       @tipo_movimiento, @cantidad, @stock_anterior, @stock_nuevo,
       @referencia, @motivo, @usuario)
  `);
  for (const m of data.movimientos || []) {
    insMov.run(m);
  }
  console.log(`  ✔  movimientos   : ${(data.movimientos || []).length} registros`);

  // ── Config ────────────────────────────────────────────────────────────────
  const insConfig = db.prepare(`
    INSERT OR REPLACE INTO config (clave, valor) VALUES (@clave, @valor)
  `);
  const cfg = data.config || {};
  for (const [clave, valor] of Object.entries(cfg)) {
    insConfig.run({ clave, valor: String(valor) });
  }
  console.log(`  ✔  config        : ${Object.keys(cfg).length} claves`);
});

console.log('\n🚀  Migrando datos...');
migrate();

// ══════════════════════════════════════════════════════════════════════════════
//  VERIFICACIÓN FINAL
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n✅  Migración completada. Verificando...');
const tablas = ['clientes','productos','ventas','detalle_ventas',
                'compras','detalle_compras','movimientos','config'];
for (const t of tablas) {
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM ${t}`).get();
  console.log(`   ${t.padEnd(20)}: ${total} registros`);
}

const sizeMB = (fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(2);
console.log(`\n📁  Archivo creado: inventario.db (${sizeMB} MB)`);
console.log('🎉  Listo. Ya puedes usar inventario.db en tu sistema.\n');

db.close();
