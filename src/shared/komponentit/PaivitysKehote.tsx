// Päivityskehote. Näkyy kun palvelutyöntekijä on ladannut uuden version ja se odottaa
// käyttöönottoa.
//
// Kehote on ilmoitus eikä pakko: käyttäjä päättää milloin sivu ladataan uudelleen.
// Kentällä uudelleenlataus kesken kirjauksen tarkoittaisi, että juuri kirjoitettu
// havainto on kirjoitettava uudelleen — ja se on pahempi kuin muutaman tunnin vanha
// sovellusversio.
//
// Renderöidään main.tsx:ssä molempien puolien ulkopuolella, koska päivitys koskee koko
// sovellusnippua eikä kumpaakaan tuotetta erikseen.
import { useEffect, useState } from 'react';

import { kuuntelePaivitysta, otaPaivitysKayttoon } from '../palvelutyontekija';

export function PaivitysKehote() {
  const [saatavilla, setSaatavilla] = useState(false);
  const [piilotettu, setPiilotettu] = useState(false);

  useEffect(() => kuuntelePaivitysta(({ saatavilla: uusi }) => setSaatavilla(uusi)), []);

  if (!saatavilla || piilotettu) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] w-[min(28rem,calc(100vw-2rem))]">
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface shadow-lg px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-strong">Uusi versio on valmiina</p>
          <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
            Päivitys otetaan käyttöön sivun latautuessa. Tallenna kesken oleva kirjaus ensin.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPiilotettu(true)}
            className="text-xs font-medium text-ink-muted hover:text-ink-body px-2 py-1.5 transition-colors"
          >
            Myöhemmin
          </button>
          <button
            type="button"
            onClick={otaPaivitysKayttoon}
            className="text-xs font-bold text-white bg-accent hover:bg-accent-hover rounded-lg px-3 py-1.5 transition-colors"
          >
            Päivitä nyt
          </button>
        </div>
      </div>
    </div>
  );
}
