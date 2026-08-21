import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import {
  findUser,
  listUsers,
  upsertUser,
  updateUser,
  updatePassword,
  setMustChangePassword,
  recordLogin,
  getTotpSecret,
  resetTotpSecret,
  setTotpRequired,
  forceLogout,
} from './db.js';
import { readCollection, writeCollection, KNOWN_COLLECTIONS, getStorageUsage } from './store.js';
import { isAllowedFile, saveUpload, getUploadPath, deleteUpload, collectGarbage } from './uploads.js';
import { verifyTotp, buildOtpauthUri } from './totp.js';
import { listRoles, findRole, createRole, updateRole, deleteRole, rolePermissions, ROLE_ADMIN } from './roles.js';
import {
  COLLECTION_NAMES,
  readableData,
  authorizeWrite,
  canReadAttachment,
  canUploadAttachment,
} from './permissions.js';
import { logAudit, readAuditLog } from './audit.js';
import { validateRecords, wouldWipeNonEmptyCollection } from './validation.js';

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'tj_session';
// Admin: kiinteä 12h istunto (ei automaattista uloskirjausta käyttämättömyydestä).
// Muut käyttäjät: 1h *liukuva* istunto — jokainen kirjautunut pyyntö (requireAuth)
// pidentää evästeen voimassaoloa uudelleen tunnilla eteenpäin, joten aktiivikäyttö
// ei koskaan katkea, mutta tunnin käyttämättömyys kirjaa automaattisesti ulos.
const ADMIN_SESSION_HOURS = 12;
const USER_SESSION_MINUTES = 60;

if (!JWT_SECRET) {
  console.error('JWT_SECRET puuttuu ympäristömuuttujista. Palvelinta ei käynnistetä.');
  process.exit(1);
}

// Varmistaa käynnistyksessä ettei store.js:ään voi jäädä lisätä kokoelma jolle
// permissions.js:stä puuttuu oikeussäännöt — muuten uusi kokoelma päätyisi vahingossa
// suojaamattomaksi (sama virhe kuin tämän tarkistuksen alkuperäinen puuttuminen).
{
  const missingRules = KNOWN_COLLECTIONS.filter((name) => !COLLECTION_NAMES.includes(name));
  if (missingRules.length > 0) {
    console.error(`permissions.js: puuttuvat oikeussäännöt kokoelmille: ${missingRules.join(', ')}. Palvelinta ei käynnistetä.`);
    process.exit(1);
  }
}

const app = express();
app.set('trust proxy', 1); // nginx on edessä
app.use(express.json({ limit: '5mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB / tiedosto
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liian monta tiedostolähetystä. Yritä myöhemmin uudelleen.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liian monta yritystä. Yritä myöhemmin uudelleen.' },
});

// Sama sääntö kuin frontin salasanavalidoinnissa (App.tsx) — backend on todellinen portti,
// frontin tarkistus on vain välitöntä käyttäjäpalautetta varten.
// Pääkäyttäjän luoma salasana arvotaan palvelimella eikä sitä koskaan kirjoiteta
// selaimessa: se annetaan käyttäjälle kertaalleen ja vaihdetaan heti ensimmäisellä
// kirjautumisella (must_change_password). Merkistöstä on jätetty pois helposti
// sekoittuvat 0/O ja 1/l/I, koska salasana luetaan usein ruudulta paperille.
const SALASANA_ISOT = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const SALASANA_PIENET = 'abcdefghijkmnopqrstuvwxyz';
const SALASANA_NUMEROT = '23456789';

function arvoSalasana(pituus = 14) {
  const kaikki = SALASANA_ISOT + SALASANA_PIENET + SALASANA_NUMEROT;
  // Vähintään yksi kustakin ryhmästä, jotta arvottu salasana läpäisee aina
  // isValidPassword-tarkistuksen — muuten luonti voisi satunnaisesti epäonnistua.
  const pakolliset = [
    SALASANA_ISOT[crypto.randomInt(SALASANA_ISOT.length)],
    SALASANA_PIENET[crypto.randomInt(SALASANA_PIENET.length)],
    SALASANA_NUMEROT[crypto.randomInt(SALASANA_NUMEROT.length)],
  ];
  const loput = Array.from({ length: Math.max(0, pituus - pakolliset.length) },
    () => kaikki[crypto.randomInt(kaikki.length)]);
  const merkit = [...pakolliset, ...loput];
  // Fisher-Yates satunnaisella indeksillä: ilman sekoitusta pakolliset merkit
  // olisivat aina kolmessa ensimmäisessä paikassa.
  for (let i = merkit.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [merkit[i], merkit[j]] = [merkit[j], merkit[i]];
  }
  return merkit.join('');
}

function isValidPassword(pw) {
  return typeof pw === 'string' && pw.length >= 10 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
}

function setSessionCookie(res, username, role) {
  const maxAgeSeconds = role === 'admin' ? ADMIN_SESSION_HOURS * 60 * 60 : USER_SESSION_MINUTES * 60;
  const token = jwt.sign({ sub: username }, JWT_SECRET, { expiresIn: maxAgeSeconds });
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
    })
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  );
}

