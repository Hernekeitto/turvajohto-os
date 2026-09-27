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
