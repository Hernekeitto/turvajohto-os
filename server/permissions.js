// Palvelinpuolen peilikuva frontin Sivukartta-oikeuksista (src/App.tsx: SITEMAP, canView,
// canEdit) — PLUS tapahtumarajaus (eventAccess) JA tapahtumakohtaiset Sivukartta-oikeudet.
// Frontti suodattaa AINOASTAAN käyttöliittymän — tämä tiedosto on se oikea portti, jota
// vasten jokainen /api/data/:name- ja /api/uploads-pyyntö tarkistetaan ennen luku/kirjoitusta
// (ks. index.js). Ilman tätä kirjautunut mutta oikeudeton käyttäjä pääsisi devtoolsin/curlin
// kautta lukemaan ja ylikirjoittamaan minkä tahansa kokoelman, riippumatta Sivukartta- tai
// tapahtumarajauksista.
//
// HUOM: nämä solmutunnisteet EIVÄT tule automaattisesti frontista (eri prosessi/deploy, ei
// jaettua moduulia) — jos SITEMAP muuttuu src/App.tsx:ssä, tarkista että alla olevat listat
// pysyvät synkassa (ks. myös index.js:n käynnistystarkistus joka vertaa tätä store.js:n
// KNOWN_COLLECTIONS-listaan).

import { lukitusEstaaMuokkauksen, lukitusEstaaPoiston, muutoksenLisatiedot } from './kirjaukset.js';

// Oikeudet tallennetaan kaksitasoisena: { __default__: {node:{view,edit}}, [eventId]:
// {node:{view,edit}} }. __default__ on aina läsnä (ks. db.js: migratePermissions) ja
// toimii oletuksena tapahtumille joilla ei ole omaa erillistä asetusta admin-editorissa.
// Jos jollekin tapahtumalle ON oma asetus, sitä käytetään SELLAISENAAN (ei yhdistetä
// __default__:in kanssa solmu kerrallaan) — admin-editori esitäyttää sen __default__:in
// (tai jo olemassa olevan oman asetuksen) arvoilla kun tapahtuma valitaan muokattavaksi,
// joten käytännössä admin ei koskaan aloita tyhjästä.
export const DEFAULT_BUCKET = '__default__';

// Nämä sivukartta-solmut EIVÄT ole sidottu yhteen tapahtumaan — ne joko näyttävät dataa
// kaikista tapahtumista (global_reports, global_archived_events), eivät liity mihinkään
// tapahtumaan lainkaan (global_employee_bank: koko yrityksen henkilöstörekisteri; settings),
// tai koskevat itse tapahtumavalitsinta (landing). Näiden oikeus haetaan AINA __default__-
// asetuksesta riippumatta siitä minkä tapahtuman kontekstissa tarkistus tehdään.
const GLOBAL_NODES = new Set([
  'landing',
  // GUARD-puolen kohdevalitsin vastaa tapahtumapuolen 'landing'-solmua: "kuka näkee
  // kohdelistan" ei ole järkevää asettaa kohdekohtaisesti, koska ilman listaa ei pääse
  // yhteenkään kohteeseen.
  'guard_sites',
  'settings',
  // GUARD-puolen sovellusasetukset. Sama globaali luonne kuin 'settings': asetukset eivät
  // liity yhteenkään yksittäiseen kohteeseen.
  'guard_settings',
  'global_reports',
  'global_archived_events',
  'global_employee_bank',
  // Pikatoiminnot-valikko on ylapalkissa eika minkaan yksittaisen tapahtuman sivulla,
  // ja nappilista on koko sovelluksen yhteinen — vaikka viestin vastaanottajat
  // ratkaistaan valitun tapahtuman mukaan. Oikeus haetaan siksi aina __default__:sta.
  'quickactions',
]);

function bucketFor(permissions, eventId, nodeId) {
  const perms = permissions || {};
  if (!GLOBAL_NODES.has(nodeId) && eventId && perms[eventId]) return perms[eventId];
  return perms[DEFAULT_BUCKET] || {};
}

// perms[jokinBucket]['*'] on admin-oikotie sen bucketin sisällä — kaikki näkyy ja on
// muokattavissa riippumatta yksittäisistä solmumerkinnöistä KYSEISESSÄ tapahtumassa (tai
// __default__:ssa). Sama logiikka kuin src/App.tsx:n canView/canEdit, nyt vain per bucket.
// role === 'admin' ohitetaan lisäksi kokonaan kutsuvassa koodissa, samaan tapaan kuin
// frontin kaikkialla toistuva `isAdminUser || canView(...)` -kaava. HUOM: '*' ei ohita
// tapahtumarajausta (eventAccess) — ks. eventAllowed().
export function canView(permissions, eventId, nodeId) {
  const bucket = bucketFor(permissions, eventId, nodeId);
  if (bucket['*']?.view) return true;
  return !!bucket[nodeId]?.view;
}

export function canEdit(permissions, eventId, nodeId) {
  const bucket = bucketFor(permissions, eventId, nodeId);
  if (bucket['*']?.edit) return true;
  return !!bucket[nodeId]?.edit;
}

function hasAnyView(permissions, eventId, nodeIds) {
  return nodeIds.some((id) => canView(permissions, eventId, id));
}

