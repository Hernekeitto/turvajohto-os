// PTT-median salauksen testit (erä 26, vaihe 3, viipale 3d).
//
// AES-GCM-kierto ajetaan oikealla Web Crypto -rajapinnalla (Node tarjoaa saman
// crypto.subtle-rajapinnan kuin selain) — ei mikään mock, oikea salaus ja purku.
//
// Ajetaan: node --test src/shared/salatutliitteet.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { uint8ToBase64, base64ToUint8, salaaTavut, puraTavut } from './salatutliitteet.ts';

test('uint8ToBase64 ja base64ToUint8 ovat toistensa käänteisiä', () => {
  const alkuperainen = new Uint8Array([0, 1, 2, 128, 250, 251, 252, 253, 254, 255]);
  assert.deepEqual(base64ToUint8(uint8ToBase64(alkuperainen)), alkuperainen);
});

test('salaaTavut ja puraTavut palauttavat alkuperäisen sisällön muuttumattomana', async () => {
  const alkuperainen = new TextEncoder().encode('Tämä on "kuvatiedoston" sisältö, ei oikea kuva.');
  const { avain, iv, salattu } = await salaaTavut(alkuperainen.buffer);
  assert.notDeepEqual(new Uint8Array(salattu), alkuperainen, 'salattu data ei saa näyttää selväkieliseltä');

  const purettu = await puraTavut(salattu, avain, iv);
  assert.deepEqual(new Uint8Array(purettu), alkuperainen);
});

test('jokainen salaus käyttää eri kertakäyttöavainta ja IV:tä', async () => {
  const data = new TextEncoder().encode('sama sisältö kahdesti').buffer;
  const a = await salaaTavut(data);
  const b = await salaaTavut(data);
  assert.notEqual(a.avain, b.avain);
  assert.notEqual(a.iv, b.iv);
});

test('puraTavut hylkää väärällä avaimella salatun purkamisen', async () => {
  const data = new TextEncoder().encode('salainen sisältö').buffer;
  const { iv, salattu } = await salaaTavut(data);
  const { avain: vaaraAvain } = await salaaTavut(new TextEncoder().encode('muu sisältö').buffer);
  await assert.rejects(() => puraTavut(salattu, vaaraAvain, iv));
});

test('puraTavut hylkää väärän IV:n vaikka avain olisi oikea', async () => {
  const data = new TextEncoder().encode('salainen sisältö').buffer;
  const { avain, salattu } = await salaaTavut(data);
  const { iv: vaaraIv } = await salaaTavut(data);
  await assert.rejects(() => puraTavut(salattu, avain, vaaraIv));
});
