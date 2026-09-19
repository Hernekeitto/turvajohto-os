// PTT-kanavien päästä-päähän-salauksen OlmMachine-kääre (erä 26, vaihe 2, viipale 2b).
//
// Kirjastovalinta ja palvelimen avainvaraston muoto: ks. server/kryptoavaimet.js ja
// Obsidian "Turvajohto OS PTT, vaihe 2 -suunnitelma". Tämä tiedosto on ohut kääre
// @matrix-org/matrix-sdk-crypto-wasm:n OlmMachinen ympärillä. Se EI TEE MITÄÄN
// KRYPTOGRAFIAA ITSE, vain:
//
//  1. Muuntaa meidän tunnisteemme (käyttäjätunnus, kanava-id) Matrixin vaatimaan
//     sigiiliketjuun (@user:domain, !room:domain) — OlmMachine hylkää muun muotoiset
//     tunnisteet virheellä "leading sigil is incorrect or missing", todennettu
//     selaimessa ennen tämän tiedoston kirjoittamista.
//  2. Vie OlmMachinen tuottamat pyynnöt (KeysUploadRequest ym.) palvelimen omille
//     reiteille ja tuo vastaukset takaisin `markRequestAsSent`illa.
//
// TÄSSÄ VIIPALEESSA VAIN AVAINTEN SYNKRONOINTI (lataus/kysely/vaatiminen) — ei vielä
// to-device-viestien välitystä eikä huoneavaimen jakoa (shareRoomKey). Ne vaativat oman
// palvelinpuolen relensä (to-device-jono) eivätkä kuulu tähän viipaleeseen.
//
// CSP: WebAssembly.instantiate() vaatii 'wasm-unsafe-eval'-lähteen script-srciin
// (ks. csp.ts) — ilman sitä initAsync() heittää CompileError-poikkeuksen selaimessa,
// mitattu ennen korjausta.

import {
  initAsync, OlmMachine, UserId, DeviceId, RequestType,
  type KeysUploadRequest, type KeysQueryRequest, type KeysClaimRequest,
} from '@matrix-org/matrix-sdk-crypto-wasm';

// Pseudo-toimialue Matrixin tunnistemuotoa varten. EI oikea verkkotunnus eikä koskaan
// resolvoidu mihinkään — Matrixin ID-kielioppi vaatii toimialueosan, mutta tämä sovellus
// ei federoi eikä puhu oikealle Matrix-kotipalvelimelle. Kiinteä ja mielivaltainen.
const PSEUDO_TOIMIALUE = 'turvajohto.local';

export const matriisiKayttajaId = (kayttaja: string): string => `@${kayttaja}:${PSEUDO_TOIMIALUE}`;
export const matriisiHuoneId = (kanavaId: string): string => `!${kanavaId}:${PSEUDO_TOIMIALUE}`;

/** Käyttäjätunnus matriisimuotoisesta id:stä ("@vartija1:turvajohto.local" -> "vartija1"). */
export function omaKayttajaMatriisista(matriisiId: string): string {
  const ilmanSigiilia = matriisiId.startsWith('@') ? matriisiId.slice(1) : matriisiId;
  return ilmanSigiilia.split(':')[0] ?? ilmanSigiilia;
}

const LAITE_AVAIN = 'ptt-olm-laite-id';
const SALASANA_AVAIN = 'ptt-olm-varasto-salasana';

/**
 * Laitteen oma pysyvä tunnus. Yksi selain/laite = yksi Olm-identiteetti (suunnitelman
 * kohta 1: per-laite, ei per-käyttäjä) — sama tunnus kirjautuneena kahdelle laitteelle
 * tarkoittaa kahta identiteettiä, ei yhtä jaettua.
 */
export function haeTaiLuoLaiteId(): string {
  const olemassaOleva = localStorage.getItem(LAITE_AVAIN);
  if (olemassaOleva) return olemassaOleva;
  const uusi = crypto.randomUUID();
  localStorage.setItem(LAITE_AVAIN, uusi);
  return uusi;
}

