// Kartan geometria: tarkkuuskehät ja yksiköiden pisteet GeoJSONina.
//
// OMANA MODUULINAAN JA ILMAN maplibrea, jotta geometria on testattavissa ilman selainta
// ja ilman WebGL:ää. Karttakomponentti on esitys; laskenta on täällä.
//
// TARKKUUSKEHÄ EI OLE KORISTE. server/sijainti.js hyväksyy tarkkuudeksi jopa 10 000
// metriä, ja sisätiloissa tukiasemapaikannus antaa säännöllisesti sadan metrin lukemia
// (erän 11 mittaus). Piste ilman kehää väittää kaupunkikartalla tietävänsä kadun, kun
// tieto on todellisuudessa "jossain tämän korttelin tai kaupunginosan alueella".
// Päivystäjä lähettää yksikön osoitteeseen sen perusteella mitä ruudulla näkyy.

import type { Tila } from '../yksikontila';

// Metriä per aste. Leveyspiirillä vakio; pituuspiirillä kapenee navoille päin, joten se
// kerrotaan leveysasteen kosinilla. Sama lähestymistapa kuin shared/georeferointi.ts:ssä
// — tasokarttana käsittely riittää, koska kehän säde on metrejä eikä satoja kilometrejä.
const METRIA_PER_ASTE_LAT = 110540;
const METRIA_PER_ASTE_LON = 111320;

export type Gps = {
  lat: number;
  lon: number;
  tarkkuus?: number | null;
  nopeus?: number | null;
  suunta?: number | null;
};

export type Yksikkomerkki = {
  username: string;
  nimi: string;
  tila: Tila;
  gps: Gps;
  ikaMs: number;
  // Onko vartijalla avoin oma hälytys (hätäpainike, man-down, ajastin lauennut).
  // ERI ASIA KUIN TILA: tila kertoo mitä yksikkö tekee, tämä että hän on vaarassa.
  hata: boolean;
};

/**
 * Ympyrä monikulmiona annetun pisteen ympärille.
 *
 * Kulmien määrä on 48: pienemmällä kehä näyttää monikulmiolta juuri silloin kun se on
 * suuri (eli kun tarkkuus on huono ja kehä on se olennainen tieto), suuremmalla ei voita
 * mitään mitä silmä erottaisi.
 *
 * Palauttaa renkaan jonka ensimmäinen ja viimeinen piste ovat samat, kuten GeoJSON
 * vaatii.
 */
export function ympyra(keskus: { lat: number; lon: number }, sadeM: number, kulmia = 48) {
  const rengas: [number, number][] = [];
  const latM = METRIA_PER_ASTE_LAT;
  const lonM = METRIA_PER_ASTE_LON * Math.cos((keskus.lat * Math.PI) / 180);
  for (let i = 0; i < kulmia; i += 1) {
    const kulma = (i / kulmia) * 2 * Math.PI;
    rengas.push([
      keskus.lon + (Math.cos(kulma) * sadeM) / lonM,
      keskus.lat + (Math.sin(kulma) * sadeM) / latM,
    ]);
  }
  rengas.push(rengas[0]);
  return rengas;
}

// Alle tämän kehää ei piirretä. Kymmenen metrin ympyrä on kaupunkitasolla pienempi kuin
// itse merkki, jolloin se ei kerro mitään mutta sotkee ruudun — ja hyvä tarkkuus on jo
// ilmaistu sillä että merkki on yksinään.
export const KEHAN_MIN_M = 25;

// Yli tämän kehää ei piirretä MONIKULMIONA vaan yksikkö merkitään listaan
// epäluotettavaksi. Kymmenen kilometrin ympyrä peittää koko näkymän ja tekee kartasta
// lukukelvottoman juuri silloin kun muut yksiköt pitäisi nähdä.
export const KEHAN_MAX_M = 3000;

export type Kehatulos = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: { username: string; tila: Tila };
    geometry: { type: 'Polygon'; coordinates: [number, number][][] };
  }[];
};

/** Tarkkuuskehät niille yksiköille joilla tarkkuus on tiedossa ja piirtokelpoinen. */
export function tarkkuuskehat(yksikot: Yksikkomerkki[]): Kehatulos {
  return {
    type: 'FeatureCollection',
    features: yksikot
      .filter((y) => {
        const t = y.gps.tarkkuus;
        return typeof t === 'number' && t >= KEHAN_MIN_M && t <= KEHAN_MAX_M;
      })
      .map((y) => ({
        type: 'Feature' as const,
        properties: { username: y.username, tila: y.tila },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [ympyra(y.gps, y.gps.tarkkuus as number)],
        },
      })),
  };
}

