import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptValue, decryptValue, isEncryptedValue } from './fieldcrypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// Sallittujen kokoelmien "allow-list" estää polkujen sekoilun ulkopuolisesta syötteestä
const COLLECTIONS = {
  checkins: 'checkins.json',
  reports: 'reports.json',
  events: 'events.json',
  riskAssessments: 'riskAssessments.json',
  employees: 'employees.json',
  readiness: 'readiness.json',
  // Tapahtumakohtaiset lisätyt lomakkeet ("Täytettävät lomakkeet" -sivun oma lista;
  // sisäänrakennetut lomakkeet ovat edelleen koodissa, koska niissä on toiminnallisuus).
  eventForms: 'eventForms.json',
  // Tapahtuman tiedostot: kansiot ja tiedostot samassa kokoelmassa (type-kenttä erottaa,
  // parentId tekee sisäkkäisyyden).
  eventFiles: 'eventFiles.json',
  // Tiedostojen ja kansioiden jakolinkit.
  fileShares: 'fileShares.json',
  // Pikatoimintonapit (hätätekstiviestit): nimi, vastaanottajaryhmä ja viestipohja.
  // EI tapahtumakohtainen — sama nappilista koko sovellukselle, mutta ryhmä ratkaistaan
  // aina valitun tapahtuman kontekstissa (ks. server/sms.js). Kokoelmassa ei ole
  // henkilötietoa muuta kuin napin oma kiinteä numerolista (customNumbers).
  smsButtons: 'smsButtons.json',
  // Lähetetyt hätäviestit ja niiden vastaanottajakohtaiset toimitustilat. Palvelin
  // ylläpitää yksin (webhook-kutsut päivittävät tiloja) — ks. index.js:n
  // PALVELIMEN_YLLAPITAMAT, joka estää kokoelman kirjoittamisen selaimesta.
  smsLog: 'smsLog.json',
  // Työntekijöiden vastaukset hätäviesteihin (Two-Way SMS). Sama: vain palvelin kirjoittaa.
  smsReplies: 'smsReplies.json',
  // Julkiset ilmoituslomakkeet: QR-juliste aidassa. Tietue kertoo mihin tapahtumaan
  // juliste kuuluu ja milloin se lakkaa toimimasta.
  publicForms: 'publicForms.json',
  // Yleisön lähettämät ilmoitukset. OMA KOKOELMANSA eikä reports: moderoimaton
  // tuntemattoman väite ei kuulu lakisääteiseen kirjausaineistoon, jolla on säilytysaika,
  // kenttäsalaus ja muuttumattomuuslukitus. TIKE luo hyväksyessään oikean kirjauksen.
  publicReports: 'publicReports.json',
  // --- Turvajohto GUARD ---
  // Vartiointikohteet. Rakenteellisesti sama kuin events: pitkäkestoinen kokonaisuus jolla
  // on omat työntekijänsä, kirjauksensa ja oikeutensa. Siksi kohteen id toimii samana
  // oikeusavaimena kuin tapahtuman id (ks. permissions.js: eventScoped) — vain
  // käyttöliittymän nimi on eri. Oma kokoelmansa eikä events, jotta tapahtumapuoli ei näe
  // kohteita listoissaan eikä olemassa olevaa dataa tarvitse migratoida.
  guardSites: 'guardSites.json',
  // Kohteen tiedostot (toimeksiantosopimus, pohjapiirros, vartio-ohje). Sama rakenne kuin
  // eventFiles: kansiot ja tiedostot samassa kokoelmassa, type erottaa ne ja parentId tekee
  // sisäkkäisyyden. Käyttää samaa uploads-koneistoa (server/uploads.js).
  guardFiles: 'guardFiles.json',
  // Vartijan kirjaamat raportit. Oma kokoelmansa eikä reports, jotta tapahtumapuolen
  // "Tallennetut raportit (kaikki tapahtumat)" ei sekoita niitä keskenään ja jotta
  // tuoteportti (index.js: tuoteEstaa) suojaa ne automaattisesti.
  guardReports: 'guardReports.json',
  // Työvuoron tehtävien suoritukset: mikä tehtävä, kuka, milloin ja mitkä kohdat kuitattiin.
  // Tehtävien MÄÄRITTELY on kohteen sisällä (guardSites.tehtavat) — se on kohteen ominaisuus,
  // suoritus taas tapahtuma ajassa.
  guardTaskRuns: 'guardTaskRuns.json',
  // Pohjat (perusta P6). YKSI kokoelma kaikille pohjalajeille, ja `kind` erottaa ne.
  // Ensimmäinen laji on kierrospohja; erä 8 tuo skenaariopohjat, ohjepankin ja run
  // sheetin samaan kokoelmaan. Neljä erillistä kokoelmaa tarkoittaisi neljä kertaa
  // samat versiointi-, omistajuus- ja instansointisäännöt.
  templates: 'templates.json',
  // Kierroksen suoritukset. Sama suhde pohjaan kuin guardTaskRunsilla tehtävään:
  // määrittely on pohjassa, suoritus on tapahtuma ajassa. Kierros on kuitenkin
  // PALVELIMEN YLLÄPITÄMÄ (index.js: PALVELIMEN_YLLAPITAMAT), koska sen säännöt —
  // vajaata ei voi sulkea, keskeytys vaatii syyn, kuittaus on peruuttamaton — menettäisivät
  // merkityksensä jos selain voisi kirjoittaa kokoelman suoraan.
  patrolRuns: 'patrolRuns.json',
  // Vuorot (erä 17). Vuoro on se mitä kierros on pohjalle: määrittely on kohteen
  // vuorotyypissä, suoritus on tapahtuma ajassa. Samasta syystä kuin patrolRuns tämä on
  // PALVELIMEN YLLÄPITÄMÄ (index.js: PALVELIMEN_YLLAPITAMAT) — vuoro jonka selain voisi
  // kirjoittaa olisi vuoro jonka perehdytysehdon voisi ohittaa kirjoittamalla tietueen
  // suoraan, ja koko perehdytysrajaus olisi silloin pelkkä käyttöliittymän este.
  guardShifts: 'guardShifts.json',
  // Tehtävänsiirrot ja pakotukset (erät 18–19). Yksi kokoelma molemmille, koska ne ovat
  // sama tapahtuma eri oikeudella: joku antaa jollekin tehtävän. Ero on `tapa`-kentässä
  // ja siinä mitä saaja voi tehdä. Palvelimen ylläpitämä kuten guardShifts.
  guardAssignments: 'guardAssignments.json',
  // Hälytystehtävät (erä 22): hälytyskeskuksen kentälle antama keikka — murtohälytys,
  // vartijakutsu tai ovenavaus. ERI KOKOELMA KUIN `alerts`, ja ero on koko rakenteen syy:
  // alerts on vartijan oma turvahälytys ("minulla on hätä"), tämä on työ jonka joku antaa
  // vartijalle ("mene katsomaan"). Samaan kokoelmaan laitettuina "avoimet hälytykset"
  // tarkoittaisi kahta eri joukkoa samassa listassa.
  //
  // Palvelimen ylläpitämä (index.js: PALVELIMEN_YLLAPITAMAT): tilaketju, vastaanotot ja
  // poistumisen hyväksyntä ovat koko toiminnon sisältö, ja selaimen kirjoitusoikeus
  // tarkoittaisi että vartija voi merkitä itsensä poistuneeksi kirjoittamalla tietueen.
  guardDispatch: 'guardDispatch.json',
  // Hälytykset (erä 7): ajastin, man-down, hätäpainike ja vyöhykepoikkeama. YKSI kokoelma
  // kaikille tyypeille samasta syystä kuin templates: tilamalli, kuittaus, eskalointi ja
  // valvomonäkymä ovat samat riippumatta siitä mikä hälytyksen laukaisi. Palvelimen
  // ylläpitämä (index.js: PALVELIMEN_YLLAPITAMAT) — hälytys jonka selain voisi kirjoittaa
  // olisi hälytys jonka selain voisi myös poistaa.
  //
  // TAPAHTUMAPUOLI JA GUARD SAMASSA KOKOELMASSA: eventId on tapahtuman TAI kohteen id,
  // aivan kuten oikeustarkistuksissa muutenkin. Vartijan hätäpainike ja tapahtuman
  // ajastinhälytys ovat sama asia, eikä valvomonäkymää kannata kirjoittaa kahdesti.
  alerts: 'alerts.json',
  // Pohjien suoritukset (erä 8): skenaarion läpivienti ja run sheetin ajo. Sama suhde
  // templates-kokoelmaan kuin patrolRunsilla kierrospohjaan — määrittely on pohjassa,
  // suoritus on tapahtuma ajassa. Palvelimen ylläpitämä samasta syystä kuin kierrokset:
  // säännöt (kriittistä kohtaa ei voi ohittaa, keskeytys vaatii syyn) menettäisivät
  // merkityksensä jos selain voisi kirjoittaa kokoelman suoraan.
  templateRuns: 'templateRuns.json',
  // Tiedotteet (erä 8): sovelluksen sisäinen viesti kentälle, jonka lukeminen kuitataan.
  // Palvelimen ylläpitämä, koska kuittauslista on koko toiminnon sisältö — selaimesta
  // kirjoitettava kuittauslista ei todistaisi mitään.
  broadcasts: 'broadcasts.json',
  // Avainrekisteri (erä 8): kenellä on mikäkin avain juuri nyt. Palvelimen ylläpitämä,
  // koska rekisteri jonka rivejä selain voi kirjoittaa ei kelpaa todisteeksi siitä kuka
  // pääsi sisään.
  keys: 'keys.json',
  // Varustepoikkeamat (erä 8). Oma kokoelmansa eikä kirjaus: poikkeama on TILA (radio on
  // rikki kunnes se korjataan) eikä muuttumaton tapahtuma, ja kirjausten koko idea on
  // niiden muuttumattomuus.
  equipmentIssues: 'equipmentIssues.json',
  // Jälkiraportit (erä 9). Palvelimen ylläpitämä, koska koko toiminnon arvo on siinä
  // että luvut on jäädytetty ja valmis raportti lukittu — kumpaakaan ei voi luvata jos
  // selain saa kirjoittaa kokoelman suoraan.
  //
  // Tapahtumapuoli ja GUARD samassa kokoelmassa samasta syystä kuin hälytyksissä:
  // ownerId on tapahtuman TAI kohteen id, ja rakenne on identtinen. Tapahtuman purku ja
  // vartiointikohteen jaksoraportti eroavat vain aikaikkunassa.
  debriefs: 'debriefs.json',
  // --- Laitesidonta (erä 10) ---
  // Sidotut laitteet: tunnus, käyttäjä, julkinen avain ja sidonta-aika. EI salaisuuksia —
  // yksityinen avain on laitteen Keystoressa eikä poistu sieltä, ja julkinen avain on
  // määritelmällisesti julkinen. Yksi laite tunnusta kohden; vaihto tapahtuu
  // hälytyskeskuksen tekemällä nollauksella.
  devices: 'devices.json',
  // Lyhytikäiset sidontakoodit. Koodi itse on TIIVISTEENÄ samasta syystä kuin salasanat:
  // se on viiden minuutin ajan pääsy tunnukseen. Kokoelma on lähes aina tyhjä.
  deviceCodes: 'deviceCodes.json',
  // Kalustopankki (erä 20): yrityksen koko kalusto yhtenä rekisterinä, josta tavaraa
  // jyvitetään kohteille ja vartijoille. EI kohdesidottu kuten keys — se on koko ero
  // avainrekisteriin: takki ja pakettiauto kiertävät kohteelta toiselle, eikä
  // kohdekohtainen rekisteri osaa kertoa missä ne ovat. Palvelimen ylläpitämä, koska
  // luovutusketju on rekisterin ainoa sisältö.
  assets: 'assets.json',
  // Avaintyyppikartta: tunnistuskuva ja nimi kullekin avainmallille (Abloy Exec,
  // iLOQ…). Oma kokoelmansa eikä kalustolajin osa, koska kartta on yrityksen yhteinen
  // luettelo eikä yksittäisen avaimen ominaisuus — sata avainta viittaa samaan
  // yhdeksään kuvaan. Palvelimen ylläpitämä kuten muukin kalusto.
  keyTypes: 'keyTypes.json',
  // PTT-kanavat (erä 26): vapaat ryhmät, henkilökohtaiset viestit (DM) ja hätäkanava.
  // EI kiinteitä kanavia (kohde/piiri) — niiden jäsenyys lasketaan vuorosta eikä
  // tallenneta lainkaan, ks. server/kanavat.js. Palvelimen ylläpitämä samasta syystä
  // kuin guardDispatch: osallistujalista on koko toiminnon sisältö, ja selaimen
  // kirjoitusoikeus tarkoittaisi että käyttäjä voisi lisätä itsensä mihin tahansa
  // keskusteluun kirjoittamalla tietueen suoraan.
  guardKanavat: 'guardKanavat.json',
  // Pakotetut jäsenpoikkeukset kiinteille (kohde/piiri/alue) PTT-kanaville (erä 26,
  // jatko 26.9.2026, käyttäjän pyyntö: HÄLKE voi lisätä/poistaa vartijan tietyltä
  // kanavalta riippumatta vuorosta). ERI KOKOELMA kuin guardKanavat: nuo ovat itse
  // kanavia (dm/vapaa/hata), tämä on päälle menevä poikkeuslista kiinteille
  // kanaville joita EI tallenneta ollenkaan muuten (server/kanavat.js:n oma
  // yläkommentti). Palvelimen ylläpitämä samasta syystä kuin guardKanavat.
  guardKanavaJasenet: 'guardKanavaJasenet.json',
  // PTT-kanavien päästä-päähän-salauksen laiteavaimet (erä 26, vaihe 2): rivi per
  // rekisteröity laite, vain JULKISTA avainmateriaalia (server/kryptoavaimet.js).
  // Palvelimen ylläpitämä samasta syystä kuin guardKanavat: identiteetin eheys on koko
  // kokoelman tarkoitus, ja vapaa kirjoitusoikeus mahdollistaisi identiteetin korvaamisen.
  guardAvaimet: 'guardAvaimet.json',
  // Laitteiden väliset kohdennetut viestit (to-device, erä 26, vaihe 2, viipale 2c) —
  // server/laiteviestit.js. Ephemeerinen jono: rivit poistuvat kun kohdelaite hakee ne.
  guardLaiteviestit: 'guardLaiteviestit.json',
  // PTT-kanavien tekstiviestit (erä 26, vaihe 3): salattuja tapahtumaolioita, ei
  // sisältöä (server/viestit.js). Palvelin ei koskaan pura eikä lue niitä.
  guardViestit: 'guardViestit.json',
  // Viestien toimitus-/lukukuittaukset (erä 26, vaihe 3, viipale 3c) —
  // server/kuittaukset.js. Lisäystä eikä muokkausta: viesti ei koskaan muutu.
  guardKuittaukset: 'guardKuittaukset.json',
  // Salattujen mediliitteiden metatieto (erä 26, vaihe 3, viipale 3d) — kanavan tunnus
  // TALLENNETAAN VAIN KÄYTTÖOIKEUDEN RATKAISEMISEKSI (server/index.js), koska liitteen
  // sisältö itse on opaakkia eikä palvelin voi päätellä siitä mihin kanavaan se kuuluu.
  guardLiitteet: 'guardLiitteet.json',
};

