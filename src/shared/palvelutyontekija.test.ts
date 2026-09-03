// Palvelutyöntekijän testit.
//
// Nämä ovat poikkeuksellisen tärkeät, koska palvelutyöntekijää EI voi ajaa
// selainpaneelissa lainkaan: rekisteröinti epäonnistuu siellä myös yhden rivin
// testityöntekijällä, eli kyse on ympäristöstä. Ilman näitä testejä koko tiedosto olisi
// todentamatonta koodia joka ajetaan jokaisen käyttäjän selaimessa ja joka voi
// pahimmillaan tarjoilla vanhaa nippua tai tallentaa API-vastauksia laitteelle.
//
// Toteutus: sw-pohja.js luetaan, paikkamerkit korvataan kuten buildissa, ja skripti
// ajetaan Noden vm-hiekkalaatikossa tekaistuilla selainrajapinnoilla. Näin testataan
// juuri sitä koodia joka päätyy tuotantoon.
//
// Ajetaan: node --test src/shared/palvelutyontekija.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const TIEDOSTOT = ['/index.html', '/assets/index-abc.js', '/assets/index-abc.css'];

type Kasittelijat = Record<string, (tapahtuma: any) => void>;

// Tekaistu Cache Storage. Riittävän tarkka näihin testeihin: avaimena polku.
function teeVarastot() {
  const varastot = new Map<string, Map<string, unknown>>();
  return {
    varastot,
    caches: {
      open: async (nimi: string) => {
        if (!varastot.has(nimi)) varastot.set(nimi, new Map());
        const varasto = varastot.get(nimi)!;
        return {
          addAll: async (polut: string[]) => { for (const p of polut) varasto.set(p, { runko: p }); },
          put: async (pyynto: any, vastaus: unknown) => {
            varasto.set(typeof pyynto === 'string' ? pyynto : new URL(pyynto.url).pathname, vastaus);
          },
        };
      },
      keys: async () => [...varastot.keys()],
      delete: async (nimi: string) => varastot.delete(nimi),
      match: async (pyynto: any) => {
        const polku = typeof pyynto === 'string' ? pyynto : new URL(pyynto.url).pathname;
        for (const varasto of varastot.values()) if (varasto.has(polku)) return varasto.get(polku);
        return undefined;
      },
    },
  };
}

function lataaTyontekija({ fetchToteutus }: { fetchToteutus?: (p: any) => Promise<any> } = {}) {
  const lahde = readFileSync(new URL('../../sw-pohja.js', import.meta.url), 'utf8')
    .replace('__VERSIO__', 'testi1')
    .replace('__TIEDOSTOT__', JSON.stringify(TIEDOSTOT));

  const kasittelijat: Kasittelijat = {};
  const { varastot, caches } = teeVarastot();
  const claimKutsuttu = { arvo: false };
  const skipWaitingKutsuttu = { arvo: false };

  const self = {
    addEventListener: (nimi: string, fn: (t: any) => void) => { kasittelijat[nimi] = fn; },
    location: { origin: 'https://turvajohto-os.fi' },
    clients: { claim: async () => { claimKutsuttu.arvo = true; } },
    skipWaiting: () => { skipWaitingKutsuttu.arvo = true; },
  };

  const konteksti: any = {
    self,
    caches,
    fetch: fetchToteutus || (async () => ({ ok: true, type: 'basic', clone: () => ({}) })),
    Response: class {
      body: unknown; status: number;
      constructor(body: unknown, init: any = {}) { this.body = body; this.status = init.status ?? 200; }
    },
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    Promise,
    console,
  };
  konteksti.globalThis = konteksti;
  vm.createContext(konteksti);
  vm.runInContext(lahde, konteksti);

  return { kasittelijat, varastot, claimKutsuttu, skipWaitingKutsuttu, caches };
}

// Pyyntöolio siinä laajuudessa kuin palvelutyöntekijä sitä käyttää.
const pyynto = (url: string, { metodi = 'GET', mode = 'no-cors', accept = '' } = {}) => ({
  url,
  method: metodi,
  mode,
  headers: { get: (nimi: string) => (nimi.toLowerCase() === 'accept' ? accept : null) },
});

