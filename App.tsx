
import React, { useState, useEffect, Suspense } from 'react';
import { Tab, User } from './types';
import { Package, ShoppingCart, Users, User as UserIcon, LayoutDashboard, ShieldCheck } from 'lucide-react';
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
  const [showLanding, setShowLanding] = useState(false);
  const [showCookieConsent, setShowCookieConsent] = useState(() => !localStorage.getItem('noor_cookie_consent'));
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

    const handleSessionExpired = () => {
        setCurrentUser(null);
        localStorage.removeItem('noor_active_tab');
        setShowLanding(false);
        alert("Your Google session has expired. Please log in again to continue syncing.");
    };

    const handleSyncConflict = () => {
        if (window.confirm("Another user has updated the database. Your local changes conflict with the cloud. Do you want to reload the latest data? (Your unsaved changes will be lost)")) {
            window.location.reload();
        }
    };

    window.addEventListener('session-expired', handleSessionExpired);
    window.addEventListener('sync-conflict', handleSyncConflict);

    return () => {
        window.removeEventListener('session-expired', handleSessionExpired);
        window.removeEventListener('sync-conflict', handleSyncConflict);
    };
  }, []);

  const handleLogin = (user: User) => {
      setCurrentUser(user);
      setShowLanding(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('noor_active_tab');
    setShowLanding(false); // Return to Auth
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

  // --- CHANGED LOGIC: Show Auth Page if not logged in ---
  if (!currentUser) {
      if (showLanding) {
          return (
            <Suspense fallback={<div className="h-screen flex items-center justify-center"><LoadingSpinner/></div>}>
                <div className="relative">
                    <button onClick={() => setShowLanding(false)} className="absolute top-4 left-4 z-50 p-2 bg-gray-100 rounded-full hover:bg-gray-200">← Back to Login</button>
                    <Landing onGetStarted={() => setShowLanding(false)} />
                </div>
            </Suspense>
          );
      }
      // Default State: Auth Page
      return (
          <Suspense fallback={<div className="h-screen flex items-center justify-center"><LoadingSpinner/></div>}>
              <Auth onLogin={handleLogin} onShowLanding={() => setShowLanding(true)} />
          </Suspense>
      );
  }

  return (
    <div className="min-h-screen bg-[#fdfdfc] text-gray-800 selection:bg-yellow-500/30">
      {!isOnline && (
        <div className="bg-red-500 text-white text-[10px] py-1 text-center font-bold tracking-widest uppercase sticky top-0 z-[100]">
          Offline Mode - Changes will sync when online
        </div>
      )}
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
        {showCookieConsent && (
          <div className="pointer-events-auto absolute bottom-24 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white/50 max-w-sm mx-auto flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-5">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <ShieldCheck size={18} className="text-blue-600" />
              Privacy & Cookies
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              We use analytics to improve your experience. By continuing, you agree to our usage of cookies.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  localStorage.setItem('noor_cookie_consent', 'true');
                  setShowCookieConsent(false);
                }}
                className="flex-1 bg-gray-800 text-white py-2 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors"
              >
                Accept All
              </button>
              <button 
                onClick={() => setShowCookieConsent(false)}
                className="px-4 py-2 text-gray-500 text-sm hover:text-gray-700 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
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
