// Audit-loki: kuka teki mitä milloin.
//
// Irrotettu App.tsx:stä. Näkymä valittiin toiseksi irrotuskohteeksi (Hatatilanneohjeet
// oli ensimmäinen) koska sen kytkentä App():n tilaan on kapea ja täysin kuvattavissa:
// viisi audit-tilaa, kaksi kutsua ja kaksi tietoa. Kaikki muu oli jo tässä paikallista.
//
// Sivun kuori (yläpalkki, overlayt) jää App.tsx:ään, kuten Hatatilanneohjeissa. Näkymä
// renderöi vain sisällön — muuten yläpalkin rakentaja ja overlay-JSX olisi pitänyt
// välittää propseina, mikä olisi vaihtanut yhden kytköksen kahteen huonompaan.
//
// Hakutaulut ovat moduulitasolla eivätkä komponentin sisällä: ne ovat vakioita, eikä
// niitä ole syytä rakentaa uudelleen jokaisella renderöinnillä.

import type { Dispatch, SetStateAction } from 'react';
import { ShieldAlert } from 'lucide-react';

import { TakaisinLinkki } from '../../shared/komponentit/TakaisinLinkki';
import { muotoileAikaleima } from '../../shared/ajat';
import { findEventName } from '../tapahtumat';
import type { AuditMerkinta, Tapahtuma } from '../tyypit';

// Toimintojen ihmisluettavat nimet. Tuntematon toiminto näytetään sellaisenaan, jotta
// palvelimelle lisätty uusi toimintolaji näkyy lokissa heti eikä vasta kun tämä lista
// on päivitetty.
const TOIMINNOT: Record<string, string> = {
  create: 'Luotu',
  update: 'Muokattu',
  delete: 'Poistettu',
  login_success: 'Kirjautui sisään',
  login_failed: 'Epäonnistunut kirjautuminen',
  user_create: 'Loi käyttäjän',
  user_update: 'Muokkasi käyttäjää',
  totp_reset: 'Nollasi Authenticatorin',
  totp_required_change: 'Muutti Authenticator-vaatimusta',
  force_logout: 'Pakotti uloskirjautumaan',
  password_change: 'Vaihtoi salasanan',
  user_password_set: 'Asetti käyttäjän salasanan',
  sms_send: 'Lähetti hätäviestin',
  sms_dryrun: 'Hätäviesti (kuivaharjoittelu)',
  sms_failed: 'Hätäviestin lähetys epäonnistui',
  sms_replies: 'Vastauksia hätäviestiin',
  sms_saldo_vahissa: 'SMS-saldo alle varoitusrajan',
  sms_webhook_rejected: 'Webhook hylätty (väärä salaisuus)',
};

const KOKOELMAT: Record<string, string> = {
  checkins: 'Sisäänkirjaukset',
  reports: 'Raportit',
  events: 'Tapahtumat',
  riskAssessments: 'Riskiarviot',
  employees: 'Työntekijäpankki',
  smsButtons: 'Pikatoiminnot',
};

// Korostettavat rivit: epäonnistunut kirjautuminen ja epäonnistunut hätäviesti ovat
// molemmat asioita jotka lokia selaavan pitää huomata heti.
const korostaVirheena = (a?: string) =>
  a === 'login_failed' || a === 'sms_failed' || a === 'sms_webhook_rejected' || a === 'sms_saldo_vahissa';

const targetLabel = (e: AuditMerkinta) => {
  if (e.collection) {
    const label = KOKOELMAT[e.collection] || e.collection;
    return e.recordId ? `${label} (${e.recordId})` : label;
  }
  if (e.targetUser) return e.targetUser;
  return '—';
};

export type AuditSuodattimet = { user: string; action: string; collection: string };