/**
 * Paikallisen avainvaraston (IndexedDB) salasana. Ei koskaan lähde laitteelta —
 * palvelin ei näe eikä tarvitse tätä, se suojaa vain oman selaimen levyllä olevaa
 * varastoa.
 */
function haeTaiLuoVarastonSalasana(): string {
  const olemassaOleva = localStorage.getItem(SALASANA_AVAIN);
  if (olemassaOleva) return olemassaOleva;
  const uusi = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  localStorage.setItem(SALASANA_AVAIN, uusi);
  return uusi;
}

let wasmLupaus: Promise<void> | null = null;
function varmistaWasmLadattu(): Promise<void> {
  if (!wasmLupaus) wasmLupaus = initAsync();
  return wasmLupaus;
}

/**
 * Alustaa tämän laitteen OlmMachine-instanssin. Pysyvä IndexedDB-varasto laitteen omalla
 * tunnuksella — sama identiteetti säilyy selaimen sulkemisen ja uudelleenavauksen yli,
 * toisin kuin oletusarvoinen muistivarasto.
 */
export async function alustaOlmMachine(kayttaja: string): Promise<OlmMachine> {
  await varmistaWasmLadattu();
  const laiteId = haeTaiLuoLaiteId();
  return OlmMachine.initialize(
    new UserId(matriisiKayttajaId(kayttaja)),
    new DeviceId(laiteId),
    `ptt-olm-${kayttaja}-${laiteId}`,
    haeTaiLuoVarastonSalasana(),
  );
}

// --- Palvelinkutsujen kääntökerros ---------------------------------------------------
//
// OlmMachine tuottaa ja lukee JSON:ia Matrixin omassa /keys/upload, /keys/query,
// /keys/claim -muodossa (device_keys, one_time_keys — todennettu suoraan selaimessa
// ennen näiden funktioiden kirjoittamista). Palvelimemme käyttää samaa sisältöä mutta
// omilla kenttänimillään (laiteId, deviceKeys, kertakayttoavaimet, algoritmi) — tämä on
// ainoa paikka jossa nämä kaksi muotoa kohtaavat. Puhtaita funktioita, ei verkkoa,
// testattu erikseen.

export type LataaRunko = { laiteId: string; deviceKeys: unknown; kertakayttoavaimet: unknown };

/** KeysUploadRequest.body -> POST /api/kanavat/avaimet/lataa -runko. */
export function lataaRunkoPyynnosta(laiteId: string, bodyJson: string): LataaRunko {
  const runko = JSON.parse(bodyJson);
  return { laiteId, deviceKeys: runko.device_keys, kertakayttoavaimet: runko.one_time_keys ?? {} };
}

/** KeysQueryRequest.body -> lista käyttäjätunnuksia (ei matriisimuodossa) joita kysytään. */
export function kysytytKayttajat(bodyJson: string): string[] {
  const runko = JSON.parse(bodyJson);
  return Object.keys(runko.device_keys || {}).map(omaKayttajaMatriisista);
}

type KyselyTulos = Record<string, Array<{ deviceKeys?: { device_id?: string } }>>;

/** GET .../kysely -tulos -> Matrixin /keys/query-vastaus-JSON markRequestAsSentille. */
export function kyselyVastausJsoniksi(kayttajat: KyselyTulos): string {
  const device_keys: Record<string, Record<string, unknown>> = {};
  for (const [kayttaja, laitteet] of Object.entries(kayttajat)) {
    const matriisiId = matriisiKayttajaId(kayttaja);
    const laitteenAvaimet: Record<string, unknown> = {};
    for (const laite of laitteet) {
      const laiteId = laite.deviceKeys?.device_id;
      if (laiteId) laitteenAvaimet[laiteId] = laite.deviceKeys;
    }
    device_keys[matriisiId] = laitteenAvaimet;
  }
  return JSON.stringify({ device_keys });
}

export type VaadiPyynto = { kayttaja: string; laiteId: string; algoritmi: string };

