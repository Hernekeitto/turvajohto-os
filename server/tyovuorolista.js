// Työvuorosuunnittelun säännöt (erät 1–3, aloitettu 10.10.2026).
//
// Samaan tapaan kuin vuorot.js: säännöt ovat täällä ja kutsut index.js:ssä, eikä tämä
// tiedosto lue eikä kirjoita levyä eikä tunne Expressiä.
//
// Erä 1 määrittelee työaikasäännöt asetuksina ja suunnittelujaksot. Erä 3 lisää
// rajoitetarkistukset (lepoajat, tunnit, vuorojen pituudet) samaan tiedostoon.
//
// --- Lähde: Vartiointialan työehtosopimus 1.4.2025–31.3.2028 -----------------------
//
// Jokainen oletusarvo on TES:n arvo, ja pykälä on kirjattu viereen. Iso osa niistä on
// paikallisesti sovittavissa (TES 51 §), joten ne ovat asetuksia eivätkä vakioita. Kolme
// sääntöä ei ole sovittavissa paikallisesti, ja ne ovat siksi vakioita (ks. alla).
//
// --- Käyttäjän päätökset 10.10.2026 --------------------------------------------------
//
// 1. Listat laatii oma Vuorosuunnittelija-taso (server/roles.js).
// 2. Suunnittelujakso noudattaa TES:ää: kolmen viikon jakso, lista kolmeksi tai kuudeksi
//    viikoksi.
// 3. Vartijakortin vanhenemisesta varoitetaan 45 päivää etukäteen. Varoitus EI ole TES:n
//    sääntö vaan yrityksen oma, joten siitä ei vaadita paikallista sopimusta.
// 4. Työvoimareservi ei saa vuoroja listaan vaan kuittaa tarjotun vuoron (erä 5).

// TES 9 §: kolmen viikon jakso. Ei asetus: koko ylityö- ja tasoittumislaskenta nojaa
// siihen, eikä sitä voi sopia paikallisesti toisin.
export const JAKSON_PITUUS_VK = 3;
// TES 9 §: kuukausipalkkaisen säännöllinen työaika jaksossa, ja tasoittumisjärjestelyssä
// yhden jakson enimmäismäärä (kahden peräkkäisen jakson yhteismäärä on 2 × 120 h).
export const SAANNOLLINEN_H = 120;
export const JAKSON_ENIMMAIS_H = 128;
// TES 10 §: lista laaditaan "kolme tai kuusi viikkoa" kerrallaan.
export const LISTAN_PITUUDET_VK = [3, 6];

// Asetukset kuvauksineen. `tes` on TES:n arvo; jos tallennettu arvo eroaa siitä,
// tallennus vaatii paikallisen sopimuksen kirjauksen (ks. tarkistaAsetukset).
// `tes: null` tarkoittaa ettei asetus ole TES:n sääntö.
//
// min ja max ovat syötteen järkevyysrajat, EIVÄT lain tulkinta: ne estävät näppäilyvirheen
// (100 tunnin lepo) mutta eivät kerro mitä paikallisesti saa sopia.
export const ASETUKSET = {
  listanPituusVk: {
    nimi: 'Työvuorolistan pituus', yksikko: 'vk', tes: 3, pykala: '10 §',
    sallitut: LISTAN_PITUUDET_VK, eiPoikkeama: true,
  },
  julkaisuVkEnnen: {
    nimi: 'Listan julkaisu viimeistään ennen jakson alkua', yksikko: 'vk', tes: 2, pykala: '10 §',
    min: 1, max: 6,
  },
  vuoronMinH: { nimi: 'Työvuoron vähimmäispituus', yksikko: 'h', tes: 5, pykala: '10 §', min: 1, max: 12 },
  vuoronMaxH: { nimi: 'Työvuoron enimmäispituus', yksikko: 'h', tes: 12, pykala: '10 §', min: 4, max: 16 },
  poikkeavanMaxH: {
    nimi: 'Poikkeavan työvuoron enimmäispituus', yksikko: 'h', tes: 16, pykala: '10 §', min: 8, max: 24,
  },
  yorajoitus: {
    nimi: 'Vuoro ei ala eikä pääty klo 00–06', yksikko: null, tes: true, pykala: '10 §', totuusarvo: true,
  },
  vuorokausilepoH: { nimi: 'Vuorokausilepo', yksikko: 'h', tes: 10, pykala: '15 §', min: 7, max: 24 },
  viikkovapaaH: { nimi: 'Viikoittainen vapaa-aika', yksikko: 'h', tes: 30, pykala: '16 §', min: 24, max: 72 },
  viikkovapaaMinH: {
    nimi: 'Viikkovapaa vähintään (14 vrk:n keskiarvoa käytettäessä)', yksikko: 'h', tes: 24, pykala: '16 §',
    min: 12, max: 72,
  },
  vuorojaVapaidenValissa: {
    nimi: 'Työvuoroja enintään kahden viikkovapaan välissä', yksikko: 'kpl', tes: 9, pykala: '16 §', min: 3, max: 14,
  },
  pitkaViikonloppuVk: {
    nimi: 'Pitkä viikonloppu (pe 18 – ma 06) vähintään', yksikko: 'vk välein', tes: 4, pykala: '16 §', min: 2, max: 12,
  },
  korttiVaroitusPv: {
    nimi: 'Varoitus vartijakortin vanhenemisesta', yksikko: 'pv ennen', tes: null, oletus: 45, min: 0, max: 180,
  },
};

