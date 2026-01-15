
import React, { useState, useEffect, useMemo } from 'react';
import { StoreService } from '../services/storeService';
import { Customer, Sale, Product, Tab, Tag } from '../types';
import { Card, Badge, Button } from '../components/UI';
import { TrendingUp, Crown, Star, LayoutDashboard, IndianRupee, AlertTriangle, Phone, ArrowUpRight, Package, Wallet, ShoppingBag, PieChart as PieChartIcon, Users, UserPlus, Plus, ShoppingCart, ArrowRight, CheckCircle, DollarSign, Scan, Clock, CheckSquare, Sparkles, Banknote, Smartphone, CreditCard, Trophy, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts';

interface DashboardProps {
  onNavigate: (tab: Tab, action?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [settings, setSettings] = useState<any>({}); // Load settings for expiry days

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [cData, sData, pData, tData, stData] = await Promise.all([
        StoreService.getCustomers(),
        StoreService.getSales(),
        StoreService.getInventory(),
        StoreService.getTags(),
        StoreService.getSettings()
    ]);
    setCustomers(cData);
    setSales(sData);
    setProducts(pData);
    setTags(tData);
    setSettings(stData);
  };

  const getDaysUntilExpiry = (dateStr?: string) => {
      if (!dateStr) return Infinity;
      const today = new Date();
      today.setHours(0,0,0,0);
      const exp = new Date(dateStr);
      exp.setHours(0,0,0,0);
      return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const stats = useMemo(() => {
    // 1. Financials
    const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
    const totalDues = customers.reduce((acc, c) => acc + (c.totalDues || 0), 0);
    const inventoryValue = products.reduce((acc, p) => acc + (p.stock * p.sellPrice), 0);

    // 2. Sales Trend (Last 7 Days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    const salesTrend = last7Days.map(date => {
        const dayTotal = sales
            .filter(s => s.timestamp.startsWith(date))
            .reduce((acc, s) => acc + s.total, 0);
        return { name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }), value: dayTotal };
    });

    // 3. Payment Method Analysis (Last 7 Days)
    const paymentTrend = last7Days.map(date => {
        const daySales = sales.filter(s => s.timestamp.startsWith(date));
        return {
            name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
            Cash: daySales.filter(s => s.paymentMethod === 'Cash').reduce((acc, s) => acc + s.total, 0),
            UPI: daySales.filter(s => s.paymentMethod === 'UPI').reduce((acc, s) => acc + s.total, 0),
            Card: daySales.filter(s => s.paymentMethod === 'Card').reduce((acc, s) => acc + s.total, 0),
        };
    });

    const paymentTotals = {
        Cash: paymentTrend.reduce((acc, d) => acc + d.Cash, 0),
        UPI: paymentTrend.reduce((acc, d) => acc + d.UPI, 0),
        Card: paymentTrend.reduce((acc, d) => acc + d.Card, 0),
    };

    // 4. Customer Insights
    const customersWithDues = customers
        .filter(c => (c.totalDues || 0) > 0)
        .sort((a, b) => b.totalDues - a.totalDues);

    const topBuyer = [...customers].sort((a, b) => b.totalSpent - a.totalSpent)[0];
    const mostLoyal = [...customers].sort((a, b) => b.visitCount - a.visitCount)[0];

    // Customer Composition
    const newCust = customers.filter(c => c.visitCount === 1).length;
    const returningCust = customers.filter(c => c.visitCount > 1 && c.visitCount <= 5).length;
    const loyalCust = customers.filter(c => c.visitCount > 5).length;
    
    const customerComposition = [
        { name: 'New (1 visit)', value: newCust, color: '#cbd5e1' }, // Slate-300
        { name: 'Returning (2-5)', value: returningCust, color: '#60a5fa' }, // Blue-400
        { name: 'Loyal (5+)', value: loyalCust, color: '#2563eb' } // Blue-600
    ].filter(i => i.value > 0);

    // 5. Inventory Insights
    const lowStockItems = products
        .filter(p => p.stock <= p.lowStockThreshold && p.stock > 0)
        .sort((a, b) => a.stock - b.stock);

    const outOfStockItems = products.filter(p => p.stock === 0);
    const outOfStockCount = outOfStockItems.length;

    // Expiry Analysis
    const { expiredItems, expiringItems } = products.reduce((acc, p) => {
        const days = getDaysUntilExpiry(p.expiryDate);
        if (days < 0) {
            acc.expiredItems.push({ ...p, days });
        } else if (days <= (settings.expiryAlertDays || 7) && days >= 0) {
            if (p.expiryDate) {
                acc.expiringItems.push({ ...p, days });
            }
        }
        return acc;
    }, { expiredItems: [] as (Product & {days: number})[], expiringItems: [] as (Product & {days: number})[] });

    expiredItems.sort((a, b) => b.days - a.days);
    expiringItems.sort((a, b) => a.days - b.days);

    // 6. Top Products
    const productSales: Record<string, number> = {};
    sales.forEach(s => {
        s.items.forEach(i => {
            productSales[i.name] = (productSales[i.name] || 0) + i.quantity;
        });
    });
    const topProducts = Object.entries(productSales)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
    
    const bestSellingProduct = topProducts.length > 0 ? topProducts[0] : null;

    // 7. Stock Value By Category
    const valueByTag: { [key: string]: { name: string, value: number, color: string } } = {};
    tags.forEach(tag => { valueByTag[tag.id] = { name: tag.name, value: 0, color: tag.color }; });
    products.forEach(p => {
        const value = p.stock * p.sellPrice;
        if (p.tagId && valueByTag[p.tagId]) valueByTag[p.tagId].value += value;
    });
    const stockValueByCategory = Object.values(valueByTag).filter(d => d.value > 0);

    return { 
        totalRevenue, 
        totalDues, 
        inventoryValue, 
        salesTrend, 
        paymentTrend,
        paymentTotals,
        customersWithDues, 
        topBuyer, 
        mostLoyal, 
        lowStockItems,
        outOfStockItems,
        outOfStockCount,
        expiredItems,
        expiringItems,
        customerComposition,
        topProducts,
        bestSellingProduct,
        stockValueByCategory
    };
  }, [customers, sales, products, tags, settings]);

  const handleCall = (phone: string) => {
      window.location.href = `tel:${phone}`;
  };

  const formatDateShort = (dateStr: string) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in pb-24 relative">
        
        {/* Floating Scan Button (Transparent Glass Style) */}
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
            <button 
                onClick={() => onNavigate(Tab.WAREHOUSE, 'scan_add')}
                className="flex items-center gap-3 pl-3 pr-6 py-2.5 rounded-full bg-white/40 backdrop-blur-xl border border-white/60 text-gray-800 hover:bg-white/60 transition-all active:scale-95 shadow-[0_8px_30px_rgb(0,0,0,0.12)] group"
            >
                <div className="p-2 bg-red-600 rounded-full shadow-lg shadow-red-500/30 text-white">
                    <Scan size={18} className="group-hover:rotate-12 transition-transform"/>
                </div>
                <span className="font-bold tracking-wide text-sm mr-1">Scan to Add</span>
            </button>
        </div>

        {/* Header with Quick Tools */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 pt-2">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <LayoutDashboard size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Overview</h2>
                    <p className="text-gray-500">Business insights & performance</p>
                </div>
            </div>
            
            {/* Quick Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                    <button 
                        onClick={() => onNavigate(Tab.POS)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-xs font-bold whitespace-nowrap"
                    >
                        <ShoppingCart size={14}/> New Sale
                    </button>
                    <button 
                        onClick={() => onNavigate(Tab.WAREHOUSE, 'add')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-bold whitespace-nowrap"
                    >
                        <Package size={14}/> Add Manual
                    </button>
                    <button 
                        onClick={() => onNavigate(Tab.CUSTOMERS, 'add')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors text-xs font-bold whitespace-nowrap"
                    >
                        <UserPlus size={14}/> Customer
                    </button>
                </div>
            </div>
        </div>

        {/* SECTION 1: BUSINESS SNAPSHOT */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <LayoutDashboard size={20} className="text-gray-500"/>
                <h3 className="text-lg font-bold text-gray-800">Business Snapshot</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Revenue */}
                <Card className="border-0 shadow-md bg-gradient-to-br from-green-600 to-emerald-600 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full -mr-4 -mt-4 blur-xl transition-transform group-hover:scale-150 duration-700"></div>
                    <div className="relative z-10 p-2">
                        <div className="flex items-center gap-2 text-green-100 font-bold text-xs uppercase tracking-wider mb-2">
                            <Wallet size={16} /> Total Revenue
                        </div>
                        <div className="text-3xl font-bold">₹{stats.totalRevenue.toLocaleString()}</div>
                        <div className="text-xs text-green-100 mt-1 opacity-80 flex items-center gap-1">
                            <ArrowUpRight size={12}/> {sales.length} Transactions
                        </div>
                    </div>
                </Card>

                {/* Outstanding Dues */}
                <Card className="border-0 shadow-md bg-gradient-to-br from-red-500 to-rose-600 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full -mr-4 -mt-4 blur-xl transition-transform group-hover:scale-150 duration-700"></div>
                    <div className="relative z-10 p-2">
                        <div className="flex items-center gap-2 text-red-100 font-bold text-xs uppercase tracking-wider mb-2">
                            <AlertTriangle size={16} /> Pending Dues
                        </div>
                        <div className="text-3xl font-bold">₹{stats.totalDues.toLocaleString()}</div>
                        <div className="text-xs text-red-100 mt-1 opacity-80">
                            {stats.customersWithDues.length} Customers pending
                        </div>
                    </div>
                </Card>

                {/* Inventory Value */}
                <Card className="border-0 shadow-md bg-white border-l-4 border-blue-600">
                    <div className="p-2">
                        <div className="flex items-center gap-2 text-gray-500 font-bold text-xs uppercase tracking-wider mb-2">
                            <Package size={16} /> Stock Value
                        </div>
                        <div className="text-3xl font-bold text-gray-800">₹{stats.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <div className="text-xs text-gray-400 mt-1">
                            {stats.outOfStockCount > 0 ? (
                                <span className="text-red-500 font-bold flex items-center gap-1"><AlertTriangle size={10}/> {stats.outOfStockCount} Items Out of Stock</span>
                            ) : (
                                <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle size={10}/> Healthy Inventory</span>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        </section>

        {/* SECTION 2: SALES & PAYMENTS */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <BarChart3 size={20} className="text-blue-600"/>
                <h3 className="text-lg font-bold text-gray-800">Sales & Payments</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-4">
                {/* Sales Trend (2 Cols) */}
                <Card className="lg:col-span-2 border-gray-100 shadow-sm p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <TrendingUp size={18} className="text-blue-600"/> Revenue Trend
                        </h3>
                        <Badge color="bg-blue-50 text-blue-700">Last 7 Days</Badge>
                    </div>
                    <div className="h-64 w-full flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.salesTrend}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 12, fill: '#94a3b8'}} 
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 12, fill: '#94a3b8'}}
                                    tickFormatter={(val) => `₹${val}`}
                                />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                                    formatter={(val: number) => [`₹${val}`, 'Revenue']}
                                />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Stock Value by Category (1 Col) */}
                <Card className="border-gray-100 shadow-sm p-0 flex flex-col relative overflow-hidden h-full max-h-[384px]">
                    <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <DollarSign size={18} className="text-green-500"/> Category Value
                        </h3>
                        <div className="bg-green-50 text-green-700 px-2 py-1 rounded-lg text-xs font-bold border border-green-100">
                            ₹{(stats.inventoryValue / 1000).toFixed(1)}k
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                        <div className="space-y-1">
                            {stats.stockValueByCategory
                                .sort((a, b) => b.value - a.value)
                                .map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100 group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ backgroundColor: item.color }}>
                                            {item.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-bold text-gray-700 text-sm truncate max-w-[100px]">{item.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-gray-900">₹{item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div className="text-[10px] text-gray-400 font-medium">
                                            {((item.value / stats.inventoryValue) * 100).toFixed(1)}% of total
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {stats.stockValueByCategory.length === 0 && (
                                <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                                    <Package size={32} className="mb-2 opacity-20"/>
                                    <p className="text-xs">No categorized stock found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Payment Method Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Cash */}
                <Card className="p-4 border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase">Cash Sales</div>
                            <div className="text-xl font-bold text-gray-800">₹{stats.paymentTotals.Cash.toLocaleString()}</div>
                        </div>
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <Banknote size={18} />
                        </div>
                    </div>
                    <div className="h-16 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.paymentTrend}>
                                <Area type="monotone" dataKey="Cash" stroke="#16a34a" fill="#dcfce7" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* UPI */}
                <Card className="p-4 border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase">UPI Sales</div>
                            <div className="text-xl font-bold text-gray-800">₹{stats.paymentTotals.UPI.toLocaleString()}</div>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Smartphone size={18} />
                        </div>
                    </div>
                    <div className="h-16 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.paymentTrend}>
                                <Area type="monotone" dataKey="UPI" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Card */}
                <Card className="p-4 border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase">Card Sales</div>
                            <div className="text-xl font-bold text-gray-800">₹{stats.paymentTotals.Card.toLocaleString()}</div>
                        </div>
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <CreditCard size={18} />
                        </div>
                    </div>
                    <div className="h-16 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.paymentTrend}>
                                <Area type="monotone" dataKey="Card" stroke="#9333ea" fill="#f3e8ff" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </section>

        {/* SECTION 3: INVENTORY HEALTH */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <Package size={20} className="text-amber-600"/>
                <h3 className="text-lg font-bold text-gray-800">Inventory Health</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Column 1: Best Seller Spotlight + Best Sellers List */}
                <div className="flex flex-col gap-4">
                    {/* Best Selling Product Spotlight */}
                    {stats.bestSellingProduct && (
                        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-white shadow-md relative overflow-hidden group h-[120px] flex items-center">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-200 rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-center gap-4 relative z-10 p-2 w-full">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-fuchsia-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/30 shrink-0">
                                    <Trophy size={28} fill="white" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-0.5">Top Performer</div>
                                    <div className="text-xl font-bold text-gray-900 truncate" title={stats.bestSellingProduct.name}>{stats.bestSellingProduct.name}</div>
                                    <div className="text-sm text-gray-500">Sold: <span className="font-bold text-purple-600">{stats.bestSellingProduct.count} units</span></div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Best Sellers List */}
                    <Card className="border-indigo-100 bg-indigo-50/30 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[200px]">
                        <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-indigo-900 flex items-center gap-2 text-sm">
                                <Crown size={16} /> Top Moving Items
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {stats.topProducts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                                    <ShoppingBag size={32} className="mb-2 opacity-20"/>
                                    No data.
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {stats.topProducts.slice(0, 5).map((p, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-white border border-indigo-50 rounded-lg shadow-sm">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${idx === 0 ? 'bg-yellow-400 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                                                    {idx + 1}
                                                </div>
                                                <span className="font-medium text-gray-800 text-xs truncate">{p.name}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">{p.count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Column 2: Low Stock List */}
                <Card className="border-red-500 bg-red-50/40 flex flex-col shadow-sm h-[400px] overflow-hidden">
                    <div className="px-5 py-4 border-b border-red-100 bg-red-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <AlertTriangle size={20} className="text-red-500"/> Low Stock
                        </h3>
                        {(stats.lowStockItems.length > 0 || stats.outOfStockItems.length > 0) && <Badge color="bg-red-100 text-red-700 border border-red-200">{stats.lowStockItems.length + stats.outOfStockItems.length}</Badge>}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {stats.lowStockItems.length === 0 && stats.outOfStockItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                 <CheckSquare size={32} className="mb-2 opacity-30"/>
                                 <span className="text-sm">Stock levels healthy</span>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {stats.outOfStockItems.map(p => (
                                    <div key={p.id} className="flex justify-between items-center text-sm py-2 px-3 bg-white rounded-lg border border-red-100 shadow-sm hover:shadow-md transition-shadow">
                                        <span className="font-bold truncate text-gray-800 w-2/3">{p.name}</span>
                                        <Badge color="bg-red-100 text-red-700">Out of Stock</Badge>
                                    </div>
                                ))}
                                {stats.lowStockItems.map(p => (
                                    <div key={p.id} className="flex justify-between items-center text-sm py-2 px-3 bg-white rounded-lg border border-orange-100 shadow-sm hover:shadow-md transition-shadow">
                                        <span className="font-bold truncate text-gray-800 w-2/3">{p.name}</span>
                                        <span className="font-bold text-xs text-orange-600">{p.stock} {p.unit} left</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>

                {/* Column 3: Expiry List */}
                <Card className="border-amber-500 bg-amber-50/40 flex flex-col shadow-sm h-[400px] overflow-hidden">
                    <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Clock size={20} className="text-amber-500"/> Expiry Alerts
                        </h3>
                        {(stats.expiredItems.length > 0 || stats.expiringItems.length > 0) && <Badge color="bg-amber-100 text-amber-800 border border-amber-200">{stats.expiredItems.length + stats.expiringItems.length}</Badge>}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {stats.expiredItems.length === 0 && stats.expiringItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                 <Sparkles size={32} className="mb-2 opacity-30"/>
                                 <span className="text-sm">Everything fresh</span>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {stats.expiredItems.map(p => (
                                    <div 
                                        key={p.id} 
                                        className="flex justify-between items-center text-sm py-2 px-3 bg-white rounded-lg border-l-4 border-l-red-500 border-y border-r border-gray-100 shadow-sm"
                                    >
                                        <span className="font-bold truncate text-gray-800 w-2/3">{p.name}</span>
                                        <div className="text-right flex flex-col items-end">
                                            <span className="text-[10px] uppercase font-bold text-red-600 bg-red-100 px-1.5 rounded-sm">Expired</span>
                                            <span className="text-xs font-bold text-gray-500 mt-0.5">{formatDateShort(p.expiryDate || '')}</span>
                                        </div>
                                    </div>
                                ))}
                                {stats.expiringItems.map(p => (
                                    <div 
                                        key={p.id} 
                                        className="flex justify-between items-center text-sm py-2 px-3 bg-white rounded-lg border-l-4 border-l-amber-500 border-y border-r border-gray-100 shadow-sm"
                                    >
                                        <span className="font-bold truncate text-gray-800 w-2/3">{p.name}</span>
                                        <div className="text-right flex flex-col items-end">
                                            <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-100 px-1.5 rounded-sm">Expiring</span>
                                            <span className="text-xs font-bold text-gray-500 mt-0.5">{formatDateShort(p.expiryDate || '')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </section>

        {/* SECTION 4: CUSTOMER INSIGHTS */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <Users size={20} className="text-purple-600"/>
                <h3 className="text-lg font-bold text-gray-800">Customer Insights</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Column 1: Spotlights Stacked */}
                <div className="flex flex-col gap-4">
                    {/* Best Buyer */}
                    {stats.topBuyer && (
                        <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-white shadow-md relative overflow-hidden group h-[130px] flex items-center">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-yellow-200 rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-center gap-4 relative z-10 p-2 w-full">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-yellow-500/30 shrink-0">
                                    <Crown size={28} fill="white" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider mb-0.5">Best Buyer</div>
                                    <div className="text-xl font-bold text-gray-900 truncate" title={stats.topBuyer.name}>{stats.topBuyer.name}</div>
                                    <div className="text-sm text-gray-500">Spent: <span className="font-bold text-green-600">₹{stats.topBuyer.totalSpent.toLocaleString()}</span></div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Most Loyal */}
                    {stats.mostLoyal && (
                        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-white shadow-md relative overflow-hidden group h-[130px] flex items-center">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-200 rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-center gap-4 relative z-10 p-2 w-full">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
                                    <Star size={28} fill="white" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-0.5">Most Loyal</div>
                                    <div className="text-xl font-bold text-gray-900 truncate" title={stats.mostLoyal.name}>{stats.mostLoyal.name}</div>
                                    <div className="text-sm text-gray-500">Visits: <span className="font-bold text-blue-600">{stats.mostLoyal.visitCount}</span></div>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Column 2: Outstanding Dues List */}
                <Card className="border-red-100 bg-red-50/30 shadow-sm overflow-hidden flex flex-col h-[280px] md:h-auto">
                    <div className="px-5 py-4 border-b border-red-100 bg-red-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-red-900 flex items-center gap-2">
                            <Wallet size={18} /> Outstanding Dues
                        </h3>
                        <Badge color="bg-white text-red-600 border border-red-100 shadow-sm">{stats.customersWithDues.length}</Badge>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {stats.customersWithDues.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                                <Wallet size={32} className="mb-2 opacity-20"/>
                                No dues.
                            </div>
                        ) : (
                            stats.customersWithDues.map(c => (
                                <div key={c.id} className="bg-white p-3 rounded-xl border border-red-100 shadow-sm flex items-center justify-between group">
                                    <div className="min-w-0">
                                        <div className="font-bold text-gray-900 text-sm truncate">{c.name}</div>
                                        <div className="text-xs text-red-600 font-bold mt-0.5">₹{c.totalDues.toLocaleString()}</div>
                                    </div>
                                    <button 
                                        onClick={() => handleCall(c.phone)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors border border-red-100"
                                        title="Call Customer"
                                    >
                                        <Phone size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* Column 3: Loyalty Pie Chart */}
                <Card className="border-gray-100 shadow-sm p-0 flex flex-col h-[280px] md:h-auto overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Users size={18} className="text-purple-600"/> Retention
                        </h3>
                    </div>
                    <div className="flex-1 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.customerComposition}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.customerComposition.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0}/>
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={36} 
                                    iconType="circle" 
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                            <span className="text-2xl font-bold text-gray-800">{customers.length}</span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Total</span>
                        </div>
                    </div>
                </Card>
            </div>
        </section>
    </div>
  );
};
