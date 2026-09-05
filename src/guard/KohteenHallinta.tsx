import { useState } from 'react';
import { Plus, Trash2, ClipboardList, GraduationCap, Building2, CheckSquare, ListChecks, FolderOpen, MapPin } from 'lucide-react';
import { Kentta } from './Kentta';
import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { Kartta } from '../shared/komponentit/Kartta';
import {
  VYOHYKEVARIT, VYOHYKKEEN_MIN_PISTEET, VYOHYKESAANNOT, uusiVyohykeId, type Piste,
} from '../shared/vyohykkeet';
import { luoMuunnos } from '../shared/georeferointi';
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
  // Pohjakartta kulkee kohteen kentässä eikä tiedostolistassa, joten sillä on oma
  // lähetyksensä (ks. GuardApp: lataaKartta).
  onLataaKartta: (tiedosto: File) => Promise<void>;
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
  onLataaKartta,
  saaMuokata,
}: Props) => {
  const [valilehti, setValilehti] = useState<Valilehti>('perustiedot');
  const [karttaLataa, setKarttaLataa] = useState(false);
  const [karttaVirhe, setKarttaVirhe] = useState<string | null>(null);
  const [vyohykeMuokkaus, setVyohykeMuokkaus] = useState(false);
  const [piirrettava, setPiirrettava] = useState<Piste[]>([]);
  const [uusiNimi, setUusiNimi] = useState('');
  const [uusiVari, setUusiVari] = useState(VYOHYKEVARIT[0].id);
  // Kartan kalibrointi (erä 7): kohtia kuvalla joiden oikeat koordinaatit tiedetään.
  // Ilman kalibrointia vyöhykkeiden hälytyssäännöt eivät voi laueta, koska GPS-sijainnista
  // ei voi päätellä millä vyöhykkeellä henkilö on.
  const [kalibrointiTila, setKalibrointiTila] = useState(false);
  const [kalibrointiPiste, setKalibrointiPiste] = useState<Piste | null>(null);
  const [kalibrointiLat, setKalibrointiLat] = useState('');
  const [kalibrointiLon, setKalibrointiLon] = useState('');

  const kohteenVyohykkeet = kohde.zones || [];
  const kalibrointi = kohde.mapRef || [];
  const muunnos = luoMuunnos(kalibrointi);

  const lisaaKalibrointipiste = () => {
    if (!kalibrointiPiste) return;
    const lat = Number(String(kalibrointiLat).replace(',', '.'));
    const lon = Number(String(kalibrointiLon).replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setKarttaVirhe('Tarkista koordinaatit. Esimerkki: 61.4941 ja 23.7651.');
      return;
    }
    setKarttaVirhe(null);
    onChange({ ...kohde, mapRef: [...kalibrointi, { img: kalibrointiPiste, gps: { lat, lon } }] });
    setKalibrointiPiste(null);
    setKalibrointiLat('');
    setKalibrointiLon('');
  };

  const lahetaKartta = async (tiedosto?: File) => {
    if (!tiedosto) return;
    setKarttaVirhe(null);
    setKarttaLataa(true);
    try {
      await onLataaKartta(tiedosto);
    } catch (e: any) {
      setKarttaVirhe(e?.message || 'Kartan lähetys epäonnistui.');
    } finally {
      setKarttaLataa(false);
    }
  };

  const lisaaVyohyke = () => {
    if (piirrettava.length < VYOHYKKEEN_MIN_PISTEET) return;
    const nimi = uusiNimi.trim();
    if (!nimi) {
      setKarttaVirhe('Anna vyöhykkeelle nimi.');
      return;
    }
    setKarttaVirhe(null);
    onChange({
      ...kohde,
      zones: [...kohteenVyohykkeet, { id: uusiVyohykeId(), nimi, vari: uusiVari, pisteet: piirrettava }],
    });
    setPiirrettava([]);
    setUusiNimi('');
  };
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
      <TakaisinLinkki onClick={onPeruuta}>{kohde.id ? 'Takaisin kohteeseen' : 'Takaisin kohdelistaan'}</TakaisinLinkki>
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

          {/* Hälytysnumerot (erä 7). ERI ASIA KUIN YHTEYSHENKILÖ: man-down- tai
              hätäpainikehälytyksessä soitetaan oman vartiointiliikkeen päivystäjälle, ei
              toimeksiantajalle kello kolme yöllä. Ilman numeroita hälytys jää sovelluksen
              sisälle — sitä ei arvata mistään muualta. */}
          <div className="border-t border-line-soft pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <h3 className="text-sm font-bold text-ink-strong">Hälytysnumerot</h3>
              {saaMuokata && (
                <button
                  type="button"
                  onClick={() => onChange({
                    ...kohde,
                    halytysNumerot: [...(kohde.halytysNumerot || []), { nimi: '', numero: '' }],
                  })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-line-soft hover:bg-surface-muted rounded-lg text-xs font-medium text-ink-body transition-colors"
                >
                  <Plus size={13} />
                  Lisää numero
                </button>
              )}
            </div>
            <p className="text-xs text-ink-muted mb-3">
              Näihin lähtee tekstiviesti kun hälytys eskaloituu: ajastin jää kuittaamatta,
              man-down laukeaa tai vartija painaa hätäpainiketta.
            </p>
            {(kohde.halytysNumerot || []).length === 0 ? (
              <p className="text-xs text-warning-ink bg-warning-soft border border-warning/30 rounded-lg p-2">
                Numeroita ei ole määritetty. Lauennut hälytys näkyy vain sovelluksessa eikä
                tavoita ketään puhelimitse.
              </p>
            ) : (
              <ul className="space-y-2">
                {(kohde.halytysNumerot || []).map((rivi, i) => (
                  <li key={i} className="flex flex-wrap gap-2 items-center">
                    <input
                      type="text"
                      value={rivi.nimi || ''}
                      onChange={(e) => onChange({
                        ...kohde,
                        halytysNumerot: (kohde.halytysNumerot || []).map((r, j) => (
                          j === i ? { ...r, nimi: e.target.value } : r
                        )),
                      })}
                      disabled={!saaMuokata}
                      placeholder="Kenen numero (esim. Päivystäjä)"
                      className="flex-1 min-w-[150px] rounded-lg border border-line-soft p-2 text-sm"
                    />
                    <input
                      type="tel"
                      value={rivi.numero || ''}
                      onChange={(e) => onChange({
                        ...kohde,
                        halytysNumerot: (kohde.halytysNumerot || []).map((r, j) => (
                          j === i ? { ...r, numero: e.target.value } : r
                        )),
                      })}
                      disabled={!saaMuokata}
                      placeholder="+358 40 123 4567"
                      className="flex-1 min-w-[150px] rounded-lg border border-line-soft p-2 text-sm"
                    />
                    {saaMuokata && (
                      <button
                        type="button"
                        onClick={() => onChange({
                          ...kohde,
                          halytysNumerot: (kohde.halytysNumerot || []).filter((_, j) => j !== i),
                        })}
                        title="Poista numero"
                        className="p-2 text-ink-muted hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pohjakartta ja vyöhykkeet. Sama malli kuin tapahtumapuolella: kartta on
              kohteen kenttä, ja vyöhykkeet piirretään sen päälle osuuskoordinaatteina. */}
          <div className="border-t border-line-soft pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-bold text-ink-strong">Pohjakartta ja vyöhykkeet</h3>
              {saaMuokata && (
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-surface border border-line-soft hover:bg-surface-muted rounded-lg text-xs font-medium text-ink-body transition-colors">
                  <MapPin size={14} className="text-accent" />
                  {karttaLataa ? 'Lähetetään…' : kohde.mapUploadId ? 'Vaihda kartta' : 'Lataa kartta'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => lahetaKartta(e.target.files?.[0])}
                  />
                </label>
              )}
            </div>

            {karttaVirhe && <p className="text-xs text-danger mb-2">{karttaVirhe}</p>}

            <Kartta
              karttaId={kohde.mapUploadId}
              vyohykkeet={kohteenVyohykkeet}
              piirrettava={
                vyohykeMuokkaus ? piirrettava
                  : kalibrointiTila
                    ? [...kalibrointi.map((k) => k.img), ...(kalibrointiPiste ? [kalibrointiPiste] : [])]
                    : undefined
              }
              onKarttaKlikkaus={
                vyohykeMuokkaus ? (p) => setPiirrettava((edellinen) => [...edellinen, p])
                  : kalibrointiTila ? (p) => setKalibrointiPiste(p)
                    : undefined
              }
              tyhjaTeksti={
                saaMuokata
                  ? 'Pohjakarttaa ei ole ladattu. Lataa kohteen pohjapiirros, niin voit piirtää siihen vyöhykkeet.'
                  : 'Pohjakarttaa ei ole ladattu.'
              }
            />

            {kohde.mapUploadId && saaMuokata && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => { setVyohykeMuokkaus((o) => !o); setPiirrettava([]); setKalibrointiTila(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    vyohykeMuokkaus ? 'bg-ink-strong text-surface' : 'bg-surface border border-line-soft text-ink-body hover:bg-surface-muted'
                  }`}
                >
                  {vyohykeMuokkaus ? 'Lopeta muokkaus' : 'Piirrä vyöhykkeitä'}
                </button>
                {/* Kalibrointi on vyöhykkeiden vieressä, koska se on niiden ehto: ilman
                    sitä vyöhyke on vain kuva eikä siihen voi sitoa hälytystä. */}
                <button
                  type="button"
                  onClick={() => { setKalibrointiTila((o) => !o); setKalibrointiPiste(null); setVyohykeMuokkaus(false); }}
                  className={`ml-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    kalibrointiTila ? 'bg-ink-strong text-surface' : 'bg-surface border border-line-soft text-ink-body hover:bg-surface-muted'
                  }`}
                >
                  {kalibrointiTila ? 'Lopeta kalibrointi' : 'Kalibroi kartta'}
                  {kalibrointi.length > 0 && !kalibrointiTila && (
                    <span className="ml-1.5 font-normal text-ink-muted">
                      ({kalibrointi.length}{muunnos ? '' : ' — ei riitä'})
                    </span>
                  )}
                </button>

                {kalibrointiTila && (
                  <div className="mt-3 bg-sunken border border-line-soft rounded-xl p-4 space-y-3">
                    <p className="text-xs text-ink-muted">
                      Napsauta kartalta kohta jonka koordinaatit tiedät (esim. portti tai rakennuksen
                      kulma) ja kirjoita sen leveys- ja pituusaste. Vähintään kaksi pistettä, kolme on
                      tarkempi. Ilman kalibrointia vyöhykkeiden hälytyssäännöt eivät voi laueta.
                    </p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-ink-muted">
                        {kalibrointiPiste ? 'Kohta valittu.' : 'Napsauta karttaa.'}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={kalibrointiLat}
                        onChange={(e) => setKalibrointiLat(e.target.value)}
                        placeholder="Leveysaste, esim. 61.4941"
                        className="flex-1 min-w-[140px] rounded-lg border border-line-soft p-2 text-sm"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={kalibrointiLon}
                        onChange={(e) => setKalibrointiLon(e.target.value)}
                        placeholder="Pituusaste, esim. 23.7651"
                        className="flex-1 min-w-[140px] rounded-lg border border-line-soft p-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={lisaaKalibrointipiste}
                        disabled={!kalibrointiPiste}
                        className="px-3 py-2 bg-accent text-surface disabled:bg-line-soft disabled:text-ink-muted text-xs font-bold rounded-lg"
                      >
                        Lisää piste
                      </button>
                    </div>
                    {kalibrointi.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                        {kalibrointi.map((k, i) => (
                          <span key={i} className="px-2 py-1 rounded-lg border border-line-soft bg-surface">
                            {k.gps.lat.toFixed(5)}, {k.gps.lon.toFixed(5)}
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => onChange({ ...kohde, mapRef: [] })}
                          className="text-danger hover:underline"
                        >
                          Tyhjennä
                        </button>
                      </div>
                    )}
                    {kalibrointi.length >= 2 && !muunnos && (
                      <p className="text-xs text-danger-ink bg-danger-soft border border-danger/30 rounded-lg p-2">
                        Pisteet eivät kelpaa muunnokseen: ne ovat samalla suoralla tai liian lähellä
                        toisiaan. Tyhjennä ja ota pisteet kauempaa toisistaan.
                      </p>
                    )}
                  </div>
                )}

                {vyohykeMuokkaus && (
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-ink-muted">
                      Napsauta karttaa kulmiin (vähintään {VYOHYKKEEN_MIN_PISTEET}). Napsautettu: {piirrettava.length}.
                    </span>
                    <input
                      type="text"
                      value={uusiNimi}
                      onChange={(e) => setUusiNimi(e.target.value)}
                      placeholder="Esim. Piha tai Kerros 2"
                      className="flex-1 min-w-[160px] rounded-lg border border-line-soft p-2 text-sm"
                    />
                    <select
                      value={uusiVari}
                      onChange={(e) => setUusiVari(e.target.value)}
                      aria-label="Vyöhykkeen väri"
                      className="rounded-lg border border-line-soft p-2 text-sm"
                    >
                      {VYOHYKEVARIT.map((v) => <option key={v.id} value={v.id}>{v.nimi}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={lisaaVyohyke}
                      disabled={piirrettava.length < VYOHYKKEEN_MIN_PISTEET}
                      className="px-3 py-2 bg-accent text-surface disabled:bg-line-soft disabled:text-ink-muted text-xs font-bold rounded-lg"
                    >
                      Tallenna vyöhyke
                    </button>
                    <button
                      type="button"
                      onClick={() => setPiirrettava((edellinen) => edellinen.slice(0, -1))}
                      disabled={piirrettava.length === 0}
                      className="px-3 py-2 bg-surface border border-line-soft text-ink-body disabled:text-ink-muted text-xs font-medium rounded-lg"
                    >
                      Kumoa piste
                    </button>
                  </div>
                )}
              </div>
            )}

            {kohteenVyohykkeet.length > 0 && (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {kohteenVyohykkeet.map((v) => (
                    <span key={v.id} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-line-soft bg-surface text-xs font-medium text-ink-body">
                      {v.nimi}
                      {/* Hälytyssääntö vyöhykkeen vieressä: sääntö on merkityksetön ilman
                          sitä aluetta jolle se on piirretty, ja tässä näkee kerralla
                          mitkä alueet hälyttävät. */}
                      {saaMuokata ? (
                        <select
                          value={v.halytys || 'ei'}
                          onChange={(e) => onChange({
                            ...kohde,
                            zones: kohteenVyohykkeet.map((z) => (
                              z.id === v.id ? { ...z, halytys: e.target.value as typeof z.halytys } : z
                            )),
                          })}
                          aria-label={`Vyöhykkeen ${v.nimi} hälytyssääntö`}
                          title={VYOHYKESAANNOT.find((s) => s.id === (v.halytys || 'ei'))?.selite}
                          className="text-[11px] rounded border border-line-soft bg-surface text-ink-muted py-0.5 pl-1 pr-4"
                        >
                          {VYOHYKESAANNOT.map((s) => <option key={s.id} value={s.id}>{s.nimi}</option>)}
                        </select>
                      ) : v.halytys && v.halytys !== 'ei' ? (
                        <span className="text-[11px] text-ink-muted font-normal">
                          {v.halytys === 'saapuminen' ? 'hälyttää saapumisesta' : 'hälyttää poistumisesta'}
                        </span>
                      ) : null}
                      {saaMuokata && (
                        <button
                          type="button"
                          onClick={() => onChange({ ...kohde, zones: kohteenVyohykkeet.filter((z) => z.id !== v.id) })}
                          title={`Poista vyöhyke ${v.nimi}`}
                          className="text-ink-muted hover:text-danger"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {kohteenVyohykkeet.some((v) => v.halytys && v.halytys !== 'ei') && !muunnos && (
                  <p className="text-xs text-warning-ink bg-warning-soft border border-warning/30 rounded-lg p-2 mt-2">
                    Vyöhykehälytykset on määritetty, mutta karttaa ei ole kalibroitu. Ilman
                    kalibrointia GPS-sijainnista ei voi päätellä millä vyöhykkeellä henkilö on,
                    eikä sääntö voi laueta.
                  </p>
                )}
              </>
            )}

            <p className="text-xs text-ink-muted mt-2">
              Kartta ja vyöhykkeet tallentuvat vasta kun tallennat kohteen.
            </p>
          </div>
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
