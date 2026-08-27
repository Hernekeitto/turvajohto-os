// Paluulinkki edelliseen näkymään. Jaettu: sama linkki toistui App.tsx:ssä 31 kertaa
// merkki merkiltä samanlaisena, ja GUARD-puoli tarvitsee sen samanlaisena.

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

type TakaisinLinkkiProps = {
  onClick: () => void;
  children: ReactNode;
  // Yksi kutsupaikka (tyhjä TIKE-lomakenäkymä) keskittää linkin sisältönsä mukana.
  keskita?: boolean;
};

export const TakaisinLinkki = ({ onClick, children, keskita = false }: TakaisinLinkkiProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-accent transition-colors mb-6${
      keskita ? ' mx-auto' : ''
    }`}
  >
    <ArrowLeft size={16} />
    {children}
  </button>
);