function getSessionUser(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  const user = findUser(payload.sub);
  if (!user) return null;
  // Admin on painanut "Kirjaa käyttäjä ulos" -painiketta — kaikki ennen sitä hetkeä
  // myönnetyt evästeet (myös vielä muuten voimassa olevat) mitätöityvät välittömästi,
  // eikä uutta evästettä tietenkään anneta ennen kuin käyttäjä kirjautuu uudelleen.
  if (user.session_invalidated_at && payload.iat * 1000 < user.session_invalidated_at) {
    return null;
  }
  return payload.sub;
}

// Kirjautuminen kahdessa vaiheessa ei-admin-käyttäjille: käyttäjätunnus+salasana
// riittävät admin-tilille (ei koskaan vaadi TOTP:tä), mutta muille tarvitaan lisäksi
// voimassa oleva 6-numeroinen Authenticator-koodi. Toteutettu yhtenä tilattomana
// reittinä — jos totpCode puuttuu (tai on väärä), vastataan requiresTotp:true eikä
// evästettä aseteta; frontend näyttää silloin koodikentän ja lähettää saman
// käyttäjätunnuksen+salasanan uudelleen koodin kera.
//
// Kirjautumisyritykset lokitetaan audit-lokiin (onnistuneet ja epäonnistuneet) —
// tietoturvamielessä oleellinen tieto, ja rate limiter (10/15min/IP) pitää lokin
// koon kurissa vaikka joku yrittäisi arvata salasanoja.
app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password, totpCode } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'Käyttäjätunnus ja salasana vaaditaan.' });
  }

  const user = findUser(username);
  const valid = user ? bcrypt.compareSync(password, user.password_hash) : false;

  if (!valid) {
    logAudit({ user: username, action: 'login_failed', reason: 'bad_credentials', ip: req.ip });
    return res.status(401).json({ ok: false, error: 'Väärä käyttäjätunnus tai salasana.' });
  }

  if (user.role !== 'admin' && user.totp_required !== false) {
    if (!totpCode) {
      return res.json({ ok: true, requiresTotp: true, username: user.username });
    }
    if (!verifyTotp(user.totp_secret, totpCode)) {
      logAudit({ user: username, action: 'login_failed', reason: 'bad_totp', ip: req.ip });
      return res.status(401).json({ ok: false, requiresTotp: true, error: 'Väärä tai vanhentunut Authenticator-koodi.' });
    }
  }

  logAudit({ user: username, action: 'login_success', ip: req.ip });
  recordLogin(user.username);
  setSessionCookie(res, user.username, user.role);
  // mustChangePassword kertoo frontille että istunto on käytettävissä vasta kun
  // käyttäjä on vaihtanut pääkäyttäjän asettaman väliaikaisen salasanan omakseen.
  res.json({ ok: true, username: user.username, mustChangePassword: !!user.must_change_password });
});

