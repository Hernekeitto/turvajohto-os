// Georeferoinnin palvelinportin testit.
//
// Tämä on puhdasta matematiikkaa, jonka virhe ei näy virheenä vaan vartijana joka on
// kartalla väärässä kohdassa uskottavalta näyttäen. Juuri siksi se testataan erikseen —
// ja juuri siksi kiinnekohdat ovat SAMAT kuin src/shared/georeferointi.test.ts:ssä.
//
// Kaksi toteutusta samasta laskennasta erkanee ennen pitkää, ellei niillä ole yhteisiä
// lukuja joita molemmat joutuvat toteuttamaan. Nämä testit ovat se side. Jos tämä
// tiedosto muuttuu, sen TS-vastine on luettava samalla.
//
// Ajetaan: node --test server/georeferointi.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { luoMuunnos, taydennaKuvakoordinaatti } from './georeferointi.js';

// Tampereen Ratinan suvanto, sama paikka kuin TS-testissä ja demotapahtumassa.
const LAT = 61.494;
const LON = 23.765;

// Kartta pohjoinen ylöspäin: itään mentäessä x kasvaa, pohjoiseen mentäessä y PIENENEE
// (kuvan y kasvaa alaspäin).
const kalibrointiPohjoinenYlos = [
  { img: { x: 0.2, y: 0.8 }, gps: { lat: LAT, lon: LON } },
  { img: { x: 0.8, y: 0.2 }, gps: { lat: LAT + 0.002, lon: LON + 0.004 } },
];

const laheskaan = (a, b, toleranssi = 1e-6) =>
  assert.ok(Math.abs(a - b) < toleranssi, `${a} ei ole lähellä arvoa ${b}`);

test('kaksi pistettä: kalibrointipisteet osuvat itseensä', () => {
  const muunna = luoMuunnos(kalibrointiPohjoinenYlos);
  for (const p of kalibrointiPohjoinenYlos) {
    const tulos = muunna(p.gps);
    laheskaan(tulos.x, p.img.x);
    laheskaan(tulos.y, p.img.y);
  }
});

test('kaksi pistettä: puoliväli osuu puoliväliin', () => {
  const muunna = luoMuunnos(kalibrointiPohjoinenYlos);
  const tulos = muunna({ lat: LAT + 0.001, lon: LON + 0.002 });
  laheskaan(tulos.x, 0.5);
  laheskaan(tulos.y, 0.5);
});

test('kaksi pistettä: itään kasvattaa x:ää, pohjoiseen pienentää y:tä', () => {
  const muunna = luoMuunnos(kalibrointiPohjoinenYlos);
  const keskus = muunna({ lat: LAT + 0.001, lon: LON + 0.002 });
  const itaan = muunna({ lat: LAT + 0.001, lon: LON + 0.003 });
  const pohjoiseen = muunna({ lat: LAT + 0.0015, lon: LON + 0.002 });
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

test('kolme pistettä: kaikki osuvat itseensä myös kierretyllä kartalla', () => {
  // Kartta noin 30 astetta kierrettynä: kolme pistettä on ainoa tapa saada kierto,
  // vinous ja mittakaavat yhtä aikaa oikein.
  const kierretty = [
    { img: { x: 0.10, y: 0.90 }, gps: { lat: LAT, lon: LON } },
    { img: { x: 0.70, y: 0.60 }, gps: { lat: LAT + 0.001, lon: LON + 0.004 } },
    { img: { x: 0.40, y: 0.10 }, gps: { lat: LAT + 0.003, lon: LON + 0.001 } },
  ];
  const muunna = luoMuunnos(kierretty);
  assert.ok(muunna, 'kolmen pisteen muunnosta ei syntynyt');
  for (const p of kierretty) {
    const tulos = muunna(p.gps);
    laheskaan(tulos.x, p.img.x, 1e-9);
    laheskaan(tulos.y, p.img.y, 1e-9);
  }
});

test('kolme pistettä samalla suoralla ei kelpaa', () => {
  assert.equal(
    luoMuunnos([
      { img: { x: 0.1, y: 0.1 }, gps: { lat: LAT, lon: LON } },
      { img: { x: 0.5, y: 0.5 }, gps: { lat: LAT + 0.001, lon: LON + 0.002 } },
      { img: { x: 0.9, y: 0.9 }, gps: { lat: LAT + 0.002, lon: LON + 0.004 } },
    ]),
    null
  );
});

test('yksi piste tai tyhjä ei kelpaa', () => {
  assert.equal(luoMuunnos([kalibrointiPohjoinenYlos[0]]), null);
  assert.equal(luoMuunnos([]), null);
  assert.equal(luoMuunnos(null), null);
});

test('kelvottomat pisteet pudotetaan ennen laskentaa', () => {
  // Kaksi kelvollista ja kaksi roskaa: muunnoksen on synnyttävä kelvollisista eikä
  // kaaduttava. Vartija ei saa kadota kartalta siksi että kalibrointilistalla on
  // yksi rikkinäinen rivi.
  const muunna = luoMuunnos([
    kalibrointiPohjoinenYlos[0],
    { img: { x: 'x', y: 0.5 }, gps: { lat: LAT, lon: LON } },
    null,
    kalibrointiPohjoinenYlos[1],
  ]);
  assert.ok(muunna, 'kelvollisista pisteistä ei syntynyt muunnosta');
  laheskaan(muunna(kalibrointiPohjoinenYlos[1].gps).x, 0.8);
});

// --- Viestin täydennys ---------------------------------------------------------------

test('natiivin viesti saa kuvakoordinaatin', () => {
  const viesti = { tyyppi: 'sijainti', eventId: 'kohde-1', gps: { lat: LAT + 0.001, lon: LON + 0.002 } };
  const tulos = taydennaKuvakoordinaatti(viesti, kalibrointiPohjoinenYlos);
  laheskaan(tulos.img.x, 0.5);
  laheskaan(tulos.img.y, 0.5);
  // Alkuperäistä ei muuteta: kutsuja voi käyttää sitä yhä.
  assert.equal(viesti.img, undefined);
});

test('selaimen valmis kuvakoordinaatti ei korvaudu', () => {
  // Selain laskee saman asian kalibroinnista jonka se on itse hakenut. Jos palvelin
  // ylikirjoittaisi sen, kaksi toteutusta kilpailisi samasta kentästä eikä lopputulosta
  // voisi jäljittää kumpaankaan.
  const viesti = { gps: { lat: LAT, lon: LON }, img: { x: 0.123, y: 0.456 } };
  const tulos = taydennaKuvakoordinaatti(viesti, kalibrointiPohjoinenYlos);
  assert.deepEqual(tulos.img, { x: 0.123, y: 0.456 });
});

test('kalibroimaton kohde palauttaa viestin ennallaan', () => {
  const viesti = { gps: { lat: LAT, lon: LON } };
  assert.equal(taydennaKuvakoordinaatti(viesti, []), viesti);
  assert.equal(taydennaKuvakoordinaatti(viesti, null), viesti);
});

test('gps:tön viesti palautuu ennallaan', () => {
  const viesti = { tyyppi: 'sijainti', img: { x: 0.1, y: 0.2 } };
  assert.equal(taydennaKuvakoordinaatti(viesti, kalibrointiPohjoinenYlos), viesti);
});
