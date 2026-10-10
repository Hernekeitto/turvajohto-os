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

// --- Julkaisu ja muutokset (erä 6) -----------------------------------------------------
//
// TES 10 §: lista annetaan tiedoksi viimeistään kaksi viikkoa ennen jakson alkua.
// Julkaisu on se hetki. Sen jälkeen lista on vartijoiden tiedossa, joten jokainen muutos
// vaatii syyn, kirjataan muutoslokiin ja näkyy muutoksen kohteille kuitattavana.
//
// TES 31 § 3: hälytystyöstä maksetaan, kun vapaa-ajalle sovitusta ylimääräisestä vuorosta
// on ilmoitettu alle 72 tuntia ennen sen alkua. Järjestelmä ei tiedä onko vuoro
// "ylimääräinen" palkkalaskennan mielessä, joten se merkitsee jokaisen julkaisun jälkeen
// alle 72 tunnin varoitusajalla tehdyn uuden sijoituksen — ja palkanlaskija ratkaisee.

export const HALYTYSTYO_H = 72;

const minuutit = (ts) => {
  const o = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(ts || ''));
  return o ? Date.UTC(+o[1], +o[2] - 1, +o[3], +o[4], +o[5]) / 60000 : null;
};

/** Onko uudesta sijoituksesta ilmoitettu alle 72 h ennen vuoron alkua. */
export function onHalytystyo(vuoronAlku, nytPaikallinen) {
  const a = minuutit(vuoronAlku);
  const n = minuutit(nytPaikallinen);
  return a !== null && n !== null && a - n < HALYTYSTYO_H * 60;
}

/**
 * Listan julkaisu. Estää jos jollakulla on este (esim. loma kirjattiin sijoituksen jälkeen,
 * tai kortti vanheni): julkaistu lista ei saa luvata vuoroa jota ei voi tehdä.
 * Avoimet vuorot eivät estä — ne jäävät reserville ja myöhemmille sijoituksille.
 */
export function julkaise({ tietue, lista, tulokset, listanVuorot, tekija, tanaan, nyt = new Date() }) {
  if (tietue?.julkaistu) return { ok: false, status: 409, koodi: 'julkaistu', error: 'Lista on jo julkaistu.' };
  const esteet = Object.entries(tulokset || {}).flatMap(([username, t]) => (t.havainnot || [])
    .filter((h) => h.taso === 'este' && h.vuoroIdt.some((id) => listanVuorot.has(id)))
    .map((h) => ({ username, ...h })));
  if (esteet.length) {
    return { ok: false, status: 409, koodi: 'esteita', error: 'Listalla on esteitä. Korjaa ne ennen julkaisua.', esteet };
  }
  const sijoitetut = new Set((tietue?.sijoitukset || []).map((s) => s.vuoroId));
  const avoimia = [...listanVuorot.keys()].filter((id) => !sijoitetut.has(id)).length;
  return {
    ok: true,
    tietue: {
      ...tietue,
      julkaistu: {
        aika: nyt.toISOString(),
        julkaisija: tekija,
        myohassa: tanaan > lista.julkaistavaViimeistaan,
        avoimia,
      },
      muutokset: [],
      versio: (tietue?.versio || 0) + 1,
      muokattu: nyt.toISOString(),
      muokkasi: tekija,
    },
  };
}

/** Henkilön kuittaamattomat muutokset tällä listalla. */
export function kuittaamattomat(tietue, username) {
  const raja = tietue?.kuittaukset?.[username] || '';
  return (tietue?.muutokset || []).filter((m) => (m.oli === username || m.nyt === username) && m.aika > raja);
}

export function kuittaaMuutokset(tietue, username, nyt = new Date()) {
  return { ...tietue, kuittaukset: { ...(tietue?.kuittaukset || {}), [username]: nyt.toISOString() } };
}

// --- Sijoitus -----------------------------------------------------------------------------

/**
 * Yhden vuoron sijoitus tai sen poisto (`username` null).
 *
 * Palauttaa { ok: true, tietue, havainnot } tai { ok: false, status, koodi, error, havainnot }.
 * Koodit: 'tuntematon_vuoro', 'tuntematon_henkilo', 'reservi', 'este', 'syy_puuttuu',
 * 'syy_kelvoton', 'varattu', 'alkanut', 'poikkeama', 'muutossyy_puuttuu'. `havainnot`
 * ovat ne, jotka koskevat juuri tätä vuoroa.
 *
 * `reservinKuittaus` (erä 5): työvoimareservi ottaa avoimen vuoron itse. Silloin vuoron on
 * oltava vapaa ja alkamatta, eikä TES-poikkeamaa voi kuitata syyllä — poikkeamasta sovitaan
 * suunnittelijan kanssa, ei kuittausnapilla.
 *
 * `muutossyy` (erä 6): julkaistun listan muutos vaatii syyn. Reservin kuittauksella ja
 * hyväksytyllä vuoronvaihdolla syy on toiminto itse, ja kutsuja antaa sen.
 */
