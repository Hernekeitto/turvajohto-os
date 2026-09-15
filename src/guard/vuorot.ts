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
  // Milloin vuoron oli MÄÄRÄ päättyä (palvelin laskee vuorotyypin kellonajasta, ks.
  // server/vuorot.js: vuoronPaattymisaika). null = kellonaikaa ei ole.
  paattyyArvio?: string | null;
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
 * Tehtävän tai kierroksen lisäys omaan vuoroon kohteen hakemistosta.
 *
 * Tämä on "lisäksi, ei tilalle": vuoro kertoo mitä pitää tehdä, hakemisto vastaa
 * kysymykseen saanko tehdä myös tämän. Palvelin hyväksyy vain kohteen omasta
 * hakemistosta, ja merkitsee lisätyn lähteellä `itse_lisatty` — jälkikäteen on nähtävä
 * mikä oli suunniteltua työtä ja mikä tuli vuoron aikana lisää.
 */
export async function lisaaVuoroon(
  vuoroId: string,
  laji: 'tehtava' | 'kierros',
  kohdeId: string,
): Promise<{ ok: true; vuoro: PalvelimenVuoro } | { ok: false; virhe: string }> {
  try {
    const vastaus = await fetch(`/api/vuoro/${encodeURIComponent(vuoroId)}/lisaa`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ laji, kohdeId }),
    });
    const data = await vastaus.json().catch(() => null);
    if (!vastaus.ok || !data?.ok) {
      return { ok: false, virhe: data?.error || 'Lisäys ei onnistunut.' };
    }
    return { ok: true, vuoro: data.vuoro };
  } catch {
    return { ok: false, virhe: 'Lisäys ei onnistunut: palvelimeen ei saatu yhteyttä.' };
  }
}


// --- Vuoron kooste (erä 18b) --------------------------------------------------------

export type KoosteRivi = {
  id: string;
  nimi: string;
  lahde: 'vuoro' | 'itse_lisatty' | 'siirto' | 'pakotus';
  suoritusaika: string | null;
  tila: 'valmis' | 'kesken' | 'keskeytetty' | 'tekematta';
  tehtyKlo: string | null;
  // Minuutteja suunnitellusta, etumerkki mukaan: positiivinen on myöhässä.
  poikkeamaMin: number | null;
  // Onko liukuman ulkopuolella. ERI ASIA kuin poikkeamaMin: kahden minuutin ero on
  // poikkeama luvultaan mutta ei merkinnältään.
  poikkeama: boolean;
};

export type VuoronKooste = {
  vuoroId: string;
  siteNimi: string;
  vuorotyyppiNimi: string;
  vartija: string;
  alkoi: string;
  paattyi: string | null;
  tehty: number;
  tekematta: number;
  kesken: number;
  keskeytetty: number;
  poikkeamia: number;
  perehdytysPoikkeus: { myontaja: string; syy: string; este: string; aika: string } | null;
  pohjat: KoosteRivi[];
  tehtavat: KoosteRivi[];
};

/**
 * Vuoron kooste. Palvelin laskee sen pyydettäessä lähdeaineistosta eikä palauta
 * tallennettua johtopäätöstä — tallennettu johtopäätös vanhenisi hiljaa kun
 * lähdeaineisto korjataan.
 */
export async function haeVuoronKooste(vuoroId: string): Promise<VuoronKooste | null> {
  try {
    const vastaus = await fetch(`/api/vuoro/${encodeURIComponent(vuoroId)}/kooste`, {
      credentials: 'include',
    });
    if (!vastaus.ok) return null;
    const data = await vastaus.json();
    return data?.ok ? (data.kooste || null) : null;
  } catch {
    return null;
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

// --- Unohtunut vuoro (käyttäjän päätös 15.9.2026) ------------------------------------
//
// Vuoron päättäminen kuuluu vartijan työvelvollisuuteen eikä sitä päätetä
// automaattisesti. Mutta päälle jäänyt vuoro pitää sijaintiseurannan käynnissä ja
// näyttää hälytyskeskukselle siltä että vartija on yhä töissä, joten siitä
// huomautetaan kahdessa vaiheessa:
//
//   +10 min   huomio VARTIJALLE — mahdollisuus korjata itse
//   +15 min   rivi HÄLYTYSKESKUKSEEN — päivystäjä alkaa selvittää
//
// Kaksi vaihetta eikä yksi: ensimmäinen on muistutus, toinen on tehtävä jonka joku ottaa
// hoitaakseen. Ilman väliä jokainen viisi minuuttia myöhässä oleva vuoronvaihto
// työllistäisi päivystäjää.
export const UNOHTUNUT_VARTIJA_MIN = 10;
export const UNOHTUNUT_HALKE_MIN = 15;

/**
 * Kuinka monta minuuttia vuoro on yli määräajan, tai null jos ei ole.
 *
 * LASKENTA ON SELAIMESSA JA MÄÄRÄAIKA PALVELIMELTA, ja työnjako on harkittu. Määräajan
 * laskeminen kellonajasta ("07:00") vaatii tiedon siitä ylittääkö vuoro puolenyön, ja se
 * on palvelimen tehtävä koska vuorotyyppi on kohteen kenttä (server/vuorot.js:
 * vuoronPaattymisaika). Myöhästymisminuuttien laskeminen taas on pelkkä vähennyslasku —
 * mutta se on tehtävä TIKITTÄVÄSTÄ kellosta.
 *
 * Jos palvelin laskisi minuutit, vartijan puhelin näyttäisi sen luvun joka oli voimassa
 * sovellusta avattaessa: oma vuoro haetaan kerran eikä sitä pollata. Huomio ei
 * ilmestyisi koskaan kesken vuoron, eli juuri silloin kun se tarvitaan.
 */
export function myohassaMinuutteina(
  paattyyArvio: string | null | undefined,
  nyt: number = Date.now()
): number | null {
  if (!paattyyArvio) return null;
  const maaraaika = Date.parse(paattyyArvio);
  if (!Number.isFinite(maaraaika)) return null;
  const min = Math.floor((nyt - maaraaika) / 60_000);
  return min > 0 ? min : null;
}
