const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// ── Ruta de la BD: usa DB_PATH si viene de Electron, si no usa la local ───────
const dbPath = process.env.DB_PATH || path.join(__dirname, 'inventario.db');

// ── Crear carpeta si no existe (necesario en máquinas nuevas) ─────────────────
const dirPath = path.dirname(dbPath);
if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
}

// ── Conexión única (singleton) ────────────────────────────────────────────────
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ══════════════════════════════════════════════════════════════════════════════
//  AUTO-MIGRACIÓN: crea las tablas si no existen (BD nueva o vacía)
//  Usa CREATE TABLE IF NOT EXISTS → seguro de ejecutar siempre al arrancar.
// ══════════════════════════════════════════════════════════════════════════════
function inicializarBaseDeDatos() {
    db.exec(`
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

        CREATE TABLE IF NOT EXISTS productos (
            id_producto          TEXT PRIMARY KEY,
            sku                  TEXT NOT NULL UNIQUE,
            nombre               TEXT NOT NULL,
            categoria            TEXT,
            unidad_medida        TEXT,
            precio_compra        REAL NOT NULL DEFAULT 0,
            precio_venta         REAL NOT NULL DEFAULT 0,
            stock_actual         REAL NOT NULL DEFAULT 0,
            stock_minimo         REAL NOT NULL DEFAULT 0,
            descripcion          TEXT DEFAULT '',
            imagen_url           TEXT DEFAULT '',
            estado               INTEGER NOT NULL DEFAULT 1,
            fecha_creacion       TEXT NOT NULL,
            fecha_actualizacion  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ventas (
            id_venta            TEXT PRIMARY KEY,
            numero_venta        TEXT NOT NULL,
            fecha_hora          TEXT NOT NULL,
            id_cliente          TEXT,
            tipo_comprobante    TEXT NOT NULL,
            numero_comprobante  TEXT,
            subtotal            REAL NOT NULL DEFAULT 0,
            igv                 REAL NOT NULL DEFAULT 0,
            descuento           REAL NOT NULL DEFAULT 0,
            total               REAL NOT NULL DEFAULT 0,
            forma_pago          TEXT NOT NULL,
            estado              TEXT NOT NULL DEFAULT 'ACTIVA',
            usuario             TEXT,
            notas               TEXT,
            FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        );

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

        CREATE TABLE IF NOT EXISTS compras (
            id_compra       TEXT PRIMARY KEY,
            numero_oc       TEXT NOT NULL,
            fecha_hora      TEXT NOT NULL,
            proveedor       TEXT NOT NULL,
            ruc_proveedor   TEXT,
            doc_proveedor   TEXT,
            subtotal        REAL NOT NULL DEFAULT 0,
            igv             REAL NOT NULL DEFAULT 0,
            total           REAL NOT NULL DEFAULT 0,
            estado          TEXT NOT NULL DEFAULT 'ACTIVA',
            usuario         TEXT,
            notas           TEXT
        );

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

        CREATE TABLE IF NOT EXISTS movimientos (
            id_movimiento   TEXT PRIMARY KEY,
            fecha_hora      TEXT NOT NULL,
            id_producto     TEXT NOT NULL,
            nombre_producto TEXT NOT NULL,
            tipo_movimiento TEXT NOT NULL,
            cantidad        REAL NOT NULL,
            stock_anterior  REAL NOT NULL,
            stock_nuevo     REAL NOT NULL,
            referencia      TEXT,
            motivo          TEXT,
            usuario         TEXT,
            FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
        );

        CREATE TABLE IF NOT EXISTS config (
            clave TEXT PRIMARY KEY,
            valor TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS creditos (
            id_credito        TEXT PRIMARY KEY,
            id_cliente        TEXT NOT NULL,
            id_venta          TEXT,
            monto_total       REAL NOT NULL DEFAULT 0,
            estado            TEXT NOT NULL DEFAULT 'PENDIENTE',
            fecha_vencimiento TEXT,
            notas             TEXT DEFAULT '',
            fecha_creacion    TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS abonos (
            id_abono       TEXT PRIMARY KEY,
            id_credito     TEXT NOT NULL,
            monto_abonado  REAL NOT NULL,
            fecha_abono    TEXT NOT NULL,
            medio_pago     TEXT DEFAULT 'EFECTIVO',
            notas          TEXT DEFAULT '',
            fecha_creacion TEXT NOT NULL,
            FOREIGN KEY (id_credito) REFERENCES creditos(id_credito)
        );

        -- ═══════════════════════════════════════════════════════════
        --  MÓDULO DE CAJA — Sesiones de apertura/cierre
        --  NOTA: total_tarjeta se mantiene en la tabla por compatibilidad
        --  con datos históricos, pero ya no se usa en nuevas ventas.
        -- ═══════════════════════════════════════════════════════════
        CREATE TABLE IF NOT EXISTS sesiones_caja (
            id_sesion         TEXT PRIMARY KEY,
            usuario           TEXT NOT NULL,
            fecha_apertura    TEXT NOT NULL,
            monto_apertura    REAL NOT NULL DEFAULT 0,
            fecha_cierre      TEXT,
            monto_cierre_real REAL,
            monto_esperado    REAL,
            diferencia        REAL,
            total_ventas      REAL NOT NULL DEFAULT 0,
            total_efectivo    REAL NOT NULL DEFAULT 0,
            total_tarjeta     REAL NOT NULL DEFAULT 0,
            total_yape_plin   REAL NOT NULL DEFAULT 0,
            total_otros       REAL NOT NULL DEFAULT 0,
            cantidad_ventas   INTEGER NOT NULL DEFAULT 0,
            notas_cierre      TEXT DEFAULT '',
            estado            TEXT NOT NULL DEFAULT 'ABIERTA'
        );

        -- Movimientos manuales de caja (ingresos/egresos de efectivo)
        CREATE TABLE IF NOT EXISTS movimientos_caja (
            id_movimiento_caja TEXT PRIMARY KEY,
            id_sesion          TEXT NOT NULL,
            tipo               TEXT NOT NULL,
            monto              REAL NOT NULL,
            concepto           TEXT NOT NULL,
            fecha_hora         TEXT NOT NULL,
            usuario            TEXT NOT NULL,
            medio_pago         TEXT NOT NULL DEFAULT 'EFECTIVO',
            referencia_tipo    TEXT,
            FOREIGN KEY (id_sesion) REFERENCES sesiones_caja(id_sesion)
        );

        -- ═══════════════════════════════════════════════════════════
        --  MÓDULO DE USUARIOS
        -- ═══════════════════════════════════════════════════════════
        CREATE TABLE IF NOT EXISTS usuarios (
            id_usuario      TEXT PRIMARY KEY,
            username        TEXT UNIQUE NOT NULL,
            password_hash   TEXT NOT NULL,
            nombre_completo TEXT NOT NULL,
            rol             TEXT NOT NULL CHECK(rol IN ('ADMIN', 'CAJERO')),
            estado          TEXT NOT NULL DEFAULT 'ACTIVO' CHECK(estado IN ('ACTIVO', 'INACTIVO')),
            fecha_creacion  TEXT NOT NULL
        );
        -- ═══════════════════════════════════════════════════════════
        --  MÓDULO DE LOGS (AUDITORÍA)
        -- ═══════════════════════════════════════════════════════════
        CREATE TABLE IF NOT EXISTS logs (
            id_log          TEXT PRIMARY KEY,
            fecha_hora      TEXT NOT NULL,
            usuario         TEXT NOT NULL,
            accion          TEXT NOT NULL,
            modulo          TEXT NOT NULL,
            detalles        TEXT,
            ip              TEXT
        );

        CREATE TABLE IF NOT EXISTS cpe_eventos (
            id_evento     TEXT PRIMARY KEY,
            id_venta      TEXT NOT NULL,
            operacion     TEXT NOT NULL,
            estado        TEXT NOT NULL,
            request_json  TEXT,
            response_json TEXT,
            mensaje       TEXT,
            usuario       TEXT,
            fecha_hora    TEXT NOT NULL,
            FOREIGN KEY (id_venta) REFERENCES ventas(id_venta)
        );

        CREATE TABLE IF NOT EXISTS cpe_documentos (
            id_cpe             TEXT PRIMARY KEY,
            id_venta           TEXT NOT NULL,
            proveedor          TEXT NOT NULL DEFAULT 'nubefact',
            tipo_comprobante   TEXT NOT NULL,
            serie              TEXT NOT NULL,
            numero             TEXT NOT NULL,
            estado             TEXT NOT NULL DEFAULT 'POR_EMITIR',
            codigo_hash        TEXT DEFAULT '',
            enlace_pdf         TEXT DEFAULT '',
            enlace_xml         TEXT DEFAULT '',
            enlace_cdr         TEXT DEFAULT '',
            request_json       TEXT,
            response_json      TEXT,
            ultimo_error       TEXT DEFAULT '',
            intentos           INTEGER NOT NULL DEFAULT 0,
            fecha_creacion     TEXT NOT NULL,
            fecha_actualizacion TEXT NOT NULL,
            fecha_aceptacion   TEXT,
            usuario            TEXT,
            UNIQUE (proveedor, tipo_comprobante, serie, numero),
            FOREIGN KEY (id_venta) REFERENCES ventas(id_venta)
        );

        CREATE TABLE IF NOT EXISTS almacenes (
            id_almacen     TEXT PRIMARY KEY,
            nombre         TEXT NOT NULL,
            descripcion    TEXT DEFAULT '',
            es_principal   INTEGER NOT NULL DEFAULT 0,
            estado         INTEGER NOT NULL DEFAULT 1,
            fecha_creacion TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS stock_almacen (
            id_almacen    TEXT NOT NULL,
            id_producto   TEXT NOT NULL,
            stock_actual  REAL NOT NULL DEFAULT 0,
            stock_minimo  REAL NOT NULL DEFAULT 0,
            PRIMARY KEY (id_almacen, id_producto),
            FOREIGN KEY (id_almacen) REFERENCES almacenes(id_almacen),
            FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
        );

        CREATE TABLE IF NOT EXISTS devoluciones (
            id_devolucion TEXT PRIMARY KEY,
            id_venta      TEXT NOT NULL,
            fecha_hora    TEXT NOT NULL,
            motivo        TEXT NOT NULL,
            total         REAL NOT NULL DEFAULT 0,
            usuario       TEXT,
            requiere_nota_credito INTEGER NOT NULL DEFAULT 0,
            estado        TEXT NOT NULL DEFAULT 'REGISTRADA',
            FOREIGN KEY (id_venta) REFERENCES ventas(id_venta)
        );

        CREATE TABLE IF NOT EXISTS detalle_devoluciones (
            id_detalle       TEXT PRIMARY KEY,
            id_devolucion    TEXT NOT NULL,
            id_detalle_venta TEXT NOT NULL,
            id_producto      TEXT NOT NULL,
            nombre_producto  TEXT NOT NULL,
            cantidad         REAL NOT NULL,
            precio_unitario  REAL NOT NULL,
            subtotal_linea   REAL NOT NULL,
            FOREIGN KEY (id_devolucion) REFERENCES devoluciones(id_devolucion),
            FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
        );

        CREATE TABLE IF NOT EXISTS proveedores (
            id_proveedor   TEXT PRIMARY KEY,
            razon_social   TEXT NOT NULL,
            ruc            TEXT,
            direccion      TEXT DEFAULT '',
            telefono       TEXT DEFAULT '',
            email          TEXT DEFAULT '',
            estado         INTEGER NOT NULL DEFAULT 1,
            fecha_creacion TEXT NOT NULL
        );

        CREATE TRIGGER IF NOT EXISTS prevent_negative_stock
        BEFORE UPDATE ON productos
        WHEN NEW.stock_actual < 0
        BEGIN
            SELECT RAISE(ABORT, 'Stock insuficiente o negativo');
        END;
    `);

    // ── Poblar config base si la tabla quedó vacía (instalación nueva) ────────
    const { c } = db.prepare('SELECT COUNT(*) AS c FROM config').get();
    if (c === 0) {
        const configInicial = db.prepare(
            `INSERT INTO config (clave, valor) VALUES (@clave, @valor)`
        );
        const poblar = db.transaction(() => {
            const defaults = [
                ['empresa_nombre',       'Mi Empresa'],
                ['empresa_nombre_corto', 'Mi Empresa'],
                ['empresa_ruc',          ''],
                ['empresa_direccion',    ''],
                ['empresa_distrito',     ''],
                ['empresa_provincia',    ''],
                ['empresa_departamento', ''],
                ['empresa_telefono',     ''],
                ['empresa_email',        ''],
                ['serie_boleta',         'B001'],
                ['serie_factura',        'F001'],
                ['correlativo_boleta',   '1'],
                ['correlativo_factura',  '1'],
                ['moneda',               'SOLES'],
                ['igv',                  '18'],
                ['sunat_activo',  '0'],
                ['sunat_token',   ''],
                ['sunat_url',     ''],
                ['sunat_modo',    'demo'],
                ['cpe_proveedor', 'nubefact'],
                ['cpe_envio_email_cliente', '1'],
                ['cpe_formato_pdf', 'A4'],
            ];
            for (const [clave, valor] of defaults) {
                configInicial.run({ clave, valor });
            }
        });
        poblar();
        console.log('[DB] Base de datos inicializada con configuración por defecto.');
    }

    // El administrador inicial se crea desde /api/setup/admin-inicial.
}

