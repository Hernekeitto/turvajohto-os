// Avainhallinta: kenellä on mikäkin avain juuri nyt.
//
// TÄMÄ EI OLE POHJA VAAN REKISTERI. Pohjamoottori (pohjat.js) hoitaa asiat joista tehdään
// suorituksia; avain on esine jolla on tila, ja sen arvo on nimenomaan siinä että tila on
// aina ajan tasalla. Kalenterin sijaan tässä on kirjanpito.
//
// KOLME SÄÄNTÖÄ:
//
//  1. AVAIN ON KERRALLAAN YHDELLÄ. Luovutus onnistuu vain hyllyssä olevalle avaimelle.
//     Ilman tätä sääntöä rekisteri kertoisi kahden ihmisen pitävän samaa avainta, ja
//     silloin se ei kertoisi mitään.
//
//  2. KATOAMINEN VAATII SYYN JA JÄÄ NÄKYVIIN. Kadonnut avain on turvallisuuspoikkeama:
//     lukitus on vaihdettava tai riski hyväksyttävä, ja kumpikin päätös tarvitsee tiedon
//     siitä milloin ja kenen hallussa avain katosi.
//
//  3. HISTORIA ON LISÄYSTÄ, EI MUOKKAUSTA. Jokainen tapahtuma jää riviksi. Rekisteri
//     jonka rivejä voi muuttaa jälkikäteen ei kelpaa todisteeksi siitä kuka pääsi sisään.

export const TILAT = ['hyllyssa', 'ulkona', 'kadonnut', 'poistettu'];

export const TILAN_SELITE = {
  hyllyssa: 'Hyllyssä',
  ulkona: 'Luovutettu',
  kadonnut: 'Kadonnut',
  poistettu: 'Poistettu käytöstä',
};

export const TUNNUKSEN_MAX = 60;
export const KUVAUKSEN_MAX = 300;
export const HUOMION_MAX = 500;
export const SYYN_MIN = 3;

const siivoa = (arvo, max) => {
  let tulos = '';
  for (const merkki of String(arvo ?? '')) {
    const koodi = merkki.codePointAt(0);
    if (koodi === 9 || koodi === 10 || koodi === 13) { tulos += ' '; continue; }
    if (koodi < 32 || koodi === 127) continue;
    tulos += merkki;
  }
  return tulos.trim().slice(0, max);
};

const merkinta = (tapahtuma, { user, haltija = null, teksti = '' }, nyt) => ({
  ts: new Date(nyt).toISOString(),
  tapahtuma,
  user: user || null,
  haltija,
  teksti: siivoa(teksti, HUOMION_MAX),
});

export function luoAvain({ id, ownerId, omistaja, tunnus, kuvaus, user, nyt = Date.now() }) {
  const puhdasTunnus = siivoa(tunnus, TUNNUKSEN_MAX);
  if (puhdasTunnus.length < 1) return { ok: false, error: 'Anna avaimelle tunnus.' };
  return {
    ok: true,
    avain: {
      id,
      ownerId,
      omistaja: omistaja === 'kohde' ? 'kohde' : 'tapahtuma',
      tunnus: puhdasTunnus,
      kuvaus: siivoa(kuvaus, KUVAUKSEN_MAX),
      tila: 'hyllyssa',
      haltija: null,
      otettu: null,
      luotu: new Date(nyt).toISOString(),
      luoja: user || null,
      historia: [merkinta('luotu', { user }, nyt)],
    },
  };
}

// Luovutus. `haltija` on vapaata tekstiä eikä käyttäjätunnus: avain luovutetaan usein
// ihmiselle jolla ei ole tunnusta järjestelmään (siivooja, huoltomies, esiintyjän
// tekniikka). Kuittaajaksi jää se joka luovutti.
export function luovuta({ avain, haltija, user, huomio, nyt = Date.now() }) {
  if (!avain) return { ok: false, error: 'Avainta ei löytynyt.' };
  if (avain.tila === 'poistettu') return { ok: false, error: 'Avain on poistettu käytöstä.' };
  if (avain.tila === 'kadonnut') {
    return { ok: false, error: 'Avain on merkitty kadonneeksi. Merkitse se ensin löytyneeksi.' };
  }
  if (avain.tila === 'ulkona') {
    return { ok: false, error: `Avain on jo luovutettu (${avain.haltija}). Se on palautettava ensin.` };
  }
  const puhdasHaltija = siivoa(haltija, TUNNUKSEN_MAX);
  if (puhdasHaltija.length < 2) return { ok: false, error: 'Kenelle avain luovutetaan?' };

  return {
    ok: true,
    avain: {
      ...avain,
      tila: 'ulkona',
      haltija: puhdasHaltija,
      otettu: new Date(nyt).toISOString(),
      historia: [...(avain.historia || []), merkinta('luovutus', { user, haltija: puhdasHaltija, teksti: huomio }, nyt)],
    },
  };
}

