// Hälytykset: ajastin (lone worker), man-down, hätäpainike ja vyöhykepoikkeama.
//
// KOKO ERÄN PERUSTELU YHDESSÄ LAUSEESSA: hälytyksen on lauettava silloinkin kun vartijan
// puhelin on rikki, tyhjä tai taskussa lukittuna. Siksi määräaikaa vartioi PALVELIN eikä
// selain. Selaimessa pyörivä ajastin olisi täsmälleen se toteutus joka näyttää toimivan
// kehittäjän pöydällä ja pettää sinä yönä kun sitä oikeasti tarvitaan — jos vartija on
// tajuton, hänen puhelimensa ei laukaise mitään.
//
// TILAT
//
//   kaynnissa  Ajastin käy. Vartija kuittaa itsensä kunnossa olevaksi ennen määräaikaa.
//   lauennut   Hälytys on voimassa ja odottaa kuittausta. Man-down, hätäpainike ja
//              vyöhykepoikkeama syntyvät suoraan tähän tilaan.
//   kuitattu   Joku on ottanut hälytyksen vastaan ja hoitanut sen. Päätepiste.
//   peruttu    Ajastin lopetettiin ennen määräaikaa (vuoro päättyi). Päätepiste.
//
// Tila ei koskaan palaa taaksepäin: lauennutta hälytystä ei voi muuttaa käynnissä
// olevaksi. Muuten hälytyshistoriasta ei näkisi mitä yöllä oikeasti tapahtui.
//
// ESKALOINTI ON TYYPPIKOHTAINEN. Hätäpainike lähtee tekstiviestinä heti, man-down
// minuutin ja ajastin kahden minuutin kuluttua — se aika riittää vartijalle kuittaamaan
// itse, jos ajastin vain unohtui. Vyöhykepoikkeama EI eskaloidu lainkaan: se on
// esimiehelle kuuluva havainto eikä hengenhätä, ja jos jokainen aidan viereen osunut
// GPS-piste soittaisi turvallisuuspäällikölle, kaikki hälytykset lakkaisivat
// tarkoittamasta mitään.
//
// SIJAINTI TALLENNETAAN TÄSSÄ, VAIKKA SIJAINTIVIRTAA EI TALLENNETA (vrt. sijainti.js,
// jossa sijainnit elävät vain muistissa). Ero on tarkoituksellinen: jatkuva sijaintivirta
// on työntekijään kohdistuvaa valvontaa, mutta hälytyksen sijainti on yksittäinen tieto
// siitä mistä apua tarvitaan. Ilman sitä hälytys kertoo että joku on hädässä muttei
// kenellekään missä — ja juuri se on koko toiminnon tarkoitus.

export const TILAT = ['kaynnissa', 'lauennut', 'kuitattu', 'peruttu'];
export const AVOIMET = ['kaynnissa', 'lauennut'];

export const TYYPIT = {
  ajastin: {
    label: 'Ajastinhälytys',
    // Kaksi minuuttia: unohtunut kuittaus ehditään korjata, mutta oikeassa hätätilanteessa
    // odotus ei ole liian pitkä. Valvomossa hälytys näkyy joka tapauksessa heti.
    eskalointiViiveMs: 2 * 60 * 1000,
    eskaloi: true,
  },
  mandown: {
    label: 'Man-down',
    // Man-down on jo kysynyt vartijalta laitteella "oletko kunnossa" ja jäänyt ilman
    // vastausta, joten odotusaika on lyhyempi kuin ajastimella.
    eskalointiViiveMs: 60 * 1000,
    eskaloi: true,
  },
  panic: {
    label: 'Hätäpainike',
    // Ei viivettä. Hätäpainiketta ei paineta vahingossa taskussa: se vaatii pitkän
    // painalluksen (ks. frontin toteutus), ja väärä hälytys on halvempi kuin viivästynyt.
    eskalointiViiveMs: 0,
    eskaloi: true,
  },
  geofence: {
    label: 'Vyöhykepoikkeama',
    eskalointiViiveMs: 0,
    eskaloi: false,
  },
  // Kriittinen varustepoikkeama (erä 8). Eskaloituu, koska kriittinen tarkoittaa juuri
  // sitä että puute estää turvallisen työskentelyn nyt — mutta viive on pitkä: kyse ei
  // ole ihmisen hädästä vaan siitä että joku on saatava tuomaan toimiva varuste.
  varuste: {
    label: 'Varustepoikkeama',
    eskalointiViiveMs: 5 * 60 * 1000,
    eskaloi: true,
  },
};

