// Erän 16 päästä päähän -todennus oikeaa Express-palvelinta vasten.
// Ajetaan repon juuresta: node server/e2e-vuorot.mjs   (poistetaan ajon jälkeen)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-vuorot-'));
const PORT = 4124;
const PALVELIN = `http://127.0.0.1:${PORT}`;

const AAMU = { id: 'v-aamu', nimi: 'Aamuvuoro', alkaa: '07:00', paattyy: '15:00', tehtavaIdt: ['t1'], pohjaIdt: ['p1'] };
const ILTA = { id: 'v-ilta', nimi: 'Iltavuoro', alkaa: '15:00', paattyy: '23:00', tehtavaIdt: [], pohjaIdt: [] };
const LISA = { id: 'v-lisa', nimi: 'Lisävuoro', tehtavaIdt: [], pohjaIdt: [] };

// Oma taso vartijalle: ilman tasoa käyttäjällä ei ole yhtään oikeutta, jolloin
// perehdytettävien lista jäisi tyhjäksi eikä kenttärajausta voisi todistaa.
fs.writeFileSync(path.join(DATA, 'roles.json'), JSON.stringify({ roles: [
  {
    id: 'vartijataso',
    name: 'Vartija',
    permissions: { __default__: { guard_site_info: { view: true, edit: false } } },
  },
] }, null, 2));

fs.writeFileSync(path.join(DATA, 'users.json'), JSON.stringify({ users: [
  { username: 'testiadmin', role: 'admin', password_hash: bcrypt.hashSync('salasana123', 4) },
  {
    username: 'vartija1', role: 'user', roleId: 'vartijataso', nickname: 'Virtanen Matti',
    displayId: 51, tuotteet: ['guard'], password_hash: bcrypt.hashSync('salasana123', 4),
    totp_required: false,
  },
] }, null, 2));

fs.writeFileSync(path.join(DATA, 'guardSites.json'), JSON.stringify([
  {
    id: 'kohde-perehdytetty',
    name: 'Kauppakeskus Hansa',
    vuorotyypit: [AAMU, ILTA, LISA],
    perehdytykset: [
      // Kytketty tunnukseen: myöntää aamu- ja lisävuoron.
      { id: 'p1', nimi: 'Virtanen Matti', username: 'testiadmin', pvm: '2026-09-01', vuorotyyppiIdt: ['v-aamu', 'v-lisa'] },
      // Toisen henkilön perehdytys kaikkiin vuoroihin: ei saa vuotaa eikä myöntää mitään.
      { id: 'p2', nimi: 'Korhonen Liisa', username: 'joku-muu', pvm: '2026-09-01', vuorotyyppiIdt: ['v-aamu', 'v-ilta', 'v-lisa'] },
    ],
  },
  {
    id: 'kohde-tyhja-lista',
    name: 'Tehdas Pohjola',
    vuorotyypit: [{ ...AAMU, id: 'v-aamu2' }],
    // Kytketty tunnukseen mutta EI YHTÄÄN vuoroa: ei saa myöntää mitään.
    perehdytykset: [{ id: 'p3', nimi: 'Virtanen Matti', username: 'testiadmin', pvm: '2026-09-01', vuorotyyppiIdt: [] }],
  },
  {
    id: 'kohde-kytkematon',
    name: 'Varasto Etelä',
    vuorotyypit: [{ ...AAMU, id: 'v-aamu3' }],
    // Ei tunnusta: dokumentti kyllä, oikeus ei.
    perehdytykset: [{ id: 'p4', nimi: 'Virtanen Matti', pvm: '2026-09-01', vuorotyyppiIdt: ['v-aamu3'] }],
  },
], null, 2));

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

