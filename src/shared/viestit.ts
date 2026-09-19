// PTT-kanavien tekstiviestien lähetys ja vastaanotto kryptoperustan päälle
// (erä 26, vaihe 3, viipaleet 3a—3c).
//
// Käyttää src/shared/olm.ts:ää salaukseen/purkuun — tämä tiedosto ei tee mitään
// kryptografiaa itse, vain yhdistää sen server/viestit.js:n ja server/kuittaukset.js:n
// reitteihin.
//
// JÄSENLISTA HAETAAN PALVELIMELTA (GET /api/kanavat/:id/jasenet, viipale 3b) — toimii
// kaikille neljälle kanavatyypille (kiinteä, hätä, DM, vapaa), koska palvelin laskee
// kiinteän kanavan jäsenet vuoroista ja hätäkanavan jäsenet guard_dispatch-oikeudesta
// juuri nyt, samalla säännöllä kuin muukin PTT-oikeustarkistus.
//
// LUOTETTAVA TOIMITUS (paikallinen uudelleenyritysjono) on omassa tiedostossaan
// (src/shared/viestijono.ts, viipale 3c) — tämä tiedosto tarjoaa vain yksittäisen
// lähetysyrityksen, jono päättää milloin sitä yritetään uudelleen.

import { paivitaKayttajanLaitteet, varmistaIstunnot, jaaHuoneenAvain, salaaViesti, puraViesti } from './olm.ts';
import type { OlmMachine } from '@matrix-org/matrix-sdk-crypto-wasm';

export type Kuittaus = { kayttaja: string; tyyppi: 'toimitus' | 'luku'; aika: string };
export type Viesti = { id: string; lahettaja: string; luotu: string; sisalto: unknown | null; kuittaukset: Kuittaus[] };

/** Kanavan kaikki nykyiset jäsenet, oma käyttäjä mukaan lukien (server/index.js: jasenetKanavalla). */
export async function haeKanavanJasenet(kanavaId: string): Promise<string[]> {
  const vastaus = await fetch(`/api/kanavat/${encodeURIComponent(kanavaId)}/jasenet`, {
    credentials: 'include',
  }).then((r) => r.json()).catch(() => ({ jasenet: [] }));
  return vastaus?.jasenet || [];
}

/**
 * Varmistaa että huoneavain on jaettu kanavan nykyisille jäsenille ja lähettää salatun
 * tekstiviestin.
 *
 * Jokainen lähetys hakee jäsenlistan tuoreena, päivittää jäsenten laitetiedot ja jakaa
 * huoneavaimen uudelleen — ei välimuistia. Tämä on oikeellisuutta ennen suorituskykyä:
 * jäsenyys on dynaaminen (vaihe 2, kohta 5), ja välimuistin oikea vanhenemisaika
 * vaatisi oman suunnittelunsa.
 */
export async function lahetaTekstiviesti(
  machine: OlmMachine, omaKayttaja: string, kanavaId: string, teksti: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const jasenet = (await haeKanavanJasenet(kanavaId)).filter((k) => k !== omaKayttaja);
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
  return { ok: true, id: vastaus.id };
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
  const rivit: Array<{ id: string; lahettaja: string; luotu: string; tapahtuma: unknown; kuittaukset: Kuittaus[] }> =
    vastaus?.viestit || [];

  const tulokset: Viesti[] = [];
  for (const rivi of rivit) {
    const sisalto = await puraViesti(machine, kanavaId, JSON.stringify(rivi.tapahtuma));
    tulokset.push({
      id: rivi.id, lahettaja: rivi.lahettaja, luotu: rivi.luotu, sisalto, kuittaukset: rivi.kuittaukset || [],
    });
  }
  return tulokset;
}

/**
 * Kuittaa viestin toimitetuksi tai (vain hätäkanavalla) luetuksi — epäsymmetrinen
 * käytäntö on palvelimen puolella (server/kuittaukset.js), tämä ei valikoi itse.
 * Oman viestin kuittausyritys palauttaa palvelimen 400-virheen sellaisenaan.
 */
export async function kuittaaViesti(
  viestiId: string, tyyppi: 'toimitus' | 'luku',
): Promise<{ ok: boolean; error?: string }> {
  const vastaus = await fetch(`/api/viestit/${encodeURIComponent(viestiId)}/kuittaa`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tyyppi }),
  }).then((r) => r.json()).catch(() => null);

  if (!vastaus?.ok) return { ok: false, error: vastaus?.error || 'Kuittaus epäonnistui.' };
  return { ok: true };
}
