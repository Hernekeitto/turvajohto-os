// Turvajohto OS:n rajapinta automaatiotunnuksella.
//
// Tämä on KEHITYSTYÖKALU eikä osa sovellusta: se ei kuulu `src/`- eikä `server/`-puolelle
// eikä päädy `dist/`-hakemistoon. Sen tehtävä on antaa avustajalle sama pääsy jonka
// selaimessa kirjautunut käyttäjä saa, jotta testidatan luonti ja rajapintojen todentaminen
// eivät vaadi konsoliin liitettäviä pätkiä.
//
// Käyttö:
//   node tyokalut/tj.mjs GET /api/session
//   node tyokalut/tj.mjs GET /api/data/guardSites
//   node tyokalut/tj.mjs POST /api/pohjat '{"kind":"patrol","ownerId":"..."}'
//
// --- Kolme sääntöä joiden takia tämä on tällainen ---------------------------------
//
// 1. SALASANA LUETAAN TIEDOSTOSTA, EI KOMENTORIVILTÄ. Komentorivi näkyy koneen
//    prosessilistassa ja päätyy komentohistoriaan. Polun voi vaihtaa ympäristömuuttujalla
//    TJ_SALASANA, mutta arvoa ei anneta koskaan argumenttina.
//
// 2. ISTUNTO SÄILÖTÄÄN VÄLIAIKAISHAKEMISTOON, EI REPOON. Ilman säilöä jokainen kutsu
//    tuottaisi oman kirjautumisensa auditlokiin, ja lokista tulisi lukukelvoton juuri sen
//    tiedon osalta jota se on varten. Repoon eväste ei kuulu missään tapauksessa.
//
// 3. TULOSTE EI SISÄLLÄ SALAISUUKSIA. Ei salasanaa, ei evästettä. Virheilmoitus kertoo
//    mikä meni pieleen, ei mitä arvoja käytettiin.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PALVELIN = process.env.TJ_PALVELIN || 'https://turvajohto-os.fi';
const TUNNUS = process.env.TJ_TUNNUS || 'Claude';
const SALASANATIEDOSTO = process.env.TJ_SALASANA
  || 'C:/Users/Arttu/Documents/Avaimet/Clauden salasana.txt';
const EVASTE_TIEDOSTO = path.join(os.tmpdir(), `turvajohto-istunto-${TUNNUS}.txt`);

const lueSalasana = () => {
  try {
    return fs.readFileSync(SALASANATIEDOSTO, 'utf8').trim();
  } catch {
    throw new Error(`Salasanatiedostoa ei voitu lukea: ${SALASANATIEDOSTO}`);
  }
};

const lueEvaste = () => {
  try {
    return fs.readFileSync(EVASTE_TIEDOSTO, 'utf8').trim() || null;
  } catch {
    return null;
  }
};

async function kirjaudu() {
  const vastaus = await fetch(`${PALVELIN}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TUNNUS, password: lueSalasana(), sovellus: false }),
  });
  const data = await vastaus.json().catch(() => null);

  if (data?.requiresTotp) {
    throw new Error('Tunnus vaatii Authenticator-koodin. Aseta sille totp_required: false.');
  }
  if (!vastaus.ok || !data?.ok) {
    throw new Error(`Kirjautuminen epäonnistui (${vastaus.status}): ${data?.error || 'tuntematon syy'}`);
  }
  if (data.mustChangePassword) {
    throw new Error('Palvelin vaatii salasanan vaihtoa. Vaihda se selaimessa ja päivitä tiedosto.');
  }

  const evaste = (vastaus.headers.getSetCookie?.() || [])
    .map((rivi) => rivi.split(';')[0])
    .join('; ');
  if (!evaste) throw new Error('Palvelin ei palauttanut istuntoevästettä.');
  fs.writeFileSync(EVASTE_TIEDOSTO, evaste, { mode: 0o600 });
  return evaste;
}

// Polun siivous, ja tämä on Windows-erikoisuus jota ilman työkalu ei toimi Git Bashissa:
// MSYS muuntaa kauttaviivalla alkavan argumentin Windows-poluksi, jolloin `/api/session`
// muuttuu muotoon `C:/Program Files/Git/api/session` ennen kuin node näkee sen. Osoitteesta
// tulisi silloin `turvajohto-os.fiC:/Program Files/...`, ja virhe puhuisi tuntemattomasta
// palvelimesta `turvajohto-os.fic` — mikä ei kerro syystä yhtään mitään.
//
// Kelpaavat siis kaikki kolme muotoa: /api/session, api/session ja muunnettu Windows-polku.
const siivoaPolku = (raaka) => {
  let polku = String(raaka || '');
  const kohta = polku.indexOf('/api/');
  if (kohta > 0) polku = polku.slice(kohta);
  return polku.startsWith('/') ? polku : `/${polku}`;
};

const kutsu = (metodi, polku, runko, evaste) => fetch(`${PALVELIN}${polku}`, {
  method: metodi,
  headers: {
    Cookie: evaste,
    ...(runko ? { 'Content-Type': 'application/json' } : {}),
  },
  ...(runko ? { body: runko } : {}),
});

const [metodi, raakaPolku, runko] = process.argv.slice(2);
if (!metodi || !raakaPolku) {
  console.error('Käyttö: node tyokalut/tj.mjs <METODI> <polku> [json-runko]');
  process.exit(2);
}
const polku = siivoaPolku(raakaPolku);

let evaste = lueEvaste() || (await kirjaudu());
let vastaus = await kutsu(metodi.toUpperCase(), polku, runko, evaste);

// Vanhentunut istunto: kirjaudutaan uudelleen KERRAN. Jos toinenkin yritys torjutaan, vika
// on oikeuksissa eikä istunnon iässä, eikä silmukkaa saa syntyä.
if (vastaus.status === 401) {
  evaste = await kirjaudu();
  vastaus = await kutsu(metodi.toUpperCase(), polku, runko, evaste);
}

const teksti = await vastaus.text();
console.log(`${vastaus.status} ${vastaus.headers.get('content-type') || ''}`);
try {
  console.log(JSON.stringify(JSON.parse(teksti), null, 2));
} catch {
  console.log(teksti.slice(0, 2000));
}
