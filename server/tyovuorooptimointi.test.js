// Tarkan optimoinnin testit (11.10.2026).
//
// Samat ehdottomat rajat kuin ahneella generaattorilla, ja lisäksi se mitä ahne ei osaa:
// tasan 120 h järjestyksessä ja pitkien viikonloppujen kierto listalta toiselle.
//
// Ajetaan: node --test server/tyovuorooptimointi.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { laskeOptimi, optimoiTaustalla, rakennaMalli } from './tyovuorooptimointi.js';
import { tarkistaLista, tyhjaLista } from './tyovuorolistat.js';
import { listat, normalisoiAsetukset, suunnitellutVuorot } from './tyovuorolista.js';

const ASETUKSET = normalisoiAsetukset({ jaksotAlkaen: '2026-10-05' });
const [LISTA, LISTA2] = listat(ASETUKSET, '2026-10-05', 2);

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

function syote({ kohteet = [kohde()], henkilot = [henkilo('a'), henkilo('b'), henkilo('c')], lista = LISTA, tietue = tyhjaLista(lista), ...yli } = {}) {
  const vuorot = new Map(suunnitellutVuorot(kohteet, '2026-09-07', LISTA2.loppu).map((v) => [v.id, v]));
  const listanVuorot = new Map([...vuorot].filter(([, v]) => v.pvm >= lista.alku && v.pvm <= lista.viimeinen));
  return {
    tietue, lista, vuorot, listanVuorot, henkilot, kohteet, asetukset: ASETUKSET, muutSijoitukset: [],
    nytPaikallinen: '2026-09-30T12:00', ...yli,
  };
}

const laske = async (yli) => {
  const s = syote(yli);
  return { ...(await laskeOptimi(s, { aikarajaS: 20 })), syote: s };
};

function havainnot({ ehdotus, syote: s }) {
  const tulokset = tarkistaLista({
    lista: s.lista, sijoitukset: [...(s.muutSijoitukset || []), ...(s.tietue.sijoitukset || []), ...ehdotus], vuorot: s.vuorot,
    henkilot: s.henkilot, kohteet: s.kohteet, asetukset: ASETUKSET,
    poissaolot: s.poissaolot || [], toiveet: s.toiveet || [],
  });
  // Edellisten listojen vuorot mukaan, jotta pitkä viikonloppu lasketaan oikein.
  return Object.values(tulokset).flatMap((t) => t.havainnot);
}
const vakavat = (r) => havainnot(r).filter((h) => h.taso === 'este' || h.taso === 'poikkeama');

const tunnit = (r) => {
  const t = {};
  for (const e of r.ehdotus) t[e.username] = (t[e.username] || 0) + r.syote.vuorot.get(e.vuoroId).kestoMin / 60;
  return t;
};

test('malli: LP-teksti syntyy ja muuttujat vain perehdytetyille', () => {
  const m = rakennaMalli(syote({ kohteet: [kohde(undefined, ['a'])] }));
  assert.match(m.lp, /^Minimize/);
  assert.ok(m.x.length > 0 && m.x.every((r) => r.h.username === 'a'));
});

test('täyttää kaikki vuorot ilman esteitä ja poikkeamia', async () => {
  const r = await laske();
  assert.equal(r.ehdotus.length, 42);
  assert.equal(r.avoimiksi.length, 0);
  assert.deepEqual(vakavat(r), []);
  assert.equal(r.optimi.tila, 'optimi');
});

test('kuukausipalkkaiset tasan 120 h järjestyksessä', async () => {
  const r = await laske();
  const t = tunnit(r);
  assert.equal(t.a, 120, JSON.stringify(t));
  assert.equal(t.b, 120, JSON.stringify(t));
  assert.equal(t.c, 96, JSON.stringify(t));
});

test('annettu järjestys ohittaa aakkoset, osa-aikaisen minimi silti ensin', async () => {
  const r = await laske({
    prioriteetti: ['c', 'b', 'a'],
    henkilot: [henkilo('a'), henkilo('b'), henkilo('c'), henkilo('p', { workTimeType: 'parttime', minHoursPer3Weeks: '40' })],
    kohteet: [kohde(undefined, ['a', 'b', 'c', 'p'])],
  });
  const t = tunnit(r);
  assert.equal(t.c, 120, JSON.stringify(t));
  assert.equal(t.b, 120, JSON.stringify(t));
  assert.equal(t.p, 40, JSON.stringify(t));
  assert.equal(t.a, 56, JSON.stringify(t));
  assert.deepEqual(vakavat(r), []);
});

