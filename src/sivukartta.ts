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
