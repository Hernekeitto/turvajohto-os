// TIKE-kirjausten kentät, valinnat ja siemendata. Erotettu App.tsx:stä: nämä ovat
// kiinteitä listoja joita sekä lomakkeet että näkymät lukevat, eivätkä ne koske
// komponentin tilaan.

import type { Kirjaus } from './tyypit';

// Raporttien tyyppikohtaiset lisäkentät ihmisluettavaksi "Avaa raportti" -näkymässä.
// id/eventId/typeId/type/author/time/summary/attachment näytetään erikseen kiinteässä muodossa.
// Tyhjät kentät jätetään näyttämättä (ks. suodatin openedReport-modaalissa), joten
// sama lista kattaa kaikki raporttityypit: järjestyksenvalvojan tapahtumailmoituksen
// kohdehenkilökentät näkyvät vain niissä raporteissa joissa ne on täytetty.

export const REPORT_DETAIL_FIELDS = [
  { key: 'date', label: 'Päivämäärä' },
  { key: 'place', label: 'Tapahtumapaikka' },
  { key: 'licenseHolder', label: 'Turvallisuusalan elinkeinoluvan haltija' },
  { key: 'subjectLastName', label: 'Kohdehenkilön sukunimi' },
  { key: 'subjectFirstNames', label: 'Kohdehenkilön etunimet' },
  // masked: arvo näytetään avatussa raportissa peitettynä ja paljastetaan vain
  // erikseen silmäpainikkeesta. Suora tunniste ei näy sivusilmällä esim. silloin kun
  // raporttia selataan muiden läsnä ollessa tai ruutu on jaettuna. Tämä on
  // näyttötason suoja, ei pääsynhallinta: sillä käyttäjällä joka näkee raportin on
  // oikeus myös näihin kenttiin (ks. server/permissions.js) ja arvo tulee joka
  // tapauksessa APIsta selaimeen.
  { key: 'subjectPersonalId', label: 'Kohdehenkilön henkilötunnus', masked: true },
  { key: 'subjectAddress', label: 'Kohdehenkilön osoitetiedot', masked: true },
  { key: 'subjectFeatures', label: 'Tuntomerkit' },
  { key: 'subjectObservations', label: 'Havainnot käyttäytymisestä ja tilasta' },
  { key: 'description', label: 'Vapaa kuvaus' },
  { key: 'tikeComment', label: 'TIKE:n kommentti' },
  // Erässä 1 lisätyt käsittelykentät. Tila ja vakavuus EIVÄT ole tässä listassa, koska
  // ne ovat myös muokattavia — ne näytetään modaalissa omina merkkeinään.
  { key: 'assignedTo', label: 'Vastuutettu' },
  { key: 'closedAt', label: 'Suljettu', muotoile: (v: string) => new Date(v).toLocaleString('fi-FI') },
  { key: 'closedBy', label: 'Sulkija' },
  // Tapahtumailmoitus on toimitettava poliisilaitokselle, jos kiinni otettu vapautetaan
  // (LYTP 8 § ja 33 § 3 mom).
  { key: 'policeDeliveredAt', label: 'Toimitettu poliisille', muotoile: (v: string) => new Date(v).toLocaleString('fi-FI') },
  { key: 'policeStation', label: 'Vastaanottava poliisilaitos' },
  { key: 'taskTitle', label: 'Tehtävän otsikko' },
  // muotoile: kentän arvo on koneluettava (ISO-aikaleima), joten se muotoillaan
  // vasta näytettäessä — sekä avatussa raportissa että PDF-tulosteessa.
  { key: 'taskDoneAt', label: 'Tehtävä kuitattu tehdyksi', muotoile: (v: string) => new Date(v).toLocaleString('fi-FI') },
  { key: 'taskDoneBy', label: 'Kuittaaja' },
  { key: 'taskDoneComment', label: 'Kuittauksen kommentti' },
  // Hyväksytystä yleisöilmoituksesta syntyvän kirjauksen kentät. Lähde on osa
  // kirjauksen todistusarvoa: lukijan on nähtävä että havainto on tuntemattoman
  // ohikulkijan kertoma eikä oman työntekijän tekemä.
  { key: 'reporterPlace', label: 'Ilmoittajan kertoma paikka' },
  { key: 'publicFormName', label: 'Ilmoituksen lähde (juliste)' },
  { key: 'publicReceivedAt', label: 'Ilmoitus saapui', muotoile: (v: string) => new Date(v).toLocaleString('fi-FI') },
  // masked samasta syystä kuin kohdehenkilön tunnisteet: yhteystieto on henkilötieto,
  // eikä sen kuulu näkyä sivusilmällä kun kirjauksia selataan.
  { key: 'reporterContact', label: 'Ilmoittajan yhteystieto', masked: true },
  { key: 'actions', label: 'Tehdyt toimenpiteet' },
  { key: 'resources', label: 'Käytetyt resurssit' },
  { key: 'employees', label: 'Paikalla olleet työntekijät' },
  { key: 'denied', label: 'Estetty pääsy (hlö)' },
  { key: 'removed', label: 'Poistettu alueelta (hlö)' },
  { key: 'detained', label: 'Kiinniotettu (hlö)' },
  { key: 'detainedOrForce', label: 'Otettu kiinni tai käytetty voimakeinoja', bool: true },
  { key: 'force', label: 'Voimakeinoja käytetty', bool: true },
  { key: 'tools', label: 'Voimankäyttövälineitä käytetty', bool: true },
  { key: 'firearm', label: 'Ampuma-ase esillä tai käytetty', bool: true },
  { key: 'firstAid', label: 'Ensiapu tai ensihoito annettu', bool: true },
];

