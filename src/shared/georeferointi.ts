// Pohjakartan georeferointi: GPS-sijainnista kohta kuvalla.
//
// Pohjakartta on valokuva tai piirros. Sovellus ei tiedä mitä maapallon kohtaa sen
// kulmat vastaavat, joten puhelimen antamasta leveys- ja pituusasteesta ei voi päätellä
// pikseliä ennen kuin joku kertoo yhteyden. Kalibrointi on juuri sen kertomista:
// merkitään kartalta pisteitä joiden oikeat koordinaatit tiedetään.
//
// KAKSI vai KOLME pistettä:
//
//   2 pistettä riittää jos kartta on pohjoinen ylöspäin. Silloin x-akseli vastaa
//   pituuspiiriä ja y-akseli leveyspiiriä, ja kummallekin lasketaan oma mittakaava.
//   Tämä sietää sen että kuva on venytetty eri suhteessa vaaka- ja pystysuunnassa.
//
//   3 pistettä tarvitaan jos kartta on käännetty. Kolme pistettä antaa täyden affiinin
//   muunnoksen, joka hoitaa kierron, vinouden ja eri mittakaavat yhtä aikaa.
//
// Kahdella pisteellä EI voi tehdä molempia: niistä saa joko kierron tai akselikohtaiset
// mittakaavat, ei kumpaakin. Siksi kierretty kartta vaatii kolmannen pisteen — arvaus
// näkyisi siinä että vartija on kartalla väärässä kohdassa mutta uskottavalta näyttäen.

import type { Piste, Vyohyke } from './vyohykkeet';

export type Gps = { lat: number; lon: number };
export type Kalibrointipiste = { img: Piste; gps: Gps };

// Metriä per aste. Leveyspiirillä vakio; pituuspiirillä kapenee navoille päin, joten se
// kerrotaan kalibrointialueen leveysasteen kosinilla. Tapahtuma-alue on korkeintaan
// kilometrejä, joten tasokarttana käsittely riittää — karttaprojektiota ei tarvita.
const METRIA_PER_ASTE_LAT = 110540;
const METRIA_PER_ASTE_LON = 111320;

// GPS metreiksi suhteessa origoon. x kasvaa itään, y POHJOISEEN.
const metreiksi = (gps: Gps, origo: Gps) => ({
  x: (gps.lon - origo.lon) * METRIA_PER_ASTE_LON * Math.cos((origo.lat * Math.PI) / 180),
  y: (gps.lat - origo.lat) * METRIA_PER_ASTE_LAT,
});

export type Muunnos = (gps: Gps) => Piste | null;

// Kolmen pisteen affiini sovitus. Ratkaistaan kertoimet a–f yhtälöistä
//   ix = a·mx + b·my + c
//   iy = d·mx + e·my + f
// jossa mx,my ovat metrejä origosta. Kaksi 3×3-yhtälöryhmää, sama determinantti.
function affiini(pisteet: Kalibrointipiste[]): Muunnos | null {
  const origo = pisteet[0].gps;
  const m = pisteet.map((p) => metreiksi(p.gps, origo));

  const det =
    m[0].x * (m[1].y - m[2].y) - m[0].y * (m[1].x - m[2].x) + (m[1].x * m[2].y - m[2].x * m[1].y);

  // Determinantti on kaksi kertaa kolmion pinta-ala, ja koordinaatit ovat METREJÄ —
  // joten kiinteä raja olisi väärä: sadan metrin kolmiolla determinantti on
  // kymmenintuhansia, senttimetrien kolmiolla murto-osia. Raja suhteutetaan siksi
  // kolmion kokoon.
  //
  // Tämä hylkää kaksi virhettä kerralla: pisteet samalla suoralla (ei kerro mitään
  // poikittaisesta suunnasta) ja pisteet liian lähellä toisiaan (pieni mittausvirhe
  // kertautuisi kartan toisessa laidassa metreiksi).
  const sivu1 = Math.hypot(m[1].x - m[0].x, m[1].y - m[0].y);
  const sivu2 = Math.hypot(m[2].x - m[0].x, m[2].y - m[0].y);
  const mittakaava = Math.max(sivu1, sivu2);
  if (mittakaava < 1 || Math.abs(det) < 1e-6 * mittakaava * mittakaava) return null;

  const ratkaise = (arvot: number[]) => {
    const da =
      arvot[0] * (m[1].y - m[2].y) - m[0].y * (arvot[1] - arvot[2]) + (arvot[1] * m[2].y - arvot[2] * m[1].y);
    const db =
      m[0].x * (arvot[1] - arvot[2]) - arvot[0] * (m[1].x - m[2].x) + (m[1].x * arvot[2] - m[2].x * arvot[1]);
    const dc =
      m[0].x * (m[1].y * arvot[2] - m[2].y * arvot[1]) -
      m[0].y * (m[1].x * arvot[2] - m[2].x * arvot[1]) +
      arvot[0] * (m[1].x * m[2].y - m[2].x * m[1].y);
    return [da / det, db / det, dc / det];
  };

  const [a, b, c] = ratkaise(pisteet.map((p) => p.img.x));
  const [d, e, f] = ratkaise(pisteet.map((p) => p.img.y));

  return (gps: Gps) => {
    const p = metreiksi(gps, origo);
    return { x: a * p.x + b * p.y + c, y: d * p.x + e * p.y + f };
  };
}

