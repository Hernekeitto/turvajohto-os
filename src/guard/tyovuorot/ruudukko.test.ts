// Suunnitteluruudukon laskennan testit (erä 4).
//
// Ajetaan: node --test src/guard/tyovuorot/ruudukko.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { listanPaivat, lyhytNimi, paivanOtsikko, rivit, solunTaso, valitsimenHenkilot } from './ruudukko.ts';
import type { Henkilo, SuunniteltuVuoro } from './tyoaika.ts';

const v = (siteId: string, siteNimi: string, vt: string, alkaa: string, pvm: string, paikka = 1): SuunniteltuVuoro => ({
  id: `${siteId}:${vt}:${pvm}:${paikka}`, siteId, siteNimi, vuorotyyppiId: vt, vuoroNimi: vt,
  pvm, paikka, alkaa: `${pvm}T${alkaa}`, paattyy: `${pvm}T22:00`, kestoMin: 480,
});

const henkilo = (username: string, nimi: string, workTimeType = 'monthly'): Henkilo => ({
  username, nimi, kytketty: true, workTimeType, minHoursPer3Weeks: null, hasGuardCard: true,
  guardCardValidUntil: '2028-12', employmentStart: null, employmentType: null, employmentFixedTo: null, korttiAsti: '2028-12-31',
});

test('listan päivät', () => {
  const p = listanPaivat({ alku: '2026-10-05', loppu: '2026-10-26' } as never);
  assert.equal(p.length, 21);
  assert.equal(p[0], '2026-10-05');
  assert.equal(p[20], '2026-10-25');
});

test('rivit: yksi rivi per kohde, vuoro ja paikka, järjestettynä', () => {
  const r = rivit([
    v('k2', 'Varasto', 'aamu', '06:00', '2026-10-05'),
    v('k1', 'Kauppakeskus', 'ilta', '14:00', '2026-10-05'),
    v('k1', 'Kauppakeskus', 'aamu', '06:00', '2026-10-05', 2),
    v('k1', 'Kauppakeskus', 'aamu', '06:00', '2026-10-05', 1),
    v('k1', 'Kauppakeskus', 'aamu', '06:00', '2026-10-06', 1),
  ]);
  assert.deepEqual(r.map((x) => x.avain), ['k1:aamu:1', 'k1:aamu:2', 'k1:ilta:1', 'k2:aamu:1']);
  assert.deepEqual(Object.keys(r[0].solut), ['2026-10-05', '2026-10-06']);
  assert.equal(r[0].aika, '06:00–22:00');
});

test('solun taso on vakavin juuri tätä vuoroa koskeva', () => {
  const tulokset = {
    v: {
      jaksot: [],
      havainnot: [
        { taso: 'varoitus' as const, koodi: 'putki', viesti: '', vuoroIdt: ['a', 'b'] },
        { taso: 'poikkeama' as const, koodi: 'vuorokausilepo', viesti: '', vuoroIdt: ['b'] },
        { taso: 'huomio' as const, koodi: 'vajaa', viesti: '', vuoroIdt: [] },
      ],
    },
  };
  assert.equal(solunTaso('a', { vuoroId: 'a', username: 'v' }, tulokset), 'varoitus');
  assert.equal(solunTaso('b', { vuoroId: 'b', username: 'v' }, tulokset), 'poikkeama');
  assert.equal(solunTaso('c', { vuoroId: 'c', username: 'v' }, tulokset), null);
  assert.equal(solunTaso('a', undefined, tulokset), null);
});

test('lyhyt nimi', () => {
  assert.equal(lyhytNimi(henkilo('v', 'Ville Virtanen'), 'v'), 'Ville V.');
  assert.equal(lyhytNimi(henkilo('v', 'Ville Ilmari Virtanen'), 'v'), 'Ville V.');
  assert.equal(lyhytNimi(undefined, 'tunnus'), 'tunnus');
});

test('päivän otsikko', () => {
  assert.deepEqual(paivanOtsikko('2026-10-10'), { viikonpaiva: 'la', paiva: '10.10.', viikonloppu: true });
  assert.equal(paivanOtsikko('2026-10-05').viikonpaiva, 'ma');
});

test('valitsin: perehdytetyt ensin, reservi ja perehdyttämättömät perässä', () => {
  const lista = valitsimenHenkilot(
    [henkilo('r', 'Aino Reservi', 'oncall'), henkilo('n', 'Niina Nieminen'), henkilo('v', 'Ville Virtanen')],
    ['v', 'r'],
  );
  assert.deepEqual(lista.map((x) => x.henkilo.username), ['v', 'r', 'n']);
  assert.equal(lista[1].reservi, true);
  assert.equal(lista[2].perehdytetty, false);
});
