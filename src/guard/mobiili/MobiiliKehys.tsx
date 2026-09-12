// Mobiiliversion runko: yläpalkki, sivuvalikko ja pikavalikko.
//
// GUARD-puolen mobiiliversio on oma käyttöliittymänsä eikä kavennettu työpöytänäkymä.
// Ero on siinä mitä kentällä tarvitaan: yksi peukalo, kirkas aurinko ja hansikkaat,
// eikä yhtään näkymää joka olettaa hiirtä. Siksi tässä on oma palkkinsa eikä jaettu
// Ylapalkki — sen kello, nimimerkki ja pudotusvalikot ovat työpöydän tarpeita.
//
// KUVASUHDE 20:9. Puhelimessa kehys täyttää ruudun (100dvh), mutta työpöytäselaimessa
// se piirtyy puhelimen muotoisena kehyksenä. Se ei ole koriste: mobiilinäkymää
// kehitetään ja katselmoidaan tietokoneella, ja ilman kiinteää kuvasuhdetta se näyttäisi
// siellä aivan toiselta kuin laitteessa jolle se on tehty.
//
// Kehyksen ehto on index.css:ssä (.mobiili-kehys) eikä Tailwindin md:-luokissa, koska
// se ei ole pelkkä leveysehto: kehys vaatii MYÖS hiiren (pointer: fine). Puhelin
// vaaka-asennossa on 915 px leveä, ja silloin leveyteen sidottu kehys puristi sovelluksen
// 164 pikselin levyiseksi malliksi keskelle ruutua. Ks. index.css.
import { useEffect, useState, type ReactNode } from 'react';
import { Bell, BellRing, Camera, ChevronRight, LogOut, Menu, Monitor, MoreVertical, Send, TriangleAlert, X } from 'lucide-react';

export type MobiiliIlmoitus = {
  id: string;
  otsikko: string;
  kuvaus?: string;
  taso: 'kriittinen' | 'varoitus' | 'perus';
};

export type MobiiliLinkki = { id: string; label: string };

type Props = {
  otsikko: string;
  // Vuoro näkyy sivuvalikossa. null = vuoroon ei ole kirjauduttu.
  vuoro: { nimi: string; alkoi: string } | null;
  ilmoitukset: MobiiliIlmoitus[];
  onIlmoitus: (id: string) => void;
  linkit: MobiiliLinkki[];
  onLinkki: (id: string) => void;
  // Man-down on KOHTEEN asetus (erä 12), ei tämän valikon kytkin. Valikko näyttää
  // tilan; muuttaminen tapahtuu kohteen tiedoissa hälytyskeskuksen toimesta.
  mandown: boolean;
  mandownMin: number;
  liikelupa: boolean;
  natiivi: boolean;
  onKamera: () => void;
  // null = tunnuksella ei ole oikeutta kirjata toimenpiteitä, jolloin riviä ei näytetä.
  // Valikon rivi joka ei tee mitään on pahempi kuin puuttuva rivi.
  onTilatieto: (() => void) | null;
  onPaataVuoro: (() => void) | null;
  onTyopoyta: () => void;
  onLogout: () => void;
  children: ReactNode;
};

const kellonaika = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
};

