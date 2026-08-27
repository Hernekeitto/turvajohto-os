// Lomakekentän kehys GUARD-puolelle. Erillinen tiedosto, koska useampi näkymä käyttää sitä.
//
// EVENT-puolella vastaava rakenne on yhä App.tsx:ssä 52 kopiona; kun se aikanaan puretaan
// jaettuun kansioon, tämä korvataan sillä. Ei siirretä shared/-kansioon vielä, koska
// GUARDin tarpeet voivat vielä muuttua eikä yhteistä rajapintaa kannata lukita ennen sitä.

type KenttaProps = {
  label: string;
  arvo: string;
  onChange: (arvo: string) => void;
  placeholder?: string;
  monirivinen?: boolean;
  tyyppi?: 'text' | 'date' | 'time' | 'tel';
  vinkki?: string;
};

export const Kentta = ({
  label,
  arvo,
  onChange,
  placeholder,
  monirivinen = false,
  tyyppi = 'text',
  vinkki,
}: KenttaProps) => (
  <label className="block">
    <span className="block text-sm font-medium text-ink-body mb-1">{label}</span>
    {monirivinen ? (
      <textarea
        value={arvo}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
      />
    ) : (
      <input
        type={tyyppi}
        value={arvo}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
      />
    )}
    {vinkki && <span className="block text-xs text-ink-subtle mt-1">{vinkki}</span>}
  </label>
);
