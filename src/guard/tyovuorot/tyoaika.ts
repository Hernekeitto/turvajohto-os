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
  // Erä 6.
  sijoitettuja: number;
  julkaistu: Julkaisu | null;
  vaihtojaOdottaa: number;
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
  jaksot: {
    alku: string; viimeinen: string; tunnit: number; vuorotunnit: number; poissaolotunnit: number; vuoroIdt: string[];
  }[];
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
  toiveet: Toive[];
  poissaolot: Poissaolo[];
  poissaololajit: Record<string, string>;
  julkaistu: Julkaisu | null;
  muutokset: Muutos[];
  vaihdot: Vaihto[];
  vaihdonTilat: Record<string, string>;
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
  alku: string, body: { vuoroId: string; username: string | null; syy?: string; muutossyy?: string; versio: number },
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

// --- Toiveet, poissaolot ja reservi (erä 5) ----------------------------------------------

export type Toive = { username: string; pvm: string; laji: 'vapaa' | 'vuoro' | 'este'; huom?: string };

export type Poissaolo = {
  id: string;
  username: string;
  laji: string;
  alku: string;
  loppu: string;
  tunnit: number;
  huom?: string;
  kirjasi?: string;
};

export type OmaLista = { alku: string; loppu: string; viimeinen: string; julkaistavaViimeistaan: string; lukittu: boolean };

export type AvoinVuoro = {
  id: string; siteNimi: string; vuoroNimi: string; pvm: string; alkaa: string; paattyy: string; kestoMin: number;
};

export type OmatNakyma =
  | { ok: true; suunniteltava: false }
  | {
    ok: true;
    suunniteltava: true;
    reservi: boolean;
    nimi: string;
    tanaan: string;
    listat: OmaLista[];
    toiveet: Toive[];
    poissaolot: Poissaolo[];
    toivelajit: Record<string, string>;
    poissaololajit: Record<string, string>;
    avoimet: AvoinVuoro[];
    omatVuorot: OmaVuoro[];
    muutokset: OmaMuutos[];
    vaihdot: OmaVaihto[];
    vaihdonTilat: Record<string, string>;
  };

