// Vyöhykepoikkeamat: hälytys siitä että joku ylitti vyöhykkeen rajan.
//
// Vyöhykkeet ovat erän 2 rakennetta (tapahtuman/kohteen `zones`-kenttä, koordinaatit
// osuuksina pohjakuvasta). Tähän ei siis tehdä omaa geometriaa vaan luetaan se mikä on jo
// piirretty — hälytyssääntö on yksi kenttä lisää vyöhykkeeseen.
//
// KAKSI SÄÄNTÖÄ RIITTÄÄ:
//   saapuminen   Vyöhykkeelle ei pitäisi mennä (vaarallinen tai suljettu alue).
//   poistuminen  Vyöhykkeeltä ei pitäisi poistua (kohteen alue kesken vuoron).
//
// KOLME SUOJAA VÄÄRIÄ HÄLYTYKSIÄ VASTAAN. Ilman näitä toiminto olisi käyttökelvoton
// ensimmäisen yön jälkeen, koska GPS heittelehtii rajan molemmin puolin ja jokainen heitto
// olisi oma hälytyksensä:
//
//   1. RAJA ON YLITETTÄVÄ. Hälytys syntyy vain kun EDELLINEN tiedetty sijainti oli rajan
//      toisella puolella. Yksittäinen mittaus vyöhykkeen sisällä ei riitä — muuten
//      sovelluksen avaaminen kielletyllä vyöhykkeellä hälyttäisi vaikkei kukaan liikkunut.
//   2. TARKKUUSVAATIMUS. Jos paikannuksen tarkkuus on huonompi kuin MAX_TARKKUUS_M, koko
//      arviointi jätetään tekemättä. Sadan metrin tarkkuudella "vyöhykkeen sisällä" on
//      arvaus, eikä hälytystä saa perustaa arvaukseen.
//   3. TOISTOSUOJA. Sama vyöhyke ja sama sääntö hälyttävät enintään kerran
//      TOISTOSUOJA_MS:n aikana. Rajalla seisova vartija tuottaisi muuten hälytyksen
//      jokaisesta mittauksesta.
//
// KUVAKOORDINAATIT EIVÄT TULE TÄSTÄ MODUULISTA. Selain laskee GPS-sijainnista kohdan
// pohjakuvalla kalibroinnin avulla (src/shared/georeferointi.ts) ja lähettää molemmat.
// Muunnos on siellä eikä täällä, koska sama muunnos tarvitaan joka tapauksessa kartan
// piirtämiseen — kaksi toteutusta erkanisi toisistaan, ja silloin vartija näkyisi kartalla
// eri paikassa kuin missä hälytys väittää hänen olleen.

export const VYOHYKESAANNOT = [
  { id: 'ei', label: 'Ei hälytystä' },
  { id: 'saapuminen', label: 'Hälytä kun joku saapuu vyöhykkeelle' },
  { id: 'poistuminen', label: 'Hälytä kun joku poistuu vyöhykkeeltä' },
];

export const SAANTO_IDT = VYOHYKESAANNOT.map((s) => s.id);

export const MAX_TARKKUUS_M = 50;
export const TOISTOSUOJA_MS = 10 * 60 * 1000;

export const saannonLabel = (id) => VYOHYKESAANNOT.find((s) => s.id === id)?.label || '';

// Osuuko piste monikulmion sisään (säteenheitto). Sama algoritmi kuin frontin
// georeferointi.ts:n vyohykePisteessa — tietoinen kymmenen rivin kaksoiskappale, koska
// palvelin on JS ja front TypeScript-käännöksen takana eikä niillä ole yhteistä moduulia.
export function pisteVyohykkeessa(vyohyke, p) {
  const pisteet = vyohyke?.pisteet || [];
  if (pisteet.length < 3 || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  let sisalla = false;
  for (let i = 0, j = pisteet.length - 1; i < pisteet.length; j = i++) {
    const a = pisteet[i];
    const b = pisteet[j];
    const leikkaa =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (leikkaa) sisalla = !sisalla;
  }
  return sisalla;
}

// Vyöhykkeet joiden sisällä piste on. Niitä voi olla useita: vyöhykkeet saavat mennä
// päällekkäin (lohko ja sen sisällä oleva anniskelualue).
export function vyohykkeetPisteessa(vyohykkeet, p) {
  return (Array.isArray(vyohykkeet) ? vyohykkeet : [])
    .filter((v) => pisteVyohykkeessa(v, p))
    .map((v) => v.id);
}

const tarkkuusRiittaa = (sijainti) => {
  const t = sijainti?.gps?.tarkkuus;
  // Puuttuva tarkkuus hyväksytään: kaikki laitteet eivät sitä kerro, eikä toiminnon pidä
  // olla kokonaan pois käytöstä sellaisella laitteella. Ilmoitettu huono tarkkuus sen
  // sijaan hylätään — se on laitteen oma tieto siitä ettei se tiedä missä on.
  return !Number.isFinite(t) || t <= MAX_TARKKUUS_M;
};

export const avain = (vyohykeId, saanto) => `${vyohykeId}:${saanto}`;

// Arvioi yhden sijaintipäivityksen. `viimeksi` on olio { "vyohykeId:saanto": aikaleima },
// jota kutsuja säilyttää vartijakohtaisesti — palautetaan päivitettynä, jotta tämä moduuli
// pysyy tilattomana ja testattavana.
export function arvioi({ vyohykkeet, edellinen, nykyinen, viimeksi = {}, nyt = Date.now() }) {
  const tyhja = { poikkeamat: [], viimeksi };
  // Ilman edellistä sijaintia ei tiedetä ylitettiinkö rajaa. Ensimmäinen päivitys
  // kirjautumisen jälkeen ei siis koskaan hälytä (ks. suoja 1).
  if (!edellinen?.img || !nykyinen?.img) return tyhja;
  if (!tarkkuusRiittaa(edellinen) || !tarkkuusRiittaa(nykyinen)) return tyhja;

  const ennen = new Set(vyohykkeetPisteessa(vyohykkeet, edellinen.img));
  const nytSisalla = new Set(vyohykkeetPisteessa(vyohykkeet, nykyinen.img));

  const poikkeamat = [];
  const uusiViimeksi = { ...viimeksi };

  for (const v of Array.isArray(vyohykkeet) ? vyohykkeet : []) {
    const saanto = v?.halytys;
    if (!saanto || saanto === 'ei' || !SAANTO_IDT.includes(saanto)) continue;
    const oliSisalla = ennen.has(v.id);
    const onSisalla = nytSisalla.has(v.id);
    const ylitys =
      (saanto === 'saapuminen' && !oliSisalla && onSisalla) ||
      (saanto === 'poistuminen' && oliSisalla && !onSisalla);
    if (!ylitys) continue;

    const k = avain(v.id, saanto);
    const edellinenHalytys = Number(uusiViimeksi[k]);
    if (Number.isFinite(edellinenHalytys) && nyt - edellinenHalytys < TOISTOSUOJA_MS) continue;

    uusiViimeksi[k] = nyt;
    poikkeamat.push({
      vyohyke: { id: v.id, nimi: String(v.nimi || ''), saanto },
      kuvaus: saanto === 'saapuminen'
        ? `Saapui vyöhykkeelle ${v.nimi || ''}`.trim()
        : `Poistui vyöhykkeeltä ${v.nimi || ''}`.trim(),
    });
  }

  return { poikkeamat, viimeksi: uusiViimeksi };
}
