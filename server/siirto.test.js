// Tehtävänsiirron testit (erä 18).
//
// Painopiste on siinä mitä siirto EI saa tehdä: siirtyä itselle, mennä vuorottomalle,
// tulla hyväksytyksi kahdesti, tai kadota antajalta ennen kuin saaja on ottanut sen
// vastaan. Onnistuva siirto on helppo saada oikein vahingossakin.
//
// Ajetaan: node --test server/siirto.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VIESTIN_MAX,
  joSiirrossa, kiinnitaVuoroon, kuittaaPakotus, kuittaamattomatPakotukset, luoSiirto,
  merkitseValmiiksi, omatSiirrot,
  peruSiirto, rauetaVuoronMukana,
  siirtojenAvaamatKohteet, vastaaSiirtoon,
} from './siirto.js';

const T0 = Date.parse('2026-09-10T12:00:00Z');
const VUORO = { id: 'vuoro-y', siteId: 'kohde-b', vartija: 'piirivartija', tila: 'kesken' };

const siirto = (yli = {}) => luoSiirto({
  antaja: 'kauppakeskusvartija',
  saaja: 'piirivartija',
  laji: 'kierros',
  kohdeId: 'pohja-1',
  nimi: 'Yökierros',
  siteId: 'kohde-a',
  siteNimi: 'Kauppakeskus Hansa',
  saajanVuoro: VUORO,
  id: 's1',
  nyt: T0,
  ...yli,
}).siirto;

// --- Siirron luonti -----------------------------------------------------------------

test('siirto syntyy odottavana ja nimeää molemmat', () => {
  const s = siirto();
  assert.equal(s.tila, 'odottaa');
  assert.equal(s.antaja, 'kauppakeskusvartija');
  assert.equal(s.saaja, 'piirivartija');
  assert.equal(s.ratkaistu, null);
});

test('kohteen ja tehtävän nimi kopioidaan eikä viitata', () => {
  // Sama peruste kuin vuorolla: nimen muutos ei saa muuttaa mennyttä siirtoa.
  const s = siirto();
  assert.equal(s.nimi, 'Yökierros');
  assert.equal(s.siteNimi, 'Kauppakeskus Hansa');
});

test('saajan vuoro kirjataan siirtohetkellä', () => {
  // Raportointia varten: kertoo minkä vuoron aikana ylimääräinen työ tuli, eikä sitä voi
  // päätellä jälkikäteen aikaleimoista.
  assert.equal(siirto().vuoroId, 'vuoro-y');
});

test('itselle ei voi siirtää', () => {
  const tulos = luoSiirto({
    antaja: 'a', saaja: 'a', laji: 'kierros', kohdeId: 'p', nimi: 'x',
    siteId: 's', saajanVuoro: VUORO, id: 's1',
  });
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /itselleen/);
});

test('vuorottomalle ei voi siirtää', () => {
  // Päätös 10.9.2026. Perustelu on ihmisen eikä koneen: vapaapäivää viettävälle ei kuulu
  // lähettää hyväksymispyyntöä keskellä yötä.
  const tulos = luoSiirto({
    antaja: 'a', saaja: 'b', laji: 'kierros', kohdeId: 'p', nimi: 'x',
    siteId: 's', saajanVuoro: null, id: 's1',
  });
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /vuorossa/);
});

test('pakotus ei vaadi saajalta vuoroa', () => {
  // Erä 19: pääkäyttäjän määräys ei ole pyyntö, eikä sen ehtona voi olla että saaja on
  // sattumalta kirjautunut vuoroon.
  const tulos = luoSiirto({
    antaja: 'admin', saaja: 'b', laji: 'kierros', kohdeId: 'p', nimi: 'x',
    siteId: 's', saajanVuoro: null, tapa: 'pakotus', id: 's1',
  });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.siirto.tapa, 'pakotus');
});

