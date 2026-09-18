// Kalustolajit: mitä kenttiä millekin lajille kysytään, ja miltä laji näyttää.
//
// YKSI LÄHDE. Luontilomake, suodattimet, esineen kortti ja luovutuslomakkeen taulukko
// lukevat kaikki tämän tiedoston — muuten lajin lisääminen tarkoittaisi neljää muutosta
// neljässä paikassa, ja kolmas unohtuisi.
//
// HUOM: lajien tunnisteet ja niiden KOODIT ovat myös palvelimella (server/kalusto.js:
// LAJIT ja LISATIEDOT). Eri prosessi, ei jaettua moduulia — sama sopimus kuin
// sivukartalla. Jos lisäät lajin tänne, lisää se myös sinne: muuten lomake tarjoaa
// lajia jota palvelin ei hyväksy.

import type { LucideIcon } from 'lucide-react';
import {
  KeyRound, Archive, Car, Shirt, ShieldAlert, Crosshair, Laptop,
} from 'lucide-react';

import type { KalustoTietue, Laji, SijoitusLaji } from './tyypit';

// Lisäkentän kuvaus lomaketta varten. `totuusarvo` erottaa rastin tekstikentästä;
// `pakollinen` koskee vain luontia ja on tarkistettu MYÖS palvelimella — selainpuolen
// tarkistus on käytettävyyttä, ei turvallisuutta.
export type Lisakentta = {
  avain: string;
  otsikko: string;
  // Lyhyt otsikko taulukkosyöttöä varten (KalustoEra.tsx). Eräkirjauksessa sarakkeita
  // on rinnakkain kymmenkunta, ja pitkä otsikko levittää taulukon vaakavieritettäväksi
  // — juuri se on se tilanne jossa syötetään väärään sarakkeeseen. Puuttuessaan
  // käytetään `otsikko`a.
  lyhyt?: string;
  vihje?: string;
  totuusarvo?: boolean;
  pakollinen?: boolean;
  // Kenttä on päivämäärä (ISO YYYY-MM-DD). Oma lippunsa eikä vihje siitä että kenttään
  // kirjoitetaan päivä: ISO-muoto on vertailukelpoinen, ja vasta se tekee mahdolliseksi
  // kertoa esineen kohdalla että päivä on mennyt. Vapaana tekstinä "1.5.2027" on vain
  // merkkijono jota kukaan ei tarkista.
  paivamaara?: boolean;
  // Toinen otsikko osalle alalajeista. Sama kenttä voi tarkoittaa kahta asiaa:
  // kaasusumuttimella päivä on viimeinen käyttöpäivä, käsiraudoilla ja patukalla
  // tarkastuspäivä. Kaksi erillistä kenttää jättäisi jokaiselle esineelle toisen
  // tyhjäksi, ja määräpäivien seuranta kysyisi kahta saraketta yhden sijaan.
  vaihtoehtoinenOtsikko?: { avainsanat: string[]; otsikko: string; vihje?: string };
};

export type Lajimaarittely = {
  nimi: string;
  monikko: string;
  ikoni: LucideIcon;
  // Tunnisteen keskiosa (TJ-AVA-0001). Sama kuin server/kalusto.js:n LAJIT-koodi.
  // Näytetään luontilomakkeessa jotta käyttäjä näkee mitä kilpimerkkiin tulee.
  koodi: string;
  kuvaus: string;
  // Lajin sisäiset tyypit. Vapaa teksti sallitaan silti: luettelo ei voi olla täydellinen,
  // eikä puuttuva vaihtoehto saa estää kirjaamista.
  alalajit: string[];
  // Näytetäänkö sarjanumerokenttä. Takissa sitä ei ole, aseessa se on pakollinen.
  sarjanumero?: 'ei' | 'valinnainen' | 'pakollinen';
  lisakentat: Lisakentta[];
};

