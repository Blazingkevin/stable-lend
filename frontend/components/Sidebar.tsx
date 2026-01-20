
import React from 'react';
import { LayoutDashboard, Coins, HandCoins, BarChart3, ShieldCheck, ArrowLeftRight } from 'lucide-react';
import { View } from '@/app/types';

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => {
  const navItems = [
    { id: View.Dashboard, label: 'Dashboard', icon: LayoutDashboard },
    { id: View.Lend, label: 'Supply & Earn', icon: Coins },
    { id: View.Borrow, label: 'Borrow Assets', icon: HandCoins },
    { id: View.Bridge, label: 'Bridge USDCx', icon: ArrowLeftRight },
    { id: View.Stats, label: 'Protocol Stats', icon: BarChart3 },
  ];

  return (
    <aside className="w-64 border-r border-white/5 bg-gray-900/40 backdrop-blur-md hidden lg:flex flex-col z-20">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <button 
            onClick={() => onNavigate(View.Dashboard)}
            className="text-xl font-bold tracking-tight text-white text-left hover:text-orange-400 transition-colors"
          >
            StableLend
          </button>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-orange-500/10 text-orange-500' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-orange-500' : 'group-hover:scale-110 transition-transform'}`} />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-purple-500/10 border border-white/5 space-y-3">
          <p className="text-sm font-semibold text-gray-200">USDCx Liquidity</p>
          <p className="text-xs text-gray-400 leading-relaxed">StableLend uses Circle xReserve for cross-chain USDCx bridging.</p>
          <button 
            onClick={() => onNavigate(View.Bridge)}
            className="text-xs text-orange-400 font-medium hover:underline flex items-center gap-1"
          >
            Bridge Assets &rarr;
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