// --- Sijainti ja säilytysaika hälytyslajeittain (käyttäjän päätös 15.9.2026) --------
//
// Sijaintitieto ei ole kaikissa hälytyslajeissa perusteltu, eikä sama säilytysaika sovi
// niille kaikille. Molemmat on määritelty TÄSSÄ eikä siellä missä hälytys luodaan, jotta
// sääntö luetaan yhdestä paikasta — hajallaan se erkanisi lajeittain huomaamatta.
//
//   panic, mandown, ajastin   Sijainti kerätään. Nämä johtavat tarkistustehtävään
//                             toisille vartijoille ja siitä tapahtumailmoitukseen, joten
//                             sijainti on osa sitä tapahtumaa: LYTP:n säilytysaika.
//
//   geofence                  Sijainti kerätään, säilytysaika 45 vrk. Vyöhykepoikkeama
//                             on työnjohdollinen havainto eikä ihmisen hätä, eikä siitä
//                             synny tapahtumailmoitusta.
//
//   varuste                   SIJAINTIA EI KERÄTÄ LAINKAAN. Kriittinen varustepoikkeama
//                             kertoo että varuste on rikki tai puuttuu — kysymys on
//                             siitä kuka tuo toimivan tilalle, ei siitä missä vartija
//                             seisoo. Sijainti ei vastaa mihinkään kysymykseen jonka
//                             tämä hälytys esittää.
//
// VARUSTEEN KOHDALLA TÄMÄ ON MINIMOINTIA LÄHTEELLÄ EIKÄ SÄILYTYSAIKA: koordinaatti ei
// päädy levylle lainkaan, joten sitä ei tarvitse myöhemmin poistaa eikä sen säilymistä
// tarvitse valvoa. Poistettava tieto on aina tieto jonka poisto voi unohtua.
export const SIJAINTISAANNOT = {
  ajastin: { kerataan: true, sailytys: 'lytp' },
  mandown: { kerataan: true, sailytys: 'lytp' },
  panic: { kerataan: true, sailytys: 'lytp' },
  geofence: { kerataan: true, sailytys: '45vrk' },
  varuste: { kerataan: false, sailytys: null },
};

/** Kerätäänkö tämän hälytyslajin yhteydessä sijainti. Tuntematon laji: ei kerätä. */
export const kerataankoSijainti = (tyyppi) => SIJAINTISAANNOT[tyyppi]?.kerataan === true;

// Vyöhykepoikkeaman sijainnin säilytysaika vuorokausina. Sama luku kuin muulla
// sijaintidatalla (sijaintiloki.js), ja tarkoituksella sama: vyöhykepoikkeaman
// koordinaatti on sijaintitieto siinä missä jälkikin, eikä kahdelle eri luvulle ole
// perustetta.
export const GEOFENCE_SAILYTYS_VRK = 45;

/**
 * Poistaa säilytysajan ylittäneet sijainnit vyöhykepoikkeamista.
 *
 * SIJAINTI POIS, HÄLYTYS JÄÄ. Hälytystietueella on arvoa tapahtumana senkin jälkeen kun
 * koordinaatti on poistettu: kuka, milloin, mikä vyöhyke, kuittasiko joku. Koko tietueen
 * poistaminen hävittäisi sen tiedon turhaan — arka osa on sijainti, ei se että poikkeama
 * tapahtui.
 *
 * Palauttaa uuden listan ja poistettujen määrän. Ei kirjoita mihinkään: kutsuja päättää
 * tallennuksesta ja kirjaamisesta, jotta tämä pysyy testattavana ilman levyä.
 */
export function siivoaVyohykeSijainnit(halytykset, nyt = Date.now()) {
  const raja = nyt - GEOFENCE_SAILYTYS_VRK * 24 * 60 * 60 * 1000;
  let poistettu = 0;
  const tulos = (halytykset || []).map((h) => {
    if (h?.tyyppi !== 'geofence' || !h.gps) return h;
    const alkoi = Date.parse(h.alkoi);
    // Kelvoton aikaleima tulkitaan vanhaksi: sijaintia jonka ikää ei voi todeta ei voi
    // myöskään todeta säilytysajan sisällä olevaksi. Sama tulkinta kuin
    // kirjaukset.js:n säilytysaikatarkistuksessa.
    if (Number.isFinite(alkoi) && alkoi > raja) return h;
    poistettu += 1;
    return { ...h, gps: null };
  });
  return { halytykset: tulos, poistettu };
}

