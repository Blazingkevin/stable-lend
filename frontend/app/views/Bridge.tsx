
import React, { useState } from 'react';
import { ArrowDown, ArrowLeftRight, Info, Loader2, CheckCircle2, ExternalLink, Wallet } from 'lucide-react';

const Bridge: React.FC = () => {
  const [isBridging, setIsBridging] = useState(false);
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');

  const handleBridge = () => {
    if (!amount) return;
    setIsBridging(true);
    setStep(1);
    
    // Simulate multi-step bridging process
    setTimeout(() => setStep(2), 2000);
    setTimeout(() => setStep(3), 4000);
    setTimeout(() => {
      setIsBridging(false);
      setStep(4);
    }, 6000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-white">Universal Bridge</h1>
        <p className="text-gray-400">Move your USDC from Ethereum to Stacks USDCx via Circle xReserve.</p>
      </div>

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
                    {step === 1 && "Initiating xReserve Deposit..."}
                    {step === 2 && "Awaiting Attestations..."}
                    {step === 3 && "Minting USDCx on Stacks..."}
                  </h3>
                  <p className="text-sm text-gray-400">This usually takes 2-5 minutes. You can safely navigate away.</p>
                </div>
                <div className="w-full max-w-xs h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-orange-500 transition-all duration-1000`} style={{ width: `${step * 33}%` }} />
                </div>
              </div>
            )}

            {step === 4 && !isBridging && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-10 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Bridge Successful!</h3>
                  <p className="text-sm text-gray-400">{amount} USDCx has been credited to your Stacks wallet.</p>
                </div>
                <button 
                  onClick={() => {setStep(1); setAmount('');}}
                  className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold transition-all"
                >
                  Close Window
                </button>
              </div>
            )}

            <div className="space-y-6">
              {/* From Ethereum */}
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest px-2">
                  <span>From Ethereum</span>
                  <span className="flex items-center gap-1"><Wallet className="w-3 h-3"/> 2,401.00 USDC</span>
                </div>
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-between group focus-within:border-orange-500/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/10 p-2 border border-white/5">
                      <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" className="w-full h-full object-contain" alt="USDC" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white">USDC</div>
                      <div className="text-xs text-gray-500">Ethereum Network</div>
                    </div>
                  </div>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-transparent text-right text-3xl font-bold mono text-white focus:outline-none w-1/2"
                  />
                </div>
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
                  <span>To Stacks</span>
                  <span className="flex items-center gap-1"><Wallet className="w-3 h-3"/> 0.00 USDCx</span>
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
                    <div className="text-xs text-gray-500">Includes 0.5% fee</div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleBridge}
                  disabled={!amount || isBridging}
                  className="w-full py-5 rounded-[24px] bg-orange-500 hover:bg-orange-600 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold text-xl shadow-2xl shadow-orange-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  {isBridging ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowLeftRight className="w-6 h-6" />}
                  {isBridging ? "Confirming Bridge..." : "Bridge Assets to Stacks"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-center text-xs text-gray-500 bg-white/5 py-4 rounded-2xl border border-white/5">
            <Info className="w-4 h-4 text-orange-500" />
            Powered by Circle xReserve and Stacks Attestation Service
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
            <h4 className="text-sm font-bold text-white mb-2">How it works?</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              When you deposit USDC on Ethereum, the xReserve protocol locks it and sends an attestation to Stacks. Once verified, USDCx is minted 1:1 to your Stacks wallet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bridge;
