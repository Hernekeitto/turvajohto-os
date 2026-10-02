// Vartijanäkymän kohdekohtaiset toiminnot (27.9.2026, käyttäjän lista).
//
// Painikkeet avaavat samat näkymät kuin ylläpidon kohdevalikko (GuardApp: avaaToiminto),
// mutta Vartijanäkymässä niistä on riisuttu hallinta: "Siirrä kalustoa pankista",
// "Uusi toimintakortti" ja "Uusi skenaario" eivät näy (ks. GuardApp: vartijanPuolella).
//
// Järjestys on käyttäjän antama. Tehtävät ja kierrokset ovat yhden painikkeen takana
// ("Kohteen tehtävät", 27.9.2026): vartijalle ne ovat samaa työtä. Se ei ole ylläpidon
// kohdevalikon Toiminto, joten sillä on oma tunnisteensa.
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen, ClipboardList, FileText, FolderOpen, KeyRound, ListChecks, Megaphone, NotebookPen, ShieldAlert,
  ShoppingBag,
} from 'lucide-react';

import type { Toiminto } from './tilannekuva';

export type VartijanToiminto = Extract<
  Toiminto,
  'kalusto' | 'tiedotteet' | 'ohjeet' | 'skenaariot' | 'mikro' | 'toimenpide' | 'ilmoitus' | 'anastus' | 'tiedostot'
> | 'kohteen_tehtavat';

const TOIMINNOT: { id: VartijanToiminto; nimi: string; ikoni: LucideIcon }[] = [
  { id: 'kohteen_tehtavat', nimi: 'Kohteen tehtävät', ikoni: ClipboardList },
  { id: 'kalusto', nimi: 'Kalusto', ikoni: KeyRound },
  { id: 'tiedotteet', nimi: 'Tiedotteet', ikoni: Megaphone },
  { id: 'ohjeet', nimi: 'Ohjepankki', ikoni: BookOpen },
  { id: 'skenaariot', nimi: 'Skenaariot', ikoni: ListChecks },
  { id: 'mikro', nimi: 'Mikroraportti', ikoni: NotebookPen },
  { id: 'toimenpide', nimi: 'Vartijan toimenpide', ikoni: FileText },
  { id: 'ilmoitus', nimi: 'Vartijan tapahtumailmoitus', ikoni: ShieldAlert },
  { id: 'anastus', nimi: 'Anastusilmoitus', ikoni: ShoppingBag },
  { id: 'tiedostot', nimi: 'Kohteen tiedostot', ikoni: FolderOpen },
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
