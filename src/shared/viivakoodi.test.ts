// Code-128-koodaimen testit.
//
// Viivakoodia ei voi todentaa silmällä: väärä tarkistussumma tai yksi liian kapea viiva
// näyttää täsmälleen oikealta ja epäonnistuu vasta siinä hetkessä kun vartija seisoo
// pimeässä ovella eikä koodi lue. Siksi säännöt tarkistetaan tässä.
//
// Ajetaan: node --test src/shared/viivakoodi.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  code128Leveydet, kelpaaViivakoodiksi, viivakoodiKuvio, viivakoodiMitat, viivakoodiSvg,
  HILJAINEN_ALUE,
} from './viivakoodi.ts';

// Yhden merkin koodi lasketaan käsin standardin mukaan, jotta testi ei vain toista
// toteutusta: 'A' on sarjassa B arvo 33 (65 - 32), tarkiste (104 + 1 * 33) % 103 = 34.
// Symbolit ovat siis aloitus(104) 33 34 lopetus(106), ja niiden kuviot taulukosta.
test('yhden merkin koodi vastaa standardin symboleja', () => {
  const leveydet = code128Leveydet('A');
  assert.deepEqual(
    leveydet,
    [
      2, 1, 1, 2, 1, 4, // aloitus B
      1, 1, 1, 3, 2, 3, // 'A' = 33
      1, 3, 1, 1, 2, 3, // tarkiste 34
      2, 3, 3, 1, 1, 1, 2, // lopetus
    ]
  );
});

// Moduulien kokonaismäärä on aina 11 per symboli plus 13 lopetusmerkille. Jos se ei
// täsmää, jokin kuviotaulukon rivi on väärän mittainen — ja se virhe olisi muuten
// näkymätön kunnes juuri se merkki osuu koodiin.
test('koodin leveys on 11 moduulia per symboli ja 13 lopetukselle', () => {
  for (const teksti of ['A', 'TJ7K2M9', 'Turvajohto 123', '~!@#$%^&*()']) {
    const leveydet = code128Leveydet(teksti);
    assert.ok(leveydet, `koodattava: ${teksti}`);
    const summa = leveydet.reduce((a, b) => a + b, 0);
    // aloitus + merkit + tarkiste = teksti.length + 2 symbolia à 11 moduulia.
    assert.equal(summa, (teksti.length + 2) * 11 + 13, `leveys: ${teksti}`);
  }
});

test('sama teksti koodautuu aina samoin', () => {
  assert.deepEqual(code128Leveydet('TJ7K2M9QRS'), code128Leveydet('TJ7K2M9QRS'));
});

test('eri teksti tuottaa eri koodin', () => {
  assert.notDeepEqual(code128Leveydet('TJ0001'), code128Leveydet('TJ0002'));
});

// Merkkialueen ulkopuolinen merkki EI saa pudota hiljaa pois: silloin tarraan
// tulostuisi eri koodi kuin mitä kentällä luetaan, ja piste jäisi ikuisesti
// kuittaamatta ilman että kukaan ymmärtäisi miksi.
test('ääkköset ja ohjausmerkit hylätään eikä pudoteta', () => {
  assert.equal(kelpaaViivakoodiksi('KÄYTÄVÄ'), false);
  assert.equal(code128Leveydet('KÄYTÄVÄ'), null);
  assert.equal(code128Leveydet('A\nB'), null);
  assert.equal(code128Leveydet(''), null);
  assert.equal(code128Leveydet('A'.repeat(49)), null);
});

test('kuvio alkaa hiljaisella alueella ja viivat eivät mene päällekkäin', () => {
  const kuvio = viivakoodiKuvio('TJ7K2M9');
  assert.ok(kuvio);
  assert.equal(kuvio.viivat[0].x, HILJAINEN_ALUE);
  for (let i = 1; i < kuvio.viivat.length; i += 1) {
    const edellinen = kuvio.viivat[i - 1];
    assert.ok(
      kuvio.viivat[i].x >= edellinen.x + edellinen.leveys,
      `viiva ${i} alkaa ennen edellisen loppua`
    );
  }
  // Hiljainen alue myös lopussa.
  const viimeinen = kuvio.viivat[kuvio.viivat.length - 1];
  assert.equal(kuvio.leveysModuuleina, viimeinen.x + viimeinen.leveys + HILJAINEN_ALUE);
});

