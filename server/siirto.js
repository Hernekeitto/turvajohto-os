// Tehtävän siirto vartijalta vartijalle (erä 18).
//
// Säännöt ovat täällä ja kutsut index.js:ssä, samaan tapaan kuin vuorot.js:ssä ja
// kierros.js:ssä. Tämä tiedosto ei lue eikä kirjoita levyä eikä tunne Expressiä.
//
// --- Miksi siirto ei mene saajan vuoroon ------------------------------------------
//
// Käyttötapaus on piirivartija, joka tulee ajamaan kauppakeskusvartijan kierroksen.
// Piirivartija on omassa vuorossaan TOISESSA KOHTEESSA, joten siirretty kierros ei mahdu
// hänen vuoronsa tietueeseen ilman että vuoro lakkaa vastaamasta kysymykseen missä
// vartija oli töissä.
//
// Siirto on siksi oma tietueensa, ja vartijan työlista syntyy yhdistämällä: vuoron omat
// tehtävät, hyväksytyt siirrot ja hälytykset. Lista on VARTIJAN eikä vuoron — vuoro vain
// kylvää sen (päätös 10.9.2026).
//
// --- Perehdytystä ei tarkisteta, ja sillä on hinta --------------------------------
//
// Päätös 10.9.2026: siirto ei tarkista perehdytystä. Piirivartija voi siis ajaa kierroksen
// kohteessa johon häntä ei ole perehdytetty. Vastuun ottaa siirron ANTAJA, joka on
// perehdytetty ja tuntee kohteen — ja juuri siksi molemmat nimet jäävät tietueeseen
// pysyvästi. Jälkikäteen on voitava nähdä ettei kierrosta ajanut perehdytetty henkilö.

export const VIESTIN_MAX = 500;

// --- Pakotuksen lajit ja raporttivaatimus (18.9.2026) -------------------------------
//
// `oma` on hälytyskeskuksen itse kirjoittama tehtävä ("vie kohteeseen X uusi
// vartijakutsupainike"). Se EI ole kohteen luettelossa eikä voi olla: juuri ne työt
// jotka eivät mahdu valmiiseen luetteloon ovat niitä joita päivystäjä joutuu antamaan
// kesken vuoron. Siksi sillä on nimi mutta ei luettelotunnusta.
export const LAJIT = ['tehtava', 'kierros', 'oma'];

// Mitä vartijan on kirjoitettava ennen kuin tehtävän voi merkitä tehdyksi.
//
// PÄIVYSTÄJÄ VALITSEE TÄMÄN TEHTÄVÄÄ ANTAESSAAN eikä vartija jälkikäteen. Ero on se mitä
// tehtävästä jää: "vaihda lamppu" ei tarvitse tapahtumailmoitusta, mutta "käy katsomassa
// miksi ovi oli auki" tarvitsee, eikä vartija voi tietää kumpaa päivystäjä odottaa.
//
//   tapahtumailmoitus — virallinen raportti (guardReports). Myöhemmin Tapari.
//   selvitys          — lyhyt vapaa teksti, pakollinen.
//   kommentti         — vapaa teksti, saa jäädä tyhjäksi.
export const RAPORTTILAJIT = ['tapahtumailmoitus', 'selvitys', 'kommentti'];

export const SELVITYKSEN_MIN = 10;
export const RAPORTIN_MAX = 2000;

// Mitä tiloja siirrolla voi olla. `kuitattu` on erää 19 varten (pakotus, jota ei
// hyväksytä vaan kuitataan) — se on tässä jotta tilamalli on yhdessä paikassa eikä
// puolittain kahdessa.
// `valmis` on pakotusta varten (18.9.2026): pakotettu tehtävä kuitataan nähdyksi ja
// tehdään sen jälkeen. Kaksi eri asiaa, kaksi eri tilaa — kuittaus kertoo että määräys on
// nähty, `valmis` että työ on tehty ja raportti kirjoitettu.
// `rauennut` on vuoronvaihdon jälki (19.9.2026): määräys joka oli yhä auki kun vuoro
// päättyi eikä siksi kuulu seuraavaan vuoroon. Ks. rauetaVuoronMukana.
export const TILAT = ['odottaa', 'hyvaksytty', 'hylatty', 'peruttu', 'kuitattu', 'valmis', 'rauennut'];

