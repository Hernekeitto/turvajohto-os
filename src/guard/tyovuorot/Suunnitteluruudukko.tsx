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
import { AlertTriangle, CalendarDays, CalendarOff, History, MessageSquareText, Repeat, Send, Trash2, Wand2, X } from 'lucide-react';

import { TakaisinLinkki } from '../../shared/komponentit/TakaisinLinkki';
import {
  TYOAIKAMUOTO, haeLista, haeOptimointi, hyvaksyEhdotus, julkaiseLista, kirjaaPoissaolo, laskeListanEhdotus, poistaPoissaolo, pvm, ratkaiseVaihto, tallennaSijoitus,
} from './tyoaika';
import type { Ehdotus, Havainto, ListaNakyma, Sijoitus, SuunniteltuVuoro, Taso, Taytto } from './tyoaika';
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

// kaynnista: avataan lista suoraan täyttö käynnissä (etusivun "Luo uusi lista" ja
// henkilönäkymän "Täytä vapautuneet").
type Props = { alku: string; kaynnista?: Taytto; onTakaisin: () => void };

export const Suunnitteluruudukko = ({ alku, kaynnista, onTakaisin }: Props) => {
  const [tila, setTila] = useState<ListaNakyma | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [ilmoitus, setIlmoitus] = useState<string | null>(null);
  const [valittu, setValittu] = useState<SuunniteltuVuoro | null>(null);
  // Generaattorin ehdotus (erä 7). Näytetään ruudukossa esikatseluna, kunnes se
  // hyväksytään tai hylätään; mitään ei tallenneta ennen hyväksyntää.
  const [ehdotus, setEhdotus] = useState<Ehdotus | null>(null);

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

      <div className="flex flex-wrap items-start gap-3">
        <Julkaisu tila={tila} onTila={setTila} />
        <Generaattori
          tila={tila}
          kaynnista={kaynnista}
          ehdotus={ehdotus}
          onEhdotus={setEhdotus}
          onTila={(uusi, viesti) => { setTila(uusi); setEhdotus(null); setIlmoitus(viesti); }}
        />
      </div>

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
                    // Generaattorin ehdotus (erä 7) näkyy vain avoimessa solussa: sijoitettu
                    // vuoro ohitetaan hyväksynnässä joka tapauksessa.
                    const ehdotettu = !s ? ehdotus?.ehdotus.find((e) => e.vuoroId === vuoro.id) : undefined;
                    if (ehdotettu) {
                      return (
                        <td key={p} className={`border-b border-line-soft p-0.5 ${vl ? 'bg-sunken' : ''}`}>
                          <span
                            title={`Ehdotus: ${henkilot.get(ehdotettu.username)?.nimi || ehdotettu.username}`}
                            className="flex items-center justify-center w-full h-9 rounded border-2 border-dashed border-accent/60 bg-accent-soft/40 px-1 text-[11px] leading-tight truncate text-accent-ink italic"
                          >
                            {lyhytNimi(henkilot.get(ehdotettu.username), ehdotettu.username)}
                          </span>
                        </td>
                      );
                    }
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

      <Vaihdot tila={tila} onTila={setTila} />

      <Poissaolot tila={tila} onMuuttui={hae} />

      <Muutosloki tila={tila} />

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
  // Julkaistun listan muutoksen syy (erä 6). Kysytään ennen valintaa, koska jokainen
  // muutos sitä tarvitsee, ja se näkyy muutoksen kohteille heidän omissa vuoroissaan.
  const [muutossyy, setMuutossyy] = useState('');
  const julkaistu = !!tila.julkaistu;
  const syyPuuttuu = julkaistu && muutossyy.trim().length < 3;

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
      ...(julkaistu ? { muutossyy } : {}),
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

        {julkaistu && (
          <label className="block mt-3">
            <span className="block text-xs font-medium text-ink-strong mb-1">
              Muutoksen syy (pakollinen, näkyy muutoksen kohteille)
            </span>
            <input
              maxLength={500}
              value={muutossyy}
              onChange={(e) => setMuutossyy(e.target.value)}
              placeholder="esim. Sairastuminen, vuoro siirretty"
              className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-strong focus:outline-none focus:border-accent"
            />
          </label>
        )}

        {sijoitus && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-sunken px-3 py-2 text-sm">
            <span>
              Sijoitettu: <span className="font-medium text-ink-strong">{nimi(sijoitus.username)}</span>
              {sijoitus.syy && <span className="block text-xs text-ink-muted">Syy: {sijoitus.syy}</span>}
            </span>
            <button
              type="button"
              disabled={tyossa || syyPuuttuu}
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
                disabled={tyossa || syyPuuttuu || syy.trim().length < 3}
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
              // Erä 5: poissaolo estää (palvelin hylkää), toive näkyy tiedoksi.
              const poissa = tila.poissaolot.find((p) => p.username === h.username && p.alku <= vuoro.pvm && p.loppu >= vuoro.pvm);
              const toive = tila.toiveet.find((t) => t.username === h.username && t.pvm === vuoro.pvm);
              const kaytettavissa = perehdytetty && !reservi && !poissa;
              return (
                <li key={h.username}>
                  <button
                    type="button"
                    disabled={tyossa || syyPuuttuu || reservi || sijoitus?.username === h.username}
                    onClick={() => laheta(h.username)}
                    className={`w-full text-left px-3 py-2 hover:bg-sunken disabled:hover:bg-transparent disabled:cursor-default ${kaytettavissa ? '' : 'opacity-60'}`}
                  >
                    <span className="block text-sm text-ink-strong">{h.nimi}</span>
                    <span className="block text-xs text-ink-muted">
                      {reservi ? 'Työvoimareservi — kuittaa vuoron itse'
                        : poissa ? `${tila.poissaololajit[poissa.laji] || 'Poissa'} ${pvm(poissa.alku)}–${pvm(poissa.loppu)}`
                          : !perehdytetty ? 'Ei perehdytystä tähän vuoroon'
                            : `${TYOAIKAMUOTO[h.workTimeType || ''] || 'Työaikamuoto puuttuu'} · jaksossa ${tunnit(h.username) || 0} h`}
                    </span>
                    {toive && !poissa && (
                      <span className={`block text-xs mt-0.5 ${toive.laji === 'vuoro' ? 'text-accent-ink' : 'text-warning-ink'}`}>
                        {toive.laji === 'vuoro' ? 'Toivoo vuoroa' : toive.laji === 'este' ? 'Ilmoittanut ettei pääse' : 'Toivoo vapaata'}
                        {toive.huom && ` — ${toive.huom}`}
                      </span>
                    )}
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
                    {t.jaksot.map((j) => `${String(j.tunnit).replace('.', ',')} h`
                      + (j.poissaolotunnit ? ` (josta poissaoloa ${String(j.poissaolotunnit).replace('.', ',')} h)` : '')).join(' + ')}
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

// --- Poissaolot (erä 5) -----------------------------------------------------------------
//
// Listan aikana voimassa olevat poissaolot ja uuden kirjaus. Laji voi olla sairaus, joten
// lisätietoon ei kirjoiteta diagnoosia: listan laatimiseen riittää tieto poissaolosta.

const Poissaolot = ({ tila, onMuuttui }: { tila: ListaNakyma; onMuuttui: () => void }) => {
  const [auki, setAuki] = useState(false);
  const [lomake, setLomake] = useState({ username: '', laji: 'vuosiloma', alku: tila.lista.alku, loppu: tila.lista.alku, tunnit: '', huom: '' });
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tyossa, setTyossa] = useState(false);
  const nimi = (u: string) => tila.henkilot.find((h) => h.username === u)?.nimi || u;

  const tallenna = async () => {
    setTyossa(true);
    setVirhe(null);
    const v = await kirjaaPoissaolo({
      username: lomake.username, laji: lomake.laji, alku: lomake.alku, loppu: lomake.loppu,
      tunnit: lomake.tunnit === '' ? null : Number(lomake.tunnit.replace(',', '.')),
      huom: lomake.huom,
    });
    setTyossa(false);
    if (!v.ok) { setVirhe(v.error); return; }
    setAuki(false);
    setLomake((l) => ({ ...l, username: '', tunnit: '', huom: '' }));
    onMuuttui();
  };

  const poista = async (id: string) => {
    if (!window.confirm('Poistetaanko poissaolo?')) return;
    const v = await poistaPoissaolo(id);
    if (!v.ok) setVirhe(v.error); else onMuuttui();
  };

  const kentta = 'bg-surface border border-line rounded-md px-2 py-1.5 text-sm text-ink';

  return (
    <section className="mt-8">
      <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-1">
        <CalendarOff size={18} className="text-accent" />
        Poissaolot
      </h3>
      <p className="text-xs text-ink-muted mb-3">
        Poissaolon ajalle ei voi sijoittaa, ja sen tunnit lasketaan jakson työaikaan (TES 29 § ja 33 §).
        Vuosilomalle ehdotetaan 6,7 h jokaiselta lomapäivältä (ma–la), jos tunteja ei anneta.
      </p>
      {virhe && <p className="text-sm text-danger mb-2">{virhe}</p>}
      {tila.poissaolot.length === 0 ? (
        <p className="text-sm text-ink-muted">Ei poissaoloja tämän listan aikana.</p>
      ) : (
        <ul className="bg-surface rounded-xl border border-line divide-y divide-line-soft mb-3">
          {tila.poissaolot.map((p) => (
            <li key={p.id} className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-medium text-ink-strong">{nimi(p.username)}</span>
                {' · '}{tila.poissaololajit[p.laji] || p.laji} {pvm(p.alku)}–{pvm(p.loppu)}
                {' · '}{String(p.tunnit).replace('.', ',')} h
                {p.huom && <span className="text-ink-muted"> · {p.huom}</span>}
              </span>
              {tila.saaMuokata && (
                <button type="button" onClick={() => poista(p.id)} className="text-ink-subtle hover:text-danger" title="Poista poissaolo">
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {tila.saaMuokata && (auki ? (
        <div className="bg-sunken border border-line rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-ink-body">
              <span className="block font-medium mb-1">Henkilö</span>
              <select value={lomake.username} onChange={(e) => setLomake({ ...lomake, username: e.target.value })} className={kentta}>
                <option value="">Valitse…</option>
                {tila.henkilot.map((h) => <option key={h.username} value={h.username}>{h.nimi}</option>)}
              </select>
            </label>
            <label className="text-xs text-ink-body">
              <span className="block font-medium mb-1">Laji</span>
              <select value={lomake.laji} onChange={(e) => setLomake({ ...lomake, laji: e.target.value })} className={kentta}>
                {Object.entries(tila.poissaololajit).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </label>
            <label className="text-xs text-ink-body">
              <span className="block font-medium mb-1">Alkaen</span>
              <input type="date" value={lomake.alku} onChange={(e) => setLomake({ ...lomake, alku: e.target.value })} className={kentta} />
            </label>
            <label className="text-xs text-ink-body">
              <span className="block font-medium mb-1">Asti</span>
              <input type="date" value={lomake.loppu} onChange={(e) => setLomake({ ...lomake, loppu: e.target.value })} className={kentta} />
            </label>
            <label className="text-xs text-ink-body">
              <span className="block font-medium mb-1">Tunnit (työaikaan)</span>
              <input
                inputMode="decimal"
                placeholder={lomake.laji === 'vuosiloma' ? 'automaattinen' : '0'}
                value={lomake.tunnit}
                onChange={(e) => setLomake({ ...lomake, tunnit: e.target.value })}
                className={`${kentta} w-28`}
              />
            </label>
          </div>
          <label className="block text-xs text-ink-body">
            <span className="block font-medium mb-1">Lisätieto (ei diagnooseja)</span>
            <input maxLength={200} value={lomake.huom} onChange={(e) => setLomake({ ...lomake, huom: e.target.value })} className={`${kentta} w-full`} />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={tyossa || !lomake.username}
              onClick={tallenna}
              className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-60"
            >
              Kirjaa poissaolo
            </button>
            <button type="button" onClick={() => setAuki(false)} className="px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink-body">
              Peruuta
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAuki(true)} className="text-sm font-medium text-accent hover:underline">
          + Kirjaa poissaolo
        </button>
      ))}
    </section>
  );
};

// --- Julkaisu (erä 6) -------------------------------------------------------------------
//
// TES 10 §: lista annetaan tiedoksi viimeistään kaksi viikkoa ennen jakson alkua.
// Julkaisu tekee listasta vartijoiden näkemän, ja sen jälkeen jokainen muutos vaatii syyn.

const Julkaisu = ({ tila, onTila }: { tila: ListaNakyma; onTila: (t: ListaNakyma) => void }) => {
  const [virhe, setVirhe] = useState<string | null>(null);
  const [esteet, setEsteet] = useState<(Havainto & { username: string })[]>([]);
  const [tyossa, setTyossa] = useState(false);
  const nimi = (u: string) => tila.henkilot.find((h) => h.username === u)?.nimi || u;

  if (tila.julkaistu) {
    return (
      <div className="w-full mb-4 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm text-accent-ink">
        <span className="font-medium">
          Julkaistu {new Date(tila.julkaistu.aika).toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
        {' '}({tila.julkaistu.julkaisija}){tila.julkaistu.myohassa ? ' — julkaisun määräaika oli ohitettu' : ''}.
        {' '}Muutokset vaativat syyn ja näkyvät vartijoille.
      </div>
    );
  }
  if (!tila.saaMuokata) return null;

  const avoimia = tila.vuorot.filter((v) => !tila.sijoitukset.some((s) => s.vuoroId === v.id)).length;
  const julkaise = async () => {
    const kysymys = avoimia > 0
      ? `Julkaistaanko lista? ${avoimia} vuoroa jää avoimeksi — ne näkyvät työvoimareserville.`
      : 'Julkaistaanko lista? Vartijat näkevät vuoronsa, ja sen jälkeen jokainen muutos vaatii syyn.';
    if (!window.confirm(kysymys)) return;
    setTyossa(true);
    setVirhe(null);
    const v = await julkaiseLista(tila.lista.alku, tila.versio);
    setTyossa(false);
    if (v.ok) { setEsteet([]); onTila(v); return; }
    setVirhe(v.error);
    setEsteet((v as { esteet?: (Havainto & { username: string })[] }).esteet || []);
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        disabled={tyossa}
        onClick={julkaise}
        className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-60"
      >
        <Send size={16} />
        Julkaise lista
      </button>
      {virhe && <p className="mt-2 text-sm text-danger">{virhe}</p>}
      {esteet.length > 0 && (
        <ul className="mt-1 space-y-1">
          {esteet.map((e, i) => (
            <li key={i} className={`text-xs rounded border px-2 py-1 ${TASON_VARI.este}`}>
              <span className="font-medium">{nimi(e.username)}:</span> {e.viesti}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// --- Vuoronvaihdot (erä 6) --------------------------------------------------------------

const Vaihdot = ({ tila, onTila }: { tila: ListaNakyma; onTila: (t: ListaNakyma) => void }) => {
  const [virhe, setVirhe] = useState<string | null>(null);
  const [syyVaihdolle, setSyyVaihdolle] = useState<{ id: string; havainnot: Havainto[] } | null>(null);
  const [syy, setSyy] = useState('');
  const nimi = (u: string) => tila.henkilot.find((h) => h.username === u)?.nimi || u;
  const vuoro = (id: string) => tila.vuorot.find((v) => v.id === id);
  const odottavat = tila.vaihdot.filter((v) => v.tila === 'odottaa_suunnittelijaa' || v.tila === 'odottaa_saajaa');
  if (!odottavat.length) return null;

  const ratkaise = async (id: string, hyvaksy: boolean, annettuSyy?: string) => {
    setVirhe(null);
    const v = await ratkaiseVaihto(id, { hyvaksy, ...(annettuSyy ? { syy: annettuSyy } : {}) });
    if (v.ok) { setSyyVaihdolle(null); setSyy(''); onTila(v); return; }
    const vastaus = v as { koodi?: string; havainnot?: Havainto[]; error: string };
    if (vastaus.koodi === 'syy_puuttuu') { setSyyVaihdolle({ id, havainnot: vastaus.havainnot || [] }); return; }
    setVirhe(vastaus.error);
  };

  return (
    <section className="mt-8">
      <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-2">
        <Repeat size={18} className="text-accent" />
        Vuoronvaihdot
      </h3>
      {virhe && <p className="text-sm text-danger mb-2">{virhe}</p>}
      <ul className="bg-surface rounded-xl border border-line divide-y divide-line-soft">
        {odottavat.map((x) => {
          const v = vuoro(x.vuoroId);
          return (
            <li key={x.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span>
                  <span className="font-medium text-ink-strong">{nimi(x.antaja)} → {nimi(x.saaja)}</span>
                  <span className="block text-xs text-ink-muted">
                    {v ? `${v.siteNimi} · ${v.vuoroNimi} ${pvm(v.pvm)} ${v.alkaa.slice(11)}–${v.paattyy.slice(11)}` : x.vuoroId}
                    {' · '}{tila.vaihdonTilat[x.tila] || x.tila}
                  </span>
                  {x.viesti && <span className="block text-xs text-ink-body mt-0.5">Viesti: {x.viesti}</span>}
                </span>
                {tila.saaMuokata && x.tila === 'odottaa_suunnittelijaa' && (
                  <span className="flex gap-2">
                    <button type="button" onClick={() => ratkaise(x.id, true)} className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-lg">
                      Vahvista
                    </button>
                    <button type="button" onClick={() => ratkaise(x.id, false)} className="px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-danger">
                      Hylkää
                    </button>
                  </span>
                )}
              </div>
              {syyVaihdolle?.id === x.id && (
                <div className="mt-2">
                  {syyVaihdolle.havainnot.map((h, i) => (
                    <p key={i} className={`text-xs rounded border px-2 py-1 mb-1 ${TASON_VARI[h.taso]}`}>{h.viesti}</p>
                  ))}
                  <input
                    value={syy}
                    maxLength={500}
                    onChange={(e) => setSyy(e.target.value)}
                    placeholder="Syy poikkeamalle (esim. sovittu saajan kanssa)"
                    className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-1.5 text-sm text-ink-strong"
                  />
                  <button
                    type="button"
                    disabled={syy.trim().length < 3}
                    onClick={() => ratkaise(x.id, true, syy)}
                    className="mt-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-60"
                  >
                    Vahvista syyllä
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

// --- Muutosloki (erä 6) -----------------------------------------------------------------
//
// Julkaisun jälkeiset muutokset. Hälytystyö-merkintä (alle 72 h varoitusaika, TES 31 §)
// on tieto palkanlaskennalle: järjestelmä ei tiedä onko vuoro ylimääräinen.

const Muutosloki = ({ tila }: { tila: ListaNakyma }) => {
  const [auki, setAuki] = useState(false);
  if (!tila.julkaistu || !tila.muutokset.length) return null;
  const nimi = (u: string | null) => (u ? tila.henkilot.find((h) => h.username === u)?.nimi || u : '—');
  const vuoro = (id: string) => tila.vuorot.find((v) => v.id === id);
  const halytystoita = tila.muutokset.filter((m) => m.halytystyo).length;
  return (
    <section className="mt-8">
      <button type="button" onClick={() => setAuki(!auki)} className="text-lg font-bold text-ink flex items-center gap-2 mb-2">
        <History size={18} className="text-accent" />
        Muutokset julkaisun jälkeen ({tila.muutokset.length})
        {halytystoita > 0 && <span className="text-xs font-medium text-warning-ink">· {halytystoita} hälytystyötä</span>}
      </button>
      {auki && (
        <ul className="bg-surface rounded-xl border border-line divide-y divide-line-soft">
          {[...tila.muutokset].reverse().map((m, i) => {
            const v = vuoro(m.vuoroId);
            return (
              <li key={i} className="px-4 py-2 text-sm">
                <span className="text-ink-strong">{nimi(m.oli)} → {nimi(m.nyt)}</span>
                {m.halytystyo && <span className="ml-2 text-xs font-medium text-warning-ink">Hälytystyö (alle 72 h, TES 31 §)</span>}
                <span className="block text-xs text-ink-muted">
                  {v ? `${v.siteNimi} · ${v.vuoroNimi} ${pvm(v.pvm)}` : m.vuoroId}
                  {' · '}{new Date(m.aika).toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' })} {m.tekija}
                  {' · '}{m.syy}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

// --- Generaattori (erä 7) -----------------------------------------------------------------
//
// "Täytä avoimet" laskee ehdotuksen palvelimella (server/tyovuorogeneraattori.js) ja
// näyttää sen ruudukossa katkoviivoin. Hyväksyntä tekee sijoitukset tavallisella
// tarkistuksella; jos jokin rivi ei enää kelpaa, se ohitetaan ja kerrotaan.
//
// Generaattori ei ehdota esteitä, TES-poikkeamia eikä yli 120 tunnin jaksoja. Avoimiksi
// jäävät vuorot luetellaan syineen, jotta suunnittelija tietää mitä niille pitää tehdä
// käsin (sopia poikkeama, kysyä ylityötä tai tarjota reserville).

const Generaattori = ({
  tila, kaynnista, ehdotus, onEhdotus, onTila,
}: {
  tila: ListaNakyma;
  kaynnista?: Taytto;
  ehdotus: Ehdotus | null;
  onEhdotus: (e: Ehdotus | null) => void;
  onTila: (t: ListaNakyma, viesti: string | null) => void;
}) => {
  const [tyossa, setTyossa] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [muutossyy, setMuutossyy] = useState('');
  const [syytAuki, setSyytAuki] = useState(false);
  const [tapa, setTapa] = useState<Taytto>(kaynnista || 'optimi');
  const [edistyminen, setEdistyminen] = useState<{ sekuntia: number; aikarajaS: number } | null>(null);

  const avoimia = tila.vuorot.filter((v) => !tila.sijoitukset.some((s) => s.vuoroId === v.id)).length;

  // Automaattinen käynnistys kerran, kun lista avattiin täyttöä varten.
  const [kaynnistetty, setKaynnistetty] = useState(false);
  useEffect(() => {
    if (!kaynnista || kaynnistetty || !tila.saaMuokata || avoimia === 0 || ehdotus) return;
    setKaynnistetty(true);
    void laske();
    // laske lukee tilan sulkeumasta; ajetaan vain kerran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kaynnista, kaynnistetty, tila.saaMuokata, avoimia, ehdotus]);

  if (!tila.saaMuokata) return null;
  if (!ehdotus && avoimia === 0) return null;

  async function laske() {
    setTyossa(true);
    setVirhe(null);
    let v = await laskeListanEhdotus(tila.lista.alku, tapa);
    // Optimointi on taustatyö: kysytään tulosta kolmen sekunnin välein.
    if (v.ok && 'tyo' in v) {
      const { tyo, aikarajaS } = v;
      setEdistyminen({ sekuntia: 0, aikarajaS });
      for (;;) {
        await new Promise((r) => setTimeout(r, 3000));
        const t = await haeOptimointi(tila.lista.alku, tyo);
        if (t.ok && 'kesken' in t) { setEdistyminen({ sekuntia: t.sekuntia, aikarajaS: t.aikarajaS }); continue; }
        v = t;
        break;
      }
      setEdistyminen(null);
    }
    setTyossa(false);
    if (!v.ok) setVirhe(v.error);
    else if ('ehdotus' in v) onEhdotus(v);
  }

  const hyvaksy = async () => {
    if (!ehdotus) return;
    setTyossa(true);
    setVirhe(null);
    const v = await hyvaksyEhdotus(
      tila.lista.alku,
      ehdotus.ehdotus.map(({ vuoroId, username }) => ({ vuoroId, username })),
      tila.julkaistu ? muutossyy : undefined,
    );
    setTyossa(false);
    if (!v.ok) { setVirhe(v.error); return; }
    const { tehty, ohitetut } = v.generaattori;
    onTila(v, ohitetut.length
      ? `Sijoitettiin ${tehty} vuoroa. ${ohitetut.length} ohitettiin, koska tilanne oli muuttunut: ${ohitetut.slice(0, 3).map((o) => o.syy).join(' ')}`
      : `Sijoitettiin ${tehty} vuoroa.`);
  };

  if (!ehdotus) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={tyossa}
          onClick={laske}
          className="inline-flex items-center gap-2 bg-surface hover:bg-sunken text-ink-body border border-line text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-60"
        >
          <Wand2 size={16} />
          {tyossa
            ? edistyminen ? `Optimoidaan… ${edistyminen.sekuntia} / ${edistyminen.aikarajaS} s` : 'Lasketaan…'
            : `Täytä avoimet (${avoimia})`}
        </button>
        {/* Täyttötapa (11.10.2026). Keskitetty täyttää kuukausipalkkaiset 120 tuntiin
            järjestyksessä (nyt aakkoset, myöhemmin kohdeprosentti), koska sovittu 120 h
            maksetaan joka tapauksessa. Tarkka optimointi tekee saman koko listalle kerralla
            ja kierrättää pitkät viikonloput (server/tyovuorooptimointi.js). */}
        <select
          value={tapa}
          disabled={tyossa}
          onChange={(e) => setTapa(e.target.value as Taytto)}
          aria-label="Täyttötapa"
          className="max-w-full bg-surface border border-line rounded-lg px-2 py-2 text-sm text-ink"
        >
          <option value="optimi">Tarkka optimointi (suositus)</option>
          <option value="keskitetty">Nopea: 120 h täyteen aakkosjärjestyksessä</option>
          <option value="tasainen">Tasainen jako kaikille</option>
        </select>
        {tapa === 'optimi' && (
          <p className="w-full text-xs text-ink-muted">
            Täyttää kuukausipalkkaiset tasan 120 tuntiin järjestyksessä ja kierrättää pitkät vapaat
            viikonloput (TES 16 §) koko listalle kerralla. Laskenta kestää enintään puolitoista minuuttia.
          </p>
        )}
        {virhe && <p className="w-full text-sm text-danger">{virhe}</p>}
      </div>
    );
  }

  // Avoimiksi jäävät ryhmiteltynä syyn mukaan: sama syy sadalle vuorolle on yksi rivi.
  const syyt = new Map<string, number>();
  for (const a of ehdotus.avoimiksi) syyt.set(a.syy, (syyt.get(a.syy) || 0) + 1);
  const syyPuuttuu = !!tila.julkaistu && muutossyy.trim().length < 3;

  return (
    <div className="w-full mb-4 rounded-lg border-2 border-dashed border-accent/50 bg-accent-soft/30 px-4 py-3">
      <p className="text-sm font-medium text-ink-strong flex items-center gap-2">
        <Wand2 size={16} className="text-accent" />
        Ehdotus: {ehdotus.ehdotus.length} vuoroa
        {ehdotus.avoimiksi.length > 0 && `, ${ehdotus.avoimiksi.length} jää avoimeksi`}
      </p>
      <p className="text-xs text-ink-muted mt-0.5">
        Ehdotetut näkyvät ruudukossa katkoviivoin. Ehdotus ei sisällä esteitä, TES-poikkeamia eikä
        yli 120 tunnin jaksoja. Mitään ei ole vielä tallennettu.
      </p>
      {ehdotus.optimi && (
        <p className="text-xs text-ink-muted mt-0.5">
          {ehdotus.optimi.tila === 'optimi' && `Tarkka optimointi: paras mahdollinen ratkaisu (${String(ehdotus.optimi.sekuntia).replace('.', ',')} s).`}
          {ehdotus.optimi.tila === 'aikaraja' && `Tarkka optimointi: paras aikarajassa löydetty ratkaisu (${String(ehdotus.optimi.sekuntia).replace('.', ',')} s).`}
          {ehdotus.optimi.tila === 'virhe' && 'Tarkka optimointi epäonnistui, joten ehdotus on laskettu nopealla täytöllä.'}
        </p>
      )}
      {syyt.size > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setSyytAuki(!syytAuki)} className="text-xs font-medium text-accent hover:underline">
            {syytAuki ? 'Piilota' : 'Näytä'} miksi vuoroja jää avoimeksi
          </button>
          {syytAuki && (
            <ul className="mt-1 space-y-0.5 text-xs text-ink-body list-disc pl-5">
              {[...syyt].map(([syy, n]) => <li key={syy}>{n} × {syy}</li>)}
            </ul>
          )}
        </div>
      )}
      {tila.julkaistu && (
        <label className="block mt-3">
          <span className="block text-xs font-medium text-ink-strong mb-1">
            Muutoksen syy (pakollinen, lista on julkaistu)
          </span>
          <input
            maxLength={500}
            value={muutossyy}
            onChange={(e) => setMuutossyy(e.target.value)}
            placeholder="esim. Avoimien vuorojen täyttö"
            className="w-full bg-surface border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-strong"
          />
        </label>
      )}
      {virhe && <p className="mt-2 text-sm text-danger">{virhe}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={tyossa || syyPuuttuu || ehdotus.ehdotus.length === 0}
          onClick={hyvaksy}
          className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-60"
        >
          {tyossa ? 'Tallennetaan…' : 'Hyväksy ehdotus'}
        </button>
        <button type="button" disabled={tyossa} onClick={laske} className="px-4 py-2 text-sm font-medium text-ink-body hover:text-accent">
          Laske uudelleen
        </button>
        <button type="button" disabled={tyossa} onClick={() => onEhdotus(null)} className="px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink-body">
          Hylkää
        </button>
      </div>
    </div>
  );
};
