// Hälytystehtävien selainpuoli: tyypit, kutsut ja esitysmuodot (erä 22).
//
// Säännöt ovat palvelimella (server/halytystehtava.js). Tämä tiedosto ei päätä mistään —
// se kysyy ja näyttää. Erityisesti valikon rivit EIVÄT pääty täällä: palvelin palauttaa
// `toiminnot`-olion, ja käyttöliittymä piirtää sen. Valikon rivi joka tuottaa
// 400-virheen on huonompi kuin puuttuva rivi.
//
// HÄLYTYSTEHTÄVÄ EI OLE HÄLYTYS. `shared/halytykset.ts` on vartijan oma turvahälytys
// (ajastin, man-down, hätäpainike) — tämä on työ jonka hälytyskeskus antaa vartijalle.
// Kaksi eri kokoelmaa, kaksi eri moduulia, ja sama sana kansankielessä.

// 'tarkistus' syntyy KONEELLISESTI vartijan oman turvahälytyksen eskaloituessa
// (hätäpainike, man-down, ajastin) — muut lajit luo päivystäjä. Se on silti tavallinen
// hälytystehtävä eikä erillinen käsite: sama kohdennus, sama vastaanotto, sama
// poistumislupa ja sama tapahtumailmoitus.
export type HalytysLaji = 'murto' | 'vartijakutsu' | 'ovenavaus' | 'tarkistus';
export type TehtavanTila = 'avoin' | 'kaynnissa' | 'odottaa' | 'suljettu' | 'peruttu';

// Millä perusteella tehtävä näytettiin tälle vartijalle. Näytetään käyttöliittymässä:
// "miksi minulle tuli hälytys kohteesta jossa en ole koskaan käynyt" on kysymys johon
// vartijan on saatava vastaus näkymästä eikä esimieheltä.
export type Kohdennus = 'oma' | 'vuoro' | 'piiri' | 'sade';

export type Havainto = { id: string; ts: string; teksti: string; kirjaaja: string | null };

export type Yksikko = {
  vartija: string;
  // Vuoron nimi ("Piiri 301", "Kohde X"), ei vartijan nimimerkki. Käyttäjän päätös
  // 14.9.2026: tunnus tapahtumalokissa tulee siitä vuorosta johon vartija on kirjautunut.
  nimi: string;
  vuoroId: string | null;
  vastaanotti: string | null;
  ajoon: string | null;
  paikalla: string | null;
  poistui?: string | null;
  kieltaytyi: string | null;
  syy?: string;
};

export type Hyvaksynta = {
  tila: 'odottaa' | 'hyvaksytty' | 'palautettu';
  pyytaja: string | null;
  pyydetty: string | null;
  kasittelija: string | null;
  ratkaistu: string | null;
  kommentti: string;
};

export type Toiminnot = {
  vastaanota: boolean;
  kieltaydy: boolean;
  ajoon: boolean;
  paikalla: boolean;
  raportoi: boolean;
  odottaa: boolean;
};

// Kohteen ne tiedot jotka hälytystehtävä avaa. EI koko kohdetietue: perehdytykset,
// vuorotyypit ja kierrospohjat eivät kuulu tähän eikä niitä avata sivutuotteena
// hälytyksestä. null ennen kuin tehtävä on otettu vastaan.
export type TehtavanKohde = {
  id: string;
  name: string;
  address: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  halytysNumerot: { nimi?: string; numero: string }[];
  avaimet: { numero: string; lisatieto?: string }[];
  halytysjarjestelma: string;
  avaintenSailytys: string;
  // Vain tieto siitä ONKO koodi. Itse koodi haetaan erikseen (haeMasterkoodi), jotta
  // jokainen katsominen jää auditlokiin.
  onMasterkoodi: boolean;
};

// Tehtävään liitetty tapahtumailmoitus sellaisena kuin päivystäjä sen näkee.
//
// Kentät ovat GuardRaportin kenttiä, mutta tyyppi on oma: karsitussa muodossa
// kohdehenkilön kentät PUUTTUVAT kokonaan eivätkä ole tyhjiä, ja `liitteita` korvaa
// liitelistan. Jos tämä olisi `Partial<GuardRaportti>`, karsinta näyttäisi näkymässä
// samalta kuin täyttämättä jätetty kenttä.
export type TehtavanRaportti = {
  id: string;
  siteId: string;
  type: string;
  author: string;
  date: string;
  time: string;
  place?: string;
  summary?: string;
  description?: string;
  denied?: number;
  removed?: number;
  detained?: number;
  force?: boolean;
  tools?: boolean;
  firearm?: boolean;
  firstAid?: boolean;
  attachments?: { id: string; name?: string }[];
  // Milloin ilmoitus lähetettiin tehtävälle ja minkä yksikön toimesta. Eri asia kuin
  // raportin oma `time`: vartija voi kirjata tapahtuman kellonajaksi sen hetken jolloin
  // se tapahtui, ei sitä jolloin hän kirjoitti siitä.
  lahetetty?: string;
  yksikko?: string;
  // Vain karsitussa muodossa.
  liitteita?: number;
  kohdehenkiloKarsittu?: boolean;
  // Karsitussa muodossa nämä puuttuvat kokonaan.
  licenseHolder?: string;
  subjectLastName?: string;
  subjectFirstNames?: string;
  subjectPersonalId?: string;
  subjectAddress?: string;
  subjectFeatures?: string;
  subjectObservations?: string;
};

