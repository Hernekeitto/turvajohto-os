// Hälytysten sääntöjen testit.
//
// Nämä testaavat kahta asiaa joita ei voi todeta katsomalla: että hälytys EI voi kadota
// (tila ei palaa taaksepäin, eskalointi ei jää tekemättä) ja että se EI kerry
// tarpeettomaksi (sama hälytys ei lähetä viestiä joka kierroksella).
//
// Ajetaan: node --test server/halytys.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mandownAsetukset, MANDOWN_MIN_MIN, MANDOWN_MAX_MIN, MANDOWN_OLETUS_MIN,
  luoAjastin, luoHalytys, jatka, laukaise, peru, kuittaa,
  eraantyneet, eskaloitavat, merkitseEskaloitu, viestiTeksti,
  puhdistaGps, onAvoin, TYYPIT, AJASTIN_MAX_MIN, VIESTIN_MAX,
} from './halytys.js';

const T0 = Date.parse('2026-09-03T22:00:00Z');

const ajastin = (yli = {}) => luoAjastin({
  id: 'h1', vartija: 'vartija1', eventId: 'kohde-1', minuutit: 30,
  kuvaus: 'Tarkastan kellarin', nyt: T0, ...yli,
}).halytys;

const panic = (yli = {}) => luoHalytys({
  id: 'h2', tyyppi: 'panic', vartija: 'vartija1', eventId: 'kohde-1', nyt: T0, ...yli,
}).halytys;

// --- Luonti -----------------------------------------------------------------------

test('ajastin syntyy käynnissä olevana ja määräaika lasketaan kestosta', () => {
  const h = ajastin();
  assert.equal(h.tila, 'kaynnissa');
  assert.equal(h.eraantyy, T0 + 30 * 60000);
  assert.equal(h.laukesi, null);
  assert.equal(h.kuvaus, 'Tarkastan kellarin');
});

test('kelvoton kesto torjutaan', () => {
  for (const minuutit of [0, -5, 1.5, AJASTIN_MAX_MIN + 1, 'kolme', null]) {
    const tulos = luoAjastin({ id: 'x', vartija: 'v', minuutit, nyt: T0 });
    assert.equal(tulos.ok, false, `kesto ${minuutit} olisi pitänyt torjua`);
  }
});

test('vartijaton hälytys torjutaan', () => {
  assert.equal(luoAjastin({ id: 'x', vartija: '', minuutit: 30 }).ok, false);
  assert.equal(luoHalytys({ id: 'x', tyyppi: 'panic', vartija: null }).ok, false);
});

test('muut tyypit syntyvät suoraan lauenneina', () => {
  const h = panic();
  assert.equal(h.tila, 'lauennut');
  assert.equal(h.laukesi, new Date(T0).toISOString());
  assert.equal(h.eraantyy, null);
});

test('ajastinta ei voi luoda luoHalytyksellä eikä tuntematonta tyyppiä lainkaan', () => {
  assert.equal(luoHalytys({ id: 'x', tyyppi: 'ajastin', vartija: 'v' }).ok, false);
  assert.equal(luoHalytys({ id: 'x', tyyppi: 'tuntematon', vartija: 'v' }).ok, false);
});

test('kelvoton sijainti hylätään mutta ei kaada hälytystä', () => {
  assert.equal(puhdistaGps({ lat: 200, lon: 20 }), null);
  assert.equal(puhdistaGps(null), null);
  assert.deepEqual(puhdistaGps({ lat: 61.5, lon: 23.7, tarkkuus: 12 }), { lat: 61.5, lon: 23.7, tarkkuus: 12 });
  const h = panic({ gps: { lat: 'roska', lon: 23.7 } });
  assert.equal(h.gps, null);
  assert.equal(h.tila, 'lauennut');
});

// --- Elinkaari --------------------------------------------------------------------

