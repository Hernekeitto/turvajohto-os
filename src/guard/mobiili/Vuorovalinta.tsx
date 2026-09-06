// Vuoroon kirjautuminen: mobiiliversion ensimmäinen näkymä kirjautumisen jälkeen.
//
// Vuoro = kohde jossa vartija on nyt töissä (ks. mobiili/vuoro.ts). Valinta ratkaisee
// mitä etusivulla näkyy ja mihin kohteeseen hälytykset, tiedotteet ja kierrokset
// kohdistuvat, joten se on kysyttävä ennen kuin mitään muuta näytetään — arvattu kohde
// tarkoittaisi, että hätäpainike hälyttää väärän kohteen numeroihin.
import { Building2, ChevronRight } from 'lucide-react';

import type { Kohde } from '../tyypit';

type Props = {
  kohteet: Kohde[];
  ladattu: boolean;
  onValitse: (kohde: Kohde) => void;
};

export const Vuorovalinta = ({ kohteet, ladattu, onValitse }: Props) => (
  <div>
    <h2 className="text-2xl font-bold text-ink-strong mb-1">Kirjaudu vuoroon:</h2>
    <p className="text-base text-ink-muted leading-relaxed mb-6">
      Valitse kohde jossa olet vuorossa. Voit vaihtaa kohdetta valikosta kesken vuoron.
    </p>

    {kohteet.length === 0 ? (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <Building2 className="w-8 h-8 text-ink-subtle mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-base text-ink-muted">
          {ladattu
            ? 'Sinulle ei ole merkitty yhtään kohdetta. Ota yhteys esimieheesi.'
            : 'Haetaan kohteita…'}
        </p>
      </div>
    ) : (
      <div className="space-y-2">
        {kohteet.map((kohde) => (
          <button
            key={kohde.id}
            type="button"
            onClick={() => onValitse(kohde)}
            className="w-full text-left rounded-xl border border-line bg-surface hover:bg-sunken p-4 flex items-center gap-3 transition-colors"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-bold text-ink-strong truncate">{kohde.name}</span>
              {kohde.address && (
                <span className="block text-base text-ink-muted mt-0.5 truncate">{kohde.address}</span>
              )}
            </span>
            <ChevronRight size={20} className="text-ink-subtle shrink-0" />
          </button>
        ))}
      </div>
    )}
  </div>
);
