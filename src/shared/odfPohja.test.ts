// Tyhjien ODF-pohjien (.odt, .ods, .odp) testit. Tarkistussumma verrataan Noden omaan
// zlib.crc32:een, jotta testi ei nojaa samaan toteutukseen jota se testaa. Pohjien
// kelpoisuus LibreOfficelle todennettiin 29.9.2026 LibreOfficen omalla PDF-muunnoksella
// (Writer, Calc ja Impress tunnistivat tyypin; esityksen dia 28 × 15,75 cm).
//
// Ajetaan: node --test src/shared/odfPohja.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import { tyhjaOdf, uudenDokumentinNimi, type OdfTyyppi } from './odfPohja.ts';

const MIME: Record<OdfTyyppi, string> = {
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
};

// Lukee zipin keskushakemiston: nimi, menetelmä, crc, koko ja data.
function lueZip(zip: Uint8Array) {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const loppu = zip.length - 22;
  assert.equal(dv.getUint32(loppu, true), 0x06054b50, 'loppumerkintä puuttuu');
  const maara = dv.getUint16(loppu + 10, true);
  let i = dv.getUint32(loppu + 16, true);
  const tiedostot = [];
  for (let n = 0; n < maara; n++) {
    assert.equal(dv.getUint32(i, true), 0x02014b50);
    const menetelma = dv.getUint16(i + 10, true);
    const crc = dv.getUint32(i + 16, true);
    const koko = dv.getUint32(i + 24, true);
    const nimenPituus = dv.getUint16(i + 28, true);
    const siirto = dv.getUint32(i + 42, true);
    const nimi = new TextDecoder().decode(zip.subarray(i + 46, i + 46 + nimenPituus));
    assert.equal(dv.getUint32(siirto, true), 0x04034b50, `${nimi}: paikallinen otsake puuttuu`);
    const alku = siirto + 30 + dv.getUint16(siirto + 26, true) + dv.getUint16(siirto + 28, true);
    tiedostot.push({ nimi, menetelma, crc, siirto, data: zip.subarray(alku, alku + koko) });
    i += 46 + nimenPituus;
  }
  return tiedostot;
}

for (const tyyppi of ['odt', 'ods', 'odp'] as const) {
  test(`${tyyppi}: mimetype on ensimmäinen, pakkaamaton ja oikea`, () => {
    const [eka] = lueZip(tyhjaOdf(tyyppi));
    assert.equal(eka.nimi, 'mimetype');
    assert.equal(eka.siirto, 0);
    assert.equal(eka.menetelma, 0);
    assert.equal(new TextDecoder().decode(eka.data), MIME[tyyppi]);
  });

  test(`${tyyppi}: pakollinen sisältö mukana ja tarkistussummat oikein`, () => {
    const tiedostot = lueZip(tyhjaOdf(tyyppi));
    const odotetut = ['mimetype', 'META-INF/manifest.xml', 'content.xml', ...(tyyppi === 'odp' ? ['styles.xml'] : [])];
    assert.deepEqual(tiedostot.map((t) => t.nimi), odotetut);
    for (const t of tiedostot) assert.equal(t.crc, crc32(t.data), `${t.nimi}: crc`);
  });

  test(`${tyyppi}: pohja on tavu tavulta toistettava`, () => {
    assert.deepEqual(tyhjaOdf(tyyppi), tyhjaOdf(tyyppi));
  });
}

test('uuden dokumentin nimi', () => {
  assert.equal(uudenDokumentinNimi('Vartio-ohje'), 'Vartio-ohje.odt');
  assert.equal(uudenDokumentinNimi('Ohje.ODT'), 'Ohje.odt');
  assert.equal(uudenDokumentinNimi('  '), 'Uusi dokumentti.odt');
  assert.equal(uudenDokumentinNimi('../../etc/passwd'), '....etcpasswd.odt');
  assert.equal(uudenDokumentinNimi('a:b*c?'), 'abc.odt');
  assert.equal(uudenDokumentinNimi('', 'ods'), 'Uusi taulukko.ods');
  assert.equal(uudenDokumentinNimi('Budjetti.ODS', 'ods'), 'Budjetti.ods');
  assert.equal(uudenDokumentinNimi('', 'odp'), 'Uusi esitys.odp');
  // Väärä pääte jää osaksi nimeä: tyyppi ratkaisee päätteen.
  assert.equal(uudenDokumentinNimi('Esitys.odt', 'odp'), 'Esitys.odt.odp');
});