// Ejecutar siempre al arrancar — es idempotente (IF NOT EXISTS)
inicializarBaseDeDatos();

// ══════════════════════════════════════════════════════════════════════════════
//  MIGRACIONES SEGURAS (ALTER TABLE)
//  Agregan columnas nuevas a tablas existentes sin perder datos.
//  El try/catch evita errores si la columna ya existe.
// ══════════════════════════════════════════════════════════════════════════════
try {
    db.prepare('SELECT id_sesion_caja FROM ventas LIMIT 1').get();
} catch (_) {
    db.exec('ALTER TABLE ventas ADD COLUMN id_sesion_caja TEXT');
    console.log('[DB] Migración: columna id_sesion_caja agregada a ventas.');
}

const migraciones = [
    `ALTER TABLE productos ADD COLUMN codigo_barras TEXT DEFAULT ''`,
    `ALTER TABLE ventas    ADD COLUMN id_sesion_caja TEXT`,
    // Desglose de pago por canal: efectivo + yape/plin (monto_tarjeta se conserva por datos históricos)
    `ALTER TABLE ventas    ADD COLUMN monto_efectivo  REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE ventas    ADD COLUMN monto_tarjeta   REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE ventas    ADD COLUMN monto_yape_plin REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE ventas ADD COLUMN cpe_estado      TEXT DEFAULT ''`,
    `ALTER TABLE ventas ADD COLUMN cpe_codigo_hash TEXT DEFAULT ''`,
    `ALTER TABLE ventas ADD COLUMN cpe_enlace_pdf  TEXT DEFAULT ''`,
    `ALTER TABLE ventas ADD COLUMN cpe_enlace_xml  TEXT DEFAULT ''`,
    // Medio de pago en movimientos de caja (abonos de crédito)
    `ALTER TABLE movimientos_caja ADD COLUMN medio_pago TEXT NOT NULL DEFAULT 'EFECTIVO'`,
    `ALTER TABLE movimientos_caja ADD COLUMN referencia_tipo TEXT`,
    `ALTER TABLE movimientos_caja ADD COLUMN referencia_id TEXT`,
    // M4: referencia estructurada en auditoría (permite filtrar por entidad)
    `ALTER TABLE logs ADD COLUMN id_referencia TEXT`,
    `ALTER TABLE logs ADD COLUMN tipo_referencia TEXT`,
    `ALTER TABLE usuarios ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE ventas ADD COLUMN nota_credito_serie TEXT DEFAULT ''`,
    `ALTER TABLE ventas ADD COLUMN nota_credito_numero TEXT DEFAULT ''`,
    `ALTER TABLE ventas ADD COLUMN nota_credito_fecha TEXT DEFAULT ''`,
    `ALTER TABLE ventas ADD COLUMN nota_credito_observacion TEXT DEFAULT ''`,
    `ALTER TABLE compras ADD COLUMN id_proveedor TEXT`,
    `ALTER TABLE cpe_documentos ADD COLUMN enlace_cdr TEXT DEFAULT ''`,
    `ALTER TABLE cpe_documentos ADD COLUMN ultimo_error TEXT DEFAULT ''`,
    `ALTER TABLE cpe_documentos ADD COLUMN intentos INTEGER NOT NULL DEFAULT 0`,
];
for (const sql of migraciones) {
    try { db.exec(sql); } catch (_) { /* columna ya existe, ignorar */ }
}

