// Mikroraportoinnin logiikka (2.10.2026). Lomake on Mikroraportti.tsx:ssä; tässä on se
// mikä on testattavissa ilman Reactia: luettelon haku, raportin tunnus ja viimeksi
// käytettyjen lista.
//
// Mikroraportti on kevyt rinnakkainen kirjaus raskaille ilmoituksille: vartija valitsee
// valmiista otsikoista missä, mitä (havainto / poikkeama / toimenpide) ja minkä, ja voi
// halutessaan kirjoittaa selvityksen ja liittää kuvia. Tarkoitus on kerätä kohteesta
// hiljaista dataa — rutiineja, joita kukaan ei kirjoittaisi tapahtumailmoitukseksi.
import { AIHEET, PAIKKARYHMAT, type Luokka } from './luettelo.ts';

export type { Luokka };

export const LUOKAT: { id: Luokka; nimi: string; kuvaus: string }[] = [
  { id: 'havainto', nimi: 'Havainto', kuvaus: 'Huomasin jotain' },
  { id: 'poikkeama', nimi: 'Poikkeama', kuvaus: 'Jokin on vialla tai vastoin ohjetta' },
  { id: 'toimenpide', nimi: 'Toimenpide', kuvaus: 'Tein jotain' },
];

export const luokanNimi = (luokka?: string | null) =>
  LUOKAT.find((l) => l.id === luokka)?.nimi || 'Mikroraportti';

export type Tapahtuma = { luokka: Luokka; aihe: string; alue: string; teksti: string };
export type Paikka = { ryhma: string; paikka: string };

export const KAIKKI_TAPAHTUMAT: Tapahtuma[] = AIHEET.flatMap(({ aihe, alueet }) =>
  alueet.flatMap(({ alue, rivit }) => rivit.map(([luokka, teksti]) => ({ luokka, aihe, alue, teksti }))));

export const KAIKKI_PAIKAT: Paikka[] = PAIKKARYHMAT.flatMap(({ ryhma, paikat }) =>
  paikat.map((paikka) => ({ ryhma, paikka })));

// Haku: jokaisen sanan on löydyttävä jostain kentästä, järjestyksellä ei ole väliä.
// "ovi auki" löytää siis myös rivin "Konesalin ovi jätetty raolleen / pönkitetty auki".
const sanat = (haku: string) => haku.toLocaleLowerCase('fi').split(/\s+/).filter(Boolean);

export const osuu = (haku: string, ...kentat: string[]) => {
  const etsittavat = sanat(haku);
  if (etsittavat.length === 0) return true;
  const teksti = kentat.join(' ').toLocaleLowerCase('fi');
  return etsittavat.every((s) => teksti.includes(s));
};

export const haeTapahtumat = (luokka: Luokka, haku: string) =>
  KAIKKI_TAPAHTUMAT.filter((t) => t.luokka === luokka && osuu(haku, t.teksti, t.alue, t.aihe));

export const haePaikat = (haku: string) =>
  KAIKKI_PAIKAT.filter((p) => osuu(haku, p.paikka, p.ryhma));

// Listan ryhmittely näkymää varten, järjestys säilyy luettelon mukaisena.
export const ryhmittele = <T,>(rivit: T[], avain: (r: T) => string) => {
  const ryhmat = new Map<string, T[]>();
  for (const r of rivit) {
    const k = avain(r);
    if (!ryhmat.has(k)) ryhmat.set(k, []);
    ryhmat.get(k)!.push(r);
  }
  return [...ryhmat.entries()].map(([nimi, jasenet]) => ({ nimi, jasenet }));
};

// Raportin tunnus eli otsikko listoissa: "Toimenpide: Ovi avattu (…) — Aula". Paikka
// viimeisenä, koska listaa silmäillään mitä-kysymyksen perusteella.
export const raportinTunnus = (luokka: Luokka, tapahtuma: string, paikka: string) =>
  `${luokanNimi(luokka)}: ${tapahtuma}${paikka ? ` — ${paikka}` : ''}`;

// --- Viimeksi käytetyt -------------------------------------------------------------
//
// Laitteen muistissa eikä palvelimella: sama vartija kirjaa samoja asioita samassa
// kohteessa vuorosta toiseen, ja kahden napautuksen kirjaus on koko ominaisuuden ydin.
// Menetetty lista ei haittaa mitään — luettelo on aina tallessa.

export const VIIMEISIMPIA = 6;
const AVAIN = 'turvajohto-guard-mikro-viimeisimmat';

export type Viimeisimmat = { tapahtumat: string[]; paikat: string[] };

// Tapahtuman avain: sama otsikko voi teoriassa olla kahdessa luokassa.
export const tapahtumanAvain = (t: Pick<Tapahtuma, 'luokka' | 'teksti'>) => `${t.luokka}|${t.teksti}`;
export const paikanAvain = (p: Paikka) => `${p.ryhma}|${p.paikka}`;

export const lisaaViimeisimpiin = (lista: string[], arvo: string, max = VIIMEISIMPIA) =>
  [arvo, ...lista.filter((a) => a !== arvo)].slice(0, max);

export const lueViimeisimmat = (): Viimeisimmat => {
  try {
    const raaka = JSON.parse(localStorage.getItem(AVAIN) || '{}');
    const lista = (x: unknown) => (Array.isArray(x) ? x.filter((a) => typeof a === 'string') : []);
    return { tapahtumat: lista(raaka?.tapahtumat), paikat: lista(raaka?.paikat) };
  } catch {
    return { tapahtumat: [], paikat: [] };
  }
};

export const tallennaViimeisimmat = (tapahtuma: Tapahtuma, paikka: Paikka | null) => {
  try {
    const nyt = lueViimeisimmat();
    localStorage.setItem(AVAIN, JSON.stringify({
      tapahtumat: lisaaViimeisimpiin(nyt.tapahtumat, tapahtumanAvain(tapahtuma)),
      paikat: paikka ? lisaaViimeisimpiin(nyt.paikat, paikanAvain(paikka)) : nyt.paikat,
    }));
  } catch {
    // Yksityinen ikkuna tai estetty tallennus: lista vain jää päivittämättä.
  }
};

// Avaimista takaisin luettelon riveiksi. Luettelosta poistunut rivi putoaa pois
// hiljaa, jottei vanha muisti tarjoa otsikkoa jota ei enää ole.
export const viimeisimmatTapahtumat = (avaimet: string[], luokka: Luokka) =>
  avaimet
    .map((a) => KAIKKI_TAPAHTUMAT.find((t) => tapahtumanAvain(t) === a))
    .filter((t): t is Tapahtuma => !!t && t.luokka === luokka);

export const viimeisimmatPaikat = (avaimet: string[]) =>
  avaimet
    .map((a) => KAIKKI_PAIKAT.find((p) => paikanAvain(p) === a))
    .filter((p): p is Paikka => !!p);
