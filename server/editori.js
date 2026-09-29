// Dokumenttieditori (Collabora Online, 28.9.2026).
//
// Collabora ajaa LibreOfficea palvelimella ja näyttää editorin selaimessa iframessa.
// Tiedostot se hakee ja tallentaa WOPI-rajapinnan kautta: Collabora-palvelin kutsuu
// TÄTÄ backendiä (/api/wopi/files/:id) — ei selain. Siksi WOPI-kutsuissa ei ole
// istuntoevästettä, ja pääsy perustuu kertakäyttöistä istuntoa varten annettuun
// access_tokeniin.
//
// Tässä tiedostossa on vain puhdas logiikka (tokenit, tiedoston haku, oikeudet,
// WOPI-vastausten muoto, discovery-XML:n jäsennys), jotta se on testattavissa ilman
// Collaboraa. Reitit ovat index.js:ssä.

import crypto from 'node:crypto';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { canEdit, eventAllowed, legacyEventId } from './permissions.js';

// Tiedostotyypit jotka avataan Toimistoon muokattaviksi: OpenDocument-teksti (Writer),
// -taulukko (Calc, 29.9.2026) ja -esitys (Impress). Microsoftin muodot (docx, xlsx, pptx)
// avautuvat vain esikatseluun: tallennustarkistus (onKelvollinenOdf) hyväksyy vain ODF:n.
export const EDITOITAVAT = new Set(['.odt', '.ods', '.odp']);

export function onEditoitava(nimi) {
  return EDITOITAVAT.has(path.extname(String(nimi || '')).toLowerCase());
}

// Tiedostotyypit jotka voi esikatsella editorissa vain luku -tilassa. Nämä ovat ne
// sallituista latauksista (uploads.js) joita selain ei osaa näyttää itse: Word-, Excel-
// ja PowerPoint-tiedostot sekä OpenDocument. PDF, kuvat ja teksti avautuvat selaimeen suoraan
// eikä niitä kannata kierrättää Collaboran kautta.
export const ESIKATSELTAVAT = new Set([...EDITOITAVAT, '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']);

export function onEsikatseltava(nimi) {
  return ESIKATSELTAVAT.has(path.extname(String(nimi || '')).toLowerCase());
}

// WOPI-tokenin kesto. Collabora käyttää samaa tokenia koko editointi-istunnon ajan,
// myös jokaisessa tallennuksessa, joten liian lyhyt kesto katkaisisi pitkän työn
// tallennusvirheeseen. Kesto EI ole oikeuksien raja: jokainen WOPI-kutsu tarkistaa
// oikeudet uudelleen tuoreesta käyttäjätietueesta (ks. index.js), joten oikeuksien
// poisto tai tunnuksen poisto katkaisee pääsyn heti eikä vasta tokenin vanhetessa.
export const TOKEN_KESTO_MS = 8 * 60 * 60 * 1000;

// Oma allekirjoitusavain johdettuna JWT_SECRETistä. EI SAMA AVAIN kuin istunnolla:
// istuntoeväste tarkistetaan jwt.verify(token, JWT_SECRET) ilman audience-ehtoa, joten
// samalla avaimella allekirjoitettu WOPI-token kelpaisi myös istuntoevästeeksi. WOPI-
// token kulkee URL:ssä ja päätyy Collaboran ja nginxin lokeihin — sen vuotaminen ei saa
// antaa kirjautunutta istuntoa koko sovellukseen.
export function wopiAvain(jwtSecret) {
  return crypto.createHmac('sha256', String(jwtSecret)).update('turvajohto-wopi-v1').digest();
}

// muokkaus = avattiinko editori muokkaamaan vai esikatselemaan. Tieto kulkee tokenissa,
// koska Collabora kutsuu WOPI-reittejä ilman muuta kontekstia: esikatseluna avattu
// istunto ei saa tallentaa, vaikka käyttäjällä olisi muokkausoikeus.
export function luoWopiToken({ username, uploadId, muokkaus = true }, avain, nyt = Date.now()) {
  const vanhenee = nyt + TOKEN_KESTO_MS;
  const token = jwt.sign(
    {
      sub: username, tiedosto: uploadId, muokkaus: muokkaus === true, aud: 'wopi',
      iat: Math.floor(nyt / 1000), exp: Math.floor(vanhenee / 1000),
    },
    avain,
    { algorithm: 'HS256', noTimestamp: true }
  );
  // Collabora haluaa access_token_ttl:n epoch-millisekunteina (ei kestona).
  return { token, ttl: vanhenee };
}

// Palauttaa { username, muokkaus } tai null. Token on sidottu yhteen tiedostoon: saman
// tokenin käyttö toisen tiedoston osoitteessa hylätään.
export function tarkistaWopiToken(token, uploadId, avain) {
  if (!token || !uploadId) return null;
  try {
    const p = jwt.verify(String(token), avain, { algorithms: ['HS256'], audience: 'wopi' });
    if (p.tiedosto !== uploadId || typeof p.sub !== 'string') return null;
    return { username: p.sub, muokkaus: p.muokkaus === true };
  } catch {
    return null;
  }
}

