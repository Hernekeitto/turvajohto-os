// PTT-viestinäkymän puhtaan logiikan testit (erä 26, vaihe 5, viipale 5b).
//
// Ajetaan: node --test src/guard/mobiili/viestinakyma.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  yhdistaViestit, kuittaustiivistelma, paattelePaattyyppi, onLiite,
} from './viestinakyma.ts';
import type { Viesti } from '../../shared/viestit.ts';
import type { JonoRivi } from '../../shared/viestijono.ts';

test('yhdistaViestit järjestää palvelimen viestit ja jonorivit aikajärjestykseen', () => {
  const viestit: Viesti[] = [
    { id: 'v1', lahettaja: 'vartija1', luotu: '2026-09-20T10:00:00.000Z', sisalto: { msgtype: 'm.text', body: 'eka' }, kuittaukset: [] },
  ];
  const jono: JonoRivi[] = [
    { id: 'j1', kanavaId: 'k1', teksti: 'kolmas', luotu: new Date('2026-09-20T10:10:00.000Z').getTime(), yrityksia: 0 },
  ];
  const tulos = yhdistaViestit(viestit, jono, 'k1');
  assert.equal(tulos.length, 2);
  assert.equal(tulos[0].tila, 'lahetetty');
  assert.equal(tulos[1].tila, 'jonossa');
});

test('yhdistaViestit jättää pois toisen kanavan jonorivit', () => {
  const jono: JonoRivi[] = [
    { id: 'j1', kanavaId: 'toinen', teksti: 'x', luotu: Date.now(), yrityksia: 0 },
  ];
  const tulos = yhdistaViestit([], jono, 'k1');
  assert.deepEqual(tulos, []);
});

test('yhdistaViestit säilyttää oikean järjestyksen kun jonorivi on vanhin', () => {
  const viestit: Viesti[] = [
    { id: 'v1', lahettaja: 'vartija1', luotu: '2026-09-20T10:10:00.000Z', sisalto: null, kuittaukset: [] },
  ];
  const jono: JonoRivi[] = [
    { id: 'j1', kanavaId: 'k1', teksti: 'vanhin', luotu: new Date('2026-09-20T09:00:00.000Z').getTime(), yrityksia: 0 },
  ];
  const tulos = yhdistaViestit(viestit, jono, 'k1');
  assert.equal(tulos[0].tila, 'jonossa');
  assert.equal(tulos[1].tila, 'lahetetty');
});

test('kuittaustiivistelma laskee toimitus- ja lukukuittaukset hätäkanavalla', () => {
  const kuittaukset = [
    { kayttaja: 'a', tyyppi: 'toimitus' as const, aika: '' },
    { kayttaja: 'b', tyyppi: 'toimitus' as const, aika: '' },
    { kayttaja: 'a', tyyppi: 'luku' as const, aika: '' },
  ];
  assert.deepEqual(kuittaustiivistelma(kuittaukset, 'hata'), { toimitettu: 2, luettu: 1 });
});

test('kuittaustiivistelma palauttaa luettu-arvoksi null kanaville joilla lukukuittausta ei ole', () => {
  const kuittaukset = [{ kayttaja: 'a', tyyppi: 'toimitus' as const, aika: '' }];
  assert.deepEqual(kuittaustiivistelma(kuittaukset, 'kohde'), { toimitettu: 1, luettu: null });
  assert.deepEqual(kuittaustiivistelma(kuittaukset, 'dm'), { toimitettu: 1, luettu: null });
  assert.deepEqual(kuittaustiivistelma(kuittaukset, 'vapaa'), { toimitettu: 1, luettu: null });
});

test('paattelePaattyyppi tunnistaa kuvan, videon ja muun tiedoston', () => {
  assert.equal(paattelePaattyyppi('image/png'), 'm.image');
  assert.equal(paattelePaattyyppi('video/mp4'), 'm.video');
  assert.equal(paattelePaattyyppi('application/pdf'), 'm.file');
  assert.equal(paattelePaattyyppi(''), 'm.file');
});

test('onLiite erottaa liiteosoittimen tekstisisällöstä', () => {
  assert.equal(onLiite({ msgtype: 'm.text', body: 'hei' }), false);
  assert.equal(onLiite({ msgtype: 'm.image', liiteId: 'x', avain: 'a', iv: 'b', mimetype: 'image/png', koko: 1 }), true);
  assert.equal(onLiite(null), false);
  assert.equal(onLiite(undefined), false);
  assert.equal(onLiite('teksti'), false);
});
