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
