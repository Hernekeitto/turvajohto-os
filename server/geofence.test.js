// Vyöhykepoikkeamien testit.
//
// Painopiste on vääriä hälytyksiä vastaan: toiminto jonka kaikki hälytykset ovat aiheellisia
// mutta joka hälyttää liikaa on käytännössä sama kuin toiminto joka ei hälytä lainkaan,
// koska molemmissa tapauksissa hälytykset lakataan lukemasta.
//
// Ajetaan: node --test server/geofence.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  arvioi, pisteVyohykkeessa, vyohykkeetPisteessa, avain,
  MAX_TARKKUUS_M, TOISTOSUOJA_MS,
} from './geofence.js';

const T0 = Date.parse('2026-09-03T22:00:00Z');

// Neliö kuvan vasemmassa yläneljänneksessä (0,0)-(0.4,0.4).
const NELIO = (yli = {}) => ({
  id: 'vy1',
  nimi: 'Konesali',
  pisteet: [{ x: 0, y: 0 }, { x: 0.4, y: 0 }, { x: 0.4, y: 0.4 }, { x: 0, y: 0.4 }],
  ...yli,
});

const sisalla = (tarkkuus = 10) => ({ img: { x: 0.2, y: 0.2 }, gps: { lat: 61.49, lon: 23.76, tarkkuus } });
const ulkona = (tarkkuus = 10) => ({ img: { x: 0.8, y: 0.8 }, gps: { lat: 61.5, lon: 23.77, tarkkuus } });

// --- Geometria --------------------------------------------------------------------

test('piste tunnistetaan monikulmion sisä- ja ulkopuolelta', () => {
  const v = NELIO();
  assert.equal(pisteVyohykkeessa(v, { x: 0.2, y: 0.2 }), true);
  assert.equal(pisteVyohykkeessa(v, { x: 0.5, y: 0.2 }), false);
  assert.equal(pisteVyohykkeessa(v, { x: 0.2, y: 0.9 }), false);
});

test('vajaa monikulmio ei ole vyöhyke', () => {
  assert.equal(pisteVyohykkeessa({ pisteet: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, { x: 0.5, y: 0.5 }), false);
  assert.equal(pisteVyohykkeessa({ pisteet: [] }, { x: 0.5, y: 0.5 }), false);
  assert.equal(pisteVyohykkeessa(NELIO(), null), false);
});

test('päällekkäiset vyöhykkeet palautetaan kaikki', () => {
  const iso = { id: 'iso', nimi: 'Piha', pisteet: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] };
  assert.deepEqual(vyohykkeetPisteessa([NELIO(), iso], { x: 0.2, y: 0.2 }), ['vy1', 'iso']);
});

// --- Säännöt ----------------------------------------------------------------------

test('saapuminen hälyttää kun raja ylitetään sisäänpäin', () => {
  const { poikkeamat } = arvioi({
    vyohykkeet: [NELIO({ halytys: 'saapuminen' })],
    edellinen: ulkona(), nykyinen: sisalla(), nyt: T0,
  });
  assert.equal(poikkeamat.length, 1);
  assert.equal(poikkeamat[0].vyohyke.nimi, 'Konesali');
  assert.match(poikkeamat[0].kuvaus, /Saapui/);
});

test('poistuminen hälyttää kun raja ylitetään ulospäin', () => {
  const { poikkeamat } = arvioi({
    vyohykkeet: [NELIO({ halytys: 'poistuminen' })],
    edellinen: sisalla(), nykyinen: ulkona(), nyt: T0,
  });
  assert.equal(poikkeamat.length, 1);
  assert.match(poikkeamat[0].kuvaus, /Poistui/);
});

test('sääntö hälyttää vain omaan suuntaansa', () => {
  const saapuminen = arvioi({
    vyohykkeet: [NELIO({ halytys: 'saapuminen' })],
    edellinen: sisalla(), nykyinen: ulkona(), nyt: T0,
  });
  assert.equal(saapuminen.poikkeamat.length, 0);

  const poistuminen = arvioi({
    vyohykkeet: [NELIO({ halytys: 'poistuminen' })],
    edellinen: ulkona(), nykyinen: sisalla(), nyt: T0,
  });
  assert.equal(poistuminen.poikkeamat.length, 0);
});