async function jsonPyynto<T>(url: string, init?: RequestInit): Promise<T | { ok: false; error: string; havainnot?: Havainto[] }> {
  try {
    const r = await fetch(url, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
    const vastaus = await r.json().catch(() => null);
    return vastaus || { ok: false, error: `Pyyntö ei onnistunut (virhe ${r.status}).` };
  } catch {
    return { ok: false, error: 'Ei yhteyttä palvelimeen.' };
  }
}

export const haeOmat = () => jsonPyynto<OmatNakyma>('/api/tyovuorot/omat');

export const asetaOmaToive = (pvm: string, laji: string | null, huom?: string) =>
  jsonPyynto<OmatNakyma>('/api/tyovuorot/omat/toive', { method: 'PUT', body: JSON.stringify({ pvm, laji, huom }) });

export const kuittaaVuoro = (vuoroId: string) =>
  jsonPyynto<OmatNakyma>('/api/tyovuorot/omat/kuittaa', { method: 'POST', body: JSON.stringify({ vuoroId }) });

export const kirjaaPoissaolo = (p: { username: string; laji: string; alku: string; loppu: string; tunnit?: number | null; huom?: string }) =>
  jsonPyynto<{ ok: true; poissaolo: Poissaolo }>('/api/tyovuorot/poissaolot', { method: 'POST', body: JSON.stringify(p) });

export const poistaPoissaolo = (id: string) =>
  jsonPyynto<{ ok: true }>(`/api/tyovuorot/poissaolot/${encodeURIComponent(id)}`, { method: 'DELETE' });

// --- Julkaisu, muutokset ja vaihdot (erä 6) --------------------------------------------------

export type Julkaisu = { aika: string; julkaisija: string; myohassa: boolean; avoimia: number };

export type Muutos = {
  aika: string; tekija: string; vuoroId: string; oli: string | null; nyt: string | null; syy: string; halytystyo?: boolean;
};

export type Vaihto = {
  id: string; vuoroId: string; listanAlku: string; alkaa: string; antaja: string; saaja: string;
  viesti?: string; tila: string; historia: { aika: string; kuka: string; mita: string; viesti?: string }[];
};

type Vuorokuvaus = { siteNimi?: string; vuoroNimi?: string; pvm: string; alkaa?: string; paattyy?: string };

export type OmaVuoro = Vuorokuvaus & { vuoroId: string; listanAlku: string };
export type OmaMuutos = Vuorokuvaus & { aika: string; vuoroId: string; syy: string; suunta: 'sait' | 'poistettiin' };
export type OmaVaihto = Vuorokuvaus & {
  id: string; vuoroId: string; tila: string; viesti: string | null; rooli: 'antaja' | 'saaja'; toinen: string;
};

export const julkaiseLista = (alku: string, versio: number) =>
  jsonPyynto<ListaNakyma>(`/api/tyovuorot/lista/${encodeURIComponent(alku)}/julkaise`, { method: 'POST', body: JSON.stringify({ versio }) });

export const ratkaiseVaihto = (id: string, body: { hyvaksy: boolean; syy?: string; perustelu?: string }) =>
  jsonPyynto<ListaNakyma>(`/api/tyovuorot/vaihdot/${encodeURIComponent(id)}/ratkaise`, { method: 'POST', body: JSON.stringify(body) });

export const kuittaaMuutokset = () =>
  jsonPyynto<OmatNakyma>('/api/tyovuorot/omat/kuittaa-muutokset', { method: 'POST', body: '{}' });

export const haeVaihtoehdokkaat = (vuoroId: string) =>
  jsonPyynto<{ ok: true; ehdokkaat: { username: string; nimi: string }[] }>(`/api/tyovuorot/vaihdot/ehdokkaat?vuoroId=${encodeURIComponent(vuoroId)}`);

export const pyydaVaihto = (vuoroId: string, saaja: string, viesti: string) =>
  jsonPyynto<OmatNakyma>('/api/tyovuorot/vaihdot', { method: 'POST', body: JSON.stringify({ vuoroId, saaja, viesti }) });

export const vastaaVaihtoon = (id: string, hyvaksy: boolean) =>
  jsonPyynto<OmatNakyma>(`/api/tyovuorot/vaihdot/${encodeURIComponent(id)}/vastaa`, { method: 'POST', body: JSON.stringify({ hyvaksy }) });

export const peruVaihto = (id: string) =>
  jsonPyynto<OmatNakyma>(`/api/tyovuorot/vaihdot/${encodeURIComponent(id)}/peru`, { method: 'POST', body: '{}' });

// --- Generaattori (erä 7) ------------------------------------------------------------------

export type Ehdotus = {
  ok: true;
  versio: number;
  ehdotus: { vuoroId: string; username: string; pisteet: number }[];
  avoimiksi: { vuoroId: string; syy: string }[];
  // Tarkka optimointi (11.10.2026): 'optimi' = todistetusti paras, 'aikaraja' = paras
  // aikarajassa löydetty, 'virhe' = optimointi epäonnistui ja tilalla on ahne täyttö.
  optimi?: { tila: string; sekuntia?: number; varalla?: string };
};

export type Taytto = 'optimi' | 'keskitetty' | 'tasainen';

// Optimointi käynnistyy taustatyönä (202) ja tulos haetaan erikseen.
export type OptimointiKesken = { ok: true; tyo: string; aikarajaS: number };
export type OptimoinninTila = { ok: true; kesken: true; sekuntia: number; aikarajaS: number };

export const laskeListanEhdotus = (alku: string, tapa: Taytto = 'tasainen') =>
  jsonPyynto<Ehdotus | OptimointiKesken>(`/api/tyovuorot/lista/${encodeURIComponent(alku)}/ehdotus`, { method: 'POST', body: JSON.stringify({ tapa }) });

export const haeOptimointi = (alku: string, tyo: string) =>
  jsonPyynto<Ehdotus | OptimoinninTila>(`/api/tyovuorot/lista/${encodeURIComponent(alku)}/ehdotus/${encodeURIComponent(tyo)}`);

export const hyvaksyEhdotus = (alku: string, ehdotus: { vuoroId: string; username: string }[], muutossyy?: string) =>
  jsonPyynto<ListaNakyma & { generaattori: { tehty: number; ohitetut: { vuoroId: string; username: string; syy: string }[] } }>(
    `/api/tyovuorot/lista/${encodeURIComponent(alku)}/ehdotus/hyvaksy`,
    { method: 'POST', body: JSON.stringify({ ehdotus, ...(muutossyy ? { muutossyy } : {}) }) },
  );
