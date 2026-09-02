// Liitteiden EXIF-sijainnin testit. Tämä testataan erikseen samasta syystä kuin
// georeferointi: virhe ei näy virheenä vaan todistekuvana joka on kartalla väärässä
// paikassa uskottavan näköisenä. Tavutason jäsennin on myös helppo rikkoa
// huomaamatta, koska tavallinen kuva ei sisällä sijaintia lainkaan — silloin sekä
// toimiva että rikkinäinen jäsennin palauttaa null.
//
// Ajetaan: node --test src/shared/liitteet.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { lueGpsExif, kokoTekstina, tiedostonPaate } from './liitteet.ts';

// --- Testikuvan rakentaminen ------------------------------------------------------
//
// Rakennetaan JPEG-tiedoston alku käsin: SOI, APP1 jossa EXIF-otsake, TIFF-otsake,
// IFD0 jossa on osoitin GPS-hakemistoon, ja GPS-hakemisto koordinaatteineen. Näin
// testi ei tarvitse binääristä testitiedostoa repoon eikä ole riippuvainen siitä,
// mikä puhelin sen sattui ottamaan.

type Osat = { lat: [number, number, number]; latRef: string; lon: [number, number, number]; lonRef: string };

function teeJpegExif({ lat, latRef, lon, lonRef }: Osat, littleEndian = true): Blob {
  // TIFF-lohkon rakenne (siirtymät TIFF-otsakkeen alusta):
  //   0   otsake (8 t)
  //   8   IFD0: 1 kenttä (GPS-osoitin) = 2 + 12 + 4 = 18 t
  //   26  GPS-IFD: 4 kenttää = 2 + 48 + 4 = 54 t
  //   80  leveysasteen kolme murtolukua (24 t)
  //   104 pituusasteen kolme murtolukua (24 t)
  const GPS_IFD = 26;
  const LAT_DATA = 80;
  const LON_DATA = 104;
  const tiffPituus = 128;

  const puskuri = new ArrayBuffer(tiffPituus);
  const n = new DataView(puskuri);
  const le = littleEndian;

  n.setUint16(0, le ? 0x4949 : 0x4d4d, false);
  n.setUint16(2, 0x002a, le);
  n.setUint32(4, 8, le); // IFD0 alkaa tavusta 8

  // IFD0: yksi kenttä, GPS-hakemiston osoitin (tagi 0x8825, tyyppi LONG).
  n.setUint16(8, 1, le);
  n.setUint16(10, 0x8825, le);
  n.setUint16(12, 4, le);
  n.setUint32(14, 1, le);
  n.setUint32(18, GPS_IFD, le);
  n.setUint32(22, 0, le); // ei seuraavaa IFD:tä

  // GPS-IFD: neljä kenttää.
  n.setUint16(GPS_IFD, 4, le);
  const kentta = (i: number, tagi: number, tyyppi: number, maara: number, kirjoitaArvo: (o: number) => void) => {
    const o = GPS_IFD + 2 + i * 12;
    n.setUint16(o, tagi, le);
    n.setUint16(o + 2, tyyppi, le);
    n.setUint32(o + 4, maara, le);
    kirjoitaArvo(o + 8);
  };
  // Viitteet ovat ASCII-merkki + päättävä nolla, eli ne mahtuvat kenttään itseensä.
  kentta(0, 1, 2, 2, (o) => { n.setUint8(o, latRef.charCodeAt(0)); n.setUint8(o + 1, 0); });
  kentta(1, 2, 5, 3, (o) => n.setUint32(o, LAT_DATA, le));
  kentta(2, 3, 2, 2, (o) => { n.setUint8(o, lonRef.charCodeAt(0)); n.setUint8(o + 1, 0); });
  kentta(3, 4, 5, 3, (o) => n.setUint32(o, LON_DATA, le));
  n.setUint32(GPS_IFD + 2 + 4 * 12, 0, le);

  // Murtoluvut: sekunnit tuhannesosien tarkkuudella, kuten puhelimet kirjoittavat.
  const kirjoitaDms = (alku: number, dms: [number, number, number]) => {
    n.setUint32(alku, Math.round(dms[0]), le); n.setUint32(alku + 4, 1, le);
    n.setUint32(alku + 8, Math.round(dms[1]), le); n.setUint32(alku + 12, 1, le);
    n.setUint32(alku + 16, Math.round(dms[2] * 1000), le); n.setUint32(alku + 20, 1000, le);
  };
  kirjoitaDms(LAT_DATA, lat);
  kirjoitaDms(LON_DATA, lon);

  const tiff = new Uint8Array(puskuri);
  const exifOtsake = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
  const app1Pituus = 2 + exifOtsake.length + tiff.length;
  const alku = new Uint8Array([
    0xff, 0xd8,                                    // SOI
    0xff, 0xe1, (app1Pituus >> 8) & 0xff, app1Pituus & 0xff, // APP1 + pituus
  ]);
  return new Blob([alku, exifOtsake, tiff]);
}