// ── Claves de configuración nuevas (SUNAT/NubeFact) ───────
const configNuevas = [
    ['sunat_activo', '0'],
    ['sunat_token',  ''],
    ['sunat_url',    ''],
    ['sunat_modo',   'demo'],
    ['cpe_proveedor', 'nubefact'],
    ['cpe_formato_pdf', 'A4'],
    ['cpe_envio_email_cliente', '1'],
    ['almacen_principal_id', 'alm-principal'],
    ['backup_externo_dir', ''],
    ['backup_externo_activo', '0'],
];
const insConfig = db.prepare(`INSERT OR IGNORE INTO config (clave, valor) VALUES (?, ?)`);
for (const [clave, valor] of configNuevas) {
    insConfig.run(clave, valor);
}

db.transaction(() => {
    const principal = db.prepare(`SELECT id_almacen FROM almacenes WHERE id_almacen = ?`).get('alm-principal');
    if (!principal) {
        db.prepare(`
            INSERT INTO almacenes (id_almacen, nombre, descripcion, es_principal, estado, fecha_creacion)
            VALUES ('alm-principal', 'Tienda Principal', 'Almacen principal migrado automaticamente', 1, 1, ?)
        `).run(new Date().toISOString());
    }

    const productosStock = db.prepare(`SELECT id_producto, stock_actual, stock_minimo FROM productos`).all();
    const insStock = db.prepare(`
        INSERT OR IGNORE INTO stock_almacen (id_almacen, id_producto, stock_actual, stock_minimo)
        VALUES ('alm-principal', @id_producto, @stock_actual, @stock_minimo)
    `);
    for (const p of productosStock) insStock.run(p);
})();

try {
    db.prepare('SELECT codigo_barras FROM productos LIMIT 1').get();
} catch (_) {
    db.exec('ALTER TABLE productos ADD COLUMN codigo_barras TEXT');
    console.log('[DB] Migración: columna codigo_barras agregada a productos.');
}

try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras ON productos(codigo_barras)');
} catch (_) { /* índice ya existe, ignorar */ }

