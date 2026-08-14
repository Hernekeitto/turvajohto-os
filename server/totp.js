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
