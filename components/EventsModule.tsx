
import React, { useState } from 'react';
import { MOCK_EVENTS } from '../constants';
import { Activity, Download, Trash2, Calendar, Filter, ExternalLink } from 'lucide-react';

const EventsModule: React.FC = () => {
  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Event Monitor</h2>
          <p className="text-slate-500 text-sm">Real-time AppLocker audit event ingestion (8003/8004).</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center space-x-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg hover:bg-slate-50">
            <Calendar size={18} />
            <span>Last 24 Hours</span>
          </button>
          <button className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800">
            <Download size={18} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EventStatCard label="Total Blocked (8004)" value="87" color="text-red-600" />
        <EventStatCard label="Total Audit (8003)" value="1,294" color="text-blue-600" />
        <EventStatCard label="Unique Paths" value="23" color="text-slate-600" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center space-x-4">
          <div className="flex-1 relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Filter events..." className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <button className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <Trash2 size={20} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Machine</th>
                <th className="px-6 py-4">Executable Path</th>
                <th className="px-6 py-4">Publisher</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_EVENTS.map((event) => (
                <tr key={event.id} className="hover:bg-slate-50 group">
                  <td className="px-6 py-4">
                    <span className={`flex items-center space-x-1.5 font-bold ${event.eventId === 8004 ? 'text-red-600' : 'text-blue-600'}`}>
                      <Activity size={14} />
                      <span>{event.eventId}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{event.timestamp}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">{event.machine}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">
                    <div className="max-w-[300px] truncate" title={event.path}>{event.path}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 italic">{event.publisher}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="opacity-0 group-hover:opacity-100 text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-all">
                      <ExternalLink size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <button className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest">Load Older Events</button>
        </div>
      </div>
    </div>
  );
};

const EventStatCard: React.FC<{ label: string, value: string, color: string }> = ({ label, value, color }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">{label}</p>
    <p className={`text-2xl font-black ${color}`}>{value}</p>
  </div>
);

export default EventsModule;