// ── Índices de rendimiento ────────────────────────────────────────────────────
const indices = [
    `CREATE INDEX IF NOT EXISTS idx_ventas_sesion           ON ventas(id_sesion_caja)`,
    `CREATE INDEX IF NOT EXISTS idx_ventas_fecha            ON ventas(fecha_hora)`,
    `CREATE INDEX IF NOT EXISTS idx_ventas_cliente          ON ventas(id_cliente)`,
    `CREATE INDEX IF NOT EXISTS idx_detalle_ventas_venta    ON detalle_ventas(id_venta)`,
    `CREATE INDEX IF NOT EXISTS idx_detalle_ventas_producto ON detalle_ventas(id_producto)`,
    `CREATE INDEX IF NOT EXISTS idx_movimientos_producto    ON movimientos(id_producto)`,
    `CREATE INDEX IF NOT EXISTS idx_movimientos_fecha       ON movimientos(fecha_hora)`,
    `CREATE INDEX IF NOT EXISTS idx_creditos_cliente        ON creditos(id_cliente)`,
    `CREATE INDEX IF NOT EXISTS idx_creditos_estado         ON creditos(estado)`,
    `CREATE INDEX IF NOT EXISTS idx_abonos_credito          ON abonos(id_credito)`,
    `CREATE INDEX IF NOT EXISTS idx_logs_fecha              ON logs(fecha_hora)`,
    `CREATE INDEX IF NOT EXISTS idx_logs_modulo             ON logs(modulo)`,
    `CREATE INDEX IF NOT EXISTS idx_logs_usuario            ON logs(usuario)`,
    `CREATE INDEX IF NOT EXISTS idx_mov_caja_sesion         ON movimientos_caja(id_sesion)`,
];
for (const sql of indices) {
    try { db.exec(sql); } catch (_) { /* índice ya existe, ignorar */ }
}

// ══════════════════════════════════════════════════════════════════════════════
//  PRODUCTOS
// ══════════════════════════════════════════════════════════════════════════════
const productos = {

  listar: () =>
    db.prepare(`
      SELECT id_producto, sku, codigo_barras, nombre, categoria, unidad_medida,
             precio_compra, precio_venta, stock_actual, stock_minimo, estado, fecha_creacion
      FROM productos
      ORDER BY nombre ASC
    `).all(),

  buscar: (termino) =>
    db.prepare(`
      SELECT id_producto, sku, codigo_barras, nombre, categoria, unidad_medida,
             precio_venta, stock_actual, stock_minimo
      FROM productos
      WHERE estado = 1
        AND (nombre LIKE @q OR sku LIKE @q OR codigo_barras LIKE @q OR categoria LIKE @q)
      ORDER BY nombre ASC
      LIMIT 50
    `).all({ q: `%${termino}%` }),

  obtener: (id) =>
    db.prepare(`SELECT * FROM productos WHERE id_producto = ?`).get(id),

  obtenerPorSku: (sku) =>
    db.prepare(`SELECT * FROM productos WHERE sku = ?`).get(sku),

  stockBajo: () =>
    db.prepare(`
      SELECT id_producto, sku, nombre, stock_actual, stock_minimo, categoria
      FROM productos
      WHERE estado = 1 AND stock_actual <= stock_minimo
      ORDER BY (stock_actual - stock_minimo) ASC
    `).all(),

  crear: (p) =>
    db.prepare(`
      INSERT INTO productos
        (id_producto, sku, codigo_barras, nombre, categoria, unidad_medida, precio_compra,
         precio_venta, stock_actual, stock_minimo, descripcion, imagen_url,
         estado, fecha_creacion, fecha_actualizacion)
      VALUES
        (@id_producto, @sku, @codigo_barras, @nombre, @categoria, @unidad_medida, @precio_compra,
         @precio_venta, @stock_actual, @stock_minimo, @descripcion, @imagen_url,
         @estado, @fecha_creacion, @fecha_actualizacion)
    `).run({ ...p, codigo_barras: p.codigo_barras || null }),

  actualizar: (p) =>
    db.prepare(`
      UPDATE productos SET
        sku = @sku, codigo_barras = @codigo_barras, nombre = @nombre, categoria = @categoria,
        unidad_medida = @unidad_medida, precio_compra = @precio_compra,
        precio_venta = @precio_venta, stock_minimo = @stock_minimo,
        descripcion = @descripcion, imagen_url = @imagen_url,
        estado = @estado, fecha_actualizacion = @fecha_actualizacion
      WHERE id_producto = @id_producto
    `).run({ ...p, codigo_barras: p.codigo_barras || null }),

  actualizarStock: (id_producto, stock_nuevo) =>
    db.prepare(`
      UPDATE productos
      SET stock_actual = @stock_nuevo,
          fecha_actualizacion = datetime('now')
      WHERE id_producto = @id_producto
    `).run({ id_producto, stock_nuevo }),
};

// ══════════════════════════════════════════════════════════════════════════════
//  CLIENTES
// ══════════════════════════════════════════════════════════════════════════════
const clientes = {

  listar: () =>
    db.prepare(`
      SELECT id_cliente, tipo_cliente, nombre_razon_social,
             tipo_documento, numero_documento, telefono, estado
      FROM clientes ORDER BY nombre_razon_social ASC
    `).all(),

  buscar: (termino) =>
    db.prepare(`
      SELECT id_cliente, nombre_razon_social, tipo_documento, numero_documento, telefono
      FROM clientes
      WHERE estado = 1
        AND (nombre_razon_social LIKE @q OR numero_documento LIKE @q)
      LIMIT 20
    `).all({ q: `%${termino}%` }),

  obtener: (id) =>
    db.prepare(`SELECT * FROM clientes WHERE id_cliente = ?`).get(id),

  crear: (c) =>
    db.prepare(`
      INSERT INTO clientes
        (id_cliente, tipo_cliente, nombre_razon_social, tipo_documento,
         numero_documento, direccion, telefono, email, estado, fecha_registro)
      VALUES
        (@id_cliente, @tipo_cliente, @nombre_razon_social, @tipo_documento,
         @numero_documento, @direccion, @telefono, @email, @estado, @fecha_registro)
    `).run(c),

  actualizar: (c) =>
    db.prepare(`
      UPDATE clientes SET
        tipo_cliente = @tipo_cliente, nombre_razon_social = @nombre_razon_social,
        tipo_documento = @tipo_documento, numero_documento = @numero_documento,
        direccion = @direccion, telefono = @telefono,
        email = @email, estado = @estado
      WHERE id_cliente = @id_cliente
    `).run(c),
};

