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
