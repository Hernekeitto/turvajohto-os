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

// Painovoima levossa. EI enää käytössä paikallaanolon mittaamiseen — ks.
// LIIKKUMATTA_MUUTOS. Jää testien ja dokumentaation vertailuarvoksi, koska "noin 9,81"
// on yhä se suuruusluokka jota levossa oleva laite näyttää.
export const LEPO = 9.81;

// Iskun raja. 25 m/s² on noin 2,5 g: reipas ravistus ei riitä, kovalle alustalle
// putoaminen ylittää sen selvästi.
export const ISKU_RAJA = 25;

// Kuinka paljon PERÄKKÄISET näytteet saavat erota ja silti olla "paikallaan".
//
// --- MIKSI TÄMÄ MITTAA MUUTOSTA EIKÄ ETÄISYYTTÄ LEPOARVOSTA -------------------------
//
// Tässä oli 12.9.2026 asti sääntö |voimakkuus - 9,81| <= 0,6. Se oletti että levossa
// oleva laite näyttää painovoiman verran, ja se oletus on väärä.
//
// MITATTU Jelly Starilla (sh3001_acc), 50 näytettä puhelin liikkumatta pöydällä:
//
//     voimakkuus      10,285 – 10,437, keskiarvo 10,378
//     poikkeama 9,81  +0,568
//     yli 0,6 rajan   8 näytettä 50:stä eli 16 %
//     peräkkäisten ero  keskiarvo 0,026, suurin 0,110
//
// Anturissa on siis puolen yksikön kalibrointipoikkeama, joka söi 0,6:n toleranssista
// 0,57 — jäljelle jäi 0,03. Joka kuudes näyte ylitti rajan, nollasi paikallaanolon ja
// aloitti viiden minuutin laskennan alusta. Liikkumattomuutta EI OLISI HAVAITTU KOSKAAN
// tällä laitteella, eikä vika olisi näkynyt minään muuna kuin hiljaisuutena.
//
// Peräkkäisten näytteiden ero on immuuni kalibroinnille: poikkeama on sama molemmissa
// näytteissä ja kumoutuu erotuksessa. Mitattu lepokohina 0,11 ja raja 0,35 ovat kolmen
// kertoimen päässä toisistaan, ja kävelyssä ero on suuruusluokkaa yksi.
export const LIIKKUMATTA_MUUTOS = 0.35;

// Iskun jälkeen vaadittava liikkumattomuus. Kaaduttuaan ihminen nousee tai liikahtaa
// muutamassa sekunnissa; kaksitoista sekuntia täysin paikallaan iskun jälkeen ei ole
// tavallista.
export const ISKUN_JALKEEN_MS = 12_000;

// Kuinka pian iskun jälkeen liikkumattomuuden on alettava, jotta se liittyy iskuun.
export const ISKUN_IKKUNA_MS = 3_000;

// Liikkumattomuus ilman iskua. Tunti eikä viisi minuuttia: raja nostettiin 13.9.2026
// kenttämittauksen jälkeen, jossa pöydällä maannut puhelin tuotti 14 kyselyä 53
// minuutissa. Tämä sääntö ei ole ensisijainen elossaolomittari vaan varajärjestelmä —
// sen tehtävä on huomata laite joka on maannut liikkumatta niin kauan ettei kyse voi
// olla työnteosta. Säännöllinen kysyminen kuuluu vuoron kuittausvälille, joka ei
// rankaise porttikopissa istumisesta. Todellinen arvo tulee kohteen asetuksesta;
// ks. server/halytys.js mandownAsetukset (rajat 30–60).
export const LIIKKUMATON_MS = 60 * 60_000;

// Näytteenoton väli. Anturi tarjoaa dataa noin 60 kertaa sekunnissa, mikä on tähän
// tarkoitukseen sata kertaa liikaa: neljä näytettä sekunnissa riittää sekä iskuun että
// liikkumattomuuteen, ja loput vain kuluttavat akkua.
export const NAYTEVALI_MS = 250;

export type MandownTila = {
  paikallaanAlkaen: number | null;
  iskuTs: number | null;
  // Edellinen voimakkuus. Tila eikä johdettu arvo, koska paikallaanolo on nyt
  // peräkkäisten näytteiden ero eikä yksittäisen näytteen ominaisuus.
  edellinen: number | null;
};

export type MandownEpaily = 'kaatuminen' | 'liikkumaton';

export const alkutila = (): MandownTila => ({ paikallaanAlkaen: null, iskuTs: null, edellinen: null });

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
    // edellinen = null eikä v.
    //
    // Iskun jälkeinen ensimmäinen näyte eroaa iskusta väistämättä valtavasti — 35:stä
    // takaisin kymmeneen — ja muutokseen perustuva sääntö lukisi sen liikkeeksi, joka
    // nollaisi juuri kirjatun iskun. Kaatumista ei voisi havaita KOSKAAN. Tyhjentämällä
    // vertailukohdan seuraava näyte vain asettaa uuden perustason, ja paikallaanolo
    // lasketaan vasta sitä seuraavasta. Hinta on kaksi näytettä eli puoli sekuntia,
    // kun iskun ikkuna on kolme sekuntia ja vaadittu liikkumattomuus kaksitoista.
    return { tila: { paikallaanAlkaen: null, iskuTs: ts, edellinen: null }, epaily: null };
  }

  // Ensimmäinen näyte ei voi kertoa muutoksesta: vertailukohtaa ei ole. Paikallaanolo
  // alkaa vasta toisesta näytteestä, eli neljäsosasekunnin myöhemmin kuin ennen — ero on
  // mittakaavassa jonka yksikkö on minuutti.
  if (tila.edellinen === null) {
    return { tila: { paikallaanAlkaen: null, iskuTs: tila.iskuTs, edellinen: v }, epaily: null };
  }

  const paikallaan = Math.abs(v - tila.edellinen) <= LIIKKUMATTA_MUUTOS;
  if (!paikallaan) {
    // Liike nollaa myös iskun: jos ihminen kaatui ja nousi, mitään ei ole tapahtunut.
    return { tila: { paikallaanAlkaen: null, iskuTs: null, edellinen: v }, epaily: null };
  }

  const alkaen = tila.paikallaanAlkaen ?? ts;
  const kesto = ts - alkaen;
  const seuraava: MandownTila = { paikallaanAlkaen: alkaen, iskuTs: tila.iskuTs, edellinen: v };

  const iskunJalkeen =
    tila.iskuTs !== null && alkaen - tila.iskuTs <= ISKUN_IKKUNA_MS && kesto >= iskunJalkeenMs;
  // Epäilyn jälkeen tila nollataan, mutta edellinen voimakkuus SÄILYY: se on mittausta
  // eikä laskentaa, ja sen hukkaaminen maksaisi yhden näytteen verran sokeutta heti
  // epäilyn jälkeen.
  const nollattu: MandownTila = { paikallaanAlkaen: null, iskuTs: null, edellinen: v };

  if (iskunJalkeen) return { tila: nollattu, epaily: 'kaatuminen' };

  if (kesto >= liikkumatonMs) return { tila: nollattu, epaily: 'liikkumaton' };

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
