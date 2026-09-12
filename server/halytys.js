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

export const MANDOWN_MIN_MIN = 5;
export const MANDOWN_MAX_MIN = 60;
export const MANDOWN_OLETUS_MIN = 5;

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
 * Rajat 5–60 ovat samat kuin selaimen liukusäätimessä oli, jotta siirtymä ei muuta
 * yhdenkään kohteen käyttäytymistä muuten kuin paikan osalta.
 */
export function mandownAsetukset(kohde) {
  const raaka = kohde && typeof kohde === 'object' ? kohde.mandown : null;
  const paalla = raaka?.paalla === true;
  const luku = Number(raaka?.liikkumatonMin);
  const minuutit = Number.isFinite(luku)
    ? Math.min(MANDOWN_MAX_MIN, Math.max(MANDOWN_MIN_MIN, Math.round(luku)))
    : MANDOWN_OLETUS_MIN;
  return { paalla, liikkumatonMin: minuutit };
}

export const KUVAUS_MAX = 200;
export const HUOMIO_MAX = 2000;

const iso = (nyt) => new Date(nyt).toISOString();

const lyhenna = (arvo, max) => String(arvo ?? '').trim().slice(0, max);

const merkinta = (tapahtuma, { user = null, teksti = '' } = {}, nyt) => ({
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
      gps: puhdistaGps(gps),
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
      gps: puhdistaGps(gps) || halytys.gps || null,
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
