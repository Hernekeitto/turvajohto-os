// Viimeisin onnistunut istunto laitteella (erä 6, offline-käynnistys).
//
// Tarvitaan siihen, että sovellus aukeaa myös ilman verkkoa. Ilman tätä koko
// offline-tuki jäisi saavuttamatta: istuntokyselyn epäonnistuminen veisi
// kirjautumislomakkeelle, vaikka vartija on kirjautunut ja työtiedot ovat laitteella.
// Puute löytyi vasta kun offline testattiin oikeasti backend alhaalla — palvelutyöntekijä
// ja jono olivat siihen asti kunnossa, mutta sovellus ei päässyt niihin käsiksi.
//
// TÄMÄ EI OLE PÄÄSYNHALLINTAA. Palvelin tarkistaa istunnon jokaisessa pyynnössä.
// Offline-tilassa palvelimelta ei saada mitään, ja kirjaukset menevät lähtevään jonoon,
// jonka palvelin torjuu 401:llä jos istunto on oikeasti vanhentunut. Tallenne on siis
// pelkkä käyttöliittymän lupa avautua, ei oikeus dataan.
//
// Kaksi rajausta: tallenne vanhenee vuorokaudessa (sama kuin vuorodata), ja se
// poistetaan heti jos palvelin VASTAA eikä tunne istuntoa. Vain yhteyden puute
// oikeuttaa offline-käynnistykseen — kirjautuminen ulos ja istunnon vanheneminen
// eivät.
import type { SessionProfile } from '../SessionContext';

const AVAIN = 'turvajohto-istunto';
export const VANHENEE_TUNTIA = 24;

export function tallennaIstunto(profiili: SessionProfile) {
  try {
    window.localStorage.setItem(AVAIN, JSON.stringify({ tallennettu: Date.now(), profiili }));
  } catch {
    // Yksityinen selaustila tai tila lopussa: offline-käynnistys jää saamatta, mutta
    // sovellus toimii verkon kanssa normaalisti.
  }
}

export function unohdaIstunto() {
  try {
    window.localStorage.removeItem(AVAIN);
  } catch {
    // Ei kriittinen eikä saa estää uloskirjautumista.
  }
}

export function lueIstunto(nyt = Date.now()): SessionProfile | null {
  try {
    const raaka = window.localStorage.getItem(AVAIN);
    if (!raaka) return null;
    const paketti = JSON.parse(raaka);
    const ika = nyt - Number(paketti.tallennettu);
    if (!Number.isFinite(ika) || ika > VANHENEE_TUNTIA * 60 * 60 * 1000) return null;
    return paketti.profiili as SessionProfile;
  } catch {
    return null;
  }
}
