// Lähtevän jonon testit.
//
// Jono on kohta jossa kirjaus voi kadota huomaamatta: jos se poistetaan väärässä
// tilanteessa, vartijan kentällä kirjoittama havainto katoaa eikä kukaan huomaa mitään.
// Siksi testit painottuvat siihen mitä jonolle EI saa tapahtua.
//
// Ajetaan: node --test src/shared/jono.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  avaaJono, lisaaJonoon, tyhjennaJono, poistaJonosta, yritaUudelleen,
  kuunteleJonoa, kuunteleLahetyksia, jononPituus, nollaaJono, type JonoKirjaus,
} from './jono.ts';

// --- Tekaistu selainympäristö -----------------------------------------------------

const varasto = new Map<string, string>();
const globaali = globalThis as any;

globaali.window = {
  localStorage: {
    getItem: (k: string) => (varasto.has(k) ? varasto.get(k)! : null),
    setItem: (k: string, v: string) => { varasto.set(k, v); },
    removeItem: (k: string) => { varasto.delete(k); },
  },
  addEventListener: () => {},
};
globaali.document = { addEventListener: () => {}, visibilityState: 'visible' };

type Vastaus = { status: number; keho: unknown };
let vastaukset: Vastaus[] = [];
let pyynnot: { polku: string; runko: any }[] = [];

globaali.fetch = async (polku: string, asetukset: any) => {
  pyynnot.push({ polku, runko: JSON.parse(asetukset.body) });
  const vastaus = vastaukset.shift() || { status: 200, keho: { ok: true } };
  if (vastaus.status === 0) throw new Error('verkko poikki');
  return {
    ok: vastaus.status >= 200 && vastaus.status < 300,
    status: vastaus.status,
    json: async () => vastaus.keho,
  };
};

const alusta = () => {
  nollaaJono();
  varasto.clear();
  vastaukset = [];
  pyynnot = [];
  avaaJono('vartija1');
};

const kirjaus = (kuvaus = 'Testikirjaus') => ({
  polku: '/api/kirjaa/guardReports',
  runko: { id: 'r-1', summary: 'Havainto' },
  kuvaus,
});

// --- Onnistunut lähetys -----------------------------------------------------------

test('onnistunut lähetys tyhjentää jonon', async () => {
  alusta();
  const heti = (await lisaaJonoon(kirjaus())).lahetetty;
  assert.equal(heti, true, 'lähetys onnistui saman tien');
  assert.equal(jononPituus(), 0);
  assert.equal(pyynnot.length, 1);
});

test('ensimmäisessä yrityksessä EI ole toisto-lippua', async () => {
  alusta();
  await lisaaJonoon(kirjaus());
  assert.equal(pyynnot[0].runko.toisto, undefined);
});

// --- Verkkovirhe ------------------------------------------------------------------

test('verkkovirhe jättää kirjauksen jonoon', async () => {
  alusta();
  vastaukset = [{ status: 0, keho: null }];
  const heti = (await lisaaJonoon(kirjaus())).lahetetty;
  assert.equal(heti, false);
  assert.equal(jononPituus(), 1);
});

test('uudelleenyritys lisää toisto-lipun', async () => {
  alusta();
  vastaukset = [{ status: 0, keho: null }];
  await lisaaJonoon(kirjaus());
  await tyhjennaJono();
  assert.equal(pyynnot.length, 2);
  assert.equal(pyynnot[0].runko.toisto, undefined, 'ensimmäinen yritys ilman lippua');
  assert.equal(pyynnot[1].runko.toisto, true, 'toinen yritys lipulla');
  assert.equal(jononPituus(), 0, 'onnistunut uusinta poistaa jonosta');
});

test('jono säilyy sivunlatauksen yli', async () => {
  alusta();
  vastaukset = [{ status: 0, keho: null }];
  await lisaaJonoon(kirjaus('Portin havainto'));
  // Sama kuin sivun uudelleenlataus: moduulin tila nollataan, varasto säilyy.
  nollaaJono();
  avaaJono('vartija1');
  assert.equal(jononPituus(), 1);
});

