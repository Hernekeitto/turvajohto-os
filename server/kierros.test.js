// Kierroksen sääntöjen testit. Nämä ovat erän tärkein testijoukko: kierroksen koko arvo
// on siinä, ettei sitä voi merkitä tehdyksi tekemättä sitä. Jos jokin näistä testeistä
// alkaa mennä läpi väärin päin, tuote lakkaa todistamasta mitään.
//
// Ajetaan: node --test server/kierros.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aloitaKierros, kuittaaPiste, paataKierros, kuittaamattomat, onPaattynyt,
  etaisyysMetreina, kooste, OLETUS_SIETORAJA_M,
} from './kierros.js';

const POHJA = {
  id: 'pohja-1',
  kind: 'patrol',
  nimi: 'Yökierros',
  versio: 3,
  pisteet: [
    { id: 'p2', nimi: 'Takaovi', jarjestys: 1, token: 't2', gps: { lat: 61.4941, lon: 23.7651 } },
    { id: 'p1', nimi: 'Pääovi', jarjestys: 0, token: 't1', gps: { lat: 61.494, lon: 23.765 } },
    { id: 'p3', nimi: 'Konehuone', jarjestys: 2, token: 't3', gps: null },
  ],
};

const aloita = () => aloitaKierros({
  pohja: POHJA, siteId: 'kohde-1', vartija: 'vartija1', id: 'k-1',
  nyt: new Date('2026-09-02T22:00:00Z'),
}).kierros;

// --- Aloitus ----------------------------------------------------------------------

test('kierros kopioi pisteet pohjasta järjestyksessä', () => {
  const k = aloita();
  assert.deepEqual(k.pisteet.map((p) => p.nimi), ['Pääovi', 'Takaovi', 'Konehuone']);
  assert.equal(k.tila, 'kesken');
  assert.equal(k.templateVersio, 3);
  // Nimi kopioidaan, jotta suoritus on luettava vaikka pohja poistettaisiin.
  assert.equal(k.templateNimi, 'Yökierros');
});

test('kierroksen pisteisiin ei kopioidu tokenia', () => {
  const k = aloita();
  for (const p of k.pisteet) assert.equal(p.token, undefined);
});

test('arkistoidusta pohjasta ei voi aloittaa kierrosta', () => {
  const tulos = aloitaKierros({
    pohja: { ...POHJA, arkistoitu: '2026-09-01T00:00:00Z' },
    siteId: 'kohde-1', vartija: 'v', id: 'k-2',
  });
  assert.equal(tulos.ok, false);
});

test('pisteetön pohja ei kelpaa kierrokseksi', () => {
  const tulos = aloitaKierros({ pohja: { ...POHJA, pisteet: [] }, siteId: 'k', vartija: 'v', id: 'x' });
  assert.equal(tulos.ok, false);
});

// --- Kuittaus ---------------------------------------------------------------------

test('kuittaus merkitsee ajan, tavan ja sijainnin', () => {
  const tulos = kuittaaPiste({
    kierros: aloita(), pisteId: 'p1', tapa: 'qr',
    gps: { lat: 61.494, lon: 23.765 }, nyt: new Date('2026-09-02T22:05:00Z'),
  });
  assert.equal(tulos.ok, true);
  const piste = tulos.kierros.pisteet.find((p) => p.pisteId === 'p1');
  assert.equal(piste.tapa, 'qr');
  assert.equal(piste.kuitattu, '2026-09-02T22:05:00.000Z');
  assert.equal(piste.etaisyysM, 0);
});

test('jo kuitattua pistettä ei voi kuitata uudelleen', () => {
  const eka = kuittaaPiste({ kierros: aloita(), pisteId: 'p1' });
  const toka = kuittaaPiste({ kierros: eka.kierros, pisteId: 'p1' });
  assert.equal(toka.ok, false);
  assert.match(toka.error, /jo kuitattu/);
});

test('kuittaus ei muuta annettua kierrosta vaan palauttaa uuden', () => {
  const alku = aloita();
  kuittaaPiste({ kierros: alku, pisteId: 'p1' });
  assert.equal(alku.pisteet.find((p) => p.pisteId === 'p1').kuitattu, null);
});

test('tuntematonta pistettä ei voi kuitata', () => {
  const tulos = kuittaaPiste({ kierros: aloita(), pisteId: 'ei-ole' });
  assert.equal(tulos.ok, false);
});

test('sijainti EI oletuksena estä kuittausta vaikka se olisi kaukana', () => {
  // Helsinki, ~160 km Tampereelta. Oletuksena kuittaus menee läpi ja etäisyys jää
  // näkyviin todisteeksi — tämä on päätös V2 = a.
  const tulos = kuittaaPiste({
    kierros: aloita(), pisteId: 'p1', gps: { lat: 60.17, lon: 24.94 },
  });
  assert.equal(tulos.ok, true);
  assert.ok(tulos.kierros.pisteet.find((p) => p.pisteId === 'p1').etaisyysM > 100000);
});

