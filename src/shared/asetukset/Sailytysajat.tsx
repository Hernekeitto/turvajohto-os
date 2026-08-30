import { useState, type ReactNode } from 'react';
import { History, ChevronDown, Trash2 } from 'lucide-react';
import { jaotteleSailytysajan, sailytysaikaPaattyy } from '../sailytysaika';

// Lakisääteisten säilytysaikojen seuranta. Jaettu, koska sama laki (LYTP) koskee
// järjestyksenvalvojan ja vartijan tapahtumailmoituksia riippumatta siitä kummalla
// puolella ne on kirjattu — ks. shared/sailytysaika.ts.
//
// Raportit annetaan propsina valmiiksi normalisoituna ({ id, type, createdAt }), koska
// puolet nimeävät laatimisajan eri tavalla: EVENT käyttää createdAt-kenttää ja GUARD
// luotu-kenttää. Normalisointi kutsujan päässä pitää tämän komponentin yhtenä totuutena
// siitä miltä säilytysaikanäkymä näyttää.
//
// children on puolikohtainen jatko-osa: EVENT näyttää siinä arkistoitujen tapahtumien
// poistoaikataulun. GUARD-puolella vastaavaa ei ole, koska kohde ei ole ajallisesti
// rajattu samalla tavalla kuin tapahtuma.

export type SailytysRaportti = { id: string; type?: string; createdAt?: string | null };

type Props = {
  raportit: SailytysRaportti[];
  isAdmin: boolean;
  // Hävitys on peruuttamaton ja kuuluu pääkäyttäjälle, joten nappi näkyy vain jos
  // kutsuja antaa toteutuksen JA käyttäjä on pääkäyttäjä.
  onHavita?: () => void;
  // Merkki suljetun otsikkorivin vieressä, jos jotain on poistettavissa (EVENT: arkistoidut
  // tapahtumat). Näkyy myös kun lohko on kiinni, jottei jää huomaamatta.
  lisamerkki?: ReactNode;
  children?: ReactNode;
};

export const Sailytysajat = ({ raportit, isAdmin, onHavita, lisamerkki, children }: Props) => {
  const [avattu, setAvattu] = useState(false);
  const sailytys = jaotteleSailytysajan(raportit);

  return (
    <div className="bg-surface rounded-xl border border-line shadow-sm">
      <button
        type="button"
        onClick={() => setAvattu((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-6 text-left hover:bg-sunken transition-colors rounded-xl"
      >
        <h3 className="text-lg font-bold text-ink flex items-center gap-2">
          <History size={18} className="text-accent" />
          Tapahtumailmoitusten säilytysajat
        </h3>
        <div className="flex items-center gap-3 shrink-0">
          {/* Hävitettävien määrä näkyy myös suljettuna, jottei se jää huomaamatta */}
          {sailytys.vanhentuneet.length > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-danger-soft text-danger-ink">
              {sailytys.vanhentuneet.length} hävitettävää
            </span>
          )}
          {lisamerkki}
          <ChevronDown size={18} className={`text-ink-subtle transition-transform ${avattu ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {avattu && (
        <div className="px-6 pb-6">
          <p className="text-sm text-ink-body">
            Tapahtumailmoitukset on säilytettävä kaksi vuotta niiden laatimispäivän kalenterivuoden
            päättymisen jälkeen, minkä jälkeen henkilötietoja sisältävät ilmoitukset on hävitettävä
            viipymättä ja viimeistään kuukauden kuluessa.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="bg-sunken border border-line rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-ink">{sailytys.voimassa.length}</div>
              <div className="text-xs text-ink-muted font-medium uppercase tracking-wide mt-1">
                Säilytysaika voimassa
              </div>
            </div>
            <div
              className={
                sailytys.vanhentuneet.length > 0
                  ? 'border rounded-lg p-4 text-center bg-danger-soft border-danger/30'
                  : 'border rounded-lg p-4 text-center bg-sunken border-line'
              }
            >
              <div
                className={
                  sailytys.vanhentuneet.length > 0
                    ? 'text-2xl font-bold text-danger-ink'
                    : 'text-2xl font-bold text-ink'
                }
              >
                {sailytys.vanhentuneet.length}
              </div>
              <div
                className={
                  sailytys.vanhentuneet.length > 0
                    ? 'text-xs font-medium uppercase tracking-wide mt-1 text-danger'
                    : 'text-xs font-medium uppercase tracking-wide mt-1 text-ink-muted'
                }
              >
                Hävitettävä
              </div>
            </div>
            <div className="bg-warning-soft border border-warning/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-warning-ink">{sailytys.paivamaaraPuuttuu.length}</div>
              <div className="text-xs text-warning font-medium uppercase tracking-wide mt-1">
                Päivämäärä puuttuu
              </div>
            </div>
          </div>

          {sailytys.paivamaaraPuuttuu.length > 0 && (
            <p className="text-xs text-warning-ink bg-warning-soft border border-warning/30 rounded-lg p-3 mt-4">
              {sailytys.paivamaaraPuuttuu.length} ilmoituksesta ei löydy laatimisaikaa (createdAt-kenttä
              otettiin käyttöön 18.8.2026). Niiden säilytysaikaa ei voi laskea, joten niitä ei myöskään
              poisteta automaattisesti — käy ne läpi käsin.
            </p>
          )}

          {sailytys.vanhentuneet.length > 0 ? (
            <div className="mt-5">
              <h4 className="text-sm font-bold text-ink-body mb-2">Hävitettävät ilmoitukset</h4>
              <div className="border border-line rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-sunken text-xs uppercase text-ink-muted">
                    <tr>
                      <th className="p-3 text-left font-semibold">Tunniste</th>
                      <th className="p-3 text-left font-semibold">Tyyppi</th>
                      <th className="p-3 text-left font-semibold">Laadittu</th>
                      <th className="p-3 text-left font-semibold">Säilytysaika päättyi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {sailytys.vanhentuneet.slice(0, 50).map((r: any) => (
                      <tr key={r.id}>
                        <td className="p-3 font-mono text-xs text-ink-body">{r.id}</td>
                        <td className="p-3 text-ink-body">{r.type}</td>
                        <td className="p-3 text-ink-body">
                          {new Date(r.createdAt).toLocaleDateString('fi-FI')}
                        </td>
                        <td className="p-3 text-ink-body">
                          {sailytysaikaPaattyy(r.createdAt)?.toLocaleDateString('fi-FI')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sailytys.vanhentuneet.length > 50 && (
                <p className="text-xs text-ink-muted mt-2">
                  Näytetään 50 ensimmäistä {sailytys.vanhentuneet.length} ilmoituksesta.
                </p>
              )}
              {isAdmin && onHavita ? (
                <button
                  type="button"
                  onClick={onHavita}
                  className="mt-4 px-5 py-2 text-sm font-medium text-white bg-danger hover:bg-danger-ink rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  Hävitä {sailytys.vanhentuneet.length} vanhentunut ilmoitus
                </button>
              ) : (
                <p className="mt-4 text-sm text-ink-muted bg-sunken border border-line rounded-lg p-3">
                  Hävittäminen on peruuttamatonta ja kuuluu pääkäyttäjälle. Ilmoita
                  pääkäyttäjälle, että säilytysaika on umpeutunut.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-success-ink bg-success-soft border border-success/30 rounded-lg p-3 mt-5">
              Yhdenkään ilmoituksen säilytysaika ei ole umpeutunut — hävitettävää ei ole.
            </p>
          )}

          {children}
        </div>
      )}
    </div>
  );
};
