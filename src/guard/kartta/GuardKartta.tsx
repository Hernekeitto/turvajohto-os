// Hälytyskeskuksen kartta: yksiköt ja kohteet maantieteellisellä pohjalla.
//
// ERI KOMPONENTTI KUIN shared/komponentit/Kartta.tsx, eikä sen laajennus. Se on
// pohjakuva jonka koordinaatisto on 0–1 osuutta kuvasta; tämä on lat/lon. Yhdistäminen
// tuottaisi komponentin joka on väärässä puolet ajasta, ja kohteen pohjakuva on yhä
// oikea esitys silloin kun katsotaan yhtä kiinteistöä. Ne ovat saman kartan kaksi
// zoom-tasoa, eivät kilpailijoita.
//
// TILA ON maplibrella EIKÄ Reactilla. Kartta on imperatiivinen olio joka omistaa oman
// canvaksensa; jokainen yritys hallita sen sisältöä Reactin renderöinnillä johtaisi
// siihen että karttaa rakennetaan uudelleen joka kerta kun mikä tahansa propsi muuttuu —
// ja sijainnit muuttuvat minuutin välein. Siksi komponentti luo kartan kerran ja
// päivittää merkit efektissä.

import { useEffect, useRef, useState } from 'react';

import { TILAN_KIRJAIN, TILAN_NIMI, TILAN_VARI } from '../yksikontila';
import { lataaKarttakirjasto, KARTAN_ASETUKSET, type MapLibreMap } from './lataa';
import { nayttaaSuunnan, onEpatarkka, tarkkuuskehat, type Yksikkomerkki } from './merkit';
import { karttatyyli } from './tyyli';

export type Kohdemerkki = {
  id: string;
  nimi: string;
  gps: { lat: number; lon: number };
};

type Props = {
  yksikot: Yksikkomerkki[];
  kohteet: Kohdemerkki[];
  // Seinätaulussa kartta on katsottavaksi: ei zoom-painikkeita eikä raahausta, koska
  // kukaan ei ole koskemassa siihen ja vahingossa siirretty seinätaulu jää siirretyksi
  // siihen asti kunnes joku huomaa.
  taulu?: boolean;
  onValitse?: (username: string) => void;
};

// Merkin halkaisija pikseleinä. Kaksi kokoa: seinätaulua katsotaan metrien päästä.
const KOKO = 26;
const KOKO_TAULU = 40;

