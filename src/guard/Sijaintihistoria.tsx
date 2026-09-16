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

type TehtavanYksikko = {
  vartija: string;
  nimi: string;
  vastaanotti: string;
  poistui: string | null;
  lahde: 'tehtava' | 'loki';
};

type Tehtava = {
  id: string;
  laji: string;
  siteNimi: string;
  silmukka: string;
  luotu: string;
  tila: string;
  yksikot: TehtavanYksikko[];
};

type Tulos = {
  username: string;
  nimi: string;
  pisteet: Jalkipiste[];
  harvennettu?: number;
  lahde?: 'tehtava' | 'loki';
  tehtava?: { id: string; laji: string; siteNimi: string; silmukka: string; luotu: string };
};

// KAKSI HAKUTAPAA, ja ne vastaavat eri kysymykseen.
//
// `tehtava`  "Mitä tässä hälytyksessä tapahtui" — aikaväliä ei tarvitse tietää, se
//            luetaan tehtävästä. Tämä on se tapa jota jälkiselvitys oikeasti käyttää:
//            päivystäjä tietää minkä hälytyksen haluaa selvittää, ei sitä mihin
//            kellonaikaan yksikkö sattui ottamaan sen vastaan.
//
// `aikavali` "Missä tämä ihminen liikkui tällä välillä" — laajempi ja tylympi työkalu,
//            tarpeen silloin kun tapahtumaa ei ole kirjattu tehtäväksi.
//
// Tehtävä on oletus tarkoituksella: kapeampi haku on oikea lähtökohta, ja vapaa aikaväli
// on se johon siirrytään kun tehtävä ei riitä.
type Hakutapa = 'tehtava' | 'aikavali';

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
  const [hakutapa, setHakutapa] = useState<Hakutapa>('tehtava');
  const [vartijat, setVartijat] = useState<Vartija[]>([]);
  const [tehtavat, setTehtavat] = useState<Tehtava[]>([]);
  const [tehtavaId, setTehtavaId] = useState('');
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

    fetch('/api/sijaintihistoria/tehtavat', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.ok) setTehtavat(d.tehtavat || []); })
      .catch(() => { /* Tehtävälista puuttuu: aikavälihaku toimii yhä. */ });
  }, []);

  const valittuTehtava = tehtavat.find((t) => t.id === tehtavaId) || null;

  // Yksikön valinta nollataan kun tehtävä vaihtuu, JA valitaan automaattisesti jos
  // yksiköitä on vain yksi. Ilman jälkimmäistä yleisin tapaus vaatisi kaksi klikkausta
  // joista toisessa ei ole vaihtoehtoja.
  useEffect(() => {
    if (hakutapa !== 'tehtava') return;
    const yksikot = valittuTehtava?.yksikot || [];
    setKuka(yksikot.length === 1 ? yksikot[0].vartija : '');
  }, [tehtavaId, hakutapa, valittuTehtava]);

  const haeOsoitteella = useCallback((params: URLSearchParams) => {
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
  }, []);

  // Haku on nappi eikä automaattinen. Automaattinen haku kirjaisi auditlokiin rivin joka
  // kerta kun joku muuttaa päivämäärää — ja hakuja olisi lokissa enemmän kuin katsomisia.
  const hae = useCallback(() => {
    setVirhe('');
    setTulos(null);

    if (hakutapa === 'tehtava' && !tehtavaId) { setVirhe('Valitse hälytystehtävä.'); return; }
    if (!kuka) { setVirhe('Valitse kenen jälkeä haetaan.'); return; }
    if (!syy) { setVirhe('Valitse katselun syy.'); return; }
    if (syy === 'muu' && tarkenne.trim().length < 3) {
      setVirhe('Kuvaa muu syy vähintään kolmella merkillä.');
      return;
    }

    const yhteinen = {
      username: kuka,
      syy,
      ...(tarkenne.trim() ? { tarkenne: tarkenne.trim() } : {}),
    };

    // Tehtäväpohjaisessa haussa aikaväliä EI lähetetä lainkaan. Se luetaan palvelimella
    // tehtävästä — asiakas ei tiedä milloin yksikkö otti tehtävän vastaan, eikä sen
    // arvaaminen tästä päästä tuottaisi kuin väärän ikkunan.
    if (hakutapa === 'tehtava') {
      haeOsoitteella(new URLSearchParams({ ...yhteinen, tehtavaId }));
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

    haeOsoitteella(new URLSearchParams({
      ...yhteinen, alku: String(alku), loppu: String(loppu),
    }));
  }, [hakutapa, tehtavaId, kuka, syy, tarkenne, alkuPvm, loppuPvm, haeOsoitteella]);

  const pisteet = tulos?.pisteet || [];

  return (
    <div className="space-y-6">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin etusivulle</TakaisinLinkki>

      <div>
        <h2 className="text-2xl font-bold text-ink-strong mb-1">Sijaintihistoria</h2>
        <p className="text-sm text-ink-muted leading-relaxed max-w-3xl">
          Missä yksikkö liikkui työvuoron aikana. Käytetään hälytysten ja kierrosten
          jälkikäteiseen selvitykseen ja varmentamiseen — <strong>ei työsuorituksen
          seurantaan</strong>.
        </p>
        {/* KAKSI SÄILYTYSAIKAA, ja ne on sanottava molemmat. Pelkkä "45 vuorokautta"
            olisi väärin hälytystehtävien osalta, ja pelkkä "kaksi vuotta" olisi väärin
            kaiken muun osalta. Kumpikin yksin luettuna johtaisi väärään käsitykseen
            siitä mitä järjestelmässä on tallessa. */}
        <p className="text-sm text-ink-muted leading-relaxed max-w-3xl mt-2">
          Tavallinen sijaintijälki säilyy <strong>{sailytysVrk} vuorokautta</strong>, minkä
          jälkeen se poistetaan automaattisesti. Hälytystehtävään poistumisluvan yhteydessä
          tallennettu jälki säilyy pidempään — siihen sovelletaan LYTP:n
          tapahtumailmoitusaikaa.
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
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          {([
            ['tehtava', 'Hälytystehtävän ajalta'],
            ['aikavali', 'Vapaa aikaväli'],
          ] as [Hakutapa, string][]).map(([id, teksti]) => (
            <button
              key={id} type="button"
              onClick={() => { setHakutapa(id); setTulos(null); setVirhe(''); setKuka(''); }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                hakutapa === id
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line bg-sunken text-ink-body hover:border-line-strong'
              }`}
            >
              {teksti}
            </button>
          ))}
        </div>

        {hakutapa === 'tehtava' ? (
          <>
            <label className="text-sm sm:col-span-2">
              <span className="block font-medium text-ink-strong mb-1">Hälytystehtävä</span>
              <select
                value={tehtavaId}
                onChange={(e) => setTehtavaId(e.target.value)}
                className="w-full rounded-lg border border-line bg-sunken px-3 py-2 text-ink-body"
              >
                <option value="">Valitse…</option>
                {tehtavat.map((t) => (
                  <option key={t.id} value={t.id}>
                    {kello(t.luotu)} · {t.siteNimi || 'Kohde tuntematon'}
                    {t.silmukka ? ` · ${t.silmukka}` : ''} · {t.laji}
                  </option>
                ))}
              </select>
              {tehtavat.length === 0 && (
                <span className="mt-1 block text-xs text-ink-muted">
                  Yhdelläkään hälytystehtävällä ei ole vastaanottanutta yksikköä, joten
                  haettavaa jälkeä ei ole. Käytä vapaata aikaväliä.
                </span>
              )}
            </label>

            {valittuTehtava && (
              <label className="text-sm sm:col-span-2">
                <span className="block font-medium text-ink-strong mb-1">Kenen jälki</span>
                <select
                  value={kuka}
                  onChange={(e) => setKuka(e.target.value)}
                  className="w-full rounded-lg border border-line bg-sunken px-3 py-2 text-ink-body"
                >
                  <option value="">Valitse…</option>
                  {valittuTehtava.yksikot.map((y) => (
                    <option key={y.vartija} value={y.vartija}>
                      {y.nimi} · {kello(y.vastaanotti)} → {y.poistui ? kello(y.poistui) : 'kesken'}
                    </option>
                  ))}
                </select>
                {/* LÄHDE KERROTAAN ENNEN HAKUA. Kahden vuoden päästä lokia ei enää ole,
                    ja vain tehtävään liitetty jälki on jäljellä — katsojan on tiedettävä
                    kumpaa hän on katsomassa, ei arvattava sitä tuloksesta. */}
                {kuka && (
                  <span className="mt-1 block text-xs text-ink-muted">
                    {valittuTehtava.yksikot.find((y) => y.vartija === kuka)?.lahde === 'tehtava'
                      ? 'Jälki on tallennettu tehtävään poistumisluvan yhteydessä (säilytys LYTP:n mukaan).'
                      : `Jälki luetaan sijaintilokista (säilytys ${sailytysVrk} vrk). Tehtävään liitettyä jälkeä ei ole — poistumislupaa ei ole hyväksytty tai tehtävä on kesken.`}
                  </span>
                )}
              </label>
            )}
          </>
        ) : (
          <>
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
          </>
        )}

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
            {tulos.tehtava && (
              <span className="text-sm text-ink-body">
                {tulos.tehtava.laji} · {tulos.tehtava.siteNimi}
                {tulos.tehtava.silmukka ? ` · ${tulos.tehtava.silmukka}` : ''}
                {' · '}{kello(tulos.tehtava.luotu)}
              </span>
            )}
            <span className="text-sm text-ink-muted">
              {pisteet.length === 0
                ? 'Ei yhtään sijaintipistettä tältä ajalta.'
                : `${pisteet.length} pistettä`}
            </span>
            {/* Lähde myös tuloksessa eikä vain valinnassa: kuvakaappaus tästä näkymästä
                voi päätyä selvityksen liitteeksi, ja silloin siitä on käytävä ilmi
                kumpaa aineistoa se esittää. */}
            {tulos.lahde === 'tehtava' && (
              <span className="rounded-md border border-line bg-sunken px-2 py-0.5 text-xs font-bold text-ink-body">
                Tehtävään tallennettu jälki
              </span>
            )}
            {tulos.lahde === 'loki' && (
              <span className="rounded-md border border-line bg-sunken px-2 py-0.5 text-xs font-bold text-ink-body">
                Sijaintilokista ({sailytysVrk} vrk)
              </span>
            )}
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
