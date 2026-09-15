// Yksikön tila kartalla ja listassa: vapaa, matkalla, tehtävällä, kierroksella.
//
// EI OMAA KENTTÄÄ MISSÄÄN KOKOELMASSA. Tila lasketaan lukuhetkellä samasta syystä kuin
// hälytystehtävien kohdennus (server/halytystehtava.js): vuorot alkavat ja loppuvat,
// tehtävät suljetaan ja kierrokset päättyvät. Tallennettu tila vanhenisi hiljaa, ja
// valvomon ruudulla se näyttäisi tuoreelta — punainen merkki tehtävästä joka päättyi
// tunti sitten on pahempi kuin ei merkkiä lainkaan.
//
// Tämä moduuli EI hae mitään eikä päätä mistään, kuten tilannekuva.ts. Se saa jo haetut
// kokoelmat ja kokoaa niistä yhden vastauksen kysymykseen "mitä tämä yksikkö tekee nyt".
// Sama rajaus kuin siellä: funktio näkee vain sen datan jonka palvelin on antanut
// käyttäjälle, ja jos päivystäjällä ei ole oikeutta kierroksiin, kierroksella oleva
// vartija näyttää vapaalta. Siksi `ei_tietoa` on oma tilansa eikä `vapaa`.

import type { Halytystehtava } from './halytystehtavat';
import type { Kierros } from './tyypit';

export type Tila = 'vapaa' | 'matkalla' | 'tehtavalla' | 'kierroksella' | 'ei_tietoa';

export type Lahteet = {
  tehtavat: Halytystehtava[];
  kierrokset: Kierros[];
};

export type Tulos = {
  tila: Tila;
  // Mihin tila perustuu. Näytetään käyttöliittymässä: päivystäjän on voitava klikata
  // punaista merkkiä ja päätyä siihen tehtävään joka sen punaiseksi teki.
  tehtavaId: string | null;
  kierrosId: string | null;
};

// Ne tehtävän tilat joissa yksikkö on yhä kiinni työssä. Sama joukko kuin palvelimen
// AVOIMET_TILAT (server/halytystehtava.js) — jos ne erkanevat, kartta näyttää yksikön
// vapaana samalla kun sen kellolistassa on avoin tehtävä.
const AVOIMET = new Set(['avoin', 'kaynnissa', 'odottaa']);

// Yksikön rivi tehtävällä: onko hän yhä sillä.
//
// `kieltaytyi` ja `poistui` päättävät osallistumisen, ja ne on tarkistettava ENNEN
// vaiheita: poistunut yksikkö säilyttää `paikalla`-aikaleimansa tietueessa, koska se on
// historiaa eikä tilaa. Ilman tätä järjestystä poistunut vartija jäisi kartalle
// punaiseksi tehtävän loppuun asti.
const yhaMukana = (y: { kieltaytyi: string | null; poistui?: string | null; vastaanotti: string | null }) =>
  !y.kieltaytyi && !y.poistui && !!y.vastaanotti;

export const TILAN_NIMI: Record<Tila, string> = {
  vapaa: 'Vapaa',
  matkalla: 'Matkalla tehtävälle',
  tehtavalla: 'Tehtävällä',
  kierroksella: 'Kierroksella',
  ei_tietoa: 'Ei tietoa',
};

// Väritokenit. Arvot ovat index.css:ssä, eivät täällä — sama sopimus kuin muualla
// teemakerroksessa (src/TEEMA.md).
export const TILAN_VARI: Record<Tila, string> = {
  vapaa: 'var(--yksikko-vapaa)',
  matkalla: 'var(--yksikko-matkalla)',
  tehtavalla: 'var(--yksikko-tehtavalla)',
  kierroksella: 'var(--yksikko-kierroksella)',
  ei_tietoa: 'var(--yksikko-ei-tietoa)',
};

