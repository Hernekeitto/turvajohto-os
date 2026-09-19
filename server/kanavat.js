// PTT-kanavat (erä 26, vaihe 1). Kuka kuuluu mihinkin kanavaan juuri nyt.
//
// Säännöt ovat täällä ja kutsut index.js:ssä, samaan tapaan kuin vuorot.js:ssä ja
// halytystehtava.js:ssä. Tämä tiedosto ei lue eikä kirjoita levyä eikä tunne Expressiä.
//
// --- KIINTEÄ KANAVA EI OLE TALLENNETTU TIETUE -------------------------------------
//
// Kohde- ja piirikanavan jäsenyyttä ei tallenneta minnekään — se lasketaan LUKUHETKELLÄ
// kesken olevasta vuorosta, täsmälleen samalla periaatteella kuin guardDispatchin
// kohdennus (halytystehtava.js: nakeeTehtavan) ja guard_site_assetsin näkyvyys
// (kalusto.js: vuoronKalusto). Vuorot alkavat ja loppuvat, joten tallennettu
// jäsenyyslista olisi väärässä heti seuraavalla vuoronvaihdolla.
//
// Vapaat ryhmät, henkilökohtaiset viestit (DM) ja hätäkanavat ovat ERI ASIA — niillä ON
// eksplisiittinen osallistujalista tai vastaava, koska niitä ei voi laskea vuorosta. Ne
// tallennetaan `guardKanavat`-kokoelmaan (server/index.js, server/permissions.js).

import { AVOIMET as HALYTYS_AVOIMET } from './halytys.js';

/** Kohteen kiinteän kanavan tunnus. Sama kohde antaa saman tunnuksen aina. */
export const kohdeKanavaId = (siteId) => `kohde:${siteId}`;

/** Piirivuorotyypin kiinteän kanavan tunnus. Yksi kanava per vuorotyyppi, ei per kohde
 * eikä per "piiri" yleensä — kaksi eri piirivuoroa (esim. "Piiri 301" ja "Piiri 302")
 * eivät jaa samaa kanavaa, koska ne ovat eri partio eri liikenteellä. */
export const piiriKanavaId = (vuorotyyppiId) => `piiri:${vuorotyyppiId}`;

/**
 * Tämän vartijan kiinteät kanavat juuri nyt, kesken olevan vuoron perusteella.
 *
 * Ilman kesken olevaa vuoroa lista on tyhjä — samalla tavalla kuin kalustonäkyvyyskin
 * vaatii vuoron (guard_site_assets). Piirikanava tulee mukaan VAIN jos vuoro on
 * nimenomaan piirivuoro (vuoro.piiri === true): tavallinen kohdevuoro ei kuulu
 * piirikanavalle vaikka kohteessa olisi piirivuorotyyppejä.
 *
 * Nimet kopioidaan suoraan vuorotietueesta (siteNimi, vuorotyyppiNimi) eikä haeta
 * kohteesta erikseen — vuoro on jo tallentanut ne omaan aikaansa, samasta syystä kuin
 * hälytystehtävän kohteen nimi kopioidaan luontihetkellä.
 */
export function omatKiinteatKanavat(vuoro) {
  if (!vuoro || vuoro.tila !== 'kesken') return [];
  const kanavat = [
    { id: kohdeKanavaId(vuoro.siteId), tyyppi: 'kohde', siteId: vuoro.siteId, nimi: vuoro.siteNimi || '' },
  ];
  if (vuoro.piiri === true) {
    kanavat.push({
      id: piiriKanavaId(vuoro.vuorotyyppiId),
      tyyppi: 'piiri',
      vuorotyyppiId: vuoro.vuorotyyppiId,
      nimi: vuoro.vuorotyyppiNimi || '',
    });
  }
  return kanavat;
}

/**
 * Kuuluuko tämä vartija annettuun kiinteään kanavaan juuri nyt.
 *
 * Kirjoitettu jo nyt vaikka floor control (joka tätä tarvitsee) tulee vasta myöhemmässä
 * erässä — jäsenyyssääntö on näin yhdessä paikassa testattuna eikä sitä toisteta
 * kutsupaikoissa myöhemmin.
 */
