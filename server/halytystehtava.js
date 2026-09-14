// Hälytystehtävät: hälytyskeskuksen kentälle antama keikka (erä 22).
//
// Säännöt ovat täällä ja kutsut index.js:ssä, samaan tapaan kuin siirto.js:ssä ja
// vuorot.js:ssä. Tämä tiedosto ei lue eikä kirjoita levyä eikä tunne Expressiä.
//
// --- HÄLYTYSTEHTÄVÄ EI OLE HÄLYTYS -------------------------------------------------
//
// `alerts`-kokoelma (halytys.js) on VARTIJAN OMA turvahälytys: ajastin, man-down,
// hätäpainike. Se kertoo että vartijalla on hätä. Tämä kokoelma on päinvastainen: se on
// TYÖ jonka hälytyskeskus antaa vartijalle, ja sen laukaisi kohteen murtohälytin, asiakas
// tai ovikello. Sama sana, kaksi eri asiaa, eikä niitä saa laittaa samaan kokoelmaan —
// muuten "avoimet hälytykset" tarkoittaisi kahta eri joukkoa samassa listassa.
//
// --- KOHDENNUS LASKETAAN LUKUHETKELLÄ, EI LUONTIHETKELLÄ ---------------------------
//
// Tehtävään ei tallenneta listaa vastaanottajista. Syy on kentällä: vuoro alkaa ja
// päättyy, piirivartija ajaa pois säteeltä ja toinen ajaa sisään. Luontihetkellä
// jäädytetty lista tarkoittaisi että kymmenen minuuttia myöhemmin vuoroon kirjautunut
// vartija ei näe hälytystä joka on yhä auki hänen omassa kohteessaan.
//
// Kohdennus on siis funktio (nakeeTehtavan) jota kutsutaan joka kerta kun lista haetaan.
//
// --- USEAMPI YKSIKKÖ VOI OTTAA SAMAN TEHTÄVÄN --------------------------------------
//
// Vastaanotto ei ole varaus. Murtohälytykseen lähtee tarvittaessa kaksi partiota, ja
// tapahtumalokissa näkyy molemmat. Yksikkö joka ehti ensin ei siis sulje tehtävää
// muilta — se olisi sääntö joka estää lisäavun juuri siinä tilanteessa jota varten
// lisäapu on olemassa.
//
// --- POISTUMINEN ON HÄLYTYSKESKUKSEN PÄÄTÖS ----------------------------------------
//
// Vartija ei päätä tehtävää itse. Hän lähettää raportin, ja tehtävä jää odottamaan
// päivystäjän hyväksyntää. Hylkäys EI ole raportin hylkäys vaan poistumisen hylkäys, ja
// siksi siihen VAADITAAN kommentti: "mitä toimenpiteitä puuttuu" on koko hylkäyksen
// sisältö, ja kommentiton hylkäys jättäisi vartijan kohteeseen tietämättä miksi.

// Hälytyslajit. Lista on tarkoituksella lyhyt: nämä kolme kattavat vartiointiliikkeen
// hälytysliikenteen, ja neljäs laji lisätään vasta kun sille on oikea käyttötapaus.
export const LAJIT = ['murto', 'vartijakutsu', 'ovenavaus'];

export const LAJIN_NIMI = {
  murto: 'Murtohälytys',
  vartijakutsu: 'Vartijakutsu',
  ovenavaus: 'Ovenavaus',
};

// Tehtävän tilat.
//
// `odottaa` on oma tilansa eikä lippu `kaynnissa`-tilan päällä, koska se on se hetki
// jolloin vartija EI saa poistua vaikka oma työnsä on tehty. Lippu olisi tieto jonka voi
// unohtaa lukea; tila on tieto jonka on pakko käsitellä.
export const TILAT = ['avoin', 'kaynnissa', 'odottaa', 'suljettu', 'peruttu'];

// Ne tilat joissa tehtävä kuuluu vartijan kellolistaan. Suljettu ja peruttu eivät kuulu:
// tehty työ listalla on sama kuin tekemätön työ listalta puuttuva — molemmat opettavat
// ettei listaan kannata luottaa.
export const AVOIMET_TILAT = new Set(['avoin', 'kaynnissa', 'odottaa']);

