// Säilyttimen historianäkymän testit.
//
// Painopiste on siinä mitä hävikkiselvitys näkisi VÄÄRIN jos kokoaminen menee pieleen:
// tapahtuma jää näkymättä, yksi käynti näkyy monena, tai toisen kaapin tapahtuma päätyy
// tämän kaapin listalle. Kaikki kolme ovat virheitä joita ruudulta ei huomaa.
//
// Ajetaan: node --test src/guard/kalusto/sailytin.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { sailyttimenTapahtumat } from './sailytin.ts';
import type { KalustonHistoria, KalustoTietue } from './tyypit.ts';

const hetki = (n: number) => `2026-09-${String(10 + n).padStart(2, '0')}T10:00:00.000Z`;

const rivi = (osat: Partial<KalustonHistoria>): KalustonHistoria => ({
  ts: hetki(1),
  tapahtuma: 'siirto',
  user: 'paakayttaja',
  teksti: '',
  sijoitusLaji: 'holvi',
  sijoitusId: null,
  sijoitusNimi: 'Holvi',
  ...osat,
});

// Rivi joka sijoittaa esineen testikaappiin.
const kaappiin = (osat: Partial<KalustonHistoria> = {}) => rivi({
  sijoitusLaji: 'avainkaappi', sijoitusId: 'kaappi-1', sijoitusNimi: 'Piiriauto 2 kaappi', ...osat,
});

const esine = (osat: Partial<KalustoTietue>): KalustoTietue => ({
  id: 'k1',
  tunnus: 'TJ-AVA-0001',
  laji: 'avain',
  alalaji: 'Yleisavain',
  nimi: 'Hansa pääovi',
  kuvaus: '',
  sarjanumero: '',
  tila: 'kaytossa',
  sijoitusLaji: 'holvi',
  sijoitusId: null,
  sijoitusNimi: 'Holvi',
  lisatiedot: {},
  luotu: hetki(0),
  historia: [],
  ...osat,
});

// Avain: holvi -> kaappi -> kohde. Yksi saapuminen ja yksi lähtö.
const kayntiKaapissa = () => esine({
  historia: [
    rivi({ ts: hetki(1), tapahtuma: 'luotu' }),
    kaappiin({ ts: hetki(2), user: 'paakayttaja' }),
    rivi({ ts: hetki(3), sijoitusLaji: 'kohde', sijoitusId: 'kohde-1', sijoitusNimi: 'Kauppakeskus Hansa', user: 'esimies' }),
  ],
});

test('yksi kaynti tuottaa saapumisen ja lahdon, uusin ensin', () => {
  const tapahtumat = sailyttimenTapahtumat([kayntiKaapissa()], 'kaappi-1');
  assert.deepEqual(tapahtumat.map((t) => t.suunta), ['lahti', 'saapui']);

  const [lahti, saapui] = tapahtumat;
  assert.equal(saapui.ts, hetki(2));
  // Saapumisen vastapuoli on MISTÄ tultiin.
  assert.equal(saapui.vastapuoli, 'Holvi');
  assert.equal(saapui.kuka, 'paakayttaja');

  assert.equal(lahti.ts, hetki(3));
  // Lähdön vastapuoli on MINNE mentiin, ja kuka on se joka siirsi pois.
  assert.equal(lahti.vastapuoli, 'Kauppakeskus Hansa');
  assert.equal(lahti.vastapuoliLaji, 'kohde');
  assert.equal(lahti.kuka, 'esimies');
  assert.equal(lahti.tunnus, 'TJ-AVA-0001');
});

test('kaapissa yha oleva nakyy saapuneena muttei lahteneena', () => {
  const yha = esine({
    historia: [rivi({ ts: hetki(1), tapahtuma: 'luotu' }), kaappiin({ ts: hetki(2) })],
  });
  const tapahtumat = sailyttimenTapahtumat([yha], 'kaappi-1');
  assert.deepEqual(tapahtumat.map((t) => t.suunta), ['saapui']);
});

test('suoraan kaappiin kirjattu esine saapuu ilman vastapuolta', () => {
  // Esine voidaan luoda pankkiin suoraan säilyttimeen, jolloin edellistä paikkaa ei ole.
  // Tyhjä vastapuoli on tieto siitä, ettei esine tullut mistään — ei puuttuva kenttä.
  const luotuKaappiin = esine({
    historia: [kaappiin({ ts: hetki(1), tapahtuma: 'luotu' })],
  });
  const [saapui] = sailyttimenTapahtumat([luotuKaappiin], 'kaappi-1');
  assert.equal(saapui.suunta, 'saapui');
  assert.equal(saapui.vastapuoli, '');
  assert.equal(saapui.vastapuoliLaji, null);
});