export const TYYPPI_IDT = Object.keys(TYYPIT);

// Ajastimen kesto. Alaraja estää vahingossa asetetun nollan; yläraja on siinä, että yli
// neljän tunnin "ajastin" ei enää valvo mitään — sen ainoa vaikutus olisi hälytys neljä
// tuntia sen jälkeen kun vartija lähti kotiin.
export const AJASTIN_MIN_MIN = 1;
export const AJASTIN_MAX_MIN = 240;

// --- Man-downin kohdekohtainen asetus -------------------------------------------------
//
// Asetus asui 12.9.2026 asti pelkästään selaimen localStoragessa, ja se oli väärä paikka
// kahdesta syystä. Ensinnäkin natiivisovellus ei pääse siihen käsiksi lainkaan, ja se on
// juuri se sovellus joka man-downin oikeasti ajaa — selain ei ole auki taskussa.
// Toiseksi, ja tärkeämmin: man-down on TYÖNANTAJAN turvallisuusasetus eikä työntekijän
// valinta. Selaimen tallenteessa se oli vartijan itsensä päätettävissä, kenenkään
// näkemättä, ja liikkumattomuusraja oli laitekohtainen — sama vartija sai eri valvonnan
// riippuen siitä kummalla puhelimella hän sattui kirjautumaan.
//
// Nyt asetus on kohteen tietueessa, päivystäjän asettama ja auditlokin piirissä.

// --- Rajat 30–60 min, oletusarvo 60 ---------------------------------------------------
//
// Alaraja oli 5 minuuttia 12.9.2026 asti. Se mitattiin kelvottomaksi saman päivän
// kenttäajossa: puhelin taskussa liikkuvalla vartijalla tuotti 0 kyselyä 12,5 tunnissa,
// mutta sama puhelin pöydällä tuotti 14 kyselyä 53 minuutissa. Toistuva "oletko kunnossa"
// ei ole valvontaa vaan sen vastakohta — se opettaa painamaan nappia katsomatta, ja
// katsomatta painettu kuittaus on täsmälleen yhtä arvokas kuin kuittaamaton hälytys.
//
// Liikkumattomuus on nyt VARAJÄRJESTELMÄ eikä ensisijainen mittari. Ensisijainen on
// vuoron kuittausväli (ks. kuittausAsetukset): se kysyy säännöllisesti riippumatta siitä
// onko puhelin liikkeessä, eikä siis rankaise porttikopissa istumisesta. Tämä sääntö
// vastaa eri kysymykseen: onko laite maannut niin kauan liikkumatta, ettei kyse voi olla
// työnteosta. Siihen kysymykseen 30–60 minuuttia on oikea suuruusluokka, 5 ei ollut.
//
// Iskun jälkeinen sääntö (12 s) EI muutu tämän mukana. Kaatuminen tunnistetaan
// kiihtyvyyspiikistä eikä ajasta, ja siinä minuuttien odottaminen olisi vaarallista.
export const MANDOWN_MIN_MIN = 30;
export const MANDOWN_MAX_MIN = 60;
export const MANDOWN_OLETUS_MIN = 60;