export function sijoita({
  tietue, lista, vuoroId, username, syy, vuorot, listanVuorot, henkilot, kohteet, asetukset,
  muutSijoitukset, tekija, nyt = new Date(), poissaolot = [], toiveet = [], reservinKuittaus = false,
  nytPaikallinen = null, muutossyy = '',
}) {
  const nykyiset = Array.isArray(tietue?.sijoitukset) ? tietue.sijoitukset : [];
  const edellinen = nykyiset.find((s) => s.vuoroId === vuoroId) || null;
  const ilman = nykyiset.filter((s) => s.vuoroId !== vuoroId);
  const julkaistu = !!tietue?.julkaistu;
  const ctx = { vuorot, henkilot, kohteet, asetukset, lista, muutSijoitukset, poissaolot, toiveet };

  // Sama henkilö samaan vuoroon: ei muutosta, ei lokimerkintää.
  if (username && edellinen?.username === username) return { ok: true, tietue, havainnot: [] };
  if (!username && !edellinen) return { ok: true, tietue, havainnot: [] };

  const siistiMuutossyy = typeof muutossyy === 'string' ? muutossyy.trim() : '';
  if (julkaistu && siistiMuutossyy.length < SYYN_MIN) {
    return {
      ok: false, status: 409, koodi: 'muutossyy_puuttuu', havainnot: [],
      error: 'Lista on julkaistu. Kirjaa muutoksen syy — se näkyy muutoksen kohteille.',
    };
  }
  if (siistiMuutossyy.length > SYYN_MAX) {
    return { ok: false, status: 400, koodi: 'syy_kelvoton', error: `Syy on liian pitkä (enintään ${SYYN_MAX} merkkiä).`, havainnot: [] };
  }

  const valmis = (sijoitukset, havainnot) => {
    const muutettavat = [edellinen?.username, username].filter(Boolean);
    const siivottu = siivoaSyyt(sijoitukset, muutettavat, ctx);
    const uusiTietue = {
      ...tietue,
      sijoitukset: siivottu,
      versio: (tietue?.versio || 0) + 1,
      muokattu: nyt.toISOString(),
      muokkasi: tekija,
    };
    if (julkaistu) {
      const vuoro = listanVuorot.get(vuoroId);
      uusiTietue.muutokset = [...(tietue.muutokset || []), {
        aika: nyt.toISOString(),
        tekija,
        vuoroId,
        oli: edellinen?.username || null,
        nyt: username || null,
        syy: siistiMuutossyy,
        // Uusi henkilö alle 72 h ennen vuoroa = mahdollinen hälytystyö (TES 31 §).
        ...(username && vuoro && nytPaikallinen && onHalytystyo(vuoro.alkaa, nytPaikallinen) ? { halytystyo: true } : {}),
      }];
    }
    return { ok: true, tietue: uusiTietue, havainnot };
  };

  // Poisto onnistuu myös orvolle sijoitukselle, jonka vuoroa ei enää ole: juuri sitä
  // varten orvot näytetään, ja niiden siivoaminen ei saa vaatia miehityksen palauttamista.
  if (!username) return valmis(ilman, []);

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
    if (edellinen) {
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
  const koskevat = havainnotVuorolle(username, [...ilman, uusi], vuoroId, ctx);

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

  return valmis([...ilman, uusi], koskevat);
}

function havainnotVuorolle(username, listanSijoitukset, vuoroId, ctx) {
  const henkilo = ctx.henkilot.find((h) => h.username === username);
  if (!henkilo) return [];
  const henkilonVuorot = [...ctx.muutSijoitukset, ...listanSijoitukset]
    .filter((s) => s.username === username)
    .map((s) => ctx.vuorot.get(s.vuoroId))
    .filter(Boolean);
  const { havainnot } = tarkistaHenkilo({
    henkilo, vuorot: henkilonVuorot, kohteet: ctx.kohteet, asetukset: ctx.asetukset, lista: ctx.lista,
    ...omat(username, ctx.poissaolot, ctx.toiveet),
  });
  return vuoroId ? havainnot.filter((h) => h.vuoroIdt.includes(vuoroId)) : havainnot;
}

/**
 * Vanhentuneiden poikkeamasyiden siivous (erä 6). Kun vuoro poistetaan tai siirretään,
 * jäljelle jääneen vuoron syy voi koskea poikkeamaa jota ei enää ole — esimerkiksi lepo
 * edelliseen vuoroon, joka poistettiin. Silloin syy ja poikkeamakoodit poistetaan, ja
 * jäljelle jäävien poikkeamien koodit päivitetään. Syy säilyy niin kauan kuin yksikin
 * poikkeama on voimassa: sama sopimus kattaa sen yhä.
 */
function siivoaSyyt(sijoitukset, usernames, ctx) {
  let tulos = sijoitukset;
  for (const u of new Set(usernames)) {
    if (!tulos.some((s) => s.username === u && s.syy)) continue;
    const havainnot = havainnotVuorolle(u, tulos, null, ctx);
    tulos = tulos.map((s) => {
      if (s.username !== u || !s.syy) return s;
      const koodit = havainnot
        .filter((h) => h.taso === 'poikkeama' && h.vuoroIdt.includes(s.vuoroId))
        .map((h) => h.koodi);
      if (koodit.length) return { ...s, poikkeamat: koodit };
      const { syy: _syy, poikkeamat: _p, ...ilmanSyyta } = s;
      return ilmanSyyta;
    });
  }
  return tulos;
}
