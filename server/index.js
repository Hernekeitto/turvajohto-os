import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import rateLimit from 'express-rate-limit';
import { findUser } from './db.js';
import { readCollection, writeCollection, KNOWN_COLLECTIONS } from './store.js';

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

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liian monta yritystä. Yritä myöhemmin uudelleen.' },
});

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
  res.json({ authenticated: !!username, username: username || null });
});

function requireAuth(req, res, next) {
  const username = getSessionUser(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Kirjaudu sisään.' });
  req.username = username;
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

app.listen(PORT, '127.0.0.1', () => {
  console.log(`turvajohto-os-server kuuntelee portissa ${PORT}`);
});
