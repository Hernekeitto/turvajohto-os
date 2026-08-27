import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { SessionContext, type SessionProfile } from './SessionContext';

type SessionState = 'loading' | 'authed' | 'anon';

// Kumman tuotteen portilla ollaan. Ratkaistaan osoiterivistä (ks. main.tsx).
type Tuote = 'event' | 'guard';

async function loadSessionProfile(): Promise<SessionProfile | null> {
  const res = await fetch('/api/session', { credentials: 'include' });
  const data = await res.json();
  if (!data.authenticated) return null;
  return {
    username: data.username,
    nickname: data.nickname || data.username,
    role: data.role || 'user',
    displayId: typeof data.displayId === 'number' ? data.displayId : null,
    employeeId: data.employeeId || null,
    roleId: data.roleId || null,
    roleName: data.roleName || null,
    mustChangePassword: !!data.mustChangePassword,
    permissions: data.permissions || {},
    lastLoginAt: data.lastLoginAt || null,
  };
}

// Pakotettu salasanan vaihto. Näytetään kirjautumisen JÄLKEEN mutta ennen sovellusta,
// kun pääkäyttäjä on asettanut väliaikaisen salasanan. Palvelin torjuu kaiken muun
// liikenteen 403:lla siihen asti (server/index.js: requireAuth), joten tämä ei ole
// pelkkä kehotus vaan käyttöliittymän puoli oikeasta portista.
function ForcedPasswordChange({ onDone }: { onDone: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Uudet salasanat eivät täsmää.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.ok) onDone();
      else setError(data.error || 'Salasanan vaihto epäonnistui.');
    } catch {
      setError('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h1 className="text-lg font-semibold text-slate-800 mb-1">Vaihda salasana</h1>
        <p className="text-sm text-slate-500 mb-4">
          Käytössäsi on pääkäyttäjän asettama väliaikainen salasana. Aseta oma salasanasi
          ennen kuin jatkat.
        </p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Väliaikainen salasana"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-slate-300"
        />
        <input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Uusi salasana"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-slate-300"
        />
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Vahvista uusi salasana"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-slate-300"
        />
        <p className="text-xs text-slate-400 mb-2">
          Vähintään 10 merkkiä, iso ja pieni kirjain sekä numero.
        </p>
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg py-2 mt-2 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Tallennetaan…' : 'Aseta salasana ja jatka'}
        </button>
      </form>
    </div>
  );
}

export default function PasswordGate({ children, tuote = 'event' }: { children: ReactNode; tuote?: Tuote }) {
  const [session, setSession] = useState<SessionState>('loading');
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Pääkäyttäjä ei koskaan tarvitse tätä vaihetta — muilta vaaditaan Authenticator-koodi
  // vasta kun käyttäjätunnus+salasana on jo tarkistettu oikeiksi.
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Näytetään kerran jos tänne palattiin siksi että istunto mitätöityi taustalla
  // (admin painoi "Kirjaa käyttäjä ulos", käyttämättömyyskatkaisu ehti, tms.) —
  // ilman tätä käyttäjä näkisi vain tyhjän kirjautumislomakkeen selittämättä miksi.
  const [expiredNotice, setExpiredNotice] = useState(false);
  const totpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('tj_session_expired')) {
        setExpiredNotice(true);
        sessionStorage.removeItem('tj_session_expired');
      }
    } catch { /* ei kriittinen */ }
    loadSessionProfile()
      .then((p) => {
        setProfile(p);
        setSession(p ? 'authed' : 'anon');
      })
      .catch(() => setSession('anon'));
  }, []);

  useEffect(() => {
    if (totpRequired) totpInputRef.current?.focus();
  }, [totpRequired]);

  if (session === 'loading') return null;
  if (session === 'authed' && profile) {
    if (profile.mustChangePassword) {
      return (
        <ForcedPasswordChange
          onDone={() => {
            // Profiili haetaan uudelleen, jotta mustChangePassword päivittyy falseksi
            // ja sovellus aukeaa ilman uudelleenkirjautumista.
            loadSessionProfile()
              .then((p) => {
                setProfile(p);
                setSession(p ? 'authed' : 'anon');
              })
              .catch(() => setSession('anon'));
          }}
        />
      );
    }
    return <SessionContext.Provider value={profile}>{children}</SessionContext.Provider>;
  }

  // Kirjautumislomake on yhteinen, mutta sen pitää kertoa kumman puolen portilla
  // ollaan — sama tunnus käy molempiin, joten pelkkä "Turvajohto OS" jättäisi
  // käyttäjän arvailemaan mihin hän on kirjautumassa.
  const guard = tuote === 'guard';
  const nappiTyyli = guard
    ? 'bg-guard-accent hover:brightness-110'
    : 'bg-slate-800 hover:bg-slate-700';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, totpCode: totpRequired ? totpCode : undefined }),
      });
      const data = await res.json();
      if (data.requiresTotp) {
        // Joko ensimmäinen vaihe juuri tarkistettiin oikeaksi (ei vielä koodia), tai
        // annettu koodi oli väärä/vanhentunut — kummassakin tapauksessa pysytään
        // koodinäkymässä ja näytetään mahdollinen virhe.
        setTotpRequired(true);
        setTotpCode('');
        setError(res.ok ? '' : data.error || 'Väärä Authenticator-koodi.');
      } else if (res.ok && data.ok) {
        const p = await loadSessionProfile();
        setProfile(p);
        setSession(p ? 'authed' : 'anon');
      } else {
        setError(data.error || 'Kirjautuminen epäonnistui.');
      }
    } catch {
      setError('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToPassword = () => {
    setTotpRequired(false);
    setTotpCode('');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-sm p-6"
      >
        <h1 className="text-lg font-semibold text-slate-800 mb-1">
          Turvajohto <span className={guard ? 'text-guard-accent' : 'text-slate-500'}>{guard ? 'GUARD' : 'EVENT'}</span>
        </h1>

        {expiredNotice && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            Istuntosi päättyi. Kirjaudu uudelleen jatkaaksesi.
          </p>
        )}

        {!totpRequired ? (
          <>
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
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Syötä Authenticator-sovelluksen näyttämä 6-numeroinen koodi.
            </p>
            <input
              ref={totpInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className={`w-full border rounded-lg px-3 py-2 text-center text-lg tracking-[0.5em] font-mono mb-2 outline-none focus:ring-2 focus:ring-slate-300 ${
                error ? 'border-red-400' : 'border-slate-300'
              }`}
            />
          </>
        )}

        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

        <button
          type="submit"
          disabled={submitting || (totpRequired && totpCode.length !== 6)}
          className={`w-full ${nappiTyyli} text-white text-sm font-medium rounded-lg py-2 mt-2 transition-all disabled:opacity-60`}
        >
          {submitting ? 'Kirjaudutaan…' : totpRequired ? 'Vahvista koodi' : 'Kirjaudu'}
        </button>

        <a
          href="/"
          className="block text-center text-xs text-slate-400 hover:text-slate-600 mt-4 transition-colors"
        >
          Turvajohto OS – etusivu
        </a>

        {totpRequired && (
          <button
            type="button"
            onClick={handleBackToPassword}
            className="w-full text-xs text-slate-400 hover:text-slate-600 mt-3 transition-colors"
          >
            Takaisin
          </button>
        )}
      </form>
    </div>
  );
}
