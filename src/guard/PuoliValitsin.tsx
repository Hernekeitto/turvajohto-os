// Yläpalkin valitsin Ylläpito / Vartijanäkymä (ks. nakymavalinta.ts). Näytetään vain
// pääkäyttäjälle — muilla tasoilla ei ole kahta puolta joiden välillä vaihtaa.
import { Eye, Wrench } from 'lucide-react';
import type { Puoli } from './nakymavalinta';

const VAIHTOEHDOT: { puoli: Puoli; nimi: string; Kuvake: typeof Wrench }[] = [
  { puoli: 'yllapito', nimi: 'Ylläpito', Kuvake: Wrench },
  { puoli: 'vartija', nimi: 'Vartijanäkymä', Kuvake: Eye },
];

export const PuoliValitsin = ({ puoli, onVaihda }: { puoli: Puoli; onVaihda: (p: Puoli) => void }) => (
  <div role="group" aria-label="Näkymä" className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
    {VAIHTOEHDOT.map(({ puoli: p, nimi, Kuvake }) => {
      const valittu = p === puoli;
      return (
        <button
          key={p}
          type="button"
          aria-pressed={valittu}
          onClick={() => onVaihda(p)}
          title={nimi}
          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            valittu ? 'bg-accent text-white' : 'text-ink-on-dark-muted hover:text-ink-on-dark hover:bg-white/10'
          }`}
        >
          <Kuvake size={16} />
          <span className="hidden md:inline">{nimi}</span>
        </button>
      );
    })}
  </div>
);
