// Henkilön pysyvä tunnistenumero (#1000 →). Palvelin on numeroiden ainoa omistaja.
//
// SÄÄNTÖ: yksi numero kuuluu yhdelle henkilölle ikuisesti. Raporttien kirjaajatieto,
// perehdytysmerkinnät ja kaluston luovutustositteet viittaavat numeroon, joten poistetun
// henkilön numero ei saa palata kiertoon — muuten vanha merkintä osoittaisi uuteen ihmiseen.
//
// Selain ei voi valvoa tätä: se näkee vain nykyisen listan, ei poistettuja. Ennen tätä
// moduulia seuraava numero laskettiin selaimessa listan suurimmasta, jolloin viimeisenä
// lisätyn poisto vapautti numeron heti uudelleen (27.9.2026 #1011). Siksi palvelin pitää
// kirjaa suurimmasta KOSKAAN annetusta numerosta (korkein) ja antaa uudet numerot sen
// yläpuolelta. Selaimen ehdotus hyväksytään vain jos se on sama jonka palvelin antaisi.
//
// Työntekijä ja hänen tunnuksensa ovat sama henkilö, joten niillä on sama numero
// (POST /api/users: displayId + employeeId).

export const TUNNISTE_ALKU = 1000;

const luku = (arvo) => {
  const n = parseInt(String(arvo ?? ''), 10);
  return Number.isFinite(n) && n >= TUNNISTE_ALKU ? n : null;
};

// Suurin käytössä tai käytetty numero. `korkein` on levylle tallennettu kirjanpito;
// muut lähteet ovat mukana, jotta kirjanpidon puuttuminen (ensimmäinen käynnistys)
// tai jälkeenjääminen ei koskaan johda jo käytössä olevan numeron antamiseen.
export function laskeKorkein({ korkein = null, tyontekijat = [], kayttajat = [] }) {
  const numerot = [
    luku(korkein),
    ...tyontekijat.map((t) => luku(t?.displayId)),
    ...kayttajat.map((k) => luku(k?.displayId)),
  ].filter((n) => n !== null);
  return numerot.length ? Math.max(...numerot) : TUNNISTE_ALKU - 1;
}

/**
 * Tarkistaa ja korjaa työntekijäkokoelman numerot ennen tallennusta.
 *
 * - Olemassa olevan tietueen numero on muuttumaton: selaimen muutos palautetaan.
 * - Uusi tietue (tai vanha jolta numero puuttuu) saa seuraavan numeron korkeimman
 *   yläpuolelta. Selaimen ehdotus kelpaa vain jos se on juuri se numero.
 *
 * Palauttaa korjatun datan, uuden korkeimman ja korjatut numerot ({ id: numero }),
 * jotka reitti palauttaa selaimelle — tallentaja näkee oikean numeron heti.
 */
export function vahvistaTyontekijoidenNumerot({ nykyiset = [], uudet = [], kayttajat = [], korkein = null }) {
  const nykyisetIdlla = new Map(nykyiset.filter((t) => t?.id).map((t) => [String(t.id), t]));
  let seuraavaKorkein = laskeKorkein({ korkein, tyontekijat: nykyiset, kayttajat });
  const korjatut = {};

  const data = uudet.map((tietue) => {
    if (!tietue || typeof tietue !== 'object') return tietue;
    const id = String(tietue.id ?? '');
    const ehdotettu = luku(tietue.displayId);
    const vanha = luku(nykyisetIdlla.get(id)?.displayId);

    let numero;
    if (vanha !== null) {
      numero = vanha;
    } else {
      seuraavaKorkein += 1;
      numero = seuraavaKorkein;
    }
    if (ehdotettu !== numero) korjatut[id] = numero;
    return ehdotettu === numero ? tietue : { ...tietue, displayId: numero };
  });

  return { data, korkein: seuraavaKorkein, korjatut };
}

/**
 * Tunnuksen numeron tarkistus (POST /api/users). Numero on joko tunnukseen kytketyn
 * työntekijän oma, tai — kytkemättömälle tunnukselle — uusi numero korkeimman yläpuolelta.
 * Toisen henkilön numeroa ei hyväksytä koskaan.
 */
export function tunnuksenNumero({ ehdotettu, employeeId, tyontekijat = [], kayttajat = [], korkein = null }) {
  const tyontekija = employeeId ? tyontekijat.find((t) => t?.id === employeeId) : null;
  const oma = luku(tyontekija?.displayId);
  const pyydetty = luku(ehdotettu);

  if (oma !== null) {
    if (pyydetty !== null && pyydetty !== oma) {
      return { ok: false, virhe: `Työntekijän tunnistenumero on #${oma}, ei #${pyydetty}.` };
    }
    const varaaja = kayttajat.find((k) => luku(k?.displayId) === oma && k?.employeeId !== employeeId);
    if (varaaja) return { ok: false, virhe: `Tunnistenumero #${oma} on jo tunnuksella ${varaaja.username}.` };
    return { ok: true, numero: oma, korkein: laskeKorkein({ korkein, tyontekijat, kayttajat }) };
  }

  // Ei kytkettyä työntekijää (tai hänellä ei ole numeroa): aina uusi numero.
  const uusi = laskeKorkein({ korkein, tyontekijat, kayttajat }) + 1;
  if (pyydetty !== null && pyydetty !== uusi) {
    return { ok: false, virhe: `Tunnistenumero #${pyydetty} ei ole vapaa. Seuraava vapaa on #${uusi}.` };
  }
  return { ok: true, numero: uusi, korkein: uusi };
}
