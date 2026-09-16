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
