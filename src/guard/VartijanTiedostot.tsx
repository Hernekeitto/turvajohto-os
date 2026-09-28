// Vartijanäkymän kohteen tiedostokansio (28.9.2026): kohteen asiakirjat luettavina.
//
// Vain luku: tiedostoja lisätään, rajataan ja jaetaan ylläpidon puolella
// (KohteenTiedostot). "Vain ylläpidolle" -tiedostot eivät tule vartijalle palvelimelta
// lainkaan; ne suodatetaan tässä myös, jotta pääkäyttäjän esikatselu vartijanäkymässä
// näyttää saman kuin vartija näkee.
import { Download, Eye, FileText, FolderOpen, ShieldAlert } from 'lucide-react';

import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { esikatselunOsoite, useEditorinTila } from '../shared/editori';
import { muotoileTavut } from '../shared/muotoilu';
import type { Kohde, KohteenTiedosto } from './tyypit';

type Props = {
  kohde: Kohde;
  tiedostot: KohteenTiedosto[];
  onTakaisin: () => void;
};

export const vartijalleNakyvat = (tiedostot: KohteenTiedosto[], kohdeId: string) =>
  tiedostot
    .filter((t) => t.siteId === kohdeId && !t.vainYllapito)
    .sort((a, b) => a.name.localeCompare(b.name, 'fi'));

export const VartijanTiedostot = ({ kohde, tiedostot, onTakaisin }: Props) => {
  const lista = vartijalleNakyvat(tiedostot, kohde.id);
  // Rivi avaa esikatselun kun tyyppi sen sallii (Word ja OpenDocument editoriin vain luku
  // -tilaan, PDF ja kuvat selaimeen), muuten tiedosto ladataan.
  const editori = useEditorinTila();
  return (
    <div className="max-w-3xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin</TakaisinLinkki>
      <h2 className="text-2xl font-bold text-ink-strong mb-1 flex items-center gap-2">
        <FolderOpen size={24} className="text-accent" />
        Kohteen tiedostot
      </h2>
      <p className="text-sm text-ink-muted mb-6">{kohde.name} · vartio-ohjeet, pohjapiirrokset ja muut kohteen asiakirjat.</p>

      {lista.length === 0 ? (
        <p className="text-sm text-ink-muted bg-sunken border border-line rounded-lg p-6 text-center">
          Kohteeseen ei ole liitetty vartijoille näkyviä tiedostoja.
        </p>
      ) : (
        <ul className="border border-line rounded-lg divide-y divide-line-soft bg-surface">
          {lista.map((t) => (
            <li key={t.id}>
              <a
                href={esikatselunOsoite(editori, t.uploadId, t.name) || `/api/uploads/${t.uploadId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-4 py-3 hover:bg-sunken transition-colors"
              >
                <FileText size={18} className="text-accent shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-ink-strong truncate">{t.name}</span>
                  <span className="block text-xs text-ink-muted">
                    {t.lisatty?.slice(0, 10)}
                    {typeof t.size === 'number' ? ` · ${muotoileTavut(t.size)}` : ''}
                  </span>
                </span>
                {t.containsPersonalData && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-danger-soft text-danger-ink border-danger/30 shrink-0">
                    <ShieldAlert size={11} />
                    Henkilötietoa
                  </span>
                )}
                {esikatselunOsoite(editori, t.uploadId, t.name)
                  ? <Eye size={16} className="text-ink-muted shrink-0" />
                  : <Download size={16} className="text-ink-muted shrink-0" />}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
