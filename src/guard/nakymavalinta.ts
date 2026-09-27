// Työpöytäversion puolivalinta pääkäyttäjälle: Ylläpito vai Vartijanäkymä (27.9.2026,
// käyttäjän pyyntö: esimies näkee heti miten tekemänsä muutos näkyy vartijalle).
//
// Laitteen tila eikä palvelimen tietue, samasta syystä kuin laitevalinta: kyse on siitä
// mitä TÄLLÄ ruudulla katsotaan, ei tunnuksen ominaisuudesta. Valinta ei muuta
// oikeuksia — Vartijanäkymä näyttää vartijan näkymän pääkäyttäjän tunnuksella, joten
// palvelin palauttaa edelleen kaiken mitä pääkäyttäjä saa nähdä.
//
// OLETUS ON YLLÄPITO: puuttuva tai tuntematon arvo ei saa piilottaa hallintaa siltä
// joka sitä tarvitsee.

export type Puoli = 'yllapito' | 'vartija';

const AVAIN = 'turvajohto-guard-puoli';

export function luePuoli(): Puoli {
  try {
    return window.localStorage.getItem(AVAIN) === 'vartija' ? 'vartija' : 'yllapito';
  } catch {
    return 'yllapito';
  }
}

export function tallennaPuoli(puoli: Puoli) {
  try {
    window.localStorage.setItem(AVAIN, puoli);
  } catch {
    // Valinta jää voimaan vain tähän istuntoon. Se on parempi kuin kaatuminen.
  }
}