function hasAnyEdit(permissions, eventId, nodeIds) {
  return nodeIds.some((id) => canEdit(permissions, eventId, id));
}

// Tyhjä (tai puuttuva) eventAccess = ei rajoitusta, käyttäjä näkee kaikki tapahtumat —
// sama oletus kuin db.js:n withDefaults. Admin ohitetaan aina erikseen kutsuvassa koodissa.
// Vietävä ulos, koska kanava (kanava.js) tarvitsee TÄSMÄLLEEN saman säännön päättäessään
// kenelle muutos kerrotaan. Toinen toteutus erkanisi tästä.
export function eventAllowed(eventAccess, eventId) {
  if (!Array.isArray(eventAccess) || eventAccess.length === 0) return true;
  return eventAccess.includes(eventId);
}

// TIKE-raportointilomakkeiden sivukartta-solmut (report_tike:n lapset src/App.tsx:n
// SITEMAP-puussa).
const TIKE_FORM_NODES = [
  'tike_form_in', 'tike_form_out', 'tike_form_jvaction', 'tike_form_open', 'tike_form_firstaid',
  'tike_form_threat', 'tike_form_fence', 'tike_form_damage', 'tike_form_lostfound', 'tike_form_patrol',
  'tike_form_queue', 'tike_form_weather', 'tike_form_briefing', 'tike_form_management',
];

// Lomaketyypit joilla on liitetiedostomahdollisuus ("Ota kuva" / "Liitä tiedosto" — ks.
// src/App.tsx: uploadAttachment-kutsut). Käytetään POST /api/uploads -reitillä: mihin
// tahansa näistä riittävä muokkausoikeus (missä tahansa bucketissa) oikeuttaa liitteen
// lähettämisen.
// GUARD-puolen solmut jotka oikeuttavat liitteen lähettämiseen: kohteen hallinta (kohteen
// omat tiedostot, esim. toimeksiantosopimus ja pohjapiirros) sekä vartijan raporttilomakkeet.
const GUARD_ATTACHMENT_NODES = ['guard_sites', 'guard_report_action', 'guard_report_jv'];

const REPORT_ATTACHMENT_NODES = [
  'tike_form_open', 'tike_form_firstaid', 'tike_form_threat', 'tike_form_fence', 'tike_form_damage',
  'tike_form_lostfound', 'tike_form_patrol', 'tike_form_queue', 'tike_form_weather',
  'tike_form_briefing', 'tike_form_management',
];

// Legacy-data (tallennettu ennen eventId-kenttää) lasketaan kuuluvaksi FestivaaliXään —
// sama oletus kuin src/App.tsx:n currentEventCheckedIn/currentEventReports-suodatuksissa.
const legacyEventId = (item) => item?.eventId || 'fesx';

