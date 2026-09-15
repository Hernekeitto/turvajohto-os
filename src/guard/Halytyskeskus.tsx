// Hälytyskeskus: päivystäjän (HÄLKE) näkymä kaikkiin kohteisiin yhtä aikaa.
//
// Ero vartijan Hälytykset-näkymään on tarkoituksellinen ja koko sivun olemassaolon syy:
// vartija katsoo YHTÄ kohdetta ja tekee siellä asioita, päivystäjä katsoo KAIKKIA
// kohteita eikä tee kentällä mitään. Siksi täällä ei ole hätäpainiketta, ajastimen
// käynnistystä eikä man-downia — ne olisivat päivystäjän ruudulla vain väärin painettavia
// nappeja. Täällä on sen sijaan se mitä päivystäjä tarvitsee: mikä on lauennut, kuka on
// kentällä, missä on hiljaista ja mitä juuri tapahtui.
//
// KAKSI SÄÄNTÖÄ JOITA TÄMÄ NÄKYMÄ NOUDATTAA
//
// 1. Tyhjä lista ei ole sama asia kuin puuttuva oikeus. Jos päivystäjällä ei ole
//    lukuoikeutta kierroksiin, osiossa lukee se — ei "ei kierroksia kesken". Valvomon
//    ruudulla väärä hiljaisuus on pahin mahdollinen virhe.
//
// 2. Mikään täällä näkyvä luku ei ole laskettu tässä. Hälytysten tilat, määräajat ja
//    eskaloinnit tulevat palvelimelta (server/halytys.js) ja tilannekuvan koonti
//    tilannekuva.ts:stä. Tämä tiedosto on esitys.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Siren, Timer, MapPin, Phone, Check, Users, Route, KeyRound, Megaphone,
  TriangleAlert, Activity, Volume2, VolumeX, Building2, ShieldCheck, MessageSquare,
  History, Wifi, WifiOff, BellRing, Search, X,
} from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { muotoileLaskuri } from '../shared/ajat';
import {
  TYYPPI_LABEL, ajastinTeksti, jaljella, kellonaika, kuittaaHalytys, type Halytys,
} from '../shared/halytykset';
import { AVAIMEN_TILA } from '../shared/kalusto';
import { onVoimassa } from '../shared/tiedotteet';
import { osuu } from '../shared/haku';
import { ilmoita, piippaa, pyydaIlmoituslupa, varmistaAani } from '../shared/aani';
import { ikaTekstina } from '../shared/sijainninLahetys';
import type { Sijainti } from '../shared/kanava';
import {
  TILAT, TILAN_KIRJAIN, TILAN_NIMI, TILAN_VARI, yksikonTila, type Tila,
} from './yksikontila';
import { PANEELIT, avaaIkkunassa, type PaneeliId } from './halke/paneelit';
import {
  kentalla, kohteenTilanne, tapahtumavirta, type Kiireys, type Lahteet,
} from './tilannekuva';
import type { Kohde } from './tyypit';
import { KeskuksenTehtavat } from './KeskuksenTehtavat';
import { LAJIN_NIMI, type Halytystehtava } from './halytystehtavat';

// Osioiden lukuoikeudet. Hälytyskeskus ei myönnä yhtään uutta lukuoikeutta: se näyttää
// saman datan jonka käyttäjä näkee muutenkin, kootusti. Lipuilla osio osaa sanoa eron
// "ei tapahtumia" ja "ei oikeutta nähdä" välillä.
type Oikeudet = {
  kierrokset: boolean;
  // Vartijoiden sijainnit (erä 23). Oma solmunsa guard_locations, koska tilannekuvan
  // näkeminen ja henkilöstön sijainnin näkeminen ovat eri asioita.
  sijainnit: boolean;
  kalusto: boolean;
  tiedotteet: boolean;
};

type Props = {
  kohteet: Kohde[];
  lahteet: Lahteet;
  kayttaja: string;
  // Toisen hälytyksen kuittaus on muokkausoikeuden takana (guard_alarms). Päivystäjällä se
  // käytännössä on, mutta ilman sitä näkymä on yhä hyödyllinen katselunäkymänä.
  saaKuitata: boolean;
  oikeudet: Oikeudet;
  // Kanavayhteyden tila. Päivystäjän on nähtävä tämä jatkuvasti: katkennut kanava
  // tarkoittaa että ruutu näyttää menneisyyttä, ja juuri sitä ei saa tapahtua huomaamatta.
  yhteys: boolean;
  sijaintiseuranta: boolean;
  // Hälytystehtävät (erä 22): hälytyskeskuksen kentälle antamat keikat. Haetaan
  // GuardAppissa kuten muukin data, jotta kanavan päivitys osuu yhteen paikkaan.
  tehtavat: Halytystehtava[];
  saaMuokataTehtavia: boolean;
  // Viimeksi tiedetyt sijainnit. Tulevat GuardAppista kuten muukin data, jotta
  // kanavan työntämä päivitys osuu yhteen paikkaan.
  sijainnit: Sijainti[];
  // Näytettävä paneeli (erä 24). null = koostenäkymä, jossa kaikki paneelit ovat
  // allekkain. Muu arvo tarkoittaa että tämä ikkuna on irrotettu yhdelle näytölle.
  paneeli: PaneeliId | null;
  // Seinätaulutila: ikkuna on katsottavaksi eikä kosketettavaksi. Suurempi teksti,
  // ei hakukenttiä eikä toimintopainikkeita. Vain paneelinäkymässä.
  taulu: boolean;
  onTehtavaMuutos: () => void;
  onMuutos: (halytys: Halytys) => void;
  onVirkista: () => void;
  // Kohteen tietoihin siirtyminen. null jos käyttäjällä ei ole siihen oikeutta — silloin
  // kohderivi ei ole painike, eikä käyttöliittymä lupaa siirtymää jota ei tapahdu.
  onAvaaKohde: ((kohde: Kohde) => void) | null;
  onTakaisin: () => void;
};

// Ajastin joka on tämän lähempänä määräaikaansa nostetaan varoitusväreihin. Kaksi
// minuuttia on se aika jossa päivystäjä ehtii vielä soittaa ennen kuin hälytys lähtee
// itsestään.
const KOHTA_MS = 2 * 60 * 1000;

// Kuinka kauas taaksepäin pyydetyt tarkistukset näkyvät. Kaksitoista tuntia kattaa yhden
// vuoron: päivystäjän on voitava nähdä vuoron alussa pyytämänsä tarkistus vielä sen
// lopussa, koska juuri siitä syntyy kuva siitä onko vartija ollut tavoitettavissa.
const TARKISTUS_IKKUNA_MS = 12 * 60 * 60 * 1000;

// Mitä pyydetylle tarkistukselle lopulta tapahtui.
//
// Lopputulos luetaan historian viimeisestä merkinnästä eikä pelkästä tilasta. `peruttu`
// syntyy kahdesta eri syystä — vartija kuittasi, tai joku muu lopetti ajastimen vuoron
// päättyessä — ja niiden esittäminen samalla tekstillä olisi väärä nimi tapahtumalle,
// mikä on tässä järjestelmässä pahempi vika kuin puuttuva tieto.
//
// Vastausaika lasketaan PYYNNÖSTÄ eikä ajastimen alusta: pakotettu tarkistus siirtää jo
// olemassa olevaa ajastinta, jonka alkoi-aika voi olla tuntien takaa.
function tarkistuksenTulos(h: Halytys, pyynto: Halytys['historia'][number]) {
  if (h.tila === 'kaynnissa') {
    return { teksti: 'Odottaa vastausta', hatainen: false, vastausaika: null };
  }
  if (h.tila === 'lauennut') {
    return { teksti: 'Ei vastannut — hälytys lähti', hatainen: true, vastausaika: null };
  }
  const paattyiMs = h.paattyi ? new Date(h.paattyi).getTime() : null;
  const lopetti = [...(h.historia || [])]
    .reverse()
    .find((m) => m.tapahtuma === 'peruttu' || m.tapahtuma === 'kuitattu');
  const vartijaItse = !!lopetti && lopetti.user === h.vartija;
  if (!vartijaItse) {
    return {
      teksti: lopetti?.user ? `${lopetti.user} lopetti ajastimen` : 'Ajastin päättyi',
      hatainen: false,
      vastausaika: null,
    };
  }
  return {
    teksti: h.tila === 'peruttu' ? 'Vartija kuittasi' : 'Vartija kuittasi hälytyksen',
    hatainen: false,
    vastausaika: paattyiMs === null ? null : paattyiMs - new Date(pyynto.ts).getTime(),
  };
}

/**
 * Listan hakukenttä.
 *
 * <p><b>Piilotettujen määrä sanotaan aina ääneen.</b> Suodatettu lista näyttää samalta
 * kuin lyhyt lista, ja päivystäjän ruudulla ero on ratkaiseva: "ei lauenneita hälytyksiä"
 * ja "hakuehto piilottaa kolme lauennutta hälytystä" ovat eri tilanteita. Unohtunut
 * hakusana ei saa hiljentää valvomoa.
 *
 * <p>Siksi myös {@code kiire}: hälytyslistassa piilotettujen rivi on varoitusvärinen eikä
 * harmaa. Se on ainoa lista jossa suodatin voi piilottaa jotain jota katsotaan juuri nyt.
 */
const Hakukentta = ({
  arvo, muuta, paikanpitaja, piilotettu, kiire = false,
}: {
  arvo: string;
  muuta: (arvo: string) => void;
  paikanpitaja: string;
  piilotettu: number;
  kiire?: boolean;
}) => (
  <div className="mb-2 flex flex-wrap items-center gap-2">
    <div className="relative flex-1 min-w-[12rem] max-w-sm">
      <Search
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="search"
        value={arvo}
        onChange={(e) => muuta(e.target.value)}
        placeholder={paikanpitaja}
        aria-label={paikanpitaja}
        className="w-full rounded-lg border border-line bg-surface pl-8 pr-8 py-1.5 text-xs text-ink-body placeholder:text-ink-subtle"
      />
      {arvo !== '' && (
        <button
          type="button"
          onClick={() => muuta('')}
          aria-label="Tyhjennä haku"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-subtle hover:text-ink-strong hover:bg-sunken"
        >
          <X size={13} />
        </button>
      )}
    </div>
    {piilotettu > 0 && (
      <span
        className={`text-xs font-medium ${kiire ? 'text-warning-ink' : 'text-ink-muted'}`}
      >
        Hakuehto piilottaa {piilotettu}
      </span>
    )}
  </div>
);

