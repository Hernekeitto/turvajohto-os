// Kirjausten käsittelytila ja muuttumattomuus. Oma moduulinsa, koska samat säännöt
// tarvitaan kahdessa paikassa — authorizeWrite (permissions.js) ja migraatioskripti —
// eikä sääntöä saa olla kahta versiota.
//
// Muuttumattomuus koskee SISÄLTÖÄ, ei käsittelyä. Voimakeino- tai kiinniottokirjauksen
// kuvausta ei saa muuttaa jälkikäteen: sen todistusarvo perustuu siihen että se on
// laadittu heti eikä muokattu myöhemmin (LYTP 8 § ja 33 §: ilmoitus "tulee heti
// laatia"). Sen sijaan tilan, vastuutuksen ja korjausmerkintöjen on voitava muuttua,
// koska muuten tilamalli ei toimisi juuri niissä kirjauksissa joissa sitä eniten
// tarvitaan.
//
// Lukitus sitoo MYÖS adminia (päätös 31.8.2026). Jos admin voi ylikirjoittaa kirjauksen
// hiljaa, kirjaus on muuttumaton vain siinä määrin kuin adminiin luotetaan — eli ei
// lainkaan siinä mielessä jolla on todistusarvoa. Korjaus tehdään korjausmerkintänä
// riippumatta siitä kuka on kirjautuneena.

// Kirjauksen käsittelytila. Arvot ovat koneluettavia; käyttöliittymän suomenkieliset
// nimet ja värit ovat frontin puolella.
export const TILAT = ['open', 'in_progress', 'escalated', 'closed'];

// Vakavuus 1–5. Sama asteikko kuin riskiarvioinnissa, jotta värikoodi voidaan
// käyttöliittymässä lukea samasta taulukosta (App.tsx: riskLevels/riskTones) eikä
// sovelluksessa ole kahta eri vakavuusasteikkoa joita pitäisi verrata toisiinsa.
export const VAKAVUUS_MIN = 1;
export const VAKAVUUS_MAX = 5;

// Lakisääteinen säilytysaika vuosina. Sama luku kuin src/shared/sailytysaika.ts:n
// SAILYTYSVUOSIA — pidettävä synkassa. Ei jaettua moduulia, koska palvelin on Node/JS ja
// front TypeScript-käännöksen takana.
const SAILYTYSVUOSIA = 2;

// Lukitun kirjauksen kentät jotka saavat silti muuttua. Kaikki muu on jäädytetty.
// Huomaa mitä listalla EI ole: summary, description, subject*-kentät ja voimakeinojen
// liput. Koska lippuja ei voi muuttaa, lukittua kirjausta ei voi myöskään "avata"
// nollaamalla se lippu jonka takia se lukittui.
export const MUUTTUVAT_KENTAT = new Set([
  'status',
  'severity',
  'zoneId',
  'assignedTo',
  'closedAt',
  'closedBy',
  'policeDeliveredAt',
  'policeStation',
  // Roskakori on pehmeä poisto: front merkitsee tietueeseen deletedAt/deletedBy eikä
  // poista sitä taulukosta (App.tsx: handleDeleteReport). Se ei muuta kirjauksen
  // sisältöä eikä hävitä mitään — tietue säilyy ja on palautettavissa — joten lukitus
  // ei estä sitä. Pysyvä hävitys sen sijaan poistaa tietueen taulukosta, ja siihen
  // pätee lukitusEstaaPoiston.
  'deletedAt',
  'deletedBy',
]);

// Listat joihin saa LISÄTÄ mutta joista ei saa poistaa eikä joiden alkioita saa muuttaa.
//
// corrections: korjaushistoria olisi muuten yhtä muokattavissa kuin se kirjaus jota sen
// on tarkoitus suojata.
//
// attachments: todistekuva otetaan tilanteessa mutta ladataan usein vasta jälkikäteen,
// joten liitteiden täysi jäädytys estäisi todisteen liittämisen juuri niihin kirjauksiin
// joissa sillä on eniten merkitystä. Poistaminen on eri asia kuin lisääminen: sitä ei
// sallita, koska se olisi todisteen hävittämistä.
export const LISATTAVAT_LISTAT = ['corrections', 'attachments'];

// Kentät jotka saa TÄYDENTÄÄ tyhjästä arvoon mutta joita ei saa muuttaa sen jälkeen.
// Lomaketunnus ja pohjaversio ovat tällaisia: vanhoilta kirjauksilta ne puuttuvat, ja
// niiden leimaaminen jälkikäteen on tarpeen — mutta jo leimatun kirjauksen tunnuksen
// vaihtaminen tarkoittaisi väitettä, että kirjaus tehtiin eri pohjalla kuin tehtiin.
export const TAYDENNETTAVAT_KENTAT = new Set(['formCode', 'formVersion']);

