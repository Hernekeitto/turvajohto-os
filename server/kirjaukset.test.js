// Kirjausten lukituksen testit (kirjaukset.js). Nämä ovat sääntöjä joiden rikkoutuminen
// ei näy käyttöliittymässä mitenkään — lukitus vain lakkaisi hiljaa toimimasta — joten
// ne testataan erikseen.
//
// Ajetaan: npm test  (tai node --test server/)

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  onLukittu,
  sailytysaikaPaattynyt,
  lukitusEstaaMuokkauksen,
  lukitusEstaaPoiston,
  muutoksenLisatiedot,
} from './kirjaukset.js';

const kirjaus = (yli = {}) => ({
  id: '26/FesX/1108/001',
  typeId: 'jvaction',
  createdAt: '2026-08-11T10:00:00.000Z',
  summary: 'Pääsy estetty portilla 2.',
  status: 'open',
  corrections: [],
  ...yli,
});

test('tapahtumailmoitus on lukittu tyyppinsä perusteella', () => {
  assert.equal(onLukittu(kirjaus({ typeId: 'jvreport' })), true);
  assert.equal(onLukittu(kirjaus({ typeId: 'guard_jvreport' })), true);
});

test('voimakeinot ja kiinniotto lukitsevat tavallisenkin toimenpidekirjauksen', () => {
  assert.equal(onLukittu(kirjaus({ force: true })), true);
  assert.equal(onLukittu(kirjaus({ tools: true })), true);
  assert.equal(onLukittu(kirjaus({ firearm: true })), true);
  assert.equal(onLukittu(kirjaus({ detainedOrForce: true })), true);
  assert.equal(onLukittu(kirjaus({ detained: 1 })), true);
});

test('rutiinikirjaus ei ole lukittu', () => {
  assert.equal(onLukittu(kirjaus()), false);
  assert.equal(onLukittu(kirjaus({ detained: 0, force: false })), false);
  assert.equal(onLukittu(null), false);
});

test('lukitun kirjauksen sisältöä ei voi muuttaa', () => {
  const ennen = kirjaus({ force: true });
  const jalkeen = { ...ennen, summary: 'Muutettu jälkikäteen.' };
  assert.match(lukitusEstaaMuokkauksen(ennen, jalkeen), /summary/);
});

test('lukittua ei voi avata nollaamalla lippu joka sen lukitsi', () => {
  const ennen = kirjaus({ force: true });
  const jalkeen = { ...ennen, force: false };
  assert.ok(lukitusEstaaMuokkauksen(ennen, jalkeen));
});

test('tila, vastuutus ja sulkeminen saavat muuttua lukitussakin kirjauksessa', () => {
  const ennen = kirjaus({ force: true });
  const jalkeen = {
    ...ennen,
    status: 'closed',
    closedAt: '2026-08-12T09:00:00.000Z',
    closedBy: 'TIKE Päivystäjä',
    assignedTo: 'Korhonen Elli',
    severity: 4,
    zoneId: 'lohko-c',
  };
  assert.equal(lukitusEstaaMuokkauksen(ennen, jalkeen), null);
});

test('korjausmerkinnän voi lisätä mutta ei poistaa eikä muuttaa', () => {
  const merkinta = { id: 'k1', at: '2026-08-12T09:00:00.000Z', by: 'TIKE', text: 'Kellonaika oli 13:45.' };
  const ennen = kirjaus({ force: true, corrections: [merkinta] });

  assert.equal(
    lukitusEstaaMuokkauksen(ennen, { ...ennen, corrections: [merkinta, { ...merkinta, id: 'k2' }] }),
    null
  );
  assert.ok(lukitusEstaaMuokkauksen(ennen, { ...ennen, corrections: [] }));
  assert.ok(
    lukitusEstaaMuokkauksen(ennen, { ...ennen, corrections: [{ ...merkinta, text: 'Toisin sanoin.' }] })
  );
});

