// PTT-äänen kaappaus ja lähetys selaimessa (erä 26, jatko 23.9.2026 — käyttäjän pyyntö
// "Siirrytään rakentamaan manuaalinen äänenlähetys." sen jälkeen kun kaksipäiväinen
// "Odottaa avainta" -metsästys paljasti ettei mikään manuaalinen käyttöliittymäpolku
// (ei selain, ei natiivi) ole koskaan kaapannut tai lähettänyt ääntä — vain natiivin
// man-down-hälytys kutsuu AaniPuhelu.aloitaLahetys:ää, ks. Obsidian
// "PTT-äänibugin juurisyy".
//
// VASTINPARI aanivastaanotto.ts:lle: TÄMÄ TIEDOSTO EI VASTAANOTA MITÄÄN, pelkkä
// kaappaus/koodaus/lähetys. Rakentuu aaniraaka.ts:n JO TESTATUN putken päälle —
// sen oma yläkommentti: "TODENNETTU SUORAAN SELAIMESSA (Chrome)... täysi kierto
// synteettisellä oskillaattoriäänellä (MediaStreamTrackProcessor -> AudioEncoder ->
// TÄMÄ PAKKAUS -> aanisalaus.ts:n salaaKehys -> puraKehys -> AudioDecoder) tuotti
// 11/11 pakettia oikein dekoodattuna" — tämä tiedosto vain kytkee sen getUserMediaan
// ja huolehtii elinkaaresta (aloitus/lopetus/virheet), ei keksi uutta putkea.
//
// KOODEKKIVALINTA: Opus ensisijainen (sama kuin natiivi), AAC-LC varalla jos selain ei
// tue Opus-ENKOODAUSTA. `AudioEncoder.isConfigSupported` tarkistaa eikä arvaa — natiivin
// OpusKoodekki.java tekee saman valinnan samasta syystä (laitekohtainen enkooderituki
// vaihtelee). Vastaanottopuolen tunnettu AAC-rajoite (aanivastaanotto.ts:n description-
// kenttä) koskee VAIN natiivin MediaCodec-enkooderia, joka ei tuota sitä — selaimen oma
// AudioEncoder.configure() tuottaa AAC:lle description-kentän automaattisesti, joten
// selain->selain-AAC voisi toimia silti. Ei testattu tässä siivussa.
//
// TODENNETTU OIKEALLA MIKROFONILLA 23.9.2026: puhelimen Chrome, Opus-koodekki, ääni
// kuului HÄLKEssä asti. Yhdeksän muuta, riippumatonta bugia piti löytää ja korjata
// avaimenjako- ja kuljetusketjusta ennen kuin tämä oikeasti kuului — ks. Obsidian
// "PTT-äänibugin juurisyy" täydelle listalle.

import { luoLahetysKasittelija } from './aaniraaka.ts';
import type { Koodekki } from './aanikutsu.ts';
import type { LahetysAvain } from './aanisalaus.ts';

// MediaStreamTrackProcessor ("Insertable Streams for MediaStreamTrack") on vielä
// Chromium-selainten oma rajapinta eikä TypeScriptin DOM-kirjastossa (toisin kuin
// AudioDecoder/AudioEncoder, jotka ovat jo vakioidumpia ja siksi kirjastossa valmiina).
// Minimaalinen kuvaus vain sille mitä tämä tiedosto oikeasti käyttää.
declare global {
  class MediaStreamTrackProcessor {
    constructor(init: { track: MediaStreamTrack });
    readonly readable: ReadableStream<AudioData>;
  }
}

const NAYTTEENOTTOTAAJUUS = 48_000;
// PTT-ääni ei tarvitse musiikkilaatua — 24 kbit/s on Opuksen suositeltu ala-alue
// puheelle ja pitää kehyskoon (siis myös per-kehys-verkkokuorman) pienenä.
const BITTINOPEUS = 24_000;

