// Tehtävänsiirron selainpuoli: tyypit ja kutsut (erä 18).
//
// Säännöt ovat palvelimella (server/siirto.js). Tämä tiedosto ei päätä mistään.
//
// --- Miksi siirto ei ole osa vuoroa ------------------------------------------------
//
// Siirretty kierros voi olla eri kohteessa kuin saajan oma vuoro — piirivartija tulee
// ajamaan kauppakeskusvartijan kierroksen. Siksi siirto on oma tietueensa, ja vartijan
// työlista syntyy yhdistämällä vuoron omat tehtävät, hyväksytyt siirrot ja hälytykset.
// Lista on VARTIJAN, vuoro vain kylvää sen (päätös 10.9.2026).

export type SiirronTila = 'odottaa' | 'hyvaksytty' | 'hylatty' | 'peruttu' | 'kuitattu' | 'valmis';

export type Siirto = {
  id: string;
  laji: 'tehtava' | 'kierros' | 'oma';
  kohdeId: string;
  nimi: string;
  siteId: string;
  siteNimi: string;
  antaja: string;
  saaja: string;
  vuoroId: string | null;
  // 'siirto' = hyväksytään tai hylätään. 'pakotus' = kuitataan (erä 19).
  tapa: 'siirto' | 'pakotus';
  tila: SiirronTila;
  viesti: string;
  // Mitä vartijan on kirjoitettava ennen kuin tehtävän voi merkitä tehdyksi. null =
  // ei vaatimusta (tavallinen siirto).
  raporttilaji?: Raporttilaji | null;
  raportti?: { laji: Raporttilaji; raporttiId: string | null; teksti: string } | null;
  tehty?: string | null;
  luotu: string;
  ratkaistu: string | null;
};

export type OmatSiirrot = {
  // Kuittaamattomat pakotukset. OMA KENTTÄNSÄ eikä osa saapuvia: pakotus ei ole pyyntö
  // johon vastataan vaan määräys joka kuitataan, ja se estää muun käytön kunnes se on
  // nähty. Sekoittaminen näyttäisi sen hyväksyttävänä, mikä se ei ole.
  pakotukset: Siirto[];
  // Mihin minun on vastattava.
  saapuvat: Siirto[];
  // Mikä on jo minun tehtävänäni.
  hyvaksytyt: Siirto[];
  // Mitä odotan toiselta. Antajan listalla tehtävä säilyy kunnes saaja hyväksyy, joten
  // antajan on nähtävä missä pyyntö menee.
  lahtevat: Siirto[];
};

export type Vastaanottaja = { username: string; nimi: string; kohde: string };

export const TYHJAT_SIIRROT: OmatSiirrot = { saapuvat: [], hyvaksytyt: [], lahtevat: [], pakotukset: [] };

export async function haeOmatSiirrot(): Promise<OmatSiirrot> {
  try {
    const vastaus = await fetch('/api/siirrot/omat', { credentials: 'include' });
    if (!vastaus.ok) return TYHJAT_SIIRROT;
    const data = await vastaus.json();
    if (!data?.ok) return TYHJAT_SIIRROT;
    return {
      saapuvat: data.saapuvat || [],
      hyvaksytyt: data.hyvaksytyt || [],
      lahtevat: data.lahtevat || [],
      pakotukset: data.pakotukset || [],
    };
  } catch {
    return TYHJAT_SIIRROT;
  }
}

/**
 * Ketkä ovat nyt vuorossa. Palvelin vaatii että kysyjä on itse vuorossa — siirtää voi
 * vain omasta vuorostaan, eikä vuorottomalle kuulu tieto siitä kuka on missäkin kentällä.
 */
export async function haeVastaanottajat(): Promise<Vastaanottaja[]> {
  try {
    const vastaus = await fetch('/api/siirrot/vastaanottajat', { credentials: 'include' });
    if (!vastaus.ok) return [];
    const data = await vastaus.json();
    return data?.ok ? (data.vastaanottajat || []) : [];
  } catch {
    return [];
  }
}

const posti = async (polku: string, runko: unknown) => {
  try {
    const vastaus = await fetch(polku, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runko),
    });
    const data = await vastaus.json().catch(() => null);
    if (!vastaus.ok || !data?.ok) {
      return { ok: false as const, virhe: data?.error || 'Toiminto ei onnistunut.' };
    }
    return { ok: true as const, siirto: data.siirto as Siirto };
  } catch {
    return { ok: false as const, virhe: 'Palvelimeen ei saatu yhteyttä.' };
  }
};

export const siirraTehtava = (
  saaja: string,
  laji: 'tehtava' | 'kierros',
  kohdeId: string,
  viesti = '',
) => posti('/api/siirto', { saaja, laji, kohdeId, viesti });