app.post('/api/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  const username = getSessionUser(req);
  if (!username) return res.json({ authenticated: false, username: null });
  // Käyttäjän profiili (nimimerkki, rooli, sivukartta-oikeudet) luetaan aina tuoreena
  // levyltä eikä JWT:hen leivottuna, jotta admin voi muuttaa oikeuksia ilman että
  // käyttäjän pitää kirjautua uudelleen — muutos näkyy seuraavalla sivunlatauksella.
  const user = findUser(username);
  if (!user) return res.json({ authenticated: false, username: null });
  // Frontin käyttämättömyysvahti kutsuu tätä reittiä aina kun se havaitsee aktiivisuutta
  // (hiiri/näppäimistö) — tämä pitää ei-adminin liukuvan istunnon voimassa niin kauan
  // kuin sovellusta oikeasti käytetään.
  if (user.role !== 'admin') setSessionCookie(res, user.username, user.role);
  res.json({
    authenticated: true,
    username: user.username,
    nickname: user.nickname,
    // Pysyvä tunnistenumero (#1000 ->). Frontti liittää sen raporttien kirjaajatietoon
    // tapahtumakohtaisen nimimerkin perään, esim. "Ensiapu 1 #1028".
    displayId: user.displayId || null,
    employeeId: user.employeeId || null,
    mustChangePassword: !!user.must_change_password,
    role: user.role,
    permissions: rolePermissions(user.roleId),
    roleId: user.roleId || null,
    roleName: findRole(user.roleId)?.name || null,
    eventAccess: user.eventAccess,
    // Tämän istunnon kirjautumishetki. EI johdeta JWT:n iat-kentästä, koska
    // ei-adminin istunto on liukuva: token uusitaan tässä samassa reitissä,
    // jolloin iat siirtyisi eteenpäin eikä kertoisi enää kirjautumisajasta.
    lastLoginAt: user.last_login_at || null,
  });
});

function requireAuth(req, res, next) {
  const username = getSessionUser(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Kirjaudu sisään.' });
  const user = findUser(username);
  if (!user) return res.status(401).json({ ok: false, error: 'Kirjaudu sisään.' });
  // Pakkovaihto: kunnes käyttäjä on vaihtanut pääkäyttäjän asettaman väliaikaisen
  // salasanan omakseen, istunnolla ei saa tehdä mitään muuta. Tämä on TÄRKEÄ olla
  // palvelimella eikä vain käyttöliittymässä — pelkkä frontin modaali olisi ohitettavissa
  // devtoolsilla tai curlilla. Sallittuja ovat vain oma salasananvaihto, istunnon luku
  // ja uloskirjautuminen.
  const sallittuVaihdonAikana =
    req.path === '/api/change-password' || req.path === '/api/session' || req.path === '/api/logout';
  if (user.must_change_password && !sallittuVaihdonAikana) {
    return res.status(403).json({
      ok: false,
      mustChangePassword: true,
      error: 'Vaihda salasana ennen kuin jatkat.',
    });
  }
  req.username = username;
  req.role = user.role;
  // Sivukartta-oikeudet tulevat KÄYTTÄJÄTASOLTA, eivät enää käyttäjätietueesta: taso
  // määrää kaiken (ks. roles.js). Tapahtumarajaus (eventAccess) pysyy käyttäjäkohtaisena,
  // koska se vaihtelee henkilöittäin saman tason sisällä.
  // Luetaan tuoreena joka pyynnöllä, jotta tason muokkaus vaikuttaa heti ilman
  // uudelleenkirjautumista — sama periaate kuin aiemmin käyttäjän omilla oikeuksilla.
  req.permissions = rolePermissions(user.roleId);
  req.eventAccess = user.eventAccess;
  // Liukuva istunto: jokainen onnistunut kirjautunut pyyntö ei-adminilta pidentää
  // evästeen voimassaoloa uudelleen USER_SESSION_MINUTES eteenpäin. Admin pysyy
  // kiinteässä 12h istunnossa, ei koske automaattinen käyttämättömyyskatkaisu.
  if (user.role !== 'admin') setSessionCookie(res, user.username, user.role);
  next();
}

function requireAdmin(req, res, next) {
  const user = findUser(req.username);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Vaatii pääkäyttäjän oikeudet.' });
  }
  next();
}

