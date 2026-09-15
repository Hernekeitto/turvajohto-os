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
  kuittausAsetukset, KUITTAUS_MIN_MIN, KUITTAUS_MAX_MIN, KUITTAUS_OLETUS_MIN,
  KUITTAUS_VASTAUSAIKA_MIN,
  luoAjastin, luoHalytys, jatka, laukaise, peru, kuittaa,
  eraantyneet, eskaloitavat, merkitseEskaloitu, viestiTeksti,
  puhdistaGps, onAvoin, TYYPIT, AJASTIN_MAX_MIN, AJASTIN_MIN_MIN, VIESTIN_MAX,
  SIJAINTISAANNOT, kerataankoSijainti, TYYPPI_IDT,
  siivoaVyohykeSijainnit, GEOFENCE_SAILYTYS_VRK,
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
  const oletus = { paalla: false, liikkumatonMin: MANDOWN_OLETUS_MIN };
  assert.deepEqual(mandownAsetukset({ id: 'k1' }), oletus);
  assert.deepEqual(mandownAsetukset(null), oletus);
  assert.deepEqual(mandownAsetukset(undefined), oletus);
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
  assert.equal(min(45), 45);
  // Nolla tarkoittaisi hälytystä jokaisesta sekunnista jonka puhelin makaa taskussa.
  assert.equal(min(0), MANDOWN_MIN_MIN);
  assert.equal(min(-5), MANDOWN_MIN_MIN);
  // Ilman ylärajaa hälytystä ei tulisi koskaan.
  assert.equal(min(10_000), MANDOWN_MAX_MIN);
  assert.equal(min(44.4), 44);
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
  assert.equal(mandownAsetukset({ mandown: { paalla: false, liikkumatonMin: 45 } }).liikkumatonMin, 45);
});

test('vanha viiden minuutin arvo nostetaan alarajaan', () => {
  // Alaraja nousi 5 -> 30 minuuttiin 13.9.2026 kenttämittauksen jälkeen (ks.
  // server/halytys.js). Tämä testi on nimenomaan siitä muutoksesta: jo tallennettu 5 EI
  // jää voimaan, vaan se luetaan 30:ksi. Jos tämä joskus kaatuu siihen että arvo on taas
  // 5, joku on palauttanut liian tiheän kyselyn huomaamattaan.
  assert.equal(
    mandownAsetukset({ mandown: { paalla: true, liikkumatonMin: 5 } }).liikkumatonMin, 30);
});

test('man-downin rajat ovat keskenaan mielekkaat', () => {
  // Oletus ei saa olla rajojen ulkopuolella. Sama vartioina kuin kuittausvälillä, joka
  // kerran päästi läpi 240 + 2 > 240.
  assert.ok(MANDOWN_MIN_MIN <= MANDOWN_OLETUS_MIN);
  assert.ok(MANDOWN_OLETUS_MIN <= MANDOWN_MAX_MIN);
});

// --- Vuoron automaattinen kuittausväli ------------------------------------------------

test('kohde ilman asetusta: kuittausvali on pois paalta', () => {
  const oletus = { paalla: false, valiMin: KUITTAUS_OLETUS_MIN, vastausaikaMin: KUITTAUS_VASTAUSAIKA_MIN };
  assert.deepEqual(kuittausAsetukset({ id: 'k1' }), oletus);
  assert.deepEqual(kuittausAsetukset(null), oletus);
});

test('kuittausvali pysyy rajoissa', () => {
  const v = (m) => kuittausAsetukset({ kuittaus: { paalla: true, valiMin: m } }).valiMin;
  assert.equal(v(60), 60);
  // Alaraja on 15 min eika ajastimen oma minuutti: neljan minuutin valein kysyva
  // automaatti ei ole valvontaa vaan hairio.
  assert.equal(v(4), KUITTAUS_MIN_MIN);
  assert.equal(v(0), KUITTAUS_MIN_MIN);
  assert.equal(v(999), KUITTAUS_MAX_MIN);
  assert.equal(v('tunti'), KUITTAUS_OLETUS_MIN);
});

test('paalla vaatii tasan tosiarvon myos kuittauksessa', () => {
  assert.equal(kuittausAsetukset({ kuittaus: { paalla: true } }).paalla, true);
  assert.equal(kuittausAsetukset({ kuittaus: { paalla: '1' } }).paalla, false);
});

test('ajastimen kesto mahtuu ajastimen omiin rajoihin kuittausvalin ylarajalla', () => {
  // Sovellus luo ajastimen kestolla vali + vastausaika. Jos summa ylittaisi
  // AJASTIN_MAX_MIN:n, ajastimen luonti epaonnistuisi 400:lla juuri siina kohteessa
  // jossa valvontavali on pisin - eli kuittausvalvonta katoaisi hiljaa.
  assert.ok(KUITTAUS_MAX_MIN + KUITTAUS_VASTAUSAIKA_MIN <= AJASTIN_MAX_MIN,
    `kuittausvalin ylaraja ${KUITTAUS_MAX_MIN} + vastausaika ${KUITTAUS_VASTAUSAIKA_MIN} ei mahdu ajastimeen ${AJASTIN_MAX_MIN}`);
  assert.ok(KUITTAUS_MIN_MIN + KUITTAUS_VASTAUSAIKA_MIN >= AJASTIN_MIN_MIN);
});

// --- Sijainti hälytyslajeittain (käyttäjän päätös 15.9.2026) ------------------------

