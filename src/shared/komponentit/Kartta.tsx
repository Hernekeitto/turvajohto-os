// Alueen kartta TASOINA. Jaettu EVENT- ja GUARD-puolen kesken.
//
// Tasomalli on tässä alusta asti tarkoituksella, vaikka erä 2 tarvitsee vain kaksi
// ensimmäistä: pohjakuva, vyöhykkeet, kirjaukset ja henkilöstö. Sijaintitaso (erä 3)
// on tämän jälkeen uusi propsi eikä komponentin uudelleenkirjoitus.
//
// Työnjako SVG:n ja HTML:n välillä on tarkoituksellinen:
//   - Monikulmiot ovat SVG:tä, koska ne ovat geometriaa ja skaalautuvat kuvan mukana.
//   - Nimilaput ja pistemerkit ovat HTML:ää, koska niiden pitää säilyttää KOKONSA.
//     SVG:n koordinaatisto on 0–1 (ks. shared/vyohykkeet.ts), joten siinä `r={6}`
//     tarkoittaisi kuutta kuvan leveyttä ja `font-size: 11px` yhtä lukukelvotonta
//     jättiläistä. Viivanpaksuus pysyy pikseleinä `vector-effect`-määreellä.

import { vari as haeVari, keskipiste, type Piste, type Vyohyke } from '../vyohykkeet';

export type Karttamerkki = {
  id: string;
  x: number;
  y: number;
  vari?: string;
  otsikko?: string;
  onKlikkaus?: () => void;
};

type Props = {
  karttaId?: string | null;
  vyohykkeet?: Vyohyke[];
  // Kirjaustaso: raportit ja kirjaukset kartalla.
  merkit?: Karttamerkki[];
  // Henkilöstötaso. Erä 3 täyttää tämän; muoto on sama kuin merkeillä.
  henkilosto?: Karttamerkki[];
  // Editoritila: kesken oleva monikulmio ja klikkauskäsittelijä.
  piirrettava?: Piste[];
  onKarttaKlikkaus?: (piste: Piste) => void;
  korostettu?: string | null;
  onVyohykeKlikkaus?: (id: string) => void;
  tyhjaTeksti?: string;
};

const pisteetPolygoniksi = (pisteet: Piste[]) => pisteet.map((p) => `${p.x},${p.y}`).join(' ');

const sijainti = (p: Piste) => ({ left: `${p.x * 100}%`, top: `${p.y * 100}%` });

export const Kartta = ({
  karttaId,
  vyohykkeet = [],
  merkit = [],
  henkilosto = [],
  piirrettava,
  onKarttaKlikkaus,
  korostettu,
  onVyohykeKlikkaus,
  tyhjaTeksti = 'Pohjakarttaa ei ole ladattu.',
}: Props) => {
  if (!karttaId) {
    return (
      <div className="w-full bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center min-h-[300px] p-8 text-center">
        <p className="text-sm font-medium text-slate-600">{tyhjaTeksti}</p>
      </div>
    );
  }

  // Klikkauksen paikka luetaan piirtoalueen omasta laatikosta: kuvan luonnollinen koko
  // ei kerro mitään siitä mihin käyttäjä osui ruudulla.
  const kasitteleKlikkaus = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onKarttaKlikkaus) return;
    const laatikko = e.currentTarget.getBoundingClientRect();
    if (!laatikko.width || !laatikko.height) return;
    onKarttaKlikkaus({
      x: Math.min(1, Math.max(0, (e.clientX - laatikko.left) / laatikko.width)),
      y: Math.min(1, Math.max(0, (e.clientY - laatikko.top) / laatikko.height)),
    });
  };

  return (
    <div className="relative w-full bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
      <img src={`/api/uploads/${karttaId}`} alt="Alueen pohjakartta" className="block w-full h-auto" />

      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        onClick={kasitteleKlikkaus}
        className={`absolute inset-0 w-full h-full ${onKarttaKlikkaus ? 'cursor-crosshair' : ''}`}
      >
        <g data-taso="vyohykkeet">
          {vyohykkeet.map((v) => {
            const varit = haeVari(v.vari);
            return (
              <polygon
                key={v.id}
                points={pisteetPolygoniksi(v.pisteet || [])}
                fill={varit.tayte}
                stroke={varit.reuna}
                strokeWidth={korostettu === v.id ? 3 : 1.5}
                vectorEffect="non-scaling-stroke"
                onClick={onVyohykeKlikkaus ? (e) => { e.stopPropagation(); onVyohykeKlikkaus(v.id); } : undefined}
                className={onVyohykeKlikkaus ? 'cursor-pointer' : ''}
              />
            );
          })}
        </g>

        {/* Kesken oleva piirros: katkoviiva ilman täyttöä — alue ei ole vielä olemassa */}
        {piirrettava && piirrettava.length > 1 && (
          <polyline
            data-taso="piirto"
            points={pisteetPolygoniksi(piirrettava)}
            fill="none"
            stroke="#4f46e5"
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Nimilaput. pointer-events-none, jottei lappu estä kartan klikkausta editorissa. */}
      <div data-taso="nimilaput" className="absolute inset-0 pointer-events-none">
        {vyohykkeet.map((v) => {
          const keski = keskipiste(v);
          const varit = haeVari(v.vari);
          return (
            <span
              key={v.id}
              style={{ ...sijainti(keski), color: varit.reuna }}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-xs font-semibold bg-white/80 rounded px-1 whitespace-nowrap"
            >
              {v.nimi}
            </span>
          );
        })}
      </div>

      {piirrettava && piirrettava.length > 0 && (
        <div data-taso="piirtopisteet" className="absolute inset-0 pointer-events-none">
          {piirrettava.map((p, i) => (
            <span
              key={i}
              style={sijainti(p)}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-white"
            />
          ))}
        </div>
      )}

      <div data-taso="kirjaukset" className="absolute inset-0 pointer-events-none">
        {merkit.map((m) => (
          <button
            key={m.id}
            type="button"
            title={m.otsikko}
            onClick={m.onKlikkaus}
            style={{ ...sijainti(m), backgroundColor: m.vari || '#e11d48' }}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full ring-2 ring-white shadow pointer-events-auto"
          >
            <span className="sr-only">{m.otsikko || 'Kirjaus'}</span>
          </button>
        ))}
      </div>

      <div data-taso="henkilosto" className="absolute inset-0 pointer-events-none">
        {henkilosto.map((h) => (
          <button
            key={h.id}
            type="button"
            title={h.otsikko}
            onClick={h.onKlikkaus}
            style={{ ...sijainti(h), backgroundColor: h.vari || '#0ea5e9' }}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-sm ring-2 ring-white shadow pointer-events-auto"
          >
            <span className="sr-only">{h.otsikko || 'Henkilö'}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
