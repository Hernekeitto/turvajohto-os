// Kartan geometrian testit.
//
// Painopiste on siinä mikä johtaisi VÄÄRÄÄN PÄÄTÖKSEEN valvomossa: kehä joka näyttää
// tarkemmalta kuin sijainti on, kehä joka peittää muut yksiköt, tai suuntanuoli joka
// väittää paikallaan seisovan yksikön olevan matkalla jonnekin.
//
// Ajetaan: node --test src/guard/kartta/merkit.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KEHAN_MAX_M, KEHAN_MIN_M, jalkiGeoJson, jaljenRajat, nayttaaSuunnan, onEpatarkka,
  tarkkuuskehat, ympyra,
  type Yksikkomerkki,
} from './merkit.ts';

const HELSINKI = { lat: 60.17, lon: 24.94 };

const yksikko = (osat: Partial<Yksikkomerkki> = {}): Yksikkomerkki => ({
  username: 'matti',
  nimi: 'Piiri 301',
  tila: 'vapaa',
  gps: { ...HELSINKI, tarkkuus: 50 },
  ikaMs: 0,
  hata: false,
  ...osat,
});

// --- ympyra ------------------------------------------------------------------------

test('ympyrä sulkeutuu: ensimmäinen ja viimeinen piste ovat samat', () => {
  const rengas = ympyra(HELSINKI, 100);
  assert.deepEqual(rengas[0], rengas[rengas.length - 1]);
});

test('ympyrän säde on pyydetty määrä metrejä', () => {
  const rengas = ympyra(HELSINKI, 500, 4);
  // Itäisin piste: etäisyys keskustasta pituuspiirillä, leveysasteen kosini huomioiden.
  const ita = rengas[0];
  const metria = (ita[0] - HELSINKI.lon) * 111320 * Math.cos((HELSINKI.lat * Math.PI) / 180);
  assert.ok(Math.abs(metria - 500) < 1, `sai ${metria} m, odotettiin 500 m`);
});

test('ympyrä kapenee pohjoisessa: sama säde on enemmän pituusasteita Utsjoella', () => {
  // Jos leveysasteen kosini unohtuisi, kehä olisi Lapissa liian kapea ja näyttäisi
  // tarkemmalta kuin on. Vika ei näkyisi Helsingissä testattuna.
  const etela = ympyra({ lat: 60, lon: 25 }, 1000, 4)[0];
  const pohjoinen = ympyra({ lat: 70, lon: 25 }, 1000, 4)[0];
  assert.ok(pohjoinen[0] - 25 > etela[0] - 25);
});

// --- tarkkuuskehat -----------------------------------------------------------------

test('hyvä tarkkuus ei saa kehää', () => {
  // Kymmenen metrin ympyrä on kaupunkitasolla pienempi kuin merkki itse.
  const tulos = tarkkuuskehat([yksikko({ gps: { ...HELSINKI, tarkkuus: KEHAN_MIN_M - 1 } })]);
  assert.equal(tulos.features.length, 0);
});

test('tavallinen kaupunkitarkkuus saa kehän', () => {
  const tulos = tarkkuuskehat([yksikko({ gps: { ...HELSINKI, tarkkuus: 120 } })]);
  assert.equal(tulos.features.length, 1);
  assert.equal(tulos.features[0].properties.username, 'matti');
});

test('mahdoton tarkkuus ei saa kehää joka peittäisi kartan', () => {
  // Kymmenen kilometrin ympyrä peittää koko nakyman ja piilottaa muut yksikot juuri
  // silloin kun ne pitaisi nahda.
  const tulos = tarkkuuskehat([yksikko({ gps: { ...HELSINKI, tarkkuus: KEHAN_MAX_M + 1 } })]);
  assert.equal(tulos.features.length, 0);
});

test('puuttuva tarkkuus ei saa kehää eikä kaada kokoamista', () => {
  assert.equal(tarkkuuskehat([yksikko({ gps: { ...HELSINKI, tarkkuus: null } })]).features.length, 0);
  assert.equal(tarkkuuskehat([yksikko({ gps: { ...HELSINKI } })]).features.length, 0);
});

test('kehätön yksikkö ei katoa muiden joukosta', () => {
  // Kokoaminen suodattaa kehiä eikä yksikoita: listalla on kolme, kehia yksi.
  const tulos = tarkkuuskehat([
    yksikko({ username: 'a', gps: { ...HELSINKI, tarkkuus: 5 } }),
    yksikko({ username: 'b', gps: { ...HELSINKI, tarkkuus: 200 } }),
    yksikko({ username: 'c', gps: { ...HELSINKI, tarkkuus: 9000 } }),
  ]);
  assert.deepEqual(tulos.features.map((f) => f.properties.username), ['b']);
});

