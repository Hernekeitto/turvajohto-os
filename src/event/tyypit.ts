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
  downloads?: number;
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