export const LAJIT: Record<Laji, Lajimaarittely> = {
  avain: {
    nimi: 'Avain',
    monikko: 'Avaimet',
    ikoni: KeyRound,
    koodi: 'AVA',
    kuvaus: 'Toimeksiantajan vartioimisliikkeelle luovuttamat kohteen avaimet.',
    alalajit: ['Yleisavain', 'Pääovi', 'Tekninen tila', 'Sarja-avain', 'Kulkutunniste', 'Hälytysavain'],
    sarjanumero: 'valinnainen',
    lisakentat: [
      { avain: 'avaintyyppi', otsikko: 'Avaimen tyyppi', vihje: 'Abloy Exec, iLOQ, Mul-T-Lock…' },
      { avain: 'kohdeNimi', otsikko: 'Mihin kohteeseen käy', lyhyt: 'Mihin käy', vihje: 'Kohteen nimi sellaisena kuin se on sopimuksessa' },
      { avain: 'sarjanumerointi', otsikko: 'Sarjanumerointi', lyhyt: 'Numerointi', vihje: 'Toimeksiantajan oma numerointi, esim. 4/12' },
      { avain: 'luovutussopimus', otsikko: 'Luovutussopimus', lyhyt: 'Sopimus', vihje: 'Sopimuksen numero tai päiväys' },
    ],
  },
  avainkaappi: {
    nimi: 'Avainkaappi',
    monikko: 'Avainkaapit',
    ikoni: Archive,
    koodi: 'AKP',
    kuvaus: 'Avainten säilytyspaikka: piiriauton kaappi tai kohteen oma kaappi. Avaimia voi sijoittaa kaappiin.',
    alalajit: ['Ajoneuvokaappi', 'Kohteen kaappi', 'Toimipisteen kaappi'],
    sarjanumero: 'valinnainen',
    lisakentat: [
      { avain: 'sijaintikuvaus', otsikko: 'Sijainti', vihje: 'Piiriauto 2, takatila / Toimisto, käytävä' },
      { avain: 'lokeroita', otsikko: 'Lokeroita' },
    ],
  },
  ajoneuvo: {
    nimi: 'Ajoneuvo',
    monikko: 'Ajoneuvot',
    ikoni: Car,
    koodi: 'AJO',
    kuvaus: 'Vartioimisliikkeen ajoneuvot. Kalustoa voi sijoittaa ajoneuvoon.',
    alalajit: ['Piiriauto', 'Pakettiauto', 'Henkilöauto', 'Peräkärry'],
    sarjanumero: 'valinnainen',
    lisakentat: [
      { avain: 'rekisteri', otsikko: 'Rekisteritunnus', lyhyt: 'Rekisteri', pakollinen: true },
      { avain: 'merkki', otsikko: 'Merkki' },
      { avain: 'malli', otsikko: 'Malli' },
      { avain: 'katsastusAsti', otsikko: 'Katsastus voimassa', lyhyt: 'Katsastus', vihje: 'pp.kk.vvvv' },
    ],
  },
  asuste: {
    nimi: 'Asuste',
    monikko: 'Asusteet',
    ikoni: Shirt,
    koodi: 'ASU',
    kuvaus: 'Vartijoille luovutettavat asusteet ja tunnukset.',
    alalajit: [
      'Kengät', 'Housut', 'Paita', 'Takki', 'Päähine', 'Varustevyö', 'Tunnus', 'Suojaliivi',
    ],
    sarjanumero: 'ei',
    lisakentat: [
      { avain: 'koko', otsikko: 'Koko', vihje: '42 / L / 54' },
      {
        avain: 'henkilokohtainen',
        otsikko: 'Henkilökohtainen',
        lyhyt: 'Henk.koht.',
        totuusarvo: true,
        vihje: 'Luovutetaan vain nimetylle henkilölle ja palautetaan varastoon — ei kohteelle eikä ajoneuvoon. Tunnukset ovat aina henkilökohtaisia.',
      },
    ],
  },
  voimankayttovaline: {
    nimi: 'Voimankäyttöväline',
    monikko: 'Voimankäyttövälineet',
    ikoni: ShieldAlert,
    koodi: 'VKV',
    kuvaus: 'Kohteille jaettavat voimankäyttövälineet. Ampuma-aseet kirjataan omana lajinaan.',
    alalajit: ['Käsiraudat', 'Kaasusumutin', 'Teleskooppipatukka', 'Patukka', 'Sidekahleet'],
    sarjanumero: 'valinnainen',
    lisakentat: [
      {
        avain: 'maarapaiva',
        // Oletusotsikko on tarkastuspäivä, koska se koskee neljää alalajia viidestä.
        otsikko: 'Tarkastuspäivä',
        lyhyt: 'Määräpäivä',
        paivamaara: true,
        vihje: 'Kohteen esihenkilö tai palveluesimies tarkastaa välineen ja huoltaa sen tarvittaessa.',
        vaihtoehtoinenOtsikko: {
          avainsanat: ['kaasusumutin', 'sumutin', 'oc'],
          otsikko: 'Viimeinen käyttöpäivä',
          vihje: 'Sumutteen teho heikkenee säilytyksessä; vanhentunut väline vaihdetaan eikä huolleta.',
        },
      },
      {
        avain: 'koulutusVaadittu',
        otsikko: 'Vaatii voimankäyttökoulutuksen',
        lyhyt: 'Koulutus',
        totuusarvo: true,
        vihje: 'Merkintä ei estä luovutusta — se on muistutus siitä että koulutus on tarkistettava.',
      },
    ],
  },
  ase: {
    nimi: 'Ampuma-ase',
    monikko: 'Ampuma-aseet',
    ikoni: Crosshair,
    koodi: 'ASE',
    kuvaus:
      'Poikkeustapausten ampuma-aseet. Oma lajinsa eikä voimankäyttöväline, koska '
      + 'hallussapito on luvanvaraista ja tietue ilman lupatietoja ei ole kirjanpitoa.',
    alalajit: ['Pistooli', 'Revolveri', 'Haulikko'],
    sarjanumero: 'pakollinen',
    lisakentat: [
      { avain: 'lupanumero', otsikko: 'Luvan numero', pakollinen: true },
      { avain: 'kaliiperi', otsikko: 'Kaliiperi' },
      { avain: 'sailytyspaikka', otsikko: 'Säilytyspaikka', lyhyt: 'Säilytys', vihje: 'Asekaapin tunnus tai sijainti' },
    ],
  },
  tietotekniikka: {
    nimi: 'Tietotekniikka',
    monikko: 'Tietotekniikka',
    ikoni: Laptop,
    koodi: 'ATK',
    kuvaus: 'Tietokoneet, puhelimet, kämmentietokoneet ja vartijakutsupainikkeet.',
    alalajit: [
      'Tietokone', 'Puhelin', 'Kämmentietokone', 'Vartijakutsupainike', 'Radiopuhelin', 'Tabletti',
    ],
    sarjanumero: 'valinnainen',
    lisakentat: [
      { avain: 'imei', otsikko: 'IMEI' },
      { avain: 'puhelinnumero', otsikko: 'Puhelinnumero', lyhyt: 'Puhelin' },
    ],
  },
};

