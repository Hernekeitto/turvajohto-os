import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  onEditoitava,
  onEsikatseltava,
  wopiAvain,
  luoWopiToken,
  tarkistaWopiToken,
  etsiTiedosto,
  saaKirjoittaa,
  checkFileInfo,
  jasennaDiscovery,
  editorinOsoite,
  TOKEN_KESTO_MS,
} from './editori.js';

const SALAISUUS = 'x'.repeat(64);
const AVAIN = wopiAvain(SALAISUUS);

test('editoitavat päätteet: odt ja odp, kirjainkoosta riippumatta', () => {
  assert.equal(onEditoitava('Ohje.odt'), true);
  assert.equal(onEditoitava('ESITYS.ODP'), true);
  assert.equal(onEditoitava('raportti.docx'), false);
  assert.equal(onEditoitava('odt'), false);
  assert.equal(onEditoitava(null), false);
});

test('esikatseltavat: editoitavat sekä Word ja Excel, ei PDF:ää eikä kuvia', () => {
  assert.equal(onEsikatseltava('Ohje.odt'), true);
  assert.equal(onEsikatseltava('Sopimus.DOCX'), true);
  assert.equal(onEsikatseltava('vanha.doc'), true);
  assert.equal(onEsikatseltava('taulukko.xlsx'), true);
  assert.equal(onEsikatseltava('ohje.pdf'), false);
  assert.equal(onEsikatseltava('kuva.jpg'), false);
});

test('token kelpaa vain samalle tiedostolle', () => {
  const { token } = luoWopiToken({ username: 'matti', uploadId: 'a.odt' }, AVAIN);
  assert.deepEqual(tarkistaWopiToken(token, 'a.odt', AVAIN), { username: 'matti', muokkaus: true });
  assert.equal(tarkistaWopiToken(token, 'b.odt', AVAIN), null);
});

test('esikatseluna avattu token ei ole muokkaustoken', () => {
  const { token } = luoWopiToken({ username: 'matti', uploadId: 'a.docx', muokkaus: false }, AVAIN);
  assert.deepEqual(tarkistaWopiToken(token, 'a.docx', AVAIN), { username: 'matti', muokkaus: false });
});

test('token ei kelpaa toisella avaimella eikä vanhentuneena', () => {
  const { token } = luoWopiToken({ username: 'matti', uploadId: 'a.odt' }, AVAIN);
  assert.equal(tarkistaWopiToken(token, 'a.odt', wopiAvain('y'.repeat(64))), null);
  const vanha = luoWopiToken({ username: 'matti', uploadId: 'a.odt' }, AVAIN, Date.now() - TOKEN_KESTO_MS - 1000);
  assert.equal(tarkistaWopiToken(vanha.token, 'a.odt', AVAIN), null);
});

test('WOPI-token ei kelpaa istuntotokeniksi (eri avain kuin JWT_SECRET)', () => {
  const { token } = luoWopiToken({ username: 'matti', uploadId: 'a.odt' }, AVAIN);
  assert.throws(() => jwt.verify(token, SALAISUUS));
});

test('istuntotoken ei kelpaa WOPI-tokeniksi', () => {
  const istunto = jwt.sign({ sub: 'matti', tiedosto: 'a.odt' }, SALAISUUS);
  assert.equal(tarkistaWopiToken(istunto, 'a.odt', AVAIN), null);
  // Edes WOPI-avaimella ilman aud-kenttää ei kelpaa.
  const ilmanAud = jwt.sign({ sub: 'matti', tiedosto: 'a.odt' }, AVAIN);
  assert.equal(tarkistaWopiToken(ilmanAud, 'a.odt', AVAIN), null);
});

test('ttl on epoch-millisekunteina', () => {
  const nyt = Date.now();
  const { ttl } = luoWopiToken({ username: 'm', uploadId: 'a.odt' }, AVAIN, nyt);
  assert.equal(ttl, nyt + TOKEN_KESTO_MS);
});

const EVENT_FILES = [
  { id: 'k1', type: 'folder', name: 'Kansio', uploadId: 'x.odt' },
  { id: 'f1', type: 'file', name: 'Ohje.odt', uploadId: 'e.odt', eventId: 'ev1' },
];
const GUARD_FILES = [{ id: 'g1', siteId: 'kohde1', name: 'Esitys.odp', uploadId: 'g.odp' }];

test('tiedosto löytyy kummastakin kokoelmasta, kansio ei kelpaa', () => {
  assert.deepEqual(etsiTiedosto('e.odt', EVENT_FILES, GUARD_FILES)?.lahde, 'eventFiles');
  assert.equal(etsiTiedosto('e.odt', EVENT_FILES, GUARD_FILES)?.kohdeId, 'ev1');
  assert.equal(etsiTiedosto('g.odp', EVENT_FILES, GUARD_FILES)?.lahde, 'guardFiles');
  assert.equal(etsiTiedosto('g.odp', EVENT_FILES, GUARD_FILES)?.kohdeId, 'kohde1');
  assert.equal(etsiTiedosto('x.odt', EVENT_FILES, GUARD_FILES), null);
  assert.equal(etsiTiedosto('muu.odt', EVENT_FILES, GUARD_FILES), null);
});

