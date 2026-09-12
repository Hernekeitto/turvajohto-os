import { useEffect, useState } from 'react';
import { Plus, Trash2, ClipboardList, GraduationCap, Building2, CheckSquare, ListChecks, FolderOpen, MapPin, CalendarClock, AlertTriangle, Route } from 'lucide-react';
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
import { haePerehdytettavat, type Perehdytettava } from './vuorot';
import { uusiId, type Kierrospohja, type Kohde, type KohteenTiedosto, type Perehdytys, type Tehtava, type Vuorotyyppi } from './tyypit';

// Kohteen hallinta: perustiedot, perehdytykset, vuorot ja työvuoron tehtävät omilla
// välilehdillään. Kaikki ovat kohteen omia kenttiä, joten ne tallennetaan yhtenä
// kokonaisuutena — käyttäjän kannalta "tallenna kohde" tallentaa sen mitä hän on juuri
// muokannut.
//
// --- Vuorot ja perehdytys kuuluvat yhteen (erä 16) --------------------------------
//
// Perehdytys ei ole enää pelkkä dokumentti vaan pääsy: se ratkaisee mihin vuoroihin
// vartija voi kirjautua. Siksi perehdytysmerkintään valitaan KÄYTTÄJÄTUNNUS eikä
// pelkkää nimeä, ja siihen rastitaan ne vuorot joihin perehdytys pätee.
//
// Kytkemätön merkintä (ei tunnusta) näytetään erikseen merkittynä. Se on yhä pätevä
// dokumentti siitä että perehdytys on pidetty, mutta se ei avaa mitään — ja jos sitä ei
// sanota, se näyttää täsmälleen samalta kuin toimiva.

type Valilehti = 'perustiedot' | 'tiedostot' | 'perehdytys' | 'vuorot' | 'tehtavat';

const VALILEHDET: { id: Valilehti; label: string; Ikoni: typeof Building2 }[] = [
  { id: 'perustiedot', label: 'Perustiedot', Ikoni: Building2 },
  { id: 'tiedostot', label: 'Tiedostot', Ikoni: FolderOpen },
  { id: 'vuorot', label: 'Vuorot', Ikoni: CalendarClock },
  { id: 'perehdytys', label: 'Perehdytykset', Ikoni: GraduationCap },
  { id: 'tehtavat', label: 'Työvuoron tehtävät', Ikoni: ClipboardList },
];

// Tyhjä vuorotyyppi. Kellonajat ovat tyhjiä eivätkä oletuksellisia: arvattu 07–15
// näyttäisi määritellyltä ja alkaisi rajoittaa kirjautumista ilman että kukaan on
// päättänyt niin.
// Lukumäärä oikein taivutettuna: yksi on nominatiivi, kaikki muut partitiivi.
// "1 tehtävää" on virhe joka näkyy juuri silloin kun vuorossa on tasan yksi tehtävä —
// eli useammin kuin harvoin.
const lkm = (maara: number, yksikko: string, monikko: string) =>
  `${maara} ${maara === 1 ? yksikko : monikko}`;

