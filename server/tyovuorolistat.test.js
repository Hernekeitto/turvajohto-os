// Työvuorolistan sijoitusten testit (erä 4).
//
// Painopiste: este hylkää aina, poikkeama vaatii syyn ja syy tallentuu, ja poisto
// onnistuu myös vuorolle jota ei enää ole (orpo sijoitus).
//
// Ajetaan: node --test server/tyovuorolistat.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  julkaise, kaikkiSijoitukset, kuittaaMuutokset, kuittaamattomat, onHalytystyo, sijoita, tarkistaLista, tyhjaLista,
} from './tyovuorolistat.js';
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

// --- Erä 5: poissaolot, toiveet ja reservin kuittaus ---

test('poissaolon ajalle ei voi sijoittaa', () => {
  const t = tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'virtanen', {
    poissaolot: [{ username: 'virtanen', laji: 'vuosiloma', alku: '2026-10-05', loppu: '2026-10-11', tunnit: 40.2 }],
  });
  assert.equal(t.koodi, 'este');
  assert.equal(t.havainnot[0].koodi, 'poissa');
});

test('toisen henkilön poissaolo ei vaikuta', () => {
  const t = tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'virtanen', {
    poissaolot: [{ username: 'joku', laji: 'vuosiloma', alku: '2026-10-05', loppu: '2026-10-11', tunnit: 0 }],
  });
  assert.equal(t.ok, true);
});

test('toive ei estä sijoitusta mutta näkyy havaintona', () => {
  const t = tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'virtanen', {
    toiveet: [{ username: 'virtanen', pvm: '2026-10-05', laji: 'vapaa' }],
  });
  assert.equal(t.ok, true);
  assert.equal(t.havainnot[0].koodi, 'toive');
});

test('reservin kuittaus: avoin vuoro onnistuu ja merkitään kuittaukseksi', () => {
  const t = tee(tyhjaLista(LISTA), id('aamu', '2026-10-06'), 'reservi', { reservinKuittaus: true, nytPaikallinen: '2026-10-05T12:00' });
  assert.equal(t.ok, true);
  assert.equal(t.tietue.sijoitukset[0].kuittaus, true);
});

test('reservin kuittaus: varattu, alkanut, ei-reservi ja poikkeama hylätään', () => {
  const varattu = tee(tyhjaLista(LISTA), id('aamu', '2026-10-06'), 'virtanen').tietue;
  const k = { reservinKuittaus: true, nytPaikallinen: '2026-10-05T12:00' };
  assert.equal(tee(varattu, id('aamu', '2026-10-06'), 'reservi', k).koodi, 'varattu');
  assert.equal(tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'reservi', k).koodi, 'alkanut');
  assert.equal(tee(tyhjaLista(LISTA), id('aamu', '2026-10-06'), 'virtanen', k).koodi, 'reservi');
  // Reservi on perehdytetty vain aamuun. Ilta 5.10. + aamu 6.10. = 8 h lepo → poikkeama.
  const kohde = { ...KOHDE, perehdytykset: [{ username: 'reservi', vuorotyyppiIdt: ['aamu', 'ilta'] }] };
  const eka = tee(tyhjaLista(LISTA), id('ilta', '2026-10-05'), 'reservi', { ...k, nytPaikallinen: '2026-10-05T10:00', kohteet: [kohde] });
  assert.equal(eka.ok, true);
  const toka = tee(eka.tietue, id('aamu', '2026-10-06'), 'reservi', { ...k, kohteet: [kohde], syy: 'yritys' });
  assert.equal(toka.koodi, 'poikkeama');
});

// --- Erä 6: julkaisu, muutokset ja syiden siivous ---

const julkaistu = (tietue) => julkaise({
  tietue, lista: LISTA, tulokset: {}, listanVuorot: LISTAN_VUOROT, tekija: 'suunnittelija', tanaan: '2026-09-20', nyt: NYT,
}).tietue;

test('julkaisu: merkintä, avoimet ja myöhästyminen', () => {
  const t1 = tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'virtanen').tietue;
  const j = julkaise({ tietue: t1, lista: LISTA, tulokset: {}, listanVuorot: LISTAN_VUOROT, tekija: 's', tanaan: '2026-09-22', nyt: NYT });
  assert.equal(j.ok, true);
  assert.equal(j.tietue.julkaistu.myohassa, true); // määräaika 21.9.
  assert.equal(j.tietue.julkaistu.avoimia, LISTAN_VUOROT.size - 1);
  assert.equal(julkaise({ tietue: j.tietue, lista: LISTA, tulokset: {}, listanVuorot: LISTAN_VUOROT, tekija: 's', tanaan: '2026-09-22' }).koodi, 'julkaistu');
});

