// Kevyt rakennevalidointi PUT /api/data/:name -pyynnöille. EI validoi yksittäisten
// kenttien sisältöä (esim. onko email kelvollinen, onko reports.summary täytetty) —
// reports-kokoelma on polymorfinen (14 eri typeId-tyyppiä) ja employees-lomakkeessa
// on 30+ kenttää, joten täydellinen kenttäkohtainen skeema olisi iso, hauras työ jossa
// yhdenkin kentän/tyypin unohtaminen rikkoisi legitiimin tallennuksen. Tämä validoi
// vain sen minimirakenteen jota authorizeWrite() (permissions.js) ja store.js jo
// implisiittisesti olettavat.

// Jokainen tietue on objekti jolla on yksiselitteinen id — ilman tätä id:tön tai
// kaksois-id:llinen tietue voisi hiljaa kadottaa dataa authorizeWrite():n
// id-perusteisessa diffissä (ks. sen kommentti "kaksi tietuetta samalla id:llä...").
export function validateRecords(newArr) {
  const seenIds = new Set();
  for (const item of newArr) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: 'Tallennus hylätty: jokin tietue ei ole kelvollinen objekti.' };
    }
    const { id } = item;
    if (id === undefined || id === null || id === '') {
      return { ok: false, error: 'Tallennus hylätty: jostakin tietueesta puuttuu id.' };
    }
    if (typeof id !== 'string' && typeof id !== 'number') {
      return { ok: false, error: 'Tallennus hylätty: jonkin tietueen id on väärän tyyppinen.' };
    }
    const idKey = String(id);
    if (seenIds.has(idKey)) {
      return { ok: false, error: `Tallennus hylätty: id "${idKey}" esiintyy useammin kuin kerran.` };
    }
    seenIds.add(idKey);
    if (item.eventId !== undefined && item.eventId !== null && typeof item.eventId !== 'string') {
      return { ok: false, error: 'Tallennus hylätty: jonkin tietueen eventId on väärän tyyppinen.' };
    }
  }
  return { ok: true };
}

// Romahdussuoja: PUT ei voi koskaan tyhjentää koko kokoelmaa jos se ei ollut jo
// tyhjä. Sovelluksessa ei ole yhtään toimintoa joka tarkoituksella tyhjentäisi
// kokoelman kokonaan (tarkistettu), joten tämä ei voi hylätä mitään legitiimiä
// pyyntöä — se estää nimenomaan sen skenaarion että epäonnistunut GET (verkkokatko,
// hetkellinen palvelinvirhe) jättää frontin tyhjään alkutilaan, joka sitten
// automaattitallentuu PUT:lla ja pyyhkisi koko kokoelman yhdellä kutsulla.
export function wouldWipeNonEmptyCollection(currentArr, nextArr) {
  return Array.isArray(currentArr) && currentArr.length > 0 && Array.isArray(nextArr) && nextArr.length === 0;
}
