'use client';

import React from 'react';
import { Calendar, CheckCircle2, Plus, RefreshCw } from 'lucide-react';

interface DashboardTabsProps {
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onComposeClick: () => void;
  onRefresh: () => void;
  loading?: boolean;
  counts?: { scheduled: number; sent: number };
}

export const DashboardTabs: React.FC<DashboardTabsProps> = ({
  activeTab,
  onTabChange,
  onComposeClick,
  onRefresh,
  loading,
  counts,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6 border-b border-white/10">
      {/* Tabs */}
      <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-white/10">
        <button
          onClick={() => onTabChange('scheduled')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            activeTab === 'scheduled'
              ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Scheduled Emails</span>
          {counts && (
            <span
              className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'scheduled'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {counts.scheduled}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('sent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            activeTab === 'sent'
              ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Sent Emails</span>
          {counts && (
            <span
              className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'sent' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {counts.sent}
            </span>
          )}
        </button>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh Table"
          className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary-400' : ''}`} />
        </button>

        <button
          onClick={onComposeClick}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all transform active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Compose New Email</span>
        </button>
      </div>
    </div>
  );
};
