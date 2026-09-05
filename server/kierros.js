// Vartiokierroksen suoritus: proof of presence.
//
// Kierros on tämän sovelluksen ensimmäinen toiminto jossa kirjaus on todiste siitä että
// joku OLI JOSSAIN. Sen arvo on kokonaan siinä, ettei kuittausta voi tehdä jälkikäteen
// nojatuolista. Siksi säännöt ovat palvelimella eivätkä käyttöliittymässä:
//
//  1. KIERROSTA EI VOI SULKEA VAJAANA. Jos yksikin piste on kuittaamatta, kierros
//     päättyy keskeytyksenä eikä valmiina. Vajaa kierros jonka voi merkitä valmiiksi on
//     sama asia kuin ei kierrosta lainkaan: silloin lokissa lukee "tehty" aina.
//
//  2. KESKEYTYS VAATII SYYN. Keskeytys on täysin hyväksyttävä — hälytys tuli kesken
//     kierroksen, ovi oli jäätynyt, alue oli suljettu. Mutta syy on se tieto jonka takia
//     keskeytyksestä on jotain hyötyä; ilman sitä kierros vain katoaa.
//
//  3. KUITTAUS ON PERUUTTAMATON. Kuitattua pistettä ei voi kuitata uudelleen eikä
//     kuittausta voi poistaa. Muuten aikaleima ei todista mitään.
//
//  4. PÄÄTTYNYTTÄ KIERROSTA EI AVATA UUDELLEEN. Sama peruste kuin kirjausten
//     muuttumattomuudessa (kirjaukset.js).
//
// SIJAINTI EI PAKOTA (päätös V2 = a). Skannauksen sijainti tallennetaan todisteeksi ja
// etäisyys pisteen tiedettyyn sijaintiin lasketaan, mutta kierros ei katkea siihen että
// puhelimen paikannus on epätarkka betoniseinän vieressä. Pakotus on pohjakohtainen
// asetus jota ei oletuksena käytetä — ja kun se on päällä, se torjuu skannauksen vasta
// selvästi sietorajan ulkopuolella.

export const TILAT = ['kesken', 'valmis', 'keskeytetty'];
export const PAATTYNEET = ['valmis', 'keskeytetty'];

export const onPaattynyt = (kierros) => PAATTYNEET.includes(kierros?.tila);

// Keskeytyksen syy: lyhyt mutta ei tyhjä. Yhden merkin "x" ei ole perustelu.
export const SYYN_MIN_PITUUS = 3;
export const SYYN_MAX_PITUUS = 500;
export const HUOMION_MAX_PITUUS = 2000;

// Sijaintipakotuksen oletussietoraja metreinä, kun pakotus erikseen kytketään päälle.
// GPS on ulkona hyvissä oloissa noin 5 metrin tarkkuudella, rakennuksen seinustalla
// paljon huonompi — 100 metriä on väljä mutta erottaa silti oikean pisteen väärästä.
export const OLETUS_SIETORAJA_M = 100;

// Kahden koordinaatin etäisyys metreinä (haversine). Oma toteutus eikä jaettua moduulia
// selaimen kanssa: palvelin on JS ja front TypeScript-käännöksen takana, ja tämä on
// kymmenen riviä koulukirjamatematiikkaa.
export function etaisyysMetreina(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(s))));
}

