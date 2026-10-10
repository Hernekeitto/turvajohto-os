// Työaikasäännöt Sovellusasetuksissa (erä 1). Vain pääkäyttäjä muokkaa.
//
// Jokaisen asetuksen vieressä näkyy TES:n arvo ja pykälä. TES:stä poikkeava arvo
// korostetaan, ja tallennus vaatii kirjauksen paikallisesta sopimuksesta (TES 51 §) —
// sama vaatimus tarkistetaan palvelimella (server/tyovuorolista.js: tarkistaAsetukset),
// joten tämä lomake vain kertoo sen etukäteen.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, RotateCcw } from 'lucide-react';

import { arvoTekstina, haeTyoaika, pvm } from './tyoaika';
import type { Asetukset, TyoaikaVastaus } from './tyoaika';

const SYOTE = 'w-28 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink';

export const TyoaikaSaannot = ({ isAdmin }: { isAdmin: boolean }) => {
  const [tila, setTila] = useState<TyoaikaVastaus | null>(null);
  const [luonnos, setLuonnos] = useState<Asetukset | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [kenttavirheet, setKenttavirheet] = useState<Record<string, string>>({});
  const [tallennetaan, setTallennetaan] = useState(false);
  const [tallennettu, setTallennettu] = useState(false);

  const hae = useCallback(() => {
    haeTyoaika()
      .then((v) => { setTila(v); setLuonnos(v.asetukset); setVirhe(null); })
      .catch((e: Error) => setVirhe(e.message));
  }, []);

  useEffect(() => { if (isAdmin) hae(); }, [isAdmin, hae]);

  // Poikkeamat lasketaan luonnoksesta, jotta korostus ja sopimuskenttä päivittyvät heti
  // kirjoittaessa eikä vasta tallennuksen jälkeen.
  const poikkeamat = useMemo(() => {
    if (!tila || !luonnos) return [];
    return Object.entries(tila.kuvaukset)
      .filter(([k, a]) => a.tes !== null && !a.eiPoikkeama && luonnos[k] !== a.tes)
      .map(([k]) => k);
  }, [tila, luonnos]);

  if (!isAdmin) return null;

  const aseta = (avain: string, arvo: number | boolean | string | null) => {
    setLuonnos((l) => (l ? { ...l, [avain]: arvo } : l));
    setTallennettu(false);
  };

  const tallenna = async () => {
    if (!luonnos) return;
    setTallennetaan(true);
    setVirhe(null);
    setKenttavirheet({});
    try {
      const r = await fetch('/api/tyovuorot/asetukset', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(luonnos),
      });
      const vastaus = await r.json().catch(() => null);
      if (!vastaus?.ok) {
        // Kenttäkohtainen virhe näkyy kentän alla. Yläreunaan tulee vain se, jota ei voi
        // kohdistaa kenttään (esim. oikeudet tai yhteys) — muuten sama viesti näkyisi kahdesti.
        const kentat = Object.fromEntries((vastaus?.virheet || []).map((v: any) => [v.kentta, v.viesti]));
        setKenttavirheet(kentat);
        if (Object.keys(kentat).length === 0) setVirhe(vastaus?.error || 'Tallennus ei onnistunut.');
        return;
      }
      setTila(vastaus);
      setLuonnos(vastaus.asetukset);
      setTallennettu(true);
    } catch {
      setVirhe('Tallennus ei onnistunut: ei yhteyttä palvelimeen.');
    } finally {
      setTallennetaan(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-line shadow-sm p-6 mb-6">
      <h3 className="text-lg font-bold text-ink flex items-center gap-2">
        <CalendarClock size={18} className="text-accent" />
        Työaikasäännöt
      </h3>
      <p className="text-sm text-ink-muted mt-1 leading-relaxed">
        Säännöt joita vastaan työvuorolistat tarkistetaan. Oletuksina ovat vartiointialan
        työehtosopimuksen arvot. Jos arvo poikkeaa TES:stä, tallennus vaatii kirjauksen
        paikallisesta sopimuksesta (TES 51 §).
      </p>

      {virhe && <p className="text-sm text-danger mt-3">{virhe}</p>}

      {!tila || !luonnos ? (
        !virhe && <p className="text-sm text-ink-muted mt-3">Luetaan…</p>
      ) : (
        <>
          <div className="mt-5">
            <label className="block text-sm font-bold text-ink-strong" htmlFor="tyoaika-jaksot">
              Jaksojen alkupäivä
            </label>
            <p className="text-xs text-ink-muted mt-0.5 mb-2">
              Jonkin kolmen viikon jakson ensimmäinen maanantai (TES 9 § ja 11 §). Muut jaksot
              lasketaan siitä eteen- ja taaksepäin. Suunnittelu ei ala ennen kuin tämä on
              asetettu.
            </p>
            <input
              id="tyoaika-jaksot"
              type="date"
              value={luonnos.jaksotAlkaen || ''}
              onChange={(e) => aseta('jaksotAlkaen', e.target.value || null)}
              className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink"
            />
            {kenttavirheet.jaksotAlkaen && <p className="text-xs text-danger mt-1">{kenttavirheet.jaksotAlkaen}</p>}
          </div>

          <div className="mt-6 divide-y divide-line-soft border-y border-line-soft">
            {Object.entries(tila.kuvaukset).map(([avain, a]) => {
              const poikkeaa = poikkeamat.includes(avain);
              const arvo = luonnos[avain];
              return (
                <div key={avain} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex-1 min-w-[14rem]">
                    <label className="text-sm text-ink-strong" htmlFor={`tyoaika-${avain}`}>{a.nimi}</label>
                    <p className="text-xs text-ink-muted">
                      {a.tes === null
                        ? `Yrityksen oma asetus, oletus ${arvoTekstina(a, a.oletus)}`
                        : `TES ${a.pykala}: ${arvoTekstina(a, a.tes)}`}
                      {a.sallitut && ` (vaihtoehdot ${a.sallitut.join(' tai ')} ${a.yksikko})`}
                    </p>
                    {kenttavirheet[avain] && <p className="text-xs text-danger mt-1">{kenttavirheet[avain]}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Kiinteä leveys kaikille ohjaimille ja yksikölle, jotta valinta,
                        valintaruutu ja numerokenttä asettuvat samaan sarakkeeseen. */}
                    <div className="w-28">
                      {a.totuusarvo ? (
                        <input
                          id={`tyoaika-${avain}`}
                          type="checkbox"
                          checked={arvo === true}
                          onChange={(e) => aseta(avain, e.target.checked)}
                          className="h-4 w-4 accent-accent"
                        />
                      ) : a.sallitut ? (
                        <select
                          id={`tyoaika-${avain}`}
                          value={String(arvo)}
                          onChange={(e) => aseta(avain, Number(e.target.value))}
                          className={SYOTE}
                        >
                          {a.sallitut.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <input
                          id={`tyoaika-${avain}`}
                          type="number"
                          step={0.5}
                          min={a.min}
                          max={a.max}
                          value={typeof arvo === 'number' ? arvo : ''}
                          onChange={(e) => aseta(avain, e.target.value === '' ? null : Number(e.target.value))}
                          className={SYOTE}
                        />
                      )}
                    </div>
                    <span className="text-sm text-ink-muted sm:w-20">{a.totuusarvo ? '' : a.yksikko}</span>
                    <div className="sm:w-36 flex sm:justify-end">
                      {poikkeaa && (
                        <button
                          type="button"
                          title="Palauta TES:n arvo"
                          onClick={() => aseta(avain, a.tes)}
                          className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning-soft px-2 py-1 text-xs text-warning-ink whitespace-nowrap"
                        >
                          <RotateCcw size={12} />
                          Poikkeaa TES:stä
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Kenttä näkyy vain poikkeaman kanssa: palvelin tyhjentää kirjauksen kun kaikki
              arvot noudattavat TES:ää, jottei vanha kirjaus kata myöhempää poikkeamaa. */}
          {poikkeamat.length > 0 && (
            <div className="mt-5">
              <label className="block text-sm font-bold text-ink-strong" htmlFor="tyoaika-sopimus">
                Paikallinen sopimus <span className="text-danger">(pakollinen)</span>
              </label>
              <p className="text-xs text-ink-muted mt-0.5 mb-2">
                {`${poikkeamat.length} ${poikkeamat.length === 1 ? 'asetus poikkeaa' : 'asetusta poikkeaa'} TES:stä. `
                  + 'Kirjaa kuka sopi, milloin ja mistä (esim. "Sovittu pääluottamusmiehen kanssa 1.10.2026, vuorokausilepo 9 h").'}
              </p>
              <textarea
                id="tyoaika-sopimus"
                rows={3}
                maxLength={1000}
                value={luonnos.paikallinenSopimus}
                onChange={(e) => aseta('paikallinenSopimus', e.target.value)}
                className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2.5 text-sm text-ink-strong placeholder:text-ink-subtle focus:outline-none focus:border-accent"
              />
              {kenttavirheet.paikallinenSopimus && (
                <p className="text-xs text-danger mt-1">{kenttavirheet.paikallinenSopimus}</p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={tallenna}
              disabled={tallennetaan}
              className="px-5 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors disabled:opacity-60"
            >
              {tallennetaan ? 'Tallennetaan…' : 'Tallenna säännöt'}
            </button>
            {tallennettu && <span className="text-sm text-ink-muted">Tallennettu.</span>}
            {tila.muokattu && (
              <span className="text-xs text-ink-muted">
                Viimeksi muokattu {pvm(tila.muokattu.slice(0, 10))}{tila.muokkasi ? `, ${tila.muokkasi}` : ''}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};