export const GuardKartta = ({ yksikot, kohteet, taulu = false, onValitse }: Props) => {
  const sailioRef = useRef<HTMLDivElement | null>(null);
  const karttaRef = useRef<MapLibreMap | null>(null);
  // Merkit username-avaimella, jotta päivitys siirtää olemassa olevaa merkkiä eikä
  // poista ja luo sitä uudelleen. Uudelleenluonti vilkuttaisi koko kartan minuutin
  // välein, ja vilkkuva valvomoruutu on se jota kukaan ei jaksa katsoa.
  const merkitRef = useRef(new Map<string, { marker: unknown; juuri: HTMLDivElement }>());
  const [tila, setTila] = useState<'lataa' | 'valmis' | 'virhe'>('lataa');
  const [virheteksti, setVirheteksti] = useState('');

  // --- Kartan luonti, kerran ------------------------------------------------------
  useEffect(() => {
    let purettu = false;

    lataaKarttakirjasto()
      .then((maplibre) => {
        if (purettu || !sailioRef.current || karttaRef.current) return;
        const kartta = new maplibre.Map({
          container: sailioRef.current,
          ...KARTAN_ASETUKSET,
          style: karttatyyli(),
          interactive: !taulu,
        } as never);

        // VIITE TALTEEN HETI, ENNEN KÄSITTELIJÖITÄ. Jos tämä olisi vasta lohkon lopussa,
        // synkronisesti ajettu `valmistele()` (tyyli jo valmis, ks. alla) kutsuisi
        // setTilan ennen kuin viite on olemassa — merkkiefekti heräisi, lukisi nullin ja
        // palaisi tyhjin käsin, eikä mikään enää herättäisi sitä uudelleen. Kartta jäisi
        // ikuisesti tyhjäksi, satunnaisesti, ilman virheilmoitusta.
        karttaRef.current = kartta;

        kartta.on('error', (e: { error?: { message?: string } }) => {
          // Karttavirhe EI saa jäädä konsoliin. Valvomon ruudulla tyhjä harmaa laatikko
          // näyttää samalta kuin "kukaan ei ole kentällä", ja se on juuri se sekaannus
          // jota tämä näkymä ei saa tuottaa.
          setTila('virhe');
          setVirheteksti(String(e?.error?.message || e?.error || 'tuntematon virhe'));
        });

        // JOS KARTTA JÄÄ "LADATAAN"-TILAAN, KATSO ENSIN ONKO SIVU NÄKYVISSÄ.
        //
        // maplibre lykkää tyylin latauksen piirtoruutuun (requestAnimationFrame), eikä
        // piilossa oleva sivu saa ruutuja lainkaan. Piilotetussa välilehdessä kartta jää
        // siis ikuisesti lataukseen: `dataloading` ei laukea kertaakaan, tiiliä ei pyydetä
        // ja `error`-tapahtuma ei tule. Näkyvässä ikkunassa kaikki toimii heti.
        //
        // Tämä maksoi 15.–16.9.2026 tuntikausia väärään suuntaan: oiretta pidettiin
        // satunnaisena vikana kartassa ja epäiltiin työntekijää, CSP:tä, protokollan
        // rekisteröintiä ja kilpailutilannetta. Kaikki olivat vääriä. Mitattu syy:
        // selainpaneelin välilehti oli `document.visibilityState === 'hidden'`, ja
        // rAF-korvauksella sama sivu latautui joka kerta.
        //
        // Sivu palautuu itsestään kun se tulee näkyviin — odottava rAF laukeaa silloin —
        // joten tämä ei vaadi koodilta mitään. Se vaatii vain ettei sitä jahdata uudelleen.
        //
        // KILPAILUTILANNE: `load` VOI OLLA JO TAPAHTUNUT.
        //
        // Tyyli on paikallinen olio eikä haettava tiedosto, joten maplibre voi saada sen
        // valmiiksi ennen kuin tämä käsittelijä ehditään kiinnittää. Silloin `on('load')`
        // ei laukea koskaan, näkymään jää ikuinen "Ladataan karttaa…" eikä konsoliin tule
        // mitään.
        //
        // Vika on SATUNNAINEN ja kone­kohtainen: nopealla koneella se osuu usein,
        // hitaalla harvoin, ja juuri siksi se olisi löytynyt vasta valvomosta. Löytyi
        // kehityksessä niin että sama sivu toimi ensin ja jäi sitten lataukseen.
        //
        // Siksi tila tarkistetaan ensin ja tapahtumaa kuunnellaan vain jos on tarpeen.
        let valmisteltu = false;
        const valmistele = () => {
          if (purettu || valmisteltu) return;
          valmisteltu = true;
          kartta.addSource('tarkkuus', { type: 'geojson', data: tarkkuuskehat([]) } as never);
          kartta.addLayer({
            id: 'tarkkuus-tayte',
            type: 'fill',
            source: 'tarkkuus',
            paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.12 },
          } as never);
          kartta.addLayer({
            id: 'tarkkuus-reuna',
            type: 'line',
            source: 'tarkkuus',
            paint: { 'line-color': '#94a3b8', 'line-opacity': 0.35, 'line-width': 1 },
          } as never);
          setTila('valmis');
        };

        if ((kartta as unknown as { isStyleLoaded: () => boolean }).isStyleLoaded()) {
          valmistele();
        } else {
          kartta.once('load', valmistele);
        }

        if (!taulu) {
          kartta.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        }
      })
      .catch((e: unknown) => {
        if (purettu) return;
        setTila('virhe');
        setVirheteksti(String(e));
      });

    return () => {
      purettu = true;
      karttaRef.current?.remove();
      karttaRef.current = null;
      merkitRef.current.clear();
    };
    // Taulu-tila luo kartan uudelleen tarkoituksella: interaktiivisuutta ei voi vaihtaa
    // lennossa, ja tilan vaihto tarkoittaa käytännössä eri ikkunaa.
  }, [taulu]);

  // --- Näkymän sovitus -------------------------------------------------------------
  //
  // KIINTEÄ ALOITUSNÄKYMÄ ON VÄÄRIN. Päivystäjä avaa kartan nähdäkseen omat yksikkönsä,
  // eivätkä ne ole siellä minne vakio osoittaa: kaupungin päivystäjällä ne ovat yhdessä
  // kaupungissa, maakunnan päivystäjällä hajallaan sadan kilometrin alueella. Kiinteä
  // zoom näyttää edelliselle tyhjää ja jälkimmäiselle kasan päällekkäisiä merkkejä.
  //
  // TYÖTILASSA SOVITETAAN KERRAN, SEINÄTAULUSSA AINA. Ero on siinä kuka ohjaa näkymää:
  // työtilassa päivystäjä panoroi ja zoomaa itse, ja näkymän nykäisy takaisin joka kerta
  // kun jonkun sijainti päivittyy tekisi kartasta käyttökelvottoman. Seinätaulua ei ohjaa
  // kukaan, joten sen on seurattava tilannetta itse — muuten kaupungin toiselle laidalle
  // ajanut yksikkö katoaa ruudulta eikä kukaan ole painamassa mitään.
  const sovitettu = useRef(false);
  useEffect(() => {
    const kartta = karttaRef.current;
    if (!kartta || tila !== 'valmis') return;
    if (yksikot.length === 0 && kohteet.length === 0) return;
    if (sovitettu.current && !taulu) return;

    const pisteet = [
      ...yksikot.map((y) => [y.gps.lon, y.gps.lat] as [number, number]),
      ...kohteet.map((k) => [k.gps.lon, k.gps.lat] as [number, number]),
    ];
    const lonit = pisteet.map((p) => p[0]);
    const latit = pisteet.map((p) => p[1]);
    const rajat: [[number, number], [number, number]] = [
      [Math.min(...lonit), Math.min(...latit)],
      [Math.max(...lonit), Math.max(...latit)],
    ];

    (kartta as unknown as {
      fitBounds: (r: unknown, o: unknown) => void;
    }).fitBounds(rajat, {
      padding: 60,
      // Yläraja zoomille: yksi yksikkö yksinään sovitettaisiin muuten kadun tasolle,
      // jolloin päivystäjä ei näe mitään sen ympäriltä eikä tiedä missä päin kaupunkia
      // ollaan. Neljätoista on korttelin mittakaava.
      maxZoom: 14,
      // Ei animaatiota ensimmäisellä sovituksella: kartan avautuminen lennähdyksellä
      // Helsingistä Ouluun on efekti jota kukaan ei tilannut.
      animate: sovitettu.current,
    });
    sovitettu.current = true;
  }, [yksikot, kohteet, tila, taulu]);

  // --- Tarkkuuskehät --------------------------------------------------------------
  useEffect(() => {
    const kartta = karttaRef.current;
    if (!kartta || tila !== 'valmis') return;
    const lahde = (kartta as unknown as { getSource: (id: string) => { setData: (d: unknown) => void } | undefined })
      .getSource('tarkkuus');
    lahde?.setData(tarkkuuskehat(yksikot));
  }, [yksikot, tila]);

  // --- Yksikkömerkit --------------------------------------------------------------
  useEffect(() => {
    const kartta = karttaRef.current;
    if (!kartta || tila !== 'valmis') return;
    let peruttu = false;

    lataaKarttakirjasto().then((maplibre) => {
      if (peruttu) return;
      const nakyvat = new Set<string>();

      for (const y of yksikot) {
        nakyvat.add(y.username);
        let merkki = merkitRef.current.get(y.username);
        if (!merkki) {
          // KAKSI ELEMENTTIÄ, JA SE ON PAKKO. maplibre omistaa uloimman elementin: se
          // asettaa siihen `position`-, `transform`- ja `will-change`-arvot joka kerta kun
          // karttaa siirretään. Jos merkin ulkoasu kirjoitettaisiin siihen, jokainen
          // päivitys pyyhkisi maplibren sijoittelun ja merkit kasautuisivat kartan
          // vasempaan yläkulmaan. Me omistamme sisemmän.
          const ulko = document.createElement('div');
          const juuri = document.createElement('div');
          ulko.appendChild(juuri);
          // YKSIKKÖ PIIRTYY KOHTEEN PÄÄLLE. Kohde on kiinteä ja sen sijainti on
          // päivystäjällä tiedossa muutenkin; yksikkö liikkuu ja on se mitä kartalta
          // katsotaan. Ilman tätä kohteessa seisova vartija jää kohdemerkin alle juuri
          // silloin kun kysymys on "onko joku jo perillä".
          ulko.style.zIndex = '2';
          ulko.addEventListener('click', () => onValitse?.(y.username));
          const marker = new maplibre.Marker({ element: ulko })
            .setLngLat([y.gps.lon, y.gps.lat])
            .addTo(kartta as never);
          merkki = { marker, juuri };
          merkitRef.current.set(y.username, merkki);
        } else {
          (merkki.marker as { setLngLat: (p: [number, number]) => void })
            .setLngLat([y.gps.lon, y.gps.lat]);
        }
        piirraMerkki(merkki.juuri, y, taulu);
      }

      // Kadonneet pois. Yksikkö katoaa kun sijainti vanhenee (30 min, server/sijainti.js)
      // tai vuoro päättyy — ja silloin sen ON kadottava, koska jäänyt merkki väittäisi
      // tietävänsä missä ihminen on.
      for (const [username, merkki] of merkitRef.current) {
        if (!nakyvat.has(username)) {
          (merkki.marker as { remove: () => void }).remove();
          merkitRef.current.delete(username);
        }
      }
    });

    return () => { peruttu = true; };
  }, [yksikot, tila, taulu, onValitse]);

  // --- Kohdemerkit ----------------------------------------------------------------
  const kohdemerkitRef = useRef(new Map<string, unknown>());
  useEffect(() => {
    const kartta = karttaRef.current;
    if (!kartta || tila !== 'valmis') return;
    let peruttu = false;

    lataaKarttakirjasto().then((maplibre) => {
      if (peruttu) return;
      for (const [, m] of kohdemerkitRef.current) (m as { remove: () => void }).remove();
      kohdemerkitRef.current.clear();

      for (const k of kohteet) {
        // Sama kahden elementin sääntö kuin yksiköillä, ks. yllä.
        const ulko = document.createElement('div');
        const juuri = document.createElement('div');
        ulko.appendChild(juuri);
        ulko.style.zIndex = '1';
        juuri.title = k.nimi;
        juuri.setAttribute('aria-label', k.nimi);
        // Kohde on NELIÖ ja yksikkö ympyrä. Muoto erottaa ne toisistaan silloinkin kun
        // väri ei erota — ja kaukaa katsottuna muoto on se mikä erottuu ensin.
        juuri.style.cssText = [
          'width:12px', 'height:12px', 'border-radius:2px',
          'background:#f1f5f9', 'border:2px solid #1e293b', 'box-sizing:border-box',
        ].join(';');
        const marker = new maplibre.Marker({ element: ulko })
          .setLngLat([k.gps.lon, k.gps.lat])
          .addTo(kartta as never);
        kohdemerkitRef.current.set(k.id, marker);
      }
    });

    return () => { peruttu = true; };
  }, [kohteet, tila]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-line" style={{ height: taulu ? '70vh' : 420 }}>
      {/* SIJOITTELU ON TYYLIATTRIBUUTISSA EIKÄ LUOKISSA, ja se on korjaus eikä makuasia.
          maplibre lisää säiliöön luokan `.maplibregl-map`, jonka oma tyylitiedosto
          asettaa `position: relative`. Se ladataan laiskasti kartan mukana eli VASTA
          Tailwindin jälkeen, jolloin se voittaa `absolute`-luokan — ja `inset-0` jää
          silloin vaikutuksetta, säiliön korkeus romahtaa nollaan ja kartta on valkoinen
          laatikko. Canvas ja merkit ovat silti olemassa, joten viasta ei näy DOM:ssa
          mitään epäilyttävää. Tyyliattribuutti voittaa molemmat. */}
      <div
        ref={sailioRef}
        data-testid="kartta-sailio"
        style={{ position: 'absolute', inset: 0 }}
      />
      {tila === 'lataa' && (
        <div className="absolute inset-0 flex items-center justify-center bg-sunken text-sm text-ink-muted">
          Ladataan karttaa…
        </div>
      )}
      {tila === 'virhe' && (
        <div className="absolute inset-0 flex items-center justify-center bg-danger-soft p-6 text-center">
          <p className="text-sm text-danger-ink leading-relaxed">
            Karttaa ei voitu näyttää. Yksiköiden sijainnit ovat yhä listassa tämän alla.
            <span className="block mt-1 text-xs opacity-80">{virheteksti}</span>
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Merkin ulkoasu. Tavallinen DOM-elementti eikä maplibren symbolikerros, ja se on
 * harkittu valinta: merkki on TÄSMÄLLEEN SAMA kuin listan merkki (väri + kirjain), ja
 * kahtena toteutuksena ne erkanisivat. Päivystäjä katsoo molempia yhtä aikaa.
 */
function piirraMerkki(juuri: HTMLDivElement, y: Yksikkomerkki, taulu: boolean) {
  const koko = taulu ? KOKO_TAULU : KOKO;
  const epatarkka = onEpatarkka(y.gps);

  juuri.title = `${y.nimi} — ${TILAN_NIMI[y.tila]}`;
  juuri.setAttribute('aria-label', juuri.title);
  juuri.style.cssText = [
    `width:${koko}px`, `height:${koko}px`, 'border-radius:9999px',
    'display:flex', 'align-items:center', 'justify-content:center',
    `font-size:${Math.round(koko * 0.42)}px`, 'font-weight:700', 'color:#fff',
    'cursor:pointer', 'box-sizing:border-box',
    // `relative` on tässä eikä ehdollisena: hätärengas ja suuntanuoli ovat molemmat
    // absoluuttisesti sijoitettuja lapsia, ja ilman sitä ne asemoituisivat lähimpään
    // sijoitettuun esivanhempaan — eli kartan säiliöön. Hätärengas olisi silloin koko
    // kartan kokoinen, mikä on juuri niin harhaanjohtavaa kuin miltä kuulostaa.
    'position:relative',
    `background:${TILAN_VARI[y.tila]}`,
    // Valkoinen reunus erottaa merkin tummasta pohjasta ja toisistaan päällekkäin
    // osuvat merkit toisistaan.
    'border:2px solid rgba(255,255,255,0.9)',
    'box-shadow:0 1px 4px rgba(0,0,0,0.5)',
    // EPÄTARKKA SIJAINTI EI SAA NÄYTTÄÄ TARKALTA. Katkoviivareunus kertoo että merkin
    // paikka on likiarvo — kehää ei piirretä, koska se peittäisi puoli kaupunkia.
    ...(epatarkka ? ['border-style:dashed', 'opacity:0.75'] : []),
  ].join(';');

  juuri.textContent = TILAN_KIRJAIN[y.tila];

  // HÄTÄ EROTETAAN MUODOLLA JA LIIKKEELLÄ, EI VÄRILLÄ. Punainen on jo yhden tilan väri
  // (tehtävällä), ja jos hätä olisi myös punainen, se katoaisi punaisten pisteiden
  // joukkoon juuri silloin kun sen pitää erottua ensimmäisenä. Pulssiva rengas erottuu
  // myös silloin kun ruutua katsotaan silmäkulmasta.
  juuri.classList.toggle('kartta-hata', y.hata);

  // Suuntanuoli erillisenä lapsena, jotta merkin oma sisältö (kirjain) säilyy.
  const vanhaNuoli = juuri.querySelector('[data-nuoli]');
  vanhaNuoli?.remove();
  if (nayttaaSuunnan(y.gps)) {
    const nuoli = document.createElement('span');
    nuoli.setAttribute('data-nuoli', '');
    nuoli.textContent = '▲';
    nuoli.style.cssText = [
      'position:absolute', `top:${-Math.round(koko * 0.42)}px`,
      `font-size:${Math.round(koko * 0.38)}px`, 'line-height:1',
      `color:${TILAN_VARI[y.tila]}`, 'text-shadow:0 0 2px rgba(255,255,255,0.9)',
      'pointer-events:none',
      `transform:rotate(${y.gps.suunta}deg)`, 'transform-origin:50% 150%',
    ].join(';');
    juuri.appendChild(nuoli);
  }
}
