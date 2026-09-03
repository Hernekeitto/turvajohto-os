// Avainhallinnan ja varustepoikkeamien selainpuoli (erä 8).
//
// Molemmat ovat rekistereitä: esineitä joilla on tila. Säännöt (avainta ei voi luovuttaa
// kahdelle, katoaminen vaatii syyn, poikkeamaa ei suljeta kahdesti) ovat palvelimella
// (server/avaimet.js, server/varusteet.js) — tämä moduuli kysyy ja näyttää.

export type AvaimenTila = 'hyllyssa' | 'ulkona' | 'kadonnut' | 'poistettu';

export type AvainHistoria = {
  ts: string;
  tapahtuma: string;
  user: string | null;
  haltija: string | null;
  teksti: string;
};

export type Avain = {
  id: string;
  ownerId: string;
  omistaja: 'kohde' | 'tapahtuma';
  tunnus: string;
  kuvaus: string;
  tila: AvaimenTila;
  haltija: string | null;
  otettu: string | null;
  kadonnut?: string | null;
  luotu: string;
  historia: AvainHistoria[];
};

export type PoikkeamanTila = 'avoin' | 'korjattu' | 'poistettu';

export type Poikkeama = {
  id: string;
  ownerId: string;
  omistaja: 'kohde' | 'tapahtuma';
  varuste: string;
  kuvaus: string;
  vakavuus: 'normaali' | 'kriittinen';
  tila: PoikkeamanTila;
  ilmoittaja: string;
  ilmoitettu: string;
  kasittelija: string | null;
  kasitelty: string | null;
  kasittelyHuomio: string;
  halytysId: string | null;
};

export const AVAIMEN_TILA: Record<AvaimenTila, string> = {
  hyllyssa: 'Hyllyssä',
  ulkona: 'Luovutettu',
  kadonnut: 'Kadonnut',
  poistettu: 'Poistettu käytöstä',
};

export const POIKKEAMAN_TILA: Record<PoikkeamanTila, string> = {
  avoin: 'Avoin',
  korjattu: 'Korjattu',
  poistettu: 'Poistettu käytöstä',
};

export const aikaleima = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fi-FI', {
    day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

type Vastaus = { ok: boolean; error?: string; avain?: Avain; poikkeama?: Poikkeama };

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
    return { ok: false, error: 'Ei yhteyttä palvelimeen. Muutosta ei tallennettu.' };
  }
}

export const luoAvain = (runko: { ownerId: string; tunnus: string; kuvaus: string }) =>
  kutsu('/api/avain', runko);

export const avaimenToiminto = (
  id: string,
  toiminto: 'luovuta' | 'palauta' | 'kadonnut' | 'loytyi' | 'poista',
  runko?: { haltija?: string; huomio?: string; syy?: string }
) => kutsu(`/api/avain/${encodeURIComponent(id)}/${toiminto}`, runko);

export const ilmoitaPoikkeama = (runko: {
  ownerId: string; varuste: string; kuvaus: string; vakavuus: 'normaali' | 'kriittinen';
}) => kutsu('/api/varuste', runko);

export const kasittelePoikkeama = (id: string, runko: { tila: 'korjattu' | 'poistettu'; huomio?: string }) =>
  kutsu(`/api/varuste/${encodeURIComponent(id)}/kasittele`, runko);

async function hae<T>(polku: string): Promise<T[] | null> {
  try {
    const vastaus = await fetch(polku, { credentials: 'include' });
    if (!vastaus.ok) return null;
    const data = await vastaus.json();
    return data?.ok === true && Array.isArray(data.data) ? (data.data as T[]) : null;
  } catch {
    return null;
  }
}

export const haeAvaimet = () => hae<Avain>('/api/data/keys');
export const haePoikkeamat = () => hae<Poikkeama>('/api/data/equipmentIssues');
