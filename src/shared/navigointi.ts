// Takaisin-painike: sovelluksen näkymätila selaimen historiaan.
//
// --- Miksi tämä on olemassa ---------------------------------------------------------
//
// Sovelluksen navigointi on komponentin tilassa (EVENT: `activeTab` ja ylätason
// `viewing*`-tilat, GUARD: `*Kohde`-tilat), ei selaimen historiassa. Selaimessa se ei
// haittaa, koska osoitepalkki ja selaimen oma paluunappi ovat aina näkyvissä. Mutta
// ASENNETTUNA SOVELLUKSENA (`display: standalone`) Androidin takaisin-nappi on
// ainoa paluunappi, ja jos historiassa ei ole mitään, se SULKEE SOVELLUKSEN — kesken
// lomakkeen täytön, kesken kirjauksen, kesken kierroksen.
//
// Tämä moduuli tekee näkymävaihdoista historiamerkintöjä ja palauttaa näkymän kun
// takaisin-nappia painetaan.
//
// --- Miksi osoiterivi ei muutu ------------------------------------------------------
//
// Merkinnät työnnetään `history.pushState`illa NIIN, ETTÄ OSOITE PYSYY SAMANA
// (`/event` tai `/guard`) ja näkymä kuljetetaan merkinnän tilaobjektissa. Vaihtoehto
// olisi antaa jokaiselle näkymälle oma osoite, mutta se vaatisi nginxiltä
// polkukohtaisen ohjauksen index.html:ään — eli palvelinmuutoksen jota ei voi testata
// kehityksessä — ja rikkoisi manifestin scopen (`/guard`, ks. asennus/LUEMINUT.md).
// Näkymien jakaminen linkkinä ei myöskään ole tavoite: sovellukseen kirjaudutaan.
//
// --- Malli: yksi merkintä yhtä käyttäjän siirtymää kohti ----------------------------
//
// Jokainen näkymän vaihto työntää merkinnän, myös sovelluksen oma "Takaisin"-linkki.
// Takaisin-nappi siis PERUU KÄYTTÄJÄN VIIMEISEN SIIRTYMÄN, olipa se eteen- tai
// taaksepäin. Se on sama käyttäytyminen kuin tavallisella verkkosivulla: jos käyttäjä
// meni A -> B -> (paluulinkki) A, takaisin-nappi vie B:hen.
//
// Vaihtoehto olisi tunnistaa paluulinkit ja kutsua niissä `history.back()`, jolloin
// historia ei kasvaisi. Sitä ei tehty, koska paluulinkit tekevät samassa
// käsittelijässä muutakin (nollaavat lomakekenttiä), ja `history.back()` on
// asynkroninen — näkymä vaihtuisi vasta seuraavassa tapahtumasilmukan kierroksessa
// eikä samassa klikkauksessa. Ennustettavuus on tässä tärkeämpää kuin siisti historia.
//
// Juurinäkymässä takaisin-nappi POISTUU sovelluksesta. Se on oikea käyttäytyminen:
// asennetun sovelluksen etusivulta takaisin tarkoittaa sulkemista.

import { useEffect, useRef } from 'react';

// Historiamerkinnän oma tila. `tjNakyma` on näkymän tunniste (sovellus päättää sen
// muodon), `tjEste` on avoinna olevan päällekkäisnäkymän — modaalin — tunnus.
type HistoriaTila = { tjNakyma?: string; tjEste?: number } | null;

type Este = { sulje: () => void; jarjestys: number };

// Avoinna olevat esteet avausjärjestyksessä; päällimmäinen on viimeinen. Moduulitasolla
// eikä Reactin tilassa, koska popstate-käsittelijän on nähtävä ne ilman että
// navigointihookilla on riippuvuutta jokaiseen modaaliin.
const esteet: Este[] = [];

let seuraavaEsteId = 1;

// Kuinka monta merkintää sovellus on työntänyt historiaan ja jättänyt kuluttamatta.
// Kasvaa työnnöstä, pienenee popstatesta. Este vertaa tähän omaa lukuaan ja tietää
// siitä, onko sen oma merkintä yhä historian päällimmäinen.
let tyonnot = 0;

// Tosi sen hetken ajan kun popstate sulkee estettä. Silloin esteen siivous EI saa
// kutsua history.backia: selain on jo peruuttanut, ja toinen peruutus vaihtaisi
// näkymän käyttäjän selän takana.
let peruutetaanParhaillaan = false;

function tyonna(tila: HistoriaTila) {
  tyonnot += 1;
  window.history.pushState(tila, '');
}

/**
 * Kytkee sovelluksen näkymätilan historiaan. Kutsutaan KERRAN sovelluksen juuressa.
 *
 * `nakyma` on nykyisen näkymän tunniste, joka johdetaan sovelluksen omista tiloista.
 * `siirry` viedään näkymätunniste ja sen on asetettava tilat vastaavasti — sitä
 * kutsutaan vain takaisin-napista, ei koskaan sovelluksen omista siirtymistä.
 */
