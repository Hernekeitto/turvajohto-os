// Tallennetut (arkistoidut) tapahtumat: lista ja yhden tapahtuman tiedot.
//
// Irrotettu App.tsx:stä. Kaksi komponenttia samassa tiedostossa, koska tiedot on
// saavutettavissa vain listan kautta eivätkä ne ole erikseen käytettäviä.
//
// Sivun kuori jää App.tsx:ään (ks. AuditLoki.tsx:n perustelu). Kutsuja valitsee kumpi
// näistä renderöidään; kummallakin on eri leveys, joten kuori ei ole yhteinen.
//
// Tapahtuman omien kirjausten suodatus tehdään täällä eikä kutsujassa: näkymä tietää
// mitä se tarvitsee, ja kutsujan tehtäväksi jää antaa täydet listat.

import { Archive, ChevronRight, Paperclip, Trash2 } from 'lucide-react';

import { TakaisinLinkki } from '../../shared/komponentit/TakaisinLinkki';
import { EmpStatusBadge } from '../../shared/komponentit/EmpStatusBadge';
import { muotoileAikaleima, muotoilePaivays } from '../../shared/ajat';
import { FORM_FIELD_GROUPS } from '../kirjausvakiot';
import type { Checkin } from '../tyontekijat';
import type { Kirjaus, Tapahtuma } from '../tyypit';

type ListaProps = {
  // Vain arkistoidut tapahtumat; kutsuja on jo suodattanut ne.
  tapahtumat: Tapahtuma[];
  onAvaa: (id: string) => void;
  onTakaisin: () => void;
};