// Lajit siinä järjestyksessä kuin ne näytetään. Työjärjestys eikä aakkosjärjestys:
// avaimet ja asusteet ovat se mitä jyvitetään päivittäin, ase on poikkeus.
export const LAJIJARJESTYS: Laji[] = [
  'avain', 'asuste', 'voimankayttovaline', 'tietotekniikka', 'ajoneuvo', 'avainkaappi', 'ase',
];

export const lajinNimi = (laji: string) => LAJIT[laji as Laji]?.nimi || laji;

// Esineen koko nimi listalle: "Talvitakki L (TJ-ASU-0117)".
export const esineenOtsikko = (nimi: string, tunnus: string) => `${nimi} (${tunnus})`;

// Avainhallinnan lajit. Avaimia on kertaluokkaa enemmän kuin muuta kalustoa — holvipaikat
// alkavat tuhannesta ja niitä kirjataan kymmenittäin kerralla — joten samassa listassa ne
// hautaavat alleen sen mitä muuta yrityksellä on.
//
// AVAINKAAPPI ON TÄSSÄ JOUKOSSA vaikka se on oma esineensä kilpineen: kaappi on avainten
// paikka, eikä kysymykseen "missä avaimet ovat" voi vastata jos kaapit ovat toisaalla.
// Muun kaluston seassa kaappi olisi yksi rivi jonka merkitystä ei listalta näe.
export const AVAINLAJIT: Laji[] = ['avain', 'avainkaappi'];

