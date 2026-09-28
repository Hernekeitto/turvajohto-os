// Dokumenttieditorin (Collabora Online) painikkeet: esikatselu, muokkaus ja uuden
// dokumentin luonti. Tila ja osoitteet: ../editori.ts.
//
// Editori avautuu omaan välilehteensä, ei sovelluksen sisään: dokumentin kanssa
// työskennellään usein rinnakkain sovelluksen kanssa, ja oma ikkuna antaa editorille
// koko ruudun.

import { useState } from 'react';
import { Eye, FilePen, FilePlus, FileText, Presentation, Sheet } from 'lucide-react';
import { uusiOdfTiedosto, type OdfTyyppi } from '../odfPohja';
import { editorinOsoite, esikatselunOsoite, paate, useEditorinTila } from '../editori';

const PAINIKE = 'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors text-accent bg-sunken hover:bg-line-soft';

// Muokkaa-painike tiedostoriville. Ei näy, jos editori ei ole käytössä tai tyyppi ei
// ole muokattava.
export function AvaaEditorissa({ uploadId, nimi, className }: { uploadId?: string; nimi: string; className?: string }) {
  const tila = useEditorinTila();
  if (!uploadId || !tila?.kaytossa || !tila.muokattavat.includes(paate(nimi))) return null;
  return (
    <a href={editorinOsoite(uploadId, 'muokkaus')} target="_blank" rel="opener" className={className || PAINIKE} title="Avaa dokumenttieditorissa uuteen välilehteen">
      <FilePen size={13} />
      Muokkaa
    </a>
  );
}

// Esikatsele-painike. Ei näy tyypeille joita ei voi esikatsella (ne voi vain ladata).
export function Esikatsele({ uploadId, nimi, className }: { uploadId?: string; nimi: string; className?: string }) {
  const tila = useEditorinTila();
  const href = esikatselunOsoite(tila, uploadId, nimi);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="opener" className={className || PAINIKE} title="Esikatsele uudessa välilehdessä">
      <Eye size={13} />
      Esikatsele
    </a>
  );
}

// "Uusi dokumentti": tyypin (teksti, taulukko, esitys) ja nimen valinta, tyhjän
// ODF-pohjan luonti ja avaus Toimistoon.
//
// onLuo lataa tiedoston ja lisää sen listaan samaa reittiä kuin käyttäjän oma lataus,
// ja palauttaa latauksen id:n (tai heittää virheen). Editorin välilehti avataan HETI
// klikkauksesta ja ohjataan editoriin vasta kun tiedosto on tallessa: jos ikkuna
// avattaisiin vasta latauksen jälkeen, selain tulkitsisi sen ponnahdusikkunaksi ja
// estäisi sen, koska käyttäjän klikkaus on jo vanhentunut.
const TYYPIT: { tyyppi: OdfTyyppi; nimi: string; Ikoni: typeof FileText }[] = [
  { tyyppi: 'odt', nimi: 'Teksti', Ikoni: FileText },
  { tyyppi: 'ods', nimi: 'Taulukko', Ikoni: Sheet },
  { tyyppi: 'odp', nimi: 'Esitys', Ikoni: Presentation },
];

export function UusiDokumentti({ onLuo }: { onLuo: (tiedosto: File) => Promise<string | undefined> }) {
  const tila = useEditorinTila();
  const [auki, setAuki] = useState(false);
  const [tyyppi, setTyyppi] = useState<OdfTyyppi>('odt');
  const [nimi, setNimi] = useState('');
  const [luodaan, setLuodaan] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);

  // Vain tyypit jotka palvelin kertoo muokattaviksi (server/editori.js: EDITOITAVAT).
  const tarjolla = TYYPIT.filter((t) => tila?.muokattavat.includes(`.${t.tyyppi}`));
  if (!tila?.kaytossa || tarjolla.length === 0) return null;

  const luo = async () => {
    setVirhe(null);
    setLuodaan(true);
    const ikkuna = window.open('', '_blank');
    try {
      const uploadId = await onLuo(uusiOdfTiedosto(nimi, tyyppi));
      if (!uploadId) throw new Error('Tiedoston luonti epäonnistui.');
      const osoite = editorinOsoite(uploadId, 'muokkaus');
      if (ikkuna) ikkuna.location.href = osoite;
      else window.open(osoite, '_blank');
      setNimi('');
      setAuki(false);
    } catch (e) {
      ikkuna?.close();
      setVirhe(e instanceof Error ? e.message : 'Tiedoston luonti epäonnistui.');
    } finally {
      setLuodaan(false);
    }
  };

  if (!auki) {
    return (
      <button
        type="button"
        onClick={() => setAuki(true)}
        className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors text-ink-body bg-sunken hover:bg-line-soft"
      >
        <FilePlus size={16} />
        Uusi dokumentti
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex flex-wrap gap-1" role="radiogroup" aria-label="Dokumentin tyyppi">
        {tarjolla.map(({ tyyppi: t, nimi: otsikko, Ikoni }) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tyyppi === t}
            onClick={() => setTyyppi(t)}
            disabled={luodaan}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              tyyppi === t ? 'bg-accent-soft border-accent/40 text-accent' : 'bg-surface border-line text-ink-body hover:bg-sunken'
            }`}
          >
            <Ikoni size={15} />
            {otsikko}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          autoFocus
          value={nimi}
          onChange={(e) => setNimi(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !luodaan) luo();
            if (e.key === 'Escape') setAuki(false);
          }}
          placeholder="Dokumentin nimi"
          maxLength={120}
          className="flex-1 min-w-[180px] rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={luo}
          disabled={luodaan}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-accent hover:bg-accent-hover disabled:opacity-60"
        >
          <FilePlus size={16} />
          {luodaan ? 'Luodaan…' : 'Luo ja avaa'}
        </button>
        <button
          type="button"
          onClick={() => { setAuki(false); setVirhe(null); }}
          disabled={luodaan}
          className="px-3 py-2 text-sm font-medium rounded-lg text-ink-body bg-sunken hover:bg-line-soft disabled:opacity-60"
        >
          Peruuta
        </button>
      </div>
      {virhe && <p className="text-xs text-danger-ink">{virhe}</p>}
    </div>
  );
}
