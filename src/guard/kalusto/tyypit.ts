// Kalustopankin tietotyypit (erä 20).
//
// Säännöt ovat palvelimella (server/kalusto.js). Tämä tiedosto ei päätä mistään — se
// kuvaa sen mitä palvelin palauttaa.

export type Laji =
  | 'avain'
  | 'avainkaappi'
  | 'ajoneuvo'
  | 'asuste'
  | 'voimankayttovaline'
  | 'ase'
  | 'tietotekniikka';

export type SijoitusLaji = 'varasto' | 'kohde' | 'henkilo' | 'ajoneuvo' | 'avainkaappi';

export type KalustonTila = 'kaytossa' | 'huollossa' | 'kadonnut' | 'poistettu';

// Sijoitus on kolme LITTEÄÄ kenttää eikä sisäkkäinen olio, ja syy on levyllä:
// server/store.js:n kenttäsalaus tuntee vain muodot `kentta` ja `taulukko[].kentta`.
// `sijoitusNimi` on vartijan nimi silloin kun esine on vartijalla, ja se on salattava —
// polku `sijoitus.nimi` olisi mennyt salauslistalle läpi salaamatta mitään.
export type Sijoitus = {
  sijoitusLaji: SijoitusLaji;
  sijoitusId: string | null;
  sijoitusNimi: string;
};

export type KalustonHistoria = Sijoitus & {
  ts: string;
  tapahtuma: string;
  user: string | null;
  teksti: string;
};

// Kalustopyyntö. Vuoroesimies pyytää, pääkäyttäjä ratkaisee. Avoimia on kerrallaan yksi,
// ja ratkaistu pyyntö jää historiariviksi eikä omaksi tietueekseen.
export type Kalustopyynto = {
  id: string;
  pyytaja: string;
  kohdeId: string;
  kohdeNimi: string;
  perustelu: string;
  luotu: string;
};

export type KalustoTietue = Sijoitus & {
  id: string;
  // Yksilöivä ja ihmisluettava, muotoa TJ-ASU-0117. Sama merkkijono on kilpimerkissä ja
  // QR-koodissa, joten sitä EI muuteta tietueen elinaikana.
  tunnus: string;
  laji: Laji;
  alalaji: string;
  nimi: string;
  kuvaus: string;
  sarjanumero: string;
  tila: KalustonTila;
  lisatiedot: Record<string, string | boolean | undefined>;
  // VALINNAISIA, koska palvelin karsii ne vartijan näkymästä (server/kalusto.js:
  // vuoronKalusto). Luovutusketju — kuka on pitänyt esinettä ja kenen päätöksellä — on
  // henkilötietoa jota kentällä olevan ei kuulu nähdä. Tyyppi kertoo sen ääneen, jottei
  // kukaan kirjoita näkymää joka olettaa ketjun olevan aina mukana.
  pyynto?: Kalustopyynto | null;
  historia?: KalustonHistoria[];
  luoja?: string | null;
  kadonnut?: string | null;
  luotu: string;
};

export const TILAN_SELITE: Record<KalustonTila, string> = {
  kaytossa: 'Käytössä',
  huollossa: 'Huollossa',
  kadonnut: 'Kadonnut',
  poistettu: 'Poistettu käytöstä',
};

export const TILAN_VARI: Record<KalustonTila, string> = {
  kaytossa: 'bg-success-soft text-success-ink border-success/30',
  huollossa: 'bg-warning-soft text-warning-ink border-warning/30',
  kadonnut: 'bg-danger-soft text-danger-ink border-danger/30',
  poistettu: 'bg-sunken text-ink-muted border-line-soft',
};

export const SIJOITUKSEN_SELITE: Record<SijoitusLaji, string> = {
  varasto: 'Varasto',
  kohde: 'Kohde',
  henkilo: 'Henkilö',
  ajoneuvo: 'Ajoneuvo',
  avainkaappi: 'Avainkaappi',
};

// Historiarivin tapahtuma ihmiskielellä. Tuntematon tapahtuma näytetään sellaisenaan
// eikä piiloteta: uusi palvelinversio voi tuottaa lajin jota tämä selain ei tunne, ja
// tyhjä rivi olisi pahempi kuin tuntematon sana.
export const TAPAHTUMAN_SELITE: Record<string, string> = {
  luotu: 'Lisätty pankkiin',
  muokattu: 'Tietoja muokattu',
  siirto: 'Siirretty',
  pyynto: 'Pyydetty',
  pyynto_peruttu: 'Pyyntö peruttu',
  pyynto_hyvaksytty: 'Pyyntö hyväksytty',
  pyynto_hylatty: 'Pyyntö hylätty',
  kadonnut: 'Merkitty kadonneeksi',
  loytyi: 'Löytyi',
  huoltoon: 'Huoltoon',
  huollosta: 'Palautui huollosta',
  poistettu: 'Poistettu käytöstä',
};
