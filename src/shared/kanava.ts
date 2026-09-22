// Kanavayhteys palvelimeen (WebSocket). Jaettu: YKSI soketti koko selainvälilehteä
// kohden, vaikka useKanava-hookia kutsuttaisiin useasta komponentista yhtä aikaa (ks.
// tiedoston loppuosan "Jaettu yhteys" -osio) — kahta rinnakkaista yhteyttä samaan
// istuntoon ei kannata avata.
//
// Kanava kertoo VAIN mikä kokoelma muuttui ja mitkä id:t. Sisältö haetaan normaalilla
// GET-pyynnöllä, joka käy läpi saman oikeustarkistuksen kuin ennenkin — ks.
// server/kanava.js:n sama perustelu. Tämän tiedoston tehtävä on siis herättää haku, ei
// tuoda dataa.

import { useEffect, useRef, useState } from 'react';

export type Muutos = { action: 'create' | 'update' | 'delete'; id: string; eventId: string | null };

export type Sijainti = {
  username: string;
  // Nimimerkki. Valinnainen, koska kanavan työntämä sijainti tulee suoraan
  // sijaintikerroksesta eikä käy käyttäjärekisterin kautta — listahaku täydentää sen.
  nimi?: string;
  eventId: string | null;
  img: { x: number; y: number } | null;
  gps: {
    lat: number;
    lon: number;
    tarkkuus: number | null;
    // Nopeus (m/s) ja kulkusuunta (astetta, 0 = pohjoinen). Molemmat voivat puuttua:
    // laite antaa ne vain liikkeessä, ja tukiasemapaikannus ei koskaan.
    nopeus?: number | null;
    suunta?: number | null;
  } | null;
  at: number;
  ikaMs: number;
  // Tuliko päivitys selaimesta vai natiivisovelluksesta. Vastaa käyttöliittymässä
  // kysymykseen "miksi tämä piste on vanha": selain paikantaa vain näkyvissä ollessaan.
  // Valinnainen, koska vanhemmat palvelinversiot eivät lähetä kenttää.
  lahde?: 'selain' | 'laite';
};

// PTT floor control (erä 26, vaihe 1b). `kayttaja` puuttuu hylkäyksestä jos kanava oli
// vapaa mutta pyyntö silti hylättiin (ei pitäisi tapahtua, mutta tyyppi ei saa valehdella).
export type PuheenvuoroTila = { kanavaId: string; kayttaja: string };

