import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(import.meta.dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Sallitut liitetiedostotyypit (kuvat + yleisimmät dokumentit). Rajaa mitä
// lomakkeilta voi "Ota kuva" / "Liitä tiedosto" -painikkeilla tallentaa palvelimelle.
const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'
]);

export function isAllowedFile(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export function saveUpload(originalName, buffer) {
  const ext = path.extname(originalName || '').toLowerCase();
  const id = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, id), buffer);
  return id;
}

export function getUploadPath(id) {
  // path.basename estää polkujen sekoilun (esim. "../../etc/passwd")
  const safe = path.basename(String(id || ''));
  if (!safe) return null;
  const p = path.join(UPLOAD_DIR, safe);
  return fs.existsSync(p) ? p : null;
}

// --- Liitetiedostojen poisto ---
//
// Tapahtumailmoituksia koskee lakisääteinen säilytysaika, jonka jälkeen henkilötietoja
// sisältävät ilmoitukset on hävitettävä. Raportin poistaminen ei riittänyt siihen:
// liitetiedosto (esim. valokuva kohdehenkilöstä) jäi tähän hakemistoon pysyvästi,
// koska poistoa ei ollut toteutettu lainkaan. Nyt raporttien kirjoituspolku siivoaa
// tiedostot joihin yksikään raportti ei enää viittaa (ks. index.js).

export function deleteUpload(id) {
  const p = getUploadPath(id);
  if (!p) return false;
  try {
    fs.unlinkSync(p);
    return true;
  } catch (err) {
    console.error(`Liitetiedoston poisto epäonnistui (${id}):`, err.message);
    return false;
  }
}

export function listUploads() {
  try {
    return fs.readdirSync(UPLOAD_DIR).filter((nimi) => {
      try {
        return fs.statSync(path.join(UPLOAD_DIR, nimi)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

// Poistaa tiedostot joihin yksikään raportti ei viittaa. graceMs suojaa
// kilpailutilanteelta: liite ladataan palvelimelle ENNEN kuin sen raportti
// tallennetaan, joten juuri ladattu tiedosto ei vielä näy viittauksissa. Ilman
// armonaikaa toisen käyttäjän samanaikainen raporttitallennus poistaisi sen.
// Tätä vanhemmat viittaamattomat tiedostot ovat oikeasti orpoja — myös ne jotka
// jäivät levylle ennen tämän toteuttamista.
export function collectGarbage(referencedIds, { graceMs = 24 * 60 * 60 * 1000 } = {}) {
  const viitatut = new Set((referencedIds || []).filter(Boolean).map((id) => path.basename(String(id))));
  const raja = Date.now() - graceMs;
  const poistetut = [];
  for (const nimi of listUploads()) {
    if (viitatut.has(nimi)) continue;
    let mtime;
    try {
      mtime = fs.statSync(path.join(UPLOAD_DIR, nimi)).mtimeMs;
    } catch {
      continue;
    }
    if (mtime > raja) continue; // liian tuore — voi olla juuri ladattu liite
    if (deleteUpload(nimi)) poistetut.push(nimi);
  }
  return poistetut;
}