const ASETUSAVAIMET = Object.keys(ASETUKSET);

export function oletusarvo(avain) {
  const a = ASETUKSET[avain];
  return a.tes === null ? a.oletus : a.tes;
}

export const OLETUKSET = Object.freeze(Object.fromEntries(ASETUSAVAIMET.map((k) => [k, oletusarvo(k)])));

const PAIKALLISEN_SOPIMUKSEN_MAX = 1000;

// --- Päivämäärät --------------------------------------------------------------------
//
// Suunnittelu käsittelee kalenteripäiviä eikä hetkiä, joten päivät ovat 'YYYY-MM-DD'
// -merkkijonoja ja laskenta tehdään UTC-keskiyöllä. Paikallisella ajalla laskettuna
// kesäaikaan siirtyminen tekisi yhdestä päivästä 23 tuntia, ja jakson raja liukuisi.

const PV_MS = 24 * 60 * 60 * 1000;

export function paivaksi(pvm) {
  const osuma = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(pvm ?? ''));
  if (!osuma) return null;
  const aika = Date.UTC(Number(osuma[1]), Number(osuma[2]) - 1, Number(osuma[3]));
  const d = new Date(aika);
  // Date.UTC hyväksyy 2026-02-31 ja siirtää sen maaliskuulle. Tarkistus kertoo ettei
  // päivää ole olemassa.
  if (d.getUTCMonth() !== Number(osuma[2]) - 1 || d.getUTCDate() !== Number(osuma[3])) return null;
  return aika;
}

export function pvmMerkkijonoksi(aika) {
  return new Date(aika).toISOString().slice(0, 10);
}

export function lisaaPaivia(pvm, n) {
  const aika = paivaksi(pvm);
  return aika === null ? null : pvmMerkkijonoksi(aika + n * PV_MS);
}

// Paikallinen kalenteripäivä hetkestä. Suunnittelijalle "tänään" on Suomen päivä eikä
// UTC:n, joka vaihtuu kolme tuntia myöhässä.
export function tamaPaiva(nyt = new Date()) {
  const k = (n) => String(n).padStart(2, '0');
  return `${nyt.getFullYear()}-${k(nyt.getMonth() + 1)}-${k(nyt.getDate())}`;
}

// TES 11 §: työviikko alkaa maanantaina. getUTCDay: 0 = sunnuntai, 1 = maanantai.
export function onMaanantai(pvm) {
  const aika = paivaksi(pvm);
  return aika !== null && new Date(aika).getUTCDay() === 1;
}

// --- Asetukset ----------------------------------------------------------------------

/**
 * Tallennettu tietue luettavaksi asetuksiksi. Puuttuva tai kelvoton arvo korvataan TES:n
 * oletuksella: tämä on lukupolku, ja sen pitää aina tuottaa käyttökelpoiset säännöt —
 * myös silloin kun tietue on kirjoitettu käsin tai vanhalla versiolla.
 *
 * `jaksotAlkaen` on poikkeus: sille ei ole oletusta, koska yrityksen jaksorytmiä ei voi
 * arvata. Ilman sitä suunnittelu ei ala (jaksot() palauttaa tyhjän).
 */