/** WebCodecsin AudioEncoder-koodekkimerkkijono. Sama kartoitus kuin aanivastaanotto.ts:ssä. */
function koodekkimerkkijono(koodekki: Koodekki): string {
  return koodekki === 'opus' ? 'opus' : 'mp4a.40.2';
}

/**
 * Onko selaimessa edes teoriassa mahdollista kaapata ja koodata ääntä. Kutsuja päättää
 * mitä tehdä jos ei (sama periaate kuin aanivastaanotto.ts:n voikoPurkaa) — esim.
 * MobiiliKehys.tsx voi näyttää mic-napin harmaana selaimissa joissa tätä ei ole.
 */
export async function voikoLahettaa(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
  if (typeof MediaStreamTrackProcessor === 'undefined') return false;
  if (typeof AudioEncoder === 'undefined') return false;
  return true;
}

/**
 * Valitsee koodekin ENNEN kaappauksen aloitusta — kutsujan on tiedettävä tämä jo
 * `aani_avain`-ilmoitusta rakentaessaan (aanikutsu.ts:n aloitaLahetys ottaa koodekin
 * parametrina), koska vastaanottajan on saatava tietää Opus-vai-AAC jo ENNEN
 * ensimmäistä kehystä. Sama järjestys kuin natiivin AaniPuhelu.java:ssa
 * (OpusKoodekki.luoEnkooderi kutsutaan ennen aani_avain-viestin rakentamista).
 * Palauttaa nullin jos WebCodecs puuttuu tai kumpikaan koodekki ei kelpaa selaimelle.
 */
export async function paatettavaKoodekki(): Promise<Koodekki | null> {
  if (!(await voikoLahettaa())) return null;
  return parasKoodekki();
}

async function parasKoodekki(): Promise<Koodekki | null> {
  try {
    const opus = await AudioEncoder.isConfigSupported({
      codec: 'opus', sampleRate: NAYTTEENOTTOTAAJUUS, numberOfChannels: 1, bitrate: BITTINOPEUS,
    });
    if (opus.supported) return 'opus';
  } catch {
    // Jatketaan AAC-yritykseen.
  }
  try {
    const aac = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2', sampleRate: NAYTTEENOTTOTAAJUUS, numberOfChannels: 1, bitrate: BITTINOPEUS,
    });
    if (aac.supported) return 'aac';
  } catch {
    // Ei kumpikaan — aloita() palauttaa nullin.
  }
  return null;
}

export type Lahetin = {
  /**
   * Pyytää mikrofonin ja käynnistää kaappauksen jo PÄÄTETYLLÄ koodekilla (ks.
   * paatettavaKoodekki — kutsuja on jo lähettänyt aani_avainin tällä koodekilla ennen
   * tätä kutsua). Palauttaa true jos onnistui, false jos mikrofonia ei saatu (käyttäjä
   * epäsi luvan tms.) — kutsuja näyttää tämän käyttöliittymässä ja vapauttaa
   * puheenvuoron, koska ääntä ei silloin ole tulossa.
   */
  aloita: (
    avain: LahetysAvain, koodekki: Koodekki,
    onKehys: (paketti: ArrayBuffer) => void,
    onVirhe: (viesti: string) => void,
  ) => Promise<boolean>;
  /** Pysäyttää kaappauksen ja vapauttaa mikrofonin. Turvallinen kutsua vaikka ei olisi käynnissä. */
  lopeta: () => void;
};

/**
 * Yksi lähetin per painallus, ei jaettu singletoni — sama malli kuin natiivin
 * AaniLahetin.java:lla ja selaimen oman AaniVastaanotin-parin (aanivastaanotto.ts)
 * per-kuuntelu-instansseilla. Edellisen painalluksen mikrofonin on oltava kiinni ennen
 * kuin uusi voi avautua (yksi fyysinen mikrofoni, sama rajoite kuin natiivilla).
 */
