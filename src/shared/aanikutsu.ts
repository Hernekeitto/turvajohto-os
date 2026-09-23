// PTT-äänen kuljetuksen ja avainvaihdon yhdistäjä selaimelle (erä 26, vaihe 6:
// kuljetusratkaisu — jatkoa vaiheen 4 PoC:ille, ks. Obsidian "vaihe 6 -suunnitelma",
// "Seuraava askel").
//
// TÄMÄ TIEDOSTO EI TEE ÄÄNEN KAAPPAUSTA, KOODAUSTA EIKÄ TOISTOA — se yhdistää jo
// olemassa olevat, erikseen todennetut palaset kuljetusta varten:
//   - src/shared/olm.ts: Megolm-huoneavain ja sen jako (sama kuin tekstiviesteillä)
//   - src/shared/aanisalaus.ts: kertakäyttöinen AES-avain per PTT-painallus
//   - src/shared/aaniraaka.ts: Opus-kehysten pakkaus/purku (käyttää aanisalaus.ts:ää)
//   - src/shared/kanava.ts: `aani_avain`/`aani_kehys`-viestien kuljetus (server/index.js:
//     kasitteleAaniAvain/kasitteleAaniKehys releoivat, haltija-tarkistettuina joka
//     viestin kohdalla — ks. sen tiedoston "PTT-äänen kuljetus"-osio)
// Todellinen getUserMedia/AudioEncoder/AudioDecoder-kytkentä käyttöliittymään
// (PttPalkki.tsx) on tarkoituksella RAJATTU POIS TÄSTÄ TIEDOSTOSTA — vaatii oikean
// laitteen/mikrofonin testausta, sama rajaus kuin natiivin audioputken primitiiveillä
// (twa-guard/natiivi: AaniLahetin.java/AaniVastaanotin.java, jotka tämän kuljetuksen
// natiivi vastine — Kanava.java/AaniPuhelu.java — yhdistää samalla periaatteella).
//
// AVAIMEN TAPAHTUMATYYPPI ON OMA ('fi.turvajohto.ptt_avain') EIKÄ 'm.room.message':
// tämä EI OLE viesti käyttäjälle eikä kuulu viestiketjuun (src/shared/viestit.ts) —
// se on hetkellinen, ei-persistoitu ohjaustapahtuma joka kulkee WS-releen kautta, ei
// /api/viestit-tallennuksen. Sekoittaminen tekstiviestien joukkoon näkyisi
// KanavaViestit.tsx:n ketjussa tuntemattomana sisältönä.

import type { OlmMachine } from '@matrix-org/matrix-sdk-crypto-wasm';

import {
  paivitaKayttajanLaitteet, varmistaIstunnot, jaaHuoneenAvain, salaaViesti, puraViesti, laitteidenMaara,
} from './olm.ts';
import { haeKanavanJasenet } from './viestit.ts';
import { uint8ToBase64, base64ToUint8 } from './salatutliitteet.ts';
import { luoLahetysAvain, vieLahetysAvain, tuoLahetysAvain, type LahetysAvain } from './aanisalaus.ts';

const TAPAHTUMATYYPPI = 'fi.turvajohto.ptt_avain';

export type Koodekki = 'opus' | 'aac';

type AaniAvainSisalto = { avain: string; etuliite: string; koodekki: Koodekki };

/**
 * Valmistelee kanavan lähetystä varten: varmistaa huoneavaimen kanavan nykyisille
 * jäsenille (sama jäsenten-päivitys + istunnot + jako -kierto kuin tekstiviesteillä,
 * src/shared/viestit.ts:n lahetaSisalto) ja luo uuden kertakäyttöisen PTT-avaimen.
 *
 * Palauttaa sekä avaimen (kutsuja antaa sen aaniraaka.ts:n luoLahetysKasittelija:lle)
 * että sen Megolm-salatun ilmoitustapahtuman — kutsujan on lähetettävä tapahtuma
 * `aani_avain`-viestinä (kanava.ts:n laheta()) ENNEN ensimmäistä `aani_kehys`-kehystä,
 * muuten vastaanottajalla ei ole millä purkaa sitä.
 *
 * `onEteneminen` on VALINNAINEN diagnostiikkakoukku (ei vaikuta toimintaan) — koko
 * avaimenjakoketju on tähän asti ollut musta laatikko: joko se onnistuu tai
 * vastaanottaja jää pysyvästi "Odottaa avainta" -tilaan eikä kumpikaan pää tietää MIKSI
 * (ks. Obsidian "PTT-äänibugin juurisyy", 23.9.2026 ensimmäinen äänenlähetystesti).
 */