type Props = {
  merkinnat: AuditMerkinta[];
  lataa: boolean;
  virhe: string;
  // Onko palvelimella vielä lisää rivejä tämän sivun jälkeen.
  lisaaLadattavaa: boolean;
  suodattimet: AuditSuodattimet;
  // Reactin setter-muoto, koska suodatinkentät päivittävät yhtä kenttää kerrallaan
  // päivitysfunktiolla (prev => ...).
  onSuodattimet: Dispatch<SetStateAction<AuditSuodattimet>>;
  // Ilman argumenttia hakee alusta, aikaleimalla jatkaa siitä eteenpäin.
  onHae: (before?: string) => void;
  onTakaisin: () => void;
  // Palvelin rajaa /api/audit-reitin pääkäyttäjään. Muille näytetään selitys sen
  // sijaan, että lista jäisi tyhjäksi ilman syytä.
  isAdmin: boolean;
  // Tapahtumasarakkeen nimen selvittämiseen (merkinnässä on vain eventId).
  tapahtumat: Tapahtuma[];
};

export const AuditLoki = ({
  merkinnat, lataa, virhe, lisaaLadattavaa, suodattimet, onSuodattimet, onHae,
  onTakaisin, isAdmin, tapahtumat,
}: Props) => (
    <div className="max-w-5xl mx-auto">
      <TakaisinLinkki onClick={() => onTakaisin()}>
        Takaisin
      </TakaisinLinkki>

      {!isAdmin ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center">
          <ShieldAlert className="text-rose-400 mx-auto mb-4" size={40} />
          <h2 className="text-lg font-bold text-slate-800 mb-1">Ei käyttöoikeutta</h2>
          <p className="text-sm text-slate-500">Audit-loki on vain pääkäyttäjille.</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Audit-loki</h2>
            <p className="text-sm text-slate-500 mt-1">
              Kuka teki mitä milloin — luonnit, muokkaukset, poistot, käyttäjähallinta ja kirjautumiset.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Käyttäjä</label>
              <input
                type="text"
                value={suodattimet.user}
                onChange={(e) => onSuodattimet((f) => ({ ...f, user: e.target.value }))}
                placeholder="esim. Johto1"
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Toiminto</label>
              <select
                value={suodattimet.action}
                onChange={(e) => onSuodattimet((f) => ({ ...f, action: e.target.value }))}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">Kaikki</option>
                {Object.entries(TOIMINNOT).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Kokoelma</label>
              <select
                value={suodattimet.collection}
                onChange={(e) => onSuodattimet((f) => ({ ...f, collection: e.target.value }))}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">Kaikki</option>
                {Object.entries(KOKOELMAT).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => onHae()}
              className="px-4 py-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              Suodata
            </button>
          </div>

          {virhe && <p className="text-sm text-rose-600 mb-4">{virhe}</p>}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">Ajankohta</th>
                  <th className="p-4">Käyttäjä</th>
                  <th className="p-4">Toiminto</th>
                  <th className="p-4">Kohde</th>
                  <th className="p-4">Tapahtuma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lataa && merkinnat.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Ladataan…</td></tr>
                ) : merkinnat.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Ei lokirivejä.</td></tr>
                ) : merkinnat.map((e, i) => (
                  <tr key={i} className={`hover:bg-slate-50 transition-colors ${korostaVirheena(e.action) ? 'bg-rose-50/50' : ''}`}>
                    <td className="p-4 text-slate-500 text-xs whitespace-nowrap">{muotoileAikaleima(e.ts)}</td>
                    <td className="p-4 font-mono text-xs text-slate-700">{e.user || '—'}</td>
                    <td className="p-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${korostaVirheena(e.action) ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                        {(e.action && TOIMINNOT[e.action]) || e.action || '—'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-700 text-xs">{targetLabel(e)}</td>
                    <td className="p-4 text-slate-500 text-xs">{e.eventId ? findEventName(e.eventId, tapahtumat) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lisaaLadattavaa && (
            <div className="text-center mt-4">
              <button
                onClick={() => onHae(merkinnat[merkinnat.length - 1]?.ts)}
                disabled={lataa}
                className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-slate-200 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-60"
              >
                {lataa ? 'Ladataan…' : 'Lataa lisää'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
);
