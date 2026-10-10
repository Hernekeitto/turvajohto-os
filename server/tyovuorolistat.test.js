// Työvuorolistan sijoitusten testit (erä 4).
//
// Painopiste: este hylkää aina, poikkeama vaatii syyn ja syy tallentuu, ja poisto
// onnistuu myös vuorolle jota ei enää ole (orpo sijoitus).
//
// Ajetaan: node --test server/tyovuorolistat.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { kaikkiSijoitukset, sijoita, tarkistaLista, tyhjaLista } from './tyovuorolistat.js';
import { listat, normalisoiAsetukset, suunnitellutVuorot } from './tyovuorolista.js';

const ASETUKSET = normalisoiAsetukset({ jaksotAlkaen: '2026-10-05' });
const LISTA = listat(ASETUKSET, '2026-10-05', 1)[0];
const KOHDE = {
  id: 'k1', name: 'Kauppakeskus',
  perehdytykset: [{ username: 'virtanen', vuorotyyppiIdt: ['aamu', 'ilta'] }, { username: 'reservi', vuorotyyppiIdt: ['aamu'] }],
  vuorotyypit: [
    { id: 'aamu', nimi: 'Aamu', alkaa: '06:00', paattyy: '14:00', suunnittelu: { maarat: [1, 1, 1, 1, 1, 1, 1] } },
    { id: 'ilta', nimi: 'Ilta', alkaa: '14:00', paattyy: '22:00', suunnittelu: { maarat: [1, 1, 1, 1, 1, 1, 1] } },
    { id: 'yo', nimi: 'Yö', alkaa: '22:00', paattyy: '06:00', suunnittelu: { maarat: [1, 1, 1, 1, 1, 1, 1] } },
  ],
};
const HENKILOT = [
  { username: 'virtanen', workTimeType: 'monthly', hasGuardCard: true, guardCardValidUntil: '2028-12' },
  { username: 'reservi', workTimeType: 'oncall', hasGuardCard: true, guardCardValidUntil: '2028-12' },
];
const VUOROT = new Map(suunnitellutVuorot([KOHDE], '2026-09-07', LISTA.loppu).map((v) => [v.id, v]));
const LISTAN_VUOROT = new Map([...VUOROT].filter(([, v]) => v.pvm >= LISTA.alku));
const NYT = new Date('2026-10-01T10:00:00Z');

const tee = (tietue, vuoroId, username, yli = {}) => sijoita({
  tietue, lista: LISTA, vuoroId, username, vuorot: VUOROT, listanVuorot: LISTAN_VUOROT,
  henkilot: HENKILOT, kohteet: [KOHDE], asetukset: ASETUKSET, muutSijoitukset: [],
  tekija: 'suunnittelija', nyt: NYT, ...yli,
});

const id = (vt, pvm) => `k1:${vt}:${pvm}:1`;

test('sijoitus ja poisto', () => {
  const t1 = tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'virtanen');
  assert.equal(t1.ok, true);
  assert.equal(t1.tietue.sijoitukset.length, 1);
  assert.equal(t1.tietue.versio, 1);
  assert.equal(t1.tietue.sijoitukset[0].sijoitti, 'suunnittelija');
  assert.equal(t1.tietue.sijoitukset[0].syy, undefined);
  const t2 = tee(t1.tietue, id('aamu', '2026-10-05'), null);
  assert.equal(t2.tietue.sijoitukset.length, 0);
  assert.equal(t2.tietue.versio, 2);
});

test('sama vuoro voi olla vain yhdellä', () => {
  const t1 = tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'virtanen');
  const t2 = tee(t1.tietue, id('aamu', '2026-10-05'), 'virtanen');
  assert.equal(t2.tietue.sijoitukset.length, 1);
});

test('este hylkää: ei perehdytystä', () => {
  const t = tee(tyhjaLista(LISTA), id('yo', '2026-10-05'), 'virtanen');
  assert.equal(t.ok, false);
  assert.equal(t.koodi, 'este');
  assert.equal(t.havainnot[0].koodi, 'ei_perehdytysta');
});

test('poikkeama vaatii syyn ja syy tallentuu', () => {
  const t1 = tee(tyhjaLista(LISTA), id('ilta', '2026-10-05'), 'virtanen');
  const ilman = tee(t1.tietue, id('aamu', '2026-10-06'), 'virtanen'); // lepo 8 h
  assert.equal(ilman.ok, false);
  assert.equal(ilman.koodi, 'syy_puuttuu');
  assert.equal(ilman.havainnot[0].koodi, 'vuorokausilepo');
  const kanssa = tee(t1.tietue, id('aamu', '2026-10-06'), 'virtanen', { syy: 'Sovittu Virtasen kanssa' });
  assert.equal(kanssa.ok, true);
  const s = kanssa.tietue.sijoitukset.find((x) => x.vuoroId === id('aamu', '2026-10-06'));
  assert.equal(s.syy, 'Sovittu Virtasen kanssa');
  assert.deepEqual(s.poikkeamat, ['vuorokausilepo']);
});

test('syy ilman poikkeamaa jätetään pois', () => {
  const t = tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'virtanen', { syy: 'Turha syy' });
  assert.equal(t.tietue.sijoitukset[0].syy, undefined);
});

test('liian pitkä syy hylätään', () => {
  const t1 = tee(tyhjaLista(LISTA), id('ilta', '2026-10-05'), 'virtanen');
  const t = tee(t1.tietue, id('aamu', '2026-10-06'), 'virtanen', { syy: 'x'.repeat(501) });
  assert.equal(t.koodi, 'syy_kelvoton');
});

test('työvoimareserviä ei sijoiteta', () => {
  const t = tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'reservi');
  assert.equal(t.koodi, 'reservi');
});

test('tuntematon vuoro ja henkilö', () => {
  assert.equal(tee(tyhjaLista(LISTA), 'k1:aamu:2026-12-01:1', 'virtanen').koodi, 'tuntematon_vuoro');
  // Edellisen listan vuoro ei ole tämän listan vuoro.
  assert.equal(tee(tyhjaLista(LISTA), id('aamu', '2026-10-04'), 'virtanen').koodi, 'tuntematon_vuoro');
  assert.equal(tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'eiole').koodi, 'tuntematon_henkilo');
});

test('orvon sijoituksen poisto onnistuu', () => {
  const tietue = { ...tyhjaLista(LISTA), sijoitukset: [{ vuoroId: 'k1:poistettu:2026-10-05:1', username: 'virtanen' }] };
  const t = tee(tietue, 'k1:poistettu:2026-10-05:1', null);
  assert.equal(t.ok, true);
  assert.equal(t.tietue.sijoitukset.length, 0);
});

test('edellisen listan sijoitukset vaikuttavat listan alkuun', () => {
  const edellinen = [{ vuoroId: id('ilta', '2026-10-04'), username: 'virtanen' }];
  const t = tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'virtanen', { muutSijoitukset: edellinen });
  assert.equal(t.koodi, 'syy_puuttuu');
});

test('listan tarkistus kattaa kaikki henkilöt', () => {
  const t1 = tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'virtanen');
  const tulokset = tarkistaLista({
    lista: LISTA, sijoitukset: kaikkiSijoitukset([t1.tietue]), vuorot: VUOROT,
    henkilot: HENKILOT, kohteet: [KOHDE], asetukset: ASETUKSET,
  });
  assert.deepEqual(Object.keys(tulokset).sort(), ['reservi', 'virtanen']);
  assert.equal(tulokset.virtanen.jaksot[0].tunnit, 8);
});
