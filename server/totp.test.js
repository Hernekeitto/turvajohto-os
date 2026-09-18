// TOTP-toteutuksen testit. Ei ollut ennestään — lisätty 18.9.2026 tietoturvakatselmuksen
// yhteydessä, kun verifyTotp:n vertailu vaihdettiin vakioaikaiseksi
// (crypto.timingSafeEqual, sama malli kuin shares.js/laite.js/smswebhook.js:ssä).
// Painopiste: RFC-testivektori generateTotp:lle ja verifyTotp:n hyväksymis-/
// hylkäysrajat, jotta vertailun vaihtaminen ei muuttanut käyttäytymistä.
//
// Testiavain asetetaan ennen totp.js:n importtia, koska moduuli vaatii avaimen jo
// latauksessa (sama malli kuin store.test.js:ssä fieldcrypto.js:lle).
//
// Ajetaan: node --test server/totp.test.js  (tai npm test)
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TOTP_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);

const TOTP_URL = new URL('./totp.js', import.meta.url).href;
const { generateTotp, verifyTotp, generateBase32Secret, buildOtpauthUri } = await import(TOTP_URL);

// RFC 6238 liite B:n testivektori 20-tavuisella ASCII-avaimella "12345678901234567890"
// SHA1-muodossa, base32-koodattuna. Aika 59s -> laskuri 1 -> tunnettu tulos "94287082"
// (RFC:n oma esimerkki on 8-numeroinen). Tämä sovellus tuottaa 6 numeroa, ja koska
// typistys on aina modulo 10^n, tulos on RFC:n arvon kuusi viimeistä numeroa.
const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // "12345678901234567890" base32:na

test('generateTotp tuottaa RFC 6238 -testivektorin mukaisen koodin (typistettynä 6 numeroon)', () => {
  const koodi = generateTotp(RFC_SECRET_BASE32, 59 * 1000);
  assert.equal(koodi, '287082'); // RFC:n 8-numeroinen "94287082" typistettynä
  assert.match(koodi, /^\d{6}$/);
});

test('verifyTotp hyväksyy oikean koodin nykyhetkellä', () => {
  const secret = generateBase32Secret();
  const koodi = generateTotp(secret);
  assert.equal(verifyTotp(secret, koodi), true);
});

test('verifyTotp hyväksyy koodin ±1 aikaikkunan sisällä mutta ei sen ulkopuolella', () => {
  const secret = generateBase32Secret();
  const nyt = Date.now();
  const edellinen = generateTotp(secret, nyt - 30_000);
  const seuraava = generateTotp(secret, nyt + 30_000);
  const kaksiPois = generateTotp(secret, nyt + 90_000);
  assert.equal(verifyTotp(secret, edellinen), true);
  assert.equal(verifyTotp(secret, seuraava), true);
  assert.equal(verifyTotp(secret, kaksiPois), false);
});

test('verifyTotp hylkää väärän koodin', () => {
  const secret = generateBase32Secret();
  const oikea = generateTotp(secret);
  const vaara = oikea === '000000' ? '111111' : '000000';
  assert.equal(verifyTotp(secret, vaara), false);
});

test('verifyTotp hylkää väärän pituuden ilman että timingSafeEqual kaatuu', () => {
  const secret = generateBase32Secret();
  assert.equal(verifyTotp(secret, '12345'), false); // liian lyhyt
  assert.equal(verifyTotp(secret, '1234567'), false); // liian pitkä
  assert.equal(verifyTotp(secret, 'abcdef'), false); // ei numeroita
  assert.equal(verifyTotp(secret, ''), false);
  assert.equal(verifyTotp(secret, null), false);
  assert.equal(verifyTotp(secret, undefined), false);
});

test('verifyTotp hylkää puuttuvan salaisuuden kaatumatta', () => {
  assert.equal(verifyTotp('', '123456'), false);
  assert.equal(verifyTotp(null, '123456'), false);
});

test('kaksi eri salaisuutta tuottavat (käytännössä aina) eri koodin samalla hetkellä', () => {
  const a = generateBase32Secret();
  const b = generateBase32Secret();
  assert.notEqual(generateTotp(a, 0), generateTotp(b, 0));
});

test('buildOtpauthUri sisältää käyttäjänimen ja salaisuuden', () => {
  const uri = buildOtpauthUri('ABCDEFGHIJKLMNOP', 'testikäyttäjä');
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.match(uri, /secret=ABCDEFGHIJKLMNOP/);
  assert.match(uri, /issuer=Turvajohto/);
});