/**
 * Uusi siirto.
 *
 * `saajanVuoro` on saajan kesken oleva vuoro tai null. Päätös 10.9.2026: siirtää voi vain
 * vuorossa olevalle. Perustelu on ihmisen eikä koneen: vapaapäivää viettävälle vartijalle
 * ei kuulu lähettää hyväksymispyyntöä keskellä yötä.
 */
export function luoSiirto({
  antaja, saaja, laji, kohdeId, nimi, siteId, siteNimi = '',
  saajanVuoro = null, viesti = '', tapa = 'siirto', raporttilaji = null, id, nyt = Date.now(),
}) {
  if (!antaja || !saaja) return { ok: false, error: 'Antaja ja saaja vaaditaan.' };
  if (antaja === saaja) {
    // Ei virhe joka pitäisi selittää pitkästi: itselle siirtäminen ei tarkoita mitään,
    // ja se on aina näppäilyvirhe.
    return { ok: false, error: 'Tehtävää ei voi siirtää itselleen.' };
  }
  if (!LAJIT.includes(laji)) {
    return { ok: false, error: 'Tuntematon laji.' };
  }
  // Oma tehtävä ei ole siirto vaan määräys: siirtää voi vain sitä mitä itsellä on, ja
  // itse kirjoitettu työ ei ole kenenkään vuorossa ennen kuin se annetaan.
  if (laji === 'oma' && tapa !== 'pakotus') {
    return { ok: false, error: 'Oma tehtävä voidaan vain pakottaa, ei siirtää.' };
  }
  const puhdasNimi = String(nimi || '').trim().slice(0, 200);
  if (laji === 'oma' && puhdasNimi.length < 3) {
    return { ok: false, error: 'Omalle tehtävälle on kirjoitettava nimi.' };
  }
  // `oma` saa tunnuksensa kutsujalta (uuid): sillä ei ole luettelotunnusta, mutta
  // tunnuksettomuus rikkoisi päällekkäisyystarkistuksen ja kuittauksen kohdistuksen.
  if (!kohdeId || !siteId) return { ok: false, error: 'Tehtävä ja kohde vaaditaan.' };
  if (raporttilaji !== null && !RAPORTTILAJIT.includes(raporttilaji)) {
    return { ok: false, error: 'Tuntematon raporttilaji.' };
  }
  if (tapa === 'siirto' && !saajanVuoro) {
    return { ok: false, error: 'Vartija ei ole vuorossa. Siirtää voi vain vuorossa olevalle.' };
  }

  return {
    ok: true,
    siirto: {
      id,
      laji,
      kohdeId,
      // Mitä vartijan on kirjoitettava. null = ei vaatimusta (tavallinen siirto).
      raporttilaji,
      raportti: null,
      // Nimet kopioidaan samasta syystä kuin vuorossa: kohteen tai tehtävän nimen muutos
      // ei saa muuttaa mennyttä siirtoa.
      nimi: puhdasNimi,
      siteId,
      siteNimi: String(siteNimi || '').slice(0, 200),
      antaja,
      saaja,
      // Saajan vuoro siirtohetkellä. Raportointia varten: se kertoo minkä vuoron aikana
      // ylimääräinen työ tuli, eikä sitä voi päätellä jälkikäteen aikaleimoista.
      vuoroId: saajanVuoro?.id || null,
      tapa,
      tila: 'odottaa',
      viesti: String(viesti || '').trim().slice(0, VIESTIN_MAX),
      luotu: new Date(nyt).toISOString(),
      ratkaistu: null,
    },
  };
}

