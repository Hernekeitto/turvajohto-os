// Sijaintihistoria: mihin yksikkö liikkui, jälkikäteistä selvitystä varten.
//
// KÄYTTÖTARKOITUS ON RAJATTU JA SE ON OSA MÄÄRITTELYÄ (päätös 15.9.2026):
// hälytysten ja kierrosten jälkikäteinen selvitys ja varmentaminen. EI työsuorituksen
// seurantaa. Rajaus ei ole tekninen — mikään koodissa ei estä katsomasta jälkeä muusta
// syystä — mutta se on se peruste jolla keruu on arvioitu, ja se on kirjattava tänne
// koska käyttötarkoituksen laajentaminen on uusi arviointi eikä uusi ominaisuus.
//
// --- MIKSI EI store.js:n KOKOELMA --------------------------------------------------
//
// Kokoelmat kirjoitetaan kokonaan uusiksi joka muutoksella (writeCollection). Sadan
// vartijan sijaintivirta on 15–60 sekunnin välein piste per vartija, eli tuhansia
// täysiä tiedostokirjoituksia tunnissa kasvavaan tiedostoon. sijainti.js on varoittanut
// tästä alusta asti, ja se varoitus on syy tähän moduuliin.
//
// Tämä on append-only JSONL kuten audit.js: rivi kerrallaan tiedoston loppuun.
// Kirjoituksen kustannus ei kasva tiedoston koon mukana.
//
// --- MIKSI PÄIVÄKOHTAISET TIEDOSTOT ------------------------------------------------
//
// Säilytysaika on 45 vuorokautta (päätös 15.9.2026), ja se on TOTEUTETTAVA eikä vain
// luvattava. Päiväkohtaisilla tiedostoilla poisto on tiedoston poisto: ei elävän
// tiedoston uudelleenkirjoitusta, ei riviensiivousta, ei tilannetta jossa poisto
// keskeytyy puoliväliin ja jättää tiedoston sekaisin.
//
// Tiedostonimi on myös se mitä tarkastetaan: `ls` kertoo yhdellä silmäyksellä onko
// säilytysaikaa noudatettu. Rivien sisään piilotettu aikaleima ei kerro.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const LOKI_DIR = path.join(DATA_DIR, 'sijaintiloki');

// Säilytysaika vuorokausina. Käyttäjän päätös 15.9.2026.
//
// Tämä koskee KAIKKEA muuta sijaintidataa. Hälytystehtävän ajalta kertyvä jälki
// kopioidaan tehtävän tietueeseen kun hälytyskeskus hyväksyy poistumisen, ja siihen
// sovelletaan LYTP:n tapahtumailmoitusaikaa — se ei siis ole tämän lokin varassa eikä
// katoa 45 vuorokaudessa.
export const SAILYTYS_VRK = 45;

const PAIVA_MS = 24 * 60 * 60 * 1000;

const paivays = (ms) => new Date(ms).toISOString().slice(0, 10);
const tiedosto = (ms) => path.join(LOKI_DIR, `${paivays(ms)}.jsonl`);

/**
 * Kirjaa yhden sijaintipisteen.
 *
 * NIMIMERKKIÄ EI KIRJATA, vain käyttäjätunnus. Sama periaate kuin audit.js:ssä:
 * pitkäikäiseen lokiin ei toisteta henkilötietoa jota saa muualta. Nimi luetaan
 * käyttäjärekisteristä silloin kun jälkeä katsotaan.
 *
 * Ei palauta virhettä eikä heitä: sijainnin kirjaaminen ei saa kaataa sitä toimintoa
 * jonka yhteydessä se tapahtuu. Sama sääntö kuin auditlokissa — levy täynnä ei saa
 * estää vyöhykehälytystä.
 */
