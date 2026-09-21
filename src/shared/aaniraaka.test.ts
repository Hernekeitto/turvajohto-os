// Opus-kehyspakkauksen testit (erä 26, vaihe 4, vaihtoehto B -PoC).
//
// Ajetaan: node --test src/shared/aaniraaka.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { pakkaaOpusKehys, puraOpusKehys, type OpusKehys } from './aaniraaka.ts';

test('pakkaaOpusKehys ja puraOpusKehys palauttavat saman kehyksen', () => {
  const kehys: OpusKehys = {
    tyyppi: 'key', aikaleima: 123456, kesto: 20000,
    data: new TextEncoder().encode('opus-tavuja').buffer,
  };
  const purettu = puraOpusKehys(pakkaaOpusKehys(kehys));
  assert.equal(purettu.tyyppi, 'key');
  assert.equal(purettu.aikaleima, 123456);
  assert.equal(purettu.kesto, 20000);
  assert.deepEqual(new Uint8Array(purettu.data), new Uint8Array(kehys.data));
});

test('delta-tyyppi säilyy', () => {
  const kehys: OpusKehys = { tyyppi: 'delta', aikaleima: 0, kesto: 10000, data: new ArrayBuffer(0) };
  assert.equal(puraOpusKehys(pakkaaOpusKehys(kehys)).tyyppi, 'delta');
});

test('puuttuva kesto (null) säilyy erotettavana nollasta', () => {
  const kehys: OpusKehys = { tyyppi: 'key', aikaleima: 0, kesto: null, data: new ArrayBuffer(0) };
  assert.equal(puraOpusKehys(pakkaaOpusKehys(kehys)).kesto, null);

  const nollaKesto: OpusKehys = { tyyppi: 'key', aikaleima: 0, kesto: 0, data: new ArrayBuffer(0) };
  assert.equal(puraOpusKehys(pakkaaOpusKehys(nollaKesto)).kesto, 0);
});

test('suuri aikaleima (yli 32-bittisen) säilyy tarkkana', () => {
  // n. 2 tuntia mikrosekunteina — ylittäisi uint32:n n. 71 minuutin kohdalla.
  const suuri = 2 * 60 * 60 * 1_000_000;
  const kehys: OpusKehys = { tyyppi: 'key', aikaleima: suuri, kesto: null, data: new ArrayBuffer(0) };
  assert.equal(puraOpusKehys(pakkaaOpusKehys(kehys)).aikaleima, suuri);
});

test('otsake on kiinteä 13 tavua ennen dataa', () => {
  const kehys: OpusKehys = { tyyppi: 'key', aikaleima: 1, kesto: 1, data: new Uint8Array(50).buffer };
  assert.equal(pakkaaOpusKehys(kehys).byteLength, 13 + 50);
});

test('tyhjä data-kenttä ei riko pakkausta tai purkua', () => {
  const kehys: OpusKehys = { tyyppi: 'delta', aikaleima: 5, kesto: null, data: new ArrayBuffer(0) };
  const purettu = puraOpusKehys(pakkaaOpusKehys(kehys));
  assert.equal(purettu.data.byteLength, 0);
});
