// Man-down-tunnistuksen testit.
//
// Nämä ovat ainoa tapa todentaa tunnistus ilman että joku oikeasti kaatuu: säännöt
// testataan syöttämällä anturilukuja. Painopiste on väärissä hälytyksissä — pöydällä
// makaava puhelin ei saa soittaa kenellekään, ja juuri se on tavallisin tilanne.
//
// Ajetaan: node --test src/shared/mandown.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  alkutila, syota, voimakkuus,
  LEPO, ISKU_RAJA, ISKUN_JALKEEN_MS, LIIKKUMATON_MS, NAYTEVALI_MS,
} from './mandown.ts';

// Syöttää sarjan näytteitä ja palauttaa ensimmäisen epäilyn (tai nullin).
const aja = (
  naytteet: { voimakkuus: number; kesto: number }[],
  asetukset = {},
  alkuTs = 1_000_000
) => {
  let tila = alkutila();
  let ts = alkuTs;
  let epaily: string | null = null;
  for (const jakso of naytteet) {
    const loppu = ts + jakso.kesto;
    while (ts <= loppu) {
      const tulos = syota(tila, { ts, voimakkuus: jakso.voimakkuus }, asetukset);
      tila = tulos.tila;
      if (tulos.epaily && !epaily) epaily = tulos.epaily;
      ts += NAYTEVALI_MS;
    }
  }
  return epaily;
};

// --- Voimakkuus -------------------------------------------------------------------

test('voimakkuus on kolmen akselin pituus', () => {
  assert.equal(voimakkuus({ x: 0, y: 0, z: 9.81 }), 9.81);
  assert.equal(Math.round(voimakkuus({ x: 3, y: 4, z: 0 })!), 5);
});

test('puuttuva anturidata ei kaada tunnistusta', () => {
  assert.equal(voimakkuus(null), null);
  assert.equal(voimakkuus({ x: null, y: null, z: null }), null);
  assert.equal(voimakkuus({ x: 1, y: 2 }), null);
});

// --- Kaatuminen -------------------------------------------------------------------

test('isku ja sen jälkeinen liikkumattomuus tunnistetaan kaatumiseksi', () => {
  const epaily = aja([
    { voimakkuus: 11, kesto: 3000 },
    { voimakkuus: ISKU_RAJA + 10, kesto: 0 },
    { voimakkuus: LEPO, kesto: ISKUN_JALKEEN_MS + 1000 },
  ]);
  assert.equal(epaily, 'kaatuminen');
});

test('isku josta noustaan ei ole kaatuminen', () => {
  const epaily = aja([
    { voimakkuus: ISKU_RAJA + 10, kesto: 0 },
    { voimakkuus: LEPO, kesto: 4000 },
    // Liikettä ennen kuin kahdentoista sekunnin raja täyttyy.
    { voimakkuus: 13, kesto: 2000 },
    { voimakkuus: LEPO, kesto: 6000 },
  ]);
  assert.equal(epaily, null);
});

test('liikkumattomuus joka alkaa selvästi iskun jälkeen ei liity siihen', () => {
  const epaily = aja([
    { voimakkuus: ISKU_RAJA + 10, kesto: 0 },
    // Kymmenen sekuntia liikettä iskun jälkeen: kyseessä ei ole kaatuminen vaan esimerkiksi
    // puhelimen pudottaminen kädestä ja sen nostaminen.
    { voimakkuus: 13, kesto: 10000 },
    { voimakkuus: LEPO, kesto: ISKUN_JALKEEN_MS + 1000 },
  ]);
  assert.equal(epaily, null);
});

// --- Liikkumattomuus --------------------------------------------------------------

test('pitkä liikkumattomuus ilman iskua tunnistetaan omana epäilynään', () => {
  const epaily = aja([{ voimakkuus: LEPO, kesto: LIIKKUMATON_MS + 1000 }]);
  assert.equal(epaily, 'liikkumaton');
});

test('lyhyt paikallaanolo ei hälytä', () => {
  // Puhelin pöydällä minuutin ajan lomaketta täyttäessä.
  const epaily = aja([{ voimakkuus: LEPO, kesto: 60_000 }]);
  assert.equal(epaily, null);
});

test('kävely ei hälytä koskaan', () => {
  // Kävelyn kiihtyvyys heiluu lepoarvon ympärillä selvästi enemmän kuin sallittu poikkeama.
  let tila = alkutila();
  let ts = 1_000_000;
  let epailyja = 0;
  for (let i = 0; i < 4 * 60 * 20; i++) {
    const v = LEPO + Math.sin(i / 2) * 3;
    const tulos = syota(tila, { ts, voimakkuus: v });
    tila = tulos.tila;
    if (tulos.epaily) epailyja++;
    ts += NAYTEVALI_MS;
  }
  assert.equal(epailyja, 0);
});

// --- Tilan nollaus ----------------------------------------------------------------

test('sama liikkumattomuus ei tuota epäilyä joka näytteestä', () => {
  let tila = alkutila();
  let ts = 1_000_000;
  let epailyja = 0;
  // Kaksi kertaa raja-ajan verran paikallaan: epäilyjä saa syntyä enintään kaksi, ei
  // neljä sekunnissa.
  const loppu = ts + LIIKKUMATON_MS * 2 + 2000;
  while (ts <= loppu) {
    const tulos = syota(tila, { ts, voimakkuus: LEPO });
    tila = tulos.tila;
    if (tulos.epaily) epailyja++;
    ts += NAYTEVALI_MS;
  }
  assert.equal(epailyja, 2);
});

test('lyhennetty raja-aika toimii testiasetuksena', () => {
  const epaily = aja([{ voimakkuus: LEPO, kesto: 6000 }], { liikkumatonMs: 5000 });
  assert.equal(epaily, 'liikkumaton');
});
