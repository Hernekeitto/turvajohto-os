// Vuorosääntöjen testit (erä 16).
//
// Painopiste on kahdessa asiassa. Ensin ne tapaukset joissa pääsy EI saa syntyä: tyhjä
// vuorolista, kytkemätön perehdytys, toisen tunnuksen perehdytys. Sitten kello, koska
// yövuoro ylittää puolenyön ja vuorokausiympyrä on juuri se kohta jossa aikavertailu
// menee tavallisesti väärin.
//
// Ajetaan: node --test server/vuorot.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  JOUSTO_MIN,
  minuutit, onKytketty, perehdytetytVuorot, saakoAloittaa, vuoroIkkunassa, vuorovaihtoehdot,
} from './vuorot.js';

// Kello annetaan aina paikallisena, koska vuoroikkuna on paikallista aikaa: vartija tulee
// töihin seitsemäksi riippumatta siitä mitä UTC sanoo.
const klo = (tunti, min = 0) => new Date(2026, 8, 10, tunti, min, 0);

const AAMU = { id: 'v-aamu', nimi: 'Aamuvuoro', alkaa: '07:00', paattyy: '15:00', tehtavaIdt: ['t1'], pohjaIdt: ['p1'] };
const ILTA = { id: 'v-ilta', nimi: 'Iltavuoro', alkaa: '15:00', paattyy: '23:00' };
const YO = { id: 'v-yo', nimi: 'Yövuoro', alkaa: '23:00', paattyy: '07:00' };
const LISA = { id: 'v-lisa', nimi: 'Lisävuoro' };

const kohde = (yli = {}) => ({
  id: 'kohde-1',
  name: 'Kauppakeskus Hansa',
  vuorotyypit: [AAMU, ILTA, YO, LISA],
  perehdytykset: [],
  ...yli,
});

const perehdytys = (yli = {}) => ({
  id: 'p1',
  nimi: 'Virtanen Matti',
  username: 'vartija1',
  pvm: '2026-09-01',
  vuorotyyppiIdt: ['v-aamu'],
  ...yli,
});

// --- Kellonaikojen jäsennys ---------------------------------------------------------

test('kellonaika jäsentyy minuuteiksi', () => {
  assert.equal(minuutit('07:00'), 420);
  assert.equal(minuutit('00:00'), 0);
  assert.equal(minuutit('23:59'), 1439);
  assert.equal(minuutit('7:05'), 425);
});

test('kelvoton kellonaika on null eikä nolla', () => {
  // Ero on koko funktion tarkoitus: puolenyö ja puuttuva aika eivät saa olla sama asia.
  assert.equal(minuutit('00:00'), 0);
  for (const kelvoton of ['', null, undefined, 'aamulla', '24:00', '12:60', '7', '7:5']) {
    assert.equal(minuutit(kelvoton), null, `piti olla null: ${kelvoton}`);
  }
});

// --- Vuoroikkuna --------------------------------------------------------------------

test('vuoro ilman kellonaikoja on aina auki', () => {
  // Puuttuva rajoite ei saa muuttua rajoitteeksi.
  assert.equal(vuoroIkkunassa({ vuorotyyppi: LISA, nyt: klo(3) }).ok, true);
  assert.equal(vuoroIkkunassa({ vuorotyyppi: LISA, nyt: klo(14) }).ok, true);
});

test('aamuvuoroon pääsee ikkunassa ja jouston sisällä', () => {
  assert.equal(vuoroIkkunassa({ vuorotyyppi: AAMU, nyt: klo(7) }).ok, true);
  assert.equal(vuoroIkkunassa({ vuorotyyppi: AAMU, nyt: klo(11) }).ok, true);
  assert.equal(vuoroIkkunassa({ vuorotyyppi: AAMU, nyt: klo(5) }).ok, true, 'kaksi tuntia ennen');
  assert.equal(vuoroIkkunassa({ vuorotyyppi: AAMU, nyt: klo(17) }).ok, true, 'kaksi tuntia jälkeen');
});

