// Yläpalkin valitsin Ylläpito / Vartijanäkymä (ks. nakymavalinta.ts). Näytetään vain
// pääkäyttäjälle — muilla tasoilla ei ole kahta puolta joiden välillä vaihtaa.
//
// Mobiilinäkymä (27.9.2026) ei ole kolmas puoli vaan oma ikkunansa: se avaa
// /guard/mobile-osoitteen puhelimen kokoiseen ikkunaan. Osoite voittaa laitteelle
// tallennetun valinnan (main.tsx), joten tämän koneen työpöytävalinta ei muutu, ja
// esimies näkee työpöydän ja puhelimen rinnakkain.
import { Eye, Smartphone, Wrench } from 'lucide-react';
import type { Puoli } from './nakymavalinta';
import { MOBIILIPOLKU } from '../shared/laitevalinta';

const VAIHTOEHDOT: { puoli: Puoli; nimi: string; Kuvake: typeof Wrench }[] = [
  { puoli: 'yllapito', nimi: 'Ylläpito', Kuvake: Wrench },
  { puoli: 'vartija', nimi: 'Vartijanäkymä', Kuvake: Eye },
];

// Mobiiliversion kuvasuhde on 20:9 (ks. mobiili/). 412 px on yleisen Android-puhelimen
// CSS-leveys; korkeus rajataan näytön mukaan, jottei ikkuna mene ruudun yli.
const avaaMobiilinakyma = () => {
  const leveys = 412;
  const korkeus = Math.min(Math.round((leveys * 20) / 9), window.screen.availHeight - 40);
  // Nimetty ikkuna: toinen painallus tuo saman ikkunan eteen eikä avaa uutta.
  const ikkuna = window.open(
    MOBIILIPOLKU,
    'turvajohto-guard-mobiili',
    `popup,width=${leveys},height=${korkeus}`,
  );
  ikkuna?.focus();
};

export const PuoliValitsin = ({ puoli, onVaihda }: { puoli: Puoli; onVaihda: (p: Puoli) => void }) => (
  <div className="flex items-center gap-2">
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
    <button
      type="button"
      onClick={avaaMobiilinakyma}
      title="Avaa mobiilinäkymä omaan ikkunaan"
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 bg-white/10 text-sm font-medium text-ink-on-dark-muted hover:text-ink-on-dark hover:bg-white/20 transition-colors"
    >
      <Smartphone size={16} />
      <span className="hidden md:inline">Mobiilinäkymä</span>
    </button>
  </div>
);
