// Tietokoneelta aloitettu vuoro puhelimessa (27.9.2026).
//
// Tietokone ei voi käynnistää puhelimen natiivipalvelua: se käynnistyy vain puhelimella
// tehdystä eleestä (ks. sovellusvuoro.ts). Siksi "tietokoneella + sovelluksessa"
// aloitettu vuoro tarjoaa liittämistä tässä, kun vartija avaa sovelluksen. Palvelimen
// vuoro on jo olemassa, joten painike ei aloita uutta vuoroa vaan käynnistää saman
// vuoron valvonnan.
//
// "Vain tietokoneella" -vuorosta kerrotaan myös, koska vartija voi silti avata
// sovelluksen. Näkymä näyttää silloin vuoron käynnissä olevalta, mutta puhelin ei valvo.
import { useEffect, useState } from 'react';
import { MonitorSmartphone, Monitor } from 'lucide-react';

import { haeOmaTila, natiiviValvoo } from '../../shared/laitteet';
import { kaynnistaSovelluksessa, onAlustaJollaSovellus } from './sovellusvuoro';
import type { Vuoro } from './vuoro';
import type { VuoronLaitteet } from '../vuorot';

export const LiitaPuhelin = ({ vuoro, laitteet }: { vuoro: Vuoro; laitteet: VuoronLaitteet }) => {
  // null = ei vielä tiedossa. Banneria ei näytetä ennen kuin tiedetään, ettei valvonta
  // jo käy: muuten se välähtäisi jokaisella avauksella jo liitetyssä puhelimessa.
  const [valvoo, setValvoo] = useState<boolean | null>(null);
  const [tulos, setTulos] = useState<'avattu' | 'ei_tavoitettu' | null>(null);

  useEffect(() => {
    if (laitteet !== 'tietokone_sovellus') return undefined;
    let voimassa = true;
    haeOmaTila()
      .then((tila) => { if (voimassa) setValvoo(natiiviValvoo(tila)); })
      .catch(() => { if (voimassa) setValvoo(false); });
    return () => { voimassa = false; };
  }, [laitteet, vuoro.vuoroId]);

  if (laitteet === 'tietokone') {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-lg px-4 py-3 border bg-sunken border-line text-ink-body">
        <Monitor size={18} className="shrink-0 mt-0.5" />
        <p className="text-sm flex-1">
          <strong className="font-semibold">Vuoro on aloitettu vain tietokoneella.</strong>{' '}
          Puhelin ei valvo tätä vuoroa taustalla.
        </p>
      </div>
    );
  }

  if (laitteet !== 'tietokone_sovellus' || valvoo !== false || tulos === 'avattu') return null;

  return (
    <div className="mb-6 rounded-lg px-4 py-3 border bg-warning-soft border-warning/30 text-warning-ink">
      <div className="flex items-start gap-3">
        <MonitorSmartphone size={18} className="shrink-0 mt-0.5" />
        <p className="text-sm flex-1">
          <strong className="font-semibold">Vuoro aloitettiin tietokoneelta.</strong>{' '}
          Liitä tämä puhelin vuoroon, jotta taustavalvonta käynnistyy.
        </p>
      </div>
      {onAlustaJollaSovellus() ? (
        <button
          type="button"
          onClick={() => setTulos(kaynnistaSovelluksessa(vuoro))}
          className="mt-3 w-full bg-accent hover:bg-accent-hover text-white text-base font-medium rounded-lg px-4 py-3 transition-colors"
        >
          Liitä puhelin vuoroon
        </button>
      ) : null}
      {(tulos === 'ei_tavoitettu' || !onAlustaJollaSovellus()) && (
        <p className="text-sm mt-2">
          Tämä on selain eikä asennettu sovellus. Avaa Turvajohto GUARD -sovellus ja liitä
          puhelin vuoroon siellä.
        </p>
      )}
    </div>
  );
};
