// Mikroraportin (guardReports, typeId 'guard_micro') kirjoitusoikeus, 2.10.2026.
//
// Mikroraportti on oman solmunsa (guard_report_micro) takana: kevyen kirjauksen voi antaa
// tunnukselle jolla ei ole toimenpidekirjausta, eikä se saa avata muita raporttityyppejä.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_BUCKET, authorizeWrite } from './permissions.js';

const oikeudet = (...solmut) => ({
  [DEFAULT_BUCKET]: Object.fromEntries(solmut.map((s) => [s, { view: true, edit: true }])),
});

const raportti = (typeId) => ({ id: `r-${typeId}`, siteId: 'k1', typeId, description: 'x' });

const kirjoita = (perms, typeId) =>
  authorizeWrite('user', perms, [], 'guardReports', [], [raportti(typeId)]).ok;

test('mikroraportti vaatii guard_report_micro-oikeuden', () => {
  assert.equal(kirjoita(oikeudet('guard_report_micro'), 'guard_micro'), true);
  assert.equal(kirjoita(oikeudet('guard_report_action', 'guard_report_jv', 'guard_report_theft'), 'guard_micro'), false);
});

test('mikroraporttioikeus ei avaa muita raporttityyppejä', () => {
  for (const tyyppi of ['guard_action', 'guard_jvreport', 'guard_theft']) {
    assert.equal(kirjoita(oikeudet('guard_report_micro'), tyyppi), false, tyyppi);
  }
});