// Kokoelmakohtaiset oikeussäännöt.
//
// `view`: sivukartta-solmut jotka oikeuttavat GET-luvun (kunkin tapahtuman kontekstissa
// erikseen tapahtumasidotuille kokoelmille) — yksikin riittää. Vastaa sitä mistä sivuista
// kyseistä kokoelmaa oikeasti luetaan frontissa. Globaalit solmut (ks. GLOBAL_NODES) tässä
// listassa toimivat tarkoituksella "ohituksena" kaikkiin tapahtumiin — esim. "Tallennetut
// raportit (kaikki tapahtumat)" -oikeus näyttää minkä tahansa tapahtuman raportit siitä
// riippumatta onko sillä tapahtumalla omaa erillistä report_list/tike_form_*-asetusta.
//
// `touch(item, phase)`: sivukartta-solmut jotka oikeuttavat KYSEISEN YKSITTÄISEN tietueen
// lisäämisen/poistamisen/muuttamisen PUT:in yhteydessä (tietueen OMAN tapahtuman
// kontekstissa) — yksikin riittää. `phase` on 'add' tai 'remove'.
//
// `eventScoped` + `eventIdOf(item)`: jos true, kokoelman tietueet kuuluvat aina johonkin
// tapahtumaan ja niitä suodatetaan/rajataan sekä käyttäjän eventAccess-listan että
// kyseisen tapahtuman Sivukartta-oikeuksien mukaan. "employees" (henkilöstöpankki) EI ole
// tähän sidottu — se on koko yrityksen yhteinen rekisteri, ei minkään yksittäisen
// tapahtuman, ja sen ainoa oikeussolmu (global_employee_bank) on joka tapauksessa globaali.
//
// Per-tietue-tarkistus ei ole vain tarkkuutta varten: /api/data/:name PUT korvaa AINA koko
// kokoelman (ks. store.js), ja frontti lataa jokaisen kokoelman kokonaisuudessaan jo sivun
// avautuessa ja tallentaa sen automaattisesti takaisin heti kun lataus on päättynyt (myös
// silloin kun GET on evätty/suodatettu ja tila jäi vajaaksi tai frontin oletus-/
// esimerkkidataan!). Ilman per-tietue-tarkistusta yksikin puutteellisilla oikeuksilla tai
// tapahtumarajauksella varustettu käyttäjä voisi siis hiljaa hukata muiden käyttäjien/
// tapahtumien dataa pelkällä sivun avaamisella.
const COLLECTIONS = {
  // Tapahtumakohtaiset lisätyt lomakkeet kuuluvat "Täytettävät lomakkeet" -sivulle,
  // joten ne käyttävät saman sivun oikeutta.
  eventForms: {
    view: ['documents_forms'],
    touch: () => ['documents_forms'],
    eventScoped: true,
    eventIdOf: legacyEventId,
  },
  // Tapahtuman tiedostot (kansiot + tiedostot) ja niiden jakolinkit ovat saman sivun
  // takana: jakaminen on osa tiedostonhallintaa, ei erillinen oikeus.
  eventFiles: {
    view: ['eventfiles'],
    touch: () => ['eventfiles'],
    eventScoped: true,
    eventIdOf: legacyEventId,
  },
  fileShares: {
    view: ['eventfiles'],
    touch: () => ['eventfiles'],
    eventScoped: true,
    eventIdOf: legacyEventId,
  },
  employees: {
    view: ['global_employee_bank'],
    touch: () => ['global_employee_bank'],
    eventScoped: false,
  },
  // Julkinen ilmoittaminen: julisteiden hallinta ja saapuneiden ilmoitusten moderointi
  // ovat saman oikeuden takana. Se joka päättää mistä ilmoituksia otetaan vastaan, myös
  // käsittelee ne — ja päinvastoin: moderoijalla on oltava valta sulkea juliste josta
  // tulee pelkkää roskaa.
  //
  // HUOM: yleisön lähettämä ilmoitus EI tule tätä kautta vaan palvelimen omalta
  // julkiselta reitiltä (index.js). Tämä sääntö koskee vain kirjautuneen käyttäjän
  // tekemiä muutoksia, eli moderointia.
  publicForms: {
    view: ['public_reports'],
    touch: () => ['public_reports'],
    eventScoped: true,
    eventIdOf: legacyEventId,
  },
  publicReports: {
    view: ['public_reports'],
    touch: () => ['public_reports'],
    eventScoped: true,
    eventIdOf: legacyEventId,
  },
  // Pikatoimintonapit: nappien SISÄLLÖN näkee jokainen jolla on oikeus itse valikkoon
  // (muuten valikko olisi tyhjä), mutta nappien MUOKKAUS on sovellusasetusten takana.
  // Tämä on tarkoituksellinen ero muihin kokoelmiin: nappi määrää kenelle hätäviesti
  // lähtee ja mitä siinä lukee, joten sen muuttaminen on hallinnollinen toimenpide eikä
  // osa päivittäistä käyttöä. Viestin LÄHETTÄMISEN oikeus on erikseen quickactions:in
  // muokkausoikeus (ks. POST /api/sms/send index.js:ssä) — nappien näkeminen ei siis
  // vielä oikeuta lähettämään.
  smsButtons: {
    view: ['quickactions', 'settings'],
    touch: () => ['settings'],
    eventScoped: false,
  },
  // Lähetyshistoria ja vastaukset ovat PALVELIMEN yksin ylläpitämiä: ne syntyvät
  // lähetysreitillä ja päivittyvät BulkSMS:n webhook-kutsuista, eikä niitä kirjoiteta
  // selaimesta koskaan. Tyhjä touch tarkoittaa ettei mikään sivukartta-solmu oikeuta
  // muutokseen, eli jokainen PUT joka muuttaisi jotain hylätään. Adminin PUT ohittaisi
  // tämän (authorizeWrite päästää adminin aina läpi), joten reitillä on lisäksi
  // erillinen esto — ks. index.js: PALVELIMEN_YLLAPITAMAT.
  smsLog: {
    view: ['quickactions'],
    touch: () => [],
    eventScoped: true,
    eventIdOf: legacyEventId,
  },
  smsReplies: {
    view: ['quickactions'],
    touch: () => [],
    eventScoped: true,
    eventIdOf: legacyEventId,
  },
  events: {
    // Tapahtumien luonti/muokkaus/poisto tehdään kaikki etusivun "Valitse tapahtuma"
    // -näkymästä (sivukartan solmu 'landing' — nimi on peruja ajalta jolloin se oli
    // tapahtuman sisäinen Aloitussivu-välilehti), eikä frontissa ole tälle erillistä
    // muokkausoikeus-solmua — sama peilataan tässä. 'landing' on globaali solmu, joten
    // tämä ei tosiasiassa vaihtele tapahtumittain (tarkoituksella — "kuka näkee
    // tapahtumavalitsimen" ei ole järkevää asettaa per tapahtuma).
    view: ['landing'],
    touch: () => ['landing'],
    eventScoped: true,
    eventIdOf: (item) => item?.id,
  },
  // --- Turvajohto GUARD ---
  // Kohteet käyttäytyvät kuten tapahtumat: luonti ja muokkaus tehdään kohdevalitsimesta,
  // ja kohteen id on se avain jolla käyttäjä rajataan tiettyihin kohteisiin (eventAccess).
  // tuote: 'guard' estää kokoelman kokonaan tunnuksilta joilla ei ole GUARD-pääsyä —
  // ilman tätä käyttöliittymän esto olisi ohitettavissa suoralla API-kutsulla.
  guardSites: {
    // Kohteen tiedot -näkymä lukee samat kohteet kuin kohdevalinta, joten sillä on
    // lukuoikeus tänne — muokkaus on silti vain kohdevalinnan takana.
    view: ['guard_sites', 'guard_site_info'],
    touch: () => ['guard_sites'],
    eventScoped: true,
    eventIdOf: (item) => item?.id,
    tuote: 'guard',
  },
  // Kohteen tiedostot kuuluvat kohteen hallintaan, samoin kuin eventFiles kuuluu
  // tapahtuman tiedostoihin. Kohteen tiedot -näkymä näyttää ne mutta ei muokkaa.
  guardFiles: {
    view: ['guard_sites', 'guard_site_info'],
    touch: () => ['guard_sites'],
    eventScoped: true,
    eventIdOf: (item) => item?.siteId,
    tuote: 'guard',
  },
  // Vartijan raportit: kirjaaminen on lomakesolmujen takana, lukeminen myös kohteen
  // tiedot -koosteessa. Sama jako kuin tapahtumapuolella (tike_form_* vs report_list).
  guardReports: {
    view: ['guard_report_action', 'guard_report_jv', 'guard_site_info'],
    touch: () => ['guard_report_action', 'guard_report_jv'],
    eventScoped: true,
    eventIdOf: (item) => item?.siteId,
    tuote: 'guard',
  },
  // Tehtäväsuoritukset: vartija kuittaa ne työvuoronäkymässä, ja ne näkyvät kohteen
  // tiedoissa koottuna.
  guardTaskRuns: {
    view: ['guard_tasks', 'guard_site_info'],
    touch: () => ['guard_tasks'],
    eventScoped: true,
    eventIdOf: (item) => item?.siteId,
    tuote: 'guard',
  },
  // Pohjat (P6). Polymorfinen kokoelma kuten reports: `view` on kaikkien lajien solmujen
  // UNIONI, ja `touch` valitsee solmun lajin mukaan. Kun erä 8 tuo skenaariopohjat ja
  // ohjepankin, tähän lisätään lajin solmu eikä uutta kokoelmaa.
  //
  // Kierrospohjan lukeminen on sallittu myös kierrosnäkymästä: vartija ei voi aloittaa
  // kierrosta pohjasta jota hän ei saa lukea, mutta pohjan MUOKKAUS on erikseen
  // esimiehen oikeus.
  templates: {
    view: ['guard_patrol_templates', 'guard_patrols', 'guard_site_info'],
    touch: (item) => {
      if (item?.kind === 'patrol') return ['guard_patrol_templates'];
      // Tuntematon laji ei saa pudota läpi tyhjällä listalla: tyhjä vaatimuslista
      // tarkoittaisi "kuka tahansa saa kirjoittaa". Palautetaan solmu jota ei ole
      // olemassa, jolloin vain admin läpäisee.
      return ['__tuntematon_pohjalaji__'];
    },
    eventScoped: true,
    eventIdOf: (item) => item?.ownerId,
    tuote: 'guard',
  },
  // Kierroksen suoritukset. Kirjoitus tapahtuu VAIN palvelimen omilla reiteillä
  // (index.js: PALVELIMEN_YLLAPITAMAT), joten `touch` koskee käytännössä vain adminin
  // teoreettista suoraa kirjoitusta — säännöt vajaasta sulkemisesta ja keskeytyksen
  // syystä ovat kierros.js:ssä eivätkä täällä.
  patrolRuns: {
    view: ['guard_patrols', 'guard_site_info'],
    touch: () => ['guard_patrols'],
    eventScoped: true,
    eventIdOf: (item) => item?.siteId,
    tuote: 'guard',
  },
  // Hälytykset (erä 7). Kokoelma on molempien puolien yhteinen, joten `tuote`-rajausta EI
  // ole: sama tietue voi kuulua tapahtumaan tai vartiointikohteeseen, ja eventScoped +
  // eventAccess hoitaa rajauksen kummassakin tapauksessa. Kaksi solmua lukuoikeudessa
  // vastaa tätä: EVENT-puolen valvomo näkee tapahtumansa hälytykset, GUARD-puolen
  // vartija kohteensa.
  //
  // Kirjoitus tapahtuu VAIN palvelimen omilla reiteillä (index.js: PALVELIMEN_YLLAPITAMAT).
  // Tyhjä touch on tässä olennainen osa toimintoa eikä muotoseikka: hälytys jonka selain
  // voisi kirjoittaa olisi hälytys jonka selain voisi myös hiljaa poistaa.
  alerts: {
    view: ['alarms', 'guard_alarms'],
    touch: () => [],
    eventScoped: true,
    eventIdOf: (item) => item?.eventId,
  },
  checkins: {
    view: ['overview', 'tike_form_in', 'tike_form_out', 'tike_form_jvaction', 'planning_employees', 'global_archived_events'],
    // Ei tietuekohtaista erottelua mahdollista (ei typeId-kenttää) — samat kolme solmua
    // kattavat sisäänkirjauksen, uloskirjauksen ja tapahtuman työntekijärosterin ylläpidon.
    touch: () => ['tike_form_in', 'tike_form_out', 'planning_employees'],
    eventScoped: true,
    eventIdOf: legacyEventId,
  },
  // Avausvalmius: yksi tietue per tapahtuma (porttien avauksen kuittaukset, tavoiteaika
  // ja poikkeamat). Luku on sallittu myös suunnittelu- ja tilannekuvasivulta, koska
  // niiden tilapalkki nayttaa saman koonnin — ilman lukuoikeutta frontti ei saisi
  // kokoelmaa ladattua eika siis myoskaan tallennettua sita takaisin.
  readiness: {
    view: ['overview', 'planning', 'planning_readiness'],
    touch: () => ['planning_readiness'],
    eventScoped: true,
    eventIdOf: legacyEventId,
  },
  riskAssessments: {
    view: ['overview', 'documents_risk', 'documents_risk_done', 'documents_risk_new'],
    touch: (item, phase) => (phase === 'remove' ? ['documents_risk_done'] : ['documents_risk_new']),
    eventScoped: true,
    eventIdOf: legacyEventId,
  },
  reports: {
    // 'report_jv' on mukana koska järjestyksenvalvojan tapahtumailmoitus tallentuu tähän
    // samaan kokoelmaan omalta sivultaan: ilman lukuoikeutta frontti ei saisi kokoelmaa
    // ladattua eikä siis myöskään tallennettua sitä takaisin, joten pelkän report_jv-
    // oikeuden saanut järjestyksenvalvoja ei voisi kirjata ilmoitusta lainkaan.
    view: ['overview', 'report_list', 'report_tike', 'documents_pdf', 'global_reports', 'global_archived_events', 'report_jv', 'public_reports', ...TIKE_FORM_NODES],
    touch: (item, phase) => {
      const typeId = item?.typeId;
      // Järjestyksenvalvojan tapahtumailmoitus (typeId 'jvreport') on oma sivunsa
      // TIKE-lomakkeiden ulkopuolella, joten sen oikeussolmu on 'report_jv' eikä
      // 'tike_form_jvreport' (jota ei ole olemassa sivukartassa).
      if (typeId === 'jvreport') {
        return phase === 'remove' ? ['report_jv', 'report_list', 'overview'] : ['report_jv'];
      }
      // Hyväksytystä yleisöilmoituksesta syntyvä kirjaus (typeId 'public'). Sama
      // poikkeus kuin jvreportilla ja samasta syystä: sivukartassa ei ole solmua
      // 'tike_form_public' eikä sellaista pidä tehdäkään — kirjaus syntyy
      // moderointinäkymässä, joten sen oikeus on moderoinnin oikeus. Ilman tätä riviä
      // moderoija tarvitsisi lisäksi jonkin TIKE-lomakkeen muokkausoikeuden, mikä
      // antaisi hänelle enemmän kuin tehtävä vaatii.
      if (typeId === 'public') {
        return phase === 'remove' ? ['public_reports', 'report_list', 'overview'] : ['public_reports'];
      }
      const typeNodes = typeId ? [`tike_form_${typeId}`] : [];
      // "Avoin kirjaus" (typeId 'open') voidaan luoda myös työntekijän sisäänkirjauksen
      // muokkausnäkymän "Tallenna kommentti raportiksi" -toiminnolla — ks. src/App.tsx:
      // handleSaveCommentAsReport, joka on tike_form_in-oikeuden takana eikä tike_form_open:in.
      if (typeId === 'open') typeNodes.push('tike_form_in');
      // Raportin poisto tehdään avatun raportin modaalista, jonka poisto-oikeus on sen
      // sivun mukaan josta modaali avattiin (overview tai report_list) — ei raportin oman
      // tyypin lomakkeen mukaan. Ks. src/App.tsx: openedReportSource.
      if (phase === 'remove') return [...typeNodes, 'report_list', 'overview'];
      return typeNodes;
    },
    eventScoped: true,
    eventIdOf: legacyEventId,
  },
};

