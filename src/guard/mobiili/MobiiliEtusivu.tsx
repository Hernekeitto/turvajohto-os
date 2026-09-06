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
import { AlertTriangle, ClipboardCheck, Route, Siren, Timer } from 'lucide-react';

import { TYYPPI_LABEL, type Halytys } from '../../shared/halytykset';
import type { Kierros as KierrosTietue, Kierrospohja, Kohde, TehtavaSuoritus } from '../tyypit';

type Props = {
  kohde: Kohde;
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
  kohde, pohjat, kierrokset, halytykset, suoritukset, sallitut,
  onKierros, onTehtavat, onHalytykset,
}: Props) => {
  const omatPohjat = pohjat.filter((p) => p.ownerId === kohde.id && p.kind === 'patrol' && !p.arkistoitu);
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
