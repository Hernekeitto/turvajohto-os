// Tyhjät OpenDocument-pohjat uutta dokumenttia varten: teksti (.odt, Writer), taulukko
// (.ods, Calc) ja esitys (.odp, Impress).
//
// Muodostetaan selaimessa ja ladataan palvelimelle samaa reittiä kuin käyttäjän oma
// tiedosto (/api/uploads). Näin uusi dokumentti kulkee täsmälleen saman oikeus- ja
// tallennuspolun kuin lataus, eikä palvelimelle tarvita omaa luontireittiä.
//
// ODF-tiedosto on zip-paketti. Määrittely vaatii että `mimetype` on paketin ensimmäinen
// tiedosto ja pakkaamaton; yksinkertaisuuden vuoksi mitään ei pakata. Sisältö on
// minimi jonka LibreOffice avaa (todennettu LibreOfficen omalla muunnoksella, ks.
// odfPohja.test.ts). Tyylit tulevat LibreOfficen oletuksista — paitsi esityksessä,
// jonka dia tarvitsee pohjasivun (master page) ja sen sivumitat: ilman niitä dia olisi
// A4-pystymuodossa.

export type OdfTyyppi = 'odt' | 'ods' | 'odp';

const NS = {
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
};

const XML = '<?xml version="1.0" encoding="UTF-8"?>\n';

const POHJAT: Record<OdfTyyppi, { mimetype: string; content: string; styles?: string; oletusnimi: string }> = {
  odt: {
    mimetype: 'application/vnd.oasis.opendocument.text',
    oletusnimi: 'Uusi dokumentti',
    content: `${XML}<office:document-content xmlns:office="${NS.office}" xmlns:text="${NS.text}" office:version="1.2"><office:body><office:text><text:p/></office:text></office:body></office:document-content>\n`,
  },
  ods: {
    mimetype: 'application/vnd.oasis.opendocument.spreadsheet',
    oletusnimi: 'Uusi taulukko',
    content: `${XML}<office:document-content xmlns:office="${NS.office}" xmlns:table="${NS.table}" office:version="1.2"><office:body><office:spreadsheet><table:table table:name="Taulukko1"><table:table-row><table:table-cell/></table:table-row></table:table></office:spreadsheet></office:body></office:document-content>\n`,
  },
  odp: {
    mimetype: 'application/vnd.oasis.opendocument.presentation',
    oletusnimi: 'Uusi esitys',
    content: `${XML}<office:document-content xmlns:office="${NS.office}" xmlns:draw="${NS.draw}" office:version="1.2"><office:body><office:presentation><draw:page draw:name="Dia1" draw:master-page-name="Oletus"/></office:presentation></office:body></office:document-content>\n`,
    // 16:9, 28 × 15,75 cm — sama kuin LibreOffice Impressin oletus.
    styles: `${XML}<office:document-styles xmlns:office="${NS.office}" xmlns:style="${NS.style}" xmlns:fo="${NS.fo}" office:version="1.2"><office:automatic-styles><style:page-layout style:name="PM1"><style:page-layout-properties fo:margin-top="0cm" fo:margin-bottom="0cm" fo:margin-left="0cm" fo:margin-right="0cm" fo:page-width="28cm" fo:page-height="15.75cm" style:print-orientation="landscape"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Oletus" style:page-layout-name="PM1"/></office:master-styles></office:document-styles>\n`,
  },
};

function manifest(mimetype: string, styles: boolean) {
  return `${XML}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
 <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${mimetype}"/>
 <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
${styles ? ' <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>\n' : ''}</manifest:manifest>
`;
}

