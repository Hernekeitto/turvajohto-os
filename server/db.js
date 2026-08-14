import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateBase32Secret } from './totp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_PATH = path.join(DATA_DIR, 'users.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_PATH)) {
  fs.writeFileSync(USERS_PATH, JSON.stringify({ users: [] }, null, 2));
}

// Täydentää vanhan/puuttuvan datan oletuksin, jotta jokainen kutsuja saa aina
// samanmuotoisen käyttäjätietueen riippumatta siitä milloin tili on luotu.
function withDefaults(user) {
  const withRole = {
    ...user,
    nickname: user.nickname || user.username,
    role: user.role || 'user',
    permissions: user.permissions || {},
  };
  // Ei-adminit vaativat Authenticator-sovelluksen (TOTP) kirjautuessa — jokaiselle
  // ei-admin-tilille luodaan salaisuus automaattisesti jos sitä ei vielä ole, jotta
  // admin voi aina näyttää QR-koodin "Muokkaa oikeuksia" -näkymässä. Adminille ei
  // koskaan luoda salaisuutta (ei tarvitse TOTP:tä).
  if (withRole.role !== 'admin' && !withRole.totp_secret) {
    withRole.totp_secret = generateBase32Secret();
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
    users[0] = { ...users[0], role: 'admin', permissions: { '*': { view: true, edit: true } }, totp_secret: undefined };
  }
  return users;
}

function readRawUsers() {
  return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')).users;
}

function readUsers() {
  const raw = readRawUsers();
  const migrated = migrateUsers(raw);
  // Kirjoitetaan migroitu data takaisin levylle vain jos se oikeasti muuttui
  // (esim. admin-bootstrap tai puuttuvien kenttien täydennys), ettei jokainen
  // pelkkä luku turhaan kirjoita tiedostoa.
  if (JSON.stringify(migrated) !== JSON.stringify(raw)) {
    writeUsers(migrated);
  }
  return migrated;
}

function writeUsers(users) {
  // kirjoitetaan väliaikaiseen tiedostoon ja siirretään atomisesti, ettei tiedosto koskaan jää kesken
  const tmp = `${USERS_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ users }, null, 2));
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

// Palauttaa käyttäjän TOTP-salaisuuden (luodaan automaattisesti readUsers/withDefaults
// -migraatiossa jos puuttuu, joten tämä ei koskaan palauta null:ia ei-admin-käyttäjälle).
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
      permissions: {},
      created_at: new Date().toISOString(),
    });
  }
  writeUsers(users);
}

// Osittainen päivitys nimimerkille ja/tai sivukartta-oikeuksille (admin muokkaa muita käyttäjiä).
export function updateUser(username, { nickname, permissions } = {}) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (!existing) return null;
  if (nickname !== undefined) existing.nickname = nickname;
  if (permissions !== undefined) existing.permissions = permissions;
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
