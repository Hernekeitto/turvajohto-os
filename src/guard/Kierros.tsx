// Kierroksen kulkeminen: aloitus, pisteiden kuittaus ja päättäminen.
//
// Kaikki muutokset menevät palvelimen /api/kierros-reittien kautta — tämä näkymä ei
// kirjoita patrolRuns-kokoelmaa suoraan. Syy on se, että kierroksen säännöt (vajaata ei
// voi sulkea, keskeytys vaatii syyn, kuittaus on peruuttamaton) ovat sen ainoa sisältö:
// jos ne olisivat täällä, ne olisivat kohteliaisuus jonka curl ohittaa.
//
// Näkymä ei siis myöskään piilota "Merkitse valmiiksi" -painiketta silloin kun pisteitä
// puuttuu. Se näyttää mitä puuttuu ja antaa palvelimen sanoa ei — samasta syystä kuin
// tallennuspainikkeet muualla sovelluksessa: painikkeen katoaminen ei kerro käyttäjälle
// mitään, virheteksti kertoo.
import { useEffect, useState } from 'react';
import { Play, Check, MapPin, CircleAlert, Flag, Ban, QrCode } from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { kuunteleJonoa, lisaaJonoon } from '../shared/jono';
import type { Kohde, Kierros as KierrosTietue, Kierrospohja } from './tyypit';

type Props = {
  kohde: Kohde;
  pohjat: Kierrospohja[];
  kierrokset: KierrosTietue[];
  saaKiertaa: boolean;
  // Kierroksen muutokset tulevat palvelimelta valmiina tietueina; juurikomponentti
  // päivittää listansa niillä.
  onPaivita: (kierros: KierrosTietue) => void;
  onTakaisin: () => void;
};

const kello = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
};

const paiva = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fi-FI', {
    day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// Sijainti kuittaukseen. Palautetaan aina — myös null — jottei kuittaus jää tekemättä
