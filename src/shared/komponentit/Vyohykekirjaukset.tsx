// Vyöhykkeen kirjaukset kartan alla (erän 2 viimeinen jäännös).
//
// Kartalla oli tähän asti kaksi asiaa jotka eivät puhuneet toisilleen: vyöhykkeet ja
// kirjausmerkit. Vyöhykettä saattoi napsauttaa, mutta napsautus ei tehnyt mitään —
// kysymykseen "mitä tällä alueella on tapahtunut" ei siis päässyt käsiksi kartalta,
// vaikka vastaus oli näkyvissä.
//
// VALINTA EI RAJAA KARTTAMERKKEJÄ, VAIN LISTAN. Kirjauksen vyöhyke on se jonka kirjaaja
// ilmoitti lomakkeella, ja karttakohta on erikseen osoitettu piste; kumpikin voi olla
// ilman toista. Jos valinta piilottaisi merkkejä, kartalta katoaisi juuri se kirjaus
// joka on osoitettu vyöhykkeen sisään mutta jolta vyöhykevalinta puuttuu — ja katoaminen
// näyttäisi siltä että kirjausta ei ole. Vyöhykkeen sisältöä ei myöskään päätellä
// pisteen sijainnista: se olisi arvaus siitä mitä kirjaaja tarkoitti.

import { vari as haeVari, type Vyohyke } from '../vyohykkeet';

export type AlueKirjaus = {
  id: string;
  otsikko: string;
  lisatieto?: string;
  // Kirjauksen käsittelytilan väri (ks. shared/kirjaukset.ts: TILAT). Tilaton kirjaus
  // jää harmaaksi — tilaväri lupaisi käsittelyä jota sisäänkirjaukselle ei kuulu tehdä.
  vari?: string;
  zoneId?: string | null;
};

type Props = {
  vyohykkeet: Vyohyke[];
  kirjaukset: AlueKirjaus[];
  valittu: string | null;
  onValitse: (id: string | null) => void;
  onAvaa?: (id: string) => void;
  // Enintään näin monta riviä kerrallaan. Vyöhykkeellä voi olla satoja kirjauksia, eikä
  // kartan alle kuulu koko arkisto.
  maxRivit?: number;
};

export const Vyohykekirjaukset = ({
  vyohykkeet, kirjaukset, valittu, onValitse, onAvaa, maxRivit = 15,
}: Props) => {
  if (vyohykkeet.length === 0) return null;

  const maara = (id: string) => kirjaukset.filter((k) => k.zoneId === id).length;
  const vyohykkeetta = kirjaukset.filter((k) => !k.zoneId).length;
  const valitunNimi = vyohykkeet.find((v) => v.id === valittu)?.nimi || '';
  // Yksikkö ja monikko erikseen: "1 kirjausta" on virhe jonka jokainen huomaa mutta
  // jota kukaan ei ehdi korjata, koska se on vain teksti.
  const kirjaustaTeksti = (n: number) => `${n} ${n === 1 ? 'kirjaus' : 'kirjausta'}`;
  const rivit = valittu ? kirjaukset.filter((k) => k.zoneId === valittu) : [];

  return (
    <div className="mt-4 border-t border-line-soft pt-4">
      {/* Napit kartan rinnalle: kartalla vyöhykkeeseen osuminen on kosketusnäytöllä
          hankalaa, eikä karttaa ole aina edes ladattu. Sama valinta molemmista. */}
      <div className="flex flex-wrap gap-2">
        {vyohykkeet.map((v) => {
          const varit = haeVari(v.vari);
          const paalla = valittu === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onValitse(paalla ? null : v.id)}
              aria-pressed={paalla}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                paalla ? 'bg-ink-strong text-surface border-transparent' : 'bg-surface text-ink-body border-line hover:bg-sunken'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: varit.reuna }} />
              {v.nimi}
              <span className={paalla ? 'text-surface/70' : 'text-ink-muted'}>{maara(v.id)}</span>
            </button>
          );
        })}
        {valittu && (
          <button
            type="button"
            onClick={() => onValitse(null)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-ink-muted hover:text-ink-strong"
          >
            Poista rajaus
          </button>
        )}
      </div>

      {!valittu ? (
        <p className="text-xs text-ink-muted mt-3">
          Napsauta vyöhykettä kartalta tai yllä olevasta napista nähdäksesi sen kirjaukset.
          {vyohykkeetta > 0 && ` ${kirjaustaTeksti(vyohykkeetta)} on ilman vyöhykettä.`}
        </p>
      ) : (
        <div className="mt-3">
          <h4 className="text-sm font-bold text-ink-strong">
            {valitunNimi}
            <span className="ml-1.5 font-normal text-ink-muted">
              {rivit.length === 0 ? 'ei kirjauksia' : kirjaustaTeksti(rivit.length)}
            </span>
          </h4>
          {rivit.length > 0 && (
            <ul className="mt-2 space-y-1">
              {rivit.slice(0, maxRivit).map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    onClick={onAvaa ? () => onAvaa(k.id) : undefined}
                    disabled={!onAvaa}
                    className={`w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-lg ${
                      onAvaa ? 'hover:bg-sunken' : 'cursor-default'
                    }`}
                  >
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: k.vari || '#64748b' }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-ink-body truncate">{k.otsikko}</span>
                      {k.lisatieto && <span className="block text-xs text-ink-muted truncate">{k.lisatieto}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rivit.length > maxRivit && (
            <p className="text-xs text-ink-muted mt-2">
              Näytetään {maxRivit} uusinta {rivit.length} kirjauksesta.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