test('palvelinvirhe (5xx) ei jumita kirjausta vaan jää yritettäväksi', async () => {
  alusta();
  vastaukset = [{ status: 503, keho: { ok: false, error: 'Huoltokatko' } }];
  await lisaaJonoon(kirjaus());
  let nykyinen: JonoKirjaus[] = [];
  kuunteleJonoa((j) => { nykyinen = j; });
  assert.equal(nykyinen[0].jumissa, false);
  assert.match(String(nykyinen[0].viimeinenVirhe), /503/);
});

// --- Pysyvä virhe -----------------------------------------------------------------

test('pysyvä virhe (4xx) EI hävitä kirjausta vaan merkitsee sen jumiin', async () => {
  alusta();
  vastaukset = [{ status: 403, keho: { ok: false, error: 'Ei oikeuksia' } }];
  await lisaaJonoon(kirjaus());
  let nykyinen: JonoKirjaus[] = [];
  kuunteleJonoa((j) => { nykyinen = j; });
  assert.equal(jononPituus(), 1, 'kirjaus on yhä jonossa');
  assert.equal(nykyinen[0].jumissa, true);
  assert.equal(nykyinen[0].viimeinenVirhe, 'Ei oikeuksia');
});

test('jumissa olevaa ei yritetä automaattisesti uudelleen', async () => {
  alusta();
  vastaukset = [{ status: 403, keho: { ok: false, error: 'Ei oikeuksia' } }];
  await lisaaJonoon(kirjaus());
  const ennen = pyynnot.length;
  await tyhjennaJono();
  assert.equal(pyynnot.length, ennen, 'uutta pyyntöä ei lähetetty');
});

test('käyttäjä voi käskeä yrittää uudelleen', async () => {
  alusta();
  vastaukset = [{ status: 403, keho: { ok: false, error: 'Ei oikeuksia' } }];
  await lisaaJonoon(kirjaus());
  let nykyinen: JonoKirjaus[] = [];
  kuunteleJonoa((j) => { nykyinen = j; });
  await yritaUudelleen(nykyinen[0].id);
  assert.equal(jononPituus(), 0, 'toinen yritys onnistui ja poisti jonosta');
});

test('poistaminen on käyttäjän oma toimi eikä jonon automatiikkaa', async () => {
  alusta();
  vastaukset = [{ status: 400, keho: { ok: false, error: 'Kelvoton' } }];
  await lisaaJonoon(kirjaus());
  let nykyinen: JonoKirjaus[] = [];
  kuunteleJonoa((j) => { nykyinen = j; });
  assert.equal(jononPituus(), 1);
  poistaJonosta(nykyinen[0].id);
  assert.equal(jononPituus(), 0);
});

// --- Järjestys ja rinnakkaisuus ---------------------------------------------------

test('kirjaukset lähtevät siinä järjestyksessä kuin ne tehtiin', async () => {
  alusta();
  // Kaksi epäonnistumista: molemmat lisäykset yrittävät lähettää heti, ja molempien on
  // jäätävä jonoon jotta järjestystä voi ylipäätään testata.
  vastaukset = [{ status: 0, keho: null }, { status: 0, keho: null }];
  await lisaaJonoon({ polku: '/a', runko: { id: '1' }, kuvaus: 'eka' });
  await lisaaJonoon({ polku: '/b', runko: { id: '2' }, kuvaus: 'toka' });
  assert.equal(jononPituus(), 2, 'molemmat jonossa');
  pyynnot = [];
  await tyhjennaJono();
  assert.deepEqual(pyynnot.map((p) => p.polku), ['/a', '/b']);
});

