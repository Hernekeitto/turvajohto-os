// Tapahtumapuolen tietuetyypit.
//
// App.tsx on kasvanut ilman tyyppejä, ja seuraus näkyi kääntäjässä: 150 virhettä 347:stä
// oli muotoa "Property 'x' does not exist on type 'never'". Ne kaikki tulevat samasta
// paikasta — `useState([])` ilman tyyppiparametria. TypeScript päättelee tyhjästä
// taulukosta `never[]`, jolloin jokainen kentän luku on virhe, eikä kääntäjä voi enää
// kertoa mitään hyödyllistä siitä mitä tietue oikeasti sisältää.
//
// TYYPIT ON JOHDETTU PALVELIMEN VASTAUKSISTA, ei arvattu. Jokaisen kohdalla on merkitty
// mistä reitistä tai kokoelmasta data tulee, jotta ne voi tarkistaa muutosten yhteydessä.
//
// Kentät ovat valinnaisia siellä missä palvelin ei takaa niitä: vanhoissa tietueissa on
// puuttuvia kenttiä (migraatioita on tehty useita), ja pakolliseksi merkitty kenttä joka
// voi puuttua on huonompi kuin merkitsemätön — se siirtää virheen ajoaikaan.

import type { Vyohyke } from '../shared/vyohykkeet';

// --- Käyttäjähallinta ---------------------------------------------------------------

// GET /api/users -> listUsers() (server/db.js). Salaisuudet (password_hash, totp_secret)
// eivät koskaan tule mukana, joten niitä ei ole tässäkään.
export type KayttajaRivi = {
  username: string;
  nickname?: string;
  role?: string;
  roleId?: string | null;
  // Pysyvä tunnistenumero (#1000 →), sama kuin työntekijäpankissa.
  displayId?: number | null;
  employeeId?: string | null;
  permissions?: Record<string, unknown>;
  // Tyhjä taulukko = ei tapahtumarajausta (ks. server/db.js: withDefaults).
  eventAccess?: string[];
  tuotteet?: string[];
  totpRequired?: boolean;
  // Authenticator-vaatimus levyllä. Eri kenttä kuin totpRequired: tämä on
  // käyttäjätiedoston oma nimi, jonka /api/users palauttaa sellaisenaan.
  totp_required?: boolean;
  created_at?: string;
};

// GET /api/audit. Sisältö on metadataa tapahtuneesta, ei tietueen sisältöä
// (ks. server/audit.js) — poikkeuksena tilamuutos ja korjausmerkintä.
export type AuditMerkinta = {
  ts?: string;
  user?: string;
  role?: string;
  action?: string;
  collection?: string;
  recordId?: string;
  eventId?: string | null;
  targetId?: string;
  // Toimintokohtaiset lisätiedot (statusFrom/statusTo, siirrettyTunnisteesta, ...).
  // Tarkoituksella löyhä: lisätietoja tulee lisää eikä jokaisen takia haluta muuttaa
  // tätä tyyppiä.
  [lisa: string]: unknown;
};

// --- Jakolinkit ja ilmoitukset -------------------------------------------------------

// GET /api/shares/me. HUOM: tämä EI ole fileShares-kokoelman tietue vaan palvelimen
// kokoama näkymä siitä — kohteen nimi ja tiedostolista on liitetty mukaan, ja token
// jätetty pois.
export type JaettuKohde = {
  shareId: string;
  name: string;
  type: string;
  eventId?: string | null;
  sharedBy?: string;
  sharedAt?: string;
  expiresAt?: string | null;
  files: { id: string; name: string; uploadId?: string; size?: number }[];
};

// GET /api/notifications. Kevyt reitti ilmoituskelloa varten.
export type Ilmoitus = {
  id: string;
  tyyppi: string;
  otsikko: string;
  kuvaus: string;
  aika?: string;
  eventId?: string | null;
  kohdeId?: string;
};

// fileShares-kokoelma sellaisenaan (julkinenJako peittää tokenin listahaussa).
export type Jakolinkki = {
  id: string;
  targetId: string;
  eventId?: string | null;
  // 'public' = linkki kenelle tahansa, 'users' = nimetyt käyttäjät.
  mode?: string;
  allowedUsernames?: string[];
  createdBy?: string;
  createdAt?: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  maxDownloads?: number | null;
  downloadCount?: number;
  // Pysyvä linkki vaatii pääkäyttäjän hyväksynnän.
  approvalStatus?: string;
  url?: string;
};

// --- Tapahtuman tiedostot ja lomakkeet -----------------------------------------------

// eventFiles-kokoelma: kansiot ja tiedostot samassa, `type` erottaa ne ja `parentId`
// tekee sisäkkäisyyden.
export type TapahtumanTiedosto = {
  id: string;
  type: 'folder' | 'file' | string;
  name: string;
  parentId?: string | null;
  eventId?: string | null;
  uploadId?: string;
  size?: number;
  createdAt?: string;
  createdBy?: string;
  containsPersonalData?: boolean;
};

// eventForms-kokoelma: tapahtumakohtaiset lisätyt lomakkeet ("Täytettävät lomakkeet").
// Sisäänrakennetut lomakkeet ovat koodissa, koska niissä on toiminnallisuutta.
export type TapahtumanLomake = {
  id: string;
  eventId?: string | null;
  name?: string;
  uploadId?: string;
  createdAt?: string;
  createdBy?: string;
  // Sisältääkö lomake henkilötietoa — vaikuttaa säilytykseen ja näkyvyyteen.
  containsPersonalData?: boolean;
  approvalStatus?: string;
};

