// Tyhjä OpenDocument-tekstitiedosto (.odt) uutta dokumenttia varten.
//
// Muodostetaan selaimessa ja ladataan palvelimelle samaa reittiä kuin käyttäjän oma
// tiedosto (/api/uploads). Näin uusi dokumentti kulkee täsmälleen saman oikeus- ja
// tallennuspolun kuin lataus, eikä palvelimelle tarvita omaa luontireittiä.
//
// .odt on zip-paketti. ODF-määrittely vaatii että `mimetype` on paketin ensimmäinen
// tiedosto ja pakkaamaton; yksinkertaisuuden vuoksi mitään ei pakata. Sisältö on
// minimi jonka LibreOffice avaa: manifest ja yksi tyhjä kappale. Tyylit tulevat
// LibreOfficen oletuksista.

const MIMETYPE = 'application/vnd.oasis.opendocument.text';

const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
 <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${MIMETYPE}"/>
 <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>
`;

const CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text><text:p/></office:text></office:body></office:document-content>
`;

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

export function tyhjaOdt(): Uint8Array {
  const k = new TextEncoder();
  return zipPakkaamaton([
    { nimi: 'mimetype', data: k.encode(MIMETYPE) },
    { nimi: 'META-INF/manifest.xml', data: k.encode(MANIFEST) },
    { nimi: 'content.xml', data: k.encode(CONTENT) },
  ]);
}

// Käyttäjän antamasta nimestä tiedostonimi: kielletyt merkit pois ja .odt-pääte
// varmasti perään. Tyhjä nimi → "Uusi dokumentti.odt".
export function uudenDokumentinNimi(syote: string): string {
  // Ohjausmerkit (< 0x20) suodatetaan koodin eikä säännöllisen lausekkeen avulla.
  const puhdas = [...syote]
    .filter((m) => m.charCodeAt(0) >= 0x20 && !'\\/:*?"<>|'.includes(m))
    .join('')
    .trim()
    .slice(0, 120);
  const pohja = puhdas.replace(/\.odt$/i, '').trim() || 'Uusi dokumentti';
  return `${pohja}.odt`;
}

export function uusiOdtTiedosto(nimi: string): File {
  const data = tyhjaOdt();
  return new File([data.buffer as ArrayBuffer], uudenDokumentinNimi(nimi), { type: MIMETYPE });
}