/**
 * Onko sama tehtävä jo siirrossa samalle vartijalle. Kaksi avointa pyyntöä samasta
 * kierroksesta olisi kaksi hyväksyttävää ilmoitusta yhdestä työstä.
 */
export function joSiirrossa(siirrot, { saaja, kohdeId, laji }) {
  return (siirrot || []).some((s) => s?.tila === 'odottaa'
    && s.saaja === saaja && s.kohdeId === kohdeId && s.laji === laji);
}

/**
 * Saajan vastaus: hyväksy tai hylkää.
 *
 * Hylkäys EI vaadi syytä. Vaadittu syy tuottaa keksittyjä syitä, eikä keksitty syy ole
 * parempi tieto kuin ei mitään.
 */
export function vastaaSiirtoon({ siirto, kayttaja, hyvaksy, nyt = Date.now() }) {
  if (!siirto) return { ok: false, error: 'Siirtoa ei löytynyt.' };
  if (siirto.saaja !== kayttaja) return { ok: false, error: 'Siirto on toiselle vartijalle.' };
  if (siirto.tila !== 'odottaa') {
    return { ok: false, error: 'Siirtoon on jo vastattu.' };
  }
  // Pakotusta ei hyväksytä eikä hylätä vaan kuitataan (erä 19). Sen erottaminen tässä on
  // olennaista: jos pakotuksen voisi hylätä, se ei olisi pakotus.
  if (siirto.tapa === 'pakotus') {
    return { ok: false, error: 'Pakotettu tehtävä kuitataan, ei hyväksytä.' };
  }
  return {
    ok: true,
    siirto: {
      ...siirto,
      tila: hyvaksy ? 'hyvaksytty' : 'hylatty',
      ratkaistu: new Date(nyt).toISOString(),
    },
  };
}

/**
 * Antaja peruu siirron. Vain odottavan voi perua: hyväksytty on jo toisen työtä, ja sen
 * pois ottaminen ilman että saaja tietää olisi juuri se tilanne jossa kierros jää
 * ajamatta kummaltakin.
 */
export function peruSiirto({ siirto, kayttaja, nyt = Date.now() }) {
  if (!siirto) return { ok: false, error: 'Siirtoa ei löytynyt.' };
  if (siirto.antaja !== kayttaja) return { ok: false, error: 'Siirto on toisen antama.' };
  if (siirto.tila !== 'odottaa') return { ok: false, error: 'Vain odottavan siirron voi perua.' };
  return { ok: true, siirto: { ...siirto, tila: 'peruttu', ratkaistu: new Date(nyt).toISOString() } };
}

// Ne tilat joissa tehtävä on SAAJAN TYÖTÄ. Hyväksytty siirto ja kuitattu pakotus ovat
// tässä sama asia: molemmat tarkoittavat että työ on nyt tämän vartijan. Ero on vain
// siinä saiko hän valita.
//
// Kuitatun puuttuminen tästä joukosta oli vika: pakotettu tehtävä katosi työlistalta
// heti kun se kuitattiin, vaikka kuittausmodaali lupasi päinvastaista.
// `valmis` on mukana (18.9.2026): tehty tehtävä on yhä tämän vartijan, ja sen on näyttävä
// hänen listallaan tehtynä. Katoaminen listalta samalla sekunnilla kun se merkitään
// tehdyksi jättäisi vartijan arvaamaan menikö merkintä läpi — sama vika kuin erässä 19,
// jossa kuitattu pakotus katosi vaikka kuittausmodaali lupasi päinvastaista.
const OMAKSI_TULLEET = new Set(['hyvaksytty', 'kuitattu', 'valmis']);

