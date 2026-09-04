// Riskiarvioinnin laskenta ja tasot.
//
// Irrotettu App.tsx:stä koska KOLME näkymää käyttää samoja tasoja ja värejä: laskuri,
// tehtyjen arvioiden lista ja kirjausmodaalin riskiosio. Komponentin sisällä ne olivat
// funktion paikallisia muuttujia, joten jokainen näkymä luki niitä vain siksi että
// sattui olemaan samassa funktiossa — eikä niitä voinut testata erikseen.

// Riskimatriisi 3×3: todennäköisyys (rivi) × seurausten vakavuus (sarake) -> taso 1–5.
// Sama malli kuin työturvallisuuslain riskienarvioinnissa yleisesti: ääripäät ovat
// harvinaisia, ja keskimmäinen ruutu on se johon suurin osa arvioista päätyy.
const MATRIISI = [
  [1, 2, 3],
  [2, 3, 4],
  [3, 4, 5],
];

// Riskipisteet 1–5, tai 0 jos kumpikaan akseli ei ole valittuna.
//
// NOLLA TARKOITTAA "EI ARVIOITU" eikä "ei riskiä". Ero on olennainen: arvioimaton riski
// ei ole vaaraton, ja siksi tallennus torjuu nollan sen sijaan että kirjaisi sen
// pienimpänä tasona.
export function riskipisteet(todennakoisyys: unknown, vakavuus: unknown): number {
  const t = Number(todennakoisyys);
  const v = Number(vakavuus);
  if (!t || !v || t < 1 || t > 3 || v < 1 || v > 3) return 0;
  return MATRIISI[t - 1][v - 1];
}

// Tasojen nimet ja toimenpideohjeet. `action` on se osa jota arviota lukeva ihminen
// oikeasti tarvitsee: pelkkä "merkittävä riski" ei kerro mitä sille pitäisi tehdä.
export const RISKITASOT: Record<number, { label: string; tone: string; action: string }> = {
  1: { label: 'Merkityksetön riski', tone: 'emerald', action: 'Toimenpiteitä ei tarvita. Tilannetta seurataan normaalisti.' },
  2: { label: 'Vähäinen riski', tone: 'lime', action: 'Seurataan tilannetta. Harkitaan edullisia parannuksia, jos ne ovat helposti toteutettavissa.' },
  3: { label: 'Kohtalainen riski', tone: 'amber', action: 'Toimenpiteet on suunniteltava ja toteutettava määräajassa. Riskiä pienennetään ennen tapahtuman alkua.' },
  4: { label: 'Merkittävä riski', tone: 'orange', action: 'Toimenpiteet ovat välttämättömiä. Toimintaa ei aloiteta ennen kuin riskiä on pienennetty.' },
  5: { label: 'Sietämätön riski', tone: 'rose', action: 'Toiminta keskeytetään tai sitä ei aloiteta. Riski on poistettava ennen jatkamista.' },
};

// Sama väriasteikko kuin kirjausten vakavuudessa (shared/kirjaukset.ts: VAKAVUUDET),
// jotta sovelluksessa ei ole kahta eri väriskaalaa samalle asialle.
export const RISKISAVYT: Record<string, { bg: string; border: string; text: string; solid: string }> = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', solid: 'bg-emerald-600' },
  lime: { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-700', solid: 'bg-lime-600' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', solid: 'bg-amber-500' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', solid: 'bg-orange-500' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', solid: 'bg-rose-600' },
};

// Taso ja sen sävy yhdellä haulla. Palauttaa null arvioimattomalle (pisteet 0) ja myös
// silloin kun taso on tuntematon — kutsujan on käsiteltävä molemmat, koska tason
// lukeminen ilman tarkistusta on juuri se virhe joka kaatoi laskurin tulosruudun.
export function riskitaso(pisteet: number) {
  const taso = RISKITASOT[pisteet];
  if (!taso) return null;
  const savy = RISKISAVYT[taso.tone];
  if (!savy) return null;
  return { ...taso, savy };
}
