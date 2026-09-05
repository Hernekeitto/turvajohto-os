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

// Pohjalajit. Jokainen rivi kertoo mitä laji on, kenelle se kuuluu ja mistä sen
// sisältö luetaan — kaikki muu on yhteistä koneistoa.
//
// `sisalto` on sen ylätason kentän nimi jossa lajin oma sisältö on. Kierrospohjalla se on
// `pisteet` (historiallinen nimi, ja pisteillä on token jota muilla ei ole), muilla
// `kohdat`. Ylätasolla eikä sisäkkäisenä oliona samasta syystä kuin ennenkin: store.js:n
// kenttäsalaus osaa polun muodon `taulukko[].kentta` mutta ei sisäkkäistä polkua.
//
// `tuote: null` tarkoittaa että laji kuuluu molemmille puolille. Silloin omistaja voi olla
// joko tapahtuma tai vartiointikohde, ja solmu valitaan sen mukaan kumpi omistaja on.
export const LAJIT = {
  // Kierrospohja: nimetty joukko tarkistuspisteitä jotka kierretään järjestyksessä.
  patrol: {
    nimi: 'Kierrospohja',
    tuote: 'guard',
    // Sivukartan solmu jolla pohjaa hallitaan. Sama rooli kuin lomakerekisterin tabId:llä.
    solmu: 'guard_patrol_templates',
    sisalto: 'pisteet',
    instansoituu: true,
  },
  // Ohjepankki: toimintakortti. Luettava ohje jota EI suoriteta kuittaamalla — kortti on
  // olemassa sitä hetkeä varten kun joku ei muista mitä tehdä, ja kuittausvaatimus tekisi
  // lukemisesta kirjanpitoa.
  guide: {
    nimi: 'Toimintakortti',
    tuote: null,
    solmu: 'guides',
    guardSolmu: 'guard_guides',
    sisalto: 'kohdat',
    instansoituu: false,
  },
  // Skenaariopohja (play): mitä tehdään kun tilanne X tapahtuu. Tämä instansoituu, koska
  // sen arvo on nimenomaan siinä että käynnissä olevasta tilanteesta näkee mikä on tehty
  // ja mikä ei — toisin kuin ohjekortista, jota luetaan.
  play: {
    nimi: 'Skenaariopohja',
    tuote: null,
    solmu: 'plays',
    guardSolmu: 'guard_plays',
    sisalto: 'kohdat',
    instansoituu: true,
  },
  // Run sheet: tapahtuman aikataulutettu ajolista. Vain tapahtumapuolella — vartiointikohteen
  // vuoro ei ole aikataulutettu esitys vaan toistuva kierros, ja se on jo kierrospohja.
  runsheet: {
    nimi: 'Run sheet',
    tuote: 'event',
    solmu: 'runsheet',
    sisalto: 'kohdat',
    instansoituu: true,
  },
};

// Lajin sivukartta-solmu omistajan mukaan. Molemmille puolille kuuluvalla lajilla on kaksi
// solmua, koska GUARD- ja EVENT-tunnusten oikeudet ovat eri: sama nimi eri puolilla jakaisi
// vahingossa saman oikeuden (ks. guard/sivukartta.ts).
export const lajinSolmu = (kind, onKohde) => {
  const laji = LAJIT[kind];
  if (!laji) return '__tuntematon_pohjalaji__';
  return onKohde && laji.guardSolmu ? laji.guardSolmu : laji.solmu;
};

// Kaikki solmut joilla jotain pohjalajia hallitaan. permissions.js tarvitsee tämän
// lukuoikeuden unionina — ilman sitä frontti ei saisi pohjia listattua lainkaan.
export const KAIKKI_SOLMUT = [
  ...new Set(Object.values(LAJIT).flatMap((l) => [l.solmu, l.guardSolmu].filter(Boolean))),
];

export const lajinSisalto = (pohja) => {
  const kentta = LAJIT[pohja?.kind]?.sisalto;
  if (!kentta) return [];
  return Array.isArray(pohja?.[kentta]) ? pohja[kentta] : [];
};

