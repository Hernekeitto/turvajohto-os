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
} from 'lucide-react';

import { QrKoodi } from '../../shared/komponentit/QrKoodi';
import { LAJIT } from './lajit';
import {
  aikaleima, paivitaKalusto, peruPyynto, ratkaisePyynto, siirraKalusto, tarranOsoite, vaihdaTila,
} from './pankki';
import {
  SIJOITUKSEN_SELITE, TAPAHTUMAN_SELITE, TILAN_SELITE, TILAN_VARI,
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
  saaHallita: boolean;
  omaTunnus: string;
  onMuuttui: () => void;
  onSulje: () => void;
  onTulostaKilpi: (esine: KalustoTietue) => void;
};

const SIIRTOVAIHTOEHDOT: SijoitusLaji[] = ['varasto', 'kohde', 'henkilo', 'ajoneuvo', 'avainkaappi'];

export const KalustoKortti = ({
  esine, kohteet, tyontekijat, kantajat, saaHallita, omaTunnus,
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
    if (kohdeLaji !== 'varasto' && !kohdeId) {
      setVirhe('Valitse mihin esine siirretään.');
      return;
    }
    kutsu(
      () => siirraKalusto(esine.id, { laji: kohdeLaji, id: kohdeLaji === 'varasto' ? null : kohdeId }, siirtoHuomio),
      () => { setSiirtoAuki(false); setKohdeId(''); setSiirtoHuomio(''); }
    );
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
              {esine.sijoitusLaji !== 'varasto' && esine.sijoitusNimi ? `: ${esine.sijoitusNimi}` : ''}
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
                <Kentta key={kentta.avain} otsikko={kentta.otsikko} vihje={kentta.vihje}>
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
              {esine.sarjanumero && <Tieto otsikko="Sarjanumero" arvo={esine.sarjanumero} mono />}
              {(maar?.lisakentat || []).map((kentta) => {
                const arvo = esine.lisatiedot?.[kentta.avain];
                if (arvo === undefined || arvo === '' || arvo === false) return null;
                return (
                  <Tieto
                    key={kentta.avain}
                    otsikko={kentta.otsikko}
                    arvo={arvo === true ? 'Kyllä' : String(arvo)}
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
                {kohdeLaji !== 'varasto' && (
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
                    disabled={tyoskentelee}
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

const Kentta = ({ otsikko, vihje, children }: {
  otsikko: string; vihje?: string; children: ReactNode;
}) => (
  <div>
    <label className="block text-xs font-medium text-ink-muted mb-1">{otsikko}</label>
    {children}
    {vihje && <p className="text-xs text-ink-muted mt-1">{vihje}</p>}
  </div>
);

const Tieto = ({ otsikko, arvo, mono, levea }: {
  otsikko: string; arvo: string; mono?: boolean; levea?: boolean;
}) => (
  <div className={levea ? 'sm:col-span-2' : ''}>
    <dt className="text-xs text-ink-muted">{otsikko}</dt>
    <dd className={`text-ink-body ${mono ? 'font-mono' : ''}`}>{arvo}</dd>
  </div>
);
