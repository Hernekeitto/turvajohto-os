// Työvuorosuunnittelun sääntöjen testit (erä 1: asetukset ja jaksot).
//
// Painopiste on kahdessa asiassa. Ensin se, ettei TES:stä poikkeava sääntö synny ilman
// kirjausta paikallisesta sopimuksesta. Sitten jaksojen rajat: kesäaika, ankkuria
// edeltävät jaksot ja kuuden viikon listan kohdistus.
//
// Ajetaan: node --test server/tyovuorolista.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OLETUKSET, SAANNOLLINEN_H, JAKSON_ENIMMAIS_H,
  jaksoPaivalle, listat, normalisoiAsetukset, onMaanantai, paivaksi, tamaPaiva, tarkistaAsetukset,
  tesPoikkeamat,
} from './tyovuorolista.js';

// 5.10.2026 on maanantai.
const MAANANTAI = '2026-10-05';

test('oletukset ovat TES:n arvot', () => {
  assert.equal(OLETUKSET.listanPituusVk, 3);
  assert.equal(OLETUKSET.julkaisuVkEnnen, 2);
  assert.equal(OLETUKSET.vuoronMinH, 5);
  assert.equal(OLETUKSET.vuoronMaxH, 12);
  assert.equal(OLETUKSET.poikkeavanMaxH, 16);
  assert.equal(OLETUKSET.yorajoitus, true);
  assert.equal(OLETUKSET.vuorokausilepoH, 10);
  assert.equal(OLETUKSET.viikkovapaaH, 30);
  assert.equal(OLETUKSET.viikkovapaaMinH, 24);
  assert.equal(OLETUKSET.vuorojaVapaidenValissa, 9);
  assert.equal(OLETUKSET.pitkaViikonloppuVk, 4);
  assert.equal(SAANNOLLINEN_H, 120);
  assert.equal(JAKSON_ENIMMAIS_H, 128);
});

test('korttivaroitus on 45 päivää eikä se ole TES-poikkeama', () => {
  assert.equal(OLETUKSET.korttiVaroitusPv, 45);
  assert.deepEqual(tesPoikkeamat({ ...OLETUKSET, korttiVaroitusPv: 90 }), []);
});

test('oletuksilla ei ole TES-poikkeamia', () => {
  assert.deepEqual(tesPoikkeamat(OLETUKSET), []);
});

test('kuuden viikon lista ei ole TES-poikkeama', () => {
  assert.deepEqual(tesPoikkeamat({ ...OLETUKSET, listanPituusVk: 6 }), []);
});

test('päivämäärät: kelvoton päivä on null', () => {
  assert.equal(paivaksi('2026-02-31'), null);
  assert.equal(paivaksi('2026-2-3'), null);
  assert.equal(paivaksi(''), null);
  assert.equal(paivaksi(null), null);
  assert.ok(paivaksi('2028-02-29') !== null);
});

test('maanantain tunnistus', () => {
  assert.equal(onMaanantai(MAANANTAI), true);
  assert.equal(onMaanantai('2026-10-04'), false);
  assert.equal(onMaanantai('ei päivä'), false);
});

test('tämä päivä on paikallinen eikä UTC', () => {
  // Klo 01 paikallista aikaa: UTC:ssä on vielä edellinen päivä.
  assert.equal(tamaPaiva(new Date(2026, 9, 10, 1, 0)), '2026-10-10');
});

test('normalisointi: puuttuvat ja kelvottomat arvot korvataan oletuksilla', () => {
  const a = normalisoiAsetukset({ vuorokausilepoH: 'kymmenen', viikkovapaaH: 500, listanPituusVk: 4 });
  assert.equal(a.vuorokausilepoH, 10);
  assert.equal(a.viikkovapaaH, 30);
  assert.equal(a.listanPituusVk, 3);
  assert.equal(a.jaksotAlkaen, null);
  assert.equal(a.paikallinenSopimus, '');
});

test('normalisointi: jaksojen alku ei saa oletusta eikä tiistai kelpaa', () => {
  assert.equal(normalisoiAsetukset({}).jaksotAlkaen, null);
  assert.equal(normalisoiAsetukset({ jaksotAlkaen: '2026-10-06' }).jaksotAlkaen, null);
  assert.equal(normalisoiAsetukset({ jaksotAlkaen: MAANANTAI }).jaksotAlkaen, MAANANTAI);
});