export function normalisoiAsetukset(tietue) {
  const t = tietue && typeof tietue === 'object' ? tietue : {};
  const tulos = {};
  for (const avain of ASETUSAVAIMET) {
    const kelpaa = arvoKelpaa(avain, t[avain]);
    tulos[avain] = kelpaa ? t[avain] : oletusarvo(avain);
  }
  tulos.jaksotAlkaen = onMaanantai(t.jaksotAlkaen) ? t.jaksotAlkaen : null;
  tulos.paikallinenSopimus = typeof t.paikallinenSopimus === 'string' ? t.paikallinenSopimus : '';
  return tulos;
}

function arvoKelpaa(avain, arvo) {
  const a = ASETUKSET[avain];
  if (a.totuusarvo) return typeof arvo === 'boolean';
  if (typeof arvo !== 'number' || !Number.isFinite(arvo)) return false;
  if (a.sallitut) return a.sallitut.includes(arvo);
  // Puolet tunnit sallitaan (esim. 10,5 h lepo), tarkempia ei: puolen minuutin lepo on
  // näppäilyvirhe eikä sopimus.
  if (Math.round(arvo * 2) !== arvo * 2) return false;
  return arvo >= a.min && arvo <= a.max;
}

/**
 * Mitkä asetukset poikkeavat TES:stä. Palauttaa avaimet. Asetus jolla ei ole TES-arvoa
 * (korttivaroitus) ei voi poiketa, eikä listan pituus: kumpikin sallittu pituus on TES:n
 * oma vaihtoehto.
 */
export function tesPoikkeamat(asetukset) {
  return ASETUSAVAIMET.filter((k) => {
    const a = ASETUKSET[k];
    return a.tes !== null && !a.eiPoikkeama && asetukset[k] !== a.tes;
  });
}

/**
 * Pääkäyttäjän tallennus. Palauttaa { ok, asetukset } tai { ok: false, virheet }.
 *
 * Toisin kuin normalisoiAsetukset, tämä EI korvaa kelvotonta arvoa oletuksella:
 * tallennuksessa hiljainen korjaus tarkoittaisi, että käyttäjä luulee asettaneensa jotain
 * mitä järjestelmä ei käytä.
 *
 * TES:stä poikkeava arvo vaatii paikallisen sopimuksen kirjauksen (TES 51 §). Vaatimus on
 * kirjaus eikä sopimuksen tarkistus — järjestelmä ei voi tietää onko sopimus olemassa.
 * Se voi kuitenkin estää sen, että TES:n vastainen sääntö syntyy vahingossa tai ilman
 * että kukaan joutuu sanomaan mihin se perustuu.
 */
