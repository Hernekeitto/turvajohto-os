// Liitekehikko: monta liitettä yhteen kirjaukseen, kamera suoraan ja kuvan oma
// sijaintitieto talteen. Jaettu, koska sama kehikko tarvitaan EVENT-puolen TIKE-
// lomakkeilla, tapahtumailmoituksessa ja GUARD-puolen raporteissa — kolme paikkaa
// joissa nykyinen yhden liitteen malli on kopioitu erikseen.
//
// Miksi useampi liite on eri asia kuin yksi: todistearvo. Yksi kuva kertoo mitä
// tapahtui, kolme kuvaa kertoo mistä suunnasta, missä laajuudessa ja mitä jäi
// jäljelle. Kentällä otetaan sarja, ei yhtä kuvaa.

export type LiitteenSijainti = { lat: number; lon: number };

export type Liite = {
  // Palvelimen antama tiedostonimi levyllä (uuid + pääte).
  id: string;
  // Alkuperäinen nimi. Näytetään käyttäjälle, ei koskaan käytetä polkuna.
  name: string;
  size?: number;
  // Kuvan omasta EXIF-datasta luettu sijainti, jos se on siellä. null = ei tiedossa.
  // EI sama asia kuin kirjauksen sijainti: kirjaus voidaan tehdä valvomossa ja kuva
  // ottaa portilla, ja juuri se ero on se mitä tämä kenttä kertoo.
  gps?: LiitteenSijainti | null;
};

// Yhden kirjauksen liitekatto. Ei tekninen raja vaan käytännön: kymmenen kuvaa on jo
// paljon yhdestä tilanteesta, ja sadan kuvan kirjaus olisi merkki siitä että
// tilanteesta pitäisi tehdä useampi kirjaus.
export const MAX_LIITTEITA = 10;

// Sama lista kuin server/uploads.js:n ALLOWED_EXTENSIONS. Pidettävä synkassa:
// palvelin torjuu joka tapauksessa, mutta selaimen tiedostovalitsimen ei kuulu
// tarjota tyyppejä jotka torjutaan vasta lähetyksen jälkeen.
export const SALLITUT_PAATTEET = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt',
];

export const TIEDOSTOVALITSIMEN_SUODATIN = SALLITUT_PAATTEET.join(',');

// ---------------------------------------------------------------------------
// EXIF-sijainti
//
// Luetaan SELAIMESSA ennen lähetystä, ei palvelimella. Tiedosto on jo selaimessa,
// joten palvelimelle tulisi toinen jäsennin samaa varten — ja jos sijainti luettaisiin
// vasta palvelimella, sitä ei voisi näyttää käyttäjälle ennen tallennusta.
//
// EXIF-dataa EI riisuta kuvasta. Kirjauksen liite on todiste, ja aikaleima, laite ja
// koordinaatit ovat osa sen todistusarvoa. Kuva ei myöskään lähde järjestelmästä
// ulos ilman erillistä jakolinkkiä.
//
// HUOM: tämä lukee vain JPEG-tiedostoja. iPhonen HEIC on eri säiliömuoto, jossa EXIF
// on eri paikassa — siitä palautuu null, ja se on hyväksyttävää: sijainti on lisätieto
// eikä mikään toiminto riipu siitä.
// ---------------------------------------------------------------------------

// EXIF-tagit joita etsitään. Muita ei lueta lainkaan.
const TAG_GPS_IFD = 0x8825;
const TAG_LAT_REF = 1;
const TAG_LAT = 2;
const TAG_LON_REF = 3;
const TAG_LON = 4;

// Asteet, minuutit ja sekunnit yhdeksi desimaaliluvuksi. EXIF tallettaa kolme
// murtolukua; kolmas voi olla nolla vanhoilla laitteilla.
const dmsAsteiksi = (dms: number[]) => (dms[0] || 0) + (dms[1] || 0) / 60 + (dms[2] || 0) / 3600;

const lueRational = (nakyma: DataView, siirtyma: number, littleEndian: boolean) => {
  const osoittaja = nakyma.getUint32(siirtyma, littleEndian);
  const nimittaja = nakyma.getUint32(siirtyma + 4, littleEndian);
  // Nollanimittäjä on rikkinäistä dataa. Se ei saa tulla ulos Infinityna tai NaNina,
  // koska kartta piirtäisi sen jonnekin.
  return nimittaja === 0 ? 0 : osoittaja / nimittaja;
};

