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
// väärin, koska työpöydällä vuoro on käyttöliittymän tila eikä valvontaa. Siksi tämä
// vaikenee kun sovellusta ei ole.

import { onAsennettuSovellus } from '../../shared/asennettu';
import type { Vuoro } from './vuoro';

const avaa = (osoite: string) => {
  if (!onAsennettuSovellus()) return;
  try {
    window.location.href = osoite;
  } catch {
    // Skeeman avaaminen voi epäonnistua selaimen asetuksista riippuen. Se ei saa kaataa
    // vuoron valintaa: käyttöliittymän vuoro on olemassa silloinkin kun natiivipalvelu
    // ei käynnistynyt, ja vartija näkee sen pysyvän ilmoituksen puuttumisesta.
  }
};

/**
 * Käynnistää tai siirtää natiivivuoron. Sama kutsu kelpaa kohteen vaihtoon kesken
 * vuoron: palvelu korvaa vuoronsa eikä käynnistä toista rinnalle.
 */
export function kaynnistaSovelluksessa(vuoro: Vuoro) {
  avaa('turvajohto-guard://vuoro'
    + `?id=${encodeURIComponent(vuoro.kohdeId)}`
    + `&nimi=${encodeURIComponent(vuoro.kohdeNimi)}`);
}

export function paataSovelluksessa() {
  avaa('turvajohto-guard://paata');
}
