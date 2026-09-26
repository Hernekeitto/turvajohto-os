// PTT-kanavien jäsenyystestit (erä 26, vaihe 1).
//
// Painopiste on siinä ettei jäsenyys synny ilman kesken olevaa vuoroa, ja ettei
// piirikanava tule mukaan tavalliselle kohdevuorolle.
//
// Ajetaan: node --test server/kanavat.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  kohdeKanavaId, piiriKanavaId, alueKanavaId, onKiinteaKanavaId,
  omatKiinteatKanavat, kuuluuKiinteaanKanavaan, jasenetKiinteallaKanavalla,
  kaikkiKiinteatKanavat, kayttajanKanavaPoikkeus, kuuluuKiinteaanKanavaanPoikkeuksin,
  omatKiinteatKanavatPoikkeuksin, jasenetKiinteallaKanavallaPoikkeuksin,
  pttKaytossa, vuorossaOlevatMuut, vuorossaOlevat, onOsallistuja, loydaDm, luoDmKanava, dmPurkautunut,
  hataKanavaId, luoHataKanava, onHalyttaja, hataKanavaPurkautunut,
  pakotaLinjaAuki, vapautaLinjanPakotus, luoVapaaKanava,
} from './kanavat.js';

const kohdevuoro = (yli = {}) => ({
  siteId: 'kohde-1',
  siteNimi: 'Kauppakeskus Hansa',
  vuorotyyppiId: 'v-aamu',
  vuorotyyppiNimi: 'Aamuvuoro',
  tila: 'kesken',
  piiri: false,
  ...yli,
});

test('pttKaytossa on oletuksena päällä (käänteinen oletus kuin seurantaKaytossa)', () => {
  const alkuperainen = process.env.PTT_POIS_KAYTOSTA;
  delete process.env.PTT_POIS_KAYTOSTA;
  try {
    assert.equal(pttKaytossa(), true);
  } finally {
    if (alkuperainen === undefined) delete process.env.PTT_POIS_KAYTOSTA;
    else process.env.PTT_POIS_KAYTOSTA = alkuperainen;
  }
});

test('pttKaytossa menee pois vain tarkalla arvolla "1"', () => {
  const alkuperainen = process.env.PTT_POIS_KAYTOSTA;
  try {
    process.env.PTT_POIS_KAYTOSTA = '1';
    assert.equal(pttKaytossa(), false);
    process.env.PTT_POIS_KAYTOSTA = 'true';
    assert.equal(pttKaytossa(), true);
  } finally {
    if (alkuperainen === undefined) delete process.env.PTT_POIS_KAYTOSTA;
    else process.env.PTT_POIS_KAYTOSTA = alkuperainen;
  }
});

test('ei kanavia ilman vuoroa', () => {
  assert.deepEqual(omatKiinteatKanavat(null), []);
});

test('ei kanavia päättyneelle vuorolle', () => {
  assert.deepEqual(omatKiinteatKanavat(kohdevuoro({ tila: 'paattynyt' })), []);
});

test('tavallinen kohdevuoro tuo vain kohdekanavan', () => {
  const kanavat = omatKiinteatKanavat(kohdevuoro());
  assert.equal(kanavat.length, 1);
  assert.equal(kanavat[0].id, kohdeKanavaId('kohde-1'));
  assert.equal(kanavat[0].tyyppi, 'kohde');
  assert.equal(kanavat[0].nimi, 'Kauppakeskus Hansa');
});

test('piirivuoro tuo sekä kohde- että piirikanavan', () => {
  const kanavat = omatKiinteatKanavat(kohdevuoro({ piiri: true, vuorotyyppiId: 'v-piiri-301', vuorotyyppiNimi: 'Piiri 301' }));
  assert.equal(kanavat.length, 2);
  assert.equal(kanavat[0].tyyppi, 'kohde');
  assert.equal(kanavat[1].id, piiriKanavaId('v-piiri-301'));
  assert.equal(kanavat[1].tyyppi, 'piiri');
  assert.equal(kanavat[1].nimi, 'Piiri 301');
});

test('vuoro ilman aluetta ei tuo aluekanavaa', () => {
  const kanavat = omatKiinteatKanavat(kohdevuoro());
  assert.equal(kanavat.some((k) => k.tyyppi === 'alue'), false);
});

