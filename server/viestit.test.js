// PTT-tekstiviestien sääntötestit (erä 26, vaihe 3, viipale 3a).
//
// Ajetaan: node --test server/viestit.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { luoViesti, kanavanViestit, VIESTIN_ENIMMAISKOKO } from './viestit.js';

const tapahtuma = () => ({ algorithm: 'm.megolm.v1.aes-sha2', ciphertext: 'abc', sender_key: 'x' });

test('luoViesti luo tietueen ja laskee koon', () => {
  const tulos = luoViesti({ id: 'v1', kanavaId: 'dm:1', lahettaja: 'vartija1', tapahtuma: tapahtuma(), nyt: 0 });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.viesti.koko, Buffer.byteLength(JSON.stringify(tapahtuma()), 'utf8'));
  assert.equal(tulos.viesti.luotu, new Date(0).toISOString());
});

test('luoViesti hylkää puuttuvan tai virheellisen sisällön', () => {
  assert.equal(luoViesti({ id: 'v1', kanavaId: 'dm:1', lahettaja: 'vartija1', tapahtuma: null }).ok, false);
  assert.equal(luoViesti({ id: 'v1', kanavaId: 'dm:1', lahettaja: 'vartija1', tapahtuma: 'merkkijono' }).ok, false);
});

test('luoViesti hylkää liian suuren tapahtuman', () => {
  const iso = { ...tapahtuma(), ciphertext: 'x'.repeat(VIESTIN_ENIMMAISKOKO) };
  const tulos = luoViesti({ id: 'v1', kanavaId: 'dm:1', lahettaja: 'vartija1', tapahtuma: iso });
  assert.equal(tulos.ok, false);
});

test('kanavanViestit palauttaa vain pyydetyn kanavan viestit', () => {
  const viestit = [
    { id: 'v1', kanavaId: 'dm:1', tapahtuma: tapahtuma() },
    { id: 'v2', kanavaId: 'dm:2', tapahtuma: tapahtuma() },
    { id: 'v3', kanavaId: 'dm:1', tapahtuma: tapahtuma() },
  ];
  assert.deepEqual(kanavanViestit(viestit, 'dm:1').map((v) => v.id), ['v1', 'v3']);
});

test('kanavanViestit ei kaadu tyhjästä listasta', () => {
  assert.deepEqual(kanavanViestit(undefined, 'dm:1'), []);
});
