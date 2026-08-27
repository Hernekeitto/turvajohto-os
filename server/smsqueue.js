// Webhook-kutsujen välijono. BulkSMS vaatii että päätepiste vastaa 200 OK enintään
// 30 sekunnissa, ja tuhannen työntekijän massaviestistä syntyy tuhat erillistä
// webhook-kutsua hyvin lyhyessä ajassa. Jos jokainen kutsu päivittäisi
// lähetyshistorian synkronisesti pyynnön elinkaaren aikana, ruuhka kasvattaisi
// vastausaikaa kunnes osa raporteista aikakatkeaisi ja jäisi tulematta.
//
// Siksi webhook-reitti tekee vain YHDEN append-kirjoituksen tänne ja vastaa heti.
// Varsinainen kokoelmien päivitys tehdään taustalla ajastimella (ks. index.js).
//
// Sama JSONL-perustelu kuin audit.js:ssä: fs.appendFileSync ei voi mennä päällekkäin
// saman prosessin sisällä, ja yksittäinen rivi on kaukana POSIX-tason atomisen
// kirjoituksen kokorajasta (PIPE_BUF).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const JONO = path.join(DATA_DIR, 'smsWebhookQueue.jsonl');
// Käsittelyn ajaksi jono siirretään omaan tiedostoonsa (ks. tyhjennaJono).
const KASITTELYSSA = path.join(DATA_DIR, 'smsWebhookQueue.processing.jsonl');

fs.mkdirSync(DATA_DIR, { recursive: true });

// Yläraja jonolle. Jos taustakäsittely on jumissa (esim. vioittunut kokoelmatiedosto),
// jono ei saa kasvaa rajatta ja täyttää levyä — levyn täyttyminen kaataisi myös
// raporttien tallennuksen. Rajan täyttyessä palautetaan false, jolloin webhook-reitti
// vastaa 503:lla ja BulkSMS yrittää saman raportin toimitusta myöhemmin uudelleen.
const MAX_JONO_TAVUA = 20 * 1024 * 1024;

export function lisaaJonoon(tapahtuma) {
  try {
    if (fs.existsSync(JONO) && fs.statSync(JONO).size > MAX_JONO_TAVUA) return false;
    fs.appendFileSync(JONO, `${JSON.stringify(tapahtuma)}\n`);
    return true;
  } catch (err) {
    console.error('Webhook-jonoon kirjoitus epäonnistui:', err.message);
    return false;
  }
}

// Ottaa koko jonon käsittelyyn ja palauttaa sen tapahtumat.
//
// Siirto tehdään renamella EIKÄ "lue ja tyhjennä" -parina: rename on atominen, joten
// samaan aikaan saapuva webhook-kutsu joko ehtii vanhaan tiedostoon ennen siirtoa tai
// luo uuden tiedoston sen jälkeen. Lue-ja-tyhjennä hukkaisi juuri siinä välissä
// saapuneen raportin hiljaa.
//
// Jos edellinen käsittely keskeytyi (palvelin kaatui kesken), .processing-tiedosto on
// vielä olemassa ja se käsitellään ensin — muuten ne rivit jäisivät ikuisesti roikkumaan.
export function otaKasittelyyn() {
  try {
    if (!fs.existsSync(KASITTELYSSA)) {
      if (!fs.existsSync(JONO)) return [];
      fs.renameSync(JONO, KASITTELYSSA);
    }
    const raaka = fs.readFileSync(KASITTELYSSA, 'utf8').split('\n').filter(Boolean);
    const tapahtumat = [];
    for (const rivi of raaka) {
      try {
        tapahtumat.push(JSON.parse(rivi));
      } catch {
        // Yksittäinen vioittunut rivi (kesken jäänyt kirjoitus palvelimen kaatuessa)
        // ei saa estää muiden raporttien käsittelyä.
      }
    }
    return tapahtumat;
  } catch (err) {
    console.error('Webhook-jonon luku epäonnistui:', err.message);
    return [];
  }
}

// Kuittaa käsittelyn valmiiksi. Kutsutaan VASTA kun kokoelmat on kirjoitettu levylle:
// jos päivitys heittää, .processing jää paikalleen ja samat tapahtumat käsitellään
// uudelleen seuraavalla kierroksella. Käsittely on siksi tehtävä idempotentiksi
// (ks. smswebhook.js) — mieluummin sama raportti kahdesti kuin kadonnut raportti.
export function kuittaaKasitellyksi() {
  try {
    if (fs.existsSync(KASITTELYSSA)) fs.unlinkSync(KASITTELYSSA);
  } catch (err) {
    console.error('Webhook-jonon kuittaus epäonnistui:', err.message);
  }
}

export function jononPituus() {
  try {
    if (!fs.existsSync(JONO)) return 0;
    return fs.readFileSync(JONO, 'utf8').split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}