// Jaettu data (kirjaukset, raportit ym.) — koko sisältö korvataan joka tallennuksella,
// samaan tapaan kuin selaimen localStorage aiemmin toimi, mutta nyt kaikkien käyttäjien
// kesken jaettuna palvelimella. Huom: kaksi samanaikaista tallentajaa voi ylikirjoittaa
// toisensa muutokset (viimeisin voittaa) — riittää pienelle tiimille, mutta ei ole
// rakennettu ristiriitojen yhdistämiseen.
// Sivukartta-oikeudet JA tapahtumarajaus (eventAccess) tarkistetaan tässä palvelinpuolella
// (ks. permissions.js) — frontin canView/canEdit suodattavat vain käyttöliittymän, eivät
// suojaa itse dataa. Oikeudet voivat nyt vaihdella tapahtumittain (sama käyttäjä voi nähdä/
// muokata eri asioita FestivaaliX:ssä kuin FestivaaliÖ:ssä), joten GET suodattaa jokaisen
// tapahtumasidotun kokoelman tietue kerrallaan (eventAccess JA kyseisen tietueen oman
// tapahtuman Sivukartta-oikeus yhdessä), ja PUT tarkistetaan samoin tietue kerrallaan sen
// mukaan mitä oikeasti muuttuu.
app.get('/api/data/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  if (!KNOWN_COLLECTIONS.includes(name)) {
    return res.status(404).json({ ok: false, error: 'Tuntematon kokoelma.' });
  }
  const result = readableData(req.role, req.permissions, req.eventAccess, name, readCollection(name));
  if (!result.ok) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän tiedon lukemiseen.' });
  }
  res.json({ ok: true, data: result.data });
});

app.put('/api/data/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  if (!KNOWN_COLLECTIONS.includes(name)) {
    return res.status(404).json({ ok: false, error: 'Tuntematon kokoelma.' });
  }
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ ok: false, error: 'Odotettiin taulukkoa.' });
  }
  // Rakennevalidointi ennen oikeustarkistusta/kirjoitusta — ks. validation.js.
  const recordCheck = validateRecords(req.body);
  if (!recordCheck.ok) {
    return res.status(400).json(recordCheck);
  }
  const current = readCollection(name) || [];
  const verdict = authorizeWrite(req.role, req.permissions, req.eventAccess, name, current, req.body);
  if (!verdict.ok) {
    return res.status(403).json(verdict);
  }
  // Romahdussuoja: tarkistetaan levylle päätyvä lopullinen data (verdict.data, joka
  // tapahtumarajatulle käyttäjälle voi sisältää outOfScope-osan) — ei suoraan
  // req.bodyä, koska rajatun käyttäjän tyhjä lähetys ei välttämättä tyhjennä koko
  // kokoelmaa levyllä.
  // Romahdussuoja estää kokoelman tyhjentämisen. Se rakennettiin vahingon varalle:
  // epäonnistunut GET + frontin automaattitallennus saattoi ylikirjoittaa kaiken.
  // Tarkoituksellinen poisto on eri asia — tapahtumailmoituksia koskee lakisääteinen
  // säilytysaika, jonka jälkeen ne on hävitettävä, joten poiston on myös oikeasti
  // onnistuttava. allowEmpty=1 ohittaa suojan, mutta vain adminille ja vain kun
  // kutsuja pyytää sitä nimenomaisesti (ks. src/App.tsx: handlePermanentDeleteEvent).
  const allowEmpty = req.query.allowEmpty === '1' && req.role === 'admin';
  if (!allowEmpty && wouldWipeNonEmptyCollection(current, verdict.data)) {
    return res.status(409).json({
      ok: false,
      error: 'Tallennus hylätty: yrität korvata olemassa olevan datan tyhjällä. Jos tarkoitus on poistaa kaikki tietueet, poista ne yksitellen.',
    });
  }
  writeCollection(name, verdict.data);

  // Liitetiedostojen hävittäminen: raportin poistaminen ei aiemmin poistanut sen
  // liitettä levyltä lainkaan, joten esim. valokuva kohdehenkilöstä jäi hakemistoon
  // pysyvästi vaikka itse raportti oli poistettu. Tämän pyynnön irrottamat liitteet
  // poistetaan heti (ne ovat varmasti orpoja), ja sen lisäksi siivotaan aiemmin
  // orvoiksi jääneet tiedostot armonajan jälkeen (ks. uploads.js: collectGarbage).
  // Liitteitä viittaa kaksi kokoelmaa: raporttien liitteet ja tapahtumien
  // pohjakartat. Roskienkeruulle on annettava MOLEMPIEN viitteet, muuten toisen
  // kokoelman tallennus poistaisi toisen tiedostot armonajan jälkeen.
  if (name === 'reports' || name === 'events') {
    try {
      const raporttiIdt = (arr) => (Array.isArray(arr) ? arr : []).map((r) => r?.attachment?.id).filter(Boolean);
      const karttaIdt = (arr) => (Array.isArray(arr) ? arr : []).map((e) => e?.formData?.mapUploadId).filter(Boolean);
      const idt = name === 'reports' ? raporttiIdt : karttaIdt;

      // Tässä pyynnössä irronneet liitteet poistetaan heti — ne ovat varmasti orpoja.
      const viitatutNyt = idt(verdict.data);
      const irrotetut = idt(current).filter((id) => !viitatutNyt.includes(id));
      for (const id of irrotetut) deleteUpload(id);

      const toinen = name === 'reports'
        ? karttaIdt(readCollection('events'))
        : raporttiIdt(readCollection('reports'));
      collectGarbage([...viitatutNyt, ...toinen]);
    } catch (err) {
      // Liitteiden siivous ei saa kaataa itse tallennusta joka jo onnistui.
      console.error('Liitetiedostojen siivous epäonnistui:', err.message);
    }
  }
  // Lokitetaan vasta kirjoituksen onnistuttua — ei koskaan lokiin muutosta joka ei
  // oikeasti mennyt levylle. Yksi rivi per tietue (ei yksi rivi per PUT-pyyntö),
  // koska sama pyyntö voi sisältää usean tietueen muutoksia kerralla.
  for (const change of verdict.changes || []) {
    logAudit({
      user: req.username,
      role: req.role,
      action: change.action,
      collection: name,
      recordId: change.id,
      eventId: change.eventId,
    });
  }
  res.json({ ok: true });
});