export const onTunnettuLaji = (kind) => Object.prototype.hasOwnProperty.call(LAJIT, kind);

// Pohjan ja tarkistuspisteen tekstikenttien rajat. Sama peruste kuin julkisella
// ilmoituksella: ilman rajaa yksi pyyntö voi kirjoittaa megatavuja levylle, ja kokoelma
// kirjoitetaan kokonaan joka kerta.
export const RAJAT = { nimi: 120, kuvaus: 2000, pisteita: 100, teksti: 200, kohtia: 200, vastuu: 80 };

// Tarkistuspisteen token. Sama pituus kuin jakolinkin ja julisteen tokenilla, mutta eri
// uhkakuva: tämä on tarrassa seinässä eikä salaisuus. Tokenin tehtävä on sitoa skannaus
// oikeaan pisteeseen ja tehdä väärään paikkaan viedystä tarrasta peruutettava.
export const luoPisteToken = () => crypto.randomBytes(32).toString('base64url');

// --- Viivakoodit (Code-128) -------------------------------------------------------
//
// Tarkistuspisteen tarra voi olla QR-koodi tai Code-128-viivakoodi. Ero ei ole makuasia
// vaan lukutapa: QR:n sisältö on osoite jonka puhelimen oma kamera avaa, viivakoodi
// luetaan sovelluksen omalla skannerilla tai talon käsiskannerilla.
//
// VIIVAKOODI EI VOI OLLA TOKEN. Token on 43 merkkiä, ja Code-128:na se olisi puolen
// metrin levyinen tarra. Siksi viivakoodilla on oma lyhyt tunnisteensa.
//
// Se on silti arvattavissa selvästi vaikeammin kuin juokseva numero: 10 merkkiä 31
// merkin aakkostosta on noin 10^15 vaihtoehtoa. Lyhyempi olisi mahtunut kapeampaan
// tarraan mutta tehnyt kuittauksen arvattavaksi kotisohvalta. HUOM: koodin pituus ei
// korvaa sijaintipakotusta — tarran voi yhä valokuvata ja lukea muualta.
//
// Aakkostossa ei ole merkkejä 0/O eikä 1/I/L: koodi luetaan ääneen puhelimessa ja
// kirjoitetaan käsin silloin kun lukija ei suostu lukemaan.
const KOODIAAKKOSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const VIIVAKOODIN_ETULIITE = 'TJ';

export function luoViivakoodi(kaytetyt = new Set()) {
  // Viisikymmentä yritystä on paljon enemmän kuin koskaan tarvitaan (10^15 vaihtoehtoa),
  // mutta silmukka on rajattu: rajaton olisi palvelimen jumi siinä tapauksessa jota ei
  // ole osattu kuvitella.
  for (let yritys = 0; yritys < 50; yritys += 1) {
    let koodi = VIIVAKOODIN_ETULIITE;
    for (let i = 0; i < 10; i += 1) koodi += KOODIAAKKOSET[crypto.randomInt(0, KOODIAAKKOSET.length)];
    if (!kaytetyt.has(koodi)) return koodi;
  }
  return null;
}

// Käyttäjän itse antama viivakoodi. EI muuteta isoiksi kirjaimiksi eikä siistitä muuten
// kuin poistamalla reunavälit: kenttään kirjoitetaan sen tarran sisältö joka on JO
// seinässä (laitetunnus, ovikilpi, kiinteistön oma tarra), ja siitä poikkeava arvo ei
// osu koskaan. Sallitut merkit ovat Code-128:n koodisarja B eli väli...tilde.
export function puhdistaViivakoodi(arvo) {
  const teksti = String(arvo ?? '').trim();
  if (teksti === '') return '';
  return teksti.slice(0, 48);
}