// Etsii JPEGin APP1-segmentin ja palauttaa TIFF-otsakkeen alun tavupuskurissa.
// null jos tiedosto ei ole JPEG tai siinä ei ole EXIF-lohkoa.
function etsiTiffAlku(nakyma: DataView): number | null {
  if (nakyma.byteLength < 4) return null;
  // Jokainen JPEG alkaa SOI-merkillä FFD8.
  if (nakyma.getUint16(0, false) !== 0xffd8) return null;

  let kohta = 2;
  while (kohta + 4 <= nakyma.byteLength) {
    // Segmentin on alettava tavulla FF. Jos ei ala, tiedosto on rikki tai kuvadata on
    // alkanut — kummassakin tapauksessa etsintä loppuu tähän.
    if (nakyma.getUint8(kohta) !== 0xff) return null;
    const merkki = nakyma.getUint8(kohta + 1);
    // SOS (FFDA) aloittaa varsinaisen kuvadatan: sen jälkeen ei ole enää segmenttejä.
    if (merkki === 0xda) return null;
    const pituus = nakyma.getUint16(kohta + 2, false);
    if (pituus < 2) return null;
    if (merkki === 0xe1) {
      const alku = kohta + 4;
      // "Exif\0\0" erottaa EXIF-APP1:n esimerkiksi XMP-APP1:stä, joka alkaa URL:lla.
      if (alku + 6 <= nakyma.byteLength
        && nakyma.getUint32(alku, false) === 0x45786966
        && nakyma.getUint16(alku + 4, false) === 0x0000) {
        return alku + 6;
      }
    }
    kohta += 2 + pituus;
  }
  return null;
}

// Lukee yhden IFD-hakemiston ja palauttaa etsityt tagit {tagi: {tyyppi, maara, siirtyma}}.
function lueIfd(nakyma: DataView, tiff: number, ifd: number, littleEndian: boolean) {
  const tulos: Record<number, { tyyppi: number; maara: number; siirtyma: number }> = {};
  if (tiff + ifd + 2 > nakyma.byteLength) return tulos;
  const maara = nakyma.getUint16(tiff + ifd, littleEndian);
  for (let i = 0; i < maara; i++) {
    const kentta = tiff + ifd + 2 + i * 12;
    if (kentta + 12 > nakyma.byteLength) break;
    const tagi = nakyma.getUint16(kentta, littleEndian);
    const tyyppi = nakyma.getUint16(kentta + 2, littleEndian);
    const lkm = nakyma.getUint32(kentta + 4, littleEndian);
    // Tyypin koko tavuina: 1=BYTE, 2=ASCII, 3=SHORT, 4=LONG, 5=RATIONAL.
    const koko = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 }[tyyppi] || 0;
    const tavuja = koko * lkm;
    // Neljään tavuun mahtuva arvo on kentässä itsessään; isompi on osoitteen takana.
    const siirtyma = tavuja > 4
      ? tiff + nakyma.getUint32(kentta + 8, littleEndian)
      : kentta + 8;
    tulos[tagi] = { tyyppi, maara: lkm, siirtyma };
  }
  return tulos;
}

