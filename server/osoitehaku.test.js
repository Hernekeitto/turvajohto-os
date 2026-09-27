import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siivoaHaku, tulkitseVastaus, haeOsoite, TULOKSIA_MAX, HAUN_MAX_PITUUS } from './osoitehaku.js';

test('siivoaHaku hylkää tyhjän, lyhyen ja liian pitkän', () => {
  assert.equal(siivoaHaku(''), null);
  assert.equal(siivoaHaku('  ab '), null);
  assert.equal(siivoaHaku(undefined), null);
  assert.equal(siivoaHaku('a'.repeat(HAUN_MAX_PITUUS + 1)), null);
  assert.equal(siivoaHaku('  Hämeenkatu   1,\n Tampere '), 'Hämeenkatu 1, Tampere');
});

test('tulkitseVastaus ohittaa rivit joilla ei ole luettavaa sijaintia', () => {
  const tulos = tulkitseVastaus([
    { display_name: 'Hämeenkatu 1, Tampere', lat: '61.4978', lon: '23.7610' },
    { display_name: 'rikki', lat: 'x', lon: '23' },
    { display_name: 'yli rajan', lat: '95', lon: '23' },
    { display_name: 'ilman lon', lat: '61' },
  ]);
  assert.deepEqual(tulos, [{ nimi: 'Hämeenkatu 1, Tampere', lat: 61.4978, lon: 23.761 }]);
});

test('tulkitseVastaus rajaa tulosmäärän ja kestää muun kuin listan', () => {
  const rivit = Array.from({ length: 10 }, (_, i) => ({ display_name: `r${i}`, lat: '61', lon: '23' }));
  assert.equal(tulkitseVastaus(rivit).length, TULOKSIA_MAX);
  assert.deepEqual(tulkitseVastaus({ error: 'x' }), []);
  assert.deepEqual(tulkitseVastaus(null), []);
});

test('haeOsoite rajaa Suomeen ja lähettää tunnistettavan User-Agentin', async () => {
  let pyynto;
  const fetchImpl = async (url, asetukset) => {
    pyynto = { url: new URL(url), asetukset };
    return { ok: true, json: async () => [{ display_name: 'A', lat: '60.1', lon: '24.9' }] };
  };
  const tulos = await haeOsoite('Mannerheimintie 1', { fetchImpl });
  assert.equal(pyynto.url.searchParams.get('countrycodes'), 'fi');
  assert.equal(pyynto.url.searchParams.get('q'), 'Mannerheimintie 1');
  assert.match(pyynto.asetukset.headers['User-Agent'], /Turvajohto-OS/);
  assert.deepEqual(tulos, [{ nimi: 'A', lat: 60.1, lon: 24.9 }]);
});

test('haeOsoite heittää virheen kun palvelu ei vastaa ok', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, json: async () => [] });
  await assert.rejects(haeOsoite('Testikatu 1', { fetchImpl }), /503/);
});
