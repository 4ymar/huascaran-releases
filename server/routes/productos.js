const router       = require('express').Router();
const db           = require('../data/database');
const { randomUUID: uuidv4 } = require('crypto');
const { auditLog } = require('../middleware/logger');
const { requireRole } = require('../middleware/auth');

// GET all products
router.get('/', (req, res) => {
    try {
        let productos = [];
        const { search, categoria, estado, stock_level } = req.query;

        productos = search ? db.productos.buscar(search) : db.productos.listar();

        if (categoria)             productos = productos.filter(p => p.categoria === categoria);
        if (estado !== undefined)  productos = productos.filter(p => p.estado === (estado === 'true' ? 1 : 0));
        if (stock_level === 'critico') productos = productos.filter(p => p.stock_actual === 0);
        if (stock_level === 'bajo')    productos = productos.filter(p => p.stock_actual > 0 && p.stock_actual <= p.stock_minimo);
        if (stock_level === 'normal')  productos = productos.filter(p => p.stock_actual > p.stock_minimo);

        res.json(productos.map(p => ({ ...p, estado: p.estado === 1 })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET product by barcode
router.get('/barcode/:codigo', (req, res) => {
    try {
        const codigo   = req.params.codigo.trim();
        const producto = db.db.prepare(
            `SELECT * FROM productos WHERE (codigo_barras = ? OR sku = ?) AND estado = 1 LIMIT 1`
        ).get(codigo, codigo);

        if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ ...producto, estado: producto.estado === 1 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET categories
router.get('/meta/categorias', (req, res) => {
    try {
        const filas = db.db.prepare(
            `SELECT DISTINCT categoria FROM productos WHERE categoria IS NOT NULL AND categoria != ''`
        ).all();
        res.json(filas.map(f => f.categoria).sort());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET product by ID
router.get('/:id', (req, res) => {
    try {
        const producto = db.productos.obtener(req.params.id);
        if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ ...producto, estado: producto.estado === 1 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST new product
router.post('/', requireRole('ADMIN'), (req, res) => {
    try {
        const existing = db.productos.obtenerPorSku(req.body.sku);
        if (existing) return res.status(400).json({ error: 'El SKU ya existe' });

        const now      = new Date().toISOString();
        const producto = {
            id_producto:         uuidv4(),
            ...req.body,
            descripcion:         req.body.descripcion  || '',
            imagen_url:          req.body.imagen_url   || '',
            estado:              1,
            fecha_creacion:      now,
            fecha_actualizacion: now,
        };
        db.productos.crear(producto);

        auditLog(req, 'CREAR', 'PRODUCTOS',
            `Producto creado: "${producto.nombre}" | ` +
            `SKU: ${producto.sku} | ` +
            `Categoría: ${producto.categoria || 'Sin categoría'} | ` +
            `Precio venta: S/ ${Number(producto.precio_venta).toFixed(2)} | ` +
            `Stock inicial: ${producto.stock_actual}`
        );

        res.status(201).json({ ...producto, estado: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT update product
router.put('/:id', requireRole('ADMIN'), (req, res) => {
    try {
        const existing = db.productos.obtenerPorSku(req.body.sku);
        if (existing && existing.id_producto !== req.params.id)
            return res.status(400).json({ error: 'El SKU ya existe en otro producto' });

        const current = db.productos.obtener(req.params.id);
        if (!current) return res.status(404).json({ error: 'Producto no encontrado' });

        const now     = new Date().toISOString();
        const updated = {
            ...current,
            ...req.body,
            descripcion:         req.body.descripcion || current.descripcion || '',
            imagen_url:          req.body.imagen_url  || current.imagen_url  || '',
            estado:              req.body.estado === false ? 0 : 1,
            fecha_actualizacion: now,
        };
        db.productos.actualizar(updated);

        // Construir detalle con solo los campos que cambiaron
        const cambios = [];
        if (current.nombre       !== updated.nombre)       cambios.push(`Nombre: "${current.nombre}" → "${updated.nombre}"`);
        if (current.precio_venta !== updated.precio_venta) cambios.push(`Precio venta: S/ ${Number(current.precio_venta).toFixed(2)} → S/ ${Number(updated.precio_venta).toFixed(2)}`);
        if (current.precio_compra!== updated.precio_compra)cambios.push(`Precio compra: S/ ${Number(current.precio_compra).toFixed(2)} → S/ ${Number(updated.precio_compra).toFixed(2)}`);
        if (current.stock_minimo !== updated.stock_minimo) cambios.push(`Stock mínimo: ${current.stock_minimo} → ${updated.stock_minimo}`);
        if (current.categoria    !== updated.categoria)    cambios.push(`Categoría: "${current.categoria}" → "${updated.categoria}"`);
        if (current.estado       !== updated.estado)       cambios.push(updated.estado === 1 ? 'Producto activado' : 'Producto desactivado');

        auditLog(req, 'MODIFICAR', 'PRODUCTOS',
            `Producto modificado: "${current.nombre}" | ` +
            (cambios.length ? cambios.join(' | ') : 'Sin cambios relevantes')
        );

        res.json({ ...updated, estado: updated.estado === 1 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
