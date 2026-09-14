// Säilyttimen (avainkaappi, ajoneuvo) oma historia: mitä sinne on tullut ja mitä sieltä
// on lähtenyt.
//
// JOHDETTU NÄKYMÄ, EI OMA KOKOELMANSA. Säilyttimellä ei ole omaa lokia — jokaisen esineen
// oma historia kertoo missä se on ollut, ja tämä kokoaa niistä yhden säilyttimen
// näkökulman. Erillinen loki olisi toinen totuus samasta tapahtumasta, ja ne eroaisivat
// ensimmäisessä virheessä.
//
// Kysymys johon tämä vastaa on avainhävikin selvittäminen: "kaapissa pitäisi olla
// kymmenen avainta, siellä on yhdeksän — mitä on tapahtunut". `Kaapissa nyt` -lista
// kertoo mitä siellä on, tämä kertoo mitä siellä on KÄYNYT.
//
// SAAPUMISET JA LÄHDÖT SAMASSA LISTASSA eikä kahtena. Ne ovat saman liikkeen kaksi
// puolta, ja hävikkiä selvitettäessä niitä luetaan rinnakkain: avain tuli kaappiin
// maanantaina ja lähti keskiviikkona, vai eikö se tullutkaan takaisin. Kaksi listaa
// pakottaisi vertaamaan aikaleimoja kahdesta paikasta.
//
// Laskenta on selaimessa eikä palvelimella, koska aineisto on jo haettu: pankkinäkymällä
// on koko kalusto historioineen, eikä yhtä kaappia varten kannata tehdä verkkokutsua.
// Vartijan näkymästä historia on karsittu (server/kalusto.js), joten hänelle tämä
// palauttaa aina tyhjän — se on oikea lopputulos eikä puute.

import type { KalustonHistoria, KalustoTietue } from './tyypit';

export type Suunta = 'saapui' | 'lahti';

export type SailyttimenTapahtuma = {
  esineId: string;
  tunnus: string;
  nimi: string;
  holviPaikka?: number | null;
  suunta: Suunta;
  ts: string;
  // Mistä tuli (saapui) tai minne meni (lähti). Nimi sellaisena kuin se oli tapahtuman
  // hetkellä — kohde on voitu nimetä uudelleen tai poistaa sen jälkeen.
  //
  // TYHJÄ ON MAHDOLLINEN ja tarkoittaa saapumisessa sitä, ettei esineellä ollut aiempaa
  // sijoitusta: se kirjattiin pankkiin suoraan tähän säilyttimeen.
  vastapuoli: string;
  vastapuoliLaji: string | null;
  // Kuka siirsi. null jos merkintä on vanha tai järjestelmän tekemä.
  kuka: string | null;
};

// Historiarivit joilla on sijoitus. Osa merkinnöistä ei kerro paikasta mitään
// (muokkaus, pyyntö, pyynnön peruminen), eivätkä ne kuulu paikkaketjuun: jos ne
// jätettäisiin mukaan, "edellinen sijoitus" olisi tyhjä joka toisella rivillä.
const paikkaketju = (historia: KalustonHistoria[] | undefined) =>
  (historia || []).filter((rivi) => rivi.sijoitusLaji != null);

/**
 * Säilyttimen liikenne: saapumiset ja lähdöt yhtenä listana, uusin ensin.
 *
 * Molemmat tunnistetaan paikkaketjun PERÄKKÄISISTÄ riveistä. Rivi jolla esine on
 * säilyttimessä on saapuminen, jos edellinen paikka oli muualla (tai sitä ei ole);
 * sitä seuraava rivi muualle on lähtö. Sama esine voi esiintyä listalla useasti — avain
 * voi käydä kaapissa monta kertaa, ja jokainen käynti on kaksi riviä.
 *
 * Ennen erää 20e kirjatuilta historiariveiltä puuttuu `sijoitusId`, eivätkä ne osu
 * täsmäykseen. Niitä ei yritetä tunnistaa nimestä: kaksi samannimistä kaappia
 * tuottaisi vääriä rivejä, ja väärä rivi hävikkiselvityksessä on pahempi kuin puuttuva.
 */
export function sailyttimenTapahtumat(
  kalusto: KalustoTietue[],
  sailytinId: string
): SailyttimenTapahtuma[] {
  if (!sailytinId) return [];
  const tapahtumat: SailyttimenTapahtuma[] = [];

  for (const esine of kalusto) {
    const ketju = paikkaketju(esine.historia);
    const perus = {
      esineId: esine.id,
      tunnus: esine.tunnus,
      nimi: esine.nimi,
      holviPaikka: esine.holviPaikka,
    };

    for (let i = 0; i < ketju.length; i += 1) {
      const rivi = ketju[i];
      if (rivi.sijoitusId !== sailytinId) continue;

      // Saapuminen: edellinen paikka oli muualla, tai tämä on ensimmäinen paikka.
      // Peräkkäiset rivit samassa säilyttimessä (esim. huoltomerkintä joka ei siirrä
      // esinettä) eivät ole uusi saapuminen — muuten yksi käynti näkyisi monena.
      const edellinen = ketju[i - 1];
      if (!edellinen || edellinen.sijoitusId !== sailytinId) {
        tapahtumat.push({
          ...perus,
          suunta: 'saapui',
          ts: rivi.ts,
          vastapuoli: edellinen?.sijoitusNimi || '',
          vastapuoliLaji: edellinen?.sijoitusLaji ?? null,
          kuka: rivi.user,
        });
      }

      // Lähtö: seuraava paikka on muualla.
      const seuraava = ketju[i + 1];
      if (seuraava && seuraava.sijoitusId !== sailytinId) {
        tapahtumat.push({
          ...perus,
          suunta: 'lahti',
          ts: seuraava.ts,
          vastapuoli: seuraava.sijoitusNimi || '—',
          vastapuoliLaji: seuraava.sijoitusLaji,
          kuka: seuraava.user,
        });
      }
    }
  }

  return tapahtumat.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}
