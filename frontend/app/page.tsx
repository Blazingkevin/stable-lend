'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { View } from './types';
import Sidebar from '@/components/Sidebar';
import Dashboard from './views/Dashboard';
import Markets from './views/Markets';
import Stats from './views/Stats';
import LandingPage from './views/LandingPage';
import Header from '@/components/Header';
import RiskAssistant from '@/components/RiskAssistant';

// Lazy load Bridge component to avoid loading MetaMask code on landing page
const Bridge = lazy(() => import('./views/Bridge'));
import { userSession, connectWallet, disconnectWallet, getUserAddress } from '@/lib/stacks';
import {
  getLenderBalance,
  getLenderData,
  getBorrowerLoans,
  getLoanDetails,
  getProtocolStats,
  getCurrentAPY,
  getUSDCxWalletBalance,
  getSTXWalletBalance,
  getSTXPriceUSD,
  type LoanDetails,
  type ProtocolStats
} from '@/lib/contract-calls';
import { CONTRACTS, NETWORK } from '@/lib/constants';

// Inner component that uses useSearchParams
function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showApp = searchParams.get('app') === 'true';
  
  const [currentView, setCurrentView] = useState<View>(View.Dashboard);
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // User data
  const [walletBalance, setWalletBalance] = useState<bigint>(BigInt(0)); // USDCx in wallet
  const [stxWalletBalance, setStxWalletBalance] = useState<bigint>(BigInt(0)); // STX in wallet
  const [stxPrice, setStxPrice] = useState<bigint>(BigInt(0)); // STX price in USD (6 decimals)
  const [lenderBalance, setLenderBalance] = useState<bigint>(BigInt(0)); // USDCx supplied to protocol (now with real-time interest)
  const [lenderShares, setLenderShares] = useState<bigint>(BigInt(0)); // Shares for withdrawal
  const [currentAPY, setCurrentAPY] = useState<number>(8.0);
  const [loanIds, setLoanIds] = useState<number[]>([]);
  const [loans, setLoans] = useState<LoanDetails[]>([]);
  const [protocolStats, setProtocolStats] = useState<ProtocolStats>({
    totalDeposited: BigInt(0),
    totalBorrowed: BigInt(0),
    totalLoans: 0,
    utilizationRate: 0,
  });

  useEffect(() => {
    const checkConnection = async () => {
      const connected = userSession.isUserSignedIn();
      setIsConnected(connected);
      if (connected) {
        const address = getUserAddress();
        setUserAddress(address);

        // Fetch real data from deployed contract
        if (address) {
          await fetchUserData(address);
        }
      }
      setLoading(false);
    };

    checkConnection();
  }, []);

  // Fetch protocol stats on initial load (regardless of wallet connection)
  useEffect(() => {
    const fetchPublicStats = async () => {
      try {
        // Use contract address as dummy sender for read-only calls
        const dummyAddress = CONTRACTS[NETWORK].lendingPool.split('.')[0];
        
        const stats = await getProtocolStats(dummyAddress);
        setProtocolStats(stats);
        
        const apy = await getCurrentAPY(dummyAddress);
        setCurrentAPY(apy);
        
        const price = await getSTXPriceUSD(dummyAddress);
        setStxPrice(price);
      } catch (error) {
        console.error('Error fetching public stats:', error);
      }
    };

    fetchPublicStats();
    
    // Auto-refresh public stats every 30 seconds for non-connected users
    const intervalId = setInterval(fetchPublicStats, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Auto-refresh data every 30 seconds to show accruing interest
  useEffect(() => {
    if (!userAddress) return;
    
    const intervalId = setInterval(() => {
      fetchUserData(userAddress);
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [userAddress]);

  const fetchUserData = async (address: string) => {
    try {
      // Fetch USDCx wallet balance
      const walletBal = await getUSDCxWalletBalance(address);
      setWalletBalance(walletBal);
      
      // Fetch STX wallet balance
      const stxBal = await getSTXWalletBalance(address);
      setStxWalletBalance(stxBal);
      
      // Fetch STX price from oracle
      const price = await getSTXPriceUSD(address);
      setStxPrice(price);
      
      // Fetch lender data (balance and shares for withdrawal)
      const lenderData = await getLenderData(address);
      if (lenderData) {
        setLenderBalance(lenderData.balance);
        setLenderShares(lenderData.shares);
      } else {
        setLenderBalance(BigInt(0));
        setLenderShares(BigInt(0));
      }

      // Fetch borrower loans
      const borrowerLoanIds = await getBorrowerLoans(address);
      setLoanIds(borrowerLoanIds);

      if (borrowerLoanIds.length > 0) {
        const loanDetails = await Promise.all(
          borrowerLoanIds.map(id => getLoanDetails(id, address))
        );
        // Filter out null loans AND inactive loans (repaid loans)
        setLoans(loanDetails.filter(l => l !== null && l.isActive) as LoanDetails[]);
      } else {
        setLoans([]); // Clear loans if no IDs
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

  const renderView = () => {
    switch (currentView) {
      case View.Dashboard:
        return (
          <Dashboard 
            onAction={(v) => setCurrentView(v)}
            userAddress={userAddress}
            walletBalance={walletBalance}
            stxWalletBalance={stxWalletBalance}
            stxPrice={stxPrice}
            lenderBalance={lenderBalance}
            lenderShares={lenderShares}
            loans={loans}
            protocolStats={protocolStats}
            currentAPY={currentAPY}
            onRefresh={() => userAddress && fetchUserData(userAddress)}
          />
        );
      case View.Lend:
        return (
          <Markets
            type="supply"
            userAddress={userAddress}
            walletBalance={walletBalance}
            lenderBalance={lenderBalance}
            stxPrice={stxPrice}
            protocolStats={protocolStats}
            currentAPY={currentAPY}
            onRefresh={() => userAddress && fetchUserData(userAddress)}
          />
        );
      case View.Borrow:
        return (
          <Markets
            type="borrow"
            userAddress={userAddress}
            walletBalance={walletBalance}
            stxPrice={stxPrice}
            loans={loans}
            loanIds={loanIds}
            protocolStats={protocolStats}
            currentAPY={currentAPY}
            onRefresh={() => userAddress && fetchUserData(userAddress)}
          />
        );
      case View.Stats:
        return <Stats protocolStats={protocolStats} currentAPY={currentAPY} stxPrice={stxPrice} />;
      case View.Bridge:
        return (
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400">Loading Bridge...</p>
              </div>
            </div>
          }>
            <Bridge />
          </Suspense>
        );
      default:
        return (
          <Dashboard
            onAction={(v) => setCurrentView(v)}
            userAddress={userAddress}
            walletBalance={walletBalance}
            lenderBalance={lenderBalance}
            loans={loans}
            protocolStats={protocolStats}
            currentAPY={currentAPY}
          />
        );
    }
  };

  const handleEnterApp = () => {
    router.push('/?app=true');
  };

  return (
    <>
      {!showApp ? (
        // Landing Page View
        <div className="min-h-screen bg-[#020617] text-gray-100">
          <LandingPage onEnterApp={handleEnterApp} />
        </div>
      ) : (
        // Main App View
        <div className="flex min-h-screen bg-[#030712] text-gray-100 overflow-hidden">
          {/* Background Decor */}
          <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full z-0" />
          <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full z-0" />

          <Sidebar activeView={currentView} onNavigate={setCurrentView} />

          <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
            <Header isConnected={isConnected} onConnect={handleConnect} onDisconnect={handleDisconnect} userAddress={userAddress} />

            <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 lg:pb-8">
              <div className="max-w-7xl mx-auto space-y-8 pb-12">
                {renderView()}
              </div>
            </main>

            {/* Floating AI Risk Assistant */}
            <RiskAssistant />
          </div>
        </div>
      )}
    </>
  );
}

// Main export wrapped in Suspense for useSearchParams
export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="text-orange-500 text-xl">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