test('jatkaminen laskee uuden määräajan kuittaushetkestä eikä vanhasta määräajasta', () => {
  const h = ajastin();
  // Kuittaus tulee 25 minuuttia myöhässä alkuperäisestä hetkestä.
  const nyt = T0 + 25 * 60000;
  const tulos = jatka({ halytys: h, minuutit: 30, user: 'vartija1', nyt });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.halytys.eraantyy, nyt + 30 * 60000);
});

test('jatkaminen ilman kestoa käyttää edellistä kestoa', () => {
  const h = ajastin();
  const tulos = jatka({ halytys: h, user: 'vartija1', nyt: T0 + 60000 });
  assert.equal(tulos.halytys.kestoMin, 30);
  assert.equal(tulos.halytys.eraantyy, T0 + 60000 + 30 * 60000);
});

test('lauennutta hälytystä ei voi jatkaa eikä perua', () => {
  const lauennut = laukaise({ halytys: ajastin(), nyt: T0 + 60000 }).halytys;
  assert.equal(jatka({ halytys: lauennut, minuutit: 30 }).ok, false);
  assert.equal(peru({ halytys: lauennut, user: 'x' }).ok, false);
});

test('laukeaminen onnistuu vain käynnissä olevalle', () => {
  const h = ajastin();
  const eka = laukaise({ halytys: h, nyt: T0 + 60000 });
  assert.equal(eka.ok, true);
  assert.equal(eka.halytys.tila, 'lauennut');
  // Toinen laukaisu samalle hälytykselle ei saa onnistua: se ylikirjoittaisi
  // laukeamishetken ja tekisi historiasta valheellisen.
  assert.equal(laukaise({ halytys: eka.halytys }).ok, false);
});

test('kuittaus onnistuu vain lauenneelle ja päättää hälytyksen', () => {
  const h = ajastin();
  assert.equal(kuittaa({ halytys: h, user: 'tike' }).ok, false);
  const lauennut = laukaise({ halytys: h, nyt: T0 + 60000 }).halytys;
  const kuitattu = kuittaa({ halytys: lauennut, user: 'tike', huomio: 'Soitin, kaikki hyvin', nyt: T0 + 120000 }).halytys;
  assert.equal(kuitattu.tila, 'kuitattu');
  assert.equal(kuitattu.kuittaaja, 'tike');
  assert.equal(kuitattu.kuittausHuomio, 'Soitin, kaikki hyvin');
  assert.equal(onAvoin(kuitattu), false);
  // Kuitattua ei kuitata toiseen kertaan.
  assert.equal(kuittaa({ halytys: kuitattu, user: 'tike2' }).ok, false);
});

test('vartija saa kuitata oman hälytyksensä ja se näkyy historiassa', () => {
  const lauennut = laukaise({ halytys: ajastin(), nyt: T0 + 60000 }).halytys;
  const itse = kuittaa({ halytys: lauennut, user: 'vartija1', nyt: T0 + 90000 }).halytys;
  const valvomo = kuittaa({ halytys: lauennut, user: 'tike', nyt: T0 + 90000 }).halytys;
  assert.match(itse.historia.at(-1).teksti, /itse/i);
  assert.match(valvomo.historia.at(-1).teksti, /valvomo/i);
});

test('peruminen päättää ajastimen laukaisematta sitä', () => {
  const peruttu = peru({ halytys: ajastin(), user: 'vartija1', nyt: T0 + 60000 }).halytys;
  assert.equal(peruttu.tila, 'peruttu');
  assert.equal(peruttu.laukesi, null);
});

test('tilasiirtymä ei muuta alkuperäistä tietuetta', () => {
  const h = ajastin();
  const kopio = JSON.parse(JSON.stringify(h));
  laukaise({ halytys: h, nyt: T0 + 60000 });
  jatka({ halytys: h, minuutit: 10, nyt: T0 + 60000 });
  assert.deepEqual(h, kopio);
});

// --- Erääntyminen -----------------------------------------------------------------

