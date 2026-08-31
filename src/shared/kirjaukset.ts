// Kirjausten käsittelytila ja muuttumattomuus — frontin peilikuva palvelimen
// server/kirjaukset.js:stä. Sama tilanne kuin sivukartan ja server/permissions.js:n
// kanssa: eri prosessi ja eri kieli, ei jaettua moduulia.
//
// PALVELIN ON SE JOKA RATKAISEE. Tämä tiedosto on olemassa vain käyttöliittymää varten,
// jottei painike lupaa toimintoa jonka palvelin torjuu. Jos lukituksen sääntö muuttuu,
// muuta MOLEMMAT — muuten ero näkyy käyttäjälle selittämättömänä tallennusvirheenä.

export type Tila = 'open' | 'in_progress' | 'escalated' | 'closed';

// Tilat siinä järjestyksessä kuin ne kulkevat. `luokka` on rivin ja merkin väri,
// `reuna` status boardin vasemman reunan korostus.
export const TILAT: { id: Tila; nimi: string; luokka: string; reuna: string }[] = [
  { id: 'open', nimi: 'Avoin', luokka: 'bg-rose-100 text-rose-800 border-rose-200', reuna: 'border-l-rose-400' },
  { id: 'in_progress', nimi: 'Käsittelyssä', luokka: 'bg-amber-100 text-amber-800 border-amber-200', reuna: 'border-l-amber-400' },
  { id: 'escalated', nimi: 'Eskaloitu', luokka: 'bg-orange-100 text-orange-800 border-orange-200', reuna: 'border-l-orange-500' },
  { id: 'closed', nimi: 'Suljettu', luokka: 'bg-emerald-100 text-emerald-800 border-emerald-200', reuna: 'border-l-emerald-400' },
];

export const tila = (id: unknown) => TILAT.find((t) => t.id === id) || null;

// Vakavuus 1–5. Sama asteikko ja samat värisävyt kuin riskiarvioinnissa (App.tsx:
// riskLevels/riskTones), jotta sovelluksessa ei ole kahta eri vakavuusasteikkoa.
// Nimet ovat kirjauskohtaisia: riskiarvioinnissa arvioidaan mahdollista, tässä
// tapahtunutta.
export const VAKAVUUDET: Record<number, { nimi: string; luokka: string }> = {
  1: { nimi: 'Vähäinen', luokka: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  2: { nimi: 'Lievä', luokka: 'bg-lime-100 text-lime-800 border-lime-200' },
  3: { nimi: 'Kohtalainen', luokka: 'bg-amber-100 text-amber-800 border-amber-200' },
  4: { nimi: 'Vakava', luokka: 'bg-orange-100 text-orange-800 border-orange-200' },
  5: { nimi: 'Erittäin vakava', luokka: 'bg-rose-100 text-rose-800 border-rose-200' },
};

// Tapahtumailmoitus laaditaan määritelmällisesti kiinniotosta tai voimakeinojen
// käytöstä (LYTP 8 § ja 33 §), joten se on lukittu tyyppinsä perusteella.
const TAPAHTUMAILMOITUKSET = ['jvreport', 'guard_jvreport'];

// Lukitseeko kirjauksen sisältö sen. Tarkistus tehdään sisällön eikä lomakkeen mukaan:
// sama toimenpidekirjaus voi olla rutiinia tai kiinniotto.
export const onLukittu = (kirjaus: any) => {
  if (!kirjaus || typeof kirjaus !== 'object') return false;
  if (TAPAHTUMAILMOITUKSET.includes(kirjaus.typeId)) return true;
  if (kirjaus.detainedOrForce === true) return true;
  if (kirjaus.force === true) return true;
  if (kirjaus.tools === true) return true;
  if (kirjaus.firearm === true) return true;
  return Number(kirjaus.detained) > 0;
};

// Kirjaustyypit joilla tilamalli on mielekäs. Sisäänkirjausta tai sääraporttia ei
// "suljeta", joten ne eivät kuulu status boardille eivätkä saa tilaa lainkaan.
// Sama lista kuin migraatioskriptin POIKKEAMATYYPIT.
export const POIKKEAMATYYPIT = [
  'jvaction',
  'jvreport',
  'firstaid',
  'threat',
  'fence',
  'damage',
  'guard_action',
  'guard_jvreport',
];

export const onPoikkeama = (kirjaus: any) => POIKKEAMATYYPIT.includes(kirjaus?.typeId);

// Uusi korjausmerkintä lukittuun kirjaukseen. Merkinnät ovat append-only: palvelin
// hylkää pyynnön jossa vanha merkintä on muuttunut tai kadonnut.
export const uusiKorjausmerkinta = (teksti: string, tekija: string) => ({
  id: `k-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  at: new Date().toISOString(),
  by: tekija || '',
  text: teksti,
});
