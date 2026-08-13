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