test('julkaisu: este estää', () => {
  const tulokset = { virtanen: { havainnot: [{ taso: 'este', koodi: 'poissa', viesti: 'Loma', vuoroIdt: [id('aamu', '2026-10-05')] }] } };
  const j = julkaise({ tietue: tyhjaLista(LISTA), lista: LISTA, tulokset, listanVuorot: LISTAN_VUOROT, tekija: 's', tanaan: '2026-09-20' });
  assert.equal(j.koodi, 'esteita');
  assert.equal(j.esteet[0].username, 'virtanen');
});

test('julkaistun listan muutos vaatii syyn ja kirjautuu', () => {
  const j = julkaistu(tyhjaLista(LISTA));
  const ilman = tee(j, id('aamu', '2026-10-07'), 'virtanen', { nytPaikallinen: '2026-10-01T10:00' });
  assert.equal(ilman.koodi, 'muutossyy_puuttuu');
  const kanssa = tee(j, id('aamu', '2026-10-07'), 'virtanen', { nytPaikallinen: '2026-10-01T10:00', muutossyy: 'Lisävuoro' });
  assert.equal(kanssa.ok, true);
  const m = kanssa.tietue.muutokset[0];
  assert.deepEqual([m.oli, m.nyt, m.syy, m.halytystyo], [null, 'virtanen', 'Lisävuoro', undefined]);
});

test('alle 72 h varoitusajalla tehty sijoitus merkitään hälytystyöksi', () => {
  assert.equal(onHalytystyo('2026-10-07T06:00', '2026-10-04T06:01'), true);
  assert.equal(onHalytystyo('2026-10-07T06:00', '2026-10-04T06:00'), false);
  const j = julkaistu(tyhjaLista(LISTA));
  const t = tee(j, id('aamu', '2026-10-07'), 'virtanen', { nytPaikallinen: '2026-10-05T12:00', muutossyy: 'Sairastuminen' });
  assert.equal(t.tietue.muutokset[0].halytystyo, true);
  // Poisto ei ole hälytystyötä: kenellekään ei tule uutta vuoroa.
  const poisto = tee(t.tietue, id('aamu', '2026-10-07'), null, { nytPaikallinen: '2026-10-05T12:00', muutossyy: 'Peruttu' });
  assert.equal(poisto.tietue.muutokset[1].halytystyo, undefined);
});

test('muutosten kuittaus koskee vain omia ja vain kuittaamattomia', () => {
  const j = julkaistu(tyhjaLista(LISTA));
  const t = tee(j, id('aamu', '2026-10-07'), 'virtanen', { nytPaikallinen: '2026-10-01T10:00', muutossyy: 'Lisävuoro' }).tietue;
  assert.equal(kuittaamattomat(t, 'virtanen').length, 1);
  assert.equal(kuittaamattomat(t, 'joku').length, 0);
  const k = kuittaaMuutokset(t, 'virtanen', new Date('2026-10-01T11:00:00Z'));
  assert.equal(kuittaamattomat(k, 'virtanen').length, 0);
});

test('sama henkilö samaan vuoroon ei ole muutos', () => {
  const t1 = tee(tyhjaLista(LISTA), id('aamu', '2026-10-05'), 'virtanen').tietue;
  const j = julkaistu(t1);
  const t2 = tee(j, id('aamu', '2026-10-05'), 'virtanen');
  assert.equal(t2.tietue, j);
});

test('vanhentunut syy poistuu kun poikkeaman aiheuttanut vuoro poistetaan', () => {
  const t1 = tee(tyhjaLista(LISTA), id('ilta', '2026-10-05'), 'virtanen').tietue;
  const t2 = tee(t1, id('aamu', '2026-10-06'), 'virtanen', { syy: 'Sovittu' }).tietue;
  assert.equal(t2.sijoitukset.find((s) => s.vuoroId === id('aamu', '2026-10-06')).syy, 'Sovittu');
  const t3 = tee(t2, id('ilta', '2026-10-05'), null).tietue;
  const jaljella = t3.sijoitukset.find((s) => s.vuoroId === id('aamu', '2026-10-06'));
  assert.equal(jaljella.syy, undefined);
  assert.equal(jaljella.poikkeamat, undefined);
});
