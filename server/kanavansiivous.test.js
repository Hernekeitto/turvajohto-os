// PTT-kanavan sisällön siivouksen testit (erä 26, vaihe 8: kovennus).
//
// Ajetaan: node --test server/kanavansiivous.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { poistaKanavanSisalto, poistaVanhaKiinteanKanavanSisalto } from './kanavansiivous.js';

const viestit = [
  { id: 'v1', kanavaId: 'dm:1', lahettaja: 'a' },
  { id: 'v2', kanavaId: 'dm:1', lahettaja: 'b' },
  { id: 'v3', kanavaId: 'kohde:1', lahettaja: 'a' },
];
const kuittaukset = [
  { id: 'k1', viestiId: 'v1', kanavaId: 'dm:1', kayttaja: 'b' },
  { id: 'k2', viestiId: 'v3', kanavaId: 'kohde:1', kayttaja: 'c' },
];
const liitteet = [
  { id: 'l1', kanavaId: 'dm:1' },
  { id: 'l2', kanavaId: 'kohde:1' },
];

test('poistaa vain kohdekanavan viestit, säilyttää muut', () => {
  const tulos = poistaKanavanSisalto({ viestit, kuittaukset, liitteet }, 'dm:1');
  assert.deepEqual(tulos.viestit.map((v) => v.id), ['v3']);
});

test('poistaa vain kohdekanavan kuittaukset', () => {
  const tulos = poistaKanavanSisalto({ viestit, kuittaukset, liitteet }, 'dm:1');
  assert.deepEqual(tulos.kuittaukset.map((k) => k.id), ['k2']);
});

test('poistaa vain kohdekanavan liitteet ja palauttaa niiden id:t kutsujalle', () => {
  const tulos = poistaKanavanSisalto({ viestit, kuittaukset, liitteet }, 'dm:1');
  assert.deepEqual(tulos.liitteet.map((l) => l.id), ['l2']);
  assert.deepEqual(tulos.liiteIdt, ['l1']);
});

test('poistettuja-laskurit vastaavat oikeasti poistettua määrää', () => {
  const tulos = poistaKanavanSisalto({ viestit, kuittaukset, liitteet }, 'dm:1');
  assert.deepEqual(tulos.poistettuja, { viestit: 2, liitteet: 1 });
});

test('kanava jolla ei ole sisältöä ei koske muihin kanaviin eikä kaadu', () => {
  const tulos = poistaKanavanSisalto({ viestit, kuittaukset, liitteet }, 'hata:tyhja');
  assert.equal(tulos.viestit.length, viestit.length);
  assert.equal(tulos.kuittaukset.length, kuittaukset.length);
  assert.equal(tulos.liitteet.length, liitteet.length);
  assert.deepEqual(tulos.poistettuja, { viestit: 0, liitteet: 0 });
});

test('tyhjät/puuttuvat kokoelmat eivät kaada', () => {
  const tulos = poistaKanavanSisalto({}, 'dm:1');
  assert.deepEqual(tulos.viestit, []);
  assert.deepEqual(tulos.kuittaukset, []);
  assert.deepEqual(tulos.liitteet, []);
  assert.deepEqual(tulos.liiteIdt, []);
});

// --- poistaVanhaKiinteanKanavanSisalto (vaihe 8, käyttäjän päätös 22.9.2026) --------

const RAJA = new Date('2026-09-20T00:00:00.000Z').getTime();
const vanhaAika = new Date(RAJA - 1000).toISOString();
const tuoreAika = new Date(RAJA + 1000).toISOString();

const kiinteatViestit = [
  { id: 'v1', kanavaId: 'kohde:1', luotu: vanhaAika },
  { id: 'v2', kanavaId: 'kohde:1', luotu: tuoreAika },
  { id: 'v3', kanavaId: 'piiri:301', luotu: vanhaAika },
  { id: 'v4', kanavaId: 'dm:1', luotu: vanhaAika },
];
const kiinteatKuittaukset = [
  { id: 'k1', viestiId: 'v1', kanavaId: 'kohde:1' },
  { id: 'k2', viestiId: 'v2', kanavaId: 'kohde:1' },
];
const kiinteatLiitteet = [
  { id: 'l1', kanavaId: 'kohde:1', luotu: vanhaAika },
  { id: 'l2', kanavaId: 'kohde:1', luotu: tuoreAika },
];

test('poistaa vain kohde/piiri-kanavien vanhat viestit, ei tuoreita eikä muun tyyppisiä', () => {
  const tulos = poistaVanhaKiinteanKanavanSisalto(
    { viestit: kiinteatViestit, kuittaukset: kiinteatKuittaukset, liitteet: kiinteatLiitteet }, RAJA,
  );
  assert.deepEqual(tulos.viestit.map((v) => v.id).sort(), ['v2', 'v4']);
});

test('poistaa vanhaan viestiin liittyvän kuittauksen viestiId:n kautta', () => {
  const tulos = poistaVanhaKiinteanKanavanSisalto(
    { viestit: kiinteatViestit, kuittaukset: kiinteatKuittaukset, liitteet: [] }, RAJA,
  );
  assert.deepEqual(tulos.kuittaukset.map((k) => k.id), ['k2']);
});

test('poistaa vain kohde/piiri-kanavien vanhat liitteet', () => {
  const tulos = poistaVanhaKiinteanKanavanSisalto(
    { viestit: [], kuittaukset: [], liitteet: kiinteatLiitteet }, RAJA,
  );
  assert.deepEqual(tulos.liitteet.map((l) => l.id), ['l2']);
  assert.deepEqual(tulos.liiteIdt, ['l1']);
});

test('DM/vapaa/hätäkanava eivät kuulu ikärajan piiriin vaikka olisivat vanhoja', () => {
  const muut = [
    { id: 'v1', kanavaId: 'dm:1', luotu: vanhaAika },
    { id: 'v2', kanavaId: 'hata:1', luotu: vanhaAika },
    { id: 'v3', kanavaId: 'vapaa1', luotu: vanhaAika },
  ];
  const tulos = poistaVanhaKiinteanKanavanSisalto({ viestit: muut, kuittaukset: [], liitteet: [] }, RAJA);
  assert.equal(tulos.viestit.length, 3);
  assert.deepEqual(tulos.poistettuja, { viestit: 0, liitteet: 0 });
});
