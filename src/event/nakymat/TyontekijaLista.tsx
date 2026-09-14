// Työntekijäpankin lista: koko yrityksen henkilöstörekisteri.
//
// Irrotettu App.tsx:stä. Pankin lomake on samassa hakemistossa (TyontekijanMuokkaus.tsx);
// kutsuja valitsee kumpi renderöidään. Sivun kuori jää App.tsx:ään (ks. AuditLoki.tsx).
//
// Nimihaun suodatus tehdään täällä eikä kutsujassa: se on tämän listan esitystapa.
//
// Muokkausoikeus tulee yhtenä totuusarvona eikä perms/selectedEvent-parina. Sama
// canEdit(perms, selectedEvent, 'global_employee_bank') toistui täällä kahdesti ja
// lomakkeessa kolmesti — yksi lauseke kutsujassa on vähemmän paikkoja erkaantua.

import { Search, UserPlus } from 'lucide-react';

import { muotoileTunniste } from '../../shared/tunnisteet';
import { onKortti, type Tyontekija } from '../tyontekijat';

type Props = {
  tyontekijat: Tyontekija[];
  haku: string;
  onHaku: (teksti: string) => void;
  // isAdminUser || canEdit(perms, selectedEvent, 'global_employee_bank')
  saaMuokata: boolean;
  onUusi: () => void;
  onMuokkaa: (tyontekija: Tyontekija) => void;
  onPoista: (tyontekija: Tyontekija) => void;
};

export const TyontekijaLista = ({
  tyontekijat, haku, onHaku, saaMuokata, onUusi, onMuokkaa, onPoista,
}: Props) => {
  const suodatetut = haku.trim()
    ? tyontekijat.filter(e => (e.name || '').toLowerCase().includes(haku.trim().toLowerCase()))
    : tyontekijat;

  return (
<>
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
    <div>
      <h2 className="text-2xl font-bold text-slate-800">Työntekijäpankki</h2>
      <p className="text-sm text-slate-500 mt-1">
        Kaikki yrityksen työntekijät ({tyontekijat.length} kpl). Täältä luodaan, muokataan ja poistetaan työntekijät.
      </p>
    </div>
    {saaMuokata && (
      <button
        onClick={() => onUusi()}
        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm shrink-0"
      >
        <UserPlus size={16} />
        Uusi työntekijä
      </button>
    )}
  </div>

  <div className="relative mb-4 max-w-sm">
    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
    <input
      type="text"
      value={haku}
      onChange={(e) => onHaku(e.target.value)}
      placeholder="Hae nimellä..."
      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm"
    />
  </div>

  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
    <table className="w-full text-sm text-left">
      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
        <tr>
          <th className="p-4">Nimi</th>
          <th className="p-4 w-24">Tunniste</th>
          <th className="p-4">Henkilötunnus</th>
          <th className="p-4">Kortit</th>
          <th className="p-4">Yhteystiedot</th>
          <th className="p-4 text-right">Toiminnot</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {suodatetut.length === 0 ? (
          <tr>
            <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
              {haku.trim() ? 'Ei hakua vastaavia työntekijöitä.' : 'Ei vielä työntekijöitä rekisterissä.'}
            </td>
          </tr>
        ) : suodatetut.map((emp) => (
          <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
            <td className="p-4 font-medium text-slate-800">{emp.name}</td>
            <td className="p-4">
              {emp.displayId
                ? <span className="font-mono text-xs font-bold text-indigo-700">{muotoileTunniste(emp.displayId)}</span>
                : <span className="text-xs text-slate-400">—</span>}
            </td>
            <td className="p-4 font-mono text-xs text-slate-600">{emp.personalId || '—'}</td>
            <td className="p-4">
              <div className="flex flex-wrap gap-1">
                {onKortti(emp, 'hasJvCard', 'jvCard') && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">JV</span>}
                {onKortti(emp, 'hasGuardCard', 'guardCard') && <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">Vartija</span>}
                {onKortti(emp, 'hasGasPermit', 'gasPermit') && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">Kaasu</span>}
                {!onKortti(emp, 'hasJvCard', 'jvCard') && !onKortti(emp, 'hasGuardCard', 'guardCard') && !onKortti(emp, 'hasGasPermit', 'gasPermit') && <span className="text-xs text-slate-400">-</span>}
              </div>
            </td>
            <td className="p-4 text-slate-500 text-xs">{[emp.email, emp.phone].filter(Boolean).join(' · ') || '—'}</td>
            <td className="p-4 text-right">
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => onMuokkaa(emp)}
                  className="text-indigo-600 hover:text-indigo-900 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                >
                  Muokkaa
                </button>
                {saaMuokata && (
                  <button
                    onClick={() => onPoista(emp)}
                    className="text-rose-600 hover:text-rose-800 font-medium text-xs bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-md transition-colors"
                  >
                    Poista
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</>
  );
};
