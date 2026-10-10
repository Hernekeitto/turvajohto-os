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
  onMiehitys, suunnitellutVuorot, tarkistaMiehitys, vuoronKestoMin, vuoronTesPoikkeamat,
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

// --- Erä 2: kohteen miehitys ---

const ARKI = [1, 1, 1, 1, 1, 0, 0];
const vt = (yli = {}) => ({
  id: 'v1', nimi: 'Aamu', alkaa: '06:00', paattyy: '14:00',
  suunnittelu: { maarat: ARKI }, ...yli,
});

test('kesto: tavallinen, puolenyön yli ja vuorokausi', () => {
  assert.equal(vuoronKestoMin('06:00', '14:00'), 480);
  assert.equal(vuoronKestoMin('18:00', '06:00'), 720);
  assert.equal(vuoronKestoMin('07:00', '07:00'), 1440);
  assert.equal(vuoronKestoMin('', '14:00'), null);
});

test('TES-poikkeamat: 06–14 ja 16–24 ovat sallittuja', () => {
  assert.deepEqual(vuoronTesPoikkeamat(vt(), OLETUKSET), []);
  assert.deepEqual(vuoronTesPoikkeamat(vt({ alkaa: '16:00', paattyy: '00:00' }), OLETUKSET), []);
});

test('TES-poikkeamat: yöllä päättyvä, lyhyt ja poikkeavan pitkä', () => {
  assert.deepEqual(vuoronTesPoikkeamat(vt({ alkaa: '22:00', paattyy: '02:00' }), OLETUKSET), ['lyhyt', 'yo']);
  assert.deepEqual(vuoronTesPoikkeamat(vt({ alkaa: '06:00', paattyy: '20:00' }), OLETUKSET), ['pitka']);
  assert.deepEqual(vuoronTesPoikkeamat(vt({ alkaa: '18:00', paattyy: '06:00' }), OLETUKSET), []);
});

test('TES-poikkeamat: yörajoitus pois päältä', () => {
  const a = { ...OLETUKSET, yorajoitus: false };
  assert.deepEqual(vuoronTesPoikkeamat(vt({ alkaa: '02:00', paattyy: '10:00' }), a), []);
});

test('miehitys: tyhjä tai nollat ei ole miehitystä', () => {
  assert.equal(onMiehitys({}), false);
  assert.equal(onMiehitys({ suunnittelu: { maarat: [0, 0, 0, 0, 0, 0, 0] } }), false);
  assert.equal(onMiehitys(vt()), true);
});

test('miehityksen tarkistus: vanha vuorotyyppi ilman suunnittelua kelpaa', () => {
  assert.deepEqual(tarkistaMiehitys({ id: 'x', nimi: 'Lisä' }, OLETUKSET), []);
});

test('miehityksen tarkistus: kelvollinen', () => {
  assert.deepEqual(tarkistaMiehitys(vt(), OLETUKSET), []);
});

test('miehityksen tarkistus: määrät', () => {
  assert.equal(tarkistaMiehitys(vt({ suunnittelu: { maarat: [1, 1] } }), OLETUKSET).length, 1);
  assert.equal(tarkistaMiehitys(vt({ suunnittelu: { maarat: [1, 1, 1, 1, 1, 1, -1] } }), OLETUKSET).length, 1);
  assert.equal(tarkistaMiehitys(vt({ suunnittelu: { maarat: [1, 1, 1, 1, 1, 1, 1.5] } }), OLETUKSET).length, 1);
});

test('miehityksen tarkistus: miehitetty vuoro tarvitsee kellonajat', () => {
  const v = tarkistaMiehitys(vt({ alkaa: undefined, paattyy: undefined }), OLETUKSET);
  assert.match(v[0], /alkamis- ja päättymisaika/);
});

test('miehityksen tarkistus: yli 16 h on virhe perustelusta huolimatta', () => {
  const v = tarkistaMiehitys(vt({
    alkaa: '06:00', paattyy: '23:00', suunnittelu: { maarat: ARKI, tesPerustelu: 'Sovittu' },
  }), OLETUKSET);
  assert.equal(v.length, 1);
  assert.match(v[0], /16 h/);
});

