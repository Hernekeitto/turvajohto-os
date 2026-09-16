// Sijaintihistorian KATSOMISEN säännöt.
//
// Erillinen moduuli sijaintiloki.js:stä, ja jako on tarkoituksellinen: sijaintiloki.js
// vastaa kysymykseen "mitä on tallessa ja kuinka kauan", tämä kysymykseen "kuka saa
// katsoa, mitä ja millä perusteella". Ensimmäinen on säilytystä, toinen pääsyä — ja
// vaikutustenarvioinnissa ne ovat eri päätöksiä.
//
// Omassa tiedostossaan myös siksi, että index.js:llä ei ole testitiedostoa. Sama syy kuin
// sijainti.js:n näkyvyyssäännöillä: portti jota ei voi testata on portti johon ei voi
// luottaa.
//
// --- MIKSI SYY ON PAKOLLINEN --------------------------------------------------------
//
// Käyttötarkoitus on rajattu määrittelyssä: hälytysten ja kierrosten jälkikäteinen
// selvitys ja varmentaminen, EI työsuorituksen seuranta. Rajaus on organisatorinen eikä
// tekninen — mikään ei estä katsomasta jälkeä muusta syystä.
//
// Pakollinen syy ei tee rajauksesta teknistä. Se tekee siitä JÄLKIKÄTEEN TARKASTETTAVAN:
// auditlokista näkee mihin tarkoitukseen kutakin jälkeä sanottiin katsottavan, ja
// väärinkäyttö vaatii silloin valheen kirjaamista eikä pelkkää klikkausta. Se on eri asia
// kuin este, ja se on sanottava sellaisena myös työntekijälle (käyttäjän päätös
// 16.9.2026).

import { SAILYTYS_VRK } from './sijaintiloki.js';

// Sallitut syyt. Lista on RAJATTU eikä vapaa teksti, koska vapaasta tekstistä ei voi
// laskea mitään: "selvitys" kolmessakymmenessä eri kirjoitusasussa ei vastaa kysymykseen
// kuinka monta kertaa jälkeä katsottiin muusta kuin sallitusta syystä.
//
// `muu` on mukana tarkoituksella ja vaatii tarkenteen. Ilman sitä listan ulkopuolinen
// tilanne pakottaisi valitsemaan väärän syyn — ja väärä syy lokissa on pahempi kuin
// rehellinen "muu", koska se näyttää oikealta.
export const SYYT = {
  halytys: 'Hälytyksen jälkiselvitys',
  kierros: 'Kierroksen varmentaminen',
  oma_pyynto: 'Työntekijän oma pyyntö omista tiedoistaan',
  muu: 'Muu syy',
};

// Tarkenteen pituusraja. Tarkenne menee auditlokiin, joka on pitkäikäinen ja jota ei
// siivota: rajaton teksti tarkoittaisi rajattomasti kasvavaa lokiriviä.
export const TARKENNE_MAX = 200;

/**
 * Tarkistaa katseluperusteen.
 *
 * Palauttaa `{ ok: true, syy, tarkenne }` tai `{ ok: false, virhe }`. Ei heitä: kutsuja
 * on HTTP-reitti, ja virheen on päädyttävä vastaukseen eikä lokiin.
 */
export function tarkistaSyy(syy, tarkenne) {
  if (!syy || !Object.prototype.hasOwnProperty.call(SYYT, syy)) {
    return { ok: false, virhe: 'Katselulle on annettava syy.' };
  }
  const teksti = typeof tarkenne === 'string' ? tarkenne.trim() : '';
  // `muu` ILMAN tarkennetta olisi sama kuin ei syytä lainkaan — se on se haara jonka
  // kautta pakollisuus vuotaisi tyhjäksi.
  if (syy === 'muu' && teksti.length < 3) {
    return { ok: false, virhe: 'Valitse tarkempi syy tai kuvaa se vähintään kolmella merkillä.' };
  }
  if (teksti.length > TARKENNE_MAX) {
    return { ok: false, virhe: `Tarkenne saa olla enintään ${TARKENNE_MAX} merkkiä.` };
  }
  return { ok: true, syy, tarkenne: teksti };
}

// Pisin kerralla haettava jakso.
//
// RAJA ON OLEMASSA JOTTA HAKU OLISI HAKU EIKÄ VIENTI. Ilman sitä yksi pyyntö palauttaisi
// koko 45 vuorokauden jäljen, eli käytännössä työntekijän täyden liikehistorian — ja se
// olisi yksi auditlokirivi siinä missä sama tieto haettuna päivä kerrallaan olisi 45.
// Rajaus ei estä ketään katsomasta pidempää jaksoa, mutta se tekee siitä näkyvää.
//
// Seitsemän vuorokautta kattaa "viime viikon tapaus" ilman että joutuu hakemaan pätkissä.
export const IKKUNA_MAX_VRK = 7;

const VRK_MS = 24 * 60 * 60 * 1000;

/**
 * Tarkistaa aikaikkunan.
 *
 * Tulevaisuuteen ulottuva loppu ei ole virhe vaan leikataan nykyhetkeen: käyttöliittymän
 * "tänään"-valinta päättyy vuorokauden loppuun, eikä siitä pidä tulla virheilmoitusta.
 */
