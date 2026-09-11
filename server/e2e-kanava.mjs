// Erän 11 kuljetuksen todennus: pääseekö SIDOTTU LAITE kanavalle ilman evästettä.
//
// Tämä on olemassa siksi, että natiivisovelluksella ei ole istuntokeksiä eikä tokenia —
// se allekirjoittaa jokaisen pyynnön laiteavaimella (ks. server/laite.js, "Miksi
// laitteella EI ole tokenia"). Kanava taas tunnistaa `getSessionUser`illa, joka putoaa
// laiteallekirjoitukseen kun evästettä ei ole. Koodi näyttää tukevan tätä, mutta sitä ei
// ollut koskaan ajettu: `Kanava.java` kirjoitetaan tämän varaan, ja väärä oletus
// maksettaisiin vasta kentällä.
//
// Todennetaan kättelyn neljä sääntöä, joista kolme on torjuntoja:
//   1. allekirjoittamaton kättely torjutaan
//   2. väärennetty allekirjoitus torjutaan
//   3. vanhentunut allekirjoitus torjutaan
//   4. toistettu kättely torjutaan (nonce kattaa myös kanavan)
//   5. kelvollinen kättely päästetään läpi
//
// ja sen jälkeen se mitä varten kanava on olemassa, eli KOKO KETJU pelkästä GPS:stä:
//   6. sijaintipäivitys kulkee kentältä palvelimelle
//   7. ensimmäinen sijainti ei hälytä (raja on ylitettävä)
//   8. vyöhykepoikkeama laukeaa vaikka laite ei lähetä kuvakoordinaattia
//
// Kohta 8 on erän 11 valmiuskriteeri. Natiivisovellus lähettää pelkän GPS:n, ja
// geofence.js vaatii kuvakoordinaatin — palvelin laskee sen kalibroinnista
// (georeferointi.js). Ilman sitä poikkeama ei laukeaisi koskaan, tarkkuudesta
// riippumatta, ja vika olisi täysin hiljainen.
//
// Ajetaan repon juuresta: node server/e2e-kanava.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';
import { WebSocket } from 'ws';

import { kanoninenViesti, laitteenTietue } from './laite.js';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-kanava-'));
const PORT = 4127;
const PALVELIN = `http://127.0.0.1:${PORT}`;
const KANAVA = `ws://127.0.0.1:${PORT}/api/kanava`;

// Vartijalle oma taso: ilman tasoa käyttäjällä ei ole yhtään oikeutta. Tunnistautuminen
// ei sitä vaadi, mutta tasoton käyttäjä on epärealistinen eikä testin pidä nojata siihen.
fs.writeFileSync(path.join(DATA, 'roles.json'), JSON.stringify({ roles: [
  {
    id: 'vartijataso',
    name: 'Vartija',
    permissions: { __default__: { guard_tasks: { view: true, edit: true } } },
  },
] }, null, 2));

fs.writeFileSync(path.join(DATA, 'users.json'), JSON.stringify({ users: [
  { username: 'testiadmin', role: 'admin', password_hash: bcrypt.hashSync('salasana123', 4) },
  { username: 'vartija1', role: 'user', roleId: 'vartijataso', password_hash: bcrypt.hashSync('salasana123', 4) },
] }, null, 2));

// Kohde jolla on KALIBROINTI ja vyöhyke. Tämä on erän 11 viimeisen palan koekenttä:
// natiivisovellus lähettää pelkän GPS:n, ja vyöhykearviointi vaatii kuvakoordinaatin —
// palvelimen on siis laskettava se kalibroinnista tai poikkeama ei laukea koskaan.
//
// Kalibrointi on pohjoinen ylöspäin, samat luvut kuin georeferointi.test.js:ssä:
//   img (0.2, 0.8) <-> (LAT,         LON)
//   img (0.8, 0.2) <-> (LAT + 0.002, LON + 0.004)
// jolloin img (0.5, 0.5) <-> (LAT + 0.001, LON + 0.002).
const LAT = 61.494;
const LON = 23.765;
const ULKONA = { lat: LAT, lon: LON };                       // img (0.2, 0.8)
const SISALLA = { lat: LAT + 0.001, lon: LON + 0.002 };      // img (0.5, 0.5)

