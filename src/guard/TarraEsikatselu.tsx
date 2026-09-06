// Tarkistuspisteiden tarrojen esikatselu ja tulostus.
//
// Esikatselu on tässä siksi, että tarra on FYYSINEN esine: se liimataan seinään ja sen
// on toimittava vuosia. Ennen kuin arkki lähtee tulostimeen, on voitava tarkistaa että
// koodi on oikea ja että sen vieressä lukeva tunniste vastaa sitä mitä pohjaan on
// kirjattu. Suoraan tulostimeen lähtevä nappi tarkoitti käytännössä sitä, että virhe
// huomattiin vasta liimauksen jälkeen.
//
// TARRASSA EI OLE TEKSTIÄ, ja esikatselu näyttää sen sellaisena. Tarra jää asiakkaan
// tiloihin kenen tahansa luettavaksi, joten siinä ei ole kohteen, pisteen eikä
// kierroksen nimeä. Pisteen nimi näkyy tarran ULKOPUOLELLA — tulosteessa se jää
// leikkuujätteeseen, ja täällä se kertoo mitä pistettä kortti esittää.
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
               kilpi ylhäällä ja koodi pystyssä, ei muuta. Esikatselu jonka sisältö tai
               mittasuhteet eroavat tulosteesta ei kerro sitä mitä sen pitäisi kertoa. */
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
              {tarrat.map((tarra, i) => (
                <div key={tarra.id}>
                  <div className="bg-white border-2 border-ink-strong rounded-2xl px-3 py-5 flex flex-col items-center h-[22rem]">
                    <ShieldCheck className="w-12 h-12 text-[#4f46e5] shrink-0 mb-4" strokeWidth={1.9} />
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
                  </div>

                  {/* Tarran ulkopuolella: asennusohje, joka jää tulosteessa
                      leikkuujätteeseen. */}
                  <p className="text-xs text-ink-body text-center mt-1.5 leading-tight">
                    {i + 1}. {tarra.nimi}
                  </p>
                  <p className="inline-flex w-full justify-center items-center gap-1 text-[10px] text-ink-muted mt-0.5">
                    {tarra.koodi === 'code128'
                      ? <><ScanBarcode size={10} className="shrink-0" /> Viivakoodi</>
                      : <><QrCode size={10} className="shrink-0" /> QR-koodi</>}
                  </p>
                  {tarra.vaadiKoodi && (
                    <p className="text-[10px] font-bold text-warning-ink text-center mt-0.5">
                      Kuitataan vain lukemalla
                    </p>
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
