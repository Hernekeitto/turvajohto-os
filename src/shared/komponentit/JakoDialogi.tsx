// Tiedoston jakodialogi GUARD-puolelle (28.9.2026).
//
// Samat säännöt kuin tapahtuman tiedostojen jaossa (App.tsx: jakoModal) ja sama
// palvelinreitti (POST /api/shares): jakotapa linkki / linkki ja salasana / nimetyt
// käyttäjät, voimassaolo, latausraja ja pysyvän linkin pääkäyttäjähyväksyntä.
// Henkilötietoa sisältävää ei voi jakaa pelkällä linkillä, ja sen voimassaolo on
// enintään 7 vuorokautta — palvelin valvoo samat rajat (server/shares.js).
//
// Oma komponenttinsa eikä App.tsx:n dialogi, koska se on sidottu tapahtumanäkymän tilaan.
import { useEffect, useState } from 'react';
import { AlertTriangle, Info, Share2, ShieldAlert, X } from 'lucide-react';
import { NykyisetJaot } from './NykyisetJaot';
import { EditoriOikeusValinta } from './EditoriOikeusValinta';
import type { EditoriOikeus } from '../editori';

export type JaonLahde = 'eventFiles' | 'guardFiles' | 'personalFiles';

type Props = {
  kohde: { id: string; name: string; henkilotietoa: boolean };
  lahde: JaonLahde;
  // Nimetyille käyttäjille jakaminen. Lista tulee reitiltä /api/jako/kayttajat (tunnus ja
  // näyttönimi kaikille kirjautuneille, 29.9.2026).
  saaValitaKayttajia: boolean;
  onSulje: () => void;
  onJaettu: () => void;
};

type Tapa = 'link' | 'password' | 'users';


const VOIMASSA = [
  { arvo: '0.5', label: '12 h', tunnit: 12 },
  { arvo: '2', label: '48 h', tunnit: 48 },
  { arvo: '7', label: '7 vrk', tunnit: 24 * 7 },
  { arvo: '30', label: '30 vrk', tunnit: 24 * 30 },
  { arvo: '65', label: '65 vrk', tunnit: 24 * 65 },
];

export const jakolinkinOsoite = (token: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL}jako.html#${token}`;

type Kayttaja = { username: string; nickname: string };

