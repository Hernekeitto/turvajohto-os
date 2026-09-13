import test from 'node:test';
import assert from 'node:assert/strict';

import { normalisoi, osuu } from './haku.ts';

test('tyhja hakuehto osuu kaikkeen', () => {
  // Kutsuja suodattaa aina samalla koodilla. Jos tyhjä ehto ei osuisi, jokaiseen
  // listaan tarvittaisiin oma "jos haku on tyhjä" -haara — ja yhdestä se jäisi pois.
  assert.equal(osuu(['mitä tahansa'], ''), true);
  assert.equal(osuu(['mitä tahansa'], '   '), true);
  assert.equal(osuu([], ''), true);
});

test('aakkoset eivat estä osumaa kumpaankaan suuntaan', () => {
  // Nimimerkki kirjoitetaan kiireessä puhelimen näppäimistöllä.
  assert.equal(osuu(['vartija.mäkelä'], 'makela'), true);
  assert.equal(osuu(['vartija.makela'], 'MÄKELÄ'), true);
  assert.equal(osuu(['Hälytyskeskus pyysi'], 'halytys'), true);
});

test('isot ja pienet kirjaimet eivat merkitse', () => {
  assert.equal(osuu(['Turva051'], 'turva'), true);
  assert.equal(osuu(['turva051'], 'TURVA051'), true);
});

test('osuma voi tulla mista tahansa kentasta', () => {
  assert.equal(osuu(['vartija.laine', 'Teollisuuskatu 5', null], 'teollisuus'), true);
  assert.equal(osuu([null, undefined, 'Ajastinhälytys'], 'ajastin'), true);
});

test('monta sanaa on JA-ehto, ei TAI', () => {
  // "virtanen tarkistus" tarkoittaa riviä jossa on molemmat. Jos tämä olisi TAI,
  // hakusanan lisääminen kasvattaisi tuloslistaa — päinvastoin kuin ihminen odottaa.
  const kentat = ['vartija.virtanen', 'Hälytyskeskus pyysi tarkistusta', 'Satamatie 12'];
  assert.equal(osuu(kentat, 'virtanen tarkistus'), true);
  assert.equal(osuu(kentat, 'virtanen kierros'), false);
  // Sanat voivat osua eri kenttiin.
  assert.equal(osuu(kentat, 'virtanen satamatie'), true);
});

test('osittainen sana riittaa', () => {
  // Päivystäjä ei kirjoita nimimerkkiä loppuun asti kun hälytys soi.
  assert.equal(osuu(['vartija.heikkila'], 'heik'), true);
  assert.equal(osuu(['vartija.heikkila'], 'kkil'), true);
});

test('tyhjat ja puuttuvat kentat eivat kaada eivatka osu', () => {
  assert.equal(osuu([null, undefined, ''], 'mitään'), false);
  assert.equal(osuu([], 'mitään'), false);
});

test('normalisoi poistaa reunavälit', () => {
  assert.equal(normalisoi('  Mäkelä  '), 'makela');
});
