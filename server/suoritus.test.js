// Pohjan suorituksen sääntöjen testit (skenaariot ja run sheet).
//
// Painopiste on siinä mitä EI saa voida tehdä: kriittistä kohtaa ei voi ohittaa, keskeytys
// ei onnistu ilman syytä eikä päättynyttä suoritusta avata uudelleen. Ilman näitä
// "skenaario hoidettu" tarkoittaisi vain sitä että joku painoi nappia.
//
// Ajetaan: node --test server/suoritus.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aloitaSuoritus, kuittaaKohta, paataSuoritus, kuittaamattomat, kriittisetKuittaamatta,
  onPaattynyt, kooste,
} from './suoritus.js';

const POHJA = {
  id: 'pohja-1',
  kind: 'play',
  nimi: 'Kadonnut lapsi',
  versio: 2,
  kohdat: [
    { id: 'k2', teksti: 'Sulje portit', kuvaus: 'Kaikki uloskäynnit', jarjestys: 1, vastuu: 'Turva 1', kriittinen: true },
    { id: 'k1', teksti: 'Ota tuntomerkit', kuvaus: '', jarjestys: 0, vastuu: 'TIKE', kriittinen: true },
    { id: 'k3', teksti: 'Kuuluta alueella', kuvaus: '', jarjestys: 2, vastuu: '', kriittinen: false },
  ],
};

const T0 = new Date('2026-09-03T18:00:00Z');

const aloita = () => aloitaSuoritus({
  pohja: POHJA, ownerId: 'fesx', tekija: 'tike1', id: 's-1',
  kuvaus: 'Poika 6 v, punainen takki', nyt: T0,
}).suoritus;

// --- Aloitus ----------------------------------------------------------------------

test('suoritus kopioi kohdat järjestyksessä ja tiedot pohjasta', () => {
  const s = aloita();
  assert.deepEqual(s.kohdat.map((k) => k.teksti), ['Ota tuntomerkit', 'Sulje portit', 'Kuuluta alueella']);
  assert.equal(s.tila, 'kesken');
  assert.equal(s.templateNimi, 'Kadonnut lapsi');
  assert.equal(s.templateVersio, 2);
  assert.equal(s.kuvaus, 'Poika 6 v, punainen takki');
  assert.equal(s.kohdat[1].vastuu, 'Turva 1');
  assert.equal(s.kohdat[2].kriittinen, false);
});

test('tyhjästä tai arkistoidusta pohjasta ei voi aloittaa', () => {
  assert.equal(aloitaSuoritus({ pohja: { ...POHJA, kohdat: [] }, id: 'x' }).ok, false);
  assert.equal(aloitaSuoritus({ pohja: { ...POHJA, arkistoitu: '2026-09-01' }, id: 'x' }).ok, false);
});

test('pohjan muokkaus ei muuta jo alkanutta suoritusta', () => {
  const s = aloita();
  POHJA.kohdat[0].teksti = 'MUUTETTU';
  assert.equal(s.kohdat[1].teksti, 'Sulje portit');
  POHJA.kohdat[0].teksti = 'Sulje portit';
});

// --- Kuittaus ---------------------------------------------------------------------

test('kohta kuitataan kerran ja kuittaus tallentaa tekijän', () => {
  const s = aloita();
  const tulos = kuittaaKohta({ suoritus: s, kohtaId: 'k1', tekija: 'tike1', huomio: 'Isä kertoi', nyt: T0 });
  assert.equal(tulos.ok, true);
  const kohta = tulos.suoritus.kohdat.find((k) => k.kohtaId === 'k1');
  assert.equal(kohta.kuittaaja, 'tike1');
  assert.equal(kohta.huomio, 'Isä kertoi');
  // Toinen kuittaus samaan kohtaan on virhe: aikaleima ei saa siirtyä.
  assert.equal(kuittaaKohta({ suoritus: tulos.suoritus, kohtaId: 'k1' }).ok, false);
});

test('jonosta tuleva toistokuittaus ei ole virhe', () => {
  const s = aloita();
  const eka = kuittaaKohta({ suoritus: s, kohtaId: 'k1', tekija: 'tike1', nyt: T0 });
  const toka = kuittaaKohta({ suoritus: eka.suoritus, kohtaId: 'k1', tekija: 'tike1', toisto: true });
  assert.equal(toka.ok, true);
  assert.equal(toka.duplikaatti, true);
});

