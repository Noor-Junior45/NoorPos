import React, { useState, useEffect, useMemo } from 'react';
import { Product, CartItem, Customer, Sale, Tag, StoreSettings } from '../types';
import { StoreService } from '../services/storeService';
import { generateInvoicePDF } from '../services/pdfService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Search, ShoppingCart, Trash2, User, CreditCard, Printer, Scan, Plus, X, Clock, ChevronDown, CircleCheck, Package, History, MoreVertical, FileText, RotateCcw, ArrowLeft, Save, CircleAlert, MapPin, Mail, Phone, ChevronRight, Calculator, Factory, Layers, Scale, AlertTriangle, Box, Tag as TagIcon, Percent, CheckSquare, Square, LayoutGrid, List as ListIcon, Receipt, Banknote, Smartphone, Share2 } from 'lucide-react';
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

export const POS: React.FC = () => {
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ expiryAlertDays: 7, lowStockDefault: 10, soundEnabled: true, currencySymbol: '₹' });
  
  // Cart & Transaction State
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  
  // UI State
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isNewCustomerMode, setIsNewCustomerMode] = useState(false);

  // New Customer Form
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
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

  // Swipe State for Mobile
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // History State
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [historyLayout, setHistoryLayout] = useState<'list' | 'grid'>('list');
  const [saleDetail, setSaleDetail] = useState<Sale | null>(null); // For viewing details

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

  const deleteSelectedSales = async () => {
    if (selectedSales.size === 0) return;
    
    await StoreService.deleteSales(Array.from(selectedSales));
    
    setSelectedSales(new Set());
    setIsSelectionMode(false);
    setShowDeleteConfirm(false);
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
      // Reset form
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
    setShowProductLookup(false);
    setIsCreatingProduct(false);
    setSearchTerm('');
  };

  const updateCartItem = (id: string, field: keyof POSCartItem, value: number) => {
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

  const clearCart = () => {
      if (cart.length > 0 && confirm("Clear current invoice items?")) {
          setCart([]);
      }
  };

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
    
    // Save to DB
    const created = await StoreService.addProduct(newProduct as Product);
    
    // Update local state
    setProducts(prev => [...prev, created]);
    
    // Add to cart immediately
    addToCart(created);
    
    // Reset
    setNewProduct({ 
        name: '', sku: '', stock: 0, unit: 'pcs', capacity: '', 
        buyPrice: 0, sellPrice: 0, wholesalePrice: 0, 
        lowStockThreshold: settings.lowStockDefault, location: '', taxRate: 0,
        expiryDate: '', manufacturingDate: ''
    });
    setBatchConfig({ packs: '', perPack: '' });
    setIsCreatingProduct(false);
  };

  // --- Swipe Handlers ---
  const onTouchStart = (e: React.TouchEvent) => {
      setTouchEnd(null);
      setTouchStart(e.targetTouches[0].clientX);
  }
  
  const onTouchMove = (e: React.TouchEvent) => {
      setTouchEnd(e.targetTouches[0].clientX);
  }
  
  const onTouchEnd = (id: string) => {
      if (!touchStart || !touchEnd) return;
      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > 50;
      const isRightSwipe = distance < -50;
      
      if (isLeftSwipe) {
          setSwipedItemId(id);
      }
      if (isRightSwipe) {
          setSwipedItemId(null);
      }
  }

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

  const handleCheckout = async (action: 'save' | 'print' | 'whatsapp') => {
    if (cart.length === 0) return;

    if (paymentMethod === 'Pay Later' && !selectedCustomer) {
        alert("Please select a customer to use 'Pay Later'.");
        return;
    }

    const customerName = selectedCustomer ? selectedCustomer.name : 'Walk-in Customer';
    
    // Map extended POS items back to standard CartItems
    const finalItems = cart.map(item => {
        const price = item.customPrice ?? item.sellPrice;
        const effectiveTotal = ((price * item.quantity) - item.discount) + (((price * item.quantity) - item.discount) * ((item.taxRate||0)/100));
        const effectiveUnit = effectiveTotal / item.quantity;
        return {
            ...item,
            sellPrice: effectiveUnit
        };
    });

    const sale = await StoreService.createSale({
      items: finalItems,
      customerName,
      customerId: selectedCustomer?.id,
      subtotal: totals.gross - totals.discount,
      tax: totals.tax,
      total: totals.net,
      paymentMethod
    });

    if (action === 'print') {
        generateInvoicePDF(sale);
    } else if (action === 'whatsapp') {
        // Construct WhatsApp Text
        const storeName = "Noor Store"; // Or from settings
        const itemsList = sale.items.map(i => `• ${i.name} x${i.quantity} : ₹${(i.sellPrice * i.quantity).toFixed(0)}`).join('%0A');
        const message = `🧾 *${storeName} Invoice*%0A%0ADate: ${new Date().toLocaleDateString()}%0AInvoice: #${sale.id.slice(0,5).toUpperCase()}%0A%0A*Items:*%0A${itemsList}%0A%0A----------------%0A*Total: ₹${sale.total.toFixed(0)}*%0A----------------%0A%0AThank you for shopping with us!`;
        
        // Use customer phone if available, else open generic share
        const phone = selectedCustomer ? selectedCustomer.phone.replace(/[^0-9]/g, '') : '';
        const url = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`;
        window.open(url, '_blank');
    }

    setCart([]);
    setShowCheckout(false);
    setSelectedCustomer(null);
    setPaymentMethod('Cash'); // Reset default
    loadData();
  };

  // --- Scanner Logic ---
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
                    if (isCreatingProduct) {
                        setNewProduct(prev => ({ ...prev, sku: decodedText }));
                        setShowScanner(false);
                    } else {
                        const product = products.find(p => p.sku === decodedText || p.id === decodedText);
                        if (product) {
                            addToCart(product);
                            setShowScanner(false);
                        } else {
                            alert("Product not found. Do you want to add it?");
                            setShowScanner(false);
                            setShowProductLookup(true);
                            setIsCreatingProduct(true);
                            setNewProduct(prev => ({ ...prev, sku: decodedText }));
                        }
                    }
                },
                () => {}
            ).catch(console.error);
        }, 100);
        return () => { clearTimeout(timeoutId); html5QrCode?.isScanning && html5QrCode.stop(); };
    }
  }, [showScanner, isCreatingProduct]); // Depend on creation mode to handle scanner result differently

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.includes(searchTerm));

  // --- Helper for input behavior ---
  const preventWheelChange = (e: React.WheelEvent<HTMLInputElement>) => {
      e.currentTarget.blur();
  };

  // --- RENDER ---

  if (viewMode === 'HISTORY') {
      return (
          <div className="bg-white min-h-screen animate-in slide-in-from-right-10 flex flex-col">
              {/* Header */}
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
                                    onClick={() => setShowDeleteConfirm(true)}
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

              {/* Selection Header (When Mode Active) */}
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

              {/* List / Grid */}
              <div className={`${historyLayout === 'grid' ? 'grid grid-cols-2 gap-3 p-4' : 'p-4 space-y-3'} pb-24`}>
                  {recentSales.map(sale => {
                      const isSelected = selectedSales.has(sale.id);
                      
                      // Handle Interaction
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
                                className={`
                                    relative p-4 rounded-xl border shadow-sm transition-all flex flex-col justify-between h-32
                                    ${isSelected ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-gray-100 active:scale-95'}
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
                                        <div className="font-bold text-lg text-gray-900">₹{sale.total.toFixed(0)}</div>
                                        <div className="text-[10px] text-gray-400">{new Date(sale.timestamp).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>
                                    </div>
                                </div>
                            </div>
                          );
                      }

                      // List Layout
                      return (
                        <div 
                            key={sale.id} 
                            onClick={handleInteraction}
                            className={`
                                relative p-5 rounded-xl border shadow-sm transition-all flex gap-3
                                ${isSelected ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-gray-100 hover:shadow-md active:scale-[0.98]'}
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
                                        <div className="font-bold text-xl text-gray-900">₹{sale.total.toFixed(2)}</div>
                                        <div className="text-xs text-gray-400 mt-1">{new Date(sale.timestamp).toLocaleDateString()}</div>
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
                  {recentSales.length === 0 && (
                      <div className="text-center py-20 text-gray-400">
                          <History size={48} className="mx-auto mb-2 opacity-20"/>
                          <p>No transaction history</p>
                      </div>
                  )}
              </div>

              {/* Delete Confirmation Modal */}
              <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm Deletion">
                  <div className="text-center py-4">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                          <Trash2 size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">Delete {selectedSales.size} Records?</h3>
                      <p className="text-sm text-gray-500 mb-6">This action cannot be undone. These records will be removed from customer history and reports.</p>
                      <div className="flex gap-3">
                          <Button variant="neutral" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                          <Button variant="danger" className="flex-1" onClick={deleteSelectedSales}>Yes, Delete</Button>
                      </div>
                  </div>
              </Modal>

              {/* Sale Detail Modal */}
              <Modal 
                isOpen={!!saleDetail} 
                onClose={() => setSaleDetail(null)} 
                title="Sale Details"
                className="!max-w-lg"
              >
                  {saleDetail && (
                      <div className="animate-in fade-in zoom-in-95">
                          <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                              <div>
                                  <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Customer</div>
                                  <div className="text-xl font-bold text-gray-900">{saleDetail.customerName}</div>
                                  <div className="text-sm text-gray-500 mt-1">{new Date(saleDetail.timestamp).toLocaleString()}</div>
                              </div>
                              <div className="text-right">
                                  <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Total Paid</div>
                                  <div className="text-2xl font-extrabold text-green-600">₹{saleDetail.total.toFixed(2)}</div>
                                  {saleDetail.paymentMethod && (
                                      <div className="text-xs font-medium text-gray-500 mt-1 bg-gray-100 px-2 py-0.5 rounded inline-block">{saleDetail.paymentMethod}</div>
                                  )}
                              </div>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-1 mb-6 max-h-[300px] overflow-y-auto">
                              <table className="w-full text-sm">
                                  <thead className="text-xs text-gray-400 font-bold uppercase">
                                      <tr>
                                          <th className="px-3 py-2 text-left">Item</th>
                                          <th className="px-3 py-2 text-center">Qty</th>
                                          <th className="px-3 py-2 text-right">Price</th>
                                          <th className="px-3 py-2 text-right">Total</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                      {saleDetail.items.map((item, idx) => (
                                          <tr key={idx}>
                                              <td className="px-3 py-2 font-medium text-gray-700">{item.name}</td>
                                              <td className="px-3 py-2 text-center text-gray-500">{item.quantity}</td>
                                              <td className="px-3 py-2 text-right text-gray-500">₹{item.sellPrice}</td>
                                              <td className="px-3 py-2 text-right font-bold text-gray-800">₹{(item.sellPrice * item.quantity).toFixed(2)}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>

                          <div className="space-y-2 text-sm text-gray-600 mb-6 px-2">
                              <div className="flex justify-between">
                                  <span>Subtotal</span>
                                  <span className="font-medium">₹{saleDetail.subtotal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                  <span>Tax</span>
                                  <span className="font-medium">₹{saleDetail.tax.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-100 pt-2">
                                  <span>Grand Total</span>
                                  <span>₹{saleDetail.total.toFixed(2)}</span>
                              </div>
                          </div>

                          <div className="flex gap-3">
                              <Button variant="neutral" className="flex-1" onClick={() => setSaleDetail(null)}>Close</Button>
                              <Button className="flex-1" onClick={() => generateInvoicePDF(saleDetail)}>
                                  <Printer size={18} className="mr-2 inline"/> Reprint Receipt
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
      `}</style>

      {/* INVOICE SHEET CONTAINER */}
      <div className="w-full max-w-5xl mx-auto bg-white md:rounded-xl md:shadow-xl md:border border-gray-100 min-h-[85vh] flex flex-col">
          
          {/* 1. HEADER: Branding & Customer Info */}
          <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-8 relative z-30">
              
              {/* Left: Branding & Meta */}
              <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold">N</div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">INVOICE</h1>
                    </div>
                    <p className="text-gray-400 text-sm">#{new Date().getTime().toString().slice(-6)}</p>
                  </div>
                  
                  <div className="mt-6 md:mt-0 flex gap-3 relative">
                      <Button variant="neutral" onClick={openHistory} className="!px-3" title="History">
                          <History size={18}/>
                      </Button>
                      {/* Removed MoreVertical (Three Dots) button as requested */}
                  </div>
              </div>

              {/* Right: Customer "Bill To" Box */}
              <div className="flex-1 max-w-md bg-gray-50/50 rounded-xl p-1 relative group">
                  {!selectedCustomer ? (
                      <div className="p-3">
                          <label className="text-xs font-semibold text-black uppercase tracking-wider mb-2 block">Bill To:</label>
                          
                          {/* Search Input */}
                          <div className="relative z-50">
                              <Search className="absolute left-3 top-3 text-gray-400" size={16}/>
                              <input 
                                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                                  placeholder="Type Name or Phone..."
                                  value={customerSearch}
                                  onChange={(e) => {
                                      setCustomerSearch(e.target.value);
                                      setShowCustomerDropdown(true);
                                  }}
                                  onFocus={() => setShowCustomerDropdown(true)}
                              />
                              
                              {/* Dropdown Results */}
                              {showCustomerDropdown && customerSearch && !isNewCustomerMode && (
                                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto z-50">
                                      {filteredCustomers.length > 0 ? (
                                          filteredCustomers.map(c => (
                                              <button 
                                                key={c.id} 
                                                onClick={() => handleCustomerSelect(c)}
                                                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 flex justify-between items-center group"
                                              >
                                                  <div>
                                                      <div className="font-bold text-gray-800 text-sm group-hover:text-blue-700">{c.name}</div>
                                                      <div className="text-xs text-gray-400">{c.phone}</div>
                                                  </div>
                                                  <ChevronRight size={14} className="text-gray-300"/>
                                              </button>
                                          ))
                                      ) : (
                                          <div className="p-3 text-center">
                                              <p className="text-xs text-gray-400 mb-2">No match found</p>
                                              <button 
                                                onClick={() => { setIsNewCustomerMode(true); setShowCustomerDropdown(false); setNewCustPhone(customerSearch); }}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-md transition-colors"
                                              >
                                                  + Create "{customerSearch}"
                                              </button>
                                          </div>
                                      )}
                                      {/* Always show create option at bottom if searched */}
                                      {filteredCustomers.length > 0 && (
                                           <div className="p-2 border-t border-gray-100 bg-gray-50">
                                              <button 
                                                onClick={() => { setIsNewCustomerMode(true); setShowCustomerDropdown(false); setNewCustPhone(customerSearch); }}
                                                className="w-full text-center text-xs font-bold text-blue-600 hover:underline"
                                              >
                                                  + Create New Customer
                                              </button>
                                           </div>
                                      )}
                                  </div>
                              )}
                          </div>

                          {/* New Customer Form (Overlay) */}
                          {isNewCustomerMode && (
                              <div className="absolute top-0 left-0 right-0 z-[60] bg-white rounded-xl shadow-2xl border border-blue-100 p-4 animate-in zoom-in-95">
                                  <div className="flex justify-between items-center mb-4">
                                      <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider">New Customer</h4>
                                      <button onClick={() => setIsNewCustomerMode(false)} className="text-gray-400 hover:text-red-500 p-1"><X size={16}/></button>
                                  </div>
                                  
                                  <div className="space-y-3">
                                      <div>
                                          <label className="block text-[10px] font-bold text-gray-400 mb-1">FULL NAME</label>
                                          <Input 
                                            placeholder="Enter Name" 
                                            className="!py-2 !text-sm !bg-white !border-gray-200" 
                                            value={newCustName} 
                                            onChange={e => setNewCustName(e.target.value)} 
                                            autoFocus 
                                          />
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                          <div>
                                              <label className="block text-[10px] font-bold text-gray-400 mb-1">PHONE</label>
                                              <Input 
                                                placeholder="Number" 
                                                className="!py-2 !text-sm !bg-white !border-gray-200" 
                                                value={newCustPhone} 
                                                onChange={e => setNewCustPhone(e.target.value)} 
                                              />
                                          </div>
                                          <div>
                                              <label className="block text-[10px] font-bold text-gray-400 mb-1">EMAIL</label>
                                              <Input 
                                                placeholder="Optional" 
                                                className="!py-2 !text-sm !bg-white !border-gray-200" 
                                                value={newCustEmail} 
                                                onChange={e => setNewCustEmail(e.target.value)} 
                                              />
                                          </div>
                                      </div>
                                      <div>
                                          <label className="block text-[10px] font-bold text-gray-400 mb-1">ADDRESS</label>
                                          <Input 
                                            placeholder="Location / Address" 
                                            className="!py-2 !text-sm !bg-white !border-gray-200" 
                                            value={newCustAddress} 
                                            onChange={e => setNewCustAddress(e.target.value)} 
                                          />
                                      </div>
                                  </div>

                                  <div className="flex justify-end gap-2 pt-4 border-t border-gray-50 mt-2">
                                      <Button size="sm" variant="neutral" onClick={() => setIsNewCustomerMode(false)}>Cancel</Button>
                                      <Button size="sm" onClick={handleCreateCustomer} className="bg-blue-600 hover:bg-blue-700">Save & Use</Button>
                                  </div>
                              </div>
                          )}
                      </div>
                  ) : (
                      <div className="p-4 relative h-full flex flex-col justify-center">
                          <button 
                            onClick={() => setSelectedCustomer(null)} 
                            className="absolute top-2 right-2 p-1.5 bg-gray-100 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors z-10 shadow-sm"
                            title="Remove Customer"
                          >
                              <X size={16} />
                          </button>
                          
                          <label className="text-xs font-semibold text-black uppercase tracking-wider mb-2 block">Bill To:</label>
                          <div className="font-bold text-xl text-gray-900 leading-tight pr-6">{selectedCustomer.name}</div>
                          
                          <div className="mt-3 space-y-1 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                  <Phone size={12} className="text-gray-400"/> {selectedCustomer.phone}
                              </div>
                              {selectedCustomer.email && (
                                  <div className="flex items-center gap-2">
                                      <Mail size={12} className="text-gray-400"/> {selectedCustomer.email}
                                  </div>
                              )}
                              <div className="flex items-start gap-2 pt-1">
                                  <MapPin size={12} className="text-gray-400 mt-0.5"/> 
                                  <span className="leading-snug max-w-[200px]">{selectedCustomer.location || 'No Address Provided'}</span>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </div>

          {/* 2. ACTIONS BAR */}
          <div className="px-6 py-4 flex flex-col sm:flex-row gap-3 border-b border-gray-100 bg-white sticky top-0 z-20 shadow-sm">
               <div className="flex-1 flex gap-2">
                    <button 
                        onClick={() => {
                            setShowProductLookup(true);
                            setIsCreatingProduct(false); // Default to search
                        }}
                        className="flex-1 sm:flex-none px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center gap-2 text-sm shadow-md shadow-blue-100"
                    >
                        <Plus size={18}/> Add Item
                    </button>
                    <button 
                        onClick={() => setShowScanner(true)}
                        className="flex-1 sm:flex-none px-6 py-2.5 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-200 transition-all flex items-center justify-center gap-2 text-sm shadow-md shadow-purple-100"
                    >
                        <Scan size={18}/> Scan
                    </button>
               </div>
          </div>

          {/* Mobile Header Row */}
          <div className="md:hidden grid grid-cols-[1fr_100px_60px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider sticky top-[73px] z-10">
               <div>Item Details</div>
               <div className="text-center">Qty / Rate</div>
               <div className="text-right">Total</div>
          </div>

          {/* 3. INVOICE ITEMS (Scrollable Body) */}
          <div className="flex-1 overflow-y-auto min-h-[400px]">
              {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300 py-20">
                      <ShoppingCart size={48} className="mb-4 opacity-20"/>
                      <p className="font-medium">No items added yet</p>
                  </div>
              ) : (
                  <div className="w-full">
                      {/* Desktop Header */}
                      <div className="hidden md:grid grid-cols-[40px_2fr_100px_100px_100px_120px_50px] gap-4 px-8 py-3 bg-gray-50/50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          <div className="text-center">#</div>
                          <div>Item Details</div>
                          <div className="text-right">Price</div>
                          <div className="text-center">Qty</div>
                          <div className="text-center">Disc</div>
                          <div className="text-right">Total</div>
                          <div></div>
                      </div>

                      {/* Items */}
                      <div className="divide-y divide-gray-50">
                          {cart.map((item, index) => {
                             const lineTotal = ((item.customPrice ?? item.sellPrice) * item.quantity) - item.discount;
                             return (
                                 <React.Fragment key={item.id}>
                                     {/* Desktop Row */}
                                     <div className="hidden md:grid grid-cols-[40px_2fr_100px_100px_100px_120px_50px] gap-4 items-center px-8 py-4 hover:bg-gray-50/30 transition-colors group">
                                         <div className="text-center text-gray-400 font-medium text-sm">{index + 1}</div>
                                         <div>
                                             <div className="font-bold text-gray-900 text-lg">{item.name}</div>
                                             {item.sku && <div className="text-xs text-gray-400 font-mono mt-0.5">{item.sku}</div>}
                                         </div>
                                         <div className="text-right">
                                             <input 
                                                 type="number"
                                                 className="w-full text-right bg-transparent border-b border-transparent hover:border-gray-200 focus:border-blue-500 outline-none text-base font-bold text-gray-700"
                                                 value={item.customPrice ?? item.sellPrice}
                                                 onChange={(e) => updateCartItem(item.id, 'customPrice', parseFloat(e.target.value) || 0)}
                                                 onWheel={preventWheelChange}
                                             />
                                         </div>
                                         <div className="px-2">
                                             <input 
                                                 type="number"
                                                 className="w-full text-center bg-gray-50 border border-transparent hover:border-gray-200 focus:bg-white focus:border-blue-500 rounded py-1 outline-none text-base font-bold text-gray-800"
                                                 value={item.quantity}
                                                 onChange={(e) => updateCartItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                 onWheel={preventWheelChange}
                                             />
                                         </div>
                                         <div className="px-2">
                                             <input 
                                                 type="number"
                                                 className="w-full text-center bg-transparent border-b border-transparent hover:border-gray-200 focus:border-red-500 outline-none text-sm text-red-500 font-medium placeholder-gray-300"
                                                 placeholder="0"
                                                 value={item.discount || ''}
                                                 onChange={(e) => updateCartItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                                                 onWheel={preventWheelChange}
                                             />
                                         </div>
                                         <div className="text-right font-extrabold text-gray-900 text-lg">
                                             ₹{lineTotal.toFixed(2)}
                                         </div>
                                         <div className="text-right">
                                             <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                                                 <Trash2 size={16}/>
                                             </button>
                                         </div>
                                     </div>

                                     {/* Mobile Row */}
                                     <div className="md:hidden grid grid-cols-[1fr_100px_60px] gap-3 px-4 py-4 border-b border-gray-50 bg-white items-center">
                                          {/* Name */}
                                          <div className="min-w-0 pr-2">
                                              <div className="font-bold text-gray-900 text-base leading-tight truncate">{item.name}</div>
                                              {item.sku && <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">{item.sku}</div>}
                                          </div>
                                          
                                          {/* Qty & Rate (Centered) */}
                                          <div className="flex flex-col items-center justify-center">
                                              <div className="flex items-center bg-gray-900 rounded-md overflow-hidden shadow-sm h-7 w-20 mb-1">
                                                  <span className="text-[9px] text-gray-400 px-1.5 font-medium bg-gray-800 h-full flex items-center border-r border-gray-700">Qty</span>
                                                  <input 
                                                      type="number"
                                                      className="w-full h-full bg-gray-900 text-white font-bold text-center outline-none text-sm"
                                                      value={item.quantity}
                                                      onChange={(e) => updateCartItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                      onWheel={preventWheelChange}
                                                  />
                                              </div>
                                              <div className="text-[10px] text-gray-500 font-medium">
                                                  @ ₹{item.customPrice ?? item.sellPrice}
                                              </div>
                                          </div>

                                          {/* Total & Trash */}
                                          <div className="flex flex-col items-end gap-2">
                                              <div className="font-bold text-gray-900 text-sm">₹{lineTotal.toFixed(0)}</div>
                                              <button onClick={() => removeFromCart(item.id)} className="text-gray-300 p-1 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                                                  <Trash2 size={16} />
                                              </button>
                                          </div>
                                     </div>
                                 </React.Fragment>
                             );
                          })}
                      </div>
                  </div>
              )}
          </div>

          {/* 4. FOOTER: Totals & Checkout */}
          <div className="bg-gray-50 p-6 md:p-8 border-t border-gray-200">
              <div className="flex flex-col md:flex-row gap-8 items-end justify-between">
                  <div className="w-full md:w-auto text-xs text-gray-400 hidden md:block">
                      <p>Thank you for your business.</p>
                      <p>Terms & Conditions apply.</p>
                  </div>

                  <div className="w-full md:w-80 space-y-3">
                      <div className="flex justify-between text-sm text-gray-600">
                          <span>Gross Total</span>
                          <span className="font-medium">₹{totals.gross.toFixed(2)}</span>
                      </div>
                      {/* REORDERED: Discount above Tax */}
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

                      <Button 
                        onClick={() => setShowCheckout(true)} 
                        disabled={cart.length === 0}
                        className="w-full py-4 mt-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg shadow-green-200 disabled:opacity-50 disabled:shadow-none"
                      >
                          Complete Sale
                      </Button>
                  </div>
              </div>
          </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* Product Lookup OR Creation Modal */}
      <Modal 
        isOpen={showProductLookup} 
        onClose={() => {
            setShowProductLookup(false);
            setIsCreatingProduct(false);
        }} 
        title={isCreatingProduct ? "Add New Product" : "Add Item"}
        className={isCreatingProduct ? "!max-w-2xl" : ""}
      >
          {isCreatingProduct ? (
            /* PRODUCT CREATION FORM (Reused from Warehouse) */
            <div className="animate-in fade-in slide-in-from-right-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Product Name</label>
                        <Input 
                            placeholder="Product Name" 
                            value={newProduct.name} 
                            onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                            autoFocus
                            className="!bg-white !border-gray-300"
                        />
                    </div>
                    
                    <div className="md:col-span-2">
                         <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Barcode / SKU</label>
                         <div className="flex w-full">
                            <Input 
                                placeholder="Scan or type" 
                                value={newProduct.sku} 
                                onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                                className="!bg-white !border-gray-300 rounded-r-none"
                            />
                            <button onClick={() => setShowScanner(true)} className="px-3 bg-gray-100 border border-gray-300 border-l-0 rounded-r-lg text-gray-600 hover:bg-gray-200">
                                <Scan size={20}/>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Sell Price</label>
                        <Input 
                            type="number"
                            placeholder="0.00" 
                            value={newProduct.sellPrice || ''} 
                            onChange={e => setNewProduct({...newProduct, sellPrice: parseFloat(e.target.value) || 0})}
                            className="!bg-white !border-gray-300 !text-green-700 !font-bold"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Buy Price</label>
                        <Input 
                            type="number"
                            placeholder="0.00" 
                            value={newProduct.buyPrice || ''} 
                            onChange={e => setNewProduct({...newProduct, buyPrice: parseFloat(e.target.value) || 0})}
                            className="!bg-white !border-gray-300"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Stock Quantity</label>
                        <div className="flex gap-2 items-center">
                            <Input 
                                type="number" 
                                placeholder="Qty" 
                                value={newProduct.stock || ''} 
                                onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})}
                                className="!bg-white !border-gray-300 flex-1"
                            />
                            
                            {/* Simple Batch Calculator */}
                            <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-lg border border-gray-200">
                                <input 
                                    type="number" placeholder="Packs" 
                                    className="w-16 bg-white border border-gray-300 rounded px-2 py-1 text-xs outline-none"
                                    value={batchConfig.packs}
                                    onChange={(e) => handleBatchChange('packs', e.target.value)}
                                />
                                <span className="text-gray-400 text-xs">x</span>
                                <input 
                                    type="number" placeholder="Qty" 
                                    className="w-16 bg-white border border-gray-300 rounded px-2 py-1 text-xs outline-none"
                                    value={batchConfig.perPack}
                                    onChange={(e) => handleBatchChange('perPack', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div>
                         <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Category</label>
                         <select 
                            value={newProduct.tagId || ''} 
                            onChange={(e) => setNewProduct({...newProduct, tagId: e.target.value})}
                            className="w-full rounded-lg px-3 py-2.5 bg-white border-2 border-gray-300 text-gray-900 focus:outline-none focus:border-blue-500"
                        >
                            <option value="">No Category</option>
                            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    <div>
                         <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Unit</label>
                         <select 
                            value={newProduct.unit || 'pcs'} 
                            onChange={e => setNewProduct({...newProduct, unit: e.target.value})} 
                            className="w-full rounded-lg px-3 py-2.5 bg-white border-2 border-gray-300 text-gray-900 focus:outline-none focus:border-blue-500"
                        >
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Low Stock Alert</label>
                        <div className="flex gap-2 items-center">
                            <AlertTriangle size={16} className="text-purple-500"/>
                            <Input 
                                type="number" 
                                placeholder="10" 
                                value={newProduct.lowStockThreshold || ''} 
                                onChange={e => setNewProduct({...newProduct, lowStockThreshold: parseInt(e.target.value) || 0})}
                                className="!bg-white !border-gray-300 flex-1"
                            />
                        </div>
                    </div>
                 </div>

                 <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                     <Button variant="neutral" onClick={() => setIsCreatingProduct(false)}>Cancel</Button>
                     <Button onClick={handleSaveProduct} className="bg-green-600 hover:bg-green-700">Save & Add</Button>
                 </div>
            </div>
          ) : (
            /* DEFAULT: SEARCH LIST */
            <>
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                    <input 
                        autoFocus
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                        placeholder="Search product..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                {/* Create New Trigger */}
                <button 
                    onClick={() => setIsCreatingProduct(true)}
                    className="w-full py-3 mb-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 text-blue-600 font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                >
                    <Plus size={18}/> Create New Product
                </button>

                <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {filteredProducts.map(p => (
                        <button 
                            key={p.id} 
                            onClick={() => addToCart(p)}
                            className="w-full text-left p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all flex justify-between items-center group"
                        >
                            <div>
                                <div className="font-bold text-gray-800">{p.name}</div>
                                <div className="text-xs text-gray-500 group-hover:text-gray-600">{p.stock} in stock</div>
                            </div>
                            <div className="font-bold text-gray-900">₹{p.sellPrice}</div>
                        </button>
                    ))}
                </div>
            </>
          )}
      </Modal>

      {/* Checkout Confirm */}
      <Modal isOpen={showCheckout} onClose={() => setShowCheckout(false)} title="Payment">
        <div className="text-center px-4 pb-4">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-2">₹{totals.net.toFixed(2)}</h2>
            <p className="text-gray-500 text-sm mb-6">Total Amount Due</p>
            
            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-6 border border-gray-100">
                {selectedCustomer && (
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Customer</span>
                        <span className="font-bold text-gray-900">{selectedCustomer.name}</span>
                    </div>
                )}
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Items</span>
                    <span className="font-bold text-gray-900">{cart.length}</span>
                </div>
            </div>

            <div className="mb-6">
                <p className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payment Method</p>
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { id: 'Cash', icon: Banknote },
                        { id: 'UPI', icon: Smartphone },
                        { id: 'Card', icon: CreditCard },
                        { id: 'Pay Later', icon: Clock }
                    ].map(method => (
                        <button
                            key={method.id}
                            onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                            className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${paymentMethod === method.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <method.icon size={20} className="mb-1"/>
                            <span className="text-xs font-bold whitespace-nowrap">{method.id}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => handleCheckout('whatsapp')} className="py-3 font-bold bg-[#25D366] hover:bg-[#128C7E] text-white shadow-[#25D366]/20">
                    <Share2 size={18} className="mr-2 inline"/> WhatsApp
                </Button>
                <Button onClick={() => handleCheckout('save')} variant="neutral" className="py-3 font-bold text-gray-700 bg-gray-100 border-gray-200 hover:bg-gray-200">
                    Save Only
                </Button>
                <Button onClick={() => handleCheckout('print')} className="col-span-2 py-4 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-xl shadow-green-200">
                    <Printer size={20} className="mr-2 inline"/> Confirm & Print
                </Button>
            </div>
        </div>
      </Modal>

      {/* Scanner */}
      <Modal isOpen={showScanner} onClose={() => setShowScanner(false)} title="Scan Barcode">
         <div className="relative bg-black rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center">
             <div id="pos-reader" className="w-full h-full"></div>
             <p className="absolute bottom-4 text-white text-xs bg-black/50 px-2 py-1 rounded z-10">Align barcode within frame</p>
         </div>
      </Modal>

    </div>
  );
};