// Hälytysnäkymä: ajastin, hätäpainike, man-down ja kohteen hälytyshistoria.
//
// Kaikki toiminnot menevät palvelimen /api/halytys-reittien kautta. Näkymä ei laske
// määräaikoja eikä päätä tiloista — ks. shared/halytykset.ts.
//
// HÄLYTYS EI MENE LÄHTEVÄÄN JONOON. Erän 6 sääntö "kentällä tehty kirjaus ei saa kadota
// verkon puutteeseen" ei päde tähän: kirjaus voi odottaa yhteyttä, hätä ei. Jonoon jäänyt
// hätäpainikkeen painallus näyttäisi onnistuneen ja lähtisi ehkä puolen tunnin päästä.
// Siksi epäonnistuminen sanotaan suoraan ja kehotetaan soittamaan 112.
import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, Timer, Check, Ban, Activity, Phone, MapPin } from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import {
  AJASTIN_VALINNAT, TYYPPI_LABEL, TILA_LABEL, ajastinTeksti, haeSijainti, jaljella,
  aloitaAjastin, jatkaAjastinta, peruAjastin, kuittaaHalytys, laukaiseHalytys,
  kellonaika, type Halytys,
} from '../shared/halytykset';
import type { Kohde } from './tyypit';

type Props = {
  kohde: Kohde;
  halytykset: Halytys[];
  kayttaja: string;
  saaKuitata: boolean;
  // Vaatiiko KOHDE man-downin. Ei vartijan valinta (erä 12): asetus siirtyi kohteen
  // tietueeseen 12.9.2026, koska se on työnantajan turvallisuusasetus.
  mandown: boolean;
  // Onko selain saanut luvan liikeantureihin. Tämä EI ole sama asia kuin man-downin
  // päälläolo, vaikka vanha käyttöliittymä sekoitti ne yhdeksi kytkimeksi: lupa on
  // selaimen tekninen ehto, joka on kysyttävä käyttäjän eleestä eikä sitä voi antaa
  // palvelimelta. Vartija voi siis myöntää luvan mutta ei kytkeä valvontaa pois.
  liikelupa: boolean;
  onLiikelupa: (myonnetty: boolean) => void;
  onMuutos: (halytys: Halytys) => void;
  onTakaisin: () => void;
};

// Hätäpainikkeen painalluksen kesto. Kaksi sekuntia on tarpeeksi pitkä ettei nappi
// laukea taskussa tai käsineellä osuessa, ja tarpeeksi lyhyt ettei se tunnu esteeltä.
const PAINALLUS_MS = 2000;

