
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, Sale, Payment } from '../types';
import { StoreService } from '../services/storeService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Search, MapPin, Phone, User, Clock, Pencil, Trash2, Plus, X, Mail, ArrowLeft, Contact, Phone as PhoneIcon, MessageCircle, Share2, AlertTriangle, CheckCircle2, Banknote, CreditCard, Smartphone } from 'lucide-react';

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

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentNote, setPaymentNote] = useState<string>('');

  // Input Refs for Enter Key Navigation
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [showDuesError, setShowDuesError] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Handle Initial Actions (from Dashboard)
  useEffect(() => {
    if (initialAction === 'add') {
        handleAddClick();
        if (onClearAction) onClearAction();
    }
  }, [initialAction]);

  // Focus Name input when modal opens
  useEffect(() => {
      if (showEditModal) {
          setTimeout(() => {
              nameRef.current?.focus();
          }, 100);
      }
  }, [showEditModal]);

  const loadData = async () => {
    const cData = await StoreService.getCustomers();
    const sData = await StoreService.getSales();
    setCustomers([...cData]);
    setSales(sData);
  };

  const handleEditClick = (customer: Customer) => {
    const cleanPhone = customer.phone.replace(/^\+91\s?/, '');
    setFormData({ ...customer, phone: cleanPhone });
    setShowEditModal(true);
  };

  const handleAddClick = () => {
      setFormData({});
      setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;
    
    let phoneToSave = formData.phone || '';
    if (phoneToSave && !phoneToSave.startsWith('+')) {
        phoneToSave = `+91 ${phoneToSave}`;
    }

    const savedCustomer = await StoreService.upsertCustomer({
        ...formData,
        phone: phoneToSave
    });
    
    setShowEditModal(false);
    await loadData();
    setSelectedCustomer(savedCustomer);
  };

  const handleDeleteClick = (customer: Customer) => {
      if ((customer.totalDues || 0) > 0) {
          setCustomerToDelete(customer);
          setShowDuesError(true);
          return;
      }
      setCustomerToDelete(customer);
      setShowDeleteModal(true);
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

  // --- Payment Handlers ---
  const openPaymentModal = (customer: Customer) => {
      setPaymentAmount(customer.totalDues.toString());
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('Cash');
      setPaymentNote('');
      setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
      if (!selectedCustomer || !paymentAmount) return;
      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0) {
          alert("Please enter a valid amount");
          return;
      }

      await StoreService.addCustomerPayment(
          selectedCustomer.id,
          amount,
          paymentMethod,
          paymentNote,
          paymentDate // Pass the selected date
      );

      // Refresh Data
      const updatedCustomers = await StoreService.getCustomers();
      const updatedSelf = updatedCustomers.find(c => c.id === selectedCustomer.id);
      
      setCustomers(updatedCustomers);
      if (updatedSelf) setSelectedCustomer(updatedSelf);
      
      setShowPaymentModal(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLInputElement> | null, isSubmit = false) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (isSubmit) {
              handleSave();
          } else {
              nextRef?.current?.focus();
          }
      }
  };

  const filteredAndSortedCustomers = useMemo(() => {
      return customers
        .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, searchTerm]);

  // --- RENDER COMPONENTS ---

  const renderContacts = () => (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 px-1 pt-2">
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20">
                <Contact size={24} />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Contacts</h2>
                <p className="text-gray-500">Manage your customers</p>
            </div>
          </div>

          {/* Google-Style Search Bar */}
          <div className="relative w-full max-w-2xl mx-auto z-20 mb-4">
              <div className="relative group">
                <div className="relative flex items-center bg-white rounded-full shadow-sm transition-shadow duration-300 border border-gray-200 h-12 px-4 focus-within:shadow-md focus-within:border-blue-300">
                    <Search className="text-gray-400 mr-3 shrink-0" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search contacts" 
                        className="w-full bg-transparent border-none focus:ring-0 text-base text-gray-700 placeholder-gray-400 h-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="p-2 text-gray-400 hover:text-gray-600 shrink-0">
                            <X size={18}/>
                        </button>
                    )}
                </div>
              </div>
          </div>

          <div className="flex-1 flex gap-6 min-h-0 relative">
               {/* Contact List */}
               <div className={`flex-1 overflow-y-auto pr-2 pb-24 ${selectedCustomer ? 'hidden md:block' : ''}`}>
                    {filteredAndSortedCustomers.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <User size={48} className="mx-auto mb-2 opacity-20"/>
                            <p>No customers found.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredAndSortedCustomers.map(c => (
                                <div 
                                    key={c.id} 
                                    onClick={() => setSelectedCustomer(c)}
                                    className={`group p-3 rounded-full md:rounded-xl transition-all cursor-pointer flex items-center gap-4 hover:bg-gray-100
                                        ${selectedCustomer?.id === c.id ? 'bg-blue-50 border border-blue-100' : 'bg-transparent border border-transparent'}
                                    `}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0
                                        ${selectedCustomer?.id === c.id ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}
                                    `}>
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex justify-between items-center pr-2">
                                            <span className="font-medium text-gray-900 truncate">{c.name}</span>
                                            {(c.totalDues || 0) > 0 && (
                                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 shrink-0 ml-2 whitespace-nowrap">
                                                    Due: ₹{c.totalDues}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">{c.phone}</div>
                                    </div>
                                    {/* Quick Actions (Desktop Hover) */}
                                    <div className="hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                                         <button onClick={(e) => {e.stopPropagation(); handleEditClick(c)}} className="p-2 hover:bg-white rounded-full text-gray-500"><Pencil size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
               </div>
               
               {/* Detail View (Desktop) - Hidden on Mobile unless handled separately */}
               <div className="hidden md:block w-1/2 lg:w-2/3 pl-4 border-l border-gray-100">
                    {selectedCustomer ? renderCustomerDetails(selectedCustomer, false) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                             <Contact size={64} className="opacity-10 mb-4"/>
                             <p>Select a contact to view details</p>
                        </div>
                    )}
               </div>
          </div>
      </div>
  );

  const renderCustomerDetails = (customer: Customer, isMobile: boolean) => {
      // Merge Sales and Payments for unified history
      const historyItems: Array<{ type: 'sale' | 'payment', date: string, data: Sale | Payment }> = [];
      
      // Add Sales
      customer.history.forEach(saleId => {
          const sale = sales.find(s => s.id === saleId);
          if (sale) {
              historyItems.push({ type: 'sale', date: sale.timestamp, data: sale });
          }
      });

      // Add Payments
      if (customer.payments) {
          customer.payments.forEach(payment => {
              historyItems.push({ type: 'payment', date: payment.date, data: payment });
          });
      }

      // Sort Descending
      historyItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return (
      <div className={`h-full bg-white overflow-y-auto ${isMobile ? 'animate-in slide-in-from-bottom-full duration-300' : 'rounded-2xl border border-gray-100 shadow-sm'}`}>
          {/* Header */}
          <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                  <button onClick={() => setSelectedCustomer(null)} className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                      {isMobile ? <ArrowLeft size={24} /> : <X size={24} />}
                  </button>
                  <div className="flex gap-2 ml-auto">
                       <button onClick={() => handleEditClick(customer)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><Pencil size={18}/></button>
                       <button onClick={() => handleShareWhatsApp(customer)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><Share2 size={18}/></button>
                       <button onClick={() => handleDeleteClick(customer)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><Trash2 size={18}/></button>
                  </div>
              </div>

              <div className="flex flex-col items-center text-center">
                  {/* Compact Avatar */}
                  <div className="w-20 h-20 bg-purple-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mb-3 shadow-sm">
                       {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
                  
                  {/* Compact Action Chips */}
                  <div className="flex items-center gap-3 mt-3">
                       <a href={`tel:${customer.phone}`} className="flex flex-col items-center gap-1 p-2 min-w-[70px] hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
                           <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-100 flex items-center justify-center"><PhoneIcon size={18}/></div>
                           <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Call</span>
                       </a>
                       <button onClick={() => handleShareWhatsApp(customer)} className="flex flex-col items-center gap-1 p-2 min-w-[70px] hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
                           <div className="w-9 h-9 rounded-full bg-green-50 text-green-600 group-hover:bg-green-100 flex items-center justify-center"><MessageCircle size={18}/></div>
                           <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Chat</span>
                       </button>
                       {customer.email && (
                            <a href={`mailto:${customer.email}`} className="flex flex-col items-center gap-1 p-2 min-w-[70px] hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
                                <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 group-hover:bg-red-100 flex items-center justify-center"><Mail size={18}/></div>
                                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Email</span>
                            </a>
                       )}
                  </div>
              </div>
          </div>

          {/* Details Body */}
          <div className="p-4 space-y-4 pt-0">
              <div className="bg-gray-50 rounded-2xl p-4 space-y-4">
                   <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Contact Info</h3>
                   <div className="flex items-center gap-4">
                       <Phone size={20} className="text-gray-400"/>
                       <div>
                           <div className="text-sm font-medium text-gray-900">{customer.phone}</div>
                           <div className="text-xs text-gray-500">Mobile</div>
                       </div>
                   </div>
                   {customer.email && (
                       <div className="flex items-center gap-4">
                           <Mail size={20} className="text-gray-400"/>
                           <div>
                               <div className="text-sm font-medium text-gray-900">{customer.email}</div>
                               <div className="text-xs text-gray-500">Email</div>
                           </div>
                       </div>
                   )}
                   {customer.location && (
                       <div className="flex items-center gap-4">
                           <MapPin size={20} className="text-gray-400"/>
                           <div>
                               <div className="text-sm font-medium text-gray-900">{customer.location}</div>
                               <div className="text-xs text-gray-500">Address</div>
                           </div>
                       </div>
                   )}
              </div>

              <div className="bg-gray-50 rounded-2xl p-4">
                   <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Financials</h3>
                   <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center p-2 bg-white rounded-xl shadow-sm border border-gray-100">
                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Spent</div>
                            <div className="font-bold text-green-600">₹{customer.totalSpent.toLocaleString()}</div>
                        </div>
                        <div className="text-center p-2 bg-white rounded-xl shadow-sm border border-gray-100">
                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Visits</div>
                            <div className="font-bold text-blue-600">{customer.visitCount}</div>
                        </div>
                        <div className="text-center p-2 bg-white rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Dues</div>
                            <div className="font-bold text-red-500">₹{customer.totalDues || 0}</div>
                            {(customer.totalDues || 0) > 0 && (
                                <button 
                                    onClick={() => openPaymentModal(customer)}
                                    className="mt-1 w-full bg-red-100 text-red-700 text-[10px] font-bold py-1 rounded hover:bg-red-200 transition-colors"
                                >
                                    PAY
                                </button>
                            )}
                        </div>
                   </div>
                   
                   <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 mt-6">Timeline</h3>
                   {historyItems.length > 0 ? (
                       <div className="space-y-3">
                           {historyItems.map((item, idx) => {
                               if (item.type === 'sale') {
                                   const sale = item.data as Sale;
                                   return (
                                       <div key={`sale-${sale.id}`} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100">
                                           <div className="flex items-center gap-3">
                                               <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                                                   <Clock size={16}/>
                                               </div>
                                               <div>
                                                   <div className="text-sm font-bold text-gray-800">
                                                       Sale 
                                                       <span className="text-xs font-normal text-gray-400 ml-1">#{sale.id.slice(0,5).toUpperCase()}</span>
                                                   </div>
                                                   <div className="text-[10px] text-gray-500">{new Date(sale.timestamp).toLocaleDateString()}</div>
                                               </div>
                                           </div>
                                           <div className="text-right">
                                               <div className="text-sm font-bold text-gray-800">₹{sale.total.toFixed(0)}</div>
                                               <div className="text-[10px] text-gray-400">{sale.items.length} Items</div>
                                           </div>
                                       </div>
                                   );
                               } else {
                                   const payment = item.data as Payment;
                                   return (
                                       <div key={`pay-${payment.id}`} className="flex justify-between items-center bg-white p-3 rounded-xl border border-green-100 shadow-sm">
                                           <div className="flex items-center gap-3">
                                               <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center text-green-600">
                                                   <CheckCircle2 size={16}/>
                                               </div>
                                               <div>
                                                   <div className="text-sm font-bold text-green-700">Payment Received</div>
                                                   <div className="text-[10px] text-gray-500">{new Date(payment.date).toLocaleDateString()} • {payment.method}</div>
                                               </div>
                                           </div>
                                           <div className="text-right">
                                               <div className="text-sm font-bold text-green-600">-₹{payment.amount.toLocaleString()}</div>
                                               {payment.note && <div className="text-[10px] text-gray-400 italic max-w-[80px] truncate">{payment.note}</div>}
                                           </div>
                                       </div>
                                   );
                               }
                           })}
                       </div>
                   ) : (
                       <p className="text-center text-gray-400 text-sm py-4">No history yet.</p>
                   )}
              </div>
          </div>
      </div>
      );
  };

  return (
    <div className="flex flex-col h-full pb-20 animate-in fade-in">
      <style>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
      
      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative">
          {renderContacts()}
      </div>

      {/* Floating Action Button (FAB) */}
      <button 
         onClick={handleAddClick}
         className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-xl flex items-center justify-center z-40 transition-transform active:scale-95 hover:bg-blue-700 hover:scale-105"
         style={{ boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)' }}
       >
         <Plus size={28} />
      </button>

      {/* Mobile Detail View Overlay */}
      {selectedCustomer && (
          <div className="md:hidden fixed inset-0 z-50 bg-white animate-in slide-in-from-bottom-10 duration-200">
               {renderCustomerDetails(selectedCustomer, true)}
          </div>
      )}

      {/* Edit/Add Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={formData.id ? 'Edit Contact' : 'Create Contact'}>
         <div className="space-y-4">
             <div className="flex justify-center mb-4">
                 <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300 text-gray-400">
                     <User size={32}/>
                 </div>
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Full Name</label>
                <div className="flex items-center border-b border-gray-300 focus-within:border-blue-500 transition-colors">
                     <User size={18} className="text-gray-400 mr-2"/>
                     <input 
                        ref={nameRef}
                        onKeyDown={(e) => handleKeyDown(e, phoneRef)}
                        className="w-full py-2 bg-transparent outline-none text-gray-900 placeholder-gray-400"
                        placeholder="Name"
                        value={formData.name || ''} 
                        onChange={e => setFormData({...formData,name: e.target.value})} 
                     />
                </div>
             </div>

             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Phone</label>
                <div className="flex items-center border-b border-gray-300 focus-within:border-blue-500 transition-colors">
                     <Phone size={18} className="text-gray-400 mr-2"/>
                     <input 
                        ref={phoneRef}
                        onKeyDown={(e) => handleKeyDown(e, emailRef)}
                        className="w-full py-2 bg-transparent outline-none text-gray-900 placeholder-gray-400"
                        placeholder="Phone Number"
                        value={formData.phone || ''} 
                        onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            setFormData({...formData, phone: val});
                        }}
                        maxLength={10}
                     />
                </div>
             </div>
             
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Email</label>
                <div className="flex items-center border-b border-gray-300 focus-within:border-blue-500 transition-colors">
                     <Mail size={18} className="text-gray-400 mr-2"/>
                     <input 
                        ref={emailRef}
                        onKeyDown={(e) => handleKeyDown(e, addressRef)}
                        className="w-full py-2 bg-transparent outline-none text-gray-900 placeholder-gray-400"
                        placeholder="Email (Optional)"
                        value={formData.email || ''} 
                        onChange={e => setFormData({...formData, email: e.target.value})} 
                     />
                </div>
             </div>

             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Address</label>
                <div className="flex items-center border-b border-gray-300 focus-within:border-blue-500 transition-colors">
                     <MapPin size={18} className="text-gray-400 mr-2"/>
                     <input 
                        ref={addressRef}
                        onKeyDown={(e) => handleKeyDown(e, null, true)}
                        className="w-full py-2 bg-transparent outline-none text-gray-900 placeholder-gray-400"
                        placeholder="Location (Optional)"
                        value={formData.location || ''} 
                        onChange={e => setFormData({...formData, location: e.target.value})} 
                     />
                </div>
             </div>
             
             <div className="flex justify-end pt-4">
                 <Button className="w-full" onClick={handleSave}>Save</Button>
             </div>
         </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Contact">
          <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete {customerToDelete?.name}?</h3>
              <p className="text-sm text-gray-500 mb-6 px-4">
                  This will permanently remove this customer from your contacts. Their purchase history will still be preserved in sales records.
              </p>
              <div className="flex gap-3">
                  <Button variant="neutral" className="flex-1" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                  <Button variant="danger" className="flex-1" onClick={confirmDelete}>Delete Contact</Button>
              </div>
          </div>
      </Modal>

      {/* Dues Error Modal */}
      <Modal isOpen={showDuesError} onClose={() => setShowDuesError(false)} title="Cannot Delete Contact">
          <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Outstanding Dues</h3>
              <p className="text-sm text-gray-500 mb-6 px-4">
                  {customerToDelete?.name} has outstanding dues of ₹{customerToDelete?.totalDues}. Please clear the dues before deleting this contact.
              </p>
              <Button className="w-full" onClick={() => setShowDuesError(false)}>Okay</Button>
          </div>
      </Modal>

      {/* Record Payment Modal */}
      <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment">
          <div className="space-y-4">
              <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-center mb-4">
                  <span className="text-xs text-green-700 uppercase font-bold tracking-wider block mb-1">Current Due</span>
                  <span className="text-2xl font-bold text-green-800">₹{selectedCustomer?.totalDues || 0}</span>
              </div>

              <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Payment Amount</label>
                  <div className="flex items-center relative">
                      <span className="absolute left-3 text-gray-500 font-bold">₹</span>
                      <Input 
                          type="number"
                          className="pl-8 text-lg font-bold !bg-white"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="0.00"
                          onWheel={(e) => e.currentTarget.blur()}
                      />
                  </div>
              </div>

              <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Payment Date</label>
                  <Input 
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                  />
              </div>

              <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                      {['Cash', 'UPI', 'Card'].map(method => (
                          <button
                              key={method}
                              onClick={() => setPaymentMethod(method)}
                              className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                                  paymentMethod === method 
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                          >
                              {method === 'Cash' && <Banknote size={20} className="mb-1"/>}
                              {method === 'UPI' && <Smartphone size={20} className="mb-1"/>}
                              {method === 'Card' && <CreditCard size={20} className="mb-1"/>}
                              <span className="text-xs font-bold">{method}</span>
                          </button>
                      ))}
                  </div>
              </div>

              <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Note (Optional)</label>
                  <Input 
                      placeholder="e.g. Paid via GPay transaction..."
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                  />
              </div>

              <div className="flex gap-3 pt-2">
                  <Button variant="neutral" className="flex-1" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleRecordPayment}>Clear Amount</Button>
              </div>
          </div>
      </Modal>

    </div>
  );
};
