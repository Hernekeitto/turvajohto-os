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

// TYÖNTEKIJÄN OSOITE ON ANNETTAVA ITSE MOLEMMISSA YMPÄRISTÖISSÄ, JA ERI MUODOSSA.
//
// maplibre päättelee työntekijän osoitteen ajonaikana omasta osoitteestaan:
//
//     new URL('./maplibre-gl-worker.mjs', import.meta.url).href
//
// Se ei osu kummassakaan ympäristössä. Kehityksessä moduuli tarjoillaan Viten
// optimoidusta `deps`-hakemistosta, jonka vierellä työntekijätiedostoa ei ole.
// Tuotantobuildissa maplibren minifioitua koodia Viten staattinen analyysi ei tunnista
// työntekijäksi, joten tiedostoa ei kopioida dist-hakemistoon lainkaan.
//
// MOLEMMISSA TAPAUKSISSA SEURAUS ON SAMA JA TÄYSIN HILJAINEN: maplibre putoaa
// varareitilleen, joka käärii työntekijän blob-osoitteeseen, CSP estää sen, työntekijää
// ei synny — ja koska maplibre odottaa työntekijää eikä katso kelloa, TYYLI EI LATAUDU
// KOSKAAN. Näkymään jää ikuinen "Ladataan karttaa…". Konsolissa näkyy yksi
// CSP-ilmoitus, ei yhtään maplibren virhettä, eikä `error`-tapahtuma laukea.
//
// Kaksi eri muotoa, koska ne ratkaisevat kaksi eri puutetta:
//
//   kehitys    `?url` antaa osoitteen paketin omaan tiedostoon. Se tuo mukanaan
//              `maplibre-gl-shared.mjs`:n vierestään, ja Vite tarjoilee sen
//              node_modulesista — joten tuonti toimii.
//   tuotanto   `?worker&url` niputtaa työntekijän ja sen riippuvuudet YHDEKSI
//              tiedostoksi. Pelkkä `?url` kopioisi vain työntekijän, ja sen vieressä
//              oleva `maplibre-gl-shared.mjs`-tuonti osoittaisi tyhjään.
//
// Kumpikaan ei tarvitse CSP-poikkeusta: työntekijä on samasta originista, joten
// `new Worker(url, {type:'module'})` onnistuu eikä blobia synny.
//
// TUOTANNON TUONTI ON DYNAAMINEN JA EHDON SISÄLLÄ. Staattisena se rekisteröisi
// työntekijän Viten moduulipuuhun myös kehityksessä, ja pelkkä rekisteröinti riitti
// rikkomaan kartan devissä. `import.meta.env.PROD` on käännösaikainen vakio, joten
// haara katoaa dev-nipusta kokonaan.
import tyontekijaDev from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// maplibren oma tyylitiedosto. EI VALINNAINEN: merkkien sijoittelu (`position:absolute`
// ja siirtymän lähtöpiste) tulee luokasta `.maplibregl-marker`, ei elementin omista
// tyyleistä. Ilman tätä merkit saavat oikean transformin mutta väärän lähtöpisteen ja
// valuvat kartan ulkopuolelle — kartta näyttää tyhjältä vaikka kaikki data on paikallaan
// ja DOM:ssa on oikea määrä merkkejä. (Löytyi juuri niin: 8 merkkiä DOM:ssa, 0 ruudulla.)
//
// Tuonti on TÄSSÄ tiedostossa, jotta se päätyy samaan laiskaan nippuun kuin kirjasto
// itse eikä sovelluksen perustyyleihin. CSP sallii sen (`style-src 'self'`), koska Vite
// niputtaa sen omaksi tiedostokseen.
import 'maplibre-gl/dist/maplibre-gl.css';

// KESKEN OLEVA LATAUS TALTEEN, EI VAIN VALMIS TULOS.
//
// Tämä oli aluksi `let ladattu: … | null` joka asetettiin vasta awaitien jälkeen, ja se
// oli kilpailutilanne: karttakomponentti kutsuu tätä KOLMESTA efektistä yhtä aikaa
// (kartan luonti, yksikkömerkit, kohdemerkit). Kaikki kolme näkivät välimuistin tyhjänä,
// kaikki kolme latasivat kirjaston, ja kaikki kolme ajoivat rekisteröinnin: setWorkerUrl
// ja addProtocol useaan kertaan, osa niistä sen jälkeen kun maplibre oli jo alkanut
// käyttää edellistä arvoa.
//
// Oire oli satunnainen ja täysin hiljainen: kartta joko latautui tai jäi ikuisesti
// "Ladataan"-tilaan pyytämättä yhtään tiiltä, saman koodin ja saman sivun kanssa.
// Sama sivu toimi ja ei toiminut peräkkäisillä latauksilla.
//
// Lupauksen tallentaminen tekee tästä yhden ainoan suorituksen riippumatta siitä kuinka
// monta kutsujaa on: myöhemmät saavat saman lupauksen ja odottavat sen valmistumista.
let lataus: Promise<typeof import('maplibre-gl')> | null = null;

/**
 * Lataa maplibre-gl ja rekisteröi PMTiles-protokollan.
 *
 * Palauttaa moduulin, ei karttaa: kartan luonti tarvitsee DOM-elementin, joka on
 * komponentin asia eikä tämän. Turvallinen kutsua monta kertaa ja rinnakkain.
 */
export function lataaKarttakirjasto() {
  if (!lataus) lataus = teeLataus();
  return lataus;
}

async function teeLataus() {
  // Rinnakkain: kumpikaan ei riipu toisesta, ja sarjassa ladattuina käyttäjä odottaisi
  // turhaan kahden hakukierroksen verran.
  const [maplibre, pmtiles] = await Promise.all([
    import('maplibre-gl'),
    import('pmtiles'),
  ]);

  // Osoite ENNEN ensimmäistä karttaa: maplibre lukee sen työntekijää luodessaan.
  // Perustelu kummallekin muodolle on tiedoston alussa.
  if (import.meta.env.PROD) {
    const tyontekija = await import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url');
    maplibre.setWorkerUrl(tyontekija.default);
  } else {
    maplibre.setWorkerUrl(tyontekijaDev);
  }

  // Protokollan rekisteröinti kerran. Erillistä lippua ei tarvita: tämä funktio ajetaan
  // kerran koko prosessin elinaikana, koska kutsuja saa aina saman lupauksen.
  const protokolla = new pmtiles.Protocol();
  maplibre.addProtocol('pmtiles', protokolla.tile);

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
