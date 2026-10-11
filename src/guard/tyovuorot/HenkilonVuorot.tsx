// Henkilön työvuorot (11.10.2026): yhden henkilön vuorot kaikilta tulevilta listoilta.
//
// Tärkein käyttötapaus on sairastuminen: poissaolo kirjataan, henkilön vuorot vapautetaan
// sen ajalta kerralla ja vapautuneet täytetään listoittain generaattorilla. Ennen tätä
// jokainen vuoro piti etsiä eri listoilta ja tyhjentää käsin.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarOff, Trash2, UserRound, Wand2 } from 'lucide-react';

import { TakaisinLinkki } from '../../shared/komponentit/TakaisinLinkki';
import {
  TYOAIKAMUOTO, haeHenkilonVuorot, kirjaaPoissaolo, poistaPoissaolo, pvm, vapautaVuorot,
} from './tyoaika';
import type { Henkilo, HenkilonNakyma, Taytto } from './tyoaika';

type Props = {
  henkilot: Henkilo[];
  alkuperainen: string | null;
  saaMuokata: boolean;
  tanaan: string;
  onAvaaLista: (alku: string, kaynnista: Taytto | undefined, username: string) => void;
  onTakaisin: () => void;
};

const klo = (ts: string) => ts.slice(11, 16);
const tunnit = (min: number) => String(Math.round(min / 6) / 10).replace('.', ',');

