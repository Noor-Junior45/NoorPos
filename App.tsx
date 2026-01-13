import React, { useState } from 'react';
import { Tab } from './types';
import { Warehouse } from './pages/Warehouse';
import { POS } from './pages/POS';
import { Customers } from './pages/Customers';
import { Package, ShoppingCart, Users } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.WAREHOUSE);

  return (
    <div className="min-h-screen bg-[#fdfdfc] text-gray-800 selection:bg-yellow-500/30">
      {/* Main Content Area */}
      <main className="p-4 md:p-6 w-full max-w-[1920px] mx-auto min-h-screen">
        {activeTab === Tab.WAREHOUSE && <Warehouse />}
        {activeTab === Tab.POS && <POS />}
        {activeTab === Tab.CUSTOMERS && <Customers />}
      </main>

      {/* Bottom Navbar (Glassmorphism) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40 flex justify-center pointer-events-none">
        <nav className="glass-panel pointer-events-auto rounded-full px-6 py-3 flex gap-8 items-center">
          <button 
            onClick={() => setActiveTab(Tab.WAREHOUSE)}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === Tab.WAREHOUSE ? 'text-yellow-600 scale-110' : 'text-gray-500 hover:text-black'}`}
          >
            <Package size={24} />
            <span className="text-[10px] font-medium tracking-wide">Stock</span>
          </button>
          
          <div className="w-px h-8 bg-black/10 mx-2"></div>

          <button 
            onClick={() => setActiveTab(Tab.POS)}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === Tab.POS ? 'text-green-600 scale-110' : 'text-gray-500 hover:text-black'}`}
          >
            <div className={`p-3 rounded-full ${activeTab === Tab.POS ? 'bg-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-transparent'}`}>
                <ShoppingCart size={24} />
            </div>
          </button>

          <div className="w-px h-8 bg-white/10 mx-2"></div>

          <button 
            onClick={() => setActiveTab(Tab.CUSTOMERS)}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === Tab.CUSTOMERS ? 'text-blue-600 scale-110' : 'text-gray-500 hover:text-black'}`}
          >
            <Users size={24} />
            <span className="text-[10px] font-medium tracking-wide">CRM</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default App;