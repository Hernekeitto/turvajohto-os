// PTT-äänen Opus-kehysten pakkaus raa'an WebSocketin siirtoa varten (erä 26, vaihe 4,
// vaihtoehto B -PoC: "raaka WebSocket + käsin koodattu Opus").
//
// WebCodecsin AudioEncoder/AudioDecoder tuottavat/kuluttavat selaimen omaa Opus-
// toteutusta (ei siis käsin kirjoitettua Opus-bittivirtaa — sen uudelleenkirjoittaminen
// olisi oma, epäsuhtainen projektinsa). "Käsin koodattu" tässä suunnitelman kohdassa
// tarkoittaa PAKETOINTIA: toisin kuin WebRTC (vaihtoehto A), joka kuljettaa kehyksen
// type/timestamp/duration-metadatan RTP:n SISÄLLÄ automaattisesti, raaka WebSocket ei
// tiedä mitään Opus-kehyksistä — metadata on pakattava itse mukaan, tai vastaanottava
// AudioDecoder ei osaa rakentaa EncodedAudioChunkia uudelleen.
//
// SALAUS ON SAMA MEKANISMI KUIN VAIHTOEHTO A:SSA (src/shared/aanisalaus.ts) MUUTTAMATTA
// — se on jo transporttiriippumaton (ottaa vastaan/palauttaa pelkkiä ArrayBuffereita),
// joten tämä tiedosto vain pakkaa metadatan ennen salausta ja purkaa sen jälkeen.
//
// TODENNETTU SUORAAN SELAIMESSA (Chrome) ennen tämän tiedoston kirjoittamista:
// AudioEncoder.isConfigSupported({codec:'opus',...}) -> supported:true, ja täysi kierto
// synteettisellä oskillaattoriäänellä (MediaStreamTrackProcessor -> AudioEncoder -> TÄMÄ
// PAKKAUS -> aanisalaus.ts:n salaaKehys -> puraKehys -> AudioDecoder) tuotti 11/11
// pakettia oikein dekoodattuna. Ks. Obsidian "vaihe 4 -suunnitelma" mitatuille luvuille.

import { type LahetysAvain, salaaKehys, puraKehys } from './aanisalaus.ts';

const TYYPPI_KEY = 1;
const TYYPPI_DELTA = 2;
const EI_KESTOA = 0xffffffff;
const OTSAKKEEN_TAVUT = 1 + 8 + 4; // tyyppi + aikaleima (mikrosekuntia) + kesto

export type OpusKehys = {
  tyyppi: 'key' | 'delta';
  // Mikrosekunteina, kuten EncodedAudioChunk.timestamp — 8 tavua eikä 4, koska aikaleima
  // on suhteessa STREAMIN ALKUUN (ei nollaudu kehyksittäin) ja hätäkanavan stream voi
  // pysyä auki koko vuoron ajan (suunnitelman kohta 5): 4 tavua (uint32) loppuisi kesken
  // n. 71 minuutin kohdalla.
  aikaleima: number;
  kesto: number | null;
  data: ArrayBuffer;
};

/** Pakkaa Opus-kehyksen metadatan ja datan yhdeksi puskuriksi ENNEN salausta. */
export function pakkaaOpusKehys(kehys: OpusKehys): ArrayBuffer {
  const paketti = new Uint8Array(OTSAKKEEN_TAVUT + kehys.data.byteLength);
  const view = new DataView(paketti.buffer);
  view.setUint8(0, kehys.tyyppi === 'key' ? TYYPPI_KEY : TYYPPI_DELTA);
  view.setBigUint64(1, BigInt(Math.round(kehys.aikaleima)), false);
  view.setUint32(9, kehys.kesto === null ? EI_KESTOA : kehys.kesto, false);
  paketti.set(new Uint8Array(kehys.data), OTSAKKEEN_TAVUT);
  return paketti.buffer;
}

/** Purkaa pakkaaOpusKehys:n tuottaman puskurin (salauksen PURKAMISEN jälkeen). */
export function puraOpusKehys(paketti: ArrayBuffer): OpusKehys {
  const view = new DataView(paketti);
  const kesto = view.getUint32(9, false);
  return {
    tyyppi: view.getUint8(0) === TYYPPI_KEY ? 'key' : 'delta',
    aikaleima: Number(view.getBigUint64(1, false)),
    kesto: kesto === EI_KESTOA ? null : kesto,
    data: paketti.slice(OTSAKKEEN_TAVUT),
  };
}

/**
 * Kääre AudioEncoderin output-callbackiin: pakkaa ja salaa kehyksen lähetettäväksi
 * (esim. `ws.send(await ...)`). Laskuri kasvaa kutsujan puolesta — sama nonce-periaate
 * kuin aanisalaus.ts:ssä, EI SAA nollautua tai toistaa arvoa saman avaimen aikana.
 */
export function luoLahetysKasittelija(avain: LahetysAvain): (chunk: EncodedAudioChunk) => Promise<ArrayBuffer> {
  let laskuri = 0n;
  return async (chunk) => {
    const data = new ArrayBuffer(chunk.byteLength);
    chunk.copyTo(data);
    const kehys = pakkaaOpusKehys({ tyyppi: chunk.type, aikaleima: chunk.timestamp, kesto: chunk.duration, data });
    const paketti = await salaaKehys(avain, laskuri, kehys);
    laskuri++;
    return paketti;
  };
}

/** Purkaa WebSocketilta saapuneen paketin AudioDecoder.decode():lle kelpaavaksi kehykseksi. */
export async function puraVastaanotettu(avain: LahetysAvain, paketti: ArrayBuffer): Promise<EncodedAudioChunk> {
  const puhdas = await puraKehys(avain, paketti);
  const kehys = puraOpusKehys(puhdas);
  return new EncodedAudioChunk({
    type: kehys.tyyppi, timestamp: kehys.aikaleima, duration: kehys.kesto ?? undefined, data: kehys.data,
  });
}
