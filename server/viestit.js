// PTT-kanavien tekstiviestit kryptoperustan päälle (erä 26, vaihe 3, viipale 3a).
//
// `tapahtuma` on aina asiakkaan jo Olm/Megolm-salaama tapahtumaolio
// (src/shared/olm.ts: salaaViesti) — tämä tiedosto EI TULKITSE eikä salaa mitään, se
// vain tallentaa ja tarjoilee sen läpinäkyvästi. Sama periaate kuin
// server/kryptoavaimet.js:ssä ja server/laiteviestit.js:ssä.
//
// PALVELIN VOI ENÄÄ VALVOA TAVUKOKOA, EI SISÄLTÖÄ (ks. Obsidian: "vaihe 3
// -suunnitelma", kohta 1) — salattua blobia ei voi tarkistaa tyypin tai sisällön
// mukaan, ainoa jäljellä oleva suoja on kokoraja.
//
// Säännöt ovat täällä, I/O ja Express kutsujassa — sama jako kuin muuallakin.

// 64 kt on reilusti enemmän kuin mikä tahansa tekstiviesti Olm/Megolm-kuoren kanssa
// tarvitsee — media kulkee omalla reitillään (vaihe 3, kohta 3, ei vielä rakennettu),
// joten tämän rajan tarkoitus on estää tämän reitin väärinkäyttö suurten blobien
// kuljetukseen ennen kuin oikea mediareitti on olemassa.
export const VIESTIN_ENIMMAISKOKO = 64 * 1024;

/**
 * Uusi viestitietue. `tapahtuma` on mikä tahansa JSON-yhteensopiva olio — kokoraja
 * lasketaan sen serialisoidusta koosta, koska se on ainoa asia mistä palvelin voi
 * enää olla varma.
 */
export function luoViesti({ id, kanavaId, lahettaja, tapahtuma, nyt = Date.now() }) {
  if (!tapahtuma || typeof tapahtuma !== 'object') {
    return { ok: false, error: 'Viestin sisältö puuttuu tai on virheellinen.' };
  }
  const koko = Buffer.byteLength(JSON.stringify(tapahtuma), 'utf8');
  if (koko > VIESTIN_ENIMMAISKOKO) {
    return { ok: false, error: 'Viesti on liian suuri.' };
  }
  return {
    ok: true,
    viesti: { id, kanavaId, lahettaja, tapahtuma, koko, luotu: new Date(nyt).toISOString() },
  };
}

/** Kanavan viestit lähetysjärjestyksessä (vanhin ensin). */
export function kanavanViestit(viestit, kanavaId) {
  return (viestit || []).filter((v) => v.kanavaId === kanavaId);
}
