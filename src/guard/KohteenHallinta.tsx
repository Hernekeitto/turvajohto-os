import { useState } from 'react';
import { Plus, Trash2, ClipboardList, GraduationCap, Building2, CheckSquare, ListChecks, FolderOpen } from 'lucide-react';
import { Kentta } from './Kentta';
import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { paikallinenPaiva } from '../shared/ajat';
import { muotoileTunniste } from '../shared/tunnisteet';
import { KohteenTiedostot } from './KohteenTiedostot';
import { uusiId, type Kohde, type KohteenTiedosto, type Perehdytys, type Tehtava } from './tyypit';

// Kohteen hallinta: perustiedot, perehdytykset ja työvuoron tehtävät omilla välilehdillään.
// Kaikki kolme ovat kohteen omia kenttiä, joten ne tallennetaan yhtenä kokonaisuutena —
// käyttäjän kannalta "tallenna kohde" tallentaa sen mitä hän on juuri muokannut.

type Valilehti = 'perustiedot' | 'tiedostot' | 'perehdytys' | 'tehtavat';

const VALILEHDET: { id: Valilehti; label: string; Ikoni: typeof Building2 }[] = [
  { id: 'perustiedot', label: 'Perustiedot', Ikoni: Building2 },
  { id: 'tiedostot', label: 'Tiedostot', Ikoni: FolderOpen },
  { id: 'perehdytys', label: 'Perehdytykset', Ikoni: GraduationCap },
  { id: 'tehtavat', label: 'Työvuoron tehtävät', Ikoni: ClipboardList },
];

type Props = {
  kohde: Kohde;
  onChange: (kohde: Kohde) => void;
  onTallenna: () => void;
  onPeruuta: () => void;
  tallentaa: boolean;
  // Työntekijäpankki jos käyttäjällä on siihen lukuoikeus. Tyhjä lista tarkoittaa joko
  // tyhjää rekisteriä tai puuttuvaa oikeutta — kummassakin tapauksessa perehdytettävän
  // nimi kirjoitetaan käsin, eikä käyttäjälle valehdella että rekisteri olisi tyhjä.
  tyontekijat: { id?: string; name?: string; displayId?: number | null }[];
  // Tiedostot ovat omassa kokoelmassaan (guardFiles) ja tallentuvat heti, joten ne
  // kulkevat omien käsittelijöidensä kautta eivätkä kohteen onChange-ketjussa.
  tiedostot: KohteenTiedosto[];
  onLisaaTiedosto: (tiedosto: File) => Promise<void>;
  onPoistaTiedosto: (id: string) => Promise<void>;
  saaMuokata: boolean;
};

