import React, { useState, useEffect, useMemo } from 'react';
import { Product, CartItem, Customer } from '../types';
import { StoreService } from '../services/storeService';
import { generateInvoicePDF } from '../services/pdfService';
import { Card, Button, Input, Modal } from '../components/UI';
import { Search, ShoppingCart, Trash2, User, CreditCard, Printer } from 'lucide-react';

export const POS: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  
  // Checkout Customer Form
  const [custForm, setCustForm] = useState({ name: '', phone: '' });

  useEffect(() => {
    StoreService.getInventory().then(setProducts);
    StoreService.getCustomers().then(setCustomers);
  }, []);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        // Check stock limit
        if (newQty > item.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.sellPrice * item.quantity), 0);
  const taxRate = 0.18;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    // Use selected customer or form data
    const customerName = selectedCustomer ? selectedCustomer.name : (custForm.name || 'Guest');
    const customerId = selectedCustomer ? selectedCustomer.id : undefined;

    const sale = await StoreService.createSale({
      items: cart,
      customerName,
      customerId,
      subtotal,
      tax,
      total
    });

    // Generate Invoice
    generateInvoicePDF(sale);

    // Reset
    setCart([]);
    setShowCheckout(false);
    setCustForm({ name: '', phone: '' });
    setSelectedCustomer(null);
    alert("Sale Complete! Invoice downloaded.");
    
    // Refresh inventory in background
    StoreService.getInventory().then(setProducts);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.includes(searchTerm)
  );

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-100px)] gap-4 pb-20 md:pb-0">
      
      {/* Product Grid (Left) */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <Input 
            placeholder="Search products..." 
            className="!pl-10 !py-3 !rounded-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-3 pr-2">
          {filteredProducts.map(p => (
            <div 
                key={p.id} 
                onClick={() => p.stock > 0 && addToCart(p)}
                className={`bg-white border border-gray-100 p-3 rounded-xl cursor-pointer transition-all hover:border-blue-500 hover:shadow-lg active:scale-95 flex flex-col justify-between ${p.stock === 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              <div>
                <div className="font-bold text-gray-800 truncate">{p.name}</div>
                <div className="text-xs text-gray-500">Stock: {p.stock}</div>
              </div>
              <div className="mt-2 text-right">
                <span className="text-green-600 font-bold">₹{p.sellPrice.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart (Right) */}
      <div className="w-full md:w-96 flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden shadow-md">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h2 className="font-bold flex items-center gap-2 text-lg"><ShoppingCart size={18}/> Cart</h2>
          <span className="text-sm text-gray-500 font-medium">{cart.length} items</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500">Cart is empty</div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                <div className="flex-1 min-w-0 mr-2">
                  <div className="text-sm font-medium text-gray-800 truncate">{item.name}</div>
                  <div className="text-xs text-gray-500">₹{item.sellPrice.toFixed(2)} x {item.quantity}</div>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300">-</button>
                   <span className="text-sm w-4 text-center font-medium">{item.quantity}</span>
                   <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center hover:bg-gray-300">+</button>
                   <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 ml-1"><Trash2 size={16} /></button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals Section */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>Tax (18%)</span>
            <span>₹{tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-800 border-t border-gray-200 pt-2">
            <span>Total</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
          
          <Button 
            className="w-full mt-4 flex items-center justify-center gap-2 py-3" 
            variant="success"
            disabled={cart.length === 0}
            onClick={() => setShowCheckout(true)}
          >
            <CreditCard size={18} /> Checkout
          </Button>
        </div>
      </div>

      {/* Checkout Modal */}
      <Modal isOpen={showCheckout} onClose={() => setShowCheckout(false)} title="Finalize Sale">
        <div className="space-y-4">
            <div className="bg-gray-100 p-3 rounded-lg mb-4">
                <div className="text-sm text-gray-500">Total Amount</div>
                <div className="text-2xl font-bold text-green-600">₹{total.toFixed(2)}</div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Customer Details</label>
                
                <Input 
                    placeholder="Customer Name" 
                    value={selectedCustomer ? selectedCustomer.name : custForm.name} 
                    onChange={e => {
                        setSelectedCustomer(null);
                        setCustForm({...custForm, name: e.target.value})
                    }} 
                />
                <Input 
                    placeholder="Phone Number" 
                    value={selectedCustomer ? selectedCustomer.phone : custForm.phone} 
                    onChange={e => setCustForm({...custForm, phone: e.target.value})} 
                />

                <div className="flex gap-2 overflow-x-auto pb-2 mt-2">
                    {customers.slice(0, 3).map(c => (
                        <button 
                            key={c.id}
                            onClick={() => setSelectedCustomer(c)}
                            className={`text-xs px-3 py-1 rounded-full border ${selectedCustomer?.id === c.id ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white text-gray-600'}`}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>
            </div>

            <Button className="w-full mt-4" onClick={handleCheckout}>
                <Printer size={18} className="inline mr-2" /> Pay & Print Invoice
            </Button>
        </div>
      </Modal>
    </div>
  );
};