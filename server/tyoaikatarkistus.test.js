// Henkilökohtaisten työaikatarkistusten testit (erä 3).
//
// Painopiste on rajoissa: tasan 10 tunnin lepo, viikkovapaan jakautuminen kahdelle
// viikolle, listan alun yli menevä lepo ja kortin viimeinen voimassaolopäivä. Ne ovat
// kohdat joissa yhden minuutin virhe muuttaa sallitun kielletyksi.
//
// Ajetaan: node --test server/tyoaikatarkistus.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { aikaMin, korttiVoimassaAsti, tarkistaHenkilo } from './tyoaikatarkistus.js';
import { OLETUKSET, listat, normalisoiAsetukset } from './tyovuorolista.js';

// Lista ma 5.10. – su 25.10.2026 (yksi kolmen viikon jakso).
const ASETUKSET = normalisoiAsetukset({ jaksotAlkaen: '2026-10-05' });
const LISTA = listat(ASETUKSET, '2026-10-05', 1)[0];

const KOHDE = {
  id: 'k1', name: 'Kauppakeskus',
  perehdytykset: [{ username: 'virtanen', vuorotyyppiIdt: ['v1'] }],
};

const HENKILO = {
  username: 'virtanen', nimi: 'Virtanen', workTimeType: 'monthly',
  hasGuardCard: true, guardCardValidUntil: '2028-12',
};

let n = 0;
// Vuoro päivälle. Päättymisaika ennen alkua = seuraavana päivänä.
const vuoro = (pvm, alkaa = '06:00', paattyy = '14:00', yli = {}) => {
  const [ah, am] = alkaa.split(':').map(Number);
  const [ph, pm] = paattyy.split(':').map(Number);
  let kesto = ph * 60 + pm - (ah * 60 + am);
  if (kesto <= 0) kesto += 24 * 60;
  const loppu = new Date(Date.parse(`${pvm}T${alkaa}:00Z`) + kesto * 60000).toISOString().slice(0, 16);
  n += 1;
  return {
    id: `x${n}`, siteId: 'k1', siteNimi: 'Kauppakeskus', vuorotyyppiId: 'v1', vuoroNimi: 'Aamu',
    pvm, alkaa: `${pvm}T${alkaa}`, paattyy: loppu, kestoMin: kesto, ...yli,
  };
};

const tarkista = (vuorot, { henkilo = HENKILO, asetukset = ASETUKSET } = {}) =>
  tarkistaHenkilo({ henkilo, vuorot, kohteet: [KOHDE], asetukset, lista: LISTA });

const koodit = (tulos) => tulos.havainnot.map((h) => h.koodi);

// Päivät ma 5.10. alkaen.
const pv = (i) => new Date(Date.UTC(2026, 9, 5 + i)).toISOString().slice(0, 10);

test('apu: aika minuutteina ja kortin voimassaolo', () => {
  assert.equal(aikaMin('2026-10-05T01:30') - aikaMin('2026-10-05T00:00'), 90);
  assert.equal(aikaMin('roska'), null);
  assert.equal(korttiVoimassaAsti('2027-02'), '2027-02-28');
  assert.equal(korttiVoimassaAsti('2026-12'), '2026-12-31');
  assert.equal(korttiVoimassaAsti('2027-03-15'), '2027-03-15');
  assert.equal(korttiVoimassaAsti('2027-13'), null);
  assert.equal(korttiVoimassaAsti(''), null);
});

test('tyhjä lista ei tuota estoja eikä varoituksia', () => {
  const t = tarkista([]);
  assert.deepEqual(koodit(t).filter((k) => k !== 'vajaa'), []);
});

test('tavallinen viikko ei tuota havaintoja vuoroista', () => {
  // ma–pe 06–14, ei viikonloppuja.
  const v = [0, 1, 2, 3, 4].map((i) => vuoro(pv(i)));
  assert.deepEqual(koodit(tarkista(v)).filter((k) => k !== 'vajaa'), []);
});