export type KanavaViesti =
  | { tyyppi: 'tervetuloa'; kayttaja: string }
  | { tyyppi: 'muutos'; kokoelma: string; muutokset: Muutos[] }
  | { tyyppi: 'sijainnit'; eventId: string | null; sijainnit: Sijainti[] }
  | { tyyppi: 'puheenvuoro_myonnetty'; kanavaId: string; kayttaja: string }
  | { tyyppi: 'puheenvuoro_hylatty'; kanavaId: string; syy: string; kayttaja: string | null }
  | { tyyppi: 'puheenvuoro_vapautui'; kanavaId: string }
  | { tyyppi: 'puheenvuoro_tila'; tilat: PuheenvuoroTila[] }
  // Linjan pakotus (erä 26, vaihe 1e). HÄLKE pakotti hätäkanavan linjan auki tai vapautti
  // pakotuksen — menee vain hälyttäjän omalle laitteelle (server/index.js: suodatin).
  // Käsky EI myönnä puheenvuoroa: asiakas pyytää sen itse tämän jälkeen tavallisella
  // `pyyda_puheenvuoro`-lähetyksellä.
  | { tyyppi: 'linja_pakotettu_auki'; kanavaId: string; pakottaja: string }
  | { tyyppi: 'linjan_pakotus_vapautettu'; kanavaId: string }
  // Laitteelle on saapunut kohdennettu to-device-viesti (erä 26, vaihe 2, viipale 2c) —
  // ei sisällä itse viestiä, vain herätteen. Asiakas hakee sisällön
  // GET /api/kanavat/avaimet/laitteelle:sta (src/shared/olm.ts).
  | { tyyppi: 'laiteviesti_saapui' }
  // Uusi tekstiviesti kanavalla (erä 26, vaihe 3). Oma tyyppi eikä geneerinen 'muutos',
  // koska asiakkaan on tiedettävä MIKÄ kanava sai viestin — sisältö haetaan erikseen
  // (src/shared/viestit.ts), tämä on vain heräte.
  | { tyyppi: 'uusi_viesti'; kanavaId: string; viestiId: string }
  // Viesti kuitattu (erä 26, vaihe 3, viipale 3c) — toimitus tai (vain hätäkanavalla)
  // luku. `kuittaustyyppi` on 'toimitus' | 'luku', ei tiukemmin tyypitetty koska
  // palvelin on jo tarkistanut sen sallituksi (server/kuittaukset.js).
  | { tyyppi: 'viesti_kuitattu'; kanavaId: string; viestiId: string; kayttaja: string; kuittaustyyppi: string }
  // PTT-äänen kuljetus (erä 26, vaihe 6: kuljetusratkaisu). Vain haltija saa lähettää
  // kumpaakaan (server/index.js: kasitteleAaniAvain/kasitteleAaniKehys tarkistavat
  // onHaltija joka viestin kohdalla) — kaikki tälle kanavalle kuunteleva saa molemmat.
  //
  // `aani_avain`: `tapahtuma` on Megolm-salattu tapahtumaolio JSON-merkkijonona (sama
  // muoto kuin src/shared/olm.ts:n salaaViesti palauttaa), sisältäen kertakäyttöisen
  // AES-avaimen (src/shared/aanisalaus.ts) — EI kanavan pysyvää huoneavainta.
  //
  // `aani_kehys`: `data` on sillä avaimella jo AES-GCM-salattu äänikehys base64:nä
  // (src/shared/aaniraaka.ts:n pakkaaOpusKehys + aanisalaus.ts:n salaaKehys -tulos).
  | { tyyppi: 'aani_avain'; kanavaId: string; tapahtuma: string }
  | { tyyppi: 'aani_kehys'; kanavaId: string; data: string };

type Kasittelijat = {
  onMuutos?: (kokoelma: string, muutokset: Muutos[]) => void;
  onSijainnit?: (sijainnit: Sijainti[]) => void;
  onPuheenvuoroMyonnetty?: (kanavaId: string, kayttaja: string) => void;
  onPuheenvuoroHylatty?: (kanavaId: string, syy: string, kayttaja: string | null) => void;
  onPuheenvuoroVapautui?: (kanavaId: string) => void;
  onPuheenvuoroTila?: (tilat: PuheenvuoroTila[]) => void;
  onLinjaPakotettuAuki?: (kanavaId: string, pakottaja: string) => void;
  onLinjanPakotusVapautettu?: (kanavaId: string) => void;
  onLaiteviestiSaapui?: () => void;
  onUusiViesti?: (kanavaId: string, viestiId: string) => void;
  onViestiKuitattu?: (kanavaId: string, viestiId: string, kayttaja: string, kuittaustyyppi: string) => void;
  onAaniAvain?: (kanavaId: string, tapahtuma: string) => void;
  onAaniKehys?: (kanavaId: string, data: string) => void;
};

// Uudelleenyhdistys kasvavalla viiveellä. Kiinteä lyhyt viive tarkoittaisi sitä, että
// palvelimen uudelleenkäynnistyksen aikana jokainen avoin selain hakkaa sitä sekunnin
// välein juuri kun se yrittää nousta pystyyn.
const VIIVE_MIN_MS = 1_000;
const VIIVE_MAX_MS = 30_000;

const kanavanOsoite = () => {
  const protokolla = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protokolla}//${window.location.host}/api/kanava`;
};

