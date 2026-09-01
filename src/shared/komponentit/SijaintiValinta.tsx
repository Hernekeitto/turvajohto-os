// Kirjauksen sijainti: vyöhyke ja tarkka kohta kartalla. Yksi komponentti kaikkiin
// lomakkeisiin, koska sijainti kysytään samalla tavalla riippumatta siitä mitä
// kirjataan — ja koska kuudessa lomakkeessa toistettu valikko olisi kuusi paikkaa
// joista yksi jää päivittämättä.
//
// Kartta on suljettuna oletuksena. Sijainti on hyödyllinen mutta harvoin pakollinen,
// eikä lomakkeen pääsisältö saa jäädä kartan alle.

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Kartta } from './Kartta';
import type { Piste, Vyohyke } from '../vyohykkeet';

type Props = {
  karttaId?: string | null;
  vyohykkeet: Vyohyke[];
  vyohyke: string;
  onVyohyke: (id: string) => void;
  piste: Piste | null;
  onPiste: (piste: Piste | null) => void;
  focusRing?: string;
};

export const SijaintiValinta = ({
  karttaId,
  vyohykkeet,
  vyohyke,
  onVyohyke,
  piste,
  onPiste,
  focusRing = 'focus:ring-indigo-500',
}: Props) => {
  const [karttaAuki, setKarttaAuki] = useState(false);

  // Ilman vyöhykkeitä ja ilman pohjakarttaa ei ole mitään kysyttävää: tyhjä valikko
  // lupaisi luokittelun jota ei ole olemassa.
  if (vyohykkeet.length === 0 && !karttaId) return null;

  return (
    <div className="space-y-3">
      {vyohykkeet.length > 0 && (
        <div>
          <label htmlFor="kirjaus-vyohyke" className="block text-sm font-bold text-slate-700 mb-1">Vyöhyke</label>
          <select
            id="kirjaus-vyohyke"
            value={vyohyke}
            onChange={(e) => onVyohyke(e.target.value)}
            className={`w-full rounded-lg border-slate-300 border p-2.5 text-sm ${focusRing}`}
          >
            <option value="">Ei vyöhykettä</option>
            {vyohykkeet.map((v) => (
              <option key={v.id} value={v.id}>{v.nimi}</option>
            ))}
          </select>
        </div>
      )}

      {karttaId && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setKarttaAuki((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 transition-colors"
            >
              <MapPin size={14} className="text-indigo-500" />
              {karttaAuki ? 'Sulje kartta' : piste ? 'Muuta kohtaa kartalla' : 'Osoita kohta kartalta'}
            </button>
            {piste && (
              <>
                <span className="text-xs text-slate-500">Kohta merkitty kartalle.</span>
                <button
                  type="button"
                  onClick={() => onPiste(null)}
                  className="text-xs text-slate-400 hover:text-rose-600 underline"
                >
                  Poista merkintä
                </button>
              </>
            )}
          </div>

          {karttaAuki && (
            <div className="mt-2">
              <Kartta
                karttaId={karttaId}
                vyohykkeet={vyohykkeet}
                merkit={piste ? [{ id: 'valittu', x: piste.x, y: piste.y, otsikko: 'Kirjauksen kohta' }] : []}
                onKarttaKlikkaus={(p) => onPiste(p)}
              />
              <p className="text-xs text-slate-500 mt-1">
                Napsauta karttaa siihen kohtaan jossa tapahtuma sattui.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
