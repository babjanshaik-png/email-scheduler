'use client';

import React from 'react';
import { ScheduledEmail, PaginationMeta } from '@/lib/types';
import { Clock, Star, Trash2 } from 'lucide-react';

interface ScheduledEmailsTableProps {
  emails: ScheduledEmail[];
  loading: boolean;
  onCancelEmail: (id: string) => void;
  onSelectEmail?: (email: ScheduledEmail) => void;
  pagination: PaginationMeta;
  onPageChange: (newPage: number) => void;
}

export const ScheduledEmailsTable: React.FC<ScheduledEmailsTableProps> = ({
  emails,
  loading,
  onCancelEmail,
  onSelectEmail,
  pagination,
  onPageChange,
}) => {
  if (loading && emails.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400">
        <div className="animate-spin w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-2"></div>
        <span className="text-xs">Loading scheduled emails...</span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400">
        <Clock className="w-8 h-8 mx-auto text-gray-300 mb-2 stroke-[1.5]" />
        <p className="text-sm font-medium text-gray-600">No scheduled emails</p>
        <p className="text-xs text-gray-400 mt-1">Pending email jobs will appear here.</p>
      </div>
    );
  }

  const formatScheduledTime = (dateStr?: string) => {
    if (!dateStr) return 'Scheduled';
    const d = new Date(dateStr);
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    return `${day} ${time}`;
  };

  return (
    <div className="divide-y divide-gray-100">
      {emails.map((email) => {
        const recipient = email.recipientEmail || (email as any).recipient || 'recipient@example.com';
        const recipientDisplay = recipient.includes('@') ? recipient.split('@')[0].replace('.', ' ') : recipient;
        const timeText = formatScheduledTime(email.scheduledAt || (email as any).scheduledFor);

        return (
          <div
            key={email.id}
            onClick={() => onSelectEmail && onSelectEmail(email)}
            className="group flex items-center justify-between py-3.5 px-3 hover:bg-gray-50/80 transition cursor-pointer"
          >
            {/* Left Row Content */}
            <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
              {/* To: {recipient} bold */}
              <span className="font-semibold text-gray-900 text-sm flex-shrink-0 w-36 truncate">
                To: {recipientDisplay}
              </span>

              {/* Amber Time Badge with Clock Icon */}
              <div className="bg-amber-50 text-amber-600 text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 flex-shrink-0">
                <Clock className="w-3 h-3 stroke-[2]" />
                <span>{timeText}</span>
              </div>

              {/* Subject & Snippet Preview */}
              <div className="text-sm truncate flex-1 min-w-0 flex items-center">
                <span className="font-medium text-gray-900">{email.subject}</span>
                <span className="text-gray-300 mx-1.5">·</span>
                <span className="text-gray-500 truncate">{email.body.replace(/\n/g, ' ')}</span>
              </div>
            </div>

            {/* Right Icons */}
            <div className="flex items-center gap-2 text-gray-400 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelEmail(email.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 transition"
                title="Cancel schedule"
              >
                <Trash2 className="w-4 h-4 stroke-[1.5]" />
              </button>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:text-amber-400 transition"
              >
                <Star className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between py-3 px-3 text-xs text-gray-500 pt-4">
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} scheduled)
          </span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              className="px-3 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              className="px-3 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