test('tuntematon laji ja puuttuva kohde torjutaan', () => {
  assert.equal(luoSiirto({ antaja: 'a', saaja: 'b', laji: 'muu', kohdeId: 'p', siteId: 's', saajanVuoro: VUORO }).ok, false);
  assert.equal(luoSiirto({ antaja: 'a', saaja: 'b', laji: 'kierros', kohdeId: '', siteId: 's', saajanVuoro: VUORO }).ok, false);
  assert.equal(luoSiirto({ antaja: 'a', saaja: 'b', laji: 'kierros', kohdeId: 'p', siteId: '', saajanVuoro: VUORO }).ok, false);
});

test('viesti katkaistaan eikä hylätä', () => {
  const s = siirto({ viesti: 'x'.repeat(VIESTIN_MAX + 50) });
  assert.equal(s.viesti.length, VIESTIN_MAX);
});

test('sama tehtävä ei mene kahta kertaa odottamaan samalle', () => {
  const s = siirto();
  assert.equal(joSiirrossa([s], { saaja: 'piirivartija', kohdeId: 'pohja-1', laji: 'kierros' }), true);
  // Eri saaja, eri tehtävä ja eri laji ovat eri asioita.
  assert.equal(joSiirrossa([s], { saaja: 'joku-muu', kohdeId: 'pohja-1', laji: 'kierros' }), false);
  assert.equal(joSiirrossa([s], { saaja: 'piirivartija', kohdeId: 'pohja-2', laji: 'kierros' }), false);
  assert.equal(joSiirrossa([s], { saaja: 'piirivartija', kohdeId: 'pohja-1', laji: 'tehtava' }), false);
  // Ratkaistu siirto ei estä uutta.
  const hyvaksytty = { ...s, tila: 'hyvaksytty' };
  assert.equal(joSiirrossa([hyvaksytty], { saaja: 'piirivartija', kohdeId: 'pohja-1', laji: 'kierros' }), false);
});

// --- Vastaus ------------------------------------------------------------------------

test('saaja voi hyväksyä ja hylätä', () => {
  const hyv = vastaaSiirtoon({ siirto: siirto(), kayttaja: 'piirivartija', hyvaksy: true, nyt: T0 + 1000 });
  assert.equal(hyv.siirto.tila, 'hyvaksytty');
  assert.equal(hyv.siirto.ratkaistu, new Date(T0 + 1000).toISOString());

  const hyl = vastaaSiirtoon({ siirto: siirto(), kayttaja: 'piirivartija', hyvaksy: false, nyt: T0 });
  assert.equal(hyl.siirto.tila, 'hylatty');
});

test('vain saaja voi vastata', () => {
  const tulos = vastaaSiirtoon({ siirto: siirto(), kayttaja: 'kauppakeskusvartija', hyvaksy: true });
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /toiselle/);
});

test('samaan siirtoon ei vastata kahdesti', () => {
  const hyvaksytty = vastaaSiirtoon({ siirto: siirto(), kayttaja: 'piirivartija', hyvaksy: true }).siirto;
  const uudelleen = vastaaSiirtoon({ siirto: hyvaksytty, kayttaja: 'piirivartija', hyvaksy: false });
  assert.equal(uudelleen.ok, false);
});

test('pakotusta ei voi hylätä', () => {
  // Jos pakotuksen voisi hylätä, se ei olisi pakotus.
  const pakotettu = { ...siirto(), tapa: 'pakotus' };
  const tulos = vastaaSiirtoon({ siirto: pakotettu, kayttaja: 'piirivartija', hyvaksy: false });
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /kuitataan/);
});

// --- Peruminen ----------------------------------------------------------------------

test('antaja voi perua odottavan siirron', () => {
  const tulos = peruSiirto({ siirto: siirto(), kayttaja: 'kauppakeskusvartija', nyt: T0 });
  assert.equal(tulos.siirto.tila, 'peruttu');
});

test('hyväksyttyä ei voi perua eikä toisen siirtoa', () => {
  // Hyväksytty on jo toisen työtä, ja sen pois ottaminen ilman että saaja tietää olisi
  // juuri se tilanne jossa kierros jää ajamatta kummaltakin.
  const hyvaksytty = { ...siirto(), tila: 'hyvaksytty' };
  assert.equal(peruSiirto({ siirto: hyvaksytty, kayttaja: 'kauppakeskusvartija' }).ok, false);
  assert.equal(peruSiirto({ siirto: siirto(), kayttaja: 'piirivartija' }).ok, false);
});

