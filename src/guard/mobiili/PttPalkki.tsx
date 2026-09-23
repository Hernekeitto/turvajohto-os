// PTT-kanavapalkki: pysyvä palkki mobiili-GUARDin koko käyttöliittymän yli (erä 26,
// vaihe 5, viipale 5a). Ei oma välilehti — suunnitelman kohta 1: "aina käytettävissä
// kuin radio". Hätäkanava saa oman elementtinsä chip-listan yläpuolelle (kohta 5); se ei
// ole valittavissa lähetyskohteeksi samalla tavalla kuin tavallinen kanava.
//
// PAINA-JA-PIDÄ, EI KERTAPAINALLUS-TOGGLE (suunnitelman kohta 3) — radiokonventio, joka
// mäppäytyy suoraan tulevaan AINA-laitteen fyysiseen nappiin (vaihe 7) ilman
// vuorovaikutusmallin uudelleenmiettimistä. Pointer-tapahtumat eikä erillinen touch/
// mouse-käsittely: sormi voi liukua napin ulkopuolelle kesken painalluksen, ja pointer
// capture pitää ylös-tapahtuman kiinni samassa elementissä vaikka niin kävisi — ilman
// sitä puheenvuoro jäisi auki koska "up" ei koskaan laukeaisi napin päällä.
//
// LÄHETYS ON KYTKETTY (23.9.2026, käyttäjän pyyntö "Siirrytään rakentamaan manuaalinen
// äänenlähetys" sen jälkeen kun kaksipäiväinen bugimetsästys paljasti ettei mikään
// manuaalinen polku ollut koskaan kaapannut ääntä, ks. Obsidian "PTT-äänibugin
// juurisyy"): mic-nappi TÄSSÄ TIEDOSTOSSA tekee yhä VAIN puheenvuoropyynnön
// (onPttDown/onPttUp), mutta kayttoPttPalkkia.ts reagoi myöntymään käynnistämällä
// oikean mikrofonin (src/shared/aanilahetys.ts) — sama kaksivaiheinen malli kuin
// natiivin AaniPuhelu.java:lla. VASTAANOTTO/TOISTO PUUTTUU YHÄ TÄSTÄ TIEDOSTOSTA: guard
// ei kuule TOISTA guardia tämän palkin kautta, vain HÄLKE kuulee (src/guard/halke/
// PttYhteenveto.tsx, aanivastaanotto.ts) — guard-guard-kuuntelu on oma, tekemätön
// tehtävänsä.
//
// ÄÄNEN PRIORITEETTI (päätös vahvistettu 19.9.2026, Obsidian "vaihe 5 -suunnitelma"):
// PTT keskeyttää/duckaa muun äänen aina kun ääni tulee sisään sovelluksen ollessa
// etualalla. EI VIELÄ TOTEUTETTU: yllä mainitusta vastaanoton puutteesta johtuen tässä
// palkissa ei ole mitään sisääntulevaa ääntä jota duckata. Toteutetaan kun guard-guard-
// vastaanotto rakennetaan.
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { OlmMachine } from '@matrix-org/matrix-sdk-crypto-wasm';
import { Mic, MessageSquare, ShieldAlert, Volume2, VolumeX } from 'lucide-react';

import { type Kanava, chipKanavat, hatakanavat, voiMykistaa } from './kanavapalkki.ts';
import type { PuheTilat, KanavaPuheTila } from './puheenvuorotila.ts';
import type { PuheenvuoroHylkays, ViestiHerate } from './kayttoPttPalkkia.ts';
import { KanavaViestit } from './KanavaViestit.tsx';

type Props = {
  kanavat: Kanava[];
  aktiivinenId: string | null;
  onValitseAktiivinen: (id: string) => void;
  tilat: PuheTilat;
  mykistetyt: Set<string>;
  onMykista: (id: string, mykistetty: boolean) => void;
  hylkays: PuheenvuoroHylkays | null;
  // Äänen lähetyksen virhe (mikrofoni evätty tai WebCodecs puuttuu) — eri asia kuin
  // hylkays, joka koskee puheenvuoron epäämistä. Ks. kayttoPttPalkkia.ts:n oma perustelu.
  aaniVirhe: string | null;
  // Oman laitteen salauksen alustuksen virhe — jos tämä on asetettu, mikään PTT-ääni
  // (lähetys eikä vastaanotto) ei voi koskaan toimia, koska laite ei rekisteröitynyt.
  salausVirhe: string | null;
  onPttDown: (kanavaId: string) => void;
  onPttUp: (kanavaId: string) => void;
  machine: OlmMachine | null;
  omaKayttaja: string | null;
  viestiHerate: ViestiHerate;
  onLahetaJono: () => void;
};

