// Käyttö: node scripts/create-user.js <kayttajatunnus> <salasana> [nimimerkki]
// Luo uuden käyttäjän tai päivittää olemassa olevan salasanan. Nimimerkki on
// vapaaehtoinen (oletuksena käyttäjätunnus) — käytetään mm. raporttien
// "Laatija"-kenttänä. Rooli ja sivukartta-oikeudet hallitaan sovelluksen
// "Muokkaa käyttäjiä" -näkymästä kirjautumisen jälkeen.
import bcrypt from 'bcryptjs';
import { upsertUser } from '../db.js';

const [, , username, password, nickname] = process.argv;

if (!username || !password) {
  console.error('Käyttö: node scripts/create-user.js <kayttajatunnus> <salasana> [nimimerkki]');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Salasanan tulee olla vähintään 8 merkkiä.');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
upsertUser(username, hash, { nickname });
console.log(`Tallennettu käyttäjä "${username}"${nickname ? ` (nimimerkki: ${nickname})` : ''}.`);
