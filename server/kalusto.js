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
//  4. HENKILÖKOHTAINEN ESINE MENEE VAIN HENKILÖLLE. Vartijan tunnus holvissa on tunnus
//     jota kuka tahansa voi käyttää.
//
//  6. AVAIMELLA ON HOLVIPAIKKA, JA SE ON VARATTU. Jokaiselle avaimelle varataan holvista
//     numeroitu paikka (1000→), ja se pysyy avaimen omana myös silloin kun avain on
//     kohteella tai avainkaapissa — tyhjä koukku kertoo että avain on jossain muualla.
//     Paikan numero on samalla avaimen tunnus vartioimisliikkeen kirjanpidossa.
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

// Missä esine voi olla. Kaksi ensimmäistä ovat SÄILÖJÄ: vartioimisliikkeen omia tiloja
// joilla ei ole omaa tietuetta johon sijoitus viittaisi — kaikki muut osoittavat
// johonkin joka on olemassa (kohde, työntekijä, toinen kalustotietue).
//
// NIMI ON 'holvi' EIKÄ 'varasto' (päätös 14.9.2026). Vartioimisliikkeen avainsäilytys on
// holvi, ja termi on sama sekä kirjanpidossa että puheessa. Nimeäminen todellisuuden
// mukaan on halvempaa nyt kuin sitten kun tietueita on tuhansia.
//
// VARUSVARASTO ON OMA SÄILÖNSÄ EIKÄ HOLVIN OSA (18.9.2026). Ne ovat eri tila ja eri
// lukko: holvissa ovat avaimet, varusvarastossa takit, patukat ja puhelimet. Yksi säilö
// kahdella merkityksellä ei kertoisi kummasta ovesta tavara haetaan, ja juuri se on
// kysymys johon kalustorekisterin on vastattava.
export const SIJOITUSLAJIT = ['holvi', 'varusvarasto', 'kohde', 'henkilo', 'ajoneuvo', 'avainkaappi'];

// Säilöt: yrityksen omat tilat. Sijoitus niihin on täydellinen ilman id:tä, koska
// paikka ei ole tietue johon viitataan.
export const SAILOT = ['holvi', 'varusvarasto'];
export const onSailo = (laji) => SAILOT.includes(laji);

// Säilön nimi on VAKIO eikä kutsujan antama: "Holvi" on paikka jonka nimeä ei
// neuvotella tietueittain, ja vapaa nimi tekisi yhdestä paikasta monta.
export const SAILON_NIMI = { holvi: 'Holvi', varusvarasto: 'Varusvarasto' };

// Mihin säilöön laji kuuluu. VAIN OLETUS — esine voidaan siirtää säilöstä toiseen, ja
// sama sääntö on selainpuolella (src/guard/kalusto/lajit.ts: oletusSailo).
export const oletusSailo = (laji) => (laji === 'avain' || laji === 'avainkaappi' ? 'holvi' : 'varusvarasto');

// Ennen nimenmuutosta kirjatut rivit sanovat 'varasto'. Luku sietää sen, jotta vanha data
// ei jää näkymättömiin eikä tarvita erillistä migraatioajoa: nimi on esitystapa, ja
// tietueen merkitys ei muuttunut. Kirjoitus tuottaa aina 'holvi'.
export const normalisoiSijoitusLaji = (laji) => (laji === 'varasto' ? 'holvi' : laji);

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
  voimankayttovaline: ['maarapaiva', 'koulutusVaadittu'],
  ase: ['lupanumero', 'kaliiperi', 'sailytyspaikka'],
  tietotekniikka: ['imei', 'puhelinnumero'],
};

const TOTUUSARVOT = new Set(['henkilokohtainen', 'koulutusVaadittu']);

// Päivämääräkentät. ISO-muoto (YYYY-MM-DD) on vaatimus eikä toive: se on ainoa muoto
// jossa kaksi päivää voi verrata toisiinsa ilman jäsennystä, ja juuri vertailu tekee
// kentästä hyödyllisen — vanhentunut kaasusumutin on turvallisuusasia, ei merkintä.
// Selain lähettää tämän muodon date-kentästä; tarkistus on tässä siksi, ettei
// rajapintaan voi kirjoittaa muuta.
const PAIVAMAARAT = new Set(['maarapaiva']);

