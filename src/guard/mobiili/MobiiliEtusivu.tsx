// Mobiiliversion etusivu: vuoron työ yhtenä korttilistana.
//
// Kortti kerrallaan, koko leveydeltä ja peukalolle mitoitettuna. Etusivu vastaa yhteen
// kysymykseen — mitä minun pitää nyt tehdä — eikä siinä ole navigaatiota muuhun:
// kaikki muu on sivuvalikossa.
//
// KORTIN OIKEASSA REUNASSA OLEVA LUKU. Aloittamattomalla kierroksella se on
// tarkistuspisteiden määrä. Kesken olevalla se on kierrospohjaan merkitty suunniteltu
// kesto (Kierrospohjat-hallinnasta), koska sillä on kiinteä ja ennalta tiedetty
// merkitys — ilman merkittyä kestoa näytetään kuluneet minuutit kierroksen alusta, mikä
// unohtuneella kierroksella kasvaa mielettömän suureksi eikä kerro vartijalle mitään
// käyttökelpoista. Molemmissa on lyhyt selite numeron alla, koska pelkkä numero
// kortilla on arvoitus — ja arvoitus kentällä on pahempi kuin puuttuva tieto.
import { useState } from 'react';
import {
  AlertTriangle, ArrowRightLeft, Check, ClipboardCheck, Route, Search, Siren, Timer, X,
} from 'lucide-react';

import { TYYPPI_LABEL, type Halytys } from '../../shared/halytykset';
import type { OmatSiirrot, Siirto } from '../siirrot';
import type { Kierros as KierrosTietue, Kierrospohja, Kohde, TehtavaSuoritus } from '../tyypit';
import type { Halytystehtava } from '../halytystehtavat';
import { TehtavaRivi } from './HalytysTehtava';

type Props = {
  kohde: Kohde;
  // Kesken olevan vuoron kierrospohjien tunnisteet (erä 17). Tyhjä lista tarkoittaa joko
  // vuorotonta tilaa tai vuoroa jossa ei ole kierroksia — kummassakin tapauksessa mitään
  // ei korosteta, mikä on oikea lopputulos molemmille.
  vuoronPohjaIdt: string[];
  vuoronTehtavaIdt: string[];
  // Onko vuoro palvelimella. Hakemisto lisää tehtäviä VUOROON, joten ilman vuoroa sillä
  // ei ole mihin lisätä — eikä painiketta jolla ei ole kohdetta pidä näyttää.
  vuoroKaynnissa: boolean;
  lisataan: boolean;
  lisaysVirhe: string | null;
  onLisaaVuoroon: (laji: 'tehtava' | 'kierros', id: string) => void;
  // Siirrot (erä 18). Vartijan työlista syntyy yhdistämällä vuoron omat tehtävät,
  // hyväksytyt siirrot ja hälytykset — lista on vartijan, vuoro vain kylvää sen.
  siirrot: OmatSiirrot;
  siirtoVastataan: boolean;
  onVastaaSiirtoon: (id: string, hyvaksy: boolean) => void;
  // Pakotetun tehtävän merkitseminen tehdyksi. Avaa lomakkeen, jossa vaadittu raportti
  // kirjoitetaan — vaatimus tulee tehtävästä, ei vartijan valinnasta.
  onTeeSiirto: (siirto: Siirto) => void;
  pohjat: Kierrospohja[];
  kierrokset: KierrosTietue[];
  halytykset: Halytys[];
  // Hälytyskeskuksen antamat keikat (erä 22). ERI ASIA KUIN `halytykset` yllä: ne ovat
  // vartijan omia turvahälytyksiä, nämä ovat työtä joka on tullut ulkoa. Ei oikeusehtoa
  // `sallitut`-oliossa — palvelin on jo päättänyt kenelle lista on tyhjä.
  halytystehtavat: Halytystehtava[];
  kayttaja: string;
  onHalytystehtava: (id: string) => void;
  suoritukset: TehtavaSuoritus[];
  sallitut: { kierrokset: boolean; tehtavat: boolean; halytykset: boolean };
  onKierros: () => void;
  onTehtavat: () => void;
  onHalytykset: () => void;
};

