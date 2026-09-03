import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { SessionContext, type SessionProfile, type Tuote } from './SessionContext';
import { lueIstunto, tallennaIstunto, unohdaIstunto } from './shared/istunto';

type SessionState = 'loading' | 'authed' | 'anon';

const TUOTTEEN_NIMI: Record<Tuote, string> = {
  event: 'Turvajohto EVENT',
  guard: 'Turvajohto GUARD',
};

// Viimeisin onnistunut istunto laitteella. Tarvitaan offline-käynnistykseen: ilman
// tätä koko offline-tuki jäisi saavuttamatta, koska istuntokyselyn epäonnistuminen
// veisi kirjautumislomakkeelle vaikka vartija on kirjautunut ja työtiedot ovat
// laitteella. Tämä löytyi vasta kun offline testattiin oikeasti backend alhaalla.
//
// TÄMÄ EI OLE PÄÄSYNHALLINTAA. Palvelin tarkistaa istunnon jokaisessa pyynnössä, ja
// offline-tilassa mitään ei saada palvelimelta — kirjaukset menevät lähtevään jonoon,
// jonka palvelin torjuu 401:llä jos istunto on oikeasti vanhentunut. Tallenne on siis
// pelkkä käyttöliittymän lupa avautua, ei oikeus dataan.
async function loadSessionProfile(): Promise<SessionProfile | null> {
  const res = await fetch('/api/session', { credentials: 'include' });
  const data = await res.json();
  if (!data.authenticated) {
    // Palvelin vastasi ja kertoi ettei istuntoa ole: tallenne on vanhentunut eikä sitä
    // saa käyttää. Vain YHTEYDEN puute oikeuttaa offline-käynnistykseen.
    unohdaIstunto();
    return null;
  }
  const profiili: SessionProfile = {
    username: data.username,
    nickname: data.nickname || data.username,
    role: data.role || 'user',
    displayId: typeof data.displayId === 'number' ? data.displayId : null,
    employeeId: data.employeeId || null,
    roleId: data.roleId || null,
    roleName: data.roleName || null,
    mustChangePassword: !!data.mustChangePassword,
    tuotteet: Array.isArray(data.tuotteet) && data.tuotteet.length > 0 ? data.tuotteet : ['event'],
    permissions: data.permissions || {},
    lastLoginAt: data.lastLoginAt || null,
  };
  tallennaIstunto(profiili);
  return profiili;
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
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-line rounded-xl shadow-sm p-6">
        <h1 className="text-lg font-semibold text-ink-strong mb-1">Vaihda salasana</h1>
        <p className="text-sm text-ink-muted mb-4">
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
          className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-line-strong"
        />
        <input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Uusi salasana"
          className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-line-strong"
        />
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Vahvista uusi salasana"
          className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-line-strong"
        />
        <p className="text-xs text-ink-subtle mb-2">
          Vähintään 10 merkkiä, iso ja pieni kirjain sekä numero.
        </p>
        {error && <p className="text-sm text-danger mb-2">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-action hover:bg-action-hover text-white text-sm font-medium rounded-lg py-2 mt-2 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Tallennetaan…' : 'Aseta salasana ja jatka'}
        </button>
      </form>
    </div>
  );
}

