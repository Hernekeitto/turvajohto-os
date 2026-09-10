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
  // KÄYTTÄJÄTUNNUS ON PÄÄSYN EHTO, NIMI EI (päätös 10.9.2026).
  //
  // Nimi jää tietueeseen sellaisenaan edellä kuvatusta syystä, mutta se ei kelpaa
  // tunnisteeksi: kaksi Virtasta on tavallisempaa kuin yksi. Perehdytys myöntää pääsyn
  // vain jos tämä kenttä osoittaa siihen tunnukseen jolla vartija kirjautuu.
  // Ilman sitä tietue on yhä pätevä dokumentti mutta ei avaa mitään — ja se on
  // näytettävä käyttöliittymässä erikseen merkittynä, koska muuten se näyttää toimivalta.
  username?: string;
  employeeId?: string;
  displayId?: number | null;
  pvm: string;
  perehdyttaja?: string;
  // Mihin kohteen vuorotyyppeihin tämä perehdytys pätee.
  //
  // TYHJÄ LISTA TARKOITTAA EI YHTÄÄN, EI KAIKKIA. Tämä on tarkoituksellinen poikkeus
  // eventAccess-käytännöstä, jossa tyhjä lista tarkoittaa "ei rajausta". Sama sopimus
  // tässä olisi vaarallinen: puolivalmis merkintä myöntäisi hiljaa pääsyn jokaiseen
  // vuoroon, ja virhe näyttäisi täsmälleen samalta kuin harkittu päätös.
  vuorotyyppiIdt?: string[];
  // Varattu vanhenemiselle. EI OLE VOIMASSA: päätös 10.9.2026 oli ettei perehdytys
  // vanhene v1:ssä. Kenttä on tässä jotta vanheneminen voidaan ottaa käyttöön ilman
  // migraatiota — ja server/vuorot.test.js pitää huolen siitä ettei kukaan luule sen
  // vaikuttavan ennen kuin sääntö kirjoitetaan.
  voimassaAsti?: string | null;
};

// Kohteen vuorotyyppi: se vuoro johon vartija kirjautuu, ja se mitä vuoroon kuuluu.
//
// Kohteen kenttä eikä oma kokoelmansa, samasta syystä kuin vyöhykkeet ja tehtävät
// (päätös V5): vuorotyyppi ei elä ilman kohdetta, sitä ei jaeta kohteiden välillä eikä
// sillä ole omaa elinkaartaan.
//
// VIITTAUS EIKÄ KOPIO. Tehtävät ja kierrospohjat ovat tässä id:llä. Kopio vanhentuisi
// hiljaa: tehtävän tekstiä korjattaisiin kohteen hallinnassa ja vuoro näyttäisi yhä
// vanhaa. Kopio otetaan vasta vuoron alkaessa (erä 17), samoin kuin kierros kopioi
// pisteensä pohjasta.
export type Vuorotyyppi = {
  id: string;
  nimi: string;
  kuvaus?: string;
  // Ohjeelliset kellonajat muodossa "07:00". Rajoittavat kirjautumista jouston verran
  // molempiin suuntiin (server/vuorot.js) — mutta puuttuva aika ei ole virhe: kellonajaton
  // lisävuoro on olemassa, eikä puuttuva rajoite saa muuttua rajoitteeksi.
  alkaa?: string;
  paattyy?: string;
  tehtavaIdt?: string[];
  pohjaIdt?: string[];
  arkistoitu?: boolean;
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
  vuorotyypit?: Vuorotyyppi[];
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
  // Kumpi tarra pisteelle tulostetaan. Oletus 'qr' — se oli ainoa vaihtoehto ennen, ja
  // oletuksen muuttaminen vaihtaisi vanhojen pohjien tarrat lajista toiseen.
  //
  // QR sisältää osoitteen /guard?piste=<token>, jonka puhelimen oma kamera avaa.
  // Code-128 sisältää viivakoodin, joka luetaan sovelluksen skannerilla tai talon
  // käsiskannerilla. Token on 43 merkkiä eikä mahdu viivakoodiin luettavan levyisenä,
  // joten viivakoodilla on oma lyhyt tunnisteensa.
  koodi?: 'qr' | 'code128';
  // Viivakoodin sisältö. Palvelin luo sen (TJ + 10 merkkiä) tai käyttäjä kirjoittaa
  // kohteessa jo olevan tarran sisällön. EI salaisuus toisin kuin token: se näkyy
  // pohjan hallinnassa ja tulostuu tarraan.
  viivakoodi?: string;
  // true = piste kuitataan VAIN lukemalla koodi, käsin kuittaus on estetty. Sääntö
  // tarkistetaan palvelimella (server/kierros.js), ei pelkästään piilottamalla painike.
  vaadiKoodi?: boolean;
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
  // Kopioidaan pohjasta kierroksen alkaessa: kesken kierroksen tehty pohjan muokkaus ei
  // saa muuttaa sitä millä ehdoilla tätä kierrosta kuitataan.
  vaadiKoodi?: boolean;
  kuitattu: string | null;
  tapa: 'qr' | 'viivakoodi' | 'kasin' | null;
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
