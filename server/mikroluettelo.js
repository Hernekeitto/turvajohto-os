// Mikroraportin valikot taulukkona (2.10.2026, käyttäjän päätös): yksi luettelo kaikille
// kohteille, ja pääkäyttäjä ylläpitää sitä .ods-taulukkona Toimistossa.
//
// Kolme asiaa:
//   rakennaOds(luettelo)  — luettelosta taulukko (välilehdet Paikat, Otsikot, Ohje)
//   lueOds(puskuri)       — taulukosta välilehdet riveinä
//   tulkitseLuettelo(...) — riveistä luettelo, virheet ja varoitukset
//
// Tallennettu taulukko otetaan käyttöön VAIN jos siinä ei ole virheitä. Muuten vartijoilla
// pysyy edellinen toimiva luettelo, ja virheet näytetään pääkäyttäjälle rivinumeroineen.
// Näin keskeneräinen tai rikkinäinen taulukko ei koskaan tyhjennä kentän valikkoa.
//
// Zip luetaan ja kirjoitetaan itse (Node:n zlib riittää), koska ODS on pelkkä zip-paketti
// jossa on yksi XML-tiedosto jota tarvitaan. Kirjasto toisi riippuvuuden yhden tiedoston
// lukemiseen.
import zlib from 'node:zlib';

export const LUOKAT = ['havainto', 'poikkeama', 'toimenpide'];
const LUOKAN_NIMI = { havainto: 'Havainto', poikkeama: 'Poikkeama', toimenpide: 'Toimenpide' };

// Sama kuin src/guard/mikroraportti/mikro.ts: OMA. Vartijan itse kirjoittamat paikat ja
// otsikot tallentuvat tällä ryhmällä, ja niistä kootaan pääkäyttäjälle ehdotuslista.
export const OMA = 'Muu (oma)';
// Ryhmä, aihe tai alue joka jätettiin taulukossa tyhjäksi.
export const MUUT = 'Muut';

export const TIEDOSTONIMI = 'Mikroraportin valikot.ods';
const MAX_RIVEJA = 5000;
const MAX_PITUUS = 200;
// Pakatun content.xml:n purkuraja. Tuhansien rivien taulukko on muutama megatavu;
// raja estää pienen mutta valtavaksi purkautuvan tiedoston (zip-pommi).
const MAX_PURETTU = 30 * 1024 * 1024;

// --- Zip ---------------------------------------------------------------------------

