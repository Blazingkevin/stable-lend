import React, { useState, useEffect } from 'react';
import { ASSETS } from '@/app/constants';
import { Asset } from '@/app/types';
import { LoanDetails, ProtocolStats, getMaxBorrowAmount, getProtocolCaps, ProtocolCaps, getTVL, getProtocolRevenue, TransactionResult, getExplorerUrl } from '@/lib/contract-calls';
import { depositUSDCx, borrowUSDCx } from '@/lib/contract-calls';
// Add missing TrendingUp import
import { Info, Plus, MoveRight, Wallet, TrendingUp, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

interface MarketsProps {
  type: 'supply' | 'borrow';
  userAddress?: string | null;
  walletBalance?: bigint; // USDCx in wallet (available to supply/use)
  lenderBalance?: bigint; // USDCx supplied to protocol
  stxPrice?: bigint; // STX price from oracle (6 decimals)
  loans?: LoanDetails[];
  loanIds?: number[];
  protocolStats?: ProtocolStats;
  currentAPY?: number;
  onRefresh?: () => void;
}

const Markets: React.FC<MarketsProps> = ({ 
  type, 
  userAddress, 
  walletBalance,
  lenderBalance,
  stxPrice,
  loans, 
  loanIds,
  protocolStats,
  currentAPY,
  onRefresh 
}) => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [collateralAmount, setCollateralAmount] = useState<string>(''); // STX collateral for borrowing
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'confirming' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentTxId, setCurrentTxId] = useState<string | null>(null);
  const [maxBorrowFromContract, setMaxBorrowFromContract] = useState<bigint>(BigInt(0));
  const [protocolCaps, setProtocolCaps] = useState<ProtocolCaps | null>(null);
  const [isCalculatingMax, setIsCalculatingMax] = useState(false);

  // Calculate available balance
  const availableUSDCx = walletBalance ? Number(walletBalance) / 1_000000 : 0;

  // Calculate available liquidity in protocol for borrowing
  const availableToBorrow = protocolStats 
    ? (Number(protocolStats.totalDeposited) - Number(protocolStats.totalBorrowed)) / 1_000000 
    : 0;

  // Collateral ratio from contract: 150% (user must provide 1.5x value)
  const COLLATERAL_RATIO = 1.5;
  const STX_PRICE = stxPrice ? Number(stxPrice) / 1_000000 : 0; // STX price from oracle
  const USDCX_PRICE = 1.00; // USDCx is pegged to USD

  // Fetch protocol caps on mount
  useEffect(() => {
    const fetchCaps = async () => {
      if (!userAddress) return;
      try {
        const caps = await getProtocolCaps(userAddress);
        setProtocolCaps(caps);
      } catch (error) {
        console.error('Error fetching protocol caps:', error);
      }
    };
    fetchCaps();
  }, [userAddress]);

  // Fetch max borrow amount from contract when collateral changes
  useEffect(() => {
    const fetchMaxBorrow = async () => {
      if (!userAddress || !collateralAmount || type !== 'borrow') return;
      
      const collateralSTX = parseFloat(collateralAmount);
      if (isNaN(collateralSTX) || collateralSTX <= 0) {
        setMaxBorrowFromContract(BigInt(0));
        return;
      }

      setIsCalculatingMax(true);
      try {
        const collateralMicro = BigInt(Math.floor(collateralSTX * 1_000_000));
        const maxBorrow = await getMaxBorrowAmount(collateralMicro, userAddress);
        setMaxBorrowFromContract(maxBorrow);
      } catch (error) {
        console.error('Error fetching max borrow:', error);
        setMaxBorrowFromContract(BigInt(0));
      } finally {
        setIsCalculatingMax(false);
      }
    };

    fetchMaxBorrow();
  }, [collateralAmount, userAddress, type]);

  // Calculate required collateral based on borrow amount
  const calculateRequiredCollateral = (borrowAmountUSD: number): number => {
    // Required collateral in USD = borrow amount * collateral ratio
    const requiredUSD = borrowAmountUSD * COLLATERAL_RATIO;
    // Convert to STX
    return requiredUSD / STX_PRICE;
  };

  // Calculate max borrow based on collateral
  const calculateMaxBorrow = (collateralSTX: number): number => {
    // Collateral value in USD
    const collateralUSD = collateralSTX * STX_PRICE;
    // Max borrow = collateral value / collateral ratio
    return collateralUSD / COLLATERAL_RATIO;
  };

  // Update borrow amount when collateral changes
  const handleCollateralChange = (value: string) => {
    setCollateralAmount(value);
    if (type === 'borrow' && value) {
      const collateralSTX = parseFloat(value);
      if (!isNaN(collateralSTX) && collateralSTX > 0) {
        const maxBorrow = calculateMaxBorrow(collateralSTX);
        // Auto-suggest max borrow amount
        if (!amount || parseFloat(amount) > maxBorrow) {
          setAmount(maxBorrow.toFixed(6));
        }
      }
    }
  };

  // Update collateral when borrow amount changes
  const handleBorrowAmountChange = (value: string) => {
    setAmount(value);
    if (type === 'borrow' && value) {
      const borrowAmount = parseFloat(value);
      if (!isNaN(borrowAmount) && borrowAmount > 0) {
        const requiredCollateral = calculateRequiredCollateral(borrowAmount);
        setCollateralAmount(requiredCollateral.toFixed(6));
      }
    }
  };

  const handleMaxClick = () => {
    if (selectedAsset?.symbol === 'USDCx') {
      setAmount(availableUSDCx.toFixed(6));
    }
  };

  const handleExecute = async () => {
    if (!userAddress || !selectedAsset || !amount || parseFloat(amount) <= 0) {
      setErrorMessage('Please enter a valid amount');
      return;
    }

    if (selectedAsset.symbol !== 'USDCx') {
      setErrorMessage('Only USDCx is currently supported');
      return;
    }

    if (type === 'supply' && parseFloat(amount) > availableUSDCx) {
      setErrorMessage('Insufficient balance');
      return;
    }

    if (type === 'borrow' && (!collateralAmount || parseFloat(collateralAmount) <= 0)) {
      setErrorMessage('Please enter collateral amount');
      return;
    }

    setIsLoading(true);
    setTxStatus('pending');
    setErrorMessage('');

    try {
      if (type === 'supply') {
        const amountMicroUSDCx = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
        
        await depositUSDCx(amountMicroUSDCx, userAddress, {
          onBroadcast: (txId) => {
            setCurrentTxId(txId);
            setTxStatus('confirming');
          },
          onConfirmed: (result) => {
            setCurrentTxId(result.txId || null);
            setTxStatus('success');
            
            setTimeout(() => {
              if (onRefresh) onRefresh();
              closeModal();
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
      } else {
        const borrowAmountMicro = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
        const collateralStxMicro = BigInt(Math.floor(parseFloat(collateralAmount) * 1_000_000));
        
        await borrowUSDCx(borrowAmountMicro, collateralStxMicro, userAddress, {
          onBroadcast: (txId) => {
            setCurrentTxId(txId);
            setTxStatus('confirming');
          },
          onConfirmed: (result) => {
            setCurrentTxId(result.txId || null);
            setTxStatus('success');
            
            setTimeout(() => {
              if (onRefresh) onRefresh();
              closeModal();
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
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Transaction failed');
      setTxStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedAsset(null);
    setAmount('');
    setCollateralAmount('');
    setTxStatus('idle');
    setErrorMessage('');
    setCurrentTxId(null);
  };

  // Update USDCx asset with real data from protocol
  const assets = ASSETS.map(asset => {
    if (asset.symbol === 'USDCx' && protocolStats) {
      const totalSupplied = Number(protocolStats.totalDeposited) / 1_000000;
      const totalBorrowed = Number(protocolStats.totalBorrowed) / 1_000000;
      const utilizationBps = protocolStats.utilizationRate; // Already in basis points from contract
      const utilization = utilizationBps / 100; // Convert to percentage for display
      
      // Calculate effective supply APY: borrowAPY * utilization rate
      const borrowAPY = currentAPY || 8.0;
      const effectiveSupplyAPY = (borrowAPY * utilizationBps) / 10000; // utilizationBps is in basis points
      
      return {
        ...asset,
        supplyApy: Number(effectiveSupplyAPY.toFixed(2)),
        borrowApy: borrowAPY,
        totalSupplied,
        totalBorrowed,
        utilization: Number(utilization.toFixed(1)),
      };
    }
    // STX and sBTC remain at 0 (coming soon)
    return asset;
  });

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
              {assets.map((asset) => (
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
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 font-bold">LIVE</span>
                          )}
                          {(asset.symbol === 'STX' || asset.symbol === 'sBTC') && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-500 font-bold">COMING SOON</span>
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
                      <span className={`font-bold text-lg mono ${
                        type === 'supply' ? 'text-green-500' : 'text-orange-500'
                      } ${asset.symbol !== 'USDCx' ? 'opacity-30' : ''}`}>
                        {type === 'supply' ? asset.supplyApy : asset.borrowApy}%
                      </span>
                      {asset.symbol === 'USDCx' ? (
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Live Data
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500">Coming Soon</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className={`text-sm font-medium text-white mono ${asset.symbol !== 'USDCx' ? 'opacity-30' : ''}`}>
                      {(type === 'supply' ? asset.totalSupplied : asset.totalBorrowed).toFixed(2)} {asset.symbol}
                    </div>
                    <div className={`text-xs text-gray-500 ${asset.symbol !== 'USDCx' ? 'opacity-30' : ''}`}>
                      ${((type === 'supply' ? asset.totalSupplied : asset.totalBorrowed) * asset.price).toFixed(2)}
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${asset.utilization > 80 ? 'bg-red-500' : 'bg-orange-500'} ${asset.symbol !== 'USDCx' ? 'opacity-30' : ''}`} 
                          style={{ width: `${asset.utilization}%` }}
                        />
                      </div>
                      <span className={`text-xs text-gray-400 mono ${asset.symbol !== 'USDCx' ? 'opacity-30' : ''}`}>
                        {asset.utilization.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => asset.symbol === 'USDCx' && setSelectedAsset(asset)}
                      disabled={asset.symbol !== 'USDCx'}
                      className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
                        asset.symbol === 'USDCx'
                          ? 'bg-white/5 border border-white/10 hover:border-orange-500 hover:bg-orange-500'
                          : 'bg-white/5 border border-white/5 text-gray-600 cursor-not-allowed'
                      }`}
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
              <button onClick={closeModal} className="p-2 text-gray-500 hover:text-white text-3xl leading-none">&times;</button>
            </div>

            {txStatus === 'success' ? (
              <div className="space-y-6 text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Transaction Successful!</h3>
                  <p className="text-gray-400">Your {type === 'supply' ? 'supply' : 'borrow'} has been processed</p>
                </div>
                {currentTxId && (
                  <a
                    href={getExplorerUrl(currentTxId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium"
                  >
                    View on Explorer <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button 
                  onClick={closeModal}
                  className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-bold text-lg"
                >
                  Done
                </button>
              </div>
            ) : txStatus === 'confirming' ? (
              <div className="space-y-6 text-center py-8">
                <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Confirming on Chain...</h3>
                  <p className="text-gray-400">Waiting for blockchain confirmation. This may take up to 30 seconds.</p>
                </div>
                {currentTxId && (
                  <a
                    href={getExplorerUrl(currentTxId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium"
                  >
                    View on Explorer <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  <span>Transaction broadcast, verifying result...</span>
                </div>
              </div>
            ) : txStatus === 'error' ? (
              <div className="space-y-6 text-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Transaction Failed</h3>
                  <p className="text-red-400 text-sm">{errorMessage || 'Something went wrong'}</p>
                </div>
                {currentTxId && (
                  <a
                    href={getExplorerUrl(currentTxId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium"
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
                  className="w-full py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-lg"
                >
                  Try Again
                </button>
              </div>
            ) : (
            <div className="space-y-6">
              {/* Borrow Amount Input */}
              <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{type === 'supply' ? 'Supply Amount' : 'Borrow Amount'}</span>
                  <span className="text-gray-200 flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    {type === 'supply' 
                      ? `Balance: ${availableUSDCx.toFixed(6)} ${selectedAsset.symbol}`
                      : `Available: ${availableToBorrow.toFixed(6)} USDCx in protocol`
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => type === 'borrow' ? handleBorrowAmountChange(e.target.value) : setAmount(e.target.value)}
                    disabled={isLoading}
                    className="bg-transparent text-3xl font-bold mono text-white focus:outline-none flex-1"
                  />
                  {type === 'supply' && (
                    <button 
                      onClick={handleMaxClick}
                      disabled={isLoading}
                      className="text-xs font-bold text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-lg hover:bg-orange-500/20 disabled:opacity-50"
                    >
                      MAX
                    </button>
                  )}
                  {type === 'borrow' && maxBorrowFromContract > BigInt(0) && (
                    <button 
                      onClick={() => {
                        const maxBorrowUSDCx = Number(maxBorrowFromContract) / 1_000_000;
                        const actualMax = Math.min(maxBorrowUSDCx, availableToBorrow);
                        setAmount(actualMax.toFixed(6));
                      }}
                      disabled={isLoading || isCalculatingMax}
                      className="text-xs font-bold text-green-500 bg-green-500/10 px-3 py-1.5 rounded-lg hover:bg-green-500/20 disabled:opacity-50 flex items-center gap-1"
                    >
                      {isCalculatingMax ? '...' : 'MAX'}
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    ≈ ${(parseFloat(amount || '0') * USDCX_PRICE).toFixed(2)} USD
                  </span>
                  {type === 'borrow' && maxBorrowFromContract > BigInt(0) && (
                    <span className="text-green-400 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Max: {(Number(maxBorrowFromContract) / 1_000_000).toFixed(6)} USDCx
                    </span>
                  )}
                </div>
              </div>

              {/* Collateral Input (Borrow Only) */}
              {type === 'borrow' && (
                <div className="p-6 rounded-3xl bg-orange-500/5 border border-orange-500/20 space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-2">
                      STX Collateral Required
                      <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">150% ratio</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={collateralAmount}
                      onChange={(e) => handleCollateralChange(e.target.value)}
                      disabled={isLoading}
                      className="bg-transparent text-2xl font-bold mono text-white focus:outline-none flex-1"
                    />
                    <span className="text-gray-400 text-sm font-bold">STX</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    ≈ ${(parseFloat(collateralAmount || '0') * STX_PRICE).toFixed(2)} USD collateral value
                  </div>
                  {parseFloat(collateralAmount || '0') > 0 && parseFloat(amount || '0') > 0 && (
                    <div className="pt-2 border-t border-orange-500/20">
                      <div className="flex justify-between text-xs">
                        <span className="text-orange-400">Health Factor</span>
                        <span className="text-white font-bold">
                          {((parseFloat(collateralAmount) * STX_PRICE) / (parseFloat(amount) * USDCX_PRICE)).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        {parseFloat(collateralAmount) * STX_PRICE >= parseFloat(amount) * COLLATERAL_RATIO 
                          ? '✅ Sufficient collateral' 
                          : '⚠️ Insufficient collateral (need ' + (parseFloat(amount) * COLLATERAL_RATIO / STX_PRICE).toFixed(2) + ' STX)'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3 px-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Transaction Overview</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Interest Rate</span>
                    <span className="text-white font-bold">{type === 'supply' ? selectedAsset.supplyApy : selectedAsset.borrowApy}% APY</span>
                  </div>
                  {type === 'borrow' && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Collateral Ratio</span>
                        <span className="text-white font-bold">150%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Liquidation Threshold</span>
                        <span className="text-white font-bold">120%</span>
                      </div>
                    </>
                  )}
                  {type === 'supply' && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Utilization After</span>
                      <span className="text-white font-bold">{(selectedAsset.utilization + 1.2).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>

              {errorMessage && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{errorMessage}</p>
                </div>
              )}

              <button 
                onClick={handleExecute}
                disabled={
                  isLoading || 
                  !amount || 
                  parseFloat(amount) <= 0 ||
                  (type === 'borrow' && parseFloat(collateralAmount) * STX_PRICE < parseFloat(amount) * COLLATERAL_RATIO)
                }
                className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-lg shadow-xl shadow-orange-500/20 transition-all active:scale-[0.98]"
              >
                {isLoading ? 'Processing...' : `Execute ${type === 'supply' ? 'Supply' : 'Borrow'}`}
              </button>
              
              <div className="flex items-center gap-2 justify-center text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                <Info className="w-3 h-3" />
                Security audited by Stacks Labs
              </div>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Markets;
