// Käyttäjätasot (roolit) ja niiden sivukartta-oikeudet.
//
// Oikeusmalli: TASO MÄÄRÄÄ KAIKEN. Käyttäjällä on tasan yksi taso (users.json: roleId),
// ja hänen sivukartta-oikeutensa tulevat yksinomaan sen tason permissions-oliosta.
// Käyttäjäkohtaisia sivukartta-oikeuksia ei enää lueta — näin yhdestä paikasta näkee
// kenellä on mitkä oikeudet, eikä efektiivisiä oikeuksia tarvitse laskea kahdesta
// lähteestä. (Tapahtumarajaus eventAccess pysyy käyttäjäkohtaisena: se on eri asia kuin
// "mitä sivuja saa käyttää" ja vaihtelee henkilöittäin saman tason sisällä.)
//
// Tason permissions on tismalleen samaa muotoa kuin käyttäjän vanha permissions oli:
// { __default__: { [nodeId]: { view, edit } }, [eventId]: { ... } }. Näin permissions.js:n
// canView/canEdit toimivat sellaisenaan eikä oikeustarkistuslogiikkaa tarvinnut muuttaa.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_BUCKET } from './permissions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ROLES_PATH = path.join(DATA_DIR, 'roles.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

// Sisäänrakennettujen tasojen tunnisteet. Näitä ei voi poistaa: ADMIN on ainoa reitti
// täysiin oikeuksiin, ja BASIC/VIEWER ovat oletukset joihin uudet käyttäjät sijoitetaan.
export const ROLE_ADMIN = 'admin';
export const ROLE_BASIC = 'basic';
export const ROLE_VIEWER = 'viewer';
// Vartija on GUARD-puolen vastine Peruskäyttäjälle. Se on sisäänrakennettu eikä
// asennuskohtainen lisäys, jotta se ilmestyy myös jo käytössä oleviin asennuksiin
// (withBuiltins luo puuttuvat takaisin) — muuten GUARDin käyttöönotto vaatisi tason
// rakentamisen käsin joka asennuksessa erikseen.
export const ROLE_GUARD = 'vartija';
// Vartioesimies on Vartija + kohteen hallinta. Oma tasonsa eikä pelkkä ohje "kopioi
// Vartija ja lisää yksi rasti", koska työnjako vartijan ja esimiehen välillä on sama
// jokaisessa asennuksessa — ja käsin rakennettu taso eroaisi joka kerta hieman.
export const ROLE_GUARD_LEAD = 'vartioesimies';
const BUILTIN_IDS = new Set([ROLE_ADMIN, ROLE_BASIC, ROLE_VIEWER, ROLE_GUARD, ROLE_GUARD_LEAD]);

// Sivukartan solmut, joita Peruskäyttäjä saa oletuksena muokata. Nämä ovat operatiivista
// työtä (kirjaukset, suunnittelu, asiakirjat) — eivät hallintaa (settings, global_*).
// HUOM: lista on vain OLETUS uudelle asennukselle; tasoja säädetään Asetukset-näkymästä.
const PERUS_MUOKKAUS = [
  'overview',
  'reporting', 'report_jv', 'report_tike', 'report_list',
  'tike_form_in', 'tike_form_out', 'tike_form_jvaction', 'tike_form_open', 'tike_form_firstaid',
  'tike_form_threat', 'tike_form_fence', 'tike_form_damage', 'tike_form_lostfound', 'tike_form_patrol',
  'tike_form_queue', 'tike_form_weather', 'tike_form_briefing', 'tike_form_management',
  'planning', 'planning_readiness', 'planning_employees',
  'postevent',
  'documents', 'documents_forms', 'documents_pdf', 'documents_trash', 'documents_emergency',
  'documents_risk', 'documents_risk_done', 'documents_risk_new',
  // Tapahtuman tiedostot on operatiivista työtä: kansioiden ja tiedostojen hallinta
  // sekä niiden jakaminen kuuluvat samaan joukkoon kuin kirjaukset ja asiakirjat.
  'eventfiles',
];

// Sivukartan solmut jotka Katselija näkee. Kaikki paitsi hallinta: 'settings' ja
// työntekijäpankki (henkilöstön arkaluontoiset tiedot) jäävät pois.
const KATSELU_NAKYVA = [
  'landing',
  ...PERUS_MUOKKAUS,
  'global_reports', 'global_archived_events',
];

