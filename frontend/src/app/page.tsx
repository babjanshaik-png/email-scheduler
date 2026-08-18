'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { User, Sender, ScheduledEmail, PaginationMeta, EmailStats } from '@/lib/types';
import { api } from '@/lib/api';
import { GoogleLoginModal } from '@/components/auth/GoogleLoginModal';
import { ScheduledEmailsTable } from '@/components/dashboard/ScheduledEmailsTable';
import { SentEmailsTable } from '@/components/dashboard/SentEmailsTable';
import { EmailDetailView } from '@/components/dashboard/EmailDetailView';
import { ComposeEmailModal } from '@/components/compose/ComposeEmailModal';
import { toast } from 'sonner';
import {
  Clock,
  Send,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  LogOut,
} from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  // Data & Pagination State
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [sentEmails, setSentEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<EmailStats | null>(null);

  const [scheduledPagination, setScheduledPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 1,
  });

  const [sentPagination, setSentPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 1,
  });

  // Load session from localStorage if available
  useEffect(() => {
    const savedUser = localStorage.getItem('reachinbox_user');
    const savedSenders = localStorage.getItem('reachinbox_senders');
    if (savedUser && savedSenders) {
      try {
        setUser(JSON.parse(savedUser));
        setSenders(JSON.parse(savedSenders));
      } catch (e) {
        localStorage.removeItem('reachinbox_user');
        localStorage.removeItem('reachinbox_senders');
      }
    }
  }, []);

  const handleLoginSuccess = (loggedInUser: User, loadedSenders: Sender[]) => {
    setUser(loggedInUser);
    setSenders(loadedSenders);
    localStorage.setItem('reachinbox_user', JSON.stringify(loggedInUser));
    localStorage.setItem('reachinbox_senders', JSON.stringify(loadedSenders));
  };

  const handleLogout = () => {
    setUser(null);
    setSenders([]);
    localStorage.removeItem('reachinbox_user');
    localStorage.removeItem('reachinbox_senders');
    toast.info('You have been logged out.');
  };

  const fetchData = useCallback(
    async (showLoading = false) => {
      if (!user) return;
      if (showLoading) setLoading(true);

      try {
        const [schedRes, sentRes, statsRes] = await Promise.all([
          api.getScheduledEmails({ page: scheduledPagination.page, limit: 10 }),
          api.getSentEmails({ page: sentPagination.page, limit: 10 }),
          api.getStats(),
        ]);

        setScheduledEmails(schedRes.data || []);
        setScheduledPagination(schedRes.pagination);

        setSentEmails(sentRes.data || []);
        setSentPagination(sentRes.pagination);

        setStats(statsRes.stats);
      } catch (error: any) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [user, scheduledPagination.page, sentPagination.page]
  );

  // Initial fetch and auto-refresh polling every 3.5 seconds
  useEffect(() => {
    if (user) {
      fetchData(true);
      const interval = setInterval(() => {
        fetchData(false);
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  const handleCancelEmail = async (id: string) => {
    try {
      const res = await api.cancelEmail(id);
      toast.success(res.message || 'Cancelled email successfully');
      fetchData(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel email');
    }
  };

  if (!user) {
    return <GoogleLoginModal onLoginSuccess={handleLoginSuccess} />;
  }

  // Filter emails based on search query
  const filteredScheduled = scheduledEmails.filter((e) => {
    const rec = e.recipientEmail || (e as any).recipient || '';
    return (
      rec.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.body.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredSent = sentEmails.filter((e) => {
    const rec = e.recipientEmail || (e as any).recipient || '';
    return (
      rec.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.body.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const scheduledCount = stats ? stats.scheduled : scheduledPagination.totalCount || scheduledEmails.length;
  const sentCount = stats ? stats.sent : sentPagination.totalCount || sentEmails.length;

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900">
      {/* TWO-PANE APP SHELL */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto bg-white min-h-screen border-x border-gray-100 shadow-xs">
        {/* LEFT SIDEBAR (~260px, white bg, right border gray-100) */}
        <aside className="w-64 bg-white border-r border-gray-100 p-5 flex flex-col justify-between flex-shrink-0">
          <div className="space-y-6">
            {/* Top Wordmark Logo */}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 font-mono">
                ReachInbox
              </h1>
            </div>

            {/* User Profile Row Directly Below in a subtle rounded-xl bordered card */}
            <div className="relative">
              <div
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="bg-gray-50 hover:bg-gray-100/80 border border-gray-100 p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-1">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate leading-tight">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate leading-tight">
                      {user.email}
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>

              {isUserMenuOpen && (
                <div className="absolute top-14 left-0 right-0 z-50 bg-white rounded-xl shadow-lg border border-gray-100 p-1.5 space-y-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* "Compose" Button (full width, outline style: green border + green text, white fill, rounded-full) */}
            <button
              onClick={() => {
                setSelectedEmail(null);
                setIsComposeOpen(true);
              }}
              className="w-full py-2.5 px-4 rounded-full border border-emerald-600 text-emerald-600 hover:bg-emerald-50 bg-white font-medium text-sm transition flex items-center justify-center gap-2"
            >
              <span>Compose</span>
            </button>

            {/* Section label "CORE" */}
            <div className="space-y-1 pt-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 mb-2">
                CORE
              </p>

              {/* "Scheduled" (clock icon) */}
              <button
                onClick={() => {
                  setSelectedEmail(null);
                  setActiveTab('scheduled');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition ${
                  activeTab === 'scheduled' && !selectedEmail
                    ? 'bg-emerald-50 text-gray-900 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 font-normal'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-gray-500 stroke-[1.5]" />
                  <span>Scheduled</span>
                </div>
                <span className="text-gray-400 font-medium">{scheduledCount}</span>
              </button>

              {/* "Sent" (paper-plane icon) */}
              <button
                onClick={() => {
                  setSelectedEmail(null);
                  setActiveTab('sent');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition ${
                  activeTab === 'sent' && !selectedEmail
                    ? 'bg-emerald-50 text-gray-900 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 font-normal'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Send className="w-4 h-4 text-gray-500 stroke-[1.5]" />
                  <span>Sent</span>
                </div>
                <span className="text-gray-400 font-medium">{sentCount}</span>
              </button>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
            ReachInbox Engine
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 bg-white p-6 flex flex-col overflow-y-auto">
          {/* Top Bar: Search Input + Filter Icon + Refresh Icon */}
          {!selectedEmail && (
            <div className="flex items-center justify-between gap-4 mb-6">
              {/* Search input (rounded-full, gray-50 fill, magnifying glass left) */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.5]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full rounded-full bg-gray-50 pl-10 pr-4 py-2 text-xs text-gray-900 placeholder:text-gray-400 outline-none border border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>

              {/* Icon-Only Buttons (filter, refresh) */}
              <div className="flex items-center gap-2 text-gray-400">
                <button
                  className="p-2 hover:text-gray-600 rounded-full hover:bg-gray-50 transition"
                  title="Filter"
                >
                  <Filter className="w-4 h-4 stroke-[1.5]" />
                </button>
                <button
                  onClick={() => fetchData(true)}
                  className="p-2 hover:text-gray-600 rounded-full hover:bg-gray-50 transition"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 stroke-[1.5] ${loading ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
              </div>
            </div>
          )}

          {/* Render Active View */}
          {selectedEmail ? (
            <EmailDetailView
              email={selectedEmail}
              onBack={() => setSelectedEmail(null)}
              onDelete={handleCancelEmail}
            />
          ) : activeTab === 'scheduled' ? (
            <ScheduledEmailsTable
              emails={filteredScheduled}
              loading={loading}
              onCancelEmail={handleCancelEmail}
              onSelectEmail={(email) => setSelectedEmail(email)}
              pagination={scheduledPagination}
              onPageChange={(newPage) =>
                setScheduledPagination((prev) => ({ ...prev, page: newPage }))
              }
            />
          ) : (
            <SentEmailsTable
              emails={filteredSent}
              loading={loading}
              onSelectEmail={(email) => setSelectedEmail(email)}
              pagination={sentPagination}
              onPageChange={(newPage) =>
                setSentPagination((prev) => ({ ...prev, page: newPage }))
              }
            />
          )}
        </main>
      </div>

      {/* Compose Modal */}
      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        user={user}
        senders={senders}
        onSuccess={() => fetchData(true)}
      />
    </div>
  );
}
