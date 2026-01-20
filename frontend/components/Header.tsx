
import React from 'react';
import { Wallet, Bell, Search, ChevronDown } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  onConnect: () => void;
  userAddress?: string | null;
}

const Header: React.FC<HeaderProps> = ({ isConnected, onConnect, userAddress }) => {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#030712]/50 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center flex-1 max-w-xl">
        <div className="relative w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-orange-500 transition-colors" />
          <input
            type="text"
            placeholder="Search assets, txs, or pools..."
            className="bg-white/5 border border-white/5 rounded-full pl-10 pr-4 py-2 w-full text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors relative">
          <Bell className="w-5 h-5 text-gray-400" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-[#030712]" />
        </button>

        <div className="h-8 w-px bg-white/5 mx-2" />

        <button
          onClick={onConnect}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition-all shadow-xl shadow-orange-500/10 ${
            isConnected
              ? 'bg-gray-800 border border-white/10 hover:border-orange-500/30'
              : 'bg-orange-500 hover:bg-orange-600 text-white'
          }`}
        >
          {isConnected && userAddress ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="mono">{formatAddress(userAddress)}</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </>
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
