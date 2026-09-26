import { useEffect, useState } from 'react';
import { CheckCircle, KeyRound, UserPlus } from 'lucide-react';

import { buildFullName, kayttajatunnusNimesta } from '../nimet';
import { muotoileTunniste } from '../tunnisteet';
import type { KayttajaRivi, Tuote } from '../asetukset/Kayttajat';
import { KertaSalasana, type SalasanaNaytto } from './KertaSalasana';

// Työntekijän käyttäjätunnus työntekijäpankin lomakkeelta. Jaettu EVENT- ja
// GUARD-puolen kesken: rekisteri on yhteinen, joten tunnuksenkin on synnyttävä samalla
// tavalla kummalta puolelta tahansa.
//
// Yksi toimenpide luo tunnuksen VALMIIKSI KÄYTETTÄVÄKSI: tunnus, nimimerkki,
// tunnistenumero, kytkentä työntekijään, käyttäjätaso ja puolet. POST /api/users ei ota
// tasoa eikä puolia vastaan, joten ne asetetaan heti perään PUT-kutsulla — ilman sitä
// tunnus pääsisi kirjautumaan mutta ei näkisi mitään.
//
// Salasanaa EI kysytä: palvelin arpoo sen ja palauttaa kerran (server/index.js,
// POST /api/users ja /password). Käyttäjä vaihtaa sen ensimmäisellä kirjautumisella.
//
// Komponentti hakee itse tunnukset ja tasot. Molemmat reitit ovat pääkäyttäjärajattuja,
// joten kutsujan on näytettävä tämä vain pääkäyttäjälle.

type Tyontekija = {
  id?: string;
  firstName?: string;
  lastName?: string;
  displayId?: number | string | null;
};

type Props = {
  // Tallennettu työntekijä. Ilman id:tä tunnusta ei voi kytkeä, joten luonti odottaa
  // kunnes työntekijä on tallennettu.
  tyontekija: Tyontekija;
  // Kummalta puolelta avattiin: ratkaisee oletuspuolen, kuten käyttäjähallinnassa.
  puoli: Tuote;
  onMuuttui?: () => void;
};

const pyynto = async (polku: string, asetukset: RequestInit = {}) => {
  const r = await fetch(polku, { credentials: 'include', ...asetukset });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data?.ok) throw new Error(data?.error || 'Toiminto epäonnistui.');
  return data;
};

