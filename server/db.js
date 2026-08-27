import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateBase32Secret, encryptSecret, decryptSecret, isEncryptedSecret } from './totp.js';
import { DEFAULT_BUCKET } from './permissions.js';
import { listRoles, createRole, ROLE_ADMIN, ROLE_BASIC } from './roles.js';

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
    // Tuotepääsy: mihin puoliin tunnus pääsee ('event' = Turvajohto EVENT,
    // 'guard' = Turvajohto GUARD). Puuttuva tai tyhjä kenttä = ['event'], koska kaikki
    // olemassa olevat tunnukset on luotu tapahtumapuolta varten eikä kenenkään pääsy saa
    // muuttua kun kenttä otetaan käyttöön — sama periaate kuin eventAccessissa yllä.
    // Adminia tämä ei rajaa: hän pääsee aina molempiin (ks. server/index.js: paaseeTuotteeseen).
    tuotteet: Array.isArray(user.tuotteet) && user.tuotteet.length > 0 ? user.tuotteet : ['event'],
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

// Sijoittaa jokaisen käyttäjän käyttäjätasoon (roleId), jos sitä ei vielä ole.
//
// Siirtymäsääntö on valittu niin ETTEI KENENKÄÄN PÄÄSY MUUTU käyttöönotossa:
//   - admin-roolin käyttäjä -> sisäänrakennettu Pääkäyttäjä-taso
//   - muut -> heille luodaan OMA taso, joka kopioi heidän siihenastiset
//     käyttäjäkohtaiset sivukartta-oikeutensa sellaisenaan
// Jos ei-adminit olisi sijoitettu suoraan Peruskäyttäjä-tasoon, heidän oikeutensa
// olisivat hypänneet siihen mitä sille tasolle sattuu olemaan asetettu — joko liikaa
// tai liian vähän. Omat tasot voi yhdistellä jälkikäteen käsin.
//
// Käyttäjäkohtainen permissions-kenttä jätetään tietueeseen koskematta: se ei enää
// vaikuta mihinkään (oikeudet luetaan tasolta), mutta se on siirtymän tarkistusjälki
// eikä sen poistamisesta olisi hyötyä.
function migrateRoles(users) {
  if (users.every((u) => u.roleId)) return users;
  const tasot = listRoles();
  const nimetKaytossa = new Set(tasot.map((r) => r.name));
  return users.map((user) => {
    if (user.roleId) return user;
    if (user.role === 'admin') return { ...user, roleId: ROLE_ADMIN };
    const omat = user.permissions || {};
    // Tyhjillä oikeuksilla ei ole mitään säilytettävää — Peruskäyttäjä on parempi
    // lähtökohta kuin tyhjä oma taso, jota kukaan ei muistaisi säätää.
    const onOikeuksia = Object.values(omat).some(
      (bucket) => bucket && Object.keys(bucket).length > 0
    );
    if (!onOikeuksia) return { ...user, roleId: ROLE_BASIC };
    let nimi = `${user.nickname || user.username} (siirretty)`;
    let n = 2;
    while (nimetKaytossa.has(nimi)) {
      nimi = `${user.nickname || user.username} (siirretty ${n})`;
      n += 1;
    }
    nimetKaytossa.add(nimi);
    const luotu = createRole({
      name: nimi,
      description: 'Luotu automaattisesti käyttäjätasojen käyttöönotossa aiemmista käyttäjäkohtaisista oikeuksista.',
      permissions: omat,
    });
    return { ...user, roleId: luotu.id };
  });
}

// Tunnistenumerot alkavat #1000:sta — sama alkukohta kuin frontin työntekijäpankissa
// (src/App.tsx: TUNNISTE_ALKU). Numeroavaruus on JAETTU työntekijöiden kanssa, joten
// seuraava vapaa lasketaan aina molemmista.
const TUNNISTE_ALKU = 1000;

// Täydentää puuttuvat tunnistenumerot olemassa oleville tunnuksille. Ennen tätä
// ominaisuutta luoduilla tileillä ei ole numeroa lainkaan, eikä raporttien kirjaajatietoa
// voi muodostaa ilman sitä. Numerot jaetaan users.json:in järjestyksessä, joten
// ensimmäinen tili (Johto1) saa #1000. Jo annettuun numeroon ei kosketa koskaan:
// tallennetut raportit viittaavat siihen.
function migrateDisplayIds(users) {
  const varatut = new Set(
    users.map((u) => parseInt(String(u?.displayId ?? ''), 10)).filter((n) => Number.isFinite(n))
  );
  let seuraava = TUNNISTE_ALKU;
  return users.map((user) => {
    const nykyinen = parseInt(String(user?.displayId ?? ''), 10);
    if (Number.isFinite(nykyinen)) return user;
    while (varatut.has(seuraava)) seuraava += 1;
    varatut.add(seuraava);
    return { ...user, displayId: seuraava };
  });
}

