// PTT-puheenvuorotilan reducerin testit (erä 26, vaihe 5, viipale 5a).
//
// Ajetaan: node --test src/guard/mobiili/puheenvuorotila.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { paivitaPuheTila } from './puheenvuorotila.ts';

test('tila-tapahtuma asettaa haltijat ja merkitsee oman käyttäjän', () => {
  const tulos = paivitaPuheTila(
    {},
    { tyyppi: 'tila', kanavaIdt: ['a', 'b'], tilat: [{ kanavaId: 'a', kayttaja: 'vartija1' }] },
    'vartija1',
  );
  assert.deepEqual(tulos, { a: { kayttaja: 'vartija1', mina: true } });
});

test('tila-tapahtuma tyhjentää pyydetyn kanavan jolla ei ole haltijaa', () => {
  const tulos = paivitaPuheTila(
    { a: { kayttaja: 'vartija1', mina: true } },
    { tyyppi: 'tila', kanavaIdt: ['a'], tilat: [] },
    'vartija1',
  );
  assert.deepEqual(tulos, {});
});

test('tila-tapahtuma ei koske kanavaa jota pyyntö ei sisältänyt', () => {
  const alku = { c: { kayttaja: 'vartija2', mina: false } };
  const tulos = paivitaPuheTila(alku, { tyyppi: 'tila', kanavaIdt: ['a'], tilat: [] }, 'vartija1');
  assert.deepEqual(tulos, alku);
});

test('myonnetty merkitsee toisen käyttäjän haltijaksi ilman mina-lippua', () => {
  const tulos = paivitaPuheTila({}, { tyyppi: 'myonnetty', kanavaId: 'a', kayttaja: 'vartija2' }, 'vartija1');
  assert.deepEqual(tulos, { a: { kayttaja: 'vartija2', mina: false } });
});

test('myonnetty merkitsee oman käyttäjän haltijaksi mina-lipulla', () => {
  const tulos = paivitaPuheTila({}, { tyyppi: 'myonnetty', kanavaId: 'a', kayttaja: 'vartija1' }, 'vartija1');
  assert.deepEqual(tulos, { a: { kayttaja: 'vartija1', mina: true } });
});

test('vapautui poistaa kanavan tilan', () => {
  const tulos = paivitaPuheTila(
    { a: { kayttaja: 'vartija1', mina: true } },
    { tyyppi: 'vapautui', kanavaId: 'a' },
    'vartija1',
  );
  assert.deepEqual(tulos, {});
});

test('vapautui kanavalle jolla ei ole tilaa ei tee mitään', () => {
  const alku = { b: { kayttaja: 'vartija2', mina: false } };
  const tulos = paivitaPuheTila(alku, { tyyppi: 'vapautui', kanavaId: 'a' }, 'vartija1');
  assert.deepEqual(tulos, alku);
});

test('alkuperäistä tilaoliota ei muuteta paikallaan', () => {
  const alku = { a: { kayttaja: 'vartija1', mina: true } };
  const jaadytetty = JSON.parse(JSON.stringify(alku));
  paivitaPuheTila(alku, { tyyppi: 'vapautui', kanavaId: 'a' }, 'vartija1');
  assert.deepEqual(alku, jaadytetty);
});
