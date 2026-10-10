// Työvuorolistan suunnitteluruudukko (erä 4).
//
// Rivit ovat vartijapaikkoja (kohde + vuoro + paikka), sarakkeet listan päiviä. Solua
// painamalla avautuu valitsin, ja valinta tallentuu heti palvelimelle, joka tarkistaa sen
// (server/tyovuorolistat.js: sijoita). Tarkistusta ei toisteta täällä: palvelimen vastaus
// kertoo onko sijoitus este, vaatiiko se syyn vai menikö se läpi varoituksin.
//
// Ruudukko vierii vaakasuunnassa omassa laatikossaan eikä koko sivu: kuuden viikon lista
// on 42 saraketta, eikä se mahdu millekään näytölle.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, MessageSquareText, Trash2, X } from 'lucide-react';

import { TakaisinLinkki } from '../../shared/komponentit/TakaisinLinkki';
import { TYOAIKAMUOTO, haeLista, pvm, tallennaSijoitus } from './tyoaika';
import type { Havainto, ListaNakyma, Sijoitus, SuunniteltuVuoro, Taso } from './tyoaika';
import { listanPaivat, lyhytNimi, paivanOtsikko, rivit, solunTaso, valitsimenHenkilot } from './ruudukko';

const TASON_VARI: Record<Taso, string> = {
  este: 'bg-danger/15 border-danger/40 text-danger',
  poikkeama: 'bg-warning-soft border-warning/50 text-warning-ink',
  varoitus: 'bg-warning-soft/60 border-warning/30 text-warning-ink',
  huomio: 'bg-accent-soft border-line text-ink-body',
};

const TASON_NIMI: Record<Taso, string> = {
  este: 'Este', poikkeama: 'TES-poikkeama', varoitus: 'Varoitus', huomio: 'Huomio',
};

type Props = { alku: string; onTakaisin: () => void };

