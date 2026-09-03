// Tiedotteet: viesti kentälle, jonka lukeminen kuitataan.
//
// MIKSI OMA TOIMINTONSA EIKÄ TEKSTIVIESTI. Pikatoiminnot (sms.js) lähettävät hätäviestin
// televerkkoon, ja se on oikea työkalu silloin kun sovellus ei ehkä ole auki. Tiedote on
// eri asia: se on sovelluksen sisäinen, se ei maksa mitään, ja siitä JÄÄ TIETO KUKA ON
// LUKENUT SEN. Juuri se erottaa tiedotteen huutamisesta radiossa — huudon kuulee joku,
// tiedotteen kuittaa nimetty ihminen nimettynä hetkenä.
//
// KUITTAUS ON LUKUKUITTAUS EIKÄ SUOSTUMUS. "Olen lukenut ja ymmärtänyt" on eri asia kuin
// "teen niin", eikä käyttöliittymä saa väittää muuta. Siksi kuittauksessa ei ole
// vaihtoehtoja: se on yksi nappi, ja sen merkitys on että viesti on nähty.
//
// VASTAANOTTAJAJOUKKO LASKETAAN OIKEUKSISTA. Tiedotteen laatija näkee ketkä eivät ole
// kuitanneet, ja se tieto on koko toiminnon syy — ilman sitä tiedote olisi vain ilmoitus
// jonka lukemisesta ei tiedetä mitään. Joukko on ne käyttäjät joilla on lukuoikeus
// tiedotteisiin kyseisessä tapahtumassa tai kohteessa: sama sääntö joka päättää kenelle
// tiedote ylipäätään näkyy.

export const OTSIKON_MAX = 120;
export const VIESTIN_MAX = 2000;

// Kuinka kauan tiedote on "voimassa" eli näkyy kuittauspyyntönä. Vanhentunut tiedote jää
// historiaan mutta ei enää vaadi kuittausta: kolmen päivän takainen porttiohje ei ole
// se asia jota vuoroon tulevan pitää ensimmäisenä kuitata.
export const VOIMASSA_TUNTIA_OLETUS = 12;
export const VOIMASSA_TUNTIA_MAX = 168;

const siivoa = (arvo, max) => {
  let tulos = '';
  for (const merkki of String(arvo ?? '')) {
    const koodi = merkki.codePointAt(0);
    // Rivinvaihto SÄILYY viestin rungossa: tiedote on usein lista, ja yhdeksi riviksi
    // litistettynä se lakkaa olemasta luettava. Muut ohjausmerkit poistetaan.
    if (koodi === 10) { tulos += '\n'; continue; }
    if (koodi === 9 || koodi === 13) { tulos += ' '; continue; }
    if (koodi < 32 || koodi === 127) continue;
    tulos += merkki;
  }
  return tulos.trim().slice(0, max);
};

export function luoTiedote({ id, ownerId, omistaja, otsikko, viesti, laatija, voimassaTuntia, nyt = Date.now() }) {
  const puhdasOtsikko = siivoa(otsikko, OTSIKON_MAX);
  if (puhdasOtsikko.length < 2) return { ok: false, error: 'Anna tiedotteelle otsikko.' };
  const puhdasViesti = siivoa(viesti, VIESTIN_MAX);
  if (puhdasViesti.length < 2) return { ok: false, error: 'Tiedote on tyhjä.' };
  if (!laatija) return { ok: false, error: 'Tiedotteelta puuttuu laatija.' };

  const tunnit = Number(voimassaTuntia);
  const voimassa = Number.isFinite(tunnit) && tunnit > 0 && tunnit <= VOIMASSA_TUNTIA_MAX
    ? Math.round(tunnit)
    : VOIMASSA_TUNTIA_OLETUS;

  return {
    ok: true,
    tiedote: {
      id,
      ownerId,
      omistaja: omistaja === 'kohde' ? 'kohde' : 'tapahtuma',
      otsikko: puhdasOtsikko,
      viesti: puhdasViesti,
      laatija,
      luotu: new Date(nyt).toISOString(),
      vanhenee: new Date(nyt + voimassa * 60 * 60 * 1000).toISOString(),
      voimassaTuntia: voimassa,
      // Kuittaukset ovat lista eikä laskuri: kysymys ei ole "moniko" vaan "kuka".
      kuittaukset: [],
      peruttu: null,
    },
  };
}

export const onVoimassa = (tiedote, nyt = Date.now()) => {
  if (!tiedote || tiedote.peruttu) return false;
  const vanhenee = Date.parse(tiedote.vanhenee);
  return !Number.isFinite(vanhenee) || vanhenee > nyt;
};

export const onKuitannut = (tiedote, username) =>
  (tiedote?.kuittaukset || []).some((k) => k.user === username);

// Kuittaus. Toinen kuittaus samalta käyttäjältä EI ole virhe: se on sama teko uudelleen,
// ja virheilmoitus siitä olisi vain hämmentävä. Ensimmäinen aikaleima säilyy, koska se on
// se hetki jolloin viesti oikeasti nähtiin.
export function kuittaa({ tiedote, username, nyt = Date.now() }) {
  if (!tiedote) return { ok: false, error: 'Tiedotetta ei löytynyt.' };
  if (!username) return { ok: false, error: 'Kuittaajaa ei tunnistettu.' };
  if (onKuitannut(tiedote, username)) {
    return { ok: true, tiedote, duplikaatti: true };
  }
  return {
    ok: true,
    tiedote: {
      ...tiedote,
      kuittaukset: [...(tiedote.kuittaukset || []), { user: username, ts: new Date(nyt).toISOString() }],
    },
  };
}

// Tiedotteen peruminen: viesti oli väärä tai tilanne muuttui. Perutun tiedotteen
// kuittaukset SÄILYVÄT — ne kertovat kuka ehti nähdä sen, ja se voi olla tärkein tieto
// juuri silloin kun tiedote oli väärä.
export function peru({ tiedote, username, nyt = Date.now() }) {
  if (!tiedote) return { ok: false, error: 'Tiedotetta ei löytynyt.' };
  if (tiedote.peruttu) return { ok: false, error: 'Tiedote on jo peruttu.' };
  return {
    ok: true,
    tiedote: { ...tiedote, peruttu: new Date(nyt).toISOString(), perujaUser: username || null },
  };
}

// Ketkä eivät ole kuitanneet. `kayttajat` on lista { username, nimi } jotka SAAVAT nähdä
// tiedotteen — kutsuja ratkaisee sen oikeussäännöillä, koska tämä moduuli ei tunne niitä.
//
// Laatija itse on mukana joukossa: hän näkee oman tiedotteensa, ja jos hänkään ei ole
// kuitannut sitä, se on rehellisempi kuin joukko josta on siivottu pois se ainoa jonka
// tiedetään varmasti lukeneen viestin.
export function kuittaamatta(tiedote, kayttajat) {
  const kuitanneet = new Set((tiedote?.kuittaukset || []).map((k) => k.user));
  return (Array.isArray(kayttajat) ? kayttajat : []).filter((k) => !kuitanneet.has(k.username));
}

export function kooste(tiedote, kayttajat) {
  const odotetut = Array.isArray(kayttajat) ? kayttajat.length : 0;
  const kuitanneet = (tiedote?.kuittaukset || []).length;
  return {
    odotetut,
    kuitanneet,
    kuittaamatta: Math.max(0, odotetut - kuitanneet),
    osuus: odotetut === 0 ? null : Math.round((kuitanneet / odotetut) * 100),
  };
}