// GUARD-puolen solmut Vartija-tasolle (ks. src/guard/sivukartta.ts). Työnjako on sama kuin
// tapahtumapuolella: vartija tekee työvuoron mutta ei hallinnoi kohdetta.
//
// Kohteen hallinta (guard_sites edit) kattaa kohteen perustiedot, tiedostot,
// perehdytysmerkinnät ja tehtäväpohjat — ne ovat esimiehen työtä, joten vartijalle jää
// niihin vain katseluoikeus. Ilman guard_sites-näkyvyyttä hän ei pääsisi yhteenkään
// kohteeseen, koska kohdevalinta on ainoa reitti sinne.
// `guard_site_assets` on tässä eikä ESIMIES_KATSELUssa: vartija näkee kaluston mutta
// VAIN sen kohteen jossa hän on juuri nyt vuorossa, ja ilman luovutusketjua (rajaus
// tehdään index.js:ssä, sääntö kalusto.js:ssä). Se on eri oikeus kuin pankin selaaminen
// — siksi oma solmunsa eikä guard_assets kapeampana.
const VARTIJA_KATSELU = ['guard_sites', 'guard_site_info', 'guard_reporting', 'guard_site_assets'];
// Työvuoron tekeminen: tehtävien kuittaus ja omien raporttien kirjaaminen. Tapahtumailmoitus
// on mukana, koska sen kirjaa se joka toimenpiteen teki — jos kirjaus kuuluu jossain
// organisaatiossa vain esimiehelle, oikeus otetaan pois Sovellusasetuksista.
const VARTIJA_MUOKKAUS = ['guard_tasks', 'guard_report_action', 'guard_report_jv'];
// Se mitä Vartioesimiehellä on Vartijan lisäksi: kohteen hallinta. Yksi solmu kattaa
// kohteen perustiedot, tiedostot, perehdytysmerkinnät ja tehtäväpohjat (ks.
// server/permissions.js: guardSites ja guardFiles käyttävät samaa touch-solmua).
//
// HUOM: perehdytettävän valinta työntekijäpankista vaatisi lisäksi EVENT-puolen
// 'global_employee_bank'-solmun. Sitä EI anneta oletuksena: se avaisi koko yrityksen
// henkilöstörekisterin GUARD-tunnukselle, ja käyttöliittymässä on tätä tilannetta varten
// vapaa nimikenttä (src/guard/KohteenHallinta.tsx). Pudotusvalikon saa käyttöön
// lisäämällä solmun tasolle Sovellusasetuksista.
const ESIMIES_MUOKKAUS = ['guard_sites'];
// Kalustopankki Vartioesimiehelle: KATSELUOIKEUS, ei muokkausta. Se on tarkoituksellinen
// puolikas eikä unohdus — lukuoikeus riittää pyyntöön ("tähän kohteeseen tarvitaan kolme
// paria käsirautoja"), ja jyvitys jää pääkäyttäjälle (server/index.js: saaHallitaPankkia).
// Näin pankki pysyy yhden ihmisen kirjanpitona vaikka pyytäjiä on monta.
//
// Vartija ei saa solmua lainkaan: pankki on kohteiden yli menevä rekisteri (GLOBAL_NODES),
// joten sen näkeminen kertoisi mitä kalustoa on missäkin kohteessa ja kenen vartijan
// hallussa — myös niissä kohteissa joihin vartijan eventAccess ei ulotu.
const ESIMIES_KATSELU = ['guard_assets'];

function bucketista(nodeIds, { view, edit }) {
  return Object.fromEntries(nodeIds.map((id) => [id, { view, edit }]));
}

function oletusTasot() {
  return [
    {
      id: ROLE_ADMIN,
      name: 'Pääkäyttäjä',
      description: 'Kaikki oikeudet kaikkiin sivuihin ja hallintatoimintoihin.',
      builtin: true,
      permissions: { [DEFAULT_BUCKET]: { '*': { view: true, edit: true } } },
    },
    {
      id: ROLE_BASIC,
      name: 'Peruskäyttäjä',
      description: 'Operatiivinen työ: kirjaukset, suunnittelu ja asiakirjat. Ei hallintaa.',
      builtin: true,
      permissions: {
        [DEFAULT_BUCKET]: {
          ...bucketista(['landing', 'global_reports', 'global_archived_events'], { view: true, edit: false }),
          ...bucketista(PERUS_MUOKKAUS, { view: true, edit: true }),
        },
      },
    },
    {
      id: ROLE_GUARD,
      name: 'Vartija',
      description:
        'Turvajohto GUARD: työvuoron tehtävät ja omat raportit. Ei kohteiden hallintaa '
        + 'eikä tapahtumapuolen sivuja.',
      builtin: true,
      permissions: {
        [DEFAULT_BUCKET]: {
          ...bucketista(VARTIJA_KATSELU, { view: true, edit: false }),
          ...bucketista(VARTIJA_MUOKKAUS, { view: true, edit: true }),
        },
      },
    },
    {
      id: ROLE_GUARD_LEAD,
      name: 'Vartioesimies',
      description:
        'Turvajohto GUARD: kohteiden hallinta, perehdytykset ja tehtäväpohjat sekä kaikki '
        + 'vartijan oikeudet. Ei tapahtumapuolen sivuja.',
      builtin: true,
      permissions: {
        [DEFAULT_BUCKET]: {
          ...bucketista(VARTIJA_KATSELU, { view: true, edit: false }),
          ...bucketista(ESIMIES_KATSELU, { view: true, edit: false }),
          ...bucketista(VARTIJA_MUOKKAUS, { view: true, edit: true }),
          // Viimeisenä, koska tämä nostaa guard_sitesin muokattavaksi — sama solmu on
          // VARTIJA_KATSELUssa pelkkänä katseluoikeutena.
          ...bucketista(ESIMIES_MUOKKAUS, { view: true, edit: true }),
        },
      },
    },
    {
      id: ROLE_VIEWER,
      name: 'Katselija',
      description: 'Näkee tiedot mutta ei voi muokata mitään.',
      builtin: true,
      permissions: { [DEFAULT_BUCKET]: bucketista(KATSELU_NAKYVA, { view: true, edit: false }) },
    },
  ];
}