// Kentät jotka salataan levyllä (ks. fieldcrypto.js). Tässä on tarkoituksella vain
// suora tunniste jonka selväkielinen säilytys on erikseen lain piirissä
// (tietosuojalaki 29 §, henkilötunnus) — ei kaikkea henkilötietoa, koska jokainen
// salattu kenttä on kenttä jolla ei voi enää hakea, lajitella eikä suodattaa levyn
// tasolla, ja jonka avaimen menetys tarkoittaa kentän menetystä. Kenttiä voi lisätä
// tähän listaan yksi rivi kerrallaan: migraatio (selväkielinen -> salattu ensimmäisellä
// luvulla) toimii sen jälkeen automaattisesti myös uudelle kentälle.
//
// Huom: employees.address on tästä tarkoituksella pois — se on henkilötietoa mutta ei
// henkilötunnus. Jos se halutaan mukaan, riittää lisätä 'address' tähän taulukkoon.
//
// reports.summary on mukana toisesta syystä kuin employees.personalId. LYTP ja sen
// nojalla annettu asetus oikeuttavat kirjaamaan tapahtumailmoitukseen toimenpiteiden
// kohteena olleiden sukunimen, etunimet, henkilötunnuksen ja osoitetiedot sekä
// tuntomerkit. Kun laki nimenomaisesti sallii sen, raportin vapaa teksti on
// oletettava tällaista tietoa sisältäväksi — eikä kenttäkohtainen salaus voi tietää
// mitä vapaaseen tekstiin on kirjoitettu, joten koko kenttä salataan. Tämä on
// tarkoituksella varovainen valinta: väärä suunta olisi jättää voimankäyttö- ja
// kiinniottoraporttien teksti selväkieliseksi siksi että se "yleensä" ei sisällä
// henkilötunnusta.
// Raporttien salattavat kentät ovat kaikki niitä joihin kirjoitetaan vapaata tekstiä:
// summary (yhteenveto/kuvaus), description (järjestyksenvalvojan vapaa kuvaus),
// actions (tehdyt toimenpiteet), resources (käytetyt resurssit) ja employees
// (paikalla olleet työntekijät, eli nimiä). typeId, eventId, author, time ja
// numeeriset/totuusarvoiset kentät jäävät selväkielisiksi: niitä käytetään
// suodatukseen ja oikeustarkistuksiin (mm. canReadAttachment lukee typeId:n ja
// eventId:n), eivätkä ne sisällä vapaata tekstiä.
// Järjestyksenvalvojan tapahtumailmoituksen (typeId 'jvreport') kohdehenkilökentät ovat
// suoria tunnisteita: LYTP ja sen nojalla annettu asetus oikeuttavat kirjaamaan
// toimenpiteiden kohteena olleiden sukunimen, etunimet, henkilötunnuksen ja
// osoitetiedot sekä tuntomerkit. Nämä ovat arkaluonteisempia kuin työntekijöiden omat
// tiedot: ne kertovat kenelle on tehty voimankäyttö- tai kiinniottotoimenpide.
// Selväkielisiksi jäävät place, licenseHolder, date ja time (eivät henkilötietoa) sekä
// author, typeId ja eventId (suodatus ja oikeustarkistukset).
const ENCRYPTED_FIELDS = {
  // Jakolinkin token antaa pääsyn tiedostoon ilman kirjautumista, joten se on
  // salasanaan rinnastuva salaisuus eikä saa olla levyllä selväkielisenä.
  fileShares: ['token'],
  // personalId ja taxNumber ovat molemmat henkilön yksilöiviä viranomaistunnisteita,
  // joten kumpikaan ei saa olla levyllä selväkielisenä.
  employees: ['personalId', 'taxNumber'],
  // Hätäviestin runko on vapaata tekstiä jonka lähettäjä kirjoittaa lähetysikkunassa,
  // ja työntekijän VASTAUS on vapaata tekstiä jonka hän kirjoittaa puhelimellaan.
  // Kumpaakaan ei voi kenttätasolla tietää sisällöltään, joten ne salataan samalla
  // perusteella kuin reports.summary. Huom: tämä ei suojaa itse tekstiviestiä —
  // se kulkee televerkossa salaamattomana, minkä takia runkoon ei saa alun perinkään
  // kirjoittaa henkilötunnusta. Salaus koskee vain levylle jäävää kopiota.
  smsLog: ['body'],
  smsReplies: ['body'],
  reports: [
    'summary',
    'description',
    'tikeComment',
    'taskTitle',
    'taskDoneComment',
    'actions',
    'resources',
    'employees',
    'subjectLastName',
    'subjectFirstNames',
    'subjectPersonalId',
    'subjectAddress',
    'subjectFeatures',
    'subjectObservations',
    // Korjausmerkinnän teksti (ks. kirjaukset.js): lukittua kirjausta ei muuteta
    // ylikirjoittamalla vaan lisäämällä merkintä, ja se merkintä on vapaata tekstiä
    // samalla tavalla kuin description — eli se voi sisältää kohdehenkilön tietoja.
    'corrections[].text',
    // Hyväksytystä yleisöilmoituksesta periytyvät kentät. Sama teksti on jo salattuna
    // publicReports-kokoelmassa, ja se on suojattava myös siinä kopiossa joka
    // moderoinnin jälkeen jää kirjaukseen — muuten hyväksyminen purkaisi salauksen.
    // Yhteystieto on määritelmällisesti henkilötietoa aina kun se on täytetty.
    'reporterPlace',
    'reporterContact',
  ],
  // Vartijan raportit salataan TÄSMÄLLEEN samoin kuin tapahtumapuolen raportit: vartijan
  // tapahtumailmoitus sisältää samat LYTP:n nojalla kirjattavat kohdehenkilötiedot
  // (nimi, henkilötunnus, osoite, tuntomerkit) ja saman vapaan tekstin. Sama laki, sama
  // arkaluonteisuus, sama suoja — lista on tarkoituksella identtinen reportsin kanssa,
  // jotta puolien välille ei synny eroa jota kukaan ei ole päättänyt.
  guardReports: [
    'summary',
    'description',
    'tikeComment',
    'taskTitle',
    'taskDoneComment',
    'actions',
    'resources',
    'employees',
    'subjectLastName',
    'subjectFirstNames',
    'subjectPersonalId',
    'subjectAddress',
    'subjectFeatures',
    'subjectObservations',
    // Korjausmerkinnän teksti (ks. kirjaukset.js): lukittua kirjausta ei muuteta
    // ylikirjoittamalla vaan lisäämällä merkintä, ja se merkintä on vapaata tekstiä
    // samalla tavalla kuin description — eli se voi sisältää kohdehenkilön tietoja.
    'corrections[].text',
    // Hyväksytystä yleisöilmoituksesta periytyvät kentät. Sama teksti on jo salattuna
    // publicReports-kokoelmassa, ja se on suojattava myös siinä kopiossa joka
    // moderoinnin jälkeen jää kirjaukseen — muuten hyväksyminen purkaisi salauksen.
    // Yhteystieto on määritelmällisesti henkilötietoa aina kun se on täytetty.
    'reporterPlace',
    'reporterContact',
  ],
  // Tehtäväsuorituksen vapaa huomiokenttä: vartija kirjoittaa siihen mitä kierroksella
  // havaittiin, eikä kenttätasolla voi tietää mitä sinne on kirjoitettu.
  guardTaskRuns: ['huomiot'],
  // Kierroksen vapaat tekstit samalla perusteella kuin guardTaskRuns.huomiot: vartija
  // kirjoittaa niihin havaintonsa, ja keskeytyksen syy voi kertoa mitä kohteessa oli
  // tapahtunut. Pistekohtaiset huomiot ovat listan sisällä (piste-taso).
  patrolRuns: ['huomiot', 'keskeytysSyy', 'pisteet[].huomio'],
  // Hälytyksen vapaat tekstit. `kuvaus` kertoo mitä vartija oli tekemässä ("tarkastan
  // kellarikäytävän"), `kuittausHuomio` mitä hälytyksestä seurasi, ja historian teksteihin
  // päätyvät molemmat tiivistettyinä. Sijaintia (gps) EI voi salata: se on numeroita, ja
  // kenttäsalaus toimii vain merkkijonoille — se on tietoinen rajaus, ei unohdus.
  alerts: ['kuvaus', 'kuittausHuomio', 'historia[].teksti'],
  // Hälytystehtävän vapaat tekstit (erä 22). Hälytyskeskuksen havainto on määritelmällisesti
  // kuvaus ihmisestä silloin kun kohteessa on ihminen — juuri se on havainnon tarkoitus
  // ("aulassa näkyy huppupäinen henkilö"). Sama teksti toistuu lokirivillä, ja päivystäjän
  // palautuskommentti kertoo mitä kohteessa on tekemättä.
  //
  // `silmukka` jää selväkieliseksi: se on hälytinjärjestelmän pisteen nimi ("Etuovi mg"),
  // eli rakennuksen ominaisuus eikä tieto kenestäkään.
  guardDispatch: [
    'havainnot[].teksti',
    'loki[].teksti',
    'yksikot[].syy',
  ],
  // Kohteen master-koodi on hälytysjärjestelmän ohituskoodi: se avaa kohteen kenelle
  // tahansa joka sen tietää, joten se on salasanaan rinnastuva salaisuus eikä kohteen
  // ominaisuus. Avainten lisätiedot kertovat mikä avain käy mihinkin oveen, mikä on sama
  // tieto toisin sanottuna. Avainnumerot ja järjestelmän merkki jäävät selväkielisiksi:
  // numero ilman lisätietoa ei avaa mitään, ja "AJAX" on tuotenimi.
  guardSites: ['masterkoodi', 'avaimet[].lisatieto'],
  // Suorituksen vapaat tekstit. `kuvaus` on se yksittäinen tilanne jota hoidetaan
  // ("poika 6 v, punainen takki, isä odottaa portilla") — se on määritelmällisesti
  // henkilötietoa aina kun tilanne koskee ihmistä, ja skenaariot koskevat. Kohtien
  // huomiot ovat samaa tekstiä kohta kerrallaan.
  //
  // Pohjan (templates) kohdat EIVÄT ole salattuja: ne ovat menettelyohjeita
  // ("sulje portit"), eivät tietoa kenestäkään.
  templateRuns: ['kuvaus', 'huomiot', 'keskeytysSyy', 'kohdat[].huomio'],
  // Tiedotteen runko on vapaata tekstiä jonka laatija kirjoittaa kentälle, ja siinä
  // mainitaan usein ihmisiä nimeltä ("Virtanen jää portille 2"). Otsikko jää
  // selväkieliseksi: se on listan rivi eikä sisältö.
  broadcasts: ['viesti'],
  // Avaimen haltija on ihmisen nimi — usein sellaisen ihmisen, jolla ei ole tunnusta
  // järjestelmään (siivooja, huoltomies). Historian tekstit ovat vapaata tekstiä samasta
  // tapahtumasta. Avaimen tunnus ("A-12 pääovi") jää selväkieliseksi: se on esineen nimi.
  keys: ['haltija', 'historia[].haltija', 'historia[].teksti'],
  // Kalustopankki (erä 20). `sijoitusNimi` on VARTIJAN NIMI silloin kun esine on
  // luovutettu henkilölle — sama peruste kuin avaimen haltijalla, ja voimankäyttövälineen
  // kohdalla painavampi. Historiarivit kantavat oman kopionsa siitä nimestä, joten ne on
  // salattava erikseen.
  //
  // HUOM: kentät ovat litteitä (`sijoitusNimi`) eivätkä sisäkkäisiä (`sijoitus.nimi`),
  // koska alla oleva jaaTaulukkopolku tuntee vain muodot `kentta` ja `taulukko[].kentta`.
  // Pisteellä erotettu polku menisi tälle listalle läpi mutta ei salaisi mitään — eikä
  // siitä kerrottaisi mitenkään. Tietue on siksi muotoiltu salauksen ehdoilla.
  //
  // Tunnus, laji ja sarjanumero jäävät selväkielisiksi: ne ovat esineen tietoja, ja
  // tunnuksella haetaan (QR-skannaus etsii rivin tunnuksella).
  assets: ['sijoitusNimi', 'historia[].sijoitusNimi', 'historia[].teksti'],
  // Poikkeaman kuvaus ja käsittelyn huomio ovat vapaata tekstiä, jossa mainitaan usein
  // ihmisiä ("Virtasen radio kastui"). Varusteen nimi jää selväkieliseksi.
  equipmentIssues: ['kuvaus', 'kasittelyHuomio'],
  // Tarkistuspisteen token on tarrassa seinässä eikä salaisuus, mutta se on ainoa asia
  // joka todistaa skannauksen kohdistuneen oikeaan pisteeseen — samalla perusteella
  // salattu kuin ilmoitusjulisteen token.
  //
  // HUOM: polku on `pisteet[].token` eikä `sisalto.pisteet[].token`, koska
  // jaaTaulukkopolku (alla) osaa vain YLÄTASON taulukon. Sisäkkäinen polku jäisi hiljaa
  // salaamatta — juuri sen takia kierrospohjan pisteet ovat tietueen ylätasolla.
  templates: ['pisteet[].token'],
  // Ilmoituslomakkeen token on jakolinkin tokeniin rinnastuva: se antaa oikeuden
  // kirjoittaa järjestelmään ilman kirjautumista.
  publicForms: ['token'],
  // Yleisön kirjoittama teksti salataan samalla perusteella kuin reports.summary:
  // kenttätasolla ei voi tietää mitä ilmoittaja on kirjoittanut, ja hän voi kirjoittaa
  // sekä omansa että jonkun toisen henkilötietoja. Yhteystieto on määritelmällisesti
  // henkilötietoa aina kun se on täytetty.
  publicReports: ['kuvaus', 'paikka', 'yhteystieto'],
  // Jälkiraportin vapaat osiot ovat sitä tekstiä jossa kerrotaan mikä meni pieleen ja
  // kenen kohdalla ("ensiapu viivästyi kun portin JV ei tavoittanut ..."). Samalla
  // perusteella salattu kuin reports.summary: kenttätasolla ei voi tietää mitä
  // purkupalaverissa on kirjoitettu. Toimenpiteen vastuu on ihmisen nimi.
  //
  // JÄÄDYTETTYJÄ LUKUJA (kooste) ei salata eikä voidakaan: se on sisäkkäinen olio, ja
  // kenttäsalaus osaa vain ylätason kentän tai ylätason taulukon kentän. Se ei ole
  // puute — kooste on lukumääriä eikä tekstiä, eikä yksikään sen luku yksilöi ketään.
  debriefs: [
    'yhteenveto', 'onnistui', 'kehitettavaa', 'oppi',
    'toimenpiteet[].teksti', 'toimenpiteet[].vastuu', 'historia[].teksti',
  ],
};

