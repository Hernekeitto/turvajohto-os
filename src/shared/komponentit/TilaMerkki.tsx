// Kirjauksen käsittelytilan ja vakavuuden merkit. Jaettu: sama tilamalli on
// EVENT-puolen raporteilla ja GUARD-puolen vartijan raporteilla.
//
// Tila puuttuu tarkoituksella niiltä kirjauksilta joita ei käsitellä (sisäänkirjaus,
// sääraportti) — silloin merkkiä ei renderöidä lainkaan, ei "ei tilaa" -merkkiä.

import { Lock } from 'lucide-react';
import { tila as haeTila, VAKAVUUDET } from '../kirjaukset';

const pohja = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap';

export const TilaMerkki = ({ kirjaus }: { kirjaus: any }) => {
  const t = haeTila(kirjaus?.status);
  if (!t) return null;
  return <span className={`${pohja} ${t.luokka}`}>{t.nimi}</span>;
};

export const VakavuusMerkki = ({ kirjaus }: { kirjaus: any }) => {
  const v = VAKAVUUDET[Number(kirjaus?.severity)];
  if (!v) return null;
  return <span className={`${pohja} ${v.luokka}`}>{v.nimi}</span>;
};

// Lukkomerkki kertoo että kirjauksen sisältö on muuttumaton. Näytetään vain kun se on
// totta — merkki jokaisessa rivissä ei kertoisi mitään.
export const LukkoMerkki = ({ teksti = 'Lukittu' }: { teksti?: string }) => (
  <span className={`${pohja} bg-slate-100 text-slate-600 border-slate-200`} title="Sisältö on muuttumaton. Korjaus tehdään korjausmerkintänä.">
    <Lock size={11} />
    {teksti}
  </span>
);
