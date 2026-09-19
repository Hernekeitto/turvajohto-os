// Laitteiden välisten kohdennettujen viestien (to-device) sääntötestit
// (erä 26, vaihe 2, viipale 2c).
//
// Ajetaan: node --test server/laiteviestit.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { luoLaiteviesti, laitteenViestit, poistaLaitteenViestit } from './laiteviestit.js';

test('luoLaiteviesti tallentaa lähettäjän, kohteen ja sisällön', () => {
  const viesti = luoLaiteviesti({
    id: 'v1', lahettaja: 'vartija1', kohdeKayttaja: 'vartija2', kohdeLaite: 'laite2',
    tyyppi: 'm.room.encrypted', sisalto: { algorithm: 'm.olm.v1.curve25519-aes-sha2' }, nyt: 0,
  });
  assert.equal(viesti.lahettaja, 'vartija1');
  assert.equal(viesti.kohdeKayttaja, 'vartija2');
  assert.equal(viesti.kohdeLaite, 'laite2');
  assert.deepEqual(viesti.sisalto, { algorithm: 'm.olm.v1.curve25519-aes-sha2' });
  assert.equal(viesti.lahetetty, new Date(0).toISOString());
});

test('laitteenViestit palauttaa vain kohdennetun (käyttäjä, laite) -parin viestit', () => {
  const viestit = [
    luoLaiteviesti({ id: 'v1', lahettaja: 'a', kohdeKayttaja: 'b', kohdeLaite: 'laite2', tyyppi: 't', sisalto: 1 }),
    luoLaiteviesti({ id: 'v2', lahettaja: 'a', kohdeKayttaja: 'b', kohdeLaite: 'muu-laite', tyyppi: 't', sisalto: 2 }),
    luoLaiteviesti({ id: 'v3', lahettaja: 'a', kohdeKayttaja: 'c', kohdeLaite: 'laite2', tyyppi: 't', sisalto: 3 }),
  ];
  assert.deepEqual(laitteenViestit(viestit, 'b', 'laite2').map((v) => v.id), ['v1']);
});

test('laitteenViestit ei kaadu tyhjästä tai puuttuvasta listasta', () => {
  assert.deepEqual(laitteenViestit(undefined, 'b', 'laite2'), []);
  assert.deepEqual(laitteenViestit([], 'b', 'laite2'), []);
});

test('poistaLaitteenViestit jättää muiden laitteiden viestit koskemattomiksi', () => {
  const viestit = [
    luoLaiteviesti({ id: 'v1', lahettaja: 'a', kohdeKayttaja: 'b', kohdeLaite: 'laite2', tyyppi: 't', sisalto: 1 }),
    luoLaiteviesti({ id: 'v2', lahettaja: 'a', kohdeKayttaja: 'c', kohdeLaite: 'laite2', tyyppi: 't', sisalto: 2 }),
  ];
  const jaljella = poistaLaitteenViestit(viestit, 'b', 'laite2');
  assert.deepEqual(jaljella.map((v) => v.id), ['v2']);
});
