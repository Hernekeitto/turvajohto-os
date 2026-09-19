// PTT-kanavapalkin puhdas kanavalogiikka (erä 26, vaihe 5, viipale 5a).
//
// Hätäkanava EI ole tämän tiedoston järjestämä chip-lista: se saa oman, aina näkyvän
// elementtinsä chip-listan ULKOPUOLELLA kun aktiivinen (Obsidian "vaihe 5 -suunnitelma",
// kohta 5) — vartija ei "valitse" hätäkanavaa lähetyskohteeksi samalla tavalla kuin
// tavallisen ryhmän, se ilmestyy hälytyksen mukana.

export type KanavaTyyppi = 'kohde' | 'piiri' | 'hata' | 'dm' | 'vapaa';

export type Kanava = {
  id: string;
  tyyppi: KanavaTyyppi;
  nimi: string;
  // Vain hätäkanavalla: HÄLKE on pakottanut linjan auki (server/kanavat.js: pakotaLinjaAuki).
  haltePidaHengissa?: { kayttaja: string; alkaen: string } | null;
  // Vain dm/vapaa: server/index.js (GET /api/kanavat/omat) täydentää tämän.
  osallistujat?: string[];
};

const KIINTEA: KanavaTyyppi[] = ['kohde', 'piiri'];

/** Hätäkanavat omaa, aina näkyvää elementtiään varten — ei chip-listaan. */
export function hatakanavat(kanavat: Kanava[]): Kanava[] {
  return kanavat.filter((k) => k.tyyppi === 'hata');
}

/**
 * Chip-listan kanavat järjestettynä: kiinteät (kohde, piiri) ensin, koska ne ovat
 * vartijan oma työkohde eikä valinnainen ryhmä. Array.sort on vakaa (ES2019+), joten
 * ryhmien SISÄINEN järjestys säilyy palvelimen antamana.
 */
export function chipKanavat(kanavat: Kanava[]): Kanava[] {
  return kanavat
    .filter((k) => k.tyyppi !== 'hata')
    .slice()
    .sort((a, b) => Number(!KIINTEA.includes(a.tyyppi)) - Number(!KIINTEA.includes(b.tyyppi)));
}

// Vain vapaa ryhmä ja DM voi mykistää (suunnitelman kohta 2): kiinteät kanavat kuunnellaan
// automaattisesti vuoron perusteella eikä niistä voi poistua, ja hätäkanava ei ole edes
// chip-listalla.
export function voiMykistaa(kanava: Kanava): boolean {
  return kanava.tyyppi === 'dm' || kanava.tyyppi === 'vapaa';
}

/** Kuunneltavat kanavat palvelimelle (server/index.js: aseta_kuunneltavat_kanavat). */
export function kuunneltavatIdt(kanavat: Kanava[], mykistetyt: ReadonlySet<string>): string[] {
  return kanavat.filter((k) => !voiMykistaa(k) || !mykistetyt.has(k.id)).map((k) => k.id);
}

/**
 * Oletuslähetyskohde: säilytä edellinen valinta jos kanava on yhä chip-listalla, muuten
 * ensimmäinen chip-kanava (kiinteä, koska chipKanavat järjestää sen ensin).
 */
export function oletusLahetyskohde(kanavat: Kanava[], edellinen: string | null): string | null {
  const chipit = chipKanavat(kanavat);
  if (edellinen && chipit.some((k) => k.id === edellinen)) return edellinen;
  return chipit[0]?.id ?? null;
}
