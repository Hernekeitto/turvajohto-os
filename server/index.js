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
  luoToken,
  tokenTasmaa,
  ratkaiseVoimassaolo,
  jaonTila,
  TILAN_SELITE,
  hashaaSalasana,
  salasanaTasmaa,
  kuuluuJakoon,
  julkinenJako,
} from './shares.js';
import {
  COLLECTION_NAMES,
  collectionTuote,
  readableData,
  authorizeWrite,
  canReadAttachment,
  canUploadAttachment,
  canEdit,
  canView,
  eventAllowed,
} from './permissions.js';
import { liitaKanava, laheta as lahetaKanavalle, lahetaViesti } from './kanava.js';
import {
  seurantaKaytossa, paivita as paivitaSijainti, kaikki as sijainnit,
  hae as haeSijainti, unohda as unohdaSijainti,
} from './sijainti.js';
import {
  tarkistaIlmoitus,
  lomakkeenTila,
  // saaLahettaa on jo varattu hätäviestien oikeustarkistukselle tässä tiedostossa,
  // joten julkisen ilmoituksen määrärajoitus tuodaan omalla nimellään.
  saaLahettaa as saaLahettaaIlmoituksen,
  TILAN_SELITE as JULKINEN_SELITE,
  julkinenLomake,
  luoIlmoitusToken,
  // Kummallakin moduulilla on oma voimassaolosääntönsä eikä niitä saa sekoittaa:
  // jakolinkin ratkaiseVoimassaolo tuntee salasanat ja pääkäyttäjän hyväksynnän,
  // julisteen ei tunne kumpaakaan mutta sillä on kova 180 vrk:n katto.
  ratkaiseVoimassaolo as ratkaiseJulisteenVoimassaolo,
} from './julkinen.js';
import {
  onTunnettuLaji, tarkistaNimi, puhdistaKuvaus, tarkistaPisteet, tarkistaGps,
  sisaltoMuuttui, julkinenPohja, etsiPisteTokenilla,
} from './pohjat.js';
import { aloitaKierros, kuittaaPiste, paataKierros, etaisyysMetreina, OLETUS_SIETORAJA_M } from './kierros.js';
import {
  luoAjastin, luoHalytys, jatka as jatkaHalytysta, laukaise as laukaiseHalytys,
  peru as peruHalytys, kuittaa as kuittaaHalytys, eraantyneet, eskaloitavat,
  merkitseEskaloitu, viestiTeksti, TYYPIT as HALYTYSTYYPIT,
} from './halytys.js';
import { arvioi as arvioiVyohykkeet } from './geofence.js';
import { onkoKonfiguroitu, haeSaldo, lahetaViestit, laskeViesti, parsiJson } from './bulksms.js';
import { kaytossaOlevatNapit, ratkaiseVastaanottajat, taytaPaikkamerkit, halytysVastaanottajat } from './sms.js';
import { lisaaJonoon, otaKasittelyyn, kuittaaKasitellyksi, jononPituus } from './smsqueue.js';
import { salaisuusTasmaa, tulkitseTapahtuma, soveltaTilaraportit, soveltaVastaukset } from './smswebhook.js';
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
app.use(express.json({
  limit: '5mb',
  // Webhook-kuorman raakateksti talteen: BulkSMS:n viesti-id:t ovat niin suuria että
  // tavallinen JSON.parse pyöristää ne (ks. bulksms.js: parsiJson). Kuorma jäsennetään
  // reitillä uudelleen raakatekstistä. Rajaus polkuun pitää muistinkäytön ennallaan
  // kaikilla muilla reiteillä, joilla tätä ei tarvita.
  verify: (req, res, buf) => {
    if (req.url && req.url.startsWith('/api/webhooks/')) req.rawBody = buf.toString('utf8');
  },
}));

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
  // Uloskirjautuminen unohtaa sijainnin. Tämä on GDPR 25 artiklan tekninen minimointi
  // käytännössä, ja samalla vastaus siihen kysymykseen jonka jokainen työntekijä esittää:
  // vapaa-ajalla ei seurata, koska tietoa ei silloin ole olemassa.
  const username = getSessionUser(req);
  if (username) unohdaSijainti(username);
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
    tuotteet: paaseeTuotteisiin(user),
    // Tämän istunnon kirjautumishetki. EI johdeta JWT:n iat-kentästä, koska
    // ei-adminin istunto on liukuva: token uusitaan tässä samassa reitissä,
    // jolloin iat siirtyisi eteenpäin eikä kertoisi enää kirjautumisajasta.
    lastLoginAt: user.last_login_at || null,
    // Onko sijaintiseuranta kytketty palvelimella päälle. Tarvitaan selaimessa siihen,
    // ettei paikannuslupaa kysytä turhaan — ja siihen että vartija tietää lähettääkö
    // laite sijaintia. EI oikeustieto: sijaintien NÄKEMINEN on oma sivukartta-solmunsa
    // ('locations'), ja tämä kertoo vain onko koko toiminto olemassa.
    sijaintiseuranta: seurantaKaytossa(),
  });
});

// Mihin tuotteisiin ('event' | 'guard') tunnus pääsee. Admin pääsee aina molempiin: hän
// hallinnoi kumpaakin puolta eikä saa lukita itseään ulos siitä jota on juuri määrittämässä.
const TUOTTEET = ['event', 'guard'];
function paaseeTuotteisiin(user) {
  if (user.role === 'admin') return [...TUOTTEET];
  const omat = Array.isArray(user.tuotteet) ? user.tuotteet.filter((t) => TUOTTEET.includes(t)) : [];
  // Tyhjä lista tarkoittaisi ettei käyttäjä pääse minnekään — se on lähes varmasti
  // virhe datassa, joten palautetaan tapahtumapuoli kuten ennen kentän käyttöönottoa.
  return omat.length > 0 ? omat : ['event'];
}

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
  req.tuotteet = paaseeTuotteisiin(user);
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
// Kokoelmat jotka viittaavat ladattuihin tiedostoihin, ja miten viite kustakin luetaan.
//
// TÄRKEÄ: uusi liitteitä viittaava kokoelma ON LISÄTTÄVÄ TÄHÄN. Roskienkeruu poistaa
// tiedostot joihin mikään kokoelma ei viittaa (armonajan jälkeen), joten puuttuva rivi
// tarkoittaa että kyseisen kokoelman tiedostot katoavat levyltä vuorokaudessa.
// Kokoelmat jotka syntyvät ja päivittyvät vain palvelimella. Frontti saa lukea ne
// (GET /api/data/:name suodattaa oikeuksien mukaan normaalisti), mutta PUT hylätään.
// patrolRuns on tässä eri syystä kuin SMS-kokoelmat: sen sisältö EI tule ulkopuolelta
// vaan kierroksen säännöistä (kierros.js). Vajaata kierrosta ei voi merkitä valmiiksi ja
// keskeytys vaatii syyn — jos selain saisi kirjoittaa kokoelman suoraan, molemmat
// säännöt olisivat pelkkä kohteliaisuus jonka curl ohittaa.
const PALVELIMEN_YLLAPITAMAT = new Set(['smsLog', 'smsReplies', 'patrolRuns', 'alerts']);

// Raportin liiteviitteet: sekä vanha yksittäinen `attachment` ETTÄ erässä 1 lisätty
// `attachments[]`. Molemmat on luettava koko siirtymäajan yli — jos rekisteri lukisi vain
// toista, toisen kentän liitteet tulkittaisiin orvoiksi ja roskienkeruu poistaisi ne
// vuorokaudessa.
const raportinLiitteet = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .flatMap((r) => [
      r?.attachment?.id,
      ...(Array.isArray(r?.attachments) ? r.attachments.map((a) => a?.id) : []),
    ])
    .filter(Boolean);

const UPLOAD_VIITTAAJAT = {
  reports: raportinLiitteet,
  events: (arr) => (Array.isArray(arr) ? arr : []).map((e) => e?.formData?.mapUploadId).filter(Boolean),
  eventFiles: (arr) => (Array.isArray(arr) ? arr : []).map((f) => f?.uploadId).filter(Boolean),
  // GUARD-puolen liitteet on oltava tässä samasta syystä kuin tapahtumapuolen: rekisteri
  // kertoo roskienkeruulle mitkä liitteet ovat vielä käytössä. Ilman näitä rivejä
  // esimerkiksi tapahtumapuolen tallennus tulkitsisi kohteen pohjapiirroksen orvoksi ja
  // poistaisi sen levyltä armonajan jälkeen.
  guardFiles: (arr) => (Array.isArray(arr) ? arr : []).map((f) => f?.uploadId).filter(Boolean),
  guardReports: raportinLiitteet,
  // Kohteen pohjakartta. Ilman tätä riviä roskienkeruu pitäisi karttaa orpona ja
  // poistaisi sen vuorokaudessa — sama ansa kuin tapahtuman kartalla (events).
  guardSites: (arr) => (Array.isArray(arr) ? arr : []).map((k) => k?.mapUploadId).filter(Boolean),
};

// Tuoteportti: kokoelma joka kuuluu vain toiselle puolelle (esim. guardSites) on
// kokonaan saavuttamaton tunnukselta jolla ei ole pääsyä sinne — riippumatta siitä mitä
// sivukartta-oikeudet sanovat. Tämä on se oikea portti; käyttöliittymän esto
// (PasswordGate) on vain kohteliaisuus ja ohitettavissa curlilla.
function tuoteEstaa(req, name) {
  const tuote = collectionTuote(name);
  return tuote !== null && !(req.tuotteet || []).includes(tuote);
}

app.get('/api/data/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  if (!KNOWN_COLLECTIONS.includes(name)) {
    return res.status(404).json({ ok: false, error: 'Tuntematon kokoelma.' });
  }
  if (tuoteEstaa(req, name)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän tiedon lukemiseen.' });
  }
  const result = readableData(req.role, req.permissions, req.eventAccess, name, readCollection(name));
  if (!result.ok) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän tiedon lukemiseen.' });
  }
  // Jakolinkin token on salasanaan rinnastuva salaisuus: se antaa pääsyn tiedostoon
  // ilman kirjautumista. Sitä ei anneta listahaussa vaikka kutsujalla on lukuoikeus —
  // token haetaan erikseen /api/shares/:id/token -reitiltä vasta kun käyttäjä pyytää
  // linkin nähtäväkseen. Sama koskee salasanatiivistettä.
  //
  // Julisteen token peitetään samalla säännöllä, vaikka se ei olekaan salaisuus (se on
  // aidassa kaikkien nähtävillä): syy on toinen, mutta lopputulos sama. Token on ainoa
  // asia joka oikeuttaa kirjoittamaan järjestelmään ilman kirjautumista, eikä sen pidä
  // kulkea jokaisessa listahaussa selaimen välimuistiin ja lokeihin.
  let data = result.data;
  if (name === 'fileShares') data = (result.data || []).map(julkinenJako);
  if (name === 'publicForms') data = (result.data || []).map(julkinenLomake);
  // Tarkistuspisteiden tokenit peitetään samalla säännöllä: ne haetaan erikseen vasta
  // kun käyttäjä tulostaa tarrat (/api/pohjat/:id/tarrat).
  if (name === 'templates') data = (result.data || []).map(julkinenPohja);
  res.json({ ok: true, data });
});

// Henkilöstön sijainnit juuri nyt. Kanava kertoo muutokset sitä mukaa kun niitä tulee,
// mutta juuri avattu näkymä tarvitsee lähtötilanteen — ilman tätä kartta olisi tyhjä
// siihen asti kunnes joku sattuu liikkumaan.
//
// `kaytossa: false` on eri asia kuin tyhjä lista: se kertoo käyttöliittymälle että
// seurantaa ei ole kytketty päälle lainkaan, jolloin karttaan ei piirretä tyhjää
// henkilöstötasoa eikä luvata toimintoa jota ei ole.
app.get('/api/sijainnit', requireAuth, (req, res) => {
  if (!seurantaKaytossa()) return res.json({ ok: true, kaytossa: false, sijainnit: [] });
  const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : null;
  const saa =
    req.role === 'admin' ||
    (eventAllowed(req.eventAccess, eventId) && canView(req.permissions, eventId, 'locations'));
  if (!saa) return res.status(403).json({ ok: false, error: 'Ei oikeutta henkilöstön sijainteihin.' });
  res.json({ ok: true, kaytossa: true, sijainnit: sijainnit({ eventId }) });
});