test('vuoro jolla on alue tuo sekä kohde- että aluekanavan', () => {
  const kanavat = omatKiinteatKanavat(kohdevuoro({ alue: 'Tampere' }));
  assert.equal(kanavat.length, 2);
  assert.equal(kanavat[0].tyyppi, 'kohde');
  assert.equal(kanavat[1].id, alueKanavaId('Tampere'));
  assert.equal(kanavat[1].tyyppi, 'alue');
  assert.equal(kanavat[1].nimi, 'Tampere');
});

test('alueKanavaId normalisoi kirjainkoon ja välilyönnit samaan tunnukseen', () => {
  assert.equal(alueKanavaId('Tampere'), alueKanavaId(' tampere '));
});

test('kuuluuKiinteaanKanavaan tunnistaa oman kohdekanavan', () => {
  const vuoro = kohdevuoro();
  assert.equal(kuuluuKiinteaanKanavaan(vuoro, kohdeKanavaId('kohde-1')), true);
  assert.equal(kuuluuKiinteaanKanavaan(vuoro, kohdeKanavaId('toinen-kohde')), false);
  assert.equal(kuuluuKiinteaanKanavaan(vuoro, piiriKanavaId('v-aamu')), false);
});

test('kuuluuKiinteaanKanavaan ilman vuoroa ei tunnista mitään', () => {
  assert.equal(kuuluuKiinteaanKanavaan(null, kohdeKanavaId('kohde-1')), false);
});

test('jasenetKiinteallaKanavalla kokoaa kaikki vuorossa olevat ilman kaksoiskappaleita', () => {
  const vuorot = [
    kohdevuoro({ vartija: 'vartija1' }),
    kohdevuoro({ vartija: 'vartija2' }),
    kohdevuoro({ vartija: 'vartija2' }),
    kohdevuoro({ vartija: 'vartija3', tila: 'paattynyt' }),
    kohdevuoro({ vartija: 'vartija4', siteId: 'toinen-kohde' }),
  ];
  assert.deepEqual(jasenetKiinteallaKanavalla(vuorot, kohdeKanavaId('kohde-1')).sort(), ['vartija1', 'vartija2']);
});

test('jasenetKiinteallaKanavalla ei sekoita tavallista kohdevuoroa piirikanavaan', () => {
  const vuorot = [
    kohdevuoro({ vartija: 'vartija1' }),
    kohdevuoro({ vartija: 'vartija2', piiri: true, vuorotyyppiId: 'v-piiri-301' }),
  ];
  assert.deepEqual(jasenetKiinteallaKanavalla(vuorot, piiriKanavaId('v-piiri-301')), ['vartija2']);
});

test('jasenetKiinteallaKanavalla palauttaa tyhjän listan tuntemattomalle kanavalle', () => {
  assert.deepEqual(jasenetKiinteallaKanavalla([kohdevuoro({ vartija: 'vartija1' })], kohdeKanavaId('ei-ole')), []);
});

// --- onKiinteaKanavaId ---------------------------------------------------------------

test('onKiinteaKanavaId tunnistaa kohde/piiri/alue-etuliitteet muttei muita', () => {
  assert.equal(onKiinteaKanavaId(kohdeKanavaId('x')), true);
  assert.equal(onKiinteaKanavaId(piiriKanavaId('x')), true);
  assert.equal(onKiinteaKanavaId(alueKanavaId('x')), true);
  assert.equal(onKiinteaKanavaId('dm:jokin'), false);
  assert.equal(onKiinteaKanavaId('vapaa:jokin'), false);
  assert.equal(onKiinteaKanavaId('hata:jokin'), false);
});

// --- kaikkiKiinteatKanavat (kaikki mahdolliset kanavat, ei vuoroista) -----------------

const kohdeTietue = (yli = {}) => ({
  id: 'kohde-1', name: 'Kauppakeskus Hansa', vuorotyypit: [], ...yli,
});

test('kaikkiKiinteatKanavat tuottaa kohdekanavan jokaiselle kohteelle ilman vuoroja', () => {
  const kanavat = kaikkiKiinteatKanavat([kohdeTietue(), kohdeTietue({ id: 'kohde-2', name: 'Toinen' })]);
  assert.equal(kanavat.length, 2);
  assert.deepEqual(kanavat.map((k) => k.id).sort(), [kohdeKanavaId('kohde-1'), kohdeKanavaId('kohde-2')].sort());
});

