// Salattujen liitteiden levytallennuksen testit. Käyttää omaa väliaikaista DATA_DIRiä
// — ei koskaan oikeita liitteitä. Sama malli kuin server/uploads.test.js:ssä.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-salatutliitteet-'));
process.env.DATA_DIR = DATA_DIR;

const { tallennaSalattuLiite, haeSalatunLiitteenPolku, poistaSalattuLiite } =
  await import(new URL('./salatutliitteet.js', import.meta.url).href);

after(() => fs.rmSync(DATA_DIR, { recursive: true, force: true }));

test('tallennaSalattuLiite tallentaa opaakin tavujonon sellaisenaan', () => {
  const sisalto = Buffer.from([1, 2, 3, 255, 0, 128]);
  const id = tallennaSalattuLiite(sisalto);
  const polku = haeSalatunLiitteenPolku(id);
  assert.ok(polku, 'liitettä ei tallennettu');
  assert.deepEqual(fs.readFileSync(polku), sisalto);
});

test('haeSalatunLiitteenPolku palauttaa nullin tuntemattomalle id:lle', () => {
  assert.equal(haeSalatunLiitteenPolku('ei-ole-olemassa'), null);
});

test('haeSalatunLiitteenPolku ei pääse hakemiston ulkopuolelle', () => {
  const ulkopuolinen = path.join(DATA_DIR, 'salaisuus.txt');
  fs.writeFileSync(ulkopuolinen, 'ei saa paljastua');
  assert.equal(haeSalatunLiitteenPolku('../salaisuus.txt'), null);
});

test('poistaSalattuLiite poistaa tiedoston ja palauttaa true', () => {
  const id = tallennaSalattuLiite(Buffer.from('x'));
  assert.equal(poistaSalattuLiite(id), true);
  assert.equal(haeSalatunLiitteenPolku(id), null);
});

test('poistaSalattuLiite palauttaa false eikä kaadu jos tiedostoa ei ole', () => {
  assert.equal(poistaSalattuLiite('ei-ole-olemassa'), false);
});

test('poistaSalattuLiite ei pääse hakemiston ulkopuolelle', () => {
  const ulkopuolinen = path.join(DATA_DIR, 'alkuperainen2.txt');
  fs.writeFileSync(ulkopuolinen, 'ei saa poistua');
  assert.equal(poistaSalattuLiite('../alkuperainen2.txt'), false);
  assert.ok(fs.existsSync(ulkopuolinen), 'hakemiston ulkopuolinen tiedosto poistettiin');
});
