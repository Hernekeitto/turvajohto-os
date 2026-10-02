// Yhden kohteen valikko: mitä tässä kohteessa voi tehdä ja mitä siellä on tehty.
//
// Aiemmin nämä toiminnot olivat pieninä linkkeinä kohdekortin alareunassa, jolloin
// kohdelista oli sitä täydempi mitä enemmän oikeuksia käyttäjällä oli — ja jokainen
// linkki oli pelkkä sana. Nyt kohdelistalla on vain kohteet ja niiden perustiedot, ja
// toiminnot avautuvat kohteen omalle sivulle.
//
// Jokaisen painikkeen alla on tiivistelmä siitä mitä kohteessa on sen osalta tehty
// ("14 kierrosta tehty · viimeisin klo 23.40"). Se ei ole koriste: vuoron alussa
// ensimmäinen kysymys on mitä edellinen vuoro ehti tehdä, ja ilman tätä sen näkee vasta
// avaamalla jokaisen näkymän erikseen. Luvut tulevat tilannekuva.ts:stä.

import type { LucideIcon } from 'lucide-react';
import {
  ClipboardList, Route, QrCode, KeyRound, BarChart3, FileText, Megaphone, BookOpen,
  ListChecks, Siren, ShieldAlert, ShoppingBag, Info, Trash2, MapPin, Phone, ChevronRight,
  Building2, FolderOpen, CalendarClock, GraduationCap, ClipboardCheck, FileStack, NotebookPen,
} from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import type { Kiireys, Tiivistelma, Toiminto } from './tilannekuva';
import type { KohteenOsio } from './KohteenHallinta';
import type { Kohde } from './tyypit';

type Props = {
  kohde: Kohde;
  tiivistelmat: Record<Toiminto, Tiivistelma>;
  // Mitkä toiminnot käyttäjä saa avata. Painike jota ei saa käyttää ei näy lainkaan —
  // sama sääntö kuin ennen kohdekortissa.
  sallitut: Record<Toiminto, boolean>;
  saaMuokata: boolean;
  // Kohteen tiedostojen määrä Tiedostot-painikkeen tiivistelmään.
  tiedostoja: number;
  onValitse: (toiminto: Toiminto) => void;
  // Kohteen muokkaus avataan suoraan pyydettyyn osioon (27.9.2026): osiot ovat omia
  // painikkeitaan eivätkä enää "Muokkaa perustietoja" -näkymän välilehtiä.
  onHallitse: (osio: KohteenOsio) => void;
  onPoista: () => void;
  onTakaisin: () => void;
};

type Painike = {
  id: string;
  nimi: string;
  ikoni: LucideIcon;
  tiivistelma: Tiivistelma;
  onClick: () => void;
};

// Painikkeet on jaettu kahteen ryhmään (käyttäjän päätös 27.9.2026):
//
//   Kohteen ylläpito   vain ylläpidolle: kohteen muokkauksen osiot, pohjat, kooste ja
//                      seuranta. Ylempänä, koska ylläpitonäkymä on esimiehen työkalu.
//   Vuoron toiminnot   samat painikkeet jotka vartija näkee (ks. VartijanToiminnot.tsx),
//                      joten esimies näkee yhdellä silmäyksellä mitä vartijalle näkyy.
//
// Vuoron toimintojen järjestys on työjärjestys: ensin se mitä vuorossa tehdään (tehtävät,
// kierros), sitten kalusto ja tiedot, sitten kirjaaminen.
const YLLAPIDON_TOIMINNOT: { id: Toiminto; nimi: string; ikoni: LucideIcon }[] = [
  { id: 'kierrospohjat', nimi: 'Kierrospohjat', ikoni: QrCode },
  { id: 'raportit', nimi: 'Kohteen raportit', ikoni: FileStack },
  { id: 'tiedot', nimi: 'Kohteen tiedot', ikoni: Info },
  { id: 'mittaristo', nimi: 'Mittaristo', ikoni: BarChart3 },
  { id: 'jaksoraportit', nimi: 'Jaksoraportit', ikoni: ClipboardList },
];