test('perehdytys puuttuu toisesta vuorotyypistä', () => {
  const t = tarkista([vuoro(pv(0)), vuoro(pv(1), '06:00', '14:00', { vuorotyyppiId: 'v2' })]);
  const h = t.havainnot.find((x) => x.koodi === 'ei_perehdytysta');
  assert.equal(h.taso, 'este');
  assert.equal(h.vuoroIdt.length, 1);
});

test('päällekkäiset vuorot ovat este', () => {
  const t = tarkista([vuoro(pv(0), '06:00', '14:00'), vuoro(pv(0), '12:00', '20:00')]);
  assert.equal(t.havainnot.find((x) => x.koodi === 'paallekkain').taso, 'este');
});

test('vuorokausilepo: tasan 10 h kelpaa, 9 h 59 min ei', () => {
  const ok = tarkista([vuoro(pv(0), '06:00', '14:00'), vuoro(pv(1), '00:00', '08:00')]);
  assert.ok(!koodit(ok).includes('vuorokausilepo'));
  const ei = tarkista([vuoro(pv(0), '06:00', '14:01'), vuoro(pv(1), '00:00', '08:00')]);
  const h = ei.havainnot.find((x) => x.koodi === 'vuorokausilepo');
  assert.equal(h.taso, 'poikkeama');
  assert.equal(h.vuoroIdt.length, 2);
});

test('vuorokausilepo listan rajalla: edellisen listan vuoro lasketaan mukaan', () => {
  const edellinen = vuoro('2026-10-04', '18:00', '02:00'); // su–ma yö, edellisellä listalla
  const t = tarkista([edellinen, vuoro(pv(0), '06:00', '14:00')]);
  assert.ok(koodit(t).includes('vuorokausilepo'));
});

test('edellisen listan vuorot eivät tuota omia havaintojaan', () => {
  // Kaksi päällekkäistä vuoroa edellisellä listalla: ei tämän listan asia.
  const t = tarkista([vuoro('2026-10-03'), vuoro('2026-10-03')]);
  assert.ok(!koodit(t).includes('paallekkain'));
});

test('viikkovapaa: seitsemän päivää putkeen ilman 30 h vapaata', () => {
  const v = [0, 1, 2, 3, 4, 5, 6].map((i) => vuoro(pv(i), '06:00', '14:00'));
  const h = tarkista(v).havainnot.find((x) => x.koodi === 'viikkovapaa');
  assert.equal(h.taso, 'poikkeama');
  assert.equal(h.vuoroIdt.length, 7);
});

test('viikkovapaa: lauantaina vapaa riittää (pe 14 – su 06 = 40 h)', () => {
  const v = [0, 1, 2, 3, 4, 6].map((i) => vuoro(pv(i), '06:00', '14:00'));
  assert.ok(!koodit(tarkista(v)).includes('viikkovapaa'));
});

test('viikkovapaa: 14 vuorokauden keskiarvo pelastaa lyhyen viikon', () => {
  // Viikko 1: vapaa 26 h (la 14 – su 16). Viikko 2: ma–ke töissä, sitten pitkä vapaa.
  const v = [
    vuoro(pv(0)), vuoro(pv(1)), vuoro(pv(2)), vuoro(pv(3)), vuoro(pv(4)), vuoro(pv(5)),
    vuoro(pv(6), '16:00', '22:00'),
    vuoro(pv(7)), vuoro(pv(8)),
  ];
  assert.ok(!koodit(tarkista(v)).includes('viikkovapaa'));
});

test('viikkovapaa: alle 24 h viikko ei pelastu keskiarvolla', () => {
  const v = [
    vuoro(pv(0)), vuoro(pv(1)), vuoro(pv(2)), vuoro(pv(3)), vuoro(pv(4)), vuoro(pv(5)),
    vuoro(pv(6), '10:00', '18:00'), // la 14 – su 10 = 20 h
  ];
  assert.ok(koodit(tarkista(v)).includes('viikkovapaa'));
});

