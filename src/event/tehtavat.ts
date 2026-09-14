// Tehtävien kiireellisyys ja ikä. Erotettu App.tsx:stä: puhdasta laskentaa ja
// vakioita, joita Tilannekuvan Tehtävät-lista ja kirjauslomake lukevat samoina.

import { muotoileLaskuri } from '../shared/ajat';

// Tehtävän kiireellisyys. Tehtävä syntyy TIKE:n avoimesta kirjauksesta, kun
// kirjaaja rastii "Merkitse tehtäväksi" — tieto tallentuu raportin kenttiin
// taskTitle/taskUrgency, joten erillistä kokoelmaa ei tarvita ja tehtävä säilyy
// samassa lokissa kuin kirjaus josta se syntyi.
// jarjestys ratkaisee Tilannekuvan Tehtävät-listan järjestyksen (pienin ensin).
// Kauanko tehtävä on ollut auki. Muoto "HH:MM:SS" tai "2 pv HH:MM:SS" kuten
// avausvalmiuden laskurissa. Lasketaan createdAt-kentästä, joka on tarkka
// aikaleima (time-kenttä on vain kellonaika ilman päivää).
export const tehtavanIka = (tehtava: any, nyt: Date) => {
  const luotu = tehtava?.createdAt ? new Date(tehtava.createdAt) : null;
  if (!luotu || Number.isNaN(luotu.getTime())) return '—';
  return muotoileLaskuri(nyt.getTime() - luotu.getTime());
};

export const TEHTAVA_KIIREET = {
  red: {
    jarjestys: 0,
    label: 'ASAP',
    piste: 'bg-rose-500',
    reuna: 'border-rose-200 bg-rose-50',
    teksti: 'text-rose-700',
  },
  orange: {
    jarjestys: 1,
    label: 'Mahdollisimman pian',
    piste: 'bg-amber-500',
    reuna: 'border-amber-200 bg-amber-50',
    teksti: 'text-amber-700',
  },
  blue: {
    jarjestys: 2,
    label: 'Ei määritettyä aikaa',
    piste: 'bg-blue-500',
    reuna: 'border-blue-200 bg-blue-50',
    teksti: 'text-blue-700',
  },
};
export type TehtavaKiire = keyof typeof TEHTAVA_KIIREET;
export const TEHTAVA_KIIRE_OLETUS: TehtavaKiire = 'blue';
// Tuntematon tai puuttuva arvo (vanha data) tulkitaan vähiten kiireelliseksi.
export const tehtavanKiire = (avain?: string) =>
  TEHTAVA_KIIREET[avain as TehtavaKiire] || TEHTAVA_KIIREET[TEHTAVA_KIIRE_OLETUS];