test('kaikkiKiinteatKanavat deduplikoi piirikanavan yli kohteiden', () => {
  const vt = { id: 'v-piiri-301', nimi: 'Piiri 301', piiri: true };
  const kanavat = kaikkiKiinteatKanavat([
    kohdeTietue({ vuorotyypit: [vt] }),
    kohdeTietue({ id: 'kohde-2', vuorotyypit: [vt] }),
  ]);
  const piirikanavat = kanavat.filter((k) => k.tyyppi === 'piiri');
  assert.equal(piirikanavat.length, 1);
  assert.equal(piirikanavat[0].id, piiriKanavaId('v-piiri-301'));
});

test('kaikkiKiinteatKanavat ei tuota piirikanavaa vuorotyypille jolla piiri ei ole päällä', () => {
  const kanavat = kaikkiKiinteatKanavat([kohdeTietue({ vuorotyypit: [{ id: 'v-aamu', nimi: 'Aamu', piiri: false }] })]);
  assert.equal(kanavat.some((k) => k.tyyppi === 'piiri'), false);
});

test('kaikkiKiinteatKanavat deduplikoi alueen normalisoituna', () => {
  const kanavat = kaikkiKiinteatKanavat([
    kohdeTietue({ alue: 'Tampere' }),
    kohdeTietue({ id: 'kohde-2', alue: ' tampere ' }),
  ]);
  const aluekanavat = kanavat.filter((k) => k.tyyppi === 'alue');
  assert.equal(aluekanavat.length, 1);
  assert.equal(aluekanavat[0].id, alueKanavaId('Tampere'));
});

test('kaikkiKiinteatKanavat jättää tyhjän alueen pois', () => {
  const kanavat = kaikkiKiinteatKanavat([kohdeTietue({ alue: '' }), kohdeTietue({ id: 'kohde-2' })]);
  assert.equal(kanavat.some((k) => k.tyyppi === 'alue'), false);
});

// --- Jäsenpoikkeukset (pakotettu lisäys/poisto kiinteälle kanavalle) ------------------

test('kayttajanKanavaPoikkeus löytää oikean rivin ja palauttaa null jos ei poikkeusta', () => {
  const poikkeukset = [{ kanavaId: 'kohde:1', kayttaja: 'v1', tila: 'lisatty' }];
  assert.equal(kayttajanKanavaPoikkeus(poikkeukset, 'kohde:1', 'v1'), 'lisatty');
  assert.equal(kayttajanKanavaPoikkeus(poikkeukset, 'kohde:1', 'v2'), null);
  assert.equal(kayttajanKanavaPoikkeus(poikkeukset, 'kohde:2', 'v1'), null);
});

test('kuuluuKiinteaanKanavaanPoikkeuksin: poistettu voittaa vuoron', () => {
  const vuoro = kohdevuoro();
  const kanavaId = kohdeKanavaId('kohde-1');
  const poikkeukset = [{ kanavaId, kayttaja: 'v1', tila: 'poistettu' }];
  assert.equal(kuuluuKiinteaanKanavaanPoikkeuksin(vuoro, kanavaId, 'v1', poikkeukset), false);
});

test('kuuluuKiinteaanKanavaanPoikkeuksin: lisatty myöntää jäsenyyden ilman vuoroa', () => {
  const kanavaId = kohdeKanavaId('toinen-kohde');
  const poikkeukset = [{ kanavaId, kayttaja: 'v1', tila: 'lisatty' }];
  assert.equal(kuuluuKiinteaanKanavaanPoikkeuksin(null, kanavaId, 'v1', poikkeukset), true);
});

test('kuuluuKiinteaanKanavaanPoikkeuksin: ilman poikkeusta käyttäytyy kuten kuuluuKiinteaanKanavaan', () => {
  const vuoro = kohdevuoro();
  const kanavaId = kohdeKanavaId('kohde-1');
  assert.equal(kuuluuKiinteaanKanavaanPoikkeuksin(vuoro, kanavaId, 'v1', []), true);
  assert.equal(kuuluuKiinteaanKanavaanPoikkeuksin(vuoro, kohdeKanavaId('muu'), 'v1', []), false);
});

test('omatKiinteatKanavatPoikkeuksin: poistettu suodattaa oman vuoron kanavan pois', () => {
  const vuoro = kohdevuoro();
  const poikkeukset = [{ kanavaId: kohdeKanavaId('kohde-1'), kayttaja: 'v1', tila: 'poistettu' }];
  const tulos = omatKiinteatKanavatPoikkeuksin(vuoro, 'v1', poikkeukset, []);
  assert.equal(tulos.length, 0);
});

