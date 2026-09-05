// Kierrospohjien hallinta: mitkä pisteet kierretään, missä järjestyksessä ja millä
// asetuksilla. Tämä on esimiehen näkymä — vartija kulkee kierroksen Kierros-näkymässä,
// eikä hänen pidä voida muokata sitä kierrosta jota häntä pyydetään kulkemaan.
//
// Pohjaa EI tallenneta geneerisen kokoelmareitin kautta vaan /api/pohjat-reiteillä,
// koska tarkistuspisteen token syntyy palvelimella eikä selain näe sitä koskaan. Jos
// koko kokoelma tallennettaisiin täältä, tokenit menisivät tyhjiksi ja jokainen
// seinässä oleva tarra lakkaisi toimimasta.
import { useState } from 'react';
import { Plus, Trash2, Printer, Pencil, ArrowUp, ArrowDown, MapPin, Archive } from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { haeQrKoodi } from '../shared/komponentit/QrKoodi';
import { tarraDokumentti, tulostaDokumentti } from '../shared/tuloste';
import { Kentta } from './Kentta';
import { uusiId, type Kohde, type Kierrospohja, type Tarkistuspiste } from './tyypit';

type Props = {
  kohde: Kohde;
  pohjat: Kierrospohja[];
  saaMuokata: boolean;
  onTallennettu: () => void;
  onTakaisin: () => void;
};

type Luonnos = {
  id: string | null;
  nimi: string;
  kuvaus: string;
  pisteet: Tarkistuspiste[];
  sijaintiPakotus: boolean;
  sietorajaM: string;
};

const tyhjaLuonnos = (): Luonnos => ({
  id: null,
  nimi: '',
  kuvaus: '',
  pisteet: [],
  sijaintiPakotus: false,
  sietorajaM: '100',
});

const luonnosPohjasta = (pohja: Kierrospohja): Luonnos => ({
  id: pohja.id,
  nimi: pohja.nimi,
  kuvaus: pohja.kuvaus || '',
  // Kopio, jotta peruutus ei jätä muokattua listaa näkyviin.
  pisteet: (pohja.pisteet || []).map((p) => ({ ...p })),
  sijaintiPakotus: pohja.sijaintiPakotus === true,
  sietorajaM: String(pohja.sietorajaM ?? 100),
});

