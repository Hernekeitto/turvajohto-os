// Kohteen tiedostojen näkyvyys ja jako (28.9.2026).
//
// "Vain ylläpidolle" -tiedosto ei saa näkyä eikä latautua vartijalle, jolla on kohteeseen
// vain katseluoikeus. Nimellä jaettu tiedosto aukeaa vastaanottajalle ilman kohteen
// oikeuksia, mutta ei kenellekään muulle.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_BUCKET, readableData, canReadGuardAttachment, jaettuKohteenTiedostoMinulle,
} from './permissions.js';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e.pdf';

const vartija = { [DEFAULT_BUCKET]: { guard_sites: { view: true, edit: false } } };
const esimies = { [DEFAULT_BUCKET]: { guard_sites: { view: true, edit: true } } };

const tiedostot = [
  { id: 'a', siteId: 'k1', name: 'Vartio-ohje.pdf', uploadId: 'x' },
  { id: 'b', siteId: 'k1', name: 'Sopimus.pdf', uploadId: ID, vainYllapito: true },
];

test('vain ylläpidolle -tiedosto ei näy vartijalle mutta näkyy esimiehelle', () => {
  assert.deepEqual(readableData('user', vartija, [], 'guardFiles', tiedostot).data.map((t) => t.id), ['a']);
  assert.deepEqual(readableData('user', esimies, [], 'guardFiles', tiedostot).data.map((t) => t.id), ['a', 'b']);
});

test('vain ylläpidolle -tiedosto ei myöskään lataudu vartijalle', () => {
  const lue = (perms) => canReadGuardAttachment('user', perms, [], ID, tiedostot);
  assert.equal(lue(vartija), false);
  assert.equal(lue(esimies), true);
});

test('kohteen tiedostojen jaot näkyvät vain kohteen muokkausoikeudella', () => {
  const jaot = [
    { id: 's1', lahde: 'guardFiles', eventId: 'k1', targetId: 'a' },
    { id: 's2', eventId: 'e1', targetId: 'z' },
  ];
  assert.deepEqual(readableData('user', vartija, [], 'fileShares', jaot).data, []);
  assert.deepEqual(readableData('user', esimies, [], 'fileShares', jaot).data.map((j) => j.id), ['s1']);
});

test('nimellä jaettu kohteen tiedosto aukeaa vain vastaanottajalle', () => {
  const jako = { lahde: 'guardFiles', mode: 'users', targetId: 'b', allowedUsernames: ['liisa'], revokedAt: null };
  assert.equal(jaettuKohteenTiedostoMinulle('liisa', ID, tiedostot, [jako]), true);
  assert.equal(jaettuKohteenTiedostoMinulle('pekka', ID, tiedostot, [jako]), false);
  assert.equal(jaettuKohteenTiedostoMinulle('liisa', ID, tiedostot, [{ ...jako, revokedAt: '2026-09-28' }]), false);
  assert.equal(jaettuKohteenTiedostoMinulle('liisa', ID, tiedostot, [{ ...jako, expiresAt: '2000-01-01' }]), false);
  // Tapahtuman tiedoston jako samalla targetId:llä ei avaa kohteen tiedostoa.
  assert.equal(jaettuKohteenTiedostoMinulle('liisa', ID, tiedostot, [{ ...jako, lahde: undefined }]), false);
});
