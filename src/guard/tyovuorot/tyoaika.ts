// Työaikasäännöt (erä 1): palvelimen vastauksen muoto ja haku.
//
// Säännöt, oletukset ja tarkistukset ovat palvelimella (server/tyovuorolista.js). Selain
// ei toista niitä: kuvaukset, TES-arvot ja rajat tulevat vastauksen `kuvaukset`-oliossa,
// joten lomake ja palvelin eivät voi erkaantua toisistaan.

export type AsetuksenKuvaus = {
  nimi: string;
  yksikko: string | null;
  // TES:n arvo. null = asetus ei ole TES:n sääntö (korttivaroitus).
  tes: number | boolean | null;
  oletus?: number;
  pykala?: string;
  min?: number;
  max?: number;
  sallitut?: number[];
  totuusarvo?: boolean;
  eiPoikkeama?: boolean;
};

export type Asetukset = Record<string, number | boolean | string | null> & {
  jaksotAlkaen: string | null;
  paikallinenSopimus: string;
};

export type Jakso = { numero: number; alku: string; loppu: string; viimeinen: string };

export type Lista = {
  alku: string;
  loppu: string;
  viimeinen: string;
  jaksot: Jakso[];
  julkaistavaViimeistaan: string;
  // Kohteiden miehityksestä syntyvät vuorot (erä 2): vartijapaikkojen määrä ja tunnit.
  vuoroja: number;
  tunteja: number;
};

export type TyoaikaVastaus = {
  ok: true;
  asetukset: Asetukset;
  poikkeamat: string[];
  kuvaukset: Record<string, AsetuksenKuvaus>;
  jaksonPituusVk: number;
  saannollinenH: number;
  jaksonEnimmaisH: number;
  listat: Lista[];
  // Miehitykset jotka eivät täytä voimassa olevia sääntöjä (erä 3).
  miehitysVaroitukset: { siteId: string; siteNimi: string; viesti: string }[];
  tanaan: string;
  muokattu: string | null;
  muokkasi: string | null;
};

// Suunniteltava henkilö: kapea ote työntekijäpankista (server/index.js: /api/tyovuorot/henkilot).
export type Henkilo = {
  username: string;
  nimi: string;
  kytketty: boolean;
  workTimeType: string | null;
  minHoursPer3Weeks: string | null;
  hasGuardCard: boolean | null;
  guardCardValidUntil: string | null;
  employmentStart: string | null;
  employmentType: string | null;
  employmentFixedTo: string | null;
  korttiAsti: string | null;
};

export const TYOAIKAMUOTO: Record<string, string> = {
  monthly: 'Kuukausipalkka, 120 h / 3 vk',
  parttime: 'Osa-aikainen',
  oncall: 'Työvoimareservi',
};

export async function haeHenkilot(): Promise<Henkilo[]> {
  const r = await fetch('/api/tyovuorot/henkilot', { credentials: 'include' });
  const vastaus = await r.json().catch(() => null);
  if (!vastaus?.ok) throw new Error(vastaus?.error || 'Henkilöiden lukeminen ei onnistunut.');
  return vastaus.henkilot;
}

export async function haeTyoaika(): Promise<TyoaikaVastaus> {
  const r = await fetch('/api/tyovuorot/asetukset', { credentials: 'include' });
  const vastaus = await r.json().catch(() => null);
  if (!vastaus?.ok) throw new Error(vastaus?.error || 'Työaikasääntöjen lukeminen ei onnistunut.');
  return vastaus;
}

// '2026-10-05' -> '5.10.2026'. Päivä tulkitaan merkkijonona eikä Date-oliona, jotta
// aikavyöhyke ei siirrä sitä edelliselle päivälle.
export function pvm(iso: string | null): string {
  const osuma = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return osuma ? `${Number(osuma[3])}.${Number(osuma[2])}.${osuma[1]}` : '–';
}

// Arvo ihmisluettavana yksikköineen: "10 h", "9 kpl", "kyllä".
export function arvoTekstina(kuvaus: AsetuksenKuvaus, arvo: unknown): string {
  if (kuvaus.totuusarvo) return arvo ? 'kyllä' : 'ei';
  const luku = typeof arvo === 'number' ? String(arvo).replace('.', ',') : '–';
  return kuvaus.yksikko ? `${luku} ${kuvaus.yksikko}` : luku;
}

// Päivien määrä tänään -> päivä. Negatiivinen = mennyt.
export function paiviaPaivaan(tanaan: string, iso: string): number {
  const a = Date.parse(`${tanaan}T00:00:00Z`);
  const b = Date.parse(`${iso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

// --- Työvuorolista (erä 4) ------------------------------------------------------------

export type Taso = 'este' | 'poikkeama' | 'varoitus' | 'huomio';

export type Havainto = { taso: Taso; koodi: string; viesti: string; vuoroIdt: string[] };

export type SuunniteltuVuoro = {
  id: string;
  siteId: string;
  siteNimi: string;
  vuorotyyppiId: string;
  vuoroNimi: string;
  pvm: string;
  paikka: number;
  alkaa: string;
  paattyy: string;
  kestoMin: number;
};

export type Sijoitus = {
  vuoroId: string;
  username: string;
  syy?: string;
  poikkeamat?: string[];
  sijoitti?: string;
  sijoitettu?: string;
};

export type HenkilonTarkistus = {
  havainnot: Havainto[];
  jaksot: { alku: string; viimeinen: string; tunnit: number; vuoroIdt: string[] }[];
};

export type ListaNakyma = {
  ok: true;
  lista: Lista;
  versio: number;
  muokattu: string | null;
  muokkasi: string | null;
  vuorot: SuunniteltuVuoro[];
  sijoitukset: Sijoitus[];
  orvot: Sijoitus[];
  henkilot: Henkilo[];
  tulokset: Record<string, HenkilonTarkistus>;
  perehdytetyt: Record<string, string[]>;
  saaMuokata: boolean;
};

export async function haeLista(alku: string): Promise<ListaNakyma> {
  const r = await fetch(`/api/tyovuorot/lista/${encodeURIComponent(alku)}`, { credentials: 'include' });
  const vastaus = await r.json().catch(() => null);
  if (!vastaus?.ok) throw new Error(vastaus?.error || 'Listan lukeminen ei onnistunut.');
  return vastaus;
}

export type SijoitusVastaus =
  | ListaNakyma
  | ({ ok: false; koodi?: string; error: string; havainnot?: Havainto[] } & Omit<Partial<ListaNakyma>, 'ok'>);

export async function tallennaSijoitus(
  alku: string, body: { vuoroId: string; username: string | null; syy?: string; versio: number },
): Promise<SijoitusVastaus> {
  try {
    const r = await fetch(`/api/tyovuorot/lista/${encodeURIComponent(alku)}/sijoitus`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const vastaus = await r.json().catch(() => null);
    return vastaus || { ok: false, error: `Tallennus ei onnistunut (virhe ${r.status}).` };
  } catch {
    return { ok: false, error: 'Tallennus ei onnistunut: ei yhteyttä palvelimeen.' };
  }
}

export const TASOJARJESTYS: Taso[] = ['este', 'poikkeama', 'varoitus', 'huomio'];
