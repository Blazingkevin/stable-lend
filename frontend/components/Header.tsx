
import React, { useState, useRef, useEffect } from 'react';
import { Wallet, Bell, Search, ChevronDown, Home, LogOut, Copy, Check, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect?: () => void;
  userAddress?: string | null;
}

const Header: React.FC<HeaderProps> = ({ isConnected, onConnect, onDisconnect, userAddress }) => {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyAddress = () => {
    if (userAddress) {
      navigator.clipboard.writeText(userAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    setShowDropdown(false);
    onDisconnect?.();
  };

  return (
    <header className="h-16 lg:h-20 border-b border-white/5 flex items-center justify-between px-4 lg:px-8 bg-[#030712]/50 backdrop-blur-md sticky top-0 z-30">
      {/* Left side - Logo on mobile, search on desktop */}
      <div className="flex items-center gap-2 lg:gap-3 flex-1 lg:max-w-xl">
        {/* Mobile: Show logo */}
        <div className="flex lg:hidden items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
            <ShieldCheck className="text-white w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">StableLend</span>
        </div>

        {/* Desktop: Show home button and search */}
        <button
          onClick={() => router.push('/')}
          className="hidden lg:flex p-2.5 rounded-full bg-white/5 hover:bg-orange-500/10 hover:text-orange-400 transition-colors items-center gap-2 text-gray-400 text-sm font-semibold"
          title="Back to Landing Page"
        >
          <Home className="w-5 h-5" />
        </button>
        
        {/* Testnet Indicator - smaller on mobile */}
        <div className="hidden sm:flex items-center gap-2 px-2 lg:px-3 py-1 lg:py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
          <span className="text-yellow-500 text-[10px] lg:text-xs font-bold uppercase tracking-wider">Testnet</span>
        </div>
        
        {/* Search - hidden on mobile */}
        <div className="hidden lg:block relative w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-orange-500 transition-colors" />
          <input
            type="text"
            placeholder="Search assets, txs, or pools..."
            className="bg-white/5 border border-white/5 rounded-full pl-10 pr-4 py-2 w-full text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Bell - hidden on small mobile */}
        <button className="hidden sm:block p-2 lg:p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors relative">
          <Bell className="w-4 h-4 lg:w-5 lg:h-5 text-gray-400" />
          <span className="absolute top-1.5 lg:top-2 right-1.5 lg:right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-[#030712]" />
        </button>

        <div className="hidden sm:block h-8 w-px bg-white/5 mx-1 lg:mx-2" />

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => isConnected ? setShowDropdown(!showDropdown) : onConnect()}
            className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-6 py-2 lg:py-2.5 rounded-full font-semibold text-xs lg:text-sm transition-all shadow-xl shadow-orange-500/10 ${
              isConnected
                ? 'bg-gray-800 border border-white/10 hover:border-orange-500/30'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {isConnected && userAddress ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="mono">{formatAddress(userAddress)}</span>
                <ChevronDown className={`w-3 h-3 lg:w-4 lg:h-4 text-gray-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </>
            )}
          </button>

          {/* Dropdown Menu */}
          {showDropdown && isConnected && userAddress && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-white/5">
                <p className="text-xs text-gray-500 mb-1">Connected Wallet</p>
                <p className="text-sm font-mono text-white truncate">{userAddress}</p>
              </div>
              
              <div className="p-2">
                <button
                  onClick={handleCopyAddress}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied ? 'Copied!' : 'Copy Address'}
                </button>
                
                <button
                  onClick={handleDisconnect}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect Wallet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
