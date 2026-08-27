import test from 'node:test';
import assert from 'node:assert/strict';
import { normalisoiNumero, laskeViesti, rakennaKuorma, onkoKonfiguroitu, parsiJson } from './bulksms.js';
import { ratkaiseVastaanottajat, taytaPaikkamerkit, kaytossaOlevatNapit, OLETUSNAPIT } from './sms.js';

// ---------------------------------------------------------------- numeron muotoilu

test('suomalainen numero muuttuu E.164-muotoon eri kirjoitusasuista', () => {
  const odotus = '+358401234567';
  for (const syote of [
    '040 123 4567',
    '040-1234567',
    '(040) 123 45 67',
    '00358401234567',
    '+358 40 123 4567',
    '358401234567',
  ]) {
    assert.equal(normalisoiNumero(syote), odotus, `epäonnistui syötteellä ${syote}`);
  }
});

test('ulkomainen numero säilyy sellaisenaan', () => {
  assert.equal(normalisoiNumero('+46 70 123 45 67'), '+46701234567');
  // 00-etuliite on kansainvälinen ulossuuntanumero, ei Suomen maakoodi
  assert.equal(normalisoiNumero('004670 1234567'), '+46701234567');
});

test('kelvoton numero palauttaa null eikä arvaa', () => {
  // Arvaus olisi vaarallisempi kuin puuttuva numero: vahvistusnäkymä näyttää
  // puuttuvan numeron virheenä, mutta väärään numeroon lähtenyttä hätäviestiä
  // ei saa takaisin.
  assert.equal(normalisoiNumero('112'), null); // lyhytnumero
  assert.equal(normalisoiNumero('112345'), null); // liian lyhyt E.164:ksi
  assert.equal(normalisoiNumero('ei numero'), null);
  assert.equal(normalisoiNumero(''), null);
  assert.equal(normalisoiNumero('   '), null);
  assert.equal(normalisoiNumero(null), null);
  assert.equal(normalisoiNumero(undefined), null);
  assert.equal(normalisoiNumero(401234567), null); // numerotyyppi, ei merkkijono
  assert.equal(normalisoiNumero('+0401234567'), null); // maakoodi ei voi alkaa nollalla
});

// ---------------------------------------------------------------- viestin pituus

test('ä ja ö kuuluvat GSM-merkistöön eivätkä pakota Unicodea', () => {
  const r = laskeViesti('Hätätila: siirtykää välittömästi kokoontumispaikalle.');
  assert.equal(r.encoding, 'TEXT');
  assert.equal(r.osia, 1);
});

test('160 GSM-merkkiä mahtuu yhteen osaan, 161 ei', () => {
  assert.equal(laskeViesti('a'.repeat(160)).osia, 1);
  const kaksi = laskeViesti('a'.repeat(161));
  assert.equal(kaksi.osia, 2);
  // Usean osan viestissä osaan mahtuu vain 153 merkkiä (User Data Header vie tilaa)
  assert.equal(kaksi.osanRaja, 153);
  assert.equal(laskeViesti('a'.repeat(306)).osia, 2);
  assert.equal(laskeViesti('a'.repeat(307)).osia, 3);
});

test('laajennustaulukon merkki vie kaksi merkkipaikkaa', () => {
  // Euromerkki on GSM 03.38:n laajennustaulukossa: se mahtuu TEXT-viestiin mutta
  // vie kaksi septettiä, joten 80 euromerkkiä täyttää yhden osan tasan.
  const r = laskeViesti('€'.repeat(80));
  assert.equal(r.encoding, 'TEXT');
  assert.equal(r.pituus, 160);
  assert.equal(r.osia, 1);
  assert.equal(laskeViesti('€'.repeat(81)).osia, 2);
});

test('GSM-merkistön ulkopuolinen merkki pudottaa rajan 70:een', () => {
  // Ajatusviiva (–) ja typografinen lainausmerkki näyttävät tavalliselta tekstiltä
  // mutta muuttavat koko viestin Unicodeksi ja yli kaksinkertaistavat sen hinnan.
  const r = laskeViesti('Evakuointi – siirtykää ulos');
  assert.equal(r.encoding, 'UNICODE');
  assert.equal(r.osia, 1);
  assert.equal(laskeViesti(`${'a'.repeat(70)}–`).osia, 2);
});

