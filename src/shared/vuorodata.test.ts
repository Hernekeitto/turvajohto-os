// Kuluvan vuoron työtietojen testit.
//
// Painopiste on siinä mitä laitteelle EI saa jäädä. Jos riisuKohde unohtaa kentän,
// henkilötietoa päätyy puhelimeen jäävään kopioon eikä siitä huomauta mikään —
// sovellus toimisi täsmälleen yhtä hyvin.
//
// Ajetaan: node --test src/shared/vuorodata.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  tallennaVuorodata, lueVuorodata, unohdaVuorodata, riisuKohde, VANHENEE_TUNTIA,
} from './vuorodata.ts';

const varasto = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (varasto.has(k) ? varasto.get(k)! : null),
    setItem: (k: string, v: string) => { varasto.set(k, v); },
    removeItem: (k: string) => { varasto.delete(k); },
  },
};
// Object.keys(window.localStorage) käy läpi vain omat avaimet, joten unohdaVuorodata
// tarvitsee varastosta läpikäytävän esityksen.
Object.defineProperty((globalThis as any).window, 'localStorage', {
  get: () => new Proxy({}, {
    get: (_kohde, nimi: string) => {
      if (nimi === 'getItem') return (k: string) => (varasto.has(k) ? varasto.get(k)! : null);
      if (nimi === 'setItem') return (k: string, v: string) => { varasto.set(k, v); };
      if (nimi === 'removeItem') return (k: string) => { varasto.delete(k); };
      return undefined;
    },
    ownKeys: () => [...varasto.keys()],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  }),
});

const KOHDE: any = {
  id: 'k1',
  name: 'Testikohde',
  address: 'Katu 1',
  contactName: 'Yhteyshenkilö',
  contactPhone: '040 123 4567',
  notes: 'Hälytys menee vartiointiliikkeeseen.',
  tehtavat: [{ id: 't1', nimi: 'Sulkukierros', tyyppi: 'kuittaus', kohdat: [] }],
  zones: [{ id: 'z1', nimi: 'Piha' }],
  mapUploadId: 'kartta.png',
  vuorotyypit: [
    { id: 'v1', nimi: 'Aamuvuoro', alkaa: '07:00', paattyy: '15:00', tehtavaIdt: ['t1'], pohjaIdt: [] },
  ],
  perehdytykset: [
    { id: 'p1', nimi: 'Virtanen Matti', employeeId: 'e1', username: 'vartija1', pvm: '2026-08-01', vuorotyyppiIdt: ['v1'] },
  ],
};

const POHJA: any = { id: 'pohja1', kind: 'patrol', ownerId: 'k1', nimi: 'Yökierros', versio: 1, pisteet: [{ id: 'x', nimi: 'Pääovi', jarjestys: 0 }] };
const KESKEN: any = { id: 'kier1', siteId: 'k1', tila: 'kesken', pisteet: [] };
const VALMIS: any = { id: 'kier2', siteId: 'k1', tila: 'valmis', pisteet: [] };

const alusta = () => varasto.clear();

// --- Mitä ei tallenneta -----------------------------------------------------------

test('perehdytykset EIVÄT päädy laitteelle', () => {
  const riisuttu: any = riisuKohde(KOHDE);
  assert.equal(riisuttu.perehdytykset, undefined);
  // Ja varmistetaan koko serialisoidusta muodosta, ettei nimi vuoda mitään kautta.
  assert.equal(JSON.stringify(riisuttu).includes('Virtanen'), false);
  // Erässä 16 perehdytykseen tuli KÄYTTÄJÄTUNNUS. Se on tunniste siinä missä nimikin,
  // eikä kohteen perehdytyslista muutu vähemmän henkilötiedoksi sen takia että
  // tunnisteen muoto vaihtui.
  assert.equal(JSON.stringify(riisuttu).includes('vartija1'), false);
});

