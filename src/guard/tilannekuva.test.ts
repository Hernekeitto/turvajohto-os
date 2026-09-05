// Hälytyskeskuksen tilannekuvan testit.
//
// Painopiste on siinä mitä päivystäjä NÄKEE VÄÄRIN jos kokoaminen menee pieleen: kohde
// näyttää rauhalliselta vaikka siellä on lauennut hälytys, vartija katoaa "kentällä"
// -listalta vaikka hänellä on ajastin käynnissä, tai tapahtumavirta esittää vanhan
// merkinnän uusimpana. Kaikki kolme ovat virheitä joita ruudulta ei huomaa.
//
// Ajetaan: node --test src/guard/tilannekuva.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  kentalla, kohteenTilanne, kohteenToiminnot, lyhytAika, tapahtumavirta, tyhjatLahteet,
  type Lahteet,
} from './tilannekuva.ts';
import type { Halytys } from '../shared/halytykset.ts';
import type { Kierros, TehtavaSuoritus } from './tyypit.ts';

const NYT = Date.parse('2026-09-05T12:00:00.000Z');
const hetki = (minuuttiaSitten: number) => new Date(NYT - minuuttiaSitten * 60_000).toISOString();

const halytys = (osat: Partial<Halytys>): Halytys => ({
  id: 'h1',
  tyyppi: 'ajastin',
  tila: 'kaynnissa',
  vartija: 'vartija1',
  eventId: 'kohde1',
  alkoi: hetki(10),
  eraantyy: NYT + 20 * 60_000,
  kestoMin: 30,
  kuvaus: '',
  laukesi: null,
  paattyi: null,
  gps: null,
  vyohyke: null,
  kuittaaja: null,
  kuittausHuomio: '',
  eskalointi: null,
  historia: [],
  ...osat,
});

const kierros = (osat: Partial<Kierros>): Kierros => ({
  id: 'k1',
  siteId: 'kohde1',
  templateId: 'p1',
  templateNimi: 'Yökierros',
  templateVersio: 1,
  vartija: 'vartija1',
  alkoi: hetki(30),
  paattyi: null,
  tila: 'kesken',
  pisteet: [],
  ...osat,
});

const tehtava = (osat: Partial<TehtavaSuoritus>): TehtavaSuoritus => ({
  id: 't1',
  siteId: 'kohde1',
  tehtavaId: 'te1',
  tehtavaNimi: 'Ovien tarkistus',
  vartija: 'vartija2',
  aika: hetki(45),
  suoritettu: true,
  ...osat,
});

const lahteilla = (osat: Partial<Lahteet>): Lahteet => ({ ...tyhjatLahteet(), ...osat });

test('lauennut hälytys tekee kohteesta kriittisen', () => {
  const tilanne = kohteenTilanne('kohde1', lahteilla({
    halytykset: [halytys({ tila: 'lauennut', laukesi: hetki(2) })],
  }));
  assert.equal(tilanne.kiireys, 'kriittinen');
  assert.equal(tilanne.lauenneet, 1);
});

test('käynnissä oleva ajastin on varoitus, ei kriittinen — eikä toisen kohteen ajastin näy', () => {
  const lahteet = lahteilla({
    halytykset: [halytys({ id: 'h1' }), halytys({ id: 'h2', eventId: 'kohde2' })],
  });
  const yksi = kohteenTilanne('kohde1', lahteet);
  assert.equal(yksi.kiireys, 'varoitus');
  assert.equal(yksi.ajastimet, 1);
  assert.equal(yksi.seuraavaEraantyy, NYT + 20 * 60_000);
  assert.equal(kohteenTilanne('kohde3', lahteet).kiireys, 'rauhallinen');
});

test('kohteen viimeisin merkintä on uusin kaikista lähteistä, ei viimeksi luetusta', () => {
  const tilanne = kohteenTilanne('kohde1', lahteilla({
    tehtavat: [tehtava({ aika: hetki(200) })],
    // Kierroksen piste on tuoreempi kuin kierroksen alku: hiljaisuutta laskettaessa
    // merkitsee viimeisin elonmerkki eikä se milloin kierros aloitettiin.
    kierrokset: [kierros({ alkoi: hetki(90), pisteet: [
      { pisteId: 'a', nimi: 'Portti', kuitattu: hetki(12), tapa: 'qr' },
      { pisteId: 'b', nimi: 'Katos', kuitattu: null, tapa: null },
    ] })],
  }));
  assert.equal(tilanne.viimeksi, hetki(12));
});