test('perakkaiset merkinnat samassa kaapissa eivat ole uusi saapuminen', () => {
  // Huoltoon merkitseminen kirjaa sijoituksen uudelleen mutta ei siirrä esinettä.
  // Ilman tätä yksi käynti näkyisi listalla kahtena saapumisena.
  const huollettu = esine({
    historia: [
      rivi({ ts: hetki(1), tapahtuma: 'luotu' }),
      kaappiin({ ts: hetki(2) }),
      kaappiin({ ts: hetki(3), tapahtuma: 'huoltoon' }),
      kaappiin({ ts: hetki(4), tapahtuma: 'huollosta' }),
    ],
  });
  const tapahtumat = sailyttimenTapahtumat([huollettu], 'kaappi-1');
  assert.deepEqual(tapahtumat.map((t) => t.suunta), ['saapui']);
  assert.equal(tapahtumat[0].ts, hetki(2));
});

test('toisen sailyttimen tapahtumat eivat vuoda listalle', () => {
  assert.deepEqual(sailyttimenTapahtumat([kayntiKaapissa()], 'kaappi-2'), []);
  assert.deepEqual(sailyttimenTapahtumat([kayntiKaapissa()], ''), []);
});

test('sama avain voi kayda kaapissa useasti ja jokainen kaynti on kaksi rivia', () => {
  const kahdesti = esine({
    historia: [
      rivi({ ts: hetki(1), tapahtuma: 'luotu' }),
      kaappiin({ ts: hetki(2) }),
      rivi({ ts: hetki(3), sijoitusLaji: 'kohde', sijoitusId: 'kohde-1', sijoitusNimi: 'Hansa' }),
      kaappiin({ ts: hetki(4) }),
      rivi({ ts: hetki(5), sijoitusLaji: 'holvi', sijoitusId: null, sijoitusNimi: 'Holvi' }),
    ],
  });
  const tapahtumat = sailyttimenTapahtumat([kahdesti], 'kaappi-1');
  assert.deepEqual(
    tapahtumat.map((t) => `${t.suunta}:${t.vastapuoli}`),
    ['lahti:Holvi', 'saapui:Hansa', 'lahti:Hansa', 'saapui:Holvi']
  );
});

test('paikattomat merkinnat eivat katkaise ketjua', () => {
  // Muokkaus ja pyyntö eivät kerro paikasta mitään. Jos ne laskettaisiin mukaan,
  // "seuraava sijoitus" olisi tyhjä ja lähtö joko jäisi huomaamatta tai näyttäisi
  // menneen tyhjään paikkaan.
  const valissaMuokkaus = esine({
    historia: [
      kaappiin({ ts: hetki(2) }),
      rivi({ ts: hetki(3), tapahtuma: 'muokattu', sijoitusLaji: null, sijoitusId: null, sijoitusNimi: '' }),
      rivi({ ts: hetki(4), tapahtuma: 'pyynto', sijoitusLaji: null, sijoitusId: null, sijoitusNimi: '' }),
      rivi({ ts: hetki(5), sijoitusLaji: 'kohde', sijoitusId: 'kohde-1', sijoitusNimi: 'Hansa' }),
    ],
  });
  const tapahtumat = sailyttimenTapahtumat([valissaMuokkaus], 'kaappi-1');
  assert.deepEqual(tapahtumat.map((t) => t.suunta), ['lahti', 'saapui']);
  assert.equal(tapahtumat[0].ts, hetki(5));
  assert.equal(tapahtumat[0].vastapuoli, 'Hansa');
});

test('vanhat rivit ilman sijoitusId:ta jaavat pois eika niita arvata nimesta', () => {
  // Ennen erää 20e kirjatuilta riveiltä id puuttuu. Nimellä täsmäys näyttäisi toimivan
  // siihen asti kunnes kaksi kaappia nimetään samoin — ja väärä rivi hävikkiselvityksessä
  // on pahempi kuin puuttuva.
  const vanha = esine({
    historia: [
      rivi({ ts: hetki(2), sijoitusLaji: 'avainkaappi', sijoitusId: null, sijoitusNimi: 'Piiriauto 2 kaappi' }),
      rivi({ ts: hetki(3), sijoitusLaji: 'kohde', sijoitusId: 'kohde-1', sijoitusNimi: 'Hansa' }),
    ],
  });
  assert.deepEqual(sailyttimenTapahtumat([vanha], 'kaappi-1'), []);
});

test('tapahtumat kootaan kaikista esineista yhteen aikajanaan', () => {
  const a = esine({
    id: 'a', tunnus: 'TJ-AVA-0001',
    historia: [kaappiin({ ts: hetki(2) }), rivi({ ts: hetki(3), sijoitusNimi: 'Holvi' })],
  });
  const b = esine({
    id: 'b', tunnus: 'TJ-AVA-0002',
    historia: [kaappiin({ ts: hetki(4) })],
  });
  assert.deepEqual(
    sailyttimenTapahtumat([a, b], 'kaappi-1').map((t) => `${t.tunnus}:${t.suunta}`),
    ['TJ-AVA-0002:saapui', 'TJ-AVA-0001:lahti', 'TJ-AVA-0001:saapui']
  );
});

test('vartijan karsittu aineisto ei kaada laskentaa', () => {
  // Vartijalta historia karsitaan kokonaan (server/kalusto.js: vuoronKalusto), jolloin
  // kenttä on undefined. Tyhjä lista on oikea vastaus eikä virhe.
  assert.deepEqual(sailyttimenTapahtumat([esine({ historia: undefined })], 'kaappi-1'), []);
});
