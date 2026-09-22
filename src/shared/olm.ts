// PTT-kanavien päästä-päähän-salauksen OlmMachine-kääre (erä 26, vaihe 2, viipaleet
// 2b—2c).
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
// KOKO PROTOKOLLAKIERTO (avainten lataus, kysely, laitteiden eksplisiittinen kysely,
// istunnon perustaminen, huoneavaimen jako, salaus, purku) on todennettu suoraan
// selaimessa kahden OlmMachine-instanssin välillä ennen tämän tiedoston kirjoittamista
// — ei arvattu API:sta. Kolme yllättävää löydöstä jotka muokkasivat toteutusta:
//
//  a) `queryKeysForUsers` on kutsuttava EKSPLISIITTISESTI ennen kuin toisen käyttäjän
//     laitteet tunnetaan — `receiveSyncChanges`:n `DeviceLists.changed` EI riitä
//     yksinään bootstrappaamaan tuntemattoman käyttäjän seurantaa.
//  b) `UserId`/`RoomId`-oliot KULUVAT KÄYTÖSSÄ (wasm-bindgen "moved" -semantiikka) —
//     samaa instanssia ei voi antaa kahdelle eri kutsulle, siksi joka funktio tekee
//     `new UserId(...)`/`new RoomId(...)` omasta merkkijonostaan sen sijaan että
//     tunnisteita cachettaisiin.
//  c) `decryptRoomEvent` vaatii TÄYDEN tapahtumaolion (sender, event_id,
//     origin_server_ts, type, content, room_id) — pelkkä `encryptRoomEvent`:n palauttama
//     salattu sisältö ei riitä ("missing field `sender`").
//
// CSP: WebAssembly.instantiate() vaatii 'wasm-unsafe-eval'-lähteen script-srciin
// (ks. csp.ts) — ilman sitä initAsync() heittää CompileError-poikkeuksen selaimessa,
// mitattu ennen korjausta.