export function luoLahetin(): Lahetin {
  let stream: MediaStream | null = null;
  let reader: ReadableStreamDefaultReader<AudioData> | null = null;
  let encoder: AudioEncoder | null = null;
  let pysaytetty = false;

  async function lueSilmukka(oma: ReadableStreamDefaultReader<AudioData>, onVirhe: (viesti: string) => void) {
    try {
      for (;;) {
        const { value, done } = await oma.read();
        if (done) break;
        if (!value) continue;
        if (pysaytetty || reader !== oma || encoder?.state !== 'configured') {
          value.close();
          continue;
        }
        encoder.encode(value);
        value.close();
      }
    } catch (e) {
      // Raita katkesi kesken (esim. käyttäjä perui mikrofoniluvan kesken puhumisen, tai
      // puhelin sulki mikrofonin toisen sovelluksen tieltä) — näkyvä virhe eikä hiljainen
      // nielaisu, sama perustelu kuin enkooderin omalla virhekäsittelijällä yllä.
      if (!pysaytetty) onVirhe(`Mikrofonin luku katkesi: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function aloita(
    avain: LahetysAvain, koodekki: Koodekki,
    onKehys: (paketti: ArrayBuffer) => void,
    onVirhe: (viesti: string) => void,
  ): Promise<boolean> {
    lopeta();
    pysaytetty = false;
    if (!(await voikoLahettaa())) return false;

    try {
      // Ei kaikuvaimennusta/kohinanvaimennusta väkisin pois — GUARD-kenttäkäyttö on
      // usein ulkona/melussa, ja nämä ovat puhelimen omia, hyvin testattuja algoritmeja
      // joita natiivin MediaCodec-polulla ei ole tarjolla samalla tavalla.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true, noiseSuppression: true, autoGainControl: true,
          channelCount: 1, sampleRate: NAYTTEENOTTOTAAJUUS,
        },
      });
    } catch {
      // Käyttäjä epäsi mikrofonin, tai laitteella ei ole yhtään — hiljainen false,
      // kutsuja näyttää tämän käyttöliittymässä. Sama "puuttuva kyky näkyy hallittuna
      // ei-minä" -periaate kuin muuallakin tässä äänipolussa.
      return false;
    }

    const [raita] = stream.getAudioTracks();
    if (!raita) { lopeta(); return false; }

    const kasittele = luoLahetysKasittelija(avain);

    try {
      encoder = new AudioEncoder({
        output: (chunk) => {
          kasittele(chunk).then((paketti) => { if (!pysaytetty) onKehys(paketti); });
        },
        // Enkooderin sisäinen virhe sulkee koko lähetyksen — sama periaate kuin
        // vastaanottopuolen dekooderivirheellä (aanivastaanotto.ts): ei yritetä paikata,
        // pysäytetään siisti ja odotetaan seuraavaa painallusta. NÄKYVÄ virhe eikä
        // hiljainen nielaisu (ks. olm.ts:n koneVirhe-korjauksen perustelu 22.9.2026) —
        // muuten "ääntä ei kuulu" näyttäisi identtiseltä onnistuneen lähetyksen kanssa.
        error: (e) => { onVirhe(`Äänenkoodaus epäonnistui: ${e.message}`); lopeta(); },
      });
      encoder.configure({
        codec: koodekkimerkkijono(koodekki),
        sampleRate: NAYTTEENOTTOTAAJUUS,
        numberOfChannels: 1,
        bitrate: BITTINOPEUS,
      });
    } catch {
      lopeta();
      return false;
    }

    const uusiReader = new MediaStreamTrackProcessor({ track: raita }).readable.getReader();
    reader = uusiReader;
    lueSilmukka(uusiReader, onVirhe);
    return true;
  }

  function lopeta() {
    pysaytetty = true;
    try { reader?.cancel(); } catch { /* saattoi olla jo suljettu */ }
    reader = null;
    try { encoder?.close(); } catch { /* saattoi olla jo suljettu virhetilan jälkeen */ }
    encoder = null;
    for (const raita of stream?.getTracks() ?? []) raita.stop();
    stream = null;
  }

  return { aloita, lopeta };
}