const aja = async (kasittelija: (t: any) => void, tapahtuma: any) => {
  kasittelija(tapahtuma);
  if (tapahtuma.__odota) await tapahtuma.__odota;
  if (tapahtuma.__vastaus) return tapahtuma.__vastaus;
  return undefined;
};

const fetchTapahtuma = (p: any) => {
  const tapahtuma: any = { request: p };
  tapahtuma.respondWith = (v: any) => { tapahtuma.__vastaus = v; };
  return tapahtuma;
};

// --- Asennus ----------------------------------------------------------------------

test('asennus tallentaa sovellusrungon välimuistiin', async () => {
  const { kasittelijat, varastot } = lataaTyontekija();
  const tapahtuma: any = { waitUntil: (p: Promise<unknown>) => { tapahtuma.__odota = p; } };
  await aja(kasittelijat.install, tapahtuma);
  const varasto = varastot.get('turvajohto-testi1');
  assert.ok(varasto, 'varasto luotiin versionimellä');
  for (const polku of TIEDOSTOT) assert.ok(varasto!.has(polku), `${polku} tallennettiin`);
});

test('asennus EI ota uutta versiota heti käyttöön', () => {
  const { skipWaitingKutsuttu } = lataaTyontekija();
  // skipWaiting saa tapahtua vain käyttäjän hyväksynnästä: kesken oleva kirjaus
  // katoaisi sivunlatauksessa.
  assert.equal(skipWaitingKutsuttu.arvo, false);
});

test('käyttöönottoviesti kutsuu skipWaitingia', () => {
  const { kasittelijat, skipWaitingKutsuttu } = lataaTyontekija();
  kasittelijat.message({ data: 'ota-kayttoon' });
  assert.equal(skipWaitingKutsuttu.arvo, true);
});

test('tuntematon viesti ei ota versiota käyttöön', () => {
  const { kasittelijat, skipWaitingKutsuttu } = lataaTyontekija();
  kasittelijat.message({ data: 'jotain muuta' });
  assert.equal(skipWaitingKutsuttu.arvo, false);
});

// --- Aktivointi -------------------------------------------------------------------

test('aktivointi poistaa vanhat versiot mutta säästää nykyisen ja vieraat', async () => {
  const { kasittelijat, varastot, claimKutsuttu, caches } = lataaTyontekija();
  await caches.open('turvajohto-vanha');
  await caches.open('turvajohto-testi1');
  await caches.open('jokin-muu-sovellus');
  const tapahtuma: any = { waitUntil: (p: Promise<unknown>) => { tapahtuma.__odota = p; } };
  await aja(kasittelijat.activate, tapahtuma);
  assert.equal(varastot.has('turvajohto-vanha'), false, 'vanha versio poistettiin');
  assert.equal(varastot.has('turvajohto-testi1'), true, 'nykyinen säilyi');
  assert.equal(varastot.has('jokin-muu-sovellus'), true, 'toisen sovelluksen varastoa ei kosketa');
  assert.equal(claimKutsuttu.arvo, true);
});

// --- Nouto ------------------------------------------------------------------------

test('API-pyyntöä EI käsitellä eikä siis koskaan välimuistiteta', () => {
  const { kasittelijat } = lataaTyontekija();
  const tapahtuma = fetchTapahtuma(pyynto('https://turvajohto-os.fi/api/data/reports'));
  kasittelijat.fetch(tapahtuma);
  // respondWith jää kutsumatta: pyyntö menee verkkoon normaalisti.
  assert.equal(tapahtuma.__vastaus, undefined);
});

test('muun alkuperän pyyntöä ei käsitellä', () => {
  const { kasittelijat } = lataaTyontekija();
  const tapahtuma = fetchTapahtuma(pyynto('https://example.com/kuva.png'));
  kasittelijat.fetch(tapahtuma);
  assert.equal(tapahtuma.__vastaus, undefined);
});

