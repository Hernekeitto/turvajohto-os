// HÄLKEstä avattava kohteen viestiketju (erä 26, jatko, käyttäjän pyyntö 22.9.2026 illalla:
// "Lisätään HÄLKEen mahdollisuus avata kohteiden keskusteluja... Näin esimerkiksi vartija
// voi laittaa kohteen omaan viestiketjuun kuvan ongelmasta, jonka hälkepäivystäjä katsoo.").
//
// EI UUTTA TAUSTALOGIIKKAA — kohteen kiinteä kanava (`kohde:<siteId>`) ja sen
// viestiketju ovat jo olemassa (vartija käyttää niitä mobiilin PttPalkki.tsx:n kautta).
// Tämä tiedosto on vain se puuttuva PÄIVYSTÄJÄN PÄÄN kytkentä: oma OlmMachine-elinkaari
// (sama malli kuin src/guard/mobiili/kayttoPttPalkkia.ts) ja jo valmis viestikomponentti
// (KanavaViestit.tsx) uudelleenkäytettynä sellaisenaan.
//
// PYSYVÄ KOODI, EI TILAPÄINEN — `onLaiteviestiSaapui` on TARKOITUKSELLA mukana heti
// alusta asti: PttYhteenveto.tsx:n vastaava puuttui aluksi ja sen puuttuminen jätti PTT-
// äänen jumiin "Odottaa avainta" -tilaan (22.9.2026, ks. Obsidian "HÄLKE-yhteenveto ja
// kuuntelu"). Sama huoneavaimen to-device-relenssi koskee tekstiviestejäkin, joten sama
// virhe tässä olisi näkynyt viestien pysyvänä purkautumattomuutena.
import { useCallback, useEffect, useState } from 'react';
import type { OlmMachine } from '@matrix-org/matrix-sdk-crypto-wasm';

import { useKanava } from '../../shared/kanava';
import { haeJaettuOlmMachine, synkronoiPyynnot, synkronoiLaiteviestit } from '../../shared/olm';
import { kasitteleJono } from '../../shared/viestijono';
import { KanavaViestit } from '../mobiili/KanavaViestit';
import type { Kanava } from '../mobiili/kanavapalkki';
import type { ViestiHerate } from '../mobiili/kayttoPttPalkkia';

// Varasilmukka lähetysjonolle, sama periaate ja sama väli kuin kayttoPttPalkkia.ts:ssä:
// jono tyhjenee normaalisti heti kun kone on valmis tai heti lähetyksen jälkeen, tämä on
// vain turva sille että katkennut yhteys joskus toipuu ilman käyttäjän toimia.
const JONO_YRITYSVALI_MS = 15_000;

type Props = {
  kayttaja: string;
  kanava: Kanava;
  onSulje: () => void;
};

export const KohdeKeskustelu = ({ kayttaja, kanava, onSulje }: Props) => {
  const [machine, setMachine] = useState<OlmMachine | null>(null);
  const [koneVirhe, setKoneVirhe] = useState<string | null>(null);
  const [herate, setHerate] = useState<ViestiHerate>({ kanavaId: null, n: 0 });

  // OlmMachine: sama jaettu instanssi kuin PTT-yhteenvedolla ja mobiilin PTT-palkilla
  // (haeJaettuOlmMachine huolehtii ettei kahta instanssia synny samaa IndexedDB-varastoa
  // vasten). NÄKYVÄ virhe eikä hiljainen nielaisu — sama perustelu kuin PttYhteenveto.tsx:ssä.
  useEffect(() => {
    let peruttu = false;
    setKoneVirhe(null);
    haeJaettuOlmMachine(kayttaja).then(async (kone) => {
      await synkronoiPyynnot(kone);
      await synkronoiLaiteviestit(kone);
      if (!peruttu) setMachine(kone);
    }).catch((e: unknown) => {
      if (peruttu) return;
      // eslint-disable-next-line no-console
      console.error('Kohdekeskustelun salauksen alustus epäonnistui', e);
      setKoneVirhe(e instanceof Error ? e.message : String(e));
    });
    return () => { peruttu = true; };
  }, [kayttaja]);

  const yritaLahettaaJono = useCallback(() => {
    if (!machine) return;
    kasitteleJono(machine, kayttaja).catch(() => { /* jää jonoon, yritetään uudelleen */ });
  }, [machine, kayttaja]);

  useKanava({
    onUusiViesti: (kanavaId) => setHerate((e) => ({ kanavaId, n: e.n + 1 })),
    onViestiKuitattu: (kanavaId) => setHerate((e) => ({ kanavaId, n: e.n + 1 })),
    // Huoneavain saapui to-device-relenssin kautta — ks. tiedoston yläkommentti.
    onLaiteviestiSaapui: () => {
      if (!machine) return;
      synkronoiLaiteviestit(machine).then(() => setHerate((e) => ({ kanavaId: null, n: e.n + 1 })));
    },
  });

  useEffect(() => {
    if (!machine) return undefined;
    yritaLahettaaJono();
    const ajastin = setInterval(yritaLahettaaJono, JONO_YRITYSVALI_MS);
    return () => clearInterval(ajastin);
  }, [machine, yritaLahettaaJono]);

  if (koneVirhe) {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-surface">
        <header className="shrink-0 flex items-center gap-2 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-surface-dark text-ink-on-dark">
          <button
            type="button"
            onClick={onSulje}
            aria-label="Sulje viestit"
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-white/10"
          >
            ×
          </button>
          <p className="flex-1 min-w-0 truncate text-base font-medium">{kanava.nimi}</p>
        </header>
        <p className="p-4 text-sm text-danger-ink">
          Salauksen alustus epäonnistui: {koneVirhe} — kokeile ladata sivu uudelleen.
        </p>
      </div>
    );
  }

  return (
    <KanavaViestit
      machine={machine}
      omaKayttaja={kayttaja}
      kanava={kanava}
      herate={herate}
      onLahetaJono={yritaLahettaaJono}
      onSulje={onSulje}
    />
  );
};
