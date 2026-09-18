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
  aloitaVuoro, keskenOlevaVuoro, kohteetPerehdytyksenMukaan, lisaaVuoroon, paataVuoro,
  vuoronPaattymisaika, UNOHTUNUT_VARTIJA_MIN, UNOHTUNUT_HALKE_MIN,
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

// --- Vuoron elinkaari (erä 17) ------------------------------------------------------

const POHJAT = [
  { id: 'p1', nimi: 'Yökierros' },
  { id: 'p2', nimi: 'Ulkokierros' },
];

const KOHDE_TEHTAVILLA = () => kohde({
  tehtavat: [
    { id: 't1', nimi: 'Sulkukierros', tyyppi: 'kuittaus', kohdat: [] },
    { id: 't2', nimi: 'Avaimet', tyyppi: 'lista', kohdat: [] },
  ],
  perehdytykset: [perehdytys()],
});

const aloita = (yli = {}) => aloitaVuoro({
  kohde: KOHDE_TEHTAVILLA(),
  vuorotyyppiId: 'v-aamu',
  username: 'vartija1',
  pohjat: POHJAT,
  id: 'vuoro-1',
  nyt: klo(8),
  ...yli,
});

test('vuoro kopioi tehtävänsä ja kierroksensa vuorotyypistä', () => {
  const { ok, vuoro } = aloita();
  assert.equal(ok, true);
  assert.equal(vuoro.tila, 'kesken');
  assert.equal(vuoro.vartija, 'vartija1');
  assert.equal(vuoro.vuorotyyppiNimi, 'Aamuvuoro');
  // Suoritusaika on mukana kopiossa (erä 18b). Null tarkoittaa ettei aikaa ole
  // määritelty — se ei ole sama asia kuin puuttuva kenttä, jonka koostelaskenta
  // tulkitsisi vanhaksi tietueeksi.
  assert.deepEqual(vuoro.tehtavat, [{ id: 't1', nimi: 'Sulkukierros', lahde: 'vuoro', suoritusaika: null }]);
  assert.deepEqual(vuoro.pohjat, [{ id: 'p1', nimi: 'Yökierros', lahde: 'vuoro', suoritusaika: null }]);
});

test('kohteen ja vuoron nimi kopioidaan eikä viitata', () => {
  // Kohteen nimen muutos ei saa muuttaa mennyttä vuoroa: jälkikäteen on voitava sanoa
  // missä vartija oli töissä sinä päivänä, ei missä kohde on nyt.
  const { vuoro } = aloita();
  assert.equal(vuoro.siteNimi, 'Kauppakeskus Hansa');
  assert.equal(typeof vuoro.siteNimi, 'string');
});

test('poistettuun tehtävään osoittava viittaus ei tuota tyhjää riviä', () => {
  const k = KOHDE_TEHTAVILLA();
  k.vuorotyypit = k.vuorotyypit.map((v) => (v.id === 'v-aamu' ? { ...v, tehtavaIdt: ['t1', 'poistettu'] } : v));
  const { vuoro } = aloita({ kohde: k });
  assert.equal(vuoro.tehtavat.length, 1);
});

test('perehdyttämätön vuoro ei ala ilman kertalupaa', () => {
  const tulos = aloita({ vuorotyyppiId: 'v-ilta', nyt: klo(16) });
  assert.equal(tulos.ok, false);
  assert.equal(tulos.syy, 'ei_perehdytysta');
  assert.match(tulos.error, /perehdytetty/i);
});

test('kertalupa avaa perehdytyksen ja kellon, ja jää tietueeseen', () => {
  const tulos = aloita({
    vuorotyyppiId: 'v-ilta', nyt: klo(16),
    poikkeus: { myontaja: 'paivystaja', syy: 'Sairastapaus, ei muuta vartijaa saatavilla' },
  });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.vuoro.perehdytysPoikkeus.myontaja, 'paivystaja');
  assert.equal(tulos.vuoro.perehdytysPoikkeus.este, 'ei_perehdytysta');
  assert.match(tulos.vuoro.perehdytysPoikkeus.syy, /Sairastapaus/);
});

