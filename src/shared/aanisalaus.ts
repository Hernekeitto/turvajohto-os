// PTT-äänen kehyssalaus WebRTC Insertable Streams -rajapinnalla (erä 26, vaihe 4,
// vaihtoehto A -PoC).
//
// Jokainen PTT-painallus saa oman kertakäyttöisen AES-256-GCM-avaimen (Obsidian:
// "vaihe 2 -suunnitelma", kohta 6) — EI kanavan Megolm-huoneavainta, koska koko
// viestiketjun ratchetointi per audiokehys olisi ylikuormaa. Avain on tarkoitus jakaa
// kuunteleville olemassa olevien Olm-pariavainten kautta (to-device, sama relenssi
// kuin server/laiteviestit.js, vaihe 2c) — sen langoitus EI ole tässä tiedostossa,
// tämä on vain kehyksen salaus/purku-mekanismi.
//
// NONCE ON LASKURIPOHJAINEN: 4 tavua satunnaista etuliitettä (per lähetys, kerran) +
// 8 tavua kasvavaa laskuria (per kehys). Sama avain EI KOSKAAN saa toistaa samaa
// noncea — AES-GCM:n koko turvallisuus nojaa tähän. Laskuri kulkee jokaisen kehyksen
// mukana selväkielisenä, koska vastaanottaja tarvitsee sen purkuun eikä sitä voi
// johtaa luotettavasti muusta metatiedosta (RTP-paketit voivat kadota tai tulla eri
// järjestyksessä huonolla kenttäverkolla).
//
// TÄMÄ ON VIELÄ KOKEELLINEN (PoC, ei tuotantokoodia). Todennettu: mekaniikka toimii
// WebRTC-silmukassa samassa selaimessa (kehysten sieppaus/muokkaus RTCRtpSender/
// Receiver.createEncodedStreams():lla ei riko yhteyttä), salaus/purku-kierto oikealla
// crypto.subtle-toteutuksella. EI TODENNETTU: kuultavan äänen laatu (sandboxattu
// selainympäristö näyttää äänitason nollana ilman salaustakin) eikä käytös oikealla
// huonolla kenttäverkolla — kumpikin vaatii todellisen laitteen/selaimen ulkopuolella,
// ks. Obsidian "vaihe 4 -suunnitelma".

const ALGORITMI = 'AES-GCM';
const LASKURIN_TAVUT = 8;
const ETULIITTEEN_TAVUT = 4;

export type LahetysAvain = { avain: CryptoKey; etuliite: Uint8Array };

/** Uusi kertakäyttöavain yhdelle PTT-painallukselle. */
export async function luoLahetysAvain(): Promise<LahetysAvain> {
  const avain = await crypto.subtle.generateKey({ name: ALGORITMI, length: 256 }, true, ['encrypt', 'decrypt']);
  const etuliite = crypto.getRandomValues(new Uint8Array(ETULIITTEEN_TAVUT));
  return { avain, etuliite };
}

/** Vie/tuo avaimen raakamuodossa to-device-jakoa varten (ks. tiedoston yläkommentti). */
export async function vieLahetysAvain(lahetysAvain: LahetysAvain): Promise<{ avain: ArrayBuffer; etuliite: Uint8Array }> {
  return { avain: await crypto.subtle.exportKey('raw', lahetysAvain.avain), etuliite: lahetysAvain.etuliite };
}

export async function tuoLahetysAvain(avainRaaka: ArrayBuffer, etuliite: Uint8Array): Promise<LahetysAvain> {
  const avain = await crypto.subtle.importKey('raw', avainRaaka, ALGORITMI, false, ['encrypt', 'decrypt']);
  return { avain, etuliite };
}

function nonce(etuliite: Uint8Array, laskuri: bigint): Uint8Array {
  const n = new Uint8Array(12);
  n.set(etuliite, 0);
  new DataView(n.buffer).setBigUint64(ETULIITTEEN_TAVUT, laskuri, false);
  return n;
}

/** Salaa yhden kehyksen tavut. Palauttaa laskuri+salattu-paketin, ei vielä frame.dataan sidottuna (testattavuus). */
export async function salaaKehys(
  lahetysAvain: LahetysAvain, laskuri: bigint, data: ArrayBuffer,
): Promise<ArrayBuffer> {
  const iv = nonce(lahetysAvain.etuliite, laskuri) as BufferSource;
  const salattu = await crypto.subtle.encrypt({ name: ALGORITMI, iv }, lahetysAvain.avain, data);
  const paketti = new Uint8Array(LASKURIN_TAVUT + salattu.byteLength);
  new DataView(paketti.buffer).setBigUint64(0, laskuri, false);
  paketti.set(new Uint8Array(salattu), LASKURIN_TAVUT);
  return paketti.buffer;
}

/** Purkaa salaaKehys:n tuottaman paketin. Heittää jos avain/etuliite väärä tai paketti vioittunut. */
export async function puraKehys(lahetysAvain: LahetysAvain, paketti: ArrayBuffer): Promise<ArrayBuffer> {
  const data = new Uint8Array(paketti);
  const laskuri = new DataView(data.buffer, data.byteOffset, LASKURIN_TAVUT).getBigUint64(0, false);
  const salattu = data.slice(LASKURIN_TAVUT);
  const iv = nonce(lahetysAvain.etuliite, laskuri) as BufferSource;
  return crypto.subtle.decrypt({ name: ALGORITMI, iv }, lahetysAvain.avain, salattu);
}

/**
 * Insertable Streams -yhteensopiva TransformStream lähettäjälle:
 * RTCRtpSender.createEncodedStreams().readable.pipeThrough(luoSalausTransform(...)).
 */
export function luoSalausTransform(lahetysAvain: LahetysAvain): TransformStream {
  let laskuri = 0n;
  return new TransformStream({
    async transform(frame: { data: ArrayBuffer }, controller: TransformStreamDefaultController) {
      frame.data = await salaaKehys(lahetysAvain, laskuri, frame.data);
      laskuri++;
      controller.enqueue(frame);
    },
  });
}

/** Vastinpari luoSalausTransform:lle vastaanottajan puolelle. */
export function luoPurkuTransform(lahetysAvain: LahetysAvain): TransformStream {
  return new TransformStream({
    async transform(frame: { data: ArrayBuffer }, controller: TransformStreamDefaultController) {
      try {
        frame.data = await puraKehys(lahetysAvain, frame.data);
        controller.enqueue(frame);
      } catch {
        // Purku epäonnistui (avain ei ole vielä saapunut to-device-relenssin kautta,
        // tai kehys vioittui matkalla) — pudotetaan kehys hiljaa. WebRTC:n oma
        // jitter-puskurointi ja PLC (packet loss concealment) käsittelevät puuttuvan
        // kehyksen samalla tavalla kuin oikean pakettihävikin.
      }
    },
  });
}
