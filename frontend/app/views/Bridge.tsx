
import React, { useState, useEffect } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUpDown, Info, Loader2, CheckCircle2, ExternalLink, Wallet, AlertCircle, Clock } from 'lucide-react';
import { userSession } from '@/lib/stacks';
import {
  connectEthereumWallet,
  getUSDCBalance,
  getETHBalance,
  depositToStacks,
  BRIDGE_CONFIG,
  padEthAddressTo32Bytes,
  STACKS_USDCX_CONFIG,
  type BridgeClients,
} from '@/lib/bridge';
import { getUSDCxWalletBalance } from '@/lib/contract-calls';
import { openContractCall } from '@stacks/connect';
import { Cl, Pc, PostConditionMode } from '@stacks/transactions';
import { STACKS_TESTNET } from '@stacks/network';

// Bridge direction
type BridgeDirection = 'deposit' | 'withdraw';

// Bridge transaction status
type BridgeStatus = 'pending' | 'confirmed' | 'attesting' | 'minting' | 'completed' | 'failed';

interface BridgeTransaction {
  id: string;
  amount: string;
  status: BridgeStatus;
  ethTxHash?: string;
  stacksTxHash?: string;
  timestamp: number;
  fromAddress: string;
  toAddress: string;
  direction: BridgeDirection;
}

