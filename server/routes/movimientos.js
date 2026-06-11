const router       = require('express').Router();
const db           = require('../data/database');

const BUSINESS_UTC_OFFSET_MINUTES = -300;

const { randomUUID: uuidv4 } = require('crypto');
const { auditLog } = require('../middleware/logger');

// GET all movements
router.get('/', (req, res) => {
  try {
    const { producto, tipo, fecha_desde, fecha_hasta } = req.query;

    let movimientos = db.movimientos.listar({
      limite: 500,
      offset: 0,
      fecha_desde: fecha_desde || null,
      fecha_hasta: fecha_hasta || null,
    });

    if (producto) movimientos = movimientos.filter(m =>
      m.id_producto === producto ||
      m.nombre_producto.toLowerCase().includes(producto.toLowerCase())
    );
    if (tipo) movimientos = movimientos.filter(m => m.tipo_movimiento === tipo);

    res.json(movimientos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// POST manual adjustment
router.post('/ajuste', (req, res) => {
    try {
        const { id_producto, cantidad, tipo, motivo } = req.body;
        if (!motivo) return res.status(400).json({ error: 'El motivo del ajuste es obligatorio' });

        const prod = db.productos.obtener(id_producto);
        if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });

        const stockAnterior = prod.stock_actual;
        const nuevoStock    = tipo === 'ENTRADA'
            ? stockAnterior + cantidad
            : Math.max(0, stockAnterior - cantidad);

        const ajusteTransaccion = db.db.transaction(() => {
            db.db.prepare(`UPDATE productos SET stock_actual = ? WHERE id_producto = ?`).run(nuevoStock, id_producto);

            const mov = {
                id_movimiento:   uuidv4(),
                fecha_hora:      new Date().toISOString(),
                id_producto,
                nombre_producto: prod.nombre,
                tipo_movimiento: 'AJUSTE',
                cantidad,
                stock_anterior:  stockAnterior,
                stock_nuevo:     nuevoStock,
                referencia:      'AJUSTE_MANUAL',
                motivo,
                usuario:         req.user?.username || 'admin',
            };

            db.db.prepare(`
                INSERT INTO movimientos (id_movimiento, fecha_hora, id_producto, nombre_producto,
                tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia, motivo, usuario)
                VALUES (@id_movimiento, @fecha_hora, @id_producto, @nombre_producto,
                @tipo_movimiento, @cantidad, @stock_anterior, @stock_nuevo, @referencia, @motivo, @usuario)
            `).run(mov);

            return mov;
        });

        const movGuardado = ajusteTransaccion();

        auditLog(req, tipo === 'ENTRADA' ? 'CREAR' : 'MODIFICAR', 'PRODUCTOS',
            `Ajuste de stock — Producto: "${prod.nombre}" | ` +
            `${tipo}: ${cantidad} unidades | ` +
            `Stock: ${stockAnterior} → ${nuevoStock} | ` +
            `Motivo: ${motivo}`
        );

        res.status(201).json(movGuardado);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
