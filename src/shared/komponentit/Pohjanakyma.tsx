// Pohjien näkymä: ohjepankki, skenaariot ja run sheet samalla komponentilla.
//
// YKSI KOMPONENTTI KOLMELLE LAJILLE eikä kolmea samannäköistä. Lajien ero on pieni ja
// nimenomaan sisällössä: ohjekorttia luetaan, skenaario ja run sheet käynnistetään ja
// kuitataan kohta kerrallaan. Kolme erillistä näkymää tarkoittaisi kolme kertaa saman
// editorin, saman virheenkäsittelyn ja saman listan — ja ne erkanisivat ensimmäisen
// korjauksen yhteydessä.
//
// Sama komponentti palvelee molempia puolia: EVENT antaa omistajaksi tapahtuman, GUARD
// kohteen. Oikeudet ratkaistaan kutsuvassa näkymässä, koska solmut ovat eri.
import { useState } from 'react';
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Check, Play, ChevronRight, ChevronDown, Archive, Clock, User, GitBranch, RadioTower } from 'lucide-react';

import {
  LAJIT, TILA_LABEL, kellonaika, valitutPolut,
  luoPohja, paivitaPohja, arkistoiPohja, aloitaSuoritus,
  type Kohta, type Pohja, type Suoritus, type Vastaus,
} from '../pohjat';
import { puujarjestys, syvyys } from '../skenaariopuu';
import { SkenaarioEditori } from './SkenaarioEditori';
import { SkenaarioSuoritus } from './SkenaarioSuoritus';

type Laji = 'guide' | 'play' | 'runsheet';

type Props = {
  laji: Laji;
  ownerId: string;
  ownerNimi: string;
  pohjat: Pohja[];
  suoritukset: Suoritus[];
  saaMuokata: boolean;
  // Pohjat haetaan uudelleen palvelimelta: versio ja id syntyvät siellä.
  onPohjatMuuttui: () => void;
  // Suoritus palautuu palvelimelta valmiina tietueena.
  onSuoritusMuuttui: (suoritus: Suoritus) => void;
};

type Luonnos = {
  id: string | null;
  nimi: string;
  kuvaus: string;
  kohdat: Partial<Kohta>[];
  // Vain skenaariossa: näkyykö käynnistetty tilanne HÄLKE:ssä.
  halke: boolean;
};

const tyhjaLuonnos = (): Luonnos => ({ id: null, nimi: '', kuvaus: '', kohdat: [], halke: true });

const luonnosPohjasta = (pohja: Pohja): Luonnos => ({
  id: pohja.id,
  nimi: pohja.nimi,
  kuvaus: pohja.kuvaus || '',
  // Kopio, jotta peruutus ei jätä muokattua listaa näkyviin.
  kohdat: (pohja.kohdat || []).map((k) => ({ ...k })),
  halke: pohja.halke !== false,
});

