import { useEffect, useState } from 'react';
import { KeyRound, Mail, MessageSquare, RefreshCw, Trash2 } from 'lucide-react';

import { useKayttajanOikeudet } from '../../event/useKayttajanOikeudet';
import { KayttajanOikeudet } from '../../event/nakymat/KayttajaHallinta';
import type { KayttajaRivi, Tapahtuma } from '../../event/tyypit';
import { DEFAULT_BUCKET } from '../oikeudet';

// Olemassa olevan tunnuksen koko hallinta työntekijäpankin osiossa 10.
//
// YKSI PAIKKA (päätös 27.9.2026): jokainen tunnus kuuluu henkilölle pankissa, ja tunnusta
// hallitaan vain täältä. Sovellusasetusten ja EVENTin käyttäjälistat ovat pelkkiä
// yleiskatsauksia, joista pääsee tänne.
//
// Oikeudet (nimimerkki, taso, puolet, tapahtumarajaus, Authenticator-vaatimus,
// uloskirjaus) tulevat EVENTin oikeusnäkymästä sellaisenaan. Salasanan ja
// Authenticatorin nollaus ovat tässä omina toimintoinaan, koska niihin kuuluu uuden
// salasanan tai avaimen toimitus työntekijälle (server/tunnuslahetys.js).

export type Toimituslahetys = { sahkoposti: boolean; sms: boolean };

type Props = {
  kayttaja: KayttajaRivi;
  // Toimitusvalinnat ja raportti tulevat kutsujalta (TyontekijanTunnus), jotta sama
  // valintalohko ja sama raportti palvelevat luontia ja nollausta.
  valinnat: React.ReactNode;
  lahetys: () => Toimituslahetys;
  onEmail: boolean;
  onSalasanaNollattu: (salasana: string, toimitus: unknown) => void;
  onAvainNollattu: (toimitus: unknown) => void;
  onPoistettu: () => void;
  // Tallennus tai peruutus oikeusnäkymässä.
  onValmis: () => void;
  puoli: 'event' | 'guard';
};

const pyynto = async (polku: string, asetukset: RequestInit = {}) => {
  const r = await fetch(polku, { credentials: 'include', ...asetukset });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data?.ok) throw new Error(data?.error || 'Toiminto epäonnistui.');
  return data;
};

type Taso = { id: string; name: string; builtin?: boolean; description?: string; permissions?: Record<string, Record<string, { view?: boolean; edit?: boolean }>> };