/**
 * Onko sijainti niin epätarkka ettei sitä pidä esittää paikkana lainkaan.
 *
 * Tällainen yksikkö kuuluu kartalle silti — sen puuttuminen olisi pahempi virhe kuin
 * epätarkka sijainti — mutta merkin on kerrottava epävarmuus, ei kehän.
 */
export const onEpatarkka = (gps: Gps) =>
  typeof gps.tarkkuus === 'number' && gps.tarkkuus > KEHAN_MAX_M;

/**
 * Näytetäänkö kulkusuunta nuolena.
 *
 * Suunta on merkityksellinen VAIN liikkeessä. Paikallaan seisovan laitteen bearing on
 * viimeisin arvaus siitä mihin päin se osoitti liikkuessaan, ja nuoli piirtäisi sen
 * aikomukseksi: "yksikkö on menossa pohjoiseen" vaikka se on parkissa.
 */
export const NOPEUS_MIN_M_S = 1.5;

export const nayttaaSuunnan = (gps: Gps) =>
  typeof gps.suunta === 'number'
  && typeof gps.nopeus === 'number'
  && gps.nopeus >= NOPEUS_MIN_M_S;

// --- Sijaintijälki (erä 24) --------------------------------------------------------

export type Jalkipiste = {
  ts: string;
  lat: number;
  lon: number;
  tarkkuus?: number | null;
};

export type JalkiGeoJson = {
  type: 'FeatureCollection';
  features: unknown[];
};

export const TYHJA_JALKI: JalkiGeoJson = { type: 'FeatureCollection', features: [] };

/**
 * Jäljen geometria: viiva ja sen pisteet.
 *
 * SEKÄ VIIVA ETTÄ PISTEET, eikä vain toinen. Viiva yhdistää kaksi mittausta suoralla
 * riippumatta siitä oliko niiden välissä minuutti vai puoli tuntia — se on luettava
 * muotona mutta VALHE reittinä. Pisteet kertovat mistä mittaus oikeasti on, ja niiden
 * harvuus kertoo missä jälki on arvausta.
 *
 * Jälkiselvityksessä juuri se ero ratkaisee: "yksikkö kulki tätä katua" ja "yksikön
 * tiedetään olleen tässä ja sitten tuossa" ovat eri väitteitä, ja vain jälkimmäinen on
 * tosi.
 *
 * Kelvottomat pisteet suodatetaan pois hiljaa: yksi rikkinäinen rivi 45 vuorokauden
 * lokissa ei saa estää muun jäljen piirtämistä.
 */
export function jalkiGeoJson(pisteet: Jalkipiste[]): JalkiGeoJson {
  const kelvolliset = (pisteet || []).filter(
    (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon),
  );
  if (kelvolliset.length === 0) return TYHJA_JALKI;

  const koordinaatit = kelvolliset.map((p) => [p.lon, p.lat]);
  const features: unknown[] = [];

  // Yhden pisteen jäljestä EI piirretä viivaa: kahden koordinaatin LineString jossa
  // molemmat ovat samat on maplibrelle kelvollinen mutta näkymätön, ja tyhjä viiva
  // näyttää samalta kuin puuttuva jälki.
  if (koordinaatit.length >= 2) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: koordinaatit },
    });
  }

  for (let i = 0; i < kelvolliset.length; i += 1) {
    const p = kelvolliset[i];
    // `paa` on merkkijono eikä totuusarvo, koska alku ja loppu saavat eri värin.
    // Yhden pisteen jälki on molempia — silloin se merkitään alkupisteeksi, koska
    // "tähän päättyi" on harhaanjohtava kun mitään ei alkanut.
    const paa = i === 0 ? 'alku' : i === kelvolliset.length - 1 ? 'loppu' : null;
    features.push({
      type: 'Feature',
      properties: {
        ts: p.ts,
        tarkkuus: p.tarkkuus ?? null,
        ...(paa ? { paa } : {}),
      },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    });
  }

  return { type: 'FeatureCollection', features };
}

/** Jäljen rajat kartan sovitusta varten. Null jos jälkeä ei ole. */
export function jaljenRajat(pisteet: Jalkipiste[]): [[number, number], [number, number]] | null {
  const kelvolliset = (pisteet || []).filter(
    (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon),
  );
  if (kelvolliset.length === 0) return null;
  const lonit = kelvolliset.map((p) => p.lon);
  const latit = kelvolliset.map((p) => p.lat);
  return [
    [Math.min(...lonit), Math.min(...latit)],
    [Math.max(...lonit), Math.max(...latit)],
  ];
}
