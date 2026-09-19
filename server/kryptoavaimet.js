// PTT-kanavien päästä-päähän-salauksen laiteavaimet (erä 26, vaihe 2, viipale 2a,
// korjattu 2a2 kun OlmMachinen oikea rajapinta selvisi).
//
// ERI ASIA kuin server/avaimet.js (fyysinen avainhallinta, esim. ovien yleisavaimet) ja
// server/laite.js (laitesidonnan allekirjoitusavain, jolla vahvistetaan että API-pyyntö
// tulee sidotulta laitteelta). Tämä tiedosto koskee PTT-VIESTIEN SISÄLLÖN salausta
// käyttäjien laitteiden välillä — kolmas, täysin erillinen avainkäsite.
//
// MUOTO ON MATRIXIN OMA, EI KEKSITTY: @matrix-org/matrix-sdk-crypto-wasm:n OlmMachine
// tuottaa ja lukee JSON-rungot suoraan Matrixin client-server-spesifikaation
// /keys/upload, /keys/query ja /keys/claim -muodoissa (device_keys, one_time_keys).
// Ensimmäinen versio tästä tiedostosta keksi oman kentistön (identiteettiavaimet,
// allekirjoitettuPrekey) joka ei vastannut mitään mitä kirjasto oikeasti tuottaa —
// korjattu tähän ennen kuin asiakaspään integraatiota rakennettiin sen päälle. Palvelin
// EI TULKITSE avainten sisältöä (ei allekirjoitusten tarkistusta — se on TOFU/asiakkaan
// asia, ks. Obsidian: "vaihe 2 -suunnitelma", kohta 3): se vain tallentaa ja tarjoilee
// device_keys- ja one_time_keys-oliot lähes sellaisenaan, samaan tapaan kuin oikea
// Matrix-kotipalvelinkin tekee.
//
// Fallback-avain (Matrix 1.2+, "aina saatavilla oleva" kertakäyttöavain jota käytetään
// kun pooli tyhjenee) on TARKOITUKSELLA RAJATTU POIS tästä viipaleesta — kertakäyttö-
// avainpooli riittää perusistunnon todentamiseen, fallback on täydennys jolle ei ole
// vielä tarvetta.
//
// Säännöt ovat täällä, I/O ja Express kutsujassa — sama jako kuin kanavat.js:ssä.

