// Julkisen yleisöilmoituksen testit.
//
// Tämä on ainoa kohta jossa tuntematon saa kirjoittaa järjestelmään, joten testit
// painottuvat siihen mitä väärinkäyttäjä yrittäisi: liian pitkä syöte, ohjausmerkit,
// vanhentunut tai peruutettu juliste ja määrärajoituksen ohittaminen.
//
// Ajetaan: npm test  (tai node --test server/)

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  tarkistaIlmoitus,
  lomakkeenTila,
  saaLahettaa,
  nollaaLaskurit,
  ratkaiseVoimassaolo,
  julkinenLomake,
  luoIlmoitusToken,
  tokenTasmaa,
  RAJAT,
  LOMAKKEEN_RAJA_TUNNISSA,
  MAX_VOIMASSAOLO_VRK,
} from './julkinen.js';

beforeEach(() => nollaaLaskurit());

test('kelvollinen ilmoitus normalisoituu', () => {
  const tulos = tarkistaIlmoitus({ kuvaus: '  Aidassa reikä lohkolla C  ', paikka: ' Portti 2 ', yhteystieto: '' });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.ilmoitus.kuvaus, 'Aidassa reikä lohkolla C');
  assert.equal(tulos.ilmoitus.paikka, 'Portti 2');
  assert.equal(tulos.ilmoitus.yhteystieto, '');
});

test('tyhjä tai liian lyhyt kuvaus hylätään', () => {
  assert.equal(tarkistaIlmoitus({ kuvaus: '' }).ok, false);
  assert.equal(tarkistaIlmoitus({ kuvaus: '  ' }).ok, false);
  assert.equal(tarkistaIlmoitus({ kuvaus: 'ok' }).ok, false);
  assert.equal(tarkistaIlmoitus(null).ok, false);
  assert.equal(tarkistaIlmoitus('teksti').ok, false);
  assert.equal(tarkistaIlmoitus([]).ok, false);
});

test('liian pitkä syöte katkaistaan rajaan', () => {
  const tulos = tarkistaIlmoitus({
    kuvaus: 'x'.repeat(RAJAT.kuvaus + 5000),
    paikka: 'y'.repeat(RAJAT.paikka + 100),
    yhteystieto: 'z'.repeat(RAJAT.yhteystieto + 100),
  });
  assert.equal(tulos.ilmoitus.kuvaus.length, RAJAT.kuvaus);
  assert.equal(tulos.ilmoitus.paikka.length, RAJAT.paikka);
  assert.equal(tulos.ilmoitus.yhteystieto.length, RAJAT.yhteystieto);
});

test('ohjausmerkit poistetaan mutta rivinvaihto säilyy', () => {
  const kuvaus = 'Ensin' + String.fromCharCode(10) + 'sitten' + String.fromCharCode(0, 7, 27, 127) + 'loppu';
  const tulos = tarkistaIlmoitus({ kuvaus });
  assert.equal(tulos.ilmoitus.kuvaus, 'Ensin' + String.fromCharCode(10) + 'sittenloppu');
});

test('ylimääräisiä kenttiä ei oteta mukaan', () => {
  const tulos = tarkistaIlmoitus({ kuvaus: 'Havainto portilla', status: 'closed', eventId: 'toinen', id: 'x' });
  assert.deepEqual(Object.keys(tulos.ilmoitus).sort(), ['kuvaus', 'paikka', 'yhteystieto']);
});

test('julisteen tila: voimassa, peruutettu, vanhentunut, tuntematon', () => {
  const nyt = new Date('2026-09-01T12:00:00Z');
  assert.equal(lomakkeenTila({ expiresAt: '2026-09-30T12:00:00Z' }, nyt).ok, true);
  assert.equal(lomakkeenTila({ revokedAt: '2026-08-01T00:00:00Z' }, nyt).syy, 'revoked');
  assert.equal(lomakkeenTila({ expiresAt: '2026-08-01T00:00:00Z' }, nyt).syy, 'expired');
  assert.equal(lomakkeenTila(null, nyt).syy, 'not_found');
});

test('määrärajoitus päästää rajaan asti ja estää sen jälkeen', () => {
  const nyt = Date.now();
  for (let i = 0; i < LOMAKKEEN_RAJA_TUNNISSA; i++) {
    assert.equal(saaLahettaa('lomake-1', nyt), true, `lähetys ${i + 1} olisi pitänyt sallia`);
  }
  assert.equal(saaLahettaa('lomake-1', nyt), false);
});

test('määrärajoitus on lomakekohtainen', () => {
  const nyt = Date.now();
  for (let i = 0; i < LOMAKKEEN_RAJA_TUNNISSA; i++) saaLahettaa('lomake-1', nyt);
  assert.equal(saaLahettaa('lomake-1', nyt), false);
  assert.equal(saaLahettaa('lomake-2', nyt), true);
});

test('määrärajoitus vapautuu tunnin kuluttua', () => {
  const nyt = Date.now();
  for (let i = 0; i < LOMAKKEEN_RAJA_TUNNISSA; i++) saaLahettaa('lomake-1', nyt);
  assert.equal(saaLahettaa('lomake-1', nyt), false);
  assert.equal(saaLahettaa('lomake-1', nyt + 60 * 60 * 1000 + 1), true);
});

test('voimassaolo: oletus, yläraja ja kelvottomat arvot', () => {
  const nyt = new Date('2026-09-01T00:00:00Z');
  assert.ok(ratkaiseVoimassaolo({}, nyt).expiresAt);
  assert.ok(ratkaiseVoimassaolo({ vrk: MAX_VOIMASSAOLO_VRK }, nyt).expiresAt);
  assert.ok(ratkaiseVoimassaolo({ vrk: MAX_VOIMASSAOLO_VRK + 1 }, nyt).error);
  assert.ok(ratkaiseVoimassaolo({ vrk: 0 }, nyt).error);
  assert.ok(ratkaiseVoimassaolo({ vrk: -5 }, nyt).error);
});

test('julkinen esitys ei sisällä tokenia', () => {
  const lomake = { id: 'a', eventId: 'fesx', token: 'SALAINEN', nimi: 'Pääportti' };
  const julkinen = julkinenLomake(lomake);
  assert.equal(julkinen.token, undefined);
  assert.equal(julkinen.nimi, 'Pääportti');
  assert.equal(JSON.stringify(julkinen).includes('SALAINEN'), false);
});

test('token on riittävän pitkä ja vertailu on vakioaikainen', () => {
  const token = luoIlmoitusToken();
  assert.ok(token.length >= 40, 'tokenin pitää olla pitkä');
  assert.equal(tokenTasmaa(token, token), true);
  assert.equal(tokenTasmaa(token, luoIlmoitusToken()), false);
  assert.equal(tokenTasmaa('', token), false);
  assert.equal(tokenTasmaa(null, token), false);
});
