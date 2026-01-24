
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, Sale, Payment, Tab } from '../types';
import { StoreService } from '../services/storeService';
import { generateInvoicePDF } from '../services/pdfService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
// Added missing ChevronRight import and kept others
import { Search, MapPin, Phone, User, Clock, Pencil, Trash2, Plus, X, Mail, ArrowLeft, Contact, Phone as PhoneIcon, MessageCircle, Share2, AlertTriangle, CheckCircle2, Banknote, CreditCard, Smartphone, Printer, Star, Receipt, ChevronDown, ChevronRight, Wallet, Image as ImageIcon, Upload, Loader2, Eye } from 'lucide-react';

interface CustomersProps {
  initialAction?: string;
  onClearAction?: () => void;
}

export const Customers: React.FC<CustomersProps> = ({ initialAction, onClearAction }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({});
  
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [shakeTrigger, setShakeTrigger] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentNote, setPaymentNote] = useState<string>('');
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [viewingSale, setViewingSale] = useState<Sale | null>(null);

  // --- Navigation Gesture Hook ---
  useEffect(() => {
      const handleNavigationPop = (e: any) => {
          if (showPaymentModal) {
              setShowPaymentModal(false);
              return;
          }
          if (showEditModal) {
              setShowEditModal(false);
              return;
          }
          if (selectedCustomer) {
              setSelectedCustomer(null);
              return;
          }
          if (viewingSale) {
              setViewingSale(null);
              return;
          }
      };
      window.addEventListener('app-navigation-pop' as any, handleNavigationPop);
      return () => window.removeEventListener('app-navigation-pop' as any, handleNavigationPop);
  }, [selectedCustomer, showEditModal, showPaymentModal, viewingSale]);

  const handleSelectCustomer = (c: Customer) => {
      window.history.pushState({ tab: Tab.CUSTOMERS, depth: 1 }, '');
      setSelectedCustomer(c);
  };

  const handleOpenAddModal = () => {
      window.history.pushState({ tab: Tab.CUSTOMERS, depth: 1 }, '');
      setFormData({
          name: '',
          phone: '',
          email: '',
          location: '',
          totalSpent: 0,
          totalDues: 0,
          visitCount: 0,
          history: [],
          payments: [],
          isWholesaler: false
      });
      setShowEditModal(true);
  };

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [showDuesError, setShowDuesError] = useState(false);

  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (initialAction === 'add') {
        handleOpenAddModal();
        if (onClearAction) onClearAction();
    }
  }, [initialAction]);

  const loadData = async () => {
    const cData = await StoreService.getCustomers();
    const sData = await StoreService.getSales();
    setCustomers([...cData]);
    setSales(sData);
  };

  const onTouchStart = (e: React.TouchEvent) => {
      setTouchEnd(null);
      setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchMove = (e: React.TouchEvent) => {
      setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchEndAction = (action: () => void, direction: 'right' | 'down') => {
      if (!touchStart || !touchEnd) return;
      const xDiff = touchStart.x - touchEnd.x;
      const yDiff = touchStart.y - touchEnd.y;
      const absX = Math.abs(xDiff);
      const absY = Math.abs(yDiff);

      if (direction === 'right') {
          if (absX > absY && xDiff < -minSwipeDistance) { action(); }
      } else if (direction === 'down') {
          if (absY > absX && yDiff < -minSwipeDistance) { action(); }
      }
  };

  const handleEditClick = (customer: Customer) => {
    window.history.pushState({ tab: Tab.CUSTOMERS, depth: 1 }, '');
    const cleanPhone = customer.phone.replace(/^\+91\s?/, '');
    setFormData({ ...customer, phone: cleanPhone });
    setValidationErrors(new Set());
    setShowEditModal(true);
  };

  const validateForm = () => {
    const errors = new Set<string>();
    if (!formData.name?.trim()) errors.add('name');
    if (!formData.phone?.trim() && !formData.email?.trim()) { errors.add('phone'); errors.add('email'); }
    setValidationErrors(errors);
    if (errors.size > 0) {
      setShakeTrigger(true);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      setTimeout(() => setShakeTrigger(false), 500);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    let rawPhone = (formData.phone || '').trim();
    let phoneToSave = rawPhone;
    if (rawPhone && !rawPhone.startsWith('+')) {
        phoneToSave = `+91 ${rawPhone}`;
    }
    
    const payload = {
        ...formData,
        phone: phoneToSave,
        history: formData.history || [],
        payments: formData.payments || [],
        totalSpent: formData.totalSpent || 0,
        totalDues: formData.totalDues || 0,
        visitCount: formData.visitCount || 0
    };

    const savedCustomer = await StoreService.upsertCustomer(payload);
    setSearchTerm('');
    setShowEditModal(false);
    
    await loadData();
    setSelectedCustomer(savedCustomer);
    window.history.back();
  };

  const handleDeleteClick = (customer: Customer) => {
      setCustomerToDelete(customer);
      if ((customer.totalDues || 0) > 0) setShowDuesError(true);
      else setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
      if (!customerToDelete) return;
      await StoreService.deleteCustomer(customerToDelete.id);
      setShowDeleteModal(false);
      setCustomerToDelete(null);
      setSelectedCustomer(null);
      loadData();
  };

  const handleShareWhatsApp = (customer: Customer) => {
      const message = `Hello ${customer.name},%0A%0AWe appreciate your business with Noor Store.%0A%0ATotal Spent: ₹${customer.totalSpent.toLocaleString()}%0AVisits: ${customer.visitCount}`;
      const url = `https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}?text=${message}`;
      window.open(url, '_blank');
  };

  const openPaymentModal = (customer: Customer) => {
      setPaymentAmount(customer.totalDues.toString());
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('Cash');
      setPaymentNote('');
      setPaymentReceipt(null);
      window.history.pushState({ tab: Tab.CUSTOMERS, depth: 2 }, '');
      setShowPaymentModal(true);
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setPaymentReceipt(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handleRecordPayment = async () => {
      if (!selectedCustomer || !paymentAmount) return;
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) return;
      setIsProcessingPayment(true);
      try {
        await StoreService.addCustomerPayment(selectedCustomer.id, amount, paymentMethod, paymentNote, paymentDate, paymentReceipt || undefined);
        const updatedCustomers = await StoreService.getCustomers();
        const updatedSelf = updatedCustomers.find(c => c.id === selectedCustomer.id);
        setCustomers(updatedCustomers);
        if (updatedSelf) setSelectedCustomer(updatedSelf);
        setShowPaymentModal(false);
        window.history.back();
      } finally { setIsProcessingPayment(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLInputElement> | null, isSubmit = false) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (isSubmit) handleSave(); else nextRef?.current?.focus();
      }
  };

  const filteredAndSortedCustomers = useMemo(() => {
      return customers
        .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, searchTerm]);

  const renderContacts = () => (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300 relative">
          
          {/* STICKY HEADER AND SEARCH - iOS/Phone Style */}
          <div className="sticky top-0 z-40 bg-[#fdfdfc]/80 backdrop-blur-2xl border-b border-gray-100/50 px-4 pt-4 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center">
                        <Contact size={22} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-950 tracking-tight">Contacts</h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mt-0.5">{customers.length} Entries</p>
                    </div>
                </div>
                {/* Add button removed from here and moved to floating fixed position below */}
              </div>

              <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                        <Search size={20} />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search name or mobile..." 
                        className="w-full bg-white/50 border-2 border-gray-100 rounded-[1.25rem] h-12 pl-12 pr-12 text-base font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500/50 focus:bg-white transition-all shadow-sm focus:shadow-md" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')} 
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 shrink-0"
                        >
                            <X size={18}/>
                        </button>
                    )}
              </div>
          </div>

          <div className="flex-1 flex gap-6 min-h-0 relative px-2">
               {/* Contact List Pane */}
               <div className={`flex-1 overflow-y-auto pr-2 pb-32 pt-2 ${selectedCustomer ? 'hidden md:block' : ''}`}>
                    {filteredAndSortedCustomers.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-200">
                                <User size={40} className="opacity-20"/>
                            </div>
                            <p className="font-bold text-sm tracking-wide uppercase">No results for "{searchTerm}"</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredAndSortedCustomers.map(c => (
                                <div key={c.id} onClick={() => handleSelectCustomer(c)} className={`group p-4 rounded-3xl transition-all cursor-pointer flex items-center gap-4 hover:bg-white hover:shadow-xl hover:shadow-gray-200/50 border-2 ${selectedCustomer?.id === c.id ? 'bg-white border-blue-200 shadow-lg shadow-blue-500/5' : 'bg-transparent border-transparent'}`}>
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 relative transition-transform group-hover:scale-105 ${selectedCustomer?.id === c.id ? 'bg-blue-600 text-white' : 'bg-[#f0f2f5] text-gray-500 shadow-inner'}`}>
                                        {c.name.charAt(0).toUpperCase()}
                                        {c.isWholesaler && (
                                            <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-amber-50">
                                                <Star size={10} className="text-amber-500 fill-amber-500"/>
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex justify-between items-center pr-2">
                                            <span className="font-black text-gray-950 truncate flex items-center gap-2 text-base">{c.name}</span>
                                            {(c.totalDues || 0) > 0 && (
                                                <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 shrink-0 ml-2 whitespace-nowrap uppercase tracking-tighter">
                                                    ₹{c.totalDues}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400 truncate font-bold uppercase tracking-widest mt-0.5">{c.phone}</div>
                                    </div>
                                    <div className="hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                         <div className="p-2 text-blue-500"><ChevronRight size={20}/></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
               </div>

               {/* Right Pane (Desktop only) */}
               <div className="hidden md:block w-1/2 lg:w-2/3 pl-4 border-l border-gray-100 py-4">
                    {selectedCustomer ? renderCustomerDetails(selectedCustomer, false) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-30 select-none">
                            <div className="w-32 h-32 rounded-full border-4 border-dashed border-gray-200 flex items-center justify-center mb-6">
                                <Contact size={64}/>
                            </div>
                            <p className="font-black uppercase tracking-[0.3em] text-xs">Profile Workspace</p>
                        </div>
                    )}
               </div>
          </div>

          {/* FLOATING ACTION BUTTON - Add Contact */}
          {!selectedCustomer && (
              <div className="fixed bottom-24 right-4 z-50 animate-in zoom-in-50 duration-300">
                  <button 
                      onClick={handleOpenAddModal}
                      className="w-14 h-14 bg-white/60 backdrop-blur-xl border border-white/60 text-blue-600 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center rounded-2xl hover:bg-white/80 active:scale-95 transition-all"
                  >
                      <Plus size={32} />
                  </button>
              </div>
          )}
      </div>
  );

  const renderCustomerDetails = (customer: Customer, isMobile: boolean) => {
      const historyItems: Array<{ type: 'sale' | 'payment', date: string, data: Sale | Payment }> = [];
      const customerHistory = customer.history || [];
      const customerPayments = customer.payments || [];

      customerHistory.forEach(saleId => { const sale = sales.find(s => s.id === saleId); if (sale) historyItems.push({ type: 'sale', date: sale.timestamp, data: sale }); });
      customerPayments.forEach(payment => { historyItems.push({ type: 'payment', date: payment.date, data: payment }); });
      
      historyItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return (
      <div className={`h-full bg-white overflow-y-auto ${isMobile ? 'animate-in slide-in-from-bottom-full duration-300' : 'rounded-[2.5rem] border border-gray-100 shadow-xl'}`}>
          <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                  <button onClick={() => { setSelectedCustomer(null); if(isMobile) window.history.back(); }} className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors">{isMobile ? <ArrowLeft size={28} /> : <X size={24} />}</button>
                  <div className="flex gap-2 ml-auto">
                       <button onClick={() => handleEditClick(customer)} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-900 transition-all"><Pencil size={18}/></button>
                       <button onClick={() => handleShareWhatsApp(customer)} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-green-600 transition-all"><MessageCircle size={18}/></button>
                       <button onClick={() => handleDeleteClick(customer)} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all"><Trash2 size={18}/></button>
                  </div>
              </div>
              <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-50 to-purple-600 text-white rounded-[2rem] flex items-center justify-center text-4xl font-black mb-4 shadow-2xl shadow-indigo-100 relative">
                    {customer.name.charAt(0).toUpperCase()} 
                    {customer.isWholesaler && (
                        <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full border border-gray-50 shadow-lg">
                            <Star size={20} className="text-amber-500 fill-amber-500"/>
                        </div>
                    )}
                  </div>
                  <h2 className="text-2xl font-black text-gray-950 flex items-center gap-2">{customer.name}</h2>
                  {customer.isWholesaler && <span className="text-[10px] uppercase font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 mt-2 tracking-widest">Wholesale Tier</span>}
                  
                  <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                       <a href={`tel:${customer.phone}`} className="flex flex-col items-center gap-2 p-3 min-w-[70px] bg-blue-50 rounded-[1.5rem] border border-blue-100 group transition-all active:scale-90">
                           <div className="text-blue-600"><PhoneIcon size={22}/></div>
                           <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Call</span>
                       </a>
                       <button onClick={() => handleShareWhatsApp(customer)} className="flex flex-col items-center gap-2 p-3 min-w-[70px] bg-green-50 rounded-[1.5rem] border-green-100 group transition-all active:scale-90">
                           <div className="text-green-600"><MessageCircle size={22}/></div>
                           <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Chat</span>
                       </button>
                       {(customer.totalDues || 0) > 0 && (
                           <button onClick={() => openPaymentModal(customer)} className="flex flex-col items-center gap-2 p-3 min-w-[70px] bg-emerald-600 rounded-[1.5rem] shadow-xl shadow-emerald-200 group transition-all active:scale-90">
                               <div className="text-white"><Wallet size={22}/></div>
                               <span className="text-[10px] font-black text-white uppercase tracking-widest">Settle</span>
                           </button>
                       )}
                  </div>
              </div>
          </div>
          
          <div className="p-6 space-y-6 pt-0">
              <div className="bg-gray-50/50 rounded-3xl p-6 space-y-5 border border-gray-100">
                   <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-2">Core Identity</h3>
                   <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm"><Phone size={20}/></div>
                       <div><div className="text-base font-black text-gray-950">{customer.phone}</div><div className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Mobile Number</div></div>
                   </div>
                   {customer.email && (
                       <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm"><Mail size={20}/></div>
                           <div><div className="text-base font-black text-gray-950">{customer.email}</div><div className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Contact Email</div></div>
                       </div>
                   )}
                   {customer.location && (
                       <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm"><MapPin size={20}/></div>
                           <div><div className="text-base font-black text-gray-950">{customer.location}</div><div className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Shipment Address</div></div>
                       </div>
                   )}
              </div>

              <div className="bg-white rounded-3xl p-6 border-2 border-gray-50">
                   <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-6">Financial Lifecycle</h3>
                   <div className="grid grid-cols-3 gap-3 mb-8">
                        <div className="text-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <div className="text-[9px] text-gray-400 uppercase font-black mb-1">Lifetime</div>
                            <div className="font-black text-emerald-600 text-lg">₹{customer.totalSpent.toLocaleString()}</div>
                        </div>
                        <div className="text-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <div className="text-[9px] text-gray-400 uppercase font-black mb-1">Visits</div>
                            <div className="font-black text-blue-600 text-lg">{customer.visitCount}</div>
                        </div>
                        <div className="text-center p-4 bg-red-50/30 rounded-2xl border-2 border-red-50 relative overflow-hidden">
                            <div className="text-[9px] text-red-400 uppercase font-black mb-1">Payable</div>
                            <div className="font-black text-red-600 text-lg">₹{customer.totalDues || 0}</div>
                        </div>
                   </div>

                   <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-4 mt-10">Historical Ledger</h3>
                   {historyItems.length > 0 ? (
                       <div className="space-y-3">
                           {historyItems.map((item, idx) => {
                               if (item.type === 'sale') {
                                   const sale = item.data as Sale;
                                   return (
                                       <div key={`sale-${sale.id}`} onClick={() => { window.history.pushState({ tab: Tab.CUSTOMERS, depth: 2 }, ''); setViewingSale(sale); }} className="flex justify-between items-center bg-gray-50/50 p-5 rounded-2xl border border-gray-100 hover:border-blue-200 cursor-pointer transition-all hover:scale-[1.01] shadow-sm">
                                           <div className="flex items-center gap-4">
                                               <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 shadow-inner"><Receipt size={22}/></div>
                                               <div>
                                                   <div className="text-sm font-black text-gray-950">Store Sale <span className="text-[10px] font-bold text-gray-400 ml-2 uppercase tracking-tighter">#{sale.id.slice(0,5)}</span></div>
                                                   <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">{new Date(sale.timestamp).toLocaleDateString()}</div>
                                               </div>
                                           </div>
                                           <div className="text-right">
                                               <div className="text-base font-black text-gray-950">₹{sale.total.toFixed(0)}</div>
                                               <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{sale.items.length} Items</div>
                                           </div>
                                       </div>
                                   );
                               } else {
                                   const payment = item.data as Payment;
                                   return (
                                       <div key={`pay-${payment.id}`} className="flex flex-col bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100 shadow-sm gap-3">
                                           <div className="flex justify-between items-center">
                                               <div className="flex items-center gap-4">
                                                   <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xl shadow-emerald-100 ring-4 ring-white"><CheckCircle2 size={24}/></div>
                                                   <div>
                                                       <div className="text-sm font-black text-emerald-700">Funds Settled</div>
                                                       <div className="text-[10px] text-emerald-600/70 font-black uppercase tracking-widest mt-0.5">{new Date(payment.date).toLocaleDateString()} • {payment.method}</div>
                                                   </div>
                                               </div>
                                               <div className="text-right">
                                                   <div className="text-lg font-black text-emerald-700">-₹{payment.amount.toLocaleString()}</div>
                                                   {payment.note && <div className="text-[9px] text-emerald-500 font-black uppercase truncate max-w-[100px] mt-1">{payment.note}</div>}
                                               </div>
                                           </div>
                                           {payment.receiptImage && (
                                               <button onClick={() => { const win = window.open(""); win?.document.write(`<img src="${payment.receiptImage}" style="max-width:100%; height:auto;" />`); }} className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase bg-white/60 border border-emerald-100 rounded-xl px-4 py-2.5 hover:bg-white transition-colors w-full justify-center">
                                                   <ImageIcon size={16}/> View Ledger Attachment
                                               </button>
                                           )}
                                       </div>
                                   );
                               }
                           })}
                       </div>
                   ) : (
                       <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-3xl">
                           <Receipt size={32} className="mx-auto text-gray-200 mb-3"/>
                           <p className="text-gray-300 text-[10px] font-black uppercase tracking-[0.3em]">Vault Empty</p>
                       </div>
                   )}
              </div>
          </div>
          <div className="p-8 text-center text-gray-300 text-[10px] font-black uppercase tracking-[0.2em]">End of Profile Lifecycle</div>
      </div>
      );
  };

  return (
    <div className="flex flex-col h-full pb-20 animate-in fade-in">
      <style>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .shake-element { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      <div className="flex-1 min-h-0 relative">
          {renderContacts()}
      </div>

      {selectedCustomer && (
          <div className="md:hidden fixed inset-0 z-[60] bg-[#fdfdfc] animate-in slide-in-from-bottom-10 duration-300" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => onTouchEndAction(() => { setSelectedCustomer(null); window.history.back(); }, 'right')}>
              {renderCustomerDetails(selectedCustomer, true)}
          </div>
      )}

      <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); window.history.back(); }} title={formData.id ? 'Edit Contact' : 'Create Contact'}>
         <div className={`space-y-4 ${shakeTrigger ? 'shake-element' : ''}`}>
             <div className="flex justify-center mb-4"><div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center border-2 border-dashed border-gray-200 text-gray-400 relative"><User size={32}/>{formData.isWholesaler && <Star className="absolute -bottom-1 -right-1 text-amber-500 fill-amber-500 bg-white rounded-full p-1 shadow-md border border-gray-100" size={20}/>}</div></div>
             <div><label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 ${validationErrors.has('name') ? 'text-red-500' : 'text-gray-400'}`}>Full Name *</label><div className={`flex items-center border-b-2 transition-colors bg-gray-50 rounded-t-xl px-3 ${validationErrors.has('name') ? 'border-red-500 bg-red-50' : 'border-gray-100 focus-within:border-blue-500'}`}><User size={18} className={validationErrors.has('name') ? 'text-red-400' : 'text-gray-400 mr-2'}/><input ref={nameRef} onKeyDown={(e) => handleKeyDown(e, phoneRef)} className="w-full py-3 bg-transparent outline-none text-gray-950 font-bold placeholder-gray-300" placeholder="e.g. John Doe" value={formData.name || ''} onChange={e => { setFormData({...formData, name: e.target.value}); if (validationErrors.has('name')) { setValidationErrors(prev => { const n = new Set(prev); n.delete('name'); return n; }); } }} /></div></div>
             <div><label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 ${validationErrors.has('phone') ? 'text-red-500' : 'text-gray-400'}`}>Phone Number {validationErrors.has('phone') && '(Requires Phone or Email)'}</label><div className={`flex items-center border-b-2 transition-colors bg-gray-50 rounded-t-xl px-3 ${validationErrors.has('phone') ? 'border-red-500 bg-red-50' : 'border-gray-100 focus-within:border-blue-500'}`}><Phone size={18} className={validationErrors.has('phone') ? 'text-red-400' : 'text-gray-400 mr-2'}/><input ref={phoneRef} onKeyDown={(e) => handleKeyDown(e, emailRef)} className="w-full py-3 bg-transparent outline-none text-gray-950 font-bold placeholder-gray-300" placeholder="Mobile Number" value={formData.phone || ''} onChange={e => { const val = e.target.value.replace(/\D/g, ''); setFormData({...formData, phone: val}); if (validationErrors.has('phone') || validationErrors.has('email')) { setValidationErrors(prev => { const n = new Set(prev); n.delete('phone'); n.delete('email'); return n; }); } }} maxLength={10} /></div></div>
             <div><label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 ${validationErrors.has('email') ? 'text-red-500' : 'text-gray-400'}`}>Email Address {validationErrors.has('email') && '(Requires Phone or Email)'}</label><div className={`flex items-center border-b-2 transition-colors bg-gray-50 rounded-t-xl px-3 ${validationErrors.has('email') ? 'border-red-500 bg-red-50' : 'border-gray-100 focus-within:border-blue-500'}`}><Mail size={18} className={validationErrors.has('email') ? 'text-red-400' : 'text-gray-400 mr-2'}/><input ref={emailRef} onKeyDown={(e) => handleKeyDown(e, addressRef)} className="w-full py-3 bg-transparent outline-none text-gray-950 font-bold placeholder-gray-300" placeholder="Optional if Phone is added" value={formData.email || ''} onChange={e => { setFormData({...formData, email: e.target.value}); if (validationErrors.has('phone') || validationErrors.has('email')) { setValidationErrors(prev => { const n = new Set(prev); n.delete('phone'); n.delete('email'); return n; }); } }} /></div></div>
             <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Billing Address</label><div className="flex items-center border-b-2 border-gray-100 focus-within:border-blue-500 transition-colors bg-gray-50 rounded-t-xl px-3"><MapPin size={18} className="text-gray-400 mr-2"/><input ref={addressRef} onKeyDown={(e) => handleKeyDown(e, null, true)} className="w-full py-3 bg-transparent outline-none text-gray-950 font-bold placeholder-gray-300" placeholder="City, Area (Optional)" value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})} /></div></div>
             <div className="pt-2"><label className="flex items-center gap-4 p-4 border-2 border-gray-50 rounded-2xl cursor-pointer hover:bg-amber-50/30 hover:border-amber-100 transition-all group"><div className="relative flex items-center"><input type="checkbox" className="w-5 h-5 accent-amber-500" checked={!!formData.isWholesaler} onChange={(e) => setFormData({...formData, isWholesaler: e.target.checked})}/></div><div className="flex-1"><div className="font-black text-gray-900 text-sm flex items-center gap-2">Wholesale Tier <Star size={14} className="text-amber-500 fill-amber-500"/></div><div className="text-[10px] text-gray-500 font-bold uppercase">Enable wholesale rates automatically in POS</div></div></label></div>
             <div className="flex justify-end pt-4"><Button className="w-full py-4 font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-100 rounded-2xl" onClick={handleSave}>Save Contact</Button></div>
         </div>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Contact">
          <div className="text-center py-4"><div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={32} /></div><h3 className="text-lg font-bold text-gray-900 mb-2">Delete {customerToDelete?.name}?</h3><p className="text-sm text-gray-500 mb-6 px-4">This will permanently remove this customer from your contacts.</p><div className="flex gap-3"><Button variant="neutral" className="flex-1" onClick={() => setShowDeleteModal(false)}>Cancel</Button><Button variant="danger" className="flex-1" onClick={confirmDelete}>Delete Contact</Button></div></div>
      </Modal>
      <Modal isOpen={showDuesError} onClose={() => setShowDuesError(false)} title="Cannot Delete Contact">
          <div className="text-center py-4"><div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div><h3 className="text-lg font-bold text-gray-900 mb-2">Outstanding Dues</h3><p className="text-sm text-gray-500 mb-6 px-4">{customerToDelete?.name} has outstanding dues of ₹{customerToDelete?.totalDues}. Please clear the dues before deleting.</p><Button className="w-full" onClick={() => setShowDuesError(false)}>Okay</Button></div>
      </Modal>

      <Modal isOpen={showPaymentModal} onClose={() => { setShowPaymentModal(false); window.history.back(); }} title="Record Payment">
          <div className="space-y-4">
              <div className="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-100 text-center mb-2"><span className="text-[10px] text-emerald-600 uppercase font-black tracking-widest block mb-1">Unpaid Balance</span><span className="text-3xl font-black text-emerald-800">₹{selectedCustomer?.totalDues || 0}</span></div>
              <div className="flex flex-col gap-5">
                  <div className="bg-white border-2 border-gray-50 rounded-2xl p-4 shadow-sm">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Settlement Amount</label>
                      <div className="flex items-center relative"><span className="absolute left-4 text-emerald-600 font-black text-xl">₹</span><Input type="number" className="pl-10 text-2xl font-black !bg-white border-2 border-emerald-100 focus:border-emerald-500 shadow-sm !py-4 rounded-xl" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" onWheel={(e) => e.currentTarget.blur()}/></div>
                  </div>
                  <div className="bg-white border-2 border-gray-50 rounded-2xl p-4 shadow-sm">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Proof of Payment</label>
                      <input type="file" ref={receiptInputRef} onChange={handleReceiptUpload} className="hidden" accept="image/*"/>
                      <div className="flex flex-col gap-3">
                          <button 
                            onClick={() => receiptInputRef.current?.click()} 
                            className={`w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed rounded-xl transition-all ${paymentReceipt ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-blue-400 hover:text-blue-500'}`}
                          >
                            {paymentReceipt ? <CheckCircle2 size={24}/> : <ImageIcon size={24}/>}
                            <span className="text-sm font-black uppercase tracking-wider">{paymentReceipt ? 'Receipt Captured' : 'Upload Receipt Proof'}</span>
                          </button>
                          {paymentReceipt && <div className="relative group w-24 h-24 mx-auto rounded-lg overflow-hidden border border-emerald-200 shadow-sm bg-gray-50 flex items-center justify-center"><img src={paymentReceipt} className="w-full h-full object-cover" alt="Preview" /><button onClick={() => setPaymentReceipt(null)} className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={20}/></button></div>}
                      </div>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Receipt Date</label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="rounded-xl border-2 border-gray-100"/></div>
                  <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Payment Type</label><div className="relative"><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-xl border-2 border-gray-100 py-2.5 px-3 bg-gray-50 text-sm font-bold focus:outline-none focus:border-blue-500 appearance-none"><option value="Cash">Cash</option><option value="UPI">UPI / GPay</option><option value="Card">Bank Card</option></select><ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none"/></div></div>
              </div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Note (Optional)</label><Input placeholder="e.g. Cleared full balance" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} className="rounded-xl border-2 border-gray-100"/></div>
              <div className="flex gap-3 pt-6 border-t border-gray-50"><Button variant="neutral" className="flex-1 py-4 font-bold border-2 border-gray-100" onClick={() => { setShowPaymentModal(false); window.history.back(); }} disabled={isProcessingPayment}>Discard</Button><Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-4 font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-100 flex justify-center items-center gap-2" onClick={handleRecordPayment} disabled={isProcessingPayment}>{isProcessingPayment ? <Loader2 size={20} className="animate-spin" /> : <><CheckCircle2 size={18}/> Settle Dues</>}</Button></div>
          </div>
      </Modal>

      <Modal isOpen={!!viewingSale} onClose={() => { setViewingSale(null); window.history.back(); }} title="Transaction Summary">
        {viewingSale && (
            <div className="space-y-6">
                <div className="flex justify-between items-start border-b border-gray-100 pb-4"><div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Document No.</p><p className="font-mono font-black text-gray-900 text-lg">#{viewingSale.id.slice(0,10).toUpperCase()}</p></div><div className="text-right"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Billing Date</p><p className="text-sm font-bold text-gray-950">{new Date(viewingSale.timestamp).toLocaleDateString()}</p></div></div>
                <div className="bg-gray-50 rounded-2xl p-4 max-h-60 overflow-y-auto border border-gray-100 shadow-inner"><div className="space-y-1">{viewingSale.items.map((item, idx) => (<div key={idx} className="flex justify-between items-center py-2 border-b border-gray-200/50 last:border-0 text-sm"><div className="min-w-0 flex-1 pr-4"><span className="font-black text-gray-800 truncate block">{item.name}</span><div className="text-[10px] text-gray-500 font-bold uppercase">{item.quantity} {item.unit || 'pcs'} @ ₹{item.sellPrice.toFixed(0)}</div></div><span className="font-black text-gray-950 shrink-0">₹{(item.quantity * item.sellPrice).toFixed(0)}</span></div>))}</div></div>
                <div className="space-y-2 pt-2 bg-gray-50/50 p-4 rounded-2xl border border-gray-100"><div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider"><span>Subtotal</span><span>₹{viewingSale.subtotal.toFixed(0)}</span></div><div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider"><span>Tax</span><span>₹{viewingSale.tax.toFixed(0)}</span></div><div className="flex justify-between text-xl font-black text-gray-950 border-t border-gray-200 pt-3 mt-2"><span>Total Paid</span><span className="text-emerald-600">₹{viewingSale.total.toFixed(0)}</span></div><div className="flex justify-between text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mt-2"><span>Method: {viewingSale.paymentMethod || 'Cash'}</span><span>Auth: Verified</span></div></div>
                <div className="flex gap-3 mt-4"><Button variant="neutral" className="flex-1 py-3 font-bold border-2 border-gray-200" onClick={() => { setViewingSale(null); window.history.back(); }}>Dismiss</Button><Button className="flex-1 flex items-center justify-center gap-3 py-3 font-black uppercase tracking-widest bg-gray-900 rounded-2xl shadow-xl shadow-gray-100 active:scale-95" onClick={() => generateInvoicePDF(viewingSale)}><Printer size={18}/> Print Bill</Button></div>
            </div>
        )}
      </Modal>
    </div>
  );
};
