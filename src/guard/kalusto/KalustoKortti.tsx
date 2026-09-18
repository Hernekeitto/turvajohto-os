// Yhden kalustoesineen kortti: mikä se on, missä se on ja mitä sille on tapahtunut.
//
// KOLME OSAA SAMASSA NÄKYMÄSSÄ, koska ne vastaavat samaan kysymykseen eri suunnasta.
// Tiedot kertovat mikä esine on, sijoitus missä se on nyt, ja historia miten se sinne
// päätyi. Historia on erillisen napin takana vain siksi, että se kasvaa loputtomiin —
// ei siksi, että se olisi toissijaista: luovutusketju on rekisterin ainoa todistusarvo.
//
// Kortti avautuu myös QR-koodia lukemalla (GuardApp: ?kalusto=TJ-ASU-0117), ja se on
// kentällä tärkein reitti tänne — puhelin kädessä on esine, ja kysymys on "kenen tämä on".
import { useState, type ReactNode } from 'react';
import {
  ArrowRightLeft, History, Printer, TriangleAlert, Wrench, Ban, Undo2, Pencil, X, Check,
  Plus, Search, ArrowDownLeft, ArrowUpRight, ListOrdered, CalendarRange,
} from 'lucide-react';

import { QrKoodi } from '../../shared/komponentit/QrKoodi';
import { AvainkarttaNappi } from './Avainkartta';
import { LAJIT, kentanOtsikko, kentanVihje } from './lajit';
import { sailyttimenTapahtumat, suodataValille } from './sailytin';
import {
  aikaleima, maaraaikatila, paivays, paiviaJaljella, paivitaKalusto, peruPyynto,
  ratkaisePyynto, siirraKalusto, tarranOsoite, vaihdaTila,
} from './pankki';
import {
  SIJOITUKSEN_SELITE, TAPAHTUMAN_SELITE, TILAN_SELITE, TILAN_VARI, onSailo,
  type KalustoTietue, type SijoitusLaji,
} from './tyypit';

export type SiirtoKohde = { id: string; nimi: string };

type Props = {
  esine: KalustoTietue;
  // Mihin esineen voi siirtää. Kaikki kolme tulevat kutsujalta, koska ne ovat eri
  // kokoelmista (guardSites, employees, assets) eikä tämän kortin tehtävä ole hakea niitä.
  kohteet: SiirtoKohde[];
  tyontekijat: SiirtoKohde[];
  kantajat: { id: string; nimi: string; laji: SijoitusLaji }[];
  // Koko pankki. Tarvitaan kun avattu esine on SÄILYTIN (avainkaappi tai ajoneuvo):
  // silloin kortin on näytettävä mitä sen sisällä on. Laskenta tehdään täällä eikä
  // kutsujassa, koska kortti on ainoa joka tietää minkä esineen se avasi.
  kalusto: KalustoTietue[];
  saaHallita: boolean;
  omaTunnus: string;
  onMuuttui: () => void;
  onSulje: () => void;
  onTulostaKilpi: (esine: KalustoTietue) => void;
};

// Molemmat säilöt tarjolla kaikille lajeille eikä vain lajin oma: takki kuuluu
// varusvarastoon, mutta siirtoa ei estetä sillä perusteella missä tavaran KUULUISI olla
// — rekisterin tehtävä on kertoa missä se on.
const SIIRTOVAIHTOEHDOT: SijoitusLaji[] = [
  'holvi', 'varusvarasto', 'kohde', 'henkilo', 'ajoneuvo', 'avainkaappi',
];

// Miksi siirtokohteiden lista on tyhjä ja mitä sille tehdään.
//
// Tyhjä valikko ja sen perään virhe "Valitse mihin esine siirretään" on umpikuja: se
// käskee valita silloin kun valittavaa ei ole, eikä kerro mistä valittavat tulisivat.
// Henkilön kohdalla se on erityisen harhaanjohtava, koska tunnuksia on — ne vain eivät
// ole sama asia kuin työntekijätietueet.
const TYHJAN_SELITE: Partial<Record<SijoitusLaji, string>> = {
  kohde: 'Yhtään kohdetta ei ole perustettu. Lisää kohde ensin.',
  henkilo: 'Työntekijäpankki on tyhjä. Kalusto luovutetaan työntekijätietueelle eikä '
    + 'käyttäjätunnukselle: tunnus on kirjautumista varten eikä kaikilla työntekijöillä '
    + 'ole sellaista, ja luovutustositteeseen tulee työntekijän nimi ja tunnistenumero. '
    + 'Lisää henkilöt Työntekijäpankkiin.',
  ajoneuvo: 'Pankissa ei ole yhtään ajoneuvoa. Lisää ajoneuvo kalustoksi ensin.',
  avainkaappi: 'Pankissa ei ole yhtään avainkaappia. Kaapit lisätään avainten välilehdeltä.',
};

