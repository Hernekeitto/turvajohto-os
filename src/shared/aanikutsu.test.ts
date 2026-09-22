// PTT-äänen kuljetuksen liitoskohdan testit (erä 26, vaihe 6: kuljetusratkaisu).
//
// VAIN base64-muunnos on testattavissa täällä ilman selainta: aloitaLahetys ja
// vastaanotaAvain vaativat oikean OlmMachinen (WASM), sama rajaus kuin olm.test.ts:llä
// (ks. sen tiedoston yläkommentti) — niiden kierto on todennettava selaimessa.
//
// Ajetaan: node --test src/shared/aanikutsu.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { kehysLahetettavaksi, kehysVastaanotetusta } from './aanikutsu.ts';

test('kehysLahetettavaksi ja kehysVastaanotetusta ovat toistensa käänteisiä', () => {
  const alkuperainen = new Uint8Array([0, 1, 2, 253, 254, 255, 42]);
  const base64 = kehysLahetettavaksi(alkuperainen.buffer);
  const takaisin = new Uint8Array(kehysVastaanotetusta(base64));
  assert.deepEqual(takaisin, alkuperainen);
});

test('kehysLahetettavaksi tuottaa tavallisen (paddauksellisen) base64:n, ei URL-turvallista', () => {
  // 1 tavu -> base64 tarvitsee kaksi '='-paddausmerkkiä tavallisessa muodossa.
  const base64 = kehysLahetettavaksi(new Uint8Array([255]).buffer);
  assert.equal(base64, '/w==');
});

test('tyhjä puskuri säilyy tyhjänä', () => {
  const base64 = kehysLahetettavaksi(new ArrayBuffer(0));
  assert.equal(kehysVastaanotetusta(base64).byteLength, 0);
});
