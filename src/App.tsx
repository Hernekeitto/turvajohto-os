import React, { useState, useEffect, useRef } from 'react';
import { useSession } from './SessionContext';
// Jaetut apurit (ks. src/shared/). Nämä olivat aiemmin tässä tiedostossa, mutta ne eivät
// koske App-komponentin tilaan ja GUARD-puoli tarvitsee ne samoina.
import { TUNNISTE_ALKU, seuraavaTunnisteNumero, muotoileTunniste, taydennaTunnisteet } from './shared/tunnisteet';
import { kayttajatunnusNimesta, splitFullName, buildFullName } from './shared/nimet';
import { paikallinenPaiva, yhdistaPaivaJaAika, muotoileLaskuri, muotoileKirjautumisaika } from './shared/ajat';
import { muotoileEuro, laskeKokonaispalkka, isValidPasswordClient } from './shared/muotoilu';
import { htmlTeksti, tulostusDokumentti, tulostaDokumentti } from './shared/tuloste';
import { jaotteleSailytysajan, tapahtumanPoistoaikataulu } from './shared/sailytysaika';
import { DEFAULT_BUCKET, canView, canEdit, sitemapIdForTab } from './shared/oikeudet';
import { TILAT, VAKAVUUDET, tila as kirjauksenTila, onLukittu, onPoikkeama, uusiKorjausmerkinta } from './shared/kirjaukset';
import { lomakeRaportille, lomakeTunnus } from './shared/lomakerekisteri';
import { TilaMerkki, VakavuusMerkki, LukkoMerkki } from './shared/komponentit/TilaMerkki';
import { Kartta } from './shared/komponentit/Kartta';
import { SijaintiValinta } from './shared/komponentit/SijaintiValinta';
import {
  VYOHYKEVARIT, VYOHYKKEEN_MIN_PISTEET, uusiVyohykeId, vyohykkeet as haeVyohykkeet,
  vyohykkeenNimi, type Piste,
} from './shared/vyohykkeet';
import { DashboardCard } from './shared/komponentit/DashboardCard';
import { EmpStatusBadge, getEmpStatus } from './shared/komponentit/EmpStatusBadge';
import { NotificationBell, ProfileMenu } from './shared/komponentit/YlapalkkiOsat';
import { Ylapalkki, YlapalkkiLogo } from './shared/komponentit/Ylapalkki';
import { TakaisinLinkki } from './shared/komponentit/TakaisinLinkki';
import { AlertBanner } from './shared/komponentit/AlertBanner';
import { ASETUSTEN_SIVUKARTAT } from './asetusten-sivukartat';
import { Kayttajatasot } from './shared/asetukset/Kayttajatasot';
import { Tallennustila } from './shared/asetukset/Tallennustila';
import { Sailytysajat } from './shared/asetukset/Sailytysajat';
import {
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  Users, 
  Clock, 
  FileText, 
  PhoneCall,
  CheckCircle,
  XCircle,
  BarChart2,
  Calendar,
  Layers,
  Map,
  Settings,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Info,
  X,
  ArrowLeft,
  LogIn,
  LogOut,
  PenTool,
  HeartPulse,
  Clipboard,
  Cloud,
  ShieldAlert,
  Package,
  Wrench,
  Search,
  UserPlus,
  IdCard,
  UserCheck,
  Contact,
  Archive,
  Camera,
  Paperclip,
  FileCheck,
  Home,
  DoorOpen,
  CheckSquare,
  Menu,
  Plus,
  Briefcase,
  Pencil,
  Trash2,
  Landmark,
  Languages,
  BadgeCheck,
  HardHat,
  KeyRound,
  QrCode,
  Smartphone,
  RefreshCw,
  History,
  Eye,
  EyeOff,
  PlusCircle,
} from 'lucide-react';

// --- MOCK DATA ---
const mockEmployees = [
  "Korhonen Elli Marja Orvokki",
  "Virtanen Matti Johannes Antero",
  "Mäkinen Kalle Petteri Aleksi",
  "Nieminen Anna Sofia Maria",
  "Lahtinen Oskari Juhani Tapio"
];

// Työntekijäpankin alkuarvo ensimmäistä latausta varten — todellinen rekisteri
// tulee palvelimelta (ks. `employees`-tila) samaan tapaan kuin tapahtumat/raportit.
const emptyEmpForm = {
  // Pysyvä tunnistenumero (#1000 →). Annetaan automaattisesti tallennettaessa eikä sitä
  // muuteta jälkikäteen — ks. seuraavaTunnisteNumero.
  displayId: null,
  // 1. Henkilötiedot
  firstName: '', lastName: '', personalId: '', birthDate: '', nationality: '',
  // 2. Yhteystiedot
  address: '', postalCode: '', postalCity: '', email: '', phone: '',
  // 3. Pankkitiedot
  iban: '', bic: '', bankName: '',
  // Veronumero on rakennusalan veronumerorekisterin 12-numeroinen tunniste. Salataan
  // levylle henkilötunnuksen tapaan (ks. server/store.js ENCRYPTED_FIELDS).
  taxNumber: '',
  // 4. Työsuhdetiedot. Työsopimuksen ehdot kerätään samaan lomakkeeseen, koska
  // työntekijäpankki on ainoa paikka jossa työntekijän tiedot ovat kokonaisuutena.
  employmentStart: '',
  // 'permanent' = toistaiseksi voimassa oleva, 'fixed' = määräaikainen (jolloin
  // employmentFixedFrom/To kertovat jakson).
  employmentType: '',
  employmentFixedFrom: '', employmentFixedTo: '',
  workLocation: '',
  // 'monthly' = kuukausipalkka 120 h / 3 vk, 'parttime' = osa-aikainen tuntipalkka
  // (alle 112 h 30 min / 3 vk), 'oncall' = erikseen työhön kutsuttava (työvoimareservi).
  workTimeType: '',
  minHoursPer3Weeks: '',
  // Palkkaus. Tasopalkan euromäärä syötetään käsin: TES:n palkkataulukko muuttuu
  // sopimuskausittain eikä sitä ole sovelluksessa, joten taso ja paikkakuntaluokka
  // kirjataan dokumentoinniksi ja euromäärä sen viereen.
  payLevel: '', municipalityClass: '', basePay: '',
  personalPayPart: '', personalPayBasis: '',
  personalPay: '',
  otherPay: '', otherPayBasis: '',
  // Kuukausipalkan jakaja tuntipalkaksi. Oletus 173.33 = 120 h / 3 vk eli 40 h/vk
  // kuukausikeskiarvona — muutettavissa, koska oikea jakaja riippuu sopimuksesta.
  hourDivisor: '173.33',
  otherTerms: '',
  // Vartijan peruskurssin sitoutumisehto (ks. Koulutus-tekstiruutu lomakkeessa).
  trainingCommitmentMonths: '', trainingCourseCost: '',
  // 5. Ajokortti ja yleiset luvat
  hasDrivingLicense: false,
  drivingLicense: '',
  adrPermit: false, alcoholPass: false, hygienePass: false,
  craneCard: false, craneCardUntil: '',
  electricalWorkCard: false, electricalWorkCardUntil: '',
  firstAidEA1: false, firstAidEA1Until: '',
  firstAidEA2: false, firstAidEA2Until: '',
  firstAidEA3: false, firstAidEA3Until: '',
  // 6. Turvallisuusalan kortit (kyllä/ei + numero + voimassa kuukausi/vuosi)
  hasJvCard: false, jvCard: '', jvCardValidUntil: '',
  hasGuardCard: false, guardCard: '', guardCardValidUntil: '',
  hasGasPermit: false, gasPermit: '', gasPermitValidUntil: '',
  // Voimankäyttövälineiden kertauskoulutus kuuluu turvallisuusalan pätevyyksiin, ei
  // yleisiin työturvallisuuskortteihin — siirretty tänne osiosta 7.
  trainingRefresher: false, trainingRefresherUntil: '',
  // 7. Työturvallisuuskortit (kyllä/ei + voimassa pvm)
  roadSafetyCard: false, roadSafetyCardUntil: '',
  forkliftCard: false, forkliftCardUntil: '',
  hotWorkCard: false, hotWorkCardUntil: '',
  safetyCard: false, safetyCardUntil: '',
  // 8. Erityiskoulutukset (kyllä/ei)
  trainingForce: false, trainingGas: false, trainingBaton: false, firearmTraining: false,
  // 9. Kielitaito ({ language, level } -lista, level 1-5)
  languages: [],
};

// Muodostaa lomaketilan olemassa olevasta rekisterimerkinnästä (tai pelkästä nimestä),
// ja täydentää etu-/sukunimen vanhasta datasta jos niitä ei ole vielä tallennettu erikseen.
const employeeToFormState = (emp) => {
  if (!emp) return emptyEmpForm;
  const needsSplit = emp.firstName === undefined && emp.name;
  const pohja = { ...emptyEmpForm, ...emp, ...(needsSplit ? splitFullName(emp.name) : {}) };
  // Kyllä-valinnat (hasJvCard, hasDrivingLicense, ...) lisättiin vasta jälkikäteen: ennen
  // niitä tallennetuilla työntekijöillä on pelkkä kortin numero tai ajo-oikeuden laatu.
  // Ilman tätä johtamista vanhan työntekijän kortti näyttäisi lomakkeella rastittamattomalta
  // ja sen kentät olisivat lukittuina — eli tiedot katoaisivat näkyvistä.
  return {
    ...pohja,
    hasDrivingLicense: !!(emp.hasDrivingLicense || emp.drivingLicense),
    hasJvCard: !!(emp.hasJvCard || emp.jvCard),
    hasGuardCard: !!(emp.hasGuardCard || emp.guardCard),
    hasGasPermit: !!(emp.hasGasPermit || emp.gasPermit),
  };
};

// Onko työntekijällä kyseinen turvallisuusalan kortti? Kyllä-valinta riittää, mutta
// pelkkä kortin numero kelpaa myös (ks. employeeToFormState: vanha data).
const onKortti = (emp: any, boolKey: string, numKey: string) => !!(emp?.[boolKey] || emp?.[numKey]);


const initialEmployees = mockEmployees.map((name, idx) => ({
  ...emptyEmpForm,
  ...splitFullName(name),
  id: `emp-seed-${idx}`,
  name,
  // Tämän on oltava emptyEmpFormin JÄLKEEN: siinä displayId on null, joka muuten
  // ylikirjoittaisi tässä annetun numeron.
  displayId: TUNNISTE_ALKU + idx,
}));

// Tapahtumat — jaettu perustieto, käytetään sekä tapahtumavalinnassa että
// tapahtumariippumattomassa raporttinäkymässä (nimen näyttämiseen).
// Tämä on vain alkuarvo ensimmäistä latausta varten — todellinen lista tulee
// palvelimelta (ks. `events`-tila) ja "Luo uusi tapahtuma" -lomake lisää siihen.
const INITIAL_EVENTS = [
  {
    id: 'fesx',
    name: 'FestivaaliX',
    status: 'Käynnissä',
    statusTone: 'bg-emerald-100 text-emerald-700',
    dates: '11.8.–13.8.2026',
    place: 'Ratinan suvanto, Tampere',
    audience: '14 200 hlö / vrk',
    client: 'Tapahtumatuotanto X Oy',
    accent: 'border-emerald-200 hover:border-emerald-400'
  },
  {
    id: 'feso',
    name: 'FestivaaliÖ',
    status: 'Suunnittelu',
    statusTone: 'bg-slate-200 text-slate-700',
    dates: '5.9.–6.9.2026',
    place: 'Ei vahvistettu',
    audience: 'Arvio puuttuu',
    client: 'Mallitoimeksiantaja',
    accent: 'border-slate-200 hover:border-indigo-400'
  }
];

function findEventName(eventId, eventsList) {
  // Vanha data ilman eventId-kenttää lasketaan kuuluvaksi FestivaaliX:ään
  // (sama oletus kuin currentEventReports/currentEventCheckedIn-suodatuksessa)
  const id = eventId || 'fesx';
  return eventsList.find(e => e.id === id)?.name || id;
}

// Raporttien tyyppikohtaiset lisäkentät ihmisluettavaksi "Avaa raportti" -näkymässä.
// id/eventId/typeId/type/author/time/summary/attachment näytetään erikseen kiinteässä muodossa.
// Tyhjät kentät jätetään näyttämättä (ks. suodatin openedReport-modaalissa), joten
// sama lista kattaa kaikki raporttityypit: järjestyksenvalvojan tapahtumailmoituksen
// kohdehenkilökentät näkyvät vain niissä raporteissa joissa ne on täytetty.

const REPORT_DETAIL_FIELDS = [
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
const FORM_FIELD_GROUPS = [
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

const initialCheckedInEmployees = [
  { id: 1, eventId: 'fesx', name: "Korhonen Elli Marja Orvokki", role: "Järjestyksenvalvoja", vest: true, badge: "1234", headset: true, radio: "R-12", checkInDate: "", checkInTime: "10:15", checkOutDate: "", checkOutTime: "", comment: "", checkOutComment: "", status: 'checked_in' },
  { id: 2, eventId: 'fesx', name: "Virtanen Matti Johannes Antero", role: "Vartija", vest: false, badge: "5521", headset: false, radio: "", checkInDate: "", checkInTime: "10:22", checkOutDate: "", checkOutTime: "", comment: "", checkOutComment: "", status: 'checked_in' },
  { id: 3, eventId: 'fesx', name: "Mäkinen Kalle Petteri Aleksi", role: "Järjestyksenvalvoja", vest: true, badge: "9982", headset: true, radio: "R-05", checkInDate: "", checkInTime: "10:40", checkOutDate: "", checkOutTime: "", comment: "", checkOutComment: "", status: 'checked_in' }
];

// Radiokanavien oletusjako. Tämä on uuden tapahtuman ESITÄYTTÖ, ei kiinteä lista:
// kanavat tallentuvat tapahtuman omiin tietoihin ja jokainen tapahtuma voi muuttaa
// niitä. Aiemmin lista oli kovakoodattu suoraan näkymään, jolloin se näytti samalta
// joka tapahtumassa eikä sitä voinut korjata mistään.
const OLETUS_RADIOKANAVAT = [
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
const CHECKIN_ROLES = ['Järjestyksenvalvoja', 'Vartija', 'Ensiapu', 'Muu'];

// Poikkeamiksi laskettavat kirjaustyypit.
// 'jvreport' = järjestyksenvalvojan tapahtumailmoitus (LYTP). Se on poikkeama samalla
// perusteella kuin 'jvaction': kirjaus toimenpiteestä joka kohdistui henkilöön.
const DEVIATION_TYPES = ['jvaction', 'jvreport', 'firstaid', 'threat', 'fence', 'damage'];

// Raportit ovat polymorfisia: 14 eri typeId:tä, joilla kullakin omat lisäkenttänsä
// (ks. REPORT_DETAIL_FIELDS ja server/validation.js:n sama perustelu). Siemendatan
// muodosta johdettu tyyppi ei siksi kuvaa kokoelmaa, vaan estäisi uusien kenttien
// lukemisen — siksi any[].
const initialReports: any[] = [
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

// --- COMPONENTS ---

// Avausvalmiuden kuittauskohdat. Yhdessä paikassa siksi, että sekä lomake että
// suunnittelunäkymän tilapalkki lukevat saman listan — laskurissa oli aiemmin
// kovakoodattu 5, joka olisi vanhentunut hiljaa jos listaan lisätään kohta.
const READINESS_CHECKS = [
  { key: 'exits', label: 'Hätäuloskäynnit miehitetty' },
  { key: 'guards', label: 'Vähintään 80% järjestyksenvalvojista paikalla' },
  { key: 'vehicles', label: 'Ajoneuvot pois alueelta' },
  { key: 'production', label: 'Tuotanto valmis avaukseen' },
  { key: 'security', label: 'Turvajohto valmis avaukseen' },
];

const tyhjatKuittaukset = () => Object.fromEntries(READINESS_CHECKS.map((i) => [i.key, false]));




// Sisäänkirjausrivin kommentit listana ({id, text, author, date, time}) — vanha data
// tunsi vain yhden merkkijonokentän (comment), joka näytetään taannehtivasti yhtenä
// "legacy"-kommenttina kunnes se korvautuu uudella listalla.
const getEmpComments = (emp) => {
  if (Array.isArray(emp.comments)) return emp.comments;
  if (emp.comment) {
    return [{ id: 'legacy', text: emp.comment, author: '', date: emp.checkInDate || '', time: emp.checkInTime || '' }];
  }
  return [];
};



// ====================== PIKATOIMINNOT / HÄTÄTEKSTIVIESTIT ======================
//
// Nämä ovat käyttöliittymän peilikuva server/sms.js:n ryhmistä ja oletusnapeista.
// Vastaanottajien todellinen ratkaisu ja viestin lähetys tapahtuvat AINA palvelimella
// (ks. server/sms.js ja server/index.js) — selain ei koskaan näe puhelinnumeroita
// kokonaisina eikä puhu BulkSMS:n rajapinnan kanssa. Tämä lista on vain valikon ja
// asetuseditorin tekstejä varten, samaan tapaan kuin canView/canEdit peilaavat
// palvelimen oikeussääntöjä suodattamatta itse dataa.
const SMS_RYHMAT = [
  { id: 'checked_in', label: 'Sisäänkirjatut työntekijät', selite: 'Tapahtumaan sisäänkirjatut eli oikeasti paikalla olevat.' },
  { id: 'roster', label: 'Kaikki tapahtuman työntekijät', selite: 'Kaikki tapahtumaan merkityt, myös vielä sisäänkirjaamattomat.' },
  { id: 'emergency_numbers', label: 'Tapahtuman hätänumerot', selite: 'Tapahtuman perustietojen osio 14: Turva 1, Turva 2, TIKE ja EA-päivystys.' },
  { id: 'custom', label: 'Oma numerolista', selite: 'Nappiin kirjatut kiinteät numerot, eivät riipu tapahtumasta.' },
];

const smsRyhmanLabel = (id: string) => SMS_RYHMAT.find((r) => r.id === id)?.label || id;

// Oletusnapit kun smsButtons-kokoelmaa ei ole vielä tallennettu. PIDETTÄVÄ SYNKASSA
// server/sms.js:n OLETUSNAPIT-listan kanssa: palvelin käyttää omaansa lähetykseen, tämä
// on vain se mitä valikossa näkyy ennen ensimmäistä tallennusta.
const SMS_OLETUSNAPIT = [
  {
    id: 'evacuate',
    label: 'KAIKKIEN ALUEIDEN EVAKUOINTI',
    group: 'checked_in',
    customNumbers: [],
    body: 'TURVAJOHTO {tapahtuma}: EVAKUOINTI. Ohjaa yleiso ulos lahimmasta poistumistiesta ja siirry kokoontumispaikalle. Kuittaa TIKE:lle.',
    repliable: false,
    style: 'danger',
  },
  {
    id: 'authority_own',
    label: 'Oma Turva',
    group: 'emergency_numbers',
    customNumbers: [],
    body: 'TURVAJOHTO {tapahtuma}: Oman turvaorganisaation halytys klo {aika}. Ottakaa yhteys TIKE:en valittomasti.',
    repliable: false,
    style: 'neutral',
  },
  {
    id: 'authority_vira',
    label: 'Turva + VIRA',
    group: 'emergency_numbers',
    customNumbers: [],
    body: 'TURVAJOHTO {tapahtuma}: Turva- ja viranomaishalytys klo {aika}. Viranomaiset halytetty. Ottakaa yhteys TIKE:en.',
    repliable: false,
    style: 'neutral',
  },
  {
    id: 'authority_prep',
    label: 'Varautumistilanne',
    group: 'emergency_numbers',
    customNumbers: [],
    body: 'TURVAJOHTO {tapahtuma}: Varautumistilanne klo {aika}. Kohotettu valmius, ei viela toimenpiteita. Odota ohjeita.',
    repliable: false,
    style: 'neutral',
  },
  {
    id: 'instructions',
    label: 'Lähetä toimintaohjeita',
    group: 'checked_in',
    customNumbers: [],
    body: '',
    repliable: false,
    style: 'neutral',
  },
];

// GSM 03.38 -merkistö viestin pituuslaskuria varten. Sama taulukko kuin
// server/bulksms.js:ssä — toistettu tässä tarkoituksella, koska laskurin on päivityttävä
// jokaisella näppäinpainalluksella eikä sitä voi hakea palvelimelta. Palvelin laskee
// pituuden itse uudelleen lähetyshetkellä; tämä on vain käyttäjäpalautetta.
const GSM_PERUS =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_LAAJENNUS = '^{}\\[~]|€';

// Toimitustilojen esitys. ACCEPTED = otettu vastaan lähetettäväksi, SENT = luovutettu
// operaattorille, DELIVERED = perillä puhelimessa, FAILED = ei mennyt perille.
// DRY_RUN on sovelluksen oma tila kuivaharjoittelulle.
const SMS_TILA_META: Record<string, { label: string; tone: string }> = {
  DELIVERED: { label: 'Perillä', tone: 'bg-emerald-100 text-emerald-700' },
  SENT: { label: 'Matkalla', tone: 'bg-sky-100 text-sky-700' },
  ACCEPTED: { label: 'Vastaanotettu', tone: 'bg-slate-100 text-slate-600' },
  FAILED: { label: 'Ei mennyt perille', tone: 'bg-rose-100 text-rose-700' },
  DRY_RUN: { label: 'Kuivaharjoittelu', tone: 'bg-amber-100 text-amber-700' },
};
const smsTilaMeta = (tila: string) => SMS_TILA_META[tila] || { label: tila || 'Tuntematon', tone: 'bg-slate-100 text-slate-600' };

// Yhden lähetyksen toimitustilanne. Sama laskenta kuin server/smswebhook.js:n
// koostaTilanne — toistettu tässä koska frontti laskee sen jo ladatusta datasta eikä
// erillistä kutsua kannata tehdä.
const koostaSmsTilanne = (lahetys: any) => {
  const saajat = Array.isArray(lahetys?.recipients) ? lahetys.recipients : [];
  const laske = (tila: string) => saajat.filter((s: any) => s?.status === tila).length;
  return {
    yhteensa: saajat.length,
    perilla: laske('DELIVERED'),
    epaonnistui: laske('FAILED'),
    matkalla: laske('ACCEPTED') + laske('SENT'),
    kuivaharjoittelu: laske('DRY_RUN'),
  };
};

const laskeViestinMitat = (text: string) => {
  const s = typeof text === 'string' ? text : '';
  let septetit = 0;
  let gsm = true;
  for (const ch of Array.from(s)) {
    if (GSM_PERUS.includes(ch)) septetit += 1;
    else if (GSM_LAAJENNUS.includes(ch)) septetit += 2;
    else { gsm = false; break; }
  }
  if (!gsm) {
    const yksikot = s.length;
    const osia = yksikot === 0 ? 1 : yksikot <= 70 ? 1 : Math.ceil(yksikot / 67);
    return { encoding: 'UNICODE', pituus: yksikot, osia, osanRaja: osia > 1 ? 67 : 70 };
  }
  const osia = septetit === 0 ? 1 : septetit <= 160 ? 1 : Math.ceil(septetit / 153);
  return { encoding: 'TEXT', pituus: septetit, osia, osanRaja: osia > 1 ? 153 : 160 };
};



// Tehtävän kiireellisyys. Tehtävä syntyy TIKE:n avoimesta kirjauksesta, kun
// kirjaaja rastii "Merkitse tehtäväksi" — tieto tallentuu raportin kenttiin
// taskTitle/taskUrgency, joten erillistä kokoelmaa ei tarvita ja tehtävä säilyy
// samassa lokissa kuin kirjaus josta se syntyi.
// jarjestys ratkaisee Tilannekuvan Tehtävät-listan järjestyksen (pienin ensin).
// Kauanko tehtävä on ollut auki. Muoto "HH:MM:SS" tai "2 pv HH:MM:SS" kuten
// avausvalmiuden laskurissa. Lasketaan createdAt-kentästä, joka on tarkka
// aikaleima (time-kenttä on vain kellonaika ilman päivää).
const tehtavanIka = (tehtava: any, nyt: Date) => {
  const luotu = tehtava?.createdAt ? new Date(tehtava.createdAt) : null;
  if (!luotu || Number.isNaN(luotu.getTime())) return '—';
  return muotoileLaskuri(nyt.getTime() - luotu.getTime());
};

const TEHTAVA_KIIREET = {
  red: {
    jarjestys: 0,
    label: 'ASAP',
    piste: 'bg-rose-500',
    reuna: 'border-rose-200 bg-rose-50',
    teksti: 'text-rose-700',
  },
  orange: {
    jarjestys: 1,
    label: 'Mahdollisimman pian',
    piste: 'bg-amber-500',
    reuna: 'border-amber-200 bg-amber-50',
    teksti: 'text-amber-700',
  },
  blue: {
    jarjestys: 2,
    label: 'Ei määritettyä aikaa',
    piste: 'bg-blue-500',
    reuna: 'border-blue-200 bg-blue-50',
    teksti: 'text-blue-700',
  },
};
type TehtavaKiire = keyof typeof TEHTAVA_KIIREET;
const TEHTAVA_KIIRE_OLETUS: TehtavaKiire = 'blue';
// Tuntematon tai puuttuva arvo (vanha data) tulkitaan vähiten kiireelliseksi.
const tehtavanKiire = (avain?: string) =>
  TEHTAVA_KIIREET[avain as TehtavaKiire] || TEHTAVA_KIIREET[TEHTAVA_KIIRE_OLETUS];

// Montako hälytystä Tilannekuvan paneeliin mahtuu ennen kuin loput siirtyvät
// "Näytä kaikki" -painikkeen taakse. Ilman rajaa paneeli kasvaisi rajatta ja
// työntäisi muun tilannekuvan näytön alareunan alle.
const HALYTYKSET_NAYTOSSA = 5;


// --- MAIN APP COMPONENT ---

export default function App() {
  const session = useSession();
  const sessionUsername = session?.username ?? null;
  // Nimimerkki on se, mikä näkyy raporteissa "Laatija"-kenttänä (esim. "Turva 1",
  // "TIKE Päivystäjä") — käyttäjätunnus itsessään ei näy käyttäjille.
  const sessionNickname = session?.nickname || sessionUsername;
  // Sivukartta-oikeudet: admin ohittaa aina kaikki tarkistukset (ks. canView/canEdit,
  // perms['*']). Muilla oletusarvo on "ei mitään näkyvissä" kunnes admin asettaa oikeudet
  // "Muokkaa käyttäjiä" -näkymässä.
  const isAdminUser = session?.role === 'admin';
  const perms = session?.permissions;
  const [activeTab, setActiveTab] = useState('overview');
  // 'overview' | 'report_list' — mistä avoin raportti-modaali avattiin, muokkausoikeuden tarkistusta varten
  const [openedReportSource, setOpenedReportSource] = useState(null);

  // Tapahtumavalinta: null = valintasivu, 'fesx' = tuotantotapahtuma,
  // 'new' = uuden tapahtuman lomake. Muut arvot ovat tavallisia tapahtuma-id:itä;
  // erillistä 'feso'-mallinäkymää ei enää ole, koska tyhjät tiedot käsitellään nyt
  // kaikkialla kunnollisilla tyhjillä tiloilla.
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Etusivu on kirjautumisen jälkeen ensimmäinen näkymä (selectedEvent === null JA
  // showEventPicker === false). Sieltä "Valitse tapahtuma" avaa tapahtumalistan.
  const [showEventPicker, setShowEventPicker] = useState(false);

  // Tapahtuman sivuvalikon välilehdet siinä järjestyksessä kuin ne näkyvät valikossa.
  // Aloitussivu-välilehteä ei enää ole, joten tapahtuma avataan ensimmäiselle sivulle
  // johon käyttäjällä on lukuoikeus — muuten rajatuilla oikeuksilla varustettu käyttäjä
  // laskeutuisi aina renderContentin "Ei käyttöoikeutta" -sivulle.
  const oletusValilehti = (eventId: string | null) => {
    if (isAdminUser) return 'overview';
    const valilehdet = ['overview', 'reporting', 'planning', 'postevent', 'documents'];
    return valilehdet.find((id) => canView(perms, eventId, id)) || 'overview';
  };

  // Tapahtumariippumaton "Tallennetut raportit" -näkymä (kaikki tapahtumat samassa listassa)
  const [viewingAllReports, setViewingAllReports] = useState(false);
  const [allReportsSortBy, setAllReportsSortBy] = useState('newest');

  // Tapahtuman muokkaus: jos asetettu, "Luo uusi tapahtuma" -lomake päivittää
  // tämän id:n tapahtuman sen sijaan että loisi uuden. Lomake avataan aina tyhjänä.
  const [editingEventId, setEditingEventId] = useState(null);

  // "Tallennetut tapahtumat" -näkymä: poistetut (arkistoidut) tapahtumat ja niiden data
  const [viewingArchivedEvents, setViewingArchivedEvents] = useState(false);
  const [archivedEventDetailId, setArchivedEventDetailId] = useState(null);

  const emptyNewEvent = {
    clientName: '', businessId: '',
    ordererName: '', ordererPhone: '', ordererEmail: '',
    deciderName: '', deciderPhone: '', deciderEmail: '',
    einvoiceAddress: '', einvoiceOperator: '', billingRef: '',
    eventName: '', eventType: '', eventTypeOther: '',
    publicStartDate: '', publicStartTime: '', publicEndDate: '', publicEndTime: '',
    buildStart: '', buildEnd: '', teardownStart: '', teardownEnd: '',
    address: '', areaType: '', fenced: '', areaNotes: '',
    audienceCount: '', ageProfile: '', audienceNotes: '', requiredJvCount: '',
    heldBefore: '', previousIncidents: '',
    hasBar: false, barResponsible: '', barOperator: '',
    performers: '', reactionRisk: false, vipGuests: false, vipNotes: '',
    existingCctv: '', cctvNotes: '', lighting: '', exitRoutes: '',
    policeNotification: '', rescuePlan: '', authorityResponsible: '',
    otherOperators: '', buildPhaseResponsible: '',
    // 14. Viestintä ja hätänumerot. radioChannels on merkkijonolista; hätänumerot
    // näkyvät Hätätilanneohjeet-sivulla, jossa niiden kohdalla oli aiemmin pelkkä
    // rooli ilman numeroa.
    radioChannels: OLETUS_RADIOKANAVAT,
    phoneTurva1: '', phoneTurva2: '', phoneTike: '', phoneFirstAid: '',
    // Pohjakartan liitetunniste ja alkuperäinen tiedostonimi (ks. tallennaPohjakartta).
    mapUploadId: '', mapUploadName: ''
  };
  const [newEvent, setNewEvent] = useState(emptyNewEvent);
  const updNewEvent = (key, value) => setNewEvent(prev => ({ ...prev, [key]: value }));

  // Radiokanavat ovat tapahtuman oma lista, joten niitä muokataan rivi kerrallaan.
  const paivitaRadiokanava = (idx: number, arvo: string) => setNewEvent(prev => ({
    ...prev,
    radioChannels: (prev.radioChannels || []).map((k, i) => (i === idx ? arvo : k)),
  }));
  const lisaaRadiokanava = () => setNewEvent(prev => ({
    ...prev,
    radioChannels: [...(prev.radioChannels || []), ''],
  }));
  const poistaRadiokanava = (idx: number) => setNewEvent(prev => ({
    ...prev,
    radioChannels: (prev.radioChannels || []).filter((_, i) => i !== idx),
  }));
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [openedReport, setOpenedReport] = useState(null);
  // Mitkä peitetyt kentät on paljastettu juuri avatussa raportissa ({ kenttä: true }).
  // Nollataan aina kun avattu raportti vaihtuu tai modaali suljetaan, jottei paljastus
  // vahingossa periydy seuraavalle raportille.
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  // Korjausmerkinnän luonnos. Nollataan samalla kun paljastukset: kesken jäänyt teksti
  // ei saa siirtyä seuraavaan kirjaukseen, koska se päätyisi väärään tietueeseen.
  const [korjausTeksti, setKorjausTeksti] = useState('');
  // Status boardin suodattimet. Oletuksena vain keskeneräiset: jos suljetut näkyisivät
  // oletuksena, lista olisi arkisto eikä työjono.
  const [boardTila, setBoardTila] = useState('avoimet');
  const [boardVakavuus, setBoardVakavuus] = useState('');
  const [boardVyohyke, setBoardVyohyke] = useState('');
  const [boardTyyppi, setBoardTyyppi] = useState('');
  // Kirjauksen sijainti: vyöhyke ja tarkka kohta kartalla. YHTEINEN kaikille
  // raporttilomakkeille, koska vain yksi lomake on kerrallaan auki ja sijainti kysytään
  // niissä kaikissa samalla tavalla. Nollataan lomakkeen vaihtuessa, jottei edellisen
  // kirjauksen paikka päädy seuraavaan.
  const [kirjausVyohyke, setKirjausVyohyke] = useState('');
  const [kirjausPiste, setKirjausPiste] = useState<Piste | null>(null);
  // Tyhjä on sallittu arvo: kaikki kirjaukset eivät tapahdu rajatulla alueella, ja
  // pakollinen valinta johtaisi vain siihen että valitaan mikä tahansa.
  useEffect(() => {
    setKirjausVyohyke('');
    setKirjausPiste(null);
  }, [activeTab]);
  // Vyöhyke-editori: kesken oleva monikulmio ja uuden vyöhykkeen tiedot.
  const [vyohykeMuokkaus, setVyohykeMuokkaus] = useState(false);
  const [piirrettava, setPiirrettava] = useState<Piste[]>([]);
  const [uusiVyohykeNimi, setUusiVyohykeNimi] = useState('');
  const [uusiVyohykeVari, setUusiVyohykeVari] = useState(VYOHYKEVARIT[0].id);
  useEffect(() => {
    setRevealedFields({});
    setKorjausTeksti('');
  }, [openedReport?.id]);
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Pikatoimintonapit. null = kokoelmaa ei ole vielä ladattu tai sitä ei ole koskaan
  // tallennettu -> näytetään oletukset (sama päättely palvelimella, ks. sms.js:
  // kaytossaOlevatNapit). Tyhjä taulukko on eri asia: kaikki napit on poistettu.
  const [smsButtons, setSmsButtons] = useState<any[] | null>(null);
  // BulkSMS-integraation tila: onko API-tunnukset asetettu ja paljonko saldoa jäljellä.
  const [smsStatus, setSmsStatus] = useState<any>(null);
  // Avoin lähetysikkuna: { nappi, runko, vastaanottajat, lataa, virhe, tulos, vahvistus }.
  // null = ei auki. Vahvistus on erillinen vaihe, jotta massaviesti ei lähde yhdellä
  // painalluksella vahingossa.
  const [smsModal, setSmsModal] = useState<any>(null);
  // Lähetyshistoria ja työntekijöiden vastaukset. Palvelin ylläpitää molempia
  // (webhook-kutsut päivittävät toimitustiloja), joten näitä EI koskaan tallenneta
  // takaisin — ks. server/index.js: PALVELIMEN_YLLAPITAMAT.
  const [viewingSmsLog, setViewingSmsLog] = useState(false);
  const [smsLog, setSmsLog] = useState<any[]>([]);
  const [smsReplies, setSmsReplies] = useState<any[]>([]);
  const [smsLogError, setSmsLogError] = useState<string | null>(null);
  const [avattuLahetys, setAvattuLahetys] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Overview Tab State
  const [overviewCardTab, setOverviewCardTab] = useState('checklist'); // 'checklist' | 'reports'
  const [tikeLogPage, setTikeLogPage] = useState(0);
  const [tehtavatPage, setTehtavatPage] = useState(0);
  const [uusimmatPage, setUusimmatPage] = useState(0);

  // JV Form State
  // Järjestyksenvalvojan tapahtumailmoitus (report_jv). eventDate/eventTimeStr ovat
  // tämän lomakkeen tapahtuma-aika (ei käytössä muualla). Loput kentät olivat aiemmin
  // sidottomia <input>-elementtejä, joten koko lomake oli toimimaton kuori: mitään ei
  // tallentunut ja Tallenna-painikkeelta puuttui käsittelijä kokonaan.
  const [eventDate, setEventDate] = useState('');
  const [eventTimeStr, setEventTimeStr] = useState('');
  const [jvrGuardName, setJvrGuardName] = useState('');
  const [jvrLicenseHolder, setJvrLicenseHolder] = useState('');
  const [jvrPlace, setJvrPlace] = useState('');
  const [jvrDetainedForce, setJvrDetainedForce] = useState(false);
  const [jvrTools, setJvrTools] = useState(false);
  const [jvrFirearm, setJvrFirearm] = useState(false);
  const [jvrFirstAid, setJvrFirstAid] = useState(false);
  // LYTP ja sen nojalla annettu asetus oikeuttavat kirjaamaan toimenpiteiden kohteena
  // olleiden sukunimen, etunimet, henkilötunnuksen ja osoitetiedot sekä tuntomerkit.
  // Nämä kentät salataan levyllä (ks. server/store.js ENCRYPTED_FIELDS).
  const [jvrLastName, setJvrLastName] = useState('');
  const [jvrFirstNames, setJvrFirstNames] = useState('');
  const [jvrPersonalId, setJvrPersonalId] = useState('');
  const [jvrAddress, setJvrAddress] = useState('');
  const [jvrFeatures, setJvrFeatures] = useState('');
  const [jvrObservations, setJvrObservations] = useState('');
  const [jvrDesc, setJvrDesc] = useState('');
  // Tilannekeskuksen oma kommentti tapahtumailmoitukseen (TIKE:n muistilista -osio).
  // Kenttä oli aiemmin sidottamaton <textarea> ilman tilaa: teksti katosi tallennuksessa.
  const [jvrTikeComment, setJvrTikeComment] = useState('');
  const timeInputRef = useRef(null);

  // Tapahtumat (yhteinen tila koko sovellukselle, tallennetaan palvelimelle)
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  // Riskiarvioinnit (yhteinen tila koko sovellukselle, tallennetaan palvelimelle)
  const [riskAssessments, setRiskAssessments] = useState<any[]>([]);
  const [riskAssessmentsLoaded, setRiskAssessmentsLoaded] = useState(false);
  // any: riskiarvio on vapaamuotoinen tietue kuten raportitkin, eikä useState(null)
  // -päättely (never) salli sen kenttien lukemista.
  const [openedRiskAssessment, setOpenedRiskAssessment] = useState<any>(null);
  // Kuitattavana oleva tehtävä ja sen kommenttiluonnos.
  const [completingTask, setCompletingTask] = useState<any>(null);
  const [completingTaskComment, setCompletingTaskComment] = useState('');
  // Tulosteen esikatselu modaalissa: { otsikko, html }. Esikatselu näytetään
  // sovelluksen sisällä eikä uudessa välilehdessä, koska ponnahdusikkunat ovat
  // usein estettyjä (ks. tulostaDokumentti).
  const [pdfEsikatselu, setPdfEsikatselu] = useState<{ otsikko: string; html: string } | null>(null);

  // Sisäänkirjatut työntekijät (yhteinen tila koko sovellukselle, tallennetaan palvelimelle)
  const [checkedInEmployees, setCheckedInEmployees] = useState(initialCheckedInEmployees);
  const [checkinsLoaded, setCheckinsLoaded] = useState(false);

  // Käyttäjähallinta: profiilivalikon salasananvaihto + admin-only käyttäjienhallintanäkymä
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSubmitting, setChangePasswordSubmitting] = useState(false);
  const [viewingUserAdmin, setViewingUserAdmin] = useState(null); // null | 'list' | 'new' | 'permissions'
  const [userAdminList, setUserAdminList] = useState([]);
  const [userAdminLoading, setUserAdminLoading] = useState(false);
  const [userAdminError, setUserAdminError] = useState('');
  // Audit-loki: kuka teki mitä milloin (data-kokoelmien luonti/muokkaus/poisto,
  // käyttäjähallinnan muutokset, kirjautumiset) — vain admin, ks. server/audit.js.
  const [viewingAuditLog, setViewingAuditLog] = useState(false);
  const [viewingSettings, setViewingSettings] = useState(false);
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditFilters, setAuditFilters] = useState({ user: '', action: '', collection: '' });
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserNickname, setNewUserNickname] = useState('');

  const [newUserError, setNewUserError] = useState('');
  const [newUserSubmitting, setNewUserSubmitting] = useState(false);
  const [editingPermUser, setEditingPermUser] = useState(null);
  // Käyttäjätasot (server/roles.js). Taso määrää sivukartta-oikeudet — käyttäjäkohtaista
  // sivukarttaa ei enää muokata, joten "Muokkaa oikeuksia" -näkymässä valitaan vain taso.
  const [roles, setRoles] = useState<any[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [permRoleId, setPermRoleId] = useState('');
  // Palvelimen arvoma salasana näytetään kertaalleen luonnin/nollauksen jälkeen.
  const [uusiSalasanaNaytto, setUusiSalasanaNaytto] = useState(null); // { username, password }

  // Ilmoituskello. Palvelin koostaa listan (/api/notifications), joten uusia
  // ilmoituslajeja voi lisätä ilman frontin muutoksia.
  const [notifications, setNotifications] = useState([]);
  // "Minulle jaetut" -näkymä: käyttäjälle erikseen jaetut tiedostot ja kansiot.
  const [viewingSharedWithMe, setViewingSharedWithMe] = useState(false);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [sharedWithMeLoading, setSharedWithMeLoading] = useState(false);

  // Tapahtumakohtaiset lisätyt lomakkeet ("Täytettävät lomakkeet"). Sisäänrakennetut
  // lomakkeet ovat edelleen koodissa, koska niihin liittyy toiminnallisuutta (tab,
  // tulostettava kenttäluettelo) — tänne tulevat vain käyttäjän itse lisäämät.
  const [eventForms, setEventForms] = useState([]);
  const [eventFormsLoaded, setEventFormsLoaded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFormName, setNewFormName] = useState('');
  const [newFormDesc, setNewFormDesc] = useState('');
  const [newFormTag, setNewFormTag] = useState('Sisäinen');
  const [newFormTagOther, setNewFormTagOther] = useState('');

  // ---- Tapahtuman tiedostot ----
  // Kansiot ja tiedostot ovat samassa kokoelmassa: type erottaa ne ja parentId tekee
  // sisäkkäisyyden. Navigointi tapahtuu "ollaan kansiossa" -mallilla murupolun kanssa,
  // mikä on yksinkertaisempi kuin aina auki oleva puu ja toimii mielivaltaisen syvänä.
  const [eventFiles, setEventFiles] = useState([]);
  const [eventFilesLoaded, setEventFilesLoaded] = useState(false);
  const [fileShares, setFileShares] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [tiedostoUploading, setTiedostoUploading] = useState(false);
  const tiedostoInputRef = useRef<HTMLInputElement>(null);

  // Jakodialogi: mitä jaetaan ja millä ehdoilla.
  const [shareTarget, setShareTarget] = useState(null);   // eventFiles-tietue
  const [shareMode, setShareMode] = useState('link');     // 'link' | 'password' | 'users'
  const [sharePassword, setSharePassword] = useState('');
  const [shareUsers, setShareUsers] = useState([]);
  const [shareVoimassa, setShareVoimassa] = useState('7');  // vrk tai 'oma' | 'ikuinen'
  const [shareOmaPvm, setShareOmaPvm] = useState('');
  const [shareOmaKlo, setShareOmaKlo] = useState('12:00');
  const [shareMaxDownloads, setShareMaxDownloads] = useState('');
  const [shareError, setShareError] = useState('');
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [luotuLinkki, setLuotuLinkki] = useState(null);   // { url, approvalStatus }
  // Tapahtumarajaus: tyhjä = ei rajoitusta (näkee kaikki tapahtumat), muuten lista
  // tapahtuma-id:itä joihin käyttäjä on rajattu (ks. server/permissions.js: eventAccess).
  const [permEventAccess, setPermEventAccess] = useState([]);
  // Tuotepääsy: mihin puoliin ('event' / 'guard') tunnus pääsee. Palvelin torjuu tyhjän
  // listan, joten UI ei anna poistaa viimeistä valintaa (ks. vaihdaTuote).
  const [permTuotteet, setPermTuotteet] = useState(['event']);
  const [permNickname, setPermNickname] = useState('');
  const [permSaveError, setPermSaveError] = useState('');
  const [permSaving, setPermSaving] = useState(false);
  const [permTotpInfo, setPermTotpInfo] = useState(null); // { secret, otpauthUri, qrDataUri }
  const [permTotpLoading, setPermTotpLoading] = useState(false);
  const [permTotpError, setPermTotpError] = useState('');
  const [permTotpResetting, setPermTotpResetting] = useState(false);
  const [permTotpToggling, setPermTotpToggling] = useState(false);
  const [permForceLogoutSubmitting, setPermForceLogoutSubmitting] = useState(false);
  const [permForceLogoutMessage, setPermForceLogoutMessage] = useState('');

  // Työntekijäpankki: yrityksen koko henkilöstörekisteri (yhteinen tila, tallennetaan palvelimelle)
  const [employees, setEmployees] = useState(initialEmployees);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [viewingEmployeeBank, setViewingEmployeeBank] = useState(null); // null | 'list' | 'form'
  const [employeeBankSearch, setEmployeeBankSearch] = useState('');
  const [empForm, setEmpForm] = useState(emptyEmpForm);

  // "Lisää tapahtumaan työntekijä" -näkymän tila (per-tapahtuma monivalinta rekisteristä)
  const [addEmpSearch, setAddEmpSearch] = useState('');
  const [addEmpSelectedIds, setAddEmpSelectedIds] = useState([]);
  // Tapahtumakohtaiset nimimerkit "Lisää tapahtumaan" -listassa: { [työntekijän id]: 'Ensiapu 1' }
  const [addEmpNicknames, setAddEmpNicknames] = useState({});

  // Työntekijälomakkeen tunnusmodaali. Avataan osiosta 10; ei navigoi pois lomakkeelta,
  // jottei keskeneräinen työntekijän muokkaus katoa.
  const [empUserModalOpen, setEmpUserModalOpen] = useState(false);
  const [empUserPassword, setEmpUserPassword] = useState('');
  const [empUserPassword2, setEmpUserPassword2] = useState('');
  const [empUserError, setEmpUserError] = useState('');
  const [empUserNotice, setEmpUserNotice] = useState('');
  const [empUserSubmitting, setEmpUserSubmitting] = useState(false);
  const [addEmpRole, setAddEmpRole] = useState('Järjestyksenvalvoja');

  // Kirjaukset ja raportit (yhteinen tila koko sovellukselle, tallennetaan palvelimelle)
  const [reports, setReports] = useState(initialReports);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  // Näkyvä ilmoitus siitä ettei muutos mennyt palvelimelle (ks. tallennaKokoelma).
  const [saveError, setSaveError] = useState<string | null>(null);

  // Check-in Form State
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('');
  // Kun muokataan olemassa olevaa sisäänkirjausriviä "Tapahtuman työntekijät" -sivulta
  // (eikä tehdä uutta sisäänkirjausta) — kohdistaa tallennuksen tähän tiettyyn riviin id:llä.
  const [editingCheckIn, setEditingCheckIn] = useState(null);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkInRole, setCheckInRole] = useState('Järjestyksenvalvoja');
  // Tapahtumakohtainen nimimerkki ("Ensiapu 1"). Annetaan kun henkilö lisätään
  // tapahtumaan, ja on muokattavissa täällä jälkikäteen ilman että rivi pitää poistaa.
  const [checkInNickname, setCheckInNickname] = useState('');
  const [checkInVest, setCheckInVest] = useState(false);
  const [checkInBadge, setCheckInBadge] = useState('');
  const [checkInHeadset, setCheckInHeadset] = useState(false);
  const [checkInRadio, setCheckInRadio] = useState('');
  const [checkInComment, setCheckInComment] = useState('');

  // Check-out Form State
  const [outEmpSearch, setOutEmpSearch] = useState('');
  const [selectedOutEmp, setSelectedOutEmp] = useState(null);
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  // Vuoron päätteeksi kirjattavat huomiot (rikkoutuneet/kadonneet välineet yms.).
  // Kenttä oli aiemmin sidottamaton <textarea>: handleCheckOut ei lukenut sitä lainkaan.
  const [checkOutComment, setCheckOutComment] = useState('');
  const [showOutTimeInput, setShowOutTimeInput] = useState(false);

  // JV:n / vartijan toimenpide -lomakkeen tila
  const [jvaRole, setJvaRole] = useState('Järjestyksenvalvoja');
  const [jvaSearch, setJvaSearch] = useState('');
  const [jvaName, setJvaName] = useState('');
  const [jvaLocation, setJvaLocation] = useState('');
  const [jvaDate, setJvaDate] = useState('');
  const [jvaTime, setJvaTime] = useState('');
  const [jvaDenied, setJvaDenied] = useState(false);
  const [jvaDeniedCount, setJvaDeniedCount] = useState('');
  const [jvaRemoved, setJvaRemoved] = useState(false);
  const [jvaRemovedCount, setJvaRemovedCount] = useState('');
  const [jvaDetained, setJvaDetained] = useState(false);
  const [jvaDetainedCount, setJvaDetainedCount] = useState('');
  const [jvaForce, setJvaForce] = useState(false);
  const [jvaTools, setJvaTools] = useState(false);
  const [jvaToolList, setJvaToolList] = useState([]);
  const [jvaToolOther, setJvaToolOther] = useState('');
  const [jvaFirearm, setJvaFirearm] = useState(false);
  const [jvaFirstAid, setJvaFirstAid] = useState(false);
  const [jvaDesc, setJvaDesc] = useState('');
  const [jvaReporterFiled, setJvaReporterFiled] = useState(false);

  // Riskin arviointi -lomakkeen tila
  const [raTarget, setRaTarget] = useState('');
  const [raHazard, setRaHazard] = useState('');
  const [raCategory, setRaCategory] = useState('');
  const [raControls, setRaControls] = useState('');
  const [raProb, setRaProb] = useState(0);
  const [raSev, setRaSev] = useState(0);
  const [raActions, setRaActions] = useState('');
  const [raOwner, setRaOwner] = useState('');
  const [raDeadline, setRaDeadline] = useState('');
  const [raResProb, setRaResProb] = useState(0);
  const [raResSev, setRaResSev] = useState(0);

  // Open Log Form State
  const [openKirjausDate, setOpenKirjausDate] = useState('');
  // "Merkitse tehtäväksi": kirjaus nostetaan Tilannekuvan Tehtävät-listaan.
  const [openKirjausTask, setOpenKirjausTask] = useState(false);
  const [openKirjausTaskTitle, setOpenKirjausTaskTitle] = useState('');
  const [openKirjausTaskUrgency, setOpenKirjausTaskUrgency] = useState<TehtavaKiire>(TEHTAVA_KIIRE_OLETUS);
  const [openKirjausTime, setOpenKirjausTime] = useState('');
  const [openKirjausText, setOpenKirjausText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileUploadId, setFileUploadId] = useState('');
  const [fileUploading, setFileUploading] = useState(false);
  const [runningNumber, setRunningNumber] = useState(100);
  const [riskRunningNumber, setRiskRunningNumber] = useState(1);

  // First Aid Form State
  const [faDate, setFaDate] = useState('');
  const [faTime, setFaTime] = useState('');
  const [faDesc, setFaDesc] = useState('');
  const [faActions, setFaActions] = useState('');
  const [faResources, setFaResources] = useState('');
  const [faEmployees, setFaEmployees] = useState('');
  const [faFileName, setFaFileName] = useState('');
  const [faFileUploadId, setFaFileUploadId] = useState('');
  const [faFileUploading, setFaFileUploading] = useState(false);

  // Generic TIKE Reports State
  const [genRepDate, setGenRepDate] = useState('');
  const [genRepTime, setGenRepTime] = useState('');
  const [genRepDesc, setGenRepDesc] = useState('');
  const [genRepActions, setGenRepActions] = useState('');
  const [genRepEmps, setGenRepEmps] = useState('');
  const [genRepFile, setGenRepFile] = useState('');
  const [genRepFileUploadId, setGenRepFileUploadId] = useState('');
  const [genRepFileUploading, setGenRepFileUploading] = useState(false);
  // Tapahtuman pohjakartan lähetys (Tapahtuman yleiskatsaus -sivu).
  const [karttaUploading, setKarttaUploading] = useState(false);

  // Edit Employee Form State
  const [editingEmp, setEditingEmp] = useState(null);

  // Avausvalmius. Tallennettu tila tulee palvelimelta kokoelmana 'readiness'
  // (yksi tietue per tapahtuma) — aiemmin koko näkymä oli pelkkää paikallista
  // tilaa, joten "Tallenna ja sulje" ei tallentanut mitään ja kuittaukset
  // katosivat sivun latauksessa sekä vuotivat tapahtumasta toiseen.
  const [readiness, setReadiness] = useState<any[]>([]);
  const [readinessLoaded, setReadinessLoaded] = useState(false);
  // Alla olevat ovat lomakkeen LUONNOS: ne kirjoitetaan kokoelmaan vasta
  // "Tallenna ja sulje" -painikkeesta (handleSaveReadiness), jotta painike
  // vastaa sitä mitä se lupaa eikä jokainen ruksi laukaise omaa tallennustaan.
  const [targetOpeningDate, setTargetOpeningDate] = useState('');
  const [targetOpeningTime, setTargetOpeningTime] = useState('');
  const [readinessChecks, setReadinessChecks] = useState(tyhjatKuittaukset);
  const [readinessComments, setReadinessComments] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Palautetaan TIKE-lokin sivutus alkuun kun vaihdetaan tapahtumaa
  useEffect(() => {
    setTikeLogPage(0);
    setTehtavatPage(0);
    setUusimmatPage(0);
  }, [selectedEvent]);

  // Ladataan käyttäjälista aina kun "Muokkaa käyttäjiä" -listanäkymä avataan (myös
  // paluu luonti-/oikeuslomakkeelta), jotta lista pysyy tuoreena.
  useEffect(() => {
    if (viewingUserAdmin === 'list') {
      fetchUserAdminList();
      // Tasojen nimet näkyvät listan "Käyttäjätaso"-sarakkeessa.
      fetchRoles();
    }
  }, [viewingUserAdmin]);

  // before annettuna haetaan "lisää" edellisen sivun jatkoksi (append), muuten
  // tuore ensimmäinen sivu suodattimilla (replace).
  const fetchAuditLog = (before) => {
    setAuditLoading(true);
    setAuditError('');
    const params = new URLSearchParams({ limit: '50' });
    if (before) params.set('before', before);
    if (auditFilters.user.trim()) params.set('user', auditFilters.user.trim());
    if (auditFilters.action) params.set('action', auditFilters.action);
    if (auditFilters.collection) params.set('collection', auditFilters.collection);
    fetch(`/api/audit?${params.toString()}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setAuditEntries((prev) => (before ? [...prev, ...data.entries] : data.entries));
          setAuditHasMore(data.hasMore);
        } else {
          setAuditError(data.error || 'Lokin haku epäonnistui.');
        }
      })
      .catch(() => setAuditError('Yhteysvirhe.'))
      .finally(() => setAuditLoading(false));
  };

  // Ladataan loki tuoreena aina kun näkymä avataan.
  useEffect(() => {
    if (viewingAuditLog) fetchAuditLog();
  }, [viewingAuditLog]);

  // Käyttäjätasot näkyvät Sovellusasetusten omassa osiossaan. Käyttäjälista tarvitaan
  // siihen, että kunkin tason kohdalla voi näyttää ketkä sillä ovat. Tallennustilan
  // mittari hakee omat tietonsa itse (shared/asetukset/Tallennustila.tsx).
  useEffect(() => {
    if (!viewingSettings) return;
    fetchRoles();
    fetchUserAdminList();
  }, [viewingSettings]);

  // Istunto voi mitätöityä palvelimella milloin tahansa ilman että selain tietää siitä
  // etukäteen (admin painoi "Kirjaa käyttäjä ulos", liukuva istunto ehti vanhentua,
  // JWT_SECRET vaihtui palvelimen uudelleenkäynnistyksessä, jne.) — jokainen requireAuth-
  // suojattu reitti vastaa silloin 401:llä. Tämä huomaa sen HETI seuraavassa API-kutsussa
  // riippumatta mistä toiminnosta se tulee (ei vain 5 min välein pingaavasta
  // käyttämättömyysvahdista), ja palauttaa kirjautumisnäkymään sen sijaan että
  // toiminto epäonnistuisi huomaamattomasti taustalla.
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
      if (response.status === 401 && url.startsWith('/api/') && !url.startsWith('/api/login')) {
        try { sessionStorage.setItem('tj_session_expired', '1'); } catch { /* ei kriittinen */ }
        window.location.reload();
      }
      return response;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  // Automaattinen uloskirjaus 1h käyttämättömyyden jälkeen — ei koske pääkäyttäjää.
  // Palvelimen istunto on jo itsessään liukuva (ks. server/index.js requireAuth), tämä
  // antaa lisäksi välittömän palautteen (kirjaa ulos heti ilman että pitää odottaa
  // seuraavaa epäonnistuvaa API-kutsua) ja pitää palvelimen istunnon voimassa
  // pingaamalla /api/session kun oikeaa aktiivisuutta havaitaan.
  useEffect(() => {
    if (isAdminUser) return;
    const IDLE_MS = 60 * 60 * 1000; // 1h
    const TOUCH_INTERVAL_MS = 5 * 60 * 1000; // pidä palvelimen istunto elossa enintään 5 min välein
    const POLL_MS = 30 * 1000; // tarkista pakotettu uloskirjaus tasaisin väliajoin riippumatta siitä tekeekö käyttäjä mitään API-kutsua vaativaa
    let idleTimer: ReturnType<typeof setTimeout>;
    let lastTouch = 0;

    // Sama tarkistus kahdesta eri syystä: 1) aktiivisuuspingi pitää liukuvan istunnon
    // voimassa, 2) säännöllinen pollaus huomaa "Kirjaa käyttäjä ulos" -painikkeen tai
    // muun mitätöinnin, vaikka käyttäjä vain selaisi näkymiä eikä tekisi mitään
    // tallennusta tms. (jolloin globaali fetch-käärin ei muuten laukeaisi lainkaan).
    const checkSession = () => {
      fetch('/api/session', { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => { if (!data.authenticated) window.location.reload(); })
        .catch(() => {});
    };

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { handleLogout(); }, IDLE_MS);
    };

    const onActivity = () => {
      resetIdleTimer();
      const now = Date.now();
      if (now - lastTouch > TOUCH_INTERVAL_MS) {
        lastTouch = now;
        checkSession();
      }
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    resetIdleTimer();
    const pollTimer = setInterval(checkSession, POLL_MS);

    return () => {
      clearTimeout(idleTimer);
      clearInterval(pollTimer);
      events.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
  }, [isAdminUser]);

  // Ladataan tapahtumat palvelimelta sivun avautuessa (jaettu kaikkien käyttäjien kesken)
  useEffect(() => {
    fetch('/api/data/events', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        // loaded asetetaan true:ksi VAIN onnistuneella vastauksella (res.ok===true on
        // API:n oma ok-kenttä, ei HTTP-statusta) — muuten epäonnistunut haku (verkkovirhe,
        // ei oikeutta) voisi laukaista tallennus-useEffectin tyhjällä/alkutilalla ja
        // pyyhkiä koko kokoelman palvelimelta. Ks. myös server/validation.js:n
        // romahdussuoja, joka estää tämän myös jos tämä tarkistus jostain syystä pettäisi.
        if (res && res.ok === true) {
          if (Array.isArray(res.data)) setEvents(res.data);
          setEventsLoaded(true);
        }
      })
      .catch(() => {
        // Verkkovirhe: loaded EI asetu true:ksi (ks. yllä) — tallennus ei laukea tyhjällä.
      });
  }, []);

  // Kokoelman tallennus palvelimelle. Aiemmin jokainen tallennus oli fire and forget
  // tyhjällä .catch()-lohkolla: verkkokatko tai palvelimen hylkäys (oikeuksien puute,
  // romahdussuoja, validointivirhe) jäi täysin huomaamatta ja käyttöliittymä näytti
  // muutoksen tallentuneelta. Se on erityisen paha poistoissa — lakisääteisesti
  // hävitettävä raportti olisi voinut jäädä levylle ilman että kukaan huomaa.
  // Nyt virhe nostetaan näkyviin (ks. saveErrorBanner) eikä sitä niellä.
  // Kokoelmat joiden SEURAAVA automaattitallennus ohitetaan, koska tallennus on jo tehty
  // eksplisiittisesti allowEmpty-lipulla (viimeisen tietueen poisto). Ilman tätä
  // automaattitallennus lähettäisi saman tyhjän taulukon heti perään ilman lippua, jolloin
  // palvelimen romahdussuoja hylkäisi sen 409:llä ja käyttäjä näkisi turhan virhebannerin
  // vaikka poisto onnistui. Set.delete palauttaa true jos lippu oli asetettu — eli sama
  // kutsu sekä lukee että kuluttaa lipun.
  const ohitaSeuraavaTallennus = useRef<Set<string>>(new Set());

  const tallennaKokoelma = async (kokoelma: string, data: any, { allowEmpty = false } = {}) => {
    try {
      const r = await fetch(`/api/data/${kokoelma}${allowEmpty ? '?allowEmpty=1' : ''}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const res = await r.json().catch(() => null);
      if (r.ok && res && res.ok === true) {
        // Onnistunut tallennus kuittaa myös aiemman virheen pois: yhteys toimii taas.
        setSaveError(null);
        return true;
      }
      setSaveError(`Muutosta ei saatu tallennettua palvelimelle (${kokoelma}): ${(res && res.error) || `virhe ${r.status}`}`);
      return false;
    } catch {
      setSaveError(`Muutosta ei saatu tallennettua palvelimelle (${kokoelma}): ei yhteyttä.`);
      return false;
    }
  };

  useEffect(() => {
    if (!eventsLoaded) return;
    tallennaKokoelma('events', events);
  }, [events, eventsLoaded]);

  // Ladataan riskiarvioinnit palvelimelta sivun avautuessa (jaettu kaikkien käyttäjien kesken)
  useEffect(() => {
    fetch('/api/data/riskAssessments', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        // loaded asetetaan true:ksi VAIN onnistuneella vastauksella — ks. events-lohkon
        // kommentti yllä samasta syystä.
        if (res && res.ok === true) {
          if (Array.isArray(res.data)) setRiskAssessments(res.data);
          setRiskAssessmentsLoaded(true);
        }
      })
      .catch(() => {
        // Verkkovirhe: loaded EI asetu true:ksi (ks. yllä) — tallennus ei laukea tyhjällä.
      });
  }, []);

  useEffect(() => {
    if (!riskAssessmentsLoaded) return;
    tallennaKokoelma('riskAssessments', riskAssessments);
  }, [riskAssessments, riskAssessmentsLoaded]);

  // Ladataan sisäänkirjaukset palvelimelta sivun avautuessa (jaettu kaikkien käyttäjien kesken)
  useEffect(() => {
    fetch('/api/data/checkins', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        // loaded asetetaan true:ksi VAIN onnistuneella vastauksella — ks. events-lohkon
        // kommentti yllä samasta syystä.
        if (res && res.ok === true) {
          if (Array.isArray(res.data)) setCheckedInEmployees(res.data);
          setCheckinsLoaded(true);
        }
      })
      .catch(() => {
        // Verkkovirhe: loaded EI asetu true:ksi (ks. yllä) — tallennus ei laukea tyhjällä.
      });
  }, []);

  // Tallennetaan muutokset palvelimelle (ei ensimmäisellä renderillä, ettei alkutila ylikirjoita jo tallennettua dataa)
  useEffect(() => {
    if (!checkinsLoaded) return;
    tallennaKokoelma('checkins', checkedInEmployees);
  }, [checkedInEmployees, checkinsLoaded]);

  // Ladataan työntekijäpankki palvelimelta sivun avautuessa (jaettu kaikkien käyttäjien kesken)
  useEffect(() => {
    fetch('/api/data/employees', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        // loaded asetetaan true:ksi VAIN onnistuneella vastauksella — ks. events-lohkon
        // kommentti yllä samasta syystä.
        if (res && res.ok === true) {
          // Puuttuvat tunnistenumerot täydennetään heti latauksessa; muutos tallentuu
          // takaisin palvelimelle automaattitallennuksen kautta.
          if (Array.isArray(res.data)) setEmployees(taydennaTunnisteet(res.data));
          setEmployeesLoaded(true);
        }
      })
      .catch(() => {
        // Verkkovirhe: loaded EI asetu true:ksi (ks. yllä) — tallennus ei laukea tyhjällä.
      });
  }, []);

  useEffect(() => {
    if (!employeesLoaded) return;
    if (ohitaSeuraavaTallennus.current.delete('employees')) return;
    tallennaKokoelma('employees', employees);
  }, [employees, employeesLoaded]);

  // Tapahtumakohtaiset lomakkeet palvelimelta
  useEffect(() => {
    fetch('/api/data/eventForms', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true) {
          if (Array.isArray(res.data)) setEventForms(res.data);
          setEventFormsLoaded(true);
        }
      })
      .catch(() => { /* loaded ei asetu -> tallennus ei laukea tyhjällä */ });
  }, []);

  useEffect(() => {
    if (!eventFormsLoaded) return;
    if (ohitaSeuraavaTallennus.current.delete('eventForms')) return;
    tallennaKokoelma('eventForms', eventForms);
  }, [eventForms, eventFormsLoaded]);

  // Tapahtuman tiedostot ja jakolinkit
  useEffect(() => {
    fetch('/api/data/eventFiles', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true) {
          if (Array.isArray(res.data)) setEventFiles(res.data);
          setEventFilesLoaded(true);
        }
      })
      .catch(() => { /* loaded ei asetu -> tallennus ei laukea tyhjällä */ });

    fetch('/api/data/fileShares', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true && Array.isArray(res.data)) setFileShares(res.data);
      })
      .catch(() => { /* jakolinkit eivät ole kriittisiä sivun toiminnalle */ });
  }, []);

  useEffect(() => {
    if (!eventFilesLoaded) return;
    if (ohitaSeuraavaTallennus.current.delete('eventFiles')) return;
    tallennaKokoelma('eventFiles', eventFiles);
  }, [eventFiles, eventFilesLoaded]);

  // Jakolinkkejä EI tallenneta automaattisesti: ne luodaan ja peruutetaan omilla
  // reiteillään (/api/shares), koska token ja salasanatiiviste syntyvät palvelimella.
  // Tämä tila on vain palvelimelta luettu näkymä.
  const paivitaJaot = () => {
    fetch('/api/data/fileShares', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => { if (res && res.ok === true && Array.isArray(res.data)) setFileShares(res.data); })
      .catch(() => { /* virhe näkyy tyhjänä listana */ });
    // Hyväksymispyynnöt näkyvät ilmoituskellossa, joten kello päivittyy samalla.
    fetchNotifications();
  };

  // Ladataan kirjaukset/raportit palvelimelta sivun avautuessa (jaettu kaikkien käyttäjien kesken)
  useEffect(() => {
    fetch('/api/data/reports', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        // loaded asetetaan true:ksi VAIN onnistuneella vastauksella — ks. events-lohkon
        // kommentti yllä samasta syystä.
        if (res && res.ok === true) {
          if (Array.isArray(res.data)) setReports(res.data);
          setReportsLoaded(true);
        }
      })
      .catch(() => {
        // Verkkovirhe: loaded EI asetu true:ksi (ks. yllä) — tallennus ei laukea tyhjällä.
      });
  }, []);

  useEffect(() => {
    if (!reportsLoaded) return;
    if (ohitaSeuraavaTallennus.current.delete('reports')) return;
    tallennaKokoelma('reports', reports);
  }, [reports, reportsLoaded]);

  // Ladataan avausvalmius palvelimelta sivun avautuessa (jaettu kaikkien käyttäjien kesken)
  useEffect(() => {
    fetch('/api/data/readiness', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        // loaded asetetaan true:ksi VAIN onnistuneella vastauksella — ks. events-lohkon
        // kommentti yllä samasta syystä.
        if (res && res.ok === true) {
          if (Array.isArray(res.data)) setReadiness(res.data);
          setReadinessLoaded(true);
        }
      })
      .catch(() => {
        // Verkkovirhe: loaded EI asetu true:ksi (ks. yllä) — tallennus ei laukea tyhjällä.
      });
  }, []);

  useEffect(() => {
    if (!readinessLoaded) return;
    tallennaKokoelma('readiness', readiness);
  }, [readiness, readinessLoaded]);

  // Pikatoimintonapit. Tätä kokoelmaa EI tallenneta automaattisesti latauksen jälkeen
  // kuten muita: napit muuttuvat vain asetuseditorissa, ja automaattitallennus kirjoittaisi
  // oletusnapit levylle heti kun kuka tahansa avaa sovelluksen — myös käyttäjä jolla ei ole
  // Sovellusasetusten muokkausoikeutta, jolloin hän näkisi turhan virhebannerin.
  useEffect(() => {
    fetch('/api/data/smsButtons', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true && Array.isArray(res.data)) setSmsButtons(res.data);
      })
      .catch(() => {
        // Verkkovirhe: smsButtons jää null:iksi ja valikko näyttää oletusnapit. Lähetys
        // toimii silti, koska palvelin ratkaisee napin omasta datastaan.
      });
  }, []);

  // Käytössä olevat napit: tallennettu lista tai oletukset jos kokoelmaa ei ole.
  const naytettavatNapit = Array.isArray(smsButtons) ? smsButtons : SMS_OLETUSNAPIT;

  const tallennaNapit = async (uudet: any[]) => {
    setSmsButtons(uudet);
    // Palautusarvo kertoo onnistuiko palvelintallennus (ks. tallennaKokoelma): editori
    // ei saa sulkeutua "valmiina" jos oikeudet eivät riittäneet tai yhteys katkesi.
    return tallennaKokoelma('smsButtons', uudet, { allowEmpty: uudet.length === 0 });
  };

  // Asetusnäkymän nappieditori. Muokataan yksi nappi kerrallaan luonnoksena, jotta
  // keskeneräinen viestipohja ei tallennu levylle (ja siis lähde napista) vahingossa.
  const [smsButtonDraft, setSmsButtonDraft] = useState<any>(null);
  const [smsButtonError, setSmsButtonError] = useState<string | null>(null);

  const avaaNappiMuokkaus = (nappi: any) => {
    setSmsButtonError(null);
    setSmsButtonDraft({
      ...nappi,
      uusi: false,
      // Numerolista muokataan tekstikenttänä (yksi per rivi) — se on kevyempi kuin
      // dynaaminen rivilista eikä numeroita ole yleensä montaa.
      customNumbersText: (nappi.customNumbers || []).join('\n'),
    });
  };

  const avaaUusiNappi = () => {
    setSmsButtonError(null);
    setSmsButtonDraft({
      id: `nappi-${Date.now()}`,
      label: '',
      group: 'checked_in',
      body: '',
      repliable: false,
      style: 'neutral',
      customNumbersText: '',
      uusi: true,
    });
  };

  const tallennaNappiLuonnos = async () => {
    const d = smsButtonDraft;
    if (!d) return;
    if (!d.label.trim()) {
      setSmsButtonError('Napille on annettava nimi.');
      return;
    }
    const tietue = {
      id: d.id,
      label: d.label.trim(),
      group: d.group,
      body: d.body,
      repliable: d.repliable === true,
      style: d.style === 'danger' ? 'danger' : 'neutral',
      customNumbers: d.group === 'custom'
        ? d.customNumbersText.split('\n').map((r: string) => r.trim()).filter(Boolean)
        : [],
    };
    // naytettavatNapit on tässä joko tallennettu lista tai oletukset: jos oletukset
    // ovat vielä käytössä, ensimmäinen tallennus kirjoittaa ne levylle sellaisenaan
    // muokattu nappi mukaan lukien — muuten muut oletusnapit katoaisivat.
    const pohja = naytettavatNapit.map((n) => ({
      id: n.id, label: n.label, group: n.group, body: n.body,
      repliable: n.repliable === true, style: n.style, customNumbers: n.customNumbers || [],
    }));
    const uudet = d.uusi ? [...pohja, tietue] : pohja.map((n) => (n.id === d.id ? tietue : n));
    const onnistui = await tallennaNapit(uudet);
    if (onnistui !== false) setSmsButtonDraft(null);
  };

  const poistaNappi = async (nappi: any) => {
    if (!window.confirm(`Poistetaanko pikatoimintonappi "${nappi.label}"?\n\nPoistoa ei voi perua.`)) return;
    const pohja = naytettavatNapit.map((n) => ({
      id: n.id, label: n.label, group: n.group, body: n.body,
      repliable: n.repliable === true, style: n.style, customNumbers: n.customNumbers || [],
    }));
    await tallennaNapit(pohja.filter((n) => n.id !== nappi.id));
    if (smsButtonDraft?.id === nappi.id) setSmsButtonDraft(null);
  };

  // Integraation tila haetaan vasta kun Pikatoiminnot-valikko avataan — saldokysely on
  // ulkoinen HTTP-kutsu, eikä sitä ole syytä tehdä jokaisella sivunlatauksella.
  // pakota = ohita palvelimen välimuisti ("Tarkista nyt" -painike asetuksissa).
  const haeSmsTila = (pakota = false) => {
    fetch(`/api/sms/status${pakota ? '?pakota=1' : ''}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => { if (res && res.ok === true) setSmsStatus(res); })
      .catch(() => setSmsStatus(null));
  };

  // Lähetyshistoria ja vastaukset. Haetaan aina tuoreena eikä pidetä yllä
  // sivunlatauksesta asti: toimitustilat muuttuvat webhookista taustalla, joten
  // vanhentunut välimuisti näyttäisi viestit ikuisesti "matkalla".
  const haeSmsHistoria = async () => {
    try {
      const [logRes, replyRes] = await Promise.all([
        fetch('/api/data/smsLog', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/data/smsReplies', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (logRes && logRes.ok === true && Array.isArray(logRes.data)) setSmsLog(logRes.data);
      if (replyRes && replyRes.ok === true && Array.isArray(replyRes.data)) setSmsReplies(replyRes.data);
      setSmsLogError(logRes && logRes.ok === true ? null : 'Lähetyshistorian haku epäonnistui.');
    } catch {
      setSmsLogError('Lähetyshistorian haku epäonnistui: ei yhteyttä palvelimeen.');
    }
  };

  // Historianäkymä päivittyy itsestään niin kauan kuin se on auki: toimituskuittaukset
  // saapuvat webhookista sekuntien viiveellä lähetyksen jälkeen, ja juuri niitä
  // katsotaan silloin kun näkymä on auki.
  useEffect(() => {
    if (!viewingSmsLog) return;
    haeSmsHistoria();
    const t = setInterval(haeSmsHistoria, 10000);
    return () => clearInterval(t);
  }, [viewingSmsLog]);

  // Avaa lähetysikkunan: hakee palvelimelta ketkä viestin saisivat ja valmiin
  // viestirungon. Mitään ei lähde ennen kuin käyttäjä vahvistaa erikseen.
  const avaaSmsLahetys = async (nappi: any) => {
    setShowQuickActions(false);
    setSmsModal({ nappi, runko: '', vastaanottajat: [], lataa: true, virhe: null, tulos: null, vahvistus: false });
    try {
      const params = new URLSearchParams({ buttonId: nappi.id, eventId: selectedEvent || '' });
      const r = await fetch(`/api/sms/recipients?${params.toString()}`, { credentials: 'include' });
      const res = await r.json().catch(() => null);
      if (!r.ok || !res || res.ok !== true) {
        setSmsModal((m: any) => (m ? { ...m, lataa: false, virhe: (res && res.error) || `Vastaanottajien haku epäonnistui (${r.status}).` } : m));
        return;
      }
      setSmsModal((m: any) => (m ? { ...m, lataa: false, runko: res.runko || '', vastaanottajat: res.vastaanottajat || [] } : m));
    } catch {
      setSmsModal((m: any) => (m ? { ...m, lataa: false, virhe: 'Vastaanottajien haku epäonnistui: ei yhteyttä palvelimeen.' } : m));
    }
  };

  const lahetaSmsViesti = async () => {
    const nykyinen = smsModal;
    if (!nykyinen) return;
    setSmsModal({ ...nykyinen, lahettaa: true, virhe: null });
    try {
      const r = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ buttonId: nykyinen.nappi.id, eventId: selectedEvent, body: nykyinen.runko }),
      });
      const res = await r.json().catch(() => null);
      if (!r.ok || !res || res.ok !== true) {
        setSmsModal((m: any) => (m ? { ...m, lahettaa: false, vahvistus: false, virhe: (res && res.error) || `Lähetys epäonnistui (${r.status}).` } : m));
        return;
      }
      setSmsModal((m: any) => (m ? { ...m, lahettaa: false, tulos: res } : m));
    } catch {
      setSmsModal((m: any) => (m ? { ...m, lahettaa: false, vahvistus: false, virhe: 'Lähetys epäonnistui: ei yhteyttä palvelimeen.' } : m));
    }
  };

  // Avausvalmiuden lomakeluonnos synkataan tallennetusta tietueesta aina kun tapahtuma
  // vaihtuu tai data saapuu palvelimelta — mutta EI silloin kun `readiness` muuttuu:
  // oma tallennus muuttaa sitä, ja riippuvuutena se nollaisi luonnoksen kesken
  // muokkauksen. Refit pitävät arvot tuoreina ilman riippuvuutta, jolloin
  // riippuvuuslista on myös oikeasti täydellinen eikä kutsu "korjaamaan" itseään.
  const readinessRef = useRef(readiness);
  readinessRef.current = readiness;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    const tallennettu = readinessRef.current.find((r) => (r.eventId || 'fesx') === selectedEvent);
    const lomake = (eventsRef.current.find((e) => e.id === selectedEvent) as any)?.formData || {};
    setReadinessChecks({ ...tyhjatKuittaukset(), ...(tallennettu?.checks || {}) });
    setReadinessComments(tallennettu?.comments || '');
    // Oletus tulee tapahtuman perustiedoista ("Aukioloajat yleisölle = portit auki"),
    // jotta laskuri toimii heti ilman että tavoitetta tarvitsee erikseen asettaa.
    setTargetOpeningDate(tallennettu?.targetDate || lomake.publicStartDate || '');
    setTargetOpeningTime(tallennettu?.targetTime || lomake.publicStartTime || '');
  }, [selectedEvent, readinessLoaded, eventsLoaded]);

  // Vain valitun tapahtuman kirjaukset — vanha data (ilman eventId-kenttää) lasketaan
  // kuuluvaksi FestivaaliX:ään, ettei olemassa oleva data "katoa" siirtymässä.
  const currentEventCheckedIn = checkedInEmployees.filter(
    (e) => (e.eventId || 'fesx') === selectedEvent
  );
  // Kirjautuneen käyttäjän oma rivi tämän tapahtuman työntekijälistassa. Sieltä tulee
  // tapahtumakohtainen nimimerkki ("Ensiapu 1"): sama henkilö voi olla eri tapahtumassa
  // eri roolissa, joten nimimerkki ei voi olla käyttäjätunnuksen ominaisuus.
  // Kirjautunutta käyttäjää vastaava työntekijäpankin tietue. Tarvitaan nimipohjaiseen
  // varalinkitykseen alla.
  const omaTyontekija = employees.find((e) =>
    (session?.employeeId && e.id === session.employeeId) ||
    (session?.displayId && e.displayId === session.displayId)
  );

  const omaRosteriRivi = currentEventCheckedIn.find((e) =>
    (session?.employeeId && e.employeeId === session.employeeId) ||
    (session?.displayId && e.displayId === session.displayId) ||
    // Ennen tätä ominaisuutta lisätyillä rosteririveillä ei ole employeeId- eikä
    // displayId-kenttää, joten ne sovitetaan nimen kautta. Ilman tätä nimimerkki jäisi
    // käyttämättä kaikilla jo tapahtumaan lisätyillä työntekijöillä.
    (omaTyontekija?.name && e.name === omaTyontekija.name)
  );

  // Raporttien "Laatija"-kenttä. Muoto: "<tapahtuman nimimerkki> #<tunnistenumero>",
  // esim. "Ensiapu 1 #1028". Jos käyttäjää ei ole lisätty tämän tapahtuman listaan,
  // käytetään tunnuksen omaa nimimerkkiä — kirjaus ei saa jäädä nimettömäksi.
  const kirjaajanTunniste = (oletus = 'TIKE Päivystäjä') => {
    const nimimerkki = omaRosteriRivi?.nickname?.trim() || sessionNickname || oletus;
    const numero = session?.displayId ?? omaRosteriRivi?.displayId ?? null;
    return numero ? `${nimimerkki} ${muotoileTunniste(numero)}` : nimimerkki;
  };

  // Roskakoriin siirretyt kirjaukset (deletedAt) jätetään kaikkien näkymien ja
  // laskureiden ulkopuolelle — ne näkyvät vain Roskakori-sivulla, josta ne voi
  // palauttaa tai hävittää pysyvästi.
  const currentEventReports = reports.filter(
    (r) => (r.eventId || 'fesx') === selectedEvent && !r.deletedAt
  );
  const currentEventDeletedReports = reports.filter(
    (r) => (r.eventId || 'fesx') === selectedEvent && r.deletedAt
  );
  const currentEventRiskAssessments = riskAssessments.filter(
    (r) => (r.eventId || 'fesx') === selectedEvent
  );

  const formatTime = (date) => {
    return date.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getGreeting = (date) => {
    const hour = date.getHours();
    if (hour >= 5 && hour < 10) return 'Hyvää huomenta';
    if (hour >= 10 && hour < 17) return 'Hyvää päivää';
    if (hour >= 17 && hour < 22) return 'Hyvää iltaa';
    return 'Hyvää yötä';
  };

  // Riskin suuruus: todennäköisyys x seurausten vakavuus, tulos 1-5
  const riskMatrix = [
    [1, 2, 3],
    [2, 3, 4],
    [3, 4, 5]
  ];

  const getRiskScore = (prob, sev) => {
    if (!prob || !sev) return 0;
    return riskMatrix[prob - 1][sev - 1];
  };

  const riskLevels = {
    1: { label: 'Merkityksetön riski', tone: 'emerald', action: 'Toimenpiteitä ei tarvita. Tilannetta seurataan normaalisti.' },
    2: { label: 'Vähäinen riski', tone: 'lime', action: 'Seurataan tilannetta. Harkitaan edullisia parannuksia, jos ne ovat helposti toteutettavissa.' },
    3: { label: 'Kohtalainen riski', tone: 'amber', action: 'Toimenpiteet on suunniteltava ja toteutettava määräajassa. Riskiä pienennetään ennen tapahtuman alkua.' },
    4: { label: 'Merkittävä riski', tone: 'orange', action: 'Toimenpiteet ovat välttämättömiä. Toimintaa ei aloiteta ennen kuin riskiä on pienennetty.' },
    5: { label: 'Sietämätön riski', tone: 'rose', action: 'Toiminta keskeytetään tai sitä ei aloiteta. Riski on poistettava ennen jatkamista.' }
  };

  const riskTones = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', solid: 'bg-emerald-600' },
    lime: { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-700', solid: 'bg-lime-600' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', solid: 'bg-amber-500' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', solid: 'bg-orange-500' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', solid: 'bg-rose-600' }
  };

  const resetRiskForm = () => {
    setRaTarget(''); setRaHazard(''); setRaCategory(''); setRaControls('');
    setRaProb(0); setRaSev(0);
    setRaActions(''); setRaOwner(''); setRaDeadline('');
    setRaResProb(0); setRaResSev(0);
  };

  // HUOM: tunniste ei ole luotettava päivämäärälähde. Se sisältää päivän ja
  // kuukauden, mutta tapahtumakoodi on kovakoodattu "FesX" riippumatta siitä mikä
  // tapahtuma on valittuna. Raportin luontiaika luetaan createdAt-kentästä, joka
  // lisätään jokaiseen uuteen raporttiin (lakisääteisen säilytysajan laskenta).
  // Tunnisteen tapahtumakoodi johdetaan valitun tapahtuman nimestä, ei kiinteästä
  // "FesX"-merkkijonosta. Koodi on raportin virallinen yksilöivä tieto, joten se oli
  // väärä heti toisesta tapahtumasta alkaen. Muoto: ensimmäiset kirjaimet ilman
  // ääkkösiä ja välejä, esim. "FestivaaliX" -> "FesX" (sama kuin ennen FestivaaliX:lle),
  // "Kesäjuhla Ö" -> "KesJ". Fallback estää tyhjän koodin jos nimi on pelkkiä merkkejä.
  const getEventCode = () => {
    // Ääkköset puretaan (Ö -> O) ja muut merkit pudotetaan, jotta koodi kelpaa
    // tiedostonimiin ja viranomaisviitteisiin sellaisenaan.
    const sanat = String(findEventName(selectedEvent, events))
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, ' ')
      .trim().split(/\s+/).filter(Boolean);
    if (sanat.length === 0) return 'TAP';
    const eka = sanat[0];
    // Monisanainen nimi: kolme ensimmäistä kirjainta + seuraavan sanan alkukirjain
    // ("Provinssi 2026" -> "Pro2"). Pelkät alkukirjaimet antaisivat liian lyhyen
    // ja tunnistamattoman koodin ("P2").
    if (sanat.length > 1) return eka.slice(0, 3) + sanat[1][0].toUpperCase();
    // Yhden sanan nimi jonka lopussa on iso kirjain tai numero: se erottaa nimen,
    // joten se otetaan mukaan ("FestivaaliX" -> "FesX", kuten ennenkin).
    const viimeinen = eka.slice(-1);
    if (eka.length > 4 && /[A-Z0-9]/.test(viimeinen)) return eka.slice(0, 3) + viimeinen;
    return eka.slice(0, 4);
  };

  const getDynamicId = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${yy}/${getEventCode()}/${dd}${mm}/${runningNumber}`;
  };

  const getRiskId = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    return `${yy}/${getEventCode()}/RA/${String(riskRunningNumber).padStart(3, '0')}`;
  };

  const handleSaveRiskAssessment = () => {
    if (!raTarget.trim() || !raHazard.trim()) {
      alert('Kirjaa vähintään kohde ja vaaran kuvaus.');
      return;
    }
    const score = getRiskScore(raProb, raSev);
    if (!score) {
      alert('Valitse todennäköisyys ja seurausten vakavuus.');
      return;
    }
    const resScore = getRiskScore(raResProb, raResSev);

    setRiskAssessments(prev => [{
      id: getRiskId(),
      eventId: selectedEvent,
      target: raTarget.trim(),
      category: raCategory,
      hazard: raHazard.trim(),
      controls: raControls.trim(),
      prob: raProb,
      sev: raSev,
      score,
      actions: raActions.trim(),
      owner: raOwner.trim(),
      deadline: raDeadline,
      resProb: raResProb,
      resSev: raResSev,
      resScore,
      author: kirjaajanTunniste(),
      date: new Date().toLocaleDateString('fi-FI'),
      status: 'Toimenpiteet kesken'
    }, ...prev]);

    setRiskRunningNumber(prev => prev + 1);
    resetRiskForm();
    setActiveTab('documents_risk_done');
  };

  // Riskiarvion hyväksyntä. Tila kirjoitettiin aiemmin kiinteästi arvoon
  // "Toimenpiteet kesken" eikä mikään asettanut arvoa "Hyväksytty", joten
  // listanäkymän vihreä tila oli saavuttamaton. Hyväksyntä kirjaa myös kuka
  // hyväksyi ja milloin, koska se on riskiarviossa nimenomaan päätös.
  const handleApproveRiskAssessment = (ra) => {
    setRiskAssessments(prev => prev.map(r => (r === ra
      ? { ...r, status: 'Hyväksytty', approvedBy: sessionNickname || '', approvedAt: new Date().toISOString() }
      : r)));
    setOpenedRiskAssessment(null);
  };

  const handleReopenRiskAssessment = (ra) => {
    setRiskAssessments(prev => prev.map(r => (r === ra
      ? { ...r, status: 'Toimenpiteet kesken', approvedBy: '', approvedAt: '' }
      : r)));
    setOpenedRiskAssessment(null);
  };

  const handleDeleteRiskAssessment = (ra) => {
    const confirmed = window.confirm(
      `Haluatko varmasti poistaa riskiarvion "${ra.target}" (${ra.id})?\n\n` +
      'Poistoa ei voi perua.'
    );
    if (!confirmed) return;
    // Viiteyhtäläisyys (=== ) on turvallisempi kuin id:n vertailu.
    setRiskAssessments(prev => prev.filter(r => r !== ra));
    setOpenedRiskAssessment(null);
  };

  const updEmpForm = (key, value) => setEmpForm(prev => ({ ...prev, [key]: value }));

  const addEmpLanguage = () => setEmpForm(prev => ({ ...prev, languages: [...prev.languages, { language: '', level: 3 }] }));
  const removeEmpLanguage = (idx) => setEmpForm(prev => ({ ...prev, languages: prev.languages.filter((_, i) => i !== idx) }));
  const updEmpLanguage = (idx, key, value) => setEmpForm(prev => ({
    ...prev,
    languages: prev.languages.map((l, i) => (i === idx ? { ...l, [key]: value } : l))
  }));

  const getEmployeeId = () => `emp-${Date.now()}`;

  const handleSaveEmployee = () => {
    if (!empForm.firstName.trim() || !empForm.lastName.trim()) {
      alert('Kirjaa vähintään etunimi ja sukunimi.');
      return;
    }
    const name = buildFullName(empForm);
    if (editingEmp) {
      setEmployees(prev => prev.map(e => (e.id === editingEmp.id
        ? { ...empForm, id: editingEmp.id, name }
        : e)));
    } else {
      // Tunnistenumero annetaan kerran luontihetkellä eikä sitä enää muuteta.
      setEmployees(prev => [
        ...prev,
        { ...empForm, id: getEmployeeId(), name, displayId: seuraavaTunnisteNumero(prev, userAdminList) },
      ]);
    }
    setEditingEmp(null);
    setEmpForm(emptyEmpForm);
    setViewingEmployeeBank('list');
  };

  // ---- Työntekijän käyttäjätunnus ----
  // Tunnus on aina sukunimi_etunimi (ks. kayttajatunnusNimesta) ja tunnistenumero on
  // työntekijän oma pysyvä numero, joten mitään ei kysytä käyttäjältä salasanan lisäksi.
  const empFormUsername = kayttajatunnusNimesta(empForm);
  const empFormExistingUser = userAdminList.find((u) => u.username === empFormUsername) || null;

  const avaaTunnusModaali = () => {
    setEmpUserPassword('');
    setEmpUserPassword2('');
    setEmpUserError('');
    setEmpUserNotice('');
    // Lista haetaan aina tuoreena: se kertoo onko tunnus jo olemassa ja mitkä
    // tunnistenumerot ovat varattuja.
    fetchUserAdminList();
    setEmpUserModalOpen(true);
  };

  const handleCreateEmployeeUser = async () => {
    setEmpUserError('');
    setEmpUserNotice('');
    if (!empFormUsername) {
      setEmpUserError('Täytä ensin etunimi ja sukunimi — käyttäjätunnus muodostetaan niistä.');
      return;
    }
    if (empUserPassword !== empUserPassword2) {
      setEmpUserError('Salasanat eivät täsmää.');
      return;
    }
    if (!isValidPasswordClient(empUserPassword)) {
      setEmpUserError('Salasanan tulee olla vähintään 10 merkkiä ja sisältää iso kirjain, pieni kirjain ja numero.');
      return;
    }
    // Numero on työntekijällä jo (annettu tallennushetkellä tai migraatiossa); jos
    // työntekijää ei ole vielä tallennettu, varataan seuraava vapaa.
    const numero = parseInt(String(empForm.displayId ?? ''), 10) || seuraavaTunnisteNumero(employees, userAdminList);
    setEmpUserSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: empFormUsername,
          // Tunnuksen nimimerkki on henkilön koko nimi. Raporteissa näkyvä nimi on eri
          // asia: se on tapahtumakohtainen nimimerkki + tunnistenumero.
          nickname: buildFullName(empForm) || empFormUsername,
          password: empUserPassword,
          displayId: numero,
          employeeId: editingEmp?.id || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setEmpUserPassword('');
        setEmpUserPassword2('');
        setEmpUserNotice(`Tunnus ${empFormUsername} luotu (${muotoileTunniste(numero)}).`);
        if (!empForm.displayId) updEmpForm('displayId', numero);
        fetchUserAdminList();
      } else {
        setEmpUserError(data.error || 'Tunnuksen luonti epäonnistui.');
      }
    } catch {
      setEmpUserError('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setEmpUserSubmitting(false);
    }
  };

  const handleSetEmployeeUserPassword = async () => {
    setEmpUserError('');
    setEmpUserNotice('');
    if (empUserPassword !== empUserPassword2) {
      setEmpUserError('Salasanat eivät täsmää.');
      return;
    }
    if (!isValidPasswordClient(empUserPassword)) {
      setEmpUserError('Salasanan tulee olla vähintään 10 merkkiä ja sisältää iso kirjain, pieni kirjain ja numero.');
      return;
    }
    setEmpUserSubmitting(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(empFormUsername)}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: empUserPassword }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setEmpUserPassword('');
        setEmpUserPassword2('');
        setEmpUserNotice('Salasana vaihdettu. Käyttäjä on kirjattu ulos ja kirjautuu uudella salasanalla.');
      } else {
        setEmpUserError(data.error || 'Salasanan vaihto epäonnistui.');
      }
    } catch {
      setEmpUserError('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setEmpUserSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (emp) => {
    const confirmed = window.confirm(
      `Haluatko varmasti poistaa työntekijän "${emp.name}" työntekijäpankista?\n\n` +
      'Poistoa ei voi perua. Jo tehdyt sisäänkirjaukset tapahtumiin säilyvät ennallaan.'
    );
    if (!confirmed) return;
    // Viiteyhtäläisyys (=== ) on turvallisempi kuin id:n vertailu.
    const jaljelle = employees.filter(e => e !== emp);
    // VIIMEISEN työntekijän poisto tyhjentää kokoelman, jonka palvelimen romahdussuoja
    // hylkää ilman allowEmpty-lippua (409). Ilman tätä työntekijä katosi näkymästä mutta
    // palasi sivun päivityksellä, koska tallennus ei mennyt koskaan läpi — juuri tämä
    // teki "viimeistä työntekijää ei voi poistaa" -oireen.
    if (jaljelle.length === 0) {
      const ok = await tallennaKokoelma('employees', jaljelle, { allowEmpty: true });
      if (!ok) return; // virhe näkyy bannerissa; tilaa ei muuteta
      ohitaSeuraavaTallennus.current.add('employees');
    }
    setEmployees(jaljelle);
    setEditingEmp(null);
    setEmpForm(emptyEmpForm);
    setViewingEmployeeBank('list');
  };

  const toggleAddEmpSelected = (id) => {
    setAddEmpSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAddSelectedEmployees = () => {
    if (addEmpSelectedIds.length === 0) return;
    // Vain merkitään tapahtumaan (status "pending") — itse sisäänkirjaus tehdään
    // aina erikseen TIKE:n "Työntekijän sisäänkirjaus" -lomakkeella.
    const toAdd = employees.filter(e => addEmpSelectedIds.includes(e.id));
    setCheckedInEmployees(prev => [
      ...prev,
      ...toAdd.map((e, idx) => ({
        id: Date.now() + idx,
        eventId: selectedEvent,
        name: e.name,
        // employeeId ja displayId sitovat rosterirvin työntekijäpankin tietueeseen, jotta
        // kirjautuneen käyttäjän oma nimimerkki löytyy tästä tapahtumasta (kirjaajanTunniste).
        employeeId: e.id,
        displayId: e.displayId ?? null,
        // Tapahtumakohtainen nimimerkki, esim. "Ensiapu 1". Sama henkilö voi olla eri
        // tapahtumassa eri roolissa, joten tätä ei voi sitoa käyttäjätunnukseen.
        nickname: (addEmpNicknames[e.id] || '').trim(),
        role: addEmpRole,
        vest: false,
        badge: '',
        headset: false,
        radio: '',
        comment: '',
        checkInDate: '',
        checkInTime: '',
        checkOutDate: '',
        checkOutTime: '',
        status: 'pending'
      }))
    ]);
    setAddEmpSearch('');
    setAddEmpSelectedIds([]);
    setAddEmpNicknames({});
    setActiveTab('planning_employees');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } finally {
      // Täysi uudelleenlataus palauttaa PasswordGate-komponentin alkutilaan
      // (kirjautumislomake) ilman erillistä sovellustilan nollauslogiikkaa.
      window.location.reload();
    }
  };

  const resetChangePasswordForm = () => {
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setChangePasswordError('');
  };

  const handleChangePassword = async () => {
    setChangePasswordError('');
    if (newPasswordInput !== confirmPasswordInput) {
      setChangePasswordError('Uudet salasanat eivät täsmää.');
      return;
    }
    if (!isValidPasswordClient(newPasswordInput)) {
      setChangePasswordError('Salasanan tulee olla vähintään 10 merkkiä ja sisältää iso kirjain, pieni kirjain ja numero.');
      return;
    }
    setChangePasswordSubmitting(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: currentPasswordInput, newPassword: newPasswordInput }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setShowChangePassword(false);
        resetChangePasswordForm();
        alert('Salasana vaihdettu.');
      } else {
        setChangePasswordError(data.error || 'Salasanan vaihto epäonnistui.');
      }
    } catch {
      setChangePasswordError('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setChangePasswordSubmitting(false);
    }
  };

  const fetchUserAdminList = () => {
    setUserAdminLoading(true);
    setUserAdminError('');
    fetch('/api/users', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setUserAdminList(data.users);
        else setUserAdminError(data.error || 'Käyttäjien haku epäonnistui.');
      })
      .catch(() => setUserAdminError('Yhteysvirhe.'))
      .finally(() => setUserAdminLoading(false));
  };

  const resetNewUserForm = () => {
    setNewUserUsername('');
    setNewUserNickname('');
    setNewUserPassword('');
    setNewUserError('');
  };

  const handleCreateUser = async () => {
    setNewUserError('');
    if (!newUserUsername.trim()) {
      setNewUserError('Käyttäjätunnus vaaditaan.');
      return;
    }
    setNewUserSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: newUserUsername.trim(),
          // Palvelin vaatii nimimerkin. Tätä kautta luodulle tunnukselle sellaista ei
          // enää kysytä, joten se johdetaan tunnuksesta — varsinainen näyttönimi on
          // tapahtumakohtainen nimimerkki (ks. kirjaajanTunniste).
          nickname: newUserNickname.trim() || newUserUsername.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        // Jäädään lomakkeelle näyttämään arvottu salasana: se on ainoa kerta kun sen
        // näkee. Lista aukeaa vasta kun pääkäyttäjä sulkee näkymän itse.
        setUusiSalasanaNaytto({ username: newUserUsername.trim(), password: data.password });
        setNewUserUsername('');
        setNewUserNickname('');
        setNewUserPassword('');
      } else {
        setNewUserError(data.error || 'Käyttäjän luonti epäonnistui.');
      }
    } catch {
      setNewUserError('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setNewUserSubmitting(false);
    }
  };

  const fetchPermTotpInfo = (username) => {
    setPermTotpLoading(true);
    setPermTotpError('');
    fetch(`/api/users/${encodeURIComponent(username)}/totp`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setPermTotpInfo(data);
        else setPermTotpError(data.error || 'Authenticator-tietojen haku epäonnistui.');
      })
      .catch(() => setPermTotpError('Yhteysvirhe.'))
      .finally(() => setPermTotpLoading(false));
  };

  // Yläpalkin "Turvajohto EVENT" vie etusivulle mistä tahansa näkymästä. Kaikki päällä
  // olevat näkymätilat on nollattava yhdessä: ne ovat toisistaan riippumattomia lippuja,
  // ja yksikin päälle jäänyt (esim. viewingSettings) pitäisi käyttäjän edelleen siinä
  // näkymässä vaikka tapahtumavalinta olisi purettu.
  const palaaEtusivulle = () => {
    setSelectedEvent(null);
    setShowEventPicker(false);
    setViewingAllReports(false);
    setViewingArchivedEvents(false);
    setArchivedEventDetailId(null);
    setViewingEmployeeBank(null);
    setViewingUserAdmin(null);
    setEditingPermUser(null);
    setViewingAuditLog(false);
    setViewingSettings(false);
    setViewingSharedWithMe(false);
    setShowQuickActions(false);
    setViewingSmsLog(false);
    setAvattuLahetys(null);
    // Kesken jäänyt tapahtumalomake nollataan samaan tapaan kuin "Takaisin
    // tapahtumavalintaan" -painikkeessa: muuten editingEventId jäisi voimaan ja
    // seuraava "Luo uusi tapahtuma" päivittäisikin vanhaa tapahtumaa.
    setEditingEventId(null);
    setNewEvent(emptyNewEvent);
  };

  const fetchNotifications = () => {
    fetch('/api/notifications', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data && data.ok) setNotifications(data.notifications || []); })
      .catch(() => { /* ilmoitukset eivät ole kriittisiä */ });
  };

  const fetchSharedWithMe = () => {
    setSharedWithMeLoading(true);
    fetch('/api/shares/for-me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data && data.ok) setSharedWithMe(data.shares || []); })
      .catch(() => { /* virhe näkyy tyhjänä listana */ })
      .finally(() => setSharedWithMeLoading(false));
  };

  // Ilmoitukset haetaan kerran sivun avautuessa. Ne päivittyvät myös aina kun
  // jakolinkkejä muutetaan (ks. paivitaJaot).
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Ilmoituksen avaus vie sinne missä asia hoidetaan. Toistaiseksi kaikki ilmoitukset
  // ovat jakolinkkien hyväksymispyyntöjä, jotka käsitellään tapahtuman tiedostosivulla.
  const avaaIlmoitus = (ilm) => {
    if (ilm.tyyppi === 'share_approval') {
      setViewingSettings(false);
      setViewingUserAdmin(null);
      setViewingEmployeeBank(null);
      setViewingAllReports(false);
      setViewingArchivedEvents(false);
      setViewingSharedWithMe(false);
      setShowEventPicker(false);
      if (ilm.eventId) setSelectedEvent(ilm.eventId);
      setActiveTab('eventfiles');
    }
  };

  // Yläpalkin yhteiset propsit kerran. Kaikki 12 kutsupaikkaa saavat samat ilmoitukset,
  // saman profiilin ja samat käsittelijät, joten niiden toistaminen jokaisessa näkymässä
  // olisi juuri sitä toistoa jonka Ylapalkki-komponentti poistaa. Vain alaotsikko ja se,
  // näkyykö kello, vaihtelevat näkymittäin.
  const ylapalkki = (alaotsikko?: string, valinnat: { kello?: boolean; sticky?: boolean } = {}) => (
    <Ylapalkki
      tuoteNimi="Turvajohto EVENT"
      alaotsikko={alaotsikko}
      onLogo={palaaEtusivulle}
      kello={valinnat.kello ? formatTime(currentTime) : undefined}
      sticky={valinnat.sticky}
      ilmoitukset={notifications}
      onIlmoitus={avaaIlmoitus}
      nimimerkki={sessionNickname}
      isAdmin={session?.role === 'admin'}
      onChangePassword={() => setShowChangePassword(true)}
      onViewAuditLog={() => setViewingAuditLog(true)}
      onLogout={handleLogout}
    />
  );

  const fetchRoles = () => {
    setRolesLoading(true);
    fetch('/api/roles', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (data.ok) setRoles(data.roles || []); })
      .catch(() => { /* virhe näkyy tyhjänä listana */ })
      .finally(() => setRolesLoading(false));
  };

  const handleOpenPermissions = (user) => {
    setEditingPermUser(user);
    setPermEventAccess(user.eventAccess || []);
    setPermTuotteet(Array.isArray(user.tuotteet) && user.tuotteet.length > 0 ? user.tuotteet : ['event']);
    setPermNickname(user.nickname || '');
    setPermRoleId(user.roleId || '');
    setUusiSalasanaNaytto(null);
    fetchRoles();
    setPermSaveError('');
    setPermTotpInfo(null);
    setPermTotpError('');
    setPermForceLogoutMessage('');
    setViewingUserAdmin('permissions');
    if (user.role !== 'admin') fetchPermTotpInfo(user.username);
  };

  const handleResetTotp = () => {
    if (!editingPermUser) return;
    const confirmed = window.confirm(
      `Nollataanko "${editingPermUser.nickname}" (${editingPermUser.username}) Authenticator-käyttöönotto?\n\n` +
      'Vanha koodi lakkaa toimimasta heti ja uusi QR-koodi pitää skannata puhelimeen.'
    );
    if (!confirmed) return;
    setPermTotpResetting(true);
    setPermTotpError('');
    fetch(`/api/users/${encodeURIComponent(editingPermUser.username)}/totp/reset`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setPermTotpInfo(data);
        else setPermTotpError(data.error || 'Nollaus epäonnistui.');
      })
      .catch(() => setPermTotpError('Yhteysvirhe.'))
      .finally(() => setPermTotpResetting(false));
  };

  const handleToggleTotpRequired = () => {
    if (!editingPermUser) return;
    const nextRequired = !(permTotpInfo ? permTotpInfo.totpRequired !== false : editingPermUser.totp_required !== false);
    setPermTotpToggling(true);
    setPermTotpError('');
    fetch(`/api/users/${encodeURIComponent(editingPermUser.username)}/totp`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ required: nextRequired }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setPermTotpInfo((prev) => (prev ? { ...prev, totpRequired: data.totpRequired } : prev));
          setEditingPermUser((prev) => (prev ? { ...prev, totp_required: data.totpRequired } : prev));
        } else {
          setPermTotpError(data.error || 'Muutos epäonnistui.');
        }
      })
      .catch(() => setPermTotpError('Yhteysvirhe.'))
      .finally(() => setPermTotpToggling(false));
  };

  const handleForceLogoutUser = () => {
    if (!editingPermUser) return;
    const confirmed = window.confirm(
      `Kirjataanko "${editingPermUser.nickname}" (${editingPermUser.username}) ulos välittömästi?\n\n` +
      'Käyttäjän nykyinen istunto mitätöityy heti, ja hänen täytyy kirjautua uudelleen.'
    );
    if (!confirmed) return;
    setPermForceLogoutSubmitting(true);
    setPermForceLogoutMessage('');
    setPermTotpError('');
    fetch(`/api/users/${encodeURIComponent(editingPermUser.username)}/logout`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setPermForceLogoutMessage('Käyttäjä kirjattu ulos.');
        else setPermTotpError(data.error || 'Uloskirjaus epäonnistui.');
      })
      .catch(() => setPermTotpError('Yhteysvirhe.'))
      .finally(() => setPermForceLogoutSubmitting(false));
  };

  // Tapahtumarajauksen valintaruudun kytkin — sama "lista mukana / pois" -periaate kuin
  // muuallakin sovelluksessa (ks. esim. toggleAddEmpSelected).
  const handleToggleEventAccess = (eventId) => {
    setPermEventAccess((prev) => (
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    ));
  };

  // Tuotepääsyn vaihto. Viimeistä valintaa ei voi poistaa: tyhjä lista lukitsisi käyttäjän
  // ulos molemmilta puolilta, ja palvelin torjuisi tallennuksen joka tapauksessa (PUT
  // /api/users). Parempi estää se tässä kuin näyttää virhe vasta tallennettaessa.
  const vaihdaTuote = (tuote: string) => {
    setPermTuotteet((prev) => {
      if (!prev.includes(tuote)) return [...prev, tuote];
      return prev.length > 1 ? prev.filter((t) => t !== tuote) : prev;
    });
  };

  // Mille puolille käyttäjätaso antaa sivuja. Tuotepääsy (Puolet) on käyttäjäkohtainen ja
  // taso on kaikille yhteinen, joten ne voivat olla ristiriidassa: Vartija-tason käyttäjä
  // jolla on vain EVENT-pääsy näkee tason nimen mutta ei pääse kirjautumaan GUARDiin.
  // Palvelin ei voi päätellä tätä puolestaan — sama taso voi hyvin olla tarkoitettu
  // molemmille puolille — joten ristiriita nostetaan tässä näkyviin.
  const tasonPuolet = (roleId: string): string[] => {
    const bucket = roles.find((r) => r.id === roleId)?.permissions?.[DEFAULT_BUCKET] || {};
    const solmut = Object.keys(bucket).filter((id) => bucket[id]?.view || bucket[id]?.edit);
    if (solmut.includes('*')) return ['event', 'guard'];
    const puolet = [];
    if (solmut.some((id) => !id.startsWith('guard_'))) puolet.push('event');
    if (solmut.some((id) => id.startsWith('guard_'))) puolet.push('guard');
    return puolet;
  };

  const handleSavePermissions = async () => {
    if (!editingPermUser) return;
    setPermSaveError('');
    if (!permNickname.trim()) {
      setPermSaveError('Nimimerkki ei voi olla tyhjä.');
      return;
    }
    setPermSaving(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(editingPermUser.username)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // permissions-kenttää EI enää lähetetä: sivukartta-oikeudet tulevat tasolta
        // (roleId), ei käyttäjätietueesta. Tapahtumarajaus pysyy käyttäjäkohtaisena.
        body: JSON.stringify({
          nickname: permNickname.trim(),
          eventAccess: permEventAccess,
          tuotteet: permTuotteet,
          ...(permRoleId ? { roleId: permRoleId } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setEditingPermUser(null);
        setViewingUserAdmin('list');
      } else {
        setPermSaveError(data.error || 'Tallennus epäonnistui.');
      }
    } catch {
      setPermSaveError('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setPermSaving(false);
    }
  };

  // Pääkäyttäjä nollaa salasanan kun käyttäjä ei muista omaansa. Palvelin arpoo uuden
  // ja pakottaa käyttäjän vaihtamaan sen omakseen heti seuraavalla kirjautumisella.
  const handleResetUserPassword = async () => {
    if (!editingPermUser) return;
    const vahvistus = window.confirm(
      `Nollataanko "${editingPermUser.nickname}" (${editingPermUser.username}) salasana?\n\n` +
      'Palvelin arpoo uuden väliaikaisen salasanan, joka näytetään sinulle kerran. ' +
      'Käyttäjä kirjautuu sillä ja joutuu heti vaihtamaan sen omakseen. ' +
      'Mahdolliset avoimet istunnot katkaistaan.'
    );
    if (!vahvistus) return;
    setPermSaveError('');
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(editingPermUser.username)}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setUusiSalasanaNaytto({ username: editingPermUser.username, password: data.password });
      } else {
        setPermSaveError(data.error || 'Salasanan nollaus epäonnistui.');
      }
    } catch {
      setPermSaveError('Yhteysvirhe. Yritä uudelleen.');
    }
  };

  // ---- Täytettävien lomakkeiden lisäys ja poisto ----
  const LOMAKE_TUNNISTEET = ['Sisäinen', 'Ulkoinen', 'Viranomaislomake', 'Muu'];

  const nollaaLomakeLisays = () => {
    setNewFormName('');
    setNewFormDesc('');
    setNewFormTag('Sisäinen');
    setNewFormTagOther('');
    setShowAddForm(false);
  };

  const lisaaLomake = () => {
    if (!newFormName.trim()) {
      alert('Anna lomakkeelle nimi.');
      return;
    }
    if (newFormTag === 'Muu' && !newFormTagOther.trim()) {
      alert('Kerro mikä tunniste on kyseessä.');
      return;
    }
    setEventForms((prev) => [
      ...prev,
      {
        id: `form-${Date.now()}`,
        eventId: selectedEvent,
        name: newFormName.trim(),
        desc: newFormDesc.trim(),
        tag: newFormTag,
        tagOther: newFormTag === 'Muu' ? newFormTagOther.trim() : '',
        createdBy: sessionNickname || sessionUsername || '',
        createdAt: new Date().toISOString(),
      },
    ]);
    nollaaLomakeLisays();
  };

  const poistaLomake = async (lomake) => {
    if (!window.confirm(`Poistetaanko lomake "${lomake.name}"? Tätä ei voi perua.`)) return;
    const jaljelle = eventForms.filter((f) => f.id !== lomake.id);
    // Viimeisen poisto tyhjentää kokoelman, jonka palvelimen romahdussuoja hylkää
    // ilman allowEmpty-lippua — sama kaava kuin työntekijäpankissa.
    if (jaljelle.length === 0) {
      const ok = await tallennaKokoelma('eventForms', jaljelle, { allowEmpty: true });
      if (!ok) return;
      ohitaSeuraavaTallennus.current.add('eventForms');
    }
    setEventForms(jaljelle);
  };

  // ---- Tapahtuman tiedostot: kansiot, lataus ja poisto ----
  const tapahtumanTiedostot = eventFiles.filter((f) => (f.eventId || 'fesx') === selectedEvent);

  // Murupolku nykyiseen kansioon. Rakennetaan parentId-ketjua ylöspäin ja käännetään.
  const murupolku = (() => {
    const polku = [];
    // HUOM: ei new Map() — lucide-reactista importoitu Map-ikoni varjostaa globaalin
    // Map-konstruktorin tässä tiedostossa. Tavallinen objekti ajaa saman asian.
    const byId = Object.fromEntries(tapahtumanTiedostot.map((f) => [f.id, f]));
    let solmu = currentFolderId ? byId[currentFolderId] : null;
    const nahdyt = new Set();
    while (solmu && !nahdyt.has(solmu.id)) {
      nahdyt.add(solmu.id);
      polku.unshift(solmu);
      solmu = solmu.parentId ? byId[solmu.parentId] : null;
    }
    return polku;
  })();

  // Periytyvä henkilötietolippu: alikansiossa oleva tiedosto on henkilötietoa myös
  // silloin kun lippu on asetettu vain yläkansioon. Sama sääntö kuin palvelimella.
  const onHenkilotietoa = (kohde) => {
    if (!kohde) return false;
    if (kohde.containsPersonalData) return true;
    const byId = Object.fromEntries(tapahtumanTiedostot.map((f) => [f.id, f]));
    let solmu = kohde.parentId ? byId[kohde.parentId] : null;
    const nahdyt = new Set();
    while (solmu && !nahdyt.has(solmu.id)) {
      nahdyt.add(solmu.id);
      if (solmu.containsPersonalData) return true;
      solmu = solmu.parentId ? byId[solmu.parentId] : null;
    }
    return false;
  };

  const luoKansio = () => {
    if (!newFolderName.trim()) return;
    setEventFiles((prev) => [
      ...prev,
      {
        id: `kansio-${Date.now()}`,
        eventId: selectedEvent,
        type: 'folder',
        name: newFolderName.trim(),
        parentId: currentFolderId,
        containsPersonalData: false,
        createdBy: sessionNickname || sessionUsername || '',
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewFolderName('');
  };

  const lataaTiedosto = async (tiedosto) => {
    if (!tiedosto) return;
    setTiedostoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', tiedosto);
      const res = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Tiedoston lähetys epäonnistui.');
        return;
      }
      setEventFiles((prev) => [
        ...prev,
        {
          id: `tiedosto-${Date.now()}`,
          eventId: selectedEvent,
          type: 'file',
          name: tiedosto.name,
          parentId: currentFolderId,
          uploadId: data.id,
          size: tiedosto.size,
          containsPersonalData: false,
          createdBy: sessionNickname || sessionUsername || '',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      alert('Tiedoston lähetys epäonnistui (yhteysvirhe).');
    } finally {
      setTiedostoUploading(false);
      if (tiedostoInputRef.current) tiedostoInputRef.current.value = '';
    }
  };

  // Kansion poisto vie mukanaan koko alipuun — muuten sen sisältö jäisi orvoiksi
  // tietueiksi joihin ei pääse käsiksi mistään.
  const poistaTiedostoTaiKansio = async (kohde) => {
    const alipuu = [kohde.id];
    if (kohde.type === 'folder') {
      let muuttui = true;
      while (muuttui) {
        muuttui = false;
        for (const f of tapahtumanTiedostot) {
          if (!alipuu.includes(f.id) && alipuu.includes(f.parentId)) {
            alipuu.push(f.id);
            muuttui = true;
          }
        }
      }
    }
    const tiedostoja = alipuu.length - (kohde.type === 'folder' ? 1 : 0);
    const varoitus = kohde.type === 'folder' && tiedostoja > 0
      ? `\n\nKansio sisältää ${tiedostoja} kohdetta, jotka poistetaan samalla.`
      : '';
    const jaotKohteille = fileShares.filter((sh) => alipuu.includes(sh.targetId) && !sh.revokedAt);
    const jakoVaroitus = jaotKohteille.length > 0
      ? `\n\nHUOM: kohteella on ${jaotKohteille.length} voimassa olevaa jakolinkkiä, jotka lakkaavat toimimasta.`
      : '';
    if (!window.confirm(`Poistetaanko "${kohde.name}"? Tätä ei voi perua.${varoitus}${jakoVaroitus}`)) return;

    const jaljelle = eventFiles.filter((f) => !alipuu.includes(f.id));
    if (jaljelle.length === 0) {
      const ok = await tallennaKokoelma('eventFiles', jaljelle, { allowEmpty: true });
      if (!ok) return;
      ohitaSeuraavaTallennus.current.add('eventFiles');
    }
    setEventFiles(jaljelle);
  };

  const vaihdaHenkilotietoLippu = (kohde) => {
    setEventFiles((prev) => prev.map((f) => (f.id === kohde.id
      ? { ...f, containsPersonalData: !f.containsPersonalData }
      : f)));
  };

  // ---- Jakaminen ----
  const VOIMASSA_VAIHTOEHDOT = [
    { arvo: '0.5', label: '12 h', tunnit: 12 },
    { arvo: '2', label: '48 h', tunnit: 48 },
    { arvo: '7', label: '7 vrk', tunnit: 24 * 7 },
    { arvo: '30', label: '30 vrk', tunnit: 24 * 30 },
    { arvo: '65', label: '65 vrk', tunnit: 24 * 65 },
  ];

  const avaaJakoDialogi = (kohde) => {
    setShareTarget(kohde);
    // Henkilötietoa sisältävää ei voi jakaa pelkällä linkillä, joten oletus on salasana.
    setShareMode(onHenkilotietoa(kohde) ? 'password' : 'link');
    setSharePassword('');
    setShareUsers([]);
    setShareVoimassa('7');
    setShareOmaPvm('');
    setShareOmaKlo('12:00');
    setShareMaxDownloads('');
    setShareError('');
    setLuotuLinkki(null);
    if (userAdminList.length === 0) fetchUserAdminList();
  };

  const luoJako = async () => {
    if (!shareTarget) return;
    setShareError('');
    let expiresAt = null;
    let ikuinen = false;
    if (shareMode !== 'users') {
      if (shareVoimassa === 'ikuinen') {
        ikuinen = true;
      } else if (shareVoimassa === 'oma') {
        if (!shareOmaPvm) {
          setShareError('Valitse päivämäärä.');
          return;
        }
        expiresAt = new Date(`${shareOmaPvm}T${shareOmaKlo || '12:00'}`).toISOString();
      } else {
        const valinta = VOIMASSA_VAIHTOEHDOT.find((v) => v.arvo === shareVoimassa);
        expiresAt = new Date(Date.now() + (valinta?.tunnit || 168) * 3600 * 1000).toISOString();
      }
    }
    setShareSubmitting(true);
    try {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetId: shareTarget.id,
          mode: shareMode,
          password: shareMode === 'password' ? sharePassword : undefined,
          allowedUsernames: shareMode === 'users' ? shareUsers : undefined,
          expiresAt,
          ikuinen,
          maxDownloads: shareMaxDownloads ? Number(shareMaxDownloads) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        paivitaJaot();
        if (data.token) {
          setLuotuLinkki({
            url: `${window.location.origin}${import.meta.env.BASE_URL}jako.html#${data.token}`,
            approvalStatus: data.share.approvalStatus,
          });
        } else {
          setLuotuLinkki({ url: null, approvalStatus: 'none' });
        }
      } else {
        setShareError(data.error || 'Jakolinkin luonti epäonnistui.');
      }
    } catch {
      setShareError('Yhteysvirhe. Yritä uudelleen.');
    } finally {
      setShareSubmitting(false);
    }
  };

  const peruutaJako = async (share) => {
    if (!window.confirm('Peruutetaanko jakolinkki? Se lakkaa toimimasta heti.')) return;
    try {
      const res = await fetch(`/api/shares/${encodeURIComponent(share.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.ok) paivitaJaot();
      else alert(data.error || 'Peruutus epäonnistui.');
    } catch {
      alert('Peruutus epäonnistui (yhteysvirhe).');
    }
  };

  const hyvaksyJako = async (share, hyvaksy) => {
    try {
      const res = await fetch(`/api/shares/${encodeURIComponent(share.id)}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approve: hyvaksy }),
      });
      const data = await res.json();
      if (res.ok && data.ok) paivitaJaot();
      else alert(data.error || 'Toiminto epäonnistui.');
    } catch {
      alert('Toiminto epäonnistui (yhteysvirhe).');
    }
  };

  const naytaJakoLinkki = async (share) => {
    try {
      const res = await fetch(`/api/shares/${encodeURIComponent(share.id)}/token`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.ok && data.token) {
        setLuotuLinkki({
          url: `${window.location.origin}${import.meta.env.BASE_URL}jako.html#${data.token}`,
          approvalStatus: share.approvalStatus,
        });
        setShareTarget(tapahtumanTiedostot.find((f) => f.id === share.targetId) || null);
      } else {
        alert(data.error || 'Linkin haku epäonnistui.');
      }
    } catch {
      alert('Linkin haku epäonnistui (yhteysvirhe).');
    }
  };

  const handleTamaPvm = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setEventDate(now.toISOString().split('T')[0]);
    if (timeInputRef.current) {
      timeInputRef.current.focus();
    }
  };

  const handleNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setEventDate(d);
    setEventTimeStr(t);
  };

  const handleCheckInNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setCheckInDate(d);
    setCheckInTime(t);
  };

  const resetCheckInForm = () => {
    setSelectedEmp('');
    setEmpSearch('');
    setCheckInDate('');
    setCheckInTime('');
    setCheckInRole('Järjestyksenvalvoja');
    setCheckInNickname('');
    setCheckInVest(false);
    setCheckInBadge('');
    setCheckInHeadset(false);
    setCheckInRadio('');
    setCheckInComment('');
    setEditingCheckIn(null);
  };

  const formatFiDate = (isoDate) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${Number(d)}.${Number(m)}.${y}`;
  };

  const slugify = (text) =>
    (text || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // poistaa aksentit yhdistelmämerkeistä
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const handleSaveEvent = () => {
    if (!newEvent.eventName.trim()) {
      alert('Anna tapahtumalle nimi ennen tallennusta.');
      return;
    }

    const dates = newEvent.publicStartDate
      ? newEvent.publicEndDate && newEvent.publicEndDate !== newEvent.publicStartDate
        ? `${formatFiDate(newEvent.publicStartDate)}–${formatFiDate(newEvent.publicEndDate)}`
        : formatFiDate(newEvent.publicStartDate)
      : 'Ei vahvistettu';

    const commonFields = {
      name: newEvent.eventName.trim(),
      dates,
      place: newEvent.address.trim() || 'Ei vahvistettu',
      audience: newEvent.audienceCount ? `${newEvent.audienceCount} hlö` : 'Arvio puuttuu',
      client: newEvent.clientName.trim() || 'Ei tiedossa',
      formData: newEvent
    };

    if (editingEventId) {
      // Muokkaus: säilytetään sama id (raportit/kirjaukset viittaavat siihen) ja
      // olemassa oleva tila (status/statusTone/accent) — vain kuvailevat kentät päivittyvät.
      setEvents(prev => prev.map(e => (e.id === editingEventId ? { ...e, ...commonFields } : e)));
      setNewEvent(emptyNewEvent);
      const targetId = editingEventId;
      setEditingEventId(null);
      setSelectedEvent(targetId);
      setActiveTab(oletusValilehti(targetId));
      return;
    }

    const slug = slugify(newEvent.eventName) || 'tapahtuma';
    const existingIds = new Set(events.map(e => e.id));
    let id = slug;
    let n = 2;
    while (existingIds.has(id)) {
      id = `${slug}-${n}`;
      n += 1;
    }

    const newEventCard = {
      id,
      status: 'Suunnittelu',
      statusTone: 'bg-slate-200 text-slate-700',
      accent: 'border-slate-200 hover:border-indigo-400',
      ...commonFields
    };

    setEvents(prev => [...prev, newEventCard]);
    setNewEvent(emptyNewEvent);
    setSelectedEvent(id);
    setActiveTab(oletusValilehti(id));
  };

  const handleStartEditEvent = (id) => {
    const ev = events.find(e => e.id === id);
    setEditingEventId(id);
    // Esitäytetään lomake tapahtuman aiemmilla tiedoilla, jotta vain tarvittavat
    // kohdat pitää muuttaa. emptyNewEvent-pohjalla varmistetaan, ettei puutu kenttiä
    // jos tapahtuma on tallennettu ennen jotain myöhemmin lisättyä lomakekenttää.
    setNewEvent({ ...emptyNewEvent, ...(ev?.formData || {}) });
    setSelectedEvent('new');
  };

  const handleDeleteEvent = (ev) => {
    const confirmed = window.confirm(
      `Haluatko varmasti poistaa tapahtuman "${ev.name}"?\n\n` +
      'Tapahtuma piilotetaan tapahtumavalinnasta, mutta sen raportit ja kirjaukset ' +
      'säilyvät tallessa ja löytyvät jatkossa "Tallennetut tapahtumat" -näkymästä.'
    );
    if (!confirmed) return;
    setEvents(prev => prev.map(e => (e.id === ev.id ? { ...e, archived: true, archivedAt: new Date().toISOString() } : e)));
  };

  // Arkistoidun tapahtuman PYSYVÄ poisto: poistaa tapahtuman ja kaiken siihen
  // liittyvän datan. handleDeleteEvent yllä vain arkistoi (archived: true) — tämä on
  // se lopullinen poisto, jota ei voi perua.
  //
  // Vain adminille: poisto koskee neljää eri kokoelmaa, joista jokainen tarkistetaan
  // palvelimella erikseen omilla sivukartta-solmuillaan (ks. server/permissions.js).
  // Jos käyttäjällä olisi oikeus vain osaan niistä, poisto onnistuisi osittain ja
  // jättäisi tapahtuman datan orvoksi levylle. Admin ohittaa per-tietue-tarkistukset,
  // joten lopputulos on aina eheä. Poistot kirjautuvat audit-lokiin normaalisti,
  // koska ne kulkevat samojen PUT-reittien kautta kuin muut muutokset.
  const handlePermanentDeleteEvent = async (ev: any) => {
    const kuuluuTapahtumaan = (x: any) => (x.eventId || 'fesx') === ev.id;
    const poistettavatRaportit = reports.filter(kuuluuTapahtumaan);
    const poistettavatKirjaukset = checkedInEmployees.filter(kuuluuTapahtumaan);
    const poistettavatRiskit = riskAssessments.filter(kuuluuTapahtumaan);
    const rivi = String.fromCharCode(10);
    const luoti = String.fromCharCode(8226);
    const vahvistus = window.prompt(
      [
        `POISTETAAN PYSYVÄSTI: "${ev.name}"`,
        '',
        'Poistetaan lopullisesti:',
        `${luoti} tapahtuma ja sen lomaketiedot`,
        `${luoti} ${poistettavatRaportit.length} raporttia ja tapahtumailmoitusta`,
        `${luoti} ${poistettavatKirjaukset.length} työntekijäkirjausta`,
        `${luoti} ${poistettavatRiskit.length} riskiarviota`,
        '',
        'Poistoa EI voi perua. Huomioi että tapahtumailmoituksilla ja voimankäyttö-',
        'raporteilla on lakisääteinen säilytysaika.',
        '',
        'Vahvista kirjoittamalla tapahtuman nimi täsmälleen:',
      ].join(rivi)
    );
    if (vahvistus === null) return;
    if (vahvistus.trim() !== ev.name) {
      alert('Nimi ei täsmää — mitään ei poistettu.');
      return;
    }

    // Poisto tehdään nimenomaisilla PUT-kutsuilla eikä jätetä tilamuutosten
    // automaattitallennuksen varaan. Automaattitallennus on "fire and forget"
    // (tyhjä .catch), joten epäonnistunut poisto näyttäisi käyttöliittymässä
    // täysin onnistuneelta. Lakisääteisen hävittämisen kohdalla se ei riitä:
    // käyttäjän on saatava tietää onnistuiko poisto oikeasti.
    //
    // allowEmpty=1 kertoo palvelimelle että tyhjentäminen on tarkoituksellista —
    // ilman sitä romahdussuoja hylkäisi viimeisen tapahtuman poiston 409:llä
    // (ks. server/index.js).
    // Käytetään yhteistä tallennusapufunktiota allowEmpty-lipulla: se tarkistaa
    // vastauksen ja nostaa virheen myös näkyvään banneriin.
    const tallenna = (kokoelma: string, data: any[]) => tallennaKokoelma(kokoelma, data, { allowEmpty: true });

    const jaljelle = {
      reports: reports.filter(r => !kuuluuTapahtumaan(r)),
      checkins: checkedInEmployees.filter(e => !kuuluuTapahtumaan(e)),
      riskAssessments: riskAssessments.filter(r => !kuuluuTapahtumaan(r)),
      events: events.filter(e => e.id !== ev.id),
    };

    // Tapahtuma poistetaan VASTA viimeisenä: jos jokin sen datasta jää poistumatta,
    // data ei jää orvoksi tapahtumaan jota ei enää ole.
    const vaiheet: [string, any[], () => void][] = [
      ['reports', jaljelle.reports, () => setReports(jaljelle.reports)],
      ['checkins', jaljelle.checkins, () => setCheckedInEmployees(jaljelle.checkins)],
      ['riskAssessments', jaljelle.riskAssessments, () => setRiskAssessments(jaljelle.riskAssessments)],
      ['events', jaljelle.events, () => setEvents(jaljelle.events)],
    ];

    const onnistuneet: string[] = [];
    for (const [kokoelma, data, paivitaTila] of vaiheet) {
      const ok = await tallenna(kokoelma, data);
      if (!ok) {
        alert(
          [
            'POISTO KESKEYTYI.',
            '',
            onnistuneet.length > 0
              ? `Palvelimelta poistettiin: ${onnistuneet.join(', ')}.`
              : 'Palvelimelta ei poistettu mitään.',
            `Kohta "${kokoelma}" epäonnistui, eikä poistoa jatkettu siitä eteenpäin.`,
            '',
            'Lataa sivu uudelleen nähdäksesi todellisen tilanteen ja yritä sitten uudelleen.',
          ].join(rivi)
        );
        return;
      }
      onnistuneet.push(kokoelma);
      paivitaTila();
    }

    setArchivedEventDetailId(null);
    alert(
      [
        `Tapahtuma "${ev.name}" poistettiin pysyvästi.`,
        '',
        `Poistettiin ${poistettavatRaportit.length} raporttia, ${poistettavatKirjaukset.length} kirjausta ja ${poistettavatRiskit.length} riskiarviota.`,
        'Poisto varmistettiin palvelimelta ja raporttien liitetiedostot poistettiin levyltä.',
        '',
        'Huom: poistettu data säilyy vielä levyn varmuuskopioissa niiden säilytysajan (7 vrk) verran.',
      ].join(rivi)
    );
  };
  // Kokoaa raportista tulostettavan dokumentin ja avaa sen omaan ikkunaansa.
  // tulosta=true vie suoraan selaimen tulostusikkunaan, josta PDF tallennetaan.
  // Peitetyt kentät (henkilötunnus, osoite) tulostuvat kokonaisina: tuloste on
  // se virallinen asiakirja joka toimitetaan viranomaiselle tai toimeksiantajalle,
  // ja peittäminen on vain näyttötason suoja selailua varten (ks. REPORT_DETAIL_FIELDS).
  const avaaRaporttiPdf = (report: any, tulosta: boolean) => {
    const naytetaan = (kentta: { key: string; bool?: boolean }) => {
      const arvo = report[kentta.key];
      if (kentta.bool) return !!arvo;
      return arvo !== undefined && arvo !== null && String(arvo).trim() !== '' && String(arvo) !== '0';
    };

    const kentat = [];
    if (report.summary) kentat.push({ otsikko: 'Kuvaus', arvo: String(report.summary) });
    for (const kentta of REPORT_DETAIL_FIELDS) {
      // date ja time näkyvät jo yläosan metatiedoissa, ei toisteta niitä.
      if (kentta.key === 'date' || !naytetaan(kentta)) continue;
      const arvo = kentta.bool
        ? 'Kyllä'
        : kentta.muotoile
          ? kentta.muotoile(report[kentta.key])
          : String(report[kentta.key]);
      kentat.push({ otsikko: kentta.label, arvo });
    }
    if (report.attachment?.name) {
      kentat.push({ otsikko: 'Liite', arvo: `${report.attachment.name} (ei sisälly tähän tulosteeseen)` });
    }

    // Korjausmerkinnät tulostuvat alkuperäisen rinnalle: lukitun kirjauksen korjaus ei
    // ole ylikirjoitus, joten tulosteesta on näyttävä sekä alkuperäinen tieto että se
    // mitä siitä on myöhemmin korjattu.
    for (const merkinta of Array.isArray(report.corrections) ? report.corrections : []) {
      const aika = merkinta?.at ? new Date(merkinta.at).toLocaleString('fi-FI') : '';
      kentat.push({
        otsikko: `Korjausmerkintä${aika ? ` ${aika}` : ''}${merkinta?.by ? ` · ${merkinta.by}` : ''}`,
        arvo: String(merkinta?.text || ''),
      });
    }

    // Alatunniste: millä lomakepohjalla ja minkä pohjaversion mukaan kirjaus on tehty.
    // Vanhoilta kirjauksilta formCode puuttuu, jolloin tunnus johdetaan rekisteristä
    // tyypin perusteella — mutta pohjaversiota EI arvata, koska tietue ei kerro sitä.
    const lomake = report.formCode
      ? { koodi: report.formCode, lakiviite: lomakeRaportille(report.typeId)?.lakiviite ?? null }
      : lomakeRaportille(report.typeId);
    const alatunnisteOsat = [];
    if (lomake?.koodi) {
      alatunnisteOsat.push(
        lomakeTunnus(lomake.koodi, '01') + (report.formVersion ? ` v${report.formVersion}` : '')
      );
    }
    if (lomake?.lakiviite) alatunnisteOsat.push(lomake.lakiviite);
    // V7: pohja on johdettu säädöksestä, ei viranomaisen vahvistama. Merkintä kuuluu
    // näkyviin juuri siihen paperiin jota viranomaiselle näytetään.
    if (lomake?.lakiviite) alatunnisteOsat.push('Pohja johdettu säädöksestä, ei viranomaisen vahvistama lomake');

    const luotu = new Date().toLocaleString('fi-FI');
    const html = tulostusDokumentti({
      otsikko: report.type || 'Raportti',
      tunniste: report.id,
      alatunniste: alatunnisteOsat.join(' · ') || undefined,
      meta: [
        { otsikko: 'Tapahtuma', arvo: findEventName(report.eventId, events) },
        { otsikko: 'Laatija', arvo: report.author },
        { otsikko: 'Päivämäärä', arvo: report.date ? formatFiDate(report.date) : '' },
        { otsikko: 'Kellonaika', arvo: report.time },
        ...(raportinVyohyke(report) ? [{ otsikko: 'Vyöhyke', arvo: raportinVyohyke(report) }] : []),
      ],
      kentat,
      huomio:
        '<strong>Sisältää henkilötietoja.</strong> Käsittele ja jaa vain toimeksiannon ' +
        'edellyttämässä laajuudessa. Turvallisuusalan kirjauksilla on lakisääteinen ' +
        'säilytysaika.<br>Tuloste luotu ' + htmlTeksti(luotu) + ' — ' + htmlTeksti(sessionNickname || '') + '.',
    });
    if (tulosta) tulostaDokumentti(html);
    else setPdfEsikatselu({ otsikko: `${report.type || 'Raportti'} — ${report.id}`, html });
  };

  // Kuittaa tehtävän tehdyksi. Kirjaus itse EI katoa minnekään: se jää
  // tallennettuihin raportteihin kuten ennenkin, ja kuittaus näkyy siellä omana
  // kenttänään. Vain Tilannekuvan Tehtävät-lista suodattaa kuitatut pois, koska
  // se on lista avoimista tehtävistä.
  // Lähettää pohjakartan ja tallentaa sen viitteen tapahtuman tietoihin. Kartta on
  // ainoa liite jolla ei ole omistavaa raporttia, joten palvelin tunnistaa sen
  // erikseen sekä lukuoikeudessa että roskienkeruussa (ks. server/permissions.js
  // canReadAttachment ja server/index.js liitesiivous).
  const tallennaPohjakartta = async (tiedosto?: File) => {
    if (!tiedosto) return;
    setKarttaUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', tiedosto);
      const res = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || 'Kartan lähetys epäonnistui.');
        return;
      }
      setEvents(prev => prev.map(e => (e.id === selectedEvent
        ? { ...e, formData: { ...((e as any).formData || {}), mapUploadId: data.id, mapUploadName: tiedosto.name } }
        : e)));
    } catch {
      alert('Kartan lähetys epäonnistui (yhteysvirhe).');
    } finally {
      setKarttaUploading(false);
    }
  };

  const handleCompleteTask = () => {
    const report = completingTask;
    if (!report) return;
    const kuitattu = {
      taskDoneAt: new Date().toISOString(),
      taskDoneBy: sessionNickname || '',
      taskDoneComment: completingTaskComment.trim(),
    };
    // Viiteyhtäläisyys (===) eikä id:n vertailu — raporttien tunnisteet eivät ole
    // taatusti uniikkeja tapahtumien välillä (sama peruste kuin handleDeleteReportissa).
    setReports(prev => prev.map(r => (r === report ? { ...r, ...kuitattu } : r)));
    setCompletingTask(null);
    setCompletingTaskComment('');
  };

  // Poisto siirtää kirjauksen roskakoriin eikä hävitä sitä. Näkymä lupasi tämän jo
  // ennestään ("Kirjauksia ei poisteta lopullisesti ennen säilytysajan päättymistä"),
  // mutta toteutus poisti tietueen heti — lupaus oli siis paikkansapitämätön.
  const handleDeleteReport = (report) => {
    const confirmed = window.confirm(
      `Siirretäänkö raportti "${report.type}" (${report.id}) roskakoriin?\n\n` +
      'Kirjaus säilyy roskakorissa, josta sen voi palauttaa tai hävittää pysyvästi.'
    );
    if (!confirmed) return;
    // Viiteyhtäläisyys (=== ) on turvallisempi kuin id:n vertailu, koska raporttien
    // tunnisteet eivät ole taatusti uniikkeja tapahtumien välillä.
    setReports(prev => prev.map(r => (r === report
      ? { ...r, deletedAt: new Date().toISOString(), deletedBy: sessionNickname || '' }
      : r)));
    setOpenedReport(null);
  };

  // Vyöhykkeet ovat tapahtuman kenttä (päätös V5), joten ne tallentuvat samalla
  // events-kokoelman tallennuksella kuin muutkin tapahtuman tiedot.
  const nykyisenTapahtumanVyohykkeet = haeVyohykkeet(events.find((e) => e.id === selectedEvent));
  const nykyisenTapahtumanKartta =
    (events.find((e) => e.id === selectedEvent) as any)?.formData?.mapUploadId || null;

  // Kirjauksen vyöhyke haetaan SEN tapahtuman vyöhykkeistä johon kirjaus kuuluu, ei
  // valitun tapahtuman: "Tallennetut raportit (kaikki tapahtumat)" näyttää useamman
  // tapahtuman kirjauksia kerralla, ja väärän tapahtuman vyöhykenimi olisi väärä tieto.
  const raportinVyohyke = (report: any) =>
    vyohykkeenNimi(haeVyohykkeet(events.find((e) => e.id === (report?.eventId || 'fesx'))), report?.zoneId);

  const tallennaVyohykkeet = (zones: any[]) => {
    setEvents(prev => prev.map(e => (e.id === selectedEvent ? { ...e, zones } : e)));
  };

  const lisaaVyohyke = () => {
    if (piirrettava.length < VYOHYKKEEN_MIN_PISTEET) return;
    const nimi = uusiVyohykeNimi.trim();
    if (!nimi) {
      alert('Anna vyöhykkeelle nimi. Nimetön alue kartalla ei kerro kenellekään mitään.');
      return;
    }
    tallennaVyohykkeet([
      ...nykyisenTapahtumanVyohykkeet,
      { id: uusiVyohykeId(), nimi, vari: uusiVyohykeVari, pisteet: piirrettava },
    ]);
    setPiirrettava([]);
    setUusiVyohykeNimi('');
  };

  // Vyöhykkeen poisto ei poista sitä kirjauksista jotka viittaavat siihen: kirjaus
  // kertoo missä jotain tapahtui, ja se tieto ei muutu vääräksi siksi että alue
  // poistettiin kartalta jälkikäteen. Poistetun vyöhykkeen tunnus näkyy kirjauksessa
  // tyhjänä, ei virheenä.
  const poistaVyohyke = (id: string) => {
    const kohde = nykyisenTapahtumanVyohykkeet.find((v) => v.id === id);
    if (!window.confirm(`Poistetaanko vyöhyke "${kohde?.nimi || id}" kartalta?`)) return;
    tallennaVyohykkeet(nykyisenTapahtumanVyohykkeet.filter((v) => v.id !== id));
  };

  // Erässä 1 lisätyt kentät uudelle kirjaukselle, yhdestä paikasta. Ilman tätä jokainen
  // kuudesta tallennuskäsittelijästä toistaisi saman listan ja yksi niistä jäisi
  // ennemmin tai myöhemmin päivittämättä.
  //
  // Lomaketunnus luetaan rekisteristä (shared/lomakerekisteri.ts) eikä kirjoiteta tähän
  // käsin — se on koko rekisterin olemassaolon syy. Pohjaversio tallennetaan tietueeseen
  // sellaisena kuin se on NYT: kun pohjaa myöhemmin muutetaan, vanha kirjaus kertoo yhä
  // millä versiolla se tehtiin.
  const uudenKirjauksenKentat = (typeId: string) => {
    const lomake = lomakeRaportille(typeId);
    return {
      formCode: lomake?.koodi ?? null,
      formVersion: lomake?.pohjaVersio ?? null,
      // Tila vain poikkeamille: sisäänkirjausta tai sääraporttia ei käsitellä.
      status: onPoikkeama({ typeId }) ? 'open' : null,
      severity: null,
      // Sijainti luetaan lomakkeen yhteisestä tilasta, jolloin jokainen kuudesta
      // tallennuskäsittelijästä saa sen ilman omaa riviään.
      zoneId: kirjausVyohyke || null,
      assignedTo: null,
      closedAt: null,
      closedBy: null,
      attachments: [],
      // GPS täytetään vasta erässä 3; kuvakoordinaatti tulee kartalta osoittamalla.
      location: { img: kirjausPiste, gps: null },
      policeDeliveredAt: null,
      policeStation: null,
      corrections: [],
    };
  };

  // Tilan vaihto ja korjausmerkintä ovat ainoat muutokset jotka lukittuun kirjaukseen
  // voi tehdä (ks. shared/kirjaukset.ts ja server/kirjaukset.js). Molemmat päivittävät
  // myös avatun kirjauksen, jotta modaali näyttää muutoksen heti eikä vasta uudelleen
  // avattaessa. Viiteyhtäläisyys kuten handleDeleteReportissa: raporttien tunnisteet
  // eivät ole taatusti uniikkeja tapahtumien välillä.
  const paivitaKirjaus = (report: any, muutos: any) => {
    const paivitetty = { ...report, ...muutos };
    setReports(prev => prev.map(r => (r === report ? paivitetty : r)));
    setOpenedReport(paivitetty);
  };

  // Sama oikeus kuin poistopainikkeella: kirjauksen käsittely (tila, korjausmerkintä)
  // kuuluu sille joka saa muokata sitä näkymää josta kirjaus avattiin.
  const saaKasitellaKirjauksen = isAdminUser || canEdit(perms, selectedEvent, openedReportSource || 'overview');

  const handleSetReportStatus = (report: any, status: string) => {
    if (report.status === status) return;
    // Sulkeminen kirjaa kuka sulki ja milloin; muu tilanvaihto tyhjentää ne, jottei
    // uudelleen avattuun kirjaukseen jää merkintää sulkijasta joka ei enää pidä
    // paikkaansa.
    paivitaKirjaus(report, status === 'closed'
      ? { status, closedAt: new Date().toISOString(), closedBy: sessionNickname || '' }
      : { status, closedAt: null, closedBy: null });
  };

  // Vakavuus on sama 1–5 asteikko kuin riskiarvioinnissa (ks. shared/kirjaukset.ts).
  // Saman arvon painaminen uudelleen poistaa luokituksen: väärin annettua vakavuutta
  // ei saisi muuten pois muuten kuin arvaamalla jokin toinen.
  const handleSetReportSeverity = (report: any, severity: number) => {
    paivitaKirjaus(report, { severity: report.severity === severity ? null : severity });
  };

  const handleAddCorrection = (report: any) => {
    const teksti = korjausTeksti.trim();
    if (!teksti) return;
    const merkinnat = Array.isArray(report.corrections) ? report.corrections : [];
    paivitaKirjaus(report, {
      corrections: [...merkinnat, uusiKorjausmerkinta(teksti, sessionNickname || '')],
    });
    setKorjausTeksti('');
  };

  const handleRestoreReport = (report) => {
    setReports(prev => prev.map(r => {
      if (r !== report) return r;
      // Kentät irrotetaan pois tietueesta; alaviiva kertoo ettei arvoja käytetä.
      const { deletedAt: _deletedAt, deletedBy: _deletedBy, ...palautettu } = r;
      return palautettu;
    }));
  };

  // Pysyvä hävitys roskakorista. Vain adminille, kuten muutkin peruuttamattomat
  // poistot (vrt. handlePermanentDeleteEvent ja vanhentuneiden ilmoitusten hävitys).
  // Tallennus tehdään nimenomaisella kutsulla, jotta epäonnistuminen näkyy: pelkkä
  // automaattitallennus on "fire and forget" eikä kertoisi lakisääteisen hävittämisen
  // epäonnistuneen.
  const handlePurgeReports = async (poistettavat: any[]) => {
    if (poistettavat.length === 0) return;
    const rivi = String.fromCharCode(10);
    const vahvistus = window.prompt(
      [
        `HÄVITETÄÄN ${poistettavat.length} kirjausta pysyvästi.`,
        '',
        'Poistoa ei voi perua, ja myös liitetiedostot poistetaan.',
        'Huomioi että tapahtumailmoituksilla on lakisääteinen säilytysaika.',
        '',
        'Vahvista kirjoittamalla: HÄVITÄ',
      ].join(rivi)
    );
    if (vahvistus === null) return;
    if (vahvistus.trim().toUpperCase() !== 'HÄVITÄ') {
      alert('Vahvistus ei täsmää — mitään ei poistettu.');
      return;
    }
    const poistettavatJoukko = new Set(poistettavat);
    const jaljelle = reports.filter(r => !poistettavatJoukko.has(r));
    const ok = await tallennaKokoelma('reports', jaljelle, { allowEmpty: true });
    if (!ok) return; // virhe näkyy bannerissa; tilaa ei muuteta
    if (jaljelle.length === 0) ohitaSeuraavaTallennus.current.add('reports');
    setReports(jaljelle);
    alert(`${poistettavat.length} kirjausta hävitettiin pysyvästi.`);
  };

  const handleSaveCheckIn = () => {
    if (!selectedEmp) return;
    // Muokataan tiettyä olemassa olevaa riviä (avattu "Tapahtuman työntekijät" ->
    // Muokkaa) — kohdistetaan id:llä eikä "jo sisäänkirjattuna" -esto koske tätä,
    // koska juuri sitä ollaan tarkoituksella korjaamassa.
    if (!editingCheckIn && currentEventCheckedIn.some(e => e.name === selectedEmp && getEmpStatus(e) === 'checked_in')) {
      alert('Työntekijä on jo sisäänkirjattuna.');
      return;
    }
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const checkInDateVal = checkInDate || localNow.toISOString().split('T')[0];
    const checkInTimeVal = checkInTime || localNow.toISOString().slice(11, 16);
    const updated = {
      role: checkInRole,
      nickname: checkInNickname.trim(),
      vest: checkInVest,
      badge: checkInBadge,
      headset: checkInHeadset,
      radio: checkInRadio,
      checkInDate: checkInDateVal,
      checkInTime: checkInTimeVal,
      checkOutDate: '',
      checkOutTime: '',
      checkOutComment: '',
      status: 'checked_in',
      // Muokkaustilassa kommentit hallitaan erikseen "Kommentit"-osiossa (ks.
      // handleAddEmpComment) — pääpainike ei enää ylikirjoita niitä. Tuoreessa
      // sisäänkirjauksessa yksittäinen kommenttikenttä tallentuu edelleen tässä.
      ...(editingCheckIn ? {} : { comment: checkInComment }),
    };
    setCheckedInEmployees(prev => {
      if (editingCheckIn) {
        return prev.map(e => (e.id === editingCheckIn.id ? { ...e, ...updated } : e));
      }
      // Jos työntekijä on jo merkitty tapahtumaan (odottaa tai on uloskirjattu),
      // päivitetään sama rivi sisäänkirjatuksi sen sijaan että luotaisiin kaksoiskappale.
      const existing = prev.find(e => e.name === selectedEmp && (e.eventId || 'fesx') === selectedEvent && getEmpStatus(e) !== 'checked_in');
      if (existing) {
        return prev.map(e => (e === existing ? { ...e, ...updated } : e));
      }
      return [...prev, { id: Date.now(), eventId: selectedEvent, name: selectedEmp, ...updated }];
    });
    resetCheckInForm();
    setActiveTab('planning_employees');
  };

  // Lisää nykyisen kommenttiluonnoksen uutena kommenttina muokattavan sisäänkirjausrivin
  // "Kommentit"-listaan (samaan riviin kuin esim. radiopuhelimen numero — ei erillistä
  // tallennuspyyntöä pääpainikkeen kanssa). Samalle henkilölle/tapahtumalle voi kertyä
  // useita kommentteja ajan mittaan.
  const handleAddEmpComment = () => {
    if (!editingCheckIn) return;
    const text = checkInComment.trim();
    if (!text) return;
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const newComment = {
      id: `c-${Date.now()}`,
      text,
      author: kirjaajanTunniste(),
      date: localNow.toISOString().split('T')[0],
      time: localNow.toISOString().slice(11, 16),
    };
    setCheckedInEmployees(prev => prev.map(e => (
      e.id === editingCheckIn.id
        ? { ...e, comments: [...getEmpComments(e), newComment], comment: '' }
        : e
    )));
    setCheckInComment('');
  };

  const handleDeleteEmpComment = (commentId) => {
    if (!editingCheckIn) return;
    const confirmed = window.confirm('Haluatko varmasti poistaa tämän kommentin?\n\nPoistoa ei voi perua.');
    if (!confirmed) return;
    setCheckedInEmployees(prev => prev.map(e => (
      e.id === editingCheckIn.id
        ? { ...e, comments: getEmpComments(e).filter(c => c.id !== commentId), comment: '' }
        : e
    )));
  };

  // Tallentaa nykyisen kommenttiluonnoksen TIKE:n "Avoin kirjaus" -tyylisenä
  // poikkeamaraporttina arkistoon (samaan reports-kokoelmaan), merkiten automaattisesti
  // kenestä työntekijästä on kyse. Ei kosketa sisäänkirjausrivin omaa kommenttilistaa.
  const handleSaveCommentAsReport = () => {
    const text = checkInComment.trim();
    if (!text) {
      alert('Kirjoita kommentti ennen tallennusta.');
      return;
    }
    const now = new Date();
    const timeLabel = checkInTime || now.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
    setReports(prev => [{
      id: getDynamicId(),
      createdAt: new Date().toISOString(),
      eventId: selectedEvent,
      typeId: 'open',
      ...uudenKirjauksenKentat('open'),
      type: 'Avoin kirjaus',
      author: kirjaajanTunniste(),
      date: checkInDate || now.toLocaleDateString('sv-SE'),
      time: timeLabel,
      summary: `${selectedEmp}: ${text}`,
    }, ...prev]);
    setRunningNumber(prev => prev + 1);
    setCheckInComment('');
    alert('Poikkeamaraportti tallennettu TIKE-arkistoon.');
  };

  const handleCheckOut = () => {
    if (!selectedOutEmp) return;
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const checkOutDateVal = checkOutDate || localNow.toISOString().split('T')[0];
    const checkOutTimeVal = checkOutTime || localNow.toISOString().slice(11, 16);
    setCheckedInEmployees(prev => prev.map(e => (e.id === selectedOutEmp.id
      ? {
          ...e,
          checkOutDate: checkOutDateVal,
          checkOutTime: checkOutTimeVal,
          checkOutComment: checkOutComment.trim(),
          status: 'checked_out',
        }
      : e)));
    setSelectedOutEmp(null);
    setOutEmpSearch('');
    setShowOutTimeInput(false);
    setCheckOutDate('');
    setCheckOutTime('');
    setCheckOutComment('');
  };

  const handleRemoveFromEventRoster = (emp) => {
    const confirmed = window.confirm(
      `Haluatko varmasti poistaa "${emp.name}" tästä tapahtumasta?\n\n` +
      'Tämä ei ole uloskirjaus — jos työntekijä on paikan päällä ja poistuu tapahtumasta, ' +
      'käytä TIKE:n "Työntekijän uloskirjaus" -lomaketta. Poistoa ei voi perua.'
    );
    if (!confirmed) return;
    setCheckedInEmployees(prev => prev.filter(e => e.id !== emp.id));
  };

  const handleOpenKirjausNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setOpenKirjausDate(d);
    setOpenKirjausTime(t);
  };

  const handleJvaNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setJvaDate(d);
    setJvaTime(t);
  };

  const toggleJvaTool = (tool) => {
    setJvaToolList(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]);
  };

  const resetJvaForm = () => {
    setJvaRole('Järjestyksenvalvoja');
    setJvaSearch('');
    setJvaName('');
    setJvaLocation('');
    setJvaDate('');
    setJvaTime('');
    setJvaDenied(false); setJvaDeniedCount('');
    setJvaRemoved(false); setJvaRemovedCount('');
    setJvaDetained(false); setJvaDetainedCount('');
    setJvaForce(false);
    setJvaTools(false); setJvaToolList([]); setJvaToolOther('');
    setJvaFirearm(false);
    setJvaFirstAid(false);
    setJvaDesc('');
    setJvaReporterFiled(false);
  };

  const handleClearJvReport = () => {
    setJvrGuardName('');
    setJvrLicenseHolder('');
    setJvrPlace('');
    setEventDate('');
    setEventTimeStr('');
    setJvrDetainedForce(false);
    setJvrTools(false);
    setJvrFirearm(false);
    setJvrFirstAid(false);
    setJvrLastName('');
    setJvrFirstNames('');
    setJvrPersonalId('');
    setJvrAddress('');
    setJvrFeatures('');
    setJvrObservations('');
    setJvrDesc('');
    setJvrTikeComment('');
  };

  // Järjestyksenvalvojan tapahtumailmoitus tallentuu reports-kokoelmaan omalla
  // typeId:llä 'jvreport'. Palvelinpuolen oikeustarkistus (server/permissions.js)
  // johtaa vaadittavan sivukartta-solmun typeId:stä, ja 'jvreport' on siellä
  // erikseen liitetty report_jv-solmuun — ei tike_form_*-solmuun, koska tämä
  // lomake on oma sivunsa TIKE-lomakkeiden ulkopuolella.
  const handleSaveJvReport = () => {
    if (!jvrGuardName.trim()) {
      alert('Kirjaa järjestyksenvalvojan nimi.');
      return;
    }
    if (!jvrDetainedForce && !jvrTools && !jvrFirearm && !jvrFirstAid && !jvrDesc.trim()) {
      alert('Valitse vähintään yksi toimenpide tai kirjoita vapaa kuvaus tapahtumasta.');
      return;
    }
    const now = new Date();
    const timeLabel = eventTimeStr || now.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
    const parts: string[] = [];
    if (jvrDetainedForce) parts.push('otettu kiinni tai käytetty voimakeinoja');
    if (jvrTools) parts.push('voimankäyttövälineitä käytetty');
    if (jvrFirearm) parts.push('ampuma-ase esillä tai käytetty');
    if (jvrFirstAid) parts.push('ensiapu tai ensihoito');

    setReports(prev => [{
      id: getDynamicId(),
      createdAt: new Date().toISOString(),
      eventId: selectedEvent,
      typeId: 'jvreport',
      ...uudenKirjauksenKentat('jvreport'),
      type: 'Järjestyksenvalvojan tapahtumailmoitus',
      author: jvrGuardName.trim(),
      licenseHolder: jvrLicenseHolder.trim(),
      date: eventDate || now.toLocaleDateString('sv-SE'),
      time: timeLabel,
      place: jvrPlace.trim(),
      summary: `${jvrPlace.trim() ? jvrPlace.trim() + ': ' : ''}${parts.join(', ') || 'ei toimenpiteitä kirjattu'}`,
      subjectLastName: jvrLastName.trim(),
      subjectFirstNames: jvrFirstNames.trim(),
      subjectPersonalId: jvrPersonalId.trim(),
      subjectAddress: jvrAddress.trim(),
      subjectFeatures: jvrFeatures.trim(),
      subjectObservations: jvrObservations.trim(),
      description: jvrDesc.trim(),
      tikeComment: jvrTikeComment.trim(),
      detainedOrForce: jvrDetainedForce,
      tools: jvrTools,
      firearm: jvrFirearm,
      firstAid: jvrFirstAid,
    }, ...prev]);

    setRunningNumber(prev => prev + 1);
    handleClearJvReport();
    alert('Tapahtumailmoitus tallennettu.');
  };

  const handleSaveJvaReport = () => {
    if (!jvaName.trim()) {
      alert('Kirjaa toimenpiteen suorittaneen henkilön nimi.');
      return;
    }
    if (!jvaDenied && !jvaRemoved && !jvaDetained && !jvaForce && !jvaTools && !jvaFirearm) {
      alert('Valitse vähintään yksi toimenpide.');
      return;
    }
    const now = new Date();
    const timeLabel = jvaTime || now.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
    const parts = [];
    if (jvaDenied) parts.push(`estetty pääsy ${Number(jvaDeniedCount) || 1}`);
    if (jvaRemoved) parts.push(`poistettu ${Number(jvaRemovedCount) || 1}`);
    if (jvaDetained) parts.push(`kiinniotettu ${Number(jvaDetainedCount) || 1}`);
    if (jvaForce) parts.push('voimakeinoja käytetty');
    if (jvaTools) parts.push(`välineet: ${jvaToolList.join(', ') || 'ei eritelty'}`);
    if (jvaFirearm) parts.push('ampuma-ase esillä tai käytetty');
    if (jvaFirstAid) parts.push('ensiapu tai ensihoito');

    setReports(prev => [{
      id: getDynamicId(),
      createdAt: new Date().toISOString(),
      eventId: selectedEvent,
      typeId: 'jvaction',
      ...uudenKirjauksenKentat('jvaction'),
      type: 'JV:n tai vartijan toimenpide',
      author: jvaName,
      date: jvaDate || now.toLocaleDateString('sv-SE'),
      time: timeLabel,
      summary: `${jvaLocation ? jvaLocation + ': ' : ''}${parts.join(', ')}`,
      // Järjestyksenvalvojan kirjoittama vapaa kuvaus tilanteen kulusta. Tämä jäi
      // aiemmin kokonaan tallentumatta: jvaDesc luettiin lomakkeelta mutta sitä ei
      // koskaan liitetty tietueeseen, joten kuvaus katosi Tallenna-painalluksessa.
      // Salataan levyllä (ks. server/store.js ENCRYPTED_FIELDS).
      description: jvaDesc.trim(),
      denied: jvaDenied ? (Number(jvaDeniedCount) || 1) : 0,
      removed: jvaRemoved ? (Number(jvaRemovedCount) || 1) : 0,
      detained: jvaDetained ? (Number(jvaDetainedCount) || 1) : 0,
      force: jvaForce,
      tools: jvaTools,
      firearm: jvaFirearm,
      firstAid: jvaFirstAid
    }, ...prev]);

    setRunningNumber(prev => prev + 1);
    resetJvaForm();
    setActiveTab('overview');
  };

  // Lataa valitun tiedoston palvelimelle ja päivittää nimi-/id-/latausindikaattoritilat.
  // setName: näytettävä tiedostonimi, setId: palvelimen antama viite (talletetaan raporttiin), setUploading: latauksen tilailmaisin.
  const uploadAttachment = async (file, setName, setId, setUploading) => {
    if (!file) return;
    setName(file.name);
    setId('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: formData });
      const data = await res.json();
      if (res.ok && data.ok) {
        setId(data.id);
      } else {
        alert(data.error || 'Tiedoston lähetys epäonnistui.');
        setName('');
      }
    } catch {
      alert('Tiedoston lähetys epäonnistui (yhteysvirhe).');
      setName('');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveOpenKirjaus = () => {
    if (!openKirjausText.trim()) {
      alert('Kirjoita kuvaus tapahtuneesta ennen tallennusta.');
      return;
    }
    if (fileUploading) {
      alert('Odota, että liitetiedoston lähetys valmistuu.');
      return;
    }
    // Otsikko on tehtävälistan ainoa näkyvä teksti, joten ilman sitä tehtävä olisi
    // nimetön rivi koontinäytössä.
    if (openKirjausTask && !openKirjausTaskTitle.trim()) {
      alert('Anna tehtävälle otsikko, tai poista rasti kohdasta "Merkitse tehtäväksi".');
      return;
    }
    const now = new Date();
    const timeLabel = openKirjausTime || now.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

    setReports(prev => [{
      id: getDynamicId(),
      createdAt: new Date().toISOString(),
      eventId: selectedEvent,
      typeId: 'open',
      ...uudenKirjauksenKentat('open'),
      type: 'Avoin kirjaus',
      author: kirjaajanTunniste(),
      date: openKirjausDate || now.toLocaleDateString('sv-SE'),
      time: timeLabel,
      summary: openKirjausText.trim(),
      // Tehtäväksi merkityt kirjaukset nousevat Tilannekuvan Tehtävät-listaan.
      // Litteinä kenttinä eikä olioina, jotta taskTitle voidaan tarvittaessa
      // lisätä server/store.js:n ENCRYPTED_FIELDS-listaan kuten muu vapaa teksti.
      taskTitle: openKirjausTask ? openKirjausTaskTitle.trim() : '',
      taskUrgency: openKirjausTask ? openKirjausTaskUrgency : '',
      attachment: fileUploadId ? { id: fileUploadId, name: fileName } : null
    }, ...prev]);

    setRunningNumber(prev => prev + 1);
    setActiveTab('report_tike');
    setOpenKirjausDate('');
    setOpenKirjausTime('');
    setOpenKirjausText('');
    setOpenKirjausTask(false);
    setOpenKirjausTaskTitle('');
    setOpenKirjausTaskUrgency(TEHTAVA_KIIRE_OLETUS);
    setFileName('');
    setFileUploadId('');
  };

  const handleSaveFirstAid = () => {
    if (!faDesc.trim()) {
      alert('Kirjaa tapahtuman kuvaus ennen tallennusta.');
      return;
    }
    if (faFileUploading) {
      alert('Odota, että liitetiedoston lähetys valmistuu.');
      return;
    }
    const now = new Date();
    const timeLabel = faTime || now.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

    setReports(prev => [{
      id: getDynamicId(),
      createdAt: new Date().toISOString(),
      eventId: selectedEvent,
      typeId: 'firstaid',
      ...uudenKirjauksenKentat('firstaid'),
      type: 'Ensiaputilanne',
      author: kirjaajanTunniste('EA-Päivystys'),
      date: faDate || now.toLocaleDateString('sv-SE'),
      time: timeLabel,
      summary: faDesc.trim(),
      actions: faActions.trim(),
      resources: faResources.trim(),
      employees: faEmployees.trim(),
      attachment: faFileUploadId ? { id: faFileUploadId, name: faFileName } : null
    }, ...prev]);

    setRunningNumber(prev => prev + 1);
    setActiveTab('report_tike');
    setFaDate(''); setFaTime(''); setFaDesc(''); setFaActions(''); setFaResources(''); setFaEmployees('');
    setFaFileName(''); setFaFileUploadId('');
  };

  // Yhteinen tallennus uhkatilanne-, omaisuusvaurio-, löytötavara-, jono- ja sääraporteille
  const handleSaveGenericReport = (typeId, title) => {
    if (!genRepDesc.trim()) {
      alert('Kirjaa tapahtuman kuvaus ennen tallennusta.');
      return;
    }
    if (genRepFileUploading) {
      alert('Odota, että liitetiedoston lähetys valmistuu.');
      return;
    }
    const now = new Date();
    const timeLabel = genRepTime || now.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

    setReports(prev => [{
      id: getDynamicId(),
      createdAt: new Date().toISOString(),
      eventId: selectedEvent,
      typeId,
      ...uudenKirjauksenKentat(typeId),
      type: title,
      author: kirjaajanTunniste(),
      date: genRepDate || now.toLocaleDateString('sv-SE'),
      time: timeLabel,
      summary: genRepDesc.trim(),
      actions: genRepActions.trim(),
      employees: genRepEmps.trim(),
      attachment: genRepFileUploadId ? { id: genRepFileUploadId, name: genRepFile } : null
    }, ...prev]);

    setRunningNumber(prev => prev + 1);
    setActiveTab('report_tike');
    setGenRepDate(''); setGenRepTime(''); setGenRepDesc(''); setGenRepActions(''); setGenRepEmps('');
    setGenRepFile(''); setGenRepFileUploadId('');
  };

  const handleFaNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setFaDate(d);
    setFaTime(t);
  };

  const handleGenRepNyt = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [d, t] = now.toISOString().slice(0, 16).split('T');
    setGenRepDate(d);
    setGenRepTime(t);
  };

  // Kirjoittaa lomakeluonnoksen tapahtuman avausvalmius-tietueeksi. Kokoelman
  // automaattitallennus (useEffect yllä) vie sen palvelimelle. Yksi tietue per
  // tapahtuma, joten sama id ylikirjoittaa aiemman kuittauksen.
  const handleSaveReadiness = () => {
    const tietue = {
      id: `readiness-${selectedEvent}`,
      eventId: selectedEvent,
      checks: { ...readinessChecks },
      targetDate: targetOpeningDate,
      targetTime: targetOpeningTime,
      comments: readinessComments.trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: sessionNickname || '',
    };
    setReadiness(prev => [...prev.filter(r => (r.eventId || 'fesx') !== selectedEvent), tietue]);
    setActiveTab('planning');
  };

  const toggleReadinessCheck = (key) => {
    setReadinessChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Sisäänkirjaushaku: pois suljetaan vain jo aktiivisesti sisäänkirjatut — tapahtumaan
  // merkityt (mutta ei vielä sisäänkirjatut) ja jo uloskirjatut saa hakea uudelleen.
  const filteredEmployees = empSearch.length >= 3
    ? employees.map(e => e.name).filter(e =>
        e.toLowerCase().includes(empSearch.toLowerCase()) &&
        !currentEventCheckedIn.some(c => c.name === e && getEmpStatus(c) === 'checked_in'))
    : [];

  // Uloskirjaushaku: vain juuri nyt aktiivisesti sisäänkirjatut voi kirjata ulos.
  const filteredOutEmployees = outEmpSearch.length >= 3
    ? currentEventCheckedIn.filter(e => getEmpStatus(e) === 'checked_in' && e.name.toLowerCase().includes(outEmpSearch.toLowerCase()))
    : [];

  // Toimenpiteen tekijän haku: ensisijaisesti paikalla (sisäänkirjattuna) olevista, muuten koko rekisteristä
  const jvaNameOptions = jvaSearch.length >= 3
    ? Array.from(new Set([
        ...currentEventCheckedIn.filter(e => e.role === jvaRole && getEmpStatus(e) === 'checked_in').map(e => e.name),
        ...employees.map(e => e.name)
      ])).filter(n => n.toLowerCase().includes(jvaSearch.toLowerCase()))
    : [];

  // Miehityslaskurit vain aktiivisesti sisäänkirjatuista työntekijöistä (ei tapahtumaan
  // vasta merkittyjä eikä jo uloskirjattuja).
  const jvCount = currentEventCheckedIn.filter(e => e.role === 'Järjestyksenvalvoja' && getEmpStatus(e) === 'checked_in').length;
  const guardCount = currentEventCheckedIn.filter(e => e.role === 'Vartija' && getEmpStatus(e) === 'checked_in').length;
  // Ensiapu- ja muu henkilöstö: samat laskurit kuin JV/vartija, eivät kovakoodattuja
  // lukuja kuten aiemmin. Rooli valitaan sisäänkirjauksessa (ks. CHECKIN_ROLES).
  const firstAidStaffCount = currentEventCheckedIn.filter(e => e.role === 'Ensiapu' && getEmpStatus(e) === 'checked_in').length;
  const otherStaffCount = currentEventCheckedIn.filter(e => e.role === 'Muu' && getEmpStatus(e) === 'checked_in').length;
  // Valitun tapahtuman perustietolomake. Määritelty tässä, koska ensimmäinen
  // käyttö on heti alla oleva JV-mitoitus — myöhemmin samaa lomaketta luetaan
  // myös avausvalmiuden laskurissa.
  const valittuTapahtumaLomake = (events.find((e) => e.id === selectedEvent) as any)?.formData || {};

  // JV-mitoitus tulee tapahtuman perustiedoista (osio 7), ei kovakoodattuna.
  // 0 = mitoitusta ei ole vahvistettu, jolloin vertailulukua ei näytetä lainkaan
  // — aiemmin tässä oli kiinteä 142, joka oli väärä heti toisesta tapahtumasta.
  const requiredJv = Math.max(0, Number(valittuTapahtumaLomake.requiredJvCount) || 0);
  const jvMissing = Math.max(0, requiredJv - jvCount);

  // ---- Tilannekuvan laskurit raportoiduista kirjauksista ----

  // Kellonaika tunteina, käytetään viimeisen tunnin suodatukseen
  const minutesFromTimeString = (t) => {
    if (!t || typeof t !== 'string' || !t.includes(':')) return null;
    const [h, m] = t.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const withinLastHour = (t) => {
    const mins = minutesFromTimeString(t);
    if (mins === null) return false;
    return mins <= nowMinutes && nowMinutes - mins <= 60;
  };

  // Ensiaputapaukset: erilliset ensiapukirjaukset ja ne toimenpiteet,
  // joissa kohdehenkilö on viety ensiapuun tai ensihoitoa on käytetty
  const firstAidReports = currentEventReports.filter(r => r.typeId === 'firstaid');
  const firstAidInActions = currentEventReports.filter(
    r => (r.typeId === 'jvaction' || r.typeId === 'jvreport') && r.firstAid
  );
  const firstAidCount = firstAidReports.length + firstAidInActions.length;
  const firstAidLastHour = [...firstAidReports, ...firstAidInActions].filter(r => withinLastHour(r.time)).length;

  // Poistot: poistettujen henkilöiden yhteismäärä toimenpidekirjauksista
  const removalReports = currentEventReports.filter(r => r.typeId === 'jvaction' && Number(r.removed) > 0);
  const removalCount = removalReports.reduce((sum, r) => sum + Number(r.removed || 0), 0);

  // Poikkeamat: JV:n tai vartijan toimenpide, ensiaputilanne, uhkatilanne,
  // aitojen ylitys tai luvaton sisäänpääsy sekä omaisuusvaurio
  const deviationReports = currentEventReports.filter(r => DEVIATION_TYPES.includes(r.typeId));
  const deviationCount = deviationReports.length;
  const deviationLastHour = deviationReports.filter(r => withinLastHour(r.time)).length;

  // Riskiluokan 3-5 riskiarvioinnit näytetään myös Tilannekuvan hälytyksissä
  const riskAlerts = currentEventRiskAssessments
    .filter(ra => ra.score >= 3)
    // Vakavin ensin: Tilannekuvan paneeliin mahtuu vain osa (HALYTYKSET_NAYTOSSA),
    // joten järjestys ratkaisee mitkä niistä käyttäjä näkee. filter palauttaa uuden
    // taulukon, joten sort ei muuta alkuperäistä listaa.
    .sort((a, b) => b.score - a.score)
    .map(ra => ({
      id: `risk-${ra.id}`,
      type: ra.score >= 4 ? 'critical' : 'warning',
      message: `Riskiarvio (${riskLevels[ra.score].label}): ${ra.hazard}`,
      time: ra.date,
      location: ra.target
    }));

  // Tehtävät: avoimet kirjaukset jotka on merkitty tehtäväksi. Järjestys on
  // kiireellisyys ensin ja saman kiireellisyyden sisällä vanhin ensin — pisimpään
  // odottanut on se joka todennäköisimmin unohtuu.
  const tehtavat = currentEventReports
    .filter((r) => r.taskTitle && !r.taskDoneAt)
    .slice()
    .sort((a, b) => {
      const ero = tehtavanKiire(a.taskUrgency).jarjestys - tehtavanKiire(b.taskUrgency).jarjestys;
      if (ero !== 0) return ero;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });

  const KOONTI_SIVUKOKO = 5;
  const tehtavatPageCount = Math.max(1, Math.ceil(tehtavat.length / KOONTI_SIVUKOKO));
  const tehtavatPageSafe = Math.min(tehtavatPage, tehtavatPageCount - 1);
  const tehtavatSivulla = tehtavat.slice(
    tehtavatPageSafe * KOONTI_SIVUKOKO,
    tehtavatPageSafe * KOONTI_SIVUKOKO + KOONTI_SIVUKOKO
  );

  // "Uusimmat raportit" -koonti: avointa tehtävää ei näytetä täällä, koska se on jo
  // saman kortin Tehtävät-välilehdellä. Kuittauksen jälkeen kirjaus ilmestyy tänne
  // kuten mikä tahansa raportti. Rajaus koskee VAIN tätä koontia — Tallennetut
  // raportit, PDF-lista ja TIKE-loki näyttävät kirjauksen normaalisti heti luonnista.
  const uusimmatRaportit = currentEventReports.filter((r) => !(r.taskTitle && !r.taskDoneAt));
  const uusimmatPageCount = Math.max(1, Math.ceil(uusimmatRaportit.length / KOONTI_SIVUKOKO));
  const uusimmatPageSafe = Math.min(uusimmatPage, uusimmatPageCount - 1);
  const uusimmatSivulla = uusimmatRaportit.slice(
    uusimmatPageSafe * KOONTI_SIVUKOKO,
    uusimmatPageSafe * KOONTI_SIVUKOKO + KOONTI_SIVUKOKO
  );

  // TIKE-loki: kaikki tehdyt TIKE-kirjaukset paitsi työntekijän sisään-/uloskirjaukset
  // (ne täyttäisivät lokin nopeasti). currentEventReports on jo uusin ensin -järjestyksessä.
  const tikeLogReports = currentEventReports.filter(r => r.typeId !== 'in' && r.typeId !== 'out');
  const tikeLogPageSize = 5;
  const tikeLogPageCount = Math.max(1, Math.ceil(tikeLogReports.length / tikeLogPageSize));
  const tikeLogPageSafe = Math.min(tikeLogPage, tikeLogPageCount - 1);
  const tikeLogPageItems = tikeLogReports.slice(
    tikeLogPageSafe * tikeLogPageSize,
    tikeLogPageSafe * tikeLogPageSize + tikeLogPageSize
  );

  // Avausvalmiuden koontitiedot luetaan TALLENNETUSTA tietueesta eikä lomakkeen
  // luonnoksesta: muuten suunnittelunäkymän tilapalkki näyttäisi kuittauksia joita
  // ei ole tallennettu, ja tila katoaisi sivun latauksessa.
  const tallennettuValmius = readiness.find((r) => (r.eventId || 'fesx') === selectedEvent) || null;
  const tallennetutKuittaukset = tallennettuValmius?.checks || {};
  const completedChecksCount = READINESS_CHECKS.filter((i) => tallennetutKuittaukset[i.key]).length;
  const missingChecksCount = READINESS_CHECKS.length - completedChecksCount;
  const isReadyForOpening = missingChecksCount === 0;

  // Tapahtuman perustiedoista: milloin portit on suunniteltu avattavaksi yleisölle.
  const suunniteltuAvausPvm = valittuTapahtumaLomake.publicStartDate || '';
  const suunniteltuAvausKlo = valittuTapahtumaLomake.publicStartTime || '';

  // Tavoiteltu avaushetki = Avausvalmius-lomakkeella asetettu pvm + klo. Tähän laskuri
  // laskee. Jos tavoitetta ei ole tallennettu, käytetään tapahtuman perustietoja.
  const tavoiteAvausPvm = tallennettuValmius?.targetDate || suunniteltuAvausPvm;
  const tavoiteAvausKlo = tallennettuValmius?.targetTime || suunniteltuAvausKlo;
  const tavoiteAvausHetki = yhdistaPaivaJaAika(tavoiteAvausPvm, tavoiteAvausKlo);
  // null = tavoiteaikaa ei ole asetettu, jolloin laskuria ei näytetä lainkaan.
  const avaukseenMs = tavoiteAvausHetki ? tavoiteAvausHetki.getTime() - currentTime.getTime() : null;
  const isLate = avaukseenMs !== null && avaukseenMs < 0;

  let readinessStatusColor = 'bg-blue-50 border-blue-200 text-blue-800';
  let readinessStatusIconColor = 'text-blue-500';
  let readinessStatusText = `Avausvalmius kesken. ${missingChecksCount} kohtaa puuttuu.`;

  if (isReadyForOpening) {
    readinessStatusColor = 'bg-emerald-50 border-emerald-200 text-emerald-800';
    readinessStatusIconColor = 'text-emerald-500';
    readinessStatusText = 'Tapahtuma voidaan aloittaa (Portit avata).';
  } else if (isLate) {
    readinessStatusColor = 'bg-rose-50 border-rose-200 text-rose-800';
    readinessStatusIconColor = 'text-rose-500';
    readinessStatusText = `Avaus on myöhässä! ${missingChecksCount} kohtaa puuttuu.`;
  }

  const renderContent = () => {
    // Suoja tilanteille joissa aiemmin sallitun sivun activeTab jää voimaan sen jälkeen
    // kun admin on rajannut oikeuksia — pelkkä valikoiden piilottaminen ei riitä.
    if (!isAdminUser && !canView(perms, selectedEvent, sitemapIdForTab(activeTab))) {
      return (
        <div className="bg-white p-10 rounded-xl shadow-sm border border-slate-100 text-center max-w-lg mx-auto">
          <ShieldAlert className="text-rose-400 mx-auto mb-4" size={40} />
          <h2 className="text-lg font-bold text-slate-800 mb-1">Ei käyttöoikeutta</h2>
          <p className="text-sm text-slate-500">Sinulla ei ole oikeutta tähän sivuun. Ota yhteyttä pääkäyttäjään jos tarvitset pääsyn.</p>
        </div>
      );
    }
    switch (activeTab) {
      // 'landing' (Aloitussivu) ei ole enää tapahtuman välilehti — sen sisältö on nyt
      // koko sovelluksen etusivu, joka aukeaa heti kirjautumisen jälkeen.
      case 'eventfiles': {
        const saaMuokata = isAdminUser || canEdit(perms, selectedEvent, 'eventfiles');
        const nykyisenSisalto = tapahtumanTiedostot
          .filter((f) => (f.parentId || null) === currentFolderId)
          .sort((a, b) => {
            // Kansiot ensin, sitten nimen mukaan.
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return String(a.name).localeCompare(String(b.name), 'fi');
          });
        const kohteenJaot = (id) => fileShares.filter((sh) => sh.targetId === id && !sh.revokedAt);
        const odottavat = fileShares.filter((sh) => sh.approvalStatus === 'pending' && !sh.revokedAt);

        return (
          <div className="space-y-6 max-w-5xl">
            <div className="mb-2 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Package className="text-indigo-500" size={28} />
                Tapahtuman tiedostot
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Tapahtuman omat kansiot ja tiedostot. Yksittäisen tiedoston tai kokonaisen
                kansion voi jakaa myös sovelluksen ulkopuolelle.
              </p>
            </div>

            {/* Pääkäyttäjän hyväksyntää odottavat pysyvät linkit */}
            {isAdminUser && odottavat.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-1">
                  <AlertTriangle size={16} className="text-amber-500" />
                  Pysyviä jakolinkkejä odottaa hyväksyntää ({odottavat.length})
                </h3>
                <p className="text-xs text-amber-800 mb-4">
                  Linkki toimii määräaikaisena kunnes hyväksyt sen. Hyväksyntä poistaa
                  vanhentumisen kokonaan — hylkäys jättää linkin alkuperäiseen määräaikaansa.
                </p>
                <div className="space-y-2">
                  {odottavat.map((sh) => {
                    const kohde = tapahtumanTiedostot.find((f) => f.id === sh.targetId);
                    return (
                      <div key={sh.id} className="bg-white border border-amber-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{kohde?.name || 'Poistettu kohde'}</p>
                          <p className="text-xs text-slate-500">
                            Pyytäjä: {sh.createdBy} · Voimassa väliaikaisesti {sh.expiresAt ? new Date(sh.expiresAt).toLocaleDateString('fi-FI') : '—'} asti
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => hyvaksyJako(sh, true)}
                            className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
                          >
                            Hyväksy pysyväksi
                          </button>
                          <button
                            type="button"
                            onClick={() => hyvaksyJako(sh, false)}
                            className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-md transition-colors"
                          >
                            Hylkää
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Murupolku */}
            <div className="flex items-center gap-1.5 flex-wrap text-sm">
              <button
                type="button"
                onClick={() => setCurrentFolderId(null)}
                className={`px-2 py-1 rounded-md transition-colors ${currentFolderId === null ? 'font-bold text-slate-800' : 'text-indigo-600 hover:bg-indigo-50'}`}
              >
                Tapahtuman tiedostot
              </button>
              {murupolku.map((kansio, idx) => (
                <span key={kansio.id} className="flex items-center gap-1.5">
                  <ChevronRight size={14} className="text-slate-300" />
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(kansio.id)}
                    className={`px-2 py-1 rounded-md transition-colors ${idx === murupolku.length - 1 ? 'font-bold text-slate-800' : 'text-indigo-600 hover:bg-indigo-50'}`}
                  >
                    {kansio.name}
                  </button>
                </span>
              ))}
            </div>

            {/* Uusi kansio ja tiedoston lataus */}
            {saaMuokata && (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') luoKansio(); }}
                    placeholder="Uuden kansion nimi"
                    className="flex-1 rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={luoKansio}
                    disabled={!newFolderName.trim()}
                    className="shrink-0 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Luo kansio
                  </button>
                </div>
                <input
                  ref={tiedostoInputRef}
                  type="file"
                  onChange={(e) => lataaTiedosto(e.target.files?.[0])}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={tiedostoUploading}
                  onClick={() => tiedostoInputRef.current?.click()}
                  className="shrink-0 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Paperclip size={16} />
                  {tiedostoUploading ? 'Lähetetään…' : 'Lisää tiedosto'}
                </button>
              </div>
            )}

            {/* Sisältö */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {nykyisenSisalto.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  {currentFolderId ? 'Kansio on tyhjä.' : 'Ei vielä tiedostoja. Luo kansio tai lisää tiedosto yltä.'}
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {nykyisenSisalto.map((kohde) => {
                    const jaot = kohteenJaot(kohde.id);
                    const henkilotietoa = onHenkilotietoa(kohde);
                    return (
                      <div key={kohde.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {kohde.type === 'folder' ? (
                            <button
                              type="button"
                              onClick={() => setCurrentFolderId(kohde.id)}
                              className="flex items-center gap-3 min-w-0 text-left"
                            >
                              <Layers size={18} className="text-indigo-500 shrink-0" />
                              <span className="text-sm font-medium text-slate-800 truncate hover:text-indigo-700">{kohde.name}</span>
                            </button>
                          ) : (
                            <a
                              href={`/api/uploads/${kohde.uploadId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-3 min-w-0"
                            >
                              <FileText size={18} className="text-slate-400 shrink-0" />
                              <span className="text-sm font-medium text-slate-800 truncate hover:text-indigo-700">{kohde.name}</span>
                            </a>
                          )}
                          {henkilotietoa && (
                            <span className="shrink-0 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase tracking-wide">
                              Henkilötietoa
                            </span>
                          )}
                          {jaot.length > 0 && (
                            <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase tracking-wide">
                              Jaettu ({jaot.length})
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 items-center shrink-0">
                          {saaMuokata && (
                            <>
                              <button
                                type="button"
                                onClick={() => vaihdaHenkilotietoLippu(kohde)}
                                title="Merkitse sisältääkö kohde henkilötietoa. Vaikuttaa siihen miten sen voi jakaa."
                                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                                  kohde.containsPersonalData
                                    ? 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                                    : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                                }`}
                              >
                                {kohde.containsPersonalData ? 'Henkilötietoa' : 'Ei henkilötietoa'}
                              </button>
                              <button
                                type="button"
                                onClick={() => avaaJakoDialogi(kohde)}
                                className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                              >
                                Jaa
                              </button>
                              <button
                                type="button"
                                onClick={() => poistaTiedostoTaiKansio(kohde)}
                                title="Poista"
                                className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-md transition-colors"
                              >
                                Poista
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Voimassa olevat jakolinkit */}
            {(() => {
              const omatJaot = fileShares.filter(
                (sh) => tapahtumanTiedostot.some((f) => f.id === sh.targetId) && !sh.revokedAt
              );
              if (omatJaot.length === 0) return null;
              return (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-800 mb-3">Voimassa olevat jaot</h3>
                  <div className="space-y-2">
                    {omatJaot.map((sh) => {
                      const kohde = tapahtumanTiedostot.find((f) => f.id === sh.targetId);
                      const tapa = sh.mode === 'link' ? 'Linkki'
                        : sh.mode === 'password' ? 'Linkki + salasana'
                        : `Käyttäjät (${(sh.allowedUsernames || []).length})`;
                      return (
                        <div key={sh.id} className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{kohde?.name}</p>
                            <p className="text-xs text-slate-500">
                              {tapa}
                              {' · '}
                              {/* Käyttäjäjaossa ei ole vanhentumista eikä hyväksyntää:
                                  se on voimassa kunnes se peruutetaan. */}
                              {sh.mode === 'users'
                                ? 'voimassa toistaiseksi'
                                : sh.expiresAt
                                  ? `voimassa ${new Date(sh.expiresAt).toLocaleString('fi-FI')} asti`
                                  : sh.approvalStatus === 'approved' ? 'pysyvä' : 'odottaa hyväksyntää'}
                              {' · '}
                              ladattu {sh.downloadCount || 0} kertaa
                              {sh.maxDownloads ? ` / ${sh.maxDownloads}` : ''}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {sh.mode !== 'users' && (
                              <button
                                type="button"
                                onClick={() => naytaJakoLinkki(sh)}
                                className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                              >
                                Näytä linkki
                              </button>
                            )}
                            {saaMuokata && (
                              <button
                                type="button"
                                onClick={() => peruutaJako(sh)}
                                className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-md transition-colors"
                              >
                                Peruuta
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      }
      case 'overview':
        return (
          <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <DashboardCard 
                title="Aktiiviset Järjestyksenvalvojat" 
                icon={ShieldCheck} 
                value={jvCount} 
                subtitle={requiredJv === 0
                  ? 'Mitoitusta ei ole vahvistettu — aseta se tapahtuman perustiedoissa (osio 7)'
                  : jvMissing === 0
                    ? `Sisäänkirjattu ${jvCount}/${requiredJv} — mitoitus täyttyy`
                    : `Sisäänkirjattu ${jvCount}/${requiredJv} — puuttuu ${jvMissing}`}
              />
              <DashboardCard 
                title="Ensiaputapaukset" 
                icon={HeartPulse} 
                value={firstAidCount} 
                subtitle={`Raportoitu ${firstAidReports.length} ensiapukirjausta ja ${firstAidInActions.length} toimenpiteen yhteydessä | Viimeisen tunnin aikana ${firstAidLastHour}`}
              />
              <DashboardCard 
                title="Poistot" 
                icon={LogOut} 
                value={removalCount} 
                subtitle={removalCount === 0
                  ? 'Ei poistoja kirjattuna'
                  : `${removalReports.length} kirjauksesta, koko tapahtuman ajalta`}
              />
              <DashboardCard 
                title="Poikkeamat" 
                icon={AlertTriangle} 
                value={deviationCount} 
                subtitle={`Toimenpiteet ja tapahtumailmoitukset, ensiapu, uhkatilanteet, aitojen ylitykset ja omaisuusvauriot | Viimeisen tunnin aikana ${deviationLastHour}`}
              />
            </div>

            {/* Yläruudukko - TIKE-loki ja valmiustarkastus samalla rivillä */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              {/* Vasen kortti - TIKE-loki */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col h-full">
                   <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <MessageSquare className="text-indigo-500" size={20} />
                      TIKE Loki (Viimeisimmät)
                    </h2>
                    <button
                      onClick={() => setActiveTab('report_tike')}
                      className="px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      + Uusi Kirjaus
                    </button>
                  </div>
                  <div className="space-y-1 flex-1">
                    {tikeLogPageItems.length === 0 ? (
                      <p className="text-sm text-slate-500 py-4 text-center">Ei vielä TIKE-kirjauksia.</p>
                    ) : (
                      tikeLogPageItems.map(rep => (
                        <div
                          key={rep.id}
                          onClick={() => { setOpenedReport(rep); setOpenedReportSource('overview'); }}
                          className="flex gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-50 last:border-0 cursor-pointer"
                        >
                          <div className="text-sm font-mono text-slate-400 w-16 pt-0.5">{rep.time}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 line-clamp-1">{rep.summary}</p>
                            <p className="text-xs text-slate-500 mt-1">Kirjaaja: {rep.author}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-3 mt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-500">{tikeLogReports.length} raporttia yhteensä</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={tikeLogPageSafe === 0}
                        onClick={() => setTikeLogPage(p => Math.max(0, p - 1))}
                        className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Edellinen
                      </button>
                      <span className="text-xs text-slate-400">{tikeLogPageSafe + 1}/{tikeLogPageCount}</span>
                      <button
                        type="button"
                        disabled={tikeLogPageSafe >= tikeLogPageCount - 1}
                        onClick={() => setTikeLogPage(p => Math.min(tikeLogPageCount - 1, p + 1))}
                        className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Seuraava
                      </button>
                    </div>
                  </div>
              </div>

              {/* Oikea kortti - Valmiustarkastus ja raportit */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full">
                  <div className="flex border-b border-slate-100">
                    <button 
                      onClick={() => setOverviewCardTab('checklist')}
                      className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${overviewCardTab === 'checklist' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <CheckCircle size={16} />
                      Tehtävät
                    </button>
                    <button 
                      onClick={() => setOverviewCardTab('reports')}
                      className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${overviewCardTab === 'reports' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <Archive size={16} />
                      Uusimmat raportit
                    </button>
                  </div>
                  
                  <div className="p-6 flex-1">
                    {overviewCardTab === 'checklist' ? (
                      <div className="space-y-3 animate-in fade-in duration-300">
                        {tehtavat.length === 0 ? (
                          <p className="text-sm text-slate-500 py-4 text-center">
                            Ei avoimia tehtäviä. Tehtävä syntyy kun TIKE:n avoimessa kirjauksessa
                            rastitaan &quot;Merkitse tehtäväksi&quot;.
                          </p>
                        ) : (
                          tehtavatSivulla.map((tehtava) => {
                            const kiire = tehtavanKiire(tehtava.taskUrgency);
                            const ika = tehtavanIka(tehtava, currentTime);
                            return (
                              <div
                                key={tehtava.id}
                                onClick={() => { setOpenedReport(tehtava); setOpenedReportSource('overview'); }}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:brightness-[0.98] ${kiire.reuna}`}
                              >
                                <span className={`w-3 h-3 rounded-full shrink-0 mt-1.5 ${kiire.piste}`} title={kiire.label} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-800">{tehtava.taskTitle}</p>
                                  <p className={`text-xs mt-0.5 ${kiire.teksti}`}>{kiire.label}</p>
                                </div>
                                {/* Ikä juoksee currentTimen tahdissa (päivittyy sekunnin välein),
                                    joten tehtävän odotusaika on koko ajan näkyvissä. */}
                                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                  <span className="text-xs font-mono tabular-nums text-slate-500" title="Aikaa luonnista">
                                    {ika}
                                  </span>
                                  {/* Tallennus kulkee raporttien kautta, joten kuittaus vaatii saman
                                      muokkausoikeuden kuin avoimen kirjauksen tekeminen. Ilman
                                      tarkistusta painike näyttäisi toimivan mutta palvelin hylkäisi sen. */}
                                  {(isAdminUser || canEdit(perms, selectedEvent, 'tike_form_open')) && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setCompletingTask(tehtava); setCompletingTaskComment(''); }}
                                      title="Kuittaa tehdyksi — kirjaus säilyy tallennetuissa raporteissa"
                                      aria-label="Kuittaa tehdyksi"
                                      className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-white/70 transition-colors"
                                    >
                                      <CheckCircle size={18} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                        {tehtavat.length > 0 && (
                          <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100">
                            <span className="text-xs text-slate-500">{tehtavat.length} avointa tehtävää</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={tehtavatPageSafe === 0}
                                onClick={() => setTehtavatPage(p => Math.max(0, p - 1))}
                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                Edellinen
                              </button>
                              <span className="text-xs text-slate-400">{tehtavatPageSafe + 1}/{tehtavatPageCount}</span>
                              <button
                                type="button"
                                disabled={tehtavatPageSafe >= tehtavatPageCount - 1}
                                onClick={() => setTehtavatPage(p => Math.min(tehtavatPageCount - 1, p + 1))}
                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                Seuraava
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3 animate-in fade-in duration-300">
                        {uusimmatRaportit.length === 0 && (
                          <p className="text-sm text-slate-500 py-4 text-center">Ei vielä raportteja tälle tapahtumalle.</p>
                        )}
                        {uusimmatSivulla.map((rep, idx) => (
                          <div
                            key={idx}
                            onClick={() => { setOpenedReport(rep); setOpenedReportSource('overview'); }}
                            className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors cursor-pointer"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{rep.type}</span>
                              <span className="text-xs font-mono text-slate-400">{rep.time}</span>
                            </div>
                            <p className="text-sm font-medium text-slate-800 line-clamp-1">{rep.summary}</p>
                            <p className="text-xs text-slate-500">Kirjaaja: {rep.author} | ID: {rep.id.split('/').pop()}</p>
                          </div>
                        ))}
                        {uusimmatRaportit.length > 0 && (
                          <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100">
                            <span className="text-xs text-slate-500">{uusimmatRaportit.length} raporttia</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={uusimmatPageSafe === 0}
                                onClick={() => setUusimmatPage(p => Math.max(0, p - 1))}
                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                Edellinen
                              </button>
                              <span className="text-xs text-slate-400">{uusimmatPageSafe + 1}/{uusimmatPageCount}</span>
                              <button
                                type="button"
                                disabled={uusimmatPageSafe >= uusimmatPageCount - 1}
                                onClick={() => setUusimmatPage(p => Math.min(uusimmatPageCount - 1, p + 1))}
                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                Seuraava
                              </button>
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveTab('report_list')}
                          className="w-full mt-2 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          Näytä kaikki raportit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
            </div>

            {/* Hälytykset koko leveydellä */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="text-rose-500" size={20} />
                  Aktiiviset Hälytykset ja Poikkeamat
                </h2>
                {/* Hälytykset syntyvät riskiluokan 3-5 riskiarvioista, joten "kaikki"
                    tarkoittaa tehtyjen riskiarvioiden listaa. Painike piilotetaan jos
                    hälytyksiä ei ole tai käyttäjällä ei ole oikeutta kohdesivulle —
                    muuten se veisi "Ei käyttöoikeutta" -sivulle. */}
                {riskAlerts.length > 0 && (isAdminUser || canView(perms, selectedEvent, 'documents_risk_done')) && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('documents_risk_done')}
                    className="text-sm text-indigo-600 font-medium hover:text-indigo-700"
                  >
                    {riskAlerts.length > HALYTYKSET_NAYTOSSA
                      ? `Näytä kaikki (${riskAlerts.length})`
                      : 'Näytä kaikki'}
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {riskAlerts.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Ei aktiivisia hälytyksiä. Riskiluokan 3-5 riskiarviot näkyvät täällä automaattisesti.</p>
                ) : (
                  riskAlerts.slice(0, HALYTYKSET_NAYTOSSA).map(alert => (
                    <AlertBanner key={alert.id} alert={alert} />
                  ))
                )}
                {riskAlerts.length > HALYTYKSET_NAYTOSSA && (
                  <p className="text-xs text-slate-500 pt-2 text-center">
                    Näytetään {HALYTYKSET_NAYTOSSA} vakavinta {riskAlerts.length} hälytyksestä.
                  </p>
                )}
              </div>
            </div>

            {/* Status board. Työjono eikä arkisto: järjestys on kiireellisyyden mukaan
                (eskaloitu ensin) eikä aikajärjestyksessä, ja suljetut ovat oletuksena
                piilossa. Kirjaus jolta puuttuu tila kokonaan on migroimatta jäänyt vanha
                tietue — se näkyy tässä ilman merkkiä, mikä on rehellisempää kuin arvata
                sille tila. */}
            {(() => {
              const TILAJARJESTYS: Record<string, number> = { escalated: 0, open: 1, in_progress: 2, closed: 4 };
              const rivit = deviationReports
                .filter(r => (boardTila === 'avoimet' ? r.status !== 'closed' : !boardTila || r.status === boardTila))
                .filter(r => !boardVakavuus || String(r.severity) === boardVakavuus)
                .filter(r => !boardVyohyke || r.zoneId === boardVyohyke)
                .filter(r => !boardTyyppi || r.typeId === boardTyyppi)
                .sort((a, b) =>
                  (TILAJARJESTYS[a.status] ?? 3) - (TILAJARJESTYS[b.status] ?? 3) ||
                  String(b.time || '').localeCompare(String(a.time || ''))
                );
              const suodattimet = [{ id: 'avoimet', nimi: 'Keskeneräiset' }, ...TILAT, { id: '', nimi: 'Kaikki' }];
              // Tyyppivalikko kootaan siitä mitä kirjauksia oikeasti on: kiinteä lista
              // näyttäisi tyyppejä joita tästä tapahtumasta ei ole yhtään.
              //
              // HUOM: tässä tiedostossa EI voi käyttää `new Map()`. Nimi `Map` on varattu
              // lucide-reactin karttaikonille (ks. importit), joka varjostaa globaalin
              // konstruktorin — `new Map()` kaataa koko näkymän virheeseen
              // "Map is not a constructor".
              const tyyppiNimet: Record<string, string> = {};
              for (const r of deviationReports) {
                if (r.typeId && !tyyppiNimet[r.typeId]) tyyppiNimet[r.typeId] = r.type;
              }
              const tyypit = Object.entries(tyyppiNimet)
                .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'fi'));
              return (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                  <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Clipboard className="text-indigo-500" size={20} />
                      Kirjausten tila
                    </h2>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {suodattimet.map(s => (
                        <button
                          key={s.id || 'kaikki'}
                          type="button"
                          onClick={() => setBoardTila(s.id)}
                          className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                            boardTila === s.id
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {s.nimi}
                        </button>
                      ))}
                      <select
                        value={boardVakavuus}
                        onChange={(e) => setBoardVakavuus(e.target.value)}
                        aria-label="Suodata vakavuuden mukaan"
                        className="rounded-md border border-slate-200 text-xs text-slate-600 py-1 pl-2 pr-6"
                      >
                        <option value="">Kaikki vakavuudet</option>
                        {[1, 2, 3, 4, 5].map(taso => (
                          <option key={taso} value={String(taso)}>{taso} — {VAKAVUUDET[taso].nimi}</option>
                        ))}
                      </select>
                      {tyypit.length > 1 && (
                        <select
                          value={boardTyyppi}
                          onChange={(e) => setBoardTyyppi(e.target.value)}
                          aria-label="Suodata kirjaustyypin mukaan"
                          className="rounded-md border border-slate-200 text-xs text-slate-600 py-1 pl-2 pr-6"
                        >
                          <option value="">Kaikki tyypit</option>
                          {tyypit.map(([id, nimi]) => (
                            <option key={id} value={id}>{nimi}</option>
                          ))}
                        </select>
                      )}
                      {nykyisenTapahtumanVyohykkeet.length > 0 && (
                        <select
                          value={boardVyohyke}
                          onChange={(e) => setBoardVyohyke(e.target.value)}
                          aria-label="Suodata vyöhykkeen mukaan"
                          className="rounded-md border border-slate-200 text-xs text-slate-600 py-1 pl-2 pr-6"
                        >
                          <option value="">Kaikki vyöhykkeet</option>
                          {nykyisenTapahtumanVyohykkeet.map(v => (
                            <option key={v.id} value={v.id}>{v.nimi}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {rivit.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">
                      {deviationReports.length === 0
                        ? 'Poikkeamakirjauksia ei ole vielä tehty.'
                        : 'Ei kirjauksia valituilla suodattimilla.'}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {rivit.map(rep => (
                        <button
                          key={rep.id}
                          type="button"
                          onClick={() => { setOpenedReport(rep); setOpenedReportSource('overview'); }}
                          className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border border-slate-100 border-l-4 hover:bg-slate-50 transition-colors ${
                            kirjauksenTila(rep.status)?.reuna || 'border-l-slate-200'
                          }`}
                        >
                          <span className="font-mono text-xs text-slate-400 pt-0.5 shrink-0">{rep.time || '—'}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-slate-800 text-sm">{rep.type}</span>
                            {rep.summary && <span className="block text-xs text-slate-500 truncate">{rep.summary}</span>}
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <VakavuusMerkki kirjaus={rep} />
                            <TilaMerkki kirjaus={rep} />
                            {onLukittu(rep) && <LukkoMerkki teksti="" />}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      case 'reporting':
        return (
          <div className="space-y-6 max-w-5xl">
            <div className="mb-6 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-500" size={28} />
                Raportointi ja lomakkeet
              </h2>
              <p className="text-sm text-slate-500 mt-1">Valitse täytettävä raportti tai tarkastele tallennettuja asiakirjoja.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* JV Card */}
              {(isAdminUser || canView(perms, selectedEvent, 'report_jv')) && (
                <button
                  onClick={() => setActiveTab('report_jv')}
                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">
                      <ShieldCheck size={24} />
                    </div>
                    <ChevronRight className="text-slate-400 group-hover:text-indigo-500 transition-colors" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Järjestyksenvalvojan tapahtumailmoitus</h3>
                  <p className="text-sm text-slate-500 line-clamp-2">Lakisääteinen ilmoitus kiinniotto- ja voimankäyttötilanteista (LYTP 33 §).</p>
                </button>
              )}

              {/* TIKE Card */}
              {(isAdminUser || canView(perms, selectedEvent, 'report_tike')) && (
                <button
                  onClick={() => setActiveTab('report_tike')}
                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">
                      <Activity size={24} />
                    </div>
                    <ChevronRight className="text-slate-400 group-hover:text-emerald-500 transition-colors" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">TIKE:n raportointi</h3>
                  <p className="text-sm text-slate-500 line-clamp-2">Tilannekeskuksen seuranta, kirjaukset ja laajemmat poikkeamaraportit.</p>
                </button>
              )}

              {/* Raportit Arkisto Card */}
              {(isAdminUser || canView(perms, selectedEvent, 'report_list')) && (
                <button
                  onClick={() => setActiveTab('report_list')}
                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <Archive size={24} />
                    </div>
                    <ChevronRight className="text-slate-400 group-hover:text-blue-500 transition-colors" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Tallennetut raportit</h3>
                  <p className="text-sm text-slate-500 line-clamp-2">Selaa, hae ja tarkastele kaikkia järjestelmään luotuja raportteja.</p>
                </button>
              )}
            </div>
          </div>
        );
      case 'report_list':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
             <TakaisinLinkki onClick={() => setActiveTab('reporting')}>
              Takaisin raportointivalikkoon
            </TakaisinLinkki>

            <div className="mb-6 flex justify-between items-end border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Archive className="text-blue-500" size={24} />
                  Tallennetut raportit
                </h2>
                <p className="text-sm text-slate-500 mt-1">Selaa ja tarkastele kaikkia tehtyjä kirjauksia ja ilmoituksia.</p>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  placeholder="Hae raporteista..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Tunniste</th>
                    <th className="p-4">Aika</th>
                    <th className="p-4">Tyyppi</th>
                    <th className="p-4">Kirjaaja</th>
                    <th className="p-4">Tiivistelmä</th>
                    <th className="p-4 text-right">Toiminnot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(() => {
                    const q = reportSearchQuery.trim().toLowerCase();
                    const filtered = q
                      ? currentEventReports.filter(rep =>
                          [rep.id, rep.type, rep.author, rep.summary]
                            .some(v => v && String(v).toLowerCase().includes(q))
                        )
                      : currentEventReports;

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                            {q ? `Ei hakua "${reportSearchQuery}" vastaavia raportteja.` : 'Ei vielä tallennettuja raportteja.'}
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((rep, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-white transition-colors cursor-pointer"
                        onClick={() => { setOpenedReport(rep); setOpenedReportSource('report_list'); }}
                      >
                        <td className="p-4 font-mono text-xs text-slate-500">{rep.id}</td>
                        <td className="p-4 font-medium text-slate-800">{rep.time}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700">
                            {rep.type}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600">{rep.author}</td>
                        <td className="p-4 text-slate-600 line-clamp-1 max-w-[200px]">{rep.summary}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenedReport(rep); setOpenedReportSource('report_list'); }}
                            className="text-blue-600 hover:text-blue-900 font-medium text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                          >
                            Avaa
                          </button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'report_jv':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <TakaisinLinkki onClick={() => setActiveTab('reporting')}>
              Takaisin raportointivalikkoon
            </TakaisinLinkki>
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-500" size={24} />
                Järjestyksenvalvojan tapahtumailmoitus
              </h2>
              <p className="text-sm text-slate-500 mt-1">LYTP:n mukainen lakisääteinen ilmoitus kiinniotto- ja voimankäyttötilanteista sekä ensihoidon käytöstä.</p>
            </div>
            
            <form className="space-y-8 text-left">
              {/* Osa 1: Perustiedot */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <h3 className="text-md font-semibold text-slate-700">1. Perustiedot</h3>
                  <button 
                    type="button" 
                    onClick={() => setShowInfoModal(true)}
                    className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg"
                  >
                    <Info size={16} />
                    Lain vaatimukset (LYTP)
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Järjestyksenvalvojan nimi</label>
                    <input
                      type="text"
                      value={jvrGuardName}
                      onChange={(e) => setJvrGuardName(e.target.value)}
                      className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="Etunimi Sukunimi"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Turvallisuusalan elinkeinoluvan haltija</label>
                    <input
                      type="text"
                      value={jvrLicenseHolder}
                      onChange={(e) => setJvrLicenseHolder(e.target.value)}
                      className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="Esim. Turva Oy"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tapahtuma-aika</label>
                    <div className="flex gap-2">
                      <input 
                        type="date" 
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                      />
                      <input 
                        type="time" 
                        ref={timeInputRef}
                        value={eventTimeStr}
                        onChange={(e) => setEventTimeStr(e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button 
                        type="button" 
                        onClick={handleTamaPvm}
                        className="px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                      >
                        Tämä pvm
                      </button>
                      <button 
                        type="button" 
                        onClick={handleNyt}
                        className="px-3 py-1 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors"
                      >
                        Nyt
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tapahtumapaikka</label>
                    <input
                      type="text"
                      value={jvrPlace}
                      onChange={(e) => setJvrPlace(e.target.value)}
                      className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="Esim. Main Stage, portti 2..."
                    />
                  </div>
                  <SijaintiValinta
                    karttaId={nykyisenTapahtumanKartta}
                    vyohykkeet={nykyisenTapahtumanVyohykkeet}
                    vyohyke={kirjausVyohyke}
                    onVyohyke={setKirjausVyohyke}
                    piste={kirjausPiste}
                    onPiste={setKirjausPiste}
                  />
                </div>
              </div>

              {/* Osa 2: Toimenpiteet */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">2. Toimenpiteet</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={jvrDetainedForce}
                      onChange={(e) => setJvrDetainedForce(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Otettu kiinni tai käytetty voimakeinoja</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={jvrTools}
                      onChange={(e) => setJvrTools(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Käytetty voimankäyttövälineitä (esim. käsiraudat, patukka, kaasu)</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={jvrFirearm}
                      onChange={(e) => setJvrFirearm(e.target.checked)}
                      className="w-5 h-5 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Otettu esille tai käytetty ampuma-asetta</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={jvrFirstAid}
                      onChange={(e) => setJvrFirstAid(e.target.checked)}
                      className="w-5 h-5 text-amber-500 rounded border-slate-300 focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Kohdehenkilö on viety ensiapuun tai ensihoitoa on käytetty tilanteessa</span>
                  </label>
                </div>
              </div>

              {/* Osa 3: Kohdehenkilö ja havainnot */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">3. Kohdehenkilö ja havainnot (Havaintotiedot)</h3>
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-3">
                    LYTP ja sen nojalla annettu asetus oikeuttavat kirjaamaan toimenpiteiden kohteena olleiden
                    sukunimen, etunimet, henkilötunnuksen ja osoitetiedot. Täytä vain ne tiedot jotka ovat
                    tiedossa ja tarpeen — kentät tallennetaan salattuna.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Kohdehenkilön sukunimi</label>
                      <input
                        type="text"
                        value={jvrLastName}
                        onChange={(e) => setJvrLastName(e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="Sukunimi"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Etunimet</label>
                      <input
                        type="text"
                        value={jvrFirstNames}
                        onChange={(e) => setJvrFirstNames(e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="Etunimet"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Henkilötunnus</label>
                      <input
                        type="text"
                        value={jvrPersonalId}
                        onChange={(e) => setJvrPersonalId(e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="ppkkvv-1234"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Osoitetiedot</label>
                      <input
                        type="text"
                        value={jvrAddress}
                        onChange={(e) => setJvrAddress(e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="Katuosoite, postinumero ja -toimipaikka"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kohdehenkilön tuntomerkit (tunnistamista varten)</label>
                    <textarea
                      rows="2"
                      value={jvrFeatures}
                      onChange={(e) => setJvrFeatures(e.target.value)}
                      className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="Pituus, vartalonrakenne, vaatetus, erityistuntomerkit..."
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Havainnot käyttäytymisestä ja tilasta</label>
                    <textarea
                      rows="2"
                      value={jvrObservations}
                      onChange={(e) => setJvrObservations(e.target.value)}
                      className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="Esim. aggressiivinen, sekava, vahvasti päihtynyt, yhteistyökykyinen..."
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Osa 4: Lisätiedot */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">4. Vapaa kuvaus ja lisätiedot</h3>
                <div>
                  <textarea
                    rows="4"
                    value={jvrDesc}
                    onChange={(e) => setJvrDesc(e.target.value)}
                    className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="Tarkempi kuvaus tilanteen kulusta, toimenpiteistä, ensihoidon antamista tiedoista yms..."
                  ></textarea>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClearJvReport}
                  className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Tyhjennä
                </button>
                {(isAdminUser || canEdit(perms, selectedEvent, 'report_jv')) && (
                  <button
                    type="button"
                    onClick={handleSaveJvReport}
                    className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <CheckCircle size={16} />
                    Tallenna ilmoitus
                  </button>
                )}
              </div>

              {/* TIKE-osio */}
              <div className="mt-10 bg-slate-50 border border-slate-200 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 border-b border-slate-200 pb-2">
                  TIKE:n muistilista (päivystäjälle)
                </h3>
                <ul className="space-y-1.5 mb-5 text-sm text-slate-600 list-disc list-inside">
                  <li>Onko TR käynyt paikalla?</li>
                  <li>Onko työntekijälle tullut vammoja?</li>
                  <li>Onko Turva 1 ja Turva 2 infottu asiasta?</li>
                  <li>Tarvitseeko tapahtumatuotannolle ilmoittaa?</li>
                </ul>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">TIKE:n kommentti:</label>
                  <textarea
                    rows="3"
                    value={jvrTikeComment}
                    onChange={(e) => setJvrTikeComment(e.target.value)}
                    className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                    placeholder="Kirjaa tilannekeskuksen toimenpiteet ja lisähuomiot..."
                  ></textarea>
                </div>
              </div>
            </form>
          </div>
        );
      case 'report_tike':
        const tikeOptions = [
          { id: 'in', label: 'Työntekijän sisäänkirjaus', icon: LogIn, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { id: 'out', label: 'Työntekijän uloskirjaus', icon: LogOut, color: 'text-rose-600', bg: 'bg-rose-50' },
          { id: 'jvaction', label: 'JV:n tai vartijan toimenpide', icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
          { id: 'open', label: 'Avoin kirjaus', icon: PenTool, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { id: 'firstaid', label: 'Ensiaputilanne', icon: HeartPulse, color: 'text-rose-600', bg: 'bg-rose-50' },
          { id: 'threat', label: 'Uhkatilanne', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
          { id: 'fence', label: 'Aitojen ylitys / luvaton sisäänpääsy', icon: ShieldAlert, color: 'text-orange-600', bg: 'bg-orange-50' },
          { id: 'damage', label: 'Omaisuusvaurio', icon: Wrench, color: 'text-slate-600', bg: 'bg-slate-100' },
          { id: 'lostfound', label: 'Löytötavara', icon: Package, color: 'text-slate-600', bg: 'bg-slate-100' },
          { id: 'patrol', label: 'Kierrosraportti', icon: Clipboard, color: 'text-blue-600', bg: 'bg-blue-50' },
          { id: 'queue', label: 'Portin jonon odotusaika', icon: Clock, color: 'text-slate-600', bg: 'bg-slate-100' },
          { id: 'weather', label: 'Sääraportti', icon: Cloud, color: 'text-sky-600', bg: 'bg-sky-50' },
          { id: 'briefing', label: 'Briefing', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { id: 'management', label: 'Johdon tilannekatsaus', icon: BarChart2, color: 'text-purple-600', bg: 'bg-purple-50' },
        ];

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <TakaisinLinkki onClick={() => setActiveTab('reporting')}>
              Takaisin raportointivalikkoon
            </TakaisinLinkki>
            
            <div className="mb-8 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Activity className="text-emerald-500" size={24} />
                TIKE raportointi
              </h2>
              <p className="text-sm text-slate-500 mt-1">Valitse uuden kirjauksen tai toimenpiteen tyyppi aloittaaksesi.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tikeOptions.filter((option) => isAdminUser || canView(perms, selectedEvent, `tike_form_${option.id}`)).map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setActiveTab(`tike_form_${option.id}`)}
                    className="flex flex-col items-start p-5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-left group bg-white"
                  >
                    <div className={`p-3 rounded-lg mb-4 transition-colors ${option.bg} ${option.color} group-hover:scale-110 transform duration-200`}>
                      <Icon size={24} />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 'tike_form_in': {
        // Kun muokataan olemassa olevaa riviä, luetaan sen tuoreimmat tiedot suoraan
        // checkedInEmployees-tilasta (ei jäädytetystä editingCheckIn-otoksesta), jotta
        // esim. juuri lisätty/poistettu kommentti näkyy heti listassa.
        const editingCheckInLive = editingCheckIn
          ? currentEventCheckedIn.find(e => e.id === editingCheckIn.id) || editingCheckIn
          : null;
        const empComments = editingCheckInLive ? getEmpComments(editingCheckInLive) : [];

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <TakaisinLinkki onClick={() => {
                if (editingCheckIn) {
                  resetCheckInForm();
                  setActiveTab('planning_employees');
                } else {
                  setActiveTab('report_tike');
                  setSelectedEmp('');
                  setEmpSearch('');
                }
              }}>
              {editingCheckIn ? 'Takaisin työntekijälistaan' : 'Takaisin TIKE-valikkoon'}
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <LogIn className="text-emerald-500" size={24} />
                  {editingCheckIn ? 'Muokkaa työntekijän kirjausta' : 'Työntekijän sisäänkirjaus'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {editingCheckIn ? 'Korjaa roolia, luovutettuja välineitä tai kirjausaikaa.' : 'Kirjaa työntekijä sisään ja merkitse luovutetut välineet.'}
                </p>
              </div>
            </div>

            {!editingCheckIn && (
            <>
            {/* Info Boxes / Työntekijätilanne */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">{jvCount}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">JV paikalla</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">{guardCount}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Vartijat</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">{firstAidStaffCount}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">EA henkilöt</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">{otherStaffCount}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Muu henkilöstö</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-amber-700">{deviationCount}</div>
                <div className="text-xs text-amber-600 font-medium uppercase tracking-wide mt-1">Poikkeamat</div>
              </div>
            </div>

            {/* Tapahtumaan merkityt työntekijät */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Users size={16} className="text-slate-400" />
                Tapahtumaan merkityt työntekijät ({currentEventCheckedIn.length})
              </h3>
              {currentEventCheckedIn.length === 0 ? (
                <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  Ei työntekijöitä merkitty tapahtumaan. Lisää heitä kohdassa Tapahtuman työntekijät &rarr; Lisää tapahtumaan työntekijä.
                </p>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-3">Nimi</th>
                        <th className="p-3">Rooli</th>
                        <th className="p-3">Tila</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {currentEventCheckedIn.map((emp) => {
                        const selectable = getEmpStatus(emp) !== 'checked_in';
                        return (
                          <tr
                            key={emp.id}
                            onClick={selectable ? () => { setSelectedEmp(emp.name); setEmpSearch(emp.name); } : undefined}
                            title={selectable ? 'Valitse sisäänkirjattavaksi' : 'On jo sisäänkirjattuna'}
                            className={`transition-colors ${selectable ? 'hover:bg-emerald-50 cursor-pointer' : 'opacity-60'}`}
                          >
                            <td className="p-3 font-medium text-slate-800">{emp.name}</td>
                            <td className="p-3 text-slate-600">{emp.role}</td>
                            <td className="p-3"><EmpStatusBadge emp={emp} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </>
            )}

            <form className="space-y-8 text-left">
              {editingCheckIn ? (
                /* Muokkaustilassa ei hakua — henkilö on jo tiedossa, näytetään nimi otsikkona. */
                <div className="flex items-center gap-2 pb-2">
                  <UserCheck size={20} className="text-indigo-500" />
                  <h3 className="text-lg font-bold text-slate-800">{editingCheckInLive?.name}</h3>
                </div>
              ) : (
                /* Haku */
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Työntekijän haku (Sukunimi Etunimi...)</label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={empSearch}
                        onChange={(e) => {
                          setEmpSearch(e.target.value);
                          setSelectedEmp('');
                        }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                        placeholder="Kirjoita vähintään 3 merkkiä hakeaksesi..."
                      />
                    </div>

                    {empSearch.length >= 3 && !selectedEmp && (
                      <ul className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-y-auto">
                        {filteredEmployees.length > 0 ? (
                          filteredEmployees.map((emp, idx) => (
                            <li
                              key={idx}
                              onClick={() => {
                                setSelectedEmp(emp);
                                setEmpSearch(emp);
                              }}
                              className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700 border-b border-slate-100 last:border-0"
                            >
                              {emp}
                            </li>
                          ))
                        ) : (
                          <li className="px-4 py-3 text-sm text-slate-500">Ei osumia työntekijärekisteristä.</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Kirjauslomake (näytetään vain kun työntekijä on valittu) */}
              {selectedEmp && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-8 border-t border-slate-200 pt-6">
                  
                  {/* Rooli ja Aika */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col justify-center">
                      <label className="block text-sm font-bold text-slate-700 mb-3">Työntekijän rooli</label>
                      <div className="flex gap-x-6 gap-y-2 flex-wrap">
                        {CHECKIN_ROLES.map((rooli) => (
                          <label key={rooli} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="role"
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                              checked={checkInRole === rooli}
                              onChange={() => setCheckInRole(rooli)}
                            />
                            <span className="text-sm font-medium text-slate-700">{rooli}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nimimerkki tässä tapahtumassa</label>
                        <input
                          type="text"
                          value={checkInNickname}
                          onChange={(e) => setCheckInNickname(e.target.value)}
                          placeholder="esim. Ensiapu 1"
                          className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                          Näkyy raporttien kirjaajana yhdessä tunnistenumeron kanssa.
                        </p>
                      </div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Sisäänkirjausaika</label>
                      <div className="flex gap-2">
                        <input 
                          type="date" 
                          value={checkInDate}
                          onChange={(e) => setCheckInDate(e.target.value)}
                          className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" 
                        />
                        <input 
                          type="time" 
                          value={checkInTime}
                          onChange={(e) => setCheckInTime(e.target.value)}
                          className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" 
                        />
                      </div>
                      <div className="mt-2">
                        <button 
                          type="button" 
                          onClick={handleCheckInNyt}
                          className="px-4 py-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md transition-colors"
                        >
                          Nyt
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Välineet */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2">Luovutetut välineet</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      
                      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-sm font-medium text-slate-700">JV / Vartijan liivi</span>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="vest" className="text-emerald-600 focus:ring-emerald-500" checked={checkInVest === true} onChange={() => setCheckInVest(true)} />
                            <span className="text-sm">Kyllä</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="vest" className="text-slate-600 focus:ring-slate-500" checked={checkInVest === false} onChange={() => setCheckInVest(false)} />
                            <span className="text-sm">Ei</span>
                          </label>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-1">JV yksilötunnus</label>
                        <input type="text" value={checkInBadge} onChange={(e) => setCheckInBadge(e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Esim. 1234" />
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="text-sm font-medium text-slate-700">Headset</span>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="headset" className="text-emerald-600 focus:ring-emerald-500" checked={checkInHeadset === true} onChange={() => setCheckInHeadset(true)} />
                            <span className="text-sm">Kyllä</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="headset" className="text-slate-600 focus:ring-slate-500" checked={checkInHeadset === false} onChange={() => setCheckInHeadset(false)} />
                            <span className="text-sm">Ei</span>
                          </label>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Radiopuhelimen nro</label>
                        <input type="text" value={checkInRadio} onChange={(e) => setCheckInRadio(e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Esim. R-12" />
                      </div>
                      
                    </div>
                  </div>

                  {/* Poikkeamakommentit */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex justify-between items-end">
                      <span>{editingCheckIn ? 'Kommentti' : 'Avoin poikkeamakommentti'}</span>
                      <span className="text-xs font-normal text-slate-500">Nämä kirjaukset näkyvät etusivun tilastoissa</span>
                    </h3>
                    <div>
                      <textarea
                        rows="3"
                        value={checkInComment}
                        onChange={(e) => setCheckInComment(e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="Esim. työntekijä joutuu lähtemään ennen työvuoron loppua, varustepuutteet tai muu huomionarvoinen asia..."
                      ></textarea>
                    </div>
                  </div>

                  {editingCheckIn && (
                    <div className="space-y-3">
                      <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                        <MessageSquare size={18} className="text-slate-400" />
                        Kommentit{empComments.length > 0 ? ` (${empComments.length})` : ''}
                      </h3>
                      {empComments.length === 0 ? (
                        <p className="text-sm text-slate-500">Ei vielä kommentteja.</p>
                      ) : (
                        <div className="space-y-2">
                          {empComments.map((c) => (
                            <div key={c.id} className="flex items-start justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                              <div className="min-w-0">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.text}</p>
                                <p className="text-xs text-slate-400 mt-1">{[c.author, c.date, c.time].filter(Boolean).join(' · ') || '—'}</p>
                              </div>
                              {(isAdminUser || canEdit(perms, selectedEvent, 'tike_form_in')) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEmpComment(c.id)}
                                  title="Poista kommentti"
                                  className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors shrink-0"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4 flex flex-wrap justify-end gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        if (editingCheckIn) {
                          resetCheckInForm();
                          setActiveTab('planning_employees');
                        } else {
                          resetCheckInForm();
                        }
                      }}
                      className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Peruuta
                    </button>
                    {(isAdminUser || canEdit(perms, selectedEvent, 'tike_form_in')) && (
                      <button
                        type="button"
                        onClick={handleSaveCheckIn}
                        className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <CheckCircle size={16} />
                        {editingCheckIn ? 'Tallenna muutokset' : 'Tallenna kirjaus'}
                      </button>
                    )}
                    {editingCheckIn && (isAdminUser || canEdit(perms, selectedEvent, 'tike_form_in')) && (
                      <>
                        <button
                          type="button"
                          disabled={!checkInComment.trim()}
                          onClick={handleSaveCommentAsReport}
                          className="px-5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                        >
                          <AlertTriangle size={16} />
                          Tallenna poikkeamaraporttina
                        </button>
                        <button
                          type="button"
                          disabled={!checkInComment.trim()}
                          onClick={handleAddEmpComment}
                          className="px-5 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Plus size={16} />
                          Tallenna kommentti
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        );
      }
      case 'tike_form_out':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <TakaisinLinkki onClick={() => { setActiveTab('report_tike'); setSelectedOutEmp(null); setOutEmpSearch(''); setShowOutTimeInput(false); setCheckOutComment(''); }}>
              Takaisin TIKE-valikkoon
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <LogOut className="text-rose-500" size={24} />
                  Työntekijän uloskirjaus
                </h2>
                <p className="text-sm text-slate-500 mt-1">Päätä työvuoro, palauta välineet ja kirjaa mahdolliset puutteet.</p>
              </div>
            </div>

            {/* Info Boxes / Työntekijätilanne */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">{jvCount}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">JV paikalla</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">{guardCount}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Vartijat</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">{firstAidStaffCount}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">EA henkilöt</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-slate-800">{otherStaffCount}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Muu henkilöstö</div>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-center flex flex-col justify-center">
                <div className="text-2xl font-bold text-amber-700">{deviationCount}</div>
                <div className="text-xs text-amber-600 font-medium uppercase tracking-wide mt-1">Poikkeamat</div>
              </div>
            </div>

            {/* Tapahtumaan merkityt työntekijät */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Users size={16} className="text-slate-400" />
                Tapahtumaan merkityt työntekijät ({currentEventCheckedIn.length})
              </h3>
              {currentEventCheckedIn.length === 0 ? (
                <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  Ei työntekijöitä merkitty tapahtumaan.
                </p>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-3">Nimi</th>
                        <th className="p-3">Rooli</th>
                        <th className="p-3">Tila</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {currentEventCheckedIn.map((emp) => {
                        const selectable = getEmpStatus(emp) === 'checked_in';
                        return (
                          <tr
                            key={emp.id}
                            onClick={selectable ? () => { setSelectedOutEmp(emp); setOutEmpSearch(emp.name); setShowOutTimeInput(false); setCheckOutComment(''); } : undefined}
                            title={selectable ? 'Valitse uloskirjattavaksi' : 'Ei ole sisäänkirjattuna'}
                            className={`transition-colors ${selectable ? 'hover:bg-rose-50 cursor-pointer' : 'opacity-60'}`}
                          >
                            <td className="p-3 font-medium text-slate-800">{emp.name}</td>
                            <td className="p-3 text-slate-600">{emp.role}</td>
                            <td className="p-3"><EmpStatusBadge emp={emp} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <form className="space-y-8 text-left">
              {/* Haku */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Hae sisäänkirjattu työntekijä</label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      value={outEmpSearch}
                      onChange={(e) => {
                        setOutEmpSearch(e.target.value);
                        setSelectedOutEmp(null);
                        setShowOutTimeInput(false);
                        setCheckOutComment('');
                      }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 text-sm font-medium" 
                      placeholder="Kirjoita vähintään 3 merkkiä hakeaksesi (esim. Kor tai Vir)..."
                    />
                  </div>
                  
                  {outEmpSearch.length >= 3 && !selectedOutEmp && (
                    <ul className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-y-auto">
                      {filteredOutEmployees.length > 0 ? (
                        filteredOutEmployees.map((emp) => (
                          <li 
                            key={emp.id} 
                            onClick={() => {
                              setSelectedOutEmp(emp);
                              setOutEmpSearch(emp.name);
                              setCheckOutComment('');
                            }}
                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700 border-b border-slate-100 last:border-0 flex justify-between items-center"
                          >
                            <span>{emp.name}</span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">{emp.role}</span>
                          </li>
                        ))
                      ) : (
                        <li className="px-4 py-3 text-sm text-slate-500">Ei osumia sisäänkirjatuista työntekijöistä.</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* Uloskirjauslomake (näytetään vain kun työntekijä on valittu) */}
              {selectedOutEmp && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-6 border-t border-slate-200 pt-6">
                  
                  {/* Yhteenveto sisäänkirjauksesta */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-200 pb-2">
                      Sisäänkirjauksen tiedot
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="block text-slate-500 text-xs mb-1">Rooli</span>
                        <span className="font-semibold text-slate-800">{selectedOutEmp.role}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500 text-xs mb-1">JV Yksilötunnus</span>
                        <span className="font-semibold text-slate-800">{selectedOutEmp.badge || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500 text-xs mb-1">Liivi luovutettu</span>
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          {selectedOutEmp.vest ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-rose-500"/>}
                          {selectedOutEmp.vest ? 'Kyllä' : 'Ei'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-500 text-xs mb-1">Radiopuhelin</span>
                        <span className="font-semibold text-slate-800">{selectedOutEmp.radio || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500 text-xs mb-1">Headset</span>
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          {selectedOutEmp.headset ? <CheckCircle size={14} className="text-emerald-500"/> : <XCircle size={14} className="text-rose-500"/>}
                          {selectedOutEmp.headset ? 'Kyllä' : 'Ei'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Uloskirjauksen kommentti */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Uloskirjauksen kommentit ja huomiot</label>
                    <textarea
                      rows="3"
                      value={checkOutComment}
                      onChange={(e) => setCheckOutComment(e.target.value)}
                      className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500"
                      placeholder="Kirjaa ylös jos välineitä on hajonnut, kadonnut, tai jos työntekijällä on jotain raportoitavaa vuoron päätteeksi..."
                    ></textarea>
                  </div>

                  {/* Toiminnot */}
                  <div className="pt-2">
                    {!(isAdminUser || canEdit(perms, selectedEvent, 'tike_form_out')) ? (
                      <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">Ei muokkausoikeutta tähän toimintoon.</p>
                    ) : !showOutTimeInput ? (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button 
                          type="button" 
                          onClick={handleCheckOut}
                          className="flex-1 py-3 px-4 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-sm"
                        >
                          <LogOut size={18} />
                          KIRJAA ULOS NYT
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setShowOutTimeInput(true)}
                          className="flex-1 py-3 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex justify-center items-center gap-2"
                        >
                          <Clock size={18} />
                          Kirjaa ulos muu aika
                        </button>
                      </div>
                    ) : (
                      <div className="bg-rose-50/50 p-5 rounded-xl border border-rose-100 animate-in fade-in slide-in-from-bottom-2">
                        <label className="block text-sm font-bold text-slate-800 mb-3">Valitse poikkeava uloskirjausaika</label>
                        <div className="flex gap-3 mb-5">
                          <input 
                            type="date" 
                            value={checkOutDate}
                            onChange={(e) => setCheckOutDate(e.target.value)}
                            className="flex-1 rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-rose-500 bg-white" 
                          />
                          <input 
                            type="time" 
                            value={checkOutTime}
                            onChange={(e) => setCheckOutTime(e.target.value)}
                            className="flex-1 rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-rose-500 bg-white" 
                          />
                        </div>
                        <div className="flex gap-3">
                          <button 
                            type="button" 
                            onClick={handleCheckOut}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm flex-1"
                          >
                            Tallenna uloskirjaus
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setShowOutTimeInput(false)}
                            className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                            Peruuta ajan valinta
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        );
      case 'tike_form_open':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <TakaisinLinkki onClick={() => setActiveTab('report_tike')}>
              Takaisin TIKE-valikkoon
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <PenTool className="text-indigo-500" size={24} />
                  Avoin kirjaus
                </h2>
                <p className="text-sm text-slate-500 mt-1">Vapaamuotoinen lokikirjaus poikkeamista tai toimenpiteistä.</p>
              </div>
              
              {/* Dynaaminen tunniste */}
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>
                <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                  {getDynamicId()}
                </div>
              </div>
            </div>

            <form className="space-y-6 text-left">
              
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtuma-aika</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                      type="date" 
                      value={openKirjausDate}
                      onChange={(e) => setOpenKirjausDate(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                    />
                    <input 
                      type="time" 
                      value={openKirjausTime}
                      onChange={(e) => setOpenKirjausTime(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={handleOpenKirjausNyt}
                    className="px-4 py-2 text-xs font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg transition-colors shadow-sm"
                  >
                    NYT
                  </button>
                </div>
              </div>

              <SijaintiValinta
                karttaId={nykyisenTapahtumanKartta}
                vyohykkeet={nykyisenTapahtumanVyohykkeet}
                vyohyke={kirjausVyohyke}
                onVyohyke={setKirjausVyohyke}
                piste={kirjausPiste}
                onPiste={setKirjausPiste}
              />

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Kuvaus tapahtuneesta</label>
                <textarea
                  rows="6"
                  value={openKirjausText}
                  onChange={(e) => setOpenKirjausText(e.target.value)}
                  className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-indigo-500" 
                  placeholder="Kirjoita tarkka ja ytimekäs kuvaus tilanteesta ja tehdyistä toimenpiteistä..."
                ></textarea>
              </div>

              {/* Tehtäväksi merkintä. Otsikko ja kiireellisyys näytetään vasta kun
                  ruutu on rastittu, jottei lomake kasva turhaan tavallisessa kirjauksessa. */}
              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openKirjausTask}
                    onChange={(e) => setOpenKirjausTask(e.target.checked)}
                    className="w-5 h-5 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-800">Merkitse tehtäväksi</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Kirjaus nousee Tilannekuvan Tehtävät-listaan, jossa se pysyy näkyvissä
                      kiireellisyysjärjestyksessä ja näyttää kuinka kauan sitten se luotiin.
                    </span>
                  </span>
                </label>

                {openKirjausTask && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Tehtävän otsikko</label>
                      <input
                        type="text"
                        value={openKirjausTaskTitle}
                        onChange={(e) => setOpenKirjausTaskTitle(e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="Lyhyt kuvaus siitä mitä pitää tehdä, esim. 'Vaihda portin 2 kortinlukija'"
                      />
                      <p className="text-xs text-slate-500 mt-1">Tämä teksti näkyy Tehtävät-listassa.</p>
                    </div>

                    <div>
                      <span className="block text-sm font-bold text-slate-700 mb-2">Kiireellisyys</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {Object.entries(TEHTAVA_KIIREET).map(([avain, kiire]) => {
                          const valittu = openKirjausTaskUrgency === avain;
                          return (
                            <label
                              key={avain}
                              className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                                valittu ? `${kiire.reuna} ring-2 ring-offset-1 ring-slate-300` : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="tehtavan-kiireellisyys"
                                checked={valittu}
                                onChange={() => setOpenKirjausTaskUrgency(avain as TehtavaKiire)}
                                className="sr-only"
                              />
                              <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${kiire.piste}`} />
                              <span className={`text-sm font-medium ${valittu ? kiire.teksti : 'text-slate-700'}`}>
                                {kiire.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3">
                <div className="flex gap-4">
                  {/* Mobiilikamera-painike (capture="environment") */}
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-indigo-300 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Camera size={18} className="text-indigo-500" />
                    Ota kuva
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={(e) => uploadAttachment(e.target.files[0], setFileName, setFileUploadId, setFileUploading)}
                    />
                  </label>

                  {/* Tiedoston valinta */}
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-indigo-300 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Paperclip size={18} className="text-indigo-500" />
                    Liitä tiedosto
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => uploadAttachment(e.target.files[0], setFileName, setFileUploadId, setFileUploading)}
                    />
                  </label>
                </div>
                {fileName && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border mt-2 ${fileUploading ? 'text-slate-500 bg-slate-50 border-slate-200' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
                    <FileCheck size={16} />
                    {fileUploading ? `Lähetetään: ${fileName}…` : `Liitetty: ${fileName}`}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => {
                    setActiveTab('report_tike');
                    setOpenKirjausText('');
                    setFileName('');
                    setFileUploadId('');
                  }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                {(isAdminUser || canEdit(perms, selectedEvent, 'tike_form_open')) && (
                  <button
                    type="button"
                    onClick={handleSaveOpenKirjaus}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <CheckCircle size={18} />
                    Tallenna kirjaus
                  </button>
                )}
              </div>
            </form>
          </div>
        );
      case 'tike_form_firstaid':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <TakaisinLinkki onClick={() => setActiveTab('report_tike')}>
              Takaisin TIKE-valikkoon
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <HeartPulse className="text-rose-500" size={24} />
                  Ensiaputilanne
                </h2>
                <p className="text-sm text-slate-500 mt-1">Kirjaa ensiapua vaatineet tapahtumat ja resurssien käyttö.</p>
              </div>
              
              {/* Dynaaminen tunniste */}
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>
                <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                  {getDynamicId()}
                </div>
              </div>
            </div>

            <form className="space-y-6 text-left">
              
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtuma-aika</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                      type="date" 
                      value={faDate}
                      onChange={(e) => setFaDate(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-rose-500" 
                    />
                    <input 
                      type="time" 
                      value={faTime}
                      onChange={(e) => setFaTime(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-rose-500" 
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={handleFaNyt}
                    className="px-4 py-2 text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg transition-colors shadow-sm"
                  >
                    NYT
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <SijaintiValinta
                  karttaId={nykyisenTapahtumanKartta}
                  vyohykkeet={nykyisenTapahtumanVyohykkeet}
                  vyohyke={kirjausVyohyke}
                  onVyohyke={setKirjausVyohyke}
                  piste={kirjausPiste}
                  onPiste={setKirjausPiste}
                  focusRing="focus:ring-rose-500"
                />

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tapahtuman kuvaus</label>
                  <textarea
                    rows="3"
                    value={faDesc}
                    onChange={(e) => setFaDesc(e.target.value)}
                    className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 
                    placeholder="Mitä tapahtui? Potilaan tila ja oireet..."
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tehdyt toimenpiteet</label>
                  <textarea 
                    rows="3" 
                    value={faActions}
                    onChange={(e) => setFaActions(e.target.value)}
                    className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 
                    placeholder="Mitä toimenpiteitä tehtiin? (esim. haavan puhdistus, sidonta, ohjaus jatkohoitoon)"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Mitä resursseja kului</label>
                    <textarea 
                      rows="2" 
                      value={faResources}
                      onChange={(e) => setFaResources(e.target.value)}
                      className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 
                      placeholder="Esim. ensihoitotarvikkeet, lanssin tilaus..."
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Mitkä työntekijät paikalla olivat</label>
                    <textarea 
                      rows="2" 
                      value={faEmployees}
                      onChange={(e) => setFaEmployees(e.target.value)}
                      className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-rose-500" 
                      placeholder="Nimet / kutsumanimet"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3">
                <div className="flex gap-4">
                  {/* Mobiilikamera-painike */}
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-rose-300 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Camera size={18} className="text-rose-500" />
                    Ota kuva
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={(e) => uploadAttachment(e.target.files[0], setFaFileName, setFaFileUploadId, setFaFileUploading)}
                    />
                  </label>

                  {/* Tiedoston valinta */}
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-rose-300 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Paperclip size={18} className="text-rose-500" />
                    Liitä tiedosto
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => uploadAttachment(e.target.files[0], setFaFileName, setFaFileUploadId, setFaFileUploading)}
                    />
                  </label>
                </div>
                {faFileName && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border mt-2 ${faFileUploading ? 'text-slate-500 bg-slate-50 border-slate-200' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
                    <FileCheck size={16} />
                    {faFileUploading ? `Lähetetään: ${faFileName}…` : `Liitetty: ${faFileName}`}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => {
                    setActiveTab('report_tike');
                    setFaDesc(''); setFaActions(''); setFaResources(''); setFaEmployees('');
                    setFaFileName(''); setFaFileUploadId('');
                  }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                {(isAdminUser || canEdit(perms, selectedEvent, 'tike_form_firstaid')) && (
                  <button
                    type="button"
                    onClick={handleSaveFirstAid}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <CheckCircle size={18} />
                    Tallenna EA-kirjaus
                  </button>
                )}
              </div>
            </form>
          </div>
        );
      case 'tike_form_jvaction': {
        const jvaTooling = ['Käsiraudat', 'Teleskooppipatukka', 'Patukka', 'Kaasusumutin', 'Sidontaväline', 'Muu'];
        const jvaSelectedCount = [jvaDenied, jvaRemoved, jvaDetained].filter(Boolean).length;
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <TakaisinLinkki onClick={() => setActiveTab('report_tike')}>
              Takaisin TIKE-valikkoon
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="text-amber-500" size={24} />
                  Järjestyksenvalvojan tai vartijan toimenpide
                </h2>
                <p className="text-sm text-slate-500 mt-1">TIKE:n oma kirjanpito ja tapahtumien seuranta.</p>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>
                <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                  {getDynamicId()}
                </div>
              </div>
            </div>

            {/* Huomautus vastuunjaosta */}
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-amber-900">
                <span className="font-bold">Tämä ei korvaa tapahtumailmoitusta.</span> TIKE täyttää tämän lomakkeen omaa
                kirjanpitoa ja tapahtumien seurantaa varten. Toimenpiteen suorittanut järjestyksenvalvoja tai vartija
                täyttää lisäksi itse oman tapahtumailmoituksensa. Voimakeinojen, voimankäyttövälineiden ja ampuma-aseen
                käyttöön liittyy erillinen ilmoitusvelvollisuus, jonka menettely tarkistetaan toimeksiantajan ja
                toimeksisaajan ohjeista.
              </div>
            </div>

            <form className="space-y-6 text-left">

              {/* Rooli */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-3">Toimenpiteen suorittajan rooli</label>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="jvaRole"
                      className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                      checked={jvaRole === 'Järjestyksenvalvoja'}
                      onChange={() => { setJvaRole('Järjestyksenvalvoja'); setJvaName(''); setJvaSearch(''); }}
                    />
                    <span className="text-sm font-medium text-slate-700">Järjestyksenvalvoja</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="jvaRole"
                      className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                      checked={jvaRole === 'Vartija'}
                      onChange={() => { setJvaRole('Vartija'); setJvaName(''); setJvaSearch(''); }}
                    />
                    <span className="text-sm font-medium text-slate-700">Vartija</span>
                  </label>
                </div>
              </div>

              {/* Nimi ja paikka */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    {jvaRole === 'Vartija' ? 'Vartijan nimi' : 'Järjestyksenvalvojan nimi'}
                  </label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={jvaSearch}
                        onChange={(e) => { setJvaSearch(e.target.value); setJvaName(''); }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 text-sm font-medium"
                        placeholder="Kirjoita vähintään 3 merkkiä..."
                      />
                    </div>
                    {jvaSearch.length >= 3 && !jvaName && (
                      <ul className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg w-full mt-1 max-h-60 overflow-y-auto">
                        {jvaNameOptions.length > 0 ? (
                          jvaNameOptions.map((name, idx) => (
                            <li
                              key={idx}
                              onClick={() => { setJvaName(name); setJvaSearch(name); }}
                              className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700 border-b border-slate-100 last:border-0"
                            >
                              {name}
                              {currentEventCheckedIn.some(c => c.name === name && getEmpStatus(c) === 'checked_in') && (
                                <span className="ml-2 text-xs text-emerald-600 font-bold">sisäänkirjattu</span>
                              )}
                            </li>
                          ))
                        ) : (
                          <li
                            onClick={() => setJvaName(jvaSearch)}
                            className="px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            Ei osumia. Käytä kirjoitettua nimeä.
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  {jvaName && (
                    <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                      <CheckCircle size={14} />
                      Valittu: {jvaName}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtumapaikka</label>
                  <input
                    type="text"
                    value={jvaLocation}
                    onChange={(e) => setJvaLocation(e.target.value)}
                    className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-amber-500"
                    placeholder="Esim. Portti 2, Main Stage etualue, VIP-alue"
                  />
                </div>

                <SijaintiValinta
                  karttaId={nykyisenTapahtumanKartta}
                  vyohykkeet={nykyisenTapahtumanVyohykkeet}
                  vyohyke={kirjausVyohyke}
                  onVyohyke={setKirjausVyohyke}
                  piste={kirjausPiste}
                  onPiste={setKirjausPiste}
                  focusRing="focus:ring-amber-500"
                />
              </div>

              {/* Aika */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtuma-aika</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input
                      type="date"
                      value={jvaDate}
                      onChange={(e) => setJvaDate(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-amber-500"
                    />
                    <input
                      type="time"
                      value={jvaTime}
                      onChange={(e) => setJvaTime(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleJvaNyt}
                    className="px-4 py-2 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors shadow-sm"
                  >
                    NYT
                  </button>
                </div>
              </div>

              {/* Toimenpiteet */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex justify-between items-end">
                  <span>Suoritetut toimenpiteet</span>
                  <span className="text-xs font-normal text-slate-500">Valittuna {jvaSelectedCount}</span>
                </h3>

                <div className="space-y-3">
                  <div className={`p-4 rounded-lg border transition-colors ${jvaDenied ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={jvaDenied}
                          onChange={(e) => { setJvaDenied(e.target.checked); if (!e.target.checked) setJvaDeniedCount(''); }}
                          className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-800">Estetty pääsy</span>
                      </label>
                      {jvaDenied && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Henkilöä</span>
                          <input
                            type="number"
                            min="1"
                            value={jvaDeniedCount}
                            onChange={(e) => setJvaDeniedCount(e.target.value)}
                            className="w-20 rounded-lg border-slate-300 border p-1.5 text-sm focus:ring-2 focus:ring-amber-500"
                            placeholder="1"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border transition-colors ${jvaRemoved ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={jvaRemoved}
                          onChange={(e) => { setJvaRemoved(e.target.checked); if (!e.target.checked) setJvaRemovedCount(''); }}
                          className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-800">Poistettu henkilö</span>
                      </label>
                      {jvaRemoved && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Henkilöä</span>
                          <input
                            type="number"
                            min="1"
                            value={jvaRemovedCount}
                            onChange={(e) => setJvaRemovedCount(e.target.value)}
                            className="w-20 rounded-lg border-slate-300 border p-1.5 text-sm focus:ring-2 focus:ring-amber-500"
                            placeholder="1"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border transition-colors ${jvaDetained ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={jvaDetained}
                          onChange={(e) => { setJvaDetained(e.target.checked); if (!e.target.checked) setJvaDetainedCount(''); }}
                          className="w-5 h-5 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-800">Otettu henkilö kiinni</span>
                      </label>
                      {jvaDetained && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Henkilöä</span>
                          <input
                            type="number"
                            min="1"
                            value={jvaDetainedCount}
                            onChange={(e) => setJvaDetainedCount(e.target.value)}
                            className="w-20 rounded-lg border-slate-300 border p-1.5 text-sm focus:ring-2 focus:ring-rose-500"
                            placeholder="1"
                          />
                        </div>
                      )}
                    </div>
                    {jvaDetained && (
                      <p className="text-xs text-rose-700 mt-3 pl-8">
                        Kiinniotetusta on ilmoitettava viipymättä poliisille. Kirjaa poliisin toimenpiteet vapaaseen kuvaukseen.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Voimankäyttö */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">Voimankäyttö</h3>

                <div className={`p-4 rounded-lg border transition-colors ${jvaForce ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jvaForce}
                      onChange={(e) => setJvaForce(e.target.checked)}
                      className="w-5 h-5 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-800">Käytetty voimakeinoja</span>
                  </label>
                </div>

                <div className={`p-4 rounded-lg border transition-colors ${jvaTools ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jvaTools}
                      onChange={(e) => { setJvaTools(e.target.checked); if (!e.target.checked) { setJvaToolList([]); setJvaToolOther(''); } }}
                      className="w-5 h-5 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-800">Käytetty voimankäyttövälineitä</span>
                  </label>

                  {jvaTools && (
                    <div className="mt-4 pl-8 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <span className="block text-xs font-bold text-slate-600 uppercase tracking-wide">Mitä välineitä käytettiin</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {jvaTooling.map((tool) => (
                          <label key={tool} className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-rose-300 transition-colors">
                            <input
                              type="checkbox"
                              checked={jvaToolList.includes(tool)}
                              onChange={() => toggleJvaTool(tool)}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                            />
                            <span className="text-sm text-slate-700">{tool}</span>
                          </label>
                        ))}
                      </div>
                      {jvaToolList.includes('Muu') && (
                        <input
                          type="text"
                          value={jvaToolOther}
                          onChange={(e) => setJvaToolOther(e.target.value)}
                          className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-rose-500"
                          placeholder="Tarkenna muu väline"
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className={`p-4 rounded-lg border transition-colors ${jvaFirearm ? 'bg-rose-100 border-rose-300' : 'bg-slate-50 border-slate-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jvaFirearm}
                      onChange={(e) => setJvaFirearm(e.target.checked)}
                      className="w-5 h-5 rounded text-rose-700 focus:ring-rose-600 border-slate-300"
                    />
                    <span className="text-sm font-bold text-slate-900">Otettu esille tai käytetty ampuma-asetta</span>
                  </label>
                  {jvaFirearm && (
                    <div className="mt-3 pl-8 flex gap-2 text-xs text-rose-800 bg-white/70 border border-rose-200 rounded-lg p-3">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <span>
                        Ilmoita välittömästi turvallisuuspäällikölle ja hätäkeskukseen. Ampuma-aseen esille ottaminen ja
                        käyttö edellyttävät erillistä selvitystä ja poliisille tehtävää ilmoitusta.
                      </span>
                    </div>
                  )}
                </div>

                <div className={`p-4 rounded-lg border transition-colors ${jvaFirstAid ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={jvaFirstAid}
                      onChange={(e) => setJvaFirstAid(e.target.checked)}
                      className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-800">Kohdehenkilö viety ensiapuun tai ensihoitoa käytetty</span>
                  </label>
                  {jvaFirstAid && (
                    <p className="text-xs text-emerald-800 mt-3 pl-8">
                      Tee lisäksi erillinen ensiaputilanteen kirjaus TIKE-valikosta.
                    </p>
                  )}
                </div>
              </div>

              {/* Vapaa kuvaus */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Vapaa kuvaus tapahtumasta</label>
                <textarea
                  rows="5"
                  value={jvaDesc}
                  onChange={(e) => setJvaDesc(e.target.value)}
                  className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-amber-500"
                  placeholder="Kuvaa tapahtuman kulku aikajärjestyksessä: mitä havaittiin, mitä tehtiin, miten tilanne päättyi ja ketkä osallistuivat."
                ></textarea>
                <p className="text-xs text-slate-500 mt-1">
                  Kirjaa vain seurannan kannalta tarpeelliset tiedot. Kohdehenkilöiden henkilötiedot kirjataan tapahtumailmoitukseen.
                </p>
              </div>

              {/* Kuittaus tapahtumailmoituksesta */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={jvaReporterFiled}
                    onChange={(e) => setJvaReporterFiled(e.target.checked)}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mt-0.5"
                  />
                  <span className="text-sm text-indigo-900">
                    Toimenpiteen suorittaja on ilmoittanut täyttäneensä oman tapahtumailmoituksensa
                  </span>
                </label>
                {!jvaReporterFiled && (jvaDetained || jvaForce || jvaTools || jvaFirearm) && (
                  <p className="text-xs text-indigo-700 mt-2 pl-8">
                    Muistuta toimenpiteen suorittajaa tapahtumailmoituksesta ennen vuoron päättymistä.
                  </p>
                )}
              </div>

              {/* Toiminnot */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { resetJvaForm(); setActiveTab('report_tike'); }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                {(isAdminUser || canEdit(perms, selectedEvent, 'tike_form_jvaction')) && (
                  <button
                    type="button"
                    onClick={handleSaveJvaReport}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <CheckCircle size={18} />
                    Tallenna toimenpidekirjaus
                  </button>
                )}
              </div>
            </form>
          </div>
        );
      }
      case 'tike_form_fence':
      case 'tike_form_patrol':
      case 'tike_form_briefing':
      case 'tike_form_management':
      case 'tike_form_threat':
      case 'tike_form_damage':
      case 'tike_form_lostfound':
      case 'tike_form_queue':
      case 'tike_form_weather': {
        const genericForms = {
          tike_form_threat: { title: 'Uhkatilanne', icon: AlertTriangle, iconColor: 'text-amber-500', btnBg: 'bg-amber-600 hover:bg-amber-700', nytBg: 'bg-amber-100 hover:bg-amber-200 text-amber-800', focusRing: 'focus:ring-amber-500', desc: 'Kirjaa havaitut uhkatilanteet ja niihin liittyvät toimenpiteet.' },
          tike_form_damage: { title: 'Omaisuusvaurio', icon: Wrench, iconColor: 'text-slate-600', btnBg: 'bg-slate-600 hover:bg-slate-700', nytBg: 'bg-slate-200 hover:bg-slate-300 text-slate-800', focusRing: 'focus:ring-slate-500', desc: 'Kirjaa alueella tapahtuneet omaisuusvauriot ja rikkoutumiset.' },
          tike_form_lostfound: { title: 'Löytötavara', icon: Package, iconColor: 'text-indigo-500', btnBg: 'bg-indigo-600 hover:bg-indigo-700', nytBg: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800', focusRing: 'focus:ring-indigo-500', desc: 'Kirjaa vastaanotetut tai toimitetut löytötavarat.' },
          tike_form_queue: { title: 'Portin jonon odotusaika', icon: Clock, iconColor: 'text-blue-500', btnBg: 'bg-blue-600 hover:bg-blue-700', nytBg: 'bg-blue-100 hover:bg-blue-200 text-blue-800', focusRing: 'focus:ring-blue-500', desc: 'Kirjaa porttien jonotilanne ja odotusajat.' },
          tike_form_weather: { title: 'Sääraportti', icon: Cloud, iconColor: 'text-sky-500', btnBg: 'bg-sky-600 hover:bg-sky-700', nytBg: 'bg-sky-100 hover:bg-sky-200 text-sky-800', focusRing: 'focus:ring-sky-500', desc: 'Kirjaa sääolosuhteiden muutokset ja varautumistoimenpiteet.' },
          tike_form_fence: { title: 'Aitojen ylitys / luvaton sisäänpääsy', icon: ShieldAlert, iconColor: 'text-orange-500', btnBg: 'bg-orange-600 hover:bg-orange-700', nytBg: 'bg-orange-100 hover:bg-orange-200 text-orange-800', focusRing: 'focus:ring-orange-500', desc: 'Kirjaa aidan ylitykset ja muu luvaton sisäänpääsy alueelle.' },
          tike_form_patrol: { title: 'Kierrosraportti', icon: Clipboard, iconColor: 'text-blue-500', btnBg: 'bg-blue-600 hover:bg-blue-700', nytBg: 'bg-blue-100 hover:bg-blue-200 text-blue-800', focusRing: 'focus:ring-blue-500', desc: 'Kirjaa kierroksella tehdyt havainnot ja toimenpiteet.' },
          tike_form_briefing: { title: 'Briefing', icon: Users, iconColor: 'text-indigo-500', btnBg: 'bg-indigo-600 hover:bg-indigo-700', nytBg: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800', focusRing: 'focus:ring-indigo-500', desc: 'Kirjaa vuoron briefingin sisältö ja läsnäolijat.' },
          tike_form_management: { title: 'Johdon tilannekatsaus', icon: BarChart2, iconColor: 'text-purple-500', btnBg: 'bg-purple-600 hover:bg-purple-700', nytBg: 'bg-purple-100 hover:bg-purple-200 text-purple-800', focusRing: 'focus:ring-purple-500', desc: 'Kirjaa johdolle annettu tilannekatsaus ja siinä tehdyt linjaukset.' },
        };
        
        const config = genericForms[activeTab];
        const Icon = config.icon;

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <TakaisinLinkki onClick={() => {
                setActiveTab('report_tike');
                setGenRepDate(''); setGenRepTime(''); setGenRepDesc(''); setGenRepActions(''); setGenRepEmps('');
                setGenRepFile(''); setGenRepFileUploadId('');
              }}>
              Takaisin TIKE-valikkoon
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Icon className={config.iconColor} size={24} />
                  {config.title}
                </h2>
                <p className="text-sm text-slate-500 mt-1">{config.desc}</p>
              </div>
              
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>
                <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                  {getDynamicId()}
                </div>
              </div>
            </div>

            <form className="space-y-6 text-left">
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tapahtuma-aika</label>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                      type="date" 
                      value={genRepDate}
                      onChange={(e) => setGenRepDate(e.target.value)}
                      className={`w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm ${config.focusRing}`}
                    />
                    <input 
                      type="time" 
                      value={genRepTime}
                      onChange={(e) => setGenRepTime(e.target.value)}
                      className={`w-full sm:w-auto rounded-lg border-slate-300 border p-2 text-sm ${config.focusRing}`}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={handleGenRepNyt}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${config.nytBg}`}
                  >
                    NYT
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <SijaintiValinta
                  karttaId={nykyisenTapahtumanKartta}
                  vyohykkeet={nykyisenTapahtumanVyohykkeet}
                  vyohyke={kirjausVyohyke}
                  onVyohyke={setKirjausVyohyke}
                  piste={kirjausPiste}
                  onPiste={setKirjausPiste}
                  focusRing={config.focusRing}
                />

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tapahtuman kuvaus</label>
                  <textarea
                    rows="3"
                    value={genRepDesc}
                    onChange={(e) => setGenRepDesc(e.target.value)}
                    className={`w-full rounded-lg border-slate-300 border p-3 text-sm ${config.focusRing}`}
                    placeholder="Mitä havaittiin tai tapahtui..."
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tehdyt toimenpiteet</label>
                  <textarea 
                    rows="3" 
                    value={genRepActions}
                    onChange={(e) => setGenRepActions(e.target.value)}
                    className={`w-full rounded-lg border-slate-300 border p-3 text-sm ${config.focusRing}`}
                    placeholder="Miten tilanteeseen reagoitiin, kenelle ilmoitettu..."
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Mitkä työntekijät paikalla olivat</label>
                  <textarea 
                    rows="2" 
                    value={genRepEmps}
                    onChange={(e) => setGenRepEmps(e.target.value)}
                    className={`w-full rounded-lg border-slate-300 border p-3 text-sm ${config.focusRing}`}
                    placeholder="Paikalla olleiden työntekijöiden nimet tai kutsutunnukset..."
                  ></textarea>
                </div>
              </div>

              <div className="border border-dashed border-slate-300 rounded-xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3">
                <div className="flex gap-4">
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Camera size={18} className={config.iconColor} />
                    Ota kuva
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={(e) => uploadAttachment(e.target.files[0], setGenRepFile, setGenRepFileUploadId, setGenRepFileUploading)}
                    />
                  </label>

                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Paperclip size={18} className={config.iconColor} />
                    Liitä tiedosto
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => uploadAttachment(e.target.files[0], setGenRepFile, setGenRepFileUploadId, setGenRepFileUploading)}
                    />
                  </label>
                </div>
                {genRepFile && (
                  <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border mt-2 ${genRepFileUploading ? 'text-slate-500 bg-slate-50 border-slate-200' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
                    <FileCheck size={16} />
                    {genRepFileUploading ? `Lähetetään: ${genRepFile}…` : `Liitetty: ${genRepFile}`}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => {
                    setActiveTab('report_tike');
                    setGenRepDate(''); setGenRepTime(''); setGenRepDesc(''); setGenRepActions(''); setGenRepEmps('');
                    setGenRepFile(''); setGenRepFileUploadId('');
                  }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                {(isAdminUser || canEdit(perms, selectedEvent, activeTab)) && (
                  <button
                    type="button"
                    onClick={() => handleSaveGenericReport(activeTab.replace('tike_form_', ''), config.title)}
                    className={`px-5 py-2.5 text-sm font-bold text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm ${config.btnBg}`}
                  >
                    <CheckCircle size={18} />
                    Tallenna kirjaus
                  </button>
                )}
              </div>
            </form>
          </div>
        );
      }
      case 'planning':
        return (
          <div className="space-y-6 max-w-5xl">
            {/* Status Banner + avauksen koonti */}
            <div className={`rounded-xl border shadow-sm ${readinessStatusColor}`}>
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 bg-white rounded-lg ${readinessStatusIconColor} shadow-sm`}>
                    <DoorOpen size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">Avausvalmius</h3>
                    <p className="text-sm font-medium">{readinessStatusText}</p>
                  </div>
                </div>
                <div className="text-3xl font-black tabular-nums tracking-tighter shrink-0">
                  {completedChecksCount}/{READINESS_CHECKS.length}
                </div>
              </div>

              <div className="border-t border-current/10 bg-white/50 px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">Tapahtuma alkaa</div>
                  <div className="text-sm font-bold tabular-nums mt-0.5">
                    {suunniteltuAvausPvm ? formatFiDate(suunniteltuAvausPvm) : 'Ei asetettu'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">Portit auki (suunniteltu)</div>
                  <div className="text-sm font-bold tabular-nums mt-0.5">
                    {suunniteltuAvausKlo || 'Ei asetettu'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">Tavoiteltu avaus</div>
                  <div className="text-sm font-bold tabular-nums mt-0.5">
                    {tavoiteAvausHetki
                      ? `${formatFiDate(tavoiteAvausPvm)} klo ${tavoiteAvausKlo}`
                      : 'Ei asetettu'}
                  </div>
                </div>
              </div>

              {/* Laskuri porttien avaushetkeen. currentTime päivittyy sekunnin välein
                  (ks. useEffect ylhäällä), joten tämä juoksee ilman omaa ajastinta. */}
              <div className="border-t border-current/10 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock size={16} className="opacity-70" />
                  {avaukseenMs === null
                    ? 'Aseta tavoiteltu avausaika, niin laskuri käynnistyy.'
                    : avaukseenMs >= 0
                      ? 'Porttien avaukseen'
                      : 'Tavoiteajasta kulunut'}
                </div>
                {avaukseenMs !== null && (
                  <div className="text-2xl font-black tabular-nums tracking-tight">
                    {avaukseenMs < 0 ? '+' : ''}{muotoileLaskuri(avaukseenMs)}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-indigo-500" size={28} />
                Ennen tapahtumaa
              </h2>
              <p className="text-sm text-slate-500 mt-1">Suunnittelu, varautuminen ja henkilöstöhallinto.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Avausvalmius Card */}
              <button
                onClick={() => setActiveTab('planning_readiness')}
                className={`bg-white p-6 rounded-xl border shadow-sm transition-all text-left group hover:shadow-md ${isReadyForOpening ? 'border-emerald-200 hover:border-emerald-300' : isLate ? 'border-rose-200 hover:border-rose-300' : 'border-slate-200 hover:border-blue-300'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg transition-colors ${isReadyForOpening ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100' : isLate ? 'bg-rose-50 text-rose-600 group-hover:bg-rose-100' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'}`}>
                    <DoorOpen size={24} />
                  </div>
                  <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition-colors" size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Avausvalmius</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Porttien avauksen edellytysten kuittaus ja tavoiteaika.</p>
              </button>

              {/* Työntekijärekisteri Card */}
              <button
                onClick={() => setActiveTab('planning_employees')}
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    <Users size={24} />
                  </div>
                  <ChevronRight className="text-slate-400 group-hover:text-indigo-500 transition-colors" size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Tapahtuman työntekijät</h3>
                <p className="text-sm text-slate-500 line-clamp-2">Henkilöstörekisteri, pätevyydet ja osallistuvat työntekijät.</p>
              </button>
            </div>
          </div>
        );
      case 'planning_readiness':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-3xl mx-auto">
            <TakaisinLinkki onClick={() => setActiveTab('planning')}>
              Takaisin suunnitteluvalikkoon
            </TakaisinLinkki>
            
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <DoorOpen className="text-indigo-500" size={28} />
                Avausvalmius (Green Light)
              </h2>
              <p className="text-sm text-slate-500 mt-1">Kuittaa tapahtuman avauksen edellytykset ennen porttien avaamista yleisölle.</p>
            </div>

            <form className="space-y-8 text-left">
              {/* Tavoiteaika */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <h3 className="text-sm font-bold text-slate-800 mb-1">Tavoiteltu avausaika</h3>
                    <p className="text-xs text-slate-500">Aseta päivä ja kellonaika, jolloin portit on tarkoitus avata. Suunnittelunäkymän laskuri laskee tähän hetkeen, ja jos valmiutta ei ole kuitattu siihen mennessä, järjestelmä hälyttää myöhästymisestä.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="text-slate-400" size={18} />
                    <input
                      type="date"
                      value={targetOpeningDate}
                      onChange={(e) => setTargetOpeningDate(e.target.value)}
                      className="rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-center font-bold"
                    />
                    <input
                      type="time"
                      value={targetOpeningTime}
                      onChange={(e) => setTargetOpeningTime(e.target.value)}
                      className="w-28 rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-center font-bold"
                    />
                  </div>
                </div>
                {/* Luonnoksesta laskettu vahvistus: kumpikin kenttä tarvitaan, jotta
                    laskurilla on kohde — pelkkä kellonaika ei riitä. */}
                <p className="text-xs mt-3 pt-3 border-t border-slate-200">
                  {yhdistaPaivaJaAika(targetOpeningDate, targetOpeningTime) ? (
                    <span className="text-slate-600">
                      Laskuri laskee hetkeen <span className="font-bold">{formatFiDate(targetOpeningDate)} klo {targetOpeningTime}</span>.
                    </span>
                  ) : (
                    <span className="text-amber-700">Täytä sekä päivä että kellonaika, jotta laskuri käynnistyy.</span>
                  )}
                </p>
                {suunniteltuAvausPvm && suunniteltuAvausKlo && (
                  <p className="text-xs text-slate-500 mt-1">
                    Tapahtuman perustiedoissa portit auki {formatFiDate(suunniteltuAvausPvm)} klo {suunniteltuAvausKlo}.
                  </p>
                )}
              </div>

              {/* Tarkistuslista */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <CheckSquare className="text-slate-400" size={20} />
                  Edellytysten kuittaus
                </h3>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {READINESS_CHECKS.map(item => (
                    <label key={item.key} className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          checked={readinessChecks[item.key]}
                          onChange={() => toggleReadinessCheck(item.key)}
                          className="w-6 h-6 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 transition-all cursor-pointer" 
                        />
                      </div>
                      <span className={`text-base font-medium transition-colors ${readinessChecks[item.key] ? 'text-slate-800' : 'text-slate-600'}`}>
                        {item.label}
                      </span>
                      {readinessChecks[item.key] && (
                        <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Kyllä</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Poikkeamat */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Avauksen poikkeamat ja lisätiedot</label>
                <textarea 
                  rows="4" 
                  value={readinessComments}
                  onChange={(e) => setReadinessComments(e.target.value)}
                  className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-indigo-500" 
                  placeholder="Kirjaa ylös syyt mahdolliseen myöhästymiseen tai muut huomionarvoiset poikkeamat (esim. 'Turvatarkastuslinja 2 ei käytössä kortinlukijan vian vuoksi')..."
                ></textarea>
              </div>

              {/* Toiminnot */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                {(isAdminUser || canEdit(perms, selectedEvent, 'planning_readiness')) && (
                  <button
                    type="button"
                    onClick={handleSaveReadiness}
                    className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <CheckCircle size={18} />
                    Tallenna ja sulje
                  </button>
                )}
              </div>
            </form>
          </div>
        );
      case 'postevent': {
        // Kanavajako tulee tapahtuman omista tiedoista (osio 14). Uusi tapahtuma saa
        // oletusjaon esitäyttönä, mutta jokainen tapahtuma voi muuttaa sitä.
        const radioChannels = (valittuTapahtumaLomake.radioChannels || []).filter((k: string) => String(k || '').trim());

        // Vastuuhenkilöt luetaan tapahtuman omista perustiedoista. Aiemmin tässä oli
        // yhdeksän kovakoodattua nimeä ("Turva 1 — Ismo Näkki" jne.), jotka näkyivät
        // samanlaisina joka tapahtumassa ja näyttivät elävältä organisaatiotiedolta.
        // Nämä ovat ne vastuuhenkilöt jotka lomake oikeasti kerää; sisäinen
        // kutsutunnusketju (Turva 1/2, porttien ja lavojen vastaavat) ei ole vielä
        // missään tallessa, joten sitä ei voi tähän myöskään keksiä.
        const vastuuhenkilot = [
          { rooli: 'Tilaaja', nimi: valittuTapahtumaLomake.ordererName, puhelin: valittuTapahtumaLomake.ordererPhone, email: valittuTapahtumaLomake.ordererEmail },
          { rooli: 'Päättävä vastuuhenkilö hätätilanteessa', nimi: valittuTapahtumaLomake.deciderName, puhelin: valittuTapahtumaLomake.deciderPhone, email: valittuTapahtumaLomake.deciderEmail },
          { rooli: 'Viranomaisyhteyshenkilö', nimi: valittuTapahtumaLomake.authorityResponsible },
          { rooli: 'Anniskelusta vastaa', nimi: valittuTapahtumaLomake.barResponsible },
          { rooli: 'Rakennusvaiheen vastaava', nimi: valittuTapahtumaLomake.buildPhaseResponsible },
        ].filter((v) => String(v.nimi || '').trim());

        const karttaId = valittuTapahtumaLomake.mapUploadId;
        const saaMuokataTapahtumaa = isAdminUser || canEdit(perms, selectedEvent, 'landing');

        return (
          <div className="space-y-6 max-w-5xl">
            <div className="mb-6 pb-4 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Layers className="text-indigo-500" size={28} />
                {findEventName(selectedEvent, events)}
              </h2>
              <p className="text-sm text-slate-500 mt-1">Tapahtuman operatiivinen kartta, viestintäkanavat ja johto.</p>
            </div>

            {/* Kartta */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Map className="text-indigo-500" size={20} />
                  Tapahtuman pohjakartta
                </h3>
                {/* Kartta talletetaan tapahtuman tietoihin, joten sen vaihtaminen
                    vaatii saman oikeuden kuin tapahtuman muokkaaminen. */}
                {saaMuokataTapahtumaa && (
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 rounded-lg transition-all text-sm font-medium text-slate-700">
                    <Paperclip size={16} className="text-indigo-500" />
                    {karttaUploading ? 'Lähetetään…' : karttaId ? 'Vaihda kartta' : 'Lataa kartta'}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => tallennaPohjakartta(e.target.files[0])}
                    />
                  </label>
                )}
              </div>

              <Kartta
                karttaId={karttaId}
                vyohykkeet={nykyisenTapahtumanVyohykkeet}
                // Kirjaustaso: vain ne kirjaukset joille on osoitettu kohta kartalta.
                // Piirtotilassa merkit piilotetaan, jottei uutta vyöhykettä piirrettäessä
                // osu vahingossa kirjausmerkkiin.
                merkit={vyohykeMuokkaus ? [] : currentEventReports
                  .filter(r => r.location?.img)
                  .map(r => ({
                    id: r.id,
                    x: r.location.img.x,
                    y: r.location.img.y,
                    // Tilaton kirjaus (sisäänkirjaus, sääraportti) on harmaa: tilaväri
                    // lupaisi käsittelyä jota sille ei kuulu tehdä.
                    vari: kirjauksenTila(r.status)?.merkki || '#64748b',
                    otsikko: `${r.time || ''} ${r.type}`.trim(),
                    onKlikkaus: () => { setOpenedReport(r); setOpenedReportSource('overview'); },
                  }))}
                piirrettava={vyohykeMuokkaus ? piirrettava : undefined}
                onKarttaKlikkaus={vyohykeMuokkaus ? (p) => setPiirrettava(prev => [...prev, p]) : undefined}
                tyhjaTeksti={
                  saaMuokataTapahtumaa
                    ? 'Pohjakarttaa ei ole ladattu. Lataa alueen kartta yllä olevalla painikkeella — vyöhykkeet piirretään sen päälle.'
                    : 'Pohjakarttaa ei ole ladattu. Pyydä pääkäyttäjää lataamaan alueen kartta tähän tapahtumaan.'
                }
              />

              {/* Vyöhykkeet. Piirtäminen vaatii saman oikeuden kuin tapahtuman muokkaus:
                  vyöhyke on tapahtuman kenttä, ja se ohjaa kirjausten luokittelua. */}
              {karttaId && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h4 className="text-sm font-bold text-slate-700">
                      Vyöhykkeet
                      {nykyisenTapahtumanVyohykkeet.length > 0 && (
                        <span className="ml-1.5 font-normal text-slate-400">({nykyisenTapahtumanVyohykkeet.length})</span>
                      )}
                    </h4>
                    {saaMuokataTapahtumaa && (
                      <button
                        type="button"
                        onClick={() => { setVyohykeMuokkaus(o => !o); setPiirrettava([]); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          vyohykeMuokkaus
                            ? 'bg-slate-800 text-white hover:bg-slate-700'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {vyohykeMuokkaus ? 'Lopeta muokkaus' : 'Piirrä vyöhykkeitä'}
                      </button>
                    )}
                  </div>

                  {vyohykeMuokkaus && (
                    <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 mb-3 space-y-3">
                      <p className="text-xs text-slate-600">
                        Napsauta karttaa alueen kulmiin. Vähintään {VYOHYKKEEN_MIN_PISTEET} pistettä,
                        sitten anna nimi ja tallenna. Napsautettu: {piirrettava.length}.
                      </p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="text"
                          value={uusiVyohykeNimi}
                          onChange={(e) => setUusiVyohykeNimi(e.target.value)}
                          placeholder="Esim. Lohko C tai Portti 2"
                          className="flex-1 min-w-[180px] rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                        <select
                          value={uusiVyohykeVari}
                          onChange={(e) => setUusiVyohykeVari(e.target.value)}
                          aria-label="Vyöhykkeen väri"
                          className="rounded-lg border border-slate-300 p-2 text-sm"
                        >
                          {VYOHYKEVARIT.map(v => <option key={v.id} value={v.id}>{v.nimi}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={lisaaVyohyke}
                          disabled={piirrettava.length < VYOHYKKEEN_MIN_PISTEET}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          Tallenna vyöhyke
                        </button>
                        <button
                          type="button"
                          onClick={() => setPiirrettava(prev => prev.slice(0, -1))}
                          disabled={piirrettava.length === 0}
                          className="px-3 py-2 bg-white border border-slate-200 text-slate-600 disabled:text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          Kumoa piste
                        </button>
                      </div>
                    </div>
                  )}

                  {nykyisenTapahtumanVyohykkeet.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Vyöhykkeitä ei ole piirretty. Ilman niitä kirjauksia ei voi kohdistaa alueelle.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {nykyisenTapahtumanVyohykkeet.map(v => {
                        const varit = VYOHYKEVARIT.find(x => x.id === v.vari) || VYOHYKEVARIT[0];
                        return (
                          <span
                            key={v.id}
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium bg-white"
                            style={{ borderColor: varit.reuna, color: varit.reuna }}
                          >
                            {v.nimi}
                            {saaMuokataTapahtumaa && (
                              <button
                                type="button"
                                onClick={() => poistaVyohyke(v.id)}
                                title={`Poista vyöhyke ${v.nimi}`}
                                className="text-slate-400 hover:text-rose-600"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Grid for Radios and Supervisors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Radiokanavat */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <PhoneCall className="text-emerald-500" size={20} />
                  Radiopuhelinten kanavalista
                </h3>
                {radioChannels.length === 0 ? (
                  <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
                    Kanavajakoa ei ole kirjattu. Se täytetään tapahtuman perustiedoissa
                    (osio 14, Viestintä ja hätänumerot).
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {radioChannels.map((channel: string, idx: number) => (
                      <li key={idx} className="flex gap-3 items-center p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-colors">
                        <span className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-700">{channel}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Vastuuhenkilöt */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Users className="text-blue-500" size={20} />
                  Vastuuhenkilöt
                </h3>
                {vastuuhenkilot.length === 0 ? (
                  <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
                    Vastuuhenkilöitä ei ole kirjattu. Ne täytetään tapahtuman perustiedoissa
                    (yhteyshenkilöt, viranomaisyhteistyö, anniskelu ja rakennusvaihe).
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {vastuuhenkilot.map((v, idx) => (
                      <li key={idx} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{v.rooli}</div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">{v.nimi}</div>
                        {(v.puhelin || v.email) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                            {v.puhelin && (
                              <a href={`tel:${v.puhelin}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                                {v.puhelin}
                              </a>
                            )}
                            {v.email && <span className="text-xs text-slate-500">{v.email}</span>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      }
      case 'planning_employees':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <TakaisinLinkki onClick={() => setActiveTab('planning')}>
              Takaisin suunnitteluvalikkoon
            </TakaisinLinkki>
            
            <div className="mb-6 flex justify-between items-end border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Users className="text-indigo-500" size={24} />
                  Tapahtuman työntekijät
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Merkitty tapahtumaan {currentEventCheckedIn.length} hlö, sisäänkirjattuna {jvCount + guardCount} hlö (JV {jvCount}, vartijat {guardCount}). Rekisterissä {employees.length} hlö.
                </p>
              </div>
              {(isAdminUser || canEdit(perms, selectedEvent, 'planning_employees')) && (
                <button
                  onClick={() => { setAddEmpSearch(''); setAddEmpSelectedIds([]); setActiveTab('planning_employee_add'); }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <UserPlus size={16} />
                  Lisää tapahtumaan työntekijä
                </button>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Nimi</th>
                    <th className="p-4">Rooli</th>
                    <th className="p-4">Sisäänkirjattu</th>
                    <th className="p-4">Yksilötunnus</th>
                    <th className="p-4">Varusteet</th>
                    <th className="p-4 text-right">Toiminnot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentEventCheckedIn.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                        Ei työntekijöitä merkitty tapahtumaan. Lisää työntekijöitä "Lisää tapahtumaan työntekijä" -painikkeella, ja kirjaa heidät sisään kohdassa Raportointi &rarr; TIKE &rarr; Työntekijän sisäänkirjaus.
                      </td>
                    </tr>
                  ) : currentEventCheckedIn.map((emp) => (
                    <tr key={emp.id} className="hover:bg-white transition-colors">
                      <td className="p-4 font-medium text-slate-800">
                        {emp.name}
                        {/* Uloskirjauksessa kirjatut huomiot (rikkoutuneet välineet yms.)
                            näkyvät tässä — muuten ne tallentuisivat näkymättömiin. */}
                        {emp.checkOutComment && (
                          <span className="block text-xs font-normal text-slate-500 mt-1 max-w-xs">
                            Uloskirjaus: {emp.checkOutComment}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${emp.role === 'Järjestyksenvalvoja' ? 'bg-indigo-50 text-indigo-700 ring-indigo-700/10' : 'bg-slate-100 text-slate-700 ring-slate-700/10'}`}>
                          {emp.role}
                        </span>
                      </td>
                      <td className="p-4"><EmpStatusBadge emp={emp} /></td>
                      <td className="p-4 text-slate-600">{emp.badge || '-'}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {emp.vest && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Liivi</span>}
                          {emp.headset && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Headset</span>}
                          {emp.radio && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">{emp.radio}</span>}
                          {!emp.vest && !emp.headset && !emp.radio && <span className="text-xs text-slate-400">-</span>}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          {(isAdminUser || canEdit(perms, selectedEvent, 'tike_form_in')) && (
                            <button
                              onClick={() => {
                                setEditingCheckIn(emp);
                                setSelectedEmp(emp.name);
                                setEmpSearch(emp.name);
                                setCheckInRole(emp.role || 'Järjestyksenvalvoja');
                                setCheckInNickname(emp.nickname || '');
                                setCheckInVest(!!emp.vest);
                                setCheckInBadge(emp.badge || '');
                                setCheckInHeadset(!!emp.headset);
                                setCheckInRadio(emp.radio || '');
                                setCheckInComment(emp.comment || '');
                                setCheckInDate(emp.checkInDate || '');
                                setCheckInTime(emp.checkInTime || '');
                                setActiveTab('tike_form_in');
                              }}
                              title="Muokkaa työntekijän sisäänkirjaustietoja"
                              className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                            >
                              Muokkaa
                            </button>
                          )}
                          {(isAdminUser || canEdit(perms, selectedEvent, 'planning_employees')) && (
                            <button
                              onClick={() => handleRemoveFromEventRoster(emp)}
                              title="Poistaa työntekijän tapahtumasta — ei ole uloskirjaus"
                              className="text-rose-600 hover:text-rose-800 font-medium text-xs bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-md transition-colors"
                            >
                              Poista tapahtumasta
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'planning_employee_add': {
        const availableEmployees = employees.filter(e => !currentEventCheckedIn.some(c => c.name === e.name));
        const visibleAddEmployees = addEmpSearch.trim()
          ? availableEmployees.filter(e => e.name.toLowerCase().includes(addEmpSearch.trim().toLowerCase()))
          : availableEmployees;
        const allVisibleSelected = visibleAddEmployees.length > 0 && visibleAddEmployees.every(e => addEmpSelectedIds.includes(e.id));

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <TakaisinLinkki onClick={() => { setAddEmpSearch(''); setAddEmpSelectedIds([]); setAddEmpNicknames({}); setActiveTab('planning_employees'); }}>
              Takaisin työntekijälistaan
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="text-indigo-500" size={24} />
                Lisää tapahtumaan työntekijä
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Valitse työntekijäpankista yksi tai useampi henkilö ja kirjaa heidät kerralla sisään tähän tapahtumaan.
              </p>
            </div>

            {employees.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-500">
                Työntekijäpankki on tyhjä.
                <button
                  onClick={() => { setEditingEmp(null); setEmpForm(emptyEmpForm); setViewingEmployeeBank('form'); }}
                  className="block mx-auto mt-3 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Lisää työntekijöitä työntekijäpankkiin →
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={addEmpSearch}
                      onChange={(e) => setAddEmpSearch(e.target.value)}
                      placeholder="Hae nimellä..."
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
                    <span className="text-sm font-bold text-slate-700 shrink-0">Rooli valituille</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="addEmpRole" checked={addEmpRole === 'Järjestyksenvalvoja'} onChange={() => setAddEmpRole('Järjestyksenvalvoja')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-700">JV</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="addEmpRole" checked={addEmpRole === 'Vartija'} onChange={() => setAddEmpRole('Vartija')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-700">Vartija</span>
                    </label>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-10">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={() => {
                              if (allVisibleSelected) {
                                setAddEmpSelectedIds(prev => prev.filter(id => !visibleAddEmployees.some(e => e.id === id)));
                              } else {
                                setAddEmpSelectedIds(prev => Array.from(new Set([...prev, ...visibleAddEmployees.map(e => e.id)])));
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                        </th>
                        <th className="p-3">Nimi</th>
                        <th className="p-3 w-56">Nimimerkki tässä tapahtumassa</th>
                        <th className="p-3">Yhteystiedot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {visibleAddEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-sm text-slate-500">
                            {addEmpSearch.trim() ? 'Ei hakua vastaavia työntekijöitä.' : 'Kaikki rekisterin työntekijät on jo kirjattu sisään tähän tapahtumaan.'}
                          </td>
                        </tr>
                      ) : visibleAddEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          onClick={() => toggleAddEmpSelected(emp.id)}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={addEmpSelectedIds.includes(emp.id)}
                              onChange={() => toggleAddEmpSelected(emp.id)}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-3 font-medium text-slate-800">
                            {emp.name}
                            {emp.displayId && <span className="ml-2 text-xs font-mono text-slate-400">{muotoileTunniste(emp.displayId)}</span>}
                          </td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={addEmpNicknames[emp.id] || ''}
                              onChange={(e) => setAddEmpNicknames(prev => ({ ...prev, [emp.id]: e.target.value }))}
                              placeholder="esim. Ensiapu 1"
                              className="w-full rounded-lg border-slate-300 border p-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-3 text-slate-500 text-xs">{[emp.email, emp.phone].filter(Boolean).join(' · ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-6 mt-2 flex justify-between items-center border-t border-slate-100">
                  <span className="text-sm text-slate-500">{addEmpSelectedIds.length} valittu</span>
                  {(isAdminUser || canEdit(perms, selectedEvent, 'planning_employees')) && (
                  <button
                    type="button"
                    disabled={addEmpSelectedIds.length === 0}
                    onClick={handleAddSelectedEmployees}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <CheckCircle size={18} />
                    Lisää valitut tapahtumaan
                  </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      }
      case 'documents': {
        const documentOptions = [
          { id: 'forms', label: 'Täytettävät lomakkeet', icon: Clipboard, color: 'text-indigo-600', bg: 'bg-indigo-50', desc: 'Tapahtumailmoitukset, tarkastuslistat ja viranomaislomakkeet.' },
          { id: 'pdf', label: 'Raporttien PDF-versiot', icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'Valmiit kirjaukset arkistointia ja toimeksiantajaa varten.' },
          { id: 'trash', label: 'Roskakori', icon: Archive, color: 'text-slate-600', bg: 'bg-slate-100', desc: 'Poistetut kirjaukset ja asiakirjat säilytysajan loppuun asti.' },
          { id: 'emergency', label: 'Hätätilanneohjeet', icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50', desc: 'Toimintakortit poikkeus- ja hätätilanteisiin.' },
          { id: 'risk', label: 'Riskiarviointi', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Tehdyt riskiarviot ja uuden riskin arviointi laskurilla.' }
        ];

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <div className="mb-8 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-500" size={24} />
                Lomakkeet ja asiakirjat
              </h2>
              <p className="text-sm text-slate-500 mt-1">Valitse asiakirjaryhmä.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {documentOptions.filter((option) => isAdminUser || canView(perms, selectedEvent, `documents_${option.id}`)).map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setActiveTab(`documents_${option.id}`)}
                    className="flex flex-col items-start p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all text-left group bg-white"
                  >
                    <div className={`p-3 rounded-lg mb-4 transition-transform ${option.bg} ${option.color} group-hover:scale-110 duration-200`}>
                      <Icon size={24} />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">{option.label}</span>
                    <span className="text-xs text-slate-500 mt-1">{option.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      case 'documents_risk': {
        const riskOptions = [
          { id: 'risk_done', label: 'Tehdyt riskiarviot', icon: Archive, color: 'text-indigo-600', bg: 'bg-indigo-50', desc: 'Aiemmin laaditut riskiarviot ja niiden toimenpiteet.' },
          { id: 'risk_new', label: 'Riskin arviointi', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Arvioi yksittäinen riski laskurilla ja kirjaa toimenpiteet.' }
        ];

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <TakaisinLinkki onClick={() => setActiveTab('documents')}>
              Takaisin asiakirjavalikkoon
            </TakaisinLinkki>

            <div className="mb-8 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={24} />
                Riskiarviointi
              </h2>
              <p className="text-sm text-slate-500 mt-1">Tapahtuman vaarojen tunnistaminen, riskien suuruuden arviointi ja toimenpiteet.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {riskOptions.filter((option) => isAdminUser || canView(perms, selectedEvent, `documents_${option.id}`)).map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setActiveTab(`documents_${option.id}`)}
                    className="flex flex-col items-start p-5 rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all text-left group bg-white"
                  >
                    <div className={`p-3 rounded-lg mb-4 transition-transform ${option.bg} ${option.color} group-hover:scale-110 duration-200`}>
                      <Icon size={24} />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">{option.label}</span>
                    <span className="text-xs text-slate-500 mt-1">{option.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      case 'documents_risk_done': {
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <TakaisinLinkki onClick={() => setActiveTab('documents_risk')}>
              Takaisin riskiarviointiin
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Archive className="text-indigo-500" size={24} />
                  Tehdyt riskiarviot
                </h2>
                <p className="text-sm text-slate-500 mt-1">{currentEventRiskAssessments.length} arviota.</p>
              </div>
              <button
                onClick={() => setActiveTab('documents_risk_new')}
                className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                Uusi riskiarvio
              </button>
            </div>

            {currentEventRiskAssessments.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-10 text-center text-sm text-slate-500">
                Ei vielä tehtyjä riskiarvioita tälle tapahtumalle.
              </div>
            ) : (
              <div className="space-y-3">
                {currentEventRiskAssessments.map((ra) => {
                  const level = riskLevels[ra.score];
                  const tone = riskTones[level.tone];
                  return (
                    <button
                      key={ra.id}
                      onClick={() => setOpenedRiskAssessment(ra)}
                      className="w-full text-left bg-slate-50 hover:bg-white border border-slate-200 hover:border-amber-300 hover:shadow-sm rounded-xl p-4 transition-all flex items-center gap-4"
                    >
                      <div className={`shrink-0 w-12 h-12 rounded-lg ${tone.solid} text-white font-bold text-xl flex items-center justify-center`}>
                        {ra.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-800 text-sm">{ra.target}</span>
                          {ra.category && <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">{ra.category}</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex gap-3 flex-wrap">
                          <span className="font-mono">{ra.id}</span>
                          <span>{ra.author}</span>
                          <span>{ra.date}</span>
                        </div>
                      </div>
                      <div className="hidden sm:block text-right shrink-0">
                        <div className={`text-xs font-bold ${tone.text}`}>{level.label}</div>
                        <div className={`text-xs mt-1 px-2 py-0.5 rounded inline-block ${ra.status === 'Hyväksytty' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {ra.status}
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      }
      case 'documents_risk_new': {
        const probLabels = [
          { value: 1, label: 'Epätodennäköinen', desc: 'Tapahtuu harvoin ja epäsäännöllisesti' },
          { value: 2, label: 'Mahdollinen', desc: 'Tapahtuu joskus, ei kuitenkaan säännöllisesti' },
          { value: 3, label: 'Todennäköinen', desc: 'Tapahtuu usein tai toistuvasti' }
        ];
        const sevLabels = [
          { value: 1, label: 'Vähäiset', desc: 'Ohimenevä haitta, ei hoidon tarvetta' },
          { value: 2, label: 'Haitalliset', desc: 'Hoitoa vaativa vamma tai merkittävä häiriö' },
          { value: 3, label: 'Vakavat', desc: 'Pysyvä vamma, kuolema tai toiminnan keskeytyminen' }
        ];

        const score = getRiskScore(raProb, raSev);
        const level = score ? riskLevels[score] : null;
        const tone = level ? riskTones[level.tone] : null;

        const resScore = getRiskScore(raResProb, raResSev);
        const resLevel = resScore ? riskLevels[resScore] : null;
        const resTone = resLevel ? riskTones[resLevel.tone] : null;

        const inputCls = "w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-amber-500";
        const labelCls = "block text-sm font-bold text-slate-700 mb-1.5";

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
            <TakaisinLinkki onClick={() => setActiveTab('documents_risk')}>
              Takaisin riskiarviointiin
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={24} />
                  Riskin arviointi
                </h2>
                <p className="text-sm text-slate-500 mt-1">Tunnista vaara, arvioi riskin suuruus ja kirjaa toimenpiteet.</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Tunniste</span>
                <div className="text-sm font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
                  {getDynamicId()}
                </div>
              </div>
            </div>

            <form className="space-y-6">

              {/* Kohde ja vaara */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">1. Vaaran tunnistaminen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Kohde tai toiminto</label>
                    <input type="text" className={inputCls} value={raTarget} onChange={(e) => setRaTarget(e.target.value)} placeholder="Esim. Lava 1 etualue, Portti 2, rakennusvaihe" />
                  </div>
                  <div>
                    <label className={labelCls}>Riskiluokka</label>
                    <select className={inputCls} value={raCategory} onChange={(e) => setRaCategory(e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Väkijoukko">Väkijoukko</option>
                      <option value="Järjestys">Järjestyshäiriöt ja väkivalta</option>
                      <option value="Työturvallisuus">Työturvallisuus</option>
                      <option value="Paloturvallisuus">Paloturvallisuus</option>
                      <option value="Sää">Sää ja luonnonolosuhteet</option>
                      <option value="Terveys">Terveys ja ensiapu</option>
                      <option value="Liikenne">Liikenne ja pysäköinti</option>
                      <option value="Tekniikka">Tekniikka ja sähkö</option>
                      <option value="Turvatoimet">Turvatoimet ja tarkastukset</option>
                      <option value="Muu">Muu</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Vaaran kuvaus</label>
                  <textarea rows="3" className={inputCls} value={raHazard} onChange={(e) => setRaHazard(e.target.value)} placeholder="Mikä voi mennä pieleen, kenelle ja missä tilanteessa."></textarea>
                </div>
                <div>
                  <label className={labelCls}>Nykyiset hallintakeinot</label>
                  <textarea rows="3" className={inputCls} value={raControls} onChange={(e) => setRaControls(e.target.value)} placeholder="Mitä on jo tehty: aidat, miehitys, opastus, ohjeistus, tekniset ratkaisut."></textarea>
                </div>
              </div>

              {/* Laskuri */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">2. Riskin suuruus</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <span className={labelCls}>Todennäköisyys</span>
                    <div className="space-y-2">
                      {probLabels.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setRaProb(p.value)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${raProb === p.value ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${raProb === p.value ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                              {p.value}
                            </span>
                            <span className="text-sm font-medium text-slate-800">{p.label}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 pl-8">{p.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className={labelCls}>Seurausten vakavuus</span>
                    <div className="space-y-2">
                      {sevLabels.map((v) => (
                        <button
                          key={v.value}
                          type="button"
                          onClick={() => setRaSev(v.value)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${raSev === v.value ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${raSev === v.value ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                              {v.value}
                            </span>
                            <span className="text-sm font-medium text-slate-800">{v.label}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 pl-8">{v.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Matriisi */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Riskimatriisi</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-center text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="p-2 text-xs text-slate-500 font-medium text-left">Todennäköisyys \ Seuraukset</th>
                          {sevLabels.map((v) => (
                            <th key={v.value} className="p-2 text-xs text-slate-600 font-semibold">{v.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {probLabels.map((p) => (
                          <tr key={p.value}>
                            <td className="p-2 text-xs text-slate-600 font-semibold text-left">{p.label}</td>
                            {sevLabels.map((v) => {
                              const cellScore = riskMatrix[p.value - 1][v.value - 1];
                              const cellTone = riskTones[riskLevels[cellScore].tone];
                              const active = raProb === p.value && raSev === v.value;
                              return (
                                <td key={v.value} className="p-1">
                                  <button
                                    type="button"
                                    onClick={() => { setRaProb(p.value); setRaSev(v.value); }}
                                    className={`w-full py-3 rounded-lg font-bold text-white transition-all ${cellTone.solid} ${active ? 'ring-4 ring-slate-800 scale-105' : 'opacity-60 hover:opacity-100'}`}
                                  >
                                    {cellScore}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 mt-3">
                    Riskin suuruus on todennäköisyyden ja seurausten vakavuuden yhdistelmä asteikolla 1-5.
                  </p>
                </div>

                {/* Tulos */}
                {level ? (
                  <div className={`rounded-xl border-2 p-5 ${tone.bg} ${tone.border}`}>
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 w-16 h-16 rounded-xl ${tone.solid} text-white font-bold text-3xl flex items-center justify-center shadow-sm`}>
                        {score}
                      </div>
                      <div>
                        <div className={`text-lg font-bold ${tone.text}`}>{level.label}</div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          Todennäköisyys {raProb} ja seuraukset {raSev}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 mt-4 pt-4 border-t border-white/60">
                      <span className="font-bold">Toimintaohje: </span>{level.action}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center">
                    <p className="text-sm text-slate-500">Valitse todennäköisyys ja seurausten vakavuus, niin riskin suuruus lasketaan.</p>
                  </div>
                )}
              </div>

              {/* Toimenpiteet */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">3. Toimenpiteet</h3>
                <div>
                  <label className={labelCls}>Päätetyt toimenpiteet riskin pienentämiseksi</label>
                  <textarea rows="4" className={inputCls} value={raActions} onChange={(e) => setRaActions(e.target.value)} placeholder="Konkreettiset toimet: lisämiehitys, rakenteelliset muutokset, ohjeistus, seuranta, keskeytyskriteerit."></textarea>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Vastuuhenkilö</label>
                    <input type="text" className={inputCls} value={raOwner} onChange={(e) => setRaOwner(e.target.value)} placeholder="Nimi ja rooli" />
                  </div>
                  <div>
                    <label className={labelCls}>Toteutettava viimeistään</label>
                    <input type="date" className={inputCls} value={raDeadline} onChange={(e) => setRaDeadline(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Jäännösriski */}
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-slate-700 border-b pb-2">4. Jäännösriski toimenpiteiden jälkeen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Todennäköisyys toimenpiteiden jälkeen</label>
                    <select className={inputCls} value={raResProb} onChange={(e) => setRaResProb(Number(e.target.value))}>
                      <option value={0}>Valitse</option>
                      {probLabels.map((p) => <option key={p.value} value={p.value}>{p.value} {p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Seuraukset toimenpiteiden jälkeen</label>
                    <select className={inputCls} value={raResSev} onChange={(e) => setRaResSev(Number(e.target.value))}>
                      <option value={0}>Valitse</option>
                      {sevLabels.map((v) => <option key={v.value} value={v.value}>{v.value} {v.label}</option>)}
                    </select>
                  </div>
                </div>

                {resLevel && (
                  <div className={`rounded-xl border p-4 flex items-center gap-4 ${resTone.bg} ${resTone.border}`}>
                    <div className={`shrink-0 w-12 h-12 rounded-lg ${resTone.solid} text-white font-bold text-xl flex items-center justify-center`}>
                      {resScore}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-bold ${resTone.text}`}>{resLevel.label}</div>
                      {score > 0 && (
                        <div className="text-xs text-slate-600 mt-0.5">
                          {resScore < score
                            ? `Riski pienenee ${score} tasolta tasolle ${resScore}.`
                            : resScore === score
                              ? 'Toimenpiteet eivät pienennä riskiä. Harkitse tehokkaampia keinoja.'
                              : `Jäännösriski on suurempi kuin alkuperäinen. Tarkista arviointi.`}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {resScore >= 4 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3">
                    <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                    <div className="text-sm text-rose-900">
                      Jäännösriski on edelleen merkittävä tai sietämätön. Vie arvio turvallisuuspäällikön ja toimeksiantajan
                      käsittelyyn ennen toiminnan aloittamista.
                    </div>
                  </div>
                )}
              </div>

              {/* Toiminnot */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { resetRiskForm(); setActiveTab('documents_risk'); }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                {(isAdminUser || canEdit(perms, selectedEvent, 'documents_risk_new')) && (
                  <button
                    type="button"
                    onClick={handleSaveRiskAssessment}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <CheckCircle size={18} />
                    Tallenna riskiarvio
                  </button>
                )}
              </div>
            </form>
          </div>
        );
      }
      case 'documents_forms': {
        // Kukin lomake on kytketty siihen sovelluksen lomakkeeseen jolla se
        // täytetään (tab) ja kenttäluetteloon jonka mukaan tyhjä paperipohja
        // tulostetaan (kentat). Neljälle listan lomakkeelle ei ole vielä omaa
        // toteutusta — niiden painikkeet ovat pois käytöstä ja kertovat syyn,
        // mikä on rehellisempi kuin painike joka ei tee mitään. Näistä kaksi on
        // viranomaislomakkeita, joiden tyhjää pohjaa ei pidä keksiä itse vaan
        // ottaa mallia virallisesta lomakkeesta.
        const saaMuokataLomakkeita = isAdminUser || canEdit(perms, selectedEvent, 'documents_forms');
        const fillableForms = [
          {
            name: 'Tapahtumailmoitus',
            desc: 'JV:n tai vartijan oma ilmoitus toimenpiteestä.',
            tag: 'Viranomaislomake',
            tab: 'report_jv',
            kentat: [
              'Järjestyksenvalvojan nimi', 'Turvallisuusalan elinkeinoluvan haltija',
              'Tapahtumapaikka', 'Päivämäärä', 'Kellonaika',
              'Kohdehenkilön sukunimi', 'Kohdehenkilön etunimet', 'Kohdehenkilön henkilötunnus',
              'Kohdehenkilön osoitetiedot', 'Tuntomerkit',
              'Havainnot käyttäytymisestä ja tilasta',
              'Kiinniotto tai voimakeinot (kyllä/ei)', 'Voimankäyttövälineet (kyllä/ei)',
              'Ampuma-ase esillä tai käytetty (kyllä/ei)', 'Ensiapu tai ensihoito (kyllä/ei)',
              'Vapaa kuvaus tapahtumasta', 'TIKE:n kommentti', 'Allekirjoitus ja nimenselvennys',
            ],
          },
          { name: 'Kiinniottoilmoitus', desc: 'Kiinniotetun luovutus poliisille.', tag: 'Viranomaislomake' },
          { name: 'Voimankäyttöselvitys', desc: 'Selvitys voimakeinojen ja välineiden käytöstä.', tag: 'Sisäinen' },
          {
            name: 'Ensiapukaavake',
            desc: 'Ensiaputilanteen kirjaus ja jatkotoimet.',
            tag: 'Sisäinen',
            tab: 'tike_form_firstaid',
            kentat: [
              'Päivämäärä', 'Kellonaika', 'Tapahtuman kuvaus', 'Tehdyt toimenpiteet',
              'Käytetyt resurssit', 'Paikalla olleet työntekijät', 'Kirjaaja',
            ],
          },
          {
            name: 'Vahinkoilmoitus',
            desc: 'Omaisuusvaurio ja vastuukysymykset.',
            tag: 'Sisäinen',
            tab: 'tike_form_damage',
            kentat: [
              'Päivämäärä', 'Kellonaika', 'Tapahtuman kuvaus', 'Tehdyt toimenpiteet',
              'Paikalla olleet työntekijät', 'Kirjaaja',
            ],
          },
          {
            name: 'Löytötavarailmoitus',
            desc: 'Vastaanotettu tai luovutettu löytötavara.',
            tag: 'Sisäinen',
            tab: 'tike_form_lostfound',
            kentat: [
              'Päivämäärä', 'Kellonaika', 'Tapahtuman kuvaus', 'Tehdyt toimenpiteet',
              'Paikalla olleet työntekijät', 'Kirjaaja',
            ],
          },
          { name: 'Perehdytyslomake', desc: 'Työntekijän perehdytys ja kuittaus.', tag: 'Sisäinen' },
          { name: 'Vuoron luovutus', desc: 'Vuoronvaihdon tilannekatsaus ja avoimet asiat.', tag: 'Sisäinen' },
        ];

        // Sisäänrakennetut ja käyttäjän lisäämät samassa listassa. lisatty-lippu
        // erottaa ne: vain lisätyt voi poistaa, ja vain sisäänrakennetuilla on
        // täyttölomake tai tulostettava pohja.
        const kaikkiLomakkeet = [
          ...fillableForms,
          ...eventForms
            .filter((f) => (f.eventId || 'fesx') === selectedEvent)
            .map((f) => ({ ...f, lisatty: true })),
        ];

        const tulostaTyhjaPohja = (lomake: { name: string; desc: string; kentat?: string[] }) => {
          setPdfEsikatselu({
            otsikko: `${lomake.name} — tyhjä pohja`,
            html: tulostusDokumentti({
              otsikko: lomake.name,
              tunniste: 'Tyhjä pohja',
              meta: [
                { otsikko: 'Tapahtuma', arvo: findEventName(selectedEvent, events) },
                { otsikko: 'Lomake', arvo: lomake.desc },
              ],
              kentat: (lomake.kentat || []).map((otsikko: string) => ({ otsikko, tyhja: true })),
              huomio:
                '<strong>Tyhjä pohja käsin täytettäväksi.</strong> Kirjaa tiedot ' +
                'ensi tilassa myös järjestelmään, jotta ne säilyvät ja näkyvät raporteissa.',
            }),
          });
        };
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <TakaisinLinkki onClick={() => setActiveTab('documents')}>
              Takaisin asiakirjavalikkoon
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Clipboard className="text-indigo-500" size={24} />
                  Täytettävät lomakkeet
                </h2>
                <p className="text-sm text-slate-500 mt-1">Avaa lomake täytettäväksi tai tulosta tyhjä pohja käsin täytettäväksi.</p>
              </div>
              {saaMuokataLomakkeita && (
                <button
                  type="button"
                  onClick={() => setShowAddForm((o) => !o)}
                  className="shrink-0 flex items-center gap-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                  <Plus size={16} />
                  Lisää lomake
                </button>
              )}
            </div>

            {/* Uuden lomakkeen lisäys */}
            {showAddForm && saaMuokataLomakkeita && (
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-5 mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lomakkeen nimi</label>
                    <input
                      type="text"
                      value={newFormName}
                      onChange={(e) => setNewFormName(e.target.value)}
                      placeholder="Esim. Perehdytyslomake"
                      className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kuvaus</label>
                    <input
                      type="text"
                      value={newFormDesc}
                      onChange={(e) => setNewFormDesc(e.target.value)}
                      placeholder="Mihin lomaketta käytetään"
                      className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tunniste</label>
                  <div className="flex flex-wrap gap-2">
                    {LOMAKE_TUNNISTEET.map((tunniste) => (
                      <label
                        key={tunniste}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                          newFormTag === tunniste
                            ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="newFormTag"
                          checked={newFormTag === tunniste}
                          onChange={() => setNewFormTag(tunniste)}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        {tunniste === 'Muu' ? 'Muu, mikä?' : tunniste}
                      </label>
                    ))}
                  </div>
                  {newFormTag === 'Muu' && (
                    <input
                      type="text"
                      value={newFormTagOther}
                      onChange={(e) => setNewFormTagOther(e.target.value)}
                      placeholder="Kerro mikä tunniste"
                      className="mt-2 w-full md:w-1/2 rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={nollaaLomakeLisays}
                    className="px-5 py-2 text-sm font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                  >
                    Peruuta
                  </button>
                  <button
                    type="button"
                    onClick={lisaaLomake}
                    className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <CheckCircle size={16} />
                    Lisää lomake
                  </button>
                </div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200">
              {kaikkiLomakkeet.map((form, idx) => (
                <div key={form.id || idx} className="p-4 flex justify-between items-center gap-4 flex-wrap hover:bg-white transition-colors">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-800 text-sm">{form.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${form.tag === 'Viranomaislomake' ? 'bg-amber-50 text-amber-700' : form.tag === 'Ulkoinen' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                        {form.tag === 'Muu' ? (form.tagOther || 'Muu') : form.tag}
                      </span>
                      {form.lisatty && (
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">lisätty</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{form.desc}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {form.lisatty && saaMuokataLomakkeita && (
                      <button
                        type="button"
                        onClick={() => poistaLomake(form)}
                        title="Poista lomake"
                        className="text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-md transition-colors"
                      >
                        Poista
                      </button>
                    )}
                    {form.tab ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveTab(form.tab)}
                          className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                        >
                          Täytä
                        </button>
                        <button
                          type="button"
                          onClick={() => tulostaTyhjaPohja(form)}
                          title="Tulostaa tyhjän pohjan käsin täytettäväksi"
                          className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors"
                        >
                          Tyhjä pohja
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md">
                        {form.lisatty ? 'Ei täyttölomaketta' : 'Ei vielä toteutettu'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }
      case 'documents_pdf':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <TakaisinLinkki onClick={() => setActiveTab('documents')}>
              Takaisin asiakirjavalikkoon
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-emerald-500" size={24} />
                Raporttien PDF-versiot
              </h2>
              <p className="text-sm text-slate-500 mt-1">Tallennetut kirjaukset PDF-muodossa. Tunniste vastaa alkuperäistä kirjausta.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Tunniste</th>
                    <th className="p-4">Tyyppi</th>
                    <th className="p-4">Laatija</th>
                    <th className="p-4">Aika</th>
                    <th className="p-4 text-right">Toiminnot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentEventReports.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-slate-500">
                        Ei vielä tallennettuja kirjauksia tälle tapahtumalle.
                      </td>
                    </tr>
                  )}
                  {currentEventReports.map((report) => (
                    <tr key={report.id} className="hover:bg-white transition-colors">
                      <td className="p-4 font-mono text-xs text-slate-700">{report.id}</td>
                      <td className="p-4 font-medium text-slate-800">{report.type}</td>
                      <td className="p-4 text-slate-600">{report.author}</td>
                      <td className="p-4 font-mono text-slate-600">{report.time}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => avaaRaporttiPdf(report, false)}
                            title="Avaa tulostusversio omaan välilehteen"
                            className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
                          >
                            Esikatsele
                          </button>
                          <button
                            type="button"
                            onClick={() => avaaRaporttiPdf(report, true)}
                            title="Avaa tulostusikkunan, josta tallennetaan PDF-tiedostona"
                            className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors"
                          >
                            Tallenna PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-slate-500 mt-4 space-y-1">
              <p>
                <span className="font-medium text-slate-600">Esikatsele</span> avaa tulostusversion omaan välilehteen.{' '}
                <span className="font-medium text-slate-600">Tallenna PDF</span> avaa selaimen tulostusikkunan, josta
                valitaan kohteeksi &quot;Tallenna PDF-tiedostona&quot;. Sama tuloste käy myös paperitulosteeksi.
              </p>
              <p>PDF-tiedostot sisältävät henkilötietoja. Käsittele ja jaa vain toimeksiannon edellyttämässä laajuudessa.</p>
            </div>
          </div>
        );
      case 'documents_trash':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <TakaisinLinkki onClick={() => setActiveTab('documents')}>
              Takaisin asiakirjavalikkoon
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-end gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Archive className="text-slate-500" size={24} />
                  Roskakori
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Roskakoriin siirretyt kirjaukset. Ne eivät näy raporttilistauksissa eivätkä
                  tilannekuvan laskureissa, mutta säilyvät kunnes ne hävitetään pysyvästi.
                </p>
              </div>
              {/* Pysyvä hävitys on peruuttamaton, joten se on vain pääkäyttäjälle —
                  sama linja kuin tapahtuman pysyvässä poistossa ja säilytysaikojen
                  hävityksessä. */}
              {isAdminUser && currentEventDeletedReports.length > 0 && (
                <button
                  type="button"
                  onClick={() => handlePurgeReports(currentEventDeletedReports)}
                  className="px-4 py-2 text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Tyhjennä roskakori ({currentEventDeletedReports.length})
                </button>
              )}
            </div>

            {currentEventDeletedReports.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
                <Archive className="text-slate-300 mx-auto mb-3" size={40} />
                <p className="text-sm font-medium text-slate-600">Roskakori on tyhjä.</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Kun kirjaus poistetaan avatun raportin roskakorikuvakkeesta, se siirtyy tänne.
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Tunniste</th>
                      <th className="p-4">Tyyppi</th>
                      <th className="p-4">Laatija</th>
                      <th className="p-4">Poistettu</th>
                      <th className="p-4 text-right">Toiminnot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentEventDeletedReports.map((report) => (
                      <tr key={report.id} className="hover:bg-white transition-colors">
                        <td className="p-4 font-mono text-xs text-slate-700">{report.id}</td>
                        <td className="p-4 font-medium text-slate-800">{report.type}</td>
                        <td className="p-4 text-slate-600">{report.author}</td>
                        <td className="p-4 text-slate-600 text-xs">
                          {new Date(report.deletedAt).toLocaleString('fi-FI')}
                          {report.deletedBy ? ` — ${report.deletedBy}` : ''}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => { setOpenedReport(report); setOpenedReportSource('report_list'); }}
                              className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors"
                            >
                              Avaa
                            </button>
                            {(isAdminUser || canEdit(perms, selectedEvent, 'documents_trash')) && (
                              <button
                                type="button"
                                onClick={() => handleRestoreReport(report)}
                                className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
                              >
                                Palauta
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-amber-900">
                Turvallisuusalan kirjauksilla on lakisääteinen säilytysaika. Roskakoriin
                siirtäminen ei ole hävittämistä — kirjaus on yhä tallessa. Tarkista
                säilytys- ja poistokäytännöt toimeksiantajan tietosuojaselosteesta ennen
                pysyvää hävittämistä. Säilytysaikojen tilanne näkyy Asetukset-näkymässä.
              </div>
            </div>
          </div>
        );
      case 'documents_emergency': {
        const emergencyCards = [
          { title: 'Kaikkien alueiden evakuointi', icon: DoorOpen, tone: 'rose', steps: ['Vahvista päätös turvallisuuspäälliköltä', 'Pysäytä esitys ja anna kuulutus', 'Avaa kaikki hätäpoistumistiet', 'Ohjaa yleisö kokoontumispaikoille', 'Kuittaa alueiden tyhjeneminen TIKE:lle'] },
          { title: 'Tulipalo', icon: AlertTriangle, tone: 'amber', steps: ['Hätäilmoitus 112', 'Rajaa alue ja estä pääsy', 'Alkusammutus jos turvallista', 'Opasta pelastuslaitos paikalle', 'Kirjaa tapahtuma-aika ja toimenpiteet'] },
          { title: 'Väkijoukon puristuminen', icon: Users, tone: 'rose', steps: ['Keskeytä esitys välittömästi', 'Avaa sivukäytävät ja purkureitit', 'Ohjaa yleisö taaksepäin kuulutuksella', 'Hälytä ensiapu etualueelle', 'Kirjaa tiheysarvio ja aika'] },
          { title: 'Vakava väkivaltatilanne', icon: ShieldAlert, tone: 'rose', steps: ['Hätäilmoitus 112', 'Suojaa ja siirrä yleisö pois alueelta', 'Älä lähesty ilman poliisia', 'Varmista kohteen tiedot ja kulkusuunta', 'Säilytä tallenteet ja havainnot'] },
          { title: 'Sähkökatko', icon: Wrench, tone: 'slate', steps: ['Varmista varavalaistus', 'Siirry radioyhteyteen', 'Estä pääsy pimeille alueille', 'Ota yhteys tekniseen vastaavaan', 'Arvioi tarve keskeyttää tapahtuma'] },
          { title: 'Sään äkillinen muutos', icon: Cloud, tone: 'sky', steps: ['Seuraa varoituksia', 'Tarkista rakenteiden kiinnitykset', 'Valmistele suojautumisohjeet', 'Harkitse esityksen keskeytystä', 'Tiedota yleisölle ajoissa'] }
        ];
        const toneMap = {
          rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', num: 'bg-rose-600' },
          amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', num: 'bg-amber-600' },
          slate: { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', num: 'bg-slate-600' },
          sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600', num: 'bg-sky-600' }
        };

        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
            <TakaisinLinkki onClick={() => setActiveTab('documents')}>
              Takaisin asiakirjavalikkoon
            </TakaisinLinkki>

            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="text-rose-500" size={24} />
                Hätätilanneohjeet
              </h2>
              <p className="text-sm text-slate-500 mt-1">Toimintakortit. Nämä eivät korvaa tapahtuman pelastussuunnitelmaa.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {emergencyCards.map((card, idx) => {
                const Icon = card.icon;
                const tone = toneMap[card.tone];
                return (
                  <div key={idx} className={`rounded-xl border p-5 ${tone.bg} ${tone.border}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={tone.text} size={20} />
                      <h3 className="font-bold text-slate-800 text-sm">{card.title}</h3>
                    </div>
                    <ol className="space-y-2">
                      {card.steps.map((step, sIdx) => (
                        <li key={sIdx} className="flex gap-2 text-sm text-slate-700">
                          <span className={`shrink-0 w-5 h-5 rounded-full ${tone.num} text-white text-xs font-bold flex items-center justify-center mt-0.5`}>
                            {sIdx + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 bg-slate-800 rounded-xl p-5 text-white">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <PhoneCall size={18} className="text-rose-400" />
                Hätänumerot
              </h3>
              {/* Numerot tulevat tapahtuman perustiedoista (osio 14). Aiemmin korteissa
                  luki pelkkä rooli ilman numeroa, eli hätänumerokortti ilman numeroa.
                  112 on kiinteä, koska se on sama kaikkialla. */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <a href="tel:112" className="bg-slate-700 hover:bg-slate-600 rounded-lg p-3 transition-colors block">
                  <div className="text-2xl font-bold">112</div>
                  <div className="text-xs text-slate-300 mt-0.5">Hätäkeskus</div>
                </a>
                {[
                  { numero: valittuTapahtumaLomake.phoneTurva1, otsikko: 'Turva 1', selite: 'Turvallisuuspäällikkö' },
                  { numero: valittuTapahtumaLomake.phoneTurva2, otsikko: 'Turva 2', selite: 'Turvajohto' },
                  { numero: valittuTapahtumaLomake.phoneTike, otsikko: 'TIKE', selite: 'Tilannekeskus' },
                  { numero: valittuTapahtumaLomake.phoneFirstAid, otsikko: 'EA-päivystys', selite: 'Ensiapu' },
                ].map((kortti) => {
                  const numero = String(kortti.numero || '').trim();
                  return numero ? (
                    <a
                      key={kortti.otsikko}
                      href={`tel:${numero}`}
                      className="bg-slate-700 hover:bg-slate-600 rounded-lg p-3 transition-colors block"
                    >
                      <div className="font-bold">{numero}</div>
                      <div className="text-xs text-slate-300 mt-0.5">{kortti.otsikko} — {kortti.selite}</div>
                    </a>
                  ) : (
                    <div key={kortti.otsikko} className="bg-slate-700/50 rounded-lg p-3">
                      <div className="font-bold text-slate-400">Ei numeroa</div>
                      <div className="text-xs text-slate-400 mt-0.5">{kortti.otsikko} — {kortti.selite}</div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Numerot täytetään tapahtuman perustiedoissa (osio 14, Viestintä ja hätänumerot).
              </p>
            </div>
          </div>
        );
      }
      // 'settings' ei ole enää oma välilehtensä: sivuvalikon painike avaa saman
      // asetusnäkymän kuin profiilivalikko (viewingSettings). Aiemmin täällä oli
      // paikanpitäjäkortti, eli näkyvämpi kahdesta "Asetukset"-kohdasta ei tehnyt mitään.
      default:
        if (activeTab.startsWith('tike_form_')) {
          return (
             <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl text-center py-16">
               <TakaisinLinkki onClick={() => setActiveTab('report_tike')} keskita>
                Takaisin TIKE-valikkoon
              </TakaisinLinkki>
              <Wrench className="text-slate-300 mx-auto mb-4" size={48} />
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Osio rakenteilla</h2>
              <p className="text-slate-500 max-w-md mx-auto">Tämä lomakepohja ({activeTab.replace('tike_form_', '')}) toteutetaan seuraavassa vaiheessa.</p>
            </div>
          );
        }
        return <div>Osio rakenteilla.</div>;
    }
  };

  // Salasananvaihtomodaali — määritelty kerran ja upotettu jokaiseen alla olevaan
  // ylätason näkymään (ne palauttavat oman JSX-puunsa erikseen, ks. ProfileMenu-
  // painikkeen sijainnit), ettei painike jää toimimattomaksi missään näkymässä.
  const changePasswordModal = showChangePassword ? (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={() => { setShowChangePassword(false); resetChangePasswordForm(); }}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <KeyRound size={20} className="text-indigo-500" />
            Vaihda salasana
          </h2>
          <button
            onClick={() => { setShowChangePassword(false); resetChangePasswordForm(); }}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors"
          >
            <X size={22} />
          </button>
        </div>
        <div className="p-5 space-y-4 text-left">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nykyinen salasana</label>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPasswordInput}
              onChange={(e) => setCurrentPasswordInput(e.target.value)}
              className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Uusi salasana</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-400 mt-1">Vähintään 10 merkkiä, iso ja pieni kirjain sekä numero.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vahvista uusi salasana</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPasswordInput}
              onChange={(e) => setConfirmPasswordInput(e.target.value)}
              className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {changePasswordError && <p className="text-sm text-rose-600">{changePasswordError}</p>}
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={() => { setShowChangePassword(false); resetChangePasswordForm(); }}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            Peruuta
          </button>
          <button
            onClick={handleChangePassword}
            disabled={changePasswordSubmitting}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors"
          >
            {changePasswordSubmitting ? 'Tallennetaan…' : 'Vaihda salasana'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Näkyvä ilmoitus tallennusvirheestä. Näytetään kaikissa näkymissä, koska
  // automaattitallennus voi epäonnistua missä tahansa — siksi tämä on osa
  // globalOverlays-elementtiä joka sisällytetään joka näkymään (kuten
  // salasanan vaihto -modaali).
  const saveErrorBanner = saveError ? (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,40rem)]">
      <div className="bg-rose-600 text-white rounded-xl shadow-2xl p-4 flex items-start gap-3">
        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-bold">Muutos ei tallentunut palvelimelle</p>
          <p className="mt-1 text-rose-50">{saveError}</p>
          <p className="mt-1 text-xs text-rose-100">
            Muutos näkyy vain tässä selaimessa. Lataa sivu uudelleen nähdäksesi mikä on
            oikeasti tallennettu, ja tee muutos sen jälkeen uudelleen.
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-xs font-bold bg-white text-rose-700 rounded-lg hover:bg-rose-50 transition-colors"
          >
            Lataa uudelleen
          </button>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="px-3 py-1.5 text-xs font-medium bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors"
          >
            Sulje
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Kaikkiin näkymiin sisällytettävät päällekkäiselementit yhdessä paikassa.
  // Tulosteen esikatselu: dokumentti iframessa omine tyyleineen, jottei sovelluksen
  // tyyli vaikuta siihen milta tuloste nayttaa. Maaritelty tassa ja upotettu
  // globalOverlaysiin, jotta esikatselu toimii myos tapahtumavalinnan
  // "Tallennetut raportit" -listassa eika vain tapahtuman sisaisissa nakymissa.
  const pdfEsikatseluModal = pdfEsikatselu ? (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
      onClick={() => setPdfEsikatselu(null)}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-100 gap-3">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 min-w-0">
            <FileText size={18} className="text-emerald-500 shrink-0" />
            <span className="truncate">{pdfEsikatselu.otsikko}</span>
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => tulostaDokumentti(pdfEsikatselu.html)}
              className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <FileText size={16} />
              Tallenna PDF
            </button>
            <button
              type="button"
              onClick={() => setPdfEsikatselu(null)}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors"
              aria-label="Sulje esikatselu"
            >
              <X size={22} />
            </button>
          </div>
        </div>
        <iframe
          title="Tulosteen esikatselu"
          srcDoc={pdfEsikatselu.html}
          className="flex-1 w-full rounded-b-xl"
        />
      </div>
    </div>
  ) : null;

  // Työntekijän käyttäjätunnusmodaali (työntekijälomakkeen osio 10). Oma modaalinsa eikä
  // navigointi käyttäjähallintaan, jottei keskeneräinen työntekijän muokkaus katoa.
  const empUserModal = empUserModalOpen ? (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={() => setEmpUserModalOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start p-5 border-b border-slate-100 gap-3">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2 min-w-0">
            <KeyRound size={20} className="text-indigo-500 shrink-0" />
            <span className="truncate">{empFormExistingUser ? 'Muokkaa käyttäjätunnusta' : 'Luo käyttäjätunnukset'}</span>
          </h2>
          <button
            onClick={() => setEmpUserModalOpen(false)}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-left">
          {/* Tunnus ja numero muodostuvat automaattisesti — ei syötettäviä kenttiä */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-baseline gap-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Nimi</span>
              <span className="text-sm font-medium text-slate-800 text-right">{buildFullName(empForm) || '—'}</span>
            </div>
            <div className="flex justify-between items-baseline gap-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Käyttäjätunnus</span>
              <span className="text-sm font-mono font-bold text-slate-900 text-right">{empFormUsername || '—'}</span>
            </div>
            <div className="flex justify-between items-baseline gap-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tunnistenumero</span>
              <span className="text-sm font-mono font-bold text-indigo-700 text-right">
                {empForm.displayId
                  ? muotoileTunniste(empForm.displayId)
                  : muotoileTunniste(seuraavaTunnisteNumero(employees, userAdminList))}
              </span>
            </div>
            <p className="text-xs text-slate-500 pt-1 leading-relaxed">
              Molemmat muodostuvat automaattisesti eikä niitä voi muuttaa jälkikäteen:
              tallennetut raportit viittaavat tunnistenumeroon.
            </p>
          </div>

          {empFormExistingUser ? (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex gap-2.5">
                <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Tunnus on olemassa. Oikeudet ja Authenticator-asetukset hoidetaan
                  etusivun "Muokkaa käyttäjiä" -näkymästä.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Aseta uusi salasana</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={empUserPassword}
                  onChange={(e) => setEmpUserPassword(e.target.value)}
                  className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vahvista salasana</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={empUserPassword2}
                  onChange={(e) => setEmpUserPassword2(e.target.value)}
                  className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Vähintään 10 merkkiä, iso ja pieni kirjain sekä numero. Vaihto kirjaa käyttäjän ulos.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Salasana</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={empUserPassword}
                  onChange={(e) => setEmpUserPassword(e.target.value)}
                  className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vahvista salasana</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={empUserPassword2}
                  onChange={(e) => setEmpUserPassword2(e.target.value)}
                  className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">Vähintään 10 merkkiä, iso ja pieni kirjain sekä numero.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2.5">
                <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 leading-relaxed">
                  Uudella tunnuksella ei ole oletuksena mitään sivukartta-oikeuksia, ja se vaatii
                  Authenticator-sovelluksen. Hoida molemmat luonnin jälkeen etusivun
                  "Muokkaa käyttäjiä" -näkymästä.
                </p>
              </div>
            </>
          )}

          {empUserError && <p className="text-sm text-rose-600">{empUserError}</p>}
          {empUserNotice && <p className="text-sm text-emerald-700 font-medium">{empUserNotice}</p>}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={() => setEmpUserModalOpen(false)}
            className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Sulje
          </button>
          <button
            onClick={empFormExistingUser ? handleSetEmployeeUserPassword : handleCreateEmployeeUser}
            disabled={empUserSubmitting}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <CheckCircle size={16} />
            {empUserSubmitting
              ? 'Tallennetaan…'
              : empFormExistingUser ? 'Vaihda salasana' : 'Luo tunnus'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Jakodialogi. Osa globalOverlaysia, jotta se toimii myös silloin kun näkymä vaihtuu.
  const jakoModal = shareTarget ? (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={() => { setShareTarget(null); setLuotuLinkki(null); }}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start p-5 border-b border-slate-100 gap-3">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2 min-w-0">
            <Paperclip size={20} className="text-indigo-500 shrink-0" />
            <span className="truncate">Jaa: {shareTarget.name}</span>
          </h2>
          <button
            onClick={() => { setShareTarget(null); setLuotuLinkki(null); }}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {luotuLinkki ? (
          <div className="p-5 space-y-4">
            {luotuLinkki.url ? (
              <>
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4">
                  <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide mb-2">Jakolinkki</p>
                  <code className="block bg-white border border-emerald-200 rounded-lg px-3 py-2.5 text-xs font-mono break-all text-slate-900">
                    {luotuLinkki.url}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(luotuLinkki.url)}
                    className="mt-3 text-xs font-bold text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
                  >
                    Kopioi leikepöydälle
                  </button>
                </div>
                {shareMode === 'password' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2.5">
                    <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Lähetä salasana <strong>eri kanavaa</strong> kuin linkki. Samassa viestissä
                      salasana ei suojaa miltään.
                    </p>
                  </div>
                )}
                {luotuLinkki.approvalStatus === 'pending' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex gap-2.5">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Pyysit pysyvää linkkiä. Se odottaa pääkäyttäjän hyväksyntää ja toimii
                      siihen asti 7 vuorokautta. Jos hyväksyntää ei tule, linkki vanhenee itsestään.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-900">
                  Jaettu valituille käyttäjille. He näkevät kohteen kirjautuessaan sovellukseen —
                  linkkiä ei tarvita.
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setShareTarget(null); setLuotuLinkki(null); }}
                className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Sulje
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-5 text-left">
              {onHenkilotietoa(shareTarget) && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex gap-2.5">
                  <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-900 leading-relaxed">
                    Kohde on merkitty sisältämään henkilötietoa. Pelkkä linkki ei ole
                    käytettävissä, ja voimassaolo on enintään 7 vuorokautta.
                  </p>
                </div>
              )}

              {/* Jakotapa */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Jakotapa</label>
                <div className="space-y-2">
                  {[
                    ['link', 'Pelkkä linkki', 'Kuka tahansa jolla on linkki pääsee tiedostoon.'],
                    ['password', 'Linkki ja salasana', 'Linkin lisäksi vaaditaan salasana.'],
                    ['users', 'Vain valitut käyttäjät', 'Näkyy sovelluksessa kirjautuneille. Ei linkkiä.'],
                  ].map(([arvo, otsikko, selite]) => {
                    const estetty = arvo === 'link' && onHenkilotietoa(shareTarget);
                    return (
                      <label
                        key={arvo}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border transition-colors ${
                          estetty
                            ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                            : shareMode === arvo
                              ? 'bg-indigo-50 border-indigo-300 cursor-pointer'
                              : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <input
                          type="radio"
                          name="shareMode"
                          disabled={estetty}
                          checked={shareMode === arvo}
                          onChange={() => setShareMode(arvo)}
                          className="w-4 h-4 mt-0.5 text-indigo-600 focus:ring-indigo-500 shrink-0"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-800">{otsikko}</span>
                          <span className="block text-xs text-slate-500">{selite}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {shareMode === 'password' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Salasana</label>
                  <input
                    type="text"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="Vähintään 8 merkkiä"
                    className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Näkyy tässä selväkielisenä, jotta voit välittää sen. Palvelimelle se
                    tallennetaan vain tiivisteenä.
                  </p>
                </div>
              )}

              {shareMode === 'users' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Kenelle jaetaan</label>
                  {userAdminList.length === 0 ? (
                    <p className="text-sm text-slate-500">Ladataan käyttäjiä…</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
                      {userAdminList.map((u) => (
                        <label key={u.username} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-slate-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={shareUsers.includes(u.username)}
                            onChange={() => setShareUsers((prev) => (
                              prev.includes(u.username)
                                ? prev.filter((x) => x !== u.username)
                                : [...prev, u.username]
                            ))}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-slate-700">{u.nickname}</span>
                          <span className="text-xs font-mono text-slate-400 ml-auto">
                            {u.displayId ? muotoileTunniste(u.displayId) : u.username}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Voimassaolo — vain linkkijaoille */}
              {shareMode !== 'users' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Voimassa</label>
                  <div className="flex flex-wrap gap-2">
                    {VOIMASSA_VAIHTOEHDOT.map((v) => (
                      <button
                        key={v.arvo}
                        type="button"
                        onClick={() => setShareVoimassa(v.arvo)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          shareVoimassa === v.arvo
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShareVoimassa('oma')}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        shareVoimassa === 'oma'
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Valitse itse
                    </button>
                    {!onHenkilotietoa(shareTarget) && (
                      <button
                        type="button"
                        onClick={() => setShareVoimassa('ikuinen')}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          shareVoimassa === 'ikuinen'
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Ei vanhene
                      </button>
                    )}
                  </div>

                  {shareVoimassa === 'oma' && (
                    <div className="flex gap-2 mt-3">
                      <input
                        type="date"
                        value={shareOmaPvm}
                        max={new Date(Date.now() + 65 * 864e5).toISOString().split('T')[0]}
                        onChange={(e) => setShareOmaPvm(e.target.value)}
                        className="flex-1 rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="time"
                        value={shareOmaKlo}
                        onChange={(e) => setShareOmaKlo(e.target.value)}
                        className="w-32 rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {shareVoimassa === 'ikuinen' && !isAdminUser && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                      Pysyvä linkki vaatii pääkäyttäjän hyväksynnän. Linkki toimii 7 vuorokautta
                      sillä välin, ja vanhenee itsestään jos hyväksyntää ei tule.
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    Enimmäisaika on 65 vuorokautta. Vanhentuminen on tärkein suoja: linkki voi
                    vuotaa lokeihin, selainhistoriaan ja viestisovellusten esikatseluun.
                  </p>
                </div>
              )}

              {shareMode !== 'users' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Latausraja (valinnainen)</label>
                  <input
                    type="number"
                    min="1"
                    value={shareMaxDownloads}
                    onChange={(e) => setShareMaxDownloads(e.target.value)}
                    placeholder="Ei rajaa"
                    className="w-full sm:w-48 rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {shareError && <p className="text-sm text-rose-600">{shareError}</p>}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShareTarget(null)}
                className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Peruuta
              </button>
              <button
                type="button"
                disabled={shareSubmitting}
                onClick={luoJako}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                <CheckCircle size={16} />
                {shareSubmitting ? 'Luodaan…' : 'Luo jako'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  // Hätäviestin lähetysikkuna. Kolme vaihetta samassa modaalissa: esikatselu (ketkä
  // saavat viestin, mitä siinä lukee), vahvistus ja lopputulos. Vahvistus on tarkoituksella
  // erillinen klikkaus — massaviesti sadalle ihmiselle ei saa lähteä yhdellä painalluksella.
  const smsLahetysModal = smsModal ? (() => {
    const mitat = laskeViestinMitat(smsModal.runko);
    const saajat = smsModal.vastaanottajat.filter((v: any) => v.ok);
    const puuttuvat = smsModal.vastaanottajat.filter((v: any) => !v.ok);
    const kuivaharjoittelu = smsStatus ? smsStatus.dryRun === true : true;
    const voiLahettaa = !smsModal.lataa && !smsModal.lahettaa && saajat.length > 0 && smsModal.runko.trim() !== '';
    const sulje = () => setSmsModal(null);

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={sulje}>
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
            <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2 min-w-0">
              <Smartphone size={20} className="text-rose-500 shrink-0" />
              <span className="truncate">{smsModal.nappi.label}</span>
            </h2>
            <button onClick={sulje} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors shrink-0">
              <X size={22} />
            </button>
          </div>

          <div className="p-5 space-y-4 text-left overflow-y-auto">
            {smsModal.lataa && <p className="text-sm text-slate-500">Haetaan vastaanottajia…</p>}

            {smsModal.virhe && (
              <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{smsModal.virhe}</p>
            )}

            {/* Lopputulos: mitä oikeasti tapahtui. */}
            {smsModal.tulos ? (
              <>
                <div className={`rounded-lg p-4 border ${smsModal.tulos.dryRun ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <p className={`text-sm font-bold ${smsModal.tulos.dryRun ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {smsModal.tulos.dryRun
                      ? `Kuivaharjoittelu: ${smsModal.tulos.lahetetty} viestiä OLISI lähtenyt.`
                      : `${smsModal.tulos.lahetetty} viestiä lähetetty.`}
                  </p>
                  <p className={`text-xs mt-1 ${smsModal.tulos.dryRun ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {smsModal.tulos.dryRun
                      ? 'BulkSMS-API-tunnuksia ei ole asetettu palvelimelle, joten yhtään viestiä ei lähetetty eikä saldoa kulunut.'
                      : `${smsModal.tulos.mitat?.osia || 1} viestiosaa per vastaanottaja (${smsModal.tulos.mitat?.encoding === 'UNICODE' ? 'Unicode' : 'GSM'}).`}
                  </p>
                </div>
                {smsModal.tulos.ohitettu?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Ei tavoitettu ({smsModal.tulos.ohitettu.length})</h4>
                    <ul className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200">
                      {smsModal.tulos.ohitettu.map((v: any, i: number) => (
                        <li key={i} className="px-3 py-2"><span className="font-medium">{v.nimi}</span> — {v.syy}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : !smsModal.lataa && !smsModal.virhe && (
              <>
                {kuivaharjoittelu && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <strong>Kuivaharjoittelutila.</strong> BulkSMS-API-tunnuksia ei ole asetettu palvelimelle,
                    joten lähetys kirjataan lokiin mutta yhtään tekstiviestiä ei lähde.
                  </p>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Viesti</label>
                  <textarea
                    rows={4}
                    value={smsModal.runko}
                    onChange={(e) => setSmsModal((m: any) => (m ? { ...m, runko: e.target.value, vahvistus: false } : m))}
                    className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    placeholder="Kirjoita lähetettävä viesti…"
                  />
                  {/* Pituuslaskuri: usean osan viesti maksaa moninkertaisesti JA näkyy
                      puhelimessa vasta kun kaikki osat ovat saapuneet. */}
                  <p className={`text-xs mt-1 ${mitat.osia > 1 ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                    {mitat.pituus}/{mitat.osanRaja} merkkiä · {mitat.osia} viestiosa{mitat.osia === 1 ? '' : 'a'}
                    {mitat.encoding === 'UNICODE' && ' · Unicode (erikoismerkki lyhentää viestin 70 merkkiin)'}
                    {mitat.osia > 1 && ` · maksaa ${mitat.osia}× ja perillemeno hidastuu`}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Paikkamerkit: <code className="bg-slate-100 px-1 rounded">{'{tapahtuma}'}</code> ja{' '}
                    <code className="bg-slate-100 px-1 rounded">{'{aika}'}</code>. Älä kirjoita viestiin henkilötunnuksia
                    tai muuta arkaluontoista tietoa — tekstiviesti kulkee salaamattomassa televerkossa.
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Vastaanottajat: {smsRyhmanLabel(smsModal.nappi.group)} ({saajat.length})
                  </h4>
                  {saajat.length === 0 ? (
                    <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                      Yhdelläkään vastaanottajalla ei ole kelvollista puhelinnumeroa — viestiä ei voi lähettää.
                    </p>
                  ) : (
                    <ul className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200 max-h-40 overflow-y-auto">
                      {saajat.map((v: any, i: number) => (
                        <li key={i} className="px-3 py-2 flex justify-between gap-2">
                          <span className="truncate"><span className="font-medium text-slate-800">{v.nimi}</span>{v.rooli ? ` · ${v.rooli}` : ''}</span>
                          <span className="font-mono text-slate-400 shrink-0">{v.numero}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {puuttuvat.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1">
                      Jää ilman viestiä ({puuttuvat.length})
                    </h4>
                    <ul className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg divide-y divide-amber-200 max-h-32 overflow-y-auto">
                      {puuttuvat.map((v: any, i: number) => (
                        <li key={i} className="px-3 py-2"><span className="font-medium">{v.nimi}</span> — {v.syy}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-5 border-t border-slate-100 flex justify-end gap-3 shrink-0">
            {smsModal.tulos ? (
              <>
                {/* Toimituskuittaukset saapuvat vasta sekuntien päästä, joten tulosikkuna
                    ei voi näyttää niitä — historianäkymä päivittyy itsestään. */}
                <button
                  onClick={() => { setSmsModal(null); setAvattuLahetys(smsModal.tulos.sendId || null); setViewingSmsLog(true); }}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  Seuraa toimitusta
                </button>
                <button onClick={sulje} className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors">
                  Sulje
                </button>
              </>
            ) : smsModal.vahvistus ? (
              <>
                <button
                  onClick={() => setSmsModal((m: any) => (m ? { ...m, vahvistus: false } : m))}
                  disabled={smsModal.lahettaa}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-60"
                >
                  Peruuta
                </button>
                <button
                  onClick={lahetaSmsViesti}
                  disabled={smsModal.lahettaa}
                  className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-60"
                >
                  {smsModal.lahettaa ? 'Lähetetään…' : `Vahvista: lähetä ${saajat.length} viestiä`}
                </button>
              </>
            ) : (
              <>
                <button onClick={sulje} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Peruuta
                </button>
                <button
                  onClick={() => setSmsModal((m: any) => (m ? { ...m, vahvistus: true } : m))}
                  disabled={!voiLahettaa}
                  className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Lähetä {saajat.length} vastaanottajalle
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  })() : null;

  const globalOverlays = (
    <>
      {changePasswordModal}
      {pdfEsikatseluModal}
      {empUserModal}
      {jakoModal}
      {smsLahetysModal}
      {saveErrorBanner}
    </>
  );

  // ====================== TYÖNTEKIJÄPANKKI (koko yrityksen henkilöstörekisteri) ======================
  if (viewingEmployeeBank) {
    const filteredBankEmployees = employeeBankSearch.trim()
      ? employees.filter(e => e.name.toLowerCase().includes(employeeBankSearch.trim().toLowerCase()))
      : employees;

    return (
      <div className="min-h-screen bg-canvas font-sans flex flex-col">
        {ylapalkki('Työntekijäpankki', { kello: true })}

        <main className="flex-1 p-6 md:p-10">
          <div className="max-w-5xl mx-auto">
            <TakaisinLinkki onClick={() => {
                if (viewingEmployeeBank === 'form') {
                  setViewingEmployeeBank('list');
                  setEditingEmp(null);
                  setEmpForm(emptyEmpForm);
                } else {
                  setViewingEmployeeBank(null);
                }
              }}>
              {viewingEmployeeBank === 'form' ? 'Takaisin työntekijälistaan' : 'Takaisin'}
            </TakaisinLinkki>

            {viewingEmployeeBank === 'form' ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-5xl">
                <div className="mb-6 border-b border-slate-100 pb-4 flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      {editingEmp ? <UserCheck className="text-indigo-500" size={24} /> : <UserPlus className="text-emerald-500" size={24} />}
                      {editingEmp ? 'Muokkaa työntekijää' : 'Kirjaa uusi työntekijä'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {editingEmp ? 'Päivitä työntekijän perustiedot, luvat ja suoritetut koulutukset.' : 'Lisää työntekijän perustiedot, pätevyydet ja suoritetut koulutukset rekisteriin.'}
                    </p>
                  </div>
                  {editingEmp && (isAdminUser || canEdit(perms, selectedEvent, 'global_employee_bank')) && (
                    <button
                      onClick={() => handleDeleteEmployee(editingEmp)}
                      title="Poista työntekijä"
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>

                <form className="space-y-8 text-left" onSubmit={(e) => e.preventDefault()}>
                  {/* Osa 1: Henkilötiedot */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                      <Contact size={18} className="text-slate-400"/>
                      1. Henkilötiedot
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Etunimi</label>
                        <input type="text" value={empForm.firstName} onChange={(e) => updEmpForm('firstName', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Elli Marja Orvokki" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Sukunimi</label>
                        <input type="text" value={empForm.lastName} onChange={(e) => updEmpForm('lastName', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Korhonen" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Henkilötunnus</label>
                        <input type="text" value={empForm.personalId} onChange={(e) => updEmpForm('personalId', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="PPKKVV-XXXX" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Syntymäaika</label>
                        <input type="date" value={empForm.birthDate} onChange={(e) => updEmpForm('birthDate', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Kansalaisuus</label>
                        <input type="text" value={empForm.nationality} onChange={(e) => updEmpForm('nationality', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Suomi" />
                      </div>
                    </div>
                  </div>

                  {/* Osa 2: Yhteystiedot */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                      <Home size={18} className="text-slate-400"/>
                      2. Yhteystiedot
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Katuosoite</label>
                        <input type="text" value={empForm.address} onChange={(e) => updEmpForm('address', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esimerkkikatu 1 A 2" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Postinumero</label>
                          <input type="text" value={empForm.postalCode} onChange={(e) => updEmpForm('postalCode', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="00100" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Postitoimipaikka</label>
                          <input type="text" value={empForm.postalCity} onChange={(e) => updEmpForm('postalCity', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Helsinki" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Sähköposti</label>
                        <input type="email" value={empForm.email} onChange={(e) => updEmpForm('email', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="etunimi.sukunimi@esimerkki.fi" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Matkapuhelin</label>
                        <input type="tel" value={empForm.phone} onChange={(e) => updEmpForm('phone', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="040 123 4567" />
                      </div>
                    </div>
                  </div>

                  {/* Osa 3: Pankkitiedot */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                      <Landmark size={18} className="text-slate-400"/>
                      3. Pankkitiedot
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tilinumero (IBAN)</label>
                        <input type="text" value={empForm.iban} onChange={(e) => updEmpForm('iban', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="FI00 0000 0000 0000 00" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">BIC</label>
                        <input type="text" value={empForm.bic} onChange={(e) => updEmpForm('bic', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. NDEAFIHH" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Pankki</label>
                        <input type="text" value={empForm.bankName} onChange={(e) => updEmpForm('bankName', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Nordea" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Veronumero</label>
                        <input type="text" inputMode="numeric" value={empForm.taxNumber} onChange={(e) => updEmpForm('taxNumber', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="12 numeroa" />
                      </div>
                    </div>
                  </div>

                  {/* Osa 4: Työsuhdetiedot */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                      <Briefcase size={18} className="text-slate-400"/>
                      4. Työsuhdetiedot
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Työsuhteen alkamispäivä</label>
                        <div className="flex gap-2">
                          <input type="date" value={empForm.employmentStart} onChange={(e) => updEmpForm('employmentStart', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" />
                          <button
                            type="button"
                            onClick={() => updEmpForm('employmentStart', paikallinenPaiva())}
                            title="Aseta tämä päivä"
                            className="shrink-0 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors"
                          >
                            Tänään
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Työn suorittamispaikka</label>
                        <input type="text" value={empForm.workLocation} onChange={(e) => updEmpForm('workLocation', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. Tampere ja lähikunnat" />
                      </div>
                    </div>

                    {/* Työsuhteen voimassaolo */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-bold text-slate-800">Työsuhde voimassa</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          ['permanent', 'Toistaiseksi'],
                          ['fixed', 'Määräajan'],
                        ].map(([arvo, label]) => (
                          <label key={arvo} className="flex items-center gap-2.5 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={empForm.employmentType === arvo}
                              onChange={(e) => updEmpForm('employmentType', e.target.checked ? arvo : '')}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0"
                            />
                            <span className="text-sm font-medium text-slate-700">{label}</span>
                          </label>
                        ))}
                      </div>
                      {empForm.employmentType === 'fixed' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Määräaika alkaa</label>
                            <input type="date" value={empForm.employmentFixedFrom} onChange={(e) => updEmpForm('employmentFixedFrom', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Määräaika päättyy</label>
                            <input type="date" value={empForm.employmentFixedTo} onChange={(e) => updEmpForm('employmentFixedTo', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Työaika ja palkkausmuoto */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-bold text-slate-800">Työaika ja palkkausmuoto</p>
                      <div className="space-y-2">
                        {[
                          ['monthly', 'Kuukausipalkka', '120 h / 3 viikkoa'],
                          ['parttime', 'Tuntipalkka (osa-aikainen)', 'alle 112 h 30 min / 3 viikkoa'],
                          ['oncall', 'Erikseen työhön kutsuttava tuntipalkkainen', 'työvoimareservi'],
                        ].map(([arvo, label, tarkenne]) => (
                          <label key={arvo} className="flex items-start gap-2.5 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={empForm.workTimeType === arvo}
                              onChange={(e) => updEmpForm('workTimeType', e.target.checked ? arvo : '')}
                              className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0"
                            />
                            <span className="text-sm text-slate-700">
                              <span className="font-medium">{label}</span>
                              <span className="text-slate-500"> — {tarkenne}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      {(empForm.workTimeType === 'parttime' || empForm.workTimeType === 'oncall') && (
                        <div className="sm:w-72">
                          <label className="block text-xs text-slate-500 mb-1">Vähimmäistyöaika (tuntia / 3 viikkoa)</label>
                          <input type="number" min="0" step="0.5" value={empForm.minHoursPer3Weeks} onChange={(e) => updEmpForm('minHoursPer3Weeks', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. 60" />
                        </div>
                      )}
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                      <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-900 leading-relaxed">
                        Työtehtävissä noudatetaan voimassa olevia lakeja sekä työehtosopimusta.
                      </p>
                    </div>

                    {/* Palkkaus */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                      <p className="text-sm font-bold text-slate-800">Palkkaus</p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Tasopalkka</label>
                          <select value={empForm.payLevel} onChange={(e) => updEmpForm('payLevel', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500">
                            <option value="">Ei valittu</option>
                            {['I', 'II', 'III', 'IIIA', 'IV', 'IVA', 'V'].map((taso) => (
                              <option key={taso} value={taso}>{taso}-taso</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Paikkakuntaluokka</label>
                          <select value={empForm.municipalityClass} onChange={(e) => updEmpForm('municipalityClass', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500">
                            <option value="">Ei valittu</option>
                            <option value="A">A = pääkaupunkiseutu</option>
                            <option value="B">B = muu Suomi</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Tasopalkka (€/kk)</label>
                          <input type="text" inputMode="decimal" value={empForm.basePay} onChange={(e) => updEmpForm('basePay', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="TES-taulukon mukaan" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Henkilökohtainen palkan osa (€/kk)</label>
                          <input type="text" inputMode="decimal" value={empForm.personalPayPart} onChange={(e) => updEmpForm('personalPayPart', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="0,00" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Perusteet</label>
                          <input type="text" value={empForm.personalPayBasis} onChange={(e) => updEmpForm('personalPayBasis', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Millä perusteella osa on sovittu" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Henkilökohtainen palkka, jos sovittu (€/kk)</label>
                          <input type="text" inputMode="decimal" value={empForm.personalPay} onChange={(e) => updEmpForm('personalPay', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Korvaa tasopalkan" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Muu palkka (€/kk)</label>
                          <input type="text" inputMode="decimal" value={empForm.otherPay} onChange={(e) => updEmpForm('otherPay', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="0,00" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Muun palkan perusteet</label>
                          <input type="text" value={empForm.otherPayBasis} onChange={(e) => updEmpForm('otherPayBasis', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. olosuhdelisä" />
                        </div>
                      </div>

                      {/* Kokonaispalkka lasketaan yllä olevista riveistä */}
                      {(() => {
                        const summa = laskeKokonaispalkka(empForm);
                        return (
                          <div className="bg-white border-2 border-indigo-200 rounded-xl p-4">
                            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Kokonaispalkka</p>
                                <p className="text-2xl font-bold text-indigo-700 mt-1">
                                  {muotoileEuro(summa.kuukaudessa)} €/kk
                                </p>
                                <p className="text-sm font-semibold text-slate-600">
                                  {muotoileEuro(summa.tunnissa)} €/tunti
                                </p>
                              </div>
                              <div className="sm:w-44">
                                <label className="block text-xs text-slate-500 mb-1">Tuntijakaja (h/kk)</label>
                                <input type="text" inputMode="decimal" value={empForm.hourDivisor} onChange={(e) => updEmpForm('hourDivisor', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                              {summa.korvaava
                                ? 'Laskettu: henkilökohtainen palkka + muu palkka. Erikseen sovittu henkilökohtainen palkka korvaa tasopalkan ja henkilökohtaisen palkan osan.'
                                : 'Laskettu: tasopalkka + henkilökohtainen palkan osa + muu palkka.'}
                              {' '}Tuntipalkka = kuukausipalkka / tuntijakaja. Oletusjakaja 173,33 vastaa 120 h / 3 viikkoa; tarkista se sopimuksesta.
                            </p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Muut sopimuksen ehdot */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Muut sopimuksen ehdot</label>
                      <textarea rows={3} value={empForm.otherTerms} onChange={(e) => updEmpForm('otherTerms', e.target.value)} className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Esim. koeaika, työvälineet, muut erikseen sovitut ehdot" />
                    </div>

                    {/* Kiinteät sopimusehdot */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <h4 className="text-sm font-bold text-slate-800 mb-2">Salassapitovelvollisuus</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Työntekijä sitoutuu olemaan ilmaisematta tietoja vartiointikohteen turvallisuusjärjestelyistä,
                        vartiointitoimeksiannon osapuolten liike- tai ammattisalaisuutta taikka yksityisen henkilön
                        henkilökohtaisista asioista. Salassapitovelvollisuus ei koske tietojen antamista
                        valvontaviranomaiselle, syyttäjä- tai poliisiviranomaiselle rikoksen selvittämistä varten eikä
                        viranomaiselle, jolla erikoissäännöksen nojalla on oikeus saada näitä tietoja.
                      </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                      <h4 className="text-sm font-bold text-slate-800">Koulutus</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Työntekijä sitoutuu osallistumaan kaikkeen työnantajan osoittamaan ammatilliseen koulutukseen.
                        Perusteeton koulutuksesta kieltäytyminen katsotaan työstä kieltäytymiseksi.
                      </p>

                      <h4 className="text-sm font-bold text-slate-800 pt-1">
                        Vartijan peruskurssin vaikutus työsuhteeseen, työsuhteen purku, lopputilin saamisen edellytykset
                      </h4>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Työntekijän osallistuessa yksityisistä turvallisuuspalveluista annetun lain edellyttämälle
                        vartijan peruskurssille (60 tunnin osio), hän sitoutuu kurssin hyväksytysti suoritettuaan
                        olemaan työnantajan palveluksessa vähintään{' '}
                        <input
                          type="number"
                          min="0"
                          max="4"
                          value={empForm.trainingCommitmentMonths}
                          onChange={(e) => updEmpForm('trainingCommitmentMonths', e.target.value)}
                          className="inline-block w-16 rounded border-slate-300 border px-2 py-0.5 text-sm focus:ring-2 focus:ring-indigo-500 align-baseline"
                          placeholder="0"
                        />{' '}
                        kuukautta (enintään 4 kuukautta) kurssin suorittamisesta lukien. Mikäli työsuhde päättyy
                        työntekijästä johtuvasta syystä ennen mainittua aikaa, työnantaja voi periä työntekijältä
                        työnantajalle kurssista aiheutuneet kustannukset samassa suhteessa kuin neljän kuukauden
                        ajasta on kulumatta. Työnantajan suorittamat kustannukset ovat{' '}
                        <input
                          type="text"
                          inputMode="decimal"
                          value={empForm.trainingCourseCost}
                          onChange={(e) => updEmpForm('trainingCourseCost', e.target.value)}
                          className="inline-block w-24 rounded border-slate-300 border px-2 py-0.5 text-sm focus:ring-2 focus:ring-indigo-500 align-baseline"
                          placeholder="0,00"
                        />{' '}
                        euroa.
                      </p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Mikäli viranomainen peruuttaa työntekijän vartijaksi hyväksymisen, voi se olla peruste
                        työsopimuksen päättämiselle.
                      </p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Työsuhteen päättyessä on aina lopputilin maksamisen edellytyksenä, että työntekijä palauttaa
                        työnantajan hänelle luovuttamat puvun, varusteet, laitteet ja toimikortin (TES 36 §).
                      </p>
                    </div>
                  </div>

                  {/* Osa 5: Ajokortti ja yleiset luvat.
                      Tiivistetty: kortit ovat kahdessa sarakkeessa yhden sijaan, jolloin
                      koko osio mahtuu näytölle ilman vieritystä. */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                      <BadgeCheck size={18} className="text-slate-400"/>
                      5. Ajokortti ja yleiset luvat
                    </h3>

                    {/* Ajokortti: kyllä-valinta + ajo-oikeuden laatu vasta jos rastittu */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <label className="flex items-center gap-2.5 cursor-pointer sm:w-48 shrink-0">
                        <input
                          type="checkbox"
                          checked={empForm.hasDrivingLicense}
                          onChange={(e) => updEmpForm('hasDrivingLicense', e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0"
                        />
                        <span className="text-sm font-medium text-slate-700">Ajokortti</span>
                      </label>
                      <input
                        type="text"
                        disabled={!empForm.hasDrivingLicense}
                        value={empForm.drivingLicense}
                        onChange={(e) => updEmpForm('drivingLicense', e.target.value)}
                        className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                        placeholder="Ajo-oikeuden laatu, esim. B, BE, C"
                      />
                    </div>

                    {/* Pelkkä kyllä/ei, ei voimassaoloa */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        ['adrPermit', 'ADR-lupa'],
                        ['alcoholPass', 'Alkoholipassi'],
                        ['hygienePass', 'Hygieniapassi'],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                          <input type="checkbox" checked={empForm[key]} onChange={(e) => updEmpForm(key, e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0" />
                          <span className="text-sm font-medium text-slate-700">{label}</span>
                        </label>
                      ))}
                    </div>

                    {/* Kyllä/ei + voimassa kuukausi/vuosi jos kyllä — kaksi per rivi */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        ['craneCard', 'craneCardUntil', 'Nosturikortti'],
                        ['electricalWorkCard', 'electricalWorkCardUntil', 'Sähkötyökortti'],
                        ['firstAidEA1', 'firstAidEA1Until', 'Ensiapukortti (EA1)'],
                        ['firstAidEA2', 'firstAidEA2Until', 'Ensiapukortti (EA2)'],
                        ['firstAidEA3', 'firstAidEA3Until', 'Ensiapukortti (EA3)'],
                      ].map(([boolKey, untilKey, label]) => (
                        <div key={boolKey} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                          <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                            <input type="checkbox" checked={empForm[boolKey]} onChange={(e) => updEmpForm(boolKey, e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0" />
                            <span className="text-sm font-medium text-slate-700 truncate">{label}</span>
                          </label>
                          <input
                            type="month"
                            disabled={!empForm[boolKey]}
                            value={empForm[untilKey]}
                            onChange={(e) => updEmpForm(untilKey, e.target.value)}
                            title="Voimassa asti"
                            className="w-36 shrink-0 rounded-lg border-slate-300 border p-1.5 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Osa 6: Turvallisuusalan kortit */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                      <IdCard size={18} className="text-slate-400"/>
                      6. Turvallisuusalan kortit
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        ['hasJvCard', 'jvCard', 'jvCardValidUntil', 'Järjestyksenvalvojakortti'],
                        ['hasGuardCard', 'guardCard', 'guardCardValidUntil', 'Vartijakortti'],
                        ['hasGasPermit', 'gasPermit', 'gasPermitValidUntil', 'Kaasusumuttimen hallussapito'],
                      ].map(([boolKey, numKey, untilKey, label]) => (
                        <div key={numKey} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={empForm[boolKey]}
                              onChange={(e) => updEmpForm(boolKey, e.target.checked)}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0"
                            />
                            <span className="text-sm font-bold text-slate-800">{label}</span>
                          </label>
                          <input
                            type="text"
                            disabled={!empForm[boolKey]}
                            value={empForm[numKey]}
                            onChange={(e) => updEmpForm(numKey, e.target.value)}
                            className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                            placeholder="Kortin numero"
                          />
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Voimassa asti (kk/vuosi)</label>
                            <input
                              type="month"
                              disabled={!empForm[boolKey]}
                              value={empForm[untilKey]}
                              onChange={(e) => updEmpForm(untilKey, e.target.value)}
                              className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Voimankäyttövälineiden kertauskoulutus: turvallisuusalan pätevyys,
                        ei yleinen työturvallisuuskortti — siirretty tänne osiosta 7. */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                      <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                        <input type="checkbox" checked={empForm.trainingRefresher} onChange={(e) => updEmpForm('trainingRefresher', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700">Voimankäyttövälineiden kertauskoulutus</span>
                      </label>
                      <div className="sm:w-48">
                        <input
                          type="date"
                          disabled={!empForm.trainingRefresher}
                          value={empForm.trainingRefresherUntil}
                          onChange={(e) => updEmpForm('trainingRefresherUntil', e.target.value)}
                          title="Voimassa asti"
                          className="w-full rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Osa 7: Työturvallisuuskortit. Tiivistetty samalla tavalla kuin osio 5. */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                      <HardHat size={18} className="text-slate-400"/>
                      7. Työturvallisuuskortit
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        ['roadSafetyCard', 'roadSafetyCardUntil', 'Tieturvakortti'],
                        ['forkliftCard', 'forkliftCardUntil', 'Trukkikortti'],
                        ['hotWorkCard', 'hotWorkCardUntil', 'Tulityökortti'],
                        ['safetyCard', 'safetyCardUntil', 'Työturvallisuuskortti'],
                      ].map(([boolKey, dateKey, label]) => (
                        <div key={boolKey} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                          <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                            <input type="checkbox" checked={empForm[boolKey]} onChange={(e) => updEmpForm(boolKey, e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0" />
                            <span className="text-sm font-medium text-slate-700 truncate">{label}</span>
                          </label>
                          <input
                            type="date"
                            disabled={!empForm[boolKey]}
                            value={empForm[dateKey]}
                            onChange={(e) => updEmpForm(dateKey, e.target.value)}
                            title="Voimassa asti"
                            className="w-40 shrink-0 rounded-lg border-slate-300 border p-1.5 text-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Osa 7: Erityiskoulutukset */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end border-b pb-2">
                      <h3 className="text-md font-semibold text-slate-700 flex items-center gap-2">
                        <UserCheck size={18} className="text-slate-400"/>
                        8. Erityiskoulutukset
                      </h3>
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">Ruksaa vain jos suoritettu ja todistus mukana</span>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                        <input type="checkbox" checked={empForm.trainingForce} onChange={(e) => updEmpForm('trainingForce', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                        <div>
                          <span className="block text-sm font-bold text-slate-800">Järjestyksenvalvojan voimankäytön lisäkoulutus</span>
                          <span className="block text-xs text-slate-500 mt-0.5">Oikeuttaa kantaa voimankäyttövälineitä (jos muut luvat kunnossa).</span>
                        </div>
                      </label>
                      <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                        <input type="checkbox" checked={empForm.trainingGas} onChange={(e) => updEmpForm('trainingGas', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                        <span className="text-sm font-bold text-slate-800">Kaasusumutinkoulutus</span>
                      </label>
                      <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                        <input type="checkbox" checked={empForm.trainingBaton} onChange={(e) => updEmpForm('trainingBaton', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                        <span className="text-sm font-bold text-slate-800">Teleskooppipatukkakoulutus</span>
                      </label>
                      <label className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                        <input type="checkbox" checked={empForm.firearmTraining} onChange={(e) => updEmpForm('firearmTraining', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                        <span className="text-sm font-bold text-slate-800">Vartijan ampuma-asekoulutus</span>
                      </label>
                    </div>
                  </div>

                  {/* Osa 8: Kielitaito */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                      <Languages size={18} className="text-slate-400"/>
                      9. Kielitaito
                    </h3>
                    <div className="space-y-3">
                      {empForm.languages.length === 0 && (
                        <p className="text-sm text-slate-500">Ei lisättyjä kieliä.</p>
                      )}
                      {empForm.languages.map((lang, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-3 sm:items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <input
                            type="text"
                            value={lang.language}
                            onChange={(e) => updEmpLanguage(idx, 'language', e.target.value)}
                            placeholder="Esim. Englanti"
                            className="flex-1 rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500"
                          />
                          <select
                            value={lang.level}
                            onChange={(e) => updEmpLanguage(idx, 'level', Number(e.target.value))}
                            className="rounded-lg border-slate-300 border p-2 text-sm focus:ring-2 focus:ring-indigo-500 sm:w-56"
                          >
                            <option value={5}>5 – Erinomainen</option>
                            <option value={4}>4 – Kiitettävä</option>
                            <option value={3}>3 – Hyvä</option>
                            <option value={2}>2 – Tyydyttävä</option>
                            <option value={1}>1 – Välttävä</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeEmpLanguage(idx)}
                            title="Poista kieli"
                            className="text-rose-500 hover:text-rose-700 p-2 rounded-lg hover:bg-rose-50 transition-colors shrink-0 self-start sm:self-center"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addEmpLanguage}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
                      >
                        <Plus size={16} />
                        Lisää kieli
                      </button>
                    </div>
                  </div>

                  {/* Osa 10: Käyttäjätunnukset. Avaa modaalin eikä vie käyttäjähallintaan,
                      jottei keskeneräinen työntekijän muokkaus katoa navigoinnin mukana. */}
                  <div className="space-y-4">
                    <h3 className="text-md font-semibold text-slate-700 border-b pb-2 flex items-center gap-2">
                      <KeyRound size={18} className="text-slate-400"/>
                      10. Käyttäjätunnukset
                    </h3>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm text-slate-700">
                          <span className="font-medium">Käyttäjätunnus:</span>{' '}
                          {empFormUsername
                            ? <span className="font-mono text-slate-900">{empFormUsername}</span>
                            : <span className="text-slate-400">muodostuu etu- ja sukunimestä</span>}
                        </p>
                        <p className="text-sm text-slate-700">
                          <span className="font-medium">Tunnistenumero:</span>{' '}
                          {empForm.displayId
                            ? <span className="font-mono text-slate-900">{muotoileTunniste(empForm.displayId)}</span>
                            : <span className="text-slate-400">annetaan kun työntekijä tallennetaan</span>}
                        </p>
                        <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                          Raporteissa kirjaajana näkyy tapahtumakohtainen nimimerkki ja tämä numero,
                          esim. "Ensiapu 1 {muotoileTunniste(empForm.displayId || 1028)}". Nimimerkki annetaan
                          kun henkilö lisätään tapahtumaan.
                        </p>
                      </div>
                      {(isAdminUser || canEdit(perms, selectedEvent, 'global_employee_bank')) && (
                        <button
                          type="button"
                          onClick={avaaTunnusModaali}
                          disabled={!empFormUsername}
                          title={empFormUsername ? undefined : 'Täytä ensin etunimi ja sukunimi'}
                          className="shrink-0 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                        >
                          <KeyRound size={16} />
                          {empFormExistingUser ? 'Muokkaa käyttäjätunnusta' : 'Luo käyttäjätunnukset'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => { setViewingEmployeeBank('list'); setEditingEmp(null); setEmpForm(emptyEmpForm); }}
                      className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Peruuta
                    </button>
                    {(isAdminUser || canEdit(perms, selectedEvent, 'global_employee_bank')) && (
                      <button
                        type="button"
                        onClick={handleSaveEmployee}
                        className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <CheckCircle size={18} />
                        {editingEmp ? 'Tallenna muutokset' : 'Tallenna työntekijä'}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Työntekijäpankki</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Kaikki yrityksen työntekijät ({employees.length} kpl). Täältä luodaan, muokataan ja poistetaan työntekijät.
                    </p>
                  </div>
                  {(isAdminUser || canEdit(perms, selectedEvent, 'global_employee_bank')) && (
                    <button
                      onClick={() => { setEditingEmp(null); setEmpForm(emptyEmpForm); setViewingEmployeeBank('form'); }}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm shrink-0"
                    >
                      <UserPlus size={16} />
                      Uusi työntekijä
                    </button>
                  )}
                </div>

                <div className="relative mb-4 max-w-sm">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={employeeBankSearch}
                    onChange={(e) => setEmployeeBankSearch(e.target.value)}
                    placeholder="Hae nimellä..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-4">Nimi</th>
                        <th className="p-4 w-24">Tunniste</th>
                        <th className="p-4">Henkilötunnus</th>
                        <th className="p-4">Kortit</th>
                        <th className="p-4">Yhteystiedot</th>
                        <th className="p-4 text-right">Toiminnot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredBankEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                            {employeeBankSearch.trim() ? 'Ei hakua vastaavia työntekijöitä.' : 'Ei vielä työntekijöitä rekisterissä.'}
                          </td>
                        </tr>
                      ) : filteredBankEmployees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-medium text-slate-800">{emp.name}</td>
                          <td className="p-4">
                            {emp.displayId
                              ? <span className="font-mono text-xs font-bold text-indigo-700">{muotoileTunniste(emp.displayId)}</span>
                              : <span className="text-xs text-slate-400">—</span>}
                          </td>
                          <td className="p-4 font-mono text-xs text-slate-600">{emp.personalId || '—'}</td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {onKortti(emp, 'hasJvCard', 'jvCard') && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">JV</span>}
                              {onKortti(emp, 'hasGuardCard', 'guardCard') && <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">Vartija</span>}
                              {onKortti(emp, 'hasGasPermit', 'gasPermit') && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">Kaasu</span>}
                              {!onKortti(emp, 'hasJvCard', 'jvCard') && !onKortti(emp, 'hasGuardCard', 'guardCard') && !onKortti(emp, 'hasGasPermit', 'gasPermit') && <span className="text-xs text-slate-400">-</span>}
                            </div>
                          </td>
                          <td className="p-4 text-slate-500 text-xs">{[emp.email, emp.phone].filter(Boolean).join(' · ') || '—'}</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => { setEditingEmp(emp); setEmpForm(employeeToFormState(emp)); setViewingEmployeeBank('form'); }}
                                className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                              >
                                Muokkaa
                              </button>
                              {(isAdminUser || canEdit(perms, selectedEvent, 'global_employee_bank')) && (
                                <button
                                  onClick={() => handleDeleteEmployee(emp)}
                                  className="text-rose-600 hover:text-rose-800 font-medium text-xs bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-md transition-colors"
                                >
                                  Poista
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </main>
        {globalOverlays}
      </div>
    );
  }

  // ====================== MUOKKAA KÄYTTÄJIÄ (vain admin) ======================
  if (viewingUserAdmin) {
    const isAdmin = session?.role === 'admin';
    const roleBadge = (role) => (
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
        {role === 'admin' ? 'Pääkäyttäjä' : 'Käyttäjä'}
      </span>
    );

    return (
      <div className="min-h-screen bg-canvas font-sans flex flex-col">
        {ylapalkki('Käyttäjähallinta', { kello: true })}

        <main className="flex-1 p-6 md:p-10">
          <div className="max-w-4xl mx-auto">
            <TakaisinLinkki onClick={() => {
                if (viewingUserAdmin === 'list') {
                  setViewingUserAdmin(null);
                } else {
                  setViewingUserAdmin('list');
                  resetNewUserForm();
                  setEditingPermUser(null);
                }
              }}>
              {viewingUserAdmin === 'list' ? 'Takaisin' : 'Takaisin käyttäjälistaan'}
            </TakaisinLinkki>

            {!isAdmin ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center">
                <ShieldAlert className="text-rose-400 mx-auto mb-4" size={40} />
                <h2 className="text-lg font-bold text-slate-800 mb-1">Ei käyttöoikeutta</h2>
                <p className="text-sm text-slate-500">Käyttäjähallinta on vain pääkäyttäjille.</p>
              </div>
            ) : viewingUserAdmin === 'new' ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <UserPlus className="text-emerald-500" size={24} />
                    Uusi käyttäjä
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Uudella käyttäjällä ei ole oletuksena mitään sivukartta-oikeuksia, ja hän tarvitsee Authenticator-sovelluksen kirjautuakseen — hoida molemmat luonnin jälkeen "Muokkaa oikeuksia" -kohdasta.
                  </p>
                </div>
                <form className="space-y-4 text-left max-w-md" onSubmit={(e) => e.preventDefault()}>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Käyttäjä</label>
                    <input
                      type="text"
                      autoComplete="username"
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(e.target.value)}
                      className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="esim. tikepvst"
                    />
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex gap-2.5">
                    <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Nimimerkkiä ei enää aseteta tässä. Raporttien "Laatija"-kenttä muodostuu
                      tapahtumakohtaisesta nimimerkistä ja henkilön tunnistenumerosta (esim.
                      "Ensiapu 1 #1028") — nimimerkki annetaan kun henkilö lisätään tapahtumaan.
                      Tunnukset kannattaa luoda työntekijäpankista, jolloin nimi, tunnus ja
                      tunnistenumero täyttyvät automaattisesti.
                    </p>
                  </div>
                  {/* Salasanaa ei syötetä: palvelin arpoo sen ja näyttää kerran alla. */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex gap-2.5">
                    <KeyRound size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Salasanaa ei aseteta käsin. Palvelin arpoo väliaikaisen salasanan, joka
                      näytetään sinulle kerran luonnin jälkeen. Käyttäjä kirjautuu sillä ja joutuu
                      heti vaihtamaan sen omakseen.
                    </p>
                  </div>
                  {uusiSalasanaNaytto && (
                    <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4">
                      <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide mb-1">
                        Tunnus {uusiSalasanaNaytto.username} luotu — väliaikainen salasana
                      </p>
                      <code className="block bg-white border border-emerald-200 rounded-lg px-3 py-2.5 text-base font-mono font-bold tracking-wider break-all text-slate-900">
                        {uusiSalasanaNaytto.password}
                      </code>
                      <p className="text-xs text-emerald-800 mt-2">
                        Välitä tämä käyttäjälle. Salasanaa ei voi hakea myöhemmin uudelleen.
                      </p>
                    </div>
                  )}
                  {newUserError && <p className="text-sm text-rose-600">{newUserError}</p>}
                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => { setViewingUserAdmin('list'); resetNewUserForm(); }}
                      className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Peruuta
                    </button>
                    <button
                      type="button"
                      disabled={newUserSubmitting}
                      onClick={handleCreateUser}
                      className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <CheckCircle size={18} />
                      {newUserSubmitting ? 'Luodaan…' : 'Luo käyttäjä'}
                    </button>
                  </div>
                </form>
              </div>
            ) : viewingUserAdmin === 'permissions' && editingPermUser ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8">
                <div className="mb-6 border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <IdCard className="text-indigo-500" size={24} />
                      Käyttöoikeudet: {editingPermUser.username}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Valitse mitkä sivut käyttäjä näkee ja voi muokata.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {roleBadge(editingPermUser.role)}
                    {editingPermUser.role !== 'admin' && (
                      <button
                        type="button"
                        disabled={permForceLogoutSubmitting}
                        onClick={handleForceLogoutUser}
                        title="Mitätöi käyttäjän nykyisen istunnon välittömästi"
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <LogOut size={14} />
                        {permForceLogoutSubmitting ? 'Kirjataan ulos…' : 'Kirjaa käyttäjä ulos'}
                      </button>
                    )}
                  </div>
                </div>
                {permForceLogoutMessage && (
                  <p className="text-sm text-emerald-600 -mt-4 mb-6">{permForceLogoutMessage}</p>
                )}

                <div className="mb-6 max-w-sm">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nimimerkki</label>
                  <input
                    type="text"
                    value={permNickname}
                    onChange={(e) => setPermNickname(e.target.value)}
                    className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {editingPermUser.role !== 'admin' && (
                  <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
                      <Smartphone size={18} className="text-slate-400" />
                      Authenticator-sovellus (TOTP)
                      {permTotpInfo && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${permTotpInfo.totpRequired !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {permTotpInfo.totpRequired !== false ? 'Käytössä' : 'Pois käytöstä'}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Käyttäjä tarvitsee tämän kirjautuakseen. Skannaa QR-koodi Google Authenticatorilla (tai vastaavalla) käyttäjän puhelimeen, tai syötä tekstisalaisuus käsin.
                    </p>
                    {permTotpLoading ? (
                      <p className="text-sm text-slate-500">Ladataan…</p>
                    ) : permTotpInfo ? (
                      <div className="flex flex-col sm:flex-row gap-5 items-start">
                        <img
                          src={permTotpInfo.qrDataUri}
                          alt="Authenticator-sovelluksen QR-koodi"
                          className="w-40 h-40 rounded-lg border border-slate-200 bg-white p-2 shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-3">
                          <div>
                            <label className="block text-xs text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                              <QrCode size={12} />
                              Tekstisalaisuus (jos QR ei skannaudu)
                            </label>
                            <code className="block bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tracking-wide break-all">
                              {permTotpInfo.secret}
                            </code>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={permTotpResetting}
                              onClick={handleResetTotp}
                              className="flex items-center gap-2 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 px-3 py-2 rounded-lg transition-colors"
                            >
                              <RefreshCw size={14} />
                              {permTotpResetting ? 'Nollataan…' : 'Nollaa Authenticator (esim. puhelin kadonnut)'}
                            </button>
                            <button
                              type="button"
                              disabled={permTotpToggling}
                              onClick={handleToggleTotpRequired}
                              className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 px-3 py-2 rounded-lg transition-colors"
                            >
                              <Smartphone size={14} />
                              {permTotpToggling
                                ? 'Päivitetään…'
                                : permTotpInfo.totpRequired !== false
                                  ? 'Poista Authenticator käytöstä'
                                  : 'Ota Authenticator uudelleen käyttöön'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {permTotpError && <p className="text-sm text-rose-600 mt-3">{permTotpError}</p>}
                  </div>
                )}

                {/* Sivukartta-oikeudet tulevat KÄYTTÄJÄTASOLTA (server/roles.js), ei enää
                    käyttäjäkohtaisesti. Täällä valitaan vain taso; itse tason sivuoikeuksia
                    muokataan Sovellusasetuksissa. Näin yhdestä paikasta näkee kenellä on
                    mitkä oikeudet, eikä efektiivisiä oikeuksia tarvitse laskea kahdesta
                    lähteestä. */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <ShieldCheck className="text-indigo-500" size={16} />
                    Käyttäjätaso
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Taso määrää mitä sivuja käyttäjä näkee ja voi muokata. Tasojen sisältöä
                    muokataan Sovellusasetuksista — muutos vaikuttaa kaikkiin tason käyttäjiin heti.
                  </p>

                  {rolesLoading ? (
                    <p className="text-sm text-slate-500">Ladataan tasoja…</p>
                  ) : roles.length === 0 ? (
                    <p className="text-sm text-rose-600">Käyttäjätasoja ei saatu ladattua.</p>
                  ) : (
                    <div className="space-y-2">
                      {roles.map((role) => (
                        <label
                          key={role.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            permRoleId === role.id
                              ? 'bg-indigo-50 border-indigo-300'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="permRole"
                            checked={permRoleId === role.id}
                            onChange={() => setPermRoleId(role.id)}
                            className="w-4 h-4 mt-0.5 text-indigo-600 focus:ring-indigo-500 shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-slate-800">
                              {role.name}
                              {role.builtin && <span className="ml-2 text-xs font-medium text-slate-400">vakio</span>}
                            </span>
                            {role.description && (
                              <span className="block text-xs text-slate-500 mt-0.5">{role.description}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {permRoleId === 'admin' && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                      Pääkäyttäjällä on täydet oikeudet kaikkeen, mukaan lukien käyttäjien ja
                      tasojen hallinta. Anna tämä taso vain harkiten.
                    </p>
                  )}

                  {(() => {
                    if (permRoleId === 'admin') return null;
                    const puuttuvat = tasonPuolet(permRoleId).filter((t) => !permTuotteet.includes(t));
                    if (puuttuvat.length === 0) return null;
                    const nimet: Record<string, string> = {
                      event: 'Turvajohto EVENT',
                      guard: 'Turvajohto GUARD',
                    };
                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3 flex gap-2.5">
                        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-amber-900 leading-relaxed">
                            Taso antaa sivuja puolelta{' '}
                            <strong>{puuttuvat.map((t) => nimet[t]).join(' ja ')}</strong>, mutta
                            tunnuksella ei ole sinne pääsyä. Ilman sitä käyttäjä ei pääse
                            kirjautumaan kyseiselle puolelle lainkaan.
                          </p>
                          <button
                            type="button"
                            onClick={() => setPermTuotteet((prev) => [...new Set([...prev, ...puuttuvat])])}
                            className="mt-2 text-xs font-bold text-amber-900 underline hover:no-underline"
                          >
                            Lisää {puuttuvat.map((t) => nimet[t]).join(' ja ')} alla oleviin puoliin
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Salasanan nollaus: käyttäjä ei muista omaansa */}
                <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <KeyRound className="text-indigo-500" size={16} />
                    Salasana
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Nollaus arpoo uuden väliaikaisen salasanan, joka näytetään sinulle kerran.
                    Käyttäjä kirjautuu sillä ja joutuu heti vaihtamaan sen omakseen.
                  </p>
                  {uusiSalasanaNaytto && uusiSalasanaNaytto.username === editingPermUser.username ? (
                    <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4">
                      <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide mb-2">
                        Väliaikainen salasana — näytetään vain nyt
                      </p>
                      <code className="block bg-white border border-emerald-200 rounded-lg px-3 py-2.5 text-base font-mono font-bold tracking-wider break-all text-slate-900">
                        {uusiSalasanaNaytto.password}
                      </code>
                      <p className="text-xs text-emerald-800 mt-2">
                        Välitä tämä käyttäjälle. Salasanaa ei voi hakea myöhemmin uudelleen —
                        jos se katoaa, nollaa uudestaan.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResetUserPassword}
                      className="flex items-center gap-2 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-lg transition-colors"
                    >
                      <RefreshCw size={14} />
                      Nollaa salasana
                    </button>
                  )}
                </div>

                {/* Tuotepääsy. Uusi koodi käyttää teematokeneita (ks. src/TEEMA.md) — värit ovat
                    EVENT-puolella samat kuin viereisissä slate-luokissa, mutta lohko siirtyy
                    aikanaan jaettuun kansioon sellaisenaan. */}
                {editingPermUser.role !== 'admin' && (
                  <>
                  <div className="mt-6 bg-sunken border border-line rounded-xl p-5">
                    <h3 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
                      <ShieldCheck className="text-accent" size={16} />
                      Puolet
                    </h3>
                    <p className="text-xs text-ink-muted mb-4">
                      Mihin puoliin tunnus pääsee kirjautumaan. Sama tunnus käy molempiin, ja
                      valinta ratkaisee vain sen kumman osoitteen takaa sovellus aukeaa —
                      sivukartta-oikeudet määräävät edelleen mitä hän siellä näkee. Vähintään
                      yksi puoli on valittava.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'event', nimi: 'Turvajohto EVENT', selite: 'Tapahtumat' },
                        { id: 'guard', nimi: 'Turvajohto GUARD', selite: 'Vartiointi' },
                      ].map((t) => (
                        <label
                          key={t.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                            permTuotteet.includes(t.id)
                              ? 'bg-accent-soft border-accent text-accent-ink'
                              : 'bg-surface border-line text-ink-body hover:bg-sunken'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={permTuotteet.includes(t.id)}
                            onChange={() => vaihdaTuote(t.id)}
                            className="w-4 h-4 text-accent rounded border-line-strong focus:ring-accent"
                          />
                          {t.nimi}
                          <span className="text-xs text-ink-subtle">({t.selite})</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2">
                      <Layers className="text-indigo-500" size={16} />
                      Tapahtumarajaus
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Jos yhtään tapahtumaa ei ole valittu, käyttäjä näkee kaikkien tapahtumien datan
                      normaaliin tapaan (ei rajoitusta). Valitsemalla tapahtumia käyttäjä näkee ja voi
                      muokata vain niiden kirjauksia, raportteja ja riskiarviointeja — Sivukartta-
                      oikeudet määräävät edelleen mitä sivuja hän ylipäätään näkee, tämä vain mitkä
                      tapahtumat niillä sivuilla näkyvät.
                    </p>
                    {events.length === 0 ? (
                      <p className="text-sm text-slate-500">Ei tapahtumia.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {events.map((ev) => (
                          <label
                            key={ev.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                              permEventAccess.includes(ev.id)
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={permEventAccess.includes(ev.id)}
                              onChange={() => handleToggleEventAccess(ev.id)}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                            />
                            {ev.name}
                            {ev.archived && <span className="text-xs text-slate-400">(arkistoitu)</span>}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  </>
                )}

                {permSaveError && <p className="text-sm text-rose-600 mt-4">{permSaveError}</p>}

                <div className="pt-6 mt-2 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setViewingUserAdmin('list'); setEditingPermUser(null); }}
                    className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Peruuta
                  </button>
                  <button
                    type="button"
                    disabled={permSaving}
                    onClick={handleSavePermissions}
                    className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <CheckCircle size={18} />
                    {permSaving ? 'Tallennetaan…' : 'Tallenna oikeudet'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Muokkaa käyttäjiä</h2>
                    <p className="text-sm text-slate-500 mt-1">Kaikki sovelluksen käyttäjätunnukset ja niiden sivukartta-oikeudet.</p>
                  </div>
                  <button
                    onClick={() => { resetNewUserForm(); setViewingUserAdmin('new'); }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm shrink-0"
                  >
                    <UserPlus size={16} />
                    Uusi käyttäjä
                  </button>
                </div>

                {userAdminError && <p className="text-sm text-rose-600 mb-4">{userAdminError}</p>}

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-4">Nimimerkki</th>
                        <th className="p-4 w-24">Tunniste</th>
                        <th className="p-4">Käyttäjätaso</th>
                        <th className="p-4">Käyttäjätunnus</th>
                        <th className="p-4">Luotu</th>
                        <th className="p-4 text-right">Toiminnot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {userAdminLoading ? (
                        <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Ladataan…</td></tr>
                      ) : userAdminList.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Ei käyttäjiä.</td></tr>
                      ) : userAdminList.map((u) => (
                        <tr key={u.username} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-medium text-slate-800">{u.nickname}</td>
                          <td className="p-4">
                            {u.displayId
                              ? <span className="font-mono text-xs font-bold text-indigo-700">{muotoileTunniste(u.displayId)}</span>
                              : <span className="text-xs text-slate-400">—</span>}
                          </td>
                          <td className="p-4 text-slate-600 text-xs">
                            {roles.find((r) => r.id === u.roleId)?.name || u.roleId || '—'}
                          </td>
                          <td className="p-4 font-mono text-xs text-slate-600">{u.username}</td>
                          <td className="p-4 text-slate-500 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString('fi-FI') : '—'}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleOpenPermissions(u)}
                              className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                            >
                              Muokkaa oikeuksia
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </main>
        {globalOverlays}
      </div>
    );
  }

  // ====================== AUDIT-LOKI (vain admin) ======================
  // Vanhentuneiden tapahtumailmoitusten hävittäminen. Poisto tehdään yhteisen
  // tallennusapufunktion kautta allowEmpty-lipulla, joten se on tarkistettu:
  // epäonnistuminen näkyy bannerissa eikä jää huomaamatta. Liitetiedostot poistuvat
  // palvelimella samassa kirjoituksessa (ks. server/index.js).
  const handleDeleteExpiredReports = async () => {
    const { vanhentuneet } = jaotteleSailytysajan(reports);
    if (vanhentuneet.length === 0) return;
    const rivi = String.fromCharCode(10);
    const vahvistus = window.prompt(
      [
        `HÄVITETÄÄN ${vanhentuneet.length} ilmoitusta pysyvästi.`,
        '',
        'Näiden lakisääteinen säilytysaika (2 vuotta laatimisvuoden päättymisestä)',
        'on umpeutunut. Poistoa ei voi perua, ja myös liitetiedostot poistetaan.',
        '',
        'Vahvista kirjoittamalla: HÄVITÄ',
      ].join(rivi)
    );
    if (vahvistus === null) return;
    if (vahvistus.trim().toUpperCase() !== 'HÄVITÄ') {
      alert('Vahvistus ei täsmää — mitään ei poistettu.');
      return;
    }
    const poistettavat = new Set(vanhentuneet);
    const jaljelle = reports.filter((r) => !poistettavat.has(r));
    const ok = await tallennaKokoelma('reports', jaljelle, { allowEmpty: true });
    if (!ok) return;
    if (jaljelle.length === 0) ohitaSeuraavaTallennus.current.add('reports'); // virhe näkyy bannerissa; tilaa ei muuteta jotta näkymä pysyy totuudenmukaisena
    setReports(jaljelle);
    alert(
      [
        `${vanhentuneet.length} ilmoitusta hävitettiin pysyvästi.`,
        '',
        'Poisto varmistettiin palvelimelta ja liitetiedostot poistettiin levyltä.',
        'Huom: data säilyy vielä levyn varmuuskopioissa niiden säilytysajan (7 vrk) verran.',
      ].join(rivi)
    );
  };

  // ====================== HÄTÄVIESTIEN LÄHETYSHISTORIA JA TOIMITUSTILAT ======================
  if (viewingSmsLog) {
    const omatLahetykset = smsLog
      .filter((l: any) => (l.eventId || 'fesx') === selectedEvent)
      .sort((a: any, b: any) => String(b.ts || '').localeCompare(String(a.ts || '')));

    return (
      <div className="min-h-screen bg-canvas font-sans flex flex-col">
        {ylapalkki('Hätäviestien lähetyshistoria', { kello: true })}

        <main className="flex-1 p-6 md:p-10">
          <div className="max-w-4xl mx-auto text-left">
            <TakaisinLinkki onClick={() => { setViewingSmsLog(false); setAvattuLahetys(null); }}>
              Takaisin
            </TakaisinLinkki>

            <h2 className="text-2xl font-bold text-slate-800 mb-1">Lähetetyt hätäviestit</h2>
            <p className="text-sm text-slate-500 mb-6">
              {findEventName(selectedEvent, events)} · toimitustilat päivittyvät automaattisesti
              BulkSMS:n toimituskuittauksista.
            </p>

            {!smsStatus?.webhookKaytossa && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
                <strong>Toimituskuittaukset eivät ole käytössä.</strong> Webhook-salaisuutta ei ole asetettu
                palvelimelle, joten viestit näkyvät tilassa "Vastaanotettu" eikä perillemenoa voi todentaa.
              </p>
            )}

            {smsLogError && <p className="text-sm text-rose-600 mb-4">{smsLogError}</p>}

            {omatLahetykset.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
                <Smartphone className="text-slate-300 mx-auto mb-4" size={40} />
                <p className="text-sm text-slate-500">Tästä tapahtumasta ei ole lähetetty yhtään hätäviestiä.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {omatLahetykset.map((lahetys: any) => {
                  const tilanne = koostaSmsTilanne(lahetys);
                  const auki = avattuLahetys === lahetys.id;
                  const vastaukset = smsReplies.filter((v: any) => v.sendId === lahetys.id);
                  return (
                    <div key={lahetys.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setAvattuLahetys(auki ? null : lahetys.id)}
                        className="w-full text-left p-5 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              <span className="truncate">{lahetys.label}</span>
                              {lahetys.dryRun && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                                  KUIVAHARJOITTELU
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(lahetys.ts).toLocaleString('fi-FI')} · {lahetys.user} · {smsRyhmanLabel(lahetys.group)}
                            </p>
                          </div>
                          <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${auki ? 'rotate-180' : ''}`} />
                        </div>

                        {/* Toimitustilanne yhdellä silmäyksellä: hätätilanteessa oleellisin
                            luku on kuinka moni EI saanut viestiä. */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {tilanne.perilla > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                              {tilanne.perilla} perillä
                            </span>
                          )}
                          {tilanne.matkalla > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700">
                              {tilanne.matkalla} matkalla
                            </span>
                          )}
                          {tilanne.epaonnistui > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                              {tilanne.epaonnistui} ei perille
                            </span>
                          )}
                          {tilanne.kuivaharjoittelu > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                              {tilanne.kuivaharjoittelu} simuloitu
                            </span>
                          )}
                          {lahetys.skipped?.length > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                              {lahetys.skipped.length} ilman numeroa
                            </span>
                          )}
                          {vastaukset.length > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                              {vastaukset.length} vastausta
                            </span>
                          )}
                        </div>
                      </button>

                      {auki && (
                        <div className="border-t border-slate-100 p-5 space-y-4 bg-slate-50">
                          <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Lähetetty viesti</h4>
                            <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-lg p-3 font-mono leading-snug">
                              {lahetys.body}
                            </p>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                              Vastaanottajat ({lahetys.recipients?.length || 0})
                            </h4>
                            <ul className="text-xs bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                              {(lahetys.recipients || []).map((s: any, i: number) => {
                                const meta = smsTilaMeta(s.status);
                                return (
                                  <li key={i} className="px-3 py-2 flex justify-between items-center gap-2">
                                    <span className="truncate">
                                      <span className="font-medium text-slate-800">{s.nimi || '(tuntematon)'}</span>
                                      {s.rooli ? <span className="text-slate-500"> · {s.rooli}</span> : null}
                                      <span className="text-slate-400 font-mono ml-2">{s.numero}</span>
                                    </span>
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${meta.tone}`}>
                                      {meta.label}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>

                          {lahetys.skipped?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1">
                                Ei tavoitettu ({lahetys.skipped.length})
                              </h4>
                              <ul className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg divide-y divide-amber-200">
                                {lahetys.skipped.map((v: any, i: number) => (
                                  <li key={i} className="px-3 py-2"><span className="font-medium">{v.nimi}</span> — {v.syy}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {vastaukset.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-1">
                                Vastaukset ({vastaukset.length})
                              </h4>
                              <ul className="text-xs bg-white border border-indigo-200 rounded-lg divide-y divide-indigo-100">
                                {vastaukset.map((v: any) => (
                                  <li key={v.id} className="px-3 py-2">
                                    <div className="flex justify-between gap-2">
                                      <span className="font-medium text-slate-800 truncate">
                                        {v.nimi || v.numero || '(tuntematon)'}
                                      </span>
                                      <span className="text-slate-400 shrink-0">
                                        {v.ts ? new Date(v.ts).toLocaleString('fi-FI') : ''}
                                      </span>
                                    </div>
                                    <p className="text-slate-700 mt-1">{v.body}</p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {lahetys.repliable && vastaukset.length === 0 && (
                            <p className="text-xs text-slate-500">
                              Viesti lähetettiin vastattavana, mutta yhtään vastausta ei ole vielä saapunut.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
        {globalOverlays}
      </div>
    );
  }

  if (viewingSettings) {
    const arkistoidutAikataulut = events
      .filter((e: any) => e.archived)
      .map((tapahtuma: any) => ({ tapahtuma, aikataulu: tapahtumanPoistoaikataulu(tapahtuma, reports) }));
    const arkistoidutPoistettavissa = arkistoidutAikataulut.filter(({ aikataulu }: any) => aikataulu.poistettavissa).length;

    return (
      <div className="min-h-screen bg-canvas font-sans flex flex-col">
        {ylapalkki('Sovellusasetukset')}

        <main className="flex-1 p-6 md:p-10">
          <div className="max-w-4xl mx-auto text-left">
            <TakaisinLinkki onClick={() => setViewingSettings(false)}>
              Takaisin
            </TakaisinLinkki>

            <h2 className="text-2xl font-bold text-slate-800 mb-1">Sovellusasetukset</h2>
            <p className="text-sm text-slate-500 mb-8">Käyttäjätasot, palvelimen tallennustila ja lakisääteiset säilytysajat.</p>

            <Kayttajatasot
              roles={roles}
              rolesLoading={rolesLoading}
              kayttajat={userAdminList}
              sivukartat={ASETUSTEN_SIVUKARTAT}
              isAdmin={isAdminUser}
              onMuuttui={() => { fetchRoles(); fetchUserAdminList(); }}
            />

            {/* ==================== PIKATOIMINTONAPIT (hätätekstiviestit) ==================== */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Smartphone size={18} className="text-rose-500" />
                Pikatoiminnot (hätätekstiviestit)
              </h3>
              <p className="text-sm text-slate-500 mt-1 mb-5">
                Yläpalkin Pikatoiminnot-valikon napit. Jokaiselle napille valitaan vastaanottajaryhmä
                ja viestipohja. Vastaanottajat ratkaistaan aina sen tapahtuman mukaan, joka on auki —
                sama nappi tavoittaa eri tapahtumassa eri ihmiset, joten nappeja ei tarvitse
                määritellä tapahtumakohtaisesti.
              </p>

              {/* Integraation tila. Ilman API-tunnuksia kaikki napit ovat kuivaharjoittelua:
                  toiminto toimii ja kirjautuu lokiin, mutta yhtään viestiä ei lähde. */}
              <div className="mb-5">
                {!smsStatus ? (
                  <button
                    type="button"
                    onClick={() => haeSmsTila(true)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Tarkista BulkSMS-yhteyden tila ja saldo
                  </button>
                ) : smsStatus.dryRun ? (
                  <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="font-bold">Kuivaharjoittelutila — viestit eivät lähde.</p>
                    <p className="text-xs mt-1">
                      Palvelimelle ei ole asetettu ympäristömuuttujia <code className="bg-amber-100 px-1 rounded">BULKSMS_TOKEN_ID</code> ja{' '}
                      <code className="bg-amber-100 px-1 rounded">BULKSMS_TOKEN_SECRET</code>. Napit toimivat muuten
                      normaalisti: vastaanottajat ratkaistaan, lähetys kirjataan audit-lokiin, mutta yhtään
                      tekstiviestiä ei lähetetä eikä saldoa kulu.
                    </p>
                  </div>
                ) : !smsStatus.saldoLuettu ? (
                  <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                    {smsStatus.virhe || 'BulkSMS-yhteyden tarkistus epäonnistui.'}
                  </p>
                ) : (
                  (() => {
                    // Saldovaroitus on oma tilansa: yhteys toimii, mutta saldo ei riitä
                    // isoon massaviestiin. Se on eri asia kuin rikkinäinen integraatio.
                    const vahissa = typeof smsStatus.saldo === 'number' && smsStatus.saldo < (smsStatus.varoitusraja || 1000);
                    return (
                      <div className={`text-sm rounded-lg p-3 border ${vahissa ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                        <p className="font-bold">
                          {vahissa
                            ? `Saldo vähissä: ${Math.round(smsStatus.saldo)} viestiä jäljellä.`
                            : 'BulkSMS-yhteys kunnossa — napit lähettävät oikeita viestejä.'}
                        </p>
                        <p className="text-xs mt-1">
                          Saldoa jäljellä {smsStatus.saldo === null ? '—' : Math.round(smsStatus.saldo)} yksikköä
                          {typeof smsStatus.kiintioJaljella === 'number' && `, päivän kiintiöstä ${smsStatus.kiintioJaljella} viestiä`}.
                          Yksi tavallinen viesti kuluttaa noin yhden yksikön per vastaanottaja, joten
                          esimerkiksi 200 hengen tapahtuma kuluttaa 200 yksikköä yhdellä painalluksella.
                          {vahissa && ' Kytke Auto Top-up päälle BulkSMS-hallintapaneelista, jottei saldo lopu kesken hätätilanteen.'}
                        </p>
                        {smsStatus.saldoTarkistettu && (
                          <p className="text-xs mt-1 opacity-75">
                            Tarkistettu {new Date(smsStatus.saldoTarkistettu).toLocaleString('fi-FI')} · varoitusraja {smsStatus.varoitusraja}
                          </p>
                        )}
                      </div>
                    );
                  })()
                )}

                {/* Webhookin tila. Ilman sitä viestit lähtevät mutta perillemenoa ei voi
                    todentaa eivätkä työntekijöiden vastaukset päädy järjestelmään. */}
                {smsStatus && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${smsStatus.webhookKaytossa ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {smsStatus.webhookKaytossa ? 'Toimituskuittaukset käytössä' : 'Toimituskuittaukset pois käytöstä'}
                    </span>
                    {smsStatus.jonossa > 0 && (
                      <span className="text-xs text-slate-500">{smsStatus.jonossa} kuittausta käsittelyjonossa</span>
                    )}
                    <button
                      type="button"
                      onClick={() => haeSmsTila(true)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Tarkista nyt
                    </button>
                  </div>
                )}
                {smsStatus && !smsStatus.webhookKaytossa && (
                  <p className="text-xs text-slate-500 mt-2">
                    Aseta palvelimelle <code className="bg-slate-100 px-1 rounded">BULKSMS_WEBHOOK_SECRET</code> ja lisää
                    BulkSMS-hallintapaneeliin webhook osoitteeseen{' '}
                    <code className="bg-slate-100 px-1 rounded">https://turvajohto-os.fi/api/webhooks/bulksms?secret=…</code>{' '}
                    (Trigger scope: sekä SENT että RECEIVED).
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {naytettavatNapit.length === 0 && (
                  <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    Yhtään nappia ei ole määritelty — Pikatoiminnot-valikko on tyhjä.
                  </p>
                )}

                {naytettavatNapit.map((nappi) => {
                  const mitat = laskeViestinMitat(nappi.body);
                  return (
                    <div key={nappi.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            {nappi.style === 'danger' && <AlertTriangle size={14} className="text-rose-500 shrink-0" />}
                            <span className="truncate">{nappi.label}</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {smsRyhmanLabel(nappi.group)}
                            {nappi.repliable && ' · vastattavissa'}
                            {nappi.body
                              ? ` · ${mitat.pituus} merkkiä, ${mitat.osia} viestiosa${mitat.osia === 1 ? '' : 'a'}`
                              : ' · teksti kirjoitetaan lähetettäessä'}
                          </p>
                          {nappi.body && (
                            <p className="text-xs text-slate-600 mt-2 bg-white border border-slate-200 rounded-lg p-2 font-mono leading-snug">
                              {nappi.body}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => avaaNappiMuokkaus(nappi)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded transition-colors"
                          >
                            Muokkaa
                          </button>
                          <button
                            type="button"
                            onClick={() => poistaNappi(nappi)}
                            className="text-xs font-medium text-rose-600 hover:text-rose-800 px-2 py-1 rounded transition-colors"
                          >
                            Poista
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!smsButtonDraft && (
                <button
                  type="button"
                  onClick={avaaUusiNappi}
                  className="mt-4 px-4 py-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2"
                >
                  <PlusCircle size={16} />
                  Lisää nappi
                </button>
              )}

              {smsButtonDraft && (
                <div className="mt-5 pt-5 border-t border-slate-100 space-y-4">
                  <h4 className="text-sm font-bold text-slate-700">
                    {smsButtonDraft.uusi ? 'Uusi pikatoimintonappi' : `Muokataan: ${smsButtonDraft.label || '(nimetön)'}`}
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Napin nimi</label>
                    <input
                      type="text"
                      value={smsButtonDraft.label}
                      onChange={(e) => setSmsButtonDraft((d: any) => ({ ...d, label: e.target.value }))}
                      className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="esim. Kaikkien alueiden evakuointi"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vastaanottajat</label>
                    <select
                      value={smsButtonDraft.group}
                      onChange={(e) => setSmsButtonDraft((d: any) => ({ ...d, group: e.target.value }))}
                      className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      {SMS_RYHMAT.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    <p className="text-xs text-slate-400 mt-1">
                      {SMS_RYHMAT.find((r) => r.id === smsButtonDraft.group)?.selite}
                    </p>
                  </div>

                  {smsButtonDraft.group === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Numerot (yksi per rivi)</label>
                      <textarea
                        rows={3}
                        value={smsButtonDraft.customNumbersText}
                        onChange={(e) => setSmsButtonDraft((d: any) => ({ ...d, customNumbersText: e.target.value }))}
                        className="w-full rounded-lg border-slate-300 border p-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                        placeholder={'040 123 4567\n+358 50 987 6543'}
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Suomalaiset numerot muunnetaan automaattisesti kansainväliseen muotoon. Numerot joita
                        ei voi tulkita näytetään lähetysikkunassa virheenä eikä niihin lähetetä mitään.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Viestipohja</label>
                    <textarea
                      rows={3}
                      value={smsButtonDraft.body}
                      onChange={(e) => setSmsButtonDraft((d: any) => ({ ...d, body: e.target.value }))}
                      className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="Jätä tyhjäksi jos teksti kirjoitetaan aina lähetettäessä."
                    />
                    {(() => {
                      const mitat = laskeViestinMitat(smsButtonDraft.body);
                      return (
                        <p className={`text-xs mt-1 ${mitat.osia > 1 ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                          {mitat.pituus}/{mitat.osanRaja} merkkiä · {mitat.osia} viestiosa{mitat.osia === 1 ? '' : 'a'}
                          {mitat.encoding === 'UNICODE' && ' · erikoismerkki pudottaa rajan 70 merkkiin'}
                          {mitat.osia > 1 && ' · usean osan viesti maksaa moninkertaisesti ja tulee perille hitaammin'}
                        </p>
                      );
                    })()}
                    <p className="text-xs text-slate-400 mt-1">
                      Paikkamerkit: <code className="bg-slate-100 px-1 rounded">{'{tapahtuma}'}</code> ja{' '}
                      <code className="bg-slate-100 px-1 rounded">{'{aika}'}</code>. Aloita viesti tunnisteella
                      (esim. "TURVAJOHTO:"), koska lähettäjänä näkyy numero — aakkosnumeerinen lähettäjätunnus
                      vaatii Traficomin rekisteröinnin, joka astuu voimaan vasta kolmen kuukauden kuluttua.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-5">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={smsButtonDraft.style === 'danger'}
                        onChange={(e) => setSmsButtonDraft((d: any) => ({ ...d, style: e.target.checked ? 'danger' : 'neutral' }))}
                        className="rounded border-slate-300"
                      />
                      Korosta punaisena (hätätoiminto)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={smsButtonDraft.repliable === true}
                        onChange={(e) => setSmsButtonDraft((d: any) => ({ ...d, repliable: e.target.checked }))}
                        className="rounded border-slate-300"
                      />
                      Vastattavissa (työntekijä voi kuitata viestiin)
                    </label>
                  </div>

                  {smsButtonError && <p className="text-sm text-rose-600">{smsButtonError}</p>}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => { setSmsButtonDraft(null); setSmsButtonError(null); }}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Peruuta
                    </button>
                    <button
                      type="button"
                      onClick={tallennaNappiLuonnos}
                      className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <CheckCircle size={18} />
                      Tallenna nappi
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Tallennustila isAdmin={isAdminUser} />

            <Sailytysajat
              raportit={reports}
              isAdmin={isAdminUser}
              onHavita={handleDeleteExpiredReports}
              lisamerkki={
                arkistoidutPoistettavissa > 0 ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-warning-soft text-warning-ink">
                    {arkistoidutPoistettavissa} tapahtumaa poistettavissa
                  </span>
                ) : null
              }
            >
                  {/* Arkistoidut tapahtumat ja niiden poistoaikataulu */}
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Archive size={16} className="text-slate-400" />
                      Arkistoidut tapahtumat
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Tapahtuman tiedot voi hävittää kun sen viimeisenkin ilmoituksen säilytysaika on
                      umpeutunut, ja hävitys on tehtävä kuukauden kuluessa siitä. Poisto tehdään
                      Tallennetut tapahtumat -näkymästä.
                    </p>

                    {arkistoidutAikataulut.length === 0 ? (
                      <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 mt-3">
                        Arkistossa ei ole tapahtumia.
                      </p>
                    ) : (
                      <div className="border border-slate-200 rounded-lg overflow-hidden mt-3">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                              <th className="p-3 text-left font-semibold">Tapahtuma</th>
                              <th className="p-3 text-left font-semibold">Ilmoituksia</th>
                              <th className="p-3 text-left font-semibold">Voi poistaa</th>
                              <th className="p-3 text-left font-semibold">Poistettava viimeistään</th>
                              <th className="p-3 text-left font-semibold">Tila</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {arkistoidutAikataulut.map(({ tapahtuma, aikataulu }: any) => (
                              <tr key={tapahtuma.id} className={aikataulu.myohassa ? 'bg-rose-50' : undefined}>
                                <td className="p-3">
                                  <div className="font-medium text-slate-800">{tapahtuma.name}</div>
                                  <div className="text-xs text-slate-500">{tapahtuma.client}</div>
                                </td>
                                <td className="p-3 text-slate-600">
                                  {aikataulu.ilmoituksia}
                                  {aikataulu.puuttuvia > 0 && (
                                    <span className="text-xs text-amber-600 block">
                                      {aikataulu.puuttuvia} ilman päivämäärää
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {aikataulu.voiPoistaa ? (
                                    <span title={aikataulu.epavarma ? 'Osalta ilmoituksia puuttuu laatimispäivä, joten tämä on aikaisin mahdollinen ajankohta — ei varma.' : undefined}>
                                      {aikataulu.epavarma ? 'aikaisintaan ' : ''}
                                      {aikataulu.voiPoistaa.toLocaleDateString('fi-FI')}
                                    </span>
                                  ) : aikataulu.ilmoituksia === 0 ? (
                                    'heti'
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {aikataulu.pitaaPoistaa ? aikataulu.pitaaPoistaa.toLocaleDateString('fi-FI') : '—'}
                                </td>
                                <td className="p-3">
                                  {aikataulu.epavarma ? (
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                                      Päivämäärä puuttuu
                                    </span>
                                  ) : aikataulu.myohassa ? (
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                                      Myöhässä
                                    </span>
                                  ) : aikataulu.poistettavissa ? (
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                                      Poistettavissa
                                    </span>
                                  ) : (
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                                      Säilytysaika voimassa
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
            </Sailytysajat>
          </div>
        </main>
        {globalOverlays}
      </div>
    );
  }

  if (viewingAuditLog) {
    const isAdmin = session?.role === 'admin';
    const actionLabels = {
      create: 'Luotu',
      update: 'Muokattu',
      delete: 'Poistettu',
      login_success: 'Kirjautui sisään',
      login_failed: 'Epäonnistunut kirjautuminen',
      user_create: 'Loi käyttäjän',
      user_update: 'Muokkasi käyttäjää',
      totp_reset: 'Nollasi Authenticatorin',
      totp_required_change: 'Muutti Authenticator-vaatimusta',
      force_logout: 'Pakotti uloskirjautumaan',
      password_change: 'Vaihtoi salasanan',
      user_password_set: 'Asetti käyttäjän salasanan',
      sms_send: 'Lähetti hätäviestin',
      sms_dryrun: 'Hätäviesti (kuivaharjoittelu)',
      sms_failed: 'Hätäviestin lähetys epäonnistui',
      sms_replies: 'Vastauksia hätäviestiin',
      sms_saldo_vahissa: 'SMS-saldo alle varoitusrajan',
      sms_webhook_rejected: 'Webhook hylätty (väärä salaisuus)',
    };
    const collectionLabels = {
      checkins: 'Sisäänkirjaukset',
      reports: 'Raportit',
      events: 'Tapahtumat',
      riskAssessments: 'Riskiarviot',
      employees: 'Työntekijäpankki',
      smsButtons: 'Pikatoiminnot',
    };
    // Korostettavat rivit: epäonnistunut kirjautuminen ja epäonnistunut hätäviesti ovat
    // molemmat asioita jotka lokia selaavan pitää huomata heti.
    const korostaVirheena = (a: string) =>
      a === 'login_failed' || a === 'sms_failed' || a === 'sms_webhook_rejected' || a === 'sms_saldo_vahissa';
    const targetLabel = (e) => {
      if (e.collection) {
        const label = collectionLabels[e.collection] || e.collection;
        return e.recordId ? `${label} (${e.recordId})` : label;
      }
      if (e.targetUser) return e.targetUser;
      return '—';
    };

    return (
      <div className="min-h-screen bg-canvas font-sans flex flex-col">
        {ylapalkki('Audit-loki', { kello: true })}

        <main className="flex-1 p-6 md:p-10">
          <div className="max-w-5xl mx-auto">
            <TakaisinLinkki onClick={() => setViewingAuditLog(false)}>
              Takaisin
            </TakaisinLinkki>

            {!isAdmin ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center">
                <ShieldAlert className="text-rose-400 mx-auto mb-4" size={40} />
                <h2 className="text-lg font-bold text-slate-800 mb-1">Ei käyttöoikeutta</h2>
                <p className="text-sm text-slate-500">Audit-loki on vain pääkäyttäjille.</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">Audit-loki</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Kuka teki mitä milloin — luonnit, muokkaukset, poistot, käyttäjähallinta ja kirjautumiset.
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Käyttäjä</label>
                    <input
                      type="text"
                      value={auditFilters.user}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, user: e.target.value }))}
                      placeholder="esim. Johto1"
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Toiminto</label>
                    <select
                      value={auditFilters.action}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, action: e.target.value }))}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                      <option value="">Kaikki</option>
                      {Object.entries(actionLabels).map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Kokoelma</label>
                    <select
                      value={auditFilters.collection}
                      onChange={(e) => setAuditFilters((f) => ({ ...f, collection: e.target.value }))}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                      <option value="">Kaikki</option>
                      {Object.entries(collectionLabels).map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => fetchAuditLog()}
                    className="px-4 py-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                  >
                    Suodata
                  </button>
                </div>

                {auditError && <p className="text-sm text-rose-600 mb-4">{auditError}</p>}

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-4">Ajankohta</th>
                        <th className="p-4">Käyttäjä</th>
                        <th className="p-4">Toiminto</th>
                        <th className="p-4">Kohde</th>
                        <th className="p-4">Tapahtuma</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {auditLoading && auditEntries.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Ladataan…</td></tr>
                      ) : auditEntries.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Ei lokirivejä.</td></tr>
                      ) : auditEntries.map((e, i) => (
                        <tr key={i} className={`hover:bg-slate-50 transition-colors ${korostaVirheena(e.action) ? 'bg-rose-50/50' : ''}`}>
                          <td className="p-4 text-slate-500 text-xs whitespace-nowrap">{new Date(e.ts).toLocaleString('fi-FI')}</td>
                          <td className="p-4 font-mono text-xs text-slate-700">{e.user || '—'}</td>
                          <td className="p-4">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${korostaVirheena(e.action) ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                              {actionLabels[e.action] || e.action}
                            </span>
                          </td>
                          <td className="p-4 text-slate-700 text-xs">{targetLabel(e)}</td>
                          <td className="p-4 text-slate-500 text-xs">{e.eventId ? findEventName(e.eventId, events) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {auditHasMore && (
                  <div className="text-center mt-4">
                    <button
                      onClick={() => fetchAuditLog(auditEntries[auditEntries.length - 1]?.ts)}
                      disabled={auditLoading}
                      className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-slate-200 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-60"
                    >
                      {auditLoading ? 'Ladataan…' : 'Lataa lisää'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
        {globalOverlays}
      </div>
    );
  }

  // ====================== TALLENNETUT RAPORTIT (kaikki tapahtumat) ======================
  if (viewingAllReports) {
    // Roskakoriin siirretyt eivät kuulu raporttilistaukseen (ks. handleDeleteReport).
    const sortedAllReports = reports.filter((r) => !r.deletedAt).sort((a, b) => {
      if (allReportsSortBy === 'id') return String(a.id).localeCompare(String(b.id));
      if (allReportsSortBy === 'author') return String(a.author || '').localeCompare(String(b.author || ''));
      if (allReportsSortBy === 'event') return findEventName(a.eventId, events).localeCompare(findEventName(b.eventId, events));
      return 0; // 'newest' — tallennusjärjestys on jo uusin ensin
    });

    const sortOptions = [
      { id: 'newest', label: 'Uusin' },
      { id: 'id', label: 'Tunniste' },
      { id: 'author', label: 'Kirjaaja' },
      { id: 'event', label: 'Tapahtuma' }
    ];

    return (
      <div className="min-h-screen bg-canvas font-sans flex flex-col">
        {ylapalkki('Tallennetut raportit', { kello: true })}

        <main className="flex-1 p-6 md:p-10">
          <div className="max-w-6xl mx-auto">
            <TakaisinLinkki onClick={() => setViewingAllReports(false)}>
              Takaisin etusivulle
            </TakaisinLinkki>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Tallennetut raportit</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Kaikki kirjaukset kaikista tapahtumista samassa listassa ({sortedAllReports.length} kpl).
                </p>
              </div>

              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                <span className="text-xs font-medium text-slate-400 pl-2 pr-1 hidden sm:inline">Lajittele:</span>
                {sortOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setAllReportsSortBy(opt.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                      allReportsSortBy === opt.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Tunniste</th>
                    <th className="p-4">Tyyppi</th>
                    <th className="p-4">Laatija</th>
                    <th className="p-4">Tapahtuma</th>
                    <th className="p-4">Aika</th>
                    <th className="p-4">Liite</th>
                    <th className="p-4 text-right">Toiminnot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedAllReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                        Ei vielä tallennettuja raportteja.
                      </td>
                    </tr>
                  ) : sortedAllReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-mono text-xs text-slate-700">{report.id}</td>
                      <td className="p-4 font-medium text-slate-800">{report.type}</td>
                      <td className="p-4 text-slate-600">{report.author}</td>
                      <td className="p-4 text-slate-600">{findEventName(report.eventId, events)}</td>
                      <td className="p-4 font-mono text-slate-600">{report.time}</td>
                      <td className="p-4">
                        {report.attachment ? (
                          <a
                            href={`/api/uploads/${report.attachment.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            <Paperclip size={12} />
                            {report.attachment.name}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => avaaRaporttiPdf(report, false)}
                            title="Avaa tulostusversio esikatseluun"
                            className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
                          >
                            Esikatsele
                          </button>
                          <button
                            type="button"
                            onClick={() => avaaRaporttiPdf(report, true)}
                            title="Avaa tulostusikkunan, josta tallennetaan PDF-tiedostona"
                            className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors"
                          >
                            Tallenna PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
        {globalOverlays}
      </div>
    );
  }

  // ====================== TALLENNETUT TAPAHTUMAT (poistetut/arkistoidut) ======================
  if (viewingArchivedEvents) {
    const archivedEvents = events.filter(e => e.archived);
    const detailEvent = archivedEventDetailId ? archivedEvents.find(e => e.id === archivedEventDetailId) : null;

    if (detailEvent) {
      const eventReports = reports.filter(r => (r.eventId || 'fesx') === detailEvent.id && !r.deletedAt);
      const eventCheckins = checkedInEmployees.filter(e => (e.eventId || 'fesx') === detailEvent.id);
      const eventRisks = riskAssessments.filter(r => (r.eventId || 'fesx') === detailEvent.id);

      return (
        <div className="min-h-screen bg-canvas font-sans flex flex-col">
          {ylapalkki('Tallennetut tapahtumat')}

          <main className="flex-1 p-6 md:p-10">
            <div className="max-w-6xl mx-auto">
              <TakaisinLinkki onClick={() => setArchivedEventDetailId(null)}>
              Takaisin tallennettuihin tapahtumiin
            </TakaisinLinkki>

              <div className="mb-6 bg-slate-100 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                <Archive className="text-slate-500 shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-slate-700">
                  <span className="font-bold">{detailEvent.name}</span> — poistettu {new Date(detailEvent.archivedAt).toLocaleString('fi-FI')}.
                  Tiedot ovat vain luku -tilassa.
                </div>
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-3">Tapahtuman perustiedot (luontilomake)</h3>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8 space-y-6">
                {(() => {
                  const fd = detailEvent.formData || {};
                  const groupsWithData = FORM_FIELD_GROUPS
                    .map(group => ({
                      ...group,
                      fields: group.fields.filter(f => {
                        const v = fd[f.key];
                        return f.bool ? !!v : !!(v && String(v).trim());
                      })
                    }))
                    .filter(group => group.fields.length > 0);

                  if (groupsWithData.length === 0) {
                    return <p className="text-sm text-slate-500">Ei tallennettuja lomaketietoja tälle tapahtumalle.</p>;
                  }

                  return groupsWithData.map(group => (
                    <div key={group.title}>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{group.title}</h4>
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                        {group.fields.map(f => (
                          <div key={f.key} className="text-sm">
                            <dt className="text-slate-500">{f.label}</dt>
                            <dd className="text-slate-800 font-medium">{f.bool ? 'Kyllä' : fd[f.key]}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ));
                })()}
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-3">Raportit ({eventReports.length})</h3>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto mb-8">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Tunniste</th>
                      <th className="p-4">Tyyppi</th>
                      <th className="p-4">Laatija</th>
                      <th className="p-4">Aika</th>
                      <th className="p-4">Liite</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {eventReports.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Ei raportteja.</td></tr>
                    ) : eventReports.map((report) => (
                      <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-mono text-xs text-slate-700">{report.id}</td>
                        <td className="p-4 font-medium text-slate-800">{report.type}</td>
                        <td className="p-4 text-slate-600">{report.author}</td>
                        <td className="p-4 font-mono text-slate-600">{report.time}</td>
                        <td className="p-4">
                          {report.attachment ? (
                            <a
                              href={`/api/uploads/${report.attachment.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                            >
                              <Paperclip size={12} />
                              {report.attachment.name}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-3">Tapahtumaan merkityt työntekijät ({eventCheckins.length})</h3>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Nimi</th>
                      <th className="p-4">Rooli</th>
                      <th className="p-4">Sisäänkirjattu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {eventCheckins.length === 0 ? (
                      <tr><td colSpan={3} className="p-8 text-center text-sm text-slate-500">Ei työntekijöitä merkitty tapahtumaan.</td></tr>
                    ) : eventCheckins.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-medium text-slate-800">{emp.name}</td>
                        <td className="p-4 text-slate-600">{emp.role}</td>
                        <td className="p-4"><EmpStatusBadge emp={emp} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pysyvä poisto: vain adminille, ks. handlePermanentDeleteEvent */}
              {isAdminUser && (
                <div className="mt-10 bg-white rounded-xl border-2 border-rose-200 shadow-sm p-6">
                  <h3 className="text-lg font-bold text-rose-700 flex items-center gap-2">
                    <Trash2 size={18} />
                    Poista tapahtuma pysyvästi
                  </h3>
                  <p className="text-sm text-slate-600 mt-2 max-w-3xl">
                    Poistaa tapahtuman ja kaiken siihen liittyvän datan lopullisesti:
                    {' '}<span className="font-semibold">{eventReports.length} raporttia</span>,
                    {' '}<span className="font-semibold">{eventCheckins.length} työntekijäkirjausta</span> ja
                    {' '}<span className="font-semibold">{eventRisks.length} riskiarviota</span>.
                    Poistoa ei voi perua eikä dataa saa takaisin arkistosta.
                  </p>
                  <p className="text-xs text-slate-500 mt-2 max-w-3xl">
                    Huomioi ennen poistoa, onko tapahtumailmoituksilla tai voimankäyttöraporteilla
                    vielä lakisääteinen säilytysvelvollisuus.
                  </p>
                  <button
                    type="button"
                    onClick={() => handlePermanentDeleteEvent(detailEvent)}
                    className="mt-4 px-5 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    Poista pysyvästi
                  </button>
                </div>
              )}
            </div>
          </main>
          {globalOverlays}
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-canvas font-sans flex flex-col">
        {ylapalkki('Tallennetut tapahtumat')}

        <main className="flex-1 p-6 md:p-10">
          <div className="max-w-5xl mx-auto">
            <TakaisinLinkki onClick={() => setViewingArchivedEvents(false)}>
              Takaisin etusivulle
            </TakaisinLinkki>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Tallennetut tapahtumat</h2>
              <p className="text-sm text-slate-500 mt-1">
                Poistetut tapahtumat säilyvät tässä raportteineen ja kirjauksineen ({archivedEvents.length} kpl).
              </p>
            </div>

            {archivedEvents.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
                Ei poistettuja tapahtumia.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {archivedEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setArchivedEventDetailId(ev.id)}
                    className="bg-white rounded-xl border-2 border-slate-200 hover:border-indigo-400 shadow-sm hover:shadow-md transition-all p-6 text-left group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 rounded-lg bg-slate-100 text-slate-500 group-hover:scale-110 transition-transform duration-200">
                        <Archive size={24} />
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                        Poistettu
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">{ev.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{ev.client}</p>
                    <p className="text-xs text-slate-400 mt-3">
                      Poistettu {new Date(ev.archivedAt).toLocaleDateString('fi-FI')}
                    </p>
                    <div className="mt-5 pt-4 border-t border-slate-100 text-sm font-bold text-indigo-600 flex items-center gap-1">
                      Näytä tiedot
                      <ChevronRight size={16} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>
        {globalOverlays}
      </div>
    );
  }

  // ====================== MINULLE JAETUT ======================
  // Käyttäjälle erikseen jaetut tiedostot ja kansiot. Erillinen näkymä eikä osa
  // tapahtuman tiedostosivua, koska jako voi tulla tapahtumasta johon vastaanottajalla
  // ei ole pääsyä lainkaan — silloin sitä ei näkisi missään tapahtuman sisällä.
  if (viewingSharedWithMe) {
    return (
      <div className="min-h-screen bg-canvas font-sans flex flex-col">
        {ylapalkki('Minulle jaetut', { kello: true })}

        <main className="flex-1 p-6 md:p-10">
          <div className="max-w-4xl mx-auto">
            <TakaisinLinkki onClick={() => setViewingSharedWithMe(false)}>
              Takaisin etusivulle
            </TakaisinLinkki>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Minulle jaetut</h2>
              <p className="text-sm text-slate-500 mt-1">
                Tiedostot ja kansiot jotka on jaettu sinulle nimellä. Näet ne täältä vaikka
                sinulla ei olisi muuten pääsyä kyseiseen tapahtumaan.
              </p>
            </div>

            {sharedWithMeLoading ? (
              <p className="text-sm text-slate-500">Ladataan…</p>
            ) : sharedWithMe.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <Paperclip className="text-slate-300 mx-auto mb-3" size={36} />
                <p className="text-sm text-slate-500">Sinulle ei ole jaettu tiedostoja.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sharedWithMe.map((jako) => (
                  <div key={jako.shareId} className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {jako.type === 'folder'
                            ? <Layers size={18} className="text-indigo-500 shrink-0" />
                            : <FileText size={18} className="text-slate-400 shrink-0" />}
                          <h3 className="text-sm font-bold text-slate-800 truncate">{jako.name}</h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Jakanut {jako.sharedBy}
                          {jako.sharedAt && ` · ${new Date(jako.sharedAt).toLocaleDateString('fi-FI')}`}
                          {' · '}
                          {findEventName(jako.eventId, events)}
                        </p>
                      </div>
                      {jako.expiresAt && (
                        <span className="shrink-0 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                          Voimassa {new Date(jako.expiresAt).toLocaleDateString('fi-FI')} asti
                        </span>
                      )}
                    </div>

                    {jako.files.length === 0 ? (
                      <p className="text-sm text-slate-500">Ei ladattavia tiedostoja.</p>
                    ) : (
                      <div className="border border-slate-100 rounded-lg divide-y divide-slate-100">
                        {jako.files.map((f) => (
                          <div key={f.id} className="p-3 flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-700 truncate">{f.name}</span>
                            <a
                              href={`/api/uploads/${f.uploadId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                            >
                              Lataa
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
        {globalOverlays}
      </div>
    );
  }

  // ====================== ETUSIVU ======================
  // Ensimmäinen näkymä kirjautumisen jälkeen. Sisältö on entinen tapahtuman sisäinen
  // "Aloitussivu"-välilehti, joka on nyt nostettu koko sovelluksen tasolle: tapahtumasta
  // riippumattomat toiminnot (työntekijäpankki, arkistot, käyttäjät, asetukset) löytyvät
  // täältä yhdestä paikasta sen sijaan että ne olisivat hajallaan yläpalkissa ja
  // profiilivalikossa. Tapahtumalista aukeaa "Valitse tapahtuma" -painikkeesta.
  if (selectedEvent === null && !showEventPicker) {
    const etusivunPainikkeet = [
      {
        // Näkyy kaikille: jaon vastaanottajalla ei tarvitse olla mitään erillistä
        // oikeutta, koska jakaminen itsessään antaa pääsyn kohteeseen.
        nakyy: true,
        label: 'Minulle jaetut',
        icon: Paperclip,
        onClick: () => { setViewingSharedWithMe(true); fetchSharedWithMe(); },
      },
      {
        nakyy: isAdminUser || canView(perms, null, 'global_employee_bank'),
        label: 'Työntekijäpankki',
        icon: IdCard,
        onClick: () => setViewingEmployeeBank('list'),
      },
      {
        nakyy: isAdminUser || canView(perms, null, 'global_archived_events'),
        label: 'Tallennetut tapahtumat',
        icon: Archive,
        onClick: () => setViewingArchivedEvents(true),
      },
      {
        nakyy: isAdminUser || canView(perms, null, 'global_reports'),
        label: 'Tallennetut raportit',
        icon: FileText,
        onClick: () => setViewingAllReports(true),
      },
      {
        nakyy: isAdminUser,
        label: 'Muokkaa käyttäjiä',
        icon: Users,
        onClick: () => setViewingUserAdmin('list'),
      },
      {
        nakyy: isAdminUser || canView(perms, null, 'settings'),
        label: 'Sovellusasetukset',
        icon: Settings,
        onClick: () => setViewingSettings(true),
      },
    ].filter((painike) => painike.nakyy);

    return (
      <div className="min-h-screen bg-canvas font-sans flex flex-col">
        {ylapalkki('Tapahtumaturvallisuuden hallintatyökalu', { kello: true })}

        <main className="flex-1 p-6 md:p-10 flex flex-col items-center justify-center">
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-100 text-center max-w-2xl w-full animate-in fade-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-indigo-50/50">
              <ShieldCheck size={48} />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-3 tracking-tight">Turvajohto EVENT</h1>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mt-6 mb-10">
              <h2 className="text-xl md:text-2xl font-semibold text-slate-700">
                {getGreeting(currentTime)}, <span className="text-indigo-600">{sessionNickname || 'Turva 1'}</span>
              </h2>
              <p className="text-slate-500 font-medium mt-1">Turvajohto</p>
            </div>

            <div className="space-y-4">
              {(isAdminUser || canView(perms, null, 'landing')) && (
                <button
                  onClick={() => setShowEventPicker(true)}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-sm hover:shadow group"
                >
                  <Layers size={20} className="group-hover:scale-110 transition-transform" />
                  Valitse tapahtuma
                </button>
              )}

              {etusivunPainikkeet.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {etusivunPainikkeet.map(({ label, icon: Icon, onClick }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      className="flex items-center justify-center gap-3 p-4 bg-white border-2 border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all text-center leading-tight"
                    >
                      <Icon size={20} className="text-indigo-500 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-12 text-slate-400 text-sm font-medium flex items-center gap-2">
            <Clock size={16} />
            Kirjautumisaika: {muotoileKirjautumisaika(session?.lastLoginAt)}
          </div>
        </main>
        {globalOverlays}
      </div>
    );
  }

  // ====================== TAPAHTUMAN VALINTA ======================
  if (selectedEvent === null) {
    return (
      <div className="min-h-screen bg-canvas font-sans flex flex-col">
        {ylapalkki('Tapahtumaturvallisuuden hallintatyökalu', { kello: true })}

        <main className="flex-1 p-6 md:p-10">
          <div className="max-w-5xl mx-auto">
            <TakaisinLinkki onClick={() => setShowEventPicker(false)}>
              Takaisin etusivulle
            </TakaisinLinkki>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Valitse tapahtuma</h2>
              <p className="text-sm text-slate-500 mt-1">
                Avaa olemassa oleva tapahtuma tai luo uusi toimeksianto. Kaikki kirjaukset kohdistuvat valittuun tapahtumaan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {events.filter(ev => !ev.archived).map((ev) => (
                <div
                  key={ev.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => { setSelectedEvent(ev.id); setActiveTab(oletusValilehti(ev.id)); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedEvent(ev.id); setActiveTab(oletusValilehti(ev.id)); } }}
                  className={`bg-white rounded-xl border-2 ${ev.accent} shadow-sm hover:shadow-md transition-all p-6 text-left group cursor-pointer relative`}
                >
                  <div className="absolute top-4 right-4 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleStartEditEvent(ev.id); }}
                      title="Muokkaa tapahtumaa"
                      className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 shadow-sm"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev); }}
                      title="Poista tapahtuma"
                      className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 shadow-sm"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="flex justify-between items-start mb-4 pr-16">
                    <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform duration-200">
                      <Layers size={24} />
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ev.statusTone}`}>
                      {ev.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{ev.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{ev.client}</p>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar size={15} className="text-slate-400 shrink-0" />
                      <span>{ev.dates}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Map size={15} className="text-slate-400 shrink-0" />
                      <span>{ev.place}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users size={15} className="text-slate-400 shrink-0" />
                      <span>{ev.audience}</span>
                    </div>
                  </dl>

                  <div className="mt-5 pt-4 border-t border-slate-100 text-sm font-bold text-indigo-600 flex items-center gap-1">
                    Avaa tapahtuma
                    <ChevronRight size={16} />
                  </div>
                </div>
              ))}

              <button
                onClick={() => setSelectedEvent('new')}
                className="bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all p-6 text-left group flex flex-col justify-center items-center min-h-[240px]"
              >
                <div className="p-4 rounded-full bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors mb-4">
                  <Plus size={28} />
                </div>
                <h3 className="text-lg font-bold text-slate-700 group-hover:text-indigo-700">Luo uusi tapahtuma</h3>
                <p className="text-xs text-slate-500 mt-1 text-center max-w-xs">
                  Kerää toimeksiannon perustiedot ja riskiprofiili aloituslomakkeella.
                </p>
              </button>
            </div>
          </div>
        </main>
        {globalOverlays}
      </div>
    );
  }

  // ====================== UUDEN TAPAHTUMAN LOMAKE ======================
  if (selectedEvent === 'new') {
    const inputCls = "w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500";
    const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";
    const sectionCls = "bg-white rounded-xl border border-slate-200 shadow-sm p-6";
    const headCls = "text-md font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2";

    return (
      <div className="min-h-screen bg-canvas font-sans flex flex-col">
        {ylapalkki(undefined, { sticky: true })}

        <main className="flex-1 p-6 md:p-10">
          <div className="max-w-4xl mx-auto">
            <TakaisinLinkki onClick={() => { setSelectedEvent(null); setShowEventPicker(true); setNewEvent(emptyNewEvent); setEditingEventId(null); }}>
              Takaisin tapahtumavalintaan
            </TakaisinLinkki>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800">{editingEventId ? 'Muokkaa tapahtumaa' : 'Luo uusi tapahtuma'}</h2>
              <p className="text-sm text-slate-500 mt-1">
                {editingEventId
                  ? 'Lomake on esitäytetty tapahtuman aiemmilla tiedoilla — muokkaa vain tarvittavia kohtia. Raportit ja kirjaukset säilyvät ennallaan.'
                  : 'Toimeksiannon aloituslomake. Tiedot muodostavat pohjan turvallisuussuunnittelulle ja resurssimitoitukselle.'}
              </p>
            </div>

            <form className="space-y-6">

              {/* 1. Toimeksiantaja */}
              <div className={sectionCls}>
                <h3 className={headCls}><Briefcase size={18} className="text-indigo-500" />1. Toimeksiantajan viralliset tiedot</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Yrityksen tai yhdistyksen virallinen nimi</label>
                    <input type="text" className={inputCls} value={newEvent.clientName} onChange={(e) => updNewEvent('clientName', e.target.value)} placeholder="Esim. Tapahtumatuotanto X Oy" />
                  </div>
                  <div>
                    <label className={labelCls}>Y-tunnus</label>
                    <input type="text" className={inputCls} value={newEvent.businessId} onChange={(e) => updNewEvent('businessId', e.target.value)} placeholder="1234567-8" />
                  </div>
                </div>
              </div>

              {/* 2. Yhteyshenkilöt */}
              <div className={sectionCls}>
                <h3 className={headCls}><Users size={18} className="text-indigo-500" />2. Yhteyshenkilöt</h3>

                <div className="mb-5">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Tilaaja</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Nimi</label>
                      <input type="text" className={inputCls} value={newEvent.ordererName} onChange={(e) => updNewEvent('ordererName', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Puhelinnumero</label>
                      <input type="tel" className={inputCls} value={newEvent.ordererPhone} onChange={(e) => updNewEvent('ordererPhone', e.target.value)} placeholder="+358" />
                    </div>
                    <div>
                      <label className={labelCls}>Sähköpostiosoite</label>
                      <input type="email" className={inputCls} value={newEvent.ordererEmail} onChange={(e) => updNewEvent('ordererEmail', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-lg p-4">
                  <div className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-1">Päättävä vastuuhenkilö hätätilanteessa</div>
                  <p className="text-xs text-rose-700 mb-3">Henkilö, joka tekee toimeksiantajan puolesta päätökset esimerkiksi keskeytyksestä ja evakuoinnista.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Nimi</label>
                      <input type="text" className={inputCls} value={newEvent.deciderName} onChange={(e) => updNewEvent('deciderName', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Puhelinnumero</label>
                      <input type="tel" className={inputCls} value={newEvent.deciderPhone} onChange={(e) => updNewEvent('deciderPhone', e.target.value)} placeholder="+358" />
                    </div>
                    <div>
                      <label className={labelCls}>Sähköpostiosoite</label>
                      <input type="email" className={inputCls} value={newEvent.deciderEmail} onChange={(e) => updNewEvent('deciderEmail', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Laskutus */}
              <div className={sectionCls}>
                <h3 className={headCls}><FileText size={18} className="text-indigo-500" />3. Laskutustiedot</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Verkkolaskuosoite</label>
                    <input type="text" className={inputCls} value={newEvent.einvoiceAddress} onChange={(e) => updNewEvent('einvoiceAddress', e.target.value)} placeholder="003712345678" />
                  </div>
                  <div>
                    <label className={labelCls}>Operaattoritunnus</label>
                    <input type="text" className={inputCls} value={newEvent.einvoiceOperator} onChange={(e) => updNewEvent('einvoiceOperator', e.target.value)} placeholder="Esim. 003721291126" />
                  </div>
                  <div>
                    <label className={labelCls}>Viite tai kustannuspaikka</label>
                    <input type="text" className={inputCls} value={newEvent.billingRef} onChange={(e) => updNewEvent('billingRef', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* 4. Tapahtuman nimi ja luonne */}
              <div className={sectionCls}>
                <h3 className={headCls}><Layers size={18} className="text-indigo-500" />4. Tapahtuman virallinen nimi ja luonne</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Tapahtuman virallinen nimi</label>
                    <input type="text" className={inputCls} value={newEvent.eventName} onChange={(e) => updNewEvent('eventName', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Tapahtuman luonne</label>
                    <select className={inputCls} value={newEvent.eventType} onChange={(e) => updNewEvent('eventType', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Festivaali">Festivaali</option>
                      <option value="Urheilutapahtuma">Urheilutapahtuma</option>
                      <option value="Yritystapahtuma">Yritystapahtuma</option>
                      <option value="Mielenosoitus">Mielenosoitus</option>
                      <option value="Muu">Muu</option>
                    </select>
                  </div>
                </div>
                {newEvent.eventType === 'Muu' && (
                  <div className="mt-4">
                    <label className={labelCls}>Tarkenna tapahtuman luonne</label>
                    <input type="text" className={inputCls} value={newEvent.eventTypeOther} onChange={(e) => updNewEvent('eventTypeOther', e.target.value)} />
                  </div>
                )}
              </div>

              {/* 5. Ajankohta */}
              <div className={sectionCls}>
                <h3 className={headCls}><Clock size={18} className="text-indigo-500" />5. Ajankohta ja aikataulu</h3>

                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Aukioloajat yleisölle = portit auki</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <div>
                    <label className={labelCls}>Alkaa</label>
                    <div className="flex gap-2">
                      <input type="date" className={inputCls} value={newEvent.publicStartDate} onChange={(e) => updNewEvent('publicStartDate', e.target.value)} />
                      <input type="time" className={inputCls} value={newEvent.publicStartTime} onChange={(e) => updNewEvent('publicStartTime', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Päättyy</label>
                    <div className="flex gap-2">
                      <input type="date" className={inputCls} value={newEvent.publicEndDate} onChange={(e) => updNewEvent('publicEndDate', e.target.value)} />
                      <input type="time" className={inputCls} value={newEvent.publicEndTime} onChange={(e) => updNewEvent('publicEndTime', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                  <div className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Rakennus- ja purkuajat</div>
                  <p className="text-xs text-amber-800 mb-3">Työturvallisuuden kannalta riskialtteinta aikaa. Kirjaa myös yöaikainen työskentely.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Rakennus alkaa</label>
                      <input type="datetime-local" className={inputCls} value={newEvent.buildStart} onChange={(e) => updNewEvent('buildStart', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Rakennus päättyy</label>
                      <input type="datetime-local" className={inputCls} value={newEvent.buildEnd} onChange={(e) => updNewEvent('buildEnd', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Purku alkaa</label>
                      <input type="datetime-local" className={inputCls} value={newEvent.teardownStart} onChange={(e) => updNewEvent('teardownStart', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Purku päättyy</label>
                      <input type="datetime-local" className={inputCls} value={newEvent.teardownEnd} onChange={(e) => updNewEvent('teardownEnd', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Tapahtumapaikka */}
              <div className={sectionCls}>
                <h3 className={headCls}><Map size={18} className="text-indigo-500" />6. Tapahtumapaikka</h3>
                <div className="mb-5">
                  <label className={labelCls}>Tarkka osoite</label>
                  <input type="text" className={inputCls} value={newEvent.address} onChange={(e) => updNewEvent('address', e.target.value)} placeholder="Katuosoite, postinumero ja kunta" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Aluetyyppi</label>
                    <select className={inputCls} value={newEvent.areaType} onChange={(e) => updNewEvent('areaType', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Sisätila">Sisätila</option>
                      <option value="Ulkotila">Ulkotila</option>
                      <option value="Sisä- ja ulkotila">Sisä- ja ulkotila</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Onko alue aidattu</label>
                    <select className={inputCls} value={newEvent.fenced} onChange={(e) => updNewEvent('fenced', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Kyllä, koko alue">Kyllä, koko alue</option>
                      <option value="Osittain">Osittain</option>
                      <option value="Ei">Ei</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelCls}>Aluerajaukset ja huomiot</label>
                  <textarea rows="3" className={inputCls} value={newEvent.areaNotes} onChange={(e) => updNewEvent('areaNotes', e.target.value)} placeholder="Sisäänkäynnit, VIP-alueet, backstage, yleisen alueen rajapinnat, liikennejärjestelyt."></textarea>
                </div>
              </div>

              {/* 7. Yleisö */}
              <div className={sectionCls}>
                <h3 className={headCls}><Users size={18} className="text-indigo-500" />7. Arvioitu yleisömäärä ja kohderyhmä</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Arvioitu yleisömäärä (hlö)</label>
                    <input type="number" min="0" className={inputCls} value={newEvent.audienceCount} onChange={(e) => updNewEvent('audienceCount', e.target.value)} placeholder="Esim. 14200" />
                    {newEvent.audienceCount && Number(newEvent.audienceCount) > 0 && (
                      <p className="text-xs text-slate-500 mt-1.5">
                        Suuntaa antava mitoitus 1:100 antaa {Math.ceil(Number(newEvent.audienceCount) / 100)} järjestyksenvalvojaa.
                        Lopullisen määrän vahvistaa poliisi.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Vahvistettu JV-mitoitus (hlö)</label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={newEvent.requiredJvCount}
                      onChange={(e) => updNewEvent('requiredJvCount', e.target.value)}
                      placeholder={
                        newEvent.audienceCount && Number(newEvent.audienceCount) > 0
                          ? `Esim. ${Math.ceil(Number(newEvent.audienceCount) / 100)}`
                          : 'Esim. 142'
                      }
                    />
                    <p className="text-xs text-slate-500 mt-1.5">
                      Poliisin vahvistama järjestyksenvalvojien määrä. Tilannekuva vertaa
                      sisäänkirjattujen määrää tähän lukuun.
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Ikärakenne</label>
                    <select className={inputCls} value={newEvent.ageProfile} onChange={(e) => updNewEvent('ageProfile', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Perhetapahtuma">Perhetapahtuma, kaikenikäisiä</option>
                      <option value="K-18">K-18</option>
                      <option value="Pääosin nuoret">Pääosin nuoret</option>
                      <option value="Pääosin aikuiset">Pääosin aikuiset</option>
                      <option value="Ei rajoitusta">Ei ikärajoitusta</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelCls}>Kohderyhmän kuvaus</label>
                  <textarea rows="2" className={inputCls} value={newEvent.audienceNotes} onChange={(e) => updNewEvent('audienceNotes', e.target.value)}></textarea>
                </div>
              </div>

              {/* 8. Riskiprofiili */}
              <div className={sectionCls}>
                <h3 className={headCls}><AlertTriangle size={18} className="text-amber-500" />8. Riskiprofiili ja historia</h3>
                <div className="mb-4">
                  <label className={labelCls}>Onko vastaava tapahtuma järjestetty aiemmin</label>
                  <select className={inputCls} value={newEvent.heldBefore} onChange={(e) => updNewEvent('heldBefore', e.target.value)}>
                    <option value="">Valitse</option>
                    <option value="Kyllä, samassa paikassa">Kyllä, samassa paikassa</option>
                    <option value="Kyllä, muualla">Kyllä, muualla</option>
                    <option value="Ei, ensimmäinen kerta">Ei, ensimmäinen kerta</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Aiemmat järjestyshäiriöt, sairaankuljetukset ja poikkeamat</label>
                  <textarea rows="4" className={inputCls} value={newEvent.previousIncidents} onChange={(e) => updNewEvent('previousIncidents', e.target.value)} placeholder="Kirjaa lukumäärät ja tyypit, jos tiedossa. Esimerkiksi poistot, kiinniotot, ensiaputapahtumat ja poliisin tehtävät."></textarea>
                </div>
              </div>

              {/* 9. Anniskelu */}
              <div className={sectionCls}>
                <h3 className={headCls}><Info size={18} className="text-indigo-500" />9. Alkoholin anniskelu</h3>
                <label className="flex items-center gap-3 cursor-pointer bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <input type="checkbox" checked={newEvent.hasBar} onChange={(e) => updNewEvent('hasBar', e.target.checked)} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                  <span className="text-sm font-medium text-slate-800">Alueella on anniskelualue</span>
                </label>
                {newEvent.hasBar && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={labelCls}>Anniskelusta vastaa</label>
                      <select className={inputCls} value={newEvent.barResponsible} onChange={(e) => updNewEvent('barResponsible', e.target.value)}>
                        <option value="">Valitse</option>
                        <option value="Toimeksiantaja">Toimeksiantaja</option>
                        <option value="Kolmas osapuoli">Kolmas osapuoli</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Anniskeluluvan haltija ja yhteystiedot</label>
                      <input type="text" className={inputCls} value={newEvent.barOperator} onChange={(e) => updNewEvent('barOperator', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {/* 10. Esiintyjät */}
              <div className={sectionCls}>
                <h3 className={headCls}><Users size={18} className="text-indigo-500" />10. Esiintyjät ja ohjelmisto</h3>
                <div className="mb-4">
                  <label className={labelCls}>Esiintyjät ja puhujat</label>
                  <textarea rows="3" className={inputCls} value={newEvent.performers} onChange={(e) => updNewEvent('performers', e.target.value)} placeholder="Nimet ja esiintymisajat, jos tiedossa."></textarea>
                </div>
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 cursor-pointer border rounded-lg p-4 transition-colors ${newEvent.reactionRisk ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <input type="checkbox" checked={newEvent.reactionRisk} onChange={(e) => updNewEvent('reactionRisk', e.target.checked)} className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 border-slate-300" />
                    <span className="text-sm font-medium text-slate-800">Ohjelmistossa on esiintyjiä tai puhujia, jotka voivat herättää voimakkaita reaktioita</span>
                  </label>
                  <label className={`flex items-center gap-3 cursor-pointer border rounded-lg p-4 transition-colors ${newEvent.vipGuests ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                    <input type="checkbox" checked={newEvent.vipGuests} onChange={(e) => updNewEvent('vipGuests', e.target.checked)} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                    <span className="text-sm font-medium text-slate-800">Mukana VIP-vieraita, jotka vaativat henkilösuojausta</span>
                  </label>
                </div>
                {(newEvent.reactionRisk || newEvent.vipGuests) && (
                  <div className="mt-4">
                    <label className={labelCls}>Tarkennus suojaustarpeesta</label>
                    <textarea rows="3" className={inputCls} value={newEvent.vipNotes} onChange={(e) => updNewEvent('vipNotes', e.target.value)} placeholder="Kohteet, saapumisreitit, backstage-järjestelyt, mahdolliset uhka-arviot."></textarea>
                  </div>
                )}
              </div>

              {/* 11. Infrastruktuuri */}
              <div className={sectionCls}>
                <h3 className={headCls}><Wrench size={18} className="text-slate-600" />11. Olemassa oleva infrastruktuuri</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                  <div>
                    <label className={labelCls}>Onko alueella kameravalvontaa</label>
                    <select className={inputCls} value={newEvent.existingCctv} onChange={(e) => updNewEvent('existingCctv', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Kyllä, hyödynnettävissä">Kyllä, hyödynnettävissä</option>
                      <option value="Kyllä, ei käyttöoikeutta">Kyllä, mutta ei käyttöoikeutta</option>
                      <option value="Ei">Ei</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Kameravalvonnan tarkennus</label>
                    <input type="text" className={inputCls} value={newEvent.cctvNotes} onChange={(e) => updNewEvent('cctvNotes', e.target.value)} placeholder="Kameroiden määrä, kattavuus, valvomon sijainti." />
                  </div>
                </div>
                <div className="mb-4">
                  <label className={labelCls}>Valaistus pimeän aikaan</label>
                  <textarea rows="2" className={inputCls} value={newEvent.lighting} onChange={(e) => updNewEvent('lighting', e.target.value)} placeholder="Kiinteä valaistus, tilapäisvalaistus, pimeät alueet ja lisävalaistuksen tarve."></textarea>
                </div>
                <div>
                  <label className={labelCls}>Poistumisreitit ja pelastustiet</label>
                  <textarea rows="3" className={inputCls} value={newEvent.exitRoutes} onChange={(e) => updNewEvent('exitRoutes', e.target.value)} placeholder="Sijainnit, leveydet, opastus ja pelastusteiden pitäminen vapaana."></textarea>
                </div>
              </div>

              {/* 12. Viranomaisyhteistyö */}
              <div className={sectionCls}>
                <h3 className={headCls}><ShieldAlert size={18} className="text-rose-500" />12. Viranomaisyhteistyö</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                  <div>
                    <label className={labelCls}>Yleisötilaisuusilmoitus poliisille</label>
                    <select className={inputCls} value={newEvent.policeNotification} onChange={(e) => updNewEvent('policeNotification', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Tehty">Tehty</option>
                      <option value="Kesken">Kesken</option>
                      <option value="Ei tehty">Ei tehty</option>
                      <option value="Ei tarvita">Ei tarvita</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Pelastussuunnitelma pelastuslaitokselle</label>
                    <select className={inputCls} value={newEvent.rescuePlan} onChange={(e) => updNewEvent('rescuePlan', e.target.value)}>
                      <option value="">Valitse</option>
                      <option value="Tehty">Tehty</option>
                      <option value="Kesken">Kesken</option>
                      <option value="Ei tehty">Ei tehty</option>
                      <option value="Ei tarvita">Ei tarvita</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Kenen vastuulla asiakirjojen laatiminen on</label>
                  <select className={inputCls} value={newEvent.authorityResponsible} onChange={(e) => updNewEvent('authorityResponsible', e.target.value)}>
                    <option value="">Valitse</option>
                    <option value="Toimeksiantaja">Toimeksiantaja</option>
                    <option value="Turva Oy">Turva Oy</option>
                    <option value="Jaettu vastuu">Jaettu vastuu</option>
                  </select>
                </div>
              </div>

              {/* 13. Muut toimijat */}
              <div className={sectionCls}>
                <h3 className={headCls}><Layers size={18} className="text-indigo-500" />13. Muiden toimijoiden läsnäolo</h3>
                <div className="mb-4">
                  <label className={labelCls}>Alueella toimivat muut osapuolet</label>
                  <textarea rows="3" className={inputCls} value={newEvent.otherOperators} onChange={(e) => updNewEvent('otherOperators', e.target.value)} placeholder="Ensiapupäivystys, liikenteenohjaus, lavarakentajat, siivous, ravintolatoimijat. Kirjaa yhteyshenkilöt."></textarea>
                </div>
                <div>
                  <label className={labelCls}>Päävastuu alueen kokonaisturvallisuudesta rakennusvaiheessa</label>
                  <input type="text" className={inputCls} value={newEvent.buildPhaseResponsible} onChange={(e) => updNewEvent('buildPhaseResponsible', e.target.value)} placeholder="Nimi, rooli ja organisaatio" />
                </div>
              </div>

              {/* Osio 14 */}
              <div className={sectionCls}>
                <h3 className={headCls}><PhoneCall size={18} className="text-indigo-500" />14. Viestintä ja hätänumerot</h3>

                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Radiopuhelinten kanavajako</div>
                <div className="space-y-2 mb-5">
                  {(newEvent.radioChannels || []).map((kanava, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        className={inputCls}
                        value={kanava}
                        onChange={(e) => paivitaRadiokanava(idx, e.target.value)}
                        placeholder="Kanavan käyttötarkoitus"
                      />
                      <button
                        type="button"
                        onClick={() => poistaRadiokanava(idx)}
                        title="Poista kanava"
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={lisaaRadiokanava}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
                  >
                    <Plus size={16} />
                    Lisää kanava
                  </button>
                  <p className="text-xs text-slate-500">
                    Kanavat näkyvät tapahtuman yleiskatsauksessa siinä järjestyksessä kuin ne ovat tässä.
                  </p>
                </div>

                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Hätänumerot</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>Turva 1 (turvallisuuspäällikkö)</label>
                    <input type="tel" className={inputCls} value={newEvent.phoneTurva1} onChange={(e) => updNewEvent('phoneTurva1', e.target.value)} placeholder="Puhelinnumero" />
                  </div>
                  <div>
                    <label className={labelCls}>Turva 2</label>
                    <input type="tel" className={inputCls} value={newEvent.phoneTurva2} onChange={(e) => updNewEvent('phoneTurva2', e.target.value)} placeholder="Puhelinnumero" />
                  </div>
                  <div>
                    <label className={labelCls}>TIKE (tilannekeskus)</label>
                    <input type="tel" className={inputCls} value={newEvent.phoneTike} onChange={(e) => updNewEvent('phoneTike', e.target.value)} placeholder="Puhelinnumero" />
                  </div>
                  <div>
                    <label className={labelCls}>EA-päivystys</label>
                    <input type="tel" className={inputCls} value={newEvent.phoneFirstAid} onChange={(e) => updNewEvent('phoneFirstAid', e.target.value)} placeholder="Puhelinnumero" />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Numerot näkyvät Hätätilanneohjeet-sivulla yleisen hätänumeron 112 rinnalla.
                </p>
              </div>

              {/* Toiminnot */}
              <div className="flex justify-end gap-3 pb-6">
                <button
                  type="button"
                  onClick={() => { setNewEvent(emptyNewEvent); setSelectedEvent(null); setShowEventPicker(true); setEditingEventId(null); }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvent}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <CheckCircle size={18} />
                  {editingEventId ? 'Tallenna muutokset' : 'Tallenna tapahtuma'}
                </button>
              </div>
            </form>
          </div>
        </main>
        {globalOverlays}
      </div>
    );
  }

  // ====================== MALLITAPAHTUMA FESTIVAALIÖ ======================

  return (
    <div className="min-h-screen bg-canvas font-sans">
      {/* Top Navigation Bar */}
      {/* Tapahtumanäkymän oma yläpalkki: sivuvalikkonappi ja pikatoiminnot tekevät siitä
          aidosti erilaisen kuin muiden näkymien palkki, joten se ei käytä Ylapalkkia —
          vain sen logo-osaa, jotta tuotenimi on silti yhdessä paikassa. */}
      <nav className="bg-surface-dark text-ink-on-dark px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-ink-on-dark/80 hover:text-ink-on-dark transition-colors"
            aria-label="Kutista tai laajenna sivuvalikko"
          >
            <Menu size={24} />
          </button>
          <YlapalkkiLogo
            tuoteNimi="Turvajohto EVENT"
            alaotsikko="Tapahtumaturvallisuuden hallintatyökalu"
            onLogo={palaaEtusivulle}
          />
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          
          {/* Pikatoiminnot -ponnahdusvalikko. Napit tulevat smsButtons-kokoelmasta
              (Sovellusasetukset -> Pikatoiminnot), eivät enää koodista. Valikko näkyy
              näkyvyysoikeudella, mutta LÄHETYS vaatii muokkausoikeuden — sama tarkistus
              tehdään palvelimella (server/index.js: saaLahettaa), tämä suodattaa vain
              käyttöliittymän. */}
          {(isAdminUser || canView(perms, null, 'quickactions')) && (
          <div className="relative">
            <button
              onClick={() => { const auki = !showQuickActions; setShowQuickActions(auki); if (auki && !smsStatus) haeSmsTila(); }}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm"
            >
              <AlertTriangle size={16} />
              <span className="hidden sm:inline">Pikatoiminnot</span>
            </button>

            {showQuickActions && (
              <div className="absolute right-0 mt-3 w-80 bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-5 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                    <Smartphone size={14} />
                    Hätätekstiviestit
                  </span>
                  <button onClick={() => setShowQuickActions(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Integraation tila näkyy ENNEN painallusta: käyttäjän on tiedettävä
                    lähteekö napista oikea viesti vai onko kyseessä kuivaharjoittelu. */}
                {smsStatus && smsStatus.dryRun && (
                  <p className="text-[11px] text-amber-300 bg-amber-950/50 border border-amber-800 rounded-lg p-2 mb-3 leading-snug">
                    Kuivaharjoittelutila: API-tunnuksia ei ole asetettu, viestit eivät lähde.
                  </p>
                )}
                {smsStatus && smsStatus.konfiguroitu && typeof smsStatus.saldo === 'number' && smsStatus.saldo < 1000 && (
                  <p className="text-[11px] text-amber-300 bg-amber-950/50 border border-amber-800 rounded-lg p-2 mb-3 leading-snug">
                    Saldoa jäljellä {Math.round(smsStatus.saldo)} viestiä — täydennä ennen tapahtumaa.
                  </p>
                )}

                {!(isAdminUser || canEdit(perms, null, 'quickactions')) ? (
                  <p className="text-xs text-slate-400 leading-snug">
                    Sinulla ei ole oikeutta lähettää hätäviestejä. Ota yhteys turvallisuuspäällikköön.
                  </p>
                ) : naytettavatNapit.length === 0 ? (
                  <p className="text-xs text-slate-400 leading-snug">
                    Yhtään pikatoimintonappia ei ole määritelty. Ne lisätään Sovellusasetuksista.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {naytettavatNapit.map((nappi) => (
                      <button
                        key={nappi.id}
                        onClick={() => avaaSmsLahetys(nappi)}
                        className={`w-full py-3 px-4 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm text-left leading-tight ${
                          nappi.style === 'danger'
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : 'bg-slate-700 hover:bg-slate-600 border border-slate-600 font-medium'
                        }`}
                      >
                        {nappi.style === 'danger'
                          ? <AlertTriangle size={18} className="shrink-0" />
                          : <PhoneCall size={16} className="shrink-0 text-slate-400" />}
                        <span className="min-w-0">
                          {nappi.label}
                          <span className="block text-[11px] font-normal text-slate-300/80">
                            {smsRyhmanLabel(nappi.group)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { setShowQuickActions(false); setViewingSmsLog(true); }}
                  className="mt-4 pt-3 border-t border-slate-700 w-full text-left text-xs font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <History size={14} />
                  Lähetyshistoria ja toimitustilat
                </button>
              </div>
            )}
          </div>
          )}

          <button
            onClick={() => { setSelectedEvent(null); setShowEventPicker(true); setShowQuickActions(false); }}
            className="hidden sm:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Vaihda tapahtuma
          </button>

          <div className="hidden md:flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg">
            <Clock size={16} className="text-indigo-400" />
            <span className="font-mono text-sm tracking-widest">{formatTime(currentTime)}</span>
          </div>
          <div className="flex items-center gap-3 border-l border-slate-700 pl-4 sm:pl-6">
            <NotificationBell notifications={notifications} onOpen={avaaIlmoitus} />
            <ProfileMenu
              nickname={sessionNickname}
              isAdmin={session?.role === 'admin'}
              onChangePassword={() => setShowChangePassword(true)}
              onViewAuditLog={() => setViewingAuditLog(true)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </nav>

      <div className="flex flex-col md:flex-row min-h-[calc(100vh-73px)]">
        {/* Sidebar Navigation */}
        {isSidebarOpen && (
          <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
            <div className="p-4 space-y-1">
              {(isAdminUser || canView(perms, selectedEvent, 'overview')) && (
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Activity size={18} />
                  Tilannekuva
                </button>
              )}
              {(isAdminUser || canView(perms, selectedEvent, 'reporting')) && (
                <button
                  onClick={() => setActiveTab('reporting')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${(activeTab.startsWith('report') || activeTab.startsWith('tike_')) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <FileText size={18} />
                  Raportointi
                </button>
              )}
              {(isAdminUser || canView(perms, selectedEvent, 'planning')) && (
                <button
                  onClick={() => setActiveTab('planning')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab.startsWith('planning') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Calendar size={18} />
                  Ennen Tapahtumaa
                </button>
              )}
              {(isAdminUser || canView(perms, selectedEvent, 'postevent')) && (
                <button
                  onClick={() => setActiveTab('postevent')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'postevent' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Layers size={18} />
                  {findEventName(selectedEvent, events)}
                </button>
              )}
              {(isAdminUser || canView(perms, selectedEvent, 'documents')) && (
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'documents' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <FileText size={18} />
                  Lomakekartoitus
                </button>
              )}
              {(isAdminUser || canView(perms, selectedEvent, 'eventfiles')) && (
                <button
                  onClick={() => setActiveTab('eventfiles')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'eventfiles' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Package size={18} />
                  Tapahtuman tiedostot
                </button>
              )}
              {(isAdminUser || canView(perms, selectedEvent, 'settings')) && (
                <button
                  onClick={() => setViewingSettings(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-slate-600 hover:bg-slate-50"
                >
                  <Settings size={18} />
                  Sovellusasetukset
                </button>
              )}
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>

      {/* LYTP Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Info className="text-indigo-500" size={24} />
                Lakisääteiset vaatimukset
              </h2>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 leading-relaxed text-left">
              <div>
                <h3 className="font-bold text-slate-900 mb-2 text-base">Laki yksityisistä turvallisuuspalveluista (1085/2015) 33 §</h3>
                <p className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  "Järjestyksenvalvojan tulee heti laatia järjestyksenvalvojatehtävissä havaituista kiinniottamiseen 
                  tai voimakeinojen käyttöön johtaneista tapahtumista kirjallinen selvitys (tapahtumailmoitus). 
                  Järjestyksenvalvoja voi laatia tapahtumailmoituksen myös muista toimenpiteisiin johtaneista tapahtumista. 
                  Tapahtumailmoituksesta tulee käydä ilmi järjestyksenvalvojan kyseiseen tapahtumaan liittyvät havainnot ja 
                  toimenpiteet. Toimenpiteiden kohteena olleiden sukunimi, etunimet, henkilötunnus ja osoitetiedot saadaan 
                  kirjata tapahtumailmoitukseen."
                </p>
              </div>
              
              <div>
                <h3 className="font-bold text-slate-900 mb-2 text-base">Valtioneuvoston asetus yksityisistä turvallisuuspalveluista (874/2016) 18 §</h3>
                <p className="mb-2">Sen lisäksi, mitä yksityisistä turvallisuuspalveluista annetun lain 8 ja 33 §:ssä säädetään, tapahtumailmoituksessa on mainittava:</p>
                <ol className="list-decimal list-inside space-y-1 mb-4 ml-2">
                  <li>vartijan tai järjestyksenvalvojan nimi ja turvallisuusalan elinkeinoluvan haltija, jonka palveluksessa vartija tai järjestyksenvalvoja on;</li>
                  <li>tapahtuma-aika ja -paikka;</li>
                  <li>tieto siitä, onko vartija tai järjestyksenvalvoja ottanut jonkun kiinni tai käyttänyt voimakeinoja;</li>
                  <li>tieto siitä, onko vartija tai järjestyksenvalvoja käyttänyt voimankäyttövälineitä; sekä</li>
                  <li>tieto siitä, onko vartija ottanut esille ampuma-aseen tai käyttänyt sitä.</li>
                </ol>
                <p className="mb-2">Tapahtumailmoituksessa saadaan tarvittaessa mainita havaintotietoina:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>toimenpiteen kohteena olleen henkilön tuntomerkit henkilön tunnistamiseksi; sekä</li>
                  <li>havaintoja kohdehenkilön käyttäytymisestä ja tilasta.</li>
                </ol>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
              >
                Sulje
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tehtävän kuittaus. Oma modaali eikä yhden klikkauksen toiminto, koska
          kuittauksen yhteydessä kysytään kommentti tehtävän aikana ilmenneistä
          ongelmista — se on usein se tieto joka muuten jää kirjaamatta. */}
      {completingTask && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => { setCompletingTask(null); setCompletingTaskComment(''); }}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-5 border-b border-slate-100 gap-3">
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2 min-w-0">
                <CheckCircle size={20} className="text-emerald-500 shrink-0" />
                <span className="truncate">Kuittaa tehdyksi</span>
              </h2>
              <button
                onClick={() => { setCompletingTask(null); setCompletingTaskComment(''); }}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors shrink-0"
                aria-label="Sulje"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-left">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Tehtävä</p>
                <p className="text-sm font-medium text-slate-800 mt-0.5">{completingTask.taskTitle}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Kommentti <span className="font-normal text-slate-400">(valinnainen)</span>
                </label>
                <textarea
                  rows={4}
                  value={completingTaskComment}
                  onChange={(e) => setCompletingTaskComment(e.target.value)}
                  className="w-full rounded-lg border-slate-300 border p-3 text-sm focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ilmenikö tehtävän aikana ongelmia, viivästyksiä tai jotain muuta jatkon kannalta olennaista..."
                />
              </div>

              <p className="text-xs text-slate-500">
                Kuittaus poistaa tehtävän Tilannekuvan Tehtävät-listalta. Kirjaus itse säilyy
                tallennetuissa raporteissa, ja kuittaus kommentteineen näkyy siellä.
              </p>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setCompletingTask(null); setCompletingTaskComment(''); }}
                className="px-5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Peruuta
              </button>
              <button
                type="button"
                onClick={handleCompleteTask}
                className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <CheckCircle size={16} />
                Kuittaa tehdyksi
              </button>
            </div>
          </div>
        </div>
      )}
      {openedReport && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setOpenedReport(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-5 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-lg text-slate-800">{openedReport.type}</h2>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  {openedReport.id}
                  {/* Lomaketunnus on eri asia kuin kirjaustunniste: tunniste yksilöi tämän
                      kirjauksen, lomaketunnus sen pohjan jolla se täytettiin. Versio
                      luetaan TIETUEESTA eikä rekisteristä — rekisterissä on pohjan
                      nykyinen versio, tietueessa se jolla kirjaus tehtiin. */}
                  {openedReport.formCode && (
                    <span className="ml-2 text-slate-500">
                      {lomakeTunnus(openedReport.formCode, '01')}
                      {openedReport.formVersion ? ` v${openedReport.formVersion}` : ''}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {(isAdminUser || canEdit(perms, selectedEvent, openedReportSource || 'overview')) && (
                  <button
                    onClick={() => handleDeleteReport(openedReport)}
                    title="Poista raportti"
                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-lg transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
                <button
                  onClick={() => setOpenedReport(null)}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-sm text-left">
              {(openedReport.status || openedReport.severity || openedReport.zoneId || onLukittu(openedReport)) && (
                <div className="flex flex-wrap items-center gap-2">
                  <TilaMerkki kirjaus={openedReport} />
                  <VakavuusMerkki kirjaus={openedReport} />
                  {raportinVyohyke(openedReport) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-600">
                      <Map size={11} />
                      {raportinVyohyke(openedReport)}
                    </span>
                  )}
                  {onLukittu(openedReport) && <LukkoMerkki />}
                </div>
              )}

              {/* Tilanvaihto vain poikkeamakirjauksille: sisäänkirjausta tai sääraporttia
                  ei käsitellä eikä suljeta, joten napit lupaisivat niille toimintoa jolla
                  ei ole merkitystä. */}
              {saaKasitellaKirjauksen && onPoikkeama(openedReport) && (
                <div className="flex flex-wrap gap-1.5">
                  {TILAT.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSetReportStatus(openedReport, t.id)}
                      className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                        openedReport.status === t.id
                          ? t.luokka
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t.nimi}
                    </button>
                  ))}
                </div>
              )}

              {saaKasitellaKirjauksen && onPoikkeama(openedReport) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-400 uppercase tracking-wide mr-1">Vakavuus</span>
                  {[1, 2, 3, 4, 5].map(taso => (
                    <button
                      key={taso}
                      type="button"
                      onClick={() => handleSetReportSeverity(openedReport, taso)}
                      title={VAKAVUUDET[taso].nimi}
                      className={`w-7 h-7 rounded-md border text-xs font-bold transition-colors ${
                        Number(openedReport.severity) === taso
                          ? VAKAVUUDET[taso].luokka
                          : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {taso}
                    </button>
                  ))}
                </div>
              )}

              {onLukittu(openedReport) && (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <strong className="text-slate-700">Lukittu kirjaus.</strong> Kiinniottoon tai
                  voimakeinoihin liittyvän kirjauksen sisältöä ei voi muuttaa jälkikäteen — sen
                  todistusarvo perustuu siihen että se on laadittu heti. Korjaus tehdään
                  korjausmerkintänä, joka jää näkyviin alkuperäisen rinnalle.
                </p>
              )}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="text-xs text-slate-400 uppercase tracking-wide">Laatija</dt>
                  <dd className="text-slate-800 font-medium">{openedReport.author || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400 uppercase tracking-wide">Aika</dt>
                  <dd className="text-slate-800 font-medium font-mono">{openedReport.time || '—'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-slate-400 uppercase tracking-wide">Tapahtuma</dt>
                  <dd className="text-slate-800 font-medium">{findEventName(openedReport.eventId, events)}</dd>
                </div>
              </dl>

              {openedReport.summary && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Kuvaus</p>
                  <p className="text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3 whitespace-pre-wrap">{openedReport.summary}</p>
                </div>
              )}

              {REPORT_DETAIL_FIELDS.filter(f => {
                const v = openedReport[f.key];
                return f.bool ? !!v : (v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== '0');
              }).map(f => {
                const revealed = !f.masked || !!revealedFields[f.key];
                return (
                  <div key={f.key}>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{f.label}</p>
                    {f.masked ? (
                      <div className="flex items-center gap-2">
                        <p className={revealed ? 'text-slate-700' : 'text-slate-700 font-mono tracking-widest select-none'}>
                          {revealed ? openedReport[f.key] : '••••••••'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setRevealedFields(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                          className="text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded p-1 transition-colors"
                          title={revealed ? 'Piilota' : 'Näytä'}
                          aria-label={revealed ? `Piilota ${f.label}` : `Näytä ${f.label}`}
                        >
                          {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    ) : (
                      <p className="text-slate-700 whitespace-pre-wrap">
                        {f.bool ? 'Kyllä' : f.muotoile ? f.muotoile(openedReport[f.key]) : openedReport[f.key]}
                      </p>
                    )}
                  </div>
                );
              })}

              {openedReport.attachment && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Liite</p>
                  <a
                    href={`/api/uploads/${openedReport.attachment.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Paperclip size={14} />
                    {openedReport.attachment.name}
                  </a>
                </div>
              )}

              {/* Erässä 1 lisätty monen liitteen tuki. Vanha yksittäinen attachment
                  näytetään yhä yllä: sitä ei migroitu tänne, jottei samaan tiedostoon
                  jäisi kahta viittausta. */}
              {Array.isArray(openedReport.attachments) && openedReport.attachments.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Liitteet</p>
                  <div className="flex flex-wrap gap-2">
                    {openedReport.attachments.map((liite) => (
                      <a
                        key={liite.id}
                        href={`/api/uploads/${liite.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Paperclip size={14} />
                        {liite.name || liite.id}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(openedReport.corrections) && openedReport.corrections.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Korjausmerkinnät</p>
                  <ul className="space-y-2">
                    {openedReport.corrections.map((merkinta) => (
                      <li key={merkinta.id} className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                        <p className="text-slate-700 whitespace-pre-wrap">{merkinta.text}</p>
                        <p className="text-xs text-slate-500 mt-1.5">
                          {merkinta.by || '—'}
                          {merkinta.at ? ` · ${new Date(merkinta.at).toLocaleString('fi-FI')}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {saaKasitellaKirjauksen && (
                <div className="border-t border-slate-100 pt-4">
                  <label htmlFor="korjausmerkinta" className="block text-xs text-slate-400 uppercase tracking-wide mb-1">
                    Lisää korjausmerkintä
                  </label>
                  <textarea
                    id="korjausmerkinta"
                    rows={2}
                    value={korjausTeksti}
                    onChange={(e) => setKorjausTeksti(e.target.value)}
                    placeholder="Mikä alkuperäisessä kirjauksessa oli virheellistä ja mikä on oikea tieto."
                    className="w-full rounded-lg border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center justify-between gap-3 mt-2">
                    <p className="text-xs text-slate-400">Merkintää ei voi poistaa eikä muuttaa jälkikäteen.</p>
                    <button
                      type="button"
                      onClick={() => handleAddCorrection(openedReport)}
                      disabled={!korjausTeksti.trim()}
                      className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Lisää merkintä
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setOpenedReport(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
              >
                Sulje
              </button>
            </div>
          </div>
        </div>
      )}

      {openedRiskAssessment && (() => {
        const ra = openedRiskAssessment;
        const level = riskLevels[ra.score];
        const tone = riskTones[level.tone];
        const resLevel = ra.resScore ? riskLevels[ra.resScore] : null;
        const resTone = resLevel ? riskTones[resLevel.tone] : null;
        return (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setOpenedRiskAssessment(null)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start p-5 border-b border-slate-100">
                <div>
                  <h2 className="font-bold text-lg text-slate-800">{ra.target}</h2>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">{ra.id}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(isAdminUser || canEdit(perms, selectedEvent, 'documents_risk_done')) && (
                    <button
                      onClick={() => handleDeleteRiskAssessment(ra)}
                      title="Poista riskiarvio"
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-lg transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <button
                    onClick={() => setOpenedRiskAssessment(null)}
                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors"
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-sm text-left">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <dt className="text-xs text-slate-400 uppercase tracking-wide">Laatija</dt>
                    <dd className="text-slate-800 font-medium">{ra.author || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400 uppercase tracking-wide">Päivämäärä</dt>
                    <dd className="text-slate-800 font-medium">{ra.date || '—'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-400 uppercase tracking-wide">Tila</dt>
                    <dd className={`font-medium ${ra.status === 'Hyväksytty' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {ra.status}
                      {ra.status === 'Hyväksytty' && ra.approvedBy ? ` — ${ra.approvedBy}` : ''}
                      {ra.status === 'Hyväksytty' && ra.approvedAt
                        ? ` (${new Date(ra.approvedAt).toLocaleDateString('fi-FI')})`
                        : ''}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-400 uppercase tracking-wide">Tapahtuma</dt>
                    <dd className="text-slate-800 font-medium">{findEventName(ra.eventId, events)}</dd>
                  </div>
                  {ra.category && (
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-400 uppercase tracking-wide">Riskiluokka</dt>
                      <dd className="text-slate-800 font-medium">{ra.category}</dd>
                    </div>
                  )}
                </dl>

                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Vaaran kuvaus</p>
                  <p className="text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3 whitespace-pre-wrap">{ra.hazard}</p>
                </div>

                {ra.controls && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Nykyiset hallintakeinot</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{ra.controls}</p>
                  </div>
                )}

                <div className={`rounded-xl border-2 p-4 ${tone.bg} ${tone.border}`}>
                  <div className="flex items-center gap-4">
                    <div className={`shrink-0 w-14 h-14 rounded-xl ${tone.solid} text-white font-bold text-2xl flex items-center justify-center shadow-sm`}>
                      {ra.score}
                    </div>
                    <div>
                      <div className={`text-base font-bold ${tone.text}`}>{level.label}</div>
                      <div className="text-xs text-slate-600 mt-0.5">Todennäköisyys {ra.prob} ja seuraukset {ra.sev}</div>
                    </div>
                  </div>
                </div>

                {ra.actions && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Päätetyt toimenpiteet</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{ra.actions}</p>
                  </div>
                )}

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {ra.owner && (
                    <div>
                      <dt className="text-xs text-slate-400 uppercase tracking-wide">Vastuuhenkilö</dt>
                      <dd className="text-slate-800 font-medium">{ra.owner}</dd>
                    </div>
                  )}
                  {ra.deadline && (
                    <div>
                      <dt className="text-xs text-slate-400 uppercase tracking-wide">Toteutettava viimeistään</dt>
                      <dd className="text-slate-800 font-medium">{ra.deadline}</dd>
                    </div>
                  )}
                </dl>

                {resLevel && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Jäännösriski toimenpiteiden jälkeen</p>
                    <div className={`rounded-xl border p-3 flex items-center gap-3 ${resTone.bg} ${resTone.border}`}>
                      <div className={`shrink-0 w-10 h-10 rounded-lg ${resTone.solid} text-white font-bold flex items-center justify-center`}>
                        {ra.resScore}
                      </div>
                      <div className={`text-sm font-bold ${resTone.text}`}>{resLevel.label}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 flex justify-end gap-2 flex-wrap">
                {/* Hyväksyntä on riskiarvion päätös, joten se vaatii saman
                    muokkausoikeuden kuin tehtyjen riskiarvioiden hallinta. */}
                {(isAdminUser || canEdit(perms, selectedEvent, 'documents_risk_done')) && (
                  ra.status === 'Hyväksytty' ? (
                    <button
                      onClick={() => handleReopenRiskAssessment(ra)}
                      className="px-5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-medium rounded-lg transition-colors"
                    >
                      Palauta kesken-tilaan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApproveRiskAssessment(ra)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                      <CheckCircle size={16} />
                      Hyväksy riskiarvio
                    </button>
                  )
                )}
                <button
                  onClick={() => setOpenedRiskAssessment(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                >
                  Sulje
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {globalOverlays}
    </div>
  );
}