// --- Oikeuseditori -------------------------------------------------------------------

// Käyttäjälle myönnetty tapahtumakohtainen pääsy oikeuksien muokkausnäkymässä.
export type TapahtumaPaasy = { id: string; name?: string };

// --- Kertanäytöt ---------------------------------------------------------------------
//
// Nämä kolme näytetään kerran ja unohdetaan: salasana ja jakolinkki eivät ole haettavissa
// uudelleen, ja TOTP-salaisuus näytetään vain käyttöönoton ajan. Siksi ne ovat tilassa
// eivätkä kokoelmassa.

// POST /api/users ja salasanan nollaus: palvelin arpoo salasanan eikä tallenna sitä
// selväkielisenä, joten tämä on ainoa hetki jolloin se on luettavissa.
export type UusiSalasana = { username: string; password: string };

// Luotu jakolinkki. `url` puuttuu kun linkki jäi odottamaan pääkäyttäjän
// hyväksyntää — silloin sitä ei ole vielä olemassa jaettavaksi.
export type LuotuLinkki = { url?: string; approvalStatus?: string };

// GET /api/users/:username/totp. qrDataUri on data:-URI (ks. csp.ts: img-src).
export type TotpTiedot = {
  secret: string;
  otpauthUri: string;
  qrDataUri: string;
  totpRequired?: boolean;
};

// --- Tapahtuma -----------------------------------------------------------------------

// events-kokoelma. Perustiedot ovat tietueen omia kenttiä, mutta aloituslomakkeen koko
// sisältö (tilaaja, vastuuhenkilöt, aikataulut, radiokanavat) on `formData`-oliossa:
// se on kymmeniä kenttiä, ja niiden nostaminen ylätasolle tarkoittaisi että jokainen
// lomakkeen muutos muuttaisi myös tietueen muotoa.
//
// `statusTone` ja `accent` ovat Tailwind-luokkia. Ne ovat datassa eivätkä koodissa,
// koska tapahtuman tila on käyttäjän valitsema eikä kiinteä lista — väri seuraa tilaa.
export type Tapahtuma = {
  id: string;
  name: string;
  status?: string;
  statusTone?: string;
  dates?: string;
  place?: string;
  audience?: string;
  client?: string;
  accent?: string;
  // Arkistointi on pehmeä: tapahtuma katoaa listalta mutta sen kirjaukset säilyvät.
  archived?: boolean;
  archivedAt?: string | null;
  // Vyöhykkeet ovat tapahtuman KENTTÄ eivätkä oma kokoelmansa (päätös V5,
  // ks. shared/vyohykkeet.ts).
  zones?: Vyohyke[];
  // Kartan kalibrointipisteet GPS:n ja kuvakoordinaatin välillä (erä 3).
  kalibrointi?: unknown[];
  // Aloituslomakkeen kentät. Löyhä tarkoituksella: lomake on laaja ja elää.
  formData?: Record<string, any>;
};

// --- Kirjaus -------------------------------------------------------------------------

// reports-kokoelma. Kenttiä on kymmeniä ja ne vaihtelevat lomaketyypeittäin (`typeId`):
// tapahtumailmoituksessa on kohdehenkilön tiedot, ensiapukirjauksessa toimenpiteet ja
// resurssit, sisäänkirjauksessa ei kumpaakaan.
//
// TYYPPI ON TARKOITUKSELLA LÖYHÄ. Se nimeää tietueen ja dokumentoi ne kentät jotka ovat
// yhteisiä kaikille — tila, vakavuus, vyöhyke, aikaleimat — mutta ei väitä tuntevansa
// jokaista lomakekohtaista kenttää. Tiukka tyyppi vaatisi oman tyypin jokaiselle
// lomakkeelle, ja se työ kannattaa tehdä silloin kun lomakkeet pilkotaan omiksi
// komponenteikseen; ennen sitä se olisi arvausta siitä mitä kenttiä missäkin on.
export type Kirjaus = {
  id: string;
  eventId?: string | null;
  // Lomaketyyppi ('jvaction', 'firstaid', ...) ja sen ihmisluettava nimi.
  typeId?: string;
  type?: string;
  // Käsittelytila vain poikkeamille: sisäänkirjausta tai sääraporttia ei suljeta
  // (ks. shared/kirjaukset.ts: POIKKEAMATYYPIT).
  status?: string | null;
  severity?: number | null;
  zoneId?: string | null;
  assignedTo?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  // Syntyhetki. Erän 1 migraatiota vanhemmilla kirjauksilla on vain date + time.
  createdAt?: string;
  date?: string;
  time?: string;
  author?: string;
  place?: string;
  summary?: string;
  attachments?: any[];
  corrections?: any[];
  location?: { img?: { x: number; y: number } | null; gps?: unknown };
  // Jonon idempotenssiavain (ks. server/kirjaukset.js: loydaSamaKirjaus).
  jonoId?: string;
  // Roskakori on pehmeä poisto: tietue säilyy ja on palautettavissa.
  deletedAt?: string | null;
  deletedBy?: string | null;
  [lisa: string]: any;
};
