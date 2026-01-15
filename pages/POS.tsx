import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, CartItem, Customer, Sale, Tag, StoreSettings } from '../types';
import { StoreService } from '../services/storeService';
import { generateInvoicePDF } from '../services/pdfService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Search, ShoppingCart, Trash2, User, CreditCard, Printer, Scan, Plus, X, Clock, ChevronDown, CircleCheck, Package, History, MoreVertical, FileText, RotateCcw, ArrowLeft, Save, CircleAlert, MapPin, Mail, Phone, ChevronRight, Calculator, Factory, Layers, Scale, AlertTriangle, Box, Tag as TagIcon, Percent, CheckSquare, Square, LayoutGrid, List as ListIcon, Receipt, Banknote, Smartphone, Share2, Pencil, Edit3, CheckCircle, UserPlus, Info } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

// Extended interface for local POS state to handle discounts and custom pricing
interface POSCartItem extends CartItem {
  discount: number; // Cash discount per row
  customPrice?: number; // Overridden price
}

const UNITS = [
  'pcs', 'kg', 'g', 'l', 'ml', 'pack', 'box', 'dozen', 'm', 'cm', 
  'mg', 'tablet', 'strip', 'capsule', 'syrup', 'vial', 'ampoule', 'kit'
];

type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Pay Later';

// Simple WhatsApp Logo Component
const WhatsAppLogo = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="mr-2">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