test('normalisointi kestää tyhjän ja roskan', () => {
  assert.deepEqual(
    Object.keys(normalisoiAsetukset(null)).sort(),
    Object.keys(normalisoiAsetukset('roska')).sort(),
  );
});

test('tallennus: oletukset ja jaksojen alku kelpaavat ilman sopimusta', () => {
  const t = tarkistaAsetukset({ ...OLETUKSET, jaksotAlkaen: MAANANTAI });
  assert.equal(t.ok, true);
  assert.equal(t.asetukset.jaksotAlkaen, MAANANTAI);
});

test('tallennus: puuttuvat kentät saavat TES:n arvon', () => {
  const t = tarkistaAsetukset({});
  assert.equal(t.ok, true);
  assert.equal(t.asetukset.vuorokausilepoH, 10);
  assert.equal(t.asetukset.jaksotAlkaen, null);
});

test('tallennus: TES:stä poikkeava arvo vaatii paikallisen sopimuksen kirjauksen', () => {
  const ilman = tarkistaAsetukset({ ...OLETUKSET, vuorokausilepoH: 9 });
  assert.equal(ilman.ok, false);
  assert.equal(ilman.virheet[0].kentta, 'paikallinenSopimus');

  const tyhjilla = tarkistaAsetukset({ ...OLETUKSET, vuorokausilepoH: 9, paikallinenSopimus: '   ' });
  assert.equal(tyhjilla.ok, false);

  const kanssa = tarkistaAsetukset({
    ...OLETUKSET, vuorokausilepoH: 9, paikallinenSopimus: 'Sovittu pääluottamusmiehen kanssa 1.10.2026',
  });
  assert.equal(kanssa.ok, true);
  assert.equal(kanssa.asetukset.vuorokausilepoH, 9);
});

test('tallennus: kirjaus tyhjenee kun kaikki arvot noudattavat TES:ää', () => {
  // Muuten vanha kirjaus jäisi kenttään ja kattaisi myöhemmin uuden poikkeaman.
  const t = tarkistaAsetukset({ ...OLETUKSET, paikallinenSopimus: 'Vanha sopimus levosta' });
  assert.equal(t.ok, true);
  assert.equal(t.asetukset.paikallinenSopimus, '');
});

test('tallennus: myös TES:ää tiukempi arvo on poikkeama', () => {
  // Järjestelmä ei arvioi kumpaan suuntaan poikkeama on — sekin että lepoa on enemmän
  // kuin TES vaatii on sovittu jossain, ja se kirjataan samalla tavalla.
  const t = tarkistaAsetukset({ ...OLETUKSET, vuorokausilepoH: 11 });
  assert.equal(t.ok, false);
});

test('tallennus: yörajoituksen poisto on poikkeama', () => {
  assert.deepEqual(tesPoikkeamat({ ...OLETUKSET, yorajoitus: false }), ['yorajoitus']);
});

test('tallennus: kelvotonta arvoa ei korjata hiljaa', () => {
  const t = tarkistaAsetukset({ ...OLETUKSET, vuorokausilepoH: 100 });
  assert.equal(t.ok, false);
  assert.equal(t.virheet[0].kentta, 'vuorokausilepoH');
});

test('tallennus: puolet tunnit kelpaavat, tarkemmat eivät', () => {
  const sopimus = { paikallinenSopimus: 'Paikallinen sopimus 1.10.2026' };
  assert.equal(tarkistaAsetukset({ ...OLETUKSET, ...sopimus, vuorokausilepoH: 10.5 }).ok, true);
  assert.equal(tarkistaAsetukset({ ...OLETUKSET, ...sopimus, vuorokausilepoH: 10.25 }).ok, false);
});

test('tallennus: listan pituus on 3 tai 6 viikkoa', () => {
  assert.equal(tarkistaAsetukset({ ...OLETUKSET, listanPituusVk: 6 }).ok, true);
  assert.equal(tarkistaAsetukset({ ...OLETUKSET, listanPituusVk: 4 }).ok, false);
});

test('tallennus: jaksojen alun on oltava maanantai', () => {
  const t = tarkistaAsetukset({ ...OLETUKSET, jaksotAlkaen: '2026-10-07' });
  assert.equal(t.ok, false);
  assert.equal(t.virheet[0].kentta, 'jaksotAlkaen');
});