export const kelpaaViivakoodi = (arvo) => {
  if (typeof arvo !== 'string' || arvo.length === 0 || arvo.length > 48) return false;
  for (const merkki of arvo) {
    const koodi = merkki.charCodeAt(0);
    if (koodi < 32 || koodi > 126) return false;
  }
  return true;
};

// Kaikki käytössä olevat viivakoodit. Koodin on oltava yksikäsitteinen KOKO
// asennuksessa eikä vain pohjan sisällä: skannaus tulee kentältä ilman tietoa siitä
// mihin pohjaan sen pitäisi kuulua, joten kaksi samannimistä koodia tarkoittaisi että
// kuittaus osuu sattumanvaraisesti jompaankumpaan.
export function kaytetytViivakoodit(pohjat, paitsiPohjaId = null) {
  const koodit = new Set();
  for (const pohja of Array.isArray(pohjat) ? pohjat : []) {
    if (paitsiPohjaId && pohja?.id === paitsiPohjaId) continue;
    for (const piste of pohja?.pisteet || []) {
      if (piste?.viivakoodi) koodit.add(String(piste.viivakoodi));
    }
  }
  return koodit;
}

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
export function tarkistaPisteet(syote, vanhat = [], kaytetytKoodit = new Set()) {
  if (!Array.isArray(syote) || syote.length === 0) {
    return { ok: false, error: 'Kierrospohjassa on oltava vähintään yksi tarkistuspiste.' };
  }
  if (syote.length > RAJAT.pisteita) {
    return { ok: false, error: `Tarkistuspisteitä voi olla enintään ${RAJAT.pisteita}.` };
  }
  const vanhatById = new Map((Array.isArray(vanhat) ? vanhat : []).map((p) => [String(p?.id ?? ''), p]));
  const nahdyt = new Set();
  // Tässä erässä nähdyt viivakoodit. Erillinen joukko kuin kaytetytKoodit, koska sama
  // koodi kahdella pisteellä SAMASSA pohjassa on yhtä rikki kuin kahdessa eri pohjassa.
  const nahdytKoodit = new Set();
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

    // Kumpi tarra pisteelle tulostetaan. Oletus on QR: se on ollut ainoa vaihtoehto
    // tähän asti, eikä oletuksen muuttaminen saa vaihtaa jo seinässä olevien tarrojen
    // lajia vanhoissa pohjissa.
    const koodilaji = p?.koodi === 'code128' ? 'code128' : 'qr';

    // Viivakoodi säilyy vaikka piste vaihdettaisiin takaisin QR:ään. Se on tahallista:
    // seinässä oleva tarra ei katoa siitä että joku vaihtaa asetusta selaimessa, ja
    // kuittauksen on toimittava niin kauan kuin tarra on paikallaan. Koodin voi vaihtaa
    // kirjoittamalla kenttään uuden.
    const annettuKoodi = puhdistaViivakoodi(p?.viivakoodi);
    if (annettuKoodi && !kelpaaViivakoodi(annettuKoodi)) {
      return {
        ok: false,
        error: `Viivakoodi "${annettuKoodi}" sisältää merkkejä joita Code-128 ei koodaa. Käytä kirjaimia, numeroita ja välimerkkejä ilman ääkkösiä.`,
      };
    }
    let viivakoodi = annettuKoodi || String(vanha?.viivakoodi ?? '');
    if (koodilaji === 'code128' && !viivakoodi) {
      viivakoodi = luoViivakoodi(new Set([...kaytetytKoodit, ...nahdytKoodit]));
      if (!viivakoodi) {
        return { ok: false, error: 'Viivakoodia ei saatu muodostettua. Yritä uudelleen.' };
      }
    }
    if (viivakoodi) {
      if (nahdytKoodit.has(viivakoodi) || kaytetytKoodit.has(viivakoodi)) {
        return {
          ok: false,
          error: `Viivakoodi "${viivakoodi}" on jo toisella tarkistuspisteellä. Sama koodi kahdessa paikassa kuittaisi väärän pisteen.`,
        };
      }
      nahdytKoodit.add(viivakoodi);
    }

    pisteet.push({
      id,
      nimi,
      kuvaus: siivoa(p?.kuvaus, RAJAT.kuvaus),
      koodi: koodilaji,
      viivakoodi,
      // Koodipakko: piste kuitataan VAIN lukemalla. Tämä on pohjan laatijan päätös eikä
      // asetus jonka vartija voi ohittaa, ja siksi se tarkistetaan palvelimella
      // (kierros.js: kuittaaPiste) eikä pelkästään piilottamalla painike.
      vaadiKoodi: p?.vaadiKoodi === true,
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

// Onko pohjan sisältö muuttunut niin että versionumeron on kasvettava. POHJAN NIMEN
// muuttaminen ei kasvata versiota: versio kertoo mitä tehtiin, ei miltä otsikko näytti.
//
// Kierrospohjalla pisteen kuvaus on lisätieto ("ovi on jäykkä"), joten se ei kasvata
// versiota. Muilla lajeilla kuvaus ON ohje jota noudatetaan, ja sen muuttuminen tekee
// pohjasta eri pohjan — muuten suorituksen historiasta ei näkisi mitä ohje silloin sanoi.
export function sisaltoMuuttui(vanha, uusi) {
  // Vertailu tehdään sen mukaan mikä sisältökenttä tietueessa on, ei `kind`-kentän
  // mukaan. Jos laji tunnistettaisiin kentästä joka voi puuttua, tunnistamaton pohja
  // vertaisi kahta tyhjää listaa ja version kasvu jäisi HILJAA tekemättä.
  const olennainen = (pohja) => {
    if (Array.isArray(pohja?.pisteet)) {
      return JSON.stringify(pohja.pisteet.map((p) => [p.id, p.nimi, p.jarjestys, p.gps]));
    }
    const kohdat = Array.isArray(pohja?.kohdat) ? pohja.kohdat : [];
    return JSON.stringify(
      kohdat.map((k) => [k.id, k.teksti, k.kuvaus, k.jarjestys, k.aika, k.vastuu, k.kriittinen])
    );
  };
  return olennainen(vanha) !== olennainen(uusi);
}

// Kellonaika run sheetin kohdalle. Hyväksyy sekä 14.00 että 14:00 ja normalisoi pisteeksi;
// tyhjä on sallittu, koska ajolistassa on kohtia joiden aika ei ole vielä tiedossa.
// Aikaa EI muuteta päivämääräksi: run sheet on yhden päivän lista, ja päivä tulee
// suorituksesta eikä pohjasta.
export function tarkistaKellonaika(arvo) {
  const teksti = siivoa(arvo, 5);
  if (teksti === '') return { ok: true, aika: '' };
  const osuma = /^([0-9]{1,2})[.:]([0-9]{2})$/.exec(teksti);
  if (!osuma) return { ok: false, error: `Kellonaika "${teksti}" ei kelpaa. Käytä muotoa 14.00.` };
  const tunnit = Number(osuma[1]);
  const minuutit = Number(osuma[2]);
  if (tunnit > 23 || minuutit > 59) return { ok: false, error: `Kellonaikaa "${teksti}" ei ole olemassa.` };
  return { ok: true, aika: `${String(tunnit).padStart(2, '0')}.${String(minuutit).padStart(2, '0')}` };
}

// Tarkistaa ja normalisoi muiden lajien kuin kierrospohjan kohdat.
//
// Yhteinen funktio eikä lajikohtaista: kohdilla on sama runko (teksti, kuvaus, järjestys)
// ja lajikohtaiset kentät ovat lisiä. Jos jokainen laji tarkistaisi kohtansa itse, sama
// siivous ja samat rajat olisivat kolmessa paikassa ja erkanisivat ensimmäisen korjauksen
// yhteydessä.
export function tarkistaKohdat(syote, kind) {
  const laji = LAJIT[kind];
  if (!laji || laji.sisalto !== 'kohdat') {
    return { ok: false, error: 'Tuntematon pohjalaji.' };
  }
  if (!Array.isArray(syote) || syote.length === 0) {
    return { ok: false, error: `${laji.nimi} tarvitsee vähintään yhden kohdan.` };
  }
  if (syote.length > RAJAT.kohtia) {
    return { ok: false, error: `Kohtia voi olla enintään ${RAJAT.kohtia}.` };
  }

  const nahdyt = new Set();
  const kohdat = [];
  for (const [i, k] of syote.entries()) {
    const teksti = siivoa(k?.teksti, RAJAT.teksti);
    if (teksti.length < 1) return { ok: false, error: `Kohdalta ${i + 1} puuttuu teksti.` };
    const id = String(k?.id ?? '') || crypto.randomUUID();
    if (nahdyt.has(id)) return { ok: false, error: 'Sama kohta esiintyy listassa kahdesti.' };
    nahdyt.add(id);

    const kohta = { id, teksti, kuvaus: siivoa(k?.kuvaus, RAJAT.kuvaus), jarjestys: i };

    if (kind === 'runsheet') {
      const aika = tarkistaKellonaika(k?.aika);
      if (!aika.ok) return { ok: false, error: aika.error };
      kohta.aika = aika.aika;
    }
    if (kind === 'runsheet' || kind === 'play') {
      // Vastuu on vapaata tekstiä eikä viittaus työntekijään: run sheetin rivillä lukee
      // "Turva 1" tai "lavavastaava", eikä se ole sama asia kuin tunnus järjestelmässä.
      kohta.vastuu = siivoa(k?.vastuu, RAJAT.vastuu);
    }
    if (kind === 'play') {
      // Kriittinen kohta estää skenaarion sulkemisen kuittaamattomana. Sama sääntö kuin
      // kierroksella, mutta kohtakohtaisena: skenaariossa on kohtia jotka eivät koske
      // jokaista tilannetta ("jos uhri on tajuton"), ja niiden pakottaminen tekisi
      // sulkemisesta valheellisen.
      kohta.kriittinen = k?.kriittinen === true;
    }
    kohdat.push(kohta);
  }
  return { ok: true, kohdat };
}

// Pohjan julkinen esitys: tarkistuspisteiden tokenit EIVÄT kulje listahaussa. Sama
// periaate kuin jakolinkeillä ja ilmoitusjulisteilla — token haetaan erikseen silloin kun
// käyttäjä tulostaa tarrat.
export function julkinenPohja(pohja) {
  if (!pohja || typeof pohja !== 'object') return pohja;
  return { ...pohja, pisteet: (pohja.pisteet || []).map(({ token: _token, ...rest }) => rest) };
}

// Etsii tarkistuspisteen luetulla koodilla: ensin tokenilla (QR-tarra), sitten
// viivakoodilla. Palauttaa myös kuittaustavan, jotta kierrokselle kirjautuu se mitä
// oikeasti luettiin — "QR" viivakoodista luetusta kuittauksesta olisi väärää historiaa.
//
// Viivakoodi vertaillaan tavallisella yhtäsuuruudella eikä vakioaikaisesti. Se ei ole
// epäjohdonmukaisuus vaan seuraus siitä mitä koodi on: viivakoodi näkyy kierrospohjan
// hallinnassa jokaiselle jolla on lukuoikeus pohjiin, joten sen salaaminen
// vastausajasta olisi teatteria.
export function etsiPisteKoodilla(pohjat, arvo) {
  const tokenilla = etsiPisteTokenilla(pohjat, arvo);
  if (tokenilla) return { ...tokenilla, tapa: 'qr' };
  if (typeof arvo !== 'string' || arvo.length === 0) return null;
  for (const pohja of Array.isArray(pohjat) ? pohjat : []) {
    for (const piste of pohja?.pisteet || []) {
      if (piste?.viivakoodi && String(piste.viivakoodi) === arvo) {
        return { pohja, piste, tapa: 'viivakoodi' };
      }
    }
  }
  return null;
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
