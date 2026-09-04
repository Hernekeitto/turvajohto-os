// Istunnon kesto: kuinka kauan kirjautuminen on voimassa.
//
// Kolme tapausta, ja niiden ero on TARKOITUKSELLINEN:
//
//   ASENNETTU SOVELLUS   ei rajoiteta
//   Selain, pääkäyttäjä  12 h kiinteä
//   Selain, muu käyttäjä 60 min liukuva (jokainen pyyntö pidentää)
//
// --- Miksi sovelluksessa ei rajoiteta -----------------------------------------------
//
// Liukuva 60 minuutin raja on JOUTOKÄYNTIRAJA: aktiivikäyttö ei koskaan katkea, mutta
// tunti taskussa kirjaa ulos. Kentällä juuri se on kestämätöntä — vartija ei näpyttele
// salasanaa ja Authenticator-koodia hanskat kädessä pimeässä siksi, että puhelin oli
// tunnin taskussa kierroksen aikana. Selaimessa sama raja on paikallaan: siellä
// istunto on auki työaseman selaimessa, joka voi jäädä vartioimatta.
//
// Riski ei katoa vaan SIIRTYY, ja sille on kaksi hallintakeinoa:
//
//   1. LAITTEEN LUKITUS. Sovelluksen asentamisen ehtona on, että käyttäjä lukitsee
//      laitteen vahvalla salasanalla. Tämä on organisatorinen ehto, ei tekninen —
//      palvelin ei voi tarkistaa sitä.
//   2. PAKKOULOSKIRJAUS. Kadonnut laite mitätöidään käyttäjätasolta:
//      `session_invalidated_at` mitätöi käyttäjän KAIKKI istunnot välittömästi,
//      myös rajoittamattoman (ks. index.js getSessionUser). Tämä on ainoa asia joka
//      tekee rajoittamattomasta istunnosta hallittavan, ja siksi sen on toimittava
//      myös silloin kun käyttäjä ei tee mitään — front pollaa /api/session:ia
//      30 sekunnin välein juuri tämän takia.
//
// --- Miksi tähän luotetaan asiakkaan sanaan -----------------------------------------
//
// Palvelin ei voi itse päätellä onko pyyntö asennetusta sovelluksesta: TWA on
// tavallinen Chrome eikä sen API-kutsuissa ole mitään erottavaa (X-Requested-With
// tulee vain sivulatauksessa, jonka tarjoilee nginx eikä tämä palvelin). Tieto tulee
// siis selaimelta kirjautumisen yhteydessä (`display-mode: standalone`,
// src/shared/asennettu.ts) ja leivotaan allekirjoitettuun tokeniin, jotta sitä ei voi
// vaihtaa istunnon aikana ilman uutta kirjautumista.
//
// Väittämä on siis väärennettävissä — mutta vain omalla tunnuksella kirjautumalla,
// eli kyse ei ole hyökkäyspolusta vaan siitä että käyttäjä voisi itse ohittaa oman
// selainistuntonsa aikarajan. Sama käyttäjä voi ohittaa sen liikuttamalla hiirtä.
// Varsinainen suoja on kohta 2 yllä, ei tämä raja.

// Rajoittamattoman istunnon tekninen yläraja. Vuosi on käytännössä sama kuin ei
// rajaa — vuoro, viikko tai kuukauden loma ei katkaise sitä — mutta se on silti
// ÄÄRELLINEN: laite joka katoaa käytöstä kokonaan ei jää ikuisesti kirjautuneeksi
// siinäkään tapauksessa ettei pakkouloskirjausta muisteta tehdä.
export const SOVELLUS_VUOROKAUDET = 365;

// Pääkäyttäjän selainistunto: kiinteä eikä liukuva. Ei katkea käyttämättömyydestä
// työpäivän aikana, mutta ei myöskään jatku yön yli.
export const ADMIN_TUNNIT = 12;

// Muun käyttäjän selainistunto: liukuva joutokäyntiraja (index.js requireAuth
// uusii evästeen joka pyynnöllä).
export const SELAIN_MINUUTIT = 60;

/**
 * Istunnon kesto sekunteina. Sama arvo annetaan sekä JWT:n expiresIn-kentäksi että
 * evästeen maxAgeksi — jos ne eroaisivat, toinen niistä vanhenisi ensin ja
 * uloskirjautuminen tapahtuisi eri hetkellä kuin kumpikaan arvo lupaa.
 *
 * @param {{ role?: string, sovellus?: boolean }} istunto
 */
export function istunnonKesto({ role, sovellus } = {}) {
  // Asennettu sovellus ohittaa roolin: ehto on laitteessa (lukitus), ei siinä kuka
  // laitteella on kirjautunut.
  if (sovellus) return SOVELLUS_VUOROKAUDET * 24 * 60 * 60;
  if (role === 'admin') return ADMIN_TUNNIT * 60 * 60;
  return SELAIN_MINUUTIT * 60;
}
