// Istunnon keston testit.
//
// Painopiste on siinä ETTEI SELAINISTUNTO VAHINGOSSA MUUTU RAJOITTAMATTOMAKSI.
// Rajoittamattomuus on sovelluksen ominaisuus jonka vastapainona on laitteen lukitus
// (ks. istunto.js) — selaimessa sitä vastapainoa ei ole, eikä muutos näkyisi missään:
// pidempi istunto ei riko mitään eikä kaada testiä ellei sitä testata erikseen.
//
// Ajetaan: node --test server/istunto.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  istunnonKesto, ADMIN_TUNNIT, SELAIN_MINUUTIT, SOVELLUS_VUOROKAUDET,
} from './istunto.js';

test('selaimessa muu käyttäjä saa liukuvan tunnin', () => {
  assert.equal(istunnonKesto({ role: 'user' }), SELAIN_MINUUTIT * 60);
});

test('selaimessa pääkäyttäjä saa 12 tuntia', () => {
  assert.equal(istunnonKesto({ role: 'admin' }), ADMIN_TUNNIT * 60 * 60);
});

test('asennetussa sovelluksessa istuntoa ei rajoiteta', () => {
  const kesto = istunnonKesto({ role: 'user', sovellus: true });
  assert.equal(kesto, SOVELLUS_VUOROKAUDET * 24 * 60 * 60);
  // Vuoro, viikko ja kuukauden loma eivät katkaise istuntoa.
  assert.ok(kesto > 30 * 24 * 60 * 60);
});

test('sovellus ohittaa roolin: myös pääkäyttäjä saa saman keston', () => {
  assert.equal(
    istunnonKesto({ role: 'admin', sovellus: true }),
    istunnonKesto({ role: 'user', sovellus: true })
  );
});

// Puuttuva tai epämääräinen tieto EI saa johtaa rajoittamattomaan istuntoon: jos
// kirjautumispyynnöstä puuttuu kenttä tai se on jotain muuta kuin true, kyse on
// selaimesta. Tämä on se kohta jossa oletuksen suunta ratkaisee.
test('ilman tietoa asennuksesta oletus on selain', () => {
  const selain = istunnonKesto({ role: 'user' });
  assert.equal(istunnonKesto({}), selain);
  assert.equal(istunnonKesto(), selain);
  assert.equal(istunnonKesto({ role: 'user', sovellus: false }), selain);
  assert.equal(istunnonKesto({ role: 'user', sovellus: undefined }), selain);
});

test('kesto on sekunteja eikä millisekunteja', () => {
  // Sama arvo menee sekä JWT:n expiresIn-kenttään että evästeen maxAgeen, ja
  // kumpikin odottaa sekunteja. Millisekunneiksi vaihtunut yksikkö tekisi tunnin
  // istunnosta 41 vuorokauden istunnon huomaamatta.
  assert.equal(istunnonKesto({ role: 'user' }), 3600);
});
