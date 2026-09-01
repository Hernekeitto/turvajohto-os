// Oman sijainnin lähetys kanavaa pitkin. Malli V6.1 b: päivitys jokaisen toiminnon
// yhteydessä ja tiheämmin kun sovellus on näkyvissä.
//
// Miksi näin eikä taustaseurantana: selain ei voi paikantaa taustalla lukitulla
// näytöllä. iOS keskeyttää heti, Android muutamassa minuutissa. Jatkuvaa
// taustaseurantaa lupaava toteutus näyttäisi toimivan kehittäjän pöydällä ja pettäisi
// kentällä juuri silloin kun puhelin on taskussa — siksi TIKE näkee VIIMEKSI TIEDETYN
// sijainnin ja sen iän, ei "nykyistä" sijaintia.
//
// Lupaa ei kysytä jos seuranta on pois päältä. Turha paikannuslupapyyntö on sekä
// tarpeeton että se opettaa käyttäjän klikkaamaan lupakyselyt läpi katsomatta.

import { useEffect, useRef } from 'react';

// Kuinka usein sijainti päivitetään kun sovellus on näkyvissä. Minuutti on kompromissi:
// tiheämpi kuluttaa akkua ilman että TIKE saa siitä mitään lisää, harvempi tekee
// "lähimmän vartijan haku" -toiminnosta arvauksen.
const VALI_NAKYVISSA_MS = 60_000;

type Args = {
  kaytossa: boolean;
  eventId: string | null;
  laheta: (viesti: Record<string, unknown>) => boolean;
};

export function useSijainninLahetys({ kaytossa, eventId, laheta }: Args) {
  // Viimeisin lähetys refissä, jotta toiminnon yhteydessä tehtävä päivitys ei ammu
  // paikannusta uudestaan sekunnin välein jos käyttäjä tallentaa monta kirjausta putkeen.
  const viimeksi = useRef(0);

  useEffect(() => {
    if (!kaytossa) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let purettu = false;

    const paivita = (pakota = false) => {
      const nyt = Date.now();
      if (!pakota && nyt - viimeksi.current < 10_000) return;
      viimeksi.current = nyt;
      navigator.geolocation.getCurrentPosition(
        (sijainti) => {
          if (purettu) return;
          laheta({
            tyyppi: 'sijainti',
            eventId,
            gps: {
              lat: sijainti.coords.latitude,
              lon: sijainti.coords.longitude,
              tarkkuus: sijainti.coords.accuracy,
            },
          });
        },
        () => {
          // Lupa evätty tai paikannus epäonnistui. Ei virheilmoitusta: sijainnin
          // jakaminen on vapaaehtoista, eikä kieltäytymisestä pidä huomauttaa joka
          // minuutti.
        },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 }
      );
    };

    paivita(true);
    let ajastin = window.setInterval(() => {
      if (document.visibilityState === 'visible') paivita();
    }, VALI_NAKYVISSA_MS);

    // Näkyviin palaaminen on itsessään toiminto: käyttäjä otti puhelimen taskusta, ja
    // juuri silloin edellinen sijainti on todennäköisimmin vanhentunut.
    const nakyvyys = () => {
      if (document.visibilityState === 'visible') paivita(true);
    };
    document.addEventListener('visibilitychange', nakyvyys);

    return () => {
      purettu = true;
      window.clearInterval(ajastin);
      document.removeEventListener('visibilitychange', nakyvyys);
    };
  }, [kaytossa, eventId, laheta]);
}

// Sijainnin ikä ihmisluettavana. TIKE:n on nähtävä ikä yhtä selvästi kuin paikka:
// "Portti 3" ilman aikaa antaisi ymmärtää että henkilö on siellä nyt.
export const ikaTekstina = (ikaMs: number) => {
  const minuutit = Math.floor(ikaMs / 60_000);
  if (minuutit < 1) return 'juuri nyt';
  if (minuutit === 1) return '1 min sitten';
  if (minuutit < 60) return `${minuutit} min sitten`;
  const tunnit = Math.floor(minuutit / 60);
  return tunnit === 1 ? 'yli tunti sitten' : `${tunnit} h sitten`;
};
