const router = require('express').Router();
const db = require('../data/database');

const BUSINESS_UTC_OFFSET_MINUTES = -300;

const toBusinessDay = (dateUTC) => {
    const localMs = dateUTC.getTime() + (BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000);
    const local = new Date(localMs);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
};

const getNowBusinessDay = () => {
    const ahora = new Date();
    // Obtener fecha en hora Perú (UTC-5)
    const peruOffset = -5 * 60;
    const peruMs = ahora.getTime() + peruOffset * 60 * 1000;
    const peru = new Date(peruMs);
    const y = peru.getUTCFullYear();
    const m = peru.getUTCMonth();
    const d = peru.getUTCDate();
    // Retornar medianoche UTC de ese día peruano
    return new Date(Date.UTC(y, m, d, 5, 0, 0)); // 00:00 Perú = 05:00 UTC
};

const getStartOfMonthBusiness = () => {
    const ahora = new Date();
    const peruOffset = -5 * 60;
    const peruMs = ahora.getTime() + peruOffset * 60 * 1000;
    const peru = new Date(peruMs);
    const y = peru.getUTCFullYear();
    const m = peru.getUTCMonth();
    return new Date(Date.UTC(y, m, 1, 5, 0, 0)); // día 1 del mes, 00:00 Perú
};

// Helper para obtener todas las filas de una tabla fácilmente sin límite predeterminado
const getAll = (tabla) => {
    return db.db.prepare(`SELECT * FROM ${tabla}`).all();
};

