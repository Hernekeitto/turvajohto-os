import { useState } from 'react';
import { AlertTriangle, Check, Copy, Eye, EyeOff } from 'lucide-react';

// Palvelimen arpoma väliaikainen salasana. Se ei tallennu selväkielisenä, joten tämä on
// ainoa hetki jolloin sen voi lukea — siksi se ei ole ohimenevä ilmoitus vaan laatikko
// joka suljetaan käsin. Jaettu käyttäjähallinnan ja työntekijäpankin tunnusosion kesken.
//
// Salasana on oletuksena PIILOSSA ja tulee näkyviin silmäpainikkeesta. Kun se on jo
// lähtenyt työntekijälle tekstiviestinä, pääkäyttäjän ei tarvitse nähdä sitä lainkaan,
// eikä se päädy kuvakaappaukseen tai olan yli katsojalle vahingossa. Kopiointi toimii
// myös piilotettuna.
export type SalasanaNaytto = { username: string; password: string; syy: 'luotu' | 'nollattu' };

type Props = SalasanaNaytto & { onSulje: () => void };

export const KertaSalasana = ({ username, password, syy, onSulje }: Props) => {
  const [kopioitu, setKopioitu] = useState(false);
  const [nakyvissa, setNakyvissa] = useState(false);

  const kopioi = () => {
    navigator.clipboard?.writeText(password).then(
      () => setKopioitu(true),
      () => { /* leikepöytä voi olla estetty; salasanan saa silti näkyviin silmäpainikkeesta */ },
    );
  };

  return (
    <div className="border border-warning/40 bg-warning-soft rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-warning-ink shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-warning-ink">
            {syy === 'luotu' ? 'Käyttäjä luotu' : 'Salasana nollattu'}: {username}
          </p>
          <p className="text-xs text-warning-ink mt-1">
            Väliaikainen salasana näkyy vain nyt. Välitä se käyttäjälle turvallisesti —
            hän joutuu vaihtamaan sen ensimmäisellä kirjautumisella.
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <code className="font-mono text-sm bg-surface border border-line rounded px-2 py-1 select-all">
              {nakyvissa ? password : '•'.repeat(password.length)}
            </code>
            <button
              type="button"
              onClick={() => setNakyvissa((n) => !n)}
              aria-label={nakyvissa ? 'Piilota salasana' : 'Näytä salasana'}
              title={nakyvissa ? 'Piilota salasana' : 'Näytä salasana'}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-accent"
            >
              {nakyvissa ? <EyeOff size={14} /> : <Eye size={14} />}
              {nakyvissa ? 'Piilota' : 'Näytä'}
            </button>
            <button
              type="button"
              onClick={kopioi}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-accent"
            >
              {kopioitu ? <Check size={14} /> : <Copy size={14} />}
              {kopioitu ? 'Kopioitu' : 'Kopioi'}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onSulje}
          className="text-xs font-medium text-warning-ink underline shrink-0"
        >
          Sulje
        </button>
      </div>
    </div>
  );
};
