// Sijaintikerroksen testit. Painopiste on siinä mikä menisi hiljaa väärin: kytkin joka
// ei estäkään mitään, kelvoton syöte joka päätyy kartalle, ja vanhentunut sijainti joka
// väittää tietävänsä missä ihminen on.
//
// Ajetaan: npm test  (tai node --test server/)

import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  seurantaKaytossa, paivita, kaikki, unohda, tyhjenna, lueSijainti, VANHENEE,
  saaNahdaSijainteja, saaNahdaSijaintirivin,
} from './sijainti.js';

const alkuperainenLippu = process.env.SIJAINTISEURANTA;
const paalle = () => { process.env.SIJAINTISEURANTA = '1'; };
const pois = () => { delete process.env.SIJAINTISEURANTA; };

beforeEach(() => { tyhjenna(); paalle(); });
after(() => {
  tyhjenna();
  if (alkuperainenLippu === undefined) pois();
  else process.env.SIJAINTISEURANTA = alkuperainenLippu;
});

test('seuranta on pois päältä ilman ympäristömuuttujaa', () => {
  pois();
  assert.equal(seurantaKaytossa(), false);
  // Julkaisueste ei ole vain käyttöliittymän piilotus: kytkin estää myös tallennuksen.
  assert.equal(paivita('vartija', 'fesx', { img: { x: 0.5, y: 0.5 } }), null);
  assert.deepEqual(kaikki(), []);
});

test('kelvollinen kuvakoordinaatti tallentuu ja saa palvelimen aikaleiman', () => {
  const tietue = paivita('vartija', 'fesx', { img: { x: 0.25, y: 0.75 } }, 1_000);
  assert.equal(tietue.username, 'vartija');
  assert.deepEqual(tietue.img, { x: 0.25, y: 0.75 });
  assert.equal(tietue.at, 1_000);
});

test('selaimen antama aikaleima ei kelpaa — palvelin leimaa itse', () => {
  const tietue = paivita('vartija', 'fesx', { img: { x: 0.5, y: 0.5 }, at: 999_999 }, 5_000);
  assert.equal(tietue.at, 5_000);
});

test('kelvoton syöte hylätään', () => {
  assert.equal(paivita('vartija', 'fesx', null), null);
  assert.equal(paivita('vartija', 'fesx', {}), null);
  // Kuvakoordinaatti on osuus 0–1: pikselit tarkoittaisivat kartan ulkopuolta.
  assert.equal(paivita('vartija', 'fesx', { img: { x: 420, y: 130 } }), null);
  assert.equal(paivita('vartija', 'fesx', { img: { x: -0.1, y: 0.5 } }), null);
  assert.equal(paivita('vartija', 'fesx', { gps: { lat: 91, lon: 24 } }), null);
  assert.equal(paivita('', 'fesx', { img: { x: 0.5, y: 0.5 } }), null);
  assert.deepEqual(kaikki(), []);
});

test('pelkkä GPS riittää, samoin pelkkä kuvakoordinaatti', () => {
  assert.ok(paivita('a', 'fesx', { gps: { lat: 61.49, lon: 23.78, tarkkuus: 12 } }));
  assert.ok(paivita('b', 'fesx', { img: { x: 0.1, y: 0.1 } }));
  assert.equal(kaikki().length, 2);
});

test('sama käyttäjä korvaa oman sijaintinsa, ei kerrytä listaa', () => {
  paivita('vartija', 'fesx', { img: { x: 0.1, y: 0.1 } }, 1_000);
  paivita('vartija', 'fesx', { img: { x: 0.9, y: 0.9 } }, 2_000);
  const lista = kaikki({ nyt: 2_000 });
  assert.equal(lista.length, 1);
  assert.deepEqual(lista[0].img, { x: 0.9, y: 0.9 });
});

test('vanhentunut sijainti katoaa eikä jää väittämään paikkaa', () => {
  paivita('vartija', 'fesx', { img: { x: 0.5, y: 0.5 } }, 0);
  assert.equal(kaikki({ nyt: VANHENEE - 1 }).length, 1);
  assert.equal(kaikki({ nyt: VANHENEE + 1 }).length, 0);
  // Poistettu myös muistista, ei vain suodatettu näkyvistä.
  assert.equal(kaikki({ nyt: 0 }).length, 0);
});

test('sijainnin ikä lasketaan mukaan', () => {
  paivita('vartija', 'fesx', { img: { x: 0.5, y: 0.5 } }, 1_000);
  assert.equal(kaikki({ nyt: 241_000 })[0].ikaMs, 240_000);
});

test('toisen tapahtuman sijaintia ei palauteta', () => {
  paivita('a', 'fesx', { img: { x: 0.1, y: 0.1 } });
  paivita('b', 'festb', { img: { x: 0.2, y: 0.2 } });
  assert.deepEqual(kaikki({ eventId: 'fesx' }).map((s) => s.username), ['a']);
});

test('unohda poistaa sijainnin kokonaan', () => {
  paivita('vartija', 'fesx', { img: { x: 0.5, y: 0.5 } });
  assert.equal(unohda('vartija'), true);
  assert.deepEqual(kaikki(), []);
});

test('lueSijainti karsii ylimääräiset kentät', () => {
  const s = lueSijainti({ img: { x: 0.5, y: 0.5, salaisuus: 'x' }, muu: 1 });
  assert.deepEqual(s, { img: { x: 0.5, y: 0.5 }, gps: null, lahde: 'selain' });
});

