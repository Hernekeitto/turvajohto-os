// Toimitus-/lukukuittausten sääntötestit (erä 26, vaihe 3, viipale 3c).
//
// Ajetaan: node --test server/kuittaukset.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { sallitutKuittaustyypit, luoKuittaus, onKuitattu, viestinKuittaukset } from './kuittaukset.js';

test('sallitutKuittaustyypit sallii lukukuittauksen vain hätäkanavalla', () => {
  assert.deepEqual(sallitutKuittaustyypit('hata'), ['toimitus', 'luku']);
  assert.deepEqual(sallitutKuittaustyypit('dm'), ['toimitus']);
  assert.deepEqual(sallitutKuittaustyypit('vapaa'), ['toimitus']);
  assert.deepEqual(sallitutKuittaustyypit(undefined), ['toimitus']);
});

test('luoKuittaus tallentaa kaikki kentät', () => {
  const kuittaus = luoKuittaus({
    id: 'k1', viestiId: 'v1', kanavaId: 'dm:1', kayttaja: 'vartija2', tyyppi: 'toimitus', nyt: 0,
  });
  assert.equal(kuittaus.viestiId, 'v1');
  assert.equal(kuittaus.kayttaja, 'vartija2');
  assert.equal(kuittaus.tyyppi, 'toimitus');
  assert.equal(kuittaus.aika, new Date(0).toISOString());
});

test('onKuitattu tunnistaa olemassa olevan kuittauksen tyypin mukaan', () => {
  const kuittaukset = [luoKuittaus({ id: 'k1', viestiId: 'v1', kanavaId: 'dm:1', kayttaja: 'vartija2', tyyppi: 'toimitus' })];
  assert.equal(onKuitattu(kuittaukset, 'v1', 'vartija2', 'toimitus'), true);
  assert.equal(onKuitattu(kuittaukset, 'v1', 'vartija2', 'luku'), false);
  assert.equal(onKuitattu(kuittaukset, 'v1', 'vartija3', 'toimitus'), false);
  assert.equal(onKuitattu(kuittaukset, 'v2', 'vartija2', 'toimitus'), false);
});

test('onKuitattu ei kaadu tyhjästä listasta', () => {
  assert.equal(onKuitattu(undefined, 'v1', 'vartija2', 'toimitus'), false);
});

test('viestinKuittaukset palauttaa vain pyydetyn viestin kuittaukset', () => {
  const kuittaukset = [
    luoKuittaus({ id: 'k1', viestiId: 'v1', kanavaId: 'dm:1', kayttaja: 'vartija2', tyyppi: 'toimitus' }),
    luoKuittaus({ id: 'k2', viestiId: 'v2', kanavaId: 'dm:1', kayttaja: 'vartija2', tyyppi: 'toimitus' }),
  ];
  assert.deepEqual(viestinKuittaukset(kuittaukset, 'v1').map((k) => k.id), ['k1']);
});
