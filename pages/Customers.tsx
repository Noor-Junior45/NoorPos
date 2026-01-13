import React, { useState, useEffect, useMemo } from 'react';
import { Customer, Sale } from '../types';
import { StoreService } from '../services/storeService';
import { generateCustomerStatementPDF } from '../services/pdfService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Search, MapPin, Phone, User, Clock, Edit2, Trash2, Plus, TrendingUp, Crown, Star, X, Mail } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

// Custom Icons for Brands
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const GmailIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-white">
    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
  </svg>
);

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({});

  useEffect(() => {
    loadData();
  }, []);

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

  const handleDelete = async (id: string) => {
      if (confirm("Are you sure you want to delete this customer?")) {
          await StoreService.deleteCustomer(id);
          setSelectedCustomer(null);
          loadData();
      }
  };

  const handleShareWhatsApp = (customer: Customer) => {
      const customerSales = sales.filter(s => customer.history.includes(s.id));
      generateCustomerStatementPDF(customer, customerSales);
      const message = `Hello ${customer.name},%0A%0AHere is your purchase history statement from Noor Store.%0A%0APlease find the attached PDF file.`;
      const url = `https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}?text=${message}`;
      window.open(url, '_blank');
  };

  const handleShareGmail = (customer: Customer) => {
      const customerSales = sales.filter(s => customer.history.includes(s.id));
      generateCustomerStatementPDF(customer, customerSales);
      
      const subject = `Statement for ${customer.name}`;
      const body = `Hello ${customer.name},\n\nPlease find your purchase history statement attached (Note: You must attach the downloaded PDF manually).\n\nBest regards,\nNoor Store`;
      const url = `mailto:${customer.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(url, '_blank');
  };

  const stats = useMemo(() => {
    if (customers.length === 0) return null;
    const topBuyer = [...customers].sort((a, b) => b.totalSpent - a.totalSpent)[0];
    const mostLoyal = [...customers].sort((a, b) => b.visitCount - a.visitCount)[0];
    const growthData = customers.map((_, i) => ({ name: i, value: Math.floor(Math.random() * 10) + (i * 2) })).slice(-10);
    return { topBuyer, mostLoyal, growthData };
  }, [customers]);

  const filteredAndSortedCustomers = useMemo(() => {
      return customers
        .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, searchTerm]);

  return (
    <div className="flex flex-col h-full pb-24 animate-in fade-in space-y-6">
      
      {/* Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white h-32 flex flex-col justify-between">
              <div className="z-10">
                  <div className="flex items-center gap-2 opacity-90 text-sm font-bold uppercase tracking-wider">
                      <TrendingUp size={16}/> New Customers
                  </div>
                  <div className="text-3xl font-bold mt-1">+{customers.length}</div>
                  <div className="text-xs opacity-70">Total registered profiles</div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.growthData || []}>
                        <Area type="monotone" dataKey="value" stroke="#fff" fill="#fff" />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
          </Card>

          <Card className="border border-yellow-100 bg-yellow-50/50 shadow-sm h-32 flex items-center gap-4 relative overflow-hidden">
               <div className="absolute -right-4 -top-4 text-yellow-100 opacity-50">
                   <Crown size={80} />
               </div>
               <div className="w-14 h-14 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center shrink-0 border-4 border-white shadow-sm z-10">
                   <Crown size={28} />
               </div>
               <div className="z-10">
                   <div className="text-xs font-bold text-yellow-700 uppercase tracking-wider">Top Buyer</div>
                   <div className="text-xl font-bold text-gray-800 truncate max-w-[150px]">{stats?.topBuyer?.name || 'N/A'}</div>
                   <div className="text-sm font-mono text-green-600 font-bold">₹{stats?.topBuyer?.totalSpent.toLocaleString() || 0}</div>
               </div>
          </Card>

          <Card className="border border-blue-100 bg-blue-50/50 shadow-sm h-32 flex items-center gap-4 relative overflow-hidden">
               <div className="absolute -right-4 -top-4 text-blue-100 opacity-50">
                   <Star size={80} />
               </div>
               <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 border-4 border-white shadow-sm z-10">
                   <Star size={28} />
               </div>
               <div className="z-10">
                   <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">Most Loyal</div>
                   <div className="text-xl font-bold text-gray-800 truncate max-w-[150px]">{stats?.mostLoyal?.name || 'N/A'}</div>
                   <div className="text-sm text-gray-500 font-medium">{stats?.mostLoyal?.visitCount || 0} Visits</div>
               </div>
          </Card>
      </div>

      {/* Google-Style Search Bar */}
      <div className="relative w-full max-w-2xl mx-auto z-20">
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative flex items-center bg-white rounded-full shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] transition-shadow duration-300 border border-gray-100 h-14 px-6">
                <Search className="text-gray-400 mr-4 shrink-0" size={20} />
                <input 
                    type="text" 
                    placeholder="Search customers by name..." 
                    className="w-full bg-transparent border-none focus:ring-0 text-lg text-gray-700 placeholder-gray-400 h-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="p-2 text-gray-400 hover:text-gray-600 shrink-0">
                        <X size={18}/>
                    </button>
                )}
                
                {/* Embedded New Customer Button */}
                <button 
                    onClick={handleAddClick}
                    className="ml-2 flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold text-sm px-3 py-1.5 rounded-full hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
                >
                    <Plus size={18}/> New Customer
                </button>
            </div>
          </div>
      </div>

      {/* Content Area: List & Detail */}
      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
          
          {/* Customer List (A-Z) */}
          <div className={`flex-1 overflow-y-auto pr-2 space-y-3 ${selectedCustomer ? 'hidden md:block' : ''}`}>
             {filteredAndSortedCustomers.length === 0 ? (
                 <div className="text-center py-20 text-gray-400">
                     <User size={48} className="mx-auto mb-2 opacity-20"/>
                     <p>No customers found.</p>
                 </div>
             ) : (
                 filteredAndSortedCustomers.map(c => (
                     <div 
                        key={c.id} 
                        onClick={() => setSelectedCustomer(c)}
                        className={`group p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between
                            ${selectedCustomer?.id === c.id 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30 transform scale-[1.02]' 
                                : 'bg-white border-gray-100 hover:border-blue-300 hover:shadow-md text-gray-800'
                            }
                        `}
                     >
                         <div className="flex items-center gap-4">
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                                 ${selectedCustomer?.id === c.id ? 'bg-white/20 text-white' : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600'}
                             `}>
                                 {c.name.charAt(0).toUpperCase()}
                             </div>
                             <div>
                                 <div className="font-bold">{c.name}</div>
                                 <div className={`text-xs flex items-center gap-1 ${selectedCustomer?.id === c.id ? 'text-blue-100' : 'text-gray-400'}`}>
                                     <Phone size={10}/> {c.phone}
                                 </div>
                             </div>
                         </div>
                         <div className="text-right">
                             <div className={`font-bold text-sm ${selectedCustomer?.id === c.id ? 'text-white' : 'text-green-600'}`}>₹{c.totalSpent.toLocaleString()}</div>
                         </div>
                     </div>
                 ))
             )}
          </div>

          {/* Detail View */}
          {selectedCustomer ? (
            <div className="w-full md:w-2/3 animate-in slide-in-from-right-4 duration-300 flex flex-col">
                <Card className="flex-1 border-0 shadow-xl ring-1 ring-black/5 flex flex-col relative overflow-hidden bg-white !p-0">
                    
                    {/* Compact Header Area (Blue Space) */}
                    <div className="w-full bg-blue-600 p-3 md:p-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                            {/* Left Side: Identity */}
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-lg font-bold text-white border-2 border-white/30 shadow-sm shrink-0">
                                    {selectedCustomer.name.charAt(0).toUpperCase()}
                                </div>
                                
                                <div className="text-white min-w-0">
                                    <h2 className="text-lg font-bold leading-tight truncate">{selectedCustomer.name}</h2>
                                    <div className="flex flex-wrap items-center gap-2 text-blue-100 text-xs mt-0.5">
                                        <span className="flex items-center gap-1 opacity-90">
                                            <Phone size={11} className="text-blue-200"/> {selectedCustomer.phone}
                                        </span>
                                        {selectedCustomer.location && (
                                            <span className="flex items-center gap-1 opacity-80 border-l border-blue-400 pl-2">
                                                <MapPin size={11}/> {selectedCustomer.location}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: ID & Actions */}
                            <div className="flex items-center justify-end gap-3 w-full md:w-auto mt-1 md:mt-0">
                                 <div className="flex items-center gap-2 text-right">
                                    <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider hidden sm:inline">Customer ID</span>
                                    <span className="font-mono text-xs font-bold text-white bg-white/10 px-2 py-1 rounded">#{selectedCustomer.id.slice(0, 6).toUpperCase()}</span>
                                 </div>
                                 
                                 <div className="flex items-center gap-1">
                                    {/* WhatsApp */}
                                    <button 
                                        onClick={() => handleShareWhatsApp(selectedCustomer)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#25D366] hover:bg-[#128C7E] text-white shadow-sm transition-transform hover:scale-105"
                                        title="WhatsApp"
                                    >
                                        <WhatsAppIcon />
                                    </button>

                                    {/* Gmail */}
                                    <button 
                                        onClick={() => handleShareGmail(selectedCustomer)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#EA4335] hover:bg-[#D93025] text-white shadow-sm transition-transform hover:scale-105"
                                        title="Gmail"
                                    >
                                        <GmailIcon />
                                    </button>

                                    <div className="w-px h-5 bg-blue-400/30 mx-1"></div>

                                    {/* Edit */}
                                    <button onClick={() => handleEditClick(selectedCustomer)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors">
                                        <Edit2 size={14} />
                                    </button>
                                    
                                    {/* Delete */}
                                    <button onClick={() => handleDelete(selectedCustomer.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-500/30 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                 </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 bg-gray-50 flex flex-col relative">
                        <div className="px-6 py-6 overflow-y-auto flex-1">
                            {/* Stats Boxes */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 flex flex-col items-center justify-center h-24">
                                    <div className="text-green-600 text-[10px] font-bold uppercase tracking-widest mb-1">Lifetime Value</div>
                                    <div className="text-3xl font-bold text-green-700 tracking-tight">₹{selectedCustomer.totalSpent.toLocaleString()}</div>
                                </div>
                                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center h-24">
                                    <div className="text-blue-600 text-[10px] font-bold uppercase tracking-widest mb-1">Total Visits</div>
                                    <div className="text-3xl font-bold text-blue-700 tracking-tight">{selectedCustomer.visitCount}</div>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <Clock size={18} className="text-gray-400"/> Recent Activity
                                    </h3>
                                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{selectedCustomer.history.length} Orders</span>
                                </div>
                                
                                {selectedCustomer.history.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400">
                                        <Clock size={32} className="mx-auto mb-2 opacity-20"/>
                                        <p>No purchase history available.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedCustomer.history.slice().reverse().map((saleId, idx) => {
                                            const sale = sales.find(s => s.id === saleId);
                                            return (
                                                <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center group hover:shadow-md transition-shadow">
                                                    <div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                                                POS
                                                            </div>
                                                            <div>
                                                                <div className="font-mono text-sm font-bold text-gray-700">#{saleId.slice(0,6).toUpperCase()}</div>
                                                                <div className="text-xs text-gray-400 mt-0.5">{sale ? new Date(sale.timestamp).toLocaleDateString() : 'Unknown Date'}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {sale ? (
                                                            <div>
                                                                <span className="block font-bold text-gray-900 text-lg">₹{sale.total.toFixed(2)}</span>
                                                                <span className="text-xs text-gray-500">{sale.items.length} Items</span>
                                                            </div>
                                                        ) : (
                                                            <Badge color="bg-gray-100 text-gray-500">Archived</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
          ) : (
            <div className="hidden md:flex w-2/3 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200 flex-col items-center justify-center text-gray-400">
                <User size={64} className="mb-4 opacity-10" />
                <p className="font-medium">Select a customer to view details</p>
            </div>
          )}
      </div>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={formData.id ? 'Edit Customer' : 'Add New Customer'}>
         <div className="space-y-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Full Name</label>
                <Input placeholder="Customer Name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
             </div>

             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Phone Number</label>
                {/* Redesigned Input: Clean white box with no grey prefix background */}
                <div className="flex relative border-2 border-gray-200 rounded-lg focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all overflow-hidden bg-white shadow-sm">
                    <div className="flex items-center justify-center bg-white border-r border-gray-100 px-3 text-gray-600 font-medium select-none min-w-[70px]">
                        🇮🇳 +91
                    </div>
                    <input 
                        className="w-full px-4 py-2.5 text-base outline-none text-gray-900 placeholder-gray-400 bg-white"
                        placeholder="98765 43210" 
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
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Address / Location</label>
                <Input placeholder="Location" value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})} />
             </div>

             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Email (Optional)</label>
                <Input placeholder="Email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
             </div>
             
             <Button className="w-full mt-4" onClick={handleSave}>Save Record</Button>
         </div>
      </Modal>

    </div>
  );
};