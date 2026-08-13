import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { SessionContext } from './SessionContext';

type SessionState = 'loading' | 'authed' | 'anon';

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>('loading');
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setSession(data.authenticated ? 'authed' : 'anon');
        if (data.authenticated) setLoggedInUsername(data.username || null);
      })
      .catch(() => setSession('anon'));
  }, []);

  if (session === 'loading') return null;
  if (session === 'authed') {
    return <SessionContext.Provider value={loggedInUsername}>{children}</SessionContext.Provider>;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setLoggedInUsername(data.username || username);
        setSession('authed');
      } else {
        setError(data.error || 'Kirjautuminen epäonnistui.');
      }
    } catch {
      setError('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-sm p-6"
      >
        <h1 className="text-lg font-semibold text-slate-800 mb-1">Turvajohto OS</h1>
        <p className="text-sm text-slate-500 mb-4">Kirjaudu sisään jatkaaksesi.</p>
        <input
          type="text"
          autoFocus
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Käyttäjätunnus"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-slate-300"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Salasana"
          className={`w-full border rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-slate-300 ${
            error ? 'border-red-400' : 'border-slate-300'
          }`}
        />
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg py-2 mt-2 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Kirjaudutaan…' : 'Kirjaudu'}
        </button>
      </form>
    </div>
  );
}
