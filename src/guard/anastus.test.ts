import { test } from 'node:test';
import assert from 'node:assert/strict';

import { laskeSummat, lueHinta, riviAlv0Snt } from './anastus.ts';

test('ALV 0 lasketaan verollisesta hinnasta', () => {
  // 12,55 € / 1,255 = 10,00 €
  assert.equal(riviAlv0Snt({ id: 'a', nimi: 'A', hinta: 12.55, alv: 25.5 }), 1000);
  // 11,35 € / 1,135 = 10,00 €
  assert.equal(riviAlv0Snt({ id: 'b', nimi: 'B', hinta: 11.35, alv: 13.5 }), 1000);
  // Nollakannalla verollinen ja veroton ovat sama.
  assert.equal(riviAlv0Snt({ id: 'c', nimi: 'C', hinta: 5, alv: 0 }), 500);
});

test('summat: rivien ALV 0 laskettuna yhteen täsmää yhteisriviin', () => {
  const tuotteet = [
    { id: '1', nimi: 'Partakoneenterät', hinta: 19.99, alv: 25.5 },
    { id: '2', nimi: 'Kahvi', hinta: 6.49, alv: 13.5 },
  ];
  const s = laskeSummat(tuotteet, [{ id: 'k', selite: 'Selvityskulut', summa: 60 }]);
  assert.equal(s.verollinenSnt, 2648);
  assert.equal(s.alv0Snt, riviAlv0Snt(tuotteet[0]) + riviAlv0Snt(tuotteet[1]));
  assert.equal(s.alvSnt + s.alv0Snt, s.verollinenSnt);
  assert.equal(s.muutKulutSnt, 6000);
  assert.equal(s.vaatimusSnt, s.alv0Snt + 6000);
});

test('hinta: pilkku, piste ja virheellinen syöte', () => {
  assert.equal(lueHinta('12,50'), 12.5);
  assert.equal(lueHinta('12.50'), 12.5);
  assert.equal(lueHinta(' 1 200,00 '), 1200);
  assert.equal(lueHinta('abc'), 0);
  assert.equal(lueHinta('-5'), 0);
});

test('kappalemäärä, tila ja tuotesuoja: korvattua ei vaadita uudelleen', () => {
  const s = laskeSummat([
    { id: '1', nimi: 'A', hinta: 12.55, alv: 25.5, kpl: 2 },                        // 25,10 → 20,00
    { id: '2', nimi: 'B', hinta: 12.55, alv: 25.5, kpl: 1, tila: 'turmeltunut' },   // 12,55 → 10,00
    { id: '3', nimi: 'C', hinta: 12.55, alv: 25.5, kpl: 1, tila: 'korvattu' },      // ei vaadita
  ], [{ id: 'k', selite: 'Selvityskulut', summa: 60 }], { tuotesuoja: 15 });
  assert.equal(s.verollinenSnt, 5020);
  assert.equal(s.turmeltunutSnt, 1255);
  assert.equal(s.korvattuSnt, 1255);
  assert.equal(s.alv0Snt, 4000);
  assert.equal(s.vaatimusSnt, 2000 + 1000 + 6000 + 1500);
});

test('vanha tietue ilman kappalemäärää lasketaan yhtenä kappaleena', () => {
  assert.equal(laskeSummat([{ id: '1', nimi: 'A', hinta: 10, alv: 0 }]).verollinenSnt, 1000);
});
