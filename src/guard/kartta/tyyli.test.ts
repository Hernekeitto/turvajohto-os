// Karttatyylin tarkistus MapLibREN OMALLA VALIDAATTORILLA.
//
// MIKSI TÄMÄ TESTI ON OLEMASSA. Virheellinen tyylitaso ei kaada mitään: MapLibre jättää
// sen pois ja jatkaa. Kartta latautuu, tiet piirtyvät, ja ainoa oire on ettei nimiä
// näy — sama oire kuin puuttuvista kirjasimista, väärästä tasonimestä ja väärästä
// kenttänimestä. Neljä eri syytä, yksi ja sama tyhjä ruutu.
//
// Validaattori karsii niistä yhden pois. Se ei ole koko vastaus, mutta se on halvin
// haara karsia — ja se maksoi itsensä heti: paikannimien `text-size` oli kirjoitettu
// `match` uloimpana ja zoom-interpolaatio sen sisällä, mikä on spesifikaation
// vastaista. Selaimessa se olisi näkynyt siten, että paikannimiä ei vain ole.
//
// `@maplibre/maplibre-gl-style-spec` ei ole suora riippuvuutemme vaan maplibre-gl:n oma
// paketti. Se tuodaan tietoisesti: jos se joskus katoaa node_modulesista, tämä testi
// kaatuu tuontiin — äänekkäästi, eikä hiljaa lakkaa tarkistamasta mitään.
//
// Ajetaan: node --test src/guard/kartta/tyyli.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';

import { karttatyyli } from './tyyli.ts';

const tyyli = karttatyyli();
const tasot = tyyli.layers as unknown as Array<Record<string, unknown>>;
const tekstitasot = tasot.filter((t) => t.type === 'symbol');

test('tyyli kelpaa MapLibren spesifikaatiolle', () => {
  const virheet = validateStyleMin(tyyli as never).map((v) => v.message);
  assert.deepEqual(virheet, []);
});

test('glyphs-osoitteessa on molemmat paikanpitäjät', () => {
  // Puuttuva {fontstack} tai {range} ei ole syntaksivirhe vaan osoite joka haetaan
  // kirjaimellisesti — jolloin jokainen merkkilohko hakee samaa 404:ää.
  assert.match(tyyli.glyphs, /\{fontstack\}/);
  assert.match(tyyli.glyphs, /\{range\}/);
});

test('jokaisella tekstitasolla on täsmälleen yksi kirjasin', () => {
  // Kahden kirjasimen lista tuottaisi yhdistelmäpyynnön "A,B/0-255.pbf", jota
  // staattinen tiedostopalvelin ei osaa koostaa. Ks. tyyli.ts:n alku.
  assert.ok(tekstitasot.length > 0, 'tekstitasoja ei ole lainkaan');
  for (const taso of tekstitasot) {
    const fontit = (taso.layout as Record<string, unknown>)['text-font'] as unknown[];
    assert.equal(fontit.length, 1, `${taso.id}: ${JSON.stringify(fontit)}`);
  }
});

test('tekstit piirtyvät viivojen jälkeen', () => {
  // Piirtojärjestys on listan järjestys. Jos tekstitaso liukuu viivatason edelle, katu
  // piirtyy oman nimensä päälle eikä nimeä lue enää mistään.
  const ekaTeksti = tasot.findIndex((t) => t.type === 'symbol');
  const viimeViiva = tasot.map((t) => t.type).lastIndexOf('line');
  assert.ok(ekaTeksti > viimeViiva, `teksti ${ekaTeksti}, viiva ${viimeViiva}`);
});

test('kadunnimet vasta lähellä', () => {
  // Raja on toimintapäätös eikä tyyliseikka: kauempaa nimiä ei ehdi lukea ja ne
  // peittäisivät yksikkömerkit. Jos tämä luku joskus lasketaan, se on harkittava
  // uudelleen eikä livahdettava sisään muun muutoksen mukana.
  const nimet = tasot.find((t) => t.id === 'tiennimet');
  assert.equal(nimet?.minzoom, 13);
});

test('nimikenttänä name:fi ja varalla name', () => {
  // Kaksikielisissä kunnissa OSM:n `name` on "Helsinki / Helsingfors". Jos varareitti
  // katoaisi, ruotsinkielisiltä alueilta katoaisivat nimet kokonaan.
  for (const taso of tekstitasot) {
    const kentta = JSON.stringify((taso.layout as Record<string, unknown>)['text-field']);
    if (taso.id === 'tienumerot') continue; // numero ei ole nimi
    assert.ok(kentta.includes('name:fi'), `${taso.id}: ${kentta}`);
    assert.ok(kentta.includes('coalesce'), `${taso.id}: ${kentta}`);
  }
});