test('erääntyneiksi kelpaavat vain käynnissä olevat ajastimet joiden aika on täynnä', () => {
  const kesken = ajastin({ id: 'a', minuutit: 30 });
  const kypsa = ajastin({ id: 'b', minuutit: 5 });
  const jo = laukaise({ halytys: ajastin({ id: 'c', minuutit: 1 }), nyt: T0 }).halytys;
  const lista = [kesken, kypsa, jo, panic()];
  const nyt = T0 + 10 * 60000;
  assert.deepEqual(eraantyneet(lista, nyt).map((h) => h.id), ['b']);
});

test('täsmälleen määräajan hetkellä ajastin erääntyy', () => {
  const h = ajastin({ minuutit: 10 });
  assert.equal(eraantyneet([h], T0 + 10 * 60000 - 1).length, 0);
  assert.equal(eraantyneet([h], T0 + 10 * 60000).length, 1);
});

// --- Eskalointi -------------------------------------------------------------------

test('hätäpainike eskaloituu heti, ajastin vasta viiveen jälkeen', () => {
  const p = panic();
  assert.equal(eskaloitavat([p], T0).length, 1);

  const a = laukaise({ halytys: ajastin(), nyt: T0 }).halytys;
  assert.equal(eskaloitavat([a], T0 + 60000).length, 0);
  assert.equal(eskaloitavat([a], T0 + TYYPIT.ajastin.eskalointiViiveMs).length, 1);
});

test('vyöhykepoikkeama ei eskaloidu koskaan', () => {
  const g = luoHalytys({
    id: 'g1', tyyppi: 'geofence', vartija: 'vartija1', nyt: T0,
    vyohyke: { id: 'vy1', nimi: 'Konesali', saanto: 'saapuminen' },
  }).halytys;
  assert.equal(eskaloitavat([g], T0 + 60 * 60000).length, 0);
});

test('kuitattua ei eskaloida', () => {
  const kuitattu = kuittaa({ halytys: panic(), user: 'tike', nyt: T0 }).halytys;
  assert.equal(eskaloitavat([kuitattu], T0 + 60000).length, 0);
});

test('jo eskaloitua ei eskaloida uudelleen — ei myöskään epäonnistunutta', () => {
  const p = panic();
  const onnistui = merkitseEskaloitu({ halytys: p, tulos: { ok: true, sendId: 's1', vastaanottajia: 3 }, nyt: T0 });
  assert.equal(eskaloitavat([onnistui], T0 + 60000).length, 0);
  assert.equal(onnistui.eskalointi.tila, 'lahetetty');

  const epaonnistui = merkitseEskaloitu({ halytys: p, tulos: { ok: false, virhe: 'BulkSMS ei vastaa' }, nyt: T0 });
  assert.equal(eskaloitavat([epaonnistui], T0 + 60 * 60000).length, 0);
  assert.equal(epaonnistui.eskalointi.tila, 'epaonnistui');
  assert.equal(epaonnistui.eskalointi.virhe, 'BulkSMS ei vastaa');
});

test('kuivaharjoittelu merkitään omaksi tilakseen', () => {
  const h = merkitseEskaloitu({ halytys: panic(), tulos: { ok: true, dryRun: true, vastaanottajia: 2 }, nyt: T0 });
  assert.equal(h.eskalointi.tila, 'kuivaharjoittelu');
});

// --- Viestin runko ----------------------------------------------------------------

test('viesti mahtuu yhteen osaan ja on ilman ääkkösiä', () => {
  const h = luoHalytys({
    id: 'h', tyyppi: 'mandown', vartija: 'Mäkelä Väinö', nyt: T0,
    kuvaus: 'Yökierros pääportilla',
    gps: { lat: 61.49411, lon: 23.76512 },
  }).halytys;
  const viesti = viestiTeksti(h, { kohteenNimi: 'Kohde Ääkkönen', nyt: T0 });
  assert.ok(viesti.length <= VIESTIN_MAX, `viesti oli ${viesti.length} merkkiä`);
  assert.equal(/[^ -~]/.test(viesti), false, `viestissä oli ei-ASCII-merkki: ${viesti}`);
  assert.match(viesti, /Makela Vaino/);
  assert.match(viesti, /61\.49411/);
});

