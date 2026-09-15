// Hälytystehtävien testit (erä 22).
//
// Painopiste on kolmessa asiassa jotka ovat helppo saada vahingossa väärin:
//
//   1. KOHDENNUS. Kolme eri reittiä samaan listaan, ja jokainen niistä voi joko vuotaa
//      hälytyksen väärälle tai piilottaa sen oikealta. Molemmat ovat pahoja eri suuntiin.
//   2. POISTUMINEN. Vartija ei saa päättää tehtävää itse, eikä hylkäys saa mennä läpi
//      ilman kommenttia — muuten koko hyväksyntäketju on koriste.
//   3. TOISTO. Kentällä painetaan uudelleen kun ruutu ei ehtinyt päivittyä. Toinen
//      painallus ei saa tuottaa virhettä eikä siirtää ensimmäistä aikaleimaa.
//
// Ajetaan: node --test server/halytystehtava.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OLETUS_SADE_KM,
  etaisyysKm, kieltaydy, kohteenSijainti, lahetaRaportti, lisaaHavainto, luoTehtava,
  merkitseVaihe, nakeeTehtavan, omatToiminnot, peruTehtava, ratkaiseHyvaksynta, vastaanota,
  LAJIN_NIMI,
} from './halytystehtava.js';
import { TARKISTUSTA_VAATIVAT, SIJAINTISAANNOT } from './halytys.js';

const T0 = Date.parse('2026-09-14T18:04:00Z');
const min = (n) => T0 + n * 60_000;

// Tampereen keskusta ja piste noin 3 km siitä pohjoiseen.
const KOHDE = { id: 'kohde-a', name: 'Yritys X', gps: { lat: 61.4978, lon: 23.7610 } };
const LAHELLA = { gps: { lat: 61.5248, lon: 23.7610 } };
const KAUKANA = { gps: { lat: 61.7000, lon: 23.7610 } };

const uusi = (yli = {}) => luoTehtava({
  laji: 'murto',
  kohde: KOHDE,
  silmukka: 'Etuovi mg',
  luoja: 'paivystaja',
  id: 't1',
  nyt: T0,
  ...yli,
}).tehtava;

// --- Luonti -------------------------------------------------------------------------

test('tuntematon laji ei kelpaa', () => {
  const tulos = luoTehtava({ laji: 'tulipalo', kohde: KOHDE, luoja: 'p', id: 't1' });
  assert.equal(tulos.ok, false);
});

test('kohteen nimi kopioidaan tietueeseen', () => {
  const t = uusi();
  assert.equal(t.siteNimi, 'Yritys X');
  assert.equal(t.tila, 'avoin');
  assert.equal(t.silmukka, 'Etuovi mg');
});

test('luontihetken havainnot päätyvät riveiksi aikaleimoineen', () => {
  const t = luoTehtava({
    laji: 'murto', kohde: KOHDE, luoja: 'p', id: 't1', nyt: T0,
    havainnot: ['Aulassa näkyy huppupäinen henkilö', '   '],
    havaintoId: (i) => `h${i}`,
  }).tehtava;
  assert.equal(t.havainnot.length, 1, 'tyhjä havainto ei saa tuottaa riviä');
  assert.equal(t.havainnot[0].ts, new Date(T0).toISOString());
});

// --- Kohdennus ----------------------------------------------------------------------

test('kohteen vuorossa oleva näkee tehtävän', () => {
  const tulos = nakeeTehtavan({
    tehtava: uusi(),
    kohde: KOHDE,
    vuoro: { vartija: 'a', tila: 'kesken', siteId: 'kohde-a' },
    sijainti: null,
  });
  assert.equal(tulos.nakee, true);
  assert.equal(tulos.peruste, 'vuoro');
});

test('toisen kohteen vuorossa oleva EI näe tehtävää', () => {
  const tulos = nakeeTehtavan({
    tehtava: uusi(),
    kohde: KOHDE,
    vuoro: { vartija: 'a', tila: 'kesken', siteId: 'kohde-b' },
    sijainti: null,
  });
  assert.equal(tulos.nakee, false);
});

