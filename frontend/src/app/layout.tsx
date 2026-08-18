import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'ReachInbox — Email Scheduler & Executive Dashboard',
  description: 'Clean, high-throughput email scheduler built for ReachInbox',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased font-sans">
        <div className="min-h-screen flex flex-col">{children}</div>
        <Toaster position="top-right" theme="light" richColors closeButton />
      </body>
    </html>
  );
}
