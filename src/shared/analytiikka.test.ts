// Analytiikan ja jälkiraportin selainpuolen testit (erä 9).
//
// Laskenta on palvelimella; täällä testataan se mitä front tekee luvuille — muotoilu ja
// tuloste. Painopiste on puuttuvassa luvussa: viiva ja nolla näyttävät mittaristossa yhtä
// itsevarmoilta, mutta toinen niistä on väite jota ei ole mitattu.
//
// Ajetaan: node --test src/shared/analytiikka.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { aikavaliTekstina, jakso, kesto, luku, paivistaAikavali, prosentti, HALYTYSTYYPPI } from './analytiikka.ts';
import { jalkiraportinTuloste, type Jalkiraportti } from './jalkiraportit.ts';

const MIN = 60 * 1000;

test('puuttuva luku on viiva eikä nolla', () => {
  assert.equal(kesto(null), '—');
  assert.equal(kesto(undefined), '—');
  assert.equal(prosentti(null), '—');
  assert.equal(luku(null), '—');
  // Nolla on oikea luku ja näytetään nollana: mitattu nolla on eri asia kuin mittaamatta.
  assert.equal(prosentti(0), '0 %');
  assert.equal(luku(0), '0');
});

test('kesto lyhenee mittakaavan mukaan', () => {
  assert.equal(kesto(45 * 1000), '45 s');
  assert.equal(kesto(12 * MIN), '12 min');
  assert.equal(kesto(2 * 60 * MIN + 15 * MIN), '2 h 15 min');
  assert.equal(kesto(3 * 60 * MIN), '3 h');
  assert.equal(kesto(28 * 60 * MIN), '1 vrk 4 h');
});

test('aikaväli kerrotaan päättyvänä päivänä eikä puoliavoimena hetkenä', () => {
  // Palvelimen ikkuna päättyy seuraavan vuorokauden alkuun; käyttäjälle näytetään se
  // päivä jonka hän valitsi, ei sitä seuraavaa.
  const vali = paivistaAikavali('2026-09-01', '2026-09-03');
  assert.match(aikavaliTekstina(vali), /1\.9\.2026 – 3\.9\.2026/);
  assert.equal(aikavaliTekstina({ alku: null, loppu: null }), 'Koko historia');
  assert.match(aikavaliTekstina({ alku: '2026-09-01T00:00:00.000Z', loppu: null }), /alkaen$/);
});

test('jakso laskee taaksepäin nykyhetkestä ja koko historia jättää molemmat päät auki', () => {
  const nyt = new Date('2026-09-03T12:00:00.000Z');
  assert.equal(jakso('24h', nyt).alku, '2026-09-02T12:00:00.000Z');
  assert.equal(jakso('24h', nyt).loppu, null);
  assert.deepEqual(jakso('kaikki', nyt), { alku: null, loppu: null });
  // Tuntematon tunniste ei saa tuottaa virheellistä ikkunaa vaan koko historian.
  assert.deepEqual(jakso('roska', nyt), { alku: null, loppu: null });
});

test('hälytystyyppien nimet tulevat samasta listasta kuin hälytysnäkymässä', () => {
  // Erässä 8 lisätty varuste-tyyppi näkyi bannerissa nimettömänä, koska nimilistoja oli
  // kaksi. Tämä testi on olemassa siksi ettei sama toistu seuraavan tyypin kohdalla.
  for (const tyyppi of ['ajastin', 'mandown', 'panic', 'geofence', 'varuste']) {
    assert.ok(HALYTYSTYYPPI[tyyppi], `tyypiltä ${tyyppi} puuttuu nimi`);
  }
});

// --- Tuloste -----------------------------------------------------------------------