const ISO_PAIVA = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// Virheilmoitus tai null. Tyhjä kenttä on kelvollinen: päivämäärä on valinnainen, ja
// sen puuttuminen on eri asia kuin virheellinen arvo.
function tarkistaPaivamaarat(lisatiedot) {
  for (const kentta of PAIVAMAARAT) {
    const arvo = lisatiedot?.[kentta];
    if (!arvo) continue;
    if (!ISO_PAIVA.test(arvo)) {
      return 'Päivämäärä on annettava muodossa vvvv-kk-pp.';
    }
    // Muoto yksin ei riitä: Date rullaa ylivuodon seuraavaan kuukauteen, joten
    // 2027-02-31 kelpaisi ja tallentuisi päiväksi jota ei ole. Arvo on kelvollinen
    // vain jos se säilyy sellaisenaan edestakaisessa muunnoksessa.
    const paiva = new Date(arvo + 'T00:00:00Z');
    if (Number.isNaN(paiva.getTime()) || paiva.toISOString().slice(0, 10) !== arvo) {
      return 'Päivämäärää ei ole olemassa. Tarkista kuukausi ja päivä.';
    }
  }
  return null;
}

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
//
// NUMEROINTI ALKAA 1000:STA, samoin kuin holvipaikka ja henkilön tunnistenumero
// (shared/tunnisteet.ts). Syy on sama: nelinumeroinen luku erottuu puheessa ja
// paperilla järjestysnumerosta, eikä kukaan luule sitä riviksi listalla. "Tuo minulle
// VKV-1005" on yksiselitteinen tavalla jolla "tuo minulle viides" ei ole.
export const TUNNUKSEN_ALKU = 1000;

export const muotoileTunnus = (laji, numero) =>
  `TJ-${LAJIT[laji]?.koodi || '???'}-${String(numero).padStart(4, '0')}`;

// Tunnuksen numero-osa, tai null jos tunnus ei ole tämän lajin.
export function tunnuksenNumero(tunnus, laji) {
  const koodi = LAJIT[laji]?.koodi;
  if (!koodi) return null;
  const etuliite = `TJ-${koodi}-`;
  const teksti = String(tunnus || '');
  if (!teksti.startsWith(etuliite)) return null;
  const numero = parseInt(teksti.slice(etuliite.length), 10);
  return Number.isFinite(numero) ? numero : null;
}

export function seuraavaNumero(kalusto, laji) {
  if (!LAJIT[laji]?.koodi) return TUNNUKSEN_ALKU;
  let suurin = 0;
  for (const esine of Array.isArray(kalusto) ? kalusto : []) {
    const numero = tunnuksenNumero(esine?.tunnus, laji);
    if (numero !== null && numero > suurin) suurin = numero;
  }
  return Math.max(suurin + 1, TUNNUKSEN_ALKU);
}

// --- Holvipaikka -------------------------------------------------------------------
//
// Avaimen holvipaikka on NUMEROITU KOUKKU HOLVISSA ja samalla avaimen tunnus
// vartioimisliikkeen kirjanpidossa. Yksi kenttä eikä kaksi, koska paikka varataan
// avaimelle pysyvästi: se ei vapaudu silloinkaan kun avain on kohteella tai
// avainkaapissa, ja juuri siksi numero kelpaa tunnisteeksi.
//
// Numerointi alkaa 1000:sta samasta syystä kuin henkilön tunnistenumero
// (shared/tunnisteet.ts): nelinumeroinen luku erottuu puheessa ja paperilla
// järjestysnumerosta, eikä kukaan luule sitä riviksi listalla.
//
// EI VAPAUDU POISTETULTA AVAIMELTA. Sama sääntö kuin kilpimerkin tunnuksella: vanhat
// luovutusmerkinnät viittaavat numeroon, ja uudelleenkäyttö tekisi kahdesta eri
// avaimesta saman avaimen jälkikäteen luettuna. Fyysinen koukku voidaan toki ottaa
// uudelleen käyttöön — se on eri asia kuin numero.
//
// VAIN AVAIMILLA. Takilla ja patukalla ei ole holvipaikkaa; ne ovat varusteita joita
// säilytetään missä sattuu olemaan tilaa, eikä niiden sijainti ole turvallisuuskysymys
// samalla tavalla.
export const HOLVIPAIKKA_ALKU = 1000;

