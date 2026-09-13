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
  History, Wifi, WifiOff, BellRing,
} from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { muotoileLaskuri } from '../shared/ajat';
import {
  TYYPPI_LABEL, ajastinTeksti, jaljella, kellonaika, kuittaaHalytys, type Halytys,
} from '../shared/halytykset';
import { AVAIMEN_TILA } from '../shared/kalusto';
import { onVoimassa } from '../shared/tiedotteet';
import { ikaTekstina } from '../shared/sijainninLahetys';
import {
  kentalla, kohteenTilanne, tapahtumavirta, type Kiireys, type Lahteet,
} from './tilannekuva';
import type { Kohde } from './tyypit';

// Osioiden lukuoikeudet. Hälytyskeskus ei myönnä yhtään uutta lukuoikeutta: se näyttää
// saman datan jonka käyttäjä näkee muutenkin, kootusti. Lipuilla osio osaa sanoa eron
// "ei tapahtumia" ja "ei oikeutta nähdä" välillä.
type Oikeudet = {
  kierrokset: boolean;
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

// Lyhyt äänimerkki ilman ääniraitatiedostoa. Oma oskillaattorinsa siksi, että mp3 pitäisi
// ladata verkosta juuri sillä hetkellä kun sitä tarvitaan — eli silloin kun verkko voi
// olla poikki. Selain vaatii käyttäjän eleen ennen äänen soittamista, ja se ele on
// äänimerkin päälle kytkeminen.
function piippaa() {
  try {
    const Konteksti = window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Konteksti) return;
    const konteksti = new Konteksti();
    const soita = (alkuS: number, taajuus: number) => {
      const oskillaattori = konteksti.createOscillator();
      const voimakkuus = konteksti.createGain();
      oskillaattori.type = 'square';
      oskillaattori.frequency.value = taajuus;
      voimakkuus.gain.value = 0.12;
      oskillaattori.connect(voimakkuus);
      voimakkuus.connect(konteksti.destination);
      oskillaattori.start(konteksti.currentTime + alkuS);
      oskillaattori.stop(konteksti.currentTime + alkuS + 0.22);
    };
    soita(0, 880);
    soita(0.3, 1175);
    soita(0.6, 880);
    window.setTimeout(() => konteksti.close().catch(() => {}), 1500);
  } catch {
    // Ääni on lisä eikä toiminto: sen epäonnistuminen ei saa kaataa näkymää.
  }
}

const AANI_AVAIN = 'turvajohto-halke-aani';

export const Halytyskeskus = ({
  kohteet, lahteet, kayttaja, saaKuitata, oikeudet, yhteys, sijaintiseuranta,
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
  // Tapahtumavirran pituus. Oletus 10 eikä 40: virta on silmäiltävä lista siitä mitä juuri
  // tapahtui, ja neljänkymmenen rivin mittaisena se työntää kaiken muun pois ruudulta.
  // Pidemmät valinnat ovat siellä missä ne tarvitaan — listan alla, kun kymmenen ei
  // riittänyt.
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
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        for (const h of uudet) {
          new Notification(`HÄLYTYS · ${kohdeNimi(h.eventId)}`, {
            body: `${TYYPPI_LABEL[h.tyyppi]} · ${h.vartija}${h.kuvaus ? ` — ${h.kuvaus}` : ''}`,
            tag: h.id,
          });
        }
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
    piippaa();
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch {
      // Lupaa ei saatu. Äänimerkki toimii silti.
    }
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

  return (
    <div>
      <TakaisinLinkki onClick={onTakaisin}>Takaisin etusivulle</TakaisinLinkki>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ink-strong mb-1">Hälytyskeskus</h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Kaikkien kohteiden tilanne yhdellä ruudulla. Päivittyy itsestään —
            hälytyksiä ei tarvitse hakea.
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

      {/* --- Lauenneet hälytykset ------------------------------------------------ */}
      <Osio otsikko="Lauenneet hälytykset" ikoni={Siren} maara={lauenneet.length} kiire={lauenneet.length > 0}>
        {lauenneet.length === 0 ? (
          <p className="text-sm text-success-ink bg-success-soft border border-success/30 rounded-lg px-4 py-3">
            Ei lauenneita hälytyksiä.
          </p>
        ) : (
          <div className="space-y-3">
            {lauenneet.map((h) => {
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

      {/* --- Ajastimet ja tarkistukset vierekkäin --------------------------------
          Sama aihe kahdesta suunnasta: mikä ajastin juoksee nyt ja miten pyydetyt
          tarkistukset päättyivät. Vierekkäin ne luetaan yhtenä kysymyksenä. */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
      <Osio pari otsikko="Käynnissä olevat ajastimet" ikoni={Timer} maara={ajastimet.length}>
        {ajastimet.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Kukaan ei ole käynnistänyt ajastinta. Yksin työskentelevä käynnistää sen omalta
            laitteeltaan.
          </p>
        ) : (
          <ul className="space-y-2">
            {ajastimet.map((h) => {
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
        {tarkistukset.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Kukaan ei ole pyytänyt tarkistusta kuluneen kahdentoista tunnin aikana.
          </p>
        ) : (
          <ul className="space-y-2">
            {tarkistukset.map(({ halytys: h, pyynto }) => {
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
        {vuorossa.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Yhtään vuoroa ei ole käynnissä.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft border border-line rounded-lg overflow-hidden">
            {vuorossa.map((v) => (
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
        {kentallaNyt.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Kukaan ei ole kirjannut mitään kuluneen kahdeksan tunnin aikana.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft border border-line rounded-lg overflow-hidden">
            {kentallaNyt.map((v) => {
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

      {/* --- Tapahtumavirta ------------------------------------------------------ */}
      <Osio otsikko="Tapahtumavirta" ikoni={History} maara={null}>
        <p className="text-xs text-ink-subtle mb-3">
          Viimeisimmät merkinnät kaikista kohteista aikajärjestyksessä. Näyttää vain sen
          mihin sinulla on lukuoikeus.
        </p>
        {virta.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
            Ei merkintöjä.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft border border-line rounded-lg overflow-hidden">
            {virta.map((t) => (
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

