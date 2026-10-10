// Työvuorolistat ja sijoitukset (erä 4, 10.10.2026).
//
// Lista on tallennettu tietue: kenet on sijoitettu mihinkin vuoroon. Vuorot itse eivät ole
// tallennettuja vaan lasketaan kohteiden miehityksestä (tyovuorolista.js:
// suunnitellutVuorot), ja sijoitus viittaa vuoroon sen tunnisteella
// `kohde:vuorotyyppi:päivä:paikka`. Siksi miehityksen muutos ei vaadi listan
// päivittämistä: uudet vuorot ilmestyvät avoimina, ja poistuneisiin viitanneet
// sijoitukset näytetään orpoina kunnes ne poistetaan.
//
// Samaan tapaan kuin muut sääntömoduulit: ei levyä, ei Expressiä.
//
//   { id: alkupäivä, alku, loppu, sijoitukset: [{ vuoroId, username, syy?, sijoitti, sijoitettu }],
//     versio, muokattu, muokkasi }
//
// --- Sijoituksen säännöt ----------------------------------------------------------------
//
// Jokainen sijoitus tarkistetaan henkilön koko vuorojoukkoa vasten
// (tyoaikatarkistus.js) ja vain sen vuoron havainnot ratkaisevat:
//
//   este       sijoitus hylätään
//   poikkeama  sijoitus vaatii syyn; syy tallennetaan sijoitukseen
//   varoitus   sijoitus tehdään, havainto näkyy listalla
//
// Työvoimareserviä (workTimeType 'oncall') ei sijoiteta: käyttäjän päätös 10.10.2026,
// reservi kuittaa tarjotun vuoron itse (erä 5).

import { tarkistaHenkilo } from './tyoaikatarkistus.js';

export const SYYN_MIN = 3;
export const SYYN_MAX = 500;

export function tyhjaLista(lista) {
  return { id: lista.alku, alku: lista.alku, loppu: lista.loppu, sijoitukset: [], versio: 0 };
}

/**
 * Kaikkien tallennettujen listojen sijoitukset yhtenä taulukkona. Lepoajat ja viikkovapaat
 * lasketaan listojen rajan yli, joten yksittäisen listan sijoitukset eivät riitä.
 */
export function kaikkiSijoitukset(tietueet) {
  return (tietueet || []).flatMap((t) => (Array.isArray(t?.sijoitukset) ? t.sijoitukset : []));
}

/**
 * Henkilöiden tarkistukset listalle. `vuorot` on Map vuoroId -> vuoro, ja sen on katettava
 * myös listaa edeltävät viikot, jotta listan alun lepoajat lasketaan oikein.
 */
export function tarkistaLista({
  lista, sijoitukset, vuorot, henkilot, kohteet, asetukset, poissaolot = [], toiveet = [],
}) {
  const perHenkilo = new Map();
  for (const s of sijoitukset) {
    const v = vuorot.get(s.vuoroId);
    if (!v) continue;
    if (!perHenkilo.has(s.username)) perHenkilo.set(s.username, []);
    perHenkilo.get(s.username).push(v);
  }
  const tulokset = {};
  for (const h of henkilot) {
    tulokset[h.username] = tarkistaHenkilo({
      henkilo: h, vuorot: perHenkilo.get(h.username) || [], kohteet, asetukset, lista,
      ...omat(h.username, poissaolot, toiveet),
    });
  }
  return tulokset;
}

const omat = (username, poissaolot, toiveet) => ({
  poissaolot: (poissaolot || []).filter((p) => p.username === username),
  toiveet: (toiveet || []).filter((t) => t.username === username),
});

/**
 * Yhden vuoron sijoitus tai sen poisto (`username` null).
 *
 * Palauttaa { ok: true, tietue, havainnot } tai { ok: false, status, koodi, error, havainnot }.
 * Koodit: 'tuntematon_vuoro', 'tuntematon_henkilo', 'reservi', 'este', 'syy_puuttuu',
 * 'syy_kelvoton', 'varattu', 'alkanut', 'poikkeama'. `havainnot` ovat ne, jotka koskevat
 * juuri tätä vuoroa.
 *
 * `reservinKuittaus` (erä 5): työvoimareservi ottaa avoimen vuoron itse. Silloin vuoron on
 * oltava vapaa ja alkamatta, eikä TES-poikkeamaa voi kuitata syyllä — poikkeamasta sovitaan
 * suunnittelijan kanssa, ei kuittausnapilla.
 */
