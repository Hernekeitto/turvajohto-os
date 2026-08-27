// GUARD-puolen tietotyypit yhdessä paikassa, jotta näkymät voivat jakaa ne ilman
// kehäriippuvuuksia.

// Kohteelle merkitty perehdytys. Nimi tallennetaan tietueeseen sellaisenaan eikä pelkkänä
// viittauksena työntekijäpankkiin: perehdytys on tapahtuma joka on kirjattu tiettynä
// päivänä tietylle henkilölle, ja sen on säilyttävä luettavana vaikka työntekijä
// poistettaisiin rekisteristä myöhemmin. employeeId on siksi valinnainen lisätieto.
export type Perehdytys = {
  id: string;
  nimi: string;
  employeeId?: string;
  displayId?: number | null;
  pvm: string;
  perehdyttaja?: string;
};

// Kohteelle määritelty tehtävä työvuoroon. Kaksi muotoa:
//   'kuittaus' = yksi kysymys, suoritettu kyllä/ei
//   'lista'    = tarkistuslista jossa jokainen kohta kuitataan erikseen (esim. sulkukierros)
export type Tehtava = {
  id: string;
  nimi: string;
  tyyppi: 'kuittaus' | 'lista';
  kuvaus?: string;
  // Vain 'lista'-tyypille. Tyhjä lista 'kuittaus'-tyypillä.
  kohdat: string[];
};

export type Kohde = {
  id: string;
  name: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  archived?: boolean;
  perehdytykset?: Perehdytys[];
  tehtavat?: Tehtava[];
};

// Kohteen tiedosto (guardFiles). Oma kokoelmansa eikä kohteen kenttä, koska liitetiedosto
// elää palvelimen uploads-hakemistossa ja sen elinkaari (lataus, roskienkeruu) on eri kuin
// kohteen perustietojen. siteId sitoo sen kohteeseen ja toimii oikeusavaimena.
export type KohteenTiedosto = {
  id: string;
  siteId: string;
  name: string;
  uploadId: string;
  size?: number;
  lisatty: string;
  lisaaja?: string;
};

// Tehtävän suoritus. Oma kokoelmansa (guardTaskRuns), koska suoritus on tapahtuma ajassa
// toisin kuin tehtävän määrittely joka on kohteen ominaisuus.
export type TehtavaSuoritus = {
  id: string;
  siteId: string;
  tehtavaId: string;
  tehtavaNimi: string;
  vartija: string;
  aika: string;
  // 'kuittaus'-tyypille: suoritettiinko. 'lista'-tyypille: kuitatut kohdat.
  suoritettu?: boolean;
  kuitatut?: string[];
  huomiot?: string;
};

// Vartijan raportti (guardReports). Kentät vastaavat EVENT-puolen raportteja, koska sama
// laki koskee molempia ja palvelimen kenttäsalaus on identtinen (store.js: ENCRYPTED_FIELDS).
export type RaporttiTyyppi = 'guard_action' | 'guard_jvreport';

export type GuardRaportti = {
  id: string;
  siteId: string;
  typeId: RaporttiTyyppi;
  type: string;
  author: string;
  date: string;
  time: string;
  place?: string;
  summary?: string;
  description?: string;
  luotu?: string;
  // Toimenpiteiden lukumäärät ja voimakeinot.
  denied?: number;
  removed?: number;
  detained?: number;
  force?: boolean;
  tools?: boolean;
  firearm?: boolean;
  firstAid?: boolean;
  // Vain tapahtumailmoituksessa: LYTP:n nojalla kirjattavat kohdehenkilötiedot. Nämä
  // salataan levylle — ks. server/store.js.
  licenseHolder?: string;
  subjectLastName?: string;
  subjectFirstNames?: string;
  subjectPersonalId?: string;
  subjectAddress?: string;
  subjectFeatures?: string;
  subjectObservations?: string;
};

export const uusiId = () =>
  (crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
