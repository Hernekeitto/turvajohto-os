// PTT-avainvaraston sääntötestit (erä 26, vaihe 2, viipale 2a/2a2).
//
// Ajetaan: node --test server/kryptoavaimet.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  kelvollinenDeviceKeys, siivoaKertakayttoavaimet, paivitaAvainpaketti, vaadiKertakayttoavain,
  julkinenKuvaus,
} from './kryptoavaimet.js';

// Muoto vastaa Matrixin /keys/upload-runkoa — ei todellisia avaimia, vain rakenne.
const deviceKeys = (yli = {}) => ({
  user_id: 'vartija1',
  device_id: 'laite1',
  algorithms: ['m.olm.v1.curve25519-aes-sha2'],
  keys: { 'curve25519:laite1': 'cv-1', 'ed25519:laite1': 'ed-1' },
  signatures: { vartija1: { 'ed25519:laite1': 'sig-1' } },
  ...yli,
});

test('kelvollinenDeviceKeys hyväksyy täsmäävän käyttäjän ja laitteen', () => {
  assert.equal(kelvollinenDeviceKeys(deviceKeys(), 'vartija1', 'laite1'), true);
});

test('kelvollinenDeviceKeys hylkää väärän käyttäjän tai laitteen', () => {
  assert.equal(kelvollinenDeviceKeys(deviceKeys(), 'vartija2', 'laite1'), false);
  assert.equal(kelvollinenDeviceKeys(deviceKeys(), 'vartija1', 'laite2'), false);
});

test('kelvollinenDeviceKeys hylkää puuttuvat kentät', () => {
  assert.equal(kelvollinenDeviceKeys(null, 'vartija1', 'laite1'), false);
  assert.equal(kelvollinenDeviceKeys({ user_id: 'vartija1', device_id: 'laite1' }, 'vartija1', 'laite1'), false);
});

test('siivoaKertakayttoavaimet pudottaa jo olemassa olevat ja väärämuotoiset', () => {
  const tulos = siivoaKertakayttoavaimet(
    { 'signed_curve25519:a': { key: '1' }, 'signed_curve25519:b': { key: '2' }, 'signed_curve25519:c': 'roskaa' },
    new Set(['signed_curve25519:a']),
  );
  assert.deepEqual(tulos, { 'signed_curve25519:b': { key: '2' } });
});

test('siivoaKertakayttoavaimet ei kaadu ei-oliosta', () => {
  assert.deepEqual(siivoaKertakayttoavaimet(undefined, new Set()), {});
  assert.deepEqual(siivoaKertakayttoavaimet(['ei', 'olio'], new Set()), {});
});

test('paivitaAvainpaketti luo uuden tietueen kelvollisesta paketista', () => {
  const tulos = paivitaAvainpaketti({
    id: 'vartija1:laite1', kayttaja: 'vartija1', laiteId: 'laite1',
    deviceKeys: deviceKeys(), kertakayttoavaimet: { 'signed_curve25519:a': { key: '1' } }, nyt: 0,
  });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.tietue.rekisteroity, tulos.tietue.paivitetty);
  assert.deepEqual(Object.keys(tulos.tietue.kertakayttoavaimet), ['signed_curve25519:a']);
});

test('paivitaAvainpaketti hylkää virheellisen device_keys-olion', () => {
  const tulos = paivitaAvainpaketti({
    id: 'x', kayttaja: 'vartija1', laiteId: 'laite1',
    deviceKeys: { user_id: 'vartija1', device_id: 'laite1' }, kertakayttoavaimet: {},
  });
  assert.equal(tulos.ok, false);
});

