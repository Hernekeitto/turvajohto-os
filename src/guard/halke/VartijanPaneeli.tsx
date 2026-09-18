// Hälytyskeskuksen vartijanäkymä: yhden vartijan tilanne ja siihen kohdistuvat toimet.
//
// MIKSI OMA NÄKYMÄ. Hälytyskeskus on rakennettu listoiksi: kuka on vuorossa, kuka on
// kentällä, missä kukin on. Listat vastaavat kysymykseen "ketä katson seuraavaksi".
// Kun vastaus on löytynyt, päivystäjä tarvitsee päinvastaisen näkymän — kaiken yhdestä
// ihmisestä yhdessä paikassa — ja se on tähän asti tarkoittanut kolmen eri osion
// selaamista ja neljännen tiedon puuttumista kokonaan.
//
// --- Miten näkymä avautuu, ja miksi päätös vaihtui ----------------------------------
//
// 18.9.2026 tämä avautui Vartijat-paneelin sisään ja KORVASI listat. Testissä se
// osoittautui vääräksi: päivystäjä menetti listan sillä hetkellä kun hän avasi yhden
// vartijan, eli juuri kun hän vertaili ketä lähettää. 19.9.2026 näkymä siirtyi
// laatikoksi sivun päälle (käyttäjän päätös) — lista jää taakse näkyviin, ja laatikon
// sulkeminen palauttaa tilanteen sellaisenaan.
//
// Alkuperäinen huoli modaalista oli monen näytön päivystyspöytä: laatikko peittää
// tilannerivin, eikä sitä voi jättää omalle näytölleen. Se ratkaistiin toisella tavalla
// kuin näkymän paikalla — `?vartija=` osoitteessa avaa saman näkymän omaan välilehteen,
// jolloin se voi jäädä auki ilman että se peittää mitään. Sama komponentti molemmissa:
// `omaIkkuna` kertoo kummasta on kyse.
//
// TÄMÄ TIEDOSTO EI PÄÄTÄ MISTÄÄN. Kooste lasketaan palvelimella (server/kooste.js),
// kaluston rajaus palvelimella (server/kalusto.js), pakkopäätöksen säännöt
// server/vuorot.js:ssä. Täällä on esitys ja kutsut.

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, MapPin, Package, ClipboardList, Square, TriangleAlert, Clock, Send, ExternalLink,
} from 'lucide-react';

import { ikaTekstina } from '../../shared/sijainninLahetys';
import type { Sijainti } from '../../shared/kanava';
import type { Pohja } from '../../shared/pohjat';
import { myohassaMinuutteina, paataVuoroPakolla } from '../vuorot';
import {
  pakotaTehtava, RAPORTTILAJIN_NIMI, RAPORTTILAJIN_SELITE, type Raporttilaji, type Siirto,
} from '../siirrot';
import type { Kohde } from '../tyypit';
import { GuardKartta } from '../kartta/GuardKartta';
import type { Tila } from '../yksikontila';
import { avaaValilehdessa, vartijanOsoite } from './paneelit';

// --- Palvelimen vastaus -------------------------------------------------------------
//
// Omat tyyppinsä eikä jaettuja: nämä ovat juuri se muoto jonka /api/vartija/:username
// palauttaa, eikä se ole sama kuin kokoelmien oma muoto. Jaettu tyyppi houkuttelisi
// käyttämään kenttiä joita palvelin ei tähän vastaukseen laita.

export type KoosteRivi = {
  id: string;
  nimi: string;
  lahde?: string;
  suoritusaika: string | null;
  tila: 'valmis' | 'tekematta' | 'kesken' | 'keskeytetty';
  tehtyKlo: string | null;
  poikkeamaMin: number | null;
  poikkeama: boolean;
};

export type VartijanKooste = {
  vuoroId: string;
  siteNimi: string;
  vuorotyyppiNimi: string | null;
  vartija: string;
  alkoi: string;
  paattyi: string | null;
  tehty: number;
  tekematta: number;
  kesken: number;
  keskeytetty: number;
  poikkeamia: number;
  pohjat: KoosteRivi[];
  tehtavat: KoosteRivi[];
};

export type VartijanKalusto = {
  id: string;
  tunnus: string;
  nimi: string;
  laji: string;
  alalaji: string;
  tila: string;
};

export type VartijanTiedot = {
  vartija: { username: string; nimi: string };
  vuoro: {
    id: string;
    siteId: string;
    siteNimi: string;
    vuorotyyppiNimi: string | null;
    alkoi: string;
    paattyi: string | null;
    paattyyArvio?: string | null;
    perehdytysPoikkeus?: { myontaja: string; syy: string } | null;
    pakkoPaatos?: { paattaja: string; syy: string; ts: string } | null;
  } | null;
  vuoroKaynnissa: boolean;
  kooste: VartijanKooste | null;
  kalustoTiedossa: boolean;
  kalusto: VartijanKalusto[];
  /** Päivystäjän antamat tehtävät. Eivät ole vuoron omia rivejä, joten ne eivät tule
   *  koosteessa — ks. server/index.js:n perustelu. */
  pakotukset: Siirto[];
};

