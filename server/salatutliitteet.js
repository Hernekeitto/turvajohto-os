// Salatut mediliitteet (erä 26, vaihe 3, viipale 3d).
//
// "Salattu" tarkoittaa: sisältö on AINA jo asiakkaan salaama kertakäyttöisellä
// tiedostoavaimella ENNEN latausta (src/shared/salatutliitteet.ts) — tämä tiedosto
// käsittelee opaakkia tavujonoa eikä koskaan tiedosto- tai mime-tyyppiä (Obsidian:
// "vaihe 3 -suunnitelma", kohta 1: "palvelin voi enää valvoa vain tavukokoa").
// Tiedostoavain itse kulkee viestin OMAN Megolm-salauksen sisällä liiteosoittimena
// (kuten Signalin liiteosoitin, server/viestit.js) — palvelin ei näe sitä koskaan.
//
// ERI ASIA kuin server/uploads.js: se validoi tiedostopäätteen (isAllowedFile) ja
// tallentaa EVENT-puolen selväkielisiä liitteitä. Tämä moduuli EI VOI VALIDOIDA
// TYYPPIÄ — data on opaakkia — ja tallentaa vain GUARD-puolen PTT-liitteitä omaan
// hakemistoonsa.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(import.meta.dirname, 'data');
const LIITE_DIR = path.join(DATA_DIR, 'salatut-liitteet');

fs.mkdirSync(LIITE_DIR, { recursive: true });

export function tallennaSalattuLiite(buffer) {
  const id = crypto.randomUUID();
  fs.writeFileSync(path.join(LIITE_DIR, id), buffer);
  return id;
}

export function haeSalatunLiitteenPolku(id) {
  // path.basename estää polkujen sekoilun (esim. "../../etc/passwd") — sama suoja
  // kuin server/uploads.js:n getUploadPathissa.
  const safe = path.basename(String(id || ''));
  if (!safe) return null;
  const p = path.join(LIITE_DIR, safe);
  return fs.existsSync(p) ? p : null;
}

export function poistaSalattuLiite(id) {
  const p = haeSalatunLiitteenPolku(id);
  if (!p) return false;
  try {
    fs.unlinkSync(p);
    return true;
  } catch (err) {
    console.error(`Salatun liitteen poisto epäonnistui (${id}):`, err.message);
    return false;
  }
}