export const PttPalkki = ({
  kanavat, aktiivinenId, onValitseAktiivinen, tilat, mykistetyt, onMykista,
  hylkays, aaniVirhe, salausVirhe,
  onPttDown, onPttUp, machine, omaKayttaja, viestiHerate, onLahetaJono,
}: Props) => {
  // Kesken olevan painalluksen kanava-id. Refissä: pointerup voi tulla vaikka props olisi
  // ehtinyt vaihtua (esim. kanavalista päivittyi kesken painalluksen), ja vapautus on
  // silti kohdistettava kanavaan jolla lähetys oikeasti alkoi.
  const painettuId = useRef<string | null>(null);
  // Minkä kanavan viestiketju on auki, tai null. Kanava-id eikä boolean, koska hätä-
  // elementti voi avata viestit ilman että se on koskaan chip-listan "aktiivinen".
  const [viestitAuki, setViestitAuki] = useState<string | null>(null);

  if (kanavat.length === 0) return null;

  const viestikanava = viestitAuki ? kanavat.find((k) => k.id === viestitAuki) ?? null : null;

  const chipit = chipKanavat(kanavat);
  const hatat = hatakanavat(kanavat);
  const aktiivinen = chipit.find((k) => k.id === aktiivinenId) ?? null;
  const aktiivinenTila = aktiivinenId ? tilat[aktiivinenId] : undefined;
  const varattu = Boolean(aktiivinenTila) && !aktiivinenTila?.mina;

  const kasittelePttDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!aktiivinenId || varattu || aktiivinenTila?.mina) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    painettuId.current = aktiivinenId;
    onPttDown(aktiivinenId);
  };

  const kasittelePttUp = () => {
    if (!painettuId.current) return;
    onPttUp(painettuId.current);
    painettuId.current = null;
  };

  let tilaTeksti = 'Vapaana';
  if (aktiivinenTila?.mina) tilaTeksti = `LÄHETÄT: ${aktiivinen?.nimi ?? ''}`;
  else if (aktiivinenTila) tilaTeksti = `Kuuntelet: ${aktiivinenTila.kayttaja}`;

  return (
    <div className="shrink-0 border-t border-white/10 bg-surface-dark text-ink-on-dark px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      {hatat.map((h) => (
        <HataElementti
          key={h.id}
          kanava={h}
          tila={tilat[h.id]}
          onVapauta={() => onPttUp(h.id)}
          onAvaaViestit={() => setViestitAuki(h.id)}
        />
      ))}

      {salausVirhe && (
        <p className="mb-1.5 text-sm text-danger font-medium">
          Salauksen alustus epäonnistui: {salausVirhe} — ääntä ei voi lähettää eikä vastaanottaa.
        </p>
      )}
      {hylkays && (
        <p className="mb-1.5 text-sm text-danger font-medium">
          Kanava varattu{hylkays.kayttaja ? ` — puhuu ${hylkays.kayttaja}` : ''}.
        </p>
      )}
      {aaniVirhe && (
        <p className="mb-1.5 text-sm text-danger font-medium">{aaniVirhe}</p>
      )}

      {chipit.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 -mx-3 px-3">
          {chipit.map((k) => (
            <Chip
              key={k.id}
              kanava={k}
              aktiivinen={k.id === aktiivinenId}
              puhuu={Boolean(tilat[k.id])}
              mykistetty={mykistetyt.has(k.id)}
              onValitse={() => onValitseAktiivinen(k.id)}
              onMykista={voiMykistaa(k) ? (m: boolean) => onMykista(k.id, m) : undefined}
            />
          ))}
        </div>
      )}

      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          disabled={!aktiivinenId}
          onPointerDown={kasittelePttDown}
          onPointerUp={kasittelePttUp}
          onPointerCancel={kasittelePttUp}
          aria-pressed={Boolean(aktiivinenTila?.mina)}
          aria-label={aktiivinenId ? `Puhu kanavalle ${aktiivinen?.nimi ?? ''}` : 'Ei lähetyskohdetta'}
          className={`flex-1 h-16 rounded-xl flex items-center justify-center gap-2 text-base font-bold select-none touch-none transition-colors disabled:opacity-40 ${
            aktiivinenTila?.mina ? 'bg-danger text-white' : 'bg-white/10 active:bg-white/20 text-ink-on-dark-muted'
          }`}
        >
          <Mic size={22} />
          <span className={aktiivinenTila?.mina ? 'text-white' : aktiivinenTila ? 'text-accent-on-dark' : ''}>
            {tilaTeksti}
          </span>
        </button>
        <button
          type="button"
          disabled={!aktiivinenId}
          onClick={() => aktiivinenId && setViestitAuki(aktiivinenId)}
          aria-label={aktiivinen ? `Viestit: ${aktiivinen.nimi}` : 'Ei lähetyskohdetta'}
          className="w-16 h-16 shrink-0 rounded-xl flex items-center justify-center bg-white/10 text-ink-on-dark-muted disabled:opacity-40"
        >
          <MessageSquare size={22} />
        </button>
      </div>

      {viestikanava && (
        <KanavaViestit
          machine={machine}
          omaKayttaja={omaKayttaja}
          kanava={viestikanava}
          herate={viestiHerate}
          onLahetaJono={onLahetaJono}
          onSulje={() => setViestitAuki(null)}
        />
      )}
    </div>
  );
};

