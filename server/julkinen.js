// Julkinen yleisöilmoitus (QR-koodi aidassa → lomake → moderointijono).
//
// TÄMÄ ON AINOA KOHTA JOSSA TUNTEMATON SAA KIRJOITTAA JÄRJESTELMÄÄN. Jakolinkeissä
// (shares.js) tuntematon saa lukea; tässä hän saa kirjoittaa, ja uhka on toinen:
// vuotamisen sijaan väärinkäyttö, roskaposti ja se että perätön ilmoitus päätyy
// lakisääteiseen kirjausaineistoon.
//
// Neljä suunnitteluperiaatetta:
//
//  1. ILMOITUS EI MENE reports-KOKOELMAAN. Se menee omaan jonoonsa, ja TIKE luo siitä
//     oikean kirjauksen vasta hyväksyessään. reports-kokoelmalla on lakisääteinen
//     säilytysaika, kenttäsalaus ja muuttumattomuuslukitus — moderoimaton yleisön
//     väite ei kuulu sinne ennen kuin ihminen on sen hyväksynyt.
//
//  2. TOKEN EI OLE SALAISUUS. Se on julisteessa aidassa: jokainen ohikulkija näkee sen.
//     Tokenin tehtävä on sitoa ilmoitus tapahtumaan ja tehdä väärinkäytetystä
//     julisteesta peruutettava — ei estää pääsyä. Suoja on määrä­rajoissa, moderoinnissa
//     ja vanhentumisessa.
//
//  3. EI LIITTEITÄ. Tuntemattoman lähettämän tiedoston moderointi on oma ongelmansa
//     (haittaohjelmat, laiton aineisto, tallennustila). Ensimmäinen versio ottaa vastaan
//     vain tekstiä.
//
//  4. EI IP-OSOITTEEN TALLENNUSTA. Määrärajoitus toimii muistissa ilman että
//     ohikulkijasta jää tietuetta levylle. Ilmoittaja on tuntematon yksityishenkilö,
//     eikä hänestä pidä kerätä enempää kuin se mitä hän itse kirjoittaa.

import { luoToken, tokenTasmaa } from './shares.js';

export { luoToken as luoIlmoitusToken, tokenTasmaa };

const VRK_MS = 24 * 60 * 60 * 1000;

// Julisteen elinkaari: tapahtuma loppuu, juliste jää aidan pätkään. Vanhentuminen estää
// sen että vuoden takaisesta julisteesta tulee ilmoituksia tapahtumaan jota ei ole.
export const OLETUS_VOIMASSAOLO_VRK = 30;
export const MAX_VOIMASSAOLO_VRK = 180;

// Kenttien pituusrajat. Nämä eivät ole kauneusasia vaan suoja: ilman rajaa yksi pyyntö
// voi kirjoittaa megatavuja levylle, ja kokoelma kirjoitetaan kokonaan joka kerta.
export const RAJAT = { kuvaus: 2000, paikka: 200, yhteystieto: 200 };

// Yhdestä julisteesta tulevien ilmoitusten enimmäismäärä tunnissa. Erillinen
// IP-kohtaisesta rajasta: sama juliste voi kerätä ilmoituksia monelta ihmiseltä, mutta
// sadan ilmoituksen tunti samasta julisteesta on väärinkäyttöä eikä yleisöhavaintoja.
export const LOMAKKEEN_RAJA_TUNNISSA = 30;

// Ohjausmerkit pois, mutta rivinvaihto ja sarkain säilyvät: ilmoitus on vapaata tekstiä
// ja kappalejako on osa sitä. Muut ohjausmerkit eivät voi olla mitään muuta kuin yritys
// sotkea näyttöä, lokia tai tulostetta.
//
// Suodatus tehdään merkkikoodeilla eikä säännöllisellä lausekkeella: ohjausmerkkien
// merkkiluokka vaatisi escape-jonoja, ja raakana kirjoitettuna ne tekisivät
// lähdetiedostosta binaarin jota ei voi lukea eikä turvallisesti muokata.
const siivoa = (arvo, maxPituus) => {
  let tulos = '';
  for (const merkki of String(arvo ?? '')) {
    const koodi = merkki.codePointAt(0);
    // 9 = sarkain, 10 = rivinvaihto. Nämä säilytetään.
    if (koodi === 9 || koodi === 10) { tulos += merkki; continue; }
    // 0-31 = ohjausmerkit, 127 = DEL.
    if (koodi < 32 || koodi === 127) continue;
    tulos += merkki;
  }
  return tulos.trim().slice(0, maxPituus);
};

