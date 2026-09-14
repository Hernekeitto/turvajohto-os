// Vuorojen säännöt: kuka pääsee mihin vuoroon ja milloin.
//
// Säännöt ovat täällä ja kutsut index.js:ssä, samaan tapaan kuin kierros.js:ssä ja
// laite.js:ssä. Tämä tiedosto ei lue eikä kirjoita levyä eikä tunne Expressiä.
//
// Erä 16 määrittelee mallin ja säännöt; erä 17 kytkee ne vuoron aloitukseen. Säännöt
// kirjoitetaan silti nyt, koska ne ovat se osa jonka on oltava oikein — ja koska
// testattava sääntö on ainoa tapa pitää päätökset näkyvissä sen jälkeen kun ne on tehty.
//
// --- Kaksi päätöstä jotka poikkeavat talon tavasta (10.9.2026) ----------------------
//
// 1. PEREHDYTYS TUNNISTAA HENKILÖN KÄYTTÄJÄTUNNUKSESTA, ei nimestä eikä
//    työntekijätietueesta. Nimi jää perehdytykseen dokumentiksi, mutta kaksi Virtasta on
//    tavallisempaa kuin yksi, eikä henkilöstöpankki ole vielä olemassa. Tunnus on se
//    tieto jolla vartija oikeasti kirjautuu, joten se on myös se jolla pääsy ratkeaa.
//
// 2. TYHJÄ VUOROLISTA TARKOITTAA EI YHTÄÄN, EI KAIKKIA. `eventAccess`-kentässä tyhjä
//    tarkoittaa "ei rajausta". Sama sopimus tässä olisi vaarallinen: puolivalmis
//    perehdytysmerkintä myöntäisi hiljaa pääsyn jokaiseen vuoroon, ja virhe näyttäisi
//    täsmälleen samalta kuin harkittu päätös. Sääntö on testissä.

// Kuinka paljon ennen ja jälkeen vuoroikkunan saa kirjautua. Kaksi tuntia molempiin
// suuntiin: myöhästynyt vuoro ja venynyt vuoro ovat arkipäivää, eikä järjestelmä saa
// estää työn aloittamista kellon takia ilman että joustoa on runsaasti.
export const JOUSTO_MIN = 120;

const VRK_MIN = 24 * 60;

/**
 * "07:00" -> 420. Kelvoton tai puuttuva arvo on null eikä nolla: puolenyön ja
 * puuttuvan ajan erottaminen on koko funktion tarkoitus.
 */
export function minuutit(hhmm) {
  const osuma = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!osuma) return null;
  const tunnit = Number(osuma[1]);
  const min = Number(osuma[2]);
  if (tunnit > 23 || min > 59) return null;
  return tunnit * 60 + min;
}

// Onko hetki välillä [alku, alku + pituus] vuorokausiympyrällä. Ympyrä eikä jana, koska
// yövuoro 23–07 ylittää puolenyön eikä lukujen vertailu riitä.
function ympyralla(hetki, alku, pituus) {
  if (pituus >= VRK_MIN) return true;
  const kohta = (((hetki - alku) % VRK_MIN) + VRK_MIN) % VRK_MIN;
  return kohta <= pituus;
}

/**
 * Saako tähän vuoroon kirjautua juuri nyt.
 *
 * Ilman kellonaikoja vuoro on aina auki. Puuttuva aika EI ole virhe: kellonajaton
 * lisävuoro on olemassa, eikä puuttuvaa rajoitetta saa tulkita rajoitteeksi — se olisi
 * juuri se virhe jossa tyhjä kenttä alkaa tarkoittaa jotain.
 */
export function vuoroIkkunassa({ vuorotyyppi, nyt = new Date(), joustoMin = JOUSTO_MIN }) {
  const alkaa = minuutit(vuorotyyppi?.alkaa);
  const paattyy = minuutit(vuorotyyppi?.paattyy);
  if (alkaa === null || paattyy === null) return { ok: true, syy: null };

  // paattyy === alkaa tarkoittaa vuorokauden mittaista vuoroa, ei nollan mittaista:
  // nollan mittainen vuoro ei ole mikään vuoro, joten se tulkinta ei voi olla oikea.
  const kesto = paattyy > alkaa ? paattyy - alkaa : paattyy + VRK_MIN - alkaa;
  const hetki = nyt.getHours() * 60 + nyt.getMinutes();

  return ympyralla(hetki, alkaa - joustoMin, kesto + 2 * joustoMin)
    ? { ok: true, syy: null }
    : { ok: false, syy: 'ikkunan_ulkopuolella' };
}