// Luo kierroksen pohjasta. Pisteet KOPIOIDAAN nimineen: pohjan muokkaaminen kesken
// kierroksen ei saa muuttaa sitä mitä kierrettiin.
export function aloitaKierros({ pohja, siteId, vartija, id, nyt = new Date() }) {
  const pisteet = pohja?.pisteet || [];
  if (pisteet.length === 0) {
    return { ok: false, error: 'Kierrospohjassa ei ole yhtään tarkistuspistettä.' };
  }
  if (pohja.arkistoitu) {
    return { ok: false, error: 'Kierrospohja on poistettu käytöstä.' };
  }
  return {
    ok: true,
    kierros: {
      id,
      siteId,
      templateId: pohja.id,
      // Nimi ja versio kopioidaan: suoritus on luettava vaikka pohja poistettaisiin.
      templateNimi: pohja.nimi,
      templateVersio: pohja.versio ?? 1,
      vartija,
      alkoi: nyt.toISOString(),
      paattyi: null,
      tila: 'kesken',
      keskeytysSyy: '',
      huomiot: '',
      pisteet: [...pisteet]
        .sort((a, b) => (a.jarjestys ?? 0) - (b.jarjestys ?? 0))
        .map((p) => ({
          pisteId: p.id,
          nimi: p.nimi,
          odotettuGps: p.gps || null,
          // Koodipakko kopioidaan kuten nimi ja sijainti: kesken kierroksen tehty
          // pohjan muokkaus ei saa muuttaa sitä, millä ehdoilla tätä kierrosta
          // kuitataan.
          vaadiKoodi: p.vaadiKoodi === true,
          kuitattu: null,
          tapa: null,
          gps: null,
          etaisyysM: null,
          huomio: '',
        })),
    },
  };
}

// Kuittaa yksi tarkistuspiste. Palauttaa uuden kierroksen tai virheen — ei muuta
// annettua oliota, jotta kutsuja voi kirjoittaa tuloksen levylle yhtenä operaationa.
export function kuittaaPiste({
  kierros, pisteId, tapa = 'kasin', gps = null, huomio = '', pakotaSijainti = false,
  sietorajaM = OLETUS_SIETORAJA_M, nyt = new Date(), toisto = false,
}) {
  if (!kierros) return { ok: false, error: 'Kierrosta ei löytynyt.' };
  const kohta = (kierros.pisteet || []).find((p) => p.pisteId === pisteId);

  // Offline-jonon uudelleenyritys. `toisto` kertoo, ettei kuittausta tehdä nyt vaan
  // toistetaan aiemmin tehtyä: silloin "on jo kuitattu" ja "kierros on jo päättynyt"
  // ovat oikeita lopputuloksia eivätkä virheitä. Ilman tätä katkeileva verkko jättäisi
  // jonoon kirjauksia jotka menivät perille mutta joiden vastaus hukkui — ja jono
  // yrittäisi niitä ikuisesti uudelleen näyttäen käyttäjälle virhettä.
  //
  // Interaktiivisella polulla toisto on false, ja silloin uudelleenkuittaus on
  // virhe: vartijan on nähtävä, ettei sama piste kuittaudu kahdesti.
  if (toisto && kohta?.kuitattu) {
    return { ok: true, kierros, duplikaatti: true };
  }

  if (onPaattynyt(kierros)) {
    return { ok: false, error: 'Kierros on jo päättynyt, eikä siihen voi enää kuitata pisteitä.' };
  }
  if (!kohta) return { ok: false, error: 'Tarkistuspiste ei kuulu tähän kierrokseen.' };
  if (kohta.kuitattu) {
    return { ok: false, error: `Tarkistuspiste "${kohta.nimi}" on jo kuitattu.` };
  }

  // Koodipakko. Palvelimella eikä käyttöliittymässä samasta syystä kuin muutkin
  // kierroksen säännöt: painikkeen piilottaminen on kohteliaisuus jonka curl ohittaa,
  // ja koko pakon tarkoitus on että kuittaus todistaa käynnin paikan päällä.
  if (kohta.vaadiKoodi && tapa === 'kasin') {
    return {
      ok: false,
      error: `Tarkistuspiste "${kohta.nimi}" kuitataan lukemalla sen koodi. Käsin kuittausta ei ole sallittu tällä pisteellä.`,
    };
  }

  const etaisyys = etaisyysMetreina(kohta.odotettuGps, gps);
  if (pakotaSijainti && kohta.odotettuGps) {
    if (etaisyys === null) {
      return { ok: false, error: 'Sijaintia ei saatu, ja tämä kierros vaatii sijainnin vahvistuksen.' };
    }
    if (etaisyys > sietorajaM) {
      return {
        ok: false,
        error: `Olet ${etaisyys} metrin päässä tarkistuspisteestä. Kuittaus vaatii enintään ${sietorajaM} metriä.`,
      };
    }
  }

  const pisteet = kierros.pisteet.map((p) => (p.pisteId === pisteId
    ? {
      ...p,
      kuitattu: nyt.toISOString(),
      tapa: tapa === 'qr' || tapa === 'viivakoodi' ? tapa : 'kasin',
      gps: gps || null,
      etaisyysM: etaisyys,
      huomio: String(huomio ?? '').slice(0, HUOMION_MAX_PITUUS),
    }
    : p));
  return { ok: true, kierros: { ...kierros, pisteet } };
}

