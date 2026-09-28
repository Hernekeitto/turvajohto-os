// HÄLKE: kohteissa käynnissä olevat skenaariot.
//
// Näkyvät vain skenaariot joiden pohjaan ylläpitäjä on valinnut HÄLKE-seurannan
// (pohja.halke). Päivystäjä näkee saman kortin kuin kentällä oleva vartija: aktiivisen
// polun, valinnat ja tilannelokin. Päivystäjä kirjoittaa lokiin, mutta ei kuittaa kohtia
// kentän puolesta.
import { useState } from 'react';
import { ChevronDown, ChevronRight, GitBranch } from 'lucide-react';

import { SkenaarioSuoritus } from '../../shared/komponentit/SkenaarioSuoritus';
import {
  aktiivisia, kellonaika, kuittaamatta, naytetaanHalkessa, tilanneloki, valitutPolut,
  type Suoritus,
} from '../../shared/pohjat';
import type { Kohde } from '../tyypit';

type Props = {
  skenaariot: Suoritus[];
  kohteet: Kohde[];
  onMuuttui: (suoritus: Suoritus) => void;
};

export const kaynnissaHalkessa = (skenaariot: Suoritus[]) =>
  skenaariot.filter((s) => s.kind === 'play' && s.tila === 'kesken' && s.omistaja !== 'tapahtuma' && naytetaanHalkessa(s));

export const SkenaariotKaynnissa = ({ skenaariot, kohteet, onMuuttui }: Props) => {
  const [auki, setAuki] = useState<string | null>(null);
  const lista = kaynnissaHalkessa(skenaariot)
    .sort((a, b) => String(b.alkoi).localeCompare(String(a.alkoi)));
  const kohdeNimi = (id: string) => kohteet.find((k) => k.id === id)?.name || 'Tuntematon kohde';

  if (lista.length === 0) {
    return (
      <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg px-4 py-3">
        Yhtään HÄLKE-seurattavaa skenaariota ei ole käynnissä.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {lista.map((s) => {
        const avattu = auki === s.id;
        const polut = valitutPolut(s);
        const viimeisin = tilanneloki(s).filter((r) => r.laji === 'kommentti').pop();
        return (
          <li key={s.id}>
            {avattu ? (
              <div>
                <button
                  type="button"
                  onClick={() => setAuki(null)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted hover:text-ink-strong mb-2"
                >
                  <ChevronDown size={14} />
                  Pienennä
                </button>
                <SkenaarioSuoritus suoritus={s} rooli="seuranta" onMuuttui={onMuuttui} lisatieto={kohdeNimi(s.ownerId)} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuki(s.id)}
                className="w-full text-left bg-warning-soft border border-warning/40 rounded-lg p-4 flex items-start gap-3 hover:border-warning transition-colors"
              >
                <ChevronRight size={18} className="text-ink-muted shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink-strong">
                    {s.templateNimi}
                    <span className="text-ink-muted font-normal"> · {kohdeNimi(s.ownerId)} · alkoi {kellonaika(s.alkoi)} · {s.tekija}</span>
                  </p>
                  {polut.length > 0 && (
                    <p className="text-xs text-ink-body mt-1 flex flex-wrap gap-x-3">
                      {polut.map((p) => (
                        <span key={p.kysymys} className="inline-flex items-center gap-1">
                          <GitBranch size={11} />
                          {p.kysymys} <strong>{p.vastaus}</strong>
                        </span>
                      ))}
                    </p>
                  )}
                  {viimeisin && (
                    <p className="text-xs text-ink-muted mt-1 truncate">
                      {kellonaika(viimeisin.aika)} {viimeisin.tekija}: {viimeisin.teksti}
                    </p>
                  )}
                </div>
                <span className="text-xs font-bold text-ink-body tabular-nums shrink-0">
                  {aktiivisia(s) - kuittaamatta(s)}/{aktiivisia(s)}
                </span>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
};