export const Pohjanakyma = ({
  laji, ownerId, ownerNimi, pohjat, suoritukset, saaMuokata, onPohjatMuuttui, onSuoritusMuuttui,
}: Props) => {
  const meta = LAJIT[laji];
  const [luonnos, setLuonnos] = useState<Luonnos | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);
  const [avattu, setAvattu] = useState<string | null>(null);
  const [aloitusKuvaus, setAloitusKuvaus] = useState<Record<string, string>>({});
  const [ilmoitus, setIlmoitus] = useState<string | null>(null);

  const omat = pohjat.filter((p) => p.ownerId === ownerId && p.kind === laji);
  const kaytossa = omat.filter((p) => !p.arkistoitu);
  const arkistoidut = omat.filter((p) => p.arkistoitu);
  const omatSuoritukset = suoritukset.filter((s) => s.ownerId === ownerId && s.kind === laji);
  const kesken = omatSuoritukset.filter((s) => s.tila === 'kesken');
  const paattyneet = omatSuoritukset
    .filter((s) => s.tila !== 'kesken')
    .sort((a, b) => String(b.alkoi).localeCompare(String(a.alkoi)))
    .slice(0, 10);

  const kutsu = async (tehtava: () => Promise<Vastaus>): Promise<Vastaus> => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = await tehtava();
      if (!tulos.ok) setVirhe(tulos.error || 'Toiminto epäonnistui.');
      return tulos;
    } finally {
      setTyoskentelee(false);
    }
  };

  // --- Pohjan muokkaus ------------------------------------------------------------

  const muutaKohta = (i: number, muutos: Partial<Kohta>) => {
    if (!luonnos) return;
    setLuonnos({ ...luonnos, kohdat: luonnos.kohdat.map((k, j) => (j === i ? { ...k, ...muutos } : k)) });
  };

  const siirraKohta = (i: number, suunta: -1 | 1) => {
    if (!luonnos) return;
    const j = i + suunta;
    if (j < 0 || j >= luonnos.kohdat.length) return;
    const kohdat = [...luonnos.kohdat];
    [kohdat[i], kohdat[j]] = [kohdat[j], kohdat[i]];
    setLuonnos({ ...luonnos, kohdat });
  };

  const tallenna = async () => {
    if (!luonnos) return;
    // Skenaarion puu tallennetaan syvyysjärjestyksessä: palvelin vaatii että valinta on
    // ennen oman polkunsa kohtia.
    const jarjestetyt = laji === 'play' ? puujarjestys(luonnos.kohdat) : luonnos.kohdat;
    const runko = {
      nimi: luonnos.nimi,
      kuvaus: luonnos.kuvaus,
      // Järjestys tulee listan järjestyksestä: palvelin numeroi kohdat uudelleen, joten
      // sitä ei tarvitse pitää kirjaa täällä.
      kohdat: jarjestetyt.map((k, i) => ({ ...k, jarjestys: i })),
      ...(laji === 'play' ? { halke: luonnos.halke } : {}),
    };
    const tulos = luonnos.id
      ? await kutsu(() => paivitaPohja(luonnos.id as string, runko))
      : await kutsu(() => luoPohja({ kind: laji, ownerId, ...runko }));
    if (tulos.ok) {
      setLuonnos(null);
      onPohjatMuuttui();
    }
  };

  // --- Suoritus -------------------------------------------------------------------

  // Palvelin liittää käynnistäjän samasta pohjasta jo käynnissä olevaan suoritukseen
  // (yksi tilanne, yksi suoritus kohteessa), ja siitä kerrotaan käyttäjälle.
  const kaynnista = async (pohja: Pohja) => {
    setIlmoitus(null);
    const tulos = await kutsu(() => aloitaSuoritus(pohja.id, aloitusKuvaus[pohja.id] || ''));
    if (tulos.ok && tulos.suoritus) {
      setAloitusKuvaus((edellinen) => ({ ...edellinen, [pohja.id]: '' }));
      if (tulos.liittyi) setIlmoitus(`${pohja.nimi} oli jo käynnissä. Liityit samaan tilanteeseen.`);
      onSuoritusMuuttui(tulos.suoritus);
    }
  };

  // --- Editori --------------------------------------------------------------------

  if (luonnos) {
    return (
      <div className="max-w-3xl">
        <h3 className="text-lg font-bold text-ink-strong mb-1">
          {luonnos.id ? `Muokkaa: ${luonnos.nimi}` : `Uusi ${meta.nimi.toLowerCase()}`}
        </h3>
        <p className="text-sm text-ink-muted mb-4">{ownerNimi}</p>

        {virhe && (
          <p className="mb-4 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
            {virhe}
          </p>
        )}

        <label className="block mb-3">
          <span className="block text-sm font-medium text-ink-body mb-1">Nimi</span>
          <input
            type="text"
            value={luonnos.nimi}
            onChange={(e) => setLuonnos({ ...luonnos, nimi: e.target.value })}
            placeholder={laji === 'play' ? 'Esim. Kadonnut lapsi' : laji === 'runsheet' ? 'Esim. Lauantain ajolista' : 'Esim. Kaasuvuoto'}
            className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2.5 text-sm text-ink-strong"
          />
        </label>

        <label className="block mb-4">
          <span className="block text-sm font-medium text-ink-body mb-1">Kuvaus (valinnainen)</span>
          <input
            type="text"
            value={luonnos.kuvaus}
            onChange={(e) => setLuonnos({ ...luonnos, kuvaus: e.target.value })}
            placeholder="Milloin tätä käytetään"
            className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2.5 text-sm text-ink-strong"
          />
        </label>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink-body">
              {laji === 'play' ? 'Kohdat ja valinnat' : `${meta.kohdanNimi}: ${luonnos.kohdat.length}`}
            </span>
            {/* Skenaariossa kohdat lisätään puun omista painikkeista, jotta ne osuvat oikeaan polkuun. */}
            {laji !== 'play' && <button
              type="button"
              onClick={() => setLuonnos({ ...luonnos, kohdat: [...luonnos.kohdat, { teksti: '' }] })}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-hover"
            >
              <Plus size={14} />
              Lisää kohta
            </button>}
          </div>

          {laji === 'play' ? (
            <SkenaarioEditori
              kohdat={luonnos.kohdat}
              onMuutos={(kohdat) => setLuonnos({ ...luonnos, kohdat })}
            />
          ) : luonnos.kohdat.length === 0 ? (
            <p className="text-sm text-ink-muted bg-sunken border border-line-soft rounded-lg p-4">
              Lisää vähintään yksi kohta. Tyhjää pohjaa ei voi tallentaa.
            </p>
          ) : (
            <ol className="space-y-3">
              {luonnos.kohdat.map((kohta, i) => (
                <li key={i} className="bg-sunken border border-line-soft rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-ink-subtle mt-2.5 w-5 shrink-0">{i + 1}.</span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        type="text"
                        value={kohta.teksti || ''}
                        onChange={(e) => muutaKohta(i, { teksti: e.target.value })}
                        placeholder="Mitä tehdään"
                        className="w-full bg-surface border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-strong"
                      />
                      <input
                        type="text"
                        value={kohta.kuvaus || ''}
                        onChange={(e) => muutaKohta(i, { kuvaus: e.target.value })}
                        placeholder="Tarkennus (valinnainen)"
                        className="w-full bg-surface border border-line-soft rounded-lg px-3 py-2 text-xs text-ink-body"
                      />
                      {laji === 'runsheet' && (
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={kohta.aika || ''}
                            onChange={(e) => muutaKohta(i, { aika: e.target.value })}
                            placeholder="14.00"
                            className="w-24 bg-surface border border-line-soft rounded-lg px-3 py-2 text-xs text-ink-body"
                          />
                          <input
                            type="text"
                            value={kohta.vastuu || ''}
                            onChange={(e) => muutaKohta(i, { vastuu: e.target.value })}
                            placeholder="Vastuu, esim. Turva 1"
                            className="flex-1 min-w-[120px] bg-surface border border-line-soft rounded-lg px-3 py-2 text-xs text-ink-body"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button type="button" onClick={() => siirraKohta(i, -1)} title="Siirrä ylös" className="text-ink-muted hover:text-ink-strong">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" onClick={() => siirraKohta(i, 1)} title="Siirrä alas" className="text-ink-muted hover:text-ink-strong">
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLuonnos({ ...luonnos, kohdat: luonnos.kohdat.filter((_, j) => j !== i) })}
                        title="Poista kohta"
                        className="text-ink-muted hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {laji === 'play' && (
          <label className="flex items-start gap-3 mb-4 bg-sunken border border-line-soft rounded-lg p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={luonnos.halke}
              onChange={(e) => setLuonnos({ ...luonnos, halke: e.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-bold text-ink-strong">Ilmoita käyttöönotosta HÄLKE:en</span>
              <span className="block text-xs text-ink-muted">
                Käynnistetty skenaario, valitut polut ja tilanneloki näkyvät hälytyskeskuksessa.
                Poista valinta skenaarioista, joiden seurantaa HÄLKE ei tarvitse.
              </span>
            </span>
          </label>
        )}

        {laji === 'play' && (
          <p className="text-xs text-ink-muted mb-4">
            Kriittistä kohtaa ei voi ohittaa: skenaarion voi merkitä hoidetuksi vasta kun jokainen
            kriittinen kohta on kuitattu. Muut kohdat saavat jäädä — pohjassa on tarkoituksella
            kohtia jotka eivät koske jokaista tilannetta. Valinnalla skenaario haarautuu: vartija
            valitsee tilanteen mukaan polun, ja vain sen kohdat vaaditaan.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={tallenna}
            disabled={tyoskentelee}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-5 py-2.5 transition-colors"
          >
            <Check size={16} />
            Tallenna
          </button>
          <button
            type="button"
            onClick={() => { setLuonnos(null); setVirhe(null); }}
            className="inline-flex items-center gap-2 border border-line-strong hover:bg-sunken text-ink-body text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
          >
            Peruuta
          </button>
        </div>
      </div>
    );
  }

  // --- Lista ----------------------------------------------------------------------

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-ink-strong">{meta.monikko}</h3>
          <p className="text-sm text-ink-muted">{meta.selite}</p>
        </div>
        {saaMuokata && (
          <button
            type="button"
            onClick={() => setLuonnos(tyhjaLuonnos())}
            className="shrink-0 inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-lg px-4 py-2.5 transition-colors"
          >
            <Plus size={16} />
            Uusi {meta.nimi.toLowerCase()}
          </button>
        )}
      </div>

      {virhe && (
        <p className="mb-4 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
          {virhe}
        </p>
      )}

      {ilmoitus && (
        <p className="mb-4 text-sm text-ink-body bg-accent-soft border border-accent/30 rounded-lg px-4 py-3">
          {ilmoitus}
        </p>
      )}

      {/* --- Käynnissä olevat suoritukset: yksi pohjaa kohden kohteessa, yhteinen kaikille vuorossa oleville --- */}
      {meta.suoritetaan && kesken.length > 0 && (
        <div className="mb-6 space-y-4">
          {kesken.map((suoritus) => (
            <SkenaarioSuoritus
              key={suoritus.id}
              suoritus={suoritus}
              rooli="toimija"
              onMuuttui={onSuoritusMuuttui}
            />
          ))}
        </div>
      )}

      {/* --- Pohjat --- */}
      {kaytossa.length === 0 ? (
        <p className="text-sm text-ink-muted bg-sunken border border-line-soft rounded-lg p-4">
          {meta.monikko}: ei yhtään pohjaa. {saaMuokata ? 'Laadi ensimmäinen yllä olevasta painikkeesta.' : ''}
        </p>
      ) : (
        <ul className="space-y-3">
          {kaytossa.map((pohja) => {
            const auki = avattu === pohja.id;
            const kaynnissa = kesken.find((k) => k.templateId === pohja.id);
            const esikatselu = laji === 'play' ? puujarjestys(pohja.kohdat || []) : (pohja.kohdat || []);
            return (
              <li key={pohja.id} className="bg-surface border border-line rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAvattu(auki ? null : pohja.id)}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-sunken transition-colors"
                >
                  {auki ? <ChevronDown size={18} className="text-ink-muted shrink-0 mt-0.5" /> : <ChevronRight size={18} className="text-ink-muted shrink-0 mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink-strong flex flex-wrap items-center gap-2">
                      {pohja.nimi}
                      {kaynnissa && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning-soft text-warning-ink border border-warning/30">
                          käynnissä
                        </span>
                      )}
                      {laji === 'play' && pohja.halke !== false && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sunken text-ink-body border border-line">
                          <RadioTower size={10} />
                          HÄLKE
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {(pohja.kohdat || []).length} {meta.kohdanNimi.toLowerCase()}
                      {pohja.versio > 1 ? ` · versio ${pohja.versio}` : ''}
                      {pohja.kuvaus ? ` · ${pohja.kuvaus}` : ''}
                    </p>
                  </div>
                </button>

                {auki && (
                  <div className="px-4 pb-4 border-t border-line-soft">
                    <ol className="space-y-2 my-3">
                      {esikatselu.map((kohta, i) => (
                        <li
                          key={kohta.id}
                          className="flex items-start gap-3 text-sm"
                          style={{ marginLeft: syvyys(esikatselu, kohta) * 20 }}
                        >
                          {kohta.tyyppi === 'valinta'
                            ? <GitBranch size={14} className="text-accent w-5 shrink-0 mt-0.5" />
                            : <span className="text-xs font-mono text-ink-subtle w-5 shrink-0 mt-0.5">{kohta.haara ? '–' : `${esikatselu.slice(0, i + 1).filter((k) => !k.haara && k.tyyppi !== 'valinta').length}.`}</span>}
                          <div className="min-w-0">
                            {kohta.haara && (
                              <p className="text-[11px] font-bold text-accent">
                                Jos: {esikatselu.flatMap((k) => k.vaihtoehdot || []).find((v) => v.id === kohta.haara)?.teksti}
                              </p>
                            )}
                            <p className="text-ink-strong">
                              {kohta.aika && <span className="font-mono mr-2">{kohta.aika}</span>}
                              {kohta.teksti}
                              {kohta.kriittinen && (
                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-soft text-danger-ink border border-danger/30">
                                  kriittinen
                                </span>
                              )}
                            </p>
                            {kohta.tyyppi === 'valinta' && (
                              <p className="text-xs text-ink-muted mt-0.5">
                                Vaihtoehdot: {(kohta.vaihtoehdot || []).map((v) => v.teksti).join(' / ')}
                              </p>
                            )}
                            {kohta.kuvaus && <p className="text-xs text-ink-muted mt-0.5">{kohta.kuvaus}</p>}
                            {kohta.vastuu && (
                              <p className="text-xs text-ink-subtle mt-0.5 inline-flex items-center gap-1">
                                <User size={11} />{kohta.vastuu}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>

                    <div className="flex flex-wrap gap-2 items-center">
                      {meta.suoritetaan && kaynnissa && (
                        <p className="flex-1 text-sm text-ink-muted">
                          Käynnissä {kellonaika(kaynnissa.alkoi)} alkaen ({kaynnissa.tekija}). Tilanne näkyy yllä
                          kaikille kohteen vuorossa oleville.
                        </p>
                      )}
                      {meta.suoritetaan && !kaynnissa && (
                        <>
                          <input
                            type="text"
                            value={aloitusKuvaus[pohja.id] || ''}
                            onChange={(e) => setAloitusKuvaus((edellinen) => ({ ...edellinen, [pohja.id]: e.target.value }))}
                            placeholder={laji === 'play' ? 'Mistä tilanteesta on kyse?' : 'Päivän tunniste (valinnainen)'}
                            className="flex-1 min-w-[160px] bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-body"
                          />
                          <button
                            type="button"
                            onClick={() => kaynnista(pohja)}
                            disabled={tyoskentelee}
                            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2.5 transition-colors"
                          >
                            <Play size={16} />
                            {meta.aloitusNappi}
                          </button>
                        </>
                      )}
                      {saaMuokata && (
                        <>
                          <button
                            type="button"
                            onClick={() => setLuonnos(luonnosPohjasta(pohja))}
                            className="inline-flex items-center gap-1.5 border border-line-strong hover:bg-sunken text-ink-body text-sm font-medium rounded-lg px-3 py-2 transition-colors"
                          >
                            <Pencil size={14} />
                            Muokkaa
                          </button>
                          <button
                            type="button"
                            onClick={() => kutsu(() => arkistoiPohja(pohja.id)).then((t) => { if (t.ok) onPohjatMuuttui(); })}
                            disabled={tyoskentelee}
                            className="inline-flex items-center gap-1.5 text-ink-muted hover:text-danger text-sm font-medium px-2 py-2"
                          >
                            <Archive size={14} />
                            Poista käytöstä
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* --- Päättyneet suoritukset --- */}
      {meta.suoritetaan && paattyneet.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-bold text-ink-strong mb-2">Aiemmat</h4>
          <ul className="divide-y divide-line-soft border border-line-soft rounded-lg overflow-hidden">
            {paattyneet.map((s) => (
              <li key={s.id} className="px-4 py-3 bg-surface">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-ink-strong">{s.templateNimi}</span>
                  <span className="text-xs text-ink-subtle inline-flex items-center gap-1">
                    <Clock size={11} />
                    {kellonaika(s.alkoi)}–{kellonaika(s.paattyi)} · {TILA_LABEL[s.tila]}
                  </span>
                </div>
                {s.kuvaus && <p className="text-xs text-ink-muted mt-0.5">{s.kuvaus}</p>}
                {valitutPolut(s).map((p) => (
                  <p key={p.kysymys} className="text-xs text-ink-body mt-0.5">{p.kysymys} → {p.vastaus}</p>
                ))}
                {s.keskeytysSyy && <p className="text-xs text-warning-ink mt-0.5">Keskeytetty: {s.keskeytysSyy}</p>}
                {s.huomiot && <p className="text-xs text-ink-body mt-0.5">{s.huomiot}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- Arkistoidut pohjat --- */}
      {saaMuokata && arkistoidut.length > 0 && (
        <p className="text-xs text-ink-subtle mt-4">
          Käytöstä poistettuja: {arkistoidut.length}. Ne säilyvät, koska tehdyt suoritukset viittaavat
          niihin.
        </p>
      )}
    </div>
  );
};
