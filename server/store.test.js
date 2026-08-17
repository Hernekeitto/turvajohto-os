// Kenttäsalauksen testit: store.js ja fieldcrypto.js yhdessä (salaus levylle,
// purku luettaessa, migraatio vanhasta selväkielisestä datasta, virhetilanteet).
//
// Ajetaan: npm test  (tai node --test server/)
//
// Käyttää keksittyjä henkilötunnuksia ja omaa väliaikaista DATA_DIRiä — ei koskaan
// oikeaa dataa eikä tuotannon avainta. Testiavain asetetaan ennen store.js:n
// importtia, koska fieldcrypto.js vaatii avaimen jo moduulin latauksessa.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const KEY = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';
const OTHER_KEY = 'ffeeddccbbaa00998877665544332211ffeeddccbbaa00998877665544332211';

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-kenttasalaus-'));
process.env.DATA_DIR = DATA_DIR;
process.env.DATA_ENCRYPTION_KEY = KEY;

const STORE_URL = new URL('./store.js', import.meta.url).href;
const { readCollection, writeCollection } = await import(STORE_URL);

const EMP_FILE = path.join(DATA_DIR, 'employees.json');
const raw = () => fs.readFileSync(EMP_FILE, 'utf8');
const rawJson = () => JSON.parse(raw());

// Keksityt testitunnukset (eivät oikeita henkilötunnuksia)
const EMPLOYEES = [
  { id: 'e1', name: 'Testi Yksi', personalId: '010190-123A', address: 'Testikatu 1', guardCard: 'K1' },
  { id: 'e2', name: 'Testi Kaksi', personalId: '020280-456B', address: 'Testikatu 2' },
];

