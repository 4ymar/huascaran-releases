const { randomUUID } = require('crypto');

function generateSeedData() {
  const now = new Date().toISOString();

  // ─── HELPER: fecha ISO desplazada N días ────────────────────────────────────
  function hace(dias, horaBase = 9) {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    d.setHours(horaBase + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
    return d.toISOString();
  }

  // ─── 80 PRODUCTOS DE FERRETERÍA ─────────────────────────────────────────────
  const productos = [
    // ── Herramientas manuales (índice 0-14) ───────────────────────────────
    { sku: 'FERR-001', nombre: 'Martillo de Carpintero 16oz Stanley',           categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 25.00,  precio_venta: 42.00,  stock_actual: 28,  stock_minimo: 5  },
    { sku: 'FERR-002', nombre: 'Destornillador Phillips #2 mango ergonómico',   categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 8.00,   precio_venta: 15.00,  stock_actual: 45,  stock_minimo: 10 },
    { sku: 'FERR-003', nombre: 'Alicate Universal 8" Stanley',                  categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 18.00,  precio_venta: 32.00,  stock_actual: 22,  stock_minimo: 5  },
    { sku: 'FERR-004', nombre: 'Llave Francesa Ajustable 10"',                  categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 22.00,  precio_venta: 38.00,  stock_actual: 14,  stock_minimo: 3  },
    { sku: 'FERR-005', nombre: 'Sierra Manual para Madera 20" 8 TPI',           categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 28.00,  precio_venta: 48.00,  stock_actual: 10,  stock_minimo: 3  },
    { sku: 'FERR-006', nombre: 'Juego de Llaves Allen 9 piezas mm+pulgadas',    categoria: 'Herramientas',               unidad_medida: 'juego',   precio_compra: 12.00,  precio_venta: 22.00,  stock_actual: 18,  stock_minimo: 4  },
    { sku: 'FERR-007', nombre: 'Taladro Percutor 750W BOSCH GSB 13 RE',         categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 180.00, precio_venta: 299.00, stock_actual: 7,   stock_minimo: 2  },
    { sku: 'FERR-008', nombre: 'Amoladora Angular 4.5" 850W BOSCH GWS 6-115',  categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 150.00, precio_venta: 249.00, stock_actual: 5,   stock_minimo: 2  },
    { sku: 'FERR-009', nombre: 'Nivel de Burbuja 24" aluminio',                 categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 15.00,  precio_venta: 28.00,  stock_actual: 16,  stock_minimo: 4  },
    { sku: 'FERR-010', nombre: 'Cinta Métrica 5m Stanley FatMax',               categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 10.00,  precio_venta: 18.00,  stock_actual: 38,  stock_minimo: 8  },
    { sku: 'FERR-011', nombre: 'Combo / Macho 5 lb mango fibra de vidrio',      categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 22.00,  precio_venta: 38.00,  stock_actual: 12,  stock_minimo: 3  },
    { sku: 'FERR-012', nombre: 'Pico Minero 3.5 kg mango eucalipto',            categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 32.00,  precio_venta: 55.00,  stock_actual: 10,  stock_minimo: 3  },
    { sku: 'FERR-013', nombre: 'Palana Recta Hoja Acero mango madera',          categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 26.00,  precio_venta: 45.00,  stock_actual: 12,  stock_minimo: 3  },
    { sku: 'FERR-014', nombre: 'Barreta Hexagonal 1m x 1" acero',               categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 38.00,  precio_venta: 65.00,  stock_actual: 8,   stock_minimo: 2  },
    { sku: 'FERR-015', nombre: 'Escuadra Metálica 30cm para carpintería',       categoria: 'Herramientas',               unidad_medida: 'unidad',  precio_compra: 8.00,   precio_venta: 14.00,  stock_actual: 20,  stock_minimo: 5  },

    // ── Materiales de Construcción (índice 15-29) ─────────────────────────
    { sku: 'CONS-001', nombre: 'Cemento Portland Tipo I Sol 42.5 kg',           categoria: 'Materiales de Construcción', unidad_medida: 'bolsa',   precio_compra: 22.50,  precio_venta: 32.00,  stock_actual: 95,  stock_minimo: 20 },
    { sku: 'CONS-002', nombre: 'Fierro Corrugado 1/2" x 9m (12mm)',             categoria: 'Materiales de Construcción', unidad_medida: 'varilla', precio_compra: 28.00,  precio_venta: 42.00,  stock_actual: 75,  stock_minimo: 15 },
    { sku: 'CONS-003', nombre: 'Fierro Corrugado 3/8" x 9m (9.5mm)',            categoria: 'Materiales de Construcción', unidad_medida: 'varilla', precio_compra: 18.00,  precio_venta: 28.00,  stock_actual: 90,  stock_minimo: 20 },
    { sku: 'CONS-004', nombre: 'Fierro Corrugado 1/4" x 9m (6mm)',              categoria: 'Materiales de Construcción', unidad_medida: 'varilla', precio_compra: 10.00,  precio_venta: 16.00,  stock_actual: 80,  stock_minimo: 15 },
    { sku: 'CONS-005', nombre: 'Ladrillo King Kong 18 huecos',                  categoria: 'Materiales de Construcción', unidad_medida: 'millar',  precio_compra: 450.00, precio_venta: 650.00, stock_actual: 6,   stock_minimo: 2  },
    { sku: 'CONS-006', nombre: 'Arena Gruesa Hormigón (m³)',                    categoria: 'Materiales de Construcción', unidad_medida: 'm3',      precio_compra: 45.00,  precio_venta: 70.00,  stock_actual: 8,   stock_minimo: 2  },
    { sku: 'CONS-007', nombre: 'Piedra Chancada 1/2" (m³)',                     categoria: 'Materiales de Construcción', unidad_medida: 'm3',      precio_compra: 55.00,  precio_venta: 85.00,  stock_actual: 6,   stock_minimo: 2  },
    { sku: 'CONS-008', nombre: 'Alambre Negro #16 recocido (kg)',               categoria: 'Materiales de Construcción', unidad_medida: 'kg',      precio_compra: 5.00,   precio_venta: 8.50,   stock_actual: 48,  stock_minimo: 10 },
    { sku: 'CONS-009', nombre: 'Clavo 3" con cabeza (kg)',                      categoria: 'Materiales de Construcción', unidad_medida: 'kg',      precio_compra: 4.50,   precio_venta: 7.50,   stock_actual: 42,  stock_minimo: 10 },
    { sku: 'CONS-010', nombre: 'Clavo 2.5" con cabeza (kg)',                    categoria: 'Materiales de Construcción', unidad_medida: 'kg',      precio_compra: 4.50,   precio_venta: 7.50,   stock_actual: 38,  stock_minimo: 10 },
    { sku: 'CONS-011', nombre: 'Clavo 4" sin cabeza (kg)',                      categoria: 'Materiales de Construcción', unidad_medida: 'kg',      precio_compra: 4.50,   precio_venta: 7.50,   stock_actual: 30,  stock_minimo: 8  },
    { sku: 'CONS-012', nombre: 'Cal Hidratada Bolsa 25 kg',                     categoria: 'Materiales de Construcción', unidad_medida: 'bolsa',   precio_compra: 9.00,   precio_venta: 15.00,  stock_actual: 35,  stock_minimo: 8  },
    { sku: 'CONS-013', nombre: 'Yeso Industrial Bolsa 20 kg',                   categoria: 'Materiales de Construcción', unidad_medida: 'bolsa',   precio_compra: 8.00,   precio_venta: 13.00,  stock_actual: 25,  stock_minimo: 6  },
    { sku: 'CONS-014', nombre: 'Triplay Lupuna 4x8 pies e=9mm',                 categoria: 'Materiales de Construcción', unidad_medida: 'plancha', precio_compra: 38.00,  precio_venta: 58.00,  stock_actual: 20,  stock_minimo: 5  },
    { sku: 'CONS-015', nombre: 'Listón Pino Cepillado 2x3" x 3m',              categoria: 'Materiales de Construcción', unidad_medida: 'unidad',  precio_compra: 8.00,   precio_venta: 13.00,  stock_actual: 30,  stock_minimo: 8  },

    // ── Electricidad (índice 30-41) ────────────────────────────────────────
    { sku: 'ELEC-001', nombre: 'Cable TW 14 AWG Indeco (rollo 100m)',           categoria: 'Electricidad',               unidad_medida: 'rollo',   precio_compra: 85.00,  precio_venta: 135.00, stock_actual: 14,  stock_minimo: 3  },
    { sku: 'ELEC-002', nombre: 'Cable TW 12 AWG Indeco (rollo 100m)',           categoria: 'Electricidad',               unidad_medida: 'rollo',   precio_compra: 120.00, precio_venta: 189.00, stock_actual: 10,  stock_minimo: 3  },
    { sku: 'ELEC-003', nombre: 'Cable NYY 2x2.5mm² Indeco (metro)',             categoria: 'Electricidad',               unidad_medida: 'metro',   precio_compra: 3.50,   precio_venta: 5.50,   stock_actual: 150, stock_minimo: 30 },
    { sku: 'ELEC-004', nombre: 'Interruptor Simple BTICINO Magic',              categoria: 'Electricidad',               unidad_medida: 'unidad',  precio_compra: 4.50,   precio_venta: 8.00,   stock_actual: 55,  stock_minimo: 12 },
    { sku: 'ELEC-005', nombre: 'Tomacorriente Doble BTICINO Magic',             categoria: 'Electricidad',               unidad_medida: 'unidad',  precio_compra: 5.00,   precio_venta: 9.00,   stock_actual: 50,  stock_minimo: 12 },
    { sku: 'ELEC-006', nombre: 'Foco LED 12W E27 Luz Blanca 6500K',             categoria: 'Electricidad',               unidad_medida: 'unidad',  precio_compra: 5.50,   precio_venta: 10.00,  stock_actual: 75,  stock_minimo: 20 },
    { sku: 'ELEC-007', nombre: 'Foco LED 9W E27 Luz Cálida 3000K',             categoria: 'Electricidad',               unidad_medida: 'unidad',  precio_compra: 4.50,   precio_venta: 8.50,   stock_actual: 70,  stock_minimo: 15 },
    { sku: 'ELEC-008', nombre: 'Cinta Aislante 3M Super 33 (20m)',              categoria: 'Electricidad',               unidad_medida: 'unidad',  precio_compra: 3.50,   precio_venta: 6.50,   stock_actual: 65,  stock_minimo: 15 },
    { sku: 'ELEC-009', nombre: 'Tablero Eléctrico 6 polos empotrar',            categoria: 'Electricidad',               unidad_medida: 'unidad',  precio_compra: 35.00,  precio_venta: 58.00,  stock_actual: 8,   stock_minimo: 2  },
    { sku: 'ELEC-010', nombre: 'Llave Térmica / Breaker 20A SCHNEIDER',         categoria: 'Electricidad',               unidad_medida: 'unidad',  precio_compra: 18.00,  precio_venta: 32.00,  stock_actual: 18,  stock_minimo: 4  },
    { sku: 'ELEC-011', nombre: 'Llave Térmica / Breaker 32A SCHNEIDER',         categoria: 'Electricidad',               unidad_medida: 'unidad',  precio_compra: 22.00,  precio_venta: 38.00,  stock_actual: 12,  stock_minimo: 3  },
    { sku: 'ELEC-012', nombre: 'Conduit PVC 3/4" x 3m (tubo luz)',              categoria: 'Electricidad',               unidad_medida: 'unidad',  precio_compra: 3.00,   precio_venta: 5.00,   stock_actual: 60,  stock_minimo: 15 },

    // ── Plomería (índice 42-56) ────────────────────────────────────────────
    { sku: 'PLOM-001', nombre: 'Tubo PVC SAP 1/2" x 5m Presión',               categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 8.00,   precio_venta: 14.00,  stock_actual: 38,  stock_minimo: 10 },
    { sku: 'PLOM-002', nombre: 'Tubo PVC SAP 3/4" x 5m Presión',               categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 12.00,  precio_venta: 20.00,  stock_actual: 30,  stock_minimo: 8  },
    { sku: 'PLOM-003', nombre: 'Tubo PVC SEL 1" x 3m Desagüe',                 categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 9.00,   precio_venta: 15.00,  stock_actual: 25,  stock_minimo: 6  },
    { sku: 'PLOM-004', nombre: 'Tubo PVC Desagüe 4" x 3m',                     categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 18.00,  precio_venta: 28.00,  stock_actual: 20,  stock_minimo: 5  },
    { sku: 'PLOM-005', nombre: 'Codo PVC 1/2" x 90°',                          categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 0.80,   precio_venta: 1.50,   stock_actual: 190, stock_minimo: 50 },
    { sku: 'PLOM-006', nombre: 'Codo PVC 3/4" x 90°',                          categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 1.00,   precio_venta: 2.00,   stock_actual: 140, stock_minimo: 40 },
    { sku: 'PLOM-007', nombre: 'Tee PVC 1/2"',                                 categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 1.00,   precio_venta: 2.00,   stock_actual: 145, stock_minimo: 40 },
    { sku: 'PLOM-008', nombre: 'Unión PVC 1/2" simple presión',                categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 0.60,   precio_venta: 1.20,   stock_actual: 200, stock_minimo: 50 },
    { sku: 'PLOM-009', nombre: 'Pegamento PVC Oatey (120ml)',                   categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 12.00,  precio_venta: 20.00,  stock_actual: 22,  stock_minimo: 5  },
    { sku: 'PLOM-010', nombre: 'Llave de Paso 1/2" Bronce',                    categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 15.00,  precio_venta: 28.00,  stock_actual: 16,  stock_minimo: 4  },
    { sku: 'PLOM-011', nombre: 'Llave de Paso 3/4" Bronce',                    categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 18.00,  precio_venta: 32.00,  stock_actual: 12,  stock_minimo: 3  },
    { sku: 'PLOM-012', nombre: 'Cinta Teflón 3/4" x 10m',                      categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 1.50,   precio_venta: 3.00,   stock_actual: 95,  stock_minimo: 25 },
    { sku: 'PLOM-013', nombre: 'Grifo Caño Cromado Lavatorio',                 categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 35.00,  precio_venta: 58.00,  stock_actual: 5,   stock_minimo: 2  },
    { sku: 'PLOM-014', nombre: 'Trampa PVC 2" para lavatorio',                 categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 6.00,   precio_venta: 11.00,  stock_actual: 20,  stock_minimo: 5  },
    { sku: 'PLOM-015', nombre: 'Flotador 1/2" boya tanque agua',               categoria: 'Plomería',                   unidad_medida: 'unidad',  precio_compra: 7.00,   precio_venta: 13.00,  stock_actual: 18,  stock_minimo: 4  },

    // ── Pintura (índice 57-68) ─────────────────────────────────────────────
    { sku: 'PINT-001', nombre: 'Pintura Látex Blanco Humo CPP (4L)',            categoria: 'Pintura',                    unidad_medida: 'galón',   precio_compra: 32.00,  precio_venta: 52.00,  stock_actual: 18,  stock_minimo: 4  },
    { sku: 'PINT-002', nombre: 'Pintura Látex Color Viva (4L)',                 categoria: 'Pintura',                    unidad_medida: 'galón',   precio_compra: 38.00,  precio_venta: 62.00,  stock_actual: 14,  stock_minimo: 4  },
    { sku: 'PINT-003', nombre: 'Pintura Esmalte Sintético Blanco (1L)',         categoria: 'Pintura',                    unidad_medida: 'litro',   precio_compra: 18.00,  precio_venta: 30.00,  stock_actual: 22,  stock_minimo: 5  },
    { sku: 'PINT-004', nombre: 'Pintura Anticorrosiva Gris 1L TEKNO',          categoria: 'Pintura',                    unidad_medida: 'litro',   precio_compra: 22.00,  precio_venta: 36.00,  stock_actual: 16,  stock_minimo: 4  },
    { sku: 'PINT-005', nombre: 'Thinner Acrílico 1 litro',                     categoria: 'Pintura',                    unidad_medida: 'litro',   precio_compra: 8.00,   precio_venta: 14.00,  stock_actual: 28,  stock_minimo: 8  },
    { sku: 'PINT-006', nombre: 'Rodillo de Pintura 9" con mango',              categoria: 'Pintura',                    unidad_medida: 'unidad',  precio_compra: 8.00,   precio_venta: 15.00,  stock_actual: 18,  stock_minimo: 4  },
    { sku: 'PINT-007', nombre: 'Brocha 4" cerda natural profesional',          categoria: 'Pintura',                    unidad_medida: 'unidad',  precio_compra: 6.00,   precio_venta: 12.00,  stock_actual: 22,  stock_minimo: 5  },
    { sku: 'PINT-008', nombre: 'Brocha 2" cerda natural',                      categoria: 'Pintura',                    unidad_medida: 'unidad',  precio_compra: 3.50,   precio_venta: 7.00,   stock_actual: 28,  stock_minimo: 6  },
    { sku: 'PINT-009', nombre: 'Masilla para Pared blanca (1kg)',               categoria: 'Pintura',                    unidad_medida: 'kg',      precio_compra: 5.00,   precio_venta: 9.00,   stock_actual: 32,  stock_minimo: 8  },
    { sku: 'PINT-010', nombre: 'Lija al Agua #150 (hoja)',                     categoria: 'Pintura',                    unidad_medida: 'unidad',  precio_compra: 1.50,   precio_venta: 3.00,   stock_actual: 3,   stock_minimo: 20 },
    { sku: 'PINT-011', nombre: 'Lija al Agua #80 (hoja)',                      categoria: 'Pintura',                    unidad_medida: 'unidad',  precio_compra: 1.50,   precio_venta: 3.00,   stock_actual: 5,   stock_minimo: 20 },
    { sku: 'PINT-012', nombre: 'Imprimante Blanco TEKNO (4L)',                 categoria: 'Pintura',                    unidad_medida: 'galón',   precio_compra: 22.00,  precio_venta: 35.00,  stock_actual: 14,  stock_minimo: 4  },

    // ── Ferretería General (índice 69-80) ──────────────────────────────────
    { sku: 'GRAL-001', nombre: 'Candado 40mm Forte acero inoxidable',          categoria: 'Ferretería General',         unidad_medida: 'unidad',  precio_compra: 12.00,  precio_venta: 22.00,  stock_actual: 28,  stock_minimo: 6  },
    { sku: 'GRAL-002', nombre: 'Bisagra 3" x 3" cromada (par)',                categoria: 'Ferretería General',         unidad_medida: 'par',     precio_compra: 4.00,   precio_venta: 7.50,   stock_actual: 38,  stock_minimo: 10 },
    { sku: 'GRAL-003', nombre: 'Tornillo Drywall 6x1" (caja x100)',            categoria: 'Ferretería General',         unidad_medida: 'caja',    precio_compra: 5.00,   precio_venta: 9.00,   stock_actual: 45,  stock_minimo: 10 },
    { sku: 'GRAL-004', nombre: 'Tarugo Plástico 1/4" (bolsa x100)',            categoria: 'Ferretería General',         unidad_medida: 'bolsa',   precio_compra: 3.00,   precio_venta: 6.00,   stock_actual: 42,  stock_minimo: 10 },
    { sku: 'GRAL-005', nombre: 'Cerradura Sobreponer 3 golpes FORTE',          categoria: 'Ferretería General',         unidad_medida: 'unidad',  precio_compra: 28.00,  precio_venta: 48.00,  stock_actual: 9,   stock_minimo: 3  },
    { sku: 'GRAL-006', nombre: 'Disco de Corte Metal 4.5" NORTON',             categoria: 'Ferretería General',         unidad_medida: 'unidad',  precio_compra: 3.50,   precio_venta: 6.50,   stock_actual: 58,  stock_minimo: 15 },
    { sku: 'GRAL-007', nombre: 'Disco Desbaste Metal 4.5" NORTON',             categoria: 'Ferretería General',         unidad_medida: 'unidad',  precio_compra: 4.50,   precio_venta: 8.00,   stock_actual: 40,  stock_minimo: 10 },
    { sku: 'GRAL-008', nombre: 'Broca para Concreto 3/8" SDS',                 categoria: 'Ferretería General',         unidad_medida: 'unidad',  precio_compra: 4.00,   precio_venta: 7.50,   stock_actual: 32,  stock_minimo: 8  },
    { sku: 'GRAL-009', nombre: 'Broca Metal HSS 6mm BOSCH',                   categoria: 'Ferretería General',         unidad_medida: 'unidad',  precio_compra: 3.50,   precio_venta: 6.50,   stock_actual: 28,  stock_minimo: 8  },
    { sku: 'GRAL-010', nombre: 'Silicona Transparente SIKA (300ml)',           categoria: 'Ferretería General',         unidad_medida: 'unidad',  precio_compra: 8.00,   precio_venta: 15.00,  stock_actual: 4,   stock_minimo: 6  },
    { sku: 'GRAL-011', nombre: 'Espuma Expansiva SIKA 300ml',                  categoria: 'Ferretería General',         unidad_medida: 'unidad',  precio_compra: 20.00,  precio_venta: 34.00,  stock_actual: 14,  stock_minimo: 4  },
    { sku: 'GRAL-012', nombre: 'Cadena Galvanizada 6mm (metro)',               categoria: 'Ferretería General',         unidad_medida: 'metro',   precio_compra: 4.00,   precio_venta: 7.00,   stock_actual: 50,  stock_minimo: 10 },

    // ── Seguridad (índice 81-86) ───────────────────────────────────────────
    { sku: 'SEGR-001', nombre: 'Guantes de Cuero Reforzados par',              categoria: 'Seguridad',                  unidad_medida: 'par',     precio_compra: 12.00,  precio_venta: 22.00,  stock_actual: 18,  stock_minimo: 4  },
    { sku: 'SEGR-002', nombre: 'Lentes de Seguridad Transparentes 3M',        categoria: 'Seguridad',                  unidad_medida: 'unidad',  precio_compra: 5.00,   precio_venta: 10.00,  stock_actual: 28,  stock_minimo: 6  },
    { sku: 'SEGR-003', nombre: 'Casco de Seguridad Blanco MSA',               categoria: 'Seguridad',                  unidad_medida: 'unidad',  precio_compra: 15.00,  precio_venta: 28.00,  stock_actual: 12,  stock_minimo: 3  },
    { sku: 'SEGR-004', nombre: 'Mascarilla con Filtro P100 3M',               categoria: 'Seguridad',                  unidad_medida: 'unidad',  precio_compra: 25.00,  precio_venta: 42.00,  stock_actual: 8,   stock_minimo: 2  },
    { sku: 'SEGR-005', nombre: 'Chaleco Reflectivo Naranja Talla L',          categoria: 'Seguridad',                  unidad_medida: 'unidad',  precio_compra: 15.00,  precio_venta: 26.00,  stock_actual: 12,  stock_minimo: 3  },
    { sku: 'SEGR-006', nombre: 'Botas PVC Jebe Punta Acero Talla 42',         categoria: 'Seguridad',                  unidad_medida: 'par',     precio_compra: 38.00,  precio_venta: 62.00,  stock_actual: 8,   stock_minimo: 2  },

    // ── Jardinería (índice 87-90) ──────────────────────────────────────────
    { sku: 'JARD-001', nombre: 'Manguera de Riego PVC 1/2" x 25m',            categoria: 'Jardinería',                 unidad_medida: 'unidad',  precio_compra: 35.00,  precio_venta: 58.00,  stock_actual: 7,   stock_minimo: 2  },
    { sku: 'JARD-002', nombre: 'Pala Punta Cuadrada mango madera',            categoria: 'Jardinería',                 unidad_medida: 'unidad',  precio_compra: 20.00,  precio_venta: 35.00,  stock_actual: 9,   stock_minimo: 2  },
    { sku: 'JARD-003', nombre: 'Rastrillo de Jardín 14 dientes acero',        categoria: 'Jardinería',                 unidad_medida: 'unidad',  precio_compra: 15.00,  precio_venta: 28.00,  stock_actual: 1,   stock_minimo: 3  },
    { sku: 'JARD-004', nombre: 'Conectores Manguera 1/2" Kit x4',             categoria: 'Jardinería',                 unidad_medida: 'kit',     precio_compra: 5.00,   precio_venta: 10.00,  stock_actual: 20,  stock_minimo: 5  },
  ];

  // Add IDs and metadata
  const productosConId = productos.map(p => ({
    id_producto: randomUUID(),
    ...p,
    descripcion: '',
    imagen_url: '',
    estado: true,
    fecha_creacion:       hace(Math.floor(Math.random() * 90) + 30),
    fecha_actualizacion:  now,
  }));

  // ─── CLIENTES ────────────────────────────────────────────────────────────────
  const clientes = [
    // 0
    { id_cliente: randomUUID(), tipo_cliente: 'PERSONA_NATURAL', nombre_razon_social: 'Juan Carlos Pérez López',          tipo_documento: 'DNI', numero_documento: '45678912',   direccion: 'Av. Los Olivos 245, Yungay',     telefono: '943567812', email: 'jcperez@gmail.com',          estado: true, fecha_registro: hace(120) },
    // 1
    { id_cliente: randomUUID(), tipo_cliente: 'PERSONA_NATURAL', nombre_razon_social: 'María Elena Rodríguez Soto',       tipo_documento: 'DNI', numero_documento: '71234567',   direccion: 'Jr. Comercio 112, Yungay',       telefono: '976543210', email: 'mrodriguez@hotmail.com',     estado: true, fecha_registro: hace(110) },
    // 2
    { id_cliente: randomUUID(), tipo_cliente: 'EMPRESA',         nombre_razon_social: 'Constructora Andes S.A.C.',        tipo_documento: 'RUC', numero_documento: '20456789012', direccion: 'Av. Centenario 1500, Huaraz', telefono: '043-421234', email: 'ventas@constructoraandes.pe', estado: true, fecha_registro: hace(100) },
    // 3
    { id_cliente: randomUUID(), tipo_cliente: 'EMPRESA',         nombre_razon_social: 'Inmobiliaria Cordillera E.I.R.L.', tipo_documento: 'RUC', numero_documento: '20567891234', direccion: 'Jr. Bolívar 890, Huaraz',    telefono: '043-425678', email: 'info@cordillera.pe',         estado: true, fecha_registro: hace(95) },
    // 4
    { id_cliente: randomUUID(), tipo_cliente: 'PERSONA_NATURAL', nombre_razon_social: 'Roberto Sánchez Mendoza',          tipo_documento: 'DNI', numero_documento: '43210987',   direccion: 'Psje. Las Flores 56, Yungay',   telefono: '952345678', email: '',                           estado: true, fecha_registro: hace(88) },
    // 5
    { id_cliente: randomUUID(), tipo_cliente: 'PERSONA_NATURAL', nombre_razon_social: 'Carmen Rosa Alva Torres',          tipo_documento: 'DNI', numero_documento: '44123456',   direccion: 'Jr. 28 de Julio 140, Yungay',   telefono: '957112233', email: '',                           estado: true, fecha_registro: hace(80) },
    // 6
    { id_cliente: randomUUID(), tipo_cliente: 'EMPRESA',         nombre_razon_social: 'Multiservicios Ancash S.R.L.',     tipo_documento: 'RUC', numero_documento: '20345678901', direccion: 'Av. Luzuriaga 300, Huaraz',  telefono: '943001122', email: 'multiserv@gmail.com',        estado: true, fecha_registro: hace(70) },
    // 7
    { id_cliente: randomUUID(), tipo_cliente: 'PERSONA_NATURAL', nombre_razon_social: 'Hipólito Quispe León',             tipo_documento: 'DNI', numero_documento: '31789012',   direccion: 'Barrio Chinchay, Yungay',       telefono: '953114455', email: '',                           estado: true, fecha_registro: hace(60) },
    // 8
    { id_cliente: randomUUID(), tipo_cliente: 'PERSONA_NATURAL', nombre_razon_social: 'Lucía Morales Palacios',           tipo_documento: 'DNI', numero_documento: '70123890',   direccion: 'Jr. Libertad 78, Mancos',       telefono: '945009988', email: '',                           estado: true, fecha_registro: hace(50) },
    // 9
    { id_cliente: randomUUID(), tipo_cliente: 'EMPRESA',         nombre_razon_social: 'Agroindustrias Cordillera S.A.C.', tipo_documento: 'RUC', numero_documento: '20498765432', direccion: 'Km 5 Carretera Yungar',      telefono: '943776655', email: 'agrocoord@outlook.com',     estado: true, fecha_registro: hace(40) },
    // 10
    { id_cliente: randomUUID(), tipo_cliente: 'PERSONA_NATURAL', nombre_razon_social: 'Efraín Soto Ramírez',              tipo_documento: 'DNI', numero_documento: '31901234',   direccion: 'Caserío Quillo s/n',            telefono: '944223344', email: '',                           estado: true, fecha_registro: hace(30) },
    // 11
    { id_cliente: randomUUID(), tipo_cliente: 'PERSONA_NATURAL', nombre_razon_social: 'Andrés Mendoza Cisneros',          tipo_documento: 'DNI', numero_documento: '71234560',   direccion: 'Jr. Sucre 33, Ranrahirca',      telefono: '949001122', email: '',                           estado: true, fecha_registro: hace(25) },
    // 12
    { id_cliente: randomUUID(), tipo_cliente: 'EMPRESA',         nombre_razon_social: 'Transportes Callejón S.A.',        tipo_documento: 'RUC', numero_documento: '20489123456', direccion: 'Terminal Terrestre, Huaraz', telefono: '943445566', email: 'transporte@callejo.pe',     estado: true, fecha_registro: hace(20) },
    // 13
    { id_cliente: randomUUID(), tipo_cliente: 'PERSONA_NATURAL', nombre_razon_social: 'Gladys Sánchez Vásquez',           tipo_documento: 'DNI', numero_documento: '41234567',   direccion: 'Jr. Huaraz 200, Yungay',        telefono: '951223344', email: 'gladysv@gmail.com',         estado: true, fecha_registro: hace(15) },
    // 14
    { id_cliente: randomUUID(), tipo_cliente: 'PERSONA_NATURAL', nombre_razon_social: 'Pedro Díaz Carhuaz',               tipo_documento: 'DNI', numero_documento: '31234567',   direccion: 'Caserío Tingua s/n',            telefono: '955443322', email: '',                           estado: true, fecha_registro: hace(10) },
  ];

  // ─── VENTAS ──────────────────────────────────────────────────────────────────
  const ventas        = [];
  const detalleVentas = [];
  const movimientos   = [];
  let ventaCounter    = 1;
  let boletaCounter   = 1;
  let facturaCounter  = 1;

  // Índices de productos según orden del array de arriba:
  //   FERR 0-14 | CONS 15-29 | ELEC 30-41 | PLOM 42-56 | PINT 57-68 | GRAL 69-80 | SEGR 81-86 | JARD 87-90
  const sampleSales = [
    // ── Hoy (3 ventas) ────────────────────────────────────────────────────
    { dias: 0, hora: 9,  productos: [0, 9],           cantidades: [2, 3],     clienteIdx: 0,    tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 0, hora: 11, productos: [30, 33, 34],     cantidades: [1, 5, 3],  clienteIdx: null, tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 0, hora: 15, productos: [15, 16],         cantidades: [10, 20],   clienteIdx: 2,    tipo: 'FACTURA', pago: 'TRANSFERENCIA' },
    // ── Ayer (3 ventas) ───────────────────────────────────────────────────
    { dias: 1, hora: 9,  productos: [57, 60, 61],     cantidades: [2, 3, 2],  clienteIdx: null, tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 1, hora: 14, productos: [42, 44, 46],     cantidades: [3, 8, 5],  clienteIdx: 5,    tipo: 'BOLETA',  pago: 'YAPE'          },
    { dias: 1, hora: 16, productos: [6, 7, 37],       cantidades: [1, 1, 2],  clienteIdx: null, tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    // ── Hace 2 días (2 ventas) ────────────────────────────────────────────
    { dias: 2, hora: 10, productos: [69, 70, 71],     cantidades: [5, 10, 4], clienteIdx: 7,    tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 2, hora: 13, productos: [15, 17, 18],     cantidades: [5, 30, 20],clienteIdx: 2,    tipo: 'FACTURA', pago: 'TRANSFERENCIA' },
    // ── Semana pasada ─────────────────────────────────────────────────────
    { dias: 4, hora: 9,  productos: [81, 82],         cantidades: [3, 4],     clienteIdx: 9,    tipo: 'FACTURA', pago: 'TARJETA'       },
    { dias: 4, hora: 14, productos: [0, 2, 14],       cantidades: [1, 2, 1],  clienteIdx: null, tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 5, hora: 10, productos: [57, 59],         cantidades: [3, 2],     clienteIdx: 1,    tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 5, hora: 15, productos: [30, 31, 32],     cantidades: [2, 1, 50], clienteIdx: 3,    tipo: 'FACTURA', pago: 'TRANSFERENCIA' },
    { dias: 6, hora: 11, productos: [42, 45, 47],     cantidades: [4, 6, 20], clienteIdx: null, tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 7, hora: 9,  productos: [6, 7],           cantidades: [1, 1],     clienteIdx: 4,    tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 7, hora: 14, productos: [15, 19, 20],     cantidades: [20, 5, 3], clienteIdx: 12,   tipo: 'FACTURA', pago: 'TARJETA'       },
    // ── Hace 2 semanas ────────────────────────────────────────────────────
    { dias: 10, hora: 10, productos: [69, 72, 73],   cantidades: [3, 5, 2],   clienteIdx: null, tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 11, hora: 9,  productos: [57, 58, 61],   cantidades: [2, 1, 3],   clienteIdx: 1,    tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 12, hora: 14, productos: [15, 16, 21],   cantidades: [15, 10, 50],clienteIdx: 2,    tipo: 'FACTURA', pago: 'TRANSFERENCIA' },
    { dias: 13, hora: 11, productos: [0, 9, 14],     cantidades: [1, 5, 1],   clienteIdx: 8,    tipo: 'BOLETA',  pago: 'YAPE'          },
    { dias: 14, hora: 10, productos: [42, 44, 50],   cantidades: [2, 4, 30],  clienteIdx: 5,    tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 14, hora: 15, productos: [81, 83, 85],   cantidades: [2, 2, 2],   clienteIdx: 6,    tipo: 'FACTURA', pago: 'TARJETA'       },
    // ── Hace 3 semanas ────────────────────────────────────────────────────
    { dias: 16, hora: 9,  productos: [30, 33],       cantidades: [3, 10],     clienteIdx: null, tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 17, hora: 10, productos: [15, 17, 22],   cantidades: [8, 40, 5],  clienteIdx: 3,    tipo: 'FACTURA', pago: 'TRANSFERENCIA' },
    { dias: 18, hora: 13, productos: [57, 59, 62],   cantidades: [1, 2, 5],   clienteIdx: null, tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 19, hora: 10, productos: [0, 2, 8],      cantidades: [2, 1, 1],   clienteIdx: 10,   tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 21, hora: 11, productos: [69, 70, 74],   cantidades: [4, 8, 3],   clienteIdx: null, tipo: 'BOLETA',  pago: 'YAPE'          },
    // ── Hace un mes ───────────────────────────────────────────────────────
    { dias: 23, hora: 9,  productos: [15, 16],       cantidades: [20, 30],    clienteIdx: 2,    tipo: 'FACTURA', pago: 'TRANSFERENCIA' },
    { dias: 25, hora: 10, productos: [57, 58, 60],   cantidades: [2, 3, 1],   clienteIdx: 1,    tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 27, hora: 14, productos: [42, 46, 47],   cantidades: [2, 10, 50], clienteIdx: null, tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 29, hora: 9,  productos: [0, 10, 11],    cantidades: [1, 3, 2],   clienteIdx: 4,    tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 30, hora: 11, productos: [87, 88],       cantidades: [2, 1],      clienteIdx: 14,   tipo: 'BOLETA',  pago: 'EFECTIVO'      },
    { dias: 30, hora: 15, productos: [6, 7, 39],     cantidades: [1, 1, 2],   clienteIdx: 13,   tipo: 'BOLETA',  pago: 'TARJETA'       },
  ];

  sampleSales.forEach((sale) => {
    const fechaVenta = new Date();
    fechaVenta.setDate(fechaVenta.getDate() - sale.dias);
    fechaVenta.setHours(sale.hora + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);

    const idVenta  = randomUUID();
    const mesAnio  = `${fechaVenta.getFullYear()}${String(fechaVenta.getMonth() + 1).padStart(2, '0')}`;
    const numVenta = `VTA-${mesAnio}-${String(ventaCounter++).padStart(3, '0')}`;

    let subtotalVenta = 0;
    const detalles    = [];

    sale.productos.forEach((prodIdx, i) => {
      const prod = productosConId[prodIdx];
      if (!prod) return;
      const cant          = sale.cantidades[i];
      const subtotalLinea = prod.precio_venta * cant;
      subtotalVenta      += subtotalLinea;

      detalles.push({
        id_detalle:      randomUUID(),
        id_venta:        idVenta,
        id_producto:     prod.id_producto,
        nombre_producto: prod.nombre,
        cantidad:        cant,
        precio_unitario: prod.precio_venta,
        descuento_linea: 0,
        subtotal_linea:  subtotalLinea,
      });

      movimientos.push({
        id_movimiento:   randomUUID(),
        fecha_hora:      fechaVenta.toISOString(),
        id_producto:     prod.id_producto,
        nombre_producto: prod.nombre,
        tipo_movimiento: 'SALIDA',
        cantidad:        cant,
        stock_anterior:  prod.stock_actual + cant,
        stock_nuevo:     prod.stock_actual,
        referencia:      numVenta,
        motivo:          '',
        usuario:         'admin',
      });
    });

    const total          = subtotalVenta;
    const subtotalSinIgv = Math.round((total / 1.18) * 100) / 100;
    const igv            = Math.round((total - subtotalSinIgv) * 100) / 100;

    const numComprobante = sale.tipo === 'BOLETA'
      ? `B001-${String(boletaCounter++).padStart(8, '0')}`
      : `F001-${String(facturaCounter++).padStart(8, '0')}`;

    ventas.push({
      id_venta:           idVenta,
      numero_venta:       numVenta,
      fecha_hora:         fechaVenta.toISOString(),
      id_cliente:         sale.clienteIdx !== null ? clientes[sale.clienteIdx].id_cliente : null,
      tipo_comprobante:   sale.tipo,
      numero_comprobante: numComprobante,
      subtotal:           subtotalSinIgv,
      igv,
      descuento:          0,
      total,
      forma_pago:         sale.pago,
      estado:             'ACTIVA',
      usuario:            'admin',
      notas:              '',
    });

    detalleVentas.push(...detalles);
  });

  // ─── COMPRAS ─────────────────────────────────────────────────────────────────
  const compras        = [];
  const detalleCompras = [];
  let compraCounter    = 1;

  const sampleCompras = [
    { dias: 3,  proveedor: 'Distribuidora Aceros del Norte S.A.C.',  ruc: '20345678901', productos: [16, 17, 18, 22],         cantidades: [100, 50, 60, 80]     },
    { dias: 8,  proveedor: 'Comercial Eléctrica Lima E.I.R.L.',      ruc: '20567890123', productos: [30, 31, 32, 35, 36, 37], cantidades: [10, 8, 200, 100, 100, 80] },
    { dias: 15, proveedor: 'Pinturas Nacional S.A.',                  ruc: '20123456789', productos: [57, 58, 59, 60, 61, 64], cantidades: [20, 12, 10, 15, 20, 40]  },
    { dias: 22, proveedor: 'Ferromax Perú S.A.C.',                   ruc: '20234567890', productos: [15, 19, 20, 21, 23],     cantidades: [150, 60, 40, 50, 200]    },
    { dias: 32, proveedor: 'Tubosistemas Andinos E.I.R.L.',          ruc: '20678901234', productos: [42, 43, 44, 45, 46, 47, 48], cantidades: [50, 40, 300, 200, 200, 300, 150] },
    { dias: 45, proveedor: 'Distribuidora Aceros del Norte S.A.C.',  ruc: '20345678901', productos: [69, 70, 71, 72, 73],     cantidades: [80, 60, 100, 80, 60]     },
    { dias: 55, proveedor: 'Proveedora Seguridad Industrial S.A.C.', ruc: '20789012345', productos: [81, 82, 83, 84, 85],     cantidades: [30, 40, 20, 15, 20]      },
    { dias: 68, proveedor: 'Cementos Pacasmayo S.A.A.',              ruc: '20100140799', productos: [15, 25, 26],             cantidades: [200, 60, 50]             },
  ];

  sampleCompras.forEach((compra) => {
    const fechaCompra = new Date();
    fechaCompra.setDate(fechaCompra.getDate() - compra.dias);
    fechaCompra.setHours(8 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0);

    const idCompra = randomUUID();
    const mesAnio  = `${fechaCompra.getFullYear()}${String(fechaCompra.getMonth() + 1).padStart(2, '0')}`;
    const numOC    = `OC-${mesAnio}-${String(compraCounter++).padStart(3, '0')}`;

    let subtotalCompra = 0;

    compra.productos.forEach((prodIdx, i) => {
      const prod = productosConId[prodIdx];
      if (!prod) return;
      const cant          = compra.cantidades[i];
      const subtotalLinea = prod.precio_compra * cant;
      subtotalCompra     += subtotalLinea;

      detalleCompras.push({
        id_detalle:      randomUUID(),
        id_compra:       idCompra,
        id_producto:     prod.id_producto,
        nombre_producto: prod.nombre,
        cantidad:        cant,
        precio_unitario: prod.precio_compra,
        subtotal_linea:  subtotalLinea,
      });

      movimientos.push({
        id_movimiento:   randomUUID(),
        fecha_hora:      fechaCompra.toISOString(),
        id_producto:     prod.id_producto,
        nombre_producto: prod.nombre,
        tipo_movimiento: 'ENTRADA',
        cantidad:        cant,
        stock_anterior:  Math.max(0, prod.stock_actual - cant),
        stock_nuevo:     prod.stock_actual,
        referencia:      numOC,
        motivo:          '',
        usuario:         'admin',
      });
    });

    const igv = Math.round(subtotalCompra * 0.18 * 100) / 100;

    compras.push({
      id_compra:     idCompra,
      numero_oc:     numOC,
      fecha_hora:    fechaCompra.toISOString(),
      proveedor:     compra.proveedor,
      ruc_proveedor: compra.ruc,
      doc_proveedor: '',
      subtotal:      subtotalCompra,
      igv,
      total:         subtotalCompra + igv,
      estado:        'ACTIVA',
      usuario:       'admin',
      notas:         '',
    });
  });

  // ─── CRÉDITOS Y ABONOS ───────────────────────────────────────────────────────
  const creditos = [];
  const abonos   = [];

  const creditosData = [
    { cliIdx: 2,  ventaIdx: 2,  monto: 1092.00, diasCreacion: 15, diasVence: 30,  estado: 'PENDIENTE', abonos: [{ monto: 500.00,  dias: 10, medio: 'TRANSFERENCIA' }] },
    { cliIdx: 3,  ventaIdx: 11, monto: 874.50,  diasCreacion: 12, diasVence: -5,  estado: 'PENDIENTE', abonos: [{ monto: 300.00,  dias: 12, medio: 'EFECTIVO'      }] },
    { cliIdx: 9,  ventaIdx: 8,  monto: 426.00,  diasCreacion: 8,  diasVence: 15,  estado: 'PENDIENTE', abonos: [] },
    { cliIdx: 6,  ventaIdx: 20, monto: 315.00,  diasCreacion: 25, diasVence: -20, estado: 'VENCIDO',   abonos: [{ monto: 100.00, dias: 20, medio: 'EFECTIVO' }, { monto: 100.00, dias: 10, medio: 'YAPE' }] },
    { cliIdx: 12, ventaIdx: 14, monto: 1258.00, diasCreacion: 5,  diasVence: 45,  estado: 'PENDIENTE', abonos: [{ monto: 630.00,  dias: 3,  medio: 'TRANSFERENCIA' }] },
  ];

  creditosData.forEach((cd) => {
    const ventaRef  = ventas[cd.ventaIdx];
    const idCredito = randomUUID();
    const fechaVence = new Date();
    fechaVence.setDate(fechaVence.getDate() + cd.diasVence);

    creditos.push({
      id_credito:        idCredito,
      id_cliente:        clientes[cd.cliIdx].id_cliente,
      id_venta:          ventaRef ? ventaRef.id_venta : null,
      monto_total:       cd.monto,
      estado:            cd.estado,
      fecha_vencimiento: fechaVence.toISOString().slice(0, 10),
      notas:             '',
      fecha_creacion:    hace(cd.diasCreacion),
    });

    cd.abonos.forEach((ab) => {
      abonos.push({
        id_abono:       randomUUID(),
        id_credito:     idCredito,
        monto_abonado:  ab.monto,
        fecha_abono:    hace(ab.dias),
        medio_pago:     ab.medio,
        notas:          '',
        fecha_creacion: hace(ab.dias),
      });
    });
  });

  return {
    productos:       productosConId,
    clientes,
    ventas,
    detalle_ventas:  detalleVentas,
    compras,
    detalle_compras: detalleCompras,
    movimientos,
    creditos,
    abonos,
    config: {
      boleta_counter:  boletaCounter,
      factura_counter: facturaCounter,
      venta_counter:   ventaCounter,
      compra_counter:  compraCounter,
    },
  };
}

module.exports = { generateSeedData };
