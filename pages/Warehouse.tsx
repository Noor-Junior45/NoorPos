import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, Tag, StoreSettings, Sale } from '../types';
import { StoreService } from '../services/storeService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Plus, Search, AlertTriangle, Scan, Tag as TagIcon, LayoutDashboard, Box, Calendar, Trash2, Edit2, X, Filter, CheckSquare, Square, ArrowLeft, Settings, Bell, Hash, MapPin, Factory, Clock, ChevronDown, Sparkles, Layers, DollarSign, Percent, FileText, Scale, ChevronUp, Copy, ListFilter } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Html5Qrcode } from 'html5-qrcode';


enum SubTab {
  DASHBOARD = 'DASHBOARD',
  PRODUCTS = 'PRODUCTS',
  TAGS = 'TAGS',
  SETTINGS = 'SETTINGS'
}

enum ProductFilter {
  ALL = 'ALL',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  EXPIRING_SOON = 'EXPIRING_SOON'
}

const UNITS = [
  'pcs', 'kg', 'g', 'l', 'ml', 'pack', 'box', 'dozen', 'm', 'cm', 
  'mg', 'tablet', 'strip', 'capsule', 'syrup', 'vial', 'ampoule', 'kit'
];

const TAG_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', 
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', 
    '#ec4899', '#f43f5e', '#64748b', '#1f2937'
];

