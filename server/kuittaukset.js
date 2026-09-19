// Viestien toimitus-/lukukuittaukset (erä 26, vaihe 3, viipale 3c).
//
// EPÄSYMMETRINEN KÄYTÄNTÖ (Obsidian: "vaihe 3 -suunnitelma", kohta 5): hätäkanavalla
// AINA sekä toimitus- että lukukuittaus (operatiivisesti tärkeää tietää onko HÄLKE
// nähnyt hätäviestin) — tavallisella kanavalla (kiinteä/DM/vapaa) VAIN toimitus-
// vahvistus, ei lukukuittausta. Lukukuittaus tavallisella kanavalla loisi
// työpaikkaseurannan sivumaun, samalla logiikalla kuin sijaintiseuranta vaati
// YT-käsittelyn ennen käyttöönottoa.
//
// KUITTAUKSET OVAT ERILLINEN, LISÄYSTÄ-EI-MUOKKAUSTA-KOKOELMA (sama periaate kuin
// avainhallinnan historia, server/avaimet.js) — viesti itse ei koskaan muutu, ja
// useampi vastaanottaja voi kuitata samaa viestiä rinnakkain ilman kirjoitusristiriitaa.

export const KUITTAUSTYYPIT = ['toimitus', 'luku'];

/** Sallitut kuittaustyypit annetulle kanavatyypille. Vain hätäkanava saa lukukuittauksen. */
export function sallitutKuittaustyypit(kanavaTyyppi) {
  return kanavaTyyppi === 'hata' ? KUITTAUSTYYPIT : ['toimitus'];
}

export function luoKuittaus({ id, viestiId, kanavaId, kayttaja, tyyppi, nyt = Date.now() }) {
  return { id, viestiId, kanavaId, kayttaja, tyyppi, aika: new Date(nyt).toISOString() };
}

/** Onko tälle (viesti, käyttäjä, tyyppi) -kombinaatiolle jo kuittaus — estää kaksoiskirjaukset. */
export function onKuitattu(kuittaukset, viestiId, kayttaja, tyyppi) {
  return (kuittaukset || []).some((k) => k.viestiId === viestiId && k.kayttaja === kayttaja && k.tyyppi === tyyppi);
}

/** Annetun viestin kuittaukset. */
export function viestinKuittaukset(kuittaukset, viestiId) {
  return (kuittaukset || []).filter((k) => k.viestiId === viestiId);
}