fs.writeFileSync(path.join(DATA, 'guardSites.json'), JSON.stringify([
  {
    id: 'kohde-vyohyke',
    name: 'Testikohde',
    mapRef: [
      { img: { x: 0.2, y: 0.8 }, gps: { lat: LAT, lon: LON } },
      { img: { x: 0.8, y: 0.2 }, gps: { lat: LAT + 0.002, lon: LON + 0.004 } },
    ],
    zones: [
      {
        id: 'vyohyke-1',
        nimi: 'Kielletty alue',
        halytys: 'saapuminen',
        pisteet: [
          { x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 },
          { x: 0.6, y: 0.6 }, { x: 0.4, y: 0.6 },
        ],
      },
    ],
  },
], null, 2));

// Laitepari syntyy tässä eikä puhelimessa: yksityinen avain tarvitaan allekirjoittamiseen,
// ja oikean laitteen avain ei poistu Keystoresta. Julkinen avain menee levylle samassa
// muodossa kuin sovellus sen lähettäisi (X.509 SPKI DER base64).
const pari = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const laite = laitteenTietue({
  kayttaja: 'vartija1',
  julkinenAvain: pari.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  malli: 'E2E-testilaite, Android 13',
  nyt: Date.now(),
});
fs.writeFileSync(path.join(DATA, 'devices.json'), JSON.stringify([laite], null, 2));

