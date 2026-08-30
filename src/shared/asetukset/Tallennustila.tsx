import { useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { muotoileTavut } from '../muotoilu';

// Palvelimen levytilan mittari. Jaettu molemmille puolille sellaisenaan: levy on sama
// riippumatta siitä kummalta puolelta asetukset avataan.
//
// Hakee tietonsa itse mountissa eikä propsina, koska mittari on ainoa asia joka niitä
// käyttää — kutsuvan näkymän ei tarvitse tietää /api/storagesta mitään. Reitti on
// palvelimella pääkäyttäjärajattu (server/index.js), joten muille kerrotaan se suoraan
// eikä yritetä hakua josta seuraisi virheilmoituksen näköinen 403.

type Storage = { used: number; free: number; total: number; usedPercent: number };

export const Tallennustila = ({ isAdmin }: { isAdmin: boolean }) => {
  const [tila, setTila] = useState<Storage | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);

  useEffect(() => {
    // Reitti on pääkäyttäjärajattu, joten muille ei edes yritetä: turha 403 näkyisi
    // virheenä vaikka kyse on normaalista oikeusrajauksesta.
    if (!isAdmin) return;
    let peruttu = false;
    fetch('/api/storage', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (peruttu) return;
        if (res && res.ok === true) setTila(res);
        else setVirhe('Tallennustilan lukeminen ei onnistunut.');
      })
      .catch(() => {
        if (!peruttu) setVirhe('Tallennustilan lukeminen ei onnistunut: ei yhteyttä palvelimeen.');
      });
    return () => { peruttu = true; };
  }, [isAdmin]);

  // Mittarin väri kertoo tilanteen ilman että lukua tarvitsee tulkita.
  const mittariVari =
    tila === null
      ? 'bg-line-strong'
      : tila.usedPercent >= 90
        ? 'bg-danger'
        : tila.usedPercent >= 70
          ? 'bg-warning'
          : 'bg-success';

  return (
    <div className="bg-surface rounded-xl border border-line shadow-sm p-6 mb-6">
      <h3 className="text-lg font-bold text-ink flex items-center gap-2">
        <HardDrive size={18} className="text-accent" />
        Tallennustila
      </h3>

      {!isAdmin ? (
        <p className="text-sm text-ink-muted mt-3">
          Palvelimen tallennustila näkyy vain pääkäyttäjälle.
        </p>
      ) : virhe ? (
        <p className="text-sm text-danger mt-3">{virhe}</p>
      ) : !tila ? (
        <p className="text-sm text-ink-muted mt-3">Luetaan tallennustilaa...</p>
      ) : (
        <>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-3xl font-bold text-ink">{tila.usedPercent} %</span>
            <span className="text-sm text-ink-muted">
              {muotoileTavut(tila.used)} / {muotoileTavut(tila.total)} käytössä
            </span>
          </div>
          <div className="mt-3 h-4 w-full bg-sunken rounded-full overflow-hidden">
            <div
              className={mittariVari + ' h-full transition-all'}
              style={{ width: Math.min(100, Math.max(0, tila.usedPercent)) + '%' }}
            />
          </div>
          <div className="mt-3 flex justify-between text-xs text-ink-muted">
            <span>Vapaana {muotoileTavut(tila.free)}</span>
            <span>
              {tila.usedPercent >= 90
                ? 'Tila loppumassa'
                : tila.usedPercent >= 70
                  ? 'Tilaa syytä seurata'
                  : 'Tilaa riittää'}
            </span>
          </div>
          <p className="text-xs text-ink-subtle mt-4">
            Mittari kertoo palvelimen levyn tilanteen: sama levy sisältää käyttöjärjestelmän,
            sovelluksen ja kaiken datan. Levy on salattu, ja siitä otetaan varmuuskopio joka yö
            (säilytys 7 vrk).
          </p>
        </>
      )}
    </div>
  );
};