export function kuuluuKiinteaanKanavaan(vuoro, kanavaId) {
  return omatKiinteatKanavat(vuoro).some((k) => k.id === kanavaId);
}

// --- Tallennetut kanavat: DM (erä 26, vaihe 1c) -------------------------------------
//
// DM ON VUORON SISÄINEN TYÖKALU (käyttäjän päätös 19.9.2026): sekä pyytäjällä että
// vastaanottajalla on oltava kesken oleva vuoro DM:ää aloitettaessa, ja kanava
// purkautuu kun MOLEMMAT osapuolet ovat lopettaneet vuoronsa — ei riitä että toinen
// lopettaa, koska toinen voi yhä olla töissä ja tarvita keskustelua.
//
// Tuotepuoli (EVENT/GUARD) EI ole tämän tiedoston asia — se suodatetaan kutsujassa
// (server/index.js), koska käyttäjätiedot ja tuoteoikeudet eivät kuulu tänne samasta
// syystä kuin kohteen nimikään ei tule tästä tiedostosta.

/**
 * Muut käyttäjät jotka ovat juuri nyt vuorossa — DM-vastaanottajaehdokkaat ennen
 * tuotepuolisuodatusta.
 */
export function vuorossaOlevatMuut(vuorot, omaKayttaja) {
  const uniikit = new Set();
  for (const v of vuorot || []) {
    if (v?.tila === 'kesken' && v.vartija && v.vartija !== omaKayttaja) uniikit.add(v.vartija);
  }
  return [...uniikit];
}

/**
 * Onko käyttäjä tallennetun kanavan (vapaa/dm/hata) osallistuja.
 */
export function onOsallistuja(kanava, username) {
  return Array.isArray(kanava?.osallistujat) && kanava.osallistujat.includes(username);
}

/** Onko näiden kahden välillä jo DM-kanava. Järjestyksellä ei ole väliä. */
export function loydaDm(kanavat, kayttaja1, kayttaja2) {
  const osapuolet = new Set([kayttaja1, kayttaja2]);
  return (kanavat || []).find((k) => (
    k?.tyyppi === 'dm'
    && Array.isArray(k.osallistujat)
    && k.osallistujat.length === 2
    && k.osallistujat.every((o) => osapuolet.has(o))
  )) || null;
}

/**
 * Uusi DM-tietue. Ei tarkista onko osapuolten välillä jo kanava — se on kutsujan
 * vastuulla `loydaDm`:n kautta, koska vain kutsuja tietää levyllä olevan nykyisen
 * kokoelman eikä tämä tiedosto lue levyä.
 */
export function luoDmKanava({ id, kayttaja1, kayttaja2, nyt = Date.now() }) {
  if (!kayttaja1 || !kayttaja2 || kayttaja1 === kayttaja2) {
    return { ok: false, error: 'DM vaatii kaksi eri käyttäjää.' };
  }
  return {
    ok: true,
    kanava: {
      id,
      tyyppi: 'dm',
      osallistujat: [kayttaja1, kayttaja2],
      luotu: new Date(nyt).toISOString(),
      luoja: kayttaja1,
    },
  };
}

/**
 * Onko DM valmis poistettavaksi: kumpikaan osapuoli ei ole enää vuorossa.
 *
 * VAIN dm-tyyppiselle kanavalle — vapaa ja hätä purkautuvat eri säännöllä (vapaa ei
 * ole sidottu vuoroon lainkaan, hätä purkautuu hälytyksen ratkaisuun eikä vuoron
 * loppumiseen). Väärän tyypin kanavalle tämä palauttaa aina false, ei arvaa.
 *
 * `vuorossaOlevat` on kutsujan kokoama Set käyttäjätunnuksista joilla on kesken oleva
 * vuoro juuri nyt — ei koko vuorolistaa, samasta syystä kuin `vuorossaOlevatMuut` ei
 * palauta vuorotietueita: tämä tiedosto ei tarvitse enempää kuin kysymykseen
 * vastaamiseen vaaditaan.
 */
