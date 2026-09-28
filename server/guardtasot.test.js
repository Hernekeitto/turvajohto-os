// Sisäänrakennettujen GUARD-tasojen oikeusmigraatio (28.9.2026).
//
// Olemassa olevalle Vartija-tasolle lisätään Vartijanäkymän toimintojen solmut KERRAN,
// eikä pääkäyttäjän tekemiä rajauksia tai esimiehen kohteen hallintaa kosketa.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATA_DIR ||= '.';
const { paivitaGuardTaso } = await import('./roles.js');
const { DEFAULT_BUCKET } = await import('./permissions.js');

const vanhaVartija = {
  id: 'vartija',
  name: 'Vartija',
  permissions: {
    [DEFAULT_BUCKET]: {
      guard_sites: { view: true, edit: false },
      guard_tasks: { view: true, edit: true },
      // Pääkäyttäjä on ottanut tapahtumailmoituksen pois: rajaus säilyy.
      guard_report_jv: { view: false, edit: false },
    },
  },
};

test('puuttuvat Vartijanäkymän solmut lisätään', () => {
  const b = paivitaGuardTaso(vanhaVartija).permissions[DEFAULT_BUCKET];
  assert.deepEqual(b.guard_patrols, { view: true, edit: true });
  assert.deepEqual(b.guard_report_theft, { view: true, edit: true });
  assert.deepEqual(b.guard_plays, { view: true, edit: false });
  assert.deepEqual(b.guard_guides, { view: true, edit: false });
  assert.deepEqual(b.guard_broadcast, { view: true, edit: false });
  assert.deepEqual(b.guard_ptt, { view: true, edit: false });
});

test('olemassa olevaan merkintään ei kosketa', () => {
  const b = paivitaGuardTaso(vanhaVartija).permissions[DEFAULT_BUCKET];
  assert.deepEqual(b.guard_report_jv, { view: false, edit: false });
  assert.deepEqual(b.guard_sites, { view: true, edit: false });
  const esimies = paivitaGuardTaso({ ...vanhaVartija, id: 'vartioesimies', permissions: { [DEFAULT_BUCKET]: { guard_sites: { view: true, edit: true } } } });
  assert.deepEqual(esimies.permissions[DEFAULT_BUCKET].guard_sites, { view: true, edit: true });
});

test('migraatio ajetaan kerran eikä koske muihin tasoihin', () => {
  const kerran = paivitaGuardTaso(vanhaVartija);
  assert.equal(kerran.oikeusversio, 3);
  // Pääkäyttäjä poistaa myöhemmin kierroksen: seuraava ajo ei palauta sitä.
  const rajattu = { ...kerran, permissions: { [DEFAULT_BUCKET]: { guard_sites: { view: true, edit: false } } } };
  assert.equal(paivitaGuardTaso(rajattu), rajattu);
  const muu = { id: 'basic', permissions: {} };
  assert.equal(paivitaGuardTaso(muu), muu);
});

test('versio 3: Vartija-tasolta poistetaan Kohteen tiedot ja Raportointi, esimieheltä ei', () => {
  const v2 = (id) => ({
    id, oikeusversio: 2,
    permissions: { [DEFAULT_BUCKET]: {
      guard_sites: { view: true, edit: false },
      guard_site_info: { view: true, edit: false },
      guard_reporting: { view: true, edit: false },
    } },
  });
  const vartija = paivitaGuardTaso(v2('vartija')).permissions[DEFAULT_BUCKET];
  assert.equal('guard_site_info' in vartija, false);
  assert.equal('guard_reporting' in vartija, false);
  assert.deepEqual(vartija.guard_sites, { view: true, edit: false });
  const esimies = paivitaGuardTaso(v2('vartioesimies')).permissions[DEFAULT_BUCKET];
  assert.deepEqual(esimies.guard_site_info, { view: true, edit: false });
  assert.deepEqual(esimies.guard_reporting, { view: true, edit: false });
});