// ══════════════════════════════════════════════════════════════════════════════
//  VENTAS
// ══════════════════════════════════════════════════════════════════════════════
const ventas = {

  listar: ({ limite = 50, offset = 0 } = {}) => {
      const ventas = db.prepare(`
          SELECT v.*,
                c.nombre_razon_social  AS cliente_nombre,
                c.tipo_documento       AS cliente_tipo_doc,
                c.numero_documento     AS cliente_num_doc,
                c.tipo_cliente         AS cliente_tipo
          FROM ventas v
          LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
          ORDER BY v.fecha_hora DESC
          LIMIT @limite OFFSET @offset
      `).all({ limite, offset });

      ventas.forEach(v => {
          const detalles = db.prepare(`
              SELECT nombre_producto, cantidad FROM detalle_ventas WHERE id_venta = ?
          `).all(v.id_venta);
          v.productos_resumen = detalles.map(d => `${d.nombre_producto} x${d.cantidad}`).join(' | ');
          v.cliente = v.id_cliente ? {
              nombre_razon_social: v.cliente_nombre,
              tipo_documento:      v.cliente_tipo_doc,
              numero_documento:    v.cliente_num_doc,
          } : null;
      });

      return ventas;
  },

  obtener: (id) => {
      const venta = db.prepare(`SELECT * FROM ventas WHERE id_venta = ?`).get(id);
      if (!venta) return null;
      if (venta.forma_pago === 'CREDITO') {
          const credito = db.prepare(`SELECT * FROM creditos WHERE id_venta = ? LIMIT 1`).get(id) || null;
          if (credito) {
              const abonos = db.prepare(`SELECT * FROM abonos WHERE id_credito = ? ORDER BY fecha_abono ASC`).all(credito.id_credito);
              const totalAbonado = abonos.reduce((sum, a) => sum + Number(a.monto_abonado), 0);
              const adelanto = abonos.find(a => a.notas === 'Adelanto al momento de la venta') || null;
              venta.credito = {
                  ...credito,
                  total_abonado:       Math.round(totalAbonado * 100) / 100,
                  saldo_pendiente:     Math.round((credito.monto_total - totalAbonado) * 100) / 100,
                  monto_adelanto:      adelanto ? Number(adelanto.monto_abonado) : 0,
                  medio_pago_adelanto: adelanto ? adelanto.medio_pago : null,
              };
          }
      }
      return venta;
  },

  obtenerDetalle: (id_venta) =>
    db.prepare(`SELECT * FROM detalle_ventas WHERE id_venta = ?`).all(id_venta),

  /**
   * Registra una venta completa (venta + detalle + stock + movimientos)
   * NOTA: monto_tarjeta ya no se usa, se guarda como 0 siempre.
   */
  registrar: db.transaction((venta, detalles) => {
    const idAlmacen = venta.id_almacen || config.obtener('almacen_principal_id') || 'alm-principal';
    // ── Validar stock DENTRO de la transacción para evitar race conditions ──
    for (const d of detalles) {
      const prod = db.prepare(
        `SELECT stock_actual, nombre FROM productos WHERE id_producto = ?`
      ).get(d.id_producto);
      if (!prod) throw new Error(`Producto no encontrado: ${d.id_producto}`);
      const stockAlmacen = db.prepare(
        `SELECT stock_actual FROM stock_almacen WHERE id_almacen = ? AND id_producto = ?`
      ).get(idAlmacen, d.id_producto);
      const disponible = stockAlmacen ? Number(stockAlmacen.stock_actual) : Number(prod.stock_actual);
      if (disponible < d.cantidad) {
        throw new Error(`Stock insuficiente para ${prod.nombre}. Disponible: ${disponible}`);
      }
    }

    db.prepare(`
      INSERT INTO ventas
        (id_venta, numero_venta, fecha_hora, id_cliente, tipo_comprobante,
         numero_comprobante, subtotal, igv, descuento, total,
         forma_pago, monto_efectivo, monto_tarjeta, monto_yape_plin,
         estado, usuario, notas, id_sesion_caja)
      VALUES
        (@id_venta, @numero_venta, @fecha_hora, @id_cliente, @tipo_comprobante,
         @numero_comprobante, @subtotal, @igv, @descuento, @total,
         @forma_pago, @monto_efectivo, 0, @monto_yape_plin,
         @estado, @usuario, @notas, @id_sesion_caja)
    `).run(venta);

    const insDetalle = db.prepare(`
      INSERT INTO detalle_ventas
        (id_detalle, id_venta, id_producto, nombre_producto,
         cantidad, precio_unitario, descuento_linea, subtotal_linea)
      VALUES
        (@id_detalle, @id_venta, @id_producto, @nombre_producto,
         @cantidad, @precio_unitario, @descuento_linea, @subtotal_linea)
    `);

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

    for (const d of detalles) {
      insDetalle.run(d);

      const prod = db.prepare(
        `SELECT stock_actual FROM productos WHERE id_producto = ?`
      ).get(d.id_producto);

      const stock_nuevo = prod.stock_actual - d.cantidad;

      db.prepare(`
        UPDATE productos SET stock_actual = ?, fecha_actualizacion = datetime('now')
        WHERE id_producto = ?
      `).run(stock_nuevo, d.id_producto);

      db.prepare(`
        INSERT INTO stock_almacen (id_almacen, id_producto, stock_actual, stock_minimo)
        VALUES (?, ?, 0, 0)
        ON CONFLICT(id_almacen, id_producto) DO NOTHING
      `).run(idAlmacen, d.id_producto);
      db.prepare(`
        UPDATE stock_almacen SET stock_actual = stock_actual - ?
        WHERE id_almacen = ? AND id_producto = ?
      `).run(d.cantidad, idAlmacen, d.id_producto);

      insMov.run({
        id_movimiento  : d.id_detalle + '-mov',
        fecha_hora     : venta.fecha_hora,
        id_producto    : d.id_producto,
        nombre_producto: d.nombre_producto,
        tipo_movimiento: 'SALIDA',
        cantidad       : d.cantidad,
        stock_anterior : prod.stock_actual,
        stock_nuevo,
        referencia     : venta.numero_venta,
        motivo         : '',
        usuario        : venta.usuario,
      });
    }

    return { ok: true, id_venta: venta.id_venta };
  }),

  resumenDiario: (dias = 30) =>
    db.prepare(`
      SELECT DATE(fecha_hora) AS dia,
             COUNT(*)         AS cantidad,
             SUM(total)       AS total
      FROM ventas
      WHERE estado = 'ACTIVA'
        AND fecha_hora >= DATE('now', '-' || @dias || ' days')
      GROUP BY dia
      ORDER BY dia DESC
    `).all({ dias }),
};