// --- Näkymät ------------------------------------------------------------------------

test('omat siirrot erotellaan suuntansa mukaan', () => {
  const odottaa = siirto();
  const hyvaksytty = { ...siirto(), id: 's2', tila: 'hyvaksytty' };
  const lahteva = { ...siirto(), id: 's3', antaja: 'piirivartija', saaja: 'kolmas' };
  const vieras = { ...siirto(), id: 's4', antaja: 'x', saaja: 'y' };

  const omat = omatSiirrot([odottaa, hyvaksytty, lahteva, vieras], 'piirivartija', 'vuoro-y');
  assert.deepEqual(omat.saapuvat.map((s) => s.id), ['s1']);
  assert.deepEqual(omat.hyvaksytyt.map((s) => s.id), ['s2']);
  assert.deepEqual(omat.lahtevat.map((s) => s.id), ['s3']);
});

test('hyväksytty siirto avaa kohteen saajalle', () => {
  // Ilman tätä siirto olisi lupaus jota ei voi lunastaa: työ ilman kohteen ohjeita,
  // yhteystietoja ja vyöhykkeitä ei ole tehtävissä.
  const hyvaksytty = { ...siirto(), tila: 'hyvaksytty' };
  const avatut = siirtojenAvaamatKohteet([hyvaksytty], 'piirivartija', 'vuoro-y');
  assert.equal(avatut.has('kohde-a'), true);
});

test('odottava, hylätty tai toisen siirto ei avaa kohdetta', () => {
  const odottaa = siirto();
  const hylatty = { ...siirto(), id: 's2', tila: 'hylatty' };
  const toisen = { ...siirto(), id: 's3', tila: 'hyvaksytty', saaja: 'joku-muu' };
  assert.equal(siirtojenAvaamatKohteet([odottaa, hylatty, toisen], 'piirivartija', 'vuoro-y').size, 0);
});

// --- Pakotus (erä 19) ---------------------------------------------------------------

const pakotus = (yli = {}) => ({ ...siirto({ tapa: 'pakotus', saajanVuoro: null }), ...yli });

test('pakotus kuitataan nähdyksi', () => {
  const tulos = kuittaaPakotus({ siirto: pakotus(), kayttaja: 'piirivartija', nyt: T0 });
  assert.equal(tulos.siirto.tila, 'kuitattu');
  assert.equal(tulos.siirto.ratkaistu, new Date(T0).toISOString());
});

test('vain saaja kuittaa', () => {
  assert.equal(kuittaaPakotus({ siirto: pakotus(), kayttaja: 'joku-muu' }).ok, false);
});

test('SIIRTOA ei voi kuitata', () => {
  // Jos siirron voisi kuitata, saaja ohittaisi hyväksy/hylkää-valinnan kokonaan — ja
  // siirron koko pointti on että saaja saa valita.
  const tulos = kuittaaPakotus({ siirto: siirto(), kayttaja: 'piirivartija' });
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /hyväksytään tai hylätään/);
});

test('kuittauksen toisto on ok, mutta hylättyä ei kuitata', () => {
  const kuitattu = kuittaaPakotus({ siirto: pakotus(), kayttaja: 'piirivartija' }).siirto;
  const toisto = kuittaaPakotus({ siirto: kuitattu, kayttaja: 'piirivartija' });
  assert.equal(toisto.duplikaatti, true);
  assert.equal(kuittaaPakotus({ siirto: pakotus({ tila: 'peruttu' }), kayttaja: 'piirivartija' }).ok, false);
});

test('kuittaamattomat pakotukset erotellaan siirroista', () => {
  // Nämä estävät muun käytön, joten kutsujan on saatava ne erillään.
  const odottava = pakotus();
  const kuitattu = pakotus({ id: 's2', tila: 'kuitattu' });
  const tavallinen = siirto({ id: 's3' });
  const toisen = pakotus({ id: 's4', saaja: 'joku-muu' });
  const lista = kuittaamattomatPakotukset([odottava, kuitattu, tavallinen, toisen], 'piirivartija');
  assert.deepEqual(lista.map((s) => s.id), ['s1']);
});

