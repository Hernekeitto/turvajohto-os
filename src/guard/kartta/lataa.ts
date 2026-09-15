// Karttakirjaston lataus — ERIKSEEN JA VASTA TARVITTAESSA.
//
// maplibre-gl on tämän projektin ensimmäinen raskas riippuvuus. Se ei saa päätyä samaan
// nippuun kuin muu sovellus, koska silloin sen maksaisivat kaikki: tapahtumapuoli jolla
// ei ole karttaa lainkaan, ja ennen kaikkea vartijan puhelin joka lataa GuardAppin
// kentällä mobiiliyhteydellä. Karttaa katsoo päivystäjä valvomossa.
//
// Siksi tämä moduuli on ainoa paikka josta maplibre tuodaan, ja tuonti on dynaaminen.
// Vite tekee siitä oman nippunsa, joka haetaan vasta kun karttapaneeli avataan.
//
// ÄLÄ TUO maplibre-gl:ää STAATTISESTI MISTÄÄN MUUALTA. Yksi staattinen import missä
// tahansa vetää sen takaisin päänippuun, eikä sitä huomaa mistään muusta kuin
// nippukoon kasvusta — jota kukaan ei katso ennen kuin jokin on hidasta.

import type { Map as MapLibreMap, MapOptions } from 'maplibre-gl';

// TYÖNTEKIJÄTIEDOSTON OSOITE ON ANNETTAVA ITSE, JA ILMAN TÄTÄ KARTTA EI TOIMI
// TUOTANNOSSA LAINKAAN — mutta toimii kehityksessä, mikä tekee viasta juuri sen lajin
// jonka tämä projekti haluaa löytää etukäteen.
//
// maplibre päättelee työntekijän osoitteen ajonaikana omasta osoitteestaan:
//
//     new URL('./maplibre-gl-worker.mjs', import.meta.url).href
//
// Kehityksessä se osuu oikeaan tiedostoon, koska Vite tarjoilee paketin sellaisenaan.
// Buildissa ei: maplibren oma koodi on minifioitu muotoon jota Viten staattinen analyysi
// ei tunnista työntekijäksi, joten tiedostoa EI kopioida dist-hakemistoon. Osoite
// osoittaisi tuotannossa polkuun /assets/maplibre-gl-worker.mjs, jota ei ole olemassa.
// (Todennettu buildatusta nipusta 15.9.2026.)
//
// `?url` pyytää Viteä kopioimaan tiedoston sellaisenaan ja antamaan sen osoitteen. Näin
// työntekijä on SAMASTA ORIGINISTA, jolloin `new Worker(url, {type:'module'})` onnistuu
// eikä maplibre joudu varareitilleen, joka käärii työntekijän blob-osoitteeseen.
// Se varareitti olisi vaatinut CSP:hen `worker-src blob:` -poikkeuksen — nyt ei vaadi
// mitään, ja se on parempi lopputulos kuin löysempi CSP.
import tyontekijanOsoite from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Protokolla rekisteröidään VAIN KERRAN prosessin elinaikana. maplibre pitää
// protokollarekisteriä moduulitasolla, ja saman nimen rekisteröinti uudestaan korvaisi
// edellisen kesken lennon — paneelin avaaminen toista kertaa nollaisi silloin
// ensimmäisen paneelin tiilihaut.
let rekisteroity = false;

// Ladattu moduuli talteen: toinen avaus ei saa hakea nippua uudestaan.
let ladattu: typeof import('maplibre-gl') | null = null;

/**
 * Lataa maplibre-gl ja rekisteröi PMTiles-protokollan.
 *
 * Palauttaa moduulin, ei karttaa: kartan luonti tarvitsee DOM-elementin, joka on
 * komponentin asia eikä tämän.
 */
export async function lataaKarttakirjasto() {
  if (ladattu) return ladattu;

  // Rinnakkain: kumpikaan ei riipu toisesta, ja sarjassa ladattuina käyttäjä odottaisi
  // turhaan kahden hakukierroksen verran.
  const [maplibre, pmtiles] = await Promise.all([
    import('maplibre-gl'),
    import('pmtiles'),
  ]);

  if (!rekisteroity) {
    // Osoite ENNEN ensimmäistä karttaa: maplibre lukee sen työntekijää luodessaan, ja
    // luonti tapahtuu heti kun ensimmäinen lähde tarvitsee tiilten jäsentämistä.
    maplibre.setWorkerUrl(tyontekijanOsoite);
    const protokolla = new pmtiles.Protocol();
    maplibre.addProtocol('pmtiles', protokolla.tile);
    rekisteroity = true;
  }

  ladattu = maplibre;
  return maplibre;
}

// Tiilipaketin osoite.
//
// TIEDOSTONIMESSÄ ON PLANEETTABUILDIN PÄIVÄMÄÄRÄ, ja sen on vastattava sitä nimeä jonka
// `asennus/tiilet.sh` tuotti palvelimelle (`suomi-<pvm>.pmtiles`). Nimi on osa sopimusta
// eikä yksityiskohta: nginx tarjoilee tiedoston `immutable`-otsakkeella, koska sisältö ei
// koskaan muutu tämän nimen alla. Uusi tiilipaketti on siis uusi nimi ja tämän rivin
// muutos — ei välimuistin tyhjennystä, ei "päivitä ja toivo".
//
// Jos tämä ja palvelimen tiedostonimi erkanevat, kartta jää tyhjäksi ja verkkovälilehti
// näyttää 404:n — se on ikävä mutta äänekäs vika, ja se on tarkoituksella parempi kuin
// hiljainen vanhan paketin tarjoilu.
//
// Ympäristömuuttuja on kehitystä varten: `VITE_TIILET=http://…` osoittaa toiseen
// pakettiin ilman koodimuutosta.
export const TIILET =
  (import.meta.env.VITE_TIILET as string | undefined) || '/tiilet/suomi-20260914.pmtiles';

/**
 * Kartan perusasetukset.
 *
 * Suomen rajaus on kova raja eikä oletusnäkymä: `maxBounds` estää vierittämästä pois
 * alueelta jolta meillä on tiilet. Ilman sitä päivystäjä voi vahingossa raahata kartan
 * Atlantille, jossa ei ole mitään, eikä ruudulta näy onko vika kartassa vai
 * tiilipaketissa.
 */
export const SUOMI_RAJAUS: [[number, number], [number, number]] = [
  [18.9, 59.3],
  [31.7, 70.2],
];

export const KARTAN_ASETUKSET: Partial<MapOptions> = {
  center: [24.94, 60.17],
  zoom: 9,
  maxBounds: SUOMI_RAJAUS,
  // Kompassi ja kallistus pois: valvomokartta katsotaan ylhäältä, ja kallistettu kartta
  // on vain tila johon päivystäjä joutuu vahingossa eikä osaa palata.
  pitchWithRotate: false,
  dragRotate: false,
  // Attribuutio on lisenssiehto eikä koriste, ks. B3.
  attributionControl: false,
};

export type { MapLibreMap };
