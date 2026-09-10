// Mobiiliversion etusivu: vuoron työ yhtenä korttilistana.
//
// Kortti kerrallaan, koko leveydeltä ja peukalolle mitoitettuna. Etusivu vastaa yhteen
// kysymykseen — mitä minun pitää nyt tehdä — eikä siinä ole navigaatiota muuhun:
// kaikki muu on sivuvalikossa.
//
// KORTIN OIKEASSA REUNASSA OLEVA LUKU. Kesken olevalla kierroksella se on kuluneet
// minuutit, aloittamattomalla tarkistuspisteiden määrä. Molemmissa on lyhyt selite
// numeron alla, koska pelkkä numero kortilla on arvoitus — ja arvoitus kentällä on
// pahempi kuin puuttuva tieto.
import { useState } from 'react';
import { AlertTriangle, ClipboardCheck, Route, Search, Siren, Timer } from 'lucide-react';

import { TYYPPI_LABEL, type Halytys } from '../../shared/halytykset';
import type { Kierros as KierrosTietue, Kierrospohja, Kohde, TehtavaSuoritus } from '../tyypit';

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
  pohjat: Kierrospohja[];
  kierrokset: KierrosTietue[];
  halytykset: Halytys[];
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
  onKierros, onTehtavat, onHalytykset, onLisaaVuoroon,
}: Props) => {
  const [hakemistoAuki, setHakemistoAuki] = useState(false);
  const vuoroon = new Set(vuoronPohjaIdt);
  // Vuoron omat kierrokset ensin. Tämä on erän 17 koko lupaus näkymässä: vartijan ei
  // tarvitse tietää mitä kohteessa ajetaan, vaan se mikä kuuluu juuri tähän vuoroon on
  // ylimpänä. Kohteen muut kierrokset jäävät alle — niitä saa yhä tehdä, mutta ne eivät
  // ole se mitä vuorolta odotetaan.
  const omatPohjat = pohjat
    .filter((p) => p.ownerId === kohde.id && p.kind === 'patrol' && !p.arkistoitu)
    .sort((a, b) => Number(vuoroon.has(b.id)) - Number(vuoroon.has(a.id)));
  const omatKierrokset = kierrokset.filter((k) => k.siteId === kohde.id);
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
    (!sallitut.kierrokset || omatPohjat.length === 0) &&
    (!sallitut.tehtavat || tehtavat.length === 0) &&
    avoimet.length === 0;

  return (
    <div className="space-y-3">
      {/* Lauenneet hälytykset ensimmäisenä ja punaisina. Tämä on tietoinen poikkeama
          luonnoksesta, jossa hälytyskortti oli vihreä ja listan viimeisenä: lauennut
          hälytys on kiireellisin asia ruudulla, ja sen värin on oltava sama kuin muualla
          sovelluksessa — muuten sama tilanne näyttää kahdelta eri asialta. */}
      {sallitut.halytykset && lauenneet.map((h) => (
        <HalytysKortti key={h.id} halytys={h} kohde={kohde} kriittinen onClick={onHalytykset} />
      ))}

      {sallitut.kierrokset && omatPohjat.map((pohja) => {
        const kuuluuVuoroon = vuoroon.has(pohja.id);
        const kesken = omatKierrokset.find((k) => k.templateId === pohja.id && k.tila === 'kesken') || null;
        const viimeisin = omatKierrokset
          .filter((k) => k.templateId === pohja.id && k.tila !== 'kesken')
          .sort((a, b) => String(b.paattyi).localeCompare(String(a.paattyi)))[0];
        const pisteita = kesken ? kesken.pisteet.length : pohja.pisteet.length;
        const kuitattu = kesken ? kesken.pisteet.filter((p) => p.kuitattu).length : 0;
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
              {kuuluuVuoroon && (
                /* Merkintä eikä pelkkä järjestys: lista järjestyy myös sattumalta, eikä
                   vartija voi tietää kumpi se oli. */
                <span className="inline-block mt-1.5 text-sm font-medium text-accent">
                  Kuuluu vuoroon
                </span>
              )}
              <span className="block text-base text-ink-body mt-2">
                {kesken
                  ? `Aloitettu klo ${kello(kesken.alkoi)}`
                  : viimeisin && samaPaiva(viimeisin.paattyi)
                    ? `Tehty tänään klo ${kello(viimeisin.paattyi)}`
                    : 'Ei aloitettu'}
              </span>
              <span className="block text-base text-ink-body mt-1.5">
                {kuitattu}/{pisteita} pistettä tarkastettu
              </span>
            </span>
            <Luku
              arvo={kesken ? minuutteja(kesken.alkoi) : pisteita}
              selite={kesken ? 'min' : 'pistettä'}
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

      {sallitut.halytykset && kaynnissa.map((h) => (
        <HalytysKortti key={h.id} halytys={h} kohde={kohde} kriittinen={false} onClick={onHalytykset} />
      ))}

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