test('PAKOTUS ei ole saapuva siirto', () => {
  // Ilman tätä pakotus näkyisi sekä hyväksyttävänä korttina että estävänä modaalina —
  // kaksi eri lupausta samasta tietueesta, joista toinen on väärä.
  const odottavaPakotus = pakotus();
  const omat = omatSiirrot([odottavaPakotus], 'piirivartija');
  assert.equal(omat.saapuvat.length, 0);
  assert.equal(kuittaamattomatPakotukset([odottavaPakotus], 'piirivartija').length, 1);
});

test('KUITATTU PAKOTUS on saajan tyota siina missa hyvaksytty siirtokin', () => {
  // Vika jonka selaintesti loysi: kuitattu pakotus katosi tyolistalta heti kun se
  // kuitattiin, vaikka kuittausmodaali lupasi "tehtava on jo lisatty sinulle".
  const kuitattu = pakotus({ tila: 'kuitattu' });
  const omat = omatSiirrot([kuitattu], 'piirivartija');
  assert.equal(omat.hyvaksytyt.length, 1);
  assert.equal(siirtojenAvaamatKohteet([kuitattu], 'piirivartija').has('kohde-a'), true);
});

test('hylatty tai peruttu ei ole kenenkaan tyota', () => {
  for (const tila of ['hylatty', 'peruttu', 'odottaa']) {
    const s = pakotus({ tila });
    assert.equal(omatSiirrot([s], 'piirivartija').hyvaksytyt.length, 0, tila);
    assert.equal(siirtojenAvaamatKohteet([s], 'piirivartija').size, 0, tila);
  }
});

// --- Pakotettu tehtävä ja sen raporttivaatimus (18.9.2026) ---------------------------
//
// Päivystäjä määrää tehtävän ja valitsee mitä siitä on kirjoitettava. Nämä testit
// vartioivat kahta asiaa: raporttivaatimusta ei voi ohittaa, eikä kuittausta voi
// hypätä yli — "olen nähnyt määräyksen" ja "olen tehnyt sen" ovat eri merkintöjä.

const maarays = (raporttilaji, tila = 'kuitattu') => ({
  id: 'p1', laji: 'oma', kohdeId: 'uuid-1', nimi: 'Vie vartijakutsupainike',
  siteId: 'k1', siteNimi: 'Teollisuuskatu 5', antaja: 'halke', saaja: 'Turva051',
  vuoroId: 'v1', tapa: 'pakotus', tila, viesti: '', raporttilaji, raportti: null,
  luotu: '2026-09-18T10:00:00.000Z', ratkaistu: null,
});

test('oma tehtävä vaatii nimen eikä sitä voi siirtää', () => {
  const yhteiset = { antaja: 'halke', saaja: 'v1', laji: 'oma', kohdeId: 'uuid-1', siteId: 'k1', id: 'x' };
  assert.equal(luoSiirto({ ...yhteiset, nimi: 'ab', tapa: 'pakotus' }).ok, false);
  assert.equal(luoSiirto({ ...yhteiset, nimi: 'Vie painike', tapa: 'siirto' }).ok, false);
  assert.equal(luoSiirto({ ...yhteiset, nimi: 'Vie painike', tapa: 'pakotus' }).ok, true);
});

test('tuntematon raporttilaji torjutaan', () => {
  const tulos = luoSiirto({
    antaja: 'halke', saaja: 'v1', laji: 'oma', kohdeId: 'uuid-1', siteId: 'k1',
    nimi: 'Vie painike', tapa: 'pakotus', raporttilaji: 'essee', id: 'x',
  });
  assert.equal(tulos.ok, false);
});

test('kuittaamatonta tehtävää ei voi merkitä tehdyksi', () => {
  // Kuittaus on se merkintä jonka takia pakotus on olemassa. Sen ohittaminen tekisi
  // määräyksestä toiveen.
  const tulos = merkitseValmiiksi({ siirto: maarays('kommentti', 'odottaa'), kayttaja: 'Turva051' });
  assert.equal(tulos.ok, false);
  assert.match(tulos.error, /kuitattava/i);
});