test('pitkä kuvaus katkaistaan eikä viesti veny usean osan mittaiseksi', () => {
  const h = panic({ kuvaus: 'x'.repeat(200) });
  const viesti = viestiTeksti(h, { kohteenNimi: 'Pitkänimisen tapahtuman nimi tähän', nyt: T0 });
  assert.ok(viesti.length <= VIESTIN_MAX, `viesti oli ${viesti.length} merkkiä`);
});

// --- Man-downin kohdekohtainen asetus -------------------------------------------------
//
// Asetus siirtyi selaimen localStoragesta kohteen tietueeseen 12.9.2026. Tietue tulee
// asiakkaan kirjoittamana eikä sitä validoida kirjoitushetkellä, joten lukeminen on se
// kohta jossa roska on torjuttava — ja juuri siksi nämä testit ovat enimmäkseen roskaa.

test('kohde ilman asetusta: man-down on pois paalta', () => {
  // Oletus on pois päältä eikä päälle. Hiljainen käyttöönotto jokaisessa olemassa
  // olevassa kohteessa tarkoittaisi yöllisiä kyselyitä ilman että kukaan on niin
  // päättänyt. Ks. mandownAsetukset.
  assert.deepEqual(mandownAsetukset({ id: 'k1' }), { paalla: false, liikkumatonMin: 5 });
  assert.deepEqual(mandownAsetukset(null), { paalla: false, liikkumatonMin: 5 });
  assert.deepEqual(mandownAsetukset(undefined), { paalla: false, liikkumatonMin: 5 });
});

test('paalla vaatii tasan tosiarvon', () => {
  // Ei totuusarvoista tulkintaa: merkkijono '1' tai luku 1 tarkoittaisi, että
  // turvallisuustoiminto kytkeytyy päälle tietueen kirjoitusvirheestä.
  assert.equal(mandownAsetukset({ mandown: { paalla: true } }).paalla, true);
  assert.equal(mandownAsetukset({ mandown: { paalla: 'kylla' } }).paalla, false);
  assert.equal(mandownAsetukset({ mandown: { paalla: 1 } }).paalla, false);
  assert.equal(mandownAsetukset({ mandown: { paalla: false } }).paalla, false);
});

test('liikkumattomuusraja pysyy rajoissa', () => {
  const min = (m) => mandownAsetukset({ mandown: { paalla: true, liikkumatonMin: m } }).liikkumatonMin;
  assert.equal(min(20), 20);
  // Nolla tarkoittaisi hälytystä jokaisesta sekunnista jonka puhelin makaa taskussa.
  assert.equal(min(0), MANDOWN_MIN_MIN);
  assert.equal(min(-5), MANDOWN_MIN_MIN);
  // Ilman ylärajaa hälytystä ei tulisi koskaan.
  assert.equal(min(10_000), MANDOWN_MAX_MIN);
  assert.equal(min(7.4), 7);
});

test('kelvoton raja putoaa oletukseen eika kaada', () => {
  const min = (m) => mandownAsetukset({ mandown: { paalla: true, liikkumatonMin: m } }).liikkumatonMin;
  assert.equal(min('viisitoista'), MANDOWN_OLETUS_MIN);
  assert.equal(min(null), MANDOWN_OLETUS_MIN);
  assert.equal(min(NaN), MANDOWN_OLETUS_MIN);
  assert.equal(min(Infinity), MANDOWN_OLETUS_MIN);
  assert.equal(mandownAsetukset({ mandown: 'roskaa' }).liikkumatonMin, MANDOWN_OLETUS_MIN);
});

test('raja palautuu myos kun man-down on pois paalta', () => {
  // Arvon on oltava mielekäs silloinkin kun sitä ei käytetä: käyttöliittymä näyttää
  // liukusäätimen myös pois päältä olevalle kohteelle, eikä siinä saa lukea NaN.
  assert.equal(mandownAsetukset({ mandown: { paalla: false, liikkumatonMin: 12 } }).liikkumatonMin, 12);
});