export const COLLECTION_NAMES = Object.keys(COLLECTIONS);

// Mihin tuotteeseen kokoelma kuuluu ('guard'), tai null jos se on yhteinen tai kuuluu
// tapahtumapuolelle. Reitit käyttävät tätä porttina ENNEN oikeustarkistusta: käyttäjä jolla
// ei ole pääsyä puolelle ei saa nähdä sen dataa vaikka sivukartta-oikeudet sattuisivat
// olemaan kunnossa.
export function collectionTuote(name) {
  return COLLECTIONS[name]?.tuote || null;
}

// Palauttaa GET:in käyttäjälle näkyvän datan, tai null jos kokoelmaan ei ole minkäänlaista
// oikeutta (-> 403). Tapahtumasidotuille kokoelmille (checkins/reports/riskAssessments/
// events) EI palauteta 403:a pelkän tyhjän tuloksen takia — tapahtumakohtaiset oikeudet
// tarkoittavat ettei ole enää yhtä yksiselitteistä "on/ei ole oikeutta kokoelmaan"
// -vastausta, joten data suodatetaan aina tietue kerrallaan (tapahtumarajaus JA kyseisen
// tapahtuman sivukartta-oikeus yhdessä) ja tyhjä taulukko on validi, ei virhe. employees
// (ei tapahtumasidottu, yksi globaali solmu) säilyttää selkeän 403-käytöksen.
export function readableData(role, permissions, eventAccess, name, data) {
  const rule = COLLECTIONS[name];
  if (!rule) return { ok: false };
  if (role === 'admin') return { ok: true, data };

  if (!rule.eventScoped) {
    if (!hasAnyView(permissions, null, rule.view)) return { ok: false };
    return { ok: true, data };
  }

  const safeData = Array.isArray(data) ? data : [];
  const filtered = safeData.filter((item) => {
    const eventId = rule.eventIdOf(item);
    return eventAllowed(eventAccess, eventId) && hasAnyView(permissions, eventId, rule.view);
  });
  return { ok: true, data: filtered };
}

