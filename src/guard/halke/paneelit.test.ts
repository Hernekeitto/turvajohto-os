// Hälytyskeskuksen paneelireittien testit.
//
// Nämä ovat osoitteita, ja osoitteen rikkoutuminen näkyy vain siinä että toiselle
// näytölle raahattu ikkuna avautuu väärään näkymään seuraavassa käynnistyksessä.
// Päivystäjä ei ilmoita siitä vikana — hän klikkaa itsensä takaisin joka aamu.
//
// Ajetaan: node --test src/guard/halke/paneelit.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { PANEELIT, KARKIPANEELIT, lueOsoite, paneelinOsoite } from './paneelit.ts';

test('jokainen paneeli löytyy omasta osoitteestaan', () => {
  // Rekisteri ja lukija on pidettävä synkassa käsin, joten tämä testi on se joka
  // huomaa jos uusi paneeli lisätään listaan mutta sen polku kirjoitetaan väärin.
  for (const p of PANEELIT) {
    assert.equal(lueOsoite(p.polku, '').paneeli, p.id, `paneeli ${p.id}`);
  }
});

test('kartta on oma paneelinsa ja seinätaulukelpoinen', () => {
  const kartta = PANEELIT.find((p) => p.id === 'kartta');
  assert.ok(kartta, 'kartta puuttuu rekisteristä');
  assert.equal(kartta.polku, '/guard/halke/kartta');
  // Kartta on se paneeli jota varten seinätaulu ensisijaisesti on: se kertoo tilanteen
  // yhdellä silmäyksellä kolmen metrin päästä, mihin yksikään lista ei pysty.
  assert.equal(kartta.taulukelpoinen, true);
});

test('seinätaulutila luetaan vain kelpaavalle paneelille', () => {
  assert.equal(lueOsoite('/guard/halke/kartta', '?taulu=1').taulu, true);
  // Kohteet ja tausta ovat selattavia listoja joista ei näe kaukaa mitään.
  assert.equal(lueOsoite('/guard/halke/kohteet', '?taulu=1').taulu, false);
});

test('tuntematon paneeli ei ole virhe vaan koostenäkymä', () => {
  // Väärin kirjoitettu osoite ei saa tuottaa tyhjää ruutua valvomoon.
  assert.deepEqual(lueOsoite('/guard/halke/kartat', ''), { paneeli: null, taulu: false });
  assert.deepEqual(lueOsoite('/guard/halke', ''), { paneeli: null, taulu: false });
  assert.deepEqual(lueOsoite('/guard', '?taulu=1'), { paneeli: null, taulu: false });
});

test('osoite on riippumaton kirjainkoosta ja lopun kenoviivasta', () => {
  assert.equal(lueOsoite('/GUARD/HALKE/KARTTA/', '').paneeli, 'kartta');
});

test('paneelinOsoite ja lueOsoite ovat toistensa käänteisoperaatiot', () => {
  for (const p of PANEELIT) {
    const osoite = paneelinOsoite(p.id, true);
    const [polku, kysely] = osoite.split('?');
    const luettu = lueOsoite(polku, kysely ? `?${kysely}` : '');
    assert.equal(luettu.paneeli, p.id, `paneeli ${p.id}`);
    assert.equal(luettu.taulu, p.taulukelpoinen, `taulu ${p.id}`);
  }
});

test('kärkipaneelit ovat olemassa olevia paneeleita', () => {
  // Kirjoitusvirhe tässä listassa piilottaisi paneelin koostenäkymän järjestyksestä
  // hiljaa, eikä siitä tulisi virhettä mistään.
  for (const id of KARKIPANEELIT) {
    assert.ok(PANEELIT.some((p) => p.id === id), `tuntematon kärkipaneeli: ${id}`);
  }
});
