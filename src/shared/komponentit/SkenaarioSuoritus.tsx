// Käynnissä olevan skenaarion (tai run sheetin) kortti.
//
// Sama kortti kahdessa roolissa:
//  - 'toimija': kentällä oleva vartija kuittaa kohtia, valitsee polun ja päättää tilanteen.
//  - 'seuranta': HÄLKE näkee saman tilannekuvan ja kirjoittaa tilannelokiin, mutta ei
//    kuittaa kentän puolesta.
// Yksi komponentti, jotta vartija ja päivystäjä katsovat varmasti samaa kuvaa.
import { useState } from 'react';
import {
  Check, Flag, Ban, User, GitBranch, MessageSquare, Send, CircleDot,
} from 'lucide-react';

import {
  aktiivisetKohdat, kellonaika, kriittisetKuittaamatta, kuittaamatta, aktiivisia, tilanneloki,
  kuittaaKohta, valitsePolku, lisaaKommentti, paataSuoritus,
  type Suoritus, type SuoritusKohta, type Vastaus, type LokiRivi,
} from '../pohjat';

type Props = {
  suoritus: Suoritus;
  rooli: 'toimija' | 'seuranta';
  onMuuttui: (suoritus: Suoritus) => void;
  // Otsikkorivin lisätieto, esim. kohteen nimi HÄLKE:ssä.
  lisatieto?: string;
};

// Kohdan syvyys puussa: montako valintaa sen yläpuolella on.
function syvyydet(kohdat: SuoritusKohta[]): Map<string, number> {
  const valinnalle = new Map<string, SuoritusKohta>();
  for (const k of kohdat) for (const v of k.vaihtoehdot || []) valinnalle.set(v.id, k);
  const tulos = new Map<string, number>();
  for (const k of kohdat) {
    let syvyys = 0;
    let nykyinen: SuoritusKohta | undefined = k;
    while (nykyinen?.haara && syvyys < 50) {
      nykyinen = valinnalle.get(nykyinen.haara);
      syvyys += 1;
    }
    tulos.set(k.kohtaId, syvyys);
  }
  return tulos;
}

const LOKI_IKONI: Record<LokiRivi['laji'], typeof Check> = {
  tila: CircleDot,
  kuittaus: Check,
  kommentti: MessageSquare,
  valinta: GitBranch,
};

