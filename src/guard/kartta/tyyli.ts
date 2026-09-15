// Karttapohjan tyyli: Panssari-sävyinen tummataustainen peruskartta.
//
// TUMMA EIKÄ VAALEA, ja se on toimintapäätös eikä makuasia. Kartta on tausta jonka
// päällä luetaan yksiköiden tilavärit (vihreä, oranssi, punainen, magenta). Vaalealla
// pohjalla ne kilpailevat katujen ja rakennusten kanssa; tummalla ne ovat ainoat
// kirkkaat asiat ruudulla. Sama syy kuin siihen miksi valvomon muutkin näytöt ovat
// tummia.
//
// TASONIMET ON LUETTU TIILIPAKETIN METADATASTA, ei arvattu dokumentaatiosta:
// boundaries, buildings, earth, landcover, landuse, places, pois, roads, water.
// (Luettu 15.9.2026 paketista suomi-20260914.pmtiles.)
//
// --- EI TEKSTIÄ, JA SE ON TIEDOSSA OLEVA PUUTE --------------------------------------
//
// Kartassa ei ole katujen eikä paikkojen nimiä. Syy on tekninen: tekstin piirtäminen
// vaatii kirjasinatlaksen (glyphs, PBF-tiedostoja), eikä sellaista ole isännöitynä —
// ja CSP kieltää ulkoiset lähteet, joten sitä ei voi hakea muualtakaan.
//
// Tämä on OLENNAINEN puute päivystäjälle: "lähetä yksikkö Mannerheimintielle" ei
// onnistu kartalta jossa ei lue Mannerheimintie. Muodot riittävät siihen että näkee
// missä päin kaupunkia yksikkö on ja mihin suuntaan se liikkuu, mutta osoitteen
// tunnistaminen vaatii nimet. Glyphien isännöinti on oma askeleensa (B4), ei
// yksityiskohta jonka voi unohtaa.

import { TIILET } from './lataa';

// Panssari-paletti tummalle pohjalle. Kontrastit ovat TARKOITUKSELLA matalat: kartan
// tehtävä on kertoa missä ollaan, ei kilpailla huomiosta merkkien kanssa.
const VARIT = {
  tausta: '#151e2c',
  maa: '#1e293b',
  vesi: '#16233a',
  metsa: '#1b2a35',
  puisto: '#1c2f33',
  rakennus: '#27344a',
  tie: '#3b4a5f',
  paatie: '#4d5f78',
  raja: '#3b4a5f',
};

/**
 * Tiililähteen ja tasojen muodostus.
 *
 * Palauttaa maplibren tyyliobjektin. `pmtiles://`-etuliite kertoo protokollakäsittelijälle
 * (rekisteröity lataa.ts:ssä) että osoite on yksi tiedosto eikä tiilipalvelin.
 */
export function karttatyyli() {
  return {
    version: 8 as const,
    // Glyphs puuttuu tarkoituksella, ks. tiedoston alku. Jos tämän lisää ilman että
    // kirjasimet ovat isännöitynä, tekstitasot epäonnistuvat hiljaa eikä kartassa näy
    // silti nimiä — vain hitaammin.
    sources: {
      perusta: {
        type: 'vector' as const,
        url: `pmtiles://${TIILET}`,
        attribution: '© OpenStreetMap, © Protomaps',
      },
    },
    layers: [
      { id: 'tausta', type: 'background' as const, paint: { 'background-color': VARIT.tausta } },
      {
        id: 'maa', type: 'fill' as const, source: 'perusta', 'source-layer': 'earth',
        paint: { 'fill-color': VARIT.maa },
      },
      {
        id: 'metsa', type: 'fill' as const, source: 'perusta', 'source-layer': 'landcover',
        paint: { 'fill-color': VARIT.metsa, 'fill-opacity': 0.6 },
      },
      {
        id: 'puisto', type: 'fill' as const, source: 'perusta', 'source-layer': 'landuse',
        paint: { 'fill-color': VARIT.puisto, 'fill-opacity': 0.5 },
      },
      {
        id: 'vesi', type: 'fill' as const, source: 'perusta', 'source-layer': 'water',
        paint: { 'fill-color': VARIT.vesi },
      },
      {
        // Rakennukset vasta lähellä: kaupunkitasolla ne ovat yhtenäinen massa joka
        // peittää kadut, eikä päivystäjä lue niistä mitään.
        id: 'rakennukset', type: 'fill' as const, source: 'perusta', 'source-layer': 'buildings',
        minzoom: 14,
        paint: { 'fill-color': VARIT.rakennus, 'fill-opacity': 0.7 },
      },
      {
        // Kaikki tiet yhtenä tasona. Leveys kasvaa zoomin mukana; ilman interpolointia
        // tiet olisivat maakuntatasolla yhtä puuroa ja katutasolla hiusviivoja.
        id: 'tiet', type: 'line' as const, source: 'perusta', 'source-layer': 'roads',
        paint: {
          'line-color': VARIT.tie,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 11, 1, 15, 3],
        },
      },
      {
        // Päätiet korostettuna. Suodatin on `kind`-kentällä; jos paketin kenttä joskus
        // muuttuu, tämä taso jää tyhjäksi eikä riko muuta — tiet piirtyvät yhä yllä
        // olevasta tasosta.
        id: 'paatiet', type: 'line' as const, source: 'perusta', 'source-layer': 'roads',
        filter: ['==', ['get', 'kind'], 'highway'],
        paint: {
          'line-color': VARIT.paatie,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 11, 2, 15, 5],
        },
      },
      {
        id: 'rajat', type: 'line' as const, source: 'perusta', 'source-layer': 'boundaries',
        paint: { 'line-color': VARIT.raja, 'line-dasharray': [2, 2], 'line-width': 0.8 },
      },
    ],
  };
}
