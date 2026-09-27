// Anastusilmoituksen (guardReports, typeId 'guard_theft') kirjoitusoikeus, 27.9.2026.
//
// Anastusilmoituksessa on anastajan henkilötunnus, joten se on oman solmunsa
// (guard_report_theft) takana. Tämä testi varmistaa kumpaankin suuntaan, ettei
// toimenpidekirjausoikeus avaa anastusilmoitusta eikä anastusoikeus muita raportteja.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_BUCKET, authorizeWrite } from './permissions.js';

const oikeudet = (...solmut) => ({
  [DEFAULT_BUCKET]: Object.fromEntries(solmut.map((s) => [s, { view: true, edit: true }])),
});

const raportti = (typeId) => ({ id: `r-${typeId}`, siteId: 'k1', typeId, description: 'x' });

const kirjoita = (perms, typeId) =>
  authorizeWrite('user', perms, [], 'guardReports', [], [raportti(typeId)]).ok;

test('anastusilmoitus vaatii guard_report_theft-oikeuden', () => {
  assert.equal(kirjoita(oikeudet('guard_report_theft'), 'guard_theft'), true);
  assert.equal(kirjoita(oikeudet('guard_report_action', 'guard_report_jv'), 'guard_theft'), false);
});

test('anastusoikeus ei avaa toimenpidettä eikä tapahtumailmoitusta', () => {
  assert.equal(kirjoita(oikeudet('guard_report_theft'), 'guard_action'), false);
  assert.equal(kirjoita(oikeudet('guard_report_theft'), 'guard_jvreport'), false);
  assert.equal(kirjoita(oikeudet('guard_report_action'), 'guard_action'), true);
});