test('POST-pyyntöä ei käsitellä', () => {
  const { kasittelijat } = lataaTyontekija();
  const tapahtuma = fetchTapahtuma(pyynto('https://turvajohto-os.fi/kuva.png', { metodi: 'POST' }));
  kasittelijat.fetch(tapahtuma);
  assert.equal(tapahtuma.__vastaus, undefined);
});

test('hashattu tiedosto tarjoillaan välimuistista ilman verkkoa', async () => {
  let verkkoaKysyttiin = false;
  const { kasittelijat } = lataaTyontekija({
    fetchToteutus: async () => { verkkoaKysyttiin = true; return { ok: true, type: 'basic', clone: () => ({}) }; },
  });
  const asennus: any = { waitUntil: (p: Promise<unknown>) => { asennus.__odota = p; } };
  await aja(kasittelijat.install, asennus);

  const tapahtuma = fetchTapahtuma(pyynto('https://turvajohto-os.fi/assets/index-abc.js'));
  kasittelijat.fetch(tapahtuma);
  const vastaus = await tapahtuma.__vastaus;
  assert.deepEqual(vastaus, { runko: '/assets/index-abc.js' });
  assert.equal(verkkoaKysyttiin, false, 'muuttumatonta tiedostoa ei haeta verkosta uudelleen');
});

test('sivunlataus haetaan ensin verkosta ja tuore runko tallennetaan', async () => {
  const verkkovastaus = { ok: true, type: 'basic', clone: () => ({ tuore: true }) };
  const { kasittelijat, varastot } = lataaTyontekija({ fetchToteutus: async () => verkkovastaus });
  const tapahtuma = fetchTapahtuma(pyynto('https://turvajohto-os.fi/guard', { mode: 'navigate' }));
  kasittelijat.fetch(tapahtuma);
  const vastaus = await tapahtuma.__vastaus;
  assert.equal(vastaus, verkkovastaus);
  assert.deepEqual(varastot.get('turvajohto-testi1')?.get('/index.html'), { tuore: true });
});

test('verkon pettäessä sivunlataus tarjoillaan välimuistista', async () => {
  const { kasittelijat } = lataaTyontekija({
    fetchToteutus: async () => { throw new Error('verkko poikki'); },
  });
  const asennus: any = { waitUntil: (p: Promise<unknown>) => { asennus.__odota = p; } };
  await aja(kasittelijat.install, asennus);

  const tapahtuma = fetchTapahtuma(pyynto('https://turvajohto-os.fi/guard', { mode: 'navigate' }));
  kasittelijat.fetch(tapahtuma);
  const vastaus = await tapahtuma.__vastaus;
  assert.deepEqual(vastaus, { runko: '/index.html' }, 'runko tuli välimuistista');
});

test('ilman välimuistia ja verkkoa vastataan selkeällä ohjeella eikä selaimen virhesivulla', async () => {
  const { kasittelijat } = lataaTyontekija({
    fetchToteutus: async () => { throw new Error('verkko poikki'); },
  });
  // Asennusta EI ajeta: mitään ei ole välimuistissa.
  const tapahtuma = fetchTapahtuma(pyynto('https://turvajohto-os.fi/guard', { mode: 'navigate' }));
  kasittelijat.fetch(tapahtuma);
  const vastaus: any = await tapahtuma.__vastaus;
  assert.equal(vastaus.status, 503);
  assert.match(String(vastaus.body), /Ei yhteyttä/);
});

test('accept-otsakkeesta tunnistettu HTML käsitellään sivunlatauksena', async () => {
  const { kasittelijat } = lataaTyontekija({
    fetchToteutus: async () => { throw new Error('verkko poikki'); },
  });
  const asennus: any = { waitUntil: (p: Promise<unknown>) => { asennus.__odota = p; } };
  await aja(kasittelijat.install, asennus);
  const tapahtuma = fetchTapahtuma(pyynto('https://turvajohto-os.fi/event', { accept: 'text/html,*/*' }));
  kasittelijat.fetch(tapahtuma);
  assert.deepEqual(await tapahtuma.__vastaus, { runko: '/index.html' });
});
