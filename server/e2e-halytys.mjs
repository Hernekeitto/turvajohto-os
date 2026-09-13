// Erän 12 kuljetuksen todennus: saako SIDOTTU LAITE tehtyä man-down-hälytyksen.
//
// Sama syy kuin erässä 11: natiivisovelluksella ei ole istuntokeksiä eikä tokenia, ja
// `/api/halytys` on `requireAuth`in takana. `requireAuth` kutsuu `getSessionUser`ia, joka
// putoaa laiteallekirjoitukseen kun evästettä ei ole — koodi siis NÄYTTÄÄ tukevan tätä,
// mutta sitä ei ole koskaan ajettu tältä polulta. `Anturit.java` ja `HalytysActivity.java`
// kirjoitetaan tämän varaan, ja väärä oletus maksettaisiin vasta silloin kun joku oikeasti
// makaa maassa.
//
// Erän 11 e2e osoitti että palvelinpuoli oli valmis ennestään. Se oli arvaus kunnes se
// ajettiin, ja tämä on sama arvaus toisesta päätepisteestä.
//
// Todennetaan kolme torjuntaa ja viisi läpimenoa:
//   1. allekirjoittamaton halytys torjutaan
//   2. vieraalla avaimella allekirjoitettu torjutaan
//   3. toistettu allekirjoitus torjutaan
//   4. laiteallekirjoitettu man-down menee lapi ilman evastetta
//   5. halytys nakyy paivystajalle
//   6. gps ja kuvaus sailyvat halytyksessa
//   7. TOISTOPAINALLUS ei synnyta toista halytysta
//   8. tuntematon halytystyyppi torjutaan
//
// Kohta 7 on tärkein natiivin kannalta ja se on eri asia kuin kohta 3. Nonce estää saman
// ALLEKIRJOITUKSEN toiston; kohta 7 koskee tilannetta jossa sovellus lähettää uuden,
// kelvollisesti allekirjoitetun pyynnön — verkko takkusi, vastaus ei tullut perille,
// sovellus yrittää uudelleen. Ilman palvelimen omaa suojaa siitä syntyisi kaksi hälytystä
// ja kaksi tekstiviestiä samasta kaatumisesta, ja natiivissa uudelleenyritys on
// välttämätön: kaatunut vartija ei paina nappia toista kertaa.
//
// Ajetaan repon juuresta: node server/e2e-halytys.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';

import { kanoninenViesti, laitteenTietue } from './laite.js';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-halytys-'));
const PORT = 4128;
const PALVELIN = `http://127.0.0.1:${PORT}`;

const LAT = 61.494;
const LON = 23.765;

fs.writeFileSync(path.join(DATA, 'roles.json'), JSON.stringify({ roles: [
  {
    id: 'vartijataso',
    name: 'Vartija',
    // guard_alarms ON PAKOLLINEN: saaHalyttaa vaatii canView(...'alarms') tai
    // canView(...'guard_alarms'), ja ilman sitä laitteen man-down torjutaan 403:lla
    // vaikka allekirjoitus olisi moitteeton. Tämä on kentän kannalta tärkein rivi koko
    // tiedostossa: vartija jolla ei ole tätä oikeutta kantaa puhelinta joka ei hälytä.
    permissions: {
      __default__: {
        guard_tasks: { view: true, edit: true },
        guard_alarms: { view: true, edit: true },
      },
    },
  },
] }, null, 2));

fs.writeFileSync(path.join(DATA, 'users.json'), JSON.stringify({ users: [
  { username: 'testiadmin', role: 'admin', password_hash: bcrypt.hashSync('salasana123', 4) },
  // tuotteet: ['guard'] on pakollinen. Ilman sitä guardPortti torjuu /api/vuoro/oma:n,
  // ja natiivisovellus ei saa vuoroaan varmistettua eikä man-down-asetusta lainkaan —
  // eli vuoro ei käynnisty ja syy näyttäisi verkkovirheeltä.
  {
    username: 'vartija1', role: 'user', roleId: 'vartijataso', tuotteet: ['guard'],
    password_hash: bcrypt.hashSync('salasana123', 4),
  },
] }, null, 2));

// Kohteella ON man-down-asetus. Se siirtyi selaimen localStoragesta tänne 12.9.2026,
// ja natiivisovelluksen on saatava se jostakin — selaimen tallenteeseen se ei pääse.
fs.writeFileSync(path.join(DATA, 'guardSites.json'), JSON.stringify([
  {
    id: 'kohde-1',
    name: 'Testikohde',
    mandown: { paalla: true, liikkumatonMin: 45 },
    kuittaus: { paalla: true, valiMin: 30 },
    // Vuorotyyppi ilman kelloaikoja: vuoron saa avata milloin tahansa, eikä testi ala
    // kaatuilla vuorokaudenajan mukaan.
    vuorotyypit: [{ id: 'v-lisa', nimi: 'Lisävuoro' }],
  },
  { id: 'kohde-ilman', name: 'Kohde ilman asetusta' },
], null, 2));

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

