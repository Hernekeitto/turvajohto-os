// Kenttäkohtainen salaus levyllä (AES-256-GCM) arkaluonteisille henkilötiedoille.
//
// Henkilötunnukset olivat aiemmin employees.json:ssa selväkielisenä. Tietosuojalain
// 29 § edellyttää henkilötunnuksen käsittelylle asianmukaisia teknisiä suojatoimia,
// eikä UpCloudin levysalaus (encryption at rest) riitä siihen yksin: käyttöjärjestelmä
// purkaa sen läpinäkyvästi, joten kuka tahansa joka pääsee palvelimelle näkee
// tiedostot selväkielisenä. Tämä kerros suojaa nimenomaan siltä: tiedosto levyllä,
// levyn snapshot, varmuuskopio tai vahingossa kopioitu datahakemisto ei enää sisällä
// luettavia henkilötunnuksia ilman erillistä avainta.
//
// Mitä tämä EI suojaa: sovellus itse purkaa arvot lukiessaan, joten kirjautunut
// käyttäjä (jolla on oikeus employees-kokoelmaan) näkee henkilötunnukset normaalisti
// — sen puolen suojaa permissions.js. Myöskään palvelimen muistista tai
// ympäristömuuttujista avaimen näkevä hyökkääjä ei jää tämän taakse.
//
// Avain tulee ympäristömuuttujasta DATA_ENCRYPTION_KEY (64 hex-merkkiä = 32 tavua),
// erillään datasta, ja puuttuva/väärän muotoinen avain kaataa palvelimen jo
// käynnistyksessä — samaan periaatteeseen kuin JWT_SECRET index.js:ssä ja
// TOTP_ENCRYPTION_KEY totp.js:ssä. Ei haluta vahingossa ajaa ilman salausta.
//
// Erillinen avain TOTP_ENCRYPTION_KEY:stä on tarkoituksellinen: eri käyttötarkoitus,
// eri elinkaari (henkilötunnusten avaimen vaihto vaatii datan uudelleensalauksen,
// TOTP-avaimen vaihto vain secretien uudelleenluonnin). Samasta syystä tämä moduuli
// on oma tiedostonsa eikä lisäys totp.js:ään, vaikka AES-GCM-rungot ovat lähes
// identtiset — toimivaa ja erikseen testattua TOTP-koodia ei kannata muokata tämän
// takia.
import crypto from 'node:crypto';

const ENC_PREFIX = 'enc:';
const IV_LENGTH = 12; // GCM-suositus
const AUTH_TAG_LENGTH = 16;

let cachedKey = null;

function requireEncryptionKey() {
  if (cachedKey) return cachedKey;
  const hex = process.env.DATA_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'DATA_ENCRYPTION_KEY puuttuu tai on väärän muotoinen ympäristömuuttujista (pitää olla 64 hex-merkkiä / 32 tavua). Palvelinta ei käynnistetä.'
    );
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

// Kaadetaan heti moduulin latauksessa jos avain puuttuu, ettei palvelin jää hiljaa
// pyörimään tilassa jossa se ei osaisi purkaa levyllä olevaa dataa.
requireEncryptionKey();

export function encryptValue(plainValue) {
  const key = requireEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainValue), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

// Palauttaa arvon sellaisenaan jos se ei ole tunnistettavasti salattu — näin vanha
// (tätä ominaisuutta edeltävä) selväkielinen henkilötunnus toimii saumattomasti
// kunnes store.js kirjoittaa sen salattuna takaisin levylle.
//
// Heittää poikkeuksen jos arvo on salattu mutta purku ei onnistu (väärä avain tai
// muuttunut tavu — GCM:n authTag havaitsee molemmat). Kutsuja EI saa niellä tätä
// hiljaa: virheellinen purku ei koskaan saa näyttäytyä tyhjänä datana, ks. store.js:n
// readCollection.
export function decryptValue(stored) {
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

export function isEncryptedValue(stored) {
  return typeof stored === 'string' && stored.startsWith(ENC_PREFIX);
}
