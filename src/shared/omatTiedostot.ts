// Henkilökohtainen tallennustila, selaimen puoli (29.9.2026). Säännöt ja kiintiöt ovat
// palvelimella (server/omattiedostot.js); tämä moduuli on kutsut ja muotoilu.

export type OmaKohde = {
  id: string;
  omistaja: string;
  type: 'folder' | 'file';
  name: string;
  parentId: string | null;
  uploadId?: string;
  size?: number;
  createdAt: string;
  muokattu?: string;
};

export type TallennustilanTila = {
  kaytetty: number;
  // null = ei rajaa (pääkäyttäjä).
  raja: number | null;
  puskuri: number;
  ylitys: boolean;
};

export type LisatilaPyynto = {
  id: string;
  username: string;
  nimimerkki: string;
  perustelu: string;
  pyydettyMt: number;
  tila: 'odottaa' | 'hyvaksytty' | 'hylatty';
  luotu: string;
  kasittelija: string | null;
  kasitelty: string | null;
  myonnettyMt: number;
  paatoksenSyy?: string;
  kuitattu: boolean;
};

export const LISATILAN_VAIHTOEHDOT = [500, 1024, 2048, 5120];

export const muotoileMt = (mt: number) =>
  (mt >= 1024 ? `${Math.round((mt / 1024) * 10) / 10} Gt` : `${mt} Mt`);

export function muotoileKoko(tavut: number | null | undefined): string {
  const t = Number(tavut) || 0;
  if (t >= 1024 ** 3) return `${(t / 1024 ** 3).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} Gt`;
  if (t >= 1024 ** 2) return `${(t / 1024 ** 2).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} Mt`;
  if (t >= 1024) return `${Math.round(t / 1024)} kt`;
  return `${t} t`;
}

type Vastaus<T> = { ok: true } & T | { ok: false; error: string; taynna?: boolean };

async function kutsu<T>(polku: string, init?: RequestInit): Promise<Vastaus<T>> {
  try {
    const r = await fetch(polku, { credentials: 'include', ...init });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.ok) return { ok: false, error: data?.error || `Palvelin vastasi virheellä ${r.status}.`, taynna: data?.taynna };
    return data;
  } catch {
    return { ok: false, error: 'Ei yhteyttä palvelimeen.' };
  }
}

const json = (metodi: string, runko?: unknown): RequestInit => ({
  method: metodi,
  headers: { 'Content-Type': 'application/json' },
  body: runko === undefined ? undefined : JSON.stringify(runko),
});

export const haeOmat = () =>
  kutsu<{ tiedostot: OmaKohde[]; tila: TallennustilanTila; pyynnot: LisatilaPyynto[] }>('/api/omat');

export const luoKansio = (nimi: string, parentId: string | null) =>
  kutsu<{ kohde: OmaKohde }>('/api/omat/kansio', json('POST', { nimi, parentId }));

export function lataaTiedosto(tiedosto: File, parentId: string | null) {
  const lomake = new FormData();
  if (parentId) lomake.append('parentId', parentId);
  lomake.append('file', tiedosto);
  return kutsu<{ kohde: OmaKohde; uploadId: string; ylitys: boolean; tila: TallennustilanTila }>(
    '/api/omat/tiedosto', { method: 'POST', body: lomake }
  );
}

export const nimeaUudelleen = (id: string, nimi: string) =>
  kutsu<{ kohde: OmaKohde }>(`/api/omat/${encodeURIComponent(id)}`, json('PUT', { nimi }));

export const poistaOma = (id: string) =>
  kutsu<{ poistettu: number }>(`/api/omat/${encodeURIComponent(id)}`, json('DELETE'));

export const pyydaLisatilaa = (perustelu: string, maaraMt: number) =>
  kutsu<{ pyynto: LisatilaPyynto }>('/api/omat/lisatila', json('POST', { perustelu, maaraMt }));

export const kuittaaPaatos = (id: string) =>
  kutsu<Record<string, never>>(`/api/omat/lisatila/${encodeURIComponent(id)}/kuittaa`, json('POST', {}));

// Kansion koko alipuun tiedostot (kansion koko listalla).
export function kansionKoko(kohteet: OmaKohde[], kansioId: string): number {
  let summa = 0;
  const jono = [kansioId];
  const nahdyt = new Set<string>();
  while (jono.length) {
    const id = jono.pop() as string;
    if (nahdyt.has(id)) continue;
    nahdyt.add(id);
    for (const k of kohteet) {
      if (k.parentId !== id) continue;
      if (k.type === 'folder') jono.push(k.id);
      else summa += Number(k.size) || 0;
    }
  }
  return summa;
}

// Murupolku juuresta kansioon.
export function murupolku(kohteet: OmaKohde[], kansioId: string | null): OmaKohde[] {
  const polku: OmaKohde[] = [];
  let id = kansioId;
  const nahdyt = new Set<string>();
  while (id && !nahdyt.has(id)) {
    nahdyt.add(id);
    const kansio = kohteet.find((k) => k.id === id);
    if (!kansio) break;
    polku.unshift(kansio);
    id = kansio.parentId;
  }
  return polku;
}