export const HenkilonVuorot = ({ henkilot, alkuperainen, saaMuokata, tanaan, onAvaaLista, onTakaisin }: Props) => {
  const [username, setUsername] = useState(alkuperainen || '');
  const [tila, setTila] = useState<HenkilonNakyma | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [ilmoitus, setIlmoitus] = useState<{ teksti: string; listat: string[] } | null>(null);

  const hae = useCallback(() => {
    if (!username) { setTila(null); return; }
    haeHenkilonVuorot(username).then((v) => {
      if (v.ok) { setTila(v); setVirhe(null); } else setVirhe(v.error);
    });
  }, [username]);
  useEffect(() => { hae(); }, [hae]);

  const listoittain = useMemo(() => {
    const ryhmat = new Map<string, HenkilonNakyma['vuorot']>();
    for (const v of tila?.vuorot || []) {
      if (!ryhmat.has(v.listaAlku)) ryhmat.set(v.listaAlku, []);
      ryhmat.get(v.listaAlku)!.push(v);
    }
    return ryhmat;
  }, [tila]);

  const poista = async (id: string) => {
    if (!window.confirm('Poistetaanko poissaolo? Vapautettuja vuoroja ei palauteta automaattisesti.')) return;
    const v = await poistaPoissaolo(id);
    if (!v.ok) setVirhe(v.error); else hae();
  };

  return (
    <div>
      <TakaisinLinkki onClick={onTakaisin}>Työvuorosuunnittelu</TakaisinLinkki>
      <h2 className="text-2xl font-bold text-ink-strong mb-1 flex items-center gap-2">
        <UserRound size={22} className="text-accent" />
        Henkilön työvuorot
      </h2>
      <p className="text-sm text-ink-muted mb-4 leading-relaxed">
        Yhden henkilön vuorot kaikilta tulevilta listoilta. Sairastuessa kirjaa poissaolo ja
        vapauta sen ajan vuorot kerralla, ja täytä vapautuneet sitten listoittain.
      </p>

      <label className="block mb-6 max-w-sm">
        <span className="block text-xs font-medium text-ink-strong mb-1">Henkilö</span>
        <select
          value={username}
          onChange={(e) => { setUsername(e.target.value); setIlmoitus(null); }}
          className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink"
        >
          <option value="">Valitse henkilö…</option>
          {henkilot.map((h) => <option key={h.username} value={h.username}>{h.nimi}</option>)}
        </select>
      </label>

      {virhe && <p className="text-sm text-danger mb-3">{virhe}</p>}

      {ilmoitus && (
        <div className="mb-6 rounded-lg border border-accent/40 bg-accent-soft/40 px-4 py-3">
          <p className="text-sm text-ink-strong">{ilmoitus.teksti}</p>
          {ilmoitus.listat.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {ilmoitus.listat.map((alku) => {
                const l = tila?.listat.find((x) => x.alku === alku);
                return (
                  <button
                    key={alku}
                    type="button"
                    onClick={() => onAvaaLista(alku, 'optimi', username)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg"
                  >
                    <Wand2 size={15} />
                    Täytä vapautuneet: lista {pvm(alku)}{l ? `–${pvm(l.viimeinen)}` : ''}
                  </button>
                );
              })}
            </div>
          )}
          {ilmoitus.listat.length > 0 && (
            <p className="mt-2 text-xs text-ink-muted">
              Täyttö laskee ehdotuksen listan kaikkiin avoimiin vuoroihin, ja sen voi tarkistaa ennen hyväksyntää.
            </p>
          )}
        </div>
      )}

      {tila && (
        <>
          <p className="text-sm text-ink-body mb-4">
            <span className="font-medium text-ink-strong">{tila.henkilo.nimi}</span>
            {tila.henkilo.workTimeType && ` · ${TYOAIKAMUOTO[tila.henkilo.workTimeType] || tila.henkilo.workTimeType}`}
            {tila.henkilo.workTimeType === 'parttime' && tila.henkilo.minHoursPer3Weeks && `, vähintään ${tila.henkilo.minHoursPer3Weeks} h / 3 vk`}
          </p>

          {saaMuokata && (
            <PoissaoloJaVapautus
              tila={tila}
              tanaan={tanaan}
              onValmis={(teksti, listat) => { setIlmoitus({ teksti, listat }); hae(); }}
            />
          )}

          <section className="mb-8">
            <h3 className="text-lg font-bold text-ink mb-3">Tulevat vuorot</h3>
            {tila.vuorot.length === 0 && <p className="text-sm text-ink-muted">Ei vuoroja tulevilla listoilla.</p>}
            {[...listoittain].map(([alku, vuorot]) => {
              const l = tila.listat.find((x) => x.alku === alku);
              const yht = vuorot.reduce((s, v) => s + v.kestoMin, 0);
              return (
                <div key={alku} className="mb-4 bg-surface rounded-xl border border-line">
                  <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-line-soft">
                    <p className="text-sm font-medium text-ink-strong">
                      Lista {pvm(alku)}{l ? ` – ${pvm(l.viimeinen)}` : ''}
                      <span className="ml-2 text-xs font-normal text-ink-muted">
                        {vuorot.length} vuoroa · {tunnit(yht)} h{l?.julkaistu ? ' · julkaistu' : ''}
                      </span>
                    </p>
                    <button type="button" onClick={() => onAvaaLista(alku, undefined, username)} className="text-sm font-medium text-accent hover:underline">
                      Avaa lista →
                    </button>
                  </div>
                  <ul className="divide-y divide-line-soft">
                    {vuorot.map((v) => (
                      <li key={v.vuoroId} className={`px-4 py-2 text-sm flex flex-wrap justify-between gap-x-4 ${v.alkanut ? 'text-ink-muted' : 'text-ink-body'}`}>
                        <span>{pvm(v.pvm)} klo {klo(v.alkaa)}–{klo(v.paattyy)}</span>
                        <span className="text-ink-muted">{v.siteNimi} · {v.vuoroNimi}{v.alkanut ? ' · alkanut' : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>

          <section className="mb-8">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-3">
              <CalendarOff size={18} className="text-accent" />
              Poissaolot
            </h3>
            {tila.poissaolot.length === 0 ? (
              <p className="text-sm text-ink-muted">Ei kirjattuja poissaoloja.</p>
            ) : (
              <ul className="bg-surface rounded-xl border border-line divide-y divide-line-soft">
                {tila.poissaolot.map((p) => (
                  <li key={p.id} className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      {tila.poissaololajit[p.laji] || p.laji} {pvm(p.alku)}–{pvm(p.loppu)}
                      {' · '}{String(p.tunnit).replace('.', ',')} h
                      {p.huom && <span className="text-ink-muted"> · {p.huom}</span>}
                    </span>
                    {saaMuokata && (
                      <button type="button" onClick={() => poista(p.id)} className="text-ink-subtle hover:text-danger" title="Poista poissaolo">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

// Poissaolon kirjaus ja vuorojen vapautus yhdellä lomakkeella. Tunnit ehdotetaan
// vapautettavien vuorojen tunneista: sairausajan tunnit rinnastetaan työaikaan (TES 29 §),
// joten jakso ei näytä vajaalta eikä generaattori yritä täyttää sitä muilla vuoroilla.
const PoissaoloJaVapautus = ({
  tila, tanaan, onValmis,
}: { tila: HenkilonNakyma; tanaan: string; onValmis: (teksti: string, listat: string[]) => void }) => {
  const [auki, setAuki] = useState(false);
  const [laji, setLaji] = useState('sairaus');
  const [alku, setAlku] = useState(tanaan);
  const [loppu, setLoppu] = useState(tanaan);
  const [tunnitArvo, setTunnitArvo] = useState('');
  const [huom, setHuom] = useState('');
  const [vapauta, setVapauta] = useState(true);
  const [muutossyy, setMuutossyy] = useState('');
  const [tyossa, setTyossa] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);

  const osuvat = tila.vuorot.filter((v) => !v.alkanut && v.pvm >= alku && v.pvm <= loppu);
  const osuvatMin = osuvat.reduce((s, v) => s + v.kestoMin, 0);
  const julkaistuja = osuvat.some((v) => v.julkaistu);
  const syyPuuttuu = vapauta && julkaistuja && muutossyy.trim().length < 3;
  const ehdotetutTunnit = laji === 'vuosiloma' ? 'automaattinen' : tunnit(osuvatMin);

  const tallenna = async () => {
    setTyossa(true);
    setVirhe(null);
    const syotetyt = tunnitArvo.trim();
    const p = await kirjaaPoissaolo({
      username: tila.henkilo.username, laji, alku, loppu,
      tunnit: syotetyt !== '' ? Number(syotetyt.replace(',', '.')) : laji === 'vuosiloma' ? null : Math.round(osuvatMin / 6) / 10,
      huom,
    });
    if (!p.ok) { setTyossa(false); setVirhe(p.error); return; }
    let teksti = `Poissaolo kirjattu ${pvm(alku)}–${pvm(loppu)}.`;
    let listat: string[] = [];
    if (vapauta && osuvat.length) {
      const v = await vapautaVuorot(tila.henkilo.username, alku, loppu, muutossyy);
      if (!v.ok) {
        setTyossa(false);
        setVirhe(`Poissaolo kirjattiin, mutta vuorojen vapautus epäonnistui: ${v.error}`);
        onValmis(teksti, []);
        return;
      }
      listat = [...new Set(v.vapautetut.map((x) => x.listaAlku))];
      teksti += ` ${v.vapautetut.length} ${v.vapautetut.length === 1 ? 'vuoro vapautettiin' : 'vuoroa vapautettiin'}.`;
    }
    setTyossa(false);
    setAuki(false);
    setTunnitArvo('');
    setHuom('');
    onValmis(teksti, listat);
  };

  const kentta = 'bg-surface border border-line rounded-md px-2 py-1.5 text-sm text-ink';

  if (!auki) {
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setAuki(true)}
          className="inline-flex items-center gap-2 bg-surface hover:bg-sunken text-ink-body border border-line text-sm font-medium rounded-lg px-4 py-2"
        >
          <CalendarOff size={16} />
          Kirjaa poissaolo ja vapauta vuorot
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-sunken border border-line rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-ink-body">
          <span className="block font-medium mb-1">Laji</span>
          <select value={laji} onChange={(e) => setLaji(e.target.value)} className={kentta}>
            {Object.entries(tila.poissaololajit).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </label>
        <label className="text-xs text-ink-body">
          <span className="block font-medium mb-1">Alkaen</span>
          <input type="date" value={alku} onChange={(e) => { setAlku(e.target.value); if (loppu < e.target.value) setLoppu(e.target.value); }} className={kentta} />
        </label>
        <label className="text-xs text-ink-body">
          <span className="block font-medium mb-1">Asti</span>
          <input type="date" value={loppu} min={alku} onChange={(e) => setLoppu(e.target.value)} className={kentta} />
        </label>
        <label className="text-xs text-ink-body">
          <span className="block font-medium mb-1">Tunnit (työaikaan)</span>
          <input
            inputMode="decimal"
            placeholder={ehdotetutTunnit}
            value={tunnitArvo}
            onChange={(e) => setTunnitArvo(e.target.value)}
            className={`${kentta} w-28`}
          />
        </label>
      </div>
      <label className="block text-xs text-ink-body">
        <span className="block font-medium mb-1">Lisätieto (ei diagnooseja)</span>
        <input maxLength={200} value={huom} onChange={(e) => setHuom(e.target.value)} className={`${kentta} w-full`} />
      </label>
      <label className="flex items-start gap-2 text-sm text-ink-body">
        <input type="checkbox" checked={vapauta} onChange={(e) => setVapauta(e.target.checked)} className="mt-1" />
        <span>
          Vapauta henkilön vuorot tältä ajalta
          <span className="block text-xs text-ink-muted">
            {osuvat.length === 0
              ? 'Aikavälillä ei ole alkamattomia vuoroja.'
              : `${osuvat.length} ${osuvat.length === 1 ? 'vuoro' : 'vuoroa'}, ${tunnit(osuvatMin)} h${julkaistuja ? ' — julkaistuja vuoroja, muutoksesta ilmoitetaan vartijalle' : ''}.`}
            {' '}Tunnit-kenttä ehdottaa vapautettavien vuorojen tunteja, jotta jakso ei näytä vajaalta.
          </span>
        </span>
      </label>
      {vapauta && julkaistuja && (
        <label className="block text-xs text-ink-body">
          <span className="block font-medium mb-1">Muutoksen syy (pakollinen, lista on julkaistu)</span>
          <input
            maxLength={500}
            value={muutossyy}
            onChange={(e) => setMuutossyy(e.target.value)}
            placeholder="esim. Poissaolo, vuoro vapautettu"
            className={`${kentta} w-full`}
          />
        </label>
      )}
      {virhe && <p className="text-sm text-danger">{virhe}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={tyossa || syyPuuttuu || loppu < alku}
          onClick={tallenna}
          className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-60"
        >
          {tyossa ? 'Tallennetaan…' : vapauta && osuvat.length ? 'Kirjaa ja vapauta vuorot' : 'Kirjaa poissaolo'}
        </button>
        <button type="button" onClick={() => setAuki(false)} className="px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink-body">
          Peruuta
        </button>
      </div>
    </div>
  );
};
