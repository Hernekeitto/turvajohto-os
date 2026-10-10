// Kohteen miehityksen selainpuolen testit (erä 2).
//
// Palvelin on se joka ratkaisee (server/tyovuorolista.test.js). Nämä varmistavat, että
// lomake kertoo saman: sama poikkeama samoilla rajoilla, ja tiivistelmä on luettava.
//
// Ajetaan: node --test src/guard/tyovuorot/miehitys.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  kestoTekstina, miehityksenEste, miehitysTekstina, onMiehitys, vuoronKestoMin, vuoronTesPoikkeamat,
} from './miehitys.ts';

const TES = { vuoronMinH: 5, vuoronMaxH: 12, poikkeavanMaxH: 16, yorajoitus: true };

test('kesto: puolenyön yli ja vuorokausi', () => {
  assert.equal(vuoronKestoMin('18:00', '06:00'), 720);
  assert.equal(vuoronKestoMin('07:00', '07:00'), 1440);
  assert.equal(vuoronKestoMin('', '06:00'), null);
});

test('poikkeamat vastaavat palvelinta', () => {
  assert.deepEqual(vuoronTesPoikkeamat('06:00', '14:00', TES), []);
  assert.deepEqual(vuoronTesPoikkeamat('16:00', '00:00', TES), []);
  assert.deepEqual(vuoronTesPoikkeamat('22:00', '02:00', TES), ['lyhyt', 'yo']);
  assert.deepEqual(vuoronTesPoikkeamat('06:00', '20:00', TES), ['pitka']);
  assert.deepEqual(vuoronTesPoikkeamat('02:00', '10:00', { ...TES, yorajoitus: false }), []);
});

test('yli poikkeavan enimmäispituuden ei ole poikkeama vaan virhe', () => {
  // Lomake näyttää sen erikseen; poikkeamalista ei saa tarjota perustelua ratkaisuksi.
  assert.deepEqual(vuoronTesPoikkeamat('06:00', '23:00', TES), []);
});

test('tiivistelmä yhdistää peräkkäiset päivät', () => {
  assert.equal(miehitysTekstina({ maarat: [1, 1, 1, 1, 1, 2, 2] }), 'ma–pe 1, la–su 2');
  assert.equal(miehitysTekstina({ maarat: [1, 0, 1, 0, 0, 0, 1] }), 'ma 1, ke 1, su 1');
  assert.equal(miehitysTekstina({ maarat: [0, 0, 0, 0, 0, 0, 0] }), '');
  assert.equal(miehitysTekstina(undefined), '');
});

test('miehitys ja kesto tekstinä', () => {
  assert.equal(onMiehitys({ maarat: [0, 0, 0, 0, 0, 0, 1] }), true);
  assert.equal(onMiehitys({ maarat: [0, 0, 0, 0, 0, 0, 0] }), false);
  assert.equal(kestoTekstina(480), '8 h');
  assert.equal(kestoTekstina(450), '7 h 30 min');
});

test('este: ilman miehitystä ei estettä', () => {
  assert.equal(miehityksenEste(undefined, undefined, undefined, TES), null);
  assert.equal(miehityksenEste(undefined, undefined, { maarat: [0, 0, 0, 0, 0, 0, 0] }, TES), null);
});

test('este: kellonajat, enimmäispituus ja perustelu', () => {
  const m = { maarat: [1, 1, 1, 1, 1, 0, 0] };
  assert.match(miehityksenEste('', '', m, TES) || '', /alkamis- ja päättymisaika/);
  assert.match(miehityksenEste('06:00', '23:00', m, TES) || '', /16 h/);
  assert.match(miehityksenEste('06:00', '20:00', m, TES) || '', /perustelu/);
  assert.equal(miehityksenEste('06:00', '20:00', { ...m, tesPerustelu: 'Sovittu 1.10.' }, TES), null);
  assert.equal(miehityksenEste('06:00', '14:00', m, TES), null);
});

test('este: ilman sääntöjä tarkistetaan vain se mikä ei riipu niistä', () => {
  const m = { maarat: [1, 1, 1, 1, 1, 0, 0] };
  assert.equal(miehityksenEste('06:00', '23:00', m, null), null);
  assert.match(miehityksenEste('', '', m, null) || '', /alkamis/);
});

test('este: päivämäärät ja määrät', () => {
  assert.match(miehityksenEste('06:00', '14:00', { maarat: [1, 1, 1, 1, 1, 0, 0], alkaen: '2026-11-01', asti: '2026-10-01' }, TES) || '', /Loppupäivä/);
  assert.match(miehityksenEste('06:00', '14:00', { maarat: [1, 1, 1, 1, 1, 0, 1.5] }, TES) || '', /kokonaisluku/);
});
