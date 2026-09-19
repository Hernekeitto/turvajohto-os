import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { parseCookie, stringifySetCookie } from 'cookie';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import {
  findUser,
  listUsers,
  upsertUser,
  updateUser,
  updatePassword,
  setMustChangePassword,
  recordLogin,
  getTotpSecret,
  resetTotpSecret,
  setTotpRequired,
  forceLogout,
} from './db.js';
import { readCollection, writeCollection, KNOWN_COLLECTIONS, getStorageUsage } from './store.js';
import { isAllowedFile, saveUpload, getUploadPath, deleteUpload, collectGarbage } from './uploads.js';
import { verifyTotp, buildOtpauthUri } from './totp.js';
import { istunnonKesto, SOVELLUS_VUOROKAUDET } from './istunto.js';
import {
  KOODI_VOIMASSA_MS, LAITTEITA_TUNNUSTA_KOHDEN,
  kelpaakoKoodi, laitteenTietue, lueAvain, luoKoodi, luoNonceMuisti, tarkistaAllekirjoitus,
  luoLyontimuisti, tarvitaankoLyonninTallennus, valvonnanTila,
} from './laite.js';
import {
  JOUSTO_MIN, aloitaVuoro, keskenOlevaVuoro, kohteetPerehdytyksenMukaan, lisaaVuoroon,
  paataVuoro, vuorovaihtoehdot, vuoronPaattymisaika,
} from './vuorot.js';
import {
  kuuluuKiinteaanKanavaan, omatKiinteatKanavat, onOsallistuja, loydaDm, luoDmKanava,
  vuorossaOlevatMuut, hataKanavaId, luoHataKanava, hataKanavaPurkautunut, onHalyttaja,
  pakotaLinjaAuki, vapautaLinjanPakotus, luoVapaaKanava, jasenetKiinteallaKanavalla,
} from './kanavat.js';
import { paivitaAvainpaketti, vaadiKertakayttoavain, julkinenKuvaus } from './kryptoavaimet.js';
import { luoLaiteviesti, laitteenViestit, poistaLaitteenViestit } from './laiteviestit.js';
import { luoViesti, kanavanViestit } from './viestit.js';
import { luoKuittaus, onKuitattu, viestinKuittaukset, sallitutKuittaustyypit } from './kuittaukset.js';
import { tallennaSalattuLiite, haeSalatunLiitteenPolku } from './salatutliitteet.js';
import {
  nykyinenHaltija, pyydaPuheenvuoro, vapautaIstunnolta, vapautaPuheenvuoro,
} from './puheenvuoro.js';
import {
  joSiirrossa, kiinnitaVuoroon, kuittaaPakotus, kuittaamattomatPakotukset, luoSiirto,
  merkitseValmiiksi as merkitseSiirtoValmiiksi,
  kuuluuVuoroon, omatSiirrot, peruSiirto, rauetaVuoronMukana, siirtojenAvaamatKohteet,
  vastaaSiirtoon,
} from './siirto.js';
import {
  AVOIMET_TILAT,
  kieltaydy, lahetaRaportti, lisaaHavainto, luoTehtava, merkitseVaihe, nakeeTehtavan,
  omatToiminnot, peruTehtava, ratkaiseHyvaksynta, vastaanota,
} from './halytystehtava.js';
import { vuoronKooste } from './kooste.js';
import { listRoles, findRole, createRole, updateRole, deleteRole, rolePermissions, ROLE_ADMIN } from './roles.js';
import {
  luoToken,
  tokenTasmaa,
  ratkaiseVoimassaolo,
  jaonTila,
  TILAN_SELITE,
  hashaaSalasana,
  salasanaTasmaa,
  kuuluuJakoon,
  julkinenJako,
} from './shares.js';
import {
  COLLECTION_NAMES,
  collectionTuote,
  readableData,
  authorizeWrite,
  canReadAttachment,
  // GUARD-liitteen lukutarkistus. Tämä puuttui tuonnista, ja koska sitä kutsutaan
  // vasta tapahtumapuolen tarkistuksen jälkeen (&&), pääkäyttäjä ei koskaan päätynyt
  // riville — hänellä canReadAttachment palauttaa aina true. Vika näkyi vain
  // ei-pääkäyttäjälle ja vain GUARD-liitteessä: pohjakartta, kohteen tiedosto tai
  // raportin kuva vastasi 500:lla.
  canReadGuardAttachment,
  canUploadAttachment,
  canEdit,
  canView,
  eventAllowed,
} from './permissions.js';
import { liitaKanava, laheta as lahetaKanavalle, lahetaViesti } from './kanava.js';
import {
  seurantaKaytossa, paivita as paivitaSijainti, kaikki as sijainnit,
  hae as haeSijainti, unohda as unohdaSijainti,
  saaNahdaSijainteja, saaNahdaSijaintirivin, kirjataankoKatselu,
} from './sijainti.js';
import { taydennaKuvakoordinaatti } from './georeferointi.js';
import {
  kirjaa as kirjaaHistoriaan, lue as lueHistoria, siivoa as siivoaSijaintiloki,
  harvenna as harvennaJalki, SAILYTYS_VRK as SIJAINTI_SAILYTYS_VRK,
} from './sijaintiloki.js';
import {
  saaNahdaHistorian, suodataPisteet, tarkistaIkkuna, tarkistaSyy, tehtavanJalki,
  tehtavavaihtoehdot, vartijavaihtoehdot,
} from './sijaintihistoria.js';
import {
  tarkistaIlmoitus,
  lomakkeenTila,
  // saaLahettaa on jo varattu hätäviestien oikeustarkistukselle tässä tiedostossa,
  // joten julkisen ilmoituksen määrärajoitus tuodaan omalla nimellään.
  saaLahettaa as saaLahettaaIlmoituksen,
  TILAN_SELITE as JULKINEN_SELITE,
  julkinenLomake,
  luoIlmoitusToken,
  // Kummallakin moduulilla on oma voimassaolosääntönsä eikä niitä saa sekoittaa:
  // jakolinkin ratkaiseVoimassaolo tuntee salasanat ja pääkäyttäjän hyväksynnän,
  // julisteen ei tunne kumpaakaan mutta sillä on kova 180 vrk:n katto.
  ratkaiseVoimassaolo as ratkaiseJulisteenVoimassaolo,
} from './julkinen.js';
import {
  onTunnettuLaji, tarkistaNimi, puhdistaKuvaus, tarkistaPisteet, tarkistaGps,
  sisaltoMuuttui, julkinenPohja, etsiPisteKoodilla, kaytetytViivakoodit,
  tarkistaKohdat, lajinSolmu, LAJIT,
} from './pohjat.js';
import { aloitaKierros, kuittaaPiste, paataKierros, etaisyysMetreina, OLETUS_SIETORAJA_M } from './kierros.js';
import { aloitaSuoritus, kuittaaKohta, paataSuoritus } from './suoritus.js';
import { luoTiedote, kuittaa as kuittaaTiedote, peru as peruTiedote, onVoimassa, kuittaamatta } from './broadcast.js';
import {
  luoAvain, luovuta, palauta, merkitseKadonneeksi, merkitseLoytyneeksi, poistaKaytosta,
} from './avaimet.js';
import {
  luoPoikkeama, kasittele as kasittelePoikkeama, eskaloituu, halytyksenKuvaus,
} from './varusteet.js';
// Nimiavaruutena eikä nimettyinä tuonteina: kalusto.js vie nimet LAJIT,
// merkitseKadonneeksi ja poistaKaytosta, jotka kaikki ovat jo varattuja tässä
// tiedostossa (pohjat.js ja avaimet.js). Aliasointi rivi riviltä olisi luettavampi
// vain siihen asti kunnes joku lisää seuraavan törmäyksen.
import * as kalusto from './kalusto.js';
import { teeIkkuna, kooste as laskeKooste } from './analytiikka.js';
import { loydaSamaKirjaus, seuraavaVapaaTunniste } from './kirjaukset.js';
import {
  luoJalkiraportti, paivita as paivitaJalkiraportti, merkitseValmiiksi, avaaUudelleen,
  onLukittu as jalkiraporttiLukittu,
} from './jalkiraportti.js';
import {
  luoAjastin, luoHalytys, jatka as jatkaHalytysta, laukaise as laukaiseHalytys,
  peru as peruHalytys, kuittaa as kuittaaHalytys, eraantyneet, eskaloitavat,
  merkitseEskaloitu, viestiTeksti, TYYPIT as HALYTYSTYYPIT, mandownAsetukset,
  kuittausAsetukset, KUITTAUS_VASTAUSAIKA_MIN, merkinta,
  siivoaVyohykeSijainnit, GEOFENCE_SAILYTYS_VRK, TARKISTUSTA_VAATIVAT,
} from './halytys.js';
import { arvioi as arvioiVyohykkeet } from './geofence.js';
import { onkoKonfiguroitu, haeSaldo, lahetaViestit, laskeViesti, parsiJson } from './bulksms.js';
import { kaytossaOlevatNapit, ratkaiseVastaanottajat, taytaPaikkamerkit, halytysVastaanottajat } from './sms.js';
import { lisaaJonoon, otaKasittelyyn, kuittaaKasitellyksi, jononPituus } from './smsqueue.js';
import { salaisuusTasmaa, tulkitseTapahtuma, soveltaTilaraportit, soveltaVastaukset } from './smswebhook.js';
import { logAudit, readAuditLog } from './audit.js';
import { validateRecords, wouldWipeNonEmptyCollection } from './validation.js';

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'tj_session';
// Istunnon kesto ja sen kolme tapausta ovat istunto.js:ssä, perusteluineen:
// asennetussa sovelluksessa istuntoa EI rajoiteta, selaimessa pääkäyttäjä saa
// kiinteän 12 tunnin ja muu käyttäjä liukuvan tunnin — liukuva tarkoittaa, että
// jokainen kirjautunut pyyntö (requireAuth) pidentää evästettä uudelleen tunnilla
// eteenpäin, joten aktiivikäyttö ei katkea mutta tunnin joutokäynti kirjaa ulos.

// Vähintään 64 merkkiä — sama pituusvaatimus kuin DATA_ENCRYPTION_KEY:llä ja
// TOTP_ENCRYPTION_KEY:llä (fieldcrypto.js, totp.js). Toisin kuin ne, tätä ei pureta
// tavuiksi (jwt.sign/verify käyttää merkkijonoa sellaisenaan HMAC-avaimena), joten
// muotoa ei rajoiteta heksaan — vain pituutta, koska se on se mikä ratkaisee
// murtamisen työmäärän. Ilman tätä lyhyt tai arvattava JWT_SECRET tekisi KENEN
// TAHANSA käyttäjän (myös adminin) istuntoevästeen väärennettävissä offline-
// murrolla, mikä ohittaisi sekä salasanan että TOTP:n kokonaan.
if (!JWT_SECRET || JWT_SECRET.length < 64) {
  console.error('JWT_SECRET puuttuu tai on liian lyhyt (vähintään 64 merkkiä) ympäristömuuttujista. Palvelinta ei käynnistetä.');
  process.exit(1);
}

// Varmistaa käynnistyksessä ettei store.js:ään voi jäädä lisätä kokoelma jolle
// permissions.js:stä puuttuu oikeussäännöt — muuten uusi kokoelma päätyisi vahingossa
// suojaamattomaksi (sama virhe kuin tämän tarkistuksen alkuperäinen puuttuminen).
{
  const missingRules = KNOWN_COLLECTIONS.filter((name) => !COLLECTION_NAMES.includes(name));
  if (missingRules.length > 0) {
    console.error(`permissions.js: puuttuvat oikeussäännöt kokoelmille: ${missingRules.join(', ')}. Palvelinta ei käynnistetä.`);
    process.exit(1);
  }
}

const app = express();
app.set('trust proxy', 1); // nginx on edessä
// Ei syytä kertoa hyökkääjälle mitä kehystä palvelin ajaa. nginx ei suodata tätä
// erikseen, joten poisto on tehtävä täällä eikä oletettava tuotannon konfiguraatiota.
app.disable('x-powered-by');
app.use(express.json({
  limit: '5mb',
  // Webhook-kuorman raakateksti talteen: BulkSMS:n viesti-id:t ovat niin suuria että
  // tavallinen JSON.parse pyöristää ne (ks. bulksms.js: parsiJson). Kuorma jäsennetään
  // reitillä uudelleen raakatekstistä. Rajaus polkuun pitää muistinkäytön ennallaan
  // kaikilla muilla reiteillä, joilla tätä ei tarvita.
  verify: (req, res, buf) => {
    if (req.url && req.url.startsWith('/api/webhooks/')) req.rawBody = buf.toString('utf8');
    // Sidotun laitteen pyyntö allekirjoitetaan runkoineen (laite.js: kanoninenViesti).
    // Tarkistus on tehtävä TÄSMÄLLEEN siitä tavujonosta jonka laite allekirjoitti:
    // JSON.parse ja uudelleenserialisointi voisivat muuttaa välilyöntejä, kenttien
    // järjestystä tai lukujen esitystä, ja allekirjoitus hajoaisi näkymättömästä syystä.
    if (req.headers && req.headers['x-turvajohto-allekirjoitus']) {
      req.rawBody = buf.toString('utf8');
    }
  },
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB / tiedosto
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liian monta tiedostolähetystä. Yritä myöhemmin uudelleen.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liian monta yritystä. Yritä myöhemmin uudelleen.' },
});

// Sama sääntö kuin frontin salasanavalidoinnissa (App.tsx) — backend on todellinen portti,
// frontin tarkistus on vain välitöntä käyttäjäpalautetta varten.
// Pääkäyttäjän luoma salasana arvotaan palvelimella eikä sitä koskaan kirjoiteta
// selaimessa: se annetaan käyttäjälle kertaalleen ja vaihdetaan heti ensimmäisellä
// kirjautumisella (must_change_password). Merkistöstä on jätetty pois helposti
// sekoittuvat 0/O ja 1/l/I, koska salasana luetaan usein ruudulta paperille.
const SALASANA_ISOT = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const SALASANA_PIENET = 'abcdefghijkmnopqrstuvwxyz';
const SALASANA_NUMEROT = '23456789';

function arvoSalasana(pituus = 14) {
  const kaikki = SALASANA_ISOT + SALASANA_PIENET + SALASANA_NUMEROT;
  // Vähintään yksi kustakin ryhmästä, jotta arvottu salasana läpäisee aina
  // isValidPassword-tarkistuksen — muuten luonti voisi satunnaisesti epäonnistua.
  const pakolliset = [
    SALASANA_ISOT[crypto.randomInt(SALASANA_ISOT.length)],
    SALASANA_PIENET[crypto.randomInt(SALASANA_PIENET.length)],
    SALASANA_NUMEROT[crypto.randomInt(SALASANA_NUMEROT.length)],
  ];
  const loput = Array.from({ length: Math.max(0, pituus - pakolliset.length) },
    () => kaikki[crypto.randomInt(kaikki.length)]);
  const merkit = [...pakolliset, ...loput];
  // Fisher-Yates satunnaisella indeksillä: ilman sekoitusta pakolliset merkit
  // olisivat aina kolmessa ensimmäisessä paikassa.
  for (let i = merkit.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [merkit[i], merkit[j]] = [merkit[j], merkit[i]];
  }
  return merkit.join('');
}

function isValidPassword(pw) {
  return typeof pw === 'string' && pw.length >= 10 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
}

// Kiinteä bcrypt-tiiviste jota vasten verrataan kun käyttäjätunnusta ei löydy.
// Ilman tätä bcrypt.compareSync jäisi kokonaan ajamatta olemattomalle tunnukselle,
// ja se ajoero (bcrypt cost 12 vs. ei mitään) paljastaisi mitattavasti kumpi tapaus
// oli kyseessä — pieni mutta tarpeeton käyttäjätunnusten luettelointireitti. Laskettu
// kertaalleen käynnistyksessä (ei per pyyntö): bcrypt on tarkoituksella hidas.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('ei-oikea-kayttaja-vakioaikaista-vertailua-varten', 12);

// `sovellus` = istunto on avattu asennetusta sovelluksesta (ks. istunto.js). Tieto
// leivotaan tokeniin, jotta istunnon kesto päätetään KIRJAUTUMISHETKELLÄ eikä
// jokaisessa pyynnössä erikseen: muuten sama eväste voisi vaihtaa pituuttaan sen
// mukaan kummasta — sovelluksesta vai selaimesta — viimeisin pyyntö tuli, ja
// selaimessa käynti lyhentäisi kentällä olevan vartijan istunnon.
function setSessionCookie(res, username, role, sovellus = false) {
  const maxAgeSeconds = istunnonKesto({ role, sovellus });
  const token = jwt.sign({ sub: username, sovellus: sovellus || undefined }, JWT_SECRET, {
    expiresIn: maxAgeSeconds,
  });
  res.setHeader(
    'Set-Cookie',
    stringifySetCookie({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
    })
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    stringifySetCookie({
      name: COOKIE_NAME, value: '', httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
    })
  );
}

// Evästeen token tarkistettuna, tai null. Erillinen funktio, koska istunnosta
// tarvitaan kahta asiaa: käyttäjätunnus ja tieto siitä avattiinko istunto
// sovelluksesta (istunnon uusiminen tarvitsee saman keston kuin kirjautuminen antoi).
function lueIstuntoToken(req) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Onko nykyinen istunto avattu asennetusta sovelluksesta. Luetaan ALLEKIRJOITETUSTA
// tokenista eikä pyynnön otsakkeista: selain ei voi vaihtaa istunnon pituutta
// kirjautumisen jälkeen.
function onSovellusIstunto(req) {
  return lueIstuntoToken(req)?.sovellus === true;
}

// Nähdyt noncet aikaikkunan ajan. Muistissa eikä levyllä — ks. laite.js:n perustelu.
const nonceMuisti = luoNonceMuisti();

// Viimeisimmät sydämenlyönnit laitteittain. Tarkka mutta katoaa uudelleenkäynnistyksessä;
// levylle kirjoitetaan harvakseltaan. Perustelu kummallekin säilölle on laite.js:ssä.
const lyontimuisti = luoLyontimuisti();

// Merkintä siitä että laite on hengissä juuri nyt.
//
// Kutsutaan JOKAISESTA kelvollisesta allekirjoitetusta pyynnöstä eikä vain
// sydämenlyönnistä: mikä tahansa laitteen tekemä pyyntö on yhtä pätevä todiste siitä että
// sovellus on käynnissä, eikä todistetta kannata rajata yhteen reittiin.
function merkitseLyonti(laite, nyt = Date.now()) {
  lyontimuisti.merkitse(laite.id, nyt);
  if (!tarvitaankoLyonninTallennus(laite, nyt)) return;

  // Levylle kirjoitetaan uudelleen luettu tietue eikä pyynnön alussa luettu: hälytyskeskus
  // on voinut sillä välin nollata sidonnan, ja vanhan kopion kirjoittaminen palauttaisi
  // nollatun laitteen takaisin kokoelmaan.
  const laitteet = readCollection('devices') || [];
  const kohta = laitteet.findIndex((l) => l.id === laite.id);
  if (kohta < 0) return;
  laitteet[kohta] = {
    ...laitteet[kohta],
    viimeinenLyonti: new Date(nyt).toISOString(),
    viimeinenLyontiMs: nyt,
  };
  writeCollection('devices', laitteet);
}

// Sidotun laitteen tunnistus allekirjoituksesta.
//
// EI EVÄSTETTÄ EIKÄ TOKENIA. Laitteella ei ole levyllä mitään salaista: se allekirjoittaa
// jokaisen pyynnön Keystoressa olevalla avaimellaan, ja tässä tarkistetaan että
// allekirjoitus täsmää tallennettuun julkiseen avaimeen. Ks. laite.js.
//
// Tulos välimuistitetaan pyyntöön, ja se on VÄLTTÄMÄTÖNTÄ eikä optimointi: nonce
// merkitään nähdyksi onnistuneen tarkistuksen jälkeen, joten toinen kutsu samassa
// pyynnössä hylkäisi oman pyyntönsä toistona.
function laiteIstunto(req) {
  if (req._laite !== undefined) return req._laite;
  req._laite = null;

  const laiteId = req.headers?.['x-turvajohto-laite'];
  const allekirjoitus = req.headers?.['x-turvajohto-allekirjoitus'];
  const nonce = req.headers?.['x-turvajohto-nonce'];
  if (!laiteId || !allekirjoitus) return null;

  const laite = (readCollection('devices') || []).find((l) => l.id === laiteId) || null;
  const user = laite ? findUser(laite.kayttaja) : null;
  if (!user) return null;

  const tulos = tarkistaAllekirjoitus({
    laite,
    metodi: req.method,
    // Sama polku kuin laite allekirjoitti, kyselymerkkijono mukaan lukien. `originalUrl`
    // Expressissä, `url` kanavan kättelyssä — kanava ei kulje Expressin läpi.
    polku: req.originalUrl || req.url,
    aika: req.headers['x-turvajohto-aika'],
    nonce,
    allekirjoitus,
    runko: req.rawBody || '',
    mitatoityMs: user.session_invalidated_at || null,
    ylarajaMs: SOVELLUS_VUOROKAUDET * 24 * 60 * 60 * 1000,
    onkoNahty: (n) => nonceMuisti.onkoNahty(n),
  });

  if (!tulos.ok) {
    // Hylätty allekirjoitus on tietoturvatapahtuma eikä tavallinen 401: se tarkoittaa
    // joko rikkinäistä laitetta tai yritystä esiintyä sellaisena. Syy talteen, jotta
    // "miksi vartijan puhelin ei pääse sisään" on selvitettävissä jälkikäteen.
    logAudit({ user: laite.kayttaja, action: 'laite_hylatty', laite: laite.id, syy: tulos.syy, ip: req.ip });
    return null;
  }

  nonceMuisti.merkitse(String(nonce));
  merkitseLyonti(laite);
  req._laite = laite;
  return laite;
}

function getSessionUser(req) {
  const payload = lueIstuntoToken(req);
  // Ei evästettä: pyyntö voi silti olla sidotulta laitteelta. Sovellus ei saa evästettä
  // koskaan, koska se ei kirjaudu itse — sen pääsy on sidonta ja allekirjoitus.
  if (!payload) {
    const laite = laiteIstunto(req);
    return laite ? laite.kayttaja : null;
  }
  const user = findUser(payload.sub);
  if (!user) return null;
  // Admin on painanut "Kirjaa käyttäjä ulos" -painiketta — kaikki ennen sitä hetkeä
  // myönnetyt evästeet (myös vielä muuten voimassa olevat) mitätöityvät välittömästi,
  // eikä uutta evästettä tietenkään anneta ennen kuin käyttäjä kirjautuu uudelleen.
  if (user.session_invalidated_at && payload.iat * 1000 < user.session_invalidated_at) {
    return null;
  }
  return payload.sub;
}

// Kirjautuminen kahdessa vaiheessa ei-admin-käyttäjille: käyttäjätunnus+salasana
// riittävät admin-tilille (ei koskaan vaadi TOTP:tä), mutta muille tarvitaan lisäksi
// voimassa oleva 6-numeroinen Authenticator-koodi. Toteutettu yhtenä tilattomana
// reittinä — jos totpCode puuttuu (tai on väärä), vastataan requiresTotp:true eikä
// evästettä aseteta; frontend näyttää silloin koodikentän ja lähettää saman
// käyttäjätunnuksen+salasanan uudelleen koodin kera.
//
// Kirjautumisyritykset lokitetaan audit-lokiin (onnistuneet ja epäonnistuneet) —
// tietoturvamielessä oleellinen tieto, ja rate limiter (10/15min/IP) pitää lokin
// koon kurissa vaikka joku yrittäisi arvata salasanoja.
app.post('/api/login', loginLimiter, (req, res) => {
  const { username, password, totpCode, sovellus } = req.body || {};
  // Selain kertoo onko se asennettu sovellus (src/shared/asennettu.ts). Vain
  // täsmällinen true kelpaa: puuttuva, merkkijono tai muu totuudenmukainen arvo
  // tarkoittaa selainta, koska rajoittamaton istunto ei saa syntyä vahingossa.
  const sovelluksesta = sovellus === true;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'Käyttäjätunnus ja salasana vaaditaan.' });
  }

  const user = findUser(username);
  // bcrypt.compareSync ajetaan AINA, myös olemattomalle tunnukselle (DUMMY_PASSWORD_HASH
  // vasten) — muuten olemattoman ja väärän salasanan tapaukset erottaisi ajoituksesta.
  const valid = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_PASSWORD_HASH) && !!user;

  if (!valid) {
    logAudit({ user: username, action: 'login_failed', reason: 'bad_credentials', ip: req.ip });
    return res.status(401).json({ ok: false, error: 'Väärä käyttäjätunnus tai salasana.' });
  }

  if (user.role !== 'admin' && user.totp_required !== false) {
    if (!totpCode) {
      return res.json({ ok: true, requiresTotp: true, username: user.username });
    }
    if (!verifyTotp(user.totp_secret, totpCode)) {
      logAudit({ user: username, action: 'login_failed', reason: 'bad_totp', ip: req.ip });
      return res.status(401).json({ ok: false, requiresTotp: true, error: 'Väärä tai vanhentunut Authenticator-koodi.' });
    }
  }

  // Istunnon laji lokiin: rajoittamaton istunto on tieto joka pitää voida jälkikäteen
  // selvittää ("miksi tämä tunnus oli yhä kirjautuneena"), eikä sitä näe mistään
  // muualta kuin tästä.
  logAudit({
    user: username,
    action: 'login_success',
    istunto: sovelluksesta ? 'sovellus' : 'selain',
    ip: req.ip,
  });
  recordLogin(user.username);
  setSessionCookie(res, user.username, user.role, sovelluksesta);
  // mustChangePassword kertoo frontille että istunto on käytettävissä vasta kun
  // käyttäjä on vaihtanut pääkäyttäjän asettaman väliaikaisen salasanan omakseen.
  res.json({ ok: true, username: user.username, mustChangePassword: !!user.must_change_password });
});

app.post('/api/logout', (req, res) => {
  // Uloskirjautuminen unohtaa sijainnin. Tämä on GDPR 25 artiklan tekninen minimointi
  // käytännössä, ja samalla vastaus siihen kysymykseen jonka jokainen työntekijä esittää:
  // vapaa-ajalla ei seurata, koska tietoa ei silloin ole olemassa.
  const username = getSessionUser(req);
  if (username) unohdaSijainti(username);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  const username = getSessionUser(req);
  if (!username) return res.json({ authenticated: false, username: null });
  // Käyttäjän profiili (nimimerkki, rooli, sivukartta-oikeudet) luetaan aina tuoreena
  // levyltä eikä JWT:hen leivottuna, jotta admin voi muuttaa oikeuksia ilman että
  // käyttäjän pitää kirjautua uudelleen — muutos näkyy seuraavalla sivunlatauksella.
  const user = findUser(username);
  if (!user) return res.json({ authenticated: false, username: null });
  // Frontin käyttämättömyysvahti kutsuu tätä reittiä aina kun se havaitsee aktiivisuutta
  // (hiiri/näppäimistö) — tämä pitää ei-adminin liukuvan istunnon voimassa niin kauan
  // kuin sovellusta oikeasti käytetään. Uusinta saa SAMAN keston kuin kirjautuminen
  // antoi, ks. setSessionCookie.
  if (user.role !== 'admin' && !laiteIstunto(req)) {
    setSessionCookie(res, user.username, user.role, onSovellusIstunto(req));
  }
  res.json({
    authenticated: true,
    username: user.username,
    nickname: user.nickname,
    // Pysyvä tunnistenumero (#1000 ->). Frontti liittää sen raporttien kirjaajatietoon
    // tapahtumakohtaisen nimimerkin perään, esim. "Ensiapu 1 #1028".
    displayId: user.displayId || null,
    employeeId: user.employeeId || null,
    mustChangePassword: !!user.must_change_password,
    role: user.role,
    permissions: rolePermissions(user.roleId),
    roleId: user.roleId || null,
    roleName: findRole(user.roleId)?.name || null,
    eventAccess: user.eventAccess,
    tuotteet: paaseeTuotteisiin(user),
    // Tämän istunnon kirjautumishetki. EI johdeta JWT:n iat-kentästä, koska
    // ei-adminin istunto on liukuva: token uusitaan tässä samassa reitissä,
    // jolloin iat siirtyisi eteenpäin eikä kertoisi enää kirjautumisajasta.
    lastLoginAt: user.last_login_at || null,
    // Onko sijaintiseuranta kytketty palvelimella päälle. Tarvitaan selaimessa siihen,
    // ettei paikannuslupaa kysytä turhaan — ja siihen että vartija tietää lähettääkö
    // laite sijaintia. EI oikeustieto: sijaintien NÄKEMINEN on oma sivukartta-solmunsa
    // ('locations'), ja tämä kertoo vain onko koko toiminto olemassa.
    sijaintiseuranta: seurantaKaytossa(),
  });
});

// Mihin tuotteisiin ('event' | 'guard') tunnus pääsee. Admin pääsee aina molempiin: hän
// hallinnoi kumpaakin puolta eikä saa lukita itseään ulos siitä jota on juuri määrittämässä.
const TUOTTEET = ['event', 'guard'];
function paaseeTuotteisiin(user) {
  if (user.role === 'admin') return [...TUOTTEET];
  const omat = Array.isArray(user.tuotteet) ? user.tuotteet.filter((t) => TUOTTEET.includes(t)) : [];
  // Tyhjä lista tarkoittaisi ettei käyttäjä pääse minnekään — se on lähes varmasti
  // virhe datassa, joten palautetaan tapahtumapuoli kuten ennen kentän käyttöönottoa.
  return omat.length > 0 ? omat : ['event'];
}

function requireAuth(req, res, next) {
  const username = getSessionUser(req);
  if (!username) return res.status(401).json({ ok: false, error: 'Kirjaudu sisään.' });
  const user = findUser(username);
  if (!user) return res.status(401).json({ ok: false, error: 'Kirjaudu sisään.' });
  // Pakkovaihto: kunnes käyttäjä on vaihtanut pääkäyttäjän asettaman väliaikaisen
  // salasanan omakseen, istunnolla ei saa tehdä mitään muuta. Tämä on TÄRKEÄ olla
  // palvelimella eikä vain käyttöliittymässä — pelkkä frontin modaali olisi ohitettavissa
  // devtoolsilla tai curlilla. Sallittuja ovat vain oma salasananvaihto, istunnon luku
  // ja uloskirjautuminen.
  const sallittuVaihdonAikana =
    req.path === '/api/change-password' || req.path === '/api/session' || req.path === '/api/logout';
  if (user.must_change_password && !sallittuVaihdonAikana) {
    return res.status(403).json({
      ok: false,
      mustChangePassword: true,
      error: 'Vaihda salasana ennen kuin jatkat.',
    });
  }
  req.username = username;
  req.role = user.role;
  // Sivukartta-oikeudet tulevat KÄYTTÄJÄTASOLTA, eivät enää käyttäjätietueesta: taso
  // määrää kaiken (ks. roles.js). Tapahtumarajaus (eventAccess) pysyy käyttäjäkohtaisena,
  // koska se vaihtelee henkilöittäin saman tason sisällä.
  // Luetaan tuoreena joka pyynnöllä, jotta tason muokkaus vaikuttaa heti ilman
  // uudelleenkirjautumista — sama periaate kuin aiemmin käyttäjän omilla oikeuksilla.
  req.permissions = rolePermissions(user.roleId);
  req.eventAccess = user.eventAccess;
  req.tuotteet = paaseeTuotteisiin(user);
  // Mihin työntekijäpankin tietueeseen tunnus liittyy. Tarvitaan kun kysytään mitä
  // KÄYTTÄJÄLLE ITSELLEEN on luovutettu (kalusto.js: vuoronKalusto) — kaluston sijoitus
  // osoittaa työntekijätietueeseen eikä käyttäjätunnukseen, koska esineitä luovutetaan
  // myös ihmisille joilla ei ole tunnusta järjestelmään.
  //
  // null on tavallinen ja turvallinen arvo: jos tunnusta ei ole kytketty
  // työntekijäpankkiin, henkilökohtaisia varusteita ei näytetä. Nimellä päättely olisi
  // väärä ratkaisu — kaksi Virtasta on tavallisempaa kuin yksi.
  req.employeeId = user.employeeId || null;
  // Liukuva istunto: jokainen onnistunut kirjautunut pyyntö ei-adminilta pidentää
  // evästeen voimassaoloa uudelleen alkuperäisen keston verran eteenpäin (selaimessa
  // tunnin, sovelluksessa rajoittamattoman ajan — ks. istunto.js). Admin pysyy
  // kiinteässä istunnossa, jota automaattinen käyttämättömyyskatkaisu ei koske.
  // Sidotulla laitteella ei ole evästettä eikä sille anneta sellaista: sen pääsy on
  // sidonta ja allekirjoitus, ja evästeen myöntäminen loisi rinnakkaisen istunnon jota
  // pakkouloskirjaus ei enää koskisi samalla säännöllä.
  if (user.role !== 'admin' && !laiteIstunto(req)) {
    setSessionCookie(res, user.username, user.role, onSovellusIstunto(req));
  }
  next();
}

function requireAdmin(req, res, next) {
  const user = findUser(req.username);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Vaatii pääkäyttäjän oikeudet.' });
  }
  next();
}

// Jaettu data (kirjaukset, raportit ym.) — koko sisältö korvataan joka tallennuksella,
// samaan tapaan kuin selaimen localStorage aiemmin toimi, mutta nyt kaikkien käyttäjien
// kesken jaettuna palvelimella. Huom: kaksi samanaikaista tallentajaa voi ylikirjoittaa
// toisensa muutokset (viimeisin voittaa) — riittää pienelle tiimille, mutta ei ole
// rakennettu ristiriitojen yhdistämiseen.
// Sivukartta-oikeudet JA tapahtumarajaus (eventAccess) tarkistetaan tässä palvelinpuolella
// (ks. permissions.js) — frontin canView/canEdit suodattavat vain käyttöliittymän, eivät
// suojaa itse dataa. Oikeudet voivat nyt vaihdella tapahtumittain (sama käyttäjä voi nähdä/
// muokata eri asioita FestivaaliX:ssä kuin FestivaaliÖ:ssä), joten GET suodattaa jokaisen
// tapahtumasidotun kokoelman tietue kerrallaan (eventAccess JA kyseisen tietueen oman
// tapahtuman Sivukartta-oikeus yhdessä), ja PUT tarkistetaan samoin tietue kerrallaan sen
// mukaan mitä oikeasti muuttuu.
// Kokoelmat jotka viittaavat ladattuihin tiedostoihin, ja miten viite kustakin luetaan.
//
// TÄRKEÄ: uusi liitteitä viittaava kokoelma ON LISÄTTÄVÄ TÄHÄN. Roskienkeruu poistaa
// tiedostot joihin mikään kokoelma ei viittaa (armonajan jälkeen), joten puuttuva rivi
// tarkoittaa että kyseisen kokoelman tiedostot katoavat levyltä vuorokaudessa.
// Kokoelmat jotka syntyvät ja päivittyvät vain palvelimella. Frontti saa lukea ne
// (GET /api/data/:name suodattaa oikeuksien mukaan normaalisti), mutta PUT hylätään.
// patrolRuns on tässä eri syystä kuin SMS-kokoelmat: sen sisältö EI tule ulkopuolelta
// vaan kierroksen säännöistä (kierros.js). Vajaata kierrosta ei voi merkitä valmiiksi ja
// keskeytys vaatii syyn — jos selain saisi kirjoittaa kokoelman suoraan, molemmat
// säännöt olisivat pelkkä kohteliaisuus jonka curl ohittaa.
const PALVELIMEN_YLLAPITAMAT = new Set(['smsLog', 'smsReplies', 'patrolRuns', 'alerts', 'templateRuns', 'broadcasts', 'keys', 'equipmentIssues', 'debriefs', 'devices', 'deviceCodes', 'guardShifts', 'guardAssignments', 'guardDispatch', 'assets', 'keyTypes']);

// Raportin liiteviitteet: sekä vanha yksittäinen `attachment` ETTÄ erässä 1 lisätty
// `attachments[]`. Molemmat on luettava koko siirtymäajan yli — jos rekisteri lukisi vain
// toista, toisen kentän liitteet tulkittaisiin orvoiksi ja roskienkeruu poistaisi ne
// vuorokaudessa.
const raportinLiitteet = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .flatMap((r) => [
      r?.attachment?.id,
      ...(Array.isArray(r?.attachments) ? r.attachments.map((a) => a?.id) : []),
    ])
    .filter(Boolean);

const UPLOAD_VIITTAAJAT = {
  reports: raportinLiitteet,
  events: (arr) => (Array.isArray(arr) ? arr : []).map((e) => e?.formData?.mapUploadId).filter(Boolean),
  eventFiles: (arr) => (Array.isArray(arr) ? arr : []).map((f) => f?.uploadId).filter(Boolean),
  // GUARD-puolen liitteet on oltava tässä samasta syystä kuin tapahtumapuolen: rekisteri
  // kertoo roskienkeruulle mitkä liitteet ovat vielä käytössä. Ilman näitä rivejä
  // esimerkiksi tapahtumapuolen tallennus tulkitsisi kohteen pohjapiirroksen orvoksi ja
  // poistaisi sen levyltä armonajan jälkeen.
  guardFiles: (arr) => (Array.isArray(arr) ? arr : []).map((f) => f?.uploadId).filter(Boolean),
  guardReports: raportinLiitteet,
  // Kohteen pohjakartta. Ilman tätä riviä roskienkeruu pitäisi karttaa orpona ja
  // poistaisi sen vuorokaudessa — sama ansa kuin tapahtuman kartalla (events).
  guardSites: (arr) => (Array.isArray(arr) ? arr : []).map((k) => k?.mapUploadId).filter(Boolean),
  // Avaintyyppien tunnistuskuvat. Ilman tätä riviä roskienkeruu pitäisi koko
  // avainkarttaa orpona ja tyhjentäisi sen vuorokaudessa.
  keyTypes: (arr) => (Array.isArray(arr) ? arr : []).map((t) => t?.uploadId).filter(Boolean),
};

// Tuoteportti: kokoelma joka kuuluu vain toiselle puolelle (esim. guardSites) on
// kokonaan saavuttamaton tunnukselta jolla ei ole pääsyä sinne — riippumatta siitä mitä
// sivukartta-oikeudet sanovat. Tämä on se oikea portti; käyttöliittymän esto
// (PasswordGate) on vain kohteliaisuus ja ohitettavissa curlilla.
function tuoteEstaa(req, name) {
  const tuote = collectionTuote(name);
  return tuote !== null && !(req.tuotteet || []).includes(tuote);
}

// Koskeeko perehdytysrajaus tätä käyttäjää. Kolme ohitusta, ja jokaisella oma syynsä:
// pääkäyttäjä hallinnoi järjestelmää, kohteiden hallinnoija ylläpitää kohteita joihin
// häntä ei ole perehdytetty, ja päivystäjä valvoo kaikkia kohteita olematta kentällä.
const vainPerehdytetytKohteet = (req) =>
  req.role !== 'admin'
  && !canEdit(req.permissions, null, 'guard_sites')
  && !canView(req.permissions, null, 'guard_dispatch');

app.get('/api/data/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  if (!KNOWN_COLLECTIONS.includes(name)) {
    return res.status(404).json({ ok: false, error: 'Tuntematon kokoelma.' });
  }
  if (tuoteEstaa(req, name)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän tiedon lukemiseen.' });
  }
  const result = readableData(req.role, req.permissions, req.eventAccess, name, readCollection(name));
  if (!result.ok) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän tiedon lukemiseen.' });
  }
  // Jakolinkin token on salasanaan rinnastuva salaisuus: se antaa pääsyn tiedostoon
  // ilman kirjautumista. Sitä ei anneta listahaussa vaikka kutsujalla on lukuoikeus —
  // token haetaan erikseen /api/shares/:id/token -reitiltä vasta kun käyttäjä pyytää
  // linkin nähtäväkseen. Sama koskee salasanatiivistettä.
  //
  // Julisteen token peitetään samalla säännöllä, vaikka se ei olekaan salaisuus (se on
  // aidassa kaikkien nähtävillä): syy on toinen, mutta lopputulos sama. Token on ainoa
  // asia joka oikeuttaa kirjoittamaan järjestelmään ilman kirjautumista, eikä sen pidä
  // kulkea jokaisessa listahaussa selaimen välimuistiin ja lokeihin.
  let data = result.data;
  if (name === 'fileShares') data = (result.data || []).map(julkinenJako);
  if (name === 'publicForms') data = (result.data || []).map(julkinenLomake);
  // Tarkistuspisteiden tokenit peitetään samalla säännöllä: ne haetaan erikseen vasta
  // kun käyttäjä tulostaa tarrat (/api/pohjat/:id/tarrat).
  if (name === 'templates') data = (result.data || []).map(julkinenPohja);

  // Kohdelista perehdytyksen mukaan (erä 17, päätös 10.9.2026).
  //
  // Rajaus koskee VAIN kenttävartijaa: se ohitetaan pääkäyttäjällä, kohteiden
  // hallinnoijalla (`guard_sites` muokkaus) ja päivystäjällä (`guard_dispatch`). Heillä
  // ei ole perehdytyksiä hallinnoimiinsa tai valvomiinsa kohteisiin, eikä heiltä siksi
  // saa viedä kohdelistaa — rajaus tekisi hallinnasta mahdotonta juuri niille joiden
  // tehtävä se on.
  //
  // Molemmat solmut ovat GLOBAL_NODES-solmuja (permissions.js), joten eventId on null.
  if (name === 'guardSites' && vainPerehdytetytKohteet(req)) {
    // Hyväksytty siirto avaa kohteen samasta syystä kuin kesken oleva vuoro: työ ilman
    // kohteen ohjeita, yhteystietoja ja vyöhykkeitä ei ole tehtävissä. Ilman tätä siirto
    // olisi lupaus jota ei voi lunastaa — ja juuri siirron käyttötapaus on vartija jolla
    // EI ole perehdytystä siihen kohteeseen.
    // Vuororajaus on sama kuin työlistalla (siirto.js): kohde aukeaa työn takia, joten
    // edellisen vuoron siirto ei saa pitää kohdetta auki seuraavassa vuorossa.
    const omatVuorot = readCollection('guardShifts') || [];
    const avatut = siirtojenAvaamatKohteet(
      readCollection('guardAssignments') || [],
      req.username,
      keskenOlevaVuoro(omatVuorot, req.username)?.id || null,
    );
    const perehdytetyt = kohteetPerehdytyksenMukaan({
      kohteet: data || [],
      username: req.username,
      vuorot: omatVuorot,
    });
    const nakyvat = new Set(perehdytetyt.map((k) => k.id));
    data = (data || []).filter((k) => nakyvat.has(k?.id) || avatut.has(k?.id));
  }

  // Vartijan kalustonäkyvyys (erä 20b). Sama kuvio kuin kohdelistalla yllä: readableData
  // päästi kokoelmaan, ja tässä rajataan se mitä KYSEINEN käyttäjä siitä saa nähdä.
  //
  // Ehto on `guard_assets`-solmun PUUTTUMINEN eikä `guard_site_assets`-solmun olemassaolo.
  // Ero ratkaisee sen mitä tapahtuu kun tunnuksella on molemmat: pankkioikeus voittaa,
  // eikä pääkäyttäjä menetä historiaa siksi että hänelle sattuu olemaan annettu myös
  // vartijan solmu. Toisin päin kirjoitettuna kahden oikeuden summa olisi vähemmän kuin
  // toinen niistä yksin.
  //
  // Rivit ja kentät rajataan kalusto.js:ssä, jotta sääntö on testattavissa ilman
  // palvelinta. Täällä on vain se mitä se tarvitsee: kenen vuoro on kesken ja missä.
  // Kaikille: vanha 'varasto' luetaan holviksi ennen vastausta (kalusto.js).
  if (name === 'assets') data = kalusto.normalisoiRivit(data);
  if (name === 'assets' && req.role !== 'admin' && !canView(req.permissions, null, 'guard_assets')) {
    const vuoro = keskenOlevaVuoro(readCollection('guardShifts') || [], req.username);
    data = kalusto.vuoronKalusto(data, {
      siteId: vuoro?.siteId || null,
      employeeId: req.employeeId,
    });
  }
  res.json({ ok: true, data });
});

// Henkilöstön sijainnit juuri nyt. Kanava kertoo muutokset sitä mukaa kun niitä tulee,
// mutta juuri avattu näkymä tarvitsee lähtötilanteen — ilman tätä kartta olisi tyhjä
// siihen asti kunnes joku sattuu liikkumaan.
//
// `kaytossa: false` on eri asia kuin tyhjä lista: se kertoo käyttöliittymälle että
// seurantaa ei ole kytketty päälle lainkaan, jolloin karttaan ei piirretä tyhjää
// henkilöstötasoa eikä luvata toimintoa jota ei ole.
// Kuka saa nähdä henkilöstön sijainnit listana.
//
// KAKSI SOLMUA, KOSKA PUOLIA ON KAKSI. 'locations' on tapahtumapuolen solmu ja
// 'guard_locations' vartiointipuolen. Erään 23 asti tässä tarkistettiin vain
// tapahtumapuolen solmua, jota GUARDin oikeuseditori ei näytä lainkaan — GUARD-puolen
// päivystäjä ei siis voinut saada sijaintioikeutta millään, ja vika näytti siltä kuin
// sijainnit eivät päivittyisi.
//
// Kumpi tahansa riittää: tunnus jolla on jommankumman puolen sijaintioikeus näkee
// sijainnit sillä puolella, ja eventAccess rajaa rivit kuten muutenkin.
function saaNahdaSijaintilistan(req, eventId) {
  if (req.role === 'admin') return true;
  if (!eventAllowed(req.eventAccess, eventId)) return false;
  return canView(req.permissions, eventId, 'locations')
    || canView(req.permissions, eventId, 'guard_locations');
}

// KOHTEETON KUTSU ON HÄLYTYSKESKUKSEN NORMAALITAPAUS, EI POIKKEUS.
//
// Yllä oleva tarkistus vastaa kysymykseen "saanko nähdä kohteen X sijainnit". GUARDissa
// päivystäjä kysyy toista kysymystä: "missä yksikköni ovat". Sitä ei voi esittää
// kohdekohtaisesti kahdesta syystä:
//
//   1. Piirivuorossa oleva yksikkö ei kuulu yhteenkään kohteeseen. Sen sijaintirivin
//      eventId on null, eikä sitä siis palauta mikään kohdekohtainen kysely.
//   2. Kaupungin päivystäjällä on kymmeniä kohteita. Kysely per kohde olisi kymmeniä
//      kyselyitä, ja karttanäkymä rakentuisi paloissa.
//
// Kohteeton kutsu (eventId puuttuu) päätyi ennen tähän: eventAllowed(access, null)
// palauttaa false aina kun eventAccess on rajattu, joten rajatuilla oikeuksilla varustettu
// päivystäjä sai 403:n eikä listaa voinut saada millään. Ainoa tunnus jolle se toimi oli
// admin tai rajaamaton — eli juuri se tunnus jolla testattiin.
//
// Portti on kaksitasoinen: onko kysyjällä sijaintioikeutta LAINKAAN, ja sen jälkeen
// rivikohtainen näkyvyys. Molemmat säännöt ovat sijainti.js:ssä eivätkä täällä, koska
// index.js:llä ei ole testitiedostoa — ks. sen kommentti.

app.get('/api/sijainnit', requireAuth, (req, res) => {
  if (!seurantaKaytossa()) return res.json({ ok: true, kaytossa: false, sijainnit: [] });
  const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : null;
  const sallittu = eventId ? saaNahdaSijaintilistan(req, eventId) : saaNahdaSijainteja(req);
  if (!sallittu) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta henkilöstön sijainteihin.' });
  }
  // Nimimerkki mukaan: käyttäjätunnus on kirjautumista varten, ja valvomon ruudulla
  // lukisi muuten "mvirtanen" siinä missä kaikkialla muualla lukee "Matti Virtanen".
  // Kenttä on lisäys eikä korvaus, joten tapahtumapuolen kartta toimii ennallaan.
  const lista = sijainnit({ eventId })
    .filter((sija) => saaNahdaSijaintirivin(req, sija))
    .map((sija) => ({
      ...sija,
      nimi: findUser(sija.username)?.nickname || sija.username,
    }));

  // Katselu auditlokiin (päätös 15.9.2026). Jakso eikä yksittäinen pyyntö — perustelu
  // ikkunalle on sijainti.js:ssä. `kohteet` on lista niistä joiden sijainti näytettiin,
  // koska työntekijän kysymys ei ole "kuka avasi näkymän" vaan "kuka katsoi MINUA".
  //
  // Tyhjää listaa ei kirjata: näkymän avaaminen silloin kun kukaan ei ole kentällä ei
  // ole kenenkään sijainnin katsomista.
  if (lista.length > 0 && kirjataankoKatselu(req.username)) {
    logAudit({
      user: req.username,
      action: 'sijainti_katselu',
      collection: 'sijainnit',
      eventId,
      kohteet: lista.map((s) => s.username),
    });
  }

  res.json({ ok: true, kaytossa: true, sijainnit: lista });
});

// Sijaintihistorian haku (erä 24). Säännöt ovat sijaintihistoria.js:ssä eivätkä täällä,
// koska index.js:llä ei ole testitiedostoa — ja tämä on työntekijään kohdistuvan teknisen
// valvonnan pääsyportti.
//
// KOLME PORTTIA, ja ne vastaavat kolmeen eri kysymykseen:
//   1. saanko katsoa jälkiä lainkaan      → oma sivukarttasolmu
//   2. onko minulla hyväksyttävä syy      → pakollinen ja auditlokiin kirjattava
//   3. saanko nähdä juuri nämä pisteet    → eventAccess-rajaus riveittäin
// Ketä voi hakea. Saman portin takana kuin haku itse: lista siitä kenen sijaintia on
// kerätty on itsessään tieto jota ei anneta kenelle tahansa.
app.get('/api/sijaintihistoria/vartijat', requireAuth, (req, res) => {
  if (!saaNahdaHistorian(req, canView)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta sijaintihistoriaan.' });
  }
  const vuorot = readCollection('guardShifts') || [];
  // Nimimerkki liitetään vasta tässä: sijaintilokiin sitä ei kirjata (sijaintiloki.js),
  // ja vuororivillä on käyttäjätunnus.
  const lista = vartijavaihtoehdot(vuorot).map((v) => ({
    ...v,
    nimi: findUser(v.username)?.nickname || v.username,
  }));
  res.json({ ok: true, vartijat: lista, sailytysVrk: SIJAINTI_SAILYTYS_VRK });
});

// Hälytystehtävät joiden ajalta jäljen voi hakea. Saman portin takana kuin haku: lista
// kertoo missä kohteissa on ollut hälytyksiä ja kuka niillä kävi.
app.get('/api/sijaintihistoria/tehtavat', requireAuth, (req, res) => {
  if (!saaNahdaHistorian(req, canView)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta sijaintihistoriaan.' });
  }
  const tehtavat = readCollection('guardDispatch') || [];
  res.json({ ok: true, tehtavat: tehtavavaihtoehdot(tehtavat, req, eventAllowed) });
});

app.get('/api/sijaintihistoria', requireAuth, (req, res) => {
  if (!saaNahdaHistorian(req, canView)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta sijaintihistoriaan.' });
  }

  const username = typeof req.query.username === 'string' ? req.query.username : '';
  if (!username) return res.status(400).json({ ok: false, error: 'Kenen jälkeä haetaan?' });

  // SYY TARKISTETAAN ENNEN TEHTÄVÄN HAKUA, jotta pakollisuus koskee molempia hakutapoja
  // yhtä lailla. Jos tämä olisi vasta alempana, tehtäväpohjainen haara ohittaisi sen.
  const peruste = tarkistaSyy(req.query.syy, req.query.tarkenne);
  if (!peruste.ok) return res.status(400).json({ ok: false, error: peruste.virhe });

  // --- Hälytystehtävän ajalta ------------------------------------------------------
  //
  // Aikaväliä ei anneta vaan se luetaan tehtävästä: päivystäjä tietää minkä hälytyksen
  // haluaa selvittää, ei sitä mihin kellonaikaan yksikkö sattui ottamaan sen vastaan.
  const tehtavaId = typeof req.query.tehtavaId === 'string' ? req.query.tehtavaId : '';
  if (tehtavaId) {
    const tehtava = (readCollection('guardDispatch') || []).find((t) => t?.id === tehtavaId);
    if (!tehtava) return res.status(404).json({ ok: false, error: 'Tehtävää ei löytynyt.' });
    if (!eventAllowed(req.role === 'admin' ? [] : req.eventAccess, tehtava.siteId)) {
      return res.status(403).json({ ok: false, error: 'Ei oikeutta tämän kohteen tehtäviin.' });
    }

    const lahde = tehtavanJalki(tehtava, username);
    if (!lahde) {
      return res.status(404).json({
        ok: false,
        error: 'Yksikkö ei ollut tällä tehtävällä, tai se kieltäytyi.',
      });
    }

    let pisteet;
    let harvennettu = null;
    if (lahde.lahde === 'tehtava') {
      // Tehtävään liitetty jälki on JO suodatettu ja harvennettu hyväksynnän hetkellä,
      // eikä siinä ole eventId-kenttiä. Sitä ei suodateta uudelleen: se on tämän kohteen
      // tehtävän jälki, ja kohdepääsy on jo tarkistettu tehtävän siteId:llä yllä.
      pisteet = lahde.pisteet;
      harvennettu = lahde.harvennettu;
    } else {
      const kaikki = lueHistoria({ username, alku: lahde.alku, loppu: lahde.loppu });
      const sallitut = suodataPisteet(req, kaikki, eventAllowed);
      pisteet = harvennaJalki(sallitut).map((p) => ({
        ts: p.ts, lat: p.lat, lon: p.lon, tarkkuus: p.tarkkuus ?? null, eventId: p.eventId || null,
      }));
      if (pisteet.length < sallitut.length) harvennettu = sallitut.length;
    }

    logAudit({
      user: req.username,
      action: 'sijaintihistoria_haku',
      collection: 'sijaintiloki',
      kohde: username,
      syy: peruste.syy,
      ...(peruste.tarkenne ? { tarkenne: peruste.tarkenne } : {}),
      tehtavaId,
      // Kumpi lähde: kahden vuoden päästä auditlokin lukijan on tiedettävä katsottiinko
      // hyväksyttyä jälkeä vai lokia, koska vain edellinen on silloin enää olemassa.
      lahde: lahde.lahde,
      osumia: pisteet.length,
    });

    return res.json({
      ok: true,
      username,
      nimi: findUser(username)?.nickname || username,
      pisteet,
      lahde: lahde.lahde,
      tehtava: {
        id: tehtava.id, laji: tehtava.laji, siteNimi: tehtava.siteNimi || '',
        silmukka: tehtava.silmukka || '', luotu: tehtava.luotu,
      },
      ...(harvennettu ? { harvennettu } : {}),
    });
  }

  // --- Vapaa aikaväli ---------------------------------------------------------------
  const ikkuna = tarkistaIkkuna(req.query.alku, req.query.loppu);
  if (!ikkuna.ok) return res.status(400).json({ ok: false, error: ikkuna.virhe });

  const kaikki = lueHistoria({ username, alku: ikkuna.alku, loppu: ikkuna.loppu });
  const sallitut = suodataPisteet(req, kaikki, eventAllowed);

  // Harvennus vasta suodatuksen JÄLKEEN: toisin päin harvennus voisi pudottaa juuri ne
  // pisteet jotka kysyjä saa nähdä ja jättää jäljelle ne joita hän ei saa.
  const pisteet = harvennaJalki(sallitut).map((p) => ({
    ts: p.ts, lat: p.lat, lon: p.lon, tarkkuus: p.tarkkuus ?? null, eventId: p.eventId || null,
  }));

  // JOKAINEN HAKU KIRJATAAN, ei jaksoittain kuten tilannekuvan katselu.
  //
  // Ero on tarkoituksellinen. Tilannekuva päivittyy itsestään minuutin välein, joten
  // rivikohtainen kirjaus tuottaisi lokia jota kukaan ei ehdi lukea. Jäljen haku on
  // päinvastainen: se on tietoinen teko, jonka joku teki jostain syystä — ja juuri se
  // teko on se mitä työntekijällä on oikeus nähdä omista tiedoistaan.
  //
  // `osumia` kirjataan myös nollana: tyhjä tulos ei tarkoita ettei katsottu.
  logAudit({
    user: req.username,
    action: 'sijaintihistoria_haku',
    collection: 'sijaintiloki',
    kohde: username,
    syy: peruste.syy,
    ...(peruste.tarkenne ? { tarkenne: peruste.tarkenne } : {}),
    alku: new Date(ikkuna.alku).toISOString(),
    loppu: new Date(ikkuna.loppu).toISOString(),
    osumia: pisteet.length,
    ...(sallitut.length < kaikki.length ? { rajattuPois: kaikki.length - sallitut.length } : {}),
  });

  res.json({
    ok: true,
    username,
    nimi: findUser(username)?.nickname || username,
    pisteet,
    // Kerrotaan harvennuksesta samalla tavalla kuin tehtävän jäljessä: katsojan on
    // tiedettävä katsooko hän täyttä jälkeä vai otosta siitä.
    ...(pisteet.length < sallitut.length ? { harvennettu: sallitut.length } : {}),
  });
});

app.put('/api/data/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  if (!KNOWN_COLLECTIONS.includes(name)) {
    return res.status(404).json({ ok: false, error: 'Tuntematon kokoelma.' });
  }
  if (tuoteEstaa(req, name)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän tiedon muokkaamiseen.' });
  }
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ ok: false, error: 'Odotettiin taulukkoa.' });
  }
  // Rakennevalidointi ennen oikeustarkistusta/kirjoitusta — ks. validation.js.
  const recordCheck = validateRecords(req.body);
  if (!recordCheck.ok) {
    return res.status(400).json(recordCheck);
  }
  // Jakolinkkejä ei kirjoiteta tämän geneerisen reitin kautta: token ja salasanatiiviste
  // syntyvät palvelimella (/api/shares), eikä frontilla ole niitä hallussaan. Jos tämä
  // sallittaisiin, frontin tallennus ylikirjoittaisi tokenit tyhjiksi ja katkaisisi
  // kaikki voimassa olevat jakolinkit kerralla.
  if (name === 'fileShares') {
    return res.status(403).json({
      ok: false,
      error: 'Jakolinkkejä hallitaan vain omien reittiensä kautta (/api/shares).',
    });
  }
  // Sama ansa kuin fileShares, ja tässä se olisi vielä pahempi: selain ei koskaan näe
  // julisteiden tokeneita (ne peitetään GET:issä), joten koko kokoelman tallennus
  // kirjoittaisi tokenit tyhjiksi ja jokainen aidassa oleva juliste lakkaisi toimimasta
  // kerralla — eikä sitä voisi korjata muuten kuin painamalla uudet julisteet.
  if (name === 'publicForms') {
    return res.status(403).json({
      ok: false,
      error: 'Ilmoituslomakkeita hallitaan vain omien reittiensä kautta (/api/publicforms).',
    });
  }
  // Sama ansa kolmannen kerran: selain ei näe tarkistuspisteiden tokeneita, joten koko
  // kokoelman tallennus tyhjentäisi ne ja jokainen seinässä oleva QR-tarra lakkaisi
  // toimimasta.
  if (name === 'templates') {
    return res.status(403).json({
      ok: false,
      error: 'Pohjia hallitaan vain omien reittiensä kautta (/api/pohjat).',
    });
  }
  // Samasta syystä kuin fileShares, mutta eri lähteestä: näiden sisältö syntyy
  // lähetysreitillä ja päivittyy BulkSMS:n webhook-kutsuista. Frontti näyttää ne mutta ei
  // omista niitä, joten sen automaattitallennus ylikirjoittaisi juuri saapuneet
  // toimituskuittaukset vanhentuneella välimuistilla. Tämä koskee myös adminia, jonka
  // authorizeWrite päästäisi muuten läpi ilman per-tietue-tarkistusta.
  if (PALVELIMEN_YLLAPITAMAT.has(name)) {
    return res.status(403).json({
      ok: false,
      error: 'Kokoelmaa ylläpitää palvelin, eikä sitä voi kirjoittaa selaimesta.',
    });
  }
  const current = readCollection(name) || [];
  const verdict = authorizeWrite(req.role, req.permissions, req.eventAccess, name, current, req.body);
  if (!verdict.ok) {
    return res.status(403).json(verdict);
  }
  // Romahdussuoja: tarkistetaan levylle päätyvä lopullinen data (verdict.data, joka
  // tapahtumarajatulle käyttäjälle voi sisältää outOfScope-osan) — ei suoraan
  // req.bodyä, koska rajatun käyttäjän tyhjä lähetys ei välttämättä tyhjennä koko
  // kokoelmaa levyllä.
  // Romahdussuoja estää kokoelman tyhjentämisen. Se rakennettiin vahingon varalle:
  // epäonnistunut GET + frontin automaattitallennus saattoi ylikirjoittaa kaiken.
  // Tarkoituksellinen poisto on eri asia — tapahtumailmoituksia koskee lakisääteinen
  // säilytysaika, jonka jälkeen ne on hävitettävä, joten poiston on myös oikeasti
  // onnistuttava. allowEmpty=1 ohittaa suojan, mutta vain adminille ja vain kun
  // kutsuja pyytää sitä nimenomaisesti (ks. src/App.tsx: handlePermanentDeleteEvent).
  const allowEmpty = req.query.allowEmpty === '1' && req.role === 'admin';
  if (!allowEmpty && wouldWipeNonEmptyCollection(current, verdict.data)) {
    return res.status(409).json({
      ok: false,
      error: 'Tallennus hylätty: yrität korvata olemassa olevan datan tyhjällä. Jos tarkoitus on poistaa kaikki tietueet, poista ne yksitellen.',
    });
  }
  writeCollection(name, verdict.data);

  // Liitetiedostojen hävittäminen: raportin poistaminen ei aiemmin poistanut sen
  // liitettä levyltä lainkaan, joten esim. valokuva kohdehenkilöstä jäi hakemistoon
  // pysyvästi vaikka itse raportti oli poistettu. Tämän pyynnön irrottamat liitteet
  // poistetaan heti (ne ovat varmasti orpoja), ja sen lisäksi siivotaan aiemmin
  // orvoiksi jääneet tiedostot armonajan jälkeen (ks. uploads.js: collectGarbage).
  //
  // Roskienkeruulle on annettava KAIKKIEN liitteitä viittaavien kokoelmien viitteet,
  // muuten yhden kokoelman tallennus poistaisi toisen tiedostot armonajan jälkeen.
  // Siksi viittaajat ovat rekisterissä (UPLOAD_VIITTAAJAT) eivätkä if-ehdossa: uusi
  // liitteitä viittaava kokoelma lisätään yhteen paikkaan, eikä sen tiedostojen
  // katoaminen jää kiinni siitä että joku muisti päivittää tämän ehdon.
  if (UPLOAD_VIITTAAJAT[name]) {
    try {
      const idt = UPLOAD_VIITTAAJAT[name];

      // Tässä pyynnössä irronneet liitteet poistetaan heti — ne ovat varmasti orpoja.
      const viitatutNyt = idt(verdict.data);
      const irrotetut = idt(current).filter((id) => !viitatutNyt.includes(id));
      for (const id of irrotetut) deleteUpload(id);

      // Muiden kokoelmien viitteet luetaan levyltä, jotta ne eivät joudu roskiksi.
      const muut = Object.entries(UPLOAD_VIITTAAJAT)
        .filter(([kokoelma]) => kokoelma !== name)
        .flatMap(([kokoelma, poimi]) => poimi(readCollection(kokoelma)));
      collectGarbage([...viitatutNyt, ...muut]);
    } catch (err) {
      // Liitteiden siivous ei saa kaataa itse tallennusta joka jo onnistui.
      console.error('Liitetiedostojen siivous epäonnistui:', err.message);
    }
  }
  // Lokitetaan vasta kirjoituksen onnistuttua — ei koskaan lokiin muutosta joka ei
  // oikeasti mennyt levylle. Yksi rivi per tietue (ei yksi rivi per PUT-pyyntö),
  // koska sama pyyntö voi sisältää usean tietueen muutoksia kerralla.
  // Kerrotaan muutoksesta avoimille istunnoille. Vasta kirjoituksen JÄLKEEN: ilmoitus
  // muutoksesta jota ei tallennettu saisi selaimet hakemaan vanhan datan uudelleen ja
  // näyttämään sen tuoreena. Kanava kuljettaa vain id:t — sisältö haetaan GETillä, joka
  // tekee saman oikeustarkistuksen kuin ennenkin (ks. kanava.js).
  lahetaKanavalle(name, verdict.changes, {
    lahettaja: req.username,
    saaNahda: (istunto, eventId) =>
      istunto?.role === 'admin' || eventAllowed(istunto?.eventAccess, eventId),
  });

  for (const change of verdict.changes || []) {
    logAudit({
      user: req.username,
      role: req.role,
      action: change.action,
      collection: name,
      recordId: change.id,
      eventId: change.eventId,
      // Tilamuutos ja korjausmerkinnän lisäys ovat tarkoituksellinen poikkeus tämän
      // moduulin periaatteeseen "vain metadata, ei tietueen sisältöä" (ks. audit.js):
      // kumpikaan ei ole henkilötietoa, ja juuri niiden historia on se mitä
      // jälkikäteisessä selvityksessä kysytään. Lisätiedot tulevat authorizeWritelta,
      // joka on ainoa paikka jossa vanha ja uusi tietue ovat molemmat käsillä.
      ...(change.statusFrom !== undefined
        ? { statusFrom: change.statusFrom, statusTo: change.statusTo }
        : {}),
      ...(change.correctionAdded ? { correctionAdded: true } : {}),
    });
  }
  res.json({ ok: true });
});

// --- Tietuekohtainen kirjoitus (offline-jonon perusta, P7) -------------------------
//
// Koko kokoelman PUT ei kelpaa offline-jonolle. Kentältä palaava puhelin, joka on ollut
// verkotta kolme tuntia, lähettäisi oman vanhentuneen käsityksensä koko kokoelmasta ja
// pyyhkisi kaiken mitä muut ovat sillä välin kirjanneet. Se on juuri se vahinko jota
// vastaan romahdussuoja rakennettiin, mutta hienovaraisempana: data ei katoa kokonaan
// vaan osittain, eikä kukaan huomaa.
//
// Siksi jonosta lähtevä kirjaus menee tänne: YKSI tietue, joka LISÄTÄÄN. Muiden
// samanaikaiset kirjaukset eivät voi kadota, koska niitä ei kosketa.
//
// IDEMPOTENSSI tulee tietueen id:stä, jonka SELAIN antaa jo offline-tilassa. Jos vastaus
// hukkuu matkalla ja jono yrittää uudelleen, sama id saapuu toisen kerran — silloin
// palvelin toteaa tietueen jo olevan olemassa eikä luo kaksoiskappaletta. Ilman tätä
// katkeileva verkko tuottaisi kaksi identtistä kirjausta samasta tapahtumasta, mikä on
// lakisääteisessä aineistossa oma ongelmansa.
//
// Vain kentällä tehtävät kirjaukset: nämä ovat ne joita tehdään verkon ollessa poikki.
// Muut kokoelmat (kohteet, pohjat, käyttäjät) muokataan valvomossa, eikä niiden
// muokkaamiselle offline-tilassa ole tarvetta — eikä lisäys yksinään edes riittäisi,
// koska niissä muokataan olemassa olevia tietueita.
const KENTTAKOKOELMAT = new Set(['reports', 'guardReports', 'guardTaskRuns', 'checkins']);

app.post('/api/kirjaa/:name', requireAuth, (req, res) => {
  const { name } = req.params;
  if (!KENTTAKOKOELMAT.has(name)) {
    return res.status(404).json({ ok: false, error: 'Kokoelmaan ei voi kirjata yksittäistä tietuetta.' });
  }
  if (tuoteEstaa(req, name)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän tiedon muokkaamiseen.' });
  }
  const tietue = req.body;
  if (!tietue || typeof tietue !== 'object' || Array.isArray(tietue)) {
    return res.status(400).json({ ok: false, error: 'Odotettiin yhtä tietuetta.' });
  }
  const rakenne = validateRecords([tietue]);
  if (!rakenne.ok) return res.status(400).json(rakenne);

  const current = readCollection(name) || [];

  // Onko tämä sama kirjaus joka on jo perillä (ks. kirjaukset.js: loydaSamaKirjaus).
  // Ei virhe: jono yritti uudelleen, ja sen kuuluu poistaa kirjaus listaltaan
  // onnistuneena. Virhe tässä kohdassa jättäisi kirjauksen jonoon ikuisesti yrittämään.
  const sama = loydaSamaKirjaus(tietue, current);
  if (sama) {
    return res.json({ ok: true, id: String(sama.id), duplikaatti: true });
  }

  // TUNNISTETÖRMÄYS. EVENT-puolen tunniste on juokseva sarja jonka selain muodostaa
  // omasta listastaan, ja offline-tilassa kaksi laitetta antaa saman numeron. Sarjan
  // omistaja on palvelin, joten se siirtää jälkimmäisen seuraavaan vapaaseen numeroon
  // sen sijaan että hylkäisi sen — hylkääminen tarkoittaisi, että offline-tuki hävittää
  // juuri sen kirjauksen jonka se on olemassa pelastamaan.
  let tallennettava = tietue;
  let siirrettyTunnisteesta = null;
  if (current.some((t) => String(t?.id) === String(tietue.id))) {
    const vapaa = seuraavaVapaaTunniste(tietue.id, new Set(current.map((t) => String(t?.id))));
    if (!vapaa) {
      // Satunnainen tunniste (UUID) jota ei voi siirtää sarjassa eteenpäin. Sama id ilman
      // samaa jonoId:tä on silloin niin epätodennäköinen, että se on todennäköisemmin
      // virhe kuin törmäys — ja hiljainen ylikirjoitus olisi pahin vaihtoehto.
      return res.status(409).json({ ok: false, error: 'Tunniste on jo käytössä.' });
    }
    siirrettyTunnisteesta = String(tietue.id);
    tallennettava = { ...tietue, id: vapaa };
  }

  // Oikeustarkistus tehdään SAMALLA funktiolla kuin koko kokoelman kirjoituksessa, jotta
  // lisäysreitti ei voi olla eri mieltä oikeuksista kuin tavallinen tallennus.
  const verdict = authorizeWrite(req.role, req.permissions, req.eventAccess, name, current, [...current, tallennettava]);
  if (!verdict.ok) return res.status(403).json(verdict);

  writeCollection(name, verdict.data);
  lahetaKanavalle(name, verdict.changes, {
    lahettaja: req.username,
    saaNahda: (istunto, eventId) =>
      istunto?.role === 'admin' || eventAllowed(istunto?.eventAccess, eventId),
  });
  for (const change of verdict.changes || []) {
    logAudit({
      user: req.username,
      role: req.role,
      action: change.action,
      collection: name,
      recordId: change.id,
      eventId: change.eventId,
      // Jonosta tullut kirjaus merkitään lokiin: jälkikäteen on olennaista tietää, että
      // kirjaus syntyi kentällä eri aikaan kuin se saapui palvelimelle.
      ...(req.body?.jonossaAlkaen ? { jonossaAlkaen: req.body.jonossaAlkaen } : {}),
      // Siirretty tunniste kirjataan lokiin: jälkikäteen on voitava selvittää miksi
      // kirjauksen numero ei ole se jonka kirjaaja näki laitteellaan.
      ...(siirrettyTunnisteesta ? { siirrettyTunnisteesta } : {}),
    });
  }
  res.json({
    ok: true,
    id: String(tallennettava.id),
    ...(siirrettyTunnisteesta ? { siirretty: true } : {}),
  });
});

// Käyttäjähallinta (vain admin) ja oman salasanan itsepalveluvaihto (kuka tahansa kirjautunut).
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  res.json({ ok: true, users: listUsers() });
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  // password ei tule enää pyynnöstä: palvelin arpoo sen (ks. arvoSalasana).
  const { username, nickname, displayId, employeeId } = req.body || {};
  if (typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ ok: false, error: 'Käyttäjätunnus vaaditaan.' });
  }
  if (typeof nickname !== 'string' || !nickname.trim()) {
    return res.status(400).json({ ok: false, error: 'Nimimerkki vaaditaan.' });
  }
  // Tunnistenumero on valinnainen (vanha "Luo käyttäjä" -polku ei anna sitä), mutta jos
  // se annetaan, sen on oltava kelvollinen ja vapaa: numero yksilöi henkilön raporteissa.
  if (displayId !== undefined && displayId !== null) {
    if (!Number.isInteger(displayId) || displayId < 1000) {
      return res.status(400).json({ ok: false, error: 'Virheellinen tunnistenumero.' });
    }
    const varattu = listUsers().find((u) => u.displayId === displayId);
    if (varattu) {
      return res.status(409).json({ ok: false, error: `Tunnistenumero #${displayId} on jo tunnuksella ${varattu.username}.` });
    }
  }
  // Salasanaa EI oteta enää pyynnöstä: se arvotaan palvelimella ja palautetaan
  // pääkäyttäjälle kertaalleen. Näin uutta salasanaa ei keksitä käsin eikä se kulje
  // selaimesta palvelimelle. Käyttäjä vaihtaa sen heti ensimmäisellä kirjautumisella.
  const trimmedUsername = username.trim();
  if (findUser(trimmedUsername)) {
    return res.status(409).json({ ok: false, error: 'Käyttäjätunnus on jo käytössä.' });
  }
  const arvottu = arvoSalasana();
  upsertUser(trimmedUsername, bcrypt.hashSync(arvottu, 12), {
    nickname: nickname.trim(),
    role: 'user',
    displayId: displayId ?? undefined,
    employeeId: typeof employeeId === 'string' ? employeeId : undefined,
  });
  setMustChangePassword(trimmedUsername, true);
  logAudit({ user: req.username, action: 'user_create', targetUser: trimmedUsername });
  // Salasana palautetaan VAIN tässä vastauksessa — sitä ei tallenneta selväkielisenä
  // eikä sitä voi hakea myöhemmin uudelleen.
  res.json({ ok: true, password: arvottu, mustChangePassword: true });
});

app.put('/api/users/:username', requireAuth, requireAdmin, (req, res) => {
  const { username } = req.params;
  const { nickname, permissions, eventAccess, tuotteet, roleId, employeeId } = req.body || {};
  const kohde = findUser(username);
  if (!kohde) {
    return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  }
  // Työntekijäpankin kytkentä (erä 20c). Ratkaisee mitä kalustoa tunnus näkee omanaan
  // (kalusto.js: vuoronKalusto), joten kaksi tarkistusta:
  //
  // 1. TIETUEEN ON OLTAVA OLEMASSA. Viittaus poistettuun työntekijään näyttäisi
  //    kytketyltä muttei löytäisi mitään, ja vika näkyisi vasta tyhjänä varustelistana.
  // 2. YKSI TIETUE, YKSI TUNNUS. Kaksi tunnusta samaan työntekijään tarkoittaisi että
  //    kaksi ihmistä näkee samat varusteet omanaan — ja luovutusvastuu on yhden
  //    henkilön asia. Sama sääntö kuin tunnistenumerolla (POST /api/users).
  if (employeeId !== undefined && employeeId !== null && employeeId !== '') {
    if (typeof employeeId !== 'string') {
      return res.status(400).json({ ok: false, error: 'Virheellinen työntekijäviite.' });
    }
    const tyontekija = (readCollection('employees') || []).find((t) => t?.id === employeeId);
    if (!tyontekija) {
      return res.status(404).json({ ok: false, error: 'Työntekijää ei löytynyt työntekijäpankista.' });
    }
    const varattu = listUsers().find((u) => u.employeeId === employeeId && u.username !== username);
    if (varattu) {
      return res.status(409).json({
        ok: false,
        error: `${tyontekija.name || 'Työntekijä'} on jo kytketty tunnukseen ${varattu.username}. Katkaise se ensin.`,
      });
    }
  }
  if (roleId !== undefined) {
    if (!findRole(roleId)) {
      return res.status(400).json({ ok: false, error: 'Tuntematon käyttäjätaso.' });
    }
    // Viimeistä pääkäyttäjää ei saa alentaa: muuten hallintaan ei pääse enää kukaan.
    if (kohde.roleId === ROLE_ADMIN && roleId !== ROLE_ADMIN) {
      const adminejaMuita = listUsers().filter((u) => u.roleId === ROLE_ADMIN && u.username !== username).length;
      if (adminejaMuita === 0) {
        return res.status(400).json({ ok: false, error: 'Viimeisen pääkäyttäjän tasoa ei voi vaihtaa.' });
      }
    }
  }
  if (nickname !== undefined && (typeof nickname !== 'string' || !nickname.trim())) {
    return res.status(400).json({ ok: false, error: 'Nimimerkki ei voi olla tyhjä.' });
  }
  if (permissions !== undefined && (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions))) {
    return res.status(400).json({ ok: false, error: 'Virheellinen oikeusmuoto.' });
  }
  if (eventAccess !== undefined && (!Array.isArray(eventAccess) || !eventAccess.every((id) => typeof id === 'string'))) {
    return res.status(400).json({ ok: false, error: 'Virheellinen tapahtumarajaus.' });
  }
  // Tuotepääsy: tyhjä lista lukitsisi käyttäjän ulos kokonaan, joten vähintään yksi
  // tunnettu tuote vaaditaan. Adminia rajaus ei koske (ks. paaseeTuotteisiin).
  if (tuotteet !== undefined
      && (!Array.isArray(tuotteet) || tuotteet.length === 0 || !tuotteet.every((t) => TUOTTEET.includes(t)))) {
    return res.status(400).json({ ok: false, error: 'Valitse vähintään yksi puoli (EVENT tai GUARD).' });
  }
  updateUser(username, {
    nickname: nickname !== undefined ? nickname.trim() : undefined,
    permissions,
    eventAccess,
    tuotteet,
    roleId,
    // Tyhjä merkkijono tarkoittaa kytkennän katkaisua: pudotusvalikon "ei kytkentää"
    // -vaihtoehto lähettää sen. undefined jättää kentän koskematta, jotta muut
    // tallennukset eivät pyyhi kytkentää vahingossa.
    employeeId: employeeId === undefined ? undefined : (employeeId || null),
  });
  // Ei tallenneta permissions/eventAccess-sisältöä itseään lokiin (iso, nested rakenne,
  // ei kovin luettava sellaisenaan) — vain mitkä kentät koskivat, samaan tapaan kuin
  // muukin lokitus keskittyy "mitä tapahtui" -metadataan sisällön sijaan.
  const changedFields = [
    nickname !== undefined && 'nickname',
    permissions !== undefined && 'permissions',
    eventAccess !== undefined && 'eventAccess',
    tuotteet !== undefined && 'tuotteet',
    employeeId !== undefined && 'employeeId',
  ].filter(Boolean);
  logAudit({ user: req.username, action: 'user_update', targetUser: username, fields: changedFields });
  res.json({ ok: true });
});

// Authenticator-sovelluksen (TOTP) käyttöönottotiedot — vain admin, näytetään
// "Muokkaa oikeuksia" -sivulla QR-koodina ja tekstimuodossa. Salaisuus itsessään ei
// koskaan päädy /api/users-listaukseen, ainoastaan tälle omalle reitilleen.
app.get('/api/users/:username/totp', requireAuth, requireAdmin, async (req, res) => {
  const { username } = req.params;
  const user = findUser(username);
  if (!user) return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  if (user.role === 'admin') {
    return res.status(400).json({ ok: false, error: 'Pääkäyttäjä ei käytä Authenticator-tunnistautumista.' });
  }
  const secret = getTotpSecret(username);
  const otpauthUri = buildOtpauthUri(secret, username);
  const qrDataUri = await QRCode.toDataURL(otpauthUri, { width: 220, margin: 1 });
  res.json({ ok: true, secret, otpauthUri, qrDataUri, totpRequired: user.totp_required !== false });
});

// Nollaa käyttäjän TOTP-salaisuuden (esim. puhelin kadonnut) — vanha Authenticator-
// merkintä lakkaa toimimasta heti, uusi QR pitää skannata.
app.post('/api/users/:username/totp/reset', requireAuth, requireAdmin, async (req, res) => {
  const { username } = req.params;
  const user = findUser(username);
  if (!user) return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  if (user.role === 'admin') {
    return res.status(400).json({ ok: false, error: 'Pääkäyttäjä ei käytä Authenticator-tunnistautumista.' });
  }
  const secret = resetTotpSecret(username);
  logAudit({ user: req.username, action: 'totp_reset', targetUser: username });
  const otpauthUri = buildOtpauthUri(secret, username);
  const qrDataUri = await QRCode.toDataURL(otpauthUri, { width: 220, margin: 1 });
  res.json({ ok: true, secret, otpauthUri, qrDataUri, totpRequired: user.totp_required !== false });
});

// Ottaa Authenticator-vaatimuksen pois käytöstä / palauttaa sen (esim. käyttäjällä ei
// ole omaa puhelinta) — itse salaisuus/QR säilyy ennallaan jos otetaan myöhemmin takaisin.
app.put('/api/users/:username/totp', requireAuth, requireAdmin, (req, res) => {
  const { username } = req.params;
  const { required } = req.body || {};
  const user = findUser(username);
  if (!user) return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  if (user.role === 'admin') {
    return res.status(400).json({ ok: false, error: 'Pääkäyttäjä ei käytä Authenticator-tunnistautumista.' });
  }
  if (typeof required !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'Virheellinen pyyntö.' });
  }
  setTotpRequired(username, required);
  logAudit({ user: req.username, action: 'totp_required_change', targetUser: username, required });
  res.json({ ok: true, totpRequired: required });
});

// Pakottaa valitun käyttäjän uloskirjautumaan välittömästi — hänen nykyinen istuntonsa
// mitätöityy vaikka eväste olisi muuten vielä voimassa, ja hänen täytyy kirjautua uudelleen.
app.post('/api/users/:username/logout', requireAuth, requireAdmin, (req, res) => {
  const { username } = req.params;
  const user = findUser(username);
  if (!user) return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  if (user.role === 'admin') {
    return res.status(400).json({ ok: false, error: 'Pääkäyttäjää ei voi kirjata ulos tästä näkymästä.' });
  }
  forceLogout(username);
  logAudit({ user: req.username, action: 'force_logout', targetUser: username });
  res.json({ ok: true });
});

// Pääkäyttäjä nollaa salasanan, kun käyttäjä ei muista omaansa. Uusi salasana arvotaan
// palvelimella ja palautetaan kertaalleen; käyttäjä kirjautuu sillä ja joutuu heti
// vaihtamaan sen omakseen (must_change_password). Väliaikainen salasana on kulkenut
// pääkäyttäjän kautta, joten se ei saa jäädä pysyväksi.
//
// Erillinen /api/change-password-reitistä, joka on käyttäjän oma itsepalvelu ja vaatii
// nykyisen salasanan. Tähän ei tarvita vanhaa salasanaa — pääsy on jo rajattu adminiin.
app.post('/api/users/:username/password', requireAuth, requireAdmin, (req, res) => {
  const { username } = req.params;
  const user = findUser(username);
  if (!user) return res.status(404).json({ ok: false, error: 'Käyttäjää ei löytynyt.' });
  const arvottu = arvoSalasana();
  updatePassword(username, bcrypt.hashSync(arvottu, 12));
  setMustChangePassword(username, true);
  // Vanhat istunnot katkaistaan: syy nollaukseen voi olla vuotanut salasana.
  if (user.role !== 'admin') forceLogout(username);
  logAudit({ user: req.username, action: 'user_password_set', targetUser: username });
  res.json({ ok: true, password: arvottu, mustChangePassword: true });
});

app.post('/api/change-password', requireAuth, loginLimiter, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ ok: false, error: 'Nykyinen ja uusi salasana vaaditaan.' });
  }
  const user = findUser(req.username);
  const valid = user ? bcrypt.compareSync(currentPassword, user.password_hash) : false;
  if (!valid) {
    return res.status(401).json({ ok: false, error: 'Nykyinen salasana on väärin.' });
  }
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({
      ok: false,
      error: 'Uuden salasanan tulee olla vähintään 10 merkkiä ja sisältää iso kirjain, pieni kirjain ja numero.',
    });
  }
  const hash = bcrypt.hashSync(newPassword, 12);
  updatePassword(req.username, hash);
  logAudit({ user: req.username, action: 'password_change' });
  res.json({ ok: true });
});

// Audit-loki (vain admin): kuka teki mitä milloin — data-kokoelmien luonti/muokkaus/
// poisto, käyttäjähallinnan muutokset, kirjautumiset. Sivutettu (limit/before) koska
// loki kasvaa ajan myötä eikä koskaan katkaista automaattisesti.
// Tallennustilan tilanne (vain admin). Mittari kertoo kuinka paljon levystä on
// käytössä — datahakemiston tiedostojärjestelmä on sama levy jolla koko palvelin on.
// Käytetään fs.statfsSync:iä eikä ulkoista komentoa (df), jotta reitti ei riipu
// shellistä eikä sen tulosteen muodosta.
// ====================== LAITESIDONTA (erä 10) ======================
//
// Sovellus ei kirjaudu itse: vartija kirjautuu selaimessa normaalisti, pyytää
// sidontakoodin, ja selain antaa sen sovellukselle intentin kautta. Sovellus vaihtaa
// koodin laitetunnukseksi ja allekirjoittaa sen jälkeen jokaisen pyyntönsä Keystoressa
// olevalla avaimellaan. Säännöt: server/laite.js.
//
// Päätökset 9.9.2026: vartija sitoo itse, yksi laite tunnusta kohden, ja laitteen vaihto
// tapahtuu hälytyskeskuksen tekemällä nollauksella.

// Sidonta ja rekisteröinti ovat molemmat harvinaisia toimintoja, ja rekisteröinti on
// lisäksi kirjautumaton — sama tiukka raja kuin kirjautumisella.
const laiteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liikaa sidontayrityksiä. Yritä hetken kuluttua uudelleen.' },
});

// Kuka saa nollata sidonnan. Hälytyskeskus eikä vain pääkäyttäjä, koska laite vaihdetaan
// keskellä yötä vuoron alussa ja silloin päivystäjä on se joka on paikalla.
// `guard_dispatch` on GLOBAL_NODES-solmu (permissions.js), joten tarkistus ei ole
// kohdekohtainen — päivystys on määritelmällisesti kohteiden yli menevä tehtävä.
const saaHallitaLaitteita = (req) =>
  req.role === 'admin' || canEdit(req.permissions, null, 'guard_dispatch');

// Vartija pyytää sidontakoodin omalle tunnukselleen.
app.post('/api/laite/sido', requireAuth, laiteLimiter, (req, res) => {
  const laitteet = readCollection('devices') || [];
  if (laitteet.filter((l) => l.kayttaja === req.username).length >= LAITTEITA_TUNNUSTA_KOHDEN) {
    return res.status(409).json({
      ok: false,
      error: 'Tunnuksella on jo sidottu laite. Hälytyskeskus voi nollata sidonnan, jos laite on vaihtunut.',
    });
  }

  const nyt = Date.now();
  const koodit = readCollection('deviceCodes') || [];
  // Vanhentuneet pois ja käyttäjän oma edellinen koodi kumoutuu: uusi pyyntö tarkoittaa
  // että edellinen ei mennyt perille, eikä kahta voimassa olevaa koodia samalle
  // tunnukselle ole mitään syytä olla olemassa.
  const jaljelle = koodit.filter((k) => k.eraantyy > nyt && k.kayttaja !== req.username);
  const { koodi, tietue } = luoKoodi({ kayttaja: req.username, nyt });
  writeCollection('deviceCodes', [...jaljelle, tietue]);

  logAudit({ user: req.username, action: 'laite_sidontakoodi', ip: req.ip });
  res.json({ ok: true, koodi, voimassaMs: KOODI_VOIMASSA_MS });
});

// Sovellus vaihtaa koodin laitetunnukseksi. EI requireAuth: sovelluksella ei ole
// istuntoa ennen tätä hetkeä — koodi ON tässä se todiste, ja se on kertakäyttöinen,
// lyhytikäinen ja syntynyt kirjautuneelle istunnolle.
app.post('/api/laite/rekisteroi', laiteLimiter, (req, res) => {
  const { koodi, julkinenAvain, malli } = req.body || {};
  const nyt = Date.now();
  const koodit = readCollection('deviceCodes') || [];

  const osuma = koodit.find((k) => kelpaakoKoodi(k, koodi, nyt).ok) || null;
  if (!osuma) {
    logAudit({ action: 'laite_rekisterointi_hylatty', syy: 'koodi', ip: req.ip });
    return res.status(400).json({ ok: false, error: 'Sidontakoodi on virheellinen tai vanhentunut.' });
  }

  // Kelvoton avain hylätään TÄSSÄ eikä vasta ensimmäisessä allekirjoitetussa pyynnössä:
  // muuten sidonta näyttäisi onnistuvan ja laite olisi käyttökelvoton vasta kentällä.
  if (!lueAvain(julkinenAvain)) {
    logAudit({ user: osuma.kayttaja, action: 'laite_rekisterointi_hylatty', syy: 'avain', ip: req.ip });
    return res.status(400).json({ ok: false, error: 'Laitteen avain on kelvoton.' });
  }

  const laitteet = readCollection('devices') || [];
  if (laitteet.filter((l) => l.kayttaja === osuma.kayttaja).length >= LAITTEITA_TUNNUSTA_KOHDEN) {
    return res.status(409).json({ ok: false, error: 'Tunnuksella on jo sidottu laite.' });
  }

  const laite = laitteenTietue({ kayttaja: osuma.kayttaja, julkinenAvain, malli, nyt });
  writeCollection('devices', [...laitteet, laite]);
  // Koodi pois heti: kertakäyttöisyys ei saa nojata pelkkään kaytetty-lippuun, koska
  // koodia ei tarvita enää mihinkään.
  writeCollection('deviceCodes', koodit.filter((k) => k !== osuma));

  logAudit({ user: osuma.kayttaja, action: 'laite_sidottu', laite: laite.id, malli: laite.malli, ip: req.ip });
  res.json({ ok: true, laiteId: laite.id, kayttaja: osuma.kayttaja });
});

// Oman tunnuksen sidontatilanne SELAIMELLE. Eri reitti kuin /api/laite/oma, koska kysyjä
// on eri: selain kysyy "onko tunnuksellani laite", sovellus kysyy "kelpaanko minä".
//
// Malli ja sidonta-aika kerrotaan, ja se on tarkoitus: jos vartija näkee tässä jonkun
// toisen puhelimen mallin, hän tietää sidonnan olevan vanhassa laitteessa ja osaa pyytää
// hälytyskeskukselta nollausta.
app.get('/api/laite/tila', requireAuth, (req, res) => {
  const laite = (readCollection('devices') || []).find((l) => l.kayttaja === req.username) || null;
  // Sidonta ja valvonta ovat eri asioita, ja niiden sekoittaminen oli tämän kentän koko
  // syy: 10.9.2026 puhelin oli sidottu koko päivän eikä valvonta ollut käynnissä
  // hetkeäkään. Sidottu kertoo että laite on tunnistettu, valvontaElossa että se puhuu.
  const valvonta = valvonnanTila({ laite, muistiMs: laite ? lyontimuisti.viimeisin(laite.id) : null });
  res.json({
    ok: true,
    sidottu: !!laite,
    laite: laite
      ? { id: laite.id, malli: laite.malli, sidottu: laite.sidottu, ...valvonta }
      : null,
  });
});

// Sovellus tarkistaa oman sidontansa. Vastaa myös silloin kun sidonta on nollattu —
// juuri se on tieto jonka sovellus tarvitsee tietääkseen että on aika sitoa uudelleen.
app.get('/api/laite/oma', (req, res) => {
  const laite = laiteIstunto(req);
  if (!laite) return res.status(401).json({ ok: false, sidottu: false });
  res.json({ ok: true, sidottu: true, laiteId: laite.id, kayttaja: laite.kayttaja });
});

// Laitelista hälytyskeskukselle ja pääkäyttäjälle. Julkinen avain EI ole mukana: se ei
// ole salaisuus, mutta se ei myöskään kuulu listanäkymään jonka tehtävä on kertoa kenellä
// on laite ja mikä se on.
app.get('/api/laitteet', requireAuth, (req, res) => {
  if (!saaHallitaLaitteita(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta laitteiden hallintaan.' });
  }
  const laitteet = (readCollection('devices') || []).map((l) => ({
    id: l.id,
    kayttaja: l.kayttaja,
    malli: l.malli,
    sidottu: l.sidottu,
    ...valvonnanTila({ laite: l, muistiMs: lyontimuisti.viimeisin(l.id) }),
  }));
  res.json({ ok: true, laitteet });
});

// Sidonnan nollaus. Tämä on PURKU eikä uuden laitteen hyväksyntä: hälytyskeskus poistaa
// vanhan sidonnan ja jättää tilan auki, eikä näe tai valitse uutta laitetta. Siksi
// väärin käytettynä tämä pahimmillaan pakottaa vartijan sitomaan laitteensa uudelleen
// eikä anna kenellekään pääsyä mihinkään.
app.post('/api/laite/:id/nollaa', requireAuth, (req, res) => {
  if (!saaHallitaLaitteita(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta laitteiden hallintaan.' });
  }
  const laitteet = readCollection('devices') || [];
  const laite = laitteet.find((l) => l.id === req.params.id);
  if (!laite) return res.status(404).json({ ok: false, error: 'Laitetta ei löydy.' });

  writeCollection('devices', laitteet.filter((l) => l.id !== laite.id));
  // Myös muistista: muuten nollatun laitteen lyönti jäisi elämään listalla siihen asti
  // kunnes hiljenemisraja umpeutuu, ja nollaus näyttäisi epäonnistuneen.
  lyontimuisti.unohda(laite.id);
  logAudit({
    user: req.username,
    action: 'laite_nollattu',
    laite: laite.id,
    kohdeKayttaja: laite.kayttaja,
    ip: req.ip,
  });
  res.json({ ok: true });
});


// ====================== KÄYTTÄJÄTASOT ======================
// Tasot määräävät sivukartta-oikeudet (ks. roles.js). Vain pääkäyttäjä hallinnoi niitä.
app.get('/api/roles', requireAuth, requireAdmin, (req, res) => {
  res.json({ ok: true, roles: listRoles() });
});

app.post('/api/roles', requireAuth, requireAdmin, (req, res) => {
  const { name, description, permissions } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'Käyttäjätason nimi vaaditaan.' });
  }
  if (permissions !== undefined && (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions))) {
    return res.status(400).json({ ok: false, error: 'Virheellinen oikeusmuoto.' });
  }
  const luotu = createRole({ name, description, permissions });
  logAudit({ user: req.username, action: 'role_create', targetRole: luotu.id });
  res.json({ ok: true, role: luotu });
});

app.put('/api/roles/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body || {};
  if (!findRole(id)) {
    return res.status(404).json({ ok: false, error: 'Käyttäjätasoa ei löytynyt.' });
  }
  if (permissions !== undefined && (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions))) {
    return res.status(400).json({ ok: false, error: 'Virheellinen oikeusmuoto.' });
  }
  const paivitetty = updateRole(id, { name, description, permissions });
  logAudit({ user: req.username, action: 'role_update', targetRole: id });
  res.json({ ok: true, role: paivitetty });
});

app.delete('/api/roles/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  // Käytössä olevaa tasoa ei voi poistaa: käyttäjät jäisivät osoittamaan olemattomaan
  // tasoon, jolloin he menettäisivät kaikki oikeutensa selittämättä miksi.
  const kaytossa = listUsers().filter((u) => u.roleId === id);
  if (kaytossa.length > 0) {
    return res.status(409).json({
      ok: false,
      error: `Tasoa ei voi poistaa: se on käytössä ${kaytossa.length} käyttäjällä (${kaytossa.map((u) => u.username).join(', ')}).`,
    });
  }
  const tulos = deleteRole(id);
  if (!tulos.ok) return res.status(400).json(tulos);
  logAudit({ user: req.username, action: 'role_delete', targetRole: id });
  res.json({ ok: true });
});

// ====================== JAKOLINKIT ======================
// Julkinen latausreitti. EI requireAuthia — se on koko pointti: ulkopuolinen saa
// tiedoston pelkällä linkillä. Suojana ovat token, mahdollinen salasana, vanhentuminen
// ja latausraja (ks. shares.js), sekä oma rate limit alla.
//
// Kaikki estot vastaavat 404:llä, mutta virheviesti erottelee syyn (vanhentunut,
// peruutettu, latausraja). Se paljastaa arvaajalle että token oli oikea — tietoinen
// kompromissi: tokenin arvaaminen ei ole realistinen uhka (256 bittiä), ja
// vastaanottajalle "linkki on vanhentunut" on olennaisesti hyödyllisempi kuin
// "ei löytynyt" silloin kun linkki oikeasti vanheni.
const shareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liikaa yrityksiä. Odota hetki ja yritä uudelleen.' },
});

// --- Julkinen yleisöilmoitus (QR-juliste) -----------------------------------------
//
// Kaksi erillistä rajoitinta tarkoituksella. IP-kohtainen estää yhtä lähettäjää
// hakkaamasta reittiä; lomakekohtainen (julkinen.js: saaLahettaa) estää sen että sata
// eri IP-osoitetta täyttää yhden julisteen jonon. Kumpikaan yksin ei riitä.
const julkinenLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Ilmoituksia on lähetetty liikaa lyhyessä ajassa. Yritä hetken kuluttua uudelleen.' },
});

function etsiIlmoituslomake(token) {
  const lomakkeet = readCollection('publicForms') || [];
  return lomakkeet.find((l) => tokenTasmaa(token, l.token)) || null;
}

// Julisteen tiedot ennen lomakkeen näyttämistä: onko linkki voimassa ja mihin
// tapahtumaan se kuuluu. EI kerro mitään muuta tapahtumasta kuin nimen — tuntemattoman
// ei pidä saada tätä kautta tietoa siitä mitä alueella on tapahtunut.
app.get('/api/julkinen/:token', julkinenLimiter, (req, res) => {
  const lomake = etsiIlmoituslomake(req.params.token);
  const tila = lomakkeenTila(lomake);
  if (!tila.ok) return res.status(404).json({ ok: false, error: JULKINEN_SELITE[tila.syy] || 'Linkki ei ole käytettävissä.' });
  const tapahtuma = (readCollection('events') || []).find((e) => e.id === lomake.eventId);
  res.json({ ok: true, tapahtuma: tapahtuma?.name || '', paikka: lomake.nimi || '' });
});

// Yleisön lähettämä ilmoitus. EI vaadi kirjautumista — tämä on ainoa kirjoittava reitti
// joka ei sitä vaadi, ja siksi jokainen suoja on tässä eikä myöhemmin:
// määrärajoitus, tokenin voimassaolo, kenttien pituusrajat ja moderointijono.
app.post('/api/julkinen/:token', julkinenLimiter, express.json({ limit: '16kb' }), (req, res) => {
  const lomake = etsiIlmoituslomake(req.params.token);
  const tila = lomakkeenTila(lomake);
  if (!tila.ok) return res.status(404).json({ ok: false, error: JULKINEN_SELITE[tila.syy] || 'Linkki ei ole käytettävissä.' });

  if (!saaLahettaaIlmoituksen(lomake.id)) {
    return res.status(429).json({ ok: false, error: JULKINEN_SELITE.rate_limited });
  }

  const tarkistus = tarkistaIlmoitus(req.body);
  if (!tarkistus.ok) return res.status(400).json({ ok: false, error: tarkistus.error });

  const ilmoitukset = readCollection('publicReports') || [];
  const uusi = {
    id: `yi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    eventId: lomake.eventId,
    formId: lomake.id,
    createdAt: new Date().toISOString(),
    // Moderointijonon tila. Vasta hyväksyntä tekee tästä kirjauksen reports-kokoelmaan.
    tila: 'moderoitavana',
    ...tarkistus.ilmoitus,
  };
  writeCollection('publicReports', [uusi, ...ilmoitukset]);

  // Kerrotaan moderointijonosta niille jotka saavat sen nähdä. Kanava kuljettaa vain
  // id:n, joten moderoimaton teksti ei kulje sitä kautta kenellekään.
  lahetaKanavalle('publicReports', [{ action: 'create', id: uusi.id, eventId: uusi.eventId }], {
    saaNahda: (istunto, eventId) =>
      istunto?.role === 'admin' ||
      (eventAllowed(istunto?.eventAccess, eventId) && canView(rolePermissions(istunto?.roleId), eventId, 'public_reports')),
  });

  logAudit({ user: null, action: 'public_report_received', collection: 'publicReports', recordId: uusi.id, eventId: uusi.eventId });
  res.json({ ok: true });
});

// Julisteen token QR-koodia varten. Sama periaate kuin jakolinkeillä: token ei kulje
// listauksessa vaan haetaan erikseen, jotta se ei päädy jokaiseen välimuistiin ja lokiin
// jossa listaus käy.
app.get('/api/publicforms/:id/token', requireAuth, (req, res) => {
  const lomake = (readCollection('publicForms') || []).find((l) => l.id === req.params.id);
  if (!lomake) return res.status(404).json({ ok: false, error: 'Ilmoituslomaketta ei löytynyt.' });
  if (req.role !== 'admin' && !canEdit(req.permissions, lomake.eventId, 'public_reports')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tähän ilmoituslomakkeeseen.' });
  }
  res.json({ ok: true, token: lomake.token });
});

// Julisteen luonti. Oma reittinsä eikä /api/data/publicForms, koska token syntyy
// palvelimella eikä selain saa sitä koskaan asettaa: jos selain voisi valita tokenin,
// se voisi myös valita saman tokenin toiselle tapahtumalle ja ohjata ilmoitukset väärään
// jonoon.
app.post('/api/publicforms', requireAuth, (req, res) => {
  const { eventId, nimi, vrk } = req.body || {};
  if (typeof eventId !== 'string' || !eventId) {
    return res.status(400).json({ ok: false, error: 'Tapahtuma puuttuu.' });
  }
  // Julisteen tekeminen on sama oikeus kuin ilmoitusten moderointi (ks. permissions.js):
  // se joka päättää mistä ilmoituksia otetaan vastaan, myös käsittelee ne.
  if (req.role !== 'admin' && !(eventAllowed(req.eventAccess, eventId) && canEdit(req.permissions, eventId, 'public_reports'))) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta luoda ilmoituslomaketta tähän tapahtumaan.' });
  }
  const tapahtuma = (readCollection('events') || []).find((e) => e.id === eventId);
  if (!tapahtuma) return res.status(404).json({ ok: false, error: 'Tapahtumaa ei löytynyt.' });

  // Julisteen nimi on sen fyysinen sijainti ("Portti 3, itäaita"). Se ei ole
  // koristetta: se on ainoa tieto jolla väärinkäytetty juliste löydetään maastosta ja
  // otetaan pois, joten se vaaditaan.
  const paikka = String(nimi ?? '').trim().slice(0, 120);
  if (paikka.length < 2) {
    return res.status(400).json({ ok: false, error: 'Anna julisteelle sijainti, esimerkiksi "Portti 3".' });
  }

  const voimassaolo = ratkaiseJulisteenVoimassaolo({ vrk }, new Date());
  if (voimassaolo.error) return res.status(400).json({ ok: false, error: voimassaolo.error });

  const lomake = {
    id: crypto.randomUUID(),
    eventId,
    nimi: paikka,
    token: luoIlmoitusToken(),
    expiresAt: voimassaolo.expiresAt,
    createdBy: req.username,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  writeCollection('publicForms', [...(readCollection('publicForms') || []), lomake]);
  logAudit({ user: req.username, action: 'public_form_create', collection: 'publicForms', recordId: lomake.id, eventId });

  // Token palautetaan tässä, jotta QR-koodin voi näyttää heti luonnin jälkeen.
  res.json({ ok: true, lomake: julkinenLomake(lomake), token: lomake.token });
});

// Peruutus. Kuten jakolinkeillä: tietuetta ei poisteta vaan se merkitään peruutetuksi,
// koska jälkikäteen on tärkeämpää tietää mistä julisteesta ilmoitukset tulivat kuin
// pitää kokoelma siistinä. Saapuneet ilmoitukset viittaavat tähän id:hen.
app.delete('/api/publicforms/:id', requireAuth, (req, res) => {
  const lomakkeet = readCollection('publicForms') || [];
  const lomake = lomakkeet.find((l) => l.id === req.params.id);
  if (!lomake) return res.status(404).json({ ok: false, error: 'Ilmoituslomaketta ei löytynyt.' });
  if (req.role !== 'admin' && !canEdit(req.permissions, lomake.eventId, 'public_reports')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta poistaa tätä ilmoituslomaketta käytöstä.' });
  }
  writeCollection('publicForms', lomakkeet.map((l) => (l.id === lomake.id
    ? { ...l, revokedAt: new Date().toISOString(), revokedBy: req.username }
    : l)));
  logAudit({ user: req.username, action: 'public_form_revoke', collection: 'publicForms', recordId: lomake.id, eventId: lomake.eventId });
  res.json({ ok: true });
});

// --- Kierrospohjat ja kierrokset (P6 + proof of presence) -------------------------
//
// Pohjia ja kierroksia hallitaan omilla reiteillään eikä geneerisen kokoelmareitin
// kautta. Pohjilla syy on sama kuin julisteilla (token syntyy palvelimella), kierroksilla
// eri ja tärkeämpi: kierroksen säännöt ovat sen ainoa sisältö. Kierros joka voidaan
// merkitä valmiiksi vajaana ei todista mitään.

// Pohjan omistaja: vartiointikohde tai tapahtuma. Sama id-avaruus kuin oikeuksissa
// (ks. permissions.js: eventScoped), joten tunnistus tehdään katsomalla kummasta
// kokoelmasta id löytyy. Erillistä tyyppikenttää EI oteta vastaan pyynnöstä: silloin
// selain voisi väittää tapahtumapohjaa kohdepohjaksi ja ohittaa tuoteportin.
function omistajanTiedot(ownerId) {
  const kohde = (readCollection('guardSites') || []).find((k) => k.id === ownerId);
  if (kohde) return { onKohde: true, nimi: kohde.name || '' };
  const tapahtuma = (readCollection('events') || []).find((e) => e.id === ownerId);
  if (tapahtuma) return { onKohde: false, nimi: tapahtuma.name || '' };
  return null;
}

// Onko pohja tai suoritus kohteen (GUARD) vai tapahtuman (EVENT). Kierrospohja on aina
// kohteen, vaikka vanhassa tietueessa ei olisi omistaja-kenttää lainkaan.
const onKohteenPohja = (tietue) => tietue?.omistaja === 'kohde' || tietue?.kind === 'patrol';

// Tuoteportti omistajan mukaan: kohteen pohjat ovat GUARD-puolen tietoa, tapahtuman
// pohjat EVENT-puolen. Aiemmin koko templates-kokoelma oli guardPortin takana, mutta
// erän 8 jälkeen siellä on molempien puolien pohjia.
const tuoteOk = (req, onKohde) => (req.tuotteet || []).includes(onKohde ? 'guard' : 'event');

// Saako käyttäjä MUOKATA tämän lajin pohjia tällä omistajalla. Pohjan laatiminen on
// esimiehen työtä: kierrospohjalla se on eri solmu kuin kierroksen kulkeminen, ja muilla
// lajeilla eri oikeus (edit) kuin käyttäminen (view).
function saaPohjia(req, ownerId, kind, onKohde) {
  if (req.role === 'admin') return true;
  if (!tuoteOk(req, onKohde)) return false;
  return eventAllowed(req.eventAccess, ownerId)
    && canEdit(req.permissions, ownerId, lajinSolmu(kind, onKohde));
}

// Saako käyttäjä KÄYTTÄÄ pohjaa: lukea ohjekortin tai käynnistää skenaarion. Lukuoikeus
// riittää tarkoituksella (ks. sivukartan perustelu): käyttö on saman tietueen lukemista,
// eikä erillinen "saa käyttää" -oikeus rajaisi mitään sellaista mitä lukuoikeus ei jo
// rajaa. Kierroksella on oma sääntönsä (saaKiertaa), koska kulkeminen on oma solmunsa.
function saaKayttaaPohjaa(req, ownerId, kind, onKohde) {
  if (req.role === 'admin') return true;
  if (!tuoteOk(req, onKohde)) return false;
  return eventAllowed(req.eventAccess, ownerId)
    && canView(req.permissions, ownerId, lajinSolmu(kind, onKohde));
}

function saaKiertaa(req, siteId) {
  if (req.role === 'admin') return true;
  return eventAllowed(req.eventAccess, siteId) && canEdit(req.permissions, siteId, 'guard_patrols');
}

// Tuoteportti erikseen: GUARD-puolen reitit eivät saa aueta tunnukselle jolla ei ole
// pääsyä sinne, vaikka sivukartta-oikeudet sattuisivat olemaan kunnossa.
const guardPortti = (req, res, next) => {
  if (!(req.tuotteet || []).includes('guard')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia vartiointipuolen tietoihin.' });
  }
  next();
};

// ====================== VUOROT (erä 16) ======================
//
// Vuorotyypit ovat kohteen kenttä eivätkä oma kokoelmansa, joten niiden luku ja
// kirjoitus kulkevat guardSites-kokoelman tavallista tietä. Täällä on vain se mitä
// kohdetietue ei suoraan kerro: kenen vuoro on kenenkin, ja kuka voidaan perehdyttää.

// Vartijan omat vuorovaihtoehdot kirjautumisnäkymälle.
//
// VAIN KYSYJÄN OMAT, ja se on tietosuojaraja eikä optimointi. Kohteen perehdytyslista on
// nimilista siitä kuka on perehdytetty — henkilötietoa, joka on tarkoituksella jätetty
// pois laitteelle jäävästä kopiosta (src/shared/vuorodata.ts). Tämä reitti ei saa
// kiertää sääntöä palauttamalla saman tiedon toisessa muodossa, joten se palauttaa
// johtopäätöksen ("näihin vuoroihin sinä pääset") eikä aineistoa josta se on tehty.
//
// Kohdejoukko tulee readableDatasta eikä omasta säännöstä: silloin vuorolista ei voi
// näyttää kohdetta jota käyttäjä ei muutenkaan saisi lukea.
app.get('/api/vuorot/omat', requireAuth, guardPortti, (req, res) => {
  const luettavat = readableData(
    req.role, req.permissions, req.eventAccess, 'guardSites', readCollection('guardSites')
  );
  if (!luettavat.ok) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia kohteiden lukemiseen.' });
  }
  const kaikki = luettavat.data || [];
  const kohteet = vuorovaihtoehdot({ kohteet: kaikki, username: req.username });

  // Kuinka moni luettava kohde jäi pois perehdytyksen puuttumisen takia. Tämä ei vuoda
  // mitään — kohteet ovat kutsujan luettavissa muutenkin — mutta se vastaa kysymykseen
  // "miksi listani on lyhyt" ilman että siitä pitää soittaa jollekulle.
  const nakyvat = new Set(kohteet.map((k) => k.siteId));
  const ilmanPerehdytysta = kaikki
    .filter((k) => !k.archived && (k.vuorotyypit || []).some((v) => v && !v.arkistoitu))
    .filter((k) => !nakyvat.has(k.id)).length;

  res.json({ ok: true, kohteet, ilmanPerehdytysta, joustoMin: JOUSTO_MIN });
});

// Ketkä voidaan perehdyttää tähän kohteeseen.
//
// Oma kapea reittinsä eikä /api/users, joka on pääkäyttäjän takana: kohteita voi hallita
// ilman pääkäyttäjyyttä, eikä perehdytyksen kirjaaminen saa vaatia koko käyttäjähallinnan
// oikeuksia. Palautetaan vain se mitä valintaan tarvitaan — tunnus, näyttönimi ja
// tunnistenumero — eikä rooleja, oikeuksia tai kirjautumistietoja.
//
// Joukko lasketaan OIKEUKSISTA eikä erillisestä listasta, samasta syystä kuin
// tiedotteenVastaanottajat: erillinen lista vanhenisi heti, ja kaksi totuutta siitä kuka
// kohteessa työskentelee olisi pahempi kuin yksi.
//
// PÄÄKÄYTTÄJÄT OVAT MUKANA, ja tämä korjattiin 10.9.2026 jälkikäteen.
//
// Aluksi heidät rajattiin pois `tiedotteenVastaanottajat`-funktion mallilla ("pääkäyttäjä
// näkee kaiken oikeuksiensa puolesta"). Perustelu ei siirry tänne: perehdytys ei ole
// näkyvyysoikeus vaan kirjaus siitä että joku on koulutettu tähän kohteeseen ja vuoroon.
//
// Rajaus tuotti umpikujan. Vuorolista (/api/vuorot/omat) rajaa perehdytyksen mukaan
// EIKÄ tunne pääkäyttäjäpoikkeusta — pääkäyttäjä ei siis olisi päässyt yhteenkään
// vuoroon, koska hänelle ei voinut kirjata perehdytystä. Pienessä vartiointiliikkeessä
// sama ihminen hallinnoi järjestelmää ja tekee vuoroja, joten se ei ole reunatapaus.
app.get('/api/kohde/:id/perehdytettavat', requireAuth, guardPortti, (req, res) => {
  const siteId = req.params.id;
  if (req.role !== 'admin' && !canEdit(req.permissions, siteId, 'guard_sites')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta kohteen perehdytyksiin.' });
  }
  const kayttajat = listUsers()
    .filter((u) => paaseeTuotteisiin(u).includes('guard'))
    .filter((u) => {
      // Pääkäyttäjä pääsee kaikkialle roolinsa nojalla, eikä se näy käyttäjätasossa —
      // `rolePermissions` ei siis kerro hänestä mitään ja solmutarkistus hylkäisi hänet.
      if (u.role === 'admin') return true;
      if (!eventAllowed(u.eventAccess, siteId)) return false;
      // Kentällä työskentely voi näkyä useassa solmussa riippuen tasosta: toinen tekee
      // kierroksia, toinen tehtäviä, kolmas lukee kohteen ohjeita. Mikä tahansa niistä
      // riittää, koska kysymys on "voiko tämä henkilö olla täällä töissä".
      const oikeudet = rolePermissions(u.roleId);
      return canView(oikeudet, siteId, 'guard_site_info')
        || canView(oikeudet, siteId, 'guard_patrols')
        || canView(oikeudet, siteId, 'guard_tasks');
    })
    .map((u) => ({ username: u.username, nimi: u.nickname || u.username, displayId: u.displayId ?? null }));
  res.json({ ok: true, kayttajat });
});

// --- Vuoron elinkaari ---------------------------------------------------------------

// Kuka saa myöntää kertaluvan vuoroon johon vartijalla ei ole perehdytystä.
//
// Sama `guard_dispatch`-valtuus kuin laitesidonnan nollauksella, ja samasta syystä: yöllä
// sairastapauksessa päivystäjä on se joka on paikalla. Poikkeus jonka voi myöntää on
// parempi kuin sääntö jonka voi kiertää — kierretty sääntö ei jätä lokiin mitään.
const saaMyontaaKertaluvan = (req) =>
  req.role === 'admin' || canEdit(req.permissions, null, 'guard_dispatch');

// Saako tunnus tehdä työtä tässä kohteessa. Kierrokset TAI tehtävät riittää: vuoro voi
// koostua kummasta tahansa, eikä pelkkiä tehtäviä tekevää saa estää aloittamasta vuoroa.
const saaTyoskennella = (req, siteId) =>
  req.role === 'admin'
  || canEdit(req.permissions, siteId, 'guard_patrols')
  || canEdit(req.permissions, siteId, 'guard_tasks');

// Kanavaviesti vuoron muutoksesta. Sama periaate kuin kierroksilla: viesti kuljettaa vain
// id:n, ja sisältö haetaan oikeustarkistetulta reitiltä.
function kerroVuorosta(vuoro, action) {
  lahetaKanavalle('guardShifts', [{ action, id: vuoro.id, eventId: vuoro.siteId }], {
    saaNahda: (istunto, siteId) =>
      istunto?.role === 'admin'
      || (eventAllowed(istunto?.eventAccess, siteId)
        && (canView(rolePermissions(istunto?.roleId), siteId, 'guard_patrols')
          || canView(rolePermissions(istunto?.roleId), null, 'guard_dispatch'))),
  });
}

// Oma kesken oleva vuoro. Selain kysyy tämän käynnistyessään: vuoron totuus on
// palvelimella, ja laitteen localStorage on vain kopio jonka voi menettää.

// Hälytyskeskuksen pakottama tarkistus: "vastaa nyt".
//
// TOTEUTUS ON VUORON KUITTAUSAJASTIN, ei uusi mekanismi. Vartijan käynnissä oleva
// ajastin siirretään erääntymään vastausajan päähän; jos ajastinta ei ole (kohteella ei
// ole kuittausvalvontaa päällä), sellainen luodaan. Seuraus on siis täsmälleen sama kuin
// tavallisessa kuittauksessa, ja päivystäjä näkee sen samassa listassa samana
// hälytystyyppinä.
//
// TÄMÄ TOIMII MYÖS SAMMUNEELLA PUHELIMELLA. Kanavaviesti on nopea tie kyselyyn, mutta
// se ei ole ehto: ajastin erääntyy palvelimella riippumatta siitä tavoittiko viesti
// laitetta. Vastaus kertoo montako avointa yhteyttä viesti tavoitti, jotta päivystäjä
// näkee heti onko puhelin verkossa — nolla ei tarkoita että tarkistus epäonnistui, vaan
// että vastausta kannattaa odottaa hitaammin.

// Kesken olevat vuorot päivystäjälle.
//
// TÄMÄ ON ERI LISTA KUIN "Kentällä juuri nyt", ja ero on koko syy sille että tämä on
// olemassa. Se lista johdetaan KIRJAUKSISTA, eli vartija joka ei ole kirjannut mitään ei
// näy siinä — ja juuri hänestä päivystäjä on huolissaan. 13.9.2026 pakotettu tarkistus
// laitettiin ensin siihen listaan, ja se oli hyödytön täsmälleen siinä tilanteessa jota
// varten se rakennettiin.
//
// Palauttaa vain sen mitä päivystäjä tarvitsee: kuka, missä, mistä asti. Ei vuoron
// sisältöä eikä tehtäviä.
app.get('/api/vuoro/kaynnissa', requireAuth, guardPortti, (req, res) => {
  const kaikki = (readCollection('guardShifts') || []).filter((v) => v?.tila === 'kesken');
  // Näkyvyys kohteittain: päivystäjä näkee ne vuorot joiden kohteeseen hänellä on
  // hälytysoikeus. Sama sääntö kuin hälytysten katselussa, koska tästä listasta
  // pääsee pakottamaan tarkistuksen.
  const vuorot = kaikki.filter((v) => {
    if (req.role === 'admin') return true;
    if (!eventAllowed(req.eventAccess, v.siteId)) return false;
    return canView(req.permissions, v.siteId, 'alarms')
      || canView(req.permissions, v.siteId, 'guard_alarms');
  });
  // Vuoron MÄÄRÄAIKA mukaan (käyttäjän päätös 15.9.2026: unohtunut vuoro).
  //
  // Palvelin laskee määräajan, selain laskee myöhästymisminuutit. Työnjako on harkittu:
  // määräajan laskeminen kellonajasta ("07:00") vaatii tiedon siitä ylittääkö vuoro
  // puolenyön, ja vuorotyyppi on kohteen kenttä jota tämä lista ei muuten palauta —
  // selain joutuisi hakemaan jokaisen kohteen tiedot vain kertoakseen että vuoro on
  // myöhässä. Minuuttien laskeminen taas on vähennyslasku joka on tehtävä tikittävästä
  // kellosta, eikä palvelimen luku vanhene oikein selaimen välimuistissa.
  const kohteet = readCollection('guardSites') || [];
  const maaraaika = (v) => {
    const kohde = kohteet.find((k) => k?.id === v.siteId);
    const tyyppi = (kohde?.vuorotyypit || []).find((t) => t?.id === v.vuorotyyppiId);
    const loppu = vuoronPaattymisaika(v.alkoi, tyyppi?.paattyy);
    return loppu ? loppu.toISOString() : null;
  };

  res.json({
    ok: true,
    vuorot: vuorot.map((v) => ({
      id: v.id, vartija: v.vartija, siteId: v.siteId, alkoi: v.alkoi,
      vuorotyyppiNimi: v.vuorotyyppiNimi || null,
      // null = vuorotyypillä ei ole kellonaikaa. Kellonajaton lisävuoro ei voi olla
      // myöhässä, koska sillä ei ole aikaa josta myöhästyä.
      paattyyArvio: maaraaika(v),
    })),
  });
});
app.post('/api/vuoro/tarkistus', requireAuth, guardPortti, (req, res) => {
  const vartija = typeof req.body?.vartija === 'string' ? req.body.vartija.trim() : '';
  if (!vartija) return res.status(400).json({ ok: false, error: 'Vartija puuttuu.' });

  const vuoro = keskenOlevaVuoro(readCollection('guardShifts') || [], vartija);
  if (!vuoro) {
    return res.status(409).json({ ok: false, error: 'Vartijalla ei ole vuoroa käynnissä.' });
  }
  // Oikeus on sama kuin hälytyksen kuittaamiseen: pakotettu tarkistus voi päätyä
  // hälytykseksi, eikä sitä saa laukaista kuka tahansa joka näkee vuoron.
  const saa = req.role === 'admin'
    || canEdit(req.permissions, vuoro.siteId, 'alarms')
    || canEdit(req.permissions, vuoro.siteId, 'guard_alarms');
  if (!saa) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta pakottaa tarkistusta.' });
  }

  const nyt = Date.now();
  const lista = readCollection('alerts') || [];
  const auki = lista.find(
    (h) => h?.tyyppi === 'ajastin' && h?.tila === 'kaynnissa' && h?.vartija === vartija
  );

  let halytys;
  if (auki) {
    halytys = {
      ...auki,
      eraantyy: nyt + KUITTAUS_VASTAUSAIKA_MIN * 60000,
      // merkinta() eikä käsin koottu olio. Tässä oli 13.9.2026 asti oma muotonsa —
      // `laji` eikä `tapahtuma`, `aika` eikä `ts` — eli sama tapahtumalaji kirjattiin
      // kahdella eri avainnimellä sen mukaan kuka sen kirjoitti. Selaimen Halytys-tyyppi
      // lupaa `{ ts, tapahtuma }`, joten nämä merkinnät eivät vastanneet omaa tyyppiään
      // eikä niitä löytänyt sieltä mistä niitä etsi.
      historia: [...(auki.historia || []), merkinta('tarkistus', {
        user: req.username,
        teksti: 'Hälytyskeskus pyysi tarkistusta',
      }, nyt)],
    };
    writeCollection('alerts', lista.map((h) => (h.id === auki.id ? halytys : h)));
  } else {
    const tulos = luoAjastin({
      id: crypto.randomUUID(),
      vartija,
      eventId: vuoro.siteId,
      minuutit: KUITTAUS_VASTAUSAIKA_MIN,
      kuvaus: 'Hälytyskeskuksen pyytämä tarkistus',
      nyt,
    });
    if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
    // Sama merkintä kuin siirtohaarassa, ja tämä on se haara joka oikeasti ajetaan
    // useimmiten: kohteella jolla ei ole rutiinikuittausta ei ole ajastinta siirrettäväksi,
    // joten pakotettu tarkistus luo aina uuden. Ilman tätä riviä tietueessa ei lue
    // missään että kyse oli päivystäjän pyytämästä tarkistuksesta — `luoAjastin` merkitsee
    // luojaksi VARTIJAN, koska ajastin on hänen nimissään.
    //
    // Mitattu 13.9.2026: neljä peräkkäistä tarkistusta tallentui tietueina joista ei voinut
    // päätellä kuka ne pyysi, eivätkä ne siksi näkyneet hälytyskeskuksen tarkistuslistalla.
    // Vika löytyi vasta kun tuotannon tietueet luettiin — käyttöliittymä näytti vain tyhjää,
    // eli täsmälleen samalta kuin ennen koko korjausta.
    halytys = {
      ...tulos.halytys,
      historia: [...(tulos.halytys.historia || []), merkinta('tarkistus', {
        user: req.username,
        teksti: 'Hälytyskeskus pyysi tarkistusta',
      }, nyt)],
    };
    writeCollection('alerts', [halytys, ...lista]);
  }

  kerroHalytyksesta(halytys, auki ? 'update' : 'create');
  // AJASTIMEN TUNNUS ON MUKANA VIESTISSÄ, ja se on pakollinen eikä lisätieto.
  //
  // Sovellus tallentaa tunnuksen vasta luodessaan ajastimen itse (Kuittaus.aloita), eli
  // vain kun kohteella on kuittausvalvonta päällä. Pakotettu tarkistus toimii myös ilman
  // sitä — palvelin luo ajastimen tässä — mutta silloin puhelin ei tiedä mitä ajastinta
  // se kuittaa.
  //
  // Mitattu 13.9.2026 ensimmäisellä kokeilulla: vartija painoi "Kuittaa", sovellus
  // kirjasi `kuittaus_kuitattu ei_ajastinta` eikä lähettänyt mitään, ja ajastin erääntyi
  // puolitoista minuuttia myöhemmin. Vartija teki oikein ja järjestelmä hälytti silti —
  // se on tämän toiminnon pahin mahdollinen vikatila.
  const laitteita = lahetaViesti(
    { tyyppi: 'tarkistus', id: halytys.id },
    { suodatin: (istunto) => istunto?.username === vartija }
  );
  logAudit({
    user: req.username, action: 'guard_forced_check', collection: 'alerts',
    recordId: halytys.id, eventId: vuoro.siteId, targetUser: vartija,
  });
  res.json({ ok: true, halytys, laitteita });
});
app.get('/api/vuoro/oma', requireAuth, guardPortti, (req, res) => {
  const vuoro = keskenOlevaVuoro(readCollection('guardShifts') || [], req.username);
  // Man-down-asetus kulkee TÄSSÄ vastauksessa eikä omassa päätepisteessään.
  //
  // Natiivisovellus kysyy tämän joka tapauksessa vuoron alussa varmistaakseen että vuoro
  // on oikeasti olemassa (ks. SiltaActivity), joten asetus tulee ilman yhtään uutta
  // kutsua, ilman uutta allekirjoitusta ja täsmälleen samalla hetkellä kuin vuoro
  // vahvistetaan. Oma päätepiste olisi toinen pyyntö joka voi epäonnistua erikseen — ja
  // silloin sovelluksen pitäisi päättää mitä tehdä vuorolla jonka asetusta se ei tiedä.
  const kohde = vuoro
    ? (readCollection('guardSites') || []).find((k) => k?.id === vuoro.siteId)
    : null;
  // Oman vuoron määräaika. Vartija saa huomion kymmenen minuutin jälkeen — se on hänen
  // mahdollisuutensa korjata asia itse ennen kuin hälytyskeskus alkaa selvittää.
  //
  // Määräaika eikä minuuttiluku, ja tässä syy on erityisen selvä: oma vuoro haetaan
  // kerran sovellusta avattaessa eikä sitä pollata. Palvelimella laskettu minuuttiluku
  // olisi se mikä se oli avaushetkellä, eikä huomio ilmestyisi koskaan kesken vuoron.
  const omaTyyppi = vuoro
    ? (kohde?.vuorotyypit || []).find((t) => t?.id === vuoro.vuorotyyppiId)
    : null;
  const omaPaattyy = vuoro ? vuoronPaattymisaika(vuoro.alkoi, omaTyyppi?.paattyy) : null;

  res.json({
    ok: true,
    vuoro: vuoro ? { ...vuoro, paattyyArvio: omaPaattyy ? omaPaattyy.toISOString() : null } : vuoro,
    mandown: vuoro ? mandownAsetukset(kohde) : null,
    kuittaus: vuoro ? kuittausAsetukset(kohde) : null,
  });
});

// ====================== PTT-KANAVAT (erä 26, vaihe 1) ======================
//
// Vapaat ryhmät ja hätäkanava tulevat myöhemmässä erässä (ks. server/kanavat.js:n
// tiedostokommentti). DM (vaihe 1c) on mukana.

const pttPortti = (req, res) => {
  if (req.role !== 'admin' && !canView(req.permissions, null, 'guard_ptt')) {
    res.status(403).json({ ok: false, error: 'Ei oikeuksia PTT-kanaviin.' });
    return false;
  }
  return true;
};

app.get('/api/kanavat/omat', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const vuoro = keskenOlevaVuoro(readCollection('guardShifts') || [], req.username);
  // HÄLKE-jäsenyys hätäkanavalle ei tule osallistujalistasta vaan guard_dispatch-
  // oikeudesta juuri nyt (ks. kanavat.js: hätäkanavan tiedostokommentti) — lasketaan
  // kerran eikä jokaiselle kanavalle erikseen.
  const onPaivystaja = req.role === 'admin' || canView(req.permissions, null, 'guard_dispatch');
  const tallennetut = (readCollection('guardKanavat') || [])
    .filter((k) => (
      k.tyyppi === 'hata' ? (k.vartija === req.username || onPaivystaja) : onOsallistuja(k, req.username)
    ))
    .map((k) => ({
      id: k.id,
      tyyppi: k.tyyppi,
      nimi: (() => {
        if (k.tyyppi === 'dm') {
          // Nimeksi TOINEN osapuoli, ei oma tunnus — käyttöliittymän on näytettävä
          // kenen kanssa keskustellaan, ei "minä ja joku".
          return (k.osallistujat || []).find((o) => o !== req.username) || '';
        }
        if (k.tyyppi === 'hata') {
          return `${HALYTYSTYYPIT[k.halytysTyyppi]?.label || 'Hätäkanava'} — ${k.vartija}`;
        }
        return k.nimi || '';
      })(),
      // Vain hätäkanavalla: kertoo onko HÄLKE pakottanut linjan auki (vaihe 1e).
      ...(k.tyyppi === 'hata' ? { haltePidaHengissa: k.haltePidaHengissa || null } : {}),
      // DM ja vapaa: osallistujalista sellaisenaan (vaihe 3) — asiakas tarvitsee sen
      // tietääkseen kenelle huoneavain jaetaan (src/shared/olm.ts: jaaHuoneenAvain).
      // Ei uutta tietovuotoa: osapuolet näkevät jo toisensa olemalla samassa kanavassa.
      ...(k.tyyppi === 'dm' || k.tyyppi === 'vapaa' ? { osallistujat: k.osallistujat || [] } : {}),
    }));
  res.json({ ok: true, kanavat: [...omatKiinteatKanavat(vuoro), ...tallennetut] });
});

// DM-vastaanottajaehdokkaat: muut käyttäjät jotka ovat juuri nyt vuorossa samalla
// tuotepuolella (käyttäjän päätös 19.9.2026 — pitää DM:n "vuoron sisäinen työkalu"
// -hengessä kuten kanavatkin).
app.get('/api/kanavat/dm/ehdokkaat', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const omatTuotteet = new Set(req.tuotteet || []);
  const ehdokkaat = vuorossaOlevatMuut(readCollection('guardShifts') || [], req.username)
    .map((kayttaja) => listUsers().find((u) => u.username === kayttaja))
    .filter((u) => u && paaseeTuotteisiin(u).some((t) => omatTuotteet.has(t)))
    .map((u) => ({ username: u.username, nimi: u.nickname || u.username }));
  res.json({ ok: true, ehdokkaat });
});

// DM:n aloitus. Palauttaa olemassa olevan kanavan jos osapuolten välillä on jo yksi —
// idempotentti samasta syystä kuin vuoron vastaanotto (halytystehtava.js: vastaanota):
// "aloita keskustelu" -painikkeen toistuva painallus ei saa luoda uutta kanavaa joka kerta.
app.post('/api/kanavat/dm', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const vastaanottaja = typeof req.body?.vastaanottaja === 'string' ? req.body.vastaanottaja : '';
  if (!vastaanottaja) return res.status(400).json({ ok: false, error: 'Vastaanottaja vaaditaan.' });

  const vuorot = readCollection('guardShifts') || [];
  if (!keskenOlevaVuoro(vuorot, req.username)) {
    return res.status(403).json({ ok: false, error: 'DM vaatii kesken olevan vuoron.' });
  }
  if (!keskenOlevaVuoro(vuorot, vastaanottaja)) {
    return res.status(400).json({ ok: false, error: 'Vastaanottaja ei ole vuorossa juuri nyt.' });
  }
  const vastaanottajanTiedot = listUsers().find((u) => u.username === vastaanottaja);
  if (!vastaanottajanTiedot) return res.status(404).json({ ok: false, error: 'Vastaanottajaa ei löytynyt.' });
  const omatTuotteet = new Set(req.tuotteet || []);
  if (!paaseeTuotteisiin(vastaanottajanTiedot).some((t) => omatTuotteet.has(t))) {
    return res.status(403).json({ ok: false, error: 'Vastaanottaja ei ole samalla tuotepuolella.' });
  }

  const kanavat = readCollection('guardKanavat') || [];
  const olemassaOleva = loydaDm(kanavat, req.username, vastaanottaja);
  if (olemassaOleva) {
    return res.json({ ok: true, kanava: { id: olemassaOleva.id, tyyppi: 'dm', nimi: vastaanottaja } });
  }

  const tulos = luoDmKanava({ id: crypto.randomUUID(), kayttaja1: req.username, kayttaja2: vastaanottaja });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('guardKanavat', [...kanavat, tulos.kanava]);
  logAudit({
    user: req.username, action: 'ptt_dm_luotu', collection: 'guardKanavat', recordId: tulos.kanava.id,
  });
  // Vastaanottajalle ilmoitetaan heti — muuten hän huomaisi uuden DM:n vasta seuraavalla
  // manuaalisella päivityksellä. Lähettäjä tietää jo mitä teki (sama periaate kuin
  // kanava.js:n `lahettaja`-ohituksella), joten hänelle ei tarvitse kertoa erikseen.
  kerroKanavastaMuutos('create', tulos.kanava, (istunto) => (
    istunto?.username !== req.username && onOsallistuja(tulos.kanava, istunto?.username)
  ));
  res.json({ ok: true, kanava: { id: tulos.kanava.id, tyyppi: 'dm', nimi: vastaanottaja } });
});

// Linjan pakotus (vaihe 1e): sama `guard_dispatch` MUOKKAUS -valtuus kuin laitesidonnan
// nollauksella ja kertaluvan myöntämisellä (ks. saaHallitaLaitteita/saaMyontaaKertaluvan)
// — tämä on päivystäjän poikkeuksellinen oikeus, ei kaikkien guard_ptt NÄKY -oikeudella
// varustettujen jo muutenkin saama pääsy hätäkanavalle.
const saaPakottaaLinjan = (req) =>
  req.role === 'admin' || canEdit(req.permissions, null, 'guard_dispatch');

// Palauttaa haetun hätäkanavan tai lähettää virhevastauksen ja palauttaa nullin.
function haeHataKanava(req, res) {
  const kanavat = readCollection('guardKanavat') || [];
  const kanava = kanavat.find((k) => k.id === req.params.id);
  if (!kanava || kanava.tyyppi !== 'hata') {
    res.status(404).json({ ok: false, error: 'Hätäkanavaa ei löytynyt.' });
    return null;
  }
  return { kanavat, kanava };
}

app.post('/api/kanavat/:id/pakota-linja-auki', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  if (!saaPakottaaLinjan(req)) {
    return res.status(403).json({ ok: false, error: 'Vain hälytyskeskus voi pakottaa linjan auki.' });
  }
  const loytyi = haeHataKanava(req, res);
  if (!loytyi) return;
  const { kanavat, kanava } = loytyi;

  const paivitetty = pakotaLinjaAuki(kanava, req.username);
  writeCollection('guardKanavat', kanavat.map((k) => (k.id === kanava.id ? paivitetty : k)));
  logAudit({
    user: req.username, action: 'ptt_linja_pakotettu', collection: 'guardKanavat', recordId: kanava.id,
  });
  kerroKanavastaMuutos('update', paivitetty, (istunto) => (
    istunto?.username === paivitetty.vartija || canView(rolePermissions(istunto?.roleId), null, 'guard_dispatch')
  ));
  // Suora käsky hälyttäjän omalle laitteelle: se avaa linjan heti sen sijaan että
  // odottaisi tavallista muutosilmoitusta ja päättelisi tilan siitä itse. Käsky EI myönnä
  // puheenvuoroa suoraan — asiakas pyytää sen tavallista `pyyda_puheenvuoro`-reittiä
  // pitkin, joka nyt (tämän erän myötä) tunnistaa hätäkanavan jäsenyyden.
  lahetaViesti(
    { tyyppi: 'linja_pakotettu_auki', kanavaId: kanava.id, pakottaja: req.username },
    { suodatin: (istunto) => istunto?.username === paivitetty.vartija },
  );
  res.json({ ok: true, kanava: paivitetty });
});

app.post('/api/kanavat/:id/vapauta-linjan-pakotus', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  if (!saaPakottaaLinjan(req)) {
    return res.status(403).json({ ok: false, error: 'Vain hälytyskeskus voi vapauttaa pakotuksen.' });
  }
  const loytyi = haeHataKanava(req, res);
  if (!loytyi) return;
  const { kanavat, kanava } = loytyi;
  if (!kanava.haltePidaHengissa) return res.json({ ok: true, kanava });

  const paivitetty = vapautaLinjanPakotus(kanava);
  writeCollection('guardKanavat', kanavat.map((k) => (k.id === kanava.id ? paivitetty : k)));
  logAudit({
    user: req.username, action: 'ptt_linjan_pakotus_vapautettu', collection: 'guardKanavat', recordId: kanava.id,
  });
  kerroKanavastaMuutos('update', paivitetty, (istunto) => (
    istunto?.username === paivitetty.vartija || canView(rolePermissions(istunto?.roleId), null, 'guard_dispatch')
  ));
  lahetaViesti(
    { tyyppi: 'linjan_pakotus_vapautettu', kanavaId: kanava.id },
    { suodatin: (istunto) => istunto?.username === paivitetty.vartija },
  );
  res.json({ ok: true, kanava: paivitetty });
});

// Vapaa ryhmä (vaihe 1g): sama guard_dispatch MUOKKAUS -valtuus kuin linjan pakotuksella
// — tämä on hallinnollinen toiminto, ei kaikkien guard_ptt NÄKY -oikeudella varustettujen.
const saaHallinnoidaVapaitaRyhmia = (req) =>
  req.role === 'admin' || canEdit(req.permissions, null, 'guard_dispatch');

app.post('/api/kanavat/vapaa', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  if (!saaHallinnoidaVapaitaRyhmia(req)) {
    return res.status(403).json({ ok: false, error: 'Vain hälytyskeskus voi perustaa ryhmiä.' });
  }
  const nimi = typeof req.body?.nimi === 'string' ? req.body.nimi : '';
  const pyydetyt = Array.isArray(req.body?.osallistujat)
    ? req.body.osallistujat.filter((k) => typeof k === 'string')
    : [];

  // Jokaisen osallistujan on oltava olemassa oleva GUARD-puolen käyttäjä — PTT on
  // kokonaan GUARD-ominaisuus, joten tuotepuolivertailua ei tarvita (toisin kuin DM:ssä,
  // jossa molemmat osapuolet voivat olla kummalla puolella tahansa).
  const tuntemattomat = [...new Set(pyydetyt)].filter((kayttaja) => {
    const tiedot = listUsers().find((u) => u.username === kayttaja);
    return !tiedot || !paaseeTuotteisiin(tiedot).includes('guard');
  });
  if (tuntemattomat.length > 0) {
    return res.status(400).json({
      ok: false, error: `Tuntematon tai ei-GUARD-käyttäjä: ${tuntemattomat.join(', ')}`,
    });
  }

  const tulos = luoVapaaKanava({ id: crypto.randomUUID(), nimi, osallistujat: pyydetyt, luoja: req.username });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  const kanavat = readCollection('guardKanavat') || [];
  writeCollection('guardKanavat', [...kanavat, tulos.kanava]);
  logAudit({
    user: req.username, action: 'ptt_vapaa_luotu', collection: 'guardKanavat', recordId: tulos.kanava.id,
    detail: tulos.kanava.nimi,
  });
  kerroKanavastaMuutos('create', tulos.kanava, (istunto) => onOsallistuja(tulos.kanava, istunto?.username));
  res.json({ ok: true, kanava: { id: tulos.kanava.id, tyyppi: 'vapaa', nimi: tulos.kanava.nimi } });
});

// Vapaan ryhmän poisto. Ei purkuautomatiikkaa (toisin kuin DM ja hätäkanava) — ryhmä ei
// ole sidottu vuoroon eikä hälytykseen, joten mikään tapahtuma ei koskaan tee siitä
// tarpeetonta automaattisesti. Poisto on siis aina käsin tehty hallinnollinen päätös.
app.delete('/api/kanavat/vapaa/:id', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  if (!saaHallinnoidaVapaitaRyhmia(req)) {
    return res.status(403).json({ ok: false, error: 'Vain hälytyskeskus voi poistaa ryhmiä.' });
  }
  const kanavat = readCollection('guardKanavat') || [];
  const kanava = kanavat.find((k) => k.id === req.params.id);
  if (!kanava || kanava.tyyppi !== 'vapaa') {
    return res.status(404).json({ ok: false, error: 'Ryhmää ei löytynyt.' });
  }

  writeCollection('guardKanavat', kanavat.filter((k) => k.id !== kanava.id));
  logAudit({
    user: req.username, action: 'ptt_vapaa_poistettu', collection: 'guardKanavat', recordId: kanava.id,
    detail: kanava.nimi,
  });
  kerroKanavastaMuutos('delete', kanava, (istunto) => onOsallistuja(kanava, istunto?.username));
  res.json({ ok: true });
});

// ====================== PTT: PÄÄSTÄ-PÄÄHÄN-SALAUKSEN AVAIMET (vaihe 2, viipale 2a) ==
//
// Julkinen avainvarasto @matrix-org/matrix-sdk-crypto-wasm:n OlmMachinelle
// (kirjastovalinta 19.9.2026, ks. Obsidian: "Turvajohto OS PTT, vaihe 2 -suunnitelma").
// VAIN JULKISTA MATERIAALIA kulkee näiden reittien kautta — yksityiset avaimet eivät
// koskaan poistu laitteelta. Eheys on silti tärkeä (avaimen vaihto palvelimella
// mahdollistaisi väliintulohyökkäyksen), siksi lataus vaatii aina kirjautumisen OMAAN
// tunnukseen eikä admin voi ladata tai "korjata" toisen käyttäjän identiteettiä.

// Laitteen avainpaketin lataus/päivitys (KeysUploadRequest-vastine).
app.post('/api/kanavat/avaimet/lataa', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const laiteId = typeof req.body?.laiteId === 'string' ? req.body.laiteId : '';
  if (!laiteId) return res.status(400).json({ ok: false, error: 'laiteId vaaditaan.' });

  const id = `${req.username}:${laiteId}`;
  const paketit = readCollection('guardAvaimet') || [];
  const olemassaOleva = paketit.find((p) => p.id === id);

  const tulos = paivitaAvainpaketti({
    olemassaOleva,
    id,
    kayttaja: req.username,
    laiteId,
    deviceKeys: req.body?.deviceKeys,
    kertakayttoavaimet: req.body?.kertakayttoavaimet,
  });
  if (!tulos.ok) return res.status(409).json({ ok: false, error: tulos.error });

  writeCollection('guardAvaimet', [...paketit.filter((p) => p.id !== id), tulos.tietue]);
  logAudit({
    user: req.username, action: olemassaOleva ? 'ptt_avain_paivitetty' : 'ptt_avain_rekisteroity',
    collection: 'guardAvaimet', recordId: id,
  });
  res.json({ ok: true, kertakayttoavaimiaJaljella: Object.keys(tulos.tietue.kertakayttoavaimet).length });
});

// Toisten käyttäjien laitteiden julkiset avaimet (KeysQueryRequest-vastine). Ei
// osallistuja- tai vuorotarkistusta: kuka saa VIESTIÄ kenelle ratkeaa kanavan
// jäsenyydestä muualla, tämä reitti vain tarjoilee julkista avainmateriaalia kuten
// mikä tahansa avoin avainpalvelin.
app.get('/api/kanavat/avaimet/kysely', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const pyydetyt = typeof req.query?.kayttajat === 'string'
    ? req.query.kayttajat.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 50)
    : [];

  const paketit = readCollection('guardAvaimet') || [];
  const kayttajat = {};
  for (const kayttaja of new Set(pyydetyt)) {
    const laitteet = paketit.filter((p) => p.kayttaja === kayttaja).map(julkinenKuvaus);
    if (laitteet.length > 0) kayttajat[kayttaja] = laitteet;
  }
  res.json({ ok: true, kayttajat });
});

// Kertakäyttöavainten vaatiminen (KeysClaimRequest-vastine) uuden Olm-istunnon
// aloittamiseksi. Kuluttaa avaimet pysyvästi (ei koskaan uudelleenkäyttöä) — ks.
// server/kryptoavaimet.js: vaadiKertakayttoavain.
app.post('/api/kanavat/avaimet/vaadi', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const pyynnot = Array.isArray(req.body?.pyynnot)
    ? req.body.pyynnot.filter((p) => (
      p && typeof p.kayttaja === 'string' && typeof p.laiteId === 'string' && typeof p.algoritmi === 'string'
    )).slice(0, 50)
    : [];

  let paketit = readCollection('guardAvaimet') || [];
  const vastaus = [];
  let muuttui = false;
  for (const { kayttaja, laiteId, algoritmi } of pyynnot) {
    const id = `${kayttaja}:${laiteId}`;
    const idx = paketit.findIndex((p) => p.id === id);
    if (idx === -1) continue;
    const { tietue, keyId, avain } = vaadiKertakayttoavain(paketit[idx], algoritmi);
    if (!avain) continue;
    paketit = [...paketit.slice(0, idx), tietue, ...paketit.slice(idx + 1)];
    muuttui = true;
    vastaus.push({ kayttaja, laiteId, keyId, avain });
  }
  if (muuttui) writeCollection('guardAvaimet', paketit);
  res.json({ ok: true, avaimet: vastaus });
});

// Laitteiden välinen kohdennettu viesti (ToDeviceRequest-vastine, viipale 2c) —
// kuljettaa huoneavaimen jaon (shareRoomKey) ja Olm-istuntojen perustamisviestit.
// Sisältö on aina jo Olm-salattu asiakkaan puolella; tämä reitti ei tulkitse sitä.
//
// Kohteen on oltava OLEMASSA OLEVA rekisteröity laite (guardAvaimet), ei mikä tahansa
// merkkijono — muuten jono kasvaisi rajattomasti olemattomille laitteille joita mikään
// ei koskaan hae tyhjäksi.
app.post('/api/kanavat/avaimet/laheta-laitteelle', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const tyyppi = typeof req.body?.tyyppi === 'string' ? req.body.tyyppi : '';
  const pyydetyt = Array.isArray(req.body?.viestit)
    ? req.body.viestit.filter((v) => v && typeof v.kayttaja === 'string' && typeof v.laiteId === 'string').slice(0, 50)
    : [];
  if (!tyyppi || pyydetyt.length === 0) {
    return res.status(400).json({ ok: false, error: 'tyyppi ja vähintään yksi viesti vaaditaan.' });
  }

  const avainpaketit = readCollection('guardAvaimet') || [];
  const jono = readCollection('guardLaiteviestit') || [];
  const uudet = [];
  for (const { kayttaja, laiteId, sisalto } of pyydetyt) {
    if (!avainpaketit.some((p) => p.id === `${kayttaja}:${laiteId}`)) continue;
    uudet.push(luoLaiteviesti({
      id: crypto.randomUUID(), lahettaja: req.username, kohdeKayttaja: kayttaja, kohdeLaite: laiteId,
      tyyppi, sisalto,
    }));
  }
  if (uudet.length === 0) return res.json({ ok: true, toimitettu: 0 });

  writeCollection('guardLaiteviestit', [...jono, ...uudet]);
  // Suora herätys kohteen kaikille yhteyksille (ei tiedetä kumpi laite/välilehti) —
  // asiakas hakee heti GET .../laitteelle, väärä laite saa vain tyhjän vastauksen.
  const kohdeKayttajat = new Set(uudet.map((v) => v.kohdeKayttaja));
  for (const kayttaja of kohdeKayttajat) {
    lahetaViesti({ tyyppi: 'laiteviesti_saapui' }, { suodatin: (istunto) => istunto?.username === kayttaja });
  }
  res.json({ ok: true, toimitettu: uudet.length });
});

// Oman laitteen jonossa olevien kohdennettujen viestien haku. Poistaa ne heti — ei
// toistoa, ei historiaa (ks. server/laiteviestit.js).
app.get('/api/kanavat/avaimet/laitteelle', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const laiteId = typeof req.query?.laiteId === 'string' ? req.query.laiteId : '';
  if (!laiteId) return res.status(400).json({ ok: false, error: 'laiteId vaaditaan.' });

  const jono = readCollection('guardLaiteviestit') || [];
  const omat = laitteenViestit(jono, req.username, laiteId);
  if (omat.length > 0) writeCollection('guardLaiteviestit', poistaLaitteenViestit(jono, req.username, laiteId));
  res.json({
    ok: true,
    viestit: omat.map((v) => ({ lahettaja: v.lahettaja, tyyppi: v.tyyppi, sisalto: v.sisalto })),
  });
});

// ====================== PTT: TEKSTIVIESTIT (vaihe 3, viipale 3a) ===================
//
// `tapahtuma` on aina asiakkaan jo Olm/Megolm-salaama tapahtumaolio
// (src/shared/olm.ts: salaaViesti) — nämä reitit EIVÄT tulkitse eivätkä pura sitä, ks.
// server/viestit.js:n tiedostokommentti.
//
// HTTP-versio kuuluuKanavaanNyt:stä (ks. floor control -osio alempana tässä
// tiedostossa): sama sääntö, eri oikeuslähde — req.permissions on requireAuthin jo
// valmiiksi ratkaisema, kun taas WS-istunnolla on vain roleId josta oikeudet luetaan
// joka kerta (rolePermissions). Kahden auth-muodon rinnakkaiselo on tässä tiedostossa
// jo ennestään vakiintunut malli.
function reqKuuluuKanavaanNyt(req, kanavaId) {
  const vuoro = keskenOlevaVuoro(readCollection('guardShifts') || [], req.username);
  if (kuuluuKiinteaanKanavaan(vuoro, kanavaId)) return true;
  const kanava = (readCollection('guardKanavat') || []).find((k) => k.id === kanavaId);
  if (!kanava) return false;
  if (kanava.tyyppi === 'hata') {
    return onHalyttaja(kanava, req.username) || req.role === 'admin' || canView(req.permissions, null, 'guard_dispatch');
  }
  if (kanava.tyyppi === 'dm' || kanava.tyyppi === 'vapaa') return onOsallistuja(kanava, req.username);
  return false;
}

function saaKasitellaKanavaa(req, kanavaId) {
  if (req.role === 'admin') return true;
  if (!(req.tuotteet || []).includes('guard')) return false;
  if (!canView(req.permissions, null, 'guard_ptt')) return false;
  return reqKuuluuKanavaanNyt(req, kanavaId);
}

// Kanavaviesti uudesta tekstiviestistä. Oma viestityyppi eikä geneerinen 'muutos' —
// guardViestit-näkyvyys on kanavakohtainen ja dynaaminen eikä saaNahda(istunto, eventId)
// -mallia vasten toimi, ja asiakkaan on tiedettävä MIKÄ kanava sai uuden viestin
// päättääkseen kannattaako hakea (sama syy kuin puheenvuoro_*-viesteillä vaihe 1b:ssä).
function kerroViestista(viesti) {
  lahetaViesti(
    { tyyppi: 'uusi_viesti', kanavaId: viesti.kanavaId, viestiId: viesti.id },
    { suodatin: (istunto) => istunto?.username !== viesti.lahettaja && saaKuullaKanavaa(istunto, viesti.kanavaId) },
  );
}

app.post('/api/viestit', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const kanavaId = typeof req.body?.kanavaId === 'string' ? req.body.kanavaId : '';
  if (!kanavaId) return res.status(400).json({ ok: false, error: 'kanavaId vaaditaan.' });
  if (!saaKasitellaKanavaa(req, kanavaId)) {
    return res.status(403).json({ ok: false, error: 'Et kuulu tähän kanavaan.' });
  }

  const tulos = luoViesti({
    id: crypto.randomUUID(), kanavaId, lahettaja: req.username, tapahtuma: req.body?.tapahtuma,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  const viestit = readCollection('guardViestit') || [];
  writeCollection('guardViestit', [...viestit, tulos.viesti]);
  logAudit({
    user: req.username, action: 'ptt_viesti_lahetetty', collection: 'guardViestit',
    recordId: tulos.viesti.id, koko: tulos.viesti.koko,
  });
  kerroViestista(tulos.viesti);
  res.json({ ok: true, id: tulos.viesti.id });
});

app.get('/api/viestit', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const kanavaId = typeof req.query?.kanavaId === 'string' ? req.query.kanavaId : '';
  if (!kanavaId) return res.status(400).json({ ok: false, error: 'kanavaId vaaditaan.' });
  if (!saaKasitellaKanavaa(req, kanavaId)) {
    return res.status(403).json({ ok: false, error: 'Et kuulu tähän kanavaan.' });
  }

  const viestit = kanavanViestit(readCollection('guardViestit') || [], kanavaId).slice(-200);
  const kuittaukset = readCollection('guardKuittaukset') || [];
  res.json({
    ok: true,
    viestit: viestit.map((v) => ({
      id: v.id,
      lahettaja: v.lahettaja,
      luotu: v.luotu,
      tapahtuma: v.tapahtuma,
      kuittaukset: viestinKuittaukset(kuittaukset, v.id).map((k) => ({ kayttaja: k.kayttaja, tyyppi: k.tyyppi, aika: k.aika })),
    })),
  });
});

// Toimitus-/lukukuittaus (vaihe 3, viipale 3c). Epäsymmetrinen: lukukuittaus on
// sallittu vain hätäkanavalla (ks. server/kuittaukset.js:n tiedostokommentti). Oman
// viestin kuittaaminen ei ole mielekäs — lähettäjä tietää jo lähettäneensä sen.
app.post('/api/viestit/:id/kuittaa', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const viestit = readCollection('guardViestit') || [];
  const viesti = viestit.find((v) => v.id === req.params.id);
  if (!viesti) return res.status(404).json({ ok: false, error: 'Viestiä ei löytynyt.' });
  if (!saaKasitellaKanavaa(req, viesti.kanavaId)) {
    return res.status(403).json({ ok: false, error: 'Et kuulu tähän kanavaan.' });
  }
  if (viesti.lahettaja === req.username) {
    return res.status(400).json({ ok: false, error: 'Omaa viestiä ei kuitata.' });
  }

  const tyyppi = typeof req.body?.tyyppi === 'string' ? req.body.tyyppi : '';
  const kanava = (readCollection('guardKanavat') || []).find((k) => k.id === viesti.kanavaId);
  if (!sallitutKuittaustyypit(kanava?.tyyppi).includes(tyyppi)) {
    return res.status(400).json({ ok: false, error: `Kuittaustyyppi "${tyyppi}" ei ole sallittu tällä kanavalla.` });
  }

  const kuittaukset = readCollection('guardKuittaukset') || [];
  if (onKuitattu(kuittaukset, viesti.id, req.username, tyyppi)) {
    return res.json({ ok: true, jo_kuitattu: true });
  }

  const kuittaus = luoKuittaus({
    id: crypto.randomUUID(), viestiId: viesti.id, kanavaId: viesti.kanavaId, kayttaja: req.username, tyyppi,
  });
  writeCollection('guardKuittaukset', [...kuittaukset, kuittaus]);
  logAudit({
    user: req.username, action: tyyppi === 'luku' ? 'ptt_viesti_luettu' : 'ptt_viesti_toimitettu',
    collection: 'guardKuittaukset', recordId: kuittaus.id,
  });
  lahetaViesti(
    { tyyppi: 'viesti_kuitattu', kanavaId: viesti.kanavaId, viestiId: viesti.id, kayttaja: req.username, kuittaustyyppi: tyyppi },
    { suodatin: (istunto) => istunto?.username !== req.username && saaKuullaKanavaa(istunto, viesti.kanavaId) },
  );
  res.json({ ok: true });
});

// ====================== PTT: SALATUT MEDIALIITTEET (vaihe 3, viipale 3d) ===========
//
// Sisältö on AINA jo asiakkaan salaama (src/shared/salatutliitteet.ts) — nämä reitit
// EIVÄT validoi tiedostotyyppiä (ei voi, data on opaakkia) ja tarkistavat vain koon
// (sama multer-asetus kuin /api/uploads:ssa, 15 Mt/tiedosto). Tiedostoavain kulkee
// viestin omassa Megolm-salauksessa liiteosoittimena — palvelin ei näe eikä tarvitse
// sitä. `tyyppi`-kenttä (kuva/video/tiedosto) on VAIN audit-lokia varten (Obsidian:
// "vaihe 3 -suunnitelma", kohta 6) — ei käytetä oikeustarkistuksessa.
const LIITTEEN_TYYPIT = ['kuva', 'video', 'tiedosto'];

app.post('/api/liitteet', requireAuth, guardPortti, uploadLimiter, (req, res) => {
  if (!pttPortti(req, res)) return;
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Liite on liian suuri (max 15 Mt).' : 'Liitteen lähetys epäonnistui.';
      return res.status(400).json({ ok: false, error: msg });
    }
    if (!req.file) return res.status(400).json({ ok: false, error: 'Liitettä ei löytynyt.' });
    const kanavaId = typeof req.body?.kanavaId === 'string' ? req.body.kanavaId : '';
    if (!kanavaId) return res.status(400).json({ ok: false, error: 'kanavaId vaaditaan.' });
    if (!saaKasitellaKanavaa(req, kanavaId)) {
      return res.status(403).json({ ok: false, error: 'Et kuulu tähän kanavaan.' });
    }
    const tyyppi = LIITTEEN_TYYPIT.includes(req.body?.tyyppi) ? req.body.tyyppi : 'tiedosto';

    const id = tallennaSalattuLiite(req.file.buffer);
    const liitteet = readCollection('guardLiitteet') || [];
    writeCollection('guardLiitteet', [...liitteet, {
      id, kanavaId, lahettaja: req.username, koko: req.file.size, luotu: new Date().toISOString(),
    }]);
    logAudit({
      user: req.username, action: 'ptt_liite_ladattu', collection: 'guardLiitteet', recordId: id,
      koko: req.file.size, tyyppi,
    });
    res.json({ ok: true, id });
  });
});

app.get('/api/liitteet/:id', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const tietue = (readCollection('guardLiitteet') || []).find((l) => l.id === req.params.id);
  if (!tietue) return res.status(404).json({ ok: false, error: 'Liitettä ei löytynyt.' });
  if (!saaKasitellaKanavaa(req, tietue.kanavaId)) {
    return res.status(403).json({ ok: false, error: 'Et kuulu tähän kanavaan.' });
  }
  const polku = haeSalatunLiitteenPolku(tietue.id);
  if (!polku) return res.status(404).json({ ok: false, error: 'Liitettä ei löytynyt levyltä.' });
  res.sendFile(polku);
});

// Kaikki käyttäjät joilla on guard_dispatch-oikeus JUURI NYT, plus admin — sama
// onPaivystaja-periaate kuin GET /api/kanavat/omat:ssa, koottuna funktioksi koska
// tätä tarvitaan nyt myös jäsenlistan koontiin. Lasketaan OIKEUKSISTA eikä
// erillisestä listasta, samasta syystä kuin tiedotteenVastaanottajat().
function kaikkiPaivystajat() {
  return listUsers()
    .filter((u) => u.role === 'admin' || canView(rolePermissions(u.roleId), null, 'guard_dispatch'))
    .map((u) => u.username);
}

// Kanavan KAIKKI nykyiset jäsenet (erä 26, vaihe 3, viipale 3b) — huoneavaimen jako
// tarvitsee tämän, toisin kuin pelkkä "kuulunko itse" (saaKasitellaKanavaa). Sisältää
// kutsujan itsensä, samaan tapaan kuin guardKanavan oma osallistujat-kenttä.
//
// HÄTÄKANAVAN PÄIVYSTÄJÄLISTA EI OLE STAATTINEN: kuka tahansa guard_dispatch-
// oikeudella varustettu (myös admin, sama poikkeus kuin muualla hätäkanavalla) saa
// huoneavaimen, vaikka ei olisi vielä koskaan avannut kanavaa — sama "kuka tahansa
// päivystäjä voi vastata" -periaate kuin vaiheessa 1d.
function jasenetKanavalla(kanavaId) {
  const kanava = (readCollection('guardKanavat') || []).find((k) => k.id === kanavaId);
  if (kanava?.tyyppi === 'hata') return [...new Set([kanava.vartija, ...kaikkiPaivystajat()])];
  if (kanava?.tyyppi === 'dm' || kanava?.tyyppi === 'vapaa') return kanava.osallistujat || [];
  return jasenetKiinteallaKanavalla(readCollection('guardShifts') || [], kanavaId);
}

app.get('/api/kanavat/:id/jasenet', requireAuth, guardPortti, (req, res) => {
  if (!pttPortti(req, res)) return;
  const kanavaId = req.params.id;
  if (!saaKasitellaKanavaa(req, kanavaId)) {
    return res.status(403).json({ ok: false, error: 'Et kuulu tähän kanavaan.' });
  }
  res.json({ ok: true, jasenet: jasenetKanavalla(kanavaId) });
});

// Vuoron aloitus.
//
// `vartija` kentässä = hälytyskeskus aloittaa vuoron toisen puolesta kertaluvalla. Se ei
// ole oikeus tehdä työtä toisen nimissä vaan ainoa tapa avata perehdyttämätön vuoro, ja
// siksi se vaatii syyn ja jää sekä vuoron tietueeseen että auditlokiin.
app.post('/api/vuoro', requireAuth, guardPortti, (req, res) => {
  const { siteId, vuorotyyppiId, vartija, poikkeusSyy } = req.body || {};

  const kenelle = typeof vartija === 'string' && vartija ? vartija : req.username;
  const toisenPuolesta = kenelle !== req.username;
  if (toisenPuolesta && !saaMyontaaKertaluvan(req)) {
    return res.status(403).json({ ok: false, error: 'Vain hälytyskeskus voi aloittaa vuoron toisen puolesta.' });
  }
  if (toisenPuolesta && !findUser(kenelle)) {
    return res.status(404).json({ ok: false, error: 'Vartijaa ei löytynyt.' });
  }

  const kohde = (readCollection('guardSites') || []).find((k) => k?.id === siteId);
  if (!kohde) return res.status(404).json({ ok: false, error: 'Kohdetta ei löytynyt.' });
  if (!saaTyoskennella(req, siteId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta työskennellä tässä kohteessa.' });
  }

  const vuorot = readCollection('guardShifts') || [];
  // Yksi vuoro kerrallaan (päätös 10.9.2026), sama sääntö kuin kierroksella: kahden
  // yhtaikaisen vuoron tehtävistä ei tietäisi kumpaan ne kuuluvat.
  const auki = keskenOlevaVuoro(vuorot, kenelle);
  if (auki) {
    return res.status(409).json({
      ok: false,
      error: `Vuoro on jo käynnissä kohteessa ${auki.siteNimi}. Päätä se ensin.`,
      vuoroId: auki.id,
    });
  }

  // Kertalupa vaatii syyn. Ilman syytä poikkeus olisi merkintä siitä että sääntö
  // ohitettiin, ja se on vähemmän kuin ei mitään: se näyttää valvonnalta ilman sisältöä.
  //
  // Lupa ratkeaa VALTUUDESTA eikä siitä kenelle vuoro aloitetaan (korjattu 10.9.2026).
  // Aiemmin ehtona oli `toisenPuolesta`, jolloin päivystäjä ei voinut myöntää lupaa
  // itselleen — yhden pääkäyttäjän vartiointiliikkeessä poikkeusta ei olisi voinut
  // käyttää lainkaan, koska myöntäjää ei olisi ollut. Ilman `guard_dispatch`-valtuutta
  // syyn kirjoittaminen ei myönnä mitään, joten vartija ei voi luvittaa itseään.
  const syy = String(poikkeusSyy || '').trim();
  const poikkeus = saaMyontaaKertaluvan(req) && syy.length >= 5
    ? { myontaja: req.username, syy: syy.slice(0, 500) }
    : null;

  const tulos = aloitaVuoro({
    kohde, vuorotyyppiId, username: kenelle, pohjat: readCollection('templates') || [],
    id: crypto.randomUUID(), poikkeus,
  });
  if (!tulos.ok) {
    // Koneluettava syy mukaan: käyttöliittymä tarjoaa kertalupaa vain silloin kun este on
    // sellainen jonka lupa voi avata, eikä esimerkiksi poistettua vuoroa.
    return res.status(403).json({ ok: false, error: tulos.error, syy: tulos.syy });
  }

  writeCollection('guardShifts', [tulos.vuoro, ...vuorot]);
  logAudit({
    user: req.username, action: 'vuoro_alkoi', collection: 'guardShifts',
    recordId: tulos.vuoro.id, eventId: kohde.id,
    ...(toisenPuolesta ? { kohdeKayttaja: kenelle } : {}),
    ...(tulos.vuoro.perehdytysPoikkeus
      ? { poikkeus: tulos.vuoro.perehdytysPoikkeus.este, syy: tulos.vuoro.perehdytysPoikkeus.syy }
      : {}),
  });
  kerroVuorosta(tulos.vuoro, 'create');

  // ALKAVA VUORO OTTAA VASTAAN VUOROTTOMALLE ANNETUT MÄÄRÄYKSET (19.9.2026).
  //
  // Pakotus ei vaadi saajalta vuoroa, joten vapaalla olevalle annettu tehtävä syntyy ilman
  // vuorotunnusta. Kun työlista rajataan vuoroon, tunnukseton tehtävä näkyisi joka
  // vuorossa — eli juuri se vika jota rajaus korjaa. Kiinnitys tekee siitä tämän vuoron
  // työn, jolloin se myös raukeaa tämän vuoron mukana jos se jää tekemättä.
  const kiinnitettavat = readCollection('guardAssignments') || [];
  const kiinnitetyt = kiinnitaVuoroon(kiinnitettavat, { username: kenelle, vuoroId: tulos.vuoro.id });
  if (kiinnitetyt.length > 0) {
    const kartta = new Map(kiinnitetyt.map((x) => [x.id, x]));
    writeCollection('guardAssignments', kiinnitettavat.map((x) => kartta.get(x?.id) || x));
    for (const siirto of kiinnitetyt) {
      logAudit({
        user: req.username, action: 'tehtava_kiinnitetty_vuoroon', collection: 'guardAssignments',
        recordId: siirto.id, eventId: siirto.siteId, kohdeKayttaja: kenelle, vuoroId: tulos.vuoro.id,
      });
      kerroSiirrosta(siirto, 'update');
    }
  }

  res.json({ ok: true, vuoro: tulos.vuoro, kiinnitetyt: kiinnitetyt.length });
});

// Vuoron kooste: mitä kuului vuoroon, mitä tehtiin ja mikä poikkesi suoritusajastaan.
//
// Lasketaan PYYDETTÄESSÄ eikä tallenneta vuoron tietueeseen: kooste on johtopäätös
// lähdeaineistosta, ja tallennettu johtopäätös vanhenee hiljaa kun lähdeaineisto
// korjataan.
//
// Vartija näkee omansa, hälytyskeskus ja pääkäyttäjä kaikki. Vartijan on nähtävä oma
// koosteensa ennen kotiinlähtöä — muuten unohtunut kierros selviää vasta seuraavana
// päivänä jonkun toisen katsoessa listaa.
app.get('/api/vuoro/:id/kooste', requireAuth, guardPortti, (req, res) => {
  const vuoro = (readCollection('guardShifts') || []).find((v) => v?.id === req.params.id);
  if (!vuoro) return res.status(404).json({ ok: false, error: 'Vuoroa ei löytynyt.' });
  if (vuoro.vartija !== req.username && !saaMyontaaKertaluvan(req)) {
    return res.status(403).json({ ok: false, error: 'Vuoro on toisen vartijan.' });
  }
  res.json({
    ok: true,
    kooste: vuoronKooste({
      vuoro,
      kierrokset: readCollection('patrolRuns') || [],
      suoritukset: readCollection('guardTaskRuns') || [],
    }),
  });
});

// --- Hälytyskeskuksen vartijanäkymä (18.9.2026) -------------------------------------
//
// YKSI REITTI EIKÄ VIISI. Paneeli vastaa yhteen kysymykseen — "mikä tämän vartijan
// tilanne on juuri nyt" — ja sen osat (vuoro, tehtäväloki, kalusto) luetaan samalla
// oikeudella samasta hetkestä. Viisi erillistä hakua antaisi viisi eri hetkeä: vuoro
// voisi olla päättynyt siinä välissä kun kalusto haetaan, ja paneeli näyttäisi kahta
// eri totuutta rinnakkain.
//
// `guard_dispatch` eikä kohdekohtainen oikeus: tämä on henkilön näkymä eikä kohteen.
// Päivystäjä joka saa nähdä kuka on vuorossa saa nähdä myös mitä hän tekee — se on sama
// tieto järjestettynä uudelleen. Vartija itse ei pääse tänne lainkaan, koska hänellä on
// omat näkymänsä eikä toisen vartijan kalusto kuulu hänelle.
app.get('/api/vartija/:username', requireAuth, guardPortti, (req, res) => {
  if (!saaMyontaaKertaluvan(req)) {
    return res.status(403).json({ ok: false, error: 'Vain hälytyskeskus näkee vartijan hallintanäkymän.' });
  }
  const user = findUser(req.params.username);
  if (!user) return res.status(404).json({ ok: false, error: 'Vartijaa ei löytynyt.' });

  const vuorot = readCollection('guardShifts') || [];
  const kaynnissa = keskenOlevaVuoro(vuorot, user.username) || null;
  // Päättynyt vuoro varalla: paneeli avataan vuorolistasta, mutta se voi jäädä auki
  // toiselle näytölle senkin jälkeen kun vuoro päättyy. Tyhjä näkymä siinä kohtaa
  // hukkaisi juuri sen koosteen jota päivystäjä oli katsomassa.
  const viimeisin = kaynnissa || (vuorot
    .filter((v) => v?.vartija === user.username && v?.tila === 'paattynyt')
    .sort((a, b) => String(b.paattyi).localeCompare(String(a.paattyi)))[0] || null);

  const kooste = viimeisin
    ? vuoronKooste({
      vuoro: viimeisin,
      kierrokset: readCollection('patrolRuns') || [],
      suoritukset: readCollection('guardTaskRuns') || [],
    })
    : null;

  // Kalusto sijoitetaan HENKILÖLLE työntekijätunnuksella eikä käyttäjätunnuksella, joten
  // ilman työntekijätietuetta lista ei voi olla oikein — ja tyhjä lista näyttäisi siltä
  // että vartijalla ei ole mitään. `kalustoTiedossa: false` kertoo eron.
  const kalustoTiedossa = Boolean(user.employeeId);
  const omaKalusto = kalustoTiedossa
    ? kalusto.vuoronKalusto(kalusto.normalisoiRivit(readCollection('assets') || []), {
      employeeId: user.employeeId,
    })
    : [];

  // PAKOTETUT TEHTÄVÄT KUULUVAT TEHTÄVÄLOKIIN (19.9.2026).
  //
  // Vuoron kooste lasketaan vuoron omista riveistä (vuorot.pohjat, vuoro.tehtavat).
  // Päivystäjän itse antama tehtävä ei ole kummassakaan — se on oma tietueensa
  // guardAssignments-kokoelmassa — joten se katosi näkyvistä heti kun se oli annettu.
  // Päivystäjä näki oman määräyksensä vain siitä ilmoituksesta jonka sai antaessaan sen.
  //
  // Rajattu tähän vuoroon VUOROTUNNUKSELLA eikä aikaleimalla (19.9.2026). Aikaleima oli
  // arvaus siitä mihin vuoroon tehtävä kuuluu; tunnus on se mikä tietueeseen kirjattiin
  // sillä hetkellä kun tehtävä annettiin, ja se on sama luku jolla vartijan oma työlista
  // rajataan (siirto.js: kuuluuVuoroon). Kaksi eri rajausta samasta asiasta olisi kaksi
  // eri vastausta kysymykseen mikä kuului tähän vuoroon.
  //
  // Kiinnittämättömät (vuoroId null) näkyvät aina: vuorottomalle annettu määräys odottaa
  // seuraavaa vuoroa, eikä se saa olla näkymätön sitä odottaessaan.
  const pakotukset = (readCollection('guardAssignments') || [])
    .filter((s) => s?.saaja === user.username
      && (s.tapa === 'pakotus' || s.tila === 'hyvaksytty' || s.tila === 'valmis')
      && kuuluuVuoroon(s, viimeisin?.id || null))
    .sort((a, b) => String(b.luotu).localeCompare(String(a.luotu)));

  res.json({
    ok: true,
    vartija: { username: user.username, nimi: user.nickname || user.username },
    vuoro: viimeisin,
    vuoroKaynnissa: Boolean(kaynnissa),
    kooste,
    kalustoTiedossa,
    kalusto: omaKalusto,
    pakotukset,
  });
});

// Vuoron päättäminen.
app.post('/api/vuoro/:id/paata', requireAuth, guardPortti, (req, res) => {
  const vuorot = readCollection('guardShifts') || [];
  const vuoro = vuorot.find((v) => v?.id === req.params.id);
  if (!vuoro) return res.status(404).json({ ok: false, error: 'Vuoroa ei löytynyt.' });
  // Vuoro on henkilökohtainen. Hälytyskeskus voi päättää unohtuneen vuoron, koska
  // ikuisesti auki oleva vuoro on väärää tietoa siitä kuka on kentällä.
  if (vuoro.vartija !== req.username && !saaMyontaaKertaluvan(req)) {
    return res.status(403).json({ ok: false, error: 'Vuoro on toisen vartijan.' });
  }

  const tulos = paataVuoro({
    vuoro,
    toisto: req.body?.toisto === true,
    paattaja: req.username,
    syy: req.body?.syy,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  if (tulos.duplikaatti) return res.json({ ok: true, vuoro: tulos.vuoro, duplikaatti: true });

  writeCollection('guardShifts', vuorot.map((v) => (v.id === vuoro.id ? tulos.vuoro : v)));

  // PÄÄTTYVÄ VUORO SULKEE MYÖS KESKEN JÄÄNEET KIERROKSET (18.9.2026).
  //
  // Kierros jonka vartija on jättänyt kesken ei pääty itsestään: se jää "kesken"-tilaan
  // ikuisesti, näkyy hälytyskeskuksen luvussa "Kierrosta kesken" ja odottaa vartijaa joka
  // ei ole enää vuorossa. Jos vuoro päätettiin juuri siksi ettei vartijaan saada
  // yhteyttä, kierros on juuri se mitä hän ei voi tulla päättämään.
  //
  // KESKEYTETTY EIKÄ VALMIS. Kuittaamattomia pisteitä ei ole käyty, eikä päivystäjä voi
  // tietää kävikö vartija niillä. Valmiiksi merkitseminen olisi väärä tieto siitä että
  // kohde on kierretty — ja juuri se tieto jonka varassa seuraava kierros suunnitellaan.
  //
  // Vain pakkopäätöksellä. Vartija joka päättää vuoronsa itse näkee kesken olevan
  // kierroksensa omassa näkymässään ja päättää sen itse syyn kera; automaattinen
  // keskeytys veisi häneltä sen tiedon jonka vain hän voi kirjoittaa.
  const suljetutKierrokset = [];
  if (tulos.vuoro.pakkoPaatos) {
    const kierrokset = readCollection('patrolRuns') || [];
    const kesken = kierrokset.filter(
      (k) => k?.vartija === vuoro.vartija && k?.tila === 'kesken'
    );
    if (kesken.length > 0) {
      const paatetyt = new Map();
      for (const kierros of kesken) {
        const kTulos = paataKierros({
          kierros,
          tila: 'keskeytetty',
          syy: `Hälytyskeskus päätti vuoron: ${tulos.vuoro.pakkoPaatos.syy}`,
        });
        if (kTulos.ok) paatetyt.set(kierros.id, kTulos.kierros);
      }
      writeCollection('patrolRuns', kierrokset.map((k) => paatetyt.get(k?.id) || k));
      for (const kierros of paatetyt.values()) {
        logAudit({
          user: req.username, action: 'patrol_abort', collection: 'patrolRuns',
          recordId: kierros.id, eventId: kierros.siteId, kohdeKayttaja: vuoro.vartija,
          syy: kierros.keskeytysSyy,
        });
        kerroKierroksesta(kierros, 'update');
        suljetutKierrokset.push({ id: kierros.id, nimi: kierros.templateNimi || "Kierros" });
      }
    }
  }

  // VUORON PÄÄTTYESSÄ AUKI JÄÄNEET MÄÄRÄYKSET RAUKEAVAT (19.9.2026).
  //
  // Sääntö on käyttäjän: uudessa vuorossa on vain se mitä kohteen asetukset kylvävät, ja
  // kaikki vuoron aikana annettu lisätyö jää siihen vuoroon. Rajaus yksin riittäisi
  // piilottamaan nämä, mutta silloin kuittaamaton määräys jäisi ikuisesti odottavaan
  // tilaan ja näyttäisi auki olevalta työltä joka ei ole kenenkään.
  //
  // RAUKEAMINEN EI OLE SUORITUS eikä poisto: se kertoo että määräys annettiin, vuoro
  // loppui ja työ jäi tekemättä. Juuri se on tieto jonka päivystäjä tarvitsee kun hän
  // katsoo jälkikäteen miksi painiketta ei viety.
  const kaikkiSiirrot = readCollection('guardAssignments') || [];
  const rauenneet = rauetaVuoronMukana(kaikkiSiirrot, { vuoroId: vuoro.id });
  if (rauenneet.length > 0) {
    const kartta = new Map(rauenneet.map((x) => [x.id, x]));
    writeCollection('guardAssignments', kaikkiSiirrot.map((x) => kartta.get(x?.id) || x));
    for (const siirto of rauenneet) {
      logAudit({
        user: req.username, action: 'tehtava_rauennut', collection: 'guardAssignments',
        recordId: siirto.id, eventId: siirto.siteId, kohdeKayttaja: vuoro.vartija,
        vuoroId: vuoro.id, antaja: siirto.antaja,
      });
      kerroSiirrosta(siirto, 'update');
    }
  }

  // VUORON PÄÄTTYMINEN UNOHTAA SIJAINNIN.
  //
  // sijainti.js on luvannut tämän kommentissaan alusta asti, mutta sitä ei ollut
  // toteutettu: vain uloskirjautuminen poisti sijainnin, ja vuoron päättänyt vartija jäi
  // hälytyskeskuksen listalle puoleksi tunniksi kunnes tietue vanheni itsestään.
  //
  // Ero ei ole tekninen vaan periaatteellinen, ja se on juuri se lause joka
  // työntekijälle kerrotaan: seuranta koskee työaikaa. Vartija joka päättää vuoronsa ja
  // jää vaihtamaan vaatteita ei ole enää työvuorossa, eikä hänen sijaintinsa kuulu
  // kenellekään — eikä sovellus välttämättä ole edes auki, jolloin uloskirjautumista
  // ei tapahdu lainkaan.
  //
  // `vuoro.vartija` eikä `req.username`: hälytyskeskus voi päättää unohtuneen vuoron
  // toisen puolesta, ja silloin unohdettava sijainti on sen vartijan eikä päivystäjän.
  unohdaSijainti(vuoro.vartija);

  logAudit({
    user: req.username, action: 'vuoro_paattyi', collection: 'guardShifts',
    recordId: vuoro.id, eventId: vuoro.siteId,
    ...(vuoro.vartija !== req.username ? { kohdeKayttaja: vuoro.vartija } : {}),
    ...(tulos.vuoro.pakkoPaatos ? { syy: tulos.vuoro.pakkoPaatos.syy } : {}),
  });
  kerroVuorosta(tulos.vuoro, 'update');
  // Suljetut kierrokset vastaukseen: päivystäjän on nähtävä mitä hänen painalluksensa
  // teki. "Vuoro päätetty" jättäisi kertomatta että samalla keskeytyi kaksi kierrosta.
  res.json({
    ok: true,
    vuoro: tulos.vuoro,
    kierrokset: suljetutKierrokset,
    // Samasta syystä kuin suljetut kierrokset: päättäjän on nähtävä mitä hänen
    // painalluksensa teki. Tekemättä jäänyt määräys on vuoron tulos siinä missä
    // tekemätön kierroskin.
    rauenneet: rauenneet.map((s) => ({ id: s.id, nimi: s.nimi })),
  });
});

// Tehtävän tai kierroksen lisäys omaan vuoroon kohteen hakemistosta.
//
// Tämä on se "lisäksi, ei tilalle" -osa: vuoro kertoo mitä pitää tehdä, hakemisto vastaa
// kysymykseen saanko tehdä myös tämän. Ilman jälkimmäistä oltaisiin nykytilassa, jossa
// vartija etsii kaiken itse; ilman edellistä kukaan ei voisi tehdä ylimääräistä.
app.post('/api/vuoro/:id/lisaa', requireAuth, guardPortti, (req, res) => {
  const vuorot = readCollection('guardShifts') || [];
  const vuoro = vuorot.find((v) => v?.id === req.params.id);
  if (!vuoro) return res.status(404).json({ ok: false, error: 'Vuoroa ei löytynyt.' });
  if (vuoro.vartija !== req.username) {
    return res.status(403).json({ ok: false, error: 'Vuoro on toisen vartijan.' });
  }

  const kohde = (readCollection('guardSites') || []).find((k) => k?.id === vuoro.siteId);
  const tulos = lisaaVuoroon({
    vuoro, kohde, pohjat: readCollection('templates') || [],
    laji: req.body?.laji, kohdeId: req.body?.kohdeId, lahde: 'itse_lisatty',
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  if (tulos.duplikaatti) return res.json({ ok: true, vuoro: tulos.vuoro, duplikaatti: true });

  writeCollection('guardShifts', vuorot.map((v) => (v.id === vuoro.id ? tulos.vuoro : v)));
  logAudit({
    user: req.username, action: 'vuoro_tehtava_lisatty', collection: 'guardShifts',
    recordId: vuoro.id, eventId: vuoro.siteId, laji: req.body?.laji,
  });
  kerroVuorosta(tulos.vuoro, 'update');
  res.json({ ok: true, vuoro: tulos.vuoro });
});

// --- Tehtävän siirto vartijalta vartijalle (erä 18) ---------------------------------
//
// Siirto on OMA TIETUEENSA eikä rivi saajan vuorossa. Käyttötapaus on piirivartija, joka
// tulee ajamaan kauppakeskusvartijan kierroksen: hän on omassa vuorossaan toisessa
// kohteessa, eikä siirretty kierros mahdu sinne ilman että vuoro lakkaa vastaamasta
// kysymykseen missä vartija oli töissä. Vartijan työlista syntyy yhdistämällä vuoron omat
// tehtävät, hyväksytyt siirrot ja hälytykset — lista on vartijan, vuoro vain kylvää sen.

function kerroSiirrosta(siirto, action) {
  lahetaKanavalle('guardAssignments', [{ action, id: siirto.id, eventId: siirto.siteId }], {
    saaNahda: (istunto, siteId) =>
      istunto?.role === 'admin'
      || (eventAllowed(istunto?.eventAccess, siteId)
        && canView(rolePermissions(istunto?.roleId), siteId, 'guard_patrols')),
  });
}

// Omat siirrot molempiin suuntiin.
//
// OMA REITTI eikä kokoelman listahaku, ja syy on ominaisuuden ydin: saaja ei välttämättä
// pääse siihen kohteeseen josta siirto tulee, joten kohdesidonnainen listahaku rajaisi
// hänet ulos juuri siitä tiedosta jonka takia koko siirto tehtiin.
app.get('/api/siirrot/omat', requireAuth, guardPortti, (req, res) => {
  const siirrot = readCollection('guardAssignments') || [];
  // Kesken oleva vuoro rajaa listan (19.9.2026): uudessa vuorossa on vain se mitä kohteen
  // asetukset kylvävät, ja edellisen vuoron aikana annettu lisätyö jää sinne missä se
  // annettiin. Ilman rajausta viime vuorossa tehty pakotettu tehtävä näkyi yhä tehtynä
  // seuraavan vuoron listalla.
  const vuoroId = keskenOlevaVuoro(readCollection('guardShifts') || [], req.username)?.id || null;
  res.json({
    ok: true,
    ...omatSiirrot(siirrot, req.username, vuoroId),
    // Omana kenttänään: pakotus estää muun käytön kunnes se on kuitattu, eikä sitä saa
    // sekoittaa siirtoihin joissa saaja saa valita.
    pakotukset: kuittaamattomatPakotukset(siirrot, req.username, vuoroId),
  });
});

// Ketkä ovat nyt vuorossa ja voivat siksi ottaa siirron vastaan.
//
// Kysyjän on itse oltava vuorossa: siirtää voi vain omasta vuorostaan, joten
// vuoroton ei tarvitse tätä listaa eikä hänelle kuulu tieto siitä kuka on missäkin
// kentällä. Palautetaan vain se mitä valintaan tarvitaan — tunnus, näyttönimi ja
// kohteen nimi — eikä esimerkiksi vuoron alkamisaikaa tai tehtäviä.
//
// Kohteen nimi on mukana tarkoituksella: piirivartija ja kauppakeskusvartija ovat eri
// kohteissa, ja "kenelle siirrän" on käytännössä kysymys "kuka on lähellä".
app.get('/api/siirrot/vastaanottajat', requireAuth, guardPortti, (req, res) => {
  const vuorot = readCollection('guardShifts') || [];
  if (!keskenOlevaVuoro(vuorot, req.username)) {
    return res.status(409).json({ ok: false, error: 'Et ole vuorossa.' });
  }
  const vastaanottajat = vuorot
    .filter((v) => v?.tila === 'kesken' && v.vartija !== req.username)
    .map((v) => {
      const kayttaja = findUser(v.vartija);
      return {
        username: v.vartija,
        nimi: kayttaja?.nickname || v.vartija,
        kohde: v.siteNimi || '',
      };
    });
  res.json({ ok: true, vastaanottajat });
});

// Uusi siirto. Antaja antaa OMAN tehtävänsä, joten se haetaan hänen kesken olevasta
// vuorostaan — vartija ei voi siirtää työtä jota hänellä itsellään ei ole.
app.post('/api/siirto', requireAuth, guardPortti, (req, res) => {
  const { saaja, laji, kohdeId, viesti } = req.body || {};
  const vuorot = readCollection('guardShifts') || [];

  const omaVuoro = keskenOlevaVuoro(vuorot, req.username);
  if (!omaVuoro) {
    return res.status(409).json({ ok: false, error: 'Et ole vuorossa. Siirtää voi vain omasta vuorostaan.' });
  }
  const lista = laji === 'kierros' ? omaVuoro.pohjat : omaVuoro.tehtavat;
  const osuma = (lista || []).find((x) => x?.id === kohdeId);
  if (!osuma) {
    return res.status(404).json({ ok: false, error: 'Tehtävää ei ole omassa vuorossasi.' });
  }
  if (!findUser(saaja)) {
    return res.status(404).json({ ok: false, error: 'Vartijaa ei löytynyt.' });
  }

  const siirrot = readCollection('guardAssignments') || [];
  if (joSiirrossa(siirrot, { saaja, kohdeId, laji })) {
    return res.status(409).json({ ok: false, error: 'Tämä tehtävä odottaa jo kyseisen vartijan vastausta.' });
  }

  const tulos = luoSiirto({
    antaja: req.username,
    saaja,
    laji,
    kohdeId,
    nimi: osuma.nimi,
    siteId: omaVuoro.siteId,
    siteNimi: omaVuoro.siteNimi,
    saajanVuoro: keskenOlevaVuoro(vuorot, saaja),
    viesti,
    id: crypto.randomUUID(),
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('guardAssignments', [tulos.siirto, ...siirrot]);
  // Molemmat nimet lokiin. Siirto ei tarkista perehdytystä, joten jälkikäteen on voitava
  // nähdä kuka antoi työn kenelle — vastuun ottaa antaja, joka on perehdytetty.
  logAudit({
    user: req.username, action: 'tehtava_siirretty', collection: 'guardAssignments',
    recordId: tulos.siirto.id, eventId: omaVuoro.siteId, saaja, laji,
  });
  kerroSiirrosta(tulos.siirto, 'create');
  res.json({ ok: true, siirto: tulos.siirto });
});

// Saajan vastaus. Hylkäys ei vaadi syytä: vaadittu syy tuottaa keksittyjä syitä.
app.post('/api/siirto/:id/vastaa', requireAuth, guardPortti, (req, res) => {
  const siirrot = readCollection('guardAssignments') || [];
  const siirto = siirrot.find((x) => x?.id === req.params.id);
  const tulos = vastaaSiirtoon({ siirto, kayttaja: req.username, hyvaksy: req.body?.hyvaksy === true });
  if (!tulos.ok) {
    return res.status(siirto ? 400 : 404).json({ ok: false, error: tulos.error });
  }

  writeCollection('guardAssignments', siirrot.map((x) => (x.id === siirto.id ? tulos.siirto : x)));
  logAudit({
    user: req.username,
    action: tulos.siirto.tila === 'hyvaksytty' ? 'tehtava_siirto_hyvaksytty' : 'tehtava_siirto_hylatty',
    collection: 'guardAssignments', recordId: siirto.id, eventId: siirto.siteId, antaja: siirto.antaja,
  });
  kerroSiirrosta(tulos.siirto, 'update');
  res.json({ ok: true, siirto: tulos.siirto });
});

// Antaja peruu odottavan siirron.
app.post('/api/siirto/:id/peru', requireAuth, guardPortti, (req, res) => {
  const siirrot = readCollection('guardAssignments') || [];
  const siirto = siirrot.find((x) => x?.id === req.params.id);
  const tulos = peruSiirto({ siirto, kayttaja: req.username });
  if (!tulos.ok) {
    return res.status(siirto ? 400 : 404).json({ ok: false, error: tulos.error });
  }

  writeCollection('guardAssignments', siirrot.map((x) => (x.id === siirto.id ? tulos.siirto : x)));
  logAudit({
    user: req.username, action: 'tehtava_siirto_peruttu', collection: 'guardAssignments',
    recordId: siirto.id, eventId: siirto.siteId, saaja: siirto.saaja,
  });
  kerroSiirrosta(tulos.siirto, 'update');
  res.json({ ok: true, siirto: tulos.siirto });
});

// --- Pakotus (erä 19) ---------------------------------------------------------------

// Kaikkien kohteiden kaikki tehtävät ja kierrokset yhtenä listana.
//
// Tällaista näkymää ei ole ollut: tehtävät ovat kohteen sisällä, ja niiden vertailu on
// vaatinut kohteen vaihtamista. Lista on pääkäyttäjälle ja hälytyskeskukselle, ja se on
// se paikka josta tehtävä pakotetaan vartijalle.
//
// Kohdejoukko tulee readableDatasta eikä omasta säännöstä: lista ei voi näyttää kohdetta
// jota kutsuja ei muutenkaan saisi lukea.
app.get('/api/tehtavat/kaikki', requireAuth, guardPortti, (req, res) => {
  if (!saaMyontaaKertaluvan(req)) {
    return res.status(403).json({ ok: false, error: 'Vaatii pääkäyttäjän tai hälytyskeskuksen oikeudet.' });
  }
  const luettavat = readableData(
    req.role, req.permissions, req.eventAccess, 'guardSites', readCollection('guardSites')
  );
  if (!luettavat.ok) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia kohteiden lukemiseen.' });
  }
  const pohjat = readCollection('templates') || [];
  const kohteet = (luettavat.data || [])
    .filter((k) => k && !k.archived)
    .map((k) => ({
      siteId: k.id,
      siteNimi: k.name || '',
      tehtavat: (k.tehtavat || []).map((t) => ({
        id: t.id, nimi: t.nimi, tyyppi: t.tyyppi, suoritusaika: t.suoritusaika || null,
      })),
      pohjat: pohjat
        .filter((po) => po?.ownerId === k.id && po.kind === 'patrol' && !po.arkistoitu)
        .map((po) => ({ id: po.id, nimi: po.nimi, suoritusaika: po.suoritusaika || null })),
    }))
    .filter((k) => k.tehtavat.length > 0 || k.pohjat.length > 0);

  // Vartijalista samassa vastauksessa eikä omalla reitillään: se on tämän näkymän
  // valintalista eikä itsenäinen tieto, ja kaksi kutsua yhdelle ruudulle on kaksi
  // paikkaa jossa toinen voi epäonnistua ilman että käyttäjä ymmärtää miksi.
  //
  // Pakotus ei vaadi perehdytystä eikä vuoroa, joten rajaus on vain tuotepääsy:
  // määräys ei ole pyyntö, eikä sen ehtona voi olla että saaja on kirjautunut vuoroon.
  const vartijat = listUsers()
    .filter((u) => paaseeTuotteisiin(u).includes('guard'))
    .map((u) => ({ username: u.username, nimi: u.nickname || u.username, displayId: u.displayId ?? null }));

  res.json({ ok: true, kohteet, vartijat });
});

// Pakotus: pääkäyttäjä tai hälytyskeskus määrää tehtävän vartijalle.
//
// Ero siirtoon on kaksi asiaa ja vain ne: saaja ei voi kieltäytyä, ja hänen on
// kuitattava. Pakotus ei myöskään vaadi saajalta vuoroa — määräys ei ole pyyntö, eikä
// sen ehtona voi olla että saaja on sattumalta kirjautunut vuoroon.
//
// Tehtävä haetaan KOHTEEN hakemistosta eikä määrääjän vuorosta: pääkäyttäjä ei ole
// vuorossa, ja koko ominaisuuden tarkoitus on että hän voi määrätä mitä tahansa mistä
// tahansa kohteesta.
app.post('/api/pakota', requireAuth, guardPortti, (req, res) => {
  if (!saaMyontaaKertaluvan(req)) {
    return res.status(403).json({ ok: false, error: 'Vaatii pääkäyttäjän tai hälytyskeskuksen oikeudet.' });
  }
  const { saaja, siteId, laji, kohdeId, viesti, nimi, raporttilaji } = req.body || {};

  const kohde = (readCollection('guardSites') || []).find((k) => k?.id === siteId);
  if (!kohde) return res.status(404).json({ ok: false, error: 'Kohdetta ei löytynyt.' });
  if (!findUser(saaja)) return res.status(404).json({ ok: false, error: 'Vartijaa ei löytynyt.' });

  // OMA TEHTÄVÄ EI OLE LUETTELOSSA (18.9.2026). Juuri ne työt jotka eivät mahdu valmiiseen
  // luetteloon — "vie kohteeseen uusi vartijakutsupainike" — ovat niitä joita päivystäjä
  // joutuu antamaan kesken vuoron. Sillä on siis nimi mutta ei luettelotunnusta, ja
  // tunnus luodaan tässä: tunnukseton rivi rikkoisi päällekkäisyystarkistuksen ja
  // kuittauksen kohdistuksen.
  //
  // Luettelosta annetun tehtävän nimi luetaan kohteesta eikä uskota selaimen antamaa:
  // nimi menee tietueeseen pysyvästi, ja väärä nimi oikealla tunnuksella olisi
  // työmääräys joka väittää olevansa jotain muuta kuin on.
  const oma = laji === 'oma';
  let osuma = null;
  if (!oma) {
    osuma = laji === 'kierros'
      ? (readCollection('templates') || []).find((po) => po?.id === kohdeId && po.ownerId === siteId)
      : (kohde.tehtavat || []).find((t) => t?.id === kohdeId);
    if (!osuma) return res.status(404).json({ ok: false, error: 'Tehtävää ei löytynyt kohteesta.' });
  }
  const lopullinenKohdeId = oma ? crypto.randomUUID() : kohdeId;

  const siirrot = readCollection('guardAssignments') || [];
  // Oma tehtävä ei voi olla päällekkäinen: jokainen on uusi ja saa oman tunnuksensa.
  if (!oma && joSiirrossa(siirrot, { saaja, kohdeId, laji })) {
    return res.status(409).json({ ok: false, error: 'Tämä tehtävä odottaa jo kyseisen vartijan vastausta.' });
  }

  const tulos = luoSiirto({
    antaja: req.username,
    saaja,
    laji,
    kohdeId: lopullinenKohdeId,
    nimi: oma ? nimi : osuma.nimi,
    siteId,
    siteNimi: kohde.name || '',
    saajanVuoro: keskenOlevaVuoro(readCollection('guardShifts') || [], saaja),
    viesti,
    tapa: 'pakotus',
    raporttilaji: raporttilaji || null,
    id: crypto.randomUUID(),
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('guardAssignments', [tulos.siirto, ...siirrot]);
  logAudit({
    user: req.username, action: 'tehtava_pakotettu', collection: 'guardAssignments',
    recordId: tulos.siirto.id, eventId: siteId, saaja, laji,
    ...(raporttilaji ? { raporttilaji } : {}),
  });
  kerroSiirrosta(tulos.siirto, 'create');
  res.json({ ok: true, siirto: tulos.siirto });
});

// Saaja kuittaa pakotetun tehtävän nähdyksi.
//
// Kuittaus EI ole hyväksyntä: sitä ei voi hylätä. Se on merkintä siitä että määräys on
// nähty — määräys jonka vastaanotosta ei ole merkintää ei ole määräys vaan toive.
// Vartija merkitsee pakotetun tehtävän tehdyksi ja liittää vaaditun raportin.
app.post('/api/siirto/:id/valmis', requireAuth, guardPortti, (req, res) => {
  const siirrot = readCollection('guardAssignments') || [];
  const siirto = siirrot.find((x) => x?.id === req.params.id);
  if (!siirto) return res.status(404).json({ ok: false, error: 'Tehtävää ei löytynyt.' });

  // Tapahtumailmoitus tarkistetaan TÄÄLLÄ eikä siirto.js:ssä, joka ei lue levyä. Raportin
  // on oltava olemassa ja vartijan itsensä kirjoittama: muuten tehtävän voisi kuitata
  // liittämällä siihen kenen tahansa raportin.
  const raporttiId = typeof req.body?.raporttiId === 'string' ? req.body.raporttiId : null;
  if (raporttiId) {
    const raportti = (readCollection('guardReports') || []).find((r) => r?.id === raporttiId);
    if (!raportti || raportti.author !== req.username) {
      return res.status(404).json({ ok: false, error: 'Tapahtumailmoitusta ei löytynyt omista raporteistasi.' });
    }
  }

  const tulos = merkitseSiirtoValmiiksi({
    siirto, kayttaja: req.username, raporttiId, teksti: req.body?.teksti,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  if (tulos.duplikaatti) return res.json({ ok: true, siirto: tulos.siirto, duplikaatti: true });

  writeCollection('guardAssignments', siirrot.map((x) => (x.id === siirto.id ? tulos.siirto : x)));
  logAudit({
    user: req.username, action: 'tehtava_tehty', collection: 'guardAssignments',
    recordId: siirto.id, eventId: siirto.siteId, maaraaja: siirto.antaja,
    ...(siirto.raporttilaji ? { raporttilaji: siirto.raporttilaji } : {}),
  });
  kerroSiirrosta(tulos.siirto, 'update');
  res.json({ ok: true, siirto: tulos.siirto });
});

app.post('/api/siirto/:id/kuittaa', requireAuth, guardPortti, (req, res) => {
  const siirrot = readCollection('guardAssignments') || [];
  const siirto = siirrot.find((x) => x?.id === req.params.id);
  const tulos = kuittaaPakotus({ siirto, kayttaja: req.username });
  if (!tulos.ok) {
    return res.status(siirto ? 400 : 404).json({ ok: false, error: tulos.error });
  }
  if (tulos.duplikaatti) return res.json({ ok: true, siirto: tulos.siirto, duplikaatti: true });

  writeCollection('guardAssignments', siirrot.map((x) => (x.id === siirto.id ? tulos.siirto : x)));
  logAudit({
    user: req.username, action: 'tehtava_kuitattu', collection: 'guardAssignments',
    recordId: siirto.id, eventId: siirto.siteId, maaraaja: siirto.antaja,
  });
  kerroSiirrosta(tulos.siirto, 'update');
  res.json({ ok: true, siirto: tulos.siirto });
});

// ====================== HÄLYTYSTEHTÄVÄT (erä 22) ======================
//
// Hälytyskeskuksen kentälle antama keikka. Säännöt ovat halytystehtava.js:ssä; täällä on
// vain se mitä sääntömoduuli ei voi tietää: kuka kutsuja on, mitä levyllä on ja kenelle
// muutoksesta kerrotaan.
//
// KOHDENNUS ON REITIN LOGIIKKAA EIKÄ OIKEUSTAULUKON RIVI. Vartija ei saa lukea
// guardDispatch-kokoelmaa listahaulla — se on päivystäjän näkymä kaikkiin kohteisiin.
// Vartija lukee oman reittinsä, joka kysyy jokaisesta tehtävästä erikseen näkeekö hän
// sen (vuoro / piirivuoro / säde). Sama syy kuin siirroissa: hälytys kohdennetaan sen
// perusteella missä ihminen on, ei sen perusteella mihin kohteisiin hänen tunnuksellaan
// on pääsy.

// Päivystäjän oikeus. Sama ehto kuin kertaluvan myöntämisessä (saaMyontaaKertaluvan) ja
// tarkoituksella: se joka voi avata vuoron perehdyttämättömälle vartijalle on sama joka
// hälyttää hänet kohteeseen. Erillinen nimi siksi, että lukija näkee kumpaa oikeutta
// reitillä tarkoitetaan.
const saaPaivystaa = (req) => req.role === 'admin' || canEdit(req.permissions, null, 'guard_dispatch');

// Se konteksti jota vastaan kohdennus lasketaan. Kootaan kerran per pyyntö: sadan
// tehtävän lista ei saa lukea vuorokokoelmaa sata kertaa.
function kohdennusKonteksti(username) {
  return {
    vuoro: keskenOlevaVuoro(readCollection('guardShifts') || [], username) || null,
    // Sijaintiseuranta on oletuksena pois päältä, jolloin tämä on aina null ja
    // sädekohdennus ei tuo ketään. Ks. halytystehtava.js: nakeeTehtavan.
    sijainti: haeSijainti(username),
    kohteet: readCollection('guardSites') || [],
  };
}

// Mitä tehtävästä kerrotaan vartijalle. Kohteen osoite, yhteystiedot ja avaintiedot
// tulevat mukaan VASTA kun tehtävä on otettu vastaan (ks. kohteenOtsikko alla) — tehtävän
// näkeminen on hälytys, ei pääsy kohteen tietoihin.
function vartijanTehtava(tehtava, { kohde, username, peruste, etaisyys }) {
  const mukana = (tehtava.yksikot || []).some((y) => y?.vartija === username && !y.kieltaytyi);
  return {
    ...tehtava,
    // Kohdennuksen peruste näytetään vartijalle. "Miksi minulle tuli hälytys kohteesta
    // jossa en ole koskaan käynyt" on kysymys johon on saatava vastaus näkymästä.
    peruste,
    etaisyysKm: etaisyys,
    toiminnot: omatToiminnot({ tehtava, vartija: username }),
    kohde: mukana ? kohteenTiedotHalytykseen(kohde) : null,
  };
}

// Kohteen ne tiedot jotka hälytystehtävä avaa: osoite, yhteystiedot, kulkuohje ja
// avaintiedot. EI koko kohdetietuetta — perehdytykset, vuorotyypit, tehtävät ja
// kierrospohjat eivät kuulu tähän, eikä niitä saisi avata sivutuotteena hälytyksestä.
//
// Master-koodi on mukana. Se on tarkoituksellinen: ovenavaus ilman koodia ei ole
// ovenavaus, ja koodi on juuri se tieto jonka takia välilehti on olemassa. Sen avaaminen
// kirjataan auditlokiin omalla reitillään (/api/halytystehtava/:id/masterkoodi), joten
// tässä palautetaan vain tieto siitä ONKO koodi olemassa.
function kohteenTiedotHalytykseen(kohde) {
  if (!kohde) return null;
  return {
    id: kohde.id,
    name: kohde.name || '',
    address: kohde.address || '',
    contactName: kohde.contactName || '',
    contactPhone: kohde.contactPhone || '',
    notes: kohde.notes || '',
    halytysNumerot: Array.isArray(kohde.halytysNumerot) ? kohde.halytysNumerot : [],
    avaimet: Array.isArray(kohde.avaimet) ? kohde.avaimet : [],
    halytysjarjestelma: kohde.halytysjarjestelma || '',
    avaintenSailytys: kohde.avaintenSailytys || '',
    onMasterkoodi: Boolean(kohde.masterkoodi),
  };
}

// Kanavaviesti hälytystehtävästä.
//
// Suodatin laskee kohdennuksen samalla funktiolla kuin listahaku. Ilman sitä kanava
// kertoisi jokaiselle vartijalle että jossain tapahtui jotain — ja juuri se on se vuoto
// jonka takia kanava ei muutenkaan kuljeta sisältöä.
function kerroTehtavasta(tehtava) {
  const kohde = (readCollection('guardSites') || []).find((k) => k?.id === tehtava.siteId);
  const vuorot = readCollection('guardShifts') || [];
  lahetaKanavalle('guardDispatch', [{ action: 'update', id: tehtava.id, eventId: tehtava.siteId }], {
    saaNahda: (istunto) => {
      if (!istunto || !(istunto.tuotteet || []).includes('guard')) return false;
      if (istunto.role === 'admin') return true;
      if (canView(rolePermissions(istunto.roleId), null, 'guard_dispatch')) return true;
      return nakeeTehtavan({
        tehtava,
        kohde,
        vartija: istunto.username,
        vuoro: keskenOlevaVuoro(vuorot, istunto.username) || null,
        sijainti: haeSijainti(istunto.username),
        sadeKm: kohde?.halytysSadeKm,
      }).nakee;
    },
  });
}

// Vartijan oma lista. Avoimet tehtävät joihin hän on kohdennettu, uusin ensin.
app.get('/api/halytystehtavat/omat', requireAuth, guardPortti, (req, res) => {
  const { vuoro, sijainti, kohteet } = kohdennusKonteksti(req.username);
  const tehtavat = (readCollection('guardDispatch') || [])
    .filter((t) => t && AVOIMET_TILAT.has(t.tila))
    .map((t) => {
      const kohde = kohteet.find((k) => k?.id === t.siteId) || null;
      const osuma = nakeeTehtavan({
        tehtava: t, kohde, vartija: req.username, vuoro,
        sijainti, sadeKm: kohde?.halytysSadeKm,
      });
      return osuma.nakee
        ? vartijanTehtava(t, {
            kohde, username: req.username, peruste: osuma.peruste, etaisyys: osuma.etaisyysKm,
          })
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => String(b.luotu).localeCompare(String(a.luotu)));

  res.json({
    ok: true,
    tehtavat,
    // Yksikön nimi jolla vastaanotto kirjataan. Näytetään etukäteen, jotta vartija tietää
    // millä nimellä hän ilmestyy hälytyskeskuksen ruudulle — vuoroton vartija ilmestyy
    // nimimerkillään, ja se on hyvä tietää ennen kuin painaa.
    yksikko: vuoro?.vuorotyyppiNimi || findUser(req.username)?.nickname || req.username,
  });
});

// Päivystäjän lista: kaikki tehtävät kaikista kohteista. `?kaikki=1` ottaa mukaan myös
// päättyneet — oletuksena vain auki olevat, koska valvomon ruudulla eilinen keikka on
// häiriö.
app.get('/api/halytystehtavat', requireAuth, guardPortti, (req, res) => {
  if (!(req.role === 'admin' || canView(req.permissions, null, 'guard_dispatch'))) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia hälytyskeskukseen.' });
  }
  const kaikki = req.query?.kaikki === '1';
  const tehtavat = (readCollection('guardDispatch') || [])
    .filter((t) => t && (kaikki || AVOIMET_TILAT.has(t.tila)))
    .sort((a, b) => String(b.luotu).localeCompare(String(a.luotu)));
  res.json({ ok: true, tehtavat, saaMuokata: saaPaivystaa(req) });
});

// Uusi hälytystehtävä.
app.post('/api/halytystehtava', requireAuth, guardPortti, (req, res) => {
  if (!saaPaivystaa(req)) {
    return res.status(403).json({ ok: false, error: 'Vaatii hälytyskeskuksen muokkausoikeuden.' });
  }
  const { laji, siteId, silmukka, havainnot } = req.body || {};
  const kohde = (readCollection('guardSites') || []).find((k) => k?.id === siteId);
  if (!kohde) return res.status(404).json({ ok: false, error: 'Kohdetta ei löytynyt.' });

  const tulos = luoTehtava({
    laji,
    kohde,
    silmukka,
    havainnot: Array.isArray(havainnot) ? havainnot : [],
    luoja: req.username,
    id: crypto.randomUUID(),
    havaintoId: () => crypto.randomUUID(),
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  const tehtavat = readCollection('guardDispatch') || [];
  writeCollection('guardDispatch', [tulos.tehtava, ...tehtavat]);
  // Ruudut ensin, puhelimet sitten. kerroTehtavasta päivittää auki olevat näkymät,
  // herataTehtavasta herättää kohdennettujen vartijoiden puhelimet.
  kerroTehtavasta(tulos.tehtava);

  // KÄSIN LUOTU TEHTÄVÄ HERÄTTÄÄ SAMOIN KUIN AUTOMAATTINEN (korjattu 15.9.2026).
  //
  // Ensimmäinen versio kytki herätyksen vain turvahälytyksestä syntyvään
  // tarkistustehtävään, ja käsin luotu hälytystehtävä lähti kanavalle pelkkänä
  // kokoelmamuutoksena — jonka sovellus ohittaa tarkoituksella. Seuraus: päivystäjä
  // lähetti murtohälytyksen eikä vartijan puhelimessa tapahtunut mitään.
  //
  // Se oli aukko eikä valinta. Kohdennetun tehtävän koko tarkoitus on tavoittaa vartija,
  // eikä kello kolmelta yöllä lähetetty murtohälytys tavoita ketään jos se odottaa että
  // joku sattuu avaamaan sovelluksen.
  const heratetty = herataTehtavasta(tulos.tehtava, kohde);
  logAudit({
    user: req.username, action: 'halytystehtava_luotu', collection: 'guardDispatch',
    recordId: tulos.tehtava.id, eventId: siteId, laji, laitteita: heratetty,
  });
  res.json({ ok: true, tehtava: tulos.tehtava });
});

// Yhteinen kuori: hae tehtävä, aja sääntö, kirjoita, kerro. Kaikki alla olevat reitit
// tekevät saman neljä askelta, ja kopioituna ne erkanisivat toisistaan.
function muutaTehtava(req, res, { tarkista, saanto, action, lisa = {} }) {
  const tehtavat = readCollection('guardDispatch') || [];
  const tehtava = tehtavat.find((t) => t?.id === req.params.id);
  if (!tehtava) return res.status(404).json({ ok: false, error: 'Tehtävää ei löytynyt.' });

  const este = tarkista ? tarkista(tehtava) : null;
  if (este) return res.status(este.status).json({ ok: false, error: este.error });

  const tulos = saanto(tehtava);
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  if (tulos.duplikaatti) return res.json({ ok: true, tehtava: tulos.tehtava, duplikaatti: true });

  writeCollection('guardDispatch', tehtavat.map((t) => (t.id === tehtava.id ? tulos.tehtava : t)));
  logAudit({
    user: req.username, action, collection: 'guardDispatch',
    recordId: tehtava.id, eventId: tehtava.siteId, ...lisa,
  });
  kerroTehtavasta(tulos.tehtava);
  return res.json({ ok: true, tehtava: tulos.tehtava });
}

// Päivystäjä lisää havainnon kesken tehtävän.
app.post('/api/halytystehtava/:id/havainto', requireAuth, guardPortti, (req, res) => {
  if (!saaPaivystaa(req)) {
    return res.status(403).json({ ok: false, error: 'Vaatii hälytyskeskuksen muokkausoikeuden.' });
  }
  return muutaTehtava(req, res, {
    saanto: (tehtava) => lisaaHavainto({
      tehtava, teksti: req.body?.teksti, kirjaaja: req.username, id: crypto.randomUUID(),
    }),
    action: 'halytystehtava_havainto',
  });
});

// Onko raportti tämän käyttäjän kirjaama.
//
// `author` on NIMIMERKKI eikä käyttäjätunnus (src/guard/GuardApp.tsx antaa lomakkeelle
// `session.nickname`), joten pelkkä vertailu käyttäjätunnukseen hylkäisi vartijan oman
// raportin aina kun nimimerkki poikkeaa tunnuksesta — eli lähes aina. Vika ei näkynyt
// erässä 22, koska sen testaus tehtiin pääkäyttäjänä ja admin ohittaa tarkistuksen.
//
// Kenttä on ihmiselle tarkoitettu näyttönimi eikä identiteetti, joten tämä ei ole
// varsinainen oikeustarkistus: se estää vahingossa väärän raportin liittämisen. Se että
// vartija on tehtävällä, tarkistetaan sääntömoduulissa (halytystehtava.js).
function omaRaportti(req, raportti) {
  if (req.role === 'admin') return true;
  const nimimerkki = findUser(req.username)?.nickname || req.username;
  return raportti?.author === nimimerkki || raportti?.author === req.username;
}

// Vartijan yksikön nimi tähän tehtävään. Vuorosta jos vuoro on, muuten nimimerkki.
function yksikonNimi(username) {
  const vuoro = keskenOlevaVuoro(readCollection('guardShifts') || [], username);
  return vuoro?.vuorotyyppiNimi || findUser(username)?.nickname || username;
}

// Kohdennuksen tarkistus kirjoitusreiteillä.
//
// Tämä EI ole sama asia kuin listahaun suodatin, vaikka se käyttää samaa funktiota:
// listahaku päättää mitä näytetään, tämä estää sen että hälytyksen id:n arvannut tunnus
// voisi kirjata itsensä toisen kohteen keikalle. Ilman tätä koko kohdennus olisi
// käyttöliittymän suositus.
function kohdennusEstaa(req, tehtava) {
  if (req.role === 'admin') return null;
  const { vuoro, sijainti, kohteet } = kohdennusKonteksti(req.username);
  const kohde = kohteet.find((k) => k?.id === tehtava.siteId) || null;
  const osuma = nakeeTehtavan({
    tehtava, kohde, vartija: req.username, vuoro,
    sijainti, sadeKm: kohde?.halytysSadeKm,
  });
  return osuma.nakee
    ? null
    : { status: 403, error: 'Tätä hälytystä ei ole kohdennettu sinulle.' };
}

// Vartija ottaa tehtävän vastaan. `ajoon: true` on valikon rivi "Ota vastaan ja lähde
// ajoon" — yksi painallus eikä kaksi, koska auton ratissa niitä ei ole toista.
app.post('/api/halytystehtava/:id/vastaanota', requireAuth, guardPortti, (req, res) => {
  const nimi = yksikonNimi(req.username);
  return muutaTehtava(req, res, {
    tarkista: (tehtava) => kohdennusEstaa(req, tehtava),
    saanto: (tehtava) => vastaanota({
      tehtava, vartija: req.username, yksikko: nimi,
      vuoroId: keskenOlevaVuoro(readCollection('guardShifts') || [], req.username)?.id || null,
      ajoon: req.body?.ajoon === true,
    }),
    action: 'halytystehtava_vastaanotettu',
    lisa: { yksikko: nimi },
  });
});

// Vartija kieltäytyy. Kieltäytyminen kirjataan: "kukaan ei vastannut" ja "kaikki
// kieltäytyivät" ovat päivystäjälle kaksi eri tilannetta.
app.post('/api/halytystehtava/:id/kieltaydy', requireAuth, guardPortti, (req, res) => {
  const nimi = yksikonNimi(req.username);
  return muutaTehtava(req, res, {
    tarkista: (tehtava) => kohdennusEstaa(req, tehtava),
    saanto: (tehtava) => kieltaydy({
      tehtava, vartija: req.username, yksikko: nimi, syy: req.body?.syy,
    }),
    action: 'halytystehtava_kieltaytyminen',
    lisa: { yksikko: nimi },
  });
});

// Vaihe: ajoon tai paikalla.
app.post('/api/halytystehtava/:id/vaihe', requireAuth, guardPortti, (req, res) => (
  muutaTehtava(req, res, {
    saanto: (tehtava) => merkitseVaihe({ tehtava, vartija: req.username, vaihe: req.body?.vaihe }),
    action: 'halytystehtava_vaihe',
    lisa: { vaihe: String(req.body?.vaihe || '') },
  })
));

// Vartija lähettää raportin ja pyytää lupaa poistua.
//
// Raportti itse on jo tallennettu guardReports-kokoelmaan tavallista tietä, ja sen
// oikeudet ja kenttäsalaus tulevat sieltä. Tänne jää viittaus — kaksi kopiota samasta
// tekstistä tarkoittaisi kaksi paikkaa joista se pitää poistaa säilytysajan tullessa
// täyteen, ja toinen niistä unohtuisi.
app.post('/api/halytystehtava/:id/raportti', requireAuth, guardPortti, (req, res) => {
  const raporttiId = String(req.body?.raporttiId || '');
  const raportti = (readCollection('guardReports') || []).find((r) => r?.id === raporttiId);
  if (!raportti) return res.status(404).json({ ok: false, error: 'Raporttia ei löytynyt.' });
  if (!omaRaportti(req, raportti)) {
    return res.status(403).json({ ok: false, error: 'Raportti on toisen kirjaama.' });
  }
  return muutaTehtava(req, res, {
    // Raportin on kuuluttava SAMAAN KOHTEESEEN kuin tehtävän. Ilman tätä vartija voisi
    // kuitata poistumisensa kohteesta A liittämällä siihen kohteessa B kirjoittamansa
    // raportin, ja hyväksyntäketju hyväksyisi väärän dokumentin.
    tarkista: (tehtava) => (raportti.siteId === tehtava.siteId
      ? null
      : { status: 400, error: 'Raportti on kirjattu toiseen kohteeseen.' }),
    saanto: (tehtava) => lahetaRaportti({ tehtava, vartija: req.username, raporttiId }),
    action: 'halytystehtava_raportti',
    lisa: { raporttiId },
  });
});

// Tapahtumailmoituksen ne kentät jotka kirjataan LYTP:n nojalla kohdehenkilöstä.
//
// Nämä karsitaan päivystäjältä joka ei muuten saisi lukea kohteen raportteja. Ks.
// perustelu alla olevalla reitillä.
const LYTP_KOHDEHENKILO = [
  'licenseHolder',
  'subjectLastName',
  'subjectFirstNames',
  'subjectPersonalId',
  'subjectAddress',
  'subjectFeatures',
  'subjectObservations',
];

function ilmanKohdehenkiloa(raportti) {
  const kopio = { ...raportti };
  let karsittu = false;
  for (const kentta of LYTP_KOHDEHENKILO) {
    if (kopio[kentta]) karsittu = true;
    delete kopio[kentta];
  }
  // Liitteet pois id:tä myöten: niiden lukuoikeus tulee raporttisolmusta
  // (permissions.js: canReadGuardAttachment), joten linkki jota ei voi avata olisi
  // lupaus jota ei lunasteta. Lukumäärä jää, koska se on osa sitä onko ilmoitus valmis.
  const liitteita = (raportti.attachments || []).length;
  return { ...kopio, attachments: [], liitteita, kohdehenkiloKarsittu: karsittu };
}

// Poistumispyynnön raportit luettavaksi.
//
// OMA REITTINSÄ eikä guardReports-kokoelman listahaku, ja se on tietoinen poikkeus
// hälytyskeskuksen perussääntöön "näkymä KOKOAA sen mitä käyttäjä saa muutenkin nähdä
// eikä avaa mitään uutta" (ks. src/guard/sivukartta.ts).
//
// Poikkeuksen syy: päivystäjää pyydetään hyväksymään dokumentti. Hyväksyntänappi jonka
// vieressä ei ole sitä tekstiä jota hyväksytään ei ole hyväksyntä vaan kuittaus, ja juuri
// sen takia tämä reitti tehtiin (käyttäjän havainto 14.9.2026).
//
// Poikkeus on rajattu kolmella tavalla:
//
//   1. VAIN TÄMÄN TEHTÄVÄN raportit — ei kohteen muita, ei muiden kohteiden.
//   2. KOHDEHENKILÖN TIEDOT KARSITAAN siltä jolla ei ole raporttisolmun lukuoikeutta
//      kyseiseen kohteeseen. Päivystäjä ratkaisee onko toimenpiteet tehty; kohdehenkilön
//      henkilötunnus ja osoite eivät ole se tieto jolla se ratkeaa.
//   3. KARSITTU LUKU JÄÄ AUDITLOKIIN. Poikkeus jota ei voi jälkikäteen nähdä ei ole
//      poikkeus vaan aukko.
//
// Jos päivystäjän halutaan näkevän koko ilmoitus, ratkaisu ei ole tämän reitin
// laventaminen vaan raporttisolmun (guard_report_jv) myöntäminen tunnukselle — silloin
// pääsy näkyy oikeuseditorissa siellä missä sitä etsitään.
app.get('/api/halytystehtava/:id/raportit', requireAuth, guardPortti, (req, res) => {
  const tehtava = (readCollection('guardDispatch') || []).find((t) => t?.id === req.params.id);
  if (!tehtava) return res.status(404).json({ ok: false, error: 'Tehtävää ei löytynyt.' });

  const paivystaja = req.role === 'admin' || canView(req.permissions, null, 'guard_dispatch');
  const mukana = (tehtava.yksikot || []).some((y) => y?.vartija === req.username && !y.kieltaytyi);
  if (!paivystaja && !mukana) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän tehtävän raportteihin.' });
  }

  // Normaali lukuoikeus raportteihin tässä kohteessa. Sen omaava näkee ilmoituksen
  // kokonaisena, koska hän näkisi sen muutenkin kohteen tiedoista.
  const taysiLuku = req.role === 'admin'
    || (eventAllowed(req.eventAccess, tehtava.siteId)
      && (canView(req.permissions, tehtava.siteId, 'guard_report_jv')
        || canView(req.permissions, tehtava.siteId, 'guard_report_action')
        || canView(req.permissions, tehtava.siteId, 'guard_site_info')));

  const kaikki = readCollection('guardReports') || [];
  const raportit = (tehtava.raportit || [])
    .map((viite) => {
      const raportti = kaikki.find((r) => r?.id === viite.raporttiId);
      if (!raportti) return null;
      return {
        ...(taysiLuku ? raportti : ilmanKohdehenkiloa(raportti)),
        lahetetty: viite.lahetetty,
        yksikko: viite.nimi,
      };
    })
    .filter(Boolean);

  // Kirjataan aina kun lukija ei ole raportin kirjoittaja: tapahtumailmoitus on
  // henkilötietoa senkin jälkeen kun kohdehenkilön kentät on karsittu. Pääkäyttäjää EI
  // ohiteta — toisen kirjoittama ilmoitus on toisen kirjoittama myös pääkäyttäjälle, ja
  // juuri laajimmat oikeudet ovat ne joiden käyttö on voitava nähdä jälkikäteen.
  const omaNimi = findUser(req.username)?.nickname || req.username;
  const vieraita = raportit.some((r) => r.author !== omaNimi && r.author !== req.username);
  if (vieraita) {
    logAudit({
      user: req.username,
      action: taysiLuku ? 'halytystehtava_raportti_luettu' : 'halytystehtava_raportti_luettu_rajattuna',
      collection: 'guardReports', recordId: tehtava.id, eventId: tehtava.siteId,
      raportteja: raportit.length,
    });
  }

  res.json({ ok: true, raportit, rajattu: !taysiLuku });
});

/**
 * Liittää yksiköiden sijaintijäljen suljettuun hälytystehtävään.
 *
 * TÄMÄ ON SE KOHTA JOSSA SÄILYTYSAIKA VAIHTUU (käyttäjän päätös 15.9.2026). Sijaintiloki
 * säilyy 45 vuorokautta ja katoaa sen jälkeen, mutta hälytystehtävän ajalta kertyvä jälki
 * kuuluu siihen tapahtumaan josta ilmoitus tehdään — ja siihen sovelletaan LYTP:n
 * tapahtumailmoitusaikaa. Kopioimalla jälki tehtävän tietueeseen se elää tehtävän mukana
 * eikä ole enää lokin siivouksen varassa.
 *
 * Kopio eikä viittaus, ja se on tarkoituksellista: viittaus lokiin näyttäisi jäljeltä
 * mutta katoaisi 45 vuorokaudessa, jolloin kahden vuoden päästä tehtävässä olisi linkki
 * tyhjään.
 *
 * AIKAVÄLI ON VASTAANOTOSTA POISTUMISEEN. Se on täsmälleen se väli jonka käyttäjä
 * määritteli: siitä hetkestä kun vartija otti tehtävän vastaan siihen kun hälytyskeskus
 * antoi luvan poistua. Vartijan liikkeet ennen tehtävää tai sen jälkeen eivät kuulu
 * tähän tietueeseen — ne ovat lokissa ja katoavat 45 vuorokaudessa kuten muukin.
 *
 * Kieltäytyneelle ei jälkeä: hän ei ollut tehtävällä.
 */
function liitaJalki(tehtava) {
  try {
    const yksikot = (tehtava.yksikot || []).map((y) => {
      if (!y?.vartija || y.kieltaytyi || !y.vastaanotti) return y;
      const alku = Date.parse(y.vastaanotti);
      const loppu = Date.parse(y.poistui || new Date().toISOString());
      if (!Number.isFinite(alku) || !Number.isFinite(loppu)) return y;

      const pisteet = lueHistoria({ username: y.vartija, alku, loppu });
      if (pisteet.length === 0) return y;

      // Vain aika ja paikka. Käyttäjätunnus on jo yksikkörivillä, eikä nopeutta tai
      // suuntaa tarvita sen todentamiseen missä yksikkö oli — tämä on minimointi, ei
      // unohdus.
      const jalki = harvennaJalki(pisteet).map((p) => ({
        ts: p.ts, lat: p.lat, lon: p.lon, tarkkuus: p.tarkkuus ?? null,
      }));
      return {
        ...y,
        jalki,
        // Kerrotaan jos jälki on harvennettu: kahden vuoden päästä lukijan on tiedettävä
        // katsooko hän täyttä jälkeä vai otosta siitä.
        ...(jalki.length < pisteet.length ? { jalkiHarvennettu: pisteet.length } : {}),
      };
    });
    return { ...tehtava, yksikot };
  } catch (err) {
    // Jäljen liittäminen ei saa estää poistumisluvan antamista: vartija seisoo
    // kohteessa odottamassa, ja lokin lukuvirhe on huono syy pitää häntä siellä.
    console.error('Sijaintijäljen liittäminen epäonnistui:', err.message);
    return tehtava;
  }
}

// Päivystäjä ratkaisee poistumispyynnön. Hylkäys vaatii kommentin (halytystehtava.js).
app.post('/api/halytystehtava/:id/hyvaksynta', requireAuth, guardPortti, (req, res) => {
  if (!saaPaivystaa(req)) {
    return res.status(403).json({ ok: false, error: 'Vaatii hälytyskeskuksen muokkausoikeuden.' });
  }
  const hyvaksy = req.body?.hyvaksy === true;
  return muutaTehtava(req, res, {
    saanto: (tehtava) => {
      const tulos = ratkaiseHyvaksynta({
        tehtava, kasittelija: req.username, hyvaksy, kommentti: req.body?.kommentti,
      });
      // Jälki liitetään VAIN hyväksyttäessä. Palautettu poistumispyyntö tarkoittaa että
      // tehtävä jatkuu, eikä keskeneräisestä tehtävästä ole vielä lopullista jälkeä.
      return tulos.ok && hyvaksy ? { ...tulos, tehtava: liitaJalki(tulos.tehtava) } : tulos;
    },
    action: hyvaksy ? 'halytystehtava_hyvaksytty' : 'halytystehtava_palautettu',
  });
});

// Päivystäjä peruu tehtävän (väärä hälytys, asiakas kuittasi itse).
app.post('/api/halytystehtava/:id/peru', requireAuth, guardPortti, (req, res) => {
  if (!saaPaivystaa(req)) {
    return res.status(403).json({ ok: false, error: 'Vaatii hälytyskeskuksen muokkausoikeuden.' });
  }
  return muutaTehtava(req, res, {
    saanto: (tehtava) => peruTehtava({ tehtava, kasittelija: req.username, syy: req.body?.syy }),
    action: 'halytystehtava_peruttu',
  });
});

// Master-koodin paljastaminen.
//
// OMA REITTINSÄ eikä kenttä tehtävän tiedoissa, ja syy on auditloki: koodi avaa kohteen
// kenelle tahansa joka sen tietää, joten sen katsominen on tapahtuma josta on jäätävä
// merkintä. Jos koodi tulisi listahaun mukana, merkintä syntyisi jokaisesta listan
// avaamisesta eikä kertoisi kuka koodin oikeasti luki.
app.post('/api/halytystehtava/:id/masterkoodi', requireAuth, guardPortti, (req, res) => {
  const tehtava = (readCollection('guardDispatch') || []).find((t) => t?.id === req.params.id);
  if (!tehtava) return res.status(404).json({ ok: false, error: 'Tehtävää ei löytynyt.' });

  const mukana = (tehtava.yksikot || []).some((y) => y?.vartija === req.username && !y.kieltaytyi);
  if (!mukana && !saaPaivystaa(req)) {
    return res.status(403).json({ ok: false, error: 'Ota tehtävä ensin vastaan.' });
  }
  const kohde = (readCollection('guardSites') || []).find((k) => k?.id === tehtava.siteId);
  if (!kohde?.masterkoodi) {
    return res.status(404).json({ ok: false, error: 'Kohteelle ei ole kirjattu master-koodia.' });
  }
  logAudit({
    user: req.username, action: 'halytystehtava_masterkoodi', collection: 'guardSites',
    recordId: kohde.id, eventId: kohde.id, tehtavaId: tehtava.id,
  });
  res.json({ ok: true, masterkoodi: kohde.masterkoodi });
});

// Kanavaviesti pohjan muutoksesta. Viesti kuljettaa vain id:n, ja sisältö haetaan
// oikeustarkistetulta reitiltä. Skenaariopohjan muutos on tieto joka on saatava kentälle
// heti: pohja voi muuttua kesken tapahtuman juuri sen takia mitä tilanteessa opittiin.
function kerroPohjasta(pohja, action) {
  lahetaKanavalle('templates', [{ action, id: pohja.id, eventId: pohja.ownerId }], {
    saaNahda: (istunto, ownerId) => {
      if (istunto?.role === 'admin') return true;
      if (!eventAllowed(istunto?.eventAccess, ownerId)) return false;
      return canView(rolePermissions(istunto?.roleId), ownerId, lajinSolmu(pohja.kind, onKohteenPohja(pohja)));
    },
  });
}

const puhdasAika = (arvo) => (/^\d{1,2}:\d{2}$/.test(String(arvo ?? '').trim())
  ? String(arvo).trim()
  : undefined);

// Suunniteltu kesto minuutteina. Null on sallittu arvo (kentän tyhjennys), undefined ei
// tarkoita mitään syötettä. Ilman ylärajaa vahinkonollien lisääminen ("450" tarkoitettu
// "45") näyttäisi vartijalle yhtä mielettömältä luvulta kuin vika jota tämä kenttä korjaa.
const puhdasKesto = (arvo) => {
  if (arvo === null) return null;
  const n = Number(arvo);
  return Number.isFinite(n) && n > 0 && n <= 1440 ? Math.round(n) : null;
};

app.post('/api/pohjat', requireAuth, (req, res) => {
  const {
    kind, ownerId, nimi, kuvaus, pisteet, kohdat, sijaintiPakotus, sietorajaM, suoritusaika,
    suunniteltuKestoMin,
  } = req.body || {};
  if (!onTunnettuLaji(kind)) {
    return res.status(400).json({ ok: false, error: 'Tuntematon pohjalaji.' });
  }
  if (typeof ownerId !== 'string' || !ownerId) {
    return res.status(400).json({ ok: false, error: 'Omistaja puuttuu.' });
  }
  const omistaja = omistajanTiedot(ownerId);
  if (!omistaja) return res.status(404).json({ ok: false, error: 'Kohdetta tai tapahtumaa ei löytynyt.' });
  // Laji voi olla sidottu toiseen puoleen: run sheet on tapahtuman ajolista, kierrospohja
  // kohteen kierros. Väärälle omistajalle luotu pohja näkyisi listassa jota kukaan ei avaa.
  const lajinTuote = LAJIT[kind].tuote;
  if (lajinTuote === 'guard' && !omistaja.onKohde) {
    return res.status(400).json({ ok: false, error: `${LAJIT[kind].nimi} kuuluu vartiointikohteelle.` });
  }
  if (lajinTuote === 'event' && omistaja.onKohde) {
    return res.status(400).json({ ok: false, error: `${LAJIT[kind].nimi} kuuluu tapahtumalle.` });
  }
  if (!saaPohjia(req, ownerId, kind, omistaja.onKohde)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta muokata tämän omistajan pohjia.' });
  }

  const nimiTulos = tarkistaNimi(nimi);
  if (!nimiTulos.ok) return res.status(400).json({ ok: false, error: nimiTulos.error });

  const pohja = {
    id: crypto.randomUUID(),
    kind,
    ownerId,
    // Omistajan laji tallennetaan tietueeseen, koska oikeustarkistus (permissions.js) ei
    // voi lukea kokoelmia: ilman tätä se ei tietäisi kumman puolen solmua vasten pohjaa
    // verrataan.
    omistaja: omistaja.onKohde ? 'kohde' : 'tapahtuma',
    nimi: nimiTulos.nimi,
    kuvaus: puhdistaKuvaus(kuvaus),
    versio: 1,
    luotu: new Date().toISOString(),
    luoja: req.username,
    arkistoitu: null,
  };

  if (kind === 'patrol') {
    const pisteTulos = tarkistaPisteet(pisteet, [], kaytetytViivakoodit(readCollection('templates') || []));
    if (!pisteTulos.ok) return res.status(400).json({ ok: false, error: pisteTulos.error });
    pohja.pisteet = pisteTulos.pisteet;
    // Sijaintipakotus on pohjakohtainen asetus joka on OLETUKSENA POIS (päätös V2 = a):
    // puhelimen paikannus on rakennuksen seinustalla epäluotettava, eikä kierros saa
    // katketa siihen. Sijainti tallennetaan silti aina todisteeksi.
    pohja.sijaintiPakotus = sijaintiPakotus === true;
    pohja.sietorajaM = Number.isFinite(Number(sietorajaM)) && Number(sietorajaM) > 0
      ? Math.round(Number(sietorajaM))
      : OLETUS_SIETORAJA_M;
    // Suunniteltu suoritusaika (erä 18b). EI rajoita mitään: se kertoo vartijalle milloin
    // kierros on suunniteltu ajettavaksi ja järjestää työlistan. Poikkeamasta jää keltainen
    // merkintä vuoron koosteeseen (server/kooste.js), ei estettä.
    pohja.suoritusaika = puhdasAika(suoritusaika);
    pohja.suunniteltuKestoMin = puhdasKesto(suunniteltuKestoMin);
  } else {
    const kohtaTulos = tarkistaKohdat(kohdat, kind);
    if (!kohtaTulos.ok) return res.status(400).json({ ok: false, error: kohtaTulos.error });
    pohja.kohdat = kohtaTulos.kohdat;
  }

  writeCollection('templates', [...(readCollection('templates') || []), pohja]);
  logAudit({ user: req.username, action: 'template_create', collection: 'templates', recordId: pohja.id, eventId: ownerId, kind });
  kerroPohjasta(pohja, 'create');
  res.json({ ok: true, pohja: julkinenPohja(pohja) });
});

app.put('/api/pohjat/:id', requireAuth, (req, res) => {
  const pohjat = readCollection('templates') || [];
  const vanha = pohjat.find((p) => p.id === req.params.id);
  if (!vanha) return res.status(404).json({ ok: false, error: 'Pohjaa ei löytynyt.' });
  if (!saaPohjia(req, vanha.ownerId, vanha.kind, onKohteenPohja(vanha))) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta muokata tätä pohjaa.' });
  }

  const nimiTulos = tarkistaNimi(req.body?.nimi ?? vanha.nimi);
  if (!nimiTulos.ok) return res.status(400).json({ ok: false, error: nimiTulos.error });

  const paivitetty = {
    ...vanha,
    nimi: nimiTulos.nimi,
    kuvaus: puhdistaKuvaus(req.body?.kuvaus ?? vanha.kuvaus),
    muokattu: new Date().toISOString(),
    muokkaaja: req.username,
  };

  if (vanha.kind === 'patrol') {
    const pisteTulos = tarkistaPisteet(
      req.body?.pisteet ?? vanha.pisteet,
      vanha.pisteet,
      kaytetytViivakoodit(pohjat, vanha.id)
    );
    if (!pisteTulos.ok) return res.status(400).json({ ok: false, error: pisteTulos.error });
    paivitetty.pisteet = pisteTulos.pisteet;
    paivitetty.sijaintiPakotus = req.body?.sijaintiPakotus === undefined
      ? vanha.sijaintiPakotus === true
      : req.body.sijaintiPakotus === true;
    paivitetty.sietorajaM = Number.isFinite(Number(req.body?.sietorajaM)) && Number(req.body.sietorajaM) > 0
      ? Math.round(Number(req.body.sietorajaM))
      : (vanha.sietorajaM ?? OLETUS_SIETORAJA_M);
    // Puuttuva kenttä säilyttää vanhan, tyhjä merkkijono poistaa. Ero on tarpeen: aika on
    // voitava myös ottaa pois, eikä sitä voi tehdä jos tyhjä tarkoittaisi "älä muuta".
    paivitetty.suoritusaika = req.body?.suoritusaika === undefined
      ? vanha.suoritusaika
      : puhdasAika(req.body.suoritusaika);
    paivitetty.suunniteltuKestoMin = req.body?.suunniteltuKestoMin === undefined
      ? vanha.suunniteltuKestoMin
      : puhdasKesto(req.body.suunniteltuKestoMin);
  } else {
    const kohtaTulos = tarkistaKohdat(req.body?.kohdat ?? vanha.kohdat, vanha.kind);
    if (!kohtaTulos.ok) return res.status(400).json({ ok: false, error: kohtaTulos.error });
    paivitetty.kohdat = kohtaTulos.kohdat;
  }

  // Versio kasvaa vain jos sisältö muuttui: nimen korjaaminen ei tee pohjasta toista
  // pohjaa, mutta kohdan lisääminen tekee.
  if (sisaltoMuuttui(vanha, paivitetty)) paivitetty.versio = (vanha.versio ?? 1) + 1;

  writeCollection('templates', pohjat.map((p) => (p.id === vanha.id ? paivitetty : p)));
  logAudit({ user: req.username, action: 'template_update', collection: 'templates', recordId: vanha.id, eventId: vanha.ownerId, kind: vanha.kind });
  kerroPohjasta(paivitetty, 'update');
  res.json({ ok: true, pohja: julkinenPohja(paivitetty) });
});

// Arkistointi eikä poisto: jo tehdyt suoritukset viittaavat pohjaan, ja pohjan katoaminen
// tekisi niiden historiasta lukukelvotonta.
app.delete('/api/pohjat/:id', requireAuth, (req, res) => {
  const pohjat = readCollection('templates') || [];
  const pohja = pohjat.find((p) => p.id === req.params.id);
  if (!pohja) return res.status(404).json({ ok: false, error: 'Pohjaa ei löytynyt.' });
  if (!saaPohjia(req, pohja.ownerId, pohja.kind, onKohteenPohja(pohja))) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta poistaa tätä pohjaa käytöstä.' });
  }
  const paivitetty = { ...pohja, arkistoitu: new Date().toISOString(), arkistoija: req.username };
  writeCollection('templates', pohjat.map((p) => (p.id === pohja.id ? paivitetty : p)));
  logAudit({ user: req.username, action: 'template_archive', collection: 'templates', recordId: pohja.id, eventId: pohja.ownerId });
  kerroPohjasta(paivitetty, 'update');
  res.json({ ok: true });
});

// --- Pohjan suoritus: skenaario ja run sheet --------------------------------------
//
// Säännöt ovat suoritus.js:ssä; tässä on oikeustarkistus, levylle kirjoitus ja kanava.
// Kierroksella on omat reittinsä (/api/kierros), koska sen säännöt ja QR-skannaus ovat eri
// asia — yhteinen reitti olisi täynnä molempien erikoistapauksia.

// Kanavaviesti suorituksen muutoksesta. Skenaarion kulku on se tieto jonka on näyttävä
// kaikille yhtä aikaa: kaksi ihmistä ei saa tehdä samaa kohtaa siksi ettei kummallakaan ole
// tietoa toisen kuittauksesta.
function kerroSuorituksesta(suoritus, action) {
  lahetaKanavalle('templateRuns', [{ action, id: suoritus.id, eventId: suoritus.ownerId }], {
    saaNahda: (istunto, ownerId) => {
      if (istunto?.role === 'admin') return true;
      if (!eventAllowed(istunto?.eventAccess, ownerId)) return false;
      const perms = rolePermissions(istunto?.roleId);
      const onKohde = onKohteenPohja(suoritus);
      return canView(perms, ownerId, lajinSolmu(suoritus.kind, onKohde))
        || canView(perms, ownerId, onKohde ? 'guard_site_info' : 'overview');
    },
  });
}

app.post('/api/suoritus', requireAuth, (req, res) => {
  const pohja = (readCollection('templates') || []).find((p) => p.id === req.body?.templateId);
  if (!pohja) return res.status(404).json({ ok: false, error: 'Pohjaa ei löytynyt.' });
  if (!LAJIT[pohja.kind]?.instansoituu || pohja.kind === 'patrol') {
    return res.status(400).json({ ok: false, error: 'Tästä pohjalajista ei tehdä suorituksia.' });
  }
  if (!saaKayttaaPohjaa(req, pohja.ownerId, pohja.kind, onKohteenPohja(pohja))) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta käyttää tätä pohjaa.' });
  }

  const tulos = aloitaSuoritus({
    pohja,
    ownerId: pohja.ownerId,
    tekija: req.username,
    kuvaus: req.body?.kuvaus,
    id: crypto.randomUUID(),
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  const suoritus = { ...tulos.suoritus, omistaja: pohja.omistaja || 'kohde' };
  writeCollection('templateRuns', [suoritus, ...(readCollection('templateRuns') || [])]);
  logAudit({
    user: req.username, action: 'run_start', collection: 'templateRuns',
    recordId: suoritus.id, eventId: pohja.ownerId, kind: pohja.kind,
  });
  kerroSuorituksesta(suoritus, 'create');
  res.json({ ok: true, suoritus });
});

// Suorituksen haku oikeustarkistuksineen. Palauttaa nullin ja on jo vastannut, jos
// suoritusta ei ole tai oikeus puuttuu.
function haeSuoritus(req, res) {
  const suoritukset = readCollection('templateRuns') || [];
  const suoritus = suoritukset.find((s) => s.id === req.params.id);
  if (!suoritus) {
    res.status(404).json({ ok: false, error: 'Suoritusta ei löytynyt.' });
    return null;
  }
  if (!saaKayttaaPohjaa(req, suoritus.ownerId, suoritus.kind, onKohteenPohja(suoritus))) {
    res.status(403).json({ ok: false, error: 'Ei oikeutta tähän suoritukseen.' });
    return null;
  }
  return { suoritukset, suoritus };
}

app.post('/api/suoritus/:id/kohta', requireAuth, (req, res) => {
  const haku = haeSuoritus(req, res);
  if (!haku) return;
  const { suoritukset, suoritus } = haku;

  const tulos = kuittaaKohta({
    suoritus,
    kohtaId: req.body?.kohtaId,
    tekija: req.username,
    huomio: req.body?.huomio,
    toisto: req.body?.toisto === true,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  // Toisto jonosta: mikään ei muuttunut, joten levylle ei kirjoiteta eikä kanavalle
  // kerrota. Vastaus on silti ok, jotta jono poistaa kirjauksen listaltaan.
  if (tulos.duplikaatti) return res.json({ ok: true, suoritus: tulos.suoritus, duplikaatti: true });

  writeCollection('templateRuns', suoritukset.map((s) => (s.id === suoritus.id ? tulos.suoritus : s)));
  logAudit({
    user: req.username, action: 'run_step', collection: 'templateRuns',
    recordId: suoritus.id, eventId: suoritus.ownerId,
  });
  kerroSuorituksesta(tulos.suoritus, 'update');
  res.json({ ok: true, suoritus: tulos.suoritus });
});

app.post('/api/suoritus/:id/paata', requireAuth, (req, res) => {
  const haku = haeSuoritus(req, res);
  if (!haku) return;
  const { suoritukset, suoritus } = haku;

  const tulos = paataSuoritus({
    suoritus,
    tila: req.body?.tila,
    syy: req.body?.syy,
    huomiot: req.body?.huomiot,
    toisto: req.body?.toisto === true,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  if (tulos.duplikaatti) return res.json({ ok: true, suoritus: tulos.suoritus, duplikaatti: true });

  writeCollection('templateRuns', suoritukset.map((s) => (s.id === suoritus.id ? tulos.suoritus : s)));
  logAudit({
    user: req.username,
    action: tulos.suoritus.tila === 'valmis' ? 'run_complete' : 'run_abort',
    collection: 'templateRuns', recordId: suoritus.id, eventId: suoritus.ownerId,
  });
  kerroSuorituksesta(tulos.suoritus, 'update');
  res.json({ ok: true, suoritus: tulos.suoritus });
});


// Tarkistuspisteiden tokenit QR-tarroja varten. Erillinen reitti samasta syystä kuin
// jakolinkeillä ja julisteilla: token ei kulje jokaisessa listahaussa.
app.get('/api/pohjat/:id/tarrat', requireAuth, guardPortti, (req, res) => {
  const pohja = (readCollection('templates') || []).find((p) => p.id === req.params.id);
  if (!pohja) return res.status(404).json({ ok: false, error: 'Pohjaa ei löytynyt.' });
  if (!saaPohjia(req, pohja.ownerId, pohja.kind, true)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tämän pohjan tarroihin.' });
  }
  res.json({
    ok: true,
    nimi: pohja.nimi,
    pisteet: (pohja.pisteet || []).map((p) => ({
      id: p.id,
      nimi: p.nimi,
      token: p.token,
      koodi: p.koodi === 'code128' ? 'code128' : 'qr',
      viivakoodi: p.viivakoodi || '',
      vaadiKoodi: p.vaadiKoodi === true,
    })),
  });
});

// Kierroksen aloitus. Pisteet kopioidaan pohjasta (ks. kierros.js).
app.post('/api/kierros', requireAuth, guardPortti, (req, res) => {
  const { templateId } = req.body || {};
  const pohja = (readCollection('templates') || []).find((p) => p.id === templateId);
  if (!pohja || pohja.kind !== 'patrol') {
    return res.status(404).json({ ok: false, error: 'Kierrospohjaa ei löytynyt.' });
  }
  if (!saaKiertaa(req, pohja.ownerId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta kiertää tässä kohteessa.' });
  }

  const kierrokset = readCollection('patrolRuns') || [];
  // Yksi kesken oleva kierros kerrallaan samalle vartijalle samassa kohteessa. Kaksi
  // yhtä aikaa avointa kierrosta tarkoittaisi, ettei skannauksesta tiedä kumpaan se
  // kuuluu — ja unohtuneet avoimet kierrokset täyttäisivät listan.
  const auki = kierrokset.find(
    (k) => k.tila === 'kesken' && k.siteId === pohja.ownerId && k.vartija === req.username
  );
  if (auki) {
    return res.status(409).json({
      ok: false,
      error: 'Sinulla on jo kesken oleva kierros tässä kohteessa. Päätä se ensin.',
      kierrosId: auki.id,
    });
  }

  const tulos = aloitaKierros({
    pohja,
    siteId: pohja.ownerId,
    vartija: req.username,
    id: crypto.randomUUID(),
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('patrolRuns', [tulos.kierros, ...kierrokset]);
  logAudit({ user: req.username, action: 'patrol_start', collection: 'patrolRuns', recordId: tulos.kierros.id, eventId: pohja.ownerId });
  kerroKierroksesta(tulos.kierros, 'create');
  res.json({ ok: true, kierros: tulos.kierros });
});

// Kanavaviesti kierroksen muutoksesta. Sama periaate kuin yleisöilmoituksilla: viesti
// kuljettaa vain id:n, ja sisältö haetaan oikeustarkistetulta reitiltä.
function kerroKierroksesta(kierros, action) {
  lahetaKanavalle('patrolRuns', [{ action, id: kierros.id, eventId: kierros.siteId }], {
    saaNahda: (istunto, siteId) =>
      istunto?.role === 'admin' ||
      (eventAllowed(istunto?.eventAccess, siteId) && canView(rolePermissions(istunto?.roleId), siteId, 'guard_patrols')),
  });
}

// Tarkistuspisteen kuittaus. Piste voidaan yksilöidä joko id:llä (lista näkymässä) tai
// tokenilla (QR-tarra puhelimen kameralla) — jälkimmäinen on se tapa jolla tämä
// oikeasti tehdään kentällä.
// Tarran skannaus ilman että selain tietää mihin kierrokseen piste kuuluu.
//
// Näin tämä oikeasti tehdään kentällä: vartija skannaa tarran PUHELIMEN OMALLA
// kameralla, joka avaa selaimen osoitteeseen /guard?piste=<token>. Sovellus ei tuolloin
// tiedä pisteestä mitään — tokenit eivät kulje listahaussa — joten palvelin selvittää
// itse mihin pohjaan piste kuuluu ja onko vartijalla siihen kesken oleva kierros.
//
// Selaimeen ei siis tarvita QR-lukijakirjastoa eikä kameralupaa. Sama ratkaisu toimii
// myös vanhoilla puhelimilla, joissa selaimen BarcodeDetector puuttuu.
app.post('/api/kierros/skannaus', requireAuth, guardPortti, (req, res) => {
  const pohjat = readCollection('templates') || [];
  const osuma = etsiPisteKoodilla(pohjat, req.body?.token);
  if (!osuma) {
    return res.status(404).json({ ok: false, error: 'Tuntematon koodi. Se ei kuulu yhteenkään kierrospohjaan.' });
  }
  const { pohja, piste } = osuma;
  if (!saaKiertaa(req, pohja.ownerId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta kiertää tässä kohteessa.' });
  }

  const kierrokset = readCollection('patrolRuns') || [];
  const auki = kierrokset.find(
    (k) => k.tila === 'kesken' && k.templateId === pohja.id && k.vartija === req.username
  );
  if (!auki) {
    // Ei virhe vaan tilanne: vartija skannasi ensimmäisen pisteen ennen kuin aloitti
    // kierroksen. Kerrotaan mistä pohjasta on kyse, jotta käyttöliittymä voi tarjota
    // aloitusta yhdellä painalluksella sen sijaan että käskisi etsimään sen itse.
    return res.status(409).json({
      ok: false,
      error: `Sinulla ei ole kesken olevaa kierrosta pohjalla "${pohja.nimi}".`,
      ehdotus: { templateId: pohja.id, pohjaNimi: pohja.nimi, siteId: pohja.ownerId, pisteNimi: piste.nimi },
    });
  }

  const tulos = kuittaaPiste({
    kierros: auki,
    pisteId: piste.id,
    tapa: osuma.tapa,
    gps: tarkistaGps(req.body?.gps),
    huomio: req.body?.huomio,
    pakotaSijainti: pohja.sijaintiPakotus === true,
    sietorajaM: pohja.sietorajaM ?? OLETUS_SIETORAJA_M,
    toisto: req.body?.toisto === true,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  // Toisto jonosta: mikään ei muuttunut, joten levylle ei kirjoiteta eikä kanavalle
  // kerrota. Vastaus on silti ok, jotta jono poistaa kirjauksen listaltaan.
  if (tulos.duplikaatti) {
    return res.json({ ok: true, kierros: tulos.kierros, pisteNimi: piste.nimi, duplikaatti: true });
  }

  writeCollection('patrolRuns', kierrokset.map((k) => (k.id === auki.id ? tulos.kierros : k)));
  logAudit({ user: req.username, action: 'patrol_checkpoint', collection: 'patrolRuns', recordId: auki.id, eventId: auki.siteId });
  kerroKierroksesta(tulos.kierros, 'update');
  res.json({ ok: true, kierros: tulos.kierros, pisteNimi: piste.nimi });
});

app.post('/api/kierros/:id/piste', requireAuth, guardPortti, (req, res) => {
  const kierrokset = readCollection('patrolRuns') || [];
  const kierros = kierrokset.find((k) => k.id === req.params.id);
  if (!kierros) return res.status(404).json({ ok: false, error: 'Kierrosta ei löytynyt.' });
  if (!saaKiertaa(req, kierros.siteId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tähän kierrokseen.' });
  }
  // Kierros on henkilökohtainen: toisen vartijan kierrokseen ei kuitata pisteitä, koska
  // kuittaus on todiste siitä että JOKU oli paikalla — ja se joku on kierroksen tekijä.
  if (req.role !== 'admin' && kierros.vartija !== req.username) {
    return res.status(403).json({ ok: false, error: 'Kierros on toisen vartijan.' });
  }

  const pohja = (readCollection('templates') || []).find((p) => p.id === kierros.templateId);
  let pisteId = typeof req.body?.pisteId === 'string' ? req.body.pisteId : null;
  let tapa = 'kasin';
  if (!pisteId && typeof req.body?.token === 'string') {
    const osuma = etsiPisteTokenilla(pohja ? [pohja] : [], req.body.token);
    if (!osuma) {
      return res.status(404).json({ ok: false, error: 'QR-koodi ei kuulu tähän kierrokseen.' });
    }
    pisteId = osuma.piste.id;
    tapa = 'qr';
  }
  if (!pisteId) return res.status(400).json({ ok: false, error: 'Tarkistuspiste puuttuu.' });

  const tulos = kuittaaPiste({
    kierros,
    pisteId,
    tapa,
    gps: tarkistaGps(req.body?.gps),
    huomio: req.body?.huomio,
    pakotaSijainti: pohja?.sijaintiPakotus === true,
    sietorajaM: pohja?.sietorajaM ?? OLETUS_SIETORAJA_M,
    toisto: req.body?.toisto === true,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  if (tulos.duplikaatti) return res.json({ ok: true, kierros: tulos.kierros, duplikaatti: true });

  writeCollection('patrolRuns', kierrokset.map((k) => (k.id === kierros.id ? tulos.kierros : k)));
  logAudit({ user: req.username, action: 'patrol_checkpoint', collection: 'patrolRuns', recordId: kierros.id, eventId: kierros.siteId });
  kerroKierroksesta(tulos.kierros, 'update');
  res.json({ ok: true, kierros: tulos.kierros });
});

// Kierroksen päättäminen. Tässä on erän tärkein sääntö: valmis vaatii jokaisen pisteen,
// keskeytys vaatii syyn (ks. kierros.js).
app.post('/api/kierros/:id/paata', requireAuth, guardPortti, (req, res) => {
  const kierrokset = readCollection('patrolRuns') || [];
  const kierros = kierrokset.find((k) => k.id === req.params.id);
  if (!kierros) return res.status(404).json({ ok: false, error: 'Kierrosta ei löytynyt.' });
  if (!saaKiertaa(req, kierros.siteId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tähän kierrokseen.' });
  }
  if (req.role !== 'admin' && kierros.vartija !== req.username) {
    return res.status(403).json({ ok: false, error: 'Kierros on toisen vartijan.' });
  }

  const tulos = paataKierros({
    kierros,
    tila: req.body?.tila,
    syy: req.body?.syy,
    huomiot: req.body?.huomiot,
    toisto: req.body?.toisto === true,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  if (tulos.duplikaatti) return res.json({ ok: true, kierros: tulos.kierros, duplikaatti: true });

  writeCollection('patrolRuns', kierrokset.map((k) => (k.id === kierros.id ? tulos.kierros : k)));
  logAudit({
    user: req.username,
    action: tulos.kierros.tila === 'valmis' ? 'patrol_complete' : 'patrol_abort',
    collection: 'patrolRuns',
    recordId: kierros.id,
    eventId: kierros.siteId,
  });
  kerroKierroksesta(tulos.kierros, 'update');
  res.json({ ok: true, kierros: tulos.kierros });
});

// --- Hälytykset (erä 7) -----------------------------------------------------------
//
// Säännöt ovat halytys.js:ssä, tässä on niiden kytkentä: oikeudet, levylle kirjoitus,
// kanavaviesti ja tekstiviestieskalointi. Kaikki hälytysreitit ovat POST-reittejä eikä
// kokoelman PUT:ia käytetä lainkaan (PALVELIMEN_YLLAPITAMAT) — hälytys jonka selain voisi
// kirjoittaa olisi hälytys jonka selain voisi myös hiljaa poistaa.

// Hälytysreiteillä on oma rajoittimensa, ja se on tiukempi kuin muilla kirjoitusreiteillä:
// jokainen eskaloituva hälytys lähettää tekstiviestejä, eli kuluttaa saldoa. Rikkinäinen
// selain silmukassa ei saa tyhjentää tiliä. Raja on silti selvästi yli sen mitä yksi
// ihminen ehtii oikeasti painaa.
const halytysLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liian monta hälytystä lyhyessä ajassa. Jos kyseessä on hätätilanne, soita 112.' },
});

// Hälyttäminen vaatii LUKUoikeuden hälytyksiin — ei muokkausoikeutta. Ks. sivukartan
// perustelu (src/sivukartta.ts): muokkausoikeuden vaatiminen tarkoittaisi että osa
// kentällä olevista ei voisi hälyttää, ja se on juuri se joukko jonka takia toiminto on
// olemassa.
function saaHalyttaa(req, eventId) {
  if (req.role === 'admin') return true;
  if (!eventAllowed(req.eventAccess, eventId)) return false;
  return canView(req.permissions, eventId, 'alarms') || canView(req.permissions, eventId, 'guard_alarms');
}

// Kuittaaminen: oman hälytyksen saa kuitata aina, toisen vain muokkausoikeudella.
function saaKuitata(req, halytys) {
  if (req.role === 'admin') return true;
  if (halytys?.vartija === req.username) return true;
  if (!eventAllowed(req.eventAccess, halytys?.eventId)) return false;
  return canEdit(req.permissions, halytys?.eventId, 'alarms')
    || canEdit(req.permissions, halytys?.eventId, 'guard_alarms');
}

// Hälytys kuuluu joko tapahtumaan tai vartiointikohteeseen. Nimi ja vyöhykkeet haetaan
// samalla kysymyksellä molemmista, koska kutsuja ei tiedä kummasta on kyse — eikä sen
// tarvitse tietää.
// mapRef on mukana erästä 11 alkaen: natiivisovellus lähettää pelkän GPS:n, ja palvelin
// täydentää kuvakoordinaatin kalibroinnista (georeferointi.js). Sama kenttä kantaa
// kalibrointipisteet sekä tapahtumalla että GUARD-kohteella.
function kohteenTiedot(eventId) {
  const tapahtuma = (readCollection('events') || []).find((e) => e?.id === eventId);
  if (tapahtuma) {
    return {
      nimi: tapahtuma.name || '',
      vyohykkeet: Array.isArray(tapahtuma.zones) ? tapahtuma.zones : [],
      mapRef: Array.isArray(tapahtuma.mapRef) ? tapahtuma.mapRef : [],
    };
  }
  const kohde = (readCollection('guardSites') || []).find((s) => s?.id === eventId);
  if (kohde) {
    return {
      nimi: kohde.name || '',
      vyohykkeet: Array.isArray(kohde.zones) ? kohde.zones : [],
      mapRef: Array.isArray(kohde.mapRef) ? kohde.mapRef : [],
    };
  }
  return { nimi: '', vyohykkeet: [], mapRef: [] };
}

// Kanavaviesti hälytyksestä. Sama periaate kuin muualla: viesti kuljettaa vain id:n, ja
// sisältö haetaan oikeustarkistetulta reitiltä. `lahettaja`-ohitusta EI käytetä — myös
// hälyttäjän oma laite tarvitsee tiedon siitä että hänen hälytyksensä laukesi tai
// kuitattiin, koska sen jälkeen näkymän on muututtava.
function kerroHalytyksesta(halytys, action) {
  lahetaKanavalle('alerts', [{ action, id: halytys.id, eventId: halytys.eventId }], {
    saaNahda: (istunto, eventId) => {
      if (istunto?.role === 'admin') return true;
      if (!eventAllowed(istunto?.eventAccess, eventId)) return false;
      const perms = rolePermissions(istunto?.roleId);
      return canView(perms, eventId, 'alarms') || canView(perms, eventId, 'guard_alarms');
    },
  });
}

// guardKanavan muutoksesta ilmoittaminen (erä 26). Käytetään geneeristä 'muutos'-
// viestimuotoa (sama kuin muillakin kokoelmilla) mutta `lahetaViesti`:n kautta eikä
// `lahetaKanavalle`:n, koska jälkimmäisen `saaNahda(istunto, eventId)` ei sovi tähän:
// guardKanavat ei ole eventScoped, ja näkyvyys riippuu YKSITTÄISESTÄ tietueesta
// (osallistujuus tai hälyttäjyys) eikä pelkästä eventId:stä. Asiakas ei huomaa eroa —
// sanoma on ulospäin identtinen, `src/shared/kanava.ts`:n onMuutos käsittelee sen
// samalla tavalla kuin minkä tahansa muun kokoelman muutoksen.
function kerroKanavastaMuutos(action, kanava, naytKeneleKin) {
  lahetaViesti(
    { tyyppi: 'muutos', kokoelma: 'guardKanavat', muutokset: [{ action, id: kanava.id, eventId: null }] },
    { suodatin: (istunto) => istunto?.role === 'admin' || naytKeneleKin(istunto) },
  );
}

// Hälytyksen lähetystietue lähetyshistoriaan. Sama muoto kuin pikatoimintojen lähetyksillä,
// jotta BulkSMS:n webhook osaa liittää toimituskuittaukset oikeaan riviin (smswebhook.js) —
// hätäviestin kohdalla juuri toimitustieto on se mikä ratkaisee: lähtikö apu liikkeelle.
//
// Vastaanottajat sidotaan numeroihin JÄRJESTYKSESSÄ. Pikatoimintojen reitti tekee tässä
// tarkemman sovituksen, koska siellä numeroita voi olla tuhat; hälytyksen vastaanottajia on
// muutama, ja rajapinta palauttaa tulokset kuorman järjestyksessä.
function eskalointiLoki({ halytys, runko, vastaanottajat, uniikit, tulos }) {
  const haltija = new Map();
  for (const v of vastaanottajat) {
    if (v.numero && !haltija.has(v.numero)) haltija.set(v.numero, v);
  }
  return {
    id: `sms-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    ts: new Date().toISOString(),
    eventId: halytys.eventId,
    buttonId: `halytys:${halytys.tyyppi}`,
    label: `Hälytys: ${HALYTYSTYYPIT[halytys.tyyppi]?.label || halytys.tyyppi}`,
    group: 'emergency_numbers',
    user: halytys.vartija,
    body: runko,
    dryRun: tulos.dryRun,
    // Hälytysviestiin ei vastata tekstiviestillä vaan soittamalla. Vastauskanavan
    // avaaminen antaisi ymmärtää että vastausta luetaan jossain — sitä ei lueta.
    repliable: false,
    encoding: tulos.mitat?.encoding || null,
    parts: tulos.mitat?.osia ?? null,
    recipients: (tulos.tulokset || []).map((t, i) => {
      const numero = uniikit[i] || t.numero || null;
      const h = haltija.get(numero) || {};
      return {
        messageId: t.id === null || t.id === undefined ? null : String(t.id),
        nimi: h.nimi || null,
        rooli: h.rooli || null,
        numero: numero ? `${numero.slice(0, 5)}…${numero.slice(-3)}` : null,
        status: t.status,
        statusId: null,
        updatedAt: null,
      };
    }),
    skipped: vastaanottajat.filter((v) => !v.numero).map((v) => ({ nimi: v.nimi, syy: v.syy })),
  };
}

// Yhden hälytyksen eskalointi tekstiviestiksi. Palauttaa aina tuloksen eikä heitä:
// kutsuja merkitsee myös epäonnistumisen hälytykseen, jotta samaa viestiä ei yritetä
// lähettää uudelleen joka kierroksella.
/**
 * Herättää kohdennetut vartijat tarkistustehtävään.
 *
 * NIMETTY KOMENTO EIKÄ KOKOELMAMUUTOS, ja tämä on koko herätyksen ydin. Natiivisovellus
 * ohittaa tietokantamuutosilmoitukset tarkoituksella (Kanava.java: "Vain nimetty komento
 * tehdään") — muuten jokainen kirjaus kenen tahansa toimesta herättäisi jokaisen
 * puhelimen. Sovellus reagoi vain tähän viestiin, ja tämä viesti lähetetään vain silloin
 * kun joku on oikeasti hädässä.
 *
 * FCM:ÄÄ EI TARVITA. Kanava on auki koko vuoron ajan etualan palvelun sisällä
 * (VuoroService: Kanava.avaa), ja etualan palvelu on vapautettu Dozen
 * verkkorajoituksista. Viesti tulee perille myös sammuneelle näytölle, ja sovellus avaa
 * täysruutuaikeen — tai jos lupaa ei ole, huomioilmoituksen äänellä ja värinällä.
 *
 * KOHDENNUS ON TIUKEMPI KUIN KANAVAN NÄKYVYYS. kerroTehtavasta päästää läpi myös
 * päivystäjät ja pääkäyttäjät, koska heidän RUUTUNSA pitää päivittyä. Heitä ei saa
 * herättää täysruutuhälytyksellä: he katsovat valvomon näyttöä, eivät odota puhelimensa
 * heräävän. Tässä läpi menevät vain ne vartijat jotka tehtävä oikeasti koskee.
 *
 * HÄDÄSSÄ OLEVA EI HERÄTÄ ITSEÄÄN. Hän on jo tilanteessa, ja hänen puhelimensa on
 * todennäköisesti se joka ei vastaa. Täysruutuhälytys hänen omalle laitteelleen olisi
 * parhaimmillaankin hyödytön ja pahimmillaan häiriö kesken hätätilanteen.
 */
function herataTehtavasta(tehtava, kohde, { halyttaja = null, halyttajanSijainti = null } = {}) {
  const vuorot = readCollection('guardShifts') || [];
  return lahetaViesti(
    {
      tyyppi: 'halytystehtava',
      id: tehtava.id,
      // Nämä ovat se mitä vartija tarvitsee heti ruudulle: mistä on kyse ja missä.
      // Enempää ei lähetetä — tehtävän koko sisältö haetaan sovelluksessa normaalin
      // oikeustarkistuksen läpi, eikä kanavaviesti saa olla oikotie sen ohi.
      laji: tehtava.laji,
      kohde: tehtava.siteNimi || '',
      // OSOITE MUKAAN, koska vartija lukee tämän ruudulta ennen kuin avaa sovelluksen.
      // Kohteen nimi kertoo mistä on kyse, osoite kertoo minne ajetaan — ja yöllä
      // herätetty ihminen tarvitsee molemmat samalla silmäyksellä.
      osoite: kohde?.address || '',
      // Vain tarkistustehtävällä: kenen takia ollaan menossa ja missä hänet viimeksi
      // tiedettiin. Muissa lajeissa ei ole hälyttäjää vaan asiakkaan hälytinjärjestelmä
      // tai päivystäjän päätös.
      ...(halyttaja ? { vartija: findUser(halyttaja)?.nickname || halyttaja } : {}),
      ...(halyttajanSijainti
        ? { sijainti: `${halyttajanSijainti.lat.toFixed(5)}, ${halyttajanSijainti.lon.toFixed(5)}` }
        : {}),
    },
    {
      suodatin: (istunto) => {
        if (!istunto?.username) return false;
        if (!(istunto.tuotteet || []).includes('guard')) return false;
        // Hädässä oleva ei herätä itseään, ks. luoTarkistustehtava.
        if (halyttaja && istunto.username === halyttaja) return false;
        return nakeeTehtavan({
          tehtava,
          kohde,
          vartija: istunto.username,
          vuoro: keskenOlevaVuoro(vuorot, istunto.username) || null,
          sijainti: haeSijainti(istunto.username),
          sadeKm: kohde?.halytysSadeKm,
        }).nakee;
      },
    }
  );
}

/**
 * Luo tarkistustehtävän vartijan turvahälytyksestä (käyttäjän päätös 15.9.2026).
 *
 * panic, mandown ja ajastin tarkoittavat että vartijalle voi olla sattunut jotain, ja
 * silloin joku menee katsomaan. Siitä syntyy tavallinen hälytystehtävä: sama kohdennus,
 * sama vastaanotto, sama poistumislupa ja sama tapahtumailmoitus — ja sitä kautta sama
 * LYTP:n säilytysaika jonka perusteella näiden lajien sijaintia säilytetään.
 *
 * VYÖHYKEPOIKKEAMA JA VARUSTEPOIKKEAMA EIVÄT LUO TEHTÄVÄÄ. Vyöhykepoikkeama on
 * työnjohdollinen havainto eikä ihmisen hätä; varustepoikkeama tarkoittaa että joku tuo
 * toimivan varusteen, mikä on eri työ eikä tarkistus.
 *
 * KOHTEETON HÄLYTYS EI TUOTA TEHTÄVÄÄ, ja se on tiedossa oleva puute. Hälytystehtävä on
 * rakenteeltaan kohteen tehtävä (siteId on sen oikeusavain ja kohdennuksen perusta),
 * eikä piirivuorossa ilman aktiivista kohdetta painettu hätäpainike voi tuottaa
 * sellaista. Näissä tapauksissa eskalointi jää tekstiviestin varaan — mikä on juuri se
 * syy miksi viestiä ei poisteta.
 */
function luoTarkistustehtava(halytys) {
  if (!TARKISTUSTA_VAATIVAT.has(halytys?.tyyppi)) return;
  try {
    if (!halytys.eventId) {
      logAudit({
        user: halytys.vartija, action: 'tarkistustehtava_ei_kohdetta',
        collection: 'guardDispatch', recordId: halytys.id, alarmType: halytys.tyyppi,
      });
      return;
    }
    const kohde = (readCollection('guardSites') || []).find((k) => k?.id === halytys.eventId);
    if (!kohde) return;

    const nimi = findUser(halytys.vartija)?.nickname || halytys.vartija;
    const tulos = luoTehtava({
      laji: 'tarkistus',
      kohde,
      luoja: null,
      id: uusiId(),
      havaintoId: () => uusiId(),
      havainnot: [
        // Havainto kertoo vastaanottajalle sen mitä hän tarvitsee heti: kuka, mikä
        // hälytys ja missä hänet viimeksi tiedettiin. Sijainti on tavallisesti ainoa
        // vihje siitä mistä ihmistä lähdetään etsimään.
        `${HALYTYSTYYPIT[halytys.tyyppi]?.label || halytys.tyyppi}: ${nimi}.`
        + (halytys.gps
          ? ` Viimeksi tiedetty sijainti ${halytys.gps.lat.toFixed(5)}, ${halytys.gps.lon.toFixed(5)}.`
          : ' Sijaintia ei ole tiedossa.'),
      ],
    });
    if (!tulos.ok) return;

    const tehtavat = readCollection('guardDispatch') || [];
    writeCollection('guardDispatch', [tulos.tehtava, ...tehtavat]);
    logAudit({
      user: halytys.vartija, action: 'tarkistustehtava_luotu',
      collection: 'guardDispatch', recordId: tulos.tehtava.id,
      eventId: halytys.eventId, alarmType: halytys.tyyppi, halytysId: halytys.id,
    });
    kerroTehtavasta(tulos.tehtava);

    // Herätys ERIKSEEN kanavailmoituksen jälkeen: edellinen päivittää auki olevat ruudut,
    // tämä herättää puhelimet. Laitemäärä kirjataan, koska "kukaan ei herännyt" on eri
    // tieto kuin "herätys lähetettiin" — ja jälkikäteen kysytään juuri sitä.
    const heratetty = herataTehtavasta(tulos.tehtava, kohde, {
      halyttaja: halytys.vartija,
      // Viimeksi tiedetty sijainti mukaan ruudulle. Se on tavallisesti ainoa vihje siitä
      // mistä ihmistä lähdetään etsimään, ja sen on oltava luettavissa ilman että
      // sovellusta avataan.
      halyttajanSijainti: halytys.gps || null,
    });
    logAudit({
      user: halytys.vartija, action: 'tarkistustehtava_heratys',
      collection: 'guardDispatch', recordId: tulos.tehtava.id,
      eventId: halytys.eventId, laitteita: heratetty,
    });
  } catch (err) {
    // Tarkistustehtävän luonti ei saa kaataa eskalointia: tekstiviesti on se kanava joka
    // tavoittaa sammuneen puhelimen, ja se on tärkeämpi kuin tämä.
    console.error('Tarkistustehtävän luonti epäonnistui:', err.message);
  }
}

async function eskaloiHalytys(halytys) {
  try {
    const { kohteenNimi, vastaanottajat, lahde } = halytysVastaanottajat({
      eventId: halytys.eventId,
      events: readCollection('events') || [],
      guardSites: readCollection('guardSites') || [],
    });
    const uniikit = [...new Set(vastaanottajat.map((v) => v.numero).filter(Boolean))];
    if (uniikit.length === 0) {
      return {
        ok: false,
        vastaanottajia: 0,
        virhe: lahde
          ? 'Yhtään kelvollista hälytysnumeroa ei löytynyt.'
          : 'Hälytysnumeroita ei ole määritetty tälle kohteelle.',
      };
    }

    const runko = viestiTeksti(halytys, { kohteenNimi });
    const tulos = await lahetaViestit({
      numerot: uniikit,
      body: runko,
      repliable: false,
      // Deduplikointi hälytyksen id:llä: jos sama hälytys yritetään eskaloida kahdesti
      // (palvelin käynnistyi uudelleen kesken lähetyksen), BulkSMS ei lähetä viestiä
      // toiseen kertaan.
      dedupId: Math.abs(hashDedup(`halytys|${halytys.id}`)),
    });
    if (!tulos.ok) return { ok: false, vastaanottajia: 0, virhe: tulos.virhe };

    const tietue = eskalointiLoki({ halytys, runko, vastaanottajat, uniikit, tulos });
    try {
      writeCollection('smsLog', [tietue, ...(readCollection('smsLog') || [])]);
    } catch (err) {
      // Historian kirjoitus ei saa kaataa eskalointia: viestit ovat jo lähteneet.
      console.error('Hälytyksen lähetyshistorian kirjoitus epäonnistui:', err.message);
    }
    return { ok: true, dryRun: tulos.dryRun, sendId: tietue.id, vastaanottajia: uniikit.length };
  } catch (err) {
    return { ok: false, vastaanottajia: 0, virhe: err.message };
  }
}

// Palvelimen hälytyskierros: erääntyneet ajastimet laukeavat ja lauenneet eskaloituvat.
//
// TÄMÄ ON KOKO ERÄN YDIN. Ajastin ei ole selaimessa, koska tajuton vartija ei paina
// mitään eikä sammunut puhelin aja ajastimia. Kymmenen sekunnin kierros on tarkkuus jolla
// määräaika toteutuu: minuutin tarkkuus riittäisi ajastimeen mutta ei eskalointiviiveisiin.
const HALYTYSKIERROS_MS = 10_000;
let halytyskierrosKay = false;

async function kasitteleHalytykset() {
  // Päällekkäisiä kierroksia ei ajeta: eskalointi odottaa verkkokutsua, ja kaksi
  // rinnakkaista kierrosta lähettäisi saman hälytyksen kahdesti.
  if (halytyskierrosKay) return;
  halytyskierrosKay = true;
  try {
    const nyt = Date.now();
    let lista = readCollection('alerts') || [];

    const kypsat = eraantyneet(lista, nyt);
    if (kypsat.length > 0) {
      const idt = new Set(kypsat.map((h) => h.id));
      const lauenneet = [];
      lista = lista.map((h) => {
        if (!idt.has(h.id)) return h;
        // Viimeksi tiedetty sijainti liitetään hälytykseen jos sellainen on. Se on
        // tavallisesti ainoa vihje siitä mistä ihmistä lähdetään etsimään.
        const tulos = laukaiseHalytys({ halytys: h, gps: haeSijainti(h.vartija)?.gps || null, nyt });
        if (!tulos.ok) return h;
        lauenneet.push(tulos.halytys);
        return tulos.halytys;
      });
      writeCollection('alerts', lista);
      for (const h of lauenneet) {
        logAudit({
          user: h.vartija, action: 'alarm_fired', collection: 'alerts',
          recordId: h.id, eventId: h.eventId, alarmType: h.tyyppi,
        });
        kerroHalytyksesta(h, 'update');
      }
    }

    for (const h of eskaloitavat(lista, nyt)) {
      // TARKISTUSTEHTÄVÄ TOISILLE VARTIJOILLE (käyttäjän päätös 15.9.2026).
      //
      // Luodaan ENNEN viestin lähetystä: tehtävän luonti on paikallinen eikä voi jäädä
      // odottamaan verkkoa, ja eskaloinnin hidas kohta on ulkoinen HTTP-kutsu.
      //
      // RINNALLE EIKÄ TILALLE, ja tämä on turvallisuuspäätös eikä varovaisuutta.
      // Tekstiviesti tavoittaa sammuneen ja taskussa olevan puhelimen; hälytystehtävä
      // ilmestyy vain sen ruudulle jolla sovellus on auki, koska taustaherätystä ei ole
      // vielä olemassa (ks. asennus/NATIIVI.md: push-kanava). Jos viesti korvattaisiin
      // tehtävällä nyt, hätäpainikkeen tavoittavuus olisi sovelluksen aukiolon varassa.
      //
      // Kun push-kanava herättää puhelimen, viestin poistaminen on oma harkintansa —
      // huomaa silti että viesti menee kohteen HÄLYTYSNUMEROIHIN (asiakas, päivystys) ja
      // tehtävä VARTIJOILLE. Ne eivät ole samat vastaanottajat, eikä toinen korvaa
      // toista pelkästään siksi että molemmat "ilmoittavat".
      luoTarkistustehtava(h);

      const tulos = await eskaloiHalytys(h);
      // Kokoelma luetaan UUDELLEEN lähetyksen jälkeen: odotuksen aikana hälytys on voitu
      // kuitata tai uusia on voinut syntyä, eikä vanhaan kopioon kirjoittaminen saa
      // hukata niitä.
      const tuore = readCollection('alerts') || [];
      let paivitetty = null;
      writeCollection('alerts', tuore.map((x) => {
        if (x.id !== h.id) return x;
        paivitetty = merkitseEskaloitu({ halytys: x, tulos, nyt: Date.now() });
        return paivitetty;
      }));
      logAudit({
        user: h.vartija,
        action: tulos.ok ? 'alarm_escalated' : 'alarm_escalation_failed',
        collection: 'alerts', recordId: h.id, eventId: h.eventId, alarmType: h.tyyppi,
        recipients: tulos.vastaanottajia,
        ...(tulos.ok ? {} : { reason: tulos.virhe }),
      });
      if (paivitetty) kerroHalytyksesta(paivitetty, 'update');
    }
  } catch (err) {
    console.error('Hälytyskierros epäonnistui:', err.message);
  } finally {
    halytyskierrosKay = false;
  }
}

// Ajastimen käynnistys (lone worker). Vartija kertoo mitä on tekemässä ja kuinka kauan se
// saa kestää; jos kuittausta ei tule, hälytys laukeaa itsestään.
app.post('/api/halytys/ajastin', requireAuth, halytysLimiter, (req, res) => {
  const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId : null;
  if (!saaHalyttaa(req, eventId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta hälytyksiin tässä kohteessa.' });
  }

  const lista = readCollection('alerts') || [];
  // Yksi käynnissä oleva ajastin kerrallaan. Kaksi rinnakkaista tarkoittaisi, ettei
  // "olen kunnossa" -kuittauksesta tiedä kumpaa se koskee.
  const auki = lista.find((h) => h.tyyppi === 'ajastin' && h.tila === 'kaynnissa' && h.vartija === req.username);
  if (auki) {
    return res.status(409).json({ ok: false, error: 'Sinulla on jo käynnissä oleva ajastin.', halytys: auki });
  }

  const tulos = luoAjastin({
    id: crypto.randomUUID(),
    vartija: req.username,
    eventId,
    minuutit: req.body?.minuutit,
    kuvaus: req.body?.kuvaus,
    gps: req.body?.gps,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('alerts', [tulos.halytys, ...lista]);
  logAudit({
    user: req.username, action: 'alarm_timer_start', collection: 'alerts',
    recordId: tulos.halytys.id, eventId, minutes: tulos.halytys.kestoMin,
  });
  kerroHalytyksesta(tulos.halytys, 'create');

  // Kerrotaan heti onko kohteelle määritetty hälytysnumeroita. Vartijan on tiedettävä
  // ENNEN kuin hän luottaa ajastimeen, tavoittaako lauennut hälytys ketään.
  const { vastaanottajat } = halytysVastaanottajat({
    eventId,
    events: readCollection('events') || [],
    guardSites: readCollection('guardSites') || [],
  });
  res.json({
    ok: true,
    halytys: tulos.halytys,
    eskalointiNumeroita: vastaanottajat.filter((v) => v.numero).length,
  });
});

// Hätäpainike ja man-down. Molemmat syntyvät suoraan lauenneina, ja ero on vain siinä
// kuka ne laukaisi: ihminen vai laite.
app.post('/api/halytys', requireAuth, halytysLimiter, (req, res) => {
  const tyyppi = req.body?.tyyppi;
  if (tyyppi !== 'panic' && tyyppi !== 'mandown') {
    return res.status(400).json({ ok: false, error: 'Tuntematon hälytystyyppi.' });
  }
  const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId : null;
  if (!saaHalyttaa(req, eventId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta hälytyksiin tässä kohteessa.' });
  }

  const lista = readCollection('alerts') || [];
  // Saman hälytyksen toistopainallus (verkko takkusi, käyttäjä painoi uudestaan) ei saa
  // synnyttää toista hälytystä eikä toista tekstiviestiä. Palautetaan jo olemassa oleva.
  const auki = lista.find((h) => h.tyyppi === tyyppi && h.tila === 'lauennut' && h.vartija === req.username);
  if (auki) return res.json({ ok: true, halytys: auki, jokoOlemassa: true });

  const tulos = luoHalytys({
    id: crypto.randomUUID(),
    tyyppi,
    vartija: req.username,
    eventId,
    kuvaus: req.body?.kuvaus,
    gps: req.body?.gps,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('alerts', [tulos.halytys, ...lista]);
  logAudit({
    user: req.username, action: 'alarm_raised', collection: 'alerts',
    recordId: tulos.halytys.id, eventId, alarmType: tyyppi,
  });
  kerroHalytyksesta(tulos.halytys, 'create');

  // Hätäkanava (erä 26, vaihe 1d): VAIN GUARD-puolen hälytyksille — alerts on molempien
  // puolien yhteinen kokoelma (eventId on tapahtuman TAI kohteen id), eikä PTT ole
  // EVENT-puolen ominaisuus. Tarkistetaan siis onko eventId nimenomaan guardSites-kohde,
  // ei oleteta req.tuotteet-listasta joka kertoo käyttäjän oikeudesta eikä hälytyksen
  // puolesta.
  if ((readCollection('guardSites') || []).some((k) => k?.id === eventId)) {
    const kanavat = readCollection('guardKanavat') || [];
    const hataKanava = luoHataKanava({ halytysId: tulos.halytys.id, vartija: req.username, halytysTyyppi: tyyppi });
    writeCollection('guardKanavat', [...kanavat, hataKanava]);
    logAudit({
      user: 'jarjestelma', action: 'ptt_hatakanava_luotu', collection: 'guardKanavat',
      recordId: hataKanava.id, eventId,
    });
    // Hälyttäjälle itselleen EI tarvitse ilmoittaa erikseen (hän tietää jo, hän juuri
    // laukaisi hälytyksen) — vain HÄLKE:lle, joka ei vielä tiedä kanavasta.
    kerroKanavastaMuutos('create', hataKanava, (istunto) => (
      istunto?.role === 'admin' || canView(rolePermissions(istunto?.roleId), null, 'guard_dispatch')
    ));
  }

  // Eskalointi tehdään hälytyskierroksella eikä tässä: vastaus ei saa odottaa ulkoista
  // HTTP-kutsua BulkSMS:ään. Hätäpainikkeen viive on nolla, joten viesti lähtee
  // seuraavalla kierroksella eli enintään kymmenen sekunnin kuluttua.
  res.json({ ok: true, halytys: tulos.halytys });
});

// "Olen kunnossa": ajastin alkaa alusta. Vain oma ajastin — toisen puolesta kuittaaminen
// tarkoittaisi, että kuittaus ei enää todista kenenkään olevan kunnossa.
app.post('/api/halytys/:id/jatka', requireAuth, (req, res) => {
  const lista = readCollection('alerts') || [];
  const halytys = lista.find((h) => h.id === req.params.id);
  if (!halytys) return res.status(404).json({ ok: false, error: 'Hälytystä ei löytynyt.' });
  if (halytys.vartija !== req.username) {
    return res.status(403).json({ ok: false, error: 'Ajastin on toisen käyttäjän.' });
  }

  const tulos = jatkaHalytysta({ halytys, minuutit: req.body?.minuutit, user: req.username });
  if (!tulos.ok) return res.status(409).json({ ok: false, error: tulos.error, halytys });

  writeCollection('alerts', lista.map((h) => (h.id === halytys.id ? tulos.halytys : h)));
  kerroHalytyksesta(tulos.halytys, 'update');
  res.json({ ok: true, halytys: tulos.halytys });
});

// Ajastimen lopetus: vuoro päättyi eikä valvontaa enää tarvita.
app.post('/api/halytys/:id/peru', requireAuth, (req, res) => {
  const lista = readCollection('alerts') || [];
  const halytys = lista.find((h) => h.id === req.params.id);
  if (!halytys) return res.status(404).json({ ok: false, error: 'Hälytystä ei löytynyt.' });
  if (halytys.vartija !== req.username && req.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Ajastin on toisen käyttäjän.' });
  }

  const tulos = peruHalytys({ halytys, user: req.username });
  if (!tulos.ok) return res.status(409).json({ ok: false, error: tulos.error, halytys });

  writeCollection('alerts', lista.map((h) => (h.id === halytys.id ? tulos.halytys : h)));
  logAudit({
    user: req.username, action: 'alarm_timer_cancel', collection: 'alerts',
    recordId: halytys.id, eventId: halytys.eventId,
  });
  kerroHalytyksesta(tulos.halytys, 'update');
  res.json({ ok: true, halytys: tulos.halytys });
});

// Lauenneen hälytyksen kuittaus. Tämä on se toimenpide joka päättää hälytyksen — ei
// tekstiviestin lähtö eikä se että joku katsoi näkymää.
app.post('/api/halytys/:id/kuittaa', requireAuth, (req, res) => {
  const lista = readCollection('alerts') || [];
  const halytys = lista.find((h) => h.id === req.params.id);
  if (!halytys) return res.status(404).json({ ok: false, error: 'Hälytystä ei löytynyt.' });
  if (!saaKuitata(req, halytys)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta kuitata tätä hälytystä.' });
  }

  const tulos = kuittaaHalytys({ halytys, user: req.username, huomio: req.body?.huomio });
  if (!tulos.ok) return res.status(409).json({ ok: false, error: tulos.error, halytys });

  writeCollection('alerts', lista.map((h) => (h.id === halytys.id ? tulos.halytys : h)));
  logAudit({
    user: req.username, action: 'alarm_acknowledged', collection: 'alerts',
    recordId: halytys.id, eventId: halytys.eventId, alarmType: halytys.tyyppi,
  });
  kerroHalytyksesta(tulos.halytys, 'update');

  // Hätäkanavan purku (erä 26, vaihe 1d): elinkaari on sidottu HÄLYTYKSEN ratkaisuun,
  // ei vuoron loppumiseen (ks. server/kanavat.js: hataKanavaPurkautunut). Poistetaan
  // suoraan tässä eikä erillisellä ajastimella, koska kuittaus on ainoa tapa jolla
  // panic/mandown-hälytys voi ylipäätään siirtyä pois avoimesta tilasta.
  const kanavatNyt = readCollection('guardKanavat') || [];
  const hataId = hataKanavaId(halytys.id);
  const hataKanava = kanavatNyt.find((k) => k.id === hataId);
  if (hataKanava && hataKanavaPurkautunut(hataKanava, tulos.halytys)) {
    writeCollection('guardKanavat', kanavatNyt.filter((k) => k.id !== hataId));
    logAudit({
      user: req.username, action: 'ptt_hatakanava_paattyi', collection: 'guardKanavat', recordId: hataId,
    });
    kerroKanavastaMuutos('delete', hataKanava, (istunto) => (
      istunto?.role === 'admin'
      || istunto?.username === hataKanava.vartija
      || canView(rolePermissions(istunto?.roleId), null, 'guard_dispatch')
    ));
  }
  res.json({ ok: true, halytys: tulos.halytys });
});

// Lähimmät kentällä olijat annettuun pisteeseen. Tämä oli alun perin tehtävien
// ohjaamista varten ("kuka on lähinnä porttia 3"), ja hälytys on sen tärkein käyttötapaus:
// kun joku painaa hätäpainiketta, ensimmäinen kysymys on kuka ehtii paikalle.
//
// Vaatii sijaintiseurannan. Ilman sitä palvelin ei tiedä kenenkään sijaintia, eikä
// arvausta pidä esittää vastauksena — `kaytossa: false` kertoo käyttöliittymälle että
// toimintoa ei ole, jolloin se ei lupaa sitä.
app.get('/api/lahin', requireAuth, (req, res) => {
  if (!seurantaKaytossa()) return res.json({ ok: true, kaytossa: false, vartijat: [] });
  const eventId = typeof req.query.eventId === 'string' ? req.query.eventId : null;
  // Sama kaksitasoinen portti kuin /api/sijainnit — ja tässä kohteeton kutsu on vielä
  // selvemmin pääkäyttötapaus kuin siellä: "kuka on lähinnä tätä osoitetta" kysytään
  // hälytystehtävää jaettaessa, ja vastaus saa tulla mistä tahansa kohteesta tai
  // piirivuorosta. Kohdekohtainen rajaus jättäisi lähimmän yksikön pois juuri silloin
  // kun se on toisen kohteen pihassa.
  const sallittu = eventId ? saaNahdaSijaintilistan(req, eventId) : saaNahdaSijainteja(req);
  if (!sallittu) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta henkilöstön sijainteihin.' });
  }

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ ok: false, error: 'Anna lat ja lon.' });
  }

  const vartijat = sijainnit({ eventId })
    .filter((s) => saaNahdaSijaintirivin(req, s))
    .map((s) => ({
      username: s.username,
      ikaMs: s.ikaMs,
      gps: s.gps,
      etaisyysM: etaisyysMetreina({ lat, lon }, s.gps),
    }))
    // Ilman GPS:ää ei voi laskea etäisyyttä. Kuvakoordinaatti ei kelpaa: pohjakuvan
    // mittakaava ei ole metrejä, eikä "0,3 kuvan leveydestä" ole vastaus kysymykseen
    // kuka ehtii nopeimmin.
    .filter((v) => v.etaisyysM !== null)
    .sort((a, b) => a.etaisyysM - b.etaisyysM)
    .slice(0, 10);

  // JOKAINEN HAKU KIRJATAAN, ei jaksoittain kuten listahaussa. Ero on tarkoituksellinen:
  // tätä ei pollata vaan se tehdään nimenomaisesti, ja kysyjä antaa koordinaatin jota
  // vasten haetaan. Se on kohdennettu kysely henkilöstön sijainneista — juuri se laji
  // jota työntekijä haluaisi tarkastella jälkikäteen, ja niitä on vuorossa yksittäisiä.
  if (vartijat.length > 0) {
    logAudit({
      user: req.username,
      action: 'sijainti_lahin',
      collection: 'sijainnit',
      eventId,
      // Piste jota vasten haettiin: ilman sitä rivistä ei näe miksi haku tehtiin.
      piste: { lat, lon },
      kohteet: vartijat.map((v) => v.username),
    });
  }

  res.json({ ok: true, kaytossa: true, vartijat });
});
// --- Tiedotteet (erä 8) -----------------------------------------------------------
//
// Sovelluksen sisäinen viesti kentälle, jonka lukeminen kuitataan. Eri asia kuin
// pikatoimintojen hätäviesti: tekstiviesti tavoittaa myös sammuneen sovelluksen mutta ei
// kerro kuka sen luki, tiedote kertoo. Molempia tarvitaan, eikä kumpikaan korvaa toista.

const tiedotteenSolmu = (tiedote) => (tiedote?.omistaja === 'kohde' ? 'guard_broadcast' : 'broadcast');

function saaLahettaaTiedotteen(req, ownerId, onKohde) {
  if (req.role === 'admin') return true;
  if (!tuoteOk(req, onKohde)) return false;
  return eventAllowed(req.eventAccess, ownerId)
    && canEdit(req.permissions, ownerId, onKohde ? 'guard_broadcast' : 'broadcast');
}

function saaLukeaTiedotteen(req, tiedote) {
  if (req.role === 'admin') return true;
  if (!tuoteOk(req, tiedote?.omistaja === 'kohde')) return false;
  return eventAllowed(req.eventAccess, tiedote?.ownerId)
    && canView(req.permissions, tiedote?.ownerId, tiedotteenSolmu(tiedote));
}

// Ketkä tiedotteen pitäisi kuitata. Joukko lasketaan OIKEUKSISTA eikä erillisestä
// jakelulistasta: lista vanhenisi heti, ja kaksi totuutta siitä kenelle viesti kuuluu
// olisi pahempi kuin yksi.
//
// Pääkäyttäjät jätetään pois. He näkevät kaiken oikeuksiensa puolesta, mutta he eivät ole
// se joukko jonka kuittausta tiedotteella odotetaan — mukana he näkyisivät ikuisesti
// kuittaamattomina ja tekisivät listasta hyödyttömän.
function tiedotteenVastaanottajat(tiedote) {
  const onKohde = tiedote?.omistaja === 'kohde';
  const solmu = tiedotteenSolmu(tiedote);
  return listUsers()
    .filter((u) => u.role !== 'admin')
    .filter((u) => paaseeTuotteisiin(u).includes(onKohde ? 'guard' : 'event'))
    .filter((u) => eventAllowed(u.eventAccess, tiedote.ownerId)
      && canView(rolePermissions(u.roleId), tiedote.ownerId, solmu))
    .map((u) => ({ username: u.username, nimi: u.nickname || u.username }));
}

function kerroTiedotteesta(tiedote, action) {
  lahetaKanavalle('broadcasts', [{ action, id: tiedote.id, eventId: tiedote.ownerId }], {
    saaNahda: (istunto, ownerId) => {
      if (istunto?.role === 'admin') return true;
      if (!eventAllowed(istunto?.eventAccess, ownerId)) return false;
      return canView(rolePermissions(istunto?.roleId), ownerId, tiedotteenSolmu(tiedote));
    },
  });
}

app.post('/api/tiedote', requireAuth, (req, res) => {
  const ownerId = typeof req.body?.ownerId === 'string' ? req.body.ownerId : '';
  const omistaja = omistajanTiedot(ownerId);
  if (!omistaja) return res.status(404).json({ ok: false, error: 'Kohdetta tai tapahtumaa ei löytynyt.' });
  if (!saaLahettaaTiedotteen(req, ownerId, omistaja.onKohde)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta lähettää tiedotteita.' });
  }

  const tulos = luoTiedote({
    id: crypto.randomUUID(),
    ownerId,
    omistaja: omistaja.onKohde ? 'kohde' : 'tapahtuma',
    otsikko: req.body?.otsikko,
    viesti: req.body?.viesti,
    laatija: req.username,
    voimassaTuntia: req.body?.voimassaTuntia,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('broadcasts', [tulos.tiedote, ...(readCollection('broadcasts') || [])]);
  logAudit({
    user: req.username, action: 'broadcast_send', collection: 'broadcasts',
    recordId: tulos.tiedote.id, eventId: ownerId,
    recipients: tiedotteenVastaanottajat(tulos.tiedote).length,
  });
  kerroTiedotteesta(tulos.tiedote, 'create');
  res.json({ ok: true, tiedote: tulos.tiedote, vastaanottajia: tiedotteenVastaanottajat(tulos.tiedote).length });
});

app.post('/api/tiedote/:id/kuittaa', requireAuth, (req, res) => {
  const tiedotteet = readCollection('broadcasts') || [];
  const tiedote = tiedotteet.find((t) => t.id === req.params.id);
  if (!tiedote) return res.status(404).json({ ok: false, error: 'Tiedotetta ei löytynyt.' });
  if (!saaLukeaTiedotteen(req, tiedote)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tähän tiedotteeseen.' });
  }

  const tulos = kuittaaTiedote({ tiedote, username: req.username });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
  // Toinen kuittaus samalta käyttäjältä ei muuta mitään: levylle ei kirjoiteta eikä
  // kanavalle kerrota, mutta vastaus on ok.
  if (tulos.duplikaatti) return res.json({ ok: true, tiedote: tulos.tiedote, duplikaatti: true });

  writeCollection('broadcasts', tiedotteet.map((t) => (t.id === tiedote.id ? tulos.tiedote : t)));
  kerroTiedotteesta(tulos.tiedote, 'update');
  res.json({ ok: true, tiedote: tulos.tiedote });
});

app.post('/api/tiedote/:id/peru', requireAuth, (req, res) => {
  const tiedotteet = readCollection('broadcasts') || [];
  const tiedote = tiedotteet.find((t) => t.id === req.params.id);
  if (!tiedote) return res.status(404).json({ ok: false, error: 'Tiedotetta ei löytynyt.' });
  if (!saaLahettaaTiedotteen(req, tiedote.ownerId, tiedote.omistaja === 'kohde')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta perua tätä tiedotetta.' });
  }

  const tulos = peruTiedote({ tiedote, username: req.username });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('broadcasts', tiedotteet.map((t) => (t.id === tiedote.id ? tulos.tiedote : t)));
  logAudit({ user: req.username, action: 'broadcast_cancel', collection: 'broadcasts', recordId: tiedote.id, eventId: tiedote.ownerId });
  kerroTiedotteesta(tulos.tiedote, 'update');
  res.json({ ok: true, tiedote: tulos.tiedote });
});

// Ketkä eivät ole kuitanneet. Erillinen reitti eikä osa listahakua: joukko lasketaan
// käyttäjärekisteristä, eikä sitä pidä laskea jokaiselle tiedotteelle jokaisessa haussa.
app.get('/api/tiedote/:id/kuittaamatta', requireAuth, (req, res) => {
  const tiedote = (readCollection('broadcasts') || []).find((t) => t.id === req.params.id);
  if (!tiedote) return res.status(404).json({ ok: false, error: 'Tiedotetta ei löytynyt.' });
  if (!saaLahettaaTiedotteen(req, tiedote.ownerId, tiedote.omistaja === 'kohde')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tiedotteen kuittaustietoihin.' });
  }
  const vastaanottajat = tiedotteenVastaanottajat(tiedote);
  res.json({
    ok: true,
    voimassa: onVoimassa(tiedote),
    vastaanottajia: vastaanottajat.length,
    kuittaamatta: kuittaamatta(tiedote, vastaanottajat),
  });
});


// --- Avainhallinta ja varustepoikkeamat (erä 8) ------------------------------------
//
// Molemmat ovat rekistereitä eivätkä pohjia: avaimella ja varusteella on TILA jota
// muutetaan, kun taas pohjasta tehdään suorituksia. Säännöt ovat avaimet.js:ssä ja
// varusteet.js:ssä.

// HUOM (erä 20): 'guard_keys' ei ole enää GUARDin sivukartassa — kohteen avaimet ovat
// kalustopankissa lajina 'avain' (kalusto.js). Kartoitus jätetään tähän, koska se on
// yhä oikea vastaus kysymykseen "mikä solmu tätä riviä suojaa": kohteen avaintietueita
// ei enää synny, ja jos niitä jostain on, ne jäävät pääkäyttäjän nähtäviksi eivätkä
// aukea vahingossa jollekin muulle solmulle. EVENT-puolen 'keys' on ennallaan.
const kalustonSolmu = (tietue, laji) => {
  const kohde = tietue?.omistaja === 'kohde';
  if (laji === 'avain') return kohde ? 'guard_keys' : 'keys';
  return kohde ? 'guard_equipment' : 'equipment';
};

// Avainrekisterin muutokset vaativat muokkausoikeuden — myös luovutus ja palautus.
// Luovutusmerkintä on se mikä kertoo kuka pääsee sisään, eikä sitä pidä voida kirjata
// pelkällä katseluoikeudella.
function saaMuokataKalustoa(req, ownerId, onKohde, laji) {
  if (req.role === 'admin') return true;
  if (!tuoteOk(req, onKohde)) return false;
  return eventAllowed(req.eventAccess, ownerId)
    && canEdit(req.permissions, ownerId, kalustonSolmu({ omistaja: onKohde ? 'kohde' : 'tapahtuma' }, laji));
}

function saaNahdaKalustoa(req, ownerId, onKohde, laji) {
  if (req.role === 'admin') return true;
  if (!tuoteOk(req, onKohde)) return false;
  return eventAllowed(req.eventAccess, ownerId)
    && canView(req.permissions, ownerId, kalustonSolmu({ omistaja: onKohde ? 'kohde' : 'tapahtuma' }, laji));
}

function kerroKalustosta(kokoelma, tietue, laji, action) {
  lahetaKanavalle(kokoelma, [{ action, id: tietue.id, eventId: tietue.ownerId }], {
    saaNahda: (istunto, ownerId) => {
      if (istunto?.role === 'admin') return true;
      if (!eventAllowed(istunto?.eventAccess, ownerId)) return false;
      return canView(rolePermissions(istunto?.roleId), ownerId, kalustonSolmu(tietue, laji));
    },
  });
}

app.post('/api/avain', requireAuth, (req, res) => {
  const ownerId = typeof req.body?.ownerId === 'string' ? req.body.ownerId : '';
  const omistaja = omistajanTiedot(ownerId);
  if (!omistaja) return res.status(404).json({ ok: false, error: 'Kohdetta tai tapahtumaa ei löytynyt.' });
  if (!saaMuokataKalustoa(req, ownerId, omistaja.onKohde, 'avain')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta avainrekisteriin.' });
  }

  const tulos = luoAvain({
    id: crypto.randomUUID(),
    ownerId,
    omistaja: omistaja.onKohde ? 'kohde' : 'tapahtuma',
    tunnus: req.body?.tunnus,
    kuvaus: req.body?.kuvaus,
    user: req.username,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('keys', [tulos.avain, ...(readCollection('keys') || [])]);
  logAudit({ user: req.username, action: 'key_create', collection: 'keys', recordId: tulos.avain.id, eventId: ownerId });
  kerroKalustosta('keys', tulos.avain, 'avain', 'create');
  res.json({ ok: true, avain: tulos.avain });
});

// Avaimen tilamuutokset yhdellä reitillä: toiminto tulee polusta, ja jokainen niistä on
// sama kirjoitus samaan tietueeseen. Erilliset reitit toistaisivat saman haun,
// oikeustarkistuksen ja kirjoituksen viisi kertaa.
const AVAIMEN_TOIMINNOT = {
  luovuta: { fn: luovuta, action: 'key_handover' },
  palauta: { fn: palauta, action: 'key_return' },
  kadonnut: { fn: merkitseKadonneeksi, action: 'key_lost' },
  loytyi: { fn: merkitseLoytyneeksi, action: 'key_found' },
  poista: { fn: poistaKaytosta, action: 'key_retire' },
};

app.post('/api/avain/:id/:toiminto', requireAuth, (req, res) => {
  const toiminto = AVAIMEN_TOIMINNOT[req.params.toiminto];
  if (!toiminto) return res.status(404).json({ ok: false, error: 'Tuntematon toiminto.' });

  const avaimet = readCollection('keys') || [];
  const avain = avaimet.find((a) => a.id === req.params.id);
  if (!avain) return res.status(404).json({ ok: false, error: 'Avainta ei löytynyt.' });
  if (!saaMuokataKalustoa(req, avain.ownerId, avain.omistaja === 'kohde', 'avain')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta avainrekisteriin.' });
  }

  const tulos = toiminto.fn({
    avain,
    user: req.username,
    haltija: req.body?.haltija,
    huomio: req.body?.huomio,
    syy: req.body?.syy,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('keys', avaimet.map((a) => (a.id === avain.id ? tulos.avain : a)));
  logAudit({
    user: req.username, action: toiminto.action, collection: 'keys',
    recordId: avain.id, eventId: avain.ownerId,
  });
  kerroKalustosta('keys', tulos.avain, 'avain', 'update');
  res.json({ ok: true, avain: tulos.avain });
});

// Varustepoikkeaman ILMOITTAMINEN riittää lukuoikeudella: sen huomaa se joka käyttää
// varustetta, ja jos ilmoittaminen vaatisi muokkausoikeuden, rikkinäisestä radiosta
// kerrottaisiin radiolla. Poikkeaman SULKEMINEN vaatii muokkausoikeuden — se on väite
// siitä että asia on kunnossa.
app.post('/api/varuste', requireAuth, (req, res) => {
  const ownerId = typeof req.body?.ownerId === 'string' ? req.body.ownerId : '';
  const omistaja = omistajanTiedot(ownerId);
  if (!omistaja) return res.status(404).json({ ok: false, error: 'Kohdetta tai tapahtumaa ei löytynyt.' });
  if (!saaNahdaKalustoa(req, ownerId, omistaja.onKohde, 'varuste')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta varustepoikkeamiin.' });
  }

  const tulos = luoPoikkeama({
    id: crypto.randomUUID(),
    ownerId,
    omistaja: omistaja.onKohde ? 'kohde' : 'tapahtuma',
    varuste: req.body?.varuste,
    kuvaus: req.body?.kuvaus,
    vakavuus: req.body?.vakavuus,
    ilmoittaja: req.username,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  let poikkeama = tulos.poikkeama;

  // Kriittinen poikkeama eskaloituu erän 7 hälytysketjua pitkin: valvomoon heti,
  // tekstiviestinä viiveen jälkeen. Toinen rinnakkainen ilmoituskanava tarkoittaisi kahta
  // paikkaa joita pitää seurata.
  if (eskaloituu(poikkeama)) {
    const halytys = luoHalytys({
      id: crypto.randomUUID(),
      tyyppi: 'varuste',
      vartija: req.username,
      eventId: ownerId,
      kuvaus: `${halytyksenKuvaus(poikkeama)} - ${poikkeama.kuvaus}`,
    });
    if (halytys.ok) {
      poikkeama = { ...poikkeama, halytysId: halytys.halytys.id };
      writeCollection('alerts', [halytys.halytys, ...(readCollection('alerts') || [])]);
      logAudit({
        user: req.username, action: 'alarm_raised', collection: 'alerts',
        recordId: halytys.halytys.id, eventId: ownerId, alarmType: 'varuste',
      });
      kerroHalytyksesta(halytys.halytys, 'create');
    }
  }

  writeCollection('equipmentIssues', [poikkeama, ...(readCollection('equipmentIssues') || [])]);
  logAudit({
    user: req.username, action: 'equipment_issue', collection: 'equipmentIssues',
    recordId: poikkeama.id, eventId: ownerId, severity: poikkeama.vakavuus,
  });
  kerroKalustosta('equipmentIssues', poikkeama, 'varuste', 'create');
  res.json({ ok: true, poikkeama });
});

app.post('/api/varuste/:id/kasittele', requireAuth, (req, res) => {
  const poikkeamat = readCollection('equipmentIssues') || [];
  const poikkeama = poikkeamat.find((p) => p.id === req.params.id);
  if (!poikkeama) return res.status(404).json({ ok: false, error: 'Poikkeamaa ei löytynyt.' });
  if (!saaMuokataKalustoa(req, poikkeama.ownerId, poikkeama.omistaja === 'kohde', 'varuste')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta käsitellä varustepoikkeamia.' });
  }

  const tulos = kasittelePoikkeama({
    poikkeama,
    tila: req.body?.tila,
    user: req.username,
    huomio: req.body?.huomio,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('equipmentIssues', poikkeamat.map((p) => (p.id === poikkeama.id ? tulos.poikkeama : p)));
  logAudit({
    user: req.username, action: 'equipment_resolved', collection: 'equipmentIssues',
    recordId: poikkeama.id, eventId: poikkeama.ownerId,
  });
  kerroKalustosta('equipmentIssues', tulos.poikkeama, 'varuste', 'update');
  res.json({ ok: true, poikkeama: tulos.poikkeama });
});


// --- Kalustopankki (erä 20) -------------------------------------------------------
//
// Säännöt ovat kalusto.js:ssä. Täällä on se osa jota ei voi testata ilman palvelinta:
// kuka saa tehdä mitäkin, ja mihin kohteeseen kalustoa saa pyytää.
//
// OIKEUSJAKO ON KOKO OMINAISUUDEN YDIN. `guard_assets`-lukuoikeus = näet pankin ja voit
// PYYTÄÄ; muokkausoikeus = jyvität ja RATKAISET pyynnöt. Sama jako kuin
// varustepoikkeamalla yllä, ja samasta syystä: havainnon puutteesta saa tehdä se joka
// sen huomaa, mutta päätöksen yrityksen omaisuudesta ei.
//
// Solmu on globaali (permissions.js: GLOBAL_NODES), joten oikeus luetaan aina
// __default__-ämpäristä — siksi eventId on näissä tarkistuksissa null eikä kohteen id.

const saaNahdaPankin = (req) =>
  req.role === 'admin' || (tuoteOk(req, true) && canView(req.permissions, null, 'guard_assets'));

const saaHallitaPankkia = (req) =>
  req.role === 'admin' || (tuoteOk(req, true) && canEdit(req.permissions, null, 'guard_assets'));

// Kanavaviesti kalustomuutoksesta. Kuljettaa vain id:n; sisältö haetaan
// oikeustarkistetulta listahaulta, kuten muissakin kokoelmissa.
function kerroKalustopankista(esine, action) {
  lahetaKanavalle('assets', [{ action, id: esine.id, eventId: null }], {
    // Myös vartija (guard_site_assets) herätetään. Viesti kuljettaa vain id:n, ja sisältö
    // haetaan oikeustarkistetulta listahaulta joka rajaa rivit hänen vuoronsa kohteeseen —
    // joten tästä ei vuoda mitään. Vaihtoehto olisi jättää vartija herättämättä, mutta
    // silloin kesken vuoron jyvitetty avain ei ilmestyisi hänen listalleen lainkaan, ja
    // vanhentunut avainrekisteri on pahempi kuin turha haku.
    saaNahda: (istunto) => {
      if (istunto?.role === 'admin') return true;
      const oikeudet = rolePermissions(istunto?.roleId);
      return canView(oikeudet, null, 'guard_assets') || canView(oikeudet, null, 'guard_site_assets');
    },
  });
}

const haeEsine = (id) => {
  const pankki = readCollection('assets') || [];
  return { pankki, esine: pankki.find((e) => e.id === id) || null };
};

// Yhden tietueen kirjoitus takaisin pankkiin. Koko kokoelma kirjoitetaan aina uudelleen
// (ks. store.js), joten tämä on se kohta jossa muut rivit säilyvät koskemattomina.
const tallennaEsine = (pankki, esine) =>
  writeCollection('assets', pankki.map((e) => (e.id === esine.id ? esine : e)));

app.post('/api/kalusto', requireAuth, guardPortti, (req, res) => {
  if (!saaHallitaPankkia(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta kalustopankin ylläpitoon.' });
  }

  const laji = typeof req.body?.laji === 'string' ? req.body.laji : '';
  const kappaletta = Math.trunc(Number(req.body?.kappaletta ?? 1));
  if (!Number.isFinite(kappaletta) || kappaletta < 1 || kappaletta > kalusto.KAPPALEITA_MAX) {
    return res.status(400).json({
      ok: false,
      error: `Kappalemäärän on oltava 1–${kalusto.KAPPALEITA_MAX}.`,
    });
  }

  // Sijoituskohde on tarkistettava olemassa olevaksi: rekisteri joka osoittaa kohteeseen
  // jota ei ole, ei kerro missä esine on.
  const sijoitus = req.body?.sijoitus || { laji: kalusto.oletusSailo(laji) };
  if (sijoitus.laji === 'kohde') {
    const omistaja = omistajanTiedot(sijoitus.id);
    if (!omistaja?.onKohde) return res.status(404).json({ ok: false, error: 'Kohdetta ei löytynyt.' });
    sijoitus.nimi = omistaja.nimi;
  }

  const pankki = readCollection('assets') || [];
  // Numerointi lasketaan KERRAN ja kasvatetaan silmukassa. Jos jokainen kappale kysyisi
  // numeronsa erikseen samasta muuttumattomasta listasta, koko erä saisi saman tunnuksen.
  const numero = kalusto.seuraavaNumero(pankki, laji);
  // Sama koskee holvipaikkaa: avaimet saavat peräkkäiset koukut.
  const holviPaikka = kalusto.seuraavaHolviPaikka(pankki);

  const uudet = [];
  for (let i = 0; i < kappaletta; i += 1) {
    const tulos = kalusto.luoKalusto({
      id: crypto.randomUUID(),
      laji,
      alalaji: req.body?.alalaji,
      nimi: req.body?.nimi,
      kuvaus: req.body?.kuvaus,
      // Sarjanumero on esinekohtainen, joten erässä se voi olla vain ensimmäisellä.
      // Loput jäävät tyhjiksi ja täydennetään kortista — sama sarjanumero kymmenellä
      // esineellä olisi väärää tietoa, ei puuttuvaa.
      sarjanumero: kappaletta === 1 ? req.body?.sarjanumero : '',
      lisatiedot: req.body?.lisatiedot,
      sijoitus,
      numero: numero + i,
      holviPaikka: laji === 'avain' ? holviPaikka + i : null,
      user: req.username,
    });
    if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });
    uudet.push(tulos.esine);
  }

  writeCollection('assets', [...uudet, ...pankki]);
  for (const esine of uudet) {
    logAudit({ user: req.username, action: 'asset_create', collection: 'assets', recordId: esine.id });
    kerroKalustopankista(esine, 'create');
  }
  res.json({ ok: true, esineet: uudet });
});

// Avainerä taulukkosyötöstä (erä 20d).
//
// ERILLINEN REITTI eikä POST /api/kalusto kappalemäärällä, ja ero on olennainen:
// kappalemäärä luo N SAMANLAISTA tietuetta, tämä luo N ERILAISTA. Avaimet tulevat
// toimeksiantajalta erissä joissa jokaisella on oma tyyppinsä, sarjanumeronsa ja
// sopimusviitteensä — yksi lomake kerrallaan olisi kymmeniä lomakkeita.
//
// Kaikki rivit tai ei mitään: jos yksikin rivi on virheellinen, mitään ei kirjoiteta.
// Osittain onnistunut erä jättäisi käyttäjän selvittämään mitkä rivit menivät läpi, ja
// hän syöttäisi loput uudelleen — jolloin osa avaimista olisi pankissa kahdesti.
app.post('/api/kalusto/era', requireAuth, guardPortti, (req, res) => {
  if (!saaHallitaPankkia(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta kalustopankin ylläpitoon.' });
  }
  // Laji tulee pyynnöstä: sama taulukkosyöttö palvelee kaikkia lajeja, ja sarakkeet
  // ratkeavat lajista. Tuntematon laji torjutaan tässä eikä luoKalustossa, jotta
  // virhe kertoo lajista eikä ensimmäisestä rivistä.
  const laji = req.body?.laji || 'avain';
  if (!kalusto.LAJIT[laji]) {
    return res.status(400).json({ ok: false, error: 'Tuntematon kalustolaji.' });
  }
  const rivit = Array.isArray(req.body?.rivit) ? req.body.rivit : null;
  if (!rivit || rivit.length === 0) {
    return res.status(400).json({ ok: false, error: 'Erässä ei ole yhtään riviä.' });
  }
  if (rivit.length > kalusto.KAPPALEITA_MAX) {
    return res.status(400).json({
      ok: false,
      error: `Erässä voi olla enintään ${kalusto.KAPPALEITA_MAX} riviä.`,
    });
  }

  const pankki = readCollection('assets') || [];
  const numero = kalusto.seuraavaNumero(pankki, laji);
  // Holvipaikka varataan VAIN avaimille: se on avaimen paikka hyllyssä, eikä takilla
  // tai puhelimella ole sellaista. Muu laji saisi numeron jota mikään ei vastaa.
  const onAvain = laji === 'avain';
  const holviPaikka = onAvain ? kalusto.seuraavaHolviPaikka(pankki) : null;

  const uudet = [];
  for (let i = 0; i < rivit.length; i += 1) {
    const rivi = rivit[i] || {};
    const tulos = kalusto.luoKalusto({
      id: crypto.randomUUID(),
      laji,
      alalaji: rivi.alalaji,
      nimi: rivi.nimi,
      kuvaus: rivi.kuvaus,
      sarjanumero: rivi.sarjanumero,
      // Lisätiedot sellaisenaan: luoKalusto puhdistaa ne lajin sallittujen kenttien
      // mukaan (puhdistaLisatiedot), joten selain ei voi kirjoittaa vieraita kenttiä.
      lisatiedot: rivi.lisatiedot || {},
      // Erä syntyy aina lajinsa omaan säilöön — avaimet holviin, muu kalusto
      // varusvarastoon: esine kirjataan vastaanotetuksi ennen kuin se jyvitetään
      // mihinkään. Rivinumero virheeseen, jotta käyttäjä löytää sen taulukosta
      // ilman arvailua.
      sijoitus: { laji: kalusto.oletusSailo(laji) },
      numero: numero + i,
      holviPaikka: onAvain ? holviPaikka + i : null,
      user: req.username,
    });
    if (!tulos.ok) {
      return res.status(400).json({ ok: false, error: `Rivi ${i + 1}: ${tulos.error}`, rivi: i });
    }
    uudet.push(tulos.esine);
  }

  writeCollection('assets', [...uudet, ...pankki]);
  for (const esine of uudet) {
    logAudit({ user: req.username, action: 'asset_create', collection: 'assets', recordId: esine.id });
    kerroKalustopankista(esine, 'create');
  }
  res.json({ ok: true, esineet: uudet });
});

app.put('/api/kalusto/:id', requireAuth, guardPortti, (req, res) => {
  if (!saaHallitaPankkia(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta kalustopankin ylläpitoon.' });
  }
  const { pankki, esine } = haeEsine(req.params.id);
  if (!esine) return res.status(404).json({ ok: false, error: 'Esinettä ei löytynyt.' });

  const tulos = kalusto.paivitaTiedot({ esine, muutokset: req.body, user: req.username });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  tallennaEsine(pankki, tulos.esine);
  logAudit({ user: req.username, action: 'asset_update', collection: 'assets', recordId: esine.id });
  kerroKalustopankista(tulos.esine, 'update');
  res.json({ ok: true, esine: tulos.esine });
});

// Jyvitys. Pääkäyttäjän toiminto — vuoroesimies pyytää, ei siirrä.
app.post('/api/kalusto/:id/siirto', requireAuth, guardPortti, (req, res) => {
  if (!saaHallitaPankkia(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta jyvittää kalustoa. Tee pyyntö pääkäyttäjälle.' });
  }
  const { pankki, esine } = haeEsine(req.params.id);
  if (!esine) return res.status(404).json({ ok: false, error: 'Esinettä ei löytynyt.' });

  const sijoitus = { ...(req.body?.sijoitus || {}) };
  if (sijoitus.laji === 'kohde') {
    const omistaja = omistajanTiedot(sijoitus.id);
    if (!omistaja?.onKohde) return res.status(404).json({ ok: false, error: 'Kohdetta ei löytynyt.' });
    sijoitus.nimi = omistaja.nimi;
  }
  // Nimi haetaan palvelimen puolelta myös henkilölle ja ajoneuvolle: luovutustositteessa
  // lukeva nimi ei saa olla selaimen lähettämää vapaata tekstiä.
  if (sijoitus.laji === 'henkilo') {
    const tyontekija = (readCollection('employees') || []).find((t) => t.id === sijoitus.id);
    if (!tyontekija) return res.status(404).json({ ok: false, error: 'Työntekijää ei löytynyt.' });
    sijoitus.nimi = tyontekija.name || '';
  }
  if (sijoitus.laji === 'ajoneuvo' || sijoitus.laji === 'avainkaappi') {
    const kantaja = pankki.find((e) => e.id === sijoitus.id);
    if (!kantaja) return res.status(404).json({ ok: false, error: 'Ajoneuvoa tai avainkaappia ei löytynyt.' });
    sijoitus.nimi = `${kantaja.nimi} (${kantaja.tunnus})`;
  }

  const tulos = kalusto.siirra({ esine, sijoitus, user: req.username, huomio: req.body?.huomio });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  tallennaEsine(pankki, tulos.esine);
  logAudit({
    user: req.username, action: 'asset_transfer', collection: 'assets', recordId: esine.id,
    eventId: tulos.esine.sijoitusLaji === 'kohde' ? tulos.esine.sijoitusId : null,
  });
  kerroKalustopankista(tulos.esine, 'update');
  res.json({ ok: true, esine: tulos.esine });
});

// Pyyntö. LUKUOIKEUS RIITTÄÄ — vuoroesimies näkee pankin ja kertoo mitä kohteessa
// tarvitaan. Kohde on rajattava käyttäjän omiin: pyyntö kohteeseen jossa ei työskentele
// olisi tapa saada selville mitä muissa kohteissa on.
app.post('/api/kalusto/:id/pyynto', requireAuth, guardPortti, (req, res) => {
  if (!saaNahdaPankin(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta kalustopankkiin.' });
  }
  const { pankki, esine } = haeEsine(req.params.id);
  if (!esine) return res.status(404).json({ ok: false, error: 'Esinettä ei löytynyt.' });

  const kohdeId = typeof req.body?.kohdeId === 'string' ? req.body.kohdeId : '';
  const omistaja = omistajanTiedot(kohdeId);
  if (!omistaja?.onKohde) return res.status(404).json({ ok: false, error: 'Kohdetta ei löytynyt.' });
  if (req.role !== 'admin' && !eventAllowed(req.eventAccess, kohdeId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tähän kohteeseen.' });
  }

  const tulos = kalusto.pyydaKalustoa({
    esine,
    id: crypto.randomUUID(),
    pyytaja: req.username,
    kohde: { id: kohdeId, nimi: omistaja.nimi },
    perustelu: req.body?.perustelu,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  tallennaEsine(pankki, tulos.esine);
  logAudit({
    user: req.username, action: 'asset_request', collection: 'assets',
    recordId: esine.id, eventId: kohdeId,
  });
  kerroKalustopankista(tulos.esine, 'update');
  res.json({ ok: true, esine: tulos.esine });
});

// Pyynnön ratkaisu tai peruminen.
//
// PERUMINEN ON PYYTÄJÄN OMA OIKEUS, ratkaisu ei. Vuoroesimies joka huomaa pyytäneensä
// väärää esinettä ei saa joutua odottamaan pääkäyttäjää saadakseen sen pois listalta —
// mutta hän ei myöskään saa hyväksyä omaa pyyntöään, mikä on koko hyväksyntäketjun syy.
app.post('/api/kalusto/:id/pyynto/ratkaise', requireAuth, guardPortti, (req, res) => {
  const { pankki, esine } = haeEsine(req.params.id);
  if (!esine) return res.status(404).json({ ok: false, error: 'Esinettä ei löytynyt.' });

  const peru = req.body?.toiminto === 'peru';
  if (peru) {
    const omaPyynto = esine.pyynto && esine.pyynto.pyytaja === req.username;
    if (!omaPyynto && !saaHallitaPankkia(req)) {
      return res.status(403).json({ ok: false, error: 'Vain pyytäjä tai pääkäyttäjä voi perua pyynnön.' });
    }
  } else if (!saaHallitaPankkia(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta ratkaista kalustopyyntöjä.' });
  }

  const tulos = peru
    ? kalusto.peruPyynto({ esine, user: req.username })
    : kalusto.ratkaisePyynto({
      esine,
      hyvaksy: req.body?.hyvaksy === true,
      user: req.username,
      perustelu: req.body?.perustelu,
    });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  tallennaEsine(pankki, tulos.esine);
  logAudit({
    user: req.username,
    action: peru ? 'asset_request_cancel' : (req.body?.hyvaksy === true ? 'asset_request_approve' : 'asset_request_reject'),
    collection: 'assets', recordId: esine.id, eventId: esine.pyynto?.kohdeId || null,
  });
  kerroKalustopankista(tulos.esine, 'update');
  res.json({ ok: true, esine: tulos.esine });
});

// Tilamuutokset yhdellä reitillä: toiminto tulee rungosta, ja jokainen niistä on sama
// kirjoitus samaan tietueeseen. Sama ratkaisu kuin avaimen toiminnoilla yllä.
const KALUSTON_TILAT = {
  kadonnut: { fn: (a) => kalusto.merkitseKadonneeksi(a), action: 'asset_lost' },
  huoltoon: { fn: (a) => kalusto.merkitseHuoltoon(a), action: 'asset_service' },
  kayttoon: { fn: (a) => kalusto.palautaKayttoon(a), action: 'asset_restore' },
  poista: { fn: (a) => kalusto.poistaKaytosta(a), action: 'asset_retire' },
};

app.post('/api/kalusto/:id/tila', requireAuth, guardPortti, (req, res) => {
  const toiminto = KALUSTON_TILAT[req.body?.toiminto];
  if (!toiminto) return res.status(400).json({ ok: false, error: 'Tuntematon toiminto.' });
  if (!saaHallitaPankkia(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta muuttaa kaluston tilaa.' });
  }
  const { pankki, esine } = haeEsine(req.params.id);
  if (!esine) return res.status(404).json({ ok: false, error: 'Esinettä ei löytynyt.' });

  const tulos = toiminto.fn({
    esine, user: req.username, syy: req.body?.syy, huomio: req.body?.huomio,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  tallennaEsine(pankki, tulos.esine);
  logAudit({ user: req.username, action: toiminto.action, collection: 'assets', recordId: esine.id });
  kerroKalustopankista(tulos.esine, 'update');
  res.json({ ok: true, esine: tulos.esine });
});


// --- Avaintyyppikartta ------------------------------------------------------------
//
// Luettelo avainmalleista tunnistuskuvineen. Kuva lähetetään ensin tavallisena liitteenä
// (POST /api/uploads) ja sen id liitetään tähän — ei omaa tiedostoreittiä, koska
// olemassa oleva liitepolku hoitaa jo tyyppitarkistuksen, kokorajan ja roskienkeruun.
//
// Lukeminen tapahtuu GET /api/data/keyTypes -reitillä oikeuksien mukaan
// (permissions.js: keyTypes). Täällä on vain kirjoitus, ja se vaatii pankin
// ylläpito-oikeuden: kartta on yrityksen yhteinen luettelo, ja jokainen sen rivi
// näkyy kaikille avaimia kirjaaville.

const haeAvaintyyppi = (id) => {
  const kartta = readCollection('keyTypes') || [];
  return { kartta, tyyppi: kartta.find((t) => t?.id === id) || null };
};

app.post('/api/avaintyypit', requireAuth, guardPortti, (req, res) => {
  if (!saaHallitaPankkia(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta avaintyyppikartan ylläpitoon.' });
  }
  // Kuvan on oltava jo levyllä. Ilman tarkistusta karttaan syntyisi rivi joka viittaa
  // olemattomaan tiedostoon, ja se näkyisi rikkinäisenä kuvana jokaiselle kirjaajalle.
  if (!getUploadPath(req.body?.uploadId)) {
    return res.status(400).json({ ok: false, error: 'Tunnistuskuvaa ei löytynyt. Lähetä kuva uudelleen.' });
  }
  const kartta = readCollection('keyTypes') || [];
  const tulos = kalusto.luoAvaintyyppi({
    id: crypto.randomUUID(),
    nimi: req.body?.nimi,
    kuvaus: req.body?.kuvaus,
    uploadId: req.body.uploadId,
    kartta,
    user: req.username,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('keyTypes', [...kartta, tulos.tyyppi]);
  logAudit({ user: req.username, action: 'keytype_create', collection: 'keyTypes', recordId: tulos.tyyppi.id });
  res.json({ ok: true, tyyppi: tulos.tyyppi });
});

app.put('/api/avaintyypit/:id', requireAuth, guardPortti, (req, res) => {
  if (!saaHallitaPankkia(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta avaintyyppikartan ylläpitoon.' });
  }
  const { kartta, tyyppi } = haeAvaintyyppi(req.params.id);
  if (!tyyppi) return res.status(404).json({ ok: false, error: 'Avaintyyppiä ei löytynyt.' });
  if (req.body?.uploadId && !getUploadPath(req.body.uploadId)) {
    return res.status(400).json({ ok: false, error: 'Tunnistuskuvaa ei löytynyt. Lähetä kuva uudelleen.' });
  }

  const tulos = kalusto.paivitaAvaintyyppi({ tyyppi, muutokset: req.body, kartta });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('keyTypes', kartta.map((t) => (t.id === tyyppi.id ? tulos.tyyppi : t)));
  logAudit({ user: req.username, action: 'keytype_update', collection: 'keyTypes', recordId: tyyppi.id });
  res.json({ ok: true, tyyppi: tulos.tyyppi });
});

// Poisto ei kajoa avaimiin. Avaimen `avaintyyppi` on tekstiä eikä viittaus, joten
// kartasta poistettu malli ei tyhjennä yhtään kirjausta — kartta on tunnistusapu, ei
// pakotettu luettelo. Kuvatiedosto jää roskienkeruun hoidettavaksi (UPLOAD_VIITTAAJAT).
app.delete('/api/avaintyypit/:id', requireAuth, guardPortti, (req, res) => {
  if (!saaHallitaPankkia(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta avaintyyppikartan ylläpitoon.' });
  }
  const { kartta, tyyppi } = haeAvaintyyppi(req.params.id);
  if (!tyyppi) return res.status(404).json({ ok: false, error: 'Avaintyyppiä ei löytynyt.' });

  writeCollection('keyTypes', kartta.filter((t) => t.id !== tyyppi.id));
  logAudit({ user: req.username, action: 'keytype_delete', collection: 'keyTypes', recordId: tyyppi.id });
  res.json({ ok: true });
});

// --- Analytiikka ja jälkiraportit (erä 9, perusta P8) -----------------------------
//
// Laskusäännöt ovat analytiikka.js:ssä ja jalkiraportti.js:ssä. Täällä on se osa jota ei
// voi testata ilman palvelinta: mistä luvut lasketaan ja KENELLE.
//
// AGGREGAATTI EI SAA KERTOA ENEMPÄÄ KUIN RIVI. Jokainen lähdekokoelma ajetaan
// readableDatan läpi ennen laskentaa, aivan kuten se ajettaisiin listahaussa. Ilman tätä
// mittaristo olisi tapa lukea sitä dataa jota rivikohtainen oikeus estää: "vyöhykkeellä
// kolme ensiaputehtävää" on kertomus eikä pelkkä luku.

const analytiikanSolmu = (onKohde) => (onKohde ? 'guard_analytics' : 'analytics');
const jalkiraportinSolmu = (onKohde) => (onKohde ? 'guard_debrief' : 'debrief');

// Kokoelman käyttäjälle näkyvät rivit, rajattuna yhteen omistajaan. Suodatus tehdään
// nimenomaan samalla funktiolla jota GET /api/data käyttää — kaksi eri suodatinta samalle
// aineistolle olisi kaksi eri käsitystä siitä kuka saa nähdä mitä.
function nakyvatRivit(req, kokoelma, ownerId, ownerIdOf) {
  const tulos = readableData(req.role, req.permissions, req.eventAccess, kokoelma, readCollection(kokoelma));
  if (!tulos.ok) return [];
  return (tulos.data || []).filter((rivi) => ownerIdOf(rivi) === ownerId);
}

// Lähdeaineisto koosteelle. Kirjaukset tulevat eri kokoelmasta puolen mukaan, ja
// kierrokset ovat vain GUARD-puolella — tapahtumapuolen kierrosraportti on kirjaus
// (typeId 'patrol') eikä kierrossuoritus.
function koosteenLahteet(req, ownerId, onKohde) {
  const kirjaukset = onKohde
    ? nakyvatRivit(req, 'guardReports', ownerId, (r) => r.siteId)
    : nakyvatRivit(req, 'reports', ownerId, (r) => r.eventId || 'fesx');
  const kierrokset = onKohde ? nakyvatRivit(req, 'patrolRuns', ownerId, (r) => r.siteId) : [];
  const halytykset = nakyvatRivit(req, 'alerts', ownerId, (r) => r.eventId);
  const omistaja = onKohde
    ? (readCollection('guardSites') || []).find((k) => k.id === ownerId)
    : (readCollection('events') || []).find((e) => e.id === ownerId);
  return { kirjaukset, kierrokset, halytykset, vyohykkeet: omistaja?.zones || [] };
}

// Yhteinen alkutarkistus: omistaja on olemassa, puoli on käytössä ja solmuun on oikeus.
// Palauttaa joko { virhe } tai { omistaja }.
function analytiikanPortti(req, ownerId, solmuFn, edellytaMuokkaus = false) {
  const omistaja = omistajanTiedot(ownerId);
  if (!omistaja) return { virhe: { tila: 404, teksti: 'Kohdetta tai tapahtumaa ei löytynyt.' } };
  if (req.role !== 'admin') {
    if (!tuoteOk(req, omistaja.onKohde)) return { virhe: { tila: 403, teksti: 'Ei oikeutta tähän puoleen.' } };
    if (!eventAllowed(req.eventAccess, ownerId)) return { virhe: { tila: 403, teksti: 'Ei oikeutta tähän kohteeseen.' } };
    const solmu = solmuFn(omistaja.onKohde);
    const ok = edellytaMuokkaus
      ? canEdit(req.permissions, ownerId, solmu)
      : canView(req.permissions, ownerId, solmu);
    if (!ok) return { virhe: { tila: 403, teksti: 'Ei oikeutta.' } };
  }
  return { omistaja };
}

app.get('/api/analytiikka', requireAuth, (req, res) => {
  const ownerId = typeof req.query.ownerId === 'string' ? req.query.ownerId : '';
  const portti = analytiikanPortti(req, ownerId, analytiikanSolmu);
  if (portti.virhe) return res.status(portti.virhe.tila).json({ ok: false, error: portti.virhe.teksti });

  // Ikkunaton haku on sallittu (koko historia), mutta nurinkurinen ei: alku loppua
  // myöhemmin tuottaisi tyhjän koosteen joka näyttäisi rauhalliselta jaksolta.
  const ikkuna = req.query.alku || req.query.loppu
    ? teeIkkuna({ alku: req.query.alku, loppu: req.query.loppu })
    : null;
  if ((req.query.alku || req.query.loppu) && !ikkuna) {
    return res.status(400).json({ ok: false, error: 'Aikaväli on virheellinen.' });
  }

  const lahteet = koosteenLahteet(req, ownerId, portti.omistaja.onKohde);
  res.json({
    ok: true,
    nimi: portti.omistaja.nimi,
    onKohde: portti.omistaja.onKohde,
    kooste: laskeKooste({ ...lahteet, ikkuna }),
  });
});

function kerroJalkiraportista(raportti, action) {
  lahetaKanavalle('debriefs', [{ action, id: raportti.id, eventId: raportti.ownerId }], {
    saaNahda: (istunto, ownerId) => {
      if (istunto?.role === 'admin') return true;
      if (!eventAllowed(istunto?.eventAccess, ownerId)) return false;
      return canView(rolePermissions(istunto?.roleId), ownerId, jalkiraportinSolmu(raportti.omistaja === 'kohde'));
    },
  });
}

// Jälkiraportin luonti laskee luvut ja JÄÄDYTTÄÄ ne tietueeseen. Tämä on toiminnon ydin:
// jos raportti laskisi lukunsa joka avauksella, sama dokumentti näyttäisi ensi kuussa eri
// luvut — kirjauksia suljetaan jälkikäteen ja säilytysajan päättyessä poistetaan.
app.post('/api/jalkiraportti', requireAuth, (req, res) => {
  const ownerId = typeof req.body?.ownerId === 'string' ? req.body.ownerId : '';
  const portti = analytiikanPortti(req, ownerId, jalkiraportinSolmu, true);
  if (portti.virhe) return res.status(portti.virhe.tila).json({ ok: false, error: portti.virhe.teksti });

  const ikkuna = req.body?.alku || req.body?.loppu
    ? teeIkkuna({ alku: req.body.alku, loppu: req.body.loppu })
    : null;
  if ((req.body?.alku || req.body?.loppu) && !ikkuna) {
    return res.status(400).json({ ok: false, error: 'Aikaväli on virheellinen.' });
  }

  const lahteet = koosteenLahteet(req, ownerId, portti.omistaja.onKohde);
  const tulos = luoJalkiraportti({
    id: crypto.randomUUID(),
    ownerId,
    omistaja: portti.omistaja.onKohde ? 'kohde' : 'tapahtuma',
    nimi: req.body?.nimi,
    ikkuna: ikkuna || { alku: null, loppu: null },
    kooste: laskeKooste({ ...lahteet, ikkuna }),
    user: req.username,
  });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('debriefs', [tulos.raportti, ...(readCollection('debriefs') || [])]);
  logAudit({
    user: req.username, action: 'debrief_create', collection: 'debriefs',
    recordId: tulos.raportti.id, eventId: ownerId,
  });
  kerroJalkiraportista(tulos.raportti, 'create');
  res.json({ ok: true, raportti: tulos.raportti });
});

// Jälkiraportin muutokset yhdellä reitillä: toiminto tulee polusta. Kaikki kolme ovat
// sama haku, sama oikeustarkistus ja sama kirjoitus samaan tietueeseen.
const JALKIRAPORTIN_TOIMINNOT = {
  tallenna: {
    action: 'debrief_update',
    fn: ({ raportti, req }) => paivitaJalkiraportti({ raportti, muutokset: req.body, user: req.username }),
  },
  valmis: {
    action: 'debrief_complete',
    fn: ({ raportti, req }) => merkitseValmiiksi({ raportti, user: req.username }),
  },
  avaa: {
    action: 'debrief_reopen',
    fn: ({ raportti, req }) => avaaUudelleen({ raportti, user: req.username, syy: req.body?.syy }),
  },
};

app.post('/api/jalkiraportti/:id/:toiminto', requireAuth, (req, res) => {
  const toiminto = JALKIRAPORTIN_TOIMINNOT[req.params.toiminto];
  if (!toiminto) return res.status(404).json({ ok: false, error: 'Tuntematon toiminto.' });

  const raportit = readCollection('debriefs') || [];
  const raportti = raportit.find((r) => r.id === req.params.id);
  if (!raportti) return res.status(404).json({ ok: false, error: 'Jälkiraporttia ei löytynyt.' });

  const portti = analytiikanPortti(req, raportti.ownerId, jalkiraportinSolmu, true);
  if (portti.virhe) return res.status(portti.virhe.tila).json({ ok: false, error: portti.virhe.teksti });

  const tulos = toiminto.fn({ raportti, req });
  if (!tulos.ok) return res.status(400).json({ ok: false, error: tulos.error });

  writeCollection('debriefs', raportit.map((r) => (r.id === raportti.id ? tulos.raportti : r)));
  logAudit({
    user: req.username, action: toiminto.action, collection: 'debriefs',
    recordId: raportti.id, eventId: raportti.ownerId,
  });
  kerroJalkiraportista(tulos.raportti, 'update');
  res.json({ ok: true, raportti: tulos.raportti });
});

// Poisto koskee VAIN luonnosta. Valmis jälkiraportti on dokumentti jonka joku on
// merkinnyt valmiiksi ja mahdollisesti jo jakanut; sen hävittäminen edellyttää että se
// ensin avataan uudelleen syyn kanssa, jolloin avaamisesta jää merkintä.
app.delete('/api/jalkiraportti/:id', requireAuth, (req, res) => {
  const raportit = readCollection('debriefs') || [];
  const raportti = raportit.find((r) => r.id === req.params.id);
  if (!raportti) return res.status(404).json({ ok: false, error: 'Jälkiraporttia ei löytynyt.' });

  const portti = analytiikanPortti(req, raportti.ownerId, jalkiraportinSolmu, true);
  if (portti.virhe) return res.status(portti.virhe.tila).json({ ok: false, error: portti.virhe.teksti });
  if (jalkiraporttiLukittu(raportti)) {
    return res.status(400).json({ ok: false, error: 'Valmista jälkiraporttia ei voi poistaa. Avaa se ensin uudelleen.' });
  }

  writeCollection('debriefs', raportit.filter((r) => r.id !== raportti.id));
  logAudit({
    user: req.username, action: 'debrief_delete', collection: 'debriefs',
    recordId: raportti.id, eventId: raportti.ownerId,
  });
  kerroJalkiraportista(raportti, 'delete');
  res.json({ ok: true });
});

// QR-koodin muodostus. Yleiskäyttöinen tarkoituksella: erä 5:n tarkistuspisteet
// tarvitsevat täsmälleen saman toiminnon, eikä sitä pidä kirjoittaa silloin toiseen
// kertaan. Koodi muodostetaan palvelimella, koska qrcode-kirjasto on jo palvelimen
// riippuvuutena (TOTP-koodit) — sen lisääminen myös selainnippuun kasvattaisi buildia
// turhaan, ja CSP estää sen hakemisen ulkopuolelta.
//
// Sisältö tulee pyynnön rungosta eikä osoitteesta: julisteen osoite sisältää tokenin,
// eikä sen kuulu päätyä nginxin access.logiin.
app.post('/api/qr', requireAuth, async (req, res) => {
  const teksti = String(req.body?.teksti ?? '');
  if (!teksti || teksti.length > 1024) {
    return res.status(400).json({ ok: false, error: 'QR-koodin sisältö puuttuu tai on liian pitkä.' });
  }
  try {
    // Korkea virheenkorjaustaso: juliste on ulkona sateessa ja likaantuu, ja osittain
    // vahingoittunut koodi luetaan silti.
    const dataUri = await QRCode.toDataURL(teksti, { width: 512, margin: 1, errorCorrectionLevel: 'H' });
    res.json({ ok: true, dataUri });
  } catch {
    res.status(500).json({ ok: false, error: 'QR-koodin muodostus epäonnistui.' });
  }
});

// Etsii jakolinkin tokenilla. Vakioaikainen vertailu jokaista vastaan, jottei
// vastausaika kerro kuinka moni merkki osui.
function etsiJako(token) {
  const shares = readCollection('fileShares') || [];
  return shares.find((sh) => tokenTasmaa(token, sh.token)) || null;
}

// Jaon tiedot ilman tiedostoa: käyttöliittymä kysyy tällä tarvitaanko salasana ja
// mitä ollaan lataamassa, ennen kuin näyttää lomakkeen.
app.get('/api/share/:token', shareLimiter, (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const share = etsiJako(req.params.token);
  const tila = jaonTila(share);
  if (!tila.ok) {
    // Kaikki estot palautetaan 404:llä: 403 kertoisi että token on olemassa.
    return res.status(404).json({ ok: false, error: TILAN_SELITE[tila.syy] || TILAN_SELITE.not_found });
  }
  const tiedostot = readCollection('eventFiles') || [];
  const kohde = tiedostot.find((f) => f.id === share.targetId);
  if (!kohde) return res.status(404).json({ ok: false, error: TILAN_SELITE.not_found });

  // Kansiojaossa listataan sisältö, jotta vastaanottaja näkee mitä on tarjolla.
  const sisalto = kohde.type === 'folder'
    ? tiedostot
        .filter((f) => kuuluuJakoon(share.targetId, f.id, tiedostot) && f.id !== kohde.id)
        .map((f) => ({ id: f.id, name: f.name, type: f.type, parentId: f.parentId, size: f.size }))
    : [];

  res.json({
    ok: true,
    name: kohde.name,
    type: kohde.type,
    requiresPassword: !!share.passwordHash,
    expiresAt: share.expiresAt,
    contents: sisalto,
  });
});

// Varsinainen lataus. Salasana tulee POST-rungossa eikä URL:ssa: kyselyparametrit
// päätyvät palvelinlokeihin ja selainhistoriaan.
app.post('/api/share/:token/download', shareLimiter, (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const { password, fileId } = req.body || {};
  const share = etsiJako(req.params.token);
  const tila = jaonTila(share);
  if (!tila.ok) {
    return res.status(404).json({ ok: false, error: TILAN_SELITE[tila.syy] || TILAN_SELITE.not_found });
  }
  if (!salasanaTasmaa(password, share.passwordHash)) {
    logAudit({ user: 'share:' + share.id, action: 'share_bad_password', ip: req.ip });
    return res.status(401).json({ ok: false, error: 'Väärä salasana.' });
  }

  const tiedostot = readCollection('eventFiles') || [];
  // Kansiojaossa kutsuja kertoo minkä tiedoston haluaa; se on tarkistettava kuuluvaksi
  // jaettuun alipuuhun JOKA latauksella — kansion sisältö muuttuu jaon luonnin jälkeen.
  const haettuId = fileId || share.targetId;
  const kohde = tiedostot.find((f) => f.id === haettuId);
  if (!kohde || kohde.type !== 'file' || !kuuluuJakoon(share.targetId, haettuId, tiedostot)) {
    return res.status(404).json({ ok: false, error: TILAN_SELITE.not_found });
  }
  const polku = getUploadPath(kohde.uploadId);
  if (!polku) return res.status(404).json({ ok: false, error: TILAN_SELITE.not_found });

  // Latausloki: ilman tätä linkin vuotamista ei havaitse mitenkään.
  try {
    const shares = readCollection('fileShares') || [];
    writeCollection('fileShares', shares.map((sh) => (sh.id === share.id
      ? {
          ...sh,
          downloadCount: (sh.downloadCount || 0) + 1,
          lastDownloadAt: new Date().toISOString(),
          lastDownloadIp: req.ip,
        }
      : sh)));
  } catch (err) {
    // Laskurin päivitys ei saa estää itse latausta.
    console.error('Jakolinkin latauslaskurin päivitys epäonnistui:', err.message);
  }
  logAudit({ user: 'share:' + share.id, action: 'share_download', recordId: kohde.id, ip: req.ip });
  res.download(polku, kohde.name);
});

// Pääkäyttäjän hyväksyntä pysyvälle linkille.
app.post('/api/shares/:id/approval', requireAuth, requireAdmin, (req, res) => {
  const { approve } = req.body || {};
  const shares = readCollection('fileShares') || [];
  const share = shares.find((sh) => sh.id === req.params.id);
  if (!share) return res.status(404).json({ ok: false, error: 'Jakolinkkiä ei löytynyt.' });
  if (share.approvalStatus !== 'pending') {
    return res.status(400).json({ ok: false, error: 'Tämä jakolinkki ei odota hyväksyntää.' });
  }
  const paivitetty = approve
    // Hyväksyntä poistaa määräajan: linkistä tulee pysyvä kuten pyydettiin.
    ? { ...share, approvalStatus: 'approved', expiresAt: null, approvedBy: req.username, approvedAt: new Date().toISOString() }
    // Hylkäys ei poista linkkiä vaan jättää sen alkuperäiseen määräaikaansa.
    : { ...share, approvalStatus: 'rejected', approvedBy: req.username, approvedAt: new Date().toISOString() };
  writeCollection('fileShares', shares.map((sh) => (sh.id === share.id ? paivitetty : sh)));
  logAudit({ user: req.username, action: approve ? 'share_approved' : 'share_rejected', recordId: share.id });
  res.json({ ok: true, share: julkinenJako(paivitetty) });
});

// Jakolinkin luonti. Oma reittinsä eikä /api/data/fileShares, koska token on luotava
// ja salasana hashattava palvelimella — kumpaakaan ei voi tehdä selaimessa.
app.post('/api/shares', requireAuth, (req, res) => {
  const { targetId, mode, password, expiresAt, ikuinen, maxDownloads, allowedUsernames } = req.body || {};
  const tiedostot = readCollection('eventFiles') || [];
  const kohde = tiedostot.find((f) => f.id === targetId);
  if (!kohde) return res.status(404).json({ ok: false, error: 'Jaettavaa kohdetta ei löytynyt.' });

  // Jakaminen vaatii muokkausoikeuden tiedostosivulle SIINÄ tapahtumassa johon kohde
  // kuuluu — lukuoikeus ei riitä, koska jakaminen laajentaa pääsyn sovelluksen ulkopuolelle.
  if (req.role !== 'admin' && !canEdit(req.permissions, kohde.eventId, 'eventfiles')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta jakaa tämän tapahtuman tiedostoja.' });
  }
  if (!['link', 'password', 'users'].includes(mode)) {
    return res.status(400).json({ ok: false, error: 'Tuntematon jakotapa.' });
  }

  // Henkilötietolippu peritään myös yläkansioilta: alikansioon laitettu tiedosto ei saa
  // kiertää rajoitusta sillä että lippu on vain juurikansiossa.
  const henkilotietoa = !!kohde.containsPersonalData
    || tiedostot.some((f) => f.containsPersonalData && kuuluuJakoon(f.id, kohde.id, tiedostot) && f.id !== kohde.id);

  if (mode === 'link' && henkilotietoa) {
    return res.status(400).json({
      ok: false,
      error: 'Henkilötietoa sisältävää kohdetta ei voi jakaa pelkällä linkillä. Valitse salasanasuojaus tai jakaminen nimetyille käyttäjille.',
    });
  }
  if (mode === 'password' && (typeof password !== 'string' || password.length < 8)) {
    return res.status(400).json({ ok: false, error: 'Salasanan tulee olla vähintään 8 merkkiä.' });
  }
  if (mode === 'users' && (!Array.isArray(allowedUsernames) || allowedUsernames.length === 0)) {
    return res.status(400).json({ ok: false, error: 'Valitse vähintään yksi käyttäjä.' });
  }

  // Nimetyille käyttäjille jaettu ei kulje tokenilla lainkaan: he kirjautuvat normaalisti,
  // joten linkkiä ei tarvita eikä sen vanhentumista ratkaista.
  const onTokenJako = mode !== 'users';
  let voimassaolo = { expiresAt: null, approvalStatus: 'none' };
  if (onTokenJako) {
    voimassaolo = ratkaiseVoimassaolo(
      { expiresAt, ikuinen, henkilotietoa, onAdmin: req.role === 'admin' },
      new Date()
    );
    if (voimassaolo.error) return res.status(400).json({ ok: false, error: voimassaolo.error });
  }

  const share = {
    id: crypto.randomUUID(),
    eventId: kohde.eventId,
    targetId,
    mode,
    token: onTokenJako ? luoToken() : null,
    passwordHash: mode === 'password' ? hashaaSalasana(password) : null,
    allowedUsernames: mode === 'users' ? allowedUsernames.filter((u) => typeof u === 'string') : [],
    expiresAt: voimassaolo.expiresAt,
    approvalStatus: voimassaolo.approvalStatus,
    maxDownloads: Number.isFinite(maxDownloads) && maxDownloads > 0 ? maxDownloads : null,
    downloadCount: 0,
    lastDownloadAt: null,
    lastDownloadIp: null,
    createdBy: req.username,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  const shares = readCollection('fileShares') || [];
  writeCollection('fileShares', [...shares, share]);
  logAudit({ user: req.username, action: 'share_create', recordId: share.id, eventId: kohde.eventId });

  // Token palautetaan tässä, jotta käyttöliittymä voi näyttää linkin heti.
  res.json({ ok: true, share: julkinenJako(share), token: share.token });
});

// Tokenin näyttäminen uudelleen. Erillinen reitti, jotta token ei kulje jokaisessa
// listahaussa mukana — sitä tarvitaan vain kun käyttäjä pyytää linkin nähtäväkseen.
app.get('/api/shares/:id/token', requireAuth, (req, res) => {
  const shares = readCollection('fileShares') || [];
  const share = shares.find((sh) => sh.id === req.params.id);
  if (!share) return res.status(404).json({ ok: false, error: 'Jakolinkkiä ei löytynyt.' });
  if (req.role !== 'admin' && !canEdit(req.permissions, share.eventId, 'eventfiles')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta tähän jakolinkkiin.' });
  }
  res.json({ ok: true, token: share.token });
});

// Peruutus. Ei poista tietuetta vaan merkitsee sen peruutetuksi: latausloki ja tieto
// siitä kuka linkin loi ovat jälkikäteen tärkeämpiä kuin siisti tietokanta.
app.delete('/api/shares/:id', requireAuth, (req, res) => {
  const shares = readCollection('fileShares') || [];
  const share = shares.find((sh) => sh.id === req.params.id);
  if (!share) return res.status(404).json({ ok: false, error: 'Jakolinkkiä ei löytynyt.' });
  if (req.role !== 'admin' && !canEdit(req.permissions, share.eventId, 'eventfiles')) {
    return res.status(403).json({ ok: false, error: 'Ei oikeutta peruuttaa tätä jakolinkkiä.' });
  }
  writeCollection('fileShares', shares.map((sh) => (sh.id === share.id
    ? { ...sh, revokedAt: new Date().toISOString(), revokedBy: req.username }
    : sh)));
  logAudit({ user: req.username, action: 'share_revoke', recordId: share.id, eventId: share.eventId });
  res.json({ ok: true });
});

// Käyttäjälle erikseen jaetut tiedostot ja kansiot ("Minulle jaetut").
//
// Oma reittinsä eikä /api/data/fileShares, koska vastaanottajalla EI välttämättä ole
// oikeutta kyseisen tapahtuman tiedostosivulle eikä pääsyä tapahtumaan lainkaan —
// jakaminen on juuri se mekanismi joka antaa pääsyn tähän yhteen kohteeseen.
// Palautetaan vain se mikä vastaanottajalle kuuluu: kohteen nimi ja ladattavat
// tiedostot, ei koko jakotietuetta.
app.get('/api/shares/for-me', requireAuth, (req, res) => {
  const shares = readCollection('fileShares') || [];
  const tiedostot = readCollection('eventFiles') || [];
  const nyt = new Date();

  const omat = shares.filter((sh) => {
    if (sh.mode !== 'users' || sh.revokedAt) return false;
    if (!(sh.allowedUsernames || []).includes(req.username)) return false;
    if (sh.expiresAt && new Date(sh.expiresAt) <= nyt) return false;
    return true;
  });

  const tulos = omat.map((sh) => {
    const kohde = tiedostot.find((f) => f.id === sh.targetId);
    if (!kohde) return null;
    // Kansiojaossa listataan koko alipuun tiedostot, kuten julkisessakin jaossa.
    const sisalto = kohde.type === 'folder'
      ? tiedostot
          .filter((f) => f.type === 'file' && kuuluuJakoon(sh.targetId, f.id, tiedostot))
          .map((f) => ({ id: f.id, name: f.name, uploadId: f.uploadId, size: f.size }))
      : [{ id: kohde.id, name: kohde.name, uploadId: kohde.uploadId, size: kohde.size }];
    return {
      shareId: sh.id,
      name: kohde.name,
      type: kohde.type,
      eventId: kohde.eventId,
      sharedBy: sh.createdBy,
      sharedAt: sh.createdAt,
      expiresAt: sh.expiresAt,
      files: sisalto,
    };
  }).filter(Boolean);

  res.json({ ok: true, shares: tulos });
});

// Pääkäyttäjän hyväksyntää odottavat jakolinkit ilmoituskelloa varten. Erillinen
// kevyt reitti, jotta kelloa varten ei tarvitse hakea koko fileShares-kokoelmaa
// (johon ei-adminilla ei välttämättä ole lukuoikeutta lainkaan).
app.get('/api/notifications', requireAuth, (req, res) => {
  const ilmoitukset = [];

  if (req.role === 'admin') {
    const shares = readCollection('fileShares') || [];
    const tiedostot = readCollection('eventFiles') || [];
    for (const sh of shares) {
      if (sh.approvalStatus !== 'pending' || sh.revokedAt) continue;
      const kohde = tiedostot.find((f) => f.id === sh.targetId);
      ilmoitukset.push({
        id: `share-approval-${sh.id}`,
        tyyppi: 'share_approval',
        otsikko: 'Pysyvä jakolinkki odottaa hyväksyntää',
        kuvaus: `${sh.createdBy} pyytää pysyvää linkkiä: ${kohde?.name || 'poistettu kohde'}`,
        aika: sh.createdAt,
        eventId: sh.eventId,
        kohdeId: sh.id,
      });
    }
  }

  ilmoitukset.sort((a, b) => String(b.aika || '').localeCompare(String(a.aika || '')));
  res.json({ ok: true, notifications: ilmoitukset });
});

app.get('/api/storage', requireAuth, requireAdmin, (req, res) => {
  try {
    res.json({ ok: true, ...getStorageUsage() });
  } catch (err) {
    console.error('Tallennustilan luku epäonnistui:', err.message);
    res.status(500).json({ ok: false, error: 'Tallennustilan lukeminen ei onnistunut.' });
  }
});

app.get('/api/audit', requireAuth, requireAdmin, (req, res) => {
  const { limit, before, user, action, collection, eventId } = req.query;
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const result = readAuditLog({
    limit: parsedLimit,
    before: typeof before === 'string' ? before : undefined,
    user: typeof user === 'string' ? user : undefined,
    action: typeof action === 'string' ? action : undefined,
    collection: typeof collection === 'string' ? collection : undefined,
    eventId: typeof eventId === 'string' ? eventId : undefined,
  });
  res.json({ ok: true, ...result });
});

// Lomakkeiden "Ota kuva" / "Liitä tiedosto" -liitteet. Tallennetaan levylle
// (ei git-repoon, ei muihin kokoelmiin) ja viitataan raportissa pelkällä id:llä.
app.post('/api/uploads', requireAuth, uploadLimiter, (req, res) => {
  if (!canUploadAttachment(req.role, req.permissions)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia liitteiden lähettämiseen.' });
  }
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Tiedosto on liian suuri (max 15 Mt).' : 'Tiedoston lähetys epäonnistui.';
      return res.status(400).json({ ok: false, error: msg });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Tiedostoa ei löytynyt.' });
    }
    if (!isAllowedFile(req.file.originalname)) {
      return res.status(400).json({ ok: false, error: 'Tiedostotyyppiä ei tueta.' });
    }
    const id = saveUpload(req.file.originalname, req.file.buffer);
    res.json({ ok: true, id, name: req.file.originalname, size: req.file.size });
  });
});

app.get('/api/uploads/:id', requireAuth, (req, res) => {
  const filePath = getUploadPath(req.params.id);
  if (!filePath) return res.status(404).json({ ok: false, error: 'Tiedostoa ei löytynyt.' });
  // Liite itsessään ei tiedä oikeuksia — omistava raportti (ja sen typeId) etsitään
  // reports-kokoelmasta ja tarkistetaan sen lukuoikeus, ks. permissions.js.
  const reportsArr = readCollection('reports') || [];
  const eventsArr = readCollection('events') || [];
  // Tapahtuman tiedostot ja niiden jaot mukaan: liite voi kuulua myös eventFiles-
  // tietueeseen, ja käyttäjälle erikseen jaettu tiedosto avautuu ilman tapahtumaoikeutta.
  const filesArr = readCollection('eventFiles') || [];
  const sharesArr = readCollection('fileShares') || [];
  const tapahtumaPuoli = canReadAttachment(
    req.role, req.permissions, req.eventAccess, req.params.id,
    reportsArr, eventsArr, filesArr, sharesArr, req.username
  );
  // GUARD-liitteet tarkistetaan erikseen, ja vain jos käyttäjällä on pääsy sille puolelle:
  // pelkkä liitteen id ei saa avata vartiointipuolen tiedostoa tunnukselle joka ei pääse
  // sinne lainkaan. Sama portti kuin /api/data-reiteillä (tuoteEstaa).
  const guardPuoli = !tapahtumaPuoli
    && (req.tuotteet || []).includes('guard')
    && canReadGuardAttachment(
      req.role, req.permissions, req.eventAccess, req.params.id,
      readCollection('guardFiles') || [], readCollection('guardReports') || [],
      readCollection('guardSites') || [], readCollection('keyTypes') || []
    );
  if (!tapahtumaPuoli && !guardPuoli) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tämän liitteen lataamiseen.' });
  }
  res.sendFile(filePath);
});

// ====================== HÄTÄTEKSTIVIESTIT (BulkSMS) ======================
//
// Pikatoiminnot-valikon napit lähettävät tekstiviestin BulkSMS:n JSON REST API:n kautta.
// API-tunnukset ovat VAIN palvelimella (ympäristömuuttujat, ks. bulksms.js) — selain ei
// näe niitä eikä puhu rajapinnan kanssa suoraan. Yhtä lailla tärkeää: vastaanottajien
// numerot ratkaistaan palvelimella napin id:n perusteella (sms.js), eikä niitä oteta
// pyynnön rungosta. Muuten kuka tahansa kirjautunut voisi lähettää tililtä viestejä
// mihin tahansa numeroon.

// Hätätilanteessa napista voi tulla painetuksi useaan kertaan, ja jokainen painallus
// maksaa saldoa. Raja on väljä oikealle käytölle (tilanne voi vaatia useita viestejä
// peräkkäin) mutta pysäyttää silmukan tai väärinkäytön.
const smsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liian monta viestilähetystä lyhyessä ajassa. Odota hetki.' },
});

// Saa käyttäjä lähettää hätäviestin? Nappien NÄKEMINEN riittää valikon näyttämiseen
// (smsButtons-kokoelman lukuoikeus), mutta lähettäminen vaatii erikseen quickactions-
// solmun muokkausoikeuden. Näin esim. järjestyksenvalvoja voi nähdä mitä nappeja on
// olemassa ilman että hän voi laukaista massaviestin.
function saaLahettaa(req) {
  if (req.role === 'admin') return true;
  // eventId on null koska 'quickactions' on globaali solmu (ks. permissions.js
  // GLOBAL_NODES): oikeus luetaan aina __default__-bucketista eikä sitä voi asettaa
  // tapahtumakohtaisesti. Sama kutsu kuin frontissa (src/App.tsx).
  return canEdit(req.permissions, null, 'quickactions');
}

// Integraation tila käyttöliittymälle: onko tunnukset asetettu, ja paljonko saldoa on
// jäljellä. Saldo haetaan rajapinnasta vain pyydettäessä (ei taustasilmukkaa), koska
// näkymä avataan harvoin eikä jatkuva kysely ole tarpeen.
app.get('/api/sms/status', requireAuth, async (req, res) => {
  if (!saaLahettaa(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia hätäviestien lähettämiseen.' });
  }
  // Webhookin tila kerrotaan myös ilman API-tunnuksia: se on oma asetuksensa, ja
  // puuttuva salaisuus tarkoittaa ettei toimitusraportteja saada vaikka viestit lähtisivät.
  const webhook = {
    webhookKaytossa: Boolean(process.env.BULKSMS_WEBHOOK_SECRET),
    jonossa: jononPituus(),
  };
  if (!onkoKonfiguroitu()) {
    return res.json({ ok: true, konfiguroitu: false, dryRun: true, ...webhook });
  }
  // pakota=1 ohittaa välimuistin ("Tarkista nyt" asetuksissa); muuten riittää
  // taustavahdin viimeisin tulos eikä valikon avaaminen tee ulkoista HTTP-kutsua.
  const saldo = (await saldoTiedot(req.query.pakota === '1' ? 0 : undefined)) || { ok: false, virhe: 'Saldoa ei ole vielä tarkistettu.' };
  // `ok` kertoo että TÄMÄ pyyntö onnistui, ei että BulkSMS vastasi — saldon haun oma
  // tulos kulkee erillisissä kentissä. Jos saldo.ok levitettäisiin tähän sellaisenaan,
  // se ylikirjoittaisi ok:n false:ksi, jolloin frontti hylkäisi koko vastauksen eikä
  // näyttäisi virhettä lainkaan (integraation tila jäisi näyttämään "ei tarkistettu").
  res.json({
    ok: true,
    konfiguroitu: true,
    dryRun: false,
    ...webhook,
    saldoLuettu: saldo.ok === true,
    saldo: saldo.saldo ?? null,
    kiintioJaljella: saldo.kiintioJaljella ?? null,
    kiintioKoko: saldo.kiintioKoko ?? null,
    saldoTarkistettu: saldo.tarkistettu || null,
    varoitusraja: SALDO_VAROITUSRAJA,
    virhe: saldo.virhe || null,
  });
});

// Napin vastaanottajien esikatselu ennen lähetystä: ketkä saavat viestin ja ketkä eivät
// (numero puuttuu tai on kelvoton). Erillinen reitti lähetyksestä, jotta vahvistusnäkymä
// voidaan näyttää ilman että mitään lähtee liikkeelle.
app.get('/api/sms/recipients', requireAuth, (req, res) => {
  if (!saaLahettaa(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia hätäviestien lähettämiseen.' });
  }
  const { buttonId, eventId } = req.query;
  if (typeof buttonId !== 'string' || typeof eventId !== 'string') {
    return res.status(400).json({ ok: false, error: 'buttonId ja eventId vaaditaan.' });
  }
  // Tapahtumarajaus koskee myös tätä: käyttäjä ei saa nähdä (eikä siis lähettää) toisen
  // tapahtuman työntekijöiden numeroita, vaikka nappilista on yhteinen.
  if (req.role !== 'admin' && Array.isArray(req.eventAccess) && req.eventAccess.length > 0
      && !req.eventAccess.includes(eventId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tähän tapahtumaan.' });
  }

  const napit = kaytossaOlevatNapit(readCollection('smsButtons'));
  const nappi = napit.find((n) => n.id === buttonId);
  if (!nappi) return res.status(404).json({ ok: false, error: 'Tuntematon pikatoimintonappi.' });

  const events = readCollection('events') || [];
  const vastaanottajat = ratkaiseVastaanottajat(nappi, {
    eventId,
    checkins: readCollection('checkins') || [],
    employees: readCollection('employees') || [],
    events,
  });
  const tapahtumanNimi = events.find((e) => e?.id === eventId)?.name || '';
  const runko = taytaPaikkamerkit(nappi.body, { tapahtumanNimi });

  res.json({
    ok: true,
    nappi: { id: nappi.id, label: nappi.label, group: nappi.group, repliable: nappi.repliable },
    runko,
    mitat: laskeViesti(runko),
    // Numerot palautetaan peitettyinä: vahvistusnäkymä tarvitsee vain tiedon KENELLE
    // viesti lähtee, ei työntekijöiden puhelinnumeroita selaimen muistiin.
    vastaanottajat: vastaanottajat.map((v) => ({
      nimi: v.nimi,
      rooli: v.rooli,
      ok: Boolean(v.numero),
      numero: v.numero ? `${v.numero.slice(0, 5)}…${v.numero.slice(-3)}` : null,
      syy: v.syy || null,
    })),
  });
});

app.post('/api/sms/send', requireAuth, smsLimiter, async (req, res) => {
  if (!saaLahettaa(req)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia hätäviestien lähettämiseen.' });
  }
  const { buttonId, eventId, body } = req.body || {};
  if (typeof buttonId !== 'string' || typeof eventId !== 'string') {
    return res.status(400).json({ ok: false, error: 'buttonId ja eventId vaaditaan.' });
  }
  if (req.role !== 'admin' && Array.isArray(req.eventAccess) && req.eventAccess.length > 0
      && !req.eventAccess.includes(eventId)) {
    return res.status(403).json({ ok: false, error: 'Ei oikeuksia tähän tapahtumaan.' });
  }

  const napit = kaytossaOlevatNapit(readCollection('smsButtons'));
  const nappi = napit.find((n) => n.id === buttonId);
  if (!nappi) return res.status(404).json({ ok: false, error: 'Tuntematon pikatoimintonappi.' });

  const events = readCollection('events') || [];
  const tapahtumanNimi = events.find((e) => e?.id === eventId)?.name || '';
  // Käyttäjä saa muokata runkoa lähetysikkunassa (tilanne on harvoin täsmälleen se mitä
  // pohjaan on kirjoitettu), mutta pohja on oletus. Paikkamerkit täytetään kummassakin
  // tapauksessa, jotta {tapahtuma} toimii myös käsin kirjoitetussa tekstissä.
  const raakaRunko = typeof body === 'string' && body.trim() !== '' ? body : nappi.body;
  const runko = taytaPaikkamerkit(raakaRunko, { tapahtumanNimi });
  if (!runko) {
    return res.status(400).json({ ok: false, error: 'Viesti on tyhjä.' });
  }

  const vastaanottajat = ratkaiseVastaanottajat(nappi, {
    eventId,
    checkins: readCollection('checkins') || [],
    employees: readCollection('employees') || [],
    events,
  });
  const numerot = vastaanottajat.map((v) => v.numero).filter(Boolean);
  // Sama numero voi esiintyä kahdesti (henkilö kahdella rosterirvillä, tai hätänumero
  // sama kuin työntekijän) — ilman tätä hän saisi saman viestin kahdesti ja saldoa
  // kuluisi turhaan.
  const uniikit = [...new Set(numerot)];
  // Numero -> kenelle se kuuluu, jotta lähetyshistoriaan (ja sitä kautta toimitusraportin
  // riville) saadaan nimi eikä pelkkää numeroa. Ensimmäinen osuma voittaa: jos sama
  // numero on kahdella rivillä, viesti menee kerran ja kirjautuu ensimmäiselle.
  const numeronHaltija = new Map();
  for (const v of vastaanottajat) {
    if (v.numero && !numeronHaltija.has(v.numero)) numeronHaltija.set(v.numero, v);
  }

  const tulos = await lahetaViestit({
    numerot: uniikit,
    body: runko,
    repliable: nappi.repliable,
    // Deduplikointitunniste sitoo lähetyksen nappiin, tapahtumaan ja minuuttiin: jos
    // vastaus jää verkkokatkoon ja käyttäjä painaa uudelleen, BulkSMS tunnistaa saman
    // lähetyksen eikä viesti mene kahteen kertaan. Tunniste vanhenee ~12 tunnissa.
    dedupId: Math.abs(hashDedup(`${buttonId}|${eventId}|${runko}|${Math.floor(Date.now() / 60000)}`)),
  });

  // Audit-lokiin EI kirjoiteta puhelinnumeroita eikä viestin tekstiä — sama periaate kuin
  // muualla (ks. audit.js): loki kertoo kuka teki mitä ja milloin, ei tietueen sisältöä.
  logAudit({
    user: req.username,
    action: tulos.ok ? (tulos.dryRun ? 'sms_dryrun' : 'sms_send') : 'sms_failed',
    collection: 'smsButtons',
    recordId: buttonId,
    eventId,
    recipients: uniikit.length,
    skipped: vastaanottajat.length - uniikit.length,
    parts: tulos.mitat?.osia ?? null,
    encoding: tulos.mitat?.encoding ?? null,
    ...(tulos.ok ? {} : { reason: tulos.virhe }),
  });

  if (!tulos.ok) {
    return res.status(502).json({ ok: false, error: tulos.virhe, mitat: tulos.mitat });
  }

  const ohitettu = vastaanottajat.filter((v) => !v.numero).map((v) => ({ nimi: v.nimi, syy: v.syy }));

  // Lähetyshistoria: yksi tietue per lähetys, vastaanottajakohtaisine viesti-id:ineen.
  // Nämä id:t ovat se avain jolla webhookista saapuva toimituskuittaus osataan liittää
  // oikeaan henkilöön (ks. smswebhook.js: soveltaTilaraportit) — ilman tätä tietuetta
  // kuittaukset saapuisivat mutta niitä ei voisi näyttää kenellekään.
  const lahetysId = `sms-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const tietue = {
    id: lahetysId,
    ts: new Date().toISOString(),
    eventId,
    buttonId,
    label: nappi.label,
    group: nappi.group,
    user: req.username,
    body: runko,
    dryRun: tulos.dryRun,
    repliable: nappi.repliable,
    encoding: tulos.mitat?.encoding || null,
    parts: tulos.mitat?.osia ?? null,
    recipients: tulos.tulokset.map((t, i) => {
      // Vastauksen `to` pitäisi olla sama merkkijono kuin lähetetty, mutta rajapinta voi
      // normalisoida sen (esim. plussan poisto). Verrataan siksi pelkkiä numeroita, ja
      // viimeisenä keinona luotetaan järjestykseen — vastaus tulee samassa järjestyksessä
      // kuin kuorman viestiobjektit.
      const vastattu = t.numero || null;
      const avain = vastattu
        ? uniikit.find((n) => n === vastattu) || uniikit.find((n) => n.replace(/\D/g, '') === vastattu.replace(/\D/g, ''))
        : null;
      const haltija = numeronHaltija.get(avain || uniikit[i]) || {};
      const numero = avain || uniikit[i] || vastattu;
      return {
        messageId: t.id === null || t.id === undefined ? null : String(t.id),
        nimi: haltija.nimi || null,
        rooli: haltija.rooli || null,
        // Kokonaista numeroa ei säilytetä historiassa: se on jo työntekijäpankissa,
        // eikä sitä ole syytä monistaa jokaiseen lähetystietueeseen.
        numero: numero ? `${numero.slice(0, 5)}…${numero.slice(-3)}` : null,
        status: t.status,
        statusId: null,
        updatedAt: null,
      };
    }),
    skipped: ohitettu,
  };
  try {
    // Uusin ensin, samaan tapaan kuin audit-loki ja ilmoitukset.
    writeCollection('smsLog', [tietue, ...(readCollection('smsLog') || [])]);
  } catch (err) {
    // Historian kirjoitus ei saa kaataa itse lähetystä: viestit ovat jo lähteneet, ja
    // käyttäjän on saatava siitä tieto. Virhe näkyy palvelinlokissa ja audit-loki on
    // jo kirjoitettu yllä.
    console.error('Lähetyshistorian kirjoitus epäonnistui:', err.message);
  }

  res.json({
    ok: true,
    sendId: lahetysId,
    dryRun: tulos.dryRun,
    mitat: tulos.mitat,
    lahetetty: tulos.tulokset.length,
    ohitettu,
    tulokset: tietue.recipients.map((r) => ({ numero: r.numero, nimi: r.nimi, status: r.status })),
  });
});

// Yksinkertainen 32-bittinen tiiviste deduplication-id:tä varten (rajapinta odottaa
// int32:ta). Ei kryptografinen eikä tarvitse olla: tarkoitus on vain että SAMA lähetys
// tuottaa saman tunnisteen ja eri lähetys eri tunnisteen.
function hashDedup(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ---------------------------------------------------------------- Webhook (julkinen)
//
// BulkSMS kutsuu tätä kun viestin tila muuttuu (toimituskuittaus) tai kun työntekijä
// vastaa hätäviestiin. Päätepiste on tarkoituksella ILMAN kirjautumista: kutsuja on
// BulkSMS:n palvelin, jolla ei ole istuntoa. Palomuurirajaus ei myöskään auta, koska
// BulkSMS varoittaa kutsujen tulevan dynaamisesta IP-avaruudesta.
//
// Ainoa pääsynhallinta on siis URL:n ?secret=-parametri, joka tarkistetaan ENSIMMÄISENÄ
// ennen kuin rungosta luetaan mitään.
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  // Tuhannen työntekijän massaviestistä syntyy tuhat kuittausta lyhyessä ajassa, joten
  // raja on korkea. Se on silti olemassa: ilman sitä väärällä salaisuudella tehty
  // tulva täyttäisi lokin ja veisi prosessointiaikaa.
  limit: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Liikaa webhook-kutsuja.' },
});

app.post('/api/webhooks/bulksms', webhookLimiter, (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const odotettu = process.env.BULKSMS_WEBHOOK_SECRET || '';
  if (!odotettu) {
    // Salaisuutta ei ole asetettu: päätepiste on tällöin pois käytöstä eikä sitä saa
    // vahingossa jättää auki kaikille. 503 kertoo BulkSMS:lle että kyse on tilapäisestä
    // häiriöstä, joten raportit yritetään toimittaa uudelleen kun asetus on kunnossa.
    console.error('BULKSMS_WEBHOOK_SECRET puuttuu — webhook-päätepiste on pois käytöstä.');
    return res.status(503).json({ ok: false });
  }
  if (!salaisuusTasmaa(typeof req.query.secret === 'string' ? req.query.secret : '', odotettu)) {
    logAudit({ action: 'sms_webhook_rejected', ip: req.ip });
    return res.status(403).json({ ok: false });
  }

  // Jonoon ja heti 200 OK. Rungon sisältöä EI tulkita tässä: BulkSMS vaatii vastauksen
  // alle 30 sekunnissa, ja kuittausryöpyn aikana jokainen synkroninen kokoelmapäivitys
  // kasvattaisi vastausaikaa kunnes osa raporteista aikakatkeaisi.
  // Kuorma jäsennetään raakatekstistä eikä oteta req.bodystä: express.json on jo
  // pyöristänyt viesti-id:t (ks. bulksms.js: parsiJson). Jos raakatekstiä ei jostain
  // syystä ole, req.body on parempi kuin ei mitään.
  const kuorma = req.rawBody ? parsiJson(req.rawBody) : (req.body ?? null);

  const lisatty = lisaaJonoon({
    event: req.get('X-BulkSMS-Event') || null,
    webhookId: req.get('X-BulkSMS-Webhook-Id') || null,
    // Toimitusyritysten numero kertoo uusinnoista: jos tämä kasvaa, päätepiste ei ole
    // ehtinyt vastata ajoissa aiemmilla kerroilla.
    yritys: req.get('X-BulkSMS-Delivery-Attempt') || null,
    saapui: new Date().toISOString(),
    payload: kuorma,
  });
  if (!lisatty) {
    // 503 (ei 400): BulkSMS tulkitsee tämän tilapäiseksi häiriöksi ja yrittää uudelleen.
    // 400 hylkäisi raportin pysyvästi ja 410 lakkauttaisi koko webhook-konfiguraation.
    return res.status(503).json({ ok: false });
  }
  res.status(200).json({ ok: true });
});

// Taustakäsittely: purkaa jonon ja päivittää lähetyshistorian. Ajetaan ajastimella eikä
// pyynnön yhteydessä, jotta webhook-vastaus pysyy nopeana ruuhkassakin.
function kasitteleWebhookJono() {
  const tapahtumat = otaKasittelyyn();
  if (tapahtumat.length === 0) return;

  let log = readCollection('smsLog') || [];
  let vastaukset = readCollection('smsReplies') || [];
  let logMuuttui = false;
  let uusiaVastauksia = 0;

  // Käsittelemättä jääneet tapahtumat kerätään ja lokitetaan silmukan jälkeen.
  //
  // Aiemmin tuntematon tapahtuma ohitettiin TÄYSIN hiljaa: ei lokia, ei audit-merkintää,
  // ja jono kuitattiin silti käsitellyksi. Se teki puuttuvan vastauksen selvittämisestä
  // kohtuuttoman vaikeaa — tiedettiin vain että BulkSMS sai 200 OK ja että mitään ei
  // tallentunut, eikä mistään voinut päätellä kumpi tapahtumatyyppi katosi. Hätäviestien
  // kuittausketjussa juuri se on tieto jota ilman ei voi toimia.
  const tuntemattomat = [];
  for (const tapahtuma of tapahtumat) {
    const { tyyppi, viestit } = tulkitseTapahtuma(tapahtuma?.event, tapahtuma?.payload);
    if (tyyppi === 'status') {
      const tulos = soveltaTilaraportit(log, viestit);
      log = tulos.smsLog;
      logMuuttui = logMuuttui || tulos.muuttui;
    } else if (tyyppi === 'reply') {
      const tulos = soveltaVastaukset(log, vastaukset, viestit);
      vastaukset = tulos.smsReplies;
      uusiaVastauksia += tulos.lisatty;
      // Tunnettu tapahtuma jossa oli viestejä mutta joka ei tuottanut yhtään uutta
      // vastausta: joko kaksoiskappale (uusinta) tai jotain odottamatonta. Ei virhe,
      // mutta jälki on jäätävä.
      if (viestit.length > 0 && tulos.lisatty === 0) {
        console.warn(`Webhook: ${viestit.length} vastausta ei tuottanut uutta tietuetta (kaksoiskappale?).`);
      }
    } else {
      tuntemattomat.push({ event: tapahtuma?.event ?? null, viesteja: viestit.length });
    }
  }

  if (tuntemattomat.length > 0) {
    // Tyhjä kuorma tunnetulla tai tuntemattomalla otsikolla on BulkSMS:n
    // validointikutsu (webhookia luotaessa/aktivoitaessa) — se on normaalia eikä sitä
    // kannata kirjata audit-lokiin, mutta palvelinlokiin kylläkin.
    const merkittavat = tuntemattomat.filter((t) => t.viesteja > 0);
    console.warn(`Webhook: ${tuntemattomat.length} käsittelemätöntä tapahtumaa: ${JSON.stringify(tuntemattomat)}`);
    for (const t of merkittavat) {
      logAudit({ action: 'sms_webhook_unknown', event: t.event, count: t.viesteja });
    }
  }

  try {
    if (logMuuttui) writeCollection('smsLog', log);
    if (uusiaVastauksia > 0) {
      writeCollection('smsReplies', vastaukset);
      logAudit({ action: 'sms_replies', count: uusiaVastauksia });
    }
    // Kuittaus VASTA onnistuneen kirjoituksen jälkeen: jos kirjoitus heittää, samat
    // tapahtumat käsitellään uudelleen seuraavalla kierroksella. Käsittely on
    // idempotentti (ks. smswebhook.js), joten toisto ei riko mitään — mutta kadonnut
    // toimituskuittaus olisi lopullinen menetys.
    kuittaaKasitellyksi();
  } catch (err) {
    console.error('Webhook-jonon käsittely epäonnistui:', err.message);
  }
}

// ---------------------------------------------------------------- Saldovahti
//
// Hätäviestintä ei saa keskeytyä siihen että tili on tyhjä. BulkSMS:n oma Auto Top-up
// on ensisijainen turvaverkko (hallintapaneelin asetus), tämä on toinen: sovellus
// tarkistaa saldon säännöllisesti ja varoittaa käyttöliittymässä ENNEN kuin oikea
// hätätilanne on käsillä.
const SALDO_VAROITUSRAJA = Number(process.env.BULKSMS_SALDO_VAROITUSRAJA || 1000);
const SALDO_TARKISTUSVALI_MS = 6 * 60 * 60 * 1000;

// Viimeisin tarkistus välimuistissa, jotta /api/sms/status ei tee ulkoista HTTP-kutsua
// joka kerta kun Pikatoiminnot-valikko avataan.
let saldoValimuisti = null;
// Oliko saldo edellisellä tarkistuksella jo varoitusrajan alla. Käytetään siihen että
// audit-lokiin kirjataan vain RAJAN ALITUS eikä samaa varoitusta joka kuudes tunti.
let saldoOliAlle = false;

async function tarkistaSaldo() {
  if (!onkoKonfiguroitu()) return null;
  const tulos = await haeSaldo();
  saldoValimuisti = { ...tulos, tarkistettu: new Date().toISOString() };

  if (tulos.ok && typeof tulos.saldo === 'number') {
    const alle = tulos.saldo < SALDO_VAROITUSRAJA;
    if (alle && !saldoOliAlle) {
      logAudit({ action: 'sms_saldo_vahissa', balance: Math.round(tulos.saldo), threshold: SALDO_VAROITUSRAJA });
    }
    saldoOliAlle = alle;
  }
  return saldoValimuisti;
}

// Palauttaa välimuistin jos se on tuore, muuten hakee uudestaan. maxIkaMs = 0 pakottaa
// tuoreen haun ("Tarkista nyt" -painike asetuksissa).
async function saldoTiedot(maxIkaMs = SALDO_TARKISTUSVALI_MS) {
  const ika = saldoValimuisti ? Date.now() - new Date(saldoValimuisti.tarkistettu).getTime() : Infinity;
  if (saldoValimuisti && ika < maxIkaMs) return saldoValimuisti;
  return (await tarkistaSaldo()) || saldoValimuisti;
}

// Kanavan istunnon tunnistus. Upgrade-pyynnössä on samat otsakkeet kuin tavallisessa
// pyynnössä, joten getSessionUser kelpaa sellaisenaan — kanava ei siis ole oma
// tunnistautumisreittinsä vaan käyttää samaa evästettä ja samaa mitätöintisääntöä.
//
// Pakkosalasananvaihdon aikana kanavaa ei avata lainkaan: silloin istunnolla ei saa tehdä
// mitään muuta kuin vaihtaa salasana (sama sääntö kuin requireAuthissa).
function tunnistaKanava(req) {
  const username = getSessionUser(req);
  if (!username) return null;
  const user = findUser(username);
  if (!user || user.must_change_password) return null;
  return {
    username,
    role: user.role,
    // roleId eikä valmiit oikeudet: taso luetaan vasta lähetyshetkellä, jolloin tason
    // muokkaus vaikuttaa heti eikä vasta kun käyttäjä avaa yhteyden uudelleen. Sama
    // periaate kuin requireAuthissa.
    roleId: user.roleId,
    eventAccess: user.eventAccess,
    tuotteet: paaseeTuotteisiin(user),
  };
}

// Kuka saa nähdä henkilöstön sijainnit. Oma sivukartta-solmunsa: kaikki tapahtuman
// katselijat eivät saa nähdä missä työntekijät ovat, vaikka näkisivät kirjaukset.
// SAMA SÄÄNTÖ KUIN HAUSSA, EIKÄ VAIN SAMANLAINEN. Kanavan suodatin ja /api/sijainnit
// kutsuvat molemmat sijainti.js:n saaNahdaSijaintirivin-funktiota, koska niiden
// erkaneminen ei näkyisi mistään: jos haku palauttaa piiriyksikön mutta kanava ei kerro
// sen liikkeistä, yksikkö ilmestyy kartalle kerran ja jähmettyy siihen. Jähmettynyt
// merkki on pahempi kuin puuttuva, koska se näyttää tuoreelta.
//
// Oikeudet luetaan roleId:stä vasta tässä eikä yhteyttä avattaessa, jotta tason muokkaus
// vaikuttaa heti — ks. tunnistaKanava.
function saaNahdaSijainnit(istunto, eventId) {
  if (!istunto) return false;
  const kysyja = {
    role: istunto.role,
    eventAccess: istunto.eventAccess,
    permissions: rolePermissions(istunto.roleId),
  };
  return saaNahdaSijaintirivin(kysyja, { eventId });
}

// Sijaintiviesti kentältä. Palvelin päättää sekä aikaleiman että sen kenelle tieto
// kerrotaan — selain ei kumpaakaan.
// Vyöhykepoikkeamien toistosuojan muisti: username -> { "vyohykeId:saanto": aikaleima }.
// Muistissa eikä levyllä samasta syystä kuin sijainnit itse (sijainti.js): tämä on
// hetkellistä tilaa, jonka menettäminen palvelimen käynnistyessä ei haittaa — pahin
// seuraus on yksi ylimääräinen hälytys.
const geofenceMuisti = new Map();

// Vyöhykepoikkeamat sijaintipäivityksestä. Hälytys syntyy vain rajan ylityksestä, ja
// säännöt suojineen ovat geofence.js:ssä. Tämä ei siis päätä mistään — se lukee
// vyöhykkeet, kysyy arviota ja kirjaa tuloksen.
function tarkistaVyohykkeet(istunto, edellinen, tietue) {
  const { vyohykkeet } = kohteenTiedot(tietue.eventId);
  if (vyohykkeet.length === 0) return;

  const tulos = arvioiVyohykkeet({
    vyohykkeet,
    edellinen,
    nykyinen: tietue,
    viimeksi: geofenceMuisti.get(istunto.username) || {},
  });
  geofenceMuisti.set(istunto.username, tulos.viimeksi);
  if (tulos.poikkeamat.length === 0) return;

  const lista = readCollection('alerts') || [];
  const uudet = [];
  for (const poikkeama of tulos.poikkeamat) {
    const luotu = luoHalytys({
      id: crypto.randomUUID(),
      tyyppi: 'geofence',
      vartija: istunto.username,
      eventId: tietue.eventId,
      kuvaus: poikkeama.kuvaus,
      gps: tietue.gps,
      vyohyke: poikkeama.vyohyke,
    });
    if (luotu.ok) uudet.push(luotu.halytys);
  }
  if (uudet.length === 0) return;

  writeCollection('alerts', [...uudet, ...lista]);
  for (const h of uudet) {
    logAudit({
      user: h.vartija, action: 'alarm_geofence', collection: 'alerts',
      recordId: h.id, eventId: h.eventId, zone: h.vyohyke?.id,
    });
    kerroHalytyksesta(h, 'create');
  }
}

// Kanavalta tulevat viestit jaetaan tyypin mukaan. Uudet PTT-tyypit (erä 26) ovat omina
// funktioinaan tämän rinnalla — sijaintikäsittely pysyy ennallaan omassa funktiossaan.
function kasitteleKanavaViesti(istunto, viesti) {
  if (viesti.tyyppi === 'sijainti') return kasitteleSijaintiViesti(istunto, viesti);
  if (viesti.tyyppi === 'aseta_kuunneltavat_kanavat') return kasitteleKuunneltavatKanavat(istunto, viesti);
  if (viesti.tyyppi === 'pyyda_puheenvuoro') return kasittelePuheenvuoroPyynto(istunto, viesti);
  if (viesti.tyyppi === 'vapauta_puheenvuoro') return kasittelePuheenvuoroVapautus(istunto, viesti);
}

// --- PTT floor control (erä 26, vaihe 1b; hätäkanava/DM/vapaa mukaan vaihe 1e/1f/1g) -
//
// KAIKKI TÄHÄNASTISET KANAVATYYPIT: kiinteät (kohde/piiri), hätäkanava, DM ja vapaa
// ryhmä. Jäsenyyssääntö kullekin on server/kanavat.js:ssä; tämä tiedosto vain kokoaa ne
// yhdeksi tarkistukseksi ja lisää tuoteoikeuden (guard_ptt).
//
// SAMA TARKISTUS JOKA KERTA, EI VAIN YHTEYDEN AVATESSA. `istunto.kuunneltavatKanavat`
// on käyttäjän oma ilmoitus siitä mitä se haluaa kuunnella, mutta oikeus ja vuoro
// tarkistetaan aina uudelleen lähetyshetkellä — sama periaate kuin sijaintikanavalla
// (ks. tunnistaKanava: "oikeudet luetaan roleId:stä vasta tässä"). Ilman uudelleen-
// tarkistusta vuoron päättyminen kesken auki olevan yhteyden ei koskaan sulkisi kuuloa
// kanavalta johon käyttäjä ei enää kuulu — DM:llä tämä on erityisen tärkeää, koska
// vuoro voi päättyä kesken auki olevan yhteyden ja kanava purkautuu (kanavat.js:
// dmPurkautunut) sen mukana.
//
// Kiinteä kanava tarkistetaan ensin ilman levyluentaa (halvempi, ja kattaa suurimman
// osan kutsuista). Vasta jos se ei täsmää, kanava haetaan guardKanavat-kokoelmasta ja
// jäsenyys ratkeaa sen `tyyppi`-kentän mukaan — sama kaksijakoinen malli kuin
// GET /api/kanavat/omat:ssa.
function kuuluuKanavaanNyt(istunto, kanavaId, vuoro) {
  if (kuuluuKiinteaanKanavaan(vuoro, kanavaId)) return true;
  const kanava = (readCollection('guardKanavat') || []).find((k) => k.id === kanavaId);
  if (!kanava) return false;
  if (kanava.tyyppi === 'hata') {
    // Hälyttäjä itse tai päivystäjä (guard_dispatch NÄKY) juuri nyt.
    return onHalyttaja(kanava, istunto?.username)
      || istunto?.role === 'admin'
      || canView(rolePermissions(istunto?.roleId), null, 'guard_dispatch');
  }
  // DM ja vapaa ryhmä jakavat saman osallistujalista-muotoisen tietueen.
  if (kanava.tyyppi === 'dm' || kanava.tyyppi === 'vapaa') return onOsallistuja(kanava, istunto?.username);
  return false;
}

function saaKuullaKanavaa(istunto, kanavaId) {
  if (!istunto?.kuunneltavatKanavat?.has(kanavaId)) return false;
  if (istunto.role === 'admin') return true;
  if (!(istunto.tuotteet || []).includes('guard')) return false;
  if (!canView(rolePermissions(istunto.roleId), null, 'guard_ptt')) return false;
  const vuoro = keskenOlevaVuoro(readCollection('guardShifts') || [], istunto.username);
  return kuuluuKanavaanNyt(istunto, kanavaId, vuoro);
}

// Vartija ilmoittaa mitä kanavia se juuri nyt kuuntelee (skannaus). Tallennetaan
// istuntoon itseensä — se on sama olio koko yhteyden ajan (ks. kanava.js:
// `ws.istunto = istunto`) — jotta puheenvuoro-broadcastit voidaan kohdistaa vain
// niille jotka oikeasti kuuntelevat kyseistä kanavaa eikä kaikille avoimille yhteyksille.
//
// Pyydetyt kanavat suodatetaan heti kesken olevan vuoron mukaan: käyttäjä ei voi asettaa
// itseään kuuntelemaan kanavaa johon ei kuulu, vaikka selain sellaisen pyytäisi.
function kasitteleKuunneltavatKanavat(istunto, viesti) {
  if (!istunto || !(istunto.tuotteet || []).includes('guard')) return;
  const pyydetyt = Array.isArray(viesti.kanavat)
    ? viesti.kanavat.filter((id) => typeof id === 'string').slice(0, 20)
    : [];
  const vuoro = keskenOlevaVuoro(readCollection('guardShifts') || [], istunto.username);
  istunto.kuunneltavatKanavat = new Set(
    istunto.role === 'admin' ? pyydetyt : pyydetyt.filter((id) => kuuluuKanavaanNyt(istunto, id, vuoro))
  );

  // Kerrotaan heti kenellä näistä on puheenvuoro juuri nyt — ilman tätä äsken avattu tai
  // uudelleenyhdistynyt selain näyttäisi jokaisen kanavan vapaana vaikka joku olisi
  // parhaillaan kesken lähetyksen.
  const tilat = [...istunto.kuunneltavatKanavat]
    .map((kanavaId) => ({ kanavaId, kayttaja: nykyinenHaltija(kanavaId) }))
    .filter((t) => t.kayttaja !== null);
  if (tilat.length > 0) {
    lahetaViesti({ tyyppi: 'puheenvuoro_tila', tilat }, { suodatin: (vastaanottaja) => vastaanottaja === istunto });
  }
}

function kasittelePuheenvuoroPyynto(istunto, viesti) {
  if (!istunto || !(istunto.tuotteet || []).includes('guard')) return;
  const kanavaId = typeof viesti.kanavaId === 'string' ? viesti.kanavaId : '';
  if (!kanavaId) return;
  if (istunto.role !== 'admin' && !canView(rolePermissions(istunto.roleId), null, 'guard_ptt')) return;
  if (istunto.role !== 'admin') {
    const vuoro = keskenOlevaVuoro(readCollection('guardShifts') || [], istunto.username);
    if (!kuuluuKanavaanNyt(istunto, kanavaId, vuoro)) return;
  }

  const tulos = pyydaPuheenvuoro({ kanavaId, istunto, kayttaja: istunto.username });
  if (tulos.ok) {
    lahetaViesti(
      { tyyppi: 'puheenvuoro_myonnetty', kanavaId, kayttaja: tulos.kayttaja },
      { suodatin: (vastaanottaja) => saaKuullaKanavaa(vastaanottaja, kanavaId) },
    );
  } else {
    // Hylkäys vain pyytäjälle — muiden ei tarvitse tietää että joku yritti eikä saanut.
    lahetaViesti(
      { tyyppi: 'puheenvuoro_hylatty', kanavaId, syy: tulos.syy, kayttaja: tulos.kayttaja },
      { suodatin: (vastaanottaja) => vastaanottaja === istunto },
    );
  }
}

function kasittelePuheenvuoroVapautus(istunto, viesti) {
  const kanavaId = typeof viesti.kanavaId === 'string' ? viesti.kanavaId : '';
  if (!kanavaId || !vapautaPuheenvuoro({ kanavaId, istunto })) return;
  lahetaViesti(
    { tyyppi: 'puheenvuoro_vapautui', kanavaId },
    { suodatin: (vastaanottaja) => saaKuullaKanavaa(vastaanottaja, kanavaId) },
  );
}

// Yhteyden katketessa (kanava.js: onClose) vapautetaan kaikki tämän istunnon pitämät
// puheenvuorot — muuten katkennut selain jäisi näyttämään kanavan varattuna ikuisesti,
// kunnes 60 sekunnin aikakatkaisu joskus laukeaisi.
function kasitteleKanavanSulkeutuminen(istunto) {
  if (!istunto) return;
  for (const kanavaId of vapautaIstunnolta(istunto)) {
    lahetaViesti(
      { tyyppi: 'puheenvuoro_vapautui', kanavaId },
      { suodatin: (vastaanottaja) => saaKuullaKanavaa(vastaanottaja, kanavaId) },
    );
  }
}

// Sijaintiviesti kentältä. Palvelin päättää sekä aikaleiman että sen kenelle tieto
// kerrotaan — selain ei kumpaakaan.
function kasitteleSijaintiViesti(istunto, viesti) {
  if (!seurantaKaytossa()) return;
  // Edellinen sijainti luetaan ENNEN päivitystä: vyöhykepoikkeama on rajan ylitys, ja
  // ylityksen näkee vain vertaamalla uutta sijaintia edelliseen.
  // Kuvakoordinaatti täydennetään jos se puuttuu. Natiivisovellus lähettää pelkän GPS:n
  // — georeferoinnin kaksoiskappale laitteella erkanisi kartasta — ja ilman tätä riviä
  // natiivin sijainti ei laukaisisi vyöhykepoikkeamaa koskaan, koska arvioi() vaatii
  // img-kentän. Selaimen viestissä img on jo mukana eikä sitä korvata.
  const taydennetty = taydennaKuvakoordinaatti(viesti, kohteenTiedot(viesti.eventId).mapRef);
  const edellinen = haeSijainti(istunto?.username);
  const tietue = paivitaSijainti(istunto?.username, viesti.eventId, taydennetty);
  if (!tietue) return;

  // Historiaan VASTA hyväksytty päivitys. paivitaSijainti palauttaa nullin jos seuranta
  // on pois päältä tai syöte oli kelvoton, ja kumpikaan ei kuulu lokiin: pois kytketty
  // seuranta ei saa kerätä mitään, eikä hylätty syöte ole sijainti.
  //
  // Sama tietue kuin muistissa ja kanavalla, jotta jälki vastaa sitä mitä päivystäjä
  // näki ruudulla. Kaksi eri suodatusta tuottaisi jäljen joka on eri kuin tilannekuva.
  kirjaaHistoriaan(tietue);

  lahetaViesti(
    { tyyppi: 'sijainnit', eventId: tietue.eventId, sijainnit: [{ ...tietue, ikaMs: 0 }] },
    { suodatin: (vastaanottaja) => saaNahdaSijainnit(vastaanottaja, tietue.eventId) }
  );
  tarkistaVyohykkeet(istunto, edellinen, tietue);
}

// Kalustotunnusten numeroinnin siirto tuhannen sarjaan (kalusto.js: migroiTunnukset).
//
// KÄYNNISTYKSESSÄ eikä skriptinä, koska ajo on tehtävä jokaisessa asennuksessa eikä
// vain siinä yhdessä johon joku muistaa kirjautua. Ajo on idempotentti: se koskee vain
// alle tuhannen numeroita, joten toisella kerralla se ei tee mitään eikä kirjoita
// levylle.
//
// Lokirivi on tarkoituksellinen. Tunnus on painettu kilpeen, ja sen vaihtuminen on
// asia joka pitää näkyä julkaisun lokissa — ei jotain mikä tapahtuu hiljaa.
function siirraKalustonNumerointi() {
  const pankki = readCollection('assets') || [];
  if (pankki.length === 0) return;
  const tulos = kalusto.migroiTunnukset(pankki, { user: 'jarjestelma' });
  if (tulos.muutettuja === 0) return;
  writeCollection('assets', tulos.kalusto);
  for (const { vanha, uusi } of tulos.muutetut) {
    logAudit({ user: 'jarjestelma', action: 'asset_renumber', collection: 'assets', detail: `${vanha} -> ${uusi}` });
  }
  console.log(
    `kalusto: ${tulos.muutettuja} tunnusta siirretty tuhannen sarjaan `
    + '(vanhat kilvet on tulostettava uudelleen)'
  );
}

const palvelin = app.listen(PORT, '127.0.0.1', () => {
  console.log(`turvajohto-os-server kuuntelee portissa ${PORT}`);
  liitaKanava(palvelin, {
    tunnista: tunnistaKanava, onViesti: kasitteleKanavaViesti, onClose: kasitteleKanavanSulkeutuminen,
  });

  siirraKalustonNumerointi();

  // Webhook-jonon purku. 5 s on kompromissi: tarpeeksi tiheä että toimitustilat
  // näkyvät käyttöliittymässä käytännössä heti, mutta harvempi kuin kuittausten
  // saapumistahti, jolloin yksi kierros käsittelee koko ryöpyn kerralla eikä
  // kokoelmaa kirjoiteta levylle sataa kertaa peräkkäin.
  setInterval(kasitteleWebhookJono, 5000).unref();
  // Käsitellään heti käynnistyksessä myös se mitä jonoon jäi edellisen ajon aikana
  // (deploy käynnistää palvelimen uudelleen kesken kuittausryöpyn).
  kasitteleWebhookJono();

  // Hälytyskierros: erääntyneet ajastimet laukeavat ja lauenneet eskaloituvat. Tämä on
  // se osa jonka takia ajastin ylipäätään toimii — selaimessa pyörivä ajastin ei laukeaisi
  // silloin kun sitä eniten tarvitaan, eli kun puhelin on sammunut.
  setInterval(kasitteleHalytykset, HALYTYSKIERROS_MS).unref();
  kasitteleHalytykset();

  // Sijaintihistorian siivous. Säilytysaika on 45 vrk (sijaintiloki.js), ja se on
  // TOTEUTETTAVA eikä vain luvattava — säilytysaika jota mikään ei valvo on
  // dokumentaatiota eikä suojaa.
  //
  // Kerran vuorokaudessa JA heti käynnistyksessä. Jälkimmäinen on se joka oikeasti
  // ratkaisee: palvelin käynnistyy jokaisessa julkaisussa, joten siivous ajetaan
  // käytännössä useammin kuin kerran päivässä — ja pitkään alhaalla ollut palvelin
  // siivoaa heti eikä vasta vuorokauden kuluttua.
  //
  // Poistot auditlokiin: säilytysajan noudattaminen on voitava osoittaa jälkikäteen,
  // eikä hiljainen poisto osoita mitään.
  const siivoaHistoria = () => {
    try {
      const poistetut = siivoaSijaintiloki();
      if (poistetut.length > 0) {
        logAudit({
          user: 'jarjestelma',
          action: 'sijaintiloki_siivous',
          collection: 'sijaintiloki',
          tiedostot: poistetut,
          sailytysVrk: SIJAINTI_SAILYTYS_VRK,
        });
      }
    } catch (err) {
      console.error('Sijaintilokin siivous epäonnistui:', err.message);
    }

    // Vyöhykepoikkeamien sijainnit, sama 45 vrk (käyttäjän päätös 15.9.2026).
    //
    // SIJAINTI POIS, HÄLYTYS JÄÄ. Hälytystietueella on arvoa tapahtumana senkin jälkeen
    // kun koordinaatti on poistettu: kuka, milloin, mikä vyöhyke, kuittasiko joku.
    //
    // panic, mandown ja ajastin EIVÄT kuulu tähän: ne johtavat tarkistustehtävään ja
    // tapahtumailmoitukseen, joten niiden sijainti noudattaa LYTP:n säilytysaikaa.
    try {
      const halytykset = readCollection('alerts') || [];
      const { halytykset: siivotut, poistettu } = siivoaVyohykeSijainnit(halytykset);
      if (poistettu > 0) {
        writeCollection('alerts', siivotut);
        logAudit({
          user: 'jarjestelma',
          action: 'vyohykesijainti_siivous',
          collection: 'alerts',
          poistettu,
          sailytysVrk: GEOFENCE_SAILYTYS_VRK,
        });
      }
    } catch (err) {
      console.error('Vyöhykepoikkeamien sijaintien siivous epäonnistui:', err.message);
    }
  };
  setInterval(siivoaHistoria, 24 * 60 * 60 * 1000).unref();
  siivoaHistoria();

  if (onkoKonfiguroitu()) {
    setInterval(() => { tarkistaSaldo().catch(() => {}); }, SALDO_TARKISTUSVALI_MS).unref();
    // Ensimmäinen tarkistus pienellä viiveellä: käynnistyksen aikana ulkoinen HTTP-kutsu
    // ei saa hidastaa palvelimen valmiiksi tuloa (deploy odottaa sitä).
    setTimeout(() => { tarkistaSaldo().catch(() => {}); }, 10000).unref();
  } else {
    console.log('BulkSMS-tunnuksia ei ole asetettu — hätäviestit ovat kuivaharjoittelutilassa.');
  }
});