import {
  initAsync, OlmMachine, UserId, DeviceId, RoomId, RequestType,
  EncryptionSettings, DecryptionSettings, TrustRequirement, DeviceLists,
  MegolmDecryptionError, DecryptionErrorCode,
  type KeysUploadRequest, type KeysQueryRequest, type KeysClaimRequest, type ToDeviceRequest,
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

export type LahetaLaitteelleRivi = { kayttaja: string; laiteId: string; sisalto: unknown };

/** ToDeviceRequest.body -> POST /api/kanavat/avaimet/laheta-laitteelle -viestilista. */
export function laiteviestitPyynnosta(bodyJson: string): LahetaLaitteelleRivi[] {
  const runko = JSON.parse(bodyJson);
  const rivit: LahetaLaitteelleRivi[] = [];
  for (const [matriisiKayttaja, laitteet] of Object.entries<Record<string, unknown>>(runko.messages || {})) {
    const kayttaja = omaKayttajaMatriisista(matriisiKayttaja);
    for (const [laiteId, sisalto] of Object.entries(laitteet)) {
      rivit.push({ kayttaja, laiteId, sisalto });
    }
  }
  return rivit;
}

type SaapunutLaiteviesti = { lahettaja: string; tyyppi: string; sisalto: unknown };

/** GET .../laitteelle -tulos -> receiveSyncChanges:n odottama to-device-tapahtumalista (JSON). */
export function laiteviestitTapahtumiksi(viestit: SaapunutLaiteviesti[]): string {
  return JSON.stringify(viestit.map((v) => ({
    type: v.tyyppi, sender: matriisiKayttajaId(v.lahettaja), content: v.sisalto,
  })));
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
 * Ajaa yhden kierroksen OlmMachinen ulosmenevistä pyynnöistä: KeysUpload, KeysQuery,
 * KeysClaim ja ToDevice viedään palvelimen omille reiteille ja vastaukset merkitään
 * takaisin koneelle. MUUT PYYNTÖTYYPIT (RoomMessage, SignatureUpload, KeysBackup)
 * EIVÄT OLE TUETTUJA — RoomMessage kuuluu vasta Vaiheeseen 3 (viestit), ja kaksi muuta
 * (ristiinallekirjoitus, avainvarmuuskopio) eivät kuulu tämän hankkeen laajuuteen.
 *
 * Palauttaa käsiteltyjen pyyntöjen tyypit — diagnostiikkaa varten (esim. tuliko
 * KeysUpload todella suoritettua koneen alustuksen yhteydessä).
 */
export async function synkronoiPyynnot(machine: OlmMachine): Promise<RequestType[]> {
  const pyynnot = await machine.outgoingRequests();
  const kasitellytTyypit: RequestType[] = [];
  for (const pyynto of pyynnot) {
    kasitellytTyypit.push(pyynto.type);
    // OutgoingRequest-unionin `id` on tyypitetty `string | undefined`, koska YKSI
    // seitsemästä jäsenestä (SignatureUploadRequest) voi olla ilman id:tä — ei koske
    // näitä neljää tyyppiä, joten tyyppiväite (as) vastaa ajonaikaista todellisuutta.
    if (pyynto.type === RequestType.KeysUpload) {
      const upload = pyynto as KeysUploadRequest;
      const laiteId = haeTaiLuoLaiteId();
      const vastaus = await palvelimelle('/api/kanavat/avaimet/lataa', lataaRunkoPyynnosta(laiteId, upload.body));
      await machine.markRequestAsSent(upload.id, upload.type, JSON.stringify({
        one_time_key_counts: { signed_curve25519: vastaus?.kertakayttoavaimiaJaljella ?? 0 },
      }));
    } else if (pyynto.type === RequestType.KeysQuery) {
      const query = pyynto as KeysQueryRequest;
      await machine.markRequestAsSent(query.id, query.type, await haeJaVastaaKyselyyn(kysytytKayttajat(query.body)));
    } else if (pyynto.type === RequestType.KeysClaim) {
      const claim = pyynto as KeysClaimRequest;
      const vastaus = await palvelimelle('/api/kanavat/avaimet/vaadi', { pyynnot: vaadiPyynnotPyynnosta(claim.body) });
      await machine.markRequestAsSent(claim.id, claim.type, vaadiVastausJsoniksi(vastaus?.avaimet || []));
    } else if (pyynto.type === RequestType.ToDevice) {
      const toDevice = pyynto as ToDeviceRequest;
      await palvelimelle('/api/kanavat/avaimet/laheta-laitteelle', {
        tyyppi: toDevice.event_type, viestit: laiteviestitPyynnosta(toDevice.body),
      });
      await machine.markRequestAsSent(toDevice.id, toDevice.type, JSON.stringify({}));
    }
    // Muut tyypit jätetään käsittelemättä (ks. tiedoston yläkommentti).
  }
  return kasitellytTyypit;
}

async function haeJaVastaaKyselyyn(kayttajat: string[]): Promise<string> {
  const vastaus = await fetch(`/api/kanavat/avaimet/kysely?kayttajat=${encodeURIComponent(kayttajat.join(','))}`, {
    credentials: 'include',
  }).then((r) => r.json()).catch(() => ({ kayttajat: {} }));
  return kyselyVastausJsoniksi(vastaus?.kayttajat || {});
}

/**
 * Pyytää EKSPLISIITTISESTI käyttäjän laitetiedot. Tarvitaan ennen kuin OlmMachine
 * suostuu perustamaan istunnon tai jakamaan huoneavaimen tuntemattoman käyttäjän kanssa
 * — pelkkä `synkronoiPyynnot` ei koskaan itsestään kysele uutta käyttäjää (todennettu
 * selaimessa: ks. tiedoston yläkommentti, kohta a).
 */
export async function paivitaKayttajanLaitteet(machine: OlmMachine, kayttaja: string): Promise<void> {
  const pyynto = machine.queryKeysForUsers([new UserId(matriisiKayttajaId(kayttaja))]);
  await machine.markRequestAsSent(pyynto.id, pyynto.type, await haeJaVastaaKyselyyn([kayttaja]));
}

/**
 * Varmistaa Olm-istunnot annetuille käyttäjille ennen huoneavaimen jakoa. Kutsujan on
 * kutsuttava `paivitaKayttajanLaitteet` jokaiselle uudelle käyttäjälle ensin, muuten
 * tällä ei ole mitään laitteita joille pyytää avainta.
 */
export async function varmistaIstunnot(machine: OlmMachine, kayttajat: string[]): Promise<void> {
  const pyynto = await machine.getMissingSessions(kayttajat.map((k) => new UserId(matriisiKayttajaId(k))));
  if (!pyynto) return;
  const vastaus = await palvelimelle('/api/kanavat/avaimet/vaadi', { pyynnot: vaadiPyynnotPyynnosta(pyynto.body) });
  await machine.markRequestAsSent(pyynto.id, pyynto.type, vaadiVastausJsoniksi(vastaus?.avaimet || []));
}

/**
 * Jakaa (tai kierrättää) kanavan huoneavaimen annetuille jäsenille ja toimittaa sen
 * heille to-device-relenssin kautta. Kutsujan vastuulla: `paivitaKayttajanLaitteet` ja
 * `varmistaIstunnot` jokaiselle jäsenelle ensin.
 */
export async function jaaHuoneenAvain(machine: OlmMachine, kanavaId: string, jasenet: string[]): Promise<void> {
  const roomId = new RoomId(matriisiHuoneId(kanavaId));
  const userIds = jasenet.map((k) => new UserId(matriisiKayttajaId(k)));
  await machine.shareRoomKey(roomId, userIds, new EncryptionSettings());
  await synkronoiPyynnot(machine);
}

/**
 * Salaa sisällön kanavalle ja palauttaa TÄYDEN tapahtumaolion JSON-merkkijonona —
 * `decryptRoomEvent` vaatii sender/event_id/origin_server_ts/room_id-kentät, pelkkä
 * salattu sisältö ei riitä (ks. tiedoston yläkommentti, kohta c). Vaatii että
 * `jaaHuoneenAvain` on kutsuttu tälle kanavalle aiemmin.
 */
export async function salaaViesti(
  machine: OlmMachine, omaKayttaja: string, kanavaId: string, tapahtumaTyyppi: string, sisalto: unknown,
): Promise<string> {
  const roomId = new RoomId(matriisiHuoneId(kanavaId));
  const salattuSisalto = await machine.encryptRoomEvent(roomId, tapahtumaTyyppi, JSON.stringify(sisalto));
  return JSON.stringify({
    event_id: `$${crypto.randomUUID()}`,
    sender: matriisiKayttajaId(omaKayttaja),
    origin_server_ts: Date.now(),
    type: 'm.room.encrypted',
    content: JSON.parse(salattuSisalto),
    room_id: matriisiHuoneId(kanavaId),
  });
}

/**
 * Purkaa kanavalta vastaanotetun täyden tapahtumaolion. Palauttaa alkuperäisen
 * `content`-kentän tai nullin jos purku epäonnistuu (esim. huoneavainta ei ole vielä
 * saatu — asiakas voi tällöin näyttää "odottaa avainta" eikä kaatua).
 */
export async function puraViesti(machine: OlmMachine, kanavaId: string, tapahtumaJson: string): Promise<unknown | null> {
  const roomId = new RoomId(matriisiHuoneId(kanavaId));
  try {
    const tulos = await machine.decryptRoomEvent(tapahtumaJson, roomId, new DecryptionSettings(TrustRequirement.Untrusted));
    return JSON.parse(tulos.event)?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * Sama kuin `puraViesti`, mutta EI nielaise purkuvirhettä — palauttaa myös
 * `DecryptionErrorCode`-nimen (esim. "MissingRoomKey") kun purku epäonnistuu.
 *
 * VAIN DIAGNOSTIIKKAA VARTEN, käytä `puraViesti`ä normaalisti. Oma funktio eikä
 * `puraViesti`n muokkaus, koska sitä kutsutaan myös tekstiviestien historian
 * purkuun (viestit.ts:n haeJaPuraViestit) jossa purkuvirhe on ODOTETTU, tavallinen
 * tila (vanhempi viesti jonka avainta ei vielä ole) eikä ansaitse konsolihälyä joka
 * kerta — PTT-äänen aani_avain sen sijaan on hetkellinen eikä persistoitu, joten
 * juuri sen purkuvirheen SYY on nähtävä heti (ks. aanikutsu.ts:n vastaanotaAvain).
 */
export async function puraViestiDiagnoosilla(
  machine: OlmMachine, kanavaId: string, tapahtumaJson: string,
): Promise<{ sisalto: unknown } | { virhe: string }> {
  const roomId = new RoomId(matriisiHuoneId(kanavaId));
  try {
    const tulos = await machine.decryptRoomEvent(tapahtumaJson, roomId, new DecryptionSettings(TrustRequirement.Untrusted));
    return { sisalto: JSON.parse(tulos.event)?.content ?? null };
  } catch (e) {
    if (e instanceof MegolmDecryptionError) {
      const nimi = DecryptionErrorCode[e.code] ?? String(e.code);
      return { virhe: `${nimi}: ${e.description}` };
    }
    return { virhe: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Hakee ja tyhjentää oman laitteen jonossa olevat to-device-viestit ja syöttää ne
 * OlmMachinelle. Kutsutaan `laiteviesti_saapui`-WS-herätteestä (src/shared/kanava.ts)
 * tai kytkeytymisen yhteydessä (jäljellä olevat viestit edelliseltä kerralta).
 */
export async function synkronoiLaiteviestit(machine: OlmMachine): Promise<void> {
  const laiteId = haeTaiLuoLaiteId();
  const vastaus = await fetch(`/api/kanavat/avaimet/laitteelle?laiteId=${encodeURIComponent(laiteId)}`, {
    credentials: 'include',
  }).then((r) => r.json()).catch(() => ({ viestit: [] }));
  const viestit: SaapunutLaiteviesti[] = vastaus?.viestit || [];
  if (viestit.length === 0) return;
  await machine.receiveSyncChanges(laiteviestitTapahtumiksi(viestit), new DeviceLists(), new Map());
}

// --- Jaettu instanssi (erä 26, vaihe 5) ----------------------------------------------
//
// USEA OlmMachine-INSTANSSI SAMAA IndexedDB-VARASTOA VASTEN ON VAARALLISTA: molemmat
// kirjoittaisivat samaan pysyvään ratchet-tilaan tietämättä toisistaan, mikä voi
// vioittaa istunnot. Mobiilikuoressa PTT-kanavapalkki (floor control) ja viestinäkymä
// tarvitsevat kumpikin pääsyn koneeseen — tämä varmistaa että kumpikin saa SAMAN
// instanssin sen sijaan että kumpikin alustaisi omansa.
let jaettuKoneLupaus: Promise<OlmMachine> | null = null;
let jaettuKoneKayttaja: string | null = null;

export function haeJaettuOlmMachine(kayttaja: string): Promise<OlmMachine> {
  if (jaettuKoneLupaus && jaettuKoneKayttaja === kayttaja) return jaettuKoneLupaus;
  jaettuKoneKayttaja = kayttaja;
  jaettuKoneLupaus = alustaOlmMachine(kayttaja);
  return jaettuKoneLupaus;
}
