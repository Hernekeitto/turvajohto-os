// Käyttö: node scripts/create-user.js <kayttajatunnus> <salasana>
// Luo uuden käyttäjän tai päivittää olemassa olevan salasanan.
import bcrypt from 'bcryptjs';
import { upsertUser } from '../db.js';

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error('Käyttö: node scripts/create-user.js <kayttajatunnus> <salasana>');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Salasanan tulee olla vähintään 8 merkkiä.');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
upsertUser(username, hash);
console.log(`Tallennettu käyttäjä "${username}".`);
