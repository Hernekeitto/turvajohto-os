import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useSession } from '../SessionContext';

// Turvajohto GUARD -puolen juurikomponentti. Toistaiseksi pelkkä kuori: osoite
// /guard, kirjautuminen ja graafinen ohjeisto ovat paikallaan, mutta varsinaiset
// näkymät rakennetaan vasta kun App.tsx:n yhteiset osat (työntekijäpankki,
// tiedostot, raportointi, käyttäjähallinta) on purettu jaettuun kansioon —
// muuten sama koodi kirjoitettaisiin toiseen kertaan.
export default function GuardApp() {
  const session = useSession();

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <header className="bg-surface-dark text-ink-on-dark px-6 py-4 flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-accent" strokeWidth={1.75} />
        <div className="flex-1">
          <h1 className="font-bold leading-tight">
            Turvajohto <span className="text-accent">GUARD</span>
          </h1>
          <p className="text-xs text-ink-on-dark-muted">Vartiointi</p>
        </div>
        {session && (
          <span className="text-sm text-ink-on-dark-muted">{session.nickname}</span>
        )}
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md bg-surface border border-line rounded-xl p-6 text-center">
          <h2 className="font-bold mb-2 text-ink-strong">Vartiointipuoli on rakenteilla</h2>
          <p className="text-sm text-ink-muted leading-relaxed mb-6">
            Osoite, kirjautuminen ja visuaalinen ilme ovat valmiina. Kohdekierrokset,
            vartiovuorot ja poikkeamat tulevat tähän seuraavissa vaiheissa.
          </p>
          <a
            href="/event"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Siirry tapahtumapuolelle
          </a>
        </div>
      </main>
    </div>
  );
}
