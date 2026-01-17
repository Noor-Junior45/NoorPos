
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, Tag, StoreSettings, Sale } from '../types';
import { StoreService } from '../services/storeService';
import { GeminiService } from '../services/geminiService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Plus, Search, AlertTriangle, Scan, Tag as TagIcon, Box, Trash2, Pencil, X, ArrowLeft, Settings, Bell, Hash, MapPin, Factory, Clock, ChevronDown, Sparkles, Layers, DollarSign, Percent, FileText, Scale, ChevronUp, Loader2, Save, Eye, Camera, Check, Smartphone, FileType, ListPlus, Edit2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

enum SubTab {
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
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', 
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', 
  '#f43f5e', '#64748b', '#000000', '#9a3412', '#1e40af'
];

const ProductSettingRow: React.FC<{ 
    product: Product; 
    type: 'stock'; 
    onUpdate: (id: string, updates: Partial<Product>) => void 
}> = ({ product, type, onUpdate }) => {
    return (
        <div className="flex justify-between items-center p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
            <div className="flex-1 min-w-0 pr-4">
                <div className="font-bold text-gray-800 text-sm truncate">{product.name}</div>
                <div className="text-xs text-gray-400">Current Stock: {product.stock} {product.unit}</div>
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-100 transition-all w-24">
                <input 
                    type="number"
                    className="w-full text-center font-bold text-gray-700 outline-none text-sm bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={product.lowStockThreshold}
                    onChange={(e) => onUpdate(product.id, { lowStockThreshold: parseInt(e.target.value) || 0 })}
                />
            </div>
        </div>
    );
};

interface WarehouseProps {
  initialAction?: string;
  onClearAction?: () => void;
}

