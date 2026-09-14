// Kalustopankki: mitä yrityksellä on ja missä se on juuri nyt (erä 20).
//
// TÄMÄ EI OLE KOHTEEN REKISTERI VAAN YRITYKSEN. Ero avaimet.js:ään on koko ominaisuuden
// syy: avain kuuluu yhdelle kohteelle eikä siirry mihinkään, mutta takki, patukka ja
// pakettiauto kiertävät kohteelta toiselle ja vartijalta toiselle. Kohdekohtainen
// rekisteri ei osaa vastata kysymykseen "missä TJ-ASU-0117 on", koska se ei tiedä
// muista kohteista mitään.
//
// Tiedosto ei lue eikä kirjoita levyä eikä tunne Expressiä — samoin kuin avaimet.js,
// siirto.js ja vuorot.js. Kutsut ovat index.js:ssä.
//
// --- VIISI SÄÄNTÖÄ -----------------------------------------------------------------
//
//  1. ESINE ON YHDESSÄ PAIKASSA. Sijoitus on yksi kenttä eikä lista. Kaksi sijoitusta
//     tarkoittaisi että rekisteri ei kerro missä esine on, ja se on ainoa asia jota
//     siltä kysytään.
//
//  2. HISTORIA ON LISÄYSTÄ, EI MUOKKAUSTA. Jokainen siirto, pyyntö ja tilamuutos jää
//     riviksi. Luovutusketju jonka rivejä voi muuttaa jälkikäteen ei kelpaa
//     todisteeksi siitä kenelle voimankäyttöväline on annettu.
//
//  3. ASE EI SYNNY ILMAN LUPATIETOJA. Ampuma-aseen hallussapito on luvanvaraista, ja
//     tietue ilman lupanumeroa ja sarjanumeroa näyttäisi kirjanpidolta olematta sitä.
//     Tämä on syy siihen miksi ase on oma lajinsa eikä voimankäyttöväline.
//
//  4. HENKILÖKOHTAINEN ESINE MENEE VAIN HENKILÖLLE. Vartijan tunnus kohteen varastossa
//     on tunnus jota kuka tahansa voi käyttää.
//
//  5. PYYNTÖ EI OHITA PÄÄTÖSTÄ. Vuoroesimies pyytää, pääkäyttäjä jyvittää. Pyyntö on
//     esineessä ja avoimia on kerrallaan yksi — kaksi rinnakkaista pyyntöä samaan
//     esineeseen johtaisi siihen että toinen hyväksytään tyhjään.

// Lajit ja niiden tunnuskoodit. Koodi on tunnisteen keskiosa (TJ-AVA-0001) eikä sitä saa
// muuttaa jälkikäteen: tunnus on painettu kilpimerkkiin, ja kilpimerkki on kentällä.
//
// HUOM: sama lista on selainpuolella (src/guard/kalusto/lajit.ts) nimineen, ikoneineen ja
// alalajeineen. Eri prosessi, ei jaettua moduulia — lisätty laji on lisättävä käsin
// molempiin, muuten se joko ei näy lomakkeessa tai ei mene läpi palvelimelta.
export const LAJIT = {
  avain: { koodi: 'AVA' },
  avainkaappi: { koodi: 'AKP' },
  ajoneuvo: { koodi: 'AJO' },
  asuste: { koodi: 'ASU' },
  voimankayttovaline: { koodi: 'VKV' },
  ase: { koodi: 'ASE' },
  tietotekniikka: { koodi: 'ATK' },
};

// Missä esine voi olla. 'varasto' on oletus ja ainoa jolla ei ole kohdetta johon se
// viittaa — kaikki muut osoittavat johonkin joka on olemassa (kohde, työntekijä, toinen
// kalustotietue).
export const SIJOITUSLAJIT = ['varasto', 'kohde', 'henkilo', 'ajoneuvo', 'avainkaappi'];

export const TILAT = ['kaytossa', 'huollossa', 'kadonnut', 'poistettu'];

export const TILAN_SELITE = {
  kaytossa: 'Käytössä',
  huollossa: 'Huollossa',
  kadonnut: 'Kadonnut',
  poistettu: 'Poistettu käytöstä',
};