fs.mkdirSync(DATA_DIR, { recursive: true });

// Käy läpi kokoelman salattavat kentät ja palauttaa UUDEN taulukon muunnetuin arvoin.
// Ei koskaan muuta parametrina saatuja olioita paikallaan: kutsuja (esim. index.js:n
// PUT-reitti, joka lokittaa ja palauttaa saman datan) pitää edelleen käytössään
// selväkielisen version. Tämä on sama sudenkuoppa joka väistettiin db.js:n
// writeUsers()-funktiossa TOTP-salauksen kanssa.
// Kenttänimi voi olla myös muotoa 'taulukko[].kentta', jolloin salaus kohdistuu
// taulukossa olevien olioiden yhteen kenttään. Ilman tätä muotoa taulukkokenttä
// näyttäisi suojatulta olematta sitä: alla oleva silmukka ohittaa kaiken mikä ei ole
// merkkijono, joten pelkkä 'corrections' listalla ei salaisi mitään eikä myöskään
// kertoisi siitä mitenkään.
function jaaTaulukkopolku(field) {
  const i = field.indexOf('[].');
  if (i === -1) return null;
  return { taulukko: field.slice(0, i), kentta: field.slice(i + 3) };
}

const onSelvakielinen = (value) =>
  typeof value === 'string' && value !== '' && !isEncryptedValue(value);