export const Suunnitteluruudukko = ({ alku, onTakaisin }: Props) => {
  const [tila, setTila] = useState<ListaNakyma | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [ilmoitus, setIlmoitus] = useState<string | null>(null);
  const [valittu, setValittu] = useState<SuunniteltuVuoro | null>(null);

  const hae = useCallback(() => {
    haeLista(alku).then((v) => { setTila(v); setVirhe(null); }).catch((e: Error) => setVirhe(e.message));
  }, [alku]);
  useEffect(() => { hae(); }, [hae]);

  const sijoitukset = useMemo(
    () => new Map((tila?.sijoitukset || []).map((s) => [s.vuoroId, s])),
    [tila],
  );
  const henkilot = useMemo(() => new Map((tila?.henkilot || []).map((h) => [h.username, h])), [tila]);
  const paivat = useMemo(() => (tila ? listanPaivat(tila.lista) : []), [tila]);
  const riviLista = useMemo(() => rivit(tila?.vuorot || []), [tila]);

  if (virhe) {
    return (
      <div>
        <TakaisinLinkki onClick={onTakaisin}>Työvuorosuunnittelu</TakaisinLinkki>
        <p className="text-sm text-danger">{virhe}</p>
      </div>
    );
  }
  if (!tila) return <p className="text-sm text-ink-muted">Luetaan…</p>;

  const sijoitettuja = tila.vuorot.filter((v) => sijoitukset.has(v.id)).length;

  return (
    <div>
      <TakaisinLinkki onClick={onTakaisin}>Työvuorosuunnittelu</TakaisinLinkki>
      <h2 className="text-2xl font-bold text-ink-strong mb-1">
        Työvuorolista {pvm(tila.lista.alku)} – {pvm(tila.lista.viimeinen)}
      </h2>
      <p className="text-sm text-ink-muted mb-4">
        {sijoitettuja} / {tila.vuorot.length} vuoroa sijoitettu
        {' · '}julkaistava viimeistään {pvm(tila.lista.julkaistavaViimeistaan)}
        {tila.muokkasi && ` · viimeksi muokannut ${tila.muokkasi}`}
      </p>

      {ilmoitus && (
        <p className="mb-3 text-sm text-warning-ink bg-warning-soft border border-warning/30 rounded-lg px-3 py-2">{ilmoitus}</p>
      )}

      {tila.vuorot.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Tällä listalla ei ole suunniteltavia vuoroja. Ne määritellään kohteen hallinnassa
          Vuorot-välilehdellä.
        </p>
      ) : (
        <div className="overflow-x-auto border border-line rounded-xl bg-surface mb-6">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface border-b border-r border-line px-3 py-2 text-left font-medium text-ink-muted min-w-[8rem] sm:min-w-[11rem]">
                  Vuoro
                </th>
                {paivat.map((p) => {
                  const o = paivanOtsikko(p);
                  return (
                    <th key={p} className={`border-b border-line px-1 py-1.5 font-medium min-w-[4.5rem] ${o.viikonloppu ? 'bg-sunken text-ink-body' : 'text-ink-muted'}`}>
                      <span className="block">{o.viikonpaiva}</span>
                      <span className="block font-normal">{o.paiva}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {riviLista.map((r) => (
                <tr key={r.avain}>
                  <th scope="row" className="sticky left-0 z-10 bg-surface border-b border-r border-line px-3 py-1.5 text-left font-normal">
                    <span className="block text-ink-strong font-medium truncate max-w-[8rem] sm:max-w-[13rem]">{r.siteNimi}</span>
                    <span className="block text-ink-muted">
                      {r.vuoroNimi} {r.aika}{r.paikka > 1 || riviLista.some((x) => x !== r && x.siteId === r.siteId && x.vuorotyyppiId === r.vuorotyyppiId) ? ` · #${r.paikka}` : ''}
                    </span>
                  </th>
                  {paivat.map((p) => {
                    const vuoro = r.solut[p];
                    const vl = paivanOtsikko(p).viikonloppu;
                    if (!vuoro) return <td key={p} className={`border-b border-line-soft ${vl ? 'bg-sunken' : ''}`} />;
                    const s = sijoitukset.get(vuoro.id);
                    const taso = solunTaso(vuoro.id, s, tila.tulokset);
                    return (
                      <td key={p} className={`border-b border-line-soft p-0.5 ${vl ? 'bg-sunken' : ''}`}>
                        <button
                          type="button"
                          disabled={!tila.saaMuokata}
                          onClick={() => setValittu(vuoro)}
                          title={s ? `${henkilot.get(s.username)?.nimi || s.username}${s.syy ? ` — syy: ${s.syy}` : ''}` : 'Avoin vuoro'}
                          className={`w-full h-9 rounded border px-1 text-[11px] leading-tight truncate transition-colors ${
                            s
                              ? (taso ? TASON_VARI[taso] : 'bg-accent-soft border-accent/30 text-accent-ink')
                              : 'border-dashed border-line text-ink-subtle hover:border-accent hover:text-accent'
                          } disabled:cursor-default`}
                        >
                          {s ? (
                            <span className="inline-flex items-center gap-0.5">
                              {s.syy && <MessageSquareText size={10} className="shrink-0" />}
                              {lyhytNimi(henkilot.get(s.username), s.username)}
                            </span>
                          ) : '+'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tila.orvot.length > 0 && (
        <OrvotSijoitukset tila={tila} henkilot={henkilot} onTila={setTila} onIlmoitus={setIlmoitus} />
      )}

      <Yhteenveto tila={tila} />

      {valittu && (
        <Valitsin
          vuoro={valittu}
          tila={tila}
          sijoitus={sijoitukset.get(valittu.id)}
          onSulje={() => setValittu(null)}
          onTila={(uusi) => { setTila(uusi); setIlmoitus(null); }}
          onVanhentunut={(uusi, viesti) => { if (uusi) setTila(uusi); setIlmoitus(viesti); setValittu(null); }}
        />
      )}
    </div>
  );
};

// --- Valitsin --------------------------------------------------------------------------

type ValitsinProps = {
  vuoro: SuunniteltuVuoro;
  tila: ListaNakyma;
  sijoitus: Sijoitus | undefined;
  onSulje: () => void;
  onTila: (t: ListaNakyma) => void;
  onVanhentunut: (t: ListaNakyma | null, viesti: string) => void;
};

const Valitsin = ({ vuoro, tila, sijoitus, onSulje, onTila, onVanhentunut }: ValitsinProps) => {
  const [tyossa, setTyossa] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [havainnot, setHavainnot] = useState<Havainto[]>([]);
  // Henkilö jonka sijoitus vaatii syyn. Syy kysytään vasta kun palvelin on sanonut niin:
  // etukäteen kysytty syy olisi lomakkeen täyttämistä varmuuden vuoksi.
  const [syyHenkilolle, setSyyHenkilolle] = useState<string | null>(null);
  const [syy, setSyy] = useState('');

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onSulje(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onSulje]);

  const perehdytetyt = tila.perehdytetyt[`${vuoro.siteId}:${vuoro.vuorotyyppiId}`] || [];
  const vaihtoehdot = valitsimenHenkilot(tila.henkilot, perehdytetyt);

  const laheta = async (username: string | null, annettuSyy?: string) => {
    setTyossa(true);
    setVirhe(null);
    const v = await tallennaSijoitus(tila.lista.alku, {
      vuoroId: vuoro.id, username, versio: tila.versio, ...(annettuSyy ? { syy: annettuSyy } : {}),
    });
    setTyossa(false);
    if (v.ok) { onTila(v); onSulje(); return; }
    if (v.koodi === 'vanhentunut') {
      onVanhentunut(v.lista ? ({ ...v, ok: true } as ListaNakyma) : null, v.error);
      return;
    }
    setHavainnot(v.havainnot || []);
    if (v.koodi === 'syy_puuttuu' && username) { setSyyHenkilolle(username); return; }
    setSyyHenkilolle(null);
    // Havainto kertoo saman kuin virheteksti; erillinen rivi vain kun havaintoja ei ole.
    setVirhe(v.havainnot?.length ? null : v.error);
  };

  const nimi = (u: string) => tila.henkilot.find((h) => h.username === u)?.nimi || u;
  const tunnit = (u: string) => tila.tulokset[u]?.jaksot.map((j) => String(j.tunnit).replace('.', ',')).join(' / ');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={onSulje}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md bg-surface rounded-xl border border-line shadow-lg p-5 mt-12"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold text-ink-strong">{vuoro.siteNimi}</p>
            <p className="text-sm text-ink-muted">
              {vuoro.vuoroNimi} · {pvm(vuoro.pvm)} {vuoro.alkaa.slice(11)}–{vuoro.paattyy.slice(11)}
              {vuoro.paikka > 1 && ` · paikka ${vuoro.paikka}`}
            </p>
          </div>
          <button type="button" onClick={onSulje} className="text-ink-subtle hover:text-ink-body" aria-label="Sulje">
            <X size={18} />
          </button>
        </div>

        {sijoitus && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-sunken px-3 py-2 text-sm">
            <span>
              Sijoitettu: <span className="font-medium text-ink-strong">{nimi(sijoitus.username)}</span>
              {sijoitus.syy && <span className="block text-xs text-ink-muted">Syy: {sijoitus.syy}</span>}
            </span>
            <button
              type="button"
              disabled={tyossa}
              onClick={() => laheta(null)}
              className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline disabled:opacity-60"
            >
              <Trash2 size={14} /> Poista
            </button>
          </div>
        )}

        {virhe && <p className="mt-3 text-sm text-danger">{virhe}</p>}
        {havainnot.length > 0 && (
          <ul className="mt-2 space-y-1">
            {havainnot.map((h, i) => (
              <li key={i} className={`text-xs rounded border px-2 py-1 ${TASON_VARI[h.taso]}`}>
                <span className="font-medium">{TASON_NIMI[h.taso]}:</span> {h.viesti}
              </li>
            ))}
          </ul>
        )}

        {syyHenkilolle ? (
          <div className="mt-3">
            <label className="block text-sm font-medium text-ink-strong" htmlFor="sijoitus-syy">
              Syy poikkeamalle: {nimi(syyHenkilolle)}
            </label>
            <p className="text-xs text-ink-muted mb-1.5">
              Kertaluonteisesta poikkeamasta voidaan sopia työntekijän kanssa.
              Kirjaa kuka sopi ja mitä.
            </p>
            <textarea
              id="sijoitus-syy"
              rows={2}
              maxLength={500}
              value={syy}
              onChange={(e) => setSyy(e.target.value)}
              className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-strong focus:outline-none focus:border-accent"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={tyossa || syy.trim().length < 3}
                onClick={() => laheta(syyHenkilolle, syy)}
                className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-60"
              >
                Sijoita syyllä
              </button>
              <button
                type="button"
                onClick={() => { setSyyHenkilolle(null); setHavainnot([]); setSyy(''); }}
                className="px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink-body"
              >
                Valitse toinen
              </button>
            </div>
          </div>
        ) : (
          <ul className="mt-3 max-h-[50vh] overflow-y-auto divide-y divide-line-soft border border-line rounded-lg">
            {vaihtoehdot.map(({ henkilo: h, perehdytetty, reservi }) => {
              const kaytettavissa = perehdytetty && !reservi;
              return (
                <li key={h.username}>
                  <button
                    type="button"
                    disabled={tyossa || reservi || sijoitus?.username === h.username}
                    onClick={() => laheta(h.username)}
                    className={`w-full text-left px-3 py-2 hover:bg-sunken disabled:hover:bg-transparent disabled:cursor-default ${kaytettavissa ? '' : 'opacity-60'}`}
                  >
                    <span className="block text-sm text-ink-strong">{h.nimi}</span>
                    <span className="block text-xs text-ink-muted">
                      {reservi ? 'Työvoimareservi — kuittaa vuoron itse'
                        : !perehdytetty ? 'Ei perehdytystä tähän vuoroon'
                          : `${TYOAIKAMUOTO[h.workTimeType || ''] || 'Työaikamuoto puuttuu'} · listalla ${tunnit(h.username) || 0} h`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

// --- Orvot sijoitukset ----------------------------------------------------------------

const OrvotSijoitukset = ({
  tila, henkilot, onTila, onIlmoitus,
}: {
  tila: ListaNakyma;
  henkilot: Map<string, { nimi: string }>;
  onTila: (t: ListaNakyma) => void;
  onIlmoitus: (s: string | null) => void;
}) => {
  const poista = async (s: Sijoitus) => {
    const v = await tallennaSijoitus(tila.lista.alku, { vuoroId: s.vuoroId, username: null, versio: tila.versio });
    if (v.ok) { onTila(v); onIlmoitus(null); } else onIlmoitus(v.error);
  };
  return (
    <div className="mb-6 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-ink">
      <p className="font-medium flex items-center gap-2">
        <AlertTriangle size={16} />
        Sijoitukset joiden vuoroa ei enää ole
      </p>
      <p className="text-xs mt-0.5">Kohteen miehitys on muuttunut sijoituksen jälkeen. Poista sijoitus tai palauta vuoro kohteelle.</p>
      <ul className="mt-2 space-y-1">
        {tila.orvot.map((s) => {
          const [, , paiva] = s.vuoroId.split(':');
          return (
            <li key={s.vuoroId} className="flex items-center justify-between gap-2">
              <span>{henkilot.get(s.username)?.nimi || s.username} · {pvm(paiva)}</span>
              {tila.saaMuokata && (
                <button type="button" onClick={() => poista(s)} className="text-xs font-medium underline">Poista</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// --- Henkilöyhteenveto ----------------------------------------------------------------

const Yhteenveto = ({ tila }: { tila: ListaNakyma }) => {
  const mukana = tila.henkilot.filter((h) => {
    const t = tila.tulokset[h.username];
    return t && (t.jaksot.some((j) => j.tunnit > 0) || t.havainnot.some((x) => x.taso !== 'huomio'));
  });
  return (
    <section>
      <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-2">
        <CalendarDays size={18} className="text-accent" />
        Vartijat tällä listalla
      </h3>
      {mukana.length === 0 ? (
        <p className="text-sm text-ink-muted">Listalle ei ole vielä sijoitettu ketään.</p>
      ) : (
        <div className="bg-surface rounded-xl border border-line divide-y divide-line-soft">
          {mukana.map((h) => {
            const t = tila.tulokset[h.username];
            const havainnot = [...t.havainnot].sort((a, b) => ['este', 'poikkeama', 'varoitus', 'huomio'].indexOf(a.taso) - ['este', 'poikkeama', 'varoitus', 'huomio'].indexOf(b.taso));
            return (
              <div key={h.username} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink-strong">{h.nimi}</p>
                  <p className="text-xs text-ink-muted">
                    {t.jaksot.map((j) => `${String(j.tunnit).replace('.', ',')} h`).join(' + ')}
                    {h.workTimeType === 'monthly' && ' (tavoite 120 h / jakso)'}
                  </p>
                </div>
                {havainnot.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {havainnot.map((x, i) => (
                      <li key={i} className={`text-xs rounded border px-2 py-1 ${TASON_VARI[x.taso]}`}>
                        <span className="font-medium">{TASON_NIMI[x.taso]}:</span> {x.viesti}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