let crcTaulu = null;
function crc32(data) {
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

// Pakkaamaton zip, kuten src/shared/odfPohja.ts. ODF vaatii `mimetype`-tiedoston
// ensimmäisenä ja pakkaamattomana.
function zip(tiedostot) {
  const osat = [];
  const keskus = [];
  let siirto = 0;
  for (const { nimi, data } of tiedostot) {
    const nimiTavut = Buffer.from(nimi, 'utf8');
    const crc = crc32(data);
    const p = Buffer.alloc(30);
    p.writeUInt32LE(0x04034b50, 0);
    p.writeUInt16LE(20, 4);
    p.writeUInt32LE(crc, 14);
    p.writeUInt32LE(data.length, 18);
    p.writeUInt32LE(data.length, 22);
    p.writeUInt16LE(nimiTavut.length, 26);
    osat.push(p, nimiTavut, data);
    const k = Buffer.alloc(46);
    k.writeUInt32LE(0x02014b50, 0);
    k.writeUInt16LE(20, 4);
    k.writeUInt16LE(20, 6);
    k.writeUInt32LE(crc, 16);
    k.writeUInt32LE(data.length, 20);
    k.writeUInt32LE(data.length, 24);
    k.writeUInt16LE(nimiTavut.length, 28);
    k.writeUInt32LE(siirto, 42);
    keskus.push(k, nimiTavut);
    siirto += 30 + nimiTavut.length + data.length;
  }
  const keskusKoko = keskus.reduce((s, o) => s + o.length, 0);
  const loppu = Buffer.alloc(22);
  loppu.writeUInt32LE(0x06054b50, 0);
  loppu.writeUInt16LE(tiedostot.length, 8);
  loppu.writeUInt16LE(tiedostot.length, 10);
  loppu.writeUInt32LE(keskusKoko, 12);
  loppu.writeUInt32LE(siirto, 16);
  return Buffer.concat([...osat, ...keskus, loppu]);
}

// Yhden tiedoston lukeminen zipistä keskushakemiston kautta. Paikallisen otsakkeen koot
// voivat olla nollia (data descriptor), joten koot luetaan keskushakemistosta.
function lueZipista(puskuri, haettava) {
  let loppu = -1;
  for (let i = puskuri.length - 22; i >= Math.max(0, puskuri.length - 65557); i--) {
    if (puskuri.readUInt32LE(i) === 0x06054b50) { loppu = i; break; }
  }
  if (loppu < 0) throw new Error('Tiedosto ei ole kelvollinen taulukko (zip-rakenne puuttuu).');
  const maara = puskuri.readUInt16LE(loppu + 10);
  let kohta = puskuri.readUInt32LE(loppu + 16);
  for (let n = 0; n < maara; n++) {
    if (puskuri.readUInt32LE(kohta) !== 0x02014b50) break;
    const menetelma = puskuri.readUInt16LE(kohta + 10);
    const pakattu = puskuri.readUInt32LE(kohta + 20);
    const nimenPituus = puskuri.readUInt16LE(kohta + 28);
    const lisanPituus = puskuri.readUInt16LE(kohta + 30);
    const kommentinPituus = puskuri.readUInt16LE(kohta + 32);
    const paikallinen = puskuri.readUInt32LE(kohta + 42);
    const nimi = puskuri.toString('utf8', kohta + 46, kohta + 46 + nimenPituus);
    if (nimi === haettava) {
      const alku = paikallinen + 30 + puskuri.readUInt16LE(paikallinen + 26) + puskuri.readUInt16LE(paikallinen + 28);
      const data = puskuri.subarray(alku, alku + pakattu);
      if (menetelma === 0) return data;
      if (menetelma === 8) return zlib.inflateRawSync(data, { maxOutputLength: MAX_PURETTU });
      throw new Error('Taulukon pakkaustapaa ei tueta.');
    }
    kohta += 46 + nimenPituus + lisanPituus + kommentinPituus;
  }
  throw new Error(`Taulukosta puuttuu ${haettava}.`);
}

// --- XML -----------------------------------------------------------------------------

const xmlTeksti = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const purraEntiteetit = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
  const k = e.toLowerCase();
  if (k === 'amp') return '&';
  if (k === 'lt') return '<';
  if (k === 'gt') return '>';
  if (k === 'quot') return '"';
  if (k === 'apos') return "'";
  const koodi = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
  return Number.isFinite(koodi) ? String.fromCodePoint(koodi) : '';
});

const attr = (attribuutit, nimi) => new RegExp(`${nimi}="([^"]*)"`).exec(attribuutit)?.[1];

// Solun teksti: kappaleet (text:p) välilyönnillä yhteen, text:s on välilyöntejä,
// rivinvaihto ja sarkain välilyönniksi, muut tagit (text:span ym.) pois.
function solunTeksti(sisalto) {
  const kappaleet = [...sisalto.matchAll(/<text:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/text:p>)/g)].map((m) => m[1] || '');
  return kappaleet.map((k) => purraEntiteetit(k
    .replace(/<text:s\b[^>]*?text:c="(\d+)"[^>]*\/>/g, (_, n) => ' '.repeat(Math.min(Number(n), 50)))
    .replace(/<text:s\b[^>]*\/>/g, ' ')
    .replace(/<text:(tab|line-break)\b[^>]*\/>/g, ' ')
    .replace(/<[^>]+>/g, ''))).join(' ').replace(/\s+/g, ' ').trim();
}

// Sarakkeita luetaan enintään tämän verran: taulukko on muotoa A–D, ja Collabora kirjoittaa
// rivin loppuun yhden solun jonka toistomäärä on tuhansia.
const SARAKKEITA = 8;
// Sama täsmälleen sama rivi toistettuna. Tyhjät rivit ohitetaan toistosta riippumatta.
const MAX_TOISTO = 50;

