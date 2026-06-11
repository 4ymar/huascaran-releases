const router = require('express').Router();
const { randomUUID } = require('crypto');
const db = require('../data/database');
const { requireRole } = require('../middleware/auth');

router.get('/', (_req, res) => {
    try {
        const rows = db.db.prepare(`
            SELECT a.*,
                   COALESCE(SUM(sa.stock_actual), 0) AS stock_total,
                   COUNT(sa.id_producto) AS productos_con_stock
            FROM almacenes a
            LEFT JOIN stock_almacen sa ON sa.id_almacen = a.id_almacen
            GROUP BY a.id_almacen
            ORDER BY a.es_principal DESC, a.nombre ASC
        `).all();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/stock', (req, res) => {
    try {
        const rows = db.db.prepare(`
            SELECT sa.*, p.sku, p.nombre, p.categoria, p.unidad_medida
            FROM stock_almacen sa
            JOIN productos p ON p.id_producto = sa.id_producto
            WHERE sa.id_almacen = ?
            ORDER BY p.nombre ASC
        `).all(req.params.id);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', requireRole('ADMIN'), (req, res) => {
    try {
        const { nombre, descripcion = '' } = req.body;
        if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'Nombre obligatorio.' });
        const almacen = {
            id_almacen: randomUUID(),
            nombre: String(nombre).trim(),
            descripcion: String(descripcion || '').trim(),
            fecha_creacion: new Date().toISOString(),
        };
        db.db.prepare(`
            INSERT INTO almacenes (id_almacen, nombre, descripcion, es_principal, estado, fecha_creacion)
            VALUES (@id_almacen, @nombre, @descripcion, 0, 1, @fecha_creacion)
        `).run(almacen);
        res.status(201).json(almacen);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', requireRole('ADMIN'), (req, res) => {
    try {
        const { nombre, descripcion = '', estado = 1 } = req.body;
        if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'Nombre obligatorio.' });
        const result = db.db.prepare(`
            UPDATE almacenes SET nombre = ?, descripcion = ?, estado = ?
            WHERE id_almacen = ? AND es_principal = 0
        `).run(String(nombre).trim(), String(descripcion || '').trim(), estado ? 1 : 0, req.params.id);
        if (!result.changes) return res.status(404).json({ error: 'Almacen no encontrado o no editable.' });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/transferir', requireRole('ADMIN'), (req, res) => {
    try {
        const { id_producto, desde_almacen, hacia_almacen, cantidad, motivo = '' } = req.body;
        const qty = Number(cantidad || 0);
        if (!id_producto || !desde_almacen || !hacia_almacen || qty <= 0) {
            return res.status(400).json({ error: 'Producto, almacenes y cantidad son obligatorios.' });
        }
        if (desde_almacen === hacia_almacen) {
            return res.status(400).json({ error: 'Los almacenes deben ser distintos.' });
        }

        const now = new Date().toISOString();
        const result = db.db.transaction(() => {
            const prod = db.db.prepare(`SELECT nombre FROM productos WHERE id_producto = ?`).get(id_producto);
            if (!prod) throw new Error('Producto no encontrado.');
            for (const almacen of [desde_almacen, hacia_almacen]) {
                const exists = db.db.prepare(`SELECT 1 FROM almacenes WHERE id_almacen = ? AND estado = 1`).get(almacen);
                if (!exists) throw new Error(`Almacen no encontrado o inactivo: ${almacen}`);
                db.db.prepare(`
                    INSERT INTO stock_almacen (id_almacen, id_producto, stock_actual, stock_minimo)
                    VALUES (?, ?, 0, 0)
                    ON CONFLICT(id_almacen, id_producto) DO NOTHING
                `).run(almacen, id_producto);
            }

            const origen = db.db.prepare(`
                SELECT stock_actual FROM stock_almacen WHERE id_almacen = ? AND id_producto = ?
            `).get(desde_almacen, id_producto);
            if (Number(origen.stock_actual) < qty) {
                throw new Error(`Stock insuficiente en almacen origen. Disponible: ${origen.stock_actual}`);
            }

            db.db.prepare(`UPDATE stock_almacen SET stock_actual = stock_actual - ? WHERE id_almacen = ? AND id_producto = ?`)
                .run(qty, desde_almacen, id_producto);
            db.db.prepare(`UPDATE stock_almacen SET stock_actual = stock_actual + ? WHERE id_almacen = ? AND id_producto = ?`)
                .run(qty, hacia_almacen, id_producto);
            db.db.prepare(`
                INSERT INTO movimientos (id_movimiento, fecha_hora, id_producto, nombre_producto,
                tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia, motivo, usuario)
                VALUES (?, ?, ?, ?, 'TRANSFERENCIA', ?, ?, ?, ?, ?, ?)
            `).run(randomUUID(), now, id_producto, prod.nombre, qty, origen.stock_actual, Number(origen.stock_actual) - qty, `TRANSF-${desde_almacen}->${hacia_almacen}`, motivo, req.user?.username || 'admin');
            return { ok: true };
        })();

        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