test('miehityksen tarkistus: poikkeava vuoro vaatii perustelun', () => {
  const ilman = tarkistaMiehitys(vt({ alkaa: '06:00', paattyy: '20:00' }), OLETUKSET);
  assert.equal(ilman.length, 1);
  assert.match(ilman[0], /perustelun/);
  const kanssa = tarkistaMiehitys(vt({
    alkaa: '06:00', paattyy: '20:00',
    suunnittelu: { maarat: ARKI, tesPerustelu: 'Pääluottamusmiehen kanssa 1.10.2026' },
  }), OLETUKSET);
  assert.deepEqual(kanssa, []);
});

test('miehityksen tarkistus: päivämäärät', () => {
  assert.equal(tarkistaMiehitys(vt({ suunnittelu: { maarat: ARKI, alkaen: '2026-13-01' } }), OLETUKSET).length, 1);
  const vaarinPain = tarkistaMiehitys(vt({ suunnittelu: { maarat: ARKI, alkaen: '2026-11-01', asti: '2026-10-01' } }), OLETUKSET);
  assert.match(vaarinPain[0], /ennen alkupäivää/);
});

test('suunnitellut vuorot: arkipäivät ja vartijamäärä', () => {
  const kohde = { id: 'k1', name: 'Kauppakeskus', vuorotyypit: [vt({ suunnittelu: { maarat: [2, 0, 0, 0, 0, 0, 1] } })] };
  // Viikko ma 5.10. – su 11.10.
  const r = suunnitellutVuorot([kohde], MAANANTAI, '2026-10-12');
  assert.deepEqual(r.map((x) => `${x.pvm}#${x.paikka}`), ['2026-10-05#1', '2026-10-05#2', '2026-10-11#1']);
  assert.equal(r[0].alkaa, '2026-10-05T06:00');
  assert.equal(r[0].paattyy, '2026-10-05T14:00');
  assert.equal(r[0].kestoMin, 480);
  assert.equal(r[0].siteNimi, 'Kauppakeskus');
});

test('suunnitellut vuorot: yövuoro kuuluu alkamispäivälle ja päättyy seuraavana', () => {
  const kohde = { id: 'k1', vuorotyypit: [vt({ alkaa: '18:00', paattyy: '06:00', suunnittelu: { maarat: [0, 0, 0, 0, 0, 0, 1] } })] };
  const r = suunnitellutVuorot([kohde], MAANANTAI, '2026-10-12');
  assert.equal(r.length, 1);
  assert.equal(r[0].pvm, '2026-10-11');
  assert.equal(r[0].paattyy, '2026-10-12T06:00');
});

test('suunnitellut vuorot: voimassaolo rajaa päivät', () => {
  const kohde = { id: 'k1', vuorotyypit: [vt({ suunnittelu: { maarat: [1, 1, 1, 1, 1, 1, 1], alkaen: '2026-10-07', asti: '2026-10-08' } })] };
  assert.deepEqual(suunnitellutVuorot([kohde], MAANANTAI, '2026-10-12').map((x) => x.pvm), ['2026-10-07', '2026-10-08']);
});

test('suunnitellut vuorot: arkistoitu kohde ja vuoro sekä miehittämätön jäävät pois', () => {
  const kohteet = [
    { id: 'a', archived: true, vuorotyypit: [vt()] },
    { id: 'b', vuorotyypit: [vt({ arkistoitu: true }), { id: 'lisa', nimi: 'Lisä' }, vt({ alkaa: undefined })] },
  ];
  assert.deepEqual(suunnitellutVuorot(kohteet, MAANANTAI, '2026-10-12'), []);
});

test('suunnitellut vuorot: järjestys alkamisajan mukaan kohteiden yli', () => {
  const kohteet = [
    { id: 'k1', vuorotyypit: [vt({ id: 'ilta', alkaa: '14:00', paattyy: '22:00', suunnittelu: { maarat: [1, 0, 0, 0, 0, 0, 0] } })] },
    { id: 'k2', vuorotyypit: [vt({ suunnittelu: { maarat: [1, 0, 0, 0, 0, 0, 0] } })] },
  ];
  assert.deepEqual(suunnitellutVuorot(kohteet, MAANANTAI, '2026-10-12').map((x) => x.siteId), ['k2', 'k1']);
});