// --- VUORO RAJAA TYÖLISTAN (19.9.2026) ----------------------------------------------
//
// Vika jonka testivuoro paljasti: edellisessä vuorossa tehty pakotettu tehtävä näkyi yhä
// seuraavan vuoron listalla. Syy oli se että työlista rajattiin vain tilan mukaan, ja
// `valmis` on omaksi tullut tila — se ei kuitenkaan lakkaa olemasta valmis silloin kun
// vartija aloittaa uuden vuoron.
//
// Sääntö: UUDESSA VUOROSSA ON VAIN SE MITÄ KOHTEEN ASETUKSET SANOVAT. Vuoro kylvetään
// kohteen tehtävistä ja kierroksista (vuorot.js: aloitaVuoro), ja kaikki muu on tämän
// vuoron aikana annettua lisätyötä. Lisätyö kuuluu siihen vuoroon jonka aikana se
// annettiin, eikä se saa vuotaa seuraavaan — vuoro on se yksikkö jolta työ kysytään.
//
// `vuoroId === null` on määräys jota ei ole vielä kiinnitetty mihinkään vuoroon: pakotus
// ei vaadi saajalta vuoroa (toisin kuin siirto), joten vuorottomalle annettu tehtävä
// odottaa seuraavaa vuoroa. Se kiinnitetään vuoroon aloituksessa (kiinnitaVuoroon).
const AVOIMET = new Set(['odottaa', 'hyvaksytty', 'kuitattu']);

const RAUENNUT_VIRHE = 'Tehtävä kuului päättyneeseen vuoroon eikä ole enää voimassa.';

export function kuuluuVuoroon(siirto, vuoroId) {
  return siirto?.vuoroId === vuoroId || siirto?.vuoroId == null;
}

/**
 * Vuorottomalle annetut määräykset kiinnitetään alkavaan vuoroon.
 *
 * Ilman tätä ne olisivat ikuisesti `null`-vuorossa ja näkyisivät joka vuorossa — eli juuri
 * se vika jota vuororajaus korjaa, yhtä mutkaa pidempänä. Palauttaa VAIN muuttuneet.
 */
export function kiinnitaVuoroon(siirrot, { username, vuoroId }) {
  return (siirrot || [])
    .filter((s) => s?.saaja === username && s.vuoroId == null && AVOIMET.has(s.tila))
    .map((s) => ({ ...s, vuoroId }));
}

/**
 * Vuoron päättyessä auki jääneet määräykset raukeavat.
 *
 * RAUKEAMINEN ON MERKINTÄ EIKÄ POISTO. Pelkkä rajaus riittäisi piilottamaan ne, mutta
 * silloin kuittaamaton määräys jäisi tietokantaan ikuisesti `odottaa`-tilaan ja näyttäisi
 * hälytyskeskuksen listalla auki olevalta työltä joka ei ole kenenkään. Rauennut kertoo
 * mitä tapahtui: määräys annettiin, vuoro loppui, työtä ei tehty.
 *
 * Valmiita ei kosketa — tehty työ pysyy tehtynä, ja se rajataan pois seuraavan vuoron
 * listalta vuorotunnuksella (kuuluuVuoroon). Palauttaa VAIN muuttuneet.
 */
export function rauetaVuoronMukana(siirrot, { vuoroId, nyt = Date.now() }) {
  if (!vuoroId) return [];
  return (siirrot || [])
    .filter((s) => s?.vuoroId === vuoroId && AVOIMET.has(s.tila))
    .map((s) => ({ ...s, tila: 'rauennut', rauennut: new Date(nyt).toISOString() }));
}

/**
 * Vartijan siirrot molempiin suuntiin.
 *
 * `saapuvat` on se mihin hänen on vastattava, `lahtevat` se mitä hän odottaa toiselta.
 * Molemmat tarvitaan: antajan listalla tehtävä säilyy kunnes saaja hyväksyy (päätös
 * 10.9.2026), joten antajan on nähtävä missä pyyntö menee.
 */