function taulukonRivit(sisalto) {
  const rivit = [];
  const riviRe = /<table:table-row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-row>)/g;
  for (const r of sisalto.matchAll(riviRe)) {
    const toisto = Number(attr(r[1], 'table:number-rows-repeated') || 1);
    const solut = [];
    const soluRe = /<table:(?:covered-)?table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:(?:covered-)?table-cell>)/g;
    for (const s of (r[2] || '').matchAll(soluRe)) {
      const kertaa = Number(attr(s[1], 'table:number-columns-repeated') || 1);
      const teksti = s[2] ? solunTeksti(s[2]) : '';
      for (let i = 0; i < kertaa && solut.length < SARAKKEITA; i++) solut.push(teksti);
      if (solut.length >= SARAKKEITA) break;
    }
    while (solut.length && !solut.at(-1)) solut.pop();
    const kertaa = solut.length ? Math.min(toisto, MAX_TOISTO) : Math.min(toisto, 1);
    for (let i = 0; i < kertaa; i++) rivit.push(solut);
    if (rivit.length > MAX_RIVEJA + 100) break;
  }
  return rivit;
}

// Taulukon välilehdet: { nimi: rivit[][] }. Rivinumerot säilyvät (tyhjä rivi = []),
// jotta virheilmoitus voi kertoa saman rivinumeron jonka käyttäjä näkee taulukossa.
export function lueOds(puskuri) {
  const xml = lueZipista(puskuri, 'content.xml').toString('utf8');
  const taulukot = {};
  for (const t of xml.matchAll(/<table:table\s([^>]*)>([\s\S]*?)<\/table:table>/g)) {
    const nimi = purraEntiteetit(attr(t[1], 'table:name') || '');
    taulukot[nimi] = taulukonRivit(t[2]);
  }
  return taulukot;
}

// --- Taulukon muodostus ----------------------------------------------------------------

const OHJE = [
  'Mikroraportin valikot. Tämä taulukko on vartijoiden mikroraportin valintalistojen lähde.',
  '',
  'Paikat-välilehti: sarake A = ryhmä (esim. "Yleiset tilat ja kulkureitit"), sarake B = paikka (esim. "Aula").',
  'Otsikot-välilehti: A = laji (Havainto, Poikkeama tai Toimenpide), B = aihe, C = alue, D = otsikko.',
  '',
  'Ensimmäinen rivi on otsikkorivi, ja tyhjät rivit ohitetaan. Rivien järjestys on sama kuin vartijan listassa.',
  'Tyhjä ryhmä, aihe tai alue näkyy vartijalle nimellä "Muut". Paikka ja otsikko ovat pakollisia.',
  'Välilehtien nimiä (Paikat, Otsikot) ei saa muuttaa.',
  '',
  'Tallennettu taulukko otetaan käyttöön heti, jos siinä ei ole virheitä. Jos virheitä on,',
  'vartijoilla pysyy edellinen toimiva versio, ja virheet näkyvät GUARDin Sovellusasetuksissa rivinumeroineen.',
];

const solu = (teksti, tyyli) => `<table:table-cell${tyyli ? ` table:style-name="${tyyli}"` : ''} office:value-type="string"><text:p>${xmlTeksti(teksti)}</text:p></table:table-cell>`;
const rivi = (solut, tyyli) => `<table:table-row>${solut.map((s) => solu(s, tyyli)).join('')}</table:table-row>`;

function valilehti(nimi, leveydet, otsikot, rivit) {
  const sarakkeet = leveydet.map((l) => `<table:table-column table:style-name="${l}"/>`).join('');
  return `<table:table table:name="${xmlTeksti(nimi)}">${sarakkeet}${otsikot ? rivi(otsikot, 'otsikko') : ''}${rivit.map((r) => rivi(r)).join('')}</table:table>`;
}

export function rakennaOds(luettelo) {
  const paikat = luettelo.paikat.map((p) => [p.ryhma, p.paikka]);
  const otsikot = luettelo.tapahtumat.map((t) => [LUOKAN_NIMI[t.luokka] || t.luokka, t.aihe, t.alue, t.teksti]);
  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2"><office:automatic-styles><style:style style:name="kapea" style:family="table-column"><style:table-column-properties style:column-width="3.2cm"/></style:style><style:style style:name="keski" style:family="table-column"><style:table-column-properties style:column-width="6.5cm"/></style:style><style:style style:name="levea" style:family="table-column"><style:table-column-properties style:column-width="12cm"/></style:style><style:style style:name="ohje" style:family="table-column"><style:table-column-properties style:column-width="22cm"/></style:style><style:style style:name="otsikko" style:family="table-cell"><style:text-properties fo:font-weight="bold"/></style:style></office:automatic-styles><office:body><office:spreadsheet>${
  valilehti('Paikat', ['keski', 'keski'], ['Ryhmä', 'Paikka'], paikat)
}${valilehti('Otsikot', ['kapea', 'keski', 'keski', 'levea'], ['Laji', 'Aihe', 'Alue', 'Otsikko'], otsikot)
}${valilehti('Ohje', ['ohje'], null, OHJE.map((r) => [r]))}</office:spreadsheet></office:body></office:document-content>
`;
  const mimetype = 'application/vnd.oasis.opendocument.spreadsheet';
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
 <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${mimetype}"/>
 <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>
`;
  return zip([
    { nimi: 'mimetype', data: Buffer.from(mimetype) },
    { nimi: 'META-INF/manifest.xml', data: Buffer.from(manifest) },
    { nimi: 'content.xml', data: Buffer.from(content) },
  ]);
}