const kellonaika = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
    : '—';
};

// Poikkeama näytetään etumerkin kanssa: "+12 min" ja "−12 min" ovat eri asioita.
// Myöhässä tehty kierros ja etuajassa tehty kierros kertovat eri tarinaa, ja pelkkä
// itseisarvo hukkaisi juuri sen eron.
const poikkeamaTeksti = (min: number | null) => {
  if (min === null) return '';
  if (min === 0) return 'ajallaan';
  return min > 0 ? `${min} min myöhässä` : `${Math.abs(min)} min etuajassa`;
};

const TILAN_TYYLI: Record<KoosteRivi['tila'], string> = {
  valmis: 'bg-success-soft text-success-ink border-success/30',
  kesken: 'bg-accent-soft text-accent-ink border-accent/40',
  keskeytetty: 'bg-warning-soft text-warning-ink border-warning/40',
  tekematta: 'bg-sunken text-ink-muted border-line',
};

const TILAN_NIMI: Record<KoosteRivi['tila'], string> = {
  valmis: 'Valmis',
  kesken: 'Kesken',
  keskeytetty: 'Keskeytetty',
  tekematta: 'Tekemättä',
};

const Lohko = ({ otsikko, ikoni: Ikoni, lisa, children }: {
  otsikko: string;
  ikoni: typeof MapPin;
  lisa?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="rounded-xl border border-line bg-surface p-4 mb-4">
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <Ikoni size={16} className="text-ink-subtle shrink-0" />
      <h4 className="text-sm font-bold text-ink-strong">{otsikko}</h4>
      {lisa}
    </div>
    {children}
  </section>
);

type Props = {
  vartija: string;
  /** Kohteet tehtäväluetteloineen. Pakotettava tehtävä valitaan kohteen luettelosta —
   *  päivystäjällä ei ole omaa vuoroa josta siirtää. */
  kohteet: Kohde[];
  /** Kierrospohjat. Vain kohteen omat suodatetaan tässä. */
  pohjat: Pohja[];
  /** Viimeksi tiedetty sijainti, tai null. Tulee Halytyskeskukselta samasta listasta
   *  jota kartta käyttää — kaksi eri lähdettä samalle pisteelle olisi kaksi eri paikkaa
   *  samalle ihmiselle. */
  sijainti: Sijainti | null;
  /** Onko päivystäjällä oikeus nähdä sijainteja lainkaan. Puuttuva oikeus ja tuntematon
   *  sijainti EIVÄT saa näyttää samalta. */
  saaNahdaSijainnit: boolean;
  /** Onko tämä oma ikkunansa (?vartija=… osoitteessa). Silloin ei ole mitään mihin
   *  palata eikä mitään avattavaa uuteen välilehteen — ollaan jo siellä. */
  omaIkkuna?: boolean;
  onTakaisin: () => void;
  /** Kutsutaan kun jokin muuttui palvelimella, jotta hälytyskeskuksen listat päivittyvät. */
  onMuutos: () => void;
};

export const VartijanPaneeli = ({
  vartija, kohteet, pohjat, sijainti, saaNahdaSijainnit, omaIkkuna = false,
  onTakaisin, onMuutos,
}: Props) => {
  const [tiedot, setTiedot] = useState<VartijanTiedot | null>(null);
  // Kello myöhästymisminuutteja varten. Käy aina, ei vain kun jotain on myöhässä — sama
  // oppi kuin hälytyskeskuksen omassa kellossa: aikaan perustuva luku pysähtyneestä
  // kellosta ei ole tieto vaan sattuma. Kymmenen sekuntia riittää minuuttitason luvulle.
  const [nyt, setNyt] = useState(Date.now());
  const [lataa, setLataa] = useState(true);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [ilmoitus, setIlmoitus] = useState<string | null>(null);
  const [paatosSyy, setPaatosSyy] = useState('');
  const [paattamassa, setPaattamassa] = useState(false);
  const [paatettava, setPaatettava] = useState(false);
  const [antaa, setAntaa] = useState(false);
  const [antamassa, setAntamassa] = useState(false);
  const [annettavaLaji, setAnnettavaLaji] = useState<'tehtava' | 'kierros' | 'oma'>('tehtava');
  const [annettavaSiteId, setAnnettavaSiteId] = useState('');
  const [annettavaKohdeId, setAnnettavaKohdeId] = useState('');
  const [annettavaNimi, setAnnettavaNimi] = useState('');
  const [annettavaViesti, setAnnettavaViesti] = useState('');
  const [annettavaRaportti, setAnnettavaRaportti] = useState<Raporttilaji | null>(null);

  const hae = useCallback(async () => {
    try {
      const v = await fetch(`/api/vartija/${encodeURIComponent(vartija)}`, { credentials: 'include' });
      const data = await v.json().catch(() => null);
      if (!v.ok || !data?.ok) {
        setVirhe(data?.error || 'Vartijan tietojen hakeminen ei onnistunut.');
        return;
      }
      setTiedot(data);
      setVirhe(null);
      // Oletuskohde vain kerran: jos tämä ylikirjoittaisi valinnan joka haussa, kohde
      // vaihtuisi takaisin minuutin välein kesken lomakkeen täytön.
      setAnnettavaSiteId((edellinen) => edellinen || data.vuoro?.siteId || '');
    } catch {
      setVirhe('Vartijan tietojen hakeminen ei onnistunut: ei yhteyttä palvelimeen.');
    } finally {
      setLataa(false);
    }
  }, [vartija]);

  useEffect(() => {
    setLataa(true);
    hae();
    // Sama minuuttitahti kuin vuorolistalla. Paneeli voi olla auki omalla näytöllään
    // tuntikausia, eikä siinä saa näkyä sen hetken tilanne jolloin se avattiin.
    const ajastin = window.setInterval(hae, 60_000);
    return () => window.clearInterval(ajastin);
  }, [hae]);

  useEffect(() => {
    const id = window.setInterval(() => setNyt(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const paata = async () => {
    if (!tiedot?.vuoro) return;
    setPaattamassa(true);
    setVirhe(null);
    const tulos = await paataVuoroPakolla(tiedot.vuoro.id, paatosSyy);
    setPaattamassa(false);
    if (!tulos.ok) {
      setVirhe(tulos.error || 'Vuoron päättäminen ei onnistunut.');
      return;
    }
    const kierrokset = tulos.kierrokset.length > 0
      ? ` Samalla keskeytyi ${tulos.kierrokset.length === 1 ? 'kierros' : `${tulos.kierrokset.length} kierrosta`}: `
        + `${tulos.kierrokset.map((k) => k.nimi).join(', ')}.`
      : '';
    setIlmoitus(`Vuoro päätetty.${kierrokset}`);
    setPaatettava(false);
    setPaatosSyy('');
    hae();
    onMuutos();
  };

  // --- Tehtävän antaminen -----------------------------------------------------------
  //
  // Kohde on oletuksena se jossa vartija on vuorossa, mutta valittavissa: pakotettu
  // tehtävä voi olla toisessa kohteessa (piirivartija käy naapurissa), ja juuri se on
  // tavallisin syy antaa tehtävä kesken vuoron.
  const annaLaji = (laji: 'tehtava' | 'kierros' | 'oma') => {
    setAnnettavaLaji(laji);
    setAnnettavaKohdeId('');
  };
  const annaKohde = kohteet.find((k) => k.id === annettavaSiteId) || null;
  const kohteenTehtavat = annaKohde?.tehtavat || [];
  const kohteenPohjat = pohjat.filter((p) => p.kind === 'patrol' && p.ownerId === annettavaSiteId);
  const annaKelpaa = annettavaSiteId !== ''
    && (annettavaLaji === 'oma' ? annettavaNimi.trim().length >= 3 : annettavaKohdeId !== '');

  const anna = async () => {
    setAntamassa(true);
    setVirhe(null);
    const tulos = await pakotaTehtava({
      saaja: vartija,
      laji: annettavaLaji,
      siteId: annettavaSiteId,
      ...(annettavaLaji === 'oma'
        ? { nimi: annettavaNimi.trim() }
        : { kohdeId: annettavaKohdeId }),
      viesti: annettavaViesti.trim(),
      raporttilaji: annettavaRaportti,
    });
    setAntamassa(false);
    if (!tulos.ok) {
      setVirhe(tulos.virhe || 'Tehtävän antaminen ei onnistunut.');
      return;
    }
    setIlmoitus(
      `Tehtävä annettu. Vartijan on kuitattava se nähdyksi${
        annettavaRaportti ? `, ja tehtävä vaatii: ${RAPORTTILAJIN_NIMI[annettavaRaportti].toLowerCase()}.` : '.'
      }`
    );
    setAntaa(false);
    setAnnettavaNimi('');
    setAnnettavaKohdeId('');
    setAnnettavaViesti('');
    // Oma haku heti eikä vasta minuutin päästä: annettu tehtävä kuuluu tehtävälokiin,
    // ja jos se ilmestyy sinne vasta seuraavalla kyselyllä, päivystäjä näkee tyhjän
    // kohdan juuri sen jälkeen kun hän lisäsi siihen rivin — eli näyttää siltä ettei
    // määräys mennyt läpi. `onMuutos` päivittää hälytyskeskuksen listat, ei tätä.
    hae();
    onMuutos();
  };

  // Kartan merkit. Yksi yksikkö ja ne kohteet joilla on koordinaatti — vartija yksin
  // kartalla ei kerro onko hän oikeassa paikassa, ja juuri se on kysymys jota varten
  // kartta tässä näkymässä on.
  const karttaYksikko = sijainti?.gps
    ? [{
      username: vartija,
      nimi: tiedot?.vartija.nimi || vartija,
      tila: 'ei_tietoa' as Tila,
      gps: sijainti.gps,
      ikaMs: sijainti.ikaMs,
      hata: false,
    }]
    : [];
  const karttaKohteet = kohteet
    .filter((k) => k.gps && Number.isFinite(k.gps.lat) && Number.isFinite(k.gps.lon))
    .map((k) => ({ id: k.id, nimi: k.name, gps: k.gps as { lat: number; lon: number } }));

  // Myöhästymisminuutit lasketaan tässä eikä palvelimella: kello tikittää selaimessa
  // (ks. vuorot.ts). Palvelimen laskema luku olisi se joka oli voimassa hakuhetkellä, ja
  // paneeli voi olla auki tunteja.
  const myohassa = tiedot?.vuoroKaynnissa
    ? myohassaMinuutteina(tiedot.vuoro?.paattyyArvio, nyt)
    : null;

  const kooste = tiedot?.kooste || null;
  const rivit: KoosteRivi[] = kooste ? [...kooste.pohjat, ...kooste.tehtavat] : [];

  // Päivystäjän antamat tehtävät samaan lokiin (19.9.2026). Ne eivät ole vuoron rivejä
  // eivätkä siksi koosteessa — ilman tätä päivystäjä näki oman määräyksensä vain siitä
  // ilmoituksesta jonka sai antaessaan sen, eikä sen jälkeen mistään.
  //
  // Suoritusaikaa ei ole eikä voi olla: pakotettu tehtävä annetaan kesken vuoron, eikä
  // sillä ole suunniteltua kellonaikaa johon sitä voisi verrata (server/kooste.js:
  // onPoikkeama palauttaa pakotukselle aina false samasta syystä).
  const pakotusrivit: (KoosteRivi & { maaraaja: string; raporttilaji?: string | null })[] =
    (tiedot?.pakotukset || []).map((s) => ({
      id: s.id,
      nimi: s.nimi,
      suoritusaika: null,
      tila: s.tila === 'valmis' ? 'valmis' : s.tila === 'odottaa' ? 'tekematta' : 'kesken',
      tehtyKlo: s.tila === 'valmis' ? (s.tehty || s.ratkaistu) : null,
      poikkeamaMin: null,
      poikkeama: false,
      maaraaja: s.antaja,
      raporttilaji: s.raporttilaji,
    }));

  return (
    <div className="mb-8">
      {!omaIkkuna && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <button
            type="button"
            onClick={onTakaisin}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <ArrowLeft size={15} />
            Takaisin vartijalistaan
          </button>
          {/* Omaan välilehteen (19.9.2026). Päivystäjä seuraa yhtä vartijaa pidempään —
              keikan ajan, myöhästyneen vuoron selvittämisen ajan — eikä hänen pidä
              menettää sitä näkymää sulkiessaan laatikon päästäkseen listaan.

              Välilehti eikä ponnahdusikkuna: tämä avataan kesken työn ja suljetaan pian.
              Ikkunan nimi on vartijakohtainen, joten saman vartijan avaaminen uudelleen
              nostaa olemassa olevan välilehden eikä avaa toista samasta ihmisestä. */}
          <button
            type="button"
            onClick={() => {
              if (!avaaValilehdessa(vartijanOsoite(vartija), `halke-vartija-${vartija}`)) {
                setVirhe('Selain esti välilehden avaamisen. Salli ponnahdusikkunat tältä sivustolta.');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-ink-body hover:bg-sunken transition-colors"
          >
            <ExternalLink size={13} />
            Avaa omaan välilehteen
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
        <h3 className="text-xl font-bold text-ink-strong">{tiedot?.vartija.nimi || vartija}</h3>
        {tiedot && tiedot.vartija.nimi !== tiedot.vartija.username && (
          <span className="text-sm text-ink-muted">{tiedot.vartija.username}</span>
        )}
      </div>
      <p className="text-sm text-ink-muted mb-4">
        {lataa && !tiedot
          ? 'Haetaan tietoja…'
          : tiedot?.vuoroKaynnissa
            ? `Vuorossa · ${tiedot.vuoro?.siteNimi || ''} · alkoi ${kellonaika(tiedot.vuoro?.alkoi || null)}`
            : tiedot?.vuoro
              ? `Ei vuorossa. Viimeisin vuoro päättyi ${kellonaika(tiedot.vuoro.paattyi)}.`
              : 'Ei vuorossa eikä päättyneitä vuoroja.'}
      </p>

      {virhe && (
        <p className="mb-4 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
          {virhe}
        </p>
      )}
      {ilmoitus && (
        <p className="mb-4 text-sm text-ink-body bg-sunken border border-line rounded-lg px-4 py-3">
          {ilmoitus}
        </p>
      )}

      {/* --- Vuoro ja pakkopäätös --------------------------------------------------
          Ensimmäisenä, koska se on ainoa toimi tällä sivulla joka muuttaa vartijan
          tilaa ilman että hän tekee mitään. */}
      <Lohko otsikko="Vuoro" ikoni={Clock}>
        {/* MIHIN KOHTEESEEN JA MIHIN VUOROON HÄN ON KIRJAUTUNUT (19.9.2026).
            Otsikkorivillä luki vain kohteen nimi, eikä siitä näe kumpaan vuorotyyppiin
            vartija kirjautui — "Teollisuuskatu 5" voi olla päivä-, ilta- tai yövuoro, ja
            juuri vuorotyyppi kertoo mihin asti hänen pitäisi olla siellä. */}
        {tiedot?.vuoro && (
          <dl className="text-sm mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-ink-muted">Kohde</dt>
            <dd className="text-ink-strong font-medium">{tiedot.vuoro.siteNimi || '—'}</dd>
            <dt className="text-ink-muted">Vuoro</dt>
            <dd className="text-ink-strong font-medium">
              {tiedot.vuoro.vuorotyyppiNimi || 'Lisävuoro (ei kellonaikoja)'}
            </dd>
            <dt className="text-ink-muted">Alkoi</dt>
            <dd className="text-ink-strong">{kellonaika(tiedot.vuoro.alkoi)}</dd>
            {tiedot.vuoroKaynnissa && tiedot.vuoro.paattyyArvio && (
              <>
                <dt className="text-ink-muted">Päättyy</dt>
                <dd className={myohassa !== null ? 'font-bold text-warning-ink' : 'text-ink-strong'}>
                  {kellonaika(tiedot.vuoro.paattyyArvio)}
                  {myohassa !== null && ` · ${myohassa} min yli`}
                </dd>
              </>
            )}
            {!tiedot.vuoroKaynnissa && (
              <>
                <dt className="text-ink-muted">Päättyi</dt>
                <dd className="text-ink-strong">{kellonaika(tiedot.vuoro.paattyi)}</dd>
              </>
            )}
            {/* Poikkeusluvalla aloitettu vuoro: perehdytystä ei ollut, ja se on tieto
                joka kuuluu näkyä silloin kun vartijaa katsotaan — ei vain lokissa. */}
            {tiedot.vuoro.perehdytysPoikkeus && (
              <>
                <dt className="text-warning-ink">Kertalupa</dt>
                <dd className="text-warning-ink">
                  {tiedot.vuoro.perehdytysPoikkeus.myontaja}: {tiedot.vuoro.perehdytysPoikkeus.syy}
                </dd>
              </>
            )}
            {tiedot.vuoro.pakkoPaatos && (
              <>
                <dt className="text-warning-ink">Päätetty puolesta</dt>
                <dd className="text-warning-ink">
                  {tiedot.vuoro.pakkoPaatos.paattaja}: {tiedot.vuoro.pakkoPaatos.syy}
                </dd>
              </>
            )}
          </dl>
        )}

        {!tiedot?.vuoroKaynnissa ? (
          <p className="text-sm text-ink-muted">
            Vuoro ei ole käynnissä, joten sitä ei voi päättää.
          </p>
        ) : !paatettava ? (
          <button
            type="button"
            onClick={() => { setPaatettava(true); setPaatosSyy(''); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-ink-muted hover:text-danger-ink hover:border-danger/40 hover:bg-danger-soft transition-colors"
          >
            <Square size={13} />
            Päätä vuoro vartijan puolesta
          </button>
        ) : (
          <div>
            <label className="block text-xs font-bold text-ink-strong mb-1" htmlFor="paneeli-syy">
              Miksi vuoro päätetään?
            </label>
            <input
              id="paneeli-syy"
              type="text"
              autoFocus
              value={paatosSyy}
              onChange={(e) => setPaatosSyy(e.target.value)}
              placeholder="Esim. puhelin rikki, ei saada yhteyttä"
              className="w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-strong"
            />
            <p className="text-xs text-ink-muted mt-1">
              Syy tallentuu vuoroon ja näkyy sen koosteessa. Kesken olevat kierrokset
              keskeytyvät samalla.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={paata}
                disabled={paatosSyy.trim().length < 3 || paattamassa}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-danger text-white hover:brightness-110 disabled:opacity-50 transition"
              >
                <Square size={13} />
                {paattamassa ? 'Päätetään…' : 'Päätä vuoro'}
              </button>
              <button
                type="button"
                onClick={() => { setPaatettava(false); setPaatosSyy(''); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-ink-body hover:bg-sunken transition-colors"
              >
                Peruuta
              </button>
            </div>
          </div>
        )}
      </Lohko>

      {/* --- Sijainti -------------------------------------------------------------
          IKÄ ON YHTÄ TÄRKEÄ KUIN KOORDINAATTI. Selain ei paikanna taustalla lukitulla
          näytöllä, joten tämä on viimeksi tiedetty sijainti eikä nykyinen. Ilman ikää
          rivi väittäisi tietävänsä missä ihminen on nyt. */}
      <Lohko otsikko="Sijainti" ikoni={MapPin}>
        {!saaNahdaSijainnit ? (
          <p className="text-sm text-ink-muted">Ei oikeutta vartijoiden sijainteihin.</p>
        ) : !sijainti ? (
          <p className="text-sm text-ink-muted">
            Sijaintia ei tiedetä. Sijainti vanhenee puolessa tunnissa, ja se päivittyy
            vain kun sovellus on auki.
          </p>
        ) : (
          <div className="text-sm text-ink-body space-y-2">
            <p className="font-medium text-ink-strong">
              {sijainti.gps
                ? `${sijainti.gps.lat.toFixed(5)}, ${sijainti.gps.lon.toFixed(5)}`
                : 'Vain kohdekartan sijainti'}
              {sijainti.gps?.tarkkuus != null && (
                <span className="text-ink-muted font-normal"> · ±{Math.round(sijainti.gps.tarkkuus)} m</span>
              )}
            </p>
            <p className="text-xs text-ink-muted">
              Tiedetty {ikaTekstina(sijainti.ikaMs)}
              {sijainti.lahde ? ` · ${sijainti.lahde === 'laite' ? 'sovelluksesta' : 'selaimesta'}` : ''}
            </p>
            {/* Kartta koordinaattien ALLA eikä tilalla. Koordinaatti on se mikä
                luetaan puhelimeen ja sanotaan radiossa; kartta vastaa kysymykseen
                onko hän siellä missä pitäisi. Kumpikaan ei korvaa toista.

                Sama GuardKartta kuin isossa näkymässä: toinen karttakomponentti
                tarkoittaisi toista kopiota maplibren elinkaaresta ja tyylistä. */}
            {sijainti.gps && (
              <div className="rounded-lg overflow-hidden border border-line">
                <GuardKartta yksikot={karttaYksikko} kohteet={karttaKohteet} />
              </div>
            )}
          </div>
        )}
      </Lohko>

      {/* --- Tehtäväloki ja suoritusajat ------------------------------------------ */}
      <Lohko
        otsikko="Tehtäväloki"
        ikoni={ClipboardList}
        lisa={kooste ? (
          <span className="text-xs text-ink-muted">
            {kooste.tehty} tehty · {kooste.tekematta} tekemättä
            {kooste.kesken > 0 ? ` · ${kooste.kesken} kesken` : ''}
            {kooste.keskeytetty > 0 ? ` · ${kooste.keskeytetty} keskeytetty` : ''}
            {kooste.poikkeamia > 0 ? ` · ${kooste.poikkeamia} aikapoikkeamaa` : ''}
            {/* Määrätyt erikseen eikä samaan summaan: luvut tulevat vuoron koosteesta
                (server/kooste.js), ja pakotukset ovat oma kokoelmansa. Niiden
                niputtaminen samaan lukuun tarkoittaisi että ruudulla oleva luku ei
                vastaa sitä mitä kooste laskee — kahden eri lähteen summa näyttää
                yhdeltä luvulta eikä kumpikaan tarkista toista. */}
            {pakotusrivit.length > 0 ? ` · ${pakotusrivit.length} määrättyä` : ''}
          </span>
        ) : null}
      >
        {!kooste && pakotusrivit.length === 0 ? (
          <p className="text-sm text-ink-muted">Ei vuoroa jolta lokia näyttää.</p>
        ) : rivit.length === 0 && pakotusrivit.length === 0 ? (
          <p className="text-sm text-ink-muted">Vuoroon ei kuulu kierroksia eikä tehtäviä.</p>
        ) : (
          <ul className="divide-y divide-line-soft border border-line rounded-lg overflow-hidden">
            {/* Päivystäjän antamat ensin: ne ovat tuoreimpia ja niistä päivystäjä on
                kiinnostunut juuri nyt. Merkitty erikseen, koska "kuka tämän määräsi" on
                eri kysymys kuin "kuuluuko tämä vuoroon". */}
            {pakotusrivit.map((r) => (
              <li key={r.id} className="px-3 py-2 flex flex-wrap items-center gap-2 bg-accent-soft/40">
                <span className={`px-2 py-0.5 rounded-md border text-xs font-medium shrink-0 ${TILAN_TYYLI[r.tila]}`}>
                  {r.tila === 'kesken' ? 'Kuitattu' : r.tila === 'tekematta' ? 'Kuittaamatta' : TILAN_NIMI[r.tila]}
                </span>
                <span className="text-sm text-ink-strong min-w-0 flex-1 break-words">
                  {r.nimi}
                  <span className="text-ink-muted font-normal"> · {r.maaraaja} määräsi</span>
                </span>
                {r.raporttilaji && (
                  <span className="text-xs text-ink-muted shrink-0">
                    {RAPORTTILAJIN_NIMI[r.raporttilaji as Raporttilaji].toLowerCase()}
                  </span>
                )}
                <span className="text-xs text-ink-muted tabular-nums shrink-0">
                  {r.tehtyKlo ? `tehty ${kellonaika(r.tehtyKlo)}` : 'kesken'}
                </span>
              </li>
            ))}
            {rivit.map((r) => (
              <li key={r.id} className="px-3 py-2 flex flex-wrap items-center gap-2 bg-surface">
                <span className={`px-2 py-0.5 rounded-md border text-xs font-medium shrink-0 ${TILAN_TYYLI[r.tila]}`}>
                  {TILAN_NIMI[r.tila]}
                </span>
                <span className="text-sm text-ink-strong min-w-0 flex-1 break-words">{r.nimi}</span>
                <span className="text-xs text-ink-muted tabular-nums shrink-0">
                  {r.suoritusaika ? `klo ${r.suoritusaika}` : 'ei kellonaikaa'}
                  {r.tehtyKlo ? ` → ${kellonaika(r.tehtyKlo)}` : ''}
                </span>
                {r.poikkeama && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-warning-ink shrink-0">
                    <TriangleAlert size={12} />
                    {poikkeamaTeksti(r.poikkeamaMin)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Lohko>

      {/* --- Tehtävän antaminen ---------------------------------------------------

          PAKOTUS EIKÄ SIIRTO. Siirto lähtee antajan omasta vuorosta ja saaja saa
          kieltäytyä; päivystäjällä ei ole vuoroa, eikä hänen antamansa työ ole pyyntö.
          Vartija kuittaa määräyksen nähdyksi ja tekee sen.

          PEREHDYTYSSÄÄNTÖ EI PÄDE (käyttäjän linjaus 18.9.2026). Vastuun ottaa antaja,
          ja molemmat tunnukset jäävät lokiin — jälkikäteen on voitava nähdä että työ
          annettiin perehdyttämättömälle ja kenen päätöksellä. */}
      <Lohko otsikko="Anna tehtävä" ikoni={Send}>
        {!antaa ? (
          <button
            type="button"
            onClick={() => setAntaa(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-line-strong bg-sunken text-ink-body hover:bg-surface transition-colors"
          >
            <Send size={13} />
            Anna tehtävä vartijalle
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-ink-strong mb-1" htmlFor="anna-kohde">
                Kohde
              </label>
              <select
                id="anna-kohde"
                value={annettavaSiteId}
                onChange={(e) => { setAnnettavaSiteId(e.target.value); setAnnettavaKohdeId(''); }}
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-strong"
              >
                <option value="">Valitse kohde</option>
                {kohteet.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {([
                ['tehtava', 'Kohteen tehtävä'],
                ['kierros', 'Kierros'],
                ['oma', 'Oma tehtävä'],
              ] as const).map(([arvo, teksti]) => (
                <button
                  key={arvo}
                  type="button"
                  onClick={() => annaLaji(arvo)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    annettavaLaji === arvo
                      ? 'bg-accent-soft text-accent-ink border-accent/40'
                      : 'bg-surface text-ink-body border-line hover:bg-sunken'
                  }`}
                >
                  {teksti}
                </button>
              ))}
            </div>

            {annettavaLaji === 'oma' ? (
              <div>
                <label className="block text-xs font-bold text-ink-strong mb-1" htmlFor="anna-nimi">
                  Mitä tehdään?
                </label>
                <input
                  id="anna-nimi"
                  type="text"
                  value={annettavaNimi}
                  onChange={(e) => setAnnettavaNimi(e.target.value)}
                  placeholder="Esim. vie kohteeseen uusi vartijakutsupainike"
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-strong"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-ink-strong mb-1" htmlFor="anna-kohdeId">
                  {annettavaLaji === 'kierros' ? 'Kierros' : 'Tehtävä'}
                </label>
                <select
                  id="anna-kohdeId"
                  value={annettavaKohdeId}
                  onChange={(e) => setAnnettavaKohdeId(e.target.value)}
                  disabled={!annettavaSiteId}
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-strong disabled:opacity-50"
                >
                  <option value="">
                    {!annettavaSiteId ? 'Valitse ensin kohde' : 'Valitse luettelosta'}
                  </option>
                  {(annettavaLaji === 'kierros' ? kohteenPohjat : kohteenTehtavat).map((x) => (
                    <option key={x.id} value={x.id}>{x.nimi}</option>
                  ))}
                </select>
                {/* Tyhjä luettelo ja valitsematta jättäminen ovat eri asioita. */}
                {annettavaSiteId
                  && (annettavaLaji === 'kierros' ? kohteenPohjat : kohteenTehtavat).length === 0 && (
                  <p className="text-xs text-ink-muted mt-1">
                    Kohteella ei ole {annettavaLaji === 'kierros' ? 'kierrospohjia' : 'tehtäviä'}.
                    Käytä omaa tehtävää.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-ink-strong mb-1" htmlFor="anna-raportti">
                Mitä vartija kirjoittaa?
              </label>
              <select
                id="anna-raportti"
                value={annettavaRaportti || ''}
                onChange={(e) => setAnnettavaRaportti((e.target.value || null) as Raporttilaji | null)}
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-strong"
              >
                <option value="">Ei kirjallista vaatimusta</option>
                {(Object.keys(RAPORTTILAJIN_NIMI) as Raporttilaji[]).map((laji) => (
                  <option key={laji} value={laji}>{RAPORTTILAJIN_NIMI[laji]}</option>
                ))}
              </select>
              <p className="text-xs text-ink-muted mt-1">
                {annettavaRaportti
                  ? RAPORTTILAJIN_SELITE[annettavaRaportti]
                  : 'Tehtävän voi merkitä tehdyksi ilman kirjausta.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-strong mb-1" htmlFor="anna-viesti">
                Saate (valinnainen)
              </label>
              <input
                id="anna-viesti"
                type="text"
                value={annettavaViesti}
                onChange={(e) => setAnnettavaViesti(e.target.value)}
                placeholder="Esim. painike on vartiotilan kaapissa"
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-strong"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={anna}
                disabled={!annaKelpaa || antamassa}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-accent text-white hover:brightness-110 disabled:opacity-50 transition"
              >
                <Send size={13} />
                {antamassa ? 'Annetaan…' : 'Anna tehtävä'}
              </button>
              <button
                type="button"
                onClick={() => setAntaa(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-line text-ink-body hover:bg-sunken transition-colors"
              >
                Peruuta
              </button>
            </div>
            <p className="text-xs text-ink-muted">
              Tehtävä menee vartijalle määräyksenä: hän ei voi kieltäytyä, ja hänen on
              kuitattava se nähdyksi. Perehdytystä ei tarkisteta, joten anna tehtävä vain
              kohteeseen jossa vartija osaa toimia.
            </p>
          </div>
        )}
      </Lohko>

      {/* --- Avaimet ja varusteet -------------------------------------------------
          Kalusto sijoitetaan henkilölle työntekijätunnuksella. Ilman työntekijätietuetta
          lista ei voi olla oikein, ja tyhjä lista näyttäisi siltä ettei vartijalla ole
          mitään — se on eri asia kuin "ei tiedetä". */}
      <Lohko
        otsikko="Avaimet ja varusteet"
        ikoni={Package}
        lisa={tiedot?.kalustoTiedossa ? (
          <span className="text-xs text-ink-muted">{tiedot.kalusto.length} kpl</span>
        ) : null}
      >
        {!tiedot ? null : !tiedot.kalustoTiedossa ? (
          <p className="text-sm text-warning-ink bg-warning-soft border border-warning/30 rounded-lg px-3 py-2">
            Tunnukseen ei ole liitetty työntekijätietuetta, joten hänelle luovutettua
            kalustoa ei voi hakea. Tämä ei tarkoita ettei hänellä olisi mitään.
          </p>
        ) : tiedot.kalusto.length === 0 ? (
          <p className="text-sm text-ink-muted">Ei henkilölle luovutettua kalustoa.</p>
        ) : (
          <ul className="divide-y divide-line-soft border border-line rounded-lg overflow-hidden">
            {tiedot.kalusto.map((e) => (
              <li key={e.id} className="px-3 py-2 flex flex-wrap items-center gap-2 bg-surface">
                <span className="text-xs font-mono text-ink-muted shrink-0">{e.tunnus}</span>
                <span className="text-sm text-ink-strong min-w-0 flex-1 break-words">{e.nimi}</span>
                {e.tila !== 'kaytossa' && (
                  <span className="px-2 py-0.5 rounded-md border border-warning/40 bg-warning-soft text-warning-ink text-xs font-medium shrink-0">
                    {e.tila}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Lohko>
    </div>
  );
};