test('emoji lasketaan kahdeksi UTF-16-yksiköksi', () => {
  const r = laskeViesti('🚨'.repeat(35));
  assert.equal(r.encoding, 'UNICODE');
  assert.equal(r.pituus, 70);
  assert.equal(r.osia, 1);
  assert.equal(laskeViesti('🚨'.repeat(36)).osia, 2);
});

test('tyhjä viesti on yksi osa eikä nolla', () => {
  assert.equal(laskeViesti('').osia, 1);
  assert.equal(laskeViesti(null).osia, 1);
});

// ---------------------------------------------------------------- kuorman rakennus

test('kuormassa on yksi viestiobjekti per vastaanottaja samassa erässä', () => {
  const kuorma = rakennaKuorma(['+358401234567', '+358407654321'], 'Testi');
  assert.equal(kuorma.length, 2);
  assert.deepEqual(kuorma[0], { to: '+358401234567', body: 'Testi', encoding: 'TEXT' });
  // Ilman lähettäjätunnusta from jätetään kokonaan pois -> tilin oletusasetus ratkaisee
  assert.equal('from' in kuorma[0], false);
});

test('repliable-nappi lähettää from.type REPLIABLE eikä lähettäjätunnusta', () => {
  const kuorma = rakennaKuorma(['+358401234567'], 'Oletko turvassa? Vastaa OK.', { repliable: true });
  assert.deepEqual(kuorma[0].from, { type: 'REPLIABLE' });
});

test('lähettäjätunnus otetaan ympäristömuuttujasta ja liian pitkä hylätään', (t) => {
  t.after(() => { delete process.env.BULKSMS_SENDER_ID; });

  process.env.BULKSMS_SENDER_ID = 'TURVAJOHTO';
  assert.equal(rakennaKuorma(['+358401234567'], 'x')[0].from, 'TURVAJOHTO');

  // Aakkosnumeerisen tunnuksen maksimipituus on 11 merkkiä. Liian pitkä hylättäisiin
  // rajapinnassa koko lähetyksen osalta, joten asetusvirhe ei saa kaataa hätäviestiä.
  process.env.BULKSMS_SENDER_ID = 'TURVAJOHTO-OS-PITKA';
  assert.equal('from' in rakennaKuorma(['+358401234567'], 'x')[0], false);
});

test('unicode-viesti merkitään encoding-kenttään', () => {
  assert.equal(rakennaKuorma(['+358401234567'], 'Evakuointi – heti')[0].encoding, 'UNICODE');
});

test('ilman API-tunnuksia integraatio on konfiguroimaton', () => {
  // Testiympäristössä tunnuksia ei ole, joten lähetys menee kuivaharjoitteluun.
  assert.equal(onkoKonfiguroitu(), false);
});

// ---------------------------------------------------------------- JSON ja viesti-id:t

test('19-numeroinen viesti-id säilyy tarkkana', () => {
  // Tavallinen JSON.parse pyöristäisi: 1674811778896240640 -> 1674811778896240600.
  // Pyöristys on hiljainen ja toimitusraportit toimivat siitä huolimatta niin kauan
  // kuin molemmat vertailtavat puolet pyöristyvät samalla tavalla — juuri siksi tämä
  // on vaarallinen: vika paljastuisi vasta kun jompikumpi puoli tulee eri reittiä.
  const vastaus = parsiJson('[{"id":1674813649253834752,"relatedSentMessageId":1674811778896240640}]');
  assert.equal(vastaus[0].id, '1674813649253834752');
  assert.equal(vastaus[0].relatedSentMessageId, '1674811778896240640');
  // Vertailukohta: mitä olisi tapahtunut ilman korjausta
  assert.notEqual(String(JSON.parse('{"id":1674813649253834752}').id), '1674813649253834752');
});

test('jo merkkijonona tullut id ei riko jäsennystä', () => {
  const v = parsiJson('[{"id":"1674813649253834752"}]');
  assert.equal(v[0].id, '1674813649253834752');
});

test('muut numerokentät säilyvät lukuina', () => {
  // Regex osuu vain id-kenttiin: hinta ja osamäärä ovat laskennassa käytettäviä lukuja.
  const v = parsiJson('[{"id":1674813649253834752,"creditCost":1.5,"numberOfParts":2}]');
  assert.equal(v[0].creditCost, 1.5);
  assert.equal(v[0].numberOfParts, 2);
});

test('lyhyet id:t eivät muutu merkkijonoiksi turhaan', () => {
  // Alle 16 numeron id mahtuu turvalliseen alueeseen — mock- ja testidatassa id:t ovat
  // pieniä, eikä niiden tyyppiä pidä muuttaa.
  assert.equal(parsiJson('[{"id":1001}]')[0].id, 1001);
});

