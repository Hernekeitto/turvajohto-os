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

// 'holvi' oli aiemmin 'varasto'. Palvelin lukee vanhan nimen holviksi
// (server/kalusto.js: normalisoiSijoitusLaji), joten selain näkee vain uuden.
//
// 'varusvarasto' ON ERI PAIKKA eikä holvin uusi nimi: avaimet ovat holvissa, muu
// kalusto varusvarastossa.
export type SijoitusLaji = 'holvi' | 'varusvarasto' | 'kohde' | 'henkilo' | 'ajoneuvo' | 'avainkaappi';

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

// Historiarivi kantaa sijoituksen sellaisena kuin se OLI. sijoitusId on mukana nimen
// lisäksi (erä 20e), koska säilyttimen historianäkymä täsmää id:llä — nimi on ihmiselle
// ja kaksi avainkaappia voi hyvin olla samanniminen. Ennen sitä kirjatuilta riveiltä id
// puuttuu, ja ne jäävät täsmäyksen ulkopuolelle.
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
  // Avaimen varattu koukku holvissa (1000→) ja samalla sen tunnus vartioimisliikkeen
  // kirjanpidossa. VAIN avaimilla — muilla lajeilla kenttää ei ole lainkaan. Paikka
  // pysyy avaimen omana myös silloin kun avain on kohteella tai avainkaapissa.
  holviPaikka?: number | null;
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

// Järjestys on suodatinpainikkeiden järjestys: säilöt ensin, koska niistä tavara
// lähtee ja niihin se palaa.
export const SIJOITUKSEN_SELITE: Record<SijoitusLaji, string> = {
  holvi: 'Holvi',
  varusvarasto: 'Varusvarasto',
  kohde: 'Kohde',
  henkilo: 'Henkilö',
  ajoneuvo: 'Ajoneuvo',
  avainkaappi: 'Avainkaappi',
};

// Säilöt: yrityksen omat tilat, joihin sijoitus on täydellinen ilman kohdetta — paikka
// ei ole tietue johon viitataan (server/kalusto.js: SAILOT).
export const SAILOT: SijoitusLaji[] = ['holvi', 'varusvarasto'];

export const onSailo = (laji: SijoitusLaji) => SAILOT.includes(laji);

// "kirjattiin holviin", "kirjattiin varusvarastoon". Taivutus on taulukossa eikä
// päätteenä perässä: suomen sijapääte ei ole sama joka sanalle, ja liimattu pääte
// tuottaisi ennemmin tai myöhemmin sanan jota ei ole.
export const SAILON_ILLATIIVI: Record<string, string> = {
  holvi: 'holviin',
  varusvarasto: 'varusvarastoon',
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
  // Tunnuksen siirto 1000-sarjaan. TAPAHTUMA eikä tila: esine ei muutu miksikään,
  // vaan sen tunniste kirjoitetaan uudelleen (server/kalusto.js: migroiTunnukset).
  tunnusmuutos: 'Tunnus vaihtui',
};
