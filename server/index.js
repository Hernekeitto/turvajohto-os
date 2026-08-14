import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { findUser, listUsers, upsertUser, updateUser, updatePassword } from './db.js';
import { readCollection, writeCollection, KNOWN_COLLECTIONS } from './store.js';
import { isAllowedFile, saveUpload, getUploadPath } from './uploads.js';

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'tj_session';
const SESSION_HOURS = 12;

if (!JWT_SECRET) {
  console.error('JWT_SECRET puuttuu ympäristömuuttujista. Palvelinta ei käynnistetä.');
  process.exit(1);
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
function isValidPassword(pw) {
  return typeof pw === 'string' && pw.length >= 10 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
}

function setSessionCookie(res, username) {
  const token = jwt.sign({ sub: username }, JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_HOURS * 60 * 60,
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
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.sub;
  } catch {
    return null;
  }
}

app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'Käyttäjätunnus ja salasana vaaditaan.' });
  }

  const user = findUser(username);
  const valid = user ? bcrypt.compareSync(password, user.password_hash) : false;

  if (!valid) {
    return res.status(401).json({ ok: false, error: 'Väärä käyttäjätunnus tai salasana.' });
  }

  setSessionCookie(res, user.username);
  res.json({ ok: true, username: user.username });
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
  res.json({
    authenticated: true,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    permissions: user.permissions,
  });
});

function requireAuth(req, res, next) {
  const username = getSessionUser(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Kirjaudu sisään.' });
  req.username = username;
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
app.get('/api/data/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  if (!KNOWN_COLLECTIONS.includes(name)) {
    return res.status(404).json({ ok: false, error: 'Tuntematon kokoelma.' });
  }
  res.json({ ok: true, data: readCollection(name) });
});

app.put('/api/data/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  if (!KNOWN_COLLECTIONS.includes(name)) {
    return res.status(404).json({ ok: false, error: 'Tuntematon kokoelma.' });
  }
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ ok: false, error: 'Odotettiin taulukkoa.' });
  }
  writeCollection(name, req.body);
  res.json({ ok: true });
});

// Käyttäjähallinta (vain admin) ja oman salasanan itsepalveluvaihto (kuka tahansa kirjautunut).
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  res.json({ ok: true, users: listUsers() });
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { username, nickname, password } = req.body || {};
  if (typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ ok: false, error: 'Käyttäjätunnus vaaditaan.' });
  }
  if (typeof nickname !== 'string' || !nickname.trim()) {
    return res.status(400).json({ ok: false, error: 'Nimimerkki vaaditaan.' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({
      ok: false,
      error: 'Salasanan tulee olla vähintään 10 merkkiä ja sisältää iso kirjain, pieni kirjain ja numero.',
    });
  }
  const trimmedUsername = username.trim();
  if (findUser(trimmedUsername)) {
    return res.status(409).json({ ok: false, error: 'Käyttäjätunnus on jo käytössä.' });
  }
  const hash = bcrypt.hashSync(password, 12);
  upsertUser(trimmedUsername, hash, { nickname: nickname.trim(), role: 'user' });
  res.json({ ok: true });
});

app.put('/api/users/:username', requireAuth, requireAdmin, (req, res) => {
  const { username } = req.params;
  const { nickname, permissions } = req.body || {};
  if (!findUser(username)) {
    return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  }
  if (nickname !== undefined && (typeof nickname !== 'string' || !nickname.trim())) {
    return res.status(400).json({ ok: false, error: 'Nimimerkki ei voi olla tyhjä.' });
  }
  if (permissions !== undefined && (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions))) {
    return res.status(400).json({ ok: false, error: 'Virheellinen oikeusmuoto.' });
  }
  updateUser(username, {
    nickname: nickname !== undefined ? nickname.trim() : undefined,
    permissions,
  });
  res.json({ ok: true });
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
  res.json({ ok: true });
});

// Lomakkeiden "Ota kuva" / "Liitä tiedosto" -liitteet. Tallennetaan levylle
// (ei git-repoon, ei muihin kokoelmiin) ja viitataan raportissa pelkällä id:llä.
app.post('/api/uploads', requireAuth, uploadLimiter, (req, res) => {
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
  res.sendFile(filePath);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`turvajohto-os-server kuuntelee portissa ${PORT}`);
});
