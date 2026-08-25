import test from 'node:test';
import assert from 'node:assert/strict';
import {
  luoToken,
  tokenTasmaa,
  ratkaiseVoimassaolo,
  jaonTila,
  hashaaSalasana,
  salasanaTasmaa,
  kuuluuJakoon,
  julkinenJako,
  MAX_VOIMASSAOLO_VRK,
  HENKILOTIETO_MAX_VRK,
} from './shares.js';

const VRK = 24 * 60 * 60 * 1000;
const NYT = new Date('2026-08-25T12:00:00.000Z');
const vrkPaasta = (n) => new Date(NYT.getTime() + n * VRK).toISOString();

test('token on 256-bittinen ja aina eri', () => {
  const a = luoToken();
  const b = luoToken();
  assert.notEqual(a, b);
  // base64url: 32 tavua -> 43 merkkiä ilman täytettä
  assert.equal(a.length, 43);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
});

test('tokenTasmaa vertaa oikein eikä kaadu eri pituuksiin', () => {
  const t = luoToken();
  assert.equal(tokenTasmaa(t, t), true);
  assert.equal(tokenTasmaa(t, luoToken()), false);
  assert.equal(tokenTasmaa('lyhyt', t), false);
  assert.equal(tokenTasmaa(null, t), false);
  assert.equal(tokenTasmaa(t, undefined), false);
});

test('määräaika hyväksytään rajojen sisällä', () => {
  const r = ratkaiseVoimassaolo({ expiresAt: vrkPaasta(7), henkilotietoa: false, onAdmin: false }, NYT);
  assert.equal(r.error, undefined);
  assert.equal(r.approvalStatus, 'none');
  assert.equal(r.expiresAt, vrkPaasta(7));
});

test(`yli ${MAX_VOIMASSAOLO_VRK} vrk torjutaan`, () => {
  const r = ratkaiseVoimassaolo({ expiresAt: vrkPaasta(66), henkilotietoa: false, onAdmin: false }, NYT);
  assert.match(r.error, /enintään 65 vrk/);
});

test('menneisyys ja roska torjutaan', () => {
  assert.match(ratkaiseVoimassaolo({ expiresAt: vrkPaasta(-1) }, NYT).error, /tulevaisuudessa/);
  assert.match(ratkaiseVoimassaolo({ expiresAt: 'roskaa' }, NYT).error, /Virheellinen/);
  assert.match(ratkaiseVoimassaolo({}, NYT).error, /vaaditaan/);
});

test(`henkilötietoa sisältävä rajataan ${HENKILOTIETO_MAX_VRK} vrk:een`, () => {
  const ok = ratkaiseVoimassaolo({ expiresAt: vrkPaasta(7), henkilotietoa: true }, NYT);
  assert.equal(ok.error, undefined);
  const liikaa = ratkaiseVoimassaolo({ expiresAt: vrkPaasta(8), henkilotietoa: true }, NYT);
  assert.match(liikaa.error, /enintään 7 vrk/);
});

test('pysyvä linkki: ei-admin saa määräaikaisen ja pyyntö menee hyväksyttäväksi', () => {
  const r = ratkaiseVoimassaolo({ ikuinen: true, henkilotietoa: false, onAdmin: false }, NYT);
  assert.equal(r.approvalStatus, 'pending');
  // Toimii odotuksen ajan, ei ikuisesti — unohtunut pyyntö ei jätä linkkiä auki.
  assert.equal(r.expiresAt, vrkPaasta(7));
});

test('pysyvä linkki: admin saa sen suoraan', () => {
  const r = ratkaiseVoimassaolo({ ikuinen: true, henkilotietoa: false, onAdmin: true }, NYT);
  assert.equal(r.approvalStatus, 'approved');
  assert.equal(r.expiresAt, null);
});

test('pysyvää linkkiä ei anneta henkilötiedolle edes adminille', () => {
  const r = ratkaiseVoimassaolo({ ikuinen: true, henkilotietoa: true, onAdmin: true }, NYT);
  assert.match(r.error, /ei voi luoda pysyvää linkkiä/);
});

test('jaonTila tunnistaa kaikki estot', () => {
  assert.equal(jaonTila(null).syy, 'not_found');
  assert.equal(jaonTila({ revokedAt: NYT.toISOString() }, NYT).syy, 'revoked');
  assert.equal(jaonTila({ approvalStatus: 'rejected' }, NYT).syy, 'rejected');
  assert.equal(jaonTila({ expiresAt: vrkPaasta(-1) }, NYT).syy, 'expired');
  assert.equal(jaonTila({ maxDownloads: 3, downloadCount: 3 }, NYT).syy, 'limit_reached');
  assert.equal(jaonTila({ expiresAt: vrkPaasta(1) }, NYT).ok, true);
  // Pysyvä hyväksytty linkki kelpaa
  assert.equal(jaonTila({ expiresAt: null, approvalStatus: 'approved' }, NYT).ok, true);
  // Latausraja 0 tai puuttuva = ei rajaa
  assert.equal(jaonTila({ maxDownloads: 0, downloadCount: 99 }, NYT).ok, true);
});

test('salasana: hash ei ole selväkielinen ja vertailu toimii', () => {
  const hash = hashaaSalasana('Salainen123');
  assert.notEqual(hash, 'Salainen123');
  assert.equal(salasanaTasmaa('Salainen123', hash), true);
  assert.equal(salasanaTasmaa('vaara', hash), false);
  assert.equal(salasanaTasmaa('', hash), false);
  // Ei salasanasuojausta -> mikä tahansa kelpaa
  assert.equal(salasanaTasmaa(undefined, null), true);
});

test('kansiojako kattaa koko alipuun', () => {
  const tiedostot = [
    { id: 'kansio1', type: 'folder', parentId: null },
    { id: 'kansio2', type: 'folder', parentId: 'kansio1' },
    { id: 'tiedosto1', type: 'file', parentId: 'kansio2' },
    { id: 'muu', type: 'file', parentId: null },
  ];
  assert.equal(kuuluuJakoon('kansio1', 'kansio1', tiedostot), true);
  assert.equal(kuuluuJakoon('kansio1', 'kansio2', tiedostot), true);
  assert.equal(kuuluuJakoon('kansio1', 'tiedosto1', tiedostot), true, 'kahden tason syvyys');
  assert.equal(kuuluuJakoon('kansio1', 'muu', tiedostot), false);
  assert.equal(kuuluuJakoon('kansio2', 'tiedosto1', tiedostot), true);
  assert.equal(kuuluuJakoon('kansio2', 'kansio1', tiedostot), false, 'ei ylöspäin');
});

test('kansiojako ei jää jumiin rikkinäiseen parentId-ketjuun', () => {
  const silmukka = [
    { id: 'a', parentId: 'b' },
    { id: 'b', parentId: 'a' },
  ];
  assert.equal(kuuluuJakoon('x', 'a', silmukka), false);
});

test('julkinenJako ei vuoda tokenia eikä salasanatiivistettä', () => {
  const j = julkinenJako({ id: '1', token: 'salainen', passwordHash: '$2a$12$xxx', mode: 'password' });
  assert.equal(j.token, undefined);
  assert.equal(j.passwordHash, undefined);
  assert.equal(j.hasPassword, true);
  assert.equal(j.mode, 'password');
  assert.equal(julkinenJako({ id: '2' }).hasPassword, false);
});