test('aamuvuoroon ei pääse jouston ulkopuolelta', () => {
  assert.equal(vuoroIkkunassa({ vuorotyyppi: AAMU, nyt: klo(4, 59) }).syy, 'ikkunan_ulkopuolella');
  assert.equal(vuoroIkkunassa({ vuorotyyppi: AAMU, nyt: klo(17, 1) }).syy, 'ikkunan_ulkopuolella');
  assert.equal(vuoroIkkunassa({ vuorotyyppi: AAMU, nyt: klo(23) }).syy, 'ikkunan_ulkopuolella');
});

test('yövuoro ylittää puolenyön', () => {
  // Tämä on se tapaus jossa lukujen vertailu menee väärin: 23 > 07, joten jana ei kelpaa.
  assert.equal(vuoroIkkunassa({ vuorotyyppi: YO, nyt: klo(23, 30) }).ok, true);
  assert.equal(vuoroIkkunassa({ vuorotyyppi: YO, nyt: klo(0, 15) }).ok, true, 'puolenyön jälkeen');
  assert.equal(vuoroIkkunassa({ vuorotyyppi: YO, nyt: klo(3) }).ok, true);
  assert.equal(vuoroIkkunassa({ vuorotyyppi: YO, nyt: klo(8, 30) }).ok, true, 'jousto aamulla');
  assert.equal(vuoroIkkunassa({ vuorotyyppi: YO, nyt: klo(12) }).syy, 'ikkunan_ulkopuolella');
});

test('vuorokauden mittainen vuoro on aina auki', () => {
  // paattyy === alkaa tarkoittaa vuorokautta eikä nollaa: nollan mittainen vuoro ei ole
  // mikään vuoro, joten se tulkinta ei voi olla oikea.
  const ympari = { id: 'v', nimi: 'Ympärivuorokautinen', alkaa: '12:00', paattyy: '12:00' };
  for (const tunti of [0, 6, 12, 18, 23]) {
    assert.equal(vuoroIkkunassa({ vuorotyyppi: ympari, nyt: klo(tunti) }).ok, true);
  }
});

test('jousto on säädettävissä', () => {
  assert.equal(vuoroIkkunassa({ vuorotyyppi: AAMU, nyt: klo(5, 30), joustoMin: 0 }).ok, false);
  assert.equal(vuoroIkkunassa({ vuorotyyppi: AAMU, nyt: klo(5, 30), joustoMin: JOUSTO_MIN }).ok, true);
});

// --- Perehdytys ---------------------------------------------------------------------

test('perehdytys myöntää vain merkityt vuorot', () => {
  const k = kohde({ perehdytykset: [perehdytys({ vuorotyyppiIdt: ['v-aamu', 'v-ilta'] })] });
  const sallitut = perehdytetytVuorot(k, 'vartija1');
  assert.equal(sallitut.has('v-aamu'), true);
  assert.equal(sallitut.has('v-ilta'), true);
  assert.equal(sallitut.has('v-yo'), false);
});

test('TYHJÄ VUOROLISTA EI MYÖNNÄ MITÄÄN', () => {
  // Tarkoituksellinen poikkeus eventAccess-käytännöstä. Jos tämä testi kaatuu siksi että
  // joku "yhdenmukaisti" säännön, puolivalmis perehdytysmerkintä alkaa myöntää pääsyn
  // jokaiseen vuoroon eikä virhe erotu harkitusta päätöksestä.
  const k = kohde({ perehdytykset: [perehdytys({ vuorotyyppiIdt: [] })] });
  assert.equal(perehdytetytVuorot(k, 'vartija1').size, 0);
  const puuttuu = kohde({ perehdytykset: [perehdytys({ vuorotyyppiIdt: undefined })] });
  assert.equal(perehdytetytVuorot(puuttuu, 'vartija1').size, 0);
});

