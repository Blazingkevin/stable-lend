import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { getProtocolStats } from '@/lib/contract-calls';
import { CONTRACTS, NETWORK } from '@/lib/constants';

interface LandingPageProps {
  onEnterApp: () => void;
}

interface ProtocolStats {
  totalDeposited: bigint;
  totalBorrowed: bigint;
  utilizationRate: number;
  totalLenders: number;
  totalBorrowers: number;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  const [stats, setStats] = useState<ProtocolStats>({
    totalDeposited: BigInt(0),
    totalBorrowed: BigInt(0),
    utilizationRate: 0,
    totalLenders: 0,
    totalBorrowers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use a dummy address for read-only call
        const dummyAddress = CONTRACTS[NETWORK].lendingPool.split('.')[0];
        const protocolStats = await getProtocolStats(dummyAddress);
        setStats({
          totalDeposited: protocolStats.totalDeposited,
          totalBorrowed: protocolStats.totalBorrowed,
          utilizationRate: protocolStats.utilizationRate,
          totalLenders: protocolStats.totalLenders || 0,
          totalBorrowers: protocolStats.totalBorrowers || 0,
        });
      } catch (error) {
        console.error('Error fetching protocol stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="relative">
      {/* Testnet Banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/95 backdrop-blur-sm border-b border-yellow-600/30 py-1.5 lg:py-2 px-3 lg:px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-1.5 lg:gap-2 text-xs lg:text-sm">
          <span className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-yellow-900 animate-pulse" />
          <span className="font-bold text-yellow-900">TESTNET</span>
          <span className="text-yellow-900/80 hidden sm:inline">•</span>
          <span className="text-yellow-900/80 hidden sm:inline">Using Stacks Testnet - Test tokens only</span>
        </div>
      </div>

      {/* Navigation Header */}
      <nav className="fixed top-8 lg:top-10 left-0 right-0 z-40 bg-[#030712]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-orange-500 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <ShieldCheck className="text-white w-5 h-5 lg:w-6 lg:h-6" />
            </div>
            <span className="text-lg lg:text-xl font-bold tracking-tight text-white">StableLend</span>
          </div>
          <button 
            onClick={onEnterApp}
            className="px-4 lg:px-6 py-2 lg:py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-lg lg:rounded-xl font-bold text-xs lg:text-sm transition-all hover:scale-105"
          >
            Launch App
          </button>
        </div>
      </nav>
      
      {/* Hero Section */}
      <section className="relative pt-32 lg:pt-48 pb-20 lg:pb-40 px-4 lg:px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 lg:px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] lg:text-[10px] font-bold mb-6 lg:mb-8 uppercase tracking-[0.15em] lg:tracking-[0.2em] shadow-[0_0_20px_rgba(249,115,22,0.1)] animate-in fade-in duration-500">
             <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
             Bitcoin Finance Renaissance
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black tracking-tighter mb-6 lg:mb-8 leading-[1.1] lg:leading-[1] text-white animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '0.1s' }}>
            The Global Yield Layer<br />
            <span className="bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 bg-clip-text text-transparent">For Bitcoin.</span>
          </h1>
          
          <p className="max-w-3xl mx-auto text-base lg:text-xl text-slate-400 mb-8 lg:mb-12 leading-relaxed font-light px-2 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '0.2s' }}>
            StableLend is your gateway to Bitcoin DeFi: Bridge <span className="text-slate-200 font-medium">USDC</span> from Ethereum, 
            earn yield by lending <span className="text-slate-200 font-medium">USDCx</span> on Stacks, 
            borrow against <span className="text-slate-200 font-medium">STX</span> collateral, 
            and let AI monitor your risk—all on Bitcoin's secure L2.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 lg:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '0.3s' }}>
            <button 
              onClick={onEnterApp}
              className="w-full sm:w-auto px-8 lg:px-12 py-4 lg:py-5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl lg:rounded-2xl font-black text-lg lg:text-xl shadow-[0_20px_50px_rgba(249,115,22,0.3)] transition-all hover:scale-105 active:scale-95"
            >
              Launch App
            </button>
            <Link 
              href="/learn"
              className="w-full sm:w-auto px-8 lg:px-12 py-4 lg:py-5 bg-transparent hover:bg-white/5 text-orange-400 hover:text-orange-300 rounded-xl lg:rounded-2xl font-bold text-lg lg:text-xl transition-all border border-orange-500/30 hover:border-orange-500/50 backdrop-blur-xl group"
            >
              Learn More
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl aspect-square bg-gradient-to-br from-orange-500/5 to-blue-500/5 rounded-full blur-[120px] -z-10"></div>
      </section>

      {/* Stats Grid - Modern Minimalist */}
      <section id="stats" className="max-w-7xl mx-auto px-4 lg:px-6 grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 border-y border-white/5 mb-16 lg:mb-32">
        {[
          { 
            label: 'Total Value Locked', 
            value: loading ? '...' : `$${(Number(stats.totalDeposited) / 1_000_000).toFixed(2)}`,
            highlight: false 
          },
          { 
            label: 'Supply APY', 
            value: loading ? '...' : stats.utilizationRate > 0 
              ? `${(8 * stats.utilizationRate / 10000).toFixed(2)}%` 
              : 'Up to 8%',
            highlight: true 
          },
          { 
            label: 'Market Utilization', 
            value: loading ? '...' : `${(stats.utilizationRate / 100).toFixed(1)}%`,
            highlight: false 
          },
          { 
            label: 'Active Lenders', 
            value: loading ? '...' : stats.totalLenders.toString(),
            highlight: false 
          },
        ].map((stat, i) => (
          <div key={i} className="bg-[#020617] p-6 lg:p-12 text-center group transition-colors hover:bg-white/[0.02] animate-in fade-in duration-500" style={{ animationDelay: `${0.4 + (i * 0.1)}s` }}>
            <div className={`text-2xl lg:text-4xl font-black mb-1 lg:mb-2 tracking-tight ${stat.highlight ? 'text-orange-400' : 'text-white'}`}>{stat.value}</div>
            <div className="text-[8px] lg:text-[10px] text-slate-500 font-black uppercase tracking-[0.1em] lg:tracking-[0.2em]">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Features - Bento Style */}
      <section id="features" className="max-w-7xl mx-auto px-4 lg:px-6 py-12 lg:py-24">
        <div className="grid lg:grid-cols-12 gap-4 lg:gap-6">
          <div className="lg:col-span-8 bg-gradient-to-br from-slate-900/50 to-slate-950/50 p-6 lg:p-12 rounded-2xl lg:rounded-[3rem] border border-white/5 backdrop-blur-sm group hover:border-orange-500/20 transition-all animate-in fade-in duration-700">
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="w-12 h-12 lg:w-16 lg:h-16 bg-orange-500/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-orange-400 mb-4 lg:mb-8 border border-orange-500/20 shadow-[0_0_30px_rgba(249,115,22,0.1)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" className="lg:w-8 lg:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <h3 className="text-2xl lg:text-4xl font-black text-white mb-4 lg:mb-6">Battle-Tested Security Model</h3>
                <p className="text-base lg:text-xl text-slate-400 max-w-xl font-light leading-relaxed">
                  <span className="text-orange-400 font-bold">150% collateralization ratio</span> with automated liquidations at 120% health factor. 
                  CEI pattern throughout, emergency pause mechanism, supply/borrow caps. Built in Clarity for formal verification and Bitcoin-level security.
                </p>
              </div>
              <div className="mt-6 lg:mt-12 flex flex-wrap gap-2 lg:gap-4">
                <span className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] lg:text-xs font-bold text-orange-400 uppercase tracking-wider lg:tracking-widest">Over-Collateralized</span>
                <span className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-full bg-white/5 border border-white/10 text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-wider lg:tracking-widest">Auto-Liquidation</span>
                <span className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-full bg-white/5 border border-white/10 text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-wider lg:tracking-widest">Clarity Verified</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-blue-600/5 p-6 lg:p-12 rounded-2xl lg:rounded-[3rem] border border-blue-500/10 backdrop-blur-sm hover:bg-blue-600/10 transition-all animate-in fade-in duration-700" style={{ animationDelay: '0.2s' }}>
            <div className="w-12 h-12 lg:w-16 lg:h-16 bg-blue-500/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-blue-400 mb-4 lg:mb-8 border border-blue-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" className="lg:w-8 lg:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <h3 className="text-xl lg:text-3xl font-black text-white mb-4 lg:mb-6">Dynamic Interest Rates</h3>
            <p className="text-sm lg:text-lg text-slate-400 font-light leading-relaxed">
              Utilization-based APY scales from 0% to 8%. Real-time updates every block. Transparent 90/10 split: lenders earn 90%, protocol keeps 10%.
            </p>
          </div>
        </div>

        {/* New row with 2 features */}
        <div className="grid md:grid-cols-2 gap-4 lg:gap-6 mt-4 lg:mt-6">
          <div className="bg-gradient-to-br from-emerald-900/20 to-slate-950/50 p-6 lg:p-12 rounded-2xl lg:rounded-[3rem] border border-emerald-500/10 backdrop-blur-sm hover:border-emerald-500/20 transition-all animate-in fade-in duration-700" style={{ animationDelay: '0.3s' }}>
            <div className="w-12 h-12 lg:w-16 lg:h-16 bg-emerald-500/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-emerald-400 mb-4 lg:mb-8 border border-emerald-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" className="lg:w-8 lg:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="7.5 4.21 12 6.81 16.5 4.21"/><polyline points="7.5 19.79 7.5 14.6 3 12"/><polyline points="21 12 16.5 14.6 16.5 19.79"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <h3 className="text-xl lg:text-3xl font-black text-white mb-4 lg:mb-6">USDCx Bridge Integration</h3>
            <p className="text-sm lg:text-lg text-slate-400 font-light leading-relaxed mb-4 lg:mb-6">
              First protocol to integrate <span className="text-emerald-400 font-bold">Circle's xReserve bridge</span>. 
              Bridge USDC from Ethereum, receive USDCx on Stacks, and immediately supply or borrow - seamless cross-chain liquidity.
            </p>
            <div className="flex flex-wrap gap-2 lg:gap-3">
              <span className="px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] lg:text-xs font-bold text-emerald-400">xReserve Powered</span>
              <span className="px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] lg:text-xs font-bold text-emerald-400">Cross-Chain</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-900/20 to-slate-950/50 p-6 lg:p-12 rounded-2xl lg:rounded-[3rem] border border-purple-500/10 backdrop-blur-sm hover:border-purple-500/20 transition-all animate-in fade-in duration-700" style={{ animationDelay: '0.4s' }}>
            <div className="w-12 h-12 lg:w-16 lg:h-16 bg-purple-500/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-purple-400 mb-4 lg:mb-8 border border-purple-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" className="lg:w-8 lg:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h3 className="text-xl lg:text-3xl font-black text-white mb-4 lg:mb-6">Instant Liquidity Access</h3>
            <p className="text-sm lg:text-lg text-slate-400 font-light leading-relaxed mb-4 lg:mb-6">
              Borrow USDCx at <span className="text-purple-400 font-bold">66.67% LTV against STX collateral</span>. 
              No selling positions, no waiting periods. Access capital while maintaining Bitcoin exposure.
            </p>
            <div className="flex flex-wrap gap-2 lg:gap-3">
              <span className="px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] lg:text-xs font-bold text-purple-400">Instant Borrow</span>
              <span className="px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] lg:text-xs font-bold text-purple-400">66.67% LTV</span>
            </div>
          </div>
        </div>
      </section>

      {/* Utilization Visualizer Section */}
      <section className="py-16 lg:py-32 px-4 lg:px-6">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
          <div className="lg:w-1/2 animate-in fade-in slide-in-from-left duration-700">
            <h2 className="text-3xl lg:text-5xl font-black mb-6 lg:mb-8 text-white leading-tight">Complete USDCx Integration</h2>
            <div className="space-y-6 lg:space-y-8">
              {[
                { title: "Bridge & Earn Instantly", desc: "Bridge USDC from Ethereum via xReserve, receive USDCx on Stacks, and start earning yield immediately - all in one seamless flow." },
                { title: "Native Stacks Money Market", desc: "Built entirely in Clarity with automated interest accrual every block. First production-ready lending protocol for USDCx on Stacks." },
                { title: "Cross-Chain Liquidity Hub", desc: "Unlock capital efficiency across Bitcoin L2 ecosystem. Borrow USDCx against STX without leaving Stacks or selling your positions." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 lg:gap-6 group">
                   <div className="text-xl lg:text-2xl font-black text-slate-700 group-hover:text-orange-500 transition-colors">0{i+1}</div>
                   <div>
                     <h4 className="text-lg lg:text-xl font-bold text-white mb-1 lg:mb-2">{item.title}</h4>
                     <p className="text-sm lg:text-base text-slate-400 font-light leading-relaxed">{item.desc}</p>
                   </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="lg:w-1/2 w-full p-1.5 lg:p-2 bg-white/5 rounded-2xl lg:rounded-[3rem] border border-white/5 animate-in fade-in slide-in-from-right duration-700" style={{ animationDelay: '0.4s' }}>
            <div className="bg-[#030712] rounded-xl lg:rounded-[2.5rem] p-6 lg:p-10 border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 lg:p-8 flex gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[8px] lg:text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Activity</span>
              </div>
              
              <h4 className="text-xs lg:text-sm font-bold text-slate-500 mb-8 lg:mb-12 uppercase tracking-[0.2em] lg:tracking-[0.3em]">Protocol Utilization - Live</h4>
              
              <div className="h-auto lg:h-64 flex flex-col items-center justify-center px-4 lg:px-8 mb-4 lg:mb-6">
                {/* Current Utilization Display */}
                <div className="text-center mb-6 lg:mb-8">
                  <div className="text-5xl lg:text-7xl font-black bg-gradient-to-br from-orange-400 to-orange-600 bg-clip-text text-transparent mb-2">
                    {(stats.utilizationRate / 10000 * 100).toFixed(1)}%
                  </div>
                  <p className="text-[10px] lg:text-xs text-slate-500 uppercase tracking-widest">Current Utilization</p>
                </div>
                
                {/* Visual Bar */}
                <div className="w-full max-w-md">
                  <div className="h-4 lg:h-6 bg-slate-800 rounded-full overflow-hidden relative">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-1000 shadow-[0_0_20px_rgba(249,115,22,0.5)]"
                      style={{ width: `${(stats.utilizationRate / 10000 * 100)}%` }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-between px-3 lg:px-4 text-[8px] lg:text-[10px] font-bold">
                      <span className="text-slate-400">0%</span>
                      <span className="text-slate-400">100%</span>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 text-[8px] lg:text-[10px] text-slate-600 uppercase tracking-wider">
                    <span>Low Demand</span>
                    <span>High Demand</span>
                  </div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 lg:gap-4 mt-6 lg:mt-8 w-full max-w-md">
                  <div className="text-center p-3 lg:p-4 rounded-xl lg:rounded-2xl bg-slate-800/50">
                    <p className="text-[10px] lg:text-xs text-slate-500 mb-1">Total Supplied</p>
                    <p className="text-base lg:text-lg font-bold text-white">${(Number(stats.totalDeposited) / 1_000000).toFixed(2)}</p>
                  </div>
                  <div className="text-center p-3 lg:p-4 rounded-xl lg:rounded-2xl bg-slate-800/50">
                    <p className="text-[10px] lg:text-xs text-slate-500 mb-1">Total Borrowed</p>
                    <p className="text-base lg:text-lg font-bold text-orange-400">${(Number(stats.totalBorrowed) / 1_000000).toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-between text-[8px] lg:text-[10px] font-black text-slate-600 uppercase tracking-wider lg:tracking-widest border-t border-white/5 pt-6 lg:pt-8">
                <span>0% → 0% APY</span>
                <span className="text-orange-400">Current: {stats.utilizationRate > 0 ? `${(8 * stats.utilizationRate / 10000).toFixed(2)}%` : '0%'} APY</span>
                <span>100% → 8% APY</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-20 lg:py-40 px-4 lg:px-6">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-orange-500 to-amber-700 rounded-3xl lg:rounded-[4rem] p-8 md:p-16 lg:p-24 text-center relative overflow-hidden shadow-[0_40px_80px_rgba(249,115,22,0.2)] animate-in fade-in zoom-in duration-700">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIgLz48L3N2Zz4=')] opacity-10"></div>
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/20 blur-[100px] rounded-full"></div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black text-white mb-8 lg:mb-12 relative z-10 tracking-tighter">
            Unlock Bitcoin's<br />Idle Capital.
          </h2>
          <button 
            onClick={onEnterApp}
            className="px-10 lg:px-16 py-4 lg:py-6 bg-slate-950 text-white rounded-xl lg:rounded-2xl font-black text-lg lg:text-2xl shadow-2xl hover:scale-105 transition-all relative z-10 border border-white/10"
          >
            Launch StableLend
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 lg:py-12 px-4 lg:px-6 mt-12 lg:mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 lg:gap-8">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-orange-500 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <ShieldCheck className="text-white w-5 h-5 lg:w-6 lg:h-6" />
            </div>
            <span className="font-bold text-lg lg:text-xl tracking-tight text-white">StableLend</span>
          </div>
          
          <div className="flex gap-6 lg:gap-8 text-slate-400 text-sm">
            <button onClick={onEnterApp} className="hover:text-white transition-colors">Docs</button>
            <Link href="/learn" className="hover:text-white transition-colors">Learn</Link>
            <button onClick={onEnterApp} className="hover:text-white transition-colors">Risk AI</button>
          </div>

          <p className="text-slate-500 text-xs lg:text-sm text-center">
            © {new Date().getFullYear()} StableLend. Built for the Bitcoin Renaissance.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