// GET dashboard report
router.get('/dashboard', (req, res) => {
    try {
        const productos = db.productos.listar();
        const ventas = getAll('ventas').filter(v => v.estado === 'ACTIVA');
        const detalleVentas = getAll('detalle_ventas');
        const hoy = getNowBusinessDay();
        const inicioMes = getStartOfMonthBusiness();
        
        // Ventas del día
        const ventasHoy = ventas.filter(v => new Date(v.fecha_hora) >= hoy);
        const totalHoy = ventasHoy.reduce((s, v) => s + v.total, 0);

        // Ventas del mes
        const ventasMes = ventas.filter(v => new Date(v.fecha_hora) >= inicioMes);
        const totalMes = ventasMes.reduce((s, v) => s + v.total, 0);

        // Stock crítico (0 unidades)
        const stockCritico = productos.filter(p => p.estado === 1 && p.stock_actual === 0);
        // Stock bajo
        const stockBajo = productos.filter(p => p.estado === 1 && p.stock_actual > 0 && p.stock_actual <= p.stock_minimo);

        // Valor del inventario
        const valorInventario = productos
            .filter(p => p.estado === 1)
            .reduce((s, p) => s + (p.stock_actual * p.precio_compra), 0);

        // Top 5 productos más vendidos (del mes)
        const ventaIdsMes = new Set(ventasMes.map(v => v.id_venta));
        const detallesMes = detalleVentas.filter(d => ventaIdsMes.has(d.id_venta));
        const productoVentas = {};
        detallesMes.forEach(d => {
            if (!productoVentas[d.id_producto]) {
                productoVentas[d.id_producto] = { nombre: d.nombre_producto, cantidad: 0, total: 0 };
            }
            productoVentas[d.id_producto].cantidad += d.cantidad;
            productoVentas[d.id_producto].total += d.subtotal_linea;
        });
        const topProductos = Object.values(productoVentas)
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 5);

        // Últimas ventas
        const ultimasVentas = [...ventas]
            .sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora))
            .slice(0, 5);

        // Ventas por día (últimos 7 días)
        const ventasPorDia = [];
            for (let i = 6; i >= 0; i--) {
        const dia = new Date(getNowBusinessDay().getTime() - i * 86400000);
        const ventasDia = ventas.filter(v => {
            const fv = toBusinessDay(new Date(v.fecha_hora ));
            return fv >= dia && fv < new Date(dia.getTime() + 86400000);
        
            });
            ventasPorDia.push({
                fecha: dia.toISOString().split('T')[0],
                total: ventasDia.reduce((s, v) => s + v.total, 0),
                cantidad: ventasDia.length,
            });
        }

        res.json({
            ventasHoy: { total: totalHoy, cantidad: ventasHoy.length },
            ventasMes: { total: totalMes, cantidad: ventasMes.length },
            stockCritico: stockCritico.length,
            stockBajo: stockBajo.length,
            valorInventario,
            topProductos,
            ultimasVentas,
            ventasPorDia,
            productosStockBajo: [...stockCritico, ...stockBajo].slice(0, 10),
            totalProductos: productos.filter(p => p.estado === 1).length,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET sales report by period
router.get('/ventas', (req, res) => {
    try {
        const { fecha_desde, fecha_hasta } = req.query;
        const ventas = getAll('ventas').filter(v => v.estado === 'ACTIVA');
        const detalleVentas = getAll('detalle_ventas');

        let filtradas = ventas;
        if (fecha_desde) {
            const desdeAjustado = new Date(new Date(fecha_desde + 'T00:00:00.000Z').getTime() - (BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000));
            filtradas = filtradas.filter(v => new Date(v.fecha_hora) >= desdeAjustado);
        }
        if (fecha_hasta) {
            const hastaAjustado = new Date(new Date(fecha_hasta + 'T23:59:59.999Z').getTime() - (BUSINESS_UTC_OFFSET_MINUTES * 60 * 1000));
            filtradas = filtradas.filter(v => new Date(v.fecha_hora) <= hastaAjustado);
        }

        const totalFacturado = filtradas.reduce((s, v) => s + v.total, 0);
        const totalIgv = filtradas.reduce((s, v) => s + v.igv, 0);
        const ticketPromedio = filtradas.length > 0 ? totalFacturado / filtradas.length : 0;

        // Top products
        const ventaIds = new Set(filtradas.map(v => v.id_venta));
        const detallesFiltrados = detalleVentas.filter(d => ventaIds.has(d.id_venta));
        const productoVentas = {};
        detallesFiltrados.forEach(d => {
            if (!productoVentas[d.nombre_producto]) {
                productoVentas[d.nombre_producto] = { nombre: d.nombre_producto, cantidad: 0, total: 0 };
            }
            productoVentas[d.nombre_producto].cantidad += d.cantidad;
            productoVentas[d.nombre_producto].total += d.subtotal_linea;
        });
        const topProductos = Object.values(productoVentas).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);

        // By payment method
        const porFormaPago = {};
        filtradas.forEach(v => {
            if (!porFormaPago[v.forma_pago]) porFormaPago[v.forma_pago] = { total: 0, cantidad: 0 };
            porFormaPago[v.forma_pago].total += v.total;
            porFormaPago[v.forma_pago].cantidad++;
        });

        res.json({
            totalVentas: filtradas.length,
            totalFacturado,
            totalIgv,
            ticketPromedio,
            topProductos,
            porFormaPago,
            ventas: filtradas,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET inventory report
router.get('/inventario', (req, res) => {
    try {
        const productos = db.productos.listar().filter(p => p.estado === 1);
        const valorTotal = productos.reduce((s, p) => s + (p.stock_actual * p.precio_compra), 0);
        const valorVenta = productos.reduce((s, p) => s + (p.stock_actual * p.precio_venta), 0);

        const porCategoria = {};
        productos.forEach(p => {
            if (!porCategoria[p.categoria]) porCategoria[p.categoria] = { cantidad: 0, valor: 0, items: 0 };
            porCategoria[p.categoria].cantidad += p.stock_actual;
            porCategoria[p.categoria].valor += p.stock_actual * p.precio_compra;
            porCategoria[p.categoria].items++;
        });

        res.json({
            totalProductos: productos.length,
            valorTotalCompra: valorTotal,
            valorTotalVenta: valorVenta,
            stockCritico: productos.filter(p => p.stock_actual === 0),
            stockBajo: productos.filter(p => p.stock_actual > 0 && p.stock_actual <= p.stock_minimo),
            porCategoria,
            productos,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
