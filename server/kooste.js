// Vuoron kooste ja suoritusajan poikkeama (erä 18b).
//
// Säännöt ovat täällä ja kutsut index.js:ssä. Tämä tiedosto ei lue eikä kirjoita levyä
// eikä tunne Expressiä.
//
// --- Suoritusaika on työkalu eikä sääntö (päätös 10.9.2026) -------------------------
//
// Suoritusaika EI estä eikä salli mitään. Tehtävän voi tehdä milloin tahansa, ennen
// aikaa tai jälkeen. Se tekee kaksi asiaa: kertoo vartijalle milloin tehtävä on
// suunniteltu tehtäväksi, ja järjestää työlistan.
//
// Ero vuorotyypin kellonaikoihin on olennainen ja se on syytä pitää mielessä lukiessa:
// NE rajoittavat kirjautumista (vuorot.js: vuoroIkkunassa), tämä ei rajoita mitään.
// Poikkeamasta jää keltainen merkintä koosteeseen — tieto jälkikäteen, ei este
// etukäteen.
//
// --- Miksi pakotetulle tehtävälle ei lasketa poikkeamaa ---------------------------
//
// Hälytyskeskus voi pakottaa vartijalle tehtävän toisesta vuorosta (erä 19). Yövuoron
// tehtävän suoritusaika ei voi olla oikein aamuvuorossa, joten sitä ei käytetä:
// hälytyskeskus kertoo aikataulun muuta kautta. Poikkeama joka on rakenteeltaan väärä
// olisi pahempi kuin ei poikkeamaa — se opettaisi ohittamaan keltaiset merkinnät.

import { minuutit } from './vuorot.js';

// Liukuma molempiin suuntiin (päätös 10.9.2026). Klo 19 tarkoittaa 18:55–19:05.
export const LIUKUMA_MIN = 5;

const VRK_MIN = 24 * 60;

/**
 * Kuinka monta minuuttia suoritus poikkesi suunnitellusta, etumerkki mukaan lukien.
 * Negatiivinen = etuajassa. `null` = ei laskettavissa (aikaa ei ole tai suoritusta ei ole).
 *
 * Vertailu tehdään vuorokausiympyrällä samasta syystä kuin vuoroikkunassa: yövuoron
 * tehtävä klo 23:50 ja suoritus klo 00:05 ovat viisitoista minuuttia toisistaan, eivät
 * kaksikymmentäkolme tuntia.
 */
export function poikkeamaMinuutteina(suoritusaika, tehtyIso) {
  const suunniteltu = minuutit(suoritusaika);
  if (suunniteltu === null) return null;
  // Tyhjä arvo tarkistetaan ENNEN Date-muunnosta: new Date(null) on kelvollinen
  // päivämäärä (epookki), joten puuttuva aikaleima tuottaisi tekaistun poikkeaman sen
  // sijaan että kertoisi ettei suoritusta ole.
  if (typeof tehtyIso !== 'string' || !tehtyIso) return null;
  const tehty = new Date(tehtyIso);
  if (Number.isNaN(tehty.getTime())) return null;

  const hetki = tehty.getHours() * 60 + tehty.getMinutes();
  let ero = hetki - suunniteltu;
  // Lähin suunta ympyrällä: yli puolen vuorokauden ero on todellisuudessa toiseen
  // suuntaan lyhyempi.
  if (ero > VRK_MIN / 2) ero -= VRK_MIN;
  if (ero < -VRK_MIN / 2) ero += VRK_MIN;
  return ero;
}

/**
 * Onko suoritus liukuman ulkopuolella. Pakotettu tehtävä ei koskaan poikkea: sen
 * suoritusaika on toisen vuoron aika eikä sitä käytetä.
 */
export function onPoikkeama({ suoritusaika, tehtyIso, lahde = 'vuoro', liukuma = LIUKUMA_MIN }) {
  if (lahde === 'pakotus') return false;
  const ero = poikkeamaMinuutteina(suoritusaika, tehtyIso);
  if (ero === null) return false;
  return Math.abs(ero) > liukuma;
}

