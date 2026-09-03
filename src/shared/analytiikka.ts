// Analytiikan selainpuoli (erä 9).
//
// Laskenta on palvelimella (server/analytiikka.js). Tämä moduuli hakee valmiit luvut ja
// muotoilee ne luettaviksi — mitään ei lasketa uudelleen täällä. Kaksi laskentaa samasta
// aineistosta tarkoittaisi ennen pitkää kahta eri lukua samasta asiasta, ja niistä
// väärää olisi mahdotonta tunnistaa oikeasta.

import { TYYPPI_LABEL } from './halytykset.ts';

export type Tunnusluvut = { n: number; mediaani: number; p90: number; min: number; max: number };
export type JakaumaRivi = { id: string | null; nimi: string; kpl: number };

export type Kooste = {
  ikkuna: { alku: string | null; loppu: string | null };
  laskettu: string;
  kirjaukset: {
    yhteensa: number;
    poikkeamia: number;
    ajattomia: number;
    tyypeittain: JakaumaRivi[];
    vyohykkeittain: JakaumaRivi[];
    vakavuuksittain: JakaumaRivi[];
    tiloittain: JakaumaRivi[];
    tunneittain: number[];
    paivittain: JakaumaRivi[];
    vilkkainTunti: { tunti: number; kpl: number } | null;
  };
  vasteajat: {
    sulkeminen: Tunnusluvut | null;
    avoimia: number;
    vanhinAvoinMs: number | null;
    virheellisia: number;
  };
  kierrokset: {
    ajoja: number; valmiit: number; keskeytetyt: number; kesken: number;
    pisteita: number; kuitattuja: number; kattavuus: number | null; kestot: Tunnusluvut | null;
  };
  halytykset: {
    yhteensa: number; tyypeittain: JakaumaRivi[]; avoimia: number; kuitattuja: number;
    perutut: number; eskaloituja: number; kuittausvaste: Tunnusluvut | null;
  };
};

export type Aikavali = { alku: string | null; loppu: string | null };

// Pikavalinnat. "Koko historia" on mukana tarkoituksella eikä oletuksena: pitkä jakso
// kertoo trendin, mutta vuoron aikana katsotaan sitä mitä juuri nyt tapahtuu.
export const JAKSOT: { id: string; nimi: string; tunteja: number | null }[] = [
  { id: '24h', nimi: '24 tuntia', tunteja: 24 },
  { id: '7vrk', nimi: '7 vuorokautta', tunteja: 24 * 7 },
  { id: '30vrk', nimi: '30 vuorokautta', tunteja: 24 * 30 },
  { id: 'kaikki', nimi: 'Koko historia', tunteja: null },
];

export const jakso = (id: string, nyt = new Date()): Aikavali => {
  const valinta = JAKSOT.find((j) => j.id === id);
  if (!valinta || valinta.tunteja === null) return { alku: null, loppu: null };
  return { alku: new Date(nyt.getTime() - valinta.tunteja * 3600_000).toISOString(), loppu: null };
};

// Päivävalitsimen arvo (YYYY-MM-DD) aikaväliksi. Loppupäivä on mukana kokonaan:
// käyttäjä joka valitsee 1.–3.9. tarkoittaa kolmatta päivää kokonaisuudessaan, ei sen
// alkuhetkeä. Ikkuna on palvelimella puoliavoin, joten loppuun lisätään vuorokausi.
export const paivistaAikavali = (alku: string, loppu: string): Aikavali => ({
  alku: alku ? new Date(`${alku}T00:00:00`).toISOString() : null,
  loppu: loppu ? new Date(new Date(`${loppu}T00:00:00`).getTime() + 86_400_000).toISOString() : null,
});

export async function haeKooste(ownerId: string, vali: Aikavali):
Promise<{ ok: boolean; error?: string; kooste?: Kooste; nimi?: string; onKohde?: boolean }> {
  const kysely = new URLSearchParams({ ownerId });
  if (vali.alku) kysely.set('alku', vali.alku);
  if (vali.loppu) kysely.set('loppu', vali.loppu);
  try {
    const vastaus = await fetch(`/api/analytiikka?${kysely.toString()}`, { credentials: 'include' });
    const data = await vastaus.json().catch(() => null);
    if (!vastaus.ok) return { ok: false, error: data?.error || `Palvelin vastasi virheellä ${vastaus.status}.` };
    return data || { ok: false, error: 'Palvelimen vastausta ei voitu lukea.' };
  } catch {
    return { ok: false, error: 'Ei yhteyttä palvelimeen.' };
  }
}

// --- Muotoilu ----------------------------------------------------------------------

// PUUTTUVA LUKU ON VIIVA EIKÄ NOLLA. Nolla vasteaika näyttäisi erinomaiselta tulokselta
// silloin kun mitattavaa ei ole ollut lainkaan, ja juuri sellaisia lukuja mittaristosta
// luetaan nopeasti ja ilman lähdekritiikkiä.
export const kesto = (ms: number | null | undefined) => {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const jaannosMin = min % 60;
  if (h < 24) return jaannosMin ? `${h} h ${jaannosMin} min` : `${h} h`;
  const vrk = Math.floor(h / 24);
  const jaannosH = h % 24;
  return jaannosH ? `${vrk} vrk ${jaannosH} h` : `${vrk} vrk`;
};

export const prosentti = (osuus: number | null | undefined) =>
  (osuus === null || osuus === undefined || !Number.isFinite(osuus) ? '—' : `${Math.round(osuus * 100)} %`);

export const luku = (arvo: number | null | undefined) =>
  (arvo === null || arvo === undefined || !Number.isFinite(arvo) ? '—' : String(arvo));

export const aikavaliTekstina = (ikkuna: { alku: string | null; loppu: string | null } | undefined) => {
  if (!ikkuna) return 'Koko historia';
  const muotoile = (iso: string) => new Date(iso).toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric', year: 'numeric' });
  if (!ikkuna.alku && !ikkuna.loppu) return 'Koko historia';
  if (ikkuna.alku && !ikkuna.loppu) return `${muotoile(ikkuna.alku)} alkaen`;
  if (!ikkuna.alku && ikkuna.loppu) return `${muotoile(ikkuna.loppu)} asti`;
  // Loppu on puoliavoin (seuraavan vuorokauden alku), joten näytetään edellinen päivä.
  const loppuNaytto = new Date(new Date(ikkuna.loppu as string).getTime() - 1);
  return `${muotoile(ikkuna.alku as string)} – ${loppuNaytto.toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric', year: 'numeric' })}`;
};

export const hetki = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fi-FI', {
    day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// Hälytystyyppien nimet tulevat halytykset.ts:stä eikä omasta listasta: palvelin
// palauttaa jakaumassa tunnisteen, ja kaksi nimilistaa samalle tunnisteelle eroaisi
// toisistaan heti kun uusi tyyppi lisätään — kuten erässä 8 kävikin.
export const HALYTYSTYYPPI: Record<string, string> = TYYPPI_LABEL;

export const KIRJAUKSEN_TILA: Record<string, string> = {
  open: 'Avoin',
  in_progress: 'Käsittelyssä',
  escalated: 'Eskaloitu',
  closed: 'Suljettu',
};

export const VAKAVUUS: Record<string, string> = {
  1: 'Vähäinen', 2: 'Lievä', 3: 'Kohtalainen', 4: 'Vakava', 5: 'Erittäin vakava',
};
