// Ruudulla näkyvän tiedon tuoreus (18.9.2026).
//
// Hälytyskeskus päivittyy itsestään kolmea reittiä: kanava työntää muutokset heti, ja
// kaksi minuuttikyselyä hakee senkin mitä kanava ei tuonut. Päivystäjä ei siis päivitä
// sivua käsin — ja juuri siksi hänen on nähtävä milloin ruutu viimeksi sai tietoa.
//
// "Yhteys auki" yksin ei kerro sitä. Se on soketin tila (`ws.onopen` / `ws.onclose`) eikä
// tiedon tila, ja siitä seuraa kaksi vikaa:
//
//   1. Hiljaisesti katkennut yhteys näyttää auki olevalta. Palvelin huomaa sen pingillä
//      30 s kuluessa, mutta selaimen `onclose` voi laueta vasta myöhemmin.
//   2. Vihreä teksti on liikkumaton. Toimiva ja jäätynyt ruutu näyttävät samalta.
//
// Ikä on ainoa luku joka liikkuu — ja pysähtyessään kertoo pysähtyneensä. Sama oppi kuin
// saman päivän kellokorjauksessa (Halytyskeskus.tsx: "Kello. Käy AINA"), eri paikassa.

/**
 * Kuinka vanhaa tieto saa olla ennen kuin merkki muuttuu varoitukseksi.
 *
 * Varakysely käy 60 s välein, joten terveellä ruudulla ikä ei ehdi tämän yli. Raja on
 * 90 s eikä 60 s, jottei yksi tavallista hitaampi vastaus vilkuta varoitusta turhaan:
 * varoitus joka välähtää itsestään ohi opettaa päivystäjän sivuuttamaan sen.
 */
export const VANHA_MS = 90_000;

/** Kuinka kauan saapunut päivitys näkyy ikonin pulssina. */
export const PULSSI_MS = 10_000;

export type Tuoreus = {
  /** Kuinka vanhaa ruudulla näkyvä tieto on. */
  ikaMs: number;
  /** Onko tieto niin vanhaa että merkin on varoitettava. */
  vanha: boolean;
  /**
   * Saapuiko päivitys juuri — ikonin pulssi.
   *
   * EPÄTOSI jos päivitystä ei ole koskaan tullut. Ehdoitta sykkivä ikoni olisi
   * valehteleva sydämenlyönti: koriste joka näyttää todisteelta juuri siinä kohdassa
   * ruutua jonka tehtävä on paljastaa pysähdys.
   */
  tuore: boolean;
  /** Ikä merkkiin lyhyesti, tai "ei tietoa" jos päivitystä ei ole koskaan tullut. */
  teksti: string;
};

/**
 * Ikä lyhyesti merkkiin mahtuvaksi.
 *
 * Sekunnit näkyvät, toisin kuin `ikaTekstina`-apurissa (sijainninLahetys.ts) joka pyöristää
 * minuutteihin ja sanoo alle minuutin iästä "juuri nyt". Tässä pyöristys söisi koko
 * tarkoituksen: nimenomaan sekuntien on liikuttava, jotta pysähtyminen näkyy.
 */
export const ikaLyhyesti = (ikaMs: number): string => {
  const sekunnit = Math.max(0, Math.floor(ikaMs / 1000));
  if (sekunnit < 60) return `${sekunnit} s`;
  const minuutit = Math.floor(sekunnit / 60);
  if (minuutit < 60) return `${minuutit} min`;
  return `${Math.floor(minuutit / 60)} h`;
};

/**
 * @param paivitetty Milloin palvelin viimeksi vastasi tälle ikkunalle, tai null jos ei
 *   kertaakaan.
 * @param avattu Ikkunan avaushetki. Ikä lasketaan tästä kun päivitystä ei ole tullut:
 *   "avattu kaksi minuuttia sitten eikä mitään ole kuulunut" on tieto eikä tyhjä kenttä,
 *   ja se kuuluu näkyä varoituksena samalla rajalla kuin vanhentunut tieto.
 */
export function tuoreus(
  paivitetty: number | null,
  avattu: number,
  nyt: number = Date.now()
): Tuoreus {
  // Nollaan rajattu: koneen kello voi hypätä taaksepäin (aikavyöhyke, NTP-korjaus), eikä
  // negatiivinen ikä saa näkyä ruudulla eikä kääntyä "ei vanha" -tulokseksi vahingossa.
  const ikaMs = Math.max(0, nyt - (paivitetty ?? avattu));
  return {
    ikaMs,
    vanha: ikaMs >= VANHA_MS,
    tuore: paivitetty !== null && ikaMs < PULSSI_MS,
    teksti: paivitetty === null ? 'ei tietoa' : ikaLyhyesti(ikaMs),
  };
}
