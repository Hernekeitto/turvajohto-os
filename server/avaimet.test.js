// Avainhallinnan ja varustepoikkeamien testit.
//
// Avainrekisterin koko arvo on siinä, että se kertoo TOTUUDEN siitä kenellä avain on.
// Testit kohdistuvat niihin siirtymiin joissa totuus voisi kadota: kahdesti luovutettu
// avain, kadonneen avaimen kierrätys takaisin hyllyyn ilman merkintää, historian
// muokkaus.
//
// Ajetaan: node --test server/avaimet.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  luoAvain, luovuta, palauta, merkitseKadonneeksi, merkitseLoytyneeksi, poistaKaytosta,
  ulkonaOlevat, kadonneet,
} from './avaimet.js';
import {
  luoPoikkeama, kasittele, avaaUudelleen, eskaloituu, avoimet, halytyksenKuvaus,
} from './varusteet.js';

const T0 = Date.parse('2026-09-03T18:00:00Z');

const avain = (yli = {}) => luoAvain({
  id: 'a1', ownerId: 'kohde-1', omistaja: 'kohde', tunnus: 'A-12 pääovi',
  kuvaus: 'Yleisavain', user: 'esimies', nyt: T0, ...yli,
}).avain;

// --- Avaimen luonti ---------------------------------------------------------------

test('avain syntyy hyllyyn ja historia alkaa luonnista', () => {
  const a = avain();
  assert.equal(a.tila, 'hyllyssa');
  assert.equal(a.haltija, null);
  assert.equal(a.historia.length, 1);
  assert.equal(a.historia[0].tapahtuma, 'luotu');
});

test('tunnukseton avain torjutaan', () => {
  assert.equal(luoAvain({ id: 'x', tunnus: '   ' }).ok, false);
});

// --- Luovutus ja palautus ---------------------------------------------------------

test('luovutus kirjaa haltijan ja ajan', () => {
  const tulos = luovuta({ avain: avain(), haltija: 'Virtanen', user: 'esimies', huomio: 'Yövuoro', nyt: T0 });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.avain.tila, 'ulkona');
  assert.equal(tulos.avain.haltija, 'Virtanen');
  assert.equal(tulos.avain.historia.at(-1).tapahtuma, 'luovutus');
  assert.equal(tulos.avain.historia.at(-1).teksti, 'Yövuoro');
});

test('samaa avainta ei voi luovuttaa kahdelle', () => {
  const ulkona = luovuta({ avain: avain(), haltija: 'Virtanen', user: 'e', nyt: T0 }).avain;
  const toinen = luovuta({ avain: ulkona, haltija: 'Korhonen', user: 'e', nyt: T0 });
  assert.equal(toinen.ok, false);
  assert.match(toinen.error, /Virtanen/);
});

test('nimetön haltija torjutaan', () => {
  assert.equal(luovuta({ avain: avain(), haltija: 'X', user: 'e' }).ok, false);
});

test('palautus tyhjentää haltijan mutta jättää historian', () => {
  const ulkona = luovuta({ avain: avain(), haltija: 'Virtanen', user: 'e', nyt: T0 }).avain;
  const palautettu = palauta({ avain: ulkona, user: 'e', nyt: T0 + 3600000 }).avain;
  assert.equal(palautettu.tila, 'hyllyssa');
  assert.equal(palautettu.haltija, null);
  assert.equal(palautettu.historia.length, 3);
  assert.equal(palautettu.historia.at(-1).haltija, 'Virtanen');
});

test('hyllyssä olevaa ei voi palauttaa', () => {
  assert.equal(palauta({ avain: avain(), user: 'e' }).ok, false);
});

// --- Katoaminen -------------------------------------------------------------------

test('katoaminen vaatii syyn ja säilyttää haltijan', () => {
  const ulkona = luovuta({ avain: avain(), haltija: 'Virtanen', user: 'e', nyt: T0 }).avain;
  assert.equal(merkitseKadonneeksi({ avain: ulkona, user: 'e', syy: 'x' }).ok, false);
  const kadonnut = merkitseKadonneeksi({ avain: ulkona, user: 'e', syy: 'Jäi taksiin', nyt: T0 }).avain;
  assert.equal(kadonnut.tila, 'kadonnut');
  assert.equal(kadonnut.haltija, 'Virtanen');
  assert.equal(kadonnut.historia.at(-1).teksti, 'Jäi taksiin');
});

test('kadonnutta ei voi luovuttaa ennen kuin se on löytynyt', () => {
  const kadonnut = merkitseKadonneeksi({ avain: avain(), user: 'e', syy: 'Ei löydy hyllystä', nyt: T0 }).avain;
  assert.equal(luovuta({ avain: kadonnut, haltija: 'Korhonen', user: 'e' }).ok, false);

  const loytyi = merkitseLoytyneeksi({ avain: kadonnut, user: 'e', huomio: 'Oli väärässä laatikossa', nyt: T0 }).avain;
  assert.equal(loytyi.tila, 'hyllyssa');
  // Katoaminen jää historiaan: se on tapahtunut vaikka avain löytyikin.
  assert.equal(loytyi.historia.some((h) => h.tapahtuma === 'kadonnut'), true);
  assert.equal(luovuta({ avain: loytyi, haltija: 'Korhonen', user: 'e', nyt: T0 }).ok, true);
});

