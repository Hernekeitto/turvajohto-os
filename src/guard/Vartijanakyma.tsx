// Vartijan tietokonenäkymä. Rakennetaan tyhjästä (27.9.2026): sisältö lisätään osio
// kerrallaan, eikä tänne kopioida ylläpidon näkymiä valmiiksi — silloin vartijalle
// näkyisi taas esimiehen työkaluja, joista osa on vain piilotettu.
//
// Ensimmäinen näkymä on kohteet joihin vartija on perehdytetty, ja niistä aloitetaan
// vuoro. Lista tulee samasta palvelinkyselystä kuin puhelimen vuorovalinta
// (/api/vuorot/omat), joten perehdytys ratkaistaan palvelimella eikä täällä — kohteen
// perehdytyslista on henkilötietoa eikä sitä lähetetä selaimelle.
//
// Vuoron voi aloittaa kahdella tavalla (ks. server/vuorot.js: LAITTEET):
//   Vain tietokoneella              ei taustavalvontaa (sijainti, man-down)
//   Tietokoneella + sovelluksessa   puhelin liitetään samaan vuoroon sovelluksessa
//
// Puhelimeen liitettyä vuoroa EI päätetä täältä. Natiivipalvelu ei kuule palvelimella
// päätetystä vuorosta, joten tietokoneelta päättäminen jättäisi puhelimen seuraamaan
// sijaintia vuoron jälkeen.
import { useCallback, useEffect, useState } from 'react';
import {
  Building2, ChevronDown, ChevronRight, Clock, GraduationCap, Monitor, MonitorSmartphone,
  PlayCircle, StopCircle,
} from 'lucide-react';

import {
  PAAKAYTTAJAN_OHITUS, aloitaVuoroPalvelimella, haeOmaVuoro, haeOmatVuorot, kaikkiKohteina,
  paataVuoroPalvelimella, voiAloittaa,
  type PalvelimenVuoro, type VuoroVaihtoehto, type Vuorokohde, type VuoronLaitteet,
} from './vuorot';
import type { Kohde } from './tyypit';
import { VartijanToiminnot, type VartijanToiminto } from './VartijanToiminnot';

type Aloitustapa = Exclude<VuoronLaitteet, 'sovellus'>;

const TAVAT: { tapa: Aloitustapa; nimi: string; kuvaus: string; Kuvake: typeof Monitor }[] = [
  {
    tapa: 'tietokone_sovellus',
    nimi: 'Tietokoneella + sovelluksessa',
    kuvaus: 'Puhelin liitetään vuoroon sovelluksessa, ja taustavalvonta käynnistyy siellä.',
    Kuvake: MonitorSmartphone,
  },
  {
    tapa: 'tietokone',
    nimi: 'Vain tietokoneella',
    kuvaus: 'Ei taustavalvontaa: sijaintia ja man-downia ei seurata tämän vuoron aikana.',
    Kuvake: Monitor,
  },
];

const LAITETEKSTI: Record<VuoronLaitteet, string> = {
  sovellus: 'Aloitettu puhelimella',
  tietokone: 'Vain tietokoneella',
  tietokone_sovellus: 'Tietokoneella + sovelluksessa',
};

const aikavali = (v: VuoroVaihtoehto) =>
  (v.alkaa && v.paattyy ? `${v.alkaa}–${v.paattyy}` : 'ei kellonaikaa');

const sisalto = (v: VuoroVaihtoehto) => {
  const osat: string[] = [];
  if (v.tehtavia > 0) osat.push(v.tehtavia === 1 ? '1 tehtävä' : `${v.tehtavia} tehtävää`);
  if (v.kierroksia > 0) osat.push(v.kierroksia === 1 ? '1 kierros' : `${v.kierroksia} kierrosta`);
  return osat.length > 0 ? osat.join(' · ') : 'ei tehtäviä eikä kierroksia';
};

type Props = {
  // Kohteiden tiedot, joihin toiminnot kohdistuvat (GuardAppin kohdelista).
  kohdeTiedot: Kohde[];
  // Annetaan vain pääkäyttäjälle (ks. vuorot.ts: kaikkiKohteina).
  kaikkiKohteet?: Kohde[];
  sallitut: Record<VartijanToiminto, boolean>;
  onToiminto: (toiminto: VartijanToiminto, kohde: Kohde) => void;
};