export function tarkistaAsetukset(syote) {
  const s = syote && typeof syote === 'object' ? syote : {};
  const virheet = [];
  const asetukset = {};

  for (const avain of ASETUSAVAIMET) {
    const arvo = s[avain] === undefined ? oletusarvo(avain) : s[avain];
    if (!arvoKelpaa(avain, arvo)) {
      const a = ASETUKSET[avain];
      virheet.push({
        kentta: avain,
        viesti: a.totuusarvo ? `${a.nimi}: arvo puuttuu.`
          : a.sallitut ? `${a.nimi}: sallitut arvot ${a.sallitut.join(' tai ')} ${a.yksikko}.`
            : `${a.nimi}: arvon on oltava ${a.min}–${a.max} ${a.yksikko} (puolen tunnin tarkkuudella).`,
      });
      continue;
    }
    asetukset[avain] = arvo;
  }

  if (s.jaksotAlkaen === null || s.jaksotAlkaen === undefined || s.jaksotAlkaen === '') {
    asetukset.jaksotAlkaen = null;
  } else if (!onMaanantai(s.jaksotAlkaen)) {
    virheet.push({ kentta: 'jaksotAlkaen', viesti: 'Jaksojen alkupäivän on oltava maanantai (TES 11 §).' });
  } else {
    asetukset.jaksotAlkaen = s.jaksotAlkaen;
  }

  // Ristiintarkistukset vain jos yksittäiset arvot kelpasivat — muuten sama virhe
  // ilmoitettaisiin kahdesti eri sanoin.
  if (virheet.length === 0) {
    if (asetukset.vuoronMinH > asetukset.vuoronMaxH) {
      virheet.push({ kentta: 'vuoronMinH', viesti: 'Vähimmäispituus ei voi olla enimmäispituutta suurempi.' });
    }
    if (asetukset.poikkeavanMaxH < asetukset.vuoronMaxH) {
      virheet.push({
        kentta: 'poikkeavanMaxH', viesti: 'Poikkeavan vuoron enimmäispituus ei voi olla tavallista lyhyempi.',
      });
    }
    if (asetukset.viikkovapaaMinH > asetukset.viikkovapaaH) {
      virheet.push({
        kentta: 'viikkovapaaMinH', viesti: 'Viikkovapaan vähimmäismäärä ei voi olla viikkovapaata suurempi.',
      });
    }
    if (asetukset.julkaisuVkEnnen > asetukset.listanPituusVk) {
      // Ei TES-sääntö vaan johdonmukaisuus: muuten seuraava lista pitäisi julkaista ennen
      // kuin edellinen on edes alkanut, eikä määräaikanäkymä enää kertoisi mitään järkevää.
      virheet.push({
        kentta: 'julkaisuVkEnnen', viesti: 'Julkaisuaika ei voi olla listan pituutta pidempi.',
      });
    }
  }

  const sopimus = typeof s.paikallinenSopimus === 'string' ? s.paikallinenSopimus.trim() : '';
  if (sopimus.length > PAIKALLISEN_SOPIMUKSEN_MAX) {
    virheet.push({ kentta: 'paikallinenSopimus', viesti: `Kirjaus on liian pitkä (enintään ${PAIKALLISEN_SOPIMUKSEN_MAX} merkkiä).` });
  }
  // Kun kaikki arvot noudattavat TES:ää, kirjaus tyhjennetään. Muuten vanha kirjaus jäisi
  // kenttään ja kattaisi myöhemmin hiljaa uuden, eri asiaa koskevan poikkeaman. Vanha
  // teksti säilyy auditlokissa (index.js kirjaa muuttuneet kentät).
  const poikkeaa = virheet.length === 0 && tesPoikkeamat(asetukset).length > 0;
  asetukset.paikallinenSopimus = poikkeaa ? sopimus : '';

  if (poikkeaa && sopimus.length < 3) {
    virheet.push({
      kentta: 'paikallinenSopimus',
      viesti: 'TES:stä poikkeavat arvot vaativat kirjauksen paikallisesta sopimuksesta (TES 51 §): '
        + 'kuka sopi, milloin ja mistä.',
    });
  }

  return virheet.length ? { ok: false, virheet } : { ok: true, asetukset };
}

// --- Jaksot -------------------------------------------------------------------------

/**
 * Kolmen viikon jakso, johon päivä kuuluu. Jakso on puoliavoin [alku, loppu): `loppu` on
 * seuraavan jakson ensimmäinen päivä, ja `viimeinen` on näytettävä päättymispäivä.
 *
 * Toimii myös ennen ankkuria: jaksot jatkuvat taaksepäin samassa rytmissä. Ilman sitä
 * listan voisi laatia vain ankkurin jälkeen, ja ankkurin siirtäminen eteenpäin rikkoisi
 * menneiden jaksojen tarkastelun.
 */
export function jaksoPaivalle(jaksotAlkaen, pvm) {
  const ankkuri = paivaksi(jaksotAlkaen);
  const paiva = paivaksi(pvm);
  if (ankkuri === null || paiva === null || !onMaanantai(jaksotAlkaen)) return null;
  const pituus = JAKSON_PITUUS_VK * 7;
  const erotus = Math.round((paiva - ankkuri) / PV_MS);
  const numero = Math.floor(erotus / pituus);
  const alku = pvmMerkkijonoksi(ankkuri + numero * pituus * PV_MS);
  return {
    numero,
    alku,
    loppu: lisaaPaivia(alku, pituus),
    viimeinen: lisaaPaivia(alku, pituus - 1),
  };
}

/**
 * Työvuorolistat päivästä eteenpäin: ensimmäinen on se lista johon `alkaen` kuuluu.
 *
 * Kuuden viikon lista kattaa kaksi jaksoa, ja listat alkavat parillisesta jaksosta
 * ankkurista laskien. Muuten sama jakso voisi kuulua kahteen eri listaan sen mukaan,
 * mistä päivästä laskeminen aloitettiin.
 *
 * `julkaistavaViimeistaan` on TES 10 §:n määräaika. Paikallisesti sovittu lyhyempi aika
 * tulee asetuksesta.
 */