test('SVG sisältää yhden suorakulmion viivaa kohti ja luettavan tekstin', () => {
  const kuvio = viivakoodiKuvio('TJ7K2M9');
  const svg = viivakoodiSvg('TJ7K2M9');
  assert.ok(kuvio);
  // Taustan suorakulmio on mukana, joten viivoja on yksi vähemmän kuin rect-elementtejä.
  assert.equal(svg.match(/<rect/g)?.length, kuvio.viivat.length + 1);
  assert.ok(svg.includes('>TJ7K2M9</text>'));
});

test('kelpaamaton teksti antaa tyhjän SVG:n eikä kaada tulostetta', () => {
  assert.equal(viivakoodiSvg('KÄYTÄVÄ'), '');
});

// Riippumaton käsin laskettu vertailu. Edellinen testi tarkisti yhden merkin; tämä
// tarkistaa että painotettu tarkistussumma lasketaan oikein pidemmällä koodilla:
// '1'..'6' ovat arvot 17..22, summa = 104 + 1*17 + 2*18 + 3*19 + 4*20 + 5*21 + 6*22 = 531,
// ja 531 % 103 = 16. Symbolin 16 kuvio on standardissa '123122'.
test('tarkistussumma lasketaan painotettuna — käsin laskettu vertailu', () => {
  const leveydet = code128Leveydet('123456');
  assert.ok(leveydet);
  // Tarkiste on toiseksi viimeinen symboli: kuusi lukua ennen seitsemän luvun lopetusta.
  const tarkiste = leveydet.slice(-13, -7);
  assert.deepEqual(tarkiste, [1, 2, 3, 1, 2, 2]);
});

// Pystyasento (tikapuu). Kapeassa tarrassa koodin pituus mahtuu vain korkeussuuntaan,
// joten koodi käännetään. Käännös ei saa muuttaa koodin geometriaa — sama kuvio, eri
// asento — eikä näkymän mittojen mennä ristiin, koska silloin koodi rajautuisi kesken.
test('pystyasento kääntää näkymän mitat eikä koske kuvioon', () => {
  const kuvio = viivakoodiKuvio('TJ7K2M9');
  assert.ok(kuvio);
  const vaaka = viivakoodiMitat(kuvio, { moduuli: 2, korkeus: 70 });
  const pysty = viivakoodiMitat(kuvio, { moduuli: 2, korkeus: 70, pysty: true });
  assert.equal(pysty.leveys, vaaka.korkeus);
  assert.equal(pysty.korkeus, vaaka.leveys);
  assert.equal(pysty.sisaltoLeveys, vaaka.sisaltoLeveys);
  assert.equal(pysty.viivanKorkeus, vaaka.viivanKorkeus);
  assert.equal(vaaka.muunnos, null);
  assert.match(String(pysty.muunnos), /rotate\(90\)/);
  // Pystyssä teksti on sisällössä viivojen YLÄPUOLELLA, jotta se kääntyy niiden
  // oikealle puolelle. Vaakana se on viivojen alla.
  assert.ok(pysty.tekstiY < pysty.viivatY);
  assert.ok(vaaka.tekstiY > vaaka.viivatY);
});

test('pystykoodin SVG kääntää sisällön ryhmänä', () => {
  const svg = viivakoodiSvg('TJ7K2M9', { pysty: true, korkeus: 70 });
  assert.match(svg, /<g transform="translate\(84,0\) rotate\(90\)">/);
  assert.ok(svg.includes('>TJ7K2M9</text>'));
});