const Chip = ({
  kanava, aktiivinen, puhuu, mykistetty, onValitse, onMykista,
}: {
  kanava: Kanava; aktiivinen: boolean; puhuu: boolean; mykistetty: boolean;
  onValitse: () => void; onMykista?: (mykistetty: boolean) => void;
}) => (
  <div className="relative shrink-0">
    <button
      type="button"
      onClick={onValitse}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
        aktiivinen ? 'bg-accent-on-dark text-surface-dark' : 'bg-white/10 text-ink-on-dark-muted'
      } ${mykistetty ? 'opacity-50' : ''}`}
    >
      {puhuu && <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />}
      {kanava.nimi || kanava.id}
    </button>
    {onMykista && (
      <button
        type="button"
        onClick={() => onMykista(!mykistetty)}
        aria-label={mykistetty ? `Poista mykistys: ${kanava.nimi}` : `Mykistä: ${kanava.nimi}`}
        aria-pressed={mykistetty}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface-dark border border-white/20 flex items-center justify-center text-ink-on-dark-muted"
      >
        {mykistetty ? <VolumeX size={11} /> : <Volume2 size={11} />}
      </button>
    )}
  </div>
);

const HataElementti = ({
  kanava, tila, onVapauta, onAvaaViestit,
}: { kanava: Kanava; tila?: KanavaPuheTila; onVapauta: () => void; onAvaaViestit: () => void }) => (
  <div className="mb-2 rounded-xl bg-danger/15 border border-danger/40 px-3 py-2.5 flex items-center gap-2.5">
    <ShieldAlert size={20} className="text-danger shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold text-white truncate">{kanava.nimi}</p>
      {/* Kuunneltavan tilan ilmaisin EI ole vaimennettavissa (suunnitelman kohta 5) —
          kuuma mikrofoni tai HÄLKE:n pakottama linja näkyy aina, riippumatta kanavan
          omasta mykistyksestä (jota tälle tyypille ei edes tarjota, ks. kanavapalkki.ts:
          voiMykistaa). */}
      <p className="text-xs text-ink-on-dark-muted">
        {tila
          ? (tila.mina ? 'Lähetät' : `Kuuntelet: ${tila.kayttaja}`)
          : kanava.haltePidaHengissa
            ? `Linja pakotettu auki — ${kanava.haltePidaHengissa.kayttaja}`
            : 'Vapaana'}
      </p>
    </div>
    <button
      type="button"
      onClick={onAvaaViestit}
      aria-label={`Viestit: ${kanava.nimi}`}
      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
    >
      <MessageSquare size={18} />
    </button>
    {tila?.mina && (
      <button
        type="button"
        onClick={onVapauta}
        className="shrink-0 rounded-lg bg-danger/25 px-2.5 py-1.5 text-xs font-bold text-white"
      >
        Lopeta
      </button>
    )}
  </div>
);
