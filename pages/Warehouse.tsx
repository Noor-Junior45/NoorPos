import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, Tag, StoreSettings, Sale } from '../types';
import { StoreService } from '../services/storeService';
import { GeminiService } from '../services/geminiService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Plus, Search, AlertTriangle, Scan, Tag as TagIcon, LayoutDashboard, Box, Calendar, Trash2, Pencil, X, Filter, CheckSquare, Square, ArrowLeft, Settings, Bell, Hash, MapPin, Factory, Clock, ChevronDown, Sparkles, Layers, DollarSign, Percent, FileText, Scale, ChevronUp, Copy, ListFilter, Calculator, ArrowRight, OctagonAlert, Book, Upload, FileUp, Loader2, Save, Eye, Camera, Image as ImageIcon, Check, Smartphone, FileType, AlignLeft, ListPlus, Edit2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
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
  '#f43f5e', '#64748b'
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
  const [sales, setSales] = useState<Sale[]>([]);
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

  // Bulk Entry State
  const [pendingBulkItems, setPendingBulkItems] = useState<Partial<Product>[]>([]);

  const [newProduct, setNewProduct] = useState<Partial<Product>>({ 
    name: '', sku: '', stock: 0, unit: 'pcs', capacity: '', 
    buyPrice: 0, sellPrice: 0, wholesalePrice: 0, 
    lowStockThreshold: 10, location: '', taxRate: 0,
    expiryDate: '', manufacturingDate: ''
  });

  const [batchConfig, setBatchConfig] = useState({ packs: '', perPack: '' });
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTag, setNewTag] = useState<Partial<Tag>>({ name: '', color: '#3b82f6' });
  const [itemToDelete, setItemToDelete] = useState<{ id: string, type: 'product' | 'tag' | 'bulk_products', name: string } | null>(null);
  
  const [showScanner, setShowScanner] = useState(false);
  const [isScanningToAdd, setIsScanningToAdd] = useState(false);

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
  // More Fields Refs
  const editBuyRef = useRef<HTMLInputElement>(null);
  const editWholesaleRef = useRef<HTMLInputElement>(null);
  const editTaxRef = useRef<HTMLInputElement>(null);
  const editLocationRef = useRef<HTMLInputElement>(null);
  const editUnitSizeRef = useRef<HTMLInputElement>(null);
  const editLowStockRef = useRef<HTMLInputElement>(null);
  const editMfgRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (initialAction === 'add') {
        handleOpenAdd();
        if (onClearAction) onClearAction();
    } else if (initialAction === 'scan_add') {
        handleOpenAdd(); 
        if (onClearAction) onClearAction();
    }
  }, [initialAction]);

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
  
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    if (showScanner) {
        const timeoutId = setTimeout(() => {
            if (!document.getElementById("reader")) return;
            html5QrCode = new Html5Qrcode("reader");
            const config = { 
                fps: 15, qrbox: { width: 300, height: 200 }, 
                experimentalFeatures: { useBarCodeDetectorIfSupported: true },
                videoConstraints: { facingMode: "environment", focusMode: "continuous" }
            };
            html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
                    if (settings.soundEnabled) { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {}); }
                    
                    if (isScanningToAdd) {
                        setNewProduct(prev => ({ ...prev, sku: decodedText }));
                        setShowScanner(false);
                        setIsEditorOpen(true);
                        setIsScanningToAdd(false);
                    } else if (isEditorOpen) { 
                        setNewProduct(prev => ({ ...prev, sku: decodedText })); 
                        setShowScanner(false);
                    } else { 
                        setSearchTerm(decodedText); 
                        setActiveTab(SubTab.PRODUCTS); 
                        setShowScanner(false);
                    }
                }, (error) => {
                    // Check for specific permission issues
                    if (error.includes("NotAllowedError") || error.includes("Permission dismissed")) {
                        console.warn("Camera permission dismissed.");
                    }
                }).catch(err => {
                    console.error("Scanner failed to start", err);
                    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                        alert("Camera access denied. Please enable camera permissions in your browser settings to scan barcodes.");
                    }
                    setShowScanner(false);
                });
        }, 300);
        return () => { clearTimeout(timeoutId); if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().then(() => html5QrCode?.clear()).catch(console.error); } };
    }
  }, [showScanner, isEditorOpen, settings.soundEnabled, isScanningToAdd]);
  
  useEffect(() => {
      let stream: MediaStream | null = null;
      if (showCamera) {
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(s => { 
                stream = s; 
                if (videoRef.current) videoRef.current.srcObject = stream; 
            })
            .catch((err) => { 
                console.error("Camera access error:", err);
                if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                    alert("Camera access denied. Please enable camera permissions in your browser settings to capture photos.");
                } else {
                    alert("Could not access camera: " + err.message);
                }
                setShowCamera(false); 
            });
      }
      return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
  }, [showCamera]);

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
  const handleBatchChange = (field: 'packs' | 'perPack', value: string) => { const newConfig = { ...batchConfig, [field]: value }; setBatchConfig(newConfig); const packs = parseFloat(newConfig.packs); const perPack = parseFloat(newConfig.perPack); if (!isNaN(packs) && !isNaN(perPack) && packs >= 0 && perPack >= 0) { setNewProduct(prev => ({ ...prev, stock: Math.floor(packs * perPack) })); } };
  const getTag = (id?: string) => tags.find(t => t.id === id);
  const getDaysUntilExpiry = (dateStr?: string) => { if (!dateStr) return Infinity; const today = new Date(); today.setHours(0,0,0,0); const exp = new Date(dateStr); exp.setHours(0,0,0,0); return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); };
  const isAboutToExpire = (dateStr?: string) => { if (!dateStr) return false; const diffDays = getDaysUntilExpiry(dateStr); return diffDays >= 0 && diffDays <= (settings.expiryAlertDays || 7); };
  const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : '-';
  
  const handleAddToBatch = () => {
      if (!newProduct.name) return;
      setPendingBulkItems(prev => [...prev, newProduct]);
      resetForm();
      editNameRef.current?.focus();
  };

  const handleEditFromQueue = (index: number) => {
      const itemToEdit = pendingBulkItems[index];
      setPendingBulkItems(prev => prev.filter((_, i) => i !== index));
      setNewProduct(itemToEdit);
      setShowMoreFields(true);
      setTimeout(() => editNameRef.current?.focus(), 100);
  };

  const handleSaveProduct = async () => { 
      if (pendingBulkItems.length > 0) {
          const itemsToSave = [...pendingBulkItems];
          if (newProduct.name) itemsToSave.push(newProduct);
          await StoreService.batchAddProducts(itemsToSave);
          loadData(); 
          setPendingBulkItems([]);
          setIsEditorOpen(false);
          setIsEditing(false);
          resetForm();
          return;
      }

      if (!newProduct.name || !newProduct.sellPrice) return; 
      
      if (isEditing && newProduct.id) {
          await StoreService.updateProduct(newProduct.id, newProduct);
      } else {
          await StoreService.addProduct(newProduct as Product);
      }
      
      loadData();
      setIsEditorOpen(false); 
      setIsEditing(false); 
      resetForm(); 
  };

  const handleSaveTag = async () => { if (!newTag.name) return; const createdTag = await StoreService.addTag(newTag as Tag); setTags(prev => [...prev, createdTag]); if (isEditorOpen) setNewProduct(prev => ({ ...prev, tagId: createdTag.id })); setShowTagModal(false); setNewTag({ name: '', color: '#3b82f6' }); };
  
  const resetForm = () => { 
      setNewProduct({ 
          name: '', sku: '', stock: 0, unit: 'pcs', capacity: '', 
          buyPrice: 0, sellPrice: 0, wholesalePrice: 0, 
          lowStockThreshold: settings.lowStockDefault, location: '', taxRate: 0, 
          expiryDate: '', manufacturingDate: '' 
      }); 
      setBatchConfig({ packs: '', perPack: '' }); 
      setShowMoreFields(false);
  };

  const toggleGroup = (groupId: string) => { const newExpanded = new Set(expandedGroups); if (newExpanded.has(groupId)) newExpanded.delete(groupId); else newExpanded.add(groupId); setExpandedGroups(newExpanded); };
  const handleNameBlur = () => { if (!newProduct.name || isEditing) return; const existing = products.find(p => p.name.toLowerCase() === newProduct.name?.toLowerCase()); if (existing) { setNewProduct(prev => ({ ...prev, tagId: prev.tagId || existing.tagId, location: prev.location || existing.location, unit: existing.unit, capacity: existing.capacity, lowStockThreshold: existing.lowStockThreshold, buyPrice: prev.buyPrice || existing.buyPrice, wholesalePrice: prev.wholesalePrice || existing.wholesalePrice, sellPrice: prev.sellPrice || existing.sellPrice, taxRate: existing.taxRate, })); } };
  const handleEditProduct = (p: Product) => { setNewProduct({ ...p }); setBatchConfig({ packs: '', perPack: '' }); setIsEditing(true); setIsEditorOpen(true); setShowMoreFields(false); };
  const handleCloneProduct = (p: Product) => { setNewProduct({ ...p, id: undefined, stock: 0, expiryDate: '', manufacturingDate: '', sku: p.sku }); setBatchConfig({ packs: '', perPack: '' }); setIsEditing(false); setIsEditorOpen(true); setShowMoreFields(false); };
  
  const handleOpenAdd = () => { 
      resetForm(); 
      setPendingBulkItems([]);
      setIsScanningToAdd(true);
      setShowScanner(true); 
  };
  
  const handleManualEntry = () => {
      setShowScanner(false);
      setIsScanningToAdd(false);
      setIsEditing(false);
      setIsEditorOpen(true);
  };

  const confirmDelete = async () => { 
      if (!itemToDelete) return; 
      if (itemToDelete.type === 'product') {
          await StoreService.deleteProduct(itemToDelete.id);
      } else if (itemToDelete.type === 'tag') {
          await StoreService.deleteTag(itemToDelete.id);
      } else if (itemToDelete.type === 'bulk_products') {
          setPendingBulkItems(prev => prev.filter((_, idx) => idx !== parseInt(itemToDelete.id)));
      }
      setItemToDelete(null); 
      loadData();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLElement> | null, action?: () => void) => { 
      if (e.key === 'Enter') { 
          e.preventDefault(); 
          if (nextRef?.current) {
              nextRef.current.focus(); 
          } else if (action) {
              action();
          }
      } 
  };

  const handleExpiryEnter = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (!showMoreFields) {
              setShowMoreFields(true);
              setTimeout(() => editBuyRef.current?.focus(), 150);
          } else {
              editBuyRef.current?.focus();
          }
      }
  };

  const handleAnalyzeClick = () => { setShowSourceOptions(true); };
  const handleUploadOption = () => { setShowSourceOptions(false); fileInputRef.current?.click(); };
  const handleCameraOption = () => { setShowSourceOptions(false); setShowCamera(true); };
  const processImageFile = async (file: File) => { setIsParsingInvoice(true); try { const products = await GeminiService.parseInvoice(file); setParsedProducts(products); setViewMode('REVIEW'); } catch (err) { console.error(err); alert("Failed to process image. Please try again."); } finally { setIsParsingInvoice(false); } };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const previewUrl = URL.createObjectURL(file); setInvoiceImage(previewUrl); await processImageFile(file); if (fileInputRef.current) fileInputRef.current.value = ''; };
  const handleCloseReview = () => { setViewMode('WAREHOUSE'); if (invoiceImage) { URL.revokeObjectURL(invoiceImage); setInvoiceImage(null); } setParsedProducts([]); };
  const handleImportParsedProducts = async () => { await StoreService.batchAddProducts(parsedProducts); handleCloseReview(); loadData(); };
  const updateParsedProduct = (index: number, field: keyof Product, value: any) => { const updated = [...parsedProducts]; updated[index] = { ...updated[index], [field]: value }; setParsedProducts(updated); };
  const removeParsedProduct = (index: number) => { const updated = parsedProducts.filter((_, i) => i !== index); setParsedProducts(updated); };
  
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
        if (activeFilter === ProductFilter.LOW_STOCK) return p.stock > 0 && p.stock < p.lowStockThreshold;
        if (activeFilter === ProductFilter.OUT_OF_STOCK) return p.stock === 0;
        if (activeFilter === ProductFilter.EXPIRING_SOON) return isAboutToExpire(p.expiryDate);
        return true;
    });
  }, [products, activeFilter, settings.expiryAlertDays]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    const matches = filteredProducts.filter(p => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
    const getMatchScore = (p: Product) => {
        const name = p.name.toLowerCase(); const sku = p.sku.toLowerCase();
        if (name === term || sku === term) return 4; if (name.startsWith(term) || sku.startsWith(term)) return 3; if (name.includes(term) || sku.includes(term)) return 2; return 1;
    };
    return matches.sort((a, b) => getMatchScore(b) - getMatchScore(a));
  }, [filteredProducts, searchTerm]);

  const groupProductList = (list: Product[]) => {
      const groups: { [key: string]: Product[] } = {}; const order: string[] = [];
      list.forEach(p => { const uniqueGroupKey = `${p.name}|${p.capacity || ''}|${p.unit}`; if (!groups[uniqueGroupKey]) { groups[uniqueGroupKey] = []; order.push(uniqueGroupKey); } groups[uniqueGroupKey].push(p); });
      return order.map(key => ({ key, items: groups[key] }));
  };

  const groupedProducts = useMemo(() => groupProductList(filteredProducts), [filteredProducts]);
  const groupedSearchResults = useMemo(() => groupProductList(searchResults), [searchResults]);

  const variantCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    groupedProducts.forEach(g => { const name = g.items[0].name; counts[name] = (counts[name] || 0) + 1; });
    return counts;
  }, [groupedProducts]);

  const getUnitBadgeStyle = (unitString: string, isMultiVariant: boolean) => {
    if (!isMultiVariant) return "bg-gray-100 text-gray-600 border-gray-200";
    const colors = ['bg-orange-100 text-orange-800 border-orange-200', 'bg-blue-100 text-blue-800 border-blue-200', 'bg-purple-100 text-purple-800 border-purple-200', 'bg-rose-100 text-rose-800 border-rose-200', 'bg-emerald-100 text-emerald-800 border-emerald-200', 'bg-indigo-100 text-indigo-800 border-indigo-200', 'bg-cyan-100 text-cyan-800 border-cyan-200'];
    let hash = 0; for (let i = 0; i < unitString.length; i++) { hash = unitString.charCodeAt(i) + ((hash << 5) - hash); }
    return colors[Math.abs(hash) % colors.length];
  };

  const onTouchStart = (e: React.TouchEvent) => { setTouchEnd(null); setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY }); };
  const onTouchMove = (e: React.TouchEvent) => { setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY }); };
  const onTouchEnd = () => {
      if (!touchStart || !touchEnd) return;
      const distanceX = touchStart.x - touchEnd.x; const distanceY = touchStart.y - touchEnd.y;
      if (Math.abs(distanceY) > Math.abs(distanceX)) return;
      const isLeftSwipe = distanceX > minSwipeDistance; const isRightSwipe = distanceX < -minSwipeDistance;
      if (isLeftSwipe || isRightSwipe) {
          const tabs = [SubTab.PRODUCTS, SubTab.TAGS, SubTab.SETTINGS];
          const currentIndex = tabs.indexOf(activeTab);
          if (isLeftSwipe && currentIndex < tabs.length - 1) { setActiveTab(tabs[currentIndex + 1]); }
          if (isRightSwipe && currentIndex > 0) { setActiveTab(tabs[currentIndex - 1]); }
      }
  };

  const renderProductGroup = (groupKey: string, items: Product[]) => {
      const p = items[0]; const tag = getTag(p.tagId); const totalStock = items.reduce((acc, item) => acc + item.stock, 0); const borderColor = tag?.color || '#cbd5e1'; const isExpanded = expandedGroups.has(groupKey); const isLow = totalStock < p.lowStockThreshold; const anyExpiring = items.some(i => isAboutToExpire(i.expiryDate));
      const unitString = `${p.capacity || '1'} ${p.unit}`; const isMultiVariant = (variantCounts[p.name] || 0) > 1; const unitBadgeClass = getUnitBadgeStyle(unitString, isMultiVariant);
      const validExpiries = items.map(i => i.expiryDate).filter((d): d is string => !!d && d !== '');
      let earliestExpiryDisplay: string | null = null; let isEarliestLow = false;
      if (validExpiries.length > 0) { validExpiries.sort(); earliestExpiryDisplay = validExpiries[0]; isEarliestLow = isAboutToExpire(earliestExpiryDisplay); }

      return (
        <Card key={groupKey} className="flex flex-col !p-0 overflow-hidden hover:shadow-xl transition-all duration-300 shadow-sm bg-white" style={{ border: `2px solid ${borderColor}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="p-3 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-gray-900 text-2xl leading-tight line-clamp-2" title={p.name}>{p.name}</h4>
                    <div className="flex gap-2 shrink-0">
                         <button onClick={() => handleEditProduct(p)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors bg-gray-50 border border-gray-100"><Pencil size={18} /></button>
                         <button onClick={() => setItemToDelete({ id: p.id, type: 'product', name: p.name })} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors bg-gray-50 border border-gray-100"><Trash2 size={18} /></button>
                    </div>
                </div>
                <div className="text-sm font-mono font-bold text-black mt-1 mb-3">SKU: {p.sku || 'N/A'}</div>
                <div className="grid grid-cols-3 gap-2 border-b border-dashed border-gray-200 pb-2 mb-1">
                    <div className="flex flex-col"><span className="text-xs uppercase font-bold text-gray-500">Buy</span><span className="font-bold text-lg text-gray-700">{settings.currencySymbol}{p.buyPrice}</span></div>
                    <div className="flex flex-col border-l border-gray-200 pl-2"><span className="text-xs uppercase font-bold text-gray-500">Wholesale</span><span className="font-bold text-lg text-blue-600">{settings.currencySymbol}{p.wholesalePrice || '-'}</span></div>
                    <div className="flex flex-col border-l border-gray-200 pl-2"><span className="text-xs uppercase font-bold text-gray-500">Sell</span><span className="font-extrabold text-3xl text-green-700 leading-none">{settings.currencySymbol}{p.sellPrice}</span></div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-gray-600 mt-2">
                    <span className="flex items-center gap-1"><MapPin size={14} className="text-gray-900"/> {p.location || 'N/A'}</span>
                    <span className="flex items-center gap-1">Unit: <span className={`px-2 py-0.5 rounded text-xs font-bold border ${unitBadgeClass}`}>{unitString}</span></span>
                    <span className="flex items-center gap-1">Tax: {p.taxRate ? `${p.taxRate}%` : 'N/A'}</span>
                    <span className={`flex items-center gap-1 ${isLow ? 'text-red-600 font-bold' : 'text-gray-500'}`}><Box size={14} className={isLow ? 'text-red-600' : 'text-gray-500'}/> Qty: {totalStock}</span>
                </div>
                 <div className="flex items-center gap-2 mt-2 text-sm"><Clock size={14} className={isEarliestLow ? "text-amber-600" : "text-gray-400"} /><span className="text-gray-500 font-medium">Expiry:</span><span className={`font-bold ${isEarliestLow ? "text-amber-700" : "text-gray-800"}`}>{earliestExpiryDisplay ? formatDate(earliestExpiryDisplay) : 'N/A'}</span></div>
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                    <div className="flex gap-2 flex-wrap">
                        {isLow && (<div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100"><AlertTriangle size={12}/> Low Stock</div>)}
                        {anyExpiring && (<div className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-100"><Clock size={12}/> Expiring</div>)}
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                         <Button size="sm" variant="neutral" onClick={() => handleCloneProduct(p)} className="!px-2 !py-1 h-8 bg-gray-100 hover:bg-gray-200 border-gray-200" title="Add Batch"><Plus size={16}/></Button>
                         <button onClick={() => toggleGroup(groupKey)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 bg-gray-50 rounded-md border border-gray-100 h-8 w-8 flex items-center justify-center">{isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</button>
                    </div>
                </div>
            </div>
            {isExpanded && (
                <div className="bg-gray-50 border-t border-gray-200 p-2 text-xs animate-in slide-in-from-top-1 duration-200">
                     <div className="grid grid-cols-4 text-gray-500 font-bold uppercase mb-2 px-1 text-[10px] tracking-wide"><span>Added</span><span className="text-center">Expiry</span><span className="text-center">Qty</span><span className="text-right">Action</span></div>
                     <div className="space-y-1">
                        {items.map(item => {
                            const expiring = isAboutToExpire(item.expiryDate);
                            return (
                                <div key={item.id} className="grid grid-cols-4 items-center bg-white border border-gray-200 p-2 rounded-md shadow-sm">
                                    <div className="text-gray-700 font-medium truncate">{new Date(item.createdAt || '').toLocaleDateString('en-GB', {day: '2-digit', month: 'short'})}</div>
                                    <div className={`text-center font-bold ${expiring ? 'text-amber-600' : 'text-gray-600'}`}>{item.expiryDate ? formatDate(item.expiryDate) : '-'}{expiring && <span className="block text-[8px] uppercase font-extrabold text-amber-600 leading-tight mt-0.5">Sell First</span>}</div>
                                    <div className="text-center font-extrabold text-gray-900 text-sm">{item.stock}</div>
                                    <div className="flex justify-end gap-1">
                                        <button onClick={() => handleEditProduct(item)} className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-100 transition-colors"><Pencil size={14}/></button>
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
        <style>{`input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } input[type=number] { -moz-appearance: textfield; }`}</style>
        
        <div className="flex items-center gap-4 mb-6">
            <button onClick={() => setIsEditorOpen(false)} className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"><ArrowLeft size={20} /></button>
            <h2 className="text-2xl font-bold text-gray-800">{isEditing ? 'Edit Product' : 'Add New Product'}</h2>
        </div>

        {/* Bulk Item Preview List */}
        {pendingBulkItems.length > 0 && (
            <div className="max-w-5xl mx-auto mb-6 px-1">
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-indigo-100/50 border-b border-indigo-200 flex justify-between items-center">
                        <h3 className="font-bold text-indigo-900 flex items-center gap-2"><ListPlus size={18}/> Bulk Queue ({pendingBulkItems.length})</h3>
                        <Button size="sm" variant="danger" onClick={() => setPendingBulkItems([])} className="text-xs h-7 px-2">Clear All</Button>
                    </div>
                    <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
                        {pendingBulkItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-indigo-100 shadow-sm animate-in slide-in-from-top-1">
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-gray-800 text-sm truncate">{item.name}</div>
                                    <div className="text-[10px] text-gray-500">Stock: {item.stock} • Price: {item.sellPrice}</div>
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                    <button onClick={() => handleEditFromQueue(idx)} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors" title="Edit Item"><Edit2 size={16}/></button>
                                    <button onClick={() => setItemToDelete({ id: idx.toString(), type: 'bulk_products', name: item.name || 'Item' })} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Item"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <Card className="max-w-5xl mx-auto !p-8 shadow-lg">
             {/* PART 1: Main Fields */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="md:col-span-2 space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <FileText size={16} className="text-blue-500"/> Product Name
                    </label>
                    <Input 
                        ref={editNameRef}
                        onKeyDown={(e) => handleEditorKeyDown(e, editSkuRef)}
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
                            ref={editSkuRef}
                            onKeyDown={(e) => handleEditorKeyDown(e, editCategoryRef)}
                            placeholder="Scan or type" 
                            value={newProduct.sku} 
                            onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                            className="w-full border-2 border-blue-200 focus:border-blue-500 bg-blue-50/10 rounded-l-lg rounded-r-none !py-3 border-r-0 !px-6"
                            autoComplete="off"
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
                        ref={editCategoryRef}
                        onKeyDown={(e) => handleEditorKeyDown(e, editSellRef)}
                        value={newProduct.tagId || ''} 
                        onChange={(e) => e.target.value === 'NEW_TAG_TRIGGER' ? setShowTagModal(true) : setNewProduct({...newProduct, tagId: e.target.value})}
                        className="w-full rounded-lg px-6 py-3 text-base bg-blue-50/10 border-2 border-blue-200 text-gray-900 focus:outline-none focus:border-blue-500/50 focus:border-blue-500 transition-all appearance-none h-[52px]"
                    >
                        <option value="">Select Category</option>
                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        <option disabled>──────────</option>
                        <option value="NEW_TAG_TRIGGER" className="font-bold text-blue-600">+ Create New</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <TagIcon size={16} className="text-green-600"/> Sell Price ({settings.currencySymbol})
                    </label>
                    <Input 
                        ref={editSellRef}
                        onKeyDown={(e) => handleEditorKeyDown(e, editStockRef)}
                        type="number" 
                        placeholder="0.00" 
                        value={newProduct.sellPrice || ''} 
                        onChange={e => setNewProduct({...newProduct, sellPrice: parseFloat(e.target.value) || 0})}
                        className="w-full border-2 border-green-200 focus:border-green-500 font-bold text-green-700 bg-green-50/10 rounded-lg !py-3 !px-6"
                    />
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Box size={16} className="text-purple-500"/> Stock Quantity
                    </label>
                    <div className="flex w-full border-2 border-purple-200 rounded-lg overflow-hidden focus-within:border-purple-500 bg-purple-50/10 transition-colors h-[52px] relative">
                        <input 
                            ref={editStockRef}
                            onKeyDown={(e) => handleEditorKeyDown(e, editExpiryRef)}
                            type="number" 
                            placeholder="0" 
                            className="flex-1 px-6 py-2 outline-none text-gray-900 font-bold placeholder-gray-400 bg-transparent h-full w-full"
                            value={newProduct.stock || ''} 
                            onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})}
                        />
                        <div className="flex items-center gap-1 bg-purple-50/80 px-2 border-l border-purple-100 h-full shrink-0">
                            <span className="text-[10px] font-bold text-purple-400 uppercase mr-1">Calc:</span>
                            <input 
                                type="number" 
                                placeholder="Box" 
                                className="w-14 text-center bg-white border border-purple-200 rounded text-xs py-1.5 focus:border-purple-500 outline-none"
                                value={batchConfig.packs}
                                onChange={(e) => handleBatchChange('packs', e.target.value)}
                            />
                            <span className="text-gray-400 font-bold text-xs">×</span>
                            <input 
                                type="number" 
                                placeholder="Qty" 
                                className="w-14 text-center bg-white border border-purple-200 rounded text-xs py-1.5 focus:border-purple-500 outline-none"
                                value={batchConfig.perPack}
                                onChange={(e) => handleBatchChange('perPack', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Clock size={16} className="text-amber-500"/> Expiry Date
                    </label>
                    <Input 
                        ref={editExpiryRef}
                        onKeyDown={handleExpiryEnter}
                        type="date" 
                        value={newProduct.expiryDate || ''} 
                        onChange={(e) => setNewProduct({...newProduct, expiryDate: e.target.value})}
                        className="w-full border-2 border-amber-200 focus:border-amber-500 bg-amber-50/10 rounded-lg !py-3 !px-6"
                    />
                </div>
             </div>

             {/* Expand/Collapse Toggle */}
             <div className="mt-8 border-t border-gray-100 pt-4 flex justify-center">
                 <button 
                    onClick={() => setShowMoreFields(!showMoreFields)}
                    className="flex items-center gap-2 text-blue-600 font-bold text-sm bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors"
                 >
                    {showMoreFields ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    {showMoreFields ? 'Hide Details' : 'Fill More Fields (Cost, Tax, Location...)'}
                 </button>
             </div>

             {/* PART 2: Secondary Fields (Collapsible) */}
             {showMoreFields && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-6 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="space-y-2">
                        <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                            <Factory size={16} className="text-green-600"/> Buy Price ({settings.currencySymbol})
                        </label>
                        <Input 
                            ref={editBuyRef}
                            onKeyDown={(e) => handleEditorKeyDown(e, editWholesaleRef)}
                            type="number" 
                            placeholder="0.00" 
                            value={newProduct.buyPrice || ''} 
                            onChange={e => setNewProduct({...newProduct, buyPrice: parseFloat(e.target.value) || 0})}
                            className="w-full border-2 border-green-200 focus:border-green-500 bg-green-50/10 rounded-lg !py-3 !px-6"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="font-bold text-gray-700 text-sm flex items-center gap-2">
                            <Box size={16} className="text-green-600"/> Wholesale Price ({settings.currencySymbol})
                        </label>
                        <Input 
                            ref={editWholesaleRef}
                            onKeyDown={(e) => handleEditorKeyDown(e, editTaxRef)}
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
                            ref={editTaxRef}
                            onKeyDown={(e) => handleEditorKeyDown(e, editLocationRef)}
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
                            ref={editLocationRef}
                            onKeyDown={(e) => handleEditorKeyDown(e, editUnitSizeRef)}
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
                        <div className="flex w-full shadow-sm rounded-lg overflow-hidden border-2 border-purple-200 focus-within:border-purple-500 transition-all bg-purple-50/10 h-[52px]">
                            <input 
                                ref={editUnitSizeRef}
                                onKeyDown={(e) => handleEditorKeyDown(e, editLowStockRef)}
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
                            <AlertTriangle size={16} className="text-purple-500"/> Low Stock Alert
                        </label>
                        <Input 
                            ref={editLowStockRef}
                            onKeyDown={(e) => handleEditorKeyDown(e, editMfgRef)}
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
                            ref={editMfgRef}
                            onKeyDown={(e) => handleEditorKeyDown(e, null, handleSaveProduct)}
                            type="date" 
                            value={newProduct.manufacturingDate || ''} 
                            onChange={(e) => setNewProduct({...newProduct, manufacturingDate: e.target.value})}
                            className="w-full border-2 border-amber-200 focus:border-amber-500 bg-amber-50/10 rounded-lg !py-3 !px-6"
                        />
                    </div>
                 </div>
             )}

             {/* Action Bar - Equal Widths and Side-by-Side on all screens */}
             <div className="grid grid-cols-3 gap-2 mt-8 pt-6 border-t border-gray-100">
                <Button variant="neutral" onClick={() => setIsEditorOpen(false)} className="w-full py-4 font-bold rounded-xl flex items-center justify-center px-1">
                    <span className="truncate">Cancel</span>
                </Button>
                
                <Button variant="neutral" onClick={handleAddToBatch} className="w-full py-4 font-bold rounded-xl bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100 flex items-center justify-center gap-1 px-1">
                    <ListPlus size={18} strokeWidth={2.5} className="shrink-0" />
                    <span className="truncate">Queue</span>
                </Button>

                <Button onClick={handleSaveProduct} className="w-full py-4 font-bold rounded-xl shadow-lg flex items-center justify-center gap-1 px-1">
                    {isEditing ? <Save size={18} className="shrink-0"/> : (pendingBulkItems.length > 0 ? <Check size={18} strokeWidth={3} className="shrink-0"/> : <Plus size={18} strokeWidth={3} className="shrink-0"/>)}
                    <span className="truncate">{isEditing ? "Update" : (pendingBulkItems.length > 0 ? "All" : "Save")}</span>
                </Button>
             </div>
        </Card>
    </div>
  );

  const renderProducts = () => {
    const isSearching = searchTerm.trim().length > 0;

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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {items.map(({ key, items }) => renderProductGroup(key, items))}
                </div>
            </section>
        );
    };

    return (
    <div className="space-y-6 animate-in fade-in pb-24 relative">
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*,application/pdf"
        />

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
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="p-2 mr-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                            title="Clear search"
                        >
                            <X size={20} />
                        </button>
                    )}
                    {(settings.scannerPreference === 'phone' || settings.scannerPreference === 'both') && (
                        <button 
                            onClick={() => setShowScanner(true)}
                            className="pr-6 pl-2 text-gray-400 hover:text-blue-600 transition-colors tooltip"
                            title="Scan Barcode"
                        >
                            <Scan size={22} />
                        </button>
                    )}
                </div>
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
            </div>
        </div>

        {isSearching && groupedSearchResults.length > 0 && (
             <div className="animate-in fade-in slide-in-from-top-4 duration-300 mb-8 p-6 bg-blue-50/50 border border-blue-100 rounded-2xl shadow-sm">
                <h3 className="text-sm font-bold text-blue-600 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <Search size={16} /> Top Match
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {groupedSearchResults.map(({ key, items }) => renderProductGroup(key, items))}
                </div>
            </div>
        )}
        
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
        ) : (
             <div className="space-y-12 animate-in fade-in transition-all duration-300">
                {tags.map(t => {
                    const groupItems = groupedProducts.filter(g => g.items[0].tagId === t.id);
                    return renderGroupedSection(t.name, null, groupItems, t.color);
                })}

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
        {tags.length === 0 && (
            <div className="text-center py-20 text-gray-400">
                <TagIcon size={48} className="mx-auto mb-2 opacity-20"/>
                <p>No categories found. Create one to organize your products.</p>
            </div>
        )}
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
                </div>
            </div>
        </Card>
    </div>
  );

  if (viewMode === 'REVIEW') {
      return (
          <div className="fixed inset-0 bg-white z-[60] flex flex-col animate-in slide-in-from-right duration-300">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shadow-sm shrink-0">
                  <div className="flex items-center gap-3">
                      <button onClick={handleCloseReview} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                          <ArrowLeft size={24} className="text-gray-600" />
                      </button>
                      <div>
                          <h1 className="text-xl font-bold text-gray-900">Review Items</h1>
                          <p className="text-xs text-gray-500">{parsedProducts.length} items detected</p>
                      </div>
                  </div>
                  <Button onClick={handleImportParsedProducts} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg">
                      <Save size={18} className="mr-2 inline"/> Import All
                  </Button>
              </div>

              <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-50">
                  <div className="md:w-1/2 p-4 flex items-center justify-center bg-gray-900 relative group overflow-hidden shrink-0 h-1/3 md:h-full">
                        {invoiceImage ? (
                            <img src={invoiceImage} className="max-w-full max-h-full object-contain" alt="Invoice Preview" />
                        ) : (
                            <div className="text-gray-500 flex flex-col items-center">
                                <Eye size={48} className="mb-2 opacity-50"/>
                                <span>No image preview</span>
                            </div>
                        )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-white text-gray-500 font-bold text-xs uppercase sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="pb-3 pt-2 text-left pl-2">Product Name</th>
                                <th className="pb-3 pt-2 text-center w-16">Qty</th>
                                <th className="pb-3 pt-2 text-right w-20">Sell</th>
                                <th className="pb-3 pt-2 text-center w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {parsedProducts.map((p, idx) => (
                                <tr key={idx} className="group hover:bg-blue-50/30 transition-colors">
                                    <td className="py-3 px-2 align-top">
                                        <input 
                                            className="w-full bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none font-bold text-gray-900 py-1 transition-colors"
                                            value={p.name}
                                            onChange={(e) => updateParsedProduct(idx, 'name', e.target.value)}
                                            placeholder="Product Name"
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <input 
                                                className="bg-gray-100 rounded px-2 py-1 text-xs text-gray-600 focus:bg-white focus:ring-1 focus:ring-blue-200 w-24 outline-none"
                                                value={p.category || ''}
                                                placeholder="Category"
                                                onChange={(e) => updateParsedProduct(idx, 'category', e.target.value)}
                                            />
                                            <select 
                                                className="bg-gray-100 rounded px-1 py-1 text-xs text-gray-600 focus:bg-white focus:ring-1 focus:ring-blue-200 outline-none"
                                                value={p.unit}
                                                onChange={(e) => updateParsedProduct(idx, 'unit', e.target.value)}
                                            >
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </td>
                                    <td className="py-3 px-1 align-top">
                                        <input 
                                            type="number"
                                            className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-1 text-center font-bold text-gray-700 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                            value={p.stock}
                                            onChange={(e) => updateParsedProduct(idx, 'stock', parseFloat(e.target.value))}
                                        />
                                    </td>
                                    <td className="py-3 px-1 align-top">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1.5 text-gray-400 text-xs">₹</span>
                                            <input 
                                                type="number"
                                                className="w-full pl-4 bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none text-right font-bold text-green-700 py-1"
                                                value={p.sellPrice}
                                                onChange={(e) => updateParsedProduct(idx, 'sellPrice', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="relative mt-1">
                                            <span className="absolute left-2 top-1.5 text-gray-400 text-xs">Buy</span>
                                            <input 
                                                type="number"
                                                className="w-full pl-8 bg-transparent border-b border-transparent focus:border-gray-400 focus:outline-none text-right text-xs text-gray-500 py-1"
                                                value={p.buyPrice}
                                                onChange={(e) => updateParsedProduct(idx, 'buyPrice', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </td>
                                    <td className="py-3 pl-2 text-center align-top pt-4">
                                        <button onClick={() => removeParsedProduct(idx)} className="text-gray-300 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded">
                                            <X size={16} />
                                        </button>
                                    </td>
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
    <div 
        className="pb-32 min-h-[80vh]" 
        onTouchStart={onTouchStart} 
        onTouchMove={onTouchMove} 
        onTouchEnd={onTouchEnd}
    >
      <style>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } 
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
      
      {!isEditorOpen && (
        <div className="flex justify-center mb-6 sticky top-4 z-30">
            <nav className="glass-panel rounded-full px-2 py-1.5 flex items-center gap-1 shadow-md ring-1 ring-black/5">
            {[
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
                        ${tab.id !== SubTab.SETTINGS ? 'px-4' : 'px-2'}
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

      {/* Floating Action Buttons */}
      {!isEditorOpen && activeTab === SubTab.PRODUCTS && (
          <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-4">
              <button
                  onClick={handleAnalyzeClick}
                  disabled={isParsingInvoice}
                  className="w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/60 text-indigo-700 shadow-lg shadow-indigo-500/10 flex items-center justify-center transition-all active:scale-95 hover:bg-white/60"
                  title="Analyze Image"
              >
                  {isParsingInvoice ? <Loader2 size={20} className="animate-spin text-indigo-600"/> : <Sparkles size={20} />}
              </button>

              <button
                  onClick={handleOpenAdd}
                  className="w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/60 text-blue-700 shadow-lg shadow-blue-500/10 flex items-center justify-center transition-all active:scale-95 hover:bg-white/60"
                  title="Add Product"
              >
                  <Plus size={24}/>
              </button>
          </div>
      )}

      {isEditorOpen ? renderEditor() : (
          <main className="w-full mx-auto px-2">
            {activeTab === SubTab.PRODUCTS && renderProducts()}
            {activeTab === SubTab.TAGS && renderTags()}
            {activeTab === SubTab.SETTINGS && renderSettings()}
          </main>
      )}

      {/* Modals */}
      <Modal isOpen={showTagModal} onClose={() => setShowTagModal(false)} title="Create New Tag">
          <div className="space-y-4">
              <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Category Name</label>
                  <Input placeholder="e.g. Dairy, Electronics" value={newTag.name || ''} onChange={e => setNewTag({...newTag, name: e.target.value})} className="!bg-gray-50 !border-gray-200"/>
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Color Code</label>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-3 justify-items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    {TAG_COLORS.map(color => (
                        <button 
                            key={color} 
                            onClick={() => setNewTag({...newTag, color})} 
                            className={`
                                w-8 h-8 rounded-full transition-transform duration-200 hover:scale-110 active:scale-95 flex items-center justify-center shadow-sm border border-black/5
                            `}
                            style={{ 
                                backgroundColor: color,
                                transform: newTag.color === color ? 'scale(1.2)' : 'scale(1)',
                                boxShadow: newTag.color === color ? '0 0 0 2px white, 0 0 0 4px ' + color : '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                        >
                            {newTag.color === color && (
                                <Check size={14} className="text-white drop-shadow-md" strokeWidth={4} />
                            )}
                        </button>
                    ))}
                </div>
              </div>

              <Button className="w-full mt-2" onClick={handleSaveTag}>Save Category</Button>
          </div>
      </Modal>

      <Modal isOpen={showScanner} onClose={() => setShowScanner(false)} title="Scan Barcode" className="!bg-[#fdfdfc]">
        <div className="relative w-full bg-black rounded-lg overflow-hidden flex flex-col items-center justify-center min-h-[300px]">
             <div id="reader" className="w-full"></div>
             <p className="absolute bottom-4 text-white text-xs bg-black/50 px-2 py-1 rounded z-10">Point camera at barcode</p>
        </div>
        
        {isScanningToAdd && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center">
                <Button 
                    variant="neutral" 
                    onClick={handleManualEntry}
                    className="w-full"
                >
                    Can't scan? Enter Manually
                </Button>
            </div>
        )}
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

      {/* Source Selection Modal */}
      <Modal isOpen={showSourceOptions} onClose={() => setShowSourceOptions(false)} title="Analyze Image" className="!max-w-xs">
          <div className="space-y-3">
              <p className="text-gray-500 text-sm mb-4">Choose how you want to add items.</p>
              <button 
                onClick={handleCameraOption} 
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-200"><Camera size={24}/></div>
                  <div className="text-left">
                      <span className="font-bold text-gray-900 block">Take Photo</span>
                      <span className="text-xs text-gray-500">Capture invoices or items</span>
                  </div>
              </button>
              <button 
                onClick={handleUploadOption} 
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                  <div className="p-3 rounded-full bg-purple-100 text-purple-600 group-hover:bg-purple-200"><FileType size={24}/></div>
                  <div className="text-left">
                      <span className="font-bold text-gray-900 block">Upload File</span>
                      <span className="text-xs text-gray-500">Image or PDF Invoice</span>
                  </div>
              </button>
          </div>
      </Modal>

      {/* Camera Full Screen Overlay */}
      {showCamera && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col">
              <div className="relative flex-1 bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                  <div className="absolute inset-0 border-2 border-white/20 m-8 rounded-lg pointer-events-none">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
                  </div>
              </div>
              <div className="h-32 bg-black flex items-center justify-around px-8 pb-8 pt-4">
                  <button onClick={() => setShowCamera(false)} className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20">
                      <X size={24}/>
                  </button>
                  <button onClick={capturePhoto} className="w-20 h-20 bg-transparent border-4 border-white rounded-full p-1 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all">
                      <div className="w-full h-full bg-white rounded-full"></div>
                  </button>
                  <div className="w-14"></div>
              </div>
          </div>
      )}
    </div>
  );
};