test('paivitaAvainpaketti hylkää identiteetin vaihdon olemassa olevalle laitteelle', () => {
  const alkuperainen = paivitaAvainpaketti({
    id: 'x', kayttaja: 'vartija1', laiteId: 'laite1', deviceKeys: deviceKeys(), kertakayttoavaimet: {},
  }).tietue;
  const tulos = paivitaAvainpaketti({
    olemassaOleva: alkuperainen, id: 'x', kayttaja: 'vartija1', laiteId: 'laite1',
    deviceKeys: deviceKeys({ keys: { 'curve25519:laite1': 'eri', 'ed25519:laite1': 'eri' } }),
    kertakayttoavaimet: {},
  });
  assert.equal(tulos.ok, false);
});

test('paivitaAvainpaketti sallii saman identiteetin uudelleenlatauksen', () => {
  const alkuperainen = paivitaAvainpaketti({
    id: 'x', kayttaja: 'vartija1', laiteId: 'laite1', deviceKeys: deviceKeys(), kertakayttoavaimet: {}, nyt: 0,
  }).tietue;
  const tulos = paivitaAvainpaketti({
    olemassaOleva: alkuperainen, id: 'x', kayttaja: 'vartija1', laiteId: 'laite1',
    deviceKeys: deviceKeys(), kertakayttoavaimet: {}, nyt: 1000,
  });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.tietue.rekisteroity, alkuperainen.rekisteroity);
  assert.notEqual(tulos.tietue.paivitetty, alkuperainen.paivitetty);
});

test('paivitaAvainpaketti lisää uudet kertakäyttöavaimet eikä korvaa vanhoja', () => {
  const alkuperainen = paivitaAvainpaketti({
    id: 'x', kayttaja: 'vartija1', laiteId: 'laite1', deviceKeys: deviceKeys(),
    kertakayttoavaimet: { 'signed_curve25519:a': { key: '1' } },
  }).tietue;
  const tulos = paivitaAvainpaketti({
    olemassaOleva: alkuperainen, id: 'x', kayttaja: 'vartija1', laiteId: 'laite1', deviceKeys: deviceKeys(),
    // a toistuu (jo olemassa, ei tuplaannu/korvaudu) ja b on uusi.
    kertakayttoavaimet: { 'signed_curve25519:a': { key: 'ERI-EI-VAIKUTA' }, 'signed_curve25519:b': { key: '2' } },
  });
  assert.deepEqual(tulos.tietue.kertakayttoavaimet, {
    'signed_curve25519:a': { key: '1' },
    'signed_curve25519:b': { key: '2' },
  });
});

test('vaadiKertakayttoavain irrottaa pyydetyn algoritmin avaimen', () => {
  const tietue = { kertakayttoavaimet: { 'signed_curve25519:a': { key: '1' }, 'fallback:b': { key: '2' } } };
  const tulos = vaadiKertakayttoavain(tietue, 'signed_curve25519');
  assert.equal(tulos.keyId, 'signed_curve25519:a');
  assert.deepEqual(tulos.avain, { key: '1' });
  assert.deepEqual(tulos.tietue.kertakayttoavaimet, { 'fallback:b': { key: '2' } });
  // Alkuperäinen tietue ei muutu.
  assert.equal(Object.keys(tietue.kertakayttoavaimet).length, 2);
});

test('vaadiKertakayttoavain palauttaa null-avaimen kun pyydettyä algoritmia ei ole', () => {
  const tietue = { kertakayttoavaimet: { 'fallback:b': { key: '2' } } };
  const tulos = vaadiKertakayttoavain(tietue, 'signed_curve25519');
  assert.equal(tulos.avain, null);
  assert.equal(tulos.keyId, null);
  assert.equal(tulos.tietue, tietue);
});

test('julkinenKuvaus ei sisällä kertakäyttöavainpoolia', () => {
  const kuvaus = julkinenKuvaus({
    laiteId: 'laite1', deviceKeys: deviceKeys(), kertakayttoavaimet: { 'signed_curve25519:a': { key: 'salainen' } },
  });
  assert.deepEqual(kuvaus, { laiteId: 'laite1', deviceKeys: deviceKeys() });
  assert.equal('kertakayttoavaimet' in kuvaus, false);
});