export const Kierrospohjat = ({ kohde, pohjat, saaMuokata, onTallennettu, onTakaisin }: Props) => {
  const [luonnos, setLuonnos] = useState<Luonnos | null>(null);
  const [uusiPiste, setUusiPiste] = useState('');
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tallentaa, setTallentaa] = useState(false);
  const [tulostaa, setTulostaa] = useState<string | null>(null);

  const omat = pohjat.filter((p) => p.ownerId === kohde.id && p.kind === 'patrol');
  const kaytossa = omat.filter((p) => !p.arkistoitu);
  const arkistoidut = omat.filter((p) => p.arkistoitu);

  const lisaaPiste = () => {
    const nimi = uusiPiste.trim();
    if (!nimi || !luonnos) return;
    setLuonnos({
      ...luonnos,
      pisteet: [...luonnos.pisteet, { id: uusiId(), nimi, jarjestys: luonnos.pisteet.length, gps: null }],
    });
    setUusiPiste('');
  };

  const siirra = (indeksi: number, suunta: -1 | 1) => {
    if (!luonnos) return;
    const kohdeIndeksi = indeksi + suunta;
    if (kohdeIndeksi < 0 || kohdeIndeksi >= luonnos.pisteet.length) return;
    const pisteet = [...luonnos.pisteet];
    [pisteet[indeksi], pisteet[kohdeIndeksi]] = [pisteet[kohdeIndeksi], pisteet[indeksi]];
    setLuonnos({ ...luonnos, pisteet: pisteet.map((p, i) => ({ ...p, jarjestys: i })) });
  };

  // Pisteen sijainti luetaan puhelimen paikannuksesta silloin kun ollaan pisteellä.
  // Käsin syötettävä koordinaatti olisi teoriassa tarkempi mutta käytännössä
  // kirjoitusvirhe: kukaan ei näppäile 61.494012 oikein kentällä.
  const merkitseSijainti = (pisteId: string) => {
    if (!navigator.geolocation) {
      setVirhe('Selain ei tue paikannusta.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (sijainti) => {
        setLuonnos((edellinen) => (edellinen ? {
          ...edellinen,
          pisteet: edellinen.pisteet.map((p) => (p.id === pisteId
            ? { ...p, gps: { lat: sijainti.coords.latitude, lon: sijainti.coords.longitude } }
            : p)),
        } : edellinen));
      },
      () => setVirhe('Sijaintia ei saatu. Tarkista paikannuslupa.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const tallenna = async () => {
    if (!luonnos) return;
    setVirhe(null);
    setTallentaa(true);
    try {
      const runko = {
        kind: 'patrol',
        ownerId: kohde.id,
        nimi: luonnos.nimi,
        kuvaus: luonnos.kuvaus,
        pisteet: luonnos.pisteet,
        sijaintiPakotus: luonnos.sijaintiPakotus,
        sietorajaM: Number(luonnos.sietorajaM) || 100,
      };
      const res = await fetch(luonnos.id ? `/api/pohjat/${encodeURIComponent(luonnos.id)}` : '/api/pohjat', {
        method: luonnos.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(runko),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setLuonnos(null);
        onTallennettu();
      } else {
        setVirhe(data?.error || 'Pohjan tallennus epäonnistui.');
      }
    } catch {
      setVirhe('Pohjan tallennus epäonnistui: ei yhteyttä palvelimeen.');
    } finally {
      setTallentaa(false);
    }
  };

  const arkistoi = async (pohja: Kierrospohja) => {
    if (!window.confirm(
      `Poistetaanko kierrospohja "${pohja.nimi}" käytöstä? Jo tehdyt kierrokset säilyvät, mutta uusia ei voi enää aloittaa.`
    )) return;
    try {
      const res = await fetch(`/api/pohjat/${encodeURIComponent(pohja.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) onTallennettu();
      else setVirhe(data?.error || 'Poisto käytöstä epäonnistui.');
    } catch {
      setVirhe('Poisto käytöstä epäonnistui: ei yhteyttä palvelimeen.');
    }
  };

  // Tarrat: tokenit haetaan erikseen ja QR-koodit muodostetaan palvelimella. Koodi
  // sisältää osoitteen /guard?piste=<token>, jonka puhelimen oma kamera avaa — selaimeen
  // ei tarvita QR-lukijaa eikä kameralupaa.
  const tulostaTarrat = async (pohja: Kierrospohja) => {
    setVirhe(null);
    setTulostaa(pohja.id);
    try {
      const res = await fetch(`/api/pohjat/${encodeURIComponent(pohja.id)}/tarrat`, { credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setVirhe(data?.error || 'Tarrojen haku epäonnistui.');
        return;
      }
      const tarrat = [];
      for (const piste of data.pisteet) {
        const url = `${window.location.origin}${import.meta.env.BASE_URL}guard?piste=${encodeURIComponent(piste.token)}`;
        const qr = await haeQrKoodi(url);
        if (!qr) {
          setVirhe('QR-koodia ei saatu muodostettua, joten tarroja ei voi tulostaa.');
          return;
        }
        tarrat.push({ nimi: piste.nimi, qrDataUri: qr });
      }
      tulostaDokumentti(tarraDokumentti({ kohdeNimi: kohde.name, pohjaNimi: pohja.nimi, tarrat }));
    } catch {
      setVirhe('Tarrojen haku epäonnistui: ei yhteyttä palvelimeen.');
    } finally {
      setTulostaa(null);
    }
  };

  if (luonnos) {
    return (
      <div className="max-w-3xl">
        <TakaisinLinkki onClick={() => setLuonnos(null)}>Takaisin kierrospohjiin</TakaisinLinkki>

        <div className="bg-surface rounded-xl shadow-sm border border-line-soft p-6 md:p-8">
          <h2 className="text-xl font-bold text-ink-strong mb-1">
            {luonnos.id ? 'Muokkaa kierrospohjaa' : 'Uusi kierrospohja'}
          </h2>
          <p className="text-sm text-ink-muted mb-6 leading-relaxed">
            Tarkistuspisteet kierretään tässä järjestyksessä. Kierrosta ei voi merkitä
            valmiiksi ennen kuin jokainen piste on kuitattu.
          </p>

          {virhe && (
            <p className="mb-6 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
              {virhe}
            </p>
          )}

          <div className="space-y-5">
            <Kentta
              label="Kierroksen nimi"
              arvo={luonnos.nimi}
              onChange={(v) => setLuonnos({ ...luonnos, nimi: v })}
              placeholder="Esimerkiksi: Yökierros"
            />
            <Kentta
              label="Kuvaus (valinnainen)"
              arvo={luonnos.kuvaus}
              onChange={(v) => setLuonnos({ ...luonnos, kuvaus: v })}
              placeholder="Milloin kierretään ja mitä erityisesti tarkkaillaan"
            />

            <div>
              <p className="text-sm font-medium text-ink-strong mb-2">
                Tarkistuspisteet ({luonnos.pisteet.length})
              </p>

              {luonnos.pisteet.length === 0 ? (
                <p className="text-sm text-ink-muted bg-sunken border border-line-soft rounded-lg p-4">
                  Ei vielä pisteitä. Lisää vähintään yksi.
                </p>
              ) : (
                <ol className="space-y-2">
                  {luonnos.pisteet.map((piste, i) => (
                    <li
                      key={piste.id}
                      className="flex items-center gap-2 bg-sunken border border-line-soft rounded-lg px-3 py-2"
                    >
                      <span className="text-xs font-mono text-ink-subtle w-5 shrink-0">{i + 1}.</span>
                      <input
                        type="text"
                        value={piste.nimi}
                        onChange={(e) => setLuonnos({
                          ...luonnos,
                          pisteet: luonnos.pisteet.map((p) => (p.id === piste.id ? { ...p, nimi: e.target.value } : p)),
                        })}
                        className="flex-1 min-w-0 bg-surface border border-line rounded-md px-2 py-1.5 text-sm text-ink"
                      />
                      <button
                        type="button"
                        onClick={() => merkitseSijainti(piste.id)}
                        title={piste.gps
                          ? `Sijainti merkitty: ${piste.gps.lat.toFixed(5)}, ${piste.gps.lon.toFixed(5)}`
                          : 'Merkitse pisteen sijainti (ollessasi paikalla)'}
                        className={`p-1.5 rounded-md transition-colors shrink-0 ${piste.gps ? 'text-success-ink bg-success-soft' : 'text-ink-subtle hover:text-accent hover:bg-surface'}`}
                      >
                        <MapPin size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => siirra(i, -1)}
                        disabled={i === 0}
                        title="Siirrä ylös"
                        className="p-1.5 rounded-md text-ink-subtle hover:text-accent hover:bg-surface disabled:opacity-30 transition-colors shrink-0"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => siirra(i, 1)}
                        disabled={i === luonnos.pisteet.length - 1}
                        title="Siirrä alas"
                        className="p-1.5 rounded-md text-ink-subtle hover:text-accent hover:bg-surface disabled:opacity-30 transition-colors shrink-0"
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLuonnos({
                          ...luonnos,
                          pisteet: luonnos.pisteet.filter((p) => p.id !== piste.id).map((p, j) => ({ ...p, jarjestys: j })),
                        })}
                        title="Poista piste"
                        className="p-1.5 rounded-md text-ink-subtle hover:text-danger hover:bg-danger-soft transition-colors shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={uusiPiste}
                  onChange={(e) => setUusiPiste(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lisaaPiste(); } }}
                  placeholder="Uuden pisteen nimi, esimerkiksi Konehuone"
                  className="flex-1 min-w-0 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink"
                />
                <button
                  type="button"
                  onClick={lisaaPiste}
                  className="inline-flex items-center gap-1.5 bg-sunken hover:bg-line-soft text-ink-body border border-line text-sm font-medium rounded-lg px-4 py-2 transition-colors shrink-0"
                >
                  <Plus size={16} />
                  Lisää piste
                </button>
              </div>
            </div>

            <div className="bg-sunken border border-line-soft rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={luonnos.sijaintiPakotus}
                  onChange={(e) => setLuonnos({ ...luonnos, sijaintiPakotus: e.target.checked })}
                  className="w-5 h-5 rounded mt-0.5 shrink-0"
                />
                <span className="text-sm text-ink-body">
                  <span className="font-medium text-ink-strong">Vaadi sijainti kuittaukseen</span>
                  <span className="block text-xs text-ink-muted mt-1 leading-relaxed">
                    Oletuksena pois. Kuittauksen sijainti tallennetaan aina todisteeksi, mutta
                    pakotus voi estää kuittauksen silloinkin kun vartija on oikeassa paikassa —
                    paikannus on rakennuksen seinustalla epäluotettava. Pakotus ei koske pisteitä
                    joille ei ole merkitty sijaintia.
                  </span>
                </span>
              </label>
              {luonnos.sijaintiPakotus && (
                <div className="mt-3 pl-8">
                  <label className="block text-xs text-ink-muted mb-1">Sietoraja (metriä)</label>
                  <input
                    type="number"
                    min="10"
                    value={luonnos.sietorajaM}
                    onChange={(e) => setLuonnos({ ...luonnos, sietorajaM: e.target.value })}
                    className="w-32 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-line-soft">
            <button
              type="button"
              onClick={() => setLuonnos(null)}
              className="px-5 py-2.5 text-sm font-medium text-ink-body bg-sunken hover:bg-line-soft rounded-lg transition-colors"
            >
              Peruuta
            </button>
            <button
              type="button"
              onClick={tallenna}
              disabled={tallentaa}
              className="px-5 py-2.5 text-sm font-bold text-white bg-accent hover:bg-accent-hover disabled:opacity-60 rounded-lg transition-colors"
            >
              {tallentaa ? 'Tallennetaan…' : 'Tallenna pohja'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin kohteeseen</TakaisinLinkki>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-ink-strong mb-1">Kierrospohjat</h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            {kohde.name} · tarkistuspisteet ja niiden järjestys. Tarrat tulostetaan täältä.
          </p>
        </div>
        {saaMuokata && (
          <button
            type="button"
            onClick={() => { setLuonnos(tyhjaLuonnos()); setVirhe(null); }}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors shrink-0"
          >
            <Plus size={16} />
            Uusi kierrospohja
          </button>
        )}
      </div>

      {virhe && (
        <p className="mb-6 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
          {virhe}
        </p>
      )}

      {kaytossa.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl p-10 text-center">
          <p className="text-sm text-ink-muted">Kohteelle ei ole vielä tehty kierrospohjaa.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {kaytossa.map((pohja) => (
            <div key={pohja.id} className="bg-surface border border-line rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-bold text-ink-strong">{pohja.nimi}</h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {pohja.pisteet.length} tarkistuspistettä · versio {pohja.versio}
                    {pohja.sijaintiPakotus ? ` · sijainti vaaditaan (${pohja.sietorajaM ?? 100} m)` : ''}
                  </p>
                  {pohja.kuvaus && <p className="text-sm text-ink-muted mt-2">{pohja.kuvaus}</p>}
                  <ol className="flex flex-wrap gap-1.5 mt-3">
                    {pohja.pisteet.map((p, i) => (
                      <li
                        key={p.id}
                        className="inline-flex items-center gap-1 text-xs bg-sunken border border-line-soft rounded-md px-2 py-1 text-ink-body"
                      >
                        <span className="text-ink-subtle">{i + 1}.</span>
                        {p.nimi}
                        {p.gps && <MapPin size={11} className="text-success-ink" />}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {saaMuokata && (
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-4 mt-4 border-t border-line-soft">
                  <button
                    type="button"
                    onClick={() => { setLuonnos(luonnosPohjasta(pohja)); setVirhe(null); }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-body hover:text-accent transition-colors"
                  >
                    <Pencil size={14} />
                    Muokkaa
                  </button>
                  <button
                    type="button"
                    onClick={() => tulostaTarrat(pohja)}
                    disabled={tulostaa === pohja.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover disabled:opacity-60 transition-colors"
                  >
                    <Printer size={14} />
                    {tulostaa === pohja.id ? 'Haetaan tarroja…' : 'Tulosta tarrat'}
                  </button>
                  <button
                    type="button"
                    onClick={() => arkistoi(pohja)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-danger transition-colors ml-auto"
                  >
                    <Archive size={14} />
                    Poista käytöstä
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {arkistoidut.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-ink-muted mb-2">Käytöstä poistetut</h3>
          <ul className="space-y-1.5">
            {arkistoidut.map((pohja) => (
              <li
                key={pohja.id}
                className="text-sm text-ink-muted bg-sunken border border-line-soft rounded-lg px-3 py-2"
              >
                {pohja.nimi} · {pohja.pisteet.length} pistettä
                <span className="text-xs text-ink-subtle ml-2">
                  poistettu käytöstä {new Date(pohja.arkistoitu as string).toLocaleDateString('fi-FI')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
