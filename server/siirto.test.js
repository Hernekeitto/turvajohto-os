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
  joSiirrossa, kuittaaPakotus, kuittaamattomatPakotukset, luoSiirto, omatSiirrot, peruSiirto,
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

  const omat = omatSiirrot([odottaa, hyvaksytty, lahteva, vieras], 'piirivartija');
  assert.deepEqual(omat.saapuvat.map((s) => s.id), ['s1']);
  assert.deepEqual(omat.hyvaksytyt.map((s) => s.id), ['s2']);
  assert.deepEqual(omat.lahtevat.map((s) => s.id), ['s3']);
});

test('hyväksytty siirto avaa kohteen saajalle', () => {
  // Ilman tätä siirto olisi lupaus jota ei voi lunastaa: työ ilman kohteen ohjeita,
  // yhteystietoja ja vyöhykkeitä ei ole tehtävissä.
  const hyvaksytty = { ...siirto(), tila: 'hyvaksytty' };
  const avatut = siirtojenAvaamatKohteet([hyvaksytty], 'piirivartija');
  assert.equal(avatut.has('kohde-a'), true);
});

test('odottava, hylätty tai toisen siirto ei avaa kohdetta', () => {
  const odottaa = siirto();
  const hylatty = { ...siirto(), id: 's2', tila: 'hylatty' };
  const toisen = { ...siirto(), id: 's3', tila: 'hyvaksytty', saaja: 'joku-muu' };
  assert.equal(siirtojenAvaamatKohteet([odottaa, hylatty, toisen], 'piirivartija').size, 0);
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