function mapEncryptedFields(name, records, transform) {
  const fields = ENCRYPTED_FIELDS[name];
  if (!fields || !Array.isArray(records)) return records;
  return records.map((record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
    let copy = null; // luodaan vain jos jokin kenttä oikeasti muuttuu
    for (const field of fields) {
      const polku = jaaTaulukkopolku(field);
      if (polku) {
        const taulukko = record[polku.taulukko];
        if (!Array.isArray(taulukko)) continue;
        let muuttui = false;
        const uusi = taulukko.map((alkio) => {
          if (!alkio || typeof alkio !== 'object' || Array.isArray(alkio)) return alkio;
          const arvo = alkio[polku.kentta];
          if (typeof arvo !== 'string' || arvo === '') return alkio;
          const seuraava = transform(arvo);
          if (seuraava === arvo) return alkio;
          muuttui = true;
          return { ...alkio, [polku.kentta]: seuraava };
        });
        if (muuttui) {
          if (!copy) copy = { ...record };
          copy[polku.taulukko] = uusi;
        }
        continue;
      }
      const value = record[field];
      // Tyhjä tai puuttuva arvo jätetään koskematta: ei haluta tallentaa salattua
      // tyhjää merkkijonoa, joka näyttäisi levyllä täytetyltä kentältä.
      if (typeof value !== 'string' || value === '') continue;
      const next = transform(value);
      if (next === value) continue;
      if (!copy) copy = { ...record };
      copy[field] = next;
    }
    return copy || record;
  });
}

