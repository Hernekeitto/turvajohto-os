// Laitesidonnan selainpuoli: tyypit ja kutsut.
//
// Säännöt ovat palvelimella (server/laite.js). Tämä tiedosto ei päätä mistään — se pyytää
// koodin, avaa sovelluksen ja kysyy tilan. Itse sidonta tapahtuu sovelluksessa, eikä
// selain näe siitä mitään muuta kuin lopputuloksen palvelimen kautta.

export type Laite = {
  id: string;
  kayttaja?: string;
  malli: string;
  sidottu: string;
  // Valvonnan tila. Nämä EIVÄT kerro sidonnasta vaan siitä puhuuko laite juuri nyt —
  // sidottu puhelin voi olla viikon hiljaa, ja täsmälleen niin kävi 10.9.2026. Palvelin
  // päättelee ne sovelluksen sydämenlyönnistä (server/laite.js).
  viimeinenLyonti?: string | null;
  valvontaElossa?: boolean;
};

export type LaiteTila = { sidottu: boolean; laite: Laite | null };

// --- Väistääkö selain natiivisovellusta (erä 12) --------------------------------------

// Kuinka tuore laitteen viimeisin sydämenlyönti on oltava, jotta selain katsoo
// natiivisovelluksen valvovan JUURI NYT.
//
// Kolme minuuttia on kolme väliin jäänyttä lyöntiä (sovellus lyö minuutin välein).
// Tarkoituksella paljon tiukempi kuin palvelimen valvontaElossa, joka sallii 35
// minuuttia: se vastaa kysymykseen "onko tämä laite hengissä", tämä kysymykseen "onko
// sen valvonta päällä tällä sekunnilla". Jos käyttäisimme 35 minuutin rajaa, puoli
// tuntia sitten kuollut sovellus pitäisi selaimen yhä sivussa — eikä kukaan valvoisi.
//
// VIRHEEN SUUNTA ON VALITTU: epävarmassa tilanteessa molemmat valvovat. Kaksi kyselyä
// samasta liikkumattomuudesta on kiusallista mutta vaaratonta — palvelin palauttaa
// saman hälytyksen eikä luo toista (server/e2e-halytys.mjs) — mutta nolla kyselyä ei
// ole kumpaakaan.
export const NATIIVI_TUORE_MS = 3 * 60 * 1000;

/**
 * Valvooko käyttäjän natiivisovellus juuri nyt.
 *
 * Palvelimen muistissa oleva lyöntihetki on tarkka, mutta se katoaa palvelimen
 * uudelleenkäynnistyksessä — silloin levyllä oleva arvo on korkeintaan viisi minuuttia
 * jäljessä (LYONTI_TALLENNUSVALI_MS). Tämä vastaa hetken aikaa "ei valvo" vaikka valvoo,
 * ja se on oikea suunta: selain ottaa valvonnan itselleen turhaan sen sijaan että
 * jättäisi sen tekemättä.
 */
export function natiiviValvoo(tila: LaiteTila | null, nyt = Date.now()): boolean {
  if (!tila?.sidottu || !tila.laite?.viimeinenLyonti) return false;
  const hetki = Date.parse(tila.laite.viimeinenLyonti);
  if (!Number.isFinite(hetki)) return false;
  return nyt - hetki < NATIIVI_TUORE_MS;
}

// Oman tunnuksen sidontatilanne.
export async function haeOmaTila(): Promise<LaiteTila> {
  const vastaus = await fetch('/api/laite/tila', { credentials: 'include' });
  if (!vastaus.ok) return { sidottu: false, laite: null };
  const data = await vastaus.json();
  return { sidottu: !!data?.sidottu, laite: data?.laite || null };
}

// Kertakäyttöinen sidontakoodi. Palvelin kieltäytyy jos tunnuksella on jo laite —
// virheteksti kerrotaan käyttäjälle sellaisenaan, koska se sisältää ohjeen (nollaus).
export async function pyydaKoodi(): Promise<{ ok: true; koodi: string } | { ok: false; virhe: string }> {
  const vastaus = await fetch('/api/laite/sido', { method: 'POST', credentials: 'include' });
  const data = await vastaus.json().catch(() => null);
  if (!vastaus.ok || !data?.ok) {
    return { ok: false, virhe: data?.error || 'Sidontakoodin pyytäminen ei onnistunut.' };
  }
  return { ok: true, koodi: data.koodi };
}

// Koodin luovutus sovellukselle.
//
// KOODI KULKEE TUNNISTEOSASSA (#) eikä kyselymerkkijonossa. Ero on olennainen: kysely
// päätyy palvelinlokeihin ja selaimen historiaan, tunnisteosa ei lähde verkkoon lainkaan.
// Koodi on viiden minuutin ajan pääsy tunnukseen, joten sitä kohdellaan salaisuutena
// vaikka se on lyhytikäinen.
export function avaaSovellus(koodi: string) {
  window.location.href = `turvajohto-guard://sido#koodi=${encodeURIComponent(koodi)}`;
}

// Kaikki sidotut laitteet (pääkäyttäjä tai hälytyskeskus). 403 ei ole virhe vaan
// odotettu lopputulos muille — kutsuja päättää mitä silloin näytetään.
export async function haeLaitteet(): Promise<{ ok: boolean; laitteet: Laite[] }> {
  const vastaus = await fetch('/api/laitteet', { credentials: 'include' });
  if (!vastaus.ok) return { ok: false, laitteet: [] };
  const data = await vastaus.json();
  return { ok: !!data?.ok, laitteet: data?.laitteet || [] };
}

export async function nollaaSidonta(id: string): Promise<{ ok: boolean; virhe?: string }> {
  const vastaus = await fetch(`/api/laite/${encodeURIComponent(id)}/nollaa`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await vastaus.json().catch(() => null);
  if (!vastaus.ok || !data?.ok) return { ok: false, virhe: data?.error || 'Nollaus ei onnistunut.' };
  return { ok: true };
}
