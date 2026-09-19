// PTT-äänen kehyssalauksen testit (erä 26, vaihe 4, vaihtoehto A -PoC).
//
// AES-GCM-kierto ajetaan oikealla Web Crypto -rajapinnalla (Node tarjoaa saman
// crypto.subtle-rajapinnan kuin selain) — ei mikään mock.
//
// Ajetaan: node --test src/shared/aanisalaus.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  luoLahetysAvain, vieLahetysAvain, tuoLahetysAvain, salaaKehys, puraKehys,
} from './aanisalaus.ts';

test('salaaKehys ja puraKehys palauttavat alkuperäisen kehyksen muuttumattomana', async () => {
  const lahetysAvain = await luoLahetysAvain();
  const kehys = new TextEncoder().encode('opus-kehys-esimerkkidataa').buffer;
  const paketti = await salaaKehys(lahetysAvain, 0n, kehys);
  const purettu = await puraKehys(lahetysAvain, paketti);
  assert.deepEqual(new Uint8Array(purettu), new Uint8Array(kehys));
});

test('peräkkäiset kehykset kasvavalla laskurilla puretaan oikein', async () => {
  const lahetysAvain = await luoLahetysAvain();
  for (let laskuri = 0n; laskuri < 5n; laskuri++) {
    const kehys = new TextEncoder().encode(`kehys-${laskuri}`).buffer;
    const paketti = await salaaKehys(lahetysAvain, laskuri, kehys);
    const purettu = await puraKehys(lahetysAvain, paketti);
    assert.deepEqual(new TextDecoder().decode(purettu), `kehys-${laskuri}`);
  }
});

test('puraKehys hylkää väärällä avaimella salatun paketin', async () => {
  const a = await luoLahetysAvain();
  const b = await luoLahetysAvain();
  const paketti = await salaaKehys(a, 0n, new TextEncoder().encode('data').buffer);
  await assert.rejects(() => puraKehys(b, paketti));
});

test('puraKehys hylkää väärällä laskurilla puretun paketin (nonce ei täsmää)', async () => {
  const lahetysAvain = await luoLahetysAvain();
  const paketti = await salaaKehys(lahetysAvain, 0n, new TextEncoder().encode('data').buffer);
  // Vaihdetaan paketin laskuriosa toiseksi ilman uudelleensalausta — purku käyttää
  // silloin väärää noncea eikä auth tag täsmää.
  const data = new Uint8Array(paketti);
  new DataView(data.buffer).setBigUint64(0, 1n, false);
  await assert.rejects(() => puraKehys(lahetysAvain, data.buffer));
});

test('jokainen luoLahetysAvain tuottaa eri avaimen ja etuliitteen', async () => {
  const a = await luoLahetysAvain();
  const b = await luoLahetysAvain();
  assert.notDeepEqual(a.etuliite, b.etuliite);
  const aVienti = await vieLahetysAvain(a);
  const bVienti = await vieLahetysAvain(b);
  assert.notDeepEqual(new Uint8Array(aVienti.avain), new Uint8Array(bVienti.avain));
});

test('vieLahetysAvain ja tuoLahetysAvain säilyttävät avaimen toimivuuden', async () => {
  const alkuperainen = await luoLahetysAvain();
  const { avain: avainRaaka, etuliite } = await vieLahetysAvain(alkuperainen);
  const tuotu = await tuoLahetysAvain(avainRaaka, etuliite);

  const kehys = new TextEncoder().encode('kulkeeko avain oikein').buffer;
  const paketti = await salaaKehys(alkuperainen, 0n, kehys);
  const purettu = await puraKehys(tuotu, paketti);
  assert.deepEqual(new TextDecoder().decode(purettu), 'kulkeeko avain oikein');
});

test('salaus lisää kiinteän 24 tavun (8 laskuri + 16 GCM-tag) ylikuorman kehystä kohden', async () => {
  const lahetysAvain = await luoLahetysAvain();
  const kehys = new Uint8Array(60).buffer; // tyypillinen Opus-kehyksen suuruusluokka
  const paketti = await salaaKehys(lahetysAvain, 0n, kehys);
  assert.equal(paketti.byteLength - kehys.byteLength, 24);
});
