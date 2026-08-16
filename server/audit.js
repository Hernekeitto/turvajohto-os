// Sovellustason audit-loki: kuka teki mitä, milloin. Tapahtumailmoitusten ja
// voimankäyttöraporttien luotettavuuden (ja mahdollisten myöhempien selvitysten)
// kannalta muutoshistoria on oleellinen — tämä täydentää sitä, ei korvaa mitään.
//
// Append-only JSONL (yksi JSON-objekti per rivi): lokia EI koskaan ylikirjoiteta
// tai poisteta samaan tapaan kuin store.js:n kokoelmia, koska sen koko arvo on
// säilyä muuttumattomana. Vain metadata tallennetaan (kuka, mikä toiminto, mihin
// tietueeseen/tapahtumaan, milloin) — EI itse tietueen sisältöä, jotta esim.
// henkilötunnukset eivät päädy lokiin toistamiseen (ks. employees-kokoelma).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const AUDIT_PATH = path.join(DATA_DIR, 'audit.jsonl');

fs.mkdirSync(DATA_DIR, { recursive: true });

// fs.appendFileSync on riittävän turvallinen tässä: Node on single-threaded
// event loopiltaan, synkroniset fs-kutsut eivät voi mennä päällekkäin saman
// prosessin sisällä, ja yksittäiset rivit ovat kaukana POSIX-tason atomisen
// kirjoituksen kokorajasta (PIPE_BUF, tyypillisesti 4096 tavua Linuxissa).
export function logAudit(entry) {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
    fs.appendFileSync(AUDIT_PATH, line);
  } catch (err) {
    // Lokitus ei koskaan saa kaataa itse toimintoa jota se yrittää lokittaa —
    // esim. levy täynnä ei saa estää raportin tallentamista, vain lokiriviä.
    console.error('Audit-lokitus epäonnistui:', err.message);
  }
}

// Lukee lokin uusimmasta vanhimpaan, valinnaisella suodatuksella ja sivutuksella
// (before = palauta rivit joiden ts on tätä aiempi, jatkuvaa "lataa lisää" -selausta
// varten). Koko tiedosto luetaan muistiin joka kutsulla — riittävä tämän sovelluksen
// mittakaavassa (yksi tapahtuma kerrallaan, rajattu käyttäjämäärä); jos lokista joskus
// tulee todella suuri, tämä kannattaa vaihtaa striimaavaan/indeksoituun lukuun.
export function readAuditLog({ limit = 50, before, user, action, collection, eventId } = {}) {
  if (!fs.existsSync(AUDIT_PATH)) return { entries: [], hasMore: false };
  const raw = fs.readFileSync(AUDIT_PATH, 'utf8').split('\n').filter(Boolean);
  let entries = [];
  for (const line of raw) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // Yksittäinen korruptoitunut rivi (esim. kesken jäänyt kirjoitus palvelimen
      // kaatuessa) ei saa estää muun lokin lukemista.
    }
  }
  entries.reverse(); // uusin ensin
  if (before) entries = entries.filter((e) => e.ts < before);
  if (user) entries = entries.filter((e) => e.user === user);
  if (action) entries = entries.filter((e) => e.action === action);
  if (collection) entries = entries.filter((e) => e.collection === collection);
  if (eventId) entries = entries.filter((e) => e.eventId === eventId);
  const hasMore = entries.length > limit;
  return { entries: entries.slice(0, limit), hasMore };
}