test('piirivuorossa oleva näkee tehtävän vaikka kohde on toinen', () => {
  const tulos = nakeeTehtavan({
    tehtava: uusi(),
    kohde: KOHDE,
    vuoro: { vartija: 'a', tila: 'kesken', siteId: 'kohde-b', piiri: true },
    sijainti: null,
  });
  assert.equal(tulos.peruste, 'piiri');
});

test('päättynyt vuoro ei enää kohdenna', () => {
  const tulos = nakeeTehtavan({
    tehtava: uusi(),
    kohde: KOHDE,
    vuoro: { vartija: 'a', tila: 'paattynyt', siteId: 'kohde-a', piiri: true },
    sijainti: null,
  });
  assert.equal(tulos.nakee, false);
});

test('säteellä oleva vuoroton vartija näkee tehtävän, kauempana oleva ei', () => {
  const lahella = nakeeTehtavan({ tehtava: uusi(), kohde: KOHDE, vuoro: null, sijainti: LAHELLA });
  assert.equal(lahella.peruste, 'sade');
  assert.ok(lahella.etaisyysKm < OLETUS_SADE_KM);

  const kaukana = nakeeTehtavan({ tehtava: uusi(), kohde: KOHDE, vuoro: null, sijainti: KAUKANA });
  assert.equal(kaukana.nakee, false);
  assert.ok(kaukana.etaisyysKm > OLETUS_SADE_KM, 'etäisyys palautetaan myös kun se ei riitä');
});

test('kohteen oma säde ohittaa oletuksen', () => {
  const tulos = nakeeTehtavan({
    tehtava: uusi(), kohde: KOHDE, vuoro: null, sijainti: KAUKANA, sadeKm: 50,
  });
  assert.equal(tulos.peruste, 'sade');
});

test('ilman sijaintitietoa säde ei tuo ketään', () => {
  // Sijaintiseuranta on oletuksena pois päältä, jolloin sijainti on aina null. Se on
  // tarkoituksellinen seuraus eikä vika, ja tämä testi pitää sen näkyvissä.
  const tulos = nakeeTehtavan({ tehtava: uusi(), kohde: KOHDE, vuoro: null, sijainti: null });
  assert.equal(tulos.nakee, false);
  assert.equal(tulos.etaisyysKm, null);
});

test('vastaanottanut yksikkö näkee tehtävän vaikka vuoro olisi päättynyt', () => {
  const t = vastaanota({ tehtava: uusi(), vartija: 'a', yksikko: 'Piiri 301', nyt: min(1) }).tehtava;
  const tulos = nakeeTehtavan({
    tehtava: t, kohde: KOHDE, vuoro: { vartija: 'a', tila: 'paattynyt', siteId: 'kohde-b' }, sijainti: null,
  });
  assert.equal(tulos.peruste, 'oma');
});

test('vuoroton vastaanottaja näkee oman tehtävänsä', () => {
  // Piirivartija joka ei ole kirjautunut vuoroon. Jos tunnus luettaisiin vain vuorosta,
  // hänen oma kesken oleva keikkansa katoaisi listalta heti vastaanoton jälkeen.
  const t = vastaanota({ tehtava: uusi(), vartija: 'a', yksikko: 'a', nyt: min(1) }).tehtava;
  const tulos = nakeeTehtavan({ tehtava: t, kohde: KOHDE, vartija: 'a', vuoro: null, sijainti: null });
  assert.equal(tulos.peruste, 'oma');
});

test('kieltäytynyt ei näe tehtävää omanaan', () => {
  const t = kieltaydy({ tehtava: uusi(), vartija: 'a', yksikko: 'Piiri 301', nyt: min(1) }).tehtava;
  const tulos = nakeeTehtavan({
    tehtava: t, kohde: KOHDE, vuoro: { vartija: 'a', tila: 'paattynyt', siteId: 'kohde-b' }, sijainti: null,
  });
  assert.equal(tulos.nakee, false);
});

