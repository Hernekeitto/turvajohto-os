// Käyttäjän henkilökohtainen tallennustila ("Tiedostot" yläpalkissa, 29.9.2026).
//
// Jokaisella käyttäjällä on oma kansiopuu (personalFiles-kokoelma: kansiot ja tiedostot
// samassa, `type` erottaa ja `parentId` tekee sisäkkäisyyden — sama malli kuin
// tapahtuman tiedostoissa, jotta jako ja lataussivu toimivat samalla koneistolla).
//
// KIINTIÖT (käyttäjän päätös):
//  - Vartija-taso 500 Mt, muut 5 Gt, pääkäyttäjä ei rajaa.
//  - Rajan yli saa mennä enintään PUSKURI (500 Mt), mutta siitä kerrotaan käyttäjälle.
//    Puskuri on olemassa siksi, ettei vuoron aikana tarvittava tiedosto jää tallentamatta
//    sen takia että raja täyttyi juuri sillä hetkellä.
//  - Lisätilaa pyydetään pääkäyttäjältä lomakkeella; hyväksytty pyyntö kasvattaa rajaa
//    myönnetyn määrän verran pysyvästi.
//
// Tämä moduuli on pelkkiä sääntöjä ilman levyä: reitit (index.js) lukevat ja kirjoittavat.

import crypto from 'node:crypto';

export const MT = 1024 * 1024;
export const VARTIJAN_KIINTIO = 500 * MT;
export const OLETUSKIINTIO = 5 * 1024 * MT;
export const PUSKURI = 500 * MT;
export const NIMEN_MAX = 120;
export const PERUSTELUN_MIN = 10;
export const PERUSTELUN_MAX = 1000;
// Pyydettävät lisätilan määrät (Mt). Kiinteät vaihtoehdot, jotta pyynnöt ovat
// vertailukelpoisia ja pääkäyttäjä näkee suoraan mistä päätetään.
export const LISATILAN_VAIHTOEHDOT = [500, 1024, 2048, 5120];

// Lisätila = hyväksyttyjen pyyntöjen myönnetyt määrät yhteensä.
export function lisatila(pyynnot, username) {
  return (Array.isArray(pyynnot) ? pyynnot : [])
    .filter((p) => p?.username === username && p.tila === 'hyvaksytty')
    .reduce((s, p) => s + (Number(p.myonnettyMt) || 0) * MT, 0);
}

// Käyttäjän raja tavuina, tai null jos rajaa ei ole (pääkäyttäjä).
export function kayttajanRaja(kayttaja, pyynnot) {
  if (!kayttaja) return 0;
  if (kayttaja.role === 'admin') return null;
  const perus = kayttaja.roleId === 'vartija' ? VARTIJAN_KIINTIO : OLETUSKIINTIO;
  return perus + lisatila(pyynnot, kayttaja.username);
}

export const omat = (tiedostot, username) =>
  (Array.isArray(tiedostot) ? tiedostot : []).filter((t) => t?.omistaja === username);

export const kaytto = (tiedostot, username) =>
  omat(tiedostot, username).reduce((s, t) => s + (t.type === 'file' ? Number(t.size) || 0 : 0), 0);

// Mahtuuko uusi tiedosto. `ylitys` = raja ylittyy, mutta puskuri riittää: tallennetaan
// ja kerrotaan käyttäjälle.
export function tarkistaTila({ kaytetty, koko, raja }) {
  if (raja === null) return { ok: true, ylitys: false };
  const uusi = kaytetty + koko;
  if (uusi > raja + PUSKURI) {
    return {
      ok: false,
      error: 'Tallennustilasi on täynnä. Poista tiedostoja tai pyydä lisää tallennustilaa pääkäyttäjältä.',
    };
  }
  return { ok: true, ylitys: uusi > raja };
}

// Tiedoston tai kansion nimi. Polkuerottimet ja ohjausmerkit pois: nimi näkyy
// latauksessa tiedostonimenä, eikä siitä saa tulla polkua.
export function puhdistaNimi(nimi) {
  let tulos = '';
  for (const merkki of String(nimi ?? '')) {
    const koodi = merkki.codePointAt(0);
    if (koodi < 32 || koodi === 127 || merkki === '/' || merkki === '\\') continue;
    tulos += merkki;
  }
  tulos = tulos.trim().slice(0, NIMEN_MAX);
  return tulos === '.' || tulos === '..' ? '' : tulos;
}

