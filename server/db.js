import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_PATH = path.join(DATA_DIR, 'users.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_PATH)) {
  fs.writeFileSync(USERS_PATH, JSON.stringify({ users: [] }, null, 2));
}

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')).users;
}

function writeUsers(users) {
  // kirjoitetaan väliaikaiseen tiedostoon ja siirretään atomisesti, ettei tiedosto koskaan jää kesken
  const tmp = `${USERS_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ users }, null, 2));
  fs.renameSync(tmp, USERS_PATH);
}

export function findUser(username) {
  return readUsers().find((u) => u.username === username) || null;
}

export function upsertUser(username, passwordHash) {
  const users = readUsers();
  const existing = users.find((u) => u.username === username);
  if (existing) {
    existing.password_hash = passwordHash;
  } else {
    users.push({ username, password_hash: passwordHash, created_at: new Date().toISOString() });
  }
  writeUsers(users);
}