test('kohteen sijainti luetaan kalibrointipisteestä jos omaa gps:ää ei ole', () => {
  const kohde = { id: 'k', mapRef: [{ img: { x: 0.5, y: 0.5 }, gps: { lat: 61.5, lon: 23.8 } }] };
  assert.deepEqual(kohteenSijainti(kohde), { lat: 61.5, lon: 23.8 });
  assert.equal(kohteenSijainti({ id: 'k' }), null);
});

test('etäisyys puuttuvasta pisteestä on null eikä nolla', () => {
  assert.equal(etaisyysKm(null, LAHELLA.gps), null);
});

// --- Vastaanotto ja vaiheet ---------------------------------------------------------

test('vastaanotto siirtää tehtävän käynnissä-tilaan ja kirjaa yksikön nimen', () => {
  const t = vastaanota({ tehtava: uusi(), vartija: 'a', yksikko: 'Piiri 301', nyt: min(1) }).tehtava;
  assert.equal(t.tila, 'kaynnissa');
  assert.equal(t.yksikot[0].nimi, 'Piiri 301');
  assert.ok(t.loki.some((r) => r.teksti === 'Piiri 301 vastaanotti tehtävän'));
});

test('kaksi yksikköä voi ottaa saman tehtävän vastaan', () => {
  let t = vastaanota({ tehtava: uusi(), vartija: 'a', yksikko: 'Piiri 301', nyt: min(1) }).tehtava;
  t = vastaanota({ tehtava: t, vartija: 'b', yksikko: 'Piiri 302', nyt: min(4) }).tehtava;
  assert.equal(t.yksikot.length, 2);
});

test('"ota vastaan ja lähde ajoon" kirjaa molemmat yhdellä kutsulla', () => {
  const t = vastaanota({ tehtava: uusi(), vartija: 'a', yksikko: 'Piiri 301', ajoon: true, nyt: min(1) }).tehtava;
  assert.ok(t.yksikot[0].ajoon);
  assert.equal(t.loki.filter((r) => r.tapahtuma === 'ajoon').length, 1);
});

test('toinen vastaanotto on toistona sallittu eikä muuta mitään', () => {
  const t = vastaanota({ tehtava: uusi(), vartija: 'a', yksikko: 'Piiri 301', nyt: min(1) }).tehtava;
  const toinen = vastaanota({ tehtava: t, vartija: 'a', yksikko: 'Piiri 301', nyt: min(2) });
  assert.equal(toinen.ok, true);
  assert.equal(toinen.duplikaatti, true);
  assert.equal(toinen.tehtava.yksikot.length, 1);
});

test('paikalla-aikaleimaa ei siirretä toisella painalluksella', () => {
  let t = vastaanota({ tehtava: uusi(), vartija: 'a', yksikko: 'Piiri 301', nyt: min(1) }).tehtava;
  t = merkitseVaihe({ tehtava: t, vartija: 'a', vaihe: 'paikalla', nyt: min(5) }).tehtava;
  const ensimmainen = t.yksikot[0].paikalla;
  t = merkitseVaihe({ tehtava: t, vartija: 'a', vaihe: 'paikalla', nyt: min(9) }).tehtava;
  assert.equal(t.yksikot[0].paikalla, ensimmainen);
});

test('paikalla ilman vastaanottoa ei kelpaa', () => {
  const tulos = merkitseVaihe({ tehtava: uusi(), vartija: 'a', vaihe: 'paikalla', nyt: min(1) });
  assert.equal(tulos.ok, false);
});

test('vastaanottanut ei voi enää kieltäytyä', () => {
  const t = vastaanota({ tehtava: uusi(), vartija: 'a', yksikko: 'Piiri 301', nyt: min(1) }).tehtava;
  assert.equal(kieltaydy({ tehtava: t, vartija: 'a', nyt: min(2) }).ok, false);
});

