// Sijaintikerros: kuka on missäkin juuri nyt.
//
// JULKAISUESTE. Seuranta on POIS PÄÄLTÄ oletuksena ja kytkeytyy vain
// ympäristömuuttujalla SIJAINTISEURANTA=1. Jatkuva sijainnin seuranta on
// työntekijöihin kohdistuvaa teknistä valvontaa, ja ennen käyttöönottoa tarvitaan
// yhteistoimintakäsittely, informointi, käsittelyperuste ja vaikutustenarviointi
// (ks. vaultin muistiinpano "puuteluettelo ja työjärjestys", juridinen työpaketti).
// Koodi saa olla valmiina ja testattuna sitä ennen — päälle sitä ei kytketä.
//
// EI LEVYLLE. Sijainnit elävät vain muistissa. Kaksi syytä:
//
// 1. Nykyinen tallennus kirjoittaa koko kokoelmatiedoston kerralla. Sadan vartijan
//    sijaintivirta tarkoittaisi tuhansia täysiä tiedostokirjoituksia tunnissa.
// 2. Sijaintihistorian säilytysaika on nimenomaan yksi juridisen työpaketin
//    ratkaisemattomista kohdista. Henkilötietovaraston perustaminen ennen kuin sen
//    elinkaari on päätetty olisi väärä järjestys.
//
// Muistissa pidettävä viimeksi tiedetty sijainti riittää kaikkeen mitä erä 3 lupaa:
// vartijat kartalla, sijainnin ikä näkyvissä ja lähimmän haku. Historia on sen jälkeen
// oma pieni lisäyksensä eikä uudelleenkirjoitus.

import { canView, eventAllowed } from './permissions.js';

// Sijainti vanhenee: puhelin sammui, sovellus suljettiin tai vuoro loppui. Vanhentunut
// sijainti on pahempi kuin puuttuva — se väittää tietävänsä missä ihminen on.
const VANHENEE_MS = 30 * 60 * 1000;

// username -> { username, eventId, img, gps, at }
const viimeisin = new Map();

export const seurantaKaytossa = () => process.env.SIJAINTISEURANTA === '1';

