// Generaattorin testit (erä 7).
//
// Painopiste: generaattori ei koskaan ehdota estettä tai poikkeamaa, se täyttää vajaat
// jaksot ensin, kunnioittaa toiveita, jakaa viikonloput ja on deterministinen.
//
// Ajetaan: node --test server/tyovuorogeneraattori.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { laskeEhdotus } from './tyovuorogeneraattori.js';
import { tarkistaLista, tyhjaLista } from './tyovuorolistat.js';
import { listat, normalisoiAsetukset, suunnitellutVuorot } from './tyovuorolista.js';

const ASETUKSET = normalisoiAsetukset({ jaksotAlkaen: '2026-10-05' });
const LISTA = listat(ASETUKSET, '2026-10-05', 1)[0];

const henkilo = (username, yli = {}) => ({
  username, nimi: username, workTimeType: 'monthly', hasGuardCard: true, guardCardValidUntil: '2028-12', ...yli,
});

const kohde = (maarat = [1, 1, 1, 1, 1, 1, 1], perehdytetyt = ['a', 'b', 'c']) => ({
  id: 'k1', name: 'Kohde',
  perehdytykset: perehdytetyt.map((u) => ({ username: u, vuorotyyppiIdt: ['aamu', 'ilta'] })),
  vuorotyypit: [
    { id: 'aamu', nimi: 'Aamu', alkaa: '06:00', paattyy: '14:00', suunnittelu: { maarat } },
    { id: 'ilta', nimi: 'Ilta', alkaa: '14:00', paattyy: '22:00', suunnittelu: { maarat } },
  ],
});

function laske({ kohteet = [kohde()], henkilot = [henkilo('a'), henkilo('b'), henkilo('c')], tietue = tyhjaLista(LISTA), ...yli } = {}) {
  const vuorot = new Map(suunnitellutVuorot(kohteet, '2026-09-07', LISTA.loppu).map((v) => [v.id, v]));
  const listanVuorot = new Map([...vuorot].filter(([, v]) => v.pvm >= LISTA.alku));
  const syote = {
    tietue, lista: LISTA, vuorot, listanVuorot, henkilot, kohteet, asetukset: ASETUKSET, muutSijoitukset: [],
    nytPaikallinen: '2026-09-30T12:00', ...yli,
  };
  return { ...laskeEhdotus(syote), syote };
}

// Ehdotuksen jälkeinen tarkistus: yhtään estettä tai poikkeamaa ei saa syntyä.
function tarkistaTulos({ ehdotus, syote }) {
  const tulokset = tarkistaLista({
    lista: LISTA, sijoitukset: [...(syote.tietue.sijoitukset || []), ...ehdotus], vuorot: syote.vuorot,
    henkilot: syote.henkilot, kohteet: syote.kohteet, asetukset: ASETUKSET,
    poissaolot: syote.poissaolot || [], toiveet: syote.toiveet || [],
  });
  return Object.values(tulokset).flatMap((t) => t.havainnot).filter((h) => h.taso === 'este' || h.taso === 'poikkeama');
}

test('täyttää kaikki vuorot kun tekijöitä riittää, ilman esteitä ja poikkeamia', () => {
  const r = laske();
  assert.equal(r.ehdotus.length, 42); // 21 päivää × aamu + ilta
  assert.equal(r.avoimiksi.length, 0);
  assert.deepEqual(tarkistaTulos(r), []);
});

test('jakaa tunnit tasaisesti: kukaan ei ylitä 120 h kun muita on tarjolla', () => {
  const r = laske();
  const tunnit = {};
  for (const e of r.ehdotus) tunnit[e.username] = (tunnit[e.username] || 0) + 8;
  assert.ok(Object.values(tunnit).every((t) => t <= 120), JSON.stringify(tunnit));
  assert.ok(Math.max(...Object.values(tunnit)) - Math.min(...Object.values(tunnit)) <= 16, JSON.stringify(tunnit));
});

test('deterministinen: sama syöte, sama ehdotus', () => {
  assert.deepEqual(laske().ehdotus, laske().ehdotus);
});

test('ei koske sijoitettuihin eikä alkaneisiin vuoroihin', () => {
  const tietue = { ...tyhjaLista(LISTA), sijoitukset: [{ vuoroId: 'k1:aamu:2026-10-20:1', username: 'c' }] };
  const r = laske({ tietue, nytPaikallinen: '2026-10-10T12:00' });
  assert.ok(!r.ehdotus.some((e) => e.vuoroId === 'k1:aamu:2026-10-20:1'));
  assert.ok(r.ehdotus.every((e) => e.vuoroId.split(':')[2] >= '2026-10-10'));
  assert.ok(!r.ehdotus.some((e) => e.vuoroId === 'k1:aamu:2026-10-10:1')); // alkoi 06:00
});

test('perehdyttämätön ja reservi eivät saa vuoroja', () => {
  const r = laske({ kohteet: [kohde(undefined, ['a', 'r'])], henkilot: [henkilo('a'), henkilo('b'), henkilo('r', { workTimeType: 'oncall' })] });
  assert.ok(r.ehdotus.every((e) => e.username === 'a'));
  assert.ok(r.avoimiksi.length > 0);
});

test('ei perehdytettyjä: vuoro jää avoimeksi syyn kanssa', () => {
  const r = laske({ kohteet: [kohde(undefined, [])] });
  assert.equal(r.ehdotus.length, 0);
  assert.match(r.avoimiksi[0].syy, /perehdytetty/);
});

