// Yksikön tilan testit.
//
// Painopiste on niissä virheissä joita valvomon ruudulta EI huomaa: vapaalta näyttävä
// yksikkö joka on jo tehtävällä (hänelle lähetetään toinen keikka), kartalle jäävä
// punainen merkki tehtävästä josta vartija on jo poistunut, ja kierroksen voittava
// tehtävä väärinpäin (irrotettava yksikkö näyttää kiinni olevalta).
//
// Ajetaan: node --test src/guard/yksikontila.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { onIrrotettavissa, yksikonTila, type Lahteet } from './yksikontila.ts';
import type { Halytystehtava, Yksikko } from './halytystehtavat.ts';
import type { Kierros } from './tyypit.ts';

const yksikko = (osat: Partial<Yksikko>): Yksikko => ({
  vartija: 'matti',
  nimi: 'Piiri 301',
  vuoroId: 'v1',
  vastaanotti: '2026-09-15T12:00:00.000Z',
  ajoon: null,
  paikalla: null,
  kieltaytyi: null,
  ...osat,
});

const tehtava = (osat: Partial<Halytystehtava>): Halytystehtava => ({
  id: 't1',
  laji: 'murto',
  siteId: 'kohde1',
  siteNimi: 'Kauppakeskus',
  silmukka: '3',
  tila: 'kaynnissa',
  luotu: '2026-09-15T11:55:00.000Z',
  luoja: 'paivystaja',
  havainnot: [],
  yksikot: [],
  raportit: [],
  hyvaksynta: null,
  paattyi: null,
  loki: [],
  ...osat,
});

const kierros = (osat: Partial<Kierros>): Kierros => ({
  id: 'k1',
  siteId: 'kohde1',
  templateId: 'p1',
  templateNimi: 'Yökierros',
  templateVersio: 1,
  vartija: 'matti',
  alkoi: '2026-09-15T11:00:00.000Z',
  paattyi: null,
  tila: 'kesken',
  pisteet: [],
  ...osat,
});

const lahteet = (osat: Partial<Lahteet> = {}): Lahteet => ({
  tehtavat: [], kierrokset: [], ...osat,
});

test('ilman tehtäviä ja kierroksia yksikkö on vapaa', () => {
  assert.equal(yksikonTila('matti', lahteet()).tila, 'vapaa');
});

test('tyhjä käyttäjätunnus ei ole vapaa vaan tuntematon', () => {
  // Vapaaksi merkitseminen tarkoittaisi että tälle "yksikölle" voi lähettää keikan.
  assert.equal(yksikonTila('', lahteet()).tila, 'ei_tietoa');
});

test('vastaanotettu mutta kuittaamaton tehtävä tekee yksiköstä matkalla olevan', () => {
  // Tämä on se tapaus jossa vartija ei ole painanut "ajoon" — palvelimen mukaan vaiheet
  // ovat ohjeellisia. Vapaa olisi väärin: hänelle lähetettäisiin toinen tehtävä.
  const tulos = yksikonTila('matti', lahteet({
    tehtavat: [tehtava({ yksikot: [yksikko({})] })],
  }));
  assert.equal(tulos.tila, 'matkalla');
  assert.equal(tulos.tehtavaId, 't1');
});

test('ajoon-merkintä on sama tila kuin pelkkä vastaanotto', () => {
  const tulos = yksikonTila('matti', lahteet({
    tehtavat: [tehtava({ yksikot: [yksikko({ ajoon: '2026-09-15T12:01:00.000Z' })] })],
  }));
  assert.equal(tulos.tila, 'matkalla');
});

test('paikalla-merkintä nostaa tehtävälle', () => {
  const tulos = yksikonTila('matti', lahteet({
    tehtavat: [tehtava({ yksikot: [yksikko({ paikalla: '2026-09-15T12:10:00.000Z' })] })],
  }));
  assert.equal(tulos.tila, 'tehtavalla');
  assert.equal(tulos.tehtavaId, 't1');
});