// ══════════════════════════════════════════════════════════════════════════════
//  COMPRAS
// ══════════════════════════════════════════════════════════════════════════════
const compras = {

  listar: ({ limite = 50, offset = 0 } = {}) =>
    db.prepare(`
      SELECT id_compra, numero_oc, fecha_hora, id_proveedor, proveedor, ruc_proveedor,
             doc_proveedor, subtotal, igv, total, estado, notas
      FROM compras
      ORDER BY fecha_hora DESC
      LIMIT @limite OFFSET @offset
    `).all({ limite, offset }),

  obtener: (id) =>
    db.prepare(`SELECT * FROM compras WHERE id_compra = ?`).get(id),

  obtenerDetalle: (id_compra) =>
    db.prepare(`
      SELECT dc.*, p.sku
      FROM detalle_compras dc
      LEFT JOIN productos p ON p.id_producto = dc.id_producto
      WHERE dc.id_compra = ?
    `).all(id_compra),

  registrar: db.transaction((compra, detalles) => {
    const idAlmacen = compra.id_almacen || config.obtener('almacen_principal_id') || 'alm-principal';
    db.prepare(`
      INSERT INTO compras
        (id_compra, numero_oc, fecha_hora, id_proveedor, proveedor, ruc_proveedor,
         doc_proveedor, subtotal, igv, total, estado, usuario, notas)
      VALUES
        (@id_compra, @numero_oc, @fecha_hora, @id_proveedor, @proveedor, @ruc_proveedor,
         @doc_proveedor, @subtotal, @igv, @total, @estado, @usuario, @notas)
    `).run(compra);

    const insDetalle = db.prepare(`
      INSERT INTO detalle_compras
        (id_detalle, id_compra, id_producto, nombre_producto,
         cantidad, precio_unitario, subtotal_linea)
      VALUES
        (@id_detalle, @id_compra, @id_producto, @nombre_producto,
         @cantidad, @precio_unitario, @subtotal_linea)
    `);

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

    for (const d of detalles) {
      insDetalle.run(d);

      const prod = db.prepare(
        `SELECT stock_actual FROM productos WHERE id_producto = ?`
      ).get(d.id_producto);

      const stock_nuevo = prod.stock_actual + d.cantidad;

      db.prepare(`
        UPDATE productos SET stock_actual = ?, fecha_actualizacion = datetime('now')
        WHERE id_producto = ?
      `).run(stock_nuevo, d.id_producto);
      db.prepare(`
        INSERT INTO stock_almacen (id_almacen, id_producto, stock_actual, stock_minimo)
        VALUES (?, ?, 0, 0)
        ON CONFLICT(id_almacen, id_producto) DO NOTHING
      `).run(idAlmacen, d.id_producto);
      db.prepare(`
        UPDATE stock_almacen SET stock_actual = stock_actual + ?
        WHERE id_almacen = ? AND id_producto = ?
      `).run(d.cantidad, idAlmacen, d.id_producto);

      insMov.run({
        id_movimiento  : d.id_detalle + '-mov',
        fecha_hora     : compra.fecha_hora,
        id_producto    : d.id_producto,
        nombre_producto: d.nombre_producto,
        tipo_movimiento: 'ENTRADA',
        cantidad       : d.cantidad,
        stock_anterior : prod.stock_actual,
        stock_nuevo,
        referencia     : compra.numero_oc,
        motivo         : '',
        usuario        : compra.usuario,
      });
    }
    return { ok: true };
  }),
};