export type Halytystehtava = {
  id: string;
  laji: HalytysLaji;
  siteId: string;
  siteNimi: string;
  silmukka: string;
  tila: TehtavanTila;
  luotu: string;
  luoja: string | null;
  havainnot: Havainto[];
  yksikot: Yksikko[];
  raportit: { raporttiId: string; vartija: string; nimi: string; lahetetty: string }[];
  hyvaksynta: Hyvaksynta | null;
  peruminen?: { kasittelija: string | null; syy: string; ts: string } | null;
  paattyi: string | null;
  loki: { ts: string; tapahtuma: string; user: string | null; teksti: string }[];
  // Vain vartijan omalla reitillä (/api/halytystehtavat/omat).
  peruste?: Kohdennus | null;
  etaisyysKm?: number | null;
  toiminnot?: Toiminnot;
  kohde?: TehtavanKohde | null;
};

export const LAJIN_NIMI: Record<HalytysLaji, string> = {
  murto: 'Murtohälytys',
  vartijakutsu: 'Vartijakutsu',
  ovenavaus: 'Ovenavaus',
  // OMA LAJINSA eikä vartijakutsu, koska vastaanottavan vartijan on tiedettävä kumpaa
  // ollaan tekemässä: asiakas pyysi vartijan paikalle, vai onko kollega hädässä. Ne ovat
  // eri tehtävä ja eri kiire.
  tarkistus: 'Vartijan tarkistus',
};

// Ne lajit joita PÄIVYSTÄJÄ voi luoda käsin. `tarkistus` ei ole listassa: se syntyy
// koneellisesti turvahälytyksen eskaloituessa, eikä käsin luotu "tarkistus" ilman
// taustalla olevaa hälytystä tarkoittaisi mitään. Päivystäjä joka haluaa lähettää
// vartijan katsomaan toista vartijaa luo vartijakutsun.
export const LAJIT: HalytysLaji[] = ['murto', 'vartijakutsu', 'ovenavaus'];

export const TILAN_NIMI: Record<TehtavanTila, string> = {
  avoin: 'Uusi',
  kaynnissa: 'Käynnissä',
  odottaa: 'Odottaa hyväksyntää',
  suljettu: 'Suljettu',
  peruttu: 'Peruttu',
};

export const KOHDENNUKSEN_SELITE: Record<Kohdennus, string> = {
  oma: 'Olet ottanut tehtävän vastaan',
  vuoro: 'Olet vuorossa tässä kohteessa',
  piiri: 'Olet piirivuorossa',
  sade: 'Olet kohteen lähellä',
};

// HUOM: tilajoukkoa "onko auki" EI ole täällä. Palvelin palauttaa vartijan reitillä vain
// avoimet tehtävät (AVOIMET_TILAT), joten selaimen ei tarvitse suodattaa niitä uudelleen
// — ja toisinto tilajoukosta olisi paikka jossa selain ja palvelin voivat erkaantua.
export const kellonaika = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
};

// Lokirivin aikaleima sekunnin tarkkuudella. Esimerkkikuvien tapahtumaloki näyttää
// sekunnit, ja syy on vasteaika: minuutin tarkkuudella "vastaanotti" ja "ajoon" ovat
// usein sama luku, jolloin loki ei kerro kumpi tapahtui ensin.
export const kellonaikaSek = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Oma yksikkörivi tehtävällä, tai null. Kieltäytynyt ei ole mukana: hän on tietueessa
// mutta ei tehtävällä.
export const omaYksikko = (t: Halytystehtava, kayttaja: string) =>
  (t.yksikot || []).find((y) => y.vartija === kayttaja && !y.kieltaytyi) || null;

type Vastaus = { ok: boolean; error?: string; tehtava?: Halytystehtava; [k: string]: unknown };