test('kentällä-lista kokoaa saman vartijan yhdeksi riviksi ja kertoo viimeisimmän työn', () => {
  const lista = kentalla(lahteilla({
    kierrokset: [kierros({ vartija: 'vartija1', alkoi: hetki(120), tila: 'valmis', paattyi: hetki(100) })],
    tehtavat: [tehtava({ vartija: 'vartija1', siteId: 'kohde2', aika: hetki(20) })],
  }), NYT);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].vartija, 'vartija1');
  assert.deepEqual(lista[0].kohteet, ['kohde1', 'kohde2']);
  assert.equal(lista[0].mita, 'Tehtävä: Ovien tarkistus');
});

test('avoin ajastin pitää vartijan listalla vaikka merkintä olisi ikkunaa vanhempi', () => {
  const vanha = hetki(10 * 60);
  const lista = kentalla(lahteilla({
    halytykset: [halytys({ alkoi: vanha, eraantyy: NYT + 5 * 60_000 })],
  }), NYT);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].ajastin?.id, 'h1');
});

test('ikkunaa vanhempi kuittaus ei tee vartijasta kentällä olevaa', () => {
  const lista = kentalla(lahteilla({ tehtavat: [tehtava({ aika: hetki(9 * 60) })] }), NYT);
  assert.equal(lista.length, 0);
});

test('tapahtumavirta on aikajärjestyksessä uusin ensin ja laukeaminen on kriittinen', () => {
  const virta = tapahtumavirta(lahteilla({
    halytykset: [halytys({
      tila: 'lauennut',
      laukesi: hetki(5),
      historia: [
        { ts: hetki(35), tapahtuma: 'luotu', user: 'vartija1', teksti: 'Ajastin 30 min' },
        { ts: hetki(5), tapahtuma: 'laukesi', user: null, teksti: 'Määräaika umpeutui' },
      ],
    })],
    tehtavat: [tehtava({ aika: hetki(20) })],
  }));

  assert.deepEqual(virta.map((t) => t.otsikko), [
    'HÄLYTYS LAUKESI · vartija1',
    'Tehtävä kuitattu',
    'Hälytys luotu · vartija1',
  ]);
  assert.equal(virta[0].taso, 'kriittinen');
  // Ajastimen käynnistys on vuoron rutiinia eikä saa värittyä virrassa tapahtumaksi.
  assert.equal(virta[2].taso, 'rauhallinen');
});

test('hätäpainikkeen painallus on virrassa kriittinen jo luontimerkinnästä', () => {
  const virta = tapahtumavirta(lahteilla({
    halytykset: [halytys({
      tyyppi: 'panic',
      historia: [{ ts: hetki(1), tapahtuma: 'luotu', user: 'vartija1', teksti: 'Hätäpainike' }],
    })],
  }));
  assert.equal(virta[0].taso, 'kriittinen');
});

test('tapahtumavirta rajataan pyydettyyn pituuteen', () => {
  const tehtavat = Array.from({ length: 60 }, (_, i) => tehtava({ id: `t${i}`, aika: hetki(i + 1) }));
  assert.equal(tapahtumavirta(lahteilla({ tehtavat }), 25).length, 25);
});

// --- Kohteen valikon tiivistelmät ---------------------------------------------------

const toiminnot = (lahteet: Lahteet, osat: Partial<{ tehtaviaMaaritelty: number; kayttaja: string }> = {}) =>
  kohteenToiminnot('kohde1', lahteet, {
    tehtaviaMaaritelty: osat.tehtaviaMaaritelty ?? 0,
    kayttaja: osat.kayttaja ?? 'vartija1',
    nyt: NYT,
  });

test('kierrospainike kertoo tehdyt kierrokset eikä kaikkia kierroksia', () => {
  const t = toiminnot(lahteilla({
    kierrokset: [
      kierros({ id: 'k1', tila: 'valmis', paattyi: hetki(120) }),
      kierros({ id: 'k2', tila: 'valmis', paattyi: hetki(60) }),
      kierros({ id: 'k3', tila: 'kesken' }),
      // Toisen kohteen kierros ei saa näkyä tämän kohteen luvussa.
      kierros({ id: 'k4', siteId: 'kohde2', tila: 'valmis', paattyi: hetki(10) }),
    ],
  }));
  assert.match(t.kierros.teksti, /^2 kierrosta tehty/);
  assert.deepEqual(t.kierros.huomio, { teksti: 'kesken', taso: 'varoitus' });
});