export const ArkistoidutTapahtumat = ({ tapahtumat, onAvaa, onTakaisin }: ListaProps) => (
    <div className="max-w-5xl mx-auto">
      <TakaisinLinkki onClick={() => onTakaisin()}>
        Takaisin etusivulle
      </TakaisinLinkki>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Tallennetut tapahtumat</h2>
        <p className="text-sm text-slate-500 mt-1">
          Poistetut tapahtumat säilyvät tässä raportteineen ja kirjauksineen ({tapahtumat.length} kpl).
        </p>
      </div>

      {tapahtumat.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
          Ei poistettuja tapahtumia.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {tapahtumat.map((ev) => (
            <button
              key={ev.id}
              onClick={() => onAvaa(ev.id)}
              className="bg-white rounded-xl border-2 border-slate-200 hover:border-indigo-400 shadow-sm hover:shadow-md transition-all p-6 text-left group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-lg bg-slate-100 text-slate-500 group-hover:scale-110 transition-transform duration-200">
                  <Archive size={24} />
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                  Poistettu
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-800">{ev.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{ev.client}</p>
              <p className="text-xs text-slate-400 mt-3">
                Poistettu {muotoilePaivays(ev.archivedAt)}
              </p>
              <div className="mt-5 pt-4 border-t border-slate-100 text-sm font-bold text-indigo-600 flex items-center gap-1">
                Näytä tiedot
                <ChevronRight size={16} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
);

type TiedotProps = {
  tapahtuma: Tapahtuma;
  // Täydet listat; suodatus tähän tapahtumaan tehdään alla.
  kirjaukset: Kirjaus[];
  sisaankirjaukset: Checkin[];
  riskiarviot: any[];
  // Pysyvä poisto on vain pääkäyttäjälle (ks. handlePermanentDeleteEvent).
  isAdmin: boolean;
  onPoistaPysyvasti: (tapahtuma: Tapahtuma) => void;
  onTakaisin: () => void;
};

export const ArkistoidunTapahtumanTiedot = ({
  tapahtuma, kirjaukset, sisaankirjaukset, riskiarviot, isAdmin, onPoistaPysyvasti, onTakaisin,
}: TiedotProps) => {
  const eventReports = kirjaukset.filter(r => (r.eventId || 'fesx') === tapahtuma.id && !r.deletedAt);
  const eventCheckins = sisaankirjaukset.filter(e => (e.eventId || 'fesx') === tapahtuma.id);
  const eventRisks = riskiarviot.filter(r => (r.eventId || 'fesx') === tapahtuma.id);

  return (
    <div className="max-w-6xl mx-auto">
      <TakaisinLinkki onClick={() => onTakaisin()}>
      Takaisin tallennettuihin tapahtumiin
    </TakaisinLinkki>

      <div className="mb-6 bg-slate-100 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
        <Archive className="text-slate-500 shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-slate-700">
          <span className="font-bold">{tapahtuma.name}</span> — poistettu {muotoileAikaleima(tapahtuma.archivedAt)}.
          Tiedot ovat vain luku -tilassa.
        </div>
      </div>

      <h3 className="text-lg font-bold text-slate-800 mb-3">Tapahtuman perustiedot (luontilomake)</h3>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8 space-y-6">
        {(() => {
          const fd = tapahtuma.formData || {};
          const groupsWithData = FORM_FIELD_GROUPS
            .map(group => ({
              ...group,
              fields: group.fields.filter(f => {
                const v = fd[f.key];
                return f.bool ? !!v : !!(v && String(v).trim());
              })
            }))
            .filter(group => group.fields.length > 0);

          if (groupsWithData.length === 0) {
            return <p className="text-sm text-slate-500">Ei tallennettuja lomaketietoja tälle tapahtumalle.</p>;
          }

          return groupsWithData.map(group => (
            <div key={group.title}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{group.title}</h4>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                {group.fields.map(f => (
                  <div key={f.key} className="text-sm">
                    <dt className="text-slate-500">{f.label}</dt>
                    <dd className="text-slate-800 font-medium">{f.bool ? 'Kyllä' : fd[f.key]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ));
        })()}
      </div>

      <h3 className="text-lg font-bold text-slate-800 mb-3">Raportit ({eventReports.length})</h3>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto mb-8">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-4">Tunniste</th>
              <th className="p-4">Tyyppi</th>
              <th className="p-4">Laatija</th>
              <th className="p-4">Aika</th>
              <th className="p-4">Liite</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {eventReports.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Ei raportteja.</td></tr>
            ) : eventReports.map((report) => (
              <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-mono text-xs text-slate-700">{report.id}</td>
                <td className="p-4 font-medium text-slate-800">{report.type}</td>
                <td className="p-4 text-slate-600">{report.author}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-bold text-slate-800 mb-3">Tapahtumaan merkityt työntekijät ({eventCheckins.length})</h3>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-4">Nimi</th>
              <th className="p-4">Rooli</th>
              <th className="p-4">Sisäänkirjattu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {eventCheckins.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-sm text-slate-500">Ei työntekijöitä merkitty tapahtumaan.</td></tr>
            ) : eventCheckins.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-medium text-slate-800">{emp.name}</td>
                <td className="p-4 text-slate-600">{emp.role}</td>
                <td className="p-4"><EmpStatusBadge emp={emp} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pysyvä poisto: vain adminille, ks. handlePermanentDeleteEvent */}
      {isAdmin && (
        <div className="mt-10 bg-white rounded-xl border-2 border-rose-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-rose-700 flex items-center gap-2">
            <Trash2 size={18} />
            Poista tapahtuma pysyvästi
          </h3>
          <p className="text-sm text-slate-600 mt-2 max-w-3xl">
            Poistaa tapahtuman ja kaiken siihen liittyvän datan lopullisesti:
            {' '}<span className="font-semibold">{eventReports.length} raporttia</span>,
            {' '}<span className="font-semibold">{eventCheckins.length} työntekijäkirjausta</span> ja
            {' '}<span className="font-semibold">{eventRisks.length} riskiarviota</span>.
            Poistoa ei voi perua eikä dataa saa takaisin arkistosta.
          </p>
          <p className="text-xs text-slate-500 mt-2 max-w-3xl">
            Huomioi ennen poistoa, onko tapahtumailmoituksilla tai voimankäyttöraporteilla
            vielä lakisääteinen säilytysvelvollisuus.
          </p>
          <button
            type="button"
            onClick={() => onPoistaPysyvasti(tapahtuma)}
            className="mt-4 px-5 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Trash2 size={16} />
            Poista pysyvästi
          </button>
        </div>
      )}
    </div>
  );
};
