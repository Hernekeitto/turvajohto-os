// EVENT-puolen työntekijätiedot: siemendata, sisäänkirjaukset ja kirjausten kommentit.
//
// Työntekijän OMAT tiedot (tyypit, lomakepohja) eivät ole enää täällä vaan jaetussa
// moduulissa src/shared/tyontekijat.ts — työntekijäpankki on yrityksen rekisteri eikä
// tapahtumapuolen oma, ja GUARD lukee samaa tietoa. Tämä tiedosto vie ne edelleen
// eteenpäin, jotta tapahtumapuolen olemassa olevat tuonnit toimivat ennallaan.
//
// Tänne jäi se mikä on aidosti tapahtuman asiaa: rosteri (Checkin) ja kirjausten
// kommentit liittyvät yhteen tapahtumaan, eivät henkilöön.
export {
  emptyEmpForm,
  employeeToFormState,
  onKortti,
} from '../shared/tyontekijat';
export type { Kielitaito, Tyontekija, TyontekijaLomake } from '../shared/tyontekijat';

import { TUNNISTE_ALKU } from '../shared/tunnisteet';
import { splitFullName } from '../shared/nimet';
import { emptyEmpForm, type Tyontekija } from '../shared/tyontekijat';

// --- Siemendata ----------------------------------------------------------------------
//
// Vain ensimmäistä latausta varten: todellinen rekisteri tulee palvelimelta
// (ks. `employees`-tila App.tsx:ssä) samaan tapaan kuin tapahtumat ja raportit.

const mockEmployees = [
  'Korhonen Elli Marja Orvokki',
  'Virtanen Matti Johannes Antero',
  'Mäkinen Kalle Petteri Aleksi',
  'Nieminen Anna Sofia Maria',
  'Lahtinen Oskari Juhani Tapio',
];

export const initialEmployees: Tyontekija[] = mockEmployees.map((name, idx) => ({
  ...emptyEmpForm,
  ...splitFullName(name),
  id: `emp-seed-${idx}`,
  name,
  // Tämän on oltava emptyEmpFormin JÄLKEEN: siinä displayId on null, joka muuten
  // ylikirjoittaisi tässä annetun numeron.
  displayId: TUNNISTE_ALKU + idx,
}));

// --- Sisäänkirjaus -------------------------------------------------------------------

// checkins-kokoelman tietue: tapahtuman työntekijärosteri ja vuoron kuittaukset.
export type Checkin = {
  id: string | number;
  eventId?: string | null;
  name: string;
  // Tapahtumakohtainen nimimerkki, esim. "Ensiapu 1". Sama henkilö voi olla eri
  // tapahtumassa eri roolissa, joten tätä ei voi sitoa käyttäjätunnukseen.
  nickname?: string;
  // employeeId ja displayId sitovat rosteririvin työntekijäpankin tietueeseen, jotta
  // kirjautuneen käyttäjän oma nimimerkki löytyy tästä tapahtumasta (kirjaajanTunniste).
  employeeId?: string;
  displayId?: number | null;
  role?: string;
  vest?: boolean;
  badge?: string;
  headset?: boolean;
  radio?: string;
  checkInDate?: string;
  checkInTime?: string;
  checkOutDate?: string;
  checkOutTime?: string;
  comment?: string;
  checkOutComment?: string;
  status?: string;
  [lisa: string]: unknown;
};

export const initialCheckedInEmployees: Checkin[] = [
  { id: 1, eventId: 'fesx', name: 'Korhonen Elli Marja Orvokki', role: 'Järjestyksenvalvoja', vest: true, badge: '1234', headset: true, radio: 'R-12', checkInDate: '', checkInTime: '10:15', checkOutDate: '', checkOutTime: '', comment: '', checkOutComment: '', status: 'checked_in' },
  { id: 2, eventId: 'fesx', name: 'Virtanen Matti Johannes Antero', role: 'Vartija', vest: false, badge: '5521', headset: false, radio: '', checkInDate: '', checkInTime: '10:22', checkOutDate: '', checkOutTime: '', comment: '', checkOutComment: '', status: 'checked_in' },
  { id: 3, eventId: 'fesx', name: 'Mäkinen Kalle Petteri Aleksi', role: 'Järjestyksenvalvoja', vest: true, badge: '9982', headset: true, radio: 'R-05', checkInDate: '', checkInTime: '10:40', checkOutDate: '', checkOutTime: '', comment: '', checkOutComment: '', status: 'checked_in' },
];

// Sisäänkirjausrivin kommentit listana ({id, text, author, date, time}) — vanha data
// tunsi vain yhden merkkijonokentän (comment), joka näytetään taannehtivasti yhtenä
// "legacy"-kommenttina kunnes se korvautuu uudella listalla.
export type KirjauksenKommentti = { id: string; text: string; author: string; date: string; time: string };

export const getEmpComments = (emp: any): KirjauksenKommentti[] => {
  if (Array.isArray(emp.comments)) return emp.comments;
  if (emp.comment) {
    return [{ id: 'legacy', text: emp.comment, author: '', date: emp.checkInDate || '', time: emp.checkInTime || '' }];
  }
  return [];
};