test('omatKiinteatKanavatPoikkeuksin: lisatty tuo kanavan katalogista vaikka ei omaa vuoroa', () => {
  const katalogi = kaikkiKiinteatKanavat([kohdeTietue({ id: 'toinen-kohde', name: 'Toinen kohde' })]);
  const poikkeukset = [{ kanavaId: kohdeKanavaId('toinen-kohde'), kayttaja: 'v1', tila: 'lisatty' }];
  const tulos = omatKiinteatKanavatPoikkeuksin(null, 'v1', poikkeukset, katalogi);
  assert.equal(tulos.length, 1);
  assert.equal(tulos[0].id, kohdeKanavaId('toinen-kohde'));
  assert.equal(tulos[0].nimi, 'Toinen kohde');
});

test('omatKiinteatKanavatPoikkeuksin: lisatty ei tuota kaksoiskappaletta jos kanava on jo omasta vuorosta', () => {
  const vuoro = kohdevuoro();
  const katalogi = kaikkiKiinteatKanavat([kohdeTietue()]);
  const poikkeukset = [{ kanavaId: kohdeKanavaId('kohde-1'), kayttaja: 'v1', tila: 'lisatty' }];
  const tulos = omatKiinteatKanavatPoikkeuksin(vuoro, 'v1', poikkeukset, katalogi);
  assert.equal(tulos.length, 1);
});

test('jasenetKiinteallaKanavallaPoikkeuksin: lisää ja poistaa jäseniä luonnollisen listan päälle', () => {
  const kanavaId = kohdeKanavaId('kohde-1');
  const vuorot = [
    kohdevuoro({ vartija: 'v1' }),
    kohdevuoro({ vartija: 'v2' }),
  ];
  const poikkeukset = [
    { kanavaId, kayttaja: 'v2', tila: 'poistettu' },
    { kanavaId, kayttaja: 'v3', tila: 'lisatty' },
  ];
  assert.deepEqual(
    jasenetKiinteallaKanavallaPoikkeuksin(vuorot, kanavaId, poikkeukset).sort(),
    ['v1', 'v3'],
  );
});

test('jasenetKiinteallaKanavallaPoikkeuksin: ilman poikkeuksia vastaa jasenetKiinteallaKanavalla', () => {
  const kanavaId = kohdeKanavaId('kohde-1');
  const vuorot = [kohdevuoro({ vartija: 'v1' })];
  assert.deepEqual(jasenetKiinteallaKanavallaPoikkeuksin(vuorot, kanavaId, []), ['v1']);
});

// --- DM (vaihe 1c) -------------------------------------------------------------------

test('vuorossaOlevatMuut palauttaa muut kesken olevat vuorot ilman kaksoiskappaleita', () => {
  const vuorot = [
    { tila: 'kesken', vartija: 'vartija1' },
    { tila: 'kesken', vartija: 'vartija2' },
    { tila: 'kesken', vartija: 'vartija2' },
    { tila: 'paattynyt', vartija: 'vartija3' },
  ];
  assert.deepEqual(vuorossaOlevatMuut(vuorot, 'vartija1'), ['vartija2']);
});

test('vuorossaOlevatMuut ei sisällä omaa tunnusta vaikka olisi kahdesti vuorossa', () => {
  const vuorot = [{ tila: 'kesken', vartija: 'vartija1' }];
  assert.deepEqual(vuorossaOlevatMuut(vuorot, 'vartija1'), []);
});

test('vuorossaOlevat sisältää itsensä toisin kuin vuorossaOlevatMuut', () => {
  const vuorot = [
    { tila: 'kesken', vartija: 'vartija1' },
    { tila: 'kesken', vartija: 'vartija2' },
    { tila: 'paattynyt', vartija: 'vartija3' },
  ];
  assert.deepEqual(vuorossaOlevat(vuorot), new Set(['vartija1', 'vartija2']));
});

test('vuorossaOlevat tyhjälle listalle on tyhjä joukko', () => {
  assert.deepEqual(vuorossaOlevat([]), new Set());
});

