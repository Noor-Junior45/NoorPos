import React, { useState, useEffect } from 'react';
import { Tab, User } from './types';
import { Warehouse } from './pages/Warehouse';
import { POS } from './pages/POS';
import { Customers } from './pages/Customers';
import { Profile } from './pages/Profile';
import { Package, ShoppingCart, Users, User as UserIcon } from 'lucide-react';

const App: React.FC = () => {
  // Default to PROFILE so users see the login screen first if they aren't authenticated
  const [activeTab, setActiveTab] = useState<Tab>(Tab.PROFILE);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#fdfdfc] text-gray-800 selection:bg-yellow-500/30">
      {/* Main Content Area */}
      <main className="p-4 md:p-6 w-full max-w-[1920px] mx-auto min-h-screen">
        {activeTab === Tab.WAREHOUSE && <Warehouse />}
        {activeTab === Tab.POS && <POS />}
        {activeTab === Tab.CUSTOMERS && <Customers />}
        {activeTab === Tab.PROFILE && <Profile user={currentUser} onLogin={handleLogin} onLogout={handleLogout} />}
      </main>

      {/* Bottom Navbar (Glassmorphism) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40 flex justify-center pointer-events-none">
        <nav className="glass-panel pointer-events-auto rounded-full px-6 py-3 flex gap-6 items-center shadow-2xl ring-1 ring-black/5">
          <button 
            onClick={() => setActiveTab(Tab.WAREHOUSE)}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === Tab.WAREHOUSE ? 'text-yellow-600 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Package size={24} strokeWidth={activeTab === Tab.WAREHOUSE ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-wide">Stock</span>
          </button>
          
          {/* Separator */}
          <div className="w-px h-8 bg-gray-200 mx-1"></div>

          <button 
            onClick={() => setActiveTab(Tab.POS)}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === Tab.POS ? 'text-green-600 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <div className={`p-3 rounded-full ${activeTab === Tab.POS ? 'bg-green-500 text-white shadow-lg shadow-green-500/40 -mt-6 ring-4 ring-white' : 'bg-transparent'}`}>
                <ShoppingCart size={24} strokeWidth={activeTab === Tab.POS ? 2.5 : 2} />
            </div>
            {activeTab !== Tab.POS && <span className="text-[10px] font-bold tracking-wide">POS</span>}
          </button>

          {/* Separator */}
          <div className="w-px h-8 bg-gray-200 mx-1"></div>

          <button 
            onClick={() => setActiveTab(Tab.CUSTOMERS)}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === Tab.CUSTOMERS ? 'text-blue-600 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Users size={24} strokeWidth={activeTab === Tab.CUSTOMERS ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-wide">CRM</span>
          </button>

          {/* New Separator Line as requested */}
          <div className="w-px h-8 bg-gray-200 mx-1"></div>

          <button 
            onClick={() => setActiveTab(Tab.PROFILE)}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === Tab.PROFILE ? 'text-purple-600 scale-110' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <UserIcon size={24} strokeWidth={activeTab === Tab.PROFILE ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-wide">Profile</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default App;