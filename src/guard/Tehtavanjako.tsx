// Koko organisaation tehtävät ja pakotus (erä 19).
//
// Tällaista näkymää ei ole ollut: tehtävät ja kierrokset ovat kohteen sisällä, ja niiden
// vertailu on vaatinut kohteen vaihtamista. Tämä on ensimmäinen paikka jossa ne ovat
// yhtenä listana — ja se on samalla se paikka josta tehtävä määrätään vartijalle.
//
// --- Pakotus ei ole siirto ---------------------------------------------------------
//
// Ero on kaksi asiaa ja vain ne: saaja ei voi kieltäytyä, ja hänen on kuitattava. Siksi
// painike ei kysy "siirretäänkö" vaan sanoo mitä tapahtuu. Vartijan ruudulle tulee estävä
// ilmoitus jota ei voi ohittaa kuittaamatta.
//
// Saajaksi kelpaa kuka tahansa vartiointipuolen tunnus — myös vuoroton. Määräys ei ole
// pyyntö, eikä sen ehtona voi olla että saaja on sattumalta kirjautunut vuoroon.
import { useEffect, useState } from 'react';
import { ClipboardCheck, Route, Search, ShieldAlert } from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import {
  haeKaikkiTehtavat, pakotaTehtava,
  type JaettavaKohde, type JaettavaTehtava, type Vastaanottaja,
} from './siirrot';

type Props = { onTakaisin: () => void };

type Valittu = { kohde: JaettavaKohde; rivi: JaettavaTehtava; laji: 'tehtava' | 'kierros' };

