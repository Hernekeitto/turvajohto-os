// Sijaintikerroksen testit. Painopiste on siinä mikä menisi hiljaa väärin: kytkin joka
// ei estäkään mitään, kelvoton syöte joka päätyy kartalle, ja vanhentunut sijainti joka
// väittää tietävänsä missä ihminen on.
//
// Ajetaan: npm test  (tai node --test server/)

import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  seurantaKaytossa, paivita, kaikki, unohda, tyhjenna, lueSijainti, VANHENEE,
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
  assert.deepEqual(s, { img: { x: 0.5, y: 0.5 }, gps: null });
});
