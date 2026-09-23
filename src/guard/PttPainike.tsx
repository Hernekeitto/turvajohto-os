// Yläpalkin PTT-painike työpöytäversiolle (erä 26, jatko 23.9.2026 — käyttäjän pyyntö:
// "Lisätään yläpalkkiin ilmoituskellon viereen radiopuhelin ikoni mistä pääsee
// hallitsemaan PTT asetuksia ja tarkistamaan sen tilan ja viestittelemään.").
//
// TÄMÄ ON TYÖPÖYTÄVERSION PUUTTUVA VASTINE mobiilin PttPalkki.tsx:lle — kiinteä
// alapalkki EI toimi työpöydällä (ei kosketusta, ei samaa tilaa), joten sama tieto
// (kanavat, kuka puhuu, mykistys, viestit) tarjotaan pudotusvalikkona. Käyttää SAMAA
// usePttPalkkia-koukkua kuin mobiili — ei uutta tilaa eikä uutta WS-kytkentää, sama
// jaettu OlmMachine ja sama jaettu soketti (src/shared/kanava.ts on moniliittyjäinen).
//
// TIETOINEN RAJAUS: EI mikrofonin lähetyspainiketta. Käyttäjän oma sanamuoto oli
// "hallita asetuksia, tarkistaa tila, viestitellä" — EI "puhua". Työpöydällä hiiren
// painaminen pohjaan PTT-painalluksena on kömpelöä verrattuna puhelimeen, ja kentällä
// oleva vartija käyttää joko mobiilia tai Jelly Starin fyysistä painiketta. Jos
// työpöydältä puhuminen tarvitaan, se on oma, myöhempi lisäys.
import { useState } from 'react';
import { Radio, Volume2, VolumeX, MessageSquare, ShieldAlert } from 'lucide-react';

import { usePttPalkkia } from './mobiili/kayttoPttPalkkia.ts';
import { chipKanavat, hatakanavat, voiMykistaa, type Kanava } from './mobiili/kanavapalkki.ts';
import { KanavaViestit } from './mobiili/KanavaViestit.tsx';