export const Tehtavanjako = ({ onTakaisin }: Props) => {
  const [kohteet, setKohteet] = useState<JaettavaKohde[]>([]);
  // Vartijalista tulee samasta hausta kuin tehtävät: se on tämän näkymän valintalista
  // eikä itsenäinen tieto.
  const [vartijat, setVartijat] = useState<Vastaanottaja[]>([]);
  const [ladattu, setLadattu] = useState(false);
  const [haku, setHaku] = useState('');
  const [valittu, setValittu] = useState<Valittu | null>(null);
  const [saaja, setSaaja] = useState('');
  const [viesti, setViesti] = useState('');
  const [lahettaa, setLahettaa] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [onnistui, setOnnistui] = useState<string | null>(null);

  useEffect(() => {
    let voimassa = true;
    haeKaikkiTehtavat()
      .then((tulos) => {
        if (!voimassa) return;
        setKohteet(tulos.kohteet);
        setVartijat(tulos.vartijat);
      })
      .finally(() => { if (voimassa) setLadattu(true); });
    return () => { voimassa = false; };
  }, []);

  // Haku osuu sekä tehtävän että kohteen nimeen: kysymys on yhtä usein "missä on
  // sulkukierros" kuin "mitä Hansassa tehdään".
  const osuu = (kohde: JaettavaKohde, nimi: string) => {
    const h = haku.trim().toLowerCase();
    return !h || nimi.toLowerCase().includes(h) || kohde.siteNimi.toLowerCase().includes(h);
  };

  const laheta = async () => {
    if (!valittu || !saaja) return;
    setVirhe(null);
    setLahettaa(true);
    const tulos = await pakotaTehtava({
      saaja, siteId: valittu.kohde.siteId, laji: valittu.laji, kohdeId: valittu.rivi.id, viesti,
    });
    setLahettaa(false);
    if (!tulos.ok) {
      setVirhe(tulos.virhe);
      return;
    }
    const nimi = vartijat.find((v) => v.username === saaja)?.nimi || saaja;
    setOnnistui(`${valittu.rivi.nimi} määrättiin vartijalle ${nimi}.`);
    setValittu(null);
    setSaaja('');
    setViesti('');
  };

  const rivit = kohteet.flatMap((kohde) => [
    ...kohde.pohjat.filter((p) => osuu(kohde, p.nimi)).map((p) => ({ kohde, rivi: p, laji: 'kierros' as const })),
    ...kohde.tehtavat.filter((t) => osuu(kohde, t.nimi)).map((t) => ({ kohde, rivi: t, laji: 'tehtava' as const })),
  ]);

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-line-soft p-6 md:p-8 max-w-3xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin etusivulle</TakaisinLinkki>
      <h2 className="text-xl font-bold text-ink-strong mb-1">Tehtävien jako</h2>
      <p className="text-sm text-ink-muted mb-6">
        Kaikkien kohteiden tehtävät ja kierrokset yhtenä listana. Tehtävän voi määrätä
        vartijalle, joka saa siitä estävän ilmoituksen — hän ei voi kieltäytyä, mutta hänen
        on kuitattava se nähdyksi.
      </p>

      {onnistui && (
        <p className="mb-4 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success-ink">
          {onnistui}
        </p>
      )}

      <label className="block mb-4">
        <span className="sr-only">Haku</span>
        <span className="relative block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            value={haku}
            onChange={(e) => setHaku(e.target.value)}
            placeholder="Hae tehtävän tai kohteen nimellä"
            className="w-full rounded-lg border border-line-strong pl-9 pr-3 py-2.5 text-sm bg-surface outline-none focus:ring-2 focus:ring-accent"
          />
        </span>
      </label>

      {!ladattu ? (
        <p className="text-sm text-ink-muted">Haetaan tehtäviä…</p>
      ) : rivit.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {kohteet.length === 0
            ? 'Yhdellekään kohteelle ei ole määritelty tehtäviä tai kierroksia.'
            : 'Haku ei osunut mihinkään.'}
        </p>
      ) : (
        <div className="border border-line rounded-lg divide-y divide-line-soft">
          {rivit.map(({ kohde, rivi, laji }) => (
            <div key={`${laji}-${rivi.id}`} className="flex items-center gap-3 px-4 py-3">
              {laji === 'kierros'
                ? <Route size={16} className="text-accent shrink-0" />
                : <ClipboardCheck size={16} className="text-accent shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink truncate">{rivi.nimi}</span>
                <span className="block text-xs text-ink-muted truncate">
                  {kohde.siteNimi}
                  {rivi.suoritusaika ? ` · suunniteltu klo ${rivi.suoritusaika}` : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => { setValittu({ kohde, rivi, laji }); setVirhe(null); setOnnistui(null); }}
                className="shrink-0 text-sm font-medium text-ink-body hover:text-accent transition-colors"
              >
                Määrää
              </button>
            </div>
          ))}
        </div>
      )}

      {valittu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-surface rounded-2xl border border-line p-5 max-h-[85vh] overflow-y-auto">
            <span className="flex items-center gap-2 text-base font-bold text-warning-ink">
              <ShieldAlert size={18} className="shrink-0" />
              Määrää tehtävä
            </span>
            <p className="text-lg font-bold text-ink-strong mt-2 break-words">{valittu.rivi.nimi}</p>
            <p className="text-sm text-ink-muted">{valittu.kohde.siteNimi}</p>

            {virhe && (
              <p className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
                {virhe}
              </p>
            )}

            <label className="block mt-4">
              <span className="block text-sm font-medium text-ink-body mb-1">Vartija</span>
              <select
                value={saaja}
                onChange={(e) => setSaaja(e.target.value)}
                className="w-full rounded-lg border border-line-strong p-2.5 text-sm bg-surface outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Valitse vartija…</option>
                {vartijat.map((v) => (
                  <option key={v.username} value={v.username}>{v.nimi} ({v.username})</option>
                ))}
              </select>
            </label>

            <label className="block mt-3">
              <span className="block text-sm font-medium text-ink-body mb-1">Perustelu ja aikataulu</span>
              <textarea
                value={viesti}
                onChange={(e) => setViesti(e.target.value)}
                rows={2}
                placeholder="esim. Aja tämä ennen puoltayötä, vartija sairastui"
                className="w-full rounded-lg border border-line-strong p-2.5 text-sm bg-surface outline-none focus:ring-2 focus:ring-accent"
              />
              {/* Suoritusaikaa ei käytetä pakotetulle tehtävälle: se on toisen vuoron aika
                  eikä voi olla oikein tässä. Aikataulu on siksi kerrottava tässä. */}
              <span className="block text-xs text-ink-muted mt-1">
                Tehtävän oma suoritusaika ei päde toisessa vuorossa, joten kerro aikataulu
                tässä.
              </span>
            </label>

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                disabled={!saaja || lahettaa}
                onClick={laheta}
                className="flex-1 bg-warning hover:brightness-95 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5"
              >
                {lahettaa ? 'Määrätään…' : 'Määrää tehtävä'}
              </button>
              <button
                type="button"
                onClick={() => setValittu(null)}
                className="text-sm font-medium text-ink-muted hover:text-ink-body px-4 py-2.5"
              >
                Peruuta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
