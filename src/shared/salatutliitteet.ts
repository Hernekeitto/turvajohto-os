// PTT-median salaus ja kulku (erä 26, vaihe 3, viipale 3d).
//
// LIITEOSOITIN (Signalin mallin mukaan, Obsidian "vaihe 3 -suunnitelma" kohta 3):
// tiedostoavain, mime-tyyppi ja koko kulkevat viestin OMAN Megolm-salauksen sisällä
// (src/shared/olm.ts: salaaViesti, src/shared/viestit.ts) — palvelin näkee vain
// opaakin salatun blobin (server/salatutliitteet.js), ei koskaan avainta eikä
// tiedostotyyppiä.
//
// PÄÄTÖS 19.9.2026: media ei tallennu laitteelle — näytetään vain sovelluksen
// sisällä (haeJaPuraLiite palauttaa Object URL:n, ei tiedostoa levylle). REHELLINEN
// RAJAUS: tämä ei estä kuvakaappausta eikä toisella laitteella kuvaamista ruudusta —
// sama periaate kuin laitesidonnassa, estetään helppo tallennus, ei väitetä
// absoluuttista suojaa.

// Sama raja kuin server/index.js:n multer-asetuksella (15 Mt/tiedosto, jaettu
// /api/uploads:n kanssa) — tämä on vain nopea asiakaspään esitarkistus, palvelin
// on silti se joka lopulta päättää.
export const LIITTEEN_ENIMMAISKOKO = 15 * 1024 * 1024;

export type Liiteosoitin = {
  msgtype: 'm.image' | 'm.video' | 'm.file';
  liiteId: string;
  avain: string; // base64, raaka AES-256-GCM-avain
  iv: string; // base64, 12-tavuinen nonce
  mimetype: string;
  koko: number;
  nimi?: string;
};

export function uint8ToBase64(bytes: Uint8Array): string {
  let binaari = '';
  for (const tavu of bytes) binaari += String.fromCharCode(tavu);
  return btoa(binaari);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binaari = atob(base64);
  const bytes = new Uint8Array(binaari.length);
  for (let i = 0; i < binaari.length; i++) bytes[i] = binaari.charCodeAt(i);
  return bytes;
}

const ALGORITMI = 'AES-GCM';

/**
 * Salaa tavut satunnaisella kertakäyttöavaimella. Avain ja IV base64-koodattuina
 * liiteosoitinta varten — kutsuja upottaa ne viestin salattuun sisältöön, ei koskaan
 * lähetä niitä palvelimelle sellaisenaan.
 */
export async function salaaTavut(raaka: ArrayBuffer): Promise<{ avain: string; iv: string; salattu: ArrayBuffer }> {
  const avain = await crypto.subtle.generateKey({ name: ALGORITMI, length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salattu = await crypto.subtle.encrypt({ name: ALGORITMI, iv }, avain, raaka);
  const avainRaaka = await crypto.subtle.exportKey('raw', avain);
  return { avain: uint8ToBase64(new Uint8Array(avainRaaka)), iv: uint8ToBase64(iv), salattu };
}

/** Purkaa salaaTavut:n tuottaman blobin samalla avaimella ja IV:llä. */
export async function puraTavut(salattu: ArrayBuffer, avainBase64: string, ivBase64: string): Promise<ArrayBuffer> {
  const avain = await crypto.subtle.importKey('raw', base64ToUint8(avainBase64) as BufferSource, ALGORITMI, false, ['decrypt']);
  return crypto.subtle.decrypt({ name: ALGORITMI, iv: base64ToUint8(ivBase64) as BufferSource }, avain, salattu);
}

/** Salaa tiedoston ja lataa sen palvelimelle. Palauttaa liiteosoittimen viestin sisältöä varten. */
export async function lataaJaSalaaLiite(
  kanavaId: string, tiedosto: File, msgtype: Liiteosoitin['msgtype'],
): Promise<Liiteosoitin> {
  const raaka = await tiedosto.arrayBuffer();
  const { avain, iv, salattu } = await salaaTavut(raaka);

  const tyyppi = msgtype === 'm.image' ? 'kuva' : msgtype === 'm.video' ? 'video' : 'tiedosto';
  const runko = new FormData();
  runko.append('kanavaId', kanavaId);
  runko.append('tyyppi', tyyppi);
  runko.append('file', new Blob([salattu]));
  const vastaus = await fetch('/api/liitteet', { method: 'POST', credentials: 'include', body: runko })
    .then((r) => r.json()).catch(() => null);
  if (!vastaus?.ok) throw new Error(vastaus?.error || 'Liitteen lähetys epäonnistui.');

  return {
    msgtype,
    liiteId: vastaus.id,
    avain,
    iv,
    mimetype: tiedosto.type || 'application/octet-stream',
    koko: tiedosto.size,
    nimi: tiedosto.name,
  };
}

/**
 * Hakee ja purkaa liitteen osoittimen perusteella. Palauttaa Object URL:n — kutsujan
 * on itse vapautettava se URL.revokeObjectURL:lla kun näkymä suljetaan, muuten
 * selain pitää salaamattoman kuvan muistissa tarpeettoman kauan.
 */
export async function haeJaPuraLiite(osoitin: Liiteosoitin): Promise<string> {
  const vastaus = await fetch(`/api/liitteet/${encodeURIComponent(osoitin.liiteId)}`, { credentials: 'include' });
  if (!vastaus.ok) throw new Error('Liitteen haku epäonnistui.');
  const salattu = await vastaus.arrayBuffer();
  const puhdas = await puraTavut(salattu, osoitin.avain, osoitin.iv);
  return URL.createObjectURL(new Blob([puhdas], { type: osoitin.mimetype }));
}
