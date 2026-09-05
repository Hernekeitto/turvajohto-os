import { useState } from 'react';
import { CheckSquare, ListChecks, Check, X, ClipboardList } from 'lucide-react';
import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { Kentta } from './Kentta';
import { uusiId, type Kohde, type Tehtava, type TehtavaSuoritus } from './tyypit';

// Työvuoron tehtävien suoritus. Vartija kuittaa kohteelle määritellyt tehtävät: joko yhtenä
// kyllä/ei-vastauksena tai tarkistuslistana jossa jokainen kohta kuitataan erikseen.
//
// Suoritus tallentuu heti kuittauksesta omaksi tietueekseen (guardTaskRuns) eikä muuta
// tehtävän määrittelyä. Sama tehtävä voidaan siis suorittaa monta kertaa — kierros ajetaan
// joka vuorossa uudelleen, ja jokainen kerta on oma merkintänsä lokissa.

type Props = {
  kohde: Kohde;
  suoritukset: TehtavaSuoritus[];
  vartija: string;
  saaKuitata: boolean;
  onSuorita: (suoritus: TehtavaSuoritus) => Promise<boolean>;
  onTakaisin: () => void;
};

const muotoileAika = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fi-FI', {
    day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const Tehtavat = ({
  kohde,
  suoritukset,
  vartija,
  saaKuitata,
  onSuorita,
  onTakaisin,
}: Props) => {
  // Avoinna oleva tehtävä ja sen keskeneräiset kuittaukset. Pidetään erillään
  // suorituksista: mitään ei tallenneta ennen kuin vartija painaa "Kirjaa suoritus".
  const [avoin, setAvoin] = useState<Tehtava | null>(null);
  const [kuitatut, setKuitatut] = useState<string[]>([]);
  const [huomiot, setHuomiot] = useState('');
  const [tallentaa, setTallentaa] = useState(false);

  const tehtavat = kohde.tehtavat || [];

  const avaa = (t: Tehtava) => {
    setAvoin(t);
    setKuitatut([]);
    setHuomiot('');
  };

  const kirjaa = async (suoritettu: boolean) => {
    if (!avoin) return;
    setTallentaa(true);
    const suoritus: TehtavaSuoritus = {
      id: uusiId(),
      siteId: kohde.id,
      tehtavaId: avoin.id,
      // Tehtävän nimi tallennetaan mukaan: jos tehtävä myöhemmin nimetään uudelleen tai
      // poistetaan kohteesta, lokimerkinnän on silti kerrottava mitä tehtiin.
      tehtavaNimi: avoin.nimi,
      vartija,
      aika: new Date().toISOString(),
      ...(avoin.tyyppi === 'lista'
        ? { kuitatut, suoritettu: kuitatut.length === avoin.kohdat.length }
        : { suoritettu }),
      huomiot: huomiot.trim() || undefined,
    };
    const ok = await onSuorita(suoritus);
    setTallentaa(false);
    if (ok) setAvoin(null);
  };

  const kohteenSuoritukset = suoritukset
    .filter((s) => s.siteId === kohde.id)
    .sort((a, b) => (a.aika < b.aika ? 1 : -1));

  return (
    <div className="max-w-3xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin kohteeseen</TakaisinLinkki>
      <h2 className="text-2xl font-bold text-ink-strong mb-1">{kohde.name}</h2>
      <p className="text-sm text-ink-muted mb-8">
        Työvuoron tehtävät. Kuittaus tallentuu heti ja jää kohteen lokiin.
      </p>

      {tehtavat.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl p-10 text-center">
          <ClipboardList className="w-10 h-10 text-ink-subtle mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-sm text-ink-muted">
            Tälle kohteelle ei ole määritelty tehtäviä. Ne lisätään kohteen hallinnasta.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tehtavat.map((t) => {
            const viimeisin = kohteenSuoritukset.find((s) => s.tehtavaId === t.id);
            const auki = avoin?.id === t.id;
            return (
              <div key={t.id} className="bg-surface border border-line rounded-xl p-5">
                <div className="flex items-start gap-3">
                  {t.tyyppi === 'lista' ? (
                    <ListChecks size={18} className="text-accent shrink-0 mt-0.5" />
                  ) : (
                    <CheckSquare size={18} className="text-accent shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-ink-strong">{t.nimi}</h3>
                    {t.kuvaus && (
                      <p className="text-sm text-ink-muted mt-1 leading-relaxed">{t.kuvaus}</p>
                    )}
                    {viimeisin && (
                      <p className="text-xs text-ink-subtle mt-2">
                        Viimeksi {muotoileAika(viimeisin.aika)} · {viimeisin.vartija}
                        {viimeisin.suoritettu === false ? ' · ei suoritettu' : ''}
                      </p>
                    )}
                  </div>
                  {saaKuitata && !auki && (
                    <button
                      type="button"
                      onClick={() => avaa(t)}
                      className="shrink-0 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                    >
                      Kuittaa
                    </button>
                  )}
                </div>

                {auki && (
                  <div className="mt-5 pt-5 border-t border-line-soft">
                    {t.tyyppi === 'lista' && (
                      <div className="space-y-2 mb-4">
                        {t.kohdat.map((kohta) => (
                          <label
                            key={kohta}
                            className="flex items-start gap-3 p-3 rounded-lg border border-line hover:bg-sunken cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={kuitatut.includes(kohta)}
                              onChange={() => setKuitatut((prev) => (
                                prev.includes(kohta) ? prev.filter((k) => k !== kohta) : [...prev, kohta]
                              ))}
                              className="w-4 h-4 mt-0.5 text-accent rounded border-line-strong focus:ring-accent"
                            />
                            <span className="text-sm text-ink-body">{kohta}</span>
                          </label>
                        ))}
                        <p className="text-xs text-ink-subtle">
                          {kuitatut.length} / {t.kohdat.length} kuitattu
                          {kuitatut.length < t.kohdat.length && ' — kirjaus tallentuu myös vajaana'}
                        </p>
                      </div>
                    )}

                    <div className="mb-4">
                      <Kentta
                        label="Huomiot (valinnainen)"
                        arvo={huomiot}
                        onChange={setHuomiot}
                        placeholder="Mitä kierroksella havaittiin"
                        monirivinen
                      />
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAvoin(null)}
                        className="px-4 py-2 text-sm font-medium text-ink-body bg-sunken hover:bg-line rounded-lg transition-colors"
                      >
                        Peruuta
                      </button>
                      {t.tyyppi === 'kuittaus' && (
                        <button
                          type="button"
                          disabled={tallentaa}
                          onClick={() => kirjaa(false)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-danger-ink bg-danger-soft hover:brightness-95 rounded-lg transition-colors disabled:opacity-60"
                        >
                          <X size={16} />
                          Ei suoritettu
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={tallentaa}
                        onClick={() => kirjaa(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-60"
                      >
                        <Check size={16} />
                        {tallentaa ? 'Kirjataan…' : 'Kirjaa suoritus'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {kohteenSuoritukset.length > 0 && (
        <div className="mt-10">
          <h3 className="font-bold text-ink-strong mb-3">Viimeisimmät suoritukset</h3>
          <div className="border border-line rounded-lg divide-y divide-line-soft bg-surface">
            {kohteenSuoritukset.slice(0, 10).map((s) => (
              <div key={s.id} className="px-4 py-3">
                <div className="flex items-start gap-2">
                  {s.suoritettu === false ? (
                    <X size={15} className="text-danger shrink-0 mt-0.5" />
                  ) : (
                    <Check size={15} className="text-success shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{s.tehtavaNimi}</p>
                    <p className="text-xs text-ink-muted">
                      {muotoileAika(s.aika)} · {s.vartija}
                      {s.kuitatut ? ` · ${s.kuitatut.length} kohtaa kuitattu` : ''}
                    </p>
                    {s.huomiot && (
                      <p className="text-xs text-ink-body mt-1 leading-relaxed">{s.huomiot}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