// Kuvaa "Luo uusi tapahtuma" -lomakkeen kentät ryhmiteltynä — käytetään
// "Tallennetut tapahtumat" -arkistonäkymässä koko lomakedatan näyttämiseen
// vain luku -muodossa (ei pelkkiä raportteja/kirjauksia).
export const FORM_FIELD_GROUPS = [
  { title: '1. Toimeksiantajan viralliset tiedot', fields: [
    { key: 'clientName', label: 'Yrityksen tai yhdistyksen virallinen nimi' },
    { key: 'businessId', label: 'Y-tunnus' },
  ]},
  { title: '2. Yhteyshenkilöt', fields: [
    { key: 'ordererName', label: 'Tilaaja – Nimi' },
    { key: 'ordererPhone', label: 'Tilaaja – Puhelinnumero' },
    { key: 'ordererEmail', label: 'Tilaaja – Sähköpostiosoite' },
    { key: 'deciderName', label: 'Päättävä vastuuhenkilö – Nimi' },
    { key: 'deciderPhone', label: 'Päättävä vastuuhenkilö – Puhelinnumero' },
    { key: 'deciderEmail', label: 'Päättävä vastuuhenkilö – Sähköpostiosoite' },
  ]},
  { title: '3. Laskutustiedot', fields: [
    { key: 'einvoiceAddress', label: 'Verkkolaskuosoite' },
    { key: 'einvoiceOperator', label: 'Operaattoritunnus' },
    { key: 'billingRef', label: 'Viite tai kustannuspaikka' },
  ]},
  { title: '4. Tapahtuman virallinen nimi ja luonne', fields: [
    { key: 'eventName', label: 'Tapahtuman virallinen nimi' },
    { key: 'eventType', label: 'Tapahtuman luonne' },
    { key: 'eventTypeOther', label: 'Tarkenna tapahtuman luonne' },
  ]},
  { title: '5. Ajankohta ja aikataulu', fields: [
    { key: 'publicStartDate', label: 'Yleisölle alkaa (pvm)' },
    { key: 'publicStartTime', label: 'Yleisölle alkaa (klo)' },
    { key: 'publicEndDate', label: 'Yleisölle päättyy (pvm)' },
    { key: 'publicEndTime', label: 'Yleisölle päättyy (klo)' },
    { key: 'buildStart', label: 'Rakennus alkaa' },
    { key: 'buildEnd', label: 'Rakennus päättyy' },
    { key: 'teardownStart', label: 'Purku alkaa' },
    { key: 'teardownEnd', label: 'Purku päättyy' },
  ]},
  { title: '6. Tapahtumapaikka', fields: [
    { key: 'address', label: 'Tarkka osoite' },
    { key: 'areaType', label: 'Aluetyyppi' },
    { key: 'fenced', label: 'Onko alue aidattu' },
    { key: 'areaNotes', label: 'Aluerajaukset ja huomiot' },
  ]},
  { title: '7. Arvioitu yleisömäärä ja kohderyhmä', fields: [
    { key: 'audienceCount', label: 'Arvioitu yleisömäärä (hlö)' },
    { key: 'requiredJvCount', label: 'Vahvistettu JV-mitoitus (hlö)' },
    { key: 'ageProfile', label: 'Ikärakenne' },
    { key: 'audienceNotes', label: 'Kohderyhmän kuvaus' },
  ]},
  { title: '8. Riskiprofiili ja historia', fields: [
    { key: 'heldBefore', label: 'Onko vastaava tapahtuma järjestetty aiemmin' },
    { key: 'previousIncidents', label: 'Aiemmat järjestyshäiriöt, sairaankuljetukset ja poikkeamat' },
  ]},
  { title: '9. Alkoholin anniskelu', fields: [
    { key: 'hasBar', label: 'Alueella on anniskelualue', bool: true },
    { key: 'barResponsible', label: 'Anniskelusta vastaa' },
    { key: 'barOperator', label: 'Anniskeluluvan haltija ja yhteystiedot' },
  ]},
  { title: '10. Esiintyjät ja ohjelmisto', fields: [
    { key: 'performers', label: 'Esiintyjät ja puhujat' },
    { key: 'reactionRisk', label: 'Ohjelmistossa voimakkaita reaktioita herättäviä esiintyjiä/puhujia', bool: true },
    { key: 'vipGuests', label: 'Mukana VIP-vieraita, jotka vaativat henkilösuojausta', bool: true },
    { key: 'vipNotes', label: 'Tarkennus suojaustarpeesta' },
  ]},
  { title: '11. Olemassa oleva infrastruktuuri', fields: [
    { key: 'existingCctv', label: 'Onko alueella kameravalvontaa' },
    { key: 'cctvNotes', label: 'Kameravalvonnan tarkennus' },
    { key: 'lighting', label: 'Valaistus pimeän aikaan' },
    { key: 'exitRoutes', label: 'Poistumisreitit ja pelastustiet' },
  ]},
  { title: '12. Viranomaisyhteistyö', fields: [
    { key: 'policeNotification', label: 'Yleisötilaisuusilmoitus poliisille' },
    { key: 'rescuePlan', label: 'Pelastussuunnitelma pelastuslaitokselle' },
    { key: 'authorityResponsible', label: 'Kenen vastuulla asiakirjojen laatiminen on' },
  ]},
  { title: '14. Viestintä ja hätänumerot', fields: [
    { key: 'phoneTurva1', label: 'Turva 1 (turvallisuuspäällikkö)' },
    { key: 'phoneTurva2', label: 'Turva 2' },
    { key: 'phoneTike', label: 'TIKE (tilannekeskus)' },
    { key: 'phoneFirstAid', label: 'EA-päivystys' },
  ]},
  { title: '13. Muiden toimijoiden läsnäolo', fields: [
    { key: 'otherOperators', label: 'Alueella toimivat muut osapuolet' },
    { key: 'buildPhaseResponsible', label: 'Päävastuu alueen kokonaisturvallisuudesta rakennusvaiheessa' },
  ]},
];

