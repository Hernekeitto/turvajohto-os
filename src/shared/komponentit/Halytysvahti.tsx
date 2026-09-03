// Hälytysvahti: se osa hälytyksistä joka on läsnä koko vuoron ajan.
//
// Tämä komponentti on juuressa eikä hälytysnäkymässä, ja se on koko toiminnon kannalta
// olennaista: ajastimen laskuri, man-down-tunnistus ja lauenneen hälytyksen ilmoitus
// eivät saa lakata toimimasta siksi että vartija siirtyi katsomaan kohteen tietoja.
// Näkymässä oleva vahti vahtisi vain sitä näkymää.
//
// Vahti EI laukaise ajastinhälytystä. Näytöllä juokseva laskuri on ihmiselle; hälytyksen
// laukaisee palvelin, myös silloin kun tätä koodia ei ole ajossa. Kun laskuri menee
// nollaan, käyttöliittymä kertoo odottavansa palvelinta eikä väitä hälytyksen lauenneen.
import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, Timer, Check, TriangleAlert } from 'lucide-react';

import {
  alkutila, syota, voimakkuus, EPAILYN_SELITE, NAYTEVALI_MS, VASTAUSAIKA_MS,
  type MandownEpaily, type MandownTila,
} from '../mandown';
import {
  ajastinTeksti, haeSijainti, jaljella, jatkaAjastinta, kuittaaHalytys, laukaiseHalytys,
  TYYPPI_LABEL, type Halytys,
} from '../halytykset';

type Props = {
  eventId: string | null;
  kayttaja: string;
  halytykset: Halytys[];
  // Palvelimen palauttama päivitetty tietue juurikomponentille.
  onMuutos: (halytys: Halytys) => void;
  // Kutsutaan kun kannattaa hakea hälytykset uudelleen (laskuri meni nollaan).
  onVirkista: () => void;
  mandown: boolean;
};

