// Palvelinpuolen peilikuva frontin Sivukartta-oikeuksista (src/App.tsx: SITEMAP, canView,
// canEdit) — PLUS tapahtumarajaus (eventAccess), jolla admin voi lisäksi rajata tietyn
// käyttäjän näkemään/muokkaamaan vain valittujen tapahtumien (esim. FestivaaliX) dataa.
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

// perms['*'] on admin-oikotie — kaikki näkyy ja on muokattavissa riippumatta yksittäisistä
// solmumerkinnöistä. Sama logiikka kuin src/App.tsx:n canView/canEdit. role === 'admin'
// ohitetaan lisäksi kokonaan kutsuvassa koodissa (ks. alla), samaan tapaan kuin frontin
// kaikkialla toistuva `isAdminUser || canView(...)` -kaava. HUOM: '*' on vain Sivukartta-
// oikotie — se EI ohita tapahtumarajausta (eventAccess), ks. eventAllowed().
export function canView(permissions, nodeId) {
  if (!permissions) return false;
  if (permissions['*']?.view) return true;
  return !!permissions[nodeId]?.view;
}

export function canEdit(permissions, nodeId) {
  if (!permissions) return false;
  if (permissions['*']?.edit) return true;
  return !!permissions[nodeId]?.edit;
}

function hasAnyView(permissions, nodeIds) {
  return nodeIds.some((id) => canView(permissions, id));
}

function hasAnyEdit(permissions, nodeIds) {
  return nodeIds.some((id) => canEdit(permissions, id));
}