test('kytkemätön perehdytys ei myönnä mitään', () => {
  // Nimi ja päivämäärä ovat tallessa, mutta tunnusta ei ole: dokumentti kyllä, oikeus ei.
  const k = kohde({ perehdytykset: [perehdytys({ username: undefined })] });
  assert.equal(perehdytetytVuorot(k, 'vartija1').size, 0);
  assert.equal(onKytketty(k.perehdytykset[0]), false);
  assert.equal(onKytketty(perehdytys()), true);
});

test('toisen tunnuksen perehdytys ei myönnä mitään', () => {
  const k = kohde({ perehdytykset: [perehdytys({ username: 'vartija2' })] });
  assert.equal(perehdytetytVuorot(k, 'vartija1').size, 0);
});

test('tyhjä tai puuttuva tunnus ei osu kytkemättömiin merkintöihin', () => {
  const k = kohde({ perehdytykset: [perehdytys({ username: undefined }), perehdytys({ username: '' })] });
  assert.equal(perehdytetytVuorot(k, '').size, 0);
  assert.equal(perehdytetytVuorot(k, undefined).size, 0);
});

test('perehdytyksen voimassaAsti EI vielä vaikuta', () => {
  // Päätös 10.9.2026: perehdytys ei vanhene v1:ssä, kenttä on varattu tulevaa varten.
  // Tämä testi on tässä jottei kukaan luule kentän toimivan. Kun vanheneminen otetaan
  // käyttöön, tämä testi käännetään ympäri — tietoisesti, ei vahingossa.
  const k = kohde({ perehdytykset: [perehdytys({ voimassaAsti: '2020-01-01' })] });
  assert.equal(perehdytetytVuorot(k, 'vartija1').has('v-aamu'), true);
});

test('useampi perehdytysmerkintä laskee yhteen', () => {
  const k = kohde({
    perehdytykset: [
      perehdytys({ id: 'p1', vuorotyyppiIdt: ['v-aamu'] }),
      perehdytys({ id: 'p2', vuorotyyppiIdt: ['v-yo'] }),
    ],
  });
  assert.deepEqual([...perehdytetytVuorot(k, 'vartija1')].sort(), ['v-aamu', 'v-yo']);
});

// --- Vaihtoehdot kirjautumisnäkymälle -----------------------------------------------

test('perehdyttämätön vuoro näkyy listalla merkittynä eikä katoa', () => {
  const k = kohde({ perehdytykset: [perehdytys({ vuorotyyppiIdt: ['v-aamu'] })] });
  const [rivi] = vuorovaihtoehdot({ kohteet: [k], username: 'vartija1', nyt: klo(8) });
  assert.equal(rivi.siteNimi, 'Kauppakeskus Hansa');
  assert.equal(rivi.vuorot.length, 4);
  assert.equal(rivi.vuorot.find((v) => v.id === 'v-aamu').perehdytetty, true);
  assert.equal(rivi.vuorot.find((v) => v.id === 'v-yo').perehdytetty, false);
});

test('vaihtoehto kertoo sekä perehdytyksen että kellon erikseen', () => {
  // Kaksi eri estettä, kaksi eri korjausta: toiseen pyydetään perehdytys, toiseen
  // odotetaan tai pyydetään lupa. Yhdistettynä ne olisivat sama harmaa rivi.
  // Klo 12: aamuvuoro on ikkunassa, yövuoro ei. Kello 8 ei kelpaisi tähän — yövuoron
  // ikkuna joustoineen ulottuu yhdeksään, ja testi olisi mitannut väärää asiaa.
  const k = kohde({ perehdytykset: [perehdytys({ vuorotyyppiIdt: ['v-aamu', 'v-yo'] })] });
  const [rivi] = vuorovaihtoehdot({ kohteet: [k], username: 'vartija1', nyt: klo(12) });
  assert.equal(rivi.vuorot.find((v) => v.id === 'v-aamu').ikkunassa, true);
  const yo = rivi.vuorot.find((v) => v.id === 'v-yo');
  assert.equal(yo.perehdytetty, true);
  assert.equal(yo.ikkunassa, false);
});