// Tarkistaa PUT:in oikeudet JA palauttaa levylle kirjoitettavan lopullisen taulukon.
// Onnistuessaan `data` EI aina ole sama kuin `newArr` sellaisenaan: jos käyttäjä on
// tapahtumarajattu, hänen näkemänsä (ja siis lähettämänsä) taulukko ei koskaan sisällä
// muiden tapahtumien tietueita — ne on tässä liitetty takaisin muuttumattomina levyn
// nykyisestä tilasta, jotta rajattu käyttäjä ei voi (edes vahingossa, tyhjän välimuistin
// automaattitallennuksella) hukata tapahtumia joita ei koskaan nähnytkään.
//
// Palauttaa onnistuessaan myös `changes`: lista { action: 'create'|'update'|'delete', id,
// eventId } audit-lokitusta varten (ks. index.js). Lasketaan AINA (myös adminille), jotta
// audit-loki kattaa kaikki käyttäjät — admin ei tarvitse per-tietue-oikeustarkistusta,
// mutta hänenkin tekemänsä muutokset pitää silti pystyä jäljittämään jälkikäteen.
export function authorizeWrite(role, permissions, eventAccess, name, oldArr, newArr) {
  const rule = COLLECTIONS[name];
  if (!rule) return { ok: false, error: 'Tuntematon kokoelma.' };

  const safeOld = Array.isArray(oldArr) ? oldArr : [];
  const safeNew = Array.isArray(newArr) ? newArr : [];
  const eventIdOfChange = (item) => (rule.eventScoped ? rule.eventIdOf(item) : null);

  // Kirjausten muuttumattomuus (ks. kirjaukset.js) koskee vain raporttikokoelmia. Nämä
  // apurit ovat roolihaarautumisen YLÄPUOLELLA tarkoituksella: lukitus sitoo myös
  // adminia, joten sama tarkistus on tehtävä molemmissa haaroissa. Jos tarkistus olisi
  // vain ei-admin-haarassa, admin voisi ylikirjoittaa voimakeinokirjauksen hiljaa.
  const raporttikokoelma = name === 'reports' || name === 'guardReports';
  const muokkausEste = (before, item) => (raporttikokoelma ? lukitusEstaaMuokkauksen(before, item) : null);
  const poistoEste = (item) => (raporttikokoelma ? lukitusEstaaPoiston(item) : null);
  const lisatiedot = (before, item) => (raporttikokoelma ? muutoksenLisatiedot(before, item) : {});

  if (role === 'admin') {
    const changes = [];
    const oldByIdAdmin = new Map(safeOld.map((item) => [String(item?.id ?? ''), item]));
    const seenIdsAdmin = new Set();
    for (const item of safeNew) {
      const id = String(item?.id ?? '');
      seenIdsAdmin.add(id);
      const before = id && oldByIdAdmin.has(id) ? oldByIdAdmin.get(id) : null;
      if (!before) {
        changes.push({ action: 'create', id, eventId: eventIdOfChange(item) });
      } else if (JSON.stringify(before) !== JSON.stringify(item)) {
        const este = muokkausEste(before, item);
        if (este) return { ok: false, error: este };
        changes.push({ action: 'update', id, eventId: eventIdOfChange(item), ...lisatiedot(before, item) });
      }
    }
    for (const [id, item] of oldByIdAdmin) {
      if (!seenIdsAdmin.has(id)) {
        const este = poistoEste(item);
        if (este) return { ok: false, error: este };
        changes.push({ action: 'delete', id, eventId: eventIdOfChange(item) });
      }
    }
    return { ok: true, data: newArr, changes };
  }

  const isRestricted = rule.eventScoped && Array.isArray(eventAccess) && eventAccess.length > 0;
  let scopedOld = safeOld;
  let outOfScope = [];
  if (isRestricted) {
    outOfScope = safeOld.filter((item) => !eventAllowed(eventAccess, rule.eventIdOf(item)));
    scopedOld = safeOld.filter((item) => eventAllowed(eventAccess, rule.eventIdOf(item)));
    // GET palauttaisi tälle käyttäjälle vain sallittujen tapahtumien tietueet, joten mikä
    // tahansa muun tapahtuman tietue PUT:in mukana on joko vanhentunut client tai
    // tahallinen väärennös (curl) — hylätään suoraan, ei vain jätetä huomiotta, ettei
    // kukaan yritä hiljaa "korjata" toisen tapahtuman dataa lähettämällä sen mukana.
    const smuggled = safeNew.some((item) => !eventAllowed(eventAccess, rule.eventIdOf(item)));
    if (smuggled) {
      return { ok: false, error: 'Ei oikeuksia toisen tapahtuman tietoihin.' };
    }
  }

  const oldById = new Map(scopedOld.map((item) => [String(item?.id ?? ''), item]));
  // Jokainen tarkistus tehdään TIETUEEN OMAN tapahtuman (eventIdOf) kontekstissa — kahdella
  // eri tapahtumalla voi olla eri Sivukartta-oikeudet samalle käyttäjälle, ks. tiedoston
  // alun kommentti. Ei-tapahtumasidotuille kokoelmille (employees) eventId on aina null,
  // mikä ei haittaa koska niiden ainoa solmu on joka tapauksessa globaali (GLOBAL_NODES).
  const allowed = (item, phase) => {
    const eventId = rule.eventScoped ? rule.eventIdOf(item) : null;
    return rule.touch(item, phase).some((node) => canEdit(permissions, eventId, node));
  };

  // Käydään UUSI taulukko läpi sellaisenaan (ei Map:in kautta deduplikoituna) — muuten
  // kaksi tietuetta samalla (tai puuttuvalla) id:llä voisi piilottaa jälkimmäisen
  // tarkistuksen ohi, vaikka molemmat päätyisivät levylle asti.
  const changes = [];
  const seenIds = new Set();
  for (const item of safeNew) {
    const id = String(item?.id ?? '');
    seenIds.add(id);
    const before = id && oldById.has(id) ? oldById.get(id) : null;
    if (!before) {
      if (!allowed(item, 'add')) {
        return { ok: false, error: 'Ei oikeuksia lisätä joitakin lähetetyistä tietueista.' };
      }
      changes.push({ action: 'create', id, eventId: eventIdOfChange(item) });
    } else if (JSON.stringify(before) !== JSON.stringify(item)) {
      // Muokkaus paikallaan: kummankin "puolen" (vanha ja uusi muoto) pitää olla katettu.
      // Yksikään nykyisistä kokoelmista ei tue tätä käyttöliittymästä, joten tämä on
      // tarkoituksella tiukin mahdollinen tulkinta jos joku silti yrittää sitä.
      if (!allowed(before, 'remove') || !allowed(item, 'add')) {
        return { ok: false, error: 'Ei oikeuksia muokata joitakin lähetetyistä tietueista.' };
      }
      const este = muokkausEste(before, item);
      if (este) return { ok: false, error: este };
      changes.push({ action: 'update', id, eventId: eventIdOfChange(item), ...lisatiedot(before, item) });
    }
  }
  for (const [id, item] of oldById) {
    if (!seenIds.has(id)) {
      if (!allowed(item, 'remove')) {
        return { ok: false, error: 'Ei oikeuksia poistaa joitakin tietueista.' };
      }
      const este = poistoEste(item);
      if (este) return { ok: false, error: este };
      changes.push({ action: 'delete', id, eventId: eventIdOfChange(item) });
    }
  }

  const data = isRestricted ? [...outOfScope, ...safeNew] : safeNew;
  return { ok: true, data, changes };
}

