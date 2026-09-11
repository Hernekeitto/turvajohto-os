// Vuoron koosteen ja suoritusajan poikkeaman testit (erä 18b).
//
// Painopiste on liukumassa ja siinä ETTEI poikkeamaa synny silloin kun sitä ei kuulu
// syntyä: liukuman sisällä, pakotetusta tehtävästä, tai kun suoritusaikaa ei ole. Väärä
// keltainen merkintä on pahempi kuin puuttuva — se opettaa ohittamaan ne kaikki.
//
// Ajetaan: node --test server/kooste.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { LIUKUMA_MIN, onPoikkeama, poikkeamaMinuutteina, vuoronKooste } from './kooste.js';

// Paikallista aikaa: suoritusaika on kellonaika seinällä, ei UTC.
const klo = (t, m = 0) => new Date(2026, 8, 10, t, m, 0).toISOString();

// --- Poikkeaman laskenta ------------------------------------------------------------

test('poikkeama on minuutteja etumerkin kera', () => {
  assert.equal(poikkeamaMinuutteina('19:00', klo(19, 0)), 0);
  assert.equal(poikkeamaMinuutteina('19:00', klo(19, 12)), 12);
  assert.equal(poikkeamaMinuutteina('19:00', klo(18, 45)), -15, 'etuajassa on negatiivinen');
});

test('poikkeama lasketaan vuorokausiympyrällä', () => {
  // Yövuoron tehtävä klo 23:50 ja suoritus 00:05 ovat viisitoista minuuttia toisistaan,
  // eivät kaksikymmentäkolme tuntia.
  assert.equal(poikkeamaMinuutteina('23:50', klo(0, 5)), 15);
  assert.equal(poikkeamaMinuutteina('00:05', klo(23, 50)), -15);
});

test('ilman suoritusaikaa tai suoritusta ei ole poikkeamaa', () => {
  assert.equal(poikkeamaMinuutteina(null, klo(19)), null);
  assert.equal(poikkeamaMinuutteina('', klo(19)), null);
  assert.equal(poikkeamaMinuutteina('19:00', 'roskaa'), null);
  assert.equal(poikkeamaMinuutteina('19:00', null), null);
});

// --- Liukuma ------------------------------------------------------------------------

test('liukuma on viisi minuuttia molempiin suuntiin', () => {
  // Päätös 10.9.2026: klo 19 tarkoittaa 18:55–19:05.
  assert.equal(LIUKUMA_MIN, 5);
  for (const [t, m] of [[18, 55], [19, 0], [19, 5]]) {
    assert.equal(onPoikkeama({ suoritusaika: '19:00', tehtyIso: klo(t, m) }), false, `${t}:${m}`);
  }
  assert.equal(onPoikkeama({ suoritusaika: '19:00', tehtyIso: klo(18, 54) }), true);
  assert.equal(onPoikkeama({ suoritusaika: '19:00', tehtyIso: klo(19, 6) }), true);
});

test('pakotettu tehtävä ei koskaan poikkea', () => {
  // Yövuoron tehtävän suoritusaika ei voi olla oikein aamuvuorossa, joten sitä ei
  // käytetä. Poikkeama joka on rakenteeltaan väärä opettaisi ohittamaan ne kaikki.
  assert.equal(onPoikkeama({ suoritusaika: '23:00', tehtyIso: klo(8), lahde: 'pakotus' }), false);
  // Siirto sen sijaan käyttää aikaa: molemmat vartijat ovat vuorossa nyt, ja kohteen
  // sulkukierros on silti kymmeneltä.
  assert.equal(onPoikkeama({ suoritusaika: '23:00', tehtyIso: klo(8), lahde: 'siirto' }), true);
});

test('ilman suoritusaikaa ei tule merkintää vaikka aika olisi mikä', () => {
  assert.equal(onPoikkeama({ suoritusaika: null, tehtyIso: klo(3) }), false);
});

// --- Kooste -------------------------------------------------------------------------

const vuoro = (yli = {}) => ({
  id: 'v1',
  siteNimi: 'Kauppakeskus Hansa',
  vuorotyyppiNimi: 'Iltavuoro',
  vartija: 'vartija1',
  alkoi: klo(15),
  paattyi: klo(23),
  tila: 'paattynyt',
  pohjat: [{ id: 'p1', nimi: 'Sulkukierros', lahde: 'vuoro', suoritusaika: '19:00' }],
  tehtavat: [{ id: 't1', nimi: 'Avaimet', lahde: 'vuoro', suoritusaika: '16:00' }],
  ...yli,
});

const kierros = (yli = {}) => ({
  id: 'k1', templateId: 'p1', vartija: 'vartija1', alkoi: klo(19), paattyi: klo(19, 40),
  tila: 'valmis', ...yli,
});

