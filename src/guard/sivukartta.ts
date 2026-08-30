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
  // ilman kohdelistaa ei pääse yhteenkään kohteeseen. Kohteen hallintaan kuuluvat myös
  // sen tiedostot, perehdytykset ja tehtäväpohjat — ne ovat kohteen ominaisuuksia.
  { id: 'guard_sites', label: 'Kohdevalinta ja kohteen hallinta' },
  // Kohteen tiedot: kooste siitä mitä kohteessa on tapahtunut (suoritetut tehtävät ja
  // kirjatut raportit). Erillinen oikeus, koska tämä on katselunäkymä eikä sen näkeminen
  // saa edellyttää oikeutta muokata kohteen perustietoja.
  { id: 'guard_site_info', label: 'Kohteen tiedot (kooste)' },
  // Työvuoron tehtävät: vartija kuittaa kohteelle määritellyt tehtävät suoritetuiksi.
  { id: 'guard_tasks', label: 'Työvuoron tehtävät' },
  // Raportointi. Omat solmunsa lomaketyypeittäin samaan tapaan kuin tapahtumapuolen
  // tike_form_*-solmut: vartijan toimenpide on päivittäistä kirjaamista, kun taas
  // tapahtumailmoitus sisältää LYTP:n nojalla kirjattavat kohdehenkilötiedot ja voi
  // hyvin perustein olla eri joukolla ihmisiä.
  { id: 'guard_reporting', label: 'Raportointi', children: [
    { id: 'guard_report_action', label: 'Vartijan toimenpide' },
    { id: 'guard_report_jv', label: 'Vartijan tapahtumailmoitus' },
  ] },
  // Sovellusasetukset. Oma solmunsa eikä EVENTin 'settings', vaikka näkymä on sama:
  // muuten GUARD-tunnuksen asetusoikeus avaisi myös tapahtumapuolen asetukset ja
  // päinvastoin. Sisältö on sama kuin EVENT-puolella lukuun ottamatta pikatoimintoja
  // (hätätekstiviestit), jotka ovat tapahtumapuolen toiminto.
  { id: 'guard_settings', label: 'Sovellusasetukset' },
];
