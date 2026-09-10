// Erän 16 päästä päähän -todennus oikeaa Express-palvelinta vasten.
// Ajetaan repon juuresta: node server/e2e-vuorot.mjs   (poistetaan ajon jälkeen)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import bcrypt from 'bcryptjs';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-vuorot-'));
const PORT = 4124;
const PALVELIN = `http://127.0.0.1:${PORT}`;

const AAMU = { id: 'v-aamu', nimi: 'Aamuvuoro', alkaa: '07:00', paattyy: '15:00', tehtavaIdt: ['t1'], pohjaIdt: ['p1'] };
const ILTA = { id: 'v-ilta', nimi: 'Iltavuoro', alkaa: '15:00', paattyy: '23:00', tehtavaIdt: [], pohjaIdt: [] };
const LISA = { id: 'v-lisa', nimi: 'Lisävuoro', tehtavaIdt: ['t1'], pohjaIdt: ['pohja-1'] };

// Oma taso vartijalle: ilman tasoa käyttäjällä ei ole yhtään oikeutta, jolloin
// perehdytettävien lista jäisi tyhjäksi eikä kenttärajausta voisi todistaa.
//
// `guard_tasks` on muokkausoikeuksin, ja se on välttämätöntä eikä koristetta: ilman sitä
// vartija torjutaan jo "ei oikeutta työskennellä tässä kohteessa" -ehtoon, eikä
// perehdytystä koskeviin testeihin päästäisi lainkaan. Testi mittaisi silloin eri estettä
// kuin se väittää mittaavansa.
fs.writeFileSync(path.join(DATA, 'roles.json'), JSON.stringify({ roles: [
  {
    id: 'vartijataso',
    name: 'Vartija',
    permissions: {
      __default__: {
        guard_site_info: { view: true, edit: false },
        guard_tasks: { view: true, edit: true },
      },
    },
  },
] }, null, 2));

fs.writeFileSync(path.join(DATA, 'users.json'), JSON.stringify({ users: [
  { username: 'testiadmin', role: 'admin', password_hash: bcrypt.hashSync('salasana123', 4) },
  {
    username: 'vartija1', role: 'user', roleId: 'vartijataso', nickname: 'Virtanen Matti',
    displayId: 51, tuotteet: ['guard'], password_hash: bcrypt.hashSync('salasana123', 4),
    totp_required: false,
  },
] }, null, 2));

fs.writeFileSync(path.join(DATA, 'guardSites.json'), JSON.stringify([
  {
    id: 'kohde-perehdytetty',
    name: 'Kauppakeskus Hansa',
    tehtavat: [
      { id: 't1', nimi: 'Sulkukierros', tyyppi: 'kuittaus', kohdat: [] },
      { id: 't2', nimi: 'Avainten tarkistus', tyyppi: 'lista', kohdat: ['Pääovi'] },
    ],
    vuorotyypit: [AAMU, ILTA, LISA],
    perehdytykset: [
      // Kytketty tunnukseen: myöntää aamu- ja lisävuoron.
      { id: 'p1', nimi: 'Virtanen Matti', username: 'testiadmin', pvm: '2026-09-01', vuorotyyppiIdt: ['v-aamu', 'v-lisa'] },
      // Toisen henkilön perehdytys kaikkiin vuoroihin: ei saa vuotaa eikä myöntää mitään.
      { id: 'p2', nimi: 'Korhonen Liisa', username: 'joku-muu', pvm: '2026-09-01', vuorotyyppiIdt: ['v-aamu', 'v-ilta', 'v-lisa'] },
    ],
  },
  {
    id: 'kohde-tyhja-lista',
    name: 'Tehdas Pohjola',
    vuorotyypit: [{ ...AAMU, id: 'v-aamu2' }],
    // Kytketty tunnukseen mutta EI YHTÄÄN vuoroa: ei saa myöntää mitään.
    perehdytykset: [{ id: 'p3', nimi: 'Virtanen Matti', username: 'testiadmin', pvm: '2026-09-01', vuorotyyppiIdt: [] }],
  },
  {
    id: 'kohde-kytkematon',
    name: 'Varasto Etelä',
    vuorotyypit: [{ ...AAMU, id: 'v-aamu3' }],
    // Ei tunnusta: dokumentti kyllä, oikeus ei.
    perehdytykset: [{ id: 'p4', nimi: 'Virtanen Matti', pvm: '2026-09-01', vuorotyyppiIdt: ['v-aamu3'] }],
  },
], null, 2));

