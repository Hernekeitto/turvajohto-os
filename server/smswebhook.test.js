import test from 'node:test';
import assert from 'node:assert/strict';
import {
  salaisuusTasmaa,
  tulkitseTapahtuma,
  soveltaTilaraportit,
  soveltaVastaukset,
  koostaTilanne,
  peitaNumero,
} from './smswebhook.js';

// ---------------------------------------------------------------- salaisuus

test('salaisuus täsmää vain täsmälleen oikealla arvolla', () => {
  assert.equal(salaisuusTasmaa('abc123', 'abc123'), true);
  assert.equal(salaisuusTasmaa('abc124', 'abc123'), false);
  // Eri pituus ei saa kaataa vertailua (timingSafeEqual heittäisi raa'alla puskurilla)
  assert.equal(salaisuusTasmaa('lyhyt', 'pidempi salaisuus'), false);
  assert.equal(salaisuusTasmaa('', ''), false); // tyhjä ei kelpaa kummallakaan puolella
  assert.equal(salaisuusTasmaa('jotain', ''), false);
  assert.equal(salaisuusTasmaa(null, 'abc'), false);
  assert.equal(salaisuusTasmaa(undefined, undefined), false);
});

// ---------------------------------------------------------------- tapahtuman tulkinta

test('tapahtumatyyppi luetaan otsikosta ja kuorma normalisoidaan taulukoksi', () => {
  assert.deepEqual(tulkitseTapahtuma('status-report', [{ id: '1' }]), { tyyppi: 'status', viestit: [{ id: '1' }] });
  assert.deepEqual(tulkitseTapahtuma('incoming-message', { id: '2' }), { tyyppi: 'reply', viestit: [{ id: '2' }] });
  // Tuntematon tyyppi ei ole virhe: rajapinta voi lisätä uusia tapahtumia milloin vain.
  assert.equal(tulkitseTapahtuma('jokin-uusi', [{ id: '3' }]).tyyppi, 'tuntematon');
  assert.deepEqual(tulkitseTapahtuma('status-report', null).viestit, []);
});

// ---------------------------------------------------------------- toimitusraportit

const lokiPohja = () => ([
  {
    id: 'sms-1',
    eventId: 'fesx',
    label: 'Evakuointi',
    recipients: [
      { messageId: '100', nimi: 'Korhonen Elli', status: 'ACCEPTED', statusId: null, updatedAt: null },
      { messageId: '101', nimi: 'Virtanen Matti', status: 'ACCEPTED', statusId: null, updatedAt: null },
    ],
  },
]);

test('toimituskuittaus päivittää oikean vastaanottajan tilan', () => {
  const nyt = new Date('2026-08-27T12:00:00.000Z');
  const { smsLog, muuttui } = soveltaTilaraportit(lokiPohja(), [
    { id: '101', status: { type: 'DELIVERED', id: 'DELIVERED.null' } },
  ], nyt);
  assert.equal(muuttui, true);
  assert.equal(smsLog[0].recipients[0].status, 'ACCEPTED');
  assert.equal(smsLog[0].recipients[1].status, 'DELIVERED');
  assert.equal(smsLog[0].recipients[1].statusId, 'DELIVERED.null');
  assert.equal(smsLog[0].recipients[1].updatedAt, nyt.toISOString());
});

test('saman raportin käsittely kahdesti ei muuta mitään (idempotenssi)', () => {
  // Jonon kuittaus tapahtuu vasta kirjoituksen jälkeen, joten sama erä voi tulla
  // käsittelyyn uudelleen jos kirjoitus epäonnistui. Se ei saa tuottaa eri tulosta.
  const raportti = [{ id: '100', status: { type: 'FAILED', id: 'FAILED.EXPIRED' } }];
  const eka = soveltaTilaraportit(lokiPohja(), raportti);
  const toka = soveltaTilaraportit(eka.smsLog, raportti);
  assert.equal(toka.muuttui, false);
  assert.deepEqual(toka.smsLog, eka.smsLog);
});

