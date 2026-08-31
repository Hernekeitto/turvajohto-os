// Erän 1 migraatio: lisää tilamallin, vyöhykkeen, liitteiden, sijainnin ja
// lomaketunnuksen kentät reports- ja guardReports-kokoelmiin.
//
// Ajo:
//   node scripts/migrate-era1.js              # kuivaharjoittelu, ei kirjoita mitään
//   node scripts/migrate-era1.js --apply      # kirjoittaa, tekee ensin varmuuskopion
//   node scripts/migrate-era1.js --apply --status=open
//
// Skripti lukee ja kirjoittaa JSON-tiedostot RAAKANA eikä store.js:n kautta. Syy:
// salatut kentät (henkilötunnus, kuvaukset) säilyvät silloin bitilleen ennallaan eikä
// migraatio tarvitse salausavainta lainkaan. Uudet kentät ovat kaikki selväkielisiä,
// joten mitään ei tarvitse salata — ja jos joku myöhemmin lisää tänne salattavan
// kentän, store.js salaa sen automaattisesti ensimmäisellä luvulla (hasPlaintextFields).
//
// HUOM: romahdussuoja (validation.js: wouldWipeNonEmptyCollection) istuu HTTP-reitillä,
// ei writeCollectionissa — se ei siis suojaa tätä skriptiä lainkaan. Siksi pituustarkistus
// ja varmuuskopio tehdään tässä itse.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const KOKOELMAT = {
  reports: 'reports.json',
  guardReports: 'guardReports.json',
};

// Kirjaustyypit joilla tilamalli on mielekäs. Sisäänkirjaus, sääraportti tai briefing ei
// ole mitään mitä "suljetaan", joten niille ei anneta tilaa lainkaan — muuten status
// board täyttyisi riveistä joita kukaan ei koskaan käsittele ja koko tilamalli
// menettäisi merkityksensä. Sama lista kuin App.tsx:n DEVIATION_TYPES, täydennettynä
// GUARD-puolen tyypeillä (molemmat ovat poikkeamakirjauksia).
const POIKKEAMATYYPIT = new Set([
  'jvaction',
  'jvreport',
  'firstaid',
  'threat',
  'fence',
  'damage',
  'guard_action',
  'guard_jvreport',
]);

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const tilaArg = argv.find((a) => a.startsWith('--status='));
// Oletus 'closed' vanhoille kirjauksille: ne ovat menneistä tapahtumista eikä niitä
// enää käsitellä. 'open' merkitsisi sadan vanhan kirjauksen odottavan toimenpiteitä,
// mikä ei pidä paikkaansa. closedBy jätetään tyhjäksi, koska kukaan ei niitä sulkenut
// käsin — se erottaa migroidun tilan oikeasta käsittelystä.
const OLETUSTILA = tilaArg ? tilaArg.split('=')[1] : 'closed';

if (!['open', 'in_progress', 'escalated', 'closed'].includes(OLETUSTILA)) {
  console.error(`Tuntematon tila: ${OLETUSTILA}`);
  process.exit(1);
}

