// Mikroraportin valikot taulukkona (2.10.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import {
  MUUT, OMA, lueOds, omatKirjaukset, rakennaOds, siistiLuettelo, tulkitseLuettelo, tulkitseOds,
} from './mikroluettelo.js';

const LUETTELO = {
  paikat: [
    { ryhma: 'Yleiset tilat', paikka: 'Aula' },
    { ryhma: 'Yleiset tilat', paikka: 'Käytävä & "porras" <B>' },
  ],
  tapahtumat: [
    { luokka: 'havainto', aihe: 'Kiinteistö', alue: 'Ovet', teksti: 'Ovi ei mene lukkoon' },
    { luokka: 'poikkeama', aihe: 'Kiinteistö', alue: 'Ovet', teksti: 'Lukko rikki' },
    { luokka: 'toimenpide', aihe: 'Henkilöstö', alue: 'Opastus', teksti: 'Asiakkaan opastus' },
  ],
};

// Collaboran tapaan pakattu taulukko: content.xml deflatella, toistetut tyhjät rivit ja
// sarakkeet, text:s-välilyönnit ja span-tagit.
function pakattuOds(contentXml) {
  const tiedostot = [
    { nimi: 'mimetype', data: Buffer.from('application/vnd.oasis.opendocument.spreadsheet'), pakkaa: false },
    { nimi: 'content.xml', data: Buffer.from(contentXml), pakkaa: true },
  ];
  const osat = [];
  const keskus = [];
  let siirto = 0;
  for (const { nimi, data, pakkaa } of tiedostot) {
    const sisalto = pakkaa ? zlib.deflateRawSync(data) : data;
    const n = Buffer.from(nimi);
    const p = Buffer.alloc(30);
    p.writeUInt32LE(0x04034b50, 0);
    p.writeUInt16LE(pakkaa ? 8 : 0, 8);
    p.writeUInt32LE(sisalto.length, 18);
    p.writeUInt32LE(data.length, 22);
    p.writeUInt16LE(n.length, 26);
    osat.push(p, n, sisalto);
    const k = Buffer.alloc(46);
    k.writeUInt32LE(0x02014b50, 0);
    k.writeUInt16LE(pakkaa ? 8 : 0, 10);
    k.writeUInt32LE(sisalto.length, 20);
    k.writeUInt32LE(data.length, 24);
    k.writeUInt16LE(n.length, 28);
    k.writeUInt32LE(siirto, 42);
    keskus.push(k, n);
    siirto += 30 + n.length + sisalto.length;
  }
  const kk = keskus.reduce((s, o) => s + o.length, 0);
  const loppu = Buffer.alloc(22);
  loppu.writeUInt32LE(0x06054b50, 0);
  loppu.writeUInt16LE(tiedostot.length, 8);
  loppu.writeUInt16LE(tiedostot.length, 10);
  loppu.writeUInt32LE(kk, 12);
  loppu.writeUInt32LE(siirto, 16);
  return Buffer.concat([...osat, ...keskus, loppu]);
}

const c = (t) => `<table:table-cell office:value-type="string"><text:p>${t}</text:p></table:table-cell>`;

test('luotu taulukko luetaan takaisin samaksi luetteloksi', () => {
  const tulos = tulkitseOds(rakennaOds(LUETTELO));
  assert.equal(tulos.ok, true, tulos.virheet.join('\n'));
  assert.deepEqual(tulos.luettelo, LUETTELO);
  assert.deepEqual(tulos.varoitukset, []);
});

test('Collaboran tapaan tallennettu taulukko: pakkaus, toistot, välilyönnit ja tyylitagit', () => {
  const xml = `<?xml version="1.0"?><office:document-content><office:body><office:spreadsheet>
<table:table table:name="Paikat"><table:table-column table:number-columns-repeated="1024"/>
<table:table-row>${c('Ryhmä')}${c('Paikka')}<table:table-cell table:number-columns-repeated="16382"/></table:table-row>
<table:table-row>${c('Piha')}${c('<text:span text:style-name="T1">Lastaus</text:span>laituri')}<table:table-cell table:number-columns-repeated="16382"/></table:table-row>
<table:table-row table:number-rows-repeated="3"><table:table-cell table:number-columns-repeated="16384"/></table:table-row>
<table:table-row><table:table-cell/>${c('Katto<text:s text:c="2"/>A')}</table:table-row>
<table:table-row table:number-rows-repeated="1048570"><table:table-cell table:number-columns-repeated="16384"/></table:table-row>
</table:table>
<table:table table:name="Otsikot">
<table:table-row>${c('Laji')}${c('Aihe')}${c('Alue')}${c('Otsikko')}</table:table-row>
<table:table-row>${c('Havainto (Positiivinen)')}${c('A')}${c('B')}${c('Kaikki &amp; kunnossa')}</table:table-row>
<table:table-row>${c('toimenpide')}<table:table-cell table:number-columns-repeated="2"/>${c('Ovi avattu')}</table:table-row>
</table:table>
</office:spreadsheet></office:body></office:document-content>`;
  const tulos = tulkitseOds(pakattuOds(xml));
  assert.equal(tulos.ok, true, tulos.virheet.join('\n'));
  assert.deepEqual(tulos.luettelo.paikat, [
    { ryhma: 'Piha', paikka: 'Lastauslaituri' },
    { ryhma: MUUT, paikka: 'Katto A' },
  ]);
  assert.deepEqual(tulos.luettelo.tapahtumat, [
    { luokka: 'havainto', aihe: 'A', alue: 'B', teksti: 'Kaikki & kunnossa' },
    { luokka: 'toimenpide', aihe: MUUT, alue: MUUT, teksti: 'Ovi avattu' },
  ]);
  // Poikkeama-lajia ei ole: varoitus, ei virhe.
  assert.equal(tulos.varoitukset.length, 1);
  assert.match(tulos.varoitukset[0], /Poikkeama/);
});

