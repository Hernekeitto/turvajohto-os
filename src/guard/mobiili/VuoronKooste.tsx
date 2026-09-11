// Vuoron kooste (erä 18b).
//
// Näytetään kun vartija päättää vuoron. Tätä ei ollut aiemmin lainkaan: vuorotietue on
// ollut palvelimella, mutta yksikään näkymä ei lukenut sitä.
//
// --- Miksi kooste näytetään VARTIJALLE eikä vain päivystäjälle --------------------
//
// Unohtunut kierros selviää muuten vasta seuraavana päivänä jonkun toisen katsoessa
// listaa, eikä sille voi silloin tehdä mitään. Koosteen paikka on se hetki jolloin
// vartija on vielä kohteessa ja voi palata takaisin.
//
// --- Keltainen merkintä ------------------------------------------------------------
//
// Suoritusaika ei rajoita mitään: tehtävän voi tehdä milloin tahansa. Poikkeama on
// TIETO JÄLKIKÄTEEN, ja siksi se näkyy vasta täällä eikä työlistalla estämässä. Liukuma
// on viisi minuuttia molempiin suuntiin (server/kooste.js), joten klo 19 tarkoittaa
// 18:55–19:05.
import { AlertTriangle, Check, CircleAlert, CircleDashed, ShieldAlert } from 'lucide-react';

import type { VuoronKooste as Kooste, KoosteRivi } from '../vuorot';

type Props = {
  kooste: Kooste | null;
  ladataan: boolean;
  onSulje: () => void;
};

const kello = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
};

// Poikkeama sanoiksi. Etumerkki kertoo suunnan, ja suunta on se mitä ihminen kysyy
// ensimmäisenä: myöhässä vai etuajassa.
const poikkeamaTeksti = (min: number | null) => {
  if (min === null) return '';
  const suunta = min > 0 ? 'myöhässä' : 'etuajassa';
  const maara = Math.abs(min);
  return maara >= 60
    ? `${Math.floor(maara / 60)} h ${maara % 60} min ${suunta}`
    : `${maara} min ${suunta}`;
};

const Rivi = ({ rivi }: { rivi: KoosteRivi }) => (
  <li className="flex items-start gap-3 py-3">
    {rivi.tila === 'valmis' ? (
      <Check size={18} className="text-success shrink-0 mt-0.5" />
    ) : rivi.tila === 'keskeytetty' ? (
      <CircleAlert size={18} className="text-warning shrink-0 mt-0.5" />
    ) : (
      <CircleDashed size={18} className="text-ink-subtle shrink-0 mt-0.5" />
    )}
    <span className="min-w-0 flex-1">
      <span className="block text-base font-medium text-ink break-words">{rivi.nimi}</span>
      <span className="block text-sm text-ink-muted">
        {rivi.tila === 'valmis' ? `Tehty klo ${kello(rivi.tehtyKlo)}`
          : rivi.tila === 'keskeytetty' ? `Keskeytetty · aloitettu klo ${kello(rivi.tehtyKlo)}`
            : rivi.tila === 'kesken' ? 'Kesken'
              : 'Tekemättä'}
        {rivi.suoritusaika ? ` · suunniteltu klo ${rivi.suoritusaika}` : ''}
        {rivi.lahde !== 'vuoro' ? ` · ${rivi.lahde === 'itse_lisatty' ? 'itse lisätty' : rivi.lahde}` : ''}
      </span>
      {rivi.poikkeama && (
        <span className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-0.5 text-sm text-warning-ink">
          <AlertTriangle size={13} className="shrink-0" />
          {poikkeamaTeksti(rivi.poikkeamaMin)}
        </span>
      )}
    </span>
  </li>
);

export const VuoronKooste = ({ kooste, ladataan, onSulje }: Props) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
    <div className="w-full sm:max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl border border-line max-h-[90vh] overflow-y-auto">
      <div className="p-5">
        <h2 className="text-xl font-bold text-ink-strong">Vuoro päättyi</h2>

        {ladataan ? (
          <p className="text-base text-ink-muted mt-3">Kootaan vuoroa…</p>
        ) : !kooste ? (
          <p className="text-base text-ink-muted mt-3">
            Vuoro päättyi, mutta koostetta ei saatu haettua. Vuoro on silti tallessa.
          </p>
        ) : (
          <>
            <p className="text-base text-ink-muted mt-1">
              {kooste.vuorotyyppiNimi} · {kooste.siteNimi}
            </p>
            <p className="text-base text-ink-muted">
              {kello(kooste.alkoi)}–{kello(kooste.paattyi)}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-lg bg-success-soft px-3 py-1.5 text-base text-success-ink">
                {kooste.tehty} tehty
              </span>
              {kooste.tekematta > 0 && (
                <span className="rounded-lg bg-sunken border border-line px-3 py-1.5 text-base text-ink-body">
                  {kooste.tekematta} tekemättä
                </span>
              )}
              {kooste.kesken > 0 && (
                <span className="rounded-lg bg-sunken border border-line px-3 py-1.5 text-base text-ink-body">
                  {kooste.kesken} kesken
                </span>
              )}
              {kooste.poikkeamia > 0 && (
                <span className="rounded-lg bg-warning-soft px-3 py-1.5 text-base text-warning-ink">
                  {kooste.poikkeamia}{' '}
                  {kooste.poikkeamia === 1 ? 'aikapoikkeama' : 'aikapoikkeamaa'}
                </span>
              )}
            </div>

            {/* Kertaluvalla ajettu vuoro on juuri se jota jälkikäteen katsotaan, joten se
                sanotaan koosteessa eikä jätetä auditlokin varaan. */}
            {kooste.perehdytysPoikkeus && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-ink">
                <ShieldAlert size={15} className="shrink-0 mt-0.5" />
                <span>
                  Vuoro ajettiin {kooste.perehdytysPoikkeus.myontaja}n myöntämällä
                  kertaluvalla: {kooste.perehdytysPoikkeus.syy}
                </span>
              </p>
            )}

            {[...kooste.pohjat, ...kooste.tehtavat].length > 0 ? (
              <ul className="mt-4 divide-y divide-line-soft">
                {[...kooste.pohjat, ...kooste.tehtavat].map((r) => (
                  <Rivi key={`${r.id}-${r.nimi}`} rivi={r} />
                ))}
              </ul>
            ) : (
              <p className="text-base text-ink-muted mt-4">Vuorolle ei ollut merkitty työtä.</p>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onSulje}
          className="mt-5 w-full bg-accent hover:bg-accent-hover text-white text-base font-medium rounded-xl px-4 py-3 transition-colors"
        >
          Selvä
        </button>
      </div>
    </div>
  </div>
);