export const JakoDialogi = ({ kohde, lahde, saaValitaKayttajia, onSulje, onJaettu }: Props) => {
  const [tapa, setTapa] = useState<Tapa>(kohde.henkilotietoa ? 'password' : 'link');
  const [salasana, setSalasana] = useState('');
  const [kayttajat, setKayttajat] = useState<Kayttaja[]>([]);
  const [valitut, setValitut] = useState<string[]>([]);
  const [voimassa, setVoimassa] = useState('7');
  const [omaPvm, setOmaPvm] = useState('');
  const [omaKlo, setOmaKlo] = useState('12:00');
  const [maxLataukset, setMaxLataukset] = useState('');
  const [editori, setEditori] = useState<EditoriOikeus>('katselu');
  const [virhe, setVirhe] = useState('');
  const [lahettaa, setLahettaa] = useState(false);
  const [tulos, setTulos] = useState<{ url?: string; approvalStatus?: string } | null>(null);

  useEffect(() => {
    if (!saaValitaKayttajia) return;
    fetch('/api/jako/kayttajat', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (data?.ok && Array.isArray(data.users)) setKayttajat(data.users); })
      .catch(() => { /* lista jää tyhjäksi, virhe näkyy tekstinä */ });
  }, [saaValitaKayttajia]);

  const jaa = async () => {
    setVirhe('');
    let expiresAt: string | null = null;
    let ikuinen = false;
    if (tapa !== 'users') {
      if (voimassa === 'ikuinen') ikuinen = true;
      else if (voimassa === 'oma') {
        if (!omaPvm) { setVirhe('Valitse päivämäärä.'); return; }
        expiresAt = new Date(`${omaPvm}T${omaKlo || '12:00'}`).toISOString();
      } else {
        const valinta = VOIMASSA.find((v) => v.arvo === voimassa);
        expiresAt = new Date(Date.now() + (valinta?.tunnit || 168) * 3600 * 1000).toISOString();
      }
    }
    setLahettaa(true);
    try {
      const vastaus = await fetch('/api/shares', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: kohde.id,
          lahde,
          mode: tapa,
          password: tapa === 'password' ? salasana : undefined,
          allowedUsernames: tapa === 'users' ? valitut : undefined,
          expiresAt,
          ikuinen,
          maxDownloads: maxLataukset ? Number(maxLataukset) : undefined,
          editori,
        }),
      });
      const data = await vastaus.json().catch(() => null);
      if (!vastaus.ok || !data?.ok) {
        setVirhe(data?.error || 'Jakolinkin luonti epäonnistui.');
        return;
      }
      onJaettu();
      setTulos(data.token
        ? { url: jakolinkinOsoite(data.token), approvalStatus: data.share?.approvalStatus }
        : { approvalStatus: 'none' });
    } catch {
      setVirhe('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setLahettaa(false);
    }
  };

  const tavat: [Tapa, string, string][] = [
    ['link', 'Pelkkä linkki', 'Kuka tahansa jolla on linkki pääsee tiedostoon.'],
    ['password', 'Linkki ja salasana', 'Linkin lisäksi vaaditaan salasana.'],
    ...(saaValitaKayttajia
      ? [['users', 'Vain valitut käyttäjät', 'Näkyy sovelluksessa kirjautuneille. Ei linkkiä.'] as [Tapa, string, string]]
      : []),
  ];

  const nappi = (valittu: boolean) => `px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
    valittu ? 'bg-accent border-accent text-white' : 'bg-surface border-line text-ink-body hover:bg-sunken'
  }`;

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4" onClick={onSulje}>
      <div
        role="dialog"
        aria-label={`Jaa: ${kohde.name}`}
        className="bg-surface rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start p-5 border-b border-line-soft gap-3">
          <h2 className="font-bold text-lg text-ink-strong flex items-center gap-2 min-w-0">
            <Share2 size={20} className="text-accent shrink-0" />
            <span className="truncate">Jaa: {kohde.name}</span>
          </h2>
          <button type="button" onClick={onSulje} aria-label="Sulje" className="text-ink-muted hover:text-ink-strong p-1 rounded-lg shrink-0">
            <X size={20} />
          </button>
        </div>

        <NykyisetJaot lahde={lahde} targetId={kohde.id} paivitys={tulos} onMuuttui={onJaettu} />

        {tulos ? (
          <div className="p-5 space-y-4">
            {tulos.url ? (
              <>
                <div className="bg-success-soft border-2 border-success/40 rounded-lg p-4">
                  <p className="text-xs font-bold text-success-ink uppercase tracking-wide mb-2">Jakolinkki</p>
                  <code className="block bg-surface border border-line rounded-lg px-3 py-2.5 text-xs font-mono break-all text-ink-strong">
                    {tulos.url}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(tulos.url ?? '')}
                    className="mt-3 text-xs font-bold text-success-ink bg-surface border border-line hover:bg-sunken px-3 py-1.5 rounded-md transition-colors"
                  >
                    Kopioi leikepöydälle
                  </button>
                </div>
                {tapa === 'password' && (
                  <p className="text-xs text-warning-ink bg-warning-soft border border-warning/30 rounded-lg p-3 flex gap-2">
                    <Info size={16} className="shrink-0" />
                    Lähetä salasana eri kanavaa kuin linkki. Samassa viestissä salasana ei suojaa miltään.
                  </p>
                )}
                {tulos.approvalStatus === 'pending' && (
                  <p className="text-xs text-ink-body bg-sunken border border-line rounded-lg p-3 flex gap-2">
                    <AlertTriangle size={16} className="text-warning shrink-0" />
                    Pyysit pysyvää linkkiä. Se odottaa pääkäyttäjän hyväksyntää ja toimii siihen asti
                    7 vuorokautta. Jos hyväksyntää ei tule, linkki vanhenee itsestään.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-success-ink bg-success-soft border border-success/30 rounded-lg p-4">
                Jaettu valituille käyttäjille. He näkevät tiedoston kirjautuessaan sovellukseen —
                linkkiä ei tarvita.
              </p>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={onSulje} className="px-5 py-2 text-sm font-medium text-ink-body bg-sunken hover:bg-line-soft rounded-lg">
                Sulje
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {kohde.henkilotietoa && (
              <p className="text-xs text-danger-ink bg-danger-soft border border-danger/30 rounded-lg p-3 flex gap-2">
                <ShieldAlert size={16} className="shrink-0" />
                Tiedosto on merkitty sisältämään henkilötietoa. Pelkkä linkki ei ole käytettävissä,
                ja voimassaolo on enintään 7 vuorokautta.
              </p>
            )}

            <div>
              <p className="text-sm font-medium text-ink-body mb-2">Jakotapa</p>
              <div className="space-y-2">
                {tavat.map(([arvo, otsikko, selite]) => {
                  const estetty = arvo === 'link' && kohde.henkilotietoa;
                  return (
                    <label
                      key={arvo}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border transition-colors ${
                        estetty ? 'bg-sunken border-line opacity-50 cursor-not-allowed'
                          : tapa === arvo ? 'bg-accent-soft border-accent/40 cursor-pointer'
                            : 'bg-surface border-line hover:bg-sunken cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="jakotapa"
                        disabled={estetty}
                        checked={tapa === arvo}
                        onChange={() => setTapa(arvo)}
                        className="mt-0.5 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink-strong">{otsikko}</span>
                        <span className="block text-xs text-ink-muted">{selite}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {tapa === 'password' && (
              <label className="block">
                <span className="block text-sm font-medium text-ink-body mb-1">Salasana</span>
                <input
                  type="text"
                  value={salasana}
                  onChange={(e) => setSalasana(e.target.value)}
                  placeholder="Vähintään 8 merkkiä"
                  className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2.5 text-sm text-ink-strong"
                />
                <span className="block text-xs text-ink-subtle mt-1">
                  Näkyy tässä selväkielisenä, jotta voit välittää sen. Palvelimelle se tallennetaan vain tiivisteenä.
                </span>
              </label>
            )}

            {tapa === 'users' && (
              <div>
                <p className="text-sm font-medium text-ink-body mb-2">Kenelle jaetaan</p>
                {kayttajat.length === 0 ? (
                  <p className="text-sm text-ink-muted">Ladataan käyttäjiä…</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-line rounded-lg p-2">
                    {kayttajat.map((k) => (
                      <label key={k.username} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-sunken cursor-pointer">
                        <input
                          type="checkbox"
                          checked={valitut.includes(k.username)}
                          onChange={() => setValitut((v) => (v.includes(k.username) ? v.filter((x) => x !== k.username) : [...v, k.username]))}
                        />
                        <span className="text-sm text-ink-body">{k.nickname}</span>
                        <span className="text-xs font-mono text-ink-subtle ml-auto">{k.username}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tapa !== 'users' && (
              <div>
                <p className="text-sm font-medium text-ink-body mb-2">Voimassa</p>
                <div className="flex flex-wrap gap-2">
                  {/* Henkilötietoa sisältävän enimmäisvoimassaolo on 7 vrk (server/shares.js). */}
                  {VOIMASSA.filter((v) => !kohde.henkilotietoa || v.tunnit <= 24 * 7).map((v) => (
                    <button key={v.arvo} type="button" onClick={() => setVoimassa(v.arvo)} className={nappi(voimassa === v.arvo)}>
                      {v.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => setVoimassa('oma')} className={nappi(voimassa === 'oma')}>
                    Valitse itse
                  </button>
                  {!kohde.henkilotietoa && (
                    <button type="button" onClick={() => setVoimassa('ikuinen')} className={nappi(voimassa === 'ikuinen')}>
                      Ei vanhene
                    </button>
                  )}
                </div>
                {voimassa === 'oma' && (
                  <div className="flex gap-2 mt-3">
                    <input
                      type="date"
                      value={omaPvm}
                      max={new Date(Date.now() + 65 * 864e5).toISOString().split('T')[0]}
                      onChange={(e) => setOmaPvm(e.target.value)}
                      className="flex-1 bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-strong"
                    />
                    <input
                      type="time"
                      value={omaKlo}
                      onChange={(e) => setOmaKlo(e.target.value)}
                      className="w-32 bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-strong"
                    />
                  </div>
                )}
                {voimassa === 'ikuinen' && (
                  <p className="text-xs text-ink-muted mt-2">
                    Pysyvä linkki vaatii pääkäyttäjän hyväksynnän. Siihen asti linkki toimii 7 vuorokautta.
                  </p>
                )}
                <label className="block mt-4">
                  <span className="block text-sm font-medium text-ink-body mb-1">Latausraja (valinnainen)</span>
                  <input
                    type="number"
                    min={1}
                    value={maxLataukset}
                    onChange={(e) => setMaxLataukset(e.target.value)}
                    placeholder="Ei rajaa"
                    className="w-40 bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-strong"
                  />
                </label>
              </div>
            )}

            <EditoriOikeusValinta nimi={kohde.name} arvo={editori} onMuutos={setEditori} />

            {virhe && (
              <p className="text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-3 py-2">{virhe}</p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onSulje} className="px-4 py-2 text-sm font-medium text-ink-body bg-sunken hover:bg-line-soft rounded-lg">
                Peruuta
              </button>
              <button
                type="button"
                onClick={jaa}
                disabled={lahettaa}
                className="px-5 py-2 text-sm font-bold text-white bg-accent hover:bg-accent-hover disabled:opacity-60 rounded-lg"
              >
                {lahettaa ? 'Luodaan…' : 'Luo jako'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
