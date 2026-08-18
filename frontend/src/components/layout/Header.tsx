'use client';

import React from 'react';
import { Mail, LogOut, ShieldCheck, Activity } from 'lucide-react';
import { User } from '@/lib/types';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  queueStatus?: { delayed: number; active: number };
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, queueStatus }) => {
  return (
    <header className="sticky top-0 z-50 w-full glass-card border-b border-white/10 px-6 py-3.5 flex items-center justify-between">
      {/* Brand logo & title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-purple-600 flex items-center justify-center shadow-md shadow-primary-500/30">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base tracking-tight">ReachInbox</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30">
              PRO
            </span>
          </div>
          <p className="text-xs text-slate-400">Production Email Scheduler & Delivery Engine</p>
        </div>
      </div>

      {/* Live System Indicator */}
      <div className="hidden md:flex items-center gap-4 bg-slate-900/60 border border-white/5 px-4 py-1.5 rounded-full">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-300 font-medium">Workers Active</span>
        </div>
        {queueStatus && (
          <>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Activity className="w-3.5 h-3.5 text-primary-400" />
              <span>
                <strong className="text-white">{queueStatus.delayed}</strong> delayed /{' '}
                <strong className="text-white">{queueStatus.active}</strong> processing
              </span>
            </div>
          </>
        )}
      </div>

      {/* User Profile & Logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 bg-slate-900/80 border border-white/10 px-3.5 py-1.5 rounded-xl">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full bg-slate-800 object-cover border border-white/10"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
              {user.name.charAt(0)}
            </div>
          )}
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-white leading-tight">{user.name}</p>
            <p className="text-[11px] text-slate-400 leading-tight">{user.email}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Logout"
          className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 transition flex items-center justify-center"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