export function listat(asetukset, alkaen, lukumaara = 4) {
  if (!asetukset?.jaksotAlkaen) return [];
  const ensimmainen = jaksoPaivalle(asetukset.jaksotAlkaen, alkaen);
  if (!ensimmainen) return [];
  const jaksojaListassa = asetukset.listanPituusVk / JAKSON_PITUUS_VK;
  // Pyöristys alaspäin myös negatiivisilla numeroilla: lista -1 alkaa jaksosta -2.
  const ensimmaisenListanJakso = Math.floor(ensimmainen.numero / jaksojaListassa) * jaksojaListassa;

  const tulos = [];
  for (let i = 0; i < lukumaara; i++) {
    const jaksot = [];
    for (let j = 0; j < jaksojaListassa; j++) {
      const numero = ensimmaisenListanJakso + i * jaksojaListassa + j;
      const alku = lisaaPaivia(asetukset.jaksotAlkaen, numero * JAKSON_PITUUS_VK * 7);
      jaksot.push(jaksoPaivalle(asetukset.jaksotAlkaen, alku));
    }
    const alku = jaksot[0].alku;
    tulos.push({
      alku,
      loppu: jaksot[jaksot.length - 1].loppu,
      viimeinen: jaksot[jaksot.length - 1].viimeinen,
      jaksot,
      julkaistavaViimeistaan: lisaaPaivia(alku, -asetukset.julkaisuVkEnnen * 7),
    });
  }
  return tulos;
}

// --- Kohteen miehitys (erä 2) -------------------------------------------------------
//
// Ylläpito kertoo kohteen vuorotyypille, minä viikonpäivinä ja kuinka monella
// vartijalla sitä tehdään (käyttäjän päätös 10.10.2026: "mihin aikaan vartijoille
// suunnitellaan vuoroja kohteelle"). Tästä syntyvät listan avoimet vuorot.
//
// Miehitys on VUOROTYYPIN kenttä eikä erillinen tietue: vuorotyyppi kertoo jo kellonajat,
// ja suunniteltu vuoro on täsmälleen se vuoro johon vartija myöhemmin kirjautuu. Silloin
// perehdytys tarkistetaan samalla id:llä suunnittelussa ja aloituksessa.
//
//   suunnittelu: {
//     maarat: [ma, ti, ke, to, pe, la, su]   vartijoita kunakin viikonpäivänä, 0 = ei vuoroa
//     alkaen: 'YYYY-MM-DD' | puuttuu        ensimmäinen päivä; puuttuva = ei alarajaa
//     asti:   'YYYY-MM-DD' | puuttuu        viimeinen päivä; puuttuva = toistaiseksi
//     tesPerustelu: string                  pakollinen jos vuoro poikkeaa TES 10 §:stä
//   }
//
// Muutos ajassa ("1.11. alkaen kaksi vartijaa") tehdään uutena vuorotyyppinä, jolle
// annetaan alkupäivä, ja vanhalle loppupäivä. Yksi jakso per vuorotyyppi pitää mallin
// yksinkertaisena ja vastaa sitä miten muutos oikeasti tapahtuu: uusi sopimus, uusi vuoro.

export const VIIKONPAIVAT = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'];
const MAX_VARTIJOITA = 20;
const PERUSTELUN_MAX = 500;
const YORAJA_MIN = 6 * 60;
const VRK_MIN = 24 * 60;

function kellonaika(hhmm) {
  const osuma = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!osuma) return null;
  const t = Number(osuma[1]);
  const m = Number(osuma[2]);
  return t > 23 || m > 59 ? null : t * 60 + m;
}

const kaksi = (n) => String(n).padStart(2, '0');

/**
 * Vuoron kesto minuutteina. Puolenyön ylittävä vuoro (22–06) on 8 h, ja sama alku ja loppu
 * on vuorokauden mittainen vuoro — sama tulkinta kuin vuorot.js:ssä.
 */
export function vuoronKestoMin(alkaa, paattyy) {
  const a = kellonaika(alkaa);
  const p = kellonaika(paattyy);
  if (a === null || p === null) return null;
  return p > a ? p - a : p + VRK_MIN - a;
}

// TES 10 §: "Työvuoro ei saa alkaa eikä päättyä kello 24.00–06.00 välisenä aikana."
//
// TULKINTA (10.10.2026, vahvistettava): rajat itse ovat sallittuja eli vuoro voi päättyä
// klo 24.00 ja alkaa klo 06.00. Muuten tavallinen iltavuoro 16–24 ja aamuvuoro 06–14
// olisivat kumpikin poikkeamia, eikä se voi olla määräyksen tarkoitus.
function yoaikana(min) {
  return min > 0 && min < YORAJA_MIN;
}

