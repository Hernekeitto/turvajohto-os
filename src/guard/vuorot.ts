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