const KOOSTE = {
  ikkuna: { alku: '2026-09-01T00:00:00.000Z', loppu: '2026-09-04T00:00:00.000Z' },
  laskettu: '2026-09-04T06:00:00.000Z',
  kirjaukset: {
    yhteensa: 12, poikkeamia: 7, ajattomia: 3,
    tyypeittain: [{ id: 'jvaction', nimi: 'JV:n toimenpide', kpl: 5 }],
    vyohykkeittain: [{ id: 'vy1', nimi: 'Portti A', kpl: 4 }],
    vakavuuksittain: [], tiloittain: [], tunneittain: Array.from({ length: 24 }, () => 0),
    paivittain: [], vilkkainTunti: null,
  },
  vasteajat: { sulkeminen: { n: 4, mediaani: 20 * MIN, p90: 90 * MIN, min: MIN, max: 120 * MIN }, avoimia: 2, vanhinAvoinMs: 3 * 60 * MIN, virheellisia: 0 },
  kierrokset: { ajoja: 0, valmiit: 0, keskeytetyt: 0, kesken: 0, pisteita: 0, kuitattuja: 0, kattavuus: null, kestot: null },
  halytykset: { yhteensa: 3, tyypeittain: [], avoimia: 0, kuitattuja: 3, perutut: 0, eskaloituja: 1, kuittausvaste: null },
} as unknown as Jalkiraportti['kooste'];

const RAPORTTI: Jalkiraportti = {
  id: 'jr-1', ownerId: 'tapahtuma-1', omistaja: 'tapahtuma', nimi: 'Purku 2026',
  ikkuna: KOOSTE.ikkuna, kooste: KOOSTE, tila: 'luonnos',
  luotu: '2026-09-04T06:00:00.000Z', laatija: 'tike', valmis: null,
  yhteenveto: 'Rauhallinen ilta.', onnistui: '', kehitettavaa: '', oppi: '',
  toimenpiteet: [{ id: 't1', teksti: 'Lisää JV portille B', vastuu: 'Turvapäällikkö', maarapaiva: '2026-10-01', tehty: false }],
  historia: [],
};

test('tuloste kertoo jäädytetyt luvut ja aineiston puutteet', () => {
  const html = jalkiraportinTuloste(RAPORTTI, 'FestivaaliX');
  assert.match(html, /Purku 2026/);
  assert.match(html, /Kirjauksia: 12 \(poikkeamia 7\)/);
  assert.match(html, /Vasteaika, mediaani: 20 min \(n = 4, p90 1 h 30 min\)/);
  assert.match(html, /3 kirjausta ilman luontiaikaa/);
  assert.match(html, /Lisää JV portille B \(vastuu: Turvapäällikkö, määräpäivä: 2026-10-01\)/);
  // Kierroksettomasta jaksosta ei tulosteta kattavuusriviä lainkaan: "0 %" olisi väite
  // laiminlyönnistä toiminnossa jota tapahtumapuolella ei ole.
  assert.equal(/kattavuus/i.test(html), false);
});

test('luonnos ja valmis erottuvat tulosteessa toisistaan', () => {
  assert.match(jalkiraportinTuloste(RAPORTTI, 'FestivaaliX'), /LUONNOS/);
  const valmis = { ...RAPORTTI, tila: 'valmis' as const, valmis: { ts: '2026-09-04T08:00:00.000Z', user: 'tike' } };
  const html = jalkiraportinTuloste(valmis, 'FestivaaliX');
  assert.match(html, /VALMIS/);
  assert.match(html, /Merkitty valmiiksi/);
});

test('tulosteen teksti escapetaan', () => {
  const ilkea = { ...RAPORTTI, nimi: '<script>paha()</script>', laatija: '<b>tike</b>' };
  const html = jalkiraportinTuloste(ilkea, 'Festari & Co');
  assert.equal(html.includes('<script>paha()'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Festari &amp; Co/);
});

test('täyttämätön osio näkyy viivana eikä tyhjänä kohtana', () => {
  const html = jalkiraportinTuloste(RAPORTTI, 'FestivaaliX');
  const osiot = html.match(/Mikä toimi<\/div><div class="arvo">—<\/div>/);
  assert.ok(osiot, 'tyhjä osio merkitään viivalla');
});