/** Haku ei osunut. Eri viesti kuin tyhjä lista — ks. Hakukentta. */
const EiOsumia = ({ haku }: { haku: string }) => (
  <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
    Hakuehto <b>{haku}</b> ei osu yhteenkään riviin. Lista ei siis ole tyhjä — tyhjennä
    haku nähdäksesi kaikki.
  </p>
);

type Merkkitila = 'ok' | 'varoitus' | 'neutraali';

const MERKKITYYLI: Record<Merkkitila, string> = {
  ok: 'bg-success-soft text-success-ink border-success/30',
  varoitus: 'bg-warning-soft text-warning-ink border-warning/40',
  neutraali: 'bg-surface text-ink-body border-line',
};

const MERKKIPISTE: Record<Merkkitila, string> = {
  ok: 'bg-success',
  varoitus: 'bg-warning',
  neutraali: 'bg-ink-subtle',
};

const KIIREYS_TYYLI: Record<Kiireys, { reuna: string; merkki: string }> = {
  kriittinen: { reuna: 'border-danger/50 bg-danger-soft', merkki: 'bg-danger' },
  varoitus: { reuna: 'border-warning/40 bg-warning-soft', merkki: 'bg-warning' },
  rauhallinen: { reuna: 'border-line bg-surface', merkki: 'bg-success' },
};

const VIRRAN_TYYLI: Record<Kiireys, string> = {
  kriittinen: 'text-danger-ink',
  varoitus: 'text-warning-ink',
  rauhallinen: 'text-ink-body',
};

// Äänimerkki ja järjestelmäilmoitus ovat jaetussa moduulissa (shared/aani.ts) erästä 23
// alkaen. Kenttäpuoli tarvitsi saman koneiston toistuvana hälytysäänenä, ja kaksi
// toteutusta samasta oskillaattorista olisi erkaantunut toisistaan ensimmäisellä
// korjauksella.

const AANI_AVAIN = 'turvajohto-halke-aani';