export const NIMEN_MAX = 120;
export const KUVAUKSEN_MAX = 300;
export const SARJANUMERON_MAX = 60;
export const HUOMION_MAX = 500;
export const LISATIEDON_MAX = 120;
export const SYYN_MIN = 3;
// Montako tietuetta yhdellä luonnilla. Avaimia ja asusteita tulee erissä, mutta erä on
// yhä N tietuetta eikä yksi tietue lukumäärällä: ilman omaa riviä esine ei voi saada
// omaa kilpimerkkiä, ja kilpimerkki on koko ominaisuuden syy.
export const KAPPALEITA_MAX = 100;

const siivoa = (arvo, max) => {
  let tulos = '';
  for (const merkki of String(arvo ?? '')) {
    const koodi = merkki.codePointAt(0);
    if (koodi === 9 || koodi === 10 || koodi === 13) { tulos += ' '; continue; }
    if (koodi < 32 || koodi === 127) continue;
    tulos += merkki;
  }
  return tulos.trim().slice(0, max);
};

// Lajikohtaiset lisäkentät. Arvot ovat merkkijonoja tai totuusarvoja; tuntemattomat
// kentät pudotetaan, jotta selain ei voi kasvattaa tietuetta mielivaltaisesti.
const LISATIEDOT = {
  avain: ['avaintyyppi', 'kohdeId', 'kohdeNimi', 'sarjanumerointi', 'luovutussopimus'],
  avainkaappi: ['sijaintikuvaus', 'lokeroita'],
  ajoneuvo: ['rekisteri', 'merkki', 'malli', 'katsastusAsti'],
  asuste: ['koko', 'henkilokohtainen'],
  voimankayttovaline: ['koulutusVaadittu'],
  ase: ['lupanumero', 'kaliiperi', 'sailytyspaikka'],
  tietotekniikka: ['imei', 'puhelinnumero'],
};

const TOTUUSARVOT = new Set(['henkilokohtainen', 'koulutusVaadittu']);

const puhdistaLisatiedot = (laji, arvot) => {
  const sallitut = LISATIEDOT[laji] || [];
  const tulos = {};
  for (const kentta of sallitut) {
    const arvo = arvot?.[kentta];
    if (TOTUUSARVOT.has(kentta)) tulos[kentta] = arvo === true;
    else tulos[kentta] = siivoa(arvo, LISATIEDON_MAX);
  }
  return tulos;
};

// --- Tunnisteen muodostus ----------------------------------------------------------
//
// Numero on juokseva LAJIN SISÄLLÄ ja lasketaan kaikista tietueista poistetut mukaan
// lukien. Poistetun numeron uudelleenkäyttö antaisi kahdelle eri esineelle saman
// kilpimerkin, ja vanhempi niistä on jo jonkun taskussa.
export const muotoileTunnus = (laji, numero) =>
  `TJ-${LAJIT[laji]?.koodi || '???'}-${String(numero).padStart(4, '0')}`;

export function seuraavaNumero(kalusto, laji) {
  const koodi = LAJIT[laji]?.koodi;
  if (!koodi) return 1;
  const etuliite = `TJ-${koodi}-`;
  let suurin = 0;
  for (const esine of Array.isArray(kalusto) ? kalusto : []) {
    const tunnus = String(esine?.tunnus || '');
    if (!tunnus.startsWith(etuliite)) continue;
    const numero = parseInt(tunnus.slice(etuliite.length), 10);
    if (Number.isFinite(numero) && numero > suurin) suurin = numero;
  }
  return suurin + 1;
}

// --- Sijoitus ----------------------------------------------------------------------
//
// LITTEÄT KENTÄT EIVÄTKÄ SISÄKKÄINEN OLIO, ja syy on levyllä: store.js:n kenttäsalaus
// tuntee vain muodot `kentta` ja `taulukko[].kentta`. Polku `sijoitus.nimi` menisi
// listalle läpi mutta ei salaisi mitään, eikä siitä kerrottaisi mitenkään — ja
// sijoituksen nimi on vartijan nimi silloin kun esine on vartijalla.
const sijoitusKentat = (sijoitus) => {
  const laji = SIJOITUSLAJIT.includes(sijoitus?.laji) ? sijoitus.laji : 'varasto';
  return {
    sijoitusLaji: laji,
    sijoitusId: laji === 'varasto' ? null : siivoa(sijoitus?.id, NIMEN_MAX) || null,
    sijoitusNimi: siivoa(sijoitus?.nimi, NIMEN_MAX) || (laji === 'varasto' ? 'Varasto' : ''),
  };
};