// Onko tallennettava sisältö OpenDocument-paketti. PutFile hyväksyy muuten mitä tahansa
// tavuja, ja WOPI-tokenin haltija (esim. muokkauslinkin saaja) voisi korvata dokumentin
// millä tahansa tiedostolla — vaikkapa haittaohjelmalla, joka jakautuu eteenpäin
// alkuperäisen nimellä. ODF-määrittely vaatii että zip-paketin ensimmäinen tiedosto on
// pakkaamaton "mimetype", joten tarkistus on tavuvertailu kiinteistä kohdista eikä vaadi
// zip-jäsennintä. Collabora kirjoittaa ODF:n aina tässä muodossa.
const ODF_MIME = {
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
};
export function onKelvollinenOdf(buffer, nimi) {
  const odotettu = ODF_MIME[path.extname(String(nimi || '')).toLowerCase()];
  if (!odotettu || !Buffer.isBuffer(buffer) || buffer.length < 38 + odotettu.length) return false;
  if (buffer.readUInt32LE(0) !== 0x04034b50) return false; // paikallisen tiedoston otsake
  if (buffer.readUInt16LE(8) !== 0) return false; // tallennusmenetelmä: pakkaamaton
  const nimenPituus = buffer.readUInt16LE(26);
  const lisaPituus = buffer.readUInt16LE(28);
  if (buffer.toString('latin1', 30, 30 + nimenPituus) !== 'mimetype') return false;
  const alku = 30 + nimenPituus + lisaPituus;
  return buffer.toString('latin1', alku, alku + odotettu.length) === odotettu;
}

// --- Jakolinkin kautta avattu editori (28.9.2026) ---
//
// Jakolinkin avaaja ei ole kirjautunut, joten WOPI-token sidotaan jakoon eikä
// käyttäjään: sub = 'jako:<jaon id>'. WOPI-portti (index.js) tunnistaa etuliitteen
// ENNEN käyttäjärekisterin hakua, joten jakotokenia ei voi koskaan tulkita käyttäjäksi.
export const JAKO_ETULIITE = 'jako:';

export const jakoTunniste = (shareId) => `${JAKO_ETULIITE}${shareId}`;

export function jaonIdTunnisteesta(sub) {
  return typeof sub === 'string' && sub.startsWith(JAKO_ETULIITE) ? sub.slice(JAKO_ETULIITE.length) : null;
}

// Mitä jaon saaja saa tehdä editorissa. Vanhoilla jaoilla kenttää ei ole: ne ovat
// katselujakoja, koska esikatselu ei anna mitään mitä lataus ei jo antaisi.
export function jaonEditoriTila(share) {
  return share?.editori === 'muokkaus' ? 'muokkaus' : 'katselu';
}

// Onko jako yhä voimassa jo avatulle editori-istunnolle. EI sama kuin jaonTila
// (shares.js): latausraja jätetään tässä huomiotta, koska editorin avaus lasketaan
// yhdeksi lataukseksi — muuten juuri rajan täyttänyt avaus katkaisisi oman istuntonsa
// heti seuraavassa WOPI-kutsussa. Peruutus, hylkäys ja vanheneminen katkaisevat heti.
export function jakoVoimassaEditorissa(share, nyt = new Date()) {
  if (!share || share.revokedAt || share.approvalStatus === 'rejected') return false;
  if (share.expiresAt && new Date(share.expiresAt) <= nyt) return false;
  return true;
}

// Mistä kokoelmasta tiedosto löytyy. Editori avautuu vain tiedostolistojen tiedostoille
// (tapahtuman tiedostot, kohteen tiedostot) — ei raporttien liitteille, pohjakartoille
// tai muille uploads-hakemiston tiedostoille, joilla on oma omistajansa ja oma
// muokkauspolkunsa.
export function etsiTiedosto(uploadId, eventFiles = [], guardFiles = [], personalFiles = []) {
  if (!uploadId) return null;
  const e = (Array.isArray(eventFiles) ? eventFiles : []).find((f) => f?.type !== 'folder' && f?.uploadId === uploadId);
  if (e) return { lahde: 'eventFiles', tietue: e, kohdeId: legacyEventId(e) };
  const g = (Array.isArray(guardFiles) ? guardFiles : []).find((f) => f?.uploadId === uploadId);
  if (g) return { lahde: 'guardFiles', tietue: g, kohdeId: g.siteId ?? null };
  // Henkilökohtainen tiedosto (29.9.2026): kohdeId on omistajan käyttäjätunnus.
  const p = (Array.isArray(personalFiles) ? personalFiles : []).find((f) => f?.type === 'file' && f?.uploadId === uploadId);
  if (p) return { lahde: 'personalFiles', tietue: p, kohdeId: p.omistaja ?? null };
  return null;
}

