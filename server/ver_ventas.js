const Database = require('better-sqlite3');
const db = new Database('./data/inventario.db');

const ventas = db.prepare(
    "SELECT id_venta, numero_venta, tipo_comprobante, total, estado FROM ventas ORDER BY rowid DESC LIMIT 5"
).all();

console.table(ventas);
db.close();