/**
 * Mitkä TES 10 §:n säännöt vuorotyyppi rikkoo. Palauttaa koodit:
 *   'lyhyt'  alle vähimmäispituuden
 *   'pitka'  yli tavallisen enimmäispituuden (poikkeava vuoro)
 *   'yo'     alkaa tai päättyy klo 00–06
 *
 * Yli poikkeavan vuoron enimmäispituuden menevä vuoro ei ole poikkeama vaan virhe, eikä se
 * siksi ole tässä listassa (ks. tarkistaMiehitys).
 */
export function vuoronTesPoikkeamat(vuorotyyppi, asetukset) {
  const kesto = vuoronKestoMin(vuorotyyppi?.alkaa, vuorotyyppi?.paattyy);
  if (kesto === null) return [];
  const tulos = [];
  if (kesto < asetukset.vuoronMinH * 60) tulos.push('lyhyt');
  if (kesto > asetukset.vuoronMaxH * 60 && kesto <= asetukset.poikkeavanMaxH * 60) tulos.push('pitka');
  if (asetukset.yorajoitus
    && (yoaikana(kellonaika(vuorotyyppi.alkaa)) || yoaikana(kellonaika(vuorotyyppi.paattyy)))) {
    tulos.push('yo');
  }
  return tulos;
}

export const POIKKEAMAN_TEKSTI = {
  lyhyt: 'vuoro on lyhyempi kuin työaikasääntöjen vähimmäispituus',
  pitka: 'vuoro on pidempi kuin työaikasääntöjen tavallinen enimmäispituus (poikkeava työvuoro)',
  yo: 'vuoro alkaa tai päättyy klo 00–06',
};

/** Onko vuorotyypillä miehitystä eli tuottaako se yhtään suunniteltavaa vuoroa. */
export function onMiehitys(vuorotyyppi) {
  const m = vuorotyyppi?.suunnittelu?.maarat;
  return Array.isArray(m) && m.some((n) => Number(n) > 0);
}

/**
 * Vuorotyypin miehityksen tarkistus tallennuksessa. Palauttaa virheet tekstinä.
 *
 * TES:stä poikkeava vuoro (liian lyhyt, poikkeavan pitkä tai yöllä alkava/päättyvä) EI
 * ole virhe, koska TES sallii ne perustellusta syystä ja paikallisesti sopien. Pysyvä
 * poikkeus vaatii kuitenkin kirjatun perustelun — sama periaate kuin työaikasäännöissä.
 *
 * Vain miehitetty vuorotyyppi tarkistetaan: kellonajaton lisävuoro ja vanhat vuorotyypit
 * ilman suunnittelua ovat edelleen sallittuja, koska niitä ei suunnitella listaan.
 */
export function tarkistaMiehitys(vuorotyyppi, asetukset) {
  const s = vuorotyyppi?.suunnittelu;
  if (s === undefined || s === null) return [];
  const nimi = vuorotyyppi?.nimi || 'Nimetön vuoro';
  const virheet = [];

  if (!Array.isArray(s.maarat) || s.maarat.length !== 7
    || !s.maarat.every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_VARTIJOITA)) {
    return [`${nimi}: vartijamäärät on annettava jokaiselle viikonpäivälle (0–${MAX_VARTIJOITA}).`];
  }
  const alkaenOk = !s.alkaen || paivaksi(s.alkaen) !== null;
  const astiOk = !s.asti || paivaksi(s.asti) !== null;
  if (!alkaenOk) virheet.push(`${nimi}: alkupäivä ei kelpaa.`);
  if (!astiOk) virheet.push(`${nimi}: loppupäivä ei kelpaa.`);
  if (s.alkaen && s.asti && alkaenOk && astiOk && s.asti < s.alkaen) {
    virheet.push(`${nimi}: loppupäivä on ennen alkupäivää.`);
  }
  if (typeof s.tesPerustelu === 'string' && s.tesPerustelu.length > PERUSTELUN_MAX) {
    virheet.push(`${nimi}: perustelu on liian pitkä (enintään ${PERUSTELUN_MAX} merkkiä).`);
  }
  if (!onMiehitys(vuorotyyppi)) return virheet;

  const kesto = vuoronKestoMin(vuorotyyppi.alkaa, vuorotyyppi.paattyy);
  if (kesto === null) {
    virheet.push(`${nimi}: suunniteltavalla vuorolla on oltava alkamis- ja päättymisaika.`);
    return virheet;
  }
  if (kesto > asetukset.poikkeavanMaxH * 60) {
    virheet.push(`${nimi}: vuoro on pidempi kuin poikkeavan työvuoron enimmäispituus `
      + `${asetukset.poikkeavanMaxH} h (TES 10 §).`);
  }
  const poikkeamat = vuoronTesPoikkeamat(vuorotyyppi, asetukset);
  if (poikkeamat.length && String(s.tesPerustelu || '').trim().length < 3) {
    virheet.push(`${nimi}: ${poikkeamat.map((p) => POIKKEAMAN_TEKSTI[p]).join(' ja ')}. `
      + 'Pysyvä poikkeus vaatii perustelun (TES 10 § ja 51 §).');
  }
  return virheet;
}