export function useHistorianavigointi(nakyma: string, siirry: (nakyma: string) => void) {
  // Mitä historian nykyinen merkintä sanoo näkymäksi. Tämä on se vertailukohta joka
  // ratkaisee työnnetäänkö uusi merkintä: popstate asettaa tämän ENNEN kuin se
  // muuttaa sovelluksen tilaa, joten paluun aiheuttama näkymämuutos ei työnnä
  // merkintää takaisin historiaan.
  const merkinnanNakyma = useRef(nakyma);

  // Viimeisin `siirry` ilman että popstate-kuuntelija joutuu rekisteröitymään
  // uudelleen joka renderöinnillä.
  const siirryRef = useRef(siirry);
  siirryRef.current = siirry;

  // Nimetään avausmerkintä. Ilman tätä ensimmäinen takaisin-painallus kohtaisi
  // merkinnän jossa ei ole tjNakymaa, eikä osaisi palauttaa mitään.
  useEffect(() => {
    const tila = window.history.state as HistoriaTila;
    window.history.replaceState({ ...tila, tjNakyma: merkinnanNakyma.current }, '');
  }, []);

  useEffect(() => {
    if (nakyma === merkinnanNakyma.current) return;
    merkinnanNakyma.current = nakyma;
    tyonna({ tjNakyma: nakyma });
  }, [nakyma]);

  useEffect(() => {
    const kuuntele = (tapahtuma: PopStateEvent) => {
      const tila = tapahtuma.state as HistoriaTila;

      // Yksi merkintä kului. Tämä on syvyyslaskuri eikä siirtymien määrä, joten se ei
      // saa mennä negatiiviseksi silloin kun peruutus osuu merkintään jota sovellus ei
      // itse työntänyt.
      tyonnot = Math.max(0, tyonnot - 1);

      // Päällimmäinen este ensin: avoin modaali sulkeutuu eikä näkymä vaihdu. Tämä on
      // se mitä käyttäjä odottaa — takaisin sulkee päällimmäisen asian, ei kahta.
      const este = esteet[esteet.length - 1];
      if (este) {
        peruutetaanParhaillaan = true;
        try {
          este.sulje();
        } finally {
          peruutetaanParhaillaan = false;
        }
        // Esteen merkintä työnnettiin näkymämerkinnän PÄÄLLE, joten peruutus osui
        // samaan näkymään jossa ollaan jo. Pidetään vertailukohta ajan tasalla.
        if (tila?.tjNakyma) merkinnanNakyma.current = tila.tjNakyma;
        return;
      }

      // Merkintä jota tämä moduuli ei tehnyt (esim. selaimen palauttama vanha tila).
      // Ei arvata mitään: näkymä jää ennalleen.
      if (!tila?.tjNakyma) return;

      merkinnanNakyma.current = tila.tjNakyma;
      siirryRef.current(tila.tjNakyma);
    };

    window.addEventListener('popstate', kuuntele);
    return () => window.removeEventListener('popstate', kuuntele);
  }, []);
}

/**
 * Tekee päällekkäisnäkymästä — modaalista — takaisin-napilla suljettavan.
 *
 * Kutsutaan ehdottomasti joka renderöinnillä (Reactin hooksääntö), ja `aktiivinen`
 * kertoo onko modaali auki. Avautuessaan modaali saa oman historiamerkintänsä, jonka
 * takaisin-nappi kuluttaa: näkymä ei vaihdu, vain modaali sulkeutuu.
 *
 * `sulje` on sama toiminto kuin modaalin omassa sulkunapissa. Sen pitää palauttaa
 * modaali kiinni myös silloin kun siihen on kirjoitettu jotain — takaisin-nappi ei
 * tallenna, se peruu, samoin kuin taustan klikkaus.
 */
export function useTakaisinEste(aktiivinen: boolean, sulje: () => void) {
  const suljeRef = useRef(sulje);
  suljeRef.current = sulje;

  useEffect(() => {
    if (!aktiivinen) return;

    seuraavaEsteId += 1;
    const este: Este = { sulje: () => suljeRef.current(), jarjestys: tyonnot + 1 };
    esteet.push(este);
    tyonna({ tjEste: seuraavaEsteId });

    return () => {
      const kohta = esteet.indexOf(este);
      if (kohta !== -1) esteet.splice(kohta, 1);

      // Modaali sulkeutui omalla napillaan tai tallennuksen jälkeen, ei
      // takaisin-napista. Sen historiamerkintä on silti yhä olemassa, ja jos sitä ei
      // kuluteta, seuraava takaisin-painallus tuntuu jumittavan: se kuluttaisi
      // merkinnän jonka näkymä on sama kuin nykyinen.
      //
      // Vain jos merkintä on yhä päällimmäinen. Jos sen päälle on työnnetty
      // näkymämerkintä (modaalin toiminto vaihtoi näkymän), peruutus vaihtaisi
      // näkymän takaisin — silloin merkintä jätetään historiaan.
      if (!peruutetaanParhaillaan && tyonnot === este.jarjestys) window.history.back();
    };
  }, [aktiivinen]);
}