export function omatSiirrot(siirrot, username, vuoroId = null) {
  const omat = (siirrot || []).filter((s) => s?.saaja === username || s?.antaja === username);
  return {
    // Pakotus EI ole saapuva siirto vaikka se odottaa vastausta: se ei ole pyyntö johon
    // vastataan vaan määräys joka kuitataan, eikä sitä saa näyttää hyväksyttävänä.
    // Kuittaamattomat pakotukset haetaan erikseen (kuittaamattomatPakotukset).
    saapuvat: omat.filter((s) => s.saaja === username && s.tila === 'odottaa' && s.tapa !== 'pakotus'),
    // Rajattu kesken olevaan vuoroon: edellisen vuoron lisätyö ei ole tämän vuoron
    // työtä, tehtynäkään. Ks. kuuluuVuoroon.
    hyvaksytyt: omat.filter((s) => s.saaja === username && OMAKSI_TULLEET.has(s.tila)
      && kuuluuVuoroon(s, vuoroId)),
    lahtevat: omat.filter((s) => s.antaja === username && s.tila === 'odottaa'),
  };
}

/**
 * Ne kohteet jotka hyväksytty siirto avaa saajalle.
 *
 * Sama peruste kuin kesken olevalla vuorolla (vuorot.js): hyväksytty siirto antaa työn,
 * ja työ ilman kohteen ohjeita, yhteystietoja ja vyöhykkeitä ei ole tehtävissä. Ilman
 * tätä siirto olisi lupaus jota ei voi lunastaa.
 */
export function siirtojenAvaamatKohteet(siirrot, username, vuoroId = null) {
  return new Set(
    (siirrot || [])
      // Sama vuororajaus kuin työlistalla: kohde aukeaa työn takia, joten se sulkeutuu
      // kun työ ei enää ole tämän vuoron työtä.
      .filter((s) => s?.saaja === username && OMAKSI_TULLEET.has(s.tila)
        && kuuluuVuoroon(s, vuoroId))
      .map((s) => s.siteId)
  );
}

// --- Pakotus (erä 19) ---------------------------------------------------------------
//
// Pääkäyttäjä tai hälytyskeskus määrää tehtävän vartijalle. Ero siirtoon on kaksi asiaa
// ja vain ne: saaja ei voi kieltäytyä, ja hänen on kuitattava.
//
// KUITTAUS EI OLE HYVÄKSYNTÄ. Sitä ei voi hylätä eikä jättää tekemättä — se on merkintä
// siitä että määräys on nähty. Määräys jonka vastaanotosta ei ole merkintää ei ole
// määräys vaan toive, ja juuri se ero on koko ominaisuuden syy.
//
// Pakotus ei myöskään vaadi saajalta vuoroa toisin kuin siirto: määräys ei ole pyyntö,
// eikä sen ehtona voi olla että saaja on sattumalta kirjautunut vuoroon.

/**
 * Saaja kuittaa pakotetun tehtävän nähdyksi.
 *
 * Vain pakotusta kuitataan. Jos siirron voisi kuitata, saaja voisi ohittaa
 * hyväksy/hylkää-valinnan kokonaan — ja siirron koko pointti on että saaja saa valita.
 */
export function kuittaaPakotus({ siirto, kayttaja, nyt = Date.now() }) {
  if (!siirto) return { ok: false, error: 'Tehtävää ei löytynyt.' };
  if (siirto.saaja !== kayttaja) return { ok: false, error: 'Tehtävä on toiselle vartijalle.' };
  if (siirto.tapa !== 'pakotus') {
    return { ok: false, error: 'Siirto hyväksytään tai hylätään, ei kuitata.' };
  }
  // Jo kuitattu on toistona haluttu lopputulos: kuittaus voi lähteä uudelleen jonosta,
  // eikä toinen kuittaus tarkoita mitään muuta kuin ensimmäinenkään.
  if (siirto.tila === 'kuitattu') return { ok: true, siirto, duplikaatti: true };
  if (siirto.tila === 'rauennut') return { ok: false, error: RAUENNUT_VIRHE };
  if (siirto.tila !== 'odottaa') return { ok: false, error: 'Tehtävään on jo vastattu.' };

  return {
    ok: true,
    siirto: { ...siirto, tila: 'kuitattu', ratkaistu: new Date(nyt).toISOString() },
  };
}

