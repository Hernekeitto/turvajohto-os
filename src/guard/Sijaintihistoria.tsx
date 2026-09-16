// Sijaintihistoria: missä yksikkö liikkui, jälkikäteistä selvitystä varten.
//
// OMA OSIONSA ETUSIVULLA eikä hälytyskeskuksen sisällä, ja se on tietoinen valinta.
// Hälytyskeskus on tilannekuva: mitä tapahtuu juuri nyt ja mihin pitää reagoida.
// Historia on päinvastainen työ — se tehdään jälkeenpäin, rauhassa, jonkin jo
// tapahtuneen selvittämiseksi. Saman näkymän sisällä se olisi välilehti jonka
// päivystäjä avaa ohimennen, ja juuri sitä tämä ei saa olla.
//
// --- MIKSI SYY KYSYTÄÄN ENNEN JÄLKEÄ ------------------------------------------------
//
// Käyttötarkoitus on rajattu määrittelyssä: hälytysten ja kierrosten jälkiselvitys, EI
// työsuorituksen seuranta. Rajaus on organisatorinen eikä tekninen — mikään ei estä
// katsomasta jälkeä muusta syystä.
//
// Syy kysytään SILTI, ja se kirjataan auditlokiin (käyttäjän päätös 16.9.2026). Se ei
// tee rajauksesta estettä. Se tekee siitä jälkikäteen tarkastettavan: väärinkäyttö
// vaatii valheen kirjaamista eikä pelkkää klikkausta, ja työntekijä näkee omista
// tiedoistaan kuka katsoi ja mihin tarkoitukseen sanoi katsovansa.
//
// Siksi syy kysytään ENNEN hakua eikä sen jälkeen. Jälkikäteen kysytty syy olisi
// perustelu tehdylle teolle; etukäteen kysytty on päätös siitä tehdäänkö se.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Search, TriangleAlert } from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { GuardKartta } from './kartta/GuardKartta';
import type { Jalkipiste } from './kartta/merkit';

// PIDETTÄVÄ SYNKASSA server/sijaintihistoria.js:n SYYT-olion kanssa. Palvelin on se joka
// ratkaisee — tämä lista vain näyttää vaihtoehdot. Jos listat erkanevat, käyttäjä valitsee
// syyn jonka palvelin hylkää, ja virheilmoitus on hämmentävä muttei vaarallinen.
const SYYT: Record<string, string> = {
  halytys: 'Hälytyksen jälkiselvitys',
  kierros: 'Kierroksen varmentaminen',
  oma_pyynto: 'Työntekijän oma pyyntö omista tiedoistaan',
  muu: 'Muu syy',
};

// Sama raja kuin palvelimella (IKKUNA_MAX_VRK). Näytetään käyttäjälle etukäteen, jottei
// pidempää jaksoa yritetä ja saada virhettä vasta haun jälkeen.
const IKKUNA_MAX_VRK = 7;

type Vartija = { username: string; nimi: string; viimeksi: string };

type Tulos = {
  username: string;
  nimi: string;
  pisteet: Jalkipiste[];
  harvennettu?: number;
};