// VÄRI EI SAA OLLA AINOA ERO. Vihreä, oranssi ja punainen ovat täsmälleen se yhdistelmä
// jonka yleisin värinäön poikkeama sekoittaa, ja valvomossa virhettä ei huomaa kukaan
// ennen kuin väärä yksikkö on lähetetty väärään paikkaan. Kirjain piirretään merkin
// sisään ja se toistuu listassa.
export const TILAN_KIRJAIN: Record<Tila, string> = {
  vapaa: 'V',
  matkalla: 'M',
  tehtavalla: 'T',
  kierroksella: 'K',
  ei_tietoa: '?',
};

// Suodattimien järjestys käyttöliittymässä. Kiireellisin ensin, koska päivystäjä lukee
// listaa ylhäältä alas.
export const TILAT: Tila[] = ['tehtavalla', 'matkalla', 'kierroksella', 'vapaa', 'ei_tietoa'];

/**
 * Yhden yksikön tila.
 *
 * Tärkeysjärjestys on tehtävä > kierros > vapaa, eikä se ole makuasia: kierroksella oleva
 * vartija joka irrotetaan hälytystehtävälle on kartalla tehtävällä, ei kierroksella.
 * Kierros jää kesken ja jatkuu myöhemmin, mutta se ei ole se mitä hän tekee juuri nyt.
 *
 * @param username Vartijan käyttäjätunnus. Yksikön NÄYTTÖNIMI tulee vuorosta
 *   (Yksikko.nimi, "Piiri 301") eikä tästä — ks. halytystehtavat.ts.
 */
export function yksikonTila(username: string, lahteet: Lahteet): Tulos {
  if (!username) return { tila: 'ei_tietoa', tehtavaId: null, kierrosId: null };

  let matkalla: string | null = null;

  for (const tehtava of lahteet.tehtavat) {
    if (!AVOIMET.has(tehtava.tila)) continue;
    const yksikko = tehtava.yksikot.find((y) => y.vartija === username);
    if (!yksikko || !yhaMukana(yksikko)) continue;

    // Paikalla voittaa heti eikä vasta silmukan lopussa: yksikkö voi olla vastaanottanut
    // kaksi tehtävää, ja se jolla hän seisoo on se joka ratkaisee onko hän irrotettavissa.
    if (yksikko.paikalla) {
      return { tila: 'tehtavalla', tehtavaId: tehtava.id, kierrosId: null };
    }
    // `ajoon` JA pelkkä vastaanotto ovat sama väri. Palvelimen oma kommentti sanoo
    // vaiheiden olevan ohjeellisia eikä pakollisia ("ajoon lähtemättä paikalla oleva
    // kohdevartija on tavallisin tapaus"), joten vastaanottanut yksikkö joka ei ole
    // painanut mitään on varattu — ei vapaa. Vapaaksi merkitseminen johtaisi siihen että
    // hänelle lähetetään toinen tehtävä.
    if (!matkalla) matkalla = tehtava.id;
  }

  if (matkalla) return { tila: 'matkalla', tehtavaId: matkalla, kierrosId: null };

  const kierros = lahteet.kierrokset.find((k) => k.vartija === username && k.tila === 'kesken');
  if (kierros) return { tila: 'kierroksella', tehtavaId: null, kierrosId: kierros.id };

  return { tila: 'vapaa', tehtavaId: null, kierrosId: null };
}

/**
 * Onko yksikkö irrotettavissa hälytystehtävälle.
 *
 * Käyttäjän päätös 15.9.2026: kierroksella oleva vartija VOIDAAN irrottaa jos muita ei
 * ole saatavilla. Tämä on siis eri kysymys kuin "onko vapaa" — ja se on oma funktionsa
 * juuri siksi, ettei kutsupaikka päädy vertailemaan tilaa merkkijonona ja unohda
 * kierrosta.
 *
 * Tehtävällä tai matkalla oleva EI ole irrotettavissa: hänen irrottamisensa on
 * päivystäjän päätös tehtävän sulkemisesta, ei kohdennusvalinta.
 */
export const onIrrotettavissa = (tila: Tila) => tila === 'vapaa' || tila === 'kierroksella';