export const Halytysvahti = ({ eventId, kayttaja, halytykset, onMuutos, onVirkista, mandown }: Props) => {
  const [nyt, setNyt] = useState(Date.now());
  const [epaily, setEpaily] = useState<MandownEpaily | null>(null);
  const [epailynAlku, setEpailynAlku] = useState(0);
  const [tyoskentelee, setTyoskentelee] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const epailyRef = useRef<MandownEpaily | null>(null);
  epailyRef.current = epaily;
  // Kutsuja antaa uuden funktion joka renderillä. Riippuvuutena se nollaisi alla olevan
  // vastausajan jokaisella renderöinnillä — eli hälytys ei lähtisi koskaan.
  const muutosRef = useRef(onMuutos);
  muutosRef.current = onMuutos;
  const virkistysRef = useRef(onVirkista);
  virkistysRef.current = onVirkista;

  const omaAjastin = halytykset.find(
    (h) => h.tyyppi === 'ajastin' && h.tila === 'kaynnissa' && h.vartija === kayttaja
  ) || null;
  const omatLauenneet = halytykset.filter((h) => h.tila === 'lauennut' && h.vartija === kayttaja);

  // Sekunnin kello vain silloin kun jotain lasketaan. Ilman ehtoa koko sovellus
  // renderöityisi kerran sekunnissa koko vuoron ajan.
  useEffect(() => {
    if (!omaAjastin && !epaily) return;
    // Kello asetetaan heti eikä vasta sekunnin päästä: ilman tätä laskuri näyttäisi
    // ensimmäisen sekunnin ajan sen ajan joka oli komponentin edellisellä päivityksellä,
    // eli ajastin näyttäisi käynnistyessään liian pitkää aikaa.
    setNyt(Date.now());
    const id = window.setInterval(() => setNyt(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [omaAjastin, epaily]);

  // Kun laskuri menee nollaan, haetaan hälytykset uudelleen kerran: palvelin laukaisee
  // ajastimen kymmenen sekunnin kierroksellaan, ja tieto tulee normaalisti kanavaa pitkin
  // — tämä on varmistus sen varalta että kanava on poikki.
  const aikaaJaljella = omaAjastin ? jaljella(omaAjastin, nyt) : null;
  // Riippuvuutena on TOTUUSARVO eikä jäljellä oleva aika: aika muuttuu sekunnin välein,
  // jolloin efekti purkautuisi ja peruisi juuri asettamansa ajastimen joka sekunti — ja
  // haku ei tapahtuisi koskaan.
  const umpeutunut = aikaaJaljella !== null && aikaaJaljella <= 0;
  useEffect(() => {
    if (!umpeutunut) return;
    const id = window.setTimeout(() => virkistysRef.current(), 12000);
    return () => window.clearTimeout(id);
  }, [umpeutunut]);

  // --- Man-down -------------------------------------------------------------------
  useEffect(() => {
    if (!mandown) return;
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;

    let tila: MandownTila = alkutila();
    let viimeksi = 0;

    const kuuntelija = (tapahtuma: DeviceMotionEvent) => {
      const hetki = Date.now();
      // Anturi tarjoaa dataa noin 60 kertaa sekunnissa. Näytteitä otetaan neljä
      // sekunnissa: enempi ei paranna tunnistusta mutta kuluttaa akkua.
      if (hetki - viimeksi < NAYTEVALI_MS) return;
      viimeksi = hetki;
      const v = voimakkuus(tapahtuma.accelerationIncludingGravity);
      if (v === null) return;
      const tulos = syota(tila, { ts: hetki, voimakkuus: v });
      tila = tulos.tila;
      // Uutta epäilyä ei oteta vastaan silloin kun edellinen on jo kysymässä.
      if (tulos.epaily && !epailyRef.current) {
        setEpaily(tulos.epaily);
        setEpailynAlku(hetki);
        setNyt(hetki);
      }
    };

    window.addEventListener('devicemotion', kuuntelija);
    return () => window.removeEventListener('devicemotion', kuuntelija);
  }, [mandown]);

  // Vastausaika umpeen: hälytys lähtee. Tämä on ainoa kohta jossa käyttöliittymä
  // laukaisee hälytyksen itse, ja se tapahtuu vasta kun ihminen ei ole vastannut.
  //
  // Ajastin eikä kellon vertailu: renderöintikello (`nyt`) päivittyy sekunnin välein ja
  // hidastuu kun välilehti on taustalla, joten siihen perustuva vertailu tekisi
  // vastausajasta epämääräisen juuri siinä tilanteessa jota varten toiminto on olemassa —
  // puhelin taskussa, näyttö pimeänä. Ajastin on täsmälleen se lupaus jonka teksti antaa,
  // ja sen siivous peruu hälytyksen heti kun käyttäjä vastaa.
  useEffect(() => {
    if (!epaily) return;
    const kuvaus = EPAILYN_SELITE[epaily];
    const id = window.setTimeout(() => {
      setEpaily(null);
      (async () => {
        const gps = await haeSijainti();
        const tulos = await laukaiseHalytys({ tyyppi: 'mandown', eventId, kuvaus, gps });
        if (tulos.ok && tulos.halytys) muutosRef.current(tulos.halytys);
        else setVirhe(tulos.error || 'Man-down-hälytystä ei saatu lähetettyä. Soita 112.');
      })();
    }, VASTAUSAIKA_MS);
    return () => window.clearTimeout(id);
  }, [epaily, eventId]);

  const kutsu = async (tehtava: () => Promise<{ ok: boolean; error?: string; halytys?: Halytys }>) => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = await tehtava();
      if (tulos.ok && tulos.halytys) onMuutos(tulos.halytys);
      else setVirhe(tulos.error || 'Toiminto epäonnistui.');
    } finally {
      setTyoskentelee(false);
    }
  };

  if (!omaAjastin && omatLauenneet.length === 0 && !epaily && !virhe) return null;

  return (
    <div className="space-y-3 mb-4">
      {/* --- Man-down: oletko kunnossa --- */}
      {epaily && (
        <div className="bg-danger-soft border-2 border-danger rounded-xl p-4">
          <div className="flex items-start gap-3">
            <TriangleAlert size={22} className="text-danger-ink shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-danger-ink">Oletko kunnossa?</p>
              <p className="text-sm text-danger-ink/90 mt-0.5">
                {EPAILYN_SELITE[epaily]} Hälytys lähtee{' '}
                {ajastinTeksti(Math.max(0, VASTAUSAIKA_MS - (nyt - epailynAlku)))} kuluttua.
              </p>
              <button
                type="button"
                onClick={() => setEpaily(null)}
                className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-danger hover:opacity-90 text-white font-bold rounded-lg px-5 py-3 transition-opacity"
              >
                <Check size={18} />
                Olen kunnossa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Omat lauenneet hälytykset --- */}
      {omatLauenneet.map((h) => (
        <div key={h.id} className="bg-danger-soft border-2 border-danger rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert size={22} className="text-danger-ink shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-danger-ink">{TYYPPI_LABEL[h.tyyppi]} on lauennut</p>
              <p className="text-sm text-danger-ink/90 mt-0.5">
                {h.eskalointi
                  ? h.eskalointi.tila === 'epaonnistui'
                    ? `Tekstiviestiä EI saatu lähetettyä (${h.eskalointi.virhe}). Ota yhteys puhelimitse.`
                    : `Hälytys on lähetetty ${h.eskalointi.vastaanottajia} numeroon.`
                  : 'Hälytys näkyy valvomossa. Tekstiviesti lähtee hetken kuluttua, jos et kuittaa.'}
              </p>
              <button
                type="button"
                disabled={tyoskentelee}
                onClick={() => kutsu(() => kuittaaHalytys(h.id, 'Kuitattu laitteelta'))}
                className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-danger hover:opacity-90 disabled:opacity-60 text-white font-bold rounded-lg px-5 py-3 transition-opacity"
              >
                <Check size={18} />
                Kuittaa — olen kunnossa
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* --- Käynnissä oleva ajastin --- */}
      {omaAjastin && (
        <div className={`rounded-xl p-4 border-2 ${
          aikaaJaljella !== null && aikaaJaljella <= 120000
            ? 'bg-warning-soft border-warning'
            : 'bg-surface border-line'
        }`}>
          <div className="flex items-center gap-3 flex-wrap">
            <Timer size={20} className="text-ink-muted shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink-strong">
                {aikaaJaljella !== null && aikaaJaljella > 0
                  ? `Ajastin ${ajastinTeksti(aikaaJaljella)}`
                  : 'Määräaika umpeutui — palvelin laukaisee hälytyksen'}
              </p>
              {omaAjastin.kuvaus && <p className="text-xs text-ink-muted mt-0.5 truncate">{omaAjastin.kuvaus}</p>}
            </div>
            <button
              type="button"
              disabled={tyoskentelee}
              onClick={() => kutsu(() => jatkaAjastinta(omaAjastin.id))}
              className="shrink-0 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2.5 transition-colors"
            >
              <Check size={16} />
              Olen kunnossa
            </button>
          </div>
        </div>
      )}

      {virhe && (
        <p className="text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
          {virhe}
        </p>
      )}
    </div>
  );
};
