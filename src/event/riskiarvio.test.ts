// Riskiarvioinnin laskennan testit.
//
// Nämä ovat mahdollisia vasta nyt kun logiikka on omassa moduulissaan — App.tsx:n
// sisällä ne olivat komponentin paikallisia muuttujia. Painopiste on nollassa: se
// tarkoittaa "ei arvioitu" eikä "ei riskiä", ja ero ratkaisee sen torjuuko tallennus
// keskeneräisen arvion vai kirjaako se sen pienimpänä tasona.
//
// Ajetaan: node --test src/event/riskiarvio.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { riskipisteet, riskitaso, RISKITASOT, RISKISAVYT } from './riskiarvio.ts';

test('matriisi antaa ääripäät ja keskikohdan oikein', () => {
  assert.equal(riskipisteet(1, 1), 1);
  assert.equal(riskipisteet(3, 3), 5);
  assert.equal(riskipisteet(2, 2), 3);
  // Matriisi on symmetrinen: harvinainen mutta vakava on yhtä suuri kuin
  // todennäköinen mutta lievä.
  assert.equal(riskipisteet(1, 3), riskipisteet(3, 1));
});

test('arvioimaton on nolla eikä pienin taso', () => {
  assert.equal(riskipisteet(0, 0), 0);
  assert.equal(riskipisteet(2, 0), 0);
  assert.equal(riskipisteet(0, 2), 0);
  assert.equal(riskipisteet(null, null), 0);
  assert.equal(riskipisteet(undefined, 3), 0);
});

test('asteikon ulkopuolinen syöte ei indeksoi matriisin ohi', () => {
  // Ilman rajatarkistusta prob=4 lukisi matriisin ulkopuolelta ja kaatuisi.
  assert.equal(riskipisteet(4, 2), 0);
  assert.equal(riskipisteet(2, 9), 0);
  assert.equal(riskipisteet(-1, 2), 0);
  assert.equal(riskipisteet('roska', 2), 0);
});

test('jokaisella tasolla on nimi, sävy ja toimenpideohje', () => {
  for (let pisteet = 1; pisteet <= 5; pisteet++) {
    const taso = riskitaso(pisteet);
    assert.ok(taso, `taso ${pisteet} puuttuu`);
    assert.ok(taso.label.length > 0);
    // Toimenpideohje on se osa jota arviota lukeva ihminen tarvitsee: pelkkä tason
    // nimi ei kerro mitä pitäisi tehdä.
    assert.ok(taso.action.length > 10, `tasolta ${pisteet} puuttuu toimenpideohje`);
    assert.ok(taso.savy.bg && taso.savy.solid);
  }
});

test('arvioimattomalle ja tuntemattomalle tasolle ei löydy sävyä', () => {
  // Tulosruutu luki aiemmin sävyä tarkistamatta tätä — se oli kaatumisriski.
  assert.equal(riskitaso(0), null);
  assert.equal(riskitaso(9), null);
});

test('jokaisen tason sävy löytyy sävytaulukosta', () => {
  // Kirjoitusvirhe tason `tone`-kentässä ei näkyisi mitenkään ennen kuin näkymä
  // yrittää lukea sävyä eikä löydä sitä.
  for (const [pisteet, taso] of Object.entries(RISKITASOT)) {
    assert.ok(RISKISAVYT[taso.tone], `tason ${pisteet} sävyä "${taso.tone}" ei ole`);
  }
});
