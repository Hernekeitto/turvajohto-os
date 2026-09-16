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
// --- NIMET: MISTÄ NE TULEVAT --------------------------------------------------------
//
// MapLibre ei piirrä tekstiä kirjasintiedostosta vaan esilasketuista KIRJASINATLAKSISTA
// (signed distance field, .pbf-lohkoja 256 merkin välein). Siksi kartassa ei ollut
// nimiä lainkaan ennen vaihetta B4: atlaksia ei ollut isännöitynä, eikä CSP salli
// hakea niitä muualta. Nyt ne ovat omalla palvelimella tiilipaketin vieressä
// (`asennus/kirjasimet.sh`), joten selain ei ota yhteyttä kolmanteen osapuoleen.
//
// YKSI KIRJASIN PER TASO, EI KOSKAAN KAHTA. Jos `text-font` on `['A', 'B']`, MapLibre
// pyytää YHTÄ osoitetta "A,B/0-255.pbf" ja odottaa palvelimen koostavan atlaksen
// lennossa. nginx ei koosta mitään: vastaus on 404 ja koko tason teksti katoaa. Tämä
// on se virhe joka tehdään kun halutaan varakirjasin — varakirjasinta ei tarvita,
// koska atlakset kattavat koko Unicoden.
//
// KENTTÄNIMET ON LUETTU TIILIPAKETIN OMASTA METADATASTA (Protomaps-skeema 4.15.2,
// luettu 16.9.2026 tuotannon paketista range-pyynnöillä), ei dokumentaatiosta:
// `roads` ja `places` sisältävät `name`, `name:fi`, `name:sv`, `ref` ja `min_zoom`.
//
// `name:fi` ENSIN, `name` VARALLE. Kaksikielisissä kunnissa OSM:n `name` on muotoa
// "Helsinki / Helsingfors", mikä on seinätaululla kaksinkertainen mitta samasta
// tiedosta. Ruotsinkielisillä alueilla `name:fi` puuttuu, jolloin varalle jää `name` —
// eli ruotsinkielinen nimi, joka on juuri se minkä soittaja siellä sanoo.
//
// PAIKOILLA EI OLE PISTETTÄ, vain teksti. Piste kilpailisi yksikkömerkkien kanssa, ja
// merkkien erottuminen kolmen metrin päästä on tämän kartan koko tarkoitus.

import { TIILET, KIRJASIMET } from './osoitteet.ts';

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
  // Tekstit ovat KIRKKAAMPIA kuin viivat joiden päällä ne ovat, mutta himmeämpiä kuin
  // yksikkömerkkien tilavärit. Nimi on luettava, mutta kartta ei saa muuttua tekstiksi
  // jonka seasta merkkejä etsitään.
  paikkateksti: '#c8d8ec',
  tieteksti: '#8ea4bd',
  // Tienumero EI saa olla tien oma väri: ensimmäisessä kokeilussa se oli, ja numero
  // suli viivaan niin ettei sitä erottanut kuvakaappauksestakaan. Tämä on tiellä kelluva
  // merkintä, ei osa viivaa.
  tienumero: '#a9c2de',
  // Reunus on taustan väri eikä musta: mustalla teksti saisi ympärilleen renkaan joka
  // näkyy tummalla pohjalla omana muotonaan.
  reunus: '#151e2c',
};

// Nimikentän valinta. Sama kaikille tasoille, ks. tiedoston alun perustelu.
const NIMI = ['coalesce', ['get', 'name:fi'], ['get', 'name']];

// Yksi kirjasinnimi, ei listaa — ks. tiedoston alku. Nimi on myös palvelimella olevan
// hakemiston nimi, joten se ja `asennus/kirjasimet.sh`:n LEIKKAUKSET on pidettävä
// samoina.
const KIRJASIN_PAIKKA = ['Noto Sans Medium'];
const KIRJASIN_TIE = ['Noto Sans Regular'];

/**
 * Tiililähteen ja tasojen muodostus.
 *
 * Palauttaa maplibren tyyliobjektin. `pmtiles://`-etuliite kertoo protokollakäsittelijälle
 * (rekisteröity lataa.ts:ssä) että osoite on yksi tiedosto eikä tiilipalvelin.
 */
