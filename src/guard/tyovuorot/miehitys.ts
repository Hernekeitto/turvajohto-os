// Kohteen miehitys selaimessa (erä 2): kesto, TES-poikkeamat ja tiivistelmä.
//
// PIDETTÄVÄ SYNKASSA server/tyovuorolista.js:n kanssa (vuoronKestoMin,
// vuoronTesPoikkeamat). Palvelin ratkaisee: se hylkää tallennuksen jos perustelu puuttuu.
// Tämä vain kertoo sen lomakkeella etukäteen. Jos säännöt erkanevat, pahin seuraus on
// tallennuksessa näkyvä virhe, ei väärä tieto levyllä.

import type { Miehitys } from '../tyypit';

export const VIIKONPAIVAT = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'];

export type Poikkeama = 'lyhyt' | 'pitka' | 'yo';

export const POIKKEAMAN_TEKSTI: Record<Poikkeama, string> = {
  lyhyt: 'on lyhyempi kuin TES:n vähimmäispituus',
  pitka: 'on pidempi kuin TES:n tavallinen enimmäispituus (poikkeava työvuoro)',
  yo: 'alkaa tai päättyy klo 00–06',
};

export type Rajat = { vuoronMinH: number; vuoronMaxH: number; poikkeavanMaxH: number; yorajoitus: boolean };

function kellonaika(hhmm: string | undefined): number | null {
  const osuma = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!osuma) return null;
  const t = Number(osuma[1]);
  const m = Number(osuma[2]);
  return t > 23 || m > 59 ? null : t * 60 + m;
}

export function vuoronKestoMin(alkaa?: string, paattyy?: string): number | null {
  const a = kellonaika(alkaa);
  const p = kellonaika(paattyy);
  if (a === null || p === null) return null;
  return p > a ? p - a : p + 24 * 60 - a;
}

// Rajat itse sallittuja: 16–24 ja 06–14 eivät ole poikkeamia (ks. palvelimen tulkinta).
const yoaikana = (min: number | null) => min !== null && min > 0 && min < 6 * 60;

export function vuoronTesPoikkeamat(alkaa: string | undefined, paattyy: string | undefined, rajat: Rajat): Poikkeama[] {
  const kesto = vuoronKestoMin(alkaa, paattyy);
  if (kesto === null) return [];
  const tulos: Poikkeama[] = [];
  if (kesto < rajat.vuoronMinH * 60) tulos.push('lyhyt');
  if (kesto > rajat.vuoronMaxH * 60 && kesto <= rajat.poikkeavanMaxH * 60) tulos.push('pitka');
  if (rajat.yorajoitus && (yoaikana(kellonaika(alkaa)) || yoaikana(kellonaika(paattyy)))) tulos.push('yo');
  return tulos;
}

export const onMiehitys = (m: Miehitys | undefined) => !!m && m.maarat.some((n) => n > 0);

/**
 * Este vuorolomakkeen sulkemiselle, tai null. Sama ehto kuin palvelimen tarkistaMiehitys,
 * jotta virhe näkyy vuoron kohdalla eikä vasta koko kohteen tallennuksessa.
 * `rajat` puuttuu kun säännöt eivät latautuneet; silloin tarkistetaan vain se mikä ei
 * riipu niistä, ja palvelin tarkistaa loput.
 */
export function miehityksenEste(
  alkaa: string | undefined, paattyy: string | undefined, m: Miehitys | undefined, rajat: Rajat | null,
): string | null {
  if (!m) return null;
  if (!m.maarat.every((n) => Number.isInteger(n) && n >= 0 && n <= 20)) {
    return 'Vartijamäärän on oltava kokonaisluku 0–20.';
  }
  if (m.alkaen && m.asti && m.asti < m.alkaen) return 'Loppupäivä on ennen alkupäivää.';
  if (!onMiehitys(m)) return null;
  const kesto = vuoronKestoMin(alkaa, paattyy);
  if (kesto === null) return 'Suunniteltavalla vuorolla on oltava alkamis- ja päättymisaika.';
  if (!rajat) return null;
  if (kesto > rajat.poikkeavanMaxH * 60) {
    return `Vuoro on pidempi kuin poikkeavan työvuoron enimmäispituus ${rajat.poikkeavanMaxH} h (TES 10 §).`;
  }
  if (vuoronTesPoikkeamat(alkaa, paattyy, rajat).length && (m.tesPerustelu || '').trim().length < 3) {
    return 'Vuoro poikkeaa TES:stä. Kirjaa perustelu (TES 10 § ja 51 §).';
  }
  return null;
}

// '7 h 30 min' / '8 h'
export function kestoTekstina(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Miehitys yhdellä rivillä: "ma–pe 1, la–su 2". Peräkkäiset päivät joilla on sama määrä
 * yhdistetään, ja päivät joilla ei ole vuoroa jätetään pois.
 */
export function miehitysTekstina(m: Miehitys | undefined): string {
  if (!m || !onMiehitys(m)) return '';
  const osat: string[] = [];
  let i = 0;
  while (i < 7) {
    const maara = m.maarat[i];
    let j = i;
    while (j + 1 < 7 && m.maarat[j + 1] === maara) j += 1;
    if (maara > 0) {
      const paivat = i === j ? VIIKONPAIVAT[i] : `${VIIKONPAIVAT[i]}–${VIIKONPAIVAT[j]}`;
      osat.push(`${paivat} ${maara}`);
    }
    i = j + 1;
  }
  return osat.join(', ');
}
