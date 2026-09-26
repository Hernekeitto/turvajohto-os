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

// Hätäkytkin koko PTT-ominaisuudelle (erä 26, vaihe 8: kovennus — Obsidian
// "vaihe 8 -suunnitelma" kohta 7: "koko PTT-ominaisuus voidaan sulkea nopeasti
// palvelimelta ilman uutta julkaisua").
//
// KÄÄNTEINEN OLETUS VERRATTUNA seurantaKaytossa:iin (server/sijainti.js), TARKOITUKSELLA
// — eri syy, eri oletus: sijaintiseuranta on julkaisueste joka ODOTTAA lupaa
// (juridinen käsittely kesken, oletus POIS päältä), PTT on jo käyttöönotettu
// ominaisuus jolle tarvitaan NOPEA HÄTÄKATKAISU (oletus PÄÄLLÄ, pois vain jos
// operaattori nimenomaan kytkee sen pois hätätilanteessa — esim. väärinkäyttö,
// kryptografiavika, tai kuormaongelma jota ei ehditä muuten korjata). "Samalla
// periaatteella kuin SIJAINTISEURANTA" (suunnitelman oma sanamuoto) tarkoittaa
// MEKANISMIA (yksinkertainen ympäristömuuttuja, `=== '1'`-tarkistus), ei samaa
// oletusarvoa — polariteetti on tarkoituksella eri koska tarkoitus on eri.
export const pttKaytossa = () => process.env.PTT_POIS_KAYTOSTA !== '1';

/** Kohteen kiinteän kanavan tunnus. Sama kohde antaa saman tunnuksen aina. */
export const kohdeKanavaId = (siteId) => `kohde:${siteId}`;

/** Piirivuorotyypin kiinteän kanavan tunnus. Yksi kanava per vuorotyyppi, ei per kohde
 * eikä per "piiri" yleensä — kaksi eri piirivuoroa (esim. "Piiri 301" ja "Piiri 302")
 * eivät jaa samaa kanavaa, koska ne ovat eri partio eri liikenteellä. */
export const piiriKanavaId = (vuorotyyppiId) => `piiri:${vuorotyyppiId}`;

/** Alueen (esim. kaupunki) kiinteän kanavan tunnus. Normalisoidaan (trim + lowercase)
 * ennen tunnuksen muodostusta, jotta sama alue eri kirjoitusasuilla ("Tampere" vs.
 * "tampere ") osuu samaan kanavaan eikä synnytä kahta rinnakkaista aluekanavaa. */
export const alueKanavaId = (alue) => `alue:${String(alue).trim().toLowerCase()}`;

/**
 * Onko tämä kiinteän (kohde/piiri/alue) kanavan tunnus — erotukseksi tallennetuista
 * kanavista (dm/vapaa/hata), joilla ei ole etuliitettä. Keskitetty tänne (erä 26,
 * jatko 26.9.2026) koska tarkistus oli aiemmin kopioitu käsin kahteen paikkaan
 * server/index.js:ssä omalla "pidettävä käsin synkronissa" -kommentillaan — se on
 * juuri se riski jonka keskittäminen poistaa.
 */
