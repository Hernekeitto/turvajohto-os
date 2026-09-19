// PTT-kanavien tekstiviestien lähetys ja vastaanotto kryptoperustan päälle
// (erä 26, vaihe 3, viipale 3a).
//
// Käyttää src/shared/olm.ts:ää salaukseen/purkuun — tämä tiedosto ei tee mitään
// kryptografiaa itse, vain yhdistää sen server/viestit.js:n reitteihin.
//
// JÄSENLISTA ON KUTSUJAN VASTUULLA: tämä tiedosto ei tiedä miten kanavan jäsenet
// selvitetään. DM/vapaa: `GET /api/kanavat/omat` palauttaa `osallistujat`-kentän
// suoraan. KIINTEÄ (kohde/piiri) JA HÄTÄKANAVA: ei vielä ratkaistu — niiden jäsenyys
// on dynaaminen eikä mitään reittiä ole vielä joka palauttaisi "ketkä ovat juuri nyt
// tällä kanavalla" muille kuin kutsujalle itselleen. Tämä on tarkoituksellinen rajaus,
// ei unohdus (ks. Obsidian: "vaihe 3 -suunnitelma" ja tämän erän commit-viesti) — vain
// DM ja vapaa on todennettavissa tällä viipaleella.
//
// LUOTETTAVA TOIMITUS (uudelleenyritys kunnes palvelin kuittaa) ja TOIMITUS-/
// LUKUKUITTAUKSET (vaihe 3, kohdat 4-5) EIVÄT OLE MUKANA — oma viipaleensa (3b).

import { paivitaKayttajanLaitteet, varmistaIstunnot, jaaHuoneenAvain, salaaViesti, puraViesti } from './olm.ts';
import type { OlmMachine } from '@matrix-org/matrix-sdk-crypto-wasm';

export type Viesti = { id: string; lahettaja: string; luotu: string; sisalto: unknown | null };

/**
 * Varmistaa että huoneavain on jaettu kanavan nykyisille jäsenille ja lähettää salatun
 * tekstiviestin. `jasenet` EI sisällä omaa käyttäjää — vain muut osapuolet.
 *
 * Jokainen lähetys päivittää jäsenten laitetiedot ja jakaa huoneavaimen uudelleen —
 * ei välimuistia. Tämä on oikeellisuutta ennen suorituskykyä: jäsenyys on dynaaminen
 * (vaihe 2, kohta 5), ja välimuistin oikea vanhenemisaika vaatisi oman suunnittelunsa.
 */
export async function lahetaTekstiviesti(
  machine: OlmMachine, omaKayttaja: string, kanavaId: string, jasenet: string[], teksti: string,
): Promise<{ ok: boolean; error?: string }> {
  for (const kayttaja of jasenet) {
    await paivitaKayttajanLaitteet(machine, kayttaja);
  }
  await varmistaIstunnot(machine, jasenet);
  await jaaHuoneenAvain(machine, kanavaId, jasenet);

  const tapahtuma = await salaaViesti(machine, omaKayttaja, kanavaId, 'm.room.message', {
    msgtype: 'm.text', body: teksti,
  });
  const vastaus = await fetch('/api/viestit', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kanavaId, tapahtuma: JSON.parse(tapahtuma) }),
  }).then((r) => r.json()).catch(() => null);

  if (!vastaus?.ok) return { ok: false, error: vastaus?.error || 'Viestin lähetys epäonnistui.' };
  return { ok: true };
}

/**
 * Hakee kanavan viestit ja purkaa ne. Purkamaton viesti (esim. huoneavain ei ole vielä
 * saapunut to-device-relenssin kautta) näkyy `sisalto: null` — kutsuja päättää miten
 * se näytetään, tämä ei ole virhe joka kaataisi hakua.
 */
export async function haeJaPuraViestit(machine: OlmMachine, kanavaId: string): Promise<Viesti[]> {
  const vastaus = await fetch(`/api/viestit?kanavaId=${encodeURIComponent(kanavaId)}`, {
    credentials: 'include',
  }).then((r) => r.json()).catch(() => ({ viestit: [] }));
  const rivit: Array<{ id: string; lahettaja: string; luotu: string; tapahtuma: unknown }> = vastaus?.viestit || [];

  const tulokset: Viesti[] = [];
  for (const rivi of rivit) {
    const sisalto = await puraViesti(machine, kanavaId, JSON.stringify(rivi.tapahtuma));
    tulokset.push({ id: rivi.id, lahettaja: rivi.lahettaja, luotu: rivi.luotu, sisalto });
  }
  return tulokset;
}