// /api/uploads/:id -reitin oikeustarkistus: liite ei itsessään tiedä kenen, minkä raportin
// tai minkä tapahtuman se on — etsitään omistava raportti reports-kokoelmasta ja vaaditaan
// sekä sama tapahtumarajaus että sama sen tapahtuman Sivukartta-oikeus kuin sen raportin
// (typeId:n) lukeminen vaatisi. Jos mikään raportti ei viittaa liitteeseen, se evätään
// aina (ei tunnettua omistajaa jonka oikeuksia vasten tarkistaa).
// filesArr = eventFiles-kokoelma, sharesArr = fileShares, username = kirjautunut käyttäjä.
// Kolme viimeistä ovat valinnaisia, jotta vanhat kutsupaikat eivät riko mitään — mutta
// ilman niitä tapahtuman tiedostoja ei voi ladata lainkaan (ks. eventFiles-haara alla).
// Sama alipuulogiikka kuin shares.js:n kuuluuJakoon. Toistettu tässä tarkoituksella:
// permissions.js on palvelimen oikeusportti eikä se saa riippua muista moduuleista kuin
// omista apureistaan (ks. tiedoston alun kommentti kehäriippuvuuksista).
function kuuluuJakoonPaikallinen(targetId, kohdeId, tiedostot) {
  if (targetId === kohdeId) return true;
  const byId = {};
  for (const f of tiedostot || []) byId[f.id] = f;
  let solmu = byId[kohdeId];
  const nahdyt = new Set();
  while (solmu && solmu.parentId && !nahdyt.has(solmu.id)) {
    nahdyt.add(solmu.id);
    if (solmu.parentId === targetId) return true;
    solmu = byId[solmu.parentId];
  }
  return false;
}