const tarkistaSijoitus = (esine, sijoitus) => {
  const kentat = sijoitusKentat(sijoitus);
  if (kentat.sijoitusLaji !== 'varasto' && !kentat.sijoitusId) {
    return { ok: false, error: 'Valitse mihin esine sijoitetaan.' };
  }
  if (!kentat.sijoitusNimi) {
    return { ok: false, error: 'Sijoituksen nimi puuttuu.' };
  }
  // Sääntö 4: henkilökohtainen esine menee vain henkilölle. Koskee myös tunnuksia, jotka
  // ovat asusteita ja joiden koko idea on että ne yksilöivät kantajansa.
  if (esine?.lisatiedot?.henkilokohtainen === true && kentat.sijoitusLaji !== 'henkilo') {
    return {
      ok: false,
      error: 'Esine on merkitty henkilökohtaiseksi. Se luovutetaan nimetylle henkilölle, ei kohteelle tai varastoon.',
    };
  }
  return { ok: true, kentat };
};

const merkinta = (tapahtuma, { user, teksti = '', kentat = null }, nyt) => ({
  ts: new Date(nyt).toISOString(),
  tapahtuma,
  user: user || null,
  teksti: siivoa(teksti, HUOMION_MAX),
  // Sijoitus talletetaan merkintään sellaisena kuin se oli: historia kertoo missä esine
  // on ollut, eikä sitä voi laskea jälkikäteen jos kohde tai työntekijä poistetaan.
  sijoitusLaji: kentat?.sijoitusLaji || null,
  sijoitusNimi: kentat?.sijoitusNimi || '',
});

const lisaaHistoria = (esine, rivi) => [...(Array.isArray(esine.historia) ? esine.historia : []), rivi];

// --- Luonti ------------------------------------------------------------------------

export function luoKalusto({
  id, laji, alalaji, nimi, kuvaus, sarjanumero, lisatiedot, sijoitus,
  numero, user, nyt = Date.now(),
}) {
  if (!LAJIT[laji]) return { ok: false, error: 'Tuntematon kalustolaji.' };

  const puhdasNimi = siivoa(nimi, NIMEN_MAX);
  if (puhdasNimi.length < 2) return { ok: false, error: 'Anna esineelle nimi.' };

  const puhtaatLisatiedot = puhdistaLisatiedot(laji, lisatiedot);
  const puhdasSarja = siivoa(sarjanumero, SARJANUMERON_MAX);

  // Sääntö 3: ase ei synny ilman lupatietoja. Tarkistus on luonnissa eikä siirrossa,
  // koska puutteellinen tietue ehtisi muuten olla rekisterissä ja näyttää kirjanpidolta.
  if (laji === 'ase') {
    if (!puhdasSarja) {
      return { ok: false, error: 'Aseelle on kirjattava sarjanumero. Ilman sitä tietue ei yksilöi asetta.' };
    }
    if (!puhtaatLisatiedot.lupanumero) {
      return { ok: false, error: 'Aseelle on kirjattava luvan numero. Hallussapito on luvanvaraista.' };
    }
  }

  const alku = { ...sijoitusKentat(sijoitus) };
  // Henkilökohtaiseksi merkitty esine voi syntyä varastoon: se luovutetaan vasta kun
  // tiedetään kenelle. Rajoitus koskee siirtoa, ei syntymää.
  if (alku.sijoitusLaji !== 'varasto' && !alku.sijoitusId) {
    return { ok: false, error: 'Valitse mihin esine sijoitetaan.' };
  }

  return {
    ok: true,
    esine: {
      id,
      tunnus: muotoileTunnus(laji, numero),
      laji,
      alalaji: siivoa(alalaji, LISATIEDON_MAX),
      nimi: puhdasNimi,
      kuvaus: siivoa(kuvaus, KUVAUKSEN_MAX),
      sarjanumero: puhdasSarja,
      tila: 'kaytossa',
      ...alku,
      lisatiedot: puhtaatLisatiedot,
      pyynto: null,
      luotu: new Date(nyt).toISOString(),
      luoja: user || null,
      historia: [merkinta('luotu', { user, kentat: alku }, nyt)],
    },
  };
}