export const kuittaamattomat = (kierros) => (kierros?.pisteet || []).filter((p) => !p.kuitattu);

// Päättää kierroksen. Tässä on erän tärkein sääntö: 'valmis' vaatii jokaisen pisteen.
export function paataKierros({ kierros, tila, syy = '', huomiot = '', nyt = new Date(), toisto = false }) {
  if (!kierros) return { ok: false, error: 'Kierrosta ei löytynyt.' };
  // Jonon uudelleenyritys: jos kierros on jo päättynyt SAMAAN tilaan johon sitä nyt
  // pyydetään, pyyntö on toisto ja lopputulos on jo olemassa. Eri tilaan päättäminen on
  // sen sijaan virhe myös toistona — päättynyttä kierrosta ei avata uudelleen.
  if (toisto && kierros.tila === tila) {
    return { ok: true, kierros, duplikaatti: true };
  }
  if (onPaattynyt(kierros)) {
    return { ok: false, error: 'Kierros on jo päättynyt.' };
  }
  if (tila !== 'valmis' && tila !== 'keskeytetty') {
    return { ok: false, error: 'Kierros päätetään joko valmiina tai keskeytettynä.' };
  }

  if (tila === 'valmis') {
    const puuttuvat = kuittaamattomat(kierros);
    if (puuttuvat.length > 0) {
      // Virheteksti nimeää puuttuvat pisteet: "3 pistettä puuttuu" saa vartijan
      // etsimään listasta, ja nimet kertovat heti mihin pitää palata.
      const nimet = puuttuvat.slice(0, 5).map((p) => p.nimi).join(', ');
      const loput = puuttuvat.length > 5 ? ` ja ${puuttuvat.length - 5} muuta` : '';
      return {
        ok: false,
        error: `Kierrosta ei voi merkitä valmiiksi: kuittaamatta ${nimet}${loput}. Jos kierrosta ei voi tehdä loppuun, keskeytä se ja kirjaa syy.`,
      };
    }
  }

  const puhdasSyy = String(syy ?? '').trim().slice(0, SYYN_MAX_PITUUS);
  if (tila === 'keskeytetty' && puhdasSyy.length < SYYN_MIN_PITUUS) {
    return { ok: false, error: 'Keskeytys vaatii syyn. Kirjoita lyhyesti miksi kierros jäi kesken.' };
  }

  return {
    ok: true,
    kierros: {
      ...kierros,
      tila,
      paattyi: nyt.toISOString(),
      keskeytysSyy: tila === 'keskeytetty' ? puhdasSyy : '',
      huomiot: String(huomiot ?? '').slice(0, HUOMION_MAX_PITUUS),
    },
  };
}

// Kierroksen kooste listanäkymää varten. Sama laskenta molemmilla puolilla olisi kahdessa
// paikassa eri, joten se tehdään kerran täällä ja lähetetään mukana.
export const kooste = (kierros) => {
  const pisteet = kierros?.pisteet || [];
  const kuitatut = pisteet.filter((p) => p.kuitattu).length;
  return { kuitatut, yhteensa: pisteet.length };
};