test('tallennus: ristiriitaiset pituudet hylätään', () => {
  const sopimus = { paikallinenSopimus: 'Paikallinen sopimus 1.10.2026' };
  assert.equal(tarkistaAsetukset({ ...OLETUKSET, ...sopimus, vuoronMinH: 10, vuoronMaxH: 8 }).ok, false);
  assert.equal(tarkistaAsetukset({ ...OLETUKSET, ...sopimus, poikkeavanMaxH: 10 }).ok, false);
  assert.equal(tarkistaAsetukset({ ...OLETUKSET, ...sopimus, viikkovapaaMinH: 36 }).ok, false);
  assert.equal(tarkistaAsetukset({ ...OLETUKSET, ...sopimus, julkaisuVkEnnen: 4 }).ok, false);
});

test('jakso: ankkuripäivä aloittaa jakson 0', () => {
  const j = jaksoPaivalle(MAANANTAI, MAANANTAI);
  assert.deepEqual(j, { numero: 0, alku: MAANANTAI, loppu: '2026-10-26', viimeinen: '2026-10-25' });
});

test('jakso: viimeinen päivä kuuluu samaan jaksoon, seuraava ei', () => {
  assert.equal(jaksoPaivalle(MAANANTAI, '2026-10-25').numero, 0);
  assert.equal(jaksoPaivalle(MAANANTAI, '2026-10-26').numero, 1);
});

test('jakso: kesäajan päättyminen ei siirrä rajaa', () => {
  // Kesäaika päättyy 25.10.2026. Paikallisella ajalla laskettuna päivä olisi 25 tuntia.
  const j = jaksoPaivalle(MAANANTAI, '2026-11-16');
  assert.equal(j.numero, 2);
  assert.equal(j.alku, '2026-11-16');
});

test('jakso: ankkuria edeltävät päivät jatkavat samaa rytmiä', () => {
  const j = jaksoPaivalle(MAANANTAI, '2026-10-04');
  assert.equal(j.numero, -1);
  assert.equal(j.alku, '2026-09-14');
  assert.equal(j.viimeinen, '2026-10-04');
});

test('jakso: ilman kelvollista ankkuria ei jaksoa', () => {
  assert.equal(jaksoPaivalle(null, MAANANTAI), null);
  assert.equal(jaksoPaivalle('2026-10-06', MAANANTAI), null);
});

test('listat: ilman jaksojen alkua ei listoja', () => {
  assert.deepEqual(listat(normalisoiAsetukset({}), MAANANTAI), []);
});

test('listat: kolmen viikon listat ja julkaisumääräaika', () => {
  const a = normalisoiAsetukset({ jaksotAlkaen: MAANANTAI });
  const l = listat(a, '2026-10-10', 2);
  assert.equal(l.length, 2);
  assert.equal(l[0].alku, MAANANTAI);
  assert.equal(l[0].viimeinen, '2026-10-25');
  assert.equal(l[0].jaksot.length, 1);
  assert.equal(l[0].julkaistavaViimeistaan, '2026-09-21');
  assert.equal(l[1].alku, '2026-10-26');
  assert.equal(l[1].julkaistavaViimeistaan, '2026-10-12');
});

test('listat: paikallisesti sovittu viikon julkaisuaika', () => {
  const a = normalisoiAsetukset({ jaksotAlkaen: MAANANTAI, julkaisuVkEnnen: 1 });
  assert.equal(listat(a, MAANANTAI, 1)[0].julkaistavaViimeistaan, '2026-09-28');
});

test('listat: kuuden viikon lista alkaa aina parillisesta jaksosta', () => {
  const a = normalisoiAsetukset({ jaksotAlkaen: MAANANTAI, listanPituusVk: 6 });
  // Jakson 1 päivä: lista alkaa silti jaksosta 0.
  const l = listat(a, '2026-11-01', 2);
  assert.equal(l[0].alku, MAANANTAI);
  assert.equal(l[0].viimeinen, '2026-11-15');
  assert.equal(l[0].jaksot.length, 2);
  assert.equal(l[1].alku, '2026-11-16');
});

test('listat: kuuden viikon lista ennen ankkuria', () => {
  const a = normalisoiAsetukset({ jaksotAlkaen: MAANANTAI, listanPituusVk: 6 });
  // Jakso -1 kuuluu listaan joka alkaa jaksosta -2.
  const l = listat(a, '2026-10-01', 1);
  assert.equal(l[0].jaksot[0].numero, -2);
  assert.equal(l[0].jaksot[1].numero, -1);
  assert.equal(l[0].viimeinen, '2026-10-04');
});
