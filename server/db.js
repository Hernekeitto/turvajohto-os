import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateBase32Secret, encryptSecret, decryptSecret, isEncryptedSecret } from './totp.js';
import { DEFAULT_BUCKET } from './permissions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_PATH = path.join(DATA_DIR, 'users.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_PATH)) {
  fs.writeFileSync(USERS_PATH, JSON.stringify({ users: [] }, null, 2));
}

// Sivukartta-oikeudet ovat nyt tapahtumakohtaisia: { __default__: {node:{view,edit}},
// [eventId]: {node:{view,edit}} }. __default__ on aina läsnä ja toimii oletuksena
// tapahtumille joilla ei ole omaa erillistä asetusta. Vanha (tätä ominaisuutta edeltävä)
// tallennusmuoto oli tasainen { node: {view,edit} } suoraan — sellainen tunnistetaan
// siitä ettei __default__-avainta ole, ja käärittäköön sellaisenaan __default__:ksi,
// jotta olemassa olevat oikeudet eivät katoa kun tämä otetaan käyttöön.
function migratePermissions(permissions) {
  const raw = permissions || {};
  if (Object.prototype.hasOwnProperty.call(raw, DEFAULT_BUCKET)) return raw;
  return { [DEFAULT_BUCKET]: raw };
}

// Täydentää vanhan/puuttuvan datan oletuksin, jotta jokainen kutsuja saa aina
// samanmuotoisen käyttäjätietueen riippumatta siitä milloin tili on luotu.
function withDefaults(user) {
  const withRole = {
    ...user,
    nickname: user.nickname || user.username,
    role: user.role || 'user',
    permissions: migratePermissions(user.permissions),
    // Tapahtumarajaus: tyhjä taulukko (tai puuttuva kenttä) = ei rajoitusta, käyttäjä näkee
    // kaikki tapahtumat kuten tähänkin asti — admin voi rajata tietyt käyttäjät näkemään vain
    // valitsemansa tapahtumat (ks. permissions.js: eventScoped-kokoelmat). Näin olemassa olevat
    // käyttäjät eivät menetä mitään pääsyä kun tämä kenttä otetaan käyttöön.
    eventAccess: Array.isArray(user.eventAccess) ? user.eventAccess : [],
  };
  // Ei-adminit vaativat Authenticator-sovelluksen (TOTP) kirjautuessa — jokaiselle
  // ei-admin-tilille luodaan salaisuus automaattisesti jos sitä ei vielä ole, jotta
  // admin voi aina näyttää QR-koodin "Muokkaa oikeuksia" -näkymässä. Adminille ei
  // koskaan luoda salaisuutta (ei tarvitse TOTP:tä).
  if (withRole.role !== 'admin' && !withRole.totp_secret) {
    withRole.totp_secret = generateBase32Secret();
  }
  // Vaatimus päällä oletuksena kaikille ei-admineille — admin voi ottaa pois käytöstä
  // "Muokkaa oikeuksia" -näkymästä (esim. jos käyttäjällä ei ole omaa puhelinta).
  if (withRole.role !== 'admin' && withRole.totp_required === undefined) {
    withRole.totp_required = true;
  }
  return withRole;
}

// Jos yksikään käyttäjä ei ole admin (esim. ensimmäinen käynnistys tämän
// ominaisuuden käyttöönoton jälkeen), ylennetään taulukon ensimmäinen käyttäjä
// adminiksi ja täydelliset oikeudet ('*'). Tämä tekee migraation itsestään
// ilman että palvelimen levyllä olevaa users.json:ia pitää käsin muokata —
// ainoa tili ennen tätä ominaisuutta saa adminoikeudet automaattisesti
// seuraavalla palvelimen käynnistyksellä.
function migrateUsers(rawUsers) {
  const users = rawUsers.map(withDefaults);
  if (users.length > 0 && !users.some((u) => u.role === 'admin')) {
    users[0] = {
      ...users[0],
      role: 'admin',
      permissions: { [DEFAULT_BUCKET]: { '*': { view: true, edit: true } } },
      totp_secret: undefined,
      totp_required: undefined,
    };
  }
  return users;
}

function readRawUsers() {
  return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')).users;
}

// totp_secret on levyllä aina salattuna (ks. totp.js). Kaikki muu koodi (mukaan
// lukien index.js:n suora user.totp_secret-luku login-reitillä) näkee vain
// selväkielisen arvon tämän kautta — readUsers() purkaa aina, writeUsers() salaa
// aina, joten muualla ei koskaan tarvitse tietää salauksesta mitään.
function withPlainTotp(user) {
  if (!user.totp_secret) return user;
  return { ...user, totp_secret: decryptSecret(user.totp_secret) };
}

// Vanha (tätä ominaisuutta edeltävä) data saattaa sisältää selväkielisiä
// totp_secret-arvoja levyllä — tunnistetaan enc:-etuliitteen puuttumisesta.
function needsTotpEncryption(rawUsers) {
  return rawUsers.some((u) => u.totp_secret && !isEncryptedSecret(u.totp_secret));
}