// Jos yksikään käyttäjä ei ole admin (esim. ensimmäinen käynnistys tämän
// ominaisuuden käyttöönoton jälkeen), ylennetään taulukon ensimmäinen käyttäjä
// adminiksi ja täydelliset oikeudet ('*'). Tämä tekee migraation itsestään
// ilman että palvelimen levyllä olevaa users.json:ia pitää käsin muokata —
// ainoa tili ennen tätä ominaisuutta saa adminoikeudet automaattisesti
// seuraavalla palvelimen käynnistyksellä.
function migrateUsers(rawUsers) {
  const users = migrateDisplayIds(rawUsers.map(withDefaults));
  // Admin-bootstrap on ajettava ENNEN roolimigraatiota: muuten ensimmäinen käyttäjä
  // ylennettäisiin adminiksi vasta sen jälkeen kun migrateRoles on jo sijoittanut hänet
  // Peruskäyttäjä-tasolle, ja hän jäisi ilman hallintaoikeuksia.
  if (users.length > 0 && !users.some((u) => u.role === 'admin')) {
    users[0] = {
      ...users[0],
      role: 'admin',
      roleId: ROLE_ADMIN,
      permissions: { [DEFAULT_BUCKET]: { '*': { view: true, edit: true } } },
      totp_secret: undefined,
      totp_required: undefined,
    };
  }
  return migrateRoles(users);
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

// displayId on työntekijän pysyvä tunnistenumero (#1000 ->), joka annetaan
// työntekijäpankissa ja kopioidaan tunnukselle sen luonnin yhteydessä. Sitä EI koskaan
// muuteta jälkikäteen: raporttien kirjaajamerkintä ("Ensiapu 1 #1028") viittaa siihen,
// joten numeron vaihtuminen katkaisisi jo tallennettujen raporttien jäljitettävyyden.
// employeeId kertoo mihin työntekijäpankin tietueeseen tunnus liittyy.
export function upsertUser(username, passwordHash, { nickname, role, displayId, employeeId, roleId } = {}) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (existing) {
    existing.password_hash = passwordHash;
    if (nickname) existing.nickname = nickname;
    if (role) existing.role = role;
    if (roleId) existing.roleId = roleId;
    // Olemassa olevalle tunnukselle numero asetetaan vain jos se puuttuu kokonaan.
    if (displayId && !existing.displayId) existing.displayId = displayId;
    if (employeeId && !existing.employeeId) existing.employeeId = employeeId;
  } else {
    users.push({
      username,
      password_hash: passwordHash,
      nickname: nickname || username,
      role: role || 'user',
      // Uusi tili menee oletuksena Peruskäyttäjä-tasolle. Ensimmäisen tilin kohdalla
      // migrateUsers-bootstrap ylentää sen adminiksi seuraavassa luvussa.
      roleId: roleId || (role === 'admin' ? ROLE_ADMIN : ROLE_BASIC),
      permissions: { [DEFAULT_BUCKET]: {} },
      eventAccess: [],
      ...(displayId ? { displayId } : {}),
      ...(employeeId ? { employeeId } : {}),
      created_at: new Date().toISOString(),
    });
  }
  writeUsers(users);
}

// Osittainen päivitys nimimerkille ja/tai sivukartta-oikeuksille ja/tai tapahtumarajaukselle
// (admin muokkaa muita käyttäjiä).
// Pakottaa (tai poistaa) salasanan vaihtopakon. Lippu asetetaan aina kun pääkäyttäjä
// asettaa käyttäjälle salasanan: väliaikainen salasana on kulkenut pääkäyttäjän kautta,
// joten se ei saa jäädä käyttöön. Käyttäjän oma vaihto (updatePassword) nollaa lipun.
export function setMustChangePassword(username, required) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (!existing) return null;
  existing.must_change_password = !!required;
  writeUsers(users);
  return existing;
}

export function updateUser(username, { nickname, permissions, eventAccess, tuotteet, roleId } = {}) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (!existing) return null;
  if (nickname !== undefined) existing.nickname = nickname;
  if (permissions !== undefined) existing.permissions = permissions;
  if (eventAccess !== undefined) existing.eventAccess = eventAccess;
  if (tuotteet !== undefined) existing.tuotteet = tuotteet;
  if (roleId !== undefined) {
    existing.roleId = roleId;
    // role-kenttä ('admin' | 'user') ohjaa yhä TOTP-pakkoa, istunnon kestoa ja
    // requireAdmin-portteja, joten se pidetään synkassa tason kanssa.
    existing.role = roleId === ROLE_ADMIN ? 'admin' : 'user';
  }
  writeUsers(users);
  return existing;
}

// Käyttäjän oman salasanan vaihto (itsepalvelu) — kutsuja vastaa nykyisen salasanan tarkistuksesta.
// Merkitsee kirjautumishetken käyttäjätietueeseen. Aloitussivun "Kirjautumisaika"
// näyttää tämän — aiemmin siinä juoksi kellonaika, joka ei kertonut mitään.
// Kirjoitetaan vain onnistuneen kirjautumisen jälkeen (ks. index.js: /api/login).
export function recordLogin(username) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (!existing) return;
  existing.last_login_at = new Date().toISOString();
  writeUsers(users);
}

export function updatePassword(username, passwordHash) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (!existing) return false;
  existing.password_hash = passwordHash;
  // Oma vaihto poistaa pakon: väliaikainen salasana ei ole enää käytössä.
  // Pääkäyttäjän asettama salasana palauttaa pakon (ks. index.js: users/:username/password).
  existing.must_change_password = false;
  writeUsers(users);
  return true;
}
