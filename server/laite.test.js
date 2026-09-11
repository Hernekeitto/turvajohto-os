// Laitesidonnan testit.
//
// Painopiste on niissä tapauksissa joissa tarkistuksen PITÄÄ epäonnistua. Toimiva
// allekirjoitus on helppo saada oikein vahingossakin; arvo on siinä, ettei mikään muu
// kelpaa — väärä runko, väärä polku, vanha aika, toistettu pyyntö tai mitätöity istunto.
//
// Ajetaan: node --test server/laite.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  AIKAIKKUNA_MS, KOODI_PITUUS, KOODI_VOIMASSA_MS,
  kanoninenViesti, kelpaakoKoodi, laitteenTietue, lueAvain, luoKoodi, luoNonceMuisti,
  tarkistaAllekirjoitus,
  LYONTI_TALLENNUSVALI_MS, VALVONTA_HILJENEE_MS,
  luoLyontimuisti, tarvitaankoLyonninTallennus, valvonnanTila,
} from './laite.js';

const T0 = Date.parse('2026-09-09T12:00:00Z');

const avainpari = () => crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });

const julkinenBase64 = (pari) =>
  pari.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');

const allekirjoita = (pari, viesti) =>
  crypto.sign('sha256', Buffer.from(viesti), pari.privateKey).toString('base64');

// Kokonainen kelvollinen pyyntö. Testit muuttavat tästä yhtä asiaa kerrallaan.
function pyynto(yli = {}) {
  const pari = yli.pari || avainpari();
  const laite = yli.laite || laitteenTietue({
    kayttaja: 'vartija1',
    julkinenAvain: julkinenBase64(pari),
    malli: 'Samsung SM-S911B',
    nyt: T0,
  });
  const osat = {
    laite,
    metodi: 'POST',
    polku: '/api/halytys',
    aika: T0,
    nonce: 'nonce-1234567890',
    runko: '{"tyyppi":"panic"}',
    nyt: T0,
    ...yli,
  };
  const allekirjoitus = allekirjoita(pari, kanoninenViesti({
    laiteId: laite.id,
    metodi: osat.metodi,
    polku: osat.polku,
    aika: osat.aika,
    nonce: osat.nonce,
    runko: osat.runko,
  }));
  return { pari, osat: { ...osat, allekirjoitus } };
}

// --- Sidontakoodi -------------------------------------------------------------------