export const MobiiliKehys = ({
  otsikko, vuoro, ilmoitukset, onIlmoitus, linkit, onLinkki,
  mandown, mandownMin, liikelupa, natiivi,
  onKamera, onTilatieto, onPaataVuoro, onTyopoyta, onLogout, children,
}: Props) => {
  // Yksi paneeli kerrallaan auki: kolme päällekkäistä paneelia puhelimen ruudulla
  // tarkoittaisi että käyttäjä sulkee niitä sen sijaan että tekisi työtä.
  const [auki, setAuki] = useState<'valikko' | 'pika' | 'ilmoitukset' | null>(null);
  // Selaimen "työpöytäsivusto"-tila. Silloin selain valehtelee leveydestään (ilmoittaa
  // esimerkiksi 980 px vaikka ruutu on 412 px) ja skaalaa koko sivun mahtumaan, jolloin
  // teksti on kolmasosan kokoista ja kaikkea joutuu zoomaamaan.
  //
  // TÄTÄ EI VOI KORJATA TYYLEILLÄ: asetus ohittaa sivun viewport-määrittelyn, eikä sivu
  // voi kytkeä sitä pois. Ainoa mitä sovellus voi tehdä on kertoa mistä on kyse — muuten
  // vika näyttää sovelluksen viasta ja vartija zoomaa koko vuoron.
  const [tyopoytatila, setTyopoytatila] = useState(false);
  const [vihjePiilotettu, setVihjePiilotettu] = useState(false);
  const kriittisia = ilmoitukset.some((i) => i.taso === 'kriittinen');

  const vaihda = (mika: 'valikko' | 'pika' | 'ilmoitukset') =>
    setAuki((edellinen) => (edellinen === mika ? null : mika));

  useEffect(() => {
    try {
      // Kosketuslaite jonka ilmoittama leveys on selvästi ruutua suurempi. Kerroin on
      // väljä (1,4) tarkoituksella: vaaka-asennossa molemmat luvut kasvavat yhtä matkaa,
      // joten se ei laukea siitä että puhelin käännetään.
      const kosketus = window.matchMedia('(pointer: coarse)').matches;
      const ruutu = window.screen?.width || 0;
      setTyopoytatila(kosketus && ruutu > 0 && window.innerWidth > ruutu * 1.4);
    } catch {
      // Jos selain ei kerro ruudun kokoa, vihjettä ei näytetä. Arvaus olisi tässä
      // pahempi kuin vaikeneminen.
    }
  }, []);

  return (
    <div className="mobiili-tausta">
      <div className="mobiili-kehys text-ink">
        {/* --- Yläpalkki --- */}
        <header className="relative z-30 shrink-0 bg-surface-dark text-ink-on-dark flex items-center gap-2 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => vaihda('valikko')}
            aria-label="Valikko"
            aria-expanded={auki === 'valikko'}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            {auki === 'valikko' ? <X size={26} /> : <Menu size={26} />}
          </button>
          <p className="flex-1 min-w-0 truncate text-base font-medium text-ink-on-dark-muted">{otsikko}</p>
          <button
            type="button"
            onClick={() => vaihda('ilmoitukset')}
            aria-label={ilmoitukset.length === 0 ? 'Ei ilmoituksia' : `${ilmoitukset.length} ilmoitusta`}
            className="relative w-11 h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            {ilmoitukset.length > 0
              ? <BellRing size={24} className={kriittisia ? 'text-danger' : 'text-accent-on-dark'} />
              : <Bell size={24} />}
            {ilmoitukset.length > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-danger text-white text-xs font-bold flex items-center justify-center">
                {ilmoitukset.length > 9 ? '9+' : ilmoitukset.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => vaihda('pika')}
            aria-label="Pikavalikko"
            aria-expanded={auki === 'pika'}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <MoreVertical size={24} />
          </button>
        </header>

        {/* --- Ilmoitukset --- */}
        {auki === 'ilmoitukset' && (
          <>
            <button
              type="button"
              aria-label="Sulje ilmoitukset"
              onClick={() => setAuki(null)}
              className="absolute inset-0 z-20 bg-black/30"
            />
            <div className="absolute z-30 left-3 right-3 top-[calc(env(safe-area-inset-top)+3.75rem)] max-h-[60%] overflow-y-auto rounded-xl bg-surface border border-line shadow-xl">
              <p className="px-4 py-3 text-sm font-bold text-ink border-b border-line-soft">Ilmoitukset</p>
              {ilmoitukset.length === 0 ? (
                <p className="px-4 py-6 text-sm text-ink-muted text-center">Ei uusia ilmoituksia.</p>
              ) : (
                <div className="divide-y divide-line-soft">
                  {ilmoitukset.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => { setAuki(null); onIlmoitus(i.id); }}
                      className="w-full text-left px-4 py-3 hover:bg-sunken transition-colors flex items-start gap-3"
                    >
                      <span
                        className={`mt-1.5 w-2.5 h-2.5 shrink-0 rounded-full ${
                          i.taso === 'kriittinen' ? 'bg-danger' : i.taso === 'varoitus' ? 'bg-warning' : 'bg-neutral'
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="block text-base font-medium text-ink">{i.otsikko}</span>
                        {i.kuvaus && <span className="block text-sm text-ink-muted mt-0.5">{i.kuvaus}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* --- Pikavalikko (kolme pistettä) --- */}
        {auki === 'pika' && (
          <>
            <button
              type="button"
              aria-label="Sulje pikavalikko"
              onClick={() => setAuki(null)}
              className="absolute inset-0 z-20 bg-black/30"
            />
            <div className="absolute z-30 right-0 top-[calc(env(safe-area-inset-top)+3.25rem)] w-64 bg-surface-dark text-ink-on-dark shadow-xl rounded-bl-xl overflow-hidden">
              <PikaRivi ikoni={<Camera size={18} />} onClick={() => { setAuki(null); onKamera(); }}>
                Avaa kamera
              </PikaRivi>
              {onTilatieto && (
                <PikaRivi ikoni={<Send size={18} />} onClick={() => { setAuki(null); onTilatieto(); }}>
                  Lähetä tilatieto
                </PikaRivi>
              )}
              <PikaRivi ikoni={<LogOut size={18} />} onClick={() => { setAuki(null); onLogout(); }}>
                Kirjaudu ulos
              </PikaRivi>
            </div>
          </>
        )}

        {/* --- Sivuvalikko --- */}
        {auki === 'valikko' && (
          <div className="absolute inset-0 z-20 flex">
            <div className="w-[72%] max-w-[19rem] bg-surface-dark text-ink-on-dark overflow-y-auto pt-[calc(env(safe-area-inset-top)+4.5rem)] pb-6 px-5">
              {vuoro ? (
                <div className="mb-6">
                  <p className="text-base text-ink-on-dark-muted">Olet kirjautuneena vuoroon:</p>
                  <p className="text-lg font-bold mt-0.5">{vuoro.nimi}</p>
                  <p className="text-sm text-ink-on-dark-muted mt-0.5">Alkoi klo {kellonaika(vuoro.alkoi)}</p>
                </div>
              ) : (
                <p className="mb-6 text-base text-ink-on-dark-muted">Et ole kirjautuneena vuoroon.</p>
              )}

              {/* Man-down: TILA eikä kytkin.

                  Tässä oli 12.9.2026 asti kytkin ja liukusäädin, joilla vartija saattoi
                  kytkeä oman valvontansa pois ja säätää sen rajan. Man-down on kuitenkin
                  työnantajan turvallisuusasetus eikä työntekijän valinta, joten se
                  siirtyi kohteen tietueeseen palvelimelle.

                  Tila NÄYTETÄÄN silti, ja se on tärkeämpää kuin kytkin oli: vartijan on
                  tiedettävä valvotaanko häntä nyt vai ei. Tyhjä kohta valikossa olisi
                  sama kuin arvaus. */}
              <div className="mb-6 border-t border-white/10 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-medium">Man-down</span>
                  <span className={`text-base font-bold ${mandown ? 'text-success' : 'text-ink-on-dark-muted'}`}>
                    {mandown ? `käytössä, ${mandownMin} min` : 'ei käytössä'}
                  </span>
                </div>
                {mandown && natiivi && (
                  <p className="text-sm text-ink-on-dark-muted mt-2 leading-relaxed">
                    Puhelinsovellus valvoo. Selain ei toista sitä.
                  </p>
                )}
                {mandown && !natiivi && !liikelupa && (
                  <p className="text-sm text-warning mt-2 leading-relaxed">
                    Selain ei ole saanut lupaa liikeantureihin. Valvonta ei ole päällä
                    ennen kuin annat luvan Hälytykset-näkymässä.
                  </p>
                )}
                <p className="text-xs text-ink-on-dark-muted mt-2 leading-relaxed">
                  Asetuksen tekee hälytyskeskus kohteen tiedoissa. Isku ja sitä seuraava
                  liikkumattomuus kysyvät aina, kun valvonta on käytössä.
                </p>
              </div>

              <nav className="border-t border-white/10 pt-3">
                {linkit.map((linkki) => (
                  <button
                    key={linkki.id}
                    type="button"
                    onClick={() => { setAuki(null); onLinkki(linkki.id); }}
                    className="w-full flex items-center justify-between gap-2 py-3 text-left text-base hover:text-accent-on-dark transition-colors"
                  >
                    {linkki.label}
                    <ChevronRight size={16} className="text-ink-on-dark-muted shrink-0" />
                  </button>
                ))}
              </nav>

              <div className="border-t border-white/10 mt-3 pt-3">
                {onPaataVuoro && (
                  <button
                    type="button"
                    onClick={() => { setAuki(null); onPaataVuoro(); }}
                    className="w-full py-3 text-left text-base text-warning hover:brightness-110 transition-all"
                  >
                    Päätä vuoro
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setAuki(null); onTyopoyta(); }}
                  className="w-full flex items-center gap-2 py-3 text-left text-base text-ink-on-dark-muted hover:text-ink-on-dark transition-colors"
                >
                  <Monitor size={16} />
                  Vaihda työpöytäversioon
                </button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Sulje valikko"
              onClick={() => setAuki(null)}
              className="flex-1 bg-black/40"
            />
          </div>
        )}

        {tyopoytatila && !vihjePiilotettu && (
          <div className="shrink-0 flex items-start gap-2 bg-warning-soft border-b border-warning/30 px-4 py-2.5">
            <TriangleAlert size={16} className="text-warning-ink shrink-0 mt-0.5" />
            <p className="flex-1 text-sm text-warning-ink leading-relaxed">
              Selain näyttää sivua työpöytätilassa, joten kaikki on pientä. Poista
              selaimen valikosta valinta <span className="font-bold">Työpöytäsivusto</span>.
            </p>
            <button
              type="button"
              onClick={() => setVihjePiilotettu(true)}
              aria-label="Piilota ilmoitus"
              className="shrink-0 -mt-0.5 -mr-1 w-7 h-7 flex items-center justify-center rounded-md text-warning-ink hover:bg-warning/10 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
    </div>
  );
};

const PikaRivi = ({ ikoni, onClick, children }: { ikoni: ReactNode; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-base hover:bg-white/10 transition-colors"
  >
    <span className="text-ink-on-dark-muted shrink-0">{ikoni}</span>
    {children}
  </button>
);
