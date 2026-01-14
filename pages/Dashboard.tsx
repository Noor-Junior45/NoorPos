import React, { useState, useEffect, useMemo } from 'react';
import { StoreService } from '../services/storeService';
import { Customer, Sale, Product, Tab } from '../types';
import { Card, Badge, Button } from '../components/UI';
import { TrendingUp, Crown, Star, LayoutDashboard, IndianRupee, AlertTriangle, Phone, ArrowUpRight, Package, Wallet, ShoppingBag, PieChart as PieChartIcon, Users, UserPlus, Plus, ShoppingCart, ArrowRight, CheckCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface DashboardProps {
  onNavigate: (tab: Tab, action?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [cData, sData, pData] = await Promise.all([
        StoreService.getCustomers(),
        StoreService.getSales(),
        StoreService.getInventory()
    ]);
    setCustomers(cData);
    setSales(sData);
    setProducts(pData);
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

    // 3. Customer Insights
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

    // 4. Inventory Insights
    const lowStockItems = products
        .filter(p => p.stock <= p.lowStockThreshold && p.stock > 0)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 5);

    const outOfStockCount = products.filter(p => p.stock === 0).length;

    // 5. Top Products
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

    return { 
        totalRevenue, 
        totalDues, 
        inventoryValue, 
        salesTrend, 
        customersWithDues, 
        topBuyer, 
        mostLoyal, 
        lowStockItems,
        outOfStockCount,
        customerComposition,
        topProducts
    };
  }, [customers, sales, products]);

  const handleCall = (phone: string) => {
      window.location.href = `tel:${phone}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-24">
        {/* Header with Quick Tools */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2 px-1 pt-2">
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
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm overflow-x-auto max-w-full">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">Quick Tools:</span>
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
                    <Package size={14}/> Add Stock
                </button>
                <button 
                    onClick={() => onNavigate(Tab.CUSTOMERS, 'add')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors text-xs font-bold whitespace-nowrap"
                >
                    <UserPlus size={14}/> New Customer
                </button>
            </div>
        </div>

        {/* 1. KPI CARDS */}
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

        {/* 2. CHARTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
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

            {/* Customer Composition (1 Col) */}
            <Card className="border-gray-100 shadow-sm p-6 flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Users size={18} className="text-purple-600"/> Customer Loyalty
                    </h3>
                </div>
                <div className="flex-1 min-h-[200px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stats.customerComposition}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
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
                                wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Center Stat */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                        <span className="text-3xl font-bold text-gray-800">{customers.length}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Total</span>
                    </div>
                </div>
            </Card>
        </div>

        {/* 3. INSIGHTS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Outstanding Dues */}
            <Card className="border-red-100 bg-red-50/30 shadow-sm overflow-hidden flex flex-col h-[350px]">
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
                            No pending payments.
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
                {stats.totalDues > 0 && (
                    <div className="p-3 bg-red-100 border-t border-red-200 text-center text-red-800 text-xs font-bold uppercase tracking-wide">
                        Collect ₹{stats.totalDues.toLocaleString()}
                    </div>
                )}
            </Card>

            {/* Top Products */}
            <Card className="border-indigo-100 bg-indigo-50/30 shadow-sm overflow-hidden flex flex-col h-[350px]">
                <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                        <Crown size={18} /> Best Sellers
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {stats.topProducts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                            <ShoppingBag size={32} className="mb-2 opacity-20"/>
                            No sales data yet.
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {stats.topProducts.map((p, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-indigo-50 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-400 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                                            {idx + 1}
                                        </div>
                                        <span className="font-medium text-gray-800 text-sm">{p.name}</span>
                                    </div>
                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{p.count} sold</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {/* Low Stock Alerts (Refined) */}
            <Card className="border-amber-100 bg-amber-50/30 shadow-sm overflow-hidden flex flex-col h-[350px]">
                <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-amber-900 flex items-center gap-2">
                        <AlertTriangle size={18} /> Low Stock
                    </h3>
                    {stats.lowStockItems.length > 0 && <Badge color="bg-amber-100 text-amber-800 border border-amber-200">{stats.lowStockItems.length}</Badge>}
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {stats.lowStockItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                            <Package size={32} className="mb-2 opacity-20"/>
                            Inventory healthy.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {stats.lowStockItems.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 bg-white border border-amber-100 rounded-xl shadow-sm group hover:border-amber-300 transition-colors">
                                    <div>
                                        <div className="font-bold text-gray-800 text-sm">{p.name}</div>
                                        <div className="text-[10px] text-gray-400">Limit: {p.lowStockThreshold} {p.unit}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-red-600 leading-none">{p.stock}</div>
                                        <span className="text-[10px] text-gray-400">{p.unit}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>
        </div>

        {/* 4. CUSTOMER SPOTLIGHT ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Spender */}
            {stats.topBuyer && (
                <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-white shadow-md relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-yellow-200 rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-yellow-500/30">
                            <Crown size={28} fill="white" />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider mb-0.5">Top Spender</div>
                            <div className="text-xl font-bold text-gray-900">{stats.topBuyer.name}</div>
                            <div className="text-sm text-gray-500">Total Spent: <span className="font-bold text-green-600">₹{stats.topBuyer.totalSpent.toLocaleString()}</span></div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Most Loyal */}
            {stats.mostLoyal && (
                <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-white shadow-md relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-200 rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <Star size={28} fill="white" />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-0.5">Most Loyal</div>
                            <div className="text-xl font-bold text-gray-900">{stats.mostLoyal.name}</div>
                            <div className="text-sm text-gray-500">Visits: <span className="font-bold text-blue-600">{stats.mostLoyal.visitCount}</span></div>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    </div>
  );
};