test('sijaintipakotus torjuu kuittauksen sietorajan ulkopuolelta', () => {
  const tulos = kuittaaPiste({
    kierros: aloita(), pisteId: 'p1', gps: { lat: 60.17, lon: 24.94 },
    pakotaSijainti: true, sietorajaM: OLETUS_SIETORAJA_M,
  });
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /metrin päässä/);
});

test('sijaintipakotus hyväksyy kuittauksen sietorajan sisältä', () => {
  const tulos = kuittaaPiste({
    kierros: aloita(), pisteId: 'p1', gps: { lat: 61.4941, lon: 23.7651 },
    pakotaSijainti: true,
  });
  assert.equal(tulos.ok, true);
});

test('sijaintipakotus ei koske pistettä jolla ei ole tiedettyä sijaintia', () => {
  // p3:lle ei ole merkitty koordinaattia, joten mihinkään ei voi verrata — kuittaus
  // menee läpi eikä vartija jää jumiin pisteeseen jota ei ole paikannettu.
  const tulos = kuittaaPiste({ kierros: aloita(), pisteId: 'p3', pakotaSijainti: true });
  assert.equal(tulos.ok, true);
});

// --- Päättäminen ------------------------------------------------------------------

test('vajaata kierrosta EI voi merkitä valmiiksi', () => {
  const yksi = kuittaaPiste({ kierros: aloita(), pisteId: 'p1' }).kierros;
  const tulos = paataKierros({ kierros: yksi, tila: 'valmis' });
  assert.equal(tulos.ok, false);
  // Virheen on nimettävä puuttuvat pisteet, ei vain lukumäärää.
  assert.match(tulos.error, /Takaovi/);
  assert.match(tulos.error, /Konehuone/);
});

test('täysi kierros voidaan merkitä valmiiksi', () => {
  let k = aloita();
  for (const id of ['p1', 'p2', 'p3']) k = kuittaaPiste({ kierros: k, pisteId: id }).kierros;
  const tulos = paataKierros({ kierros: k, tila: 'valmis', huomiot: 'Kaikki kunnossa.' });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.kierros.tila, 'valmis');
  assert.ok(tulos.kierros.paattyi);
  assert.equal(tulos.kierros.keskeytysSyy, '');
});

test('keskeytys ilman syytä hylätään', () => {
  const tulos = paataKierros({ kierros: aloita(), tila: 'keskeytetty', syy: '  ' });
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /syyn/);
});

test('keskeytys syyn kanssa onnistuu vajaanakin', () => {
  const tulos = paataKierros({
    kierros: aloita(), tila: 'keskeytetty', syy: 'Halytys tuli kesken kierroksen.',
  });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.kierros.tila, 'keskeytetty');
  assert.equal(tulos.kierros.keskeytysSyy, 'Halytys tuli kesken kierroksen.');
});

test('päättynyttä kierrosta ei voi päättää uudelleen', () => {
  const keskeytetty = paataKierros({
    kierros: aloita(), tila: 'keskeytetty', syy: 'Sairastuminen.',
  }).kierros;
  const uudelleen = paataKierros({ kierros: keskeytetty, tila: 'valmis' });
  assert.equal(uudelleen.ok, false);
});

test('päättyneeseen kierrokseen ei voi kuitata pisteitä', () => {
  const keskeytetty = paataKierros({
    kierros: aloita(), tila: 'keskeytetty', syy: 'Sairastuminen.',
  }).kierros;
  const tulos = kuittaaPiste({ kierros: keskeytetty, pisteId: 'p1' });
  assert.equal(tulos.ok, false);
  assert.equal(onPaattynyt(keskeytetty), true);
});

test('tuntematon tila hylätään', () => {
  const tulos = paataKierros({ kierros: aloita(), tila: 'melkein_valmis' });
  assert.equal(tulos.ok, false);
});

// --- Apurit -----------------------------------------------------------------------

test('kuittaamattomat ja kooste laskevat oikein', () => {
  const k = kuittaaPiste({ kierros: aloita(), pisteId: 'p2' }).kierros;
  assert.equal(kuittaamattomat(k).length, 2);
  assert.deepEqual(kooste(k), { kuitatut: 1, yhteensa: 3 });
});

test('etäisyys tunnetulla välimatkalla on oikeaa suuruusluokkaa', () => {
  // Tampere - Helsinki on linnuntietä noin 160 km.
  const m = etaisyysMetreina({ lat: 61.494, lon: 23.765 }, { lat: 60.17, lon: 24.94 });
  assert.ok(m > 150000 && m < 185000, `sai ${m}`);
  assert.equal(etaisyysMetreina(null, { lat: 1, lon: 1 }), null);
});