const VUORON_TOIMINNOT: { id: Toiminto; nimi: string; ikoni: LucideIcon }[] = [
  { id: 'tehtavat', nimi: 'Tehtävät', ikoni: ClipboardList },
  { id: 'kierros', nimi: 'Kierros', ikoni: Route },
  { id: 'kalusto', nimi: 'Kalusto', ikoni: KeyRound },
  { id: 'tiedotteet', nimi: 'Tiedotteet', ikoni: Megaphone },
  { id: 'ohjeet', nimi: 'Ohjepankki', ikoni: BookOpen },
  { id: 'skenaariot', nimi: 'Skenaariot', ikoni: ListChecks },
  { id: 'mikro', nimi: 'Mikroraportti', ikoni: NotebookPen },
  { id: 'toimenpide', nimi: 'Vartijan toimenpide', ikoni: FileText },
  { id: 'ilmoitus', nimi: 'Vartijan tapahtumailmoitus', ikoni: ShieldAlert },
  { id: 'anastus', nimi: 'Anastusilmoitus', ikoni: ShoppingBag },
  { id: 'tiedostot', nimi: 'Kohteen tiedostot', ikoni: FolderOpen },
];

const lkm = (maara: number, yksikko: string, monikko: string) =>
  `${maara} ${maara === 1 ? yksikko : monikko}`;

// Kohteen muokkauksen osiot omina painikkeinaan. Tiivistelmä kertoo mitä osiossa jo on,
// samaan tapaan kuin toimintojen painikkeissa.
const muokkausosiot = (kohde: Kohde, tiedostoja: number) => {
  const vuoroja = (kohde.vuorotyypit || []).filter((v) => !v.arkistoitu).length;
  const perehdytyksia = (kohde.perehdytykset || []).length;
  const tehtavia = (kohde.tehtavat || []).length;
  const osiot: { id: KohteenOsio; nimi: string; ikoni: LucideIcon; teksti: string }[] = [
    {
      id: 'perustiedot', nimi: 'Perustiedot', ikoni: Building2,
      teksti: 'Nimi, osoite, yhteystiedot ja kohteen asetukset',
    },
    {
      id: 'tiedostot', nimi: 'Tiedostot', ikoni: FolderOpen,
      teksti: tiedostoja > 0 ? lkm(tiedostoja, 'tiedosto', 'tiedostoa') : 'Ei tiedostoja',
    },
    {
      id: 'vuorot', nimi: 'Vuorot', ikoni: CalendarClock,
      teksti: vuoroja > 0 ? lkm(vuoroja, 'vuoro', 'vuoroa') : 'Ei vuoroja',
    },
    {
      id: 'perehdytys', nimi: 'Perehdytykset', ikoni: GraduationCap,
      teksti: perehdytyksia > 0 ? lkm(perehdytyksia, 'perehdytys', 'perehdytystä') : 'Ei perehdytyksiä',
    },
    {
      id: 'tehtavat', nimi: 'Työvuoron tehtävät', ikoni: ClipboardCheck,
      teksti: tehtavia > 0 ? lkm(tehtavia, 'tehtävä', 'tehtävää') : 'Ei tehtäviä',
    },
  ];
  return osiot;
};

const HUOMION_TYYLI: Record<Kiireys, string> = {
  kriittinen: 'bg-danger-soft text-danger-ink border-danger/40',
  varoitus: 'bg-warning-soft text-warning-ink border-warning/30',
  rauhallinen: 'bg-sunken text-ink-body border-line',
};

