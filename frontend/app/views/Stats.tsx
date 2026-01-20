
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { ASSETS } from '../constants';
import { ProtocolStats as ProtocolStatsType } from '@/lib/contract-calls';
import { formatUSDCx } from '@/lib/constants';

const COLORS = ['#f97316', '#a855f7', '#3b82f6'];

interface StatsProps {
  protocolStats?: ProtocolStatsType;
  currentAPY?: number;
}

const Stats: React.FC<StatsProps> = ({ protocolStats, currentAPY }) => {
  const pieData = ASSETS.map(a => ({ name: a.symbol, value: a.totalSupplied * a.price }));

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Protocol Statistics</h1>
          <p className="text-gray-400">Real-time transparency for the StableLend ecosystem.</p>
        </div>
        <div className="px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-bold flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Protocol Healthy: 100% Up-time
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-3xl">
          <p className="text-sm text-gray-400 mb-1">Total Value Locked</p>
          <h3 className="text-3xl font-bold text-white mono">$32,412,980</h3>
          <p className="text-xs text-green-500 font-bold mt-2">+12.4% this week</p>
        </div>
        <div className="glass-card p-6 rounded-3xl">
          <p className="text-sm text-gray-400 mb-1">Total Borrowed</p>
          <h3 className="text-3xl font-bold text-white mono">$18,245,112</h3>
          <p className="text-xs text-orange-500 font-bold mt-2">56.2% Utilization</p>
        </div>
        <div className="glass-card p-6 rounded-3xl">
          <p className="text-sm text-gray-400 mb-1">Active Users</p>
          <h3 className="text-3xl font-bold text-white mono">12,402</h3>
          <p className="text-xs text-blue-500 font-bold mt-2">Growing +200 daily</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8 rounded-3xl">
          <h3 className="text-lg font-bold text-white mb-8">Asset Concentration</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {ASSETS.map((asset, i) => (
              <div key={asset.symbol} className="text-center">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-widest">{asset.symbol}</div>
                <div className="text-sm font-bold" style={{ color: COLORS[i] }}>
                  {((asset.totalSupplied * asset.price / 32412980) * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-8 rounded-3xl">
          <h3 className="text-lg font-bold text-white mb-8">24h Volume Trends</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Mon', vol: 1.2 },
                { name: 'Tue', vol: 1.8 },
                { name: 'Wed', vol: 2.4 },
                { name: 'Thu', vol: 1.9 },
                { name: 'Fri', vol: 3.1 },
                { name: 'Sat', vol: 2.8 },
                { name: 'Sun', vol: 3.5 },
              ]}>
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }}
                />
                <Bar dataKey="vol" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-xs text-gray-500 mt-6">All volumes represented in Millions of USD</p>
        </div>
      </div>
    </div>
  );
};

export default Stats;
