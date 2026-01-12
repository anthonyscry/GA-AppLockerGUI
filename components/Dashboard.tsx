
import React from 'react';
import { MOCK_MACHINES, MOCK_EVENTS } from '../constants';
import { 
  Users, 
  ShieldAlert, 
  CheckCircle, 
  Activity,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  FileSearch
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const statsData = [
  { name: 'Mon', allowed: 400, blocked: 24 },
  { name: 'Tue', allowed: 300, blocked: 13 },
  { name: 'Wed', allowed: 200, blocked: 98 },
  { name: 'Thu', allowed: 278, blocked: 39 },
  { name: 'Fri', allowed: 189, blocked: 48 },
];

const Dashboard: React.FC = () => {
  // Documentation logic: 100 - (20 * critical) - (5 * warning) - (1 * info)
  // Simulated: 0 critical, 2 warnings, 4 info = 100 - 10 - 4 = 86
  const healthScore = 86;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Managed Systems" 
          value={MOCK_MACHINES.length.toString()} 
          icon={<Users className="text-blue-600" />} 
          trend="+2 this week"
          trendIcon={<TrendingUp size={14} className="text-green-500" />}
        />
        <StatCard 
          label="Unique Blocked Apps" 
          value="23" 
          icon={<FileSearch className="text-red-500" />} 
          trend="From UniqueBlockedApps.csv"
        />
        <StatCard 
          label="Rule Health Score" 
          value={`${healthScore}/100`} 
          icon={<CheckCircle className="text-green-500" />} 
          trend="Based on Test-RuleHealth.ps1"
        />
        <StatCard 
          label="Blocked Events" 
          value="142" 
          icon={<ShieldAlert className="text-amber-500" />} 
          trend="-12% vs last week"
          trendIcon={<TrendingDown size={14} className="text-green-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Audit Event Ingestion (8003/8004)</h3>
            <select className="text-[10px] font-bold bg-slate-100 border-none rounded px-2 py-1 outline-none uppercase tracking-widest text-slate-500">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar name="Allowed (8003)" dataKey="allowed" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar name="Blocked (8004)" dataKey="blocked" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider mb-4">High Risk Blocked Paths</h3>
          <div className="flex-1 space-y-5">
            {[
              { path: '%TEMP%\\installer.exe', count: 42, color: 'bg-red-500' },
              { path: '%USERPROFILE%\\Downloads\\crack.zip', count: 18, color: 'bg-amber-500' },
              { path: 'C:\\Public\\vbs_script.vbs', count: 15, color: 'bg-orange-400' },
              { path: 'C:\\Windows\\System32\\mshta.exe', count: 9, color: 'bg-slate-500' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="font-mono text-slate-500 truncate mr-4">{item.path}</span>
                  <span className="font-black text-slate-900">{item.count}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className={`${item.color} h-full transition-all duration-1000`} style={{ width: `${(item.count/42)*100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <button className="mt-8 w-full text-center py-2.5 text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all border border-blue-100">
            Export UniqueBlockedApps.csv
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Recent Policy Audit Activity</h3>
          <ArrowUpRight size={18} className="text-slate-400 cursor-pointer hover:text-blue-500" />
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
            <tr>
              <th className="px-6 py-3">Timestamp</th>
              <th className="px-6 py-3">Machine</th>
              <th className="px-6 py-3">Application Context</th>
              <th className="px-6 py-3 text-right">Event ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MOCK_EVENTS.slice(0, 5).map((event) => (
              <tr key={event.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-slate-500 text-xs">{event.timestamp.split(' ')[1]}</td>
                <td className="px-6 py-4 font-bold text-slate-900 text-xs">{event.machine}</td>
                <td className="px-6 py-4 truncate max-w-[200px] text-slate-600 text-xs font-mono">{event.path.split('\\').pop()}</td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    event.eventId === 8004 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                  }`}>
                    {event.eventId}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: string, icon: React.ReactNode, trend?: string, trendIcon?: React.ReactNode }> = ({ label, value, icon, trend, trendIcon }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-200 transition-colors group">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">{icon}</div>
      {trendIcon && <div className="flex items-center space-x-1">{trendIcon}</div>}
    </div>
    <div className="space-y-1">
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{label}</p>
      <h2 className="text-2xl font-black text-slate-900">{value}</h2>
      {trend && <p className="text-[10px] text-slate-400 font-medium italic">{trend}</p>}
    </div>
  </div>
);

export default Dashboard;
