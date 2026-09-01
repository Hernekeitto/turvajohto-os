// Georeferoinnin testit. Tämä on puhdasta matematiikkaa, jonka virhe ei näy virheenä
// vaan vartijana joka on kartalla väärässä kohdassa uskottavalta näyttäen — juuri siksi
// se testataan erikseen.
//
// Ajetaan: node --test src/shared/georeferointi.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { luoMuunnos, kuvanSisalla, vyohykePisteessa } from './georeferointi.ts';

// Tampereen Ratinan suvanto, sama paikka kuin demotapahtumassa.
const LAT = 61.494;
const LON = 23.765;

// Kartta pohjoinen ylöspäin: itään mentäessä x kasvaa, pohjoiseen mentäessä y PIENENEE
// (kuvan y kasvaa alaspäin).
const kalibrointiPohjoinenYlos = [
  { img: { x: 0.2, y: 0.8 }, gps: { lat: LAT, lon: LON } },
  { img: { x: 0.8, y: 0.2 }, gps: { lat: LAT + 0.002, lon: LON + 0.004 } },
];

const laheskaan = (a: number, b: number, toleranssi = 1e-6) =>
  assert.ok(Math.abs(a - b) < toleranssi, `${a} ei ole lähellä arvoa ${b}`);

test('kaksi pistettä: kalibrointipisteet osuvat itseensä', () => {
  const muunna = luoMuunnos(kalibrointiPohjoinenYlos)!;
  for (const p of kalibrointiPohjoinenYlos) {
    const tulos = muunna(p.gps)!;
    laheskaan(tulos.x, p.img.x);
    laheskaan(tulos.y, p.img.y);
  }
});

test('kaksi pistettä: puoliväli osuu puoliväliin', () => {
  const muunna = luoMuunnos(kalibrointiPohjoinenYlos)!;
  const tulos = muunna({ lat: LAT + 0.001, lon: LON + 0.002 })!;
  laheskaan(tulos.x, 0.5);
  laheskaan(tulos.y, 0.5);
});

test('kaksi pistettä: itään siirtyminen kasvattaa x:ää, pohjoiseen pienentää y:tä', () => {
  const muunna = luoMuunnos(kalibrointiPohjoinenYlos)!;
  const keskus = muunna({ lat: LAT + 0.001, lon: LON + 0.002 })!;
  const itaan = muunna({ lat: LAT + 0.001, lon: LON + 0.003 })!;
  const pohjoiseen = muunna({ lat: LAT + 0.0015, lon: LON + 0.002 })!;
  assert.ok(itaan.x > keskus.x, 'itään siirtyminen ei kasvattanut x:ää');
  assert.ok(pohjoiseen.y < keskus.y, 'pohjoiseen siirtyminen ei pienentänyt y:tä');
});

test('kaksi pistettä samalla pituuspiirillä ei kelpaa', () => {
  assert.equal(
    luoMuunnos([
      { img: { x: 0.2, y: 0.8 }, gps: { lat: LAT, lon: LON } },
      { img: { x: 0.8, y: 0.2 }, gps: { lat: LAT + 0.002, lon: LON } },
    ]),
    null
  );
});

test('kolme pistettä: kaikki kalibrointipisteet osuvat itseensä myös kierretyllä kartalla', () => {
  // Kartta käännetty: pohjoinen osoittaa kuvassa oikealle ylös.
  const kierretty = [
    { img: { x: 0.5, y: 0.5 }, gps: { lat: LAT, lon: LON } },
    { img: { x: 0.9, y: 0.3 }, gps: { lat: LAT + 0.002, lon: LON + 0.002 } },
    { img: { x: 0.3, y: 0.1 }, gps: { lat: LAT + 0.003, lon: LON - 0.001 } },
  ];
  const muunna = luoMuunnos(kierretty)!;
  for (const p of kierretty) {
    const tulos = muunna(p.gps)!;
    laheskaan(tulos.x, p.img.x, 1e-5);
    laheskaan(tulos.y, p.img.y, 1e-5);
  }
});

test('kolme pistettä samalla suoralla ei kelpaa', () => {
  assert.equal(
    luoMuunnos([
      { img: { x: 0.1, y: 0.1 }, gps: { lat: LAT, lon: LON } },
      { img: { x: 0.2, y: 0.2 }, gps: { lat: LAT + 0.001, lon: LON + 0.001 } },
      { img: { x: 0.3, y: 0.3 }, gps: { lat: LAT + 0.002, lon: LON + 0.002 } },
    ]),
    null
  );
});

test('liian vähän pisteitä palauttaa nullin', () => {
  assert.equal(luoMuunnos([]), null);
  assert.equal(luoMuunnos(null), null);
  assert.equal(luoMuunnos([kalibrointiPohjoinenYlos[0]]), null);
});

test('kelvottomat pisteet karsitaan ennen sovitusta', () => {
  assert.equal(
    luoMuunnos([
      kalibrointiPohjoinenYlos[0],
      { img: { x: NaN, y: 0.5 }, gps: { lat: LAT, lon: LON + 0.001 } },
    ] as never),
    null
  );
});

test('kuvan ulkopuolinen piste tunnistetaan', () => {
  const muunna = luoMuunnos(kalibrointiPohjoinenYlos)!;
  const kaukana = muunna({ lat: LAT + 0.05, lon: LON + 0.05 })!;
  assert.equal(kuvanSisalla(kaukana), false);
  assert.equal(kuvanSisalla(muunna({ lat: LAT + 0.001, lon: LON + 0.002 })!), true);
});

test('vyöhyke tunnistetaan pisteestä', () => {
  const vyohykkeet = [
    { id: 'a', nimi: 'Lohko C', vari: 'indigo', pisteet: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.4 }, { x: 0.1, y: 0.4 }] },
    { id: 'b', nimi: 'Portti 2', vari: 'amber', pisteet: [{ x: 0.6, y: 0.6 }, { x: 0.9, y: 0.6 }, { x: 0.9, y: 0.9 }, { x: 0.6, y: 0.9 }] },
  ];
  assert.equal(vyohykePisteessa(vyohykkeet, { x: 0.25, y: 0.25 })?.nimi, 'Lohko C');
  assert.equal(vyohykePisteessa(vyohykkeet, { x: 0.75, y: 0.75 })?.nimi, 'Portti 2');
  assert.equal(vyohykePisteessa(vyohykkeet, { x: 0.5, y: 0.5 }), null);
  // Vajaa monikulmio ohitetaan eikä kaada hakua.
  assert.equal(vyohykePisteessa([{ id: 'c', nimi: 'x', vari: 'slate', pisteet: [{ x: 0, y: 0 }] }], { x: 0, y: 0 }), null);
});