// iOS vaatii erillisen luvan liikeantureihin, ja lupa on kysyttävä käyttäjän eleestä.
// Muissa selaimissa funktiota ei ole lainkaan, jolloin lupaa ei tarvita.
async function pyydaLiikelupa(): Promise<boolean> {
  const rajapinta = (window as unknown as {
    DeviceMotionEvent?: { requestPermission?: () => Promise<string> };
  }).DeviceMotionEvent;
  if (!rajapinta) return false;
  if (typeof rajapinta.requestPermission !== 'function') return true;
  try {
    return (await rajapinta.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

export const Halytykset = ({
  kohde, halytykset, kayttaja, saaKuitata, mandown, liikelupa, onLiikelupa, onMuutos, onTakaisin,
}: Props) => {
  const [virhe, setVirhe] = useState<string | null>(null);
  const [ilmoitus, setIlmoitus] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);
  const [kesto, setKesto] = useState(30);
  const [kuvaus, setKuvaus] = useState('');
  const [nyt, setNyt] = useState(Date.now());
  const [painallus, setPainallus] = useState(0);
  const painallusAjastin = useRef<number | null>(null);

  const kohteenHalytykset = halytykset.filter((h) => h.eventId === kohde.id);
  const omaAjastin = kohteenHalytykset.find(
    (h) => h.tyyppi === 'ajastin' && h.tila === 'kaynnissa' && h.vartija === kayttaja
  ) || null;
  const lauenneet = kohteenHalytykset.filter((h) => h.tila === 'lauennut');
  const paattyneet = kohteenHalytykset
    .filter((h) => h.tila === 'kuitattu' || h.tila === 'peruttu')
    .sort((a, b) => String(b.alkoi).localeCompare(String(a.alkoi)))
    .slice(0, 15);

  useEffect(() => {
    if (!omaAjastin) return;
    // Sama syy kuin hälytysvahdissa: ilman välitöntä asetusta laskuri näyttäisi
    // ensimmäisen sekunnin ajan vanhentunutta aikaa.
    setNyt(Date.now());
    const id = window.setInterval(() => setNyt(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [omaAjastin]);

  useEffect(() => () => {
    if (painallusAjastin.current) window.clearInterval(painallusAjastin.current);
  }, []);

  // Ajastimen käynnistysilmoitus poistetaan kun ajastinta ei enää ole. Muuten näytöllä
  // lukisi "ajastin käynnissä" sen jälkeenkin kun hälytys on jo lauennut.
  useEffect(() => {
    if (!omaAjastin) setIlmoitus((edellinen) => (edellinen?.startsWith('Ajastin') ? null : edellinen));
  }, [omaAjastin]);

  const kutsu = async (
    tehtava: () => Promise<{ ok: boolean; error?: string; halytys?: Halytys; [k: string]: unknown }>,
    onnistui?: (vastaus: Record<string, unknown>) => void
  ) => {
    setVirhe(null);
    setIlmoitus(null);
    setTyoskentelee(true);
    try {
      const tulos = await tehtava();
      if (tulos.ok && tulos.halytys) {
        onMuutos(tulos.halytys);
        onnistui?.(tulos as Record<string, unknown>);
      } else {
        setVirhe(tulos.error || 'Toiminto epäonnistui.');
      }
    } finally {
      setTyoskentelee(false);
    }
  };

  const kaynnista = async () => {
    const gps = await haeSijainti();
    await kutsu(
      () => aloitaAjastin({ minuutit: kesto, eventId: kohde.id, kuvaus, gps }),
      (vastaus) => {
        setKuvaus('');
        const numeroita = Number(vastaus.eskalointiNumeroita) || 0;
        setIlmoitus(
          numeroita > 0
            ? `Ajastin käynnissä. Jos et kuittaa ajoissa, hälytys lähtee ${numeroita} numeroon.`
            : 'Ajastin käynnissä, mutta kohteelle EI ole määritetty hälytysnumeroita — lauennut hälytys näkyy vain sovelluksessa.'
        );
      }
    );
  };

  // Hätäpainike: pitkä painallus. Edistyminen näkyy palkkina, jotta käyttäjä tietää
  // painavansa oikein — muuten pitkä painallus tuntuu rikkinäiseltä napilta.
  const aloitaPainallus = () => {
    if (tyoskentelee || painallusAjastin.current) return;
    const alku = Date.now();
    painallusAjastin.current = window.setInterval(() => {
      const kulunut = Date.now() - alku;
      setPainallus(Math.min(1, kulunut / PAINALLUS_MS));
      if (kulunut >= PAINALLUS_MS) {
        lopetaPainallus();
        laukaise();
      }
    }, 50);
  };

  const lopetaPainallus = () => {
    if (painallusAjastin.current) window.clearInterval(painallusAjastin.current);
    painallusAjastin.current = null;
    setPainallus(0);
  };

  const laukaise = async () => {
    const gps = await haeSijainti();
    await kutsu(
      () => laukaiseHalytys({ tyyppi: 'panic', eventId: kohde.id, kuvaus: 'Hätäpainike', gps }),
      () => setIlmoitus('Hätähälytys lähetetty. Pysy paikallasi jos voit.')
    );
  };

  const salliLiiketunnistus = async () => {
    const lupa = await pyydaLiikelupa();
    if (!lupa) {
      setVirhe('Laite ei antanut lupaa liiketunnistukseen. Man-down ei ole käytettävissä.');
      return;
    }
    onLiikelupa(true);
  };

  const aikaaJaljella = omaAjastin ? jaljella(omaAjastin, nyt) : null;

  return (
    <div className="max-w-3xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin kohteeseen</TakaisinLinkki>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-ink-strong mb-1">Hälytykset</h2>
        <p className="text-sm text-ink-muted leading-relaxed">{kohde.name}</p>
      </div>

      {virhe && (
        <p className="mb-4 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
          {virhe}
        </p>
      )}
      {ilmoitus && (
        <p className="mb-4 text-sm text-success-ink bg-success-soft border border-success/30 rounded-lg px-4 py-3">
          {ilmoitus}
        </p>
      )}

      {/* --- Hätäpainike --- */}
      <div className="bg-surface border border-line rounded-xl p-5 mb-6">
        <h3 className="font-bold text-ink-strong mb-1 flex items-center gap-2">
          <ShieldAlert size={18} className="text-danger-ink" />
          Hätäpainike
        </h3>
        <p className="text-sm text-ink-muted mb-4">
          Lähettää hälytyksen valvomoon ja tekstiviestin kohteen hälytysnumeroihin heti.
          Hengenvaarassa soita ensin 112.
        </p>
        <button
          type="button"
          disabled={tyoskentelee}
          onPointerDown={aloitaPainallus}
          onPointerUp={lopetaPainallus}
          onPointerLeave={lopetaPainallus}
          onPointerCancel={lopetaPainallus}
          className="relative w-full overflow-hidden bg-danger hover:opacity-90 disabled:opacity-60 text-white font-bold rounded-xl px-6 py-6 text-lg transition-opacity select-none touch-none"
        >
          <span
            className="absolute inset-y-0 left-0 bg-black/25 transition-[width] duration-75"
            style={{ width: `${painallus * 100}%` }}
            aria-hidden="true"
          />
          <span className="relative">
            {painallus > 0 ? 'Pidä painettuna…' : 'HÄTÄHÄLYTYS — pidä painettuna 2 s'}
          </span>
        </button>
      </div>

      {/* --- Ajastin --- */}
      <div className="bg-surface border border-line rounded-xl p-5 mb-6">
        <h3 className="font-bold text-ink-strong mb-1 flex items-center gap-2">
          <Timer size={18} className="text-ink-muted" />
          Ajastin yksin työskentelyyn
        </h3>
        <p className="text-sm text-ink-muted mb-4">
          Kuittaa itsesi kunnossa olevaksi ennen määräaikaa. Jos kuittausta ei tule, hälytys
          laukeaa itsestään — myös silloin kun puhelin on sammunut.
        </p>

        {omaAjastin ? (
          <div>
            <p className="text-2xl font-bold text-ink-strong tabular-nums">
              {aikaaJaljella !== null && aikaaJaljella > 0
                ? ajastinTeksti(aikaaJaljella)
                : 'Määräaika umpeutui'}
            </p>
            {omaAjastin.kuvaus && <p className="text-sm text-ink-muted mt-1">{omaAjastin.kuvaus}</p>}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                disabled={tyoskentelee}
                onClick={() => kutsu(() => jatkaAjastinta(omaAjastin.id))}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2.5 transition-colors"
              >
                <Check size={16} />
                Olen kunnossa ({omaAjastin.kestoMin} min lisää)
              </button>
              <button
                type="button"
                disabled={tyoskentelee}
                onClick={() => kutsu(() => peruAjastin(omaAjastin.id), () => setIlmoitus('Ajastin lopetettu.'))}
                className="inline-flex items-center gap-2 border border-line-strong hover:bg-sunken disabled:opacity-60 text-ink-body text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
              >
                <Ban size={16} />
                Lopeta ajastin
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              {AJASTIN_VALINNAT.map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setKesto(min)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-bold border transition-colors ${
                    kesto === min
                      ? 'bg-accent text-white border-accent'
                      : 'bg-sunken text-ink-body border-line-soft hover:bg-surface'
                  }`}
                >
                  {min} min
                </button>
              ))}
            </div>
            <label className="block mb-4">
              <span className="block text-sm font-medium text-ink-body mb-1">
                Mitä olet tekemässä? (näkyy valvomolle)
              </span>
              <input
                type="text"
                value={kuvaus}
                onChange={(e) => setKuvaus(e.target.value)}
                placeholder="Esim. tarkastan kellarikäytävän"
                className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2.5 text-sm text-ink-strong placeholder:text-ink-subtle focus:outline-none focus:border-accent"
              />
            </label>
            <button
              type="button"
              disabled={tyoskentelee}
              onClick={kaynnista}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-5 py-3 transition-colors"
            >
              <Timer size={16} />
              Käynnistä ajastin
            </button>
          </div>
        )}
      </div>

      {/* --- Man-down --- */}
      <div className="bg-surface border border-line rounded-xl p-5 mb-6">
        <h3 className="font-bold text-ink-strong mb-1 flex items-center gap-2">
          <Activity size={18} className="text-ink-muted" />
          Man-down
        </h3>
        <p className="text-sm text-ink-muted mb-4">
          Puhelin tarkkailee iskua ja liikkumattomuutta. Havainnosta kysytään ensin sinulta
          — hälytys lähtee vasta jos et vastaa. Selaimessa tämä toimii vain kun sovellus on
          auki; Android-sovelluksessa myös taskussa.
        </p>

        {!mandown ? (
          /* Asetus on kohteella eikä täällä. Tilan NÄYTTÄMINEN on silti tärkeää: vartijan
             on tiedettävä valvotaanko häntä, ja "ei mitään näkyvissä" olisi sama kuin
             arvaus. */
          <p className="text-sm text-ink-body bg-sunken border border-line-soft rounded-lg p-3">
            Man-down ei ole käytössä tässä kohteessa. Asetuksen tekee hälytyskeskus
            kohteen tiedoissa.
          </p>
        ) : liikelupa ? (
          <p className="text-sm text-success-ink bg-success-soft border border-success/40 rounded-lg p-3">
            Man-down on käytössä ja liiketunnistus on sallittu.
          </p>
        ) : (
          <>
            <p className="text-sm text-warning-ink bg-warning-soft border border-warning/30 rounded-lg p-3 mb-3">
              Man-down on käytössä tässä kohteessa, mutta selain ei ole vielä saanut lupaa
              liikeantureihin. Valvonta ei ole päällä ennen kuin annat luvan.
            </p>
            <button
              type="button"
              onClick={salliLiiketunnistus}
              className="inline-flex items-center gap-2 text-sm font-bold rounded-lg px-5 py-3 border transition-colors bg-sunken text-ink-body border-line-strong hover:bg-surface"
            >
              <Activity size={16} />
              Salli liiketunnistus
            </button>
          </>
        )}
      </div>

      {/* --- Kohteen lauenneet hälytykset --- */}
      {lauenneet.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-ink-strong mb-3">Lauenneet hälytykset</h3>
          <ul className="space-y-2">
            {lauenneet.map((h) => (
              <li key={h.id} className="bg-danger-soft border border-danger/40 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-bold text-danger-ink">
                      {TYYPPI_LABEL[h.tyyppi]} · {h.vartija}
                    </p>
                    <p className="text-xs text-danger-ink/90 mt-0.5">
                      Laukesi {kellonaika(h.laukesi)}
                      {h.kuvaus ? ` · ${h.kuvaus}` : ''}
                    </p>
                    {h.gps && (
                      <p className="text-xs text-danger-ink/80 mt-0.5 flex items-center gap-1">
                        <MapPin size={11} />
                        {h.gps.lat.toFixed(5)}, {h.gps.lon.toFixed(5)}
                      </p>
                    )}
                    {h.eskalointi && (
                      <p className="text-xs text-danger-ink/80 mt-0.5 flex items-center gap-1">
                        <Phone size={11} />
                        {h.eskalointi.tila === 'epaonnistui'
                          ? `Tekstiviesti ei lähtenyt: ${h.eskalointi.virhe}`
                          : `Tekstiviesti ${h.eskalointi.vastaanottajia} numeroon`}
                      </p>
                    )}
                  </div>
                  {(saaKuitata || h.vartija === kayttaja) && (
                    <button
                      type="button"
                      disabled={tyoskentelee}
                      onClick={() => kutsu(() => kuittaaHalytys(h.id))}
                      className="shrink-0 inline-flex items-center gap-1.5 bg-danger hover:opacity-90 disabled:opacity-60 text-white text-xs font-bold rounded-lg px-3 py-2 transition-opacity"
                    >
                      <Check size={14} />
                      Kuittaa
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- Historia --- */}
      <div>
        <h3 className="font-bold text-ink-strong mb-3">Aiemmat hälytykset</h3>
        {paattyneet.length === 0 ? (
          <p className="text-sm text-ink-muted">Ei aiempia hälytyksiä tässä kohteessa.</p>
        ) : (
          <ul className="divide-y divide-line-soft border border-line-soft rounded-lg overflow-hidden">
            {paattyneet.map((h) => (
              <li key={h.id} className="px-4 py-3 bg-surface">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="text-sm font-medium text-ink-strong">
                    {TYYPPI_LABEL[h.tyyppi]} · {h.vartija}
                  </span>
                  <span className="text-xs text-ink-subtle">
                    {TILA_LABEL[h.tila]} {kellonaika(h.paattyi)}
                  </span>
                </div>
                {h.kuittausHuomio && <p className="text-xs text-ink-muted mt-1">{h.kuittausHuomio}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
