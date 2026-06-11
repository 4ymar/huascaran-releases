const db = require('./data/database');
const now = new Date();
const mesAnio = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0');

const ventasMesRow = db.db.prepare("SELECT COUNT(*) as c FROM ventas WHERE numero_venta LIKE 'VTA-" + mesAnio + "-%'").get();
const nextVentaSeq = (ventasMesRow.c || 0) + 1;
console.log('Proximo numero_venta: VTA-' + mesAnio + '-' + String(nextVentaSeq).padStart(3,'0'));

const boletaRow = db.db.prepare("SELECT COUNT(*) as c FROM ventas WHERE numero_comprobante LIKE 'B001-%'").get();
const nextBoleta = (boletaRow.c || 0) + 1;
console.log('Proxima boleta: B001-' + String(nextBoleta).padStart(8,'0'));

const ocRow = db.db.prepare("SELECT COUNT(*) as c FROM compras WHERE numero_oc LIKE 'OC-" + mesAnio + "-%'").get();
const nextOC = (ocRow.c || 0) + 1;
console.log('Proximo numero_oc: OC-' + mesAnio + '-' + String(nextOC).padStart(3,'0'));

console.log('OK - numeros sin conflictos posibles');
process.exit(0);
