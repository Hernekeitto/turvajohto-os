// Vartijan tietokonenäkymä. Rakennetaan tyhjästä (27.9.2026): sisältö lisätään osio
// kerrallaan, eikä tänne kopioida ylläpidon näkymiä valmiiksi — silloin vartijalle
// näkyisi taas esimiehen työkaluja, joista osa on vain piilotettu.
import { Eye } from 'lucide-react';

export const Vartijanakyma = () => (
  <div className="bg-surface border border-line rounded-xl p-10 text-center">
    <Eye className="w-10 h-10 text-ink-subtle mx-auto mb-4" strokeWidth={1.5} />
    <h2 className="font-bold text-ink-strong mb-2">Vartijanäkymä</h2>
    <p className="text-sm text-ink-muted leading-relaxed max-w-md mx-auto">
      Tähän rakennetaan se, mitä vuorossa oleva vartija näkee tietokoneella.
      Sisältöä ei ole vielä lisätty.
    </p>
  </div>
);