export const POS: React.FC = () => {
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
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
  
  // Cart & Transaction State
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [partialPaidAmount, setPartialPaidAmount] = useState<string>(''); // String to handle empty input
  
  // Quick Customer (Inside Payment Popup)
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [showCheckoutWarning, setShowCheckoutWarning] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  // UI State
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isNewCustomerMode, setIsNewCustomerMode] = useState(false);

  // New Customer Form (Main UI)
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');

  const [inlineSearch, setInlineSearch] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [viewMode, setViewMode] = useState<'POS' | 'HISTORY'>('POS');
  const [showProductLookup, setShowProductLookup] = useState(false);

  // Product Creation State (Internal to POS)
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ 
    name: '', sku: '', stock: 0, unit: 'pcs', capacity: '', 
    buyPrice: 0, sellPrice: 0, wholesalePrice: 0, 
    lowStockThreshold: 10, location: '', taxRate: 0,
    expiryDate: '', manufacturingDate: ''
  });
  const [batchConfig, setBatchConfig] = useState({ packs: '', perPack: '' });

  // History State
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuesError, setShowDuesError] = useState(false); 
  const [historyLayout, setHistoryLayout] = useState<'list' | 'grid'>('list');
  const [saleDetail, setSaleDetail] = useState<Sale | null>(null); 
  
  // Edit Sale State
  const [isEditingSale, setIsEditingSale] = useState(false);
  const [editingSaleData, setEditingSaleData] = useState<Sale | null>(null);
  const [showEditWarning, setShowEditWarning] = useState(false);

  // Refs
  const customerSearchInputRef = useRef<HTMLInputElement>(null);
  const custNameRef = useRef<HTMLInputElement>(null);
  const custPhoneRef = useRef<HTMLInputElement>(null);
  const custEmailRef = useRef<HTMLInputElement>(null);
  const custAddrRef = useRef<HTMLInputElement>(null);
  const inlineSearchRef = useRef<HTMLInputElement>(null);

  // Refs for New Product Form
  const prodNameRef = useRef<HTMLInputElement>(null);
  const prodSkuRef = useRef<HTMLInputElement>(null);
  const prodSellRef = useRef<HTMLInputElement>(null);
  const prodBuyRef = useRef<HTMLInputElement>(null);
  const prodStockRef = useRef<HTMLInputElement>(null);
  const prodCatRef = useRef<HTMLSelectElement>(null);

  // Quick Reg Refs
  const quickNameRef = useRef<HTMLInputElement>(null);

  // Long Press Hook Logic
  const longPressTimerRef = useRef<any>(null);
  const handleTouchStart = (id: string) => {
      longPressTimerRef.current = setTimeout(() => {
          if (!isSelectionMode) {
              setIsSelectionMode(true);
              toggleSaleSelection(id);
              if (settings.soundEnabled && navigator.vibrate) navigator.vibrate(50);
          }
      }, 600); // 600ms long press
  };
  const handleTouchEnd = () => {
      if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
      }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openHistory = () => {
    setViewMode('HISTORY');
    loadData(); // Refresh sales
  };

  const closeHistory = () => {
    setViewMode('POS');
    setIsSelectionMode(false);
    setSelectedSales(new Set());
  };

  const loadData = async () => {
    const [p, c, s, t, st] = await Promise.all([
        StoreService.getInventory(),
        StoreService.getCustomers(),
        StoreService.getSales(),
        StoreService.getTags(),
        StoreService.getSettings()
    ]);
    setProducts(p);
    setCustomers(c);
    setRecentSales(s.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    setTags(t);
    setSettings(st);
  };

  // Generic Key Down Handler
  const handleKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLElement> | null, action?: () => void) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (nextRef && nextRef.current) {
              nextRef.current.focus();
          } else if (action) {
              action();
          }
      }
  };

  // --- History Selection Logic ---
  const toggleSaleSelection = (id: string) => {
    const newSet = new Set(selectedSales);
    if (newSet.has(id)) {
        newSet.delete(id);
    } else {
        newSet.add(id);
    }
    setSelectedSales(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedSales.size === recentSales.length) {
        setSelectedSales(new Set());
    } else {
        setSelectedSales(new Set(recentSales.map(s => s.id)));
    }
  };

  const handleDeleteCheck = () => {
      const selectedItems = recentSales.filter(s => selectedSales.has(s.id));
      const hasDues = selectedItems.some(s => {
          // Check if paid amount is significantly less than total (allowing float variance)
          const paid = s.amountPaid !== undefined ? s.amountPaid : (s.paymentMethod === 'Pay Later' ? 0 : s.total);
          return (s.total - paid) > 1;
      });
      
      if (hasDues) {
          setShowDuesError(true);
      } else {
          setShowDeleteConfirm(true);
      }
  };

  const deleteSelectedSales = async () => {
    if (selectedSales.size === 0) return;
    await StoreService.deleteSales(Array.from(selectedSales));
    setSelectedSales(new Set());
    setIsSelectionMode(false);
    setShowDeleteConfirm(false);
    loadData();
  };

  // --- Edit Sale Logic ---
  const initiateEditSale = () => {
      if (!saleDetail) return;
      
      const paid = saleDetail.amountPaid !== undefined ? saleDetail.amountPaid : (saleDetail.paymentMethod === 'Pay Later' ? 0 : saleDetail.total);
      const isDue = (saleDetail.total - paid) > 1;

      if (isDue) {
          setShowEditWarning(true);
      } else {
          openEditModal();
      }
  };

  const openEditModal = () => {
      if (!saleDetail) return;
      setShowEditWarning(false);
      // Deep copy to editing state
      setEditingSaleData(JSON.parse(JSON.stringify(saleDetail)));
      setIsEditingSale(true);
      setSaleDetail(null); // Close detail view
  };

  const handleUpdateEditingSaleItem = (index: number, field: keyof CartItem, value: any) => {
      if (!editingSaleData) return;
      const updatedItems = [...editingSaleData.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      
      // Recalculate totals
      let newSubtotal = 0;
      let newTax = 0;
      
      updatedItems.forEach(item => {
          const price = item.sellPrice;
          const lineTotal = price * item.quantity; 
          const taxAmt = item.taxRate ? (lineTotal * (item.taxRate / 100)) : 0;
          newSubtotal += lineTotal;
          newTax += taxAmt;
      });

      const newTotal = newSubtotal + newTax; 

      setEditingSaleData({
          ...editingSaleData,
          items: updatedItems,
          subtotal: newSubtotal,
          tax: newTax,
          total: newTotal
      });
  };

  const saveEditedSale = async () => {
      if (!editingSaleData) return;
      await StoreService.updateSale(editingSaleData);
      setIsEditingSale(false);
      setEditingSaleData(null);
      loadData();
  };

  // --- Customer Search & Selection ---
  const filteredCustomers = useMemo(() => {
      if (!customerSearch) return [];
      const lower = customerSearch.toLowerCase();
      return customers.filter(c => 
          c.name.toLowerCase().includes(lower) || 
          c.phone.includes(lower)
      ).slice(0, 5); // Limit to 5 results
  }, [customers, customerSearch]);

  const handleCustomerSelect = (customer: Customer) => {
      setSelectedCustomer(customer);
      setCustomerSearch('');
      setShowCustomerDropdown(false);
      setIsNewCustomerMode(false);
  };

  const handleCreateCustomer = async () => {
      if (!newCustName || !newCustPhone) return;
      
      const phoneFormatted = newCustPhone.startsWith('+') ? newCustPhone : `+91 ${newCustPhone}`;
      const newCust = await StoreService.upsertCustomer({
          name: newCustName,
          phone: phoneFormatted,
          location: newCustAddress,
          email: newCustEmail,
          totalSpent: 0,
          totalDues: 0,
          visitCount: 1,
          history: []
      });
      
      setCustomers(prev => [...prev, newCust]);
      setSelectedCustomer(newCust);
      setIsNewCustomerMode(false);
      setNewCustName(''); setNewCustPhone(''); setNewCustAddress(''); setNewCustEmail('');
  };

  // --- Cart Logic ---
  const addToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1, discount: 0, customPrice: product.sellPrice }];
    });
    setInlineSearch('');
    setTimeout(() => inlineSearchRef.current?.focus(), 10);
  };

  const updateCartItem = (id: string, field: keyof POSCartItem, value: any) => {
    setCart(prev => prev.map(item => {
        if (item.id === id) {
            return { ...item, [field]: value };
        }
        return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // --- Inline Search Logic ---
  const filteredInlineProducts = useMemo(() => {
      if (!inlineSearch) return [];
      const term = inlineSearch.toLowerCase();
      
      const matches = products.filter(p => 
          p.name.toLowerCase().includes(term) || 
          p.sku.toLowerCase().includes(term)
      );

      return matches.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aStarts = aName.startsWith(term);
          const bStarts = bName.startsWith(term);

          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return aName.localeCompare(bName);
      }).slice(0, 15);
  }, [products, inlineSearch]);

  // --- Product Creation Logic ---
  const handleBatchChange = (field: 'packs' | 'perPack', value: string) => {
      const newConfig = { ...batchConfig, [field]: value };
      setBatchConfig(newConfig);
      
      const packs = parseFloat(newConfig.packs);
      const perPack = parseFloat(newConfig.perPack);
      
      if (!isNaN(packs) && !isNaN(perPack) && packs >= 0 && perPack >= 0) {
          setNewProduct(prev => ({ ...prev, stock: Math.floor(packs * perPack) }));
      }
  };

  const handleSaveProduct = async () => {
    if (!newProduct.name || !newProduct.sellPrice) return;
    
    const created = await StoreService.addProduct(newProduct as Product);
    setProducts(prev => [...prev, created]);
    addToCart(created);
    
    setNewProduct({ 
        name: '', sku: '', stock: 0, unit: 'pcs', capacity: '', 
        buyPrice: 0, sellPrice: 0, wholesalePrice: 0, 
        lowStockThreshold: settings.lowStockDefault, location: '', taxRate: 0,
        expiryDate: '', manufacturingDate: ''
    });
    setBatchConfig({ packs: '', perPack: '' });
    setIsCreatingProduct(false);
    setShowProductLookup(false);
  };

  // --- Calculations ---
  const calculateTotals = () => {
      let gross = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      cart.forEach(item => {
          const price = item.customPrice ?? item.sellPrice;
          const lineGross = price * item.quantity;
          const lineDisc = item.discount;
          const taxableValue = Math.max(0, lineGross - lineDisc);
          
          const taxRate = item.taxRate || 0;
          const taxAmount = taxableValue * (taxRate / 100);

          gross += lineGross;
          totalDiscount += lineDisc;
          totalTax += taxAmount;
      });

      return {
          gross,
          discount: totalDiscount,
          tax: totalTax,
          net: gross - totalDiscount + totalTax
      };
  };

  const totals = calculateTotals();

  useEffect(() => {
      if (showCheckout) {
          setPartialPaidAmount(totals.net.toFixed(2));
          setQuickCustName('');
          setQuickCustPhone('');
          setShowCheckoutWarning(false);
          setShakeError(false);
      }
  }, [showCheckout, totals.net]);

  const handlePaymentMethodClick = (method: PaymentMethod) => {
      setPaymentMethod(method);
      if (method === 'Pay Later') {
          setPartialPaidAmount('0');
      } else {
          setPartialPaidAmount(totals.net.toFixed(2));
      }
  };

  const triggerErrorState = () => {
      setShowCheckoutWarning(true);
      setShakeError(true);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      setTimeout(() => setShakeError(false), 500);
      quickNameRef.current?.focus();
  };

  const handleCheckout = async (action: 'save' | 'print' | 'share') => {
    if (cart.length === 0) return;

    const paidAmountValue = parseFloat(partialPaidAmount) || 0;
    const dueAmount = totals.net - paidAmountValue;

    let activeCustomer = selectedCustomer;

    if (dueAmount > 1 && !activeCustomer) { 
        if (!quickCustName || !quickCustPhone) {
            triggerErrorState();
            return;
        }

        const phoneFormatted = quickCustPhone.startsWith('+') ? quickCustPhone : `+91 ${quickCustPhone}`;
        activeCustomer = await StoreService.upsertCustomer({
            name: quickCustName,
            phone: phoneFormatted,
            totalSpent: 0,
            totalDues: 0,
            visitCount: 0,
            history: []
        });
        
        setCustomers(prev => [...prev, activeCustomer!]);
    }

    const customerName = activeCustomer ? activeCustomer.name : 'Walk-in Customer';
    
    const finalItems = cart.map(item => {
        const price = item.customPrice ?? item.sellPrice;
        return {
            ...item,
            sellPrice: price, 
            discount: item.discount 
        };
    });

    const sale = await StoreService.createSale({
      items: finalItems,
      customerName,
      customerId: activeCustomer?.id,
      subtotal: totals.gross, 
      tax: totals.tax,
      total: totals.net,
      amountPaid: paidAmountValue,
      paymentMethod
    });

    if (action === 'print') {
        generateInvoicePDF(sale);
    } else if (action === 'share') {
        const hasPhone = activeCustomer && activeCustomer.phone;
        if (hasPhone) {
            const storeName = settings.storeName || "Noor Store";
            const itemsList = sale.items.map(i => `• ${i.name} x${i.quantity}`).join('%0A');
            const link = `${window.location.origin}/?invoiceId=${sale.id}`; 
            const message = `*${storeName}*%0A%0A*Items:*%0A${itemsList}%0A%0A*Total: ₹${sale.total.toFixed(0)}*%0A*Invoice:* ${link}`;
            
            const phone = activeCustomer.phone.replace(/[^0-9]/g, '');
            const url = `https://wa.me/${phone}?text=${message}`;
            window.open(url, '_blank');
        }
    }

    setCart([]);
    setShowCheckout(false);
    setSelectedCustomer(null);
    setPaymentMethod('Cash'); 
    setQuickCustName('');
    setQuickCustPhone('');
    loadData();
  };

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    if (showScanner) {
        const timeoutId = setTimeout(() => {
            if (!document.getElementById("pos-reader")) return;
            html5QrCode = new Html5Qrcode("pos-reader");
            html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 150 } },
                (decodedText) => {
                    if (settings.soundEnabled) {
                        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {});
                    }

                    const product = products.find(p => p.sku === decodedText || p.id === decodedText);
                    if (product) {
                        addToCart(product);
                        setShowScanner(false);
                    } else {
                        if (confirm(`Product not found (${decodedText}). Add new?`)) {
                            setShowScanner(false);
                            setNewProduct(prev => ({ ...prev, sku: decodedText }));
                            setIsCreatingProduct(true);
                            setShowProductLookup(true);
                        } else {
                            setShowScanner(false);
                        }
                    }
                },
                () => {}
            ).catch(console.error);
        }, 100);
        return () => { clearTimeout(timeoutId); html5QrCode?.isScanning && html5QrCode.stop(); };
    }
  }, [showScanner, products, settings.soundEnabled]);

  const preventWheelChange = (e: React.WheelEvent<HTMLInputElement>) => {
      e.currentTarget.blur();
  };

  const handleCartInputEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          e.currentTarget.blur();
      }
  };

  if (viewMode === 'HISTORY') {
      return (
          <div className="bg-white min-h-screen animate-in slide-in-from-right-10 flex flex-col">
              <div className="sticky top-0 bg-white border-b border-gray-100 z-10 px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <button onClick={closeHistory} className="p-2 -ml-2 hover:bg-gray-50 rounded-full">
                          <ArrowLeft size={24} className="text-gray-600" />
                      </button>
                      <div>
                          <h1 className="text-xl font-bold text-gray-800">History</h1>
                          {isSelectionMode ? (
                              <p className="text-xs text-gray-500">{selectedSales.size} Selected</p>
                          ) : (
                              <p className="text-xs text-gray-500">Recent Transactions</p>
                          )}
                      </div>
                  </div>
                  <div className="flex gap-2 items-center">
                       {!isSelectionMode && (
                           <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mr-2">
                               <button 
                                onClick={() => setHistoryLayout('list')}
                                className={`p-1.5 rounded-md transition-all ${historyLayout === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                               >
                                   <ListIcon size={18}/>
                               </button>
                               <button 
                                onClick={() => setHistoryLayout('grid')}
                                className={`p-1.5 rounded-md transition-all ${historyLayout === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                               >
                                   <LayoutGrid size={18}/>
                               </button>
                           </div>
                       )}

                       {isSelectionMode ? (
                           <>
                               <Button size="sm" variant="neutral" onClick={() => { setIsSelectionMode(false); setSelectedSales(new Set()); }}>
                                   Cancel
                               </Button>
                               <Button 
                                    size="sm" 
                                    variant="danger" 
                                    disabled={selectedSales.size === 0}
                                    onClick={handleDeleteCheck}
                               >
                                   Delete ({selectedSales.size})
                               </Button>
                           </>
                       ) : (
                           <Button size="sm" variant="neutral" onClick={() => setIsSelectionMode(true)} className="flex items-center gap-1">
                               <CheckSquare size={16} /> Select
                           </Button>
                       )}
                  </div>
              </div>

              {isSelectionMode && (
                  <div className="bg-gray-50 px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-[73px] z-10">
                       <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-bold text-gray-600">
                           {selectedSales.size === recentSales.length && recentSales.length > 0 ? (
                               <CheckSquare size={20} className="text-blue-600" />
                           ) : (
                               <Square size={20} className="text-gray-400" />
                           )}
                           Select All
                       </button>
                  </div>
              )}

              <div className={`${historyLayout === 'grid' ? 'grid grid-cols-2 gap-3 p-4' : 'p-4 space-y-3'} pb-24`}>
                  {recentSales.map(sale => {
                      const isSelected = selectedSales.has(sale.id);
                      const paid = sale.amountPaid !== undefined ? sale.amountPaid : (sale.paymentMethod === 'Pay Later' ? 0 : sale.total);
                      const balance = sale.total - paid;
                      const isDue = balance > 1; 
                      
                      const handleInteraction = () => {
                          if (isSelectionMode) {
                              toggleSaleSelection(sale.id);
                          } else {
                              setSaleDetail(sale);
                          }
                      };

                      if (historyLayout === 'grid') {
                          return (
                            <div 
                                key={sale.id}
                                onClick={handleInteraction}
                                onTouchStart={() => handleTouchStart(sale.id)}
                                onTouchEnd={handleTouchEnd}
                                onContextMenu={(e) => { e.preventDefault(); if(!isSelectionMode) { setIsSelectionMode(true); toggleSaleSelection(sale.id); } }}
                                className={`
                                    relative p-4 rounded-xl border shadow-sm transition-all flex flex-col justify-between h-32 select-none
                                    ${isSelected ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-gray-100 active:scale-95'}
                                    ${isDue ? 'border-red-100 bg-red-50/20' : ''}
                                `}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="font-bold text-gray-800 text-sm truncate w-full pr-6">{sale.customerName}</div>
                                    {isSelectionMode && (
                                        <div className="absolute top-3 right-3">
                                            {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-gray-300" />}
                                        </div>
                                    )}
                                </div>
                                
                                <div>
                                    <div className="text-xs text-gray-400 font-mono mb-1">#{sale.id.slice(0,6).toUpperCase()}</div>
                                    <div className="flex justify-between items-end">
                                        <div className={`font-bold text-lg ${isDue ? 'text-red-600' : 'text-gray-900'}`}>
                                            ₹{sale.total.toFixed(0)}
                                            {isDue && (
                                                <span className="block text-[10px] uppercase font-bold tracking-wider text-red-500 mt-[-2px]">
                                                    Due: ₹{balance.toFixed(0)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-gray-400">{new Date(sale.timestamp).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>
                                    </div>
                                </div>
                            </div>
                          );
                      }

                      return (
                        <div 
                            key={sale.id} 
                            onClick={handleInteraction}
                            onTouchStart={() => handleTouchStart(sale.id)}
                            onTouchEnd={handleTouchEnd}
                            onContextMenu={(e) => { e.preventDefault(); if(!isSelectionMode) { setIsSelectionMode(true); toggleSaleSelection(sale.id); } }}
                            className={`
                                relative p-5 rounded-xl border shadow-sm transition-all flex gap-3 select-none
                                ${isSelected ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-gray-100 hover:shadow-md active:scale-[0.98]'}
                                ${isDue ? 'border-red-100 bg-red-50/10' : ''}
                                cursor-pointer
                            `}
                        >
                            {isSelectionMode && (
                                <div className="shrink-0 flex items-center justify-center pt-1">
                                    {isSelected ? (
                                        <CheckSquare size={24} className="text-blue-600" />
                                    ) : (
                                        <Square size={24} className="text-gray-300" />
                                    )}
                                </div>
                            )}

                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="font-bold text-lg text-gray-800">{sale.customerName}</div>
                                        <div className="text-xs text-gray-400 font-mono mt-1">#{sale.id.slice(0,8).toUpperCase()}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-bold text-xl ${isDue ? 'text-red-600' : 'text-gray-900'}`}>
                                            ₹{sale.total.toFixed(2)}
                                        </div>
                                        {isDue ? (
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] uppercase font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                                                    Unpaid
                                                </span>
                                                <span className="text-xs font-bold text-red-500 mt-1">
                                                    Due: ₹{balance.toFixed(2)}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-gray-400 mt-1">{new Date(sale.timestamp).toLocaleDateString()}</div>
                                        )}
                                    </div>
                                </div>
                                <div className="border-t border-gray-100 pt-3 mt-3 flex justify-between items-center">
                                    <div className="text-sm text-gray-500">{sale.items.length} Items</div>
                                    {!isSelectionMode && (
                                        <div className="text-xs font-bold text-blue-600 flex items-center gap-1">
                                            View Details <ChevronRight size={14}/>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                      );
                  })}
              </div>

              <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm Deletion">
                  <div className="text-center py-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Delete {selectedSales.size} Records?</h3>
                      <div className="flex gap-3 mt-6">
                          <Button variant="neutral" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                          <Button variant="danger" className="flex-1" onClick={deleteSelectedSales}>Yes, Delete</Button>
                      </div>
                  </div>
              </Modal>

              <Modal isOpen={showDuesError} onClose={() => setShowDuesError(false)} title="Restricted Action">
                  <div className="text-center py-4">
                      <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertTriangle size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Cannot Delete Unpaid Sales</h3>
                      <p className="text-sm text-gray-500 mb-6 px-4">
                          One or more selected records are marked as <strong>'Pay Later'</strong> or have partial payments. These transactions are linked to customer dues accounting.
                      </p>
                      <Button className="w-full" onClick={() => setShowDuesError(false)}>Okay</Button>
                  </div>
              </Modal>

              <Modal isOpen={!!saleDetail} onClose={() => setSaleDetail(null)} title="Sale Details" className="!max-w-lg">
                  {saleDetail && (
                      <div className="animate-in fade-in zoom-in-95">
                          {(() => {
                              const paid = saleDetail.amountPaid !== undefined ? saleDetail.amountPaid : (saleDetail.paymentMethod === 'Pay Later' ? 0 : saleDetail.total);
                              const due = saleDetail.total - paid;
                              const isUnpaid = due > 1; 
                              return (
                                  <div className={`p-4 rounded-xl mb-4 text-center border-2 ${isUnpaid ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                      <div className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-500">Status</div>
                                      <div className={`text-xl font-extrabold ${isUnpaid ? 'text-red-600' : 'text-green-600'}`}>
                                          {isUnpaid ? `Pending: ₹${due.toFixed(2)}` : 'Paid in Full'}
                                      </div>
                                      <div className="mt-2 text-sm text-gray-600">
                                          Paid: <strong>₹{paid.toFixed(2)}</strong> via {saleDetail.paymentMethod}
                                      </div>
                                  </div>
                              );
                          })()}

                          <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                              <div>
                                  <div className="text-xs text-gray-400 font-bold uppercase mb-1">Customer</div>
                                  <div className="text-lg font-bold text-gray-900">{saleDetail.customerName}</div>
                                  <div className="text-sm text-gray-500 mt-1">{new Date(saleDetail.timestamp).toLocaleString()}</div>
                              </div>
                              <div className="text-right">
                                  <div className="text-xs text-gray-400 font-bold uppercase mb-1">Total</div>
                                  <div className="text-2xl font-extrabold text-gray-800">₹{saleDetail.total.toFixed(2)}</div>
                              </div>
                          </div>

                          <div className="space-y-2 mb-6 max-h-60 overflow-y-auto bg-gray-50 p-3 rounded-lg border border-gray-200">
                              {saleDetail.items.map((item, i) => (
                                  <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-200 last:border-0">
                                      <span>{item.name} <span className="text-gray-400 text-xs">x{item.quantity}</span></span>
                                      <span className="font-bold text-gray-700">₹{((item.sellPrice * item.quantity) - (item.discount || 0)).toFixed(2)}</span>
                                  </div>
                              ))}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                              <Button variant="neutral" onClick={initiateEditSale} className="flex items-center justify-center gap-2 border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-300">
                                  <Edit3 size={18} /> Edit
                              </Button>
                              <Button className="flex items-center justify-center gap-2" onClick={() => generateInvoicePDF(saleDetail)}>
                                  <Printer size={18} /> Print
                              </Button>
                          </div>
                      </div>
                  )}
              </Modal>

              <Modal isOpen={showEditWarning} onClose={() => setShowEditWarning(false)} title="Warning: Outstanding Dues">
                  <div className="text-center py-4">
                      <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <AlertTriangle size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Proceed with Caution</h3>
                      <p className="text-sm text-gray-500 mb-6 px-4">
                          This invoice has an outstanding balance. Editing totals or payments will recalculate the customer's total dues. Ensure the new values are accurate.
                      </p>
                      <div className="flex gap-3">
                          <Button variant="neutral" className="flex-1" onClick={() => setShowEditWarning(false)}>Cancel</Button>
                          <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={openEditModal}>Continue Editing</Button>
                      </div>
                  </div>
              </Modal>

              <Modal 
                  isOpen={isEditingSale} 
                  onClose={() => setIsEditingSale(false)} 
                  title="Edit Transaction" 
                  className="!max-w-3xl !p-0 overflow-hidden border-0 shadow-2xl bg-white"
              >
                  {editingSaleData && (
                      <div className="animate-in fade-in flex flex-col h-full">
                          <div className="bg-indigo-600 px-6 py-5 text-white">
                              <div className="flex items-center gap-2 text-indigo-100 text-[10px] font-extrabold uppercase tracking-widest mb-1">
                                  <Edit3 size={12}/> Editing Record
                              </div>
                              <h2 className="text-xl font-bold"># {editingSaleData.id.slice(0,12).toUpperCase()}</h2>
                          </div>

                          <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-100">
                                      <label className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block mb-2">Billing Customer</label>
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0">
                                              <User size={20}/>
                                          </div>
                                          <Input 
                                              value={editingSaleData.customerName}
                                              onChange={(e) => setEditingSaleData({...editingSaleData, customerName: e.target.value})}
                                              className="!bg-white !border-blue-200 !py-2 !px-3 font-bold"
                                              placeholder="Customer Name"
                                              onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                      e.currentTarget.blur();
                                                  }
                                              }}
                                          />
                                      </div>
                                  </div>

                                  <div className="bg-purple-50 p-4 rounded-2xl border-2 border-purple-100">
                                      <label className="text-[10px] font-extrabold text-purple-400 uppercase tracking-widest block mb-2">Original Method</label>
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0">
                                              <Banknote size={20}/>
                                          </div>
                                          <select 
                                              className="w-full rounded-lg px-3 py-2 bg-white border-2 border-purple-200 text-gray-900 font-bold focus:outline-none focus:border-purple-500 appearance-none"
                                              value={editingSaleData.paymentMethod}
                                              onChange={(e) => setEditingSaleData({...editingSaleData, paymentMethod: e.target.value})}
                                          >
                                              {['Cash', 'UPI', 'Card', 'Pay Later'].map(m => <option key={m} value={m}>{m}</option>)}
                                          </select>
                                      </div>
                                  </div>
                              </div>

                              <div className="bg-green-600 p-5 rounded-2xl text-white shadow-lg shadow-green-100 flex flex-col md:flex-row items-center justify-between gap-4">
                                  <div className="text-center md:text-left">
                                      <div className="text-[10px] font-extrabold text-green-100 uppercase tracking-widest">Amount Actually Paid</div>
                                      <div className="text-xs text-green-200 opacity-80 mt-0.5">Update if balance was settled outside this POS</div>
                                  </div>
                                  <div className="flex items-center bg-white rounded-xl px-4 py-2 w-full md:w-48 shadow-inner">
                                      <span className="text-green-600 font-black text-xl mr-2">₹</span>
                                      <input 
                                          type="number"
                                          className="w-full outline-none font-black text-green-700 text-2xl bg-transparent"
                                          value={editingSaleData.amountPaid ?? editingSaleData.total}
                                          onChange={(e) => setEditingSaleData({...editingSaleData, amountPaid: parseFloat(e.target.value) || 0})}
                                          onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                  e.currentTarget.blur();
                                              }
                                          }}
                                      />
                                  </div>
                              </div>

                              <div className="space-y-3">
                                  <div className="flex items-center gap-2 mb-2">
                                      <ShoppingCart size={16} className="text-gray-400" />
                                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Purchased Items</h3>
                                  </div>
                                  
                                  <div className="space-y-3">
                                      {editingSaleData.items.map((item, idx) => (
                                          <div key={idx} className="bg-white border-2 border-indigo-50 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-indigo-200 transition-all">
                                              <div className="min-w-0 flex-1">
                                                  <div className="font-bold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors truncate">{item.name}</div>
                                                  <div className="text-xs text-gray-400 font-medium">Unit Price: ₹{item.sellPrice.toFixed(2)}</div>
                                              </div>
                                              
                                              <div className="flex items-center gap-6 shrink-0 bg-indigo-50/50 p-2 md:p-0 rounded-xl md:bg-transparent">
                                                  <div className="flex flex-col items-center">
                                                      <label className="text-[9px] font-black text-indigo-400 uppercase mb-1">Qty</label>
                                                      <input 
                                                          type="number" 
                                                          className="w-16 bg-white border-2 border-indigo-100 rounded-lg py-1.5 text-center font-black text-indigo-700 focus:border-indigo-500 outline-none"
                                                          value={item.quantity}
                                                          onChange={(e) => handleUpdateEditingSaleItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                          onKeyDown={(e) => {
                                                              if (e.key === 'Enter') {
                                                                  e.currentTarget.blur();
                                                              }
                                                          }}
                                                      />
                                                  </div>
                                                  
                                                  <div className="flex flex-col items-end min-w-[80px]">
                                                      <label className="text-[9px] font-black text-gray-400 uppercase mb-1">Subtotal</label>
                                                      <div className="font-black text-gray-800 text-lg">
                                                          ₹{((item.sellPrice * item.quantity) - (item.discount || 0)).toFixed(0)}
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>

                              <div className="pt-6 border-t-2 border-dashed border-gray-100 flex flex-col items-end">
                                  <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">Revised Transaction Total</div>
                                  <div className="text-4xl font-black text-gray-900">
                                      ₹{editingSaleData.total.toFixed(2)}
                                  </div>
                              </div>
                          </div>

                          <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                              <Button 
                                  variant="neutral" 
                                  onClick={() => setIsEditingSale(false)} 
                                  className="flex-1 !py-4 font-bold border-2 border-gray-200 text-gray-500 hover:bg-white"
                              >
                                  Discard Changes
                              </Button>
                              <Button 
                                  onClick={saveEditedSale} 
                                  className="flex-1 !py-4 font-bold bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                              >
                                  <Save size={20}/> Save Record
                              </Button>
                          </div>
                      </div>
                  )}
              </Modal>
          </div>
      );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white md:bg-gray-50 md:p-6 pb-32 animate-in fade-in relative">
      <style>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .shake-element { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
      `}</style>

      <div className="w-full max-w-5xl mx-auto bg-white md:rounded-xl md:shadow-xl md:border border-gray-100 min-h-[85vh] flex flex-col">
          
          <div className="p-4 md:p-8 border-b border-gray-100 flex flex-row justify-between items-center gap-4 relative z-30">
              <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold">N</div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">INVOICE</h1>
                    </div>
                    <p className="text-gray-400 text-sm">#{new Date().getTime().toString().slice(-6)}</p>
                  </div>
              </div>
              
              <div className="flex gap-3">
                  <Button variant="neutral" onClick={openHistory} className="!px-3" title="History">
                      <History size={18}/>
                  </Button>
              </div>
          </div>

          <div className="p-4 md:px-8 bg-gray-50/50 border-b border-gray-100">
              <div className="flex-1 max-w-md relative group">
                  {!selectedCustomer ? (
                      <div>
                          <label className="text-xs font-semibold text-black uppercase tracking-wider mb-2 block">Bill To:</label>
                          {!isNewCustomerMode && (
                              <div className="relative z-50">
                                  <Search className="absolute left-3 top-3 text-gray-400" size={16}/>
                                  <input 
                                      ref={customerSearchInputRef}
                                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-500 outline-none transition-all"
                                      placeholder="Type Name or Phone..."
                                      value={customerSearch}
                                      onChange={(e) => {
                                          setCustomerSearch(e.target.value);
                                          setShowCustomerDropdown(true);
                                      }}
                                      onFocus={() => setShowCustomerDropdown(true)}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter' && filteredCustomers.length > 0) {
                                              handleCustomerSelect(filteredCustomers[0]);
                                          }
                                      }}
                                  />
                                  {showCustomerDropdown && customerSearch && (
                                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto z-50">
                                          {filteredCustomers.length > 0 ? (
                                              filteredCustomers.map(c => (
                                                  <button key={c.id} onClick={() => handleCustomerSelect(c)} className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 flex justify-between items-center group">
                                                      <div>
                                                          <div className="font-bold text-gray-800 text-sm group-hover:text-blue-700">{c.name}</div>
                                                          <div className="text-xs text-gray-400">{c.phone}</div>
                                                      </div>
                                                      <ChevronRight size={14} className="text-gray-300"/>
                                                  </button>
                                              ))
                                          ) : (
                                              <div className="p-3 text-center">
                                                  <button onClick={() => { setIsNewCustomerMode(true); setShowCustomerDropdown(false); setNewCustPhone(customerSearch); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-md transition-colors">
                                                      + Create "{customerSearch}"
                                                  </button>
                                              </div>
                                          )}
                                      </div>
                                  )}
                              </div>
                          )}
                          
                          {isNewCustomerMode && (
                              <div className="mt-4 bg-white rounded-xl shadow-[0_4px_20px_-2px_rgba(59,130,246,0.1)] border border-blue-100 p-5 animate-in slide-in-from-top-2">
                                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-50">
                                      <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">NEW CUSTOMER</h4>
                                      <button onClick={() => setIsNewCustomerMode(false)} className="text-gray-400 hover:text-red-500 transition-colors bg-gray-50 rounded-full p-1"><X size={16}/></button>
                                  </div>
                                  
                                  <div className="space-y-4">
                                      <div className="space-y-1">
                                          <label className="text-[10px] uppercase font-bold text-gray-400 pl-1">Full Name</label>
                                          <div className="relative">
                                              <User size={16} className="absolute left-3 top-3 text-blue-400" />
                                              <input 
                                                  ref={custNameRef}
                                                  className="w-full pl-9 pr-3 py-2.5 bg-blue-50/10 border-b-2 border-blue-100 rounded-t-lg focus:border-blue-500 focus:bg-white outline-none transition-all text-sm font-medium text-gray-800 placeholder-gray-400"
                                                  placeholder="Type name..."
                                                  value={newCustName} 
                                                  onChange={e => setNewCustName(e.target.value)} 
                                                  onKeyDown={(e) => handleKeyDown(e, custPhoneRef)}
                                                  autoFocus
                                              />
                                          </div>
                                      </div>

                                      <div className="space-y-1">
                                          <label className="text-[10px] uppercase font-bold text-gray-400 pl-1">Phone Number</label>
                                          <div className="relative">
                                              <Phone size={16} className="absolute left-3 top-3 text-blue-400" />
                                              <input 
                                                  ref={custPhoneRef}
                                                  className="w-full pl-9 pr-3 py-2.5 bg-blue-50/10 border-b-2 border-blue-100 rounded-t-lg focus:border-blue-500 focus:bg-white outline-none transition-all text-sm font-medium text-gray-800 placeholder-gray-400"
                                                  placeholder="Type phone..."
                                                  value={newCustPhone} 
                                                  onChange={e => {
                                                      const val = e.target.value.replace(/[^\d+ ]/g, '');
                                                      setNewCustPhone(val);
                                                  }}
                                                  onKeyDown={(e) => handleKeyDown(e, custEmailRef)}
                                              />
                                          </div>
                                      </div>

                                      <div className="space-y-1">
                                          <label className="text-[10px] uppercase font-bold text-gray-400 pl-1">Email (Optional)</label>
                                          <div className="relative">
                                              <Mail size={16} className="absolute left-3 top-3 text-blue-400" />
                                              <input 
                                                  ref={custEmailRef}
                                                  className="w-full pl-9 pr-3 py-2.5 bg-blue-50/10 border-b-2 border-blue-100 rounded-t-lg focus:border-blue-500 focus:bg-white outline-none transition-all text-sm font-medium text-gray-800 placeholder-gray-400"
                                                  placeholder="Type email..."
                                                  value={newCustEmail} 
                                                  onChange={e => setNewCustEmail(e.target.value)} 
                                                  onKeyDown={(e) => handleKeyDown(e, custAddrRef)}
                                              />
                                          </div>
                                      </div>

                                      <div className="space-y-1">
                                          <label className="text-[10px] uppercase font-bold text-gray-400 pl-1">Address (Optional)</label>
                                          <div className="relative">
                                              <MapPin size={16} className="absolute left-3 top-3 text-blue-400" />
                                              <input 
                                                  ref={custAddrRef}
                                                  className="w-full pl-9 pr-3 py-2.5 bg-blue-50/10 border-b-2 border-blue-100 rounded-t-lg focus:border-blue-500 focus:bg-white outline-none transition-all text-sm font-medium text-gray-800 placeholder-gray-400"
                                                  placeholder="Type location..."
                                                  value={newCustAddress} 
                                                  onChange={e => setNewCustAddress(e.target.value)} 
                                                  onKeyDown={(e) => handleKeyDown(e, null, handleCreateCustomer)}
                                              />
                                          </div>
                                      </div>
                                  </div>

                                  <div className="flex justify-end mt-6">
                                      <Button size="sm" onClick={handleCreateCustomer} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                                          Save
                                      </Button>
                                  </div>
                              </div>
                          )}
                      </div>
                  ) : (
                      <div className="relative h-full flex flex-col justify-center">
                          <button onClick={() => setSelectedCustomer(null)} className="absolute top-0 right-0 p-1 bg-gray-200 text-gray-500 hover:text-red-600 rounded-full"><X size={16} /></button>
                          <label className="text-xs font-semibold text-black uppercase tracking-wider mb-1 block">Bill To:</label>
                          <div className="font-bold text-xl text-gray-900 leading-tight pr-6">{selectedCustomer.name}</div>
                          <div className="mt-1 text-sm text-gray-600">{selectedCustomer.phone}</div>
                      </div>
                  )}
              </div>
          </div>

          <div className="px-4 md:px-8 py-3 bg-white">
               {/* Conditional rendering for scanner preference */}
               {(settings.scannerPreference === 'phone' || settings.scannerPreference === 'both') ? (
                   <button 
                      onClick={() => setShowScanner(true)} 
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-lg shadow-sm active:scale-95 transition-all hover:bg-gray-800"
                   >
                       <Scan size={20}/>
                       <span className="font-bold text-sm">Scan Barcode</span>
                   </button>
               ) : (
                   <div className="w-full p-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center">
                       <p className="text-xs text-gray-500 font-bold">Physical Scanner Mode Enabled</p>
                       <p className="text-[10px] text-gray-400 italic">Ready to accept machine scans...</p>
                   </div>
               )}
          </div>

          <div className="flex-1 overflow-x-auto min-h-[400px] flex flex-col">
              <div className="min-w-[600px] w-full">
                  <div className="grid grid-cols-[40px_2fr_80px_60px_60px_80px_40px] gap-2 px-4 md:px-8 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-20">
                      <div className="text-center">#</div>
                      <div>Item Details</div>
                      <div className="text-right">Price</div>
                      <div className="text-center">Qty</div>
                      <div className="text-center">Dis</div>
                      <div className="text-right">Total</div>
                      <div></div>
                  </div>

                  <div className="divide-y divide-gray-100">
                      {cart.map((item, index) => {
                         const lineTotal = ((item.customPrice ?? item.sellPrice) * item.quantity) - item.discount;
                         return (
                             <div key={item.id} className="grid grid-cols-[40px_2fr_80px_60px_60px_80px_40px] gap-2 items-center px-4 md:px-8 py-3 hover:bg-gray-50/50 transition-colors group">
                                 <div className="text-center text-gray-400 font-medium text-sm">{index + 1}</div>
                                 <div>
                                     <input 
                                         className="w-full font-bold text-gray-900 text-sm bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-500 outline-none transition-colors"
                                         value={item.name}
                                         onChange={(e) => updateCartItem(item.id, 'name', e.target.value)}
                                     />
                                     {item.sku && <div className="text-[10px] text-gray-400 font-mono mt-0.5">{item.sku}</div>}
                                 </div>
                                 <div className="text-right">
                                     <input 
                                         type="number"
                                         className="w-full text-right bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-500 outline-none text-sm font-medium text-gray-700"
                                         value={item.customPrice ?? item.sellPrice}
                                         onChange={(e) => updateCartItem(item.id, 'customPrice', parseFloat(e.target.value) || 0)}
                                         onWheel={preventWheelChange}
                                         onKeyDown={handleCartInputEnter}
                                     />
                                 </div>
                                 <div className="px-1">
                                     <input 
                                         type="number"
                                         className="w-full text-center bg-gray-50 border border-transparent hover:border-gray-200 focus:bg-white focus:border-blue-500 rounded py-1 outline-none text-sm font-bold text-gray-800"
                                         value={item.quantity}
                                         onChange={(e) => updateCartItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                         onWheel={preventWheelChange}
                                         onKeyDown={handleCartInputEnter}
                                     />
                                 </div>
                                 <div className="px-1">
                                     <input 
                                         type="number"
                                         className="w-full text-center bg-transparent border-b border-transparent hover:border-gray-200 focus:border-red-500 outline-none text-sm text-red-500 font-medium placeholder-gray-300"
                                         placeholder="0"
                                         value={item.discount || ''}
                                         onChange={(e) => updateCartItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                                         onWheel={preventWheelChange}
                                         onKeyDown={handleCartInputEnter}
                                     />
                                 </div>
                                 <div className="text-right font-extrabold text-gray-900 text-sm">
                                     ₹{lineTotal.toFixed(0)}
                                 </div>
                                 <div className="text-right">
                                     <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                                         <Trash2 size={16}/>
                                     </button>
                                 </div>
                             </div>
                         );
                      })}

                      <div className="grid grid-cols-[40px_2fr_80px_60px_60px_80px_40px] gap-2 items-start px-4 md:px-8 py-3 bg-white relative">
                          <div className="text-center text-gray-300 font-medium text-sm pt-2">{cart.length + 1}</div>
                          <div className="relative">
                              <div className="flex items-center gap-2 w-full border-b-2 border-blue-100 focus-within:border-blue-500 transition-colors">
                                  <input 
                                      ref={inlineSearchRef}
                                      className="w-full py-2 bg-transparent outline-none text-sm font-medium text-gray-800 placeholder-gray-400"
                                      placeholder="Type item name..."
                                      value={inlineSearch}
                                      onChange={(e) => setInlineSearch(e.target.value)}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter' && filteredInlineProducts.length > 0) {
                                              addToCart(filteredInlineProducts[0]);
                                          }
                                      }}
                                  />
                              </div>
                              
                              {inlineSearch && (
                                  <div className="absolute top-full left-0 w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-100 max-h-60 overflow-y-auto z-50">
                                      {filteredInlineProducts.length > 0 ? (
                                          filteredInlineProducts.map(p => (
                                              <button 
                                                  key={p.id} 
                                                  onClick={() => addToCart(p)}
                                                  className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-50 flex justify-between items-center text-sm"
                                              >
                                                  <span className="font-bold text-gray-800">{p.name}</span>
                                                  <span className="text-gray-500">₹{p.sellPrice}</span>
                                              </button>
                                          ))
                                      ) : (
                                          <button 
                                              onClick={() => {
                                                  setIsCreatingProduct(true);
                                                  setNewProduct({ ...newProduct, name: inlineSearch });
                                                  setShowProductLookup(true);
                                                  setInlineSearch('');
                                              }}
                                              className="w-full text-left px-4 py-3 text-sm text-blue-600 font-bold hover:bg-blue-50"
                                          >
                                              + Add "{inlineSearch}" as new product
                                          </button>
                                      )}
                                  </div>
                              )}
                          </div>
                          <div className="text-right pt-2 text-gray-300 text-sm">-</div>
                          <div className="text-center pt-2 text-gray-300 text-sm">-</div>
                          <div className="text-center pt-2 text-gray-300 text-sm">-</div>
                          <div className="text-right pt-2 text-gray-300 text-sm">-</div>
                          <div></div>
                      </div>
                  </div>
              </div>
          </div>

          <div className="bg-gray-50 p-6 md:p-8 border-t border-gray-200">
              <div className="flex flex-col md:flex-row gap-8 items-end justify-between">
                  <div className="w-full md:w-auto text-xs text-gray-400 hidden md:block">
                      <p>Thank you for your business.</p>
                  </div>

                  <div className="w-full md:w-80 space-y-3">
                      <div className="flex justify-between text-sm text-gray-600">
                          <span>Gross Total</span>
                          <span className="font-medium">₹{totals.gross.toFixed(2)}</span>
                      </div>
                      {totals.discount > 0 && (
                          <div className="flex justify-between text-sm text-red-600">
                              <span>Total Discount</span>
                              <span>-₹{totals.discount.toFixed(2)}</span>
                          </div>
                      )}
                      <div className="flex justify-between text-sm text-gray-600">
                          <span>Tax</span>
                          <span className="font-medium">₹{totals.tax.toFixed(2)}</span>
                      </div>
                      
                      <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                          <span className="font-bold text-gray-900 text-lg">Net Payable</span>
                          <span className="font-extrabold text-2xl text-green-700">₹{totals.net.toFixed(2)}</span>
                      </div>

                      <Button onClick={() => setShowCheckout(true)} disabled={cart.length === 0} className="w-full py-4 mt-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg shadow-green-200 disabled:opacity-50">
                          Complete Sale
                      </Button>
                  </div>
              </div>
          </div>
      </div>

      <Modal isOpen={showProductLookup && isCreatingProduct} onClose={() => { setShowProductLookup(false); setIsCreatingProduct(false); }} title="Add New Product" className="!max-w-2xl !bg-[#fdfdfc] !shadow-2xl border-0">
            <div className="animate-in fade-in slide-in-from-right-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Product Name</label>
                        <Input ref={prodNameRef} onKeyDown={(e) => handleKeyDown(e, prodSkuRef)} placeholder="Name" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} autoFocus className="!bg-white !border-gray-200"/>
                    </div>
                    <div className="md:col-span-2">
                         <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Barcode / SKU</label>
                         <div className="flex w-full">
                            <Input ref={prodSkuRef} onKeyDown={(e) => handleKeyDown(e, prodSellRef)} placeholder="Scan or type" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="!bg-white !border-gray-200 rounded-r-none"/>
                            {(settings.scannerPreference === 'phone' || settings.scannerPreference === 'both') && (
                                <button onClick={() => setShowScanner(true)} className="px-3 bg-white border border-gray-200 border-l-0 rounded-r-lg text-gray-600 hover:bg-gray-50"><Scan size={20}/></button>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Sell Price</label>
                        <Input ref={prodSellRef} onKeyDown={(e) => handleKeyDown(e, prodBuyRef)} type="number" placeholder="0.00" value={newProduct.sellPrice || ''} onChange={e => setNewProduct({...newProduct, sellPrice: parseFloat(e.target.value) || 0})} className="!bg-white !border-gray-200 !text-green-700 !font-bold"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Buy Price</label>
                        <Input ref={prodBuyRef} onKeyDown={(e) => handleKeyDown(e, prodStockRef)} type="number" placeholder="0.00" value={newProduct.buyPrice || ''} onChange={e => setNewProduct({...newProduct, buyPrice: parseFloat(e.target.value) || 0})} className="!bg-white !border-gray-200"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Stock Quantity</label>
                        <Input ref={prodStockRef} onKeyDown={(e) => handleKeyDown(e, null, handleSaveProduct)} type="number" placeholder="Qty" value={newProduct.stock || ''} onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})} className="!bg-white !border-gray-200 flex-1"/>
                    </div>
                 </div>
                 <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                     <Button variant="neutral" onClick={() => { setIsCreatingProduct(false); setShowProductLookup(false); }}>Cancel</Button>
                     <Button onClick={handleSaveProduct} className="bg-green-600 hover:bg-green-700">Save & Add</Button>
                 </div>
            </div>
      </Modal>

      <Modal isOpen={showCheckout} onClose={() => setShowCheckout(false)} title="Payment">
        <div className="text-center px-4 pb-4">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-2">₹{totals.net.toFixed(2)}</h2>
            <p className="text-gray-500 text-sm mb-6">Total Amount Due</p>
            
            <div className={`bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-6 border transition-all relative overflow-hidden ${showCheckoutWarning ? 'border-red-400 ring-4 ring-red-100 bg-red-50/50' : 'border-gray-100'} ${shakeError ? 'shake-element' : ''}`}>
                {selectedCustomer ? (
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Customer</span>
                        <span className="font-bold text-gray-900">{selectedCustomer.name}</span>
                    </div>
                ) : (
                    <div className="animate-in fade-in">
                        <div className={`flex items-center gap-2 mb-3 ${showCheckoutWarning ? 'text-red-600' : 'text-blue-600'}`}>
                            {showCheckoutWarning ? <AlertTriangle size={18} className="animate-pulse"/> : <UserPlus size={16} />}
                            <span className="text-xs font-bold uppercase tracking-wider">{showCheckoutWarning ? 'Details Required for Dues!' : 'Quick Register Customer'}</span>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="relative">
                                <User size={14} className={`absolute left-3 top-3 ${showCheckoutWarning ? 'text-red-400' : 'text-gray-400'}`} />
                                <input 
                                    ref={quickNameRef}
                                    className={`w-full pl-9 pr-3 py-2 text-sm bg-white border rounded-lg focus:border-blue-500 outline-none transition-all placeholder-gray-400 ${showCheckoutWarning && !quickCustName ? 'border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]' : 'border-gray-200'}`}
                                    placeholder="Enter Customer Name"
                                    value={quickCustName}
                                    onChange={(e) => {setQuickCustName(e.target.value); if(e.target.value) setShowCheckoutWarning(false);}}
                                />
                            </div>
                            <div className="relative">
                                <Phone size={14} className={`absolute left-3 top-3 ${showCheckoutWarning ? 'text-red-400' : 'text-gray-400'}`} />
                                <input 
                                    className={`w-full pl-9 pr-3 py-2 text-sm bg-white border rounded-lg focus:border-blue-500 outline-none transition-all placeholder-gray-400 ${showCheckoutWarning && !quickCustPhone ? 'border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]' : 'border-gray-200'}`}
                                    placeholder="Enter Phone Number"
                                    value={quickCustPhone}
                                    onChange={(e) => {setQuickCustPhone(e.target.value.replace(/\D/g, '')); if(e.target.value) setShowCheckoutWarning(false);}}
                                    maxLength={10}
                                />
                            </div>
                            <p className={`text-[10px] italic font-medium ${showCheckoutWarning ? 'text-red-500' : 'text-gray-400'}`}>
                                {showCheckoutWarning ? 'You must assign this debt to a person.' : 'Assigning a name allows tracking dues if payment is partial.'}
                            </p>
                        </div>
                    </div>
                )}
                <div className="flex justify-between text-sm border-t border-gray-200 pt-3 mt-3">
                    <span className="text-gray-500">Total Items</span>
                    <span className="font-bold text-gray-900">{cart.length}</span>
                </div>
            </div>
            
            <div className="mb-6">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-left mb-6">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-blue-800 uppercase tracking-wider">Paying Now</label>
                        <span className="text-xs text-blue-600 font-medium">Edit to split payment</span>
                    </div>
                    <div className="flex items-center relative">
                        <span className="absolute left-3 text-lg font-bold text-gray-400">₹</span>
                        <input 
                            type="number" 
                            className="w-full pl-8 pr-3 py-2 text-2xl font-bold text-gray-900 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                            value={partialPaidAmount}
                            onChange={(e) => setPartialPaidAmount(e.target.value)}
                            onFocus={(e) => e.target.select()}
                        />
                    </div>
                    
                    {(() => {
                        const paid = parseFloat(partialPaidAmount) || 0;
                        const due = totals.net - paid;
                        if (due > 1) {
                            return (
                                <div className="mt-2 flex items-start gap-2 text-xs text-red-600 font-medium animate-in fade-in">
                                    <AlertTriangle size={14} className="mt-0.5 shrink-0"/>
                                    <span>Balance <strong>₹{due.toFixed(2)}</strong> will be added to {selectedCustomer ? selectedCustomer.name.split(' ')[0] + "'s" : (quickCustName || "Customer")} dues.</span>
                                </div>
                            );
                        }
                        return null;
                    })()}
                </div>

                <p className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payment Method</p>
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {[{ id: 'Cash', icon: Banknote }, { id: 'UPI', icon: Smartphone }, { id: 'Card', icon: CreditCard }, { id: 'Pay Later', icon: Clock }].map(method => (
                        <button key={method.id} onClick={() => handlePaymentMethodClick(method.id as PaymentMethod)} className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${paymentMethod === method.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            <method.icon size={20} className="mb-1"/>
                            <span className="text-xs font-bold whitespace-nowrap">{method.id}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => handleCheckout('print')} className="col-span-1 py-3 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 transition-transform active:scale-95">
                    <Printer size={20}/> Save & Print
                </Button>
                <Button onClick={() => handleCheckout('share')} className="col-span-1 py-3 font-bold bg-[#25D366] hover:bg-[#128C7E] text-white shadow-[#25D366]/20 flex items-center justify-center gap-2 transition-transform active:scale-95">
                    {(selectedCustomer?.phone || quickCustPhone) ? <WhatsAppLogo /> : <CheckCircle size={20}/>}
                    {(selectedCustomer?.phone || quickCustPhone) ? 'Share & Save' : 'Save Only'}
                </Button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={showScanner} onClose={() => setShowScanner(false)} title="Scan Barcode">
         <div className="relative bg-black rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center">
             <div id="pos-reader" className="w-full h-full"></div>
             <p className="absolute bottom-4 text-white text-xs bg-black/50 px-2 py-1 rounded z-10">Align barcode within frame</p>
         </div>
      </Modal>

      <Modal 
          isOpen={isEditingSale} 
          onClose={() => setIsEditingSale(false)} 
          title="Edit Transaction" 
          className="!max-w-3xl !p-0 overflow-hidden border-0 shadow-2xl bg-white"
      >
          {editingSaleData && (
              <div className="animate-in fade-in flex flex-col h-full">
                  <div className="bg-indigo-600 px-6 py-5 text-white">
                      <div className="flex items-center gap-2 text-indigo-100 text-[10px] font-extrabold uppercase tracking-widest mb-1">
                          <Edit3 size={12}/> Editing Record
                      </div>
                      <h2 className="text-xl font-bold"># {editingSaleData.id.slice(0,12).toUpperCase()}</h2>
                  </div>

                  <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-100">
                              <label className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest block mb-2">Billing Customer</label>
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0">
                                      <User size={20}/>
                                  </div>
                                  <Input 
                                      value={editingSaleData.customerName}
                                      onChange={(e) => setEditingSaleData({...editingSaleData, customerName: e.target.value})}
                                      className="!bg-white !border-blue-200 !py-2 !px-3 font-bold"
                                      placeholder="Customer Name"
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                              e.currentTarget.blur();
                                          }
                                      }}
                                  />
                              </div>
                          </div>

                          <div className="bg-purple-50 p-4 rounded-2xl border-2 border-purple-100">
                              <label className="text-[10px] font-extrabold text-purple-400 uppercase tracking-widest block mb-2">Original Method</label>
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0">
                                      <Banknote size={20}/>
                                  </div>
                                  <select 
                                      className="w-full rounded-lg px-3 py-2 bg-white border-2 border-purple-200 text-gray-900 font-bold focus:outline-none focus:border-purple-500 appearance-none"
                                      value={editingSaleData.paymentMethod}
                                      onChange={(e) => setEditingSaleData({...editingSaleData, paymentMethod: e.target.value})}
                                  >
                                      {['Cash', 'UPI', 'Card', 'Pay Later'].map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                              </div>
                          </div>
                      </div>

                      <div className="bg-green-600 p-5 rounded-2xl text-white shadow-lg shadow-green-100 flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="text-center md:text-left">
                              <div className="text-[10px] font-extrabold text-green-100 uppercase tracking-widest">Amount Actually Paid</div>
                              <div className="text-xs text-green-200 opacity-80 mt-0.5">Update if balance was settled outside this POS</div>
                          </div>
                          <div className="flex items-center bg-white rounded-xl px-4 py-2 w-full md:w-48 shadow-inner">
                              <span className="text-green-600 font-black text-xl mr-2">₹</span>
                              <input 
                                  type="number"
                                  className="w-full outline-none font-black text-green-700 text-2xl bg-transparent"
                                  value={editingSaleData.amountPaid ?? editingSaleData.total}
                                  onChange={(e) => setEditingSaleData({...editingSaleData, amountPaid: parseFloat(e.target.value) || 0})}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                          e.currentTarget.blur();
                                      }
                                  }}
                              />
                          </div>
                      </div>

                      <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                              <ShoppingCart size={16} className="text-gray-400" />
                              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Purchased Items</h3>
                          </div>
                          
                          <div className="space-y-3">
                              {editingSaleData.items.map((item, idx) => (
                                  <div key={idx} className="bg-white border-2 border-indigo-50 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-indigo-200 transition-all">
                                      <div className="min-w-0 flex-1">
                                          <div className="font-bold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors truncate">{item.name}</div>
                                          <div className="text-xs text-gray-400 font-medium">Unit Price: ₹{item.sellPrice.toFixed(2)}</div>
                                      </div>
                                      
                                      <div className="flex items-center gap-6 shrink-0 bg-indigo-50/50 p-2 md:p-0 rounded-xl md:bg-transparent">
                                          <div className="flex flex-col items-center">
                                              <label className="text-[9px] font-black text-indigo-400 uppercase mb-1">Qty</label>
                                              <input 
                                                  type="number" 
                                                  className="w-16 bg-white border-2 border-indigo-100 rounded-lg py-1.5 text-center font-black text-indigo-700 focus:border-indigo-500 outline-none"
                                                  value={item.quantity}
                                                  onChange={(e) => handleUpdateEditingSaleItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                  onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                          e.currentTarget.blur();
                                                      }
                                                  }}
                                              />
                                          </div>
                                          
                                          <div className="flex flex-col items-end min-w-[80px]">
                                              <label className="text-[9px] font-black text-gray-400 uppercase mb-1">Subtotal</label>
                                              <div className="font-black text-gray-800 text-lg">
                                                  ₹{((item.sellPrice * item.quantity) - (item.discount || 0)).toFixed(0)}
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="pt-6 border-t-2 border-dashed border-gray-100 flex flex-col items-end">
                          <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">Revised Transaction Total</div>
                          <div className="text-4xl font-black text-gray-900">
                              ₹{editingSaleData.total.toFixed(2)}
                          </div>
                      </div>
                  </div>

                  <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                      <Button 
                          variant="neutral" 
                          onClick={() => setIsEditingSale(false)} 
                          className="flex-1 !py-4 font-bold border-2 border-gray-200 text-gray-500 hover:bg-white"
                      >
                          Discard Changes
                      </Button>
                      <Button 
                          onClick={saveEditedSale} 
                          className="flex-1 !py-4 font-bold bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                          <Save size={20}/> Save Record
                      </Button>
                  </div>
              </div>
          )}
      </Modal>

    </div>
  );
};