export const TunnuksenHallinta = ({
  kayttaja, valinnat, lahetys, onEmail, onSalasanaNollattu, onAvainNollattu, onPoistettu, onValmis, puoli,
}: Props) => {
  const [tasot, setTasot] = useState<Taso[]>([]);
  const [tasotLatautuu, setTasotLatautuu] = useState(true);
  const [tapahtumat, setTapahtumat] = useState<Tapahtuma[]>([]);
  const [kesken, setKesken] = useState<'' | 'salasana' | 'avain' | 'poisto'>('');
  const [virhe, setVirhe] = useState('');
  const [avainSahkopostiin, setAvainSahkopostiin] = useState(onEmail);

  const oikeudet = useKayttajanOikeudet({
    onUusiSalasana: () => {},
    onAvattu: () => {},
    onSuljettu: onValmis,
    onHaeTasot: () => {},
  });

  useEffect(() => {
    oikeudet.avaa(kayttaja);
    pyynto('/api/roles')
      .then((d) => setTasot(d.roles || []))
      .catch(() => setTasot([]))
      .finally(() => setTasotLatautuu(false));
    // Tapahtumarajausta varten. GUARD-puolella tapahtumia ei muuten ladata.
    pyynto('/api/data/events')
      .then((d) => setTapahtumat(Array.isArray(d.data) ? d.data : []))
      .catch(() => setTapahtumat([]));
    // Avataan kerran per tunnus; hook omistaa muokkaustilan sen jälkeen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kayttaja.username]);

  // Sama päättely kuin App.tsx:n tasonPuolet: mitkä puolet valittu taso edellyttää.
  const tasonPuolet = (roleId: string): string[] => {
    const bucket = tasot.find((r) => r.id === roleId)?.permissions?.[DEFAULT_BUCKET] || {};
    const solmut = Object.keys(bucket).filter((id) => bucket[id]?.view || bucket[id]?.edit);
    if (solmut.includes('*')) return ['event', 'guard'];
    const puolet: string[] = [];
    if (solmut.some((id) => !id.startsWith('guard_'))) puolet.push('event');
    if (solmut.some((id) => id.startsWith('guard_'))) puolet.push('guard');
    return puolet;
  };

  const admin = kayttaja.role === 'admin';

  const nollaaSalasana = async () => {
    if (!window.confirm(`Nollataanko käyttäjän ${kayttaja.username} salasana? Vanha lakkaa toimimasta heti.`)) return;
    setKesken('salasana');
    setVirhe('');
    try {
      const data = await pyynto(`/api/users/${encodeURIComponent(kayttaja.username)}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lahetys: lahetys(), puoli }),
      });
      onSalasanaNollattu(data.password, data.toimitus || null);
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Nollaus epäonnistui.');
    } finally {
      setKesken('');
    }
  };

  const nollaaAvain = async () => {
    if (!window.confirm(`Nollataanko käyttäjän ${kayttaja.username} Authenticator? Vanha avain lakkaa toimimasta heti.`)) return;
    setKesken('avain');
    setVirhe('');
    try {
      const data = await pyynto(`/api/users/${encodeURIComponent(kayttaja.username)}/totp/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lahetys: { sahkoposti: avainSahkopostiin && onEmail }, puoli }),
      });
      onAvainNollattu(data.toimitus || null);
      // Oikeusnäkymän QR ja avain päivittyvät uuteen.
      oikeudet.avaa({ ...kayttaja, ...oikeudet.muokattava });
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Nollaus epäonnistui.');
    } finally {
      setKesken('');
    }
  };

  const poista = async () => {
    if (!window.confirm(
      `Poistetaanko tunnus ${kayttaja.username} pysyvästi?\n\n`
      + 'Kirjautuminen lakkaa heti. Henkilön tiedot säilyvät työntekijäpankissa, ja jo '
      + 'tehdyt kirjaukset säilyvät ennallaan.',
    )) return;
    setKesken('poisto');
    setVirhe('');
    try {
      await pyynto(`/api/users/${encodeURIComponent(kayttaja.username)}`, { method: 'DELETE' });
      onPoistettu();
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Poisto epäonnistui.');
      setKesken('');
    }
  };

  return (
    <div className="space-y-5">
      {virhe && (
        <p className="text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">{virhe}</p>
      )}

      <div className="border border-line rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
          <KeyRound size={16} className="text-accent" />
          Salasana ja Authenticator
        </h3>
        {valinnat}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={nollaaSalasana}
            disabled={kesken !== ''}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-ink-body bg-surface border border-line hover:bg-sunken disabled:opacity-60 rounded-lg"
          >
            <MessageSquare size={15} />
            {kesken === 'salasana' ? 'Nollataan…' : 'Nollaa salasana'}
          </button>
        </div>
        {!admin && (
          <div className="border-t border-line-soft pt-3 space-y-2">
            <label className="flex items-start gap-2 text-sm text-ink-body">
              <input
                type="checkbox"
                className="mt-1"
                checked={avainSahkopostiin && onEmail}
                disabled={!onEmail}
                onChange={(e) => setAvainSahkopostiin(e.target.checked)}
              />
              <span>
                <Mail size={14} className="inline mr-1 text-ink-subtle" />
                Lähetä uusi Authenticator-avain sähköpostiin
                {!onEmail && <span className="text-ink-muted"> (sähköposti puuttuu)</span>}
              </span>
            </label>
            <button
              type="button"
              onClick={nollaaAvain}
              disabled={kesken !== ''}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-ink-body bg-surface border border-line hover:bg-sunken disabled:opacity-60 rounded-lg"
            >
              <RefreshCw size={15} />
              {kesken === 'avain' ? 'Nollataan…' : 'Nollaa Authenticator'}
            </button>
          </div>
        )}
      </div>

      {oikeudet.muokattava && (
        <KayttajanOikeudet
          upotettu
          muokattava={oikeudet.muokattava}
          nimimerkki={oikeudet.nimimerkki}
          onNimimerkki={oikeudet.setNimimerkki}
          taso={oikeudet.taso}
          onTaso={oikeudet.setTaso}
          tasot={tasot}
          tasotLatautuu={tasotLatautuu}
          tasonPuolet={tasonPuolet}
          tuotteet={oikeudet.tuotteet}
          onTuote={oikeudet.vaihdaTuote}
          onLisaaPuolet={oikeudet.lisaaPuolet}
          tapahtumaPaasy={oikeudet.tapahtumaPaasy}
          onTapahtumaPaasy={oikeudet.vaihdaTapahtumaPaasy}
          tapahtumat={tapahtumat}
          totp={{ ...oikeudet.totp, onNollaa: undefined }}
          uloskirjaus={oikeudet.uloskirjaus}
          tallennus={oikeudet.tallennus}
          onPeruuta={oikeudet.sulje}
        />
      )}

      <div className="border border-danger/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="flex-1 text-sm text-ink-body">
          Poista tunnus, jos henkilö ei enää tarvitse pääsyä. Henkilön tiedot jäävät pankkiin.
        </p>
        <button
          type="button"
          onClick={poista}
          disabled={kesken !== ''}
          className="shrink-0 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-danger-ink border border-danger/40 hover:bg-danger-soft disabled:opacity-60 rounded-lg"
        >
          <Trash2 size={15} />
          {kesken === 'poisto' ? 'Poistetaan…' : 'Poista tunnus'}
        </button>
      </div>
    </div>
  );
};
