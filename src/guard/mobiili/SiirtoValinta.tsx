// Vastaanottajan valinta tehtävän siirtoon (erä 18).
//
// Listalla ovat vain ne jotka ovat NYT VUOROSSA (päätös 10.9.2026). Perustelu on ihmisen
// eikä koneen: vapaapäivää viettävälle vartijalle ei kuulu lähettää hyväksymispyyntöä
// keskellä yötä. Palvelin valvoo saman säännön, joten tyhjä lista ei ole este jonka voisi
// kiertää — se on kertomus siitä ettei kukaan muu ole kentällä.
//
// Kohteen nimi näkyy jokaisella rivillä, koska "kenelle siirrän" on käytännössä kysymys
// "kuka on lähellä" — ja siirron koko käyttötapaus on että saaja on eri kohteessa.
import { useState } from 'react';
import { ArrowRightLeft, X } from 'lucide-react';

import type { Vastaanottaja } from '../siirrot';

type Props = {
  tehtavaNimi: string;
  vastaanottajat: Vastaanottaja[];
  ladattu: boolean;
  lahettaa: boolean;
  virhe: string | null;
  onSiirra: (saaja: string, viesti: string) => void;
  onSulje: () => void;
};

export const SiirtoValinta = ({
  tehtavaNimi, vastaanottajat, ladattu, lahettaa, virhe, onSiirra, onSulje,
}: Props) => {
  const [saaja, setSaaja] = useState('');
  const [viesti, setViesti] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl border border-line p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start gap-3 mb-4">
          <ArrowRightLeft size={20} className="text-accent shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-ink-strong">Siirrä toiselle vartijalle</h2>
            <p className="text-sm text-ink-muted mt-0.5 break-words">{tehtavaNimi}</p>
          </div>
          <button type="button" onClick={onSulje} className="text-ink-subtle hover:text-ink-body shrink-0">
            <X size={20} />
          </button>
        </div>

        {virhe && (
          <p className="mb-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
            {virhe}
          </p>
        )}

        {!ladattu ? (
          <p className="text-base text-ink-muted">Haetaan vuorossa olevia…</p>
        ) : vastaanottajat.length === 0 ? (
          <p className="text-base text-ink-muted">
            Kukaan muu ei ole nyt vuorossa. Tehtävän voi siirtää vain vuorossa olevalle.
          </p>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {vastaanottajat.map((v) => (
                <button
                  key={v.username}
                  type="button"
                  onClick={() => setSaaja(v.username)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    saaja === v.username
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-surface hover:bg-sunken'
                  }`}
                >
                  <span className="block text-base font-medium text-ink-strong">{v.nimi}</span>
                  {v.kohde && <span className="block text-sm text-ink-muted mt-0.5">{v.kohde}</span>}
                </button>
              ))}
            </div>

            <label className="block mb-4">
              <span className="block text-sm font-medium text-ink-body mb-1">Viesti (valinnainen)</span>
              <textarea
                value={viesti}
                onChange={(e) => setViesti(e.target.value)}
                rows={2}
                placeholder="esim. Ehditkö ajaa tämän?"
                className="w-full rounded-lg border border-line-strong p-2.5 text-base bg-surface outline-none focus:ring-2 focus:ring-accent"
              />
            </label>

            {/* Perehdytystä ei tarkisteta, ja se on sanottava sille joka siirron tekee:
                vastuun ottaa antaja, joka on perehdytetty ja tuntee kohteen. */}
            <p className="text-sm text-ink-muted mb-4">
              Saaja saa hyväksyttäväkseen pyynnön. Tehtävä säilyy sinulla kunnes hän
              hyväksyy sen. Perehdytystä ei tarkisteta — vastuu kohteen tuntemisesta on
              sinulla.
            </p>

            <button
              type="button"
              disabled={!saaja || lahettaa}
              onClick={() => onSiirra(saaja, viesti)}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-base font-medium rounded-xl px-4 py-3 transition-colors"
            >
              {lahettaa ? 'Lähetetään…' : 'Lähetä siirtopyyntö'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
