// Jaa-ikkunan valinta: saako jaon saaja vain esikatsella dokumenttia vai myös muokata
// sitä editorissa. Näytetään vain kun valinnalla on merkitystä: editori on käytössä ja
// jaetaan muokattava dokumentti (.odt/.odp) tai kansio, jossa sellaisia voi olla.
// Muut tiedostotyypit voi aina esikatsella, koska esikatselu ei anna mitään mitä
// lataus ei jo antaisi.

import { FilePen, Eye } from 'lucide-react';
import { paate, useEditorinTila, type EditoriOikeus } from '../editori';

type Props = {
  nimi: string;
  kansio?: boolean;
  arvo: EditoriOikeus;
  onMuutos: (arvo: EditoriOikeus) => void;
};

export const EditoriOikeusValinta = ({ nimi, kansio, arvo, onMuutos }: Props) => {
  const tila = useEditorinTila();
  if (!tila?.kaytossa) return null;
  if (!kansio && !tila.muokattavat.includes(paate(nimi))) return null;

  const vaihtoehdot: [EditoriOikeus, string, string, typeof Eye][] = [
    ['katselu', 'Vain esikatselu', 'Saaja voi avata dokumentin editoriin lukemista varten ja ladata sen.', Eye],
    ['muokkaus', 'Esikatselu ja muokkaus', 'Saaja voi tehdä dokumenttiin muutoksia. Muutokset tallentuvat alkuperäiseen tiedostoon.', FilePen],
  ];

  return (
    <div>
      <p className="text-sm font-medium text-ink-body mb-2">Dokumenttieditori</p>
      <div className="space-y-2">
        {vaihtoehdot.map(([v, otsikko, selite, Ikoni]) => (
          <label
            key={v}
            className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
              arvo === v ? 'bg-accent-soft border-accent/40' : 'bg-surface border-line hover:bg-sunken'
            }`}
          >
            <input type="radio" name="editorioikeus" checked={arvo === v} onChange={() => onMuutos(v)} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink-strong">
                <Ikoni size={14} className="shrink-0" />
                {otsikko}
              </span>
              <span className="block text-xs text-ink-muted">{selite}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};