// Radiokanavien oletusjako. Tämä on uuden tapahtuman ESITÄYTTÖ, ei kiinteä lista:
// kanavat tallentuvat tapahtuman omiin tietoihin ja jokainen tapahtuma voi muuttaa
// niitä. Aiemmin lista oli kovakoodattu suoraan näkymään, jolloin se näytti samalta
// joka tapahtumassa eikä sitä voinut korjata mistään.
export const OLETUS_RADIOKANAVAT = [
  'JV:t Tapahtuma',
  'JV:t Välitönläheisyys',
  'Toimintaryhmät',
  'Toimintaryhmät (vara)',
  'Backstage',
  'Raportointi',
  'Liikenne',
  'Turvallisuusjohto ja tike (tarvittaessa viranomaiset)',
];

// Sisäänkirjauksen roolit. "Ensiapu" ja "Muu" lisättiin, koska työntekijätilanteen
// laatikoissa oli niille kovakoodatut luvut (12 ja 8) ilman mitään datalähdettä.
export const CHECKIN_ROLES = ['Järjestyksenvalvoja', 'Vartija', 'Ensiapu', 'Muu'];

// Poikkeamiksi laskettavat kirjaustyypit.
// 'jvreport' = järjestyksenvalvojan tapahtumailmoitus (LYTP). Se on poikkeama samalla
// perusteella kuin 'jvaction': kirjaus toimenpiteestä joka kohdistui henkilöön.
export const DEVIATION_TYPES = ['jvaction', 'jvreport', 'firstaid', 'threat', 'fence', 'damage'];