// --- Tulkinta ja tarkistus ---------------------------------------------------------------

const ilmanOtsikkoa = (rivit, ensimmainen) => {
  const i = rivit.findIndex((r) => r.length > 0);
  const onOtsikko = i >= 0 && String(rivit[i][0] || '').toLocaleLowerCase('fi') === ensimmainen;
  return rivit.map((r, n) => ({ nro: n + 1, solut: r })).filter(({ nro, solut }) => solut.length > 0 && !(onOtsikko && nro === i + 1));
};

const lajiksi = (teksti) => {
  const t = String(teksti || '').toLocaleLowerCase('fi').trim();
  return LUOKAT.find((l) => t === l || t.startsWith(`${l} `) || t.startsWith(`${l}(`)) || null;
};

// Välilehtien riveistä luettelo. Virhe estää käyttöönoton, varoitus ei: kaksoiskappale
// pudotetaan ja kerrotaan, mutta muu luettelo on silti käyttökelpoinen.
export function tulkitseLuettelo(taulukot) {
  const virheet = [];
  const varoitukset = [];
  const pituus = (arvo, paikka) => {
    if (arvo.length > MAX_PITUUS) virheet.push(`${paikka}: teksti on yli ${MAX_PITUUS} merkkiä.`);
    return arvo;
  };

  const paikkaRivit = taulukot.Paikat;
  const otsikkoRivit = taulukot.Otsikot;
  if (!paikkaRivit) virheet.push('Välilehti "Paikat" puuttuu tai sen nimi on muuttunut.');
  if (!otsikkoRivit) virheet.push('Välilehti "Otsikot" puuttuu tai sen nimi on muuttunut.');

  const paikat = [];
  const nahdytPaikat = new Set();
  for (const { nro, solut } of ilmanOtsikkoa(paikkaRivit || [], 'ryhmä')) {
    const kohta = `Paikat rivi ${nro}`;
    const ryhma = pituus(solut[0] || MUUT, kohta);
    const paikka = pituus(solut[1] || '', kohta);
    if (!paikka) { virheet.push(`${kohta}: paikka (sarake B) puuttuu.`); continue; }
    if (ryhma === OMA) { virheet.push(`${kohta}: ryhmän nimi "${OMA}" on varattu vartijoiden omille kirjauksille.`); continue; }
    const avain = `${ryhma}|${paikka}`.toLocaleLowerCase('fi');
    if (nahdytPaikat.has(avain)) { varoitukset.push(`${kohta}: "${paikka}" on jo ryhmässä "${ryhma}", toinen ohitettiin.`); continue; }
    nahdytPaikat.add(avain);
    paikat.push({ ryhma, paikka });
  }

  const tapahtumat = [];
  const nahdytOtsikot = new Set();
  for (const { nro, solut } of ilmanOtsikkoa(otsikkoRivit || [], 'laji')) {
    const kohta = `Otsikot rivi ${nro}`;
    const luokka = lajiksi(solut[0]);
    const aihe = pituus(solut[1] || MUUT, kohta);
    const alue = pituus(solut[2] || MUUT, kohta);
    const teksti = pituus(solut[3] || '', kohta);
    if (!luokka) { virheet.push(`${kohta}: laji (sarake A) on "${solut[0] || ''}", pitää olla Havainto, Poikkeama tai Toimenpide.`); continue; }
    if (!teksti) { virheet.push(`${kohta}: otsikko (sarake D) puuttuu.`); continue; }
    if (aihe === OMA) { virheet.push(`${kohta}: aiheen nimi "${OMA}" on varattu vartijoiden omille kirjauksille.`); continue; }
    const avain = `${luokka}|${teksti}`.toLocaleLowerCase('fi');
    if (nahdytOtsikot.has(avain)) { varoitukset.push(`${kohta}: otsikko "${teksti}" on jo lajissa ${LUOKAN_NIMI[luokka]}, toinen ohitettiin.`); continue; }
    nahdytOtsikot.add(avain);
    tapahtumat.push({ luokka, aihe, alue, teksti });
  }

  if (paikkaRivit && paikat.length === 0) virheet.push('Paikat-välilehdellä ei ole yhtään paikkaa.');
  if (otsikkoRivit && tapahtumat.length === 0) virheet.push('Otsikot-välilehdellä ei ole yhtään otsikkoa.');
  if (paikat.length + tapahtumat.length > MAX_RIVEJA) virheet.push(`Rivejä on yli ${MAX_RIVEJA}.`);
  for (const l of LUOKAT) {
    if (tapahtumat.length > 0 && !tapahtumat.some((t) => t.luokka === l)) {
      varoitukset.push(`Lajissa ${LUOKAN_NIMI[l]} ei ole yhtään otsikkoa: vartija voi kirjata sen vain omalla otsikolla.`);
    }
  }

  // Virheitä voi olla tuhansia, jos sarakkeet ovat siirtyneet. Kaikkien näyttäminen ei
  // auta korjaamaan, joten listat rajataan.
  const rajaa = (lista) => (lista.length > 50 ? [...lista.slice(0, 50), `… ja ${lista.length - 50} muuta.`] : lista);
  return {
    ok: virheet.length === 0,
    luettelo: { paikat, tapahtumat },
    virheet: rajaa(virheet),
    varoitukset: rajaa(varoitukset),
  };
}

