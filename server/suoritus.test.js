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
  onPaattynyt, kooste, aktiivisetKohdat, valitsePolku, lisaaKommentti,
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

// --- Haarautuva skenaario ja tilanneloki (28.9.2026) -------------------------------

const PALO = {
  id: 'palo',
  kind: 'play',
  nimi: 'Palohälytys',
  versio: 1,
  kohdat: [
    { id: 'a', teksti: 'Mene paloilmoitinkeskukselle', jarjestys: 0, kriittinen: true },
    {
      id: 'v', teksti: 'Onko kohteessa tulipalo?', jarjestys: 1, kriittinen: true, tyyppi: 'valinta',
      vaihtoehdot: [{ id: 'on', teksti: 'On tulipalo' }, { id: 'ei', teksti: 'Ei tulipaloa' }],
    },
    { id: 'on1', teksti: 'Evakuoi', jarjestys: 2, kriittinen: true, haara: 'on' },
    { id: 'ei1', teksti: 'Selvitä aiheuttaja', jarjestys: 3, kriittinen: true, haara: 'ei' },
    { id: 'loppu', teksti: 'Raportoi HÄLKEen', jarjestys: 4, kriittinen: false },
  ],
};

const aloitaPalo = () => aloitaSuoritus({ pohja: PALO, ownerId: 'k1', tekija: 'v1', id: 'p', nyt: T0 }).suoritus;

test('valitsematon polku ei ole aktiivinen eikä vaadi kuittausta', () => {
  let s = aloitaPalo();
  assert.deepEqual(aktiivisetKohdat(s.kohdat).map((k) => k.kohtaId), ['a', 'v', 'loppu']);
  assert.equal(kuittaaKohta({ suoritus: s, kohtaId: 'on1', tekija: 'v1' }).ok, false);
  assert.equal(kuittaaKohta({ suoritus: s, kohtaId: 'v', tekija: 'v1' }).ok, false);

  s = valitsePolku({ suoritus: s, kohtaId: 'v', vaihtoehtoId: 'ei', tekija: 'v1', nyt: T0 }).suoritus;
  assert.deepEqual(aktiivisetKohdat(s.kohdat).map((k) => k.kohtaId), ['a', 'v', 'ei1', 'loppu']);
  s = kuittaaKohta({ suoritus: s, kohtaId: 'a', tekija: 'v1', nyt: T0 }).suoritus;
  s = kuittaaKohta({ suoritus: s, kohtaId: 'ei1', tekija: 'v1', nyt: T0 }).suoritus;
  // "Evakuoi" on kriittinen mutta toisella polulla: ei estä sulkemista.
  assert.equal(kriittisetKuittaamatta(s).length, 0);
  assert.equal(paataSuoritus({ suoritus: s, tila: 'valmis', nyt: T0 }).ok, true);
});

test('valitsematta jätetty kriittinen valinta estää sulkemisen', () => {
  let s = aloitaPalo();
  s = kuittaaKohta({ suoritus: s, kohtaId: 'a', tekija: 'v1', nyt: T0 }).suoritus;
  assert.equal(paataSuoritus({ suoritus: s, tila: 'valmis', nyt: T0 }).ok, false);
});

test('polun vaihto kirjataan lokiin eikä pyyhi vanhan polun kuittauksia', () => {
  let s = aloitaPalo();
  s = valitsePolku({ suoritus: s, kohtaId: 'v', vaihtoehtoId: 'ei', tekija: 'v1', nyt: T0 }).suoritus;
  s = kuittaaKohta({ suoritus: s, kohtaId: 'ei1', tekija: 'v1', nyt: T0 }).suoritus;
  const vaihto = valitsePolku({ suoritus: s, kohtaId: 'v', vaihtoehtoId: 'on', tekija: 'v2', nyt: T0 });
  assert.equal(vaihto.ok, true);
  s = vaihto.suoritus;
  assert.equal(s.kohdat.find((k) => k.kohtaId === 'ei1').kuittaaja, 'v1');
  assert.deepEqual(aktiivisetKohdat(s.kohdat).map((k) => k.kohtaId), ['a', 'v', 'on1', 'loppu']);
  assert.equal(s.kommentit.length, 2);
  assert.equal(s.kommentit[1].jarjestelma, true);
  assert.match(s.kommentit[1].teksti, /Ei tulipaloa.*On tulipalo/);
  // Sama valinta uudelleen on virhe, jonosta toistona ei.
  assert.equal(valitsePolku({ suoritus: s, kohtaId: 'v', vaihtoehtoId: 'on' }).ok, false);
  assert.equal(valitsePolku({ suoritus: s, kohtaId: 'v', vaihtoehtoId: 'on', toisto: true }).duplikaatti, true);
});

test('tilanneloki: merkintä lisätään, tyhjää ei hyväksytä, päättyneeseen ei kirjoiteta', () => {
  let s = aloitaPalo();
  assert.equal(lisaaKommentti({ suoritus: s, teksti: '   ', tekija: 'v1' }).ok, false);
  s = lisaaKommentti({ suoritus: s, teksti: 'Savua 2. kerroksessa', tekija: 'halke', nyt: T0 }).suoritus;
  assert.equal(s.kommentit[0].teksti, 'Savua 2. kerroksessa');
  assert.equal(s.kommentit[0].tekija, 'halke');
  s = paataSuoritus({ suoritus: s, tila: 'keskeytetty', syy: 'Palokunta otti johdon', nyt: T0 }).suoritus;
  assert.equal(lisaaKommentti({ suoritus: s, teksti: 'Myöhästynyt', tekija: 'v1' }).ok, false);
});

test('HÄLKE-seuranta kopioituu pohjasta, puuttuva tarkoittaa kyllä', () => {
  assert.equal(aloitaPalo().halke, true);
  const ilman = aloitaSuoritus({ pohja: { ...PALO, halke: false }, ownerId: 'k1', id: 'x', nyt: T0 }).suoritus;
  assert.equal(ilman.halke, false);
});
