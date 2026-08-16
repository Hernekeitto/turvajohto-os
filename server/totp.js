// Aikapohjainen kertakäyttösalasana (TOTP, RFC 6238) ilman ulkoisia riippuvuuksia —
// yhteensopiva Google Authenticatorin ja muiden vastaavien sovellusten kanssa
// (HMAC-SHA1, 6 numeroa, 30 sekunnin aikaikkuna — sama oletus kuin Authenticator-sovelluksissa).
// Algoritmi tarkistettu RFC 4226 (HOTP) ja RFC 6238 (TOTP) viralisia testivektoreita vasten.
import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(byteLength = 20) {
  return base32Encode(crypto.randomBytes(byteLength));
}

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secretBuffer, counter, digits = 6) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac('sha1', secretBuffer).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = Math.pow(10, digits);
  return (code % mod).toString().padStart(digits, '0');
}

export function generateTotp(base32Secret, forTimeMs = Date.now(), timeStepSeconds = 30) {
  const counter = Math.floor(forTimeMs / 1000 / timeStepSeconds);
  return hotp(base32Decode(base32Secret), counter);
}

// Sallitaan ±1 aikaikkuna (30s) kellon pienelle heitolle eri laitteiden välillä.
export function verifyTotp(base32Secret, token, window = 1) {
  const clean = String(token || '').trim();
  if (!/^\d{6}$/.test(clean)) return false;
  if (!base32Secret) return false;
  const now = Date.now();
  for (let step = -window; step <= window; step++) {
    if (generateTotp(base32Secret, now + step * 30000) === clean) return true;
  }
  return false;
}

export function buildOtpauthUri(base32Secret, username, issuer = 'Turvajohto OS') {
  const label = encodeURIComponent(`${issuer}:${username}`);
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// --- TOTP-salaisuuden salaus levyllä (AES-256-GCM) ---
//
// TOTP-salaisuudet olivat aiemmin users.json:ssa selväkielisenä. Tietosuojalain 29 §
// edellyttää henkilötietoa suojaaville tunnistautumismekanismeille asianmukaisia
// teknisiä suojatoimia, joten salaisuus salataan nyt levyllä. Avain tulee ympäristö-
// muuttujasta (ei koskaan levyllä samassa tiedostossa kuin data), ja puuttuva/väärän-
// mittainen avain kaataa palvelimen käynnistyksessä (ks. requireEncryptionKey) — ei
// haluta vahingossa ajaa ilman salausta tai avaimella joka ei toimisi oikein.
//
// db.js:n readUsers()/writeUsers() ovat ainoa paikka joka kutsuu näitä: readUsers()
// purkaa aina, writeUsers() salaa aina, joten muu koodi (index.js mukaan lukien
// suora user.totp_secret-luku login-reitillä) näkee aina selväkielisen arvon eikä
// tarvitse tietää salauksesta mitään.
const ENC_PREFIX = 'enc:';
const IV_LENGTH = 12; // GCM-suositus
const AUTH_TAG_LENGTH = 16;

let cachedKey = null;

function requireEncryptionKey() {
  if (cachedKey) return cachedKey;
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'TOTP_ENCRYPTION_KEY puuttuu tai on väärän muotoinen ympäristömuuttujista (pitää olla 64 hex-merkkiä / 32 tavua). Palvelinta ei käynnistetä.'
    );
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

// Kaaataan heti moduulin latauksessa jos avain puuttuu — samaan tapaan kuin
// JWT_SECRET-tarkistus index.js:ssä, ettei palvelin jää hiljaa pyörimään ilman salausta.
requireEncryptionKey();

export function encryptSecret(plainSecret) {
  const key = requireEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainSecret), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

// Palauttaa arvon sellaisenaan jos se ei ole tunnistettavasti salattu — näin vanha
// (tätä ominaisuutta edeltävä) selväkielinen secret toimii saumattomasti kunnes
// db.js kirjoittaa sen salattuna takaisin levylle (ks. db.js: needsTotpMigration).
export function decryptSecret(stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith(ENC_PREFIX)) {
    return stored;
  }
  const key = requireEncryptionKey();
  const raw = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function isEncryptedSecret(stored) {
  return typeof stored === 'string' && stored.startsWith(ENC_PREFIX);
}