test('käytöstä poistettu avain on umpikuja', () => {
  const poistettu = poistaKaytosta({ avain: avain(), user: 'e', syy: 'Lukitus vaihdettu', nyt: T0 }).avain;
  assert.equal(poistettu.tila, 'poistettu');
  assert.equal(luovuta({ avain: poistettu, haltija: 'Virtanen', user: 'e' }).ok, false);
  assert.equal(merkitseKadonneeksi({ avain: poistettu, user: 'e', syy: 'jotain' }).ok, false);
});

test('siirtymä ei muuta alkuperäistä tietuetta', () => {
  const a = avain();
  const kopio = JSON.parse(JSON.stringify(a));
  luovuta({ avain: a, haltija: 'Virtanen', user: 'e', nyt: T0 });
  assert.deepEqual(a, kopio);
});

test('koosteet kertovat mitkä avaimet ovat ulkona ja kadonneet', () => {
  const ulkona = luovuta({ avain: avain({ id: 'a1' }), haltija: 'Virtanen', user: 'e', nyt: T0 }).avain;
  const kadonnut = merkitseKadonneeksi({ avain: avain({ id: 'a2' }), user: 'e', syy: 'Ei löydy', nyt: T0 }).avain;
  const lista = [ulkona, kadonnut, avain({ id: 'a3' })];
  assert.deepEqual(ulkonaOlevat(lista).map((a) => a.id), ['a1']);
  assert.deepEqual(kadonneet(lista).map((a) => a.id), ['a2']);
});

// --- Varustepoikkeamat ------------------------------------------------------------

const poikkeama = (yli = {}) => luoPoikkeama({
  id: 'p1', ownerId: 'kohde-1', omistaja: 'kohde', varuste: 'Radiopuhelin 3',
  kuvaus: 'Ei lataudu', ilmoittaja: 'vartija1', nyt: T0, ...yli,
}).poikkeama;

test('poikkeama syntyy avoimena ja normaalina', () => {
  const p = poikkeama();
  assert.equal(p.tila, 'avoin');
  assert.equal(p.vakavuus, 'normaali');
  assert.equal(eskaloituu(p), false);
});

test('kriittinen poikkeama eskaloituu', () => {
  const p = poikkeama({ vakavuus: 'kriittinen' });
  assert.equal(eskaloituu(p), true);
  assert.equal(halytyksenKuvaus(p), 'Varuste rikki: Radiopuhelin 3');
});

test('tuntematon vakavuus tulkitaan normaaliksi eikä kriittiseksi', () => {
  // Väärinpäin tulkinta tekisi jokaisesta kirjoitusvirheestä tekstiviestin.
  assert.equal(poikkeama({ vakavuus: 'KRIITTINEN!!' }).vakavuus, 'normaali');
});

test('varusteeton tai kuvaukseton poikkeama torjutaan', () => {
  assert.equal(luoPoikkeama({ id: 'x', varuste: 'a', kuvaus: 'Rikki', ilmoittaja: 'v' }).ok, false);
  assert.equal(luoPoikkeama({ id: 'x', varuste: 'Radio', kuvaus: '', ilmoittaja: 'v' }).ok, false);
  assert.equal(luoPoikkeama({ id: 'x', varuste: 'Radio', kuvaus: 'Rikki', ilmoittaja: '' }).ok, false);
});

test('käsittely kirjaa kuka ja milloin, eikä kahdesti', () => {
  const tulos = kasittele({ poikkeama: poikkeama(), tila: 'korjattu', user: 'esimies', huomio: 'Uusi akku', nyt: T0 });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.poikkeama.kasittelija, 'esimies');
  assert.equal(tulos.poikkeama.kasittelyHuomio, 'Uusi akku');
  assert.equal(kasittele({ poikkeama: tulos.poikkeama, tila: 'poistettu', user: 'e' }).ok, false);
});

test('tuntematon käsittelytila torjutaan', () => {
  assert.equal(kasittele({ poikkeama: poikkeama(), tila: 'melkein', user: 'e' }).ok, false);
});

test('uudelleenavaus tekee uuden tietueen eikä muuta vanhaa', () => {
  const korjattu = kasittele({ poikkeama: poikkeama(), tila: 'korjattu', user: 'e', nyt: T0 }).poikkeama;
  const uusi = avaaUudelleen({ poikkeama: korjattu, id: 'p2', ilmoittaja: 'vartija2', kuvaus: 'Sama vika uudestaan', nyt: T0 });
  assert.equal(uusi.ok, true);
  assert.equal(uusi.poikkeama.id, 'p2');
  assert.equal(uusi.poikkeama.tila, 'avoin');
  assert.equal(uusi.poikkeama.varuste, 'Radiopuhelin 3');
  assert.equal(korjattu.tila, 'korjattu');
});

test('avoimet suodattaa käsitellyt pois', () => {
  const korjattu = kasittele({ poikkeama: poikkeama({ id: 'p1' }), tila: 'korjattu', user: 'e', nyt: T0 }).poikkeama;
  assert.deepEqual(avoimet([korjattu, poikkeama({ id: 'p2' })]).map((p) => p.id), ['p2']);
});