export const Halytyskeskus = ({
  kohteet, lahteet, kayttaja, saaKuitata, oikeudet, yhteys, sijaintiseuranta,
  tehtavat, saaMuokataTehtavia, onTehtavaMuutos, sijainnit, paneeli, taulu,
  onMuutos, onVirkista, onAvaaKohde, onTakaisin,
}: Props) => {
  const [nyt, setNyt] = useState(Date.now());
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);
  const [huomiot, setHuomiot] = useState<Record<string, string>>({});
  const [lahimmat, setLahimmat] = useState<Record<string, 'ei' | { username: string; etaisyysM: number; ikaMs: number }[]>>({});
  const [aani, setAani] = useState(false);
  // Kenen tarkistusta ollaan pyytämässä. Yksi kerrallaan riittää: nappi on rivikohtainen
  // ja pyyntö kestää vain yhden verkkokutsun verran.
  const [tarkistettava, setTarkistettava] = useState<string | null>(null);
  // Kesken olevat vuorot. ERI LISTA kuin "Kentällä juuri nyt", joka johdetaan
  // kirjauksista: vartija joka ei ole kirjannut mitään ei näy siinä, ja juuri hänestä
  // päivystäjä on huolissaan.
  const [vuorossa, setVuorossa] = useState<
    { id: string; vartija: string; siteId: string; alkoi: string; vuorotyyppiNimi: string | null }[]
  >([]);

  useEffect(() => {
    let voimassa = true;
    const hae = async () => {
      try {
        const v = await fetch('/api/vuoro/kaynnissa', { credentials: 'include' });
        const data = await v.json().catch(() => null);
        if (voimassa && data?.ok) setVuorossa(data.vuorot || []);
      } catch {
        // Verkkovirhe: lista jää ennalleen. Tyhjentäminen näyttäisi siltä että
        // kukaan ei ole vuorossa, ja se on väärä tieto eikä puuttuva tieto.
      }
    };
    hae();
    const ajastin = window.setInterval(hae, 60_000);
    return () => { voimassa = false; window.clearInterval(ajastin); };
  }, []);

  // Pakotettu tarkistus: "vastaa nyt".
  //
  // Palvelin siirtää vartijan kuittausajastimen erääntymään kahden minuutin päähän ja
  // työntää kanavaa pitkin kyselyn puhelimeen. TOIMII MYÖS SAMMUNEELLA PUHELIMELLA:
  // kanavaviesti on nopea tie, mutta ajastin erääntyy palvelimella riippumatta siitä
  // tavoittiko viesti laitetta.
  //
  // `laitteita: 0` ei siis tarkoita epäonnistumista vaan sitä, että puhelin ei ole
  // juuri nyt verkossa — ja se on päivystäjälle tieto eikä virhe.
  const pakotaTarkistus = async (vartija: string) => {
    setTarkistettava(vartija);
    setVirhe(null);
    try {
      const vastaus = await fetch('/api/vuoro/tarkistus', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vartija }),
      });
      const data = await vastaus.json().catch(() => null);
      if (!vastaus.ok || !data?.ok) {
        setVirhe(data?.error || 'Tarkistuspyyntö ei onnistunut.');
      } else if (data.laitteita === 0) {
        setVirhe(
          `${vartija}: puhelin ei ole juuri nyt verkossa. Tarkistus on silti voimassa ja `
          + 'hälyttää jos kuittausta ei tule kahdessa minuutissa.'
        );
      }
      onVirkista();
    } catch {
      setVirhe('Tarkistuspyyntö ei onnistunut: yhteys palvelimeen ei toimi.');
    } finally {
      setTarkistettava(null);
    }
  };
  const [smsTila, setSmsTila] = useState<{ konfiguroitu: boolean; dryRun: boolean; saldo: number | null; varoitusraja: number | null; virhe: string | null } | null>(null);

  const nimet = useMemo(() => new Map(kohteet.map((k) => [k.id, k.name])), [kohteet]);
  const kohdeNimi = useCallback(
    (id: string | null) => (id ? nimet.get(id) || 'Tuntematon kohde' : 'Ei kohdetta'),
    [nimet]
  );

  const lauenneet = useMemo(
    () => lahteet.halytykset
      .filter((h) => h.tila === 'lauennut')
      .sort((a, b) => String(a.laukesi || a.alkoi).localeCompare(String(b.laukesi || b.alkoi))),
    [lahteet.halytykset]
  );
  const ajastimet = useMemo(
    () => lahteet.halytykset
      .filter((h) => h.tyyppi === 'ajastin' && h.tila === 'kaynnissa')
      .sort((a, b) => (a.eraantyy || 0) - (b.eraantyy || 0)),
    [lahteet.halytykset]
  );
  // Pyydetyt tarkistukset, myös päättyneet.
  //
  // Käynnissä oleva ajastin näkyy yllä, mutta VAIN niin kauan kuin se on käynnissä.
  // Nopeasti kuitattu tarkistus on ruudulla kymmenen sekuntia eikä jätä sen jälkeen
  // mitään jälkeä, ja peruttu tietue putoaa kaikista listoista. Mitattu 13.9.2026:
  // onnistunut tarkistus näytti tästä näkymästä katsottuna täsmälleen samalta kuin
  // tarkistus jota ei koskaan pyydetty — päivystäjä ei voinut erottaa "vartija vastasi
  // yhdessätoista sekunnissa" tilanteesta "painallukseni ei mennyt perille".
  //
  // Tunnistetaan historiamerkinnästä eikä tilasta, koska tila ei kerro kuka kysyi:
  // `peruttu` syntyy myös vuoron päättyessä, eikä sitä pidä esittää tarkistuksena.
  const minuutti = Math.floor(nyt / 60_000);
  const tarkistukset = useMemo(() => {
    const raja = minuutti * 60_000 - TARKISTUS_IKKUNA_MS;
    return lahteet.halytykset
      .map((h) => ({
        halytys: h,
        pyynto: [...(h.historia || [])].reverse().find((m) => m.tapahtuma === 'tarkistus'),
      }))
      .filter((r): r is { halytys: Halytys; pyynto: Halytys['historia'][number] } =>
        !!r.pyynto && new Date(r.pyynto.ts).getTime() >= raja)
      .sort((a, b) => String(b.pyynto.ts).localeCompare(String(a.pyynto.ts)));
  }, [lahteet.halytykset, minuutti]);

  const tilanteet = useMemo(
    () => kohteet.map((kohde) => ({ kohde, tilanne: kohteenTilanne(kohde.id, lahteet) })),
    [kohteet, lahteet]
  );
  const kentallaNyt = useMemo(() => kentalla(lahteet, nyt), [lahteet, nyt]);

  // Sijainnit tiloineen (erä 24). Tila EI tule palvelimelta vaan lasketaan tässä samasta
  // datasta jonka päivystäjä muutenkin näkee — sama sääntö kuin koko näkymässä: mikään
  // täällä näkyvä ei ole uutta tietoa, vain koottua.
  const yksikot = useMemo(
    () => sijainnit
      .map((s) => ({ sijainti: s, ...yksikonTila(s.username, { tehtavat, kierrokset: lahteet.kierrokset }) }))
      // Kiireellisin ensin ja sen sisällä tuorein: päivystäjä lukee listaa ylhäältä alas,
      // ja ikä ratkaisee kumpaan kahdesta tehtävällä olevasta voi luottaa.
      .sort((a, b) => {
        const ero = TILAT.indexOf(a.tila) - TILAT.indexOf(b.tila);
        return ero !== 0 ? ero : a.sijainti.ikaMs - b.sijainti.ikaMs;
      }),
    [sijainnit, tehtavat, lahteet.kierrokset]
  );

  // Suodatin on JOUKKO eikä yksi valinta: "näytä vapaat ja kierroksella olevat" on se
  // kysymys jonka päivystäjä esittää etsiessään ketä voi lähettää (ks. onIrrotettavissa).
  const [tilaSuodatin, setTilaSuodatin] = useState<Set<Tila>>(new Set());
  const suodatetutYksikot = tilaSuodatin.size === 0
    ? yksikot
    : yksikot.filter((y) => tilaSuodatin.has(y.tila));
  const tilaMaarat = useMemo(() => {
    const maarat = new Map<Tila, number>();
    for (const y of yksikot) maarat.set(y.tila, (maarat.get(y.tila) || 0) + 1);
    return maarat;
  }, [yksikot]);
  // Tapahtumavirran pituus. Oletus 10 eikä 40: virta on silmäiltävä lista siitä mitä juuri
  // tapahtui, ja neljänkymmenen rivin mittaisena se työntää kaiken muun pois ruudulta.
  // Pidemmät valinnat ovat siellä missä ne tarvitaan — listan alla, kun kymmenen ei
  // riittänyt.
  // Hakuehdot listoittain yhdessä oliossa. Erilliset useStatet kuudelle listalle olisi
  // kuusi kertaa sama koodi, ja seitsemäs lista unohtuisi lisäämättä.
  const [haut, setHaut] = useState<Record<string, string>>({});
  const haku = (avain: string) => haut[avain] || '';
  const asetaHaku = (avain: string, arvo: string) => setHaut((v) => ({ ...v, [avain]: arvo }));

  const [virtaMaara, setVirtaMaara] = useState(10);
  const virta = useMemo(() => tapahtumavirta(lahteet, virtaMaara), [lahteet, virtaMaara]);

  const kierroksetKesken = useMemo(
    () => lahteet.kierrokset
      .filter((k) => k.tila === 'kesken')
      .sort((a, b) => String(a.alkoi).localeCompare(String(b.alkoi))),
    [lahteet.kierrokset]
  );
  const kadonneetAvaimet = useMemo(
    () => lahteet.avaimet.filter((a) => a.tila === 'kadonnut'),
    [lahteet.avaimet]
  );
  const avoimetPoikkeamat = useMemo(
    () => lahteet.poikkeamat
      .filter((p) => p.tila === 'avoin')
      .sort((a, b) => Number(b.vakavuus === 'kriittinen') - Number(a.vakavuus === 'kriittinen')),
    [lahteet.poikkeamat]
  );
  const voimassaTiedotteet = useMemo(
    () => lahteet.tiedotteet.filter((t) => onVoimassa(t, nyt)),
    [lahteet.tiedotteet, nyt]
  );

  // Sekuntikello. Käy aina kun jotain lasketaan — päivystäjän ruudulla nimenomaan
  // lasketaan: laukeamisesta kulunut aika ja ajastimien jäljellä oleva aika ovat ne kaksi
  // lukua joiden takia hälytyskeskus on auki.
  const laskettavaa = lauenneet.length > 0 || ajastimet.length > 0;
  useEffect(() => {
    setNyt(Date.now());
    if (!laskettavaa) return;
    const id = window.setInterval(() => setNyt(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [laskettavaa]);

  // Kanava tuo muutokset itsestään, mutta katkennut yhteys ei tuo mitään. Hidas varakysely
  // pitää ruudun ajan tasalla myös silloin — ilman sitä päivystäjä katsoisi pysähtynyttä
  // kuvaa tietämättä siitä.
  useEffect(() => {
    const id = window.setInterval(() => onVirkista(), 60_000);
    return () => window.clearInterval(id);
  }, [onVirkista]);

  useEffect(() => {
    try {
      setAani(window.localStorage.getItem(AANI_AVAIN) === '1');
    } catch {
      // Yksityinen selaustila: asetus jää voimaan vain tämän sivunlatauksen ajaksi.
    }
  }, []);

  // Uusi lauennut hälytys: äänimerkki ja työpöytäilmoitus. Päivystäjällä on muitakin
  // ikkunoita auki, eikä hälytystä saa huomata vasta seuraavalla vilkaisulla.
  //
  // Ensimmäisellä renderöinnillä EI soiteta mitään: silloin kaikki avoimet hälytykset
  // olisivat "uusia", ja sivun avaaminen piippaisi jo hoidetuista hälytyksistä.
  const tunnetut = useRef<Set<string> | null>(null);
  useEffect(() => {
    const idt = new Set(lauenneet.map((h) => h.id));
    const edelliset = tunnetut.current;
    tunnetut.current = idt;
    if (!edelliset) return;
    const uudet = lauenneet.filter((h) => !edelliset.has(h.id));
    if (uudet.length === 0) return;
    if (aani) piippaa();
    try {
      for (const h of uudet) {
        ilmoita(
          `HÄLYTYS · ${kohdeNimi(h.eventId)}`,
          `${TYYPPI_LABEL[h.tyyppi]} · ${h.vartija}${h.kuvaus ? ` — ${h.kuvaus}` : ''}`,
          h.id,
        );
      }
    } catch {
      // Ilmoitusrajapinta puuttuu tai on estetty. Ääni ja ruutu kertovat silti.
    }
  }, [lauenneet, aani, kohdeNimi]);

  const vaihdaAani = async () => {
    const paalle = !aani;
    setAani(paalle);
    try {
      window.localStorage.setItem(AANI_AVAIN, paalle ? '1' : '0');
    } catch {
      // Ks. yllä.
    }
    if (!paalle) return;
    // Lupa kysytään samassa eleessä: selain hyväksyy sekä äänen että ilmoitusluvan vain
    // käyttäjän painalluksesta.
    await varmistaAani();
    piippaa();
    await pyydaIlmoituslupa();
  };

  // Tekstiviestieskaloinnin tila. Hälytys lähtee kohteen hälytysnumeroihin tekstiviestinä,
  // joten loppunut saldo tai konfiguroimaton integraatio on päivystäjän tieto eikä
  // ylläpidon: silloin lauennut hälytys näkyy VAIN tässä näkymässä.
  //
  // 403 on normaali lopputulos: kaikilla päivystäjillä ei ole oikeutta hätäviesteihin.
  // Silloin osiota ei näytetä lainkaan eikä virhettä kerrota.
  useEffect(() => {
    let ohitettu = false;
    fetch('/api/sms/status', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (ohitettu || !res || res.ok !== true) return;
        setSmsTila({
          konfiguroitu: !!res.konfiguroitu,
          dryRun: !!res.dryRun,
          saldo: typeof res.saldo === 'number' ? res.saldo : null,
          varoitusraja: typeof res.varoitusraja === 'number' ? res.varoitusraja : null,
          virhe: res.virhe || null,
        });
      })
      .catch(() => { /* Verkkovirhe näkyy jo kanavan tilassa. */ });
    return () => { ohitettu = true; };
  }, []);

  const kuittaa = async (halytys: Halytys) => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = await kuittaaHalytys(halytys.id, huomiot[halytys.id] || '');
      if (tulos.ok && tulos.halytys) {
        onMuutos(tulos.halytys);
        setHuomiot((edelliset) => ({ ...edelliset, [halytys.id]: '' }));
      } else {
        setVirhe(tulos.error || 'Kuittaus epäonnistui.');
      }
    } finally {
      setTyoskentelee(false);
    }
  };

  // Kuka on lähinnä. Kysytään palvelimelta eikä lasketa täällä: etäisyyden laskeminen
  // vaatii toisten sijainnit, eikä niitä anneta selaimeen listana.
  const haeLahimmat = async (halytys: Halytys) => {
    if (!halytys.gps) return;
    try {
      const osoite = `/api/lahin?lat=${halytys.gps.lat}&lon=${halytys.gps.lon}`
        + (halytys.eventId ? `&eventId=${encodeURIComponent(halytys.eventId)}` : '');
      const vastaus = await fetch(osoite, { credentials: 'include' });
      const data = await vastaus.json().catch(() => null);
      if (!data || data.ok !== true) {
        setVirhe(data?.error || 'Lähimpien hakeminen epäonnistui.');
        return;
      }
      setLahimmat((edelliset) => ({
        ...edelliset,
        [halytys.id]: data.kaytossa === false ? 'ei' : (data.vartijat || []),
      }));
    } catch {
      setVirhe('Lähimpien hakeminen epäonnistui: ei yhteyttä palvelimeen.');
    }
  };

  // Näkyykö paneeli tässä ikkunassa. Koostenäkymässä kaikki; irrotetussa ikkunassa
  // vain se yksi. Sama komponentti molemmissa tarkoituksella: kaksi toteutusta samasta
  // paneelista erkanisi ensimmäisellä korjauksella, ja valvomon ruuduista toinen
  // näyttäisi eri tilannetta kuin toinen.
  const nayta = (id: PaneeliId) => paneeli === null || paneeli === id;

  // Selain voi estää ponnahdusikkunan. Painallus joka ei tee mitään on pahempi kuin
  // puuttuva painike, joten esto sanotaan ääneen.
  const [ikkunaEstetty, setIkkunaEstetty] = useState(false);
  const irrota = (id: PaneeliId, tauluna: boolean) => {
    setIkkunaEstetty(!avaaIkkunassa(id, tauluna));
  };

  const kohteetKriittisia = tilanteet.filter((t) => t.tilanne.kiireys === 'kriittinen').length;
  const kohteetVaroitus = tilanteet.filter((t) => t.tilanne.kiireys === 'varoitus').length;

  // --- Järjestelmän tila, tiiviinä ----------------------------------------------------
  //
  // Nämä olivat sivun pohjalla omana osionaan, kokonaisin virkkein. Väärä paikka: ne
  // kertovat voiko ruutuun luottaa, ja sen on näyttävä samalla silmäyksellä kuin ruutu
  // itse — ei kahden vierityksen päässä.
  //
  // TIIVISTYS EI SAA HILJENTÄÄ VIKAA. Lyhyt merkki riittää kun kaikki on kunnossa, mutta
  // ongelmatilassa koko selite näkyy merkkien alla sellaisenaan. Muuten "Tekstiviestit
  // pois" näyttäisi ruudulla yhtä rauhalliselta kuin "Tekstiviestit käytössä", ja ero
  // niiden välillä on se lähteekö hälytyksestä viesti kenellekään.
  const tilamerkit: { avain: string; tila: Merkkitila; teksti: string; selite: string }[] = [
    {
      avain: 'yhteys',
      tila: yhteys ? 'ok' : 'varoitus',
      teksti: yhteys ? 'Yhteys auki' : 'YHTEYS POIKKI',
      selite: yhteys
        ? 'Hälytykset ja kirjaukset päivittyvät ruudulle itsestään.'
        : 'Ruudulla voi olla vanhaa tietoa. Yhteyttä yritetään uudelleen automaattisesti.',
    },
  ];
  if (smsTila) {
    const saldoVahissa = smsTila.saldo !== null && smsTila.varoitusraja !== null
      && smsTila.saldo <= smsTila.varoitusraja;
    const smsKunnossa = smsTila.konfiguroitu && !smsTila.dryRun && !smsTila.virhe && !saldoVahissa;
    tilamerkit.push({
      avain: 'sms',
      tila: smsKunnossa ? 'ok' : 'varoitus',
      teksti: !smsTila.konfiguroitu
        ? 'VIESTIT POIS'
        : smsTila.dryRun
          ? 'VIESTIT KUIVANA'
          : smsTila.virhe
            ? 'VIESTIEN TILA EPÄSELVÄ'
            : saldoVahissa
              ? 'VIESTISALDO VÄHISSÄ'
              : 'Viestit käytössä',
      selite: !smsTila.konfiguroitu
        ? 'Lauennut hälytys näkyy vain sovelluksessa — kohteen hälytysnumeroihin ei lähde viestiä.'
        : smsTila.dryRun
          ? 'Viestejä ei lähetetä oikeasti. Hälytys näkyy vain sovelluksessa.'
          : smsTila.virhe
            ? smsTila.virhe
            : smsTila.saldo !== null
              ? `Saldo ${smsTila.saldo} viestiä${saldoVahissa ? ' — alle varoitusrajan' : ''}.`
              : 'Saldoa ei ole vielä tarkistettu.',
    });
  }
  tilamerkit.push({
    avain: 'sijainti',
    tila: sijaintiseuranta ? 'ok' : 'neutraali',
    teksti: sijaintiseuranta ? 'Sijainti seurannassa' : 'Ei sijaintiseurantaa',
    selite: sijaintiseuranta
      ? '"Kuka on lähinnä?" toimii niiden osalta joiden laite on lähettänyt sijainnin.'
      : 'Hälytykseen liitetty kertaluonteinen sijainti näkyy silti, jos vartijan laite sai sen.',
  });
  const tilahuomiot = tilamerkit.filter((t) => t.tila === 'varoitus');

  // --- Suodatetut listat --------------------------------------------------------------
  //
  // Kentät valitaan sen mukaan mitä päivystäjä kirjoittaa hakukenttään kun jotain on
  // tapahtunut: vartijan nimimerkki, kohteen nimi, tai se sana jonka hän näki rivillä.
  // Kohde haetaan NIMELLÄ eikä tunnuksella — tunnus on uuid, jota kukaan ei kirjoita.
  const lauenneetNakyvat = lauenneet.filter(
    (h) => osuu([h.vartija, h.kuvaus, kohdeNimi(h.eventId), TYYPPI_LABEL[h.tyyppi]], haku('lauenneet'))
  );
  const ajastimetNakyvat = ajastimet.filter(
    (h) => osuu([h.vartija, h.kuvaus, kohdeNimi(h.eventId)], haku('ajastimet'))
  );
  const tarkistuksetNakyvat = tarkistukset.filter(
    ({ halytys: h, pyynto }) => osuu([h.vartija, pyynto.user, kohdeNimi(h.eventId)], haku('tarkistukset'))
  );
  const vuorossaNakyvat = vuorossa.filter(
    (v) => osuu([v.vartija, v.vuorotyyppiNimi, kohdeNimi(v.siteId)], haku('vuorossa'))
  );
  const kentallaNakyvat = kentallaNyt.filter(
    (v) => osuu([v.vartija, v.mita, ...(v.kohteet || []).map(kohdeNimi)], haku('kentalla'))
  );
  const virtaNakyva = virta.filter(
    (t) => osuu([t.otsikko, t.teksti, t.kuka, kohdeNimi(t.kohdeId)], haku('virta'))
  );

  const nykyinen = PANEELIT.find((p) => p.id === paneeli) || null;

  return (
    // Seinätaulutila on LUOKKA eikä erillinen komponenttipuu: sama näkymä, isompi
    // teksti ja toiminnot piilotettuna (ks. index.css: .halke-taulu). Erillinen puu
    // tarkoittaisi kahta paikkaa joissa sama paneeli voi näyttää eri asiaa.
    <div className={taulu ? "halke-taulu" : undefined}>
      {/* Irrotetussa ikkunassa ei ole paluulinkkiä etusivulle: ikkuna on avattu yhtä
          paneelia varten, ja sen sulkee ikkunan oma rasti. Paluulinkki veisi sen
          koostenäkymään, jolloin näyttö lakkaisi näyttämästä sitä mitä varten se on. */}
      {!paneeli && (
        <TakaisinLinkki onClick={onTakaisin}>Takaisin etusivulle</TakaisinLinkki>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ink-strong mb-1">
            {nykyinen ? nykyinen.label : "Hälytyskeskus"}
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            {nykyinen
              ? nykyinen.kuvaus
              : "Kaikkien kohteiden tilanne yhdellä ruudulla. Päivittyy itsestään — hälytyksiä ei tarvitse hakea."}
          </p>
        </div>
        {/* Järjestelmän tila ja äänimerkki samassa laatikossa. Äänimerkki on painike eikä
            merkki, koska se on ainoa näistä jonka päivystäjä voi itse muuttaa. */}
        <div className="rounded-xl border border-line bg-surface p-2.5 shrink-0 max-w-full">
          <div className="flex flex-wrap items-center gap-1.5">
            {tilamerkit.map((t) => (
              <span
                key={t.avain}
                title={t.selite}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                  MERKKITYYLI[t.tila]
                }`}
              >
                {t.avain === 'yhteys'
                  ? (yhteys ? <Wifi size={13} /> : <WifiOff size={13} />)
                  : (
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${MERKKIPISTE[t.tila]}`}
                      aria-hidden="true"
                    />
                  )}
                {t.teksti}
              </span>
            ))}
            <button
              type="button"
              onClick={vaihdaAani}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                aani
                  ? 'bg-accent-soft text-accent-ink border-accent/40'
                  : 'bg-surface text-ink-body border-line hover:bg-sunken'
              }`}
              title={aani
                ? 'Uusi lauennut hälytys soittaa äänimerkin myös silloin kun ikkuna on taustalla.'
                : 'Uusi hälytys näkyy vain ruudulla. Kytke äänimerkki päälle jos et katso tätä näkymää jatkuvasti.'}
            >
              {aani ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {aani ? 'Ääni päällä' : 'Ääni pois'}
            </button>
          </div>
          {/* Ongelmatilan selite näkyy kokonaisuudessaan. Ks. tilamerkit. */}
          {tilahuomiot.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-line-soft pt-2">
              {tilahuomiot.map((t) => (
                <li key={t.avain} className="text-xs text-warning-ink max-w-prose">{t.selite}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* --- Näyttöjen hallinta (erä 24) -----------------------------------------

          Päivystäjällä on usein kaksi näyttöä, eikä selain voi levittää yhtä ikkunaa
          kahdelle ruudulle. Jokainen paneeli avataan siis omaan ikkunaansa, jonka
          päivystäjä raahaa haluamalleen näytölle — selain muistaa paikan.

          Seinätaulu ja työtila ovat sama paneeli eri kuoressa: seinätaulussa teksti on
          isompi eikä nappeja ole, koska sitä katsotaan kolmen metrin päästä. */}
      {!paneeli && (
        <div className="mb-6 rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-bold text-ink-strong mb-1">Avaa omaan ikkunaan</p>
          <p className="text-xs text-ink-muted mb-3">
            Toiselle näytölle. Työtilassa toiminnot ovat käytössä, seinätaulussa eivät —
            seinätaulu on katsottavaksi.
          </p>
          {ikkunaEstetty && (
            <p className="mb-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning-ink">
              Selain esti ikkunan avaamisen. Salli ponnahdusikkunat tältä sivustolta.
            </p>
          )}
          <ul className="space-y-2">
            {PANEELIT.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{p.label}</span>
                  <span className="block text-xs text-ink-muted">{p.kuvaus}</span>
                </span>
                <button
                  type="button"
                  onClick={() => irrota(p.id, false)}
                  className="shrink-0 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-body hover:bg-sunken transition-colors"
                >
                  Työtila
                </button>
                {p.taulukelpoinen && (
                  <button
                    type="button"
                    onClick={() => irrota(p.id, true)}
                    className="shrink-0 rounded-lg bg-action px-3 py-1.5 text-xs font-medium text-white hover:bg-action-hover transition-colors"
                  >
                    Seinätaulu
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {virhe && (
        <p className="mb-4 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
          {virhe}
        </p>
      )}

      {/* --- Tilannerivi ---------------------------------------------------------
          Kuusi lukua siinä järjestyksessä kuin päivystäjä ne tarvitsee: mikä palaa,
          mikä on käynnissä, kuka on kentällä. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <Luku
          ikoni={Siren}
          arvo={lauenneet.length}
          nimi="Lauennutta"
          korosta={lauenneet.length > 0 ? 'kriittinen' : 'rauhallinen'}
        />
        <Luku
          ikoni={Timer}
          arvo={ajastimet.length}
          nimi="Ajastinta käynnissä"
          korosta={ajastimet.some((h) => (jaljella(h, nyt) ?? Infinity) <= KOHTA_MS) ? 'varoitus' : 'rauhallinen'}
        />
        <Luku ikoni={Users} arvo={kentallaNyt.length} nimi="Kentällä" />
        <Luku
          ikoni={Route}
          arvo={oikeudet.kierrokset ? kierroksetKesken.length : '—'}
          nimi="Kierrosta kesken"
        />
        <Luku
          ikoni={TriangleAlert}
          arvo={oikeudet.kalusto ? avoimetPoikkeamat.length + kadonneetAvaimet.length : '—'}
          nimi="Avointa poikkeamaa"
          korosta={oikeudet.kalusto && avoimetPoikkeamat.some((p) => p.vakavuus === 'kriittinen') ? 'kriittinen' : 'rauhallinen'}
        />
        <Luku
          ikoni={Building2}
          arvo={`${kohteetKriittisia + kohteetVaroitus}/${kohteet.length}`}
          nimi="Kohdetta huomiolla"
          korosta={kohteetKriittisia > 0 ? 'kriittinen' : kohteetVaroitus > 0 ? 'varoitus' : 'rauhallinen'}
        />
      </div>

      {nayta('keikat') && (<>
      {/* --- Hälytystehtävät (erä 22) --------------------------------------------
          Ennen lauenneita hälytyksiä, ja ero on siinä kumpaan päivystäjä voi vaikuttaa:
          lauennut hälytys on tapahtunut asia, hälytystehtävä on työ jota hän parhaillaan
          johtaa — ja jossa vartija odottaa hänen päätöstään päästäkseen pois. */}
      <div className="mb-8">
        <KeskuksenTehtavat
          tehtavat={tehtavat}
          kohteet={kohteet}
          saaMuokata={saaMuokataTehtavia}
          onMuutos={onTehtavaMuutos}
        />
      </div>
      </>)}

      {nayta('halytykset') && (<>
      {/* --- Lauenneet hälytykset ------------------------------------------------ */}
      <Osio otsikko="Lauenneet hälytykset" ikoni={Siren} maara={lauenneet.length} kiire={lauenneet.length > 0}>
        <Hakukentta
          arvo={haku('lauenneet')}
          muuta={(v) => asetaHaku('lauenneet', v)}
          paikanpitaja="Hae vartija, kohde tai kuvaus"
          piilotettu={lauenneet.length - lauenneetNakyvat.length}
          kiire
        />
        {lauenneet.length === 0 ? (
          <p className="text-sm text-success-ink bg-success-soft border border-success/30 rounded-lg px-4 py-3">
            Ei lauenneita hälytyksiä.
          </p>
        ) : lauenneetNakyvat.length === 0 ? (
          <EiOsumia haku={haku('lauenneet')} />
        ) : (
          <div className="space-y-3">
            {lauenneetNakyvat.map((h) => {
              const kohde = kohteet.find((k) => k.id === h.eventId) || null;
              const kulunut = h.laukesi ? nyt - Date.parse(h.laukesi) : null;
              return (
                <div key={h.id} className="bg-surface border-2 border-danger/50 rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h4 className="font-bold text-danger-ink flex items-center gap-2">
                        <Siren size={18} />
                        {TYYPPI_LABEL[h.tyyppi]} · {h.vartija}
                      </h4>
                      <p className="text-sm text-ink-body mt-0.5">
                        {kohdeNimi(h.eventId)}
                        {h.kuvaus ? ` · ${h.kuvaus}` : ''}
                        {h.vyohyke ? ` · ${h.vyohyke.nimi}` : ''}
                      </p>
                    </div>
                    {/* Laukeamisesta kulunut aika juoksee näkyvissä. Se on päivystäjän
                        oma vasteaika, ja se kysytään jälkikäteen. */}
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-danger-ink tabular-nums">
                        {kulunut !== null && kulunut >= 0 ? muotoileLaskuri(kulunut) : '—'}
                      </p>
                      <p className="text-xs text-ink-muted">laukesi {kellonaika(h.laukesi)}</p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mb-3">
                    <div>
                      <dt className="text-xs text-ink-subtle uppercase tracking-wide">Sijainti</dt>
                      <dd className="text-ink-body">
                        {h.gps
                          ? `${h.gps.lat.toFixed(5)}, ${h.gps.lon.toFixed(5)}${h.gps.tarkkuus ? ` (±${Math.round(h.gps.tarkkuus)} m)` : ''}`
                          : 'Ei sijaintitietoa'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-subtle uppercase tracking-wide">Tekstiviesti</dt>
                      <dd className={h.eskalointi?.tila === 'epaonnistui' ? 'text-danger-ink font-medium' : 'text-ink-body'}>
                        {!h.eskalointi
                          ? 'Ei lähetetty'
                          : h.eskalointi.tila === 'epaonnistui'
                            ? `EI lähtenyt: ${h.eskalointi.virhe}`
                            : `${h.eskalointi.vastaanottajia} numeroon${h.eskalointi.tila === 'kuivaharjoittelu' ? ' (kuivaharjoittelu)' : ''}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-subtle uppercase tracking-wide">Kohteen osoite</dt>
                      <dd className="text-ink-body">{kohde?.address || '—'}</dd>
                    </div>
                  </dl>

                  {/* Numerot joihin päivystäjä soittaa. Kohteen hälytysnumerot ensin:
                      man-down-tilanteessa soitetaan oman liikkeen päivystäjälle, ei
                      toimeksiantajalle. */}
                  {(kohde?.halytysNumerot?.length || kohde?.contactPhone) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(kohde?.halytysNumerot || []).map((numero) => (
                        <a
                          key={numero.numero}
                          href={`tel:${numero.numero}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold bg-danger-soft text-danger-ink border border-danger/30 hover:brightness-95 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Phone size={13} />
                          {numero.nimi ? `${numero.nimi} · ` : ''}{numero.numero}
                        </a>
                      ))}
                      {kohde?.contactPhone && (
                        <a
                          href={`tel:${kohde.contactPhone}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium bg-sunken text-ink-body border border-line hover:bg-surface px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Phone size={13} />
                          {kohde.contactName || 'Kohteen yhteyshenkilö'} · {kohde.contactPhone}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Lähimmät. Sijainti on ehto: ilman sitä etäisyyttä ei voi laskea eikä
                      arvausta pidä esittää vastauksena. */}
                  {h.gps && sijaintiseuranta && (
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => haeLahimmat(h)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-ink bg-accent-soft border border-accent/30 hover:brightness-95 px-3 py-1.5 rounded-lg transition-all"
                      >
                        <MapPin size={13} />
                        Kuka on lähinnä?
                      </button>
                      {lahimmat[h.id] === 'ei' && (
                        <p className="text-xs text-ink-muted mt-2">
                          Sijaintiseuranta ei ole käytössä, joten kenenkään sijaintia ei tiedetä.
                        </p>
                      )}
                      {Array.isArray(lahimmat[h.id]) && (
                        (lahimmat[h.id] as { username: string; etaisyysM: number; ikaMs: number }[]).length === 0 ? (
                          <p className="text-xs text-ink-muted mt-2">Kenenkään sijaintia ei ole tiedossa.</p>
                        ) : (
                          <ul className="mt-2 space-y-1">
                            {(lahimmat[h.id] as { username: string; etaisyysM: number; ikaMs: number }[]).map((v) => (
                              <li key={v.username} className="text-xs text-ink-body flex flex-wrap gap-x-2">
                                <span className="font-medium">{v.username}</span>
                                <span>{v.etaisyysM} m</span>
                                <span className="text-ink-subtle">{ikaTekstina(v.ikaMs)}</span>
                              </li>
                            ))}
                          </ul>
                        )
                      )}
                    </div>
                  )}

                  {saaKuitata || h.vartija === kayttaja ? (
                    <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-line-soft">
                      <input
                        type="text"
                        value={huomiot[h.id] || ''}
                        onChange={(e) => setHuomiot((edelliset) => ({ ...edelliset, [h.id]: e.target.value }))}
                        placeholder="Mitä hälytyksestä seurasi? (valinnainen)"
                        className="flex-1 min-w-0 bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-strong placeholder:text-ink-subtle focus:outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        disabled={tyoskentelee}
                        onClick={() => kuittaa(h)}
                        className="inline-flex items-center justify-center gap-1.5 bg-danger hover:opacity-90 disabled:opacity-60 text-white text-sm font-bold px-4 py-2 rounded-lg transition-opacity shrink-0"
                      >
                        <Check size={16} />
                        Kuittaa hoidetuksi
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted pt-3 border-t border-line-soft">
                      Käyttäjätasollasi ei ole oikeutta kuitata toisen hälytystä.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Osio>
      </>)}

      {nayta('halytykset') && (<>
      {/* --- Ajastimet ja tarkistukset vierekkäin --------------------------------
          Sama aihe kahdesta suunnasta: mikä ajastin juoksee nyt ja miten pyydetyt
          tarkistukset päättyivät. Vierekkäin ne luetaan yhtenä kysymyksenä. */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
      <Osio pari otsikko="Käynnissä olevat ajastimet" ikoni={Timer} maara={ajastimet.length}>
        <Hakukentta
          arvo={haku('ajastimet')}
          muuta={(v) => asetaHaku('ajastimet', v)}
          paikanpitaja="Hae vartija tai kohde"
          piilotettu={ajastimet.length - ajastimetNakyvat.length}
        />
        {ajastimet.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Kukaan ei ole käynnistänyt ajastinta. Yksin työskentelevä käynnistää sen omalta
            laitteeltaan.
          </p>
        ) : ajastimetNakyvat.length === 0 ? (
          <EiOsumia haku={haku('ajastimet')} />
        ) : (
          <ul className="space-y-2">
            {ajastimetNakyvat.map((h) => {
              const aikaa = jaljella(h, nyt);
              const kohta = aikaa !== null && aikaa <= KOHTA_MS;
              return (
                <li
                  key={h.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border p-4 ${
                    kohta ? 'bg-warning-soft border-warning/40' : 'bg-surface border-line'
                  }`}
                >
                  <Timer size={18} className="text-ink-muted shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-strong">
                      {h.vartija} <span className="text-ink-muted font-normal">· {kohdeNimi(h.eventId)}</span>
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {h.kuvaus || 'Ei kuvausta siitä mitä on tekemässä'}
                      {h.kestoMin ? ` · ${h.kestoMin} min jakso` : ''}
                    </p>
                  </div>
                  <span className={`font-bold tabular-nums shrink-0 ${kohta ? 'text-warning-ink' : 'text-ink-strong'}`}>
                    {aikaa !== null && aikaa > 0 ? ajastinTeksti(aikaa) : 'Määräaika umpeutui'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Osio>

      <Osio pari otsikko="Pyydetyt tarkistukset" ikoni={ShieldCheck} maara={tarkistukset.length}>
        <Hakukentta
          arvo={haku('tarkistukset')}
          muuta={(v) => asetaHaku('tarkistukset', v)}
          paikanpitaja="Hae vartija, pyytäjä tai kohde"
          piilotettu={tarkistukset.length - tarkistuksetNakyvat.length}
        />
        {tarkistukset.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Kukaan ei ole pyytänyt tarkistusta kuluneen kahdentoista tunnin aikana.
          </p>
        ) : tarkistuksetNakyvat.length === 0 ? (
          <EiOsumia haku={haku('tarkistukset')} />
        ) : (
          <ul className="space-y-2">
            {tarkistuksetNakyvat.map(({ halytys: h, pyynto }) => {
              const tulos = tarkistuksenTulos(h, pyynto);
              return (
                <li
                  key={h.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border p-4 ${
                    tulos.hatainen ? 'bg-danger-soft border-danger/40' : 'bg-surface border-line'
                  }`}
                >
                  <ShieldCheck size={18} className="text-ink-muted shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-strong">
                      {h.vartija}{' '}
                      <span className="text-ink-muted font-normal">· {kohdeNimi(h.eventId)}</span>
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {pyynto.user || 'Hälytyskeskus'} pyysi klo {kellonaika(pyynto.ts)}
                      {' · '}
                      {tulos.teksti}
                    </p>
                  </div>
                  {/* Vastausaika on tämän listan koko tarkoitus: se on ainoa mittari
                      siitä onko vartija oikeasti tavoitettavissa. */}
                  <span
                    className={`font-bold tabular-nums shrink-0 ${
                      tulos.hatainen ? 'text-danger-ink' : 'text-ink-strong'
                    }`}
                  >
                    {tulos.vastausaika !== null
                      ? `vastasi ${ajastinTeksti(tulos.vastausaika)}`
                      : kellonaika(h.paattyi || h.laukesi)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Osio>

      </div>
      </>)}

      {nayta('kohteet') && (<>
      {/* --- Kohdetaulu ---------------------------------------------------------- */}
      <Osio otsikko="Kohteet" ikoni={Building2} maara={kohteet.length}>
        {kohteet.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Yhtään kohdetta ei ole näkyvissä.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tilanteet.map(({ kohde, tilanne }) => {
              const tyyli = KIIREYS_TYYLI[tilanne.kiireys];
              const sisalto = (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${tyyli.merkki}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-ink-strong truncate">{kohde.name}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {tilanne.viimeksi
                          ? `Viimeksi ${ikaTekstina(Math.max(0, nyt - Date.parse(tilanne.viimeksi)))}`
                          : 'Ei merkintöjä tältä vuorolta'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {tilanne.lauenneet > 0 && <Merkki taso="kriittinen">{tilanne.lauenneet} lauennut</Merkki>}
                    {tilanne.ajastimet > 0 && (
                      <Merkki taso="varoitus">
                        {tilanne.ajastimet} ajastin
                        {tilanne.seuraavaEraantyy !== null && tilanne.seuraavaEraantyy - nyt > 0
                          ? ` · ${ajastinTeksti(tilanne.seuraavaEraantyy - nyt)}`
                          : ''}
                      </Merkki>
                    )}
                    {tilanne.kierroksetKesken > 0 && <Merkki taso="perus">{tilanne.kierroksetKesken} kierros kesken</Merkki>}
                    {tilanne.skenaariotKesken > 0 && <Merkki taso="varoitus">{tilanne.skenaariotKesken} skenaario kesken</Merkki>}
                    {tilanne.kriittisetPoikkeamat > 0 && <Merkki taso="kriittinen">{tilanne.kriittisetPoikkeamat} kriittinen poikkeama</Merkki>}
                    {tilanne.avoimetPoikkeamat - tilanne.kriittisetPoikkeamat > 0 && (
                      <Merkki taso="varoitus">{tilanne.avoimetPoikkeamat - tilanne.kriittisetPoikkeamat} poikkeama</Merkki>
                    )}
                    {tilanne.kadonneetAvaimet > 0 && <Merkki taso="varoitus">{tilanne.kadonneetAvaimet} avain kadonnut</Merkki>}
                    {tilanne.tiedotteetVoimassa > 0 && <Merkki taso="perus">{tilanne.tiedotteetVoimassa} tiedote voimassa</Merkki>}
                    {tilanne.kiireys === 'rauhallinen' && (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                        <ShieldCheck size={13} />
                        Ei avoimia
                      </span>
                    )}
                  </div>
                </>
              );
              return onAvaaKohde ? (
                <button
                  key={kohde.id}
                  type="button"
                  onClick={() => onAvaaKohde(kohde)}
                  className={`text-left border rounded-xl p-4 transition-colors hover:border-line-strong ${tyyli.reuna}`}
                >
                  {sisalto}
                </button>
              ) : (
                <div key={kohde.id} className={`border rounded-xl p-4 ${tyyli.reuna}`}>{sisalto}</div>
              );
            })}
          </div>
        )}
      </Osio>
      </>)}

      {nayta('vartijat') && (<>
      {/* --- Vuorossa nyt --------------------------------------------------------

          ERI LISTA KUIN "Kentällä juuri nyt", ja ero on tämän osion koko olemassaolon syy.
          Se lista johdetaan kirjauksista: vartija joka ei ole kirjannut mitään ei näy
          siinä. Tämä lista tulee vuoroista, eli siinä on myös se hiljainen vartija —
          ja juuri hänestä päivystäjä on huolissaan.

          Pakotettu tarkistus on siksi TÄSSÄ eikä siellä. */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
      <Osio pari otsikko="Vuorossa nyt" ikoni={ShieldCheck} maara={vuorossa.length}>
        <p className="text-xs text-ink-subtle mb-3">
          Kesken olevat vuorot. Tarkistuspyyntö kysyy vartijalta "oletko kunnossa" ja
          hälyttää jos kuittausta ei tule kahdessa minuutissa — <b>myös silloin kun puhelin
          ei ole verkossa</b>, koska ajastin erääntyy palvelimella.
        </p>
        <Hakukentta
          arvo={haku('vuorossa')}
          muuta={(v) => asetaHaku('vuorossa', v)}
          paikanpitaja="Hae vartija tai kohde"
          piilotettu={vuorossa.length - vuorossaNakyvat.length}
        />
        {vuorossa.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Yhtään vuoroa ei ole käynnissä.
          </p>
        ) : vuorossaNakyvat.length === 0 ? (
          <EiOsumia haku={haku('vuorossa')} />
        ) : (
          <ul className="divide-y divide-line-soft border border-line rounded-lg overflow-hidden">
            {vuorossaNakyvat.map((v) => (
              <li key={v.id} className="px-4 py-3 bg-surface flex flex-wrap items-center gap-3">
                <ShieldCheck size={16} className="text-ink-subtle shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-strong">
                    {v.vartija}
                    <span className="text-ink-muted font-normal">
                      {' · '}{kohdeNimi(v.siteId)}
                    </span>
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {v.vuorotyyppiNimi ? `${v.vuorotyyppiNimi} · ` : ''}
                    alkoi {ikaTekstina(Math.max(0, nyt - Date.parse(v.alkoi)))} sitten
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => pakotaTarkistus(v.vartija)}
                  disabled={tarkistettava === v.vartija}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-line-strong bg-sunken text-ink-body hover:bg-surface disabled:opacity-50 transition-colors"
                  title="Pyydä vartijaa kuittaamaan nyt"
                >
                  <BellRing size={13} />
                  {tarkistettava === v.vartija ? 'Pyydetään…' : 'Pyydä tarkistus'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Osio>

      <Osio pari otsikko="Kentällä juuri nyt" ikoni={Users} maara={kentallaNyt.length}>
        <p className="text-xs text-ink-subtle mb-3">
          Johdettu siitä mitä sovellukseen on kirjattu viimeisen kahdeksan tunnin aikana.
          EI vuorolista: vartija joka ei ole kirjannut mitään ei näy tässä.
        </p>
        <Hakukentta
          arvo={haku('kentalla')}
          muuta={(v) => asetaHaku('kentalla', v)}
          paikanpitaja="Hae vartija, kohde tai toiminto"
          piilotettu={kentallaNyt.length - kentallaNakyvat.length}
        />
        {kentallaNyt.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Kukaan ei ole kirjannut mitään kuluneen kahdeksan tunnin aikana.
          </p>
        ) : kentallaNakyvat.length === 0 ? (
          <EiOsumia haku={haku('kentalla')} />
        ) : (
          <ul className="divide-y divide-line-soft border border-line rounded-lg overflow-hidden">
            {kentallaNakyvat.map((v) => {
              const aikaa = v.ajastin ? jaljella(v.ajastin, nyt) : null;
              return (
                <li key={v.vartija} className="px-4 py-3 bg-surface flex flex-wrap items-center gap-3">
                  <Activity size={16} className="text-ink-subtle shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-strong">
                      {v.vartija}
                      <span className="text-ink-muted font-normal">
                        {' · '}{v.kohteet.map((id) => kohdeNimi(id)).join(', ') || 'ei kohdetta'}
                      </span>
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {v.mita} · {ikaTekstina(Math.max(0, nyt - Date.parse(v.viimeksi)))}
                    </p>
                  </div>
                  {v.ajastin && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold border tabular-nums shrink-0 ${
                        aikaa !== null && aikaa <= KOHTA_MS
                          ? 'bg-warning-soft text-warning-ink border-warning/40'
                          : 'bg-sunken text-ink-body border-line'
                      }`}
                    >
                      <Timer size={12} />
                      {aikaa !== null && aikaa > 0 ? ajastinTeksti(aikaa) : 'umpeutui'}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Osio>

      </div>
      </>)}

      {nayta('vartijat') && (<>
      {/* --- Vartijoiden sijainnit (erä 23) --------------------------------------

          KOLMAS LISTA IHMISISTÄ, ja ero kahteen edelliseen on se mihin kysymykseen se
          vastaa. "Kentällä juuri nyt" kertoo kuka on kirjannut jotain, "Vuorossa nyt"
          kuka on töissä — tämä kertoo MISSÄ. Päivystäjä tarvitsee kaikki kolme, koska
          hiljainen vartija on vuorolistalla, kirjaava vartija toimintalistalla ja
          lähin vartija vain tällä.

          IKÄ ON YHTÄ TÄRKEÄ KUIN SIJAINTI. Selain ei paikanna taustalla lukitulla
          näytöllä, joten tämä on VIIMEKSI TIEDETTY sijainti eikä nykyinen. Ilman ikää
          lista väittäisi tietävänsä missä ihminen on nyt. */}
      <Osio otsikko="Vartijoiden sijainnit" ikoni={MapPin} maara={oikeudet.sijainnit ? sijainnit.length : null}>
        {!oikeudet.sijainnit ? (
          <EiOikeutta mita="vartijoiden sijainteihin" />
        ) : !sijaintiseuranta ? (
          // Tyhjä lista ja pois kytketty seuranta ovat eri asioita, ja sekoitettuina
          // valvomon ruutu väittäisi ettei kukaan ole missään.
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3 leading-relaxed">
            Sijaintiseuranta ei ole käytössä, joten sijainteja ei kerätä lainkaan. Tämä ei
            tarkoita ettei kukaan olisi kentällä — se tarkoittaa ettei kukaan tiedä missä.
            Seuranta kytketään palvelimella, ja se on työntekijöihin kohdistuvaa teknistä
            valvontaa: käyttöönotto vaatii yhteistoimintakäsittelyn ja informoinnin.
          </p>
        ) : sijainnit.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Yhdenkään vartijan sijaintia ei tiedetä. Sijainti vanhenee puolessa tunnissa,
            ja se päivittyy vain kun sovellus on auki.
          </p>
        ) : (
          <>
            {/* Tilajakauma. Seinätaulussa nämä ovat lukuja eivätkä painikkeita: .halke-taulu
                piilottaa button-elementit kokonaan, ja piilotettu suodatin jättäisi
                taulun näyttämään vain osan yksiköistä ilman että kukaan näkee miksi. */}
            <div className="flex flex-wrap gap-2 mb-3">
              {TILAT.filter((t) => (tilaMaarat.get(t) || 0) > 0).map((t) => {
                const maara = tilaMaarat.get(t) || 0;
                const valittu = tilaSuodatin.has(t);
                const sisalto = (
                  <>
                    <TilaMerkki tila={t} />
                    {TILAN_NIMI[t]}
                    <span className="tabular-nums opacity-70">{maara}</span>
                  </>
                );
                const luokat = 'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border';
                return taulu ? (
                  <span key={t} className={`${luokat} bg-sunken text-ink-body border-line`}>{sisalto}</span>
                ) : (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTilaSuodatin((edellinen) => {
                      const uusi = new Set(edellinen);
                      if (uusi.has(t)) uusi.delete(t); else uusi.add(t);
                      return uusi;
                    })}
                    aria-pressed={valittu}
                    className={`${luokat} transition-colors ${
                      valittu
                        ? 'bg-action text-ink-on-dark border-action'
                        : 'bg-surface text-ink-body border-line hover:bg-sunken'
                    }`}
                  >
                    {sisalto}
                  </button>
                );
              })}
              {tilaSuodatin.size > 0 && !taulu && (
                <button
                  type="button"
                  onClick={() => setTilaSuodatin(new Set())}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink-muted hover:text-ink-strong"
                >
                  <X size={12} /> Poista rajaus
                </button>
              )}
            </div>

            {/* PUUTTUVA OIKEUS EI SAA NÄYTTÄÄ VAPAALTA. Kierros on yksi neljästä tilasta,
                ja ilman lukuoikeutta kierroslista tulee tänne tyhjänä — jolloin
                kierroksella oleva vartija näkyisi vihreänä ja hänelle lähetettäisiin
                keikka. Osio ei voi korjata sitä, mutta se voi sanoa sen. */}
            {!oikeudet.kierrokset && (
              <p className="text-xs text-warning-ink bg-warning-soft border border-warning/40 rounded-lg px-3 py-2 mb-3 leading-relaxed">
                Sinulla ei ole lukuoikeutta kierroksiin, joten kierroksella oleva yksikkö
                näkyy tässä vapaana.
              </p>
            )}

            <ul className="divide-y divide-line-soft border border-line rounded-lg overflow-hidden">
              {suodatetutYksikot.map(({ sijainti: s, tila, tehtavaId, kierrosId }) => (
                <li key={s.username} className="px-4 py-3 bg-surface flex flex-wrap items-center gap-3">
                  <TilaMerkki tila={tila} iso />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-strong">
                      {s.nimi || s.username}
                      <span className="text-ink-muted font-normal">
                        {' · '}{s.eventId ? kohdeNimi(s.eventId) : 'ei kohdetta'}
                      </span>
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {/* MIHIN yksikkö on kiinni, ei vain että se on. Irrotuspäätös on
                          päivystäjän, ja "kierroksella" yksin ei kerro mitä hän
                          keskeyttäisi — yökierros ja kolmen minuutin ovenavaus ovat eri
                          hintaisia keskeytyksiä. */}
                      {TILAN_NIMI[tila]}
                      {(() => {
                        // Löytymätön tehtävä tai kierros EI saa tuottaa arvausta: tyhjä
                        // selite on oikein, keksitty laji olisi väärää tietoa
                        // irrotuspäätöksen pohjaksi.
                        const t = tehtavaId ? tehtavat.find((x) => x.id === tehtavaId) : null;
                        if (t) return <span>{`: ${LAJIN_NIMI[t.laji]} · ${t.siteNimi}`}</span>;
                        const k = kierrosId ? lahteet.kierrokset.find((x) => x.id === kierrosId) : null;
                        if (k) return <span>{`: ${k.templateNimi}`}</span>;
                        return null;
                      })()}
                      <span className="tabular-nums">
                        {' · '}
                        {s.gps
                          ? `${s.gps.lat.toFixed(5)}, ${s.gps.lon.toFixed(5)}`
                            + (s.gps.tarkkuus !== null ? ` · ±${Math.round(s.gps.tarkkuus)} m` : '')
                          : 'vain pohjakartalla'}
                      </span>
                      {/* Nopeus näytetään vain liikkeessä. Nolla metriä sekunnissa on
                          rivillä pelkkää kohinaa, ja "0 km/h" seisovan yksikön kohdalla
                          näyttäisi mittaukselta vaikka laite ei anna nopeutta lainkaan
                          silloin kun se ei liiku. */}
                      {typeof s.gps?.nopeus === 'number' && s.gps.nopeus > 1 && (
                        <span className="tabular-nums">
                          {' · '}{Math.round(s.gps.nopeus * 3.6)} km/h
                        </span>
                      )}
                      {/* Selain paikantaa vain näkyvissä ollessaan. Tämä on se selitys
                          jonka päivystäjä tarvitsee kun ikä kasvaa: laitteella vanha
                          sijainti on vika, selaimella se on normaalia. */}
                      {s.lahde === 'selain' && s.ikaMs > 10 * 60_000 && (
                        <span>{' · '}selain taustalla</span>
                      )}
                    </p>
                  </div>
                  {/* Vanhentuva sijainti nostetaan varoitusväreihin. Puoli tuntia on se
                      raja jolla palvelin unohtaa sijainnin kokonaan (server/sijainti.js),
                      joten kymmenen minuutin jälkeen tieto on jo matkalla pois. */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold border shrink-0 ${
                      s.ikaMs > 10 * 60_000
                        ? 'bg-warning-soft text-warning-ink border-warning/40'
                        : 'bg-sunken text-ink-body border-line'
                    }`}
                  >
                    <Activity size={12} />
                    {ikaTekstina(s.ikaMs)}
                  </span>
                </li>
              ))}
              {suodatetutYksikot.length === 0 && (
                <li className="px-4 py-3 bg-surface text-sm text-ink-muted">
                  Yksikään yksikkö ei ole valitussa tilassa.
                </li>
              )}
            </ul>
          </>
        )}
      </Osio>
      </>)}

      {nayta('tausta') && (<>
      {/* --- Kierrokset ja kalusto vierekkäin ------------------------------------ */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
      <Osio pari otsikko="Kierrokset kesken" ikoni={Route} maara={oikeudet.kierrokset ? kierroksetKesken.length : null}>
        {!oikeudet.kierrokset ? (
          <EiOikeutta mita="kierroksiin" />
        ) : kierroksetKesken.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Yhtään kierrosta ei ole kesken.
          </p>
        ) : (
          <ul className="space-y-2">
            {kierroksetKesken.map((k) => {
              const kuitatut = (k.pisteet || []).filter((p) => p.kuitattu).length;
              const kaikki = (k.pisteet || []).length;
              const viimeisin = (k.pisteet || [])
                .map((p) => p.kuitattu)
                .filter((p): p is string => !!p)
                .sort()
                .pop();
              return (
                <li key={k.id} className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-center gap-3">
                  <Route size={18} className="text-ink-muted shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-strong">
                      {k.templateNimi}
                      <span className="text-ink-muted font-normal"> · {k.vartija} · {kohdeNimi(k.siteId)}</span>
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Alkoi {kellonaika(k.alkoi)}
                      {viimeisin ? ` · viimeisin piste ${kellonaika(viimeisin)}` : ' · ei vielä yhtään pistettä'}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-ink-body tabular-nums shrink-0">
                    {kuitatut}/{kaikki} pistettä
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Osio>

      <Osio
        pari
        otsikko="Avoimet poikkeamat ja kadonneet avaimet"
        ikoni={KeyRound}
        maara={oikeudet.kalusto ? avoimetPoikkeamat.length + kadonneetAvaimet.length : null}
      >
        {!oikeudet.kalusto ? (
          <EiOikeutta mita="kalustoon" />
        ) : avoimetPoikkeamat.length === 0 && kadonneetAvaimet.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Ei avoimia varustepoikkeamia eikä kadonneita avaimia.
          </p>
        ) : (
          <ul className="space-y-2">
            {avoimetPoikkeamat.map((p) => (
              <li
                key={p.id}
                className={`rounded-lg border p-4 ${
                  p.vakavuus === 'kriittinen' ? 'bg-danger-soft border-danger/40' : 'bg-surface border-line'
                }`}
              >
                <p className={`text-sm font-medium ${p.vakavuus === 'kriittinen' ? 'text-danger-ink' : 'text-ink-strong'}`}>
                  {p.varuste}
                  <span className="font-normal"> · {kohdeNimi(p.ownerId)} · {p.ilmoittaja}</span>
                </p>
                {p.kuvaus && <p className="text-xs text-ink-muted mt-0.5">{p.kuvaus}</p>}
              </li>
            ))}
            {kadonneetAvaimet.map((a) => (
              <li key={a.id} className="rounded-lg border border-warning/40 bg-warning-soft p-4">
                <p className="text-sm font-medium text-warning-ink">
                  Avain {a.tunnus} · {AVAIMEN_TILA[a.tila]}
                  <span className="font-normal"> · {kohdeNimi(a.ownerId)}</span>
                </p>
                <p className="text-xs text-warning-ink/90 mt-0.5">
                  {a.kuvaus || 'Ei kuvausta'}{a.haltija ? ` · viimeksi ${a.haltija}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Osio>

      </div>
      </>)}

      {nayta('tausta') && (<>
      {/* --- Tiedotteet ---------------------------------------------------------- */}
      <Osio otsikko="Voimassa olevat tiedotteet" ikoni={Megaphone} maara={oikeudet.tiedotteet ? voimassaTiedotteet.length : null}>
        {!oikeudet.tiedotteet ? (
          <EiOikeutta mita="tiedotteisiin" />
        ) : voimassaTiedotteet.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Ei voimassa olevia tiedotteita.
          </p>
        ) : (
          <ul className="space-y-2">
            {voimassaTiedotteet.map((t) => (
              <li key={t.id} className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-start gap-3">
                <MessageSquare size={16} className="text-ink-subtle shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-strong">
                    {t.otsikko}
                    <span className="text-ink-muted font-normal"> · {kohdeNimi(t.ownerId)}</span>
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {t.laatija} · {kellonaika(t.luotu)} · voimassa {t.voimassaTuntia} h
                  </p>
                </div>
                {/* Kuittausten määrä eikä osuus: kuittaajien joukkoa ei lasketa selaimessa
                    (se ratkaistaan oikeuksista palvelimella), eikä murtolukua saa esittää
                    jos nimittäjää ei tiedetä. */}
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-sunken text-ink-body border border-line shrink-0">
                  <Check size={12} />
                  {(t.kuittaukset || []).length === 1 ? "1 kuittaus" : `${(t.kuittaukset || []).length} kuittausta`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Osio>
      </>)}

      {nayta('tausta') && (<>
      {/* --- Tapahtumavirta ------------------------------------------------------ */}
      <Osio otsikko="Tapahtumavirta" ikoni={History} maara={null}>
        <p className="text-xs text-ink-subtle mb-3">
          Viimeisimmät merkinnät kaikista kohteista aikajärjestyksessä. Näyttää vain sen
          mihin sinulla on lukuoikeus.
        </p>
        <Hakukentta
          arvo={haku('virta')}
          muuta={(v) => asetaHaku('virta', v)}
          paikanpitaja="Hae tapahtuma, vartija tai kohde"
          piilotettu={virta.length - virtaNakyva.length}
        />
        {virta.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Ei merkintöjä.
          </p>
        ) : virtaNakyva.length === 0 ? (
          <EiOsumia haku={haku('virta')} />
        ) : (
          <ul className="divide-y divide-line-soft border border-line rounded-lg overflow-hidden">
            {virtaNakyva.map((t) => (
              <li key={t.id} className="px-4 py-2.5 bg-surface flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xs text-ink-subtle tabular-nums shrink-0 w-12">{kellonaika(t.ts)}</span>
                <span className={`text-sm font-medium ${VIRRAN_TYYLI[t.taso]}`}>{t.otsikko}</span>
                <span className="text-xs text-ink-muted min-w-0 flex-1">
                  {t.teksti}
                  {t.kuka ? ` · ${t.kuka}` : ''}
                </span>
                <span className="text-xs text-ink-subtle shrink-0">{kohdeNimi(t.kohdeId)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-ink-subtle">Näytä viimeisimmät</span>
          {[10, 20, 30].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setVirtaMaara(n)}
              aria-pressed={virtaMaara === n}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
                virtaMaara === n
                  ? 'bg-accent-soft text-accent-ink border-accent/40'
                  : 'bg-surface text-ink-body border-line hover:bg-sunken'
              }`}
            >
              {n}
            </button>
          ))}
          {/* Sanotaan ääneen kun lista on lyhyempi kuin valinta. Muuten "30" valittuna ja
              kaksitoista riviä näkyvissä näyttäisi siltä että loput jäivät piiloon. */}
          {virta.length < virtaMaara && (
            <span className="text-xs text-ink-subtle">
              — merkintöjä on {virta.length}
            </span>
          )}
        </div>
      </Osio>
      </>)}

    </div>
  );
};

// --- Näkymän pienet osat ------------------------------------------------------------

const KOROSTUS: Record<Kiireys, string> = {
  kriittinen: 'border-danger/40 bg-danger-soft text-danger-ink',
  varoitus: 'border-warning/40 bg-warning-soft text-warning-ink',
  rauhallinen: 'border-line bg-surface text-ink-strong',
};

const Luku = ({
  ikoni: Ikoni, arvo, nimi, korosta = 'rauhallinen',
}: {
  ikoni: LucideIcon;
  arvo: number | string;
  nimi: string;
  korosta?: Kiireys;
}) => (
  <div className={`rounded-xl border p-4 ${KOROSTUS[korosta]}`}>
    <Ikoni size={16} className="mb-2 opacity-70" />
    <p className="text-2xl font-bold tabular-nums leading-none">{arvo}</p>
    <p className="text-xs mt-1.5 opacity-80">{nimi}</p>
  </div>
);

const Osio = ({
  otsikko, ikoni: Ikoni, maara, kiire = false, pari = false, children,
}: {
  otsikko: string;
  ikoni: LucideIcon;
  maara: number | null;
  kiire?: boolean;
  // Osio on vierekkäisparissa: alamarginaali pois, koska väli tulee ruudukon gapista.
  // Ilman tätä parin osiot saisivat ylimääräisen 2 rem:n hännän toistensa alle.
  pari?: boolean;
  children: ReactNode;
}) => (
  <section className={pari ? 'min-w-0' : 'mb-8'}>
    <h3 className={`text-base font-bold mb-2 flex items-center gap-2 ${kiire ? 'text-danger-ink' : 'text-ink-strong'}`}>
      <Ikoni size={17} />
      {otsikko}
      {maara !== null && maara > 0 && (
        <span className={`font-normal ${kiire ? 'text-danger-ink' : 'text-ink-muted'}`}>({maara})</span>
      )}
    </h3>
    {children}
  </section>
);

// Puuttuva oikeus sanotaan ääneen. Tyhjä osio antaisi ymmärtää ettei kohteissa ole mitään
// menossa — se on väärä tieto valvomon ruudulla.
// Yksikön tilamerkki: värillinen ympyrä jonka sisällä on tilan kirjain.
//
// KIRJAIN EI OLE KORISTE. Vihreä, oranssi ja punainen ovat juuri se yhdistelmä jonka
// yleisin värinäön poikkeama sekoittaa, ja valvomossa virhettä ei huomaa kukaan ennen kuin
// väärä yksikkö on lähetetty väärään paikkaan. Sama merkki toistuu suodatinpainikkeessa ja
// rivillä, jotta niiden yhteys on nähtävissä eikä pääteltävissä.
//
// title-attribuutti antaa tilan nimen myös silloin kun merkki on yksin (suodattimessa
// nimi on vieressä, rivillä se on alarivillä).
const TilaMerkki = ({ tila, iso = false }: { tila: Tila; iso?: boolean }) => (
  <span
    title={TILAN_NIMI[tila]}
    aria-label={TILAN_NIMI[tila]}
    className={`inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 ${
      iso ? 'w-6 h-6 text-[11px]' : 'w-4 h-4 text-[9px]'
    }`}
    style={{ backgroundColor: TILAN_VARI[tila] }}
  >
    {TILAN_KIRJAIN[tila]}
  </span>
);

const EiOikeutta = ({ mita }: { mita: string }) => (
  <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
    Käyttäjätasollasi ei ole lukuoikeutta {mita}. Tämä osio ei siis kerro tilanteesta
    mitään — pyydä oikeus pääkäyttäjältä jos päivystät.
  </p>
);

const Merkki = ({ taso, children }: { taso: 'kriittinen' | 'varoitus' | 'perus'; children: ReactNode }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
      taso === 'kriittinen'
        ? 'bg-danger-soft text-danger-ink border-danger/30'
        : taso === 'varoitus'
          ? 'bg-warning-soft text-warning-ink border-warning/30'
          : 'bg-sunken text-ink-body border-line'
    }`}
  >
    {children}
  </span>
);