function onOlio(x) {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Onko annettu device_keys-olio (Matrixin /keys/upload-muoto) rakenteeltaan kelvollinen
 * JA täsmääkö se väitettyyn käyttäjään ja laitteeseen. EI tarkista allekirjoitusta —
 * palvelin ei ole luotettu osapuoli kryptografian suhteen, vain säilytyksen suhteen.
 */
export function kelvollinenDeviceKeys(deviceKeys, kayttaja, laiteId) {
  return onOlio(deviceKeys)
    && deviceKeys.user_id === kayttaja
    && deviceKeys.device_id === laiteId
    && onOlio(deviceKeys.keys)
    && onOlio(deviceKeys.signatures);
}

/** Ovatko kaksi device_keys-oliota saman identiteetin ilmentymiä (samat julkiset avaimet). */
function samaIdentiteetti(a, b) {
  const aAvaimet = a?.keys || {};
  const bAvaimet = b?.keys || {};
  const kaikkiIdt = new Set([...Object.keys(aAvaimet), ...Object.keys(bAvaimet)]);
  return [...kaikkiIdt].every((avainId) => aAvaimet[avainId] === bAvaimet[avainId]);
}

/**
 * Siivoaa syötteen kertakäyttöavainten kartan (id -> allekirjoitettu avainolio):
 * pudottaa väärämuotoiset arvot ja id:t jotka ovat jo tallessa. Ei kaada eikä valita
 * väärämuotoisesta syötteestä — asiakas on aina toisen pään käyttäjä.
 */
export function siivoaKertakayttoavaimet(kartta, olemassaOlevatIdt) {
  const tulos = {};
  if (!onOlio(kartta)) return tulos;
  for (const [avainId, avain] of Object.entries(kartta)) {
    if (!avainId || olemassaOlevatIdt.has(avainId) || !onOlio(avain)) continue;
    tulos[avainId] = avain;
  }
  return tulos;
}

/**
 * Avainpaketin lataus (KeysUploadRequest-vastine). Luo uuden laitetietueen tai
 * päivittää olemassa olevaa.
 *
 * IDENTITEETTI ON PYSYVÄ: ensimmäinen ladattu device_keys lukitaan laitteelle. Myöhempi
 * lataus jolla on ERI avaimet samalle (käyttäjä, laite) -parille hylätään — se
 * tarkoittaisi joko virhettä asiakkaassa tai identiteetin korvausyritystä, eikä
 * kumpikaan saa hiljaa onnistua. Oikea identiteetin vaihto (laitteen nollaus) on oma
 * toimintonsa (vaihe 2, kohta 4, ei vielä tässä viipaleessa) joka poistaa vanhan
 * tietueen ensin.
 *
 * KERTAKÄYTTÖAVAIMET LISÄTÄÄN eikä korvata — pooli täydentyy vähitellen kun ne kuluvat
 * (vaadiKertakayttoavain), ei tyhjene joka latauksella.
 */
export function paivitaAvainpaketti({
  olemassaOleva, id, kayttaja, laiteId, deviceKeys, kertakayttoavaimet, nyt = Date.now(),
}) {
  if (!kelvollinenDeviceKeys(deviceKeys, kayttaja, laiteId)) {
    return { ok: false, error: 'device_keys puuttuu tai on virheellinen.' };
  }
  if (olemassaOleva && !samaIdentiteetti(olemassaOleva.deviceKeys, deviceKeys)) {
    return { ok: false, error: 'Laitteella on jo eri identiteettiavain. Nollaa laitesidonta ensin.' };
  }

  const olemassaOlevatIdt = new Set(Object.keys(olemassaOleva?.kertakayttoavaimet || {}));
  const uudet = siivoaKertakayttoavaimet(kertakayttoavaimet, olemassaOlevatIdt);

  return {
    ok: true,
    tietue: {
      id,
      kayttaja,
      laiteId,
      deviceKeys,
      kertakayttoavaimet: { ...(olemassaOleva?.kertakayttoavaimet || {}), ...uudet },
      rekisteroity: olemassaOleva?.rekisteroity ?? new Date(nyt).toISOString(),
      paivitetty: new Date(nyt).toISOString(),
    },
  };
}

/**
 * Kertakäyttöavaimen "vaatiminen" (KeysClaimRequest-vastine): irrottaa YHDEN pyydetyn
 * algoritmin avaimen poolista ja palauttaa sen id:n, itse avaimen ja päivitetyn
 * (avaimettoman) tietueen. Avain EI KOSKAAN PALAA pooliin — uudelleenkäyttö murtaisi
 * Olm-protokollan eteenpäin turvaavuuden. Jos pyydettyä algoritmia ei ole jäljellä,
 * avain: null (asiakas turvautuu silloin muuhun keinoon — normaali Olm-käytös, ei virhe).
 */
export function vaadiKertakayttoavain(tietue, algoritmi) {
  const kartta = tietue?.kertakayttoavaimet || {};
  const loydettyId = Object.keys(kartta).find((avainId) => avainId.startsWith(`${algoritmi}:`));
  if (!loydettyId) return { tietue, keyId: null, avain: null };
  const { [loydettyId]: avain, ...loput } = kartta;
  return { tietue: { ...tietue, kertakayttoavaimet: loput }, keyId: loydettyId, avain };
}

/**
 * Laitteen julkinen kuvaus avainkyselyyn: device_keys, EI kertakäyttöavainpoolia — sitä
 * ei koskaan näytetä listana (ks. vaadiKertakayttoavain).
 */
export function julkinenKuvaus(tietue) {
  return { laiteId: tietue.laiteId, deviceKeys: tietue.deviceKeys };
}
