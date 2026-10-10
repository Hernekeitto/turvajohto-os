// Työvuorotoiveet ja poissaolot (erä 5, 10.10.2026).
//
// Kaksi eri asiaa, ja ero on se kuka päättää:
//
//   TOIVE     vartijan oma ilmoitus päivälle: toivon vapaata, toivon vuoroa, en pääse.
//             Työnantaja päättää listasta, joten toive EI estä sijoitusta — se näkyy
//             suunnittelijalle varoituksena (tyoaikatarkistus.js).
//   POISSAOLO suunnittelijan kirjaama tosiasia: vuosiloma, vuosivapaa, sairaus. Poissaolon
//             ajalle ei voi sijoittaa (este), ja sen tunnit rinnastetaan työaikaan jakson
//             tunteja laskettaessa (TES 29 § ja 33 §).
//
// Toiveita voi muokata kunnes listan julkaisun määräaika on ohi (käyttäjän päätös
// 10.10.2026: toiveet heti ensimmäisessä versiossa). Sen jälkeen suunnittelija tekee
// listaa, eikä sen alla saa muuttua se mitä hän on jo ottanut huomioon.
//
// Samaan tapaan kuin muut sääntömoduulit: ei levyä, ei Expressiä.

import { listat, lisaaPaivia, paivaksi } from './tyovuorolista.js';

export const TOIVELAJIT = {
  vapaa: 'Toivon vapaata',
  vuoro: 'Toivon vuoroa',
  este: 'En pääse töihin',
};

export const POISSAOLOLAJIT = {
  vuosiloma: 'Vuosiloma',
  vuosivapaa: 'Vuosivapaa',
  sairaus: 'Sairaus',
  muu: 'Muu poissaolo',
};

// TES 33 §: "Vuosilomapäivän pituus on 6,7 tuntia."
export const VUOSILOMAPAIVA_H = 6.7;

const HUOM_MAX = 200;
const TOIVEEN_HORISONTTI_PV = 365;
const POISSAOLON_MAX_PV = 366;
const POISSAOLON_MAX_H = 1000;

/**
 * Onko päivän toive lukittu. Toive kuuluu sille listalle johon päivä osuu, ja lukittuu kun
 * listan julkaisun määräaika on ohi. Ilman jaksojen alkupäivää listoja ei ole, eikä
 * toiveita voi kirjata — muuten niitä ei voisi kohdistaa mihinkään.
 */
export function toiveenLukitus(asetukset, pvm, tanaan) {
  const lista = listat(asetukset, pvm, 1)[0] || null;
  if (!lista) return { lukittu: true, syy: 'Työvuorosuunnittelua ei ole vielä otettu käyttöön.', lista: null };
  if (pvm < tanaan) return { lukittu: true, syy: 'Mennyttä päivää ei voi muuttaa.', lista };
  if (tanaan > lista.julkaistavaViimeistaan) {
    return { lukittu: true, syy: 'Listan laatiminen on jo alkanut. Ota yhteys vuorosuunnittelijaan.', lista };
  }
  return { lukittu: false, syy: null, lista };
}

/**
 * Toiveen asetus tai poisto (`laji` null). Yksi toive per henkilö ja päivä.
 * Palauttaa { ok, toiveet } tai { ok: false, error }.
 */
export function asetaToive(toiveet, { username, pvm, laji, huom }, { asetukset, tanaan, nyt = new Date() }) {
  if (paivaksi(pvm) === null) return { ok: false, error: 'Päivämäärä ei kelpaa.' };
  if (laji !== null && !Object.hasOwn(TOIVELAJIT, laji)) return { ok: false, error: 'Tuntematon toive.' };
  if (pvm > lisaaPaivia(tanaan, TOIVEEN_HORISONTTI_PV)) {
    return { ok: false, error: 'Toiveen voi jättää enintään vuoden päähän.' };
  }
  const teksti = typeof huom === 'string' ? huom.trim() : '';
  if (teksti.length > HUOM_MAX) return { ok: false, error: `Lisätieto on liian pitkä (enintään ${HUOM_MAX} merkkiä).` };
  const lukitus = toiveenLukitus(asetukset, pvm, tanaan);
  if (lukitus.lukittu) return { ok: false, error: lukitus.syy };

  const muut = (toiveet || []).filter((t) => !(t.username === username && t.pvm === pvm));
  if (laji === null) return { ok: true, toiveet: muut };
  return {
    ok: true,
    toiveet: [...muut, { username, pvm, laji, ...(teksti ? { huom: teksti } : {}), kirjattu: nyt.toISOString() }],
  };
}