test('kieltäytyminen jää tietueeseen näkyviin', () => {
  const t = kieltaydy({ tehtava: uusi(), vartija: 'a', yksikko: 'Piiri 301', syy: 'Toinen keikka kesken', nyt: min(1) }).tehtava;
  assert.equal(t.yksikot[0].syy, 'Toinen keikka kesken');
  assert.ok(t.yksikot[0].kieltaytyi);
  assert.equal(t.tila, 'avoin', 'kieltäytyminen ei käynnistä tehtävää');
});

// --- Raportti ja hyväksyntä ---------------------------------------------------------

const raportoitu = () => {
  let t = vastaanota({ tehtava: uusi(), vartija: 'a', yksikko: 'Piiri 301', nyt: min(1) }).tehtava;
  t = merkitseVaihe({ tehtava: t, vartija: 'a', vaihe: 'paikalla', nyt: min(5) }).tehtava;
  return lahetaRaportti({ tehtava: t, vartija: 'a', raporttiId: 'r1', nyt: min(20) }).tehtava;
};

test('raportin lähetys jättää tehtävän odottamaan hyväksyntää', () => {
  const t = raportoitu();
  assert.equal(t.tila, 'odottaa');
  assert.equal(t.hyvaksynta.tila, 'odottaa');
  assert.equal(t.raportit[0].raporttiId, 'r1');
  assert.equal(t.paattyi, null, 'vartija ei päätä tehtävää itse');
});

test('raporttia ei voi lähettää ottamatta tehtävää vastaan', () => {
  assert.equal(lahetaRaportti({ tehtava: uusi(), vartija: 'a', raporttiId: 'r1' }).ok, false);
});

test('hylkäys ilman kommenttia ei mene läpi', () => {
  const tulos = ratkaiseHyvaksynta({ tehtava: raportoitu(), kasittelija: 'p', hyvaksy: false, kommentti: '  ' });
  assert.equal(tulos.ok, false);
});

test('hylkäys palauttaa tehtävän käyntiin ja kommentti jää näkyviin', () => {
  const t = ratkaiseHyvaksynta({
    tehtava: raportoitu(), kasittelija: 'paivystaja', hyvaksy: false,
    kommentti: 'Takapiha tarkastamatta.', nyt: min(25),
  }).tehtava;
  assert.equal(t.tila, 'kaynnissa');
  assert.equal(t.hyvaksynta.tila, 'palautettu');
  assert.equal(t.hyvaksynta.kommentti, 'Takapiha tarkastamatta.');
  assert.equal(t.paattyi, null);
});

test('hyväksyntä sulkee tehtävän ja merkitsee yksiköt poistuneiksi', () => {
  const t = ratkaiseHyvaksynta({ tehtava: raportoitu(), kasittelija: 'paivystaja', hyvaksy: true, nyt: min(25) }).tehtava;
  assert.equal(t.tila, 'suljettu');
  assert.ok(t.paattyi);
  assert.ok(t.yksikot[0].poistui);
});

test('hyväksyntää ei voi antaa kahdesti', () => {
  const t = ratkaiseHyvaksynta({ tehtava: raportoitu(), kasittelija: 'p', hyvaksy: true, nyt: min(25) }).tehtava;
  assert.equal(ratkaiseHyvaksynta({ tehtava: t, kasittelija: 'p', hyvaksy: true, nyt: min(26) }).ok, false);
});

test('hylkäyksen jälkeen voi lähettää uuden raportin', () => {
  let t = ratkaiseHyvaksynta({
    tehtava: raportoitu(), kasittelija: 'p', hyvaksy: false, kommentti: 'Takapiha tarkastamatta.', nyt: min(25),
  }).tehtava;
  const toinen = lahetaRaportti({ tehtava: t, vartija: 'a', raporttiId: 'r2', nyt: min(35) });
  assert.equal(toinen.ok, true);
  assert.equal(toinen.tehtava.raportit.length, 2);
});

// --- Peruminen ja havainnot ---------------------------------------------------------