const tyhjaVuoro = (): Vuorotyyppi => ({
  id: uusiId(), nimi: '', alkaa: '', paattyy: '', tehtavaIdt: [], pohjaIdt: [],
});

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
  // Kohteen kierrospohjat. Vuorotyyppi viittaa niihin id:llä, joten lista tarvitaan
  // valintaa varten — vuoro ilman kierroksiaan olisi puolikas vuoro.
  pohjat: Kierrospohja[];
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
  pohjat,
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
  const [uusiPerehdytys, setUusiPerehdytys] = useState({
    nimi: '', employeeId: '', username: '', pvm: paikallinenPaiva(), perehdyttaja: '',
    vuorotyyppiIdt: [] as string[],
  });
  const [muokattavaTehtava, setMuokattavaTehtava] = useState<Tehtava | null>(null);
  const [muokattavaVuoro, setMuokattavaVuoro] = useState<Vuorotyyppi | null>(null);
  // Ketkä voidaan perehdyttää. Haetaan kapealta reitiltä eikä /api/users:ista, joka on
  // pääkäyttäjän takana — kohteita voi hallita ilman pääkäyttäjyyttä.
  const [perehdytettavat, setPerehdytettavat] = useState<Perehdytettava[]>([]);

  const perehdytykset = kohde.perehdytykset || [];
  const tehtavat = kohde.tehtavat || [];
  const vuorotyypit = kohde.vuorotyypit || [];

  useEffect(() => {
    let voimassa = true;
    if (!kohde.id) { setPerehdytettavat([]); return undefined; }
    haePerehdytettavat(kohde.id)
      .then((lista) => { if (voimassa) setPerehdytettavat(lista); })
      .catch(() => { if (voimassa) setPerehdytettavat([]); });
    return () => { voimassa = false; };
  }, [kohde.id]);

  const lisaaPerehdytys = () => {
    // Tunnus voittaa työntekijävalinnan ja työntekijä käsin kirjoitetun nimen. Järjestys
    // on tarkoituksellinen: tunnus on ainoa näistä joka myöntää pääsyn, joten sen on
    // ratkaistava myös se mikä nimi merkintään jää.
    const kayttaja = perehdytettavat.find((k) => k.username === uusiPerehdytys.username);
    const valittu = tyontekijat.find((t) => t.id === uusiPerehdytys.employeeId);
    const nimi = (kayttaja?.nimi || valittu?.name || uusiPerehdytys.nimi).trim();
    if (!nimi) return;
    const merkinta: Perehdytys = {
      id: uusiId(),
      nimi,
      username: kayttaja?.username,
      employeeId: valittu?.id,
      displayId: kayttaja?.displayId ?? valittu?.displayId ?? null,
      pvm: uusiPerehdytys.pvm || paikallinenPaiva(),
      perehdyttaja: uusiPerehdytys.perehdyttaja.trim() || undefined,
      // Vain olemassa olevat vuorot: poistettu vuoro jättäisi listalle id:n joka ei
      // vastaa mitään, ja se näyttäisi perehdytykseltä johonkin.
      vuorotyyppiIdt: uusiPerehdytys.vuorotyyppiIdt.filter((id) => vuorotyypit.some((v) => v.id === id)),
    };
    onChange({ ...kohde, perehdytykset: [...perehdytykset, merkinta] });
    setUusiPerehdytys({
      nimi: '', employeeId: '', username: '', pvm: paikallinenPaiva(), perehdyttaja: '',
      vuorotyyppiIdt: [],
    });
  };

  const tallennaVuoro = () => {
    if (!muokattavaVuoro) return;
    const nimi = muokattavaVuoro.nimi.trim();
    if (!nimi) return;
    const puhdas: Vuorotyyppi = {
      ...muokattavaVuoro,
      nimi,
      // Tyhjä kellonaika tallennetaan puuttuvana eikä tyhjänä merkkijonona: palvelin
      // tulkitsee puuttuvan ajan "ei rajoitetta", ja tyhjä merkkijono on sama asia jonka
      // pitää näyttää samalta myös levyllä.
      alkaa: muokattavaVuoro.alkaa?.trim() || undefined,
      paattyy: muokattavaVuoro.paattyy?.trim() || undefined,
      kuvaus: muokattavaVuoro.kuvaus?.trim() || undefined,
    };
    const uudet = vuorotyypit.some((v) => v.id === puhdas.id)
      ? vuorotyypit.map((v) => (v.id === puhdas.id ? puhdas : v))
      : [...vuorotyypit, puhdas];
    onChange({ ...kohde, vuorotyypit: uudet });
    setMuokattavaVuoro(null);
  };

  // Vuoron poisto siivoaa viittaukset perehdytyksistä. Ilman tätä perehdytys jäisi
  // osoittamaan olemattomaan vuoroon, eikä kukaan huomaisi ennen kuin joku ihmettelee
  // miksei pääse kirjautumaan.
  const poistaVuoro = (id: string) => {
    onChange({
      ...kohde,
      vuorotyypit: vuorotyypit.filter((v) => v.id !== id),
      perehdytykset: perehdytykset.map((pe) => ({
        ...pe,
        vuorotyyppiIdt: (pe.vuorotyyppiIdt || []).filter((x) => x !== id),
      })),
    });
  };

  const vaihdaVuoroValinta = (idt: string[], id: string) =>
    (idt.includes(id) ? idt.filter((x) => x !== id) : [...idt, id]);

  const vaihdaPerehdytyksenVuoro = (perehdytysId: string, vuoroId: string) => {
    onChange({
      ...kohde,
      perehdytykset: perehdytykset.map((pe) => (pe.id === perehdytysId
        ? { ...pe, vuorotyyppiIdt: vaihdaVuoroValinta(pe.vuorotyyppiIdt || [], vuoroId) }
        : pe)),
    });
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
      // Tyhjä aika tallennetaan puuttuvana eikä tyhjänä merkkijonona: koostelaskenta
      // tulkitsee puuttuvan "ei aikaa määritelty", ja tyhjän merkkijonon on näytettävä
      // samalta myös levyllä.
      suoritusaika: muokattavaTehtava.suoritusaika?.trim() || undefined,
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
        Kohteen perustiedot, vuorot, niihin perehdytetyt henkilöt ja työvuoron tehtävät.
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
            {id === 'vuorot' && vuorotyypit.length > 0 && (
              <span className="text-xs text-ink-subtle">({vuorotyypit.length})</span>
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

          {/* Man-down-valvonta (erä 12).

              TÄMÄ ON TYÖNANTAJAN ASETUS eikä vartijan valinta, ja se on koko syy sille
              että se on täällä. 12.9.2026 asti se asui selaimen localStoragessa:
              vartija saattoi kytkeä valvonnan pois kenenkään näkemättä, raja oli
              laitekohtainen, eikä natiivisovellus päässyt siihen käsiksi lainkaan.

              Vartija näkee asetuksen mutta ei muuta sitä. */}
          <div className="border-t border-line-soft pt-4">
            <h3 className="text-sm font-bold text-ink-strong mb-2">Man-down-valvonta</h3>
            <p className="text-xs text-ink-muted mb-3">
              Laite kysyy vartijalta "oletko kunnossa" jos se havaitsee iskun tai pitkän
              liikkumattomuuden. Vastaamatta jäänyt kysely tekee hälytyksen. Asetus koskee
              kaikkia tämän kohteen vuoroja, ja vartija näkee sen mutta ei voi kytkeä sitä
              pois.
            </p>

            <label className="flex items-center gap-2 text-sm text-ink-body mb-3">
              <input
                type="checkbox"
                checked={kohde.mandown?.paalla === true}
                onChange={(e) => onChange({
                  ...kohde,
                  mandown: {
                    paalla: e.target.checked,
                    liikkumatonMin: kohde.mandown?.liikkumatonMin || 5,
                  },
                })}
                disabled={!saaMuokata}
                className="rounded border-line-soft"
              />
              Man-down-valvonta käytössä
            </label>

            {kohde.mandown?.paalla === true && (
              <label className="flex flex-wrap items-center gap-2 text-sm text-ink-body">
                Hälytä jos laite ei ole liikkunut
                <select
                  value={kohde.mandown?.liikkumatonMin || 5}
                  onChange={(e) => onChange({
                    ...kohde,
                    mandown: { paalla: true, liikkumatonMin: Number(e.target.value) },
                  })}
                  disabled={!saaMuokata}
                  className="rounded-lg border border-line-soft p-2 text-sm"
                >
                  {/* Alaraja 5 min: lyhyempi hälyttäisi lomakkeen täyttämisestä puhelin
                      pöydällä. Yläraja 60 min: pidempi ei enää valvo mitään. Samat rajat
                      palvelimella (server/halytys.js), joka ei luota tähän valikkoon. */}
                  {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                    <option key={m} value={m}>{m} minuuttiin</option>
                  ))}
                </select>
              </label>
            )}

            {kohde.mandown?.paalla !== true && (
              <p className="text-xs text-ink-muted">
                Pois käytöstä. Vartijan puhelin ei kysy mitään eikä liikkumattomuudesta
                synny hälytystä.
              </p>
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

      {valilehti === 'vuorot' && (
        <div>
          <p className="text-sm text-ink-muted mb-4">
            Vuorot joihin vartija voi kirjautua tässä kohteessa. Vuoro määrää mitkä tehtävät
            ja kierrokset vartijalle tulevat — hänen ei tarvitse tietää niitä itse.
            Perehdytys ratkaisee kuka mihinkin vuoroon pääsee.
          </p>

          {vuorotyypit.length > 0 && (
            <div className="border border-line rounded-lg divide-y divide-line-soft mb-6">
              {vuorotyypit.map((v) => (
                <div key={v.id} className="flex items-start gap-3 px-4 py-3">
                  <CalendarClock size={16} className="text-accent shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {v.nimi}
                      {v.alkaa && v.paattyy ? (
                        <span className="text-ink-muted font-normal"> · {v.alkaa}–{v.paattyy}</span>
                      ) : (
                        <span className="text-ink-subtle font-normal"> · ei kellonaikaa</span>
                      )}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {lkm((v.tehtavaIdt || []).length, 'tehtävä', 'tehtävää')}
                      {' · '}
                      {lkm((v.pohjaIdt || []).length, 'kierros', 'kierrosta')}
                      {' · '}
                      {lkm(
                        perehdytykset.filter((pe) => (pe.vuorotyyppiIdt || []).includes(v.id) && pe.username).length,
                        'perehdytetty',
                        'perehdytettyä'
                      )}
                    </p>
                  </div>
                  {saaMuokata && (
                    <>
                      <button
                        type="button"
                        onClick={() => setMuokattavaVuoro({
                          ...v,
                          alkaa: v.alkaa || '',
                          paattyy: v.paattyy || '',
                          tehtavaIdt: [...(v.tehtavaIdt || [])],
                          pohjaIdt: [...(v.pohjaIdt || [])],
                        })}
                        className="shrink-0 text-xs font-medium text-ink-body hover:text-accent transition-colors"
                      >
                        Muokkaa
                      </button>
                      <button
                        type="button"
                        onClick={() => poistaVuoro(v.id)}
                        className="shrink-0 text-ink-subtle hover:text-danger transition-colors"
                        title={'Poista vuoro ' + v.nimi}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {muokattavaVuoro ? (
            <div className="bg-sunken border border-line rounded-lg p-4 space-y-3">
              <Kentta
                label="Vuoron nimi"
                arvo={muokattavaVuoro.nimi}
                onChange={(v) => setMuokattavaVuoro({ ...muokattavaVuoro, nimi: v })}
                placeholder="esim. Aamuvuoro"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Kentta
                  label="Alkaa"
                  arvo={muokattavaVuoro.alkaa || ''}
                  onChange={(v) => setMuokattavaVuoro({ ...muokattavaVuoro, alkaa: v })}
                  tyyppi="time"
                />
                <Kentta
                  label="Päättyy"
                  arvo={muokattavaVuoro.paattyy || ''}
                  onChange={(v) => setMuokattavaVuoro({ ...muokattavaVuoro, paattyy: v })}
                  tyyppi="time"
                />
              </div>
              <p className="text-xs text-ink-muted">
                Vuoroon voi kirjautua kaksi tuntia ennen alkua ja kaksi tuntia päättymisen
                jälkeen. Jätä ajat tyhjiksi jos vuoro ei ole sidottu kellonaikaan — tyhjä
                aika ei rajoita mitään.
              </p>

              <div>
                <span className="block text-sm font-medium text-ink-body mb-2">Vuoron tehtävät</span>
                {tehtavat.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    Kohteelle ei ole vielä määritelty tehtäviä. Lisää ne Työvuoron tehtävät
                    -välilehdellä.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {tehtavat.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm text-ink-body">
                        <input
                          type="checkbox"
                          checked={(muokattavaVuoro.tehtavaIdt || []).includes(t.id)}
                          onChange={() => setMuokattavaVuoro({
                            ...muokattavaVuoro,
                            tehtavaIdt: vaihdaVuoroValinta(muokattavaVuoro.tehtavaIdt || [], t.id),
                          })}
                          className="rounded border-line-strong"
                        />
                        {t.nimi}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <span className="block text-sm font-medium text-ink-body mb-2">Vuoron kierrokset</span>
                {pohjat.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    Kohteelle ei ole kierrospohjia. Ne luodaan Kierrospohjat-näkymässä.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {pohjat.map((po) => (
                      <label key={po.id} className="flex items-center gap-2 text-sm text-ink-body">
                        <input
                          type="checkbox"
                          checked={(muokattavaVuoro.pohjaIdt || []).includes(po.id)}
                          onChange={() => setMuokattavaVuoro({
                            ...muokattavaVuoro,
                            pohjaIdt: vaihdaVuoroValinta(muokattavaVuoro.pohjaIdt || [], po.id),
                          })}
                          className="rounded border-line-strong"
                        />
                        <Route size={14} className="text-ink-subtle" />
                        {po.nimi}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={tallennaVuoro}
                  className="bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                >
                  Valmis
                </button>
                <button
                  type="button"
                  onClick={() => setMuokattavaVuoro(null)}
                  className="text-sm font-medium text-ink-muted hover:text-ink-body px-4 py-2"
                >
                  Peruuta
                </button>
              </div>
            </div>
          ) : saaMuokata ? (
            <button
              type="button"
              onClick={() => setMuokattavaVuoro(tyhjaVuoro())}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              <Plus size={16} />
              Lisää vuoro
            </button>
          ) : null}

          <p className="text-xs text-ink-muted mt-4">
            Vuorot tallentuvat vasta kun tallennat kohteen.
          </p>
        </div>
      )}

      {valilehti === 'perehdytys' && (
        <div>
          <p className="text-sm text-ink-muted mb-4">
            Henkilöt jotka on perehdytetty tähän kohteeseen, ja mihin vuoroihin perehdytys
            pätee. Merkintä säilyy vaikka henkilö poistettaisiin työntekijäpankista
            myöhemmin.
          </p>
          <p className="text-sm text-ink-muted mb-4">
            <strong className="font-semibold text-ink-body">Perehdytys ratkaisee pääsyn.</strong>{' '}
            Vartija voi kirjautua vain niihin vuoroihin jotka on tässä rastitettu hänen
            käyttäjätunnukselleen. Merkintä ilman tunnusta on kirjaus siitä että perehdytys
            on pidetty, mutta se ei avaa yhtään vuoroa.
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
                      {p.username ? ` · tunnus ${p.username}` : ''}
                    </p>

                    {!p.username ? (
                      /* Kytkemätön merkintä. Tämä on sanottava ääneen: ilman varoitusta se
                         näyttää täsmälleen samalta kuin toimiva perehdytys, ja vika
                         huomataan vasta kun vartija ei pääse vuoroon. */
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-warning-ink">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                        <span>
                          Ei kytketty käyttäjätunnukseen — ei avaa yhtään vuoroa. Poista
                          merkintä ja lisää se uudelleen tunnus valiten.
                        </span>
                      </p>
                    ) : vuorotyypit.length === 0 ? (
                      <p className="mt-1 text-xs text-ink-subtle">
                        Kohteelle ei ole määritelty vuoroja.
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                        {vuorotyypit.map((v) => (
                          <label key={v.id} className="flex items-center gap-1.5 text-xs text-ink-body">
                            <input
                              type="checkbox"
                              disabled={!saaMuokata}
                              checked={(p.vuorotyyppiIdt || []).includes(v.id)}
                              onChange={() => vaihdaPerehdytyksenVuoro(p.id, v.id)}
                              className="rounded border-line-strong"
                            />
                            {v.nimi}
                          </label>
                        ))}
                      </div>
                    )}

                    {p.username && vuorotyypit.length > 0 && (p.vuorotyyppiIdt || []).length === 0 && (
                      /* Tyhjä vuorolista tarkoittaa EI YHTÄÄN eikä kaikkia (server/vuorot.js).
                         Sitä ei voi päätellä katsomalla, joten se sanotaan. */
                      <p className="mt-1.5 text-xs text-ink-muted">
                        Ei yhtään vuoroa rastitettuna — tämä perehdytys ei avaa mitään.
                      </p>
                    )}
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
            {/* Käyttäjätunnus on se kenttä joka myöntää pääsyn. Se on omana valintanaan
                työntekijäpankin rinnalla eikä sen sijaan: työntekijätietue on
                henkilöstöhallinnan tieto, tunnus on se jolla vartija kirjautuu, eivätkä ne
                ole sama asia ennen kuin joku kytkee ne yhteen. */}
            <label className="block">
              <span className="block text-sm font-medium text-ink-body mb-1">
                Käyttäjätunnus
              </span>
              <select
                value={uusiPerehdytys.username}
                onChange={(e) => setUusiPerehdytys({ ...uusiPerehdytys, username: e.target.value })}
                disabled={perehdytettavat.length === 0}
                className="w-full rounded-lg border border-line-strong p-2.5 text-sm bg-surface outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
              >
                <option value="">Ei kytketä tunnukseen…</option>
                {perehdytettavat.map((k) => (
                  <option key={k.username} value={k.username}>
                    {k.nimi} ({k.username})
                  </option>
                ))}
              </select>
              {/* Puuttuva nimi listalta on kysymys johon käyttöliittymän on vastattava.
                  Ilman tätä ainoa tapa selvittää se on lukea palvelinkoodia. */}
              <span className="block text-xs text-ink-muted mt-1">
                {!kohde.id
                  ? 'Tallenna kohde ensin, niin tunnukset voidaan hakea.'
                  : perehdytettavat.length === 0
                    ? 'Yhdelläkään tunnuksella ei ole pääsyä tähän kohteeseen. Perehdytyksen voi silti kirjata, mutta se ei avaa vuoroja.'
                    : 'Ilman tunnusta merkintä on kirjaus perehdytyksestä, ei pääsy vuoroon.'}
              </span>
              {kohde.id && perehdytettavat.length > 0 && (
                <span className="block text-xs text-ink-subtle mt-1">
                  Listalla ovat GUARD-tunnukset joilla on pääsy tähän kohteeseen. Jos joku
                  puuttuu, tarkista hänen käyttäjätasonsa ja kohderajauksensa.
                </span>
              )}
            </label>

            <div>
              <span className="block text-sm font-medium text-ink-body mb-2">
                Perehdytetyt vuorot
              </span>
              {vuorotyypit.length === 0 ? (
                <p className="text-xs text-ink-muted">
                  Kohteelle ei ole vielä määritelty vuoroja. Lisää ne Vuorot-välilehdellä.
                </p>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {vuorotyypit.map((v) => (
                    <label key={v.id} className="flex items-center gap-1.5 text-sm text-ink-body">
                      <input
                        type="checkbox"
                        checked={uusiPerehdytys.vuorotyyppiIdt.includes(v.id)}
                        onChange={() => setUusiPerehdytys({
                          ...uusiPerehdytys,
                          vuorotyyppiIdt: vaihdaVuoroValinta(uusiPerehdytys.vuorotyyppiIdt, v.id),
                        })}
                        className="rounded border-line-strong"
                      />
                      {v.nimi}
                    </label>
                  ))}
                </div>
              )}
            </div>

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
              {/* Suoritusaika EI rajoita mitään: se kertoo vartijalle milloin tehtävä on
                  suunniteltu tehtäväksi ja järjestää työlistan. Poikkeamasta jää merkintä
                  vuoron koosteeseen, ei estettä. */}
              <Kentta
                label="Suunniteltu suoritusaika (valinnainen)"
                arvo={muokattavaTehtava.suoritusaika || ''}
                onChange={(v) => setMuokattavaTehtava({ ...muokattavaTehtava, suoritusaika: v })}
                tyyppi="time"
                vinkki="Ei estä suorittamista muuna aikana — poikkeamasta jää merkintä vuoron koosteeseen."
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
