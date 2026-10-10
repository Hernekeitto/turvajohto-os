// Web Push ilman ulkoista kirjastoa (10.10.2026, työvuoromuutosten ilmoitukset).
//
// Kaksi standardia, molemmat Noden omalla crypto-moduulilla:
//
//   RFC 8291  viestin salaus (aes128gcm): vain vastaanottajan selain voi lukea sisällön,
//             push-palvelu (Google, Mozilla, Apple) näkee vain salatun möhkäleen
//   RFC 8292  VAPID: palvelin todistaa push-palvelulle olevansa sama joka tilauksen teki
//
// MIKSI EI web-push-kirjastoa: palvelimen julkaisu (Forgejon post-receive) ei
// dokumentoidusti asenna uusia npm-riippuvuuksia, ja puuttuva moduuli kaataisi koko
// palvelimen käynnistyksen. Salaus on noin sata riviä, ja se on testattu RFC 8291:n
// liitteen A esimerkkivektoria vasten (webpush.test.js) — jos se täsmää tavulleen,
// toteutus on yhteensopiva minkä tahansa selaimen kanssa.
//
// Avaimet: VAPID_PUBLIC_KEY ja VAPID_PRIVATE_KEY ympäristömuuttujista, tai jos niitä ei
// ole, palvelin luo parin kerran ja tallentaa sen datahakemistoon (index.js). Avainparin
// vaihtaminen mitätöi kaikki olemassa olevat tilaukset.

import crypto from 'node:crypto';

export const b64u = (buf) => Buffer.from(buf).toString('base64url');
export const b64uDecode = (s) => Buffer.from(String(s), 'base64url');

const RS = 4096;

/** Uusi VAPID-avainpari: { publicKey, privateKey } base64url-muodossa (raaka P-256). */
export function luoVapidAvaimet() {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const julkinen = Buffer.concat([Buffer.from([4]), b64uDecode(jwk.x), b64uDecode(jwk.y)]);
  return { publicKey: b64u(julkinen), privateKey: jwk.d };
}

function yksityinenAvain(publicKey, privateKey) {
  const julkinen = b64uDecode(publicKey);
  return crypto.createPrivateKey({
    format: 'jwk',
    key: { kty: 'EC', crv: 'P-256', d: privateKey, x: b64u(julkinen.subarray(1, 33)), y: b64u(julkinen.subarray(33, 65)) },
  });
}

/**
 * RFC 8291: viestin salaus vastaanottajalle. `p256dh` ja `auth` tulevat selaimen
 * tilauksesta. `testi` (vain testeille): kiinteä palvelimen avain ja suola, jotta tulos
 * voidaan verrata RFC:n esimerkkiin.
 */
export function salaa(selkoteksti, { p256dh, auth }, testi = null) {
  const uaJulkinen = b64uDecode(p256dh);
  const authSalaisuus = b64uDecode(auth);
  const ecdh = crypto.createECDH('prime256v1');
  if (testi) ecdh.setPrivateKey(b64uDecode(testi.palvelimenYksityinen));
  else ecdh.generateKeys();
  const asJulkinen = ecdh.getPublicKey();
  const jaettu = ecdh.computeSecret(uaJulkinen);
  const suola = testi ? b64uDecode(testi.suola) : crypto.randomBytes(16);

  // IKM = HKDF(auth, ecdh, "WebPush: info" || 0 || ua_public || as_public, 32)
  const avainInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaJulkinen, asJulkinen]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', jaettu, authSalaisuus, avainInfo, 32));
  // RFC 8188: sisältöavain ja nonce suolasta ja IKM:stä.
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, suola, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, suola, Buffer.from('Content-Encoding: nonce\0'), 12));

  // Yksi tietue: selkoteksti + erotin 0x02 (viimeinen tietue), ei täytettä.
  const salain = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const salattu = Buffer.concat([
    salain.update(Buffer.concat([Buffer.from(selkoteksti), Buffer.from([2])])),
    salain.final(),
    salain.getAuthTag(),
  ]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(RS);
  // Otsake: suola(16) || rs(4) || idlen(1) || keyid = palvelimen kertakäyttöinen julkinen avain
  return Buffer.concat([suola, rs, Buffer.from([asJulkinen.length]), asJulkinen, salattu]);
}

/** RFC 8292: VAPID-otsake push-palvelulle. Voimassa 12 tuntia. */
export function vapidOtsake(endpoint, { publicKey, privateKey, subject }, nyt = Date.now()) {
  const aud = new URL(endpoint).origin;
  const otsake = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const sisalto = b64u(JSON.stringify({ aud, exp: Math.floor(nyt / 1000) + 12 * 3600, sub: subject }));
  const allekirjoitus = crypto.sign('sha256', Buffer.from(`${otsake}.${sisalto}`), {
    key: yksityinenAvain(publicKey, privateKey),
    dsaEncoding: 'ieee-p1363',
  });
  return `vapid t=${otsake}.${sisalto}.${b64u(allekirjoitus)}, k=${publicKey}`;
}

/**
 * Yhden viestin lähetys yhteen tilaukseen. Palauttaa { ok, status, vanhentunut }.
 * `vanhentunut` = push-palvelu kertoi ettei tilausta enää ole (404/410): kutsuja poistaa sen.
 * Ei heitä koskaan: ilmoitus on lisäpalvelu, eikä sen epäonnistuminen saa kaataa muutosta
 * joka sen laukaisi.
 */
export async function laheta(tilaus, viesti, avaimet, { fetchFn = fetch, ttl = 24 * 3600, kiireellisyys = 'normal' } = {}) {
  try {
    const runko = salaa(JSON.stringify(viesti), tilaus.keys);
    const r = await fetchFn(tilaus.endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapidOtsake(tilaus.endpoint, avaimet),
        TTL: String(ttl),
        Urgency: kiireellisyys,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
      },
      body: runko,
    });
    return { ok: r.status >= 200 && r.status < 300, status: r.status, vanhentunut: r.status === 404 || r.status === 410 };
  } catch (e) {
    return { ok: false, status: 0, vanhentunut: false, virhe: String(e?.message || e) };
  }
}

/** Tilauksen kelpoisuus ennen tallennusta: https-osoite ja oikean mittaiset avaimet. */
export function kelpaakoTilaus(t) {
  try {
    const url = new URL(String(t?.endpoint || ''));
    if (url.protocol !== 'https:') return false;
    return b64uDecode(t?.keys?.p256dh).length === 65 && b64uDecode(t?.keys?.auth).length === 16;
  } catch {
    return false;
  }
}