// Yksi kutsupaikka kaikille reiteille. Verkkovirhe palautetaan samassa muodossa kuin
// palvelimen virhe, jotta kutsuja voi näyttää sen sellaisenaan.
//
// TÄMÄ EI MENE LÄHTEVÄÄN JONOON, samasta syystä kuin hälytykset (shared/halytykset.ts):
// jonoon jäänyt "olen paikalla" näyttäisi onnistuneen ja lähtisi ehkä puolen tunnin
// päästä, jolloin hälytyskeskus luulisi vartijan olevan kohteessa vaikka hän ei ole.
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
      return { ok: false, error: data?.error || `Palvelin vastasi virheellä ${vastaus.status}.`, ...(data || {}) };
    }
    return data || { ok: false, error: 'Palvelimen vastausta ei voitu lukea.' };
  } catch {
    return { ok: false, error: 'Ei yhteyttä palvelimeen. Tieto EI mennyt hälytyskeskukseen.' };
  }
}

export async function haeOmatTehtavat(): Promise<{ tehtavat: Halytystehtava[]; yksikko: string } | null> {
  try {
    const vastaus = await fetch('/api/halytystehtavat/omat', { credentials: 'include' });
    if (!vastaus.ok) return null;
    const data = await vastaus.json();
    return data?.ok === true
      ? { tehtavat: (data.tehtavat || []) as Halytystehtava[], yksikko: String(data.yksikko || '') }
      : null;
  } catch {
    return null;
  }
}

export async function haeKaikkiTehtavat(kaikki = false): Promise<
  { tehtavat: Halytystehtava[]; saaMuokata: boolean } | null
> {
  try {
    const vastaus = await fetch(`/api/halytystehtavat${kaikki ? '?kaikki=1' : ''}`, { credentials: 'include' });
    if (!vastaus.ok) return null;
    const data = await vastaus.json();
    return data?.ok === true
      ? { tehtavat: (data.tehtavat || []) as Halytystehtava[], saaMuokata: data.saaMuokata === true }
      : null;
  } catch {
    return null;
  }
}

// Tehtävään liitetyt raportit. Oma hakunsa eikä listahaun kenttä: raportin runko on
// pitkä ja se luetaan vain silloin kun poistumispyyntöä ratkaistaan, ja jokainen luku
// jää auditlokiin (server/index.js). Listahaun mukana tuleva raportti tuottaisi
// merkinnän joka kerta kun hälytyskeskus päivittyy.
//
// `rajattu: true` tarkoittaa että kohdehenkilön LYTP-kentät on karsittu, koska lukijalla
// ei ole raporttisolmun lukuoikeutta kyseiseen kohteeseen. Se on NÄYTETTÄVÄ: muuten
// puuttuva nimi näyttää siltä että vartija jätti kentät täyttämättä.
export async function haeTehtavanRaportit(id: string): Promise<
  { raportit: TehtavanRaportti[]; rajattu: boolean } | null
> {
  try {
    const vastaus = await fetch(`/api/halytystehtava/${encodeURIComponent(id)}/raportit`, {
      credentials: 'include',
    });
    if (!vastaus.ok) return null;
    const data = await vastaus.json();
    return data?.ok === true
      ? { raportit: (data.raportit || []) as TehtavanRaportti[], rajattu: data.rajattu === true }
      : null;
  } catch {
    return null;
  }
}

export const luoTehtava = (args: {
  laji: HalytysLaji; siteId: string; silmukka?: string; havainnot?: string[];
}) => kutsu('/api/halytystehtava', args);

const polku = (id: string, toiminto: string) =>
  `/api/halytystehtava/${encodeURIComponent(id)}/${toiminto}`;

export const lisaaHavainto = (id: string, teksti: string) => kutsu(polku(id, 'havainto'), { teksti });
export const vastaanota = (id: string, ajoon = false) => kutsu(polku(id, 'vastaanota'), { ajoon });
export const kieltaydy = (id: string, syy?: string) => kutsu(polku(id, 'kieltaydy'), { syy });
export const merkitseVaihe = (id: string, vaihe: 'ajoon' | 'paikalla') =>
  kutsu(polku(id, 'vaihe'), { vaihe });
export const lahetaRaportti = (id: string, raporttiId: string) =>
  kutsu(polku(id, 'raportti'), { raporttiId });
export const ratkaiseHyvaksynta = (id: string, hyvaksy: boolean, kommentti?: string) =>
  kutsu(polku(id, 'hyvaksynta'), { hyvaksy, kommentti });
export const peruTehtava = (id: string, syy?: string) => kutsu(polku(id, 'peru'), { syy });

// Master-koodin paljastaminen. Oma kutsunsa eikä listan kenttä: jokainen katsominen jää
// auditlokiin, ja listan mukana tuleva koodi tuottaisi merkinnän jokaisesta listan
// avaamisesta eikä kertoisi kuka koodin oikeasti luki.
export async function haeMasterkoodi(id: string): Promise<{ ok: boolean; masterkoodi?: string; error?: string }> {
  const vastaus = await kutsu(polku(id, 'masterkoodi'));
  return { ok: vastaus.ok, masterkoodi: vastaus.masterkoodi as string | undefined, error: vastaus.error };
}
