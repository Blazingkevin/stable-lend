'use client';

import { useState, useEffect } from 'react';
import { PROTOCOL } from '@/lib/constants';
import { userSession, connectWallet, disconnectWallet, getUserAddress } from '@/lib/stacks';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'lend' | 'borrow'>('lend');
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);

  useEffect(() => {
    // Check wallet connection on mount
    const checkConnection = () => {
      const connected = userSession.isUserSignedIn();
      setIsConnected(connected);
      if (connected) {
        setUserAddress(getUserAddress());
      }
    };
    
    checkConnection();
  }, []);

  const handleConnect = () => {
    connectWallet();
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">StableLend</h1>
                <p className="text-xs text-gray-600">First Lending on Bitcoin L2</p>
              </div>
            </div>
            {!isConnected ? (
              <button 
                onClick={handleConnect}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all text-sm font-medium shadow-lg shadow-blue-500/30"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 font-medium">
                  {userAddress && formatAddress(userAddress)}
                </div>
                <button 
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all text-sm font-medium"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 mb-1">APY</p>
            <p className="text-3xl font-bold text-blue-600">{PROTOCOL.APY}%</p>
            <p className="text-xs text-gray-500 mt-1">For Lenders</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 mb-1">Collateral Ratio</p>
            <p className="text-3xl font-bold text-purple-600">{PROTOCOL.COLLATERAL_RATIO}%</p>
            <p className="text-xs text-gray-500 mt-1">Required</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 mb-1">Liquidation</p>
            <p className="text-3xl font-bold text-orange-600">{PROTOCOL.LIQUIDATION_THRESHOLD}%</p>
            <p className="text-xs text-gray-500 mt-1">Threshold</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 mb-1">Liquidation Bonus</p>
            <p className="text-3xl font-bold text-green-600">{PROTOCOL.LIQUIDATION_BONUS}%</p>
            <p className="text-xs text-gray-500 mt-1">For Liquidators</p>
          </div>
        </div>

        {/* Main Interface */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            {!isConnected ? (
              <div className="text-center py-12 px-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔒</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Wallet</h3>
                <p className="text-gray-600 mb-6">Connect your Stacks wallet to start lending or borrowing USDCx</p>
                <button 
                  onClick={handleConnect}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium shadow-lg shadow-blue-500/30"
                >
                  Connect Wallet
                </button>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('lend')}
                    className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                      activeTab === 'lend'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    💰 Lend USDCx
                  </button>
                  <button
                    onClick={() => setActiveTab('borrow')}
                    className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                      activeTab === 'borrow'
                        ? 'text-purple-600 border-b-2 border-purple-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🏦 Borrow USDCx
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-8">
                  {activeTab === 'lend' ? (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Lend USDCx & Earn {PROTOCOL.APY}% APY</h3>
                      <p className="text-sm text-gray-600 mb-6">
                        Deposit USDCx to earn interest. Interest is calculated per block and compounds automatically.
                      </p>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Amount (USDCx)</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        
                        <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                          Deposit USDCx
                        </button>
                      </div>

                      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-900 font-medium">Your Lending Position</p>
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700">Deposited:</span>
                            <span className="text-blue-900 font-medium">0.00 USDCx</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700">Interest Earned:</span>
                            <span className="text-blue-900 font-medium">0.00 USDCx</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700">Total Balance:</span>
                            <span className="text-blue-900 font-medium">0.00 USDCx</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Borrow USDCx with STX Collateral</h3>
                      <p className="text-sm text-gray-600 mb-6">
                        Lock STX as collateral to borrow USDCx. Maintain {PROTOCOL.COLLATERAL_RATIO}% collateral ratio to avoid liquidation.
                      </p>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Collateral (STX)</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Borrow Amount (USDCx)</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <p className="text-xs text-gray-500 mt-1">Max borrowable based on collateral value</p>
                        </div>
                        
                        <button className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
                          Borrow USDCx
                        </button>
                      </div>

                      <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm text-purple-900 font-medium">Your Loans</p>
                        <p className="text-sm text-purple-700 mt-2">No active loans</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16 py-8 bg-white">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600">
          <p>Built with ❤️ for the Programming USDCx Hackathon</p>
          <p className="mt-2">
            <a
              href="https://github.com/Blazingkevin/stable-lend"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
