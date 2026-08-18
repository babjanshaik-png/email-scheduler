'use client';

import React, { useState, useRef } from 'react';
import { User, Sender } from '@/lib/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Papa from 'papaparse';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Calendar,
  X,
  Upload,
  RotateCcw,
  RotateCw,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  AlignLeft,
  AlignJustify,
  Indent,
  Outdent,
  Loader2,
  Trash2,
} from 'lucide-react';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  senders: Sender[];
  onSuccess: () => void;
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  isOpen,
  onClose,
  user,
  senders,
  onSuccess,
}) => {
  const [senderId, setSenderId] = useState<string>(senders[0]?.id || '');
  const [recipientInput, setRecipientInput] = useState<string>('');
  const [recipientsList, setRecipientsList] = useState<string[]>([
    'sarvagya.chaudhary@reachinbox.ai',
  ]);
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(10);
  const [attachments, setAttachments] = useState<{ name: string; size: string; url: string }[]>([]);

  // Send Later Popover state
  const [isSendLaterOpen, setIsSendLaterOpen] = useState<boolean>(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const csvFileRef = useRef<HTMLInputElement>(null);
  const attachmentFileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAddRecipient = () => {
    const trimmed = recipientInput.trim();
    if (trimmed && !recipientsList.includes(trimmed)) {
      setRecipientsList((prev) => [...prev, trimmed]);
      setRecipientInput('');
    }
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    setRecipientsList((prev) => prev.filter((e) => e !== emailToRemove));
  };

  // PapaParse CSV Bulk Upload Flow
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (results) => {
        const extractedEmails: string[] = [];
        results.data.forEach((row: any) => {
          if (Array.isArray(row)) {
            row.forEach((cell) => {
              if (typeof cell === 'string' && cell.includes('@') && cell.trim()) {
                extractedEmails.push(cell.trim());
              }
            });
          } else if (typeof row === 'object' && row !== null) {
            Object.values(row).forEach((val) => {
              if (typeof val === 'string' && val.includes('@') && val.trim()) {
                extractedEmails.push(val.trim());
              }
            });
          }
        });

        if (extractedEmails.length > 0) {
          const unique = Array.from(new Set([...recipientsList, ...extractedEmails]));
          setRecipientsList(unique);
          toast.success(`Imported ${extractedEmails.length} recipient email addresses from CSV!`);
        } else {
          toast.error('No valid email addresses found in the uploaded CSV file.');
        }
      },
      error: (err) => {
        toast.error(`CSV Parsing error: ${err.message}`);
      },
    });
  };

  const handleApplyPreset = (presetText: string) => {
    setSelectedPreset(presetText);
    const now = new Date();
    let target = new Date(now);

    if (presetText.includes('10:00 AM')) {
      target.setDate(target.getDate() + 1);
      target.setHours(10, 0, 0, 0);
    } else if (presetText.includes('11:00 AM')) {
      target.setDate(target.getDate() + 1);
      target.setHours(11, 0, 0, 0);
    } else if (presetText.includes('3:00 PM')) {
      target.setDate(target.getDate() + 1);
      target.setHours(15, 0, 0, 0);
    } else {
      target.setDate(target.getDate() + 1);
    }

    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hours = String(target.getHours()).padStart(2, '0');
    const minutes = String(target.getMinutes()).padStart(2, '0');
    setScheduledDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newItems = Array.from(files).map((f) => ({
      name: f.name,
      size: `${(f.size / 1024).toFixed(1)} KB`,
      url: URL.createObjectURL(f),
    }));
    setAttachments((prev) => [...prev, ...newItems]);
  };

  const handleSendOrSchedule = async () => {
    const finalRecipients = [...recipientsList];
    if (recipientInput.trim() && !finalRecipients.includes(recipientInput.trim())) {
      finalRecipients.push(recipientInput.trim());
    }

    if (finalRecipients.length === 0) {
      toast.error('Please add at least one recipient email address.');
      return;
    }
    if (!subject.trim()) {
      toast.error('Please enter an email subject.');
      return;
    }
    if (!body.trim()) {
      toast.error('Please write email body content.');
      return;
    }

    let scheduleTimeISO: string;
    if (scheduledDateTime) {
      scheduleTimeISO = new Date(scheduledDateTime).toISOString();
    } else {
      scheduleTimeISO = new Date(Date.now() + 60 * 1000).toISOString();
    }

    setSubmitting(true);
    try {
      const selectedSender = senders.find((s) => s.id === senderId)?.email || senders[0]?.email || user.email;

      const res = await api.scheduleEmails({
        userId: user.id,
        senderEmail: selectedSender,
        recipients: finalRecipients,
        subject,
        body,
        scheduledAt: scheduleTimeISO,
        delayBetweenEmailsMs: delayBetweenEmails * 1000,
      });

      toast.success(res.message || `Scheduled ${finalRecipients.length} emails successfully!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule emails');
    } finally {
      setSubmitting(false);
    }
  };

  const isScheduled = Boolean(scheduledDateTime);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-gray-200 flex flex-col max-h-[92vh] relative">
        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={csvFileRef}
          accept=".csv"
          onChange={handleCsvUpload}
          className="hidden"
        />
        <input
          type="file"
          ref={attachmentFileRef}
          multiple
          onChange={handleAttachmentUpload}
          className="hidden"
        />

        {/* Header - Back arrow + Title + Right Action Buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full transition"
              title="Close modal"
            >
              <ArrowLeft className="w-5 h-5 stroke-[1.5]" />
            </button>
            <h2 className="text-lg font-bold text-gray-900">Compose New Email</h2>
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Paperclip Icon */}
            <button
              type="button"
              onClick={() => attachmentFileRef.current?.click()}
              className="p-2 text-gray-400 hover:text-gray-600 transition rounded-full hover:bg-gray-50"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5 stroke-[1.5]" />
            </button>

            {/* Clock Icon (opens Send Later popover) */}
            <button
              type="button"
              onClick={() => setIsSendLaterOpen(!isSendLaterOpen)}
              className={`p-2 transition rounded-full ${
                isSendLaterOpen ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
              title="Send Later options"
            >
              <Clock className="w-5 h-5 stroke-[1.5]" />
            </button>

            {/* Primary Action Button ("Send" outline green vs "Send Later" once schedule picked) */}
            <button
              type="button"
              onClick={handleSendOrSchedule}
              disabled={submitting}
              className={`px-5 py-1.5 text-sm font-medium rounded-full transition flex items-center gap-2 ${
                isScheduled
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'border border-emerald-600 text-emerald-600 hover:bg-emerald-50 bg-white'
              }`}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isScheduled ? (
                'Send Later'
              ) : (
                'Send'
              )}
            </button>

            {/* "Send Later" Popover (anchored below clock icon) */}
            {isSendLaterOpen && (
              <div className="absolute right-12 top-12 z-50 w-72 bg-white rounded-2xl p-5 shadow-xl border border-gray-200 space-y-4 text-left">
                <h3 className="font-bold text-gray-900 text-sm">Send Later</h3>

                {/* Date & Time Picker */}
                <div className="relative">
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="bg-transparent outline-none w-full text-xs text-gray-800"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1 text-xs text-gray-600">
                  {['Tomorrow', 'Tomorrow, 10:00 AM', 'Tomorrow, 11:00 AM', 'Tomorrow, 3:00 PM'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleApplyPreset(item)}
                      className={`w-full text-left py-1.5 px-2.5 rounded-md transition ${
                        selectedPreset === item ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'hover:bg-gray-50'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {/* Popover Footer */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setScheduledDateTime('');
                      setSelectedPreset('');
                      setIsSendLaterOpen(false);
                    }}
                    className="text-xs font-medium text-gray-500 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSendLaterOpen(false);
                      toast.info(`Schedule time set for ${selectedPreset || 'selected time'}`);
                    }}
                    className="border border-emerald-600 text-emerald-600 hover:bg-emerald-50 rounded-full px-4 py-1 text-xs font-medium"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form Fields */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* "From" Row */}
          <div className="flex items-center gap-4">
            <span className="w-16 text-xs text-gray-400 font-medium">From</span>
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="bg-gray-50 text-gray-800 text-xs font-medium px-3.5 py-1.5 rounded-lg border-0 outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email}
                </option>
              ))}
              <option value="oliver.brown@domain.io">oliver.brown@domain.io</option>
            </select>
          </div>

          {/* "To" Row with Chips + CSV Upload Trigger */}
          <div className="flex items-start gap-4">
            <span className="w-16 text-xs text-gray-400 font-medium pt-2">To</span>
            <div className="flex-1 flex flex-wrap items-center gap-2 bg-gray-50 rounded-lg p-2 min-h-[40px]">
              {recipientsList.map((email) => (
                <span
                  key={email}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 text-xs font-medium flex items-center gap-1"
                >
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRecipient(email)}
                    className="hover:text-emerald-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <input
                type="email"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddRecipient();
                  }
                }}
                onBlur={handleAddRecipient}
                placeholder={recipientsList.length === 0 ? 'recipient@example.com' : 'Add email...'}
                className="flex-1 bg-transparent text-xs text-gray-800 outline-none min-w-[140px]"
              />

              {/* Upload List Trigger on the right */}
              <button
                type="button"
                onClick={() => csvFileRef.current?.click()}
                className="ml-auto text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 hover:underline px-2 py-0.5"
                title="Bulk import recipient list from CSV"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload List</span>
              </button>
            </div>
          </div>

          {/* "Subject" Row */}
          <div className="flex items-center gap-4">
            <span className="w-16 text-xs text-gray-400 font-medium">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-lg px-3.5 py-2 text-sm text-gray-900 outline-none transition"
            />
          </div>

          {/* Rate-Limit Configuration Row (Delay + Hourly Limit) */}
          <div className="flex items-center gap-6 text-xs text-gray-500 py-1">
            <div className="flex items-center gap-2">
              <span>Delay between 2 emails</span>
              <input
                type="number"
                min="0"
                value={delayBetweenEmails}
                onChange={(e) => setDelayBetweenEmails(Number(e.target.value))}
                placeholder="00"
                className="w-14 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-center font-mono text-gray-800 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span>sec</span>
            </div>

            <div className="flex items-center gap-2">
              <span>Hourly Limit</span>
              <input
                type="number"
                min="0"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                placeholder="00"
                className="w-14 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-center font-mono text-gray-800 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span>/hr</span>
            </div>
          </div>

          {/* Rich Text Editor Body Box */}
          <div className="bg-gray-50 rounded-2xl p-4 min-h-[260px] border border-gray-100 flex flex-col justify-between space-y-4">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type Your Reply..."
              className="w-full flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none resize-none min-h-[180px]"
            />

            {/* Rich Text Toolbar (icon-only, light gray row) */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200/80 text-gray-500 text-xs">
              <button type="button" className="hover:text-gray-800" title="Undo">
                <RotateCcw className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <button type="button" className="hover:text-gray-800" title="Redo">
                <RotateCw className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <span className="text-gray-300">|</span>
              <span className="font-serif font-bold hover:text-gray-800 cursor-pointer">Tt ˅</span>
              <button type="button" className="hover:text-gray-800" title="Bold">
                <Bold className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <button type="button" className="hover:text-gray-800" title="Italic">
                <Italic className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <button type="button" className="hover:text-gray-800" title="Underline">
                <Underline className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <span className="text-gray-300">|</span>
              <button type="button" className="hover:text-gray-800" title="Align Left">
                <AlignLeft className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <button type="button" className="hover:text-gray-800" title="Justify">
                <AlignJustify className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <span className="text-gray-300">|</span>
              <button type="button" className="hover:text-gray-800" title="Ordered List">
                <ListOrdered className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <button type="button" className="hover:text-gray-800" title="Unordered List">
                <List className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <button type="button" className="hover:text-gray-800" title="Indent">
                <Indent className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <button type="button" className="hover:text-gray-800" title="Outdent">
                <Outdent className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <button type="button" className="hover:text-gray-800" title="Blockquote">
                <Quote className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <button type="button" className="hover:text-gray-800" title="Strikethrough">
                <Strikethrough className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
            </div>
          </div>

          {/* Attachment Previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-2">
              {attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700"
                >
                  <span className="font-medium truncate max-w-[140px]">{file.name}</span>
                  <span className="text-gray-400 text-[10px]">{file.size}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    className="hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
