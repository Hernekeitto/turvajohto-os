// Man-down: laitteen liiketunnistuksesta hälytykseen.
//
// Puhelimen kiihtyvyysanturi on ainoa liikeanturi joka selaimessa on käytettävissä, ja
// sillä voi tunnistaa kaksi asiaa luotettavasti: äkillisen iskun ja liikkumattomuuden.
// Kaikki muu (asento, "makaako ihminen") vaatisi anturidatan tulkintaa jota ei voi
// todistaa oikeaksi ilman oikeaa kaatumisdataa — eikä arvausta pidä esittää hälytyksenä.
//
// KAKSI SÄÄNTÖÄ:
//
//   kaatuminen    Isku ja heti sen jälkeen liikkumattomuus. Tämä on se tapaus jota
//                 varten man-down on olemassa: puhelin (ja sen kantaja) iskeytyi maahan
//                 eikä liiku sen jälkeen.
//   liikkumaton   Pitkä liikkumattomuus ilman iskua. Löysempi sääntö, ja siksi sen
//                 kynnys on minuuteissa eikä sekunneissa.
//
// EPÄILY EI OLE HÄLYTYS. Tunnistus ei laukaise hälytystä suoraan vaan pyytää käyttäjää
// kuittaamaan ("oletko kunnossa?"). Vasta kuittaamatta jäänyt kysely tekee hälytyksen.
// Puhelin pöydällä raportin kirjoittamisen ajan on tavallisin tilanne maailmassa, eikä
// se saa soittaa kenellekään.
//
// TÄMÄ MODUULI ON PUHDAS. Ei React-koodia eikä anturikuuntelijoita: näyte sisään, tila
// ulos. Anturin kuuntelu ja lupakysely ovat käyttöliittymässä, jotta säännöt voi testata
// ilman selainta — kaatumista ei voi testata muuten kuin syöttämällä lukuja.

// Painovoima levossa. Puhelin pöydällä näyttää noin tätä riippumatta asennosta, koska
// kiihtyvyys mitataan painovoima mukaan lukien.
export const LEPO = 9.81;

// Iskun raja. 25 m/s² on noin 2,5 g: reipas ravistus ei riitä, kovalle alustalle
// putoaminen ylittää sen selvästi.
export const ISKU_RAJA = 25;

// Kuinka paljon lepoarvosta saa poiketa ja silti olla "paikallaan". Taskussa oleva
// puhelin hengityksen tahdissa liikkuu tämän sisällä; kävelevä ei.
export const LIIKKUMATTA_POIKKEAMA = 0.6;

// Iskun jälkeen vaadittava liikkumattomuus. Kaaduttuaan ihminen nousee tai liikahtaa
// muutamassa sekunnissa; kaksitoista sekuntia täysin paikallaan iskun jälkeen ei ole
// tavallista.
export const ISKUN_JALKEEN_MS = 12_000;

// Kuinka pian iskun jälkeen liikkumattomuuden on alettava, jotta se liittyy iskuun.
export const ISKUN_IKKUNA_MS = 3_000;

// Liikkumattomuus ilman iskua. Viisi minuuttia on valittu niin, että se on selvästi
// pidempi kuin lomakkeen täyttäminen puhelin pöydällä.
export const LIIKKUMATON_MS = 5 * 60_000;

// Näytteenoton väli. Anturi tarjoaa dataa noin 60 kertaa sekunnissa, mikä on tähän
// tarkoitukseen sata kertaa liikaa: neljä näytettä sekunnissa riittää sekä iskuun että
// liikkumattomuuteen, ja loput vain kuluttavat akkua.
export const NAYTEVALI_MS = 250;

export type MandownTila = {
  paikallaanAlkaen: number | null;
  iskuTs: number | null;
};

export type MandownEpaily = 'kaatuminen' | 'liikkumaton';

export const alkutila = (): MandownTila => ({ paikallaanAlkaen: null, iskuTs: null });

// Kiihtyvyyden suuruus näytteestä. Yksi luku kolmen akselin sijaan: puhelin voi olla
// taskussa missä asennossa tahansa, joten yksittäisen akselin arvo ei kerro mitään.
export function voimakkuus(kiihtyvyys: { x?: number | null; y?: number | null; z?: number | null } | null | undefined) {
  if (!kiihtyvyys) return null;
  const { x, y, z } = kiihtyvyys;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return Math.sqrt((x as number) ** 2 + (y as number) ** 2 + (z as number) ** 2);
}

export type Asetukset = {
  liikkumatonMs?: number;
  iskunJalkeenMs?: number;
};

// Yksi näyte sisään, uusi tila ja mahdollinen epäily ulos.
//
// Tila NOLLATAAN epäilyn jälkeen. Ilman sitä sama liikkumattomuus tuottaisi epäilyn
// jokaisesta seuraavasta näytteestä, eli neljä kertaa sekunnissa.
export function syota(
  tila: MandownTila,
  naite: { ts: number; voimakkuus: number },
  asetukset: Asetukset = {}
): { tila: MandownTila; epaily: MandownEpaily | null } {
  const liikkumatonMs = asetukset.liikkumatonMs ?? LIIKKUMATON_MS;
  const iskunJalkeenMs = asetukset.iskunJalkeenMs ?? ISKUN_JALKEEN_MS;
  const { ts, voimakkuus: v } = naite;

  if (!Number.isFinite(v)) return { tila, epaily: null };

  // Isku nollaa liikkumattomuuden: putoamisen aikana laite ei ole paikallaan, ja
  // laskenta alkaa vasta siitä hetkestä kun se pysähtyy.
  if (v >= ISKU_RAJA) {
    return { tila: { paikallaanAlkaen: null, iskuTs: ts }, epaily: null };
  }

  const paikallaan = Math.abs(v - LEPO) <= LIIKKUMATTA_POIKKEAMA;
  if (!paikallaan) {
    // Liike nollaa myös iskun: jos ihminen kaatui ja nousi, mitään ei ole tapahtunut.
    return { tila: { paikallaanAlkaen: null, iskuTs: null }, epaily: null };
  }

  const alkaen = tila.paikallaanAlkaen ?? ts;
  const kesto = ts - alkaen;
  const seuraava: MandownTila = { paikallaanAlkaen: alkaen, iskuTs: tila.iskuTs };

  const iskunJalkeen =
    tila.iskuTs !== null && alkaen - tila.iskuTs <= ISKUN_IKKUNA_MS && kesto >= iskunJalkeenMs;
  if (iskunJalkeen) return { tila: alkutila(), epaily: 'kaatuminen' };

  if (kesto >= liikkumatonMs) return { tila: alkutila(), epaily: 'liikkumaton' };

  return { tila: seuraava, epaily: null };
}

export const EPAILYN_SELITE: Record<MandownEpaily, string> = {
  kaatuminen: 'Laite havaitsi iskun eikä liikettä sen jälkeen.',
  liikkumaton: 'Laite ei ole liikkunut pitkään aikaan.',
};

// Kuinka kauan käyttäjällä on aikaa vastata "oletko kunnossa" -kyselyyn ennen kuin
// hälytys lähtee. Puoli minuuttia: tarpeeksi että puhelimen saa taskusta, mutta ei niin
// pitkä että se tuntuisi turhalta odottelulta oikeassa tilanteessa.
export const VASTAUSAIKA_MS = 30_000;