test('yksi tekijä: jättää avoimeksi ne joihin tulisi poikkeama, ei ehdota poikkeamaa', () => {
  const r = laske({ kohteet: [kohde(undefined, ['a'])], henkilot: [henkilo('a')] });
  assert.ok(r.ehdotus.length > 0);
  assert.ok(r.avoimiksi.length > 0);
  assert.deepEqual(tarkistaTulos(r), []);
  assert.ok(r.avoimiksi.some((x) => /este tai TES-poikkeama/.test(x.syy)));
});

test('poissaolo: lomalla olevalle ei ehdoteta', () => {
  const poissaolot = [{ username: 'a', laji: 'vuosiloma', alku: '2026-10-05', loppu: '2026-10-11', tunnit: 40.2 }];
  const r = laske({ poissaolot });
  assert.ok(!r.ehdotus.some((e) => e.username === 'a' && e.vuoroId.split(':')[2] <= '2026-10-11'));
});

test('toive: "toivon vapaata" kunnioitetaan kun muita on, "toivon vuoroa" suositaan', () => {
  const toiveet = [
    { username: 'a', pvm: '2026-10-07', laji: 'vapaa' },
    { username: 'c', pvm: '2026-10-08', laji: 'vuoro' },
  ];
  const r = laske({ toiveet });
  assert.ok(!r.ehdotus.some((e) => e.username === 'a' && e.vuoroId.includes('2026-10-07')));
  assert.ok(r.ehdotus.some((e) => e.username === 'c' && e.vuoroId.includes('2026-10-08')));
});

test('viikonloput jakautuvat', () => {
  // 3 viikkoa × la+su × 2 vuoroa = 12 viikonloppuvuoroa kolmelle.
  const r = laske();
  const vl = {};
  for (const e of r.ehdotus) {
    const vp = new Date(`${e.vuoroId.split(':')[2]}T00:00:00Z`).getUTCDay();
    if (vp === 0 || vp === 6) vl[e.username] = (vl[e.username] || 0) + 1;
  }
  assert.ok(Math.max(...Object.values(vl)) - Math.min(...Object.values(vl)) <= 2, JSON.stringify(vl));
});

test('ei teetä ylityötä: liian vähillä tekijöillä vuorot jäävät avoimiksi', () => {
  // Kaksi tekijää, 42 vuoroa × 8 h = 336 h, katto 2 × 120 h.
  const r = laske({ kohteet: [kohde(undefined, ['a', 'b'])], henkilot: [henkilo('a'), henkilo('b')] });
  const tunnit = {};
  for (const e of r.ehdotus) tunnit[e.username] = (tunnit[e.username] || 0) + 8;
  assert.ok(Object.values(tunnit).every((t) => t <= 120), JSON.stringify(tunnit));
  assert.ok(r.avoimiksi.some((x) => /suostumuksen/.test(x.syy)));
});

test('loman tunnit lasketaan kattoon', () => {
  const poissaolot = [{ username: 'a', laji: 'vuosiloma', alku: '2026-10-19', loppu: '2026-10-25', tunnit: 100 }];
  const r = laske({ poissaolot });
  const a = r.ehdotus.filter((e) => e.username === 'a').length * 8;
  assert.ok(a + 100 <= 120, `a: ${a} h + 100 h lomaa`);
});

test('osa-aikaisen vähimmäistyöaika täyttyy ensin, vaje jää kuukausipalkkaisille', () => {
  // 36 vuoroa × 8 h = 288 h, tavoitteet 120 + 120 + 60 = 300 h.
  const k = kohde([1, 1, 1, 1, 1, 1, 1]);
  k.vuorotyypit[1].suunnittelu.maarat = [1, 1, 1, 1, 1, 0, 0];
  const r = laske({ kohteet: [k], henkilot: [henkilo('a'), henkilo('b'), henkilo('c', { workTimeType: 'parttime', minHoursPer3Weeks: '60' })] });
  const t = {};
  for (const e of r.ehdotus) t[e.username] = (t[e.username] || 0) + 8;
  assert.ok(t.c >= 60, JSON.stringify(t));
  assert.ok(t.a >= 104 && t.b >= 104, JSON.stringify(t));
});

test('niukoilla tunneilla osa-aikaisten minimit täyttyvät ennen kuukausipalkkaisia', () => {
  // Vain aamuvuorot: 21 × 8 h = 168 h. Kolme osa-aikaista (minimit 40 + 48 + 24 = 112 h)
  // ja kaksi kuukausipalkkaista. Minimien on täytyttävä vaikka kuukausipalkkaisilla on vajetta.
  const k = kohde([1, 1, 1, 1, 1, 1, 1], ['a', 'b', 'p1', 'p2', 'p3']);
  k.vuorotyypit[1].suunnittelu.maarat = [0, 0, 0, 0, 0, 0, 0];
  const pt = (u, min) => henkilo(u, { workTimeType: 'parttime', minHoursPer3Weeks: String(min) });
  const r = laske({ kohteet: [k], henkilot: [henkilo('a'), henkilo('b'), pt('p1', 40), pt('p2', 48), pt('p3', 24)] });
  const t = {};
  for (const e of r.ehdotus) t[e.username] = (t[e.username] || 0) + 8;
  assert.ok(t.p1 >= 40 && t.p2 >= 48 && t.p3 >= 24, JSON.stringify(t));
});
