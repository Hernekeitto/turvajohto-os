import type { SivukarttaSolmu } from '../shared/oikeudet';

// Turvajohto GUARD -puolen sivukartta. Erillinen EVENT-puolen SITEMAPista, koska puolilla
// on eri sivut — mutta rakenne ja oikeusmekanismi ovat samat (ks. shared/oikeudet.ts).
//
// Solmutunnukset on prefiksoitu `guard_`-etuliitteellä, koska oikeudet tallennetaan
// yhteiseen { [solmuId]: { view, edit } } -olioon: ilman prefiksiä GUARDin ja EVENTin
// samannimiset sivut jakaisivat vahingossa saman oikeuden.
//
// HUOM: nämä tunnukset EIVÄT tule automaattisesti palvelimelle (eri prosessi, ei jaettua
// moduulia). Jos lisäät solmun tänne, lisää vastaava sääntö myös server/permissions.js:ään
// — muuten oikeus näkyy editorissa mutta ei rajoita mitään.
//
// Lista kasvaa sitä mukaa kuin GUARD-puolen näkymiä toteutetaan. Tyhjiä solmuja ei lisätä
// etukäteen: oikeuseditorissa näkyvä rivi lupaa käyttäjälle sivun jota ei ole olemassa.
export const SITEMAP_GUARD: SivukarttaSolmu[] = [
  // Kohdevalinta vastaa tapahtumapuolen 'landing'-solmua: kohteiden listaus, luonti ja
  // muokkaus. Globaali solmu palvelimella (server/permissions.js: GLOBAL_NODES), koska
  // ilman kohdelistaa ei pääse yhteenkään kohteeseen. Kohteen hallintaan kuuluvat myös
  // sen tiedostot, perehdytykset ja tehtäväpohjat — ne ovat kohteen ominaisuuksia.
  { id: 'guard_sites', label: 'Kohdevalinta ja kohteen hallinta' },
  // Kohteen tiedot: kooste siitä mitä kohteessa on tapahtunut (suoritetut tehtävät ja
  // kirjatut raportit). Erillinen oikeus, koska tämä on katselunäkymä eikä sen näkeminen
  // saa edellyttää oikeutta muokata kohteen perustietoja.
  { id: 'guard_site_info', label: 'Kohteen tiedot (kooste)' },
  // Työvuoron tehtävät: vartija kuittaa kohteelle määritellyt tehtävät suoritetuiksi.
  { id: 'guard_tasks', label: 'Työvuoron tehtävät' },
  // Kierrokset. KAKSI erillistä solmua tarkoituksella: pohjan laatiminen on esimiehen
  // työtä (mitkä pisteet kierretään ja missä järjestyksessä), kierroksen kulkeminen
  // vartijan. Sama henkilö ei useinkaan tee molempia, eikä vartijan pidä voida muokata
  // sitä kierrosta jota häntä pyydetään kulkemaan — muuten "kierros tehty kokonaan"
  // tarkoittaisi vain sitä, että vartija poisti pisteet joita ei ehtinyt käydä.
  { id: 'guard_patrol_templates', label: 'Kierrospohjat ja tarkistuspisteet' },
  { id: 'guard_patrols', label: 'Kierroksen kulkeminen' },
  // Hälytykset. Sama sääntö kuin EVENT-puolen 'alarms'-solmulla: näkeminen oikeuttaa myös
  // hälyttämään, muokkaus tarvitaan vain toisen hälytyksen kuittaamiseen. Vartijalle tämä
  // on erän tärkein solmu — yksin työskentelevän ajastin ja hätäpainike ovat sen takana.
  { id: 'guard_alarms', label: 'Hälytykset (näkeminen oikeuttaa myös hälyttämään)' },
  // Hälytyskeskus: päivystäjän (HÄLKE) näkymä kaikkiin kohteisiin yhtä aikaa. OMA
  // solmunsa eikä guard_alarms, ja ero on koko oikeuden pointti: hälytysten näkeminen on
  // jokaisen kentällä olevan oikeus, koska ilman sitä ei voi hälyttää. Jos hälytyskeskus
  // olisi saman solmun takana, jokainen vartija näkisi koko yrityksen valvomonäkymän —
  // kaikkien kohteiden tilanteen, kaikkien vartijoiden kirjaukset ja sen kuka on missäkin.
  //
  // Palvelimella tämä solmu oikeuttaa kahden kokoelman lukemiseen (server/permissions.js):
  // guardSites, koska ilman kohteen nimeä ja hälytysnumeroa hälytys ei kerro minne
  // soitetaan, ja alerts, koska ilman sitä koko näkymä on tyhjä. Kaikki muu — kierrokset,
  // kalusto, tiedotteet — vaatii oman solmunsa: hälytyskeskus KOKOAA sen mitä käyttäjä
  // saa muutenkin nähdä eikä avaa mitään uutta.
  //
  // MUOKKAUSOIKEUS on erässä 22 otettu käyttöön: se on oikeus LÄHETTÄÄ hälytystehtäviä
  // kentälle ja ratkaista poistumispyyntöjä (server/index.js: saaPaivystaa). Se ei ole
  // hälytyksen kuittaus — se on yhä guard_alarmsin muokkausoikeus, eikä sitä pidä voida
  // antaa kahdesta paikasta.
  //
  // Jako on sama kuin muuallakin: LUKU = näet kaikkien kohteiden tilanteen ja
  // hälytystehtävät, MUOKKAUS = lähetät keikan ja päätät saako vartija poistua kohteesta.
  // Vartija ei tarvitse tätä solmua lainkaan nähdäkseen hänelle kohdennetun
  // hälytystehtävän: kohdennus (vuoro, piirivuoro, säde) on portti, ei sivukartta.
  { id: 'guard_dispatch', label: 'Hälytyskeskus (muokkausoikeus = oikeus lähettää hälytystehtäviä ja hyväksyä poistumiset)' },
  // Vartijoiden sijainnit. OMA SOLMUNSA eikä osa hälytyskeskusta, ja ero on koko oikeuden
  // pointti: tilannekuvan näkeminen ("mikä palaa, mitä on kesken") ja henkilöstön
  // sijainnin näkeminen ("missä Virtanen on juuri nyt") ovat eri asioita. Jälkimmäinen on
  // työntekijään kohdistuvaa teknistä valvontaa, ja sen katselupiirin on oltava erikseen
  // päätettävissä — sama perustelu kuin EVENT-puolen 'locations'-solmulla.
  //
  // TÄMÄ SOLMU EI YKSIN NÄYTÄ MITÄÄN. Sijaintiseuranta on oletuksena pois päältä
  // (server/sijainti.js: SIJAINTISEURANTA=1) ja odottaa juridista työpakettia. Solmu on
  // silti olemassa, koska ilman sitä oikeutta ei voi myöntää lainkaan: GUARD-puolella
  // sijaintireitit tarkistivat erään 23 asti EVENT-puolen 'locations'-solmua, jota
  // GUARDin oikeuseditori ei näytä — eli oikeus oli olemassa muttei myönnettävissä.
  //
  // Globaali solmu samasta syystä kuin hälytyskeskus: päivystäjä katsoo kaikkia kohteita.
  { id: 'guard_locations', label: 'Vartijoiden sijainnit (tekninen valvonta, vaatii sijaintiseurannan)' },
  // Sijaintihistoria. ERI SOLMU KUIN guard_locations, eikä se ole hienojakoisuutta
  // hienojakoisuuden vuoksi:
  //
  //   guard_locations         "missä yksiköt ovat juuri nyt" — vanhenee 30 minuutissa,
  //                           tarvitaan tehtävän kohdentamiseen
  //   guard_location_history  "missä tämä ihminen on ollut" — 45 vuorokautta taaksepäin,
  //                           ei tarvita yhdenkään tehtävän hoitamiseen
  //
  // Jälkimmäinen on se jota tarvitaan vain jälkiselvityksessä, ja sen katselupiiri on
  // siksi pienempi. Vaikutustenarviointi kirjasi tämän avoimeksi kysymykseksi ("kuka saa
  // katsoa jälkeä ja mistä"), ja tämä solmu on siihen vastaus.
  //
  // Katsominen vaatii lisäksi SYYN, joka kirjataan auditlokiin (käyttäjän päätös
  // 16.9.2026). Oikeus avaa näkymän; syy kertoo mihin sitä käytettiin.
  { id: 'guard_location_history', label: 'Sijaintihistoria (jälkiselvitys, katselu vaatii kirjatun syyn)' },
  // Pohjamoottorin lajit (erä 8). Omat solmunsa EVENT-puolen vastaavista samasta syystä
  // kuin muutkin GUARD-solmut: oikeudet tallennetaan yhteiseen olioon, joten sama nimi
  // molemmilla puolilla jakaisi vahingossa saman oikeuden.
  //
  // Run sheet on tarkoituksella VAIN tapahtumapuolella: vartiointikohteen vuoro ei ole
  // aikataulutettu esitys vaan toistuva kierros, ja se on jo kierrospohja.
  { id: 'guard_guides', label: 'Ohjepankki (toimintakortit)' },
  { id: 'guard_plays', label: 'Skenaariot ja niiden läpivienti' },
  // Tiedotteet. Sama sääntö kuin EVENT-puolella: lukuoikeus näyttää ja oikeuttaa
  // kuittaamaan, muokkausoikeus oikeuttaa lähettämään.
  { id: 'guard_broadcast', label: 'Tiedotteet (muokkausoikeus = oikeus lähettää)' },
  // Kalustopankki (erä 20). Yrityksen koko kalusto yhtenä rekisterinä: avaimet,
  // ajoneuvot, asusteet, voimankäyttövälineet, aseet ja tietotekniikka. GLOBAALI solmu
  // (server/permissions.js: GLOBAL_NODES) eikä kohdekohtainen — pankin koko idea on
  // nähdä kerralla mitä yrityksellä on ja missä, ja kohdekohtainen rajaus olisi sama
  // kuin ei pankkia lainkaan.
  //
  // Oikeusjako on toiminnon ydin: LUKU = näet pankin ja voit PYYTÄÄ kalustoa kohteelle,
  // MUOKKAUS = jyvität ja ratkaiset pyynnöt. Sama jako kuin varustepoikkeamalla —
  // havainnon puutteesta saa tehdä se joka sen huomaa, päätöksen yrityksen omaisuudesta
  // ei. Oletuksena Vartioesimiehellä on luku, pääkäyttäjällä molemmat (server/roles.js).
  { id: 'guard_assets', label: 'Kalustopankki (muokkausoikeus = oikeus jyvittää ja hyväksyä pyynnöt)' },
  // Vartijan kalustonäkyvyys. OMA SOLMUNSA eikä guard_assets kapeampana, ja ero on koko
  // oikeuden pointti: tämä ei näytä pankkia lainkaan vaan sen kaluston joka on kirjattu
  // siihen kohteeseen jossa vartija on JUURI NYT vuorossa. Ilman vuoroa ei näy mitään.
  //
  // Luovutusketju — historia, pyynnöt ja kirjaaja — karsitaan palvelimella (kalusto.js:
  // vuoronKalusto). Avaimen historia kertoo kuka pääsi sisään ja milloin, ja se on samaa
  // henkilötietoa jonka takia keys.historia[].haltija on levyllä salattu.
  //
  // Rajaus tulee vuorosta eikä tapahtumarajauksesta: eventAccess kertoo mihin kohteisiin
  // tunnus saa koskea joskus, vuoro kertoo missä ihminen on nyt. Muokkausoikeutta ei
  // käytetä — tämä on lukuoikeus, ja kaluston kirjaaminen vaatii aina guard_assets-solmun.
  { id: 'guard_site_assets', label: 'Vuoron kohteen kalusto (vain luku, ei luovutusketjua)' },
  // HUOM: erillistä 'guard_keys'-solmua EI enää ole. GUARD-puolen avaimet ovat pankissa
  // lajina 'avain', ja tyhjä solmu lupaisi oikeuseditorissa sivun jota ei ole. EVENT-
  // puolen avainrekisteri ('keys'-solmu, server/avaimet.js) jatkaa ennallaan.
  { id: 'guard_equipment', label: 'Varustepoikkeamat' },
  // Mittaristo ja jälkiraportti (erä 9). KAKSI SOLMUA eikä yksi: mittaristo näyttää
  // lukuja, jälkiraportti on dokumentti joka jaetaan tilaajalle ja jossa sanotaan mikä
  // meni pieleen. Ne eivät kuulu samalle joukolle ihmisiä.
  //
  // Mittariston lukuoikeus EI ohita rivikohtaisia oikeuksia: palvelin laskee luvut vain
  // niistä tietueista jotka käyttäjä saisi lukea rivinä (server/index.js). Ilman tätä
  // "vyöhykkeellä 3 kirjausta" kertoisi juuri sen mitä rivioikeus on tarkoitettu
  // estämään.
  //
  // Jälkiraportissa lukuoikeus = raportin lukeminen, muokkausoikeus = laatiminen,
  // valmiiksi merkitseminen ja uudelleen avaaminen.
  //
  // GUARD-puolella jälkiraportti on jaksoraportti: vartioinnissa ei ole "tapahtuman
  // jälkeen", vaan kuukausi jonka luvut toimitetaan toimeksiantajalle.
  { id: 'guard_analytics', label: 'Mittaristo' },
  { id: 'guard_debrief', label: 'Jaksoraportit (kooste toimeksiantajalle)' },
  // Raportointi. Omat solmunsa lomaketyypeittäin samaan tapaan kuin tapahtumapuolen
  // tike_form_*-solmut: vartijan toimenpide on päivittäistä kirjaamista, kun taas
  // tapahtumailmoitus sisältää LYTP:n nojalla kirjattavat kohdehenkilötiedot ja voi
  // hyvin perustein olla eri joukolla ihmisiä.
  { id: 'guard_reporting', label: 'Raportointi', children: [
    { id: 'guard_report_action', label: 'Vartijan toimenpide' },
    { id: 'guard_report_jv', label: 'Vartijan tapahtumailmoitus' },
  ] },
  // Sovellusasetukset. Oma solmunsa eikä EVENTin 'settings', vaikka näkymä on sama:
  // muuten GUARD-tunnuksen asetusoikeus avaisi myös tapahtumapuolen asetukset ja
  // päinvastoin. Sisältö on sama kuin EVENT-puolella lukuun ottamatta pikatoimintoja
  // (hätätekstiviestit), jotka ovat tapahtumapuolen toiminto.
  { id: 'guard_settings', label: 'Sovellusasetukset' },
];
