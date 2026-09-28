import { test } from 'node:test';
import assert from 'node:assert/strict';

import { poistaKohta, poistaVaihtoehto, puujarjestys, siirra, type Luonnoskohta } from './skenaariopuu.ts';
import { aktiivisetKohdat, tilanneloki, valitutPolut, type Suoritus } from './pohjat.ts';

// Palohälytys: valinta, jonka "on"-polulla on sisäkkäinen valinta.
const kohdat = (): Luonnoskohta[] => [
  { id: 'loppu', teksti: 'Raportoi' },
  { id: 'on1', teksti: 'Soita 112', haara: 'on' },
  { id: 'v', teksti: 'Tulipalo?', tyyppi: 'valinta', vaihtoehdot: [{ id: 'on', teksti: 'On' }, { id: 'ei', teksti: 'Ei' }] },
  { id: 'ei1', teksti: 'Selvitä aiheuttaja', haara: 'ei' },
  { id: 'v2', teksti: 'Ihmisiä sisällä?', haara: 'on', tyyppi: 'valinta', vaihtoehdot: [{ id: 'k', teksti: 'Kyllä' }, { id: 'e', teksti: 'Ei' }] },
  { id: 'k1', teksti: 'Evakuoi', haara: 'k' },
];

test('puujärjestys: valinta ennen omia kohtiaan, sisarusten järjestys säilyy', () => {
  // Pääpolun sisarukset ovat järjestyksessä loppu, v — ja v:n haarat tulevat heti v:n perään.
  assert.deepEqual(puujarjestys(kohdat()).map((k) => k.id), ['loppu', 'v', 'on1', 'v2', 'k1', 'ei1']);
});

test('valinnan poisto vie koko haaran mukanaan', () => {
  assert.deepEqual(poistaKohta(kohdat(), 'v').map((k) => k.id), ['loppu']);
  assert.deepEqual(poistaVaihtoehto(kohdat(), 'v', 'on').map((k) => k.id), ['loppu', 'v', 'ei1']);
  const v = poistaVaihtoehto(kohdat(), 'v', 'on').find((k) => k.id === 'v');
  assert.deepEqual(v?.vaihtoehdot?.map((x) => x.id), ['ei']);
});

test('siirto tapahtuu vain saman haaran sisarusten kesken', () => {
  assert.deepEqual(puujarjestys(siirra(kohdat(), 'v', -1)).map((k) => k.id)[0], 'v');
  // on1 ja v2 ovat sisaruksia; ei1 on toisessa haarassa eikä liiku.
  assert.deepEqual(puujarjestys(siirra(kohdat(), 'v2', -1)).map((k) => k.id), ['loppu', 'v', 'v2', 'k1', 'on1', 'ei1']);
  // Haaransa ainoa kohta ei liiku minnekään.
  const ennen = kohdat();
  assert.equal(siirra(ennen, 'ei1', 1), ennen);
});

const suoritus = (valinnat: Record<string, string>): Suoritus => ({
  id: 's', kind: 'play', ownerId: 'k1', templateId: 'p', templateNimi: 'Palo', templateVersio: 1,
  tekija: 'v1', kuvaus: '', alkoi: '2026-09-28T10:00:00Z', paattyi: null, tila: 'kesken',
  keskeytysSyy: '', huomiot: '',
  kommentit: [{ id: 'c1', aika: '2026-09-28T10:02:00Z', tekija: 'halke', teksti: 'Palokunta tulossa' }],
  kohdat: puujarjestys(kohdat()).map((k) => ({
    kohtaId: k.id as string, teksti: k.teksti as string, kuvaus: '', vastuu: '', aika: '',
    kriittinen: false, kuitattu: k.id === 'loppu' ? '2026-09-28T10:05:00Z' : null, kuittaaja: 'v1', huomio: '',
    haara: k.haara, tyyppi: k.tyyppi, vaihtoehdot: k.vaihtoehdot, valittu: valinnat[k.id as string] ?? null,
  })),
});

test('aktiiviset kohdat seuraavat valintoja sisäkkäin', () => {
  assert.deepEqual(aktiivisetKohdat(suoritus({}).kohdat).map((k) => k.kohtaId), ['loppu', 'v']);
  assert.deepEqual(aktiivisetKohdat(suoritus({ v: 'on' }).kohdat).map((k) => k.kohtaId), ['loppu', 'v', 'on1', 'v2']);
  assert.deepEqual(aktiivisetKohdat(suoritus({ v: 'on', v2: 'k' }).kohdat).map((k) => k.kohtaId), ['loppu', 'v', 'on1', 'v2', 'k1']);
  // Sisempi valinta jää voimaan tietueeseen, mutta ei ole aktiivinen kun ylempi polku vaihtuu.
  assert.deepEqual(aktiivisetKohdat(suoritus({ v: 'ei', v2: 'k' }).kohdat).map((k) => k.kohtaId), ['loppu', 'v', 'ei1']);
  assert.deepEqual(valitutPolut(suoritus({ v: 'on', v2: 'k' })), [
    { kysymys: 'Tulipalo?', vastaus: 'On' }, { kysymys: 'Ihmisiä sisällä?', vastaus: 'Kyllä' },
  ]);
});

test('tilanneloki on aikajärjestyksessä', () => {
  const loki = tilanneloki(suoritus({}));
  assert.deepEqual(loki.map((r) => r.laji), ['tila', 'kommentti', 'kuittaus']);
  assert.equal(loki[1].teksti, 'Palokunta tulossa');
});