test('koodi on oikean mittainen eikä sisällä sekoitettavia merkkejä', () => {
  const { koodi } = luoKoodi({ kayttaja: 'vartija1', nyt: T0 });
  assert.equal(koodi.length, KOODI_PITUUS);
  assert.match(koodi, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
});

test('koodia ei tallenneta selkokielisenä', () => {
  const { koodi, tietue } = luoKoodi({ kayttaja: 'vartija1', nyt: T0 });
  assert.ok(!JSON.stringify(tietue).includes(koodi));
});

test('oikea koodi kelpaa, väärä ei', () => {
  const { koodi, tietue } = luoKoodi({ kayttaja: 'vartija1', nyt: T0 });
  assert.equal(kelpaakoKoodi(tietue, koodi, T0).ok, true);
  assert.equal(kelpaakoKoodi(tietue, 'VAARAKOODI', T0).ok, false);
});

test('koodi vanhenee viidessä minuutissa', () => {
  const { koodi, tietue } = luoKoodi({ kayttaja: 'vartija1', nyt: T0 });
  assert.equal(kelpaakoKoodi(tietue, koodi, T0 + KOODI_VOIMASSA_MS - 1).ok, true);
  assert.equal(kelpaakoKoodi(tietue, koodi, T0 + KOODI_VOIMASSA_MS + 1).syy, 'vanhentunut');
});

test('käytettyä koodia ei voi käyttää toista kertaa', () => {
  const { koodi, tietue } = luoKoodi({ kayttaja: 'vartija1', nyt: T0 });
  assert.equal(kelpaakoKoodi({ ...tietue, kaytetty: true }, koodi, T0).syy, 'kaytetty');
});

// --- Avain --------------------------------------------------------------------------

test('P-256-avain luetaan, RSA ja roska hylätään', () => {
  assert.ok(lueAvain(julkinenBase64(avainpari())));

  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.equal(lueAvain(rsa.publicKey.export({ format: 'der', type: 'spki' }).toString('base64')), null);

  assert.equal(lueAvain('ei-ole-avain'), null);
  assert.equal(lueAvain(''), null);
  assert.equal(lueAvain(null), null);
});

// --- Allekirjoitus ------------------------------------------------------------------

test('kelvollinen allekirjoitus hyväksytään', () => {
  const { osat } = pyynto();
  assert.deepEqual(tarkistaAllekirjoitus(osat), { ok: true, syy: null });
});

test('muutettu runko hylätään', () => {
  const { osat } = pyynto();
  const tulos = tarkistaAllekirjoitus({ ...osat, runko: '{"tyyppi":"ajastin"}' });
  assert.equal(tulos.syy, 'allekirjoitus');
});

test('muutettu polku hylätään', () => {
  const { osat } = pyynto();
  assert.equal(tarkistaAllekirjoitus({ ...osat, polku: '/api/users' }).syy, 'allekirjoitus');
});

test('muutettu metodi hylätään', () => {
  const { osat } = pyynto();
  assert.equal(tarkistaAllekirjoitus({ ...osat, metodi: 'DELETE' }).syy, 'allekirjoitus');
});

test('toisen laitteen avaimella tehty allekirjoitus hylätään', () => {
  const { osat } = pyynto();
  const vieras = avainpari();
  const laite = { ...osat.laite, julkinenAvain: julkinenBase64(vieras) };
  assert.equal(tarkistaAllekirjoitus({ ...osat, laite }).syy, 'allekirjoitus');
});

test('liian vanha ja liian tuore pyyntö hylätään', () => {
  const { osat } = pyynto();
  assert.equal(tarkistaAllekirjoitus({ ...osat, nyt: T0 + AIKAIKKUNA_MS + 1 }).syy, 'aika_ikkunan_ulkona');
  assert.equal(tarkistaAllekirjoitus({ ...osat, nyt: T0 - AIKAIKKUNA_MS - 1 }).syy, 'aika_ikkunan_ulkona');
  assert.equal(tarkistaAllekirjoitus({ ...osat, nyt: T0 + AIKAIKKUNA_MS - 1 }).ok, true);
});

test('sama pyyntö ei kelpaa kahdesti', () => {
  const { osat } = pyynto();
  const muisti = luoNonceMuisti();
  const eka = tarkistaAllekirjoitus({ ...osat, onkoNahty: (n) => muisti.onkoNahty(n, T0) });
  assert.equal(eka.ok, true);
  muisti.merkitse(osat.nonce, T0);
  const toka = tarkistaAllekirjoitus({ ...osat, onkoNahty: (n) => muisti.onkoNahty(n, T0) });
  assert.equal(toka.syy, 'toisto');
});

test('lyhyt tai puuttuva nonce hylätään', () => {
  const { osat } = pyynto();
  assert.equal(tarkistaAllekirjoitus({ ...osat, nonce: 'lyhyt' }).syy, 'nonce_puuttuu');
  assert.equal(tarkistaAllekirjoitus({ ...osat, nonce: '' }).syy, 'nonce_puuttuu');
});

test('pakkouloskirjaus mitätöi ennen sitä sidotun laitteen', () => {
  const { osat } = pyynto();
  // Mitätöinti sidonnan JÄLKEEN: laite lakkaa kelpaamasta.
  assert.equal(tarkistaAllekirjoitus({ ...osat, mitatoityMs: T0 + 1 }).syy, 'mitatoity');
  // Mitätöinti ENNEN sidontaa: uusi sidonta on tehty sen jälkeen ja kelpaa.
  assert.equal(tarkistaAllekirjoitus({ ...osat, mitatoityMs: T0 - 1 }).ok, true);
});

test('liian vanha sidonta ei kelpaa', () => {
  const pari = avainpari();
  const laite = laitteenTietue({
    kayttaja: 'vartija1', julkinenAvain: julkinenBase64(pari), malli: 'x', nyt: T0,
  });
  const vuosi = 365 * 24 * 60 * 60 * 1000;
  const { osat } = pyynto({ pari, laite, aika: T0 + vuosi + 1000, nyt: T0 + vuosi + 1000 });
  assert.equal(tarkistaAllekirjoitus({ ...osat, ylarajaMs: vuosi }).syy, 'vanhentunut_sidonta');
});

test('tuntematon laite hylätään ennen muita tarkistuksia', () => {
  const { osat } = pyynto();
  assert.equal(tarkistaAllekirjoitus({ ...osat, laite: null }).syy, 'tuntematon_laite');
});

// --- Nonce-muisti -------------------------------------------------------------------

test('nonce unohtuu aikaikkunan jälkeen', () => {
  const muisti = luoNonceMuisti(1000);
  muisti.merkitse('abc12345', T0);
  assert.equal(muisti.onkoNahty('abc12345', T0 + 500), true);
  assert.equal(muisti.onkoNahty('abc12345', T0 + 1500), false);
  assert.equal(muisti.koko, 0);
});

// --- Sydämenlyönti ja valvonnan tila ------------------------------------------------
//
// Nämä testit kirjoitettiin sen jälkeen kun päivätesti 10.9.2026 näytti täydelliseltä
// kierrokselta, vaikka natiivipalvelu ei ollut käynnistynyt kertaakaan. Painopiste on
// siinä ETTEI valvonta näytä elävältä silloin kun se ei ole.

test('ensimmäinen lyönti kirjoitetaan levylle heti', () => {
  assert.equal(tarvitaankoLyonninTallennus({ id: 'a' }, T0), true);
});

test('lyöntejä ei kirjoiteta levylle joka minuutti', () => {
  const laite = { id: 'a', viimeinenLyontiMs: T0 };
  assert.equal(tarvitaankoLyonninTallennus(laite, T0 + 60 * 1000), false);
  assert.equal(tarvitaankoLyonninTallennus(laite, T0 + LYONTI_TALLENNUSVALI_MS - 1), false);
  assert.equal(tarvitaankoLyonninTallennus(laite, T0 + LYONTI_TALLENNUSVALI_MS), true);
});

test('tulevaisuudessa oleva lyönti korjataan heti eikä jäädytä tallennusta', () => {
  // Puhelimen tai palvelimen kello on hypännyt taaksepäin. Ilman tätä ehtoa levylle
  // jäänyt tulevaisuuden aikaleima estäisi tallennuksen siihen asti kunnes todellinen
  // aika ohittaa sen.
  assert.equal(tarvitaankoLyonninTallennus({ id: 'a', viimeinenLyontiMs: T0 + 60_000 }, T0), true);
});

test('laite jolta ei ole kuulunut mitään ei ole elossa', () => {
  const tila = valvonnanTila({ laite: { id: 'a' }, nyt: T0 });
  assert.deepEqual(tila, { viimeinenLyonti: null, valvontaElossa: false });
});

test('valvonta hiljenee kun lyöntejä ei kuulu hiljenemisrajaan asti', () => {
  const laite = { id: 'a', viimeinenLyontiMs: T0 };
  assert.equal(valvonnanTila({ laite, nyt: T0 + 60 * 1000 }).valvontaElossa, true);
  assert.equal(valvonnanTila({ laite, nyt: T0 + VALVONTA_HILJENEE_MS - 1 }).valvontaElossa, true);
  assert.equal(valvonnanTila({ laite, nyt: T0 + VALVONTA_HILJENEE_MS }).valvontaElossa, false);
});

test('muistissa oleva tuore lyönti voittaa levyn karkean', () => {
  // Muisti on tarkempi kuin levy, jolle kirjoitetaan viiden minuutin välein.
  //
  // Kun hiljenemisraja oli kolme minuuttia, muisti oli VÄLTTÄMÄTÖN: levy yksin olisi
  // näyttänyt hiljentyneeltä joka kerta kun tallennusväli ylitti rajan. Rajan noustua
  // 25 minuuttiin viisi minuuttia mahtuu siihen vaivatta, joten muisti on nyt
  // TARKKUUTTA eikä korjausta. Se kannattaa silti pitää: viimeinenLyonti näytetään
  // ihmiselle, ja viisi minuuttia vanha aikaleima herättää kysymyksiä joita tuore ei.
  //
  // Siksi tämä testi mittaa enää yhtä asiaa: tuorein voittaa, tuli se kummasta vain.
  const laite = { id: 'a', viimeinenLyontiMs: T0 };
  const nyt = T0 + VALVONTA_HILJENEE_MS + 60 * 1000;
  assert.equal(valvonnanTila({ laite, nyt }).valvontaElossa, false);
  assert.equal(valvonnanTila({ laite, muistiMs: nyt - 1000, nyt }).valvontaElossa, true);
});

test('vanhentunut muisti ei elvytä laitetta jonka levyarvo on tuoreempi', () => {
  const laite = { id: 'a', viimeinenLyontiMs: T0 + 60 * 1000 };
  const tila = valvonnanTila({ laite, muistiMs: T0, nyt: T0 + 90 * 1000 });
  assert.equal(tila.viimeinenLyonti, new Date(T0 + 60 * 1000).toISOString());
});

test('lyöntimuisti on laitekohtainen', () => {
  const muisti = luoLyontimuisti();
  muisti.merkitse('a', T0);
  assert.equal(muisti.viimeisin('a'), T0);
  assert.equal(muisti.viimeisin('b'), null);
  muisti.merkitse('b', T0 + 1);
  assert.equal(muisti.koko, 2);
  muisti.unohda('a');
  assert.equal(muisti.viimeisin('a'), null);
  assert.equal(muisti.koko, 1);
});

test('hiljenemisraja kattaa vahtikoiran välin', () => {
  // Vahtikoira lyö varttitunnin välein, ja se on lyönnin ainoa yläraja: palvelun oma
  // lyönti venyy Dozessa rajatta. Jos tämä raja alittaa vahdin välin, terve puhelin
  // ilmoitetaan kuolleeksi joka kerta kun laite nukkuu — täsmälleen se vika joka
  // mitattiin 11.9.2026 ja joka toistui neljästi puolessa tunnissa.
  assert.ok(VALVONTA_HILJENEE_MS > 15 * 60 * 1000,
    'raja on alle vahtikoiran välin, jolloin nukkuva laite näyttää kuolleelta');
});