/**
 * Kohteen man-down-asetus turvallisessa muodossa.
 *
 * <b>Oletus on POIS PÄÄLTÄ.</b> Se ei ole turvallisuuden vähättelyä vaan sen tunnustamista,
 * ettei hiljainen käyttöönotto ole käyttöönotto: jos tämä oletuksena kytkeytyisi päälle
 * jokaisessa olemassa olevassa kohteessa, vartijat alkaisivat saada kyselyitä ja
 * hälytyksiä yöllä ilman että kukaan on niin päättänyt. Pois päältä oleminen tehdään sen
 * sijaan NÄKYVÄKSI — sovellus kirjaa sen vuoron alussa ja tarkistuslista näyttää sen —
 * jolloin puuttuva valvonta ei ole hiljainen tila vaan luettavissa oleva tila.
 *
 * Arvo luetaan puolustavasti, koska kohdetietue tulee asiakkaan kirjoittamana
 * `guardSites`-kokoelmaan eikä sitä validoida kirjoitushetkellä. Nolla minuuttia
 * tarkoittaisi hälytystä jokaisesta sekunnista jonka puhelin makaa taskussa, ja
 * puuttuva yläraja hälytystä jota ei koskaan tule.
 *
 * Rajat ovat 30–60 minuuttia, ks. perustelu vakioiden yhteydessä. Kiinnitä huomiota
 * siihen mitä tämä tekee vanhoille tietueille: kohde jolle on tallennettu 5 minuuttia saa
 * nyt 30, koska alaraja nostetaan lukuhetkellä eikä tietuetta muuteta. Se on tarkoitus.
 * Vaihtoehto olisi kunnioittaa vanhaa arvoa, eli jättää tunnetusti liian tiheä kysely
 * voimaan niissä kohteissa jotka ehtivät sen tallentaa.
 */
export function mandownAsetukset(kohde) {
  const raaka = kohde && typeof kohde === 'object' ? kohde.mandown : null;
  const paalla = raaka?.paalla === true;
  const minuutit = minuutitRajoissa(
    raaka?.liikkumatonMin, MANDOWN_MIN_MIN, MANDOWN_MAX_MIN, MANDOWN_OLETUS_MIN);
  return { paalla, liikkumatonMin: minuutit };
}

/**
 * Minuuttiluku rajojen sisällä, tai oletus jos arvoa ei ole.
 *
 * <b>Vain luku kelpaa luvuksi.</b> Aiempi versio kirjoitti {@code Number(arvo)}, ja
 * {@code Number(null)} on nolla eikä NaN — puuttuva asetus puristui siis alarajaan sen
 * sijaan että olisi pudonnut oletukseen. Niin kauan kuin alaraja ja oletus olivat sama
 * luku, virhe ei näkynyt missään; se paljastui vasta kun ne erosivat toisistaan
 * 13.9.2026. Ero on merkityksellinen juuri turva-asetuksessa: tallentamaton arvo ei saa
 * näyttää tarkoituksella valitulta tiheimmältä rajalta.
 */
function minuutitRajoissa(arvo, min, max, oletus) {
  if (typeof arvo !== 'number' || !Number.isFinite(arvo)) {
    return oletus;
  }
  return Math.min(max, Math.max(min, Math.round(arvo)));
}

// --- Vuoron automaattinen kuittausväli -------------------------------------------------
//
// "Oletko kunnossa" -kysely joka toistuu vuoron ajan RIIPPUMATTA LIIKKEESTÄ.
//
// --- Miksi tämä on eri asia kuin man-down --------------------------------------------
//
// Man-downin liikkumattomuussääntö kysyy "onko laite ollut epätavallisen kauan
// liikkumatta". Se ei kysy mitään paikallaan istuvalta vartijalta muuta kuin sen, että
// hän istuu paikallaan — ja porttikopissa tai valvomossa se on koko työ. Lyhyt raja
// tuottaa kyselyn muutaman minuutin välein, ja turhaan toistuva "oletko kunnossa"
// opettaa painamaan sitä katsomatta. Juuri sitä ei saa tapahtua.
//
// Tämä kysyy "onko vartija kunnossa", eikä vastaus riipu siitä liikkuuko hän. Paikallaan
// istuva ja maassa makaava vartija kohdellaan samoin, eikä kuittausta voi ohittaa
// pöytätyöllä.
//
// --- Miksi ajastin on PALVELIMELLA eikä laitteessa -----------------------------------
//
// Tämä käyttää olemassa olevaa `ajastin`-hälytystä: sovellus luo sen vuoron alussa ja
// nollaa sen jokaisella kuittauksella. Erääntyminen ja eskalointi tapahtuvat
// hälytyskierroksella palvelimella (10 s välein).
//
// Se on koko toiminnon tärkein ominaisuus: **kuolleen puhelimen ei tarvitse lähettää
// mitään.** Jos akku loppuu, sovellus tapetaan tai verkko katoaa pysyvästi, kuittausta ei
// tule ja ajastin erääntyy itsestään. Laitteessa juokseva ajastin kuolisi laitteen
// mukana, eli juuri siinä tilanteessa jota vastaan tämä on olemassa.
//
// Ajastimen kesto on kuittausväli PLUS vastausaika, jotta vartijalla on aikaa vastata
// kyselyyn ennen kuin se erääntyy. Sovellus kysyy välin kohdalla; erääntyminen on
// vastausajan verran myöhemmin.