test('yli yhdeksän vuoroa ilman viikkovapaata', () => {
  // 10 päivää peräkkäin 06–14: aukot 16 h, ei yhtään 24 h vapaata.
  const v = Array.from({ length: 10 }, (_, i) => vuoro(pv(i)));
  const h = tarkista(v).havainnot.find((x) => x.koodi === 'putki');
  assert.equal(h.taso, 'varoitus');
  assert.equal(h.vuoroIdt.length, 10);
  const yhdeksan = tarkista(Array.from({ length: 9 }, (_, i) => vuoro(pv(i))));
  assert.ok(!koodit(yhdeksan).includes('putki'));
});

test('pitkä viikonloppu: neljä työviikonloppua peräkkäin varoittaa', () => {
  const asetukset = normalisoiAsetukset({ jaksotAlkaen: '2026-10-05', listanPituusVk: 6 });
  const lista = listat(asetukset, '2026-10-05', 1)[0];
  // Lauantait 10.10., 17.10., 24.10., 31.10.
  const v = [5, 12, 19, 26].map((i) => vuoro(pv(i), '10:00', '18:00'));
  const t = tarkistaHenkilo({ henkilo: HENKILO, vuorot: v, kohteet: [KOHDE], asetukset, lista });
  assert.equal(t.havainnot.filter((x) => x.koodi === 'pitka_viikonloppu').length, 1);
  // Kolme peräkkäin: ei varoitusta, koska listaa edeltävät viikonloput lasketaan vapaiksi
  // ja neljäs on vapaa.
  const kolme = tarkistaHenkilo({ henkilo: HENKILO, vuorot: v.slice(0, 3), kohteet: [KOHDE], asetukset, lista });
  assert.ok(!koodit(kolme).includes('pitka_viikonloppu'));
});

test('pitkä viikonloppu: perjantain iltavuoro klo 18 jälkeen vie viikonlopun', () => {
  const asetukset = normalisoiAsetukset({ jaksotAlkaen: '2026-10-05', listanPituusVk: 6 });
  const lista = listat(asetukset, '2026-10-05', 1)[0];
  const v = [4, 11, 18, 25].map((i) => vuoro(pv(i), '14:00', '22:00')); // perjantait 14–22
  const t = tarkistaHenkilo({ henkilo: HENKILO, vuorot: v, kohteet: [KOHDE], asetukset, lista });
  assert.ok(koodit(t).includes('pitka_viikonloppu'));
  // Perjantai 10–18 päättyy tasan rajalle: viikonloppu on vapaa.
  const raja = [4, 11, 18, 25].map((i) => vuoro(pv(i), '10:00', '18:00'));
  const t2 = tarkistaHenkilo({ henkilo: HENKILO, vuorot: raja, kohteet: [KOHDE], asetukset, lista });
  assert.ok(!koodit(t2).includes('pitka_viikonloppu'));
});

test('vartijakortti: puuttuva kortti ja puuttuva voimassaolo ovat esteitä', () => {
  const ilman = tarkista([vuoro(pv(0))], { henkilo: { ...HENKILO, hasGuardCard: false } });
  assert.equal(ilman.havainnot.find((x) => x.koodi === 'ei_korttia').taso, 'este');
  const eiPvm = tarkista([vuoro(pv(0))], { henkilo: { ...HENKILO, guardCardValidUntil: '' } });
  assert.ok(koodit(eiPvm).includes('ei_korttia'));
});

test('vartijakortti: vanhenee kesken listan', () => {
  // Voimassa 31.10.2026 asti → varoitus kaikista, ei estettä.
  const t = tarkista([vuoro(pv(0)), vuoro(pv(20))], { henkilo: { ...HENKILO, guardCardValidUntil: '2026-10' } });
  assert.ok(!koodit(t).includes('kortti_vanhentunut'));
  assert.equal(t.havainnot.find((x) => x.koodi === 'kortti_vanhenee').vuoroIdt.length, 2);
  // Voimassa 15.10. asti → 20.10. vuoro on este.
  const t2 = tarkista([vuoro(pv(0)), vuoro(pv(15))], { henkilo: { ...HENKILO, guardCardValidUntil: '2026-10-15' } });
  assert.equal(t2.havainnot.find((x) => x.koodi === 'kortti_vanhentunut').vuoroIdt.length, 1);
});

