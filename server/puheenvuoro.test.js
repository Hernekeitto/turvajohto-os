// Floor controlin testit (erä 26, vaihe 1b).
//
// Painopiste: haltija tunnistetaan istunnosta eikä käyttäjätunnuksesta, varattu kanava
// hylkää muut heti ilman jonoa, ja aikakatkaisu vapauttaa jumiutuneen tilan.
//
// Ajetaan: node --test server/puheenvuoro.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AIKAKATKAISU_MS, AIKAKATKAISU_HATA_MS, nykyinenHaltija, onHaltija, pyydaPuheenvuoro, tyhjenna,
  vapautaIstunnolta, vapautaPuheenvuoro,
} from './puheenvuoro.js';

// Kevyet "istunto"-oliot: puheenvuoro.js ei tunne niiden sisältöä, vain identiteetin
// (===-vertailu), joten pelkkä erottuva olio riittää testissä.
const istunto1 = { username: 'vartija1' };
const istunto2 = { username: 'vartija2' };

test.beforeEach(() => tyhjenna());

test('vapaa kanava myönnetään heti', () => {
  const tulos = pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto1, kayttaja: 'vartija1' });
  assert.equal(tulos.ok, true);
  assert.equal(nykyinenHaltija('kohde:1'), 'vartija1');
});

test('varattu kanava hylätään heti, ei jonoa', () => {
  pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto1, kayttaja: 'vartija1' });
  const tulos = pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto2, kayttaja: 'vartija2' });
  assert.equal(tulos.ok, false);
  assert.equal(tulos.syy, 'varattu');
  assert.equal(tulos.kayttaja, 'vartija1');
  assert.equal(nykyinenHaltija('kohde:1'), 'vartija1');
});

test('saman istunnon toistuva pyyntö ei ole virhe eikä pidennä aikakatkaisua', () => {
  pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto1, kayttaja: 'vartija1', nyt: 0 });
  const toisto = pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto1, kayttaja: 'vartija1', nyt: 100 });
  assert.equal(toisto.ok, true);
  assert.equal(toisto.jo_haltijana, true);
  // Alkuperäinen alkoi (0) ei ole nollautunut: aikakatkaisu lasketaan siitä eikä
  // toistopyynnöstä.
  assert.equal(nykyinenHaltija('kohde:1', AIKAKATKAISU_MS - 1), 'vartija1');
  assert.equal(nykyinenHaltija('kohde:1', AIKAKATKAISU_MS), null);
});

test('muu istunto ei voi vapauttaa toisen puheenvuoroa', () => {
  pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto1, kayttaja: 'vartija1' });
  assert.equal(vapautaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto2 }), false);
  assert.equal(nykyinenHaltija('kohde:1'), 'vartija1');
});

test('haltija voi vapauttaa oman puheenvuoronsa, jonka jälkeen kanava on taas vapaa', () => {
  pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto1, kayttaja: 'vartija1' });
  assert.equal(vapautaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto1 }), true);
  assert.equal(nykyinenHaltija('kohde:1'), null);
  const uusi = pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto2, kayttaja: 'vartija2' });
  assert.equal(uusi.ok, true);
});

test('aikakatkaisun jälkeen kanava vapautuu ilman eksplisiittistä vapautusta', () => {
  pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto1, kayttaja: 'vartija1', nyt: 0 });
  assert.equal(nykyinenHaltija('kohde:1', AIKAKATKAISU_MS - 1), 'vartija1');
  assert.equal(nykyinenHaltija('kohde:1', AIKAKATKAISU_MS), null);
  // Ja koska vanha tila on vanhentunut, uusi pyyntö läpäisee eikä hylkäydy "varattuna".
  const tulos = pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto2, kayttaja: 'vartija2', nyt: AIKAKATKAISU_MS });
  assert.equal(tulos.ok, true);
});

test('vapautaIstunnolta vapauttaa kaikki tämän istunnon kanavat mutta ei muiden', () => {
  pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto1, kayttaja: 'vartija1' });
  pyydaPuheenvuoro({ kanavaId: 'piiri:301', istunto: istunto1, kayttaja: 'vartija1' });
  pyydaPuheenvuoro({ kanavaId: 'kohde:2', istunto: istunto2, kayttaja: 'vartija2' });

  const vapautetut = vapautaIstunnolta(istunto1);
  assert.deepEqual(new Set(vapautetut), new Set(['kohde:1', 'piiri:301']));
  assert.equal(nykyinenHaltija('kohde:1'), null);
  assert.equal(nykyinenHaltija('piiri:301'), null);
  assert.equal(nykyinenHaltija('kohde:2'), 'vartija2');
});

test('vapautaIstunnolta tyhjälle tilalle ei tee mitään eikä kaadu', () => {
  assert.deepEqual(vapautaIstunnolta(istunto1), []);
});

test('onHaltija: vain nykyinen haltija-istunto läpäisee, ei sama käyttäjätunnus toisella istunnolla', () => {
  pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto1, kayttaja: 'vartija1' });
  assert.equal(onHaltija('kohde:1', istunto1), true);
  assert.equal(onHaltija('kohde:1', istunto2), false);
  assert.equal(onHaltija('kanava-jota-ei-ole', istunto1), false);
});

test('onHaltija: vanhentunut tila ei laske haltijaksi', () => {
  pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto1, kayttaja: 'vartija1', nyt: 0 });
  assert.equal(onHaltija('kohde:1', istunto1, AIKAKATKAISU_MS - 1), true);
  assert.equal(onHaltija('kohde:1', istunto1, AIKAKATKAISU_MS), false);
});

// --- Kanavakohtainen aikakatkaisu (erä 26, vaihe 8, käyttäjän päätös 22.9.2026) -----

test('mukautettu aikakatkaisu (esim. hätäkanavan pidempi) ohittaa oletuksen', () => {
  pyydaPuheenvuoro({
    kanavaId: 'hata:1', istunto: istunto1, kayttaja: 'vartija1', nyt: 0, aikakatkaisuMs: AIKAKATKAISU_HATA_MS,
  });
  // Yli tavallisen 60 s aikakatkaisun mutta yhä hätäkanavan 5 min sisällä.
  assert.equal(nykyinenHaltija('hata:1', AIKAKATKAISU_MS + 1), 'vartija1');
  assert.equal(nykyinenHaltija('hata:1', AIKAKATKAISU_HATA_MS - 1), 'vartija1');
  assert.equal(nykyinenHaltija('hata:1', AIKAKATKAISU_HATA_MS), null);
});

test('kanavat joilla ei ole mukautettua aikakatkaisua käyttävät oletusta ennallaan', () => {
  pyydaPuheenvuoro({ kanavaId: 'kohde:1', istunto: istunto1, kayttaja: 'vartija1', nyt: 0 });
  assert.equal(nykyinenHaltija('kohde:1', AIKAKATKAISU_MS - 1), 'vartija1');
  assert.equal(nykyinenHaltija('kohde:1', AIKAKATKAISU_MS), null);
});
