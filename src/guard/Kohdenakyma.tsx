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
  ListChecks, Siren, ShieldAlert, Info, Pencil, Trash2, MapPin, Phone, ChevronRight,
} from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import type { Kiireys, Tiivistelma, Toiminto } from './tilannekuva';
import type { Kohde } from './tyypit';

type Props = {
  kohde: Kohde;
  tiivistelmat: Record<Toiminto, Tiivistelma>;
  // Mitkä toiminnot käyttäjä saa avata. Painike jota ei saa käyttää ei näy lainkaan —
  // sama sääntö kuin ennen kohdekortissa.
  sallitut: Record<Toiminto, boolean>;
  saaMuokata: boolean;
  onValitse: (toiminto: Toiminto) => void;
  onHallitse: () => void;
  onPoista: () => void;
  onTakaisin: () => void;
};

// Painikkeiden järjestys on työjärjestys: ensin se mitä vuorossa tehdään (tehtävät,
// kierros), sitten kohteen kalusto ja seuranta, sitten kirjaaminen. Hälytykset on
// erikseen listan lopussa muttei viimeisenä — se on toiminto jota etsitään kiireessä,
// joten se on omassa korostetussa ryhmässään alla.
const TOIMINNOT: { id: Toiminto; nimi: string; ikoni: LucideIcon }[] = [
  { id: 'tehtavat', nimi: 'Tehtävät', ikoni: ClipboardList },
  { id: 'kierros', nimi: 'Kierros', ikoni: Route },
  { id: 'kalusto', nimi: 'Kalusto', ikoni: KeyRound },
  { id: 'mittaristo', nimi: 'Mittaristo', ikoni: BarChart3 },
  { id: 'jaksoraportit', nimi: 'Jaksoraportit', ikoni: ClipboardList },
  { id: 'tiedotteet', nimi: 'Tiedotteet', ikoni: Megaphone },
  { id: 'ohjeet', nimi: 'Ohjeet', ikoni: BookOpen },
  { id: 'skenaariot', nimi: 'Skenaariot', ikoni: ListChecks },
  { id: 'toimenpide', nimi: 'Toimenpide', ikoni: FileText },
  { id: 'ilmoitus', nimi: 'Tapahtumailmoitus', ikoni: ShieldAlert },
];

// Kohteen ylläpito: pohjien laatiminen, kooste ja perustietojen muokkaus. Erillään
// vuoron toiminnoista, koska tätä tehdään valvomossa eikä kentällä.
const HALLINTA: { id: Toiminto; nimi: string; ikoni: LucideIcon }[] = [
  { id: 'kierrospohjat', nimi: 'Kierrospohjat', ikoni: QrCode },
  { id: 'tiedot', nimi: 'Kohteen tiedot', ikoni: Info },
];

const HUOMION_TYYLI: Record<Kiireys, string> = {
  kriittinen: 'bg-danger-soft text-danger-ink border-danger/40',
  varoitus: 'bg-warning-soft text-warning-ink border-warning/30',
  rauhallinen: 'bg-sunken text-ink-body border-line',
};

export const Kohdenakyma = ({
  kohde, tiivistelmat, sallitut, saaMuokata, onValitse, onHallitse, onPoista, onTakaisin,
}: Props) => {
  const halytys = tiivistelmat.halytykset;
  const naytettavat = TOIMINNOT.filter((t) => sallitut[t.id]);
  const hallinta = HALLINTA.filter((t) => sallitut[t.id]);

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
          className={`w-full text-left flex items-center gap-4 border rounded-xl p-5 mb-4 transition-colors ${
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {naytettavat.map(({ id, nimi, ikoni: Ikoni }) => {
          const tiivistelma = tiivistelmat[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onValitse(id)}
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
          );
        })}
      </div>

      {(hallinta.length > 0 || saaMuokata) && (
        <div className="mt-8 pt-6 border-t border-line-soft">
          <h3 className="text-sm font-bold text-ink-body mb-3">Kohteen hallinta</h3>
          <div className="flex flex-wrap gap-2">
            {hallinta.map(({ id, nimi, ikoni: Ikoni }) => (
              <button
                key={id}
                type="button"
                onClick={() => onValitse(id)}
                title={tiivistelmat[id].teksti}
                className="inline-flex items-center gap-2 bg-surface hover:bg-sunken text-ink-body border border-line text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
              >
                <Ikoni size={16} />
                {nimi}
              </button>
            ))}
            {saaMuokata && (
              <>
                <button
                  type="button"
                  onClick={onHallitse}
                  className="inline-flex items-center gap-2 bg-surface hover:bg-sunken text-ink-body border border-line text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
                >
                  <Pencil size={16} />
                  Muokkaa perustietoja
                </button>
                <button
                  type="button"
                  onClick={onPoista}
                  className="inline-flex items-center gap-2 text-ink-muted hover:text-danger hover:bg-danger-soft border border-line text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
                >
                  <Trash2 size={16} />
                  Poista kohde
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