/**
 * Vuoron kooste: mitä kuului vuoroon, mitä tehtiin ja mikä poikkesi.
 *
 * Lasketaan PYYDETTÄESSÄ eikä tallenneta vuoron tietueeseen. Syy: kooste on
 * johtopäätös lähdeaineistosta (kierrokset, tehtäväsuoritukset), ja tallennettu
 * johtopäätös vanhenee hiljaa kun lähdeaineisto korjataan. Vuoron omat kentät —
 * alkoi, päättyi, mitä siihen kuului — ovat tietueessa, ja ne ovat tosiasioita.
 *
 * Kierroksen vertailuhetki on ALOITUS eikä päättyminen. "Sulkukierros klo 22" tarkoittaa
 * että kierros aloitetaan kymmeneltä; neljäkymmentä minuuttia kestänyt kierros ei ole
 * myöhässä siksi että se päättyi 22:40.
 */
export function vuoronKooste({
  vuoro, kierrokset = [], suoritukset = [], liukuma = LIUKUMA_MIN,
}) {
  if (!vuoro) return null;

  const alkoiMs = new Date(vuoro.alkoi).getTime();
  const paattyiMs = vuoro.paattyi ? new Date(vuoro.paattyi).getTime() : Date.now();
  // Vain tämän vuoron aikana tehdyt. Eilinen kuittaus ei kerro tästä vuorosta mitään.
  const vuorolla = (iso) => {
    const hetki = new Date(iso).getTime();
    return Number.isFinite(hetki) && hetki >= alkoiMs && hetki <= paattyiMs;
  };

  const pohjat = (vuoro.pohjat || []).map((p) => {
    const ajot = kierrokset
      .filter((k) => k?.templateId === p.id && k.vartija === vuoro.vartija && vuorolla(k.alkoi))
      .sort((a, b) => String(a.alkoi).localeCompare(String(b.alkoi)));
    const valmis = ajot.find((k) => k.tila === 'valmis') || null;
    const kesken = ajot.find((k) => k.tila === 'kesken') || null;
    const keskeytetty = ajot.find((k) => k.tila === 'keskeytetty') || null;
    const tehty = valmis || keskeytetty;
    return {
      id: p.id,
      nimi: p.nimi,
      lahde: p.lahde,
      suoritusaika: p.suoritusaika || null,
      tila: valmis ? 'valmis' : keskeytetty ? 'keskeytetty' : kesken ? 'kesken' : 'tekematta',
      tehtyKlo: tehty ? tehty.alkoi : null,
      poikkeamaMin: tehty ? poikkeamaMinuutteina(p.suoritusaika, tehty.alkoi) : null,
      poikkeama: tehty
        ? onPoikkeama({ suoritusaika: p.suoritusaika, tehtyIso: tehty.alkoi, lahde: p.lahde, liukuma })
        : false,
    };
  });

  const tehtavat = (vuoro.tehtavat || []).map((t) => {
    const kuittaus = suoritukset
      .filter((s) => s?.tehtavaId === t.id && s.vartija === vuoro.vartija && vuorolla(s.aika))
      .sort((a, b) => String(a.aika).localeCompare(String(b.aika)))[0] || null;
    return {
      id: t.id,
      nimi: t.nimi,
      lahde: t.lahde,
      suoritusaika: t.suoritusaika || null,
      tila: kuittaus ? 'valmis' : 'tekematta',
      tehtyKlo: kuittaus ? kuittaus.aika : null,
      poikkeamaMin: kuittaus ? poikkeamaMinuutteina(t.suoritusaika, kuittaus.aika) : null,
      poikkeama: kuittaus
        ? onPoikkeama({ suoritusaika: t.suoritusaika, tehtyIso: kuittaus.aika, lahde: t.lahde, liukuma })
        : false,
    };
  });

  const rivit = [...pohjat, ...tehtavat];
  return {
    vuoroId: vuoro.id,
    siteNimi: vuoro.siteNimi,
    vuorotyyppiNimi: vuoro.vuorotyyppiNimi,
    vartija: vuoro.vartija,
    alkoi: vuoro.alkoi,
    paattyi: vuoro.paattyi,
    // Kesken oleva kierros ei ole tehty eikä tekemättä: se on kesken. Sen niputtaminen
    // kumpaankaan antaisi väärän luvun juuri siitä asiasta jota luku väittää mittaavansa.
    tehty: rivit.filter((r) => r.tila === 'valmis').length,
    tekematta: rivit.filter((r) => r.tila === 'tekematta').length,
    kesken: rivit.filter((r) => r.tila === 'kesken').length,
    keskeytetty: rivit.filter((r) => r.tila === 'keskeytetty').length,
    poikkeamia: rivit.filter((r) => r.poikkeama).length,
    perehdytysPoikkeus: vuoro.perehdytysPoikkeus || null,
    pohjat,
    tehtavat,
  };
}
