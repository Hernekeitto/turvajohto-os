// Sijaintihistorian pääsysääntöjen testit.
//
// Painopiste on siinä mikä JOHTAISI HENKILÖTIEDON VUOTAMISEEN tai käyttötarkoituksen
// rajauksen ohittamiseen — ei siinä että funktiot palauttavat jotain. Tämä on
// työntekijään kohdistuvan teknisen valvonnan pääsyportti, ja sen viat eivät näy
// käyttöliittymässä mitenkään: liikaa näyttävä portti näyttää täsmälleen oikealta.
//
// Ajetaan: node --test server/sijaintihistoria.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IKKUNA_MAX_VRK, SYYT, TARKENNE_MAX,
  saaNahdaHistorian, suodataPisteet, tarkistaIkkuna, tarkistaSyy, tehtavanJalki,
  tehtavavaihtoehdot, vartijavaihtoehdot,
} from './sijaintihistoria.js';
import { canView, eventAllowed } from './permissions.js';

const VRK = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-09-16T12:00:00Z');

// --- Syy ---------------------------------------------------------------------------

test('tuntematon syy hylätään', () => {
  // Ilman tätä syyksi kelpaisi mikä tahansa merkkijono, ja auditlokista ei voisi laskea
  // mitään — koko pakollisuuden tarkoitus katoaisi.
  assert.equal(tarkistaSyy('vakoilu', '').ok, false);
  assert.equal(tarkistaSyy('', '').ok, false);
  assert.equal(tarkistaSyy(null, null).ok, false);
});

test('prototyypin kentät eivät kelpaa syyksi', () => {
  // `SYYT[syy]` ilman hasOwnProperty-tarkistusta hyväksyisi nämä, koska ne löytyvät
  // jokaisesta oliosta. Tuloksena olisi portti jonka ohittaa kirjoittamalla
  // "constructor".
  for (const syy of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    assert.equal(tarkistaSyy(syy, 'jotain').ok, false, syy);
  }
});

test('sallitut syyt kelpaavat', () => {
  for (const syy of Object.keys(SYYT)) {
    const tarkenne = syy === 'muu' ? 'kuvattu tarkemmin' : '';
    assert.equal(tarkistaSyy(syy, tarkenne).ok, true, syy);
  }
});

test('muu ilman tarkennetta on sama kuin ei syytä', () => {
  // Tämä on se haara jonka kautta pakollisuus vuotaisi tyhjäksi: "muu" + tyhjä kenttä
  // olisi klikkaus eikä perustelu.
  assert.equal(tarkistaSyy('muu', '').ok, false);
  assert.equal(tarkistaSyy('muu', '  ').ok, false);
  assert.equal(tarkistaSyy('muu', 'ab').ok, false);
  assert.equal(tarkistaSyy('muu', 'abc').ok, true);
});

test('tarkenne siistitään ja pituus rajataan', () => {
  assert.equal(tarkistaSyy('halytys', '  hälytys 12  ').tarkenne, 'hälytys 12');
  assert.equal(tarkistaSyy('halytys', 'x'.repeat(TARKENNE_MAX)).ok, true);
  assert.equal(tarkistaSyy('halytys', 'x'.repeat(TARKENNE_MAX + 1)).ok, false);
});

// --- Ikkuna ------------------------------------------------------------------------

test('ikkuna ei saa ylittää enimmäispituutta', () => {
  // Ilman rajaa yksi pyyntö palauttaisi koko 45 vrk:n jäljen yhtenä auditlokirivinä.
  assert.equal(tarkistaIkkuna(T0 - IKKUNA_MAX_VRK * VRK, T0, T0).ok, true);
  assert.equal(tarkistaIkkuna(T0 - (IKKUNA_MAX_VRK * VRK + 1), T0, T0).ok, false);
});

test('tulevaisuuteen ulottuva loppu leikataan nykyhetkeen', () => {
  // "Tänään" päättyy vuorokauden loppuun, eikä siitä pidä tulla virhettä.
  const tulos = tarkistaIkkuna(T0 - VRK, T0 + 10 * VRK, T0);
  assert.equal(tulos.ok, true);
  assert.equal(tulos.loppu, T0);
});

