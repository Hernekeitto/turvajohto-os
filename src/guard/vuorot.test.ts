// Vuoron myöhästymislaskennan testit (erä 24, unohtunut vuoro).
//
// Laskenta on selaimessa ja määräaika palvelimelta. Palvelinpuolen testit kattavat
// määräajan muodostamisen kellonajasta (server/vuorot.test.js, yövuoro mukaan lukien);
// nämä kattavat sen mitä siitä luvusta päätellään.
//
// Ajetaan: node --test src/guard/vuorot.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  myohassaMinuutteina, onUnohtunutVuoro, UNOHTUNUT_VARTIJA_MIN, UNOHTUNUT_HALKE_MIN,
  type KaynnissaVuoro,
} from './vuorot.ts';

const T = (iso: string) => Date.parse(iso);

test('ennen määräaikaa ei ole myöhässä', () => {
  assert.equal(
    myohassaMinuutteina('2026-09-15T15:00:00.000Z', T('2026-09-15T14:59:00.000Z')),
    null
  );
});

test('määräaika tasan ei vielä ole myöhässä', () => {
  // Nolla minuuttia yli ei ole myöhässä: vuoro päättyy silloin kun sen pitääkin.
  assert.equal(
    myohassaMinuutteina('2026-09-15T15:00:00.000Z', T('2026-09-15T15:00:00.000Z')),
    null
  );
});

test('myöhästyminen lasketaan minuutteina', () => {
  assert.equal(
    myohassaMinuutteina('2026-09-15T15:00:00.000Z', T('2026-09-15T15:12:30.000Z')),
    12
  );
});

test('puuttuva määräaika ei ole myöhässä', () => {
  // Kellonajaton lisävuoro on olemassa, eikä puuttuvaa rajoitetta saa tulkita
  // rajoitteeksi — se olisi juuri se virhe jossa tyhjä kenttä alkaa tarkoittaa jotain.
  assert.equal(myohassaMinuutteina(null), null);
  assert.equal(myohassaMinuutteina(undefined), null);
  assert.equal(myohassaMinuutteina(''), null);
});

test('kelvoton määräaika ei kaada eikä hälytä', () => {
  assert.equal(myohassaMinuutteina('ei ole aika'), null);
});

test('vartijan raja tulee ennen hälytyskeskuksen rajaa', () => {
  // Ensimmäinen on muistutus jonka vartija voi hoitaa itse, toinen on tehtävä jonka
  // päivystäjä ottaa hoitaakseen. Jos järjestys kääntyisi, vartija saisi tietää asiasta
  // vasta kun joku on jo alkanut selvittää sitä.
  assert.ok(UNOHTUNUT_VARTIJA_MIN < UNOHTUNUT_HALKE_MIN);
  assert.equal(UNOHTUNUT_VARTIJA_MIN, 10);
  assert.equal(UNOHTUNUT_HALKE_MIN, 15);
});

test('rajat osuvat oikein myöhästymisminuutteihin', () => {
  const maaraaika = '2026-09-15T15:00:00.000Z';
  const min = (m: number) => myohassaMinuutteina(maaraaika, T(maaraaika) + m * 60_000);

  // Yhdeksän minuuttia: kumpikaan ei vielä reagoi.
  assert.ok((min(9) as number) < UNOHTUNUT_VARTIJA_MIN);
  // Kymmenen: vartija saa huomion, hälytyskeskus ei vielä.
  assert.ok((min(10) as number) >= UNOHTUNUT_VARTIJA_MIN);
  assert.ok((min(10) as number) < UNOHTUNUT_HALKE_MIN);
  // Viisitoista: nousee hälytyskeskukseen.
  assert.ok((min(15) as number) >= UNOHTUNUT_HALKE_MIN);
});

// --- onUnohtunutVuoro (18.9.2026) -----------------------------------------------------
//
// Sama päätös tehdään kolmessa paikassa: tilanneluvussa, kohteen kiireystasossa ja
// vuorolistan järjestyksessä. Yksi funktio eikä kolme kopiota `>= UNOHTUNUT_HALKE_MIN`
// -vertailua — kopioista yksi jäisi korjaamatta sinä päivänä kun rajaa muutetaan, ja
// ruudulla kaksi lukua olisi eri mieltä samasta vuorosta.

const MAARAAIKA = '2026-09-15T15:00:00.000Z';
const vuoro = (paattyyArvio: string | null | undefined): KaynnissaVuoro => ({
  id: 'v1', vartija: 'Piiri 301', siteId: 'kohde1',
  alkoi: '2026-09-15T07:00:00.000Z', vuorotyyppiNimi: 'Päivävuoro', paattyyArvio,
});

test('onUnohtunutVuoro noudattaa hälytyskeskuksen rajaa', () => {
  const kello = (m: number) => T(MAARAAIKA) + m * 60_000;
  assert.equal(onUnohtunutVuoro(vuoro(MAARAAIKA), kello(0)), false);
  assert.equal(onUnohtunutVuoro(vuoro(MAARAAIKA), kello(14)), false);
  assert.equal(onUnohtunutVuoro(vuoro(MAARAAIKA), kello(15)), true);
  assert.equal(onUnohtunutVuoro(vuoro(MAARAAIKA), kello(111)), true);
});

test('kellonajaton vuoro ei ole koskaan unohtunut', () => {
  // Lisävuorolla ei ole päättymiskellonaikaa. Myöhästymistä ei saa arvata vuoron
  // pituudesta: pitkä vuoro on eri asia kuin päättämättä jäänyt vuoro.
  assert.equal(onUnohtunutVuoro(vuoro(null), T(MAARAAIKA) + 600 * 60_000), false);
  assert.equal(onUnohtunutVuoro(vuoro(undefined), T(MAARAAIKA) + 600 * 60_000), false);
});
