// Floor control PTT-kanaville (erä 26, vaihe 1b).
//
// Kuka pitää puheenvuoroa millä kanavalla juuri nyt. Tila on MUISTISSA eikä levyllä,
// samalla periaatteella kuin server/kanava.js:n avoimet yhteydet ja sijainti.js:n
// viimeisimmät sijainnit: puheenvuoro on hetkellinen tila joka katoaa palvelimen
// uudelleenkäynnistyksessä, eikä sillä ole arvoa senkin jälkeen kun yhteys jolla se
// syntyi on jo poissa.
//
// EI JONOA. Jos kanava on varattu, pyytäjä saa heti hylkäyksen — sama käytös kuin
// oikealla radiolla ("kanava varattu"), ei automaattista jonotusta joka loisi epäselvän
// tilan siitä kuka puhuu seuraavaksi.
//
// HALTIJA TUNNISTETAAN YHTEYDESTÄ (istunto-oliosta) EIKÄ KÄYTTÄJÄTUNNUKSESTA. Sama
// tunnus voi olla kirjautuneena sekä puhelimeen että työpöydälle yhtä aikaa (GUARDin
// kaksi versiota), eikä toisen laitteen pidä voida vapauttaa tai "jatkaa" toisen laitteen
// pitämää puheenvuoroa vain siksi että käyttäjätunnus on sama.

// Kova aikakatkaisu jos vapautusviesti ei koskaan tule (esim. yhteys katkeaa rumasti
// ilman close-eventtiä). Kaksi kertaa kanava.js:n PING_VALI_MS (30 s), jotta katkos
// ehditään havaita normaalilla ping/pong-mekanismilla ennen tätä varasuojaa. Tämä EI ole
// yksittäisen lähetyksen enimmäispituus — vaiheessa 1 ei vielä kulje ääntä lainkaan, ja
// oikea enimmäispituus (jos sellainen halutaan) päätetään vasta kun ääni on mukana.
export const AIKAKATKAISU_MS = 60_000;

// kanavaId -> { istunto, kayttaja, alkoi }
const puheenvuorot = new Map();

const vanhentunut = (tila, nyt) => nyt - tila.alkoi >= AIKAKATKAISU_MS;

/**
 * Pyyntö puheenvuorosta. Palauttaa myönnetyn tai hylätyn tuloksen — kutsuja päättää
 * mitä viestiä siitä lähetetään kenellekin, tämä moduuli ei tunne kanava.js:ää.
 *
 * Saman istunnon toistuva pyyntö (esim. selain lähetti kahdesti) ei ole virhe eikä
 * uusi haltuunotto — `alkoi` ei nollaudu, jottei toistuva pyyntö pidennä puheenvuoroa
 * loputtomiin aikakatkaisua vasten.
 */
export function pyydaPuheenvuoro({ kanavaId, istunto, kayttaja, nyt = Date.now() }) {
  const vanha = puheenvuorot.get(kanavaId);
  if (vanha && !vanhentunut(vanha, nyt)) {
    if (vanha.istunto === istunto) {
      return { ok: true, kayttaja: vanha.kayttaja, jo_haltijana: true };
    }
    return { ok: false, syy: 'varattu', kayttaja: vanha.kayttaja };
  }
  puheenvuorot.set(kanavaId, { istunto, kayttaja, alkoi: nyt });
  return { ok: true, kayttaja };
}

/** Vapautus. Vain nykyinen haltija (sama istunto) voi vapauttaa — muu pyyntö ei tee mitään. */
export function vapautaPuheenvuoro({ kanavaId, istunto }) {
  const tila = puheenvuorot.get(kanavaId);
  if (!tila || tila.istunto !== istunto) return false;
  puheenvuorot.delete(kanavaId);
  return true;
}

/**
 * Yhteyden katketessa: vapauta KAIKKI tämän istunnon pitämät puheenvuorot. Yksi yhteys
 * voi teoriassa pitää useampaa kanavaa (skannaus), joten käydään kaikki läpi.
 * Palauttaa vapautettujen kanavien id:t, jotta kutsuja voi kertoa siitä muille.
 */
export function vapautaIstunnolta(istunto) {
  const vapautetut = [];
  for (const [kanavaId, tila] of puheenvuorot) {
    if (tila.istunto === istunto) {
      puheenvuorot.delete(kanavaId);
      vapautetut.push(kanavaId);
    }
  }
  return vapautetut;
}

/** Kanavan nykyinen haltija, tai null. Vanhentunut tila ei laske haltijaksi. */
export function nykyinenHaltija(kanavaId, nyt = Date.now()) {
  const tila = puheenvuorot.get(kanavaId);
  if (!tila || vanhentunut(tila, nyt)) return null;
  return tila.kayttaja;
}

/** Tyhjentää koko tilan. Testien apu, sama nimi ja tarkoitus kuin sijainti.js:n tyhjenna(). */
export function tyhjenna() {
  puheenvuorot.clear();
}