export async function aloitaLahetys(
  machine: OlmMachine, omaKayttaja: string, kanavaId: string, koodekki: Koodekki,
  onEteneminen?: (viesti: string) => void,
): Promise<{ lahetysAvain: LahetysAvain; tapahtuma: string }> {
  const jasenet = (await haeKanavanJasenet(kanavaId)).filter((k) => k !== omaKayttaja);
  onEteneminen?.(`jäseniä=${jasenet.length} [${jasenet.join(', ')}]`);
  for (const kayttaja of jasenet) {
    await paivitaKayttajanLaitteet(machine, kayttaja);
  }
  if (onEteneminen) {
    const laitteet = await Promise.all(jasenet.map(async (k) => `${k}=${await laitteidenMaara(machine, k)}`));
    onEteneminen(`laitteita tiedossa: ${laitteet.join(', ') || '(ei jäseniä)'}`);
  }
  const vaadittuja = await varmistaIstunnot(machine, jasenet);
  onEteneminen?.(`kertakäyttöavaimia vaadittu: ${vaadittuja} (-1 = ei tarvittu, istunnot jo olemassa)`);
  await jaaHuoneenAvain(machine, kanavaId, jasenet);

  const lahetysAvain = await luoLahetysAvain();
  const viety = await vieLahetysAvain(lahetysAvain);
  const sisalto: AaniAvainSisalto = {
    avain: uint8ToBase64(new Uint8Array(viety.avain)),
    etuliite: uint8ToBase64(viety.etuliite),
    koodekki,
  };
  const tapahtuma = await salaaViesti(machine, omaKayttaja, kanavaId, TAPAHTUMATYYPPI, sisalto);
  return { lahetysAvain, tapahtuma };
}

/**
 * Purkaa saapuneen `aani_avain`-viestin sisällön. Palauttaa nullin jos purku
 * epäonnistuu (huoneavain ei ole vielä saapunut to-device-relenssin kautta) tai
 * sisältö ei ole odotettua muotoa — kutsuja jättää äänen silloin vain kuulumatta
 * eikä kaadu, sama periaate kuin viestit.ts:n haeJaPuraViestit.
 */
export async function vastaanotaAvain(
  machine: OlmMachine, kanavaId: string, tapahtuma: string,
): Promise<{ lahetysAvain: LahetysAvain; koodekki: Koodekki } | null> {
  const sisalto = await puraViesti(machine, kanavaId, tapahtuma) as Partial<AaniAvainSisalto> | null;
  if (!sisalto || typeof sisalto.avain !== 'string' || typeof sisalto.etuliite !== 'string') return null;
  const koodekki: Koodekki = sisalto.koodekki === 'aac' ? 'aac' : 'opus';
  try {
    const lahetysAvain = await tuoLahetysAvain(
      base64ToUint8(sisalto.avain).buffer as ArrayBuffer, base64ToUint8(sisalto.etuliite),
    );
    return { lahetysAvain, koodekki };
  } catch {
    return null;
  }
}

/** Yhden salatun äänikehyksen muunnos WS-siirtoon: ArrayBuffer <-> base64 (aani_kehys.data). */
export function kehysLahetettavaksi(salattu: ArrayBuffer): string {
  return uint8ToBase64(new Uint8Array(salattu));
}

export function kehysVastaanotetusta(data: string): ArrayBuffer {
  return base64ToUint8(data).buffer as ArrayBuffer;
}