// --- onEpatarkka -------------------------------------------------------------------

test('epätarkka sijainti tunnistetaan mutta ei poisteta kartalta', () => {
  assert.equal(onEpatarkka({ ...HELSINKI, tarkkuus: 9000 }), true);
  assert.equal(onEpatarkka({ ...HELSINKI, tarkkuus: 200 }), false);
  // Puuttuva tarkkuus EI ole epätarkka: se on tuntematon, ja tuntematonta ei saa
  // esittää huonona tietona sen enempää kuin hyvänäkään.
  assert.equal(onEpatarkka({ ...HELSINKI, tarkkuus: null }), false);
});

// --- nayttaaSuunnan ----------------------------------------------------------------

test('suuntanuoli vain liikkeessä', () => {
  assert.equal(nayttaaSuunnan({ ...HELSINKI, suunta: 90, nopeus: 12 }), true);
});

test('paikallaan seisova ei saa nuolta vaikka suunta tiedetään', () => {
  // Pysahtyneen laitteen bearing on viimeisin arvaus liikkumisen ajalta. Nuoli tekisi
  // siita aikomuksen: "yksikko on menossa pohjoiseen" vaikka se on parkissa.
  assert.equal(nayttaaSuunnan({ ...HELSINKI, suunta: 90, nopeus: 0 }), false);
  assert.equal(nayttaaSuunnan({ ...HELSINKI, suunta: 90, nopeus: 0.4 }), false);
});

test('ilman suuntaa tai nopeutta ei nuolta', () => {
  assert.equal(nayttaaSuunnan({ ...HELSINKI, nopeus: 20 }), false);
  assert.equal(nayttaaSuunnan({ ...HELSINKI, suunta: 90 }), false);
  assert.equal(nayttaaSuunnan({ ...HELSINKI }), false);
});

// --- Sijaintijälki -----------------------------------------------------------------

const jp = (lon: number, lat: number, ts = '2026-09-16T10:00:00.000Z') => ({ ts, lat, lon });

test('tyhjästä jäljestä ei synny piirrettävää', () => {
  assert.equal(jalkiGeoJson([]).features.length, 0);
  assert.equal(jaljenRajat([]), null);
});

test('yhden pisteen jäljestä ei piirretä viivaa', () => {
  // Kahden identtisen koordinaatin LineString on kelvollinen mutta näkymätön, ja
  // näkymätön viiva näyttää samalta kuin puuttuva jälki.
  const f = jalkiGeoJson([jp(24.9, 60.1)]).features as Array<{ geometry: { type: string } }>;
  assert.equal(f.length, 1);
  assert.equal(f[0].geometry.type, 'Point');
});

test('jälki sisältää sekä viivan että jokaisen pisteen', () => {
  // Molemmat tarvitaan: viiva on luettava muoto, pisteet kertovat mistä on oikeasti
  // mittaus. Ilman pisteitä puolen tunnin aukko näyttäisi ajetulta reitiltä.
  const f = jalkiGeoJson([jp(24.9, 60.1), jp(25.0, 60.2), jp(25.1, 60.3)])
    .features as Array<{ geometry: { type: string } }>;
  assert.equal(f.filter((x) => x.geometry.type === 'LineString').length, 1);
  assert.equal(f.filter((x) => x.geometry.type === 'Point').length, 3);
});

test('alku ja loppu merkitään, välipisteet eivät', () => {
  const f = jalkiGeoJson([jp(24.9, 60.1), jp(25.0, 60.2), jp(25.1, 60.3)])
    .features as Array<{ properties: { paa?: string }; geometry: { type: string } }>;
  const pisteet = f.filter((x) => x.geometry.type === 'Point');
  assert.equal(pisteet[0].properties.paa, 'alku');
  assert.equal(pisteet[1].properties.paa, undefined);
  assert.equal(pisteet[2].properties.paa, 'loppu');
});

test('kelvottomat koordinaatit eivät kaada jälkeä', () => {
  // Yksi rikkinäinen rivi 45 vuorokauden lokissa ei saa estää muun jäljen piirtämistä.
  const rikki = [
    jp(24.9, 60.1),
    { ts: 'x', lat: Number.NaN, lon: 25.0 },
    { ts: 'y', lat: 60.2, lon: Number.POSITIVE_INFINITY },
    jp(25.1, 60.3),
  ];
  const f = jalkiGeoJson(rikki).features as Array<{ geometry: { type: string } }>;
  assert.equal(f.filter((x) => x.geometry.type === 'Point').length, 2);
});

test('rajat kattavat kaikki pisteet', () => {
  const rajat = jaljenRajat([jp(24.9, 60.3), jp(25.1, 60.1), jp(25.0, 60.2)]);
  assert.deepEqual(rajat, [[24.9, 60.1], [25.1, 60.3]]);
});