/**
 * Mihin kohteen vuorotyyppeihin tällä tunnuksella on perehdytys.
 *
 * Palauttaa Setin id:itä. `voimassaAsti`-kenttää EI tarkisteta: päätös 10.9.2026 oli
 * ettei perehdytys vanhene v1:ssä, ja kenttä on varattu vain jotta vanheneminen voidaan
 * ottaa käyttöön ilman migraatiota. Tämä on testissä, jottei kukaan luule kentän
 * vaikuttavan ennen kuin sääntö on kirjoitettu.
 */
export function perehdytetytVuorot(kohde, username) {
  const tunnus = String(username || '');
  if (!tunnus) return new Set();
  const idt = new Set();
  for (const merkinta of kohde?.perehdytykset || []) {
    if (merkinta?.username !== tunnus) continue;
    for (const id of Array.isArray(merkinta.vuorotyyppiIdt) ? merkinta.vuorotyyppiIdt : []) {
      if (id) idt.add(String(id));
    }
  }
  return idt;
}

/**
 * Onko perehdytysmerkintä kytketty tunnukseen. Kytkemätön merkintä on yhä pätevä
 * dokumentti mutta ei myönnä mitään, ja käyttöliittymän on kerrottava se — muuten se
 * näyttää toimivalta.
 */
export function onKytketty(merkinta) {
  return typeof merkinta?.username === 'string' && merkinta.username.length > 0;
}

/**
 * Vartijan vuorovaihtoehdot kohteittain.
 *
 * Perehdyttämätön vuoro palautetaan mukana `perehdytetty: false` -lipulla eikä
 * suodateta pois. Piilotettu rivi tuottaa kysymyksen "miksi en näe tätä", johon vartija
 * ei löydä vastausta; harmaa rivi vastaa siihen itse ja kertoo mitä pitää pyytää.
 *
 * `vainPerehdytetytKohteet` toteuttaa päätöksen 10.9.2026, jonka mukaan perehdytys korvaa
 * kohderajauksen: kohde jossa ei ole yhtään perehdytettyä vuoroa jää kokonaan pois.
 * Kohteen sisällä yksittäiset vuorot näkyvät silti.
 */
export function vuorovaihtoehdot({
  kohteet = [],
  username,
  nyt = new Date(),
  joustoMin = JOUSTO_MIN,
  vainPerehdytetytKohteet = true,
}) {
  const tulos = [];
  for (const kohde of kohteet) {
    if (!kohde || kohde.archived) continue;
    const sallitut = perehdytetytVuorot(kohde, username);
    const vuorot = (kohde.vuorotyypit || [])
      .filter((v) => v && !v.arkistoitu)
      .map((v) => ({
        id: v.id,
        nimi: v.nimi,
        kuvaus: v.kuvaus || '',
        alkaa: v.alkaa || null,
        paattyy: v.paattyy || null,
        perehdytetty: sallitut.has(String(v.id)),
        ikkunassa: vuoroIkkunassa({ vuorotyyppi: v, nyt, joustoMin }).ok,
        tehtavia: (v.tehtavaIdt || []).length,
        kierroksia: (v.pohjaIdt || []).length,
      }));

    if (vuorot.length === 0) continue;
    if (vainPerehdytetytKohteet && !vuorot.some((v) => v.perehdytetty)) continue;
    tulos.push({ siteId: kohde.id, siteNimi: kohde.name, vuorot });
  }
  return tulos;
}

