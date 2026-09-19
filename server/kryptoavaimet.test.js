// PTT-avainvaraston sääntötestit (erä 26, vaihe 2, viipale 2a).
//
// Ajetaan: node --test server/kryptoavaimet.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  kelvollinenIdentiteetti, kelvollinenAllekirjoitettuPrekey, siivoaKertakayttoavaimet,
  paivitaAvainpaketti, vaadiKertakayttoavain, julkinenKuvaus,
} from './kryptoavaimet.js';

const identiteetti = () => ({ ed25519: 'ed-1', curve25519: 'cv-1' });
const prekey = () => ({ id: 'signed_curve25519:1', avain: 'sp-1', allekirjoitus: 'sig-1' });

test('kelvollinenIdentiteetti vaatii molemmat avaimet merkkijonoina', () => {
  assert.equal(kelvollinenIdentiteetti(identiteetti()), true);
  assert.equal(kelvollinenIdentiteetti({ ed25519: 'x' }), false);
  assert.equal(kelvollinenIdentiteetti(null), false);
});

test('kelvollinenAllekirjoitettuPrekey vaatii id:n, avaimen ja allekirjoituksen', () => {
  assert.equal(kelvollinenAllekirjoitettuPrekey(prekey()), true);
  assert.equal(kelvollinenAllekirjoitettuPrekey({ id: 'x', avain: 'y' }), false);
  assert.equal(kelvollinenAllekirjoitettuPrekey(undefined), false);
});

test('siivoaKertakayttoavaimet pudottaa virheelliset ja kaksoiskappaleet', () => {
  const tulos = siivoaKertakayttoavaimet([
    { id: 'a', avain: '1' },
    { id: 'a', avain: 'eri-arvo-ei-vaikuta' },
    { id: 'b', avain: '2' },
    { id: 'c' },
    null,
    'roskaa',
  ]);
  assert.deepEqual(tulos, [{ id: 'a', avain: '1' }, { id: 'b', avain: '2' }]);
});

test('siivoaKertakayttoavaimet ei kaadu ei-taulukosta', () => {
  assert.deepEqual(siivoaKertakayttoavaimet(undefined), []);
});

test('paivitaAvainpaketti luo uuden tietueen kelvollisesta paketista', () => {
  const tulos = paivitaAvainpaketti({
    id: 'vartija1:laite1', kayttaja: 'vartija1', laiteId: 'laite1',
    identiteettiavaimet: identiteetti(), allekirjoitettuPrekey: prekey(),
    kertakayttoavaimet: [{ id: 'k1', avain: 'a' }], nyt: 0,
  });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.tietue.rekisteroity, tulos.tietue.paivitetty);
  assert.equal(tulos.tietue.kertakayttoavaimet.length, 1);
});

test('paivitaAvainpaketti hylkää virheelliset identiteettiavaimet', () => {
  const tulos = paivitaAvainpaketti({
    id: 'x', kayttaja: 'vartija1', laiteId: 'laite1',
    identiteettiavaimet: { ed25519: 'vain-toinen' }, allekirjoitettuPrekey: prekey(), kertakayttoavaimet: [],
  });
  assert.equal(tulos.ok, false);
});

test('paivitaAvainpaketti hylkää virheellisen allekirjoitetun prekeyn', () => {
  const tulos = paivitaAvainpaketti({
    id: 'x', kayttaja: 'vartija1', laiteId: 'laite1',
    identiteettiavaimet: identiteetti(), allekirjoitettuPrekey: { id: 'vain-id' }, kertakayttoavaimet: [],
  });
  assert.equal(tulos.ok, false);
});

test('paivitaAvainpaketti hylkää identiteetin vaihdon olemassa olevalle laitteelle', () => {
  const alkuperainen = paivitaAvainpaketti({
    id: 'x', kayttaja: 'vartija1', laiteId: 'laite1',
    identiteettiavaimet: identiteetti(), allekirjoitettuPrekey: prekey(), kertakayttoavaimet: [],
  }).tietue;
  const tulos = paivitaAvainpaketti({
    olemassaOleva: alkuperainen, id: 'x', kayttaja: 'vartija1', laiteId: 'laite1',
    identiteettiavaimet: { ed25519: 'eri', curve25519: 'eri' }, allekirjoitettuPrekey: prekey(),
    kertakayttoavaimet: [],
  });
  assert.equal(tulos.ok, false);
});