const vaita = (ehto, teksti) => {
  console.log(`${ehto ? '  OK   ' : '  EPÄONNISTUI  '} ${teksti}`);
  if (!ehto) process.exitCode = 1;
};

/**
 * Laiteallekirjoitettu POST. Sama nelikko ja sama kanoninen viesti kuin sydämenlyönnissä
 * ja kanavan kättelyssä — runko on mukana allekirjoituksessa (`tiiviste(runko)`), joten
 * sisältöä ei voi vaihtaa matkalla.
 *
 * Runko lähetetään täsmälleen sinä merkkijonona joka allekirjoitettiin. Jos se
 * serialisoitaisiin kahdesti, avainten järjestys voisi vaihtua ja allekirjoitus hajota
 * tavalla joka näyttäisi väärennökseltä.
 */
async function halyta({
  runko,
  nonce = crypto.randomUUID(),
  aika = Date.now(),
  avain = pari.privateKey,
  allekirjoita = true,
} = {}) {
  const teksti = JSON.stringify(runko);
  const headers = { 'content-type': 'application/json' };
  if (allekirjoita) {
    const viesti = kanoninenViesti({
      laiteId: laite.id, metodi: 'POST', polku: '/api/halytys', aika, nonce, runko: teksti,
    });
    headers['x-turvajohto-laite'] = laite.id;
    headers['x-turvajohto-aika'] = String(aika);
    headers['x-turvajohto-nonce'] = nonce;
    headers['x-turvajohto-allekirjoitus'] =
      crypto.sign('sha256', Buffer.from(viesti), avain).toString('base64');
  }
  const vastaus = await fetch(`${PALVELIN}/api/halytys`, { method: 'POST', headers, body: teksti });
  const json = await vastaus.json().catch(() => null);
  return { koodi: vastaus.status, json };
}

const kirjaudu = async () => {
  const v = await fetch(`${PALVELIN}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'testiadmin', password: 'salasana123' }),
  });
  return (v.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');
};

const halytykset = async (evaste) => {
  const v = await fetch(`${PALVELIN}/api/data/alerts`, { headers: { Cookie: evaste } });
  const j = await v.json().catch(() => null);
  return Array.isArray(j?.data) ? j.data : [];
};

/**
 * Laiteallekirjoitettu GET. Sama nelikko, tyhjä runko.
 */
async function laiteHae(polku) {
  const aika = Date.now();
  const nonce = crypto.randomUUID();
  const viesti = kanoninenViesti({
    laiteId: laite.id, metodi: 'GET', polku, aika, nonce, runko: '',
  });
  const vastaus = await fetch(`${PALVELIN}${polku}`, {
    headers: {
      'x-turvajohto-laite': laite.id,
      'x-turvajohto-aika': String(aika),
      'x-turvajohto-nonce': nonce,
      'x-turvajohto-allekirjoitus':
        crypto.sign('sha256', Buffer.from(viesti), pari.privateKey).toString('base64'),
    },
  });
  return { koodi: vastaus.status, json: await vastaus.json().catch(() => null) };
}

/** Laiteallekirjoitettu POST mielivaltaiseen polkuun. */
async function laitePosta(polku, runko) {
  const teksti = JSON.stringify(runko);
  const aika = Date.now();
  const nonce = crypto.randomUUID();
  const viesti = kanoninenViesti({
    laiteId: laite.id, metodi: 'POST', polku, aika, nonce, runko: teksti,
  });
  const vastaus = await fetch(`${PALVELIN}${polku}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-turvajohto-laite': laite.id,
      'x-turvajohto-aika': String(aika),
      'x-turvajohto-nonce': nonce,
      'x-turvajohto-allekirjoitus':
        crypto.sign('sha256', Buffer.from(viesti), pari.privateKey).toString('base64'),
    },
    body: teksti,
  });
  return { koodi: vastaus.status, json: await vastaus.json().catch(() => null) };
}

const MANDOWN = {
  tyyppi: 'mandown',
  eventId: 'kohde-1',
  kuvaus: 'Laite havaitsi iskun eikä liikettä sen jälkeen.',
  gps: { lat: LAT, lon: LON, tarkkuus: 21 },
};

