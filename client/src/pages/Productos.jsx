import { useState, useEffect, useRef } from 'react';
import { getProductos, createProducto, updateProducto } from '../services/api';
import { formatCurrency, getStockBadge, downloadExcel } from '../utils/helpers';
import { useToast } from '../components/Toast';
import { Plus, Search, Download, Edit2, X, Filter, ChevronLeft, ChevronRight, Package, TrendingUp, Upload, FileSpreadsheet, AlertTriangle, CheckCircle } from 'lucide-react';

const ITEMS_PER_PAGE = 25;

const UNIDADES = ['unidad', 'kg', 'metro', 'litro', 'galon', 'rollo', 'bolsa', 'caja', 'par', 'juego', 'millar', 'm3', 'varilla'];

const emptyProduct = {
    sku: '', codigo_barras: '', nombre: '', descripcion: '', categoria: '', unidad_medida: 'unidad',
    precio_compra: '', precio_venta: '', stock_actual: '', stock_minimo: '', imagen_url: ''
};


export default function Productos() {
    const toast = useToast();
    const fileInputRef = useRef(null);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('');
    const [filterStock, setFilterStock] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [form, setForm] = useState(emptyProduct);
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [importData, setImportData] = useState([]);
    const [importProcessing, setImportProcessing] = useState(false);
    const [showDataMenu, setShowDataMenu] = useState(false);
    const [categoriasDB, setCategoriasDB] = useState([]);
    const dataMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dataMenuRef.current && !dataMenuRef.current.contains(e.target)) {
                setShowDataMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const loadData = () => {
        setLoading(true);
        const params = {};
        if (search) params.search = search;
        if (filterCat) params.categoria = filterCat;
        if (filterStock) params.stock_level = filterStock;
        getProductos(params).then(setProductos).finally(() => setLoading(false));
    };
    const loadCategorias = () => {
        fetch('/api/categorias', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(r => r.json())
            .then(data => setCategoriasDB(Array.isArray(data) ? data.filter(c => c.activo) : []))
            .catch(() => {});
    };

    useEffect(() => { loadData(); }, [search, filterCat, filterStock]);
    useEffect(() => { loadData(); loadCategorias(); }, []);

    const totalPages = Math.ceil(productos.length / ITEMS_PER_PAGE);
    const paginatedProducts = productos.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const openCreate = () => { setForm(emptyProduct); setEditingProduct(null); setShowForm(true); };
    const openEdit = (p) => { setForm({ ...p }); setEditingProduct(p); setShowForm(true); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = {
                ...form,
                precio_compra: Number(form.precio_compra),
                precio_venta: Number(form.precio_venta),
                stock_actual: Number(form.stock_actual),
                stock_minimo: Number(form.stock_minimo),
                codigo_barras: form.codigo_barras || ''
            };
            if (editingProduct) {
                await updateProducto(editingProduct.id_producto, data);
                toast('Producto actualizado correctamente');
            } else {
                await createProducto(data);
                toast('Producto creado correctamente');
            }
            setShowForm(false);
            loadData();
        } catch (err) {
            toast(err.response?.data?.error || 'Error al guardar', 'error');
        }
    };

    const toggleEstado = async (p) => {
        try {
            await updateProducto(p.id_producto, { estado: !p.estado });
            toast(p.estado ? 'Producto desactivado' : 'Producto activado');
            loadData();
        } catch (err) {
            toast('Error al cambiar estado', 'error');
        }
    };

    const margen = (pc, pv) => {
        if (!pc || !pv) return null;
        return ((pv - pc) / pc * 100).toFixed(1);
    };

    // ── IMPORTAR CSV / EXCEL ──────────────────────────────────
    const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const XLSX = await import('xlsx');
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

                // Normalizar columnas (case insensitive)
                const normalize = (obj) => {
                    const n = {};
                    Object.keys(obj).forEach(k => { n[k.toLowerCase().trim().replace(/ /g, '_')] = obj[k]; });
                    return n;
                };

                const existingSKUs = productos.map(p => p.sku.toUpperCase());

                const parsed = raw.map((row, idx) => {
                    const r = normalize(row);
                    const sku = String(r.sku || r.codigo || '').toUpperCase().trim();
                    const existente = productos.find(p => p.sku.toUpperCase() === sku);
                    return {
                        _idx: idx,
                        sku,
                        nombre: String(r.nombre || r.producto || r.descripcion || '').trim(),
                        categoria: String(r.categoria || 'Ferreteria General').trim(),
                        unidad_medida: String(r.unidad_medida || r.unidad || 'unidad').trim(),
                        precio_compra: Number(r.precio_compra || r.p_compra || r.costo || 0),
                        precio_venta: Number(r.precio_venta || r.p_venta || r.precio || 0),
                        stock_actual: Number(r.stock_actual || r.stock || r.cantidad || 0),
                        stock_minimo: Number(r.stock_minimo || r.stock_min || 5),
                        descripcion: String(r.descripcion_larga || r.detalle || '').trim(),
                        _estado: existente ? 'duplicado' : 'nuevo',
                        _existente: existente || null,
                        _accion: existente ? 'aumentar_stock' : 'crear',
                        _stock_agregar: existente ? Number(r.stock_actual || r.stock || r.cantidad || 0) : 0,
                    };
                }).filter(r => r.sku && r.nombre);

                if (parsed.length === 0) {
                    toast('No se encontraron productos validos en el archivo', 'error');
                    return;
                }

                setImportData(parsed);
                setShowImport(true);
            } catch (err) {
                toast('Error al leer el archivo. Verifique el formato.', 'error');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const handleImportConfirm = async () => {
        setImportProcessing(true);
        let creados = 0, actualizados = 0, errores = 0;

        for (const item of importData) {
            try {
                if (item._accion === 'omitir') continue;

                if (item._estado === 'duplicado' && item._accion === 'aumentar_stock') {
                    const nuevoStock = item._existente.stock_actual + item._stock_agregar;
                    await updateProducto(item._existente.id_producto, { stock_actual: nuevoStock });
                    actualizados++;
                } else if (item._estado === 'duplicado' && item._accion === 'reemplazar') {
                    await updateProducto(item._existente.id_producto, {
                        nombre: item.nombre,
                        precio_compra: item.precio_compra,
                        precio_venta: item.precio_venta,
                        stock_actual: item.stock_actual,
                        stock_minimo: item.stock_minimo,
                        categoria: item.categoria,
                        unidad_medida: item.unidad_medida,
                    });
                    actualizados++;
                } else if (item._estado === 'nuevo') {
                    await createProducto({
                        sku: item.sku,
                        nombre: item.nombre,
                        descripcion: item.descripcion,
                        categoria: item.categoria,
                        unidad_medida: item.unidad_medida,
                        precio_compra: item.precio_compra,
                        precio_venta: item.precio_venta,
                        stock_actual: item.stock_actual,
                        stock_minimo: item.stock_minimo,
                    });
                    creados++;
                }
            } catch { errores++; }
        }

        setImportProcessing(false);
        setShowImport(false);
        setImportData([]);
        loadData();
        toast(`Importacion completa: ${creados} creados, ${actualizados} actualizados${errores > 0 ? `, ${errores} errores` : ''}`, 'success');
    };

    // función descargarPlantilla 
    const descargarPlantilla = async () => {
        const XLSX = await import('xlsx');
        const fecha = new Date().toLocaleDateString('es-PE').replace(/\//g, '-');
        const plantilla = [
            {
                'SKU': 'FERR-001', 'Nombre': 'Martillo Stanley 16oz',
                'Categoría': 'Herramientas', 'Unidad': 'unidad',
                'P. Compra (S/)': 25.00, 'P. Venta (S/)': 42.00,
                'Margen %': 68.0, 'Stock Actual': 10,
                'Stock Mínimo': 3, 'Estado': 'Activo', 'Descripción': ''
            },
            {
                'SKU': 'FERR-002', 'Nombre': 'Destornillador Phillips #2',
                'Categoría': 'Herramientas', 'Unidad': 'unidad',
                'P. Compra (S/)': 8.00, 'P. Venta (S/)': 15.00,
                'Margen %': 87.5, 'Stock Actual': 20,
                'Stock Mínimo': 5, 'Estado': 'Activo', 'Descripción': ''
            },
        ];
        const ws = XLSX.utils.json_to_sheet(plantilla);
        ws['!cols'] = [
            { wch: 14 }, { wch: 32 }, { wch: 24 }, { wch: 10 },
            { wch: 16 }, { wch: 16 }, { wch: 12 },
            { wch: 13 }, { wch: 13 }, { wch: 10 }, { wch: 36 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Productos');
        XLSX.writeFile(wb, `plantilla_productos_${fecha}.xlsx`);
    };

    const nuevos = importData.filter(i => i._estado === 'nuevo').length;
    const duplicados = importData.filter(i => i._estado === 'duplicado').length;

    const stockActivos = productos.filter(p => p.estado).length;
    const stockBajos = productos.filter(p => p.stock_actual <= p.stock_minimo && p.stock_actual > 0).length;
    const sinStock = productos.filter(p => p.stock_actual === 0).length;
    const valorTotal = productos.reduce((s, p) => s + (p.precio_venta * p.stock_actual), 0);

    return (
        <div className="page-enter">

            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 }}>Productos</h1>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0' }}>
                        Gestion del catalogo — {productos.length} productos registrados
                    </p>
                </div>
                <div className="flex gap-3">
                    <div style={{ position: 'relative' }} ref={dataMenuRef}>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setShowDataMenu(v => !v)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            <FileSpreadsheet size={16} />
                            Datos
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transition: 'transform 0.2s', transform: showDataMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>

                        {showDataMenu && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                                background: 'white', border: '1px solid #e2e8f0',
                                borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                                minWidth: 200, zIndex: 50, overflow: 'hidden'
                            }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, padding: '10px 14px 6px' }}>
                                    Gestión de datos
                                </p>
                                <button
                                    onClick={() => { descargarPlantilla(); setShowDataMenu(false); }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#334155', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8f7ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    <FileSpreadsheet size={15} style={{ color: '#735DFF' }} /> Descargar Plantilla
                                </button>
                                <button
                                    onClick={() => { fileInputRef.current?.click(); setShowDataMenu(false); }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#334155', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8f7ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    <Upload size={15} style={{ color: '#735DFF' }} /> Importar CSV / Excel
                                </button>
                                <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                                <button
                                    onClick={() => {
                                        setShowDataMenu(false);
                                        downloadExcel(productos, 'productos', 'productos', toast, [
                                            { header: 'SKU',            value: p => p.sku },
                                            { header: 'Nombre',         value: p => p.nombre },
                                            { header: 'Categoría',      value: p => p.categoria },
                                            { header: 'Unidad',         value: p => p.unidad_medida },
                                            { header: 'P. Compra (S/)', value: p => Number(p.precio_compra) },
                                            { header: 'P. Venta (S/)',  value: p => Number(p.precio_venta) },
                                            { header: 'Margen %',       value: p => p.precio_compra > 0 ? Number(((p.precio_venta - p.precio_compra) / p.precio_compra * 100).toFixed(1)) : 0 },
                                            { header: 'Stock Actual',   value: p => Number(p.stock_actual) },
                                            { header: 'Stock Mínimo',   value: p => Number(p.stock_minimo) },
                                            { header: 'Estado',         value: p => p.estado ? 'Activo' : 'Inactivo' },
                                            { header: 'Descripción',    value: p => p.descripcion || '' },
                                        ]);
                                    }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#334155', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8f7ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    <Download size={15} style={{ color: '#735DFF' }} /> Exportar Excel
                                </button>
                            </div>
                        )}
                    </div>
                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileUpload} />
                    <button className="btn btn-primary" onClick={openCreate}>
                        <Plus size={18} /> Nuevo Producto
                    </button>
                </div>
            </div>

            {/* Mini KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Productos Activos', valor: stockActivos, icon: '📦', color: '#7c3aed', bg: '#f5f3ff', border: '#e9d5ff' },
                    { label: 'Stock Bajo', valor: stockBajos, icon: '⚠️', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                    { label: 'Sin Stock', valor: sinStock, icon: '🚫', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                    { label: 'Valor en Inventario', valor: formatCurrency(valorTotal), icon: '💰', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
                ].map((k, i) => (
                    <div key={i} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 28 }}>{k.icon}</span>
                        <div>
                            <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>{k.label}</p>
                            <p style={{ fontSize: 20, fontWeight: 800, color: k.color, margin: '2px 0 0' }}>{k.valor}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Busqueda y filtros */}
            <div className="card mb-5">
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="search-bar flex-1" style={{ minWidth: 220 }}>
                        <Search size={16} className="search-icon" />
                        <input className="form-input" placeholder="Buscar por nombre o SKU..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                    </div>
                    <button className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(!showFilters)}>
                        <Filter size={15} /> Filtros {(filterCat || filterStock) && '•'}
                    </button>
                    {(filterCat || filterStock) && (
                        <button className="btn btn-secondary btn-sm" onClick={() => { setFilterCat(''); setFilterStock(''); }}>
                            <X size={14} /> Limpiar
                        </button>
                    )}
                </div>
                {showFilters && (
                    <div className="flex flex-wrap gap-4 mt-4 pt-4" style={{ borderTop: '1px solid #f1f5f9' }}>
                        <div>
                            <label className="form-label">Categoria</label>
                            <select className="form-select" value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}>
                                <option value="">Todas las categorias</option>
                                {categoriasDB.map(c => (
                                    <option key={c.id_categoria} value={c.nombre}>
                                        {c.icono} {c.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Nivel de Stock</label>
                            <select className="form-select" value={filterStock} onChange={e => { setFilterStock(e.target.value); setPage(1); }}>
                                <option value="">Todos</option>
                                <option value="normal">Normal</option>
                                <option value="bajo">Stock Bajo</option>
                                <option value="critico">Sin Stock</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabla */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div className="loader"><div className="spinner"></div></div>
                ) : paginatedProducts.length === 0 ? (
                    <div className="empty-state" style={{ padding: 48 }}>
                        <Package size={48} style={{ color: '#cbd5e1' }} />
                        <p style={{ color: '#94a3b8', marginTop: 12 }}>No se encontraron productos</p>
                    </div>
                ) : (
                    <>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table" style={{ margin: 0 }}>
                                <thead>
                                    <tr>
                                        <th>SKU</th><th>Producto</th><th>Categoria</th>
                                        <th style={{ textAlign: 'right' }}>P. Compra</th>
                                        <th style={{ textAlign: 'right' }}>P. Venta</th>
                                        <th style={{ textAlign: 'right' }}>Margen</th>
                                        <th style={{ textAlign: 'center' }}>Stock</th>
                                        <th style={{ textAlign: 'center' }}>Estado</th>
                                        <th style={{ textAlign: 'center' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedProducts.map(p => {
                                        const mg = margen(p.precio_compra, p.precio_venta);
                                        const mgNum = parseFloat(mg);
                                        const mgColor = mgNum >= 50 ? '#15803d' : mgNum >= 25 ? '#d97706' : '#dc2626';
                                        const stockStatus = p.stock_actual === 0 ? 'critico' : p.stock_actual <= p.stock_minimo ? 'bajo' : 'normal';
                                        const sc = { critico: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }, bajo: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' }, normal: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' } }[stockStatus];
                                        return (
                                            <tr key={p.id_producto} style={{ opacity: p.estado ? 1 : 0.45 }}>
                                                <td><span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '2px 6px', borderRadius: 4 }}>{p.sku}</span></td>
                                                <td>
                                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: 0 }}>{p.nombre}</p>
                                                    {p.descripcion && <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{p.descripcion.substring(0, 40)}{p.descripcion.length > 40 ? '...' : ''}</p>}
                                                </td>
                                                <td><span style={{ fontSize: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', color: '#475569', fontWeight: 500 }}>{(categoriasDB.find(c => c.nombre === p.categoria)?.icono) || '📦'} {p.categoria}</span></td>
                                                <td style={{ textAlign: 'right', fontSize: 13, color: '#64748b' }}>{formatCurrency(p.precio_compra)}</td>
                                                <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{formatCurrency(p.precio_venta)}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {mg && <span style={{ fontSize: 13, fontWeight: 700, color: mgColor, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}><TrendingUp size={13} />{mg}%</span>}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                        <span style={{ fontSize: 15, fontWeight: 800, color: sc.color }}>{p.stock_actual}</span>
                                                        <span style={{ fontSize: 10, color: '#94a3b8' }}>min: {p.stock_minimo}</span>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                                                        {stockStatus === 'critico' ? 'Sin Stock' : stockStatus === 'bajo' ? 'Stock Bajo' : 'Normal'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                        <button onClick={() => openEdit(p)} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center' }} title="Editar"><Edit2 size={14} /></button>
                                                        <button onClick={() => toggleEstado(p)} style={{ background: p.estado ? '#fef2f2' : '#f0fdf4', border: `1px solid ${p.estado ? '#fecaca' : '#bbf7d0'}`, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: p.estado ? '#dc2626' : '#15803d', display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, gap: 3 }}>
                                                            {p.estado ? <><X size={13} /> Baja</> : <>✓ Activar</>}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #f1f5f9' }}>
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>Mostrando {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, productos.length)} de {productos.length}</span>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}><ChevronLeft size={16} /></button>
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button key={i} onClick={() => setPage(i + 1)} style={{ padding: '4px 10px', border: '1px solid', borderColor: page === i + 1 ? '#7c3aed' : '#e2e8f0', borderRadius: 6, background: page === i + 1 ? '#7c3aed' : 'white', color: page === i + 1 ? 'white' : '#475569', cursor: 'pointer', fontSize: 13, fontWeight: page === i + 1 ? 700 : 400 }}>{i + 1}</button>
                                    ))}
                                    <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── MODAL IMPORTACION ────────────────────────────────── */}
            {showImport && (
                <div className="modal-overlay" onClick={() => !importProcessing && setShowImport(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 820, maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header" style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: 16, marginBottom: 20 }}>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>Confirmar Importacion</h2>
                                <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
                                    {importData.length} productos encontrados — revise y confirme las acciones
                                </p>
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(false)} disabled={importProcessing}><X size={18} /></button>
                        </div>

                        {/* Resumen */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <CheckCircle size={20} style={{ color: '#15803d' }} />
                                <div>
                                    <p style={{ fontSize: 11, color: '#15803d', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>Productos Nuevos</p>
                                    <p style={{ fontSize: 22, fontWeight: 800, color: '#15803d', margin: 0 }}>{nuevos}</p>
                                </div>
                            </div>
                            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <AlertTriangle size={20} style={{ color: '#d97706' }} />
                                <div>
                                    <p style={{ fontSize: 11, color: '#d97706', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>Productos Duplicados</p>
                                    <p style={{ fontSize: 22, fontWeight: 800, color: '#d97706', margin: 0 }}>{duplicados}</p>
                                </div>
                            </div>
                        </div>

                        {/* Tabla de productos */}
                        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>SKU</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Nombre</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Estado</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>P. Venta</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Stock</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Accion</th>
                                        <th style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>Eliminar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importData.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: item._estado === 'duplicado' ? '#fffdf0' : 'white' }}>
                                            <td style={{ padding: '8px 10px' }}>
                                                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '2px 5px', borderRadius: 4 }}>{item.sku}</span>
                                            </td>
                                            <td style={{ padding: '8px 10px', maxWidth: 200 }}>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>{item.nombre}</p>
                                                {item._estado === 'duplicado' && (
                                                    <p style={{ margin: '2px 0 0', fontSize: 10, color: '#d97706' }}>
                                                        Ya existe — Stock actual: {item._existente?.stock_actual}
                                                    </p>
                                                )}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: item._estado === 'nuevo' ? '#f0fdf4' : '#fffbeb', color: item._estado === 'nuevo' ? '#15803d' : '#d97706', border: `1px solid ${item._estado === 'nuevo' ? '#bbf7d0' : '#fde68a'}` }}>
                                                    {item._estado === 'nuevo' ? 'Nuevo' : 'Duplicado'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                                                S/ {item.precio_venta.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>
                                                {item.stock_actual}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                {item._estado === 'duplicado' ? (
                                                    <select
                                                        value={item._accion}
                                                        onChange={e => {
                                                            const updated = [...importData];
                                                            updated[idx]._accion = e.target.value;
                                                            setImportData(updated);
                                                        }}
                                                        style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white' }}
                                                    >
                                                        <option value="aumentar_stock">Aumentar stock (+{item.stock_actual})</option>
                                                        <option value="reemplazar">Reemplazar datos</option>
                                                        <option value="omitir">Omitir</option>
                                                    </select>
                                                ) : (
                                                    <span style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>Crear nuevo</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => setImportData(importData.filter((_, i) => i !== idx))}
                                                    style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', color: '#dc2626', fontSize: 11 }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button className="btn btn-secondary" onClick={() => setShowImport(false)} disabled={importProcessing}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleImportConfirm} disabled={importProcessing || importData.length === 0} style={{ minWidth: 160 }}>
                                {importProcessing ? 'Importando...' : `Confirmar Importacion (${importData.filter(i => i._accion !== 'omitir').length} productos)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Nuevo/Editar Producto */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
                        <div className="modal-header" style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: 16, marginBottom: 20 }}>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                                <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>{editingProduct ? `Modificando: ${editingProduct.nombre}` : 'Complete los campos para agregar al catalogo'}</p>
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Identificacion</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="form-label">SKU *</label>
                                    <input className="form-input" required value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value.toUpperCase() })} placeholder="FERR-001" style={{ fontFamily: 'monospace', fontWeight: 700 }} />
                                </div>
                                <div>
                                    <label className="form-label">Código de Barras</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="form-input" value={form.codigo_barras || ''} onChange={e => setForm({ ...form, codigo_barras: e.target.value })} placeholder="Escanear o digitar..." style={{ fontFamily: 'monospace' }} />
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">Nombre del Producto *</label>
                                    <input className="form-input" required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Martillo Stanley 16oz" />
                                </div>
                                <div>
                                    <label className="form-label">Categoria *</label>
                                    <select className="form-select" required value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                                        <option value="">Seleccionar categoria...</option>
                                        {categoriasDB.map(c => (
                                            <option key={c.id_categoria} value={c.nombre}>
                                                {c.icono} {c.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Unidad de Medida *</label>
                                    <select className="form-select" required value={form.unidad_medida} onChange={e => setForm({ ...form, unidad_medida: e.target.value })}>
                                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="form-label">Descripcion</label>
                                    <input className="form-input" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripcion opcional del producto" />
                                </div>
                            </div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 4 }}>Precios</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="form-label">Precio de Compra (S/) *</label>
                                    <input className="form-input" type="number" step="0.01" min="0" required value={form.precio_compra} onChange={e => setForm({ ...form, precio_compra: e.target.value })} placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="form-label">Precio de Venta (S/) *</label>
                                    <input className="form-input" type="number" step="0.01" min="0" required value={form.precio_venta} onChange={e => setForm({ ...form, precio_venta: e.target.value })} placeholder="0.00" />
                                </div>
                                {form.precio_compra && form.precio_venta && Number(form.precio_compra) > 0 && (
                                    <div className="md:col-span-2">
                                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <TrendingUp size={16} style={{ color: '#15803d' }} />
                                            <span style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>Margen: {margen(Number(form.precio_compra), Number(form.precio_venta))}%</span>
                                            <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>Ganancia: {formatCurrency(Number(form.precio_venta) - Number(form.precio_compra))}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 4 }}>Stock</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="form-label">Stock Actual *</label>
                                    <input className="form-input" type="number" min="0" required value={form.stock_actual} onChange={e => setForm({ ...form, stock_actual: e.target.value })} placeholder="0" />
                                </div>
                                <div>
                                    <label className="form-label">Stock Minimo *</label>
                                    <input className="form-input" type="number" min="0" required value={form.stock_minimo} onChange={e => setForm({ ...form, stock_minimo: e.target.value })} placeholder="0" />
                                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Se alertara cuando el stock baje de este nivel</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ minWidth: 140 }}>{editingProduct ? 'Guardar Cambios' : 'Crear Producto'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}