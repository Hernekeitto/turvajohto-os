// Sovellusasetusten etusivun painikeruudukko (2.10.2026, käyttäjän pyyntö). Jaettu:
// sekä EVENT (App.tsx) että GUARD (guard/Asetukset.tsx) näyttävät asetuksensa näin.
//
// Kaikki osiot yhdellä sivulla tekivät asetuksista niin pitkän, että etsitty asetus
// hukkui. Nyt jokainen osio on painike, ja avattu osio näkyy yksinään.
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

export type AsetusPainike<T extends string> = {
  id: T;
  nimi: string;
  kuvaus: string;
  Ikoni: LucideIcon;
  // Lyhyt tilatieto painikkeen alle, esim. "3 tasoa". null = ei näytetä mitään.
  tiivistelma?: string | null;
};

export function AsetusValikko<T extends string>({
  osiot, onValitse,
}: { osiot: AsetusPainike<T>[]; onValitse: (id: T) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {osiot.map(({ id, nimi, kuvaus, Ikoni, tiivistelma }) => (
        <button
          key={id}
          type="button"
          onClick={() => onValitse(id)}
          className="text-left rounded-xl border border-line bg-surface hover:bg-sunken hover:border-line-strong p-4 flex items-start gap-3 transition-colors"
        >
          <Ikoni size={20} className="text-accent shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0">
            <span className="block font-medium text-ink-strong">{nimi}</span>
            <span className="block text-xs text-ink-muted mt-0.5 leading-relaxed">{kuvaus}</span>
            {tiivistelma && <span className="block text-xs font-medium text-ink-body mt-1">{tiivistelma}</span>}
          </span>
          <ChevronRight size={18} className="text-ink-subtle shrink-0 self-center" />
        </button>
      ))}
    </div>
  );
}