after(() => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

test('henkilötunnus ei tallennu levylle selväkielisenä', () => {
  writeCollection('employees', EMPLOYEES);
  const text = raw();
  assert.ok(!text.includes('010190-123A'), 'levyllä oli selväkielinen henkilötunnus');
  assert.ok(!text.includes('020280-456B'), 'levyllä oli selväkielinen henkilötunnus');
  for (const r of rawJson()) assert.match(r.personalId, /^enc:/);
});

test('sama henkilötunnus tuottaa eri salatekstin (satunnainen IV)', () => {
  writeCollection('employees', EMPLOYEES);
  const a = rawJson()[0].personalId;
  writeCollection('employees', EMPLOYEES);
  const b = rawJson()[0].personalId;
  assert.notEqual(a, b, 'salateksti oli identtinen kahdella kirjoituksella');
});

test('muut kentät tallentuvat selväkielisenä ennallaan', () => {
  writeCollection('employees', EMPLOYEES);
  const stored = rawJson();
  assert.equal(stored[0].id, 'e1');
  assert.equal(stored[0].name, 'Testi Yksi');
  assert.equal(stored[0].address, 'Testikatu 1');
  assert.equal(stored[0].guardCard, 'K1');
});

test('readCollection palauttaa tietueet täsmälleen alkuperäisinä', () => {
  writeCollection('employees', EMPLOYEES);
  assert.deepEqual(readCollection('employees'), EMPLOYEES);
});

// Sama sudenkuoppa joka väistettiin db.js:n writeUsers()-funktiossa TOTP-salauksen
// kanssa: jos kirjoitus salaisi kutsujan oman olion paikallaan, kutsujalla olisi
// yhtäkkiä salattu arvo käsissään (esim. index.js:n PUT-reitti lokittaa ja palauttaa
// saman datan).
test('writeCollection ei muuta kutsujan omaa oliota', () => {
  const input = [{ id: 'x1', name: 'Muokkaamaton', personalId: '030390-789C' }];
  writeCollection('employees', input);
  assert.equal(input[0].personalId, '030390-789C', 'kutsujan olio muuttui salatuksi');
});

test('vanha selväkielinen data luetaan oikein ja salataan levylle ensimmäisellä luvulla', () => {
  fs.writeFileSync(EMP_FILE, JSON.stringify([{ id: 'm1', name: 'Vanha', personalId: '040490-321D' }], null, 2));
  const read = readCollection('employees');
  assert.equal(read[0].personalId, '040490-321D', 'migraation aikana luettu arvo oli väärä');
  assert.ok(!raw().includes('040490-321D'), 'henkilötunnus jäi levylle selväkielisenä');
  assert.match(rawJson()[0].personalId, /^enc:/);
});

// Salaus käyttää joka kerta uutta satunnaista IV:tä, joten migraation pitää olla
// kertaluonteinen — muuten levylle kirjoitettaisiin turhaan jokaisella GET-pyynnöllä.
test('migraatio on idempotentti: toinen luku ei kirjoita levylle uudelleen', () => {
  fs.writeFileSync(EMP_FILE, JSON.stringify([{ id: 'm2', name: 'Vanha', personalId: '040490-321D' }], null, 2));
  readCollection('employees'); // migroi
  const ennen = raw();
  const read = readCollection('employees');
  assert.equal(read[0].personalId, '040490-321D');
  assert.equal(raw(), ennen, 'tiedosto kirjoitettiin uudelleen turhaan');
});

test('osittain migroitunut tiedosto: selväkielinen salataan, jo salattu säilyy ennallaan', () => {
  writeCollection('employees', [
    { id: 'p1', name: 'Salattu', personalId: '050590-111E' },
    { id: 'p2', name: 'Selvä', personalId: 'korvataan' },
  ]);
  const mixed = rawJson();
  mixed[1].personalId = '060690-222F'; // kuten vanhassa, migroimattomassa datassa
  fs.writeFileSync(EMP_FILE, JSON.stringify(mixed, null, 2));
  const read = readCollection('employees');
  assert.equal(read[0].personalId, '050590-111E');
  assert.equal(read[1].personalId, '060690-222F');
  for (const r of rawJson()) assert.match(r.personalId, /^enc:/);
});

// Ilman tätä suojaa kahteen kertaan salaaminen olisi hiljainen korruptio: yksi purku
// palauttaisi yhä "enc:"-alkuisen merkkijonon, joka näkyisi käyttöliittymässä
// henkilötunnuksen paikalla.
test('jo salattua arvoa ei salata toiseen kertaan', () => {
  writeCollection('employees', [{ id: 'd1', name: 'Kerran', personalId: '070790-333G' }]);
  const encrypted = rawJson()[0].personalId;
  writeCollection('employees', [{ id: 'd1', name: 'Kerran', personalId: encrypted }]);
  assert.equal(readCollection('employees')[0].personalId, '070790-333G', 'arvo salattiin kahteen kertaan');
});

test('tyhjää, puuttuvaa tai null-henkilötunnusta ei salata', () => {
  writeCollection('employees', [
    { id: 'n1', name: 'Tyhjä', personalId: '' },
    { id: 'n2', name: 'Puuttuu' },
    { id: 'n3', name: 'Null', personalId: null },
  ]);
  const stored = rawJson();
  assert.equal(stored[0].personalId, '');
  assert.equal('personalId' in stored[1], false);
  assert.equal(stored[2].personalId, null);
  const read = readCollection('employees');
  assert.equal(read[0].personalId, '');
  assert.equal(read[2].personalId, null);
});

test('muita kokoelmia ei salata vaikka niissä olisi samanniminen kenttä', () => {
  writeCollection('checkins', [{ id: 'c1', name: 'Vartija', personalId: '080890-444H' }]);
  const text = fs.readFileSync(path.join(DATA_DIR, 'checkins.json'), 'utf8');
  assert.ok(text.includes('080890-444H'), 'checkins-kokoelma salattiin vaikka ei pitäisi');
  assert.equal(readCollection('checkins')[0].personalId, '080890-444H');
});

test('puuttuva tiedosto palauttaa yhä null', () => {
  assert.equal(readCollection('riskAssessments'), null);
});

// --- Virhetilanteet erillisissä prosesseissa (avain luetaan moduulin latauksessa,
// joten sitä ei voi vaihtaa saman prosessin sisällä) ---

function child(code, env) {
  try {
    execFileSync(process.execPath, ['--input-type=module', '-e', code], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return { ok: true, out: '' };
  } catch (err) {
    return { ok: false, out: (err.stderr || '') + (err.stdout || '') };
  }
}

test('puuttuva DATA_ENCRYPTION_KEY kaataa palvelimen moduulin latauksessa', () => {
  const r = child(`await import(${JSON.stringify(STORE_URL)});`, { DATA_ENCRYPTION_KEY: '' });
  assert.equal(r.ok, false, 'moduuli latautui ilman avainta');
  assert.match(r.out, /DATA_ENCRYPTION_KEY/);
});

test('väärän mittainen avain kaataa palvelimen moduulin latauksessa', () => {
  const r = child(`await import(${JSON.stringify(STORE_URL)});`, { DATA_ENCRYPTION_KEY: 'abc123' });
  assert.equal(r.ok, false, 'liian lyhyt avain hyväksyttiin');
  assert.match(r.out, /DATA_ENCRYPTION_KEY/);
});

// Tämä on suoraan sen suunnittelupäätöksen varmistus, että purun epäonnistuminen
// kaataa pyynnön näkyvästi: jos readCollection palauttaisi tyhjän, romahdussuoja
// (wouldWipeNonEmptyCollection vertaa uutta dataa nykyiseen) ei laukeaisi ja seuraava
// tallennus voisi ylikirjoittaa koko kokoelman.
test('väärä avain heittää eikä palauta tyhjää dataa', () => {
  writeCollection('employees', [{ id: 'w1', name: 'Testi', personalId: '090990-555J' }]);
  const r = child(
    `const s = await import(${JSON.stringify(STORE_URL)}); const d = s.readCollection("employees"); console.log("PALAUTTI:" + JSON.stringify(d));`,
    { DATA_ENCRYPTION_KEY: OTHER_KEY }
  );
  assert.equal(r.ok, false, `readCollection ei heittänyt väärällä avaimella: ${r.out}`);
  assert.ok(!r.out.includes('PALAUTTI:null'), 'väärä avain palautti null (altistaisi kokoelman ylikirjoitukselle)');
});

test('vioittunut tavu salatekstissä havaitaan (GCM authTag)', () => {
  writeCollection('employees', [{ id: 'g1', name: 'Testi', personalId: '101090-666K' }]);
  const stored = rawJson();
  const body = stored[0].personalId.slice('enc:'.length);
  const flipped = body.slice(0, -2) + (body.slice(-2, -1) === 'A' ? 'B' : 'A') + body.slice(-1);
  stored[0].personalId = `enc:${flipped}`;
  fs.writeFileSync(EMP_FILE, JSON.stringify(stored, null, 2));
  assert.throws(() => readCollection('employees'), 'vioittunut salateksti purkautui ilman virhettä');
});
