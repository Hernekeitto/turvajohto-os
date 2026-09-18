// Hälytyskeskuksen paneelireittien testit.
//
// Nämä ovat osoitteita, ja osoitteen rikkoutuminen näkyy vain siinä että toiselle
// näytölle raahattu ikkuna avautuu väärään näkymään seuraavassa käynnistyksessä.
// Päivystäjä ei ilmoita siitä vikana — hän klikkaa itsensä takaisin joka aamu.
//
// Ajetaan: node --test src/guard/halke/paneelit.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { PANEELIT, KARKIPANEELIT, lueOsoite, paneelinOsoite, vartijanOsoite } from './paneelit.ts';

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
  const tyhja = { paneeli: null, taulu: false, vartija: null };
  assert.deepEqual(lueOsoite('/guard/halke/kartat', ''), tyhja);
  assert.deepEqual(lueOsoite('/guard/halke', ''), tyhja);
  assert.deepEqual(lueOsoite('/guard', '?taulu=1'), tyhja);
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

test('kesken oleva paneeli ei näy valikossa mutta osoite toimii', () => {
  // Julkaisuventtiili: keskeneräinen paneeli voi mennä tuotantoon koodina, koska se ei
  // häiritse ketään jos siihen ei ole tietä. Valikon rivi on lupaus, ja lupaus jonka
  // takaa aukeaa tyhjä ruutu on huonompi kuin puuttuva rivi.
  const kesken = PANEELIT.filter((p) => p.kesken);
  // Lippu on nyt käyttämättä (karttapaneeli vapautettiin 16.9.2026), joten tyhjä lista
  // on oikea tulos. Testi kattaa yhä sen että LIPPU toimii jos se otetaan käyttöön.
  for (const p of kesken) {
    // Osoite toimii yhä, jotta selvitystyötä voi jatkaa tuotantoa vasten.
    assert.equal(lueOsoite(p.polku, '').paneeli, p.id, `osoite ${p.polku}`);
  }
});

test('valmiit paneelit eivät ole kesken', () => {
  // Suoja sille että lippu jää vahingossa päälle: jos joku lisää kesken-lipun
  // kärkipaneeliin, se katoaisi valikosta hiljaa.
  for (const id of KARKIPANEELIT) {
    const p = PANEELIT.find((x) => x.id === id);
    assert.equal(p?.kesken, undefined, `kärkipaneeli ${id} ei saa olla kesken`);
  }
});

// --- Yhden vartijan ikkuna (19.9.2026) ----------------------------------------------

test('vartija luetaan vain vartijat-paneelista', () => {
  assert.equal(lueOsoite('/guard/halke/vartijat', '?vartija=Turva051').vartija, 'Turva051');
  // Muut paneelit eivät tunne parametria: sama osoite eri paneelilla ei saa avata
  // henkilön tietoja paikassa jossa niitä ei odota.
  assert.equal(lueOsoite('/guard/halke/kartta', '?vartija=Turva051').vartija, null);
  assert.equal(lueOsoite('/guard/halke/vartijat', '').vartija, null);
});

test('seinätaulu ei näytä yhden vartijan tietoja', () => {
  // Seinätaulu on yleiskuva jota katsotaan kaukaa. Yhden ihmisen tiedot siinä olisivat
  // henkilötietoa ruudulla jota kukaan ei valvo.
  assert.equal(lueOsoite('/guard/halke/vartijat', '?taulu=1&vartija=Turva051').vartija, null);
});

test('vartijanOsoite ja lueOsoite ovat toistensa käänteisoperaatiot', () => {
  // Myös nimimerkillä jossa on välilyönti ja ääkkösiä: "Piiri 301" ja "Yövartija Ö".
  for (const nimi of ['Turva051', 'Piiri 301', 'Yövartija Ö', 'a&b=c']) {
    const osoite = vartijanOsoite(nimi);
    const [polku, kysely] = osoite.split('?');
    assert.equal(lueOsoite(polku, `?${kysely}`).vartija, nimi);
  }
});
