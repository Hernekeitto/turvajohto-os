// Henkilökohtaisen tallennustilan säännöt (29.9.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MT, VARTIJAN_KIINTIO, OLETUSKIINTIO, PUSKURI, kayttajanRaja, kaytto, tarkistaTila,
  puhdistaNimi, omaKansio, alipuu, voiSiirtaa, luoPyynto, kasittelePyynto, lisatila,
} from './omattiedostot.js';

test('kiintiö tason mukaan: vartija 500 Mt, muut 5 Gt, pääkäyttäjä ei rajaa', () => {
  assert.equal(kayttajanRaja({ username: 'v', roleId: 'vartija', role: 'user' }, []), VARTIJAN_KIINTIO);
  assert.equal(kayttajanRaja({ username: 'e', roleId: 'vartioesimies', role: 'user' }, []), OLETUSKIINTIO);
  assert.equal(kayttajanRaja({ username: 'a', roleId: 'admin', role: 'admin' }, []), null);
});

test('hyväksytty lisätila kasvattaa rajaa, hylätty ja odottava eivät', () => {
  const pyynnot = [
    { username: 'v', tila: 'hyvaksytty', myonnettyMt: 1024 },
    { username: 'v', tila: 'hylatty', myonnettyMt: 0 },
    { username: 'v', tila: 'odottaa', myonnettyMt: 0 },
    { username: 'x', tila: 'hyvaksytty', myonnettyMt: 500 },
  ];
  assert.equal(lisatila(pyynnot, 'v'), 1024 * MT);
  assert.equal(kayttajanRaja({ username: 'v', roleId: 'vartija' }, pyynnot), VARTIJAN_KIINTIO + 1024 * MT);
});

test('käyttö lasketaan vain omista tiedostoista, kansiot eivät vie tilaa', () => {
  const tiedostot = [
    { omistaja: 'v', type: 'file', size: 100 },
    { omistaja: 'v', type: 'folder' },
    { omistaja: 'x', type: 'file', size: 999 },
  ];
  assert.equal(kaytto(tiedostot, 'v'), 100);
});

test('rajan yli saa mennä puskurin verran ilmoituksen kanssa, ei enempää', () => {
  const raja = 500 * MT;
  assert.deepEqual(tarkistaTila({ kaytetty: 400 * MT, koko: 50 * MT, raja }), { ok: true, ylitys: false });
  assert.deepEqual(tarkistaTila({ kaytetty: 490 * MT, koko: 20 * MT, raja }), { ok: true, ylitys: true });
  assert.equal(tarkistaTila({ kaytetty: raja + PUSKURI - 1, koko: 2, raja }).ok, false);
  assert.deepEqual(tarkistaTila({ kaytetty: 10 ** 12, koko: 10 ** 9, raja: null }), { ok: true, ylitys: false });
});

test('nimestä ei tule polkua', () => {
  assert.equal(puhdistaNimi('../salaisuus/tiedosto.pdf'), '..salaisuustiedosto.pdf');
  assert.equal(puhdistaNimi('..'), '');
  assert.equal(puhdistaNimi('  Raportti\u0000.odt  '), 'Raportti.odt');
});

test('kansiot: vain oma kansio kelpaa, eikä kansiota siirretä omaan alipuuhunsa', () => {
  const t = [
    { id: 'a', type: 'folder', omistaja: 'v', parentId: null },
    { id: 'b', type: 'folder', omistaja: 'v', parentId: 'a' },
    { id: 'c', type: 'file', omistaja: 'v', parentId: 'b' },
    { id: 'z', type: 'folder', omistaja: 'x', parentId: null },
  ];
  assert.equal(omaKansio(t, 'v', 'a'), true);
  assert.equal(omaKansio(t, 'v', 'z'), false);
  assert.equal(omaKansio(t, 'v', 'c'), false);
  assert.equal(omaKansio(t, 'v', null), true);
  assert.deepEqual([...alipuu(t, 'a')].sort(), ['a', 'b', 'c']);
  assert.equal(voiSiirtaa(t, 'a', 'b'), false);
  assert.equal(voiSiirtaa(t, 'b', null), true);
});

test('lisätilapyyntö vaatii perustelun ja määrän, päätös tehdään kerran', () => {
  assert.equal(luoPyynto({ username: 'v', perustelu: 'lyhyt', maaraMt: 500 }).ok, false);
  assert.equal(luoPyynto({ username: 'v', perustelu: 'Kuvaan kohteen jokaisen kierroksen', maaraMt: 7 }).ok, false);
  const { pyynto } = luoPyynto({ username: 'v', perustelu: 'Kuvaan kohteen jokaisen kierroksen', maaraMt: 1024 });
  assert.equal(pyynto.tila, 'odottaa');

  const hyv = kasittelePyynto({ pyynto, hyvaksy: true, maaraMt: 500, kasittelija: 'admin' });
  assert.equal(hyv.pyynto.tila, 'hyvaksytty');
  assert.equal(hyv.pyynto.myonnettyMt, 500);
  assert.equal(hyv.pyynto.kuitattu, false);
  assert.equal(kasittelePyynto({ pyynto: hyv.pyynto, hyvaksy: false, kasittelija: 'admin' }).ok, false);

  const hyl = kasittelePyynto({ pyynto, hyvaksy: false, kasittelija: 'admin', syy: 'Levy täynnä' });
  assert.equal(hyl.pyynto.tila, 'hylatty');
  assert.equal(hyl.pyynto.myonnettyMt, 0);
  assert.equal(hyl.pyynto.paatoksenSyy, 'Levy täynnä');
});