test('vartijakortti: varoitusraja 45 päivää', () => {
  // Viimeinen voimassaolopäivä 19.11.2026: 5.10. on 45 päivän päässä, 4.10. ei olisi.
  const t = tarkista([vuoro(pv(0))], { henkilo: { ...HENKILO, guardCardValidUntil: '2026-11-19' } });
  assert.ok(koodit(t).includes('kortti_vanhenee'));
  const t2 = tarkista([vuoro(pv(0))], { henkilo: { ...HENKILO, guardCardValidUntil: '2026-11-20' } });
  assert.ok(!koodit(t2).includes('kortti_vanhenee'));
});

test('työsuhde: ennen alkua ja määräaikaisen päättymisen jälkeen', () => {
  const t = tarkista([vuoro(pv(0)), vuoro(pv(10))], {
    henkilo: { ...HENKILO, employmentStart: '2026-10-07', employmentType: 'fixed', employmentFixedTo: '2026-10-14' },
  });
  const h = t.havainnot.filter((x) => x.koodi === 'tyosuhde');
  assert.equal(h.length, 2);
  assert.ok(h.every((x) => x.taso === 'este'));
});

test('jakson tunnit: kuukausipalkkainen 120 h tasan ei tuota havaintoa', () => {
  // 15 × 8 h = 120 h, ma–pe kolme viikkoa.
  const v = [0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18].map((i) => vuoro(pv(i)));
  const t = tarkista(v);
  assert.equal(t.jaksot[0].tunnit, 120);
  assert.ok(!koodit(t).some((k) => k === 'vajaa' || k === 'ylityo'));
});

test('jakson tunnit: kuukausipalkkaisen vajaus on huomio ja ylitys varoitus', () => {
  const vajaa = tarkista([vuoro(pv(0))]);
  assert.equal(vajaa.havainnot.find((x) => x.koodi === 'vajaa').taso, 'huomio');
  const v = [0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18].map((i) => vuoro(pv(i), '06:00', '15:00'));
  const yli = tarkista(v); // 135 h
  const h = yli.havainnot.find((x) => x.koodi === 'ylityo');
  assert.equal(h.taso, 'varoitus');
  assert.match(h.viesti, /128/);
});

test('jakson tunnit: osa-aikaisen vähimmäistyöaika', () => {
  const t = tarkista([vuoro(pv(0))], { henkilo: { ...HENKILO, workTimeType: 'parttime', minHoursPer3Weeks: '40' } });
  assert.equal(t.havainnot.find((x) => x.koodi === 'alle_vahimman').taso, 'varoitus');
  const reservi = tarkista([vuoro(pv(0))], { henkilo: { ...HENKILO, workTimeType: 'oncall' } });
  assert.ok(!koodit(reservi).some((k) => ['vajaa', 'alle_vahimman', 'ylityo'].includes(k)));
});

test('paikallisesti sovittu lyhyempi lepo otetaan asetuksista', () => {
  const asetukset = { ...ASETUKSET, vuorokausilepoH: 9 };
  const t = tarkista([vuoro(pv(0), '06:00', '14:00'), vuoro(pv(0), '23:00', '07:00')], { asetukset });
  assert.ok(!koodit(t).includes('vuorokausilepo'));
  assert.equal(OLETUKSET.vuorokausilepoH, 10);
});

// --- Erä 4: pidennetty työvuoro ---