// --- Perustietojen korjaus ---------------------------------------------------------
//
// EI KOSKE SIJOITUSTA EIKÄ TILAA. Ne muuttuvat vain omilla toiminnoillaan, jotta jokainen
// muutos jättää historiarivin. Lajia ei voi vaihtaa lainkaan: tunnus on johdettu lajista
// ja painettu kilpimerkkiin.
export function paivitaTiedot({ esine, muutokset, user, nyt = Date.now() }) {
  if (!esine) return { ok: false, error: 'Esinettä ei löytynyt.' };
  if (esine.tila === 'poistettu') return { ok: false, error: 'Esine on poistettu käytöstä.' };

  const puhdasNimi = siivoa(muutokset?.nimi, NIMEN_MAX);
  if (puhdasNimi.length < 2) return { ok: false, error: 'Anna esineelle nimi.' };

  const puhtaatLisatiedot = puhdistaLisatiedot(esine.laji, muutokset?.lisatiedot);
  const puhdasSarja = siivoa(muutokset?.sarjanumero, SARJANUMERON_MAX);
  if (esine.laji === 'ase' && (!puhdasSarja || !puhtaatLisatiedot.lupanumero)) {
    return { ok: false, error: 'Aseen sarjanumeroa ja luvan numeroa ei voi tyhjentää.' };
  }
  // Henkilökohtaiseksi merkitseminen kesken kaiken: esine ei saa jäädä sääntöä rikkovaan
  // tilaan, eli varastossa oleva tavara ei muutu henkilökohtaiseksi vahingossa.
  if (puhtaatLisatiedot.henkilokohtainen === true && esine.sijoitusLaji !== 'henkilo') {
    return {
      ok: false,
      error: 'Henkilökohtaiseksi voi merkitä vain esineen joka on luovutettu henkilölle. Luovuta se ensin.',
    };
  }

  return {
    ok: true,
    esine: {
      ...esine,
      nimi: puhdasNimi,
      alalaji: siivoa(muutokset?.alalaji, LISATIEDON_MAX),
      kuvaus: siivoa(muutokset?.kuvaus, KUVAUKSEN_MAX),
      sarjanumero: puhdasSarja,
      lisatiedot: puhtaatLisatiedot,
      historia: lisaaHistoria(esine, merkinta('muokattu', { user }, nyt)),
    },
  };
}

// --- Siirto (jyvitys) --------------------------------------------------------------

export function siirra({ esine, sijoitus, user, huomio, nyt = Date.now() }) {
  if (!esine) return { ok: false, error: 'Esinettä ei löytynyt.' };
  // Sääntö: poistettua tai kadonnutta ei siirretä. Kadonneen siirtäminen väittäisi
  // tietävänsä missä se on — ja jos se tiedetään, se ei ole kadonnut.
  if (esine.tila === 'poistettu') return { ok: false, error: 'Esine on poistettu käytöstä.' };
  if (esine.tila === 'kadonnut') {
    return { ok: false, error: 'Esine on merkitty kadonneeksi. Merkitse se ensin löytyneeksi.' };
  }

  const tarkistus = tarkistaSijoitus(esine, sijoitus);
  if (!tarkistus.ok) return tarkistus;
  const kentat = tarkistus.kentat;

  if (kentat.sijoitusLaji === esine.sijoitusLaji && kentat.sijoitusId === esine.sijoitusId) {
    return { ok: false, error: `Esine on jo täällä (${esine.sijoitusNimi}).` };
  }
  // Esine ei voi olla itsensä sisällä eikä avainkaappi omassa lokerossaan.
  if (kentat.sijoitusId && kentat.sijoitusId === esine.id) {
    return { ok: false, error: 'Esinettä ei voi sijoittaa itseensä.' };
  }

  return {
    ok: true,
    esine: {
      ...esine,
      ...kentat,
      // Hyväksytty tai ohitettu pyyntö ei jää roikkumaan: siirto on se päätös jota
      // pyyntö odotti, eikä avoin pyyntö saa jäädä odottamaan tehtyä asiaa.
      pyynto: null,
      historia: lisaaHistoria(esine, merkinta('siirto', { user, teksti: huomio, kentat }, nyt)),
    },
  };
}

