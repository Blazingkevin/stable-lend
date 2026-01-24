
import React from 'react';
import { TrendingUp, Users, DollarSign, Activity, Lock, Coins, BarChart3, Clock, Shield, AlertTriangle, CheckCircle, Zap, Database, RefreshCw, FileText } from 'lucide-react';
import { ProtocolStats as ProtocolStatsType } from '@/lib/contract-calls';

interface StatsProps {
  protocolStats?: ProtocolStatsType;
  currentAPY?: number;
  stxPrice?: bigint;
}

const Stats: React.FC<StatsProps> = ({ protocolStats, currentAPY, stxPrice }) => {
  // Use real data from protocol
  const totalDepositsUSDCx = protocolStats 
    ? Number(protocolStats.totalDeposited) / 1_000000 
    : 0;
  
  const totalBorrowedUSDCx = protocolStats
    ? Number(protocolStats.totalBorrowed) / 1_000000
    : 0;
  
  const utilizationRate = protocolStats
    ? protocolStats.utilizationRate / 100 // Convert from basis points to percentage
    : 0;
  
  const totalLenders = protocolStats?.totalLenders || 0;
  const totalBorrowers = protocolStats?.totalBorrowers || 0;
  const activeUsers = totalLenders + totalBorrowers;
  
  const totalInterestPaid = protocolStats?.totalInterestPaid
    ? Number(protocolStats.totalInterestPaid) / 1_000000
    : 0;
    
  const protocolRevenue = protocolStats?.protocolRevenue
    ? Number(protocolStats.protocolRevenue) / 1_000000
    : 0;
  
  // Calculate effective lender APY
  const borrowAPY = currentAPY || 8.0;
  const effectiveLenderAPY = borrowAPY * (utilizationRate / 100);

  // Supply and Borrow caps
  const supplyCap = protocolStats?.supplyCap
    ? Number(protocolStats.supplyCap) / 1_000000
    : 0;
    
  const borrowCap = protocolStats?.borrowCap
    ? Number(protocolStats.borrowCap) / 1_000000
    : 0;

  // New data from contract
  const volume24h = protocolStats?.volume24h
    ? Number(protocolStats.volume24h) / 1_000000
    : 0;

  const totalShares = protocolStats?.totalShares
    ? Number(protocolStats.totalShares) / 100_000_000 // 8 decimal precision
    : 0;

  const shareValue = protocolStats?.shareValue
    ? Number(protocolStats.shareValue) / 100_000_000 // 8 decimal precision
    : 1;

  const liquidityIndex = protocolStats?.liquidityIndex
    ? Number(protocolStats.liquidityIndex) / 100_000_000
    : 1;

  const borrowIndex = protocolStats?.variableBorrowIndex
    ? Number(protocolStats.variableBorrowIndex) / 100_000_000
    : 1;

  const lastUpdateBlock = protocolStats?.lastInterestUpdateBlock || 0;
  const totalLoans = protocolStats?.totalLoans || 0;
  const isPaused = protocolStats?.paused || false;

  // Calculate available liquidity
  const availableLiquidity = totalDepositsUSDCx - totalBorrowedUSDCx;

  // Calculate interest earned by lenders (total interest - protocol fee)
  const lenderInterestEarned = totalInterestPaid * 0.9; // 90% goes to lenders

  // STX Price display
  const stxPriceUSD = stxPrice ? Number(stxPrice) / 1_000000 : 0;

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      {/* Header with status */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Protocol Statistics</h1>
          <p className="text-gray-400">Real-time on-chain data from StableLend V6 smart contract.</p>
        </div>
        <div className="flex items-center gap-3">
          {isPaused ? (
            <div className="px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Protocol Paused
            </div>
          ) : (
            <div className="px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-bold flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live from Blockchain
            </div>
          )}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-cyan-500/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Total Value Locked</p>
          </div>
          <h3 className="text-3xl font-bold text-white mono mb-2">
            ${totalDepositsUSDCx.toFixed(2)}
          </h3>
          <p className="text-xs text-blue-400 font-semibold">
            {totalDepositsUSDCx.toFixed(6)} USDCx
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-rose-500/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Total Borrowed</p>
          </div>
          <h3 className="text-3xl font-bold text-white mono mb-2">
            ${totalBorrowedUSDCx.toFixed(2)}
          </h3>
          <p className="text-xs text-orange-400 font-semibold">
            {totalBorrowedUSDCx.toFixed(6)} USDCx
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-blue-500/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Utilization Rate</p>
          </div>
          <h3 className="text-3xl font-bold text-white mono mb-2">
            {utilizationRate.toFixed(2)}%
          </h3>
          <p className="text-xs text-purple-400 font-semibold">
            {totalBorrowedUSDCx.toFixed(2)} / {totalDepositsUSDCx.toFixed(2)}
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-emerald-500/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Active Users</p>
          </div>
          <h3 className="text-3xl font-bold text-white mono mb-2">
            {activeUsers}
          </h3>
          <p className="text-xs text-green-400 font-semibold">
            {totalLenders} lenders, {totalBorrowers} borrowers
          </p>
        </div>
      </div>

      {/* Interest & Revenue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-green-500/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Coins className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Total Interest Paid</p>
          </div>
          <h3 className="text-2xl font-bold text-white mono mb-1">
            ${totalInterestPaid.toFixed(2)}
          </h3>
          <p className="text-xs text-emerald-400">
            {totalInterestPaid.toFixed(6)} USDCx total
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Protocol Revenue</p>
          </div>
          <h3 className="text-2xl font-bold text-white mono mb-1">
            ${protocolRevenue.toFixed(2)}
          </h3>
          <p className="text-xs text-cyan-400">
            10% service fee collected
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Effective Lender APY</p>
          </div>
          <h3 className="text-2xl font-bold text-white mono mb-1">
            {effectiveLenderAPY.toFixed(2)}%
          </h3>
          <p className="text-xs text-amber-400">
            {borrowAPY}% × {utilizationRate.toFixed(1)}% utilization
          </p>
        </div>
      </div>

      {/* NEW: Activity & Volume Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-purple-500/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">24h Volume</p>
          </div>
          <h3 className="text-2xl font-bold text-white mono mb-1">
            ${volume24h.toFixed(2)}
          </h3>
          <p className="text-xs text-indigo-400">
            {volume24h.toFixed(6)} USDCx deposited
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 to-cyan-500/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-teal-400" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Available Liquidity</p>
          </div>
          <h3 className="text-2xl font-bold text-white mono mb-1">
            ${availableLiquidity.toFixed(2)}
          </h3>
          <p className="text-xs text-teal-400">
            Ready for borrowing
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 to-rose-500/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-pink-400" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Total Loans Created</p>
          </div>
          <h3 className="text-2xl font-bold text-white mono mb-1">
            {totalLoans}
          </h3>
          <p className="text-xs text-pink-400">
            Lifetime loan count
          </p>
        </div>

        <div className="glass-card p-6 rounded-3xl border border-lime-500/20 bg-gradient-to-br from-lime-500/10 to-green-500/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500/20 flex items-center justify-center">
              <Coins className="w-5 h-5 text-lime-400" />
            </div>
            <p className="text-sm text-gray-400 font-semibold">Interest to Lenders</p>
          </div>
          <h3 className="text-2xl font-bold text-white mono mb-1">
            ${lenderInterestEarned.toFixed(2)}
          </h3>
          <p className="text-xs text-lime-400">
            90% of interest paid
          </p>
        </div>
      </div>

      {/* NEW: Technical Indices Section */}
      <div className="glass-card p-6 rounded-3xl border border-violet-500/20">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-violet-400" />
          Interest Indices & Share System
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          These indices track compound interest accumulation. They start at 1.0 and grow over time as interest accrues.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <p className="text-xs text-gray-400 mb-1">Liquidity Index</p>
            <p className="text-xl font-bold text-white mono">{liquidityIndex.toFixed(8)}</p>
            <p className="text-xs text-violet-400 mt-1">Tracks lender earnings</p>
          </div>
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <p className="text-xs text-gray-400 mb-1">Borrow Index</p>
            <p className="text-xl font-bold text-white mono">{borrowIndex.toFixed(8)}</p>
            <p className="text-xs text-rose-400 mt-1">Tracks borrower debt</p>
          </div>
          <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <p className="text-xs text-gray-400 mb-1">Total Shares</p>
            <p className="text-xl font-bold text-white mono">{totalShares.toFixed(4)}</p>
            <p className="text-xs text-cyan-400 mt-1">Lender pool ownership</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-gray-400 mb-1">Share Value</p>
            <p className="text-xl font-bold text-white mono">{shareValue.toFixed(8)}</p>
            <p className="text-xs text-amber-400 mt-1">USDCx per share</p>
          </div>
        </div>
        <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Last Interest Update
            </span>
            <span className="text-white font-mono">Block #{lastUpdateBlock.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* NEW: Oracle Data */}
      {stxPriceUSD > 0 && (
        <div className="glass-card p-6 rounded-3xl border border-yellow-500/20">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-yellow-400" />
            Oracle Price Feed
          </h3>
          <div className="flex items-center justify-between p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center font-bold text-purple-500 text-sm">
                STX
              </div>
              <div>
                <p className="text-white font-bold">STX/USD Price</p>
                <p className="text-xs text-gray-400">From Pyth Network Oracle</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-yellow-400 mono">${stxPriceUSD.toFixed(4)}</p>
              <p className="text-xs text-gray-400">Used for collateral valuation</p>
            </div>
          </div>
        </div>
      )}

      {/* Protocol Limits */}
      <div className="glass-card p-6 rounded-3xl border border-slate-500/20">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Lock className="w-5 h-5 text-slate-400" />
          Protocol Limits & Security
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-400">Supply Cap</p>
              <p className="text-sm font-bold text-white">
                {supplyCap === 0 ? 'Unlimited' : `${supplyCap.toFixed(2)} USDCx`}
              </p>
            </div>
            <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all" 
                style={{ width: supplyCap > 0 ? `${Math.min((totalDepositsUSDCx / supplyCap) * 100, 100)}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {supplyCap > 0 
                ? `${totalDepositsUSDCx.toFixed(2)} / ${supplyCap.toFixed(2)} used`
                : 'No limit set'
              }
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-400">Borrow Cap</p>
              <p className="text-sm font-bold text-white">
                {borrowCap === 0 ? 'Unlimited' : `${borrowCap.toFixed(2)} USDCx`}
              </p>
            </div>
            <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all" 
                style={{ width: borrowCap > 0 ? `${Math.min((totalBorrowedUSDCx / borrowCap) * 100, 100)}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {borrowCap > 0 
                ? `${totalBorrowedUSDCx.toFixed(2)} / ${borrowCap.toFixed(2)} used`
                : 'No limit set'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Market Overview */}
      <div className="glass-card p-8 rounded-3xl">
        <h3 className="text-lg font-bold text-white mb-6">Market Overview</h3>
        <div className="space-y-6">
          {/* USDCx Market */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-orange-500/10 to-blue-500/10 border border-orange-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center font-bold text-orange-500">
                  U
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">USDCx</h4>
                  <p className="text-xs text-gray-400">Stablecoin on Stacks</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-orange-400">{borrowAPY}%</p>
                <p className="text-xs text-gray-400">Borrow APY</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Total Supply</p>
                <p className="text-sm font-bold text-white">{totalDepositsUSDCx.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Total Borrow</p>
                <p className="text-sm font-bold text-white">{totalBorrowedUSDCx.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Supply APY</p>
                <p className="text-sm font-bold text-green-400">{effectiveLenderAPY.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          {/* sBTC Market - Coming Soon */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/10 opacity-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-500">
                  ₿
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">sBTC</h4>
                  <p className="text-xs text-gray-400">Bitcoin on Stacks</p>
                </div>
              </div>
              <div className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
                <p className="text-xs font-bold text-amber-400">Coming Soon</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Total Supply</p>
                <p className="text-sm font-bold text-white">0.00</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Total Borrow</p>
                <p className="text-sm font-bold text-white">0.00</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Supply APY</p>
                <p className="text-sm font-bold text-gray-500">TBD</p>
              </div>
            </div>
          </div>

          {/* STX Collateral Info */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center font-bold text-purple-500">
                  STX
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Stacks (STX)</h4>
                  <p className="text-xs text-gray-400">Collateral Asset</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-400">150%</p>
                <p className="text-xs text-gray-400">Collateral Ratio</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-xs text-gray-300">
                Borrowers must lock STX worth 150% of their loan value. Example: To borrow $100 USDCx, 
                you need ${(100 * 1.5).toFixed(0)} worth of STX collateral.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Explanation */}
      <div className="glass-card p-6 rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-purple-500/5">
        <h3 className="text-lg font-bold text-white mb-4">📊 Understanding the Numbers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <p className="text-sm font-bold text-white mb-2">Total Value Locked (TVL)</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              The total amount of USDCx currently deposited in the protocol by lenders. This represents the liquidity available for borrowing.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <p className="text-sm font-bold text-white mb-2">Utilization Rate</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Percentage of deposited funds currently borrowed. Higher utilization means more lending activity and higher APY for lenders.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <p className="text-sm font-bold text-white mb-2">Effective Lender APY</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Your actual earning rate: Borrow APY (8%) × Utilization Rate. This adjusts dynamically based on how much capital is borrowed.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <p className="text-sm font-bold text-white mb-2">Protocol Revenue</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              10% service fee collected from borrower interest payments. This funds protocol development and treasury reserves.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stats;