export function dmPurkautunut(kanava, vuorossaOlevat) {
  if (kanava?.tyyppi !== 'dm') return false;
  return !(kanava.osallistujat || []).some((kayttaja) => vuorossaOlevat.has(kayttaja));
}

// --- Hätäkanava (erä 26, vaihe 1d) --------------------------------------------------
//
// Syntyy automaattisesti kun vartija laukaisee man down- tai hätäpainikehälytyksen
// (server/halytys.js: tyyppi 'mandown' tai 'panic' — "tarvitsen apua" tässä hankkeessa
// käytetyllä nimellä). ERI ASIA kuin DM ja vapaa ryhmä: HÄLKE-puolen jäsenyys EI ole
// tallennettu osallistujalista vaan `guard_dispatch`-oikeus JUURI NYT (kuka tahansa
// päivystäjä voi vastata, ei vain se joka sattui olemaan kirjautuneena kun hälytys
// laukesi) — sama periaate kuin guardDispatch-kohdennuksessa muuallakin. Kanavan
// tietueessa on siksi vain HÄLYTTÄJÄ, ei osallistujalistaa; HÄLKE-jäsenyyden tarkistaa
// kutsuja (server/index.js) `canView(..., 'guard_dispatch')`-oikeudella, koska
// oikeustieto ei kuulu tänne samasta syystä kuin tuoteoikeudetkaan eivät kuulu DM:ään.
//
// ELINKAARI ON SIDOTTU HÄLYTYKSEN RATKAISUUN, EI VUORON LOPPUMISEEN: vartija voi olla
// yhä kesken vuoron kun hälytys jo ratkeaa, ja hälytys voi jäädä auki senkin jälkeen kun
// vartijan vuoro (teoriassa) päättyisi. Käytetään siis alerts-tilaa, ei guardShifts-tilaa.

/** Hätäkanavan tunnus on aina sidottu hälytyksen id:hen — yksi hälytys, yksi kanava. */
export const hataKanavaId = (halytysId) => `hata:${halytysId}`;

/**
 * Uusi hätäkanava-tietue annetulle hälytykselle. `halytysTyyppi` (mandown/panic)
 * kopioidaan hälytyksestä samasta syystä kuin vuoro kopioi kohteen nimen: se on sen
 * hetken tieto, ja sitä tarvitaan myöhemmin päättämään käytös (kuuma mikrofoni vai
 * manuaalinen PTT) ilman erillistä hakua hälytyskokoelmasta joka kerta.
 */
export function luoHataKanava({ halytysId, vartija, halytysTyyppi, nyt = Date.now() }) {
  return {
    id: hataKanavaId(halytysId),
    tyyppi: 'hata',
    liittyvaHalytysId: halytysId,
    halytysTyyppi,
    vartija,
    luotu: new Date(nyt).toISOString(),
    luoja: 'jarjestelma',
    // HÄLKE:n oikeus pitää linja pakotettuna auki senkin jälkeen kun vuoro/tilanne
    // muuttuisi — asetetaan ja puretaan omalla reitillään (vaihe 1e, ei vielä tässä).
    haltePidaHengissa: null,
  };
}

/**
 * Onko tämä käyttäjä hätäkanavan hälyttäjä. HÄLKE-puolen jäsenyys ratkaistaan MUUALLA
 * (guard_dispatch-oikeudella) — tämä vastaa vain kysymykseen "onko tämä se vartija
 * jonka hälytys tämän kanavan avasi".
 */
export function onHalyttaja(kanava, username) {
  return kanava?.tyyppi === 'hata' && kanava.vartija === username;
}

/**
 * Onko hätäkanava valmis poistettavaksi: sen taustalla oleva hälytys ei ole enää avoin
 * (kuitattu tai peruttu), tai hälytystä ei löydy ollenkaan. `halytys` on kutsujan jo
 * hakema YKSITTÄINEN tietue (tai null/undefined) — ei koko listaa, samalla
 * periaatteella kuin muuallakin tässä tiedostossa.
 *
 * `haltePidaHengissa` EI vaikuta tähän: se on HÄLKE:n oikeus pitää LINJA auki, ei
 * oikeus pitää RATKAISTU hälytys keinotekoisesti avoimena. Kanava purkautuu heti
 * hälytyksen ratkaisusta riippumatta lipun tilasta.
 */
