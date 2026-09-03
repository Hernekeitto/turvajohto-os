// Kuluvan vuoron työtiedot laitteella (erä 6 osa 4, päätös V4.1 = b).
//
// Palvelutyöntekijä tallentaa sovellusrungon mutta EI API-vastauksia. Pelkkä runko ei
// kuitenkaan riitä kierroksen tekemiseen: vartija tarvitsee kohteen ohjeet, työvuoron
// tehtävät ja kierroksen tarkistuspisteet. Ne tallennetaan tänne — erikseen ja
// valikoiden, koska silloin voidaan päättää tarkasti mitä laitteelle jää.
//
// --- Mitä EI tallenneta ja miksi ---------------------------------------------------
//
// Kadonnut tai varastettu puhelin ei saa olla tietoturvaloukkaus. Siksi laitteelle ei
// jää mitään mikä kertoo ihmisistä:
//
//   * RAPORTIT (guardReports) — sisältävät kohdehenkilön nimen, henkilötunnuksen,
//     osoitteen ja tuntomerkit. Nämä ovat koko sovelluksen arkaluonteisin aineisto.
//   * TYÖNTEKIJÄLISTA (employees) — koko yrityksen henkilöstörekisteri.
//   * KOHTEEN PEREHDYTYKSET — nimilista siitä kuka on perehdytetty kohteeseen. Se on
//     työntekijälistan osajoukko ja jää siksi myös pois, vaikka kohde muuten tallennetaan.
//   * PÄÄTTYNEET KIERROKSET — historia ei auta kentällä. Vain kesken oleva kierros
//     tallennetaan, koska se on se jota parhaillaan tehdään.
//
// Kohteen yhteyshenkilö ja puhelinnumero tallennetaan tarkoituksella: hätätilanteessa
// vartijan on saatava kiinni kohteen vastuuhenkilö, eikä se onnistu jos numero on vain
// palvelimella. Se on toimeksiantajan yhteystieto eikä kohdehenkilön tunniste.
//
// --- Elinkaari ---------------------------------------------------------------------
//
// Tiedot tallennetaan käyttäjäkohtaisella avaimella ja poistetaan uloskirjautuessa.
// Vanhentuneita ei näytetä: viikon takainen tehtävälista olisi pahempi kuin tyhjä
// näkymä, koska se näyttäisi ajantasaiselta.

import type { Kohde, Kierrospohja, Kierros } from '../guard/tyypit';

export type Vuorodata = {
  tallennettu: string;
  kohteet: Kohde[];
  pohjat: Kierrospohja[];
  kierrokset: Kierros[];
};

const AVAIN_ETULIITE = 'turvajohto-vuoro:';

// Kuinka vanhaa tallennetta vielä käytetään. Vuoro on enintään vuorokauden mittainen,
// ja sitä vanhempi tehtävälista on todennäköisesti muuttunut.
export const VANHENEE_TUNTIA = 24;

const avain = (kayttaja: string) => AVAIN_ETULIITE + (kayttaja || 'tuntematon');

// Riisuu kohteesta sen mikä ei kuulu laitteelle. Tämä on tiedoston tärkein funktio:
// jos tänne unohtuu kenttä, henkilötietoa päätyy puhelimeen jäävään kopioon.
export const riisuKohde = (kohde: Kohde): Kohde => ({
  id: kohde.id,
  name: kohde.name,
  address: kohde.address,
  contactName: kohde.contactName,
  contactPhone: kohde.contactPhone,
  // Vartijan ohjeet: tämä on se kenttä jonka takia koko tallennus tehdään.
  notes: kohde.notes,
  tehtavat: kohde.tehtavat,
  zones: kohde.zones,
  // Karttakuva itse on /api/uploads-polun takana eikä sitä tallenneta (ks. sw-pohja.js:
  // API-vastauksia ei välimuistiteta). Id säilytetään, jotta kartta latautuu heti kun
  // yhteys palaa — offline-tilassa vyöhykkeet näkyvät listana ilman pohjakuvaa.
  mapUploadId: kohde.mapUploadId,
  mapUploadName: kohde.mapUploadName,
  archived: kohde.archived,
  // perehdytykset JÄTETÄÄN POIS tarkoituksella: se on nimilista työntekijöistä.
});

export function tallennaVuorodata(kayttaja: string, data: {
  kohteet: Kohde[]; pohjat: Kierrospohja[]; kierrokset: Kierros[];
}) {
  const paketti: Vuorodata = {
    tallennettu: new Date().toISOString(),
    kohteet: (data.kohteet || []).map(riisuKohde),
    pohjat: data.pohjat || [],
    // Vain kesken olevat: päättynyt kierros on historiaa eikä auta kentällä.
    kierrokset: (data.kierrokset || []).filter((k) => k.tila === 'kesken'),
  };
  try {
    window.localStorage.setItem(avain(kayttaja), JSON.stringify(paketti));
  } catch {
    // Tila lopussa tai yksityinen selaustila: offline-tuki jää saamatta, mutta sovellus
    // toimii verkon kanssa normaalisti eikä siitä kannata häiritä käyttäjää.
  }
}

// Lukee tallenteen jos se on tuore. Palauttaa null jos tallennetta ei ole tai se on
// vanhentunut — vanha tehtävälista näyttäisi ajantasaiselta ja olisi siksi pahempi
// kuin tyhjä näkymä.
export function lueVuorodata(kayttaja: string, nyt = Date.now()): Vuorodata | null {
  try {
    const raaka = window.localStorage.getItem(avain(kayttaja));
    if (!raaka) return null;
    const paketti = JSON.parse(raaka) as Vuorodata;
    const ika = nyt - new Date(paketti.tallennettu).getTime();
    if (!Number.isFinite(ika) || ika > VANHENEE_TUNTIA * 60 * 60 * 1000) return null;
    return paketti;
  } catch {
    return null;
  }
}

// Uloskirjautuminen: laitteelle ei jää mitään. Poistetaan kaikkien käyttäjien
// tallenteet eikä vain oman, koska jaetulla laitteella edellisen vuoron tiedot eivät
// saa jäädä odottamaan seuraavaa.
export function unohdaVuorodata() {
  try {
    for (const nimi of Object.keys(window.localStorage)) {
      if (nimi.startsWith(AVAIN_ETULIITE)) window.localStorage.removeItem(nimi);
    }
  } catch {
    // Ei tehtävissä mitään; ei myöskään estä uloskirjautumista.
  }
}
