import React, { useState, useEffect } from 'react';
import { Tab, User } from './types';
import { Warehouse } from './pages/Warehouse';
import { POS } from './pages/POS';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { Profile } from './pages/Profile';
import { Package, ShoppingCart, Users, User as UserIcon, LayoutDashboard } from 'lucide-react';

const App: React.FC = () => {
  // Default to PROFILE so users see the login screen first if they aren't authenticated
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PROFILE);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Check for existing session (Gmail-like persistence)
    const savedUser = localStorage.getItem('glassstore_user');
    if (savedUser) {
        try {
            const parsedUser = JSON.parse(savedUser);
            setCurrentUser(parsedUser);
            // If we found a saved user, go straight to the app content (Warehouse)
            setActiveTab(Tab.WAREHOUSE);
        } catch (e) {
            localStorage.removeItem('glassstore_user');
        }
    }
    setLoading(false);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    // Persist the user so they stay logged in even after refresh/closing app
    localStorage.setItem('glassstore_user', JSON.stringify(user));
    // Redirect to Stock page after successful login
    setActiveTab(Tab.WAREHOUSE);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('glassstore_user');
    // Send them back to Profile to log in again
    setActiveTab(Tab.PROFILE);
  };

  const handleNavigate = (tab: Tab, action?: string) => {
    setActiveTab(tab);
    if (action) {
      setPendingAction(action);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#fdfdfc] text-gray-800 selection:bg-yellow-500/30">
      {/* Main Content Area */}
      <main className="p-4 md:p-6 w-full max-w-[1920px] mx-auto min-h-screen">
        {activeTab === Tab.WAREHOUSE && <Warehouse initialAction={pendingAction} onClearAction={() => setPendingAction(undefined)} />}
        {activeTab === Tab.POS && <POS />}
        {activeTab === Tab.DASHBOARD && <Dashboard onNavigate={handleNavigate} />}
        {activeTab === Tab.CUSTOMERS && <Customers initialAction={pendingAction} onClearAction={() => setPendingAction(undefined)} />}
        {activeTab === Tab.PROFILE && <Profile user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />}
      </main>

      {/* Bottom Navbar (Glossmorphism) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40 flex justify-center pointer-events-none">
        <nav className="pointer-events-auto rounded-full px-5 py-3 flex gap-1 items-center shadow-[0_20px_50px_rgba(8,_112,_184,_0.1)] ring-1 ring-white/50 bg-white/40 backdrop-blur-3xl border border-white/80">
          
          <button 
            onClick={() => setActiveTab(Tab.WAREHOUSE)}
            className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.WAREHOUSE ? 'text-yellow-600 scale-105 font-bold' : 'text-gray-800 hover:text-black'}`}
          >
            <Package size={22} strokeWidth={activeTab === Tab.WAREHOUSE ? 2.5 : 2} />
            <span className="text-[10px] tracking-wide">Stock</span>
          </button>
          
          <div className="w-px h-6 bg-gray-800/10 mx-1"></div>

          {/* POS Button - Floating Green Circle ONLY when active */}
          <button 
            onClick={() => setActiveTab(Tab.POS)}
            className={`flex flex-col items-center gap-1 px-3 transition-all duration-300 ${activeTab === Tab.POS ? '' : 'text-gray-800 hover:text-black'}`}
          >
             <div className={`
               flex items-center justify-center transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1)
               ${activeTab === Tab.POS 
                  ? 'bg-green-600 text-white w-14 h-14 rounded-full shadow-xl shadow-green-500/40 -mt-12 ring-4 ring-[#fdfdfc]' 
                  : 'bg-transparent text-gray-800 w-auto h-auto mt-0'}
            `}>
                <ShoppingCart size={activeTab === Tab.POS ? 26 : 22} strokeWidth={activeTab === Tab.POS ? 2.5 : 2} />
            </div>
            <span className={`text-[10px] font-bold tracking-wide transition-all duration-300 ${activeTab === Tab.POS ? 'w-0 h-0 opacity-0 overflow-hidden' : 'opacity-100 mt-0.5'}`}>POS</span>
          </button>

          <div className="w-px h-6 bg-gray-800/10 mx-1"></div>

          <button 
            onClick={() => setActiveTab(Tab.DASHBOARD)}
            className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.DASHBOARD ? 'text-indigo-600 scale-105 font-bold' : 'text-gray-800 hover:text-black'}`}
          >
            <LayoutDashboard size={22} strokeWidth={activeTab === Tab.DASHBOARD ? 2.5 : 2} />
            <span className="text-[10px] tracking-wide">Dash</span>
          </button>

          <div className="w-px h-6 bg-gray-800/10 mx-1"></div>

          <button 
            onClick={() => setActiveTab(Tab.CUSTOMERS)}
            className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.CUSTOMERS ? 'text-blue-600 scale-105 font-bold' : 'text-gray-800 hover:text-black'}`}
          >
            <Users size={22} strokeWidth={activeTab === Tab.CUSTOMERS ? 2.5 : 2} />
            <span className="text-[10px] tracking-wide">CRM</span>
          </button>

          <div className="w-px h-6 bg-gray-800/10 mx-1"></div>

          <button 
            onClick={() => setActiveTab(Tab.PROFILE)}
            className={`flex flex-col items-center gap-1 px-3 transition-all ${activeTab === Tab.PROFILE ? 'text-purple-600 scale-105 font-bold' : 'text-gray-800 hover:text-black'}`}
          >
            <UserIcon size={22} strokeWidth={activeTab === Tab.PROFILE ? 2.5 : 2} />
            <span className="text-[10px] tracking-wide">Profile</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default App;