export const SkenaarioSuoritus = ({ suoritus, rooli, onMuuttui, lisatieto }: Props) => {
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);
  const [huomiot, setHuomiot] = useState<Record<string, string>>({});
  const [kommentti, setKommentti] = useState('');
  const [paatos, setPaatos] = useState({ syy: '', huomiot: '' });

  const toimija = rooli === 'toimija';
  const kesken = suoritus.tila === 'kesken';
  const aktiiviset = aktiivisetKohdat(suoritus.kohdat);
  const syvyys = syvyydet(suoritus.kohdat);
  const loki = tilanneloki(suoritus);
  const kriittisia = kriittisetKuittaamatta(suoritus);

  const kutsu = async (tehtava: () => Promise<Vastaus>) => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = await tehtava();
      if (!tulos.ok) setVirhe(tulos.error || 'Toiminto epäonnistui.');
      else if (tulos.suoritus) onMuuttui(tulos.suoritus);
      return tulos.ok;
    } finally {
      setTyoskentelee(false);
    }
  };

  const kuittaa = async (kohta: SuoritusKohta) => {
    if (await kutsu(() => kuittaaKohta(suoritus.id, kohta.kohtaId, huomiot[kohta.kohtaId] || ''))) {
      setHuomiot((e) => ({ ...e, [kohta.kohtaId]: '' }));
    }
  };

  const valitse = async (kohta: SuoritusKohta, vaihtoehtoId: string) => {
    if (kohta.valittu === vaihtoehtoId) return;
    if (kohta.valittu) {
      const uusi = kohta.vaihtoehdot?.find((v) => v.id === vaihtoehtoId)?.teksti;
      if (!window.confirm(`Vaihdetaanko polku: "${uusi}"? Vaihto kirjataan tilannelokiin.`)) return;
    }
    await kutsu(() => valitsePolku(suoritus.id, kohta.kohtaId, vaihtoehtoId));
  };

  const kirjaa = async () => {
    if (!kommentti.trim()) return;
    if (await kutsu(() => lisaaKommentti(suoritus.id, kommentti))) setKommentti('');
  };

  const paata = async (tila: 'valmis' | 'keskeytetty') => {
    if (await kutsu(() => paataSuoritus(suoritus.id, { tila, syy: paatos.syy, huomiot: paatos.huomiot }))) {
      setPaatos({ syy: '', huomiot: '' });
    }
  };

  let numero = 0;

  return (
    <div className={`bg-surface border-2 rounded-xl p-4 md:p-5 ${kesken ? 'border-accent/40' : 'border-line'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h4 className="font-bold text-ink-strong">{suoritus.templateNimi}</h4>
          <p className="text-xs text-ink-muted mt-0.5">
            {lisatieto ? `${lisatieto} · ` : ''}
            Aloitettu {kellonaika(suoritus.alkoi)} · {suoritus.tekija} ·{' '}
            {aktiivisia(suoritus) - kuittaamatta(suoritus)}/{aktiivisia(suoritus)} tehty
          </p>
          {suoritus.kuvaus && <p className="text-sm text-ink-body mt-1">{suoritus.kuvaus}</p>}
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border shrink-0 ${
          kesken ? 'bg-warning-soft text-warning-ink border-warning/30' : 'bg-sunken text-ink-body border-line'
        }`}
        >
          {kesken ? 'Käynnissä' : suoritus.tila === 'valmis' ? 'Hoidettu' : 'Keskeytetty'}
        </span>
      </div>

      {virhe && (
        <p className="mb-3 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-3 py-2">{virhe}</p>
      )}

      {/* --- Kohdat: vain aktiivinen polku --- */}
      <ol className="space-y-2">
        {aktiiviset.map((kohta) => {
          const sisennys = (syvyys.get(kohta.kohtaId) || 0) * 20;
          if (kohta.tyyppi === 'valinta') {
            return (
              <li
                key={kohta.kohtaId}
                style={{ marginLeft: sisennys }}
                className={`rounded-lg px-3 py-2.5 border ${kohta.valittu ? 'bg-accent-soft border-accent/30' : 'bg-warning-soft border-warning/40'}`}
              >
                <p className="text-sm font-bold text-ink-strong flex items-center gap-2">
                  <GitBranch size={15} className="shrink-0" />
                  {kohta.teksti}
                  {kohta.kriittinen && !kohta.valittu && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-soft text-danger-ink border border-danger/30">
                      kriittinen
                    </span>
                  )}
                </p>
                {kohta.kuvaus && <p className="text-xs text-ink-muted mt-0.5 ml-6">{kohta.kuvaus}</p>}
                <div className="flex flex-wrap gap-2 mt-2 ml-6">
                  {(kohta.vaihtoehdot || []).map((v) => {
                    const valittu = kohta.valittu === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={!toimija || !kesken || tyoskentelee}
                        onClick={() => valitse(kohta, v.id)}
                        className={`text-sm font-bold rounded-lg px-4 py-2 border transition-colors ${
                          valittu
                            ? 'bg-accent text-white border-accent'
                            : 'bg-surface text-ink-body border-line-strong enabled:hover:bg-sunken disabled:opacity-60'
                        }`}
                      >
                        {v.teksti}
                      </button>
                    );
                  })}
                </div>
                {kohta.valittu && kohta.kuitattu && (
                  <p className="text-xs text-ink-subtle mt-1.5 ml-6">
                    Valittu {kellonaika(kohta.kuitattu)} {kohta.kuittaaja}
                  </p>
                )}
              </li>
            );
          }
          numero += 1;
          return (
            <li
              key={kohta.kohtaId}
              style={{ marginLeft: sisennys }}
              className={`rounded-lg px-3 py-2.5 border ${kohta.kuitattu ? 'bg-success-soft border-success/30' : 'bg-sunken border-line-soft'}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xs font-mono text-ink-subtle w-5 shrink-0 mt-0.5">{numero}.</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${kohta.kuitattu ? 'text-success-ink' : 'text-ink-strong'}`}>
                    {kohta.aika && <span className="font-mono mr-2">{kohta.aika}</span>}
                    {kohta.teksti}
                    {kohta.kriittinen && !kohta.kuitattu && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-soft text-danger-ink border border-danger/30">
                        kriittinen
                      </span>
                    )}
                  </p>
                  {kohta.kuvaus && <p className="text-xs text-ink-muted mt-0.5">{kohta.kuvaus}</p>}
                  <p className="text-xs text-ink-subtle mt-0.5 flex flex-wrap gap-x-3">
                    {kohta.vastuu && <span className="inline-flex items-center gap-1"><User size={11} />{kohta.vastuu}</span>}
                    {kohta.kuitattu && (
                      <span className="inline-flex items-center gap-1">
                        <Check size={11} />
                        {kellonaika(kohta.kuitattu)} {kohta.kuittaaja}
                      </span>
                    )}
                  </p>
                  {kohta.huomio && <p className="text-xs text-ink-body mt-1">{kohta.huomio}</p>}
                </div>
                {toimija && kesken && !kohta.kuitattu && (
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <input
                      type="text"
                      value={huomiot[kohta.kohtaId] || ''}
                      onChange={(e) => setHuomiot((edellinen) => ({ ...edellinen, [kohta.kohtaId]: e.target.value }))}
                      placeholder="Huomio"
                      className="w-28 sm:w-32 bg-surface border border-line-soft rounded-lg px-2 py-1.5 text-xs text-ink-body"
                    />
                    <button
                      type="button"
                      onClick={() => kuittaa(kohta)}
                      disabled={tyoskentelee}
                      className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-xs font-bold rounded-lg px-3 py-2 transition-colors"
                    >
                      <Check size={14} />
                      Kuittaa
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* --- Tilanneloki --- */}
      <div className="mt-4 pt-4 border-t border-line-soft">
        <h5 className="text-sm font-bold text-ink-strong mb-2 flex items-center gap-2">
          <MessageSquare size={15} />
          Tilanneloki
        </h5>
        <ul className="space-y-1.5 mb-3">
          {loki.map((rivi) => {
            const Ikoni = LOKI_IKONI[rivi.laji];
            return (
              <li key={rivi.id} className="flex items-start gap-2 text-sm">
                <span className="font-mono text-xs text-ink-subtle w-10 shrink-0 mt-0.5">{kellonaika(rivi.aika)}</span>
                <Ikoni size={13} className={`shrink-0 mt-1 ${rivi.laji === 'kommentti' ? 'text-accent' : 'text-ink-subtle'}`} />
                <p className={`min-w-0 flex-1 ${rivi.laji === 'kommentti' ? 'text-ink-strong' : 'text-ink-body'}`}>
                  {rivi.teksti}
                  {rivi.tekija && <span className="text-xs text-ink-subtle"> · {rivi.tekija}</span>}
                </p>
              </li>
            );
          })}
        </ul>
        {kesken && (
          <div className="flex gap-2">
            <input
              type="text"
              value={kommentti}
              onChange={(e) => setKommentti(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') kirjaa(); }}
              maxLength={1000}
              placeholder="Kirjoita tilannetieto, esim. palokunta paikalla"
              className="flex-1 min-w-0 bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-body"
            />
            <button
              type="button"
              onClick={kirjaa}
              disabled={tyoskentelee || !kommentti.trim()}
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2 transition-colors shrink-0"
            >
              <Send size={14} />
              Kirjaa
            </button>
          </div>
        )}
      </div>

      {/* --- Päättäminen --- */}
      {toimija && kesken && (
        <div className="pt-4 mt-4 border-t border-line-soft space-y-3">
          {kriittisia > 0 && (
            <p className="text-sm text-warning-ink">
              {kriittisia === 1
                ? 'Yksi kriittinen kohta on tekemättä. Sitä ei voi ohittaa merkitsemällä hoidetuksi.'
                : `${kriittisia} kriittistä kohtaa on tekemättä.`}
            </p>
          )}
          <input
            type="text"
            value={paatos.huomiot}
            onChange={(e) => setPaatos({ ...paatos, huomiot: e.target.value })}
            placeholder="Loppuhuomiot (valinnainen)"
            className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-body"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => paata('valmis')}
              disabled={tyoskentelee}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2.5 transition-colors"
            >
              <Flag size={16} />
              Merkitse hoidetuksi
            </button>
            <input
              type="text"
              value={paatos.syy}
              onChange={(e) => setPaatos({ ...paatos, syy: e.target.value })}
              placeholder="Keskeytyksen syy"
              className="flex-1 min-w-[160px] bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-body"
            />
            <button
              type="button"
              onClick={() => paata('keskeytetty')}
              disabled={tyoskentelee}
              className="inline-flex items-center gap-2 border border-line-strong hover:bg-sunken disabled:opacity-60 text-ink-body text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
            >
              <Ban size={16} />
              Keskeytä
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
