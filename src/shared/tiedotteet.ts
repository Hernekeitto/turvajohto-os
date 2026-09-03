// Tiedotteiden selainpuoli (erä 8).
//
// Tiedote on sovelluksen sisäinen viesti kentälle, jonka lukeminen kuitataan. Eri asia
// kuin pikatoimintojen hätäviesti: tekstiviesti tavoittaa myös sammuneen sovelluksen
// muttei kerro kuka sen luki, tiedote kertoo. Kumpikaan ei korvaa toista.

export type Kuittaus = { user: string; ts: string };

export type Tiedote = {
  id: string;
  ownerId: string;
  omistaja: 'kohde' | 'tapahtuma';
  otsikko: string;
  viesti: string;
  laatija: string;
  luotu: string;
  vanhenee: string;
  voimassaTuntia: number;
  kuittaukset: Kuittaus[];
  peruttu: string | null;
};

export const VOIMASSA_VALINNAT = [2, 4, 8, 12, 24];

// Sama sääntö kuin palvelimella (server/broadcast.js: onVoimassa). Kahdessa paikassa,
// koska selaimen on osattava piilottaa vanhentunut kuittauspyyntö kysymättä palvelimelta —
// mutta palvelin on se joka päättää mitä kuittaus tarkoittaa.
export const onVoimassa = (t: Tiedote, nyt = Date.now()) => {
  if (!t || t.peruttu) return false;
  const vanhenee = Date.parse(t.vanhenee);
  return !Number.isFinite(vanhenee) || vanhenee > nyt;
};

export const onKuitannut = (t: Tiedote, username: string) =>
  (t.kuittaukset || []).some((k) => k.user === username);

export const aikaleima = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fi-FI', {
    day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

type Vastaus = {
  ok: boolean;
  error?: string;
  tiedote?: Tiedote;
  vastaanottajia?: number;
  duplikaatti?: boolean;
};

async function kutsu(polku: string, runko?: unknown): Promise<Vastaus> {
  try {
    const vastaus = await fetch(polku, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runko ?? {}),
    });
    const data = await vastaus.json().catch(() => null);
    if (!vastaus.ok) {
      return { ok: false, error: data?.error || `Palvelin vastasi virheellä ${vastaus.status}.` };
    }
    return data || { ok: false, error: 'Palvelimen vastausta ei voitu lukea.' };
  } catch {
    return { ok: false, error: 'Ei yhteyttä palvelimeen. Tiedotetta ei lähetetty.' };
  }
}

export const lahetaTiedote = (runko: {
  ownerId: string; otsikko: string; viesti: string; voimassaTuntia: number;
}) => kutsu('/api/tiedote', runko);

export const kuittaaTiedote = (id: string) => kutsu(`/api/tiedote/${encodeURIComponent(id)}/kuittaa`);

export const peruTiedote = (id: string) => kutsu(`/api/tiedote/${encodeURIComponent(id)}/peru`);

export async function haeKuittaamatta(id: string): Promise<{
  vastaanottajia: number; kuittaamatta: { username: string; nimi: string }[];
} | null> {
  try {
    const vastaus = await fetch(`/api/tiedote/${encodeURIComponent(id)}/kuittaamatta`, { credentials: 'include' });
    if (!vastaus.ok) return null;
    const data = await vastaus.json();
    return data?.ok === true ? data : null;
  } catch {
    return null;
  }
}

export async function haeTiedotteet(): Promise<Tiedote[] | null> {
  try {
    const vastaus = await fetch('/api/data/broadcasts', { credentials: 'include' });
    if (!vastaus.ok) return null;
    const data = await vastaus.json();
    return data?.ok === true && Array.isArray(data.data) ? (data.data as Tiedote[]) : null;
  } catch {
    return null;
  }
}