/**
 * Kuittaamattomat pakotukset. Nämä estävät muun käytön kunnes ne on kuitattu, joten
 * kutsujan on saatava ne erillään tavallisista siirroista.
 */
export function kuittaamattomatPakotukset(siirrot, username, vuoroId = null) {
  return (siirrot || []).filter(
    (s) => s?.saaja === username && s.tapa === 'pakotus' && s.tila === 'odottaa'
      // Rajattu vuoroon: edellisen vuoron kuittaamaton määräys estäisi muuten uuden
      // vuoron käytön modaalilla joka koskee mennyttä työtä. Ne raukeavat vuoron
      // päättyessä (rauetaVuoronMukana), ja vuoroton näkee kiinnittämättömät.
      && kuuluuVuoroon(s, vuoroId)
  );
}

/**
 * Vartija merkitsee pakotetun tehtävän tehdyksi ja kirjoittaa vaaditun raportin.
 *
 * KUITTAUS EI OLE SUORITUS. Pakotus kuitataan nähdyksi heti (kuittaaPakotus) ja tehdään
 * sen jälkeen. Jos nämä olisivat sama tila, "olen nähnyt määräyksen" ja "olen tehnyt sen"
 * kirjautuisivat samaksi merkinnäksi — ja juuri se ero on koko pakotuksen syy.
 *
 * Raporttivaatimus tulee tehtävästä eikä vartijalta: päivystäjä valitsi sen tehtävää
 * antaessaan (ks. RAPORTTILAJIT). Vartija ei voi vaihtaa sitä kevyempään.
 *
 * @param raporttiId Kirjoitetun tapahtumailmoituksen tunnus. Kutsuja on tarkistanut että
 *   raportti on olemassa ja tämän vartijan kirjoittama — tämä tiedosto ei lue levyä.
 */
export function merkitseValmiiksi({
  siirto, kayttaja, raporttiId = null, teksti = '', nyt = Date.now(),
}) {
  if (!siirto) return { ok: false, error: 'Tehtävää ei löytynyt.' };
  if (siirto.saaja !== kayttaja) return { ok: false, error: 'Tehtävä on toiselle vartijalle.' };
  if (siirto.tila === 'valmis') {
    // Jonon uudelleenyritys: jo tehty on toistona haluttu lopputulos.
    return { ok: true, siirto, duplikaatti: true };
  }
  // Kuittaamaton pakotus on määräys jota ei ole vielä nähty. Sen merkitseminen tehdyksi
  // ohittaisi kuittauksen kokonaan, eli poistaisi sen merkinnän jonka takia pakotus on
  // olemassa.
  if (siirto.tila === 'rauennut') return { ok: false, error: RAUENNUT_VIRHE };
  if (siirto.tila !== 'kuitattu' && siirto.tila !== 'hyvaksytty') {
    return { ok: false, error: 'Tehtävä on kuitattava ennen kuin sen voi merkitä tehdyksi.' };
  }

  const puhdasTeksti = String(teksti || '').trim().slice(0, RAPORTIN_MAX);
  const laji = siirto.raporttilaji;

  if (laji === 'tapahtumailmoitus' && !raporttiId) {
    return { ok: false, error: 'Tehtävä vaatii tapahtumailmoituksen. Kirjoita se ensin ja liitä se tähän.' };
  }
  if (laji === 'selvitys' && puhdasTeksti.length < SELVITYKSEN_MIN) {
    return { ok: false, error: 'Tehtävä vaatii lyhyen selvityksen. Kirjoita mitä teit.' };
  }

  return {
    ok: true,
    siirto: {
      ...siirto,
      tila: 'valmis',
      tehty: new Date(nyt).toISOString(),
      raportti: laji
        ? { laji, raporttiId: laji === 'tapahtumailmoitus' ? raporttiId : null, teksti: puhdasTeksti }
        : null,
    },
  };
}