export const KUITTAUS_MIN_MIN = 15;

// Yläraja 180 eikä ajastimen oma 240.
//
// Sovellus luo ajastimen kestolla `vali + vastausaika`, joten kuittausvälin yläraja ei voi
// olla ajastimen yläraja — 240 + 2 ei mahdu 240:een, ja ajastimen luonti epäonnistuisi
// 400:lla juuri siinä kohteessa jossa valvontaväli on pisin. Valvonta katoaisi hiljaa.
// Testi "ajastimen kesto mahtuu ajastimen omiin rajoihin" vartioi tätä.
//
// Kolme tuntia on myös sinänsä jo hyvin pitkä automaattiselle elonmerkille: sitä pidempi
// väli ei enää vastaa kysymykseen "onko vartija kunnossa" vaan "oliko hän kunnossa joskus".
export const KUITTAUS_MAX_MIN = 180;
export const KUITTAUS_OLETUS_MIN = 60;

// Kuinka kauan vartijalla on aikaa vastata kyselyyn ennen kuin ajastin erääntyy.
//
// Kaksi minuuttia eikä man-downin puoli minuuttia: man-down herää epäilystä että jotain
// on jo tapahtunut, tämä on rutiinikysymys kesken työn. Vartija voi olla kädet täynnä,
// portilla tai puhelimessa, eikä rutiinikysymys saa muuttua hälytykseksi siksi että hän
// sattui olemaan kiireinen puoli minuuttia.
export const KUITTAUS_VASTAUSAIKA_MIN = 2;

/**
 * Kohteen kuittausväliasetus turvallisessa muodossa.
 *
 * Oletus on POIS PÄÄLTÄ samasta syystä kuin man-downissa: hiljainen käyttöönotto
 * jokaisessa olemassa olevassa kohteessa alkaisi kysellä vartijoilta ilman että kukaan on
 * niin päättänyt. Pois päältä oleminen tehdään näkyväksi sovelluksen lokissa.
 *
 * Alaraja on 15 minuuttia eikä ajastimen oma minuutti: tämä on koko vuoron mittainen
 * automaatti, ja neljän minuutin välein kysyvä automaatti ei ole valvontaa vaan häiriö.
 * Lyhyempää tarvitaan yksittäisissä riskitehtävissä, ja siihen on käsin käynnistettävä
 * ajastin joka sallii yhden minuutin.
 */
export function kuittausAsetukset(kohde) {
  const raaka = kohde && typeof kohde === 'object' ? kohde.kuittaus : null;
  const paalla = raaka?.paalla === true;
  const minuutit = minuutitRajoissa(
    raaka?.valiMin, KUITTAUS_MIN_MIN, KUITTAUS_MAX_MIN, KUITTAUS_OLETUS_MIN);
  return { paalla, valiMin: minuutit, vastausaikaMin: KUITTAUS_VASTAUSAIKA_MIN };
}

export const KUVAUS_MAX = 200;
export const HUOMIO_MAX = 2000;

const iso = (nyt) => new Date(nyt).toISOString();

const lyhenna = (arvo, max) => String(arvo ?? '').trim().slice(0, max);

// Viety ulos, jotta index.js kirjoittaa historiaan samassa muodossa kuin tämä moduuli.
// 13.9.2026 asti /api/vuoro/tarkistus rakensi oman merkintänsä käsin ja käytti eri
// avainnimiä samoille asioille — `laji` eikä `tapahtuma`, `aika` eikä `ts`. Selain
// ilmoittaa historian tyypissään `{ ts, tapahtuma, ... }`, joten kyseiset merkinnät eivät
// vastanneet omaa tyyppiään eikä niitä löytänyt sieltä mistä niitä etsi.
export const merkinta = (tapahtuma, { user = null, teksti = '' } = {}, nyt) => ({
  ts: iso(nyt),
  tapahtuma,
  user: user || null,
  teksti: lyhenna(teksti, 300),
});