test('tyhjä kohde saa tekstin eikä nollaa', () => {
  const t = toiminnot(tyhjatLahteet());
  assert.equal(t.kierros.teksti, 'Ei vielä kierroksia');
  assert.equal(t.toimenpide.teksti, 'Ei toimenpidekirjauksia');
  assert.equal(t.tehtavat.teksti, 'Kohteelle ei ole määritelty tehtäviä');
  // Puuttuva kierrospohja on huomio: ilman pohjaa kierrosta ei voi aloittaa lainkaan.
  assert.deepEqual(t.kierrospohjat.huomio, { teksti: 'puuttuu', taso: 'varoitus' });
  assert.equal(t.halytykset.huomio, null);
});

test('kadonnut avain menee kaluston huomiossa poikkeaman edelle', () => {
  const t = toiminnot(lahteilla({
    avaimet: [
      { id: 'a1', ownerId: 'kohde1', omistaja: 'kohde', tunnus: 'A-1', kuvaus: '', tila: 'kadonnut', haltija: null, otettu: null, luotu: hetki(500), historia: [] },
      { id: 'a2', ownerId: 'kohde1', omistaja: 'kohde', tunnus: 'A-2', kuvaus: '', tila: 'ulkona', haltija: 'vartija1', otettu: hetki(60), luotu: hetki(500), historia: [] },
      // Käytöstä poistettua avainta ei lasketa mukaan.
      { id: 'a3', ownerId: 'kohde1', omistaja: 'kohde', tunnus: 'A-3', kuvaus: '', tila: 'poistettu', haltija: null, otettu: null, luotu: hetki(500), historia: [] },
    ],
    poikkeamat: [
      { id: 'p1', ownerId: 'kohde1', omistaja: 'kohde', varuste: 'Valaisin', kuvaus: '', vakavuus: 'kriittinen', tila: 'avoin', ilmoittaja: 'vartija1', ilmoitettu: hetki(30), kasittelija: null, kasitelty: null, kasittelyHuomio: '', halytysId: null },
    ],
  }));
  assert.match(t.kalusto.teksti, /^2 avainta, 1 luovutettuna · 1 poikkeama avoinna$/);
  assert.deepEqual(t.kalusto.huomio, { teksti: 'avain kadonnut', taso: 'kriittinen' });
});

test('tiedotteen kuittaamattomuus katsotaan katsojan omalta kohdalta', () => {
  const tiedote = {
    id: 'b1', ownerId: 'kohde1', omistaja: 'kohde' as const, otsikko: 'Portti kiinni',
    viesti: '', laatija: 'esimies', luotu: hetki(60),
    vanhenee: new Date(NYT + 3600_000).toISOString(), voimassaTuntia: 8,
    kuittaukset: [{ user: 'vartija1', ts: hetki(50) }], peruttu: null,
  };
  assert.equal(toiminnot(lahteilla({ tiedotteet: [tiedote] }), { kayttaja: 'vartija1' }).tiedotteet.huomio, null);
  assert.deepEqual(
    toiminnot(lahteilla({ tiedotteet: [tiedote] }), { kayttaja: 'vartija2' }).tiedotteet.huomio,
    { teksti: 'kuittaamatta', taso: 'varoitus' }
  );
});

test('lauennut hälytys ohittaa ajastimen hälytyspainikkeen huomiossa', () => {
  const vain = toiminnot(lahteilla({ halytykset: [halytys({})] }));
  assert.deepEqual(vain.halytykset.huomio, { teksti: 'ajastin', taso: 'varoitus' });
  const molemmat = toiminnot(lahteilla({
    halytykset: [halytys({}), halytys({ id: 'h2', tyyppi: 'panic', tila: 'lauennut', laukesi: hetki(3) })],
  }));
  assert.deepEqual(molemmat.halytykset.huomio, { teksti: 'lauennut', taso: 'kriittinen' });
});

test('lyhytAika näyttää päivän vain jos se ei ole tänään', () => {
  assert.match(lyhytAika(hetki(30), NYT), /^klo \d\d\.\d\d$/);
  assert.match(lyhytAika(hetki(60 * 30), NYT), /^\d+\.\d+\. klo \d\d\.\d\d$/);
  assert.equal(lyhytAika(null, NYT), '');
});