// --- Pyyntö ja sen ratkaisu --------------------------------------------------------
//
// Vuoroesimies näkee pankin ja pyytää; pääkäyttäjä jyvittää. Sama jako kuin
// varustepoikkeamalla (index.js): havainnon saa tehdä lukuoikeudella, päätöksen ei.
// Oikeustarkistus on index.js:ssä — täällä ovat vain säännöt.

export function pyydaKalustoa({ esine, id, pyytaja, kohde, perustelu, nyt = Date.now() }) {
  if (!esine) return { ok: false, error: 'Esinettä ei löytynyt.' };
  if (esine.tila !== 'kaytossa') {
    return { ok: false, error: `Esine ei ole käytettävissä (${TILAN_SELITE[esine.tila] || esine.tila}).` };
  }
  // Sääntö 5: avoimia pyyntöjä on kerrallaan yksi.
  if (esine.pyynto) {
    return { ok: false, error: `Esineestä on jo avoin pyyntö (${esine.pyynto.kohdeNimi}).` };
  }
  if (!pyytaja) return { ok: false, error: 'Pyytäjä puuttuu.' };

  const kohdeId = siivoa(kohde?.id, NIMEN_MAX);
  const kohdeNimi = siivoa(kohde?.nimi, NIMEN_MAX);
  if (!kohdeId || !kohdeNimi) return { ok: false, error: 'Valitse kohde jolle kalustoa pyydetään.' };
  if (esine.sijoitusLaji === 'kohde' && esine.sijoitusId === kohdeId) {
    return { ok: false, error: 'Esine on jo tällä kohteella.' };
  }

  const puhdasPerustelu = siivoa(perustelu, HUOMION_MAX);
  if (puhdasPerustelu.length < SYYN_MIN) {
    return { ok: false, error: 'Kerro lyhyesti mihin kalustoa tarvitaan. Pyyntö ilman perustelua ei ole ratkaistavissa.' };
  }

  const pyynto = {
    id,
    pyytaja,
    kohdeId,
    kohdeNimi,
    perustelu: puhdasPerustelu,
    luotu: new Date(nyt).toISOString(),
  };

  return {
    ok: true,
    esine: {
      ...esine,
      pyynto,
      historia: lisaaHistoria(esine, merkinta('pyynto', {
        user: pyytaja,
        teksti: `${kohdeNimi}: ${puhdasPerustelu}`,
      }, nyt)),
    },
  };
}

// Pyynnön peruminen. Pyytäjä itse tai pääkäyttäjä — kumpi, ratkaistaan index.js:ssä.
export function peruPyynto({ esine, user, nyt = Date.now() }) {
  if (!esine?.pyynto) return { ok: false, error: 'Esineestä ei ole avointa pyyntöä.' };
  return {
    ok: true,
    esine: {
      ...esine,
      pyynto: null,
      historia: lisaaHistoria(esine, merkinta('pyynto_peruttu', {
        user,
        teksti: esine.pyynto.kohdeNimi,
      }, nyt)),
    },
  };
}

/**
 * Pyynnön ratkaisu. HYVÄKSYNTÄ SIIRTÄÄ ESINEEN — se on koko pyynnön sisältö, eikä
 * hyväksyntää ja siirtoa pidä voida tehdä erikseen: erillisinä "hyväksytty" tarkoittaisi
 * lupausta jota mikään ei täytä.
 */