export function tarkistaIkkuna(alku, loppu, nyt = Date.now()) {
  const a = Number(alku);
  const b = Math.min(Number(loppu), nyt);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { ok: false, virhe: 'Aikaväli puuttuu tai on virheellinen.' };
  }
  if (b <= a) return { ok: false, virhe: 'Aikavälin loppu on ennen alkua.' };
  if (b - a > IKKUNA_MAX_VRK * VRK_MS) {
    return { ok: false, virhe: `Haettava jakso saa olla enintään ${IKKUNA_MAX_VRK} vuorokautta.` };
  }
  return { ok: true, alku: a, loppu: b };
}

/**
 * Saako kysyjä katsoa sijaintihistoriaa lainkaan.
 *
 * OMA SOLMUNSA eikä `guard_locations`, ja ero on koko oikeuden pointti. Nykyisen
 * sijainnin näkeminen vastaa kysymykseen "kuka ehtii tähän osoitteeseen" ja vanhenee 30
 * minuutissa. Jälki vastaa kysymykseen "missä tämä ihminen on ollut", kattaa 45
 * vuorokautta eikä vanhene katsottaessa.
 *
 * Tämä oli vaikutustenarvioinnin avoin kohta 1: "jäljen katsominen on eri asia kuin
 * nykyisen sijainnin näkeminen". Kun näkymä tehdään, se on oma pääsypäätöksensä.
 */
export function saaNahdaHistorian(kysyja, canView) {
  if (kysyja?.role === 'admin') return true;
  return canView(kysyja?.permissions, null, 'guard_location_history');
}

/**
 * Saako kysyjä katsoa juuri TÄMÄN henkilön jälkeä.
 *
 * Kaksitasoinen portti kuten `/api/sijainnit`: solmu avaa näkymän, tämä rajaa rivit.
 * Rajaus tehdään jäljen pisteiden kohteilla — jos kysyjällä on rajattu kohdepääsy, hän
 * näkee vain ne pisteet jotka syntyivät hänen kohteissaan.
 *
 * KOHTEETON PISTE (piirivuoro) vaatii rajatulta kysyjältä erillisen päätöksen, ja se on
 * tässä KIELTEINEN. Perustelu eroaa tarkoituksella `/api/sijainnit`:stä: siellä kohteeton
 * yksikkö on näytettävä, koska muuten lähintä yksikköä ei löydy hälytystehtävään ja
 * ihminen jää ilman apua. Historiassa ei ole ketään odottamassa apua — siellä
 * varovaisempi valinta ei maksa mitään.
 */
export function suodataPisteet(kysyja, pisteet, eventAllowed) {
  if (kysyja?.role === 'admin') return pisteet;
  const access = kysyja?.eventAccess;
  // Tyhjä eventAccess tarkoittaa palvelimen logiikassa EI RAJAUSTA (ks. permissions.js).
  if (!Array.isArray(access) || access.length === 0) return pisteet;
  return pisteet.filter((p) => !!p.eventId && eventAllowed(access, p.eventId));
}

/**
 * Ketä voi hakea.
 *
 * Lista johdetaan VUOROISTA eikä käyttäjärekisteristä, ja se on tietosuojavalinta eikä
 * mukavuus. Käyttäjärekisteri sisältää kaikki tunnukset — toimiston väen, pääkäyttäjät,
 * lopettaneet — eikä heillä ole sijaintihistoriaa. Pudotusvalikko joka luettelee koko
 * henkilöstön näyttäisi siltä että kenen tahansa jälkeä voi katsoa, vaikka haku
 * palauttaisi tyhjän.
 *
 * Rajaus on lisäksi säilytysaika: sitä vanhemmalta ajalta ei ole jälkeä jäljellä, joten
 * niiden näyttäminen olisi lupaus tiedosta jota ei ole.
 *
 * Kohteeton (piirivuoro) EI putoa pois: rivirajaus tehdään pisteillä, ei tällä listalla.
 */
export function vartijavaihtoehdot(vuorot, nyt = Date.now()) {
  const raja = nyt - SAILYTYS_VRK * 24 * 60 * 60 * 1000;
  const nahdyt = new Map();
  for (const v of vuorot || []) {
    if (!v?.vartija) continue;
    const alkoi = Date.parse(v.alkoi);
    if (!Number.isFinite(alkoi) || alkoi < raja) continue;
    // Viimeisin vuoro talteen: lista järjestetään sen mukaan, koska jälkiselvitys koskee
    // lähes aina juuri äskettäin tapahtunutta.
    const edellinen = nahdyt.get(v.vartija);
    if (!edellinen || alkoi > edellinen) nahdyt.set(v.vartija, alkoi);
  }
  return [...nahdyt.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([username, viimeksi]) => ({ username, viimeksi: new Date(viimeksi).toISOString() }));
}