export const Vartijanakyma = ({ kohdeTiedot, kaikkiKohteet, sallitut, onToiminto }: Props) => {
  // undefined = ei vielä haettu tai palvelinta ei tavoitettu, null = ei vuoroa.
  const [vuoro, setVuoro] = useState<PalvelimenVuoro | null | undefined>(undefined);
  const [omatKohteet, setKohteet] = useState<Vuorokohde[]>([]);
  const [ilmanPerehdytysta, setIlmanPerehdytysta] = useState(0);
  const [ladattu, setLadattu] = useState(false);
  const [auki, setAuki] = useState<string | null>(null);
  const [tapa, setTapa] = useState<Aloitustapa>('tietokone_sovellus');
  const [kaynnissa, setKaynnissa] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [paatetaanko, setPaatetaanko] = useState(false);

  const lataa = useCallback(async () => {
    const [oma, omat] = await Promise.all([haeOmaVuoro(), haeOmatVuorot()]);
    setVuoro(oma);
    setKohteet(omat.kohteet);
    setIlmanPerehdytysta(omat.ilmanPerehdytysta);
    setLadattu(true);
  }, []);

  useEffect(() => { void lataa(); }, [lataa]);

  // Toiminnot tarvitsevat koko kohdetietueen. Jos sitä ei ole (kohde ei ole luettavissa),
  // painikkeita ei näytetä — avattava näkymä olisi tyhjä.
  const toiminnot = (siteId: string) => {
    const kohde = kohdeTiedot.find((k) => k.id === siteId);
    if (!kohde) return null;
    return <VartijanToiminnot sallitut={sallitut} onValitse={(t) => onToiminto(t, kohde)} />;
  };

  const kohteet = kaikkiKohteet ? kaikkiKohteina(kaikkiKohteet, omatKohteet) : omatKohteet;

  const aloita = async (siteId: string, v: VuoroVaihtoehto) => {
    setVirhe(null);
    setKaynnissa(true);
    const tulos = await aloitaVuoroPalvelimella(siteId, v.id, tapa, v.ohitus ? PAAKAYTTAJAN_OHITUS : undefined).catch(() => null);
    setKaynnissa(false);
    if (!tulos || !tulos.ok) {
      setVirhe(tulos ? tulos.virhe : 'Vuoroa ei voitu aloittaa: palvelimeen ei saatu yhteyttä.');
      return;
    }
    setVuoro(tulos.vuoro);
  };

  const paata = async () => {
    if (!vuoro) return;
    setKaynnissa(true);
    const ok = await paataVuoroPalvelimella(vuoro.id);
    setKaynnissa(false);
    setPaatetaanko(false);
    if (!ok) {
      setVirhe('Vuoron päättäminen ei onnistunut. Yritä uudelleen.');
      return;
    }
    setAuki(null);
    await lataa();
  };

  if (vuoro) {
    const laitteet = vuoro.laitteet || 'sovellus';
    return (
      <div>
        <h2 className="text-2xl font-bold text-ink-strong mb-1">Vuoro käynnissä</h2>
        <p className="text-sm text-ink-muted mb-6">
          Alkoi {new Date(vuoro.alkoi).toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' })}
        </p>

        {virhe && <Virhe teksti={virhe} />}

        <div className="bg-surface border border-line rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Building2 className="w-6 h-6 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-ink-strong">{vuoro.siteNimi}</p>
              <p className="text-sm text-ink-body mt-0.5">{vuoro.vuorotyyppiNimi}</p>
              <p className="text-sm text-ink-muted mt-3">
                {vuoro.tehtavat.length === 1 ? '1 tehtävä' : `${vuoro.tehtavat.length} tehtävää`}
                {' · '}
                {vuoro.pohjat.length === 1 ? '1 kierros' : `${vuoro.pohjat.length} kierrosta`}
                {' · '}
                {LAITETEKSTI[laitteet]}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-line">
            {laitteet === 'tietokone' ? (
              paatetaanko ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-ink-body flex-1">Päätetäänkö vuoro?</p>
                  <button
                    type="button"
                    onClick={() => setPaatetaanko(false)}
                    className="px-4 py-2 text-sm font-medium text-ink-body bg-sunken hover:bg-line rounded-lg transition-colors"
                  >
                    Peruuta
                  </button>
                  <button
                    type="button"
                    disabled={kaynnissa}
                    onClick={paata}
                    className="px-4 py-2 text-sm font-medium text-white bg-danger hover:brightness-95 rounded-lg transition-colors disabled:opacity-60"
                  >
                    {kaynnissa ? 'Päätetään…' : 'Päätä vuoro'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPaatetaanko(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink-body bg-surface border border-line hover:bg-sunken rounded-lg transition-colors"
                >
                  <StopCircle size={16} />
                  Päätä vuoro
                </button>
              )
            ) : (
              <p className="text-sm text-ink-muted leading-relaxed">
                Tämä vuoro päätetään puhelimen sovelluksessa. Silloin myös taustavalvonta
                loppuu. Tietokoneelta päättäminen jättäisi puhelimen valvomaan vuoron jälkeen.
              </p>
            )}
          </div>
        </div>

        <h3 className="font-bold text-ink-strong mt-8 mb-3">Vuoron toiminnot</h3>
        {toiminnot(vuoro.siteId)}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink-strong mb-1">Kohteet</h2>
      <p className="text-sm text-ink-muted mb-6">
        {kaikkiKohteet
          ? 'Pääkäyttäjänä näet kaikki kohteet. Vuoron voi aloittaa vain niihin vuoroihin, joihin sinut on perehdytetty.'
          : 'Kohteet, joihin sinut on perehdytetty. Valitse kohde ja aloita vuoro.'}
      </p>

      <fieldset className="mb-6">
        <legend className="text-sm font-medium text-ink-strong mb-2">Vuoron aloitus</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {TAVAT.map(({ tapa: t, nimi, kuvaus, Kuvake }) => {
            const valittu = t === tapa;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={valittu}
                onClick={() => setTapa(t)}
                className={`text-left rounded-xl border p-4 flex items-start gap-3 transition-colors ${
                  valittu ? 'border-accent bg-accent/5' : 'border-line bg-surface hover:bg-sunken'
                }`}
              >
                <Kuvake size={20} className={`shrink-0 mt-0.5 ${valittu ? 'text-accent' : 'text-ink-subtle'}`} />
                <span>
                  <span className="block font-bold text-ink-strong">{nimi}</span>
                  <span className="block text-sm text-ink-muted mt-0.5">{kuvaus}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {virhe && <Virhe teksti={virhe} />}

      {kohteet.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl p-10 text-center">
          <Building2 className="w-10 h-10 text-ink-subtle mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-sm text-ink-muted">
            {!ladattu
              ? 'Haetaan kohteita…'
              : vuoro === undefined
                ? 'Palvelimeen ei saatu yhteyttä.'
                : ilmanPerehdytysta > 0
                  ? 'Sinua ei ole perehdytetty yhteenkään vuoroon. Ota yhteys esimieheesi.'
                  : 'Sinulle ei ole merkitty yhtään kohdetta. Ota yhteys esimieheesi.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {kohteet.map((kohde) => {
            const avattu = auki === kohde.siteId;
            const avoimia = kohde.vuorot.filter((v) => v.perehdytetty && v.ikkunassa).length;
            return (
              <div key={kohde.siteId} className="bg-surface border border-line rounded-xl">
                <button
                  type="button"
                  aria-expanded={avattu}
                  onClick={() => setAuki(avattu ? null : kohde.siteId)}
                  className="w-full text-left p-5 flex items-center gap-3 hover:bg-sunken rounded-xl transition-colors"
                >
                  <Building2 className="w-5 h-5 text-accent shrink-0" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink-strong">{kohde.siteNimi}</span>
                    <span className="block text-sm text-ink-muted mt-0.5">
                      {kohde.vuorot.length === 1 ? '1 vuoro' : `${kohde.vuorot.length} vuoroa`}
                      {avoimia > 0 ? ` · ${avoimia} auki nyt` : ''}
                    </span>
                  </span>
                  {avattu
                    ? <ChevronDown size={18} className="text-ink-subtle shrink-0" />
                    : <ChevronRight size={18} className="text-ink-subtle shrink-0" />}
                </button>

                {avattu && (
                  <div className="border-t border-line px-5 py-4 space-y-2">
                    {kohde.vuorot.map((v) => {
                      const aloitettava = voiAloittaa(v);
                      return (
                        <div key={v.id} className="flex items-center gap-4 rounded-lg border border-line px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className={`font-bold ${aloitettava ? 'text-ink-strong' : 'text-ink-muted'}`}>{v.nimi}</p>
                            <p className="text-sm text-ink-muted">{aikavali(v)} · {sisalto(v)}</p>
                            {!v.perehdytetty ? (
                              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                                <GraduationCap size={14} className="shrink-0" />
                                Ei perehdytystä tähän vuoroon{v.ohitus ? ' · pääkäyttäjänä ohitat esteen' : ''}
                              </p>
                            ) : !v.ikkunassa ? (
                              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                                <Clock size={14} className="shrink-0" />
                                Ei vielä auki — hälytyskeskus voi avata sen tarvittaessa{v.ohitus ? ' · pääkäyttäjänä ohitat esteen' : ''}
                              </p>
                            ) : null}
                          </div>
                          {aloitettava && (
                            <button
                              type="button"
                              disabled={kaynnissa}
                              onClick={() => aloita(kohde.siteId, v)}
                              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors disabled:opacity-60 shrink-0"
                            >
                              <PlayCircle size={16} />
                              {kaynnissa ? 'Aloitetaan…' : 'Aloita vuoro'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {toiminnot(kohde.siteId) && (
                      <div className="pt-3">
                        <h3 className="text-sm font-medium text-ink-strong mb-2">Kohteen toiminnot</h3>
                        {toiminnot(kohde.siteId)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Virhe = ({ teksti }: { teksti: string }) => (
  <p className="mb-6 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
    {teksti}
  </p>
);