app.put('/api/data/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  if (!KNOWN_COLLECTIONS.includes(name)) {
    return res.status(404).json({ ok: false, error: 'Tuntematon kokoelma.' });
  }
  if (tuoteEstaa(req, name)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän tiedon muokkaamiseen.' });
  }
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ ok: false, error: 'Odotettiin taulukkoa.' });
  }
  // Rakennevalidointi ennen oikeustarkistusta/kirjoitusta — ks. validation.js.
  const recordCheck = validateRecords(req.body);
  if (!recordCheck.ok) {
    return res.status(400).json(recordCheck);
  }
  // Jakolinkkejä ei kirjoiteta tämän geneerisen reitin kautta: token ja salasanatiiviste
  // syntyvät palvelimella (/api/shares), eikä frontilla ole niitä hallussaan. Jos tämä
  // sallittaisiin, frontin tallennus ylikirjoittaisi tokenit tyhjiksi ja katkaisisi
  // kaikki voimassa olevat jakolinkit kerralla.
  if (name === 'fileShares') {
    return res.status(403).json({
      ok: false,
      error: 'Jakolinkkejä hallitaan vain omien reittiensä kautta (/api/shares).',
    });
  }
  // Sama ansa kuin fileShares, ja tässä se olisi vielä pahempi: selain ei koskaan näe
  // julisteiden tokeneita (ne peitetään GET:issä), joten koko kokoelman tallennus
  // kirjoittaisi tokenit tyhjiksi ja jokainen aidassa oleva juliste lakkaisi toimimasta
  // kerralla — eikä sitä voisi korjata muuten kuin painamalla uudet julisteet.
  if (name === 'publicForms') {
    return res.status(403).json({
      ok: false,
      error: 'Ilmoituslomakkeita hallitaan vain omien reittiensä kautta (/api/publicforms).',
    });
  }
  // Sama ansa kolmannen kerran: selain ei näe tarkistuspisteiden tokeneita, joten koko
  // kokoelman tallennus tyhjentäisi ne ja jokainen seinässä oleva QR-tarra lakkaisi
  // toimimasta.
  if (name === 'templates') {
    return res.status(403).json({
      ok: false,
      error: 'Pohjia hallitaan vain omien reittiensä kautta (/api/pohjat).',
    });
  }
  // Samasta syystä kuin fileShares, mutta eri lähteestä: näiden sisältö syntyy
  // lähetysreitillä ja päivittyy BulkSMS:n webhook-kutsuista. Frontti näyttää ne mutta ei
  // omista niitä, joten sen automaattitallennus ylikirjoittaisi juuri saapuneet
  // toimituskuittaukset vanhentuneella välimuistilla. Tämä koskee myös adminia, jonka
  // authorizeWrite päästäisi muuten läpi ilman per-tietue-tarkistusta.
  if (PALVELIMEN_YLLAPITAMAT.has(name)) {
    return res.status(403).json({
      ok: false,
      error: 'Kokoelmaa ylläpitää palvelin, eikä sitä voi kirjoittaa selaimesta.',
    });
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
  //
  // Roskienkeruulle on annettava KAIKKIEN liitteitä viittaavien kokoelmien viitteet,
  // muuten yhden kokoelman tallennus poistaisi toisen tiedostot armonajan jälkeen.
  // Siksi viittaajat ovat rekisterissä (UPLOAD_VIITTAAJAT) eivätkä if-ehdossa: uusi
  // liitteitä viittaava kokoelma lisätään yhteen paikkaan, eikä sen tiedostojen
  // katoaminen jää kiinni siitä että joku muisti päivittää tämän ehdon.
  if (UPLOAD_VIITTAAJAT[name]) {
    try {
      const idt = UPLOAD_VIITTAAJAT[name];

      // Tässä pyynnössä irronneet liitteet poistetaan heti — ne ovat varmasti orpoja.
      const viitatutNyt = idt(verdict.data);
      const irrotetut = idt(current).filter((id) => !viitatutNyt.includes(id));
      for (const id of irrotetut) deleteUpload(id);

      // Muiden kokoelmien viitteet luetaan levyltä, jotta ne eivät joudu roskiksi.
      const muut = Object.entries(UPLOAD_VIITTAAJAT)
        .filter(([kokoelma]) => kokoelma !== name)
        .flatMap(([kokoelma, poimi]) => poimi(readCollection(kokoelma)));
      collectGarbage([...viitatutNyt, ...muut]);
    } catch (err) {
      // Liitteiden siivous ei saa kaataa itse tallennusta joka jo onnistui.
      console.error('Liitetiedostojen siivous epäonnistui:', err.message);
    }
  }
  // Lokitetaan vasta kirjoituksen onnistuttua — ei koskaan lokiin muutosta joka ei
  // oikeasti mennyt levylle. Yksi rivi per tietue (ei yksi rivi per PUT-pyyntö),
  // koska sama pyyntö voi sisältää usean tietueen muutoksia kerralla.
  // Kerrotaan muutoksesta avoimille istunnoille. Vasta kirjoituksen JÄLKEEN: ilmoitus
  // muutoksesta jota ei tallennettu saisi selaimet hakemaan vanhan datan uudelleen ja
  // näyttämään sen tuoreena. Kanava kuljettaa vain id:t — sisältö haetaan GETillä, joka
  // tekee saman oikeustarkistuksen kuin ennenkin (ks. kanava.js).
  lahetaKanavalle(name, verdict.changes, {
    lahettaja: req.username,
    saaNahda: (istunto, eventId) =>
      istunto?.role === 'admin' || eventAllowed(istunto?.eventAccess, eventId),
  });

  for (const change of verdict.changes || []) {
    logAudit({
      user: req.username,
      role: req.role,
      action: change.action,
      collection: name,
      recordId: change.id,
      eventId: change.eventId,
      // Tilamuutos ja korjausmerkinnän lisäys ovat tarkoituksellinen poikkeus tämän
      // moduulin periaatteeseen "vain metadata, ei tietueen sisältöä" (ks. audit.js):
      // kumpikaan ei ole henkilötietoa, ja juuri niiden historia on se mitä
      // jälkikäteisessä selvityksessä kysytään. Lisätiedot tulevat authorizeWritelta,
      // joka on ainoa paikka jossa vanha ja uusi tietue ovat molemmat käsillä.
      ...(change.statusFrom !== undefined
        ? { statusFrom: change.statusFrom, statusTo: change.statusTo }
        : {}),
      ...(change.correctionAdded ? { correctionAdded: true } : {}),
    });
  }
  res.json({ ok: true });
});

// --- Tietuekohtainen kirjoitus (offline-jonon perusta, P7) -------------------------
//
// Koko kokoelman PUT ei kelpaa offline-jonolle. Kentältä palaava puhelin, joka on ollut
// verkotta kolme tuntia, lähettäisi oman vanhentuneen käsityksensä koko kokoelmasta ja
// pyyhkisi kaiken mitä muut ovat sillä välin kirjanneet. Se on juuri se vahinko jota
// vastaan romahdussuoja rakennettiin, mutta hienovaraisempana: data ei katoa kokonaan
// vaan osittain, eikä kukaan huomaa.
//
// Siksi jonosta lähtevä kirjaus menee tänne: YKSI tietue, joka LISÄTÄÄN. Muiden
// samanaikaiset kirjaukset eivät voi kadota, koska niitä ei kosketa.
//
// IDEMPOTENSSI tulee tietueen id:stä, jonka SELAIN antaa jo offline-tilassa. Jos vastaus
// hukkuu matkalla ja jono yrittää uudelleen, sama id saapuu toisen kerran — silloin
// palvelin toteaa tietueen jo olevan olemassa eikä luo kaksoiskappaletta. Ilman tätä
// katkeileva verkko tuottaisi kaksi identtistä kirjausta samasta tapahtumasta, mikä on
// lakisääteisessä aineistossa oma ongelmansa.
//
// Vain kentällä tehtävät kirjaukset: nämä ovat ne joita tehdään verkon ollessa poikki.
// Muut kokoelmat (kohteet, pohjat, käyttäjät) muokataan valvomossa, eikä niiden
// muokkaamiselle offline-tilassa ole tarvetta — eikä lisäys yksinään edes riittäisi,
// koska niissä muokataan olemassa olevia tietueita.
const KENTTAKOKOELMAT = new Set(['reports', 'guardReports', 'guardTaskRuns', 'checkins']);

app.post('/api/kirjaa/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  if (!KENTTAKOKOELMAT.has(name)) {
    return res.status(404).json({ ok: false, error: 'Kokoelmaan ei voi kirjata yksittäistä tietuetta.' });
  }
  if (tuoteEstaa(req, name)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän tiedon muokkaamiseen.' });
  }
  const tietue = req.body;
  if (!tietue || typeof tietue !== 'object' || Array.isArray(tietue)) {
    return res.status(400).json({ ok: false, error: 'Odotettiin yhtä tietuetta.' });
  }
  const rakenne = validateRecords([tietue]);
  if (!rakenne.ok) return res.status(400).json(rakenne);

  const current = readCollection(name) || [];
  const id = String(tietue.id);
  if (current.some((t) => String(t?.id) === id)) {
    // Jono yritti uudelleen. Ei virhe: kirjaus on jo perillä, ja jonon kuuluu poistaa
    // se listaltaan onnistuneena. Virhe tässä kohdassa jättäisi kirjauksen jonoon
    // ikuisesti yrittämään uudelleen.
    return res.json({ ok: true, id, duplikaatti: true });
  }

  // Oikeustarkistus tehdään SAMALLA funktiolla kuin koko kokoelman kirjoituksessa, jotta
  // lisäysreitti ei voi olla eri mieltä oikeuksista kuin tavallinen tallennus.
  const verdict = authorizeWrite(req.role, req.permissions, req.eventAccess, name, current, [...current, tietue]);
  if (!verdict.ok) return res.status(403).json(verdict);

  writeCollection(name, verdict.data);
  lahetaKanavalle(name, verdict.changes, {
    lahettaja: req.username,
    saaNahda: (istunto, eventId) =>
      istunto?.role === 'admin' || eventAllowed(istunto?.eventAccess, eventId),
  });
  for (const change of verdict.changes || []) {
    logAudit({
      user: req.username,
      role: req.role,
      action: change.action,
      collection: name,
      recordId: change.id,
      eventId: change.eventId,
      // Jonosta tullut kirjaus merkitään lokiin: jälkikäteen on olennaista tietää, että
      // kirjaus syntyi kentällä eri aikaan kuin se saapui palvelimelle.
      ...(req.body?.jonossaAlkaen ? { jonossaAlkaen: req.body.jonossaAlkaen } : {}),
    });
  }
  res.json({ ok: true, id });
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
  const { nickname, permissions, eventAccess, tuotteet, roleId } = req.body || {};
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
  // Tuotepääsy: tyhjä lista lukitsisi käyttäjän ulos kokonaan, joten vähintään yksi
  // tunnettu tuote vaaditaan. Adminia rajaus ei koske (ks. paaseeTuotteisiin).
  if (tuotteet !== undefined
      && (!Array.isArray(tuotteet) || tuotteet.length === 0 || !tuotteet.every((t) => TUOTTEET.includes(t)))) {
    return res.status(400).json({ ok: false, error: 'Valitse vähintään yksi puoli (EVENT tai GUARD).' });
  }
  updateUser(username, {
    nickname: nickname !== undefined ? nickname.trim() : undefined,
    permissions,
    eventAccess,
    tuotteet,
    roleId,
  });
  // Ei tallenneta permissions/eventAccess-sisältöä itseään lokiin (iso, nested rakenne,
  // ei kovin luettava sellaisenaan) — vain mitkä kentät koskivat, samaan tapaan kuin
  // muukin lokitus keskittyy "mitä tapahtui" -metadataan sisällön sijaan.
  const changedFields = [
    nickname !== undefined && 'nickname',
    permissions !== undefined && 'permissions',
    eventAccess !== undefined && 'eventAccess',
    tuotteet !== undefined && 'tuotteet',
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

// ====================== JAKOLINKIT ======================
// Julkinen latausreitti. EI requireAuthia — se on koko pointti: ulkopuolinen saa
// tiedoston pelkällä linkillä. Suojana ovat token, mahdollinen salasana, vanhentuminen
// ja latausraja (ks. shares.js), sekä oma rate limit alla.
//
// Kaikki estot vastaavat 404:llä, mutta virheviesti erottelee syyn (vanhentunut,
// peruutettu, latausraja). Se paljastaa arvaajalle että token oli oikea — tietoinen
// kompromissi: tokenin arvaaminen ei ole realistinen uhka (256 bittiä), ja
// vastaanottajalle "linkki on vanhentunut" on olennaisesti hyödyllisempi kuin
// "ei löytynyt" silloin kun linkki oikeasti vanheni.
const shareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liikaa yrityksiä. Odota hetki ja yritä uudelleen.' },
});

// --- Julkinen yleisöilmoitus (QR-juliste) -----------------------------------------
//
// Kaksi erillistä rajoitinta tarkoituksella. IP-kohtainen estää yhtä lähettäjää
// hakkaamasta reittiä; lomakekohtainen (julkinen.js: saaLahettaa) estää sen että sata
// eri IP-osoitetta täyttää yhden julisteen jonon. Kumpikaan yksin ei riitä.
const julkinenLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Ilmoituksia on lähetetty liikaa lyhyessä ajassa. Yritä hetken kuluttua uudelleen.' },
});

function etsiIlmoituslomake(token) {
  const lomakkeet = readCollection('publicForms') || [];
  return lomakkeet.find((l) => tokenTasmaa(token, l.token)) || null;
}

// Julisteen tiedot ennen lomakkeen näyttämistä: onko linkki voimassa ja mihin
// tapahtumaan se kuuluu. EI kerro mitään muuta tapahtumasta kuin nimen — tuntemattoman
// ei pidä saada tätä kautta tietoa siitä mitä alueella on tapahtunut.
app.get('/api/julkinen/:token', julkinenLimiter, (req, res) => {
  const lomake = etsiIlmoituslomake(req.params.token);
  const tila = lomakkeenTila(lomake);
  if (!tila.ok) return res.status(404).json({ ok: false, error: JULKINEN_SELITE[tila.syy] || 'Linkki ei ole käytettävissä.' });
  const tapahtuma = (readCollection('events') || []).find((e) => e.id === lomake.eventId);
  res.json({ ok: true, tapahtuma: tapahtuma?.name || '', paikka: lomake.nimi || '' });
});

