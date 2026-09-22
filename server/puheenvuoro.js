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

// Hätäkanavan puheenvuoro saa pitempään (erä 26, vaihe 8, käyttäjän päätös 22.9.2026):
// man-down/"tarvitsen apua" -lähetys ei saa katketa kesken hätätilanteen 60 sekuntiin,
// samalla kun tavallinen kanava pitää lyhyemmän ajan ("kanava varattu" -kokemus, ei
// yksi puhuja joka voi pitää linjaa auki minuutitolkulla). Sama VARASUOJA-periaate kuin
// AIKAKATKAISU_MS:llä — ei yksittäisen lähetyksen tarkoituksellinen enimmäispituus vaan
// kova katto jos vapautusviesti ei koskaan tule.
export const AIKAKATKAISU_HATA_MS = 5 * 60_000;

// kanavaId -> { istunto, kayttaja, alkoi, aikakatkaisuMs }
const puheenvuorot = new Map();

const vanhentunut = (tila, nyt) => nyt - tila.alkoi >= tila.aikakatkaisuMs;

/**
 * Pyyntö puheenvuorosta. Palauttaa myönnetyn tai hylätyn tuloksen — kutsuja päättää
 * mitä viestiä siitä lähetetään kenellekin, tämä moduuli ei tunne kanava.js:ää.
 *
 * `aikakatkaisuMs` on kutsujan vastuulla (index.js päättää kanavatyypin perusteella,
 * ks. AIKAKATKAISU_HATA_MS) — tämä moduuli ei tunne kanavatyyppejä eikä kanavaId:n
 * muotoa, se vain säilyttää sen minkä kutsuja antoi puheenvuoron pituudeksi.
 *
 * Saman istunnon toistuva pyyntö (esim. selain lähetti kahdesti) ei ole virhe eikä
 * uusi haltuunotto — `alkoi` ei nollaudu, jottei toistuva pyyntö pidennä puheenvuoroa
 * loputtomiin aikakatkaisua vasten.
 */
export function pyydaPuheenvuoro({ kanavaId, istunto, kayttaja, nyt = Date.now(), aikakatkaisuMs = AIKAKATKAISU_MS }) {
  const vanha = puheenvuorot.get(kanavaId);
  if (vanha && !vanhentunut(vanha, nyt)) {
    if (vanha.istunto === istunto) {
      return { ok: true, kayttaja: vanha.kayttaja, jo_haltijana: true };
    }
    return { ok: false, syy: 'varattu', kayttaja: vanha.kayttaja };
  }
  puheenvuorot.set(kanavaId, { istunto, kayttaja, alkoi: nyt, aikakatkaisuMs });
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

/**
 * Pitääkö TÄMÄ istunto (eikä vain sama käyttäjätunnus) kanavan puheenvuoroa juuri nyt
 * (erä 26, vaihe 6, kuljetus) — sama istunto-identiteetti kuin vapautaPuheenvuoro käyttää.
 * Portti äänikehysten ja PTT-avainilmoitusten relelle: kukaan muu kuin nykyinen haltija ei
 * saa lähettää kummankaan tyyppistä viestiä kanavalle, vaikka väittäisi olevansa haltija.
 */
export function onHaltija(kanavaId, istunto, nyt = Date.now()) {
  const tila = puheenvuorot.get(kanavaId);
  if (!tila || vanhentunut(tila, nyt)) return false;
  return tila.istunto === istunto;
}

/** Tyhjentää koko tilan. Testien apu, sama nimi ja tarkoitus kuin sijainti.js:n tyhjenna(). */
export function tyhjenna() {
  puheenvuorot.clear();
}
