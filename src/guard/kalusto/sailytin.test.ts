// Säilyttimen historianäkymän testit.
//
// Painopiste on siinä mitä hävikkiselvitys näkisi VÄÄRIN jos kokoaminen menee pieleen:
// lähtö jää näkymättä, sama käynti näkyy kahdesti, tai toisen kaapin tapahtuma päätyy
// tämän kaapin listalle. Kaikki kolme ovat virheitä joita ruudulta ei huomaa.
//
// Ajetaan: node --test src/guard/kalusto/sailytin.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { sailyttimenLahdot } from './sailytin.ts';
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

// Avain: holvi -> kaappi -> kohde. Yksi lähtö kaapista.
const kayntiKaapissa = () => esine({
  historia: [
    rivi({ ts: hetki(1), tapahtuma: 'luotu' }),
    rivi({ ts: hetki(2), sijoitusLaji: 'avainkaappi', sijoitusId: 'kaappi-1', sijoitusNimi: 'Piiriauto 2 kaappi' }),
    rivi({ ts: hetki(3), sijoitusLaji: 'kohde', sijoitusId: 'kohde-1', sijoitusNimi: 'Kauppakeskus Hansa', user: 'esimies' }),
  ],
});

test('lahto tunnistetaan ja se kertoo minne ja kuka', () => {
  const [lahto, ...loput] = sailyttimenLahdot([kayntiKaapissa()], 'kaappi-1');
  assert.equal(loput.length, 0);
  assert.equal(lahto.tunnus, 'TJ-AVA-0001');
  assert.equal(lahto.lahti, hetki(3));
  assert.equal(lahto.minne, 'Kauppakeskus Hansa');
  assert.equal(lahto.minneLaji, 'kohde');
  assert.equal(lahto.kuka, 'esimies');
});

test('kaapissa yha oleva ei ole lahtenyt', () => {
  // Viimeinen paikka on kaappi: esine on siellä nyt, eikä se kuulu lähteneiden listalle.
  // Ilman tätä "Kaapissa nyt" ja "Lähteneet" näyttäisivät saman avaimen molemmissa.
  const yha = esine({
    historia: [
      rivi({ ts: hetki(1), tapahtuma: 'luotu' }),
      rivi({ ts: hetki(2), sijoitusLaji: 'avainkaappi', sijoitusId: 'kaappi-1', sijoitusNimi: 'Kaappi' }),
    ],
  });
  assert.deepEqual(sailyttimenLahdot([yha], 'kaappi-1'), []);
});

test('toisen sailyttimen tapahtumat eivat vuoda listalle', () => {
  assert.deepEqual(sailyttimenLahdot([kayntiKaapissa()], 'kaappi-2'), []);
  assert.deepEqual(sailyttimenLahdot([kayntiKaapissa()], ''), []);
});

test('sama avain voi kayda kaapissa useasti ja jokainen kaynti on oma rivinsa', () => {
  const kahdesti = esine({
    historia: [
      rivi({ ts: hetki(1), tapahtuma: 'luotu' }),
      rivi({ ts: hetki(2), sijoitusLaji: 'avainkaappi', sijoitusId: 'kaappi-1', sijoitusNimi: 'Kaappi' }),
      rivi({ ts: hetki(3), sijoitusLaji: 'kohde', sijoitusId: 'kohde-1', sijoitusNimi: 'Hansa' }),
      rivi({ ts: hetki(4), sijoitusLaji: 'avainkaappi', sijoitusId: 'kaappi-1', sijoitusNimi: 'Kaappi' }),
      rivi({ ts: hetki(5), sijoitusLaji: 'holvi', sijoitusId: null, sijoitusNimi: 'Holvi' }),
    ],
  });
  const lahdot = sailyttimenLahdot([kahdesti], 'kaappi-1');
  assert.equal(lahdot.length, 2);
  // Uusin ensin: hävikkiselvitys katsoo viimeisintä tapahtumaa.
  assert.deepEqual(lahdot.map((l) => l.minne), ['Holvi', 'Hansa']);
});

test('paikattomat merkinnat eivat katkaise ketjua', () => {
  // Muokkaus ja pyyntö eivät kerro paikasta mitään. Jos ne laskettaisiin mukaan,
  // "seuraava sijoitus" olisi tyhjä ja lähtö jäisi joko huomaamatta tai näyttäisi
  // menneen tyhjään paikkaan.
  const valissaMuokkaus = esine({
    historia: [
      rivi({ ts: hetki(2), sijoitusLaji: 'avainkaappi', sijoitusId: 'kaappi-1', sijoitusNimi: 'Kaappi' }),
      rivi({ ts: hetki(3), tapahtuma: 'muokattu', sijoitusLaji: null, sijoitusId: null, sijoitusNimi: '' }),
      rivi({ ts: hetki(4), tapahtuma: 'pyynto', sijoitusLaji: null, sijoitusId: null, sijoitusNimi: '' }),
      rivi({ ts: hetki(5), sijoitusLaji: 'kohde', sijoitusId: 'kohde-1', sijoitusNimi: 'Hansa' }),
    ],
  });
  const [lahto] = sailyttimenLahdot([valissaMuokkaus], 'kaappi-1');
  assert.equal(lahto.minne, 'Hansa');
  assert.equal(lahto.lahti, hetki(5));
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
  assert.deepEqual(sailyttimenLahdot([vanha], 'kaappi-1'), []);
});

test('lahdot kootaan kaikista esineista ja jarjestetaan uusin ensin', () => {
  const a = esine({
    id: 'a', tunnus: 'TJ-AVA-0001',
    historia: [
      rivi({ ts: hetki(2), sijoitusLaji: 'avainkaappi', sijoitusId: 'kaappi-1', sijoitusNimi: 'Kaappi' }),
      rivi({ ts: hetki(3), sijoitusLaji: 'holvi', sijoitusId: null, sijoitusNimi: 'Holvi' }),
    ],
  });
  const b = esine({
    id: 'b', tunnus: 'TJ-AVA-0002',
    historia: [
      rivi({ ts: hetki(4), sijoitusLaji: 'avainkaappi', sijoitusId: 'kaappi-1', sijoitusNimi: 'Kaappi' }),
      rivi({ ts: hetki(6), sijoitusLaji: 'henkilo', sijoitusId: 'emp-1', sijoitusNimi: 'Virtanen' }),
    ],
  });
  assert.deepEqual(
    sailyttimenLahdot([a, b], 'kaappi-1').map((l) => l.tunnus),
    ['TJ-AVA-0002', 'TJ-AVA-0001']
  );
});

test('vartijan karsittu aineisto ei kaada laskentaa', () => {
  // Vartijalta historia karsitaan kokonaan (server/kalusto.js: vuoronKalusto), jolloin
  // kenttä on undefined. Tyhjä lista on oikea vastaus eikä virhe.
  assert.deepEqual(sailyttimenLahdot([esine({ historia: undefined })], 'kaappi-1'), []);
});