// Uudet kentät oletusarvoineen. Vain puuttuvat kentät lisätään, joten skriptin voi ajaa
// uudelleen ilman että se muuttaa jo migroitua dataa.
function uudetKentat(record) {
  const poikkeama = POIKKEAMATYYPIT.has(record?.typeId);
  return {
    // Tilamalli ja luokittelu.
    status: poikkeama ? OLETUSTILA : null,
    severity: null,
    zoneId: null,
    assignedTo: null,
    closedAt: null,
    closedBy: null,
    // Liitteet. Vanhaa yksittäistä `attachment`-kenttää EI kosketa eikä sen sisältöä
    // kopioida tänne: kaksi viittausta samaan tiedostoon tarkoittaisi kahta paikkaa
    // joista se pitää muistaa poistaa. Roskienkeruu lukee molemmat kentät
    // (index.js: raportinLiitteet), joten vanhat liitteet eivät ole vaarassa.
    attachments: [],
    // Sijaintipari. Täytetään vasta erässä 2 (kuvakoordinaatti) ja erässä 3 (GPS),
    // mutta kenttä varataan nyt, koska toinen migraatio samaan tietueeseen on turha.
    location: { img: null, gps: null },
    // Lomaketunnus ja pohjan versio. Jäävät tyhjiksi: arvot tulevat
    // src/shared/lomakerekisteri.ts:stä, jota tämä Node-skripti ei voi tuoda (TypeScript
    // käännöksen takana). Kartan kopioiminen tänne rikkoisi juuri sen yhden totuuden
    // jonka takia rekisteri on olemassa — front leimaa tunnuksen tallennuksen yhteydessä.
    formCode: null,
    formVersion: null,
    // Tapahtumailmoituksen toimitus poliisille silloin kun kiinni otettu vapautetaan
    // (LYTP 8 § ja 33 § 3 mom).
    policeDeliveredAt: null,
    policeStation: null,
    // Korjausmerkinnät lukittuun kirjaukseen: { id, at, by, text }. Append-only,
    // ks. kirjaukset.js.
    corrections: [],
  };
}

function migroiKokoelma(nimi, tiedosto) {
  const polku = path.join(DATA_DIR, tiedosto);
  if (!fs.existsSync(polku)) {
    console.log(`${nimi}: tiedostoa ei ole (${polku}) — ohitetaan.`);
    return;
  }

  const raaka = fs.readFileSync(polku, 'utf8');
  let data;
  try {
    data = JSON.parse(raaka);
  } catch (err) {
    console.error(`${nimi}: JSON ei jäsenny (${err.message}) — keskeytetään.`);
    process.exitCode = 1;
    return;
  }
  if (!Array.isArray(data)) {
    console.error(`${nimi}: sisältö ei ole taulukko — keskeytetään.`);
    process.exitCode = 1;
    return;
  }

  const lisatytKentat = new Map();
  let muuttuneita = 0;

  const uusiData = data.map((record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
    const oletukset = uudetKentat(record);
    const puuttuvat = Object.keys(oletukset).filter((kentta) => !(kentta in record));
    if (puuttuvat.length === 0) return record;
    muuttuneita++;
    for (const kentta of puuttuvat) {
      lisatytKentat.set(kentta, (lisatytKentat.get(kentta) || 0) + 1);
    }
    const kopio = { ...record };
    for (const kentta of puuttuvat) kopio[kentta] = oletukset[kentta];
    return kopio;
  });

  // Pituustarkistus: migraatio ei saa koskaan hävittää eikä lisätä tietueita.
  if (uusiData.length !== data.length) {
    console.error(`${nimi}: tietueiden määrä muuttui (${data.length} → ${uusiData.length}) — keskeytetään.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${nimi}: ${data.length} tietuetta, joista ${muuttuneita} tarvitsee uusia kenttiä.`);
  for (const [kentta, määrä] of lisatytKentat) {
    console.log(`  ${kentta.padEnd(16)} lisätään ${määrä} tietueeseen`);
  }
  if (muuttuneita === 0) {
    console.log('  (jo migroitu, ei tehtävää)');
    return;
  }

  if (!APPLY) {
    console.log('  KUIVAHARJOITTELU — mitään ei kirjoitettu. Aja --apply kun luvut näyttävät oikeilta.');
    return;
  }

  const varmuuskopio = `${polku}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(polku, varmuuskopio);

  // Sama kirjoitustapa kuin store.js:ssä: tmp-tiedosto ja rename, jotta keskeytynyt
  // kirjoitus ei jätä puolikasta JSONia levylle.
  const tmp = `${polku}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(uusiData, null, 2));
  fs.renameSync(tmp, polku);
  console.log(`  Kirjoitettu. Varmuuskopio: ${path.basename(varmuuskopio)}`);
}

console.log(`Datahakemisto: ${DATA_DIR}`);
console.log(`Vanhojen poikkeamakirjausten tila: ${OLETUSTILA}`);
for (const [nimi, tiedosto] of Object.entries(KOKOELMAT)) {
  migroiKokoelma(nimi, tiedosto);
}
console.log('');