function kasitteleSaapunutViesti(kasittelija: Kasittelijat, viesti: KanavaViesti) {
  if (viesti?.tyyppi === 'muutos' && viesti.kokoelma) {
    kasittelija.onMuutos?.(viesti.kokoelma, viesti.muutokset || []);
  } else if (viesti?.tyyppi === 'sijainnit') {
    kasittelija.onSijainnit?.(viesti.sijainnit || []);
  } else if (viesti?.tyyppi === 'puheenvuoro_myonnetty') {
    kasittelija.onPuheenvuoroMyonnetty?.(viesti.kanavaId, viesti.kayttaja);
  } else if (viesti?.tyyppi === 'puheenvuoro_hylatty') {
    kasittelija.onPuheenvuoroHylatty?.(viesti.kanavaId, viesti.syy, viesti.kayttaja ?? null);
  } else if (viesti?.tyyppi === 'puheenvuoro_vapautui') {
    kasittelija.onPuheenvuoroVapautui?.(viesti.kanavaId);
  } else if (viesti?.tyyppi === 'puheenvuoro_tila') {
    kasittelija.onPuheenvuoroTila?.(viesti.tilat || []);
  } else if (viesti?.tyyppi === 'linja_pakotettu_auki') {
    kasittelija.onLinjaPakotettuAuki?.(viesti.kanavaId, viesti.pakottaja);
  } else if (viesti?.tyyppi === 'linjan_pakotus_vapautettu') {
    kasittelija.onLinjanPakotusVapautettu?.(viesti.kanavaId);
  } else if (viesti?.tyyppi === 'laiteviesti_saapui') {
    kasittelija.onLaiteviestiSaapui?.();
  } else if (viesti?.tyyppi === 'uusi_viesti') {
    kasittelija.onUusiViesti?.(viesti.kanavaId, viesti.viestiId);
  } else if (viesti?.tyyppi === 'viesti_kuitattu') {
    kasittelija.onViestiKuitattu?.(viesti.kanavaId, viesti.viestiId, viesti.kayttaja, viesti.kuittaustyyppi);
  } else if (viesti?.tyyppi === 'aani_avain') {
    kasittelija.onAaniAvain?.(viesti.kanavaId, viesti.tapahtuma);
  } else if (viesti?.tyyppi === 'aani_kehys') {
    kasittelija.onAaniKehys?.(viesti.kanavaId, viesti.data);
  }
}

// --- Jaettu yhteys (erä 26, vaihe 5, viimeistely) ------------------------------------
//
// YKSI SOKETTI KOKO SELAINVÄLILEHTEÄ KOHDEN, RIIPPUMATTA MONTAKO useKanava-KUTSUA ON
// AUKI SAMAAN AIKAAN. Tiedoston yläkommentti ("ei kahta rinnakkaista yhteyttä samaan
// istuntoon kannata avata") oli aiemmin vain toive, koska joka useKanava-kutsu avasi
// oman soketin — GUARD-mobiilin PTT-kanavapalkki (src/guard/mobiili/kayttoPttPalkkia.ts)
// joutui siksi väliaikaisesti avaamaan oman rinnakkaisen yhteytensä GuardAppin yhteyden
// lisäksi (dokumentoitu tekninen velka, ks. Obsidian "vaihe 5 -suunnitelma"). Tästä
// eteenpäin `useKanava` on TILAAJA jaettuun yhteyteen: ensimmäinen kutsu avaa soketin,
// viimeisen sulkeutuessa se suljetaan, ja jokainen välissä oleva kutsu jakaa saman
// soketin ja saa kaikki samat viestit. Tämä ei ole vain PTT:n korjaus — se pitää myös
// alkuperäisen App.tsx/GuardApp.tsx-käytön (yksi tilaaja) täsmälleen ennallaan.
type Tilaaja = { kasittelija: { current: Kasittelijat }; setYhdistetty: (yhd: boolean) => void };

let soketti: WebSocket | null = null;
let ajastin: ReturnType<typeof setTimeout> | null = null;
let viive = VIIVE_MIN_MS;
const tilaajat = new Set<Tilaaja>();

function ilmoitaTila(yhd: boolean) {
  for (const t of tilaajat) t.setYhdistetty(yhd);
}

