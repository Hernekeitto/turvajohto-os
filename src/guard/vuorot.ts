// Vuorojen selainpuoli: tyypit ja kutsut (erä 16).
//
// Säännöt ovat palvelimella (server/vuorot.js). Tämä tiedosto ei päätä mistään — se kysyy
// kaksi asiaa joita kohdetietue ei suoraan kerro: mihin vuoroihin minä pääsen, ja kenet
// voi perehdyttää tähän kohteeseen.
//
// Vuorotyyppien LUKU JA KIRJOITUS eivät ole täällä. Ne ovat kohteen kenttä, joten ne
// kulkevat guardSites-kokoelman tavallista tietä kuten vyöhykkeet ja tehtävät — oma
// rajapinta samalle tiedolle olisi toinen tie samaan paikkaan.

export type Perehdytettava = {
  username: string;
  nimi: string;
  displayId?: number | null;
};

export type VuoroVaihtoehto = {
  id: string;
  nimi: string;
  kuvaus: string;
  alkaa: string | null;
  paattyy: string | null;
  // Onko tähän vuoroon perehdytys. Perehdyttämätön vuoro palautetaan mukana eikä
  // suodateta pois: piilotettu rivi tuottaa kysymyksen "miksi en näe tätä", johon vartija
  // ei löydä vastausta.
  perehdytetty: boolean;
  // Onko kello vuoroikkunassa jouston sisällä. ERI ASIA kuin perehdytys, ja siksi oma
  // kenttänsä: toiseen pyydetään perehdytys, toiseen odotetaan tai pyydetään lupa.
  ikkunassa: boolean;
  tehtavia: number;
  kierroksia: number;
};

export type Vuorokohde = {
  siteId: string;
  siteNimi: string;
  vuorot: VuoroVaihtoehto[];
};

export type OmatVuorot = {
  kohteet: Vuorokohde[];
  // Kuinka moni muuten luettava kohde jäi pois perehdytyksen puuttumisen takia.
  ilmanPerehdytysta: number;
  joustoMin: number;
};

const TYHJA: OmatVuorot = { kohteet: [], ilmanPerehdytysta: 0, joustoMin: 0 };

/**
 * Omat vuorovaihtoehdot. Palvelin palauttaa johtopäätöksen eikä aineistoa: kohteen
 * perehdytyslista on henkilötietoa eikä sitä lähetetä laitteelle.
 */
export async function haeOmatVuorot(): Promise<OmatVuorot> {
  const vastaus = await fetch('/api/vuorot/omat', { credentials: 'include' });
  if (!vastaus.ok) return TYHJA;
  const data = await vastaus.json().catch(() => null);
  if (!data?.ok) return TYHJA;
  return {
    kohteet: data.kohteet || [],
    ilmanPerehdytysta: data.ilmanPerehdytysta || 0,
    joustoMin: data.joustoMin || 0,
  };
}

// --- Vuoron elinkaari (erä 17) ------------------------------------------------------

export type VuoronTehtava = {
  id: string;
  nimi: string;
  // Miksi tämä on listalla: vuorosta, itse lisätty, siirretty tai pakotettu. Erottaa
  // suunnitellun työn siitä mitä vuoron aikana tuli lisää.
  lahde: 'vuoro' | 'itse_lisatty' | 'siirto' | 'pakotus';
};

export type PalvelimenVuoro = {
  id: string;
  siteId: string;
  siteNimi: string;
  vuorotyyppiId: string;
  vuorotyyppiNimi: string;
  vartija: string;
  alkoi: string;
  paattyi: string | null;
  tila: 'kesken' | 'paattynyt';
  tehtavat: VuoronTehtava[];
  pohjat: VuoronTehtava[];
  perehdytysPoikkeus?: { myontaja: string; syy: string; este: string; aika: string } | null;
};

export type AloitusTulos =
  | { ok: true; vuoro: PalvelimenVuoro }
  // Koneluettava syy, jotta käyttöliittymä osaa tarjota hälytyskeskuksen kertalupaa vain
  // silloin kun este on sellainen jonka lupa voi avata — ei esimerkiksi poistettuun
  // vuoroon, johon lupaa ei ole olemassa.
  | { ok: false; virhe: string; syy?: string; vuoroId?: string };

/**
 * Kesken oleva oma vuoro palvelimelta. Tämä on totuus; laitteen tallenne on kopio.
 *
 * Verkkovirhe palauttaa undefinedin eikä nullia, koska ne tarkoittavat eri asiaa:
 * "ei vuoroa" ja "en tiedä" eivät saa näyttää kutsujalle samalta. Jos ne olisivat sama,
 * katvealue päättäisi vartijan vuoron hänen puolestaan.
 */
export async function haeOmaVuoro(): Promise<PalvelimenVuoro | null | undefined> {
  try {
    const vastaus = await fetch('/api/vuoro/oma', { credentials: 'include' });
    if (!vastaus.ok) return undefined;
    const data = await vastaus.json();
    return data?.ok ? (data.vuoro || null) : undefined;
  } catch {
    return undefined;
  }
}

export async function aloitaVuoroPalvelimella(
  siteId: string,
  vuorotyyppiId: string,
): Promise<AloitusTulos> {
  const vastaus = await fetch('/api/vuoro', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteId, vuorotyyppiId }),
  });
  const data = await vastaus.json().catch(() => null);
  if (!vastaus.ok || !data?.ok) {
    return {
      ok: false,
      virhe: data?.error || 'Vuoron aloitus ei onnistunut.',
      syy: data?.syy,
      vuoroId: data?.vuoroId,
    };
  }
  return { ok: true, vuoro: data.vuoro };
}

/**
 * Vuoron päättäminen palvelimella.
 *
 * Epäonnistuminen EI saa estää käyttöliittymää päättämästä vuoroa omalta osaltaan:
 * katvealueelle jäänyt pyyntö tarkoittaisi muuten, ettei vartija pääse ulos vuorosta
 * ennen kuin verkko palaa. Toisto on päällä, koska sama pyyntö voi lähteä uudelleen.
 */
export async function paataVuoroPalvelimella(vuoroId: string): Promise<boolean> {
  try {
    const vastaus = await fetch(`/api/vuoro/${encodeURIComponent(vuoroId)}/paata`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toisto: true }),
    });
    const data = await vastaus.json().catch(() => null);
    return !!data?.ok;
  } catch {
    return false;
  }
}

/**
 * Ketkä voidaan perehdyttää tähän kohteeseen. 403 ei ole virhe vaan odotettu lopputulos
 * tunnukselle joka ei hallitse kohteita — kutsuja päättää mitä silloin näytetään.
 */
export async function haePerehdytettavat(siteId: string): Promise<Perehdytettava[]> {
  if (!siteId) return [];
  const vastaus = await fetch(`/api/kohde/${encodeURIComponent(siteId)}/perehdytettavat`, {
    credentials: 'include',
  });
  if (!vastaus.ok) return [];
  const data = await vastaus.json().catch(() => null);
  return data?.ok ? (data.kayttajat || []) : [];
}