// Puskurista suoraan: zip- ja XML-virheetkin palautetaan virheinä eikä poikkeuksina.
export function tulkitseOds(puskuri) {
  try {
    return tulkitseLuettelo(lueOds(puskuri));
  } catch (err) {
    return { ok: false, luettelo: { paikat: [], tapahtumat: [] }, virheet: [err.message || 'Taulukkoa ei voitu lukea.'], varoitukset: [] };
  }
}

// Selaimen lähettämä luettelo (taulukon ensimmäinen luonti) ajetaan saman tarkistuksen
// läpi kiertämällä taulukon kautta: näin luotu tiedosto on taatusti luettavissa.
export function siistiLuettelo(syote) {
  const lista = (x) => (Array.isArray(x) ? x.slice(0, MAX_RIVEJA) : []);
  const teksti = (x) => (typeof x === 'string' ? x : '');
  return {
    paikat: lista(syote?.paikat).map((p) => ({ ryhma: teksti(p?.ryhma), paikka: teksti(p?.paikka) })),
    tapahtumat: lista(syote?.tapahtumat).map((t) => ({
      luokka: LUOKAT.includes(t?.luokka) ? t.luokka : '', aihe: teksti(t?.aihe), alue: teksti(t?.alue), teksti: teksti(t?.teksti),
    })),
  };
}

// Vartijoiden omat kirjaukset ehdotuslistaksi: useimmin kirjoitetut ensin.
export function omatKirjaukset(raportit, raja = 20) {
  const mikrot = (Array.isArray(raportit) ? raportit : []).filter((r) => r?.typeId === 'guard_micro');
  const laske = (valitse) => {
    const maarat = new Map();
    for (const r of mikrot) {
      const arvo = valitse(r);
      if (!arvo) continue;
      const avain = arvo.toLocaleLowerCase('fi');
      const ennen = maarat.get(avain);
      maarat.set(avain, { teksti: ennen?.teksti || arvo, maara: (ennen?.maara || 0) + 1 });
    }
    return [...maarat.values()].sort((a, b) => b.maara - a.maara || a.teksti.localeCompare(b.teksti, 'fi')).slice(0, raja);
  };
  return {
    paikat: laske((r) => (r.microPlaceGroup === OMA ? r.microPlace : null)),
    otsikot: laske((r) => (r.microTopic === OMA && r.microClass ? `${LUOKAN_NIMI[r.microClass]}: ${r.microEvent}` : null)),
  };
}
