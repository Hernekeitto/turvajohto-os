// Avainten ja muun kaluston jaon testit (lajit.ts).
//
// Painopiste on kahdessa asiassa jotka menevät ruudulla huomaamatta pieleen: esine
// katoaa molemmilta välilehdiltä tai näkyy molemmilla, ja avainlista on väärässä
// järjestyksessä. Kumpikin näyttää listalta täysin uskottavalta.
//
// Ajetaan: node --test src/guard/kalusto/lajit.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AVAINLAJIT, LAJIJARJESTYS, MUUT_LAJIT, avainJarjestys, oletusSailo, onAvainlaji,
} from './lajit.ts';
import type { Laji } from './tyypit.ts';

test('jokainen laji kuuluu tasan yhdelle valilehdelle', () => {
  // Jos laji jäisi molempien ulkopuolelle, esine ei näkyisi missään; jos se osuisi
  // molempiin, se näkyisi kahdesti ja lukumäärät eivät täsmäisi.
  for (const laji of LAJIJARJESTYS) {
    const avaimissa = AVAINLAJIT.includes(laji);
    const muissa = MUUT_LAJIT.includes(laji);
    assert.equal(avaimissa !== muissa, true, `laji ${laji} ei ole tasan yhdella valilehdella`);
  }
  assert.equal(AVAINLAJIT.length + MUUT_LAJIT.length, LAJIJARJESTYS.length);
});

test('avainkaappi kuuluu avaimiin eika muuhun kalustoon', () => {
  // Kaappi on avainten paikka. Muun kaluston seassa se olisi yksi rivi jonka
  // merkitystä ei listalta nakisi.
  assert.equal(onAvainlaji('avain'), true);
  assert.equal(onAvainlaji('avainkaappi'), true);
  assert.equal(onAvainlaji('ajoneuvo'), false);
  assert.equal(onAvainlaji('asuste'), false);
});

test('muut lajit sailyttavat LAJIJARJESTYKSEN jarjestyksen', () => {
  // Lomakkeen lajipainikkeet luetaan tästä listasta, ja niiden järjestys on käyttäjälle
  // opittu. Suodatus ei saa sekoittaa sitä.
  const odotettu = LAJIJARJESTYS.filter((laji) => !AVAINLAJIT.includes(laji));
  assert.deepEqual(MUUT_LAJIT, odotettu);
});

const esine = (laji: Laji, holviPaikka: number | null = null) => ({ laji, holviPaikka });

test('kaapit tulevat ennen avaimia', () => {
  assert.equal(avainJarjestys(esine('avainkaappi')) < avainJarjestys(esine('avain', 1000)), true);
});

test('avaimet jarjestyvat holvipaikan mukaan eivatka merkkijonona', () => {
  // Tunnuksen mukaan järjestäminen laittaisi holvipaikan 1000 ennen paikkaa 999, ja
  // merkkijonovertailu paikan 1000 ennen paikkaa 2. Kumpikin näyttää listalta oikealta.
  const paikat = [1010, 1002, 1000, 1100];
  const jarjestetty = paikat
    .map((p) => esine('avain', p))
    .sort((a, b) => avainJarjestys(a) - avainJarjestys(b))
    .map((e) => e.holviPaikka);
  assert.deepEqual(jarjestetty, [1000, 1002, 1010, 1100]);
});

test('holvipaikaton avain menee loppuun eika alkuun', () => {
  // Puuttuva paikka on virhe. Nollana se nousisi listan karkeen oikean nakoisten
  // rivien sekaan; lopussa kaikki puutteet ovat yhdessa kasassa korjattavina.
  const jarjestetty = [esine('avain', null), esine('avain', 1000), esine('avainkaappi')]
    .sort((a, b) => avainJarjestys(a) - avainJarjestys(b));
  assert.deepEqual(jarjestetty.map((e) => e.laji + ':' + e.holviPaikka), [
    'avainkaappi:null', 'avain:1000', 'avain:null',
  ]);
});

test('sailo seuraa lajia: avaimet holviin, muu kalusto varusvarastoon', () => {
  // Sama sääntö on palvelimella, ja se päättää. Tämä testi on siksi, ettei lomake
  // tarjoa eri paikkaa kuin minne esine päätyy — ristiriita näkyisi vasta
  // tallennuksen jälkeen, ja silloin kirjaaja on jo lukenut väärän paikan.
  for (const laji of LAJIJARJESTYS) {
    assert.equal(oletusSailo(laji), onAvainlaji(laji) ? 'holvi' : 'varusvarasto');
  }
});
