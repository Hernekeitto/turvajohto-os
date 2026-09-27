import { test } from 'node:test';
import assert from 'node:assert/strict';

import { vahvistaTyontekijoidenNumerot, tunnuksenNumero, laskeKorkein } from './tunnistenumerot.js';

const kayttajat = [{ username: 'Johto1', displayId: 1000 }, { username: 'Claude', displayId: 1005 }];

test('poistetun viimeisen henkilön numero ei palaa kiertoon (27.9.2026 #1011)', () => {
  // Korhonen #1011 poistettiin, kirjanpito muistaa 1011. Selain ehdottaa uudelle 1011.
  const nykyiset = [{ id: 'a', displayId: 1010 }];
  const { data, korjatut, korkein } = vahvistaTyontekijoidenNumerot({
    nykyiset,
    uudet: [...nykyiset, { id: 'uusi', displayId: 1011 }],
    kayttajat,
    korkein: 1011,
  });
  assert.equal(data[1].displayId, 1012);
  assert.deepEqual(korjatut, { uusi: 1012 });
  assert.equal(korkein, 1012);
});

test('olemassa olevan numeroa ei voi muuttaa selaimesta', () => {
  const { data, korjatut } = vahvistaTyontekijoidenNumerot({
    nykyiset: [{ id: 'a', displayId: 1006 }],
    uudet: [{ id: 'a', displayId: 1999, name: 'uusi nimi' }],
    kayttajat,
    korkein: 1011,
  });
  assert.equal(data[0].displayId, 1006);
  assert.equal(data[0].name, 'uusi nimi');
  assert.deepEqual(korjatut, { a: 1006 });
});

test('oikea ehdotus hyväksytään sellaisenaan eikä raportoida korjauksena', () => {
  const uusi = { id: 'b', displayId: 1012 };
  const { data, korjatut } = vahvistaTyontekijoidenNumerot({
    nykyiset: [], uudet: [uusi], kayttajat, korkein: 1011,
  });
  assert.equal(data[0], uusi);
  assert.deepEqual(korjatut, {});
});

test('useampi uusi samassa tallennuksessa saa eri numerot, myös numerottomat', () => {
  const { data } = vahvistaTyontekijoidenNumerot({
    nykyiset: [], uudet: [{ id: 'x' }, { id: 'y', displayId: 1000 }], kayttajat, korkein: null,
  });
  assert.deepEqual(data.map((t) => t.displayId), [1006, 1007]);
});

test('ilman kirjanpitoa korkein lasketaan myös tunnuksista', () => {
  assert.equal(laskeKorkein({ korkein: null, tyontekijat: [{ displayId: 1003 }], kayttajat }), 1005);
});

test('tunnus: kytketyn työntekijän oma numero, toisen numeroa ei hyväksytä', () => {
  const tyontekijat = [{ id: 'e1', displayId: 1011 }, { id: 'e2', displayId: 1012 }];
  assert.deepEqual(
    tunnuksenNumero({ ehdotettu: 1011, employeeId: 'e1', tyontekijat, kayttajat, korkein: 1012 }).numero, 1011);
  assert.equal(tunnuksenNumero({ ehdotettu: 1012, employeeId: 'e1', tyontekijat, kayttajat, korkein: 1012 }).ok, false);
});

test('tunnus: numero jo toisella tunnuksella hylätään', () => {
  const tyontekijat = [{ id: 'e1', displayId: 1005 }];
  const r = tunnuksenNumero({ employeeId: 'e1', tyontekijat, kayttajat, korkein: 1011 });
  assert.equal(r.ok, false);
  assert.match(r.virhe, /Claude/);
});

test('tunnus ilman työntekijää saa uuden numeron korkeimman yläpuolelta', () => {
  const r = tunnuksenNumero({ tyontekijat: [{ id: 'e1', displayId: 1010 }], kayttajat, korkein: 1011 });
  assert.deepEqual(r, { ok: true, numero: 1012, korkein: 1012 });
  assert.equal(tunnuksenNumero({ ehdotettu: 1003, tyontekijat: [], kayttajat, korkein: 1011 }).ok, false);
});
