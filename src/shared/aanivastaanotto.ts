// PTT-äänen vastaanotto ja toisto selaimessa (erä 26, vaihe 8/9: HÄLKE-yhteenveto ja
// kuuntelu, käyttäjän pyyntö 22.9.2026: "Lisätään HÄLKE oma osio PTT varten. Sinne
// yhteenveto kanavista ja kuuntelumahdollisuus.").
//
// ENSIMMÄINEN OIKEA ÄÄNEN TOISTO SELAIMESSA TÄSSÄ HANKKEESSA. Vaiheen 4 PoC:t
// (aanisalaus.ts, aaniraaka.ts) ja vaiheen 6 aanikutsu.ts rakensivat kuljetuksen ja
// avainvaihdon, mutta itse WebCodecs/Web Audio -kytkentä oli tarkoituksella rajattu
// pois jokaisesta niistä (ks. niiden omat yläkommentit) — tämä tiedosto on se kytkentä.
// EI LÄHETÄ MITÄÄN — pelkkä vastaanotto/toisto. Lähetys (getUserMedia/AudioEncoder
// puhelimen selaimessa) on eri, vielä tekemätön tehtävä, ks. Obsidian
// "vaihe 8 -suunnitelma": "Selaimen getUserMedia/AudioEncoder-kytkentä".
//
// TODENNETTU OIKEALLA ÄÄNELLÄ 23.9.2026: selaimen manuaalinen lähetys (aanilahetys.ts)
// puhelimen mikrofonista tämän koodin kautta HÄLKEn kaiuttimeen asti, Opus-koodekilla.
//
// AAC-VARAPOLKU ON KOKEELLISEMPI KUIN OPUS: WebCodecsin AudioDecoder vaatii AAC:lle
// tyypillisesti `description`-kentän (AudioSpecificConfig), jota natiivin
// OpusKoodekki.java:n MediaCodec-enkooderi ei tuota tähän kulkuun — Opus ei tätä
// tarvitse. Jos vastaanotettu kanava käyttää AAC-varapolkua (natiivilaite jolla Opus-
// enkooderi ei ollut käytettävissä), purku voi epäonnistua tästä syystä. Rajattu
// tunnettu puute, ei korjattu tässä viipaleessa.

import { puraVastaanotettu } from './aaniraaka.ts';
import { kehysVastaanotetusta, type Koodekki } from './aanikutsu.ts';
import type { LahetysAvain } from './aanisalaus.ts';

/** WebCodecsin AudioDecoder-koodekkimerkkijono. AAC-LC (mp4a.40.2) on paras arvaus ilman description-kenttää. */
function koodekkimerkkijono(koodekki: Koodekki): string {
  return koodekki === 'opus' ? 'opus' : 'mp4a.40.2';
}

/** Onko selaimessa edes teoriassa mahdollista purkaa tätä koodekkia. Kutsuja päättää mitä tehdä jos ei. */
export async function voikoPurkaa(koodekki: Koodekki): Promise<boolean> {
  if (typeof AudioDecoder === 'undefined') return false;
  try {
    const tulos = await AudioDecoder.isConfigSupported({
      codec: koodekkimerkkijono(koodekki), sampleRate: 48_000, numberOfChannels: 1,
    });
    return tulos.supported === true;
  } catch {
    return false;
  }
}

export type Vastaanotin = {
  /** Uusi kertakäyttöavain saapui (aani_avain) — (uudelleen)käynnistää dekooderin. */
  aloita: (avain: LahetysAvain, koodekki: Koodekki) => Promise<boolean>;
  /** Yksi salattu kehys saapui (aani_kehys.data, base64). */
  vastaanotaKehys: (data: string) => void;
  /** Pysäyttää toiston ja vapauttaa dekooderin. Turvallinen kutsua vaikka ei olisi käynnissä. */
  lopeta: () => void;
};