const onTyhja = (arvo) => arvo === undefined || arvo === null || arvo === '';

// Tapahtumailmoitus laaditaan määritelmällisesti kiinniotosta tai voimakeinojen käytöstä
// (LYTP 8 § ja 33 §), joten se on lukittu tyyppinsä perusteella ilman erillistä lippua.
const TAPAHTUMAILMOITUKSET = new Set(['jvreport', 'guard_jvreport']);

// Lukitseeko kirjauksen sisältö sen. Tarkistus tehdään SISÄLLÖN eikä lomakkeen mukaan:
// sama toimenpidekirjaus (jvaction) voi olla rutiinia tai kiinniotto, ja lukituksen
// pitää seurata sitä mitä oikeasti tapahtui.
export function onLukittu(record) {
  if (!record || typeof record !== 'object') return false;
  if (TAPAHTUMAILMOITUKSET.has(record.typeId)) return true;
  if (record.detainedOrForce === true) return true;
  if (record.force === true) return true;
  if (record.tools === true) return true;
  if (record.firearm === true) return true;
  return Number(record.detained) > 0;
}

// Onko kirjauksen lakisääteinen säilytysaika päättynyt. Sama laskenta kuin
// src/shared/sailytysaika.ts: säilytys päättyy laatimisvuoden viimeisenä päivänä +
// SAILYTYSVUOSIA.
//
// Puuttuva tai kelvoton createdAt tulkitaan päättyneeksi. Syy: createdAt lisättiin vasta
// 18.8.2026, ja sitä vanhemmilta kirjauksilta säilytysaikaa ei voi laskea — jos ne
// tulkittaisiin ikuisesti säilytettäviksi, lukittua vanhaa kirjausta ei saisi koskaan
// hävitettyä, mikä on itsessään lainvastainen lopputulos. Tämä ei avaa porsaanreikää:
// createdAt ei ole MUUTTUVAT_KENTAT-listalla, joten lukitusta ei voi ohittaa
// poistamalla kenttä ensin.
export function sailytysaikaPaattynyt(record, nyt = new Date()) {
  // EVENT-puolen raportit käyttävät kenttää `createdAt`, GUARD-puolen `luotu`
  // (ks. src/guard/tyypit.ts). Molemmat on luettava: jos tästä lukisi vain
  // createdAt:in, jokainen vartijan kirjaus näyttäisi säilytysajan ohittaneelta ja
  // lukitus sallisi sen poiston heti.
  const luotu = record?.createdAt ?? record?.luotu;
  if (!luotu) return true;
  const d = new Date(luotu);
  if (Number.isNaN(d.getTime())) return true;
  return nyt > new Date(d.getFullYear() + SAILYTYSVUOSIA, 11, 31, 23, 59, 59);
}

// Estääkö lukitus tämän muokkauksen. Palauttaa virheilmoituksen tai null.
export function lukitusEstaaMuokkauksen(before, after) {
  if (!onLukittu(before)) return null;

  for (const lista of LISATTAVAT_LISTAT) {
    const vanhat = Array.isArray(before?.[lista]) ? before[lista] : [];
    const uudet = Array.isArray(after?.[lista]) ? after[lista] : [];
    if (uudet.length < vanhat.length) {
      return `Lukitusta kirjausta ei voi muuttaa: listasta "${lista}" ei voi poistaa alkioita.`;
    }
    for (let i = 0; i < vanhat.length; i++) {
      if (JSON.stringify(vanhat[i]) !== JSON.stringify(uudet[i])) {
        return `Lukitusta kirjausta ei voi muuttaa: listan "${lista}" olemassa olevaa alkiota ei voi muokata.`;
      }
    }
  }

  const kentat = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const kentta of kentat) {
    if (MUUTTUVAT_KENTAT.has(kentta)) continue;
    if (LISATTAVAT_LISTAT.includes(kentta)) continue; // tarkistettu jo yllä
    if (JSON.stringify(before?.[kentta]) === JSON.stringify(after?.[kentta])) continue;
    if (TAYDENNETTAVAT_KENTAT.has(kentta) && onTyhja(before?.[kentta])) continue;
    return `Lukitusta kirjausta ei voi muuttaa: kenttä "${kentta}". Tee korjaus korjausmerkintänä.`;
  }
  return null;
}

// Estääkö lukitus tämän poiston. Poisto sallitaan vasta kun säilytysaika on päättynyt —
// silloin hävittäminen ei ole vain sallittua vaan pakollista (LYTP 8 § ja 33 §).
export function lukitusEstaaPoiston(before, nyt = new Date()) {
  if (!onLukittu(before)) return null;
  if (sailytysaikaPaattynyt(before, nyt)) return null;
  return 'Lukitusta kirjausta ei voi poistaa ennen säilytysajan päättymistä.';
}