// Yksikön vaiheet vastaanoton jälkeen. Järjestys on ohjeellinen eikä pakko: "ja/tai"
// on käyttäjän oma sanamuoto, ja se on oikein — ajoon lähtemättä paikalla oleva
// kohdevartija on tavallisin tapaus eikä poikkeus.
export const VAIHEET = ['ajoon', 'paikalla'];

export const HAVAINNON_MAX = 1000;
export const KOMMENTIN_MAX = 1000;
export const SILMUKAN_MAX = 200;

// Oletussäde kohteen ympärillä. Viisi kilometriä on käyttäjän antama lähtöarvo, ja se on
// kohteen kenttä (halytysSadeKm) eikä vakio: keskustakohde jonka ympärillä on kymmenen
// partiota tarvitsee eri säteen kuin maaseutukohde jonka lähin partio on 40 km päässä.
export const OLETUS_SADE_KM = 5;

const MAAPALLON_SADE_KM = 6371;

/**
 * Kahden GPS-pisteen etäisyys kilometreinä (haversine).
 *
 * Tämä on karkea ja saa olla: säde on kymmenen kilometrin luokkaa, ja siinä mittakaavassa
 * maapallon muodon tarkka mallinnus ei muuta sitä kenelle hälytys näytetään. Palauttaa
 * nullin jos kumpi tahansa piste puuttuu — nolla olisi väärä vastaus, koska se tarkoittaisi
 * "samassa paikassa".
 */