/**
 * Saako tähän vuoroon kirjautua. Erä 17 kutsuu tätä vuoron aloituksessa; erässä 16 se on
 * olemassa jotta sääntö on kirjoitettu ja testattu kerralla eikä kahdessa palassa.
 *
 * Syy palautetaan koneluettavana eikä tekstinä: kutsuja päättää sanamuodon, ja
 * hälytyskeskuksen kertalupa (erä 17) tarvitsee tietää KUMPI ehto petti — perehdytys vai
 * kello — koska ne ovat eri poikkeuksia.
 */
export function saakoAloittaa({ kohde, vuorotyyppiId, username, nyt = new Date(), joustoMin = JOUSTO_MIN }) {
  const vuorotyyppi = (kohde?.vuorotyypit || []).find((v) => v?.id === vuorotyyppiId);
  if (!vuorotyyppi) return { ok: false, syy: 'tuntematon_vuoro' };
  if (vuorotyyppi.arkistoitu) return { ok: false, syy: 'arkistoitu_vuoro' };
  if (!perehdytetytVuorot(kohde, username).has(String(vuorotyyppiId))) {
    return { ok: false, syy: 'ei_perehdytysta' };
  }
  const ikkuna = vuoroIkkunassa({ vuorotyyppi, nyt, joustoMin });
  if (!ikkuna.ok) return { ok: false, syy: ikkuna.syy };
  return { ok: true, syy: null, vuorotyyppi };
}

// --- Vuoron elinkaari (erä 17) ------------------------------------------------------
//
// Vuoro on palvelimen tietue eikä laitteen tila. Laitteelle jää kopio, mutta totuus on
// täällä — muuten "kuka oli töissä ja missä" olisi kysymys johon vastaa vain se puhelin
// joka sattuu olemaan tallella.

// Ihmisluettava teksti koneluettavasta syystä. Sääntömoduuli ei muotoile virheitä
// kutsujan puolesta muualla, mutta tässä se on perusteltua: sama syy tarkoittaa samaa
// asiaa kaikille kutsujille, ja kolme eri sanamuotoa samasta esteestä olisi kolme eri
// ohjetta samaan tilanteeseen.
const SYYN_TEKSTI = {
  tuntematon_vuoro: 'Vuoroa ei löytynyt.',
  arkistoitu_vuoro: 'Vuoro on poistettu käytöstä.',
  ei_perehdytysta: 'Sinua ei ole perehdytetty tähän vuoroon. Hälytyskeskus voi avata sen kertaluvalla.',
  ikkunan_ulkopuolella: 'Vuoroon voi kirjautua aikaisintaan kaksi tuntia ennen alkua ja viimeistään kaksi tuntia päättymisen jälkeen.',
};

// Mitkä esteet kertalupa voi ohittaa. Olematonta tai arkistoitua vuoroa ei voi luvittaa:
// lupa vuoroon jota ei ole ei ole lupa vaan tietue joka näyttää luvalta.
const LUVITETTAVAT = new Set(['ei_perehdytysta', 'ikkunan_ulkopuolella']);

/**
 * Vuoron aloitus.
 *
 * Tehtävät ja kierrokset KOPIOIDAAN vuorotyypistä, täsmälleen kuten kierros kopioi
 * pisteensä pohjasta (server/kierros.js). Kesken vuoron tehty vuorotyypin muokkaus ei saa
 * muuttaa sitä mitä tältä vuorolta vaadittiin — muuten jälkikäteen ei voi sanoa mitä
 * vartijan piti tehdä.
 *
 * `poikkeus` on hälytyskeskuksen kertalupa: { myontaja, syy }. Se ohittaa perehdytyksen ja
 * kellon mutta ei muuta, ja se jää tietueeseen pysyvästi.
 */
