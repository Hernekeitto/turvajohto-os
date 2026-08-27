import type { SivukarttaSolmu } from '../shared/oikeudet';

// Turvajohto GUARD -puolen sivukartta. Erillinen EVENT-puolen SITEMAPista, koska puolilla
// on eri sivut — mutta rakenne ja oikeusmekanismi ovat samat (ks. shared/oikeudet.ts).
//
// Solmutunnukset on prefiksoitu `guard_`-etuliitteellä, koska oikeudet tallennetaan
// yhteiseen { [solmuId]: { view, edit } } -olioon: ilman prefiksiä GUARDin ja EVENTin
// samannimiset sivut jakaisivat vahingossa saman oikeuden.
//
// HUOM: nämä tunnukset EIVÄT tule automaattisesti palvelimelle (eri prosessi, ei jaettua
// moduulia). Jos lisäät solmun tänne, lisää vastaava sääntö myös server/permissions.js:ään
// — muuten oikeus näkyy editorissa mutta ei rajoita mitään.
//
// Lista kasvaa sitä mukaa kuin GUARD-puolen näkymiä toteutetaan. Tyhjiä solmuja ei lisätä
// etukäteen: oikeuseditorissa näkyvä rivi lupaa käyttäjälle sivun jota ei ole olemassa.
export const SITEMAP_GUARD: SivukarttaSolmu[] = [
  // Kohdevalinta vastaa tapahtumapuolen 'landing'-solmua: kohteiden listaus, luonti ja
  // muokkaus. Globaali solmu palvelimella (server/permissions.js: GLOBAL_NODES), koska
  // ilman kohdelistaa ei pääse yhteenkään kohteeseen.
  { id: 'guard_sites', label: 'Kohdevalinta' },
];
