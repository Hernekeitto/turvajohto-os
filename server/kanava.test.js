// Kanavan testit (kanava.js). Nämä ajetaan oikealla HTTP-palvelimella ja oikealla
// WebSocket-asiakkaalla, koska juuri kättely ja tapahtumarajaus ovat se osa jonka
// rikkoutuminen ei näkyisi mitenkään — kanava vain lakkaisi kertomasta muutoksista,
// tai kertoisi niistä väärälle.
//
// Ajetaan: npm test  (tai node --test server/)

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';

import { liitaKanava, laheta, avoimiaYhteyksia } from './kanava.js';

// Yksi palvelin koko tiedostolle: liitaKanava rekisteröi upgrade-käsittelijän, eikä
// samaan palvelimeen ole tarpeen liittää kahta.
const palvelin = http.createServer((_req, res) => res.end('ok'));

// Tunnistus luetaan otsakkeesta, jotta testi voi esittää eri käyttäjiä ilman JWT:tä.
// Oikeassa käytössä tämä on index.js:n tunnistaKanava (eväste + JWT + käyttäjätaso).
liitaKanava(palvelin, {
  tunnista: (req) => {
    const kayttaja = req.headers['x-testi-kayttaja'];
    if (!kayttaja) return null;
    const [username, role, ...tapahtumat] = String(kayttaja).split(':');
    return { username, role, eventAccess: tapahtumat.filter(Boolean) };
  },
});

const portti = await new Promise((resolve) => {
  palvelin.listen(0, '127.0.0.1', () => resolve(palvelin.address().port));
});

test.after(() => palvelin.close());

// Odotetaan TERVETULOVIESTIÄ eikä 'open'-tapahtumaa. Kättely valmistuu asiakkaalla
// ennen kuin palvelin on ajanut handleUpgraden takaisinkutsun, jossa istunto lisätään
// joukkoon — 'open' voi siis tulla ennen kuin palvelin tuntee yhteyden. Tervetuloviesti
// lähetetään vasta rekisteröinnin jälkeen, joten se on oikea merkki valmiudesta.
const avaa = (kayttaja) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${portti}/api/kanava`, {
      headers: kayttaja ? { 'x-testi-kayttaja': kayttaja } : {},
    });
    ws.on('error', reject);
    ws.on('message', function ensimmainen(data) {
      const viesti = JSON.parse(data.toString());
      if (viesti.tyyppi !== 'tervetuloa') return;
      ws.off('message', ensimmainen);
      resolve(ws);
    });
  });

// Odottaa yhtä 'muutos'-viestiä. Tervetuloviesti ohitetaan, koska se tulee aina ensin.
const odotaMuutos = (ws, aikakatkaisuMs = 500) =>
  new Promise((resolve) => {
    const ajastin = setTimeout(() => resolve(null), aikakatkaisuMs);
    ws.on('message', (data) => {
      const viesti = JSON.parse(data.toString());
      if (viesti.tyyppi !== 'muutos') return;
      clearTimeout(ajastin);
      resolve(viesti);
    });
  });

test('tunnistamaton yhteys torjutaan ennen kättelyä', async () => {
  await assert.rejects(() => avaa(null), /401|Unexpected server response/);
});

test('polku joka ei ole kanava suljetaan', async () => {
  await assert.rejects(
    () =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${portti}/jokin-muu`, {
          headers: { 'x-testi-kayttaja': 'tike:user' },
        });
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
      })
  );
});

test('muutos välitetään avoimeen istuntoon ilman tietueen sisältöä', async () => {
  const ws = await avaa('tike:user');
  const odotus = odotaMuutos(ws);
  laheta('reports', [{ action: 'create', id: '26/FesX/1108/101', eventId: 'fesx', summary: 'EI SAA VUOTAA' }]);
  const viesti = await odotus;

  assert.equal(viesti.kokoelma, 'reports');
  assert.deepEqual(viesti.muutokset, [{ action: 'create', id: '26/FesX/1108/101', eventId: 'fesx' }]);
  // Sisältökenttä ei saa kulkea kanavassa: oikeustarkistus tehdään vain GET-reitillä.
  assert.equal(JSON.stringify(viesti).includes('EI SAA VUOTAA'), false);
  ws.close();
});

test('lähettäjä itse ei saa omaa muutostaan takaisin', async () => {
  const ws = await avaa('tike:user');
  const odotus = odotaMuutos(ws, 200);
  laheta('reports', [{ action: 'update', id: 'x', eventId: 'fesx' }], { lahettaja: 'tike' });
  assert.equal(await odotus, null);
  ws.close();
});

test('tapahtumarajaus: toisen tapahtuman muutosta ei kerrota', async () => {
  const rajattu = await avaa('vartija:user:festb');
  const odotus = odotaMuutos(rajattu, 200);
  laheta('reports', [{ action: 'create', id: 'y', eventId: 'fesx' }], {
    saaNahda: (istunto, eventId) =>
      istunto.role === 'admin' ||
      istunto.eventAccess.length === 0 ||
      istunto.eventAccess.includes(eventId),
  });
  assert.equal(await odotus, null, 'rajatun käyttäjän ei pidä saada toisen tapahtuman muutosta');
  rajattu.close();
});

test('admin saa muutoksen tapahtumarajauksesta riippumatta', async () => {
  const admin = await avaa('paakayttaja:admin:festb');
  const odotus = odotaMuutos(admin);
  laheta('reports', [{ action: 'create', id: 'z', eventId: 'fesx' }], {
    saaNahda: (istunto, eventId) =>
      istunto.role === 'admin' ||
      istunto.eventAccess.length === 0 ||
      istunto.eventAccess.includes(eventId),
  });
  const viesti = await odotus;
  assert.equal(viesti?.muutokset[0].id, 'z');
  admin.close();
});

test('tyhjä muutoslista ei tuota viestiä', async () => {
  const ws = await avaa('tike:user');
  const odotus = odotaMuutos(ws, 200);
  laheta('reports', []);
  assert.equal(await odotus, null);
  ws.close();
});

test('suljettu yhteys poistuu joukosta', async () => {
  // Aiempien testien sokettien sulkeutuminen näkyy palvelimella vasta hetken viiveellä,
  // joten lähtöluku otetaan vasta kun ne ovat ehtineet poistua. Ilman tätä testi vertaisi
  // väärään lähtötilanteeseen ja hylkäisi satunnaisesti.
  await new Promise((resolve) => setTimeout(resolve, 150));
  const maara = avoimiaYhteyksia();
  const ws = await avaa('tike:user');
  assert.equal(avoimiaYhteyksia(), maara + 1);
  await new Promise((resolve) => {
    ws.on('close', resolve);
    ws.close();
  });
  // Palvelinpuolen close-tapahtuma tulee hetken viiveellä asiakkaan sulkemisen jälkeen.
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(avoimiaYhteyksia(), maara);
});