const kello = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
};

const samaPaiva = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const nyt = new Date();
  return d.toDateString() === nyt.toDateString();
};

const minuutteja = (alkoi: string) => {
  const ms = Date.now() - new Date(alkoi).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60000)) : 0;
};

export const MobiiliEtusivu = ({
  kohde, vuoronPohjaIdt, vuoronTehtavaIdt, vuoroKaynnissa, lisataan, lisaysVirhe,
  pohjat, kierrokset, halytykset, suoritukset, sallitut,
  halytystehtavat, kayttaja, onHalytystehtava,
  siirrot, siirtoVastataan, onTeeSiirto,
  onKierros, onTehtavat, onHalytykset, onLisaaVuoroon, onVastaaSiirtoon,
}: Props) => {
  const [hakemistoAuki, setHakemistoAuki] = useState(false);
  const vuoroon = new Set(vuoronPohjaIdt);
  const omatKierrokset = kierrokset.filter((k) => k.siteId === kohde.id);

  // Tänään jo ajetut kierrokset. Kesken oleva EI ole tehty: se on juuri se jota
  // parhaillaan tehdään, ja sen paikka on ylhäällä eikä pohjalla.
  const tehtyTanaan = new Set(
    omatKierrokset
      .filter((k) => k.tila !== 'kesken' && samaPaiva(k.paattyi))
      .map((k) => k.templateId)
  );

  // Listan järjestys (päätös 10.9.2026): hälytykset ensin, sitten vuoron työ, suoritetut
  // viimeisenä. Tässä ratkeaa kaksi jälkimmäistä:
  //
  //   1. tekemättömät ennen tehtyjä — tehty kierros ei ole enää tehtävä
  //   2. vuoron omat ennen kohteen muita — vartijan ei tarvitse tietää mitä kohteessa
  //      ajetaan, vaan se mikä kuuluu tähän vuoroon on ylimpänä
  //
  // HUOM: suoritusaikoja ei ole. Vuorotyypillä on kellonajat, yksittäisellä kierroksella
  // ei, joten "suoritusaikojen mukaan" toteutuu toistaiseksi vuoron määrittelemänä
  // järjestyksenä. Aikakenttä on lisättävä ennen kuin järjestys voi luvata enempää.
  // Ajaton viimeiseksi omassa ryhmässään: se ei ole myöhässä eikä ajallaan, ja tyhjän
  // ajan järjestäminen ykköseksi tai viimeiseksi olisi yhtä mielivaltaista — mutta
  // aikaan sidotut ovat se mitä kello ohjaa, joten ne kuuluvat ylös.
  const aikaJarjestys = (aika?: string) => (aika && /^\d{1,2}:\d{2}$/.test(aika) ? aika : '99:99');

  const omatPohjat = pohjat
    .filter((p) => p.ownerId === kohde.id && p.kind === 'patrol' && !p.arkistoitu)
    .sort((a, b) => (Number(tehtyTanaan.has(a.id)) - Number(tehtyTanaan.has(b.id)))
      || (Number(vuoroon.has(b.id)) - Number(vuoroon.has(a.id)))
      || aikaJarjestys(a.suoritusaika).localeCompare(aikaJarjestys(b.suoritusaika)));
  // Etusivun korttilista näyttää vain vuorolle Vuorot-välilehdellä määritetyt kierrokset
  // (käyttäjän päätös 18.9.2026) — ei koko kohteen kierrospohjia. `omatPohjat` pysyy
  // kohteen täytenä listana, koska hakemisto (alempana) tarjoaa juuri ne jotka TÄSTÄ
  // listasta puuttuvat.
  const vuoronPohjat = omatPohjat.filter((p) => vuoroon.has(p.id));
  const avoimet = halytykset.filter(
    (h) => h.eventId === kohde.id && (h.tila === 'lauennut' || h.tila === 'kaynnissa')
  );
  const lauenneet = avoimet.filter((h) => h.tila === 'lauennut');
  const kaynnissa = avoimet.filter((h) => h.tila === 'kaynnissa');

  // Tehtävät ovat kohteen kenttä, suoritukset oma kokoelmansa. Vuoron tilanne on se
  // montako tämän päivän tehtävää on kuitattu — eilinen kuittaus ei kerro tästä
  // vuorosta mitään.
  const tehtavat = kohde.tehtavat || [];
  // Mitä kohteen hakemistosta voi vielä lisätä vuoroon. Jo vuorossa olevat jäävät pois:
  // "lisää" jonka painaminen ei tee mitään on huonompi kuin puuttuva rivi.
  const vuoronTehtavat = new Set(vuoronTehtavaIdt);
  const lisattavat: { laji: 'tehtava' | 'kierros'; id: string; nimi: string }[] = [
    ...(sallitut.tehtavat ? tehtavat.filter((t) => !vuoronTehtavat.has(t.id))
      .map((t) => ({ laji: 'tehtava' as const, id: t.id, nimi: t.nimi })) : []),
    ...(sallitut.kierrokset ? omatPohjat.filter((p) => !vuoroon.has(p.id))
      .map((p) => ({ laji: 'kierros' as const, id: p.id, nimi: p.nimi })) : []),
  ];
  const kuitatutTanaan = new Set(
    suoritukset
      .filter((s) => s.siteId === kohde.id && samaPaiva(s.aika))
      .map((s) => s.tehtavaId)
  );

  const tyhja =
    halytystehtavat.length === 0 &&
    (!sallitut.kierrokset || vuoronPohjat.length === 0) &&
    (!sallitut.tehtavat || tehtavat.length === 0) &&
    avoimet.length === 0;

  return (
    <div className="space-y-3">
      {/* Hälytystehtävät aivan ylimpänä, myös lauenneiden turvahälytysten yläpuolella.
          Ne ovat ainoa listan kohta jolla on toinen ihminen odottamassa: hälytyskeskus
          on lähettänyt keikan ja odottaa vastausta. Kaikki muu listalla on työtä joka
          on jo vartijan omaa. */}
      {halytystehtavat.map((t) => (
        <TehtavaRivi
          key={t.id}
          tehtava={t}
          kayttaja={kayttaja}
          onClick={() => onHalytystehtava(t.id)}
        />
      ))}

      {/* Lauenneet hälytykset ensimmäisenä ja punaisina. Tämä on tietoinen poikkeama
          luonnoksesta, jossa hälytyskortti oli vihreä ja listan viimeisenä: lauennut
          hälytys on kiireellisin asia ruudulla, ja sen värin on oltava sama kuin muualla
          sovelluksessa — muuten sama tilanne näyttää kahdelta eri asialta. */}
      {sallitut.halytykset && lauenneet.map((h) => (
        <HalytysKortti key={h.id} halytys={h} kohde={kohde} kriittinen onClick={onHalytykset} />
      ))}

      {/* Käynnissä oleva hälytys on hälytystehtävä siinä missä lauennutkin, ja sen paikka
          on muun työn yläpuolella (päätös 10.9.2026). Aiemmin se oli listan pohjalla,
          mikä tarkoitti että kesken oleva hälytystehtävä katosi kierrosten alle. */}
      {sallitut.halytykset && kaynnissa.map((h) => (
        <HalytysKortti key={h.id} halytys={h} kohde={kohde} kriittinen={false} onClick={onHalytykset} />
      ))}

      {/* Saapuvat siirrot: nämä odottavat vastausta, ja toinen vartija odottaa sitä
          myös. Hälytysten jälkeen mutta ennen omaa työtä — vastaaminen kestää sekunnin
          ja vapauttaa toisen suunnittelemaan vuoronsa. */}
      {siirrot.saapuvat.map((siirto) => (
        <div key={siirto.id} className="rounded-xl border border-accent/40 bg-accent-soft p-4">
          <span className="flex items-center gap-2 text-base font-bold text-accent-ink">
            <ArrowRightLeft size={18} className="shrink-0" />
            {siirto.antaja} siirtäisi sinulle
          </span>
          <span className="block text-lg font-bold text-ink-strong mt-2 break-words">{siirto.nimi}</span>
          <span className="block text-base text-ink-body mt-0.5">
            {siirto.siteNimi} · {siirto.laji === 'kierros' ? 'kierros' : 'tehtävä'}
          </span>
          {siirto.viesti && (
            <span className="block text-base text-ink-body mt-2 break-words">”{siirto.viesti}”</span>
          )}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              disabled={siirtoVastataan}
              onClick={() => onVastaaSiirtoon(siirto.id, true)}
              className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-base font-medium rounded-xl px-4 py-3"
            >
              <Check size={18} />
              Otan vastaan
            </button>
            <button
              type="button"
              disabled={siirtoVastataan}
              onClick={() => onVastaaSiirtoon(siirto.id, false)}
              className="flex items-center justify-center gap-2 border border-line-strong disabled:opacity-50 text-ink-body text-base font-medium rounded-xl px-4 py-3"
            >
              <X size={18} />
              En ehdi
            </button>
          </div>
        </div>
      ))}

      {/* Hyväksytyt siirrot ovat omaa työtä, mutta EIVÄT tämän kohteen työtä: siirretty
          kierros voi olla toisessa kohteessa. Siksi kohteen nimi on kortilla — ilman sitä
          vartija ei tietäisi minne mennä. */}
      {siirrot.hyvaksytyt.map((siirto) => (
        <div
          key={siirto.id}
          className={`rounded-xl border p-4 ${
            siirto.tila === 'valmis' ? 'border-success/30 bg-success-soft' : 'border-line bg-surface'
          }`}
        >
          <span className="flex items-center gap-2 text-lg font-bold text-ink-strong">
            <ArrowRightLeft size={18} className="text-accent shrink-0" />
            <span className="min-w-0 break-words">{siirto.nimi}</span>
          </span>
          <span className="block text-base text-ink-body mt-2">
            {siirto.siteNimi}
            {siirto.tapa === 'pakotus'
              ? ` · hälytyskeskuksen antama (${siirto.antaja})`
              : ` · siirretty sinulle (${siirto.antaja})`}
          </span>
          {siirto.viesti && (
            <span className="block text-base text-ink-body mt-1">{siirto.viesti}</span>
          )}

          {/* PAKOTETTU TEHTÄVÄ MERKITÄÄN TEHDYKSI TÄSSÄ (18.9.2026).
              Aiemmin hyväksytty siirto oli pelkkä tiedotekortti: työ näkyi, mutta sitä ei
              voinut kuitata tehdyksi mistään. Päivystäjä ei siis nähnyt tehtiinkö se.

              Raporttivaatimus tulee tehtävästä eikä vartijalta: päivystäjä valitsi sen
              tehtävää antaessaan. Vartija ei voi vaihtaa sitä kevyempään. */}
          {siirto.tila === 'valmis' ? (
            <span className="block text-base font-bold text-success-ink mt-2">
              Merkitty tehdyksi{siirto.raportti?.teksti ? `: ${siirto.raportti.teksti}` : '.'}
            </span>
          ) : siirto.raporttilaji !== undefined && siirto.raporttilaji !== null ? (
            <button
              type="button"
              onClick={() => onTeeSiirto(siirto)}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-accent text-white text-base font-bold rounded-xl px-4 py-3"
            >
              <Check size={18} />
              {siirto.raporttilaji === 'tapahtumailmoitus'
                ? 'Tehty — liitä tapahtumailmoitus'
                : siirto.raporttilaji === 'selvitys'
                  ? 'Tehty — kirjoita selvitys'
                  : 'Merkitse tehdyksi'}
            </button>
          ) : siirto.tapa === 'pakotus' ? (
            <button
              type="button"
              onClick={() => onTeeSiirto(siirto)}
              className="mt-3 w-full flex items-center justify-center gap-2 border border-line-strong text-ink-body text-base font-bold rounded-xl px-4 py-3"
            >
              <Check size={18} />
              Merkitse tehdyksi
            </button>
          ) : null}
        </div>
      ))}

      {sallitut.kierrokset && vuoronPohjat.map((pohja) => {
        const kesken = omatKierrokset.find((k) => k.templateId === pohja.id && k.tila === 'kesken') || null;
        const viimeisin = omatKierrokset
          .filter((k) => k.templateId === pohja.id && k.tila !== 'kesken')
          .sort((a, b) => String(b.paattyi).localeCompare(String(a.paattyi)))[0];
        const pisteita = kesken ? kesken.pisteet.length : pohja.pisteet.length;
        const kuitattu = kesken ? kesken.pisteet.filter((p) => p.kuitattu).length : 0;
        // Siirrä toiselle vartijalle -painike on kierroksen sisäisessä näkymässä
        // (Kierros.tsx), ei täällä (käyttäjän päätös 18.9.2026): kortti on vuoron
        // työlista, ei siirtojen paikka.
        return (
          <button
            key={pohja.id}
            type="button"
            onClick={onKierros}
            className={`w-full text-left rounded-xl border p-4 flex items-start gap-3 transition-colors ${
              kesken
                ? 'bg-accent-soft border-accent/40 hover:brightness-[0.98]'
                : 'bg-surface border-line hover:bg-sunken'
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-lg font-bold text-ink-strong">
                <Route size={18} className="text-accent shrink-0" />
                <span className="min-w-0 break-words">{pohja.nimi}</span>
              </span>
              <span className="block text-base text-ink-body mt-2">
                {kesken
                  ? `Aloitettu klo ${kello(kesken.alkoi)}`
                  : viimeisin && samaPaiva(viimeisin.paattyi)
                    ? `Tehty tänään klo ${kello(viimeisin.paattyi)}`
                    : 'Ei aloitettu'}
              </span>
              {/* Suunniteltu aika on tieto eikä vaatimus: kierroksen voi ajaa muulloinkin,
                  ja poikkeamasta jää merkintä vasta vuoron koosteeseen. */}
              {pohja.suoritusaika && (
                <span className="block text-base text-ink-muted mt-1">
                  Suunniteltu klo {pohja.suoritusaika}
                </span>
              )}
              <span className="block text-base text-ink-body mt-1.5">
                {kuitattu}/{pisteita} pistettä tarkastettu
              </span>
            </span>
            <Luku
              arvo={kesken
                ? (pohja.suunniteltuKestoMin ?? minuutteja(kesken.alkoi))
                : pisteita}
              selite={kesken
                ? (pohja.suunniteltuKestoMin ? 'suunn. min' : 'min')
                : 'pistettä'}
              korostus={!!kesken}
            />
          </button>
        );
      })}

      {sallitut.tehtavat && tehtavat.length > 0 && (
        <button
          type="button"
          onClick={onTehtavat}
          className="w-full text-left rounded-xl border border-line bg-surface hover:bg-sunken p-4 flex items-start gap-3 transition-colors"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-lg font-bold text-ink-strong">
              <ClipboardCheck size={18} className="text-accent shrink-0" />
              Työvuoron tehtävät
            </span>
            <span className="block text-base text-ink-body mt-2">
              {kuitatutTanaan.size}/{tehtavat.length} tehtävää kuitattu tänään
            </span>
          </span>
          <Luku arvo={Math.max(0, tehtavat.length - kuitatutTanaan.size)} selite="jäljellä" />
        </button>
      )}

      {/* Kohteen tehtävähakemisto (erä 17).
          Vuoro kertoo mitä PITÄÄ tehdä; tämä vastaa kysymykseen saanko tehdä myös tämän.
          Jos vain tämä olisi olemassa, oltaisiin nykytilassa jossa vartija etsii kaiken
          itse. Jos vain vuorolista, kukaan ei voisi tehdä ylimääräistä ilman esimiestä.

          Suljettuna oletuksena: etusivu vastaa kysymykseen mitä minun pitää nyt tehdä,
          eikä hakemisto ole se vastaus. */}
      {vuoroKaynnissa && lisattavat.length > 0 && (
        <div className="rounded-xl border border-line bg-surface">
          <button
            type="button"
            onClick={() => setHakemistoAuki(!hakemistoAuki)}
            className="w-full text-left p-4 flex items-center gap-3"
          >
            <Search size={18} className="text-ink-subtle shrink-0" />
            <span className="flex-1 text-base font-medium text-ink-body">
              Lisää vuorooni kohteen hakemistosta
            </span>
            <span className="text-base text-ink-muted shrink-0">
              {hakemistoAuki ? '−' : `+${lisattavat.length}`}
            </span>
          </button>

          {hakemistoAuki && (
            <div className="border-t border-line-soft divide-y divide-line-soft">
              {lisaysVirhe && (
                <p className="px-4 py-3 text-sm text-danger-ink bg-danger-soft">{lisaysVirhe}</p>
              )}
              {lisattavat.map((rivi) => (
                <div key={`${rivi.laji}-${rivi.id}`} className="px-4 py-3 flex items-center gap-3">
                  {rivi.laji === 'kierros'
                    ? <Route size={16} className="text-ink-subtle shrink-0" />
                    : <ClipboardCheck size={16} className="text-ink-subtle shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-base text-ink-body truncate">{rivi.nimi}</span>
                    <span className="block text-sm text-ink-muted">
                      {rivi.laji === 'kierros' ? 'Kierros' : 'Tehtävä'}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={lisataan}
                    onClick={() => onLisaaVuoroon(rivi.laji, rivi.id)}
                    className="shrink-0 text-sm font-medium text-accent hover:underline disabled:opacity-50"
                  >
                    Lisää
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tyhja && (
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <ClipboardCheck className="w-8 h-8 text-ink-subtle mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-base text-ink-muted leading-relaxed">
            Vuorolle ei ole kirjattu kierroksia eikä tehtäviä. Muut toiminnot löytyvät
            vasemman yläkulman valikosta.
          </p>
        </div>
      )}
    </div>
  );
};

// Kortin oikean reunan luku. Ympyrä eikä pelkkä numero: se on kortin ainoa kohta jonka
// näkee vilkaisulla, ja kentällä vilkaisu on usein ainoa mikä ehditään.
const Luku = ({ arvo, selite, korostus = false }: { arvo: number; selite: string; korostus?: boolean }) => (
  <span
    className={`shrink-0 w-16 h-16 rounded-full flex flex-col items-center justify-center leading-none ${
      korostus ? 'bg-surface text-accent-ink' : 'bg-sunken text-ink-strong'
    }`}
  >
    <span className="text-2xl font-bold tabular-nums">{arvo}</span>
    <span className="text-xs font-medium text-ink-muted mt-0.5">{selite}</span>
  </span>
);

const HalytysKortti = ({
  halytys, kohde, kriittinen, onClick,
}: {
  halytys: Halytys;
  kohde: Kohde;
  kriittinen: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left rounded-xl border p-4 transition-colors ${
      kriittinen
        ? 'bg-danger-soft border-danger/50 hover:brightness-[0.98]'
        : 'bg-accent-soft border-accent/40 hover:brightness-[0.98]'
    }`}
  >
    <span className={`flex items-center gap-2 text-lg font-bold ${kriittinen ? 'text-danger-ink' : 'text-accent-ink'}`}>
      {kriittinen ? <Siren size={18} className="shrink-0" /> : <Timer size={18} className="shrink-0" />}
      {TYYPPI_LABEL[halytys.tyyppi].toUpperCase()}
    </span>
    <span className="block text-base text-ink-body mt-2">Kohde: {kohde.name}</span>
    <span className="block text-base text-ink-body mt-1.5">
      Tehtävälle menossa: {halytys.vartija || '—'}
    </span>
    {kriittinen && (
      <span className="mt-3 flex items-center gap-1.5 text-sm font-bold text-danger-ink">
        <AlertTriangle size={13} />
        Avaa hälytys
      </span>
    )}
  </button>
);