test('vyöhyke ilman sääntöä ei hälytä', () => {
  for (const halytys of [undefined, 'ei', '', 'jotain-muuta']) {
    const { poikkeamat } = arvioi({
      vyohykkeet: [NELIO({ halytys })], edellinen: ulkona(), nykyinen: sisalla(), nyt: T0,
    });
    assert.equal(poikkeamat.length, 0, `sääntö ${halytys} ei saa hälyttää`);
  }
});

// --- Väärien hälytysten suojat ----------------------------------------------------

test('pelkkä oleskelu vyöhykkeellä ei hälytä, vain rajan ylitys', () => {
  const { poikkeamat } = arvioi({
    vyohykkeet: [NELIO({ halytys: 'saapuminen' })],
    edellinen: sisalla(), nykyinen: { img: { x: 0.25, y: 0.25 }, gps: { tarkkuus: 10 } }, nyt: T0,
  });
  assert.equal(poikkeamat.length, 0);
});

test('ilman edellistä sijaintia ei hälytetä', () => {
  const { poikkeamat } = arvioi({
    vyohykkeet: [NELIO({ halytys: 'saapuminen' })],
    edellinen: null, nykyinen: sisalla(), nyt: T0,
  });
  assert.equal(poikkeamat.length, 0);
});

test('huono paikannustarkkuus estää arvioinnin kokonaan', () => {
  const huono = arvioi({
    vyohykkeet: [NELIO({ halytys: 'saapuminen' })],
    edellinen: ulkona(), nykyinen: sisalla(MAX_TARKKUUS_M + 1), nyt: T0,
  });
  assert.equal(huono.poikkeamat.length, 0);

  // Raja-arvo itse kelpaa vielä.
  const raja = arvioi({
    vyohykkeet: [NELIO({ halytys: 'saapuminen' })],
    edellinen: ulkona(), nykyinen: sisalla(MAX_TARKKUUS_M), nyt: T0,
  });
  assert.equal(raja.poikkeamat.length, 1);
});

test('puuttuva tarkkuustieto ei estä arviointia', () => {
  const { poikkeamat } = arvioi({
    vyohykkeet: [NELIO({ halytys: 'saapuminen' })],
    edellinen: { img: { x: 0.8, y: 0.8 } }, nykyinen: { img: { x: 0.2, y: 0.2 } }, nyt: T0,
  });
  assert.equal(poikkeamat.length, 1);
});

test('toistosuoja vaimentaa rajalla heiluvan sijainnin', () => {
  const vyohykkeet = [NELIO({ halytys: 'saapuminen' })];
  const eka = arvioi({ vyohykkeet, edellinen: ulkona(), nykyinen: sisalla(), nyt: T0 });
  assert.equal(eka.poikkeamat.length, 1);
  assert.equal(eka.viimeksi[avain('vy1', 'saapuminen')], T0);

  // Sama ylitys minuutin päästä: vaimennetaan.
  const toka = arvioi({
    vyohykkeet, edellinen: ulkona(), nykyinen: sisalla(),
    viimeksi: eka.viimeksi, nyt: T0 + 60000,
  });
  assert.equal(toka.poikkeamat.length, 0);

  // Toistosuojan jälkeen hälytys tulee taas.
  const kolmas = arvioi({
    vyohykkeet, edellinen: ulkona(), nykyinen: sisalla(),
    viimeksi: eka.viimeksi, nyt: T0 + TOISTOSUOJA_MS,
  });
  assert.equal(kolmas.poikkeamat.length, 1);
});

test('toistosuoja on vyöhyke- ja sääntökohtainen', () => {
  const vyohykkeet = [
    NELIO({ halytys: 'saapuminen' }),
    {
      id: 'vy2', nimi: 'Varasto', halytys: 'saapuminen',
      pisteet: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.1 }, { x: 0.3, y: 0.3 }, { x: 0.1, y: 0.3 }],
    },
  ];
  const { poikkeamat, viimeksi } = arvioi({ vyohykkeet, edellinen: ulkona(), nykyinen: sisalla(), nyt: T0 });
  assert.deepEqual(poikkeamat.map((p) => p.vyohyke.id), ['vy1', 'vy2']);
  assert.equal(Object.keys(viimeksi).length, 2);
});

test('viimeksi-oliota ei muuteta paikallaan', () => {
  const viimeksi = {};
  arvioi({
    vyohykkeet: [NELIO({ halytys: 'saapuminen' })],
    edellinen: ulkona(), nykyinen: sisalla(), viimeksi, nyt: T0,
  });
  assert.deepEqual(viimeksi, {});
});
