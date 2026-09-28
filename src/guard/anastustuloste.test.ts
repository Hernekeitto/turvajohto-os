import { test } from 'node:test';
import assert from 'node:assert/strict';

import { anastustulosteHtml } from './anastustuloste.ts';
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

test('molemmissa kappaleissa koko hetu, kappale merkitty alatunnisteeseen', () => {
  const poliisi = anastustulosteHtml(raportti, 'poliisi');
  const kauppias = anastustulosteHtml(raportti, 'kauppias');
  assert.ok(poliisi.includes('010190-123A'));
  assert.ok(kauppias.includes('010190-123A'));
  assert.ok(poliisi.includes('Poliisin kappale'));
  assert.ok(kauppias.includes('Kauppiaan kappale'));
});

test('summat ja käyttäjän tekstin escapetus', () => {
  const html = anastustulosteHtml(raportti, 'poliisi');
  // 12,55 € sis. ALV 25,5 % = 10,00 € ALV 0; + 60 € = 70,00 €.
  assert.match(html, /10,00\s€/);
  assert.match(html, /70,00\s€/);
  assert.ok(html.includes('Kauppa &lt;Itä&gt;'));
  assert.ok(!html.includes('Kauppa <Itä>'));
});

test('paperipohjan kentät: kappaleet, tila, menettelyt ja ei korvausvaatimusta', () => {
  const html = anastustulosteHtml({
    ...raportti,
    theftItems: [{ id: '1', nimi: 'Terät', hinta: 12.55, alv: 25.5, kpl: 2, tila: 'turmeltunut' }],
    theftWrittenProcedureConsent: false,
    theftIdVerified: 'ajokortti',
    theftDetentionPlace: 'Pääovi',
    theftClaimsCompensation: false,
  }, 'poliisi');
  assert.match(html, /25,10\s€/);            // 2 × 12,55
  assert.ok(html.includes('Turmeltunut'));
  assert.ok(html.includes('Ajokortti'));
  assert.ok(html.includes('Pääovi'));
  assert.ok(html.includes('Ei esitetty'));
  assert.ok(!html.includes('Korvaussumma yhteensä'));
});
