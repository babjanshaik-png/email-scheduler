'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { User, Sender } from '@/lib/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface GoogleLoginModalProps {
  onLoginSuccess: (user: User, senders: Sender[]) => void;
}

export const GoogleLoginModal: React.FC<GoogleLoginModalProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('oliver.brown@domain.io');
  const [password, setPassword] = useState('••••••••••••');
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const handleEmailLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoadingDemo(true);
    try {
      const res = await api.demoLogin();
      const user: User = {
        id: res.user.id,
        email: email || res.user.email,
        name: email ? email.split('@')[0].replace('.', ' ') : res.user.name,
        avatar: res.user.avatar,
      };
      toast.success(`Logged in as ${user.email}`);
      onLoginSuccess(user, res.senders);
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleGoogleOAuth = async () => {
    setLoadingGoogle(true);
    try {
      const res = await api.googleLogin(
        'sarvagya.chaudhary@reachinbox.ai',
        'Sarvagya Chaudhary',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarvagya'
      );
      toast.success(`Logged in via Google OAuth as ${res.user.email}`);
      onLoginSuccess(res.user, res.senders);
    } catch (error: any) {
      toast.error(error.message || 'Google OAuth Login failed');
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* Centered White Card (max-w ~380px, rounded-2xl, border-gray-200, shadow-sm) */}
      <div className="w-full max-w-[380px] bg-white rounded-2xl border border-gray-200 p-7 shadow-sm">
        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">Login</h1>

        {/* Login with Google Button */}
        <button
          type="button"
          onClick={handleGoogleOAuth}
          disabled={loadingGoogle || loadingDemo}
          className="w-full py-2.5 px-4 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-gray-800 font-medium text-sm flex items-center justify-center gap-2.5 transition mb-5 disabled:opacity-50"
        >
          {loadingGoogle ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-700" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"
              />
            </svg>
          )}
          <span>Login with Google</span>
        </button>

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-gray-200 w-full"></div>
          <span className="bg-white px-2.5 text-xs text-gray-400 font-normal absolute">
            or sign up through email
          </span>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleEmailLogin} className="space-y-3">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email ID"
              className="w-full px-3.5 py-2.5 rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm border-0 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3.5 py-2.5 rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm border-0 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={loadingDemo || loadingGoogle}
            className="w-full mt-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition flex items-center justify-center disabled:opacity-50"
          >
            {loadingDemo ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Login'}
          </button>
        </form>

        {/* Evaluation One-Click Demo Button */}
        <div className="mt-4 pt-3 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={handleEmailLogin}
            disabled={loadingDemo || loadingGoogle}
            className="text-xs text-gray-500 hover:text-emerald-700 font-medium transition"
          >
            ⚡ One-Click Demo Account Login
          </button>
        </div>
      </div>
    </div>
  );
};