export const onAvainlaji = (laji: Laji) => AVAINLAJIT.includes(laji);

// Mihin säilöön laji kuuluu oletuksena. Avaimet ja kaapit holviin, muu kalusto
// varusvarastoon — ne ovat eri tila ja eri lukko, eikä rekisteri saa jättää
// arvattavaksi kummasta ovesta tavara haetaan.
//
// Sama sääntö on palvelimella (server/kalusto.js: oletusSailo), joka on se joka
// päättää. Tämä on lomakkeen oletusvalinta eikä rajoitus: säilöstä toiseen voi siirtää.
export const oletusSailo = (laji: Laji): SijoitusLaji => (onAvainlaji(laji) ? 'holvi' : 'varusvarasto');

// Muut lajit samassa järjestyksessä kuin LAJIJARJESTYS. Oma vakio eikä suodatus
// käyttöpaikassa, jottei kahdessa näkymässä voi olla eri käsitystä siitä mikä on avain.
export const MUUT_LAJIT: Laji[] = LAJIJARJESTYS.filter((laji) => !onAvainlaji(laji));

// Avainlistan järjestysluku. Avaimet järjestetään HOLVIPAIKAN eikä tunnuksen mukaan:
// holvipaikka on se numero jolla avain haetaan hyllystä, ja kirjanpidon on oltava samassa
// järjestyksessä kuin hylly — muuten inventaario on kahden listan vertailua.
//
// Kaapit ensin, koska ne ovat paikkoja eivätkä avaimia. Holvipaikaton avain menee loppuun
// eikä nollan kohdalle alkuun: puuttuva paikka on virhe, ja se on helpompi korjata kun
// kaikki puutteet ovat listan lopussa yhdessä kasassa kuin oikean näköisten rivien seassa.
export const avainJarjestys = (esine: Pick<KalustoTietue, 'laji' | 'holviPaikka'>) => {
  if (esine.laji === 'avainkaappi') return -1;
  return typeof esine.holviPaikka === 'number' ? esine.holviPaikka : Number.MAX_SAFE_INTEGER;
};

// --- Alalajin mukaan vaihtuva otsikko -------------------------------------------------
//
// Voimankäyttövälineen määräpäivä tarkoittaa kahta eri asiaa sen mukaan mikä väline on
// kyseessä. Otsikko ratkaistaan ALALAJISTA, joka on vapaata tekstiä — luettelo tarjoaa
// tavallisimmat mutta ei rajoita, eikä täsmäys siksi voi olla suora vertailu.

// Osuuko alalaji avainsanoihin.
//
// Lyhyt koodi (OC) vaaditaan kokonaisena sanana, pidempi sana kelpaa osumana mihin
// tahansa kohtaan. Ilman tätä eroa kolmen kirjaimen koodi osuisi sanan sisään —
// ja väärä otsikko kentässä joka kertoo milloin väline vanhenee on pahempi kuin
// puuttuva otsikko.
const osuuAlalajiin = (alalaji: string, avainsanat: string[]) => {
  const teksti = String(alalaji || '').trim().toLowerCase();
  if (!teksti) return false;
  const sanat = teksti.split(/[^a-zåäö0-9]+/).filter(Boolean);
  return avainsanat.some((sana) => (sana.length <= 3 ? sanat.includes(sana) : teksti.includes(sana)));
};

/** Kentän otsikko tälle alalajille. */
export const kentanOtsikko = (kentta: Lisakentta, alalaji: string) => {
  const poikkeus = kentta.vaihtoehtoinenOtsikko;
  return poikkeus && osuuAlalajiin(alalaji, poikkeus.avainsanat) ? poikkeus.otsikko : kentta.otsikko;
};

/** Kentän vihje tälle alalajille. */
export const kentanVihje = (kentta: Lisakentta, alalaji: string) => {
  const poikkeus = kentta.vaihtoehtoinenOtsikko;
  return poikkeus && osuuAlalajiin(alalaji, poikkeus.avainsanat)
    ? (poikkeus.vihje ?? kentta.vihje)
    : kentta.vihje;
};