// ══════════════════════════════════════════════════════════════════════════════
//  MOVIMIENTOS
// ══════════════════════════════════════════════════════════════════════════════
const movimientos = {

  listar: ({ limite = 100, offset = 0, id_producto, fecha_desde, fecha_hasta } = {}) => {
    let sql = `SELECT * FROM movimientos WHERE 1=1`;
    const params = { limite, offset };

    if (id_producto) {
      sql += ` AND id_producto = @id_producto`;
      params.id_producto = id_producto;
    }
    if (fecha_desde) {
      sql += ` AND fecha_hora >= @fecha_desde`;
      params.fecha_desde = new Date(fecha_desde + 'T00:00:00.000Z').getTime() - (-300 * 60 * 1000);
      params.fecha_desde = new Date(params.fecha_desde).toISOString();
    }
    if (fecha_hasta) {
      sql += ` AND fecha_hora <= @fecha_hasta`;
      params.fecha_hasta = new Date(fecha_hasta + 'T23:59:59.999Z').getTime() - (-300 * 60 * 1000);
      params.fecha_hasta = new Date(params.fecha_hasta).toISOString();
    }

    sql += ` ORDER BY fecha_hora DESC LIMIT @limite OFFSET @offset`;
    return db.prepare(sql).all(params);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════════════════════════════════
const config = {

  obtenerTodo: () => {
    const rows = db.prepare(`SELECT clave, valor FROM config`).all();
    return Object.fromEntries(rows.map(r => [r.clave, r.valor]));
  },

  obtener: (clave) => {
    const row = db.prepare(`SELECT valor FROM config WHERE clave = ?`).get(clave);
    return row ? row.valor : null;
  },

  guardar: (clave, valor) =>
    db.prepare(
      `INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)`
    ).run(clave, String(valor)),

  guardarTodo: db.transaction((obj) => {
    const ins = db.prepare(
      `INSERT OR REPLACE INTO config (clave, valor) VALUES (@clave, @valor)`
    );
    for (const [clave, valor] of Object.entries(obj)) {
      ins.run({ clave, valor: String(valor) });
    }
  }),
};

// ══════════════════════════════════════════════════════════════════════════════
//  CAJA — Sesiones de apertura/cierre y movimientos manuales
// ══════════════════════════════════════════════════════════════════════════════
const caja = {

  obtenerSesionAbierta: () =>
    db.prepare(`SELECT * FROM sesiones_caja WHERE estado = 'ABIERTA' LIMIT 1`).get() || null,

  obtenerSesion: (id_sesion) =>
    db.prepare(`SELECT * FROM sesiones_caja WHERE id_sesion = ?`).get(id_sesion),

  listarSesiones: ({ limite = 50, offset = 0 } = {}) =>
    db.prepare(`
      SELECT * FROM sesiones_caja
      ORDER BY fecha_apertura DESC
      LIMIT @limite OFFSET @offset
    `).all({ limite, offset }),

  abrir: (sesion) =>
    db.prepare(`
      INSERT INTO sesiones_caja
        (id_sesion, usuario, fecha_apertura, monto_apertura, estado)
      VALUES
        (@id_sesion, @usuario, @fecha_apertura, @monto_apertura, 'ABIERTA')
    `).run(sesion),

  /**
   * Cierra la sesión activa.
   * total_tarjeta se pasa como 0 — se mantiene la columna por compatibilidad histórica.
   */
  cerrar: (datos) =>
    db.prepare(`
      UPDATE sesiones_caja SET
        fecha_cierre      = @fecha_cierre,
        monto_cierre_real = @monto_cierre_real,
        monto_esperado    = @monto_esperado,
        diferencia        = @diferencia,
        total_ventas      = @total_ventas,
        total_efectivo    = @total_efectivo,
        total_tarjeta     = 0,
        total_yape_plin   = @total_yape_plin,
        total_otros       = @total_otros,
        cantidad_ventas   = @cantidad_ventas,
        notas_cierre      = @notas_cierre,
        estado            = 'CERRADA'
      WHERE id_sesion = @id_sesion
    `).run(datos),

  obtenerVentasDeSesion: (id_sesion) =>
    db.prepare(`
      SELECT v.*, c.nombre_razon_social AS cliente
      FROM ventas v
      LEFT JOIN clientes c ON c.id_cliente = v.id_cliente
      WHERE v.id_sesion_caja = ?
      ORDER BY v.fecha_hora DESC
    `).all(id_sesion),

  /**
   * Calcula los totales de ventas por medio de pago para una sesión.
   * Canales: EFECTIVO, YAPE_PLIN, TRANSFERENCIA (en total_otros), MIXTO.
   */
  calcularTotalesSesion: (id_sesion) => {
    // ── Totales de ventas directas ────────────────────────────────────────
    const ventasRow = db.prepare(`
      SELECT
        COUNT(*)                              AS cantidad_ventas,
        COALESCE(SUM(total), 0)              AS total_ventas,
        COALESCE(SUM(
          CASE
            WHEN monto_efectivo > 0 THEN monto_efectivo
            WHEN forma_pago = 'EFECTIVO' THEN total
            ELSE 0
          END), 0)                            AS total_efectivo,
        COALESCE(SUM(
          CASE
            WHEN monto_yape_plin > 0 THEN monto_yape_plin
            WHEN forma_pago IN ('YAPE_PLIN','YAPE','PLIN') THEN total
            ELSE 0
          END), 0)                            AS total_yape_plin,
        COALESCE(SUM(
          CASE
            WHEN monto_efectivo = 0 AND monto_yape_plin = 0
             AND forma_pago NOT IN ('EFECTIVO','YAPE_PLIN','YAPE','PLIN','CREDITO','MIXTO')
            -- TRANSFERENCIA cae aquí (total_otros)
            THEN total
            ELSE 0
          END), 0)                            AS total_otros
      FROM ventas
      WHERE id_sesion_caja = ? AND estado = 'ACTIVA'
    `).get(id_sesion);

    // ── Abonos de crédito cobrados en esta sesión, desglosados por canal ─
    const abonos = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN mc.medio_pago = 'EFECTIVO'                       THEN mc.monto ELSE 0 END), 0) AS ef,
        COALESCE(SUM(CASE WHEN mc.medio_pago IN ('YAPE_PLIN','YAPE','PLIN')     THEN mc.monto ELSE 0 END), 0) AS yp,
        COALESCE(SUM(CASE WHEN mc.medio_pago NOT IN ('EFECTIVO','YAPE_PLIN','YAPE','PLIN') THEN mc.monto ELSE 0 END), 0) AS ot
      FROM movimientos_caja mc
      WHERE mc.id_sesion = ?
        AND mc.tipo = 'INGRESO'
        AND mc.referencia_tipo = 'ABONO_CREDITO'
    `).get(id_sesion);

    return {
      cantidad_ventas: ventasRow.cantidad_ventas,
      total_ventas:    ventasRow.total_ventas,
      total_efectivo:  ventasRow.total_efectivo  + abonos.ef,
      total_yape_plin: ventasRow.total_yape_plin + abonos.yp,
      total_otros:     ventasRow.total_otros     + abonos.ot,
    };
  },

  // ── Movimientos manuales de caja (ingresos/egresos) ─────────────────

  registrarMovimiento: (mov) =>
    db.prepare(`
      INSERT INTO movimientos_caja
        (id_movimiento_caja, id_sesion, tipo, monto, concepto, medio_pago, referencia_tipo, referencia_id, fecha_hora, usuario)
      VALUES
        (@id_movimiento_caja, @id_sesion, @tipo, @monto, @concepto, @medio_pago, @referencia_tipo, @referencia_id, @fecha_hora, @usuario)
    `).run({ medio_pago: 'EFECTIVO', referencia_tipo: null, referencia_id: null, ...mov }),

  listarMovimientos: (id_sesion) =>
    db.prepare(`
      SELECT * FROM movimientos_caja
      WHERE id_sesion = ?
      ORDER BY fecha_hora ASC
    `).all(id_sesion),

  calcularMovimientosManuales: (id_sesion) => {
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE 0 END), 0) AS total_ingresos,
        COALESCE(SUM(CASE WHEN tipo = 'EGRESO'  THEN monto ELSE 0 END), 0) AS total_egresos
      FROM movimientos_caja
      WHERE id_sesion = ?
        AND (referencia_tipo IS NULL OR referencia_tipo NOT IN ('ABONO_CREDITO','REVERSA_ABONO'))
    `).get(id_sesion);
    return row;
  },
};