function readRaw() {
  if (!fs.existsSync(ROLES_PATH)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(ROLES_PATH, 'utf8'));
    return Array.isArray(parsed?.roles) ? parsed.roles : null;
  } catch {
    // Rikkinäistä tiedostoa EI korvata hiljaa oletuksilla: se antaisi kaikille
    // oletusoikeudet huomaamatta. Kaatuminen on turvallisempi kuin väärät oikeudet.
    throw new Error(`roles.json on vioittunut (${ROLES_PATH}). Palvelinta ei käynnistetä.`);
  }
}

function writeRoles(roles) {
  const tmp = `${ROLES_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ roles }, null, 2));
  fs.renameSync(tmp, ROLES_PATH);
}

// Varmistaa että sisäänrakennetut tasot ovat aina olemassa. Jos ne on poistettu tai
// tiedostoa ei ole, ne luodaan takaisin — ilman ROLE_ADMINia kukaan ei pääsisi
// hallintaan enää koskaan.
function withBuiltins(roles) {
  const olemassa = new Map(roles.map((r) => [r.id, r]));
  // Puuttuvat lisätään loppuun oletusTasot():n järjestyksessä. Loppuun eikä alkuun, jotta
  // myöhemmin lisätty sisäänrakennettu taso (esim. Vartija) ei hyppää olemassa olevan
  // asennuksen listassa Pääkäyttäjän edelle.
  const tulos = [...roles, ...oletusTasot().filter((oletus) => !olemassa.has(oletus.id))];
  // Pääkäyttäjän oikeuksia ei voi rajata: '*' palautetaan aina.
  return tulos.map((r) =>
    r.id === ROLE_ADMIN
      ? { ...r, builtin: true, permissions: { [DEFAULT_BUCKET]: { '*': { view: true, edit: true } } } }
      : { ...r, builtin: BUILTIN_IDS.has(r.id) }
  );
}

export function listRoles() {
  const raw = readRaw();
  const roles = withBuiltins(raw || []);
  if (!raw || JSON.stringify(roles) !== JSON.stringify(raw)) writeRoles(roles);
  return roles;
}

export function findRole(id) {
  return listRoles().find((r) => r.id === id) || null;
}

// Tason sivukartta-oikeudet. Tuntematon taso ei saa mitään: jos käyttäjän roleId
// osoittaa poistettuun tasoon, oikea käytös on evätä pääsy eikä antaa oletuksia.
export function rolePermissions(roleId) {
  const role = findRole(roleId);
  return role ? role.permissions : { [DEFAULT_BUCKET]: {} };
}

function slugify(nimi) {
  return String(nimi || '')
    .toLowerCase()
    .replace(/[äå]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function createRole({ name, description, permissions }) {
  const roles = listRoles();
  const pohja = slugify(name) || 'taso';
  let id = pohja;
  let n = 2;
  while (roles.some((r) => r.id === id)) {
    id = `${pohja}-${n}`;
    n += 1;
  }
  const uusi = {
    id,
    name: String(name).trim(),
    description: String(description || '').trim(),
    builtin: false,
    permissions: permissions || { [DEFAULT_BUCKET]: {} },
  };
  writeRoles([...roles, uusi]);
  return uusi;
}

export function updateRole(id, { name, description, permissions }) {
  const roles = listRoles();
  const rooli = roles.find((r) => r.id === id);
  if (!rooli) return null;
  // Pääkäyttäjän oikeuksia ei voi muokata (ks. withBuiltins) — nimen ja kuvauksen voi.
  if (name !== undefined) rooli.name = String(name).trim();
  if (description !== undefined) rooli.description = String(description).trim();
  if (permissions !== undefined && id !== ROLE_ADMIN) rooli.permissions = permissions;
  writeRoles(roles);
  return rooli;
}

export function deleteRole(id) {
  if (BUILTIN_IDS.has(id)) return { ok: false, error: 'Sisäänrakennettua käyttäjätasoa ei voi poistaa.' };
  const roles = listRoles();
  if (!roles.some((r) => r.id === id)) return { ok: false, error: 'Käyttäjätasoa ei löytynyt.' };
  writeRoles(roles.filter((r) => r.id !== id));
  return { ok: true };
}
