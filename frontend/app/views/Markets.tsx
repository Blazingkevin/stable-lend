
import React, { useState } from 'react';
import { ASSETS } from '@/app/constants';
import { Asset } from '@/app/types';
import { LoanDetails } from '@/lib/contract-calls';
// Add missing TrendingUp import
import { Info, Plus, MoveRight, Wallet, TrendingUp } from 'lucide-react';

interface MarketsProps {
  type: 'supply' | 'borrow';
  userAddress?: string | null;
  lenderBalance?: bigint;
  loans?: LoanDetails[];
  loanIds?: number[];
  onRefresh?: () => void;
}

const Markets: React.FC<MarketsProps> = ({ type, userAddress, lenderBalance, loans, loanIds, onRefresh }) => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white capitalize">{type} Markets</h1>
          <p className="text-gray-400">
            {type === 'supply' 
              ? 'Deposit assets to earn compound interest automatically.' 
              : 'Use your collateral to borrow USDCx or other assets.'}
          </p>
        </div>
      </div>

      <div className="glass-card rounded-[32px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-xs text-gray-400 uppercase tracking-widest">
                <th className="px-8 py-6 font-semibold">Asset</th>
                <th className="px-6 py-6 font-semibold">Price</th>
                <th className="px-6 py-6 font-semibold">{type === 'supply' ? 'Supply APY' : 'Borrow APY'}</th>
                <th className="px-6 py-6 font-semibold">Total {type === 'supply' ? 'Supplied' : 'Borrowed'}</th>
                <th className="px-6 py-6 font-semibold">Utilization</th>
                <th className="px-8 py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ASSETS.map((asset) => (
                <tr key={asset.symbol} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/5 p-2 flex items-center justify-center border border-white/5 group-hover:border-orange-500/30 transition-all">
                        <img src={asset.icon} alt={asset.symbol} className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {asset.symbol}
                          {asset.symbol === 'USDCx' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 font-bold">BRIDGE</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{asset.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-gray-200 mono">
                    ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col">
                      <span className={`font-bold text-lg mono ${type === 'supply' ? 'text-green-500' : 'text-orange-500'}`}>
                        {type === 'supply' ? asset.supplyApy : asset.borrowApy}%
                      </span>
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Trending Up
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="text-sm font-medium text-white mono">
                      {type === 'supply' 
                        ? asset.totalSupplied.toLocaleString() 
                        : asset.totalBorrowed.toLocaleString()} {asset.symbol}
                    </div>
                    <div className="text-xs text-gray-500">
                      ${((type === 'supply' ? asset.totalSupplied : asset.totalBorrowed) * asset.price).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${asset.utilization > 80 ? 'bg-red-500' : 'bg-orange-500'}`} 
                          style={{ width: `${asset.utilization}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 mono">{asset.utilization}%</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => setSelectedAsset(asset)}
                      className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-orange-500 hover:bg-orange-500 transition-all font-bold text-sm"
                    >
                      {type === 'supply' ? 'Supply' : 'Borrow'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
          <div className="glass-card w-full max-w-lg rounded-[40px] p-8 shadow-2xl shadow-orange-500/10 border border-white/10">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 p-2 flex items-center justify-center border border-white/5">
                  <img src={selectedAsset.icon} alt="" className="w-full h-full object-contain" />
                </div>
                {type === 'supply' ? 'Supply' : 'Borrow'} {selectedAsset.symbol}
              </h2>
              <button onClick={() => setSelectedAsset(null)} className="p-2 text-gray-500 hover:text-white">&times;</button>
            </div>

            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-gray-200 flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    Balance: 4,502.12 {selectedAsset.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    className="bg-transparent text-3xl font-bold mono text-white focus:outline-none flex-1"
                  />
                  <button className="text-xs font-bold text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-lg hover:bg-orange-500/20">MAX</button>
                </div>
              </div>

              <div className="space-y-3 px-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Transaction Overview</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Interest Rate</span>
                    <span className="text-white font-bold">{type === 'supply' ? selectedAsset.supplyApy : selectedAsset.borrowApy}% APY</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Utilization After</span>
                    <span className="text-white font-bold">{(selectedAsset.utilization + 1.2).toFixed(1)}%</span>
                  </div>
                  {type === 'borrow' && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Collateral Factor</span>
                      <span className="text-white font-bold">85.0%</span>
                    </div>
                  )}
                </div>
              </div>

              <button className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg shadow-xl shadow-orange-500/20 transition-all active:scale-[0.98]">
                Execute {type === 'supply' ? 'Supply' : 'Borrow'}
              </button>
              
              <div className="flex items-center gap-2 justify-center text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                <Info className="w-3 h-3" />
                Security audited by Stacks Labs
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Markets;