export const TyontekijanTunnus = ({ tyontekija, puoli, onMuuttui }: Props) => {
  const [kayttajat, setKayttajat] = useState<KayttajaRivi[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [ladattu, setLadattu] = useState(false);
  const [taso, setTaso] = useState('');
  const [tuotteet, setTuotteet] = useState<Tuote[]>([puoli]);
  const [virhe, setVirhe] = useState('');
  const [kesken, setKesken] = useState(false);
  const [salasana, setSalasana] = useState<SalasanaNaytto | null>(null);

  const hae = async () => {
    try {
      const [u, r] = await Promise.all([pyynto('/api/users'), pyynto('/api/roles')]);
      setKayttajat(u.users || []);
      setRoles(r.roles || []);
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Tunnusten haku epäonnistui.');
    } finally {
      setLadattu(true);
    }
  };

  useEffect(() => { hae(); }, []);

  const tunnus = kayttajatunnusNimesta(tyontekija);
  const numero = parseInt(String(tyontekija.displayId ?? ''), 10) || null;
  // Kytketty tunnus ensin: se on yksiselitteinen. Nimestä johdettu tunnus on varalla
  // vanhoille tunnuksille, jotka luotiin ennen kytkentää.
  const olemassa = (tyontekija.id && kayttajat.find((k) => k.employeeId === tyontekija.id))
    || kayttajat.find((k) => k.username === tunnus)
    || null;

  const luo = async () => {
    setVirhe('');
    if (!tyontekija.id) return setVirhe('Tallenna työntekijä ensin.');
    if (!tunnus) return setVirhe('Täytä ensin etunimi ja sukunimi — tunnus muodostetaan niistä.');
    if (!taso) return setVirhe('Valitse käyttäjätaso.');
    if (tuotteet.length === 0) return setVirhe('Valitse vähintään yksi puoli.');
    setKesken(true);
    try {
      const data = await pyynto('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: tunnus,
          nickname: buildFullName(tyontekija) || tunnus,
          ...(numero ? { displayId: numero } : {}),
          employeeId: tyontekija.id,
        }),
      });
      // Salasana näkyviin HETI: luonti on peruuttamaton ja salasana näkyy vain kerran,
      // joten epäonnistuva tason asetus ei saa viedä sitä mukanaan.
      setSalasana({ username: tunnus, password: data.password, syy: 'luotu' });
      try {
        await pyynto(`/api/users/${encodeURIComponent(tunnus)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleId: taso, tuotteet }),
        });
      } catch (e) {
        setVirhe(
          `Tunnus ${tunnus} luotiin, mutta tason tai puolten asetus epäonnistui `
          + `(${e instanceof Error ? e.message : 'tuntematon virhe'}). Aseta ne käyttäjähallinnasta.`,
        );
      }
      await hae();
      onMuuttui?.();
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Tunnuksen luonti epäonnistui.');
    } finally {
      setKesken(false);
    }
  };

  const nollaa = async (username: string) => {
    if (!window.confirm(`Nollataanko käyttäjän ${username} salasana? Vanha lakkaa toimimasta heti.`)) return;
    setVirhe('');
    setKesken(true);
    try {
      const data = await pyynto(`/api/users/${encodeURIComponent(username)}/password`, { method: 'POST' });
      setSalasana({ username, password: data.password, syy: 'nollattu' });
      await hae();
      onMuuttui?.();
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Nollaus epäonnistui.');
    } finally {
      setKesken(false);
    }
  };

  const vaihdaTuote = (t: Tuote) =>
    setTuotteet((ed) => (ed.includes(t) ? ed.filter((x) => x !== t) : [...ed, t]));

  const rivi = (otsikko: string, arvo: React.ReactNode) => (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">{otsikko}</span>
      <span className="text-sm text-ink-strong text-right min-w-0 break-words">{arvo}</span>
    </div>
  );

  return (
    <div className="space-y-4 text-left">
      <div className="bg-sunken border border-line rounded-lg p-4 space-y-2">
        {rivi('Nimi', buildFullName(tyontekija) || '—')}
        {rivi('Käyttäjätunnus', <span className="font-mono font-bold">{olemassa?.username || tunnus || '—'}</span>)}
        {rivi('Tunnistenumero', <span className="font-mono font-bold">{numero ? muotoileTunniste(numero) : '—'}</span>)}
      </div>

      {virhe && (
        <p className="text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">{virhe}</p>
      )}
      {salasana && <KertaSalasana key={salasana.password} {...salasana} onSulje={() => setSalasana(null)} />}

      {!ladattu ? (
        <p className="text-sm text-ink-muted">Haetaan tunnuksia…</p>
      ) : olemassa ? (
        <div className="space-y-3">
          <div className="bg-success-soft border border-success/30 rounded-lg p-3 flex gap-2.5">
            <CheckCircle size={16} className="text-success-ink shrink-0 mt-0.5" />
            <div className="text-xs text-success-ink leading-relaxed space-y-0.5">
              <p className="font-medium">Tunnus on olemassa.</p>
              <p>Taso: {olemassa.roleName || roles.find((r) => r.id === olemassa.roleId)?.name || 'ei tasoa'}</p>
              <p>Puolet: {(olemassa.tuotteet || []).map((t) => t.toUpperCase()).join(', ') || '—'}</p>
              <p>
                {olemassa.last_login_at
                  ? `Viimeksi kirjautunut ${new Date(olemassa.last_login_at).toLocaleString('fi-FI')}`
                  : 'Ei ole vielä kirjautunut.'}
              </p>
              <p className="pt-1 text-ink-muted">Tason, puolet ja Authenticatorin voi muuttaa Sovellusasetukset → Käyttäjätunnukset.</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => nollaa(olemassa.username)}
              disabled={kesken}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-body bg-surface border border-line hover:bg-sunken disabled:opacity-60 rounded-lg transition-colors"
            >
              <KeyRound size={16} />
              {kesken ? 'Nollataan…' : 'Nollaa salasana'}
            </button>
          </div>
        </div>
      ) : !tyontekija.id ? (
        <p className="text-sm text-ink-muted">
          Tallenna työntekijä ensin. Tunnus kytketään tallennettuun työntekijään ja hänen
          tunnistenumeroonsa.
        </p>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="block text-sm font-medium text-ink-body mb-1">Käyttäjätaso</span>
            <select
              value={taso}
              onChange={(e) => setTaso(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface p-2.5 text-sm"
            >
              <option value="">Valitse taso…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <div>
            <span className="block text-sm font-medium text-ink-body mb-1">Puolet</span>
            <div className="flex flex-wrap gap-4">
              {(['guard', 'event'] as Tuote[]).map((t) => (
                <label key={t} className="inline-flex items-center gap-2 text-sm text-ink-body">
                  <input type="checkbox" checked={tuotteet.includes(t)} onChange={() => vaihdaTuote(t)} />
                  {t === 'guard' ? 'GUARD (vartiointi)' : 'EVENT (tapahtumat)'}
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Palvelin arpoo väliaikaisen salasanan, joka näytetään kerran. Käyttäjä vaihtaa sen
            ja ottaa Authenticatorin käyttöön ensimmäisellä kirjautumisella.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={luo}
              disabled={kesken || !tunnus}
              className="inline-flex items-center gap-2 px-4 py-2 bg-action hover:bg-action-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors"
            >
              <UserPlus size={16} />
              {kesken ? 'Luodaan…' : 'Luo käyttäjätunnus'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
