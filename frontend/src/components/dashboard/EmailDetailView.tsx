'use client';

import React from 'react';
import { ScheduledEmail } from '@/lib/types';
import { ArrowLeft, Star, Archive, Trash2, ChevronDown } from 'lucide-react';

interface EmailDetailViewProps {
  email: ScheduledEmail;
  onBack: () => void;
  onDelete?: (id: string) => void;
}

export const EmailDetailView: React.FC<EmailDetailViewProps> = ({ email, onBack, onDelete }) => {
  const recipient = email.recipientEmail || (email as any).recipient || 'recipient@example.com';
  const recipientName = recipient.includes('@') ? recipient.split('@')[0].replace('.', ' ') : recipient;
  const dateStr = email.sentAt || email.scheduledAt || (email as any).scheduledFor || new Date().toISOString();

  const formattedDate = new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-white min-h-[500px] flex flex-col font-sans text-gray-800">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-gray-100 rounded-full transition text-gray-600"
            title="Back to list"
          >
            <ArrowLeft className="w-5 h-5 stroke-[1.5]" />
          </button>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">{email.subject}</h2>
        </div>

        {/* Top-Right Icon Row */}
        <div className="flex items-center gap-3 text-gray-400">
          <button className="p-1.5 hover:text-amber-400 transition" title="Star">
            <Star className="w-4 h-4 stroke-[1.5]" />
          </button>
          <button className="p-1.5 hover:text-gray-600 transition" title="Archive">
            <Archive className="w-4 h-4 stroke-[1.5]" />
          </button>
          <button
            onClick={() => onDelete && onDelete(email.id)}
            className="p-1.5 hover:text-red-600 transition"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 stroke-[1.5]" />
          </button>
          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold ml-1">
            {recipientName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Main Detail Container */}
      <div className="space-y-6 max-w-4xl">
        {/* Sender / Receiver Block */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Colored circular avatar with initial */}
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
              {recipientName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{recipientName}</span>
                <span className="text-xs text-gray-400">&lt;{recipient}&gt;</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <span>to me</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-400 font-normal">{formattedDate}</div>
        </div>

        {/* Body Section */}
        <div className="space-y-4 text-sm text-gray-700 leading-relaxed pt-2">
          {/* Highlighted Callout Box (light amber/yellow background) */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
            <p className="font-semibold text-amber-800">
              ⚡ Scheduled Delivery via ReachInbox Rate-Limiting Worker
            </p>
            <p className="text-amber-700">
              Status: <span className="font-bold uppercase">{email.status}</span> · Job ID:{' '}
              {email.jobId || email.id}
            </p>
          </div>

          <div className="whitespace-pre-wrap">{email.body}</div>

          {email.etherealUrl && (
            <div className="pt-3 border-t border-gray-100">
              <a
                href={email.etherealUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                <span>View Raw Ethereal Mail Message &rarr;</span>
              </a>
            </div>
          )}
        </div>

        {/* Attachments Section (if any) */}
        <div className="pt-6 border-t border-gray-100">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Attachments (2)
          </h4>
          <div className="flex flex-wrap gap-4">
            <div className="border border-gray-200 rounded-xl p-2.5 w-44 hover:shadow-xs transition bg-gray-50/50">
              <div className="h-24 bg-gray-200 rounded-lg overflow-hidden mb-2 relative flex items-center justify-center text-gray-400">
                <img
                  src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=300&auto=format&fit=crop&q=80"
                  alt="Attachment preview 1"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs font-medium text-gray-800 truncate">Document_Attachment.png</p>
              <p className="text-[11px] text-gray-400">1.2 MB</p>
            </div>

            <div className="border border-gray-200 rounded-xl p-2.5 w-44 hover:shadow-xs transition bg-gray-50/50">
              <div className="h-24 bg-gray-200 rounded-lg overflow-hidden mb-2 relative flex items-center justify-center text-gray-400">
                <img
                  src="https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=300&auto=format&fit=crop&q=80"
                  alt="Attachment preview 2"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs font-medium text-gray-800 truncate">Schedule_Report.pdf</p>
              <p className="text-[11px] text-gray-400">840 KB</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
