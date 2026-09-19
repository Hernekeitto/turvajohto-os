// PTT-kanavien jäsenyystestit (erä 26, vaihe 1).
//
// Painopiste on siinä ettei jäsenyys synny ilman kesken olevaa vuoroa, ja ettei
// piirikanava tule mukaan tavalliselle kohdevuorolle.
//
// Ajetaan: node --test server/kanavat.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  kohdeKanavaId, piiriKanavaId, omatKiinteatKanavat, kuuluuKiinteaanKanavaan,
} from './kanavat.js';

const kohdevuoro = (yli = {}) => ({
  siteId: 'kohde-1',
  siteNimi: 'Kauppakeskus Hansa',
  vuorotyyppiId: 'v-aamu',
  vuorotyyppiNimi: 'Aamuvuoro',
  tila: 'kesken',
  piiri: false,
  ...yli,
});

test('ei kanavia ilman vuoroa', () => {
  assert.deepEqual(omatKiinteatKanavat(null), []);
});

test('ei kanavia päättyneelle vuorolle', () => {
  assert.deepEqual(omatKiinteatKanavat(kohdevuoro({ tila: 'paattynyt' })), []);
});

test('tavallinen kohdevuoro tuo vain kohdekanavan', () => {
  const kanavat = omatKiinteatKanavat(kohdevuoro());
  assert.equal(kanavat.length, 1);
  assert.equal(kanavat[0].id, kohdeKanavaId('kohde-1'));
  assert.equal(kanavat[0].tyyppi, 'kohde');
  assert.equal(kanavat[0].nimi, 'Kauppakeskus Hansa');
});

test('piirivuoro tuo sekä kohde- että piirikanavan', () => {
  const kanavat = omatKiinteatKanavat(kohdevuoro({ piiri: true, vuorotyyppiId: 'v-piiri-301', vuorotyyppiNimi: 'Piiri 301' }));
  assert.equal(kanavat.length, 2);
  assert.equal(kanavat[0].tyyppi, 'kohde');
  assert.equal(kanavat[1].id, piiriKanavaId('v-piiri-301'));
  assert.equal(kanavat[1].tyyppi, 'piiri');
  assert.equal(kanavat[1].nimi, 'Piiri 301');
});

test('kuuluuKiinteaanKanavaan tunnistaa oman kohdekanavan', () => {
  const vuoro = kohdevuoro();
  assert.equal(kuuluuKiinteaanKanavaan(vuoro, kohdeKanavaId('kohde-1')), true);
  assert.equal(kuuluuKiinteaanKanavaan(vuoro, kohdeKanavaId('toinen-kohde')), false);
  assert.equal(kuuluuKiinteaanKanavaan(vuoro, piiriKanavaId('v-aamu')), false);
});

test('kuuluuKiinteaanKanavaan ilman vuoroa ei tunnista mitään', () => {
  assert.equal(kuuluuKiinteaanKanavaan(null, kohdeKanavaId('kohde-1')), false);
});
