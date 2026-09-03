// Lähtevän jonon tila: "n kirjausta odottaa lähetystä".
//
// Näkyy vain kun jonossa on jotain. Kentällä tämä on se ainoa merkki siitä, että
// kirjaus on tallessa mutta ei vielä perillä — ja ilman sitä vartija ei tietäisi kumpi
// tilanne on päällä. Piilottaminen olisi väärä oletus: hiljaisuus tulkittaisiin
// onnistumiseksi.
import { useEffect, useState } from 'react';
import { CloudOff, ChevronDown, ChevronUp, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';

import { kuunteleJonoa, poistaJonosta, tyhjennaJono, yritaUudelleen, type JonoKirjaus } from '../jono';

const kello = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
};

export function JonoTila() {
  const [jono, setJono] = useState<JonoKirjaus[]>([]);
  const [auki, setAuki] = useState(false);

  useEffect(() => kuunteleJonoa(setJono), []);

  if (jono.length === 0) return null;

  const jumissa = jono.filter((k) => k.jumissa).length;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[190] w-[min(30rem,calc(100vw-2rem))]">
      <div className={`rounded-xl border shadow-lg overflow-hidden ${jumissa > 0 ? 'border-danger/40 bg-danger-soft' : 'border-line bg-surface'}`}>
        <button
          type="button"
          onClick={() => setAuki((a) => !a)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          {jumissa > 0
            ? <TriangleAlert size={18} className="text-danger-ink shrink-0" />
            : <CloudOff size={18} className="text-ink-muted shrink-0" />}
          <span className="min-w-0 flex-1">
            <span className={`block text-sm font-medium ${jumissa > 0 ? 'text-danger-ink' : 'text-ink-strong'}`}>
              {jono.length === 1 ? 'Yksi kirjaus odottaa lähetystä' : `${jono.length} kirjausta odottaa lähetystä`}
            </span>
            <span className="block text-xs text-ink-muted mt-0.5">
              {jumissa > 0
                ? `${jumissa} ei mennyt perille — avaa ja tarkista`
                : 'Kirjaukset ovat tallessa laitteella ja lähtevät kun yhteys palaa.'}
            </span>
          </span>
          {auki ? <ChevronDown size={16} className="text-ink-muted shrink-0" /> : <ChevronUp size={16} className="text-ink-muted shrink-0" />}
        </button>

        {auki && (
          <div className="border-t border-line-soft bg-surface">
            <ul className="divide-y divide-line-soft max-h-64 overflow-y-auto">
              {jono.map((kirjaus) => (
                <li key={kirjaus.id} className="px-4 py-2.5 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-strong">{kirjaus.kuvaus}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {kello(kirjaus.luotu)}
                      {kirjaus.yritykset > 0 ? ` · ${kirjaus.yritykset} yritystä` : ''}
                      {kirjaus.viimeinenVirhe ? ` · ${kirjaus.viimeinenVirhe}` : ''}
                    </p>
                  </div>
                  {kirjaus.jumissa && (
                    <>
                      <button
                        type="button"
                        onClick={() => yritaUudelleen(kirjaus.id)}
                        title="Yritä uudelleen"
                        className="p-1.5 rounded-md text-ink-subtle hover:text-accent hover:bg-sunken transition-colors shrink-0"
                      >
                        <RefreshCw size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Poistaminen on käyttäjän tietoinen päätös: jono ei koskaan
                          // hävitä kirjausta itse, koska se on kirjoitettu kerran.
                          if (window.confirm(`Poistetaanko lähettämätön kirjaus "${kirjaus.kuvaus}"? Sitä ei voi palauttaa.`)) {
                            poistaJonosta(kirjaus.id);
                          }
                        }}
                        title="Poista jonosta"
                        className="p-1.5 rounded-md text-ink-subtle hover:text-danger hover:bg-danger-soft transition-colors shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="px-4 py-2.5 border-t border-line-soft">
              <button
                type="button"
                onClick={() => tyhjennaJono()}
                className="text-xs font-bold text-accent hover:text-accent-hover transition-colors"
              >
                Yritä lähettää nyt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