export function sijoita({
  tietue, lista, vuoroId, username, syy, vuorot, listanVuorot, henkilot, kohteet, asetukset,
  muutSijoitukset, tekija, nyt = new Date(), poissaolot = [], toiveet = [], reservinKuittaus = false,
  nytPaikallinen = null,
}) {
  const nykyiset = Array.isArray(tietue?.sijoitukset) ? tietue.sijoitukset : [];
  const ilman = nykyiset.filter((s) => s.vuoroId !== vuoroId);
  const tallenna = (sijoitukset) => ({
    ...tietue,
    sijoitukset,
    versio: (tietue?.versio || 0) + 1,
    muokattu: nyt.toISOString(),
    muokkasi: tekija,
  });

  // Poisto onnistuu myös orvolle sijoitukselle, jonka vuoroa ei enää ole: juuri sitä
  // varten orvot näytetään, ja niiden siivoaminen ei saa vaatia miehityksen palauttamista.
  if (!username) {
    if (ilman.length === nykyiset.length) return { ok: true, tietue, havainnot: [] };
    return { ok: true, tietue: tallenna(ilman), havainnot: [] };
  }

  if (!listanVuorot.has(vuoroId)) {
    return { ok: false, status: 404, koodi: 'tuntematon_vuoro', error: 'Vuoroa ei ole tällä listalla.', havainnot: [] };
  }
  const henkilo = henkilot.find((h) => h.username === username);
  if (!henkilo) {
    return { ok: false, status: 404, koodi: 'tuntematon_henkilo', error: 'Henkilöä ei voi suunnitella.', havainnot: [] };
  }
  if (reservinKuittaus) {
    if (henkilo.workTimeType !== 'oncall') {
      return { ok: false, status: 403, koodi: 'reservi', error: 'Vain työvoimareservi kuittaa vuoroja itse.', havainnot: [] };
    }
    if (nykyiset.some((s) => s.vuoroId === vuoroId)) {
      return { ok: false, status: 409, koodi: 'varattu', error: 'Vuoro on jo varattu.', havainnot: [] };
    }
    // Paikallinen 'YYYY-MM-DDTHH:MM' samassa muodossa kuin vuoron alku, joten vertailu
    // merkkijonona on oikea.
    if (nytPaikallinen && listanVuorot.get(vuoroId).alkaa <= nytPaikallinen) {
      return { ok: false, status: 409, koodi: 'alkanut', error: 'Vuoro on jo alkanut.', havainnot: [] };
    }
  } else if (henkilo.workTimeType === 'oncall') {
    return {
      ok: false, status: 409, koodi: 'reservi', havainnot: [],
      error: 'Työvoimareservi kuittaa vuoron itse eikä sitä sijoiteta listaan.',
    };
  }

  const uusi = {
    vuoroId, username, sijoitti: tekija, sijoitettu: nyt.toISOString(),
    ...(reservinKuittaus ? { kuittaus: true } : {}),
  };
  const henkilonVuorot = [...muutSijoitukset, ...ilman, uusi]
    .filter((s) => s.username === username)
    .map((s) => vuorot.get(s.vuoroId))
    .filter(Boolean);
  const { havainnot } = tarkistaHenkilo({
    henkilo, vuorot: henkilonVuorot, kohteet, asetukset, lista, ...omat(username, poissaolot, toiveet),
  });
  const koskevat = havainnot.filter((h) => h.vuoroIdt.includes(vuoroId));

  const esteet = koskevat.filter((h) => h.taso === 'este');
  if (esteet.length) {
    return { ok: false, status: 409, koodi: 'este', error: esteet[0].viesti, havainnot: koskevat };
  }
  const poikkeamat = koskevat.filter((h) => h.taso === 'poikkeama');
  if (reservinKuittaus && poikkeamat.length) {
    return {
      ok: false, status: 409, koodi: 'poikkeama', havainnot: koskevat,
      error: 'Vuoro poikkeaisi työaikasäännöistä. Ota yhteys vuorosuunnittelijaan.',
    };
  }
  const siistiSyy = typeof syy === 'string' ? syy.trim() : '';
  if (poikkeamat.length) {
    if (siistiSyy.length < SYYN_MIN) {
      return {
        ok: false, status: 409, koodi: 'syy_puuttuu', havainnot: koskevat,
        error: 'Sijoitus poikkeaa TES:stä. Kirjaa syy (esim. työntekijän kanssa sovittu kertaluonteinen poikkeus).',
      };
    }
    if (siistiSyy.length > SYYN_MAX) {
      return { ok: false, status: 400, koodi: 'syy_kelvoton', error: `Syy on liian pitkä (enintään ${SYYN_MAX} merkkiä).`, havainnot: koskevat };
    }
    uusi.syy = siistiSyy;
    uusi.poikkeamat = poikkeamat.map((h) => h.koodi);
  }
  // Syy ilman poikkeamaa jätetään pois: tallennettu syy väittäisi, että jotain
  // poikettiin, vaikka mitään ei poikettu.

  return { ok: true, tietue: tallenna([...ilman, uusi]), havainnot: koskevat };
}
