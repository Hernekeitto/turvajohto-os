// Haarautuvan skenaariopohjan muokkauksen apufunktiot.
//
// Pohjan kohdat ovat litteä lista, jossa `haara` kertoo minkä vaihtoehdon alle kohta
// kuuluu (ks. server/suoritus.js). Editori näyttää listan puuna, ja nämä funktiot pitävät
// litteän listan kunnossa: tallennettaessa jokainen valinta on ennen omia jatkokohtiaan
// (palvelin vaatii sen), ja poistettaessa haaran alle jääneet kohdat poistuvat mukana
// eivätkä jää orvoiksi.
import type { Kohta } from './pohjat.ts';

export type Luonnoskohta = Partial<Kohta>;

const haaraAvain = (k: Luonnoskohta) => k.haara || '';

export const lapset = (kohdat: Luonnoskohta[], haara: string) =>
  kohdat.filter((k) => haaraAvain(k) === haara);

// Syvyyshaku: pääpolun kohta, sen jälkeen (jos se on valinta) jokaisen vaihtoehdon kohdat,
// sitten seuraava pääpolun kohta. Järjestys säilyttää sisarusten keskinäisen järjestyksen.
// Kohdat joiden haaraa ei enää ole jäävät pois.
export function puujarjestys(kohdat: Luonnoskohta[]): Luonnoskohta[] {
  const tulos: Luonnoskohta[] = [];
  const kay = (haara: string, syvyys: number) => {
    if (syvyys > 50) return;
    for (const k of lapset(kohdat, haara)) {
      tulos.push(k);
      if (k.tyyppi === 'valinta') {
        for (const v of k.vaihtoehdot || []) kay(v.id, syvyys + 1);
      }
    }
  };
  kay('', 0);
  return tulos;
}

// Kaikki vaihtoehto-id:t kohdan alta (kohdan omat ja sen jälkeläisten).
function jalkelaisHaarat(kohdat: Luonnoskohta[], alku: string[]): Set<string> {
  const haarat = new Set<string>(alku);
  let lisattiin = true;
  while (lisattiin) {
    lisattiin = false;
    for (const k of kohdat) {
      if (!k.haara || !haarat.has(k.haara) || k.tyyppi !== 'valinta') continue;
      for (const v of k.vaihtoehdot || []) {
        if (!haarat.has(v.id)) { haarat.add(v.id); lisattiin = true; }
      }
    }
  }
  return haarat;
}

// Poistaa kohdan ja kaiken sen alla olevan.
export function poistaKohta(kohdat: Luonnoskohta[], id: string): Luonnoskohta[] {
  const kohta = kohdat.find((k) => k.id === id);
  if (!kohta) return kohdat;
  const haarat = jalkelaisHaarat(kohdat, (kohta.vaihtoehdot || []).map((v) => v.id));
  return kohdat.filter((k) => k.id !== id && !(k.haara && haarat.has(k.haara)));
}

// Poistaa valinnan yhden vaihtoehdon ja sen polun kohdat.
export function poistaVaihtoehto(kohdat: Luonnoskohta[], kohtaId: string, vaihtoehtoId: string): Luonnoskohta[] {
  const haarat = jalkelaisHaarat(kohdat, [vaihtoehtoId]);
  return kohdat
    .filter((k) => !(k.haara && haarat.has(k.haara)))
    .map((k) => (k.id === kohtaId
      ? { ...k, vaihtoehdot: (k.vaihtoehdot || []).filter((v) => v.id !== vaihtoehtoId) }
      : k));
}

// Siirtää kohtaa sisarustensa joukossa (sama haara). Litteässä listassa vaihdetaan kahden
// sisaruksen paikat; muiden kohtien järjestys ei muutu.
export function siirra(kohdat: Luonnoskohta[], id: string, suunta: -1 | 1): Luonnoskohta[] {
  const kohta = kohdat.find((k) => k.id === id);
  if (!kohta) return kohdat;
  const sisarukset = lapset(kohdat, haaraAvain(kohta));
  const i = sisarukset.indexOf(kohta);
  const toinen = sisarukset[i + suunta];
  if (!toinen) return kohdat;
  const a = kohdat.indexOf(kohta);
  const b = kohdat.indexOf(toinen);
  const tulos = [...kohdat];
  [tulos[a], tulos[b]] = [tulos[b], tulos[a]];
  return tulos;
}

export const uusiId = () => crypto.randomUUID();

// Kohdan syvyys puussa (montako valintaa sen yläpuolella on). Pohjan esikatselu sisentää
// tämän mukaan.
export function syvyys(kohdat: Luonnoskohta[], kohta: Luonnoskohta): number {
  let n = 0;
  let nykyinen: Luonnoskohta | undefined = kohta;
  while (nykyinen?.haara && n < 50) {
    const haara: string = nykyinen.haara;
    nykyinen = kohdat.find((k) => (k.vaihtoehdot || []).some((v) => v.id === haara));
    n += 1;
  }
  return n;
}
