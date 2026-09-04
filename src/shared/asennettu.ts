// Onko sovellus asennettu laitteelle vai auki selaimessa.
//
// Tällä on yksi käyttö: ISTUNNON KESTO. Asennetussa sovelluksessa istuntoa ei
// rajoiteta, selaimessa rajoitetaan (server/istunto.js kertoo miksi). Tieto
// lähetetään kirjautumisen yhteydessä, ja palvelin leivoo sen tokeniin.
//
// --- Mitä "asennettu" tarkoittaa ----------------------------------------------------
//
// `display-mode: standalone` on tosi kun sovellus on avattu manifestin kautta omana
// sovelluksenaan: Play Storesta asennettu TWA, selaimesta asennettu PWA ja työpöydän
// Chromeen asennettu sovellus ovat kaikki tätä. Selaimen välilehti ei ole, eikä ole
// myöskään Androidin "Lisää aloitusnäyttöön" -pikakuvake joka avaa välilehden.
//
// Raja on siis sama kuin käyttäjän oma ehto: sovellus on ASENNETTU laitteelle, ja
// asentamisen ehtona on laitteen lukitus vahvalla salasanalla.
//
// --- Miksi tätä ei voi tarkistaa palvelimella ---------------------------------------
//
// TWA on tavallinen Chrome, eikä sen API-kutsuissa ole mitään erottavaa. TWA lähettää
// `X-Requested-With`-otsakkeen paketin nimellä, mutta vain SIVULATAUKSESSA, jonka
// tarjoilee nginx eikä sovelluspalvelin. Palvelin luottaa siis tähän väittämään;
// varsinainen suoja rajoittamattomalle istunnolle on pakkouloskirjaus, ei tämä.

export function onAsennettuSovellus(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    // Kioskimainen koko ruudun tila. Manifesteissa on standalone, mutta jos display
    // joskus vaihtuu, tämä ei jäisi huomaamatta väärään suuntaan.
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  } catch {
    // matchMedia puuttuu tai heittää: kohdellaan selaimena. Oletuksen suunta on
    // tässä tärkeä — epäselvä tilanne EI saa tuottaa rajoittamatonta istuntoa.
    return false;
  }
  // iOS:n oma vanha lippu kotinäytölle lisätylle sovellukselle. Se ei tunne
  // display-mode-kyselyä samalla tavalla.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}
