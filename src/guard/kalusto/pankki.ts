// Kalustopankin selainpuoli: kutsut ja pienet apurit.
//
// Säännöt ovat palvelimella (server/kalusto.js). Tämä tiedosto ei päätä mistään — se
// lähettää ja lukee. Sama rakenne kuin shared/kalusto.ts:ssä, koska virheen näyttäminen
// ilman yhteyttä on sama ongelma molemmissa.

import type { KalustoTietue, Laji, SijoitusLaji } from './tyypit';

type Vastaus = {
  ok: boolean;
  error?: string;
  esine?: KalustoTietue;
  esineet?: KalustoTietue[];
};

async function kutsu(polku: string, runko?: unknown, metodi: 'POST' | 'PUT' = 'POST'): Promise<Vastaus> {
  try {
    const vastaus = await fetch(polku, {
      method: metodi,
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

// Yksi rivi eräkirjauksen taulukosta. Perustiedot omina kenttinään ja lajikohtaiset
// lisätiedot omassa oliossaan — sama muoto kuin yksittäisen esineen lomakkeella,
// jolloin palvelimella on yksi puhdistus (server/kalusto.js: puhdistaLisatiedot)
// eikä kahta. Tunnus ja holvipaikka tulevat palvelimelta.
export type EraRivi = {
  nimi: string;
  alalaji: string;
  sarjanumero: string;
  kuvaus: string;
  lisatiedot: Record<string, string | boolean>;
};

export const luoKalustoEra = (laji: Laji, rivit: EraRivi[]) =>
  kutsu('/api/kalusto/era', { laji, rivit });

export type UusiKalusto = {
  laji: Laji;
  alalaji: string;
  nimi: string;
  kuvaus: string;
  sarjanumero: string;
  lisatiedot: Record<string, string | boolean>;
  sijoitus: { laji: SijoitusLaji; id?: string | null; nimi?: string };
  kappaletta: number;
};

export const luoKalustoa = (runko: UusiKalusto) => kutsu('/api/kalusto', runko);

export const paivitaKalusto = (
  id: string,
  runko: {
    nimi: string; alalaji: string; kuvaus: string; sarjanumero: string;
    lisatiedot: Record<string, string | boolean>;
  }
) => kutsu(`/api/kalusto/${encodeURIComponent(id)}`, runko, 'PUT');

export const siirraKalusto = (
  id: string,
  sijoitus: { laji: SijoitusLaji; id?: string | null; nimi?: string },
  huomio?: string
) => kutsu(`/api/kalusto/${encodeURIComponent(id)}/siirto`, { sijoitus, huomio });

export const pyydaKalustoa = (id: string, kohdeId: string, perustelu: string) =>
  kutsu(`/api/kalusto/${encodeURIComponent(id)}/pyynto`, { kohdeId, perustelu });

export const ratkaisePyynto = (id: string, hyvaksy: boolean, perustelu?: string) =>
  kutsu(`/api/kalusto/${encodeURIComponent(id)}/pyynto/ratkaise`, { hyvaksy, perustelu });

export const peruPyynto = (id: string) =>
  kutsu(`/api/kalusto/${encodeURIComponent(id)}/pyynto/ratkaise`, { toiminto: 'peru' });

export const vaihdaTila = (
  id: string,
  toiminto: 'kadonnut' | 'huoltoon' | 'kayttoon' | 'poista',
  runko?: { syy?: string; huomio?: string }
) => kutsu(`/api/kalusto/${encodeURIComponent(id)}/tila`, { toiminto, ...runko });

export async function haeKalusto(): Promise<KalustoTietue[] | null> {
  try {
    const vastaus = await fetch('/api/data/assets', { credentials: 'include' });
    if (!vastaus.ok) return null;
    const data = await vastaus.json();
    return data?.ok === true && Array.isArray(data.data) ? (data.data as KalustoTietue[]) : null;
  } catch {
    return null;
  }
}

// --- Apurit ------------------------------------------------------------------------

export const aikaleima = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fi-FI', {
    day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// Missä esine on, yhtenä lauseena. Varastolla ei ole omaa nimeä joka kannattaisi toistaa.
export const sijainti = (esine: KalustoTietue) =>
  esine.sijoitusLaji === 'holvi' ? 'Holvi' : esine.sijoitusNimi || '—';

// Avaimen holvipaikka luettavassa muodossa. Tyhjä muille lajeille, koska niillä ei ole
// varattua koukkua — ks. server/kalusto.js.
export const holviPaikka = (esine: KalustoTietue) =>
  (typeof esine.holviPaikka === 'number' ? 'Holvi ' + esine.holviPaikka : '');

// Haku kohdistuu siihen mitä ihminen muistaa: tunnus kilpimerkistä, nimi, sarjanumero ja
// se kenellä esine on. Lisätiedot ovat mukana, koska rekisteritunnus on ajoneuvon nimi
// käytännössä aina.
export function osuuHakuun(esine: KalustoTietue, haku: string) {
  const kysely = haku.trim().toLowerCase();
  if (!kysely) return true;
  const kentat = [
    esine.tunnus, esine.nimi, esine.alalaji, esine.kuvaus, esine.sarjanumero, esine.sijoitusNimi,
    // Holvipaikalla haetaan yhtä usein kuin tunnuksella: se on se numero joka lukee
    // avainlätkässä ja jonka esimies sanoo puhelimessa.
    esine.holviPaikka != null ? String(esine.holviPaikka) : '',
    ...Object.values(esine.lisatiedot || {}).filter((a): a is string => typeof a === 'string'),
  ];
  return kentat.some((k) => String(k || '').toLowerCase().includes(kysely));
}

// QR-koodin sisältö: osoite joka avaa esineen kortin. EI salaista tokenia, toisin kuin
// tarkistuspisteellä — pisteen skannaus todistaa läsnäolon, ja siksi sen koodin on
// oltava arvaamaton. Kalustotarra vain kertoo mikä esine on kädessä, ja sama tunnus
// luetaan kilpimerkistä silmin.
export const tarranOsoite = (tunnus: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL}guard?kalusto=${encodeURIComponent(tunnus)}`;

// --- Määräpäivät ---------------------------------------------------------------------
//
// Päivämääräkentät tallennetaan ISO-muodossa (server/kalusto.js tarkistaa sen), jotta
// niitä voi verrata. Nämä apurit tekevät vertailusta näkyvän: päivä jota mikään ei
// tarkista on muistiinpano, ei määräaika.

const ISO_PAIVA = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** Päivä luettavassa muodossa, tai tyhjä jos arvo ei ole ISO-päivä. */
export const paivays = (iso: string | null | undefined) => {
  const arvo = String(iso || '');
  if (!ISO_PAIVA.test(arvo)) return '';
  const d = new Date(`${arvo}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fi-FI');
};

/**
 * Montako vuorokautta määräpäivään. Negatiivinen = mennyt, 0 = tänään.
 * null jos arvoa ei ole tai se ei ole ISO-päivä.
 *
 * Vertailu tehdään PÄIVÄN tarkkuudella paikallisessa ajassa: kello ei kuulu
 * määräpäivään, eikä tarkastuspäivä saa muuttua myöhässä olevaksi puolenyön jälkeen
 * eri aikavyöhykkeellä kuin missä se kirjattiin.
 */
export const paiviaJaljella = (iso: string | null | undefined): number | null => {
  const arvo = String(iso || '');
  if (!ISO_PAIVA.test(arvo)) return null;
  const maara = new Date(`${arvo}T00:00:00`);
  if (Number.isNaN(maara.getTime())) return null;
  const nyt = new Date();
  const tanaan = new Date(nyt.getFullYear(), nyt.getMonth(), nyt.getDate());
  return Math.round((maara.getTime() - tanaan.getTime()) / 86400000);
};

// Kuinka monta päivää ennen määräpäivää siitä muistutetaan. Kuukausi, koska tarkastus
// ja välineen vaihto ovat kumpikin asioita jotka sovitaan eikä tehdä samana päivänä.
export const MUISTUTUS_PAIVAA = 30;

export type Maaraaikatila = 'mennyt' | 'lahestyy' | 'voimassa' | null;

export const maaraaikatila = (iso: string | null | undefined): Maaraaikatila => {
  const paivia = paiviaJaljella(iso);
  if (paivia === null) return null;
  if (paivia < 0) return 'mennyt';
  return paivia <= MUISTUTUS_PAIVAA ? 'lahestyy' : 'voimassa';
};