// Onko kansio käyttäjän oma (tai juuri, null).
export function omaKansio(tiedostot, username, parentId) {
  if (!parentId) return true;
  const kansio = (tiedostot || []).find((t) => t?.id === parentId);
  return !!kansio && kansio.type === 'folder' && kansio.omistaja === username;
}

// Kohteen ja sen koko alipuun id:t (kansion poisto vie sisällön mukanaan).
export function alipuu(tiedostot, id) {
  const lista = Array.isArray(tiedostot) ? tiedostot : [];
  const tulos = new Set([id]);
  let lisattiin = true;
  while (lisattiin) {
    lisattiin = false;
    for (const t of lista) {
      if (t?.parentId && tulos.has(t.parentId) && !tulos.has(t.id)) {
        tulos.add(t.id);
        lisattiin = true;
      }
    }
  }
  return tulos;
}

// Siirto toiseen kansioon: kohde ei saa siirtyä oman alipuunsa sisään.
export function voiSiirtaa(tiedostot, id, uusiParent) {
  if (!uusiParent) return true;
  return !alipuu(tiedostot, id).has(uusiParent);
}

export function uusiKohde({ omistaja, type, name, parentId, uploadId, size, nyt = new Date() }) {
  return {
    id: crypto.randomUUID(),
    omistaja,
    type,
    name,
    parentId: parentId || null,
    ...(type === 'file' ? { uploadId, size: Number(size) || 0 } : {}),
    createdAt: nyt.toISOString(),
  };
}

// --- Lisätilapyynnöt ------------------------------------------------------------

export function luoPyynto({ username, nimimerkki, perustelu, maaraMt, nyt = new Date() }) {
  const teksti = String(perustelu ?? '').trim().slice(0, PERUSTELUN_MAX);
  if (teksti.length < PERUSTELUN_MIN) {
    return { ok: false, error: 'Kerro lyhyesti, miksi tarvitset lisää tallennustilaa.' };
  }
  const maara = Number(maaraMt);
  if (!LISATILAN_VAIHTOEHDOT.includes(maara)) return { ok: false, error: 'Valitse pyydettävä määrä.' };
  return {
    ok: true,
    pyynto: {
      id: crypto.randomUUID(),
      username,
      nimimerkki: nimimerkki || username,
      perustelu: teksti,
      pyydettyMt: maara,
      tila: 'odottaa',
      luotu: nyt.toISOString(),
      kasittelija: null,
      kasitelty: null,
      myonnettyMt: 0,
      kuitattu: false,
    },
  };
}

// Pääkäyttäjän päätös. Hyväksyessä määrää voi muuttaa (esim. pyydetty 5 Gt, myönnetään 1 Gt).
export function kasittelePyynto({ pyynto, hyvaksy, maaraMt, kasittelija, syy, nyt = new Date() }) {
  if (!pyynto) return { ok: false, error: 'Pyyntöä ei löytynyt.' };
  if (pyynto.tila !== 'odottaa') return { ok: false, error: 'Pyyntö on jo käsitelty.' };
  let myonnetty = 0;
  if (hyvaksy) {
    myonnetty = maaraMt === undefined ? pyynto.pyydettyMt : Math.round(Number(maaraMt));
    if (!Number.isFinite(myonnetty) || myonnetty <= 0 || myonnetty > 100 * 1024) {
      return { ok: false, error: 'Myönnettävän määrän on oltava 1–102400 Mt.' };
    }
  }
  return {
    ok: true,
    pyynto: {
      ...pyynto,
      tila: hyvaksy ? 'hyvaksytty' : 'hylatty',
      myonnettyMt: myonnetty,
      kasittelija,
      kasitelty: nyt.toISOString(),
      paatoksenSyy: String(syy ?? '').trim().slice(0, 500),
      // Käyttäjälle näytetään ilmoitus päätöksestä kunnes hän on nähnyt sen.
      kuitattu: false,
    },
  };
}