test('varustepoikkeama ei tallenna sijaintia lainkaan', () => {
  // MINIMOINTI LÄHTEELLÄ eikä säilytysaika: koordinaatti ei päädy levylle, joten sitä ei
  // tarvitse myöhemmin poistaa eikä sen säilymistä valvoa. Poistettava tieto on aina
  // tieto jonka poisto voi unohtua.
  const tulos = luoHalytys({
    id: 'h1', tyyppi: 'varuste', vartija: 'matti', eventId: 'kohde-a',
    kuvaus: 'Radiopuhelin rikki', gps: { lat: 60.17, lon: 24.94, tarkkuus: 10 },
  });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.halytys.gps, null);
});

test('hätäpainike, man-down ja vyöhykepoikkeama tallentavat sijainnin', () => {
  for (const tyyppi of ['panic', 'mandown', 'geofence']) {
    const tulos = luoHalytys({
      id: `h-${tyyppi}`, tyyppi, vartija: 'matti', eventId: 'kohde-a',
      gps: { lat: 60.17, lon: 24.94, tarkkuus: 10 },
      ...(tyyppi === 'geofence' ? { vyohyke: { id: 'v1', nimi: 'Piha' } } : {}),
    });
    assert.equal(tulos.ok, true, tyyppi);
    assert.equal(tulos.halytys.gps?.lat, 60.17, tyyppi);
  }
});

test('sijaintisäännöt kattavat jokaisen hälytyslajin', () => {
  // Uusi laji ilman sääntöä jäisi oletuksena keräämättä sijaintia — turvallinen oletus,
  // mutta hiljainen. Tämä testi pakottaa päättämään.
  for (const tyyppi of TYYPPI_IDT) {
    assert.ok(SIJAINTISAANNOT[tyyppi], `sijaintisääntö puuttuu lajilta ${tyyppi}`);
  }
});

test('sijaintia keräävällä lajilla on säilytysaika ja keräämättömällä ei', () => {
  for (const [tyyppi, saanto] of Object.entries(SIJAINTISAANNOT)) {
    if (saanto.kerataan) {
      assert.ok(saanto.sailytys, `säilytysaika puuttuu lajilta ${tyyppi}`);
    } else {
      assert.equal(saanto.sailytys, null, `keräämätön laji ${tyyppi} ei tarvitse säilytysaikaa`);
    }
  }
});

test('tuntematon laji ei kerää sijaintia', () => {
  assert.equal(kerataankoSijainti('jokinMuu'), false);
  assert.equal(kerataankoSijainti(undefined), false);
});

// --- Vyöhykepoikkeaman sijainnin säilytysaika ---------------------------------------

const PAIVA = 24 * 60 * 60 * 1000;
const NYT_T = Date.parse('2026-09-15T12:00:00.000Z');
const gh = (osat) => ({
  id: 'g1', tyyppi: 'geofence', vartija: 'matti', alkoi: new Date(NYT_T).toISOString(),
  gps: { lat: 60.17, lon: 24.94, tarkkuus: 10 }, ...osat,
});

test('tuore vyöhykepoikkeama säilyttää sijaintinsa', () => {
  const { halytykset, poistettu } = siivoaVyohykeSijainnit([gh({})], NYT_T);
  assert.equal(poistettu, 0);
  assert.equal(halytykset[0].gps.lat, 60.17);
});

test('säilytysajan ylittänyt vyöhykepoikkeama menettää sijaintinsa', () => {
  const vanha = gh({ alkoi: new Date(NYT_T - (GEOFENCE_SAILYTYS_VRK + 1) * PAIVA).toISOString() });
  const { halytykset, poistettu } = siivoaVyohykeSijainnit([vanha], NYT_T);
  assert.equal(poistettu, 1);
  assert.equal(halytykset[0].gps, null);
});

test('sijainti poistuu mutta hälytys jää', () => {
  // Hälytystietueella on arvoa tapahtumana senkin jälkeen kun koordinaatti on poistettu:
  // kuka, milloin, mikä vyöhyke. Arka osa on sijainti, ei se että poikkeama tapahtui.
  const vanha = gh({
    alkoi: new Date(NYT_T - 100 * PAIVA).toISOString(),
    vyohyke: { id: 'v1', nimi: 'Piha', saanto: 'poistuminen' },
  });
  const { halytykset } = siivoaVyohykeSijainnit([vanha], NYT_T);
  assert.equal(halytykset[0].id, 'g1');
  assert.equal(halytykset[0].vartija, 'matti');
  assert.equal(halytykset[0].vyohyke.nimi, 'Piha');
  assert.equal(halytykset[0].gps, null);
});

test('muiden lajien sijaintiin ei kosketa', () => {
  // panic, mandown ja ajastin noudattavat LYTP-aikaa eivätkä tätä siivousta.
  const vanhaPanic = {
    id: 'p1', tyyppi: 'panic', vartija: 'matti',
    alkoi: new Date(NYT_T - 500 * PAIVA).toISOString(),
    gps: { lat: 60.17, lon: 24.94, tarkkuus: 10 },
  };
  const { halytykset, poistettu } = siivoaVyohykeSijainnit([vanhaPanic], NYT_T);
  assert.equal(poistettu, 0);
  assert.equal(halytykset[0].gps.lat, 60.17);
});

test('sijainniton vyöhykepoikkeama ei kasvata laskuria', () => {
  const vanha = gh({ alkoi: new Date(NYT_T - 100 * PAIVA).toISOString(), gps: null });
  assert.equal(siivoaVyohykeSijainnit([vanha], NYT_T).poistettu, 0);
});

test('kelvoton aikaleima tulkitaan vanhaksi', () => {
  // Sijaintia jonka ikää ei voi todeta ei voi myöskään todeta säilytysajan sisällä
  // olevaksi.
  const rikki = gh({ alkoi: 'ei ole aika' });
  assert.equal(siivoaVyohykeSijainnit([rikki], NYT_T).poistettu, 1);
});