export function karttatyyli() {
  return {
    version: 8 as const,
    // `{fontstack}` ja `{range}` ovat MapLibren omia paikanpitäjiä, eivät meidän —
    // kirjasto korvaa ne tason `text-font`-arvolla ja merkkilohkon rajoilla. Osoite on
    // suhteellinen ja samasta originista, joten CSP:n `default-src 'self'` riittää eikä
    // `font-src`-riviä tarvitse muuttaa: nämä eivät ole kirjasimia selaimen mielessä
    // vaan tavallisia tiedostohakuja.
    glyphs: `${KIRJASIMET}/{fontstack}/{range}.pbf`,
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

      // --- TEKSTIT VIIMEISENÄ ------------------------------------------------------
      //
      // Järjestys ratkaisee päällekkäisyyden: myöhempi taso piirtyy päälle. Tekstien on
      // oltava viivojen päällä, muuten katu leikkaisi oman nimensä poikki.
      //
      // Yksikkömerkit eivät ole tässä listassa lainkaan — ne ovat DOM-elementtejä
      // kanvaasin päällä (ks. GuardKartta.tsx), joten mikään tekstitaso ei voi mennä
      // niiden eteen. Se on tarkoitus: nimi saa kadota merkin alle, merkki ei koskaan
      // nimen alle.

      {
        // Tienumerot: "3", "E12". Päivystäjä ja vartija puhuvat valtateistä numerolla,
        // ja numero näkyy maakuntatasolla jo ennen kuin kadunnimille on tilaa.
        //
        // `symbol-placement: line` asettaa tekstin tien suuntaisesti ja toistaa sen
        // `symbol-spacing`-välein. Ilman toistoa pitkällä tiellä olisi yksi numero
        // keskellä, usein ruudun ulkopuolella.
        id: 'tienumerot', type: 'symbol' as const, source: 'perusta', 'source-layer': 'roads',
        minzoom: 8,
        filter: ['all', ['==', ['get', 'kind'], 'highway'], ['has', 'ref']],
        layout: {
          'symbol-placement': 'line' as const,
          'symbol-spacing': 320,
          'text-field': ['get', 'ref'],
          'text-font': KIRJASIN_TIE,
          'text-size': 12,
          // PYSTYSSÄ, EI TIEN SUUNTAISESTI. Kadunnimi luetaan kadun suuntaisena, mutta
          // numero on kilpi: pohjois–eteläsuuntaisella moottoritiellä kyljelleen käännetty
          // "3" on pelkkä viiva ruudulla. `viewport` pitää numeron pystyssä, vaikka
          // sijoittelu seuraa tietä. (Ensimmäisessä versiossa tämä oli `map`, ja
          // kuvakaappauksesta numeroita ei erottanut.)
          'text-rotation-alignment': 'viewport' as const,
        },
        paint: {
          'text-color': VARIT.tienumero,
          'text-halo-color': VARIT.reunus,
          'text-halo-width': 1.4,
        },
      },
      {
        // Paikannimet. `min_zoom` tulee tiilipaketista ja kertoo mistä zoomista paikka
        // kannattaa näyttää — Protomaps on laskenut sen väkiluvun ja merkittävyyden
        // perusteella. Ilman tätä suodatinta Suomi olisi maakuntatasolla peitossa
        // kylännimistä eikä yhtään kaupunkia erottuisi.
        //
        // `coalesce` on siinä siltä varalta että kenttä puuttuu joltain kohteelta:
        // puuttuva arvo tekisi vertailusta virheen, ja virheellinen suodatin pudottaa
        // kohteen — eli nimi katoaisi hiljaa.
        //
        // KAUPUNGINOSAT OVAT OMANA TASONAAN ALEMPANA. Tiilipaketin `min_zoom` päästää ne
        // esiin jo zoomilla 11, ja pääkaupunkiseutu peittyi silloin kortteleiden nimiin
        // (Keimolanmäki, Vantaanpuisto, Petikon yritysalue…) niin ettei kaupunkeja
        // erottanut. Nähty kuvakaappauksesta, ei arvattu.
        id: 'paikannimet', type: 'symbol' as const, source: 'perusta', 'source-layer': 'places',
        filter: [
          'all',
          ['<=', ['coalesce', ['get', 'min_zoom'], 0], ['zoom']],
          ['in', ['get', 'kind'], ['literal', ['country', 'region', 'locality']]],
        ],
        layout: {
          'text-field': NIMI,
          'text-font': KIRJASIN_PAIKKA,
          // Koko kertoo mittakaavan: kaupunki on suurempi kuin kaupunginosa. Tämä on
          // ainoa ero niiden välillä, koska pistettä ei piirretä.
          //
          // JÄRJESTYS ON PAKOTETTU, ei valittu. `['zoom']` saa esiintyä vain uloimman
          // `interpolate`- tai `step`-lausekkeen syötteenä. Luonteva kirjoitustapa —
          // `match` päällimmäisenä ja zoom-interpolaatio kaupungin haarassa — on
          // spesifikaation vastainen, ja MapLibre pudottaa sellaisen tason pois. Kartta
          // latautuisi ilman paikannimiä eikä kertoisi miksi. (Tämä kirjoitettiin
          // ensin väärin päin; testi löysi sen.)
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            5, ['match', ['get', 'kind'], 'country', 13, 'region', 11, 'locality', 11, 9],
            10, ['match', ['get', 'kind'], 'country', 13, 'region', 12, 'locality', 14, 10],
            14, ['match', ['get', 'kind'], 'country', 13, 'region', 12, 'locality', 17, 11],
          ],
          'text-max-width': 8,
          // Kirjainvälitys erottaa nimen viivastosta ilman että kokoa pitää kasvattaa.
          'text-letter-spacing': 0.04,
        },
        paint: {
          'text-color': VARIT.paikkateksti,
          'text-halo-color': VARIT.reunus,
          'text-halo-width': 1.6,
        },
      },
      {
        // Kaupunginosat ja korttelit. VASTA ZOOMISTA 12 — samasta syystä kuin kadunnimet
        // vasta 13:sta: kauempaa niistä ei ole hyötyä, ja lähempänä ne ovat se tieto
        // jolla soittajan "Myyrmäessä" osuu kartalle.
        //
        // Omana tasonaan eikä yhtenä suodattimena, koska `minzoom` on tason ominaisuus
        // eikä lauseke: raja on luettavissa yhdeltä riviltä eikä suodattimen sisältä.
        id: 'korttelinimet', type: 'symbol' as const, source: 'perusta', 'source-layer': 'places',
        minzoom: 12,
        filter: ['in', ['get', 'kind'], ['literal', ['macrohood', 'neighbourhood']]],
        layout: {
          'text-field': NIMI,
          'text-font': KIRJASIN_TIE,
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 15, 12],
          'text-max-width': 8,
          'text-letter-spacing': 0.04,
        },
        paint: {
          // Himmeämpi kuin kaupungin nimi: kortteli on tarkennus, ei otsikko.
          'text-color': VARIT.tieteksti,
          'text-halo-color': VARIT.reunus,
          'text-halo-width': 1.6,
        },
      },
      {
        // Kadunnimet. VASTA ZOOMISTA 13, ja se on tietoinen raja: sitä kauempaa nimiä ei
        // ehtisi lukea, ja ne vain peittäisivät yksikkömerkit. Osoitteen tunnistaminen
        // tapahtuu kun päivystäjä on zoomannut kohteeseen, ei yleiskuvassa.
        //
        // `path` (jalkakäytävät, polut, portaat) on rajattu pois. Niiden nimet ovat
        // tiheässä juuri siellä missä kaupunki on tiheimmillään, eikä yksikköä ohjata
        // portaille.
        id: 'tiennimet', type: 'symbol' as const, source: 'perusta', 'source-layer': 'roads',
        minzoom: 13,
        filter: ['all', ['has', 'name'], ['!=', ['get', 'kind'], 'path']],
        layout: {
          'symbol-placement': 'line' as const,
          'symbol-spacing': 400,
          'text-field': NIMI,
          'text-font': KIRJASIN_TIE,
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 12.5],
          'text-rotation-alignment': 'map' as const,
          // Jyrkässä mutkassa teksti taipuisi lukukelvottomaksi; tätä jyrkemmät kohdat
          // MapLibre jättää nimeämättä ja etsii suoremman pätkän.
          'text-max-angle': 30,
        },
        paint: {
          'text-color': VARIT.tieteksti,
          'text-halo-color': VARIT.reunus,
          'text-halo-width': 1.4,
        },
      },
    ],
  };
}
