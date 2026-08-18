'use client';

import React from 'react';
import { ScheduledEmail, PaginationMeta } from '@/lib/types';
import { Star } from 'lucide-react';

interface SentEmailsTableProps {
  emails: ScheduledEmail[];
  loading: boolean;
  onSelectEmail?: (email: ScheduledEmail) => void;
  pagination: PaginationMeta;
  onPageChange: (newPage: number) => void;
}

export const SentEmailsTable: React.FC<SentEmailsTableProps> = ({
  emails,
  loading,
  onSelectEmail,
  pagination,
  onPageChange,
}) => {
  if (loading && emails.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400">
        <div className="animate-spin w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-2"></div>
        <span className="text-xs">Loading sent emails...</span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400">
        <p className="text-sm font-medium text-gray-600">No sent emails</p>
        <p className="text-xs text-gray-400 mt-1">Delivered emails will appear here.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {emails.map((email) => {
        const recipient = email.recipientEmail || (email as any).recipient || 'recipient@example.com';
        const recipientDisplay = recipient.includes('@') ? recipient.split('@')[0].replace('.', ' ') : recipient;

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

              {/* Neutral Gray "Sent" Badge (no icon) */}
              <div className="bg-gray-100 text-gray-600 text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0">
                Sent
              </div>

              {/* Subject & Snippet Preview */}
              <div className="text-sm truncate flex-1 min-w-0 flex items-center">
                <span className="font-medium text-gray-900">{email.subject}</span>
                <span className="text-gray-300 mx-1.5">·</span>
                <span className="text-gray-500 truncate">{email.body.replace(/\n/g, ' ')}</span>
              </div>
            </div>

            {/* Right Star Icon */}
            <div className="flex items-center gap-2 text-gray-400 flex-shrink-0">
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
            Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} sent)
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
