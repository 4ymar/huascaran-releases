/**
 * cargar_demo.js
 * Ejecutar con: node cargar_demo.js
 * Carga los datos de demostración directamente en inventario.db (SQLite).
 * Respeta la configuración de empresa ya guardada (nombre, RUC, series, etc.)
 */

const Database = require('better-sqlite3');
const path     = require('path');
const { generateSeedData } = require('./seed');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'inventario.db');

// ── Abrir la BD existente (debe existir, no la recreamos) ─────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // Lo desactivamos durante la carga masiva

// ── Generar datos de demo ─────────────────────────────────────────────────────
const seedData = generateSeedData();

// Helper: booleano → 0/1 para SQLite
const bool = v => (v === true || v === 1) ? 1 : 0;

// ══════════════════════════════════════════════════════════════════════════════
//  CARGA EN UNA SOLA TRANSACCIÓN (rápido y seguro — todo o nada)
// ══════════════════════════════════════════════════════════════════════════════
const cargar = db.transaction(() => {

  // ── 1. LIMPIAR datos anteriores (excepto config, usuarios, logs y caja) ─────
  db.exec(`
    DELETE FROM abonos;
    DELETE FROM creditos;
    DELETE FROM movimientos;
    DELETE FROM detalle_compras;
    DELETE FROM compras;
    DELETE FROM detalle_ventas;
    DELETE FROM ventas;
    DELETE FROM clientes;
    DELETE FROM productos;
  `);

  // ── 2. CLIENTES ──────────────────────────────────────────────────────────────
  const insCliente = db.prepare(`
    INSERT OR IGNORE INTO clientes
      (id_cliente, tipo_cliente, nombre_razon_social, tipo_documento,
       numero_documento, direccion, telefono, email, estado, fecha_registro)
    VALUES
      (@id_cliente, @tipo_cliente, @nombre_razon_social, @tipo_documento,
       @numero_documento, @direccion, @telefono, @email, @estado, @fecha_registro)
  `);
  for (const c of seedData.clientes || []) {
    insCliente.run({ ...c, estado: bool(c.estado) });
  }

  // ── 3. PRODUCTOS ─────────────────────────────────────────────────────────────
  const insProducto = db.prepare(`
    INSERT OR IGNORE INTO productos
      (id_producto, sku, codigo_barras, nombre, categoria, unidad_medida,
       precio_compra, precio_venta, stock_actual, stock_minimo,
       descripcion, imagen_url, estado, fecha_creacion, fecha_actualizacion)
    VALUES
      (@id_producto, @sku, @codigo_barras, @nombre, @categoria, @unidad_medida,
       @precio_compra, @precio_venta, @stock_actual, @stock_minimo,
       @descripcion, @imagen_url, @estado, @fecha_creacion, @fecha_actualizacion)
  `);
  for (const p of seedData.productos || []) {
    insProducto.run({
      ...p,
      codigo_barras: p.codigo_barras || null,
      estado: bool(p.estado),
    });
  }

  // ── 4. VENTAS ────────────────────────────────────────────────────────────────
  const insVenta = db.prepare(`
    INSERT OR IGNORE INTO ventas
      (id_venta, numero_venta, fecha_hora, id_cliente, tipo_comprobante,
       numero_comprobante, subtotal, igv, descuento, total,
       forma_pago, estado, usuario, notas, id_sesion_caja)
    VALUES
      (@id_venta, @numero_venta, @fecha_hora, @id_cliente, @tipo_comprobante,
       @numero_comprobante, @subtotal, @igv, @descuento, @total,
       @forma_pago, @estado, @usuario, @notas, @id_sesion_caja)
  `);
  for (const v of seedData.ventas || []) {
    insVenta.run({
      ...v,
      id_cliente:     v.id_cliente || null,
      id_sesion_caja: v.id_sesion_caja || null,
    });
  }

  // ── 5. DETALLE VENTAS ────────────────────────────────────────────────────────
  const insDetalleVenta = db.prepare(`
    INSERT OR IGNORE INTO detalle_ventas
      (id_detalle, id_venta, id_producto, nombre_producto,
       cantidad, precio_unitario, descuento_linea, subtotal_linea)
    VALUES
      (@id_detalle, @id_venta, @id_producto, @nombre_producto,
       @cantidad, @precio_unitario, @descuento_linea, @subtotal_linea)
  `);
  for (const d of seedData.detalle_ventas || []) {
    insDetalleVenta.run(d);
  }

  // ── 6. COMPRAS ───────────────────────────────────────────────────────────────
  const insCompra = db.prepare(`
    INSERT OR IGNORE INTO compras
      (id_compra, numero_oc, fecha_hora, proveedor, ruc_proveedor,
       doc_proveedor, subtotal, igv, total, estado, usuario, notas)
    VALUES
      (@id_compra, @numero_oc, @fecha_hora, @proveedor, @ruc_proveedor,
       @doc_proveedor, @subtotal, @igv, @total, @estado, @usuario, @notas)
  `);
  for (const c of seedData.compras || []) {
    insCompra.run(c);
  }

  // ── 7. DETALLE COMPRAS ───────────────────────────────────────────────────────
  const insDetalleCompra = db.prepare(`
    INSERT OR IGNORE INTO detalle_compras
      (id_detalle, id_compra, id_producto, nombre_producto,
       cantidad, precio_unitario, subtotal_linea)
    VALUES
      (@id_detalle, @id_compra, @id_producto, @nombre_producto,
       @cantidad, @precio_unitario, @subtotal_linea)
  `);
  for (const d of seedData.detalle_compras || []) {
    insDetalleCompra.run(d);
  }

  // ── 8. MOVIMIENTOS ───────────────────────────────────────────────────────────
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
  for (const m of seedData.movimientos || []) {
    insMov.run(m);
  }

  // ── 9. CRÉDITOS ──────────────────────────────────────────────────────────────
  const insCredito = db.prepare(`
    INSERT OR IGNORE INTO creditos
      (id_credito, id_cliente, id_venta, monto_total, estado,
       fecha_vencimiento, notas, fecha_creacion)
    VALUES
      (@id_credito, @id_cliente, @id_venta, @monto_total, @estado,
       @fecha_vencimiento, @notas, @fecha_creacion)
  `);
  for (const c of seedData.creditos || []) {
    insCredito.run(c);
  }

  // ── 10. ABONOS ───────────────────────────────────────────────────────────────
  const insAbono = db.prepare(`
    INSERT OR IGNORE INTO abonos
      (id_abono, id_credito, monto_abonado, fecha_abono,
       medio_pago, notas, fecha_creacion)
    VALUES
      (@id_abono, @id_credito, @monto_abonado, @fecha_abono,
       @medio_pago, @notas, @fecha_creacion)
  `);
  for (const a of seedData.abonos || []) {
    insAbono.run(a);
  }

  // ── 11. ACTUALIZAR CORRELATIVOS EN CONFIG ────────────────────────────────────
  //   Solo actualiza los contadores de comprobantes; respeta el resto
  //   (nombre empresa, RUC, series, etc.) que ya está en la BD.
  const updConfig = db.prepare(
    `INSERT OR REPLACE INTO config (clave, valor) VALUES (@clave, @valor)`
  );
  updConfig.run({ clave: 'correlativo_boleta',   valor: String(seedData.config.boleta_counter  || 1) });
  updConfig.run({ clave: 'correlativo_factura',  valor: String(seedData.config.factura_counter || 1) });
});

// ── Ejecutar ──────────────────────────────────────────────────────────────────
try {
  cargar();
  db.pragma('foreign_keys = ON');

  // ── Verificación rápida ───────────────────────────────────────────────────
  const count = t => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;

  console.log('');
  console.log('  ✓ Datos de demostración cargados correctamente en inventario.db');
  console.log('  ──────────────────────────────────────────────────────────────');
  console.log(`  ✓ Productos    : ${count('productos')}`);
  console.log(`  ✓ Clientes     : ${count('clientes')}`);
  console.log(`  ✓ Ventas       : ${count('ventas')}`);
  console.log(`  ✓ Compras      : ${count('compras')}`);
  console.log(`  ✓ Movimientos  : ${count('movimientos')}`);
  console.log(`  ✓ Créditos     : ${count('creditos')}`);
  console.log(`  ✓ Abonos       : ${count('abonos')}`);
  console.log('');
} catch (err) {
  console.error('\n  ✗ Error al cargar demo:', err.message);
  process.exit(1);
} finally {
  db.close();
}
