// GUARD-puolen laitevalinta: kumpaa versiota tunnus käyttää TÄLLÄ laitteella.
//
// Vartija tekee vuoron työn puhelimella ja pidemmät raportit tietokoneella, joten
// kyseessä ei ole yksi käyttöliittymä joka mukautuu leveyteen vaan kaksi erilaista
// näkymää samaan dataan (ks. src/guard/mobiili/). Valinta tehdään kirjautumislomakkeella
// ja se muistetaan laitteella — sitä EI tallenneta palvelimelle, koska sama tunnus
// kirjautuu eri laitteilla eikä toisen laitteen valinta saa seurata mukana.
//
// Valinta ei ole oikeus eikä turvaominaisuus: molemmat versiot näyttävät saman datan
// samoilla oikeuksilla, ja osoitteen voi kirjoittaa käsin kumpaan tahansa.

export type Laite = 'tyopoyta' | 'mobiili';

const AVAIN = 'turvajohto-guard-laite';

// Kanoniset polut. Mobiiliversio on /guard-polun ALLA eikä oma tuotteensa: sama
// kirjautuminen, samat oikeudet ja sama palvelutyöntekijän scope (/guard), jolloin
// asennettu sovellus kattaa molemmat ilman erillistä manifestia.
export const TYOPOYTAPOLKU = '/guard';
export const MOBIILIPOLKU = '/guard/mobile';

export const laitteenPolku = (laite: Laite) => (laite === 'mobiili' ? MOBIILIPOLKU : TYOPOYTAPOLKU);

export function lueLaitevalinta(): Laite | null {
  try {
    const arvo = window.localStorage.getItem(AVAIN);
    return arvo === 'mobiili' || arvo === 'tyopoyta' ? arvo : null;
  } catch {
    // Yksityinen selaustila: valinta on voimassa vain tämän sivunlatauksen ajan.
    return null;
  }
}

export function tallennaLaitevalinta(laite: Laite) {
  try {
    window.localStorage.setItem(AVAIN, laite);
  } catch {
    // Ks. yllä. Kirjautuminen ei saa kaatua siihen ettei valintaa voi tallentaa.
  }
}

// Ehdotus kirjautumislomakkeen esivalinnaksi silloin kun laitteella ei ole vielä
// valintaa. Karkea osoitin (kosketusnäyttö) yhdessä kapean ikkunan kanssa on paras
// selaimesta saatava vihje puhelimesta; kumpikaan yksin ei riitä, koska kosketusnäytöllä
// varustettu kannettava ja kapea työpöytäikkuna ovat molemmat tavallisia.
//
// PELKKÄ EHDOTUS: käyttäjä valitsee itse, eikä arvaus koskaan ohita tallennettua
// valintaa. Tabletti on tässä tarkoituksella työpöytäversiossa — se on lähempänä
// tietokoneen kuin puhelimen käyttötapaa.
export function arvaaLaite(): Laite {
  try {
    const kosketus = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const kapea = window.innerWidth <= 820;
    return kosketus && kapea ? 'mobiili' : 'tyopoyta';
  } catch {
    return 'tyopoyta';
  }
}