export function palauta({ avain, user, huomio, nyt = Date.now() }) {
  if (!avain) return { ok: false, error: 'Avainta ei löytynyt.' };
  if (avain.tila !== 'ulkona') {
    return { ok: false, error: 'Avain ei ole luovutettuna.' };
  }
  return {
    ok: true,
    avain: {
      ...avain,
      tila: 'hyllyssa',
      haltija: null,
      otettu: null,
      historia: [...(avain.historia || []), merkinta('palautus', { user, haltija: avain.haltija, teksti: huomio }, nyt)],
    },
  };
}

// Katoaminen. Haltija JÄÄ tietueeseen: "kadonnut" ilman tietoa siitä kenen hallussa avain
// oli ei kerro mitään siitä mitä pitäisi tehdä.
export function merkitseKadonneeksi({ avain, user, syy, nyt = Date.now() }) {
  if (!avain) return { ok: false, error: 'Avainta ei löytynyt.' };
  if (avain.tila === 'kadonnut') return { ok: false, error: 'Avain on jo merkitty kadonneeksi.' };
  if (avain.tila === 'poistettu') return { ok: false, error: 'Avain on poistettu käytöstä.' };
  const puhdasSyy = siivoa(syy, HUOMION_MAX);
  if (puhdasSyy.length < SYYN_MIN) {
    return { ok: false, error: 'Kerro lyhyesti mitä tapahtui. Kadonnut avain on turvallisuuspoikkeama.' };
  }
  return {
    ok: true,
    avain: {
      ...avain,
      tila: 'kadonnut',
      kadonnut: new Date(nyt).toISOString(),
      historia: [...(avain.historia || []), merkinta('kadonnut', { user, haltija: avain.haltija, teksti: puhdasSyy }, nyt)],
    },
  };
}

// Löytyminen. Avain palaa hyllyyn, mutta katoaminen jää historiaan: se on tapahtunut
// vaikka avain löytyikin, ja juuri se tieto kertoo onko lukitus ollut vaarassa.
export function merkitseLoytyneeksi({ avain, user, huomio, nyt = Date.now() }) {
  if (avain?.tila !== 'kadonnut') return { ok: false, error: 'Avain ei ole kadonneena.' };
  return {
    ok: true,
    avain: {
      ...avain,
      tila: 'hyllyssa',
      haltija: null,
      otettu: null,
      kadonnut: null,
      historia: [...(avain.historia || []), merkinta('loytyi', { user, teksti: huomio }, nyt)],
    },
  };
}

// Käytöstä poisto (lukitus vaihdettu). Ei poisto rekisteristä: historia on syy miksi
// rekisteri on olemassa.
export function poistaKaytosta({ avain, user, syy, nyt = Date.now() }) {
  if (!avain) return { ok: false, error: 'Avainta ei löytynyt.' };
  if (avain.tila === 'poistettu') return { ok: false, error: 'Avain on jo poistettu käytöstä.' };
  return {
    ok: true,
    avain: {
      ...avain,
      tila: 'poistettu',
      haltija: null,
      historia: [...(avain.historia || []), merkinta('poistettu', { user, teksti: syy }, nyt)],
    },
  };
}

export const ulkonaOlevat = (avaimet) =>
  (Array.isArray(avaimet) ? avaimet : []).filter((a) => a.tila === 'ulkona');

export const kadonneet = (avaimet) =>
  (Array.isArray(avaimet) ? avaimet : []).filter((a) => a.tila === 'kadonnut');
