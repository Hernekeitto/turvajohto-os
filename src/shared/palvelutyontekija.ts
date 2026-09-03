// Palvelutyöntekijän rekisteröinti ja päivityksen hallinta.
//
// Rekisteröidään VAIN tuotantobuildissa. Kehityksessä palvelutyöntekijä tarjoilisi
// vanhaa nippua välimuistista ja rikkoisi Viten kuumavaihdon niin, että selain näyttäisi
// eri koodia kuin editorissa on — se on omalla tavallaan pahin mahdollinen bugi, koska
// se saa epäilemään omaa muutostaan.
//
// Päivitys ei tapahdu itsestään. Uusi versio jää odottamaan (`waiting`), ja sovellus
// kysyy käyttäjältä: kesken oleva kirjaus katoaisi sivunlatauksessa, ja kentällä se
// tarkoittaisi että juuri kirjoitettu havainto on kirjoitettava uudelleen.

export type PaivitysTila = {
  // Uusi versio on ladattu ja odottaa käyttöönottoa.
  saatavilla: boolean;
  // Ottaa uuden version käyttöön ja lataa sivun uudelleen.
  otaKayttoon: () => void;
};

type Kuuntelija = (tila: { saatavilla: boolean }) => void;

let odottava: ServiceWorker | null = null;
const kuuntelijat = new Set<Kuuntelija>();

const kerro = () => {
  for (const kuuntelija of kuuntelijat) kuuntelija({ saatavilla: odottava !== null });
};

export function kuuntelePaivitysta(kuuntelija: Kuuntelija) {
  kuuntelijat.add(kuuntelija);
  kuuntelija({ saatavilla: odottava !== null });
  return () => { kuuntelijat.delete(kuuntelija); };
}

export function otaPaivitysKayttoon() {
  if (!odottava) return;
  // Palvelutyöntekijä vaihtaa itsensä käyttöön ja controllerchange lataa sivun.
  odottava.postMessage('ota-kayttoon');
}

export function rekisteroiPalvelutyontekija() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((rekisterointi) => {
      // Jo odottava versio (käyttäjä on käynyt sivulla aiemmin uuden buildin jälkeen).
      if (rekisterointi.waiting && navigator.serviceWorker.controller) {
        odottava = rekisterointi.waiting;
        kerro();
      }

      rekisterointi.addEventListener('updatefound', () => {
        const uusi = rekisterointi.installing;
        if (!uusi) return;
        uusi.addEventListener('statechange', () => {
          // controller on null ensimmäisellä asennuksella: silloin kyse ei ole
          // päivityksestä vaan siitä että sovellus tallennettiin laitteelle
          // ensimmäistä kertaa, eikä siitä pidä kysyä mitään.
          if (uusi.state === 'installed' && navigator.serviceWorker.controller) {
            odottava = uusi;
            kerro();
          }
        });
      });

      // Tarkistetaan päivitys myös kun sovellus palaa näkyviin. Kentällä sovellus voi
      // olla auki vuorokausia ilman uudelleenlatausta.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') rekisterointi.update().catch(() => {});
      });
    }).catch(() => {
      // Rekisteröinnin epäonnistuminen ei saa kaataa sovellusta: se toimii ilman
      // offline-tukea täsmälleen kuten ennenkin.
    });

    let ladataan = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (ladataan) return;
      ladataan = true;
      window.location.reload();
    });
  });
}