try {
  await odota();
  const kirj = await fetch(`${PALVELIN}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testiadmin', password: 'salasana123' }),
  });
  const evaste = (kirj.headers.getSetCookie() || []).map((r) => r.split(';')[0]).join('; ');

  const vastaus = await fetch(`${PALVELIN}/api/vuorot/omat`, { headers: { Cookie: evaste } });
  const raaka = await vastaus.text();
  const data = JSON.parse(raaka);

  console.log('\n1. Omat vuorovaihtoehdot');
  vaita(vastaus.status === 200 && data.ok, `reitti vastaa (${vastaus.status})`);
  vaita(data.kohteet.length === 1, `vain perehdytetty kohde listalla (${data.kohteet.length})`);
  vaita(data.kohteet[0]?.siteNimi === 'Kauppakeskus Hansa', 'oikea kohde');

  const vuorot = data.kohteet[0]?.vuorot || [];
  const nimella = (id) => vuorot.find((v) => v.id === id);
  vaita(vuorot.length === 3, `kaikki kohteen vuorot mukana (${vuorot.length})`);
  vaita(nimella('v-aamu')?.perehdytetty === true, 'aamuvuoro perehdytetty');
  vaita(nimella('v-lisa')?.perehdytetty === true, 'lisävuoro perehdytetty');
  vaita(nimella('v-ilta')?.perehdytetty === false, 'iltavuoroa EI ole perehdytetty, ja se näkyy silti');
  vaita(nimella('v-aamu')?.tehtavia === 1 && nimella('v-aamu')?.kierroksia === 1, 'vuoron sisältö laskettu');
  vaita(typeof nimella('v-aamu')?.ikkunassa === 'boolean', 'kello arvioitu erikseen perehdytyksestä');

  console.log('\n2. Kaksi tapaa olla myöntämättä pääsyä');
  vaita(!data.kohteet.some((k) => k.siteId === 'kohde-tyhja-lista'), 'tyhjä vuorolista ei myönnä mitään');
  vaita(!data.kohteet.some((k) => k.siteId === 'kohde-kytkematon'), 'kytkemätön perehdytys ei myönnä mitään');
  vaita(data.ilmanPerehdytysta === 2, `pois jääneet lasketaan (${data.ilmanPerehdytysta})`);

  console.log('\n3. Perehdytyslista ei vuoda vastaukseen');
  for (const kielletty of ['Virtanen', 'Korhonen', 'joku-muu', 'perehdytykset']) {
    vaita(!raaka.includes(kielletty), `"${kielletty}" ei ole vastauksessa`);
  }

  console.log('\n4. Perehdytettävien lista');
  const lista = await fetch(`${PALVELIN}/api/kohde/kohde-perehdytetty/perehdytettavat`, { headers: { Cookie: evaste } });
  const kayttajat = (await lista.json()).kayttajat;
  vaita(lista.status === 200, `reitti vastaa (${lista.status})`);
  vaita(Array.isArray(kayttajat), 'palauttaa listan');
  // Pääkäyttäjät jätetään pois: perehdytys on vartijan oikeus vuoroon.
  vaita(!kayttajat.some((k) => k.username === 'testiadmin'), 'pääkäyttäjä ei ole perehdytettävissä');
  vaita(kayttajat.some((k) => k.username === 'vartija1'), 'vartija on perehdytettävissä');
  const kentat = new Set(kayttajat.flatMap((k) => Object.keys(k)));
  vaita(kentat.size > 0 && [...kentat].every((k) => ['username', 'nimi', 'displayId'].includes(k)),
    `vain valintaan tarvittavat kentät (${[...kentat].join(',')})`);
  const raakaLista = JSON.stringify(kayttajat);
  for (const kielletty of ['password_hash', 'totp', 'roleId', 'eventAccess']) {
    vaita(!raakaLista.includes(kielletty), `"${kielletty}" ei vuoda valintalistalle`);
  }

  console.log('\n5. Kirjautumaton ei pääse kumpaankaan');
  vaita((await fetch(`${PALVELIN}/api/vuorot/omat`)).status === 401, 'omat vuorot vaatii istunnon');
  vaita((await fetch(`${PALVELIN}/api/kohde/kohde-perehdytetty/perehdytettavat`)).status === 401,
    'perehdytettävät vaatii istunnon');
} finally {
  palvelin.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
}
