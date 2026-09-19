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
  vuorossaOlevatMuut, onOsallistuja, loydaDm, luoDmKanava, dmPurkautunut,
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

// --- DM (vaihe 1c) -------------------------------------------------------------------

test('vuorossaOlevatMuut palauttaa muut kesken olevat vuorot ilman kaksoiskappaleita', () => {
  const vuorot = [
    { tila: 'kesken', vartija: 'vartija1' },
    { tila: 'kesken', vartija: 'vartija2' },
    { tila: 'kesken', vartija: 'vartija2' },
    { tila: 'paattynyt', vartija: 'vartija3' },
  ];
  assert.deepEqual(vuorossaOlevatMuut(vuorot, 'vartija1'), ['vartija2']);
});

test('vuorossaOlevatMuut ei sisällä omaa tunnusta vaikka olisi kahdesti vuorossa', () => {
  const vuorot = [{ tila: 'kesken', vartija: 'vartija1' }];
  assert.deepEqual(vuorossaOlevatMuut(vuorot, 'vartija1'), []);
});

test('luoDmKanava luo kahden osapuolen tietueen', () => {
  const tulos = luoDmKanava({ id: 'k1', kayttaja1: 'vartija1', kayttaja2: 'vartija2', nyt: 0 });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.kanava.tyyppi, 'dm');
  assert.deepEqual(tulos.kanava.osallistujat, ['vartija1', 'vartija2']);
  assert.equal(tulos.kanava.luoja, 'vartija1');
});

test('luoDmKanava ei salli samaa käyttäjää molemmiksi osapuoliksi', () => {
  const tulos = luoDmKanava({ id: 'k1', kayttaja1: 'vartija1', kayttaja2: 'vartija1' });
  assert.equal(tulos.ok, false);
});

test('loydaDm löytää olemassa olevan kanavan järjestyksestä riippumatta', () => {
  const kanavat = [{ id: 'k1', tyyppi: 'dm', osallistujat: ['vartija1', 'vartija2'] }];
  assert.equal(loydaDm(kanavat, 'vartija1', 'vartija2')?.id, 'k1');
  assert.equal(loydaDm(kanavat, 'vartija2', 'vartija1')?.id, 'k1');
  assert.equal(loydaDm(kanavat, 'vartija1', 'vartija3'), null);
});

test('loydaDm ei sekoita vapaata ryhmää DM:ään vaikka osallistujat täsmäisivät', () => {
  const kanavat = [{ id: 'k1', tyyppi: 'vapaa', osallistujat: ['vartija1', 'vartija2'] }];
  assert.equal(loydaDm(kanavat, 'vartija1', 'vartija2'), null);
});

test('onOsallistuja tunnistaa osallistujan ja ei-osallistujan', () => {
  const kanava = { osallistujat: ['vartija1', 'vartija2'] };
  assert.equal(onOsallistuja(kanava, 'vartija1'), true);
  assert.equal(onOsallistuja(kanava, 'vartija3'), false);
  assert.equal(onOsallistuja(null, 'vartija1'), false);
});

test('dmPurkautunut on tosi kun kumpikaan osapuoli ei ole vuorossa', () => {
  const kanava = { tyyppi: 'dm', osallistujat: ['vartija1', 'vartija2'] };
  assert.equal(dmPurkautunut(kanava, new Set()), true);
});

test('dmPurkautunut on epätosi jos toinenkin osapuoli on yhä vuorossa', () => {
  const kanava = { tyyppi: 'dm', osallistujat: ['vartija1', 'vartija2'] };
  assert.equal(dmPurkautunut(kanava, new Set(['vartija2'])), false);
});

test('dmPurkautunut ei koske muun tyyppisiä kanavia', () => {
  const kanava = { tyyppi: 'vapaa', osallistujat: ['vartija1', 'vartija2'] };
  assert.equal(dmPurkautunut(kanava, new Set()), false);
});