// Vuosilomapäivät ovat arkipäiviä maanantaista lauantaihin (vuosilomalaki 4 §).
// Arkipyhiä ei vähennetä: sovelluksessa ei ole pyhäpäivälistaa, ja tunnit ovat
// suunnittelijan muokattavissa ehdotuksen jälkeen.
export function vuosilomanTunnit(alku, loppu) {
  let paivia = 0;
  for (let p = alku; p && p <= loppu; p = lisaaPaivia(p, 1)) {
    if (new Date(paivaksi(p)).getUTCDay() !== 0) paivia += 1;
  }
  return Math.round(paivia * VUOSILOMAPAIVA_H * 10) / 10;
}

/**
 * Poissaolon tarkistus. `tunnit` on työaikaan rinnastettava aika koko poissaolon ajalta.
 * Vuosilomalle ehdotetaan 6,7 h jokaiselta lomapäivältä, jos tunteja ei anneta; muille
 * lajeille puuttuva arvo on nolla, koska sairauden tai muun poissaolon tunnit riippuvat
 * siitä mitä vuoroja jäi tekemättä, ja sen tietää suunnittelija.
 */
export function tarkistaPoissaolo(s) {
  const virheet = [];
  if (!Object.hasOwn(POISSAOLOLAJIT, s?.laji)) virheet.push('Valitse poissaolon laji.');
  if (paivaksi(s?.alku) === null || paivaksi(s?.loppu) === null) virheet.push('Anna alku- ja loppupäivä.');
  else if (s.loppu < s.alku) virheet.push('Loppupäivä on ennen alkupäivää.');
  else if ((paivaksi(s.loppu) - paivaksi(s.alku)) / 86400000 >= POISSAOLON_MAX_PV) virheet.push('Poissaolo voi olla enintään vuoden mittainen.');
  const huom = typeof s?.huom === 'string' ? s.huom.trim() : '';
  if (huom.length > HUOM_MAX) virheet.push(`Lisätieto on liian pitkä (enintään ${HUOM_MAX} merkkiä).`);
  let tunnit = s?.tunnit;
  if (tunnit === undefined || tunnit === null || tunnit === '') {
    tunnit = virheet.length === 0 && s.laji === 'vuosiloma' ? vuosilomanTunnit(s.alku, s.loppu) : 0;
  }
  tunnit = Number(tunnit);
  if (!Number.isFinite(tunnit) || tunnit < 0 || tunnit > POISSAOLON_MAX_H) virheet.push('Tunnit eivät kelpaa.');
  if (virheet.length) return { ok: false, virheet };
  return {
    ok: true,
    poissaolo: { laji: s.laji, alku: s.alku, loppu: s.loppu, tunnit: Math.round(tunnit * 10) / 10, ...(huom ? { huom } : {}) },
  };
}

/**
 * Poissaolon tunnit jaksolle [alku, loppu). Jaetaan päivien suhteessa: kahden jakson yli
 * menevä loma jakautuu kumpaankin sen mukaan montako päivää siitä osuu kumpaankin.
 */
export function poissaolotunnitJaksolle(poissaolot, alku, loppu) {
  let summa = 0;
  for (const p of poissaolot || []) {
    const kaikki = (paivaksi(p.loppu) - paivaksi(p.alku)) / 86400000 + 1;
    const a = p.alku > alku ? p.alku : alku;
    const viimeinen = lisaaPaivia(loppu, -1);
    const l = p.loppu < viimeinen ? p.loppu : viimeinen;
    if (l < a) continue;
    const osuus = (paivaksi(l) - paivaksi(a)) / 86400000 + 1;
    summa += (Number(p.tunnit) || 0) * (osuus / kaikki);
  }
  return Math.round(summa * 10) / 10;
}