test('8 ja 9 tunnin vuoroista koottu jakso osuu tasan 120 tuntiin', async () => {
  const k = kohde();
  k.vuorotyypit[0].paattyy = '15:00';
  k.vuorotyypit[1].alkaa = '15:00';
  k.vuorotyypit[1].paattyy = '23:00';
  k.perehdytykset.push({ username: 'd', vuorotyyppiIdt: ['aamu', 'ilta'] });
  const r = await laske({ kohteet: [k], henkilot: [henkilo('a'), henkilo('b'), henkilo('c'), henkilo('d')] });
  const t = tunnit(r);
  assert.equal(r.avoimiksi.length, 0);
  assert.equal(t.a, 120, JSON.stringify(t));
  assert.equal(t.b, 120, JSON.stringify(t));
  assert.deepEqual(vakavat(r), []);
});

test('ei ylityötä: liian vähillä tekijöillä vuorot jäävät avoimiksi', async () => {
  const r = await laske({ kohteet: [kohde(undefined, ['a', 'b'])], henkilot: [henkilo('a'), henkilo('b')] });
  const t = tunnit(r);
  assert.ok(t.a <= 120 && t.b <= 120, JSON.stringify(t));
  assert.equal(r.ehdotus.length, 30);
  assert.ok(r.avoimiksi.every((a) => /Ei mahdu/.test(a.syy)));
});

test('poissaolo ja "toivon vapaata" kunnioitetaan', async () => {
  const r = await laske({
    poissaolot: [{ username: 'a', laji: 'vuosiloma', alku: '2026-10-05', loppu: '2026-10-09' }],
    toiveet: [{ username: 'b', pvm: '2026-10-14', laji: 'vapaa' }],
  });
  assert.ok(!r.ehdotus.some((e) => e.username === 'a' && e.vuoroId.split(':')[2] <= '2026-10-09'));
  assert.ok(!r.ehdotus.some((e) => e.username === 'b' && e.vuoroId.includes('2026-10-14')));
  assert.deepEqual(vakavat(r), []);
});

test('pitkä viikonloppu kiertää: edellisen listan viikonloput tehneet saavat vapaan', async () => {
  // Edellisellä listalla a teki jokaisen viikonlopun aamut ja b illat. Neljän viikon ikkuna
  // joka päättyy listan ensimmäiseen viikonloppuun (30.10.) vaatii siis heille vapaan juuri
  // silloin, ja c ja d tekevät sen.
  const k = kohde(undefined, ['a', 'b', 'c', 'd']);
  const henkilot = [henkilo('a'), henkilo('b'), henkilo('c'), henkilo('d')];
  const kaikki = suunnitellutVuorot([k], LISTA.alku, LISTA.loppu);
  const viikonloppu = (v) => [5, 6, 0].includes(new Date(`${v.pvm}T00:00:00Z`).getUTCDay());
  const muutSijoitukset = kaikki.filter(viikonloppu)
    .map((v) => ({ vuoroId: v.id, username: v.vuorotyyppiId === 'aamu' ? 'a' : 'b' }));
  const r = await laske({ kohteet: [k], henkilot, lista: LISTA2, muutSijoitukset });
  const pitkat = havainnot(r).filter((h) => h.koodi === 'pitka_viikonloppu');
  assert.deepEqual(pitkat, []);
  const pitkaViikonloppu = (e) => {
    const v = r.syote.vuorot.get(e.vuoroId);
    return v.alkaa < '2026-11-02T06:00' && v.paattyy > '2026-10-30T18:00';
  };
  assert.ok(!r.ehdotus.some((e) => (e.username === 'a' || e.username === 'b') && pitkaViikonloppu(e)));
  assert.equal(r.avoimiksi.length, 0);
  assert.deepEqual(vakavat(r), []);
});

test('deterministinen: sama syöte, sama ehdotus', async () => {
  const a = await laske();
  const b = await laske();
  assert.deepEqual(a.ehdotus, b.ehdotus);
});

test('taustasäie antaa saman tuloksen kuin suora ajo', async () => {
  const s = syote();
  const suora = await laskeOptimi(s, { aikarajaS: 20 });
  const tausta = await optimoiTaustalla(s, { aikarajaS: 20 });
  assert.equal(tausta.ok, true, tausta.virhe);
  assert.deepEqual(tausta.tulos.ehdotus, suora.ehdotus);
});
