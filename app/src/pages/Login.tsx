import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { ErrorNote } from '../components/ui';

export default function Login() {
  const { session } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');

  if (session) return <Navigate to={(location.state as { from?: string })?.from ?? '/'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice('');
    const res =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    setBusy(false);
    if (res.error) return setError(res.error);
    if (mode === 'signup' && !res.data.session) setNotice('Check your email to confirm your account, then sign in.');
  }

  async function reset() {
    if (!email) return setError(new Error('Enter your email first.'));
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) setError(error);
    else setNotice('Password reset email sent.');
  }

  return (
    <div className="grid min-h-screen place-items-center bg-stone-100 px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-7 shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
          <span className="font-serif text-2xl">Artfolio</span>
        </div>
        <p className="text-sm text-stone-500">
          {mode === 'signin' ? 'Sign in to your artwork inventory.' : 'Create an account to start cataloguing.'}
        </p>
        {mode === 'signup' && (
          <div>
            <label className="label" htmlFor="name">Your name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <ErrorNote error={error} />
        {notice && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <div className="flex justify-between text-xs text-stone-500">
          <button type="button" className="underline" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Create an account' : 'I already have an account'}
          </button>
          {mode === 'signin' && <button type="button" className="underline" onClick={reset}>Forgot password?</button>}
        </div>
      </form>
    </div>
  );
}
