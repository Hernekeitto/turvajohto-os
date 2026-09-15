// Hälytyskeskuksen paneelit ja niiden osoitteet (erä 24).
//
// Päivystäjällä on usein kaksi näyttöä, eikä selain voi levittää yhtä ikkunaa kahdelle
// ruudulle. Ainoa toimiva tapa on siis useampi IKKUNA, ja ikkunan sisältö on
// ratkaistava OSOITTEESTA — muuten irrotettu ikkuna avautuisi aina koostenäkymään ja
// päivystäjä klikkaisi itsensä oikeaan paneeliin joka kerta kun kone käynnistetään.
//
// --- MIKSI OSOITTEET, VAIKKA MUUALLA NIITÄ EI KÄYTETÄ -------------------------------
//
// Sovelluksen sisäinen navigointi on komponenttien tilassa eikä osoiterivillä (ks.
// shared/navigointi.ts). Tämä on tietoinen poikkeus, ja sillä on kaksi perustetta:
//
//   1. Ikkunan sisältö on jaettava ikkunan mukana. `window.open` vie osoitteen, ei
//      Reactin tilaa.
//   2. Päivystäjä kirjanmerkitsee ruutunsa. "Vasen näyttö" on kirjanmerkki, ei klikkaus-
//      polku.
//
// navigointi.ts:n vanha perustelu ("vaatisi nginxiltä polkukohtaisen ohjauksen") EI
// enää päde: nginxin `location /` tekee jo SPA-varakäsittelyn, joten /guard/halke/*
// palautuu index.html:ään ilman palvelinmuutosta. Polut pysyvät myös manifestin
// scopessa (/guard), joten asennettu sovellus ei putoa selaimeen.

export type PaneeliId = 'keikat' | 'halytykset' | 'vartijat' | 'kohteet' | 'tausta';

export type Paneeli = {
  id: PaneeliId;
  polku: string;
  label: string;
  // Lyhyt kuvaus siitä mihin kysymykseen paneeli vastaa. Näytetään irrotusvalikossa:
  // "Vartijat" ei kerro kummasta listasta on kyse ennen kuin sen avaa.
  kuvaus: string;
  // Kelpaako paneeli seinätauluksi. Kohteet ja tausta eivät: ne ovat selattavia
  // listoja joista ei näe kolmen metrin päästä mitään, ja seinätaulu jossa ei erota
  // mitään vie tilan siltä joka erottaisi.
  taulukelpoinen: boolean;
};

export const PANEELIT: Paneeli[] = [
  {
    id: 'keikat',
    polku: '/guard/halke/keikat',
    label: 'Hälytystehtävät ja poistumisluvat',
    kuvaus: 'Avoimet keikat, matkalla olevat yksiköt ja hyväksyntää odottavat raportit.',
    taulukelpoinen: true,
  },
  {
    id: 'halytykset',
    polku: '/guard/halke/halytykset',
    label: 'Lauenneet hälytykset ja ajastimet',
    kuvaus: 'Hätäpainike, man-down, umpeutuvat ajastimet ja pyydetyt tarkistukset.',
    taulukelpoinen: true,
  },
  {
    id: 'vartijat',
    polku: '/guard/halke/vartijat',
    label: 'Vartijat',
    kuvaus: 'Kuka on vuorossa, kuka on kirjannut jotain ja missä kukin viimeksi tiedettiin.',
    taulukelpoinen: true,
  },
  {
    id: 'kohteet',
    polku: '/guard/halke/kohteet',
    label: 'Kohteet',
    kuvaus: 'Kohdekohtainen tilannekuva ja haku.',
    taulukelpoinen: false,
  },
  {
    id: 'tausta',
    polku: '/guard/halke/tausta',
    label: 'Kierrokset, kalusto ja tiedotteet',
    kuvaus: 'Kesken olevat kierrokset, avoimet poikkeamat ja voimassa olevat tiedotteet.',
    taulukelpoinen: false,
  },
];

// Ne paneelit jotka käyttäjä valitsi aina näkyviksi (päätös 15.9.2026). Koostenäkymä
// näyttää kaiken; tämä järjestys ratkaisee mitkä ovat ylimpänä.
export const KARKIPANEELIT: PaneeliId[] = ['keikat', 'halytykset', 'vartijat'];

const JUURI = '/guard/halke';

/**
 * Mikä paneeli osoitteesta luetaan, ja onko ikkuna seinätaulutilassa.
 *
 * Tuntematon paneeli on `null` eikä virhe: silloin näytetään koostenäkymä. Väärin
 * kirjoitettu osoite ei saa tuottaa tyhjää ruutua valvomoon.
 */
export function lueOsoite(pathname: string, search: string): {
  paneeli: PaneeliId | null;
  taulu: boolean;
} {
  const polku = pathname.replace(/[/]+$/, '').toLowerCase();
  const taulu = new URLSearchParams(search).get('taulu') === '1';
  if (!polku.startsWith(JUURI)) return { paneeli: null, taulu: false };

  const hanta = polku.slice(JUURI.length).replace(/^\//, '');
  const osuma = PANEELIT.find((p) => p.id === hanta);
  // Seinätaulutila vain paneeleille jotka siihen kelpaavat. Koostenäkymää ei voi laittaa
  // seinälle: se on kolme ruutua pitkä eikä siitä erota mitään kaukaa.
  return {
    paneeli: osuma ? osuma.id : null,
    taulu: taulu && !!osuma?.taulukelpoinen,
  };
}

/** Osoite jolla paneeli avataan omaan ikkunaansa. */
export const paneelinOsoite = (id: PaneeliId, taulu: boolean) => {
  const paneeli = PANEELIT.find((p) => p.id === id);
  if (!paneeli) return JUURI;
  return paneeli.polku + (taulu && paneeli.taulukelpoinen ? '?taulu=1' : '');
};

/**
 * Avaa paneelin omaan ikkunaansa.
 *
 * `noopener` on POIS TARKOITUKSELLA, toisin kuin ulkoisissa linkeissä: ilman sitä
 * `window.open` palauttaa nullin eikä kutsuja voi tietää estikö selain ikkunan.
 * Kohde on oma sovellus samassa alkuperässä, joten opener-viittaus ei ole riski.
 *
 * Palauttaa false jos selain esti ikkunan — silloin käyttöliittymän on kerrottava se,
 * koska muuten painallus näyttää tekevän tyhjää.
 */
export function avaaIkkunassa(id: PaneeliId, taulu: boolean): boolean {
  try {
    const ikkuna = window.open(paneelinOsoite(id, taulu), `halke-${id}`, 'width=1100,height=900');
    if (!ikkuna) return false;
    ikkuna.focus();
    return true;
  } catch {
    return false;
  }
}