const luku = (arvo, min, max) => {
  const n = Number(arvo);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

// Kuvakoordinaatti on osuus pohjakuvan mitoista (0–1), sama esitys kuin vyöhykkeillä
// (ks. src/shared/vyohykkeet.ts). GPS on erikseen, koska pohjakartta ei ole
// georeferoitu — niitä ei voi johtaa toisistaan.
export function lueSijainti(syote) {
  if (!syote || typeof syote !== 'object') return null;
  const img = syote.img && typeof syote.img === 'object'
    ? { x: luku(syote.img.x, 0, 1), y: luku(syote.img.y, 0, 1) }
    : null;
  const gps = syote.gps && typeof syote.gps === 'object'
    ? {
        lat: luku(syote.gps.lat, -90, 90),
        lon: luku(syote.gps.lon, -180, 180),
        // Tarkkuus metreinä. Yli kymmenen kilometrin "tarkkuus" on käytännössä
        // tieto siitä missä maakunnassa ollaan, eikä sitä kannata näyttää kartalla.
        tarkkuus: luku(syote.gps.tarkkuus, 0, 10000),
        // Nopeus (m/s) ja kulkusuunta (astetta, 0 = pohjoinen). Androidin Location antaa
        // molemmat ilmaiseksi, ja kaupunkimittakaavan kartalla ne vastaavat kysymykseen
        // johon pelkkä piste ei vastaa: onko tämä yksikkö liikkeessä vai pysähtynyt, ja
        // mihin suuntaan. Ilman niitä sen näkee vain vertaamalla kahta peräkkäistä
        // mittausta — eikä kahta ole silloin kun laite on juuri aloittanut vuoron.
        //
        // Yläraja 100 m/s = 360 km/h ei ole ajoneuvon nopeus vaan kelvollisuusraja:
        // sitä suuremmat lukemat ovat paikannusvirheitä, ja kartalla ne piirtäisivät
        // nuolen joka väittää partion olevan lentokoneessa.
        nopeus: luku(syote.gps.nopeus, 0, 100),
        suunta: luku(syote.gps.suunta, 0, 360),
      }
    : null;

  // Mistä päivitys tuli. DIAGNOSTIIKKAA EIKÄ PÄÄSYNVALVONTAA: kenttä tulee lähettäjältä
  // eikä yhteydestä, joten selain voisi väittää olevansa laite. Sillä ei ole väliä, koska
  // kenttä ei avaa mitään — se vastaa vain kysymykseen "miksi tämä piste on kymmenen
  // minuuttia vanha". Selain paikantaa vain näkyvissä ollessaan ja laite koko vuoron ajan,
  // ja ilman tätä eroa vanha piste näyttää samalta vialta kummassakin tapauksessa.
  const lahde = syote.lahde === 'laite' ? 'laite' : 'selain';

  const imgOk = img && img.x !== null && img.y !== null;
  const gpsOk = gps && gps.lat !== null && gps.lon !== null;
  if (!imgOk && !gpsOk) return null;
  return { img: imgOk ? img : null, gps: gpsOk ? { ...gps } : null, lahde };
}

// Palauttaa tallennetun sijainnin tai nullin jos syöte oli kelvoton. Aikaleima tulee
// PALVELIMELTA eikä selaimelta: laitteen kello voi olla väärässä, ja sijainnin ikä on
// se tieto jonka perusteella TIKE päättää luottaako siihen.
export function paivita(username, eventId, syote, nyt = Date.now()) {
  if (!seurantaKaytossa()) return null;
  if (!username) return null;
  const sijainti = lueSijainti(syote);
  if (!sijainti) return null;
  const tietue = { username, eventId: eventId || null, ...sijainti, at: nyt };
  viimeisin.set(username, tietue);
  return tietue;
}

// Vuoron päättyminen ja uloskirjautuminen poistavat sijainnin. Tämä on se tekninen
// minimointi joka vastaa kysymykseen "seurataanko minua vapaa-ajalla": ei seurata,
// koska tietoa ei ole olemassa.
// Yhden henkilön viimeksi tiedetty sijainti. Tarvitaan vyöhykepoikkeamien arviointiin
// (erä 7): hälytys syntyy vain kun raja ylitetään, ja sen näkee vain vertaamalla uutta
// sijaintia edelliseen. Vanhentunutta ei palauteta — tunnin takainen sijainti ei kerro
// mitään siitä ylitettiinkö raja juuri nyt.
export function hae(username, nyt = Date.now()) {
  const tietue = viimeisin.get(username);
  if (!tietue) return null;
  if (nyt - tietue.at > VANHENEE_MS) {
    viimeisin.delete(username);
    return null;
  }
  return tietue;
}

export function unohda(username) {
  return viimeisin.delete(username);
}

export function tyhjenna() {
  viimeisin.clear();
}

// Kaikki tuoreet sijainnit, valinnaisesti yhdestä tapahtumasta. Vanhentuneet poistetaan
// samalla — erillistä siivousajastinta ei tarvita, koska lista luetaan joka tapauksessa
// aina kun sitä näytetään.
export function kaikki({ eventId = null, nyt = Date.now() } = {}) {
  const tulos = [];
  for (const [username, tietue] of viimeisin) {
    if (nyt - tietue.at > VANHENEE_MS) {
      viimeisin.delete(username);
      continue;
    }
    if (eventId && tietue.eventId && tietue.eventId !== eventId) continue;
    tulos.push({ ...tietue, ikaMs: nyt - tietue.at });
  }
  return tulos;
}

export const VANHENEE = VANHENEE_MS;

// --- Katselun kirjaaminen ----------------------------------------------------------
//
// Sijainnin katsominen kirjataan auditlokiin (päätös 15.9.2026). Se on ainoa tapa jolla
// työntekijä voi jälkikäteen tarkistaa kuka on katsonut hänen sijaintiaan — järjestelmä
// kirjaa jo master-koodin katsomisen ja kohdehenkilötietojen lukemisen, eikä ole
// perustetta sille miksi henkilöstön sijainti olisi vähemmän arka.
//
// MUTTA JOKAISEN HAUN KIRJAAMINEN TEKISI LOKISTA KÄYTTÖKELVOTTOMAN. Käyttöliittymä
// hakee sijainnit 60 sekunnin välein niin kauan kuin näkymä on auki (GuardApp.tsx),
// eli noin 480 riviä yhtä kahdeksan tunnin vuoroa ja päivystäjää kohden. Loki, josta ei
// löydä mitään, ei suojaa ketään — se vain näyttää suojalta.
//
// Siksi kirjataan KATSELUJAKSO eikä yksittäinen pyyntö: ensimmäinen haku kirjataan, ja
// seuraavat saman katsojan haut vaikenevat kunnes ikkuna umpeutuu. Rivi kertoo kuka
// katsoi, milloin ja keitä — ja se on juuri se tieto jota työntekijä kysyisi.
//
// VIIDENTOISTA MINUUTIN IKKUNA on kompromissi: lyhyempi tuottaa kohinaa, pidempi
// piilottaa sen että sama henkilö palasi katsomaan uudestaan. Päivystäjä jolla näkymä on
// auki koko vuoron tuottaa 32 riviä kahdeksassa tunnissa — luettava määrä, ja siitä näkee
// että näkymä on ollut auki jatkuvasti.
const KATSELU_IKKUNA_MS = 15 * 60 * 1000;

// katsoja -> viimeisimmän kirjatun katselun aikaleima.
const katselut = new Map();

/**
 * Pitääkö tämä katselu kirjata, vai onko se saman jakson jatkoa.
 *
 * Sivuvaikutuksellinen tarkoituksella: kutsuja kysyy tämän kerran ja kirjaa jos vastaus
 * on tosi. Kahteen funktioon jaettuna kutsuja voisi unohtaa merkitä jakson alkaneeksi,
 * ja silloin jokainen pyyntö kirjautuisi uudelleen.
 */
export function kirjataankoKatselu(katsoja, nyt = Date.now()) {
  if (!katsoja) return false;
  const edellinen = katselut.get(katsoja);
  // `!== undefined` eikä totuusarvo: aikaleima 0 on kelvollinen arvo mutta epätosi, ja
  // totuusarvotarkistus ohittaisi ikkunan kokonaan. Tuotannossa Date.now() ei ole
  // koskaan nolla, joten tämä ei olisi näkynyt siellä — testi löysi sen.
  if (edellinen !== undefined && nyt - edellinen < KATSELU_IKKUNA_MS) return false;
  katselut.set(katsoja, nyt);
  return true;
}

/** Nollaa katselujaksot. Testejä varten; tuotannossa ne vanhenevat itsestään. */
export function tyhjennaKatselut() {
  katselut.clear();
}

export const KATSELU_IKKUNA = KATSELU_IKKUNA_MS;

// --- Näkyvyys ---------------------------------------------------------------------
//
// Kenelle yksittäinen sijaintirivi näytetään. TÄÄLLÄ EIKÄ index.js:ssä, jotta sääntö on
// testattavissa ilman palvelinta — index.js:llä ei ole testitiedostoa, ja juuri tämä
// sääntö on se jota EI voi todentaa silmämääräisesti. Edellinen versio hyväksyttiin
// pääkäyttäjänä testattuna, ja admin ohittaa koko tarkistuksen.
//
// KUTSUJA on `{ role, eventAccess, permissions }`: sama muoto kuin requireAuthin
// täydentämä req, mutta oliona jotta testi voi rakentaa sen ilman pyyntöä.

/**
 * Onko kysyjällä sijaintioikeutta lainkaan.
 *
 * Tämä on eri kysymys kuin rivikohtainen näkyvyys, ja ero on tarkoituksellinen:
 * puuttuva oikeus vastaa 403:lla ja riittävä oikeus tyhjällä listalla. Valvomon ruudulla
 * "ei oikeutta" ja "kukaan ei ole kentällä" eivät saa näyttää samalta.
 */
export function saaNahdaSijainteja(kysyja) {
  if (kysyja?.role === 'admin') return true;
  // Molemmat solmut luetaan __default__-asetuksesta: guard_locations on GLOBAL_NODES-
  // listalla, ja locations luetaan oletusasetuksesta kun eventId on null.
  return canView(kysyja?.permissions, null, 'locations')
    || canView(kysyja?.permissions, null, 'guard_locations');
}

/**
 * Yhden sijaintirivin näkyvyys.
 *
 * Kohteellinen rivi rajautuu eventAccessillä kuten kaikki muukin. KOHTEETON rivi on
 * piirivuorossa oleva yksikkö: eventAccess ei voi rajata sitä, koska ei ole mitään mihin
 * verrata, joten portiksi jää solmu. `guard_locations` eikä `locations`, koska piirivuoro
 * on määritelmällisesti GUARD-puolen käsite — tapahtumapuolen katselija ei saa nähdä
 * vartiointiliikkeen partioita sillä perusteella että hänellä on oikeus oman
 * tapahtumansa henkilöstöön.
 */
export function saaNahdaSijaintirivin(kysyja, tietue) {
  if (kysyja?.role === 'admin') return true;
  if (tietue?.eventId) {
    return eventAllowed(kysyja?.eventAccess, tietue.eventId)
      && (canView(kysyja?.permissions, tietue.eventId, 'locations')
        || canView(kysyja?.permissions, tietue.eventId, 'guard_locations'));
  }
  return canView(kysyja?.permissions, null, 'guard_locations');
}
