// Liitetiedostojen poiston ja roskienkeruun testit. Käyttää omaa väliaikaista
// DATA_DIRiä — ei koskaan oikeita liitteitä.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-uploads-'));
process.env.DATA_DIR = DATA_DIR;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const { saveUpload, getUploadPath, deleteUpload, listUploads, collectGarbage } =
  await import(new URL('./uploads.js', import.meta.url).href);

after(() => fs.rmSync(DATA_DIR, { recursive: true, force: true }));

const vanhenna = (id, tuntia) => {
  const p = path.join(UPLOAD_DIR, id);
  const aika = new Date(Date.now() - tuntia * 60 * 60 * 1000);
  fs.utimesSync(p, aika, aika);
};

test('deleteUpload poistaa tiedoston ja palauttaa true', () => {
  const id = saveUpload('kuva.jpg', Buffer.from('testi'));
  assert.ok(getUploadPath(id), 'tiedostoa ei luotu');
  assert.equal(deleteUpload(id), true);
  assert.equal(getUploadPath(id), null, 'tiedosto jäi levylle');
});

test('deleteUpload palauttaa false eikä kaadu jos tiedostoa ei ole', () => {
  assert.equal(deleteUpload('ei-ole-olemassa.jpg'), false);
});

// path.basename-suojaus on sama kuin getUploadPathissa: poisto ei saa päästä
// hakemiston ulkopuolelle vaikka id olisi keksitty.
test('deleteUpload ei pääse hakemiston ulkopuolelle', () => {
  const ulkopuolinen = path.join(DATA_DIR, 'alkuperainen.txt');
  fs.writeFileSync(ulkopuolinen, 'ei saa poistua');
  assert.equal(deleteUpload('../alkuperainen.txt'), false);
  assert.ok(fs.existsSync(ulkopuolinen), 'hakemiston ulkopuolinen tiedosto poistettiin');
});

test('collectGarbage poistaa viittaamattoman tiedoston armonajan jälkeen', () => {
  const orpo = saveUpload('orpo.jpg', Buffer.from('a'));
  vanhenna(orpo, 48);
  const poistetut = collectGarbage([]);
  assert.deepEqual(poistetut, [orpo]);
  assert.equal(getUploadPath(orpo), null);
});

test('collectGarbage säästää viitatun tiedoston vaikka se olisi vanha', () => {
  const viitattu = saveUpload('viitattu.jpg', Buffer.from('b'));
  vanhenna(viitattu, 48);
  assert.deepEqual(collectGarbage([viitattu]), []);
  assert.ok(getUploadPath(viitattu), 'viitattu tiedosto poistettiin');
  deleteUpload(viitattu);
});

// Liite ladataan palvelimelle ENNEN kuin sen raportti tallennetaan. Ilman
// armonaikaa toisen käyttäjän samanaikainen raporttitallennus poistaisi sen.
test('collectGarbage säästää juuri ladatun tiedoston (kilpailutilanne)', () => {
  const tuore = saveUpload('tuore.jpg', Buffer.from('c'));
  assert.deepEqual(collectGarbage([]), [], 'tuore tiedosto poistettiin');
  assert.ok(getUploadPath(tuore));
  deleteUpload(tuore);
});

test('collectGarbage armonaika on säädettävissä', () => {
  const id = saveUpload('saadettava.jpg', Buffer.from('d'));
  vanhenna(id, 2);
  assert.deepEqual(collectGarbage([], { graceMs: 24 * 60 * 60 * 1000 }), [], '2h vanha poistettiin 24h armonajalla');
  assert.deepEqual(collectGarbage([], { graceMs: 60 * 60 * 1000 }), [id], '2h vanha ei poistunut 1h armonajalla');
});

test('listUploads listaa vain tiedostot', () => {
  const a = saveUpload('a.jpg', Buffer.from('x'));
  const b = saveUpload('b.png', Buffer.from('y'));
  fs.mkdirSync(path.join(UPLOAD_DIR, 'alihakemisto'), { recursive: true });
  const lista = listUploads().sort();
  assert.deepEqual(lista, [a, b].sort());
  deleteUpload(a);
  deleteUpload(b);
});

// --- Avaintyypin tunnistuskuvan lukuoikeus -------------------------------------------
//
// Kartan kuvat kulkevat samaa liitepolkua kuin raporttien valokuvat, ja polku on
// oletuksena kiinni: liite avautuu vain jos jokin tietue viittaa siihen ja käyttäjällä
// on oikeus SIIHEN tietueeseen. Avaintyyppi on uusi viittaaja, ja väärin kirjoitettuna
// se avaisi joko liikaa (koko liitehakemiston) tai liian vähän (kartta olisi rikki
// kaikille paitsi pääkäyttäjälle — juuri niille joille se on tarkoitettu).

import { canReadGuardAttachment } from './permissions.js';

const KARTTA = [{ id: 't1', nimi: 'Abloy Exec', uploadId: 'kuva.webp' }];
const vartijanOikeudet = { __default__: { guard_site_assets: { view: true, edit: false } } };

test('vartija saa avaintyypin kuvan ilman kohdeoikeutta', () => {
  // Kuva on valmistajan tuotekuva eikä kenenkään kohteen tietoa, joten sitä ei rajata
  // eventAccessilla. Vartija on se joka pitää tuntematonta avainta kädessään.
  assert.equal(
    canReadGuardAttachment('user', vartijanOikeudet, [], 'kuva.webp', [], [], [], KARTTA),
    true
  );
});

test('ilman kalusto-oikeutta avaintyypin kuva ei aukea', () => {
  assert.equal(
    canReadGuardAttachment('user', { __default__: {} }, [], 'kuva.webp', [], [], [], KARTTA),
    false
  );
});

test('kartan ulkopuolinen liite ei aukea kalusto-oikeudella', () => {
  // Tämä on se virhe joka avaisi koko liitehakemiston: jos haara palauttaisi tosen
  // tarkistamatta viittausta, kalusto-oikeus riittäisi minkä tahansa raportin kuvaan.
  assert.equal(
    canReadGuardAttachment('user', vartijanOikeudet, [], 'joku-muu.jpg', [], [], [], KARTTA),
    false
  );
});
