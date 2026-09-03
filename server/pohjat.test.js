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
  tarkistaKohdat, tarkistaKellonaika, lajinSolmu, lajinSisalto, LAJIT, KAIKKI_SOLMUT,
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
  assert.equal(onTunnettuLaji('guide'), true);
  assert.equal(onTunnettuLaji('tuntematon'), false);
  assert.equal(onTunnettuLaji('__proto__'), false);
});

// --- Lajit ja solmut (erä 8) ------------------------------------------------------

test('molemmille puolille kuuluvalla lajilla on eri solmu kohteelle ja tapahtumalle', () => {
  // Ilman erottelua GUARD-tunnuksen ohjeoikeus avaisi myös tapahtumapuolen ohjeet.
  assert.equal(lajinSolmu('guide', false), 'guides');
  assert.equal(lajinSolmu('guide', true), 'guard_guides');
  // Yhden puolen lajilla on vain yksi solmu kummallakin kysymystavalla.
  assert.equal(lajinSolmu('runsheet', false), 'runsheet');
  assert.equal(lajinSolmu('runsheet', true), 'runsheet');
  // Tuntematon laji ei saa pudota läpi tyhjällä: palautetaan solmu jota ei ole olemassa.
  assert.equal(lajinSolmu('keksitty', false), '__tuntematon_pohjalaji__');
});

test('kaikkien lajien solmut ovat listassa jonka oikeustarkistus lukee', () => {
  for (const laji of Object.values(LAJIT)) {
    assert.ok(KAIKKI_SOLMUT.includes(laji.solmu), `${laji.solmu} puuttuu`);
    if (laji.guardSolmu) assert.ok(KAIKKI_SOLMUT.includes(laji.guardSolmu), `${laji.guardSolmu} puuttuu`);
  }
});

test('lajin sisältö luetaan oikeasta kentästä', () => {
  assert.equal(lajinSisalto({ kind: 'patrol', pisteet: [1, 2] }).length, 2);
  assert.equal(lajinSisalto({ kind: 'play', kohdat: [1] }).length, 1);
  assert.deepEqual(lajinSisalto({ kind: 'play' }), []);
  assert.deepEqual(lajinSisalto({ kind: 'keksitty', kohdat: [1] }), []);
});

// --- Kohdat (ohjepankki, skenaario, run sheet) ------------------------------------

test('kohdat saavat id:n ja järjestyksen', () => {
  const tulos = tarkistaKohdat([{ teksti: 'Sulje portit' }, { teksti: 'Kuuluta' }], 'play');
  assert.equal(tulos.ok, true);
  assert.equal(tulos.kohdat[0].jarjestys, 0);
  assert.equal(tulos.kohdat[1].jarjestys, 1);
  assert.ok(tulos.kohdat[0].id);
  assert.notEqual(tulos.kohdat[0].id, tulos.kohdat[1].id);
});

test('tyhja lista ja tekstitön kohta torjutaan', () => {
  assert.equal(tarkistaKohdat([], 'play').ok, false);
  assert.equal(tarkistaKohdat(null, 'play').ok, false);
  assert.equal(tarkistaKohdat([{ teksti: '   ' }], 'play').ok, false);
});

test('sama kohta kahdesti torjutaan', () => {
  const tulos = tarkistaKohdat([{ id: 'a', teksti: 'Yksi' }, { id: 'a', teksti: 'Kaksi' }], 'play');
  assert.equal(tulos.ok, false);
});

test('lajikohtaiset kentät tulevat mukaan vain omalle lajilleen', () => {
  const play = tarkistaKohdat([{ teksti: 'Sulje portit', vastuu: 'Turva 1', kriittinen: true, aika: '14.00' }], 'play');
  assert.equal(play.kohdat[0].vastuu, 'Turva 1');
  assert.equal(play.kohdat[0].kriittinen, true);
  // Skenaariossa ei ole kellonaikaa: se on run sheetin kenttä.
  assert.equal(play.kohdat[0].aika, undefined);

  const ohje = tarkistaKohdat([{ teksti: 'Soita 112', vastuu: 'X', kriittinen: true }], 'guide');
  assert.equal(ohje.kohdat[0].vastuu, undefined);
  assert.equal(ohje.kohdat[0].kriittinen, undefined);

  const runsheet = tarkistaKohdat([{ teksti: 'Portit auki', aika: '14:00', vastuu: 'Portti 1' }], 'runsheet');
  assert.equal(runsheet.kohdat[0].aika, '14.00');
  assert.equal(runsheet.kohdat[0].vastuu, 'Portti 1');
  assert.equal(runsheet.kohdat[0].kriittinen, undefined);
});

test('kierrospohjan kohtia ei tarkisteta tällä funktiolla', () => {
  assert.equal(tarkistaKohdat([{ teksti: 'x' }], 'patrol').ok, false);
});

test('kellonaika normalisoidaan ja kelvoton torjutaan', () => {
  assert.equal(tarkistaKellonaika('9:05').aika, '09.05');
  assert.equal(tarkistaKellonaika('14.00').aika, '14.00');
  assert.equal(tarkistaKellonaika('').aika, '');
  assert.equal(tarkistaKellonaika('25.00').ok, false);
  assert.equal(tarkistaKellonaika('12.75').ok, false);
  assert.equal(tarkistaKellonaika('iltapäivällä').ok, false);
});

test('ohjauskoodit siivotaan myös kohdista', () => {
  const tulos = tarkistaKohdat([{ teksti: `Soita${String.fromCharCode(0)} 112`, kuvaus: `rivi${String.fromCharCode(10)}toinen` }], 'guide');
  assert.equal(tulos.kohdat[0].teksti, 'Soita 112');
  assert.equal(tulos.kohdat[0].kuvaus, 'rivi toinen');
});

test('kohtien muuttuminen kasvattaa versiota, myös kuvauksen', () => {
  const vanha = { kind: 'play', kohdat: tarkistaKohdat([{ teksti: 'Sulje portit', kuvaus: 'Kaikki' }], 'play').kohdat };
  const sama = { kind: 'play', kohdat: vanha.kohdat.map((k) => ({ ...k })) };
  assert.equal(sisaltoMuuttui(vanha, sama), false);

  const muuttunut = { kind: 'play', kohdat: vanha.kohdat.map((k) => ({ ...k, kuvaus: 'Vain päävportti' })) };
  assert.equal(sisaltoMuuttui(vanha, muuttunut), true);
});