test('peräkkäiset vuorot ilman väliä ovat pidennetty vuoro eikä lepopoikkeama', () => {
  const t = tarkista([vuoro(pv(0), '06:00', '14:00'), vuoro(pv(0), '14:00', '22:00')]);
  assert.ok(!koodit(t).includes('vuorokausilepo'));
  const h = t.havainnot.find((x) => x.koodi === 'jatkettu');
  assert.equal(h.taso, 'poikkeama');
  assert.match(h.viesti, /16 h/);
  assert.equal(h.vuoroIdt.length, 2);
});

test('pidennetty vuoro: enintään 12 h ei ole poikkeama, yli 16 h on este', () => {
  const lyhyt = tarkista([vuoro(pv(0), '06:00', '12:00'), vuoro(pv(0), '12:00', '18:00')]);
  assert.ok(!koodit(lyhyt).some((k) => k === 'jatkettu' || k === 'vuorokausilepo'));
  const pitka = tarkista([vuoro(pv(0), '06:00', '14:00'), vuoro(pv(0), '14:00', '22:00'), vuoro(pv(0), '22:00', '02:00')]);
  assert.equal(pitka.havainnot.find((x) => x.koodi === 'liian_pitka').taso, 'este');
});

test('pidennetyn vuoron jälkeinen lepo lasketaan ketjun lopusta', () => {
  const t = tarkista([vuoro(pv(0), '06:00', '14:00'), vuoro(pv(0), '14:00', '22:00'), vuoro(pv(1), '06:00', '14:00')]);
  const h = t.havainnot.find((x) => x.koodi === 'vuorokausilepo');
  assert.match(h.viesti, /8 h/);
});

// --- Erä 5: poissaolot ja toiveet ---

test('poissaolo on este ja sen tunnit lasketaan jaksoon', () => {
  const poissaolot = [{ laji: 'vuosiloma', alku: '2026-10-12', loppu: '2026-10-17', tunnit: 40.2 }];
  const t = tarkistaHenkilo({
    henkilo: HENKILO, vuorot: [vuoro(pv(0)), vuoro(pv(8))], kohteet: [KOHDE], asetukset: ASETUKSET, lista: LISTA, poissaolot,
  });
  const h = t.havainnot.find((x) => x.koodi === 'poissa');
  assert.equal(h.taso, 'este');
  assert.equal(h.vuoroIdt.length, 1);
  assert.equal(t.jaksot[0].vuorotunnit, 16);
  assert.equal(t.jaksot[0].poissaolotunnit, 40.2);
  assert.equal(t.jaksot[0].tunnit, 56.2);
});

test('loma täydentää jakson: ei vajaus-huomiota', () => {
  // Kaksi viikkoa töitä (80 h) ja viikon loma 40 h = 120 h.
  const v = [0, 1, 2, 3, 4, 7, 8, 9, 10, 11].map((i) => vuoro(pv(i)));
  const t = tarkistaHenkilo({
    henkilo: HENKILO, vuorot: v, kohteet: [KOHDE], asetukset: ASETUKSET, lista: LISTA,
    poissaolot: [{ laji: 'vuosiloma', alku: '2026-10-19', loppu: '2026-10-25', tunnit: 40 }],
  });
  assert.ok(!koodit(t).includes('vajaa'));
});

test('toive vapaasta ja este ovat varoituksia, toive vuorosta ei', () => {
  const toiveet = [
    { laji: 'vapaa', pvm: pv(0) },
    { laji: 'este', pvm: pv(1), huom: 'lääkäri' },
    { laji: 'vuoro', pvm: pv(2) },
  ];
  const t = tarkistaHenkilo({
    henkilo: HENKILO, vuorot: [vuoro(pv(0)), vuoro(pv(1)), vuoro(pv(2))], kohteet: [KOHDE], asetukset: ASETUKSET, lista: LISTA, toiveet,
  });
  const h = t.havainnot.filter((x) => x.koodi === 'toive');
  assert.equal(h.length, 2);
  assert.ok(h.every((x) => x.taso === 'varoitus'));
  assert.match(h[1].viesti, /lääkäri/);
});