test('luoDmKanava luo kahden osapuolen tietueen', () => {
  const tulos = luoDmKanava({ id: 'k1', kayttaja1: 'vartija1', kayttaja2: 'vartija2', nyt: 0 });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.kanava.tyyppi, 'dm');
  assert.deepEqual(tulos.kanava.osallistujat, ['vartija1', 'vartija2']);
  assert.equal(tulos.kanava.luoja, 'vartija1');
});

test('luoDmKanava ei salli samaa käyttäjää molemmiksi osapuoliksi', () => {
  const tulos = luoDmKanava({ id: 'k1', kayttaja1: 'vartija1', kayttaja2: 'vartija1' });
  assert.equal(tulos.ok, false);
});

test('loydaDm löytää olemassa olevan kanavan järjestyksestä riippumatta', () => {
  const kanavat = [{ id: 'k1', tyyppi: 'dm', osallistujat: ['vartija1', 'vartija2'] }];
  assert.equal(loydaDm(kanavat, 'vartija1', 'vartija2')?.id, 'k1');
  assert.equal(loydaDm(kanavat, 'vartija2', 'vartija1')?.id, 'k1');
  assert.equal(loydaDm(kanavat, 'vartija1', 'vartija3'), null);
});

test('loydaDm ei sekoita vapaata ryhmää DM:ään vaikka osallistujat täsmäisivät', () => {
  const kanavat = [{ id: 'k1', tyyppi: 'vapaa', osallistujat: ['vartija1', 'vartija2'] }];
  assert.equal(loydaDm(kanavat, 'vartija1', 'vartija2'), null);
});

test('onOsallistuja tunnistaa osallistujan ja ei-osallistujan', () => {
  const kanava = { osallistujat: ['vartija1', 'vartija2'] };
  assert.equal(onOsallistuja(kanava, 'vartija1'), true);
  assert.equal(onOsallistuja(kanava, 'vartija3'), false);
  assert.equal(onOsallistuja(null, 'vartija1'), false);
});

test('dmPurkautunut on tosi kun kumpikaan osapuoli ei ole vuorossa', () => {
  const kanava = { tyyppi: 'dm', osallistujat: ['vartija1', 'vartija2'] };
  assert.equal(dmPurkautunut(kanava, new Set()), true);
});

test('dmPurkautunut on epätosi jos toinenkin osapuoli on yhä vuorossa', () => {
  const kanava = { tyyppi: 'dm', osallistujat: ['vartija1', 'vartija2'] };
  assert.equal(dmPurkautunut(kanava, new Set(['vartija2'])), false);
});

test('dmPurkautunut ei koske muun tyyppisiä kanavia', () => {
  const kanava = { tyyppi: 'vapaa', osallistujat: ['vartija1', 'vartija2'] };
  assert.equal(dmPurkautunut(kanava, new Set()), false);
});

// --- Hätäkanava (vaihe 1d) -------------------------------------------------------

test('luoHataKanava tuottaa hälyttäjän ja hälytystyypin sisältävän tietueen', () => {
  const kanava = luoHataKanava({ halytysId: 'h1', vartija: 'vartija1', halytysTyyppi: 'mandown', nyt: 0 });
  assert.equal(kanava.id, hataKanavaId('h1'));
  assert.equal(kanava.tyyppi, 'hata');
  assert.equal(kanava.liittyvaHalytysId, 'h1');
  assert.equal(kanava.halytysTyyppi, 'mandown');
  assert.equal(kanava.vartija, 'vartija1');
  assert.equal(kanava.haltePidaHengissa, null);
});

test('onHalyttaja tunnistaa hälyttäjän mutta ei muita eikä muun tyyppisiä kanavia', () => {
  const kanava = luoHataKanava({ halytysId: 'h1', vartija: 'vartija1', halytysTyyppi: 'panic' });
  assert.equal(onHalyttaja(kanava, 'vartija1'), true);
  assert.equal(onHalyttaja(kanava, 'vartija2'), false);
  assert.equal(onHalyttaja({ ...kanava, tyyppi: 'dm' }, 'vartija1'), false);
});

test('hataKanavaPurkautunut on epätosi kun hälytys on yhä avoin', () => {
  const kanava = luoHataKanava({ halytysId: 'h1', vartija: 'vartija1', halytysTyyppi: 'panic' });
  assert.equal(hataKanavaPurkautunut(kanava, { tila: 'lauennut' }), false);
  assert.equal(hataKanavaPurkautunut(kanava, { tila: 'kaynnissa' }), false);
});