export function aloitaVuoro({
  kohde, vuorotyyppiId, username, pohjat = [], id,
  nyt = new Date(), joustoMin = JOUSTO_MIN, poikkeus = null,
}) {
  const portti = saakoAloittaa({ kohde, vuorotyyppiId, username, nyt, joustoMin });
  if (!portti.ok && !(poikkeus && LUVITETTAVAT.has(portti.syy))) {
    return { ok: false, syy: portti.syy, error: SYYN_TEKSTI[portti.syy] || 'Vuoroa ei voi aloittaa.' };
  }

  const vuorotyyppi = portti.vuorotyyppi
    || (kohde.vuorotyypit || []).find((v) => v?.id === vuorotyyppiId);
  if (!vuorotyyppi) {
    return { ok: false, syy: 'tuntematon_vuoro', error: SYYN_TEKSTI.tuntematon_vuoro };
  }

  // Vain olemassa olevat: viittaus poistettuun tehtävään tuottaisi vuorolle rivin jolla ei
  // ole sisältöä, ja se näyttäisi tekemättömältä työltä.
  const tehtavat = (vuorotyyppi.tehtavaIdt || [])
    .map((tid) => (kohde.tehtavat || []).find((t) => t?.id === tid))
    .filter(Boolean)
    // Suoritusaika kopioidaan samasta syystä kuin nimi: se on se aika joka tälle
    // vuorolle suunniteltiin, eikä myöhempi muutos kohteen tehtävään saa muuttaa sitä
    // mitä tältä vuorolta odotettiin.
    .map((t) => ({ id: t.id, nimi: t.nimi, lahde: 'vuoro', suoritusaika: t.suoritusaika || null }));

  const kierrokset = (vuorotyyppi.pohjaIdt || [])
    .map((pid) => pohjat.find((p) => p?.id === pid))
    .filter(Boolean)
    .map((p) => ({ id: p.id, nimi: p.nimi, lahde: 'vuoro', suoritusaika: p.suoritusaika || null }));

  return {
    ok: true,
    vuoro: {
      id,
      siteId: kohde.id,
      // Nimet kopioidaan: kohteen tai vuoron nimen muutos ei saa muuttaa mennyttä vuoroa.
      siteNimi: kohde.name || '',
      vuorotyyppiId: vuorotyyppi.id,
      vuorotyyppiNimi: vuorotyyppi.nimi || '',
      // Onko tämä piirivuoro (erä 22). Kopioidaan vuorotyypistä samasta syystä kuin nimi:
      // hälytystehtävien kohdennus lukee tämän vuorosta, ja vuorotyypin myöhempi muokkaus
      // ei saa muuttaa sitä millä perusteella kesken olevalle vuorolle on lähetetty
      // hälytyksiä. Ks. halytystehtava.js: nakeeTehtavan.
      piiri: vuorotyyppi.piiri === true,
      vartija: username,
      alkoi: new Date(nyt).toISOString(),
      paattyi: null,
      tila: 'kesken',
      tehtavat,
      pohjat: kierrokset,
      perehdytysPoikkeus: poikkeus && !portti.ok
        ? { myontaja: poikkeus.myontaja, syy: poikkeus.syy, este: portti.syy, aika: new Date(nyt).toISOString() }
        : null,
    },
  };
}

/**
 * Vuoron päättäminen.
 *
 * Tekemättömät tehtävät EIVÄT estä päättämistä (päätös 10.9.2026). Estäminen tarkoittaisi
 * käytännössä että vuoroa ei päätetä ollenkaan, ja auki jäänyt vuoro on huonompi tieto
 * kuin päättynyt vuoro jolla on tekemättömiä rivejä. Ne jäävät tietueeseen näkyviin.
 */
export function paataVuoro({ vuoro, nyt = new Date(), toisto = false }) {
  if (!vuoro) return { ok: false, error: 'Vuoroa ei löytynyt.' };
  // Jonon uudelleenyritys: jo päättynyt vuoro on toistona haluttu lopputulos.
  if (vuoro.tila === 'paattynyt') {
    return toisto
      ? { ok: true, vuoro, duplikaatti: true }
      : { ok: false, error: 'Vuoro on jo päättynyt.' };
  }
  return {
    ok: true,
    vuoro: { ...vuoro, tila: 'paattynyt', paattyi: new Date(nyt).toISOString() },
  };
}

/**
 * Tehtävän tai kierroksen lisäys kesken olevaan vuoroon.
 *
 * Käytetään sekä tehtävähakemistosta ('itse_lisatty') että siirrosta ja pakotuksesta
 * (erät 18–19). Lähde säilyy tietueessa, koska se erottaa suunnitellun työn siitä mitä
 * vuoron aikana tuli lisää — ja se on raportoinnin kiinnostavin tieto.
 */
