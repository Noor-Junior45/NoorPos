import React, { useState, useEffect, useMemo } from 'react';
import { StoreService } from '../services/storeService';
import { GeminiService } from '../services/geminiService';
import { Customer, Sale, Product, Tab, Tag, StoreSettings } from '../types';
import { Card, Badge, Button, Modal } from '../components/UI';
import { TrendingUp, Crown, Star, LayoutDashboard, IndianRupee, AlertTriangle, Phone, ArrowUpRight, Package, Wallet, ShoppingBag, PieChart as PieChartIcon, Users, UserPlus, Plus, ShoppingCart, ArrowRight, CheckCircle, DollarSign, Scan, Clock, CheckSquare, Sparkles, Banknote, Smartphone, CreditCard, Trophy, BarChart3, Box, Layers, Loader2, X, BrainCircuit, RefreshCw, MessageSquareText, ShieldCheck, Lightbulb, BookOpen, Activity, Terminal, ChevronRight, Search, Hourglass } from 'lucide-react';
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
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  
  // Detail Modal States
  const [activeDetail, setActiveDetail] = useState<'LOW_STOCK' | 'EXPIRING' | 'DUES' | null>(null);

  // Gemini AI States
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // --- Browser/Gesture Back Navigation Logic ---
  useEffect(() => {
    const handleNavigationPop = (e: any) => {
        if (activeDetail) {
            setActiveDetail(null);
        }
    };
    window.addEventListener('app-navigation-pop' as any, handleNavigationPop);
    return () => window.removeEventListener('app-navigation-pop' as any, handleNavigationPop);
  }, [activeDetail]);

  const openDetail = (type: 'LOW_STOCK' | 'EXPIRING' | 'DUES') => {
      window.history.pushState({ tab: Tab.DASHBOARD, depth: 1 }, '');
      setActiveDetail(type);
  };

  const closeDetail = () => {
      setActiveDetail(null);
      window.history.back();
  };

  useEffect(() => {
    loadData();
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
          setAiError("Could not connect to AI assistant.");
          console.error(err);
      } finally {
          setIsLoadingAI(false);
      }
  };

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
    const totalDues = customers.reduce((acc, c) => acc + (c.totalDues || 0), 0);
    const inventoryValue = products.reduce((acc, p) => acc + (p.stock * p.sellPrice), 0);
    const totalProducts = products.length;
    const totalStockUnits = products.reduce((acc, p) => acc + p.stock, 0);

    const last7DaysDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    const salesTrend = last7DaysDates.map(date => {
        const dayTotal = sales
            .filter(s => s.timestamp.startsWith(date))
            .reduce((acc, s) => acc + s.total, 0);
        return { name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }), value: dayTotal };
    });

    const getMethodTrend = (method: string) => last7DaysDates.map(date => ({
        value: sales.filter(s => s.timestamp.startsWith(date) && s.paymentMethod === method)
                    .reduce((acc, s) => acc + s.total, 0)
    }));

    const cashTotal = sales.filter(s => s.paymentMethod === 'Cash').reduce((acc, s) => acc + s.total, 0);
    const upiTotal = sales.filter(s => s.paymentMethod === 'UPI').reduce((acc, s) => acc + s.total, 0);
    const cardTotal = sales.filter(s => s.paymentMethod === 'Card').reduce((acc, s) => acc + s.total, 0);
    const payLaterTotal = sales.filter(s => s.paymentMethod === 'Pay Later').reduce((acc, s) => acc + s.total, 0);

    const customersWithDues = customers
        .filter(c => (c.totalDues || 0) > 0)
        .sort((a, b) => b.totalDues - a.totalDues);

    const topBuyer = [...customers].sort((a, b) => b.totalSpent - a.totalSpent)[0];
    const mostLoyal = [...customers].sort((a, b) => b.visitCount - a.visitCount)[0];

    const customerComposition = [
        { name: 'New', value: customers.filter(c => c.visitCount === 1).length, color: '#94a3b8' },
        { name: 'Returning', value: customers.filter(c => c.visitCount > 1 && c.visitCount <= 5).length, color: '#60a5fa' },
        { name: 'Loyal', value: customers.filter(c => c.visitCount > 5).length, color: '#2563eb' }
    ].filter(i => i.value > 0);

    const lowStockItems = products
        .filter(p => p.stock <= (p.lowStockThreshold || settings?.lowStockDefault || 10) && p.stock > 0)
        .sort((a, b) => a.stock - b.stock);

    const expiringItems = products.filter(p => {
        if (!p.expiryDate) return false;
        const today = new Date();
        today.setHours(0,0,0,0);
        const exp = new Date(p.expiryDate);
        exp.setHours(0,0,0,0);
        const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const threshold = settings?.expiryAlertDays || 7;
        return diff >= 0 && diff <= threshold;
    }).map(p => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const exp = new Date(p.expiryDate!);
        exp.setHours(0,0,0,0);
        const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { ...p, daysLeft };
    }).sort((a, b) => a.daysLeft - b.daysLeft);

    const productSales: Record<string, number> = {};
    sales.forEach(s => s.items.forEach(i => productSales[i.name] = (productSales[i.name] || 0) + i.quantity));
    const topProducts = Object.entries(productSales).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => ({ name, count }));
    
    const valueByTag: { [key: string]: { name: string, value: number, color: string } } = {};
    tags.forEach(tag => { valueByTag[tag.id] = { name: tag.name, value: 0, color: tag.color }; });
    products.forEach(p => {
        const value = p.stock * p.sellPrice;
        if (p.tagId && valueByTag[p.tagId]) valueByTag[p.tagId].value += value;
    });

    return { 
        totalRevenue, totalDues, inventoryValue, totalProducts, totalStockUnits,
        salesTrend, 
        cashTotal, upiTotal, cardTotal, payLaterTotal,
        cashTrend: getMethodTrend('Cash'),
        upiTrend: getMethodTrend('UPI'),
        cardTrend: getMethodTrend('Card'),
        payLaterTrend: getMethodTrend('Pay Later'),
        customersWithDues, topBuyer, mostLoyal, 
        lowStockItems, expiringItems, customerComposition, topProducts,
        stockValueByCategory: Object.values(valueByTag).sort((a, b) => b.value - a.value)
    };
  }, [customers, sales, products, tags, settings]);

  const formatDateShort = (dateStr: string) => dateStr ? `${new Date(dateStr).getDate()} ${new Date(dateStr).toLocaleString('default', { month: 'short' })}` : '';

  const MiniSparkline = ({ data, color }: { data: any[], color: string }) => (
    <div className="h-10 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <defs>
                    <linearGradient id={`color-${color}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#color-${color})`} isAnimationActive={false} />
            </AreaChart>
        </ResponsiveContainer>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in pb-32 relative max-w-6xl mx-auto">
        {/* Floating Scanner Action */}
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30">
            <button 
                onClick={() => onNavigate(Tab.WAREHOUSE, 'scan_add')}
                className="flex items-center gap-3 pl-3 pr-6 py-2.5 rounded-full bg-white/40 backdrop-blur-xl border border-white/60 text-gray-800 hover:bg-white/60 transition-all active:scale-95 shadow-lg group"
            >
                <div className="p-2 bg-red-600 rounded-full text-white shadow-lg shadow-red-500/30">
                    <Scan size={18} className="group-hover:rotate-12 transition-transform"/>
                </div>
                <span className="font-bold tracking-wide text-sm mr-1 text-gray-950">Scan to Add</span>
            </button>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 pt-2">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <LayoutDashboard size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-950">Overview</h2>
                    <p className="text-gray-500 font-medium">Business insights & performance</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
                    <button onClick={() => onNavigate(Tab.POS)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-xs font-black"><ShoppingCart size={14}/> NEW SALE</button>
                    <button onClick={() => onNavigate(Tab.WAREHOUSE, 'add')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-black"><Package size={14}/> ADD STOCK</button>
                </div>
            </div>
        </div>

        {/* --- INVENTORY OVERVIEW --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <Box size={22} className="text-sky-600"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Inventory Overview</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-2 border-sky-200 shadow-sm p-5 hover:border-sky-500 transition-colors">
                  <div className="text-sky-700 text-[10px] uppercase font-black tracking-widest flex items-center gap-1 mb-1"><Box size={12} /> Total Products</div>
                  <div className="text-4xl font-black text-gray-950">{stats.totalProducts}</div>
              </Card>
              <Card className="border-2 border-emerald-200 shadow-sm p-5 hover:border-emerald-500 transition-colors">
                  <div className="text-emerald-700 text-[10px] uppercase font-black tracking-widest flex items-center gap-1 mb-1"><IndianRupee size={12} /> Total Value</div>
                  <div className="text-3xl font-black text-gray-950">₹{stats.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </Card>
              <Card onClick={() => openDetail('LOW_STOCK')} className="border-2 border-rose-200 shadow-sm p-5 hover:border-rose-500 transition-colors cursor-pointer active:scale-95 group">
                  <div className="text-rose-700 text-[10px] uppercase font-black tracking-widest flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1"><AlertTriangle size={12} /> Low Stock</span>
                      <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                  </div>
                  <div className="text-4xl font-black text-gray-950">{stats.lowStockItems.length}</div>
              </Card>
              <Card className="border-2 border-violet-200 shadow-sm p-5 hover:border-violet-500 transition-colors">
                  <div className="text-violet-700 text-[10px] uppercase font-black tracking-widest flex items-center gap-1 mb-1"><Layers size={12} /> Stock Units</div>
                  <div className="text-3xl font-black text-gray-950">{stats.totalStockUnits.toLocaleString()}</div>
              </Card>
            </div>
        </section>

        {/* --- FINANCIAL SNAPSHOT --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <Activity size={22} className="text-emerald-600"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Financial Snapshot</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-600 to-green-700 text-white p-7 rounded-3xl relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-700"><Wallet size={120}/></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-emerald-100 font-black text-[10px] uppercase tracking-widest mb-2"><Wallet size={16} /> Total Revenue</div>
                        <div className="text-4xl font-black">₹{stats.totalRevenue.toLocaleString()}</div>
                        <div className="text-xs text-emerald-100 mt-2 font-bold opacity-80 flex items-center gap-1"><ArrowUpRight size={14}/> {sales.length} Transactions Recorded</div>
                    </div>
                </Card>
                <Card onClick={() => openDetail('DUES')} className="border-0 shadow-xl bg-gradient-to-br from-rose-500 to-red-700 text-white p-7 rounded-3xl relative overflow-hidden group cursor-pointer active:scale-95">
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-700"><AlertTriangle size={120}/></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between gap-2 text-rose-100 font-black text-[10px] uppercase tracking-widest mb-2">
                            <span className="flex items-center gap-2"><AlertTriangle size={16} /> Outstanding Dues</span>
                            <ArrowUpRight size={16} />
                        </div>
                        <div className="text-4xl font-black">₹{stats.totalDues.toLocaleString()}</div>
                        <div className="text-xs text-rose-100 mt-2 font-bold opacity-80">{stats.customersWithDues.length} Customers pending</div>
                    </div>
                </Card>
            </div>
        </section>

        {/* --- PAYMENT BREAKDOWN --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <Banknote size={22} className="text-blue-600"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Live Flow Tracking</h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-2 border-emerald-100 p-4 hover:border-emerald-500 transition-all flex flex-col justify-between group">
                    <div className="flex items-center justify-between text-emerald-600 mb-1">
                        <div className="flex items-center gap-1.5">
                            <Banknote size={16}/>
                            <span className="text-[10px] font-black uppercase tracking-widest">Cash</span>
                        </div>
                        <Badge color="bg-emerald-50 text-emerald-700 text-[8px] px-1">LIVE</Badge>
                    </div>
                    <div className="text-2xl font-black text-gray-950">₹{stats.cashTotal.toLocaleString()}</div>
                    <MiniSparkline data={stats.cashTrend} color="#10b981" />
                </Card>
                <Card className="bg-white border-2 border-blue-100 p-4 hover:border-blue-500 transition-all flex flex-col justify-between group">
                    <div className="flex items-center justify-between text-blue-600 mb-1">
                        <div className="flex items-center gap-1.5">
                            <Smartphone size={16}/>
                            <span className="text-[10px] font-black uppercase tracking-widest">UPI</span>
                        </div>
                        <Badge color="bg-blue-50 text-blue-700 text-[8px] px-1">FAST</Badge>
                    </div>
                    <div className="text-2xl font-black text-gray-950">₹{stats.upiTotal.toLocaleString()}</div>
                    <MiniSparkline data={stats.upiTrend} color="#3b82f6" />
                </Card>
                <Card className="bg-white border-2 border-indigo-100 p-4 hover:border-indigo-500 transition-all flex flex-col justify-between group">
                    <div className="flex items-center justify-between text-indigo-600 mb-1">
                        <div className="flex items-center gap-1.5">
                            <CreditCard size={16}/>
                            <span className="text-[10px] font-black uppercase tracking-widest">Card</span>
                        </div>
                        <Badge color="bg-indigo-50 text-indigo-700 text-[8px] px-1">SYNC</Badge>
                    </div>
                    <div className="text-2xl font-black text-gray-950">₹{stats.cardTotal.toLocaleString()}</div>
                    <MiniSparkline data={stats.cardTrend} color="#8b5cf6" />
                </Card>
                <Card className="bg-white border-2 border-amber-100 p-4 hover:border-amber-500 transition-all flex flex-col justify-between group">
                    <div className="flex items-center justify-between text-amber-600 mb-1">
                        <div className="flex items-center gap-1.5">
                            <Clock size={16}/>
                            <span className="text-[10px] font-black uppercase tracking-widest">Pay Later</span>
                        </div>
                        <Badge color="bg-amber-50 text-amber-700 text-[8px] px-1">DUES</Badge>
                    </div>
                    <div className="text-2xl font-black text-gray-950">₹{stats.payLaterTotal.toLocaleString()}</div>
                    <MiniSparkline data={stats.payLaterTrend} color="#f59e0b" />
                </Card>
            </div>
        </section>

        {/* --- SALES TREND --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <TrendingUp size={22} className="text-indigo-600"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Sales Trend</h3>
            </div>
            <Card className="p-8 border-2 border-indigo-50 shadow-sm h-[350px]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-gray-900 text-lg">Revenue History (7 Days)</h3>
                    <Badge color="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">LIVE FEED</Badge>
                </div>
                <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.salesTrend}>
                            <defs><linearGradient id="colorSalesMain" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 'bold'}} dy={10}/>
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b', fontWeight: 'bold'}} tickFormatter={(val) => `₹${val}`}/>
                            <Tooltip contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}/>
                            <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorSalesMain)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </section>

        {/* --- INVENTORY HEALTH --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <AlertTriangle size={22} className="text-red-600"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Inventory Health</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="p-0 overflow-hidden h-[340px] flex flex-col border-2 border-indigo-50">
                    <div className="px-6 py-5 border-b border-indigo-50 bg-indigo-50/20 flex justify-between items-center">
                        <h3 className="font-black text-gray-950 flex items-center gap-2 text-sm"><Crown size={18} className="text-amber-500"/> TOP MOVING ITEMS</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {stats.topProducts.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-black">{idx + 1}</div>
                                    <span className="font-bold text-gray-900 text-sm truncate max-w-[120px]">{p.name}</span>
                                </div>
                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase">{p.count} sold</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card onClick={() => openDetail('LOW_STOCK')} className="border-2 border-rose-100 bg-rose-50/20 h-[340px] flex flex-col p-0 overflow-hidden cursor-pointer active:scale-[0.99] group">
                    <div className="px-6 py-5 border-b border-rose-100 bg-rose-100/30 flex justify-between items-center">
                        <h3 className="font-black text-gray-950 flex items-center gap-2 text-sm uppercase"><AlertTriangle size={20} className="text-rose-600"/> Critical Low Stock</h3>
                        <ChevronRight size={18} className="text-rose-400 group-hover:translate-x-1 transition-transform"/>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {stats.lowStockItems.length > 0 ? stats.lowStockItems.slice(0, 5).map(p => (
                            <div key={p.id} className="flex justify-between items-center text-sm py-3 px-4 bg-white rounded-xl border border-rose-100 shadow-sm hover:border-rose-400 transition-colors">
                                <span className="font-bold truncate text-gray-900 w-2/3">{p.name}</span>
                                <span className="font-black text-xs text-rose-600 whitespace-nowrap">{p.stock} units</span>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-40">
                                <CheckCircle size={48} className="mb-3 text-emerald-500"/>
                                <p className="text-sm font-bold uppercase tracking-widest">Levels Healthy</p>
                            </div>
                        )}
                        {stats.lowStockItems.length > 5 && <div className="text-center pt-2 text-[10px] font-bold text-rose-400 uppercase">View {stats.lowStockItems.length - 5} More...</div>}
                    </div>
                </Card>

                <Card onClick={() => openDetail('EXPIRING')} className="border-2 border-amber-100 bg-amber-50/20 h-[340px] flex flex-col p-0 overflow-hidden cursor-pointer active:scale-[0.99] group">
                    <div className="px-6 py-5 border-b border-amber-100 bg-amber-100/30 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-gray-950 flex items-center gap-2 text-sm uppercase"><Clock size={20} className="text-amber-600"/> Expiring Soon</h3>
                            <ChevronRight size={18} className="text-amber-400 group-hover:translate-x-1 transition-transform"/>
                        </div>
                        <div className="flex items-center gap-1">
                            <Badge color="bg-amber-100 text-amber-700 text-[8px] font-black uppercase tracking-tighter">Preference: {settings?.expiryAlertDays || 7} Days</Badge>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                         {stats.expiringItems.length > 0 ? stats.expiringItems.slice(0, 5).map(p => (
                            <div key={p.id} className="flex flex-col gap-1 p-3 bg-white rounded-xl border border-amber-100 shadow-sm hover:border-amber-400 transition-colors">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold truncate text-gray-900 text-sm">{p.name}</span>
                                    <Badge color={p.daysLeft === 0 ? "bg-red-500 text-white" : "bg-amber-500 text-white"}>
                                        {p.daysLeft === 0 ? 'Today' : `${p.daysLeft}d left`}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase">
                                    <span>Stock: {p.stock}</span>
                                    <span>Exp: {formatDateShort(p.expiryDate || '')}</span>
                                </div>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-40">
                                <ShieldCheck size={48} className="mb-3 text-emerald-500"/>
                                <p className="text-sm font-bold uppercase tracking-widest">No Expiry Risk</p>
                            </div>
                        )}
                        {stats.expiringItems.length > 5 && <div className="text-center pt-2 text-[10px] font-bold text-amber-400 uppercase">View {stats.expiringItems.length - 5} More...</div>}
                    </div>
                </Card>
            </div>
        </section>

        {/* --- CUSTOMER INSIGHTS --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1">
                <Users size={22} className="text-purple-600"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Customer Insights</h3>
            </div>
            
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-amber-50/30 border-2 border-amber-200 p-6 flex items-center gap-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-110 transition-transform"></div>
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shrink-0 group-hover:rotate-3 transition-transform">
                            <Crown size={36} className="text-white" />
                        </div>
                        <div className="flex-1 relative z-10">
                            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1 opacity-80">Top Spender</p>
                            <h4 className="text-2xl font-black text-gray-950 leading-tight mb-1 truncate">{stats.topBuyer?.name || "No data"}</h4>
                            <p className="text-sm font-medium text-gray-500">Value: <span className="text-green-600 font-black">₹{stats.topBuyer?.totalSpent.toLocaleString() || "0"}</span></p>
                        </div>
                    </Card>

                    <Card className="bg-blue-50/30 border-2 border-blue-200 p-6 flex items-center gap-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-110 transition-transform"></div>
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg shrink-0 group-hover:rotate-3 transition-transform">
                            <Star size={36} className="text-white" />
                        </div>
                        <div className="flex-1 relative z-10">
                            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1 opacity-80">Most Loyal</p>
                            <h4 className="text-2xl font-black text-gray-950 leading-tight mb-1 truncate">{stats.mostLoyal?.name || "No data"}</h4>
                            <p className="text-sm font-medium text-gray-500">History: <span className="text-blue-600 font-black">{stats.mostLoyal?.visitCount || "0"} Visits</span></p>
                        </div>
                    </Card>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card onClick={() => openDetail('DUES')} className="bg-gradient-to-br from-orange-500 to-red-700 text-white border-0 h-24 p-5 flex items-center justify-between shadow-xl rounded-2xl cursor-pointer hover:shadow-2xl transition-all active:scale-95 group">
                        <div>
                            <p className="text-[10px] uppercase font-black text-orange-100 mb-0.5 tracking-widest">Total Outstanding</p>
                            <h4 className="font-black text-lg truncate flex items-center gap-2">{stats.customersWithDues.length} ACTIVE DEBTORS <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform"/></h4>
                        </div>
                        <div className="text-2xl font-black">₹{stats.totalDues.toLocaleString()}</div>
                    </Card>

                    <Card className="h-24 p-4 flex items-center justify-between shadow-md bg-indigo-50/20 border-2 border-indigo-100 rounded-2xl group hover:border-indigo-400 transition-all">
                        <div className="flex flex-col">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Customer Retention</p>
                            <div className="text-[10px] text-gray-500 flex flex-col gap-1">
                                {stats.customerComposition.map(c => (
                                    <div key={c.name} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: c.color}}></div>
                                        <span className="font-black text-gray-700 uppercase">{c.name}: {c.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="w-16 h-16 shrink-0 group-hover:scale-110 transition-transform">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.customerComposition} dataKey="value" cx="50%" cy="50%" innerRadius={14} outerRadius={26} paddingAngle={3}>
                                        {stats.customerComposition.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            </div>
        </section>

        {/* --- GEMINI AI ASSISTANT --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <BrainCircuit size={22} className="text-indigo-600"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Gemini AI Assistant Pro</h3>
            </div>
            
            <Card className="border-4 bg-[#fdfdfc] shadow-2xl p-8 rounded-[2.5rem] relative overflow-hidden group transition-all duration-500" style={{ borderImage: 'linear-gradient(45deg, #4285F4, #EA4335, #FBBC05, #34A853) 1' }}>
                <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-red-500/5 transition-all duration-1000"></div>
                <div className="absolute bottom-0 left-0 p-24 bg-green-500/5 rounded-full -ml-8 -mb-8 blur-3xl group-hover:bg-yellow-500/5 transition-all duration-1000"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-3xl bg-white text-gray-900 flex items-center justify-center shadow-xl shrink-0 ring-1 ring-gray-100 group-hover:ring-indigo-100 transition-all">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="url(#geminiGradient)" />
                                <defs>
                                    <linearGradient id="geminiGradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#4285F4" />
                                        <stop offset="0.33" stopColor="#EA4335" />
                                        <stop offset="0.66" stopColor="#FBBC05" />
                                        <stop offset="1" stopColor="#34A853" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-950 flex items-center gap-3">
                                Gemini AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-red-500 to-green-600 text-[10px] tracking-[0.3em] font-black uppercase">Analytics Engine</span>
                            </h3>
                            <p className="text-gray-500 text-sm font-bold tracking-wide">Deep context-aware store strategy</p>
                        </div>
                    </div>
                    <button 
                        onClick={generateAIInsights}
                        disabled={isLoadingAI}
                        className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gray-900 text-white font-black text-sm shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isLoadingAI ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                        {aiInsight ? "REFRESH INTELLIGENCE" : "GENERATE STRATEGY"}
                    </button>
                </div>

                <div className="mt-8 bg-white/60 backdrop-blur-md border border-gray-200 rounded-[2rem] p-8 shadow-inner min-h-[180px] relative transition-colors group-hover:border-indigo-100">
                    <div className="absolute -top-3 left-8 bg-white border border-gray-100 text-gray-900 text-[9px] font-black px-5 py-2 rounded-full shadow-md flex items-center gap-2 uppercase tracking-[0.2em]">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Processing Core
                    </div>
                    
                    {isLoadingAI ? (
                        <div className="flex flex-col items-center justify-center h-40 space-y-5">
                            <div className="flex gap-3">
                                <div className="w-4 h-4 bg-[#4285F4] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-4 h-4 bg-[#EA4335] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-4 h-4 bg-[#FBBC05] rounded-full animate-bounce"></div>
                            </div>
                            <p className="text-gray-400 font-black text-[10px] tracking-[0.4em] uppercase animate-pulse">Mapping Data Nodes...</p>
                        </div>
                    ) : aiInsight ? (
                        <div className="max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed italic font-bold border-l-4 border-gray-200 pl-8 py-2 text-lg">
                            {aiInsight}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-300 text-sm font-black uppercase tracking-[0.3em] text-center">
                            <Lightbulb size={40} className="mb-4 opacity-10"/>
                            System Idle • Standby Mode
                        </div>
                    )}
                </div>
            </Card>
        </section>

        {/* --- DRILL-DOWN MODALS --- */}
        <Modal isOpen={activeDetail === 'LOW_STOCK'} onClose={closeDetail} title="Inventory Restock List" className="!max-w-3xl">
            <div className="space-y-4">
                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4 mb-4">
                    <div className="p-3 bg-white rounded-xl text-rose-600 shadow-sm"><AlertTriangle size={24}/></div>
                    <div>
                        <h4 className="font-black text-rose-900 uppercase text-xs tracking-widest">Restock Required</h4>
                        <p className="text-rose-700/70 text-sm font-medium leading-relaxed">The following items have dropped below your configured safety threshold.</p>
                    </div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 no-scrollbar">
                    {stats.lowStockItems.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-rose-300 transition-all">
                            <div className="flex flex-col">
                                <span className="font-black text-gray-900">{p.name}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Threshold: {p.lowStockThreshold || 10} units</span>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-black text-rose-600">{p.stock} <span className="text-[10px] uppercase">{p.unit}</span></div>
                                <button onClick={() => { closeDetail(); onNavigate(Tab.WAREHOUSE, 'add'); }} className="text-[9px] font-black text-blue-600 uppercase border-b border-blue-200 hover:text-blue-700 transition-colors">Order Now</button>
                            </div>
                        </div>
                    ))}
                </div>
                <Button onClick={closeDetail} className="w-full mt-4 py-4 font-black uppercase tracking-widest rounded-2xl">Dismiss</Button>
            </div>
        </Modal>

        <Modal isOpen={activeDetail === 'EXPIRING'} onClose={closeDetail} title="Expiry Protection" className="!max-w-3xl">
            <div className="space-y-4">
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-4 mb-4">
                    <div className="p-3 bg-white rounded-xl text-amber-600 shadow-sm"><Clock size={24}/></div>
                    <div>
                        <h4 className="font-black text-amber-900 uppercase text-xs tracking-widest">Capital Recovery</h4>
                        <p className="text-amber-700/70 text-sm font-medium leading-relaxed">These items expire within 7 days. Consider a flash sale to recover your investment.</p>
                    </div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 no-scrollbar">
                    {stats.expiringItems.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-amber-300 transition-all">
                            <div className="flex-1 pr-4">
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-gray-900 block">{p.name}</span>
                                    <Badge color={p.daysLeft === 0 ? "bg-red-500 text-white" : "bg-amber-500 text-white"}>{p.daysLeft}d</Badge>
                                </div>
                                <div className="flex gap-2 mt-1">
                                    <Badge color="bg-amber-100 text-amber-700 text-[9px] uppercase">{formatDateShort(p.expiryDate || '')}</Badge>
                                    <Badge color="bg-gray-100 text-gray-600 text-[9px] uppercase">Stock: {p.stock}</Badge>
                                </div>
                            </div>
                            <Button onClick={() => { closeDetail(); onNavigate(Tab.POS); }} size="sm" variant="neutral" className="border-amber-200 text-amber-700 font-black uppercase text-[10px] shrink-0">SELL NOW</Button>
                        </div>
                    ))}
                </div>
                <Button onClick={closeDetail} className="w-full mt-4 py-4 font-black uppercase tracking-widest rounded-2xl">Dismiss</Button>
            </div>
        </Modal>

        <Modal isOpen={activeDetail === 'DUES'} onClose={closeDetail} title="Outstanding Debtors" className="!max-w-3xl">
            <div className="space-y-4">
                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4 mb-4">
                    <div className="p-3 bg-white rounded-xl text-rose-600 shadow-sm"><IndianRupee size={24}/></div>
                    <div>
                        <h4 className="font-black text-rose-900 uppercase text-xs tracking-widest">Cashflow Leakage</h4>
                        <p className="text-rose-700/70 text-sm font-medium leading-relaxed">A total of ₹{stats.totalDues.toLocaleString()} is currently locked in credit accounts.</p>
                    </div>
                </div>
                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 no-scrollbar">
                    {stats.customersWithDues.map(c => (
                        <div key={c.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-rose-300 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black">{c.name.charAt(0)}</div>
                                <div><span className="font-black text-gray-900 block">{c.name}</span><span className="text-[10px] text-gray-400 font-bold uppercase">{c.phone}</span></div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-black text-rose-600">₹{c.totalDues.toLocaleString()}</div>
                                <button onClick={() => { closeDetail(); onNavigate(Tab.CUSTOMERS); }} className="text-[9px] font-black text-blue-600 uppercase border-b border-blue-200 hover:text-blue-700 transition-colors">Record Payment</button>
                            </div>
                        </div>
                    ))}
                </div>
                <Button onClick={closeDetail} className="w-full mt-4 py-4 font-black uppercase tracking-widest rounded-2xl">Dismiss</Button>
            </div>
        </Modal>

        {/* Growth Guide */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <BookOpen size={22} className="text-gray-700"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Growth Guide</h3>
            </div>
            <Card className="bg-white rounded-3xl border-2 border-gray-100 shadow-sm p-10 group hover:border-blue-500 transition-all duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-10">
                    <div className="space-y-6">
                        <div className="flex gap-5">
                            <div className="shrink-0 w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xl shadow-sm border border-blue-100">1</div>
                            <div>
                                <h4 className="font-black text-gray-950 text-lg uppercase tracking-tight">Turnover Optimization</h4>
                                <p className="text-sm text-gray-600 mt-1 font-medium leading-relaxed">High turnover rates mean efficient sales. Use the inventory health section above to flush out dead stock that is freezing your cash.</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="flex gap-5">
                            <div className="shrink-0 w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xl shadow-sm border border-emerald-100">2</div>
                            <div>
                                <h4 className="font-black text-gray-950 text-lg uppercase tracking-tight">Digital First Billing</h4>
                                <p className="text-sm text-gray-600 mt-1 font-medium leading-relaxed">The 80/20 rule: 80% of revenue usually comes from 20% of your items. Prioritize keeping your Best Sellers in stock at all times.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-950 rounded-[2rem] p-8 flex flex-col sm:flex-row gap-8 items-center text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 opacity-20 blur-3xl"></div>
                    <div className="w-20 h-20 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/20">
                        <Lightbulb size={40} className="text-amber-400" />
                    </div>
                    <div>
                        <h4 className="font-black text-xl uppercase tracking-wider mb-1">PRO ADVICE</h4>
                        <p className="text-sm text-gray-400 leading-relaxed font-medium italic">"Maximize revenue by identifying which payment methods your customers prefer. Our data shows UPI transactions often lead to higher cart totals."</p>
                    </div>
                </div>

                <div className="w-full flex justify-center mt-10">
                    <AmpAd width="100vw" height="320" type="adsense" data-ad-client="ca-pub-5865716270182311" data-ad-slot="2691818269" data-auto-format="rspv" data-full-width="">
                        <div {...{ overflow: "" } as any}></div>
                    </AmpAd>
                </div>
            </Card>
        </section>

        <div className="mt-12 pt-10 border-t border-gray-100 text-center space-y-3">
            <div className="flex justify-center gap-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
                <span>Secure Banking Grade Sync</span>
                <span>•</span>
                <span>Noor POS Enterprise</span>
            </div>
            <p className="text-xs text-gray-300 font-bold uppercase tracking-widest">© 2025 System Status: Verified & Encrypted</p>
        </div>
    </div>
  );
};