// Audit-lokiin vietävät lisätiedot muutoksesta. Tila ja korjausmerkinnän lisäys ovat
// tarkoituksellinen poikkeus audit.js:n periaatteeseen "vain metadata, ei tietueen
// sisältöä": kumpikaan ei ole henkilötietoa, ja juuri niiden historia on se mitä
// jälkikäteisessä selvityksessä kysytään.
export function muutoksenLisatiedot(before, after) {
  const lisa = {};
  if (before?.status !== after?.status) {
    lisa.statusFrom = before?.status ?? null;
    lisa.statusTo = after?.status ?? null;
  }
  const vanhat = Array.isArray(before?.corrections) ? before.corrections.length : 0;
  const uudet = Array.isArray(after?.corrections) ? after.corrections.length : 0;
  if (uudet > vanhat) lisa.correctionAdded = true;
  return lisa;
}

// --- Juokseva tunniste ja offline-jono ---------------------------------------------
//
// EVENT-puolen kirjauksen tunniste on juokseva sarja: `26/FesX/0409/101`. Selain
// muodostaa sen omasta listastaan, mikä toimii niin kauan kuin lista on ajan tasalla.
//
// OFFLINE-TILASSA SE EI OLE. Kaksi laitetta samassa tapahtumassa samana päivänä ilman
// verkkoa antaa molemmat saman numeron, koska kumpikaan ei näe toisen kirjausta. Kun
// jono purkautuu, jälkimmäinen osuisi duplikaattitarkistukseen ja katoaisi lopullisesti
// merkittynä "jo perillä olevaksi" — eli offline-tuki hävittäisi juuri sen kirjauksen
// jonka se on olemassa pelastamaan.
//
// Juoksevaa numeroa ei voi jakaa laitteille. Sarjan omistaja on palvelin, joten se myös
// siirtää törmänneen kirjauksen seuraavaan vapaaseen numeroon. Tunniste ei ole tietueen
// sisältöä vaan sen paikka arkistossa, joten siirto ei muuta sitä mitä kirjaaja kirjoitti.
//
// Etuliite luetaan törmänneestä tunnisteesta itsestään: palvelimen ei tarvitse tuntea
// tapahtumakoodia eikä päivämäärän muotoa, vain sen että sarja päättyy numeroon.
const TUNNISTE_OSAT = /^(.*\/)(\d+)$/;

export function seuraavaVapaaTunniste(id, varatut) {
  const osat = TUNNISTE_OSAT.exec(String(id ?? ''));
  // Tunniste jota ei voi jakaa etuliitteeseen ja numeroon (esim. UUID) ei ole juokseva
  // sarja, eikä sitä siirretä. Kutsuja käsittelee sen duplikaattina kuten ennenkin.
  if (!osat) return null;
  const [, etuliite, numero] = osat;
  let seuraava = Number(numero) + 1;
  // Yläraja on olemassa vain siltä varalta että varatut-joukko on jotain odottamatonta:
  // ilman sitä virheellinen syöte tarkoittaisi ikuista silmukkaa pyyntöketjussa.
  for (let i = 0; i < 100000; i++) {
    const ehdokas = `${etuliite}${seuraava}`;
    if (!varatut.has(ehdokas)) return ehdokas;
    seuraava++;
  }
  return null;
}

// Onko tämä sama kirjaus joka on jo perillä. `jonoId` on selaimessa syntyvä satunnainen
// tunniste, joka EI muutu vaikka juokseva tunniste siirtyisi — se on siis se avain jolla
// uusinta erotetaan uudesta kirjauksesta.
export function loydaSamaKirjaus(tietue, olemassaolevat) {
  const jonoId = tietue?.jonoId;
  if (typeof jonoId === 'string' && jonoId) {
    // EI varasuunnitelmaa tunnisteeseen. Jos jonoId on mutta sitä ei löydy, kyseessä on
    // UUSI kirjaus — ja jos tunniste silti törmää, se on juuri se törmäys jota varten
    // siirto on olemassa. Tunnisteeseen putoaminen tässä kohdassa tekisi kahdesta eri
    // laitteen kirjauksesta saman ja hävittäisi jälkimmäisen.
    return olemassaolevat.find((t) => t?.jonoId === jonoId) || null;
  }
  // Ilman jonoId:tä (vanhat asiakkaat, GUARD-puolen tietueet joilla on UUID) tunniste on
  // ainoa mitä on. Se riittää siellä missä tunniste on satunnainen.
  return olemassaolevat.find((t) => String(t?.id) === String(tietue?.id)) || null;
}