test('vuorotyypit päätyvät laitteelle, koska ne eivät kerro ihmisistä', () => {
  // Vuorotyyppi kertoo mitä vuoroon kuuluu, ei kuka siinä on. Ilman sitä offline-tilassa
  // ei tiedettäisi mitä kesken olevaan vuoroon kuului.
  const riisuttu = riisuKohde(KOHDE);
  assert.equal(riisuttu.vuorotyypit?.length, 1);
  assert.equal(riisuttu.vuorotyypit?.[0].nimi, 'Aamuvuoro');
});

test('kohteen ohjeet, tehtävät ja yhteystiedot säilyvät', () => {
  const riisuttu = riisuKohde(KOHDE);
  assert.equal(riisuttu.notes, KOHDE.notes);
  assert.equal(riisuttu.tehtavat?.length, 1);
  assert.equal(riisuttu.contactPhone, '040 123 4567');
  assert.equal(riisuttu.mapUploadId, 'kartta.png');
});

test('vain kesken oleva kierros tallennetaan', () => {
  alusta();
  tallennaVuorodata('vartija1', { kohteet: [KOHDE], pohjat: [POHJA], kierrokset: [KESKEN, VALMIS] });
  const luettu = lueVuorodata('vartija1');
  assert.equal(luettu?.kierrokset.length, 1);
  assert.equal(luettu?.kierrokset[0].id, 'kier1');
});

test('tallenne ei sisällä raportteja eikä työntekijöitä missään muodossa', () => {
  alusta();
  tallennaVuorodata('vartija1', { kohteet: [KOHDE], pohjat: [POHJA], kierrokset: [KESKEN] });
  const raaka = varasto.get('turvajohto-vuoro:vartija1') || '';
  for (const kielletty of ['Virtanen', 'perehdytykset', 'vartija1', 'subjectPersonalId', 'employees']) {
    assert.equal(raaka.includes(kielletty), false, `"${kielletty}" ei saa olla tallenteessa`);
  }
});

// --- Elinkaari --------------------------------------------------------------------

test('tuore tallenne luetaan', () => {
  alusta();
  tallennaVuorodata('vartija1', { kohteet: [KOHDE], pohjat: [POHJA], kierrokset: [] });
  const luettu = lueVuorodata('vartija1');
  assert.equal(luettu?.kohteet.length, 1);
  assert.equal(luettu?.pohjat.length, 1);
});

test('vanhentunutta tallennetta EI käytetä', () => {
  alusta();
  tallennaVuorodata('vartija1', { kohteet: [KOHDE], pohjat: [], kierrokset: [] });
  const tulevaisuudessa = Date.now() + (VANHENEE_TUNTIA + 1) * 60 * 60 * 1000;
  assert.equal(lueVuorodata('vartija1', tulevaisuudessa), null);
});

test('juuri ennen vanhentumista tallenne kelpaa vielä', () => {
  alusta();
  tallennaVuorodata('vartija1', { kohteet: [KOHDE], pohjat: [], kierrokset: [] });
  const melkein = Date.now() + (VANHENEE_TUNTIA - 1) * 60 * 60 * 1000;
  assert.ok(lueVuorodata('vartija1', melkein));
});

test('toisen käyttäjän tallenne ei näy', () => {
  alusta();
  tallennaVuorodata('vartija1', { kohteet: [KOHDE], pohjat: [], kierrokset: [] });
  assert.equal(lueVuorodata('vartija2'), null);
});

test('uloskirjautuminen poistaa KAIKKIEN käyttäjien tallenteet', () => {
  alusta();
  tallennaVuorodata('vartija1', { kohteet: [KOHDE], pohjat: [], kierrokset: [] });
  tallennaVuorodata('vartija2', { kohteet: [KOHDE], pohjat: [], kierrokset: [] });
  unohdaVuorodata();
  assert.equal(lueVuorodata('vartija1'), null);
  assert.equal(lueVuorodata('vartija2'), null);
});

test('vioittunut tallenne ei kaada sovellusta', () => {
  alusta();
  varasto.set('turvajohto-vuoro:vartija1', '{ ei kelvollista jsonia');
  assert.equal(lueVuorodata('vartija1'), null);
});

test('puuttuva tallenne palauttaa nullin', () => {
  alusta();
  assert.equal(lueVuorodata('kukaan'), null);
});