// Lukee kuvan EXIF-sijainnin. Palauttaa null jos sitä ei ole — mikä on tavallista:
// moni puhelin ei liitä sijaintia kuviin lainkaan, ja käyttäjä on voinut kieltää sen.
export async function lueGpsExif(tiedosto: Blob): Promise<LiitteenSijainti | null> {
  try {
    // Vain alku luetaan: EXIF on tiedoston alussa, eikä 20 megan kuvaa kannata
    // ladata muistiin kokonaan sijaintitiedon takia.
    const puskuri = await tiedosto.slice(0, 256 * 1024).arrayBuffer();
    const nakyma = new DataView(puskuri);
    const tiff = etsiTiffAlku(nakyma);
    if (tiff === null || tiff + 8 > nakyma.byteLength) return null;

    const jarjestys = nakyma.getUint16(tiff, false);
    // 0x4949 = "II" (Intel, little-endian), 0x4D4D = "MM" (Motorola, big-endian).
    if (jarjestys !== 0x4949 && jarjestys !== 0x4d4d) return null;
    const littleEndian = jarjestys === 0x4949;
    if (nakyma.getUint16(tiff + 2, littleEndian) !== 0x002a) return null;

    const ifd0 = nakyma.getUint32(tiff + 4, littleEndian);
    const kentat = lueIfd(nakyma, tiff, ifd0, littleEndian);
    const gpsOsoitin = kentat[TAG_GPS_IFD];
    if (!gpsOsoitin) return null;

    const gpsIfd = nakyma.getUint32(gpsOsoitin.siirtyma, littleEndian);
    const gps = lueIfd(nakyma, tiff, gpsIfd, littleEndian);
    const lat = gps[TAG_LAT];
    const lon = gps[TAG_LON];
    if (!lat || !lon || lat.maara < 3 || lon.maara < 3) return null;
    if (lat.siirtyma + 24 > nakyma.byteLength || lon.siirtyma + 24 > nakyma.byteLength) return null;

    const asteet = (kentta: { siirtyma: number }) => dmsAsteiksi([
      lueRational(nakyma, kentta.siirtyma, littleEndian),
      lueRational(nakyma, kentta.siirtyma + 8, littleEndian),
      lueRational(nakyma, kentta.siirtyma + 16, littleEndian),
    ]);

    // Etelä ja länsi ovat negatiivisia. Viite on yksi ASCII-merkki.
    const viite = (kentta?: { siirtyma: number }) =>
      (kentta ? String.fromCharCode(nakyma.getUint8(kentta.siirtyma)) : '').toUpperCase();

    let arvoLat = asteet(lat);
    let arvoLon = asteet(lon);
    if (viite(gps[TAG_LAT_REF]) === 'S') arvoLat = -arvoLat;
    if (viite(gps[TAG_LON_REF]) === 'W') arvoLon = -arvoLon;

    // Kelvottomat arvot pois: rikkinäisestä EXIFistä ei saa syntyä pistettä kartalle.
    // (0, 0) on Guineanlahdella eikä koskaan oikea lukema suomalaisessa kirjauksessa —
    // se on kuitenkin tavallinen tulos laitteesta jolla paikannus epäonnistui.
    if (!Number.isFinite(arvoLat) || !Number.isFinite(arvoLon)) return null;
    if (Math.abs(arvoLat) > 90 || Math.abs(arvoLon) > 180) return null;
    if (arvoLat === 0 && arvoLon === 0) return null;

    return { lat: arvoLat, lon: arvoLon };
  } catch {
    // Vioittunut tai odottamaton tiedosto ei saa estää liitteen lähettämistä.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lähetys
// ---------------------------------------------------------------------------

export type LahetyksenTulos = { ok: true; liite: Liite } | { ok: false; virhe: string };

export const tiedostonPaate = (nimi: string) => {
  const kohta = String(nimi || '').lastIndexOf('.');
  return kohta < 0 ? '' : String(nimi).slice(kohta).toLowerCase();
};

export async function lahetaLiite(tiedosto: File): Promise<LahetyksenTulos> {
  if (!SALLITUT_PAATTEET.includes(tiedostonPaate(tiedosto.name))) {
    return { ok: false, virhe: `Tiedostotyyppiä ei tueta: ${tiedosto.name}` };
  }
  // Sijainti luetaan ENNEN lähetystä: jos lähetys epäonnistuu, turhaa työtä on tehty
  // vain muutama kilotavu, ja onnistuessa liitetietue on heti täydellinen.
  const gps = tiedosto.type.startsWith('image/') ? await lueGpsExif(tiedosto) : null;
  try {
    const lomake = new FormData();
    lomake.append('file', tiedosto);
    const res = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: lomake });
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.ok) {
      return { ok: true, liite: { id: data.id, name: data.name || tiedosto.name, size: data.size, gps } };
    }
    return { ok: false, virhe: (data && data.error) || `Lähetys epäonnistui: ${tiedosto.name}` };
  } catch {
    return { ok: false, virhe: `Lähetys epäonnistui (yhteysvirhe): ${tiedosto.name}` };
  }
}

// Tiedostokoko luettavaksi. Liitelistassa koko on se tieto jolla käyttäjä huomaa
// ladanneensa vahingossa 12 megan kuvan kolmen sijaan.
export const kokoTekstina = (tavut?: number) => {
  if (!Number.isFinite(tavut) || (tavut as number) < 0) return '';
  const t = tavut as number;
  if (t < 1024) return `${t} t`;
  if (t < 1024 * 1024) return `${Math.round(t / 1024)} kt`;
  return `${(t / (1024 * 1024)).toFixed(1).replace('.', ',')} Mt`;
};