// siksi että paikannus ei vastaa: sijainti on todiste, ei ehto (paitsi jos pohjassa on
// pakotus päällä, jolloin palvelin torjuu).
const haeSijainti = (): Promise<{ lat: number; lon: number } | null> =>
  new Promise((valmis) => {
    if (!navigator.geolocation) return valmis(null);
    navigator.geolocation.getCurrentPosition(
      (s) => valmis({ lat: s.coords.latitude, lon: s.coords.longitude }),
      () => valmis(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });

export const Kierros = ({ kohde, pohjat, kierrokset, saaKiertaa, onPaivita, onTakaisin }: Props) => {
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);
  const [keskeytys, setKeskeytys] = useState(false);
  const [syy, setSyy] = useState('');
  const [huomiot, setHuomiot] = useState('');
  const [jono, setJono] = useState<{ tunniste?: string }[]>([]);

  useEffect(() => kuunteleJonoa(setJono), []);

  const omatPohjat = pohjat.filter((p) => p.ownerId === kohde.id && p.kind === 'patrol' && !p.arkistoitu);
  const omatKierrokset = kierrokset.filter((k) => k.siteId === kohde.id);
  const kesken = omatKierrokset.find((k) => k.tila === 'kesken') || null;
  const paattyneet = omatKierrokset
    .filter((k) => k.tila !== 'kesken')
    .sort((a, b) => String(b.paattyi).localeCompare(String(a.paattyi)))
    .slice(0, 10);

  // Kaikki kierroksen toiminnot kulkevat lähtevän jonon kautta. Verkon toimiessa jono
  // lähettää heti ja palauttaa palvelimen vastauksen, joten käyttökokemus on sama kuin
  // suoralla kutsulla. Verkon ollessa poikki toimenpide jää jonoon ja lähtee itsestään
  // kun yhteys palaa.
  //
  // Säännöt (vajaata ei voi sulkea, keskeytys vaatii syyn) pysyvät palvelimella eikä
  // niitä jäljitellä täällä: jonossa oleva toimenpide näytetään "odottaa lähetystä"
  // -tilassa, ja lopullisen sanan sanoo palvelin kun pyyntö menee perille.
  const kutsu = async (polku: string, runko: unknown, kuvaus: string, tunniste?: string) => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = await lisaaJonoon({ polku, runko, kuvaus, tunniste });
      if (tulos.joJonossa) {
        setVirhe('Sama toimenpide odottaa jo lähetystä.');
        return false;
      }
      if (tulos.lahetetty && tulos.vastaus?.kierros) {
        onPaivita(tulos.vastaus.kierros);
        return true;
      }
      // Jonoon jäänyt toimenpide ei ole virhe: JonoTila kertoo tilanteen, ja pisteen
      // kohdalla näkyy "odottaa lähetystä".
      return !tulos.lahetetty;
    } finally {
      setTyoskentelee(false);
    }
  };

  // Kierroksen ALOITUS ei mene jonoon: se luo tietueen jonka id palvelin antaa, eikä
  // sitä voi tehdä verkotta ilman että kaikki sitä seuraavat kuittaukset jäisivät
  // viittaamaan kierrokseen jota ei ole olemassa. Vartija aloittaa kierroksen
  // valvomossa tai portilla ennen kuin lähtee katvealueelle.
  const aloita = async (pohja: Kierrospohja) => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const res = await fetch('/api/kierros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ templateId: pohja.id }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.kierros) { onPaivita(data.kierros); return true; }
      setVirhe(data?.error || 'Kierroksen aloitus epäonnistui.');
      return false;
    } catch {
      setVirhe('Kierroksen aloitus vaatii verkkoyhteyden. Aloita kierros ennen katvealueelle siirtymistä.');
      return false;
    } finally {
      setTyoskentelee(false);
    }
  };

  const kuittaa = async (pisteId: string, nimi: string) => {
    const gps = await haeSijainti();
    await kutsu(
      `/api/kierros/${encodeURIComponent(kesken!.id)}/piste`,
      { pisteId, gps },
      `Kuittaus: ${nimi}`,
      `kierrospiste:${kesken!.id}:${pisteId}`
    );
  };

  const paata = async (tila: 'valmis' | 'keskeytetty') => {
    const onnistui = await kutsu(
      `/api/kierros/${encodeURIComponent(kesken!.id)}/paata`,
      { tila, syy, huomiot },
      tila === 'valmis' ? `Kierros valmis: ${kesken!.templateNimi}` : `Kierros keskeytetty: ${kesken!.templateNimi}`,
      `kierrospaata:${kesken!.id}`
    );
    if (onnistui) { setKeskeytys(false); setSyy(''); setHuomiot(''); }
  };

  // Jonossa odottavat kuittaukset. Luetaan jonosta eikä komponentin tilasta, jotta
  // tieto säilyy sivunlatauksen yli — kentällä puhelin voi sammua kesken kierroksen.
  const odottavat = new Set(
    jono.filter((k) => k.tunniste?.startsWith('kierrospiste:'))
      .map((k) => String(k.tunniste).split(':').pop())
  );

  const kuittaamatta = kesken
    ? kesken.pisteet.filter((p) => !p.kuitattu && !odottavat.has(p.pisteId)).length
    : 0;

  return (
    <div className="max-w-3xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin kohdelistaan</TakaisinLinkki>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-ink-strong mb-1">Kierrokset</h2>
        <p className="text-sm text-ink-muted leading-relaxed">{kohde.name}</p>
      </div>

      {virhe && (
        <p className="mb-6 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
          {virhe}
        </p>
      )}

      {/* --- Kesken oleva kierros --- */}
      {kesken ? (
        <div className="bg-surface border-2 border-accent/40 rounded-xl p-5 md:p-6 mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-bold text-ink-strong">{kesken.templateNimi}</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Aloitettu {kello(kesken.alkoi)} · {kesken.pisteet.length - kuittaamatta}/{kesken.pisteet.length} kuitattu
              </p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-warning-soft text-warning-ink border border-warning/30 shrink-0">
              Kesken
            </span>
          </div>

          <ol className="space-y-2">
            {kesken.pisteet.map((piste, i) => (
              <li
                key={piste.pisteId}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${piste.kuitattu ? 'bg-success-soft border-success/30' : 'bg-sunken border-line-soft'}`}
              >
                <span className="text-xs font-mono text-ink-subtle w-5 shrink-0">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${piste.kuitattu ? 'text-success-ink' : 'text-ink-strong'}`}>
                    {piste.nimi}
                  </p>
                  {piste.kuitattu && (
                    <p className="text-xs text-ink-muted mt-0.5 flex flex-wrap items-center gap-x-2">
                      <span>Kuitattu {kello(piste.kuitattu)}</span>
                      {piste.tapa === 'qr' && (
                        <span className="inline-flex items-center gap-1"><QrCode size={11} />QR</span>
                      )}
                      {typeof piste.etaisyysM === 'number' && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} />
                          {piste.etaisyysM} m pisteestä
                        </span>
                      )}
                    </p>
                  )}
                </div>
                {piste.kuitattu ? (
                  <Check size={18} className="text-success-ink shrink-0" />
                ) : odottavat.has(piste.pisteId) ? (
                  <span className="text-xs text-ink-muted shrink-0">odottaa lähetystä</span>
                ) : saaKiertaa ? (
                  <button
                    type="button"
                    onClick={() => kuittaa(piste.pisteId, piste.nimi)}
                    disabled={tyoskentelee}
                    className="shrink-0 inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-xs font-bold rounded-lg px-3 py-2 transition-colors"
                  >
                    <Check size={14} />
                    Kuittaa
                  </button>
                ) : null}
              </li>
            ))}
          </ol>

          {/* Skannausohje: tämä on se tapa jolla kierros oikeasti tehdään. Käsin
              kuittaus yllä on varakeino silloin kun tarra on irronnut tai likaantunut. */}
          <p className="text-xs text-ink-muted mt-3 flex items-start gap-2">
            <QrCode size={13} className="shrink-0 mt-0.5" />
            Kuittaa pisteet skannaamalla tarra puhelimen kameralla. Käsin kuittausta käytetään
            vain jos tarra on irronnut tai vahingoittunut.
          </p>

          {saaKiertaa && (
            <div className="pt-4 mt-4 border-t border-line-soft">
              {kuittaamatta > 0 && (
                <p className="text-sm text-ink-muted mb-3 flex items-start gap-2">
                  <CircleAlert size={15} className="shrink-0 mt-0.5 text-warning-ink" />
                  {kuittaamatta === 1
                    ? 'Yksi piste on kuittaamatta. Kierrosta ei voi merkitä valmiiksi ennen kuin se on käyty.'
                    : `${kuittaamatta} pistettä on kuittaamatta. Kierrosta ei voi merkitä valmiiksi ennen kuin ne on käyty.`}
                </p>
              )}

              <label className="block mb-3">
                <span className="block text-sm font-medium text-ink-body mb-1">Huomiot kierrokselta (valinnainen)</span>
                <textarea
                  value={huomiot}
                  onChange={(e) => setHuomiot(e.target.value)}
                  rows={2}
                  placeholder="Mitä kierroksella havaittiin"
                  className="w-full rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
                />
              </label>

              {keskeytys && (
                <label className="block mb-3">
                  <span className="block text-sm font-medium text-ink-body mb-1">Keskeytyksen syy</span>
                  <textarea
                    value={syy}
                    onChange={(e) => setSyy(e.target.value)}
                    rows={2}
                    placeholder="Miksi kierros jäi kesken? Esimerkiksi: hälytys tuli kesken kierroksen."
                    className="w-full rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
                  />
                  <span className="block text-xs text-ink-subtle mt-1">
                    Keskeytys on hyväksyttävä lopputulos. Syy on se tieto jonka takia siitä on
                    jälkikäteen hyötyä.
                  </span>
                </label>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => paata('valmis')}
                  disabled={tyoskentelee}
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2.5 transition-colors"
                >
                  <Flag size={16} />
                  Merkitse valmiiksi
                </button>
                {keskeytys ? (
                  <>
                    <button
                      type="button"
                      onClick={() => paata('keskeytetty')}
                      disabled={tyoskentelee}
                      className="inline-flex items-center gap-2 bg-danger hover:opacity-90 disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2.5 transition-colors"
                    >
                      <Ban size={16} />
                      Vahvista keskeytys
                    </button>
                    <button
                      type="button"
                      onClick={() => { setKeskeytys(false); setSyy(''); }}
                      className="text-sm font-medium text-ink-body hover:text-accent px-2 transition-colors"
                    >
                      Peruuta
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setKeskeytys(true)}
                    className="inline-flex items-center gap-2 bg-sunken hover:bg-line-soft text-ink-body border border-line text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
                  >
                    <Ban size={16} />
                    Keskeytä kierros
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* --- Aloitus --- */
        <div className="mb-8">
          <h3 className="text-sm font-medium text-ink-muted mb-2">Aloita kierros</h3>
          {omatPohjat.length === 0 ? (
            <div className="bg-surface border border-line rounded-xl p-8 text-center">
              <p className="text-sm text-ink-muted">
                Kohteelle ei ole tehty kierrospohjaa. Esimies laatii sen Kierrospohjat-näkymässä.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {omatPohjat.map((pohja) => (
                <div
                  key={pohja.id}
                  className="flex items-center justify-between gap-4 bg-surface border border-line rounded-xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink-strong">{pohja.nimi}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {pohja.pisteet.length} tarkistuspistettä
                      {pohja.sijaintiPakotus ? ' · sijainti vaaditaan' : ''}
                    </p>
                  </div>
                  {saaKiertaa && (
                    <button
                      type="button"
                      onClick={() => aloita(pohja)}
                      disabled={tyoskentelee}
                      className="shrink-0 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2.5 transition-colors"
                    >
                      <Play size={16} />
                      Aloita
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- Aiemmat kierrokset --- */}
      {paattyneet.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-ink-muted mb-2">Aiemmat kierrokset</h3>
          <ul className="space-y-2">
            {paattyneet.map((kierros) => {
              const kuitatut = kierros.pisteet.filter((p) => p.kuitattu).length;
              const valmis = kierros.tila === 'valmis';
              return (
                <li key={kierros.id} className="bg-surface border border-line rounded-lg px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-strong">{kierros.templateNimi}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {paiva(kierros.alkoi)}–{kello(kierros.paattyi)} · {kierros.vartija}
                        {' · '}{kuitatut}/{kierros.pisteet.length} pistettä
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold border shrink-0 ${valmis ? 'bg-success-soft text-success-ink border-success/30' : 'bg-neutral-soft text-neutral-ink border-line'}`}>
                      {valmis ? 'Valmis' : 'Keskeytetty'}
                    </span>
                  </div>
                  {kierros.keskeytysSyy && (
                    <p className="text-xs text-ink-muted mt-2">Syy: {kierros.keskeytysSyy}</p>
                  )}
                  {kierros.huomiot && (
                    <p className="text-xs text-ink-muted mt-1">Huomiot: {kierros.huomiot}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