const pvm = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const kello = (ts: string) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('fi-FI', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const Sijaintihistoria = ({ onTakaisin }: { onTakaisin: () => void }) => {
  const [vartijat, setVartijat] = useState<Vartija[]>([]);
  const [sailytysVrk, setSailytysVrk] = useState(45);
  const [kuka, setKuka] = useState('');

  const tanaan = useMemo(() => pvm(new Date()), []);
  const [alkuPvm, setAlkuPvm] = useState(tanaan);
  const [loppuPvm, setLoppuPvm] = useState(tanaan);

  const [syy, setSyy] = useState('');
  const [tarkenne, setTarkenne] = useState('');

  const [tulos, setTulos] = useState<Tulos | null>(null);
  const [haetaan, setHaetaan] = useState(false);
  const [virhe, setVirhe] = useState('');

  useEffect(() => {
    fetch('/api/sijaintihistoria/vartijat', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.ok) return;
        setVartijat(d.vartijat || []);
        if (typeof d.sailytysVrk === 'number') setSailytysVrk(d.sailytysVrk);
      })
      .catch(() => setVirhe('Vartijalistaa ei saatu haettua.'));
  }, []);

  // Haku on nappi eikä automaattinen. Automaattinen haku kirjaisi auditlokiin rivin joka
  // kerta kun joku muuttaa päivämäärää — ja hakuja olisi lokissa enemmän kuin katsomisia.
  const hae = useCallback(() => {
    setVirhe('');
    setTulos(null);

    if (!kuka) { setVirhe('Valitse kenen jälkeä haetaan.'); return; }
    if (!syy) { setVirhe('Valitse katselun syy.'); return; }
    if (syy === 'muu' && tarkenne.trim().length < 3) {
      setVirhe('Kuvaa muu syy vähintään kolmella merkillä.');
      return;
    }

    const alku = new Date(`${alkuPvm}T00:00:00`).getTime();
    // Loppupäivä KOKONAAN mukaan: käyttäjä valitsee päivän, ei kellonaikaa. Ilman tätä
    // "eilen–eilen" palauttaisi tyhjän jäljen, koska ikkuna olisi nollan mittainen.
    const loppu = new Date(`${loppuPvm}T23:59:59`).getTime();
    if (!Number.isFinite(alku) || !Number.isFinite(loppu) || loppu <= alku) {
      setVirhe('Tarkista aikaväli.');
      return;
    }

    const params = new URLSearchParams({
      username: kuka,
      alku: String(alku),
      loppu: String(loppu),
      syy,
      ...(tarkenne.trim() ? { tarkenne: tarkenne.trim() } : {}),
    });

    setHaetaan(true);
    fetch(`/api/sijaintihistoria?${params}`, { credentials: 'include' })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.ok) throw new Error(d?.error || `Haku epäonnistui (${r.status}).`);
        return d as Tulos;
      })
      .then(setTulos)
      .catch((e: Error) => setVirhe(e.message))
      .finally(() => setHaetaan(false));
  }, [kuka, syy, tarkenne, alkuPvm, loppuPvm]);

  const pisteet = tulos?.pisteet || [];

  return (
    <div className="space-y-6">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin etusivulle</TakaisinLinkki>

      <div>
        <h2 className="text-2xl font-bold text-ink-strong mb-1">Sijaintihistoria</h2>
        <p className="text-sm text-ink-muted leading-relaxed max-w-3xl">
          Missä yksikkö liikkui työvuoron aikana. Käytetään hälytysten ja kierrosten
          jälkikäteiseen selvitykseen ja varmentamiseen — <strong>ei työsuorituksen
          seurantaan</strong>. Jälki säilyy {sailytysVrk} vuorokautta, minkä jälkeen se
          poistetaan automaattisesti.
        </p>
      </div>

      {/* Muistutus ennen hakua eikä sen jälkeen: tämä on se kohta jossa katsoja päättää
          katsooko. Jälkikäteen näytettynä se olisi huomautus teosta joka on jo tehty. */}
      <div className="flex gap-3 rounded-xl border border-line bg-sunken p-4 text-sm text-ink-body">
        <TriangleAlert className="w-5 h-5 shrink-0 text-amber-500" strokeWidth={1.75} />
        <p className="leading-relaxed">
          Jokainen haku kirjataan auditlokiin: kuka haki, kenen jälkeä, miltä ajalta ja
          millä syyllä. Merkintä säilyy, vaikka haku ei palauttaisi yhtään pistettä.
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block font-medium text-ink-strong mb-1">Kenen jälki</span>
          <select
            value={kuka}
            onChange={(e) => setKuka(e.target.value)}
            className="w-full rounded-lg border border-line bg-sunken px-3 py-2 text-ink-body"
          >
            <option value="">Valitse…</option>
            {vartijat.map((v) => (
              <option key={v.username} value={v.username}>{v.nimi}</option>
            ))}
          </select>
          {/* Lista tulee vuoroista eikä käyttäjärekisteristä: vain ne joilla on ollut
              vuoro säilytysaikana. Tyhjä lista on siis tieto eikä vika. */}
          {vartijat.length === 0 && (
            <span className="mt-1 block text-xs text-ink-muted">
              Yhdelläkään vartijalla ei ole vuoroa viimeisen {sailytysVrk} vuorokauden
              ajalta, joten haettavaa jälkeä ei ole.
            </span>
          )}
        </label>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <label>
            <span className="block font-medium text-ink-strong mb-1">Alkaen</span>
            <input
              type="date" value={alkuPvm} max={tanaan}
              onChange={(e) => setAlkuPvm(e.target.value)}
              className="w-full rounded-lg border border-line bg-sunken px-3 py-2 text-ink-body"
            />
          </label>
          <label>
            <span className="block font-medium text-ink-strong mb-1">Päättyen</span>
            <input
              type="date" value={loppuPvm} max={tanaan}
              onChange={(e) => setLoppuPvm(e.target.value)}
              className="w-full rounded-lg border border-line bg-sunken px-3 py-2 text-ink-body"
            />
          </label>
          <span className="col-span-2 text-xs text-ink-muted">
            Enintään {IKKUNA_MAX_VRK} vuorokautta kerrallaan.
          </span>
        </div>

        <label className="text-sm">
          <span className="block font-medium text-ink-strong mb-1">Katselun syy</span>
          <select
            value={syy}
            onChange={(e) => setSyy(e.target.value)}
            className="w-full rounded-lg border border-line bg-sunken px-3 py-2 text-ink-body"
          >
            <option value="">Valitse…</option>
            {Object.entries(SYYT).map(([id, teksti]) => (
              <option key={id} value={id}>{teksti}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block font-medium text-ink-strong mb-1">
            Tarkenne {syy === 'muu' ? '(pakollinen)' : '(vapaaehtoinen)'}
          </span>
          <input
            type="text" value={tarkenne} maxLength={200}
            placeholder="Esim. hälytys 14.9. klo 02:10"
            onChange={(e) => setTarkenne(e.target.value)}
            className="w-full rounded-lg border border-line bg-sunken px-3 py-2 text-ink-body"
          />
        </label>

        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="button" onClick={hae} disabled={haetaan}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            <Search className="w-4 h-4" />
            {haetaan ? 'Haetaan…' : 'Hae jälki'}
          </button>
          {virhe && <span className="text-sm text-red-500">{virhe}</span>}
        </div>
      </div>

      {tulos && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-lg font-bold text-ink-strong">{tulos.nimi}</h3>
            <span className="text-sm text-ink-muted">
              {pisteet.length === 0
                ? 'Ei yhtään sijaintipistettä tältä ajalta.'
                : `${pisteet.length} pistettä`}
            </span>
            {/* Harvennus kerrotaan aina kun se on tehty: katsojan on tiedettävä katsooko
                hän täyttä jälkeä vai otosta siitä. */}
            {tulos.harvennettu && (
              <span className="text-sm text-amber-600">
                Näytetään harvennettuna ({tulos.harvennettu} pisteestä).
              </span>
            )}
          </div>

          {pisteet.length === 0 ? (
            // TYHJÄ TULOS EI OLE SAMA KUIN "EI LIIKKUNUT". Sijaintia ei kerätä ilman
            // kesken olevaa vuoroa, eikä selain paikanna lukitulla näytöllä. Tämä on
            // sanottava, koska muuten tyhjä kartta luetaan väitteeksi henkilöstä.
            <div className="rounded-xl border border-line bg-sunken p-5 text-sm text-ink-body leading-relaxed">
              Tältä ajalta ei löytynyt sijaintipisteitä. Se ei tarkoita että henkilö olisi
              ollut paikallaan: sijaintia kerätään vain kesken olevan vuoron aikana, eikä
              selain paikanna taustalla lukitulla näytöllä. Jälki on voinut myös poistua
              säilytysajan ({sailytysVrk} vrk) täytyttyä.
            </div>
          ) : (
            <>
              <div className="h-[420px] overflow-hidden rounded-2xl border border-line">
                <GuardKartta yksikot={[]} kohteet={[]} jalki={pisteet} />
              </div>

              <details className="rounded-xl border border-line bg-surface">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink-strong">
                  Pisteet listana ({pisteet.length})
                </summary>
                <div className="max-h-80 overflow-y-auto border-t border-line">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-sunken text-ink-muted">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Aika</th>
                        <th className="px-4 py-2 text-left font-medium">Sijainti</th>
                        <th className="px-4 py-2 text-left font-medium">Tarkkuus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pisteet.map((p, i) => (
                        <tr key={`${p.ts}-${i}`} className="border-t border-line">
                          <td className="px-4 py-2 text-ink-body">{kello(p.ts)}</td>
                          <td className="px-4 py-2 font-mono text-xs text-ink-muted">
                            {p.lat.toFixed(5)}, {p.lon.toFixed(5)}
                          </td>
                          {/* Tarkkuus näkyy rivillä eikä vain kartalla: sadan metrin
                              piste ja kymmenen metrin piste näyttävät listassa yhtä
                              täsmällisiltä, ja vain toinen on. */}
                          <td className="px-4 py-2 text-ink-muted">
                            {typeof p.tarkkuus === 'number' ? `± ${Math.round(p.tarkkuus)} m` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </div>
      )}

      {!tulos && !haetaan && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-12 text-center">
          <History className="w-8 h-8 text-ink-muted" strokeWidth={1.5} />
          <p className="text-sm text-ink-muted">
            Valitse henkilö, aikaväli ja syy — jälki haetaan vasta sitten.
          </p>
        </div>
      )}
    </div>
  );
};