function readUsers() {
  const raw = readRawUsers();
  const migrated = migrateUsers(raw);
  const structureChanged = JSON.stringify(migrated) !== JSON.stringify(raw);
  const totpNeedsEncryption = needsTotpEncryption(raw);
  const plain = migrated.map(withPlainTotp);
  // Kirjoitetaan takaisin levylle vain jos rakenne oikeasti muuttui (esim. admin-
  // bootstrap, puuttuvien kenttien täydennys) tai jokin totp_secret oli vielä
  // selväkielisenä — ei jokaisella pelkällä luvulla (writeUsers salaa aina uudella
  // satunnaisella IV:llä, joten sama secret näyttäisi joka kerta eri salatekstiltä).
  if (structureChanged || totpNeedsEncryption) {
    writeUsers(plain);
  }
  return plain;
}

// users-parametrissa totp_secret on selväkielisenä (readUsers()-muodossa) — tämä
// funktio EI muuta users-parametria paikallaan, vaan kirjoittaa oman salatun
// kopion levylle. Tärkeää: kutsuja pitää edelleen käytössään selväkielisen olion
// (esim. resetTotpSecret palauttaa juuri luodun secretin QR-koodia varten) eikä se
// saa muuttua salatuksi tämän kutsun sivuvaikutuksena.
function writeUsers(users) {
  const forStorage = users.map((u) =>
    u.totp_secret ? { ...u, totp_secret: encryptSecret(u.totp_secret) } : u
  );
  const tmp = `${USERS_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ users: forStorage }, null, 2));
  fs.renameSync(tmp, USERS_PATH);
}

export function findUser(username) {
  return readUsers().find((u) => u.username === username) || null;
}

// Käyttäjälista ilman salasanatiivistettä tai TOTP-salaisuutta — turvallinen
// palauttaa suoraan APIsta. TOTP-salaisuus haetaan erikseen omalla admin-reitillään.
export function listUsers() {
  return readUsers().map(({ password_hash: _password_hash, totp_secret: _totp_secret, ...rest }) => rest);
}

// Palauttaa käyttäjän TOTP-salaisuuden selväkielisenä (luodaan automaattisesti
// readUsers/withDefaults-migraatiossa jos puuttuu, joten tämä ei koskaan palauta
// null:ia ei-admin-käyttäjälle).
export function getTotpSecret(username) {
  const user = findUser(username);
  return user ? user.totp_secret || null : null;
}

// Nollaa käyttäjän TOTP-salaisuuden (esim. puhelin kadonnut) — vanha Authenticator-
// merkintä lakkaa toimimasta heti.
export function resetTotpSecret(username) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (!existing) return null;
  existing.totp_secret = generateBase32Secret();
  writeUsers(users);
  return existing.totp_secret;
}

// Ottaa TOTP-vaatimuksen pois käytöstä / palauttaa sen tietylle käyttäjälle (admin
// päättää tämän "Muokkaa oikeuksia" -näkymästä). Vaikuttaa vain siihen vaaditaanko
// koodi kirjautuessa — itse salaisuus/QR säilyy ennallaan jos otetaan myöhemmin takaisin käyttöön.
export function setTotpRequired(username, required) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (!existing) return null;
  existing.totp_required = !!required;
  writeUsers(users);
  return existing;
}

// Pakottaa käyttäjän uloskirjautumaan: kaikki ennen tätä hetkeä myönnetyt evästeet
// (myös vielä voimassa olevat) mitätöityvät heti, ks. index.js:n getSessionUser.
export function forceLogout(username) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (!existing) return false;
  existing.session_invalidated_at = Date.now();
  writeUsers(users);
  return true;
}

export function upsertUser(username, passwordHash, { nickname, role } = {}) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (existing) {
    existing.password_hash = passwordHash;
    if (nickname) existing.nickname = nickname;
    if (role) existing.role = role;
  } else {
    users.push({
      username,
      password_hash: passwordHash,
      nickname: nickname || username,
      role: role || 'user',
      permissions: { [DEFAULT_BUCKET]: {} },
      eventAccess: [],
      created_at: new Date().toISOString(),
    });
  }
  writeUsers(users);
}

// Osittainen päivitys nimimerkille ja/tai sivukartta-oikeuksille ja/tai tapahtumarajaukselle
// (admin muokkaa muita käyttäjiä).
export function updateUser(username, { nickname, permissions, eventAccess } = {}) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (!existing) return null;
  if (nickname !== undefined) existing.nickname = nickname;
  if (permissions !== undefined) existing.permissions = permissions;
  if (eventAccess !== undefined) existing.eventAccess = eventAccess;
  writeUsers(users);
  return existing;
}

// Käyttäjän oman salasanan vaihto (itsepalvelu) — kutsuja vastaa nykyisen salasanan tarkistuksesta.
export function updatePassword(username, passwordHash) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (!existing) return false;
  existing.password_hash = passwordHash;
  writeUsers(users);
  return true;
}
