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

import type { Laji } from './tyypit';

// Lisäkentän kuvaus lomaketta varten. `totuusarvo` erottaa rastin tekstikentästä;
// `pakollinen` koskee vain luontia ja on tarkistettu MYÖS palvelimella — selainpuolen
// tarkistus on käytettävyyttä, ei turvallisuutta.
export type Lisakentta = {
  avain: string;
  otsikko: string;
  vihje?: string;
  totuusarvo?: boolean;
  pakollinen?: boolean;
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
      { avain: 'kohdeNimi', otsikko: 'Mihin kohteeseen käy', vihje: 'Kohteen nimi sellaisena kuin se on sopimuksessa' },
      { avain: 'sarjanumerointi', otsikko: 'Sarjanumerointi', vihje: 'Toimeksiantajan oma numerointi, esim. 4/12' },
      { avain: 'luovutussopimus', otsikko: 'Luovutussopimus', vihje: 'Sopimuksen numero tai päiväys' },
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
      { avain: 'rekisteri', otsikko: 'Rekisteritunnus', pakollinen: true },
      { avain: 'merkki', otsikko: 'Merkki' },
      { avain: 'malli', otsikko: 'Malli' },
      { avain: 'katsastusAsti', otsikko: 'Katsastus voimassa', vihje: 'pp.kk.vvvv' },
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
        totuusarvo: true,
        vihje: 'Luovutetaan vain nimetylle henkilölle, ei kohteelle eikä holviin. Tunnukset ovat aina henkilökohtaisia.',
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
        avain: 'koulutusVaadittu',
        otsikko: 'Vaatii voimankäyttökoulutuksen',
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
      { avain: 'sailytyspaikka', otsikko: 'Säilytyspaikka', vihje: 'Asekaapin tunnus tai sijainti' },
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
      { avain: 'puhelinnumero', otsikko: 'Puhelinnumero' },
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
