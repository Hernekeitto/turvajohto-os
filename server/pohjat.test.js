// Pohjamoottorin testit. Painopiste on kahdessa asiassa jotka rikkoutuvat hiljaa:
// tarkistuspisteen tokenin säilyminen muokkauksessa (rikki = jokainen seinässä oleva
// tarra lakkaa toimimasta) ja tokenin peittyminen listahausta.
//
// Ajetaan: node --test server/pohjat.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  tarkistaPisteet, tarkistaNimi, puhdistaKuvaus, tarkistaGps, sisaltoMuuttui,
  julkinenPohja, etsiPisteTokenilla, onTunnettuLaji, RAJAT,
} from './pohjat.js';

test('pisteet saavat id:n, tokenin ja järjestyksen', () => {
  const tulos = tarkistaPisteet([{ nimi: 'Pääovi' }, { nimi: 'Takaovi' }]);
  assert.equal(tulos.ok, true);
  assert.equal(tulos.pisteet.length, 2);
  assert.equal(tulos.pisteet[0].jarjestys, 0);
  assert.equal(tulos.pisteet[1].jarjestys, 1);
  assert.ok(tulos.pisteet[0].id);
  assert.ok(tulos.pisteet[0].token.length > 20);
  assert.notEqual(tulos.pisteet[0].token, tulos.pisteet[1].token);
});

test('olemassa olevan pisteen token SÄILYY muokkauksessa', () => {
  const eka = tarkistaPisteet([{ nimi: 'Pääovi' }]).pisteet;
  const token = eka[0].token;
  // Nimi muuttuu, id pysyy: tarra seinässä osoittaa yhä samaan pisteeseen.
  const toka = tarkistaPisteet([{ id: eka[0].id, nimi: 'Pääovi (etupiha)' }], eka);
  assert.equal(toka.pisteet[0].token, token);
  assert.equal(toka.pisteet[0].nimi, 'Pääovi (etupiha)');
});

test('uusi piste saa uuden tokenin vaikka vanhoja on', () => {
  const eka = tarkistaPisteet([{ nimi: 'Pääovi' }]).pisteet;
  const toka = tarkistaPisteet([{ id: eka[0].id, nimi: 'Pääovi' }, { nimi: 'Takaovi' }], eka);
  assert.equal(toka.pisteet[0].token, eka[0].token);
  assert.notEqual(toka.pisteet[1].token, eka[0].token);
});

test('nimetön piste hylätään ja virhe kertoo monesko', () => {
  const tulos = tarkistaPisteet([{ nimi: 'Pääovi' }, { nimi: '   ' }]);
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /2/);
});

test('tyhjä pistelista hylätään', () => {
  assert.equal(tarkistaPisteet([]).ok, false);
  assert.equal(tarkistaPisteet(null).ok, false);
});

test('sama piste kahdesti hylätään', () => {
  const tulos = tarkistaPisteet([{ id: 'a', nimi: 'Pääovi' }, { id: 'a', nimi: 'Takaovi' }]);
  assert.equal(tulos.ok, false);
});

test('liian monta pistettä hylätään', () => {
  const liikaa = Array.from({ length: RAJAT.pisteita + 1 }, (_, i) => ({ nimi: `P${i}` }));
  assert.equal(tarkistaPisteet(liikaa).ok, false);
});

test('ohjausmerkit siivotaan nimestä eikä lähdetiedostoon tarvita säännöllistä lauseketta', () => {
  const rikki = `Pää${String.fromCharCode(0)}ovi${String.fromCharCode(7)}`;
  const tulos = tarkistaPisteet([{ nimi: rikki }]);
  assert.equal(tulos.pisteet[0].nimi, 'Pääovi');
});

test('rivinvaihto muuttuu välilyönniksi pohjan kentissä', () => {
  assert.equal(puhdistaKuvaus('rivi1\nrivi2'), 'rivi1 rivi2');
});

test('nimi vaatii vähintään kaksi merkkiä', () => {
  assert.equal(tarkistaNimi('x').ok, false);
  assert.equal(tarkistaNimi('  Yökierros  ').nimi, 'Yökierros');
});

test('kelvoton koordinaatti hylätään, kelvollinen säilyy', () => {
  assert.equal(tarkistaGps({ lat: 91, lon: 20 }), null);
  assert.equal(tarkistaGps({ lat: 0, lon: 0 }), null);
  assert.equal(tarkistaGps(null), null);
  assert.deepEqual(tarkistaGps({ lat: 61.494, lon: 23.765 }), { lat: 61.494, lon: 23.765 });
});

test('versio kasvaa vain pisteiden muuttuessa, ei nimen', () => {
  const pisteet = tarkistaPisteet([{ nimi: 'Pääovi' }]).pisteet;
  const vanha = { nimi: 'Yökierros', pisteet };
  assert.equal(sisaltoMuuttui(vanha, { nimi: 'Iltakierros', pisteet }), false);
  const lisatty = tarkistaPisteet([{ id: pisteet[0].id, nimi: 'Pääovi' }, { nimi: 'Takaovi' }], pisteet).pisteet;
  assert.equal(sisaltoMuuttui(vanha, { nimi: 'Yökierros', pisteet: lisatty }), true);
});

test('julkinenPohja ei vuoda tokeneita', () => {
  const pisteet = tarkistaPisteet([{ nimi: 'Pääovi' }, { nimi: 'Takaovi' }]).pisteet;
  const julkinen = julkinenPohja({ id: 'p', nimi: 'Yökierros', pisteet });
  assert.equal(julkinen.pisteet.length, 2);
  for (const p of julkinen.pisteet) assert.equal(p.token, undefined);
  // Muu sisältö säilyy.
  assert.equal(julkinen.pisteet[0].nimi, 'Pääovi');
  assert.equal(julkinen.nimi, 'Yökierros');
});

test('piste löytyy tokenilla, väärä token ei osu', () => {
  const pisteet = tarkistaPisteet([{ nimi: 'Pääovi' }, { nimi: 'Takaovi' }]).pisteet;
  const pohjat = [{ id: 'pohja-1', pisteet }];
  const osuma = etsiPisteTokenilla(pohjat, pisteet[1].token);
  assert.equal(osuma.piste.nimi, 'Takaovi');
  assert.equal(osuma.pohja.id, 'pohja-1');
  assert.equal(etsiPisteTokenilla(pohjat, 'vaara-token'), null);
  assert.equal(etsiPisteTokenilla(pohjat, ''), null);
  assert.equal(etsiPisteTokenilla([], 'jokin'), null);
});

test('vain tunnetut pohjalajit kelpaavat', () => {
  assert.equal(onTunnettuLaji('patrol'), true);
  assert.equal(onTunnettuLaji('runsheet'), false);
  assert.equal(onTunnettuLaji('__proto__'), false);
});