// Lajit joihin voi sijoittaa muuta kalustoa. Avainkaappi ei ole pelkkä esine vaan
// PAIKKA: siihen siirretään avaimia holvista, ja kortin on kerrottava mitä siellä on.
// Ajoneuvo on sama asia liikkuvana — piiriauton kaappi on auton sisällä.
const SAILYTTIMET = new Set(['avainkaappi', 'ajoneuvo']);

export const KalustoKortti = ({
  esine, kohteet, tyontekijat, kantajat, kalusto, saaHallita, omaTunnus,
  onMuuttui, onSulje, onTulostaKilpi,
}: Props) => {
  // HUOM: takaisin-napin este EI ole täällä vaan kutsujassa
  // (`useTakaisinEste(!!avattuEsine, …)`). Syy on StrictMode: hook työntää
  // historiamerkinnän mount-efektissä ja kuluttaa sen siivouksessa, ja kehityksessä React
  // ajaa parin mount → siivous → mount. Siivouksen `history.back()` laukaisee popstaten,
  // joka sulkee juuri uudelleen avatun modaalin — kortti välähti auki ja katosi.
  //
  // Kun hook on aina mountatussa vanhemmassa ja saa `aktiivinen`-lipun, kaksoisajo osuu
  // hetkeen jolloin lippu on false eikä tee mitään. Sama ratkaisu kuin
  // GuardApp.tsx:n poistovahvistuksessa.
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);
  const [historiaAuki, setHistoriaAuki] = useState(false);
  const [siirtoAuki, setSiirtoAuki] = useState(false);
  const [muokkausAuki, setMuokkausAuki] = useState(false);

  const [kohdeLaji, setKohdeLaji] = useState<SijoitusLaji>('kohde');
  const [kohdeId, setKohdeId] = useState('');
  const [siirtoHuomio, setSiirtoHuomio] = useState('');

  // Tilamuutos joka vaatii syyn. null = lomake kiinni.
  const [syyLomake, setSyyLomake] = useState<'kadonnut' | 'poista' | null>(null);
  const [syy, setSyy] = useState('');
  const [hylkaysSyy, setHylkaysSyy] = useState('');
  const [lisaysAuki, setLisaysAuki] = useState(false);
  const [liikenneAuki, setLiikenneAuki] = useState(false);
  // Aikavälirajaus koskee vain liikennelistaa, ei korttia muuten.
  const [valiAlku, setValiAlku] = useState('');
  const [valiLoppu, setValiLoppu] = useState('');
  const [lisaysHaku, setLisaysHaku] = useState('');
  const [lisattavat, setLisattavat] = useState<Set<string>>(new Set());

  const maar = LAJIT[esine.laji];
  const Ikoni = maar?.ikoni;

  const [muokkaus, setMuokkaus] = useState({
    nimi: esine.nimi,
    alalaji: esine.alalaji,
    kuvaus: esine.kuvaus,
    sarjanumero: esine.sarjanumero,
    lisatiedot: { ...esine.lisatiedot } as Record<string, string | boolean>,
  });

  const kutsu = async (tehtava: () => Promise<{ ok: boolean; error?: string }>, jalkeen?: () => void) => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = await tehtava();
      if (!tulos.ok) {
        setVirhe(tulos.error || 'Toiminto epäonnistui.');
        return;
      }
      jalkeen?.();
      onMuuttui();
    } finally {
      setTyoskentelee(false);
    }
  };

  const siirtoVaihtoehdot = kohdeLaji === 'kohde'
    ? kohteet
    : kohdeLaji === 'henkilo'
      ? tyontekijat
      : kantajat.filter((k) => k.laji === kohdeLaji && k.id !== esine.id);

  const teeSiirto = () => {
    if (!onSailo(kohdeLaji) && !kohdeId) {
      setVirhe('Valitse mihin esine siirretään.');
      return;
    }
    kutsu(
      () => siirraKalusto(esine.id, { laji: kohdeLaji, id: onSailo(kohdeLaji) ? null : kohdeId }, siirtoHuomio),
      () => { setSiirtoAuki(false); setKohdeId(''); setSiirtoHuomio(''); }
    );
  };

  // Mitä tässä säilyttimessä on nyt. Poistetut jätetään pois: ne eivät ole kaapissa
  // vaan rekisterissä.
  const onSailytin = SAILYTTIMET.has(esine.laji);
  const sisalto = onSailytin
    ? kalusto.filter((e) => e.sijoitusId === esine.id && e.tila !== 'poistettu')
    : [];

  // Mitä kaappiin voi lisätä: käytössä oleva kalusto joka ei ole jo täällä eikä ole
  // henkilökohtainen (server/kalusto.js estää henkilökohtaisen siirron muualle kuin
  // henkilölle). Säilytin itse ei voi mennä itsensä sisään.
  const lisattavissa = onSailytin
    ? kalusto
      .filter((e) => e.tila === 'kaytossa' && e.id !== esine.id && e.sijoitusId !== esine.id)
      .filter((e) => e.lisatiedot?.henkilokohtainen !== true)
      .filter((e) => !SAILYTTIMET.has(e.laji))
      .filter((e) => {
        const kysely = lisaysHaku.trim().toLowerCase();
        if (!kysely) return true;
        return [e.tunnus, e.nimi, e.alalaji, String(e.holviPaikka ?? '')]
          .some((k) => String(k || '').toLowerCase().includes(kysely));
      })
      .sort((a, b) => a.tunnus.localeCompare(b.tunnus))
      .slice(0, 40)
    : [];

  // Säilyttimen liikenne: saapumiset ja lähdöt yhtenä aikajanana (sailytin.ts).
  // Johdettu esineiden omista historioista eikä säilyttimen omasta lokista: kaksi lokia
  // samasta tapahtumasta eroaisivat ensimmäisessä virheessä. Vastaa hävikkiselvityksen
  // kysymykseen — kaapissa pitäisi olla kymmenen avainta, siellä on yhdeksän, mitä on
  // tapahtunut.
  const liikenne = onSailytin ? sailyttimenTapahtumat(kalusto, esine.id) : [];
  const rajattu = suodataValille(liikenne, valiAlku, valiLoppu);
  const rajausPaalla = Boolean(valiAlku || valiLoppu);

  // Lisäys on N siirtoa peräkkäin. Yksi kutsu per esine eikä eräsiirtoa: jokainen siirto
  // on oma historiarivinsä, ja juuri se on luovutusketjun sisältö. Ensimmäinen virhe
  // pysäyttää, jolloin loput jäävät siirtämättä eikä tilaa tarvitse arvailla.
  const lisaaKaappiin = async () => {
    if (lisattavat.size === 0) return;
    setVirhe(null);
    setTyoskentelee(true);
    try {
      for (const id of lisattavat) {
        const tulos = await siirraKalusto(id, { laji: esine.laji as SijoitusLaji, id: esine.id });
        if (!tulos.ok) {
          setVirhe(tulos.error || 'Siirto epäonnistui.');
          return;
        }
      }
      setLisattavat(new Set());
      setLisaysHaku('');
      setLisaysAuki(false);
      onMuuttui();
    } finally {
      setTyoskentelee(false);
    }
  };

  // Pyynnön voi perua pyytäjä itse tai pääkäyttäjä (server/index.js). Painike näkyy vain
  // sille jolle se kuuluu, jotta kukaan ei paina nappia joka vastaa 403:lla.
  const saaPerua = esine.pyynto != null && (saaHallita || esine.pyynto.pyytaja === omaTunnus);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center px-3 py-4 overflow-y-auto">
      <div className="bg-surface rounded-xl shadow-xl border border-line w-full max-w-2xl my-auto">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-line-soft">
          <div className="min-w-0 flex items-start gap-3">
            {Ikoni && <Ikoni className="w-6 h-6 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />}
            <div className="min-w-0">
              <h3 className="font-bold text-ink-strong break-words">{esine.nimi}</h3>
              <p className="text-xs text-ink-muted mt-0.5 font-mono">{esine.tunnus}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSulje}
            className="p-1.5 rounded-lg text-ink-muted hover:bg-sunken shrink-0"
            aria-label="Sulje"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {virhe && (
            <div className="text-sm bg-danger-soft text-danger-ink border border-danger/30 rounded-lg px-3 py-2">
              {virhe}
            </div>
          )}

          {/* --- Tila ja sijoitus: se mitä kentällä kysytään ensimmäisenä --- */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${TILAN_VARI[esine.tila]}`}>
              {TILAN_SELITE[esine.tila]}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-sunken text-ink-body border-line">
              {SIJOITUKSEN_SELITE[esine.sijoitusLaji]}
              {!onSailo(esine.sijoitusLaji) && esine.sijoitusNimi ? `: ${esine.sijoitusNimi}` : ''}
            </span>
            {maar && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border bg-sunken text-ink-body border-line">
                {maar.nimi}{esine.alalaji ? ` · ${esine.alalaji}` : ''}
              </span>
            )}
          </div>

          {/* --- Avoin pyyntö --- */}
          {esine.pyynto && (
            <div className="border border-warning/30 bg-warning-soft rounded-lg p-3">
              <p className="text-sm font-bold text-warning-ink">
                Pyyntö odottaa: {esine.pyynto.kohdeNimi}
              </p>
              <p className="text-sm text-ink-body mt-1">{esine.pyynto.perustelu}</p>
              <p className="text-xs text-ink-muted mt-1">
                {esine.pyynto.pyytaja} · {aikaleima(esine.pyynto.luotu)}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {saaHallita && (
                  <>
                    <button
                      type="button"
                      disabled={tyoskentelee}
                      onClick={() => kutsu(() => ratkaisePyynto(esine.id, true))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95 disabled:opacity-50"
                    >
                      <Check size={15} />
                      Hyväksy ja siirrä kohteelle
                    </button>
                    <input
                      value={hylkaysSyy}
                      onChange={(e) => setHylkaysSyy(e.target.value)}
                      placeholder="Hylkäyksen syy"
                      className="flex-1 min-w-[10rem] px-3 py-1.5 rounded-lg border border-line bg-surface text-sm text-ink-body"
                    />
                    <button
                      type="button"
                      disabled={tyoskentelee}
                      onClick={() => kutsu(() => ratkaisePyynto(esine.id, false, hylkaysSyy), () => setHylkaysSyy(''))}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken disabled:opacity-50"
                    >
                      Hylkää
                    </button>
                  </>
                )}
                {saaPerua && (
                  <button
                    type="button"
                    disabled={tyoskentelee}
                    onClick={() => kutsu(() => peruPyynto(esine.id))}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken disabled:opacity-50"
                  >
                    Peru pyyntö
                  </button>
                )}
              </div>
            </div>
          )}

          {/* --- Perustiedot --- */}
          {muokkausAuki ? (
            <div className="space-y-3 border border-line rounded-lg p-3">
              <Kentta otsikko="Nimi">
                <input
                  value={muokkaus.nimi}
                  onChange={(e) => setMuokkaus((m) => ({ ...m, nimi: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                />
              </Kentta>
              <Kentta otsikko="Tyyppi">
                <input
                  value={muokkaus.alalaji}
                  onChange={(e) => setMuokkaus((m) => ({ ...m, alalaji: e.target.value }))}
                  list={`alalajit-${esine.id}`}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                />
                <datalist id={`alalajit-${esine.id}`}>
                  {(maar?.alalajit || []).map((a) => <option key={a} value={a} />)}
                </datalist>
              </Kentta>
              {maar?.sarjanumero !== 'ei' && (
                <Kentta otsikko={`Sarjanumero${maar?.sarjanumero === 'pakollinen' ? ' (pakollinen)' : ''}`}>
                  <input
                    value={muokkaus.sarjanumero}
                    onChange={(e) => setMuokkaus((m) => ({ ...m, sarjanumero: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                  />
                </Kentta>
              )}
              {(maar?.lisakentat || []).map((kentta) => (
                <Kentta
                  key={kentta.avain}
                  // Otsikko ja vihje alalajin mukaan: voimankäyttövälineen määräpäivä
                  // on sumuttimella viimeinen käyttöpäivä ja patukalla tarkastuspäivä.
                  otsikko={kentanOtsikko(kentta, muokkaus.alalaji)}
                  vihje={kentanVihje(kentta, muokkaus.alalaji)}
                  lisa={kentta.avain === 'avaintyyppi' ? (
                    <AvainkarttaNappi
                      saaHallita={saaHallita}
                      valittuNimi={String(muokkaus.lisatiedot.avaintyyppi ?? '')}
                      onValitse={(nimi) => setMuokkaus((m) => ({
                        ...m, lisatiedot: { ...m.lisatiedot, avaintyyppi: nimi },
                      }))}
                    />
                  ) : undefined}
                >
                  {kentta.totuusarvo ? (
                    <label className="flex items-center gap-2 text-sm text-ink-body">
                      <input
                        type="checkbox"
                        checked={muokkaus.lisatiedot[kentta.avain] === true}
                        onChange={(e) => setMuokkaus((m) => ({
                          ...m, lisatiedot: { ...m.lisatiedot, [kentta.avain]: e.target.checked },
                        }))}
                      />
                      Kyllä
                    </label>
                  ) : (
                    <input
                      // Päivämääräkentässä selaimen oma valitsin: se tuottaa ISO-muodon
                      // jota palvelin vaatii, eikä käyttäjän tarvitse tietää muodosta.
                      type={kentta.paivamaara ? 'date' : 'text'}
                      value={String(muokkaus.lisatiedot[kentta.avain] ?? '')}
                      onChange={(e) => setMuokkaus((m) => ({
                        ...m, lisatiedot: { ...m.lisatiedot, [kentta.avain]: e.target.value },
                      }))}
                      className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                    />
                  )}
                </Kentta>
              ))}
              <Kentta otsikko="Kuvaus">
                <textarea
                  value={muokkaus.kuvaus}
                  rows={2}
                  onChange={(e) => setMuokkaus((m) => ({ ...m, kuvaus: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                />
              </Kentta>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={tyoskentelee}
                  onClick={() => kutsu(() => paivitaKalusto(esine.id, muokkaus), () => setMuokkausAuki(false))}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95 disabled:opacity-50"
                >
                  Tallenna
                </button>
                <button
                  type="button"
                  onClick={() => setMuokkausAuki(false)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
                >
                  Peruuta
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {typeof esine.holviPaikka === 'number' && (
                <Tieto otsikko="Holvipaikka" arvo={String(esine.holviPaikka)} mono />
              )}
              {esine.sarjanumero && <Tieto otsikko="Sarjanumero" arvo={esine.sarjanumero} mono />}
              {(maar?.lisakentat || []).map((kentta) => {
                const arvo = esine.lisatiedot?.[kentta.avain];
                if (arvo === undefined || arvo === '' || arvo === false) return null;
                // Päivämäärä näytetään suomalaisessa muodossa mutta säilytetään
                // ISO:na. Jos arvo ei ole kelvollinen päivä, näytetään se sellaisenaan
                // — vanhaa tai rajapinnan kautta kirjattua arvoa ei piiloteta.
                const paiva = kentta.paivamaara ? paivays(String(arvo)) : '';
                return (
                  <Tieto
                    key={kentta.avain}
                    otsikko={kentanOtsikko(kentta, esine.alalaji)}
                    arvo={arvo === true ? 'Kyllä' : (paiva || String(arvo))}
                    merkki={kentta.paivamaara ? <MaaraaikaMerkki iso={String(arvo)} /> : undefined}
                    // Lukunäkymässä kartta on hakuteos ilman valintaa: kysymys on
                    // "onko tämä kädessäni oleva avain tätä mallia", ja vastaus
                    // saadaan kuvasta. Vartija näkee tämän myös ilman muokkausoikeutta.
                    lisa={kentta.avain === 'avaintyyppi'
                      ? <AvainkarttaNappi saaHallita={false} valittuNimi={String(arvo)} />
                      : undefined}
                  />
                );
              })}
              {esine.kuvaus && <Tieto otsikko="Kuvaus" arvo={esine.kuvaus} levea />}
              <Tieto otsikko="Lisätty" arvo={aikaleima(esine.luotu)} />
            </dl>
          )}

          {/* --- Siirto --- */}
          {saaHallita && esine.tila === 'kaytossa' && !muokkausAuki && (
            siirtoAuki ? (
              <div className="border border-line rounded-lg p-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {SIIRTOVAIHTOEHDOT.map((laji) => (
                    <button
                      key={laji}
                      type="button"
                      onClick={() => { setKohdeLaji(laji); setKohdeId(''); }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        kohdeLaji === laji
                          ? 'bg-accent text-white border-accent'
                          : 'border-line text-ink-body hover:bg-sunken'
                      }`}
                    >
                      {SIJOITUKSEN_SELITE[laji]}
                    </button>
                  ))}
                </div>
                {!onSailo(kohdeLaji) && (
                  siirtoVaihtoehdot.length === 0 ? (
                    <p className="text-sm text-ink-muted bg-sunken border border-line-soft rounded-lg px-3 py-2">
                      {TYHJAN_SELITE[kohdeLaji]}
                    </p>
                  ) : (
                    <select
                      value={kohdeId}
                      onChange={(e) => setKohdeId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                    >
                      <option value="">Valitse {SIJOITUKSEN_SELITE[kohdeLaji].toLowerCase()}…</option>
                      {siirtoVaihtoehdot.map((v) => (
                        <option key={v.id} value={v.id}>{v.nimi}</option>
                      ))}
                    </select>
                  )
                )}
                <input
                  value={siirtoHuomio}
                  onChange={(e) => setSiirtoHuomio(e.target.value)}
                  placeholder="Huomio (valinnainen)"
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    // Tyhjällä listalla painike ei voi onnistua, joten se ei myöskään
                    // näytä painettavalta: selitys vieressä kertoo mitä tehdä sen sijaan.
                    disabled={tyoskentelee || (!onSailo(kohdeLaji) && siirtoVaihtoehdot.length === 0)}
                    onClick={teeSiirto}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95 disabled:opacity-50"
                  >
                    Siirrä
                  </button>
                  <button
                    type="button"
                    onClick={() => setSiirtoAuki(false)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
                  >
                    Peruuta
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSiirtoAuki(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95"
              >
                <ArrowRightLeft size={15} />
                Siirrä
              </button>
            )
          )}

          {/* --- Tilamuutokset. Syytä vaativat avaavat kentän, koska palvelin hylkää
                 tyhjän syyn — ja hylkäys napin painamisen jälkeen on huonompi kuin kenttä
                 ennen sitä. --- */}
          {saaHallita && !muokkausAuki && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-line-soft">
              <button
                type="button"
                onClick={() => setMuokkausAuki(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
              >
                <Pencil size={14} />
                Muokkaa tietoja
              </button>
              <button
                type="button"
                onClick={() => onTulostaKilpi(esine)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
              >
                <Printer size={14} />
                Tulosta kilpi
              </button>
              {esine.tila === 'kaytossa' && (
                <>
                  <button
                    type="button"
                    disabled={tyoskentelee}
                    onClick={() => kutsu(() => vaihdaTila(esine.id, 'huoltoon'))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken disabled:opacity-50"
                  >
                    <Wrench size={14} />
                    Huoltoon
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSyyLomake('kadonnut'); setSyy(''); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 rounded-lg text-sm font-medium border border-danger/40 text-danger-ink hover:bg-danger-soft"
                  >
                    <TriangleAlert size={14} />
                    Kadonnut
                  </button>
                </>
              )}
              {(esine.tila === 'huollossa' || esine.tila === 'kadonnut') && (
                <button
                  type="button"
                  disabled={tyoskentelee}
                  onClick={() => kutsu(() => vaihdaTila(esine.id, 'kayttoon'))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken disabled:opacity-50"
                >
                  <Undo2 size={14} />
                  {esine.tila === 'kadonnut' ? 'Löytyi' : 'Takaisin käyttöön'}
                </button>
              )}
              {esine.tila !== 'poistettu' && (
                <button
                  type="button"
                  onClick={() => { setSyyLomake('poista'); setSyy(''); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 rounded-lg text-sm font-medium border border-line text-ink-muted hover:bg-sunken"
                >
                  <Ban size={14} />
                  Poista käytöstä
                </button>
              )}
            </div>
          )}

          {syyLomake && (
            <div className="border border-line rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-ink-strong">
                {syyLomake === 'kadonnut'
                  ? 'Mitä tapahtui? Kadonnut kalusto on turvallisuuspoikkeama.'
                  : 'Miksi esine poistetaan käytöstä?'}
              </p>
              <textarea
                value={syy}
                rows={2}
                onChange={(e) => setSyy(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={tyoskentelee}
                  onClick={() => kutsu(
                    () => vaihdaTila(esine.id, syyLomake, { syy }),
                    () => { setSyyLomake(null); setSyy(''); }
                  )}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95 disabled:opacity-50"
                >
                  Vahvista
                </button>
                <button
                  type="button"
                  onClick={() => setSyyLomake(null)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
                >
                  Peruuta
                </button>
              </div>
            </div>
          )}

          {/* --- Säilyttimen sisältö. Avainkaappi ei ole pelkkä yksilöity esine vaan
                 paikka johon avaimia sijoitetaan holvista. --- */}
          {onSailytin && !muokkausAuki && (
            <div className="border-t border-line-soft pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 className="font-medium text-ink-strong">
                  {esine.laji === 'avainkaappi' ? 'Kaapissa nyt' : 'Ajoneuvossa nyt'}
                  <span className="text-ink-muted font-normal"> ({sisalto.length})</span>
                </h4>
                {saaHallita && esine.tila === 'kaytossa' && !lisaysAuki && (
                  <button
                    type="button"
                    onClick={() => setLisaysAuki(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95"
                  >
                    <Plus size={14} />
                    Lisää avaimia
                  </button>
                )}
              </div>

              {sisalto.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Tyhjä. Avaimet siirretään tänne holvista tai muualta.
                </p>
              ) : (
                <ul className="space-y-1 mb-3">
                  {sisalto.map((rivi) => (
                    <li key={rivi.id} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-ink-muted shrink-0">{rivi.tunnus}</span>
                      <span className="text-ink-body truncate">{rivi.nimi}</span>
                      {typeof rivi.holviPaikka === 'number' && (
                        <span className="text-xs text-ink-muted shrink-0">· holvi {rivi.holviPaikka}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Liikenne omana listanaan eikä sisällön sekaan: "mitä täällä on" ja "mitä
                  täällä on käynyt" ovat eri kysymyksiä, ja sekoitettuina kumpaankaan ei
                  saisi vastausta yhdellä silmäyksellä. Painikkeen takana, koska lista
                  kasvaa loputtomiin — sisältö ei.

                  Saapumiset ja lähdöt SAMASSA aikajanassa: ne ovat saman liikkeen kaksi
                  puolta, ja hävikkiä selvitettäessä niitä luetaan rinnakkain. */}
              {liikenne.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setLiikenneAuki((a) => !a)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-body hover:text-accent"
                  >
                    <ListOrdered size={15} />
                    {liikenneAuki ? 'Piilota liikenne' : ('Saapumiset ja lähdöt (' + liikenne.length + ')')}
                  </button>
                  {liikenneAuki && (
                    <div className="mt-3 space-y-3">
                      {/* Aikavälirajaus on listan sisällä eikä kortin yläreunassa: se koskee
                          vain tätä listaa eikä mitään muuta kortilla. Päät ovat erikseen, koska
                          kysymys on usein toispuoleinen — mitä viime inventaarion jälkeen on
                          tapahtunut — eikä toista päätä pidä joutua keksimään. */}
                      <div className="flex flex-wrap items-end gap-2">
                        <CalendarRange size={15} className="text-ink-muted mb-2" />
                        <label className="text-xs text-ink-muted">
                          <span className="block mb-1">Alkaen</span>
                          <input
                            type="date"
                            value={valiAlku}
                            max={valiLoppu || undefined}
                            onChange={(e) => setValiAlku(e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-line bg-surface text-sm text-ink-strong"
                          />
                        </label>
                        <label className="text-xs text-ink-muted">
                          <span className="block mb-1">Päättyen</span>
                          <input
                            type="date"
                            value={valiLoppu}
                            min={valiAlku || undefined}
                            onChange={(e) => setValiLoppu(e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-line bg-surface text-sm text-ink-strong"
                          />
                        </label>
                        {rajausPaalla && (
                          <>
                            <button
                              type="button"
                              onClick={() => { setValiAlku(''); setValiLoppu(''); }}
                              className="px-2 py-1.5 rounded-lg border border-line text-sm text-ink-body hover:bg-sunken"
                            >
                              Koko historia
                            </button>
                            {/* Kuinka moni jäi rajauksen ulkopuolelle sanotaan ääneen: muuten
                                lyhentynyt lista näyttää siltä kuin tapahtumia olisi vähemmän
                                kuin niitä on. */}
                            <span className="text-xs text-ink-muted pb-2">
                              Näytetään {rajattu.length} / {liikenne.length}
                            </span>
                          </>
                        )}
                      </div>
                      {rajattu.length === 0 ? (
                        <p className="text-sm text-ink-muted">Ei tapahtumia valitulla aikavälillä.</p>
                      ) : (
                      <ul className="space-y-2">
                        {rajattu.map((rivi, i) => {
                          const saapui = rivi.suunta === 'saapui';
                          return (
                            <li
                              key={rivi.esineId + '-' + rivi.ts + '-' + rivi.suunta + '-' + i}
                              className={'text-sm border-l-2 pl-3 ' + (saapui ? 'border-success/50' : 'border-warning/50')}
                            >
                              <div className="flex flex-wrap items-baseline gap-x-2">
                                <span className="font-mono text-xs text-ink-muted">{rivi.tunnus}</span>
                                <span className="font-medium text-ink-strong">{rivi.nimi}</span>
                                {typeof rivi.holviPaikka === 'number' && (
                                  <span className="text-xs text-ink-muted">holvi {rivi.holviPaikka}</span>
                                )}
                              </div>
                              <div className={'flex items-center gap-1.5 ' + (saapui ? 'text-success-ink' : 'text-warning-ink')}>
                                {saapui ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                {/* Suunta sanotaan myös sanana eikä vain nuolena ja värinä:
                                    nuolen suunta on tulkinnanvarainen ja väri katoaa
                                    tulosteessa ja värisokealta. */}
                                <span>
                                  {saapui ? 'Saapui' : 'Lähti'}
                                  {/* Suomen sijapäätteitä ei voi liittää nimeen ohjelmallisesti
                                      ("Holvi" -> "holvista"), joten suunta kerrotaan sanana ja
                                      paikka sen perässä omana kenttänään. */}
                                  {rivi.vastapuoli && (saapui ? ' · mistä: ' : ' · minne: ') + rivi.vastapuoli}
                                </span>
                              </div>
                              <div className="text-xs text-ink-muted">
                                {aikaleima(rivi.ts)}{rivi.kuka ? (' · ' + rivi.kuka) : ''}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {lisaysAuki && (
                <div className="border border-line rounded-lg p-3 space-y-3">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <input
                      value={lisaysHaku}
                      onChange={(e) => setLisaysHaku(e.target.value)}
                      placeholder="Hae tunnuksella, nimellä tai holvipaikalla"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
                    />
                  </div>
                  {lisattavissa.length === 0 ? (
                    <p className="text-sm text-ink-muted">Ei siirrettävissä olevaa kalustoa.</p>
                  ) : (
                    <ul className="max-h-56 overflow-y-auto space-y-0.5">
                      {lisattavissa.map((rivi) => (
                        <li key={rivi.id}>
                          <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sunken cursor-pointer">
                            <input
                              type="checkbox"
                              checked={lisattavat.has(rivi.id)}
                              onChange={() => setLisattavat((edellinen) => {
                                const uusi = new Set(edellinen);
                                if (uusi.has(rivi.id)) uusi.delete(rivi.id);
                                else uusi.add(rivi.id);
                                return uusi;
                              })}
                            />
                            <span className="font-mono text-xs text-ink-muted shrink-0">{rivi.tunnus}</span>
                            <span className="text-sm text-ink-body truncate flex-1">{rivi.nimi}</span>
                            <span className="text-xs text-ink-muted shrink-0 max-w-[8rem] truncate">
                              {onSailo(rivi.sijoitusLaji)
                                ? SIJOITUKSEN_SELITE[rivi.sijoitusLaji]
                                : rivi.sijoitusNimi}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={tyoskentelee || lisattavat.size === 0}
                      onClick={lisaaKaappiin}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:brightness-95 disabled:opacity-50"
                    >
                      Siirrä {lisattavat.size > 0 ? lisattavat.size : ''} tähän
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLisaysAuki(false); setLisattavat(new Set()); setLisaysHaku(''); }}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-line text-ink-body hover:bg-sunken"
                    >
                      Peruuta
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* --- QR ja historia --- */}
          <div className="flex flex-wrap items-start gap-5 pt-3 border-t border-line-soft">
            <div className="text-center">
              <QrKoodi teksti={tarranOsoite(esine.tunnus)} koko={110} alt={`QR-koodi ${esine.tunnus}`} />
              <p className="text-[11px] text-ink-muted mt-1 font-mono">{esine.tunnus}</p>
            </div>
            {/* Historia näytetään VAIN jos palvelin lähetti sen. Vartijalta ketju
                karsitaan (server/kalusto.js: vuoronKalusto), ja tyhjä "Historia (0)"
                -painike väittäisi esineellä olevan menneisyys jota ei ole. */}
            <div className="flex-1 min-w-[12rem]">
              {esine.historia && (
              <button
                type="button"
                onClick={() => setHistoriaAuki((a) => !a)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-body hover:text-accent"
              >
                <History size={15} />
                {historiaAuki ? 'Piilota historia' : `Historia (${esine.historia.length})`}
              </button>
              )}
              {historiaAuki && (
                <ul className="mt-3 space-y-2">
                  {[...(esine.historia || [])].reverse().map((rivi, i) => (
                    <li key={`${rivi.ts}-${i}`} className="text-sm border-l-2 border-line pl-3">
                      <div className="font-medium text-ink-strong">
                        {TAPAHTUMAN_SELITE[rivi.tapahtuma] || rivi.tapahtuma}
                        {rivi.sijoitusNimi ? ` → ${rivi.sijoitusNimi}` : ''}
                      </div>
                      {rivi.teksti && <div className="text-ink-body">{rivi.teksti}</div>}
                      <div className="text-xs text-ink-muted">
                        {aikaleima(rivi.ts)}{rivi.user ? ` · ${rivi.user}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Kentta = ({ otsikko, vihje, lisa, children }: {
  otsikko: string; vihje?: string; lisa?: ReactNode; children: ReactNode;
}) => (
  <div>
    <span className="flex items-center gap-1.5 mb-1">
      <label className="block text-xs font-medium text-ink-muted">{otsikko}</label>
      {lisa}
    </span>
    {children}
    {vihje && <p className="text-xs text-ink-muted mt-1">{vihje}</p>}
  </div>
);

const Tieto = ({ otsikko, arvo, mono, levea, lisa, merkki }: {
  otsikko: string; arvo: string; mono?: boolean; levea?: boolean;
  lisa?: ReactNode; merkki?: ReactNode;
}) => (
  <div className={levea ? 'sm:col-span-2' : ''}>
    <dt className="text-xs text-ink-muted flex items-center gap-1.5">{otsikko}{lisa}</dt>
    {/* `merkki` on arvon vieressä eikä otsikon: se kertoo tästä arvosta (onko päivä
        mennyt) eikä siitä mitä kenttä tarkoittaa. */}
    <dd className={`text-ink-body flex flex-wrap items-center gap-2 ${mono ? 'font-mono' : ''}`}>
      {arvo}
      {merkki}
    </dd>
  </div>
);

// Määräpäivän tila sanoina. VAIN kun on jotain kerrottavaa: kaukana oleva päivä ei
// tarvitse merkkiä, ja merkki joka on aina näkyvissä lakkaa erottumasta juuri silloin
// kun sen pitäisi.
//
// Sanamuoto on neutraali molemmille merkityksille: sama kenttä on sumuttimella
// viimeinen käyttöpäivä ja patukalla tarkastuspäivä, eikä "vanhentunut" sovi
// jälkimmäiseen sen paremmin kuin "tarkastamatta" edelliseen.
const MaaraaikaMerkki = ({ iso }: { iso: string }) => {
  const tila = maaraaikatila(iso);
  if (tila === null || tila === 'voimassa') return null;
  const paivia = paiviaJaljella(iso) ?? 0;
  const mennyt = tila === 'mennyt';
  const teksti = mennyt
    ? (paivia === -1 ? 'Mennyt eilen' : `Mennyt ${Math.abs(paivia)} pv sitten`)
    : (paivia === 0 ? 'Tänään' : `${paivia} pv jäljellä`);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${
        mennyt
          ? 'bg-danger-soft text-danger-ink border-danger/30'
          : 'bg-warning-soft text-warning-ink border-warning/30'
      }`}
    >
      <TriangleAlert size={12} />
      {teksti}
    </span>
  );
};
