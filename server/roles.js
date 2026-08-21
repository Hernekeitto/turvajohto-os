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
const BUILTIN_IDS = new Set([ROLE_ADMIN, ROLE_BASIC, ROLE_VIEWER]);

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
];

// Sivukartan solmut jotka Katselija näkee. Kaikki paitsi hallinta: 'settings' ja
// työntekijäpankki (henkilöstön arkaluontoiset tiedot) jäävät pois.
const KATSELU_NAKYVA = [
  'landing',
  ...PERUS_MUOKKAUS,
  'global_reports', 'global_archived_events',
];

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
  const tulos = [...roles];
  for (const oletus of oletusTasot()) {
    if (!olemassa.has(oletus.id)) tulos.unshift(oletus);
  }
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