test('paikalla voittaa vaikka toinen tehtävä olisi listassa ensin', () => {
  // Kahdesta samanaikaisesta tehtävästä ratkaisee se jolla yksikkö seisoo, ei se joka
  // sattuu olemaan listan alussa.
  const tulos = yksikonTila('matti', lahteet({
    tehtavat: [
      tehtava({ id: 'matkalla-tehtava', yksikot: [yksikko({})] }),
      tehtava({ id: 'paikalla-tehtava', yksikot: [yksikko({ paikalla: '2026-09-15T12:10:00.000Z' })] }),
    ],
  }));
  assert.equal(tulos.tila, 'tehtavalla');
  assert.equal(tulos.tehtavaId, 'paikalla-tehtava');
});

test('suljettu tehtävä ei pidä yksikköä varattuna', () => {
  const tulos = yksikonTila('matti', lahteet({
    tehtavat: [tehtava({ tila: 'suljettu', yksikot: [yksikko({ paikalla: '2026-09-15T12:10:00.000Z' })] })],
  }));
  assert.equal(tulos.tila, 'vapaa');
});

test('odottaa-tila pitää yksikön yhä tehtävällä', () => {
  // Poistumispyyntö on lähetetty muttei hyväksytty: vartija seisoo yhä kohteessa.
  const tulos = yksikonTila('matti', lahteet({
    tehtavat: [tehtava({ tila: 'odottaa', yksikot: [yksikko({ paikalla: '2026-09-15T12:10:00.000Z' })] })],
  }));
  assert.equal(tulos.tila, 'tehtavalla');
});

test('poistunut yksikkö ei jää tehtävälle vaikka paikalla-aikaleima säilyy', () => {
  const tulos = yksikonTila('matti', lahteet({
    tehtavat: [tehtava({
      yksikot: [yksikko({ paikalla: '2026-09-15T12:10:00.000Z', poistui: '2026-09-15T12:40:00.000Z' })],
    })],
  }));
  assert.equal(tulos.tila, 'vapaa');
});

test('kieltäytynyt yksikkö ei ole tehtävällä', () => {
  const tulos = yksikonTila('matti', lahteet({
    tehtavat: [tehtava({
      yksikot: [yksikko({ vastaanotti: null, kieltaytyi: '2026-09-15T12:01:00.000Z' })],
    })],
  }));
  assert.equal(tulos.tila, 'vapaa');
});

test('toisen vartijan tehtävä ei värjää tätä yksikköä', () => {
  const tulos = yksikonTila('matti', lahteet({
    tehtavat: [tehtava({ yksikot: [yksikko({ vartija: 'liisa', paikalla: '2026-09-15T12:10:00.000Z' })] })],
  }));
  assert.equal(tulos.tila, 'vapaa');
});

test('kesken oleva kierros näkyy kierroksena', () => {
  const tulos = yksikonTila('matti', lahteet({ kierrokset: [kierros({})] }));
  assert.equal(tulos.tila, 'kierroksella');
  assert.equal(tulos.kierrosId, 'k1');
});

test('päättynyt kierros ei värjää yksikköä', () => {
  const tulos = yksikonTila('matti', lahteet({ kierrokset: [kierros({ tila: 'valmis' })] }));
  assert.equal(tulos.tila, 'vapaa');
});

test('tehtävä voittaa kesken olevan kierroksen', () => {
  // Kierrokselta irrotettu vartija on kartalla tehtävällä. Kierros jää kesken, mutta se
  // ei ole se mitä hän tekee juuri nyt.
  const tulos = yksikonTila('matti', lahteet({
    tehtavat: [tehtava({ yksikot: [yksikko({ paikalla: '2026-09-15T12:10:00.000Z' })] })],
    kierrokset: [kierros({})],
  }));
  assert.equal(tulos.tila, 'tehtavalla');
  assert.equal(tulos.kierrosId, null);
});

test('irrotettavissa ovat vapaa ja kierroksella, eivät muut', () => {
  assert.equal(onIrrotettavissa('vapaa'), true);
  assert.equal(onIrrotettavissa('kierroksella'), true);
  assert.equal(onIrrotettavissa('matkalla'), false);
  assert.equal(onIrrotettavissa('tehtavalla'), false);
  // Tuntematon ei ole irrotettavissa: puuttuva tieto ei ole lupa.
  assert.equal(onIrrotettavissa('ei_tietoa'), false);
});