// Raportit ovat polymorfisia: 14 eri typeId:tä, joilla kullakin omat lisäkenttänsä
// (ks. REPORT_DETAIL_FIELDS ja server/validation.js:n sama perustelu). Siemendatan
// muodosta johdettu tyyppi ei siksi kuvaa kokoelmaa, vaan estäisi uusien kenttien
// lukemisen — siksi any[].
export const initialReports: Kirjaus[] = [
  { id: '26/FesX/1108/099', eventId: 'fesx', typeId: 'out', type: 'Työntekijän uloskirjaus', author: 'TIKE Päivystäjä', time: '14:10', summary: 'Virtanen ulos, radiopuhelin rikki.' },
  { id: '26/FesX/1108/098', eventId: 'fesx', typeId: 'jvaction', type: 'JV:n tai vartijan toimenpide', author: 'Korhonen Elli', time: '13:45', summary: 'Kiinniotto portilla 2.', denied: 0, removed: 1, detained: 1, force: true, tools: true, firearm: false, firstAid: false },
  { id: '26/FesX/1108/097', eventId: 'fesx', typeId: 'firstaid', type: 'Ensiaputilanne', author: 'EA-Päivystys', time: '12:15', summary: 'Nyrjähdys, paikattu pisteellä.' },
  { id: '26/FesX/1108/096', eventId: 'fesx', typeId: 'jvaction', type: 'JV:n tai vartijan toimenpide', author: 'Mäkinen Kalle', time: '11:50', summary: 'Päihtynyt asiakas poistettu anniskelualueelta.', denied: 0, removed: 2, detained: 0, force: false, tools: false, firearm: false, firstAid: false },
  { id: '26/FesX/1108/095', eventId: 'fesx', typeId: 'fence', type: 'Aitojen ylitys / luvaton sisäänpääsy', author: 'Jaakko Mäki', time: '11:20', summary: 'Kaksi henkilöä aidan yli lohkolla C, poistettu alueelta.' },
  { id: '26/FesX/1108/094', eventId: 'fesx', typeId: 'firstaid', type: 'Ensiaputilanne', author: 'EA-Päivystys', time: '10:55', summary: 'Lämpöuupumus, seurantaan EA-pisteelle.' },
  { id: '26/FesX/1108/093', eventId: 'fesx', typeId: 'threat', type: 'Uhkatilanne', author: 'Liisa Ollila', time: '10:30', summary: 'Sanallinen uhkaus henkilökuntaa kohtaan pääportilla.' },
  { id: '26/FesX/1108/092', eventId: 'fesx', typeId: 'damage', type: 'Omaisuusvaurio', author: 'Markus Joki', time: '09:45', summary: 'Aitaelementti vaurioitunut lohkolla B.' },
  { id: '26/FesX/1108/091', eventId: 'fesx', typeId: 'jvaction', type: 'JV:n tai vartijan toimenpide', author: 'Korhonen Elli', time: '09:20', summary: 'Pääsy estetty portilla 2, ei lippua.', denied: 3, removed: 0, detained: 0, force: false, tools: false, firearm: false, firstAid: false },
  { id: '26/FesX/1108/090', eventId: 'fesx', typeId: 'patrol', type: 'Kierrosraportti', author: 'Anna Lahti', time: '09:00', summary: 'Aamukierros, ei huomautettavaa.' }
];


// Avausvalmiuden kuittauskohdat. Yhdessä paikassa siksi, että sekä lomake että
// suunnittelunäkymän tilapalkki lukevat saman listan — laskurissa oli aiemmin
// kovakoodattu 5, joka olisi vanhentunut hiljaa jos listaan lisätään kohta.
export const READINESS_CHECKS = [
  { key: 'exits', label: 'Hätäuloskäynnit miehitetty' },
  { key: 'guards', label: 'Vähintään 80% järjestyksenvalvojista paikalla' },
  { key: 'vehicles', label: 'Ajoneuvot pois alueelta' },
  { key: 'production', label: 'Tuotanto valmis avaukseen' },
  { key: 'security', label: 'Turvajohto valmis avaukseen' },
];

export const tyhjatKuittaukset = () => Object.fromEntries(READINESS_CHECKS.map((i) => [i.key, false]));
