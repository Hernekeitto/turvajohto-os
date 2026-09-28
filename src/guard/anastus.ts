// Anastusilmoituksen laskenta (27.9.2026, täydennetty 28.9.2026 vanhan paperipohjan
// mukaan: kappalemäärä, tuotteen tila ja tuotesuojahälyttimet).
//
// Tuotteen hinta kirjataan sellaisena kuin se on hyllyssä eli verollisena, ja
// korvausta vaaditaan ALV 0 -hinnasta (käyttäjän määritys). Laskenta on omassa
// moduulissaan, koska samat summat tarvitaan lomakkeella ja tulosteessa — kahdessa
// paikassa laskettu summa voisi erota sentillä.
//
// Pyöristys tehdään RIVEITTÄIN sentteihin ja summat lasketaan pyöristetyistä riveistä.
// Näin tulosteen rivien ALV 0 -hinnat laskettuna yhteen antavat täsmälleen saman summan
// kuin yhteisrivillä lukee; muuten yhteissumma voisi poiketa rivien summasta sentillä.

// Tuotteen tila paperipohjan sarakkeiden mukaan. null = ei merkitty (esim. saatiin
// takaisin ehjänä).
//   kadoksissa   tuote ei palannut
//   turmeltunut  tuote palasi mutta on myyntikelvoton
//   korvattu     anastaja on jo korvannut tuotteen paikan päällä
export type TuotteenTila = 'kadoksissa' | 'turmeltunut' | 'korvattu';

export const TUOTTEEN_TILAT: { id: TuotteenTila; nimi: string }[] = [
  { id: 'kadoksissa', nimi: 'Kadoksissa' },
  { id: 'turmeltunut', nimi: 'Turmeltunut' },
  { id: 'korvattu', nimi: 'Korvattu' },
];

export type AnastettuTuote = {
  id: string;
  nimi: string;
  // Verollinen kappalehinta euroina.
  hinta: number;
  // ALV-kanta prosentteina, esim. 25.5.
  alv: number;
  // Kappalemäärä. Puuttuu ennen 28.9.2026 tallennetuista, jolloin se on 1.
  kpl?: number;
  tila?: TuotteenTila | null;
};

export type MuuKulu = {
  id: string;
  selite: string;
  summa: number;
};

// Suomen ALV-kannat 1.1.2026 alkaen. Valintalista eikä vapaa kenttä, koska väärin
// kirjoitettu kanta muuttaisi korvausvaatimuksen summaa huomaamatta.
export const ALV_KANNAT = [25.5, 13.5, 10, 0] as const;
export const OLETUS_ALV = 25.5;

// Yleisin muu kulu. Pikavalintana, koska se kirjataan lähes jokaiseen ilmoitukseen.
export const SELVITYSKULUT = { selite: 'Selvityskulut', summa: 60 };

const sentit = (euro: number) => Math.round((Number.isFinite(euro) ? euro : 0) * 100);

export const kappaleet = (t: AnastettuTuote) =>
  (Number.isFinite(t.kpl) && (t.kpl as number) > 0 ? Math.floor(t.kpl as number) : 1);

export type Summat = {
  // Senteissä. Kokonaisluvut, jotta yhteenlasku ei kerää liukulukuvirhettä.
  // Anastetun omaisuuden arvo (kaikki rivit, sis. ALV).
  verollinenSnt: number;
  alvSnt: number;
  alv0Snt: number;
  // Paperipohjan erittelyt (sis. ALV).
  turmeltunutSnt: number;
  korvattuSnt: number;
  muutKulutSnt: number;
  tuotesuojaSnt: number;
  // Korvausvaatimus = korvaamattomien tuotteiden ALV 0 -hinta + muut kulut +
  // rikotut tuotesuojahälyttimet. Jo korvattua tuotetta ei vaadita toiseen kertaan.
  vaatimusSnt: number;
};

// Rivin verollinen summa: kappalehinta sentteinä kertaa kappaleet.
export const riviVerollinenSnt = (t: AnastettuTuote) => sentit(t.hinta) * kappaleet(t);

export function riviAlv0Snt(tuote: AnastettuTuote): number {
  const kanta = Number.isFinite(tuote.alv) && tuote.alv > 0 ? tuote.alv : 0;
  return Math.round(riviVerollinenSnt(tuote) / (1 + kanta / 100));
}

export function laskeSummat(
  tuotteet: AnastettuTuote[],
  kulut: MuuKulu[] = [],
  { tuotesuoja = 0 }: { tuotesuoja?: number } = {},
): Summat {
  let verollinenSnt = 0;
  let alv0Snt = 0;
  let turmeltunutSnt = 0;
  let korvattuSnt = 0;
  let vaadittavaAlv0Snt = 0;
  for (const t of tuotteet) {
    const rivi = riviVerollinenSnt(t);
    const rivi0 = riviAlv0Snt(t);
    verollinenSnt += rivi;
    alv0Snt += rivi0;
    if (t.tila === 'turmeltunut') turmeltunutSnt += rivi;
    if (t.tila === 'korvattu') korvattuSnt += rivi;
    else vaadittavaAlv0Snt += rivi0;
  }
  const muutKulutSnt = kulut.reduce((s, k) => s + sentit(k.summa), 0);
  const tuotesuojaSnt = sentit(tuotesuoja);
  return {
    verollinenSnt,
    alvSnt: verollinenSnt - alv0Snt,
    alv0Snt,
    turmeltunutSnt,
    korvattuSnt,
    muutKulutSnt,
    tuotesuojaSnt,
    vaatimusSnt: vaadittavaAlv0Snt + muutKulutSnt + tuotesuojaSnt,
  };
}

export const euroina = (snt: number) =>
  (snt / 100).toLocaleString('fi-FI', { style: 'currency', currency: 'EUR' });

// Kenttään kirjoitettu hinta: pilkku ja piste kelpaavat desimaalierottimeksi, koska
// suomalainen kirjoittaa pilkun ja numeronäppäimistö antaa usein pisteen.
export function lueHinta(teksti: string): number {
  const luku = Number(String(teksti).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(luku) && luku >= 0 ? luku : 0;
}

// Tallennetun raportin summat. Yksi paikka, jotta lomake, tuloste ja koosteet lukevat
// samat kentät samalla tavalla.
export const raportinSummat = (r: {
  theftItems?: AnastettuTuote[]; theftOtherCosts?: MuuKulu[]; theftTagsAmount?: number;
}) => laskeSummat(r.theftItems || [], r.theftOtherCosts || [], { tuotesuoja: r.theftTagsAmount || 0 });