// Käyttäjähallinta (vain admin) ja oman salasanan itsepalveluvaihto (kuka tahansa kirjautunut).
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  res.json({ ok: true, users: listUsers() });
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  // password ei tule enää pyynnöstä: palvelin arpoo sen (ks. arvoSalasana).
  const { username, nickname, displayId, employeeId } = req.body || {};
  if (typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ ok: false, error: 'Käyttäjätunnus vaaditaan.' });
  }
  if (typeof nickname !== 'string' || !nickname.trim()) {
    return res.status(400).json({ ok: false, error: 'Nimimerkki vaaditaan.' });
  }
  // Tunnistenumero on valinnainen (vanha "Luo käyttäjä" -polku ei anna sitä), mutta jos
  // se annetaan, sen on oltava kelvollinen ja vapaa: numero yksilöi henkilön raporteissa.
  if (displayId !== undefined && displayId !== null) {
    if (!Number.isInteger(displayId) || displayId < 1000) {
      return res.status(400).json({ ok: false, error: 'Virheellinen tunnistenumero.' });
    }
    const varattu = listUsers().find((u) => u.displayId === displayId);
    if (varattu) {
      return res.status(409).json({ ok: false, error: `Tunnistenumero #${displayId} on jo tunnuksella ${varattu.username}.` });
    }
  }
  // Salasanaa EI oteta enää pyynnöstä: se arvotaan palvelimella ja palautetaan
  // pääkäyttäjälle kertaalleen. Näin uutta salasanaa ei keksitä käsin eikä se kulje
  // selaimesta palvelimelle. Käyttäjä vaihtaa sen heti ensimmäisellä kirjautumisella.
  const trimmedUsername = username.trim();
  if (findUser(trimmedUsername)) {
    return res.status(409).json({ ok: false, error: 'Käyttäjätunnus on jo käytössä.' });
  }
  const arvottu = arvoSalasana();
  upsertUser(trimmedUsername, bcrypt.hashSync(arvottu, 12), {
    nickname: nickname.trim(),
    role: 'user',
    displayId: displayId ?? undefined,
    employeeId: typeof employeeId === 'string' ? employeeId : undefined,
  });
  setMustChangePassword(trimmedUsername, true);
  logAudit({ user: req.username, action: 'user_create', targetUser: trimmedUsername });
  // Salasana palautetaan VAIN tässä vastauksessa — sitä ei tallenneta selväkielisenä
  // eikä sitä voi hakea myöhemmin uudelleen.
  res.json({ ok: true, password: arvottu, mustChangePassword: true });
});

