// Mistä hälytystehtävistä tämä laite on jo hälyttänyt (erä 25).
//
// --- MIKSI TÄMÄ TARVITAAN -----------------------------------------------------------
//
// Erässä 23 "uusi tehtävä" pääteltiin vertaamalla listaa EDELLISEEN LISTAAN muistissa.
// Se on väärä vertailukohta kahdesta syystä, ja molemmat tuottivat saman oireen:
// sama hälytys soi uudelleen ja uudelleen.
//
//   1. SOVELLUKSEN KÄYNNISTYS. Lista on aluksi tyhjä ja täyttyy vasta kun haku vastaa,
//      joten jokainen avoin tehtävä oli "uusi" joka ainoalla käynnistyksellä. Kuittaus,
//      puhelin taskuun, ruutu lukkoon — ja seuraava avaus hälytti samasta keikasta
//      uudelleen. Vanha koodi yritti estää tämän ohittamalla ENSIMMÄISEN renderin, mutta
//      ensimmäinen render tapahtuu ennen hakua eikä sen jälkeen.
//
//   2. KOHDENNUKSEN HEILAHTELU. Sädekohdennus (erä 22) lukee vartijan viimeksi tiedettyä
//      sijaintia, joka vanhenee puolessa tunnissa. Kun sijainti vanhenee, tehtävä katoaa
//      listalta; kun sovellus avataan ja sijainti päivittyy, se palaa — ja näytti taas
//      uudelta.
//
// Oikea vertailukohta on siis LAITTEEN MUISTI siitä mistä on jo hälytetty, ei edellinen
// haku. Sama sopimus kuin vuorolla ja äänivalinnalla: laitteen tila, ei palvelimen —
// sama tunnus toisella puhelimella ei ole nähnyt eikä kuullut mitään.
//
// --- MIKSI VANHENEMINEN ON AIKAAN EIKÄ LISTAAN SIDOTTU ------------------------------
//
// Houkutus olisi siivota ne tunnisteet jotka eivät enää ole avoimien listalla. SE OLISI
// TÄSMÄLLEEN SE VIKA JOTA TÄMÄ KORJAA: kohdennuksen heilahtelussa tehtävä katoaa
// listalta hetkeksi, jolloin siivous unohtaisi sen ja paluu hälyttäisi uudelleen.
// Siivous tehdään siksi iän perusteella.

const AVAIN = 'turvajohto-guard-halytetyt';

// Kuinka kauan merkintä säilyy. Kaksitoista tuntia kattaa yhden vuoron: saman vuoron
// aikana sama keikka ei hälytä toista kertaa, ja seuraavaan vuoroon mennessä lista on
// tyhjentynyt itsestään. Päättyneet tehtävät eivät tule listalle enää muutenkaan.
const VANHENEE_MS = 12 * 60 * 60 * 1000;

type Tallenne = Record<string, number>;

function lue(): Tallenne {
  try {
    const raaka = window.localStorage.getItem(AVAIN);
    if (!raaka) return {};
    const data = JSON.parse(raaka);
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Tallenne) : {};
  } catch {
    // Vioittunut tallenne tai estetty tallennus. Tyhjä on turvallinen oletus: pahin
    // seuraus on yksi ylimääräinen hälytys, ei hälytyksen puuttuminen.
    return {};
  }
}

function kirjoita(tallenne: Tallenne) {
  try {
    window.localStorage.setItem(AVAIN, JSON.stringify(tallenne));
  } catch {
    // Merkintä jää vain tähän istuntoon. Sovellus toimii silti.
  }
}

const tuoreet = (tallenne: Tallenne, nyt: number): Tallenne => Object.fromEntries(
  Object.entries(tallenne).filter(([, ts]) => nyt - ts < VANHENEE_MS)
);

/**
 * Ne tunnisteet joista EI ole vielä hälytetty tällä laitteella.
 *
 * Merkitsee palautetut samalla hälytetyiksi: kutsuja saa jokaisen tunnisteen tasan
 * kerran, eikä kahta kutsua voi tulla väliin. Jos merkintä tehtäisiin vasta äänen
 * soitua, kaksi peräkkäistä hakua ehtisi molemmat lukea saman tunnisteen uutena.
 */
export function uudetTehtavat(idt: string[], nyt = Date.now()): string[] {
  const tallenne = tuoreet(lue(), nyt);
  const uudet = idt.filter((id) => !(id in tallenne));
  if (uudet.length === 0) {
    // Kirjoitetaan silti, jotta vanhentuneet siivoutuvat myös silloin kun mitään uutta
    // ei tule. Muuten tallenne kasvaisi niin kauan kuin hälytyksiä ei tule.
    kirjoita(tallenne);
    return [];
  }
  for (const id of uudet) tallenne[id] = nyt;
  kirjoita(tallenne);
  return uudet;
}
