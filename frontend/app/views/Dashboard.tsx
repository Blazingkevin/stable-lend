import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, ShieldAlert, Zap, X, Info, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { View } from '@/app/types';
import { ProtocolStats, LoanDetails, withdrawUSDCx, repayLoan, getTVL, getProtocolRevenue, TransactionResult, getExplorerUrl } from '@/lib/contract-calls';
import { formatUSDCx } from '@/lib/constants';
import AIRiskAnalysis from '@/components/AIRiskAnalysis';

interface DashboardProps {
  onAction: (view: View) => void;
  userAddress?: string | null;
  walletBalance?: bigint; // USDCx in user's wallet (available to supply)
  stxWalletBalance?: bigint; // STX in user's wallet
  stxPrice?: bigint; // STX price in USD (6 decimals)
  lenderBalance?: bigint; // USDCx supplied to protocol (earning interest) - now includes real-time interest from contract
  lenderShares?: bigint; // Shares held (for withdrawal)
  loans?: LoanDetails[]; // Loans now include real-time interest from contract
  protocolStats?: ProtocolStats;
  currentAPY?: number;
  onRefresh?: () => void; // Callback to refresh data after transactions
}

const Dashboard: React.FC<DashboardProps> = ({ 
  onAction, 
  userAddress,
  walletBalance,
  stxWalletBalance,
  stxPrice,
  lenderBalance,
  lenderShares,
  loans,
  protocolStats,
  currentAPY,
  onRefresh 
}) => {
  // Modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [showInterestInfoModal, setShowInterestInfoModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanDetails | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'confirming' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentTxId, setCurrentTxId] = useState<string | null>(null);
  const [tvl, setTvl] = useState<bigint>(BigInt(0));
  const [protocolRevenue, setProtocolRevenue] = useState<bigint>(BigInt(0));
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update lastUpdated when data changes
  useEffect(() => {
    setLastUpdated(new Date());
  }, [lenderBalance, loans]);

  // Handle manual refresh
  const handleManualRefresh = async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      await onRefresh();
      setLastUpdated(new Date());
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  // Fetch TVL and protocol revenue on mount
  useEffect(() => {
    const fetchProtocolData = async () => {
      if (!userAddress) return;
      try {
        const [tvlData, revenueData] = await Promise.all([
          getTVL(userAddress),
          getProtocolRevenue(userAddress)
        ]);
        setTvl(tvlData);
        setProtocolRevenue(revenueData);
      } catch (error) {
        console.error('Error fetching protocol data:', error);
      }
    };
    fetchProtocolData();
  }, [userAddress]);

  // Calculate balances - contract now returns real-time values
  const availableBalance = walletBalance ? Number(walletBalance) / 1_000000 : 0;
  const stxAvailableBalance = stxWalletBalance ? Number(stxWalletBalance) / 1_000000 : 0;
  const stxPriceUsd = stxPrice ? Number(stxPrice) / 1_000000 : 0; // 0 means price not loaded yet
  const totalSupplied = lenderBalance ? Number(lenderBalance) / 1_000000 : 0;
  
  // Calculate total borrowed from user's ACTIVE loans only (borrowed + interest from contract)
  const totalBorrowed = loans?.reduce((sum, loan) => {
    // Only count active loans
    if (!loan.isActive) return sum;
    // Contract now returns real-time interest directly
    return sum + (Number(loan.borrowedAmount + loan.accruedInterest) / 1_000000);
  }, 0) || 0;

  // Calculate total collateral staked from active loans
  const totalCollateral = loans?.reduce((sum, loan) => {
    if (!loan.isActive) return sum;
    return sum + (Number(loan.collateralAmount) / 1_000000);
  }, 0) || 0;
  
  // Calculate net value
  const netValue = totalSupplied - totalBorrowed;
  
  // Get health factor from first active loan (or show safe if no loans)
  const activeLoan = loans?.find(l => l.isActive);
  const healthFactor = activeLoan ? 'Calculating...' : 'N/A';
  
  // Calculate borrow power used (percentage of collateral used)
  const borrowPowerUsed = totalSupplied > 0 ? (totalBorrowed / totalSupplied) * 100 : 0;

  // Calculate ACTUAL lender APY based on protocol utilization
  // Borrowers pay borrowAPY, but lenders earn borrowAPY × utilization rate
  const borrowAPY = currentAPY || 8.0; // Rate borrowers pay
  const protocolUtilization = protocolStats ? Number(protocolStats.utilizationRate) / 10000 : 0; // Convert from basis points (10000 = 100%)
  const effectiveLenderAPY = borrowAPY * protocolUtilization; // What lenders actually earn

  // Withdraw handler - V4 uses shares-based withdrawal
  const handleWithdraw = async () => {
    if (!userAddress || !withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setErrorMessage('Please enter a valid amount');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (amount > totalSupplied) {
      setErrorMessage('Insufficient balance');
      return;
    }

    // Calculate shares to burn based on amount/balance ratio
    // If user has 100 USDCx balance and 100 shares, to withdraw 50 USDCx → burn 50 shares
    const userShares = lenderShares || BigInt(0);
    const userBalance = lenderBalance || BigInt(0);
    
    if (userShares === BigInt(0) || userBalance === BigInt(0)) {
      setErrorMessage('No balance to withdraw');
      return;
    }

    // Calculate shares to burn: sharesToBurn = (withdrawAmount / totalBalance) * totalShares
    const amountMicro = BigInt(Math.floor(amount * 1_000_000));
    const sharesToBurn = (amountMicro * userShares) / userBalance;
    
    if (sharesToBurn === BigInt(0)) {
      setErrorMessage('Amount too small');
      return;
    }

    setIsLoading(true);
    setTxStatus('pending');
    setErrorMessage('');

    try {
      await withdrawUSDCx(sharesToBurn, userAddress, {
        onBroadcast: (txId) => {
          setCurrentTxId(txId);
          setTxStatus('confirming');
        },
        onConfirmed: (result) => {
          setCurrentTxId(result.txId || null);
          setTxStatus('success');
          
          setTimeout(() => {
            if (onRefresh) onRefresh();
            setShowWithdrawModal(false);
            setWithdrawAmount('');
            setTxStatus('idle');
            setCurrentTxId(null);
          }, 3000);
        },
        onFailed: (result) => {
          setCurrentTxId(result.txId || null);
          setErrorMessage(result.errorMessage || 'Transaction failed on-chain');
          setTxStatus('error');
          setIsLoading(false);
        },
        onCancel: () => {
          setIsLoading(false);
          setTxStatus('idle');
        },
      });
    } catch (error: any) {
      setErrorMessage(error.message || 'Transaction failed');
      setTxStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Repay handler
  const handleRepay = async (loan: LoanDetails) => {
    if (!userAddress) return;

    setIsLoading(true);
    setTxStatus('pending');
    setErrorMessage('');

    try {
      await repayLoan(loan.loanId, userAddress, {
        onBroadcast: (txId) => {
          setCurrentTxId(txId);
          setTxStatus('confirming');
        },
        onConfirmed: (result) => {
          setCurrentTxId(result.txId || null);
          setTxStatus('success');
          
          setTimeout(() => {
            if (onRefresh) onRefresh();
            setShowRepayModal(false);
            setSelectedLoan(null);
            setTxStatus('idle');
            setCurrentTxId(null);
          }, 3000);
        },
        onFailed: (result) => {
          setCurrentTxId(result.txId || null);
          setErrorMessage(result.errorMessage || 'Transaction failed on-chain');
          setTxStatus('error');
          setIsLoading(false);
        },
        onCancel: () => {
          setIsLoading(false);
          setTxStatus('idle');
        },
      });
    } catch (error: any) {
      setErrorMessage(error.message || 'Transaction failed');
      setTxStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Format time since last update
  const formatLastUpdated = () => {
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    if (diffSeconds < 5) return 'Just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    return `${Math.floor(diffSeconds / 60)}m ago`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Manage your Bitcoin-layer liquidity and debt.</p>
        </div>
        <div className="flex gap-3 items-center">
          {/* Refresh indicator */}
          {userAddress && (
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-xs"
              title="Click to refresh balances"
            >
              <svg 
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{formatLastUpdated()}</span>
            </button>
          )}
          <button 
            onClick={() => onAction(View.Lend)}
            className="px-6 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-all flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Supply Now
          </button>
        </div>
      </div>

      {/* USDCx Balance Highlight */}
      {userAddress && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Wallet Balance - Both Assets */}
          <div className="glass-card p-6 rounded-3xl border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-cyan-500/5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400 font-semibold">Wallet Balance</p>
              <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 font-bold">Available</span>
            </div>
            
            {/* Horizontal Split: USDCx | STX */}
            <div className="grid grid-cols-2 gap-4">
              {/* USDCx Balance */}
              <div className="pr-4 border-r border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" alt="USDCx" className="w-5 h-5" />
                  <span className="text-xs text-gray-500 uppercase font-bold">USDCx</span>
                </div>
                <h2 className="text-2xl font-bold text-white mono">
                  {availableBalance.toFixed(2)}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  ≈ ${availableBalance.toFixed(2)}
                </p>
              </div>

              {/* STX Balance */}
              <div className="pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <img src="https://cryptologos.cc/logos/stacks-stx-logo.png" alt="STX" className="w-5 h-5" />
                  <span className="text-xs text-gray-500 uppercase font-bold">STX</span>
                </div>
                <h2 className="text-2xl font-bold text-white mono">
                  {stxAvailableBalance.toFixed(2)}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {stxPriceUsd > 0 
                    ? `≈ $${(stxAvailableBalance * stxPriceUsd).toFixed(2)} @ $${stxPriceUsd.toFixed(2)}`
                    : 'Loading price...'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Protocol Balance */}
          <div className="glass-card p-6 rounded-3xl border-2 border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-purple-500/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" alt="USDCx" className="w-6 h-6" />
                <p className="text-sm text-gray-400 font-semibold">Supplied Balance</p>
                {totalSupplied > 0 && (
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    LIVE
                  </span>
                )}
                <button
                  onClick={() => setShowInterestInfoModal(true)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors group"
                  title="How does interest work?"
                >
                  <Info className="w-4 h-4 text-gray-500 group-hover:text-orange-400" />
                </button>
              </div>
              <div className="text-right">
                <span className="text-xs px-2 py-1 rounded-full bg-orange-500/10 text-orange-400 font-bold">
                  {effectiveLenderAPY.toFixed(2)}% APY
                </span>
                <p className="text-[10px] text-gray-500 mt-1">
                  {borrowAPY}% × {(protocolUtilization * 100).toFixed(0)}% util
                </p>
              </div>
            </div>
            <h2 className="text-4xl font-bold text-white mono mb-2">
              {totalSupplied.toFixed(6)} USDCx
            </h2>
            <div className="flex items-center justify-between">
              <p className="text-xs text-green-500 font-semibold">
                Interest earned: +{((totalSupplied * (effectiveLenderAPY / 100)) / 365).toFixed(6)} USDCx/day
              </p>
              {totalSupplied > 0 && (
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-semibold transition-all flex items-center gap-1"
                >
                  <ArrowDownRight className="w-3 h-3" />
                  Withdraw
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Borrowed Balance & Collateral Cards */}
      {userAddress && loans && loans.length > 0 && totalBorrowed > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
          {/* Borrowed Balance Card */}
          <div className="glass-card p-6 rounded-3xl border-2 border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-orange-500/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" alt="USDCx" className="w-6 h-6" />
                <p className="text-sm text-gray-400 font-semibold">Borrowed Balance</p>
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                  <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-pulse"></span>
                  LIVE
                </span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-rose-500/10 text-rose-400 font-bold">
                8.00% APY
              </span>
            </div>
            <h2 className="text-4xl font-bold text-white mono mb-2">
              {totalBorrowed.toFixed(6)} USDCx
            </h2>
            <div className="flex items-center justify-between">
              <p className="text-xs text-rose-400 font-semibold">
                Interest cost: +{((totalBorrowed * 0.08) / 365).toFixed(6)} USDCx/day
              </p>
              <button
                onClick={() => {
                  const activeLoan = loans.find(l => l.isActive);
                  if (activeLoan) {
                    setSelectedLoan(activeLoan);
                    setShowRepayModal(true);
                  }
                }}
                className="px-3 py-1.5 text-xs rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 font-semibold transition-all flex items-center gap-1"
              >
                <ArrowUpRight className="w-3 h-3" />
                Repay
              </button>
            </div>
          </div>

          {/* Collateral Staked Card */}
          <div className="glass-card p-6 rounded-3xl border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-blue-500/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <img src="https://cryptologos.cc/logos/stacks-stx-logo.png" alt="STX" className="w-6 h-6" />
                <p className="text-sm text-gray-400 font-semibold">Collateral Staked</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 font-bold">
                Locked
              </span>
            </div>
            <h2 className="text-4xl font-bold text-white mono mb-2">
              {totalCollateral.toFixed(2)} STX
            </h2>
            <div className="flex items-center justify-between">
              <p className="text-xs text-purple-400 font-semibold">
                {stxPriceUsd > 0 
                  ? `≈ $${(totalCollateral * stxPriceUsd).toFixed(2)} USD`
                  : 'Loading price...'}
              </p>
              <p className="text-xs text-gray-500">
                Secures {totalBorrowed.toFixed(2)} USDCx
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Net Daily Impact Banner */}
      {userAddress && loans && loans.length > 0 && totalBorrowed > 0 && totalSupplied > 0 && (
        <div className="glass-card p-4 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold">Net Daily Impact</p>
                <p className="text-sm text-gray-300">
                  Earning {((totalSupplied * (effectiveLenderAPY / 100)) / 365).toFixed(6)} USDCx/day
                  {' '}-{' '}
                  Paying {((totalBorrowed * 0.08) / 365).toFixed(6)} USDCx/day
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">Net Result</p>
              <p className={`text-xl font-bold ${
                ((totalSupplied * (effectiveLenderAPY / 100)) / 365) - ((totalBorrowed * 0.08) / 365) >= 0 
                  ? 'text-green-400' 
                  : 'text-rose-400'
              }`}>
                {((totalSupplied * (effectiveLenderAPY / 100)) / 365) - ((totalBorrowed * 0.08) / 365) >= 0 ? '+' : ''}
                {(((totalSupplied * (effectiveLenderAPY / 100)) / 365) - ((totalBorrowed * 0.08) / 365)).toFixed(6)} USDCx/day
              </p>
            </div>
          </div>
        </div>
      )}

      {!userAddress && (
        <div className="glass-card p-6 rounded-3xl border-2 border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-purple-500/5">
          <div className="text-center py-4">
            <p className="text-gray-400 mb-2">Connect your Stacks wallet to view your USDCx balance</p>
            <p className="text-xs text-gray-500">Bridge USDC from Ethereum to get started</p>
          </div>
        </div>
      )}

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            label: 'Total Net Value', 
            value: userAddress ? `$${netValue.toFixed(2)}` : '$0.00', 
            change: netValue > 0 ? `+${((netValue / 100) * 100).toFixed(1)}%` : '0%', 
            color: 'blue' 
          },
          { 
            label: 'Supply APY', 
            value: `${effectiveLenderAPY.toFixed(2)}%`, 
            change: `${(protocolUtilization * 100).toFixed(0)}% Utilized`, 
            color: 'orange',
            tooltip: `Borrowers pay ${borrowAPY}% APY. Lenders earn ${borrowAPY}% × ${(protocolUtilization * 100).toFixed(0)}% utilization = ${effectiveLenderAPY.toFixed(2)}% APY`
          },
          { 
            label: 'Borrow Power Used', 
            value: `${borrowPowerUsed.toFixed(1)}%`, 
            change: borrowPowerUsed > 0 ? 'Active' : 'None', 
            color: 'purple' 
          },
          { 
            label: 'Health Factor', 
            value: loans && loans.length > 0 ? healthFactor : 'N/A', 
            change: loans && loans.length > 0 ? 'SAFE' : 'No Loans', 
            color: 'green' 
          }
        ].map((stat, i) => (
          <div key={i} className="glass-card p-6 rounded-3xl group hover:border-orange-500/30 transition-all">
            <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-white mono">{stat.value}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                stat.color === 'green' ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-gray-400'
              }`}>
                {stat.change}
              </span>
            </div>
            {stat.label === 'Health Factor' && (
              <div className="mt-4 h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-[75%]" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* APY Explanation Banner */}
      {userAddress && totalSupplied > 0 && (
        <div className="glass-card p-4 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white mb-1">How Supply APY Works</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Borrowers pay <span className="text-orange-400 font-semibold">{borrowAPY}% APY</span> on their loans. 
                This interest is distributed to all lenders based on protocol utilization. 
                Current utilization: <span className="text-blue-400 font-semibold">{(protocolUtilization * 100).toFixed(1)}%</span>. 
                Your effective APY: <span className="text-green-400 font-semibold">{effectiveLenderAPY.toFixed(2)}%</span> 
                ({borrowAPY}% × {(protocolUtilization * 100).toFixed(0)}%). 
                As more capital gets borrowed, your APY increases towards the full {borrowAPY}%.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Protocol Overview - replaced chart with live data */}
        <div className="lg:col-span-2 glass-card p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white">Protocol Overview</h3>
              <p className="text-sm text-gray-400">Live on-chain data from StableLend V6</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400 font-semibold">Live</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20">
              <p className="text-xs text-gray-400 mb-1">Total Value Locked</p>
              <p className="text-2xl font-bold text-white">
                ${protocolStats ? (Number(protocolStats.totalDeposited) / 1_000000).toFixed(2) : '0.00'}
              </p>
              <p className="text-xs text-blue-400 mt-1">
                {protocolStats ? (Number(protocolStats.totalDeposited) / 1_000000).toFixed(6) : '0'} USDCx
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/10 to-rose-500/5 border border-orange-500/20">
              <p className="text-xs text-gray-400 mb-1">Total Borrowed</p>
              <p className="text-2xl font-bold text-white">
                ${protocolStats ? (Number(protocolStats.totalBorrowed) / 1_000000).toFixed(2) : '0.00'}
              </p>
              <p className="text-xs text-orange-400 mt-1">
                {protocolStats ? (Number(protocolStats.totalBorrowed) / 1_000000).toFixed(6) : '0'} USDCx
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs text-gray-400 mb-1">Utilization</p>
              <p className="text-lg font-bold text-purple-400">
                {protocolStats ? (protocolStats.utilizationRate / 100).toFixed(2) : '0'}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs text-gray-400 mb-1">Borrow APY</p>
              <p className="text-lg font-bold text-orange-400">{borrowAPY}%</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs text-gray-400 mb-1">Lender APY</p>
              <p className="text-lg font-bold text-green-400">{effectiveLenderAPY.toFixed(2)}%</p>
            </div>
          </div>
          
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Active Users</p>
                <p className="text-xl font-bold text-white">
                  {(protocolStats?.totalLenders || 0) + (protocolStats?.totalBorrowers || 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-400">{protocolStats?.totalLenders || 0} lenders</p>
                <p className="text-xs text-orange-400">{protocolStats?.totalBorrowers || 0} borrowers</p>
              </div>
            </div>
          </div>
        </div>

        {/* Assets & Liquidations */}
        <div className="space-y-6">
          {/* AI Risk Monitoring replaces basic risk monitoring */}
          <AIRiskAnalysis loan={activeLoan} stxPrice={stxPriceUsd || 0} />

          <div className="glass-card p-6 rounded-3xl">
            <h3 className="text-md font-bold text-white mb-4">Your Positions</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center font-bold text-xs text-orange-500">U</div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">USDCx Supplied</span>
                    <span className="text-orange-500 font-bold">{totalSupplied.toFixed(6)} USDCx</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full">
                    <div className="h-full bg-orange-500 w-full" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center font-bold text-xs text-purple-500">B</div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">USDCx Borrowed</span>
                    <span className="text-purple-500 font-bold">{totalBorrowed.toFixed(6)} USDCx</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full">
                    <div className="h-full bg-purple-500" style={{ width: `${Math.min((totalBorrowed / totalSupplied) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>
              {!userAddress && (
                <div className="text-xs text-gray-500 text-center pt-2">
                  Connect wallet to see your positions
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-8 rounded-3xl max-w-md w-full border border-white/10 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Withdraw USDCx</h3>
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount('');
                  setErrorMessage('');
                  setTxStatus('idle');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {txStatus === 'success' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Withdrawal Successful!</h4>
                <p className="text-gray-400 text-sm">Your funds will be in your wallet shortly.</p>
                {currentTxId && (
                  <a
                    href={getExplorerUrl(currentTxId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium mt-4"
                  >
                    View on Explorer <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ) : txStatus === 'confirming' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Confirming on Chain...</h4>
                <p className="text-gray-400 text-sm">Waiting for blockchain confirmation. This may take up to 30 seconds.</p>
                {currentTxId && (
                  <a
                    href={getExplorerUrl(currentTxId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium mt-4"
                  >
                    View on Explorer <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  <span>Transaction broadcast, verifying result...</span>
                </div>
              </div>
            ) : txStatus === 'error' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-red-500" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Transaction Failed</h4>
                <p className="text-red-400 text-sm mb-4">{errorMessage || 'Something went wrong'}</p>
                {currentTxId && (
                  <a
                    href={getExplorerUrl(currentTxId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium mb-4"
                  >
                    View on Explorer <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button 
                  onClick={() => {
                    setTxStatus('idle');
                    setErrorMessage('');
                    setCurrentTxId(null);
                  }}
                  className="px-6 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {/* Calculate available liquidity */}
                  {(() => {
                    const totalDeposited = protocolStats ? Number(protocolStats.totalDeposited) / 1_000000 : 0;
                    const totalBorrowedProtocol = protocolStats ? Number(protocolStats.totalBorrowed) / 1_000000 : 0;
                    const availableLiquidity = totalDeposited - totalBorrowedProtocol;
                    const canWithdrawFull = totalSupplied <= availableLiquidity;
                    const maxWithdrawable = Math.min(totalSupplied, availableLiquidity);

                    return (
                      <>
                        {!canWithdrawFull && (
                          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-amber-300 font-bold text-sm mb-1">Limited Liquidity</p>
                                <p className="text-amber-200/80 text-xs leading-relaxed">
                                  {totalBorrowedProtocol.toFixed(2)} USDCx is currently borrowed. 
                                  You can withdraw up to {maxWithdrawable.toFixed(6)} USDCx now. 
                                  Wait for borrowers to repay to withdraw more.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-gray-400">Amount to Withdraw</label>
                            <button
                              onClick={() => setWithdrawAmount(maxWithdrawable.toString())}
                              className="text-xs text-orange-500 hover:text-orange-400 font-semibold"
                            >
                              MAX ({maxWithdrawable.toFixed(2)})
                            </button>
                          </div>
                          <input
                            type="number"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="0.00"
                            max={maxWithdrawable}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-mono focus:outline-none focus:border-orange-500/50"
                            disabled={isLoading}
                          />
                        </div>

                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Your Total Balance:</span>
                            <span className="text-white font-semibold">{totalSupplied.toFixed(6)} USDCx</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Available Liquidity:</span>
                            <span className={`font-semibold ${canWithdrawFull ? 'text-green-400' : 'text-amber-400'}`}>
                              {availableLiquidity.toFixed(6)} USDCx
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">You Can Withdraw:</span>
                            <span className="text-blue-400 font-bold">{maxWithdrawable.toFixed(6)} USDCx</span>
                          </div>
                          <div className="pt-2 border-t border-blue-500/20">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Interest Earned (Est.):</span>
                              <span className="text-green-500 font-semibold">
                                ~{((totalSupplied * (effectiveLenderAPY / 100)) / 365 * 30).toFixed(6)} USDCx/mo
                              </span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-red-400 text-sm">{errorMessage}</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={isLoading || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                  className="w-full mt-6 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="w-5 h-5" />
                      Withdraw {withdrawAmount || '0.00'} USDCx
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Repay Modal */}
      {showRepayModal && selectedLoan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-8 rounded-3xl max-w-md w-full border border-white/10 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Repay Loan</h3>
              <button
                onClick={() => {
                  setShowRepayModal(false);
                  setSelectedLoan(null);
                  setErrorMessage('');
                  setTxStatus('idle');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {txStatus === 'success' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Repayment Successful!</h4>
                <p className="text-gray-400 text-sm">Your collateral has been returned.</p>
                {currentTxId && (
                  <a
                    href={getExplorerUrl(currentTxId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium mt-4"
                  >
                    View on Explorer <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ) : txStatus === 'confirming' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Confirming on Chain...</h4>
                <p className="text-gray-400 text-sm">Waiting for blockchain confirmation. This may take up to 30 seconds.</p>
                {currentTxId && (
                  <a
                    href={getExplorerUrl(currentTxId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium mt-4"
                  >
                    View on Explorer <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-4">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  <span>Transaction broadcast, verifying result...</span>
                </div>
              </div>
            ) : txStatus === 'error' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-red-500" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">Transaction Failed</h4>
                <p className="text-red-400 text-sm mb-4">{errorMessage || 'Something went wrong'}</p>
                {currentTxId && (
                  <a
                    href={getExplorerUrl(currentTxId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium mb-4"
                  >
                    View on Explorer <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button 
                  onClick={() => {
                    setTxStatus('idle');
                    setErrorMessage('');
                    setCurrentTxId(null);
                  }}
                  className="px-6 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h4 className="text-sm text-gray-400 mb-3">Loan Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Borrowed:</span>
                        <span className="text-white font-semibold">
                          {(Number(selectedLoan.borrowedAmount) / 1_000000).toFixed(6)} USDCx
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Interest Owed:</span>
                        <span className="text-orange-500 font-semibold">
                          {(Number(selectedLoan.accruedInterest) / 1_000000).toFixed(6)} USDCx
                        </span>
                      </div>
                      <div className="h-px bg-white/10 my-2" />
                      <div className="flex justify-between text-base">
                        <span className="text-white font-semibold">Total to Repay:</span>
                        <span className="text-white font-bold">
                          {((Number(selectedLoan.borrowedAmount) + Number(selectedLoan.accruedInterest)) / 1_000000).toFixed(6)} USDCx
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Collateral to Unlock:</span>
                      <span className="text-green-500 font-semibold">
                        {(Number(selectedLoan.collateralAmount) / 1_000000).toFixed(2)} STX
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <p className="text-orange-400 text-xs">
                      💡 Final amount may vary slightly (fractions of a cent) due to interest accruing until transaction confirms.
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-red-400 text-sm">{errorMessage}</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleRepay(selectedLoan)}
                  disabled={isLoading}
                  className="w-full mt-6 px-6 py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Repay Full Loan
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Interest Info Modal */}
      {showInterestInfoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-8 rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">How Interest Works</h2>
                  <p className="text-sm text-gray-400">Understanding your growing balance</p>
                </div>
              </div>
              <button
                onClick={() => setShowInterestInfoModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Your Example */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-400" />
                  Your Current Position
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Initial Supply:</span>
                    <span className="text-white font-bold">6.000000 USDCx</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Interest Earned:</span>
                    <span className="text-green-400 font-bold">+{(totalSupplied - 6).toFixed(6)} USDCx</span>
                  </div>
                  <div className="h-px bg-white/10"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Current Balance:</span>
                    <span className="text-orange-400 font-bold text-lg">{totalSupplied.toFixed(6)} USDCx</span>
                  </div>
                </div>
              </div>

              {/* How it works */}
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">📈 Block-by-Block Compounding</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-300 text-sm leading-relaxed mb-2">
                      Your balance grows <span className="text-orange-400 font-bold">automatically every ~10 minutes</span> (every Stacks block):
                    </p>
                    <div className="ml-4 space-y-2 text-sm">
                      <p className="text-gray-400">
                        ✓ Interest is calculated per block: <span className="text-white font-mono">principal × 8% ÷ 52,560 blocks/year</span>
                      </p>
                      <p className="text-gray-400">
                        ✓ Added to your balance immediately
                      </p>
                      <p className="text-gray-400">
                        ✓ Next block's interest calculates on the NEW higher balance
                      </p>
                      <p className="text-gray-400">
                        ✓ This creates <span className="text-green-400 font-bold">compound growth</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Where does it come from */}
              <div className="p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                <h3 className="text-lg font-bold text-white mb-4">💰 Where Does The Money Come From?</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-400 font-bold">1</span>
                    </div>
                    <div>
                      <p className="text-gray-300">
                        <span className="text-white font-bold">Borrowers pay 8% APY</span> to borrow your USDCx
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-400 font-bold">2</span>
                    </div>
                    <div>
                      <p className="text-gray-300">
                        They put up <span className="text-white font-bold">STX collateral</span> (worth 150% of loan)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-400 font-bold">3</span>
                    </div>
                    <div>
                      <p className="text-gray-300">
                        Interest they pay goes <span className="text-green-400 font-bold">directly to you</span> (lenders)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-400 font-bold">4</span>
                    </div>
                    <div>
                      <p className="text-gray-300">
                        The smart contract <span className="text-white font-bold">automatically calculates and adds</span> your share every block
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Math Example */}
              <div className="p-6 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                <h3 className="text-lg font-bold text-white mb-4">🧮 The Math</h3>
                <div className="space-y-3 font-mono text-sm">
                  <div>
                    <p className="text-gray-400 mb-1">Your 6 USDCx supply:</p>
                    <p className="text-white">
                      Interest per block = 6 × 800 (8% in basis points) ÷ 10,000 ÷ 52,560 blocks
                    </p>
                    <p className="text-orange-400 mt-1">
                      = ~0.000000915 USDCx per block (~every 10 mins)
                    </p>
                  </div>
                  <div className="h-px bg-white/10"></div>
                  <div>
                    <p className="text-gray-400 mb-1">Per day (144 blocks):</p>
                    <p className="text-green-400">
                      ~0.000132 USDCx per day
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Your actual interest earned so far:</p>
                    <p className="text-orange-400 font-bold text-lg">
                      {(totalSupplied - 6).toFixed(6)} USDCx
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      (Growing every block! 📈)
                    </p>
                  </div>
                </div>
              </div>

              {/* Protocol State Warning */}
              {protocolStats && Number(protocolStats.totalBorrowed) === 0 && (
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                    ⚠️ Important Note (MVP Testnet)
                  </h3>
                  <div className="space-y-3 text-sm">
                    <p className="text-gray-300">
                      <span className="text-green-400 font-bold">✓ Utilization-Based Interest is LIVE:</span>
                    </p>
                    <div className="ml-4 space-y-2">
                      <p className="text-gray-400">
                        • Your APY = <span className="text-orange-400 font-mono">8% × Utilization%</span>
                      </p>
                      <p className="text-gray-400">
                        • With 0% utilization, you earn <span className="text-red-400 font-bold">0%</span> APY (no borrowers = no interest)
                      </p>
                      <p className="text-gray-400">
                        • At 50% utilization, you earn <span className="text-green-400 font-bold">4%</span> APY
                      </p>
                      <p className="text-gray-400">
                        • At 100% utilization, you earn <span className="text-green-400 font-bold">8%</span> APY (max)
                      </p>
                      <p className="text-gray-400">
                        • Protocol takes <span className="text-white font-bold">10% fee</span> from interest (90% goes to lenders)
                      </p>
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-green-200 text-xs">
                        ✓ <span className="font-bold">Economically Sound:</span> Your interest now comes from actual borrowers paying 8% APY. When utilization is high, you earn more. When it's low, you earn less - just like Aave, Compound, and other production protocols!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Borrowers Info */}
              {protocolStats && Number(protocolStats.totalBorrowed) > 0 && (
                <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    ✅ Active Borrowers Detected!
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Total Borrowed:</span>
                      <span className="text-green-400 font-bold">
                        {(Number(protocolStats.totalBorrowed) / 1_000000).toFixed(6)} USDCx
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Utilization Rate:</span>
                      <span className="text-orange-400 font-bold">
                        {(protocolStats.utilizationRate / 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Your Effective APY:</span>
                      <span className="text-green-400 font-bold">
                        {(8 * protocolStats.utilizationRate / 10000).toFixed(2)}%
                      </span>
                    </div>
                    <div className="mt-4 p-3 rounded-lg bg-green-500/10">
                      <p className="text-green-200 text-xs">
                        ✓ Borrowers are paying 8% APY, which funds your {(8 * protocolStats.utilizationRate / 10000).toFixed(2)}% returns!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Key Points */}
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">🎯 Key Points</h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-300 flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span>Your money is <span className="text-white font-bold">always yours</span> - withdraw anytime</span>
                  </p>
                  <p className="text-gray-300 flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span>Interest compounds <span className="text-white font-bold">automatically</span> every ~10 minutes</span>
                  </p>
                  <p className="text-gray-300 flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span>Borrowers' collateral <span className="text-white font-bold">protects you</span> from losses</span>
                  </p>
                  <p className="text-gray-300 flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span>All calculations are <span className="text-white font-bold">on-chain and transparent</span></span>
                  </p>
                  <p className="text-gray-300 flex items-start gap-2">
                    <span className="text-orange-400">⚡</span>
                    <span>The more people borrow, the more interest you earn!</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowInterestInfoModal(false)}
                className="w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold hover:from-orange-600 hover:to-amber-700 transition-all"
              >
                Got it! 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
