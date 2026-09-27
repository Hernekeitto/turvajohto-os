// Vartijanäkymän kohdekohtaiset toiminnot (27.9.2026, käyttäjän lista).
//
// Painikkeet avaavat samat näkymät kuin ylläpidon kohdevalikko (GuardApp: avaaToiminto),
// mutta Vartijanäkymässä niistä on riisuttu hallinta: "Siirrä kalustoa pankista",
// "Uusi toimintakortti" ja "Uusi skenaario" eivät näy (ks. GuardApp: vartijanPuolella).
//
// Järjestys on käyttäjän antama.
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen, FileText, KeyRound, ListChecks, Megaphone, Route, ShieldAlert, ShoppingBag,
} from 'lucide-react';

import type { Toiminto } from './tilannekuva';

export type VartijanToiminto = Extract<
  Toiminto,
  'kierros' | 'kalusto' | 'tiedotteet' | 'ohjeet' | 'skenaariot' | 'toimenpide' | 'ilmoitus'
  | 'anastus'
>;

const TOIMINNOT: { id: VartijanToiminto; nimi: string; ikoni: LucideIcon }[] = [
  { id: 'kierros', nimi: 'Kierros', ikoni: Route },
  { id: 'kalusto', nimi: 'Kalusto', ikoni: KeyRound },
  { id: 'tiedotteet', nimi: 'Tiedotteet', ikoni: Megaphone },
  { id: 'ohjeet', nimi: 'Ohjepankki', ikoni: BookOpen },
  { id: 'skenaariot', nimi: 'Skenaariot', ikoni: ListChecks },
  { id: 'toimenpide', nimi: 'Vartijan toimenpide', ikoni: FileText },
  { id: 'ilmoitus', nimi: 'Vartijan tapahtumailmoitus', ikoni: ShieldAlert },
  { id: 'anastus', nimi: 'Anastusilmoitus', ikoni: ShoppingBag },
];

type Props = {
  sallitut: Record<VartijanToiminto, boolean>;
  onValitse: (toiminto: VartijanToiminto) => void;
};

export const VartijanToiminnot = ({ sallitut, onValitse }: Props) => (
  <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
    {TOIMINNOT.map(({ id, nimi, ikoni: Ikoni }) => {
      if (!sallitut[id]) return null;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onValitse(id)}
          className="text-left rounded-xl border border-line bg-surface hover:bg-sunken hover:border-line-strong p-4 flex flex-col gap-2 transition-colors"
        >
          <Ikoni size={20} className="text-accent" />
          <span className="font-medium text-ink-strong">{nimi}</span>
        </button>
      );
    })}
  </div>
);