try {
  await odota();

  // --- 1. Allekirjoittamaton ---------------------------------------------------------
  const ilman = await halyta({ runko: MANDOWN, allekirjoita: false });
  vaita(ilman.koodi === 401, 'allekirjoittamaton halytys torjutaan 401:lla');

  // --- 2. Vieras avain ---------------------------------------------------------------
  // Oikea laitetunnus, tuore aika, toisen avaimen allekirjoitus. Laitetunnus on julkista
  // tietoa, ja juuri tätä vastaan allekirjoitus on olemassa.
  const vieras = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const vaarennetty = await halyta({ runko: MANDOWN, avain: vieras.privateKey });
  vaita(vaarennetty.koodi === 401, 'vieraalla avaimella allekirjoitettu halytys torjutaan');

  // --- 3. Kelvollinen ----------------------------------------------------------------
  const nonce = crypto.randomUUID();
  const kelpo = await halyta({ runko: MANDOWN, nonce });
  vaita(kelpo.koodi === 200 && kelpo.json?.ok === true,
    'laiteallekirjoitettu man-down menee lapi ilman evastetta');
  vaita(kelpo.json?.halytys?.vartija === 'vartija1',
    'halytys kirjautuu laitteen omistajalle');

  // --- 4. Toistettu allekirjoitus ----------------------------------------------------
  // Sama nonce uudelleen: siepattu pyyntö ei saa kelvata toista kertaa.
  const toisto = await halyta({ runko: MANDOWN, nonce });
  vaita(toisto.koodi === 401, 'toistettu allekirjoitus torjutaan');

  // --- 5. Päivystäjä näkee -----------------------------------------------------------
  const evaste = await kirjaudu();
  const lista = await halytykset(evaste);
  const mandown = lista.filter((h) => h?.tyyppi === 'mandown');
  vaita(mandown.length === 1, 'halytys nakyy paivystajalle tasan kerran');
  vaita(mandown[0]?.kuvaus === MANDOWN.kuvaus, 'kuvaus sailyy sellaisenaan');
  vaita(Math.abs((mandown[0]?.gps?.lat ?? 0) - LAT) < 1e-9
    && Math.abs((mandown[0]?.gps?.lon ?? 0) - LON) < 1e-9,
    'gps sailyy halytyksessa');

  // --- 6. Toistopainallus ------------------------------------------------------------
  // UUSI kelvollinen allekirjoitus samasta hälytyksestä. Tämä on se mitä sovellus tekee
  // kun verkko takkusi eikä vastausta tullut. Palvelimen on palautettava sama hälytys
  // eikä luotava toista — muuten yksi kaatuminen tuottaisi kaksi tekstiviestiä.
  const uusiksi = await halyta({ runko: MANDOWN });
  vaita(uusiksi.koodi === 200 && uusiksi.json?.jokoOlemassa === true,
    'uudelleenyritys palauttaa saman halytyksen');
  vaita(uusiksi.json?.halytys?.id === kelpo.json?.halytys?.id,
    'uudelleenyritys ei luo uutta tunnusta');
  vaita((await halytykset(evaste)).filter((h) => h?.tyyppi === 'mandown').length === 1,
    'uudelleenyritys ei synnyta toista halytysta');

  // --- 7. Man-down-asetus kulkee vuoron varmistuksen mukana ---------------------------
  //
  // Tämä on erän 12 asetuksen koko kuljetus. Sovellus kysyy /api/vuoro/oma varmistaakseen
  // että vuoro on oikeasti olemassa, ja SAMASSA vastauksessa tulee kohteen asetus. Ilman
  // tätä sovelluksen pitäisi arvata onko valvonta päällä — ja arvaus kumpaan tahansa
  // suuntaan on väärä: päälle arvattuna se herättelee vartijaa yöllä ilman että kukaan on
  // niin päättänyt, pois arvattuna se ei hälytä silloin kun pitäisi.
  const aloitus = await fetch(PALVELIN + '/api/vuoro', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Cookie: evaste },
    body: JSON.stringify({
      siteId: 'kohde-1', vuorotyyppiId: 'v-lisa', vartija: 'vartija1', poikkeusSyy: 'e2e-testi',
    }),
  });
  vaita(aloitus.status === 200, 'paivystaja saa avata vuoron vartijalle');

  const oma = await laiteHae('/api/vuoro/oma');
  vaita(oma.koodi === 200 && oma.json?.vuoro?.siteId === 'kohde-1',
    'laite nakee oman vuoronsa allekirjoituksella');
  vaita(oma.json?.mandown?.paalla === true,
    'kohteen man-down-asetus tulee vuoron mukana');
  vaita(oma.json?.mandown?.liikkumatonMin === 45,
    'liikkumattomuusraja tulee kohteelta eika oletuksesta');

  vaita(oma.json?.kuittaus?.paalla === true && oma.json?.kuittaus?.valiMin === 30,
    'kuittausvaliasetus tulee vuoron mukana');

  // --- 8. Kuittausajastin: luonti, nollaus, peruminen ---------------------------------
  //
  // Sovellus luo ajastimen vuoron alussa ja nollaa sen jokaisella kuittauksella. Kesto
  // on kuittausvali + vastausaika, jotta vartijalla on aikaa vastata kyselyyn ennen kuin
  // ajastin eraantyy.
  const luonti = await laitePosta('/api/halytys/ajastin', {
    minuutit: 32, eventId: 'kohde-1', kuvaus: 'Vuoron kuittausvalvonta',
  });
  vaita(luonti.koodi === 200 && luonti.json?.halytys?.tyyppi === 'ajastin',
    'laite saa luoda kuittausajastimen allekirjoituksella');
  const ajastinId = luonti.json?.halytys?.id;

  const nollaus = await laitePosta(`/api/halytys/${ajastinId}/jatka`, { minuutit: 32 });
  vaita(nollaus.koodi === 200 && nollaus.json?.halytys?.tila === 'kaynnissa',
    'laite saa nollata ajastimen kuittauksella');
  vaita(Date.parse(nollaus.json?.halytys?.eraantyy) > Date.parse(luonti.json?.halytys?.eraantyy)
    || nollaus.json?.halytys?.eraantyy > luonti.json?.halytys?.eraantyy,
    'kuittaus siirtaa eraantymista eteenpain');

  // --- 9. KUOLLUT PUHELIN LAUKAISEE ITSESTAAN ----------------------------------------
  //
  // Taman takia ajastin on palvelimella eika laitteessa. Jos akku loppuu, sovellus
  // tapetaan tai verkko katoaa pysyvasti, kuittausta ei tule ja ajastin eraantyy
  // itsestaan. Laitteessa juokseva ajastin kuolisi laitteen mukana - eli juuri siina
  // tilanteessa jota vastaan se on olemassa.
  //
  // Kelloa siirretaan levylla eika odoteta oikeaa minuuttia: mitattava asia on
  // palvelimen halytyskierros, ei Date.now():n kyky edeta.
  const polku = path.join(DATA, 'alerts.json');
  const ennen = JSON.parse(fs.readFileSync(polku, 'utf8'));
  const lista2 = Array.isArray(ennen) ? ennen : ennen.alerts;
  for (const h of lista2) {
    // eraantyy on LUKU (ms) eika ISO-merkkijono: luoAjastin kirjoittaa sen
    // aritmetiikkana (nyt + min * 60000) vaikka alkoi on ISO. Merkkijono ei vertaudu
    // lukuun, ja eraantyneet-vertailu jaisi hiljaa epatodeksi.
    if (h.id === ajastinId) h.eraantyy = Date.now() - 1000;
  }
  fs.writeFileSync(polku, JSON.stringify(Array.isArray(ennen) ? lista2 : ennen, null, 2));

  let laukesi = null;
  for (let i = 0; i < 40 && !laukesi; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    laukesi = (await halytykset(evaste)).find((h) => h?.id === ajastinId && h?.tila === 'lauennut') || null;
  }
  vaita(!!laukesi, 'kuittaamaton ajastin laukeaa palvelimella ilman laitteen apua');

  // --- 10. Vuoron paattyessa ajastin perutaan ----------------------------------------
  const toinen = await laitePosta('/api/halytys/ajastin', {
    minuutit: 32, eventId: 'kohde-1', kuvaus: 'Vuoron kuittausvalvonta',
  });
  const peruminen = await laitePosta(`/api/halytys/${toinen.json?.halytys?.id}/peru`, {});
  vaita(peruminen.koodi === 200 && peruminen.json?.halytys?.tila === 'peruttu',
    'laite saa perua ajastimen vuoron paattyessa');

  // --- 11. Tuntematon tyyppi ----------------------------------------------------------
  // Allekirjoitus on kelvollinen mutta sisältö ei. Laite on luotettu, sen lähettämä data
  // ei ole: sidottu laite ei saa voida luoda mielivaltaisia hälytystyyppejä.
  const outo = await halyta({ runko: { ...MANDOWN, tyyppi: 'jokumuu' } });
  vaita(outo.koodi === 400, 'tuntematon halytystyyppi torjutaan vaikka allekirjoitus kelpaa');
} finally {
  palvelin.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
}