app.put('/api/users/:username', requireAuth, requireAdmin, (req, res) => {
  const { username } = req.params;
  const { nickname, permissions, eventAccess, roleId } = req.body || {};
  const kohde = findUser(username);
  if (!kohde) {
    return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  }
  if (roleId !== undefined) {
    if (!findRole(roleId)) {
      return res.status(400).json({ ok: false, error: 'Tuntematon käyttäjätaso.' });
    }
    // Viimeistä pääkäyttäjää ei saa alentaa: muuten hallintaan ei pääse enää kukaan.
    if (kohde.roleId === ROLE_ADMIN && roleId !== ROLE_ADMIN) {
      const adminejaMuita = listUsers().filter((u) => u.roleId === ROLE_ADMIN && u.username !== username).length;
      if (adminejaMuita === 0) {
        return res.status(400).json({ ok: false, error: 'Viimeisen pääkäyttäjän tasoa ei voi vaihtaa.' });
      }
    }
  }
  if (nickname !== undefined && (typeof nickname !== 'string' || !nickname.trim())) {
    return res.status(400).json({ ok: false, error: 'Nimimerkki ei voi olla tyhjä.' });
  }
  if (permissions !== undefined && (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions))) {
    return res.status(400).json({ ok: false, error: 'Virheellinen oikeusmuoto.' });
  }
  if (eventAccess !== undefined && (!Array.isArray(eventAccess) || !eventAccess.every((id) => typeof id === 'string'))) {
    return res.status(400).json({ ok: false, error: 'Virheellinen tapahtumarajaus.' });
  }
  updateUser(username, {
    nickname: nickname !== undefined ? nickname.trim() : undefined,
    permissions,
    eventAccess,
    roleId,
  });
  // Ei tallenneta permissions/eventAccess-sisältöä itseään lokiin (iso, nested rakenne,
  // ei kovin luettava sellaisenaan) — vain mitkä kentät koskivat, samaan tapaan kuin
  // muukin lokitus keskittyy "mitä tapahtui" -metadataan sisällön sijaan.
  const changedFields = [
    nickname !== undefined && 'nickname',
    permissions !== undefined && 'permissions',
    eventAccess !== undefined && 'eventAccess',
  ].filter(Boolean);
  logAudit({ user: req.username, action: 'user_update', targetUser: username, fields: changedFields });
  res.json({ ok: true });
});

// Authenticator-sovelluksen (TOTP) käyttöönottotiedot — vain admin, näytetään
// "Muokkaa oikeuksia" -sivulla QR-koodina ja tekstimuodossa. Salaisuus itsessään ei
// koskaan päädy /api/users-listaukseen, ainoastaan tälle omalle reitilleen.
app.get('/api/users/:username/totp', requireAuth, requireAdmin, async (req, res) => {
  const { username } = req.params;
  const user = findUser(username);
  if (!user) return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  if (user.role === 'admin') {
    return res.status(400).json({ ok: false, error: 'Pääkäyttäjä ei käytä Authenticator-tunnistautumista.' });
  }
  const secret = getTotpSecret(username);
  const otpauthUri = buildOtpauthUri(secret, username);
  const qrDataUri = await QRCode.toDataURL(otpauthUri, { width: 220, margin: 1 });
  res.json({ ok: true, secret, otpauthUri, qrDataUri, totpRequired: user.totp_required !== false });
});

// Nollaa käyttäjän TOTP-salaisuuden (esim. puhelin kadonnut) — vanha Authenticator-
// merkintä lakkaa toimimasta heti, uusi QR pitää skannata.
app.post('/api/users/:username/totp/reset', requireAuth, requireAdmin, async (req, res) => {
  const { username } = req.params;
  const user = findUser(username);
  if (!user) return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  if (user.role === 'admin') {
    return res.status(400).json({ ok: false, error: 'Pääkäyttäjä ei käytä Authenticator-tunnistautumista.' });
  }
  const secret = resetTotpSecret(username);
  logAudit({ user: req.username, action: 'totp_reset', targetUser: username });
  const otpauthUri = buildOtpauthUri(secret, username);
  const qrDataUri = await QRCode.toDataURL(otpauthUri, { width: 220, margin: 1 });
  res.json({ ok: true, secret, otpauthUri, qrDataUri, totpRequired: user.totp_required !== false });
});

// Ottaa Authenticator-vaatimuksen pois käytöstä / palauttaa sen (esim. käyttäjällä ei
// ole omaa puhelinta) — itse salaisuus/QR säilyy ennallaan jos otetaan myöhemmin takaisin.
app.put('/api/users/:username/totp', requireAuth, requireAdmin, (req, res) => {
  const { username } = req.params;
  const { required } = req.body || {};
  const user = findUser(username);
  if (!user) return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  if (user.role === 'admin') {
    return res.status(400).json({ ok: false, error: 'Pääkäyttäjä ei käytä Authenticator-tunnistautumista.' });
  }
  if (typeof required !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'Virheellinen pyyntö.' });
  }
  setTotpRequired(username, required);
  logAudit({ user: req.username, action: 'totp_required_change', targetUser: username, required });
  res.json({ ok: true, totpRequired: required });
});