/**
 * Kohteiden suunnitellut vuorot aikavälillä [alku, loppu). Jokainen vartijapaikka on oma
 * rivinsä: kahden vartijan yövuoro on kaksi riviä, koska listalle sijoitetaan ihmisiä
 * eikä vuoroja.
 *
 * Vuoro kuuluu sille päivälle jona se ALKAA. Perjantain yövuoro 22–06 on perjantain vuoro,
 * vaikka se päättyy lauantaina — muuten vuoro katoaisi listan rajalta tai näkyisi kahdesti.
 *
 * Rivin `alkaa` ja `paattyy` ovat paikallisia aikoja ilman aikavyöhykettä
 * ('2026-10-05T22:00'). Lepoaikojen laskenta (erä 3) tehdään niillä minuutteina, ja
 * kesäajan vaihtumisyön tunnin ero hyväksytään tietoisesti: se on kerran vuodessa ja
 * tunnin suuntaan, eikä se muuta yhtään vuoroa sallitusta kielletyksi kuin rajalla.
 */
export function suunnitellutVuorot(kohteet, alku, loppu) {
  const a = paivaksi(alku);
  const l = paivaksi(loppu);
  if (a === null || l === null || l <= a) return [];
  const tulos = [];
  for (const kohde of kohteet || []) {
    if (!kohde || kohde.archived) continue;
    for (const v of kohde.vuorotyypit || []) {
      if (!v || v.arkistoitu || !onMiehitys(v)) continue;
      const kesto = vuoronKestoMin(v.alkaa, v.paattyy);
      if (kesto === null) continue;
      const s = v.suunnittelu;
      const alkuMin = kellonaika(v.alkaa);
      for (let aika = a; aika < l; aika += PV_MS) {
        const pvm = pvmMerkkijonoksi(aika);
        if (s.alkaen && pvm < s.alkaen) continue;
        if (s.asti && pvm > s.asti) continue;
        // getUTCDay: 0 = su. Muunnetaan niin että 0 = ma.
        const viikonpaiva = (new Date(aika).getUTCDay() + 6) % 7;
        const maara = Number(s.maarat[viikonpaiva]) || 0;
        if (maara === 0) continue;
        const loppuMin = alkuMin + kesto;
        const loppuPvm = lisaaPaivia(pvm, Math.floor(loppuMin / VRK_MIN));
        const loppuKlo = loppuMin % VRK_MIN;
        for (let paikka = 1; paikka <= maara; paikka++) {
          tulos.push({
            id: `${kohde.id}:${v.id}:${pvm}:${paikka}`,
            siteId: kohde.id,
            siteNimi: kohde.name || '',
            vuorotyyppiId: v.id,
            vuoroNimi: v.nimi || '',
            pvm,
            paikka,
            alkaa: `${pvm}T${kaksi(Math.floor(alkuMin / 60))}:${kaksi(alkuMin % 60)}`,
            paattyy: `${loppuPvm}T${kaksi(Math.floor(loppuKlo / 60))}:${kaksi(loppuKlo % 60)}`,
            kestoMin: kesto,
          });
        }
      }
    }
  }
  return tulos.sort((x, y) => (x.alkaa < y.alkaa ? -1 : x.alkaa > y.alkaa ? 1 : x.id < y.id ? -1 : 1));
}