const oikeudet = (bucket, solmu, edit) => ({ [bucket]: { [solmu]: { view: true, edit } } });

test('kirjoitusoikeus tapahtuman tiedostoon: eventfiles-muokkaus ja tapahtumarajaus', () => {
  const loyto = etsiTiedosto('e.odt', EVENT_FILES, GUARD_FILES);
  assert.equal(saaKirjoittaa({ role: 'admin' }, loyto), true);
  assert.equal(saaKirjoittaa({ role: 'user', permissions: oikeudet('ev1', 'eventfiles', true) }, loyto), true);
  assert.equal(saaKirjoittaa({ role: 'user', permissions: oikeudet('ev1', 'eventfiles', false) }, loyto), false);
  assert.equal(saaKirjoittaa({
    role: 'user', permissions: oikeudet('ev1', 'eventfiles', true), eventAccess: ['ev2'],
  }, loyto), false);
});

test('kirjoitusoikeus kohteen tiedostoon vaatii GUARD-tuotteen ja guard_sites-muokkauksen', () => {
  const loyto = etsiTiedosto('g.odp', EVENT_FILES, GUARD_FILES);
  // guard_sites on globaali solmu (permissions.js: GLOBAL_NODES) — oikeus luetaan __default__:sta.
  const perms = oikeudet('__default__', 'guard_sites', true);
  assert.equal(saaKirjoittaa({ role: 'user', permissions: perms, tuotteet: ['guard'] }, loyto), true);
  assert.equal(saaKirjoittaa({ role: 'user', permissions: perms, tuotteet: ['event'] }, loyto), false);
  assert.equal(saaKirjoittaa({
    role: 'user', permissions: oikeudet('__default__', 'guard_sites', false), tuotteet: ['guard'],
  }, loyto), false);
});

test('CheckFileInfo: vain luku -tila ja käyttäjätunnus ei näy sellaisenaan', () => {
  const loyto = etsiTiedosto('e.odt', EVENT_FILES, GUARD_FILES);
  const stat = { size: 1234, mtimeMs: Date.parse('2026-09-28T10:00:00Z') };
  const info = checkFileInfo({
    loyto, stat, kayttaja: { username: 'matti' }, nimimerkki: 'Matti M', kirjoitus: false, avain: AVAIN,
    origin: 'https://turvajohto-os.fi',
  });
  assert.equal(info.BaseFileName, 'Ohje.odt');
  assert.equal(info.Size, 1234);
  assert.equal(info.UserCanWrite, false);
  assert.equal(info.UserCanNotWriteRelative, true);
  assert.equal(info.UserFriendlyName, 'Matti M');
  assert.notEqual(info.UserId, 'matti');
  assert.equal(info.LastModifiedTime, '2026-09-28T10:00:00.000Z');
});

const DISCOVERY = `<?xml version="1.0"?>
<wopi-discovery><net-zone name="external-http">
<app name="writer">
<action default="true" ext="odt" name="edit" urlsrc="https://turvajohto-os.fi/browser/abc123/cool.html?"/>
<action ext="odp" name="view" urlsrc="https://turvajohto-os.fi/browser/abc123/cool.html?view=1&amp;"/>
<action ext="odp" name="edit" urlsrc="https://turvajohto-os.fi/browser/abc123/cool.html?"/>
</app></net-zone></wopi-discovery>`;

test('discovery: urlsrc päätteittäin, edit voittaa view:n', () => {
  const d = jasennaDiscovery(DISCOVERY);
  assert.equal(d.odt.urlsrc, 'https://turvajohto-os.fi/browser/abc123/cool.html?');
  assert.equal(d.odp.urlsrc, 'https://turvajohto-os.fi/browser/abc123/cool.html?');
  assert.equal(d.docx, undefined);
});

test('editorin osoite: WOPISrc koodattuna, paikanpitäjät pois', () => {
  const url = editorinOsoite(
    'https://turvajohto-os.fi/browser/abc/cool.html?<ui=UI_LLCC&><rs=DC_LLCC&>',
    'https://turvajohto-os.fi/api/wopi/files/e.odt'
  );
  assert.equal(
    url,
    'https://turvajohto-os.fi/browser/abc/cool.html?WOPISrc=https%3A%2F%2Fturvajohto-os.fi%2Fapi%2Fwopi%2Ffiles%2Fe.odt&lang=fi&closebutton=1'
  );
});