// Saako käyttäjä TALLENTAA tiedostoon. Sama raja kuin tiedoston poistolla ja
// uudelleennimeämisellä omassa listassaan: kokoelman muokkausoikeus kyseisessä
// tapahtumassa tai kohteessa. Pelkkä lukuoikeus (tai nimetty jako) avaa editorin
// vain luku -tilaan.
export function saaKirjoittaa(kayttaja, loyto) {
  if (!kayttaja || !loyto) return false;
  if (kayttaja.role === 'admin') return true;
  const { permissions, eventAccess } = kayttaja;
  if (loyto.lahde === 'eventFiles') {
    if (!eventAllowed(eventAccess, loyto.kohdeId)) return false;
    return canEdit(permissions, loyto.kohdeId, 'eventfiles');
  }
  if (loyto.lahde === 'guardFiles') {
    if (!(kayttaja.tuotteet || []).includes('guard')) return false;
    if (!eventAllowed(eventAccess, loyto.kohdeId)) return false;
    return canEdit(permissions, loyto.kohdeId, 'guard_sites');
  }
  // Omaa tiedostoa muokkaa vain omistaja (muut nimetyn muokkausjaon kautta).
  if (loyto.lahde === 'personalFiles') return !!kayttaja.username && kayttaja.username === loyto.kohdeId;
  return false;
}

// Käyttäjätunnus ei saa näkyä Collaboralle sellaisenaan UserId-kenttänä (se näkyy
// esim. muiden samanaikaisten muokkaajien listassa ja Collaboran lokeissa). Tiiviste on
// pysyvä, joten Collabora tunnistaa saman käyttäjän kahdessa ikkunassa.
export function kayttajanWopiId(username, avain) {
  return crypto.createHmac('sha256', avain).update(`kayttaja:${username}`).digest('hex').slice(0, 24);
}

// Tiedoston versio = muokkausaika millisekunteina. Collabora lähettää sen takaisin
// tallennuksessa (X-COOL-WOPI-Timestamp), ja eroava arvo tarkoittaa että tiedostoa on
// muutettu toista reittiä sillä välin.
export function versio(stat) {
  return new Date(stat.mtimeMs).toISOString();
}

export function checkFileInfo({ loyto, stat, kayttaja, nimimerkki, kirjoitus, avain, origin }) {
  return {
    BaseFileName: loyto.tietue.name || 'dokumentti',
    Size: stat.size,
    Version: versio(stat),
    LastModifiedTime: versio(stat),
    OwnerId: 'turvajohto',
    UserId: kayttajanWopiId(kayttaja.username, avain),
    UserFriendlyName: nimimerkki || kayttaja.username,
    UserCanWrite: kirjoitus,
    ReadOnly: !kirjoitus,
    // "Tallenna nimellä" loisi uuden tiedoston jolle ei ole tietuetta missään
    // kokoelmassa — se jäisi orvoksi ja roskienkeruu poistaisi sen. Pois käytöstä.
    UserCanNotWriteRelative: true,
    UserCanRename: false,
    SupportsRename: false,
    SupportsUpdate: true,
    SupportsLocks: false,
    // Etäkuvien lisäys saisi Collabora-palvelimen hakemaan mielivaltaisia osoitteita.
    EnableInsertRemoteImage: false,
    // Sulje-painikkeen ja muiden viestien postMessage-kohde (iframen isäntäsivu).
    PostMessageOrigin: origin,
  };
}

// Collaboran /hosting/discovery -XML:stä editorin osoite päätteelle. Jäsennetään
// säännöllisellä lausekkeella eikä XML-kirjastolla: rakenne on yksinkertainen ja
// vakio (<action ext="odt" name="edit" urlsrc="..."/>), eikä pelkän tämän takia
// kannata ottaa uutta riippuvuutta.
export function jasennaDiscovery(xml) {
  const tulos = {};
  const re = /<action\b([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(String(xml || '')))) {
    const attrs = {};
    for (const a of m[1].matchAll(/(\w+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    if (!attrs.ext || !attrs.urlsrc) continue;
    const ext = attrs.ext.toLowerCase();
    tulos[ext] ??= {};
    // edit voittaa view:n: sama urlsrc avaa vain luku -tilan kun UserCanWrite = false.
    if (attrs.name === 'edit' || !tulos[ext].urlsrc) tulos[ext].urlsrc = attrs.urlsrc.replace(/&amp;/g, '&');
  }
  return tulos;
}

// Editorin osoite iframelle. urlsrc päättyy yleensä '?':een, mutta voi sisältää
// valmiiksi parametreja (<ui=UI_LLCC&> jne.) — ne pudotetaan pois, koska ne ovat
// paikanpitäjiä eivätkä kelpaa sellaisenaan.
export function editorinOsoite(urlsrc, wopiSrc, { kieli = 'fi' } = {}) {
  const pohja = String(urlsrc).replace(/<[^>]*>/g, '').replace(/[?&]+$/, '');
  const erotin = pohja.includes('?') ? '&' : '?';
  return `${pohja}${erotin}WOPISrc=${encodeURIComponent(wopiSrc)}&lang=${kieli}&closebutton=1`;
}
