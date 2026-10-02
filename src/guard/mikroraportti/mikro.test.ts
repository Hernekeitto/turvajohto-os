import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  KAIKKI_PAIKAT, KAIKKI_TAPAHTUMAT, haePaikat, haeTapahtumat, lisaaViimeisimpiin, raportinTunnus,
  tapahtumanAvain, viimeisimmatPaikat, viimeisimmatTapahtumat,
} from './mikro.ts';

test('luettelossa on kaikki taulukon rivit ja jokaisessa luokassa otsikoita', () => {
  assert.equal(KAIKKI_TAPAHTUMAT.length, 316);
  assert.equal(KAIKKI_PAIKAT.length, 103);
  for (const luokka of ['havainto', 'poikkeama', 'toimenpide'] as const) {
    assert.ok(KAIKKI_TAPAHTUMAT.filter((t) => t.luokka === luokka).length > 90, luokka);
  }
});

test('luettelossa ei ole tyhjiä eikä toistuvia otsikoita', () => {
  const avaimet = KAIKKI_TAPAHTUMAT.map(tapahtumanAvain);
  assert.equal(new Set(avaimet).size, avaimet.length);
  for (const t of KAIKKI_TAPAHTUMAT) assert.ok(t.teksti.trim() && t.alue.trim() && t.aihe.trim());
  for (const p of KAIKKI_PAIKAT) assert.ok(p.paikka.trim() && p.ryhma.trim());
});

test('haku rajaa luokan ja löytää sanat missä järjestyksessä tahansa', () => {
  const osumat = haeTapahtumat('toimenpide', 'matonreuna');
  assert.equal(osumat.length, 1);
  assert.match(osumat[0].teksti, /matonreuna/);
  assert.equal(haeTapahtumat('havainto', 'matonreuna').length, 0);
  // Sanat eri järjestyksessä kuin otsikossa.
  assert.ok(haeTapahtumat('toimenpide', 'avattu ovi').some((t) => t.teksti.startsWith('Ovi avattu')));
  // Alueen nimi kelpaa hakusanaksi.
  assert.ok(haeTapahtumat('toimenpide', 'opastus avustaminen').length > 0);
  // Tyhjä haku palauttaa koko luokan.
  assert.equal(haeTapahtumat('poikkeama', '  ').length, KAIKKI_TAPAHTUMAT.filter((t) => t.luokka === 'poikkeama').length);
});

test('paikkahaku löytää myös ryhmän nimellä ja kirjainkoosta riippumatta', () => {
  assert.ok(haePaikat('AULA').some((p) => p.paikka === 'Aula'));
  assert.equal(haePaikat('ajoneuvot').length, 9);
});

test('raportin tunnus kokoaa luokan, otsikon ja paikan', () => {
  assert.equal(raportinTunnus('toimenpide', 'Ovi avattu', 'Aula'), 'Toimenpide: Ovi avattu — Aula');
  assert.equal(raportinTunnus('havainto', 'Valo pimeänä', ''), 'Havainto: Valo pimeänä');
});

test('viimeisimmät: uusin ensin, ei kaksoiskappaleita, pituus rajattu', () => {
  let lista: string[] = [];
  for (const a of ['a', 'b', 'c', 'a']) lista = lisaaViimeisimpiin(lista, a, 3);
  assert.deepEqual(lista, ['a', 'c', 'b']);
  lista = lisaaViimeisimpiin(lista, 'd', 3);
  assert.deepEqual(lista, ['d', 'a', 'c']);
});

test('viimeisimmistä putoavat luettelosta poistuneet ja muun luokan rivit', () => {
  const ovi = KAIKKI_TAPAHTUMAT.find((t) => t.teksti.startsWith('Ovi avattu'))!;
  const avaimet = ['toimenpide|Ei enää luettelossa', tapahtumanAvain(ovi), 'havainto|x'];
  assert.deepEqual(viimeisimmatTapahtumat(avaimet, 'toimenpide'), [ovi]);
  assert.deepEqual(viimeisimmatTapahtumat(avaimet, 'havainto'), []);
  assert.deepEqual(viimeisimmatPaikat(['Yleiset tilat ja kulkureitit|Aula', 'x|y']).map((p) => p.paikka), ['Aula']);
});