test('leikkaus ei saa kääntää kelvollista ikkunaa virheelliseksi eikä päinvastoin', () => {
  // Alku tulevaisuudessa: leikkauksen jälkeen loppu <= alku, eli virhe. Tämä on oikein —
  // muuten pyyntö palauttaisi hiljaa tyhjän jäljen ja näyttäisi siltä että henkilö ei
  // liikkunut.
  assert.equal(tarkistaIkkuna(T0 + VRK, T0 + 2 * VRK, T0).ok, false);
  // 30 vrk taaksepäin leikkautuu nykyhetkeen mutta on yhä liian pitkä.
  assert.equal(tarkistaIkkuna(T0 - 30 * VRK, T0 + 5 * VRK, T0).ok, false);
});

test('puuttuvat ja roskat arvot hylätään', () => {
  assert.equal(tarkistaIkkuna(undefined, T0, T0).ok, false);
  assert.equal(tarkistaIkkuna(T0 - VRK, 'eilen', T0).ok, false);
  assert.equal(tarkistaIkkuna(NaN, NaN, T0).ok, false);
});

// --- Kuka saa katsoa ---------------------------------------------------------------

const kayttaja = (solmut, lisa = {}) => ({
  role: 'user',
  permissions: { __default__: Object.fromEntries(solmut.map((s) => [s, { view: true }])) },
  ...lisa,
});

test('guard_locations EI riitä historiaan', () => {
  // TÄMÄ ON KOKO SOLMUN TARKOITUS. Nykyisen sijainnin näkeminen vanhenee 30 minuutissa;
  // jälki kattaa 45 vuorokautta. Jos tämä testi kaatuu, tilannekuvan katseluoikeus on
  // vahingossa laajentunut liikehistorian katseluoikeudeksi.
  assert.equal(saaNahdaHistorian(kayttaja(['guard_locations']), canView), false);
});

test('guard_dispatch EI riitä historiaan', () => {
  assert.equal(saaNahdaHistorian(kayttaja(['guard_dispatch']), canView), false);
});

test('oma solmu riittää', () => {
  assert.equal(saaNahdaHistorian(kayttaja(['guard_location_history']), canView), true);
});

test('pääkäyttäjä näkee ilman solmua', () => {
  assert.equal(saaNahdaHistorian({ role: 'admin', permissions: {} }, canView), true);
});

test('tuntematon kysyjä ei näe', () => {
  assert.equal(saaNahdaHistorian(null, canView), false);
  assert.equal(saaNahdaHistorian({}, canView), false);
});

// --- Mitä pisteitä näkyy -----------------------------------------------------------

const piste = (eventId) => ({ ts: '2026-09-16T10:00:00.000Z', eventId });

test('rajattu kohdepääsy rajaa pisteet', () => {
  const kysyja = kayttaja(['guard_location_history'], { eventAccess: ['A'] });
  const tulos = suodataPisteet(kysyja, [piste('A'), piste('B'), piste('A')], eventAllowed);
  assert.equal(tulos.length, 2);
  assert.ok(tulos.every((p) => p.eventId === 'A'));
});

test('kohteeton piste EI näy rajatulle kysyjälle', () => {
  // Piirivuoron pisteellä ei ole kohdetta, eikä rajattu kysyjä saa nähdä sitä. Tämä
  // poikkeaa tarkoituksella /api/sijainnit-säännöstä, jossa kohteeton yksikkö on
  // näytettävä: siellä joku odottaa apua, täällä ei.
  const kysyja = kayttaja(['guard_location_history'], { eventAccess: ['A'] });
  const tulos = suodataPisteet(kysyja, [piste('A'), piste(null), piste(undefined)], eventAllowed);
  assert.equal(tulos.length, 1);
});

test('rajaamaton kysyjä näkee myös kohteettomat pisteet', () => {
  // Tyhjä eventAccess tarkoittaa palvelimen logiikassa EI RAJAUSTA (permissions.js:
  // eventAllowed). Jos tämä testi kaatuu, rajaamattomalta päivystäjältä katoaisivat
  // piirivuorot jäljestä eikä siitä kerrottaisi mitenkään.
  const kysyja = kayttaja(['guard_location_history'], { eventAccess: [] });
  assert.equal(suodataPisteet(kysyja, [piste('A'), piste(null)], eventAllowed).length, 2);
});

