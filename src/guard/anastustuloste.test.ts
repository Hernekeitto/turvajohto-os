import { test } from 'node:test';
import assert from 'node:assert/strict';

import { anastustulosteHtml, peitaHetu } from './anastustuloste.ts';
import type { GuardRaportti } from './tyypit.ts';

const raportti: GuardRaportti = {
  id: 'abcdef12-3456', siteId: 'k1', typeId: 'guard_theft', type: 'Anastusilmoitus',
  author: 'Vartija V', date: '2026-09-27', time: '14:00', place: 'Kauppa <Itä>',
  description: 'Piilotti tuotteet laukkuun.',
  subjectLastName: 'Testinen', subjectFirstNames: 'Teppo', subjectPersonalId: '010190-123A',
  theftClaimant: 'Kauppa Oy', theftPenaltyOrderConsent: true, theftAt: '2026-09-27T14:00',
  theftItems: [{ id: '1', nimi: 'Terät', hinta: 12.55, alv: 25.5 }],
  theftOtherCosts: [{ id: 'k', selite: 'Selvityskulut', summa: 60 }],
};

test('henkilötunnuksen peitto jättää syntymäajan', () => {
  assert.equal(peitaHetu('010190-123A'), '010190-****');
  assert.equal(peitaHetu('jotain muuta'), '••••••••••');
  assert.equal(peitaHetu(''), '');
});

test('poliisin kappaleessa koko hetu, kauppiaan kappaleessa peitetty', () => {
  const poliisi = anastustulosteHtml(raportti, 'poliisi');
  const kauppias = anastustulosteHtml(raportti, 'kauppias');
  assert.ok(poliisi.includes('010190-123A'));
  assert.ok(!kauppias.includes('010190-123A'));
  assert.ok(kauppias.includes('010190-****'));
});

test('summat ja käyttäjän tekstin escapetus', () => {
  const html = anastustulosteHtml(raportti, 'poliisi');
  // 12,55 € sis. ALV 25,5 % = 10,00 € ALV 0; + 60 € = 70,00 €.
  assert.match(html, /10,00\s€/);
  assert.match(html, /70,00\s€/);
  assert.ok(html.includes('Kauppa &lt;Itä&gt;'));
  assert.ok(!html.includes('Kauppa <Itä>'));
});
