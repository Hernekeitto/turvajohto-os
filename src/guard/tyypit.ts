// GUARD-puolen tietotyypit yhdessä paikassa, jotta näkymät voivat jakaa ne ilman
// kehäriippuvuuksia.

import type { Vyohyke } from '../shared/vyohykkeet';

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
  // Kohteen pohjakartta ja sen päälle piirretyt vyöhykkeet. Sama malli kuin
  // tapahtumalla (päätös V5): vyöhyke on kohteen kenttä eikä omaa kokoelmaansa.
  // HUOM: mapUploadId on rekisteröitävä palvelimella kahteen paikkaan —
  // UPLOAD_VIITTAAJAT (roskienkeruu) ja canReadGuardAttachment (lukuoikeus).
  mapUploadId?: string;
  mapUploadName?: string;
  zones?: Vyohyke[];
  // Kartan kalibrointipisteet: kohtia kuvalla joiden oikeat koordinaatit tiedetään.
  // Ilman näitä GPS-sijainnista ei voi päätellä kohtaa pohjakuvalla, jolloin vyöhykkeiden
  // hälytyssäännöt (erä 7) eivät voi laueta eikä kukaan näy kartalla.
  mapRef?: { img: { x: number; y: number }; gps: { lat: number; lon: number } }[];
  // Kohteen hälytysnumerot. Näihin lähtee tekstiviesti kun hälytys eskaloituu. EI sama
  // kuin contactPhone: man-down-hälytyksessä soitetaan oman vartiointiliikkeen
  // päivystäjälle, ei toimeksiantajalle kello kolme yöllä.
  halytysNumerot?: { nimi?: string; numero: string }[];
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
  // Erässä 1 lisätyt kentät. Samat kuin EVENT-puolen raporteilla, koska molempia
  // koskee sama tilamalli ja sama muuttumattomuussääntö (ks. server/kirjaukset.js).
  status?: string | null;
  severity?: number | null;
  zoneId?: string | null;
  assignedTo?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  attachments?: { id: string; name?: string }[];
  location?: { img: unknown; gps: unknown };
  formCode?: string | null;
  formVersion?: string | null;
  policeDeliveredAt?: string | null;
  policeStation?: string | null;
  corrections?: { id: string; at: string; by: string; text: string }[];
};

// --- Kierrokset ja pohjamoottori (erä 5) -------------------------------------------

// Kierrospohjan tarkistuspiste. `token` EI koskaan tule selaimeen listahaussa: se
// haetaan erikseen tarrojen tulostusta varten (/api/pohjat/:id/tarrat), samoin kuin
// jakolinkin ja ilmoitusjulisteen token.
export type Tarkistuspiste = {
  id: string;
  nimi: string;
  kuvaus?: string;
  jarjestys: number;
  // Pisteen tiedetty sijainti. Käytetään vain jos sijaintipakotus on päällä; muuten se
  // on vertailuluku jolla skannauksen etäisyys lasketaan todisteeksi.
  gps?: { lat: number; lon: number } | null;
};

// Pohja (templates-kokoelma). `kind` erottaa lajit — erä 8 tuo samaan kokoelmaan
// skenaariopohjat, ohjepankin ja run sheetin.
export type Kierrospohja = {
  id: string;
  kind: 'patrol';
  // Omistaja on kohteen id ja samalla oikeusavain (server/permissions.js: eventScoped).
  ownerId: string;
  nimi: string;
  kuvaus?: string;
  // Kasvaa vain kun pisteet muuttuvat, ei kun nimeä korjataan.
  versio: number;
  pisteet: Tarkistuspiste[];
  // Oletuksena pois (päätös V2 = a): sijainti tallennetaan todisteeksi mutta ei estä
  // kuittausta, koska puhelimen paikannus on rakennuksen seinustalla epäluotettava.
  sijaintiPakotus?: boolean;
  sietorajaM?: number;
  luotu?: string;
  luoja?: string;
  muokattu?: string;
  arkistoitu?: string | null;
};

export type KierroksenPiste = {
  pisteId: string;
  nimi: string;
  odotettuGps?: { lat: number; lon: number } | null;
  kuitattu: string | null;
  tapa: 'qr' | 'kasin' | null;
  gps?: { lat: number; lon: number } | null;
  etaisyysM?: number | null;
  huomio?: string;
};

// Kierroksen suoritus (patrolRuns). PALVELIMEN ylläpitämä kokoelma: kaikki muutokset
// menevät /api/kierros-reittien kautta, koska kierroksen säännöt (vajaata ei voi sulkea,
// keskeytys vaatii syyn, kuittaus on peruuttamaton) ovat sen ainoa sisältö.
export type Kierros = {
  id: string;
  siteId: string;
  templateId: string;
  templateNimi: string;
  templateVersio: number;
  vartija: string;
  alkoi: string;
  paattyi: string | null;
  tila: 'kesken' | 'valmis' | 'keskeytetty';
  keskeytysSyy?: string;
  huomiot?: string;
  pisteet: KierroksenPiste[];
};

export const uusiId = () =>
  (crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
