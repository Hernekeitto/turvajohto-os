import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptValue, decryptValue, isEncryptedValue } from './fieldcrypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// Sallittujen kokoelmien "allow-list" estää polkujen sekoilun ulkopuolisesta syötteestä
const COLLECTIONS = {
  checkins: 'checkins.json',
  reports: 'reports.json',
  events: 'events.json',
  riskAssessments: 'riskAssessments.json',
  employees: 'employees.json',
  readiness: 'readiness.json',
};

// Kentät jotka salataan levyllä (ks. fieldcrypto.js). Tässä on tarkoituksella vain
// suora tunniste jonka selväkielinen säilytys on erikseen lain piirissä
// (tietosuojalaki 29 §, henkilötunnus) — ei kaikkea henkilötietoa, koska jokainen
// salattu kenttä on kenttä jolla ei voi enää hakea, lajitella eikä suodattaa levyn
// tasolla, ja jonka avaimen menetys tarkoittaa kentän menetystä. Kenttiä voi lisätä
// tähän listaan yksi rivi kerrallaan: migraatio (selväkielinen -> salattu ensimmäisellä
// luvulla) toimii sen jälkeen automaattisesti myös uudelle kentälle.
//
// Huom: employees.address on tästä tarkoituksella pois — se on henkilötietoa mutta ei
// henkilötunnus. Jos se halutaan mukaan, riittää lisätä 'address' tähän taulukkoon.
//
// reports.summary on mukana toisesta syystä kuin employees.personalId. LYTP ja sen
// nojalla annettu asetus oikeuttavat kirjaamaan tapahtumailmoitukseen toimenpiteiden
// kohteena olleiden sukunimen, etunimet, henkilötunnuksen ja osoitetiedot sekä
// tuntomerkit. Kun laki nimenomaisesti sallii sen, raportin vapaa teksti on
// oletettava tällaista tietoa sisältäväksi — eikä kenttäkohtainen salaus voi tietää
// mitä vapaaseen tekstiin on kirjoitettu, joten koko kenttä salataan. Tämä on
// tarkoituksella varovainen valinta: väärä suunta olisi jättää voimankäyttö- ja
// kiinniottoraporttien teksti selväkieliseksi siksi että se "yleensä" ei sisällä
// henkilötunnusta.
// Raporttien salattavat kentät ovat kaikki niitä joihin kirjoitetaan vapaata tekstiä:
// summary (yhteenveto/kuvaus), description (järjestyksenvalvojan vapaa kuvaus),
// actions (tehdyt toimenpiteet), resources (käytetyt resurssit) ja employees
// (paikalla olleet työntekijät, eli nimiä). typeId, eventId, author, time ja
// numeeriset/totuusarvoiset kentät jäävät selväkielisiksi: niitä käytetään
// suodatukseen ja oikeustarkistuksiin (mm. canReadAttachment lukee typeId:n ja
// eventId:n), eivätkä ne sisällä vapaata tekstiä.
// Järjestyksenvalvojan tapahtumailmoituksen (typeId 'jvreport') kohdehenkilökentät ovat
// suoria tunnisteita: LYTP ja sen nojalla annettu asetus oikeuttavat kirjaamaan
// toimenpiteiden kohteena olleiden sukunimen, etunimet, henkilötunnuksen ja
// osoitetiedot sekä tuntomerkit. Nämä ovat arkaluonteisempia kuin työntekijöiden omat
// tiedot: ne kertovat kenelle on tehty voimankäyttö- tai kiinniottotoimenpide.
// Selväkielisiksi jäävät place, licenseHolder, date ja time (eivät henkilötietoa) sekä
// author, typeId ja eventId (suodatus ja oikeustarkistukset).
const ENCRYPTED_FIELDS = {
  // personalId ja taxNumber ovat molemmat henkilön yksilöiviä viranomaistunnisteita,
  // joten kumpikaan ei saa olla levyllä selväkielisenä.
  employees: ['personalId', 'taxNumber'],
  reports: [
    'summary',
    'description',
    'tikeComment',
    'taskTitle',
    'taskDoneComment',
    'actions',
    'resources',
    'employees',
    'subjectLastName',
    'subjectFirstNames',
    'subjectPersonalId',
    'subjectAddress',
    'subjectFeatures',
    'subjectObservations',
  ],
};

fs.mkdirSync(DATA_DIR, { recursive: true });

// Käy läpi kokoelman salattavat kentät ja palauttaa UUDEN taulukon muunnetuin arvoin.
// Ei koskaan muuta parametrina saatuja olioita paikallaan: kutsuja (esim. index.js:n
// PUT-reitti, joka lokittaa ja palauttaa saman datan) pitää edelleen käytössään
// selväkielisen version. Tämä on sama sudenkuoppa joka väistettiin db.js:n
// writeUsers()-funktiossa TOTP-salauksen kanssa.
function mapEncryptedFields(name, records, transform) {
  const fields = ENCRYPTED_FIELDS[name];
  if (!fields || !Array.isArray(records)) return records;
  return records.map((record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
    let copy = null; // luodaan vain jos jokin kenttä oikeasti muuttuu
    for (const field of fields) {
      const value = record[field];
      // Tyhjä tai puuttuva arvo jätetään koskematta: ei haluta tallentaa salattua
      // tyhjää merkkijonoa, joka näyttäisi levyllä täytetyltä kentältä.
      if (typeof value !== 'string' || value === '') continue;
      const next = transform(value);
      if (next === value) continue;
      if (!copy) copy = { ...record };
      copy[field] = next;
    }
    return copy || record;
  });
}

