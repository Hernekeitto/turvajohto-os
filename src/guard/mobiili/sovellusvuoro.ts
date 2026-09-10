// Vuoron välitys natiivipalvelulle (erä 10 osa 3).
//
// Vuoro on laitteen tila kahdessa paikassa: selaimen localStoragessa (vuoro.ts) ja
// natiivipalvelussa, joka jatkaa valvontaa kun selain nukkuu. Tämä moduuli pitää ne
// samassa tilassa — se on ainoa kohta jossa selain kertoo sovellukselle vuorosta.
//
// --- Miksi oma moduuli eikä sivuvaikutus vuoro.ts:ään ------------------------------
//
// Houkutus olisi laittaa tämä `tallennaVuoro`n sisään, jolloin kaikki reitit hoituisivat
// itsestään. Sitä ei tehdä: vuoro.ts on varasto, ja varasto joka käynnistää
// taustapalveluita ei ole enää varasto. Sitä ei voisi testata eikä lukea sinä mitä se
// väittää olevansa. Kutsuja päättää, ja kutsupaikkoja on kolme.
//
// --- Miksi tämä ei tee mitään selaimessa ------------------------------------------
//
// Oma URL-skeema on sovelluksen osoite, eikä selaimessa ole sovellusta jolle puhua.
// Tavallisessa selaimessa kutsu joko ei tee mitään tai näyttää virheen — kumpikin olisi
// väärin, koska työpöydällä vuoro on käyttöliittymän tila eikä valvontaa.
//
// --- Miksi se ei silti saa VAIETA -------------------------------------------------
//
// Aluksi tämä palautti `void` ja vaikeni. Se oli oikein työpöydällä ja väärin puhelimessa,
// ja ero maksoi 10.9.2026 kokonaisen päivätestin: vuoro käynnistettiin Androidin
// selainvälilehdestä, natiivipalvelu ei kuullut siitä mitään, ja käyttöliittymä näytti
// vuoron käynnissä olevalta koko päivän. Kierros valmistui 10/10 pisteellä ilman että
// valvonta oli hetkeäkään päällä.
//
// Siksi tämä KERTOO tavoitettiinko sovellus, ja kutsuja päättää mitä siitä sanotaan.
// Vaikeneminen on yhä oikea vastaus työpöydällä — mutta se on nyt kutsujan päätös.
//
// Huomaa mitä `avattu` tarkoittaa ja mitä ei: skeema avattiin, eikä se ole todiste siitä
// että palvelu käynnistyi. Ainoa todiste siitä on palvelimelle saapuva sydämenlyönti
// (server/laite.js, valvonnanTila).

// Pääte mukana, koska tämä moduuli on testattava: Vite kestää sen ilmankin, mutta
// node --test käyttää ESM-resolvointia. Sama tapa kuin muissakin testatuissa moduuleissa.
import { onAsennettuSovellus } from '../../shared/asennettu.ts';
import type { Vuoro } from './vuoro';

export type Vuoronvalitys = 'avattu' | 'ei_tavoitettu';

const avaa = (osoite: string): Vuoronvalitys => {
  if (!onAsennettuSovellus()) return 'ei_tavoitettu';
  try {
    window.location.href = osoite;
  } catch {
    // Skeeman avaaminen voi epäonnistua selaimen asetuksista riippuen. Se ei saa kaataa
    // vuoron valintaa: käyttöliittymän vuoro on olemassa silloinkin kun natiivipalvelu
    // ei käynnistynyt. Kutsuja saa tiedon ja kertoo sen käyttäjälle.
    return 'ei_tavoitettu';
  }
  return 'avattu';
};

/**
 * Onko tämä alusta jolla sovellus ylipäätään on olemassa.
 *
 * Tätä kysytään VAIN sen ratkaisemiseen kannattaako sovelluksen puuttumisesta varoittaa.
 * Työpöydällä ja iPhonella ei ole sovellusta johon ohjata, joten varoitus olisi siellä
 * pelkkää melua; Androidilla se on se yksi asia joka olisi paljastanut 10.9. vian heti.
 */
export function onAlustaJollaSovellus(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent || '');
}

/**
 * Käynnistää tai siirtää natiivivuoron. Sama kutsu kelpaa kohteen vaihtoon kesken
 * vuoron: palvelu korvaa vuoronsa eikä käynnistä toista rinnalle.
 */
export function kaynnistaSovelluksessa(vuoro: Vuoro): Vuoronvalitys {
  // Pysyvässä ilmoituksessa näkyvä teksti. Vuorotyyppi mukaan, koska pelkkä kohteen nimi
  // ei erota aamu- ja yövuoroa toisistaan — ja se on juuri se ero jonka vartija tarkistaa
  // ilmoituksesta silloin kun hän epäilee kirjautuneensa väärään vuoroon.
  const nimi = vuoro.vuorotyyppiNimi
    ? `${vuoro.kohdeNimi} · ${vuoro.vuorotyyppiNimi}`
    : vuoro.kohdeNimi;

  // `vuoro` on palvelimen vuorotietueen tunniste. NYKYINEN SOVELLUS EI LUE SITÄ
  // (SiltaActivity poimii vain id:n ja nimen), ja tuntematon kyselyparametri jää siltä
  // huomiotta. Se lähetetään silti nyt, jotta kun sijainnin lähetys erässä 11 ripustetaan
  // vuoroon, tieto on jo sillassa eikä sitä tarvitse lisätä samalla kun se otetaan
  // käyttöön — kaksi muutosta yhdellä kertaa on kaksi kertaa vaikeampi todeta oikeaksi.
  return avaa('turvajohto-guard://vuoro'
    + `?id=${encodeURIComponent(vuoro.kohdeId)}`
    + `&nimi=${encodeURIComponent(nimi)}`
    + (vuoro.vuoroId ? `&vuoro=${encodeURIComponent(vuoro.vuoroId)}` : ''));
}

// Päättämisen tulosta ei tarvitse kertoa käyttäjälle: jos sovellusta ei tavoitettu, ei ole
// myöskään palvelua jota pitäisi sammuttaa. Vain käynnistys on lupaus joka voi pettää.
export function paataSovelluksessa(): Vuoronvalitys {
  return avaa('turvajohto-guard://paata');
}
