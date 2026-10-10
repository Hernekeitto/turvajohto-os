// Työvuorotoiveiden ja poissaolojen testit (erä 5).
//
// Ajetaan: node --test server/tyovuorotoiveet.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  asetaToive, poissaolotunnitJaksolle, tarkistaPoissaolo, toiveenLukitus, vuosilomanTunnit,
} from './tyovuorotoiveet.js';
import { normalisoiAsetukset } from './tyovuorolista.js';

// Listat: 5.10.–25.10. (julkaisu viim. 21.9.), 26.10.–15.11. (julkaisu viim. 12.10.)
const A = normalisoiAsetukset({ jaksotAlkaen: '2026-10-05' });
const NYT = new Date('2026-10-10T12:00:00Z');

test('lukitus: julkaisun määräaika, mennyt päivä ja puuttuva jaksorytmi', () => {
  assert.equal(toiveenLukitus(A, '2026-10-30', '2026-10-10').lukittu, false);
  assert.equal(toiveenLukitus(A, '2026-10-30', '2026-10-12').lukittu, false); // määräpäivänä vielä auki
  assert.equal(toiveenLukitus(A, '2026-10-30', '2026-10-13').lukittu, true);
  assert.equal(toiveenLukitus(A, '2026-10-15', '2026-10-10').lukittu, true); // kuluva lista
  assert.equal(toiveenLukitus(A, '2026-10-09', '2026-10-10').lukittu, true);
  assert.equal(toiveenLukitus(normalisoiAsetukset({}), '2026-10-30', '2026-10-10').lukittu, true);
});

test('toive: asetus, korvaus ja poisto', () => {
  const k = { asetukset: A, tanaan: '2026-10-10', nyt: NYT };
  const t1 = asetaToive([], { username: 'v', pvm: '2026-10-30', laji: 'vapaa', huom: ' häät ' }, k);
  assert.equal(t1.ok, true);
  assert.deepEqual(t1.toiveet.map((x) => [x.laji, x.huom]), [['vapaa', 'häät']]);
  const t2 = asetaToive(t1.toiveet, { username: 'v', pvm: '2026-10-30', laji: 'este' }, k);
  assert.equal(t2.toiveet.length, 1);
  assert.equal(t2.toiveet[0].laji, 'este');
  assert.equal(t2.toiveet[0].huom, undefined);
  const muu = asetaToive(t2.toiveet, { username: 'n', pvm: '2026-10-30', laji: 'vuoro' }, k);
  assert.equal(muu.toiveet.length, 2);
  const poisto = asetaToive(muu.toiveet, { username: 'v', pvm: '2026-10-30', laji: null }, k);
  assert.deepEqual(poisto.toiveet.map((x) => x.username), ['n']);
});

test('toive: lukittu, kelvoton laji ja liian pitkä lisätieto hylätään', () => {
  const k = { asetukset: A, tanaan: '2026-10-10', nyt: NYT };
  assert.equal(asetaToive([], { username: 'v', pvm: '2026-10-15', laji: 'vapaa' }, k).ok, false);
  assert.equal(asetaToive([], { username: 'v', pvm: '2026-10-30', laji: 'loma' }, k).ok, false);
  assert.equal(asetaToive([], { username: 'v', pvm: '2026-10-30', laji: 'vapaa', huom: 'x'.repeat(201) }, k).ok, false);
  assert.equal(asetaToive([], { username: 'v', pvm: '2027-12-01', laji: 'vapaa' }, k).ok, false);
});

test('vuosiloman tunnit: arkipäivät ma–la × 6,7 h', () => {
  assert.equal(vuosilomanTunnit('2026-10-12', '2026-10-18'), 40.2); // ma–su = 6 lomapäivää
  assert.equal(vuosilomanTunnit('2026-10-18', '2026-10-18'), 0); // sunnuntai
});

test('poissaolo: oletustunnit ja virheet', () => {
  const loma = tarkistaPoissaolo({ laji: 'vuosiloma', alku: '2026-10-12', loppu: '2026-10-18' });
  assert.equal(loma.poissaolo.tunnit, 40.2);
  const sairaus = tarkistaPoissaolo({ laji: 'sairaus', alku: '2026-10-12', loppu: '2026-10-13' });
  assert.equal(sairaus.poissaolo.tunnit, 0);
  assert.equal(tarkistaPoissaolo({ laji: 'sairaus', alku: '2026-10-12', loppu: '2026-10-13', tunnit: 16 }).poissaolo.tunnit, 16);
  assert.equal(tarkistaPoissaolo({ laji: 'x', alku: '2026-10-12', loppu: '2026-10-13' }).ok, false);
  assert.equal(tarkistaPoissaolo({ laji: 'muu', alku: '2026-10-13', loppu: '2026-10-12' }).ok, false);
  assert.equal(tarkistaPoissaolo({ laji: 'muu', alku: '2026-10-12', loppu: '2026-10-12', tunnit: -1 }).ok, false);
});

test('poissaolon tunnit jakautuvat jaksoille päivien suhteessa', () => {
  // 10 päivää, 5 kumpaankin jaksoon (raja 26.10.).
  const p = [{ alku: '2026-10-21', loppu: '2026-10-30', tunnit: 60 }];
  assert.equal(poissaolotunnitJaksolle(p, '2026-10-05', '2026-10-26'), 30);
  assert.equal(poissaolotunnitJaksolle(p, '2026-10-26', '2026-11-16'), 30);
  assert.equal(poissaolotunnitJaksolle(p, '2026-11-16', '2026-12-07'), 0);
});
