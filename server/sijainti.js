// Sijaintikerros: kuka on missäkin juuri nyt.
//
// JULKAISUESTE. Seuranta on POIS PÄÄLTÄ oletuksena ja kytkeytyy vain
// ympäristömuuttujalla SIJAINTISEURANTA=1. Jatkuva sijainnin seuranta on
// työntekijöihin kohdistuvaa teknistä valvontaa, ja ennen käyttöönottoa tarvitaan
// yhteistoimintakäsittely, informointi, käsittelyperuste ja vaikutustenarviointi
// (ks. vaultin muistiinpano "puuteluettelo ja työjärjestys", juridinen työpaketti).
// Koodi saa olla valmiina ja testattuna sitä ennen — päälle sitä ei kytketä.
//
// EI LEVYLLE. Sijainnit elävät vain muistissa. Kaksi syytä:
//
// 1. Nykyinen tallennus kirjoittaa koko kokoelmatiedoston kerralla. Sadan vartijan
//    sijaintivirta tarkoittaisi tuhansia täysiä tiedostokirjoituksia tunnissa.
// 2. Sijaintihistorian säilytysaika on nimenomaan yksi juridisen työpaketin
//    ratkaisemattomista kohdista. Henkilötietovaraston perustaminen ennen kuin sen
//    elinkaari on päätetty olisi väärä järjestys.
//
// Muistissa pidettävä viimeksi tiedetty sijainti riittää kaikkeen mitä erä 3 lupaa:
// vartijat kartalla, sijainnin ikä näkyvissä ja lähimmän haku. Historia on sen jälkeen
// oma pieni lisäyksensä eikä uudelleenkirjoitus.

// Sijainti vanhenee: puhelin sammui, sovellus suljettiin tai vuoro loppui. Vanhentunut
// sijainti on pahempi kuin puuttuva — se väittää tietävänsä missä ihminen on.
const VANHENEE_MS = 30 * 60 * 1000;

// username -> { username, eventId, img, gps, at }
const viimeisin = new Map();

export const seurantaKaytossa = () => process.env.SIJAINTISEURANTA === '1';

const luku = (arvo, min, max) => {
  const n = Number(arvo);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

// Kuvakoordinaatti on osuus pohjakuvan mitoista (0–1), sama esitys kuin vyöhykkeillä
// (ks. src/shared/vyohykkeet.ts). GPS on erikseen, koska pohjakartta ei ole
// georeferoitu — niitä ei voi johtaa toisistaan.
export function lueSijainti(syote) {
  if (!syote || typeof syote !== 'object') return null;
  const img = syote.img && typeof syote.img === 'object'
    ? { x: luku(syote.img.x, 0, 1), y: luku(syote.img.y, 0, 1) }
    : null;
  const gps = syote.gps && typeof syote.gps === 'object'
    ? {
        lat: luku(syote.gps.lat, -90, 90),
        lon: luku(syote.gps.lon, -180, 180),
        // Tarkkuus metreinä. Yli kymmenen kilometrin "tarkkuus" on käytännössä
        // tieto siitä missä maakunnassa ollaan, eikä sitä kannata näyttää kartalla.
        tarkkuus: luku(syote.gps.tarkkuus, 0, 10000),
      }
    : null;

  const imgOk = img && img.x !== null && img.y !== null;
  const gpsOk = gps && gps.lat !== null && gps.lon !== null;
  if (!imgOk && !gpsOk) return null;
  return { img: imgOk ? img : null, gps: gpsOk ? { ...gps } : null };
}

// Palauttaa tallennetun sijainnin tai nullin jos syöte oli kelvoton. Aikaleima tulee
// PALVELIMELTA eikä selaimelta: laitteen kello voi olla väärässä, ja sijainnin ikä on
// se tieto jonka perusteella TIKE päättää luottaako siihen.
export function paivita(username, eventId, syote, nyt = Date.now()) {
  if (!seurantaKaytossa()) return null;
  if (!username) return null;
  const sijainti = lueSijainti(syote);
  if (!sijainti) return null;
  const tietue = { username, eventId: eventId || null, ...sijainti, at: nyt };
  viimeisin.set(username, tietue);
  return tietue;
}

// Vuoron päättyminen ja uloskirjautuminen poistavat sijainnin. Tämä on se tekninen
// minimointi joka vastaa kysymykseen "seurataanko minua vapaa-ajalla": ei seurata,
// koska tietoa ei ole olemassa.
export function unohda(username) {
  return viimeisin.delete(username);
}

export function tyhjenna() {
  viimeisin.clear();
}

// Kaikki tuoreet sijainnit, valinnaisesti yhdestä tapahtumasta. Vanhentuneet poistetaan
// samalla — erillistä siivousajastinta ei tarvita, koska lista luetaan joka tapauksessa
// aina kun sitä näytetään.
export function kaikki({ eventId = null, nyt = Date.now() } = {}) {
  const tulos = [];
  for (const [username, tietue] of viimeisin) {
    if (nyt - tietue.at > VANHENEE_MS) {
      viimeisin.delete(username);
      continue;
    }
    if (eventId && tietue.eventId && tietue.eventId !== eventId) continue;
    tulos.push({ ...tietue, ikaMs: nyt - tietue.at });
  }
  return tulos;
}

export const VANHENEE = VANHENEE_MS;