// Yleisön lähettämä ilmoitus. EI vaadi kirjautumista — tämä on ainoa kirjoittava reitti
// joka ei sitä vaadi, ja siksi jokainen suoja on tässä eikä myöhemmin:
// määrärajoitus, tokenin voimassaolo, kenttien pituusrajat ja moderointijono.
app.post('/api/julkinen/:token', julkinenLimiter, express.json({ limit: '16kb' }), (req, res) => {
  const lomake = etsiIlmoituslomake(req.params.token);
  const tila = lomakkeenTila(lomake);
  if (!tila.ok) return res.status(404).json({ ok: false, error: JULKINEN_SELITE[tila.syy] || 'Linkki ei ole käytettävissä.' });

  if (!saaLahettaaIlmoituksen(lomake.id)) {
    return res.status(429).json({ ok: false, error: JULKINEN_SELITE.rate_limited });
  }

  const tarkistus = tarkistaIlmoitus(req.body);
  if (!tarkistus.ok) return res.status(400).json({ ok: false, error: tarkistus.error });

  const ilmoitukset = readCollection('publicReports') || [];
  const uusi = {
    id: `yi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    eventId: lomake.eventId,
    formId: lomake.id,
    createdAt: new Date().toISOString(),
    // Moderointijonon tila. Vasta hyväksyntä tekee tästä kirjauksen reports-kokoelmaan.
    tila: 'moderoitavana',
    ...tarkistus.ilmoitus,
  };
  writeCollection('publicReports', [uusi, ...ilmoitukset]);

  // Kerrotaan moderointijonosta niille jotka saavat sen nähdä. Kanava kuljettaa vain
  // id:n, joten moderoimaton teksti ei kulje sitä kautta kenellekään.
  lahetaKanavalle('publicReports', [{ action: 'create', id: uusi.id, eventId: uusi.eventId }], {
    saaNahda: (istunto, eventId) =>
      istunto?.role === 'admin' ||
      (eventAllowed(istunto?.eventAccess, eventId) && canView(rolePermissions(istunto?.roleId), eventId, 'public_reports')),
  });

  logAudit({ user: null, action: 'public_report_received', collection: 'publicReports', recordId: uusi.id, eventId: uusi.eventId });
  res.json({ ok: true });
});

// Julisteen token QR-koodia varten. Sama periaate kuin jakolinkeillä: token ei kulje
// listauksessa vaan haetaan erikseen, jotta se ei päädy jokaiseen välimuistiin ja lokiin
// jossa listaus käy.
app.get('/api/publicforms/:id/token', requireAuth, (req, res) => {
  const lomake = (readCollection('publicForms') || []).find((l) => l.id === req.params.id);
  if (!lomake) return res.status(404).json({ ok: false, error: 'Ilmoituslomaketta ei löytynyt.' });
  if (req.role !== 'admin' && !canEdit(req.permissions, lomake.eventId, 'public_reports')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tähän ilmoituslomakkeeseen.' });
  }
  res.json({ ok: true, token: lomake.token });
});

// Julisteen luonti. Oma reittinsä eikä /api/data/publicForms, koska token syntyy
// palvelimella eikä selain saa sitä koskaan asettaa: jos selain voisi valita tokenin,
// se voisi myös valita saman tokenin toiselle tapahtumalle ja ohjata ilmoitukset väärään
// jonoon.
app.post('/api/publicforms', requireAuth, (req, res) => {
  const { eventId, nimi, vrk } = req.body || {};
  if (typeof eventId !== 'string' || !eventId) {
    return res.status(400).json({ ok: false, error: 'Tapahtuma puuttuu.' });
  }
  // Julisteen tekeminen on sama oikeus kuin ilmoitusten moderointi (ks. permissions.js):
  // se joka päättää mistä ilmoituksia otetaan vastaan, myös käsittelee ne.
  if (req.role !== 'admin' && !(eventAllowed(req.eventAccess, eventId) && canEdit(req.permissions, eventId, 'public_reports'))) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta luoda ilmoituslomaketta tähän tapahtumaan.' });
  }
  const tapahtuma = (readCollection('events') || []).find((e) => e.id === eventId);
  if (!tapahtuma) return res.status(404).json({ ok: false, error: 'Tapahtumaa ei löytynyt.' });

  // Julisteen nimi on sen fyysinen sijainti ("Portti 3, itäaita"). Se ei ole
  // koristetta: se on ainoa tieto jolla väärinkäytetty juliste löydetään maastosta ja
  // otetaan pois, joten se vaaditaan.
  const paikka = String(nimi ?? '').trim().slice(0, 120);
  if (paikka.length < 2) {
    return res.status(400).json({ ok: false, error: 'Anna julisteelle sijainti, esimerkiksi "Portti 3".' });
  }

  const voimassaolo = ratkaiseJulisteenVoimassaolo({ vrk }, new Date());
  if (voimassaolo.error) return res.status(400).json({ ok: false, error: voimassaolo.error });

  const lomake = {
    id: crypto.randomUUID(),
    eventId,
    nimi: paikka,
    token: luoIlmoitusToken(),
    expiresAt: voimassaolo.expiresAt,
    createdBy: req.username,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  writeCollection('publicForms', [...(readCollection('publicForms') || []), lomake]);
  logAudit({ user: req.username, action: 'public_form_create', collection: 'publicForms', recordId: lomake.id, eventId });

  // Token palautetaan tässä, jotta QR-koodin voi näyttää heti luonnin jälkeen.
  res.json({ ok: true, lomake: julkinenLomake(lomake), token: lomake.token });
});

// Peruutus. Kuten jakolinkeillä: tietuetta ei poisteta vaan se merkitään peruutetuksi,
// koska jälkikäteen on tärkeämpää tietää mistä julisteesta ilmoitukset tulivat kuin
// pitää kokoelma siistinä. Saapuneet ilmoitukset viittaavat tähän id:hen.
app.delete('/api/publicforms/:id', requireAuth, (req, res) => {
  const lomakkeet = readCollection('publicForms') || [];
  const lomake = lomakkeet.find((l) => l.id === req.params.id);
  if (!lomake) return res.status(404).json({ ok: false, error: 'Ilmoituslomaketta ei löytynyt.' });
  if (req.role !== 'admin' && !canEdit(req.permissions, lomake.eventId, 'public_reports')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta poistaa tätä ilmoituslomaketta käytöstä.' });
  }
  writeCollection('publicForms', lomakkeet.map((l) => (l.id === lomake.id
    ? { ...l, revokedAt: new Date().toISOString(), revokedBy: req.username }
    : l)));
  logAudit({ user: req.username, action: 'public_form_revoke', collection: 'publicForms', recordId: lomake.id, eventId: lomake.eventId });
  res.json({ ok: true });
});

// --- Kierrospohjat ja kierrokset (P6 + proof of presence) -------------------------
//
// Pohjia ja kierroksia hallitaan omilla reiteillään eikä geneerisen kokoelmareitin
// kautta. Pohjilla syy on sama kuin julisteilla (token syntyy palvelimella), kierroksilla
// eri ja tärkeämpi: kierroksen säännöt ovat sen ainoa sisältö. Kierros joka voidaan
// merkitä valmiiksi vajaana ei todista mitään.

// Kierrospohjan oikeus kohteeseen. Pohja ja sen kierrokset ovat eri solmuja: pohjan
// muokkaus on esimiehen työtä, kierroksen kulkeminen vartijan.
function saaPohjia(req, siteId) {
  if (req.role === 'admin') return true;
  return eventAllowed(req.eventAccess, siteId) && canEdit(req.permissions, siteId, 'guard_patrol_templates');
}

function saaKiertaa(req, siteId) {
  if (req.role === 'admin') return true;
  return eventAllowed(req.eventAccess, siteId) && canEdit(req.permissions, siteId, 'guard_patrols');
}

// Tuoteportti erikseen: GUARD-puolen reitit eivät saa aueta tunnukselle jolla ei ole
// pääsyä sinne, vaikka sivukartta-oikeudet sattuisivat olemaan kunnossa.
const guardPortti = (req, res, next) => {
  if (!(req.tuotteet || []).includes('guard')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia vartiointipuolen tietoihin.' });
  }
  next();
};

app.post('/api/pohjat', requireAuth, guardPortti, (req, res) => {
  const { kind, ownerId, nimi, kuvaus, pisteet, sijaintiPakotus, sietorajaM } = req.body || {};
  if (!onTunnettuLaji(kind)) {
    return res.status(400).json({ ok: false, error: 'Tuntematon pohjalaji.' });
  }
  if (typeof ownerId !== 'string' || !ownerId) {
    return res.status(400).json({ ok: false, error: 'Kohde puuttuu.' });
  }
  if (!saaPohjia(req, ownerId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta muokata tämän kohteen kierrospohjia.' });
  }
  const kohde = (readCollection('guardSites') || []).find((k) => k.id === ownerId);
  if (!kohde) return res.status(404).json({ ok: false, error: 'Kohdetta ei löytynyt.' });

  const nimiTulos = tarkistaNimi(nimi);
  if (!nimiTulos.ok) return res.status(400).json({ ok: false, error: nimiTulos.error });
  const pisteTulos = tarkistaPisteet(pisteet, []);
  if (!pisteTulos.ok) return res.status(400).json({ ok: false, error: pisteTulos.error });

  const pohja = {
    id: crypto.randomUUID(),
    kind,
    ownerId,
    nimi: nimiTulos.nimi,
    kuvaus: puhdistaKuvaus(kuvaus),
    versio: 1,
    pisteet: pisteTulos.pisteet,
    // Sijaintipakotus on pohjakohtainen asetus joka on OLETUKSENA POIS (päätös V2 = a):
    // puhelimen paikannus on rakennuksen seinustalla epäluotettava, eikä kierros saa
    // katketa siihen. Sijainti tallennetaan silti aina todisteeksi.
    sijaintiPakotus: sijaintiPakotus === true,
    sietorajaM: Number.isFinite(Number(sietorajaM)) && Number(sietorajaM) > 0
      ? Math.round(Number(sietorajaM))
      : OLETUS_SIETORAJA_M,
    luotu: new Date().toISOString(),
    luoja: req.username,
    arkistoitu: null,
  };
  writeCollection('templates', [...(readCollection('templates') || []), pohja]);
  logAudit({ user: req.username, action: 'template_create', collection: 'templates', recordId: pohja.id, eventId: ownerId });
  res.json({ ok: true, pohja: julkinenPohja(pohja) });
});

app.put('/api/pohjat/:id', requireAuth, guardPortti, (req, res) => {
  const pohjat = readCollection('templates') || [];
  const vanha = pohjat.find((p) => p.id === req.params.id);
  if (!vanha) return res.status(404).json({ ok: false, error: 'Pohjaa ei löytynyt.' });
  if (!saaPohjia(req, vanha.ownerId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta muokata tätä pohjaa.' });
  }

  const nimiTulos = tarkistaNimi(req.body?.nimi ?? vanha.nimi);
  if (!nimiTulos.ok) return res.status(400).json({ ok: false, error: nimiTulos.error });
  const pisteTulos = tarkistaPisteet(req.body?.pisteet ?? vanha.pisteet, vanha.pisteet);
  if (!pisteTulos.ok) return res.status(400).json({ ok: false, error: pisteTulos.error });

  const paivitetty = {
    ...vanha,
    nimi: nimiTulos.nimi,
    kuvaus: puhdistaKuvaus(req.body?.kuvaus ?? vanha.kuvaus),
    pisteet: pisteTulos.pisteet,
    sijaintiPakotus: req.body?.sijaintiPakotus === undefined
      ? vanha.sijaintiPakotus === true
      : req.body.sijaintiPakotus === true,
    sietorajaM: Number.isFinite(Number(req.body?.sietorajaM)) && Number(req.body.sietorajaM) > 0
      ? Math.round(Number(req.body.sietorajaM))
      : (vanha.sietorajaM ?? OLETUS_SIETORAJA_M),
    muokattu: new Date().toISOString(),
    muokkaaja: req.username,
  };
  // Versio kasvaa vain jos pisteet muuttuivat: nimen korjaaminen ei tee kierroksesta
  // toista kierrosta, mutta pisteen lisääminen tekee.
  if (sisaltoMuuttui(vanha, paivitetty)) paivitetty.versio = (vanha.versio ?? 1) + 1;

  writeCollection('templates', pohjat.map((p) => (p.id === vanha.id ? paivitetty : p)));
  logAudit({ user: req.username, action: 'template_update', collection: 'templates', recordId: vanha.id, eventId: vanha.ownerId });
  res.json({ ok: true, pohja: julkinenPohja(paivitetty) });
});

// Arkistointi eikä poisto: jo tehdyt kierrokset viittaavat pohjaan, ja pohjan katoaminen
// tekisi niiden historiasta lukukelvotonta.
app.delete('/api/pohjat/:id', requireAuth, guardPortti, (req, res) => {
  const pohjat = readCollection('templates') || [];
  const pohja = pohjat.find((p) => p.id === req.params.id);
  if (!pohja) return res.status(404).json({ ok: false, error: 'Pohjaa ei löytynyt.' });
  if (!saaPohjia(req, pohja.ownerId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta poistaa tätä pohjaa käytöstä.' });
  }
  writeCollection('templates', pohjat.map((p) => (p.id === pohja.id
    ? { ...p, arkistoitu: new Date().toISOString(), arkistoija: req.username }
    : p)));
  logAudit({ user: req.username, action: 'template_archive', collection: 'templates', recordId: pohja.id, eventId: pohja.ownerId });
  res.json({ ok: true });
});

// Tarkistuspisteiden tokenit QR-tarroja varten. Erillinen reitti samasta syystä kuin
// jakolinkeillä ja julisteilla: token ei kulje jokaisessa listahaussa.
app.get('/api/pohjat/:id/tarrat', requireAuth, guardPortti, (req, res) => {
  const pohja = (readCollection('templates') || []).find((p) => p.id === req.params.id);
  if (!pohja) return res.status(404).json({ ok: false, error: 'Pohjaa ei löytynyt.' });
  if (!saaPohjia(req, pohja.ownerId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tämän pohjan tarroihin.' });
  }
  res.json({
    ok: true,
    nimi: pohja.nimi,
    pisteet: (pohja.pisteet || []).map((p) => ({ id: p.id, nimi: p.nimi, token: p.token })),
  });
});

// Kierroksen aloitus. Pisteet kopioidaan pohjasta (ks. kierros.js).
app.post('/api/kierros', requireAuth, guardPortti, (req, res) => {
  const { templateId } = req.body || {};
  const pohja = (readCollection('templates') || []).find((p) => p.id === templateId);
  if (!pohja || pohja.kind !== 'patrol') {
    return res.status(404).json({ ok: false, error: 'Kierrospohjaa ei löytynyt.' });
  }
  if (!saaKiertaa(req, pohja.ownerId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta kiertää tässä kohteessa.' });
  }

  const kierrokset = readCollection('patrolRuns') || [];
  // Yksi kesken oleva kierros kerrallaan samalle vartijalle samassa kohteessa. Kaksi
  // yhtä aikaa avointa kierrosta tarkoittaisi, ettei skannauksesta tiedä kumpaan se
  // kuuluu — ja unohtuneet avoimet kierrokset täyttäisivät listan.
  const auki = kierrokset.find(
    (k) => k.tila === 'kesken' && k.siteId === pohja.ownerId && k.vartija === req.username
  );
  if (auki) {
    return res.status(409).json({
      ok: false,
      error: 'Sinulla on jo kesken oleva kierros tässä kohteessa. Päätä se ensin.',
      kierrosId: auki.id,
    });
  }

  const tulos = aloitaKierros({
    pohja,
    siteId: pohja.ownerId,
    vartija: req.username,
    id: crypto.randomUUID(),
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('patrolRuns', [tulos.kierros, ...kierrokset]);
  logAudit({ user: req.username, action: 'patrol_start', collection: 'patrolRuns', recordId: tulos.kierros.id, eventId: pohja.ownerId });
  kerroKierroksesta(tulos.kierros, 'create');
  res.json({ ok: true, kierros: tulos.kierros });
});

// Kanavaviesti kierroksen muutoksesta. Sama periaate kuin yleisöilmoituksilla: viesti
// kuljettaa vain id:n, ja sisältö haetaan oikeustarkistetulta reitiltä.
function kerroKierroksesta(kierros, action) {
  lahetaKanavalle('patrolRuns', [{ action, id: kierros.id, eventId: kierros.siteId }], {
    saaNahda: (istunto, siteId) =>
      istunto?.role === 'admin' ||
      (eventAllowed(istunto?.eventAccess, siteId) && canView(rolePermissions(istunto?.roleId), siteId, 'guard_patrols')),
  });
}

// Tarkistuspisteen kuittaus. Piste voidaan yksilöidä joko id:llä (lista näkymässä) tai
// tokenilla (QR-tarra puhelimen kameralla) — jälkimmäinen on se tapa jolla tämä
// oikeasti tehdään kentällä.
// Tarran skannaus ilman että selain tietää mihin kierrokseen piste kuuluu.
//
// Näin tämä oikeasti tehdään kentällä: vartija skannaa tarran PUHELIMEN OMALLA
// kameralla, joka avaa selaimen osoitteeseen /guard?piste=<token>. Sovellus ei tuolloin
// tiedä pisteestä mitään — tokenit eivät kulje listahaussa — joten palvelin selvittää
// itse mihin pohjaan piste kuuluu ja onko vartijalla siihen kesken oleva kierros.
//
// Selaimeen ei siis tarvita QR-lukijakirjastoa eikä kameralupaa. Sama ratkaisu toimii
// myös vanhoilla puhelimilla, joissa selaimen BarcodeDetector puuttuu.
app.post('/api/kierros/skannaus', requireAuth, guardPortti, (req, res) => {
  const pohjat = readCollection('templates') || [];
  const osuma = etsiPisteTokenilla(pohjat, req.body?.token);
  if (!osuma) {
    return res.status(404).json({ ok: false, error: 'Tuntematon QR-koodi. Tarra ei kuulu yhteenkään kierrospohjaan.' });
  }
  const { pohja, piste } = osuma;
  if (!saaKiertaa(req, pohja.ownerId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta kiertää tässä kohteessa.' });
  }

  const kierrokset = readCollection('patrolRuns') || [];
  const auki = kierrokset.find(
    (k) => k.tila === 'kesken' && k.templateId === pohja.id && k.vartija === req.username
  );
  if (!auki) {
    // Ei virhe vaan tilanne: vartija skannasi ensimmäisen pisteen ennen kuin aloitti
    // kierroksen. Kerrotaan mistä pohjasta on kyse, jotta käyttöliittymä voi tarjota
    // aloitusta yhdellä painalluksella sen sijaan että käskisi etsimään sen itse.
    return res.status(409).json({
      ok: false,
      error: `Sinulla ei ole kesken olevaa kierrosta pohjalla "${pohja.nimi}".`,
      ehdotus: { templateId: pohja.id, pohjaNimi: pohja.nimi, siteId: pohja.ownerId, pisteNimi: piste.nimi },
    });
  }

  const tulos = kuittaaPiste({
    kierros: auki,
    pisteId: piste.id,
    tapa: 'qr',
    gps: tarkistaGps(req.body?.gps),
    huomio: req.body?.huomio,
    pakotaSijainti: pohja.sijaintiPakotus === true,
    sietorajaM: pohja.sietorajaM ?? OLETUS_SIETORAJA_M,
    toisto: req.body?.toisto === true,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  // Toisto jonosta: mikään ei muuttunut, joten levylle ei kirjoiteta eikä kanavalle
  // kerrota. Vastaus on silti ok, jotta jono poistaa kirjauksen listaltaan.
  if (tulos.duplikaatti) {
    return res.json({ ok: true, kierros: tulos.kierros, pisteNimi: piste.nimi, duplikaatti: true });
  }

  writeCollection('patrolRuns', kierrokset.map((k) => (k.id === auki.id ? tulos.kierros : k)));
  logAudit({ user: req.username, action: 'patrol_checkpoint', collection: 'patrolRuns', recordId: auki.id, eventId: auki.siteId });
  kerroKierroksesta(tulos.kierros, 'update');
  res.json({ ok: true, kierros: tulos.kierros, pisteNimi: piste.nimi });
});

app.post('/api/kierros/:id/piste', requireAuth, guardPortti, (req, res) => {
  const kierrokset = readCollection('patrolRuns') || [];
  const kierros = kierrokset.find((k) => k.id === req.params.id);
  if (!kierros) return res.status(404).json({ ok: false, error: 'Kierrosta ei löytynyt.' });
  if (!saaKiertaa(req, kierros.siteId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tähän kierrokseen.' });
  }
  // Kierros on henkilökohtainen: toisen vartijan kierrokseen ei kuitata pisteitä, koska
  // kuittaus on todiste siitä että JOKU oli paikalla — ja se joku on kierroksen tekijä.
  if (req.role !== 'admin' && kierros.vartija !== req.username) {
    return res.status(403).json({ ok: false, error: 'Kierros on toisen vartijan.' });
  }

  const pohja = (readCollection('templates') || []).find((p) => p.id === kierros.templateId);
  let pisteId = typeof req.body?.pisteId === 'string' ? req.body.pisteId : null;
  let tapa = 'kasin';
  if (!pisteId && typeof req.body?.token === 'string') {
    const osuma = etsiPisteTokenilla(pohja ? [pohja] : [], req.body.token);
    if (!osuma) {
      return res.status(404).json({ ok: false, error: 'QR-koodi ei kuulu tähän kierrokseen.' });
    }
    pisteId = osuma.piste.id;
    tapa = 'qr';
  }
  if (!pisteId) return res.status(400).json({ ok: false, error: 'Tarkistuspiste puuttuu.' });

  const tulos = kuittaaPiste({
    kierros,
    pisteId,
    tapa,
    gps: tarkistaGps(req.body?.gps),
    huomio: req.body?.huomio,
    pakotaSijainti: pohja?.sijaintiPakotus === true,
    sietorajaM: pohja?.sietorajaM ?? OLETUS_SIETORAJA_M,
    toisto: req.body?.toisto === true,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  if (tulos.duplikaatti) return res.json({ ok: true, kierros: tulos.kierros, duplikaatti: true });

  writeCollection('patrolRuns', kierrokset.map((k) => (k.id === kierros.id ? tulos.kierros : k)));
  logAudit({ user: req.username, action: 'patrol_checkpoint', collection: 'patrolRuns', recordId: kierros.id, eventId: kierros.siteId });
  kerroKierroksesta(tulos.kierros, 'update');
  res.json({ ok: true, kierros: tulos.kierros });
});

// Kierroksen päättäminen. Tässä on erän tärkein sääntö: valmis vaatii jokaisen pisteen,
// keskeytys vaatii syyn (ks. kierros.js).
app.post('/api/kierros/:id/paata', requireAuth, guardPortti, (req, res) => {
  const kierrokset = readCollection('patrolRuns') || [];
  const kierros = kierrokset.find((k) => k.id === req.params.id);
  if (!kierros) return res.status(404).json({ ok: false, error: 'Kierrosta ei löytynyt.' });
  if (!saaKiertaa(req, kierros.siteId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tähän kierrokseen.' });
  }
  if (req.role !== 'admin' && kierros.vartija !== req.username) {
    return res.status(403).json({ ok: false, error: 'Kierros on toisen vartijan.' });
  }

  const tulos = paataKierros({
    kierros,
    tila: req.body?.tila,
    syy: req.body?.syy,
    huomiot: req.body?.huomiot,
    toisto: req.body?.toisto === true,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  if (tulos.duplikaatti) return res.json({ ok: true, kierros: tulos.kierros, duplikaatti: true });

  writeCollection('patrolRuns', kierrokset.map((k) => (k.id === kierros.id ? tulos.kierros : k)));
  logAudit({
    user: req.username,
    action: tulos.kierros.tila === 'valmis' ? 'patrol_complete' : 'patrol_abort',
    collection: 'patrolRuns',
    recordId: kierros.id,
    eventId: kierros.siteId,
  });
  kerroKierroksesta(tulos.kierros, 'update');
  res.json({ ok: true, kierros: tulos.kierros });
});

// --- Hälytykset (erä 7) -----------------------------------------------------------
//
// Säännöt ovat halytys.js:ssä, tässä on niiden kytkentä: oikeudet, levylle kirjoitus,
// kanavaviesti ja tekstiviestieskalointi. Kaikki hälytysreitit ovat POST-reittejä eikä
// kokoelman PUT:ia käytetä lainkaan (PALVELIMEN_YLLAPITAMAT) — hälytys jonka selain voisi
// kirjoittaa olisi hälytys jonka selain voisi myös hiljaa poistaa.

// Hälytysreiteillä on oma rajoittimensa, ja se on tiukempi kuin muilla kirjoitusreiteillä:
// jokainen eskaloituva hälytys lähettää tekstiviestejä, eli kuluttaa saldoa. Rikkinäinen
// selain silmukassa ei saa tyhjentää tiliä. Raja on silti selvästi yli sen mitä yksi
// ihminen ehtii oikeasti painaa.
const halytysLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liian monta hälytystä lyhyessä ajassa. Jos kyseessä on hätätilanne, soita 112.' },
});

// Hälyttäminen vaatii LUKUoikeuden hälytyksiin — ei muokkausoikeutta. Ks. sivukartan
// perustelu (src/sivukartta.ts): muokkausoikeuden vaatiminen tarkoittaisi että osa
// kentällä olevista ei voisi hälyttää, ja se on juuri se joukko jonka takia toiminto on
// olemassa.
function saaHalyttaa(req, eventId) {
  if (req.role === 'admin') return true;
  if (!eventAllowed(req.eventAccess, eventId)) return false;
  return canView(req.permissions, eventId, 'alarms') || canView(req.permissions, eventId, 'guard_alarms');
}

// Kuittaaminen: oman hälytyksen saa kuitata aina, toisen vain muokkausoikeudella.
function saaKuitata(req, halytys) {
  if (req.role === 'admin') return true;
  if (halytys?.vartija === req.username) return true;
  if (!eventAllowed(req.eventAccess, halytys?.eventId)) return false;
  return canEdit(req.permissions, halytys?.eventId, 'alarms')
    || canEdit(req.permissions, halytys?.eventId, 'guard_alarms');
}

// Hälytys kuuluu joko tapahtumaan tai vartiointikohteeseen. Nimi ja vyöhykkeet haetaan
// samalla kysymyksellä molemmista, koska kutsuja ei tiedä kummasta on kyse — eikä sen
// tarvitse tietää.
function kohteenTiedot(eventId) {
  const tapahtuma = (readCollection('events') || []).find((e) => e?.id === eventId);
  if (tapahtuma) return { nimi: tapahtuma.name || '', vyohykkeet: Array.isArray(tapahtuma.zones) ? tapahtuma.zones : [] };
  const kohde = (readCollection('guardSites') || []).find((s) => s?.id === eventId);
  if (kohde) return { nimi: kohde.name || '', vyohykkeet: Array.isArray(kohde.zones) ? kohde.zones : [] };
  return { nimi: '', vyohykkeet: [] };
}

// Kanavaviesti hälytyksestä. Sama periaate kuin muualla: viesti kuljettaa vain id:n, ja
// sisältö haetaan oikeustarkistetulta reitiltä. `lahettaja`-ohitusta EI käytetä — myös
// hälyttäjän oma laite tarvitsee tiedon siitä että hänen hälytyksensä laukesi tai
// kuitattiin, koska sen jälkeen näkymän on muututtava.
function kerroHalytyksesta(halytys, action) {
  lahetaKanavalle('alerts', [{ action, id: halytys.id, eventId: halytys.eventId }], {
    saaNahda: (istunto, eventId) => {
      if (istunto?.role === 'admin') return true;
      if (!eventAllowed(istunto?.eventAccess, eventId)) return false;
      const perms = rolePermissions(istunto?.roleId);
      return canView(perms, eventId, 'alarms') || canView(perms, eventId, 'guard_alarms');
    },
  });
}

// Hälytyksen lähetystietue lähetyshistoriaan. Sama muoto kuin pikatoimintojen lähetyksillä,
// jotta BulkSMS:n webhook osaa liittää toimituskuittaukset oikeaan riviin (smswebhook.js) —
// hätäviestin kohdalla juuri toimitustieto on se mikä ratkaisee: lähtikö apu liikkeelle.
//
// Vastaanottajat sidotaan numeroihin JÄRJESTYKSESSÄ. Pikatoimintojen reitti tekee tässä
// tarkemman sovituksen, koska siellä numeroita voi olla tuhat; hälytyksen vastaanottajia on
// muutama, ja rajapinta palauttaa tulokset kuorman järjestyksessä.
function eskalointiLoki({ halytys, runko, vastaanottajat, uniikit, tulos }) {
  const haltija = new Map();
  for (const v of vastaanottajat) {
    if (v.numero && !haltija.has(v.numero)) haltija.set(v.numero, v);
  }
  return {
    id: `sms-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    ts: new Date().toISOString(),
    eventId: halytys.eventId,
    buttonId: `halytys:${halytys.tyyppi}`,
    label: `Hälytys: ${HALYTYSTYYPIT[halytys.tyyppi]?.label || halytys.tyyppi}`,
    group: 'emergency_numbers',
    user: halytys.vartija,
    body: runko,
    dryRun: tulos.dryRun,
    // Hälytysviestiin ei vastata tekstiviestillä vaan soittamalla. Vastauskanavan
    // avaaminen antaisi ymmärtää että vastausta luetaan jossain — sitä ei lueta.
    repliable: false,
    encoding: tulos.mitat?.encoding || null,
    parts: tulos.mitat?.osia ?? null,
    recipients: (tulos.tulokset || []).map((t, i) => {
      const numero = uniikit[i] || t.numero || null;
      const h = haltija.get(numero) || {};
      return {
        messageId: t.id === null || t.id === undefined ? null : String(t.id),
        nimi: h.nimi || null,
        rooli: h.rooli || null,
        numero: numero ? `${numero.slice(0, 5)}…${numero.slice(-3)}` : null,
        status: t.status,
        statusId: null,
        updatedAt: null,
      };
    }),
    skipped: vastaanottajat.filter((v) => !v.numero).map((v) => ({ nimi: v.nimi, syy: v.syy })),
  };
}

// Yhden hälytyksen eskalointi tekstiviestiksi. Palauttaa aina tuloksen eikä heitä:
// kutsuja merkitsee myös epäonnistumisen hälytykseen, jotta samaa viestiä ei yritetä
// lähettää uudelleen joka kierroksella.
async function eskaloiHalytys(halytys) {
  try {
    const { kohteenNimi, vastaanottajat, lahde } = halytysVastaanottajat({
      eventId: halytys.eventId,
      events: readCollection('events') || [],
      guardSites: readCollection('guardSites') || [],
    });
    const uniikit = [...new Set(vastaanottajat.map((v) => v.numero).filter(Boolean))];
    if (uniikit.length === 0) {
      return {
        ok: false,
        vastaanottajia: 0,
        virhe: lahde
          ? 'Yhtään kelvollista hälytysnumeroa ei löytynyt.'
          : 'Hälytysnumeroita ei ole määritetty tälle kohteelle.',
      };
    }

    const runko = viestiTeksti(halytys, { kohteenNimi });
    const tulos = await lahetaViestit({
      numerot: uniikit,
      body: runko,
      repliable: false,
      // Deduplikointi hälytyksen id:llä: jos sama hälytys yritetään eskaloida kahdesti
      // (palvelin käynnistyi uudelleen kesken lähetyksen), BulkSMS ei lähetä viestiä
      // toiseen kertaan.
      dedupId: Math.abs(hashDedup(`halytys|${halytys.id}`)),
    });
    if (!tulos.ok) return { ok: false, vastaanottajia: 0, virhe: tulos.virhe };

    const tietue = eskalointiLoki({ halytys, runko, vastaanottajat, uniikit, tulos });
    try {
      writeCollection('smsLog', [tietue, ...(readCollection('smsLog') || [])]);
    } catch (err) {
      // Historian kirjoitus ei saa kaataa eskalointia: viestit ovat jo lähteneet.
      console.error('Hälytyksen lähetyshistorian kirjoitus epäonnistui:', err.message);
    }
    return { ok: true, dryRun: tulos.dryRun, sendId: tietue.id, vastaanottajia: uniikit.length };
  } catch (err) {
    return { ok: false, vastaanottajia: 0, virhe: err.message };
  }
}

// Palvelimen hälytyskierros: erääntyneet ajastimet laukeavat ja lauenneet eskaloituvat.
//
// TÄMÄ ON KOKO ERÄN YDIN. Ajastin ei ole selaimessa, koska tajuton vartija ei paina
// mitään eikä sammunut puhelin aja ajastimia. Kymmenen sekunnin kierros on tarkkuus jolla
// määräaika toteutuu: minuutin tarkkuus riittäisi ajastimeen mutta ei eskalointiviiveisiin.
const HALYTYSKIERROS_MS = 10_000;
let halytyskierrosKay = false;

async function kasitteleHalytykset() {
  // Päällekkäisiä kierroksia ei ajeta: eskalointi odottaa verkkokutsua, ja kaksi
  // rinnakkaista kierrosta lähettäisi saman hälytyksen kahdesti.
  if (halytyskierrosKay) return;
  halytyskierrosKay = true;
  try {
    const nyt = Date.now();
    let lista = readCollection('alerts') || [];

    const kypsat = eraantyneet(lista, nyt);
    if (kypsat.length > 0) {
      const idt = new Set(kypsat.map((h) => h.id));
      const lauenneet = [];
      lista = lista.map((h) => {
        if (!idt.has(h.id)) return h;
        // Viimeksi tiedetty sijainti liitetään hälytykseen jos sellainen on. Se on
        // tavallisesti ainoa vihje siitä mistä ihmistä lähdetään etsimään.
        const tulos = laukaiseHalytys({ halytys: h, gps: haeSijainti(h.vartija)?.gps || null, nyt });
        if (!tulos.ok) return h;
        lauenneet.push(tulos.halytys);
        return tulos.halytys;
      });
      writeCollection('alerts', lista);
      for (const h of lauenneet) {
        logAudit({
          user: h.vartija, action: 'alarm_fired', collection: 'alerts',
          recordId: h.id, eventId: h.eventId, alarmType: h.tyyppi,
        });
        kerroHalytyksesta(h, 'update');
      }
    }

    for (const h of eskaloitavat(lista, nyt)) {
      const tulos = await eskaloiHalytys(h);
      // Kokoelma luetaan UUDELLEEN lähetyksen jälkeen: odotuksen aikana hälytys on voitu
      // kuitata tai uusia on voinut syntyä, eikä vanhaan kopioon kirjoittaminen saa
      // hukata niitä.
      const tuore = readCollection('alerts') || [];
      let paivitetty = null;
      writeCollection('alerts', tuore.map((x) => {
        if (x.id !== h.id) return x;
        paivitetty = merkitseEskaloitu({ halytys: x, tulos, nyt: Date.now() });
        return paivitetty;
      }));
      logAudit({
        user: h.vartija,
        action: tulos.ok ? 'alarm_escalated' : 'alarm_escalation_failed',
        collection: 'alerts', recordId: h.id, eventId: h.eventId, alarmType: h.tyyppi,
        recipients: tulos.vastaanottajia,
        ...(tulos.ok ? {} : { reason: tulos.virhe }),
      });
      if (paivitetty) kerroHalytyksesta(paivitetty, 'update');
    }
  } catch (err) {
    console.error('Hälytyskierros epäonnistui:', err.message);
  } finally {
    halytyskierrosKay = false;
  }
}

// Ajastimen käynnistys (lone worker). Vartija kertoo mitä on tekemässä ja kuinka kauan se
// saa kestää; jos kuittausta ei tule, hälytys laukeaa itsestään.
app.post('/api/halytys/ajastin', requireAuth, halytysLimiter, (req, res) => {
  const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId : null;
  if (!saaHalyttaa(req, eventId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta hälytyksiin tässä kohteessa.' });
  }

  const lista = readCollection('alerts') || [];
  // Yksi käynnissä oleva ajastin kerrallaan. Kaksi rinnakkaista tarkoittaisi, ettei
  // "olen kunnossa" -kuittauksesta tiedä kumpaa se koskee.
  const auki = lista.find((h) => h.tyyppi === 'ajastin' && h.tila === 'kaynnissa' && h.vartija === req.username);
  if (auki) {
    return res.status(409).json({ ok: false, error: 'Sinulla on jo käynnissä oleva ajastin.', halytys: auki });
  }

  const tulos = luoAjastin({
    id: crypto.randomUUID(),
    vartija: req.username,
    eventId,
    minuutit: req.body?.minuutit,
    kuvaus: req.body?.kuvaus,
    gps: req.body?.gps,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('alerts', [tulos.halytys, ...lista]);
  logAudit({
    user: req.username, action: 'alarm_timer_start', collection: 'alerts',
    recordId: tulos.halytys.id, eventId, minutes: tulos.halytys.kestoMin,
  });
  kerroHalytyksesta(tulos.halytys, 'create');

  // Kerrotaan heti onko kohteelle määritetty hälytysnumeroita. Vartijan on tiedettävä
  // ENNEN kuin hän luottaa ajastimeen, tavoittaako lauennut hälytys ketään.
  const { vastaanottajat } = halytysVastaanottajat({
    eventId,
    events: readCollection('events') || [],
    guardSites: readCollection('guardSites') || [],
  });
  res.json({
    ok: true,
    halytys: tulos.halytys,
    eskalointiNumeroita: vastaanottajat.filter((v) => v.numero).length,
  });
});

// Hätäpainike ja man-down. Molemmat syntyvät suoraan lauenneina, ja ero on vain siinä
// kuka ne laukaisi: ihminen vai laite.
app.post('/api/halytys', requireAuth, halytysLimiter, (req, res) => {
  const tyyppi = req.body?.tyyppi;
  if (tyyppi !== 'panic' && tyyppi !== 'mandown') {
    return res.status(400).json({ ok: false, error: 'Tuntematon hälytystyyppi.' });
  }
  const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId : null;
  if (!saaHalyttaa(req, eventId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta hälytyksiin tässä kohteessa.' });
  }

  const lista = readCollection('alerts') || [];
  // Saman hälytyksen toistopainallus (verkko takkusi, käyttäjä painoi uudestaan) ei saa
  // synnyttää toista hälytystä eikä toista tekstiviestiä. Palautetaan jo olemassa oleva.
  const auki = lista.find((h) => h.tyyppi === tyyppi && h.tila === 'lauennut' && h.vartija === req.username);
  if (auki) return res.json({ ok: true, halytys: auki, jokoOlemassa: true });

  const tulos = luoHalytys({
    id: crypto.randomUUID(),
    tyyppi,
    vartija: req.username,
    eventId,
    kuvaus: req.body?.kuvaus,
    gps: req.body?.gps,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('alerts', [tulos.halytys, ...lista]);
  logAudit({
    user: req.username, action: 'alarm_raised', collection: 'alerts',
    recordId: tulos.halytys.id, eventId, alarmType: tyyppi,
  });
  kerroHalytyksesta(tulos.halytys, 'create');
  // Eskalointi tehdään hälytyskierroksella eikä tässä: vastaus ei saa odottaa ulkoista
  // HTTP-kutsua BulkSMS:ään. Hätäpainikkeen viive on nolla, joten viesti lähtee
  // seuraavalla kierroksella eli enintään kymmenen sekunnin kuluttua.
  res.json({ ok: true, halytys: tulos.halytys });
});

// "Olen kunnossa": ajastin alkaa alusta. Vain oma ajastin — toisen puolesta kuittaaminen
// tarkoittaisi, että kuittaus ei enää todista kenenkään olevan kunnossa.
app.post('/api/halytys/:id/jatka', requireAuth, (req, res) => {
  const lista = readCollection('alerts') || [];
  const halytys = lista.find((h) => h.id === req.params.id);
  if (!halytys) return res.status(404).json({ ok: false, error: 'Hälytystä ei löytynyt.' });
  if (halytys.vartija !== req.username) {
    return res.status(403).json({ ok: false, error: 'Ajastin on toisen käyttäjän.' });
  }

  const tulos = jatkaHalytysta({ halytys, minuutit: req.body?.minuutit, user: req.username });
  if (!tulos.ok) return res.status(409).json({ ok: false, error: tulos.error, halytys });

  writeCollection('alerts', lista.map((h) => (h.id === halytys.id ? tulos.halytys : h)));
  kerroHalytyksesta(tulos.halytys, 'update');
  res.json({ ok: true, halytys: tulos.halytys });
});

// Ajastimen lopetus: vuoro päättyi eikä valvontaa enää tarvita.
app.post('/api/halytys/:id/peru', requireAuth, (req, res) => {
  const lista = readCollection('alerts') || [];
  const halytys = lista.find((h) => h.id === req.params.id);
  if (!halytys) return res.status(404).json({ ok: false, error: 'Hälytystä ei löytynyt.' });
  if (halytys.vartija !== req.username && req.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Ajastin on toisen käyttäjän.' });
  }

  const tulos = peruHalytys({ halytys, user: req.username });
  if (!tulos.ok) return res.status(409).json({ ok: false, error: tulos.error, halytys });

  writeCollection('alerts', lista.map((h) => (h.id === halytys.id ? tulos.halytys : h)));
  logAudit({
    user: req.username, action: 'alarm_timer_cancel', collection: 'alerts',
    recordId: halytys.id, eventId: halytys.eventId,
  });
  kerroHalytyksesta(tulos.halytys, 'update');
  res.json({ ok: true, halytys: tulos.halytys });
});

// Lauenneen hälytyksen kuittaus. Tämä on se toimenpide joka päättää hälytyksen — ei
// tekstiviestin lähtö eikä se että joku katsoi näkymää.
app.post('/api/halytys/:id/kuittaa', requireAuth, (req, res) => {
  const lista = readCollection('alerts') || [];
  const halytys = lista.find((h) => h.id === req.params.id);
  if (!halytys) return res.status(404).json({ ok: false, error: 'Hälytystä ei löytynyt.' });
  if (!saaKuitata(req, halytys)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta kuitata tätä hälytystä.' });
  }

  const tulos = kuittaaHalytys({ halytys, user: req.username, huomio: req.body?.huomio });
  if (!tulos.ok) return res.status(409).json({ ok: false, error: tulos.error, halytys });

  writeCollection('alerts', lista.map((h) => (h.id === halytys.id ? tulos.halytys : h)));
  logAudit({
    user: req.username, action: 'alarm_acknowledged', collection: 'alerts',
    recordId: halytys.id, eventId: halytys.eventId, alarmType: halytys.tyyppi,
  });
  kerroHalytyksesta(tulos.halytys, 'update');
  res.json({ ok: true, halytys: tulos.halytys });
});

// Lähimmät kentällä olijat annettuun pisteeseen. Tämä oli alun perin tehtävien
// ohjaamista varten ("kuka on lähinnä porttia 3"), ja hälytys on sen tärkein käyttötapaus:
// kun joku painaa hätäpainiketta, ensimmäinen kysymys on kuka ehtii paikalle.
//
// Vaatii sijaintiseurannan. Ilman sitä palvelin ei tiedä kenenkään sijaintia, eikä
// arvausta pidä esittää vastauksena — `kaytossa: false` kertoo käyttöliittymälle että
// toimintoa ei ole, jolloin se ei lupaa sitä.
app.get('/api/lahin', requireAuth, (req, res) => {
  if (!seurantaKaytossa()) return res.json({ ok: true, kaytossa: false, vartijat: [] });
  const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : null;
  const saa =
    req.role === 'admin' ||
    (eventAllowed(req.eventAccess, eventId) && canView(req.permissions, eventId, 'locations'));
  if (!saa) return res.status(403).json({ ok: false, error: 'Ei oikeutta henkilöstön sijainteihin.' });

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ ok: false, error: 'Anna lat ja lon.' });
  }

  const vartijat = sijainnit({ eventId })
    .map((s) => ({
      username: s.username,
      ikaMs: s.ikaMs,
      gps: s.gps,
      etaisyysM: etaisyysMetreina({ lat, lon }, s.gps),
    }))
    // Ilman GPS:ää ei voi laskea etäisyyttä. Kuvakoordinaatti ei kelpaa: pohjakuvan
    // mittakaava ei ole metrejä, eikä "0,3 kuvan leveydestä" ole vastaus kysymykseen
    // kuka ehtii nopeimmin.
    .filter((v) => v.etaisyysM !== null)
    .sort((a, b) => a.etaisyysM - b.etaisyysM)
    .slice(0, 10);

  res.json({ ok: true, kaytossa: true, vartijat });
});
// QR-koodin muodostus. Yleiskäyttöinen tarkoituksella: erä 5:n tarkistuspisteet
// tarvitsevat täsmälleen saman toiminnon, eikä sitä pidä kirjoittaa silloin toiseen
// kertaan. Koodi muodostetaan palvelimella, koska qrcode-kirjasto on jo palvelimen
// riippuvuutena (TOTP-koodit) — sen lisääminen myös selainnippuun kasvattaisi buildia
// turhaan, ja CSP estää sen hakemisen ulkopuolelta.
//
// Sisältö tulee pyynnön rungosta eikä osoitteesta: julisteen osoite sisältää tokenin,
// eikä sen kuulu päätyä nginxin access.logiin.
app.post('/api/qr', requireAuth, async (req, res) => {
  const teksti = String(req.body?.teksti ?? '');
  if (!teksti || teksti.length > 1024) {
    return res.status(400).json({ ok: false, error: 'QR-koodin sisältö puuttuu tai on liian pitkä.' });
  }
  try {
    // Korkea virheenkorjaustaso: juliste on ulkona sateessa ja likaantuu, ja osittain
    // vahingoittunut koodi luetaan silti.
    const dataUri = await QRCode.toDataURL(teksti, { width: 512, margin: 1, errorCorrectionLevel: 'H' });
    res.json({ ok: true, dataUri });
  } catch {
    res.status(500).json({ ok: false, error: 'QR-koodin muodostus epäonnistui.' });
  }
});

// Etsii jakolinkin tokenilla. Vakioaikainen vertailu jokaista vastaan, jottei
// vastausaika kerro kuinka moni merkki osui.
function etsiJako(token) {
  const shares = readCollection('fileShares') || [];
  return shares.find((sh) => tokenTasmaa(token, sh.token)) || null;
}

// Jaon tiedot ilman tiedostoa: käyttöliittymä kysyy tällä tarvitaanko salasana ja
// mitä ollaan lataamassa, ennen kuin näyttää lomakkeen.
app.get('/api/share/:token', shareLimiter, (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const share = etsiJako(req.params.token);
  const tila = jaonTila(share);
  if (!tila.ok) {
    // Kaikki estot palautetaan 404:llä: 403 kertoisi että token on olemassa.
    return res.status(404).json({ ok: false, error: TILAN_SELITE[tila.syy] || TILAN_SELITE.not_found });
  }
  const tiedostot = readCollection('eventFiles') || [];
  const kohde = tiedostot.find((f) => f.id === share.targetId);
  if (!kohde) return res.status(404).json({ ok: false, error: TILAN_SELITE.not_found });

  // Kansiojaossa listataan sisältö, jotta vastaanottaja näkee mitä on tarjolla.
  const sisalto = kohde.type === 'folder'
    ? tiedostot
        .filter((f) => kuuluuJakoon(share.targetId, f.id, tiedostot) && f.id !== kohde.id)
        .map((f) => ({ id: f.id, name: f.name, type: f.type, parentId: f.parentId, size: f.size }))
    : [];

  res.json({
    ok: true,
    name: kohde.name,
    type: kohde.type,
    requiresPassword: !!share.passwordHash,
    expiresAt: share.expiresAt,
    contents: sisalto,
  });
});

// Varsinainen lataus. Salasana tulee POST-rungossa eikä URL:ssa: kyselyparametrit
// päätyvät palvelinlokeihin ja selainhistoriaan.
app.post('/api/share/:token/download', shareLimiter, (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const { password, fileId } = req.body || {};
  const share = etsiJako(req.params.token);
  const tila = jaonTila(share);
  if (!tila.ok) {
    return res.status(404).json({ ok: false, error: TILAN_SELITE[tila.syy] || TILAN_SELITE.not_found });
  }
  if (!salasanaTasmaa(password, share.passwordHash)) {
    logAudit({ user: 'share:' + share.id, action: 'share_bad_password', ip: req.ip });
    return res.status(401).json({ ok: false, error: 'Väärä salasana.' });
  }

  const tiedostot = readCollection('eventFiles') || [];
  // Kansiojaossa kutsuja kertoo minkä tiedoston haluaa; se on tarkistettava kuuluvaksi
  // jaettuun alipuuhun JOKA latauksella — kansion sisältö muuttuu jaon luonnin jälkeen.
  const haettuId = fileId || share.targetId;
  const kohde = tiedostot.find((f) => f.id === haettuId);
  if (!kohde || kohde.type !== 'file' || !kuuluuJakoon(share.targetId, haettuId, tiedostot)) {
    return res.status(404).json({ ok: false, error: TILAN_SELITE.not_found });
  }
  const polku = getUploadPath(kohde.uploadId);
  if (!polku) return res.status(404).json({ ok: false, error: TILAN_SELITE.not_found });

  // Latausloki: ilman tätä linkin vuotamista ei havaitse mitenkään.
  try {
    const shares = readCollection('fileShares') || [];
    writeCollection('fileShares', shares.map((sh) => (sh.id === share.id
      ? {
          ...sh,
          downloadCount: (sh.downloadCount || 0) + 1,
          lastDownloadAt: new Date().toISOString(),
          lastDownloadIp: req.ip,
        }
      : sh)));
  } catch (err) {
    // Laskurin päivitys ei saa estää itse latausta.
    console.error('Jakolinkin latauslaskurin päivitys epäonnistui:', err.message);
  }
  logAudit({ user: 'share:' + share.id, action: 'share_download', recordId: kohde.id, ip: req.ip });
  res.download(polku, kohde.name);
});

// Pääkäyttäjän hyväksyntä pysyvälle linkille.
app.post('/api/shares/:id/approval', requireAuth, requireAdmin, (req, res) => {
  const { approve } = req.body || {};
  const shares = readCollection('fileShares') || [];
  const share = shares.find((sh) => sh.id === req.params.id);
  if (!share) return res.status(404).json({ ok: false, error: 'Jakolinkkiä ei löytynyt.' });
  if (share.approvalStatus !== 'pending') {
    return res.status(400).json({ ok: false, error: 'Tämä jakolinkki ei odota hyväksyntää.' });
  }
  const paivitetty = approve
    // Hyväksyntä poistaa määräajan: linkistä tulee pysyvä kuten pyydettiin.
    ? { ...share, approvalStatus: 'approved', expiresAt: null, approvedBy: req.username, approvedAt: new Date().toISOString() }
    // Hylkäys ei poista linkkiä vaan jättää sen alkuperäiseen määräaikaansa.
    : { ...share, approvalStatus: 'rejected', approvedBy: req.username, approvedAt: new Date().toISOString() };
  writeCollection('fileShares', shares.map((sh) => (sh.id === share.id ? paivitetty : sh)));
  logAudit({ user: req.username, action: approve ? 'share_approved' : 'share_rejected', recordId: share.id });
  res.json({ ok: true, share: julkinenJako(paivitetty) });
});

// Jakolinkin luonti. Oma reittinsä eikä /api/data/fileShares, koska token on luotava
// ja salasana hashattava palvelimella — kumpaakaan ei voi tehdä selaimessa.
app.post('/api/shares', requireAuth, (req, res) => {
  const { targetId, mode, password, expiresAt, ikuinen, maxDownloads, allowedUsernames } = req.body || {};
  const tiedostot = readCollection('eventFiles') || [];
  const kohde = tiedostot.find((f) => f.id === targetId);
  if (!kohde) return res.status(404).json({ ok: false, error: 'Jaettavaa kohdetta ei löytynyt.' });

  // Jakaminen vaatii muokkausoikeuden tiedostosivulle SIINÄ tapahtumassa johon kohde
  // kuuluu — lukuoikeus ei riitä, koska jakaminen laajentaa pääsyn sovelluksen ulkopuolelle.
  if (req.role !== 'admin' && !canEdit(req.permissions, kohde.eventId, 'eventfiles')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta jakaa tämän tapahtuman tiedostoja.' });
  }
  if (!['link', 'password', 'users'].includes(mode)) {
    return res.status(400).json({ ok: false, error: 'Tuntematon jakotapa.' });
  }

  // Henkilötietolippu peritään myös yläkansioilta: alikansioon laitettu tiedosto ei saa
  // kiertää rajoitusta sillä että lippu on vain juurikansiossa.
  const henkilotietoa = !!kohde.containsPersonalData
    || tiedostot.some((f) => f.containsPersonalData && kuuluuJakoon(f.id, kohde.id, tiedostot) && f.id !== kohde.id);

  if (mode === 'link' && henkilotietoa) {
    return res.status(400).json({
      ok: false,
      error: 'Henkilötietoa sisältävää kohdetta ei voi jakaa pelkällä linkillä. Valitse salasanasuojaus tai jakaminen nimetyille käyttäjille.',
    });
  }
  if (mode === 'password' && (typeof password !== 'string' || password.length < 8)) {
    return res.status(400).json({ ok: false, error: 'Salasanan tulee olla vähintään 8 merkkiä.' });
  }
  if (mode === 'users' && (!Array.isArray(allowedUsernames) || allowedUsernames.length === 0)) {
    return res.status(400).json({ ok: false, error: 'Valitse vähintään yksi käyttäjä.' });
  }

  // Nimetyille käyttäjille jaettu ei kulje tokenilla lainkaan: he kirjautuvat normaalisti,
  // joten linkkiä ei tarvita eikä sen vanhentumista ratkaista.
  const onTokenJako = mode !== 'users';
  let voimassaolo = { expiresAt: null, approvalStatus: 'none' };
  if (onTokenJako) {
    voimassaolo = ratkaiseVoimassaolo(
      { expiresAt, ikuinen, henkilotietoa, onAdmin: req.role === 'admin' },
      new Date()
    );
    if (voimassaolo.error) return res.status(400).json({ ok: false, error: voimassaolo.error });
  }

  const share = {
    id: crypto.randomUUID(),
    eventId: kohde.eventId,
    targetId,
    mode,
    token: onTokenJako ? luoToken() : null,
    passwordHash: mode === 'password' ? hashaaSalasana(password) : null,
    allowedUsernames: mode === 'users' ? allowedUsernames.filter((u) => typeof u === 'string') : [],
    expiresAt: voimassaolo.expiresAt,
    approvalStatus: voimassaolo.approvalStatus,
    maxDownloads: Number.isFinite(maxDownloads) && maxDownloads > 0 ? maxDownloads : null,
    downloadCount: 0,
    lastDownloadAt: null,
    lastDownloadIp: null,
    createdBy: req.username,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  const shares = readCollection('fileShares') || [];
  writeCollection('fileShares', [...shares, share]);
  logAudit({ user: req.username, action: 'share_create', recordId: share.id, eventId: kohde.eventId });

  // Token palautetaan tässä, jotta käyttöliittymä voi näyttää linkin heti.
  res.json({ ok: true, share: julkinenJako(share), token: share.token });
});

// Tokenin näyttäminen uudelleen. Erillinen reitti, jotta token ei kulje jokaisessa
// listahaussa mukana — sitä tarvitaan vain kun käyttäjä pyytää linkin nähtäväkseen.
app.get('/api/shares/:id/token', requireAuth, (req, res) => {
  const shares = readCollection('fileShares') || [];
  const share = shares.find((sh) => sh.id === req.params.id);
  if (!share) return res.status(404).json({ ok: false, error: 'Jakolinkkiä ei löytynyt.' });
  if (req.role !== 'admin' && !canEdit(req.permissions, share.eventId, 'eventfiles')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tähän jakolinkkiin.' });
  }
  res.json({ ok: true, token: share.token });
});

// Peruutus. Ei poista tietuetta vaan merkitsee sen peruutetuksi: latausloki ja tieto
// siitä kuka linkin loi ovat jälkikäteen tärkeämpiä kuin siisti tietokanta.
app.delete('/api/shares/:id', requireAuth, (req, res) => {
  const shares = readCollection('fileShares') || [];
  const share = shares.find((sh) => sh.id === req.params.id);
  if (!share) return res.status(404).json({ ok: false, error: 'Jakolinkkiä ei löytynyt.' });
  if (req.role !== 'admin' && !canEdit(req.permissions, share.eventId, 'eventfiles')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta peruuttaa tätä jakolinkkiä.' });
  }
  writeCollection('fileShares', shares.map((sh) => (sh.id === share.id
    ? { ...sh, revokedAt: new Date().toISOString(), revokedBy: req.username }
    : sh)));
  logAudit({ user: req.username, action: 'share_revoke', recordId: share.id, eventId: share.eventId });
  res.json({ ok: true });
});

// Käyttäjälle erikseen jaetut tiedostot ja kansiot ("Minulle jaetut").
//
// Oma reittinsä eikä /api/data/fileShares, koska vastaanottajalla EI välttämättä ole
// oikeutta kyseisen tapahtuman tiedostosivulle eikä pääsyä tapahtumaan lainkaan —
// jakaminen on juuri se mekanismi joka antaa pääsyn tähän yhteen kohteeseen.
// Palautetaan vain se mikä vastaanottajalle kuuluu: kohteen nimi ja ladattavat
// tiedostot, ei koko jakotietuetta.
app.get('/api/shares/for-me', requireAuth, (req, res) => {
  const shares = readCollection('fileShares') || [];
  const tiedostot = readCollection('eventFiles') || [];
  const nyt = new Date();

  const omat = shares.filter((sh) => {
    if (sh.mode !== 'users' || sh.revokedAt) return false;
    if (!(sh.allowedUsernames || []).includes(req.username)) return false;
    if (sh.expiresAt && new Date(sh.expiresAt) <= nyt) return false;
    return true;
  });

  const tulos = omat.map((sh) => {
    const kohde = tiedostot.find((f) => f.id === sh.targetId);
    if (!kohde) return null;
    // Kansiojaossa listataan koko alipuun tiedostot, kuten julkisessakin jaossa.
    const sisalto = kohde.type === 'folder'
      ? tiedostot
          .filter((f) => f.type === 'file' && kuuluuJakoon(sh.targetId, f.id, tiedostot))
          .map((f) => ({ id: f.id, name: f.name, uploadId: f.uploadId, size: f.size }))
      : [{ id: kohde.id, name: kohde.name, uploadId: kohde.uploadId, size: kohde.size }];
    return {
      shareId: sh.id,
      name: kohde.name,
      type: kohde.type,
      eventId: kohde.eventId,
      sharedBy: sh.createdBy,
      sharedAt: sh.createdAt,
      expiresAt: sh.expiresAt,
      files: sisalto,
    };
  }).filter(Boolean);

  res.json({ ok: true, shares: tulos });
});

// Pääkäyttäjän hyväksyntää odottavat jakolinkit ilmoituskelloa varten. Erillinen
// kevyt reitti, jotta kelloa varten ei tarvitse hakea koko fileShares-kokoelmaa
// (johon ei-adminilla ei välttämättä ole lukuoikeutta lainkaan).
app.get('/api/notifications', requireAuth, (req, res) => {
  const ilmoitukset = [];

  if (req.role === 'admin') {
    const shares = readCollection('fileShares') || [];
    const tiedostot = readCollection('eventFiles') || [];
    for (const sh of shares) {
      if (sh.approvalStatus !== 'pending' || sh.revokedAt) continue;
      const kohde = tiedostot.find((f) => f.id === sh.targetId);
      ilmoitukset.push({
        id: `share-approval-${sh.id}`,
        tyyppi: 'share_approval',
        otsikko: 'Pysyvä jakolinkki odottaa hyväksyntää',
        kuvaus: `${sh.createdBy} pyytää pysyvää linkkiä: ${kohde?.name || 'poistettu kohde'}`,
        aika: sh.createdAt,
        eventId: sh.eventId,
        kohdeId: sh.id,
      });
    }
  }

  ilmoitukset.sort((a, b) => String(b.aika || '').localeCompare(String(a.aika || '')));
  res.json({ ok: true, notifications: ilmoitukset });
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
  // Tapahtuman tiedostot ja niiden jaot mukaan: liite voi kuulua myös eventFiles-
  // tietueeseen, ja käyttäjälle erikseen jaettu tiedosto avautuu ilman tapahtumaoikeutta.
  const filesArr = readCollection('eventFiles') || [];
  const sharesArr = readCollection('fileShares') || [];
  const tapahtumaPuoli = canReadAttachment(
    req.role, req.permissions, req.eventAccess, req.params.id,
    reportsArr, eventsArr, filesArr, sharesArr, req.username
  );
  // GUARD-liitteet tarkistetaan erikseen, ja vain jos käyttäjällä on pääsy sille puolelle:
  // pelkkä liitteen id ei saa avata vartiointipuolen tiedostoa tunnukselle joka ei pääse
  // sinne lainkaan. Sama portti kuin /api/data-reiteillä (tuoteEstaa).
  const guardPuoli = !tapahtumaPuoli
    && (req.tuotteet || []).includes('guard')
    && canReadGuardAttachment(
      req.role, req.permissions, req.eventAccess, req.params.id,
      readCollection('guardFiles') || [], readCollection('guardReports') || [],
      readCollection('guardSites') || []
    );
  if (!tapahtumaPuoli && !guardPuoli) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän liitteen lataamiseen.' });
  }
  res.sendFile(filePath);
});

// ====================== HÄTÄTEKSTIVIESTIT (BulkSMS) ======================
//
// Pikatoiminnot-valikon napit lähettävät tekstiviestin BulkSMS:n JSON REST API:n kautta.
// API-tunnukset ovat VAIN palvelimella (ympäristömuuttujat, ks. bulksms.js) — selain ei
// näe niitä eikä puhu rajapinnan kanssa suoraan. Yhtä lailla tärkeää: vastaanottajien
// numerot ratkaistaan palvelimella napin id:n perusteella (sms.js), eikä niitä oteta
// pyynnön rungosta. Muuten kuka tahansa kirjautunut voisi lähettää tililtä viestejä
// mihin tahansa numeroon.

// Hätätilanteessa napista voi tulla painetuksi useaan kertaan, ja jokainen painallus
// maksaa saldoa. Raja on väljä oikealle käytölle (tilanne voi vaatia useita viestejä
// peräkkäin) mutta pysäyttää silmukan tai väärinkäytön.
const smsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liian monta viestilähetystä lyhyessä ajassa. Odota hetki.' },
});

// Saa käyttäjä lähettää hätäviestin? Nappien NÄKEMINEN riittää valikon näyttämiseen
// (smsButtons-kokoelman lukuoikeus), mutta lähettäminen vaatii erikseen quickactions-
// solmun muokkausoikeuden. Näin esim. järjestyksenvalvoja voi nähdä mitä nappeja on
// olemassa ilman että hän voi laukaista massaviestin.
function saaLahettaa(req) {
  if (req.role === 'admin') return true;
  // eventId on null koska 'quickactions' on globaali solmu (ks. permissions.js
  // GLOBAL_NODES): oikeus luetaan aina __default__-bucketista eikä sitä voi asettaa
  // tapahtumakohtaisesti. Sama kutsu kuin frontissa (src/App.tsx).
  return canEdit(req.permissions, null, 'quickactions');
}

// Integraation tila käyttöliittymälle: onko tunnukset asetettu, ja paljonko saldoa on
// jäljellä. Saldo haetaan rajapinnasta vain pyydettäessä (ei taustasilmukkaa), koska
// näkymä avataan harvoin eikä jatkuva kysely ole tarpeen.
app.get('/api/sms/status', requireAuth, async (req, res) => {
  if (!saaLahettaa(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia hätäviestien lähettämiseen.' });
  }
  // Webhookin tila kerrotaan myös ilman API-tunnuksia: se on oma asetuksensa, ja
  // puuttuva salaisuus tarkoittaa ettei toimitusraportteja saada vaikka viestit lähtisivät.
  const webhook = {
    webhookKaytossa: Boolean(process.env.BULKSMS_WEBHOOK_SECRET),
    jonossa: jononPituus(),
  };
  if (!onkoKonfiguroitu()) {
    return res.json({ ok: true, konfiguroitu: false, dryRun: true, ...webhook });
  }
  // pakota=1 ohittaa välimuistin ("Tarkista nyt" asetuksissa); muuten riittää
  // taustavahdin viimeisin tulos eikä valikon avaaminen tee ulkoista HTTP-kutsua.
  const saldo = (await saldoTiedot(req.query.pakota === '1' ? 0 : undefined)) || { ok: false, virhe: 'Saldoa ei ole vielä tarkistettu.' };
  // `ok` kertoo että TÄMÄ pyyntö onnistui, ei että BulkSMS vastasi — saldon haun oma
  // tulos kulkee erillisissä kentissä. Jos saldo.ok levitettäisiin tähän sellaisenaan,
  // se ylikirjoittaisi ok:n false:ksi, jolloin frontti hylkäisi koko vastauksen eikä
  // näyttäisi virhettä lainkaan (integraation tila jäisi näyttämään "ei tarkistettu").
  res.json({
    ok: true,
    konfiguroitu: true,
    dryRun: false,
    ...webhook,
    saldoLuettu: saldo.ok === true,
    saldo: saldo.saldo ?? null,
    kiintioJaljella: saldo.kiintioJaljella ?? null,
    kiintioKoko: saldo.kiintioKoko ?? null,
    saldoTarkistettu: saldo.tarkistettu || null,
    varoitusraja: SALDO_VAROITUSRAJA,
    virhe: saldo.virhe || null,
  });
});

// Napin vastaanottajien esikatselu ennen lähetystä: ketkä saavat viestin ja ketkä eivät
// (numero puuttuu tai on kelvoton). Erillinen reitti lähetyksestä, jotta vahvistusnäkymä
// voidaan näyttää ilman että mitään lähtee liikkeelle.
app.get('/api/sms/recipients', requireAuth, (req, res) => {
  if (!saaLahettaa(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia hätäviestien lähettämiseen.' });
  }
  const { buttonId, eventId } = req.query;
  if (typeof buttonId !== 'string' || typeof eventId !== 'string') {
    return res.status(400).json({ ok: false, error: 'buttonId ja eventId vaaditaan.' });
  }
  // Tapahtumarajaus koskee myös tätä: käyttäjä ei saa nähdä (eikä siis lähettää) toisen
  // tapahtuman työntekijöiden numeroita, vaikka nappilista on yhteinen.
  if (req.role !== 'admin' && Array.isArray(req.eventAccess) && req.eventAccess.length > 0
      && !req.eventAccess.includes(eventId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tähän tapahtumaan.' });
  }

  const napit = kaytossaOlevatNapit(readCollection('smsButtons'));
  const nappi = napit.find((n) => n.id === buttonId);
  if (!nappi) return res.status(404).json({ ok: false, error: 'Tuntematon pikatoimintonappi.' });

  const events = readCollection('events') || [];
  const vastaanottajat = ratkaiseVastaanottajat(nappi, {
    eventId,
    checkins: readCollection('checkins') || [],
    employees: readCollection('employees') || [],
    events,
  });
  const tapahtumanNimi = events.find((e) => e?.id === eventId)?.name || '';
  const runko = taytaPaikkamerkit(nappi.body, { tapahtumanNimi });

  res.json({
    ok: true,
    nappi: { id: nappi.id, label: nappi.label, group: nappi.group, repliable: nappi.repliable },
    runko,
    mitat: laskeViesti(runko),
    // Numerot palautetaan peitettyinä: vahvistusnäkymä tarvitsee vain tiedon KENELLE
    // viesti lähtee, ei työntekijöiden puhelinnumeroita selaimen muistiin.
    vastaanottajat: vastaanottajat.map((v) => ({
      nimi: v.nimi,
      rooli: v.rooli,
      ok: Boolean(v.numero),
      numero: v.numero ? `${v.numero.slice(0, 5)}…${v.numero.slice(-3)}` : null,
      syy: v.syy || null,
    })),
  });
});

app.post('/api/sms/send', requireAuth, smsLimiter, async (req, res) => {
  if (!saaLahettaa(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia hätäviestien lähettämiseen.' });
  }
  const { buttonId, eventId, body } = req.body || {};
  if (typeof buttonId !== 'string' || typeof eventId !== 'string') {
    return res.status(400).json({ ok: false, error: 'buttonId ja eventId vaaditaan.' });
  }
  if (req.role !== 'admin' && Array.isArray(req.eventAccess) && req.eventAccess.length > 0
      && !req.eventAccess.includes(eventId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tähän tapahtumaan.' });
  }

  const napit = kaytossaOlevatNapit(readCollection('smsButtons'));
  const nappi = napit.find((n) => n.id === buttonId);
  if (!nappi) return res.status(404).json({ ok: false, error: 'Tuntematon pikatoimintonappi.' });

  const events = readCollection('events') || [];
  const tapahtumanNimi = events.find((e) => e?.id === eventId)?.name || '';
  // Käyttäjä saa muokata runkoa lähetysikkunassa (tilanne on harvoin täsmälleen se mitä
  // pohjaan on kirjoitettu), mutta pohja on oletus. Paikkamerkit täytetään kummassakin
  // tapauksessa, jotta {tapahtuma} toimii myös käsin kirjoitetussa tekstissä.
  const raakaRunko = typeof body === 'string' && body.trim() !== '' ? body : nappi.body;
  const runko = taytaPaikkamerkit(raakaRunko, { tapahtumanNimi });
  if (!runko) {
    return res.status(400).json({ ok: false, error: 'Viesti on tyhjä.' });
  }

  const vastaanottajat = ratkaiseVastaanottajat(nappi, {
    eventId,
    checkins: readCollection('checkins') || [],
    employees: readCollection('employees') || [],
    events,
  });
  const numerot = vastaanottajat.map((v) => v.numero).filter(Boolean);
  // Sama numero voi esiintyä kahdesti (henkilö kahdella rosterirvillä, tai hätänumero
  // sama kuin työntekijän) — ilman tätä hän saisi saman viestin kahdesti ja saldoa
  // kuluisi turhaan.
  const uniikit = [...new Set(numerot)];
  // Numero -> kenelle se kuuluu, jotta lähetyshistoriaan (ja sitä kautta toimitusraportin
  // riville) saadaan nimi eikä pelkkää numeroa. Ensimmäinen osuma voittaa: jos sama
  // numero on kahdella rivillä, viesti menee kerran ja kirjautuu ensimmäiselle.
  const numeronHaltija = new Map();
  for (const v of vastaanottajat) {
    if (v.numero && !numeronHaltija.has(v.numero)) numeronHaltija.set(v.numero, v);
  }

  const tulos = await lahetaViestit({
    numerot: uniikit,
    body: runko,
    repliable: nappi.repliable,
    // Deduplikointitunniste sitoo lähetyksen nappiin, tapahtumaan ja minuuttiin: jos
    // vastaus jää verkkokatkoon ja käyttäjä painaa uudelleen, BulkSMS tunnistaa saman
    // lähetyksen eikä viesti mene kahteen kertaan. Tunniste vanhenee ~12 tunnissa.
    dedupId: Math.abs(hashDedup(`${buttonId}|${eventId}|${runko}|${Math.floor(Date.now() / 60000)}`)),
  });

  // Audit-lokiin EI kirjoiteta puhelinnumeroita eikä viestin tekstiä — sama periaate kuin
  // muualla (ks. audit.js): loki kertoo kuka teki mitä ja milloin, ei tietueen sisältöä.
  logAudit({
    user: req.username,
    action: tulos.ok ? (tulos.dryRun ? 'sms_dryrun' : 'sms_send') : 'sms_failed',
    collection: 'smsButtons',
    recordId: buttonId,
    eventId,
    recipients: uniikit.length,
    skipped: vastaanottajat.length - uniikit.length,
    parts: tulos.mitat?.osia ?? null,
    encoding: tulos.mitat?.encoding ?? null,
    ...(tulos.ok ? {} : { reason: tulos.virhe }),
  });

  if (!tulos.ok) {
    return res.status(502).json({ ok: false, error: tulos.virhe, mitat: tulos.mitat });
  }

  const ohitettu = vastaanottajat.filter((v) => !v.numero).map((v) => ({ nimi: v.nimi, syy: v.syy }));

  // Lähetyshistoria: yksi tietue per lähetys, vastaanottajakohtaisine viesti-id:ineen.
  // Nämä id:t ovat se avain jolla webhookista saapuva toimituskuittaus osataan liittää
  // oikeaan henkilöön (ks. smswebhook.js: soveltaTilaraportit) — ilman tätä tietuetta
  // kuittaukset saapuisivat mutta niitä ei voisi näyttää kenellekään.
  const lahetysId = `sms-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const tietue = {
    id: lahetysId,
    ts: new Date().toISOString(),
    eventId,
    buttonId,
    label: nappi.label,
    group: nappi.group,
    user: req.username,
    body: runko,
    dryRun: tulos.dryRun,
    repliable: nappi.repliable,
    encoding: tulos.mitat?.encoding || null,
    parts: tulos.mitat?.osia ?? null,
    recipients: tulos.tulokset.map((t, i) => {
      // Vastauksen `to` pitäisi olla sama merkkijono kuin lähetetty, mutta rajapinta voi
      // normalisoida sen (esim. plussan poisto). Verrataan siksi pelkkiä numeroita, ja
      // viimeisenä keinona luotetaan järjestykseen — vastaus tulee samassa järjestyksessä
      // kuin kuorman viestiobjektit.
      const vastattu = t.numero || null;
      const avain = vastattu
        ? uniikit.find((n) => n === vastattu) || uniikit.find((n) => n.replace(/\D/g, '') === vastattu.replace(/\D/g, ''))
        : null;
      const haltija = numeronHaltija.get(avain || uniikit[i]) || {};
      const numero = avain || uniikit[i] || vastattu;
      return {
        messageId: t.id === null || t.id === undefined ? null : String(t.id),
        nimi: haltija.nimi || null,
        rooli: haltija.rooli || null,
        // Kokonaista numeroa ei säilytetä historiassa: se on jo työntekijäpankissa,
        // eikä sitä ole syytä monistaa jokaiseen lähetystietueeseen.
        numero: numero ? `${numero.slice(0, 5)}…${numero.slice(-3)}` : null,
        status: t.status,
        statusId: null,
        updatedAt: null,
      };
    }),
    skipped: ohitettu,
  };
  try {
    // Uusin ensin, samaan tapaan kuin audit-loki ja ilmoitukset.
    writeCollection('smsLog', [tietue, ...(readCollection('smsLog') || [])]);
  } catch (err) {
    // Historian kirjoitus ei saa kaataa itse lähetystä: viestit ovat jo lähteneet, ja
    // käyttäjän on saatava siitä tieto. Virhe näkyy palvelinlokissa ja audit-loki on
    // jo kirjoitettu yllä.
    console.error('Lähetyshistorian kirjoitus epäonnistui:', err.message);
  }

  res.json({
    ok: true,
    sendId: lahetysId,
    dryRun: tulos.dryRun,
    mitat: tulos.mitat,
    lahetetty: tulos.tulokset.length,
    ohitettu,
    tulokset: tietue.recipients.map((r) => ({ numero: r.numero, nimi: r.nimi, status: r.status })),
  });
});

// Yksinkertainen 32-bittinen tiiviste deduplication-id:tä varten (rajapinta odottaa
// int32:ta). Ei kryptografinen eikä tarvitse olla: tarkoitus on vain että SAMA lähetys
// tuottaa saman tunnisteen ja eri lähetys eri tunnisteen.
function hashDedup(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ---------------------------------------------------------------- Webhook (julkinen)
//
// BulkSMS kutsuu tätä kun viestin tila muuttuu (toimituskuittaus) tai kun työntekijä
// vastaa hätäviestiin. Päätepiste on tarkoituksella ILMAN kirjautumista: kutsuja on
// BulkSMS:n palvelin, jolla ei ole istuntoa. Palomuurirajaus ei myöskään auta, koska
// BulkSMS varoittaa kutsujen tulevan dynaamisesta IP-avaruudesta.
//
// Ainoa pääsynhallinta on siis URL:n ?secret=-parametri, joka tarkistetaan ENSIMMÄISENÄ
// ennen kuin rungosta luetaan mitään.
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  // Tuhannen työntekijän massaviestistä syntyy tuhat kuittausta lyhyessä ajassa, joten
  // raja on korkea. Se on silti olemassa: ilman sitä väärällä salaisuudella tehty
  // tulva täyttäisi lokin ja veisi prosessointiaikaa.
  limit: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liikaa webhook-kutsuja.' },
});

app.post('/api/webhooks/bulksms', webhookLimiter, (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const odotettu = process.env.BULKSMS_WEBHOOK_SECRET || '';
  if (!odotettu) {
    // Salaisuutta ei ole asetettu: päätepiste on tällöin pois käytöstä eikä sitä saa
    // vahingossa jättää auki kaikille. 503 kertoo BulkSMS:lle että kyse on tilapäisestä
    // häiriöstä, joten raportit yritetään toimittaa uudelleen kun asetus on kunnossa.
    console.error('BULKSMS_WEBHOOK_SECRET puuttuu — webhook-päätepiste on pois käytöstä.');
    return res.status(503).json({ ok: false });
  }
  if (!salaisuusTasmaa(typeof req.query.secret === 'string' ? req.query.secret : '', odotettu)) {
    logAudit({ action: 'sms_webhook_rejected', ip: req.ip });
    return res.status(403).json({ ok: false });
  }

  // Jonoon ja heti 200 OK. Rungon sisältöä EI tulkita tässä: BulkSMS vaatii vastauksen
  // alle 30 sekunnissa, ja kuittausryöpyn aikana jokainen synkroninen kokoelmapäivitys
  // kasvattaisi vastausaikaa kunnes osa raporteista aikakatkeaisi.
  // Kuorma jäsennetään raakatekstistä eikä oteta req.bodystä: express.json on jo
  // pyöristänyt viesti-id:t (ks. bulksms.js: parsiJson). Jos raakatekstiä ei jostain
  // syystä ole, req.body on parempi kuin ei mitään.
  const kuorma = req.rawBody ? parsiJson(req.rawBody) : (req.body ?? null);

  const lisatty = lisaaJonoon({
    event: req.get('X-BulkSMS-Event') || null,
    webhookId: req.get('X-BulkSMS-Webhook-Id') || null,
    // Toimitusyritysten numero kertoo uusinnoista: jos tämä kasvaa, päätepiste ei ole
    // ehtinyt vastata ajoissa aiemmilla kerroilla.
    yritys: req.get('X-BulkSMS-Delivery-Attempt') || null,
    saapui: new Date().toISOString(),
    payload: kuorma,
  });
  if (!lisatty) {
    // 503 (ei 400): BulkSMS tulkitsee tämän tilapäiseksi häiriöksi ja yrittää uudelleen.
    // 400 hylkäisi raportin pysyvästi ja 410 lakkauttaisi koko webhook-konfiguraation.
    return res.status(503).json({ ok: false });
  }
  res.status(200).json({ ok: true });
});

// Taustakäsittely: purkaa jonon ja päivittää lähetyshistorian. Ajetaan ajastimella eikä
// pyynnön yhteydessä, jotta webhook-vastaus pysyy nopeana ruuhkassakin.
function kasitteleWebhookJono() {
  const tapahtumat = otaKasittelyyn();
  if (tapahtumat.length === 0) return;

  let log = readCollection('smsLog') || [];
  let vastaukset = readCollection('smsReplies') || [];
  let logMuuttui = false;
  let uusiaVastauksia = 0;

  // Käsittelemättä jääneet tapahtumat kerätään ja lokitetaan silmukan jälkeen.
  //
  // Aiemmin tuntematon tapahtuma ohitettiin TÄYSIN hiljaa: ei lokia, ei audit-merkintää,
  // ja jono kuitattiin silti käsitellyksi. Se teki puuttuvan vastauksen selvittämisestä
  // kohtuuttoman vaikeaa — tiedettiin vain että BulkSMS sai 200 OK ja että mitään ei
  // tallentunut, eikä mistään voinut päätellä kumpi tapahtumatyyppi katosi. Hätäviestien
  // kuittausketjussa juuri se on tieto jota ilman ei voi toimia.
  const tuntemattomat = [];
  for (const tapahtuma of tapahtumat) {
    const { tyyppi, viestit } = tulkitseTapahtuma(tapahtuma?.event, tapahtuma?.payload);
    if (tyyppi === 'status') {
      const tulos = soveltaTilaraportit(log, viestit);
      log = tulos.smsLog;
      logMuuttui = logMuuttui || tulos.muuttui;
    } else if (tyyppi === 'reply') {
      const tulos = soveltaVastaukset(log, vastaukset, viestit);
      vastaukset = tulos.smsReplies;
      uusiaVastauksia += tulos.lisatty;
      // Tunnettu tapahtuma jossa oli viestejä mutta joka ei tuottanut yhtään uutta
      // vastausta: joko kaksoiskappale (uusinta) tai jotain odottamatonta. Ei virhe,
      // mutta jälki on jäätävä.
      if (viestit.length > 0 && tulos.lisatty === 0) {
        console.warn(`Webhook: ${viestit.length} vastausta ei tuottanut uutta tietuetta (kaksoiskappale?).`);
      }
    } else {
      tuntemattomat.push({ event: tapahtuma?.event ?? null, viesteja: viestit.length });
    }
  }

  if (tuntemattomat.length > 0) {
    // Tyhjä kuorma tunnetulla tai tuntemattomalla otsikolla on BulkSMS:n
    // validointikutsu (webhookia luotaessa/aktivoitaessa) — se on normaalia eikä sitä
    // kannata kirjata audit-lokiin, mutta palvelinlokiin kylläkin.
    const merkittavat = tuntemattomat.filter((t) => t.viesteja > 0);
    console.warn(`Webhook: ${tuntemattomat.length} käsittelemätöntä tapahtumaa: ${JSON.stringify(tuntemattomat)}`);
    for (const t of merkittavat) {
      logAudit({ action: 'sms_webhook_unknown', event: t.event, count: t.viesteja });
    }
  }

  try {
    if (logMuuttui) writeCollection('smsLog', log);
    if (uusiaVastauksia > 0) {
      writeCollection('smsReplies', vastaukset);
      logAudit({ action: 'sms_replies', count: uusiaVastauksia });
    }
    // Kuittaus VASTA onnistuneen kirjoituksen jälkeen: jos kirjoitus heittää, samat
    // tapahtumat käsitellään uudelleen seuraavalla kierroksella. Käsittely on
    // idempotentti (ks. smswebhook.js), joten toisto ei riko mitään — mutta kadonnut
    // toimituskuittaus olisi lopullinen menetys.
    kuittaaKasitellyksi();
  } catch (err) {
    console.error('Webhook-jonon käsittely epäonnistui:', err.message);
  }
}

// ---------------------------------------------------------------- Saldovahti
//
// Hätäviestintä ei saa keskeytyä siihen että tili on tyhjä. BulkSMS:n oma Auto Top-up
// on ensisijainen turvaverkko (hallintapaneelin asetus), tämä on toinen: sovellus
// tarkistaa saldon säännöllisesti ja varoittaa käyttöliittymässä ENNEN kuin oikea
// hätätilanne on käsillä.
const SALDO_VAROITUSRAJA = Number(process.env.BULKSMS_SALDO_VAROITUSRAJA || 1000);
const SALDO_TARKISTUSVALI_MS = 6 * 60 * 60 * 1000;

// Viimeisin tarkistus välimuistissa, jotta /api/sms/status ei tee ulkoista HTTP-kutsua
// joka kerta kun Pikatoiminnot-valikko avataan.
let saldoValimuisti = null;
// Oliko saldo edellisellä tarkistuksella jo varoitusrajan alla. Käytetään siihen että
// audit-lokiin kirjataan vain RAJAN ALITUS eikä samaa varoitusta joka kuudes tunti.
let saldoOliAlle = false;

async function tarkistaSaldo() {
  if (!onkoKonfiguroitu()) return null;
  const tulos = await haeSaldo();
  saldoValimuisti = { ...tulos, tarkistettu: new Date().toISOString() };

  if (tulos.ok && typeof tulos.saldo === 'number') {
    const alle = tulos.saldo < SALDO_VAROITUSRAJA;
    if (alle && !saldoOliAlle) {
      logAudit({ action: 'sms_saldo_vahissa', balance: Math.round(tulos.saldo), threshold: SALDO_VAROITUSRAJA });
    }
    saldoOliAlle = alle;
  }
  return saldoValimuisti;
}

// Palauttaa välimuistin jos se on tuore, muuten hakee uudestaan. maxIkaMs = 0 pakottaa
// tuoreen haun ("Tarkista nyt" -painike asetuksissa).
async function saldoTiedot(maxIkaMs = SALDO_TARKISTUSVALI_MS) {
  const ika = saldoValimuisti ? Date.now() - new Date(saldoValimuisti.tarkistettu).getTime() : Infinity;
  if (saldoValimuisti && ika < maxIkaMs) return saldoValimuisti;
  return (await tarkistaSaldo()) || saldoValimuisti;
}

// Kanavan istunnon tunnistus. Upgrade-pyynnössä on samat otsakkeet kuin tavallisessa
// pyynnössä, joten getSessionUser kelpaa sellaisenaan — kanava ei siis ole oma
// tunnistautumisreittinsä vaan käyttää samaa evästettä ja samaa mitätöintisääntöä.
//
// Pakkosalasananvaihdon aikana kanavaa ei avata lainkaan: silloin istunnolla ei saa tehdä
// mitään muuta kuin vaihtaa salasana (sama sääntö kuin requireAuthissa).
function tunnistaKanava(req) {
  const username = getSessionUser(req);
  if (!username) return null;
  const user = findUser(username);
  if (!user || user.must_change_password) return null;
  return {
    username,
    role: user.role,
    // roleId eikä valmiit oikeudet: taso luetaan vasta lähetyshetkellä, jolloin tason
    // muokkaus vaikuttaa heti eikä vasta kun käyttäjä avaa yhteyden uudelleen. Sama
    // periaate kuin requireAuthissa.
    roleId: user.roleId,
    eventAccess: user.eventAccess,
    tuotteet: paaseeTuotteisiin(user),
  };
}

// Kuka saa nähdä henkilöstön sijainnit. Oma sivukartta-solmunsa: kaikki tapahtuman
// katselijat eivät saa nähdä missä työntekijät ovat, vaikka näkisivät kirjaukset.
function saaNahdaSijainnit(istunto, eventId) {
  if (!istunto) return false;
  if (istunto.role === 'admin') return true;
  if (!eventAllowed(istunto.eventAccess, eventId)) return false;
  return canView(rolePermissions(istunto.roleId), eventId, 'locations');
}

// Sijaintiviesti kentältä. Palvelin päättää sekä aikaleiman että sen kenelle tieto
// kerrotaan — selain ei kumpaakaan.
// Vyöhykepoikkeamien toistosuojan muisti: username -> { "vyohykeId:saanto": aikaleima }.
// Muistissa eikä levyllä samasta syystä kuin sijainnit itse (sijainti.js): tämä on
// hetkellistä tilaa, jonka menettäminen palvelimen käynnistyessä ei haittaa — pahin
// seuraus on yksi ylimääräinen hälytys.
const geofenceMuisti = new Map();

// Vyöhykepoikkeamat sijaintipäivityksestä. Hälytys syntyy vain rajan ylityksestä, ja
// säännöt suojineen ovat geofence.js:ssä. Tämä ei siis päätä mistään — se lukee
// vyöhykkeet, kysyy arviota ja kirjaa tuloksen.
function tarkistaVyohykkeet(istunto, edellinen, tietue) {
  const { vyohykkeet } = kohteenTiedot(tietue.eventId);
  if (vyohykkeet.length === 0) return;

  const tulos = arvioiVyohykkeet({
    vyohykkeet,
    edellinen,
    nykyinen: tietue,
    viimeksi: geofenceMuisti.get(istunto.username) || {},
  });
  geofenceMuisti.set(istunto.username, tulos.viimeksi);
  if (tulos.poikkeamat.length === 0) return;

  const lista = readCollection('alerts') || [];
  const uudet = [];
  for (const poikkeama of tulos.poikkeamat) {
    const luotu = luoHalytys({
      id: crypto.randomUUID(),
      tyyppi: 'geofence',
      vartija: istunto.username,
      eventId: tietue.eventId,
      kuvaus: poikkeama.kuvaus,
      gps: tietue.gps,
      vyohyke: poikkeama.vyohyke,
    });
    if (luotu.ok) uudet.push(luotu.halytys);
  }
  if (uudet.length === 0) return;

  writeCollection('alerts', [...uudet, ...lista]);
  for (const h of uudet) {
    logAudit({
      user: h.vartija, action: 'alarm_geofence', collection: 'alerts',
      recordId: h.id, eventId: h.eventId, zone: h.vyohyke?.id,
    });
    kerroHalytyksesta(h, 'create');
  }
}

// Sijaintiviesti kentältä. Palvelin päättää sekä aikaleiman että sen kenelle tieto
// kerrotaan — selain ei kumpaakaan.
function kasitteleKanavaViesti(istunto, viesti) {
  if (viesti.tyyppi !== 'sijainti') return;
  if (!seurantaKaytossa()) return;
  // Edellinen sijainti luetaan ENNEN päivitystä: vyöhykepoikkeama on rajan ylitys, ja
  // ylityksen näkee vain vertaamalla uutta sijaintia edelliseen.
  const edellinen = haeSijainti(istunto?.username);
  const tietue = paivitaSijainti(istunto?.username, viesti.eventId, viesti);
  if (!tietue) return;
  lahetaViesti(
    { tyyppi: 'sijainnit', eventId: tietue.eventId, sijainnit: [{ ...tietue, ikaMs: 0 }] },
    { suodatin: (vastaanottaja) => saaNahdaSijainnit(vastaanottaja, tietue.eventId) }
  );
  tarkistaVyohykkeet(istunto, edellinen, tietue);
}

const palvelin = app.listen(PORT, '127.0.0.1', () => {
  console.log(`turvajohto-os-server kuuntelee portissa ${PORT}`);
  liitaKanava(palvelin, { tunnista: tunnistaKanava, onViesti: kasitteleKanavaViesti });

  // Webhook-jonon purku. 5 s on kompromissi: tarpeeksi tiheä että toimitustilat
  // näkyvät käyttöliittymässä käytännössä heti, mutta harvempi kuin kuittausten
  // saapumistahti, jolloin yksi kierros käsittelee koko ryöpyn kerralla eikä
  // kokoelmaa kirjoiteta levylle sataa kertaa peräkkäin.
  setInterval(kasitteleWebhookJono, 5000).unref();
  // Käsitellään heti käynnistyksessä myös se mitä jonoon jäi edellisen ajon aikana
  // (deploy käynnistää palvelimen uudelleen kesken kuittausryöpyn).
  kasitteleWebhookJono();

  // Hälytyskierros: erääntyneet ajastimet laukeavat ja lauenneet eskaloituvat. Tämä on
  // se osa jonka takia ajastin ylipäätään toimii — selaimessa pyörivä ajastin ei laukeaisi
  // silloin kun sitä eniten tarvitaan, eli kun puhelin on sammunut.
  setInterval(kasitteleHalytykset, HALYTYSKIERROS_MS).unref();
  kasitteleHalytykset();

  if (onkoKonfiguroitu()) {
    setInterval(() => { tarkistaSaldo().catch(() => {}); }, SALDO_TARKISTUSVALI_MS).unref();
    // Ensimmäinen tarkistus pienellä viiveellä: käynnistyksen aikana ulkoinen HTTP-kutsu
    // ei saa hidastaa palvelimen valmiiksi tuloa (deploy odottaa sitä).
    setTimeout(() => { tarkistaSaldo().catch(() => {}); }, 10000).unref();
  } else {
    console.log('BulkSMS-tunnuksia ei ole asetettu — hätäviestit ovat kuivaharjoittelutilassa.');
  }
});
