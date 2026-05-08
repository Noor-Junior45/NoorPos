import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, Tag, StoreSettings, Sale, Tab } from '../types';
import { StoreService } from '../services/storeService';
import { GeminiService } from '../services/geminiService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Plus, Search, AlertTriangle, Scan, Tag as TagIcon, Box, Trash2, Pencil, X, ArrowLeft, Settings, Bell, Hash, MapPin, Factory, Clock, ChevronDown, Sparkles, Layers, DollarSign, Percent, FileText, Scale, ChevronUp, Loader2, Save, Eye, Camera, Check, Smartphone, FileType, ListPlus, Edit2, Info, ShieldCheck, Truck, Cpu, ArrowDownAZ, ArrowUpZA, ArrowUpDown } from 'lucide-react';
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
  '#f43f5e', '#64748b', '#000000', '#9a3412', '#1e40af', 
  '#3730a3', '#5b21b6', '#86198f', '#9f1239', '#115e59', 
  '#166534', '#3f6212'
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
  const [settingsSearch, setSettingsSearch] = useState('');
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
  const [showTagWarning, setShowTagWarning] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'product' | 'tag' | 'bulk_products', name: string } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isScanningToAdd, setIsScanningToAdd] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [shakeTrigger, setShakeTrigger] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ProductFilter>(ProductFilter.ALL);
  const [sortOrder, setSortOrder] = useState<'none' | 'asc' | 'desc'>('none');
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
  const editBrandRef = useRef<HTMLInputElement>(null);
  const editModelRef = useRef<HTMLInputElement>(null);
  const editWarrantyRef = useRef<HTMLInputElement>(null);
  const editSupplierRef = useRef<HTMLInputElement>(null);

  // --- Browser/Gesture Back Navigation Handling ---
  useEffect(() => {
      const handleNavigationPop = (e: any) => {
          // Priority-based closing of Warehouse sub-views
          if (showCamera) {
              setShowCamera(false);
              return;
          }
          if (showScanner) {
              setShowScanner(false);
              return;
          }
          if (showTagModal) {
              setShowTagModal(false);
              return;
          }
          if (showSourceOptions) {
              setShowSourceOptions(false);
              return;
          }
          if (itemToDelete) {
              setItemToDelete(null);
              return;
          }
          if (isEditorOpen) {
              setIsEditorOpen(false);
              return;
          }
          if (viewMode === 'REVIEW') {
              setViewMode('WAREHOUSE');
              return;
          }
      };

      window.addEventListener('app-navigation-pop' as any, handleNavigationPop);
      return () => window.removeEventListener('app-navigation-pop' as any, handleNavigationPop);
  }, [isEditorOpen, showTagModal, showScanner, viewMode, itemToDelete, showSourceOptions, showCamera]);

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
                        // No need for window.history.back here as it was a modal scan
                        if(isScanningToAdd) {
                           window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, '');
                           setIsEditorOpen(true);
                        }
                        setIsScanningToAdd(false);
                    } else { 
                        setSearchTerm(decodedText); 
                        setActiveTab(SubTab.PRODUCTS); 
                        setShowScanner(false);
                        // Manual back is needed here to clear the pushed state for the scanner modal
                        window.history.back();
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
      window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, '');
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
              // Pop the camera state
              window.history.back();
              fetch(dataUrl).then(res => res.blob()).then(blob => { processImageFile(new File([blob], "capture.jpg", { type: "image/jpeg" })); });
          }
      }
  };

  const handleUpdateSettings = async (newSettings: StoreSettings) => { setSettings(newSettings); await StoreService.saveSettings(newSettings); };
  const handleInlineProductUpdate = async (id: string, updates: Partial<Product>) => { setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)); await StoreService.updateProduct(id, updates); };

  const exportToCSV = () => {
    const headers = ['ID', 'Name', 'SKU', 'Stock', 'Unit', 'Buy Price', 'Sell Price', 'Category', 'Location'];
    const rows = products.map(p => [p.id, p.name, p.sku, p.stock, p.unit, p.buyPrice, p.sellPrice, p.category || '', p.location || '']);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const importFromCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        const newItems: Partial<Product>[] = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length < 2) continue;
            const item: any = {};
            headers.forEach((h, idx) => {
                const head = h.trim().toLowerCase();
                const val = values[idx]?.trim();
                if (head === 'name') item.name = val;
                if (head === 'sku') item.sku = val;
                if (head === 'stock') item.stock = parseFloat(val) || 0;
                if (head === 'unit') item.unit = val;
                if (head === 'buy price') item.buyPrice = parseFloat(val) || 0;
                if (head === 'sell price') item.sellPrice = parseFloat(val) || 0;
            });
            if (item.name) newItems.push({ ...item, id: Math.random().toString(36).substr(2, 9) });
        }
        if (newItems.length > 0) { await StoreService.batchAddProducts(newItems as Product[]); loadData(); alert(`Imported ${newItems.length} products`); }
    };
    reader.readAsText(file);
  };
  const handleBatchChange = (field: 'packs' | 'perPack', value: string) => { const newConfig = { ...batchConfig, [field]: value }; setBatchConfig(newConfig); const packs = parseFloat(newConfig.packs); const perPack = parseFloat(newConfig.perPack); if (!isNaN(packs) && !isNaN(perPack) && packs >= 0 && perPack >= 0) { setNewProduct(prev => ({ ...prev, stock: Math.floor(packs * perPack) })); } };
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

  const handleAddToBatch = () => {
      if (!validateProduct()) return;
      setPendingBulkItems(prev => [...prev, newProduct]);
      resetForm();
      editNameRef.current?.focus();
  };

  const handleEditFromQueue = (index: number) => {
      const itemToEdit = pendingBulkItems[index];
      setPendingBulkItems(prev => prev.filter((_, i) => i !== index));
      setNewProduct(itemToEdit);
      setTimeout(() => editNameRef.current?.focus(), 100);
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
      loadData(); 
      setIsEditorOpen(false); 
      setIsEditing(false); 
      resetForm();
      // Sync browser history
      window.history.back();
  };

  const handleSaveTag = async () => { 
      if (!newTag.name || isSavingTag) return; 

      const trimmedName = newTag.name.trim();
      const lowerName = trimmedName.toLowerCase();
      const isDuplicate = tags.some(t => t.name.toLowerCase() === lowerName && t.id !== newTag.id);

      if (isDuplicate) {
          setShowTagWarning(trimmedName);
          return;
      }

      setIsSavingTag(true);
      try {
          if (isEditingTag && newTag.id) {
             await StoreService.updateTag(newTag.id, { ...newTag, name: trimmedName });
          } else {
             const createdTag = await StoreService.addTag({ ...newTag, name: trimmedName } as Tag); 
             if (isEditorOpen) setNewProduct(prev => ({ ...prev, tagId: createdTag.id })); 
          }
          loadData(); 
          setShowTagModal(false); 
          setNewTag({ name: '', color: '#3b82f6' }); 
          setIsEditingTag(false);
          window.history.back();
      } finally { setIsSavingTag(false); }
  };
  
  const resetForm = () => { 
      setNewProduct({ name: '', sku: '', stock: 0, unit: 'pcs', capacity: '', buyPrice: 0, sellPrice: 0, wholesalePrice: 0, lowStockThreshold: settings.lowStockDefault, location: '', taxRate: 0, expiryDate: '', manufacturingDate: '' }); 
      setBatchConfig({ packs: '', perPack: '' }); setValidationErrors(new Set());
  };

  const toggleGroup = (groupId: string) => { const newExpanded = new Set(expandedGroups); if (newExpanded.has(groupId)) newExpanded.delete(groupId); else newExpanded.add(groupId); setExpandedGroups(newExpanded); };
  
  const handleNameBlur = () => { if (!newProduct.name || isEditing) return; const existing = products.find(p => p.name.toLowerCase() === newProduct.name?.toLowerCase()); if (existing) { setNewProduct(prev => ({ ...prev, tagId: prev.tagId || existing.tagId, location: prev.location || existing.location, unit: existing.unit, capacity: existing.capacity, lowStockThreshold: existing.lowStockThreshold, buyPrice: prev.buyPrice || existing.buyPrice, wholesalePrice: prev.wholesalePrice || existing.wholesalePrice, sellPrice: prev.sellPrice || existing.sellPrice, taxRate: existing.taxRate, })); } };

  const handleEditProduct = (p: Product) => { 
      setNewProduct({ ...p }); 
      setBatchConfig({ packs: '', perPack: '' }); 
      setIsEditing(true); 
      window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, '');
      setIsEditorOpen(true); 
  };
  
  const handleCloneProduct = (p: Product) => { 
      setNewProduct({ ...p, id: undefined, stock: 0, expiryDate: '', manufacturingDate: '', sku: p.sku }); 
      setBatchConfig({ packs: '', perPack: '' }); 
      setIsEditing(false); 
      window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, '');
      setIsEditorOpen(true); 
  };

  const handleOpenAdd = () => { 
      resetForm(); 
      setPendingBulkItems([]); 
      setIsScanningToAdd(true); 
      window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, '');
      setShowScanner(true); 
  };
  
  const handleManualEntry = () => { 
      // Manual entry from scanner. We already pushed a state for scanner, so we keep it for the editor
      setShowScanner(false); 
      setIsScanningToAdd(false); 
      setIsEditorOpen(true); 
  };

  const confirmDelete = async () => { 
      if (!itemToDelete) return; 
      if (itemToDelete.type === 'product') await StoreService.deleteProduct(itemToDelete.id);
      else if (itemToDelete.type === 'tag') await StoreService.deleteTag(itemToDelete.id);
      else if (itemToDelete.type === 'bulk_products') setPendingBulkItems(prev => prev.filter((_, idx) => idx !== parseInt(itemToDelete.id)));
      setItemToDelete(null); 
      loadData();
      window.history.back();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLElement> | null, action?: () => void) => { 
      if (e.key === 'Enter') { e.preventDefault(); if (nextRef?.current) nextRef.current.focus(); else if (action) action(); } 
  };

  const handleAnalyzeClick = () => { 
      window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, '');
      setShowSourceOptions(true); 
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { 
      const file = e.target.files?.[0]; 
      if (!file) return; 
      setInvoiceImage(URL.createObjectURL(file)); 
      // Analysis Modal closes, but Review starts. App state depth remains 1.
      setShowSourceOptions(false);
      await processImageFile(file); 
  };
  
  const handleCloseReview = () => { 
      setViewMode('WAREHOUSE'); 
      if (invoiceImage) { URL.revokeObjectURL(invoiceImage); setInvoiceImage(null); } 
      setParsedProducts([]); 
      window.history.back();
  };

  const handleImportParsedProducts = async () => { 
      await StoreService.batchAddProducts(parsedProducts); 
      setViewMode('WAREHOUSE'); 
      loadData(); 
      window.history.back();
  };
  
  const updateParsedProduct = (index: number, field: keyof Product, value: any) => { const updated = [...parsedProducts]; updated[index] = { ...updated[index], [field]: value }; setParsedProducts(updated); };

  const removeParsedProduct = (index: number) => { const updated = parsedProducts.filter((_, i) => i !== index); setParsedProducts(updated); };

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (activeFilter === ProductFilter.LOW_STOCK) return p.stock > 0 && p.stock < p.lowStockThreshold;
        if (activeFilter === ProductFilter.OUT_OF_STOCK) return p.stock === 0;
        if (activeFilter === ProductFilter.EXPIRING_SOON) return isAboutToExpire(p.expiryDate);
        return true;
    });

    if (sortOrder === 'asc') {
        result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'desc') {
        result.sort((a, b) => b.name.localeCompare(a.name));
    }

    return result;
  }, [products, activeFilter, searchTerm, sortOrder]);

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
                         <button onClick={() => { setItemToDelete({ id: p.id, type: 'product', name: p.name }); window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, ''); }} className="p-2 text-gray-500 hover:text-red-600 bg-gray-50 rounded-lg"><Trash2 size={18} /></button>
                    </div>
                </div>
                <div className="text-xs font-mono font-bold text-gray-400">SKU: {p.sku || 'N/A'}</div>
                {(p.brand || p.model) && (
                    <div className="text-xs font-bold text-gray-500 flex items-center gap-1 mt-1">
                        {p.brand && <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{p.brand}</span>}
                        {p.model && <span className="text-gray-400">{p.model}</span>}
                    </div>
                )}
                {p.customFields && (() => {
                    try {
                        const cfs = JSON.parse(p.customFields);
                        if (cfs.length > 0) {
                            return (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {cfs.map((cf: any, idx: number) => (
                                        <span key={idx} className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                                            <span className="font-semibold opacity-70">{cf.k}:</span> <span className="font-bold">{cf.v}</span>
                                        </span>
                                    ))}
                                </div>
                            );
                        }
                    } catch(e) {}
                    return null;
                })()}
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
                    <div className="flex items-center gap-1 ml-auto">
                         <Button size="sm" variant="neutral" onClick={() => handleCloneProduct(p)} className="!px-2 !py-1 h-8" title="Add Batch"><Plus size={16}/></Button>
                         <button onClick={() => toggleGroup(groupKey)} className="text-gray-400 p-1 bg-gray-50 rounded-md">{isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</button>
                    </div>
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
                                <button onClick={() => { setItemToDelete({ id: item.id, type: 'product', name: `${item.name} (Batch)` }); window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, ''); }} className="p-1 text-red-600"><Trash2 size={12}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
      );
  };

  const renderEditor = () => {
    // Standard shared styling to match Category box (h-[52px], px-6)
    const inputBaseClass = "w-full rounded-md px-3 py-2 text-sm bg-white border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-10 transition-all placeholder-gray-400 shadow-sm";
    const errorClass = "border-red-300 focus:ring-red-500 bg-red-50";
    const amberBorderClass = "border-amber-300 focus:ring-amber-500";
    const purpleBorderClass = "border-purple-300 focus:ring-purple-500";
    const greenBorderClass = "border-green-300 focus:ring-green-500";

    let customFieldsList: {k: string, v: string}[] = [];
    try {
        customFieldsList = newProduct.customFields ? JSON.parse(newProduct.customFields) : [];
    } catch(e) {}

    const updateCustomField = (index: number, key: string, value: string) => {
        const newList = [...customFieldsList];
        newList[index] = { k: key, v: value };
        setNewProduct({...newProduct, customFields: JSON.stringify(newList)});
    };

    const addCustomField = () => {
        const newList = [...customFieldsList, { k: '', v: '' }];
        setNewProduct({...newProduct, customFields: JSON.stringify(newList)});
    };

    const removeCustomField = (index: number) => {
        const newList = customFieldsList.filter((_, i) => i !== index);
        setNewProduct({...newProduct, customFields: JSON.stringify(newList)});
    };

    return (
        <div className={`animate-in slide-in-from-bottom-4 duration-300 pb-12 ${shakeTrigger ? 'shake-element' : ''}`}>
            <div className="flex items-center justify-between mb-6 max-w-6xl mx-auto px-2">
                <div className="flex items-center gap-4">
                    <button onClick={() => { setIsEditorOpen(false); window.history.back(); }} className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"><ArrowLeft size={20} /></button>
                    <h2 className="text-2xl font-bold text-gray-800">{isEditing ? 'Edit Product' : 'Add New Product'}</h2>
                </div>
                <div className="flex gap-2">
                    <Button variant="neutral" onClick={() => { setIsEditorOpen(false); window.history.back(); }} className="hidden sm:flex font-bold bg-white border border-gray-200">Cancel</Button>
                    <Button onClick={handleSaveProduct} className="font-bold shadow-md flex items-center gap-2">
                        {isEditing ? <Save size={18}/> : <Plus size={18}/>} 
                        {isEditing ? "Update" : "Save"}
                    </Button>
                </div>
            </div>

            {pendingBulkItems.length > 0 && (
                <div className="max-w-6xl mx-auto mb-6 px-2">
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-3 bg-indigo-100/50 border-b border-indigo-200 flex justify-between items-center">
                            <h3 className="font-bold text-indigo-900 flex items-center gap-2"><ListPlus size={18}/> Bulk Queue ({pendingBulkItems.length})</h3>
                            <Button size="sm" variant="danger" onClick={() => setPendingBulkItems([])} className="text-xs h-7 px-2">Clear All</Button>
                        </div>
                        <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
                            {pendingBulkItems.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-indigo-100 shadow-sm">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-gray-800 text-sm truncate">{item.name}</div>
                                        <div className="text-[10px] text-gray-500">Stock: {item.stock} • Price: {item.sellPrice}</div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                        <button onClick={() => handleEditFromQueue(idx)} className="p-1.5 text-blue-500"><Edit2 size={16}/></button>
                                        <button onClick={() => setItemToDelete({ id: idx.toString(), type: 'bulk_products', name: item.name || 'Item' })} className="p-1.5 text-red-400"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 px-2">
                {/* Left Column - Main Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Info Card */}
                    <Card className="!p-5 shadow-sm border border-gray-200">
                        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText size={18} className="text-blue-500"/> Basic Information</h3>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className={`font-bold text-sm flex items-center gap-2 ${validationErrors.has('name') ? 'text-red-600' : 'text-gray-700'}`}>
                                    Product Name *
                                </label>
                                <input 
                                    ref={editNameRef} 
                                    onKeyDown={(e) => handleEditorKeyDown(e, editSkuRef)} 
                                    placeholder="e.g. Organic Bananas" 
                                    value={newProduct.name} 
                                    onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
                                    onBlur={handleNameBlur} 
                                    autoFocus={!isEditing} 
                                    className={`${inputBaseClass} ${validationErrors.has('name') ? errorClass : 'border-blue-200 focus:border-blue-500'}`} 
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">SKU / Barcode</label>
                                    <div className="relative group">
                                        <input 
                                            ref={editSkuRef} 
                                            onKeyDown={(e) => handleEditorKeyDown(e, editCategoryRef)} 
                                            placeholder="Scan or type" 
                                            value={newProduct.sku} 
                                            onChange={e => setNewProduct({...newProduct, sku: e.target.value})} 
                                            className={`${inputBaseClass} pr-12`} 
                                        />
                                        <button 
                                            onClick={() => { window.history.pushState({ tab: Tab.WAREHOUSE, depth: 2 }, ''); setShowScanner(true); }} 
                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                            title="Scan Barcode"
                                        >
                                            <Scan size={18}/>
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Category</label>
                                    <select 
                                        ref={editCategoryRef} 
                                        onKeyDown={(e) => handleEditorKeyDown(e, editBrandRef)} 
                                        value={newProduct.tagId || ''} 
                                        onChange={(e) => { 
                                            if (e.target.value === 'NEW_TAG_TRIGGER') {
                                                window.history.pushState({ tab: Tab.WAREHOUSE, depth: 2 }, '');
                                                setShowTagModal(true);
                                            } else {
                                                setNewProduct({...newProduct, tagId: e.target.value});
                                            }
                                        }} 
                                        className={`${inputBaseClass} cursor-pointer`}
                                    >
                                        <option value="">Select Category</option>
                                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        <option value="NEW_TAG_TRIGGER" className="font-bold text-blue-600">+ Create New</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Brand / Make</label>
                                    <input ref={editBrandRef} onKeyDown={(e) => handleEditorKeyDown(e, editModelRef)} placeholder="e.g. Samsung, Havells" value={newProduct.brand || ''} onChange={e => setNewProduct({...newProduct, brand: e.target.value})} className={inputBaseClass} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Model / Part No.</label>
                                    <input ref={editModelRef} onKeyDown={(e) => handleEditorKeyDown(e, editStockRef)} placeholder="e.g. SM-G998B" value={newProduct.model || ''} onChange={e => setNewProduct({...newProduct, model: e.target.value})} className={inputBaseClass} />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Inventory Card */}
                    <Card className="!p-5 shadow-sm border border-gray-200">
                        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2"><Box size={18} className="text-purple-500"/> Inventory & Tracking</h3>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="font-bold text-gray-700 text-sm flex items-center justify-between">
                                    <span>Stock Quantity</span>
                                </label>
                                <div className={`flex flex-col sm:flex-row gap-3`}>
                                    <div className={`flex items-center bg-white border ${purpleBorderClass} rounded-md overflow-hidden h-10 flex-1 shadow-sm`}>
                                        <button 
                                            onClick={() => setNewProduct({...newProduct, stock: Math.max(0, (newProduct.stock || 0) - 1)})}
                                            className="w-10 h-full flex items-center justify-center bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors border-r border-purple-200"
                                        >
                                            <span className="text-lg font-bold">-</span>
                                        </button>
                                        <input 
                                            ref={editStockRef} 
                                            onKeyDown={(e) => handleEditorKeyDown(e, editUnitSizeRef)} 
                                            type="number" 
                                            placeholder="0" 
                                            className="flex-1 px-3 py-1 outline-none font-bold text-center text-gray-900 h-full w-full bg-transparent text-base" 
                                            value={newProduct.stock || ''} 
                                            onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})} 
                                        />
                                        <button 
                                            onClick={() => setNewProduct({...newProduct, stock: (newProduct.stock || 0) + 1})}
                                            className="w-10 h-full flex items-center justify-center bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors border-l border-purple-200"
                                        >
                                            <span className="text-lg font-bold">+</span>
                                        </button>
                                    </div>
                                    
                                    {/* Bulk Calculator */}
                                    <div className="flex items-center gap-2 px-3 bg-purple-50 h-10 border border-purple-200 rounded-md shrink-0 shadow-sm">
                                        <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest hidden sm:inline">BULK:</span>
                                        <input 
                                            type="number" 
                                            placeholder="Box" 
                                            className="w-14 h-8 text-center border border-purple-200 rounded text-xs py-1 focus:ring-1 focus:ring-purple-400 outline-none font-bold" 
                                            value={batchConfig.packs} 
                                            onChange={(e) => handleBatchChange('packs', e.target.value)} 
                                        />
                                        <span className="text-gray-400 font-bold">×</span>
                                        <input 
                                            type="number" 
                                            placeholder="Qty" 
                                            className="w-14 h-8 text-center border border-purple-200 rounded text-xs py-1 focus:ring-1 focus:ring-purple-400 outline-none font-bold" 
                                            value={batchConfig.perPack} 
                                            onChange={(e) => handleBatchChange('perPack', e.target.value)} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Unit Size</label>
                                    <div className={`flex w-full rounded-md overflow-hidden border ${purpleBorderClass} h-10 shadow-sm`}>
                                        <input ref={editUnitSizeRef} onKeyDown={(e) => handleEditorKeyDown(e, editLocationRef)} type="text" placeholder="1" className="w-1/3 bg-transparent px-3 text-center border-r border-purple-200 font-bold outline-none" value={newProduct.capacity || ''} onChange={(e) => setNewProduct({...newProduct, capacity: e.target.value})} />
                                        <select value={newProduct.unit || 'pcs'} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} className="w-2/3 bg-transparent px-3 font-bold outline-none cursor-pointer">
                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Location</label>
                                    <input ref={editLocationRef} onKeyDown={(e) => handleEditorKeyDown(e, editLowStockRef)} placeholder="e.g. Aisle 3" value={newProduct.location} onChange={e => setNewProduct({...newProduct, location: e.target.value})} className={`${inputBaseClass} ${purpleBorderClass}`} />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Low Stock Alert</label>
                                <input ref={editLowStockRef} onKeyDown={(e) => handleEditorKeyDown(e, editSellRef)} type="number" placeholder="10" value={newProduct.lowStockThreshold || ''} onChange={e => setNewProduct({...newProduct, lowStockThreshold: parseInt(e.target.value) || 0})} className={`${inputBaseClass} ${purpleBorderClass}`} />
                            </div>
                        </div>
                    </Card>

                    {/* Custom Attributes Card */}
                    <Card className="!p-5 shadow-sm border border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2"><Layers size={18} className="text-indigo-500"/> Custom Fields</h3>
                            <Button size="sm" variant="neutral" onClick={addCustomField} className="text-xs py-1 h-8 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"><Plus size={14} className="mr-1"/> Add Field</Button>
                        </div>
                        <div className="space-y-3">
                            {customFieldsList.length === 0 && <div className="text-sm text-gray-400 italic text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">No custom fields added. Create your own boxes!</div>}
                            {customFieldsList.map((cf, idx) => (
                                <div key={idx} className="flex flex-col sm:flex-row items-center gap-2">
                                    <input placeholder="Field Name (e.g. Color)" value={cf.k} onChange={e => updateCustomField(idx, e.target.value, cf.v)} className={`${inputBaseClass} sm:w-1/3`} />
                                    <input placeholder="Value (e.g. Red)" value={cf.v} onChange={e => updateCustomField(idx, cf.k, e.target.value)} className={`${inputBaseClass} flex-1`} />
                                    <button onClick={() => removeCustomField(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"><Trash2 size={18}/></button>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Right Column - Pricing & Extra */}
                <div className="space-y-6">
                    {/* Pricing Card */}
                    <Card className="!p-5 shadow-sm border border-green-200 bg-green-50/30">
                        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2"><TagIcon size={18} className="text-green-600"/> Pricing</h3>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className={`font-bold text-sm flex items-center gap-2 ${validationErrors.has('sellPrice') ? 'text-red-600' : 'text-gray-700'}`}>
                                    Sell Price ({settings.currencySymbol}) *
                                </label>
                                <input 
                                    ref={editSellRef} 
                                    onKeyDown={(e) => handleEditorKeyDown(e, editBuyRef)} 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={newProduct.sellPrice || ''} 
                                    onChange={e => setNewProduct({...newProduct, sellPrice: parseFloat(e.target.value) || 0})} 
                                    className={`${inputBaseClass} !text-base !font-bold ${validationErrors.has('sellPrice') ? errorClass : greenBorderClass}`} 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Buy Price</label>
                                <input ref={editBuyRef} onKeyDown={(e) => handleEditorKeyDown(e, editWholesaleRef)} type="number" placeholder="0.00" value={newProduct.buyPrice || ''} onChange={e => setNewProduct({...newProduct, buyPrice: parseFloat(e.target.value) || 0})} className={`${inputBaseClass} ${greenBorderClass}`} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Wholesale Price</label>
                                <input ref={editWholesaleRef} onKeyDown={(e) => handleEditorKeyDown(e, editTaxRef)} type="number" placeholder="0.00" value={newProduct.wholesalePrice || ''} onChange={e => setNewProduct({...newProduct, wholesalePrice: parseFloat(e.target.value) || 0})} className={`${inputBaseClass} ${greenBorderClass}`} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Tax Rate (%)</label>
                                <input ref={editTaxRef} onKeyDown={(e) => handleEditorKeyDown(e, editSupplierRef)} type="number" placeholder="0" value={newProduct.taxRate || ''} onChange={e => setNewProduct({...newProduct, taxRate: parseFloat(e.target.value) || 0})} className={`${inputBaseClass} ${greenBorderClass}`} />
                            </div>
                        </div>
                    </Card>

                    {/* Additional Details Card */}
                    <Card className="!p-5 shadow-sm border border-gray-200">
                        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2"><Info size={18} className="text-amber-500"/> Extra Details</h3>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Supplier / Vendor</label>
                                <input ref={editSupplierRef} onKeyDown={(e) => handleEditorKeyDown(e, editWarrantyRef)} placeholder="e.g. ABC Distributors" value={newProduct.supplier || ''} onChange={e => setNewProduct({...newProduct, supplier: e.target.value})} className={inputBaseClass} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Warranty (Months)</label>
                                <input ref={editWarrantyRef} onKeyDown={(e) => handleEditorKeyDown(e, editMfgRef)} type="number" placeholder="12" value={newProduct.warrantyMonths || ''} onChange={e => setNewProduct({...newProduct, warrantyMonths: parseInt(e.target.value) || 0})} className={inputBaseClass} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Manufacturing Date</label>
                                <input ref={editMfgRef} onKeyDown={(e) => handleEditorKeyDown(e, editExpiryRef)} type="date" value={newProduct.manufacturingDate || ''} onChange={(e) => setNewProduct({...newProduct, manufacturingDate: e.target.value})} className={`${inputBaseClass} ${amberBorderClass}`} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-bold text-gray-700 text-sm flex items-center gap-2">Expiry Date</label>
                                <input ref={editExpiryRef} onKeyDown={(e) => handleEditorKeyDown(e, null, handleSaveProduct)} type="date" value={newProduct.expiryDate || ''} onChange={(e) => setNewProduct({...newProduct, expiryDate: e.target.value})} className={`${inputBaseClass} ${amberBorderClass}`} />
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="mt-8 max-w-6xl mx-auto flex justify-between items-center gap-4 px-2">
                <Button variant="neutral" onClick={() => { setIsEditorOpen(false); window.history.back(); }} className="py-2.5 px-6 font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm">Cancel</Button>
                <div className="flex gap-3">
                    <Button variant="neutral" onClick={handleAddToBatch} className="bg-indigo-50 text-indigo-700 py-2.5 px-6 font-bold border border-indigo-200 flex items-center gap-2 hover:bg-indigo-100 shadow-sm">
                        <ListPlus size={18}/> Queue
                    </Button>
                    <Button onClick={handleSaveProduct} className="py-2.5 px-8 font-bold shadow-sm flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                        {isEditing ? <Save size={18}/> : <Plus size={18}/>} 
                        {isEditing ? "Update Product" : "Save Product"}
                    </Button>
                </div>
            </div>
        </div>
    );
  };

  const renderProducts = () => (
      <div className="space-y-6 animate-in fade-in">
          <div className="max-w-2xl mx-auto space-y-4 px-2">
               <div className="relative flex items-center bg-white rounded-full shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 h-14 px-6 focus-within:shadow-md transition-shadow">
                    <Search size={22} className="text-gray-400 mr-3 shrink-0"/>
                    <input 
                        type="text" 
                        placeholder="Search your inventory..." 
                        className="w-full bg-transparent border-none focus:ring-0 text-gray-700 placeholder-gray-400 text-lg"
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                    <button onClick={() => { window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, ''); setShowScanner(true); }} className="text-gray-400 hover:text-blue-600 transition-colors p-1">
                        <Scan size={22} />
                    </button>
               </div>

               <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide no-scrollbar justify-start md:justify-center">
                    <button
                        onClick={() => {
                            if (sortOrder === 'none') setSortOrder('asc');
                            else if (sortOrder === 'asc') setSortOrder('desc');
                            else setSortOrder('none');
                        }}
                        className={`flex items-center gap-1 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all duration-200
                            ${sortOrder !== 'none'
                                ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' 
                                : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                            }
                        `}
                        title="Sort A-Z"
                    >
                        {sortOrder === 'none' && <ArrowUpDown size={14} />}
                        {sortOrder === 'asc' && <ArrowDownAZ size={14} />}
                        {sortOrder === 'desc' && <ArrowUpZA size={14} />}
                        Sort
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1 shrink-0"></div>
                    {[
                        { id: ProductFilter.ALL, label: 'All' },
                        { id: ProductFilter.LOW_STOCK, label: 'Low' },
                        { id: ProductFilter.OUT_OF_STOCK, label: 'Out' },
                        { id: ProductFilter.EXPIRING_SOON, label: 'Expiring' }
                    ].map(f => (
                        <button 
                            key={f.id} 
                            onClick={() => setActiveFilter(f.id)}
                            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all duration-200
                                ${activeFilter === f.id 
                                    ? 'bg-[#1f2937] text-white border-[#1f2937] shadow-sm' 
                                    : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                }
                            `}
                        >
                            {f.label}
                        </button>
                    ))}
               </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
              {groupedProducts.map(g => renderProductGroup(g.key, g.items))}
          </div>

          {groupedProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                  <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-gray-50/50">
                      <Search size={48} className="text-gray-200" strokeWidth={1.5}/>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">No products found</h3>
                  <p className="text-gray-500 mt-2 max-w-xs mx-auto">Try adjusting your search or filters.</p>
              </div>
          )}
      </div>
  );

  const renderTags = () => (
    <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto px-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Product Categories</h2>
            <Button onClick={() => { setIsEditingTag(false); setNewTag({ name: '', color: '#3b82f6' }); window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, ''); setShowTagModal(true); }} className="rounded-full px-6 py-3 shadow-md whitespace-nowrap flex items-center bg-blue-600 hover:bg-blue-700 text-white font-bold"><Plus size={20} className="mr-2"/> Create New Tag</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tags.map(t => (
                <Card key={t.id} className="flex justify-between items-center group hover:shadow-lg transition-all border border-gray-100 cursor-pointer active:scale-95 relative overflow-hidden" onClick={() => { setActiveTab(SubTab.PRODUCTS); }}>
                    <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-50 border border-gray-100 shadow-inner"><div className="w-5 h-5 rounded-full" style={{ backgroundColor: t.color }}></div></div>
                        <div><div className="font-bold text-gray-800 text-lg">{t.name}</div><div className="text-xs text-gray-500 font-medium uppercase tracking-widest">{products.filter(p => p.tagId === t.id).length} Products</div></div>
                    </div>
                    <div className="relative z-10 flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setNewTag({ ...t }); setIsEditingTag(true); window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, ''); setShowTagModal(true); }} className="text-gray-400 hover:text-blue-600 p-2 transition-colors bg-white hover:bg-blue-50 rounded-full border border-transparent hover:border-blue-100" title="Edit Category"><Pencil size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setItemToDelete({ id: t.id, type: 'tag', name: t.name }); window.history.pushState({ tab: Tab.WAREHOUSE, depth: 1 }, ''); }} className="text-gray-400 hover:text-red-600 p-2 transition-colors bg-white hover:bg-red-50 rounded-full border border-transparent hover:border-red-100" title="Delete Category"><Trash2 size={18} /></button>
                    </div>
                </Card>
            ))}
        </div>
        {tags.length === 0 && <div className="text-center py-20 text-gray-400"><TagIcon size={48} className="mx-auto mb-2 opacity-20"/><p className="text-lg font-medium">No categories found. Create one to organize your products.</p></div>}
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6 animate-in fade-in max-w-3xl mx-auto pb-20 px-2">
        <div className="flex items-center gap-3 mb-6 px-1">
            <div className="p-3 bg-gray-900 text-white rounded-xl shadow-lg shadow-gray-900/20"><Settings size={24} /></div>
            <div><h2 className="text-2xl font-bold text-gray-800">Store Settings</h2><p className="text-gray-500">Manage your preferences and alert configurations</p></div>
            <div className="ml-auto flex gap-2">
                <Button variant="neutral" size="sm" onClick={exportToCSV} className="bg-white border-gray-200"><FileText size={16} className="mr-1"/> Export CSV</Button>
                <label className="cursor-pointer">
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors">
                        <Plus size={16} /> Import CSV
                    </div>
                    <input type="file" accept=".csv" className="hidden" onChange={importFromCSV} />
                </label>
            </div>
        </div>
        <Card className="overflow-hidden border-0 shadow-lg shadow-gray-200/50">
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Hash size={18} className="text-blue-500"/> General Preferences</h3></div>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between group">
                    <div><label className="font-semibold text-gray-700 block mb-1">Currency Symbol</label><p className="text-sm text-gray-400">The symbol displayed next to all prices.</p></div>
                    <div className="bg-white p-1 rounded-xl border-2 border-gray-100 group-hover:border-blue-200 transition-colors"><Input value={settings.currencySymbol} onChange={(e) => handleUpdateSettings({ ...settings, currencySymbol: e.target.value })} className="w-24 text-center !font-bold text-lg !bg-white !border-0 focus:!ring-0" /></div>
                </div>
                <hr className="border-gray-100"/>
                <div className="flex items-center justify-between">
                    <div><label className="font-semibold text-gray-700 block mb-1">Sound Effects</label><p className="text-sm text-gray-400">Play audio feedback when actions are performed.</p></div>
                     <button onClick={() => handleUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })} className={`w-14 h-8 min-w-[3.5rem] rounded-full transition-all duration-300 relative shadow-inner shrink-0 ${settings.soundEnabled ? 'bg-blue-500' : 'bg-gray-200'}`}>
                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${settings.soundEnabled ? 'translate-x-7' : 'translate-x-1'}`}></div>
                    </button>
                </div>
            </div>
        </Card>
        <Card className="overflow-hidden border-0 shadow-lg shadow-gray-200/50">
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Bell size={18} className="text-amber-500"/> Alert Configuration</h3>
                <div className="relative"><Search className="absolute left-2.5 top-1.5 text-gray-400" size={14}/><input placeholder="Search products..." className="pl-8 pr-3 py-1 text-sm bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all w-48" value={settingsSearch} onChange={(e) => setSettingsSearch(e.target.value)} /></div>
            </div>
            <div className="divide-y divide-gray-50">
                <div className="p-4 sm:p-6 hover:bg-gray-50/30 transition-colors">
                    <div className="flex gap-4 mb-6">
                        <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-1"><AlertTriangle size={20} /></div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start gap-4">
                                <div><h4 className="font-bold text-gray-800 text-sm sm:text-base">Low Stock Threshold (Global)</h4><p className="text-xs sm:text-sm text-gray-500 mt-1">Default limit for new products.</p></div>
                                <div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-1 px-2 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-200 transition-all shadow-sm shrink-0"><Input type="number" value={settings.lowStockDefault} onChange={(e) => handleUpdateSettings({ ...settings, lowStockDefault: parseInt(e.target.value) || 0 })} className="w-12 sm:w-16 text-center !font-bold !bg-transparent !border-0 !p-0 focus:!ring-0 text-gray-900" /><span className="text-xs sm:text-sm font-medium text-gray-500 select-none">units</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2 bg-gray-100/50 border-b border-gray-200 flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-wide"><span>Individual Thresholds</span><span>Limit</span></div>
                        <div className="max-h-60 overflow-y-auto bg-white">
                             {products.filter(p => p.name.toLowerCase().includes(settingsSearch.toLowerCase())).map(p => (<ProductSettingRow key={p.id} product={p} type="stock" onUpdate={handleInlineProductUpdate} />))}
                             {products.filter(p => p.name.toLowerCase().includes(settingsSearch.toLowerCase())).length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No products found</div>}
                        </div>
                    </div>
                </div>
                <div className="p-4 sm:p-6 hover:bg-gray-50/30 transition-colors">
                    <div className="flex gap-4 mb-6">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-1"><Clock size={20} /></div>
                        <div className="flex-1">
                             <div className="flex justify-between items-start gap-4">
                                <div><h4 className="font-bold text-gray-800 text-sm sm:text-base">Expiry Notice Period</h4><p className="text-xs sm:text-sm text-gray-500 mt-1">Days in advance to warn about expiry.</p></div>
                                <div className="flex flex-col items-end gap-1 shrink-0"><div className="flex items-center gap-2 bg-white border-2 border-gray-300 rounded-lg p-1 px-2 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-200 transition-all shadow-sm"><Input type="number" value={settings.expiryAlertDays} onChange={(e) => handleUpdateSettings({ ...settings, expiryAlertDays: parseInt(e.target.value) || 0 })} className="w-12 sm:w-16 text-center !font-bold !bg-transparent !border-0 !p-0 focus:!ring-0 text-gray-800" /><span className="text-xs sm:text-sm font-medium text-gray-500 select-none">days</span></div></div>
                            </div>
                             <div className="flex flex-wrap gap-2 mt-3">
                                {[ { label: '15 Days', value: 15 }, { label: '3 Months', value: 90 }, { label: '6 Months', value: 180 } ].map(opt => (<button key={opt.value} onClick={() => handleUpdateSettings({ ...settings, expiryAlertDays: opt.value })} className={`px-2 py-1 text-[10px] sm:text-xs font-bold rounded-md border transition-all ${settings.expiryAlertDays === opt.value ? 'bg-amber-100 border-amber-300 text-amber-800 ring-1 ring-amber-300' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'}`}>{opt.label}</button>))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
        <Card className="overflow-hidden border-0 shadow-lg shadow-gray-200/50">
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Smartphone size={18} className="text-purple-500"/> Advanced & Hardware</h3></div>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div><label className="font-semibold text-gray-700 block mb-1">AI Privacy Mode</label><p className="text-sm text-gray-400">Hide sensitive product data from AI analysis.</p></div>
                    <button onClick={() => handleUpdateSettings({ ...settings, aiPrivacyEnabled: !settings.aiPrivacyEnabled })} className={`w-14 h-8 min-w-[3.5rem] rounded-full transition-all duration-300 relative shadow-inner shrink-0 ${settings.aiPrivacyEnabled ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${settings.aiPrivacyEnabled ? 'translate-x-7' : 'translate-x-1'}`}></div>
                    </button>
                </div>
                <hr className="border-gray-100"/>
                <div className="flex items-center justify-between">
                    <div><label className="font-semibold text-gray-700 block mb-1">Loyalty Program</label><p className="text-sm text-gray-400">Award points to customers on every purchase.</p></div>
                    <button onClick={() => handleUpdateSettings({ ...settings, loyaltyProgramEnabled: !settings.loyaltyProgramEnabled })} className={`w-14 h-8 min-w-[3.5rem] rounded-full transition-all duration-300 relative shadow-inner shrink-0 ${settings.loyaltyProgramEnabled ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${settings.loyaltyProgramEnabled ? 'translate-x-7' : 'translate-x-1'}`}></div>
                    </button>
                </div>
                {settings.loyaltyProgramEnabled && (
                    <div className="flex items-center justify-between bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 animate-in fade-in zoom-in-95">
                        <label className="text-xs font-bold text-emerald-800">Points per {settings.currencySymbol}100 spent:</label>
                        <Input type="number" value={settings.pointsPerCurrency || 1} onChange={(e) => handleUpdateSettings({ ...settings, pointsPerCurrency: parseInt(e.target.value) || 0 })} className="w-16 text-center !h-8 !bg-white" />
                    </div>
                )}
            </div>
        </Card>
    </div>
  );

  if (viewMode === 'REVIEW') {
      return (
          <div className="fixed inset-0 bg-white z-[60] flex flex-col animate-in slide-in-from-right duration-300">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shadow-sm shrink-0">
                  <div className="flex items-center gap-3"><button onClick={handleCloseReview} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft size={24} className="text-gray-600" /></button><div><h1 className="text-xl font-bold text-gray-900">Review Items</h1><p className="text-xs text-gray-500">{parsedProducts.length} items detected</p></div></div>
                  <Button onClick={handleImportParsedProducts} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg"><Save size={18} className="mr-2 inline"/> Import All</Button>
              </div>
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-50">
                  <div className="md:w-1/2 p-4 flex items-center justify-center bg-gray-900 relative group overflow-hidden shrink-0 h-1/3 md:h-full">{invoiceImage ? <img src={invoiceImage} className="max-w-full max-h-full object-contain" alt="Invoice" /> : <div className="text-gray-500 flex flex-col items-center"><Eye size={48} className="mb-2 opacity-50"/><span>No image preview</span></div>}</div>
                  <div className="flex-1 overflow-y-auto p-4 bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-white text-gray-500 font-bold text-xs uppercase sticky top-0 z-10 shadow-sm"><tr><th className="pb-3 pt-2 text-left pl-2">Product Name</th><th className="pb-3 pt-2 text-center w-16">Qty</th><th className="pb-3 pt-2 text-right w-20">Sell</th><th className="pb-3 pt-2 text-center w-10"></th></tr></thead>
                        <tbody className="divide-y divide-gray-100">
                            {parsedProducts.map((p, idx) => (
                                <tr key={idx} className="group hover:bg-blue-50/30 transition-colors">
                                    <td className="py-3 px-2 align-top"><input className="w-full bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none font-bold text-gray-900 py-1" value={p.name} onChange={(e) => updateParsedProduct(idx, 'name', e.target.value)} /><div className="flex gap-2 mt-2"><input className="bg-gray-100 rounded px-2 py-1 text-xs text-gray-600 w-24" value={p.category || ''} onChange={(e) => updateParsedProduct(idx, 'category', e.target.value)} /><select className="bg-gray-100 rounded px-1 py-1 text-xs text-gray-600" value={p.unit} onChange={(e) => updateParsedProduct(idx, 'unit', e.target.value)}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div></td>
                                    <td className="py-3 px-1 align-top"><input type="number" className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-1 text-center font-bold text-gray-700" value={p.stock} onChange={(e) => updateParsedProduct(idx, 'stock', parseFloat(e.target.value))} /></td>
                                    <td className="py-3 px-1 align-top"><div className="relative"><span className="absolute left-2 top-1.5 text-gray-400 text-xs">₹</span><input type="number" className="w-full pl-4 bg-transparent border-b border-transparent text-right font-bold text-green-700 py-1" value={p.sellPrice} onChange={(e) => updateParsedProduct(idx, 'sellPrice', parseFloat(e.target.value))} /></div><div className="relative mt-1"><span className="absolute left-2 top-1.5 text-gray-400 text-xs">Buy</span><input type="number" className="w-full pl-8 bg-transparent border-b border-transparent text-right text-xs text-gray-500 py-1" value={p.buyPrice} onChange={(e) => updateParsedProduct(idx, 'buyPrice', parseFloat(e.target.value))} /></div></td>
                                    <td className="py-3 pl-2 text-center align-top pt-4"><button onClick={() => removeParsedProduct(idx)} className="text-gray-300 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded"><X size={16} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="pb-32 min-h-screen" onTouchStart={(e) => setTouchStart({x: e.touches[0].clientX, y: e.touches[0].clientY})} onTouchMove={(e) => setTouchEnd({x: e.touches[0].clientX, y: e.touches[0].clientY})} onTouchEnd={() => { if(!touchStart || !touchEnd) return; const dx = touchStart.x - touchEnd.x; if(Math.abs(dx) > 100) { const tabs = [SubTab.PRODUCTS, SubTab.TAGS, SubTab.SETTINGS]; const idx = tabs.indexOf(activeTab); if(dx > 0 && idx < 2) setActiveTab(tabs[idx+1]); if(dx < 0 && idx > 0) setActiveTab(tabs[idx-1]); } }}>
      {!isEditorOpen && (
        <div className="flex justify-center mb-10 sticky top-4 z-30">
            <nav className="glass-panel rounded-full p-1.5 flex gap-1 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/50 backdrop-blur-xl">
            {[ 
                { id: SubTab.PRODUCTS, icon: Box, label: 'Products' }, 
                { id: SubTab.TAGS, icon: TagIcon, label: 'Tags' }, 
                { id: SubTab.SETTINGS, icon: Settings, label: 'Settings' } 
            ].map((t) => (
                <button 
                    key={t.id} 
                    onClick={() => setActiveTab(t.id)} 
                    className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all duration-300
                        ${activeTab === t.id 
                            ? 'bg-[#1f2937] text-white shadow-md' 
                            : 'text-gray-400 hover:text-gray-600'
                        }
                    `}
                >
                    {t.id === SubTab.SETTINGS ? <t.icon size={20} /> : <><t.icon size={18} />{t.label}</>}
                </button>
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
                  {activeTab === SubTab.PRODUCTS && renderProducts()}
                  {activeTab === SubTab.TAGS && renderTags()}
                  {activeTab === SubTab.SETTINGS && renderSettings()}
              </>
          )}
      </main>

      <Modal isOpen={showTagModal} onClose={() => { setShowTagModal(false); setIsSavingTag(false); setIsEditingTag(false); window.history.back(); }} title={isEditingTag ? "Edit Category" : "Create New Tag"}>
          <div className="space-y-4">
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Category Name</label><Input placeholder="e.g. Dairy" value={newTag.name || ''} onChange={e => setNewTag({...newTag, name: e.target.value})} autoFocus/></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase block mb-2">Color Code</label><div className="grid grid-cols-6 sm:grid-cols-8 gap-3 justify-items-center p-3 bg-gray-50 rounded-xl border border-gray-100">{TAG_COLORS.map(color => (<button key={color} onClick={() => setNewTag({...newTag, color})} className={`w-8 h-8 rounded-full shadow-sm border border-black/5`} style={{ backgroundColor: color, transform: newTag.color === color ? 'scale(1.2)' : 'scale(1)', boxShadow: newTag.color === color ? '0 0 0 2px white, 0 0 0 4px ' + color : '' }}>{newTag.color === color && <Check size={14} className="text-white mx-auto" strokeWidth={4} />}</button>))}</div></div>
              
              <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Custom Hex Code</label>
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg shadow-sm border border-gray-200 shrink-0" style={{ backgroundColor: newTag.color || '#3b82f6' }}></div>
                      <Input placeholder="#3b82f6" value={newTag.color || ''} onChange={e => { const val = e.target.value; if (val === '' || /^#[0-9A-Fa-f]{0,6}$/.test(val)) { setNewTag({...newTag, color: val}); } }} className="flex-1" />
                  </div>
              </div>

              <Button className="w-full mt-2" onClick={handleSaveTag} disabled={isSavingTag}>{isSavingTag ? <Loader2 size={18} className="animate-spin mx-auto"/> : (isEditingTag ? "Update Category" : "Save Category")}</Button>
          </div>
      </Modal>

      <Modal isOpen={!!showTagWarning} onClose={() => setShowTagWarning(null)} title="Duplicate Category">
          <div className="text-center py-4">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-sm">
                  <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Category Already Exists</h3>
              <p className="text-sm text-gray-500 mb-6 px-2 leading-relaxed">
                  The category <strong>"{showTagWarning}"</strong> has already been created. Each category name must be unique to organize your warehouse effectively.
              </p>
              <Button onClick={() => setShowTagWarning(null)} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3">I Understand</Button>
          </div>
      </Modal>

      <Modal isOpen={showScanner} onClose={() => { setShowScanner(false); window.history.back(); }} title="Scan Barcode"><div className="relative w-full bg-black rounded-lg overflow-hidden min-h-[300px]"><div id="reader" className="w-full"></div></div>{isScanningToAdd && <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center"><Button variant="neutral" onClick={handleManualEntry} className="w-full">Can't scan? Enter Manually</Button></div>}</Modal>
      
      <Modal isOpen={!!itemToDelete} onClose={() => { setItemToDelete(null); window.history.back(); }} title="Delete Confirmation">
          <div className="text-center py-4">
              <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
              <h3 className="text-lg font-bold text-gray-900 mb-1">Delete {itemToDelete?.name}?</h3>
              <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                  <Button variant="neutral" className="flex-1" onClick={() => { setItemToDelete(null); window.history.back(); }}>Cancel</Button>
                  <Button variant="danger" className="flex-1" onClick={confirmDelete}>Delete</Button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={showSourceOptions} onClose={() => { setShowSourceOptions(false); window.history.back(); }} title="Add Stock via AI">
          <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { window.history.pushState({ tab: Tab.WAREHOUSE, depth: 2 }, ''); setShowCamera(true); setShowSourceOptions(false);}} className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all gap-3 text-gray-600"><Camera size={32}/><span className="font-bold text-sm">Camera</span></button>
              <button onClick={() => {fileInputRef.current?.click(); setShowSourceOptions(false);}} className="flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-2xl hover:border-purple-500 hover:bg-purple-50 transition-all gap-3 text-gray-600"><FileType size={32}/><span className="font-bold text-sm">Upload</span></button>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
      </Modal>

      {showCamera && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col">
              <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover"></video>
              <div className="h-32 flex items-center justify-center gap-12 bg-black pb-8">
                  <button onClick={() => { setShowCamera(false); window.history.back(); }} className="p-4 rounded-full bg-white/10 text-white"><X/></button>
                  <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 shadow-xl"></button>
                  <div className="w-12"></div>
              </div>
          </div>
      )}
    </div>
  );
};
