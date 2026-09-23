// PTT-äänen lähetyksen testit (erä 26, jatko 23.9.2026).
//
// VAIN "EI WEBCODECSIÄ/getUserMediaa" -POLKU ON TESTATTAVISSA TÄÄLLÄ: node --test
// -ympäristössä ei ole navigator.mediaDevicesia, MediaStreamTrackProcessoria eikä
// AudioEncoderia, joten todellista kaappausta/koodausta ei voi ajaa. Sama periaate kuin
// aanivastaanotto.test.ts:llä toiseen suuntaan: tämän moduulin on selvittävä selaimesta
// joka ei tue rajapintoja kaatumatta, ja juuri sitä tässä testataan.
//
// Ajetaan: node --test src/shared/aanilahetys.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { luoLahetin, paatettavaKoodekki, voikoLahettaa } from './aanilahetys.ts';
import { luoLahetysAvain } from './aanisalaus.ts';

test('voikoLahettaa palauttaa false kun getUserMediaa/WebCodecsia ei ole (esim. tämä työpöydän JVM/Node)', async () => {
  // Uudemmat Node-versiot tuovat globaalin navigator-olion (mm. userAgent) mutta EIVÄT
  // mediaDevicesia — juuri tätä eroa voikoLahettaa:n on osattava lukea oikein.
  assert.equal(navigator?.mediaDevices, undefined);
  assert.equal(await voikoLahettaa(), false);
});

test('paatettavaKoodekki palauttaa nullin kun WebCodecsia ei ole', async () => {
  assert.equal(await paatettavaKoodekki(), null);
});

test('Lahetin.aloita palauttaa falsen eikä kaadu kun rajapintoja ei ole', async () => {
  const avain = await luoLahetysAvain();
  const lahetin = luoLahetin();
  const onnistui = await lahetin.aloita(avain, 'opus', () => {});
  assert.equal(onnistui, false);
});

test('lopeta on turvallinen kutsua vaikka aloita ei olisi koskaan onnistunut', async () => {
  const avain = await luoLahetysAvain();
  const lahetin = luoLahetin();
  await lahetin.aloita(avain, 'opus', () => {});
  assert.doesNotThrow(() => lahetin.lopeta());
  assert.doesNotThrow(() => lahetin.lopeta());
});

test('lopeta ennen aloitaa ei kaada mitään', () => {
  const lahetin = luoLahetin();
  assert.doesNotThrow(() => lahetin.lopeta());
});
