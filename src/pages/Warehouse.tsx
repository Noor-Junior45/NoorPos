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
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [newTag, setNewTag] = useState<Partial<Tag>>({ name: '', color: '#3b82f6' });
  const [isSavingTag, setIsSavingTag] = useState(false); // Add Loading State for Tag Save
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

  const handleSaveTag = async () => { 
      if (!newTag.name || isSavingTag) return; 
      setIsSavingTag(true);
      try {
          if (isEditingTag && newTag.id) {
             await StoreService.updateTag(newTag.id, newTag);
             setTags(prev => prev.map(t => t.id === newTag.id ? { ...t, ...newTag } as Tag : t));
          } else {
             const createdTag = await StoreService.addTag(newTag as Tag); 
             // If the tag existed, createdTag will be the existing one.
             setTags(prev => {
                 if (prev.find(t => t.id === createdTag.id)) return prev;
                 return [...prev, createdTag];
             }); 
             if (isEditorOpen) setNewProduct(prev => ({ ...prev, tagId: createdTag.id })); 
          }
          
          setShowTagModal(false); 
          setNewTag({ name: '', color: '#3b82f6' }); 
          setIsEditingTag(false);
      } catch (error) {
          console.error("Error saving tag:", error);
      } finally {
          setIsSavingTag(false);
      }
  };
  
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
                        ref