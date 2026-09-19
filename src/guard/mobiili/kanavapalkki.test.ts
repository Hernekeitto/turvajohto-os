// PTT-kanavapalkin kanavalogiikan testit (erä 26, vaihe 5, viipale 5a).
//
// Ajetaan: node --test src/guard/mobiili/kanavapalkki.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  type Kanava, hatakanavat, chipKanavat, voiMykistaa, kuunneltavatIdt, oletusLahetyskohde,
} from './kanavapalkki.ts';

const kanavat: Kanava[] = [
  { id: 'vapaa1', tyyppi: 'vapaa', nimi: 'Iltavuoron ryhmä' },
  { id: 'hata1', tyyppi: 'hata', nimi: 'Hätäkanava — vartija1' },
  { id: 'dm1', tyyppi: 'dm', nimi: 'vartija2' },
  { id: 'kohde1', tyyppi: 'kohde', nimi: 'Kauppakeskus X' },
  { id: 'piiri1', tyyppi: 'piiri', nimi: 'Piiri A' },
];

test('hatakanavat palauttaa vain hätätyyppiset', () => {
  assert.deepEqual(hatakanavat(kanavat).map((k) => k.id), ['hata1']);
});

test('chipKanavat jättää hätäkanavan pois ja järjestää kiinteät ensin', () => {
  assert.deepEqual(chipKanavat(kanavat).map((k) => k.id), ['kohde1', 'piiri1', 'vapaa1', 'dm1']);
});

test('chipKanavat säilyttää ryhmien sisäisen järjestyksen', () => {
  const jarjestys: Kanava[] = [
    { id: 'piiri1', tyyppi: 'piiri', nimi: 'Piiri A' },
    { id: 'kohde1', tyyppi: 'kohde', nimi: 'Kauppakeskus X' },
    { id: 'dm2', tyyppi: 'dm', nimi: 'vartija3' },
    { id: 'vapaa1', tyyppi: 'vapaa', nimi: 'Iltavuoron ryhmä' },
  ];
  assert.deepEqual(chipKanavat(jarjestys).map((k) => k.id), ['piiri1', 'kohde1', 'dm2', 'vapaa1']);
});

test('voiMykistaa sallii vain dm:n ja vapaan ryhmän', () => {
  assert.equal(voiMykistaa({ id: 'x', tyyppi: 'dm', nimi: '' }), true);
  assert.equal(voiMykistaa({ id: 'x', tyyppi: 'vapaa', nimi: '' }), true);
  assert.equal(voiMykistaa({ id: 'x', tyyppi: 'kohde', nimi: '' }), false);
  assert.equal(voiMykistaa({ id: 'x', tyyppi: 'piiri', nimi: '' }), false);
  assert.equal(voiMykistaa({ id: 'x', tyyppi: 'hata', nimi: '' }), false);
});

test('kuunneltavatIdt jättää pois vain mykistetyn dm:n tai vapaan ryhmän', () => {
  const tulos = kuunneltavatIdt(kanavat, new Set(['vapaa1']));
  assert.deepEqual(new Set(tulos), new Set(['hata1', 'dm1', 'kohde1', 'piiri1']));
});

test('kuunneltavatIdt ei jätä pois kiinteää tai hätäkanavaa vaikka id olisi mykistyslistalla', () => {
  const tulos = kuunneltavatIdt(kanavat, new Set(['hata1', 'kohde1']));
  assert.ok(tulos.includes('hata1') && tulos.includes('kohde1'));
});

test('oletusLahetyskohde säilyttää edellisen valinnan jos kanava on yhä listalla', () => {
  assert.equal(oletusLahetyskohde(kanavat, 'dm1'), 'dm1');
});

test('oletusLahetyskohde palaa ensimmäiseen chip-kanavaan jos edellinen puuttuu', () => {
  assert.equal(oletusLahetyskohde(kanavat, 'poistunut'), 'kohde1');
});

test('oletusLahetyskohde palauttaa null jos chip-kanavia ei ole', () => {
  assert.equal(oletusLahetyskohde([{ id: 'hata1', tyyppi: 'hata', nimi: '' }], null), null);
});
