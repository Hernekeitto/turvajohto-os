// Pohjamoottori (perusta P6).
//
// Yksi kokoelma `templates` kaikille pohjille, ja `kind` kertoo minkä lajin pohja on.
// Ensimmäinen laji on kierrospohja; erä 8 tuo skenaariopohjat, ohjepankin ja run sheetin
// samaan koneistoon. Siksi tämä moduuli EI tiedä kierroksista mitään muuta kuin sen mitä
// LAJIT-taulukossa lukee: jos laji vaatisi oman moduulinsa jokaiseen sääntöön, kokoelmasta
// ei olisi mitään hyötyä verrattuna neljään erilliseen kokoelmaan.
//
// Kolme asiaa jotka pohjamoottorin on hoidettava, ja jotka ovat samat joka lajille:
//
//  1. OMISTAJA. Pohja kuuluu kohteeseen tai tapahtumaan, ja omistajan id toimii
//     oikeusavaimena samalla tavalla kuin muissakin kokoelmissa (permissions.js:
//     eventScoped). Omistajaton "koko yrityksen yhteinen pohja" olisi eri oikeuskysymys
//     eikä sitä ratkaista tässä — kenttä on pakollinen toistaiseksi.
//
//  2. VERSIO. Pohjaa muokataan, mutta jo tehdyt suoritukset on voitava lukea sellaisina
//     kuin ne tehtiin. Versionumero kasvaa kun sisältö muuttuu, ja suoritukseen
//     kopioidaan pohjan nimi ja versio — ei viittausta jonka takaa sisältö vaihtuu.
//
//  3. INSTANSSIT. Pohjasta tehdään suorituksia. Instansointi on kopio, ei viittaus,
//     samasta syystä kuin versiointi.
//
// Lajikohtainen sisältö on tietueen YLÄTASON kentissä (kierrospohjalla `pisteet`) eikä
// `sisalto`-olion sisällä. Sama ratkaisu kuin polymorfisessa reports-kokoelmassa, jossa
// jokaisella 14 tyypistä on omat ylätason kenttänsä. Syy on käytännöllinen: store.js:n
// kenttäsalaus osaa polun muodon `taulukko[].kentta` mutta ei sisäkkäistä polkua, joten
// `sisalto.pisteet[].token` olisi jäänyt salaamatta HILJAA — ilman virhettä, ilman
// varoitusta, ja tarkistuspisteiden tokenit olisivat olleet levyllä selväkielisinä.

import crypto from 'node:crypto';

export const LAJIT = {
  // Kierrospohja: nimetty joukko tarkistuspisteitä jotka kierretään järjestyksessä.
  patrol: {
    nimi: 'Kierrospohja',
    tuote: 'guard',
    // Sivukartan solmu jolla pohjaa hallitaan. Sama rooli kuin lomakerekisterin tabId:llä.
    solmu: 'guard_patrol_templates',
  },
};

export const onTunnettuLaji = (kind) => Object.prototype.hasOwnProperty.call(LAJIT, kind);

// Pohjan ja tarkistuspisteen tekstikenttien rajat. Sama peruste kuin julkisella
// ilmoituksella: ilman rajaa yksi pyyntö voi kirjoittaa megatavuja levylle, ja kokoelma
// kirjoitetaan kokonaan joka kerta.
export const RAJAT = { nimi: 120, kuvaus: 2000, pisteita: 100 };

// Tarkistuspisteen token. Sama pituus kuin jakolinkin ja julisteen tokenilla, mutta eri
// uhkakuva: tämä on tarrassa seinässä eikä salaisuus. Tokenin tehtävä on sitoa skannaus
// oikeaan pisteeseen ja tehdä väärään paikkaan viedystä tarrasta peruutettava.
export const luoPisteToken = () => crypto.randomBytes(32).toString('base64url');

// Ohjausmerkit pois. Suodatus tehdään merkkikoodeilla eikä säännöllisellä lausekkeella
// samasta syystä kuin julkinen.js:ssä: merkkiluokka vaatisi escape-jonoja, ja raakana
// kirjoitettuna ohjausmerkit tekevät lähdetiedostosta binaarin jota ei voi lukea eikä
// turvallisesti muokata. Tämä tapahtui kerran jo, eikä sitä kannata tehdä toista kertaa.
//
// Pohjan kentissä EI säilytetä rivinvaihtoa: nimi ja kuvaus näkyvät tarrassa ja listassa
// yhtenä rivinä.
const siivoa = (arvo, maxPituus) => {
  let tulos = '';
  for (const merkki of String(arvo ?? '')) {
    const koodi = merkki.codePointAt(0);
    // 9 = sarkain, 10 = rivinvaihto, 13 = rivinsiirto. Nämä muuttuvat välilyönniksi.
    if (koodi === 9 || koodi === 10 || koodi === 13) { tulos += ' '; continue; }
    // 0-31 = ohjausmerkit, 127 = DEL.
    if (koodi < 32 || koodi === 127) continue;
    tulos += merkki;
  }
  return tulos.trim().slice(0, maxPituus);
};

