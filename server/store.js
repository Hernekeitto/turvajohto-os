import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// Sallittujen kokoelmien "allow-list" estää polkujen sekoilun ulkopuolisesta syötteestä
const COLLECTIONS = {
  checkins: 'checkins.json',
  reports: 'reports.json',
  events: 'events.json',
  riskAssessments: 'riskAssessments.json',
  employees: 'employees.json',
};

fs.mkdirSync(DATA_DIR, { recursive: true });

export function readCollection(name) {
  const file = COLLECTIONS[name];
  if (!file) throw new Error(`Tuntematon kokoelma: ${name}`);
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return null; // null = ei vielä tallennettua dataa, käytä oletusarvoja frontissa
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function writeCollection(name, data) {
  const file = COLLECTIONS[name];
  if (!file) throw new Error(`Tuntematon kokoelma: ${name}`);
  const p = path.join(DATA_DIR, file);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, p);
}

export const KNOWN_COLLECTIONS = Object.keys(COLLECTIONS);
