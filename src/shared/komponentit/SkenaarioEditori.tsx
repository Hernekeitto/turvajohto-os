// Skenaariopohjan kohtien editori puuna.
//
// Skenaariossa voi olla valintakohtia ("Onko kohteessa tulipalo?"), joiden jokaisella
// vaihtoehdolla on oma polkunsa. Polun sisällä voi olla uusia valintoja. Litteän listan
// ylläpito on skenaariopuu.ts:ssä; tämä tiedosto on esitys.
import { Plus, Trash2, ArrowUp, ArrowDown, GitBranch, X } from 'lucide-react';

import {
  lapset, poistaKohta, poistaVaihtoehto, siirra, uusiId, type Luonnoskohta,
} from '../skenaariopuu';

type Props = {
  kohdat: Luonnoskohta[];
  onMuutos: (kohdat: Luonnoskohta[]) => void;
};

const SYVYYS_ENINTAAN = 4;

export const SkenaarioEditori = ({ kohdat, onMuutos }: Props) => {
  const muuta = (id: string, muutos: Partial<Luonnoskohta>) =>
    onMuutos(kohdat.map((k) => (k.id === id ? { ...k, ...muutos } : k)));

  const lisaa = (haara: string, valinta: boolean) => {
    const uusi: Luonnoskohta = valinta
      ? {
          id: uusiId(), teksti: '', haara: haara || undefined, tyyppi: 'valinta', kriittinen: true,
          vaihtoehdot: [{ id: uusiId(), teksti: 'Kyllä' }, { id: uusiId(), teksti: 'Ei' }],
        }
      : { id: uusiId(), teksti: '', haara: haara || undefined };
    onMuutos([...kohdat, uusi]);
  };

  const poista = (kohta: Luonnoskohta) => {
    const alla = kohta.tyyppi === 'valinta'
      && kohdat.some((k) => k.haara && (kohta.vaihtoehdot || []).some((v) => v.id === k.haara));
    if (alla && !window.confirm('Poistetaanko valinta ja kaikki sen polkujen kohdat?')) return;
    onMuutos(poistaKohta(kohdat, kohta.id as string));
  };

  // Tavallinen funktio eikä komponentti: sisäkkäin määritelty komponentti olisi joka
  // renderöinnillä uusi tyyppi, ja kentät menettäisivät kohdistuksen jokaisella näppäilyllä.
  const haaranKohdat = (haara: string, syvyys: number) => {
    const omat = lapset(kohdat, haara);
    return (
      <div className="space-y-3">
        {omat.length === 0 && haara && (
          <p className="text-xs text-ink-muted">Tällä polulla ei ole vielä kohtia.</p>
        )}
        {omat.map((kohta, i) => (
          <div key={kohta.id} className="bg-sunken border border-line-soft rounded-lg p-3">
            <div className="flex items-start gap-2">
              {kohta.tyyppi === 'valinta'
                ? <GitBranch size={16} className="text-accent mt-2.5 shrink-0" />
                : <span className="text-xs font-mono text-ink-subtle mt-2.5 w-4 shrink-0">{omat.slice(0, i + 1).filter((k) => k.tyyppi !== 'valinta').length}.</span>}
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="text"
                  value={kohta.teksti || ''}
                  onChange={(e) => muuta(kohta.id as string, { teksti: e.target.value })}
                  placeholder={kohta.tyyppi === 'valinta' ? 'Kysymys, esim. Onko kohteessa tulipalo?' : 'Mitä tehdään'}
                  className="w-full bg-surface border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-strong"
                />
                <input
                  type="text"
                  value={kohta.kuvaus || ''}
                  onChange={(e) => muuta(kohta.id as string, { kuvaus: e.target.value })}
                  placeholder="Tarkennus (valinnainen)"
                  className="w-full bg-surface border border-line-soft rounded-lg px-3 py-2 text-xs text-ink-body"
                />
                <div className="flex flex-wrap gap-2">
                  {kohta.tyyppi !== 'valinta' && (
                    <input
                      type="text"
                      value={kohta.vastuu || ''}
                      onChange={(e) => muuta(kohta.id as string, { vastuu: e.target.value })}
                      placeholder="Vastuu, esim. Turva 1"
                      className="flex-1 min-w-[120px] bg-surface border border-line-soft rounded-lg px-3 py-2 text-xs text-ink-body"
                    />
                  )}
                  <label className="inline-flex items-center gap-2 text-xs text-ink-body px-2">
                    <input
                      type="checkbox"
                      checked={kohta.kriittinen === true}
                      onChange={(e) => muuta(kohta.id as string, { kriittinen: e.target.checked })}
                    />
                    {kohta.tyyppi === 'valinta' ? 'Valinta pakollinen' : 'Kriittinen'}
                  </label>
                </div>

                {kohta.tyyppi === 'valinta' && (
                  <div className="space-y-3 pt-1">
                    {(kohta.vaihtoehdot || []).map((v) => (
                      <div key={v.id} className="border-l-4 border-accent/40 pl-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-ink-muted shrink-0">Jos</span>
                          <input
                            type="text"
                            value={v.teksti}
                            onChange={(e) => muuta(kohta.id as string, {
                              vaihtoehdot: (kohta.vaihtoehdot || []).map((x) => (x.id === v.id ? { ...x, teksti: e.target.value } : x)),
                            })}
                            placeholder="Vaihtoehto"
                            className="flex-1 min-w-0 bg-surface border border-line-soft rounded-lg px-3 py-1.5 text-sm font-bold text-ink-strong"
                          />
                          {(kohta.vaihtoehdot || []).length > 2 && (
                            <button
                              type="button"
                              title="Poista vaihtoehto ja sen polku"
                              onClick={() => onMuutos(poistaVaihtoehto(kohdat, kohta.id as string, v.id))}
                              className="text-ink-muted hover:text-danger"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        {haaranKohdat(v.id, syvyys + 1)}
                      </div>
                    ))}
                    {(kohta.vaihtoehdot || []).length < 6 && (
                      <button
                        type="button"
                        onClick={() => muuta(kohta.id as string, {
                          vaihtoehdot: [...(kohta.vaihtoehdot || []), { id: uusiId(), teksti: '' }],
                        })}
                        className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:text-accent-hover"
                      >
                        <Plus size={13} />
                        Lisää vaihtoehto
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button type="button" onClick={() => onMuutos(siirra(kohdat, kohta.id as string, -1))} title="Siirrä ylös" className="text-ink-muted hover:text-ink-strong">
                  <ArrowUp size={14} />
                </button>
                <button type="button" onClick={() => onMuutos(siirra(kohdat, kohta.id as string, 1))} title="Siirrä alas" className="text-ink-muted hover:text-ink-strong">
                  <ArrowDown size={14} />
                </button>
                <button type="button" onClick={() => poista(kohta)} title="Poista" className="text-ink-muted hover:text-danger">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => lisaa(haara, false)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-hover"
          >
            <Plus size={14} />
            Lisää toimenpide
          </button>
          {syvyys < SYVYYS_ENINTAAN && (
            <button
              type="button"
              onClick={() => lisaa(haara, true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-hover"
            >
              <GitBranch size={14} />
              Lisää valinta
            </button>
          )}
        </div>
      </div>
    );
  };

  return haaranKohdat('', 0);
};
