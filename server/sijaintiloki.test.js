// Sijaintilokin testit.
//
// Painopiste on säilytysajassa ja aikavälirajauksessa. Ne ovat ne kaksi asiaa jotka
// menisivät hiljaa väärin: liian löysä siivous jättää henkilötietoa levylle yli
// säilytysajan, liian tiukka poistaa jäljen jota tarvitaan selvitykseen — ja kumpaakaan
// ei huomaa ennen kuin joku kysyy.
//
// Ajetaan: npm test  (tai node --test server/)

import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR on luettava ENNEN moduulin tuontia: se lukee polun moduulitasolla.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sijaintiloki-'));
process.env.DATA_DIR = TMP;

const {
  kirjaa, lue, siivoa, harvenna, SAILYTYS_VRK, lokiHakemisto,
} = await import('./sijaintiloki.js');

const PAIVA = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-09-15T12:00:00.000Z');

const piste = (osat = {}) => ({
  username: 'matti',
  eventId: 'kohde-a',
  gps: { lat: 60.17, lon: 24.94, tarkkuus: 12, nopeus: null, suunta: null },
  lahde: 'laite',
  ...osat,
});

beforeEach(() => {
  fs.rmSync(lokiHakemisto(), { recursive: true, force: true });
});

after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

// --- Kirjaaminen -------------------------------------------------------------------

test('piste kirjautuu ja luetaan takaisin', () => {
  assert.equal(kirjaa(piste(), T0), true);
  const tulos = lue({ username: 'matti', alku: T0 - 1000, loppu: T0 + 1000 });
  assert.equal(tulos.length, 1);
  assert.equal(tulos[0].lat, 60.17);
  assert.equal(tulos[0].lahde, 'laite');
});

test('nimimerkkiä ei kirjata lokiin', () => {
  // Pitkäikäiseen lokiin ei toisteta henkilötietoa jota saa muualta. Sama periaate kuin
  // auditlokissa.
  kirjaa({ ...piste(), nimi: 'Matti Virtanen' }, T0);
  const rivi = lue({ username: 'matti', alku: T0 - 1000, loppu: T0 + 1000 })[0];
  assert.equal(rivi.nimi, undefined);
  assert.equal(rivi.username, 'matti');
});

test('piste ilman GPS:ää ei kirjaudu', () => {
  // Pelkkä kuvakoordinaatti ei ole reitti eikä sitä voi esittää kartalla jälkeenpäin.
  assert.equal(kirjaa({ username: 'matti', gps: null }, T0), false);
  assert.equal(kirjaa({ username: '', gps: { lat: 60, lon: 24 } }, T0), false);
});

test('puuttuvat nopeus ja suunta säilyvät puuttuvina', () => {
  // null eikä nolla: "ei tiedetä" ja "seisoo paikallaan" ovat eri asioita myös jäljessä.
  kirjaa(piste({ gps: { lat: 60.17, lon: 24.94, tarkkuus: 12 } }), T0);
  const rivi = lue({ username: 'matti', alku: T0 - 1000, loppu: T0 + 1000 })[0];
  assert.equal(rivi.nopeus, null);
  assert.equal(rivi.suunta, null);
});

// --- Aikavälirajaus ----------------------------------------------------------------

test('vain pyydetyn välin pisteet palautuvat', () => {
  kirjaa(piste(), T0 - 60_000);
  kirjaa(piste(), T0);
  kirjaa(piste(), T0 + 60_000);
  const tulos = lue({ username: 'matti', alku: T0 - 1, loppu: T0 + 1 });
  assert.equal(tulos.length, 1);
});

test('välin molemmat päät ovat mukana', () => {
  // Kysyjä antaa tehtävän vastaanotto- ja poistumishetken, ja molemmat kuuluvat
  // tehtävään — puoliavoin väli jättäisi ensimmäisen tai viimeisen pisteen pois.
  kirjaa(piste(), T0);
  kirjaa(piste(), T0 + 60_000);
  assert.equal(lue({ username: 'matti', alku: T0, loppu: T0 + 60_000 }).length, 2);
});

test('toisen vartijan pisteet eivät vuoda mukaan', () => {
  kirjaa(piste({ username: 'matti' }), T0);
  kirjaa(piste({ username: 'liisa' }), T0);
  assert.deepEqual(
    lue({ username: 'matti', alku: T0 - 1000, loppu: T0 + 1000 }).map((p) => p.username),
    ['matti']
  );
});

test('väli voi ylittää vuorokaudenvaihteen', () => {
  // Yövuoro on tavallisin tapaus eikä poikkeus: jos päivätiedostoja luettaisiin vain
  // alkupäivältä, jokainen yön yli jatkunut tehtävä menettäisi puolet jäljestään.
  const ennenPuoltayota = Date.parse('2026-09-15T22:00:00.000Z');
  const jalkeenPuoleyon = Date.parse('2026-09-16T02:00:00.000Z');
  kirjaa(piste(), ennenPuoltayota);
  kirjaa(piste(), jalkeenPuoleyon);
  const tulos = lue({ username: 'matti', alku: ennenPuoltayota, loppu: jalkeenPuoleyon });
  assert.equal(tulos.length, 2);
});