test('peruttu tehtävä ei ole suljettu tehtävä', () => {
  const t = peruTehtava({ tehtava: uusi(), kasittelija: 'p', syy: 'Asiakas kuittasi itse', nyt: min(3) }).tehtava;
  assert.equal(t.tila, 'peruttu');
  assert.equal(t.peruminen.syy, 'Asiakas kuittasi itse');
});

test('päättyneeseen tehtävään ei kirjata havaintoja', () => {
  const t = peruTehtava({ tehtava: uusi(), kasittelija: 'p', nyt: min(3) }).tehtava;
  assert.equal(lisaaHavainto({ tehtava: t, teksti: 'jotain', kirjaaja: 'p', id: 'h9' }).ok, false);
});

test('havainnon voi lisätä myös hyväksyntää odottavaan tehtävään', () => {
  const tulos = lisaaHavainto({ tehtava: raportoitu(), teksti: 'Poliisi paikalla', kirjaaja: 'p', id: 'h9', nyt: min(22) });
  assert.equal(tulos.ok, true);
});

// --- Valikon rivit ------------------------------------------------------------------

test('valikko tarjoaa vastaanoton ennen sitä ja vaiheet sen jälkeen', () => {
  const ennen = omatToiminnot({ tehtava: uusi(), vartija: 'a' });
  assert.deepEqual(
    [ennen.vastaanota, ennen.kieltaydy, ennen.ajoon, ennen.paikalla],
    [true, true, false, false]
  );

  const t = vastaanota({ tehtava: uusi(), vartija: 'a', yksikko: 'Piiri 301', nyt: min(1) }).tehtava;
  const jalkeen = omatToiminnot({ tehtava: t, vartija: 'a' });
  assert.deepEqual(
    [jalkeen.vastaanota, jalkeen.kieltaydy, jalkeen.ajoon, jalkeen.paikalla, jalkeen.raportoi],
    [false, false, true, true, true]
  );
});

test('hyväksyntää odottaessa valikko ei tarjoa mitään tehtävää', () => {
  const v = omatToiminnot({ tehtava: raportoitu(), vartija: 'a' });
  assert.deepEqual(
    [v.vastaanota, v.ajoon, v.paikalla, v.raportoi, v.odottaa],
    [false, false, false, false, true]
  );
});

// --- Tarkistustehtävä (käyttäjän päätös 15.9.2026) ----------------------------------

test('tarkistus on kelvollinen laji', () => {
  const tulos = luoTehtava({
    laji: 'tarkistus', kohde: { id: 'k1', name: 'Kauppakeskus' }, id: 't1',
  });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.tehtava.laji, 'tarkistus');
});

test('tarkistustehtävä on tavallinen tehtävä eikä erillinen käsite', () => {
  // Sama kohdennus, sama vastaanotto, sama poistumislupa ja sama tapahtumailmoitus.
  // Jos tämä alkaisi poiketa, vastaanottava vartija joutuisi opettelemaan kaksi
  // erilaista tehtävää.
  const t = luoTehtava({
    laji: 'tarkistus', kohde: { id: 'k1', name: 'Kauppakeskus' }, id: 't1',
  }).tehtava;
  assert.equal(t.tila, 'avoin');
  assert.deepEqual(t.yksikot, []);
  assert.equal(t.hyvaksynta, null);
});

test('tarkistuksen nimi erottaa sen vartijakutsusta', () => {
  // Vastaanottavan vartijan on tiedettävä kumpaa ollaan tekemässä: asiakas pyysi
  // vartijan paikalle, vai onko kollega hädässä.
  assert.notEqual(LAJIN_NIMI.tarkistus, LAJIN_NIMI.vartijakutsu);
  assert.match(LAJIN_NIMI.tarkistus, /tarkistus/i);
});