// Onko levyllä vielä selväkielisiä arvoja salattavissa kentissä (eli tarvitaanko
// kertaluonteinen migraatio). Tunnistetaan enc:-etuliitteen puuttumisesta, samaan
// tapaan kuin db.js:n needsTotpEncryption.
function hasPlaintextFields(name, records) {
  const fields = ENCRYPTED_FIELDS[name];
  if (!fields || !Array.isArray(records)) return false;
  return records.some(
    (record) =>
      record &&
      typeof record === 'object' &&
      fields.some((field) => typeof record[field] === 'string' && record[field] !== '' && !isEncryptedValue(record[field]))
  );
}

export function readCollection(name) {
  const file = COLLECTIONS[name];
  if (!file) throw new Error(`Tuntematon kokoelma: ${name}`);
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return null; // null = ei vielä tallennettua dataa, käytä oletusarvoja frontissa
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
  // Salauksen purku on tarkoituksella try/catchin ULKOPUOLELLA: jos purku epäonnistuu
  // (väärä avain, vioittunut tavu), pyynnön pitää kaatua näkyvästi. Jos palauttaisimme
  // tässä null/tyhjän, kokoelma näyttäisi tyhjältä — ja koska romahdussuoja
  // (wouldWipeNonEmptyCollection) vertaa uutta dataa nimenomaan nykyiseen, tyhjä
  // nykytila avaisi tien sille että seuraava tallennus ylikirjoittaa koko kokoelman.
  // Näkyvä 500 on aina parempi kuin hiljainen datan menetys.
  const plain = mapEncryptedFields(name, parsed, decryptValue);
  // Kertaluonteinen migraatio: tätä ominaisuutta edeltävä data on levyllä
  // selväkielisenä, ja se salataan heti ensimmäisellä luvulla. Ei kirjoiteta joka
  // luvulla — writeCollection salaa aina uudella satunnaisella IV:llä, joten sama
  // henkilötunnus tuottaisi joka kerta eri salatekstin ja levylle kirjoitettaisiin
  // turhaan jokaisella GET-pyynnöllä.
  if (hasPlaintextFields(name, parsed)) {
    try {
      writeCollection(name, plain);
    } catch (err) {
      // Migraation epäonnistuminen ei saa estää datan lukemista — kutsuja saa oikean
      // selväkielisen datan joka tapauksessa, ja migraatiota yritetään uudelleen
      // seuraavalla luvulla.
      console.error(`Kenttäsalauksen migraatio epäonnistui kokoelmalle ${name}:`, err.message);
    }
  }
  return plain;
}

export function writeCollection(name, data) {
  const file = COLLECTIONS[name];
  if (!file) throw new Error(`Tuntematon kokoelma: ${name}`);
  const p = path.join(DATA_DIR, file);
  const tmp = `${p}.tmp`;
  // Jo salattu arvo jätetään ennalleen: kahteen kertaan salaaminen olisi hiljainen
  // datan korruptio (yksi purku palauttaisi yhä "enc:"-alkuisen merkkijonon, joka
  // näkyisi käyttöliittymässä henkilötunnuksen paikalla).
  const forStorage = mapEncryptedFields(name, data, (value) =>
    isEncryptedValue(value) ? value : encryptValue(value)
  );
  fs.writeFileSync(tmp, JSON.stringify(forStorage, null, 2));
  fs.renameSync(tmp, p);
}

export const KNOWN_COLLECTIONS = Object.keys(COLLECTIONS);

// Datahakemiston tiedostojärjestelmän tilanne (Asetukset-näkymän tallennustilamittari).
// Tämä moduuli tuntee DATA_DIRin, joten levytilan luku kuuluu tänne eikä reitille.
// fs.statfsSync eikä ulkoinen df: ei riipu shellistä eikä sen tulosteen muodosta.
//
// Luvut lasketaan TÄSMÄLLEEN samalla tavalla kuin df, jotta käyttöliittymä ja
// palvelimelta ajettu `df -h` eivät ole eri mieltä (se näyttäisi bugilta):
//   used  = (blocks - bfree) * bsize   -> myös rootille varattu osuus on "vapaana"
//   avail = bavail * bsize             -> mitä tavallinen käyttäjä voi kirjoittaa
//   %     = used / (used + avail)      -> ei used/total, koska varattu osuus
//                                         ei kuulu kumpaankaan
// Ero on tässä ~3 prosenttiyksikköä (ext4 varaa oletuksena 5 % rootille).
export function getStorageUsage() {
  const st = fs.statfsSync(DATA_DIR);
  const total = st.blocks * st.bsize;
  const used = (st.blocks - st.bfree) * st.bsize;
  const free = st.bavail * st.bsize;
  const nayttoTila = used + free;
  return {
    total,
    used,
    free,
    usedPercent: nayttoTila > 0 ? Math.round((used / nayttoTila) * 1000) / 10 : 0,
  };
}