test('kohde jossa ei ole yhtään perehdytettyä vuoroa jää pois', () => {
  // Päätös 10.9.2026: perehdytys korvaa kohderajauksen vartijoilla.
  const k = kohde({ perehdytykset: [] });
  assert.deepEqual(vuorovaihtoehdot({ kohteet: [k], username: 'vartija1', nyt: klo(8) }), []);
  // Sama kohde näkyy kun rajaus otetaan pois — hälytyskeskus ja pääkäyttäjä eivät ole
  // perehdytettyjä eikä heitä saa rajata sillä perusteella.
  const kaikki = vuorovaihtoehdot({
    kohteet: [k], username: 'paivystaja', nyt: klo(8), vainPerehdytetytKohteet: false,
  });
  assert.equal(kaikki.length, 1);
  assert.equal(kaikki[0].vuorot.every((v) => v.perehdytetty === false), true);
});

test('arkistoitu kohde ja arkistoitu vuoro jäävät pois', () => {
  const k = kohde({
    archived: true,
    perehdytykset: [perehdytys()],
  });
  assert.deepEqual(vuorovaihtoehdot({ kohteet: [k], username: 'vartija1', nyt: klo(8) }), []);

  const arkistoitu = kohde({
    vuorotyypit: [AAMU, { ...ILTA, arkistoitu: true }],
    perehdytykset: [perehdytys({ vuorotyyppiIdt: ['v-aamu', 'v-ilta'] })],
  });
  const [rivi] = vuorovaihtoehdot({ kohteet: [arkistoitu], username: 'vartija1', nyt: klo(8) });
  assert.deepEqual(rivi.vuorot.map((v) => v.id), ['v-aamu']);
});

test('kohde ilman vuorotyyppejä jää pois listalta', () => {
  const k = kohde({ vuorotyypit: [], perehdytykset: [perehdytys()] });
  assert.deepEqual(vuorovaihtoehdot({ kohteet: [k], username: 'vartija1', nyt: klo(8) }), []);
});

// --- Aloituksen portti (kutsutaan erässä 17) ----------------------------------------

test('aloitus onnistuu perehdytetylle vuorolle ikkunassa', () => {
  const k = kohde({ perehdytykset: [perehdytys()] });
  const tulos = saakoAloittaa({ kohde: k, vuorotyyppiId: 'v-aamu', username: 'vartija1', nyt: klo(8) });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.vuorotyyppi.nimi, 'Aamuvuoro');
});

test('aloitus kertoo KUMPI ehto petti', () => {
  // Hälytyskeskuksen kertalupa (erä 17) tarvitsee tämän: perehdytys ja kello ovat eri
  // poikkeuksia, eikä niitä saa niputtaa yhdeksi "ei onnistu" -vastaukseksi.
  const k = kohde({ perehdytykset: [perehdytys({ vuorotyyppiIdt: ['v-aamu'] })] });
  assert.equal(
    saakoAloittaa({ kohde: k, vuorotyyppiId: 'v-ilta', username: 'vartija1', nyt: klo(16) }).syy,
    'ei_perehdytysta'
  );
  assert.equal(
    saakoAloittaa({ kohde: k, vuorotyyppiId: 'v-aamu', username: 'vartija1', nyt: klo(23) }).syy,
    'ikkunan_ulkopuolella'
  );
});

test('tuntematon ja arkistoitu vuoro torjutaan omilla syillään', () => {
  const k = kohde({
    vuorotyypit: [{ ...AAMU, arkistoitu: true }],
    perehdytykset: [perehdytys()],
  });
  assert.equal(saakoAloittaa({ kohde: k, vuorotyyppiId: 'v-eioo', username: 'vartija1' }).syy, 'tuntematon_vuoro');
  assert.equal(saakoAloittaa({ kohde: k, vuorotyyppiId: 'v-aamu', username: 'vartija1' }).syy, 'arkistoitu_vuoro');
});