test('todisteliitteen voi lisätä jälkikäteen mutta ei poistaa', () => {
  const liite = { id: 'up-1', name: 'kuva.jpg' };
  const tyhja = kirjaus({ force: true, attachments: [] });
  assert.equal(lukitusEstaaMuokkauksen(tyhja, { ...tyhja, attachments: [liite] }), null);

  const liitteella = kirjaus({ force: true, attachments: [liite] });
  assert.ok(lukitusEstaaMuokkauksen(liitteella, { ...liitteella, attachments: [] }));
  assert.ok(
    lukitusEstaaMuokkauksen(liitteella, { ...liitteella, attachments: [{ ...liite, id: 'up-2' }] })
  );
});

test('lomaketunnuksen voi täydentää tyhjästä mutta ei vaihtaa', () => {
  const tyhja = kirjaus({ force: true, formCode: null, formVersion: null });
  assert.equal(
    lukitusEstaaMuokkauksen(tyhja, { ...tyhja, formCode: 'TP', formVersion: '1.0' }),
    null
  );

  const leimattu = kirjaus({ force: true, formCode: 'TP', formVersion: '1.0' });
  assert.match(lukitusEstaaMuokkauksen(leimattu, { ...leimattu, formCode: 'TI' }), /formCode/);
});

test('lukitun kirjauksen voi siirtää roskakoriin ja palauttaa sieltä', () => {
  const ennen = kirjaus({ force: true });
  const roskiin = { ...ennen, deletedAt: '2026-08-12T09:00:00.000Z', deletedBy: 'TIKE' };
  assert.equal(lukitusEstaaMuokkauksen(ennen, roskiin), null);
  assert.equal(lukitusEstaaMuokkauksen(roskiin, ennen), null);
});

test('lukittua kirjausta ei voi poistaa ennen säilytysajan päättymistä', () => {
  const ennen = kirjaus({ force: true, createdAt: '2026-08-11T10:00:00.000Z' });
  assert.ok(lukitusEstaaPoiston(ennen, new Date('2027-06-01T00:00:00.000Z')));
  // Säilytys päättyy 31.12.2028, hävitys on sen jälkeen lakisääteinen velvollisuus.
  assert.equal(lukitusEstaaPoiston(ennen, new Date('2029-01-15T00:00:00.000Z')), null);
});

test('GUARD-raportin laatimisaika luetaan luotu-kentästä', () => {
  const vartijanKirjaus = { id: 'g1', typeId: 'guard_jvreport', luotu: '2026-08-11T10:00:00.000Z' };
  assert.equal(sailytysaikaPaattynyt(vartijanKirjaus, new Date('2027-06-01T00:00:00.000Z')), false);
  assert.ok(lukitusEstaaPoiston(vartijanKirjaus, new Date('2027-06-01T00:00:00.000Z')));
  assert.equal(lukitusEstaaPoiston(vartijanKirjaus, new Date('2029-01-15T00:00:00.000Z')), null);
});

test('createdAt puuttuu: säilytysaikaa ei voi laskea, joten poisto sallitaan', () => {
  const vanha = { id: 'x', typeId: 'jvreport' };
  assert.equal(sailytysaikaPaattynyt(vanha), true);
  assert.equal(lukitusEstaaPoiston(vanha), null);
});

test('lukitsematon kirjaus ei rajoitu mitenkään', () => {
  const ennen = kirjaus();
  assert.equal(lukitusEstaaMuokkauksen(ennen, { ...ennen, summary: 'Korjattu.' }), null);
  assert.equal(lukitusEstaaPoiston(ennen), null);
});

test('audit-lisätiedot kertovat tilamuutoksen ja korjausmerkinnän', () => {
  const ennen = kirjaus({ status: 'open' });
  assert.deepEqual(muutoksenLisatiedot(ennen, { ...ennen, status: 'closed' }), {
    statusFrom: 'open',
    statusTo: 'closed',
  });
  assert.deepEqual(muutoksenLisatiedot(ennen, { ...ennen, corrections: [{ id: 'k1' }] }), {
    correctionAdded: true,
  });
  assert.deepEqual(muutoksenLisatiedot(ennen, ennen), {});
});