const suoritus = (yli = {}) => ({
  id: 's1', tehtavaId: 't1', vartija: 'vartija1', aika: klo(16), suoritettu: true, ...yli,
});

test('kooste laskee tehdyt, tekemättömät ja poikkeamat', () => {
  const k = vuoronKooste({ vuoro: vuoro(), kierrokset: [kierros()], suoritukset: [suoritus()] });
  assert.equal(k.tehty, 2);
  assert.equal(k.tekematta, 0);
  assert.equal(k.poikkeamia, 0);
});

test('tekemätön näkyy tekemättömänä eikä katoa', () => {
  const k = vuoronKooste({ vuoro: vuoro(), kierrokset: [], suoritukset: [] });
  assert.equal(k.tehty, 0);
  assert.equal(k.tekematta, 2);
  assert.equal(k.pohjat[0].tila, 'tekematta');
});

test('kierroksen vertailuhetki on ALOITUS eikä päättyminen', () => {
  // "Sulkukierros klo 19" tarkoittaa että kierros aloitetaan seitsemältä. Neljäkymmentä
  // minuuttia kestänyt kierros ei ole myöhässä siksi että se päättyi 19:40.
  const k = vuoronKooste({
    vuoro: vuoro(),
    kierrokset: [kierros({ alkoi: klo(19, 2), paattyi: klo(19, 55) })],
    suoritukset: [suoritus()],
  });
  assert.equal(k.pohjat[0].poikkeama, false);
  assert.equal(k.pohjat[0].poikkeamaMin, 2);
});

test('myöhässä tehty saa merkinnän ja minuutit', () => {
  const k = vuoronKooste({
    vuoro: vuoro(), kierrokset: [kierros({ alkoi: klo(21, 30) })], suoritukset: [suoritus()],
  });
  assert.equal(k.pohjat[0].poikkeama, true);
  assert.equal(k.pohjat[0].poikkeamaMin, 150);
  assert.equal(k.poikkeamia, 1);
});

test('kesken oleva kierros ei ole tehty eikä tekemätön', () => {
  // Niputtaminen kumpaankaan antaisi väärän luvun juuri siitä mitä luku väittää
  // mittaavansa.
  const k = vuoronKooste({
    vuoro: vuoro(), kierrokset: [kierros({ tila: 'kesken', paattyi: null })], suoritukset: [],
  });
  assert.equal(k.kesken, 1);
  assert.equal(k.tehty, 0);
  assert.equal(k.tekematta, 1, 'vain tehtävä on tekemättä');
});

test('keskeytetty kierros erotellaan valmiista', () => {
  const k = vuoronKooste({
    vuoro: vuoro(), kierrokset: [kierros({ tila: 'keskeytetty' })], suoritukset: [],
  });
  assert.equal(k.keskeytetty, 1);
  assert.equal(k.tehty, 0);
  assert.equal(k.pohjat[0].tila, 'keskeytetty');
});

test('vuoron ulkopuolinen suoritus ei kelpaa koosteeseen', () => {
  // Eilinen kuittaus ei kerro tästä vuorosta mitään.
  const eilen = new Date(2026, 8, 9, 19, 0, 0).toISOString();
  const k = vuoronKooste({
    vuoro: vuoro(), kierrokset: [kierros({ alkoi: eilen })], suoritukset: [],
  });
  assert.equal(k.pohjat[0].tila, 'tekematta');
});

test('toisen vartijan suoritus ei kelpaa koosteeseen', () => {
  const k = vuoronKooste({
    vuoro: vuoro(), kierrokset: [kierros({ vartija: 'joku-muu' })], suoritukset: [],
  });
  assert.equal(k.pohjat[0].tila, 'tekematta');
});

test('kertalupa näkyy koosteessa', () => {
  // Vuoro joka ajettiin ilman perehdytystä on juuri se jota jälkikäteen katsotaan.
  const poikkeus = { myontaja: 'paivystaja', syy: 'Sairastapaus', este: 'ei_perehdytysta', aika: klo(15) };
  const k = vuoronKooste({ vuoro: vuoro({ perehdytysPoikkeus: poikkeus }) });
  assert.equal(k.perehdytysPoikkeus.myontaja, 'paivystaja');
});

test('kesken oleva vuoro saa koosteen ilman päättymisaikaa', () => {
  const k = vuoronKooste({
    vuoro: vuoro({ paattyi: null, tila: 'kesken' }),
    kierrokset: [kierros()],
    suoritukset: [],
  });
  assert.equal(k.paattyi, null);
  assert.equal(k.tehty, 1);
});