test('pisteet palautuvat aikajärjestyksessä', () => {
  // Jälki on reitti, ja väärässä järjestyksessä se piirtää eri reitin kuin mitä ajettiin.
  kirjaa(piste({ gps: { lat: 61, lon: 24 } }), T0 + 120_000);
  kirjaa(piste({ gps: { lat: 60, lon: 24 } }), T0);
  const tulos = lue({ username: 'matti', alku: T0, loppu: T0 + 200_000 });
  assert.deepEqual(tulos.map((p) => p.lat), [60, 61]);
});

test('kelvoton kysely palauttaa tyhjän eikä kaada', () => {
  kirjaa(piste(), T0);
  assert.deepEqual(lue({ username: '', alku: T0, loppu: T0 }), []);
  assert.deepEqual(lue({ username: 'matti', alku: NaN, loppu: T0 }), []);
  // Loppu ennen alkua on kysymys jolla ei ole vastausta, ei virhe.
  assert.deepEqual(lue({ username: 'matti', alku: T0, loppu: T0 - 1000 }), []);
});

test('korruptoitunut rivi ei estä muiden lukemista', () => {
  kirjaa(piste(), T0);
  const polku = path.join(lokiHakemisto(), '2026-09-15.jsonl');
  fs.appendFileSync(polku, '{ tama ei ole json\n');
  kirjaa(piste({ gps: { lat: 61, lon: 25 } }), T0 + 1000);
  assert.equal(lue({ username: 'matti', alku: T0, loppu: T0 + 2000 }).length, 2);
});

// --- Säilytysaika ------------------------------------------------------------------

test('säilytysajan sisällä olevat tiedostot säilyvät', () => {
  kirjaa(piste(), T0 - (SAILYTYS_VRK - 1) * PAIVA);
  kirjaa(piste(), T0);
  const poistetut = siivoa(T0);
  assert.deepEqual(poistetut, []);
});

test('säilytysajan ylittänyt tiedosto poistetaan', () => {
  const vanha = T0 - (SAILYTYS_VRK + 2) * PAIVA;
  kirjaa(piste(), vanha);
  kirjaa(piste(), T0);
  const poistetut = siivoa(T0);
  assert.equal(poistetut.length, 1);
  // Vanha jälki on oikeasti poissa, ei vain suodatettu näkyvistä.
  assert.deepEqual(lue({ username: 'matti', alku: vanha - PAIVA, loppu: vanha + PAIVA }), []);
  // Tuore jälki säilyi.
  assert.equal(lue({ username: 'matti', alku: T0 - 1000, loppu: T0 + 1000 }).length, 1);
});

test('siivous palauttaa poistetut nimet kirjattavaksi', () => {
  // Säilytysajan noudattaminen on osoitettava jälkikäteen, eikä hiljainen poisto osoita
  // mitään.
  kirjaa(piste(), T0 - (SAILYTYS_VRK + 5) * PAIVA);
  const poistetut = siivoa(T0);
  assert.equal(poistetut.length, 1);
  assert.match(poistetut[0], /^\d{4}-\d{2}-\d{2}\.jsonl$/);
});

test('siivous ei kaadu tyhjässä hakemistossa', () => {
  assert.deepEqual(siivoa(T0), []);
});

test('siivous ei koske muihin tiedostoihin', () => {
  fs.mkdirSync(lokiHakemisto(), { recursive: true });
  const muu = path.join(lokiHakemisto(), 'lueminut.txt');
  fs.writeFileSync(muu, 'ei koskettava');
  kirjaa(piste(), T0 - (SAILYTYS_VRK + 2) * PAIVA);
  siivoa(T0);
  assert.equal(fs.existsSync(muu), true);
});

// --- Harvennus ---------------------------------------------------------------------

test('lyhyt jälki säilyy koskemattomana', () => {
  const pisteet = [1, 2, 3].map((n) => ({ ts: n }));
  assert.deepEqual(harvenna(pisteet, 10), pisteet);
});

test('pitkä jälki harvennetaan tarkalleen maksimiin', () => {
  const pisteet = Array.from({ length: 5000 }, (_, i) => ({ ts: i }));
  assert.equal(harvenna(pisteet, 100).length, 100);
});

test('ensimmäinen ja viimeinen piste säilyvät aina', () => {
  // Ne ovat ne kaksi joiden pitää vastata tehtävän alkua ja loppua. Jos viimeinen
  // katoaisi, jälki näyttäisi siltä että yksikkö pysähtyi kesken tehtävän.
  const pisteet = Array.from({ length: 999 }, (_, i) => ({ ts: i }));
  const h = harvenna(pisteet, 50);
  assert.equal(h[0].ts, 0);
  assert.equal(h[h.length - 1].ts, 998);
});

test('harvennus säilyttää aikajärjestyksen', () => {
  const pisteet = Array.from({ length: 1000 }, (_, i) => ({ ts: i }));
  const h = harvenna(pisteet, 37);
  for (let i = 1; i < h.length; i += 1) assert.ok(h[i].ts > h[i - 1].ts);
});

test('kelvoton syöte ei kaada', () => {
  assert.deepEqual(harvenna(null), []);
  assert.deepEqual(harvenna(undefined), []);
});
