// Minulle jaetut: nimellä jaetut tiedostot ja kansiot.
//
// Irrotettu App.tsx:stä. Kapein näkymistä: kaksi tilaa, yksi kutsu ja tapahtumalista
// nimen näyttämiseen. Sivun kuori jää App.tsx:ään (ks. AuditLoki.tsx:n perustelu).

import { FileText, Layers, Paperclip } from 'lucide-react';

import { TakaisinLinkki } from '../../shared/komponentit/TakaisinLinkki';
import { findEventName } from '../tapahtumat';
import type { JaettuKohde, Tapahtuma } from '../tyypit';

type Props = {
  jaot: JaettuKohde[];
  lataa: boolean;
  onTakaisin: () => void;
  // Jaon tapahtuman nimen näyttämiseen — kohteessa on vain eventId.
  tapahtumat: Tapahtuma[];
};

export const MinulleJaetut = ({ jaot, lataa, onTakaisin, tapahtumat }: Props) => (
    <div className="max-w-4xl mx-auto">
      <TakaisinLinkki onClick={() => onTakaisin()}>
        Takaisin etusivulle
      </TakaisinLinkki>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Minulle jaetut</h2>
        <p className="text-sm text-slate-500 mt-1">
          Tiedostot ja kansiot jotka on jaettu sinulle nimellä. Näet ne täältä vaikka
          sinulla ei olisi muuten pääsyä kyseiseen tapahtumaan.
        </p>
      </div>

      {lataa ? (
        <p className="text-sm text-slate-500">Ladataan…</p>
      ) : jaot.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <Paperclip className="text-slate-300 mx-auto mb-3" size={36} />
          <p className="text-sm text-slate-500">Sinulle ei ole jaettu tiedostoja.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jaot.map((jako) => (
            <div key={jako.shareId} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {jako.type === 'folder'
                      ? <Layers size={18} className="text-indigo-500 shrink-0" />
                      : <FileText size={18} className="text-slate-400 shrink-0" />}
                    <h3 className="text-sm font-bold text-slate-800 truncate">{jako.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Jakanut {jako.sharedBy}
                    {jako.sharedAt && ` · ${new Date(jako.sharedAt).toLocaleDateString('fi-FI')}`}
                    {' · '}
                    {findEventName(jako.eventId, tapahtumat)}
                  </p>
                </div>
                {jako.expiresAt && (
                  <span className="shrink-0 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                    Voimassa {new Date(jako.expiresAt).toLocaleDateString('fi-FI')} asti
                  </span>
                )}
              </div>

              {jako.files.length === 0 ? (
                <p className="text-sm text-slate-500">Ei ladattavia tiedostoja.</p>
              ) : (
                <div className="border border-slate-100 rounded-lg divide-y divide-slate-100">
                  {jako.files.map((f) => (
                    <div key={f.id} className="p-3 flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-700 truncate">{f.name}</span>
                      <a
                        href={`/api/uploads/${f.uploadId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                      >
                        Lataa
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
);