export function kirjaa(tietue, nyt = Date.now()) {
  if (!tietue?.username || !tietue?.gps) return false;
  try {
    fs.mkdirSync(LOKI_DIR, { recursive: true });
    const rivi = JSON.stringify({
      ts: new Date(nyt).toISOString(),
      username: tietue.username,
      eventId: tietue.eventId || null,
      lat: tietue.gps.lat,
      lon: tietue.gps.lon,
      tarkkuus: tietue.gps.tarkkuus ?? null,
      nopeus: tietue.gps.nopeus ?? null,
      suunta: tietue.gps.suunta ?? null,
      lahde: tietue.lahde || 'selain',
    }) + '\n';
    fs.appendFileSync(tiedosto(nyt), rivi);
    return true;
  } catch (err) {
    console.error('Sijaintilokin kirjoitus epäonnistui:', err.message);
    return false;
  }
}

/**
 * Yhden vartijan pisteet aikavälillä.
 *
 * Luetaan vain ne päivätiedostot jotka osuvat väliin — koko lokia ei käydä läpi.
 * Aikaväli on puoliavoin [alku, loppu]: molemmat päät mukaan, koska kysyjä antaa
 * tehtävän vastaanotto- ja poistumishetken, ja molemmat kuuluvat tehtävään.
 */
export function lue({ username, alku, loppu }) {
  if (!username || !Number.isFinite(alku) || !Number.isFinite(loppu)) return [];
  if (loppu < alku) return [];

  const pisteet = [];
  for (let ms = alku; ms <= loppu + PAIVA_MS; ms += PAIVA_MS) {
    const polku = tiedosto(ms);
    if (!fs.existsSync(polku)) continue;
    let raaka;
    try {
      raaka = fs.readFileSync(polku, 'utf8');
    } catch {
      continue;
    }
    for (const rivi of raaka.split('\n')) {
      if (!rivi) continue;
      let p;
      try {
        p = JSON.parse(rivi);
      } catch {
        // Yksittäinen korruptoitunut rivi (kesken jäänyt kirjoitus palvelimen
        // kaatuessa) ei saa estää muun jäljen lukemista.
        continue;
      }
      if (p.username !== username) continue;
      const t = Date.parse(p.ts);
      if (!Number.isFinite(t) || t < alku || t > loppu) continue;
      pisteet.push(p);
    }
  }
  // Aikajärjestys varmistetaan tässä eikä luoteta tiedostojen järjestykseen: jälki on
  // reitti, ja väärässä järjestyksessä se piirtää eri reitin kuin mitä ajettiin.
  pisteet.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  return pisteet;
}

/**
 * Poistaa säilytysajan ylittäneet päivätiedostot.
 *
 * Palauttaa poistettujen tiedostojen nimet, jotta poisto voidaan kirjata auditlokiin:
 * säilytysajan noudattaminen on asia joka on voitava osoittaa jälkikäteen, eikä
 * hiljainen poisto osoita mitään.
 */
export function siivoa(nyt = Date.now()) {
  if (!fs.existsSync(LOKI_DIR)) return [];
  const raja = paivays(nyt - SAILYTYS_VRK * PAIVA_MS);
  const poistetut = [];
  let nimet;
  try {
    nimet = fs.readdirSync(LOKI_DIR);
  } catch {
    return [];
  }
  for (const nimi of nimet) {
    if (!nimi.endsWith('.jsonl')) continue;
    // Vertailu MERKKIJONONA: ISO-päiväys on aakkosjärjestyksessä myös aikajärjestyksessä,
    // eikä päiväyksen jäsentäminen takaisin numeroksi voi silloin mennä pieleen.
    if (nimi.slice(0, 10) >= raja) continue;
    try {
      fs.unlinkSync(path.join(LOKI_DIR, nimi));
      poistetut.push(nimi);
    } catch (err) {
      console.error('Sijaintilokin siivous epäonnistui:', nimi, err.message);
    }
  }
  return poistetut;
}

/** Testejä varten. */
export const lokiHakemisto = () => LOKI_DIR;
