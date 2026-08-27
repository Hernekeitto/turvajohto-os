import { useRef, useState } from 'react';
import { Upload, FileText, Trash2, Download } from 'lucide-react';
import { muotoileTavut } from '../shared/muotoilu';
import type { KohteenTiedosto } from './tyypit';

// Kohteen tiedostot: toimeksiantosopimus, pohjapiirros, vartio-ohje ja vastaavat.
//
// Litteä lista eikä kansiorakennetta (toisin kuin tapahtuman tiedostoissa): kohteella on
// tyypillisesti muutama pysyvä dokumentti, ja kansiot olisivat tyhjää rakennetta jota
// kukaan ei tarvitse. Jos tarve muuttuu, eventFiles-mallinen parentId on helppo lisätä.
//
// Tiedostot tallentuvat HETI eivätkä "Tallenna kohde" -napista, koska lataus on oma
// tapahtumansa ja tiedosto on jo palvelimella. Tämä kerrotaan käyttäjälle näkyvästi,
// jottei hän luule menettävänsä latausta peruuttaessaan lomakkeen.

type Props = {
  tiedostot: KohteenTiedosto[];
  saaMuokata: boolean;
  onLisaa: (tiedosto: File) => Promise<void>;
  onPoista: (id: string) => Promise<void>;
  kohdeTallennettu: boolean;
};

export const KohteenTiedostot = ({
  tiedostot,
  saaMuokata,
  onLisaa,
  onPoista,
  kohdeTallennettu,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lataa, setLataa] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);

  const valitse = async (tiedosto: File | undefined) => {
    if (!tiedosto) return;
    setVirhe(null);
    setLataa(true);
    try {
      await onLisaa(tiedosto);
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Tiedoston lähetys epäonnistui.');
    } finally {
      setLataa(false);
      // Nollataan, jotta saman tiedoston voi valita uudelleen jos ensimmäinen yritys
      // epäonnistui — muuten change-tapahtuma ei laukea toista kertaa.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (!kohdeTallennettu) {
    return (
      <div className="bg-sunken border border-line rounded-lg p-6 text-center">
        <FileText className="w-8 h-8 text-ink-subtle mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-ink-muted">
          Tallenna kohde ensin, niin voit liittää siihen tiedostoja.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-ink-muted mb-4">
        Kohteeseen liittyvät asiakirjat: toimeksiantosopimus, pohjapiirros, vartio-ohje.
        Tiedostot tallentuvat heti — niitä ei tarvitse erikseen tallentaa kohteen mukana.
      </p>

      {virhe && (
        <p className="mb-4 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
          {virhe}
        </p>
      )}

      {tiedostot.length > 0 && (
        <div className="border border-line rounded-lg divide-y divide-line-soft mb-6">
          {tiedostot.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <FileText size={16} className="text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{t.name}</p>
                <p className="text-xs text-ink-muted">
                  {t.lisatty?.slice(0, 10)}
                  {t.lisaaja ? ` · ${t.lisaaja}` : ''}
                  {typeof t.size === 'number' ? ` · ${muotoileTavut(t.size)}` : ''}
                </p>
              </div>
              <a
                href={`/api/uploads/${t.uploadId}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-ink-body hover:text-accent transition-colors"
                title="Avaa tiedosto"
              >
                <Download size={16} />
              </a>
              {saaMuokata && (
                <button
                  type="button"
                  onClick={() => onPoista(t.id)}
                  className="shrink-0 text-ink-subtle hover:text-danger transition-colors"
                  title="Poista tiedosto"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {saaMuokata && (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => valitse(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={lataa}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-60"
          >
            <Upload size={16} />
            {lataa ? 'Lähetetään…' : 'Lisää tiedosto'}
          </button>
          <p className="text-xs text-ink-subtle mt-2">
            Enintään 15 Mt. Tuetut tiedostotyypit: kuvat, PDF ja tavalliset asiakirjamuodot.
          </p>
        </>
      )}

      {tiedostot.length === 0 && !saaMuokata && (
        <p className="text-sm text-ink-muted">Kohteeseen ei ole liitetty tiedostoja.</p>
      )}
    </div>
  );
};
