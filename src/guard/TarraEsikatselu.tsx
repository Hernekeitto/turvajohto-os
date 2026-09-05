// Tarkistuspisteiden tarrojen esikatselu ja tulostus.
//
// Esikatselu on tässä siksi, että tarra on FYYSINEN esine: se liimataan seinään ja sen
// on toimittava vuosia. Ennen kuin arkki lähtee tulostimeen, on voitava tarkistaa että
// koodi on oikea, että pisteen nimi on luettavissa ja että viivakoodin vieressä lukeva
// tunniste vastaa sitä mitä pohjaan on kirjattu. Suoraan tulostimeen lähtevä nappi
// tarkoitti käytännössä sitä, että virhe huomattiin vasta liimauksen jälkeen.
//
// Näkymä piirtää saman sisällön kuin tulostedokumentti (shared/tuloste.ts) mutta ei jaa
// sen kanssa koodia: tuloste on merkkijono iframen sisään ja tämä on React-puu. Sama
// tieto, kaksi esitystapaa — ja koodit itse tulevat molemmissa samasta lähteestä
// (shared/viivakoodi.ts, /api/qr).
import { Printer, QrCode, ScanBarcode, ShieldCheck, X } from 'lucide-react';

import { Viivakoodi } from '../shared/komponentit/Viivakoodi';
import { useTakaisinEste } from '../shared/navigointi';

export type EsikatselunTarra = {
  id: string;
  nimi: string;
  koodi: 'qr' | 'code128';
  // QR haetaan palvelimelta data-URI:na; null tarkoittaa ettei sitä saatu.
  qrDataUri?: string | null;
  viivakoodi?: string;
  vaadiKoodi?: boolean;
};

type Props = {
  kohdeNimi: string;
  pohjaNimi: string;
  tarrat: EsikatselunTarra[];
  lataa: boolean;
  virhe?: string | null;
  onTulosta: () => void;
  onSulje: () => void;
};

export const TarraEsikatselu = ({
  kohdeNimi, pohjaNimi, tarrat, lataa, virhe, onTulosta, onSulje,
}: Props) => {
  // Takaisin-nappi sulkee esikatselun eikä vie pois näkymästä. Sama sääntö kuin muilla
  // modaaleilla (ks. shared/navigointi.ts).
  useTakaisinEste(true, onSulje);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4 py-6">
      <div className="bg-surface rounded-xl shadow-xl border border-line w-full max-w-3xl max-h-full flex flex-col">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-line-soft">
          <div className="min-w-0">
            <h3 className="font-bold text-ink-strong">Tarrat: {pohjaNimi}</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              {kohdeNimi} · {tarrat.length} tarkistuspistettä · tarkista koodit ennen tulostusta
            </p>
          </div>
          <button
            type="button"
            onClick={onSulje}
            aria-label="Sulje esikatselu"
            className="-mt-1 -mr-1 w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-ink-subtle hover:bg-sunken transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-canvas">
          {virhe && (
            <p className="mb-4 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
              {virhe}
            </p>
          )}
          {lataa ? (
            <p className="text-sm text-ink-muted text-center py-10">Haetaan koodeja…</p>
          ) : tarrat.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-10">Pohjassa ei ole tarkistuspisteitä.</p>
          ) : (
            /* Tarrat piirtyvät samassa muodossa kuin tulosteessa: kapea pystytarra,
               kilpi ylhäällä ja koodi pystyssä. Esikatselu jonka mittasuhteet eroavat
               tulosteesta ei kerro sitä mitä sen pitäisi kertoa. */
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
              {tarrat.map((tarra) => (
                <div
                  key={tarra.id}
                  className="bg-white border-2 border-ink-strong rounded-2xl p-3 text-center flex flex-col items-center h-[22rem]"
                >
                  <ShieldCheck className="w-10 h-10 text-accent shrink-0 mt-1 mb-1.5" strokeWidth={1.9} />
                  <span className="text-[9px] tracking-[0.12em] uppercase text-ink-muted leading-tight">
                    {kohdeNimi}
                  </span>
                  <span className="block text-sm font-bold text-ink-strong leading-tight mt-0.5 mb-2">
                    {tarra.nimi}
                  </span>

                  <div className="flex-1 min-h-0 flex items-center justify-center w-full">
                    {tarra.koodi === 'code128' ? (
                      tarra.viivakoodi
                        ? <Viivakoodi teksti={tarra.viivakoodi} moduuli={2} korkeus={70} pysty />
                        : <p className="text-xs text-ink-muted">Koodi muodostetaan tallennuksessa.</p>
                    ) : tarra.qrDataUri ? (
                      <img src={tarra.qrDataUri} alt="" className="max-h-full w-auto" />
                    ) : (
                      <p className="text-xs text-danger-ink">QR-koodia ei saatu palvelimelta.</p>
                    )}
                  </div>

                  <span className="text-[9px] text-ink-muted mt-2">{pohjaNimi}</span>
                  <span className="inline-flex items-center gap-1 text-[9px] text-ink-muted mt-0.5 leading-tight">
                    {tarra.koodi === 'code128'
                      ? <><ScanBarcode size={10} className="shrink-0" /> Kameralla tai lukijalla</>
                      : <><QrCode size={10} className="shrink-0" /> Puhelimen kameralla</>}
                  </span>
                  {tarra.vaadiKoodi && (
                    <span className="text-[9px] font-bold text-warning-ink mt-0.5">
                      Kuitataan vain lukemalla
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-line-soft">
          <button
            type="button"
            onClick={onSulje}
            className="px-4 py-2 text-sm font-medium text-ink-body bg-sunken hover:bg-line-soft rounded-lg transition-colors"
          >
            Sulje
          </button>
          <button
            type="button"
            onClick={onTulosta}
            disabled={lataa || tarrat.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-accent hover:bg-accent-hover disabled:opacity-60 rounded-lg transition-colors"
          >
            <Printer size={16} />
            Tulosta arkki
          </button>
        </div>
      </div>
    </div>
  );
};