export function canReadAttachment(
  role, permissions, eventAccess, attachmentId, reportsArr, eventsArr,
  filesArr = [], sharesArr = [], username = null
) {
  if (role === 'admin') return true;

  // Tapahtuman tiedostot (eventFiles) eivät ole raportin liitteitä eivätkä pohjakarttoja,
  // joten ilman tätä haaraa ne eivät latautuisi ei-admineille lainkaan.
  const omistavaTiedosto = (Array.isArray(filesArr) ? filesArr : []).find(
    (f) => f?.uploadId === attachmentId
  );
  if (omistavaTiedosto) {
    const tiedostonEventId = legacyEventId(omistavaTiedosto);

    // Käyttäjälle erikseen jaettu tiedosto avautuu VAIKKA hänellä ei olisi oikeutta
    // kyseisen tapahtuman tiedostosivulle eikä pääsyä tapahtumaan lainkaan — jakaminen
    // on nimenomaan tarkoitettu antamaan pääsy tähän yhteen kohteeseen. Muuten
    // "jaa nimetylle käyttäjälle" ei tekisi mitään.
    const jaettuMinulle = username && (Array.isArray(sharesArr) ? sharesArr : []).some((sh) => {
      if (sh?.mode !== 'users' || sh?.revokedAt) return false;
      if (!(sh.allowedUsernames || []).includes(username)) return false;
      if (sh.expiresAt && new Date(sh.expiresAt) <= new Date()) return false;
      return kuuluuJakoonPaikallinen(sh.targetId, omistavaTiedosto.id, filesArr);
    });
    if (jaettuMinulle) return true;

    if (!eventAllowed(eventAccess, tiedostonEventId)) return false;
    return hasAnyView(permissions, tiedostonEventId, ['eventfiles']);
  }
  // Tapahtuman pohjakartta on ainoa liite jolla ei ole omistavaa raporttia: se
  // talletetaan tapahtuman omiin tietoihin (formData.mapUploadId) ja näytetään
  // "Tapahtuman yleiskatsaus" -sivulla, joten lukuoikeus tulee postevent-solmusta.
  const kartanTapahtuma = (Array.isArray(eventsArr) ? eventsArr : []).find(
    (e) => e?.formData?.mapUploadId === attachmentId
  );
  if (kartanTapahtuma) {
    const kartanEventId = kartanTapahtuma.id;
    if (!eventAllowed(eventAccess, kartanEventId)) return false;
    return hasAnyView(permissions, kartanEventId, ['postevent']);
  }
  const owner = (Array.isArray(reportsArr) ? reportsArr : []).find((r) => r?.attachment?.id === attachmentId);
  if (!owner) return false;
  const eventId = legacyEventId(owner);
  if (!eventAllowed(eventAccess, eventId)) return false;
  const nodes = owner.typeId
    ? [`tike_form_${owner.typeId}`, 'report_list', 'overview', 'documents_pdf', 'global_reports', 'global_archived_events']
    : ['report_list', 'overview', 'documents_pdf', 'global_reports', 'global_archived_events'];
  return hasAnyView(permissions, eventId, nodes);
}