export const Warehouse: React.FC<WarehouseProps> = ({ initialAction, onClearAction }) => {
  const [activeTab, setActiveTab] = useState<SubTab>(SubTab.PRODUCTS);
  const [viewMode, setViewMode] = useState<'WAREHOUSE' | 'REVIEW'>('WAREHOUSE');
  const [products, setProducts] = useState<Product[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({
      storeName: '',
      storeAddress: '',
      storePhone: '',
      notificationsEnabled: true,
      expiryAlertDays: 7, 
      lowStockDefault: 10, 
      soundEnabled: true, 
      currencySymbol: '₹',
      recycleBinRetentionDays: 30,
      directPrintEnabled: false,
      scannerPreference: 'both'
  });
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [pendingBulkItems, setPendingBulkItems] = useState<Partial<Product>[]>([]);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ 
    name: '', sku: '', stock: 0, unit: 'pcs', capacity: '', 
    buyPrice: 0, sellPrice: 0, wholesalePrice: 0, 
    lowStockThreshold: 10, location: '', taxRate: 0,
    expiryDate: '', manufacturingDate: ''
  });
  const [batchConfig, setBatchConfig] = useState({ packs: '', perPack: '' });
  const [showTagModal, setShowTagModal] = useState(false);
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [newTag, setNewTag] = useState<Partial<Tag>>({ name: '', color: '#3b82f6' });
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'product' | 'tag' | 'bulk_products', name: string } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isScanningToAdd, setIsScanningToAdd] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [shakeTrigger, setShakeTrigger] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ProductFilter>(ProductFilter.ALL);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);
  const minSwipeDistance = 50;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isParsingInvoice, setIsParsingInvoice] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<Partial<Product>[]>([]);
  const [invoiceImage, setInvoiceImage] = useState<string | null>(null);
  const [showSourceOptions, setShowSourceOptions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Editor Refs
  const editNameRef = useRef<HTMLInputElement>(null);
  const editSkuRef = useRef<HTMLInputElement>(null);
  const editCategoryRef = useRef<HTMLSelectElement>(null);
  const editSellRef = useRef<HTMLInputElement>(null);
  const editStockRef = useRef<HTMLInputElement>(null);
  const editExpiryRef = useRef<HTMLInputElement>(null);
  const editBuyRef = useRef<HTMLInputElement>(null);
  const editWholesaleRef = useRef<HTMLInputElement>(null);
  const editTaxRef = useRef<HTMLInputElement>(null);
  const editLocationRef = useRef<HTMLInputElement>(null);
  const editUnitSizeRef = useRef<HTMLInputElement>(null);
  const editLowStockRef = useRef<HTMLInputElement>(null);
  const editMfgRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (initialAction === 'add' || initialAction === 'scan_add') {
        handleOpenAdd();
        if (onClearAction) onClearAction();
    }
  }, [initialAction]);

  const loadData = async () => {
    setLoading(true);
    const [invData, tagData, settingsData] = await Promise.all([ 
        StoreService.getInventory(), 
        StoreService.getTags(), 
        StoreService.getSettings()
    ]);
    setProducts(invData);
    setTags(tagData);
    setSettings(settingsData);
    setLoading(false);
  };
  
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    if (showScanner) {
        const timeoutId = setTimeout(() => {
            if (!document.getElementById("reader")) return;
            html5QrCode = new Html5Qrcode("reader");
            const config = { fps: 15, qrbox: { width: 300, height: 200 } };
            html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
                    if (settings.soundEnabled) { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {}); }
                    if (isScanningToAdd || isEditorOpen) {
                        setNewProduct(prev => ({ ...prev, sku: decodedText }));
                        setShowScanner(false);
                        if(isScanningToAdd) setIsEditorOpen(true);
                        setIsScanningToAdd(false);
                    } else { 
                        setSearchTerm(decodedText); 
                        setActiveTab(SubTab.PRODUCTS); 
                        setShowScanner(false);
                    }
                }, () => {}).catch(() => setShowScanner(false));
        }, 300);
        return () => { clearTimeout(timeoutId); if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().catch(console.error); } };
    }
  }, [showScanner, isEditorOpen, settings.soundEnabled, isScanningToAdd]);
  
  useEffect(() => {
      let stream: MediaStream | null = null;
      if (showCamera) {
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(s => { stream = s; if (videoRef.current) videoRef.current.srcObject = stream; })
            .catch(() => setShowCamera(false));
      }
      return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
  }, [showCamera]);

  const processImageFile = async (file: File) => { 
    setIsParsingInvoice(true); 
    try { 
      const products = await GeminiService.parseInvoice(file); 
      setParsedProducts(products); 
      setViewMode('REVIEW'); 
    } catch (err) { 
      alert("Failed to process image."); 
    } finally { 
      setIsParsingInvoice(false); 
    } 
  };

  const capturePhoto = () => {
      if (videoRef.current) {
          const video = videoRef.current;
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              setInvoiceImage(dataUrl); 
              setShowCamera(false);
              fetch(dataUrl).then(res => res.blob()).then(blob => { processImageFile(new File([blob], "capture.jpg", { type: "image/jpeg" })); });
          }
      }
  };

  const handleUpdateSettings = async (newSettings: StoreSettings) => { setSettings(newSettings); await StoreService.saveSettings(newSettings); };
  const handleInlineProductUpdate = async (id: string, updates: Partial<Product>) => { setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)); await StoreService.updateProduct(id, updates); };
  const handleBatchChange = (field: 'packs' | 'perPack', value: string) => { const newConfig = { ...batchConfig, [field]: value }; setBatchConfig(newConfig); const packs = parseFloat(newConfig.packs); const perPack = parseFloat(newConfig.perPack); if (!isNaN(packs) && !isNaN(perPack)) { setNewProduct(prev => ({ ...prev, stock: Math.floor(packs * perPack) })); } };
  const getTag = (id?: string) => tags.find(t => t.id === id);
  const getDaysUntilExpiry = (dateStr?: string) => { if (!dateStr) return Infinity; const today = new Date(); today.setHours(0,0,0,0); const exp = new Date(dateStr); return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); };
  const isAboutToExpire = (dateStr?: string) => { if (!dateStr) return false; const diffDays = getDaysUntilExpiry(dateStr); return diffDays >= 0 && diffDays <= (settings.expiryAlertDays || 7); };
  const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '-';
  
  const validateProduct = () => {
    const newErrors = new Set<string>();
    if (!newProduct.name?.trim()) newErrors.add('name');
    if (!newProduct.sellPrice || newProduct.sellPrice <= 0) newErrors.add('sellPrice');
    setValidationErrors(newErrors);
    if (newErrors.size > 0) {
        setShakeTrigger(true);
        setTimeout(() => setShakeTrigger(false), 500);
        return false;
    }
    return true;
  };

  const handleSaveProduct = async () => { 
      if (pendingBulkItems.length > 0) {
          const itemsToSave = [...pendingBulkItems];
          if (newProduct.name?.trim() || (newProduct.sellPrice && newProduct.sellPrice > 0)) {
              if (!validateProduct()) return;
              itemsToSave.push(newProduct);
          }
          await StoreService.batchAddProducts(itemsToSave);
      } else {
          if (!validateProduct()) return;
          if (isEditing && newProduct.id) await StoreService.updateProduct(newProduct.id, newProduct);
          else await StoreService.addProduct(newProduct as Product);
      }
      loadData(); setIsEditorOpen(false); setIsEditing(false); resetForm(); 
  };

  const handleSaveTag = async () => { 
      if (!newTag.name || isSavingTag) return; 
      setIsSavingTag(true);
      try {
          if (isEditingTag && newTag.id) {
             await StoreService.updateTag(newTag.id, newTag);
          } else {
             const createdTag = await StoreService.addTag(newTag as Tag); 
             if (isEditorOpen) setNewProduct(prev => ({ ...prev, tagId: createdTag.id })); 
          }
          loadData(); setShowTagModal(false); setNewTag({ name: '', color: '#3b82f6' }); setIsEditingTag(false);
      } finally { setIsSavingTag(false); }
  };
  
  const resetForm = () => { 
      setNewProduct({ name: '', sku: '', stock: 0, unit: 'pcs', capacity: '', buyPrice: 0, sellPrice: 0, wholesalePrice: 0, lowStockThreshold: settings.lowStockDefault, location: '', taxRate: 0, expiryDate: '', manufacturingDate: '' }); 
      setBatchConfig({ packs: '', perPack: '' }); setShowMoreFields(false); setValidationErrors(new Set());
  };

  const toggleGroup = (groupId: string) => { const newExpanded = new Set(expandedGroups); if (newExpanded.has(groupId)) newExpanded.delete(groupId); else newExpanded.add(groupId); setExpandedGroups(newExpanded); };
  const handleEditProduct = (p: Product) => { setNewProduct({ ...p }); setIsEditing(true); setIsEditorOpen(true); setShowMoreFields(false); };
  const handleOpenAdd = () => { resetForm(); setPendingBulkItems([]); setIsScanningToAdd(true); setShowScanner(true); };
  
  const confirmDelete = async () => { 
      if (!itemToDelete) return; 
      if (itemToDelete.type === 'product') await StoreService.deleteProduct(itemToDelete.id);
      else if (itemToDelete.type === 'tag') await StoreService.deleteTag(itemToDelete.id);
      else if (itemToDelete.type === 'bulk_products') setPendingBulkItems(prev => prev.filter((_, idx) => idx !== parseInt(itemToDelete.id)));
      setItemToDelete(null); loadData();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLElement> | null, action?: () => void) => { 
      if (e.key === 'Enter') { e.preventDefault(); if (nextRef?.current) nextRef.current.focus(); else if (action) action(); } 
  };

  const handleAnalyzeClick = () => { setShowSourceOptions(true); };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setInvoiceImage(URL.createObjectURL(file)); await processImageFile(file); };
  const handleImportParsedProducts = async () => { await StoreService.batchAddProducts(parsedProducts); setViewMode('WAREHOUSE'); loadData(); };
  
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
        if (activeFilter === ProductFilter.LOW_STOCK) return p.stock > 0 && p.stock < p.lowStockThreshold;
        if (activeFilter === ProductFilter.OUT_OF_STOCK) return p.stock === 0;
        if (activeFilter === ProductFilter.EXPIRING_SOON) return isAboutToExpire(p.expiryDate);
        return true;
    });
  }, [products, activeFilter]);

  const groupProductList = (list: Product[]) => {
      const groups: { [key: string]: Product[] } = {}; const order: string[] = [];
      list.forEach(p => { const key = `${p.name}|${p.capacity || ''}|${p.unit}`; if (!groups[key]) { groups[key] = []; order.push(key); } groups[key].push(p); });
      return order.map(key => ({ key, items: groups[key] }));
  };

  const groupedProducts = useMemo(() => groupProductList(filteredProducts), [filteredProducts]);

  const renderProductGroup = (groupKey: string, items: Product[]) => {
      const p = items[0]; const tag = getTag(p.tagId); const totalStock = items.reduce((acc, item) => acc + item.stock, 0); const borderColor = tag?.color || '#cbd5e1'; const isExpanded = expandedGroups.has(groupKey); const isLow = totalStock < p.lowStockThreshold; const anyExpiring = items.some(i => isAboutToExpire(i.expiryDate));
      const validExpiries = items.map(i => i.expiryDate).filter((d): d is string => !!d);
      let earliestExpiry: string | null = validExpiries.length > 0 ? validExpiries.sort()[0] : null;

      return (
        <Card key={groupKey} className="flex flex-col !p-0 overflow-hidden hover:shadow-xl transition-all border-2 bg-white" style={{ borderColor }}>
            <div className="p-3 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-gray-900 text-2xl leading-tight line-clamp-2">{p.name}</h4>
                    <div className="flex gap-1 shrink-0">
                         <button onClick={() => handleEditProduct(p)} className="p-2 text-gray-500 hover:text-blue-600 bg-gray-50 rounded-lg"><Pencil size={18} /></button>
                         <button onClick={() => setItemToDelete({ id: p.id, type: 'product', name: p.name })} className="p-2 text-gray-500 hover:text-red-600 bg-gray-50 rounded-lg"><Trash2 size={18} /></button>
                    </div>
                </div>
                <div className="text-xs font-mono font-bold text-gray-400">SKU: {p.sku || 'N/A'}</div>
                <div className="grid grid-cols-3 gap-2 border-b border-dashed border-gray-200 pb-2 mb-1 mt-2">
                    <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-gray-500">Buy</span><span className="font-bold text-gray-700">₹{p.buyPrice}</span></div>
                    <div className="flex flex-col border-l border-gray-200 pl-2"><span className="text-[10px] uppercase font-bold text-gray-500">Wholesale</span><span className="font-bold text-blue-600">₹{p.wholesalePrice || '-'}</span></div>
                    <div className="flex flex-col border-l border-gray-200 pl-2"><span className="text-[10px] uppercase font-bold text-gray-500">Sell</span><span className="font-extrabold text-2xl text-green-700">₹{p.sellPrice}</span></div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs font-bold">
                    <span className={`flex items-center gap-1 ${isLow ? 'text-red-600' : 'text-gray-500'}`}><Box size={14}/> Qty: {totalStock}</span>
                    <span className={`flex items-center gap-1 ${earliestExpiry && isAboutToExpire(earliestExpiry) ? 'text-amber-600' : 'text-gray-500'}`}><Clock size={14}/> {earliestExpiry ? formatDate(earliestExpiry) : 'No Exp'}</span>
                </div>
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                    <div className="flex gap-1">
                        {isLow && <div className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded">LOW</div>}
                        {anyExpiring && <div className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded">EXP</div>}
                    </div>
                    <button onClick={() => toggleGroup(groupKey)} className="text-gray-400 p-1 bg-gray-50 rounded-md">{isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</button>
                </div>
            </div>
            {isExpanded && (
                <div className="bg-gray-50 border-t border-gray-200 p-2 space-y-1">
                    {items.map(item => (
                        <div key={item.id} className="grid grid-cols-4 items-center bg-white border border-gray-200 p-2 rounded text-[10px] font-bold">
                            <div className="truncate pr-1">{formatDate(item.createdAt)}</div>
                            <div className="text-center">{item.expiryDate ? formatDate(item.expiryDate) : '-'}</div>
                            <div className="text-center text-gray-900">{item.stock}</div>
                            <div className="flex justify-end gap-1">
                                <button onClick={() => handleEditProduct(item)} className="p-1 text-blue-600"><Pencil size={12}/></button>
                                <button onClick={() => setItemToDelete({ id: item.id, type: 'product', name: `${item.name} (Batch)` })} className="p-1 text-red-600"><Trash2 size={12}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
      );
  };

  const renderEditor = () => (
    <div className={`animate-in slide-in-from-bottom-4 duration-300 pb-24 ${shakeTrigger ? 'shake-element' : ''}`}>
        <div className="flex items-center gap-4 mb-6">
            <button onClick={() => setIsEditorOpen(false)} className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm"><ArrowLeft size={20} /></button>
            <h2 className="text-2xl font-bold text-gray-800">{isEditing ? 'Edit Product' : 'Add Product'}</h2>
        </div>
        <Card className="max-w-4xl mx-auto !p-8 shadow-lg">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                    <label className="font-bold text-sm text-gray-700 flex items-center gap-2"><FileText size={16} className="text-blue-500"/> Product Name *</label>
                    <Input ref={editNameRef} onKeyDown={(e) => handleEditorKeyDown(e, editSkuRef)} value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} autoFocus={!isEditing} className={`!py-3 ${validationErrors.has('name') ? 'border-red-400 bg-red-50' : ''}`} />
                </div>
                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2"><Scan size={16}/> SKU / Barcode</label>
                    <div className="flex">
                        <Input ref={editSkuRef} onKeyDown={(e) => handleEditorKeyDown(e, editCategoryRef)} value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="rounded-r-none !py-3" />
                        <button onClick={() => setShowScanner(true)} className="px-4 bg-gray-50 border-2 border-l-0 border-gray-200 rounded-r-lg"><Scan size={20}/></button>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2"><TagIcon size={16}/> Category</label>
                    <select ref={editCategoryRef} onKeyDown={(e) => handleEditorKeyDown(e, editSellRef)} value={newProduct.tagId || ''} onChange={(e) => e.target.value === 'NEW' ? setShowTagModal(true) : setNewProduct({...newProduct, tagId: e.target.value})} className="w-full rounded-lg px-4 py-3 bg-gray-50 border-2 border-gray-200 focus:border-blue-500 outline-none">
                        <option value="">None</option>
                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        <option value="NEW">+ Create New</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2"><DollarSign size={16} className="text-green-600"/> Sell Price *</label>
                    <Input ref={editSellRef} onKeyDown={(e) => handleEditorKeyDown(e, editStockRef)} type="number" value={newProduct.sellPrice || ''} onChange={e => setNewProduct({...newProduct, sellPrice: parseFloat(e.target.value) || 0})} className={`!py-3 ${validationErrors.has('sellPrice') ? 'border-red-400 bg-red-50' : ''}`} />
                </div>
                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2"><Box size={16} className="text-purple-500"/> Stock Quantity</label>
                    <Input ref={editStockRef} onKeyDown={(e) => handleEditorKeyDown(e, editExpiryRef)} type="number" value={newProduct.stock || ''} onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})} className="!py-3" />
                </div>
                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2"><Clock size={16} className="text-amber-500"/> Expiry Date</label>
                    <Input ref={editExpiryRef} type="date" value={newProduct.expiryDate || ''} onChange={(e) => setNewProduct({...newProduct, expiryDate: e.target.value})} className="!py-3" />
                </div>
             </div>
             <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                <Button variant="neutral" onClick={() => setIsEditorOpen(false)} className="px-8">Cancel</Button>
                <Button onClick={handleSaveProduct} className="px-12 font-bold">{isEditing ? "Update Product" : "Save Product"}</Button>
             </div>
        </Card>
    </div>
  );

  return (
    <div className="pb-32 min-h-screen" onTouchStart={(e) => setTouchStart({x: e.touches[0].clientX, y: e.touches[0].clientY})} onTouchMove={(e) => setTouchEnd({x: e.touches[0].clientX, y: e.touches[0].clientY})} onTouchEnd={() => { if(!touchStart || !touchEnd) return; const dx = touchStart.x - touchEnd.x; if(Math.abs(dx) > 100) { const tabs = [SubTab.PRODUCTS, SubTab.TAGS, SubTab.SETTINGS]; const idx = tabs.indexOf(activeTab); if(dx > 0 && idx < 2) setActiveTab(tabs[idx+1]); if(dx < 0 && idx > 0) setActiveTab(tabs[idx-1]); } }}>
      {!isEditorOpen && (
        <div className="flex justify-center mb-6 sticky top-4 z-30">
            <nav className="glass-panel rounded-full px-2 py-1.5 flex gap-1 shadow-md border border-white/50">
            {[ { id: SubTab.PRODUCTS, icon: Box, label: 'Products' }, { id: SubTab.TAGS, icon: TagIcon, label: 'Tags' }, { id: SubTab.SETTINGS, icon: Settings, label: 'Settings' } ].map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${activeTab === t.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}><t.icon size={18} /><span className="hidden sm:inline">{t.label}</span></button>
            ))}
            </nav>
        </div>
      )}
      {!isEditorOpen && activeTab === SubTab.PRODUCTS && (
          <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-4">
              <button onClick={handleAnalyzeClick} className="w-12 h-12 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/60 text-indigo-700 shadow-lg flex items-center justify-center transition-all active:scale-95 hover:bg-white/80">{isParsingInvoice ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24} />}</button>
              <button onClick={handleOpenAdd} className="w-12 h-12 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/60 text-blue-700 shadow-lg flex items-center justify-center transition-all active:scale-95 hover:bg-white/80"><Plus size={28}/></button>
          </div>
      )}
      <main className="px-2">
          {isEditorOpen ? renderEditor() : (
              <>
                  {activeTab === SubTab.PRODUCTS && (
                      <div className="space-y-6">
                          <div className="max-w-2xl mx-auto flex items-center bg-white rounded-full shadow-sm border border-gray-200 h-12 px-4">
                              <Search size={20} className="text-gray-400 mr-2"/>
                              <input type="text" placeholder="Search stock..." className="w-full bg-transparent border-none focus:ring-0 text-gray-700" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                              {groupedProducts.filter(g => g.items[0].name.toLowerCase().includes(searchTerm.toLowerCase())).map(g => renderProductGroup(g.key, g.items))}
                          </div>
                      </div>
                  )}
                  {activeTab === SubTab.TAGS && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {tags.map(t => (
                              <Card key={t.id} className="flex justify-between items-center group border border-gray-100">
                                  <div className="flex items-center gap-3">
                                      <div className="w-4 h-4 rounded-full" style={{backgroundColor: t.color}}></div>
                                      <span className="font-bold text-gray-800">{t.name}</span>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => {setNewTag({...t}); setIsEditingTag(true); setShowTagModal(true);}} className="p-1.5 text-blue-600"><Pencil size={14}/></button>
                                      <button onClick={() => setItemToDelete({id: t.id, type: 'tag', name: t.name})} className="p-1.5 text-red-600"><Trash2 size={14}/></button>
                                  </div>
                              </Card>
                          ))}
                          <button onClick={() => {setIsEditingTag(false); setNewTag({name:'', color:'#3b82f6'}); setShowTagModal(true);}} className="p-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2"><Plus size={20}/> New Tag</button>
                      </div>
                  )}
                  {activeTab === SubTab.SETTINGS && (
                      <Card className="max-w-2xl mx-auto space-y-6">
                           <div className="space-y-4">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2 border-b pb-2"><Settings size={18}/> Preferences</h3>
                                <div className="flex items-center justify-between">
                                    <div><label className="font-bold text-gray-700 block">Currency Symbol</label><p className="text-xs text-gray-400">Displayed in POS and Invoices</p></div>
                                    <Input value={settings.currencySymbol} onChange={(e) => handleUpdateSettings({...settings, currencySymbol: e.target.value})} className="w-20 text-center font-black" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div><label className="font-bold text-gray-700 block">Low Stock Alert</label><p className="text-xs text-gray-400">Global default for new items</p></div>
                                    <Input type="number" value={settings.lowStockDefault} onChange={(e) => handleUpdateSettings({...settings, lowStockDefault: parseInt(e.target.value)||0})} className="w-20 text-center font-black" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div><label className="font-bold text-gray-700 block">Expiry Warning (Days)</label><p className="text-xs text-gray-400">Notice period for dashboard alerts</p></div>
                                    <Input type="number" value={settings.expiryAlertDays} onChange={(e) => handleUpdateSettings({...settings, expiryAlertDays: parseInt(e.target.value)||0})} className="w-20 text-center font-black" />
                                </div>
                           </div>
                      </Card>
                  )}
              </>
          )}
      </main>

      <Modal isOpen={showTagModal} onClose={() => setShowTagModal(false)} title={isEditingTag ? "Edit Tag" : "New Tag"}>
          <div className="space-y-4">
              <Input placeholder="Tag Name" value={newTag.name} onChange={e => setNewTag({...newTag, name: e.target.value})} autoFocus />
              <div className="grid grid-cols-5 gap-2">{TAG_COLORS.map(c => <button key={c} onClick={() => setNewTag({...newTag, color: c})} className={`w-10 h-10 rounded-full border-2 transition-all ${newTag.color === c ? 'border-gray-900 scale-110 shadow-md' : 'border-transparent'}`} style={{backgroundColor: c}}></button>)}</div>
              <Button className="w-full" onClick={handleSaveTag} disabled={isSavingTag}>{isSavingTag ? <Loader2 className="animate-spin mx-auto"/> : "Save Tag"}</Button>
          </div>
      </Modal>

      <Modal isOpen={showScanner} onClose={() => setShowScanner(false)} title="Scan Barcode"><div id="reader" className="w-full overflow-hidden rounded-xl bg-black min-h-[300px]"></div></Modal>
      
      <Modal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} title="Delete Confirmation">
          <div className="text-center py-4">
              <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
              <h3 className="text-lg font-bold text-gray-900 mb-1">Delete {itemToDelete?.name}?</h3>
              <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                  <Button variant="neutral" className="flex-1" onClick={() => setItemToDelete(null)}>Cancel</Button>
                  <Button variant="danger" className="flex-1" onClick={confirmDelete}>Delete</Button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={showSourceOptions} onClose={() => setShowSourceOptions(false)} title="Add Stock via AI">
          <div className="grid grid-cols-2 gap-4">
              <button onClick={() => {setShowCamera(true); setShowSourceOptions(false);}} className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all gap-3 text-gray-600"><Camera size={32}/><span className="font-bold text-sm">Camera</span></button>
              <button onClick={() => {fileInputRef.current?.click(); setShowSourceOptions(false);}} className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-2xl hover:border-purple-500 hover:bg-purple-50 transition-all gap-3 text-gray-600"><FileType size={32}/><span className="font-bold text-sm">Upload</span></button>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      </Modal>

      {showCamera && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col">
              <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover"></video>
              <div className="h-32 flex items-center justify-center gap-12 bg-black pb-8">
                  <button onClick={() => setShowCamera(false)} className="p-4 rounded-full bg-white/10 text-white"><X/></button>
                  <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 shadow-xl"></button>
                  <div className="w-12"></div>
              </div>
          </div>
      )}
    </div>
  );
};