export const PttPainike = () => {
  const ptt = usePttPalkkia();
  const [auki, setAuki] = useState(false);
  // Minkä kanavan viestiketju on auki, tai null — sama malli kuin PttPalkki.tsx:llä.
  const [viestitAuki, setViestitAuki] = useState<string | null>(null);

  // Ei kirjautunutta käyttäjää (esim. hetkellinen tila latauksen aikana) — ei kanavia
  // eikä siis mitään näytettävää. Sama "hiljainen ei-mitään" kuin PttPalkki.tsx:llä.
  if (!ptt.omaKayttaja) return null;

  const chipit = chipKanavat(ptt.kanavat);
  const hatat = hatakanavat(ptt.kanavat);
  const puhujia = ptt.kanavat.filter((k) => ptt.tilat[k.id]).length;
  const viestikanava = viestitAuki ? ptt.kanavat.find((k) => k.id === viestitAuki) ?? null : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAuki((a) => !a)}
        title={puhujia > 0 ? `${puhujia} kanavalla puhutaan` : 'PTT-kanavat'}
        className="relative w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-ink-on-dark-muted hover:text-ink-on-dark transition-colors"
      >
        <Radio size={16} />
        {puhujia > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-danger animate-pulse" aria-hidden="true" />
        )}
      </button>

      {auki && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAuki(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-surface rounded-xl shadow-xl border border-line py-2 z-50 text-left text-ink">
            <div className="px-4 py-2 border-b border-line-soft">
              <p className="text-sm font-bold text-ink">PTT-kanavat</p>
            </div>

            {ptt.salausVirhe && (
              <p className="px-4 py-2 text-xs text-danger-ink">
                Salauksen alustus epäonnistui: {ptt.salausVirhe} — viestit eivät ole käytettävissä.
              </p>
            )}

            {hatat.length === 0 && chipit.length === 0 ? (
              <p className="px-4 py-6 text-sm text-ink-muted text-center">Ei avoimia kanavia juuri nyt.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-line-soft">
                {hatat.map((k) => (
                  <HataRivi key={k.id} kanava={k} tila={ptt.tilat[k.id]} onViestit={() => setViestitAuki(k.id)} />
                ))}
                {chipit.map((k) => (
                  <KanavaRivi
                    key={k.id}
                    kanava={k}
                    tila={ptt.tilat[k.id]}
                    mykistetty={ptt.mykistetyt.has(k.id)}
                    onMykista={voiMykistaa(k) ? (m: boolean) => ptt.asetaMykistys(k.id, m) : undefined}
                    onViestit={() => setViestitAuki(k.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* fixed-kääre EIKÄ nestattu yllä olevan .relative-elementin sisään: KanavaViestit.tsx
          täyttää `absolute inset-0`:lla lähimmän asemoidun esi-isän, joka olisi muuten tämä
          32x32-painikkeen kääre eikä koko ruutu — sama ratkaisu kuin Halytyskeskus.tsx:n
          KohdeKeskustelu-ikkunalla. */}
      {viestikanava && (
        <div className="fixed inset-0 z-50">
          <KanavaViestit
            machine={ptt.machine}
            omaKayttaja={ptt.omaKayttaja}
            kanava={viestikanava}
            herate={ptt.viestiHerate}
            onLahetaJono={ptt.yritaLahettaaJono}
            onSulje={() => setViestitAuki(null)}
          />
        </div>
      )}
    </div>
  );
};

const KanavaRivi = ({
  kanava, tila, mykistetty, onMykista, onViestit,
}: {
  kanava: Kanava;
  tila: { kayttaja: string; mina: boolean } | undefined;
  mykistetty: boolean;
  onMykista?: (mykistetty: boolean) => void;
  onViestit: () => void;
}) => (
  <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-sunken transition-colors">
    <div className="min-w-0 flex-1 flex items-center gap-2">
      {tila && <span className="w-2 h-2 shrink-0 rounded-full bg-danger animate-pulse" aria-hidden="true" />}
      <div className="min-w-0">
        <p className={`text-sm font-medium truncate ${mykistetty ? 'text-ink-muted' : 'text-ink'}`}>
          {kanava.nimi || kanava.id}
        </p>
        <p className="text-xs text-ink-muted truncate">
          {tila ? (tila.mina ? 'Lähetät' : `Kuuntelet: ${tila.kayttaja}`) : 'Vapaana'}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      {onMykista && (
        <button
          type="button"
          onClick={() => onMykista(!mykistetty)}
          aria-label={mykistetty ? `Poista mykistys: ${kanava.nimi}` : `Mykistä: ${kanava.nimi}`}
          aria-pressed={mykistetty}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-dark hover:text-ink"
        >
          {mykistetty ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      )}
      <button
        type="button"
        onClick={onViestit}
        aria-label={`Viestit: ${kanava.nimi}`}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-dark hover:text-ink"
      >
        <MessageSquare size={15} />
      </button>
    </div>
  </div>
);

const HataRivi = ({
  kanava, tila, onViestit,
}: { kanava: Kanava; tila: { kayttaja: string; mina: boolean } | undefined; onViestit: () => void }) => (
  <div className="flex items-center gap-2 px-4 py-2.5 bg-danger-soft">
    <ShieldAlert size={16} className="text-danger shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold text-danger-ink truncate">{kanava.nimi}</p>
      {/* Kuunneltavan tilan ilmaisin EI ole vaimennettavissa, sama perustelu kuin
          PttPalkki.tsx:n HataElementillä — hätäkanavalle ei tarjota mykistystä. */}
      <p className="text-xs text-ink-muted truncate">
        {tila
          ? (tila.mina ? 'Lähetät' : `Kuuntelet: ${tila.kayttaja}`)
          : kanava.haltePidaHengissa
            ? `Linja pakotettu auki — ${kanava.haltePidaHengissa.kayttaja}`
            : 'Vapaana'}
      </p>
    </div>
    <button
      type="button"
      onClick={onViestit}
      aria-label={`Viestit: ${kanava.nimi}`}
      className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-danger-ink hover:bg-white/30"
    >
      <MessageSquare size={15} />
    </button>
  </div>
);
