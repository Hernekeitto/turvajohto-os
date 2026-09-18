// Tuoreuslaskennan testit (18.9.2026, "Yhteys auki" -merkin ikä).
//
// Nämä vartioivat yhtä sääntöä: MERKKI EI SAA NÄYTTÄÄ RAUHALLISELTA SILLOIN KUN RUUTU ON
// PYSÄHTYNYT. Vihreä teksti ilman ikää ei erota toimivaa ruutua jäätyneestä, ja se ero on
// päivystäjälle koko merkin ainoa tarkoitus.
//
// Ajetaan: node --test src/guard/tuoreus.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { ikaLyhyesti, tuoreus, PULSSI_MS, VANHA_MS } from './tuoreus.ts';

const NYT = Date.parse('2026-09-18T12:00:00.000Z');
const AVATTU = NYT - 5 * 60_000;

test('tuore päivitys näkyy sekunteina eikä varoita', () => {
  const t = tuoreus(NYT - 12_000, AVATTU, NYT);
  assert.equal(t.teksti, '12 s');
  assert.equal(t.vanha, false);
});

test('raja osuu tasan VANHA_MS:ään', () => {
  // Terveellä ruudulla varakysely (60 s) pitää iän rajan alapuolella. Yksi minuutti ei
  // siis riitä varoitukseksi, eikä puolitoista minuuttia saa jäädä varoittamatta.
  assert.equal(tuoreus(NYT - 60_000, AVATTU, NYT).vanha, false);
  assert.equal(tuoreus(NYT - (VANHA_MS - 1), AVATTU, NYT).vanha, false);
  assert.equal(tuoreus(NYT - VANHA_MS, AVATTU, NYT).vanha, true);
});

test('päivityksen puuttuminen mitataan ikkunan avaamisesta', () => {
  // Ikkuna auki viisi minuuttia eikä palvelin ole kertaakaan vastannut. Se on juuri se
  // tilanne jossa päivystäjä katsoo tyhjää ruutua ja luulee sitä hiljaiseksi yöksi.
  const t = tuoreus(null, NYT - 5 * 60_000, NYT);
  assert.equal(t.vanha, true);
  assert.equal(t.teksti, 'ei tietoa');
});

test('vasta avattu ikkuna ei varoita heti', () => {
  // Ensimmäinen haku on kesken sekunnin murto-osan ajan. Varoitus siinä kohtaa olisi
  // väärä hälytys joka laukeaa joka kerta kun näkymä avataan.
  assert.equal(tuoreus(null, NYT - 2_000, NYT).vanha, false);
});

test('ei tietoa ei koskaan pulssita ikonia', () => {
  // Pulssi on todiste saapuneesta päivityksestä. Jos se sykkisi myös silloin kun mitään
  // ei ole tullut, se olisi animaatio joka esittää elonmerkkiä.
  assert.equal(tuoreus(null, NYT - 2_000, NYT).tuore, false);
  assert.equal(tuoreus(NYT - 1_000, AVATTU, NYT).tuore, true);
  assert.equal(tuoreus(NYT - PULSSI_MS, AVATTU, NYT).tuore, false);
});

test('taaksepäin hypännyt kello ei tuota negatiivista ikää', () => {
  // NTP-korjaus tai aikavyöhykkeen vaihto voi siirtää kellon taaksepäin. Negatiivinen ikä
  // näkyisi ruudulla "-3 s" ja kertoisi tulevaisuudesta.
  const t = tuoreus(NYT + 30_000, AVATTU, NYT);
  assert.equal(t.ikaMs, 0);
  assert.equal(t.teksti, '0 s');
  assert.equal(t.vanha, false);
});

test('ikä lyhenee yksiköittäin merkkiin mahtuvaksi', () => {
  assert.equal(ikaLyhyesti(0), '0 s');
  assert.equal(ikaLyhyesti(59_999), '59 s');
  assert.equal(ikaLyhyesti(60_000), '1 min');
  assert.equal(ikaLyhyesti(59 * 60_000), '59 min');
  assert.equal(ikaLyhyesti(60 * 60_000), '1 h');
  assert.equal(ikaLyhyesti(5 * 60 * 60_000), '5 h');
});