function yhdista() {
  if (soketti || tilaajat.size === 0) return;
  let ws: WebSocket;
  try {
    ws = new WebSocket(kanavanOsoite());
  } catch {
    aikatauluUudelleenyhdistys();
    return;
  }
  // Asetetaan HETI eikä vasta onopenissa: kaksi tilaajaa voi liittyä samassa
  // React-committissa peräkkäin ennen kuin kumpikaan soketti ehtii edes avautua, ja
  // ilman tätä molemmat ohittaisivat yllä olevan `if (soketti ...)`-vartijan ja
  // avaisivat kumpikin oman soketin — mitattu suoraan selaimessa ennen korjausta
  // (kaksi WebSocket-instanssia yhden sijaan). readyState on CONNECTING (0) kunnes
  // onopen ajaa, joten `yhdistetty`/`laheta` eivät luule yhteyden olevan valmis liian
  // aikaisin — molemmat tarkistavat erikseen readyState === OPEN.
  soketti = ws;

  ws.onopen = () => {
    viive = VIIVE_MIN_MS;
    ilmoitaTila(true);
  };

  ws.onmessage = (e) => {
    let viesti: KanavaViesti;
    try {
      viesti = JSON.parse(e.data);
    } catch {
      return;
    }
    // Kopio ennen silmukkaa: kasittelija voisi tilaajien poistuessa/liittyessä muuttaa
    // Setin sisältöä kesken iteroinnin, mikä olisi määrittelemätöntä JS:n Setille.
    for (const tilaaja of [...tilaajat]) kasitteleSaapunutViesti(tilaaja.kasittelija.current, viesti);
  };

  ws.onclose = () => {
    soketti = null;
    ilmoitaTila(false);
    aikatauluUudelleenyhdistys();
  };

  // Virhe johtaa aina myös oncloseen, joten uudelleenyhdistys hoidetaan siellä.
  ws.onerror = () => {};
}

function aikatauluUudelleenyhdistys() {
  if (ajastin || tilaajat.size === 0) return;
  ajastin = setTimeout(() => {
    ajastin = null;
    viive = Math.min(viive * 2, VIIVE_MAX_MS);
    yhdista();
  }, viive);
}

// Lähetys kentältä palvelimelle. Hiljainen ei-mitään jos yhteyttä ei ole: sijainti on
// hetkellinen tieto, ja jonoon jäänyt vanha sijainti kertoisi missä joku oli silloin
// kun verkko katkesi — se on huonompi tieto kuin ei tietoa lainkaan. Moduulitason
// funktio eikä hookin sisäinen: identiteetti on jo pysyvä sellaisenaan, mitään
// useRefiä ei tarvita sen stabiloimiseen.
function laheta(viesti: Record<string, unknown>): boolean {
  if (!soketti || soketti.readyState !== WebSocket.OPEN) return false;
  try {
    soketti.send(JSON.stringify(viesti));
    return true;
  } catch {
    return false;
  }
}

export function useKanava(kasittelijat: Kasittelijat) {
  // Käsittelijät refissä: yhteyttä EI saa avata uudelleen joka kerta kun kutsuja
  // renderöityy ja antaa uudet funktiot. Ilman tätä jokainen renderöinti katkaisisi ja
  // avaisi soketin uudelleen.
  const kasittelija = useRef(kasittelijat);
  kasittelija.current = kasittelijat;
  const [yhdistetty, setYhdistetty] = useState(soketti?.readyState === WebSocket.OPEN);

  useEffect(() => {
    const tilaaja: Tilaaja = { kasittelija, setYhdistetty };
    tilaajat.add(tilaaja);
    // Jaettu soketti on voinut olla auki jo ennen tätä tilaajaa (toinen komponentti
    // liittyi ensin) — tila on silloin ilmoitettava heti, koska mitään uutta
    // onopen-tapahtumaa ei enää tule tälle tilaajalle.
    setYhdistetty(soketti?.readyState === WebSocket.OPEN);
    yhdista();

    return () => {
      tilaajat.delete(tilaaja);
      // Viimeinen tilaaja sulkee soketin — ei jätetä sitä roikkumaan ilman kuuntelijaa.
      if (tilaajat.size === 0) {
        if (ajastin) {
          clearTimeout(ajastin);
          ajastin = null;
        }
        if (soketti) {
          const vanha = soketti;
          soketti = null;
          vanha.onclose = null;
          vanha.close();
        }
      }
    };
  }, []);

  return { yhdistetty, laheta };
}
