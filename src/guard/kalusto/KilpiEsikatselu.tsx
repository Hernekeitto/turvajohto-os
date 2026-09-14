// Kalustokilpien esikatselu ennen tulostusta.
//
// Esikatselu on tässä samasta syystä kuin tarkistuspisteiden tarroissa: kilpi on FYYSINEN
// esine joka kiinnitetään ja jonka on kestettävä vuosia. Ero on se mitä tarkistetaan.
// Pisteen tarrasta tarkistetaan koodi, koska sen sisältö on arvaamaton merkkijono;
// kilvestä tarkistetaan että QR ylipäätään latautui — tunnus itse tulee palvelimelta
// eikä voi olla väärä, mutta puuttuva koodi tekisi kilvestä pelkän tarran.
import { Printer, X } from 'lucide-react';

import type { TulostettavaKilpimerkki } from '../../shared/tuloste';

type Props = {
  kilvet: TulostettavaKilpimerkki[];
  lataa: boolean;
  virhe?: string | null;
  onTulosta: () => void;
  onSulje: () => void;
};

export const KilpiEsikatselu = ({ kilvet, lataa, virhe, onTulosta, onSulje }: Props) => {
  // Takaisin-napin este on kutsujassa eikä täällä — ks. KalustoKortti.tsx:n selitys
  // StrictModen kaksoisajosta.
  const puuttuvia = kilvet.filter((k) => !k.qrDataUri).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4 py-6">
      <div className="bg-surface rounded-xl shadow-xl border border-line w-full max-w-3xl max-h-full flex flex-col">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-line-soft">
          <div className="min-w-0">
            <h3 className="font-bold text-ink-strong">Kalustokilvet</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              {kilvet.length} {kilvet.length === 1 ? 'kilpi' : 'kilpeä'} · tarkista tunnukset ennen tulostusta
            </p>
          </div>
          <button
            type="button"
            onClick={onSulje}
            className="p-1.5 rounded-lg text-ink-muted hover:bg-sunken shrink-0"
            aria-label="Sulje"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {lataa && <p className="text-sm text-ink-muted">Haetaan koodeja…</p>}
          {virhe && (
            <div className="text-sm bg-danger-soft text-danger-ink border border-danger/30 rounded-lg px-3 py-2 mb-4">
              {virhe}
            </div>
          )}
          {!lataa && puuttuvia > 0 && (
            <div className="text-sm bg-warning-soft text-warning-ink border border-warning/30 rounded-lg px-3 py-2 mb-4">
              {puuttuvia === kilvet.length
                ? 'QR-koodeja ei saatu palvelimelta. Kilvissä on tunnus mutta ei koodia.'
                : `${puuttuvia} kilven QR-koodia ei saatu. Ne tulostuvat ilman koodia.`}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {kilvet.map((kilpi) => (
              <div key={kilpi.tunnus} className="text-center">
                <div className="border-2 border-ink-strong rounded-lg p-3 flex flex-col items-center bg-white">
                  <span className="text-[8px] uppercase tracking-widest text-slate-900 mb-1">
                    Turvajohto OS
                  </span>
                  {kilpi.qrDataUri
                    ? <img src={kilpi.qrDataUri} alt="" className="w-20 h-20" />
                    : <div className="w-20 h-20 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-500">ei koodia</div>}
                  <span className="font-mono text-xs font-bold text-slate-900 mt-1">{kilpi.tunnus}</span>
                </div>
                <p className="text-[11px] text-ink-muted mt-1 leading-tight">{kilpi.nimi}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-line-soft">
          <button
            type="button"
            onClick={onSulje}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
          >
            Sulje
          </button>
          <button
            type="button"
            disabled={lataa || kilvet.length === 0}
            onClick={onTulosta}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95 disabled:opacity-50"
          >
            <Printer size={15} />
            Tulosta
          </button>
        </div>
      </div>
    </div>
  );
};