// Kirjautunut käyttäjä, jolla ei ole pääsyä juuri tälle puolelle. Uloskirjautumista ei
// tarjota ensisijaisena: useimmiten kyse on väärästä osoitteesta, ei väärästä tunnuksesta.
function EiPaasyaTuotteeseen({ tuote, profile }: { tuote: Tuote; profile: SessionProfile }) {
  const sallittu = profile.tuotteet[0];
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md bg-surface border border-line rounded-xl shadow-sm p-6 text-center">
        <ShieldAlert className="w-10 h-10 text-warning mx-auto mb-4" strokeWidth={1.75} />
        <h1 className="text-lg font-semibold text-ink-strong mb-2">
          Ei käyttöoikeutta puolelle {TUOTTEEN_NIMI[tuote]}
        </h1>
        <p className="text-sm text-ink-muted leading-relaxed mb-6">
          Olet kirjautunut tunnuksella <strong className="text-ink">{profile.nickname}</strong>,
          mutta sille ei ole myönnetty pääsyä tälle puolelle. Pääkäyttäjä voi lisätä oikeuden
          käyttäjähallinnasta.
        </p>
        {sallittu && sallittu !== tuote && (
          <a
            href={`/${sallittu}`}
            className="inline-block bg-action hover:bg-action-hover text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            Siirry puolelle {TUOTTEEN_NIMI[sallittu]}
          </a>
        )}
        <a href="/" className="block text-xs text-ink-subtle hover:text-ink-muted mt-4 transition-colors">
          Turvajohto OS – etusivu
        </a>
      </div>
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
      .catch(() => {
        // Istuntokyselyä ei saatu läpi. Jos laitteella on tuore onnistunut istunto,
        // avataan sovellus sen tiedoilla — muuten kirjautumislomake.
        const tallennettu = lueIstunto();
        if (tallennettu) {
          setProfile(tallennettu);
          setSession('authed');
        } else {
          setSession('anon');
        }
      });
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
    // Sama tunnus käy molempiin puoliin, mutta pääsy myönnetään puolikohtaisesti
    // (server/index.js: paaseeTuotteisiin). Ilman tätä väärälle puolelle päätynyt näkisi
    // tyhjän tai puolittain toimivan sovelluksen sen sijaan että saisi tietää syyn.
    if (!profile.tuotteet.includes(tuote)) {
      return <EiPaasyaTuotteeseen tuote={tuote} profile={profile} />;
    }
    return <SessionContext.Provider value={profile}>{children}</SessionContext.Provider>;
  }

  // Kirjautumislomake on yhteinen, mutta sen pitää kertoa kumman puolen portilla
  // ollaan — sama tunnus käy molempiin, joten pelkkä "Turvajohto OS" jättäisi
  // käyttäjän arvailemaan mihin hän on kirjautumassa.
  // Värit tulevat teemasta (data-tuote), mutta valinta accentin ja actionin välillä on
  // tuotekohtainen suunnitteluratkaisu eikä väriarvo: GUARDilla kirjautumisnappi kantaa
  // tunnusvärin, EVENTillä se on nykyiseen tapaan tumma perusnappi.
  const guard = tuote === 'guard';
  const nappiTyyli = guard
    ? 'bg-accent hover:bg-accent-hover'
    : 'bg-action hover:bg-action-hover';

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
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-line rounded-xl shadow-sm p-6"
      >
        <h1 className="text-lg font-semibold text-ink-strong mb-1">
          Turvajohto <span className={guard ? 'text-accent' : 'text-ink-muted'}>{guard ? 'GUARD' : 'EVENT'}</span>
        </h1>

        {expiredNotice && (
          <p className="text-sm text-warning-ink bg-warning-soft border border-warning/30 rounded-lg px-3 py-2 mb-3">
            Istuntosi päättyi. Kirjaudu uudelleen jatkaaksesi.
          </p>
        )}

        {!totpRequired ? (
          <>
            <p className="text-sm text-ink-muted mb-4">Kirjaudu sisään jatkaaksesi.</p>
            <input
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Käyttäjätunnus"
              className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-line-strong"
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Salasana"
              className={`w-full border rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-line-strong ${
                error ? 'border-danger' : 'border-line-strong'
              }`}
            />
          </>
        ) : (
          <>
            <p className="text-sm text-ink-muted mb-4">
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
              className={`w-full border rounded-lg px-3 py-2 text-center text-lg tracking-[0.5em] font-mono mb-2 outline-none focus:ring-2 focus:ring-line-strong ${
                error ? 'border-danger' : 'border-line-strong'
              }`}
            />
          </>
        )}

        {error && <p className="text-sm text-danger mb-2">{error}</p>}

        <button
          type="submit"
          disabled={submitting || (totpRequired && totpCode.length !== 6)}
          className={`w-full ${nappiTyyli} text-white text-sm font-medium rounded-lg py-2 mt-2 transition-all disabled:opacity-60`}
        >
          {submitting ? 'Kirjaudutaan…' : totpRequired ? 'Vahvista koodi' : 'Kirjaudu'}
        </button>

        <a
          href="/"
          className="block text-center text-xs text-ink-subtle hover:text-ink-muted mt-4 transition-colors"
        >
          Turvajohto OS – etusivu
        </a>

        {totpRequired && (
          <button
            type="button"
            onClick={handleBackToPassword}
            className="w-full text-xs text-ink-subtle hover:text-ink-muted mt-3 transition-colors"
          >
            Takaisin
          </button>
        )}
      </form>
    </div>
  );
}
