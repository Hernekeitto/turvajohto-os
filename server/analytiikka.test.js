// Analytiikan laskennan testit (erä 9).
//
// Painopiste on siinä mitä luku EI saa väittää: tyhjä joukko ei ole nolla vasteaika,
// aikaleimaton kirjaus ei katoa hiljaa, ja yksi poikkeuksellisen hidas tapaus ei saa
// siirtää tyypillistä lukua. Nämä ovat mittariston koko arvo — väärä luku on pahempi
// kuin puuttuva, koska sen mukaan tehdään päätöksiä.
//
// Ajetaan: node --test server/analytiikka.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  luontiaika, aikaMs, teeIkkuna, osuu, tunnusluvut, jakauma, paikallinenTunti,
  kirjaustenKooste, vasteajat, kierrostenKooste, halytystenKooste, kooste,
} from './analytiikka.js';

const MIN = 60 * 1000;

// --- Aikaleimat --------------------------------------------------------------------

test('luontiaika lukee createdAt:in, luodun ja viimeisenä päivän ja kellonajan', () => {
  assert.equal(luontiaika({ createdAt: '2026-09-03T10:00:00.000Z' }), Date.parse('2026-09-03T10:00:00.000Z'));
  assert.equal(luontiaika({ luotu: '2026-09-03T10:00:00.000Z' }), Date.parse('2026-09-03T10:00:00.000Z'));
  // createdAt voittaa: se on kirjauksen syntyhetki, date+time on kirjaajan ilmoittama
  // tapahtuma-aika.
  assert.equal(
    luontiaika({ createdAt: '2026-09-03T10:00:00.000Z', date: '2020-01-01', time: '00:00' }),
    Date.parse('2026-09-03T10:00:00.000Z'),
  );
});

test('kellonaika luetaan sekä kaksoispisteellä että pisteellä ja tulkitaan Suomen aikana', () => {
  // Kesäaika: 19.06 Suomen aikaa on 16:06 UTC.
  assert.equal(luontiaika({ date: '2026-09-03', time: '19.06' }), Date.parse('2026-09-03T16:06:00.000Z'));
  assert.equal(luontiaika({ date: '2026-09-03', time: '14:10' }), Date.parse('2026-09-03T11:10:00.000Z'));
  // Talviaika: siirtymä on kaksi tuntia, ei kolme. Kovakoodattu siirtymä näyttäisi
  // talvella jokaisen kirjauksen tunnin väärässä kohdassa.
  assert.equal(luontiaika({ date: '2026-01-15', time: '12:00' }), Date.parse('2026-01-15T10:00:00.000Z'));
});

test('lukukelvoton aikaleima on tuntematon eikä vuoden 1970 alku', () => {
  assert.equal(aikaMs(''), null);
  assert.equal(aikaMs('eilen'), null);
  assert.equal(aikaMs(null), null);
  assert.equal(luontiaika({}), null);
  assert.equal(luontiaika({ date: '2026-09-03', time: '99:99' }), null);
});

test('tuntijakauma käyttää Suomen aikaa eikä UTC:tä', () => {
  // Kesällä 23:30 UTC on jo seuraavan päivän kello 2 Suomessa.
  assert.equal(paikallinenTunti(Date.parse('2026-07-01T23:30:00.000Z')), 2);
});

// --- Ikkuna ------------------------------------------------------------------------

test('ikkuna on puoliavoin: loppuhetki kuuluu jo seuraavaan jaksoon', () => {
  const i = teeIkkuna({ alku: '2026-09-01T00:00:00.000Z', loppu: '2026-09-02T00:00:00.000Z' });
  assert.equal(osuu(Date.parse('2026-09-01T00:00:00.000Z'), i), true);
  assert.equal(osuu(Date.parse('2026-09-02T00:00:00.000Z'), i), false);
  assert.equal(osuu(Date.parse('2026-08-31T23:59:59.000Z'), i), false);
});

test('nurinkurinen ikkuna hylätään, avoin pää sallitaan', () => {
  assert.equal(teeIkkuna({ alku: '2026-09-02T00:00:00.000Z', loppu: '2026-09-01T00:00:00.000Z' }), null);
  assert.equal(teeIkkuna({ alku: '2026-09-01T00:00:00.000Z' }).loppuMs, null);
  assert.equal(osuu(Date.parse('2030-01-01T00:00:00.000Z'), teeIkkuna({ alku: '2026-09-01T00:00:00.000Z' })), true);
  // Ikkunaton laskenta ottaa kaiken mukaan, mutta aikaleimaton ei silti kelpaa.
  assert.equal(osuu(null, null), false);
});