const Bridge: React.FC = () => {
  // Get Stacks address from wallet
  const userData = userSession.loadUserData();
  const stacksAddress = userData?.profile?.stxAddress?.testnet || '';
  
  const [isBridging, setIsBridging] = useState(false);
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  
  // Bridge direction state
  const [direction, setDirection] = useState<BridgeDirection>('deposit');
  
  // Ethereum wallet state
  const [ethClients, setEthClients] = useState<BridgeClients | null>(null);
  const [ethAddress, setEthAddress] = useState<string>('');
  const [usdcBalance, setUsdcBalance] = useState<string>('0.00');
  const [ethBalance, setEthBalance] = useState<string>('0.00');
  const [txHash, setTxHash] = useState<string>('');
  
  // Stacks USDCx balance
  const [usdcxBalance, setUsdcxBalance] = useState<string>('0.00');

  // Bridge transactions history
  const [bridgeTransactions, setBridgeTransactions] = useState<BridgeTransaction[]>([]);
  const [initialUSDCxBalance, setInitialUSDCxBalance] = useState<bigint | null>(null);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);

  // Load bridge history from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && ethAddress) {
      const storageKey = `bridgeTransactions_${ethAddress}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setBridgeTransactions(parsed);
          updatePendingTransactions(parsed);
        } catch (e) {
          console.error('Failed to load bridge history:', e);
        }
      } else {
        setBridgeTransactions([]);
      }
    }
  }, [ethAddress]);

  // Auto-check pending transactions every 10 seconds
  useEffect(() => {
    const hasPendingTxs = bridgeTransactions.some(tx => 
      tx.status === 'minting' || tx.status === 'attesting'
    );

    if (!hasPendingTxs || !stacksAddress) return;

    // Initial check
    checkPendingTransactionsBalance();

    // Set up polling
    const interval = setInterval(() => {
      checkPendingTransactionsBalance();
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [bridgeTransactions, stacksAddress]);

  // Save bridge history to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && bridgeTransactions.length > 0 && ethAddress) {
      const storageKey = `bridgeTransactions_${ethAddress}`;
      localStorage.setItem(storageKey, JSON.stringify(bridgeTransactions));
    }
  }, [bridgeTransactions, ethAddress]);

  // Update pending transactions status
  const updatePendingTransactions = async (transactions: BridgeTransaction[]) => {
    const pendingTxs = transactions.filter(tx => 
      tx.status === 'pending' || tx.status === 'confirmed' || tx.status === 'attesting' || tx.status === 'minting'
    );

    for (const tx of pendingTxs) {
      // Check how long ago the transaction was started
      const minutesElapsed = (Date.now() - tx.timestamp) / 1000 / 60;
      
      // Only progress through stages based on time, never auto-complete
      // Completion should only happen when we verify the USDCx balance increase
      if (minutesElapsed > 3 && tx.status === 'confirmed') {
        // After 3 minutes of being confirmed, move to attesting
        updateTransactionStatus(tx.id, 'attesting');
      } else if (minutesElapsed > 5 && tx.status === 'attesting') {
        // After 5 minutes total, move to minting
        updateTransactionStatus(tx.id, 'minting');
      }
      // Note: We never auto-complete. Minting stays in "minting" until user manually
      // verifies or we implement balance checking
    }
  };

  // Check if pending transactions have been received by polling USDCx balance
  const checkPendingTransactionsBalance = async () => {
    if (!stacksAddress || isCheckingBalance) return;

    // Get all minting/attesting transactions sorted by timestamp (oldest first)
    const mintingTxs = bridgeTransactions
      .filter(tx => tx.status === 'minting' || tx.status === 'attesting')
      .sort((a, b) => a.timestamp - b.timestamp); // Oldest first

    if (mintingTxs.length === 0) return;

    try {
      setIsCheckingBalance(true);
      
      const currentBalance = await getUSDCxWalletBalance(stacksAddress);

      if (initialUSDCxBalance === null) {
        setInitialUSDCxBalance(currentBalance);
        return;
      }

      const balanceIncrease = currentBalance - initialUSDCxBalance;
      
      if (balanceIncrease > BigInt(0)) {
        const increaseInUSDCx = Number(balanceIncrease) / 1_000_000;
        
        let cumulativeExpected = 0;
        const txsToComplete: BridgeTransaction[] = [];
        
        for (const tx of mintingTxs) {
          const txAmount = parseFloat(tx.amount);
          cumulativeExpected += txAmount;
          txsToComplete.push(tx);
          
          const difference = Math.abs(increaseInUSDCx - cumulativeExpected);
          
          if (difference < 0.01) {
            for (const completedTx of txsToComplete) {
              // Mark as completed - no fake tx hash since mint was done by attestation service
              updateTransactionStatus(completedTx.id, 'completed');
            }
            
            setInitialUSDCxBalance(currentBalance);
            break;
          }
        }
        
        if (txsToComplete.length === 0 && increaseInUSDCx >= parseFloat(mintingTxs[0].amount) * 0.95) {
          // Mark as completed - no fake tx hash since mint was done by attestation service
          updateTransactionStatus(mintingTxs[0].id, 'completed');
          setInitialUSDCxBalance(currentBalance);
        }
      }
    } catch (error) {
      console.error('Error checking bridge balance:', error);
    } finally {
      setIsCheckingBalance(false);
    }
  };

  // Update transaction status
  const updateTransactionStatus = (txId: string, newStatus: BridgeStatus, stacksTxHash?: string) => {
    setBridgeTransactions(prev => 
      prev.map(tx => 
        tx.id === txId 
          ? { ...tx, status: newStatus, ...(stacksTxHash && { stacksTxHash }) }
          : tx
      )
    );
  };

  // Add new bridge transaction
  const addBridgeTransaction = (amount: string, txHash: string, fromAddress: string, toAddress: string, direction: BridgeDirection) => {
    const newTx: BridgeTransaction = {
      id: txHash,
      amount,
      status: 'pending',
      ethTxHash: direction === 'deposit' ? txHash : undefined,
      stacksTxHash: direction === 'withdraw' ? txHash : undefined,
      timestamp: Date.now(),
      fromAddress,
      toAddress,
      direction,
    };
    setBridgeTransactions(prev => [newTx, ...prev].slice(0, 20)); // Keep last 20
  };

  // Connect Ethereum wallet
  const handleConnectEthereum = async () => {
    try {
      setError('');
      const clients = await connectEthereumWallet();
      setEthClients(clients);
      setEthAddress(clients.address);
      
      // Fetch balances
      const usdc = await getUSDCBalance(clients.publicClient, clients.address);
      const eth = await getETHBalance(clients.publicClient, clients.address);
      setUsdcBalance(usdc.formatted);
      setEthBalance(eth.formatted);
    } catch (err: any) {
      setError(err.message || 'Failed to connect Ethereum wallet');
    }
  };

  // Refresh all balances (Ethereum + Stacks)
  const refreshBalances = async () => {
    // Refresh Ethereum balances
    if (ethClients) {
      try {
        const usdc = await getUSDCBalance(ethClients.publicClient, ethClients.address);
        const eth = await getETHBalance(ethClients.publicClient, ethClients.address);
        setUsdcBalance(usdc.formatted);
        setEthBalance(eth.formatted);
      } catch (err) {
        console.error('Failed to refresh Ethereum balances:', err);
      }
    }
    
    // Refresh Stacks USDCx balance
    if (stacksAddress) {
      try {
        const balance = await getUSDCxWalletBalance(stacksAddress);
        setUsdcxBalance((Number(balance) / 1_000_000).toFixed(2));
      } catch (err) {
        console.error('Failed to refresh USDCx balance:', err);
      }
    }
  };

  // Fetch USDCx balance when Stacks address changes
  useEffect(() => {
    if (stacksAddress) {
      getUSDCxWalletBalance(stacksAddress)
        .then(balance => setUsdcxBalance((Number(balance) / 1_000_000).toFixed(2)))
        .catch(err => console.error('Failed to fetch USDCx balance:', err));
    }
  }, [stacksAddress]);

  // Handle deposit (Ethereum -> Stacks)
  const handleDeposit = async () => {
    if (!amount || !ethClients || !stacksAddress) {
      setError('Please connect both wallets and enter an amount');
      return;
    }

    const amountNum = parseFloat(amount);
    if (amountNum < parseFloat(BRIDGE_CONFIG.MIN_DEPOSIT)) {
      setError(`Minimum deposit is ${BRIDGE_CONFIG.MIN_DEPOSIT} USDC`);
      return;
    }

    if (amountNum > parseFloat(usdcBalance)) {
      setError('Insufficient USDC balance');
      return;
    }

    try {
      setIsBridging(true);
      setError('');
      setSuccess(false);
      setStep(1);

      // Capture current USDCx balance before bridging
      try {
        const currentBalance = await getUSDCxWalletBalance(stacksAddress);
        setInitialUSDCxBalance(currentBalance);
      } catch {
        // Will detect balance on next check
      }

      const result = await depositToStacks(
        ethClients.walletClient,
        ethClients.publicClient,
        amount,
        stacksAddress
      );

      setTxHash(result.depositHash);
      
      addBridgeTransaction(amount, result.depositHash, ethClients.address, stacksAddress, 'deposit');
      updateTransactionStatus(result.depositHash, 'confirmed');
      
      setStep(2);

      await new Promise(resolve => setTimeout(resolve, 3000));
      updateTransactionStatus(result.depositHash, 'attesting');
      setStep(3);

      await new Promise(resolve => setTimeout(resolve, 3000));
      updateTransactionStatus(result.depositHash, 'minting');
      setStep(4);
      
      setIsBridging(false);
      setSuccess(true);
      
      // Refresh balances
      await refreshBalances();
    } catch (err: any) {
      console.error('Bridge error:', err);
      setError(err.message || 'Bridge transaction failed');
      setIsBridging(false);
      
      // Mark transaction as failed if we have a tx hash
      if (txHash) {
        updateTransactionStatus(txHash, 'failed');
      }
    }
  };

  // Handle withdrawal (Stacks -> Ethereum)
  const handleWithdraw = async () => {
    if (!amount || !ethAddress || !stacksAddress) {
      setError('Please connect both wallets and enter an amount');
      return;
    }

    const amountNum = parseFloat(amount);
    if (amountNum < parseFloat(BRIDGE_CONFIG.MIN_WITHDRAWAL)) {
      setError(`Minimum withdrawal is ${BRIDGE_CONFIG.MIN_WITHDRAWAL} USDCx (includes $4.80 fee)`);
      return;
    }

    if (amountNum > parseFloat(usdcxBalance)) {
      setError('Insufficient USDCx balance');
      return;
    }

    try {
      setIsBridging(true);
      setError('');
      setSuccess(false);
      setStep(1);

      // Amount in micro USDCx (6 decimals)
      const microAmount = Math.floor(amountNum * 1_000_000);

      // Pad Ethereum address to 32 bytes
      const paddedEthAddress = padEthAddressTo32Bytes(ethAddress);

      // Create post condition to ensure we send exactly the amount
      const postCondition = Pc.principal(stacksAddress)
        .willSendEq(microAmount)
        .ft(
          `${STACKS_USDCX_CONFIG.CONTRACT_ADDRESS}.usdcx`,
          STACKS_USDCX_CONFIG.TOKEN_NAME
        );

      // Generate a temporary ID for the transaction
      const tempTxId = `withdraw-${Date.now()}`;

      await openContractCall({
        contractAddress: STACKS_USDCX_CONFIG.CONTRACT_ADDRESS,
        contractName: STACKS_USDCX_CONFIG.CONTRACT_NAME,
        functionName: 'burn',
        functionArgs: [
          Cl.uint(microAmount),
          Cl.uint(BRIDGE_CONFIG.ETHEREUM_DOMAIN),
          Cl.bufferFromHex(paddedEthAddress.slice(2)), // Remove 0x prefix
        ],
        postConditions: [postCondition],
        postConditionMode: PostConditionMode.Deny,
        network: STACKS_TESTNET,
        onFinish: (data) => {
          console.log('Withdrawal transaction submitted:', data);
          const stacksTxId = data.txId;
          setTxHash(stacksTxId);
          
          // Update the temporary transaction with real tx hash
          setBridgeTransactions(prev => 
            prev.map(tx => 
              tx.id === tempTxId 
                ? { ...tx, id: stacksTxId, stacksTxHash: stacksTxId, status: 'confirmed' as BridgeStatus }
                : tx
            )
          );
          
          setStep(2);
          
          // Progress through stages
          setTimeout(() => {
            updateTransactionStatus(stacksTxId, 'attesting');
            setStep(3);
          }, 3000);
          
          setTimeout(() => {
            updateTransactionStatus(stacksTxId, 'minting');
            setStep(4);
            setIsBridging(false);
            setSuccess(true);
          }, 6000);
        },
        onCancel: () => {
          setError('Transaction was cancelled');
          setIsBridging(false);
          // Remove the pending transaction
          setBridgeTransactions(prev => prev.filter(tx => tx.id !== tempTxId));
        },
      });

      // Add pending transaction immediately
      addBridgeTransaction(amount, tempTxId, stacksAddress, ethAddress, 'withdraw');

    } catch (err: any) {
      console.error('Withdrawal error:', err);
      setError(err.message || 'Withdrawal transaction failed');
      setIsBridging(false);
    }
  };

  // Main bridge handler that routes to deposit or withdraw
  const handleBridge = async () => {
    if (direction === 'deposit') {
      await handleDeposit();
    } else {
      await handleWithdraw();
    }
  };

  // Toggle bridge direction
  const toggleDirection = () => {
    setDirection(prev => prev === 'deposit' ? 'withdraw' : 'deposit');
    setAmount('');
    setError('');
  };

  // Get status display info
  const getStatusInfo = (status: BridgeStatus) => {
    switch (status) {
      case 'pending':
        return { text: 'Pending', color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: Clock };
      case 'confirmed':
        return { text: 'Confirmed', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: CheckCircle2 };
      case 'attesting':
        return { text: 'Attesting', color: 'text-purple-500', bg: 'bg-purple-500/10', icon: Loader2 };
      case 'minting':
        return { text: 'Minting', color: 'text-orange-500', bg: 'bg-orange-500/10', icon: Loader2 };
      case 'completed':
        return { text: 'Completed', color: 'text-green-500', bg: 'bg-green-500/10', icon: CheckCircle2 };
      case 'failed':
        return { text: 'Failed', color: 'text-red-500', bg: 'bg-red-500/10', icon: AlertCircle };
    }
  };

  // Format time ago
  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-white">Universal Bridge</h1>
        <p className="text-gray-400">
          {direction === 'deposit' 
            ? 'Move your USDC from Ethereum to Stacks USDCx via Circle xReserve.'
            : 'Withdraw your USDCx from Stacks back to USDC on Ethereum.'}
        </p>
      </div>

      {/* Direction Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-2xl bg-white/5 border border-white/10 p-1">
          <button
            onClick={() => { setDirection('deposit'); setAmount(''); setError(''); }}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              direction === 'deposit'
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Deposit (ETH → STX)
          </button>
          <button
            onClick={() => { setDirection('withdraw'); setAmount(''); setError(''); }}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
              direction === 'withdraw'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Withdraw (STX → ETH)
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="glass-card p-4 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-red-500 text-sm">Bridge Error</div>
            <div className="text-red-400 text-xs mt-1">{error}</div>
          </div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-400">×</button>
        </div>
      )}

      {/* Wallet Connection Alert */}
      {(!stacksAddress || !ethAddress) && (
        <div className="glass-card p-6 rounded-2xl border border-orange-500/20 bg-orange-500/5">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-3 flex-1">
              <div>
                <div className="font-bold text-orange-500 text-sm">Connect Your Wallets</div>
                <div className="text-orange-400/70 text-xs mt-1">You need both Stacks and Ethereum wallets connected to bridge assets.</div>
              </div>
              <div className="flex gap-3">
                {!stacksAddress && (
                  <div className="text-xs text-gray-400 px-3 py-2 rounded-lg bg-white/5">
                    ❌ Stacks Wallet (Xverse) - Connect in header
                  </div>
                )}
                {!ethAddress ? (
                  <button
                    onClick={handleConnectEthereum}
                    className="text-xs font-bold px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-all"
                  >
                    Connect MetaMask
                  </button>
                ) : (
                  <div className="text-xs text-green-400 px-3 py-2 rounded-lg bg-green-500/10">
                    ✓ Ethereum: {ethAddress.slice(0, 6)}...{ethAddress.slice(-4)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Bridge Interface */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-card p-8 rounded-[40px] border border-white/10 relative overflow-hidden">
            {isBridging && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="relative">
                  <Loader2 className={`w-16 h-16 ${direction === 'deposit' ? 'text-orange-500' : 'text-purple-500'} animate-spin`} />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mono">
                    {step * 25}%
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">
                    {direction === 'deposit' ? (
                      <>
                        {step === 1 && "Confirming Ethereum Transaction..."}
                        {step === 2 && "Waiting for Attestation Service..."}
                        {step === 3 && "Minting USDCx on Stacks..."}
                      </>
                    ) : (
                      <>
                        {step === 1 && "Confirming Stacks Transaction..."}
                        {step === 2 && "Burning USDCx on Stacks..."}
                        {step === 3 && "Waiting for xReserve Verification..."}
                        {step === 4 && "Releasing USDC on Ethereum..."}
                      </>
                    )}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {direction === 'deposit' ? (
                      <>
                        {step === 1 && "Approve and deposit USDC to xReserve on Sepolia"}
                        {step === 2 && "Circle attestation service processing your deposit"}
                        {step === 3 && "USDCx tokens being minted to your Stacks address"}
                      </>
                    ) : (
                      <>
                        {step === 1 && "Calling burn function on USDCx contract"}
                        {step === 2 && "Your USDCx is being burned on Stacks"}
                        {step === 3 && "xReserve verifying burn attestation"}
                        {step === 4 && "USDC being released to your Ethereum address"}
                      </>
                    )}
                  </p>
                  {txHash && (
                    <a
                      href={direction === 'deposit' 
                        ? `https://sepolia.etherscan.io/tx/${txHash}`
                        : `https://explorer.stacks.co/txid/${txHash}?chain=testnet`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-xs ${direction === 'deposit' ? 'text-orange-500 hover:text-orange-400' : 'text-purple-500 hover:text-purple-400'} flex items-center justify-center gap-1 mt-2`}
                    >
                      View on {direction === 'deposit' ? 'Etherscan' : 'Stacks Explorer'} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="w-full max-w-xs h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full ${direction === 'deposit' ? 'bg-orange-500' : 'bg-purple-500'} transition-all duration-1000`} style={{ width: `${step * 33}%` }} />
                </div>
              </div>
            )}

            {success && !isBridging && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">
                    {direction === 'deposit' ? 'Bridge Transaction Submitted!' : 'Withdrawal Submitted!'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {direction === 'deposit' 
                      ? `${amount} USDCx will be credited to your Stacks wallet in ~2-5 minutes.`
                      : `${(parseFloat(amount) - 4.80).toFixed(2)} USDC will be credited to your Ethereum wallet in ~25-60 minutes.`
                    }
                  </p>
                  <div className={`mt-3 p-3 rounded-xl ${direction === 'deposit' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-purple-500/10 border-purple-500/20'} border`}>
                    <p className={`text-xs ${direction === 'deposit' ? 'text-orange-300' : 'text-purple-300'} font-medium mb-1`}>
                      ⏱️ {direction === 'deposit' ? 'Waiting for Circle Attestation' : 'Processing Withdrawal'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {direction === 'deposit'
                        ? 'Your transaction is being processed. Check your wallet balance in a few minutes to confirm receipt.'
                        : 'Your USDCx is being burned on Stacks. USDC will be released to your Ethereum wallet after verification.'
                      }
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Track progress in your bridge history below.</p>
                </div>
                
                {/* Transaction Links */}
                {txHash && (
                  <div className="flex flex-col gap-2 w-full max-w-sm">
                    <a
                      href={direction === 'deposit' 
                        ? `https://sepolia.etherscan.io/tx/${txHash}`
                        : `https://explorer.stacks.co/txid/${txHash}?chain=testnet`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all border border-white/10"
                    >
                      {direction === 'deposit' 
                        ? <img src="https://etherscan.io/images/brandassets/etherscan-logo-circle.png" className="w-4 h-4" alt="Etherscan" />
                        : <img src="https://cryptologos.cc/logos/stacks-stx-logo.png" className="w-4 h-4" alt="Stacks" />
                      }
                      View on {direction === 'deposit' ? 'Sepolia Explorer' : 'Stacks Explorer'}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 text-gray-500 text-xs border border-white/5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>
                        {direction === 'deposit' 
                          ? 'Waiting for Circle attestation to complete...'
                          : 'Waiting for xReserve to process withdrawal...'
                        }
                      </span>
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={() => {setSuccess(false); setAmount(''); setTxHash(''); setStep(1); refreshBalances();}}
                  className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold transition-all"
                >
                  Close
                </button>
              </div>
            )}

            <div className="space-y-6">
              {/* From Section - Dynamic based on direction */}
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest px-2">
                  <span>From {direction === 'deposit' ? 'Ethereum Sepolia' : 'Stacks Testnet'}</span>
                  <span className="flex items-center gap-1">
                    <Wallet className="w-3 h-3"/> 
                    {direction === 'deposit' 
                      ? (ethAddress ? `${usdcBalance} USDC` : 'Not Connected')
                      : (stacksAddress ? `${usdcxBalance} USDCx` : 'Not Connected')
                    }
                  </span>
                </div>
                <div className={`p-6 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between group focus-within:border-${direction === 'deposit' ? 'orange' : 'purple'}-500/50 transition-all`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full ${direction === 'deposit' ? 'bg-white/10' : 'bg-purple-500/20'} p-2 border ${direction === 'deposit' ? 'border-white/5' : 'border-purple-500/30'}`}>
                      <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" className="w-full h-full object-contain" alt={direction === 'deposit' ? 'USDC' : 'USDCx'} />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white flex items-center gap-2">
                        {direction === 'deposit' ? 'USDC' : 'USDCx'}
                        {direction === 'withdraw' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500 text-white font-bold">L2</span>}
                      </div>
                      <div className="text-xs text-gray-500">{direction === 'deposit' ? 'Ethereum Sepolia Testnet' : 'Stacks Bitcoin L2'}</div>
                    </div>
                  </div>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={direction === 'deposit' ? (!ethAddress || !stacksAddress) : !stacksAddress}
                    className="bg-transparent text-right text-3xl font-bold mono text-white focus:outline-none w-1/2 disabled:opacity-50"
                  />
                </div>
                {direction === 'deposit' && ethAddress && parseFloat(ethBalance) < 0.01 && (
                  <div className="text-xs text-orange-500 px-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Low ETH balance ({ethBalance} ETH) - you need ETH for gas fees
                  </div>
                )}
              </div>

              {/* Swap Icon with toggle functionality */}
              <div className="flex justify-center -my-4 relative z-10">
                <button 
                  onClick={toggleDirection}
                  className={`w-10 h-10 ${direction === 'deposit' ? 'bg-orange-500 shadow-orange-500/20' : 'bg-purple-500 shadow-purple-500/20'} rounded-full flex items-center justify-center shadow-lg border-4 border-[#030712] hover:scale-110 transition-all cursor-pointer`}
                >
                  <ArrowUpDown className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* To Section - Dynamic based on direction */}
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest px-2">
                  <span>To {direction === 'deposit' ? 'Stacks Testnet' : 'Ethereum Sepolia'}</span>
                  <span className="flex items-center gap-1">
                    <Wallet className="w-3 h-3"/> 
                    {direction === 'deposit' 
                      ? (stacksAddress ? 'Connected' : 'Not Connected')
                      : (ethAddress ? 'Connected' : 'Not Connected')
                    }
                  </span>
                </div>
                <div className={`p-6 rounded-3xl ${direction === 'deposit' ? 'bg-orange-500/5 border-orange-500/20' : 'bg-white/5 border-white/10'} border flex items-center justify-between`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full ${direction === 'deposit' ? 'bg-orange-500/20 border-orange-500/30' : 'bg-white/10 border-white/5'} p-2 border`}>
                      <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" className="w-full h-full object-contain" alt={direction === 'deposit' ? 'USDCx' : 'USDC'} />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white flex items-center gap-2">
                        {direction === 'deposit' ? 'USDCx' : 'USDC'}
                        {direction === 'deposit' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500 text-white font-bold">L2</span>}
                      </div>
                      <div className={`text-xs ${direction === 'deposit' ? 'text-orange-500/70' : 'text-gray-500'} font-medium`}>
                        {direction === 'deposit' ? 'Stacks Bitcoin L2' : 'Ethereum Sepolia Testnet'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold mono text-white">
                      {direction === 'withdraw' && amount 
                        ? (parseFloat(amount) - 4.80).toFixed(2) // Show amount minus fee for withdrawals
                        : (amount || "0.00")
                      }
                    </div>
                    <div className="text-xs text-gray-500">
                      {direction === 'deposit' ? '1:1 peg, no fees' : '~$4.80 bridge fee'}
                    </div>
                  </div>
                </div>
                {direction === 'deposit' && stacksAddress && (
                  <div className="text-xs text-gray-500 px-2 truncate">
                    Recipient: {stacksAddress}
                  </div>
                )}
                {direction === 'withdraw' && ethAddress && (
                  <div className="text-xs text-gray-500 px-2 truncate">
                    Recipient: {ethAddress}
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleBridge}
                  disabled={
                    !amount || 
                    parseFloat(amount) <= 0 ||
                    isBridging || 
                    !stacksAddress ||
                    (direction === 'deposit' && !ethAddress) ||
                    (direction === 'deposit' && parseFloat(amount) < parseFloat(BRIDGE_CONFIG.MIN_DEPOSIT)) ||
                    (direction === 'deposit' && parseFloat(amount) > parseFloat(usdcBalance)) ||
                    (direction === 'withdraw' && parseFloat(amount) < parseFloat(BRIDGE_CONFIG.MIN_WITHDRAWAL)) ||
                    (direction === 'withdraw' && parseFloat(amount) > parseFloat(usdcxBalance))
                  }
                  className={`w-full py-5 rounded-[24px] ${direction === 'deposit' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30' : 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/30'} disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold text-xl shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3`}
                >
                  {isBridging ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowLeftRight className="w-6 h-6" />}
                  {isBridging 
                    ? "Bridging..." 
                    : !stacksAddress 
                      ? "Connect Stacks Wallet First"
                      : direction === 'deposit'
                        ? (!ethAddress 
                            ? "Connect MetaMask First" 
                            : !amount || parseFloat(amount) <= 0
                              ? "Enter Amount"
                              : parseFloat(amount) < parseFloat(BRIDGE_CONFIG.MIN_DEPOSIT)
                                ? `Minimum ${BRIDGE_CONFIG.MIN_DEPOSIT} USDC`
                                : parseFloat(amount) > parseFloat(usdcBalance)
                                  ? "Insufficient USDC Balance"
                                  : "Bridge USDC to Stacks")
                        : (!amount || parseFloat(amount) <= 0
                            ? "Enter Amount"
                            : parseFloat(amount) < parseFloat(BRIDGE_CONFIG.MIN_WITHDRAWAL)
                              ? `Minimum ${BRIDGE_CONFIG.MIN_WITHDRAWAL} USDCx`
                              : parseFloat(amount) > parseFloat(usdcxBalance)
                                ? "Insufficient USDCx Balance"
                                : !ethAddress
                                  ? "Connect MetaMask First"
                                  : "Withdraw USDCx to Ethereum")
                  }
                </button>
                {direction === 'deposit' && amount && parseFloat(amount) > 0 && parseFloat(amount) < parseFloat(BRIDGE_CONFIG.MIN_DEPOSIT) && (
                  <div className="text-xs text-orange-500 text-center mt-2">
                    Minimum deposit: {BRIDGE_CONFIG.MIN_DEPOSIT} USDC
                  </div>
                )}
                {direction === 'withdraw' && amount && parseFloat(amount) > 0 && parseFloat(amount) < parseFloat(BRIDGE_CONFIG.MIN_WITHDRAWAL) && (
                  <div className="text-xs text-purple-500 text-center mt-2">
                    Minimum withdrawal: {BRIDGE_CONFIG.MIN_WITHDRAWAL} USDCx (includes $4.80 fee)
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-center text-xs text-gray-500 bg-white/5 py-4 rounded-2xl border border-white/5">
            <Info className={`w-4 h-4 ${direction === 'deposit' ? 'text-orange-500' : 'text-purple-500'}`} />
            {direction === 'deposit' 
              ? 'Powered by Circle xReserve • ~2-5 min bridging time • Testnet only'
              : 'Powered by Circle xReserve • ~25-60 min withdrawal time • $4.80 fee'
            }
          </div>
        </div>

        {/* Bridge Info & History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-3xl border border-white/10">
            <h3 className="text-md font-bold text-white mb-4">Bridge Statistics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Total Volume</span>
                <span className="text-white font-bold mono">$14.2M</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Avg. Time</span>
                <span className="text-white font-bold mono">~3.5 mins</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Liquidity Status</span>
                <span className="text-green-500 font-bold flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Optimal
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-md font-bold text-white">Your Bridge History</h3>
                {ethAddress && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    ETH: {ethAddress.slice(0, 6)}...{ethAddress.slice(-4)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isCheckingBalance && (
                  <div className="text-xs text-orange-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking...
                  </div>
                )}
                {bridgeTransactions.length > 0 && (
                  <span className="text-[10px] text-gray-500">
                    {bridgeTransactions.length} transaction{bridgeTransactions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {bridgeTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No bridge transactions yet
                </div>
              ) : (
                bridgeTransactions.map((tx) => {
                  const statusInfo = getStatusInfo(tx.status);
                  const StatusIcon = statusInfo.icon;
                  const isAnimating = tx.status === 'attesting' || tx.status === 'minting';
                  
                  // Determine which explorer links to show based on direction and status
                  // For deposits: Etherscan is always valid (source chain), Stacks only valid when completed
                  // For withdrawals: Stacks is always valid (source chain), Etherscan only valid when completed
                  const showEtherscan = tx.direction === 'deposit' 
                    ? !!tx.ethTxHash  // Deposits: always show if we have hash
                    : tx.status === 'completed'; // Withdrawals: only show when completed
                  
                  const showStacksExplorer = tx.direction === 'withdraw'
                    ? !!tx.stacksTxHash  // Withdrawals: always show if we have hash
                    : tx.status === 'completed'; // Deposits: only show when completed
                  
                  return (
                    <div key={tx.id} className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${statusInfo.bg} flex items-center justify-center`}>
                            <StatusIcon className={`w-4 h-4 ${statusInfo.color} ${isAnimating ? 'animate-spin' : ''}`} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                              {parseFloat(tx.amount).toFixed(2)} {tx.direction === 'deposit' ? 'USDC → USDCx' : 'USDCx → USDC'}
                              <span className={`text-[9px] px-1.5 py-0.5 rounded ${tx.direction === 'deposit' ? 'bg-orange-500/20 text-orange-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                {tx.direction === 'deposit' ? 'DEPOSIT' : 'WITHDRAW'}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-tighter">{getTimeAgo(tx.timestamp)}</div>
                          </div>
                        </div>
                        <div className={`text-xs font-bold ${statusInfo.color} ${statusInfo.bg} px-2 py-1 rounded-lg`}>
                          {statusInfo.text}
                        </div>
                      </div>
                      
                      {/* Transaction Links - Only show valid links */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                        {/* Etherscan Link */}
                        {showEtherscan && tx.ethTxHash ? (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${tx.ethTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-xs text-gray-400 hover:text-orange-500 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-orange-500/10 transition-all"
                          >
                            <img src="https://etherscan.io/images/brandassets/etherscan-logo-circle.png" className="w-3 h-3" alt="Etherscan" />
                            Sepolia
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : tx.direction === 'withdraw' && tx.status !== 'completed' ? (
                          <div className="flex-1 text-xs text-gray-600 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white/5 cursor-not-allowed">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            <span className="truncate">Awaiting ETH release...</span>
                          </div>
                        ) : tx.direction === 'withdraw' && tx.status === 'completed' && !tx.ethTxHash ? (
                          <div className="flex-1 text-xs text-green-500 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-green-500/10">
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="truncate">USDC Received</span>
                          </div>
                        ) : null}
                        
                        {/* Stacks Explorer Link */}
                        {showStacksExplorer && tx.stacksTxHash ? (
                          <a
                            href={`https://explorer.hiro.so/txid/${tx.stacksTxHash}?chain=testnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-xs text-gray-400 hover:text-purple-500 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-purple-500/10 transition-all"
                          >
                            <div className="w-3 h-3 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <span className="text-[8px]">Ⓢ</span>
                            </div>
                            Stacks
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : tx.direction === 'deposit' && tx.status !== 'completed' ? (
                          <div className="flex-1 text-xs text-gray-600 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white/5 cursor-not-allowed">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            <span className="truncate">Awaiting USDCx mint...</span>
                          </div>
                        ) : tx.direction === 'deposit' && tx.status === 'completed' && !tx.stacksTxHash ? (
                          <div className="flex-1 text-xs text-green-500 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-green-500/10">
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="truncate">USDCx Received</span>
                          </div>
                        ) : null}
                      </div>
                      
                      {/* Verification Helper for Minting Transactions */}
                      {tx.status === 'minting' && tx.direction === 'deposit' && (
                        <div className="mt-2 p-2 rounded-lg bg-purple-500/5 border border-purple-500/20">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <p className="text-[10px] text-purple-400">💡 Almost there!</p>
                            {isCheckingBalance && (
                              <div className="flex items-center gap-1 ml-auto">
                                <Loader2 className="w-2.5 h-2.5 text-purple-500 animate-spin" />
                                <span className="text-[9px] text-purple-500">Auto-checking...</span>
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 mb-2">
                            We're automatically checking your wallet every 10s. The USDCx mint transaction is handled by Circle's attestation service.
                          </p>
                          <button
                            onClick={() => {
                              // User manually confirms they received the funds
                              if (confirm(`Have you verified that ${parseFloat(tx.amount).toFixed(2)} USDCx appeared in your Stacks wallet?\n\nNote: The mint transaction was processed by Circle's attestation service.`)) {
                                // Mark as completed without a fake Stacks hash - the mint was done by the attestation service
                                updateTransactionStatus(tx.id, 'completed');
                              }
                            }}
                            className="w-full text-[10px] font-bold px-2 py-1.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition-all"
                          >
                            ✓ I've Received the USDCx
                          </button>
                        </div>
                      )}
                      
                      {/* Verification Helper for Withdrawal Transactions */}
                      {tx.status === 'minting' && tx.direction === 'withdraw' && (
                        <div className="mt-2 p-2 rounded-lg bg-orange-500/5 border border-orange-500/20">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <p className="text-[10px] text-orange-400">⏳ Withdrawal Processing</p>
                          </div>
                          <p className="text-[10px] text-gray-400 mb-2">
                            Your USDCx has been burned on Stacks. xReserve will release USDC to your Ethereum wallet once verified (~25-60 min).
                          </p>
                          <button
                            onClick={() => {
                              if (confirm(`Have you verified that ${(parseFloat(tx.amount) - 4.80).toFixed(2)} USDC appeared in your Ethereum wallet?\n\nNote: The USDC release was processed by Circle's xReserve.`)) {
                                // Mark as completed without a fake ETH hash - the release was done by xReserve
                                updateTransactionStatus(tx.id, 'completed');
                              }
                            }}
                            className="w-full text-[10px] font-bold px-2 py-1.5 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 transition-all"
                          >
                            ✓ I've Received the USDC
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-gradient-to-br from-purple-500/10 to-orange-500/10 border border-white/5">
            <h4 className="text-sm font-bold text-white mb-2">How it works</h4>
            {direction === 'deposit' ? (
              <>
                <p className="text-xs text-gray-400 leading-relaxed mb-3">
                  When you deposit USDC on Ethereum Sepolia, the xReserve protocol locks it and sends an attestation to Stacks. Once verified by Circle, USDCx is minted 1:1 to your Stacks wallet.
                </p>
                <div className="space-y-2 text-[10px] text-gray-500">
                  <div>• Minimum deposit: {BRIDGE_CONFIG.MIN_DEPOSIT} USDC</div>
                  <div>• Bridge time: ~2-5 minutes</div>
                  <div>• No bridge fees (only gas)</div>
                  <div>• 1:1 peg guaranteed by Circle</div>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-400 leading-relaxed mb-3">
                  When you withdraw USDCx from Stacks, the tokens are burned and the attestation service notifies xReserve. Circle then verifies and releases the equivalent USDC to your Ethereum wallet.
                </p>
                <div className="space-y-2 text-[10px] text-gray-500">
                  <div>• Minimum withdrawal: {BRIDGE_CONFIG.MIN_WITHDRAWAL} USDCx</div>
                  <div>• Withdrawal time: ~25-60 minutes</div>
                  <div>• Bridge fee: ~$4.80 (deducted from amount)</div>
                  <div>• 1:1 peg guaranteed by Circle</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bridge;