export function lisaaVuoroon({ vuoro, kohde, pohjat = [], laji, kohdeId, lahde = 'itse_lisatty' }) {
  if (!vuoro) return { ok: false, error: 'Vuoroa ei löytynyt.' };
  if (vuoro.tila !== 'kesken') return { ok: false, error: 'Vuoro on jo päättynyt.' };
  if (laji !== 'tehtava' && laji !== 'kierros') {
    return { ok: false, error: 'Tuntematon laji.' };
  }

  const avain = laji === 'tehtava' ? 'tehtavat' : 'pohjat';
  const lahdelista = laji === 'tehtava' ? (kohde?.tehtavat || []) : pohjat;
  const osuma = lahdelista.find((x) => x?.id === kohdeId);
  if (!osuma) return { ok: false, error: 'Kohdetta ei löytynyt kohteen hakemistosta.' };

  // Jo listalla: ei virhe vaan tilanne. Sama tehtävä kahdesti näyttäisi kahdelta työltä.
  if ((vuoro[avain] || []).some((x) => x.id === kohdeId)) {
    return { ok: true, vuoro, duplikaatti: true };
  }

  return {
    ok: true,
    vuoro: {
      ...vuoro,
      [avain]: [
        ...(vuoro[avain] || []),
        { id: osuma.id, nimi: osuma.nimi, lahde, suoritusaika: osuma.suoritusaika || null },
      ],
    },
  };
}

/**
 * Onko vartijalla jo vuoro kesken. Yksi kerrallaan (päätös 10.9.2026), sama sääntö kuin
 * kierroksella: kahden yhtaikaisen vuoron tehtävistä ei tietäisi kumpaan ne kuuluvat.
 */
export function keskenOlevaVuoro(vuorot, username) {
  return (vuorot || []).find((v) => v?.tila === 'kesken' && v.vartija === username) || null;
}

// --- Kohdenäkyvyys perehdytyksen mukaan (erä 17) ------------------------------------
//
// Päätös 10.9.2026: perehdytys korvaa kohderajauksen VARTIJALLA. Kolme asiaa on syytä
// sanoa ääneen, koska tämä on oikeussääntö eikä käyttöliittymän suodatin:
//
// 1. TÄMÄ KOSKEE VAIN KOHDELISTAA (guardSites). Muut kohdesidonnaiset kokoelmat —
//    raportit, kierrokset, hälytykset — noudattavat yhä `eventAccess`-rajausta ja omia
//    solmujaan. Tämä ei siis ole täydellinen tietoraja vaan se mitä päätöksessä
//    tarkoitettiin: vartija ei näe kohdelistassa kohteita joihin häntä ei ole
//    perehdytetty.
//
// 2. KESKEN OLEVA VUORO OHITTAA PEREHDYTYKSEN. Hälytyskeskus voi avata vuoron
//    kertaluvalla ilman perehdytystä (ks. aloitaVuoro). Ilman tätä poikkeusta vartija
//    saisi vuoron muttei näkisi kohteen ohjeita, yhteystietoja eikä vyöhykkeitä — eli
//    kertalupa antaisi työn muttei sen tekemiseen tarvittavaa tietoa.
//
// 3. RAJAUS EI KOSKE KOHTEIDEN HALLINTAA EIKÄ PÄIVYSTYSTÄ. Vartioesimiehellä ei ole
//    perehdytyksiä hallinnoimiinsa kohteisiin eikä päivystäjällä valvomiinsa, eikä
//    heiltä siksi saa viedä kohdelistaa. Ehto on kutsujalla (index.js), koska se on
//    oikeuskysymys eikä vuorosääntö.
export function kohteetPerehdytyksenMukaan({ kohteet = [], username, vuorot = [] }) {
  const avoimet = new Set(
    vuorot.filter((v) => v?.tila === 'kesken' && v.vartija === username).map((v) => v.siteId)
  );
  return kohteet.filter((k) => avoimet.has(k?.id) || perehdytetytVuorot(k, username).size > 0);
}
