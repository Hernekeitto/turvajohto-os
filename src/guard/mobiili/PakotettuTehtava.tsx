// Pakotettu tehtävä: estävä ilmoitus (erä 19).
//
// Tämä ei ole kysymys vaan tiedoksianto. Saaja ei voi kieltäytyä — hän voi vain kuitata
// nähdyksi. Määräys jonka vastaanotosta ei ole merkintää ei ole määräys vaan toive, ja
// juuri se ero on koko ominaisuuden syy.
//
// --- Miksi tämä estää muun käytön --------------------------------------------------
//
// Ilmoitus jonka voi pyyhkäistä pois on ilmoitus jota ei lueta. Pakotus on se poikkeus
// jonka vuoksi hälytyskeskus on ohittanut vartijan oman työjärjestyksen, joten sen on
// pysäytettävä ruutu kunnes se on nähty. Sulkupainiketta ei ole: ainoa ulospääsy on
// kuittaus.
//
// --- Mitä tämä EI ole --------------------------------------------------------------
//
// Tämä on selaimen modaali, ei natiivin täysruutuhälytys. Se toimii vain kun sovellus on
// auki. Jos pakotuksen pitää herättää nukkuva puhelin, se odottaa natiiviputken erää 12
// (asennus/NATIIVI.md, ominaisuus 3) — sitä ei luvata tässä.
import { ShieldAlert } from 'lucide-react';

import type { Siirto } from '../siirrot';

type Props = {
  pakotus: Siirto;
  kuitataan: boolean;
  onKuittaa: (id: string) => void;
};

const kello = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
};

export const PakotettuTehtava = ({ pakotus, kuitataan, onKuittaa }: Props) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
    <div className="w-full max-w-md bg-surface rounded-2xl border-2 border-warning p-6">
      <span className="flex items-center gap-2 text-base font-bold text-warning-ink">
        <ShieldAlert size={20} className="shrink-0" />
        LISÄTEHTÄVÄ
      </span>

      <p className="text-base text-ink-body mt-3">
        {pakotus.antaja} on määrännyt sinulle lisätehtävän klo {kello(pakotus.luotu)}.
      </p>

      <p className="text-xl font-bold text-ink-strong mt-3 break-words">{pakotus.nimi}</p>
      <p className="text-base text-ink-body mt-0.5">
        {pakotus.siteNimi} · {pakotus.laji === 'kierros' ? 'kierros' : 'tehtävä'}
      </p>

      {pakotus.viesti && (
        <p className="text-base text-ink-body mt-3 break-words">”{pakotus.viesti}”</p>
      )}

      {/* Suoritusaikaa ei näytetä eikä käytetä pakotetulle tehtävälle: se on toisen vuoron
          aika eikä voi olla oikein tässä. Aikataulun kertoo määrääjä muuta kautta
          (server/kooste.js: pakotukselle ei lasketa aikapoikkeamaa). */}
      <p className="text-sm text-ink-muted mt-4">
        Tehtävä on jo lisätty sinulle. Kuittaus kertoo vain että olet nähnyt sen.
      </p>

      <button
        type="button"
        disabled={kuitataan}
        onClick={() => onKuittaa(pakotus.id)}
        className="mt-5 w-full bg-warning hover:brightness-95 disabled:opacity-50 text-white text-lg font-bold rounded-xl px-4 py-4 transition-all"
      >
        {kuitataan ? 'Kuitataan…' : 'OK'}
      </button>
    </div>
  </div>
);
