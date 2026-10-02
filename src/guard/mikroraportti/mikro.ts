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

// Luettelo litteänä. Pääkäyttäjän taulukosta tulkittu luettelo (server/mikroluettelo.js)
// on samaa muotoa; sisäänrakennettu on käytössä kunnes taulukko on luotu, ja varalla
// jos palvelimelta ei saada mitään.
export type Luettelo = { paikat: Paikka[]; tapahtumat: Tapahtuma[] };
export const SISAANRAKENNETTU: Luettelo = { paikat: KAIKKI_PAIKAT, tapahtumat: KAIKKI_TAPAHTUMAT };

// Haku: jokaisen sanan on löydyttävä jostain kentästä, järjestyksellä ei ole väliä.
// "ovi auki" löytää siis myös rivin "Konesalin ovi jätetty raolleen / pönkitetty auki".
const sanat = (haku: string) => haku.toLocaleLowerCase('fi').split(/\s+/).filter(Boolean);

export const osuu = (haku: string, ...kentat: string[]) => {
  const etsittavat = sanat(haku);
  if (etsittavat.length === 0) return true;
  const teksti = kentat.join(' ').toLocaleLowerCase('fi');
  return etsittavat.every((s) => teksti.includes(s));
};

export const haeTapahtumat = (luokka: Luokka, haku: string, luettelo: Luettelo = SISAANRAKENNETTU) =>
  luettelo.tapahtumat.filter((t) => t.luokka === luokka && osuu(haku, t.teksti, t.alue, t.aihe));

export const haePaikat = (haku: string, luettelo: Luettelo = SISAANRAKENNETTU) =>
  luettelo.paikat.filter((p) => osuu(haku, p.paikka, p.ryhma));

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

// --- Omat kirjaukset -----------------------------------------------------------------
//
// Luettelo ei ole tyhjentävä, joten paikan ja otsikon voi aina kirjoittaa itse. Oma
// kirjaus saa ryhmäkseen OMA:n, jolloin ne erottuvat luettelon riveistä tilastoissa ja
// niistä näkee mitä luetteloon kannattaisi lisätä.
export const OMA = 'Muu (oma)';
export const OMAN_PITUUS = 120;

const siisti = (teksti: string) => teksti.replace(/\s+/g, ' ').trim().slice(0, OMAN_PITUUS);

export const omaksiPaikaksi = (teksti: string): Paikka | null =>
  siisti(teksti) ? { ryhma: OMA, paikka: siisti(teksti) } : null;

export const omaksiTapahtumaksi = (luokka: Luokka, teksti: string): Tapahtuma | null =>
  siisti(teksti) ? { luokka, aihe: OMA, alue: OMA, teksti: siisti(teksti) } : null;

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

// Tapahtuman avain: sama otsikko voi teoriassa olla kahdessa luokassa. Oma otsikko saa
// välitunnisteen, jotta sitä ei sekoiteta luettelon samannimiseen riviin.
export const tapahtumanAvain = (t: Pick<Tapahtuma, 'luokka' | 'teksti' | 'aihe'>) =>
  t.aihe === OMA ? `${t.luokka}|oma|${t.teksti}` : `${t.luokka}|${t.teksti}`;
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

// Avaimista takaisin riveiksi. Luettelosta poistunut rivi putoaa pois hiljaa, jottei
// vanha muisti tarjoa otsikkoa jota ei enää ole. Omat kirjaukset palautetaan avaimesta
// sellaisenaan: ne ovat juuri niitä joita luettelossa ei ole, ja toistuvat silti.
const omaTapahtuma = (avain: string): Tapahtuma | null => {
  const [luokka, merkki, ...loput] = avain.split('|');
  if (merkki !== 'oma' || !LUOKAT.some((l) => l.id === luokka) || loput.length === 0) return null;
  return omaksiTapahtumaksi(luokka as Luokka, loput.join('|'));
};

export const viimeisimmatTapahtumat = (avaimet: string[], luokka: Luokka, luettelo: Luettelo = SISAANRAKENNETTU) =>
  avaimet
    .map((a) => omaTapahtuma(a) || luettelo.tapahtumat.find((t) => tapahtumanAvain(t) === a))
    .filter((t): t is Tapahtuma => !!t && t.luokka === luokka);

export const viimeisimmatPaikat = (avaimet: string[], luettelo: Luettelo = SISAANRAKENNETTU) =>
  avaimet
    .map((a) => (a.startsWith(`${OMA}|`)
      ? omaksiPaikaksi(a.slice(OMA.length + 1))
      : luettelo.paikat.find((p) => paikanAvain(p) === a)))
    .filter((p): p is Paikka => !!p);

// Palvelimelta tai laitteen välimuistista tullut luettelo: hyväksytään vain oikean
// muotoinen. Rikkinäinen välimuisti ei saa tyhjentää vartijan valikkoa.
export const luetteloksi = (x: unknown): Luettelo | null => {
  const l = x as Partial<Luettelo> | null;
  if (!l || !Array.isArray(l.paikat) || !Array.isArray(l.tapahtumat)) return null;
  const teksti = (v: unknown) => typeof v === 'string' && v.trim() !== '';
  const paikat = l.paikat.filter((p) => teksti(p?.ryhma) && teksti(p?.paikka));
  const tapahtumat = l.tapahtumat.filter((t) => teksti(t?.teksti) && teksti(t?.aihe) && teksti(t?.alue)
    && LUOKAT.some((k) => k.id === t?.luokka));
  if (paikat.length === 0 || tapahtumat.length === 0) return null;
  return {
    paikat: paikat.map(({ ryhma, paikka }) => ({ ryhma, paikka })),
    tapahtumat: tapahtumat.map(({ luokka, aihe, alue, teksti: t }) => ({ luokka, aihe, alue, teksti: t })),
  };
};
