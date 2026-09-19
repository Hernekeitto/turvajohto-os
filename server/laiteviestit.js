// Laitteiden väliset kohdennetut viestit (to-device, erä 26, vaihe 2, viipale 2c).
//
// Kuljettaa OlmMachine-instanssien tuottamat ToDeviceRequestit laitteelta toiselle —
// tarvitaan huoneavaimen jakoon (shareRoomKey) ja Olm-istuntojen perustamiseen. Palvelin
// EI TULKITSE sisältöä: se on aina jo Olm-salattu asiakkaan puolella, palvelin vain
// säilyttää ja toimittaa. Sama periaate kuin kryptoavaimet.js:ssä.
//
// EPHEMEERINEN JONO EIKÄ PYSYVÄ LOKI: viesti poistuu heti kun kohdelaite hakee sen — ei
// toistoa, ei historiaa. Kohdelaitteen ei tarvitse olla juuri nyt yhteydessä (WS), koska
// hakija voi hakea myöhemmin; siksi tämä on tallennettu kokoelma eikä puheenvuoro.js:n
// kaltainen puhtaasti muistissa oleva tila.
//
// Säännöt ovat täällä, I/O ja Express kutsujassa — sama jako kuin kanavat.js:ssä.

/** Uusi jonotettava viesti. `sisalto` on kutsujalle läpinäkyvä (jo salattu asiakkaan puolella). */
export function luoLaiteviesti({ id, lahettaja, kohdeKayttaja, kohdeLaite, tyyppi, sisalto, nyt = Date.now() }) {
  return { id, lahettaja, kohdeKayttaja, kohdeLaite, tyyppi, sisalto, lahetetty: new Date(nyt).toISOString() };
}

/** Tälle (käyttäjä, laite) -parille jonossa olevat viestit, lähetysjärjestyksessä. */
export function laitteenViestit(viestit, kohdeKayttaja, kohdeLaite) {
  return (viestit || []).filter((v) => v.kohdeKayttaja === kohdeKayttaja && v.kohdeLaite === kohdeLaite);
}

/** Kokoelma ilman annetulle laitteelle osoitettuja viestejä — kutsutaan haun jälkeen (pop). */
export function poistaLaitteenViestit(viestit, kohdeKayttaja, kohdeLaite) {
  return (viestit || []).filter((v) => !(v.kohdeKayttaja === kohdeKayttaja && v.kohdeLaite === kohdeLaite));
}