// --- Hälytystehtävän ajalta haettava jälki ------------------------------------------
//
// KAKSI ERI LÄHDETTÄ, JA NIILLÄ ON ERI ELINKAARI. Tämä on koko tämän osan olennaisin
// asia, ja se on tehtävä näkyväksi myös käyttäjälle:
//
//   tehtava  Kun päivystäjä hyväksyy poistumisen, kunkin yksikön jälki tehtävän
//            vastaanotosta poistumislupaan KOPIOIDAAN tehtävän tietueeseen
//            (index.js: liitaJalki). Siihen sovelletaan LYTP:n tapahtumailmoitusaikaa:
//            kaksi vuotta laatimisvuoden päättymisestä. Tämä on SE JÄLKI JOKA
//            HYVÄKSYTTIIN — todiste, ei näkymä.
//
//   loki     Sijaintiloki, 45 vuorokautta. Kattaa myös kesken olevat ja hyväksymättä
//            jääneet tehtävät, mutta katoaa säilytysajan täytyttyä.
//
// Tehtävän oma jälki on siis AINA ensisijainen kun se on olemassa. Jos lokia käytettäisiin
// ensin, sama tehtävä näyttäisi eri jäljen ennen ja jälkeen 45 vuorokauden — ensin lokista
// luetun, sitten tyhjän — vaikka hyväksytty jälki on koko ajan tallessa tietueessa.

/**
 * Mistä tämän yksikön jälki haetaan tälle tehtävälle.
 *
 * Palauttaa joko valmiin jäljen (`lahde: 'tehtava'`) tai aikaikkunan jolla loki luetaan
 * (`lahde: 'loki'`). Null jos yksikköä ei ole tehtävällä tai se kieltäytyi.
 */
export function tehtavanJalki(tehtava, vartija, nyt = Date.now()) {
  const yksikko = (tehtava?.yksikot || []).find((y) => y?.vartija === vartija);
  // Kieltäytyneelle ei jälkeä: hän ei ollut tehtävällä. Sama sääntö kuin liitaJalki'ssa,
  // ja se on toistettava tässä — muuten kieltäytyneen sijainti tulisi lokista vaikka
  // tehtävän tietueessa sitä ei ole.
  if (!yksikko || yksikko.kieltaytyi) return null;

  if (Array.isArray(yksikko.jalki) && yksikko.jalki.length > 0) {
    return {
      lahde: 'tehtava',
      pisteet: yksikko.jalki,
      harvennettu: yksikko.jalkiHarvennettu || null,
    };
  }

  const alku = Date.parse(yksikko.vastaanotti);
  if (!Number.isFinite(alku)) return null;
  // Kesken olevalle tehtävälle loppu on NYT eikä tehtävän luotu-aika: päivystäjä katsoo
  // jälkeä usein juuri silloin kun yksikkö on matkalla.
  const loppu = Date.parse(yksikko.poistui || tehtava?.paattyi || '') || nyt;
  return { lahde: 'loki', alku, loppu: Math.max(loppu, alku) };
}

/**
 * Mitkä tehtävät voi valita haun kohteeksi.
 *
 * Mukaan tulevat ne joilla on vastaanottanut yksikkö — muista ei ole jälkeä eikä
 * haettavaa. Rajaus on lisäksi kysyjän kohdepääsy: tehtävälista itsessään kertoo missä
 * kohteissa on ollut hälytyksiä, eikä se ole tieto jonka rajattu päivystäjä saa muualta.
 *
 * SÄILYTYSAIKAA EI RAJATA TÄSSÄ. Tehtävän oma jälki säilyy kaksi vuotta, joten vanhempi
 * tehtävä on yhä kelvollinen haun kohde — toisin kuin vapaassa aikavälihaussa, jossa
 * 45 vuorokautta on kova raja.
 */
export function tehtavavaihtoehdot(tehtavat, kysyja, eventAllowed) {
  const access = kysyja?.role === 'admin' ? [] : (kysyja?.eventAccess || []);
  return (tehtavat || [])
    .filter((t) => {
      if (!t?.id) return false;
      if (!eventAllowed(access, t.siteId)) return false;
      return (t.yksikot || []).some((y) => y?.vartija && !y.kieltaytyi && y.vastaanotti);
    })
    .map((t) => ({
      id: t.id,
      laji: t.laji,
      siteId: t.siteId || null,
      siteNimi: t.siteNimi || '',
      silmukka: t.silmukka || '',
      luotu: t.luotu,
      tila: t.tila,
      yksikot: (t.yksikot || [])
        .filter((y) => y?.vartija && !y.kieltaytyi && y.vastaanotti)
        .map((y) => ({
          vartija: y.vartija,
          nimi: y.nimi || y.vartija,
          vastaanotti: y.vastaanotti,
          poistui: y.poistui || null,
          // Kerrotaan ETUKÄTEEN kummasta lähteestä jälki tulee, jotta käyttöliittymä voi
          // sanoa sen ennen hakua eikä vasta tuloksen yhteydessä.
          lahde: Array.isArray(y.jalki) && y.jalki.length > 0 ? 'tehtava' : 'loki',
        })),
    }))
    .sort((a, b) => String(b.luotu).localeCompare(String(a.luotu)));
}