test('lopullinen tila ei peräänny myöhässä saapuvaan välitilaan', () => {
  // Uudelleenyritys voi tuoda vanhan SENT-raportin DELIVERED:n jälkeen. Jos se
  // ylikirjoittaisi lopputuloksen, käyttöliittymä näyttäisi perillä olevan viestin
  // ikuisesti "matkalla".
  const perilla = soveltaTilaraportit(lokiPohja(), [{ id: '100', status: { type: 'DELIVERED', id: 'DELIVERED.null' } }]);
  const myohassa = soveltaTilaraportit(perilla.smsLog, [{ id: '100', status: { type: 'SENT', id: 'SENT.null' } }]);
  assert.equal(myohassa.muuttui, false);
  assert.equal(myohassa.smsLog[0].recipients[0].status, 'DELIVERED');
});

test('tuntemattoman viesti-id:n raportti ei riko mitään', () => {
  const tulos = soveltaTilaraportit(lokiPohja(), [{ id: '999', status: { type: 'DELIVERED' } }]);
  assert.equal(tulos.muuttui, false);
});

test('kelvoton raportti ohitetaan ilman poikkeusta', () => {
  assert.equal(soveltaTilaraportit(lokiPohja(), [{}, { id: null }, { id: '100' }]).muuttui, false);
  assert.equal(soveltaTilaraportit(null, [{ id: '100', status: { type: 'SENT' } }]).muuttui, false);
});

// ---------------------------------------------------------------- vastaukset

test('vastaus liitetään oikeaan lähetykseen, henkilöön ja tapahtumaan', () => {
  const { smsReplies, lisatty } = soveltaVastaukset(lokiPohja(), [], [
    { id: '500', relatedSentMessageId: '101', from: '+358407654321', body: 'OK', submission: { date: '2026-08-27T12:05:00Z' } },
  ]);
  assert.equal(lisatty, 1);
  assert.equal(smsReplies[0].sendId, 'sms-1');
  assert.equal(smsReplies[0].eventId, 'fesx');
  assert.equal(smsReplies[0].nimi, 'Virtanen Matti');
  assert.equal(smsReplies[0].body, 'OK');
  // Numero peitetään myös vastauksissa
  assert.equal(smsReplies[0].numero, '+3584…321');
});

test('sama vastaus ei tallennu kahdesti', () => {
  const mo = [{ id: '500', relatedSentMessageId: '101', from: '+358407654321', body: 'OK' }];
  const eka = soveltaVastaukset(lokiPohja(), [], mo);
  const toka = soveltaVastaukset(lokiPohja(), eka.smsReplies, mo);
  assert.equal(toka.lisatty, 0);
  assert.equal(toka.smsReplies.length, 1);
});

test('vastaus jolle ei löydy alkuperäistä lähetystä säilytetään silti', () => {
  // Hätäviestinnässä ei ole koskaan oikea vaihtoehto hukata työntekijän vastausta.
  const { smsReplies, lisatty } = soveltaVastaukset(lokiPohja(), [], [
    { id: '600', relatedSentMessageId: '9999', from: '+358401112222', body: 'Olen turvassa' },
  ]);
  assert.equal(lisatty, 1);
  assert.equal(smsReplies[0].sendId, null);
  assert.equal(smsReplies[0].nimi, null);
  assert.equal(smsReplies[0].body, 'Olen turvassa');
});

test('uusin vastaus tulee listan kärkeen', () => {
  const eka = soveltaVastaukset(lokiPohja(), [], [{ id: '1', relatedSentMessageId: '100', body: 'eka' }]);
  const toka = soveltaVastaukset(lokiPohja(), eka.smsReplies, [{ id: '2', relatedSentMessageId: '100', body: 'toka' }]);
  assert.deepEqual(toka.smsReplies.map((v) => v.body), ['toka', 'eka']);
});

// ---------------------------------------------------------------- apurit

test('numero peitetään eikä lyhyttä numeroa paljasteta osittainkaan', () => {
  assert.equal(peitaNumero('+358401234567'), '+3584…567');
  assert.equal(peitaNumero('12345'), null);
  assert.equal(peitaNumero(null), null);
});

test('tilanneyhteenveto laskee toimitustilat', () => {
  const lahetys = {
    recipients: [
      { status: 'DELIVERED' }, { status: 'DELIVERED' },
      { status: 'FAILED' },
      { status: 'SENT' }, { status: 'ACCEPTED' },
    ],
  };
  assert.deepEqual(koostaTilanne(lahetys), {
    yhteensa: 5, perilla: 2, epaonnistui: 1, matkalla: 2, kuivaharjoittelu: 0,
  });
  assert.equal(koostaTilanne({}).yhteensa, 0);
});