export function ratkaisePyynto({ esine, hyvaksy, user, perustelu, nyt = Date.now() }) {
  if (!esine?.pyynto) return { ok: false, error: 'Esineestä ei ole avointa pyyntöä.' };
  const pyynto = esine.pyynto;

  if (!hyvaksy) {
    const syy = siivoa(perustelu, HUOMION_MAX);
    if (syy.length < SYYN_MIN) {
      return { ok: false, error: 'Kerro miksi pyyntö hylätään. Pyytäjän on tiedettävä mitä tehdä seuraavaksi.' };
    }
    return {
      ok: true,
      esine: {
        ...esine,
        pyynto: null,
        historia: lisaaHistoria(esine, merkinta('pyynto_hylatty', {
          user,
          teksti: `${pyynto.kohdeNimi}: ${syy}`,
        }, nyt)),
      },
    };
  }

  const tarkistus = tarkistaSijoitus(esine, {
    laji: 'kohde', id: pyynto.kohdeId, nimi: pyynto.kohdeNimi,
  });
  if (!tarkistus.ok) return tarkistus;

  return {
    ok: true,
    esine: {
      ...esine,
      ...tarkistus.kentat,
      pyynto: null,
      historia: lisaaHistoria(esine, merkinta('pyynto_hyvaksytty', {
        user,
        teksti: siivoa(perustelu, HUOMION_MAX),
        kentat: tarkistus.kentat,
      }, nyt)),
    },
  };
}

// --- Tilamuutokset -----------------------------------------------------------------

/**
 * Katoaminen. Sijoitus JÄÄ tietueeseen: "kadonnut" ilman tietoa siitä kenen hallussa
 * esine oli ei kerro mitään siitä mitä pitäisi tehdä. Sama sääntö kuin avaimella
 * (avaimet.js), ja voimankäyttövälineessä se on painavampi kuin avaimessa.
 */
export function merkitseKadonneeksi({ esine, user, syy, nyt = Date.now() }) {
  if (!esine) return { ok: false, error: 'Esinettä ei löytynyt.' };
  if (esine.tila === 'kadonnut') return { ok: false, error: 'Esine on jo merkitty kadonneeksi.' };
  if (esine.tila === 'poistettu') return { ok: false, error: 'Esine on poistettu käytöstä.' };
  const puhdasSyy = siivoa(syy, HUOMION_MAX);
  if (puhdasSyy.length < SYYN_MIN) {
    return { ok: false, error: 'Kerro lyhyesti mitä tapahtui. Kadonnut kalusto on turvallisuuspoikkeama.' };
  }
  return {
    ok: true,
    esine: {
      ...esine,
      tila: 'kadonnut',
      kadonnut: new Date(nyt).toISOString(),
      pyynto: null,
      historia: lisaaHistoria(esine, merkinta('kadonnut', {
        user,
        teksti: puhdasSyy,
        kentat: esine,
      }, nyt)),
    },
  };
}

export function merkitseHuoltoon({ esine, user, huomio, nyt = Date.now() }) {
  if (!esine) return { ok: false, error: 'Esinettä ei löytynyt.' };
  if (esine.tila !== 'kaytossa') {
    return { ok: false, error: `Vain käytössä oleva esine voidaan merkitä huoltoon (nyt: ${TILAN_SELITE[esine.tila] || esine.tila}).` };
  }
  return {
    ok: true,
    esine: {
      ...esine,
      tila: 'huollossa',
      pyynto: null,
      historia: lisaaHistoria(esine, merkinta('huoltoon', { user, teksti: huomio, kentat: esine }, nyt)),
    },
  };
}

// Paluu käyttöön: huollosta tai kadonneesta. Kadonneen löytyminen jää historiaan — se on
// tapahtunut vaikka esine löytyikin, ja juuri se tieto kertoo onko sillä välin ollut
// vieraissa käsissä.
export function palautaKayttoon({ esine, user, huomio, nyt = Date.now() }) {
  if (!esine) return { ok: false, error: 'Esinettä ei löytynyt.' };
  if (esine.tila === 'kaytossa') return { ok: false, error: 'Esine on jo käytössä.' };
  if (esine.tila === 'poistettu') {
    return { ok: false, error: 'Poistettua esinettä ei oteta takaisin käyttöön. Luo uusi tietue.' };
  }
  return {
    ok: true,
    esine: {
      ...esine,
      tila: 'kaytossa',
      kadonnut: null,
      historia: lisaaHistoria(esine, merkinta(
        esine.tila === 'kadonnut' ? 'loytyi' : 'huollosta',
        { user, teksti: huomio, kentat: esine },
        nyt
      )),
    },
  };
}