// Onko levyllä vielä selväkielisiä arvoja salattavissa kentissä (eli tarvitaanko
// kertaluonteinen migraatio). Tunnistetaan enc:-etuliitteen puuttumisesta, samaan
// tapaan kuin db.js:n needsTotpEncryption.
function hasPlaintextFields(name, records) {
  const fields = ENCRYPTED_FIELDS[name];
  if (!fields || !Array.isArray(records)) return false;
  return records.some(
    (record) =>
      record &&
      typeof record === 'object' &&
      fields.some((field) => {
        const polku = jaaTaulukkopolku(field);
        if (polku) {
          const taulukko = record[polku.taulukko];
          return Array.isArray(taulukko) && taulukko.some((alkio) => onSelvakielinen(alkio?.[polku.kentta]));
        }
        return onSelvakielinen(record[field]);
      })
  );
}

export function readCollection(name) {
  const file = COLLECTIONS[name];
  if (!file) throw new Error(`Tuntematon kokoelma: ${name}`);
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return null; // null = ei vielä tallennettua dataa, käytä oletusarvoja frontissa
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
  // Salauksen purku on tarkoituksella try/catchin ULKOPUOLELLA: jos purku epäonnistuu
  // (väärä avain, vioittunut tavu), pyynnön pitää kaatua näkyvästi. Jos palauttaisimme
  // tässä null/tyhjän, kokoelma näyttäisi tyhjältä — ja koska romahdussuoja
  // (wouldWipeNonEmptyCollection) vertaa uutta dataa nimenomaan nykyiseen, tyhjä
  // nykytila avaisi tien sille että seuraava tallennus ylikirjoittaa koko kokoelman.
  // Näkyvä 500 on aina parempi kuin hiljainen datan menetys.
  const plain = mapEncryptedFields(name, parsed, decryptValue);
  // Kertaluonteinen migraatio: tätä ominaisuutta edeltävä data on levyllä
  // selväkielisenä, ja se salataan heti ensimmäisellä luvulla. Ei kirjoiteta joka
  // luvulla — writeCollection salaa aina uudella satunnaisella IV:llä, joten sama
  // henkilötunnus tuottaisi joka kerta eri salatekstin ja levylle kirjoitettaisiin
  // turhaan jokaisella GET-pyynnöllä.
  if (hasPlaintextFields(name, parsed)) {
    try {
      writeCollection(name, plain);
    } catch (err) {
      // Migraation epäonnistuminen ei saa estää datan lukemista — kutsuja saa oikean
      // selväkielisen datan joka tapauksessa, ja migraatiota yritetään uudelleen
      // seuraavalla luvulla.
      console.error(`Kenttäsalauksen migraatio epäonnistui kokoelmalle ${name}:`, err.message);
    }
  }
  return plain;
}