// Helper Component for Settings Rows to prevent re-renders losing focus
const ProductSettingRow: React.FC<{ 
    product: Product; 
    type: 'stock' | 'expiry'; 
    onUpdate: (id: string, updates: Partial<Product>) => void 
}> = ({ product, type, onUpdate }) => {
    const [val, setVal] = useState(type === 'stock' ? product.lowStockThreshold : (product.expiryDate || ''));

    useEffect(() => {
        setVal(type === 'stock' ? product.lowStockThreshold : (product.expiryDate || ''));
    }, [product.lowStockThreshold, product.expiryDate, type]);

    const handleBlur = () => {
        if (type === 'stock') {
            const numVal = parseInt(val as string) || 0;
            if (numVal !== product.lowStockThreshold) {
                onUpdate(product.id, { lowStockThreshold: numVal });
            }
        } else {
            if (val !== product.expiryDate) {
                onUpdate(product.id, { expiryDate: val as string });
            }
        }
    };

    return (
        <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 group">
            <div className="min-w-0 flex-1 pr-4">
                <div className="font-medium text-sm text-gray-700 truncate">{product.name}</div>
                <div className="text-xs text-gray-400 flex items-center gap-2">
                    {type === 'stock' ? (
                        <>
                            <span className={product.stock < product.lowStockThreshold ? "text-red-500 font-bold" : ""}>
                                {product.stock} {product.unit} in stock
                            </span>
                        </>
                    ) : (
                        <>
                            <span>Manuf: {product.manufacturingDate ? new Date(product.manufacturingDate).toLocaleDateString() : '-'}</span>
                        </>
                    )}
                </div>
            </div>
            <div className="shrink-0">
                <div className={`flex items-center bg-white border border-gray-200 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/50 transition-all ${type === 'expiry' ? 'w-36' : 'w-24'}`}>
                    <input 
                        type={type === 'stock' ? "number" : "date"}
                        className="w-full px-2 py-1.5 text-sm bg-transparent outline-none text-gray-700 font-medium"
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        onBlur={handleBlur}
                        placeholder={type === 'stock' ? "0" : "YYYY-MM-DD"}
                    />
                    {type === 'stock' && (
                        <span className="bg-gray-50 border-l border-gray-200 px-2 py-1.5 text-xs text-gray-500 select-none">
                            limit
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export const Warehouse: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SubTab>(SubTab.DASHBOARD);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ expiryAlertDays: 7, lowStockDefault: 10, soundEnabled: true, currencySymbol: '₹' });
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Grouping State
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Product Form State
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ 
    name: '', sku: '', stock: 0, unit: 'pcs', capacity: '', 
    buyPrice: 0, sellPrice: 0, wholesalePrice: 0, 
    lowStockThreshold: 10, location: '', taxRate: 0,
    expiryDate: '', manufacturingDate: ''
  });

  const [showTagModal, setShowTagModal] = useState(false);
  const [newTag, setNewTag] = useState<Partial<Tag>>({ name: '', color: '#3b82f6' });
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'product' | 'tag' | 'bulk_products', name: string } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ProductFilter>(ProductFilter.ALL);
  const [settingsSearch, setSettingsSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [invData, tagData, settingsData, salesData] = await Promise.all([ 
        StoreService.getInventory(), 
        StoreService.getTags(), 
        StoreService.getSettings(),
        StoreService.getSales() 
    ]);
    setProducts(invData);
    setTags(tagData);
    setSettings(settingsData);
    setSales(salesData);
    setLoading(false);
  };

  // Barcode Scanner Logic
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    if (showScanner) {
        const timeoutId = setTimeout(() => {
            html5QrCode = new Html5Qrcode("reader");
            const config = { fps: 10, qrbox: { width: 250, height: 250 } };
            
            html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    if (settings.soundEnabled) {
                        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                        audio.play().catch(() => {});
                    }
                    
                    if (isEditorOpen) {
                        setNewProduct(prev => ({ ...prev, sku: decodedText }));
                    } else {
                        setSearchTerm(decodedText);
                        setActiveTab(SubTab.PRODUCTS);
                    }
                    setShowScanner(false);
                    html5QrCode?.stop().then(() => html5QrCode?.clear());
                },
                (errorMessage) => {}
            ).catch(err => {
                console.error("Error starting scanner", err);
            });
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error);
            }
        };
    }
  }, [showScanner, isEditorOpen, settings.soundEnabled]);
  
  const handleUpdateSettings = async (newSettings: StoreSettings) => {
      setSettings(newSettings);
      await StoreService.saveSettings(newSettings);
  };

  const handleInlineProductUpdate = async (id: string, updates: Partial<Product>) => {
      // Optimistic update
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      await StoreService.updateProduct(id, updates);
  };
  
  const getTag = (id?: string) => tags.find(t => t.id === id);

  const isAboutToExpire = (dateStr?: string) => {
    if (!dateStr) return false;
    const diffDays = (new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= (settings.expiryAlertDays || 7);
  };
  const isExpired = (dateStr?: string) => !dateStr ? false : new Date(dateStr) < new Date();
  const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '-';
  const formatDateTime = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const handleSaveProduct = async () => {
    if (!newProduct.name || !newProduct.sellPrice) return;
    if (isEditing && newProduct.id) await StoreService.updateProduct(newProduct.id, newProduct);
    else await StoreService.addProduct(newProduct as Product);
    setIsEditorOpen(false); setIsEditing(false); loadData(); resetForm();
  };
  
  const handleSaveTag = async () => { 
    if (!newTag.name) return; 
    const createdTag = await StoreService.addTag(newTag as Tag); 
    await loadData();
    if (isEditorOpen) setNewProduct(prev => ({ ...prev, tagId: createdTag.id }));
    setShowTagModal(false); 
    setNewTag({ name: '', color: '#3b82f6' }); 
  };

  const resetForm = () => {
    setNewProduct({ 
        name: '', sku: '', stock: 0, unit: 'pcs', capacity: '', 
        buyPrice: 0, sellPrice: 0, wholesalePrice: 0, 
        lowStockThreshold: settings.lowStockDefault, location: '', taxRate: 0,
        expiryDate: '', manufacturingDate: ''
    });
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) newExpanded.delete(groupId);
    else newExpanded.add(groupId);
    setExpandedGroups(newExpanded);
  };

  const handleNameBlur = () => {
    if (!newProduct.name || isEditing) return;
    const existing = products.find(p => p.name.toLowerCase() === newProduct.name?.toLowerCase());
    if (existing) {
        setNewProduct(prev => ({
            ...prev,
            tagId: prev.tagId || existing.tagId,
            location: prev.location || existing.location,
            unit: existing.unit,
            capacity: existing.capacity,
            lowStockThreshold: existing.lowStockThreshold,
            buyPrice: prev.buyPrice || existing.buyPrice,
            wholesalePrice: prev.wholesalePrice || existing.wholesalePrice,
            sellPrice: prev.sellPrice || existing.sellPrice,
            taxRate: existing.taxRate,
        }));
    }
  };

  const handleEditProduct = (p: Product) => { setNewProduct({ ...p }); setIsEditing(true); setIsEditorOpen(true); };
  
  const handleCloneProduct = (p: Product) => {
      setNewProduct({
          ...p,
          id: undefined,
          stock: 0,
          expiryDate: '',
          manufacturingDate: '',
          sku: p.sku
      });
      setIsEditing(false);
      setIsEditorOpen(true);
  };

  const handleOpenAdd = () => { resetForm(); setIsEditing(false); setIsEditorOpen(true); };
  
  const confirmDelete = async () => { 
    if (!itemToDelete) return; 
    if (itemToDelete.type === 'product') await StoreService.deleteProduct(itemToDelete.id); 
    else if (itemToDelete.type === 'tag') await StoreService.deleteTag(itemToDelete.id);
    
    setItemToDelete(null); 
    loadData(); 
  };
  
  const baseFilteredProducts = useMemo(() => {
    let processed = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeFilter === ProductFilter.LOW_STOCK) processed = processed.filter(p => p.stock > 0 && p.stock < p.lowStockThreshold);
    if (activeFilter === ProductFilter.OUT_OF_STOCK) processed = processed.filter(p => p.stock === 0);
    if (activeFilter === ProductFilter.EXPIRING_SOON) processed = processed.filter(p => isAboutToExpire(p.expiryDate));
    return processed;
  }, [products, searchTerm, activeFilter, settings.expiryAlertDays]);

  const groupedProducts = useMemo(() => {
    const groups: { [key: string]: Product[] } = {};
    baseFilteredProducts.forEach(p => {
        // Group by Name, Capacity, and Unit to separate variations (e.g., 500ml vs 1L)
        // while keeping same-spec batches together.
        const uniqueGroupKey = `${p.name}|${p.capacity || ''}|${p.unit}`;
        
        if (!groups[uniqueGroupKey]) groups[uniqueGroupKey] = [];
        groups[uniqueGroupKey].push(p);
    });
    return Object.keys(groups).map(key => ({ key, items: groups[key] }));
  }, [baseFilteredProducts]);

  const variantCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    groupedProducts.forEach(g => {
        const name = g.items[0].name;
        counts[name] = (counts[name] || 0) + 1;
    });
    return counts;
  }, [groupedProducts]);

  const getUnitBadgeStyle = (unitString: string, isMultiVariant: boolean) => {
      if (!isMultiVariant) return "bg-gray-100 text-gray-600 border-gray-200"; // Default Grey
      
      const colors = [
        'bg-orange-100 text-orange-800 border-orange-200',
        'bg-blue-100 text-blue-800 border-blue-200',
        'bg-purple-100 text-purple-800 border-purple-200',
        'bg-rose-100 text-rose-800 border-rose-200',
        'bg-emerald-100 text-emerald-800 border-emerald-200',
        'bg-indigo-100 text-indigo-800 border-indigo-200',
        'bg-cyan-100 text-cyan-800 border-cyan-200',
    ];
    let hash = 0;
    for (let i = 0; i < unitString.length; i++) {
        hash = unitString.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const stockValueByCategory = useMemo(() => {
    if (!tags || !products) return [];
    const valueByTag: { [key: string]: { name: string, value: number, color: string } } = {};
    tags.forEach(tag => { valueByTag[tag.id] = { name: tag.name, value: 0, color: tag.color }; });
    products.forEach(p => {
        const value = p.stock * p.sellPrice;
        if (p.tagId && valueByTag[p.tagId]) valueByTag[p.tagId].value += value;
    });
    return Object.values(valueByTag).filter(d => d.value > 0);
  }, [products, tags]);

  const renderProductGroup = (groupKey: string, items: Product[]) => {
      const p = items[0]; 
      const tag = getTag(p.tagId);
      const totalStock = items.reduce((acc, item) => acc + item.stock, 0);
      const borderColor = tag?.color || '#cbd5e1';
      const isExpanded = expandedGroups.has(groupKey);
      const isLow = totalStock < p.lowStockThreshold;
      const anyExpiring = items.some(i => isAboutToExpire(i.expiryDate));

      const unitString = `${p.capacity || '1'} ${p.unit}`;
      const isMultiVariant = (variantCounts[p.name] || 0) > 1;
      const unitBadgeClass = getUnitBadgeStyle(unitString, isMultiVariant);

      // Determine Earliest Expiry
      const validExpiries = items
        .map(i => i.expiryDate)
        .filter((d): d is string => !!d && d !== '');
      
      let earliestExpiryDisplay: string | null = null;
      let isEarliestLow = false;

      if (validExpiries.length > 0) {
        // Sort to find the earliest date. ISO format sorts naturally.
        validExpiries.sort();
        earliestExpiryDisplay = validExpiries[0];
        isEarliestLow = isAboutToExpire(earliestExpiryDisplay);
      }

      return (
        <Card 
            key={groupKey} 
            className="flex flex-col !p-0 overflow-hidden hover:shadow-xl transition-all duration-300 shadow-sm bg-white"
            style={{ 
                border: `2px solid ${borderColor}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}
        >
            <div className="p-3 flex flex-col gap-1">
                {/* Line 1: Name & Actions (ALWAYS VISIBLE) */}
                <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-gray-900 text-2xl leading-tight line-clamp-2" title={p.name}>{p.name}</h4>
                    <div className="flex gap-2 shrink-0">
                         <button onClick={() => handleEditProduct(p)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors bg-gray-50 border border-gray-100">
                            <Edit2 size={18} />
                         </button>
                         <button onClick={() => setItemToDelete({ id: p.id, type: 'product', name: p.name })} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors bg-gray-50 border border-gray-100">
                            <Trash2 size={18} />
                         </button>
                    </div>
                </div>

                {/* Line 2: SKU (Black, Bold) */}
                <div className="text-sm font-mono font-bold text-black mt-1 mb-3">
                    SKU: {p.sku || 'N/A'}
                </div>

                {/* Line 3: Prices (Compact Grid - Reverted to Row Layout) */}
                <div className="grid grid-cols-3 gap-2 border-b border-dashed border-gray-200 pb-2 mb-1">
                    <div className="flex flex-col">
                        <span className="text-xs uppercase font-bold text-gray-500">Buy</span>
                        <span className="font-bold text-lg text-gray-700">{settings.currencySymbol}{p.buyPrice}</span>
                    </div>
                    <div className="flex flex-col border-l border-gray-200 pl-2">
                        <span className="text-xs uppercase font-bold text-gray-500">Wholesale</span>
                        <span className="font-bold text-lg text-blue-600">{settings.currencySymbol}{p.wholesalePrice || '-'}</span>
                    </div>
                    <div className="flex flex-col border-l border-gray-200 pl-2">
                        <span className="text-xs uppercase font-bold text-gray-500">Sell</span>
                        <span className="font-extrabold text-3xl text-green-700 leading-none">{settings.currencySymbol}{p.sellPrice}</span>
                    </div>
                </div>

                {/* Line 4: Info Line (Loc, Unit, Tax, Qty) - Reverted to Row, Added Tax Logic */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-gray-600 mt-2">
                    <span className="flex items-center gap-1">
                        <MapPin size={14} className="text-gray-900"/> {p.location || 'N/A'}
                    </span>
                    
                    <span className="flex items-center gap-1">
                        Unit: 
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${unitBadgeClass}`}>
                            {unitString}
                        </span>
                    </span>

                    {/* Tax Always Visible */}
                    <span className="flex items-center gap-1">
                        Tax: {p.taxRate ? `${p.taxRate}%` : 'N/A'}
                    </span>

                    <span className={`flex items-center gap-1 ${isLow ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                        <Box size={14} className={isLow ? 'text-red-600' : 'text-gray-500'}/> Qty: {totalStock}
                    </span>
                </div>

                 {/* Line 5: Earliest Expiry Date */}
                 <div className="flex items-center gap-2 mt-2 text-sm">
                     <Clock size={14} className={isEarliestLow ? "text-amber-600" : "text-gray-400"} />
                     <span className="text-gray-500 font-medium">Expiry:</span>
                     <span className={`font-bold ${isEarliestLow ? "text-amber-700" : "text-gray-800"}`}>
                        {earliestExpiryDisplay ? formatDate(earliestExpiryDisplay) : 'N/A'}
                     </span>
                 </div>

                {/* Line 6: Badges & Toggle */}
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                    <div className="flex gap-2 flex-wrap">
                        {isLow && (
                            <div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                                <AlertTriangle size={12}/> Low Stock
                            </div>
                        )}
                        {anyExpiring && (
                            <div className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                                <Clock size={12}/> Expiring
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-1 ml-auto">
                         <Button size="sm" variant="neutral" onClick={() => handleCloneProduct(p)} className="!px-2 !py-1 h-8 bg-gray-100 hover:bg-gray-200 border-gray-200" title="Add Batch">
                            <Plus size={16}/>
                         </Button>
                         <button 
                            onClick={() => toggleGroup(groupKey)} 
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1 bg-gray-50 rounded-md border border-gray-100 h-8 w-8 flex items-center justify-center"
                        >
                            {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                        </button>
                    </div>
                </div>
            </div>

            {/* Dropdown Content */}
            {isExpanded && (
                <div className="bg-gray-50 border-t border-gray-200 p-2 text-xs animate-in slide-in-from-top-1 duration-200">
                     {/* Batches Header */}
                     <div className="grid grid-cols-4 text-gray-500 font-bold uppercase mb-2 px-1 text-[10px] tracking-wide">
                        <span>Added</span>
                        <span className="text-center">Expiry</span>
                        <span className="text-center">Qty</span>
                        <span className="text-right">Action</span>
                     </div>
                     <div className="space-y-1">
                        {items.map(item => {
                            const expiring = isAboutToExpire(item.expiryDate);
                            return (
                                <div key={item.id} className="grid grid-cols-4 items-center bg-white border border-gray-200 p-2 rounded-md shadow-sm">
                                    <div className="text-gray-700 font-medium truncate">{new Date(item.createdAt || '').toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})}</div>
                                    <div className={`text-center font-bold ${expiring ? 'text-amber-600' : 'text-gray-600'}`}>
                                        {item.expiryDate ? formatDate(item.expiryDate) : '-'}
                                        {expiring && <span className="block text-[8px] uppercase font-extrabold text-amber-600 leading-tight mt-0.5">Sell First</span>}
                                    </div>
                                    <div className="text-center font-extrabold text-gray-900 text-sm">{item.stock}</div>
                                    <div className="flex justify-end gap-1">
                                        <button onClick={() => handleEditProduct(item)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-100 transition-colors"><Edit2 size={14}/></button>
                                        <button onClick={() => setItemToDelete({ id: item.id, type: 'product', name: `${item.name} (Batch)` })} className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-100 transition-colors"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            );
                        })}
                     </div>
                </div>
            )}
        </Card>
      );
  };

  const renderEditor = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-24">
        <div className="flex items-center gap-4 mb-6">
            <button onClick={() => setIsEditorOpen(false)} className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"><ArrowLeft size={20} /></button>
            <h2 className="text-2xl font-bold text-gray-800">{isEditing ? 'Edit Product' : 'Add New Product'}</h2>
        </div>

        <Card className="max-w-5xl mx-auto !p-8 shadow-lg">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                
                <div className="md:col-span-2 space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <FileText size={16} className="text-blue-500"/> Product Name
                    </label>
                    <Input 
                        placeholder="e.g. Organic Bananas" 
                        value={newProduct.name} 
                        onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                        onBlur={handleNameBlur}
                        autoFocus={!isEditing}
                        className="w-full border-2 border-blue-200 focus:border-blue-500 bg-blue-50/10 rounded-lg !py-3 !px-6"
                    />
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Scan size={16} className="text-blue-500"/> SKU / Barcode
                    </label>
                    <div className="flex w-full">
                        <Input 
                            placeholder="Scan or type" 
                            value={newProduct.sku} 
                            onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                            className="w-full border-2 border-blue-200 focus:border-blue-500 bg-blue-50/10 rounded-l-lg rounded-r-none !py-3 border-r-0 !px-6"
                        />
                        <button onClick={() => setShowScanner(true)} className="px-4 bg-blue-50 text-blue-600 rounded-r-lg border-2 border-blue-200 hover:bg-blue-100 transition-colors border-l-0">
                            <Scan size={20}/>
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Layers size={16} className="text-blue-500"/> Category
                    </label>
                    <select 
                        value={newProduct.tagId || ''} 
                        onChange={(e) => e.target.value === 'NEW_TAG_TRIGGER' ? setShowTagModal(true) : setNewProduct({...newProduct, tagId: e.target.value})}
                        className="w-full rounded-lg px-6 py-3 text-base bg-blue-50/10 border-2 border-blue-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all appearance-none"
                    >
                        <option value="">Select Category</option>
                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        <option disabled>──────────</option>
                        <option value="NEW_TAG_TRIGGER" className="font-bold text-blue-600">+ Create New</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Factory size={16} className="text-green-600"/> Buy Price ({settings.currencySymbol})
                    </label>
                    <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={newProduct.buyPrice || ''} 
                        onChange={e => setNewProduct({...newProduct, buyPrice: parseFloat(e.target.value) || 0})}
                        className="w-full border-2 border-green-200 focus:border-green-500 bg-green-50/10 rounded-lg !py-3 !px-6"
                    />
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <TagIcon size={16} className="text-green-600"/> Sell Price ({settings.currencySymbol})
                    </label>
                    <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={newProduct.sellPrice || ''} 
                        onChange={e => setNewProduct({...newProduct, sellPrice: parseFloat(e.target.value) || 0})}
                        className="w-full border-2 border-green-200 focus:border-green-500 font-bold text-green-700 bg-green-50/10 rounded-lg !py-3 !px-6"
                    />
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Box size={16} className="text-green-600"/> Wholesale Price ({settings.currencySymbol})
                    </label>
                    <Input 
                        type="number" 
                        placeholder="0.00" 
                        value={newProduct.wholesalePrice || ''} 
                        onChange={e => setNewProduct({...newProduct, wholesalePrice: parseFloat(e.target.value) || 0})}
                        className="w-full border-2 border-green-200 focus:border-green-500 bg-green-50/10 rounded-lg !py-3 !px-6"
                    />
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Percent size={16} className="text-green-600"/> Tax Rate (%)
                    </label>
                    <Input 
                        type="number" 
                        placeholder="0" 
                        value={newProduct.taxRate || ''} 
                        onChange={e => setNewProduct({...newProduct, taxRate: parseFloat(e.target.value) || 0})}
                        className="w-full border-2 border-green-200 focus:border-green-500 bg-green-50/10 rounded-lg !py-3 !px-6"
                    />
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <MapPin size={16} className="text-purple-500"/> Location
                    </label>
                    <Input 
                        placeholder="e.g. Aisle 3" 
                        value={newProduct.location} 
                        onChange={e => setNewProduct({...newProduct, location: e.target.value})}
                        className="w-full border-2 border-purple-200 focus:border-purple-500 bg-purple-50/10 rounded-lg !py-3 !px-6"
                    />
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Scale size={16} className="text-purple-500"/> Unit Size
                    </label>
                    <div className="flex w-full shadow-sm rounded-lg overflow-hidden border-2 border-purple-200 focus-within:border-purple-500 transition-all bg-purple-50/10 h-[50px]">
                        <input 
                            type="text" 
                            placeholder="1" 
                            className="w-1/3 bg-transparent px-3 text-center font-medium focus:outline-none border-r border-purple-200 text-gray-700 h-full"
                            value={newProduct.capacity || ''}
                            onChange={(e) => setNewProduct({...newProduct, capacity: e.target.value})}
                        />
                        <select 
                            value={newProduct.unit || 'pcs'} 
                            onChange={e => setNewProduct({...newProduct, unit: e.target.value})} 
                            className="w-2/3 bg-transparent px-3 font-medium text-gray-700 focus:outline-none cursor-pointer hover:bg-purple-50/20 h-full"
                        >
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Box size={16} className="text-purple-500"/> Stock Quantity
                    </label>
                    <Input 
                        type="number" 
                        placeholder="0" 
                        value={newProduct.stock || ''} 
                        onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})}
                        className="w-full border-2 border-purple-200 focus:border-purple-500 bg-purple-50/10 rounded-lg !py-3 !px-6"
                    />
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <AlertTriangle size={16} className="text-purple-500"/> Low Stock Alert
                    </label>
                    <Input 
                        type="number" 
                        placeholder="10" 
                        value={newProduct.lowStockThreshold || ''} 
                        onChange={e => setNewProduct({...newProduct, lowStockThreshold: parseInt(e.target.value) || 0})}
                        className="w-full border-2 border-purple-200 focus:border-purple-500 bg-purple-50/10 rounded-lg !py-3 !px-6"
                    />
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Factory size={16} className="text-amber-500"/> Manufacturing Date
                    </label>
                    <Input 
                        type="date" 
                        value={newProduct.manufacturingDate || ''} 
                        onChange={(e) => setNewProduct({...newProduct, manufacturingDate: e.target.value})}
                        className="w-full border-2 border-amber-200 focus:border-amber-500 bg-amber-50/10 rounded-lg !py-3 !px-6"
                    />
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Clock size={16} className="text-amber-500"/> Expiry Date
                    </label>
                    <Input 
                        type="date" 
                        value={newProduct.expiryDate || ''} 
                        onChange={(e) => setNewProduct({...newProduct, expiryDate: e.target.value})}
                        className="w-full border-2 border-amber-200 focus:border-amber-500 bg-amber-50/10 rounded-lg !py-3 !px-6"
                    />
                </div>

             </div>

             <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-100">
                <Button variant="neutral" onClick={() => setIsEditorOpen(false)} className="w-32 py-3 rounded-lg">Cancel</Button>
                <Button onClick={handleSaveProduct} className="w-48 py-3 rounded-lg shadow-lg">{isEditing ? "Update Product" : "Save Product"}</Button>
             </div>
        </Card>
    </div>
  );

  const renderDashboard = () => {
    const totalValue = products.reduce((acc, p) => acc + (p.stock * p.sellPrice), 0);
    const totalUnits = products.reduce((acc, p) => acc + p.stock, 0);
    const lowStockItems = products.filter(p => p.stock < p.lowStockThreshold);
    const outOfStockItems = products.filter(p => p.stock === 0);
    const expiringItems = products.filter(p => isAboutToExpire(p.expiryDate));
    
    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-blue-400">
             <div className="text-blue-600 text-xs uppercase font-bold tracking-wider">Total Products</div>
             <div className="text-2xl font-bold mt-1 text-gray-800">{products.length}</div>
          </Card>
          <Card className="border-l-4 border-green-400">
             <div className="text-green-600 text-xs uppercase font-bold tracking-wider">Total Value</div>
             <div className="text-2xl font-bold mt-1 text-gray-800">{settings.currencySymbol}{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </Card>
          <Card className="border-l-4 border-red-400">
             <div className="text-red-600 text-xs uppercase font-bold tracking-wider">Low Stock</div>
             <div className="text-2xl font-bold mt-1 text-gray-800">{lowStockItems.length}</div>
          </Card>
          <Card className="border-l-4 border-gray-400">
             <div className="text-gray-600 text-xs uppercase font-bold tracking-wider">Stock Units</div>
             <div className="text-2xl font-bold mt-1 text-gray-800">{totalUnits.toLocaleString()}</div>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-t-4 border-red-500 flex flex-col h-full">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <AlertTriangle size={20} className="text-red-500"/> Low Stock Alerts
                </h3>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[250px] pr-2">
                    {lowStockItems.length === 0 && outOfStockItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-24 text-gray-400">
                             <CheckSquare size={24} className="mb-1 opacity-50"/>
                             <span className="text-sm">Stock levels are healthy</span>
                        </div>
                    ) : (
                        <>
                            {outOfStockItems.map(p => (
                                <div key={p.id} className="flex justify-between items-center text-sm p-3 bg-red-50 rounded-lg border border-red-100 text-red-700">
                                    <span className="font-medium truncate">{p.name}</span>
                                    <span className="font-bold bg-white px-2 py-1 rounded shadow-sm text-xs">Out of Stock</span>
                                </div>
                            ))}
                            {lowStockItems.filter(p => p.stock > 0).map(p => (
                                <div key={p.id} className="flex justify-between items-center text-sm p-3 bg-orange-50 rounded-lg border border-orange-100 text-orange-800">
                                    <span className="font-medium truncate">{p.name}</span>
                                    <span className="font-bold bg-white px-2 py-1 rounded shadow-sm text-xs">{p.stock} {p.unit} left</span>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </Card>

            <Card className="border-t-4 border-amber-500 flex flex-col h-full">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Clock size={20} className="text-amber-500"/> Expiry Alerts
                </h3>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[250px] pr-2">
                    {expiringItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-24 text-gray-400">
                             <CheckSquare size={24} className="mb-1 opacity-50"/>
                             <span className="text-sm">No items expiring soon</span>
                        </div>
                    ) : (
                        expiringItems.map(p => (
                            <div key={p.id} className="flex justify-between items-center text-sm p-3 bg-amber-50 rounded-lg border border-amber-100 text-amber-800">
                                <span className="font-medium truncate">{p.name}</span>
                                <span className="font-bold bg-white px-2 py-1 rounded shadow-sm text-xs">{formatDate(p.expiryDate)}</span>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
        
        <Card>
            <h3 className="font-bold text-gray-800 mb-4">Stock Value by Category</h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={stockValueByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                            {stockValueByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(value) => `${settings.currencySymbol}${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </Card>
      </div>
    );
  };
  
  const renderProducts = () => {
    const isSearching = searchTerm.trim().length > 0;

    // Use a function to render the grouped structure to keep code clean
    const renderGroupedSection = (sectionTitle: string | null, sectionIcon: React.ReactNode, items: {key: string, items: Product[]}[], color?: string) => {
        if (items.length === 0) return null;
        return (
            <section className="mb-8 last:mb-0">
                {sectionTitle && (
                    <div className="flex items-center gap-3 mb-4 px-1 sticky top-0 bg-[#fdfdfc] z-10 py-2">
                        {color && <div className="w-3 h-8 rounded-full shadow-sm" style={{ backgroundColor: color }}></div>}
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            {sectionIcon} {sectionTitle}
                        </h3>
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full font-bold">{items.length} Products</span>
                    </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {items.map(({ key, items }) => renderProductGroup(key, items))}
                </div>
            </section>
        );
    };

    return (
    <div className="space-y-6 animate-in fade-in pb-24">
        <div className="flex flex-col items-center gap-4 pt-2">
            <div className="relative w-full max-w-2xl mx-auto group">
                <div className="absolute inset-0 bg-blue-100/50 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative flex items-center bg-white rounded-full shadow-[0_2px_15px_-3px_rgba(0,0,0,0.1),0_10px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.15)] transition-shadow duration-300 border border-gray-100">
                    <div className="pl-6 text-gray-400">
                        <Search size={22} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search your inventory..." 
                        className="w-full bg-transparent border-none focus:ring-0 px-4 py-4 text-lg text-gray-800 placeholder-gray-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button 
                        onClick={() => setShowScanner(true)}
                        className="pr-6 pl-3 text-gray-400 hover:text-blue-600 transition-colors tooltip"
                        title="Scan Barcode"
                    >
                        <Scan size={22} />
                    </button>
                </div>
            </div>

            <div className="w-full md:hidden px-1">
                 <Button onClick={handleOpenAdd} className="w-full rounded-full flex items-center justify-center py-3 shadow-md bg-blue-600 text-white">
                    <Plus size={18} className="mr-2"/> Add Product
                 </Button>
            </div>

            <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4 px-1">
                <div className="w-full md:flex-1 overflow-x-auto pb-2 scrollbar-hide flex items-center gap-2">
                     {[
                        { id: ProductFilter.ALL, label: 'All Stocks' },
                        { id: ProductFilter.LOW_STOCK, label: 'Low Stock' },
                        { id: ProductFilter.OUT_OF_STOCK, label: 'Out of Stock' },
                        { id: ProductFilter.EXPIRING_SOON, label: 'Expiring' }
                    ].map(filter => (
                        <button
                            key={filter.id}
                            onClick={() => setActiveFilter(filter.id)}
                            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all border shrink-0 ${
                                activeFilter === filter.id
                                ? 'bg-gray-800 text-white border-gray-800 shadow-md' 
                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                <div className="hidden md:flex items-center gap-3 shrink-0">
                    <Button onClick={handleOpenAdd} className="rounded-full flex items-center px-6 py-2 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all hover:-translate-y-0.5">
                        <Plus size={18} className="mr-2"/> Add Product
                    </Button>
                </div>
            </div>
        </div>
        
        {groupedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <Search size={32} className="opacity-20 text-gray-500"/>
                </div>
                <h3 className="text-lg font-bold text-gray-600">No products found</h3>
                <p className="text-sm max-w-xs text-center mt-2">Try adjusting your search or filters.</p>
                {(activeFilter !== ProductFilter.ALL || searchTerm) && (
                    <Button variant="neutral" className="mt-6" onClick={() => { setActiveFilter(ProductFilter.ALL); setSearchTerm(''); }}>
                        Clear all filters
                    </Button>
                )}
            </div>
        ) : isSearching ? (
             /* Search Result View (Flat Grid) */
            <div className="animate-in fade-in">
                <h3 className="text-lg font-bold text-gray-700 mb-4 px-1 flex items-center gap-2">
                    <Search size={18}/> Search Results ({groupedProducts.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {groupedProducts.map(({ key, items }) => renderProductGroup(key, items))}
                </div>
            </div>
        ) : (
             /* Categorized View */
             <div className="space-y-12 animate-in fade-in">
                {/* 1. Recently Added - Removed to avoid duplicates in category view, keeping distinct category sections */}
                
                {/* 2. Tag Groups */}
                {tags.map(t => {
                    const groupItems = groupedProducts.filter(g => g.items[0].tagId === t.id);
                    return renderGroupedSection(t.name, null, groupItems, t.color);
                })}

                {/* 3. Uncategorized */}
                {(() => {
                    const uncategorizedItems = groupedProducts.filter(g => !g.items[0].tagId);
                    return renderGroupedSection("Uncategorized", <Layers size={20} className="text-gray-400"/>, uncategorizedItems);
                })()}
             </div>
        )}
    </div>
  )};

  const renderTags = () => (
    <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800">Product Categories</h2>
            <Button onClick={() => setShowTagModal(true)} className="rounded-full px-6 py-2.5 shadow-md whitespace-nowrap flex items-center"><Plus size={18} className="mr-2"/> Create New Tag</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tags.map(t => (
                <Card 
                    key={t.id} 
                    className="flex justify-between items-center group hover:shadow-lg transition-all border border-gray-100 cursor-pointer active:scale-95 relative"
                    onClick={() => {
                        setActiveTab(SubTab.PRODUCTS);
                    }}
                >
                    <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-50 border border-gray-100">
                             <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color }}></div>
                        </div>
                        <div>
                            <div className="font-bold text-gray-800 text-lg">{t.name}</div>
                            <div className="text-xs text-gray-500 font-medium">{products.filter(p => p.tagId === t.id).length} products</div>
                        </div>
                    </div>
                    <div className="relative z-10">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log("Deleting tag:", t.name);
                                setItemToDelete({ id: t.id, type: 'tag', name: t.name });
                            }} 
                            className="text-gray-400 hover:text-red-600 p-2.5 transition-colors bg-white hover:bg-red-50 rounded-full border border-transparent hover:border-red-100"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </Card>
            ))}
        </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6 animate-in fade-in max-w-3xl mx-auto pb-20">
        <div className="flex items-center gap-3 mb-6 px-1">
            <div className="p-3 bg-gray-900 text-white rounded-xl shadow-lg shadow-gray-900/20">
                <Settings size={24} />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Store Settings</h2>
                <p className="text-gray-500">Manage your preferences and alert configurations</p>
            </div>
        </div>

        <Card className="overflow-hidden border-0 shadow-lg shadow-gray-200/50">
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Hash size={18} className="text-blue-500"/> General Preferences
                </h3>
            </div>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between group">
                    <div>
                        <label className="font-semibold text-gray-700 block mb-1">Currency Symbol</label>
                        <p className="text-sm text-gray-400">The symbol displayed next to all prices (e.g. ₹, $, €).</p>
                    </div>
                    <div className="bg-white p-1 rounded-xl border-2 border-gray-100 group-hover:border-blue-200 transition-colors">
                        <Input 
                            value={settings.currencySymbol} 
                            onChange={(e) => handleUpdateSettings({ ...settings, currencySymbol: e.target.value })} 
                            className="w-24 text-center !font-bold text-lg !bg-white !border-0 focus:!ring-0" 
                        />
                    </div>
                </div>
                <hr className="border-gray-100"/>
                <div className="flex items-center justify-between">
                    <div>
                        <label className="font-semibold text-gray-700 block mb-1">Sound Effects</label>
                        <p className="text-sm text-gray-400">Play audio feedback when actions are performed.</p>
                    </div>
                     <button 
                        onClick={() => handleUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
                        className={`w-14 h-8 rounded-full transition-all duration-300 relative shadow-inner ${settings.soundEnabled ? 'bg-blue-500' : 'bg-gray-200'}`}
                     >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${settings.soundEnabled ? 'translate-x-7' : 'translate-x-1'}`}></div>
                    </button>
                </div>
            </div>
        </Card>

        <Card className="overflow-hidden border-0 shadow-lg shadow-gray-200/50">
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Bell size={18} className="text-amber-500"/> Alert Configuration
                </h3>
                {/* Search for filtering the lists below */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1.5 text-gray-400" size={14}/>
                    <input 
                        placeholder="Search products..." 
                        className="pl-8 pr-3 py-1 text-sm bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all w-48"
                        value={settingsSearch}
                        onChange={(e) => setSettingsSearch(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="divide-y divide-gray-50">
                {/* Low Stock Section */}
                <div className="p-4 sm:p-6 hover:bg-gray-50/30 transition-colors">
                    <div className="flex gap-4 mb-6">
                        <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-1">
                            <AlertTriangle size={20} />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm sm:text-base">Low Stock Threshold (Global)</h4>
                                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                        Default limit for new products.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-1 px-2 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-200 transition-all shadow-sm shrink-0">
                                    <Input 
                                        type="number" 
                                        value={settings.lowStockDefault} 
                                        onChange={(e) => handleUpdateSettings({ ...settings, lowStockDefault: parseInt(e.target.value) || 0 })} 
                                        className="w-12 sm:w-16 text-center !font-bold !bg-transparent !border-0 !p-0 focus:!ring-0 text-gray-900" 
                                    />
                                    <span className="text-xs sm:text-sm font-medium text-gray-500 select-none">units</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Product Specific Low Stock List */}
                    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2 bg-gray-100/50 border-b border-gray-200 flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wide">
                             <span>Individual Product Thresholds</span>
                             <span>Limit</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto bg-white">
                             {products
                                .filter(p => p.name.toLowerCase().includes(settingsSearch.toLowerCase()))
                                .map(p => (
                                    <ProductSettingRow 
                                        key={p.id} 
                                        product={p} 
                                        type="stock" 
                                        onUpdate={handleInlineProductUpdate} 
                                    />
                                ))
                             }
                             {products.filter(p => p.name.toLowerCase().includes(settingsSearch.toLowerCase())).length === 0 && (
                                 <div className="p-6 text-center text-gray-400 text-sm">No products found matching "{settingsSearch}"</div>
                             )}
                        </div>
                    </div>
                </div>

                {/* Expiry Section */}
                <div className="p-4 sm:p-6 hover:bg-gray-50/30 transition-colors">
                    <div className="flex gap-4 mb-6">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-1">
                            <Clock size={20} />
                        </div>
                        <div className="flex-1">
                             <div className="flex justify-between items-start gap-4">
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm sm:text-base">Expiry Notice Period</h4>
                                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                        Days in advance to warn about expiry.
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-1 px-2 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-200 transition-all shadow-sm">
                                        <Input 
                                            type="number" 
                                            value={settings.expiryAlertDays} 
                                            onChange={(e) => handleUpdateSettings({ ...settings, expiryAlertDays: parseInt(e.target.value) || 0 })} 
                                            className="w-12 sm:w-16 text-center !font-bold !bg-transparent !border-0 !p-0 focus:!ring-0 text-gray-800" 
                                        />
                                        <span className="text-xs sm:text-sm font-medium text-gray-500 select-none">days</span>
                                    </div>
                                </div>
                            </div>
                             <div className="flex flex-wrap gap-2 mt-3">
                                {[
                                    { label: '15 Days', value: 15 },
                                    { label: '3 Months', value: 90 },
                                    { label: '6 Months', value: 180 }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleUpdateSettings({ ...settings, expiryAlertDays: opt.value })}
                                        className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded-md border transition-all ${
                                            settings.expiryAlertDays === opt.value 
                                            ? 'bg-amber-100 border-amber-300 text-amber-800 ring-1 ring-amber-300' 
                                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Product Specific Expiry List */}
                    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2 bg-gray-100/50 border-b border-gray-200 flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wide">
                             <span>Product Expiry Dates</span>
                             <span>Date</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto bg-white">
                             {products
                                .filter(p => p.name.toLowerCase().includes(settingsSearch.toLowerCase()))
                                .map(p => (
                                    <ProductSettingRow 
                                        key={p.id} 
                                        product={p} 
                                        type="expiry" 
                                        onUpdate={handleInlineProductUpdate} 
                                    />
                                ))
                             }
                             {products.filter(p => p.name.toLowerCase().includes(settingsSearch.toLowerCase())).length === 0 && (
                                 <div className="p-6 text-center text-gray-400 text-sm">No products found matching "{settingsSearch}"</div>
                             )}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    </div>
  );

  return (
    <div className="pb-32">
      {!isEditorOpen && (
        <div className="flex justify-center mb-6 sticky top-4 z-30">
            <nav className="glass-panel rounded-full px-2 py-1.5 flex items-center gap-1 shadow-md ring-1 ring-black/5">
            {[
                { id: SubTab.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
                { id: SubTab.PRODUCTS, icon: Box, label: 'Products' },
                { id: SubTab.TAGS, icon: TagIcon, label: 'Tags' },
                { id: SubTab.SETTINGS, icon: Settings, label: 'Settings' },
            ].map((tab) => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                        relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300
                        ${activeTab === tab.id 
                            ? 'bg-gray-900 text-white shadow-md' 
                            : 'text-gray-500 hover:bg-gray-100/80 hover:text-gray-900'
                        }
                        ${tab.id === SubTab.SETTINGS ? '!px-2' : ''}
                    `}
                    title={tab.label}
                >
                    <tab.icon size={18} />
                    {tab.id !== SubTab.SETTINGS && <span className="hidden sm:inline">{tab.label}</span>}
                </button>
            ))}
            </nav>
        </div>
      )}

      {isEditorOpen ? renderEditor() : (
          <main className="max-w-6xl mx-auto px-2">
            {activeTab === SubTab.DASHBOARD && renderDashboard()}
            {activeTab === SubTab.PRODUCTS && renderProducts()}
            {activeTab === SubTab.TAGS && renderTags()}
            {activeTab === SubTab.SETTINGS && renderSettings()}
          </main>
      )}

      <Modal isOpen={showTagModal} onClose={() => setShowTagModal(false)} title="Create New Tag">
          <div className="space-y-4">
              <Input placeholder="Tag Name" value={newTag.name || ''} onChange={e => setNewTag({...newTag, name: e.target.value})} />
              <div className="font-medium text-sm text-gray-600">Color</div>
              <div className="flex gap-2 flex-wrap">{TAG_COLORS.map(color => (<button key={color} onClick={() => setNewTag({...newTag, color})} className={`w-8 h-8 rounded-full cursor-pointer transition-transform active:scale-90 ${newTag.color === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`} style={{ backgroundColor: color }} />))}</div>
              <Button className="w-full mt-4" onClick={handleSaveTag}>Create Tag</Button>
          </div>
      </Modal>

      <Modal isOpen={showScanner} onClose={() => setShowScanner(false)} title="Scan Barcode">
        <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden flex flex-col items-center justify-center">
             <div id="reader" className="w-full h-full"></div>
             <p className="absolute bottom-4 text-white text-xs bg-black/50 px-2 py-1 rounded">Point camera at barcode</p>
        </div>
      </Modal>
      
      <Modal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} title={itemToDelete?.type === 'tag' ? "Delete Category" : "Confirm Delete"}>
          <div className="mb-6">
              <p className="text-gray-600 mb-2">Are you sure you want to delete <strong>{itemToDelete?.name}</strong>?</p>
              {itemToDelete?.type === 'tag' ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3 items-start">
                      <div className="mt-0.5 text-blue-500"><AlertTriangle size={16} /></div>
                      <div className="text-sm text-blue-800">
                          <span className="font-bold block">Products will NOT be deleted.</span>
                          Products in this category will be marked as "Uncategorized".
                      </div>
                  </div>
              ) : (
                  <p className="text-sm text-red-500">This action cannot be undone.</p>
              )}
          </div>
          <div className="flex gap-4 justify-end">
              <Button variant="neutral" onClick={() => setItemToDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}>Delete</Button>
          </div>
      </Modal>
    </div>
  );
};