// ══════════════════════════════════════════════════════════════════════════════
//  USUARIOS
// ══════════════════════════════════════════════════════════════════════════════
const usuarios = {
  listar: () =>
    db.prepare(`SELECT id_usuario, username, nombre_completo, rol, estado, token_version, fecha_creacion FROM usuarios ORDER BY nombre_completo ASC`).all(),

  obtenerPorId: (id) =>
    db.prepare(`SELECT id_usuario, username, nombre_completo, rol, estado, token_version, fecha_creacion FROM usuarios WHERE id_usuario = ?`).get(id),

  obtenerPorUsernameConPassword: (username) =>
    db.prepare(`SELECT * FROM usuarios WHERE username = ? COLLATE NOCASE`).get(username),

  crear: (u) =>
    db.prepare(`
      INSERT INTO usuarios (id_usuario, username, password_hash, nombre_completo, rol, estado, token_version, fecha_creacion)
      VALUES (@id_usuario, @username, @password_hash, @nombre_completo, @rol, @estado, COALESCE(@token_version, 0), @fecha_creacion)
    `).run({ token_version: 0, ...u }),

  actualizarInfo: (u) =>
    db.prepare(`
      UPDATE usuarios SET
        username = @username,
        nombre_completo = @nombre_completo,
        rol = @rol,
        estado = @estado,
        token_version = token_version + CASE WHEN estado != @estado THEN 1 ELSE 0 END
      WHERE id_usuario = @id_usuario
    `).run(u),

  actualizarPassword: (id_usuario, password_hash) =>
    db.prepare(`UPDATE usuarios SET password_hash = ?, token_version = token_version + 1 WHERE id_usuario = ?`).run(password_hash, id_usuario),
  eliminar: (id_usuario) =>
      db.prepare(`DELETE FROM usuarios WHERE id_usuario = ?`).run(id_usuario),
};

  

// ══════════════════════════════════════════════════════════════════════════════
//  LOGS (AUDITORÍA)
// ══════════════════════════════════════════════════════════════════════════════
const logs = {
  // ── listar ────────────────────────────────────────────────────────────────
  // Parámetros: limite, offset, modulo, usuario, accion, desde, hasta
  // Retorna los registros y un flag hayMas para paginación en el cliente.
  listar: ({ limite = 50, offset = 0, modulo = null, usuario = null, accion = null, desde = null, hasta = null } = {}) => {
    let sql = `SELECT * FROM logs WHERE 1=1 `;
    let params = { limite: limite + 1, offset }; // pedimos 1 extra para detectar hayMas

    if (modulo) {
      sql += ` AND modulo = @modulo `;
      params.modulo = modulo;
    }

    if (usuario) {
      sql += ` AND usuario = @usuario `;
      params.usuario = usuario;
    }

    // M6: filtro por tipo de acción (CREAR / MODIFICAR / ELIMINAR / LOGIN)
    if (accion) {
      sql += ` AND accion = @accion `;
      params.accion = accion.toUpperCase();
    }

    if (desde) {
      // desde es 'YYYY-MM-DD' hora negocio (UTC-5) → convertir a UTC sumando 5h
      sql += ` AND fecha_hora >= @desde `;
      params.desde = desde + 'T05:00:00.000Z';
    }

    if (hasta) {
      // fin del día del negocio (UTC-5): cubre hasta las 04:59:59.999Z del día siguiente
      // Ejemplo: hasta='2026-05-18' → cubre hasta 2026-05-19T04:59:59.999Z = 23:59:59.999 hora Lima
      sql += ` AND fecha_hora <= @hasta `;
      const diaFin = new Date(new Date(hasta + 'T05:00:00.000Z').getTime() + 86400000 - 1);
      params.hasta = diaFin.toISOString();
    }

    sql += ` ORDER BY fecha_hora DESC LIMIT @limite OFFSET @offset`;

    const rows = db.prepare(sql).all(params);
    const hayMas = rows.length > limite;
    return { logs: hayMas ? rows.slice(0, limite) : rows, hayMas };
  },

  // ── contar ────────────────────────────────────────────────────────────────
  // Cuenta el total de registros sin traerlos (para paginación)
  contar: ({ modulo = null, usuario = null, accion = null, desde = null, hasta = null } = {}) => {
    let sql = `SELECT COUNT(*) AS total FROM logs WHERE 1=1 `;
    let params = {};
    if (modulo)  { sql += ` AND modulo  = @modulo  `; params.modulo  = modulo; }
    if (usuario) { sql += ` AND usuario = @usuario `; params.usuario = usuario; }
    if (accion)  { sql += ` AND accion  = @accion  `; params.accion  = accion.toUpperCase(); }
    if (desde)   { sql += ` AND fecha_hora >= @desde `; params.desde = desde + 'T05:00:00.000Z'; }
    if (hasta)   {
      sql += ` AND fecha_hora <= @hasta `;
      const diaFin = new Date(new Date(hasta + 'T05:00:00.000Z').getTime() + 86400000 - 1);
      params.hasta = diaFin.toISOString();
    }
    return db.prepare(sql).get(params)?.total ?? 0;
  },

  // ── registrar ─────────────────────────────────────────────────────────────
  // M4: acepta id_referencia y tipo_referencia opcionales
  registrar: ({ usuario, accion, modulo, detalles, ip, fecha_hora, id_referencia = null, tipo_referencia = null }) => {
    const { randomUUID } = require('crypto');
    return db.prepare(`
      INSERT INTO logs (id_log, fecha_hora, usuario, accion, modulo, detalles, ip, id_referencia, tipo_referencia)
      VALUES (@id_log, @fecha_hora, @usuario, @accion, @modulo, @detalles, @ip, @id_referencia, @tipo_referencia)
    `).run({
      id_log:          randomUUID(),
      fecha_hora:      fecha_hora || new Date().toISOString(),
      usuario:         usuario    || 'sistema',
      accion,
      modulo,
      detalles:        detalles        || null,
      ip:              ip              || null,
      id_referencia:   id_referencia   || null,
      tipo_referencia: tipo_referencia || null,
    });
  },
};

// ══════════════════════════════════════════════════════════════════════════════
//  EXPORTAR
// ══════════════════════════════════════════════════════════════════════════════
module.exports = { db, productos, clientes, ventas, compras, movimientos, config, caja, usuarios, logs };