export function hataKanavaPurkautunut(kanava, halytys) {
  if (kanava?.tyyppi !== 'hata') return false;
  if (!halytys) return true;
  return !HALYTYS_AVOIMET.includes(halytys.tila);
}

// --- Linjan pakotus (erä 26, vaihe 1e) ----------------------------------------------
//
// HÄLKE:n oikeus pakottaa hätäkanavan linja auki (esim. kun vartija ei itse käynnistä
// lähetystä). Tämä on TALLENNETTU kanavan kenttä eikä hetkellinen puheenvuoro-tila
// (server/puheenvuoro.js) — pakotuksen on kestettävä myös pakottajan oman yhteyden yli,
// toisin kuin tavallinen puheenvuoro joka on aina sidottu pyytäjän istuntoon. Pakotus ei
// itsessään myönnä ketään puheenvuoron haltijaksi: se on kutsujan (server/index.js)
// asiakkaalle lähettämä käsky avata linja, minkä jälkeen asiakas pyytää puheenvuoron
// tavallista `pyyda_puheenvuoro`-reittiä pitkin. Ei siis oikaisua tavallisen floor
// controlin "ei jonoa" -säännön ohi: jos kanava on jo varattu kun asiakas pyytää, pyyntö
// silti hylätään normaalisti.
export function pakotaLinjaAuki(kanava, kayttaja, nyt = Date.now()) {
  if (kanava?.tyyppi !== 'hata') return kanava;
  return { ...kanava, haltePidaHengissa: { kayttaja, alkaen: new Date(nyt).toISOString() } };
}

/** Pakotuksen vapautus. Oikeustarkistus (kuka saa vapauttaa) on kutsujan asia. */
export function vapautaLinjanPakotus(kanava) {
  if (kanava?.tyyppi !== 'hata') return kanava;
  return { ...kanava, haltePidaHengissa: null };
}

// --- Vapaa ryhmä (erä 26, vaihe 1g) --------------------------------------------------
//
// HÄLKE:n (tai pääkäyttäjän) käsin perustama nimetty kanava kiinteälle osallistuja-
// joukolle — esim. ryhmä joka ei vastaa mitään yksittäistä kohdetta tai vuorotyyppiä.
//
// TOISIN KUIN DM: jäsenyys EI riipu vuorosta. Osallistujalista on kiinteä perustamis-
// hetkestä siihen asti kunnes ryhmä poistetaan käsin — jäsenen vuoron päättyminen ei
// poista häntä ryhmästä eikä alkava vuoro lisää ketään siihen. Siksi tälle kanavatyypille
// ei ole (eikä tule) vastinetta `dmPurkautunut`-funktiolle.
//
// Osallistujuuden LUKEMINEN käyttää samaa `onOsallistuja`-funktiota kuin DM, koska
// tietueen muoto (osallistujat-taulukko) on sama — vain luontisääntö eroaa.
export function luoVapaaKanava({ id, nimi, osallistujat, luoja, nyt = Date.now() }) {
  const puhdasNimi = String(nimi || '').trim();
  if (!puhdasNimi) return { ok: false, error: 'Ryhmä vaatii nimen.' };

  const uniikit = [...new Set((osallistujat || []).filter((k) => typeof k === 'string' && k))];
  // Vähintään kaksi, jotta "ryhmä" ei ole vain toinen nimi DM:lle.
  if (uniikit.length < 2) return { ok: false, error: 'Ryhmä vaatii vähintään kaksi osallistujaa.' };

  return {
    ok: true,
    kanava: {
      id,
      tyyppi: 'vapaa',
      nimi: puhdasNimi.slice(0, 100),
      osallistujat: uniikit,
      luotu: new Date(nyt).toISOString(),
      luoja,
    },
  };
}