export function onKiinteaKanavaId(kanavaId) {
  return kanavaId.startsWith('kohde:') || kanavaId.startsWith('piiri:') || kanavaId.startsWith('alue:');
}

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
  // Alueen yleiskanava (käyttäjän pyyntö 26.9.2026: "alueen yleinen ryhmä esim
  // Tampere") — VAIN jos vuorolla on alue kopioituna (kohteella oli alue asetettuna
  // vuoron alkaessa). Sama kiinteä/laskettu periaate kuin kohde- ja piirikanavalla:
  // ei tallenneta, lasketaan aina kesken olevasta vuorosta.
  if (typeof vuoro.alue === 'string' && vuoro.alue.trim() !== '') {
    kanavat.push({
      id: alueKanavaId(vuoro.alue),
      tyyppi: 'alue',
      alue: vuoro.alue,
      nimi: vuoro.alue,
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

/**
 * Kaikki vartijat jotka kuuluvat annettuun kiinteään kanavaan JUURI NYT (erä 26,
 * vaihe 3, viipale 3b) — tarvitaan huoneavaimen jakoon: lähettäjän on tiedettävä
 * KENELLE avain jaetaan, ei vain ETTÄ hän itse kuuluu kanavalle.
 *
 * Käy läpi kaikki vuorot ja käyttää samaa sääntöä (kuuluuKiinteaanKanavaan) kuin
 * yksittäisen vartijan oma jäsenyystarkistus — ei erillistä, mahdollisesti eriävää
 * sääntöä kahdessa paikassa.
 */
export function jasenetKiinteallaKanavalla(vuorot, kanavaId) {
  const uniikit = new Set();
  for (const vuoro of vuorot || []) {
    if (vuoro?.vartija && kuuluuKiinteaanKanavaan(vuoro, kanavaId)) uniikit.add(vuoro.vartija);
  }
  return [...uniikit];
}

// --- Kaikkien kiinteiden kanavien katalogi (erä 26, jatko 26.9.2026) ----------------
//
// Käyttäjän pyyntö: "Lisätään HÄLKE mahdollisuus nähdä kaikki PTT-kanavat, vaikka
// niillä ei olisi ketään." Yllä olevat funktiot kaikki LASKEVAT kanavia AKTIIVISISTA
// vuoroista — kohde jolla ei ole ketään töissä juuri nyt ei tuota mitään. Tämä
// funktio vastaa sen sijaan kysymykseen "mitä kiinteitä kanavia VOISI olla olemassa",
// suoraan kohdetietueista, ilman yhtäkään vuoroa.

/**
 * Kaikkien mahdollisten kiinteiden kanavien katalogi kohdetietueista: yksi kohde-
 * kanava per kohde, yksi piiri-kanava per erillinen piirivuorotyyppi (deduplikoitu
 * id:n mukaan yli kaikkien kohteiden — kaksi kohdetta ei voi jakaa vuorotyyppiä,
 * mutta tarkistus on silti syytä tehdä eksplisiittisesti), ja yksi alue-kanava per
 * erillinen normalisoitu alue-arvo.
 */
export function kaikkiKiinteatKanavat(kohteet) {
  const kohdekanavat = [];
  const piirit = new Map();
  const alueet = new Map();
  for (const kohde of kohteet || []) {
    if (!kohde?.id) continue;
    kohdekanavat.push({
      id: kohdeKanavaId(kohde.id), tyyppi: 'kohde', siteId: kohde.id, nimi: kohde.name || '',
    });
    for (const vt of kohde.vuorotyypit || []) {
      if (vt?.piiri === true && vt.id && !piirit.has(vt.id)) {
        piirit.set(vt.id, {
          id: piiriKanavaId(vt.id), tyyppi: 'piiri', vuorotyyppiId: vt.id, nimi: vt.nimi || '',
        });
      }
    }
    if (typeof kohde.alue === 'string' && kohde.alue.trim() !== '') {
      const alue = kohde.alue.trim();
      const id = alueKanavaId(alue);
      if (!alueet.has(id)) alueet.set(id, { id, tyyppi: 'alue', alue, nimi: alue });
    }
  }
  return [...kohdekanavat, ...piirit.values(), ...alueet.values()];
}

// --- Jäsenpoikkeukset kiinteille kanaville (erä 26, jatko 26.9.2026) ----------------
//
// Käyttäjän pyyntö: "Lisätään HÄLKE mahdollisuus lisätä ja poistaa vartijoita
// tietyltä kanavalta" — vahvistettu koskemaan MYÖS kiinteitä (kohde/piiri/alue)
// kanavia, ei vain vapaita ryhmiä. Tämä on TIETOINEN POIKKEUS yllä olevaan
// periaatteeseen "kiinteän kanavan jäsenyyttä ei tallenneta" — poikkeus ei korvaa
// vuoropohjaista laskentaa vaan menee sen PÄÄLLE: 'poistettu' voittaa vuoron
// (vartija ei kuulu kanavalle vaikka vuoro sanoisi niin), 'lisatty' myöntää
// jäsenyyden riippumatta vuorosta. Rivit ovat guardKanavaJasenet-kokoelmassa
// (server/index.js), yksi per (kanavaId, kayttaja) -pari.

/** Tämän (kanava, käyttäjä) -parin poikkeus, tai null jos ei poikkeusta. */
export function kayttajanKanavaPoikkeus(poikkeukset, kanavaId, kayttaja) {
  const rivi = (poikkeukset || []).find((p) => p?.kanavaId === kanavaId && p?.kayttaja === kayttaja);
  return rivi?.tila || null;
}

/** kuuluuKiinteaanKanavaan, poikkeukset huomioiden. */
export function kuuluuKiinteaanKanavaanPoikkeuksin(vuoro, kanavaId, kayttaja, poikkeukset) {
  const poikkeus = kayttajanKanavaPoikkeus(poikkeukset, kanavaId, kayttaja);
  if (poikkeus === 'poistettu') return false;
  if (poikkeus === 'lisatty') return true;
  return kuuluuKiinteaanKanavaan(vuoro, kanavaId);
}

/**
 * omatKiinteatKanavat, poikkeukset huomioiden. `katalogi` on kaikkiKiinteatKanavat:n
 * tulos — sitä tarvitaan pakolla lisätyn kanavan nimeen ja tyyppiin, koska pakotettu
 * kanava ei välttämättä liity käyttäjän omaan vuoroon lainkaan (esim. toisen kohteen
 * kanava johon HÄLKE on hänet erikseen lisännyt).
 */
export function omatKiinteatKanavatPoikkeuksin(vuoro, kayttaja, poikkeukset, katalogi) {
  const omat = omatKiinteatKanavat(vuoro).filter(
    (k) => kayttajanKanavaPoikkeus(poikkeukset, k.id, kayttaja) !== 'poistettu',
  );
  const omatIdt = new Set(omat.map((k) => k.id));
  const lisatyt = (poikkeukset || [])
    .filter((p) => p?.kayttaja === kayttaja && p?.tila === 'lisatty' && !omatIdt.has(p.kanavaId))
    .map((p) => (katalogi || []).find((k) => k.id === p.kanavaId))
    .filter(Boolean);
  return [...omat, ...lisatyt];
}

/** jasenetKiinteallaKanavalla, poikkeukset huomioiden. */
export function jasenetKiinteallaKanavallaPoikkeuksin(vuorot, kanavaId, poikkeukset) {
  const luonnolliset = jasenetKiinteallaKanavalla(vuorot, kanavaId);
  const poistetut = new Set(
    (poikkeukset || []).filter((p) => p?.kanavaId === kanavaId && p.tila === 'poistettu').map((p) => p.kayttaja),
  );
  const lisatyt = (poikkeukset || [])
    .filter((p) => p?.kanavaId === kanavaId && p.tila === 'lisatty')
    .map((p) => p.kayttaja);
  return [...new Set([...luonnolliset.filter((k) => !poistetut.has(k)), ...lisatyt])];
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
 * KAIKKI käyttäjät jotka ovat juuri nyt vuorossa, itse mukaan lukien — {@link dmPurkautunut}
 * tarvitsee tämän muodon (Set, ei suodateta ketään pois) eikä {@link vuorossaOlevatMuut}
 * kelpaa sellaisenaan sille (se on aina JONKUN näkökulmasta eikä yleinen kysymys).
 */
export function vuorossaOlevat(vuorot) {
  const uniikit = new Set();
  for (const v of vuorot || []) {
    if (v?.tila === 'kesken' && v.vartija) uniikit.add(v.vartija);
  }
  return uniikit;
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