/**
 * Yksi kuuntelija yhdelle kanavalle. Oma AudioContext per vastaanotin — HÄLKEn
 * yhteenvetopaneeli (PttYhteenveto.tsx) luo yhden kutakin AUKI OLEVAA kuuntelua
 * kohden, ei jaettua singletonia, koska päivystäjä voi teoriassa haluta kuunnella
 * useampaa kanavaa yhtä aikaa (sama malli kuin natiivin AaniPuhelu.java:n
 * `vastaanotot`-kartta, joka sekin on kanavakohtainen eikä yksi jaettu soitin).
 *
 * KEHYKSET AJASTETAAN PERÄKKÄIN AudioContextin OMALLA KELLOLLA
 * (`AudioBufferSourceNode.start(alku)`), EI SOITETA HETI KUN NE SAAPUVAT — sama
 * periaate kuin minkä tahansa jitter-puskuroidun striimin toistossa: ilman tätä
 * verkon epätasainen saapumistahti kuuluisi suoraan äänen nykimisenä.
 */
export function luoVastaanotin(): Vastaanotin {
  let audioCtx: AudioContext | null = null;
  let decoder: AudioDecoder | null = null;
  let avain: LahetysAvain | null = null;
  // AudioContext-aikajanan kohta johon seuraava dekoodattu pala ajastetaan. Nollataan
  // joka aloita()-kutsulla (uusi PTT-painallus, uusi kertakäyttöavain) — muuten uuden
  // painalluksen ensimmäinen kehys odottaisi edellisen painalluksen viimeisen tauon loppuun.
  let seuraavaAlkuS = 0;
  // VÄLIAIKAINEN DIAGNOSTIIKKA (26.9.2026) — ks. vastaanotaKehys:n oma kommentti.
  let ekaVirheNaytetty = false;

  function varmistaAudioCtx(): AudioContext {
    if (!audioCtx) audioCtx = new AudioContext();
    return audioCtx;
  }

  function soitaPala(ctx: AudioContext, data: AudioData) {
    try {
      const kanavia = data.numberOfChannels;
      const naytteita = data.numberOfFrames;
      const puskuri = ctx.createBuffer(kanavia, naytteita, data.sampleRate);
      const tilapuskuri = new Float32Array(naytteita);
      for (let kanava = 0; kanava < kanavia; kanava++) {
        data.copyTo(tilapuskuri, { planeIndex: kanava, format: 'f32-planar' });
        puskuri.copyToChannel(tilapuskuri, kanava);
      }
      const lahde = ctx.createBufferSource();
      lahde.buffer = puskuri;
      lahde.connect(ctx.destination);
      // Ei koskaan menneisyyteen: jos vastaanotto on jäänyt jälkeen (esim. selain oli
      // taustalla hetken), ajastus hyppää nykyhetkeen sen sijaan että yrittäisi soittaa
      // kaiken kiinni kerralla nopeutettuna — sama "kadonnut on parempi kuin myöhässä"
      // -periaate kuin muuallakin tässä äänipolussa.
      const alku = Math.max(seuraavaAlkuS, ctx.currentTime);
      lahde.start(alku);
      seuraavaAlkuS = alku + puskuri.duration;
    } finally {
      data.close();
    }
  }

  async function aloita(uusiAvain: LahetysAvain, koodekki: Koodekki): Promise<boolean> {
    lopeta();
    ekaVirheNaytetty = false;
    if (typeof AudioDecoder === 'undefined') return false;
    const ctx = varmistaAudioCtx();
    // Selain voi keskeyttää AudioContextin ennen ensimmäistä käyttäjän elettä —
    // resume() ei-tyhjä lupaus on turvallinen kutsua vaikka konteksti olisi jo käynnissä.
    try {
      await ctx.resume();
    } catch {
      // Jatketaan silti — start() epäonnistuu myöhemmin jos konteksti ei oikeasti käy,
      // eikä tätä virhettä kannata näyttää erikseen tässä vaiheessa.
    }
    // VÄLIAIKAINEN DIAGNOSTIIKKA (26.9.2026, ääni ei kuulu vieläkään vaikka huoneavain
    // nyt saapuu ja purkautuu onnistuneesti) — jos selain ei ole koskaan saanut
    // käyttäjän elettä (sama syy kuin konsolin "Blocked call to navigator.vibrate
    // because user hasn't tapped" -varoitus), AudioContext voi jäädä pysyvästi
    // "suspended"-tilaan resume()-kutsusta huolimatta, jolloin start() ei koskaan
    // oikeasti tuota ääntä vaikka mitään virhettä ei näy.
    // eslint-disable-next-line no-console
    console.log(`PTT-äänikonteksti tila=${ctx.state}`);
    avain = uusiAvain;
    seuraavaAlkuS = ctx.currentTime;
    try {
      decoder = new AudioDecoder({
        output: (data) => soitaPala(ctx, data),
        // Dekooderin sisäinen virhe (esim. AAC ilman kelvollista description-kenttää,
        // ks. tiedoston yläkommentti) sulkee dekooderin kokonaan — pudotetaan koko
        // kuuntelu hiljaa siihen asti kunnes uusi aani_avain (siis uusi painallus)
        // käynnistää sen uudelleen, sama periaate kuin yksittäisen kehyksen pudotuksella.
        error: () => { decoder = null; },
      });
      decoder.configure({
        codec: koodekkimerkkijono(koodekki),
        sampleRate: 48_000,
        numberOfChannels: 1,
      });
      return true;
    } catch {
      decoder = null;
      return false;
    }
  }

  // VÄLIAIKAINEN DIAGNOSTIIKKA (26.9.2026, ääni ei kuulu vieläkään vaikka avain
  // purkautuu ja AudioContext on "running") — kolme aiemmin täysin hiljaista
  // pudotuskohtaa (avain/decoder puuttuu, purku epäonnistuu, decode() heittää)
  // näytetään nyt kertaalleen per vastaanotin jotta nähdään MIKÄ vaihe oikeasti
  // pudottaa kehykset natiivin lähettämälle Opukselle.
  function vastaanotaKehys(data: string) {
    if (!avain || !decoder || decoder.state !== 'configured') {
      if (!ekaVirheNaytetty) {
        ekaVirheNaytetty = true;
        // eslint-disable-next-line no-console
        console.log(`PTT-kehys pudotettu: avain=${Boolean(avain)} decoder=${Boolean(decoder)} tila=${decoder?.state ?? '-'}`);
      }
      return;
    }
    const lahetysAvain = avain;
    const kohdeDecoder = decoder;
    puraVastaanotettu(lahetysAvain, kehysVastaanotetusta(data))
      .then((chunk) => {
        // Kanava on voinut vaihtua (uusi aloita()) sen aikana kun purku oli kesken —
        // vain SAMALLE dekooderille annetaan tulos, ei sille mikä sattuu olemaan
        // muuttujassa nyt.
        if (decoder === kohdeDecoder && kohdeDecoder.state === 'configured') {
          try {
            kohdeDecoder.decode(chunk);
          } catch (e) {
            if (!ekaVirheNaytetty) {
              ekaVirheNaytetty = true;
              // eslint-disable-next-line no-console
              console.error(`PTT-kehyksen decode() epäonnistui: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }
      })
      .catch((e: unknown) => {
        // Purku epäonnistui (väärä avain, vioittunut paketti) — pudotetaan kehys
        // hiljaa jatkossakin, sama periaate kuin natiivin AaniVastaanotin.java:lla,
        // mutta ENSIMMÄINEN kerta näytetään jotta syy ei jää arvailuksi.
        if (!ekaVirheNaytetty) {
          ekaVirheNaytetty = true;
          // eslint-disable-next-line no-console
          console.error(`PTT-kehyksen purku epäonnistui: ${e instanceof Error ? e.message : String(e)}`);
        }
      });
  }

  function lopeta() {
    try {
      decoder?.close();
    } catch {
      // Saattoi olla jo suljettu (virhetilan jälkeen) — ei aiheuta mitään korjattavaa.
    }
    decoder = null;
    avain = null;
  }

  return { aloita, vastaanotaKehys, lopeta };
}
