// Tapahtumien perustiedot ja niihin liittyvä haku. Erotettu App.tsx:stä: nämä eivät
// koske komponentin tilaan, ja siemendatan paikka on tyyppinsä vieressä (vrt.
// initialEmployees tässä samassa hakemistossa, tyontekijat.ts).

import type { Tapahtuma } from './tyypit';

// Tapahtumat — jaettu perustieto, käytetään sekä tapahtumavalinnassa että
// tapahtumariippumattomassa raporttinäkymässä (nimen näyttämiseen).
// Tämä on vain alkuarvo ensimmäistä latausta varten — todellinen lista tulee
// palvelimelta (ks. `events`-tila) ja "Luo uusi tapahtuma" -lomake lisää siihen.
export const INITIAL_EVENTS: Tapahtuma[] = [
  {
    id: 'fesx',
    name: 'FestivaaliX',
    status: 'Käynnissä',
    statusTone: 'bg-emerald-100 text-emerald-700',
    dates: '11.8.–13.8.2026',
    place: 'Ratinan suvanto, Tampere',
    audience: '14 200 hlö / vrk',
    client: 'Tapahtumatuotanto X Oy',
    accent: 'border-emerald-200 hover:border-emerald-400'
  },
  {
    id: 'feso',
    name: 'FestivaaliÖ',
    status: 'Suunnittelu',
    statusTone: 'bg-slate-200 text-slate-700',
    dates: '5.9.–6.9.2026',
    place: 'Ei vahvistettu',
    audience: 'Arvio puuttuu',
    client: 'Mallitoimeksiantaja',
    accent: 'border-slate-200 hover:border-indigo-400'
  }
];

export function findEventName(eventId: string | null | undefined, eventsList: Tapahtuma[]) {
  // Vanha data ilman eventId-kenttää lasketaan kuuluvaksi FestivaaliX:ään
  // (sama oletus kuin currentEventReports/currentEventCheckedIn-suodatuksessa)
  const id = eventId || 'fesx';
  return eventsList.find(e => e.id === id)?.name || id;
}
