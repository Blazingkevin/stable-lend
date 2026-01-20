'use client';

import { useState, useEffect } from 'react';
import { View } from './types';
import Sidebar from '@/components/Sidebar';
import Dashboard from './views/Dashboard';
import Markets from './views/Markets';
import Stats from './views/Stats';
import Bridge from './views/Bridge';
import Header from '@/components/Header';
import RiskAssistant from '@/components/RiskAssistant';
import { userSession, connectWallet, getUserAddress } from '@/lib/stacks';
import {
  getLenderBalance,
  getBorrowerLoans,
  getLoanDetails,
  getProtocolStats,
  getCurrentAPY,
  type LoanDetails,
  type ProtocolStats
} from '@/lib/contract-calls';

export default function Home() {
  const [currentView, setCurrentView] = useState<View>(View.Dashboard);
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // User data
  const [lenderBalance, setLenderBalance] = useState<bigint>(BigInt(0));
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

        // TODO: Uncomment after deploying contracts to testnet
        // if (address) {
        //   await fetchUserData(address);
        // }
      }
      setLoading(false);
    };

    checkConnection();
  }, []);

  const fetchUserData = async (address: string) => {
    // TODO: Enable this after contracts are deployed to testnet
    console.log('fetchUserData called for address:', address);
    console.log('Skipping data fetch until contracts are deployed');
    return;
    
    /* Uncomment after deployment:
    try {
      const balance = await getLenderBalance(address);
      setLenderBalance(balance);

      const borrowerLoanIds = await getBorrowerLoans(address);
      setLoanIds(borrowerLoanIds);

      if (borrowerLoanIds.length > 0) {
        const loanDetails = await Promise.all(
          borrowerLoanIds.map(id => getLoanDetails(id, address))
        );
        setLoans(loanDetails.filter(l => l !== null) as LoanDetails[]);
      }

      const stats = await getProtocolStats(address);
      setProtocolStats(stats);

      const apy = await getCurrentAPY(address);
      setCurrentAPY(apy);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
    */
  };

  const handleConnect = () => {
    connectWallet();
  };

  const renderView = () => {
    switch (currentView) {
      case View.Dashboard:
        return <Dashboard onAction={(v) => setCurrentView(v)} />;
      case View.Lend:
        return (
          <Markets
            type="supply"
            userAddress={userAddress}
            lenderBalance={lenderBalance}
            onRefresh={() => userAddress && fetchUserData(userAddress)}
          />
        );
      case View.Borrow:
        return (
          <Markets
            type="borrow"
            userAddress={userAddress}
            loans={loans}
            loanIds={loanIds}
            onRefresh={() => userAddress && fetchUserData(userAddress)}
          />
        );
      case View.Stats:
        return <Stats protocolStats={protocolStats} currentAPY={currentAPY} />;
      case View.Bridge:
        return <Bridge />;
      default:
        return <Dashboard onAction={(v) => setCurrentView(v)} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#030712] text-gray-100 overflow-hidden">
      {/* Background Decor */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full z-0" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full z-0" />

      <Sidebar activeView={currentView} onNavigate={setCurrentView} />

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        <Header isConnected={isConnected} onConnect={handleConnect} userAddress={userAddress} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-8 pb-12">
            {renderView()}
          </div>
        </main>

        {/* Floating AI Risk Assistant */}
        <RiskAssistant />
      </div>
    </div>
  );
}
