// GUARD-puolen liitteiden lukuoikeus ja kierroksen liitteiden puhdistus (27.9.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_BUCKET, canReadGuardAttachment } from './permissions.js';
import { paataKierros, puhdistaLiitteet } from './kierros.js';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e.jpg';

const oikeudet = (...solmut) => ({
  [DEFAULT_BUCKET]: Object.fromEntries(solmut.map((s) => [s, { view: true, edit: false }])),
});

const lue = (perms, { raportit = [], suoritukset = [], kierrokset = [] } = {}) =>
  canReadGuardAttachment('user', perms, [], ID, [], raportit, [], [], suoritukset, kierrokset);

test('raportin attachments[]-liite aukeaa raporttioikeudella', () => {
  const raportit = [{ id: 'r', siteId: 'k1', typeId: 'guard_theft', attachments: [{ id: ID }] }];
  assert.equal(lue(oikeudet('guard_report_theft'), { raportit }), true);
  assert.equal(lue(oikeudet('guard_tasks'), { raportit }), false);
});

test('tehtäväsuorituksen kuva aukeaa tehtäväoikeudella', () => {
  const suoritukset = [{ id: 's', siteId: 'k1', liitteet: [{ id: ID }] }];
  assert.equal(lue(oikeudet('guard_tasks'), { suoritukset }), true);
  assert.equal(lue(oikeudet('guard_patrols'), { suoritukset }), false);
});

test('kierroksen kuva aukeaa kierrosoikeudella', () => {
  const kierrokset = [{ id: 'k', siteId: 'k1', liitteet: [{ id: ID }] }];
  assert.equal(lue(oikeudet('guard_patrols'), { kierrokset }), true);
  assert.equal(lue(oikeudet('guard_tasks'), { kierrokset }), false);
});

test('liitteiden puhdistus hylkää polkumaiset tunnisteet ja rajaa määrän', () => {
  assert.deepEqual(puhdistaLiitteet([{ id: '../../etc/passwd' }, { id: ID, name: 'kuva.jpg', x: 1 }]),
    [{ id: ID, name: 'kuva.jpg' }]);
  assert.equal(puhdistaLiitteet(Array.from({ length: 15 }, () => ({ id: ID }))).length, 10);
  assert.deepEqual(puhdistaLiitteet('ei lista'), []);
});

test('kierroksen päätös tallentaa liitteet', () => {
  const kierros = { id: 'k', siteId: 'k1', tila: 'kesken', pisteet: [] };
  const tulos = paataKierros({ kierros, tila: 'valmis', liitteet: [{ id: ID, name: 'a.jpg' }] });
  assert.equal(tulos.ok, true);
  assert.deepEqual(tulos.kierros.liitteet, [{ id: ID, name: 'a.jpg' }]);
});