test('pääkäyttäjä näkee kaikki pisteet', () => {
  const tulos = suodataPisteet({ role: 'admin' }, [piste('A'), piste(null)], eventAllowed);
  assert.equal(tulos.length, 2);
});

// --- Ketä voi hakea ----------------------------------------------------------------

const vuoro = (vartija, paivaaSitten) => ({
  vartija,
  alkoi: new Date(T0 - paivaaSitten * VRK).toISOString(),
});

test('säilytysajan ylittäneet vuorot eivät tuo ketään listalle', () => {
  // 45 vrk vanhemmalta ajalta ei ole jälkeä jäljellä. Nimen näyttäminen olisi lupaus
  // tiedosta jota ei ole — ja tyhjä hakutulos näyttää samalta kuin "ei liikkunut".
  const lista = vartijavaihtoehdot([vuoro('vanha', 46), vuoro('tuore', 2)], T0);
  assert.deepEqual(lista.map((v) => v.username), ['tuore']);
});

test('sama vartija esiintyy kerran, viimeisimmän vuoron mukaan', () => {
  const lista = vartijavaihtoehdot([vuoro('a', 10), vuoro('a', 1), vuoro('b', 5)], T0);
  assert.deepEqual(lista.map((v) => v.username), ['a', 'b']);
  assert.equal(lista[0].viimeksi, new Date(T0 - VRK).toISOString());
});

test('kelvottomat vuorot ohitetaan kaatumatta', () => {
  const lista = vartijavaihtoehdot(
    [null, {}, { vartija: 'x', alkoi: 'eilen' }, vuoro('ok', 1)],
    T0,
  );
  assert.deepEqual(lista.map((v) => v.username), ['ok']);
});

test('tyhjä tai puuttuva vuorolista ei kaada', () => {
  assert.deepEqual(vartijavaihtoehdot([], T0), []);
  assert.deepEqual(vartijavaihtoehdot(undefined, T0), []);
});

// --- Hälytystehtävän jälki ----------------------------------------------------------

const yks = (osat = {}) => ({
  vartija: 'matti',
  nimi: 'Matti',
  vastaanotti: new Date(T0 - 2 * 3600_000).toISOString(),
  poistui: new Date(T0 - 3600_000).toISOString(),
  kieltaytyi: null,
  ...osat,
});

const tehtava = (osat = {}) => ({
  id: 't1', laji: 'murto', siteId: 'A', siteNimi: 'Kohde A',
  luotu: new Date(T0 - 3 * 3600_000).toISOString(), tila: 'paattynyt',
  yksikot: [yks()],
  ...osat,
});

test('tehtävän oma jälki voittaa lokin', () => {
  // TÄMÄ ON KOKO OSAN TÄRKEIN TESTI. Tehtävään liitetty jälki säilyy LYTP:n mukaan kaksi
  // vuotta; loki 45 vuorokautta. Jos loki luettaisiin ensin, sama tehtävä näyttäisi eri
  // jäljen ennen ja jälkeen 45 vuorokauden — ensin oikean, sitten tyhjän — vaikka
  // hyväksytty jälki on koko ajan tallessa.
  const t = tehtava({ yksikot: [yks({ jalki: [{ ts: 'x', lat: 60, lon: 24 }], jalkiHarvennettu: 900 })] });
  const tulos = tehtavanJalki(t, 'matti', T0);
  assert.equal(tulos.lahde, 'tehtava');
  assert.equal(tulos.pisteet.length, 1);
  assert.equal(tulos.harvennettu, 900);
});

test('tyhjä jälkitaulukko ei ole jälki', () => {
  // `jalki: []` syntyy kun hyväksynnän hetkellä lokissa ei ollut pisteitä. Silloin on
  // luettava loki — muuten tulos olisi tyhjä myös silloin kun pisteitä on.
  const t = tehtava({ yksikot: [yks({ jalki: [] })] });
  assert.equal(tehtavanJalki(t, 'matti', T0).lahde, 'loki');
});

