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
  // Muunnos GPS-sijainnista kohdaksi pohjakuvalla (ks. georeferointi.ts). Valinnainen:
  // ilman kalibrointia sijainti lähtee pelkkänä GPS:nä, jolloin se näkyy listoissa ja
  // lähimmän haussa muttei kartalla eikä vyöhykesäännöissä.
  //
  // Kuvakoordinaatti lasketaan TÄÄLLÄ eikä palvelimella, koska sama muunnos tarvitaan
  // joka tapauksessa kartan piirtämiseen. Kaksi toteutusta erkanisi toisistaan, ja
  // silloin henkilö näkyisi kartalla eri paikassa kuin missä vyöhykehälytys väittää
  // hänen olleen.
  muunnos?: ((gps: { lat: number; lon: number }) => { x: number; y: number } | null) | null;
};

export function useSijainninLahetys({ kaytossa, eventId, laheta, muunnos = null }: Args) {
  // Viimeisin lähetys refissä, jotta toiminnon yhteydessä tehtävä päivitys ei ammu
  // paikannusta uudestaan sekunnin välein jos käyttäjä tallentaa monta kirjausta putkeen.
  const viimeksi = useRef(0);
  // Muunnos refissä samasta syystä kuin kanavan käsittelijät: luoMuunnos palauttaa uuden
  // funktion joka renderillä, ja riippuvuutena se käynnistäisi paikannuksen alusta joka
  // kerta kun mikä tahansa komponentin tila muuttuu.
  const muunnosRef = useRef(muunnos);
  muunnosRef.current = muunnos;

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
          const gps = {
            lat: sijainti.coords.latitude,
            lon: sijainti.coords.longitude,
            tarkkuus: sijainti.coords.accuracy,
            // Selain antaa nopeuden ja suunnan samasta mittauksesta kun laite liikkuu ja
            // nullin kun se ei liiku. Lähetetään ne samassa muodossa kuin natiivi, jotta
            // kartta piirtää saman nuolen riippumatta siitä kummasta päivitys tuli —
            // palvelin hylkää epäkelvot arvot (server/sijainti.js).
            nopeus: sijainti.coords.speed,
            suunta: sijainti.coords.heading,
          };
          const img = muunnosRef.current ? muunnosRef.current(gps) : null;
          laheta({ tyyppi: 'sijainti', eventId, gps, ...(img ? { img } : {}) });
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