test('nopeus ja suunta tulevat mukaan GPS:n kanssa', () => {
  const s = lueSijainti({ gps: { lat: 60.17, lon: 24.94, tarkkuus: 12, nopeus: 14.2, suunta: 271 } });
  assert.equal(s.gps.nopeus, 14.2);
  assert.equal(s.gps.suunta, 271);
});

test('mahdoton nopeus hylätään mutta sijainti kelpaa', () => {
  // 200 m/s = 720 km/h. Piste on yhä käyttökelpoinen, nuoli ei olisi — ja koko rivin
  // hylkääminen yhden kentän takia poistaisi yksikön kartalta kokonaan.
  const s = lueSijainti({ gps: { lat: 60.17, lon: 24.94, nopeus: 200, suunta: 400 } });
  assert.equal(s.gps.lat, 60.17);
  assert.equal(s.gps.nopeus, null);
  assert.equal(s.gps.suunta, null);
});

test('lähde on selain ellei lähettäjä sano muuta', () => {
  assert.equal(lueSijainti({ gps: { lat: 60, lon: 24 } }).lahde, 'selain');
  assert.equal(lueSijainti({ gps: { lat: 60, lon: 24 }, lahde: 'laite' }).lahde, 'laite');
  // Tuntematon arvo ei saa mennä läpi sellaisenaan: käyttöliittymä valitsee sen
  // perusteella selitetekstin, ja kolmas arvo jäisi näyttämättä kokonaan.
  assert.equal(lueSijainti({ gps: { lat: 60, lon: 24 }, lahde: 'roskaa' }).lahde, 'selain');
});

// --- Näkyvyys ---------------------------------------------------------------------
//
// Nämä testit ovat olemassa siksi, että edellinen versio läpäisi käsitestin: se tehtiin
// pääkäyttäjänä, ja admin ohittaa koko tarkistuksen. Jokainen testi alla ajetaan siis
// EI-ADMIN-tunnuksella, ja adminille on vain yksi oma testi.

const kysyja = (osat = {}) => ({
  role: 'guard',
  eventAccess: [],
  permissions: { __default__: {} },
  ...osat,
});

const solmu = (nimi) => ({ __default__: { [nimi]: { view: true } } });

test('admin näkee jokaisen rivin ilman erillisiä oikeuksia', () => {
  const a = kysyja({ role: 'admin', eventAccess: ['vain-tama'] });
  assert.equal(saaNahdaSijainteja(a), true);
  assert.equal(saaNahdaSijaintirivin(a, { eventId: 'toinen-kohde' }), true);
  assert.equal(saaNahdaSijaintirivin(a, { eventId: null }), true);
});

test('ilman kumpaakaan solmua ei ole sijaintioikeutta lainkaan', () => {
  // Tämä erottaa 403:n tyhjästä listasta: ilman tätä valvomon ruudulla "ei oikeutta" ja
  // "kukaan ei ole kentällä" näyttäisivät samalta.
  assert.equal(saaNahdaSijainteja(kysyja()), false);
});

test('guard_locations riittää sijaintioikeudeksi ilman kohdetta', () => {
  assert.equal(saaNahdaSijainteja(kysyja({ permissions: solmu('guard_locations') })), true);
});

test('locations riittää myös — tapahtumapuoli toimii ennallaan', () => {
  assert.equal(saaNahdaSijainteja(kysyja({ permissions: solmu('locations') })), true);
});

test('rajattu eventAccess näkee oman kohteensa rivin', () => {
  const k = kysyja({ eventAccess: ['kohde-a'], permissions: solmu('guard_locations') });
  assert.equal(saaNahdaSijaintirivin(k, { eventId: 'kohde-a' }), true);
});

test('rajattu eventAccess EI näe toisen kohteen riviä', () => {
  const k = kysyja({ eventAccess: ['kohde-a'], permissions: solmu('guard_locations') });
  assert.equal(saaNahdaSijaintirivin(k, { eventId: 'kohde-b' }), false);
});

test('kohteeton rivi (piirivuoro) näkyy guard_locations-oikeudella vaikka eventAccess on rajattu', () => {
  // TÄMÄ ON SE KORJAUS. Ennen eventAllowed(['kohde-a'], null) palautti false, joten
  // piirivartija ei näkynyt kenellekään muulle kuin adminille tai rajaamattomalle
  // tunnukselle — eikä vika näkynyt mistään, koska tyhjä lista näytti odotetulta.
  const k = kysyja({ eventAccess: ['kohde-a'], permissions: solmu('guard_locations') });
  assert.equal(saaNahdaSijaintirivin(k, { eventId: null }), true);
});

test('kohteeton rivi EI näy pelkällä tapahtumapuolen locations-oikeudella', () => {
  // Piirivuoro on GUARD-puolen käsite. Tapahtuman katselija ei saa nähdä
  // vartiointiliikkeen partioita sillä perusteella että hän näkee oman tapahtumansa
  // henkilöstön.
  const k = kysyja({ permissions: solmu('locations') });
  assert.equal(saaNahdaSijaintirivin(k, { eventId: null }), false);
});

test('rajaamaton eventAccess näkee kaikkien kohteiden rivit', () => {
  const k = kysyja({ eventAccess: [], permissions: solmu('guard_locations') });
  assert.equal(saaNahdaSijaintirivin(k, { eventId: 'mika-tahansa' }), true);
});