const Ryhma = ({ otsikko, kuvaus, painikkeet }: { otsikko: string; kuvaus: string; painikkeet: Painike[] }) => {
  if (painikkeet.length === 0) return null;
  return (
    <section className="mb-8">
      <h3 className="text-sm font-bold text-ink-strong">{otsikko}</h3>
      <p className="text-xs text-ink-muted mb-3">{kuvaus}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {painikkeet.map(({ id, nimi, ikoni: Ikoni, tiivistelma, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            className="text-left bg-surface border border-line hover:bg-sunken hover:border-line-strong rounded-xl p-4 transition-colors flex flex-col"
          >
            <span className="flex items-center gap-2 mb-1.5">
              <Ikoni size={16} className="text-accent shrink-0" />
              <span className="font-bold text-ink-strong flex-1">{nimi}</span>
              {tiivistelma.huomio && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${HUOMION_TYYLI[tiivistelma.huomio.taso]}`}>
                  {tiivistelma.huomio.teksti}
                </span>
              )}
            </span>
            <span className="text-xs text-ink-muted leading-relaxed">{tiivistelma.teksti}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

export const Kohdenakyma = ({
  kohde, tiivistelmat, sallitut, saaMuokata, tiedostoja, onValitse, onHallitse, onPoista, onTakaisin,
}: Props) => {
  const halytys = tiivistelmat.halytykset;
  const toiminnoiksi = (lista: typeof VUORON_TOIMINNOT): Painike[] => lista
    .filter((t) => sallitut[t.id])
    .map((t) => ({ ...t, tiivistelma: tiivistelmat[t.id], onClick: () => onValitse(t.id) }));

  const yllapito: Painike[] = [
    ...(saaMuokata
      ? muokkausosiot(kohde, tiedostoja).map(({ id, nimi, ikoni, teksti }) => ({
        id: `osio-${id}`, nimi, ikoni, tiivistelma: { teksti, huomio: null }, onClick: () => onHallitse(id),
      }))
      : []),
    ...toiminnoiksi(YLLAPIDON_TOIMINNOT),
  ];
  const vuoron = toiminnoiksi(VUORON_TOIMINNOT);

  return (
    <div>
      <TakaisinLinkki onClick={onTakaisin}>Takaisin kohdelistaan</TakaisinLinkki>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-ink-strong mb-2">{kohde.name}</h2>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
          {kohde.address && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} />
              {kohde.address}
            </span>
          )}
          {(kohde.contactName || kohde.contactPhone) && (
            <span className="inline-flex items-center gap-1.5">
              <Phone size={14} />
              {[kohde.contactName, kohde.contactPhone].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        {kohde.notes && <p className="text-sm text-ink-body mt-3 leading-relaxed">{kohde.notes}</p>}
      </div>

      {/* Hälytykset omana painikkeenaan ennen muita. Se on ainoa toiminto jota etsitään
          kiireessä, eikä sen pidä olla yksi ruutu kymmenen joukossa. */}
      {sallitut.halytykset && (
        <button
          type="button"
          onClick={() => onValitse('halytykset')}
          className={`w-full text-left flex items-center gap-4 border rounded-xl p-5 mb-8 transition-colors ${
            halytys.huomio?.taso === 'kriittinen'
              ? 'bg-danger-soft border-danger/50 hover:brightness-95'
              : halytys.huomio
                ? 'bg-warning-soft border-warning/40 hover:brightness-95'
                : 'bg-surface border-line hover:bg-sunken hover:border-line-strong'
          }`}
        >
          <Siren
            size={22}
            className={halytys.huomio?.taso === 'kriittinen' ? 'text-danger-ink' : 'text-accent'}
          />
          <span className="min-w-0 flex-1">
            <span className={`block font-bold ${halytys.huomio?.taso === 'kriittinen' ? 'text-danger-ink' : 'text-ink-strong'}`}>
              Hälytykset
            </span>
            <span className="block text-sm text-ink-muted mt-0.5">{halytys.teksti}</span>
          </span>
          {halytys.huomio && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border shrink-0 ${HUOMION_TYYLI[halytys.huomio.taso]}`}>
              {halytys.huomio.teksti}
            </span>
          )}
          <ChevronRight size={18} className="text-ink-subtle shrink-0" />
        </button>
      )}

      <Ryhma otsikko="Kohteen ylläpito" kuvaus="Näkyy vain ylläpidolle." painikkeet={yllapito} />
      <Ryhma otsikko="Vuoron toiminnot" kuvaus="Näkyvät myös vartijoille." painikkeet={vuoron} />

      {/* Kohteen poisto on ainoa alareunaan jäävä toiminto: se ei ole työtä kohteessa
          vaan koko kohteen hävittäminen, eikä sen pidä olla samannäköinen ruutu kuin
          muut. */}
      {saaMuokata && (
        <div className="pt-6 border-t border-line-soft">
          <button
            type="button"
            onClick={onPoista}
            className="inline-flex items-center gap-2 text-ink-muted hover:text-danger hover:bg-danger-soft border border-line text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            <Trash2 size={16} />
            Poista kohde
          </button>
        </div>
      )}
    </div>
  );
};
