// Hälytysmuistin testit (erä 25).
//
// Painopiste on siinä MITÄ EI SAA TAPAHTUA: sama keikka ei saa hälyttää kahdesti,
// vaikka sovellus käynnistetään uudelleen tai keikka katoaa listalta hetkeksi ja palaa.
// Juuri se oli erän 23 vika, ja se näkyi kentällä niin että puhelin soi kuittauksen
// jälkeen uudelleen ja uudelleen.
//
// Ajetaan: node --test src/guard/mobiili/halytetyt.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { uudetTehtavat } from './halytetyt.ts';

const varasto = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (varasto.has(k) ? varasto.get(k)! : null),
    setItem: (k: string, v: string) => { varasto.set(k, v); },
    removeItem: (k: string) => { varasto.delete(k); },
  },
};

const T0 = Date.parse('2026-09-16T18:00:00Z');
const tunnit = (n: number) => T0 + n * 60 * 60 * 1000;

test.beforeEach(() => varasto.clear());

test('ensimmäisellä kerralla kaikki ovat uusia', () => {
  assert.deepEqual(uudetTehtavat(['a', 'b'], T0), ['a', 'b']);
});

test('sama tunniste ei ole uusi toista kertaa', () => {
  uudetTehtavat(['a'], T0);
  assert.deepEqual(uudetTehtavat(['a'], T0 + 1000), []);
});

test('sovelluksen käynnistys ei tee vanhoista uusia', () => {
  // Erän 23 vika: lista on käynnistyksessä tyhjä ja täyttyy vasta haun jälkeen, jolloin
  // edelliseen listaan vertaava koodi piti jokaista avointa keikkaa uutena.
  uudetTehtavat(['a', 'b'], T0);
  assert.deepEqual(uudetTehtavat([], T0 + 1000), [], 'tyhjä haku ei saa unohtaa mitään');
  assert.deepEqual(uudetTehtavat(['a', 'b'], T0 + 2000), []);
});

test('listalta katoava ja palaava keikka ei hälytä uudelleen', () => {
  // Sädekohdennus lukee vanhenevaa sijaintia: keikka katoaa listalta ja palaa.
  uudetTehtavat(['a'], T0);
  uudetTehtavat([], tunnit(0.5));
  uudetTehtavat(['b'], tunnit(1));
  assert.deepEqual(uudetTehtavat(['a', 'b'], tunnit(1.5)), []);
});

test('vain aidosti uusi tunniste palautuu joukosta', () => {
  uudetTehtavat(['a'], T0);
  assert.deepEqual(uudetTehtavat(['a', 'b', 'c'], T0 + 1000), ['b', 'c']);
});

test('merkintä vanhenee kahdessatoista tunnissa', () => {
  uudetTehtavat(['a'], T0);
  assert.deepEqual(uudetTehtavat(['a'], tunnit(11)), [], 'ei vielä vanhentunut');
  assert.deepEqual(uudetTehtavat(['a'], tunnit(13)), ['a'], 'vanhentunut, saa hälyttää uudelleen');
});

test('vanhentuneet siivoutuvat myös ilman uusia tunnisteita', () => {
  uudetTehtavat(['a'], T0);
  uudetTehtavat([], tunnit(13));
  const tallenne = JSON.parse(varasto.get('turvajohto-guard-halytetyt') || '{}');
  assert.deepEqual(Object.keys(tallenne), [], 'tallenne ei saa kasvaa rajatta');
});

test('vioittunut tallenne ei kaada eikä hukkaa hälytystä', () => {
  varasto.set('turvajohto-guard-halytetyt', '{ rikki');
  assert.deepEqual(uudetTehtavat(['a'], T0), ['a']);
});

test('taulukkomuotoinen tallenne tulkitaan tyhjäksi', () => {
  // JSON.parse hyväksyy taulukon, mutta `id in taulukko` tuottaisi indeksivertailun.
  varasto.set('turvajohto-guard-halytetyt', '["a"]');
  assert.deepEqual(uudetTehtavat(['a'], T0), ['a']);
});

test('estetty tallennus ei kaada — hälytys tulee, vaikka muisti ei säily', () => {
  const alkuperainen = (globalThis as any).window.localStorage.setItem;
  (globalThis as any).window.localStorage.setItem = () => { throw new Error('estetty'); };
  try {
    assert.deepEqual(uudetTehtavat(['a'], T0), ['a']);
  } finally {
    (globalThis as any).window.localStorage.setItem = alkuperainen;
  }
});
