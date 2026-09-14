// Säilyttimen (avainkaappi, ajoneuvo) oma historia: mitä sieltä on lähtenyt ja milloin.
//
// JOHDETTU NÄKYMÄ, EI OMA KOKOELMANSA. Säilyttimellä ei ole omaa lokia — jokaisen esineen
// oma historia kertoo missä se on ollut, ja tämä kokoaa niistä yhden säilyttimen
// näkökulman. Erillinen loki olisi toinen totuus samasta tapahtumasta, ja ne eroaisivat
// ensimmäisessä virheessä.
//
// Kysymys johon tämä vastaa on avainhävikin selvittäminen: "kaapissa pitäisi olla
// kymmenen avainta, siellä on yhdeksän — mikä on lähtenyt ja minne". `Kaapissa nyt`
// -lista kertoo mitä siellä on, tämä kertoo mitä siellä on OLLUT.
//
// Laskenta on selaimessa eikä palvelimella, koska aineisto on jo haettu: pankkinäkymällä
// on koko kalusto historioineen, eikä yhtä kaappia varten kannata tehdä verkkokutsua.
// Vartijan näkymästä historia on karsittu (server/kalusto.js), joten hänelle tämä
// palauttaa aina tyhjän — se on oikea lopputulos eikä puute.

import type { KalustonHistoria, KalustoTietue } from './tyypit';

export type Lahto = {
  esineId: string;
  tunnus: string;
  nimi: string;
  holviPaikka?: number | null;
  // Milloin esine lähti säilyttimestä.
  lahti: string;
  // Mihin se meni. Nimi sellaisena kuin se oli lähtöhetkellä — kohde on voitu nimetä
  // uudelleen tai poistaa sen jälkeen.
  minne: string;
  minneLaji: string | null;
  // Kuka siirsi. null jos merkintä on vanha tai järjestelmän tekemä.
  kuka: string | null;
};

// Historiarivit joilla on sijoitus. Osa merkinnöistä ei kerro paikasta mitään
// (muokkaus, pyyntö, pyynnön peruminen), eivätkä ne kuulu paikkaketjuun: jos ne
// jätettäisiin mukaan, "edellinen sijoitus" olisi tyhjä joka toisella rivillä.
const paikkaketju = (historia: KalustonHistoria[] | undefined) =>
  (historia || []).filter((rivi) => rivi.sijoitusLaji != null);

/**
 * Mitä säilyttimestä on lähtenyt, uusin ensin.
 *
 * Lähtö tunnistetaan paikkaketjun PERÄKKÄISISTÄ riveistä: jos esine oli rivillä i
 * säilyttimessä ja rivillä i+1 jossain muualla, se lähti rivin i+1 hetkellä. Sama esine
 * voi esiintyä listalla useasti — avain voi käydä kaapissa monta kertaa, ja jokainen
 * käynti on oma rivinsä.
 *
 * Ennen erää 20e kirjatuilta historiariveiltä puuttuu `sijoitusId`, eivätkä ne osu
 * täsmäykseen. Niitä ei yritetä tunnistaa nimestä: kaksi samannimistä kaappia
 * tuottaisi vääriä rivejä, ja väärä rivi hävikkiselvityksessä on pahempi kuin puuttuva.
 */
export function sailyttimenLahdot(kalusto: KalustoTietue[], sailytinId: string): Lahto[] {
  if (!sailytinId) return [];
  const lahdot: Lahto[] = [];

  for (const esine of kalusto) {
    const ketju = paikkaketju(esine.historia);
    for (let i = 0; i < ketju.length - 1; i += 1) {
      const oli = ketju[i];
      const seuraava = ketju[i + 1];
      if (oli.sijoitusId !== sailytinId) continue;
      if (seuraava.sijoitusId === sailytinId) continue;
      lahdot.push({
        esineId: esine.id,
        tunnus: esine.tunnus,
        nimi: esine.nimi,
        holviPaikka: esine.holviPaikka,
        lahti: seuraava.ts,
        minne: seuraava.sijoitusNimi || '—',
        minneLaji: seuraava.sijoitusLaji,
        kuka: seuraava.user,
      });
    }
  }

  return lahdot.sort((a, b) => String(b.lahti).localeCompare(String(a.lahti)));
}
