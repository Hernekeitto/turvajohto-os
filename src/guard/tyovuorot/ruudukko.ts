// Suunnitteluruudukon laskenta (erä 4): rivit, päivät ja solujen tila.
//
// Erillään komponentista, jotta ryhmittely ja tasojen valinta voidaan testata ilman
// selainta. Rivi on yksi vartijapaikka (kohde + vuorotyyppi + paikka), sarake yksi päivä.

import type { HenkilonTarkistus, Henkilo, Lista, Sijoitus, SuunniteltuVuoro, Taso } from './tyoaika';
// Vakavimmasta lievimpään. Sama kuin server/tyoaikatarkistus.js: TASOJARJESTYS.
const TASOJARJESTYS: Taso[] = ['este', 'poikkeama', 'varoitus', 'huomio'];

export type Rivi = {
  avain: string;
  siteId: string;
  siteNimi: string;
  vuorotyyppiId: string;
  vuoroNimi: string;
  aika: string;
  paikka: number;
  solut: Record<string, SuunniteltuVuoro>;
};

export function listanPaivat(lista: Lista): string[] {
  const paivat: string[] = [];
  const loppu = Date.parse(`${lista.loppu}T00:00:00Z`);
  for (let t = Date.parse(`${lista.alku}T00:00:00Z`); t < loppu; t += 86400000) {
    paivat.push(new Date(t).toISOString().slice(0, 10));
  }
  return paivat;
}

/**
 * Vuorot riveiksi. Järjestys: kohde, vuoron alkamisaika, paikka — sama järjestys jossa
 * vuorot luetaan kohteen päivästä aamusta iltaan.
 */
export function rivit(vuorot: SuunniteltuVuoro[]): Rivi[] {
  const kartta = new Map<string, Rivi>();
  for (const v of vuorot) {
    const avain = `${v.siteId}:${v.vuorotyyppiId}:${v.paikka}`;
    let r = kartta.get(avain);
    if (!r) {
      r = {
        avain, siteId: v.siteId, siteNimi: v.siteNimi, vuorotyyppiId: v.vuorotyyppiId, vuoroNimi: v.vuoroNimi,
        aika: `${v.alkaa.slice(11)}–${v.paattyy.slice(11)}`, paikka: v.paikka, solut: {},
      };
      kartta.set(avain, r);
    }
    r.solut[v.pvm] = v;
  }
  return [...kartta.values()].sort((a, b) => a.siteNimi.localeCompare(b.siteNimi, 'fi')
    || a.siteId.localeCompare(b.siteId)
    || a.aika.localeCompare(b.aika)
    || a.vuorotyyppiId.localeCompare(b.vuorotyyppiId)
    || a.paikka - b.paikka);
}

/** Vakavin havaintotaso joka koskee tätä vuoroa sille sijoitetulla henkilöllä. */
export function solunTaso(
  vuoroId: string, sijoitus: Sijoitus | undefined, tulokset: Record<string, HenkilonTarkistus>,
): Taso | null {
  if (!sijoitus) return null;
  const tasot = (tulokset[sijoitus.username]?.havainnot || [])
    .filter((h) => h.vuoroIdt.includes(vuoroId))
    .map((h) => h.taso);
  return TASOJARJESTYS.find((t) => tasot.includes(t)) || null;
}

// "Ville Virtanen" -> "Ville V." Solu on kapea; koko nimi näkyy valitsimessa ja vihjeessä.
export function lyhytNimi(h: Henkilo | undefined, username: string): string {
  const nimi = h?.nimi || username;
  const osat = nimi.trim().split(/\s+/);
  return osat.length > 1 ? `${osat[0]} ${osat[osat.length - 1][0]}.` : osat[0];
}

const VKP = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];

export function paivanOtsikko(pvm: string): { viikonpaiva: string; paiva: string; viikonloppu: boolean } {
  const d = new Date(`${pvm}T00:00:00Z`);
  const vp = d.getUTCDay();
  return { viikonpaiva: VKP[vp], paiva: `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`, viikonloppu: vp === 0 || vp === 6 };
}

/**
 * Valitsimen järjestys: perehdytetyt ensin, sitten muut; kummankin sisällä nimen mukaan.
 * Reservi ja perehdyttämättömät jäävät näkyviin harmaina, jotta suunnittelija näkee miksi
 * henkilöä ei voi valita — sama periaate kuin vartijan vuorovalinnassa.
 */
export function valitsimenHenkilot(henkilot: Henkilo[], perehdytetyt: string[]): { henkilo: Henkilo; perehdytetty: boolean; reservi: boolean }[] {
  return henkilot
    .map((h) => ({ henkilo: h, perehdytetty: perehdytetyt.includes(h.username), reservi: h.workTimeType === 'oncall' }))
    .sort((a, b) => Number(b.perehdytetty && !b.reservi) - Number(a.perehdytetty && !a.reservi)
      || a.henkilo.nimi.localeCompare(b.henkilo.nimi, 'fi'));
}
