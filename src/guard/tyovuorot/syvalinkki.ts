// Push-ilmoituksen linkki näkymään (10.10.2026): /guard?nakyma=omat-tyovuorot tai
// /guard?nakyma=tyovuorot. Palvelutyöntekijä avaa osoitteen (sw-pohja.js), ja sen
// näkymän komponentti joka linkin tunnistaa avautuu suoraan oikeaan kohtaan.
//
// Parametri poistetaan osoitteesta heti luettaessa: muuten sivun uudelleenlataus
// palaisi aina ilmoituksen näkymään, ja selaimen historiaan jäisi linkki jota ei ole.

export type Syvalinkki = 'omat-tyovuorot' | 'tyovuorot';

export function otaSyvalinkki(nimi: Syvalinkki): boolean {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get('nakyma') !== nimi) return false;
  url.searchParams.delete('nakyma');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  return true;
}