const luku = (arvo, min, max) => {
  const n = Number(arvo);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

// Sijainti hälytykseen. Oma tarkistuksensa eikä sijainti.js:n lueSijainti, koska tämä
// hyväksyy myös pelkän GPS:n ilman kuvakoordinaattia — hätäpainiketta painetaan myös
// siellä missä pohjakarttaa ei ole.
export function puhdistaGps(syote) {
  if (!syote || typeof syote !== 'object') return null;
  const lat = luku(syote.lat, -90, 90);
  const lon = luku(syote.lon, -180, 180);
  if (lat === null || lon === null) return null;
  return { lat, lon, tarkkuus: luku(syote.tarkkuus, 0, 10000) };
}

export const onAvoin = (halytys) => AVOIMET.includes(halytys?.tila);

// Ajastimen käynnistys. Tämä on ainoa hälytys joka syntyy tilaan 'kaynnissa': kaikki muut
// ovat jo tapahtuneet silloin kun ne kirjataan.
export function luoAjastin({ id, vartija, eventId, minuutit, kuvaus, gps, nyt = Date.now() }) {
  if (!vartija) return { ok: false, error: 'Hälytykseltä puuttuu vartija.' };
  const min = Number(minuutit);
  if (!Number.isInteger(min) || min < AJASTIN_MIN_MIN || min > AJASTIN_MAX_MIN) {
    return { ok: false, error: `Ajastimen kesto on ${AJASTIN_MIN_MIN}-${AJASTIN_MAX_MIN} minuuttia.` };
  }
  return {
    ok: true,
    halytys: {
      id,
      tyyppi: 'ajastin',
      tila: 'kaynnissa',
      vartija,
      eventId: eventId || null,
      alkoi: iso(nyt),
      eraantyy: nyt + min * 60000,
      kestoMin: min,
      // Mitä vartija oli tekemässä. Valvomolle tämä on hälytyksen tärkein yksittäinen
      // tieto: "tarkastan kellarikäytävän" kertoo mistä etsiä, pelkkä nimi ei.
      kuvaus: lyhenna(kuvaus, KUVAUS_MAX),
      laukesi: null,
      paattyi: null,
      gps: puhdistaGps(gps),
      vyohyke: null,
      kuittaaja: null,
      kuittausHuomio: '',
      eskalointi: null,
      historia: [merkinta('luotu', { user: vartija, teksti: `Ajastin ${min} min` }, nyt)],
    },
  };
}

// Muut hälytystyypit. Ne syntyvät suoraan lauenneina, koska tapahtuma on jo sattunut:
// nappia on painettu, laite on havainnut kaatumisen tai vyöhykkeen raja on ylitetty.
export function luoHalytys({ id, tyyppi, vartija, eventId, kuvaus, gps, vyohyke, nyt = Date.now() }) {
  if (!vartija) return { ok: false, error: 'Hälytykseltä puuttuu vartija.' };
  if (!TYYPIT[tyyppi] || tyyppi === 'ajastin') {
    return { ok: false, error: 'Tuntematon hälytystyyppi.' };
  }
  return {
    ok: true,
    halytys: {
      id,
      tyyppi,
      tila: 'lauennut',
      vartija,
      eventId: eventId || null,
      alkoi: iso(nyt),
      eraantyy: null,
      kestoMin: null,
      kuvaus: lyhenna(kuvaus, KUVAUS_MAX),
      laukesi: iso(nyt),
      paattyi: null,
      // Lajikohtainen sääntö, ks. SIJAINTISAANNOT. Varustepoikkeamalla tämä on aina
      // null, eikä koordinaatti päädy levylle lainkaan.
      gps: kerataankoSijainti(tyyppi) ? puhdistaGps(gps) : null,
      vyohyke: vyohyke && vyohyke.id
        ? { id: String(vyohyke.id), nimi: lyhenna(vyohyke.nimi, 120), saanto: vyohyke.saanto || null }
        : null,
      kuittaaja: null,
      kuittausHuomio: '',
      eskalointi: null,
      historia: [merkinta('luotu', { user: vartija, teksti: TYYPIT[tyyppi].label }, nyt)],
    },
  };
}

// Ajastimen jatkaminen: "olen kunnossa". Uusi määräaika lasketaan KUITTAUSHETKESTÄ eikä
// vanhasta määräajasta — muuten myöhässä tehty kuittaus jättäisi seuraavan valvontajakson
// lyhyeksi ja ketju ajautuisi vähitellen sekaisin.
export function jatka({ halytys, minuutit, user, nyt = Date.now() }) {
  if (halytys?.tila !== 'kaynnissa') {
    return { ok: false, error: 'Ajastin ei ole käynnissä.' };
  }
  const min = minuutit === undefined || minuutit === null ? halytys.kestoMin : Number(minuutit);
  if (!Number.isInteger(min) || min < AJASTIN_MIN_MIN || min > AJASTIN_MAX_MIN) {
    return { ok: false, error: `Ajastimen kesto on ${AJASTIN_MIN_MIN}-${AJASTIN_MAX_MIN} minuuttia.` };
  }
  return {
    ok: true,
    halytys: {
      ...halytys,
      eraantyy: nyt + min * 60000,
      kestoMin: min,
      historia: [
        ...(halytys.historia || []),
        merkinta('kuittaus', { user, teksti: `Olen kunnossa, ${min} min lisää` }, nyt),
      ],
    },
  };
}

// Määräaika umpeutui. Kutsutaan palvelimen ajastinkierrokselta, ei selaimesta.
export function laukaise({ halytys, syy = 'Määräaika umpeutui ilman kuittausta', gps = null, nyt = Date.now() }) {
  if (halytys?.tila !== 'kaynnissa') {
    return { ok: false, error: 'Vain käynnissä oleva ajastin voi laueta.' };
  }
  return {
    ok: true,
    halytys: {
      ...halytys,
      tila: 'lauennut',
      laukesi: iso(nyt),
      // Lajikohtainen sääntö myös laukeamishetkellä: laukeava hälytys ei saa saada
      // sijaintia jota sen laji ei kerää. Käytännössä vain ajastin laukeaa tätä kautta,
      // mutta sääntö luetaan lajista eikä oleteta.
      gps: kerataankoSijainti(halytys.tyyppi)
        ? (puhdistaGps(gps) || halytys.gps || null)
        : null,
      historia: [...(halytys.historia || []), merkinta('laukesi', { teksti: syy }, nyt)],
    },
  };
}

// Ajastimen lopetus ennen määräaikaa: vuoro päättyi eikä valvontaa enää tarvita. Eri asia
// kuin kuittaus — peruttu hälytys ei koskaan lauennut.
export function peru({ halytys, user, nyt = Date.now() }) {
  if (halytys?.tila !== 'kaynnissa') {
    return { ok: false, error: 'Vain käynnissä olevan ajastimen voi lopettaa.' };
  }
  return {
    ok: true,
    halytys: {
      ...halytys,
      tila: 'peruttu',
      paattyi: iso(nyt),
      historia: [...(halytys.historia || []), merkinta('peruttu', { user }, nyt)],
    },
  };
}

// Lauenneen hälytyksen kuittaus. Tekijä voi olla valvomo TAI vartija itse: se joka on
// kunnossa, on paras tietämään olevansa kunnossa, eikä väärän hälytyksen sulkemista pidä
// pakottaa toisen ihmisen kautta kello kolme yöllä. Kuittaaja jää historiaan kummassakin
// tapauksessa, eikä kuittaus peruuta jo lähtenyttä tekstiviestiä.
export function kuittaa({ halytys, user, huomio, nyt = Date.now() }) {
  if (halytys?.tila !== 'lauennut') {
    return { ok: false, error: 'Vain lauennut hälytys kuitataan.' };
  }
  const itse = !!user && user === halytys.vartija;
  return {
    ok: true,
    halytys: {
      ...halytys,
      tila: 'kuitattu',
      paattyi: iso(nyt),
      kuittaaja: user || null,
      kuittausHuomio: lyhenna(huomio, HUOMIO_MAX),
      historia: [
        ...(halytys.historia || []),
        merkinta('kuitattu', { user, teksti: itse ? 'Vartija kuittasi itse' : 'Valvomo kuittasi' }, nyt),
      ],
    },
  };
}

// Erääntyneet ajastimet. Palautetaan kaikki kerralla, koska palvelimen kierros käsittelee
// ne yhtenä eränä ja kirjoittaa kokoelman kerran.
export function eraantyneet(lista, nyt = Date.now()) {
  return (Array.isArray(lista) ? lista : []).filter(
    (h) => h?.tila === 'kaynnissa' && Number.isFinite(h.eraantyy) && h.eraantyy <= nyt
  );
}

// Hälytykset joista on lähetettävä tekstiviesti. Ehdot: tyyppi eskaloituu, hälytys on yhä
// lauennut (kuitattu ei enää tarvitse apua), viive on kulunut eikä eskalointia ole vielä
// tehty. Viimeinen ehto on se joka estää saman hälytyksen lähettämisen joka kierroksella.
export function eskaloitavat(lista, nyt = Date.now()) {
  return (Array.isArray(lista) ? lista : []).filter((h) => {
    if (h?.tila !== 'lauennut' || h.eskalointi) return false;
    const tyyppi = TYYPIT[h.tyyppi];
    if (!tyyppi?.eskaloi) return false;
    const laukesi = Date.parse(h.laukesi || h.alkoi);
    if (!Number.isFinite(laukesi)) return false;
    return nyt - laukesi >= tyyppi.eskalointiViiveMs;
  });
}

// Eskaloinnin tulos hälytykseen. Myös epäonnistunut yritys merkitään: muuten sama hälytys
// yrittäisi lähettää viestiä joka kierroksella, ja BulkSMS:n ollessa nurin yhdestä
// hälytyksestä syntyisi tuhat epäonnistunutta kutsua.
export function merkitseEskaloitu({ halytys, tulos, nyt = Date.now() }) {
  const onnistui = tulos?.ok === true;
  const maara = Number(tulos?.vastaanottajia) || 0;
  return {
    ...halytys,
    eskalointi: {
      tila: onnistui ? (tulos.dryRun ? 'kuivaharjoittelu' : 'lahetetty') : 'epaonnistui',
      ts: iso(nyt),
      sendId: tulos?.sendId || null,
      vastaanottajia: maara,
      virhe: onnistui ? null : lyhenna(tulos?.virhe || 'Tuntematon virhe', 300),
    },
    historia: [
      ...(halytys.historia || []),
      merkinta('eskalointi', {
        teksti: onnistui
          ? `Tekstiviesti ${maara} numeroon${tulos.dryRun ? ' (kuivaharjoittelu)' : ''}`
          : `Tekstiviestin lähetys epäonnistui: ${tulos?.virhe || ''}`,
      }, nyt),
    ],
  };
}

// Ääkköset pois: hätäviestin runko kirjoitetaan ilman niitä samasta syystä kuin
// pikatoimintonappien oletustekstit (ks. sms.js) — lyhyt runko lähtee varmasti yhtenä
// osana, ja usean osan viestin puhelin näyttää vasta kun kaikki osat ovat saapuneet.
const askiksi = (s) => String(s ?? '')
  .replace(/[äå]/g, 'a')
  .replace(/[ÄÅ]/g, 'A')
  .replace(/ö/g, 'o')
  .replace(/Ö/g, 'O')
  .replace(/[^ -~]/g, '');

export const VIESTIN_MAX = 160;

// Eskalointiviestin runko. Tarkoituksella tylsä ja lyhyt: kuka, mitä, missä, milloin ja
// mitä vastaanottajan pitää tehdä. Viestissä EI ole linkkiä eikä henkilötunnistetta —
// tekstiviesti kulkee salaamattomana, ja vastaanottaja on jo tunnistettu numerollaan.
export function viestiTeksti(halytys, { kohteenNimi = '', nyt = Date.now() } = {}) {
  const d = new Date(nyt);
  const aika = `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
  const tyyppi = TYYPIT[halytys?.tyyppi]?.label || 'Halytys';
  const osat = [
    `TURVAJOHTO${kohteenNimi ? ` ${askiksi(kohteenNimi)}` : ''}: ${askiksi(tyyppi).toUpperCase()}`,
    `${askiksi(halytys?.vartija || 'tuntematon')} klo ${aika}.`,
  ];
  if (halytys?.kuvaus) osat.push(`${askiksi(halytys.kuvaus)}.`);
  if (halytys?.gps) osat.push(`Sijainti ${halytys.gps.lat.toFixed(5)},${halytys.gps.lon.toFixed(5)}.`);
  osat.push('Tarkista tilanne heti.');
  const koko = osat.join(' ');
  // Katkaisu on viimeinen suoja: kuvaus voi olla pitkä, eikä hätäviesti saa venyä usean
  // osan mittaiseksi.
  return koko.length <= VIESTIN_MAX ? koko : `${koko.slice(0, VIESTIN_MAX - 1).trimEnd()}.`;
}
