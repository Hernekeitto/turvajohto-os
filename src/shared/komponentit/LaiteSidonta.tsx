import { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, ShieldCheck, TriangleAlert } from 'lucide-react';

import { onAsennettuSovellus } from '../asennettu';
import { avaaSovellus, haeOmaTila, pyydaKoodi, type Laite } from '../laitteet';

// Laitteen sidonta vartijan omasta näkymästä.
//
// Sidonta on kertaluonteinen toimenpide, joka tehdään kerran puhelinta käyttöön
// otettaessa. Se on tässä näkymässä eikä asetuksissa, koska vartijalla ei ole
// asetusoikeuksia — ja koska tämä on se hetki jolloin puhelin otetaan käyttöön:
// vuoroon kirjautuminen ja laitteen käyttöönotto ovat sama tapahtuma ihmiselle.
//
// --- Miksi tämä ei voi kertoa onko juuri TÄMÄ laite sidottu -------------------------
//
// Selain ei voi kysyä sovellukselta mitään. Se näkee vain sen mitä palvelin tietää:
// onko tunnuksella laite ja mikä sen malli on. Jos vartija näkee tässä toisen puhelimen
// mallin, sidonta on vanhassa laitteessa — ja juuri siksi malli näytetään sen sijaan
// että näytettäisiin pelkkä "sidottu".

// Kuinka kauan sovellukselle annetaan aikaa vastata. Sidonta on yksi verkkopyyntö
// puhelimesta, joten se on nopea — mutta hidas kenttäverkko on tavallinen, eikä
// puolen minuutin odotus ole liikaa kertaluonteisessa toimenpiteessä.
const ODOTUS_MS = 30_000;
const KYSELYVALI_MS = 2000;

const paiva = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fi-FI');
};

export const LaiteSidonta = () => {
  const [laite, setLaite] = useState<Laite | null>(null);
  const [ladattu, setLadattu] = useState(false);
  const [odottaa, setOdottaa] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const ajastimet = useRef<number[]>([]);

  const paivita = useCallback(async () => {
    const tila = await haeOmaTila().catch(() => null);
    if (tila) setLaite(tila.laite);
    setLadattu(true);
    return tila?.sidottu === true;
  }, []);

  useEffect(() => {
    paivita();
    // Ajastimet talteen ja pois purussa: näkymästä poistuminen kesken odotuksen ei saa
    // jättää kyselyä pyörimään taustalle.
    const omat = ajastimet.current;
    return () => { omat.forEach((id) => window.clearTimeout(id)); };
  }, [paivita]);

  const sido = async () => {
    setVirhe(null);
    const tulos = await pyydaKoodi();
    if (!tulos.ok) {
      setVirhe(tulos.virhe);
      return;
    }

    setOdottaa(true);
    avaaSovellus(tulos.koodi);

    // Selain ei saa tietoa siitä onnistuiko sovelluksen kutsu, joten tilaa kysytään
    // palvelimelta kunnes se muuttuu tai aika loppuu. Aikakatkaisu on tärkeä: ilman sitä
    // näkymä jäisi ikuisesti odottamaan sovellusta jota ei ehkä ole asennettu.
    const alkoi = Date.now();
    const kysy = () => {
      const id = window.setTimeout(async () => {
        const valmis = await paivita();
        if (valmis) {
          setOdottaa(false);
          return;
        }
        if (Date.now() - alkoi >= ODOTUS_MS) {
          setOdottaa(false);
          setVirhe('Sovellus ei vastannut. Varmista että GUARD on asennettu tähän puhelimeen.');
          return;
        }
        kysy();
      }, KYSELYVALI_MS);
      ajastimet.current.push(id);
    };
    kysy();
  };

  if (!ladattu) return null;

  return (
    <div className="rounded-xl border border-line bg-surface p-4 mt-6">
      <h3 className="text-base font-bold text-ink flex items-center gap-2">
        {laite ? (
          <ShieldCheck size={18} className="text-success" />
        ) : (
          <Smartphone size={18} className="text-accent" />
        )}
        Laitteen sidonta
      </h3>

      {laite ? (
        <p className="text-sm text-ink-muted mt-2 leading-relaxed">
          Tunnuksellesi on sidottu laite <span className="text-ink font-medium">{laite.malli}</span>
          {laite.sidottu && ` (${paiva(laite.sidottu)})`}. Jos puhelimesi on vaihtunut, pyydä
          hälytyskeskusta nollaamaan sidonta — sen jälkeen voit sitoa uuden laitteen tästä.
        </p>
      ) : !onAsennettuSovellus() ? (
        <p className="text-sm text-ink-muted mt-2 leading-relaxed">
          Laite sidotaan puhelimeen asennetussa GUARD-sovelluksessa. Avaa tämä näkymä
          sovelluksesta, niin painike ilmestyy tähän.
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">
            Sidonta antaa tälle puhelimelle oman avaimen, jolla se tunnistautuu palvelimelle
            myös taustalla. Avain syntyy puhelimen suojattuun laitteistoon eikä sitä voi
            kopioida toiseen laitteeseen.
          </p>
          <button
            type="button"
            onClick={sido}
            disabled={odottaa}
            className="mt-3 w-full rounded-lg bg-accent text-white font-medium px-4 py-3 disabled:opacity-60"
          >
            {odottaa ? 'Odotetaan sovellusta…' : 'Sido tämä laite'}
          </button>
        </>
      )}

      {virhe && (
        <p className="text-sm text-danger mt-3 flex items-start gap-2">
          <TriangleAlert size={16} className="shrink-0 mt-0.5" />
          <span>{virhe}</span>
        </p>
      )}
    </div>
  );
};