test('kelvoton JSON palauttaa null eikä heitä', () => {
  // Välissä oleva proxy voi palauttaa HTML-virhesivun; sen ei pidä kaataa lähetystä.
  assert.equal(parsiJson('<html>502 Bad Gateway</html>'), null);
  assert.equal(parsiJson(''), null);
  assert.equal(parsiJson(null), null);
});

// ---------------------------------------------------------------- vastaanottajat

const employees = [
  { id: 1, name: 'Korhonen Elli', phone: '040 123 4567' },
  { id: 2, name: 'Virtanen Matti', phone: '+358407654321' },
  { id: 3, name: 'Mäkinen Kalle', phone: '' },
  { id: 4, name: 'Nieminen Anna', phone: 'soita radiolla' },
];

const checkins = [
  { id: 11, eventId: 'fesx', name: 'Korhonen Elli', employeeId: 1, role: 'Järjestyksenvalvoja', status: 'checked_in' },
  { id: 12, eventId: 'fesx', name: 'Virtanen Matti', employeeId: 2, role: 'Vartija', status: 'pending' },
  { id: 13, eventId: 'fesx', name: 'Mäkinen Kalle', employeeId: 3, role: 'Vartija', status: 'checked_in' },
  { id: 14, eventId: 'fesx', name: 'Nieminen Anna', employeeId: 4, role: 'EA', status: 'checked_in' },
  { id: 15, eventId: 'muu', name: 'Korhonen Elli', employeeId: 1, role: 'Vartija', status: 'checked_in' },
  // Vanha rivi ilman employeeId- ja eventId-kenttiä: kuuluu FestivaaliXään ja löytää
  // numeronsa nimen perusteella.
  { id: 16, name: 'Virtanen Matti', role: 'Vartija' },
];

const events = [
  {
    id: 'fesx',
    name: 'FestivaaliX',
    formData: { phoneTurva1: '040 111 1111', phoneTurva2: '', phoneTike: '+358402222222', phoneFirstAid: 'EA-kanava 3' },
  },
];

const nappi = (group, extra = {}) => ({ id: 'x', label: 'X', group, body: 'testi', ...extra });

test('checked_in-ryhmä ottaa vain sisäänkirjatut ja vain tästä tapahtumasta', () => {
  const r = ratkaiseVastaanottajat(nappi('checked_in'), { eventId: 'fesx', checkins, employees, events });
  assert.deepEqual(r.map((v) => v.nimi), ['Korhonen Elli', 'Mäkinen Kalle', 'Nieminen Anna', 'Virtanen Matti']);
  assert.deepEqual(r.map((v) => v.numero), ['+358401234567', null, null, '+358407654321']);
});

test('roster-ryhmä ottaa myös odottavat rivit', () => {
  const r = ratkaiseVastaanottajat(nappi('roster'), { eventId: 'fesx', checkins, employees, events });
  assert.equal(r.length, 5);
  assert.ok(r.some((v) => v.nimi === 'Virtanen Matti' && v.numero === '+358407654321'));
});

test('puuttuva ja kelvoton numero palautetaan syyn kanssa eikä pudoteta hiljaa', () => {
  // Hätätilanteessa on oleellista tietää kuka EI saanut viestiä.
  const r = ratkaiseVastaanottajat(nappi('checked_in'), { eventId: 'fesx', checkins, employees, events });
  const kalle = r.find((v) => v.nimi === 'Mäkinen Kalle');
  const anna = r.find((v) => v.nimi === 'Nieminen Anna');
  assert.equal(kalle.numero, null);
  assert.match(kalle.syy, /puuttuu työntekijäpankista/);
  assert.equal(anna.numero, null);
  assert.match(anna.syy, /ei voi tulkita/);
});

test('nimimerkki näytetään nimen perässä', () => {
  const nimimerkilla = [{ id: 21, eventId: 'fesx', name: 'Korhonen Elli', employeeId: 1, nickname: 'Ensiapu 1', status: 'checked_in' }];
  const r = ratkaiseVastaanottajat(nappi('checked_in'), { eventId: 'fesx', checkins: nimimerkilla, employees, events });
  assert.equal(r[0].nimi, 'Korhonen Elli (Ensiapu 1)');
});