// Kahden pisteen akselinsuuntainen sovitus. Oletus: kartta on pohjoinen ylöspäin.
function akselinsuuntainen(pisteet: Kalibrointipiste[]): Muunnos | null {
  const [p1, p2] = pisteet;
  const dLon = p2.gps.lon - p1.gps.lon;
  const dLat = p2.gps.lat - p1.gps.lat;
  // Pisteet eivät saa olla samalla pituus- tai leveyspiirillä: silloin toiselle
  // akselille ei saada mittakaavaa lainkaan.
  if (Math.abs(dLon) < 1e-9 || Math.abs(dLat) < 1e-9) return null;

  const kx = (p2.img.x - p1.img.x) / dLon;
  const ky = (p2.img.y - p1.img.y) / dLat;

  return (gps: Gps) => ({
    x: p1.img.x + (gps.lon - p1.gps.lon) * kx,
    y: p1.img.y + (gps.lat - p1.gps.lat) * ky,
  });
}

// Rakentaa muunnoksen kalibrointipisteistä. Palauttaa nullin jos pisteitä on liian vähän
// tai ne ovat sellaisessa asennossa ettei muunnosta voi määrittää.
export function luoMuunnos(pisteet: Kalibrointipiste[] | undefined | null): Muunnos | null {
  const kelvolliset = (pisteet || []).filter(
    (p) =>
      p && p.img && p.gps &&
      Number.isFinite(p.img.x) && Number.isFinite(p.img.y) &&
      Number.isFinite(p.gps.lat) && Number.isFinite(p.gps.lon)
  );
  if (kelvolliset.length >= 3) return affiini(kelvolliset.slice(0, 3));
  if (kelvolliset.length === 2) return akselinsuuntainen(kelvolliset);
  return null;
}

// Osuuko piste kuvan sisään. Kalibroitu muunnos antaa mielellään arvoja kuvan
// ulkopuolelta — vartija voi olla alueen ulkopuolella — eikä sellaista pistettä pidä
// piirtää kartan reunaan kuin se olisi siellä.
export const kuvanSisalla = (p: Piste) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

// Missä vyöhykkeessä piste on. Säteenheitto: lasketaan montako kertaa pisteestä oikealle
// lähtevä puolisuora leikkaa monikulmion sivuja — pariton määrä tarkoittaa sisäpuolta.
// Näin "Portti 3" saadaan sijainnista ilman että kukaan kertoo sitä käsin.
export function vyohykePisteessa(vyohykkeet: Vyohyke[], p: Piste): Vyohyke | null {
  for (const v of vyohykkeet || []) {
    const pisteet = v.pisteet || [];
    if (pisteet.length < 3) continue;
    let sisalla = false;
    for (let i = 0, j = pisteet.length - 1; i < pisteet.length; j = i++) {
      const a = pisteet[i];
      const b = pisteet[j];
      const leikkaa =
        a.y > p.y !== b.y > p.y &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
      if (leikkaa) sisalla = !sisalla;
    }
    if (sisalla) return v;
  }
  return null;
}