/** KeysClaimRequest.body -> POST /api/kanavat/avaimet/vaadi -pyyntölista. */
export function vaadiPyynnotPyynnosta(bodyJson: string): VaadiPyynto[] {
  const runko = JSON.parse(bodyJson);
  const pyynnot: VaadiPyynto[] = [];
  for (const [matriisiKayttaja, laitteet] of Object.entries<Record<string, string>>(runko.one_time_keys || {})) {
    const kayttaja = omaKayttajaMatriisista(matriisiKayttaja);
    for (const [laiteId, algoritmi] of Object.entries(laitteet)) {
      pyynnot.push({ kayttaja, laiteId, algoritmi });
    }
  }
  return pyynnot;
}

type VaadiTulosRivi = { kayttaja: string; laiteId: string; keyId: string | null; avain: unknown };

/** POST .../vaadi -tulos -> Matrixin /keys/claim-vastaus-JSON markRequestAsSentille. */
export function vaadiVastausJsoniksi(avaimet: VaadiTulosRivi[]): string {
  const one_time_keys: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const { kayttaja, laiteId, keyId, avain } of avaimet) {
    if (!keyId || avain === null || avain === undefined) continue;
    const matriisiId = matriisiKayttajaId(kayttaja);
    one_time_keys[matriisiId] ??= {};
    one_time_keys[matriisiId][laiteId] ??= {};
    one_time_keys[matriisiId][laiteId][keyId] = avain;
  }
  return JSON.stringify({ one_time_keys });
}

// --- Synkronointi ---------------------------------------------------------------------

async function palvelimelle(polku: string, runko: unknown) {
  const vastaus = await fetch(polku, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(runko),
  });
  return vastaus.json().catch(() => null);
}

/**
 * Ajaa yhden kierroksen OlmMachinen ulosmenevistä pyynnöistä: KeysUpload, KeysQuery ja
 * KeysClaim viedään palvelimen omille reiteille ja vastaukset merkitään takaisin
 * koneelle. MUUT PYYNTÖTYYPIT (ToDevice, RoomMessage, SignatureUpload, KeysBackup)
 * EIVÄT VIELÄ OLE TUETTUJA — niitä ei synny ennen kuin huoneavainten jako
 * (shareRoomKey) rakennetaan, oma viipaleensa (2c).
 */
export async function synkronoiAvaimet(machine: OlmMachine): Promise<void> {
  const pyynnot = await machine.outgoingRequests();
  for (const pyynto of pyynnot) {
    // OutgoingRequest-unionin `id` on tyypitetty `string | undefined`, koska YKSI
    // seitsemästä jäsenestä (SignatureUploadRequest) voi olla ilman id:tä — ei koske
    // näitä kolmea tyyppiä, joten tyyppiväite (as) vastaa ajonaikaista todellisuutta.
    if (pyynto.type === RequestType.KeysUpload) {
      const upload = pyynto as KeysUploadRequest;
      const laiteId = haeTaiLuoLaiteId();
      const vastaus = await palvelimelle('/api/kanavat/avaimet/lataa', lataaRunkoPyynnosta(laiteId, upload.body));
      await machine.markRequestAsSent(upload.id, upload.type, JSON.stringify({
        one_time_key_counts: { signed_curve25519: vastaus?.kertakayttoavaimiaJaljella ?? 0 },
      }));
    } else if (pyynto.type === RequestType.KeysQuery) {
      const query = pyynto as KeysQueryRequest;
      const kayttajat = kysytytKayttajat(query.body).join(',');
      const vastaus = await fetch(`/api/kanavat/avaimet/kysely?kayttajat=${encodeURIComponent(kayttajat)}`, {
        credentials: 'include',
      }).then((r) => r.json()).catch(() => ({ kayttajat: {} }));
      await machine.markRequestAsSent(query.id, query.type, kyselyVastausJsoniksi(vastaus?.kayttajat || {}));
    } else if (pyynto.type === RequestType.KeysClaim) {
      const claim = pyynto as KeysClaimRequest;
      const vastaus = await palvelimelle('/api/kanavat/avaimet/vaadi', { pyynnot: vaadiPyynnotPyynnosta(claim.body) });
      await machine.markRequestAsSent(claim.id, claim.type, vaadiVastausJsoniksi(vastaus?.avaimet || []));
    }
    // Muut tyypit jätetään käsittelemättä tässä viipaleessa (ks. tiedoston yläkommentti).
  }
}
