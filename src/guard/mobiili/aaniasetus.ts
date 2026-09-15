// Hälytysäänen asetus laitteella (erä 23).
//
// Laitteen tila eikä palvelimen tietue, samasta syystä kuin vuoro (mobiili/vuoro.ts):
// selaimen äänilupa on laitekohtainen, eikä sama tunnus toisella puhelimella peri toisen
// puhelimen lupaa. Palvelimelle tallennettu "ääni päällä" lupaisi jotain mitä toinen
// laite ei voi pitää.
//
// OLETUS ON PÄÄLLÄ. Tämä poikkeaa hälytyskeskuksen äänestä, joka on oletuksena pois:
// valvomossa istuva päivystäjä katsoo ruutua koko ajan, kentällä oleva vartija ei.
// Ominaisuus jonka takia se tehtiin ei toteudu, jos se on oletuksena pois päältä.

const AVAIN = 'turvajohto-guard-halytysaani';

export function lueAaniasetus(): boolean {
  try {
    return window.localStorage.getItem(AVAIN) !== '0';
  } catch {
    // Yksityinen ikkuna tai estetty tallennus. Oletus on päällä, ks. yllä.
    return true;
  }
}

export function tallennaAaniasetus(paalla: boolean) {
  try {
    window.localStorage.setItem(AVAIN, paalla ? '1' : '0');
  } catch {
    // Asetus jää voimaan vain tähän istuntoon. Se on parempi kuin kaatuminen.
  }
}
