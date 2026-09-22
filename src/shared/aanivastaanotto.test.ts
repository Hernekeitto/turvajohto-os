// PTT-äänen vastaanoton testit (erä 26, vaihe 8/9).
//
// VAIN "EI WEBCODECSIÄ" -POLKU ON TESTATTAVISSA TÄÄLLÄ: node --test -ympäristössä ei
// ole AudioDecoderia eikä AudioContextia, joten todellista dekoodausta/toistoa ei voi
// ajaa. Se on kuitenkin oma, todellinen sopimus: tämän moduulin on selvittävä
// selaimesta joka ei tue WebCodecsia kaatumatta, ja juuri sitä tässä testataan —
// sama periaate kuin muun tämän hankkeen "puuttuva kyky näkyy hallittuna ei-minä"
// -käytännöllä (esim. Sijainti.java: onPalvelut puuttuessa).
//
// Ajetaan: node --test src/shared/aanivastaanotto.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { luoVastaanotin, voikoPurkaa } from './aanivastaanotto.ts';
import { luoLahetysAvain } from './aanisalaus.ts';

test('voikoPurkaa palauttaa false kun AudioDecoderia ei ole (esim. tämä työpöydän JVM/Node)', async () => {
  assert.equal(typeof (globalThis as { AudioDecoder?: unknown }).AudioDecoder, 'undefined');
  assert.equal(await voikoPurkaa('opus'), false);
  assert.equal(await voikoPurkaa('aac'), false);
});

test('Vastaanotin.aloita palauttaa false eikä kaadu kun AudioDecoderia ei ole', async () => {
  const avain = await luoLahetysAvain();
  const vastaanotin = luoVastaanotin();
  const onnistui = await vastaanotin.aloita(avain, 'opus');
  assert.equal(onnistui, false);
});

test('vastaanotaKehys ennen aloita:a ei kaada mitään (ei avainta eikä dekooderia vielä)', () => {
  const vastaanotin = luoVastaanotin();
  assert.doesNotThrow(() => vastaanotin.vastaanotaKehys('AAAA'));
});

test('lopeta on turvallinen kutsua vaikka aloita ei olisi koskaan onnistunut', async () => {
  const avain = await luoLahetysAvain();
  const vastaanotin = luoVastaanotin();
  await vastaanotin.aloita(avain, 'opus');
  assert.doesNotThrow(() => vastaanotin.lopeta());
  assert.doesNotThrow(() => vastaanotin.lopeta());
});