// Pakottaa valitun käyttäjän uloskirjautumaan välittömästi — hänen nykyinen istuntonsa
// mitätöityy vaikka eväste olisi muuten vielä voimassa, ja hänen täytyy kirjautua uudelleen.
app.post('/api/users/:username/logout', requireAuth, requireAdmin, (req, res) => {
  const { username } = req.params;
  const user = findUser(username);
  if (!user) return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  if (user.role === 'admin') {
    return res.status(400).json({ ok: false, error: 'Pääkäyttäjää ei voi kirjata ulos tästä näkymästä.' });
  }
  forceLogout(username);
  logAudit({ user: req.username, action: 'force_logout', targetUser: username });
  res.json({ ok: true });
});

// Pääkäyttäjä nollaa salasanan, kun käyttäjä ei muista omaansa. Uusi salasana arvotaan
// palvelimella ja palautetaan kertaalleen; käyttäjä kirjautuu sillä ja joutuu heti
// vaihtamaan sen omakseen (must_change_password). Väliaikainen salasana on kulkenut
// pääkäyttäjän kautta, joten se ei saa jäädä pysyväksi.
//
// Erillinen /api/change-password-reitistä, joka on käyttäjän oma itsepalvelu ja vaatii
// nykyisen salasanan. Tähän ei tarvita vanhaa salasanaa — pääsy on jo rajattu adminiin.
app.post('/api/users/:username/password', requireAuth, requireAdmin, (req, res) => {
  const { username } = req.params;
  const user = findUser(username);
  if (!user) return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  const arvottu = arvoSalasana();
  updatePassword(username, bcrypt.hashSync(arvottu, 12));
  setMustChangePassword(username, true);
  // Vanhat istunnot katkaistaan: syy nollaukseen voi olla vuotanut salasana.
  if (user.role !== 'admin') forceLogout(username);
  logAudit({ user: req.username, action: 'user_password_set', targetUser: username });
  res.json({ ok: true, password: arvottu, mustChangePassword: true });
});

app.post('/api/change-password', requireAuth, loginLimiter, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ ok: false, error: 'Nykyinen ja uusi salasana vaaditaan.' });
  }
  const user = findUser(req.username);
  const valid = user ? bcrypt.compareSync(currentPassword, user.password_hash) : false;
  if (!valid) {
    return res.status(401).json({ ok: false, error: 'Nykyinen salasana on väärin.' });
  }
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({
      ok: false,
      error: 'Uuden salasanan tulee olla vähintään 10 merkkiä ja sisältää iso kirjain, pieni kirjain ja numero.',
    });
  }
  const hash = bcrypt.hashSync(newPassword, 12);
  updatePassword(req.username, hash);
  logAudit({ user: req.username, action: 'password_change' });
  res.json({ ok: true });
});

// Audit-loki (vain admin): kuka teki mitä milloin — data-kokoelmien luonti/muokkaus/
// poisto, käyttäjähallinnan muutokset, kirjautumiset. Sivutettu (limit/before) koska
// loki kasvaa ajan myötä eikä koskaan katkaista automaattisesti.
// Tallennustilan tilanne (vain admin). Mittari kertoo kuinka paljon levystä on
// käytössä — datahakemiston tiedostojärjestelmä on sama levy jolla koko palvelin on.
// Käytetään fs.statfsSync:iä eikä ulkoista komentoa (df), jotta reitti ei riipu
// shellistä eikä sen tulosteen muodosta.
// ====================== KÄYTTÄJÄTASOT ======================
// Tasot määräävät sivukartta-oikeudet (ks. roles.js). Vain pääkäyttäjä hallinnoi niitä.
app.get('/api/roles', requireAuth, requireAdmin, (req, res) => {
  res.json({ ok: true, roles: listRoles() });
});

