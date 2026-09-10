// Vuoron välityksen testit.
//
// Nämä testit ovat 10.9.2026 päivätestin perintöä. Vuoro käynnistettiin Androidin
// selainvälilehdestä, natiivipalvelu ei kuullut siitä mitään, ja käyttöliittymä näytti
// vuoron käynnissä olevalta viisi ja puoli tuntia. Kierros valmistui 10/10 pisteellä
// ilman että valvonta oli hetkeäkään päällä.
//
// Vika ei ollut siinä että välitys epäonnistui — sitä ei voi estää — vaan siinä että se
// epäonnistui HILJAA. Siksi täällä testataan paluuarvoa eikä sivuvaikutusta.
//
// Ajetaan: node --test src/guard/mobiili/sovellusvuoro.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

import { kaynnistaSovelluksessa, onAlustaJollaSovellus, paataSovelluksessa } from './sovellusvuoro.ts';

const VUORO = { kohdeId: 'kohde-1', kohdeNimi: 'Testikohde', alkoi: '2026-09-10T06:00:00.000Z' };

const ANDROID_SELAIN = 'Mozilla/5.0 (Linux; Android 13; Jelly Star) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const TYOPOYTA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

// Kevyt selainympäristö. Vain ne kolme asiaa joita moduuli koskee: display-mode-kysely,
// location.href ja userAgent.
function ymparisto({ standalone = false, userAgent = ANDROID_SELAIN, heitaHrefissa = false } = {}) {
  const avatut: string[] = [];
  const win = {
    matchMedia: (kysely: string) => ({ matches: standalone && kysely.includes('standalone') }),
    navigator: { userAgent },
    location: {
      set href(arvo: string) {
        if (heitaHrefissa) throw new Error('selain esti skeeman');
        avatut.push(arvo);
      },
    },
  };
  // defineProperty eikä sijoitus: Nodessa globalThis.navigator on vain luettava.
  const aseta = (nimi: string, arvo: unknown) =>
    Object.defineProperty(globalThis, nimi, { value: arvo, configurable: true, writable: true });
  aseta('window', win);
  aseta('navigator', win.navigator);
  return avatut;
}

test.afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).navigator;
});

test('asennetussa sovelluksessa vuoro välittyy', () => {
  const avatut = ymparisto({ standalone: true });
  assert.equal(kaynnistaSovelluksessa(VUORO), 'avattu');
  assert.equal(avatut.length, 1);
  assert.match(avatut[0], /^turvajohto-guard:\/\/vuoro\?id=kohde-1&nimi=Testikohde$/);
});

test('selainvälilehdessä vuoro EI välity, ja se kerrotaan', () => {
  // Tämä on 10.9.2026: puhelin, oikea tunnus, oikea kohde — mutta selain eikä sovellus.
  // Ennen korjausta tämä palautti undefinedin eikä kutsuja voinut tietää mitään.
  const avatut = ymparisto({ standalone: false });
  assert.equal(kaynnistaSovelluksessa(VUORO), 'ei_tavoitettu');
  assert.equal(avatut.length, 0);
});

test('estetty skeema on yhtä lailla tavoittamatta jäänyt', () => {
  ymparisto({ standalone: true, heitaHrefissa: true });
  assert.equal(kaynnistaSovelluksessa(VUORO), 'ei_tavoitettu');
});

test('kohteen nimi koodataan osoitteeseen', () => {
  const avatut = ymparisto({ standalone: true });
  kaynnistaSovelluksessa({ ...VUORO, kohdeNimi: 'Kohde & Piha 1/2' });
  assert.match(avatut[0], /nimi=Kohde%20%26%20Piha%201%2F2/);
});

test('päättäminen kertoo saman', () => {
  const avatut = ymparisto({ standalone: true });
  assert.equal(paataSovelluksessa(), 'avattu');
  assert.equal(avatut[0], 'turvajohto-guard://paata');
  ymparisto({ standalone: false });
  assert.equal(paataSovelluksessa(), 'ei_tavoitettu');
});

test('varoitetaan vain siellä missä sovellus on olemassa', () => {
  ymparisto({ userAgent: ANDROID_SELAIN });
  assert.equal(onAlustaJollaSovellus(), true);
  // Työpöydällä vuoro on käyttöliittymän tila eikä valvontaa: varoitus olisi melua.
  ymparisto({ userAgent: TYOPOYTA });
  assert.equal(onAlustaJollaSovellus(), false);
});
