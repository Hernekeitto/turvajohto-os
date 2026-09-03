import type { SivukarttaSolmu } from './shared/oikeudet';

// Turvajohto EVENT -puolen sivukartta. Oma moduulinsa eika App.tsx:n sisalla, koska
// kayttajatasojen editori nayttaa molempien puolien kartat — myos GUARD-puolelta avattuna.
// Ilman tata GuardApp joutuisi tuomaan koko App.tsx:n pelkan taulukon takia.
// Sivukartta: sovelluksen sivut/valikot solmupuuna. Id:t ovat pääosin olemassa
// olevia activeTab-arvoja (uudelleenkäyttö) — backend ei tunne tätä puuta, se
// tallentaa vain geneerisen { [id]: { view, edit } } -olion.
export const SITEMAP: SivukarttaSolmu[] = [
  // 'landing' oli aiemmin tapahtuman sisäinen Aloitussivu-välilehti. Välilehteä ei enää
  // ole: solmu ratkaisee nyt sen, kuka näkee etusivun "Valitse tapahtuma" -näkymän (ja
  // tapahtumien luonnin/muokkauksen, ks. server/permissions.js COLLECTIONS.events).
  { id: 'landing', label: 'Tapahtumavalinta' },
  { id: 'overview', label: 'Tilannekuva' },
  // Henkilöstön sijainti kartalla. OMA solmunsa eikä osa tilannekuvaa: kaikki jotka
  // saavat nähdä kirjaukset eivät saa nähdä missä työntekijät ovat. Sijainti on
  // työntekijään kohdistuvaa valvontatietoa, ja sen katselupiirin on oltava erikseen
  // päätettävissä (ks. juridinen työpaketti). Solmu näkyy oikeuseditorissa vaikka
  // seuranta olisi kytketty pois — muuten oikeutta ei voisi valmistella etukäteen.
  { id: 'locations', label: 'Henkilöstön sijainti kartalla' },
  // Hälytykset: ajastin, man-down, hätäpainike ja vyöhykepoikkeamat.
  //
  // LUKUOIKEUS ON MYÖS OIKEUS HÄLYTTÄÄ. Tämä poikkeaa muusta sovelluksesta tarkoituksella:
  // hätäpainikkeen on toimittava jokaiselle joka ylipäätään näkee hälytysnäkymän, koska
  // muokkausoikeuden vaatiminen tarkoittaisi että osa kentällä olevista ei voisi hälyttää.
  // Muokkausoikeus ratkaisee vain sen, kuka saa kuitata TOISEN hälytyksen — oman saa
  // kuitata aina.
  { id: 'alarms', label: 'Hälytykset (näkeminen oikeuttaa myös hälyttämään)' },
  // Pohjamoottorin lajit (erä 8). Kaikki kolme ovat samaa koneistoa eri sisällöllä, mutta
  // omat solmunsa: ohjekortin lukeminen on eri asia kuin skenaarion käynnistäminen tai
  // ajolistan muokkaaminen, eikä niitä pidä myöntää samalla ruksilla.
  //
  // Näkeminen ja käyttö ovat SAMA oikeus: skenaarion käynnistäminen ja ohjekortin
  // lukeminen molemmat lukevat saman pohjan, joten erillinen "saa käyttää" -oikeus
  // lupaisi rajausta jota ei ole olemassa. Muokkausoikeus ratkaisee kuka laatii pohjat.
  { id: 'guides', label: 'Ohjepankki (toimintakortit)' },
  { id: 'plays', label: 'Skenaariot ja niiden läpivienti' },
  { id: 'runsheet', label: 'Run sheet (tapahtuman ajolista)' },
  // Tiedotteet. LUKUOIKEUS = tiedote näkyy ja sen voi kuitata; MUOKKAUSOIKEUS = tiedotteen
  // saa lähettää. Tämä on tarkoituksellinen ero pikatoimintoihin (hätäviestit), joissa
  // sama jako koskee tekstiviestin lähettämistä: viestin lähettäminen kaikille on
  // toimivalta, sen lukeminen ei.
  { id: 'broadcast', label: 'Tiedotteet (muokkausoikeus = oikeus lähettää)' },
  // Kalusto: avaimet ja varustepoikkeamat. Omat solmunsa, koska avainrekisteri kertoo
  // kuka pääsee sisään ja se on eri luottamusasia kuin rikkinäisen taskulampun
  // ilmoittaminen. Molemmissa lukuoikeus näyttää, muokkausoikeus oikeuttaa kirjaamaan.
  { id: 'keys', label: 'Avainhallinta' },
  { id: 'equipment', label: 'Varustepoikkeamat' },
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
  { id: 'analytics', label: 'Mittaristo' },
  { id: 'debrief', label: 'Jälkiraportit (purku ja opit)' },
  { id: 'reporting', label: 'Raportointi', children: [
    { id: 'report_jv', label: 'Järjestyksenvalvojan tapahtumailmoitus' },
    { id: 'report_tike', label: 'TIKE:n raportointi', children: [
      { id: 'tike_form_in', label: 'Työntekijän sisäänkirjaus' },
      { id: 'tike_form_out', label: 'Työntekijän uloskirjaus' },
      { id: 'tike_form_jvaction', label: 'JV:n tai vartijan toimenpide' },
      { id: 'tike_form_open', label: 'Avoin kirjaus' },
      { id: 'tike_form_firstaid', label: 'Ensiaputilanne' },
      { id: 'tike_form_threat', label: 'Uhkatilanne' },
      { id: 'tike_form_fence', label: 'Aitojen ylitys / luvaton sisäänpääsy' },
      { id: 'tike_form_damage', label: 'Omaisuusvaurio' },
      { id: 'tike_form_lostfound', label: 'Löytötavara' },
      { id: 'tike_form_patrol', label: 'Kierrosraportti' },
      { id: 'tike_form_queue', label: 'Portin jonon odotusaika' },
      { id: 'tike_form_weather', label: 'Sääraportti' },
      { id: 'tike_form_briefing', label: 'Briefing' },
      { id: 'tike_form_management', label: 'Johdon tilannekatsaus' },
    ] },
    { id: 'report_list', label: 'Tallennetut raportit (tapahtuma)' },
    // Yleisöilmoitukset: QR-julisteiden hallinta ja saapuneiden ilmoitusten moderointi.
    // Oma solmunsa, koska moderointi on eri työtä kuin kirjausten tekeminen — ja koska
    // tämän takana näkyy tuntemattomien lähettämää moderoimatonta tekstiä.
    { id: 'public_reports', label: 'Yleisöilmoitukset ja moderointi' },
  ] },
  { id: 'planning', label: 'Ennen tapahtumaa', children: [
    { id: 'planning_readiness', label: 'Avausvalmius' },
    { id: 'planning_employees', label: 'Tapahtuman työntekijät' },
  ] },
  { id: 'postevent', label: 'Tapahtuman yleiskatsaus' },
  { id: 'documents', label: 'Lomakekartoitus', children: [
    { id: 'documents_forms', label: 'Täytettävät lomakkeet' },
    { id: 'documents_pdf', label: 'Raporttien PDF-versiot' },
    { id: 'documents_trash', label: 'Roskakori' },
    { id: 'documents_emergency', label: 'Hätätilanneohjeet' },
    { id: 'documents_risk', label: 'Riskiarviointi', children: [
      { id: 'documents_risk_done', label: 'Tehdyt riskiarviot' },
      { id: 'documents_risk_new', label: 'Riskin arviointi' },
    ] },
  ] },
  // Tapahtuman tiedostot: omat kansiot ja tiedostot, joita voi jakaa myös ulkopuolisille
  // (ks. server/shares.js). Sijaitsee sivuvalikossa Lomakekartoituksen ja
  // Sovellusasetusten välissä.
  { id: 'eventfiles', label: 'Tapahtuman tiedostot' },
  // Yläpalkin Pikatoiminnot-valikko (hätätekstiviestit). Näkyvyysoikeus näyttää valikon;
  // MUOKKAUSOIKEUS on se joka oikeuttaa viestin lähettämiseen — sama tarkistus tehdään
  // palvelimella (server/index.js: saaLahettaa). Nappien sisällön muokkaus on erikseen
  // Sovellusasetusten takana, koska se määrää kenelle viesti lähtee ja mitä siinä lukee.
  { id: 'quickactions', label: 'Pikatoiminnot (hätäviestit)' },
  { id: 'settings', label: 'Sovellusasetukset' },
  { id: 'global_reports', label: 'Tallennetut raportit (kaikki tapahtumat)' },
  { id: 'global_archived_events', label: 'Tallennetut tapahtumat' },
  { id: 'global_employee_bank', label: 'Työntekijäpankki' },
];
