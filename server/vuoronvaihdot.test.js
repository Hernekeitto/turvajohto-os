// Vuoronvaihtojen tilakoneen testit (erä 6).
//
// Ajetaan: node --test server/vuoronvaihdot.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { onAvoin, peruVaihto, pyydaVaihto, ratkaiseVaihto, suljeVanhentuneet, vastaaVaihtoon } from './vuoronvaihdot.js';

const VUORO = { vuoroId: 'k1:v1:2026-10-30:1', listanAlku: '2026-10-26', alkaa: '2026-10-30T06:00' };
const NYT = '2026-10-20T12:00';

const pyynto = (yli = {}) => pyydaVaihto({
  vaihdot: [], vuoro: VUORO, antaja: 'virtanen', saaja: 'nieminen', nytPaikallinen: NYT, id: 'x1', ...yli,
});

test('pyyntö: kelvollinen', () => {
  const p = pyynto({ viesti: ' lapsen synttärit ' });
  assert.equal(p.ok, true);
  assert.equal(p.vaihto.tila, 'odottaa_saajaa');
  assert.equal(p.vaihto.viesti, 'lapsen synttärit');
  assert.equal(p.vaihto.historia.length, 1);
});

test('pyyntö: hylätään', () => {
  assert.equal(pyynto({ vuoro: null }).ok, false);
  assert.equal(pyynto({ saaja: 'virtanen' }).ok, false);
  assert.equal(pyynto({ saaja: '' }).ok, false);
  assert.equal(pyynto({ nytPaikallinen: '2026-10-30T06:00' }).ok, false);
  assert.equal(pyynto({ vaihdot: [pyynto().vaihto] }).ok, false);
  assert.equal(pyynto({ viesti: 'x'.repeat(301) }).ok, false);
});

test('pyyntö: peruttu pyyntö ei estä uutta', () => {
  const vanha = { ...pyynto().vaihto, tila: 'peruttu' };
  assert.equal(pyynto({ vaihdot: [vanha] }).ok, true);
});

test('kulku: saaja hyväksyy, suunnittelija vahvistaa', () => {
  const v1 = pyynto().vaihto;
  const v2 = vastaaVaihtoon({ vaihto: v1, kuka: 'nieminen', hyvaksy: true, nytPaikallinen: NYT });
  assert.equal(v2.vaihto.tila, 'odottaa_suunnittelijaa');
  const v3 = ratkaiseVaihto({ vaihto: v2.vaihto, kuka: 'suunnittelija', hyvaksy: true });
  assert.equal(v3.vaihto.tila, 'hyvaksytty');
  assert.deepEqual(v3.vaihto.historia.map((h) => h.mita), ['pyydetty', 'saaja_hyvaksyi', 'vahvistettu']);
  assert.equal(onAvoin(v3.vaihto), false);
});

test('kulku: vain saaja vastaa, kerran', () => {
  const v1 = pyynto().vaihto;
  assert.equal(vastaaVaihtoon({ vaihto: v1, kuka: 'virtanen', hyvaksy: true, nytPaikallinen: NYT }).status, 403);
  const hylatty = vastaaVaihtoon({ vaihto: v1, kuka: 'nieminen', hyvaksy: false, nytPaikallinen: NYT }).vaihto;
  assert.equal(hylatty.tila, 'hylatty');
  assert.equal(vastaaVaihtoon({ vaihto: hylatty, kuka: 'nieminen', hyvaksy: true, nytPaikallinen: NYT }).status, 409);
});

test('kulku: suunnittelija ei ratkaise ennen saajaa', () => {
  assert.equal(ratkaiseVaihto({ vaihto: pyynto().vaihto, kuka: 's', hyvaksy: true }).ok, false);
});

test('peruminen: vain antaja ja vain avoimena', () => {
  const v1 = pyynto().vaihto;
  assert.equal(peruVaihto({ vaihto: v1, kuka: 'nieminen' }).status, 403);
  const p = peruVaihto({ vaihto: v1, kuka: 'virtanen' });
  assert.equal(p.vaihto.tila, 'peruttu');
  assert.equal(peruVaihto({ vaihto: p.vaihto, kuka: 'virtanen' }).status, 409);
});

test('vanhentuneet: alkanut vuoro ja muuttunut lista suljetaan', () => {
  const avoin = pyynto().vaihto;
  const ok = suljeVanhentuneet([avoin], { nytPaikallinen: NYT, omistaja: () => 'virtanen' });
  assert.equal(ok.muuttui, false);
  const alkoi = suljeVanhentuneet([avoin], { nytPaikallinen: '2026-10-30T07:00', omistaja: () => 'virtanen' });
  assert.equal(alkoi.vaihdot[0].tila, 'peruttu');
  assert.equal(alkoi.vaihdot[0].historia.at(-1).mita, 'vuoro_alkoi');
  const muuttui = suljeVanhentuneet([avoin], { nytPaikallinen: NYT, omistaja: () => 'joku' });
  assert.equal(muuttui.vaihdot[0].historia.at(-1).mita, 'lista_muuttui');
});
