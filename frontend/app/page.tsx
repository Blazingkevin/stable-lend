'use client';

import { useState } from 'react';
import { PROTOCOL } from '@/lib/constants';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'lend' | 'borrow'>('lend');

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
            <button className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all text-sm font-medium shadow-lg shadow-blue-500/30">
              Connect Wallet
            </button>
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
          <div className="bg-white rounded-xl shadow-xl p-8">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔒</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Coming Soon</h3>
              <p className="text-gray-600">Connect your Stacks wallet to start lending or borrowing USDCx</p>
            </div>
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