test('virheet kertovat rivinumeron, ja virheellinen taulukko ei kelpaa', () => {
  const tulos = tulkitseLuettelo({
    Paikat: [['Ryhmä', 'Paikka'], ['Piha'], [], ['Piha', 'Portti'], ['Piha', 'portti']],
    Otsikot: [['Laji', 'Aihe', 'Alue', 'Otsikko'], ['Huomio', 'A', 'B', 'X'], ['Havainto', 'A', 'B']],
  });
  assert.equal(tulos.ok, false);
  assert.deepEqual(tulos.virheet, [
    'Paikat rivi 2: paikka (sarake B) puuttuu.',
    'Otsikot rivi 2: laji (sarake A) on "Huomio", pitää olla Havainto, Poikkeama tai Toimenpide.',
    'Otsikot rivi 3: otsikko (sarake D) puuttuu.',
    'Otsikot-välilehdellä ei ole yhtään otsikkoa.',
  ]);
  assert.match(tulos.varoitukset[0], /Paikat rivi 5/);
});

test('puuttuva välilehti, varattu ryhmänimi ja rikkinäinen tiedosto', () => {
  assert.match(tulkitseLuettelo({ Otsikot: [['Havainto', 'A', 'B', 'X']] }).virheet[0], /"Paikat" puuttuu/);
  const varattu = tulkitseLuettelo({ Paikat: [[OMA, 'X']], Otsikot: [['Havainto', 'A', 'B', 'X']] });
  assert.match(varattu.virheet[0], /varattu/);
  const rikki = tulkitseOds(Buffer.from('ei zip'));
  assert.equal(rikki.ok, false);
  assert.match(rikki.virheet[0], /zip/);
});

test('otsikkorivi tunnistetaan vain jos se on otsikko', () => {
  const ilman = tulkitseLuettelo({ Paikat: [['Piha', 'Portti']], Otsikot: [['Havainto', 'A', 'B', 'X']] });
  assert.equal(ilman.luettelo.paikat.length, 1);
  assert.equal(ilman.luettelo.tapahtumat.length, 1);
});

test('selaimen lähettämä luettelo siistitään ennen taulukoksi muuttamista', () => {
  const s = siistiLuettelo({ paikat: [{ ryhma: 1, paikka: 'A' }], tapahtumat: [{ luokka: 'x', teksti: 'T' }], muuta: 1 });
  assert.deepEqual(s, { paikat: [{ ryhma: '', paikka: 'A' }], tapahtumat: [{ luokka: '', aihe: '', alue: '', teksti: 'T' }] });
  assert.equal(tulkitseOds(rakennaOds(s)).ok, false);
});

test('omat kirjaukset kootaan ehdotuslistaksi useimmin käytetyt ensin', () => {
  const r = (paikka, otsikko) => ({
    typeId: 'guard_micro', microPlaceGroup: paikka ? OMA : 'Piha', microPlace: paikka || 'Portti',
    microTopic: otsikko ? OMA : 'A', microClass: 'havainto', microEvent: otsikko || 'X',
  });
  const tulos = omatKirjaukset([r('Pyörävarasto', null), r('pyörävarasto', 'Lintu'), r('Kellari', null), { typeId: 'guard_action' }]);
  assert.deepEqual(tulos.paikat, [{ teksti: 'Pyörävarasto', maara: 2 }, { teksti: 'Kellari', maara: 1 }]);
  assert.deepEqual(tulos.otsikot, [{ teksti: 'Havainto: Lintu', maara: 1 }]);
});

test('lueOds palauttaa kaikki välilehdet', () => {
  assert.deepEqual(Object.keys(lueOds(rakennaOds(LUETTELO))), ['Paikat', 'Otsikot', 'Ohje']);
});
