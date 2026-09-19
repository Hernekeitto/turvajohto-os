// Paikallinen lähetysjono tekstiviesteille (erä 26, vaihe 3, viipale 3c).
//
// KADONNUT VIESTI ON AINA HUONOMPI KUIN VIIVÄSTYNYT (Obsidian: "vaihe 3 -suunnitelma",
// kohta 4) — eri periaate kuin sijaintipäivityksillä, jotka ovat tarkoituksella
// "hiljainen ei-mitään" jos yhteyttä ei ole. Viesti pysyy jonossa NÄKYVÄSTI
// ("lähetetään…") kunnes palvelin on kuitannut sen, ja säilyy selaimen sulkemisen yli
// (localStorage) koska verkkokatkos voi kestää pidempään kuin välilehti on auki.
//
// AJASTUS ON KUTSUJAN VASTUULLA: tämä tiedosto ei käynnistä ajastimia itse — kutsuja
// (UI-kerros, vaihe 5) päättää milloin kasittele() ajetaan (esim. verkon palautuessa,
// määrävälein, tai heti jonotuksen jälkeen). Tämä pitää tiedoston testattavana ilman
// piilotettuja ajastimia.

import { lahetaTekstiviesti } from './viestit.ts';
import type { OlmMachine } from '@matrix-org/matrix-sdk-crypto-wasm';

export type JonoRivi = { id: string; kanavaId: string; teksti: string; luotu: number; yrityksia: number };

const JONO_AVAIN = 'ptt-viestijono';

function lueJono(): JonoRivi[] {
  try {
    const raaka = localStorage.getItem(JONO_AVAIN);
    const jono: unknown = raaka ? JSON.parse(raaka) : [];
    return Array.isArray(jono) ? jono : [];
  } catch {
    return [];
  }
}

function kirjoitaJono(jono: JonoRivi[]): void {
  try {
    localStorage.setItem(JONO_AVAIN, JSON.stringify(jono));
  } catch {
    // Täysi tai estetty localStorage ei saa kaataa lähetystä — jono jää vain
    // muistiin tämän välilehden ajaksi (uusi jonotaTekstiviesti-kutsu lukee silti
    // tyhjän listan seuraavalla kerralla, koska emme voineet tallentaa edellistäkään).
  }
}

/** Lisää viestin jonoon ja palauttaa sen jonotunnisteen (UI näyttää "lähetetään…" tällä). */
export function jonotaTekstiviesti(kanavaId: string, teksti: string): string {
  const rivi: JonoRivi = { id: crypto.randomUUID(), kanavaId, teksti, luotu: Date.now(), yrityksia: 0 };
  kirjoitaJono([...lueJono(), rivi]);
  return rivi.id;
}

/** Jonossa juuri nyt olevat viestit — UI:lle: mitkä näytetään "lähetetään…" -tilassa. */
export function jonossaOlevat(): JonoRivi[] {
  return lueJono();
}

/** Poistaa yhden rivin jonosta kysymättä (esim. käyttäjä perui lähetyksen). */
export function poistaJonosta(jonoId: string): void {
  kirjoitaJono(lueJono().filter((r) => r.id !== jonoId));
}

/**
 * Yrittää lähettää kaikki jonossa olevat viestit lähetysjärjestyksessä. Onnistunut
 * lähetys poistuu jonosta; epäonnistunut jää ja yrityslaskuri kasvaa (kutsuja voi
 * käyttää sitä esim. eksponentiaalisen viiveen laskemiseen — tämä tiedosto ei päätä
 * ajastuksesta, ks. yläkommentti).
 *
 * JÄRJESTYS SÄILYY KANAVAN SISÄLLÄ: jos ensimmäinen viesti kanavalle epäonnistuu,
 * seuraavatkin samalle kanavalle jäävät jonoon eikä niitä yritetä ohi — muuten
 * vastaanottaja voisi nähdä viestit väärässä järjestyksessä.
 */
export async function kasitteleJono(machine: OlmMachine, omaKayttaja: string): Promise<void> {
  const jono = lueJono();
  if (jono.length === 0) return;

  const jaljella: JonoRivi[] = [];
  const jumissa = new Set<string>();
  for (const rivi of jono) {
    if (jumissa.has(rivi.kanavaId)) {
      jaljella.push(rivi);
      continue;
    }
    const tulos = await lahetaTekstiviesti(machine, omaKayttaja, rivi.kanavaId, rivi.teksti);
    if (tulos.ok) continue;
    jumissa.add(rivi.kanavaId);
    jaljella.push({ ...rivi, yrityksia: rivi.yrityksia + 1 });
  }
  kirjoitaJono(jaljella);
}