// Tarkistaa ja normalisoi yleisön lähettämän ilmoituksen.
// Palauttaa { ok: true, ilmoitus } tai { ok: false, error }.
export function tarkistaIlmoitus(syote) {
  if (!syote || typeof syote !== 'object' || Array.isArray(syote)) {
    return { ok: false, error: 'Ilmoitus puuttuu.' };
  }
  const kuvaus = siivoa(syote.kuvaus, RAJAT.kuvaus);
  if (kuvaus.length < 3) {
    return { ok: false, error: 'Kirjoita lyhyt kuvaus havainnosta.' };
  }
  return {
    ok: true,
    ilmoitus: {
      kuvaus,
      paikka: siivoa(syote.paikka, RAJAT.paikka),
      yhteystieto: siivoa(syote.yhteystieto, RAJAT.yhteystieto),
    },
  };
}

// Onko juliste juuri nyt käytettävissä. Yksi funktio, jotta lähetysreitti ja
// käyttöliittymän tilanäyttö eivät voi olla eri mieltä (sama periaate kuin
// shares.js:n jaonTila).
export function lomakkeenTila(lomake, nyt = new Date()) {
  if (!lomake) return { ok: false, syy: 'not_found' };
  if (lomake.revokedAt) return { ok: false, syy: 'revoked' };
  if (lomake.expiresAt && new Date(lomake.expiresAt) <= nyt) return { ok: false, syy: 'expired' };
  return { ok: true };
}

export const TILAN_SELITE = {
  not_found: 'Ilmoituslomaketta ei löytynyt.',
  revoked: 'Tämä ilmoituslinkki on poistettu käytöstä.',
  expired: 'Tämä ilmoituslinkki on vanhentunut.',
  rate_limited: 'Ilmoituksia on lähetetty liikaa lyhyessä ajassa. Yritä hetken kuluttua uudelleen.',
};

// Lomakekohtainen määrärajoitus. Laskuri on muistissa eikä levyllä: se on
// väärinkäytön hidaste, ei kirjanpitoa, ja palvelimen uudelleenkäynnistys saa nollata sen.
const laskurit = new Map();

export function saaLahettaa(formId, nyt = Date.now(), raja = LOMAKKEEN_RAJA_TUNNISSA) {
  const tunti = 60 * 60 * 1000;
  const aiemmat = (laskurit.get(formId) || []).filter((t) => nyt - t < tunti);
  if (aiemmat.length >= raja) {
    laskurit.set(formId, aiemmat);
    return false;
  }
  aiemmat.push(nyt);
  laskurit.set(formId, aiemmat);
  return true;
}

export function nollaaLaskurit() {
  laskurit.clear();
}

// Voimassaolon ratkaisu. Oletus on lyhyt ja yläraja kova: juliste on fyysinen esine joka
// jää maailmaan, eikä sen pidä toimia loputtomiin.
export function ratkaiseVoimassaolo({ vrk } = {}, nyt = new Date()) {
  const pyydetty = Number.isFinite(Number(vrk)) ? Number(vrk) : OLETUS_VOIMASSAOLO_VRK;
  if (pyydetty <= 0) return { error: 'Voimassaoloajan on oltava vähintään yksi vuorokausi.' };
  if (pyydetty > MAX_VOIMASSAOLO_VRK) {
    return { error: `Voimassaoloaika voi olla enintään ${MAX_VOIMASSAOLO_VRK} vrk.` };
  }
  return { expiresAt: new Date(nyt.getTime() + pyydetty * VRK_MS).toISOString() };
}

// Julkinen esitys: token EI kulje käyttöliittymälle listauksessa. Se haetaan erikseen
// kun käyttäjä pyytää QR-koodin nähtäväkseen — sama periaate kuin jakolinkeillä.
export function julkinenLomake(lomake) {
  const { token: _token, ...rest } = lomake || {};
  return rest;
}
