'use client';

import { useState, useEffect } from 'react';
import { PROTOCOL } from '@/lib/constants';
import { userSession, connectWallet, disconnectWallet, getUserAddress } from '@/lib/stacks';
import { 
  getLenderBalance, 
  getBorrowerLoans, 
  getLoanDetails, 
  getProtocolStats,
  getCurrentAPY,
  calculateHealthFactor,
  depositUSDCx,
  withdrawUSDCx,
  borrowUSDCx,
  repayLoan,
  type LoanDetails,
  type ProtocolStats
} from '@/lib/contract-calls';
import { formatUSDCx, formatSTX, parseUSDCx, parseSTX } from '@/lib/constants';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'lend' | 'borrow'>('lend');
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Lender data
  const [lenderBalance, setLenderBalance] = useState<bigint>(BigInt(0));
  const [currentAPY, setCurrentAPY] = useState<number>(8.0);
  
  // Borrower data
  const [loanIds, setLoanIds] = useState<number[]>([]);
  const [loans, setLoans] = useState<LoanDetails[]>([]);
  
  // Protocol data
  const [protocolStats, setProtocolStats] = useState<ProtocolStats>({
    totalDeposited: BigInt(0),
    totalBorrowed: BigInt(0),
    totalLoans: 0,
    utilizationRate: 0,
  });
  
  // Form inputs
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  
  // Transaction state
  const [txPending, setTxPending] = useState(false);

  useEffect(() => {
    // Check wallet connection on mount
    const checkConnection = async () => {
      const connected = userSession.isUserSignedIn();
      setIsConnected(connected);
      if (connected) {
        const address = getUserAddress();
        setUserAddress(address);
        
        // Fetch user data if connected
        if (address) {
          await fetchUserData(address);
        }
      }
      setLoading(false);
    };
    
    checkConnection();
  }, []);
  
  // Fetch all user-specific data
  const fetchUserData = async (address: string) => {
    try {
      // Fetch lender balance
      const balance = await getLenderBalance(address);
      setLenderBalance(balance);
      
      // Fetch borrower loans
      const borrowerLoanIds = await getBorrowerLoans(address);
      setLoanIds(borrowerLoanIds);
      
      // Fetch details for each loan
      if (borrowerLoanIds.length > 0) {
        const loanDetails = await Promise.all(
          borrowerLoanIds.map(id => getLoanDetails(id, address))
        );
        setLoans(loanDetails.filter(l => l !== null) as LoanDetails[]);
      }
      
      // Fetch protocol stats
      const stats = await getProtocolStats(address);
      setProtocolStats(stats);
      
      // Fetch current APY
      const apy = await getCurrentAPY(address);
      setCurrentAPY(apy);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleConnect = () => {
    connectWallet();
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  // Handle deposit
  const handleDeposit = async () => {
    if (!userAddress || !depositAmount || parseFloat(depositAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    setTxPending(true);
    try {
      const amount = parseUSDCx(depositAmount);
      await depositUSDCx(amount, userAddress, {
        onFinish: (data) => {
          console.log('Deposit successful:', data);
          setDepositAmount('');
          setTxPending(false);
          // Refresh data after a few seconds to allow transaction to confirm
          setTimeout(() => {
            if (userAddress) fetchUserData(userAddress);
          }, 3000);
          alert(`Deposit transaction submitted! TxID: ${data.txId}`);
        },
        onCancel: () => {
          setTxPending(false);
        },
      });
    } catch (error) {
      console.error('Deposit error:', error);
      setTxPending(false);
      alert('Deposit failed. Please try again.');
    }
  };
  
  // Handle withdraw
  const handleWithdraw = async () => {
    if (!userAddress || !withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    const amount = parseUSDCx(withdrawAmount);
    if (amount > lenderBalance) {
      alert('Insufficient balance');
      return;
    }
    
    setTxPending(true);
    try {
      await withdrawUSDCx(amount, userAddress, {
        onFinish: (data) => {
          console.log('Withdraw successful:', data);
          setWithdrawAmount('');
          setTxPending(false);
          setTimeout(() => {
            if (userAddress) fetchUserData(userAddress);
          }, 3000);
          alert(`Withdrawal transaction submitted! TxID: ${data.txId}`);
        },
        onCancel: () => {
          setTxPending(false);
        },
      });
    } catch (error) {
      console.error('Withdraw error:', error);
      setTxPending(false);
      alert('Withdrawal failed. Please try again.');
    }
  };
  
  // Handle borrow
  const handleBorrow = async () => {
    if (!userAddress || !collateralAmount || !borrowAmount) {
      alert('Please enter valid amounts');
      return;
    }
    
    setTxPending(true);
    try {
      const collateral = parseSTX(collateralAmount);
      const borrow = parseUSDCx(borrowAmount);
      
      await borrowUSDCx(borrow, collateral, userAddress, {
        onFinish: (data) => {
          console.log('Borrow successful:', data);
          setCollateralAmount('');
          setBorrowAmount('');
          setTxPending(false);
          setTimeout(() => {
            if (userAddress) fetchUserData(userAddress);
          }, 3000);
          alert(`Borrow transaction submitted! TxID: ${data.txId}`);
        },
        onCancel: () => {
          setTxPending(false);
        },
      });
    } catch (error) {
      console.error('Borrow error:', error);
      setTxPending(false);
      alert('Borrow failed. Please try again.');
    }
  };
  
  // Handle repay
  const handleRepay = async (loanId: number) => {
    if (!userAddress) return;
    
    setTxPending(true);
    try {
      await repayLoan(loanId, userAddress, {
        onFinish: (data) => {
          console.log('Repay successful:', data);
          setTxPending(false);
          setTimeout(() => {
            if (userAddress) fetchUserData(userAddress);
          }, 3000);
          alert(`Repayment transaction submitted! TxID: ${data.txId}`);
        },
        onCancel: () => {
          setTxPending(false);
        },
      });
    } catch (error) {
      console.error('Repay error:', error);
      setTxPending(false);
      alert('Repayment failed. Please try again.');
    }
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
            <p className="text-sm text-gray-600 mb-1">Total Value Locked</p>
            <p className="text-3xl font-bold text-blue-600">
              {loading ? '...' : formatUSDCx(protocolStats.totalDeposited)}
            </p>
            <p className="text-xs text-gray-500 mt-1">USDCx Deposited</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 mb-1">Total Borrowed</p>
            <p className="text-3xl font-bold text-purple-600">
              {loading ? '...' : formatUSDCx(protocolStats.totalBorrowed)}
            </p>
            <p className="text-xs text-gray-500 mt-1">USDCx Borrowed</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 mb-1">Utilization Rate</p>
            <p className="text-3xl font-bold text-orange-600">
              {loading ? '...' : `${protocolStats.utilizationRate.toFixed(1)}%`}
            </p>
            <p className="text-xs text-gray-500 mt-1">Active Loans: {protocolStats.totalLoans}</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 mb-1">Lender APY</p>
            <p className="text-3xl font-bold text-green-600">
              {loading ? '...' : `${currentAPY.toFixed(1)}%`}
            </p>
            <p className="text-xs text-gray-500 mt-1">Current Rate</p>
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            disabled={txPending}
                          />
                        </div>
                        
                        <button 
                          onClick={handleDeposit}
                          disabled={txPending || !depositAmount || parseFloat(depositAmount) <= 0}
                          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {txPending ? 'Processing...' : 'Deposit USDCx'}
                        </button>
                        
                        {lenderBalance > BigInt(0) && (
                          <button 
                            onClick={handleWithdraw}
                            disabled={txPending}
                            className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            {txPending ? 'Processing...' : 'Withdraw All'}
                          </button>
                        )}
                      </div>

                      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-900 font-medium">Your Lending Position</p>
                        {loading ? (
                          <div className="mt-2 text-sm text-blue-700">Loading...</div>
                        ) : (
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-700">Total Balance:</span>
                              <span className="text-blue-900 font-medium">{formatUSDCx(lenderBalance)} USDCx</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-700">Current APY:</span>
                              <span className="text-blue-900 font-medium">{currentAPY.toFixed(2)}%</span>
                            </div>
                          </div>
                        )}
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
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                            value={collateralAmount}
                            onChange={(e) => setCollateralAmount(e.target.value)}
                            disabled={txPending}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Borrow Amount (USDCx)</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                            value={borrowAmount}
                            onChange={(e) => setBorrowAmount(e.target.value)}
                            disabled={txPending}
                          />
                          <p className="text-xs text-gray-500 mt-1">Max borrowable based on collateral value</p>
                        </div>
                        
                        <button 
                          onClick={handleBorrow}
                          disabled={txPending || !collateralAmount || !borrowAmount}
                          className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {txPending ? 'Processing...' : 'Borrow USDCx'}
                        </button>
                      </div>

                      <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm text-purple-900 font-medium mb-3">Your Loans</p>
                        {loading ? (
                          <p className="text-sm text-purple-700">Loading...</p>
                        ) : loans.length === 0 ? (
                          <p className="text-sm text-purple-700">No active loans</p>
                        ) : (
                          <div className="space-y-3">
                            {loans.map((loan, index) => {
                              const loanId = loanIds[index];
                              const healthFactor = calculateHealthFactor(loan);
                              const totalOwed = loan.borrowedAmount + loan.accruedInterest;
                              const healthColor = healthFactor > 1.5 ? 'text-green-600' : 
                                                 healthFactor > 1.2 ? 'text-yellow-600' : 
                                                 'text-red-600';
                              
                              return (
                                <div key={loanId} className="p-3 bg-white rounded-lg border border-purple-200">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-sm font-medium text-purple-900">Loan #{loanId}</span>
                                    <span className={`text-xs font-semibold ${healthColor}`}>
                                      Health: {healthFactor.toFixed(2)}x
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Collateral:</span>
                                      <span className="text-gray-900">{formatSTX(loan.collateralAmount)} STX</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Borrowed:</span>
                                      <span className="text-gray-900">{formatUSDCx(loan.borrowedAmount)} USDCx</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Interest:</span>
                                      <span className="text-gray-900">{formatUSDCx(loan.accruedInterest)} USDCx</span>
                                    </div>
                                    <div className="flex justify-between font-medium">
                                      <span className="text-gray-600">Total Owed:</span>
                                      <span className="text-purple-900">{formatUSDCx(totalOwed)} USDCx</span>
                                    </div>
                                  </div>
                                  {healthFactor < 1.3 && (
                                    <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                                      ⚠️ Warning: Low health factor. Add collateral or repay to avoid liquidation.
                                    </div>
                                  )}
                                  <button
                                    onClick={() => handleRepay(loanId)}
                                    disabled={txPending}
                                    className="mt-3 w-full px-3 py-2 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                  >
                                    {txPending ? 'Processing...' : 'Repay Loan'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