const laheskaan = (a: number, b: number, toleranssi = 1e-6) =>
  assert.ok(Math.abs(a - b) < toleranssi, `${a} ei ole lähellä arvoa ${b}`);

// --- Testit -----------------------------------------------------------------------

test('lukee pohjoisen ja idän koordinaatit (little-endian)', async () => {
  // Tampereen Ratinan suvanto: 61°29'38.4"N, 23°45'54.0"E
  const kuva = teeJpegExif({ lat: [61, 29, 38.4], latRef: 'N', lon: [23, 45, 54], lonRef: 'E' });
  const gps = await lueGpsExif(kuva);
  assert.ok(gps, 'sijainnin olisi pitänyt löytyä');
  laheskaan(gps!.lat, 61 + 29 / 60 + 38.4 / 3600, 1e-5);
  laheskaan(gps!.lon, 23 + 45 / 60 + 54 / 3600, 1e-5);
});

test('lukee saman kuvan myös big-endian-tavujärjestyksellä', async () => {
  const kuva = teeJpegExif({ lat: [61, 29, 38.4], latRef: 'N', lon: [23, 45, 54], lonRef: 'E' }, false);
  const gps = await lueGpsExif(kuva);
  assert.ok(gps);
  laheskaan(gps!.lat, 61 + 29 / 60 + 38.4 / 3600, 1e-5);
});

test('etelä ja länsi tulevat negatiivisina', async () => {
  const kuva = teeJpegExif({ lat: [33, 55, 30], latRef: 'S', lon: [18, 25, 12], lonRef: 'W' });
  const gps = await lueGpsExif(kuva);
  assert.ok(gps);
  assert.ok(gps!.lat < 0, 'eteläinen leveysaste on negatiivinen');
  assert.ok(gps!.lon < 0, 'läntinen pituusaste on negatiivinen');
});

test('nollasaari (0,0) hylätään epäonnistuneena paikannuksena', async () => {
  const kuva = teeJpegExif({ lat: [0, 0, 0], latRef: 'N', lon: [0, 0, 0], lonRef: 'E' });
  assert.equal(await lueGpsExif(kuva), null);
});

test('mahdoton leveysaste hylätään', async () => {
  const kuva = teeJpegExif({ lat: [120, 0, 0], latRef: 'N', lon: [23, 0, 0], lonRef: 'E' });
  assert.equal(await lueGpsExif(kuva), null);
});

test('JPEG ilman EXIF-lohkoa palauttaa null eikä kaadu', async () => {
  const kuva = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00])]);
  assert.equal(await lueGpsExif(kuva), null);
});

test('muu kuin JPEG palauttaa null eikä kaadu', async () => {
  // PNG-otsake.
  const kuva = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]);
  assert.equal(await lueGpsExif(kuva), null);
});

test('katkennut tiedosto palauttaa null eikä kaadu', async () => {
  const kokonainen = teeJpegExif({ lat: [61, 29, 38.4], latRef: 'N', lon: [23, 45, 54], lonRef: 'E' });
  const katkaistu = kokonainen.slice(0, 40);
  assert.equal(await lueGpsExif(katkaistu), null);
});

test('tyhjä tiedosto palauttaa null eikä kaadu', async () => {
  assert.equal(await lueGpsExif(new Blob([])), null);
});

test('kokoTekstina muotoilee tavut, kilotavut ja megatavut', () => {
  assert.equal(kokoTekstina(512), '512 t');
  assert.equal(kokoTekstina(2048), '2 kt');
  assert.equal(kokoTekstina(3 * 1024 * 1024), '3,0 Mt');
  assert.equal(kokoTekstina(undefined), '');
});

test('tiedostonPaate on pienaakkosin ja tunnistaa pisteettömän nimen', () => {
  assert.equal(tiedostonPaate('Kuva.JPG'), '.jpg');
  assert.equal(tiedostonPaate('raportti.pdf'), '.pdf');
  assert.equal(tiedostonPaate('nimetön'), '');
});