export function etaisyysKm(a, b) {
  const lat1 = Number(a?.lat);
  const lon1 = Number(a?.lon);
  const lat2 = Number(b?.lat);
  const lon2 = Number(b?.lon);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const rad = (astetta) => (astetta * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * MAAPALLON_SADE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Kohteen sijainti hälytystä varten.
 *
 * Ensisijaisesti kohteen oma `gps`. Jos sitä ei ole, käytetään pohjakartan ensimmäistä
 * kalibrointipistettä (mapRef): se on kohteessa oleva piste jonka koordinaatit joku on
 * käynyt merkitsemässä, eli kohteen sijainti muutaman kymmenen metrin tarkkuudella.
 * Viiden kilometrin säteellä ero ei merkitse mitään, ja kalibroitu kohde ilman erikseen
 * syötettyä sijaintia olisi muuten kohde jonka säde ei koskaan osu keneenkään.
 */
export function kohteenSijainti(kohde) {
  const oma = kohde?.gps;
  if (Number.isFinite(Number(oma?.lat)) && Number.isFinite(Number(oma?.lon))) {
    return { lat: Number(oma.lat), lon: Number(oma.lon) };
  }
  const piste = (Array.isArray(kohde?.mapRef) ? kohde.mapRef : [])
    .find((p) => Number.isFinite(Number(p?.gps?.lat)) && Number.isFinite(Number(p?.gps?.lon)));
  return piste ? { lat: Number(piste.gps.lat), lon: Number(piste.gps.lon) } : null;
}

/**
 * Näkeekö tämä vartija tämän tehtävän, ja millä perusteella.
 *
 * Kolme reittiä, käyttäjän päätös 14.9.2026:
 *
 *   1. `vuoro`  — vartija on vuorossa siinä kohteessa josta hälytys tuli
 *   2. `piiri`  — vartija on piirivuorossa (vuorotyypin `piiri`-lippu). Piirivartija
 *                 ajaa kohteesta toiseen, joten kohdesidonnainen rajaus sulkisi hänet
 *                 ulos juuri siitä työstä jota hän tekee.
 *   3. `sade`   — vartijan viimeksi tiedetty sijainti on kohteen säteellä
 *
 * PERUSTE PALAUTETAAN, koska käyttöliittymän on voitava kertoa se. "Miksi minulle tuli
 * hälytys kohteesta jossa en ole koskaan käynyt" on kysymys johon vartijan on saatava
 * vastaus itse näkymästä, ei esimieheltä.
 *
 * SÄDE EI TOIMI ILMAN SIJAINTISEURANTAA. Seuranta on oletuksena pois (sijainti.js:
 * SIJAINTISEURANTA=1), joten `sijainti` on tuolloin aina null ja kolmas reitti ei tuo
 * ketään. Se on tarkoituksellinen seuraus eikä vika — mutta se on kerrottava
 * päivystäjälle, koska muuten hälytys näyttää menneen kaikille joille se pitikin.
 */
export function nakeeTehtavan({ tehtava, kohde, vartija, vuoro, sijainti, sadeKm }) {
  if (!tehtava) return { nakee: false, peruste: null, etaisyysKm: null };

  // Tunnus otetaan ensisijaisesti omasta argumentistaan eikä vuorosta: vuoroton vartija
  // on tavallinen tapaus (piirivartija joka ei ole kirjautunut vuoroon), ja jos tunnus
  // luettaisiin vain vuorosta, hänen oma kesken oleva keikkansa katoaisi listalta.
  const tunnus = vartija || vuoro?.vartija || null;

  // Vastaanottanut yksikkö näkee tehtävän aina, myös sen jälkeen kun hänen vuoronsa on
  // vaihtunut tai hän on ajanut säteeltä pois. Muuten oma kesken oleva keikka katoaisi
  // ruudulta sen takia että kello löi vuoron loppuun.
  if (tunnus && (tehtava.yksikot || []).some((y) => y?.vartija === tunnus && !y.kieltaytyi)) {
    return { nakee: true, peruste: 'oma', etaisyysKm: null };
  }

  if (vuoro?.tila === 'kesken' && vuoro.siteId === tehtava.siteId) {
    return { nakee: true, peruste: 'vuoro', etaisyysKm: null };
  }
  if (vuoro?.tila === 'kesken' && vuoro.piiri === true) {
    return { nakee: true, peruste: 'piiri', etaisyysKm: null };
  }

  const kohdePiste = kohteenSijainti(kohde);
  const oma = sijainti?.gps;
  const etaisyys = kohdePiste && oma ? etaisyysKm(kohdePiste, oma) : null;
  const sade = Number.isFinite(Number(sadeKm)) && Number(sadeKm) > 0
    ? Number(sadeKm)
    : OLETUS_SADE_KM;
  if (etaisyys !== null && etaisyys <= sade) {
    return { nakee: true, peruste: 'sade', etaisyysKm: Math.round(etaisyys * 10) / 10 };
  }
  return { nakee: false, peruste: null, etaisyysKm: etaisyys === null ? null : Math.round(etaisyys * 10) / 10 };
}

const teksti = (arvo, max) => String(arvo ?? '').trim().slice(0, max);

/**
 * Havaintorivi hälytyskeskukselta.
 *
 * Aikaleima tulee PALVELIMELTA. Päivystäjä kirjoittaa havainnon siinä hetkessä jossa hän
 * sen näkee, ja se hetki on tapahtuman ainoa luotettava aikatieto — selaimen kello ei ole.
 */
export function havaintoRivi({ teksti: sisalto, kirjaaja, id, nyt = Date.now() }) {
  const puhdas = teksti(sisalto, HAVAINNON_MAX);
  if (!puhdas) return null;
  return { id, ts: new Date(nyt).toISOString(), teksti: puhdas, kirjaaja: kirjaaja || null };
}

const lokiRivi = (nyt, tapahtuma, kuka, sisalto) => ({
  ts: new Date(nyt).toISOString(),
  tapahtuma,
  user: kuka || null,
  teksti: sisalto,
});

/**
 * Uusi hälytystehtävä.
 *
 * Kohteen nimi kopioidaan samasta syystä kuin vuorossa ja siirrossa: kohteen nimen
 * muuttaminen ensi kuussa ei saa muuttaa sitä mihin tämä keikka ajettiin.
 */
export function luoTehtava({
  laji, kohde, silmukka = '', havainnot = [], luoja, id, havaintoId = () => null,
  nyt = Date.now(),
}) {
  if (!LAJIT.includes(laji)) return { ok: false, error: 'Tuntematon hälytyslaji.' };
  if (!kohde?.id) return { ok: false, error: 'Kohde vaaditaan.' };

  const rivit = (Array.isArray(havainnot) ? havainnot : [])
    .map((h, i) => havaintoRivi({
      teksti: typeof h === 'string' ? h : h?.teksti,
      kirjaaja: luoja,
      id: havaintoId(i),
      nyt,
    }))
    .filter(Boolean);

  return {
    ok: true,
    tehtava: {
      id,
      laji,
      siteId: kohde.id,
      siteNimi: kohde.name || '',
      // Se hälytyssilmukka tai -piste jonka hälytinjärjestelmä ilmoitti ("Etuovi mg").
      // Vapaa teksti, koska se tulee hälytyskeskusjärjestelmästä sellaisenaan eikä
      // vartiointiliike päätä sen muotoa.
      silmukka: teksti(silmukka, SILMUKAN_MAX),
      tila: 'avoin',
      luotu: new Date(nyt).toISOString(),
      luoja: luoja || null,
      havainnot: rivit,
      yksikot: [],
      raportit: [],
      hyvaksynta: null,
      paattyi: null,
      loki: [lokiRivi(nyt, 'luotu', luoja, `${LAJIN_NIMI[laji]} kohteeseen ${kohde.name || ''}`.trim())],
    },
  };
}

const paivita = (tehtava, muutokset, nyt, lokia) => ({
  ...tehtava,
  ...muutokset,
  loki: lokia ? [...(tehtava.loki || []), ...lokia] : tehtava.loki,
});

/**
 * Päivystäjä lisää havainnon kesken tehtävän.
 *
 * Sallittu myös `odottaa`-tilassa: juuri silloin päivystäjä katsoo tehtävää läpi, ja
 * silloin havaintoja usein syntyykin. Suljettuun ei enää kirjoiteta — mennyt tehtävä on
 * dokumentti eikä muistio.
 */
export function lisaaHavainto({ tehtava, teksti: sisalto, kirjaaja, id, nyt = Date.now() }) {
  if (!tehtava) return { ok: false, error: 'Tehtävää ei löytynyt.' };
  if (tehtava.tila === 'suljettu' || tehtava.tila === 'peruttu') {
    return { ok: false, error: 'Päättyneeseen tehtävään ei voi lisätä havaintoja.' };
  }
  const rivi = havaintoRivi({ teksti: sisalto, kirjaaja, id, nyt });
  if (!rivi) return { ok: false, error: 'Tyhjää havaintoa ei kirjata.' };
  return {
    ok: true,
    tehtava: paivita(tehtava, { havainnot: [...(tehtava.havainnot || []), rivi] }, nyt, [
      lokiRivi(nyt, 'havainto', kirjaaja, rivi.teksti),
    ]),
  };
}

/**
 * Vartija ottaa tehtävän vastaan.
 *
 * `yksikko` on vuoron nimi ("Piiri 301", "Kohde X") eikä vartijan nimimerkki. Käyttäjän
 * päätös 14.9.2026: tunnus tapahtumalokissa tulee siitä vuorosta johon vartija on
 * kirjautunut, koska sama ihminen ajaa eri piiriä eri päivinä. Ilman vuoroa käytetään
 * nimimerkkiä — vuorottoman vartijan nimeä ei jätetä tyhjäksi, koska lokirivi jossa ei
 * lue kuka teki on lokirivi jota ei kannattanut kirjoittaa.
 *
 * `ajoon: true` toteuttaa valikon rivin "Ota vastaan ja lähde ajoon": se on yksi
 * painallus eikä kaksi, koska auton ratissa niitä ei ole toista.
 */
export function vastaanota({ tehtava, vartija, yksikko, vuoroId = null, ajoon = false, nyt = Date.now() }) {
  if (!tehtava) return { ok: false, error: 'Tehtävää ei löytynyt.' };
  if (!vartija) return { ok: false, error: 'Vartija vaaditaan.' };
  if (!AVOIMET_TILAT.has(tehtava.tila)) {
    return { ok: false, error: 'Tehtävä on jo päättynyt.' };
  }
  const nimi = teksti(yksikko, 100) || vartija;
  const vanha = (tehtava.yksikot || []).find((y) => y?.vartija === vartija);
  // Toisto on haluttu lopputulos eikä virhe: kentällä painetaan uudelleen kun ruutu ei
  // ehtinyt päivittyä, eikä siitä pidä saada punaista virhettä.
  if (vanha && !vanha.kieltaytyi) {
    if (!ajoon || vanha.ajoon) return { ok: true, tehtava, duplikaatti: true };
    return merkitseVaihe({ tehtava, vartija, vaihe: 'ajoon', nyt });
  }

  const rivi = {
    vartija,
    nimi,
    vuoroId,
    vastaanotti: new Date(nyt).toISOString(),
    ajoon: ajoon ? new Date(nyt).toISOString() : null,
    paikalla: null,
    kieltaytyi: null,
  };
  const yksikot = vanha
    ? (tehtava.yksikot || []).map((y) => (y.vartija === vartija ? rivi : y))
    : [...(tehtava.yksikot || []), rivi];

  const lokia = [lokiRivi(nyt, 'vastaanotto', vartija, `${nimi} vastaanotti tehtävän`)];
  if (ajoon) lokia.push(lokiRivi(nyt, 'ajoon', vartija, `${nimi} ajoon`));

  return {
    ok: true,
    tehtava: paivita(tehtava, {
      yksikot,
      // Odottava tehtävä ei palaa käynnissä-tilaan siitä että toinen yksikkö ottaa sen
      // vastaan: hyväksyntä on tehtävän tila eikä yksikön, ja sen peruminen kuuluu
      // päivystäjälle.
      tila: tehtava.tila === 'avoin' ? 'kaynnissa' : tehtava.tila,
    }, nyt, lokia),
  };
}

/**
 * Vartija kieltäytyy tehtävästä.
 *
 * Kieltäytyminen KIRJATAAN eikä vain piiloteta tehtävää. Hälytyskeskuksen on nähtävä
 * ketkä kieltäytyivät, koska se on se tieto jonka perusteella päivystäjä tietää ettei
 * apua ole tulossa siitä suunnasta — ja koska "kukaan ei vastannut" ja "kaikki
 * kieltäytyivät" ovat päivystäjälle kaksi eri tilannetta.
 *
 * Syytä ei vaadita, samasta syystä kuin siirron hylkäyksessä (siirto.js): vaadittu syy
 * tuottaa keksittyjä syitä.
 */
export function kieltaydy({ tehtava, vartija, yksikko, syy = '', nyt = Date.now() }) {
  if (!tehtava) return { ok: false, error: 'Tehtävää ei löytynyt.' };
  if (!AVOIMET_TILAT.has(tehtava.tila)) return { ok: false, error: 'Tehtävä on jo päättynyt.' };
  const nimi = teksti(yksikko, 100) || vartija;
  const vanha = (tehtava.yksikot || []).find((y) => y?.vartija === vartija);
  if (vanha && !vanha.kieltaytyi) {
    return { ok: false, error: 'Olet jo ottanut tehtävän vastaan. Poistuminen kuittataan raportilla.' };
  }
  if (vanha?.kieltaytyi) return { ok: true, tehtava, duplikaatti: true };

  const rivi = {
    vartija,
    nimi,
    vuoroId: null,
    vastaanotti: null,
    ajoon: null,
    paikalla: null,
    kieltaytyi: new Date(nyt).toISOString(),
    syy: teksti(syy, KOMMENTIN_MAX),
  };
  return {
    ok: true,
    tehtava: paivita(tehtava, { yksikot: [...(tehtava.yksikot || []), rivi] }, nyt, [
      lokiRivi(nyt, 'kieltaytyi', vartija, `${nimi} kieltäytyi tehtävästä`),
    ]),
  };
}

/**
 * Yksikkö merkitsee vaiheen: ajoon tai paikalla.
 *
 * Aikaleimaa ei ylikirjoiteta. Ensimmäinen "paikalla" on se hetki jolloin apu oli
 * kohteessa, ja juuri sitä lukua vasten vasteaikaa mitataan — toinen painallus ei saa
 * siirtää sitä myöhemmäksi.
 */
export function merkitseVaihe({ tehtava, vartija, vaihe, nyt = Date.now() }) {
  if (!tehtava) return { ok: false, error: 'Tehtävää ei löytynyt.' };
  if (!VAIHEET.includes(vaihe)) return { ok: false, error: 'Tuntematon vaihe.' };
  if (!AVOIMET_TILAT.has(tehtava.tila)) return { ok: false, error: 'Tehtävä on jo päättynyt.' };

  const yksikko = (tehtava.yksikot || []).find((y) => y?.vartija === vartija && !y.kieltaytyi);
  if (!yksikko) return { ok: false, error: 'Ota tehtävä ensin vastaan.' };
  if (yksikko[vaihe]) return { ok: true, tehtava, duplikaatti: true };

  const teksti2 = vaihe === 'ajoon' ? `${yksikko.nimi} ajoon` : `${yksikko.nimi} saapui kohteeseen`;
  return {
    ok: true,
    tehtava: paivita(tehtava, {
      yksikot: (tehtava.yksikot || []).map((y) => (
        y.vartija === vartija ? { ...y, [vaihe]: new Date(nyt).toISOString() } : y
      )),
    }, nyt, [lokiRivi(nyt, vaihe, vartija, teksti2)]),
  };
}

/**
 * Vartija lähettää raportin ja pyytää lupaa poistua.
 *
 * Tehtävä siirtyy `odottaa`-tilaan. Raportti itse on guardReports-kokoelmassa tavallisena
 * tapahtumailmoituksena — tänne jää vain viittaus. Kaksi kopiota samasta tekstistä
 * tarkoittaisi kaksi paikkaa joista se pitää poistaa säilytysajan tullessa täyteen, ja
 * toinen niistä unohtuisi.
 */
export function lahetaRaportti({ tehtava, vartija, raporttiId, nyt = Date.now() }) {
  if (!tehtava) return { ok: false, error: 'Tehtävää ei löytynyt.' };
  if (!AVOIMET_TILAT.has(tehtava.tila)) return { ok: false, error: 'Tehtävä on jo päättynyt.' };
  if (tehtava.tila === 'odottaa') {
    return { ok: false, error: 'Raportti odottaa jo hälytyskeskuksen hyväksyntää.' };
  }
  const yksikko = (tehtava.yksikot || []).find((y) => y?.vartija === vartija && !y.kieltaytyi);
  if (!yksikko) return { ok: false, error: 'Ota tehtävä ensin vastaan.' };
  if (!raporttiId) return { ok: false, error: 'Raportti vaaditaan.' };

  return {
    ok: true,
    tehtava: paivita(tehtava, {
      tila: 'odottaa',
      raportit: [...(tehtava.raportit || []), {
        raporttiId,
        vartija,
        nimi: yksikko.nimi,
        lahetetty: new Date(nyt).toISOString(),
      }],
      hyvaksynta: {
        tila: 'odottaa',
        pyytaja: vartija,
        pyydetty: new Date(nyt).toISOString(),
        kasittelija: null,
        ratkaistu: null,
        kommentti: '',
      },
    }, nyt, [lokiRivi(nyt, 'raportti', vartija, `${yksikko.nimi} lähetti raportin ja pyysi lupaa poistua`)]),
  };
}

/**
 * Päivystäjä ratkaisee poistumispyynnön.
 *
 * KOMMENTTI VAADITAAN HYLKÄYKSEEN. Hylkäys tarkoittaa "älä poistu vielä", ja vartijan on
 * saatava tietää mitä puuttuu. Ilman kommenttia hylkäys olisi ruudulle ilmestyvä punainen
 * palkki josta ei seuraa mitään tekemistä — ja seuraava vartija oppisi olemaan lukematta
 * sitä.
 *
 * Hyväksyntä sulkee KOKO tehtävän, ei vain pyytäjän osuutta. Toinen yksikkö joka on yhä
 * kohteessa näkee sulkemisen lokista ja voi tarvittaessa pyytää uuden tehtävän — mutta
 * kahden rinnakkaisen hyväksyntäketjun ylläpito yhdessä tietueessa tuottaisi tilan jossa
 * tehtävä on samaan aikaan auki ja kiinni. Jos rinnakkaiset poistumiset osoittautuvat
 * tarpeellisiksi, ne ovat oma muutoksensa eivätkä lippu tähän.
 */
export function ratkaiseHyvaksynta({ tehtava, kasittelija, hyvaksy, kommentti = '', nyt = Date.now() }) {
  if (!tehtava) return { ok: false, error: 'Tehtävää ei löytynyt.' };
  if (tehtava.tila !== 'odottaa') {
    return { ok: false, error: 'Tehtävä ei odota hyväksyntää.' };
  }
  const puhdas = teksti(kommentti, KOMMENTIN_MAX);
  if (!hyvaksy && !puhdas) {
    return { ok: false, error: 'Kerro mitä toimenpiteitä puuttuu. Hylkäys ilman perustetta ei kerro vartijalle mitään.' };
  }

  const hyvaksynta = {
    ...(tehtava.hyvaksynta || {}),
    tila: hyvaksy ? 'hyvaksytty' : 'palautettu',
    kasittelija: kasittelija || null,
    ratkaistu: new Date(nyt).toISOString(),
    kommentti: puhdas,
  };
  const pyytaja = tehtava.hyvaksynta?.pyytaja || null;
  const nimi = (tehtava.yksikot || []).find((y) => y?.vartija === pyytaja)?.nimi || pyytaja || '';

  if (hyvaksy) {
    return {
      ok: true,
      tehtava: paivita(tehtava, {
        tila: 'suljettu',
        paattyi: new Date(nyt).toISOString(),
        hyvaksynta,
        yksikot: (tehtava.yksikot || []).map((y) => (
          y.kieltaytyi ? y : { ...y, poistui: y.poistui || new Date(nyt).toISOString() }
        )),
      }, nyt, [lokiRivi(nyt, 'hyvaksytty', kasittelija, `Hälytyskeskus hyväksyi raportin ja poistumisen (${nimi})`)]),
    };
  }

  return {
    ok: true,
    tehtava: paivita(tehtava, { tila: 'kaynnissa', hyvaksynta }, nyt, [
      lokiRivi(nyt, 'palautettu', kasittelija, `Hälytyskeskus ei hyväksynyt poistumista: ${puhdas}`),
    ]),
  };
}

/**
 * Päivystäjä peruu tehtävän.
 *
 * Erillinen hyväksynnästä: peruttu tehtävä on tehtävä jota ei ollutkaan (väärä hälytys,
 * asiakas kuittasi itse), ja se on eri asia kuin tehty ja hyväksytty tehtävä. Sama tila
 * molemmille tekisi vasteaikatilastosta valheellisen.
 */
export function peruTehtava({ tehtava, kasittelija, syy = '', nyt = Date.now() }) {
  if (!tehtava) return { ok: false, error: 'Tehtävää ei löytynyt.' };
  if (!AVOIMET_TILAT.has(tehtava.tila)) return { ok: false, error: 'Tehtävä on jo päättynyt.' };
  const puhdas = teksti(syy, KOMMENTIN_MAX);
  return {
    ok: true,
    tehtava: paivita(tehtava, {
      tila: 'peruttu',
      paattyi: new Date(nyt).toISOString(),
      peruminen: { kasittelija: kasittelija || null, syy: puhdas, ts: new Date(nyt).toISOString() },
    }, nyt, [
      lokiRivi(nyt, 'peruttu', kasittelija, puhdas ? `Hälytyskeskus perui tehtävän: ${puhdas}` : 'Hälytyskeskus perui tehtävän'),
    ]),
  };
}

/**
 * Mitä tämä vartija saa tehdä tehtävälle juuri nyt.
 *
 * Käyttöliittymä kysyy tämän eikä päättele sitä itse, jotta valikon rivit ja palvelimen
 * portti eivät voi erkaantua toisistaan. Valikon rivi joka tuottaa 400-virheen on
 * huonompi kuin puuttuva rivi.
 */
export function omatToiminnot({ tehtava, vartija }) {
  const yksikko = (tehtava?.yksikot || []).find((y) => y?.vartija === vartija);
  const mukana = Boolean(yksikko && !yksikko.kieltaytyi);
  const auki = AVOIMET_TILAT.has(tehtava?.tila);
  const odottaa = tehtava?.tila === 'odottaa';
  return {
    vastaanota: auki && !mukana && !odottaa,
    kieltaydy: auki && !yksikko && !odottaa,
    ajoon: auki && mukana && !odottaa && !yksikko.ajoon,
    paikalla: auki && mukana && !odottaa && !yksikko.paikalla,
    raportoi: auki && mukana && !odottaa,
    odottaa,
  };
}
