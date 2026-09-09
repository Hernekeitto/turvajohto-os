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
};

export type LaiteTila = { sidottu: boolean; laite: Laite | null };

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