test('tapahtumailmoitus vaaditaan liitettäväksi', () => {
  const ilman = merkitseValmiiksi({ siirto: maarays('tapahtumailmoitus'), kayttaja: 'Turva051' });
  assert.equal(ilman.ok, false);
  const kera = merkitseValmiiksi({
    siirto: maarays('tapahtumailmoitus'), kayttaja: 'Turva051', raporttiId: 'r1',
  });
  assert.equal(kera.ok, true);
  assert.equal(kera.siirto.raportti.raporttiId, 'r1');
});

test('selvitys vaatii tekstiä, kommentti ei', () => {
  assert.equal(merkitseValmiiksi({ siirto: maarays('selvitys'), kayttaja: 'Turva051', teksti: 'ok' }).ok, false);
  const selvitys = merkitseValmiiksi({
    siirto: maarays('selvitys'), kayttaja: 'Turva051', teksti: 'Painike vietiin ja asennettiin.',
  });
  assert.equal(selvitys.ok, true);
  assert.equal(selvitys.siirto.raportti.teksti, 'Painike vietiin ja asennettiin.');
  // Kommentti saa jäädä tyhjäksi: pakotettu kenttä tuottaa keksittyä tekstiä.
  assert.equal(merkitseValmiiksi({ siirto: maarays('kommentti'), kayttaja: 'Turva051' }).ok, true);
});

test('toisen tehtävää ei voi merkitä tehdyksi eikä tehtyä uudelleen', () => {
  assert.equal(merkitseValmiiksi({ siirto: maarays('kommentti'), kayttaja: 'joku_muu' }).ok, false);
  const tehty = merkitseValmiiksi({ siirto: maarays('kommentti'), kayttaja: 'Turva051' }).siirto;
  const toisto = merkitseValmiiksi({ siirto: tehty, kayttaja: 'Turva051' });
  assert.equal(toisto.duplikaatti, true);
});

test('tehty pakotus pysyy vartijan listalla', () => {
  // Katoaminen listalta samalla sekunnilla kun se merkitään tehdyksi jättäisi vartijan
  // arvaamaan menikö merkinta lapi.
  const tehty = { ...maarays('kommentti'), tila: 'valmis' };
  assert.equal(omatSiirrot([tehty], 'Turva051', 'v1').hyvaksytyt.length, 1);
});

// --- Vuoro rajaa työlistan (19.9.2026) ----------------------------------------------
//
// Käyttäjän testivuorossa löytynyt vika: edellisessä vuorossa tehty pakotettu tehtävä
// näkyi yhä seuraavan vuoron listalla. Sääntö on nyt se että uudessa vuorossa on vain
// se mitä kohteen asetukset kylvävät, ja vuoron aikana annettu lisätyö jää siihen
// vuoroon jonka aikana se annettiin.

test('EDELLISEN VUORON tehty tehtava ei nay uudessa vuorossa', () => {
  const tehty = { ...maarays('kommentti'), tila: 'valmis' };
  // Sama tietue, eri vuoro: tehtynäkin se on menneen vuoron työtä.
  assert.equal(omatSiirrot([tehty], 'Turva051', 'v2').hyvaksytyt.length, 0);
  assert.equal(siirtojenAvaamatKohteet([tehty], 'Turva051', 'v2').size, 0);
});

test('edellisen vuoron kuittaamaton maarays ei esta uutta vuoroa', () => {
  // Kuittaamaton pakotus estää muun käytön modaalilla. Menneen vuoron määräyksestä se
  // olisi este työlle jota ei enää ole.
  const vanha = { ...maarays('kommentti', 'odottaa'), vuoroId: 'v1' };
  assert.equal(kuittaamattomatPakotukset([vanha], 'Turva051', 'v2').length, 0);
  assert.equal(kuittaamattomatPakotukset([vanha], 'Turva051', 'v1').length, 1);
});