test('kertalupa EI avaa olematonta eikä arkistoitua vuoroa', () => {
  // Lupa vuoroon jota ei ole ei ole lupa vaan tietue joka näyttää luvalta.
  const poikkeus = { myontaja: 'paivystaja', syy: 'syy' };
  assert.equal(aloita({ vuorotyyppiId: 'v-eioo', poikkeus }).syy, 'tuntematon_vuoro');
  const k = KOHDE_TEHTAVILLA();
  k.vuorotyypit = k.vuorotyypit.map((v) => (v.id === 'v-aamu' ? { ...v, arkistoitu: true } : v));
  assert.equal(aloita({ kohde: k, poikkeus }).syy, 'arkistoitu_vuoro');
});

test('kertalupaa ei kirjata kun sitä ei tarvittu', () => {
  // Turha poikkeusmerkintä väittäisi jälkikäteen että vuoro ajettiin luvan varassa.
  const { vuoro } = aloita({ poikkeus: { myontaja: 'paivystaja', syy: 'varmuuden vuoksi' } });
  assert.equal(vuoro.perehdytysPoikkeus, null);
});

test('vuoro päättyy ja saa päättymisajan', () => {
  const { vuoro } = aloita();
  const tulos = paataVuoro({ vuoro, nyt: klo(15) });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.vuoro.tila, 'paattynyt');
  assert.equal(tulos.vuoro.paattyi, klo(15).toISOString());
});

test('tekemättömät tehtävät eivät estä päättämistä', () => {
  // Päätös 10.9.2026: estäminen tarkoittaisi että vuoroa ei päätetä ollenkaan, ja auki
  // jäänyt vuoro on huonompi tieto kuin päättynyt vuoro jolla on tekemättömiä rivejä.
  const { vuoro } = aloita();
  assert.equal(vuoro.tehtavat.length, 1);
  assert.equal(paataVuoro({ vuoro, nyt: klo(15) }).ok, true);
});

test('päättynyttä vuoroa ei päätetä uudelleen, mutta toisto on ok', () => {
  const { vuoro } = aloita();
  const paattynyt = paataVuoro({ vuoro, nyt: klo(15) }).vuoro;
  assert.equal(paataVuoro({ vuoro: paattynyt, nyt: klo(16) }).ok, false);
  const toisto = paataVuoro({ vuoro: paattynyt, nyt: klo(16), toisto: true });
  assert.equal(toisto.duplikaatti, true);
  assert.equal(toisto.vuoro.paattyi, klo(15).toISOString(), 'alkuperäinen päättymisaika säilyy');
});

test('tehtävän voi lisätä hakemistosta ja lähde säilyy', () => {
  const { vuoro } = aloita();
  const tulos = lisaaVuoroon({ vuoro, kohde: KOHDE_TEHTAVILLA(), laji: 'tehtava', kohdeId: 't2' });
  assert.equal(tulos.ok, true);
  assert.deepEqual(tulos.vuoro.tehtavat.map((t) => t.lahde), ['vuoro', 'itse_lisatty']);
});

test('sama tehtävä ei tule listalle kahdesti', () => {
  const { vuoro } = aloita();
  const tulos = lisaaVuoroon({ vuoro, kohde: KOHDE_TEHTAVILLA(), laji: 'tehtava', kohdeId: 't1' });
  assert.equal(tulos.duplikaatti, true);
  assert.equal(tulos.vuoro.tehtavat.length, 1);
});

test('vain kohteen omasta hakemistosta voi lisätä', () => {
  const { vuoro } = aloita();
  const tulos = lisaaVuoroon({ vuoro, kohde: KOHDE_TEHTAVILLA(), laji: 'tehtava', kohdeId: 'toisen-kohteen-tehtava' });
  assert.equal(tulos.ok, false);
});

test('päättyneeseen vuoroon ei lisätä mitään', () => {
  const { vuoro } = aloita();
  const paattynyt = paataVuoro({ vuoro, nyt: klo(15) }).vuoro;
  assert.equal(lisaaVuoroon({ vuoro: paattynyt, kohde: KOHDE_TEHTAVILLA(), laji: 'tehtava', kohdeId: 't2' }).ok, false);
});