test('hataKanavaPurkautunut on tosi kun hälytys on kuitattu, peruttu tai kadonnut', () => {
  const kanava = luoHataKanava({ halytysId: 'h1', vartija: 'vartija1', halytysTyyppi: 'panic' });
  assert.equal(hataKanavaPurkautunut(kanava, { tila: 'kuitattu' }), true);
  assert.equal(hataKanavaPurkautunut(kanava, { tila: 'peruttu' }), true);
  assert.equal(hataKanavaPurkautunut(kanava, null), true);
});

test('hataKanavaPurkautunut ei koske muun tyyppisiä kanavia', () => {
  assert.equal(hataKanavaPurkautunut({ tyyppi: 'dm' }, null), false);
});

// --- Linjan pakotus (vaihe 1e) ----------------------------------------------------

test('pakotaLinjaAuki asettaa haltePidaHengissa-kentän', () => {
  const kanava = luoHataKanava({ halytysId: 'h1', vartija: 'vartija1', halytysTyyppi: 'panic' });
  const paivitetty = pakotaLinjaAuki(kanava, 'paivystaja1', 0);
  assert.deepEqual(paivitetty.haltePidaHengissa, { kayttaja: 'paivystaja1', alkaen: new Date(0).toISOString() });
  // Alkuperäinen tietue ei muutu — kutsuja päättää mitä levylle kirjoitetaan.
  assert.equal(kanava.haltePidaHengissa, null);
});

test('pakotaLinjaAuki ei koske muun tyyppistä kanavaa', () => {
  const kanava = { tyyppi: 'dm', osallistujat: ['vartija1', 'vartija2'] };
  assert.equal(pakotaLinjaAuki(kanava, 'paivystaja1'), kanava);
});

test('vapautaLinjanPakotus tyhjentää kentän', () => {
  const kanava = pakotaLinjaAuki(
    luoHataKanava({ halytysId: 'h1', vartija: 'vartija1', halytysTyyppi: 'panic' }), 'paivystaja1',
  );
  assert.equal(vapautaLinjanPakotus(kanava).haltePidaHengissa, null);
});

test('vapautaLinjanPakotus ei koske muun tyyppistä kanavaa', () => {
  const kanava = { tyyppi: 'vapaa', haltePidaHengissa: { kayttaja: 'x' } };
  assert.equal(vapautaLinjanPakotus(kanava), kanava);
});

// --- Vapaa ryhmä (vaihe 1g) --------------------------------------------------------

test('luoVapaaKanava luo nimetyn ryhmän uniikeista osallistujista', () => {
  const tulos = luoVapaaKanava({
    id: 'k1', nimi: '  Yöpartio  ', osallistujat: ['vartija1', 'vartija2', 'vartija1'], luoja: 'admin', nyt: 0,
  });
  assert.equal(tulos.ok, true);
  assert.equal(tulos.kanava.tyyppi, 'vapaa');
  assert.equal(tulos.kanava.nimi, 'Yöpartio');
  assert.deepEqual(tulos.kanava.osallistujat, ['vartija1', 'vartija2']);
  assert.equal(tulos.kanava.luoja, 'admin');
});

test('luoVapaaKanava vaatii nimen', () => {
  const tulos = luoVapaaKanava({ id: 'k1', nimi: '  ', osallistujat: ['vartija1', 'vartija2'], luoja: 'admin' });
  assert.equal(tulos.ok, false);
});

test('luoVapaaKanava vaatii vähintään kaksi eri osallistujaa', () => {
  assert.equal(luoVapaaKanava({ id: 'k1', nimi: 'Ryhmä', osallistujat: ['vartija1'], luoja: 'admin' }).ok, false);
  assert.equal(
    luoVapaaKanava({ id: 'k1', nimi: 'Ryhmä', osallistujat: ['vartija1', 'vartija1'], luoja: 'admin' }).ok, false,
  );
});

test('onOsallistuja tunnistaa vapaan ryhmän jäsenen', () => {
  const tulos = luoVapaaKanava({ id: 'k1', nimi: 'Ryhmä', osallistujat: ['vartija1', 'vartija2'], luoja: 'admin' });
  assert.equal(onOsallistuja(tulos.kanava, 'vartija1'), true);
  assert.equal(onOsallistuja(tulos.kanava, 'vartija3'), false);
});