test('tarkistusta vaativat lajit ovat samat kuin LYTP-sijaintilajit', () => {
  // Ei sattuma: naista syntyy tarkistustehtava, tehtavasta tapahtumailmoitus, ja
  // ilmoituksesta sailytysvelvollisuus. Jos listat erkanevat, toinen on vaarassa.
  const lytp = Object.entries(SIJAINTISAANNOT)
    .filter(([, s]) => s.sailytys === 'lytp')
    .map(([t]) => t)
    .sort();
  assert.deepEqual([...TARKISTUSTA_VAATIVAT].sort(), lytp);
});

test('vyöhykepoikkeama ja varustepoikkeama eivät vaadi tarkistusta', () => {
  assert.equal(TARKISTUSTA_VAATIVAT.has('geofence'), false);
  assert.equal(TARKISTUSTA_VAATIVAT.has('varuste'), false);
});

// --- Tarkistustehtävän herätyksen kohdennus -----------------------------------------
//
// Herätys avaa vastaanottajan puhelimeen täysruutuhälytyksen. Väärä kohdennus on siksi
// eri luokan virhe kuin väärä listarivi: se herättää ihmisiä yöllä. Nämä testit kattavat
// saman nakeeTehtavan-säännön jota herataTarkistukseen käyttää suodattimenaan.

const tarkistusTehtava = () => luoTehtava({
  laji: 'tarkistus', kohde: { id: 'kohde-a', name: 'Kauppakeskus' }, id: 'tt1', nyt: T0,
}).tehtava;

test('kohteen vuorossa oleva herätetään', () => {
  const osuma = nakeeTehtavan({
    tehtava: tarkistusTehtava(),
    kohde: { id: 'kohde-a', name: 'Kauppakeskus' },
    vartija: 'liisa',
    vuoro: { tila: 'kesken', siteId: 'kohde-a', vartija: 'liisa' },
    sijainti: null,
  });
  assert.equal(osuma.nakee, true);
  assert.equal(osuma.peruste, 'vuoro');
});

test('piirivuorossa oleva herätetään myös toisesta kohteesta', () => {
  const osuma = nakeeTehtavan({
    tehtava: tarkistusTehtava(),
    kohde: { id: 'kohde-a', name: 'Kauppakeskus' },
    vartija: 'liisa',
    vuoro: { tila: 'kesken', siteId: 'kohde-b', piiri: true, vartija: 'liisa' },
    sijainti: null,
  });
  assert.equal(osuma.nakee, true);
  assert.equal(osuma.peruste, 'piiri');
});

test('muualla vuorossa oleva ei herää ilman piirivuoroa tai sädettä', () => {
  // Tämä on se joka on pysyttävä epätotena: yöllä herätetty ihminen jolla ei ole mitään
  // tekemistä tapauksen kanssa.
  const osuma = nakeeTehtavan({
    tehtava: tarkistusTehtava(),
    kohde: { id: 'kohde-a', name: 'Kauppakeskus', gps: { lat: 60.17, lon: 24.94 } },
    vartija: 'liisa',
    vuoro: { tila: 'kesken', siteId: 'kohde-b', vartija: 'liisa' },
    // Sata kilometriä pohjoiseen.
    sijainti: { gps: { lat: 61.07, lon: 24.94 } },
  });
  assert.equal(osuma.nakee, false);
});

test('säteellä oleva herätetään', () => {
  const osuma = nakeeTehtavan({
    tehtava: tarkistusTehtava(),
    kohde: { id: 'kohde-a', name: 'Kauppakeskus', gps: { lat: 60.17, lon: 24.94 } },
    vartija: 'liisa',
    vuoro: null,
    sijainti: { gps: { lat: 60.18, lon: 24.95 } },
    sadeKm: 5,
  });
  assert.equal(osuma.nakee, true);
  assert.equal(osuma.peruste, 'sade');
});

test('vuoroton ja sijainniton ei herää', () => {
  const osuma = nakeeTehtavan({
    tehtava: tarkistusTehtava(),
    kohde: { id: 'kohde-a', name: 'Kauppakeskus', gps: { lat: 60.17, lon: 24.94 } },
    vartija: 'liisa',
    vuoro: null,
    sijainti: null,
  });
  assert.equal(osuma.nakee, false);
});