test('kierroksen lisäys menee omaan listaansa', () => {
  const { vuoro } = aloita();
  const tulos = lisaaVuoroon({ vuoro, kohde: KOHDE_TEHTAVILLA(), pohjat: POHJAT, laji: 'kierros', kohdeId: 'p2', lahde: 'siirto' });
  assert.deepEqual(tulos.vuoro.pohjat.map((p) => [p.nimi, p.lahde]), [['Yökierros', 'vuoro'], ['Ulkokierros', 'siirto']]);
  assert.equal(tulos.vuoro.tehtavat.length, 1, 'tehtävälista ei muutu');
});

test('yksi kesken oleva vuoro kerrallaan', () => {
  const { vuoro } = aloita();
  const toinen = { ...vuoro, id: 'vuoro-2', vartija: 'vartija2' };
  const paattynyt = { ...vuoro, id: 'vuoro-3', tila: 'paattynyt' };
  assert.equal(keskenOlevaVuoro([paattynyt, vuoro, toinen], 'vartija1').id, 'vuoro-1');
  assert.equal(keskenOlevaVuoro([paattynyt], 'vartija1'), null);
  assert.equal(keskenOlevaVuoro([], 'vartija1'), null);
});

// --- Kohdenäkyvyys perehdytyksen mukaan ---------------------------------------------

test('vartija näkee vain perehdytetyt kohteet', () => {
  const perehdytetty = kohde({ id: 'k1', perehdytykset: [perehdytys()] });
  const vieras = kohde({ id: 'k2', perehdytykset: [] });
  const nakyvat = kohteetPerehdytyksenMukaan({ kohteet: [perehdytetty, vieras], username: 'vartija1' });
  assert.deepEqual(nakyvat.map((k) => k.id), ['k1']);
});

test('kesken oleva vuoro ohittaa perehdytyksen', () => {
  // Hälytyskeskus voi avata vuoron kertaluvalla ilman perehdytystä. Ilman tätä poikkeusta
  // kertalupa antaisi työn muttei kohteen ohjeita, yhteystietoja eikä vyöhykkeitä.
  const vieras = kohde({ id: 'k2', perehdytykset: [] });
  const vuorot = [{ id: 'v1', siteId: 'k2', vartija: 'vartija1', tila: 'kesken' }];
  assert.equal(kohteetPerehdytyksenMukaan({ kohteet: [vieras], username: 'vartija1', vuorot }).length, 1);
});

test('päättynyt vuoro ei jätä kohdetta näkyviin', () => {
  const vieras = kohde({ id: 'k2', perehdytykset: [] });
  const vuorot = [{ id: 'v1', siteId: 'k2', vartija: 'vartija1', tila: 'paattynyt' }];
  assert.equal(kohteetPerehdytyksenMukaan({ kohteet: [vieras], username: 'vartija1', vuorot }).length, 0);
});

test('toisen vartijan vuoro ei avaa kohdetta', () => {
  const vieras = kohde({ id: 'k2', perehdytykset: [] });
  const vuorot = [{ id: 'v1', siteId: 'k2', vartija: 'vartija2', tila: 'kesken' }];
  assert.equal(kohteetPerehdytyksenMukaan({ kohteet: [vieras], username: 'vartija1', vuorot }).length, 0);
});

test('kytkemätön tai tyhjä perehdytys ei avaa kohdetta', () => {
  const kytkematon = kohde({ id: 'k3', perehdytykset: [perehdytys({ username: undefined })] });
  const tyhja = kohde({ id: 'k4', perehdytykset: [perehdytys({ vuorotyyppiIdt: [] })] });
  assert.deepEqual(
    kohteetPerehdytyksenMukaan({ kohteet: [kytkematon, tyhja], username: 'vartija1' }).map((k) => k.id),
    []
  );
});

// --- Unohtunut vuoro ----------------------------------------------------------------
//
// Painopiste on YÖVUOROSSA. Jos päättymiskellonaika sijoitettaisiin vuoron alkamispäivään,
// 22:00 alkanut ja 07:00 päättyvä vuoro näyttäisi päättyneen viisitoista tuntia ennen kuin
// se alkoi — ja jokainen yövuoro olisi "unohtunut" heti alkamishetkellään. Se olisi
// ilmoitus joka tulee joka yö, eli ilmoitus jota kukaan ei lue.