let crcTaulu: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!crcTaulu) {
    crcTaulu = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTaulu[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const tavu of data) crc = crcTaulu[(crc ^ tavu) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Pakkaamaton zip (tallennusmenetelmä 0). Aikaleima nolla (1980-01-01): sisältö on aina
// sama, joten tiedosto on tavu tavulta toistettava.
export function zipPakkaamaton(tiedostot: { nimi: string; data: Uint8Array }[]): Uint8Array {
  const koodaaja = new TextEncoder();
  const osat: Uint8Array[] = [];
  const keskus: Uint8Array[] = [];
  let siirto = 0;

  for (const { nimi, data } of tiedostot) {
    const nimiTavut = koodaaja.encode(nimi);
    const crc = crc32(data);

    const paikallinen = new DataView(new ArrayBuffer(30));
    paikallinen.setUint32(0, 0x04034b50, true);
    paikallinen.setUint16(4, 20, true); // versio
    paikallinen.setUint16(8, 0, true); // menetelmä: tallennus
    paikallinen.setUint32(14, crc, true);
    paikallinen.setUint32(18, data.length, true);
    paikallinen.setUint32(22, data.length, true);
    paikallinen.setUint16(26, nimiTavut.length, true);
    osat.push(new Uint8Array(paikallinen.buffer), nimiTavut, data);

    const k = new DataView(new ArrayBuffer(46));
    k.setUint32(0, 0x02014b50, true);
    k.setUint16(4, 20, true);
    k.setUint16(6, 20, true);
    k.setUint32(16, crc, true);
    k.setUint32(20, data.length, true);
    k.setUint32(24, data.length, true);
    k.setUint16(28, nimiTavut.length, true);
    k.setUint32(42, siirto, true);
    keskus.push(new Uint8Array(k.buffer), nimiTavut);

    siirto += 30 + nimiTavut.length + data.length;
  }

  const keskusKoko = keskus.reduce((s, o) => s + o.length, 0);
  const loppu = new DataView(new ArrayBuffer(22));
  loppu.setUint32(0, 0x06054b50, true);
  loppu.setUint16(8, tiedostot.length, true);
  loppu.setUint16(10, tiedostot.length, true);
  loppu.setUint32(12, keskusKoko, true);
  loppu.setUint32(16, siirto, true);

  const kaikki = [...osat, ...keskus, new Uint8Array(loppu.buffer)];
  const tulos = new Uint8Array(kaikki.reduce((s, o) => s + o.length, 0));
  let i = 0;
  for (const o of kaikki) { tulos.set(o, i); i += o.length; }
  return tulos;
}

export function tyhjaOdf(tyyppi: OdfTyyppi): Uint8Array {
  const pohja = POHJAT[tyyppi];
  const k = new TextEncoder();
  return zipPakkaamaton([
    { nimi: 'mimetype', data: k.encode(pohja.mimetype) },
    { nimi: 'META-INF/manifest.xml', data: k.encode(manifest(pohja.mimetype, Boolean(pohja.styles))) },
    { nimi: 'content.xml', data: k.encode(pohja.content) },
    ...(pohja.styles ? [{ nimi: 'styles.xml', data: k.encode(pohja.styles) }] : []),
  ]);
}

// Käyttäjän antamasta nimestä tiedostonimi: kielletyt merkit pois ja oikea pääte
// varmasti perään. Tyhjä nimi → tyypin oletusnimi ("Uusi taulukko.ods").
export function uudenDokumentinNimi(syote: string, tyyppi: OdfTyyppi = 'odt'): string {
  // Ohjausmerkit (< 0x20) suodatetaan koodin eikä säännöllisen lausekkeen avulla.
  const puhdas = [...syote]
    .filter((m) => m.charCodeAt(0) >= 0x20 && !'\\/:*?"<>|'.includes(m))
    .join('')
    .trim()
    .slice(0, 120);
  const pohja = puhdas.replace(new RegExp(`\\.${tyyppi}$`, 'i'), '').trim() || POHJAT[tyyppi].oletusnimi;
  return `${pohja}.${tyyppi}`;
}

export function uusiOdfTiedosto(nimi: string, tyyppi: OdfTyyppi): File {
  const data = tyhjaOdf(tyyppi);
  return new File([data.buffer as ArrayBuffer], uudenDokumentinNimi(nimi, tyyppi), { type: POHJAT[tyyppi].mimetype });
}
