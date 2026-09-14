// Hätäviestien lähetyshistoria ja toimitustilat.
//
// Irrotettu App.tsx:stä. Sivun kuori jää App.tsx:ään (ks. AuditLoki.tsx:n perustelu).
//
// Tapahtuman omien lähetysten suodatus ja järjestys tehdään täällä: se on tämän listan
// esitystapa, ja kutsujan tehtäväksi jää antaa koko loki.

import { ChevronDown, Smartphone } from 'lucide-react';

import { TakaisinLinkki } from '../../shared/komponentit/TakaisinLinkki';
import { findEventName } from '../tapahtumat';
import { koostaSmsTilanne, smsRyhmanLabel, smsTilaMeta } from '../sms';
import type { Tapahtuma } from '../tyypit';

type Props = {
  // Koko loki; suodatus tapahtumaan tehdään alla.
  lahetykset: any[];
  vastaukset: any[];
  tapahtumaId: string | null;
  tapahtumat: Tapahtuma[];
  // Ilman webhook-salaisuutta palvelin ei saa toimituskuittauksia, jolloin tilat
  // jäävät arvoon "Vastaanotettu" — siitä on kerrottava eikä esitettävä varmuutta.
  webhookKaytossa: boolean;
  virhe: string | null;
  // Avatun lähetyksen id, tai null kun kaikki ovat kiinni.
  avattu: string | null;
  onAvaa: (id: string | null) => void;
  onTakaisin: () => void;
};

export const HataviestiLoki = ({
  lahetykset, vastaukset: kaikkiVastaukset, tapahtumaId, tapahtumat, webhookKaytossa,
  virhe, avattu, onAvaa, onTakaisin,
}: Props) => {
  const omatLahetykset = lahetykset
    .filter((l: any) => (l.eventId || 'fesx') === tapahtumaId)
    .sort((a: any, b: any) => String(b.ts || '').localeCompare(String(a.ts || '')));

  return (
    <div className="max-w-4xl mx-auto text-left">
      <TakaisinLinkki onClick={() => onTakaisin()}>
        Takaisin
      </TakaisinLinkki>

      <h2 className="text-2xl font-bold text-slate-800 mb-1">Lähetetyt hätäviestit</h2>
      <p className="text-sm text-slate-500 mb-6">
        {findEventName(tapahtumaId, tapahtumat)} · toimitustilat päivittyvät automaattisesti
        BulkSMS:n toimituskuittauksista.
      </p>

      {!webhookKaytossa && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
          <strong>Toimituskuittaukset eivät ole käytössä.</strong> Webhook-salaisuutta ei ole asetettu
          palvelimelle, joten viestit näkyvät tilassa "Vastaanotettu" eikä perillemenoa voi todentaa.
        </p>
      )}

      {virhe && <p className="text-sm text-rose-600 mb-4">{virhe}</p>}

      {omatLahetykset.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <Smartphone className="text-slate-300 mx-auto mb-4" size={40} />
          <p className="text-sm text-slate-500">Tästä tapahtumasta ei ole lähetetty yhtään hätäviestiä.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {omatLahetykset.map((lahetys: any) => {
            const tilanne = koostaSmsTilanne(lahetys);
            const auki = avattu === lahetys.id;
            const vastaukset = kaikkiVastaukset.filter((v: any) => v.sendId === lahetys.id);
            return (
              <div key={lahetys.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => onAvaa(auki ? null : lahetys.id)}
                  className="w-full text-left p-5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <span className="truncate">{lahetys.label}</span>
                        {lahetys.dryRun && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                            KUIVAHARJOITTELU
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(lahetys.ts).toLocaleString('fi-FI')} · {lahetys.user} · {smsRyhmanLabel(lahetys.group)}
                      </p>
                    </div>
                    <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${auki ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Toimitustilanne yhdellä silmäyksellä: hätätilanteessa oleellisin
                      luku on kuinka moni EI saanut viestiä. */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {tilanne.perilla > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        {tilanne.perilla} perillä
                      </span>
                    )}
                    {tilanne.matkalla > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700">
                        {tilanne.matkalla} matkalla
                      </span>
                    )}
                    {tilanne.epaonnistui > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                        {tilanne.epaonnistui} ei perille
                      </span>
                    )}
                    {tilanne.kuivaharjoittelu > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                        {tilanne.kuivaharjoittelu} simuloitu
                      </span>
                    )}
                    {lahetys.skipped?.length > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                        {lahetys.skipped.length} ilman numeroa
                      </span>
                    )}
                    {vastaukset.length > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                        {vastaukset.length} vastausta
                      </span>
                    )}
                  </div>
                </button>

                {auki && (
                  <div className="border-t border-slate-100 p-5 space-y-4 bg-slate-50">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Lähetetty viesti</h4>
                      <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-lg p-3 font-mono leading-snug">
                        {lahetys.body}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Vastaanottajat ({lahetys.recipients?.length || 0})
                      </h4>
                      <ul className="text-xs bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                        {(lahetys.recipients || []).map((s: any, i: number) => {
                          const meta = smsTilaMeta(s.status);
                          return (
                            <li key={i} className="px-3 py-2 flex justify-between items-center gap-2">
                              <span className="truncate">
                                <span className="font-medium text-slate-800">{s.nimi || '(tuntematon)'}</span>
                                {s.rooli ? <span className="text-slate-500"> · {s.rooli}</span> : null}
                                <span className="text-slate-400 font-mono ml-2">{s.numero}</span>
                              </span>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${meta.tone}`}>
                                {meta.label}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {lahetys.skipped?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1">
                          Ei tavoitettu ({lahetys.skipped.length})
                        </h4>
                        <ul className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg divide-y divide-amber-200">
                          {lahetys.skipped.map((v: any, i: number) => (
                            <li key={i} className="px-3 py-2"><span className="font-medium">{v.nimi}</span> — {v.syy}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {vastaukset.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-1">
                          Vastaukset ({vastaukset.length})
                        </h4>
                        <ul className="text-xs bg-white border border-indigo-200 rounded-lg divide-y divide-indigo-100">
                          {vastaukset.map((v: any) => (
                            <li key={v.id} className="px-3 py-2">
                              <div className="flex justify-between gap-2">
                                <span className="font-medium text-slate-800 truncate">
                                  {v.nimi || v.numero || '(tuntematon)'}
                                </span>
                                <span className="text-slate-400 shrink-0">
                                  {v.ts ? new Date(v.ts).toLocaleString('fi-FI') : ''}
                                </span>
                              </div>
                              <p className="text-slate-700 mt-1">{v.body}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {lahetys.repliable && vastaukset.length === 0 && (
                      <p className="text-xs text-slate-500">
                        Viesti lähetettiin vastattavana, mutta yhtään vastausta ei ole vielä saapunut.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