export const vastaaSiirtoon = (id: string, hyvaksy: boolean) =>
  posti(`/api/siirto/${encodeURIComponent(id)}/vastaa`, { hyvaksy });

export const peruSiirto = (id: string) =>
  posti(`/api/siirto/${encodeURIComponent(id)}/peru`, {});

// --- Pakotus (erä 19) ---------------------------------------------------------------

export type JaettavaTehtava = {
  id: string;
  nimi: string;
  tyyppi?: 'kuittaus' | 'lista';
  suoritusaika: string | null;
};

export type JaettavaKohde = {
  siteId: string;
  siteNimi: string;
  tehtavat: JaettavaTehtava[];
  pohjat: JaettavaTehtava[];
};

/**
 * Kaikkien kohteiden tehtävät ja kierrokset. Vaatii pääkäyttäjän tai hälytyskeskuksen
 * oikeudet; 403 ei ole virhe vaan odotettu lopputulos muille.
 */
export async function haeKaikkiTehtavat(): Promise<{ kohteet: JaettavaKohde[]; vartijat: Vastaanottaja[] }> {
  const tyhja = { kohteet: [], vartijat: [] };
  try {
    const vastaus = await fetch('/api/tehtavat/kaikki', { credentials: 'include' });
    if (!vastaus.ok) return tyhja;
    const data = await vastaus.json();
    return data?.ok ? { kohteet: data.kohteet || [], vartijat: data.vartijat || [] } : tyhja;
  } catch {
    return tyhja;
  }
}

/**
 * Tehtävän määrääminen vartijalle. Saaja ei voi kieltäytyä — hän kuittaa nähdyksi.
 * Vuoroa ei vaadita: määräys ei ole pyyntö.
 *
 * Olio eikä paikkaparametrit (18.9.2026): kenttiä on nyt seitsemän, ja niistä kolme on
 * valinnaisia eri yhdistelmissä. Viiden peräkkäisen merkkijonon kutsu on paikka jossa
 * kaksi niistä vaihtaa päittäin huomaamatta.
 */
export const pakotaTehtava = (runko: PakotuksenRunko) => posti('/api/pakota', runko);

export const kuittaaPakotus = (id: string) =>
  posti(`/api/siirto/${encodeURIComponent(id)}/kuittaa`, {});



// --- Raporttivaatimus ja valmiiksi merkintä (18.9.2026) ------------------------------

/** Mitä vartijan on kirjoitettava ennen kuin tehtävän voi merkitä tehdyksi. */
export type Raporttilaji = 'tapahtumailmoitus' | 'selvitys' | 'kommentti';

export const RAPORTTILAJIN_NIMI: Record<Raporttilaji, string> = {
  tapahtumailmoitus: 'Tapahtumailmoitus',
  selvitys: 'Lyhyt selvitys',
  kommentti: 'Kommentti',
};

export const RAPORTTILAJIN_SELITE: Record<Raporttilaji, string> = {
  tapahtumailmoitus: 'Vartija kirjoittaa virallisen tapahtumailmoituksen ja liittää sen tehtävään.',
  selvitys: 'Vartija kirjoittaa lyhyesti mitä teki. Pakollinen.',
  kommentti: 'Vartija voi kirjoittaa huomion. Saa jäädä tyhjäksi.',
};

export type PakotuksenRunko = {
  saaja: string;
  /** 'oma' = päivystäjän itse kirjoittama tehtävä, jota ei ole kohteen luettelossa. */
  laji: 'tehtava' | 'kierros' | 'oma';
  siteId: string;
  /** Luettelotunnus. 'oma'-lajilla palvelin luo tunnuksen, joten tätä ei anneta. */
  kohdeId?: string;
  /** Vain 'oma'-lajilla. Muilla nimi luetaan kohteen luettelosta — selaimen nimeä ei uskota. */
  nimi?: string;
  viesti?: string;
  raporttilaji?: Raporttilaji | null;
};

/**
 * Vartija merkitsee pakotetun tehtävän tehdyksi.
 *
 * Kuittaus (kuittaaPakotus) ja tämä ovat eri asioita: ensimmäinen kertoo että määräys on
 * nähty, tämä että työ on tehty. Palvelin vaatii kuittauksen ensin.
 */
export async function merkitseSiirtoValmiiksi(
  siirtoId: string,
  { raporttiId = null, teksti = '' }: { raporttiId?: string | null; teksti?: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const vastaus = await fetch(`/api/siirto/${encodeURIComponent(siirtoId)}/valmis`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ raporttiId, teksti }),
    });
    const data = await vastaus.json().catch(() => null);
    if (!vastaus.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'Merkintä ei onnistunut.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Merkintä ei onnistunut: ei yhteyttä palvelimeen.' };
  }
}