export function writeCollection(name, data) {
  const file = COLLECTIONS[name];
  if (!file) throw new Error(`Tuntematon kokoelma: ${name}`);
  const p = path.join(DATA_DIR, file);
  const tmp = `${p}.tmp`;
  // Jo salattu arvo jätetään ennalleen: kahteen kertaan salaaminen olisi hiljainen
  // datan korruptio (yksi purku palauttaisi yhä "enc:"-alkuisen merkkijonon, joka
  // näkyisi käyttöliittymässä henkilötunnuksen paikalla).
  const forStorage = mapEncryptedFields(name, data, (value) =>
    isEncryptedValue(value) ? value : encryptValue(value)
  );
  fs.writeFileSync(tmp, JSON.stringify(forStorage, null, 2));
  fs.renameSync(tmp, p);
}

export const KNOWN_COLLECTIONS = Object.keys(COLLECTIONS);

// Datahakemiston tiedostojärjestelmän tilanne (Asetukset-näkymän tallennustilamittari).
// Tämä moduuli tuntee DATA_DIRin, joten levytilan luku kuuluu tänne eikä reitille.
// fs.statfsSync eikä ulkoinen df: ei riipu shellistä eikä sen tulosteen muodosta.
//
// Luvut lasketaan TÄSMÄLLEEN samalla tavalla kuin df, jotta käyttöliittymä ja
// palvelimelta ajettu `df -h` eivät ole eri mieltä (se näyttäisi bugilta):
//   used  = (blocks - bfree) * bsize   -> myös rootille varattu osuus on "vapaana"
//   avail = bavail * bsize             -> mitä tavallinen käyttäjä voi kirjoittaa
//   %     = used / (used + avail)      -> ei used/total, koska varattu osuus
//                                         ei kuulu kumpaankaan
// Ero on tässä ~3 prosenttiyksikköä (ext4 varaa oletuksena 5 % rootille).
export function getStorageUsage() {
  const st = fs.statfsSync(DATA_DIR);
  const total = st.blocks * st.bsize;
  const used = (st.blocks - st.bfree) * st.bsize;
  const free = st.bavail * st.bsize;
  const nayttoTila = used + free;
  return {
    total,
    used,
    free,
    usedPercent: nayttoTila > 0 ? Math.round((used / nayttoTila) * 1000) / 10 : 0,
  };
}
