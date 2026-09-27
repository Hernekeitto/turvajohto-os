import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import { lataaKarttakirjasto, KARTAN_ASETUKSET, type MapLibreMap } from './lataa';
import { ympyra } from './merkit';
import { karttatyyli } from './tyyli';

// Kohteen sijainnin valinta kartalta: osoitehaku, klikkaus ja raahattava merkki, ja
// hälytyssäde ympyränä merkin ympärillä.
//
// YMPYRÄ ON SAMA SÄDE JOLLA PALVELIN KOHDENTAA (server/halytystehtava.js: etaisyysKm,
// OLETUS_SADE_KM). Siksi puuttuva säde piirretään oletuksena eikä jätetä piirtämättä:
// palvelin käyttää silloin viittä kilometriä, ja kartan on näytettävä se mitä
// tapahtuu eikä sitä mitä kenttään on kirjoitettu.

export const OLETUS_SADE_KM = 5;

type Gps = { lat: number; lon: number };

type Tulos = { nimi: string; lat: number; lon: number };

type Props = {
  gps?: Gps;
  sadeKm?: number;
  // Lomakkeen osoitekenttä hakutekstin lähtöarvoksi — kohteen osoite on jo kirjoitettu
  // ylempänä, eikä sitä kuulu kirjoittaa toista kertaa.
  osoite?: string;
  onValitse: (gps: Gps) => void;
  saaMuokata: boolean;
};

const TYHJA = { type: 'FeatureCollection', features: [] };

function sadeGeoJson(gps: Gps | undefined, sadeKm: number) {
  if (!gps) return TYHJA;
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ympyra(gps, sadeKm * 1000, 96)] },
    }],
  };
}

// Näkymä joka mahtuu säteen sisään: koko ympyrä näkyy kerralla, jotta käyttäjä näkee
// mitkä kaupunginosat tai kunnat säde kattaa.
function sadeRajat(gps: Gps, sadeKm: number): [[number, number], [number, number]] {
  const dLat = sadeKm / 110.54;
  const dLon = sadeKm / (111.32 * Math.cos((gps.lat * Math.PI) / 180));
  return [[gps.lon - dLon, gps.lat - dLat], [gps.lon + dLon, gps.lat + dLat]];
}

type KarttaApi = MapLibreMap & {
  getSource: (id: string) => { setData: (d: unknown) => void } | undefined;
  fitBounds: (r: unknown, o: unknown) => void;
  getCanvas: () => HTMLCanvasElement;
};

