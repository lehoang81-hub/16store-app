'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const [mode, setMode] = useState<'magic' | 'password'>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'google'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirect = searchParams.get('redirect') ?? '/dashboard';

  // ── Google OAuth ──────────────────────────────────────────
  async function handleGoogleLogin() {
    setStatus('google');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    }
  }

  // ── Magic Link ────────────────────────────────────────────
  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    setErrorMsg('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
    if (error) { setStatus('error'); setErrorMsg(error.message); return; }
    setStatus('sent');
  }

  // ── Password ──────────────────────────────────────────────
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setStatus('sending');
    setErrorMsg('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setStatus('error'); setErrorMsg(error.message); return; }
    router.push(redirect);
    router.refresh();
  }

  if (status === 'sent') {
    return (
      <div className="text-center py-4">
        <div className="font-display text-[40px] text-rust mb-2">✓</div>
        <div className="font-display text-lg uppercase mb-3 tracking-[-0.01em]">Đã gửi</div>
        <p className="text-sm text-bone-2 leading-[1.5]">
          Kiểm tra hộp thư <strong className="text-bone">{email}</strong>.<br />
          Bấm vào đường dẫn trong email để hoàn tất đăng nhập.
        </p>
        <button
          onClick={() => { setStatus('idle'); setEmail(''); }}
          className="mt-6 font-mono text-[10px] text-concrete tracking-[0.18em] uppercase hover:text-bone transition-colors"
        >
          ← Dùng email khác
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Google OAuth — Primary CTA ── */}
      <button
        onClick={handleGoogleLogin}
        disabled={status === 'google'}
        className="w-full flex items-center justify-center gap-3 bg-bone text-ink py-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-5"
      >
        {status === 'google' ? (
          <>
            <span className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
            Đang chuyển hướng...
          </>
        ) : (
          <>
            {/* Google icon */}
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Tiếp tục với Google
          </>
        )}
      </button>

      {/* ── Divider ── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-line" />
        <span className="font-mono text-[9px] text-concrete tracking-[0.2em] uppercase">hoặc</span>
        <div className="flex-1 h-px bg-line" />
      </div>

      {/* ── Email fallback ── */}
      <div className="flex gap-0 mb-5 border border-line-strong">
        <button
          type="button"
          onClick={() => { setMode('magic'); setStatus('idle'); setErrorMsg(''); }}
          className={`flex-1 py-2 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors ${
            mode === 'magic' ? 'bg-rust text-ink' : 'text-bone-2 hover:text-bone'
          }`}
        >
          Magic Link
        </button>
        <button
          type="button"
          onClick={() => { setMode('password'); setStatus('idle'); setErrorMsg(''); }}
          className={`flex-1 py-2 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors ${
            mode === 'password' ? 'bg-rust text-ink' : 'text-bone-2 hover:text-bone'
          }`}
        >
          Password (Dev)
        </button>
      </div>

      <form onSubmit={mode === 'magic' ? handleMagicLink : handlePasswordLogin}>
        <label className="font-mono text-[10px] text-bone-2 tracking-[0.16em] uppercase block mb-2">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={status === 'sending'}
          placeholder="ban@example.com"
          className="w-full bg-ink border border-line-strong text-bone px-4 py-3 font-mono text-sm focus:border-rust focus:outline-none transition-colors disabled:opacity-50"
          autoComplete="email"
        />

        {mode === 'password' && (
          <>
            <label className="font-mono text-[10px] text-bone-2 tracking-[0.16em] uppercase block mb-2 mt-4">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={status === 'sending'}
              placeholder="••••••••"
              className="w-full bg-ink border border-line-strong text-bone px-4 py-3 font-mono text-sm focus:border-rust focus:outline-none transition-colors disabled:opacity-50"
              autoComplete="current-password"
            />
          </>
        )}

        {status === 'error' && (
          <div className="mt-3 font-mono text-[11px] text-rust tracking-[0.1em]">
            ⚠ {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'sending' || !email || (mode === 'password' && !password)}
          className="w-full mt-5 bg-rust text-ink py-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {status === 'sending'
            ? 'Đang xử lý...'
            : mode === 'magic'
              ? 'Gửi đường dẫn đăng nhập →'
              : 'Đăng nhập →'}
        </button>
      </form>
    </div>
  );
}
