// Tiedotteiden testit.
//
// Toiminnon koko arvo on siinä, että kuittauksesta jää tieto KUKA ja MILLOIN. Testit
// keskittyvät siihen: kuittaus ei saa kadota, ei muuttua eikä kirjautua väärälle.
//
// Ajetaan: node --test server/broadcast.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  luoTiedote, kuittaa, peru, onVoimassa, onKuitannut, kuittaamatta, kooste,
  VOIMASSA_TUNTIA_OLETUS, VOIMASSA_TUNTIA_MAX, OTSIKON_MAX,
} from './broadcast.js';

const T0 = Date.parse('2026-09-03T12:00:00Z');

const luo = (yli = {}) => luoTiedote({
  id: 't1', ownerId: 'fesx', omistaja: 'tapahtuma',
  otsikko: 'Portti 3 suljetaan', viesti: 'Ohjatkaa yleisö portille 2.',
  laatija: 'tike1', nyt: T0, ...yli,
}).tiedote;

const KAYTTAJAT = [
  { username: 'tike1', nimi: 'TIKE Päivystäjä' },
  { username: 'jv1', nimi: 'Virtanen' },
  { username: 'jv2', nimi: 'Korhonen' },
];

// --- Luonti -----------------------------------------------------------------------

test('tiedote syntyy voimassa olevana ja ilman kuittauksia', () => {
  const t = luo();
  assert.equal(t.kuittaukset.length, 0);
  assert.equal(t.voimassaTuntia, VOIMASSA_TUNTIA_OLETUS);
  assert.equal(onVoimassa(t, T0), true);
});

test('tyhjä otsikko tai viesti torjutaan', () => {
  assert.equal(luoTiedote({ id: 'x', otsikko: '', viesti: 'jotain', laatija: 'a' }).ok, false);
  assert.equal(luoTiedote({ id: 'x', otsikko: 'Otsikko', viesti: '  ', laatija: 'a' }).ok, false);
  assert.equal(luoTiedote({ id: 'x', otsikko: 'Otsikko', viesti: 'Viesti', laatija: '' }).ok, false);
});

test('rivinvaihto säilyy viestissä mutta ohjausmerkit siivotaan', () => {
  const t = luo({ viesti: `Rivi yksi\nRivi kaksi${String.fromCharCode(0)}` });
  assert.equal(t.viesti, 'Rivi yksi\nRivi kaksi');
});

test('otsikko katkaistaan rajaan', () => {
  const t = luo({ otsikko: 'x'.repeat(OTSIKON_MAX + 50) });
  assert.equal(t.otsikko.length, OTSIKON_MAX);
});

test('kelvoton voimassaoloaika korvataan oletuksella', () => {
  for (const arvo of [0, -5, 'kolme', VOIMASSA_TUNTIA_MAX + 1, undefined]) {
    assert.equal(luo({ voimassaTuntia: arvo }).voimassaTuntia, VOIMASSA_TUNTIA_OLETUS);
  }
  assert.equal(luo({ voimassaTuntia: 4 }).voimassaTuntia, 4);
});

test('tiedote vanhenee eikä enää vaadi kuittausta', () => {
  const t = luo({ voimassaTuntia: 2 });
  assert.equal(onVoimassa(t, T0 + 60 * 60 * 1000), true);
  assert.equal(onVoimassa(t, T0 + 3 * 60 * 60 * 1000), false);
});

// --- Kuittaus ---------------------------------------------------------------------

test('kuittaus tallentaa kuka ja milloin', () => {
  const tulos = kuittaa({ tiedote: luo(), username: 'jv1', nyt: T0 + 60000 });
  assert.equal(tulos.ok, true);
  assert.deepEqual(tulos.tiedote.kuittaukset, [{ user: 'jv1', ts: new Date(T0 + 60000).toISOString() }]);
  assert.equal(onKuitannut(tulos.tiedote, 'jv1'), true);
  assert.equal(onKuitannut(tulos.tiedote, 'jv2'), false);
});

test('toinen kuittaus samalta ei muuta ensimmäistä aikaleimaa', () => {
  const eka = kuittaa({ tiedote: luo(), username: 'jv1', nyt: T0 + 60000 }).tiedote;
  const toka = kuittaa({ tiedote: eka, username: 'jv1', nyt: T0 + 600000 });
  assert.equal(toka.duplikaatti, true);
  assert.equal(toka.tiedote.kuittaukset.length, 1);
  assert.equal(toka.tiedote.kuittaukset[0].ts, new Date(T0 + 60000).toISOString());
});

test('kuittaus ei muuta alkuperäistä tietuetta', () => {
  const t = luo();
  const kopio = JSON.parse(JSON.stringify(t));
  kuittaa({ tiedote: t, username: 'jv1', nyt: T0 });
  assert.deepEqual(t, kopio);
});

test('tuntematon kuittaaja torjutaan', () => {
  assert.equal(kuittaa({ tiedote: luo(), username: '' }).ok, false);
});

test('vanhentuneen tiedotteen voi yhä kuitata', () => {
  // Vanhentuminen lopettaa kuittauspyynnön näyttämisen, mutta ei estä kuittausta:
  // myöhässä tullut kuittaus on parempi tieto kuin ei kuittausta.
  const t = luo({ voimassaTuntia: 1 });
  const tulos = kuittaa({ tiedote: t, username: 'jv2', nyt: T0 + 5 * 60 * 60 * 1000 });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.tiedote.kuittaukset.length, 1);
});

// --- Peruminen --------------------------------------------------------------------

test('peruttu tiedote ei ole voimassa mutta kuittaukset säilyvät', () => {
  const kuitattu = kuittaa({ tiedote: luo(), username: 'jv1', nyt: T0 }).tiedote;
  const peruttu = peru({ tiedote: kuitattu, username: 'tike1', nyt: T0 + 60000 }).tiedote;
  assert.equal(onVoimassa(peruttu, T0 + 60000), false);
  assert.equal(peruttu.kuittaukset.length, 1);
  assert.equal(peru({ tiedote: peruttu, username: 'tike1' }).ok, false);
});

// --- Vastaanottajat ---------------------------------------------------------------

test('kuittaamatta kertoo ketkä puuttuvat, laatija mukaan lukien', () => {
  const t = kuittaa({ tiedote: luo(), username: 'jv1', nyt: T0 }).tiedote;
  const puuttuvat = kuittaamatta(t, KAYTTAJAT).map((k) => k.username);
  assert.deepEqual(puuttuvat, ['tike1', 'jv2']);
});

test('kooste laskee osuuden', () => {
  const t = kuittaa({ tiedote: luo(), username: 'jv1', nyt: T0 }).tiedote;
  assert.deepEqual(kooste(t, KAYTTAJAT), { odotetut: 3, kuitanneet: 1, kuittaamatta: 2, osuus: 33 });
  // Tyhjä vastaanottajajoukko ei tuota nollaosuutta vaan tuntematonta: kukaan ei ole
  // odottamassa, joten prosentti olisi keksitty.
  assert.equal(kooste(t, []).osuus, null);
});
