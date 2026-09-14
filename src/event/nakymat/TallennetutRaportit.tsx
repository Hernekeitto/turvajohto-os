// Tallennetut raportit: kaikki kirjaukset kaikista tapahtumista samassa listassa.
//
// Irrotettu App.tsx:stä. Sivun kuori jää App.tsx:ään (ks. AuditLoki.tsx:n perustelu).
//
// Lajittelu tehdään täällä eikä kutsujassa: se on tämän listan esitystapa, ja
// lajitteluperusteen lisääminen on nyt yksi rivi JARJESTYKSET-taulukkoon eikä muutos
// kahteen tiedostoon.

import { Paperclip } from 'lucide-react';

import { TakaisinLinkki } from '../../shared/komponentit/TakaisinLinkki';
import { findEventName } from '../tapahtumat';
import type { Kirjaus, Tapahtuma } from '../tyypit';

const JARJESTYKSET = [
  { id: 'newest', label: 'Uusin' },
  { id: 'id', label: 'Tunniste' },
  { id: 'author', label: 'Kirjaaja' },
  { id: 'event', label: 'Tapahtuma' },
];

type Props = {
  kirjaukset: Kirjaus[];
  jarjestys: string;
  onJarjestys: (id: string) => void;
  // Toinen argumentti: false = esikatselu omaan välilehteen, true = tulostusikkuna.
  onAvaaPdf: (kirjaus: Kirjaus, tulosta: boolean) => void;
  onTakaisin: () => void;
  // Tapahtumasarakkeen nimen selvittämiseen (kirjauksessa on vain eventId).
  tapahtumat: Tapahtuma[];
};

export const TallennetutRaportit = ({
  kirjaukset, jarjestys, onJarjestys, onAvaaPdf, onTakaisin, tapahtumat,
}: Props) => {
  // Roskakoriin siirretyt eivät kuulu raporttilistaukseen (ks. handleDeleteReport).
  const jarjestetyt = kirjaukset.filter((r) => !r.deletedAt).sort((a, b) => {
    if (jarjestys === 'id') return String(a.id).localeCompare(String(b.id));
    if (jarjestys === 'author') return String(a.author || '').localeCompare(String(b.author || ''));
    if (jarjestys === 'event') return findEventName(a.eventId, tapahtumat).localeCompare(findEventName(b.eventId, tapahtumat));
    return 0; // 'newest' — tallennusjärjestys on jo uusin ensin
  });

  return (
    <div className="max-w-6xl mx-auto">
      <TakaisinLinkki onClick={() => onTakaisin()}>
        Takaisin etusivulle
      </TakaisinLinkki>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tallennetut raportit</h2>
          <p className="text-sm text-slate-500 mt-1">
            Kaikki kirjaukset kaikista tapahtumista samassa listassa ({jarjestetyt.length} kpl).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
          <span className="text-xs font-medium text-slate-400 pl-2 pr-1 hidden sm:inline">Lajittele:</span>
          {JARJESTYKSET.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onJarjestys(opt.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                jarjestys === opt.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-4">Tunniste</th>
              <th className="p-4">Tyyppi</th>
              <th className="p-4">Laatija</th>
              <th className="p-4">Tapahtuma</th>
              <th className="p-4">Aika</th>
              <th className="p-4">Liite</th>
              <th className="p-4 text-right">Toiminnot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {jarjestetyt.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                  Ei vielä tallennettuja raportteja.
                </td>
              </tr>
            ) : jarjestetyt.map((report) => (
              <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-mono text-xs text-slate-700">{report.id}</td>
                <td className="p-4 font-medium text-slate-800">{report.type}</td>
                <td className="p-4 text-slate-600">{report.author}</td>
                <td className="p-4 text-slate-600">{findEventName(report.eventId, tapahtumat)}</td>
                <td className="p-4 font-mono text-slate-600">{report.time}</td>
                <td className="p-4">
                  {report.attachment ? (
                    <a
                      href={`/api/uploads/${report.attachment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      <Paperclip size={12} />
                      {report.attachment.name}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onAvaaPdf(report, false)}
                      title="Avaa tulostusversio esikatseluun"
                      className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
                    >
                      Esikatsele
                    </button>
                    <button
                      type="button"
                      onClick={() => onAvaaPdf(report, true)}
                      title="Avaa tulostusikkunan, josta tallennetaan PDF-tiedostona"
                      className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors"
                    >
                      Tallenna PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