export function seuraavaHolviPaikka(kalusto) {
  let suurin = HOLVIPAIKKA_ALKU - 1;
  for (const esine of Array.isArray(kalusto) ? kalusto : []) {
    const paikka = Number(esine?.holviPaikka);
    if (Number.isInteger(paikka) && paikka > suurin) suurin = paikka;
  }
  return suurin + 1;
}

// Onko paikka jo toisella avaimella. Kutsuja antaa oman id:n, jottei esineen oma paikka
// näytä varatulta sitä muokattaessa.
export const holviPaikkaVarattu = (kalusto, paikka, omaId = null) =>
  (Array.isArray(kalusto) ? kalusto : [])
    .some((e) => e?.holviPaikka === paikka && e?.id !== omaId);

// --- Sijoitus ----------------------------------------------------------------------
//
// LITTEÄT KENTÄT EIVÄTKÄ SISÄKKÄINEN OLIO, ja syy on levyllä: store.js:n kenttäsalaus
// tuntee vain muodot `kentta` ja `taulukko[].kentta`. Polku `sijoitus.nimi` menisi
// listalle läpi mutta ei salaisi mitään, eikä siitä kerrottaisi mitenkään — ja
// sijoituksen nimi on vartijan nimi silloin kun esine on vartijalla.
// Oletus on kutsujan valittavissa, koska se riippuu lajista: tuntematon sijoitus vie
// avaimen holviin ja takin varusvarastoon (ks. oletusSailo).
const sijoitusKentat = (sijoitus, oletus = 'holvi') => {
  const pyydetty = normalisoiSijoitusLaji(sijoitus?.laji);
  const laji = SIJOITUSLAJIT.includes(pyydetty) ? pyydetty : oletus;
  return {
    sijoitusLaji: laji,
    sijoitusId: onSailo(laji) ? null : siivoa(sijoitus?.id, NIMEN_MAX) || null,
    sijoitusNimi: onSailo(laji) ? SAILON_NIMI[laji] : siivoa(sijoitus?.nimi, NIMEN_MAX),
  };
};

const tarkistaSijoitus = (esine, sijoitus) => {
  const kentat = sijoitusKentat(sijoitus);
  if (!onSailo(kentat.sijoitusLaji) && !kentat.sijoitusId) {
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
      error: 'Esine on merkitty henkilökohtaiseksi. Se luovutetaan nimetylle henkilölle, ei kohteelle eikä varastoon.',
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
  //
  // ID ON MUKANA NIMEN LISÄKSI (erä 20e). Nimi on ihmiselle ja voi muuttua tai toistua —
  // kaksi avainkaappia voi hyvin olla samanniminen. Säilyttimen historianäkymä ("mitä
  // täältä on lähtenyt") täsmää nimenomaan id:llä, ja nimellä täsmäys näyttäisi toimivan
  // siihen asti kunnes kaksi kaappia nimetään samoin.
  //
  // Ennen tätä kirjatuilta riveiltä id puuttuu. Ne jäävät historianäkymän ulkopuolelle
  // eikä sitä yritetä arvata nimestä: puuttuva rivi on rehellisempi kuin väärä.
  sijoitusLaji: kentat?.sijoitusLaji || null,
  sijoitusId: kentat?.sijoitusId || null,
  sijoitusNimi: kentat?.sijoitusNimi || '',
});

const lisaaHistoria = (esine, rivi) => [...(Array.isArray(esine.historia) ? esine.historia : []), rivi];

// --- Luonti ------------------------------------------------------------------------

