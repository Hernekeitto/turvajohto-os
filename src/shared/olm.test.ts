// PTT-avainsynkronoinnin kääntökerroksen testit (erä 26, vaihe 2, viipale 2b).
//
// Kiinteistöarvot on poimittu suoraan oikeasta OlmMachinesta selaimessa ajetusta
// testistä (@matrix-org/matrix-sdk-crypto-wasm 18.8.0) — ei arvattu muoto.
//
// Ajetaan: node --test src/shared/olm.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  matriisiKayttajaId, matriisiHuoneId, omaKayttajaMatriisista,
  lataaRunkoPyynnosta, kysytytKayttajat, kyselyVastausJsoniksi,
  vaadiPyynnotPyynnosta, vaadiVastausJsoniksi,
} from './olm.ts';

test('matriisiKayttajaId ja omaKayttajaMatriisista ovat toistensa käänteisiä', () => {
  assert.equal(matriisiKayttajaId('vartija1'), '@vartija1:turvajohto.local');
  assert.equal(omaKayttajaMatriisista('@vartija1:turvajohto.local'), 'vartija1');
});

test('matriisiHuoneId käyttää huoneen sigiiliä', () => {
  assert.equal(matriisiHuoneId('hata:h1'), '!hata:h1:turvajohto.local');
});

test('lataaRunkoPyynnosta poimii device_keys- ja one_time_keys-oliot KeysUploadRequest-rungosta', () => {
  // Todellisen OlmMachinen tuottama runko (typistetty yhteen kertakäyttöavaimeen).
  const bodyJson = JSON.stringify({
    device_keys: {
      algorithms: ['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'],
      device_id: 'dev1',
      keys: { 'curve25519:dev1': 'J2S1RPkg', 'ed25519:dev1': 'U4pWKfat' },
      signatures: { '@smoketest:turvajohto.local': { 'ed25519:dev1': 'sig' } },
      user_id: '@smoketest:turvajohto.local',
    },
    fallback_keys: {},
    one_time_keys: { 'signed_curve25519:AAAAAAAAAA0': { key: 'sWM1P14b', signatures: {} } },
  });
  const runko = lataaRunkoPyynnosta('dev1', bodyJson);
  assert.equal(runko.laiteId, 'dev1');
  assert.deepEqual(runko.deviceKeys, JSON.parse(bodyJson).device_keys);
  assert.deepEqual(runko.kertakayttoavaimet, { 'signed_curve25519:AAAAAAAAAA0': { key: 'sWM1P14b', signatures: {} } });
});

test('lataaRunkoPyynnosta selviää puuttuvasta one_time_keys-kentästä', () => {
  const runko = lataaRunkoPyynnosta('dev1', JSON.stringify({ device_keys: {} }));
  assert.deepEqual(runko.kertakayttoavaimet, {});
});

test('kysytytKayttajat purkaa KeysQueryRequest-rungon käyttäjätunnuksiksi', () => {
  const bodyJson = JSON.stringify({ device_keys: { '@vartija1:turvajohto.local': [], '@vartija2:turvajohto.local': [] } });
  assert.deepEqual(kysytytKayttajat(bodyJson), ['vartija1', 'vartija2']);
});

test('kyselyVastausJsoniksi rakentaa Matrixin /keys/query-vastausmuodon', () => {
  const deviceKeys1 = { device_id: 'laite1', user_id: '@vartija1:turvajohto.local', keys: {}, signatures: {} };
  const vastaus = kyselyVastausJsoniksi({ vartija1: [{ deviceKeys: deviceKeys1 }] });
  assert.deepEqual(JSON.parse(vastaus), {
    device_keys: { '@vartija1:turvajohto.local': { laite1: deviceKeys1 } },
  });
});

test('kyselyVastausJsoniksi jättää pois laitteen jolta puuttuu device_id', () => {
  const vastaus = kyselyVastausJsoniksi({ vartija1: [{ deviceKeys: {} }] });
  assert.deepEqual(JSON.parse(vastaus), { device_keys: { '@vartija1:turvajohto.local': {} } });
});

test('vaadiPyynnotPyynnosta purkaa KeysClaimRequest-rungon litteäksi listaksi', () => {
  const bodyJson = JSON.stringify({
    one_time_keys: {
      '@vartija1:turvajohto.local': { laite1: 'signed_curve25519', laite2: 'signed_curve25519' },
      '@vartija2:turvajohto.local': { laiteA: 'signed_curve25519' },
    },
  });
  assert.deepEqual(vaadiPyynnotPyynnosta(bodyJson), [
    { kayttaja: 'vartija1', laiteId: 'laite1', algoritmi: 'signed_curve25519' },
    { kayttaja: 'vartija1', laiteId: 'laite2', algoritmi: 'signed_curve25519' },
    { kayttaja: 'vartija2', laiteId: 'laiteA', algoritmi: 'signed_curve25519' },
  ]);
});

test('vaadiVastausJsoniksi rakentaa Matrixin /keys/claim-vastausmuodon', () => {
  const vastaus = vaadiVastausJsoniksi([
    { kayttaja: 'vartija1', laiteId: 'laite1', keyId: 'signed_curve25519:AAAA', avain: { key: 'x', signatures: {} } },
  ]);
  assert.deepEqual(JSON.parse(vastaus), {
    one_time_keys: {
      '@vartija1:turvajohto.local': { laite1: { 'signed_curve25519:AAAA': { key: 'x', signatures: {} } } },
    },
  });
});

test('vaadiVastausJsoniksi jättää pois rivit joilta puuttuu avain', () => {
  const vastaus = vaadiVastausJsoniksi([{ kayttaja: 'vartija1', laiteId: 'laite1', keyId: null, avain: null }]);
  assert.deepEqual(JSON.parse(vastaus), { one_time_keys: {} });
});