test('tuntematonta kohtaa ei voi kuitata', () => {
  assert.equal(kuittaaKohta({ suoritus: aloita(), kohtaId: 'ei-ole' }).ok, false);
});

test('kuittaus ei muuta alkuperäistä tietuetta', () => {
  const s = aloita();
  const kopio = JSON.parse(JSON.stringify(s));
  kuittaaKohta({ suoritus: s, kohtaId: 'k1', tekija: 'x', nyt: T0 });
  assert.deepEqual(s, kopio);
});

// --- Päättäminen ------------------------------------------------------------------

test('valmiiksi ei voi merkitä jos kriittinen kohta on kuittaamatta', () => {
  const s = aloita();
  const tulos = paataSuoritus({ suoritus: s, tila: 'valmis', nyt: T0 });
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /kriittist/i);
});

test('valmiiksi voi merkitä kun kriittiset on kuitattu, vaikka muita jäisi', () => {
  let s = aloita();
  s = kuittaaKohta({ suoritus: s, kohtaId: 'k1', tekija: 'a', nyt: T0 }).suoritus;
  s = kuittaaKohta({ suoritus: s, kohtaId: 'k2', tekija: 'a', nyt: T0 }).suoritus;
  assert.equal(kriittisetKuittaamatta(s).length, 0);
  assert.equal(kuittaamattomat(s).length, 1);

  const tulos = paataSuoritus({ suoritus: s, tila: 'valmis', huomiot: 'Lapsi löytyi', nyt: T0 });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.suoritus.tila, 'valmis');
  assert.equal(tulos.suoritus.huomiot, 'Lapsi löytyi');
  assert.equal(onPaattynyt(tulos.suoritus), true);
});

test('keskeytys vaatii syyn', () => {
  const s = aloita();
  assert.equal(paataSuoritus({ suoritus: s, tila: 'keskeytetty', nyt: T0 }).ok, false);
  assert.equal(paataSuoritus({ suoritus: s, tila: 'keskeytetty', syy: 'x', nyt: T0 }).ok, false);
  const tulos = paataSuoritus({ suoritus: s, tila: 'keskeytetty', syy: 'Poliisi otti johdon', nyt: T0 });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.suoritus.keskeytysSyy, 'Poliisi otti johdon');
});

test('keskeytys onnistuu vaikka kriittisiä olisi kuittaamatta', () => {
  const tulos = paataSuoritus({ suoritus: aloita(), tila: 'keskeytetty', syy: 'Tilanne ratkesi itsestään', nyt: T0 });
  assert.equal(tulos.ok, true);
});

test('päättynyttä ei avata uudelleen eikä siihen kuitata kohtia', () => {
  let s = aloita();
  s = paataSuoritus({ suoritus: s, tila: 'keskeytetty', syy: 'Väärä hälytys', nyt: T0 }).suoritus;
  assert.equal(paataSuoritus({ suoritus: s, tila: 'valmis', nyt: T0 }).ok, false);
  assert.equal(kuittaaKohta({ suoritus: s, kohtaId: 'k1' }).ok, false);
});

test('jonosta tuleva toistopäättäminen ei ole virhe', () => {
  let s = aloita();
  s = paataSuoritus({ suoritus: s, tila: 'keskeytetty', syy: 'Väärä hälytys', nyt: T0 }).suoritus;
  const toisto = paataSuoritus({ suoritus: s, tila: 'keskeytetty', syy: 'Väärä hälytys', toisto: true });
  assert.equal(toisto.ok, true);
  assert.equal(toisto.duplikaatti, true);
});

test('tuntematon tila torjutaan', () => {
  assert.equal(paataSuoritus({ suoritus: aloita(), tila: 'melkein' }).ok, false);
});

// --- Kooste -----------------------------------------------------------------------

test('kooste kertoo edistymisen', () => {
  let s = aloita();
  assert.deepEqual(kooste(s), { kohtia: 3, kuitattu: 0, kriittisiaKuittaamatta: 2, valmisAste: 0 });
  s = kuittaaKohta({ suoritus: s, kohtaId: 'k1', tekija: 'a', nyt: T0 }).suoritus;
  assert.equal(kooste(s).kuitattu, 1);
  assert.equal(kooste(s).valmisAste, 33);
});