// Tyhjä (tai puuttuva) eventAccess = ei rajoitusta, käyttäjä näkee kaikki tapahtumat —
// sama oletus kuin db.js:n withDefaults. Admin ohitetaan aina erikseen kutsuvassa koodissa.
function eventAllowed(eventAccess, eventId) {
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
// tahansa näistä riittävä muokkausoikeus oikeuttaa liitteen lähettämisen.
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
// `view`: sivukartta-solmut jotka oikeuttavat GET-luvun — yksikin riittää. Vastaa sitä
// mistä sivuista kyseistä kokoelmaa oikeasti luetaan frontissa (ei vain missä sitä
// muokataan) — esim. "reports" näkyy kymmenillä eri TIKE-lomakkeilla ja koonti/yleiskuva-
// sivuilla, vaikka yksittäinen käyttäjä saisi muokata vain yhtä niistä.
//
// `touch(item, phase)`: sivukartta-solmut jotka oikeuttavat KYSEISEN YKSITTÄISEN tietueen
// lisäämisen/poistamisen/muuttamisen PUT:in yhteydessä — yksikin riittää. `phase` on
// 'add' tai 'remove'. Näitä käytetään authorizeWrite()-funktiossa, joka vertaa PUT:in
// mukana tullutta taulukkoa tallennettuun ja vaatii oikeuden vain niille tietueille jotka
// oikeasti muuttuvat — koskemattomat tietueet eivät vaadi mitään oikeutta.
//
// `eventScoped` + `eventIdOf(item)`: jos true, kokoelman tietueet kuuluvat aina johonkin
// tapahtumaan ja niitä suodatetaan/rajataan myös käyttäjän eventAccess-listan mukaan (ks.
// filterByEventAccess ja authorizeWrite). "employees" (henkilöstöpankki) EI ole tähän
// sidottu — se on koko yrityksen yhteinen rekisteri, ei minkään yksittäisen tapahtuman.
//
// Tämä per-tietue-tarkistus ei ole vain tarkkuutta varten: /api/data/:name PUT korvaa
// AINA koko kokoelman (ks. store.js), ja frontti lataa jokaisen kokoelman kokonaisuudessaan
// jo sivun avautuessa ja tallentaa sen automaattisesti takaisin heti kun lataus on
// päättynyt (myös silloin kun GET on evätty/suodatettu ja tila jäi vajaaksi tai frontin
// oletus-/esimerkkidataan!). Ilman per-tietue-tarkistusta yksikin puutteellisilla oikeuksilla
// tai tapahtumarajauksella varustettu käyttäjä voisi siis hiljaa hukata muiden käyttäjien/
// tapahtumien dataa pelkällä sivun avaamisella.
const COLLECTIONS = {
  employees: {
    // Työntekijäpankki: yrityksen koko henkilöstörekisteri henkilötunnuksineen — vain
    // "Työntekijäpankki"-sivun oma oikeus, ei esim. "Tapahtuman työntekijät" (joka vain
    // näyttää nimen/roolin valintaa varten, ei koko tietuetta). Ei tapahtumasidottu.
    view: ['global_employee_bank'],
    touch: () => ['global_employee_bank'],
    eventScoped: false,
  },
  events: {
    // Tapahtumien luonti/muokkaus/poisto tehdään kaikki "Aloitussivulta" (landing), eikä
    // frontissa ole tälle erillistä muokkausoikeus-solmua — sama peilataan tässä.
    view: ['landing'],
    touch: () => ['landing'],
    eventScoped: true,
    eventIdOf: (item) => item?.id,
  },
  checkins: {
    view: ['overview', 'tike_form_in', 'tike_form_out', 'tike_form_jvaction', 'planning_employees', 'global_archived_events'],
    // Ei tietuekohtaista erottelua mahdollista (ei typeId-kenttää) — samat kolme solmua
    // kattavat sisäänkirjauksen, uloskirjauksen ja tapahtuman työntekijärosterin ylläpidon.
    touch: () => ['tike_form_in', 'tike_form_out', 'planning_employees'],
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
    view: ['overview', 'report_list', 'report_tike', 'documents_pdf', 'global_reports', 'global_archived_events', ...TIKE_FORM_NODES],
    touch: (item, phase) => {
      const typeId = item?.typeId;
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

export function canReadCollection(role, permissions, name) {
  if (role === 'admin') return true;
  const rule = COLLECTIONS[name];
  if (!rule) return false;
  return hasAnyView(permissions, rule.view);
}

// Suodattaa GET-vastauksen käyttäjän eventAccess-rajauksen mukaan (ei-tapahtumasidotuille
// kokoelmille tai rajoittamattomille/admin-käyttäjille palauttaa datan sellaisenaan). Tämä
// on erillinen askel canReadCollection()-portin JÄLKEEN: Sivukartta päättää pääseekö
// kokoelmaan käsiksi lainkaan, eventAccess päättää minkä osan siitä näkee.
export function filterByEventAccess(role, name, data, eventAccess) {
  if (role === 'admin' || !Array.isArray(data)) return data;
  const rule = COLLECTIONS[name];
  if (!rule || !rule.eventScoped) return data;
  if (!Array.isArray(eventAccess) || eventAccess.length === 0) return data;
  return data.filter((item) => eventAllowed(eventAccess, rule.eventIdOf(item)));
}

// Tarkistaa PUT:in oikeudet JA palauttaa levylle kirjoitettavan lopullisen taulukon.
// Onnistuessaan `data` EI aina ole sama kuin `newArr` sellaisenaan: jos käyttäjä on
// tapahtumarajattu, hänen näkemänsä (ja siis lähettämänsä) taulukko ei koskaan sisällä
// muiden tapahtumien tietueita — ne on tässä liitetty takaisin muuttumattomina levyn
// nykyisestä tilasta, jotta rajattu käyttäjä ei voi (edes vahingossa, tyhjän välimuistin
// automaattitallennuksella) hukata tapahtumia joita ei koskaan nähnytkään.
export function authorizeWrite(role, permissions, eventAccess, name, oldArr, newArr) {
  const rule = COLLECTIONS[name];
  if (!rule) return { ok: false, error: 'Tuntematon kokoelma.' };
  if (role === 'admin') return { ok: true, data: newArr };

  const safeOld = Array.isArray(oldArr) ? oldArr : [];
  const safeNew = Array.isArray(newArr) ? newArr : [];

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
  const allowed = (item, phase) => rule.touch(item, phase).some((node) => canEdit(permissions, node));

  // Käydään UUSI taulukko läpi sellaisenaan (ei Map:in kautta deduplikoituna) — muuten
  // kaksi tietuetta samalla (tai puuttuvalla) id:llä voisi piilottaa jälkimmäisen
  // tarkistuksen ohi, vaikka molemmat päätyisivät levylle asti.
  const seenIds = new Set();
  for (const item of safeNew) {
    const id = String(item?.id ?? '');
    seenIds.add(id);
    const before = id && oldById.has(id) ? oldById.get(id) : null;
    if (!before) {
      if (!allowed(item, 'add')) {
        return { ok: false, error: 'Ei oikeuksia lisätä joitakin lähetetyistä tietueista.' };
      }
    } else if (JSON.stringify(before) !== JSON.stringify(item)) {
      // Muokkaus paikallaan: kummankin "puolen" (vanha ja uusi muoto) pitää olla katettu.
      // Yksikään nykyisistä kokoelmista ei tue tätä käyttöliittymästä, joten tämä on
      // tarkoituksella tiukin mahdollinen tulkinta jos joku silti yrittää sitä.
      if (!allowed(before, 'remove') || !allowed(item, 'add')) {
        return { ok: false, error: 'Ei oikeuksia muokata joitakin lähetetyistä tietueista.' };
      }
    }
  }
  for (const [id, item] of oldById) {
    if (!seenIds.has(id) && !allowed(item, 'remove')) {
      return { ok: false, error: 'Ei oikeuksia poistaa joitakin tietueista.' };
    }
  }

  const data = isRestricted ? [...outOfScope, ...safeNew] : safeNew;
  return { ok: true, data };
}

// /api/uploads/:id -reitin oikeustarkistus: liite ei itsessään tiedä kenen, minkä raportin
// tai minkä tapahtuman se on — etsitään omistava raportti reports-kokoelmasta ja vaaditaan
// sekä sama oikeus että sama tapahtumarajaus kuin sen raportin (typeId:n) lukeminen vaatisi.
// Jos mikään raportti ei viittaa liitteeseen, se evätään aina (ei tunnettua omistajaa jonka
// oikeuksia vasten tarkistaa).
export function canReadAttachment(role, permissions, eventAccess, attachmentId, reportsArr) {
  if (role === 'admin') return true;
  const owner = (Array.isArray(reportsArr) ? reportsArr : []).find((r) => r?.attachment?.id === attachmentId);
  if (!owner) return false;
  if (!eventAllowed(eventAccess, legacyEventId(owner))) return false;
  const nodes = owner.typeId
    ? [`tike_form_${owner.typeId}`, 'report_list', 'overview', 'documents_pdf', 'global_reports', 'global_archived_events']
    : ['report_list', 'overview', 'documents_pdf', 'global_reports', 'global_archived_events'];
  return hasAnyView(permissions, nodes);
}

// POST /api/uploads -reitin oikeustarkistus: liite ladataan aina osana jonkin raportin
// täyttöä, joten mihin tahansa liitteellisen lomaketyypin muokkausoikeuteen riittää. Ei
// tapahtumarajausta tässä vaiheessa — pyyntö ei sisällä eventId:tä, se ratkeaa vasta kun
// liite liitetään raporttiin (jota reports-kokoelman authorizeWrite jo suojaa).
export function canUploadAttachment(role, permissions) {
  if (role === 'admin') return true;
  return hasAnyEdit(permissions, REPORT_ATTACHMENT_NODES);
}
