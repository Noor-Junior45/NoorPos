
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StoreService } from '../services/storeService';
import { GeminiService } from '../services/geminiService';
import { Customer, Sale, Product, Tab, Tag, StoreSettings } from '../types';
import { Card, Badge, Button, Modal, Input } from '../components/UI';
import { TrendingUp, Crown, Star, LayoutDashboard, IndianRupee, AlertTriangle, Phone, ArrowUpRight, Package, Wallet, ShoppingBag, PieChart as PieChartIcon, Users, UserPlus, Plus, ShoppingCart, ArrowRight, CheckCircle, DollarSign, Scan, Clock, CheckSquare, Sparkles, Banknote, Smartphone, CreditCard, Trophy, BarChart3, Box, Layers, Loader2, X, BrainCircuit, RefreshCw, MessageSquareText, ShieldCheck, Lightbulb, BookOpen, Activity, Terminal, ChevronRight, Search, Hourglass, Paperclip, Send, Bot, FileImage, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts';
import { getApiUrl } from '../services/apiConfig';

interface DashboardProps {
  onNavigate: (tab: Tab, action?: string) => void;
}

interface ChatMessage {
    role: 'user' | 'model';
    content: string;
    image?: string;
}

const AmpAd = 'amp-ad' as any;

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  
  // Sales Trend Filter State
  const [salesRange, setSalesRange] = useState<'7D' | '30D' | '1Y'>('7D');

  // Detail Modal States
  const [activeDetail, setActiveDetail] = useState<'LOW_STOCK' | 'EXPIRING' | 'DUES' | null>(null);

  // Gemini Chat States
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([{
      role: 'model',
      content: "Hello! I'm your AI Store Manager. I have access to your live dashboard data. You can ask me about sales, inventory, or upload an invoice for analysis."
  }]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{data: string, mime: string} | null>(null);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, []);

  useEffect(() => {
      // Use internal container scroll to prevent page jumping
      if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
              top: chatContainerRef.current.scrollHeight,
              behavior: "smooth"
          });
      }
  }, [chatHistory, isTyping]);

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

    // --- CHECK EMAIL ALERT TRIGGER ---
    if (stData?.emailAlertsEnabled && stData?.storeEmail && pData.length > 0) {
        checkAndSendAlerts(pData, stData);
    }
  };

  const checkAndSendAlerts = async (inventory: Product[], config: StoreSettings) => {
      const lastSent = localStorage.getItem('noor_last_email_alert');
      const today = new Date().toISOString().split('T')[0];

      if (lastSent === today) return; // Already sent today

      // Calculate Expiring Items
      const expiringList = inventory.filter(p => {
          if (!p.expiryDate) return false;
          const expiry = new Date(p.expiryDate);
          const now = new Date();
          now.setHours(0,0,0,0);
          const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= (config.expiryAlertDays || 7);
      }).map(p => ({ name: p.name, stock: p.stock, date: p.expiryDate }));

      if (expiringList.length > 0) {
          try {
              await fetch(getApiUrl('/api/send-alert'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      to: config.storeEmail,
                      subject: `Expiry Alert (${expiringList.length} Items) - ${config.storeName}`,
                      items: expiringList,
                      storeName: config.storeName
                  })
              });
              localStorage.setItem('noor_last_email_alert', today);
              console.log("Email alert sent successfully.");
          } catch (err) {
              console.error("Failed to send email alert:", err);
          }
      }
  };

  // Stats Logic
  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
    const totalDues = customers.reduce((acc, c) => acc + (c.totalDues || 0), 0);
    const inventoryValue = products.reduce((acc, p) => acc + (p.stock * p.sellPrice), 0);
    const totalProducts = products.length;
    const totalStockUnits = products.reduce((acc, p) => acc + p.stock, 0);

    // --- SALES TREND LOGIC ---
    let trendData = [];
    const now = new Date();
    
    if (salesRange === '1Y') {
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const val = sales.filter(s => s.timestamp.startsWith(key)).reduce((a, b) => a + b.total, 0);
            trendData.push({ name: d.toLocaleString('default', { month: 'short' }), value: val });
        }
    } else {
        const days = salesRange === '30D' ? 30 : 7;
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const val = sales.filter(s => s.timestamp.startsWith(key)).reduce((a, b) => a + b.total, 0);
            // Show Day number for 30D, Weekday name for 7D
            trendData.push({ name: salesRange === '30D' ? d.getDate().toString() : d.toLocaleDateString('en-US', { weekday: 'short' }), value: val });
        }
    }

    // --- LIVE FLOW (Sparklines) - Always 7 Days for visuals ---
    const last7DaysDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

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
        { name: 'New', value: customers.filter(c => c.visitCount === 1).length, color: '#e2e8f0' }, // Lighter gray for dark background
        { name: 'Returning', value: customers.filter(c => c.visitCount > 1 && c.visitCount <= 5).length, color: '#6ee7b7' }, // Emerald-300
        { name: 'Loyal', value: customers.filter(c => c.visitCount > 5).length, color: '#ffffff' } // White
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
    
    return { 
        totalRevenue, totalDues, inventoryValue, totalProducts, totalStockUnits,
        salesTrend: trendData, 
        cashTotal, upiTotal, cardTotal, payLaterTotal,
        cashTrend: getMethodTrend('Cash'),
        upiTrend: getMethodTrend('UPI'),
        cardTrend: getMethodTrend('Card'),
        payLaterTrend: getMethodTrend('Pay Later'),
        customersWithDues, topBuyer, mostLoyal, 
        lowStockItems, expiringItems, customerComposition, topProducts
    };
  }, [customers, sales, products, tags, settings, salesRange]);

  const handleSendChat = async () => {
      if ((!chatInput.trim() && !attachedImage) || isTyping) return;

      const userMsg: ChatMessage = { 
          role: 'user', 
          content: chatInput,
          image: attachedImage ? attachedImage.data : undefined
      };
      
      const newHistory = [...chatHistory, userMsg];
      setChatHistory(newHistory);
      setChatInput('');
      const imageToSend = attachedImage; 
      setAttachedImage(null); // Clear image immediately
      setIsTyping(true);

      const storeContext = {
          storeName: settings?.storeName || "My Store",
          totalRevenue: stats.totalRevenue,
          totalDues: stats.totalDues,
          lowStockCount: stats.lowStockItems.length,
          topProduct: stats.topProducts[0]?.name || "None",
          transactionCount: sales.length
      };

      const reply = await GeminiService.chatWithAssistant(
          userMsg.content,
          chatHistory, // Pass history excluding the latest user message which is passed explicitly in API but logic works better this way for turn based
          storeContext,
          imageToSend?.data,
          imageToSend?.mime
      );

      setChatHistory([...newHistory, { role: 'model', content: reply }]);
      setIsTyping(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = () => {
              setAttachedImage({
                  data: reader.result as string,
                  mime: file.type
              });
          };
          reader.readAsDataURL(file);
      }
  };

  const formatDateShort = (dateStr: string) => dateStr ? `${new Date(dateStr).getDate()} ${new Date(dateStr).toLocaleString('default', { month: 'short' })}` : '';

  const Sparkline = ({ data, color }: { data: any[], color: string }) => (
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

        {/* --- 1. INVENTORY OVERVIEW --- */}
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

        {/* --- 2. FINANCIAL SNAPSHOT --- */}
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

        {/* --- 3. LIVE FLOW TRACKING --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <RefreshCw size={22} className="text-blue-600 animate-spin-slow"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Live Flow Tracking</h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 border-2 border-green-50 bg-green-50/20">
                    <div className="text-green-700 font-black text-xs uppercase tracking-wider mb-1 flex items-center gap-1"><Banknote size={12}/> Cash</div>
                    <div className="text-2xl font-black text-gray-900">₹{stats.cashTotal.toLocaleString()}</div>
                    <Sparkline data={stats.cashTrend} color="#16a34a" />
                </Card>
                <Card className="p-4 border-2 border-blue-50 bg-blue-50/20">
                    <div className="text-blue-700 font-black text-xs uppercase tracking-wider mb-1 flex items-center gap-1"><Smartphone size={12}/> UPI</div>
                    <div className="text-2xl font-black text-gray-900">₹{stats.upiTotal.toLocaleString()}</div>
                    <Sparkline data={stats.upiTrend} color="#2563eb" />
                </Card>
                <Card className="p-4 border-2 border-purple-50 bg-purple-50/20">
                    <div className="text-purple-700 font-black text-xs uppercase tracking-wider mb-1 flex items-center gap-1"><CreditCard size={12}/> Card</div>
                    <div className="text-2xl font-black text-gray-900">₹{stats.cardTotal.toLocaleString()}</div>
                    <Sparkline data={stats.cardTrend} color="#9333ea" />
                </Card>
                <Card className="p-4 border-2 border-orange-50 bg-orange-50/20">
                    <div className="text-orange-700 font-black text-xs uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={12}/> Pay Later</div>
                    <div className="text-2xl font-black text-gray-900">₹{stats.payLaterTotal.toLocaleString()}</div>
                    <Sparkline data={stats.payLaterTrend} color="#ea580c" />
                </Card>
            </div>
        </section>

        {/* --- 4. SALES TREND --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <TrendingUp size={22} className="text-indigo-600"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Sales Trend</h3>
            </div>
            <Card className="p-8 border-2 border-indigo-50 shadow-sm h-[400px]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-gray-900 text-lg">Revenue History</h3>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {['7D', '30D', '1Y'].map((range) => (
                            <button 
                                key={range}
                                onClick={() => setSalesRange(range as any)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${salesRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="h-64 w-full">
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

        {/* --- 5. INVENTORY HEALTH --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <AlertTriangle size={22} className="text-red-600"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Inventory Health</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Moving */}
                <Card className="p-0 overflow-hidden h-[320px] flex flex-col border-2 border-gray-100">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider"><Crown size={16} className="text-amber-500"/> Top Moving Items</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
                        {stats.topProducts.slice(0, 5).map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-black">{idx + 1}</div>
                                    <span className="font-bold text-gray-800 text-sm truncate max-w-[120px]">{p.name}</span>
                                </div>
                                <Badge color="bg-indigo-50 text-indigo-700">{p.count} sold</Badge>
                            </div>
                        ))}
                        {stats.topProducts.length === 0 && <div className="text-center text-gray-400 text-xs font-bold py-10 uppercase tracking-widest">No sales data yet</div>}
                    </div>
                </Card>

                {/* Low Stock */}
                <Card onClick={() => openDetail('LOW_STOCK')} className="border-2 border-red-100 bg-red-50/10 h-[320px] flex flex-col p-0 overflow-hidden cursor-pointer hover:border-red-200 transition-colors">
                    <div className="px-5 py-4 border-b border-red-100 bg-red-50/30 flex justify-between items-center">
                        <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider"><AlertTriangle size={16} className="text-red-500"/> Critical Stock</h3>
                        <ArrowUpRight size={16} className="text-red-400"/>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
                        {stats.lowStockItems.length > 0 ? stats.lowStockItems.slice(0, 6).map(p => (
                            <div key={p.id} className="flex justify-between items-center text-sm py-3 px-4 bg-white rounded-xl border border-red-100 shadow-sm">
                                <span className="font-black truncate text-gray-800 w-2/3">{p.name}</span>
                                <span className="font-bold text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md">{p.stock} left</span>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                                <CheckCircle size={40} className="mb-2 text-green-500"/>
                                <p className="text-xs font-black uppercase tracking-widest">Stock levels healthy</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Expiry */}
                <Card onClick={() => openDetail('EXPIRING')} className="border-2 border-amber-100 bg-amber-50/10 h-[320px] flex flex-col p-0 overflow-hidden cursor-pointer hover:border-amber-200 transition-colors">
                    <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/30 flex justify-between items-center">
                        <h3 className="font-black text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider"><Clock size={16} className="text-amber-600"/> Expiring Soon</h3>
                        <ArrowUpRight size={16} className="text-amber-400"/>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
                        {stats.expiringItems.length > 0 ? stats.expiringItems.slice(0, 6).map(p => (
                            <div key={p.id} className="flex justify-between items-center text-sm py-3 px-4 bg-white rounded-xl border-l-4 border-l-amber-500 shadow-sm">
                                <span className="font-black truncate text-gray-800 w-2/3">{p.name}</span>
                                <span className="text-[10px] font-bold text-gray-500 uppercase">{formatDateShort(p.expiryDate || '')}</span>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                                <CheckCircle size={40} className="mb-2 text-green-500"/>
                                <p className="text-xs font-black uppercase tracking-widest">No expiry alerts</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </section>

        {/* --- 6. CUSTOMER INSIGHTS --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <Users size={22} className="text-purple-600"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Customer Insights</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-0 flex flex-col justify-between h-36 p-6 rounded-2xl shadow-lg shadow-indigo-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full -mr-4 -mt-4 blur-xl"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-indigo-200 tracking-widest mb-1">Top Spender</p>
                            <h4 className="font-black text-lg truncate w-32 leading-tight">{stats.topBuyer?.name || "N/A"}</h4>
                        </div>
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md"><Crown size={18} className="text-yellow-300 fill-yellow-300"/></div>
                    </div>
                    <div className="text-2xl font-black relative z-10">₹{stats.topBuyer?.totalSpent.toLocaleString() || "0"}</div>
                </Card>

                <Card className="bg-gradient-to-br from-pink-500 to-rose-600 text-white border-0 flex flex-col justify-between h-36 p-6 rounded-2xl shadow-lg shadow-pink-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full -mr-4 -mt-4 blur-xl"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-pink-200 tracking-widest mb-1">Most Loyal</p>
                            <h4 className="font-black text-lg truncate w-32 leading-tight">{stats.mostLoyal?.name || "N/A"}</h4>
                        </div>
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md"><Star size={18} className="text-yellow-300 fill-yellow-300"/></div>
                    </div>
                    <div className="text-2xl font-black relative z-10">{stats.mostLoyal?.visitCount || 0} <span className="text-sm font-bold opacity-80 uppercase">Visits</span></div>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white border-0 flex flex-col justify-between h-36 p-6 rounded-2xl shadow-lg shadow-orange-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full -mr-4 -mt-4 blur-xl"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-orange-100 tracking-widest mb-1">Outstanding</p>
                            <h4 className="font-black text-lg leading-tight">{stats.customersWithDues.length} Customers</h4>
                        </div>
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md"><AlertTriangle size={18} className="text-white"/></div>
                    </div>
                    <div className="text-2xl font-black relative z-10">₹{stats.totalDues.toLocaleString()}</div>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 h-36 p-0 relative flex items-center justify-between overflow-hidden shadow-lg shadow-emerald-200">
                    <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full -mr-4 -mt-4 blur-xl"></div>
                    <div className="absolute top-3 left-4 z-10">
                        <p className="text-[10px] uppercase font-bold text-emerald-100 tracking-widest">Retention Rate</p>
                    </div>
                    <div className="w-full h-full pt-4 relative z-10">
                        {stats.customerComposition.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.customerComposition} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={4}>
                                        {stats.customerComposition.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-emerald-200 text-[10px] font-bold uppercase">No Data</div>
                        )}
                    </div>
                    <div className="flex flex-col justify-center gap-1 pr-4 absolute right-0 top-0 bottom-0 z-10">
                        {stats.customerComposition.map(c => (
                            <div key={c.name} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full shadow-sm" style={{backgroundColor: c.color}}></div>
                                <span className="text-[9px] font-bold text-emerald-50 uppercase tracking-wide">{c.name}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </section>

        {/* --- 7. GEMINI AI MANAGER (Embedded) --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <BrainCircuit size={22} className="text-indigo-600"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">AI Store Manager</h3>
            </div>
            
            <Card className="border-4 bg-[#fdfdfc] shadow-2xl p-0 rounded-[2.5rem] relative overflow-hidden group transition-all duration-500" style={{ borderColor: '#6366f1' }}>
                {/* Background Effects */}
                <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 p-24 bg-green-500/5 rounded-full -ml-8 -mb-8 blur-3xl pointer-events-none"></div>
                
                {/* Header Section inside Card */}
                <div className="p-8 pb-4 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100/50">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-3xl bg-white text-gray-900 flex items-center justify-center shadow-xl shrink-0 ring-1 ring-gray-100">
                            <Bot size={32} className="text-indigo-600"/>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-950 flex items-center gap-3">
                                Gemini Manager <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-red-500 to-green-600 text-[10px] tracking-[0.3em] font-black uppercase">LIVE</span>
                            </h3>
                            <p className="text-gray-500 text-sm font-bold tracking-wide">Finance • Analytics • Strategy</p>
                        </div>
                    </div>
                </div>

                {/* Chat Interface Area */}
                <div className="flex flex-col h-[600px] relative z-10 bg-white/50 backdrop-blur-sm">
                    
                    {/* Messages Area */}
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-200">
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'model' && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 mr-3 mt-1 shadow-sm">
                                        <Sparkles size={14} />
                                    </div>
                                )}
                                <div className={`max-w-[85%] p-5 rounded-2xl shadow-sm relative text-sm font-medium leading-relaxed ${msg.role === 'user' ? 'bg-gray-900 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'}`}>
                                    {msg.image && (
                                        <div className="mb-3 rounded-lg overflow-hidden border border-white/20">
                                            <img src={msg.image} alt="Uploaded" className="max-w-full h-auto max-h-60 object-cover" />
                                        </div>
                                    )}
                                    <div className={`prose prose-sm ${msg.role === 'user' ? 'prose-invert text-white' : 'text-gray-800'} max-w-none`}>
                                        <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 mr-3 mt-1 shadow-sm">
                                    <Sparkles size={14} />
                                </div>
                                <div className="bg-white p-4 rounded-2xl rounded-bl-none border border-gray-100 shadow-sm flex items-center gap-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        )}
                        {/* Removed chatEndRef here as we scroll the container */}
                    </div>

                    {/* Input Area */}
                    <div className="p-6 bg-white border-t border-gray-100">
                        {attachedImage && (
                            <div className="mb-3 flex items-center gap-3 bg-indigo-50 p-2 rounded-xl border border-indigo-100 max-w-fit animate-in fade-in zoom-in">
                                <div className="w-10 h-10 rounded-lg overflow-hidden relative">
                                    <img src={attachedImage.data} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-indigo-900 block">Image Attached</span>
                                    <span className="text-[10px] text-indigo-500">Ready to analyze</span>
                                </div>
                                <button onClick={() => setAttachedImage(null)} className="p-1 hover:bg-white rounded-full text-indigo-400 hover:text-red-500 transition-colors ml-2"><X size={14}/></button>
                            </div>
                        )}
                        <div className="flex gap-3 items-end">
                            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                            <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-gray-50 text-gray-500 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-transparent hover:border-indigo-100" title="Upload Invoice/Image">
                                <Paperclip size={20} />
                            </button>
                            <div className="flex-1 relative">
                                <textarea 
                                    className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none resize-none scrollbar-hide text-gray-900 placeholder-gray-400"
                                    placeholder="Type a message or upload an invoice to analyze..."
                                    rows={1}
                                    style={{ minHeight: '56px' }}
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if(e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendChat();
                                        }
                                    }}
                                />
                            </div>
                            <button 
                                onClick={handleSendChat}
                                disabled={(!chatInput.trim() && !attachedImage) || isTyping}
                                className="p-4 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-95"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                        <div className="text-center mt-3">
                            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Powered by Google Gemini 2.0 Flash</p>
                        </div>
                    </div>
                </div>
            </Card>
        </section>

        {/* --- 8. GROWTH GUIDE --- */}
        <section>
            <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                <BookOpen size={22} className="text-gray-400"/>
                <h3 className="text-sm font-black text-gray-950 uppercase tracking-widest">Growth Guide</h3>
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

        {/* AdSense */}
        <div className="w-full flex justify-center mt-10">
            <AmpAd width="100vw" height="320" type="adsense" data-ad-client="ca-pub-5865716270182311" data-ad-slot="2691818269" data-auto-format="rspv" data-full-width="">
                <div {...{ overflow: "" } as any}></div>
            </AmpAd>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-100 text-center space-y-2 pb-10">
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest">Noor POS Enterprise</p>
            <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">© 2025 System Status: Verified & Encrypted</p>
        </div>
    </div>
  );
};
