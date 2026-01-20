
import React, { useState, useEffect } from 'react';
import { ArrowDown, ArrowLeftRight, Info, Loader2, CheckCircle2, ExternalLink, Wallet, AlertCircle } from 'lucide-react';
import { userSession } from '@/lib/stacks';
import {
  connectEthereumWallet,
  getUSDCBalance,
  getETHBalance,
  depositToStacks,
  BRIDGE_CONFIG,
  type BridgeClients,
} from '@/lib/bridge';

const Bridge: React.FC = () => {
  // Get Stacks address from wallet
  const userData = userSession.loadUserData();
  const stacksAddress = userData?.profile?.stxAddress?.testnet || '';
  
  const [isBridging, setIsBridging] = useState(false);
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  
  // Ethereum wallet state
  const [ethClients, setEthClients] = useState<BridgeClients | null>(null);
  const [ethAddress, setEthAddress] = useState<string>('');
  const [usdcBalance, setUsdcBalance] = useState<string>('0.00');
  const [ethBalance, setEthBalance] = useState<string>('0.00');
  const [txHash, setTxHash] = useState<string>('');

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

  // Refresh balances
  const refreshBalances = async () => {
    if (!ethClients) return;
    try {
      const usdc = await getUSDCBalance(ethClients.publicClient, ethClients.address);
      const eth = await getETHBalance(ethClients.publicClient, ethClients.address);
      setUsdcBalance(usdc.formatted);
      setEthBalance(eth.formatted);
    } catch (err) {
      console.error('Failed to refresh balances:', err);
    }
  };

  const handleBridge = async () => {
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

      // Step 1: Approve & Deposit
      const result = await depositToStacks(
        ethClients.walletClient,
        ethClients.publicClient,
        amount,
        stacksAddress
      );

      setTxHash(result.depositHash);
      setStep(2);

      // Step 2: Wait for attestation (simulated delay)
      await new Promise(resolve => setTimeout(resolve, 3000));
      setStep(3);

      // Step 3: USDCx minting (happens automatically on Stacks)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setIsBridging(false);
      setSuccess(true);
      setStep(4);
      
      // Refresh balances
      await refreshBalances();
    } catch (err: any) {
      console.error('Bridge error:', err);
      setError(err.message || 'Bridge transaction failed');
      setIsBridging(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-white">Universal Bridge</h1>
        <p className="text-gray-400">Move your USDC from Ethereum to Stacks USDCx via Circle xReserve.</p>
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
                  <Loader2 className="w-16 h-16 text-orange-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mono">
                    {step * 25}%
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">
                    {step === 1 && "Confirming Ethereum Transaction..."}
                    {step === 2 && "Waiting for Attestation Service..."}
                    {step === 3 && "Minting USDCx on Stacks..."}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {step === 1 && "Approve and deposit USDC to xReserve on Sepolia"}
                    {step === 2 && "Circle attestation service processing your deposit"}
                    {step === 3 && "USDCx tokens being minted to your Stacks address"}
                  </p>
                  {txHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-orange-500 hover:text-orange-400 flex items-center justify-center gap-1 mt-2"
                    >
                      View on Etherscan <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="w-full max-w-xs h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-orange-500 transition-all duration-1000`} style={{ width: `${step * 33}%` }} />
                </div>
              </div>
            )}

            {success && !isBridging && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Bridge Successful!</h3>
                  <p className="text-sm text-gray-400">{amount} USDCx will be credited to your Stacks wallet in ~2-5 minutes.</p>
                  {txHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-orange-500 hover:text-orange-400 flex items-center justify-center gap-1 mt-2"
                    >
                      View Transaction <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <button 
                  onClick={() => {setSuccess(false); setAmount(''); setTxHash(''); setStep(1);}}
                  className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold transition-all"
                >
                  Close
                </button>
              </div>
            )}

            <div className="space-y-6">
              {/* From Ethereum */}
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest px-2">
                  <span>From Ethereum Sepolia</span>
                  <span className="flex items-center gap-1">
                    <Wallet className="w-3 h-3"/> 
                    {ethAddress ? `${usdcBalance} USDC` : 'Not Connected'}
                  </span>
                </div>
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between group focus-within:border-orange-500/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/10 p-2 border border-white/5">
                      <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" className="w-full h-full object-contain" alt="USDC" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white">USDC</div>
                      <div className="text-xs text-gray-500">Ethereum Sepolia Testnet</div>
                    </div>
                  </div>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={!ethAddress || !stacksAddress}
                    className="bg-transparent text-right text-3xl font-bold mono text-white focus:outline-none w-1/2 disabled:opacity-50"
                  />
                </div>
                {ethAddress && parseFloat(ethBalance) < 0.01 && (
                  <div className="text-xs text-orange-500 px-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Low ETH balance ({ethBalance} ETH) - you need ETH for gas fees
                  </div>
                )}
              </div>

              {/* Swap Icon */}
              <div className="flex justify-center -my-4 relative z-10">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 border-4 border-[#030712]">
                  <ArrowDown className="w-5 h-5 text-white" />
                </div>
              </div>

              {/* To Stacks */}
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest px-2">
                  <span>To Stacks Testnet</span>
                  <span className="flex items-center gap-1">
                    <Wallet className="w-3 h-3"/> 
                    {stacksAddress ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <div className="p-6 rounded-3xl bg-orange-500/5 border border-orange-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 p-2 border border-orange-500/30">
                      <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" className="w-full h-full object-contain" alt="USDCx" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white flex items-center gap-2">
                        USDCx
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500 text-white font-bold">L2</span>
                      </div>
                      <div className="text-xs text-orange-500/70 font-medium">Stacks Bitcoin L2</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold mono text-white">{amount || "0.00"}</div>
                    <div className="text-xs text-gray-500">1:1 peg, no fees</div>
                  </div>
                </div>
                {stacksAddress && (
                  <div className="text-xs text-gray-500 px-2 truncate">
                    Recipient: {stacksAddress}
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleBridge}
                  disabled={!amount || isBridging || !ethAddress || !stacksAddress || parseFloat(amount) < parseFloat(BRIDGE_CONFIG.MIN_DEPOSIT)}
                  className="w-full py-5 rounded-[24px] bg-orange-500 hover:bg-orange-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold text-xl shadow-2xl shadow-orange-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  {isBridging ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowLeftRight className="w-6 h-6" />}
                  {isBridging ? "Bridging..." : !ethAddress ? "Connect MetaMask First" : !stacksAddress ? "Connect Stacks Wallet First" : "Bridge USDC to Stacks"}
                </button>
                {amount && parseFloat(amount) < parseFloat(BRIDGE_CONFIG.MIN_DEPOSIT) && (
                  <div className="text-xs text-orange-500 text-center mt-2">
                    Minimum deposit: {BRIDGE_CONFIG.MIN_DEPOSIT} USDC
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-center text-xs text-gray-500 bg-white/5 py-4 rounded-2xl border border-white/5">
            <Info className="w-4 h-4 text-orange-500" />
            Powered by Circle xReserve • ~2-5 min bridging time • Testnet only
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
              <h3 className="text-md font-bold text-white">Recent Bridges</h3>
              <button className="text-xs text-orange-500 font-medium hover:underline">View All</button>
            </div>
            <div className="space-y-3">
              {[
                { amount: '5,000', status: 'completed', time: '12m ago' },
                { amount: '1,250', status: 'completed', time: '45m ago' },
                { amount: '12,000', status: 'completed', time: '2h ago' },
              ].map((tx, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <ArrowLeftRight className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{tx.amount} USDCx</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-tighter">{tx.time}</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-600 hover:text-white cursor-pointer" />
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-gradient-to-br from-purple-500/10 to-orange-500/10 border border-white/5">
            <h4 className="text-sm font-bold text-white mb-2">How it works</h4>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              When you deposit USDC on Ethereum Sepolia, the xReserve protocol locks it and sends an attestation to Stacks. Once verified by Circle, USDCx is minted 1:1 to your Stacks wallet.
            </p>
            <div className="space-y-2 text-[10px] text-gray-500">
              <div>• Minimum deposit: {BRIDGE_CONFIG.MIN_DEPOSIT} USDC</div>
              <div>• Bridge time: ~2-5 minutes</div>
              <div>• No bridge fees (only gas)</div>
              <div>• 1:1 peg guaranteed by Circle</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bridge;