test('vuorottomalle annettu maarays odottaa seuraavaa vuoroa', () => {
  // Pakotus ei vaadi saajalta vuoroa, joten vapaalla annettu tehtävä syntyy ilman
  // vuorotunnusta. Sen on näyttävä sekä vuorottomalle että vuoron aloittaneelle.
  const irrallinen = { ...maarays('kommentti', 'odottaa'), vuoroId: null };
  assert.equal(kuittaamattomatPakotukset([irrallinen], 'Turva051', null).length, 1);
  assert.equal(kuittaamattomatPakotukset([irrallinen], 'Turva051', 'v9').length, 1);
});

test('kiinnitys sitoo vain vuorottomat avoimet omat maaraykset', () => {
  const irrallinen = { ...maarays('kommentti', 'odottaa'), id: 'a', vuoroId: null };
  const tehty = { ...maarays('kommentti', 'valmis'), id: 'b', vuoroId: null };
  const toisen = { ...maarays('kommentti', 'odottaa'), id: 'c', vuoroId: null, saaja: 'Turva052' };
  const jokinVuoro = { ...maarays('kommentti', 'kuitattu'), id: 'd', vuoroId: 'v1' };

  const muuttuneet = kiinnitaVuoroon([irrallinen, tehty, toisen, jokinVuoro], {
    username: 'Turva051', vuoroId: 'v2',
  });
  assert.deepEqual(muuttuneet.map((s) => s.id), ['a']);
  assert.equal(muuttuneet[0].vuoroId, 'v2');
});

test('vuoron paattyessa auki jaaneet maaraykset raukeavat', () => {
  const kuittaamaton = { ...maarays('kommentti', 'odottaa'), id: 'a' };
  const kuitattu = { ...maarays('kommentti', 'kuitattu'), id: 'b' };
  const tehty = { ...maarays('kommentti', 'valmis'), id: 'c' };
  const toisenVuoron = { ...maarays('kommentti', 'odottaa'), id: 'd', vuoroId: 'v9' };

  const muuttuneet = rauetaVuoronMukana([kuittaamaton, kuitattu, tehty, toisenVuoron], {
    vuoroId: 'v1', nyt: T0,
  });
  // Tehtyä ei kosketa: tehty työ pysyy tehtynä, ja se rajautuu pois vuorotunnuksella.
  assert.deepEqual(muuttuneet.map((s) => s.id), ['a', 'b']);
  assert.equal(muuttuneet[0].tila, 'rauennut');
  assert.equal(muuttuneet[0].rauennut, new Date(T0).toISOString());
});

test('RAUKEAMINEN ON MERKINTA eika poisto', () => {
  // Pelkkä rajaus piilottaisi nämä, mutta silloin kuittaamaton määräys jäisi ikuisesti
  // odottavaan tilaan ja näyttäisi auki olevalta työltä joka ei ole kenenkään.
  const rauennut = rauetaVuoronMukana([maarays('kommentti', 'odottaa')], { vuoroId: 'v1' })[0];
  assert.equal(rauennut.antaja, 'halke');
  assert.equal(rauennut.nimi, 'Vie vartijakutsupainike');
  // Eikä sitä voi enää kuitata eikä tehdä: vuoro loppui alta.
  const kuittaus = kuittaaPakotus({ siirto: rauennut, kayttaja: 'Turva051' });
  assert.equal(kuittaus.ok, false);
  assert.match(kuittaus.error, /päättyneeseen vuoroon/);
  const valmis = merkitseValmiiksi({ siirto: { ...rauennut, tila: 'rauennut' }, kayttaja: 'Turva051' });
  assert.equal(valmis.ok, false);
  assert.match(valmis.error, /päättyneeseen vuoroon/);
});

test('rauennut ei ole kenenkaan tyota', () => {
  const rauennut = { ...maarays('kommentti', 'rauennut') };
  assert.equal(omatSiirrot([rauennut], 'Turva051', 'v1').hyvaksytyt.length, 0);
  assert.equal(siirtojenAvaamatKohteet([rauennut], 'Turva051', 'v1').size, 0);
  assert.equal(kuittaamattomatPakotukset([rauennut], 'Turva051', 'v1').length, 0);
});