// Koordinaatti tai null. Sama tarkistus kuin liitteiden EXIF-lukijassa selaimen puolella:
// rikkinäisestä lukemasta ei saa syntyä pistettä kartalle.
export function tarkistaGps(gps) {
  const lat = Number(gps?.lat);
  const lon = Number(gps?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

// Tarkistaa ja normalisoi kierrospohjan pisteet. Palauttaa { ok, pisteet } tai { ok:false, error }.
//
// `vanhat` on aiempi pistelista: jo olemassa olevan pisteen token SÄILYTETÄÄN, jottei
// pohjan nimen korjaaminen mitätöi jokaista seinässä olevaa tarraa. Uusi piste saa uuden
// tokenin, poistettu piste vie omansa mukanaan.
export function tarkistaPisteet(syote, vanhat = []) {
  if (!Array.isArray(syote) || syote.length === 0) {
    return { ok: false, error: 'Kierrospohjassa on oltava vähintään yksi tarkistuspiste.' };
  }
  if (syote.length > RAJAT.pisteita) {
    return { ok: false, error: `Tarkistuspisteitä voi olla enintään ${RAJAT.pisteita}.` };
  }
  const vanhatById = new Map((Array.isArray(vanhat) ? vanhat : []).map((p) => [String(p?.id ?? ''), p]));
  const nahdyt = new Set();
  const pisteet = [];
  for (const [i, p] of syote.entries()) {
    const nimi = siivoa(p?.nimi, RAJAT.nimi);
    if (nimi.length < 1) {
      return { ok: false, error: `Tarkistuspisteeltä ${i + 1} puuttuu nimi.` };
    }
    const id = String(p?.id ?? '') || crypto.randomUUID();
    if (nahdyt.has(id)) {
      return { ok: false, error: 'Sama tarkistuspiste esiintyy listassa kahdesti.' };
    }
    nahdyt.add(id);
    const vanha = vanhatById.get(id);
    pisteet.push({
      id,
      nimi,
      kuvaus: siivoa(p?.kuvaus, RAJAT.kuvaus),
      // Järjestys talletetaan eksplisiittisesti eikä jätetä taulukon varaan: kierroksen
      // suorituksessa pisteet näytetään tässä järjestyksessä, ja järjestys on osa
      // kierroksen sisältöä (sulkukierros kulkee ulkoa sisään, ei sattumanvaraisesti).
      jarjestys: i,
      token: vanha?.token || luoPisteToken(),
      // Pisteen tiedetty sijainti. Käytetään vain jos sijaintipakotus on kytketty
      // päälle; muuten se on vertailuluku jonka avulla skannauksen etäisyys lasketaan
      // todisteeksi.
      gps: tarkistaGps(p?.gps),
    });
  }
  return { ok: true, pisteet };
}

// Pohjan nimi ja kuvaus. Erillinen funktio, koska sama siivous tarvitaan sekä luonnissa
// että muokkauksessa eikä siivoa-funktiota viedä ulos moduulista.
export function tarkistaNimi(nimi) {
  const puhdas = siivoa(nimi, RAJAT.nimi);
  if (puhdas.length < 2) return { ok: false, error: 'Anna pohjalle nimi.' };
  return { ok: true, nimi: puhdas };
}

export const puhdistaKuvaus = (kuvaus) => siivoa(kuvaus, RAJAT.kuvaus);

// Onko pohjan sisältö muuttunut niin että versionumeron on kasvettava. Nimen ja kuvauksen
// muuttaminen EI kasvata versiota: versio kertoo mitä kierrettiin, ei miltä otsikko näytti.
export function sisaltoMuuttui(vanha, uusi) {
  const olennainen = (pohja) => JSON.stringify(
    (pohja?.pisteet || []).map((p) => [p.id, p.nimi, p.jarjestys, p.gps])
  );
  return olennainen(vanha) !== olennainen(uusi);
}

// Pohjan julkinen esitys: tarkistuspisteiden tokenit EIVÄT kulje listahaussa. Sama
// periaate kuin jakolinkeillä ja ilmoitusjulisteilla — token haetaan erikseen silloin kun
// käyttäjä tulostaa tarrat.
export function julkinenPohja(pohja) {
  if (!pohja || typeof pohja !== 'object') return pohja;
  return { ...pohja, pisteet: (pohja.pisteet || []).map(({ token: _token, ...rest }) => rest) };
}

// Etsii tarkistuspisteen tokenilla kaikista pohjista. Vakioaikainen vertailu jokaista
// vastaan samasta syystä kuin jakolinkeillä: vastausaika ei saa kertoa kuinka moni merkki
// osui, vaikka token ei olekaan salaisuus.
export function etsiPisteTokenilla(pohjat, token) {
  if (typeof token !== 'string' || token.length === 0) return null;
  const annettu = Buffer.from(token);
  for (const pohja of Array.isArray(pohjat) ? pohjat : []) {
    for (const piste of pohja?.pisteet || []) {
      const tallennettu = Buffer.from(String(piste?.token ?? ''));
      if (tallennettu.length !== annettu.length) continue;
      if (crypto.timingSafeEqual(annettu, tallennettu)) return { pohja, piste };
    }
  }
  return null;
}