app.post('/api/roles', requireAuth, requireAdmin, (req, res) => {
  const { name, description, permissions } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'Käyttäjätason nimi vaaditaan.' });
  }
  if (permissions !== undefined && (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions))) {
    return res.status(400).json({ ok: false, error: 'Virheellinen oikeusmuoto.' });
  }
  const luotu = createRole({ name, description, permissions });
  logAudit({ user: req.username, action: 'role_create', targetRole: luotu.id });
  res.json({ ok: true, role: luotu });
});

app.put('/api/roles/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body || {};
  if (!findRole(id)) {
    return res.status(404).json({ ok: false, error: 'Käyttäjätasoa ei löytynyt.' });
  }
  if (permissions !== undefined && (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions))) {
    return res.status(400).json({ ok: false, error: 'Virheellinen oikeusmuoto.' });
  }
  const paivitetty = updateRole(id, { name, description, permissions });
  logAudit({ user: req.username, action: 'role_update', targetRole: id });
  res.json({ ok: true, role: paivitetty });
});

app.delete('/api/roles/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  // Käytössä olevaa tasoa ei voi poistaa: käyttäjät jäisivät osoittamaan olemattomaan
  // tasoon, jolloin he menettäisivät kaikki oikeutensa selittämättä miksi.
  const kaytossa = listUsers().filter((u) => u.roleId === id);
  if (kaytossa.length > 0) {
    return res.status(409).json({
      ok: false,
      error: `Tasoa ei voi poistaa: se on käytössä ${kaytossa.length} käyttäjällä (${kaytossa.map((u) => u.username).join(', ')}).`,
    });
  }
  const tulos = deleteRole(id);
  if (!tulos.ok) return res.status(400).json(tulos);
  logAudit({ user: req.username, action: 'role_delete', targetRole: id });
  res.json({ ok: true });
});

app.get('/api/storage', requireAuth, requireAdmin, (req, res) => {
  try {
    res.json({ ok: true, ...getStorageUsage() });
  } catch (err) {
    console.error('Tallennustilan luku epäonnistui:', err.message);
    res.status(500).json({ ok: false, error: 'Tallennustilan lukeminen ei onnistunut.' });
  }
});

app.get('/api/audit', requireAuth, requireAdmin, (req, res) => {
  const { limit, before, user, action, collection, eventId } = req.query;
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const result = readAuditLog({
    limit: parsedLimit,
    before: typeof before === 'string' ? before : undefined,
    user: typeof user === 'string' ? user : undefined,
    action: typeof action === 'string' ? action : undefined,
    collection: typeof collection === 'string' ? collection : undefined,
    eventId: typeof eventId === 'string' ? eventId : undefined,
  });
  res.json({ ok: true, ...result });
});

// Lomakkeiden "Ota kuva" / "Liitä tiedosto" -liitteet. Tallennetaan levylle
// (ei git-repoon, ei muihin kokoelmiin) ja viitataan raportissa pelkällä id:llä.
app.post('/api/uploads', requireAuth, uploadLimiter, (req, res) => {
  if (!canUploadAttachment(req.role, req.permissions)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia liitteiden lähettämiseen.' });
  }
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Tiedosto on liian suuri (max 15 Mt).' : 'Tiedoston lähetys epäonnistui.';
      return res.status(400).json({ ok: false, error: msg });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Tiedostoa ei löytynyt.' });
    }
    if (!isAllowedFile(req.file.originalname)) {
      return res.status(400).json({ ok: false, error: 'Tiedostotyyppiä ei tueta.' });
    }
    const id = saveUpload(req.file.originalname, req.file.buffer);
    res.json({ ok: true, id, name: req.file.originalname, size: req.file.size });
  });
});

app.get('/api/uploads/:id', requireAuth, (req, res) => {
  const filePath = getUploadPath(req.params.id);
  if (!filePath) return res.status(404).json({ ok: false, error: 'Tiedostoa ei löytynyt.' });
  // Liite itsessään ei tiedä oikeuksia — omistava raportti (ja sen typeId) etsitään
  // reports-kokoelmasta ja tarkistetaan sen lukuoikeus, ks. permissions.js.
  const reportsArr = readCollection('reports') || [];
  const eventsArr = readCollection('events') || [];
  if (!canReadAttachment(req.role, req.permissions, req.eventAccess, req.params.id, reportsArr, eventsArr)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän liitteen lataamiseen.' });
  }
  res.sendFile(filePath);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`turvajohto-os-server kuuntelee portissa ${PORT}`);
});