// POST /api/uploads -reitin oikeustarkistus: liite ladataan aina osana jonkin raportin
// täyttöä, mutta pyynnössä ei ole vielä tietoa MINKÄ tapahtuman raportista on kyse (se
// ratkeaa vasta kun liite liitetään raporttiin, jota reports-kokoelman authorizeWrite jo
// suojaa tapahtumakohtaisesti). Siksi tässä riittää että käyttäjällä on liitteellisen
// lomaketyypin muokkausoikeus JOSSAKIN bucketissa — __default__:ssa tai missä tahansa
// tapahtumassa jolle hänellä on oma asetus.
export function canUploadAttachment(role, permissions) {
  if (role === 'admin') return true;
  const bucketKeys = permissions ? Object.keys(permissions) : [];
  const nodes = [...REPORT_ATTACHMENT_NODES, ...GUARD_ATTACHMENT_NODES];
  return bucketKeys.some((eventId) => hasAnyEdit(permissions, eventId, nodes));
}

// GUARD-liitteiden lukuoikeus. Erillinen funktio eikä haara canReadAttachmentiin, koska
// GUARD-puolen liitteillä on eri omistajat (guardFiles, guardReports) ja eri solmut —
// yhdistäminen olisi tehnyt jo ennestään pitkästä funktiosta vaikeasti luettavan, eikä
// tapahtumapuolen liitelogiikkaan ole tarpeen koskea.
export function canReadGuardAttachment(
  role, permissions, eventAccess, attachmentId, guardFilesArr = [], guardReportsArr = [],
  guardSitesArr = []
) {
  if (role === 'admin') return true;

  // Kohteen pohjakartta on GUARD-puolen vastine tapahtuman kartalle: se ei kuulu
  // millekään raportille eikä tiedostolistaan vaan kohteen omiin tietoihin
  // (mapUploadId), ja sen päälle piirretään vyöhykkeet. Lukuoikeus tulee siitä että
  // saa nähdä kohteen.
  const kartanKohde = (Array.isArray(guardSitesArr) ? guardSitesArr : []).find(
    (k) => k?.mapUploadId === attachmentId
  );
  if (kartanKohde) {
    if (!eventAllowed(eventAccess, kartanKohde.id)) return false;
    return hasAnyView(permissions, kartanKohde.id, ['guard_sites', 'guard_site_info', 'guard_tasks']);
  }

  const tiedosto = (Array.isArray(guardFilesArr) ? guardFilesArr : []).find(
    (f) => f?.uploadId === attachmentId
  );
  if (tiedosto) {
    if (!eventAllowed(eventAccess, tiedosto.siteId)) return false;
    return hasAnyView(permissions, tiedosto.siteId, ['guard_sites', 'guard_site_info']);
  }

  const raportti = (Array.isArray(guardReportsArr) ? guardReportsArr : []).find(
    (r) => r?.attachment?.id === attachmentId
  );
  if (raportti) {
    if (!eventAllowed(eventAccess, raportti.siteId)) return false;
    return hasAnyView(permissions, raportti.siteId, [
      'guard_report_action', 'guard_report_jv', 'guard_site_info',
    ]);
  }

  return false;
}
