
import React, { useState, useEffect, Suspense } from 'react';
import { Tab, User } from './types';
import { Package, ShoppingCart, Users, User as UserIcon, LayoutDashboard } from 'lucide-react';
import { GoogleDriveUtils } from './utils/googleDrive';
import { LoadingSpinner } from './components/UI';

// Pages
const Warehouse = React.lazy(() => import('./pages/Warehouse').then(m => ({ default: m.Warehouse })));
const POS = React.lazy(() => import('./pages/POS').then(m => ({ default: m.POS })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Customers = React.lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const Profile = React.lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Auth = React.lazy(() => import('./pages/Auth').then(m => ({ default: m.Auth })));
const PublicInvoice = React.lazy(() => import('./pages/PublicInvoice').then(m => ({ default: m.PublicInvoice })));
const Landing = React.lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const savedTab = localStorage.getItem('noor_active_tab');
    return (savedTab as Tab) || Tab.DASHBOARD;
  });
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingAction, setPendingAction] = useState<string | undefined>(undefined);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isPublicMode, setIsPublicMode] = useState(false);
  const [showAuthFlow, setShowAuthFlow] = useState(false);

  // --- Browser/Gesture Back Navigation Logic ---
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab as Tab);
        window.dispatchEvent(new CustomEvent('app-navigation-pop', { detail: event.state }));
      }
    };

    window.addEventListener('popstate', handlePopState);
    if (!window.history.state) {
      window.history.replaceState({ tab: activeTab, depth: 0 }, '');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (newTab: Tab) => {
    if (newTab === activeTab) return;
    window.history.pushState({ tab: newTab, depth: 0 }, '');
    setActiveTab(newTab);
    localStorage.setItem('noor_active_tab', newTab);
  };

  useEffect(() => {
    if (window.location.pathname.startsWith('/invoice/')) {
        setIsPublicMode(true);
        setIsCheckingAuth(false);
        return;
    }

    // Check for existing session automatically
    const session = GoogleDriveUtils.getSession();
    if (session) {
       const user: User = { id: session.profile.email, username: session.profile.email.split('@')[0], name: session.profile.name, role: 'admin', pin: '0000' };
       setCurrentUser(user);
    }
    setIsCheckingAuth(false);
  }, []);

  const handleLogin = (user: User) => {
      setCurrentUser(user);
      setShowAuthFlow(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('noor_active_tab');
    setShowAuthFlow(false); // Return to Landing
  };

  const handleNavigate = (tab: Tab, action?: string) => {
    handleTabChange(tab);
    if (action) setPendingAction(action);
  };

  if (isCheckingAuth) return null;

  if (isPublicMode) {
      return (
          <Suspense fallback={<div className="h-screen flex items-center justify-center"><LoadingSpinner/></div>}>
              <PublicInvoice />
          </Suspense>
      );
  }

  // --- CHANGED LOGIC: Show Landing Page if not logged in ---
  if (!currentUser) {
      if (showAuthFlow) {
          return (
            <Suspense fallback={<div className="h-screen flex items-center justify-center"><LoadingSpinner/></div>}>
                <div className="relative">
                    <button onClick={() => setShowAuthFlow(false)} className="absolute top-4 left-4 z-50 p-2 bg-gray-100 rounded-full hover:bg-gray-200">← Back</button>
                    <Auth onLogin={handleLogin} />
                </div>
            </Suspense>
          );
      }
      // Default State: Public Landing Page (Content for AdSense)
      return (
          <Suspense fallback={<div className="h-screen flex items-center justify-center"><LoadingSpinner/></div>}>
              <Landing onGetStarted={() => setShowAuthFlow(true)} />
          </Suspense>
      );
  }

  return (
    <div className="min-h-screen bg-[#fdfdfc] text-gray-800 selection:bg-yellow-500/30">
      <main className="p-4 md:p-6 w-full max-w-[1920px] mx-auto min-h-screen">
        <Suspense fallback={<LoadingSpinner />}>
            {activeTab === Tab.WAREHOUSE && <Warehouse initialAction={pendingAction} onClearAction={() => setPendingAction(undefined)} />}
            {activeTab === Tab.POS && <POS />}
            {activeTab === Tab.DASHBOARD && <Dashboard onNavigate={handleNavigate} />}
            {activeTab === Tab.CUSTOMERS && <Customers initialAction={pendingAction} onClearAction={() => setPendingAction(undefined)} />}
            {activeTab === Tab.PROFILE && <Profile user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />}
        </Suspense>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 z-40 flex justify-center pointer-events-none">
        <nav className="pointer-events-auto rounded-full px-5 py-3 flex gap-1 items-center shadow-[0_20px_50px_rgba(8,_112,_184,_0.1)] ring-1 ring-white/50 bg-white/40 backdrop-blur-3xl border border-white/80">
          <button onClick={() => handleTabChange(Tab.WAREHOUSE)} className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.WAREHOUSE ? 'text-yellow-600 scale-105 font-bold' : 'text-gray-800'}`}>
            <Package size={22} />
            <span className="text-[10px] tracking-wide">Stock</span>
          </button>
          <div className="w-px h-6 bg-gray-800/10 mx-1"></div>
          <button onClick={() => handleTabChange(Tab.POS)} className={`flex flex-col items-center gap-1 px-3 transition-all duration-300 ${activeTab === Tab.POS ? '' : 'text-gray-800'}`}>
             <div className={`flex items-center justify-center transition-all duration-300 ${activeTab === Tab.POS ? 'bg-green-600 text-white w-14 h-14 rounded-full shadow-xl -mt-12 ring-4 ring-[#fdfdfc]' : 'bg-transparent text-gray-800 w-auto h-auto mt-0'}`}>
                <ShoppingCart size={activeTab === Tab.POS ? 26 : 22} />
            </div>
            <span className={`text-[10px] font-bold tracking-wide ${activeTab === Tab.POS ? 'w-0 h-0 opacity-0' : 'opacity-100 mt-0.5'}`}>POS</span>
          </button>
          <div className="w-px h-6 bg-gray-800/10 mx-1"></div>
          <button onClick={() => handleTabChange(Tab.DASHBOARD)} className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.DASHBOARD ? 'text-indigo-600 scale-105 font-bold' : 'text-gray-800'}`}>
            <LayoutDashboard size={22} />
            <span className="text-[10px] tracking-wide">Dash</span>
          </button>
          <div className="w-px h-6 bg-gray-800/10 mx-1"></div>
          <button onClick={() => handleTabChange(Tab.CUSTOMERS)} className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.CUSTOMERS ? 'text-blue-600 scale-105 font-bold' : 'text-gray-800'}`}>
            <Users size={22} />
            <span className="text-[10px] tracking-wide">CRM</span>
          </button>
          <div className="w-px h-6 bg-gray-800/10 mx-1"></div>
          <button onClick={() => handleTabChange(Tab.PROFILE)} className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.PROFILE ? 'text-purple-600 scale-105 font-bold' : 'text-gray-800'}`}>
            <UserIcon size={22} />
            <span className="text-[10px] tracking-wide">Profile</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default App;