export const KohteenSijaintikartta = ({ gps, sadeKm, osoite, onValitse, saaMuokata }: Props) => {
  const sailioRef = useRef<HTMLDivElement | null>(null);
  const karttaRef = useRef<KarttaApi | null>(null);
  const merkkiRef = useRef<{ setLngLat: (p: [number, number]) => unknown; remove: () => void } | null>(null);
  // Käsittelijät viitteessä: kartta luodaan kerran, mutta onValitse vaihtuu jokaisella
  // lomakkeen renderöinnillä. Suljettu vanha käsittelijä kirjoittaisi vanhentuneen
  // kohteen päälle ja pyyhkisi juuri tehdyt muutokset.
  const onValitseRef = useRef(onValitse);
  onValitseRef.current = onValitse;

  const [tila, setTila] = useState<'lataa' | 'valmis' | 'virhe'>('lataa');
  const [haku, setHaku] = useState(osoite || '');
  const [hakee, setHakee] = useState(false);
  const [tulokset, setTulokset] = useState<Tulos[] | null>(null);
  const [hakuvirhe, setHakuvirhe] = useState<string | null>(null);

  const sade = sadeKm && sadeKm > 0 ? sadeKm : OLETUS_SADE_KM;

  useEffect(() => {
    let purettu = false;
    lataaKarttakirjasto()
      .then((maplibre) => {
        if (purettu || !sailioRef.current || karttaRef.current) return;
        const kartta = new maplibre.Map({
          container: sailioRef.current,
          ...KARTAN_ASETUKSET,
          ...(gps ? { center: [gps.lon, gps.lat], zoom: 11 } : { center: [25.5, 62.5], zoom: 4.5 }),
          style: karttatyyli(),
        } as never) as KarttaApi;
        karttaRef.current = kartta;

        kartta.on('error', () => setTila('virhe'));
        kartta.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

        kartta.once('load', () => {
          if (purettu) return;
          kartta.addSource('sade', { type: 'geojson', data: TYHJA } as never);
          kartta.addLayer({
            id: 'sade-tayte', type: 'fill', source: 'sade',
            paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.12 },
          } as never);
          kartta.addLayer({
            id: 'sade-reuna', type: 'line', source: 'sade',
            paint: { 'line-color': '#38bdf8', 'line-opacity': 0.8, 'line-width': 2, 'line-dasharray': [3, 2] },
          } as never);
          setTila('valmis');
        });

        if (saaMuokata) {
          kartta.getCanvas().style.cursor = 'crosshair';
          kartta.on('click', (e: { lngLat: { lat: number; lng: number } }) => {
            onValitseRef.current({ lat: pyorista(e.lngLat.lat), lon: pyorista(e.lngLat.lng) });
          });
        }
      })
      .catch(() => { if (!purettu) setTila('virhe'); });

    return () => {
      purettu = true;
      merkkiRef.current?.remove();
      merkkiRef.current = null;
      karttaRef.current?.remove();
      karttaRef.current = null;
    };
    // Kartta luodaan kerran. gps on vain aloitusnäkymä; myöhemmät muutokset siirtävät
    // merkkiä alla olevassa efektissä eivätkä luo karttaa uudelleen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saaMuokata]);

  // Merkki ja ympyrä seuraavat lomakkeen arvoa. Lähde on aina lomake, ei kartan oma
  // tila: myös käsin kirjoitettu koordinaatti siirtää merkkiä.
  // Riippuvuutena luvut eikä olio: lomake luo uuden gps-olion jokaisella muutoksella,
  // myös silloin kun sijainti ei muuttunut.
  const lat = gps?.lat;
  const lon = gps?.lon;
  useEffect(() => {
    const kartta = karttaRef.current;
    if (!kartta || tila !== 'valmis') return;
    const piste = lat !== undefined && lon !== undefined ? { lat, lon } : undefined;
    (kartta.getSource('sade') as { setData: (d: unknown) => void } | undefined)?.setData(sadeGeoJson(piste, sade));

    let peruttu = false;
    lataaKarttakirjasto().then((maplibre) => {
      if (peruttu) return;
      if (!piste) {
        merkkiRef.current?.remove();
        merkkiRef.current = null;
        return;
      }
      if (!merkkiRef.current) {
        const merkki = new maplibre.Marker({ color: '#ef4444', draggable: saaMuokata })
          .setLngLat([piste.lon, piste.lat])
          .addTo(kartta as never);
        merkki.on('dragend', () => {
          const p = merkki.getLngLat();
          onValitseRef.current({ lat: pyorista(p.lat), lon: pyorista(p.lng) });
        });
        merkkiRef.current = merkki as never;
      } else {
        merkkiRef.current.setLngLat([piste.lon, piste.lat]);
      }
    });
    return () => { peruttu = true; };
  }, [lat, lon, sade, tila, saaMuokata]);

  const nayta = (p: Gps) => {
    karttaRef.current?.fitBounds(sadeRajat(p, sade), { padding: 30, maxZoom: 15, duration: 600 });
  };

  const hae = async () => {
    const teksti = haku.trim();
    if (teksti.length < 3) {
      setHakuvirhe('Kirjoita vähintään kolme merkkiä.');
      return;
    }
    setHakee(true);
    setHakuvirhe(null);
    setTulokset(null);
    try {
      const vastaus = await fetch(`/api/osoitehaku?q=${encodeURIComponent(teksti)}`, { credentials: 'include' });
      const data = await vastaus.json().catch(() => null);
      if (!vastaus.ok || !data?.ok) throw new Error(data?.error || 'Haku epäonnistui.');
      const lista: Tulos[] = data.tulokset || [];
      if (lista.length === 0) {
        setHakuvirhe('Osoitetta ei löytynyt. Tarkenna hakua tai klikkaa kohde kartalle.');
      } else if (lista.length === 1) {
        valitseTulos(lista[0]);
      } else {
        setTulokset(lista);
      }
    } catch (e: any) {
      setHakuvirhe(e?.message || 'Haku epäonnistui.');
    } finally {
      setHakee(false);
    }
  };

  const valitseTulos = (t: Tulos) => {
    setTulokset(null);
    onValitse({ lat: t.lat, lon: t.lon });
    nayta(t);
  };

  return (
    <div className="space-y-2">
      {saaMuokata && (
        <form
          onSubmit={(e) => { e.preventDefault(); hae(); }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={haku}
            onChange={(e) => setHaku(e.target.value)}
            placeholder="Hae osoitteella, esim. Hämeenkatu 1, Tampere"
            className="flex-1 min-w-0 rounded-lg border border-line-soft p-2 text-sm"
          />
          <button
            type="submit"
            disabled={hakee}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-accent text-surface disabled:bg-line-soft disabled:text-ink-muted text-xs font-bold rounded-lg"
          >
            <Search size={14} />
            {hakee ? 'Haetaan…' : 'Hae'}
          </button>
        </form>
      )}

      {hakuvirhe && <p className="text-xs text-danger">{hakuvirhe}</p>}

      {tulokset && (
        <ul className="border border-line-soft rounded-lg divide-y divide-line-soft bg-surface">
          {tulokset.map((t, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => valitseTulos(t)}
                className="w-full text-left px-3 py-2 text-sm text-ink-body hover:bg-surface-muted"
              >
                {t.nimi}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative w-full rounded-lg overflow-hidden border border-line" style={{ height: 360 }}>
        {/* Sijoittelu tyyliattribuutissa, ks. GuardKartta: maplibren laiskasti ladattu
            tyylitiedosto voittaisi Tailwindin absolute-luokan. */}
        <div ref={sailioRef} data-testid="kohdekartta-sailio" style={{ position: 'absolute', inset: 0 }} />
        {tila === 'lataa' && (
          <div className="absolute inset-0 flex items-center justify-center bg-sunken text-sm text-ink-muted">
            Ladataan karttaa…
          </div>
        )}
        {tila === 'virhe' && (
          <div className="absolute inset-0 flex items-center justify-center bg-danger-soft p-6 text-center">
            <p className="text-sm text-danger-ink">
              Karttaa ei voitu näyttää. Sijainnin voi yhä antaa koordinaatteina alla.
            </p>
          </div>
        )}
      </div>

      {saaMuokata && (
        <p className="text-xs text-ink-muted">
          {gps
            ? 'Siirrä sijaintia klikkaamalla karttaa tai raahaamalla merkkiä.'
            : 'Hae osoitteella tai klikkaa kohteen sijainti kartalle.'}
          {' '}Katkoviivainen ympyrä näyttää hälytysten välityssäteen ({String(sade).replace('.', ',')} km).
        </p>
      )}
    </div>
  );
};

// Kuusi desimaalia on noin 10 cm. Enempää ei klikkauksesta saa, ja pidempi luku näyttää
// koordinaattikentässä tarkemmalta kuin se on.
function pyorista(x: number) {
  return Math.round(x * 1e6) / 1e6;
}
