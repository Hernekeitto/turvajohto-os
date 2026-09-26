import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  rakennaSahkoposti, rakennaTekstiviesti, tulkitseKanavat, toimitaTunnustiedot, peitaNumero,
} from './tunnuslahetys.js';
import { laskeViesti } from './bulksms.js';

const SALASANA = 'Ab3dEfGh7jKmNp';

test('sähköpostissa on tunnus mutta ei koskaan salasanaa', () => {
  const { text, subject } = rakennaSahkoposti({
    nimi: 'Korhonen Ismo', username: 'korhonen_ismo', osoite: 'https://x.fi/guard', syy: 'luotu', numeroPeitetty: '••• 67',
  });
  assert.match(text, /korhonen_ismo/);
  assert.match(text, /https:\/\/x\.fi\/guard/);
  assert.match(text, /••• 67/);
  assert.doesNotMatch(text + subject, new RegExp(SALASANA));
});

test('tekstiviestissä on salasana mutta ei tunnusta, ja se mahtuu yhteen GSM-osaan', () => {
  const body = rakennaTekstiviesti({ password: SALASANA });
  assert.match(body, new RegExp(SALASANA));
  assert.doesNotMatch(body, /korhonen/);
  const mitat = laskeViesti(body);
  assert.equal(mitat.encoding, 'TEXT');
  assert.equal(mitat.osia, 1);
});

test('kanavat: vain nimenomainen true kelpaa', () => {
  assert.equal(tulkitseKanavat(undefined), null);
  assert.equal(tulkitseKanavat({ sahkoposti: 'true' }), null);
  assert.deepEqual(tulkitseKanavat({ sahkoposti: true, sms: true, fax: true }), ['sahkoposti', 'sms']);
});

test('peitetty numero näyttää vain kaksi viimeistä numeroa', () => {
  assert.equal(peitaNumero('+358401234567'), '••• 67');
});

const tyontekija = { email: 'ismo@example.fi', phone: '040 123 4567' };

test('molemmat kanavat: oikea sisältö oikeaan kanavaan, numero palvelimelta', async () => {
  const lahetetyt = { sahkoposti: [], sms: [] };
  const tulos = await toimitaTunnustiedot({
    kanavat: ['sahkoposti', 'sms'], tyontekija, nimi: 'Ismo', username: 'korhonen_ismo', password: SALASANA,
    puoli: 'guard', syy: 'luotu',
    lahetaSahkoposti: async (v) => { lahetetyt.sahkoposti.push(v); return { ok: true, dryRun: false }; },
    lahetaSms: async (v) => { lahetetyt.sms.push(v); return { ok: true, dryRun: true }; },
  });
  assert.equal(lahetetyt.sahkoposti[0].to, 'ismo@example.fi');
  assert.doesNotMatch(lahetetyt.sahkoposti[0].text, new RegExp(SALASANA));
  assert.deepEqual(lahetetyt.sms[0].numerot, ['+358401234567']);
  assert.match(lahetetyt.sms[0].body, new RegExp(SALASANA));
  assert.deepEqual(tulos.sahkoposti, { tila: 'lahetetty' });
  assert.deepEqual(tulos.sms, { tila: 'kuivaharjoittelu', numero: '••• 67' });
  // Tulos menee selaimeen ja auditlokiin: ei salasanaa eikä koko numeroa.
  assert.doesNotMatch(JSON.stringify(tulos), new RegExp(`${SALASANA}|401234567`));
});

test('puuttuva yhteystieto ei lähetä mitään sille kanavalle', async () => {
  let kutsuja = 0;
  const tulos = await toimitaTunnustiedot({
    kanavat: ['sahkoposti', 'sms'], tyontekija: { email: 'ei-osoite', phone: '' }, username: 'x', password: SALASANA,
    lahetaSahkoposti: async () => { kutsuja += 1; return { ok: true }; },
    lahetaSms: async () => { kutsuja += 1; return { ok: true }; },
  });
  assert.equal(kutsuja, 0);
  assert.equal(tulos.sahkoposti.tila, 'ei-yhteystietoa');
  assert.equal(tulos.sms.tila, 'ei-yhteystietoa');
});

test('sähköposti ei mainitse numeroa, jos tekstiviestiä ei lähetetä', async () => {
  let teksti = '';
  await toimitaTunnustiedot({
    kanavat: ['sahkoposti'], tyontekija, username: 'x', password: SALASANA,
    lahetaSahkoposti: async (v) => { teksti = v.text; return { ok: true }; },
    lahetaSms: async () => { throw new Error('ei kuulu kutsua'); },
  });
  assert.doesNotMatch(teksti, /•••/);
  assert.match(teksti, /toimitetaan sinulle erikseen/);
});