test('verkkovirhe pysäyttää lähetyksen eikä hyppää seuraavan yli', async () => {
  alusta();
  vastaukset = [{ status: 0, keho: null }, { status: 0, keho: null }];
  await lisaaJonoon({ polku: '/a', runko: { id: '1' }, kuvaus: 'eka' });
  await lisaaJonoon({ polku: '/b', runko: { id: '2' }, kuvaus: 'toka' });
  pyynnot = [];
  vastaukset = [{ status: 0, keho: null }];
  await tyhjennaJono();
  // Vain ensimmäinen yritettiin: jos toinen olisi lähtenyt, kierroksen kuittaus voisi
  // mennä perille ennen sitä edeltävää kirjausta.
  assert.deepEqual(pyynnot.map((p) => p.polku), ['/a']);
  assert.equal(jononPituus(), 2);
});

// --- Käyttäjäkohtaisuus -----------------------------------------------------------

test('toisen vartijan jono ei näy eikä lähde omissa nimissä', async () => {
  alusta();
  vastaukset = [{ status: 0, keho: null }];
  await lisaaJonoon(kirjaus('Vartija 1:n kirjaus'));
  assert.equal(jononPituus(), 1);
  // Vuoron vaihto samalla laitteella.
  avaaJono('vartija2');
  assert.equal(jononPituus(), 0, 'toisen jono ei näy');
  // Ja edellisen jono säilyy omalla tunnuksellaan.
  avaaJono('vartija1');
  assert.equal(jononPituus(), 1);
});

// --- Lähetysilmoitus ---------------------------------------------------------------
//
// Palvelin voi muuttaa lähetettyä tietuetta: EVENT-puolen juokseva tunniste siirtyy
// seuraavaan vapaaseen numeroon jos kaksi verkotonta laitetta antoi saman. Ilman
// ilmoitusta laite näyttäisi listassaan numeroa joka ei ole se joka arkistoon meni.

test('onnistunut lähetys kertoo kuuntelijalle mitä palvelin vastasi', async () => {
  alusta();
  const ilmoitukset: any[] = [];
  const lopeta = kuunteleLahetyksia((i) => ilmoitukset.push(i));
  vastaukset = [{ status: 200, keho: { ok: true, id: '26/FesX/0409/103', siirretty: true } }];

  await lisaaJonoon({ ...kirjaus(), runko: { id: '26/FesX/0409/101', jonoId: 'j-1' } });

  assert.equal(ilmoitukset.length, 1);
  assert.equal(ilmoitukset[0].vastaus.id, '26/FesX/0409/103');
  assert.equal(ilmoitukset[0].vastaus.siirretty, true);
  // Runko on mukana, jotta kuuntelija tietää MINKÄ rivin tunniste siirtyi.
  assert.equal((ilmoitukset[0].runko as any).jonoId, 'j-1');
  lopeta();
});

test('epäonnistunut lähetys ei kerro onnistumisesta', async () => {
  alusta();
  const ilmoitukset: any[] = [];
  const lopeta = kuunteleLahetyksia((i) => ilmoitukset.push(i));
  vastaukset = [{ status: 0, keho: null }];

  await lisaaJonoon(kirjaus());

  assert.equal(ilmoitukset.length, 0);
  assert.equal(jononPituus(), 1, 'kirjaus jäi jonoon');
  lopeta();
});

test('kuuntelijan virhe ei jätä jonoa puolitiehen', async () => {
  alusta();
  const lopeta = kuunteleLahetyksia(() => { throw new Error('kuuntelija hajosi'); });
  vastaukset = [
    { status: 200, keho: { ok: true } },
    { status: 200, keho: { ok: true } },
  ];

  await lisaaJonoon({ ...kirjaus('eka'), runko: { id: 'a' }, tunniste: 'a' });
  await lisaaJonoon({ ...kirjaus('toka'), runko: { id: 'b' }, tunniste: 'b' });

  assert.equal(jononPituus(), 0, 'molemmat lähtivät kuuntelijan virheestä huolimatta');
  lopeta();
});