// --- Tunnusluvut -------------------------------------------------------------------

test('tyhjä joukko on null eikä nolla', () => {
  assert.equal(tunnusluvut([]), null);
  assert.equal(tunnusluvut(['roska', null, undefined]), null);
});

test('mediaani ei liiku yhdestä poikkeuksellisen hitaasta tapauksesta, keskiarvo liikkuisi', () => {
  const kestot = [2 * MIN, 3 * MIN, 4 * MIN, 5 * MIN, 12 * 60 * MIN];
  const t = tunnusluvut(kestot);
  assert.equal(t.n, 5);
  assert.equal(t.mediaani, 4 * MIN);
  assert.equal(t.max, 12 * 60 * MIN);
  const keskiarvo = kestot.reduce((a, b) => a + b, 0) / kestot.length;
  assert.ok(keskiarvo > 2 * 60 * MIN, 'keskiarvo olisi yli kaksi tuntia');
});

test('p90 on oikea havainto eikä interpoloitu välimuoto', () => {
  const t = tunnusluvut([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(t.p90, 9);
  assert.equal(t.mediaani, 5);
});

test('jakauma järjestyy määrän mukaan ja tasapelit ratkeavat vakaasti', () => {
  const rivit = [{ t: 'b' }, { t: 'a' }, { t: 'c' }, { t: 'c' }];
  const eka = jakauma(rivit, (r) => r.t);
  const toka = jakauma([...rivit].reverse(), (r) => r.t);
  assert.deepEqual(eka.map((r) => r.id), ['c', 'a', 'b']);
  assert.deepEqual(eka.map((r) => r.id), toka.map((r) => r.id));
});

test('tyhjä avain kerätään omaksi ryhmäkseen eikä pudoteta', () => {
  const rivit = [{ z: 'vy1' }, { z: '' }, { z: null }, {}];
  const tulos = jakauma(rivit, (r) => r.z);
  assert.equal(tulos.find((r) => r.id === null).kpl, 3);
});

// --- Kirjaukset --------------------------------------------------------------------

const KIRJAUKSET = [
  { id: '1', typeId: 'jvaction', type: 'JV:n toimenpide', status: 'closed', severity: 3, zoneId: 'vy1', createdAt: '2026-09-01T09:00:00.000Z', closedAt: '2026-09-01T09:20:00.000Z' },
  { id: '2', typeId: 'jvaction', type: 'JV:n toimenpide', status: 'open', severity: 2, zoneId: 'vy1', createdAt: '2026-09-01T10:00:00.000Z' },
  { id: '3', typeId: 'firstaid', type: 'Ensiaputilanne', status: 'closed', severity: 4, zoneId: 'vy2', createdAt: '2026-09-01T11:00:00.000Z', closedAt: '2026-09-01T11:10:00.000Z' },
  { id: '4', typeId: 'in', type: 'Sisäänkirjaus', createdAt: '2026-09-01T07:00:00.000Z' },
  { id: '5', typeId: 'threat', type: 'Uhkatilanne', status: 'open', createdAt: '2026-09-05T09:00:00.000Z' },
  { id: '6', typeId: 'damage', type: 'Omaisuusvaurio' },
];
const VYOHYKKEET = [{ id: 'vy1', nimi: 'Portti A' }, { id: 'vy2', nimi: 'Lava' }];
const IKKUNA = teeIkkuna({ alku: '2026-09-01T00:00:00.000Z', loppu: '2026-09-02T00:00:00.000Z' });

test('aikaleimaton kirjaus ei katoa hiljaa vaan raportoidaan omana lukunaan', () => {
  const k = kirjaustenKooste(KIRJAUKSET, { ikkuna: IKKUNA, vyohykkeet: VYOHYKKEET });
  assert.equal(k.ajattomia, 1);
  assert.equal(k.yhteensa, 4, 'ikkunan sisällä neljä aikaleimattua lukuun ottamatta');
});

test('vyöhykkeetön ja poistettu vyöhyke erottuvat toisistaan', () => {
  const k = kirjaustenKooste(
    [...KIRJAUKSET, { id: '7', typeId: 'fence', zoneId: 'poistettu', createdAt: '2026-09-01T12:00:00.000Z' }],
    { ikkuna: IKKUNA, vyohykkeet: VYOHYKKEET },
  );
  assert.equal(k.vyohykkeittain.find((v) => v.id === 'vy1').nimi, 'Portti A');
  assert.equal(k.vyohykkeittain.find((v) => v.id === null).nimi, 'Ei vyöhykettä');
  assert.equal(k.vyohykkeittain.find((v) => v.id === 'poistettu').nimi, 'Poistettu vyöhyke');
});

test('tilajakauma lasketaan vain poikkeamista, ei sisäänkirjauksista', () => {
  const k = kirjaustenKooste(KIRJAUKSET, { ikkuna: IKKUNA, vyohykkeet: VYOHYKKEET });
  assert.equal(k.yhteensa, 4);
  assert.equal(k.poikkeamia, 3);
  assert.equal(k.tiloittain.reduce((s, t) => s + t.kpl, 0), 3);
});

test('vilkkain tunti on Suomen aikaa ja puuttuu kokonaan kun kirjauksia ei ole', () => {
  const k = kirjaustenKooste(KIRJAUKSET, { ikkuna: IKKUNA });
  // 09:00 UTC = 12 Suomen aikaa kesällä; jokaisella tunnilla on yksi kirjaus, joten
  // huipuksi valikoituu ensimmäinen.
  assert.equal(k.tunneittain[12], 1);
  assert.equal(k.tunneittain.reduce((a, b) => a + b, 0), 4);
  assert.equal(kirjaustenKooste([], {}).vilkkainTunti, null);
});

// --- Vasteajat ---------------------------------------------------------------------

test('vasteaika mitataan vain suljetuista mutta avoimet raportoidaan rinnalla', () => {
  const v = vasteajat(KIRJAUKSET, { ikkuna: IKKUNA, nyt: new Date('2026-09-02T00:00:00.000Z') });
  assert.equal(v.sulkeminen.n, 2);
  // Kaksi kestoa (10 ja 20 min): mediaani on alempi TOTEUTUNUT kesto eikä niiden
  // keskiarvo. Interpoloitu 15 min olisi luku jota mikään tapaus ei ole kestänyt.
  assert.equal(v.sulkeminen.mediaani, 10 * MIN);
  assert.equal(v.sulkeminen.max, 20 * MIN);
  assert.equal(v.avoimia, 1);
  assert.equal(v.vanhinAvoinMs, 14 * 60 * MIN);
});

test('sulkeminen ennen kirjaamista ei laske mediaania vaan päätyy omaksi luvukseen', () => {
  const v = vasteajat(
    [{ typeId: 'jvaction', status: 'closed', createdAt: '2026-09-01T10:00:00.000Z', closedAt: '2026-09-01T09:00:00.000Z' }],
    {},
  );
  assert.equal(v.virheellisia, 1);
  assert.equal(v.sulkeminen, null);
});

test('suljettu-merkintä ilman aikaleimaa lasketaan avoimeksi eikä nollan sekunnin vasteeksi', () => {
  const v = vasteajat([{ typeId: 'threat', status: 'closed', createdAt: '2026-09-01T10:00:00.000Z' }], {
    nyt: new Date('2026-09-01T11:00:00.000Z'),
  });
  assert.equal(v.sulkeminen, null);
  assert.equal(v.avoimia, 1);
});

// --- Kierrokset --------------------------------------------------------------------

const KIERROKSET = [
  {
    tila: 'valmis', alkoi: '2026-09-01T22:00:00.000Z', paattyi: '2026-09-01T22:30:00.000Z',
    pisteet: [{ kuitattu: 'x' }, { kuitattu: 'x' }, { kuitattu: 'x' }],
  },
  {
    tila: 'keskeytetty', alkoi: '2026-09-01T23:00:00.000Z', paattyi: '2026-09-01T23:10:00.000Z',
    pisteet: [{ kuitattu: 'x' }, { kuitattu: null }, { kuitattu: null }, { kuitattu: null }, { kuitattu: null },
      { kuitattu: null }, { kuitattu: null }, { kuitattu: null }, { kuitattu: null }],
  },
];

test('kattavuus lasketaan pisteistä eikä kierrosprosenttien keskiarvona', () => {
  const k = kierrostenKooste(KIERROKSET, {});
  assert.equal(k.pisteita, 12);
  assert.equal(k.kuitattuja, 4);
  assert.equal(k.kattavuus, 4 / 12);
  // Kierroskohtaisten prosenttien keskiarvo olisi antanut (100 % + 11 %) / 2 = 56 %,
  // eli kaksinkertaisen luvun todelliseen kattavuuteen nähden.
  assert.ok(k.kattavuus < 0.4);
});

test('ajamaton kierrosjakso on tuntematon kattavuus eikä nolla prosenttia', () => {
  const k = kierrostenKooste([], {});
  assert.equal(k.kattavuus, null);
  assert.equal(k.ajoja, 0);
});

test('kierrosten tilat eritellään ja kesken oleva ei saa kestoa', () => {
  const k = kierrostenKooste([...KIERROKSET, { tila: 'kesken', alkoi: '2026-09-01T23:30:00.000Z', paattyi: null, pisteet: [] }], {});
  assert.equal(k.valmiit, 1);
  assert.equal(k.keskeytetyt, 1);
  assert.equal(k.kesken, 1);
  assert.equal(k.kestot.n, 2);
  assert.equal(k.kestot.mediaani, 10 * MIN);
  assert.equal(k.kestot.max, 30 * MIN);
});

// --- Hälytykset --------------------------------------------------------------------

const HALYTYKSET = [
  { tyyppi: 'panic', tila: 'kuitattu', alkoi: '2026-09-01T20:00:00.000Z', laukesi: '2026-09-01T20:00:00.000Z', paattyi: '2026-09-01T20:02:00.000Z', eskalointi: { tila: 'lahetetty' } },
  { tyyppi: 'ajastin', tila: 'kuitattu', alkoi: '2026-09-01T21:00:00.000Z', laukesi: '2026-09-01T21:30:00.000Z', paattyi: '2026-09-01T21:36:00.000Z' },
  { tyyppi: 'ajastin', tila: 'peruttu', alkoi: '2026-09-01T22:00:00.000Z', laukesi: null, paattyi: '2026-09-01T22:01:00.000Z' },
  { tyyppi: 'mandown', tila: 'lauennut', alkoi: '2026-09-01T23:00:00.000Z', laukesi: '2026-09-01T23:00:00.000Z', paattyi: null },
];

test('kuittausvaste mitataan laukeamisesta eikä käynnistämisestä', () => {
  const h = halytystenKooste(HALYTYKSET, {});
  // Ajastin oli käynnissä 30 minuuttia ennen laukeamista; se aika ei ole vasteaikaa.
  assert.equal(h.kuittausvaste.n, 2);
  assert.equal(h.kuittausvaste.min, 2 * MIN);
  assert.equal(h.kuittausvaste.max, 6 * MIN);
});

test('peruttu hälytys ei ole nopea vaste vaan jää laskennan ulkopuolelle', () => {
  const h = halytystenKooste(HALYTYKSET, {});
  assert.equal(h.perutut, 1);
  assert.equal(h.kuitattuja, 2);
  assert.equal(h.avoimia, 1);
  assert.equal(h.eskaloituja, 1);
});

// --- Kokonaisuus -------------------------------------------------------------------

test('kooste kokoaa osat ja merkitsee laskentahetken jäädytystä varten', () => {
  const k = kooste({
    kirjaukset: KIRJAUKSET, kierrokset: KIERROKSET, halytykset: HALYTYKSET,
    vyohykkeet: VYOHYKKEET, ikkuna: IKKUNA, nyt: new Date('2026-09-02T06:00:00.000Z'),
  });
  assert.equal(k.laskettu, '2026-09-02T06:00:00.000Z');
  assert.equal(k.ikkuna.alku, '2026-09-01T00:00:00.000Z');
  assert.equal(k.kirjaukset.yhteensa, 4);
  assert.equal(k.kierrokset.ajoja, 2);
  assert.equal(k.halytykset.yhteensa, 4);
  assert.equal(k.vasteajat.avoimia, 1);
});

test('tyhjä aineisto tuottaa koosteen jossa ei ole yhtään keksittyä nollaa', () => {
  const k = kooste({});
  assert.equal(k.kirjaukset.yhteensa, 0);
  assert.equal(k.vasteajat.sulkeminen, null);
  assert.equal(k.kierrokset.kattavuus, null);
  assert.equal(k.halytykset.kuittausvaste, null);
});