test('paivitaAvainpaketti korvaa allekirjoitetun prekeyn ja säilyttää rekisteröintiajan', () => {
  const alkuperainen = paivitaAvainpaketti({
    id: 'x', kayttaja: 'vartija1', laiteId: 'laite1',
    identiteettiavaimet: identiteetti(), allekirjoitettuPrekey: prekey(), kertakayttoavaimet: [], nyt: 0,
  }).tietue;
  const uusiPrekey = { id: 'signed_curve25519:2', avain: 'sp-2', allekirjoitus: 'sig-2' };
  const tulos = paivitaAvainpaketti({
    olemassaOleva: alkuperainen, id: 'x', kayttaja: 'vartija1', laiteId: 'laite1',
    identiteettiavaimet: identiteetti(), allekirjoitettuPrekey: uusiPrekey, kertakayttoavaimet: [], nyt: 1000,
  });
  assert.equal(tulos.ok, true);
  assert.deepEqual(tulos.tietue.allekirjoitettuPrekey, uusiPrekey);
  assert.equal(tulos.tietue.rekisteroity, alkuperainen.rekisteroity);
  assert.notEqual(tulos.tietue.paivitetty, alkuperainen.paivitetty);
});

test('paivitaAvainpaketti lisää uudet kertakäyttöavaimet eikä korvaa vanhoja', () => {
  const alkuperainen = paivitaAvainpaketti({
    id: 'x', kayttaja: 'vartija1', laiteId: 'laite1',
    identiteettiavaimet: identiteetti(), allekirjoitettuPrekey: prekey(),
    kertakayttoavaimet: [{ id: 'k1', avain: 'a' }],
  }).tietue;
  const tulos = paivitaAvainpaketti({
    olemassaOleva: alkuperainen, id: 'x', kayttaja: 'vartija1', laiteId: 'laite1',
    identiteettiavaimet: identiteetti(), allekirjoitettuPrekey: prekey(),
    // k1 toistuu (jo olemassa, ei tuplaannu) ja k2 on uusi.
    kertakayttoavaimet: [{ id: 'k1', avain: 'a' }, { id: 'k2', avain: 'b' }],
  });
  assert.deepEqual(tulos.tietue.kertakayttoavaimet, [{ id: 'k1', avain: 'a' }, { id: 'k2', avain: 'b' }]);
});

test('vaadiKertakayttoavain irrottaa poolin ensimmäisen avaimen', () => {
  const tietue = { kertakayttoavaimet: [{ id: 'k1', avain: 'a' }, { id: 'k2', avain: 'b' }] };
  const tulos = vaadiKertakayttoavain(tietue);
  assert.deepEqual(tulos.avain, { id: 'k1', avain: 'a' });
  assert.deepEqual(tulos.tietue.kertakayttoavaimet, [{ id: 'k2', avain: 'b' }]);
  // Alkuperäinen tietue ei muutu.
  assert.equal(tietue.kertakayttoavaimet.length, 2);
});

test('vaadiKertakayttoavain palauttaa null-avaimen tyhjästä poolista', () => {
  const tietue = { kertakayttoavaimet: [] };
  const tulos = vaadiKertakayttoavain(tietue);
  assert.equal(tulos.avain, null);
  assert.equal(tulos.tietue, tietue);
});

test('julkinenKuvaus ei sisällä kertakäyttöavainpoolia', () => {
  const kuvaus = julkinenKuvaus({
    laiteId: 'laite1', identiteettiavaimet: identiteetti(), allekirjoitettuPrekey: prekey(),
    kertakayttoavaimet: [{ id: 'k1', avain: 'salainen' }],
  });
  assert.deepEqual(kuvaus, { laiteId: 'laite1', identiteettiavaimet: identiteetti(), allekirjoitettuPrekey: prekey() });
  assert.equal('kertakayttoavaimet' in kuvaus, false);
});
