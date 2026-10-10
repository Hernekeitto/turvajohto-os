// Vuorotyypin miehitys kohteen hallinnassa (erä 2): minä päivinä ja kuinka monella
// vartijalla vuoroa tehdään, ja mistä mihin.
//
// Kesto ja TES-poikkeamat lasketaan lomakkeella saman tien, koska ne riippuvat
// kellonajoista jotka ovat samassa lomakkeessa. Perustelukenttä näkyy vain kun vuoro
// poikkeaa TES:stä — muuten se olisi kenttä jota kukaan ei tiedä miksi täyttää.

import { CalendarDays, TriangleAlert } from 'lucide-react';

import type { Miehitys } from '../tyypit';
import {
  POIKKEAMAN_TEKSTI, VIIKONPAIVAT, kestoTekstina, miehityksenEste, vuoronKestoMin, vuoronTesPoikkeamat,
} from './miehitys';
import type { Rajat } from './miehitys';

type Props = {
  alkaa?: string;
  paattyy?: string;
  miehitys: Miehitys | undefined;
  onChange: (m: Miehitys | undefined) => void;
  // null = säännöt eivät latautuneet. Lomake toimii silti; palvelin tarkistaa rajat.
  rajat: Rajat | null;
};

const OLETUS: Miehitys = { maarat: [1, 1, 1, 1, 1, 1, 1] };

export const MiehitysEditori = ({ alkaa, paattyy, miehitys, onChange, rajat }: Props) => {
  const paalla = !!miehitys;
  const kesto = vuoronKestoMin(alkaa, paattyy);
  const poikkeamat = rajat ? vuoronTesPoikkeamat(alkaa, paattyy, rajat) : [];
  const este = miehityksenEste(alkaa, paattyy, miehitys, rajat);

  const aseta = (muutos: Partial<Miehitys>) => {
    if (miehitys) onChange({ ...miehitys, ...muutos });
  };

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <label className="flex items-start gap-2 text-sm text-ink-body">
        <input
          type="checkbox"
          checked={paalla}
          onChange={() => onChange(paalla ? undefined : { ...OLETUS, maarat: [...OLETUS.maarat] })}
          className="mt-0.5 rounded border-line-strong"
        />
        <span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CalendarDays size={14} className="text-accent" />
            Suunnitellaan työvuorolistaan
          </span>
          <span className="block text-xs text-ink-muted">
            Vuorosuunnittelija sijoittaa vartijat näihin vuoroihin. Jätä pois lisävuorot,
            joita ei tehdä säännöllisesti.
          </span>
        </span>
      </label>

      {miehitys && (
        <div className="mt-3 space-y-3 pl-6">
          <div>
            <span className="block text-xs font-medium text-ink-body mb-1.5">Vartijoita vuorossa</span>
            <div className="grid grid-cols-7 gap-1.5 max-w-sm">
              {VIIKONPAIVAT.map((pv, i) => (
                <label key={pv} className="text-center">
                  <span className="block text-xs text-ink-muted mb-0.5">{pv}</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={1}
                    aria-label={`Vartijoita, ${pv}`}
                    value={miehitys.maarat[i]}
                    onChange={(e) => {
                      const maarat = [...miehitys.maarat];
                      maarat[i] = e.target.value === '' ? 0 : Number(e.target.value);
                      aseta({ maarat });
                    }}
                    className="w-full bg-surface border border-line rounded-md px-1 py-1.5 text-sm text-ink text-center"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="text-xs text-ink-body">
              <span className="block font-medium mb-1">Alkaen</span>
              <input
                type="date"
                value={miehitys.alkaen || ''}
                onChange={(e) => aseta({ alkaen: e.target.value || undefined })}
                className="bg-surface border border-line rounded-md px-2 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="text-xs text-ink-body">
              <span className="block font-medium mb-1">Asti (viimeinen päivä)</span>
              <input
                type="date"
                value={miehitys.asti || ''}
                onChange={(e) => aseta({ asti: e.target.value || undefined })}
                className="bg-surface border border-line rounded-md px-2 py-1.5 text-sm text-ink"
              />
            </label>
          </div>
          <p className="text-xs text-ink-muted">
            Tyhjä alkupäivä = heti, tyhjä loppupäivä = toistaiseksi. Kun miehitys muuttuu
            (esim. uusi sopimus), lisää uusi vuoro alkupäivällä ja anna tälle loppupäivä.
          </p>

          {kesto !== null && (
            <p className="text-xs text-ink-body">
              Vuoron pituus {kestoTekstina(kesto)}
              {rajat && poikkeamat.length === 0 && ' — TES:n mukainen.'}
            </p>
          )}

          {poikkeamat.length > 0 && (
            <div className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2">
              <p className="text-xs text-warning-ink flex items-start gap-1.5">
                <TriangleAlert size={14} className="shrink-0 mt-px" />
                <span>
                  Vuoro {poikkeamat.map((p) => POIKKEAMAN_TEKSTI[p]).join(' ja ')}. Pysyvästä
                  poikkeuksesta sovitaan pääluottamusmiehen kanssa (TES 10 § ja 51 §).
                </span>
              </p>
              <label className="block mt-2">
                <span className="block text-xs font-medium text-warning-ink mb-1">Perustelu (pakollinen)</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={miehitys.tesPerustelu || ''}
                  onChange={(e) => aseta({ tesPerustelu: e.target.value })}
                  placeholder="esim. Sovittu pääluottamusmiehen kanssa 1.10.2026, 14 h vuoro asiakkaan aukioloaikojen vuoksi"
                  className="w-full bg-surface border border-line rounded-md px-2 py-1.5 text-sm text-ink"
                />
              </label>
            </div>
          )}

          {este && <p className="text-xs text-danger">{este}</p>}
        </div>
      )}
    </div>
  );
};