export function luoKalusto({
  id, laji, alalaji, nimi, kuvaus, sarjanumero, lisatiedot, sijoitus,
  numero, holviPaikka = null, user, nyt = Date.now(),
}) {
  if (!LAJIT[laji]) return { ok: false, error: 'Tuntematon kalustolaji.' };

  const puhdasNimi = siivoa(nimi, NIMEN_MAX);
  if (puhdasNimi.length < 2) return { ok: false, error: 'Anna esineelle nimi.' };

  const puhtaatLisatiedot = puhdistaLisatiedot(laji, lisatiedot);
  const paivavirhe = tarkistaPaivamaarat(puhtaatLisatiedot);
  if (paivavirhe) return { ok: false, error: paivavirhe };
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

  const alku = { ...sijoitusKentat(sijoitus, oletusSailo(laji)) };
  // Henkilökohtaiseksi merkitty esine voi syntyä säilöön: se luovutetaan vasta kun
  // tiedetään kenelle. Rajoitus koskee siirtoa, ei syntymää.
  if (!onSailo(alku.sijoitusLaji) && !alku.sijoitusId) {
    return { ok: false, error: 'Valitse mihin esine sijoitetaan.' };
  }

  // Holvipaikka on pakollinen avaimelle ja kielletty muilta. Kutsuja (index.js) laskee
  // numeron, koska se vaatii koko pankin — sääntömoduuli ei lue levyä.
  if (laji === 'avain' && !Number.isInteger(holviPaikka)) {
    return { ok: false, error: 'Avaimelle on varattava holvipaikka.' };
  }

  return {
    ok: true,
    esine: {
      id,
      tunnus: muotoileTunnus(laji, numero),
      ...(laji === 'avain' ? { holviPaikka } : {}),
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
  const paivavirhe = tarkistaPaivamaarat(puhtaatLisatiedot);
  if (paivavirhe) return { ok: false, error: paivavirhe };
  const puhdasSarja = siivoa(muutokset?.sarjanumero, SARJANUMERON_MAX);
  if (esine.laji === 'ase' && (!puhdasSarja || !puhtaatLisatiedot.lupanumero)) {
    return { ok: false, error: 'Aseen sarjanumeroa ja luvan numeroa ei voi tyhjentää.' };
  }
  // Henkilökohtaiseksi merkitseminen kesken kaiken: esine ei saa jäädä sääntöä rikkovaan
  // tilaan, eli holvissa oleva tavara ei muutu henkilökohtaiseksi vahingossa.
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
// Vartija näkee KAKSI JOUKKOA, ja ne vastaavat kahteen eri kysymykseen:
//
//   "mitä tässä kohteessa on"  -> vuoron kohteelle jyvitetty kalusto
//   "mitä minulla on"          -> hänelle itselleen luovutetut varusteet
//
// Molemmista näkyy vain esine, ei sen luovutusketjua. Rajaukset ja niiden syyt:
//
// 1. KOHTEEN RIVIT: kohde tulee kesken olevasta vuorosta (vuorot.js: keskenOlevaVuoro)
//    eikä käyttäjän eventAccess-listasta. Ero on olennainen: eventAccess kertoo mihin
//    kohteisiin tunnus saa koskea joskus, vuoro kertoo missä ihminen on nyt. Ilman
//    vuoroa kohteen kalustoa ei näy — se on oikea lopputulos eikä puute, koska silloin
//    ei ole kohdetta jonka kalustoa katsottaisiin.
//
//    HUOM: hyväksytty tehtäväsiirto EI avaa toisen kohteen kalustoa, toisin kuin se
//    avaa kohdelistan (index.js: siirtojenAvaamatKohteet). Päätös 14.9.2026: piiri on
//    oma kohteensa jolla on oma kalustonsa, eikä piirivartija lainaa hälytystehtävällä
//    kohteen tavaroita.
//
// 1b. OMAT VARUSTEET EIVÄT RIIPU VUOROSTA. Takki, tunnus ja varustevyö ovat vartijan
//    hallussa myös vapaapäivänä, ja "mitä minulle on luovutettu" on kysymys johon on
//    voitava vastata silloinkin kun vuoroa ei ole — esimerkiksi palautettaessa varusteita
//    työsuhteen päättyessä. Sidonta on TYÖNTEKIJÄTIETUE eikä käyttäjätunnus, koska
//    kaluston sijoitus osoittaa työntekijäpankkiin; ilman kytkentää (employeeId null)
//    omia varusteita ei näytetä lainkaan, eikä nimellä päättelyä tehdä.
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
  // Holvipaikka on avaimen tunnus kirjanpidossa, ei henkilötieto: vartijan on voitava
  // sanoa esimiehelle kumpi avain on kyseessä.
  'holviPaikka',
];

const ilmanKetjua = (esine) => {
  const julkinen = {};
  for (const kentta of NAKYVAT_KENTAT) {
    if (esine[kentta] !== undefined) julkinen[kentta] = esine[kentta];
  }
  return julkinen;
};

/**
 * Mitä vartija saa nähdä kalustopankista.
 *
 * `siteId`     kesken olevan vuoron kohde, tai null jos vuoroa ei ole
 * `employeeId` kutsujan työntekijätietue, tai null jos tunnusta ei ole kytketty
 *
 * Molemmat null tarkoittaa tyhjää listaa. Se on tarkoitus: ilman vuoroa ja ilman
 * työntekijäkytkentää ei ole mitään mitä tämä näkymä voisi kertoa.
 */
// Rivien normalisointi LUETTAESSA. Ennen nimenmuutosta kirjatut tietueet sanovat levyllä
// yhä 'varasto', eikä niitä varten ajeta migraatiota: nimi on esitystapa eikä tietueen
// merkitys muuttunut. Ilman tätä selain saisi lajin jota sen tyyppi ei tunne, ja
// sijoituksen selite jäisi tyhjäksi — vika joka näkyy vain vanhoilla riveillä ja jonka
// huomaa vasta tuotannossa.
export const normalisoiRivit = (kalusto) =>
  (Array.isArray(kalusto) ? kalusto : []).map((e) => (e?.sijoitusLaji === 'varasto'
    ? { ...e, sijoitusLaji: 'holvi' }
    : e));

export function vuoronKalusto(kalusto, { siteId = null, employeeId = null } = {}) {
  if (!siteId && !employeeId) return [];
  return (Array.isArray(kalusto) ? kalusto : [])
    .filter((e) => {
      if (!e || e.tila === 'poistettu') return false;
      if (siteId && e.sijoitusLaji === 'kohde' && e.sijoitusId === siteId) return true;
      // Tyhjä sijoitusId ei saa osua tyhjään employeeId:hen. Ehto on jo ylempänä
      // (molemmat null palaa aikaisin), mutta toinen niistä voi olla asetettu ja
      // toinen ei — ja silloin `null === null` tekisi jokaisesta sijoittamattomasta
      // esineestä kaikkien omaisuutta.
      if (employeeId && e.sijoitusLaji === 'henkilo' && e.sijoitusId === employeeId) return true;
      return false;
    })
    .map(ilmanKetjua);
}

// --- Avaintyyppikartta --------------------------------------------------------------
//
// Luettelo avainmalleista tunnistuskuvineen (Abloy Exec, iLOQ, Protec² CLIQ…). Avain
// kirjataan pankkiin vapaana tekstinä `avaintyyppi`-kenttään, ja kartan tehtävä on tehdä
// siitä tunnistettava: kirjaaja katsoo kuvaa ja valitsee oikean nimen sen sijaan että
// kirjoittaisi "abloy exec" ja seuraava "Abloy EXEC".
//
// OMA KOKOELMANSA eikä kalustolajin luettelo (lajit.ts: alalajit), koska kartta muuttuu
// käytön aikana: uusi avainmalli tulee käyttöön kesken vuoden, eikä sen lisääminen saa
// vaatia ohjelmistopäivitystä. Kuva kulkee tavallisena liitteenä (uploads.js), jolloin
// tunnistuskuvat pysyvät kirjautumisen takana eivätkä päädy julkiseen lähdekoodiin —
// ne ovat valmistajien tuotekuvia eivätkä meidän omaamme.

export const AVAINTYYPIN_NIMI_MAX = 60;

// Nimen vertailumuoto päällekkäisyyden tunnistamiseen. Isot kirjaimet ja välilyönnit
// vaihtelevat kirjaajan mukaan, ja kaksi riviä samalle avainmallille on kartassa
// pahempaa kuin tiukka tarkistus: valittavana olisi kaksi identtiseltä näyttävää kuvaa.
const vertailunimi = (nimi) => String(nimi || '').trim().toLowerCase().replace(/\s+/g, ' ');

export function luoAvaintyyppi({ id, nimi, kuvaus = '', uploadId, kartta = [], user, nyt = Date.now() }) {
  const puhdasNimi = siivoa(nimi, AVAINTYYPIN_NIMI_MAX);
  if (!puhdasNimi) return { ok: false, error: 'Avaintyypille on annettava nimi.' };
  if (!uploadId) return { ok: false, error: 'Avaintyypille on annettava tunnistuskuva.' };
  if ((Array.isArray(kartta) ? kartta : []).some((t) => vertailunimi(t?.nimi) === vertailunimi(puhdasNimi))) {
    return { ok: false, error: `Avaintyyppi "${puhdasNimi}" on jo kartassa.` };
  }
  return {
    ok: true,
    tyyppi: {
      id,
      nimi: puhdasNimi,
      kuvaus: siivoa(kuvaus, KUVAUKSEN_MAX),
      uploadId: String(uploadId),
      luotu: new Date(nyt).toISOString(),
      luoja: user || null,
    },
  };
}

export function paivitaAvaintyyppi({ tyyppi, muutokset, kartta = [] }) {
  if (!tyyppi) return { ok: false, error: 'Avaintyyppiä ei löytynyt.' };
  const puhdasNimi = siivoa(muutokset?.nimi ?? tyyppi.nimi, AVAINTYYPIN_NIMI_MAX);
  if (!puhdasNimi) return { ok: false, error: 'Avaintyypille on annettava nimi.' };
  // Päällekkäisyys tarkistetaan MUITA vastaan: oma rivi osuisi aina itseensä, jolloin
  // pelkän kuvauksen muokkaus epäonnistuisi.
  const muut = (Array.isArray(kartta) ? kartta : []).filter((t) => t?.id !== tyyppi.id);
  if (muut.some((t) => vertailunimi(t?.nimi) === vertailunimi(puhdasNimi))) {
    return { ok: false, error: `Avaintyyppi "${puhdasNimi}" on jo kartassa.` };
  }
  return {
    ok: true,
    tyyppi: {
      ...tyyppi,
      nimi: puhdasNimi,
      kuvaus: siivoa(muutokset?.kuvaus ?? tyyppi.kuvaus, KUVAUKSEN_MAX),
      // Kuvan vaihto on valinnainen: nimen korjaus ei saa vaatia kuvan lähettämistä
      // uudelleen.
      uploadId: muutokset?.uploadId ? String(muutokset.uploadId) : tyyppi.uploadId,
    },
  };
}

// --- Numeroinnin kertaluontoinen siirto ----------------------------------------------
//
// Ennen numeroinnin nostoa kirjatut esineet alkavat ykkösestä (TJ-VKV-0005). Ne siirretään
// samaan sarjaan lisäämällä tuhat, jolloin keskinäinen järjestys säilyy: 0005 -> 1005.
//
// TUNNUS ON PAINETTU KILPEEN. Siirto tekee jo tulostetuista kilvistä vanhentuneita, ja
// niiden QR osoittaa tunnukseen jota ei enää ole — pankki sanoo sen ääneen ("Kilven
// tunnusta ei löydy pankista"), mutta kilvet on tulostettava uudelleen. Siksi tämä on
// kertaluontoinen: se koskee vain numeroita jotka ovat alle tuhannen, ja toisella ajolla
// se ei tee mitään.
//
// Muutos jää HISTORIAAN kuten kaikki muukin. Rekisteri jonka tunnus vaihtuu jäljettömästi
// ei kelpaa todisteeksi siitä mikä esine oli missäkin — ja juuri se on pankin ainoa syy.
//
// Rajaus: tämä ei korjaa muiden esineiden `sijoitusNimi`-tekstejä, joihin säilyttimen
// tunnus on voitu upottaa ("Piiriauto 1 (TJ-AKP-0001)"). Ne ovat historiatekstiä eikä
// viittauksia, eikä historiaa kirjoiteta uudelleen jälkikäteen.
export function migroiTunnukset(kalusto, { user = null, nyt = Date.now() } = {}) {
  const rivit = Array.isArray(kalusto) ? kalusto : [];
  const muutetut = [];
  let muutettuja = 0;

  const tulos = rivit.map((esine) => {
    const numero = tunnuksenNumero(esine?.tunnus, esine?.laji);
    if (numero === null || numero >= TUNNUKSEN_ALKU) return esine;
    const uusi = muotoileTunnus(esine.laji, numero + TUNNUKSEN_ALKU);
    muutettuja += 1;
    muutetut.push({ vanha: esine.tunnus, uusi });
    return {
      ...esine,
      tunnus: uusi,
      historia: lisaaHistoria(esine, merkinta(
        'tunnusmuutos',
        { user, teksti: `${esine.tunnus} -> ${uusi}` },
        nyt
      )),
    };
  });

  return { muutettuja, muutetut, kalusto: muutettuja > 0 ? tulos : rivit };
}
