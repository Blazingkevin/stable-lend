
import React from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, ShieldAlert, Zap } from 'lucide-react';
import { View } from '../types';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { HISTORY_DATA } from '../constants';

interface DashboardProps {
  onAction: (view: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onAction }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Protocol Overview</h1>
          <p className="text-gray-400">Manage your Bitcoin-layer liquidity and debt.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => onAction(View.Lend)}
            className="px-6 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-all flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Supply Now
          </button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Net Value', value: '$12,450.32', change: '+2.4%', color: 'blue' },
          { label: 'Net APY', value: '7.85%', change: '+0.12%', color: 'orange' },
          { label: 'Borrow Power Used', value: '42.5%', change: '-1.2%', color: 'purple' },
          { label: 'Health Factor', value: '2.45', change: 'SAFE', color: 'green' }
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 glass-card p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-white">USDCx Yield Performance</h3>
              <p className="text-sm text-gray-400">Historical APY trends for supplied USDCx</p>
            </div>
            <select className="bg-white/5 border border-white/5 text-xs rounded-lg px-3 py-1.5 focus:outline-none">
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
            </select>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={HISTORY_DATA}>
                <defs>
                  <linearGradient id="colorApy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                  itemStyle={{ color: '#f97316' }}
                />
                <Area type="monotone" dataKey="apy" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorApy)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Assets & Liquidations */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl">
            <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-orange-500" />
              Risk Monitoring
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-2xl bg-white/5 border border-white/5">
                <div>
                  <p className="text-xs text-gray-400">Liquidation Price</p>
                  <p className="text-sm font-bold text-white">$1.24 / STX</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Distance</p>
                  <p className="text-sm font-bold text-orange-500">-32.4%</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                <p className="text-xs text-orange-200 leading-relaxed">
                  Your current health factor is strong. However, a 20% drop in STX price would increase your utilization to 65%.
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl">
            <h3 className="text-md font-bold text-white mb-4">Lending Distribution</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs">U</div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">USDCx</span>
                    <span className="text-gray-400">80%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full">
                    <div className="h-full bg-orange-500 w-[80%]" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs">S</div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">STX</span>
                    <span className="text-gray-400">20%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full">
                    <div className="h-full bg-purple-500 w-[20%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
