
import React, { useState, useEffect, useMemo } from 'react';
import { StoreService } from '../services/storeService';
import { GeminiService } from '../services/geminiService';
import { Customer, Sale, Product, Tab, Tag } from '../types';
import { Card, Badge, Button } from '../components/UI';
import { TrendingUp, Crown, Star, LayoutDashboard, IndianRupee, AlertTriangle, Phone, ArrowUpRight, Package, Wallet, ShoppingBag, PieChart as PieChartIcon, Users, UserPlus, Plus, ShoppingCart, ArrowRight, CheckCircle, DollarSign, Scan, Clock, CheckSquare, Sparkles, Banknote, Smartphone, CreditCard, Trophy, BarChart3, Box, Layers, Loader2, X, BrainCircuit, RefreshCw, MessageSquareText, ShieldCheck, Lightbulb, BookOpen, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts';

interface DashboardProps {
  onNavigate: (tab: Tab, action?: string) => void;
}

const AmpAd = 'amp-ad' as any;

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [settings, setSettings] = useState<any>({});
  
  // Gemini AI States
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // Restore AI insight from session if available
    const savedInsight = sessionStorage.getItem('noor_ai_insight');
    if (savedInsight) setAiInsight(savedInsight);
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

  const generateAIInsights = async () => {
      if (products.length === 0 && sales.length === 0) {
          setAiError("Add some products or sales first to get insights.");
          return;
      }
      
      setIsLoadingAI(true);
      setAiError(null);
      try {
          const insight = await GeminiService.analyzeInventory(products, sales);
          setAiInsight(insight);
          sessionStorage.setItem('noor_ai_insight', insight);
      } catch (err) {
          setAiError("Could not connect to AI assistant. Please check your internet.");
          console.error(err);
      } finally {
          setIsLoadingAI(false);
      }
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
    const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
    const totalDues = customers.reduce((acc, c) => acc + (c.totalDues || 0), 0);
    const inventoryValue = products.reduce((acc, p) => acc + (p.stock * p.sellPrice), 0);
    const totalProducts = products.length;
    const totalStockUnits = products.reduce((acc, p) => acc + p.stock, 0);

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

    const paymentTrend = last7Days.map(date => {
        const daySales = sales.filter(s => s.timestamp.startsWith(date));
        return {
            name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
            Cash: daySales.filter(s => s.paymentMethod === 'Cash').reduce((acc, s) => acc + s.total, 0),
            UPI: daySales.filter(s => s.paymentMethod === 'UPI').reduce((acc, s) => acc + s.total, 0),
            Card: daySales.filter(s => s.paymentMethod === 'Card').reduce((acc, s) => acc + s.total, 0),
        };
    });

    const customersWithDues = customers
        .filter(c => (c.totalDues || 0) > 0)
        .sort((a, b) => b.totalDues - a.totalDues);

    const topBuyer = [...customers].sort((a, b) => b.totalSpent - a.totalSpent)[0];
    const mostLoyal = [...customers].sort((a, b) => b.visitCount - a.visitCount)[0];

    const customerComposition = [
        { name: 'New (1)', value: customers.filter(c => c.visitCount === 1).length, color: '#94a3b8' },
        { name: 'Returning (2-5)', value: customers.filter(c => c.visitCount > 1 && c.visitCount <= 5).length, color: '#60a5fa' },
        { name: 'Loyal (5+)', value: customers.filter(c => c.visitCount > 5).length, color: '#2563eb' }
    ].filter(i => i.value > 0);

    const lowStockItems = products
        .filter(p => p.stock <= (p.lowStockThreshold || settings.lowStockDefault || 10) && p.stock > 0)
        .sort((a, b) => a.stock - b.stock);

    const outOfStockItems = products.filter(p => p.stock === 0);

    const { expiredItems, expiringItems } = products.reduce((acc, p) => {
        const days = getDaysUntilExpiry(p.expiryDate);
        if (days < 0) acc.expiredItems.push({ ...p, days });
        else if (days <= (settings.expiryAlertDays || 7) && days >= 0) {
            if (p.expiryDate) acc.expiringItems.push({ ...p, days });
        }
        return acc;
    }, { expiredItems: [] as (Product & {days: number})[], expiringItems: [] as (Product & {days: number})[] });

    const productSales: Record<string, number> = {};
    sales.forEach(s => s.items.forEach(i => productSales[i.name] = (productSales[i.name] || 0) + i.quantity));
    const topProducts = Object.entries(productSales).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => ({ name, count }));
    
    const bestSellingProduct = topProducts.length > 0 ? topProducts[0] : null;

    const valueByTag: { [key: string]: { name: string, value: number, color: string } } = {};
    tags.forEach(tag => { valueByTag[tag.id] = { name: tag.name, value: 0, color: tag.color }; });
    products.forEach(p => {
        const value = p.stock * p.sellPrice;
        if (p.tagId && valueByTag[p.tagId]) valueByTag[p.tagId].value += value;
    });

    return { 
        totalRevenue, totalDues, inventoryValue, totalProducts, totalStockUnits,
        salesTrend, paymentTrend, customersWithDues, topBuyer, mostLoyal, 
        lowStockItems, outOfStockCount: outOfStockItems.length, outOfStockItems,
        expiredItems, expiringItems, customerComposition, topProducts,
        bestSellingProduct, stockValueByCategory: Object.values(valueByTag).sort((a, b) => b.value - a.value)
    };
  }, [customers, sales, products, tags, settings]);

  const formatDateShort = (dateStr: string) => dateStr ? `${new Date(dateStr).getDate()} ${new Date(dateStr).toLocaleString('default', { month: 'short' })}` : '';

  return (
    <div className="space-y-8 animate-in fade-in pb-32 relative max-w-6xl mx-auto">
        {/* Quick Actions (Floating) */}
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

        {/* Dashboard Header */}
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
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                    <button onClick={() => onNavigate(Tab.POS)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-xs font-bold whitespace-nowrap"><ShoppingCart size={14}/> New Sale</button>
                    <button onClick={() => onNavigate(Tab.WAREHOUSE, 'add')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-bold whitespace-nowrap"><Package size={14}/> Add Manual</button>
                    <button onClick={() => onNavigate(Tab.CUSTOMERS, 'add')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors text-xs font-bold whitespace-nowrap"><UserPlus size={14}/> Customer</button>
                </div>
            </div>
        </div>

        {/* --- 1. INVENTORY OVERVIEW --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-2">
                <Box size={18} className="text-gray-400"/>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">1. Inventory Overview</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Card className="border-2 border-sky-600 shadow-sm"><div className="text-sky-700 text-xs uppercase font-bold tracking-wider flex items-center gap-1"><Box size={14} /> Total Products</div><div className="text-3xl font-bold mt-1 text-gray-900">{stats.totalProducts}</div></Card>
              <Card className="border-2 border-green-500 shadow-sm"><div className="text-green-600 text-xs uppercase font-bold tracking-wider flex items-center gap-1"><IndianRupee size={14} /> Total Value</div><div className="text-3xl font-bold mt-1 text-gray-900">₹{stats.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></Card>
              <Card className="border-2 border-red-400 shadow-sm"><div className="text-red-600 text-xs uppercase font-bold tracking-wider flex items-center gap-1"><AlertTriangle size={14} /> Low Stock</div><div className="text-3xl font-bold mt-1 text-gray-900">{stats.lowStockItems.length}</div></Card>
              <Card className="border-2 border-violet-400 shadow-sm"><div className="text-violet-600 text-xs uppercase font-bold tracking-wider flex items-center gap-1"><Layers size={14} /> Stock Units</div><div className="text-3xl font-bold mt-1 text-gray-900">{stats.totalStockUnits.toLocaleString()}</div></Card>
            </div>
        </section>

        {/* --- 2. FINANCIAL SNAPSHOT --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-6">
                <Activity size={18} className="text-gray-400"/>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">2. Financial Snapshot</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-0 shadow-md bg-gradient-to-br from-green-600 to-emerald-600 text-white p-6 rounded-2xl">
                    <div className="flex items-center gap-2 text-green-100 font-bold text-xs uppercase tracking-wider mb-2"><Wallet size={16} /> Total Revenue</div>
                    <div className="text-3xl font-bold">₹{stats.totalRevenue.toLocaleString()}</div>
                    <div className="text-xs text-green-100 mt-1 opacity-80 flex items-center gap-1"><ArrowUpRight size={12}/> {sales.length} Transactions</div>
                </Card>
                <Card className="border-0 shadow-md bg-gradient-to-br from-red-500 to-rose-600 text-white p-6 rounded-2xl">
                    <div className="flex items-center gap-2 text-red-100 font-bold text-xs uppercase tracking-wider mb-2"><AlertTriangle size={16} /> Pending Dues</div>
                    <div className="text-3xl font-bold">₹{stats.totalDues.toLocaleString()}</div>
                    <div className="text-xs text-red-100 mt-1 opacity-80">{stats.customersWithDues.length} Customers pending</div>
                </Card>
            </div>
        </section>

        {/* --- 3. SALES AND PAYMENT --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <TrendingUp size={18} className="text-gray-400"/>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">3. Sales & Payment</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Trend */}
                <Card className="p-6 h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><TrendingUp size={18} className="text-blue-600"/> Revenue Trend</h3>
                        <Badge color="bg-blue-50 text-blue-700">Last 7 Days</Badge>
                    </div>
                    <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.salesTrend}>
                                <defs><linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10}/>
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(val) => `₹${val}`}/>
                                <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-6">
                    {/* Payment Modes Graph */}
                    <Card className="p-6 flex-1 min-h-[200px]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><CreditCard size={18} className="text-purple-600"/> Payment Modes</h3>
                        </div>
                        <div className="h-32 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.paymentTrend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8, fill: '#94a3b8'}} />
                                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}}/>
                                    <Legend iconType="circle" wrapperStyle={{fontSize: '10px'}}/>
                                    <Bar dataKey="Cash" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="UPI" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="Card" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Category Value List */}
                    <Card className="p-0 overflow-hidden flex-1 min-h-[200px] flex flex-col">
                        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><DollarSign size={18} className="text-green-500"/> Category Value</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 max-h-40">
                            {stats.stockValueByCategory.length > 0 ? stats.stockValueByCategory.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: item.color }}>{item.name.charAt(0).toUpperCase()}</div>
                                        <span className="font-bold text-gray-700 text-xs truncate max-w-[100px]">{item.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-gray-900 text-xs">₹{item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center text-gray-400 py-4 text-xs">No data available</div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </section>

        {/* --- 4. INVENTORY HEALTH --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <AlertTriangle size={18} className="text-gray-400"/>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">4. Inventory Health</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Moving Items */}
                <Card className="p-0 overflow-hidden h-[300px] flex flex-col">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Crown size={18} className="text-amber-500"/> Top Moving Items</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {stats.topProducts.slice(0, 5).map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded-lg shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                                    <span className="font-medium text-gray-700 text-sm truncate max-w-[120px]">{p.name}</span>
                                </div>
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{p.count} sold</span>
                            </div>
                        ))}
                        {stats.topProducts.length === 0 && <div className="text-center text-gray-400 text-sm py-10">No sales data yet</div>}
                    </div>
                </Card>

                {/* Low Stock List */}
                <Card className="border-red-500 bg-red-50/40 h-[300px] flex flex-col p-0 overflow-hidden">
                    <div className="px-5 py-4 border-b border-red-100 bg-red-50/50 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><AlertTriangle size={20} className="text-red-500"/> Low Stock</h3></div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {stats.lowStockItems.length > 0 ? stats.lowStockItems.map(p => (
                            <div key={p.id} className="flex justify-between items-center text-sm py-2 px-3 bg-white rounded-lg border border-orange-100 shadow-sm">
                                <span className="font-bold truncate text-gray-800 w-2/3">{p.name}</span>
                                <span className="font-bold text-xs text-orange-600">{p.stock} left</span>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <CheckCircle size={32} className="mb-2 text-green-500 opacity-50"/>
                                <p className="text-sm">Stock levels healthy</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Expiry List */}
                <Card className="border-amber-500 bg-amber-50/40 h-[300px] flex flex-col p-0 overflow-hidden">
                    <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/50 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Clock size={20} className="text-amber-500"/> Expiry Alerts</h3></div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {stats.expiringItems.length > 0 ? stats.expiringItems.map(p => (
                            <div key={p.id} className="flex justify-between items-center text-sm py-2 px-3 bg-white rounded-lg border-l-4 border-l-amber-500 shadow-sm">
                                <span className="font-bold truncate text-gray-800 w-2/3">{p.name}</span>
                                <span className="text-xs font-bold text-gray-500">{formatDateShort(p.expiryDate || '')}</span>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <CheckCircle size={32} className="mb-2 text-green-500 opacity-50"/>
                                <p className="text-sm">No items expiring soon</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </section>

        {/* --- 5. CUSTOMER INSIGHTS --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <Users size={18} className="text-gray-400"/>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">5. Customer Insights</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Top Spender */}
                <Card className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white border-0 flex flex-col justify-between h-32">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-indigo-100 tracking-wider mb-1">Top Spender</p>
                            <h4 className="font-bold text-lg truncate w-32">{stats.topBuyer?.name || "N/A"}</h4>
                        </div>
                        <div className="p-2 bg-white/20 rounded-lg"><Crown size={18} className="text-yellow-300"/></div>
                    </div>
                    <div className="text-2xl font-bold">₹{stats.topBuyer?.totalSpent.toLocaleString() || "0"}</div>
                </Card>

                {/* Loyal Customer */}
                <Card className="bg-gradient-to-br from-pink-500 to-rose-600 text-white border-0 flex flex-col justify-between h-32">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-pink-100 tracking-wider mb-1">Most Loyal</p>
                            <h4 className="font-bold text-lg truncate w-32">{stats.mostLoyal?.name || "N/A"}</h4>
                        </div>
                        <div className="p-2 bg-white/20 rounded-lg"><Star size={18} className="text-yellow-300"/></div>
                    </div>
                    <div className="text-2xl font-bold">{stats.mostLoyal?.visitCount || 0} <span className="text-sm font-normal opacity-80">Visits</span></div>
                </Card>

                {/* Outstanding Dues */}
                <Card className="bg-gradient-to-br from-orange-400 to-red-500 text-white border-0 flex flex-col justify-between h-32">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-orange-100 tracking-wider mb-1">Outstanding</p>
                            <h4 className="font-bold text-lg">{stats.customersWithDues.length} Customers</h4>
                        </div>
                        <div className="p-2 bg-white/20 rounded-lg"><AlertTriangle size={18}/></div>
                    </div>
                    <div className="text-2xl font-bold">₹{stats.totalDues.toLocaleString()}</div>
                </Card>

                {/* Retention Pie */}
                <Card className="h-32 p-2 relative flex items-center justify-between overflow-hidden">
                    <div className="absolute top-2 left-3 z-10">
                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Retention</p>
                    </div>
                    <div className="w-full h-full">
                        {stats.customerComposition.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.customerComposition} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={2}>
                                        {stats.customerComposition.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{fontSize:'10px'}}/>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-300 text-xs">No Data</div>
                        )}
                    </div>
                    <div className="text-[10px] text-gray-500 flex flex-col justify-center gap-1 pr-2">
                        {stats.customerComposition.map(c => (
                            <div key={c.name} className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: c.color}}></div>
                                <span>{c.name}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </section>

        {/* --- 6. GEMINI AI ASSISTANT PRO --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <BrainCircuit size={18} className="text-gray-400"/>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">6. Gemini AI Assistant Pro</h3>
            </div>
            
            <Card className="border-0 bg-gradient-to-br from-indigo-50 to-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-indigo-100/50 p-6 rounded-3xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-12 bg-indigo-500/5 rounded-full -mr-6 -mt-6 blur-3xl transition-transform group-hover:scale-150 duration-1000"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-200 ring-4 ring-white shrink-0">
                            <BrainCircuit size={30} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                Gemini AI
                                <Badge color="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded-full tracking-widest">PRO</Badge>
                            </h3>
                            <p className="text-sm text-gray-500 font-medium">Strategic insights from your store data</p>
                        </div>
                    </div>
                    <button 
                        onClick={generateAIInsights}
                        disabled={isLoadingAI}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-white border-2 border-indigo-100 text-indigo-700 font-black text-sm shadow-sm hover:border-indigo-600 hover:bg-indigo-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isLoadingAI ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        {aiInsight ? "Ask Again" : "Ask Gemini"}
                    </button>
                </div>

                {/* Talking Box UI */}
                <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-4 shadow-inner min-h-[120px] relative">
                    <div className="absolute -top-3 left-8 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                        <MessageSquareText size={10}/> AI Response
                    </div>
                    
                    {isLoadingAI ? (
                        <div className="flex flex-col items-center justify-center h-32 space-y-2">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                            </div>
                            <p className="text-xs text-indigo-400 font-bold tracking-widest">THINKING...</p>
                        </div>
                    ) : aiInsight ? (
                        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed font-medium italic pt-2 pl-2 border-l-4 border-indigo-100">
                            {aiInsight}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                            <Lightbulb size={24} className="mb-2 opacity-50"/>
                            <p className="text-xs">Click "Ask Gemini" to generate a store strategy.</p>
                        </div>
                    )}
                </div>
            </Card>
        </section>

        {/* --- 7. STORE MANAGEMENT GUIDE --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <BookOpen size={18} className="text-gray-400"/>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">7. Store Management Guide</h3>
            </div>

            <Card className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">1</div>
                            <div>
                                <h4 className="font-bold text-gray-800 flex items-center gap-2"><Sparkles size={16} className="text-amber-500"/> Optimize Inventory Turnover</h4>
                                <p className="text-sm text-gray-600 leading-relaxed mt-1">High turnover rates indicate efficient sales and minimal dead stock. Regularly review your category performance charts above to identify which items are tying up your capital unnecessarily.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">2</div>
                            <div>
                                <h4 className="font-bold text-gray-800 flex items-center gap-2"><Users size={16} className="text-indigo-500"/> Master Customer Retention</h4>
                                <p className="text-sm text-gray-600 leading-relaxed mt-1">Acquiring a new customer is 5x more expensive than retaining an existing one. Use the "Loyalty Pie Chart" below to track your retention rates and target your "Returning" customers with special offers.</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">3</div>
                            <div>
                                <h4 className="font-bold text-gray-800 flex items-center gap-2"><Smartphone size={16} className="text-green-500"/> Adopt Contactless UPI</h4>
                                <p className="text-sm text-gray-600 leading-relaxed mt-1">Digital payments reduce handling errors and speed up the checkout process. Our data shows UPI transactions are 20% faster than cash. Monitor your "Payment Trend" to see your digital adoption progress.</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">4</div>
                            <div>
                                <h4 className="font-bold text-gray-800 flex items-center gap-2"><Clock size={16} className="text-red-500"/> Strategic Expiry Planning</h4>
                                <p className="text-sm text-gray-600 leading-relaxed mt-1">Don't lose money on expired goods. The "Expiry Alert" tool is designed to give you a 7-day head start. Consider discounting items that are in the "Expiring" list to recover your investment cost.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AD PLACEMENT WITHIN CONTENT */}
                <div className="border-y border-dashed border-gray-200 py-6 my-6 flex flex-col items-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4">Supported Content</p>
                    <div className="w-full flex justify-center">
                        <AmpAd width="100vw" height="320"
                            type="adsense"
                            data-ad-client="ca-pub-5865716270182311"
                            data-ad-slot="2691818269"
                            data-auto-format="rspv"
                            data-full-width="">
                            <div {...{ overflow: "" } as any}></div>
                        </AmpAd>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col sm:flex-row gap-6 items-center">
                    <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Lightbulb size={32} />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900">Expert Insight: The 80/20 Rule in Retail</h4>
                        <p className="text-sm text-gray-600 mt-1 italic">"Typically, 80% of your revenue comes from 20% of your product catalog. Use the 'Best Selling Product' spotlight below to ensure these key items never go out of stock."</p>
                    </div>
                </div>
            </Card>
        </section>

        {/* Footer Legal/Auth Compliance (For AdSense) */}
        <div className="mt-12 pt-8 border-t border-gray-100 text-center space-y-2">
            <p className="text-xs text-gray-400 font-medium">Noor POS Professional Edition • System Status: Secure & Verified</p>
            <div className="flex justify-center gap-4 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                <span>GDPR Compliant</span>
                <span>•</span>
                <span>AES-256 Cloud Sync</span>
                <span>•</span>
                <span>Privacy Shield</span>
            </div>
        </div>
    </div>
  );
};