fs.writeFileSync(path.join(DATA, 'templates.json'), JSON.stringify([
  { id: 'pohja-1', kind: 'patrol', ownerId: 'kohde-perehdytetty', nimi: 'Yökierros', versio: 1, pisteet: [] },
  { id: 'pohja-2', kind: 'patrol', ownerId: 'kohde-perehdytetty', nimi: 'Ulkokierros', versio: 1, pisteet: [] },
], null, 2));

const palvelin = spawn(process.execPath, ['server/index.js'], {
  env: {
    ...process.env, DATA_DIR: DATA, PORT: String(PORT),
    JWT_SECRET: 'e2e-jwt-salaisuus-vain-testiin',
    TOTP_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
palvelin.stderr.on('data', (d) => process.stderr.write(`[palvelin] ${d}`));

const odota = async () => {
  for (let i = 0; i < 60; i += 1) {
    try { await fetch(`${PALVELIN}/api/session`); return; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error('palvelin ei noussut');
};

const vaita = (ehto, teksti) => {
  console.log(`${ehto ? '  OK   ' : '  EPÄONNISTUI  '} ${teksti}`);
  if (!ehto) process.exitCode = 1;
};

try {
  await odota();
  const kirj = await fetch(`${PALVELIN}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testiadmin', password: 'salasana123' }),
  });
  const evaste = (kirj.headers.getSetCookie() || []).map((r) => r.split(';')[0]).join('; ');

  const vastaus = await fetch(`${PALVELIN}/api/vuorot/omat`, { headers: { Cookie: evaste } });
  const raaka = await vastaus.text();
  const data = JSON.parse(raaka);

  console.log('\n1. Omat vuorovaihtoehdot');
  vaita(vastaus.status === 200 && data.ok, `reitti vastaa (${vastaus.status})`);
  vaita(data.kohteet.length === 1, `vain perehdytetty kohde listalla (${data.kohteet.length})`);
  vaita(data.kohteet[0]?.siteNimi === 'Kauppakeskus Hansa', 'oikea kohde');

  const vuorot = data.kohteet[0]?.vuorot || [];
  const nimella = (id) => vuorot.find((v) => v.id === id);
  vaita(vuorot.length === 3, `kaikki kohteen vuorot mukana (${vuorot.length})`);
  vaita(nimella('v-aamu')?.perehdytetty === true, 'aamuvuoro perehdytetty');
  vaita(nimella('v-lisa')?.perehdytetty === true, 'lisävuoro perehdytetty');
  vaita(nimella('v-ilta')?.perehdytetty === false, 'iltavuoroa EI ole perehdytetty, ja se näkyy silti');
  vaita(nimella('v-aamu')?.tehtavia === 1 && nimella('v-aamu')?.kierroksia === 1, 'vuoron sisältö laskettu');
  vaita(typeof nimella('v-aamu')?.ikkunassa === 'boolean', 'kello arvioitu erikseen perehdytyksestä');

  console.log('\n2. Kaksi tapaa olla myöntämättä pääsyä');
  vaita(!data.kohteet.some((k) => k.siteId === 'kohde-tyhja-lista'), 'tyhjä vuorolista ei myönnä mitään');
  vaita(!data.kohteet.some((k) => k.siteId === 'kohde-kytkematon'), 'kytkemätön perehdytys ei myönnä mitään');
  vaita(data.ilmanPerehdytysta === 2, `pois jääneet lasketaan (${data.ilmanPerehdytysta})`);

  console.log('\n3. Perehdytyslista ei vuoda vastaukseen');
  for (const kielletty of ['Virtanen', 'Korhonen', 'joku-muu', 'perehdytykset']) {
    vaita(!raaka.includes(kielletty), `"${kielletty}" ei ole vastauksessa`);
  }

  console.log('\n4. Perehdytettävien lista');
  const lista = await fetch(`${PALVELIN}/api/kohde/kohde-perehdytetty/perehdytettavat`, { headers: { Cookie: evaste } });
  const kayttajat = (await lista.json()).kayttajat;
  vaita(lista.status === 200, `reitti vastaa (${lista.status})`);
  vaita(Array.isArray(kayttajat), 'palauttaa listan');
  // Pääkäyttäjä ON perehdytettävissä (korjattu 10.9.2026). Aluksi hänet rajattiin pois,
  // mistä seurasi umpikuja: vuorolista rajaa perehdytyksen mukaan eikä tunne
  // pääkäyttäjäpoikkeusta, joten pääkäyttäjä ei olisi päässyt yhteenkään vuoroon.
  vaita(kayttajat.some((k) => k.username === 'testiadmin'), 'pääkäyttäjä on perehdytettävissä');
  vaita(kayttajat.some((k) => k.username === 'vartija1'), 'vartija on perehdytettävissä');
  const kentat = new Set(kayttajat.flatMap((k) => Object.keys(k)));
  vaita(kentat.size > 0 && [...kentat].every((k) => ['username', 'nimi', 'displayId'].includes(k)),
    `vain valintaan tarvittavat kentät (${[...kentat].join(',')})`);
  const raakaLista = JSON.stringify(kayttajat);
  for (const kielletty of ['password_hash', 'totp', 'roleId', 'eventAccess']) {
    vaita(!raakaLista.includes(kielletty), `"${kielletty}" ei vuoda valintalistalle`);
  }

  console.log('\n5. Kirjautumaton ei pääse kumpaankaan');
  vaita((await fetch(`${PALVELIN}/api/vuorot/omat`)).status === 401, 'omat vuorot vaatii istunnon');
  vaita((await fetch(`${PALVELIN}/api/kohde/kohde-perehdytetty/perehdytettavat`)).status === 401,
    'perehdytettävät vaatii istunnon');

  console.log('\n6. Vuoron aloitus ja sisällön kopiointi');
  const post = async (polku, runko, evasteet = evaste) => {
    const v = await fetch(`${PALVELIN}${polku}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: evasteet },
      body: JSON.stringify(runko),
    });
    return { status: v.status, data: await v.json().catch(() => null) };
  };

  // Kellonajaton lisävuoro: elinkaaren testi ei saa riippua ajohetkestä.
  const aloitus = await post('/api/vuoro', { siteId: 'kohde-perehdytetty', vuorotyyppiId: 'v-lisa' });
  vaita(aloitus.status === 200 && aloitus.data.ok, `vuoro alkoi (${aloitus.status})`);
  const vuoro = aloitus.data.vuoro;
  vaita(vuoro?.tila === 'kesken', 'tila on kesken');
  vaita(vuoro?.siteNimi === 'Kauppakeskus Hansa', 'kohteen nimi kopioitu tietueeseen');
  vaita(vuoro?.tehtavat?.length === 1 && vuoro.tehtavat[0].lahde === 'vuoro',
    'tehtävä kopioitu vuorotyypistä lähteineen');
  vaita(vuoro?.pohjat?.length === 1 && vuoro.pohjat[0].nimi === 'Yökierros', 'kierros kopioitu');

  console.log('\n7. Yksi vuoro kerrallaan');
  const toinen = await post('/api/vuoro', { siteId: 'kohde-perehdytetty', vuorotyyppiId: 'v-aamu' });
  vaita(toinen.status === 409, `toinen vuoro torjutaan (${toinen.status})`);
  vaita(toinen.data?.vuoroId === vuoro.id, 'vastaus kertoo mikä vuoro on auki');

  console.log('\n8. Oma vuoro palvelimelta');
  const oma = await (await fetch(`${PALVELIN}/api/vuoro/oma`, { headers: { Cookie: evaste } })).json();
  vaita(oma.vuoro?.id === vuoro.id, 'kesken oleva vuoro löytyy tunnuksella');

  console.log('\n9. Lisäys kohteen hakemistosta');
  const lisays = await post(`/api/vuoro/${vuoro.id}/lisaa`, { laji: 'tehtava', kohdeId: 't2' });
  vaita(lisays.data?.vuoro?.tehtavat?.length === 2, 'tehtävä lisättiin');
  vaita(lisays.data?.vuoro?.tehtavat?.[1]?.lahde === 'itse_lisatty', 'lähde erottaa sen vuoron omista');
  const toisto = await post(`/api/vuoro/${vuoro.id}/lisaa`, { laji: 'tehtava', kohdeId: 't2' });
  vaita(toisto.data?.duplikaatti === true, 'sama tehtävä ei tule kahdesti');
  const vieras = await post(`/api/vuoro/${vuoro.id}/lisaa`, { laji: 'tehtava', kohdeId: 'ei-ole' });
  vaita(vieras.status === 400, 'hakemiston ulkopuolista ei voi lisätä');

  console.log('\n10. Vuoron päättäminen');
  const paatos = await post(`/api/vuoro/${vuoro.id}/paata`, {});
  vaita(paatos.data?.vuoro?.tila === 'paattynyt', 'vuoro päättyi');
  vaita(!!paatos.data?.vuoro?.paattyi, 'päättymisaika kirjattu');
  vaita(paatos.data.vuoro.tehtavat.length === 2, 'tekemättömät tehtävät jäävät näkyviin');
  const uudelleen = await post(`/api/vuoro/${vuoro.id}/paata`, {});
  vaita(uudelleen.status === 400, 'päättynyttä ei päätetä uudelleen');
  vaita((await post(`/api/vuoro/${vuoro.id}/paata`, { toisto: true })).data?.duplikaatti === true,
    'jonon uusintayritys on silti ok');

  console.log('\n11. Perehdyttämätön vuoro ja kertalupa');
  const esto = await post('/api/vuoro', { siteId: 'kohde-perehdytetty', vuorotyyppiId: 'v-ilta' });
  vaita(esto.status === 403, `perehdyttämätön vuoro estetään (${esto.status})`);
  vaita(esto.data?.syy === 'ei_perehdytysta', 'syy on koneluettava, jotta lupaa voi tarjota');

  // Vartija1:llä ei ole perehdytystä mihinkään: hälytyskeskus avaa vuoron kertaluvalla.
  const lupa = await post('/api/vuoro', {
    siteId: 'kohde-perehdytetty', vuorotyyppiId: 'v-lisa',
    vartija: 'vartija1', poikkeusSyy: 'Sairastapaus, ei muuta vartijaa saatavilla',
  });
  vaita(lupa.status === 200, `kertalupa avaa vuoron (${lupa.status})`);
  vaita(lupa.data?.vuoro?.vartija === 'vartija1', 'vuoro on vartijan eikä myöntäjän');
  vaita(lupa.data?.vuoro?.perehdytysPoikkeus?.myontaja === 'testiadmin', 'myöntäjä jää tietueeseen');
  vaita(lupa.data?.vuoro?.perehdytysPoikkeus?.este === 'ei_perehdytysta', 'este jää tietueeseen');
  // Päätetään heti: vartija1 tarvitaan vielä kohdassa 13, eikä kesken jäänyt vuoro saa
  // muuttaa myöhempää testiä 409-tapaukseksi ja mitata eri asiaa kuin se väittää.
  await post(`/api/vuoro/${lupa.data.vuoro.id}/paata`, {});

  console.log('\n12. Kertalupa ei ole kenen tahansa myönnettävissä');
  const vartijanKirj = await fetch(`${PALVELIN}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'vartija1', password: 'salasana123' }),
  });
  const vartijanEvaste = (vartijanKirj.headers.getSetCookie() || []).map((r) => r.split(';')[0]).join('; ');
  vaita(!!vartijanEvaste, 'vartija kirjautui');
  const yritys = await post('/api/vuoro', {
    siteId: 'kohde-perehdytetty', vuorotyyppiId: 'v-lisa',
    vartija: 'vartija2', poikkeusSyy: 'ei syytä',
  }, vartijanEvaste);
  vaita(yritys.status === 403, `vartija ei voi aloittaa vuoroa toisen puolesta (${yritys.status})`);

  console.log('\n13. Kertalupa itselle ja ilman valtuutta');
  // Päivystäjä voi luvittaa myös itsensä: yhden pääkäyttäjän talossa toista myöntäjää ei
  // ole, eikä poikkeusta jota ei voi myöntää kannata olla olemassa.
  const itselle = await post('/api/vuoro', {
    siteId: 'kohde-perehdytetty', vuorotyyppiId: 'v-ilta',
    poikkeusSyy: 'Ainoa paikalla oleva vartija',
  });
  vaita(itselle.status === 200, `päivystäjä voi luvittaa itsensä (${itselle.status})`);
  vaita(itselle.data?.vuoro?.perehdytysPoikkeus?.myontaja === 'testiadmin', 'myöntäjä kirjataan silti');
  await post(`/api/vuoro/${itselle.data.vuoro.id}/paata`, {});

  // Vartijalla ei ole valtuutta: syyn kirjoittaminen ei riitä miksikään.
  const ilmanValtuutta = await post('/api/vuoro', {
    siteId: 'kohde-perehdytetty', vuorotyyppiId: 'v-ilta',
    poikkeusSyy: 'Kirjoitan tähän mitä tahansa',
  }, vartijanEvaste);
  vaita(ilmanValtuutta.status === 403, `vartija ei voi luvittaa itseään (${ilmanValtuutta.status})`);
  vaita(ilmanValtuutta.data?.syy === 'ei_perehdytysta', 'este pysyy perehdytyksessä');

  console.log('\n14. Vuorokokoelmaa ei voi kirjoittaa selaimesta');
  const suora = await fetch(`${PALVELIN}/api/data/guardShifts`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: evaste },
    // Kelvollinen runko (taulukko), jotta pyyntö pääsee muotovalidoinnin ohi. Muuten
    // testi mittaisi runkotarkistusta eikä sitä suojaa jota se väittää mittaavansa.
    body: JSON.stringify([]),
  });
  const suoraSyy = await suora.json().catch(() => null);
  vaita(suora.status === 403, `suora kirjoitus torjutaan (${suora.status})`);
  vaita(/ylläpitää palvelin/.test(suoraSyy?.error || ''), 'ja oikeasta syystä');

  console.log('\n15. Kohdelista perehdytyksen mukaan');
  const kohteet = async (evasteet) => {
    const v = await fetch(`${PALVELIN}/api/data/guardSites`, { headers: { Cookie: evasteet } });
    const d = await v.json().catch(() => null);
    return (d?.data || []).map((k) => k.id);
  };

  // Pääkäyttäjä on rajauksen ulkopuolella: hän hallinnoi kohteita joihin häntä ei ole
  // perehdytetty, ja rajaus tekisi hallinnasta mahdotonta juuri hänelle.
  vaita((await kohteet(evaste)).length === 3, 'pääkäyttäjä näkee kaikki kohteet');

  // Kenttävartija ilman perehdytystä ei näe yhtään kohdetta.
  vaita((await kohteet(vartijanEvaste)).length === 0, 'perehdyttämätön vartija ei näe kohteita');

  // Kertaluvalla avattu vuoro avaa myös kohteen tiedot. Ilman tätä poikkeusta lupa
  // antaisi työn muttei ohjeita, yhteystietoja eikä vyöhykkeitä joilla se tehdään.
  const luvitettu = await post('/api/vuoro', {
    siteId: 'kohde-perehdytetty', vuorotyyppiId: 'v-lisa',
    vartija: 'vartija1', poikkeusSyy: 'Kertaluvan testi',
  });
  vaita(luvitettu.status === 200, 'kertalupa myönnettiin');
  vaita((await kohteet(vartijanEvaste)).includes('kohde-perehdytetty'),
    'kesken oleva vuoro avaa kohteen ilman perehdytystä');

  await post(`/api/vuoro/${luvitettu.data.vuoro.id}/paata`, {});
  vaita((await kohteet(vartijanEvaste)).length === 0, 'vuoron päätyttyä kohde katoaa taas');
} finally {
  palvelin.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
}
