// Vuoroon kirjautuminen laitteella (mobiiliversio).
//
// "Vuoro" tarkoittaa tässä sitä kohdetta jossa vartija on juuri nyt töissä. Se ei ole
// palvelimen tietue vaan laitteen tila, ja se on tarkoituksellinen rajaus ensimmäiseen
// versioon: nimettyjä vuoroja (Vuoro A/B/C) ei ole olemassa missään kokoelmassa, joten
// niiden keksiminen tänne tarkoittaisi, että käyttöliittymä lupaa työvuorosuunnittelun
// jota ei ole. Kohde sen sijaan on olemassa, ja se on juuri se tieto jota mobiilinäkymä
// tarvitsee: hälytykset, tiedotteet, kierrokset ja vyöhykesäännöt ovat kaikki kohteen
// omia.
//
// Kun vuorot joskus tulevat omaksi kokoelmakseen, tämän moduulin rajapinta pysyy samana
// ja toteutus vaihtuu palvelinkutsuksi — näkymien ei tarvitse muuttua.
//
// Tallenne on KÄYTTÄJÄKOHTAINEN samasta syystä kuin lähtevä jono ja vuorodata: sama
// puhelin voi vaihtaa kantajaa vuoron vaihtuessa, eikä edellisen vartijan vuoro saa
// jäädä seuraavan päälle.

export type Vuoro = {
  kohdeId: string;
  kohdeNimi: string;
  alkoi: string;
};

const AVAIN = 'turvajohto-guard-vuoro';

// Kuinka vanha vuoro vielä kelpaa. Sama vuorokausi kuin vuorodatalla: unohtunut
// uloskirjaus ei saa näkyä seuraavana päivänä "olet kirjautuneena vuoroon" -tietona,
// koska se olisi väärää tietoa juuri siitä asiasta jota näkymä väittää kertovansa.
export const VANHENEE_TUNTIA = 24;

export function lueVuoro(kayttaja: string, nyt = Date.now()): Vuoro | null {
  try {
    const raaka = window.localStorage.getItem(AVAIN);
    if (!raaka) return null;
    const paketti = JSON.parse(raaka);
    if (paketti?.kayttaja !== kayttaja) return null;
    const ika = nyt - new Date(paketti?.vuoro?.alkoi).getTime();
    if (!Number.isFinite(ika) || ika > VANHENEE_TUNTIA * 60 * 60 * 1000) return null;
    const vuoro = paketti.vuoro as Vuoro;
    return vuoro?.kohdeId ? vuoro : null;
  } catch {
    return null;
  }
}

export function tallennaVuoro(kayttaja: string, vuoro: Vuoro) {
  try {
    window.localStorage.setItem(AVAIN, JSON.stringify({ kayttaja, vuoro }));
  } catch {
    // Yksityinen selaustila: vuoro on voimassa vain tämän sivunlatauksen ajan.
  }
}

export function unohdaVuoro() {
  try {
    window.localStorage.removeItem(AVAIN);
  } catch {
    // Ei kriittinen eikä saa estää uloskirjautumista.
  }
}
