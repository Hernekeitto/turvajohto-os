// Määräpäivien laskennan testit (pankki.ts).
//
// Kenttä on turvallisuusasia: vanhentunut kaasusumutin ei toimi silloin kun sitä
// tarvitaan. Siksi virhe joka pitää mennyttä päivää voimassa olevana on pahempi kuin
// näkyvä virhe, ja rajatapaukset — tänään, eilen, huomenna — testataan erikseen.

import test from 'node:test';
import assert from 'node:assert/strict';

import { maaraaikatila, paiviaJaljella, paivays, MUISTUTUS_PAIVAA } from './pankki.ts';

// Päivä siirtymänä tästä päivästä, paikallisena ISO-päivänä. Kiinteä päivämäärä
// vanhentuisi testinä itsekin: ensi vuonna "2027-05-01" olisi mennyt.
const paivanPaasta = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const kk = String(d.getMonth() + 1).padStart(2, '0');
  const pv = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${kk}-${pv}`;
};

test('tanaan ei ole myohassa', () => {
  // Tarkastuspäivä on määräaika eikä hetki: sinä päivänä ollaan ajassa.
  assert.equal(paiviaJaljella(paivanPaasta(0)), 0);
  assert.equal(maaraaikatila(paivanPaasta(0)), 'lahestyy');
});

test('eilinen on mennyt ja huominen ei', () => {
  assert.equal(paiviaJaljella(paivanPaasta(-1)), -1);
  assert.equal(maaraaikatila(paivanPaasta(-1)), 'mennyt');
  assert.equal(maaraaikatila(paivanPaasta(1)), 'lahestyy');
});

test('muistutusrajan molemmat puolet', () => {
  assert.equal(maaraaikatila(paivanPaasta(MUISTUTUS_PAIVAA)), 'lahestyy');
  assert.equal(maaraaikatila(paivanPaasta(MUISTUTUS_PAIVAA + 1)), 'voimassa');
});

test('tyhja tai kelvoton arvo ei ole mitaan tilaa', () => {
  // null eikä 'voimassa': päivämäärä on valinnainen, eikä puuttuva päivä tarkoita
  // että väline olisi tarkastettu.
  for (const arvo of ['', null, undefined, '1.5.2027', 'ensi keväänä', '2027-13-01']) {
    assert.equal(maaraaikatila(arvo), null, `"${arvo}" tuotti tilan`);
    assert.equal(paiviaJaljella(arvo), null);
  }
});

test('paivays muotoilee vain ISO-paivan', () => {
  assert.equal(paivays('2027-05-01'), '1.5.2027');
  assert.equal(paivays('1.5.2027'), '');
  assert.equal(paivays(''), '');
});