test('päivävuoron päättymisaika on samana päivänä', () => {
  const loppu = vuoronPaattymisaika('2026-09-15T07:00:00', '15:00');
  assert.equal(loppu.getDate(), 15);
  assert.equal(loppu.getHours(), 15);
});

test('yövuoron päättymisaika on seuraavana päivänä', () => {
  const loppu = vuoronPaattymisaika('2026-09-15T22:00:00', '07:00');
  assert.equal(loppu.getDate(), 16);
  assert.equal(loppu.getHours(), 7);
});

test('vuorokauden mittainen vuoro päättyy seuraavana päivänä', () => {
  // paattyy === alkamisaika ei ole nollan mittainen vuoro, sama tulkinta kuin
  // vuoroIkkunassa-funktiossa.
  const loppu = vuoronPaattymisaika('2026-09-15T08:00:00', '08:00');
  assert.equal(loppu.getDate(), 16);
});

test('kellonajaton vuoro ei voi olla myöhässä', () => {
  // Kellonajaton lisävuoro on olemassa, eikä puuttuvaa rajoitetta saa tulkita
  // rajoitteeksi.
  assert.equal(vuoronPaattymisaika('2026-09-15T08:00:00', null), null);
  assert.equal(vuoronPaattymisaika('2026-09-15T08:00:00', ''), null);
});

test('rajat ovat 10 ja 15 minuuttia', () => {
  assert.equal(UNOHTUNUT_VARTIJA_MIN, 10);
  assert.equal(UNOHTUNUT_HALKE_MIN, 15);
  // Vartija ennen hälytyskeskusta: ensimmäinen on muistutus, toinen on tehtävä.
  assert.ok(UNOHTUNUT_VARTIJA_MIN < UNOHTUNUT_HALKE_MIN);
});

// --- Pakkopäätös (18.9.2026) ---------------------------------------------------------
//
// Päivystäjä päättää vuoron silloin kun vartijaan ei saada yhteyttä: puhelin rikki, akku
// loppui, laite jäi autoon. Nämä testit vartioivat sitä että pakkopäätös EI näytä
// tavalliselta päättymiseltä — vuoron päättymisaika menee työaikatietoon ja koosteeseen,
// ja tieto siitä kuka sen päätti ja miksi kuuluu samaan tietueeseen.

const vuorossa = () => aloita().vuoro;

test('vartija päättää oman vuoronsa ilman syytä ja ilman pakkomerkintää', () => {
  const tulos = paataVuoro({ vuoro: vuorossa(), nyt: klo(15), paattaja: 'vartija1' });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.vuoro.pakkoPaatos, undefined);
});

test('toisen vuoron päättäminen vaatii syyn', () => {
  const ilman = paataVuoro({ vuoro: vuorossa(), nyt: klo(15), paattaja: 'halke' });
  assert.equal(ilman.ok, false);
  assert.match(ilman.error, /syyn/i);
  // Pelkät välilyönnit eivät ole syy.
  assert.equal(paataVuoro({ vuoro: vuorossa(), nyt: klo(15), paattaja: 'halke', syy: '   ' }).ok, false);
});

test('pakkopäätös tallentaa päättäjän ja syyn vuoroon', () => {
  const tulos = paataVuoro({
    vuoro: vuorossa(), nyt: klo(15), paattaja: 'halke', syy: 'Puhelin rikki, ei saada yhteyttä.',
  });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.vuoro.tila, 'paattynyt');
  assert.equal(tulos.vuoro.pakkoPaatos.paattaja, 'halke');
  assert.equal(tulos.vuoro.pakkoPaatos.syy, 'Puhelin rikki, ei saada yhteyttä.');
  assert.equal(tulos.vuoro.pakkoPaatos.ts, klo(15).toISOString());
});

test('paattaja ilman tunnusta ei tee päätöksestä pakkopäätöstä', () => {
  // Vanhat kutsupaikat eivät anna paattajaa lainkaan. Ne eivät saa alkaa vaatia syytä
  // eivätkä merkitä vuoroa pakolla päätetyksi.
  const tulos = paataVuoro({ vuoro: vuorossa(), nyt: klo(15) });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.vuoro.pakkoPaatos, undefined);
});