// Käytöstä poisto. Ei poisto rekisteristä: luovutusketju on syy miksi rekisteri on
// olemassa, eikä se saa kadota siksi että takki meni roskiin.
export function poistaKaytosta({ esine, user, syy, nyt = Date.now() }) {
  if (!esine) return { ok: false, error: 'Esinettä ei löytynyt.' };
  if (esine.tila === 'poistettu') return { ok: false, error: 'Esine on jo poistettu käytöstä.' };
  return {
    ok: true,
    esine: {
      ...esine,
      tila: 'poistettu',
      pyynto: null,
      historia: lisaaHistoria(esine, merkinta('poistettu', { user, teksti: syy, kentat: esine }, nyt)),
    },
  };
}

// --- Koosteet ----------------------------------------------------------------------

export const avoimetPyynnot = (kalusto) =>
  (Array.isArray(kalusto) ? kalusto : []).filter((e) => e?.pyynto);

export const kadonneet = (kalusto) =>
  (Array.isArray(kalusto) ? kalusto : []).filter((e) => e?.tila === 'kadonnut');

export const sijoitetut = (kalusto, sijoitusLaji, sijoitusId) =>
  (Array.isArray(kalusto) ? kalusto : [])
    .filter((e) => e?.sijoitusLaji === sijoitusLaji && e?.sijoitusId === sijoitusId && e?.tila !== 'poistettu');

// --- Vartijan näkymä kohteen kalustoon (erä 20b) ------------------------------------
//
// Vartija näkee VAIN sen kohteen kaluston jossa hän on juuri nyt vuorossa, ja siitäkin
// vain esineen — ei sen luovutusketjua. Kaksi rajausta, kaksi eri syytä:
//
// 1. RIVIT: kohde tulee kesken olevasta vuorosta (vuorot.js: keskenOlevaVuoro) eikä
//    käyttäjän eventAccess-listasta. Ero on olennainen: eventAccess kertoo mihin
//    kohteisiin tunnus saa koskea joskus, vuoro kertoo missä ihminen on nyt. Ilman
//    vuoroa ei näy mitään — se on oikea lopputulos eikä puute, koska silloin ei ole
//    kohdetta jonka kalustoa katsottaisiin.
//
//    HUOM: hyväksytty tehtäväsiirto EI avaa toisen kohteen kalustoa, toisin kuin se
//    avaa kohdelistan (index.js: siirtojenAvaamatKohteet). Päätös 14.9.2026: piiri on
//    oma kohteensa jolla on oma kalustonsa, eikä piirivartija lainaa hälytystehtävällä
//    kohteen tavaroita.
//
// 2. KENTÄT: `historia`, `pyynto` ja `luoja` karsitaan. Avaimen historia kertoo kuka
//    pääsi sisään ja milloin — samaa henkilötietoa jonka takia keys.historia[].haltija
//    on levyllä salattu (store.js). Sama periaate kuin hälytyskeskuksen omalla solmulla:
//    kentällä olevan ei kuulu nähdä kuka on missäkin ollut.
//
// Karsinta tehdään PALVELIMELLA eikä käyttöliittymässä. Piilotettu kenttä joka kulkee
// verkon yli on näkyvä kenttä.
//
// SALLITTUJEN KENTTIEN LISTA, ei poissuljettujen. Ero ratkaisee sen mitä tapahtuu kun
// tietueeseen lisätään myöhemmin kenttä: poissulkulista päästäisi uuden kentän läpi
// hiljaa, tämä jättää sen pois kunnes joku lisää sen tähän tietoisesti. Väärään suuntaan
// erehtyminen tarkoittaisi henkilötiedon vuotamista kentälle.
const NAKYVAT_KENTAT = [
  'id', 'tunnus', 'laji', 'alalaji', 'nimi', 'kuvaus', 'sarjanumero', 'tila',
  'sijoitusLaji', 'sijoitusId', 'sijoitusNimi', 'lisatiedot', 'luotu', 'kadonnut',
];

const ilmanKetjua = (esine) => {
  const julkinen = {};
  for (const kentta of NAKYVAT_KENTAT) {
    if (esine[kentta] !== undefined) julkinen[kentta] = esine[kentta];
  }
  return julkinen;
};

export function vuoronKalusto(kalusto, siteId) {
  if (!siteId) return [];
  return (Array.isArray(kalusto) ? kalusto : [])
    .filter((e) => e?.sijoitusLaji === 'kohde' && e?.sijoitusId === siteId && e?.tila !== 'poistettu')
    .map(ilmanKetjua);
}
