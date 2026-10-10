// Web Push -salauksen ja VAPIDin testit.
//
// Tärkein testi on RFC 8291:n liitteen A esimerkki: kiinteillä avaimilla ja suolalla
// tuloksen on oltava tavulleen sama kuin standardissa. Jos se täsmää, selaimet osaavat
// purkaa viestit. Lisäksi viesti puretaan itse vastaanottajan avaimella (round-trip) ja
// VAPID-allekirjoitus tarkistetaan julkisella avaimella.
//
// Ajetaan: node --test server/webpush.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { b64u, b64uDecode, kelpaakoTilaus, laheta, luoVapidAvaimet, salaa, vapidOtsake } from './webpush.js';

// RFC 8291, Appendix A.
const RFC = {
  selko: 'When I grow up, I want to be a watermelon',
  palvelimenYksityinen: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaYksityinen: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaJulkinen: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  suola: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  tulos: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

test('RFC 8291 liite A: salaus täsmää tavulleen', () => {
  const tulos = salaa(RFC.selko, { p256dh: RFC.uaJulkinen, auth: RFC.auth }, { palvelimenYksityinen: RFC.palvelimenYksityinen, suola: RFC.suola });
  assert.equal(b64u(tulos), RFC.tulos);
});

// Vastaanottajan purku: sama kuin selain tekee.
function pura(runko, uaYksityinen, uaJulkinen, auth) {
  const suola = runko.subarray(0, 16);
  const idlen = runko[20];
  const asJulkinen = runko.subarray(21, 21 + idlen);
  const salattu = runko.subarray(21 + idlen);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(b64uDecode(uaYksityinen));
  const jaettu = ecdh.computeSecret(asJulkinen);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), b64uDecode(uaJulkinen), asJulkinen]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', jaettu, b64uDecode(auth), info, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, suola, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, suola, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(salattu.subarray(salattu.length - 16));
  const selko = Buffer.concat([d.update(salattu.subarray(0, salattu.length - 16)), d.final()]);
  assert.equal(selko[selko.length - 1], 2);
  return selko.subarray(0, selko.length - 1).toString();
}

test('satunnaisella avaimella salattu viesti aukeaa vastaanottajan avaimella', () => {
  const viesti = JSON.stringify({ otsikko: 'Uusi vuoro', teksti: 'ti 27.10. 06–14, Kauppakeskus' });
  const runko = salaa(viesti, { p256dh: RFC.uaJulkinen, auth: RFC.auth });
  assert.equal(pura(runko, RFC.uaYksityinen, RFC.uaJulkinen, RFC.auth), viesti);
  // Joka kerta eri suola ja avain: kaksi salausta samasta viestistä eivät ole samat.
  assert.notEqual(b64u(runko), b64u(salaa(viesti, { p256dh: RFC.uaJulkinen, auth: RFC.auth })));
});

test('VAPID: allekirjoitus tarkistuu julkisella avaimella, aud on push-palvelun origin', () => {
  const avaimet = { ...luoVapidAvaimet(), subject: 'https://turvajohto-os.fi' };
  assert.equal(b64uDecode(avaimet.publicKey).length, 65);
  const otsake = vapidOtsake('https://fcm.googleapis.com/fcm/send/abc', avaimet, Date.UTC(2026, 9, 10));
  const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(otsake);
  assert.equal(k, avaimet.publicKey);
  const [h, p, s] = t.split('.');
  const sisalto = JSON.parse(b64uDecode(p).toString());
  assert.equal(sisalto.aud, 'https://fcm.googleapis.com');
  assert.equal(sisalto.sub, 'https://turvajohto-os.fi');
  assert.equal(sisalto.exp, Date.UTC(2026, 9, 10) / 1000 + 12 * 3600);
  const julkinen = b64uDecode(avaimet.publicKey);
  const avain = crypto.createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: b64u(julkinen.subarray(1, 33)), y: b64u(julkinen.subarray(33)) } });
  assert.ok(crypto.verify('sha256', Buffer.from(`${h}.${p}`), { key: avain, dsaEncoding: 'ieee-p1363' }, b64uDecode(s)));
});

test('lähetys: otsakkeet, vanhentunut tilaus ja verkkovirhe', async () => {
  const avaimet = { ...luoVapidAvaimet(), subject: 'https://turvajohto-os.fi' };
  const tilaus = { endpoint: 'https://push.example.com/x', keys: { p256dh: RFC.uaJulkinen, auth: RFC.auth } };
  let pyynto = null;
  const ok = await laheta(tilaus, { otsikko: 'T' }, avaimet, { fetchFn: async (url, init) => { pyynto = { url, init }; return { status: 201 }; } });
  assert.deepEqual(ok, { ok: true, status: 201, vanhentunut: false });
  assert.equal(pyynto.init.headers['Content-Encoding'], 'aes128gcm');
  assert.match(pyynto.init.headers.Authorization, /^vapid t=/);
  assert.equal(pura(pyynto.init.body, RFC.uaYksityinen, RFC.uaJulkinen, RFC.auth), '{"otsikko":"T"}');
  const pois = await laheta(tilaus, {}, avaimet, { fetchFn: async () => ({ status: 410 }) });
  assert.equal(pois.vanhentunut, true);
  const virhe = await laheta(tilaus, {}, avaimet, { fetchFn: async () => { throw new Error('ei verkkoa'); } });
  assert.equal(virhe.ok, false);
});

test('tilauksen kelpoisuus', () => {
  assert.equal(kelpaakoTilaus({ endpoint: 'https://push.example.com/x', keys: { p256dh: RFC.uaJulkinen, auth: RFC.auth } }), true);
  assert.equal(kelpaakoTilaus({ endpoint: 'http://push.example.com/x', keys: { p256dh: RFC.uaJulkinen, auth: RFC.auth } }), false);
  assert.equal(kelpaakoTilaus({ endpoint: 'https://push.example.com/x', keys: { p256dh: 'lyhyt', auth: RFC.auth } }), false);
  assert.equal(kelpaakoTilaus(null), false);
});
