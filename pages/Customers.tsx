import React, { useState, useEffect } from 'react';
import { Customer, Sale } from '../types';
import { StoreService } from '../services/storeService';
import { Card, Button, Input, Modal, Badge } from '../components/UI';
import { Search, MapPin, Phone, User, Clock, Edit2, Trash2, Plus } from 'lucide-react';

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({});

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const data = await StoreService.getCustomers();
    setCustomers(data);
  };

  const handleEditClick = (customer: Customer) => {
    setFormData(customer);
    setShowEditModal(true);
  };

  const handleAddClick = () => {
      setFormData({});
      setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;
    await StoreService.upsertCustomer(formData);
    setShowEditModal(false);
    loadCustomers();
    if (selectedCustomer && formData.id === selectedCustomer.id) {
        // Refresh selected view details if needed
        setSelectedCustomer({ ...selectedCustomer, ...formData } as Customer);
    }
  };

  const handleDelete = async (id: string) => {
      if (confirm("Are you sure you want to delete this customer?")) {
          await StoreService.deleteCustomer(id);
          setSelectedCustomer(null);
          loadCustomers();
      }
  };

  const filtered = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] gap-4 pb-20">
      
      {/* List */}
      <div className={`flex-1 flex flex-col gap-4 ${selectedCustomer ? 'hidden md:flex' : ''}`}>
        <div className="flex gap-2">
            <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <Input 
                placeholder="Find customer..." 
                className="!pl-10 !py-3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
            <Button onClick={handleAddClick} className="px-4"><Plus size={20}/></Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filtered.map(c => (
                <div 
                    key={c.id} 
                    onClick={() => setSelectedCustomer(c)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors flex justify-between items-center rounded-lg border ${selectedCustomer?.id === c.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
                >
                    <div className="flex-1">
                        <div className="font-bold text-gray-800">{c.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                            <Phone size={12}/> {c.phone}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-bold text-green-600">₹{c.totalSpent.toFixed(0)}</div>
                        <div className="text-xs text-gray-500">{c.visitCount} visits</div>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Detail View */}
      {selectedCustomer ? (
        <div className="w-full md:w-2/3 animate-in fade-in slide-in-from-right duration-300">
            <Card className="h-full flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-gray-100 to-gray-200 -z-10"></div>
                
                <div className="mt-8 flex justify-between items-end mb-6">
                    <div className="flex items-end gap-4">
                        <div className="w-20 h-20 bg-gray-200 rounded-full border-4 border-white flex items-center justify-center text-3xl text-gray-500">
                            <User />
                        </div>
                        <div className="mb-2">
                            <h2 className="text-2xl font-bold text-gray-900">{selectedCustomer.name}</h2>
                            <div className="flex gap-3 text-sm text-gray-500">
                                <span className="flex items-center gap-1"><MapPin size={14}/> {selectedCustomer.location || 'N/A'}</span>
                                <span className="flex items-center gap-1"><Phone size={14}/> {selectedCustomer.phone}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 mb-2">
                        <Button size="sm" variant="neutral" onClick={() => handleEditClick(selectedCustomer)}>
                            <Edit2 size={16} />
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(selectedCustomer.id)}>
                            <Trash2 size={16} />
                        </Button>
                        <button className="md:hidden text-gray-400" onClick={() => setSelectedCustomer(null)}>Close</button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-100">
                        <div className="text-gray-500 text-xs uppercase">Lifetime Value</div>
                        <div className="text-2xl font-bold text-green-600">₹{selectedCustomer.totalSpent.toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-100">
                        <div className="text-gray-500 text-xs uppercase">Visits</div>
                        <div className="text-2xl font-bold text-blue-600">{selectedCustomer.visitCount}</div>
                    </div>
                </div>

                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800">
                    <Clock size={18} className="text-gray-400"/> Purchase History
                </h3>
                
                <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg p-4 border border-gray-100">
                    {selectedCustomer.history.length === 0 ? (
                        <p className="text-gray-500 text-center italic py-8">No history available.</p>
                    ) : (
                        <ul className="space-y-3">
                            {selectedCustomer.history.map((saleId, idx) => (
                                <li key={idx} className="flex justify-between items-center border-b border-gray-200 pb-2">
                                    <span className="text-sm font-mono text-gray-500">Invoice #{saleId.slice(0,6).toUpperCase()}</span>
                                    <Badge color="bg-green-100 text-green-800">Completed</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Card>
        </div>
      ) : (
        <div className="w-full md:w-2/3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-500 hidden md:flex">
            Select a customer to view details
        </div>
      )}

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={formData.id ? 'Edit Customer' : 'Add New Customer'}>
         <div className="space-y-4">
             <Input placeholder="Full Name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
             <Input placeholder="Phone" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
             <Input placeholder="Location" value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})} />
             <Input placeholder="Email (Optional)" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
             <Button className="w-full mt-4" onClick={handleSave}>Save Record</Button>
         </div>
      </Modal>

    </div>
  );
};