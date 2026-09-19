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
// Vapaat ryhmät, henkilökohtaiset viestit ja hätäkanavat ovat ERI ASIA — niillä ON
// eksplisiittinen osallistujalista, koska niitä ei voi laskea vuorosta. Ne tulevat
// omaan tallennettuun kokoelmaansa (guardKanavat) myöhemmässä erässä.

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