test('hätänumeroryhmä ohittaa tyhjät kentät mutta raportoi kelvottomat', () => {
  const r = ratkaiseVastaanottajat(nappi('emergency_numbers'), { eventId: 'fesx', checkins, employees, events });
  // Turva 2 on tyhjä -> ei mukana lainkaan (rooli on täyttämättä, ei "puuttuva numero")
  assert.deepEqual(r.map((v) => v.nimi), ['Turva 1', 'TIKE', 'EA-päivystys']);
  assert.deepEqual(r.map((v) => v.numero), ['+358401111111', '+358402222222', null]);
});

test('tuntematon tapahtuma ei kaada hätänumeroryhmää', () => {
  assert.deepEqual(ratkaiseVastaanottajat(nappi('emergency_numbers'), { eventId: 'ei-ole', checkins, employees, events }), []);
});

test('oma numerolista normalisoidaan samalla tavalla', () => {
  const r = ratkaiseVastaanottajat(nappi('custom', { customNumbers: ['040 999 8888', 'roskaa'] }), {
    eventId: 'fesx', checkins, employees, events,
  });
  assert.deepEqual(r.map((v) => v.numero), ['+358409998888', null]);
});

test('oman numerolistan nimi on peitetty numero eikä selväkielinen', () => {
  // Nimikenttä päätyy lähetyshistoriaan, vastauksiin ja käyttöliittymään. Jos siinä
  // olisi koko numero, se vuotaisi ohi sen peittämisen jota numero-kenttään tehdään.
  const r = ratkaiseVastaanottajat(nappi('custom', { customNumbers: ['045 161 4441'] }), {
    eventId: 'fesx', checkins, employees, events,
  });
  assert.equal(r[0].nimi, '+3584…441');
  assert.equal(r[0].numero, '+358451614441');
  assert.ok(!r[0].nimi.includes('1614441'), 'nimessä ei saa näkyä koko numeroa');
});

test('tuntematon ryhmä ei ohita rajausta vaan putoaa checked_in:iin', () => {
  // Käsin muokattu tai vanha tietue ei saa tuottaa määrittelemätöntä vastaanottajajoukkoa.
  const r = ratkaiseVastaanottajat(nappi('kaikki-maailmassa'), { eventId: 'fesx', checkins, employees, events });
  assert.equal(r.length, 4);
});

// ---------------------------------------------------------------- paikkamerkit ja napit

test('paikkamerkit korvataan ja teksti trimmataan', () => {
  const nyt = new Date('2026-08-27T09:05:00');
  assert.equal(
    taytaPaikkamerkit(' TURVAJOHTO {tapahtuma}: evakuointi klo {aika}. ', { tapahtumanNimi: 'FestivaaliX', nyt }),
    'TURVAJOHTO FestivaaliX: evakuointi klo 09.05.'
  );
});

test('oletusnapit otetaan käyttöön kun kokoelmaa ei ole vielä tallennettu', () => {
  assert.equal(kaytossaOlevatNapit(null).length, OLETUSNAPIT.length);
  // Tyhjä taulukko on eri asia kuin puuttuva data: käyttäjä on poistanut kaikki napit.
  assert.deepEqual(kaytossaOlevatNapit([]), []);
});

test('vajaa nappitietue normalisoituu turvallisiin oletuksiin', () => {
  const [n] = kaytossaOlevatNapit([{ id: 'a' }]);
  assert.equal(n.group, 'checked_in');
  assert.equal(n.repliable, false);
  assert.equal(n.style, 'neutral');
  assert.equal(n.label, '(nimetön)');
  assert.deepEqual(n.customNumbers, []);
});

test('oletusnappien rungot mahtuvat yhteen GSM-osaan pisimmälläkin tapahtuman nimellä', () => {
  // Usean osan viesti maksaa moninkertaisesti JA näkyy puhelimessa vasta kun kaikki
  // osat ovat saapuneet — hätäviestissä molemmat ovat todellisia haittoja.
  for (const nappi of OLETUSNAPIT) {
    if (!nappi.body) continue;
    const runko = taytaPaikkamerkit(nappi.body, { tapahtumanNimi: 'Kesäfestivaali 2026' });
    const mitat = laskeViesti(runko);
    assert.equal(mitat.encoding, 'TEXT', `${nappi.id}: runko ei ole GSM-yhteensopiva`);
    assert.equal(mitat.osia, 1, `${nappi.id}: runko on ${mitat.pituus} merkkiä (${mitat.osia} osaa)`);
  }
});
