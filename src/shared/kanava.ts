// Kanavayhteys palvelimeen (WebSocket). Jaettu: molemmat puolet tarvitsevat saman
// yhteyden, eikä kahta rinnakkaista yhteyttä samaan istuntoon kannata avata.
//
// Kanava kertoo VAIN mikä kokoelma muuttui ja mitkä id:t. Sisältö haetaan normaalilla
// GET-pyynnöllä, joka käy läpi saman oikeustarkistuksen kuin ennenkin — ks.
// server/kanava.js:n sama perustelu. Tämän tiedoston tehtävä on siis herättää haku, ei
// tuoda dataa.

import { useEffect, useRef, useState } from 'react';

export type Muutos = { action: 'create' | 'update' | 'delete'; id: string; eventId: string | null };

export type Sijainti = {
  username: string;
  // Nimimerkki. Valinnainen, koska kanavan työntämä sijainti tulee suoraan
  // sijaintikerroksesta eikä käy käyttäjärekisterin kautta — listahaku täydentää sen.
  nimi?: string;
  eventId: string | null;
  img: { x: number; y: number } | null;
  gps: {
    lat: number;
    lon: number;
    tarkkuus: number | null;
    // Nopeus (m/s) ja kulkusuunta (astetta, 0 = pohjoinen). Molemmat voivat puuttua:
    // laite antaa ne vain liikkeessä, ja tukiasemapaikannus ei koskaan.
    nopeus?: number | null;
    suunta?: number | null;
  } | null;
  at: number;
  ikaMs: number;
  // Tuliko päivitys selaimesta vai natiivisovelluksesta. Vastaa käyttöliittymässä
  // kysymykseen "miksi tämä piste on vanha": selain paikantaa vain näkyvissä ollessaan.
  // Valinnainen, koska vanhemmat palvelinversiot eivät lähetä kenttää.
  lahde?: 'selain' | 'laite';
};

export type KanavaViesti =
  | { tyyppi: 'tervetuloa'; kayttaja: string }
  | { tyyppi: 'muutos'; kokoelma: string; muutokset: Muutos[] }
  | { tyyppi: 'sijainnit'; eventId: string | null; sijainnit: Sijainti[] };

type Kasittelijat = {
  onMuutos?: (kokoelma: string, muutokset: Muutos[]) => void;
  onSijainnit?: (sijainnit: Sijainti[]) => void;
};

// Uudelleenyhdistys kasvavalla viiveellä. Kiinteä lyhyt viive tarkoittaisi sitä, että
// palvelimen uudelleenkäynnistyksen aikana jokainen avoin selain hakkaa sitä sekunnin
// välein juuri kun se yrittää nousta pystyyn.
const VIIVE_MIN_MS = 1_000;
const VIIVE_MAX_MS = 30_000;

const kanavanOsoite = () => {
  const protokolla = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protokolla}//${window.location.host}/api/kanava`;
};

export function useKanava(kasittelijat: Kasittelijat) {
  const [yhdistetty, setYhdistetty] = useState(false);
  // Käsittelijät refissä: yhteyttä EI saa avata uudelleen joka kerta kun kutsuja
  // renderöityy ja antaa uudet funktiot. Ilman tätä jokainen renderöinti katkaisisi ja
  // avaisi soketin uudelleen.
  const kasittelija = useRef(kasittelijat);
  kasittelija.current = kasittelijat;
  // Auki oleva soketti lähettämistä varten. Refissä samasta syystä: lähetysfunktion
  // identiteetti ei saa muuttua joka renderillä, koska sitä käytetään useEffectien
  // riippuvuutena.
  const soketti = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let ajastin: ReturnType<typeof setTimeout> | null = null;
    let viive = VIIVE_MIN_MS;
    let suljettu = false;

    const yhdista = () => {
      if (suljettu) return;
      try {
        ws = new WebSocket(kanavanOsoite());
      } catch {
        uudelleen();
        return;
      }

      ws.onopen = () => {
        viive = VIIVE_MIN_MS;
        soketti.current = ws;
        setYhdistetty(true);
      };

      ws.onmessage = (e) => {
        let viesti: KanavaViesti;
        try {
          viesti = JSON.parse(e.data);
        } catch {
          return;
        }
        if (viesti?.tyyppi === 'muutos' && viesti.kokoelma) {
          kasittelija.current.onMuutos?.(viesti.kokoelma, viesti.muutokset || []);
        } else if (viesti?.tyyppi === 'sijainnit') {
          kasittelija.current.onSijainnit?.(viesti.sijainnit || []);
        }
      };

      ws.onclose = () => {
        soketti.current = null;
        setYhdistetty(false);
        uudelleen();
      };

      // Virhe johtaa aina myös oncloseen, joten uudelleenyhdistys hoidetaan siellä.
      ws.onerror = () => {};
    };

    const uudelleen = () => {
      if (suljettu || ajastin) return;
      ajastin = setTimeout(() => {
        ajastin = null;
        viive = Math.min(viive * 2, VIIVE_MAX_MS);
        yhdista();
      }, viive);
    };

    yhdista();

    return () => {
      suljettu = true;
      if (ajastin) clearTimeout(ajastin);
      // onclose nollataan ennen sulkemista, jottei purkautuva komponentti käynnistä
      // uudelleenyhdistystä.
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      soketti.current = null;
    };
  }, []);

  // Lähetys kentältä palvelimelle. Hiljainen ei-mitään jos yhteyttä ei ole: sijainti on
  // hetkellinen tieto, ja jonoon jäänyt vanha sijainti kertoisi missä joku oli silloin
  // kun verkko katkesi — se on huonompi tieto kuin ei tietoa lainkaan.
  const laheta = useRef((viesti: Record<string, unknown>) => {
    const ws = soketti.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(viesti));
      return true;
    } catch {
      return false;
    }
  }).current;

  return { yhdistetty, laheta };
}
