// PTT-kanavien päästä-päähän-salauksen laiteavaimet (erä 26, vaihe 2, viipale 2a).
//
// ERI ASIA kuin server/avaimet.js (fyysinen avainhallinta, esim. ovien yleisavaimet) ja
// server/laite.js (laitesidonnan allekirjoitusavain, jolla vahvistetaan että API-pyyntö
// tulee sidotulta laitteelta). Tämä tiedosto koskee PTT-VIESTIEN SISÄLLÖN salausta
// käyttäjien laitteiden välillä — kolmas, täysin erillinen avainkäsite.
//
// Julkinen avainvarasto @matrix-org/matrix-sdk-crypto-wasm:n OlmMachinelle
// (kirjastovalinta 19.9.2026, ks. Obsidian: "Turvajohto OS PTT, vaihe 2 -suunnitelma").
// Tämä tiedosto EI tunne kirjastoa itseään eikä tee mitään kryptografiaa — se vain
// tallentaa ja tarjoilee sen tuottaman JULKISEN avainmateriaalin samalla tavalla kuin
// kanavat.js tallentaa kanavien tietomallin. Yksityiset avaimet eivät koskaan poistu
// laitteelta eivätkä kulje tämän tiedoston tai sen kutsujan (server/index.js) kautta.
//
// Säännöt ovat täällä, I/O ja Express kutsujassa — sama jako kuin kanavat.js:ssä.

function onMerkkijono(x) {
  return typeof x === 'string' && x.length > 0;
}

/** Onko identiteettiavainpari (Olm: ed25519 allekirjoitusavain + curve25519 sopimusavain) kelvollinen. */
export function kelvollinenIdentiteetti(identiteetti) {
  return !!identiteetti && onMerkkijono(identiteetti.ed25519) && onMerkkijono(identiteetti.curve25519);
}

/** Onko allekirjoitettu prekey (id + julkinen avain + allekirjoitus) kelvollinen. */
export function kelvollinenAllekirjoitettuPrekey(prekey) {
  return !!prekey && onMerkkijono(prekey.id) && onMerkkijono(prekey.avain) && onMerkkijono(prekey.allekirjoitus);
}

/**
 * Siivoaa syötteen kertakäyttöavainlistan: vain kelvolliset {id, avain} -parit,
 * uniikit id:t (ensimmäinen voittaa). Ei kaada eikä valita väärämuotoisesta syötteestä
 * — asiakas on aina toisen pään käyttäjä eikä sen virhe saa kaataa palvelinta.
 */
export function siivoaKertakayttoavaimet(lista) {
  const nahdyt = new Set();
  const tulos = [];
  for (const avain of Array.isArray(lista) ? lista : []) {
    if (!avain || !onMerkkijono(avain.id) || !onMerkkijono(avain.avain)) continue;
    if (nahdyt.has(avain.id)) continue;
    nahdyt.add(avain.id);
    tulos.push({ id: avain.id, avain: avain.avain });
  }
  return tulos;
}

/**
 * Avainpaketin lataus (KeysUploadRequest-vastine). Luo uuden laitetietueen tai
 * päivittää olemassa olevaa.
 *
 * IDENTITEETTI ON PYSYVÄ: ensimmäinen ladattu identiteettiavain lukitaan laitteelle.
 * Myöhempi lataus jolla on ERI identiteetti hylätään — se tarkoittaisi joko virhettä
 * asiakkaassa tai identiteetin korvausyritystä, eikä kumpikaan saa hiljaa onnistua.
 * Identiteetin oikea vaihto (laitteen nollaus) on oma toimintonsa (vaihe 2, kohta 4,
 * ei vielä tässä viipaleessa) joka poistaa vanhan tietueen ensin.
 *
 * ALLEKIRJOITETTU PREKEY KORVATAAN aina uusimmalla — sen rotaatio on normaalia eikä
 * vaadi erillistä oikeutta, koska se on aina saman (jo lukitun) identiteetin
 * allekirjoittama.
 *
 * KERTAKÄYTTÖAVAIMET LISÄTÄÄN eikä korvata — pooli täydentyy vähitellen kun ne kuluvat
 * (vaadiKertakayttoavain), ei tyhjene joka latauksella.
 */
export function paivitaAvainpaketti({
  olemassaOleva, id, kayttaja, laiteId, identiteettiavaimet, allekirjoitettuPrekey, kertakayttoavaimet,
  nyt = Date.now(),
}) {
  if (!kelvollinenIdentiteetti(identiteettiavaimet)) {
    return { ok: false, error: 'Identiteettiavaimet puuttuvat tai ovat virheelliset.' };
  }
  if (!kelvollinenAllekirjoitettuPrekey(allekirjoitettuPrekey)) {
    return { ok: false, error: 'Allekirjoitettu prekey puuttuu tai on virheellinen.' };
  }
  if (olemassaOleva && (
    olemassaOleva.identiteettiavaimet.ed25519 !== identiteettiavaimet.ed25519
    || olemassaOleva.identiteettiavaimet.curve25519 !== identiteettiavaimet.curve25519
  )) {
    return { ok: false, error: 'Laitteella on jo eri identiteettiavain. Nollaa laitesidonta ensin.' };
  }

  const vanhatIdt = new Set((olemassaOleva?.kertakayttoavaimet || []).map((a) => a.id));
  const uudetKelvolliset = siivoaKertakayttoavaimet(kertakayttoavaimet).filter((a) => !vanhatIdt.has(a.id));

  return {
    ok: true,
    tietue: {
      id,
      kayttaja,
      laiteId,
      identiteettiavaimet,
      allekirjoitettuPrekey,
      kertakayttoavaimet: [...(olemassaOleva?.kertakayttoavaimet || []), ...uudetKelvolliset],
      rekisteroity: olemassaOleva?.rekisteroity ?? new Date(nyt).toISOString(),
      paivitetty: new Date(nyt).toISOString(),
    },
  };
}

/**
 * Kertakäyttöavaimen "vaatiminen" (KeysClaimRequest-vastine): irrottaa YHDEN avaimen
 * poolin kärjestä ja palauttaa sekä avaimen että päivitetyn (avaimettoman) tietueen.
 * Avain EI KOSKAAN PALAA pooliin — uudelleenkäyttö murtaisi Olm-protokollan eteenpäin
 * turvaavuuden. Tyhjästä poolista palautuu avain: null (asiakas turvautuu silloin
 * pelkkään allekirjoitettuun prekeyhin — normaali Olm-käytös, ei virhe).
 */
export function vaadiKertakayttoavain(tietue) {
  const pooli = tietue?.kertakayttoavaimet || [];
  if (pooli.length === 0) return { tietue, avain: null };
  const [avain, ...loput] = pooli;
  return { tietue: { ...tietue, kertakayttoavaimet: loput }, avain };
}

/**
 * Laitteen julkinen kuvaus avainkyselyyn: identiteetti ja allekirjoitettu prekey,
 * EI kertakäyttöavainpoolia — sitä ei koskaan näytetä listana (ks. vaadiKertakayttoavain).
 */
export function julkinenKuvaus(tietue) {
  return {
    laiteId: tietue.laiteId,
    identiteettiavaimet: tietue.identiteettiavaimet,
    allekirjoitettuPrekey: tietue.allekirjoitettuPrekey,
  };
}