const palvelin = spawn(process.execPath, ['server/index.js'], {
  env: {
    ...process.env, DATA_DIR: DATA, PORT: String(PORT),
    JWT_SECRET: 'e2e-jwt-salaisuus-vain-testiin',
    TOTP_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    // Ilman tätä sijaintipäivitys ohitetaan hiljaa eikä kohta 5 mittaisi mitään.
    SIJAINTISEURANTA: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
palvelin.stderr.on('data', (d) => process.stderr.write(`[palvelin] ${d}`));

const odota = async () => {
  for (let i = 0; i < 60; i += 1) {
    try { await fetch(`${PALVELIN}/api/session`); return; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error('palvelin ei noussut');
};

const halytykset = async (evaste) => {
  const v = await fetch(`${PALVELIN}/api/data/alerts`, { headers: { Cookie: evaste } });
  const j = await v.json().catch(() => null);
  return Array.isArray(j?.data) ? j.data : [];
};

const vaita = (ehto, teksti) => {
  console.log(`${ehto ? '  OK   ' : '  EPÄONNISTUI  '} ${teksti}`);
  if (!ehto) process.exitCode = 1;
};

/**
 * Ne otsakkeet jotka sovellus lähettää kättelyssä. Tarkoituksella sama nelikko ja sama
 * kanoninen viesti kuin HTTP-pyynnöissä — jos kanava tarvitsisi omansa, laitepuolella
 * olisi kaksi allekirjoitustapaa ja ne erkanisivat toisistaan.
 *
 * Metodi on GET ja polku `/api/kanava`, koska juuri ne palvelin näkee upgrade-pyynnöstä
 * (`req.method`, `req.url`).
 */
function otsakkeet({ nonce = crypto.randomUUID(), aika = Date.now(), avain = pari.privateKey } = {}) {
  const viesti = kanoninenViesti({
    laiteId: laite.id, metodi: 'GET', polku: '/api/kanava', aika, nonce, runko: '',
  });
  return {
    'x-turvajohto-laite': laite.id,
    'x-turvajohto-aika': String(aika),
    'x-turvajohto-nonce': nonce,
    'x-turvajohto-allekirjoitus': crypto.sign('sha256', Buffer.from(viesti), avain).toString('base64'),
  };
}

/**
 * Avaa yhteyden ja kertoo miten kävi. Palauttaa `ws`-olion vain onnistuessa, koska
 * torjutusta yhteydestä ei ole mitään käytettävää — ja avoimeksi jäänyt soketti
 * jumittaisi testin lopetuksen.
 */
function yhdista(headers) {
  return new Promise((valmis) => {
    const ws = new WebSocket(KANAVA, { headers });
    const lopeta = (tulos) => { valmis(tulos); };
    ws.on('open', () => lopeta({ auki: true, ws }));
    // Torjunta tulee HTTP-vastauksena ennen kättelyä, ei close-tapahtumana.
    ws.on('unexpected-response', (_req, res) => { ws.terminate(); lopeta({ auki: false, koodi: res.statusCode }); });
    ws.on('error', () => lopeta({ auki: false, koodi: null }));
  });
}

try {
  await odota();

  // --- 1. Allekirjoittamaton kättely -------------------------------------------------
  const ilman = await yhdista({});
  vaita(ilman.auki === false && ilman.koodi === 401, 'allekirjoittamaton kattely torjutaan 401:lla');

  // --- 2. Väärennetty allekirjoitus --------------------------------------------------
  // Oikea laitetunnus ja tuore aika, mutta toisen avaimen allekirjoitus. Tämä on se
  // hyökkäys jota vastaan koko allekirjoitus on olemassa: tunnus on julkista tietoa.
  const vieras = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const vaarennetty = await yhdista(otsakkeet({ avain: vieras.privateKey }));
  vaita(vaarennetty.auki === false && vaarennetty.koodi === 401,
    'vieraalla avaimella allekirjoitettu kattely torjutaan');

  // --- 3. Vanha allekirjoitus --------------------------------------------------------
  const vanha = await yhdista(otsakkeet({ aika: Date.now() - 10 * 60 * 1000 }));
  vaita(vanha.auki === false && vanha.koodi === 401, 'aikaikkunan ulkopuolinen kattely torjutaan');

  // --- 4. Kelvollinen kättely --------------------------------------------------------
  const omatOtsakkeet = otsakkeet();
  const kelpo = await yhdista(omatOtsakkeet);
  vaita(kelpo.auki === true, 'sidottu laite paasee kanavalle ilman evastetta');

  // --- 5. Toisto ---------------------------------------------------------------------
  // Sama kättely uudelleen: allekirjoitus on kelvollinen ja aika tuore, mutta nonce on
  // jo nähty. Ilman tätä siepattu kättely kelpaisi viisi minuuttia.
  const toisto = await yhdista(omatOtsakkeet);
  vaita(toisto.auki === false && toisto.koodi === 401, 'toistettu kattely torjutaan');

  // --- 6. Sijainti kentältä palvelimelle ---------------------------------------------
  // Tämä on se mitä varten kanava natiivipuolella on: uplink ilman HTTP-pyyntöä.
  if (kelpo.auki) {
    kelpo.ws.send(JSON.stringify({
      tyyppi: 'sijainti',
      eventId: null,
      gps: { lat: 60.1699, lon: 24.9384, tarkkuus: 12 },
    }));
  }

  const kirj = await fetch(`${PALVELIN}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testiadmin', password: 'salasana123' }),
  });
  const evaste = (kirj.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');

  // Viesti kulkee soketin yli ja käsitellään tapahtumasilmukassa: lyhyt odotus on
  // kuljetuksen ominaisuus eikä kilpailutilanteen piilottamista.
  let nakyy = false;
  for (let i = 0; i < 25 && !nakyy; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
    const v = await (await fetch(`${PALVELIN}/api/sijainnit`, { headers: { Cookie: evaste } })).json();
    nakyy = (v.sijainnit || []).some((s) => s.username === 'vartija1' && s.gps?.lat === 60.1699);
  }
  vaita(nakyy, 'laitteen kanavalla lahettama sijainti nakyy palvelimella');

  // --- 7. Vyöhykepoikkeama pelkästä GPS:stä -----------------------------------------
  //
  // Tämä on erän 11 valmiuskriteerin toinen puoli. Kaksi sijaintia, ja järjestys on osa
  // testiä: geofence hälyttää vain RAJAN YLITYKSESTÄ, joten ensimmäinen sijainti ei saa
  // hälyttää vaikka se olisi vyöhykkeen sisällä.
  if (kelpo.auki) {
    kelpo.ws.send(JSON.stringify({
      tyyppi: 'sijainti', eventId: 'kohde-vyohyke',
      gps: { ...ULKONA, tarkkuus: 10 },
    }));
    await new Promise((r) => setTimeout(r, 300));

    const ennenYlitysta = await halytykset(evaste);
    vaita(ennenYlitysta.length === 0, 'ensimmainen sijainti ei halyta');

    kelpo.ws.send(JSON.stringify({
      tyyppi: 'sijainti', eventId: 'kohde-vyohyke',
      gps: { ...SISALLA, tarkkuus: 10 },
    }));
  }

  let poikkeama = null;
  for (let i = 0; i < 25 && !poikkeama; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
    poikkeama = (await halytykset(evaste)).find((h) => h?.tyyppi === 'geofence') || null;
  }
  vaita(!!poikkeama, 'vyohykepoikkeama laukesi pelkasta GPS:sta');
  vaita(poikkeama?.kuvaus?.includes('Kielletty alue'),
    'poikkeama nimeaa oikean vyohykkeen');

  if (kelpo.auki) kelpo.ws.close();
} finally {
  palvelin.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
}
