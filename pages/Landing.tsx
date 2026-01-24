
import React, { useEffect } from 'react';
import { Card, Button } from '../components/UI';
import { 
  Package, TrendingUp, ShieldCheck, ArrowRight, Zap, 
  LayoutDashboard, Sparkles, Smartphone, Receipt, 
  ShieldAlert, BarChart3, HelpCircle, CheckCircle2,
  BrainCircuit, Users, BookOpen, Database, Shield
} from 'lucide-react';

interface LandingProps {
  onGetStarted: () => void;
}

const AmpAd = 'amp-ad' as any;
const LOGO_URL = "https://lh3.googleusercontent.com/p/AF1QipPlp0QUwcp2FOnTGiGNf5fqWnskinCj4QxRKa3o=s1360-w1360-h1020-rw";

export const Landing: React.FC<LandingProps> = ({ onGetStarted }) => {
  
  useEffect(() => {
    try {
      (window as any).adsbygoogle = (window as any).adsbygoogle || [];
      (window as any).adsbygoogle.push({});
    } catch (e) {
      console.log('AdSense error', e);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#fdfdfc] flex flex-col font-sans text-gray-800 scroll-smooth">
      
      {/* Sticky Navigation - Glassmorphism */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Noor POS Logo" className="w-10 h-10 rounded-2xl shadow-sm object-cover border border-white" />
            <span className="font-black text-xl tracking-tight text-gray-950">Noor POS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-xs font-black uppercase tracking-widest text-gray-500">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#guides" className="hover:text-blue-600 transition-colors">Business Intelligence</a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">Support</a>
          </div>
          <button 
            onClick={onGetStarted}
            className="px-6 py-2.5 bg-gray-950 text-white rounded-full font-bold text-sm hover:bg-black transition-all active:scale-95 shadow-xl shadow-gray-200 flex items-center justify-center gap-2"
          >
            Dashboard Login <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="px-6 pt-40 pb-20 md:pt-56 md:pb-32 max-w-6xl mx-auto text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-[0.2em] mb-8 border border-blue-100 shadow-sm">
          <Sparkles size={12} /> The Future of Indian Retail
        </div>
        <h1 className="text-5xl md:text-8xl font-black text-gray-950 tracking-tighter mb-8 leading-[1.05]">
          Manage Your Store <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">With Intelligent Data</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-500 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
          Transform your manual bookkeeping into a powerful digital ecosystem. Noor POS offers inventory tracking, GST-ready billing, and AI-driven growth analytics—all synced securely to your private Google Drive.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
          <button 
            onClick={onGetStarted}
            className="px-10 py-5 bg-blue-600 text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-blue-300/40 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            Get Started Free <ArrowRight size={22} />
          </button>
          <a href="#features" className="px-10 py-5 bg-white text-gray-600 border border-gray-100 rounded-[2rem] font-black text-lg hover:bg-gray-50 transition-all shadow-sm">
            Explore Ecosystem
          </a>
        </div>
      </header>

      {/* --- ADSENSE TOP UNIT --- */}
      <div className="w-full max-w-4xl mx-auto px-4 mb-24">
         <div className="min-h-[280px] bg-white rounded-[2.5rem] border border-gray-100 flex flex-col items-center justify-center overflow-hidden p-6 shadow-sm">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] mb-4">Supported Business Content</p>
            <AmpAd width="100vw" height="320"
                type="adsense"
                data-ad-client="ca-pub-5865716270182311"
                data-ad-slot="2691818269"
                data-auto-format="auto"
                data-full-width-responsive="true">
            </AmpAd>
         </div>
      </div>

      {/* Feature Grid Section - Glassmorphism Cards */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-gray-950 mb-4 tracking-tight">Core Infrastructure</h2>
            <p className="text-gray-500 font-medium text-lg">Industrial-grade tools simplified for every shop owner.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { icon: Package, title: "Smart Inventory", desc: "Real-time stock synchronization with automated threshold alerts and category grouping.", color: "text-blue-600 bg-blue-50" },
            { icon: Receipt, title: "Swift Billing", desc: "Generate professional invoices in seconds. Full support for thermal printing and digital sharing.", color: "text-green-600 bg-green-50" },
            { icon: BrainCircuit, title: "Gemini AI Core", desc: "Advanced AI analysis of your sales patterns and stock health to predict future demand.", color: "text-purple-600 bg-purple-50" },
            { icon: Users, title: "CRM & Dues", desc: "Professional customer management. Track visit frequency, loyalty, and outstanding balances.", color: "text-amber-600 bg-amber-50" },
            { icon: Database, title: "Drive Sync", desc: "Zero-server architecture. Your data lives in your Google account, ensuring 100% privacy.", color: "text-indigo-600 bg-indigo-50" },
            { icon: Smartphone, title: "Mobile Native", desc: "Experience a desktop-grade dashboard on your Android device with seamless camera scanning.", color: "text-rose-600 bg-rose-50" }
          ].map((f, i) => (
            <div key={i} className="glass-card p-10 rounded-[2.5rem] group hover:scale-[1.02] transition-all hover:shadow-2xl">
              <div className={`w-16 h-16 ${f.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-sm`}>
                <f.icon size={32} />
              </div>
              <h3 className="font-black text-2xl text-gray-950 mb-4">{f.title}</h3>
              <p className="text-gray-500 leading-relaxed font-medium">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- RICH PUBLISHER CONTENT (The "Blog" for AdSense) --- */}
      <section id="guides" className="py-24 bg-white/30">
        <div className="max-w-4xl mx-auto px-6 space-y-24">
          
          <article className="prose prose-xl max-w-none">
            <div className="flex items-center gap-5 mb-8">
                <div className="w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black shadow-lg shadow-indigo-200">01</div>
                <h2 className="text-4xl font-black text-gray-950 m-0 tracking-tight">The Retail Revolution: Digital First</h2>
            </div>
            <p className="text-gray-600 leading-relaxed text-lg font-medium">
                Traditional retail is undergoing a massive transformation. Relying on manual "Khata" books is no longer viable in a world where speed determines success. 
                Digital inventory management allows business owners to identify <strong>"Dead Stock"</strong>—capital that is frozen in items that don't sell. 
                With <em>Noor POS</em>, you gain the visibility required to liquidate slow-moving items and reinvest in high-turnover stock.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12">
                <div className="glass-card p-8 rounded-3xl">
                    <h4 className="font-black text-gray-950 flex items-center gap-3 mb-3 text-lg"><CheckCircle2 className="text-emerald-500" size={24}/> Expiry Protection</h4>
                    <p className="text-gray-500 font-medium">Our system flags items nearing expiry 7-15 days in advance, allowing you to run clearance sales before items become waste.</p>
                </div>
                <div className="glass-card p-8 rounded-3xl">
                    <h4 className="font-black text-gray-950 flex items-center gap-3 mb-3 text-lg"><Shield size={24} className="text-blue-500"/> Data Ownership</h4>
                    <p className="text-gray-500 font-medium">Unlike other POS software, we don't store your data on our servers. Everything is encrypted in your personal Google Drive.</p>
                </div>
            </div>
          </article>

          <article className="prose prose-xl max-w-none">
            <div className="flex items-center gap-5 mb-8">
                <div className="w-14 h-14 bg-purple-600 text-white rounded-full flex items-center justify-center font-black shadow-lg shadow-purple-200">02</div>
                <h2 className="text-4xl font-black text-gray-950 m-0 tracking-tight">Driving Sales Through AI Insights</h2>
            </div>
            <p className="text-gray-600 leading-relaxed text-lg font-medium">
                Modern business is about data, not guesswork. Our integrated <strong>Gemini AI Assistant</strong> analyzes your weekly sales trends to highlight your top-performing products. 
                Research shows that customers using UPI or digital payments tend to spend 18% more per visit. Noor POS helps you capture this digital market with a modern, fast checkout interface.
            </p>
            <div className="bg-gray-950 text-white p-10 rounded-[3rem] mt-12 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-32 bg-blue-500/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-purple-500/20 transition-all duration-1000"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="w-24 h-24 bg-white/10 rounded-3xl backdrop-blur-xl flex items-center justify-center shrink-0 border border-white/10">
                        <TrendingUp size={48} className="text-blue-400" />
                    </div>
                    <div>
                        <h4 className="text-2xl font-black mb-3">Profit Maximization Strategy</h4>
                        <p className="text-gray-400 font-medium leading-relaxed italic">"Identify peak sales hours using our dashboard and optimize your staffing. Ensure your high-margin items are always at eye-level and in-stock based on our AI restock suggestions."</p>
                    </div>
                </div>
            </div>
          </article>

          {/* FAQ Section */}
          <div id="faq" className="pt-12">
            <h2 className="text-4xl font-black text-gray-950 mb-12 text-center tracking-tight">Frequently Asked Questions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { q: "Is Noor POS truly free?", a: "Yes, the core store management ecosystem is free for individual retailers. We believe in empowering small businesses with high-end tech." },
                { q: "Where is my data stored?", a: "Your database is a specialized Google Spreadsheet within your own Google Drive. You own it 100%." },
                { q: "Does it work with Barcode Scanners?", a: "Absolutely. You can use your mobile camera or connect any USB/Bluetooth HID barcode scanner machine." },
                { q: "What if I lose my phone?", a: "Just log in to Noor POS from any other device using your Google account. Your data will instantly sync back." }
              ].map((faq, i) => (
                <div key={i} className="glass-card p-8 rounded-3xl hover:border-blue-200 transition-colors">
                  <h4 className="font-black text-gray-950 mb-3 flex items-center gap-3">
                    <HelpCircle size={20} className="text-blue-600" /> {faq.q}
                  </h4>
                  <p className="text-gray-500 font-medium leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --- ADSENSE BOTTOM UNIT --- */}
      <div className="w-full max-w-4xl mx-auto px-4 my-24">
         <div className="min-h-[280px] bg-white rounded-[2.5rem] border border-gray-100 flex flex-col items-center justify-center overflow-hidden p-6 shadow-sm">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] mb-4">Partner Advertisement</p>
            <AmpAd width="100vw" height="320"
                type="adsense"
                data-ad-client="ca-pub-5865716270182311"
                data-ad-slot="2691818269"
                data-auto-format="auto"
                data-full-width-responsive="true">
            </AmpAd>
         </div>
      </div>

      {/* CTA Section */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="glass-card p-16 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl"></div>
            <img src={LOGO_URL} alt="Store Icon" className="w-24 h-24 mx-auto rounded-[2rem] shadow-2xl mb-10 object-cover border-4 border-white" />
            <h2 className="text-5xl font-black text-gray-950 mb-6 tracking-tight">Join the Network Today</h2>
            <p className="text-gray-500 font-medium mb-12 max-w-xl mx-auto text-lg leading-relaxed">Join hundreds of progressive retailers who have digitized their daily operations with Noor POS.</p>
            <button 
                onClick={onGetStarted}
                className="px-14 py-5 bg-gray-950 text-white rounded-full font-black text-xl shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3 mx-auto"
            >
                Launch Dashboard <ArrowRight size={24}/>
            </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-8">
              <img src={LOGO_URL} alt="Logo" className="w-10 h-10 rounded-xl object-cover" />
              <span className="font-black text-2xl tracking-tighter text-gray-950">Noor POS</span>
            </div>
            <p className="text-gray-500 max-w-sm font-medium leading-relaxed mb-8">
                The leading edge in store management technology. Secure, private, and powerful software for modern Indian retailers.
            </p>
            <div className="flex items-center gap-3 text-[10px] font-black text-gray-300 uppercase tracking-widest">
                <ShieldCheck size={16} className="text-emerald-500 opacity-60"/> Banking-Grade Privacy
            </div>
          </div>
          <div>
            <h4 className="font-black text-gray-950 uppercase text-xs tracking-widest mb-8">Product Ecosystem</h4>
            <ul className="space-y-5 text-sm font-bold text-gray-400">
              <li><a href="#features" className="hover:text-blue-600 transition-colors">Digital Warehouse</a></li>
              <li><a href="#guides" className="hover:text-blue-600 transition-colors">AI Insights</a></li>
              <li><button onClick={onGetStarted} className="hover:text-blue-600 transition-colors">POS Terminal</button></li>
              <li><a href="/bot-login.html" className="hover:text-blue-600 transition-colors">Access Panel</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black text-gray-950 uppercase text-xs tracking-widest mb-8">Legal & Privacy</h4>
            <ul className="space-y-5 text-sm font-bold text-gray-400">
              <li><a href="/privacy.html" className="hover:text-blue-600 transition-colors">Privacy Policy</a></li>
              <li><a href="https://terms-conditions-store.vercel.app" className="hover:text-blue-600 transition-colors">Terms of Use</a></li>
              <li><a href="mailto:newluckypharmacy@gmail.com" className="hover:text-blue-600 transition-colors">Contact Engineering</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-24 pt-12 border-t border-gray-50 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[10px] text-gray-300 font-black uppercase tracking-[0.2em]">© 2025 Noor Enterprise. All rights reserved.</p>
          <div className="flex gap-8 items-center opacity-30">
             <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="h-5 grayscale hover:grayscale-0 transition-all cursor-help" title="Google Cloud Partner" />
             <img src="https://www.svgrepo.com/show/303229/microsoft-logo.svg" className="h-4 grayscale" />
          </div>
        </div>
      </footer>
    </div>
  );
};
