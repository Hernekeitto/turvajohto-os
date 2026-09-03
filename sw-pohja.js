// Palvelutyöntekijän pohja. Vite-lisäosa (vite.config.ts) korvaa tästä kaksi
// paikkamerkkiä buildissa ja kirjoittaa tuloksen tiedostoksi dist/sw.js.
//
// TÄTÄ TIEDOSTOA EI KÄÄNNETÄ eikä pakata: palvelutyöntekijä ajetaan omassa
// ympäristössään ilman moduulinippua, ja sen on oltava luettavissa sellaisenaan.
// Siksi tässä ei ole importteja eikä TypeScriptiä.
//
// --- Miksi oma lisäosa eikä valmis kirjasto ---------------------------------------
//
// Workbox tai vite-plugin-pwa tekisi tämän, mutta toisi mukanaan satoja kilotavuja
// koodia ja oman käsitteistönsä ongelmaan joka on tässä sovelluksessa pieni: yksi
// sovellusrunko, ei kuvagalleriaa, ei taustasynkronointia. Sama perustelu kuin
// PDF-tulostuksessa, EXIF-lukijassa ja QR-koodeissa — kirjasto otetaan kun ongelma on
// kirjaston kokoinen.
//
// --- Kolme sääntöä ----------------------------------------------------------------
//
// 1. API-PYYNTÖJÄ EI VÄLIMUISTITETA KOSKAAN. Ne ovat käyttäjäkohtaisia ja muuttuvia, ja
//    laitteelle jäävä kopio olisi kadonneessa puhelimessa tietovuoto. Kuluvan vuoron
//    työtiedot tallennetaan erikseen sovelluksen omaan varastoon (erä 6 osa 4), jossa
//    voidaan päättää tarkasti mitä säilytetään ja kuinka kauan.
//
// 2. HASHATUT TIEDOSTOT OVAT MUUTTUMATTOMIA. Vite antaa jokaiselle nipulle sisällön
//    mukaisen nimen, joten samannimisen tiedoston sisältö ei voi koskaan muuttua:
//    ne haetaan välimuistista suoraan eikä verkkoa kysytä lainkaan.
//
// 3. HTML HAETAAN ENSIN VERKOSTA, mutta lyhyellä aikakatkaisulla. Sivunlataus on ainoa
//    kohta jossa uusi versio voidaan huomata, joten sitä ei saa lukita välimuistiin —
//    mutta kentällä verkko voi olla auki ja silti hyödytön, ja silloin odottaminen on
//    pahempi kuin hieman vanha runko.

const VERSIO = '__VERSIO__';
const TIEDOSTOT = __TIEDOSTOT__;

const VARASTO = 'turvajohto-' + VERSIO;

// Kuinka kauan verkkoa odotetaan sivunlatauksessa ennen kuin turvaudutaan välimuistiin.
// Kolme sekuntia on kompromissi: tarpeeksi hitaalle mutta toimivalle yhteydelle,
// tarpeeksi lyhyt jottei ruutu jää tyhjäksi ruuhkautuneessa verkossa.
const HTML_AIKAKATKAISU_MS = 3000;

self.addEventListener('install', (tapahtuma) => {
  tapahtuma.waitUntil(
    caches.open(VARASTO).then((varasto) => varasto.addAll(TIEDOSTOT))
  );
  // EI skipWaiting-kutsua tässä. Uusi versio jää odottamaan, ja sovellus kysyy
  // käyttäjältä ennen vaihtoa: kesken olevan kirjauksen katoaminen sivunlatauksen
  // takia olisi pahempi kuin päivityksen viivästyminen muutamalla minuutilla.
});

self.addEventListener('activate', (tapahtuma) => {
  tapahtuma.waitUntil(
    caches.keys()
      .then((nimet) => Promise.all(
        nimet.filter((n) => n.startsWith('turvajohto-') && n !== VARASTO)
          .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// Sovellus pyytää vaihtoa kun käyttäjä on hyväksynyt päivityksen.
self.addEventListener('message', (tapahtuma) => {
  if (tapahtuma.data === 'ota-kayttoon') self.skipWaiting();
});

const onHtmlPyynto = (pyynto) =>
  pyynto.mode === 'navigate'
  || (pyynto.headers.get('accept') || '').includes('text/html');

async function verkostaTaiVarastosta(pyynto) {
  const ohjain = new AbortController();
  const ajastin = setTimeout(() => ohjain.abort(), HTML_AIKAKATKAISU_MS);
  try {
    const vastaus = await fetch(pyynto, { signal: ohjain.signal });
    clearTimeout(ajastin);
    // Tallennetaan tuore runko: seuraava lataus toimii verkotta.
    if (vastaus && vastaus.ok) {
      const varasto = await caches.open(VARASTO);
      varasto.put('/index.html', vastaus.clone());
    }
    return vastaus;
  } catch {
    clearTimeout(ajastin);
    const varastoitu = await caches.match('/index.html');
    if (varastoitu) return varastoitu;
    // Ei runkoa välimuistissa eikä verkkoa: kerrotaan se suoraan eikä anneta selaimen
    // oman virhesivun väittää että sovellus on rikki.
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Ei yhteyttä</title>'
      + '<body style="font-family:sans-serif;padding:2rem">'
      + '<h1>Ei yhteyttä</h1><p>Turvajohto OS ei ole vielä tallentunut tähän laitteeseen. '
      + 'Avaa sovellus kerran verkossa, niin se toimii jatkossa myös ilman yhteyttä.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

self.addEventListener('fetch', (tapahtuma) => {
  const pyynto = tapahtuma.request;
  if (pyynto.method !== 'GET') return;

  const osoite = new URL(pyynto.url);
  // Vain oma alkuperä. Ulkopuoliset pyynnöt eivät kuulu tänne (eikä CSP niitä salli).
  if (osoite.origin !== self.location.origin) return;
  // Sääntö 1: API ei koskaan välimuistiin. Myös kanava (WebSocket) ohitetaan.
  if (osoite.pathname.startsWith('/api/')) return;

  if (onHtmlPyynto(pyynto)) {
    tapahtuma.respondWith(verkostaTaiVarastosta(pyynto));
    return;
  }

  // Sääntö 2: hashatut tiedostot välimuistista suoraan.
  tapahtuma.respondWith(
    caches.match(pyynto).then((varastoitu) => {
      if (varastoitu) return varastoitu;
      return fetch(pyynto).then((vastaus) => {
        // Uusi buildi voi pyytää tiedostoa jota ei ollut asennushetkellä (esim.
        // laiskasti ladattava nippu). Tallennetaan se, jotta se on offline saatavilla.
        if (vastaus && vastaus.ok && vastaus.type === 'basic') {
          const kopio = vastaus.clone();
          caches.open(VARASTO).then((varasto) => varasto.put(pyynto, kopio));
        }
        return vastaus;
      });
    })
  );
});
