// Anastusilmoituksen laskenta (27.9.2026).
//
// Tuotteen hinta kirjataan sellaisena kuin se on hyllyssä eli verollisena, ja
// korvausta vaaditaan ALV 0 -hinnasta (käyttäjän määritys). Laskenta on omassa
// moduulissaan, koska samat summat tarvitaan lomakkeella ja myöhemmin tulosteessa —
// kahdessa paikassa laskettu summa voisi erota sentillä.
//
// Pyöristys tehdään RIVEITTÄIN sentteihin ja summat lasketaan pyöristetyistä riveistä.
// Näin tulosteen rivien ALV 0 -hinnat laskettuna yhteen antavat täsmälleen saman summan
// kuin yhteisrivillä lukee; muuten yhteissumma voisi poiketa rivien summasta sentillä.

export type AnastettuTuote = {
  id: string;
  nimi: string;
  // Verollinen kappalehinta euroina.
  hinta: number;
  // ALV-kanta prosentteina, esim. 25.5.
  alv: number;
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

export type Summat = {
  // Senteissä. Kokonaisluvut, jotta yhteenlasku ei kerää liukulukuvirhettä.
  verollinenSnt: number;
  alvSnt: number;
  alv0Snt: number;
  muutKulutSnt: number;
  // Korvausvaatimus = tuotteiden ALV 0 -hinta + muut kulut.
  vaatimusSnt: number;
};

export function riviAlv0Snt(tuote: AnastettuTuote): number {
  const verollinen = sentit(tuote.hinta);
  const kanta = Number.isFinite(tuote.alv) && tuote.alv > 0 ? tuote.alv : 0;
  return Math.round(verollinen / (1 + kanta / 100));
}

export function laskeSummat(tuotteet: AnastettuTuote[], kulut: MuuKulu[] = []): Summat {
  let verollinenSnt = 0;
  let alv0Snt = 0;
  for (const t of tuotteet) {
    verollinenSnt += sentit(t.hinta);
    alv0Snt += riviAlv0Snt(t);
  }
  const muutKulutSnt = kulut.reduce((s, k) => s + sentit(k.summa), 0);
  return {
    verollinenSnt,
    alvSnt: verollinenSnt - alv0Snt,
    alv0Snt,
    muutKulutSnt,
    vaatimusSnt: alv0Snt + muutKulutSnt,
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