test('ilman liitettyä jälkeä luetaan loki yksikön ikkunalta', () => {
  const tulos = tehtavanJalki(tehtava(), 'matti', T0);
  assert.equal(tulos.lahde, 'loki');
  assert.equal(tulos.alku, T0 - 2 * 3600_000);
  assert.equal(tulos.loppu, T0 - 3600_000);
});

test('kesken oleva tehtävä ulottuu nykyhetkeen', () => {
  // Päivystäjä katsoo jälkeä useimmiten juuri silloin kun yksikkö on matkalla.
  const t = tehtava({ tila: 'avoin', paattyi: null, yksikot: [yks({ poistui: null })] });
  const tulos = tehtavanJalki(t, 'matti', T0);
  assert.equal(tulos.loppu, T0);
});

test('kieltäytyneelle ei jälkeä', () => {
  // Hän ei ollut tehtävällä. Sama sääntö kuin liitaJalki:ssa — ja se on toistettava
  // tässä, muuten kieltäytyneen sijainti tulisi lokista vaikka tietueessa sitä ei ole.
  const t = tehtava({ yksikot: [yks({ kieltaytyi: new Date(T0).toISOString(), vastaanotti: null })] });
  assert.equal(tehtavanJalki(t, 'matti', T0), null);
});

test('tuntematon vartija ei saa jälkeä', () => {
  assert.equal(tehtavanJalki(tehtava(), 'kalle', T0), null);
  assert.equal(tehtavanJalki(null, 'matti', T0), null);
});

// --- Mitkä tehtävät voi valita ------------------------------------------------------

test('vain tehtävät joilla on vastaanottanut yksikkö', () => {
  const lista = tehtavavaihtoehdot([
    tehtava({ id: 'ok' }),
    tehtava({ id: 'eiyksikoita', yksikot: [] }),
    tehtava({ id: 'kieltaytyi', yksikot: [yks({ kieltaytyi: 'x', vastaanotti: null })] }),
  ], { role: 'admin' }, eventAllowed);
  assert.deepEqual(lista.map((t) => t.id), ['ok']);
});

test('kohdepääsy rajaa tehtävälistan', () => {
  // Tehtävälista itsessään kertoo missä kohteissa on ollut hälytyksiä.
  const lista = tehtavavaihtoehdot(
    [tehtava({ id: 'a', siteId: 'A' }), tehtava({ id: 'b', siteId: 'B' })],
    { role: 'user', eventAccess: ['A'] },
    eventAllowed,
  );
  assert.deepEqual(lista.map((t) => t.id), ['a']);
});

test('lähde kerrotaan etukäteen jokaiselle yksikölle', () => {
  const lista = tehtavavaihtoehdot([tehtava({
    yksikot: [yks({ vartija: 'a', jalki: [{ ts: 'x' }] }), yks({ vartija: 'b' })],
  })], { role: 'admin' }, eventAllowed);
  assert.deepEqual(lista[0].yksikot.map((y) => y.lahde), ['tehtava', 'loki']);
});

test('säilytysaikaa EI rajata tehtävälistassa', () => {
  // Tehtävän oma jälki säilyy kaksi vuotta, joten vuoden vanha tehtävä on yhä kelvollinen
  // haun kohde — toisin kuin vapaassa aikavälihaussa.
  const vanha = tehtava({
    id: 'vanha',
    luotu: new Date(T0 - 300 * VRK).toISOString(),
    yksikot: [yks({ jalki: [{ ts: 'x' }] })],
  });
  assert.deepEqual(tehtavavaihtoehdot([vanha], { role: 'admin' }, eventAllowed).map((t) => t.id), ['vanha']);
});

test('uusin tehtävä ensin', () => {
  const lista = tehtavavaihtoehdot([
    tehtava({ id: 'vanha', luotu: new Date(T0 - 5 * VRK).toISOString() }),
    tehtava({ id: 'uusi', luotu: new Date(T0 - 1 * VRK).toISOString() }),
  ], { role: 'admin' }, eventAllowed);
  assert.deepEqual(lista.map((t) => t.id), ['uusi', 'vanha']);
});