export const KohteenHallinta = ({
  kohde,
  onChange,
  onTallenna,
  onPeruuta,
  tallentaa,
  tyontekijat,
  tiedostot,
  onLisaaTiedosto,
  onPoistaTiedosto,
  saaMuokata,
}: Props) => {
  const [valilehti, setValilehti] = useState<Valilehti>('perustiedot');
  const [uusiPerehdytys, setUusiPerehdytys] = useState({ nimi: '', employeeId: '', pvm: paikallinenPaiva(), perehdyttaja: '' });
  const [muokattavaTehtava, setMuokattavaTehtava] = useState<Tehtava | null>(null);

  const perehdytykset = kohde.perehdytykset || [];
  const tehtavat = kohde.tehtavat || [];

  const lisaaPerehdytys = () => {
    // Valittu työntekijä voittaa käsin kirjoitetun nimen: valinta on täsmällisempi ja tuo
    // mukanaan tunnistenumeron, jolla henkilö yksilöidään myös nimikaimojen kesken.
    const valittu = tyontekijat.find((t) => t.id === uusiPerehdytys.employeeId);
    const nimi = (valittu?.name || uusiPerehdytys.nimi).trim();
    if (!nimi) return;
    const merkinta: Perehdytys = {
      id: uusiId(),
      nimi,
      employeeId: valittu?.id,
      displayId: valittu?.displayId ?? null,
      pvm: uusiPerehdytys.pvm || paikallinenPaiva(),
      perehdyttaja: uusiPerehdytys.perehdyttaja.trim() || undefined,
    };
    onChange({ ...kohde, perehdytykset: [...perehdytykset, merkinta] });
    setUusiPerehdytys({ nimi: '', employeeId: '', pvm: paikallinenPaiva(), perehdyttaja: '' });
  };

  const poistaPerehdytys = (id: string) => {
    onChange({ ...kohde, perehdytykset: perehdytykset.filter((p) => p.id !== id) });
  };

  const tallennaTehtava = () => {
    if (!muokattavaTehtava) return;
    const nimi = muokattavaTehtava.nimi.trim();
    if (!nimi) return;
    const puhdas: Tehtava = {
      ...muokattavaTehtava,
      nimi,
      // Tyhjät rivit siivotaan pois: tarkistuslistalla tyhjä kohta olisi kuitattava rivi
      // jolla ei ole sisältöä.
      kohdat: muokattavaTehtava.tyyppi === 'lista'
        ? muokattavaTehtava.kohdat.map((k) => k.trim()).filter(Boolean)
        : [],
    };
    const uudet = tehtavat.some((t) => t.id === puhdas.id)
      ? tehtavat.map((t) => (t.id === puhdas.id ? puhdas : t))
      : [...tehtavat, puhdas];
    onChange({ ...kohde, tehtavat: uudet });
    setMuokattavaTehtava(null);
  };

  return (
    <div className="bg-surface rounded-xl shadow-sm border border-line-soft p-6 md:p-8 max-w-3xl">
      <TakaisinLinkki onClick={onPeruuta}>Takaisin kohdelistaan</TakaisinLinkki>
      <h2 className="text-xl font-bold text-ink-strong mb-1">
        {kohde.id ? kohde.name || 'Kohde' : 'Uusi kohde'}
      </h2>
      <p className="text-sm text-ink-muted mb-6">
        Kohteen perustiedot, sille perehdytetyt henkilöt ja työvuoron tehtävät.
      </p>

      <div className="flex gap-1 border-b border-line mb-6 -mx-1 overflow-x-auto">
        {VALILEHDET.map(({ id, label, Ikoni }) => (
          <button
            key={id}
            type="button"
            onClick={() => setValilehti(id)}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              valilehti === id
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink-body'
            }`}
          >
            <Ikoni size={16} />
            {label}
            {id === 'tiedostot' && tiedostot.length > 0 && (
              <span className="text-xs text-ink-subtle">({tiedostot.length})</span>
            )}
            {id === 'perehdytys' && perehdytykset.length > 0 && (
              <span className="text-xs text-ink-subtle">({perehdytykset.length})</span>
            )}
            {id === 'tehtavat' && tehtavat.length > 0 && (
              <span className="text-xs text-ink-subtle">({tehtavat.length})</span>
            )}
          </button>
        ))}
      </div>

      {valilehti === 'perustiedot' && (
        <div className="space-y-4">
          <Kentta
            label="Kohteen nimi"
            arvo={kohde.name}
            onChange={(v) => onChange({ ...kohde, name: v })}
            placeholder="esim. Kauppakeskus Alfa"
          />
          <Kentta
            label="Osoite"
            arvo={kohde.address || ''}
            onChange={(v) => onChange({ ...kohde, address: v })}
            placeholder="Katuosoite, postinumero ja kaupunki"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Kentta
              label="Yhteyshenkilö"
              arvo={kohde.contactName || ''}
              onChange={(v) => onChange({ ...kohde, contactName: v })}
            />
            <Kentta
              label="Puhelin"
              arvo={kohde.contactPhone || ''}
              onChange={(v) => onChange({ ...kohde, contactPhone: v })}
              tyyppi="tel"
            />
          </div>
          <Kentta
            label="Ohjeet vartijalle"
            arvo={kohde.notes || ''}
            onChange={(v) => onChange({ ...kohde, notes: v })}
            placeholder="Kulkuohjeet, hälytysjärjestelmä, erityishuomiot"
            monirivinen
          />
        </div>
      )}

      {valilehti === 'tiedostot' && (
        <KohteenTiedostot
          tiedostot={tiedostot}
          saaMuokata={saaMuokata}
          onLisaa={onLisaaTiedosto}
          onPoista={onPoistaTiedosto}
          kohdeTallennettu={!!kohde.id}
        />
      )}

      {valilehti === 'perehdytys' && (
        <div>
          <p className="text-sm text-ink-muted mb-4">
            Henkilöt jotka on perehdytetty tähän kohteeseen. Merkintä säilyy vaikka henkilö
            poistettaisiin työntekijäpankista myöhemmin.
          </p>

          {perehdytykset.length > 0 && (
            <div className="border border-line rounded-lg divide-y divide-line-soft mb-6">
              {perehdytykset.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {p.nimi}
                      {p.displayId ? (
                        <span className="text-ink-subtle font-normal"> {muotoileTunniste(p.displayId)}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Perehdytetty {p.pvm}
                      {p.perehdyttaja ? ` · perehdyttäjä ${p.perehdyttaja}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => poistaPerehdytys(p.id)}
                    className="shrink-0 text-ink-subtle hover:text-danger transition-colors"
                    title="Poista merkintä"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="bg-sunken border border-line rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-ink-body">Lisää perehdytys</p>
            {tyontekijat.length > 0 ? (
              <label className="block">
                <span className="block text-sm font-medium text-ink-body mb-1">Työntekijä</span>
                <select
                  value={uusiPerehdytys.employeeId}
                  onChange={(e) => setUusiPerehdytys({ ...uusiPerehdytys, employeeId: e.target.value })}
                  className="w-full rounded-lg border border-line-strong p-2.5 text-sm bg-surface outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">Valitse työntekijäpankista…</option>
                  {tyontekijat.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.displayId ? muotoileTunniste(t.displayId) : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <Kentta
                label="Nimi"
                arvo={uusiPerehdytys.nimi}
                onChange={(v) => setUusiPerehdytys({ ...uusiPerehdytys, nimi: v })}
                placeholder="Sukunimi Etunimi"
                vinkki="Työntekijäpankki ei ole käytettävissä — kirjoita nimi käsin."
              />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Kentta
                label="Perehdytyspäivä"
                arvo={uusiPerehdytys.pvm}
                onChange={(v) => setUusiPerehdytys({ ...uusiPerehdytys, pvm: v })}
                tyyppi="date"
              />
              <Kentta
                label="Perehdyttäjä"
                arvo={uusiPerehdytys.perehdyttaja}
                onChange={(v) => setUusiPerehdytys({ ...uusiPerehdytys, perehdyttaja: v })}
              />
            </div>
            <button
              type="button"
              onClick={lisaaPerehdytys}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              <Plus size={16} />
              Lisää listalle
            </button>
          </div>
        </div>
      )}

      {valilehti === 'tehtavat' && (
        <div>
          <p className="text-sm text-ink-muted mb-4">
            Tehtävät jotka vartija kuittaa työvuorossaan. Tehtävä voi olla yksi kysymys
            (suoritettu kyllä/ei) tai tarkistuslista, jossa jokainen kohta kuitataan
            erikseen — esimerkiksi sulkukierros.
          </p>

          {tehtavat.length > 0 && (
            <div className="border border-line rounded-lg divide-y divide-line-soft mb-6">
              {tehtavat.map((t) => (
                <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                  {t.tyyppi === 'lista' ? (
                    <ListChecks size={16} className="text-accent shrink-0 mt-0.5" />
                  ) : (
                    <CheckSquare size={16} className="text-accent shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{t.nimi}</p>
                    <p className="text-xs text-ink-muted">
                      {t.tyyppi === 'lista' ? `Tarkistuslista · ${t.kohdat.length} kohtaa` : 'Kuittaus (kyllä/ei)'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMuokattavaTehtava({ ...t, kohdat: [...t.kohdat] })}
                    className="shrink-0 text-xs font-medium text-ink-body hover:text-accent transition-colors"
                  >
                    Muokkaa
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...kohde, tehtavat: tehtavat.filter((x) => x.id !== t.id) })}
                    className="shrink-0 text-ink-subtle hover:text-danger transition-colors"
                    title="Poista tehtävä"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {muokattavaTehtava ? (
            <div className="bg-sunken border border-line rounded-lg p-4 space-y-3">
              <Kentta
                label="Tehtävän nimi"
                arvo={muokattavaTehtava.nimi}
                onChange={(v) => setMuokattavaTehtava({ ...muokattavaTehtava, nimi: v })}
                placeholder="esim. Sulkukierros"
              />
              <Kentta
                label="Ohje (valinnainen)"
                arvo={muokattavaTehtava.kuvaus || ''}
                onChange={(v) => setMuokattavaTehtava({ ...muokattavaTehtava, kuvaus: v })}
                placeholder="Mitä vartijan on tarkistettava"
                monirivinen
              />
              <div>
                <span className="block text-sm font-medium text-ink-body mb-2">Tehtävän muoto</span>
                <div className="flex flex-wrap gap-2">
                  {([
                    { id: 'kuittaus', label: 'Yksi kuittaus (kyllä/ei)' },
                    { id: 'lista', label: 'Tarkistuslista' },
                  ] as const).map((v) => (
                    <label
                      key={v.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                        muokattavaTehtava.tyyppi === v.id
                          ? 'bg-accent-soft border-accent text-accent-ink'
                          : 'bg-surface border-line text-ink-body hover:bg-sunken'
                      }`}
                    >
                      <input
                        type="radio"
                        name="tehtavatyyppi"
                        checked={muokattavaTehtava.tyyppi === v.id}
                        onChange={() => setMuokattavaTehtava({ ...muokattavaTehtava, tyyppi: v.id })}
                        className="w-4 h-4 text-accent border-line-strong focus:ring-accent"
                      />
                      {v.label}
                    </label>
                  ))}
                </div>
              </div>

              {muokattavaTehtava.tyyppi === 'lista' && (
                <div>
                  <span className="block text-sm font-medium text-ink-body mb-2">
                    Tarkistettavat kohdat
                  </span>
                  <div className="space-y-2">
                    {muokattavaTehtava.kohdat.map((kohta, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          value={kohta}
                          onChange={(e) => {
                            const kohdat = [...muokattavaTehtava.kohdat];
                            kohdat[i] = e.target.value;
                            setMuokattavaTehtava({ ...muokattavaTehtava, kohdat });
                          }}
                          placeholder={`Kohta ${i + 1} — esim. Varastotila C3 lukittu`}
                          className="flex-1 rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
                        />
                        <button
                          type="button"
                          onClick={() => setMuokattavaTehtava({
                            ...muokattavaTehtava,
                            kohdat: muokattavaTehtava.kohdat.filter((_, j) => j !== i),
                          })}
                          className="shrink-0 px-2 text-ink-subtle hover:text-danger transition-colors"
                          title="Poista kohta"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMuokattavaTehtava({
                      ...muokattavaTehtava,
                      kohdat: [...muokattavaTehtava.kohdat, ''],
                    })}
                    className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover mt-3 transition-colors"
                  >
                    <Plus size={16} />
                    Lisää kohta
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMuokattavaTehtava(null)}
                  className="px-4 py-2 text-sm font-medium text-ink-body bg-surface border border-line hover:bg-sunken rounded-lg transition-colors"
                >
                  Peruuta
                </button>
                <button
                  type="button"
                  onClick={tallennaTehtava}
                  className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
                >
                  Valmis
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMuokattavaTehtava({ id: uusiId(), nimi: '', tyyppi: 'kuittaus', kohdat: [] })}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              <Plus size={16} />
              Uusi tehtävä
            </button>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-line-soft">
        <button
          type="button"
          onClick={onPeruuta}
          className="px-5 py-2.5 text-sm font-medium text-ink-body bg-sunken hover:bg-line rounded-lg transition-colors"
        >
          Peruuta
        </button>
        <button
          type="button"
          disabled={tallentaa}
          onClick={onTallenna}
          className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-60"
        >
          {tallentaa ? 'Tallennetaan…' : 'Tallenna kohde'}
        </button>
      </div>
    </div>
  );
};
