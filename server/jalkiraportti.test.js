// Jälkiraportin sääntöjen testit (erä 9).
//
// Painopiste on lukituksessa ja jäädytyksessä: valmis raportti ei saa muuttua hiljaa,
// eivätkä sen luvut saa elää alkuperäisen datan mukana. Molemmat ovat sen koko
// käyttötarkoitus — jaettu dokumentti johon voidaan palata vuoden päästä.
//
// Ajetaan: node --test server/jalkiraportti.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  luoJalkiraportti, paivita, merkitseValmiiksi, avaaUudelleen, onLukittu, kooste, OSIOT,
} from './jalkiraportti.js';

const LUVUT = { kirjaukset: { yhteensa: 12 }, laskettu: '2026-09-04T06:00:00.000Z' };

const luo = (yli = {}) => luoJalkiraportti({
  id: 'jr-1',
  ownerId: 'tapahtuma-1',
  omistaja: 'tapahtuma',
  nimi: 'Festari 2026 — purku',
  ikkuna: { alku: '2026-09-01T00:00:00.000Z', loppu: '2026-09-03T00:00:00.000Z' },
  kooste: LUVUT,
  user: 'tike',
  nyt: new Date('2026-09-04T06:00:00.000Z'),
  ...yli,
}).raportti;

test('luonti jäädyttää luvut ja aloittaa luonnoksena', () => {
  const r = luo();
  assert.equal(r.tila, 'luonnos');
  assert.equal(r.kooste.kirjaukset.yhteensa, 12);
  assert.equal(r.valmis, null);
  assert.equal(r.historia.length, 1);
  for (const osio of OSIOT) assert.equal(r[osio.id], '');
});

test('nimetöntä tai luvutonta raporttia ei synny', () => {
  assert.equal(luoJalkiraportti({ nimi: '   ', kooste: LUVUT }).ok, false);
  assert.equal(luoJalkiraportti({ nimi: 'Purku', kooste: null }).ok, false);
});

test('luonnosta muokataan vapaasti', () => {
  const r = luo();
  const tulos = paivita({ raportti: r, muutokset: { yhteenveto: 'Rauhallinen ilta.', kehitettavaa: 'Portti B ruuhkautui.' }, user: 'tike' });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.raportti.yhteenveto, 'Rauhallinen ilta.');
  assert.equal(tulos.raportti.muokkaaja, 'tike');
  // Historiaan ei kirjata joka tallennusta: luonnosta kirjoitetaan kymmeniä kertoja.
  assert.equal(tulos.raportti.historia.length, 1);
});

test('tyhjää raporttia ei voi merkitä valmiiksi', () => {
  const tulos = merkitseValmiiksi({ raportti: luo(), user: 'tike' });
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /havainto/);
});

test('valmis raportti on lukittu muokkaukselta', () => {
  const r = paivita({ raportti: luo(), muutokset: { yhteenveto: 'Kaksi ensiaputehtävää.' } }).raportti;
  const valmis = merkitseValmiiksi({ raportti: r, user: 'tike', nyt: new Date('2026-09-04T08:00:00.000Z') });
  assert.equal(valmis.ok, true);
  assert.equal(onLukittu(valmis.raportti), true);
  assert.equal(valmis.raportti.valmis.user, 'tike');

  const yritys = paivita({ raportti: valmis.raportti, muutokset: { yhteenveto: 'Ei mitään tapahtunut.' } });
  assert.equal(yritys.ok, false);
  assert.match(yritys.error, /lukittu/);
  assert.equal(merkitseValmiiksi({ raportti: valmis.raportti }).ok, false);
});

test('avaaminen vaatii syyn ja jää historiaan', () => {
  const r = paivita({ raportti: luo(), muutokset: { oppi: 'Lisää henkilöstöä portille.' } }).raportti;
  const valmis = merkitseValmiiksi({ raportti: r, user: 'tike' }).raportti;

  assert.equal(avaaUudelleen({ raportti: valmis, user: 'tike', syy: '  ' }).ok, false);

  const avattu = avaaUudelleen({
    raportti: valmis, user: 'paallikko', syy: 'Väärä kellonaika yhteenvedossa.',
    nyt: new Date('2026-09-05T09:00:00.000Z'),
  });
  assert.equal(avattu.ok, true);
  assert.equal(avattu.raportti.tila, 'luonnos');
  assert.equal(avattu.raportti.valmis, null);
  const viimeisin = avattu.raportti.historia.at(-1);
  assert.equal(viimeisin.tapahtuma, 'avattu');
  assert.equal(viimeisin.teksti, 'Väärä kellonaika yhteenvedossa.');
  assert.equal(viimeisin.user, 'paallikko');
  // Valmiiksi merkintä ei katoa historiasta avaamisen myötä.
  assert.equal(avattu.raportti.historia.some((h) => h.tapahtuma === 'valmis'), true);
});

test('luonnosta ei voi avata uudelleen', () => {
  assert.equal(avaaUudelleen({ raportti: luo(), syy: 'x' }).ok, false);
});

test('tekstitön toimenpide karsiutuu, vastuu ja määräpäivä säilyvät', () => {
  const tulos = paivita({
    raportti: luo(),
    muutokset: {
      toimenpiteet: [
        { teksti: 'Lisää yksi JV portille B', vastuu: 'Turvapäällikkö', maarapaiva: '2026-10-01' },
        { teksti: '   ', vastuu: 'Kukaan' },
        { teksti: 'Uusi radiokanava rakennusvaiheeseen', maarapaiva: 'ensi kuussa' },
      ],
    },
  });
  assert.equal(tulos.raportti.toimenpiteet.length, 2);
  assert.equal(tulos.raportti.toimenpiteet[0].vastuu, 'Turvapäällikkö');
  assert.equal(tulos.raportti.toimenpiteet[0].maarapaiva, '2026-10-01');
  // Kelvoton päivämäärä ei mene läpi sellaisenaan: määräpäivä jota ei voi verrata
  // kalenteriin ei ole määräpäivä.
  assert.equal(tulos.raportti.toimenpiteet[1].maarapaiva, '');
});

test('yhden toimenpiteen kirjaaminen riittää valmiiksi merkitsemiseen', () => {
  const r = paivita({ raportti: luo(), muutokset: { toimenpiteet: [{ teksti: 'Tilaa lisää vesipisteitä' }] } }).raportti;
  assert.equal(merkitseValmiiksi({ raportti: r, user: 'tike' }).ok, true);
});

test('listakooste kertoo avoimet toimenpiteet lukematta koko raporttia', () => {
  const r = paivita({
    raportti: luo(),
    muutokset: { toimenpiteet: [{ teksti: 'a', tehty: true }, { teksti: 'b' }, { teksti: 'c' }] },
  }).raportti;
  const k = kooste(r);
  assert.equal(k.toimenpiteita, 3);
  assert.equal(k.avoimiaToimenpiteita, 2);
  assert.equal(k.ikkuna.alku, '2026-09-01T00:00:00.000Z');
  assert.equal(k.kooste, undefined, 'listarivi ei kanna jäädytettyjä lukuja mukanaan');
});
