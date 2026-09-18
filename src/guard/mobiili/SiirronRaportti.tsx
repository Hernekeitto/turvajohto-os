// Pakotetun tehtävän merkitseminen tehdyksi ja siihen vaaditun raportin kirjoittaminen.
//
// KUITTAUS EI OLE SUORITUS. PakotettuTehtava-modaali kuittaa määräyksen nähdyksi heti kun
// se saapuu; tämä on se erillinen hetki jolloin työ on tehty. Jos nämä olisivat sama
// painallus, "olen nähnyt" ja "olen tehnyt" kirjautuisivat samaksi merkinnäksi — ja
// päivystäjä näkisi tehdyksi myös sen mitä vartija ei ole vielä ehtinyt tehdä.
//
// RAPORTTIVAATIMUS TULEE TEHTÄVÄSTÄ EIKÄ VARTIJALTA. Päivystäjä valitsi sen tehtävää
// antaessaan: "vaihda lamppu" ei tarvitse tapahtumailmoitusta, "käy katsomassa miksi ovi
// oli auki" tarvitsee, eikä vartija voi tietää kumpaa odotetaan. Tässä näkymässä
// vaatimusta ei voi vaihtaa kevyempään.

import { useState } from 'react';
import { ClipboardCheck, X } from 'lucide-react';

import { RAPORTTILAJIN_NIMI, type Siirto } from '../siirrot';
import type { GuardRaportti } from '../tyypit';

type Props = {
  siirto: Siirto;
  /** Vartijan omat raportit tästä kohteesta. Tapahtumailmoitus valitaan näistä — se on
   *  kirjoitettu tavallisella raporttilomakkeella, ja tämä vain liittää sen tehtävään. */
  omatRaportit: GuardRaportti[];
  tallentaa: boolean;
  virhe: string | null;
  onSulje: () => void;
  onValmis: (arvot: { raporttiId: string | null; teksti: string }) => void;
};

const kello = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fi-FI', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

export const SiirronRaportti = ({
  siirto, omatRaportit, tallentaa, virhe, onSulje, onValmis,
}: Props) => {
  const [teksti, setTeksti] = useState('');
  const [raporttiId, setRaporttiId] = useState('');
  const laji = siirto.raporttilaji || null;

  // Painike on estetty kunnes vaatimus täyttyy. Virheilmoitus vasta lähetyksen jälkeen
  // opettaisi että kenttä on muodollisuus; palvelin torjuu saman joka tapauksessa.
  const kelpaa = laji === 'tapahtumailmoitus'
    ? raporttiId !== ''
    : laji === 'selvitys'
      ? teksti.trim().length >= 10
      : true;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-line p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-2 text-base font-bold text-ink-strong">
            <ClipboardCheck size={20} className="shrink-0 text-accent" />
            Merkitse tehdyksi
          </span>
          <button type="button" onClick={onSulje} className="text-ink-muted p-1" aria-label="Sulje">
            <X size={20} />
          </button>
        </div>

        <p className="text-xl font-bold text-ink-strong mt-3 break-words">{siirto.nimi}</p>
        <p className="text-base text-ink-body mt-0.5">
          {siirto.siteNimi} · {siirto.antaja}
        </p>
        {siirto.viesti && (
          <p className="text-base text-ink-body mt-2 break-words">”{siirto.viesti}”</p>
        )}

        {laji && (
          <p className="text-sm font-bold text-ink-strong mt-4">
            Tehtävä vaatii: {RAPORTTILAJIN_NIMI[laji].toLowerCase()}
          </p>
        )}

        {laji === 'tapahtumailmoitus' ? (
          <div className="mt-2">
            {omatRaportit.length === 0 ? (
              // Tyhjä lista ei ole virhe vaan järjestysohje: raportti kirjoitetaan ensin
              // tavallisella lomakkeella, ja vasta sitten se voidaan liittää tähän.
              <p className="text-base text-ink-body bg-sunken border border-line rounded-xl px-4 py-3">
                Et ole kirjoittanut tapahtumailmoitusta tästä kohteesta. Kirjoita se ensin
                Raportit-näkymässä, palaa sitten tähän ja liitä se tehtävään.
              </p>
            ) : (
              <>
                <label className="block text-sm font-medium text-ink-body mb-1" htmlFor="raportti-valinta">
                  Valitse kirjoittamasi ilmoitus
                </label>
                <select
                  id="raportti-valinta"
                  value={raporttiId}
                  onChange={(e) => setRaporttiId(e.target.value)}
                  className="w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-base text-ink-strong"
                >
                  <option value="">Valitse…</option>
                  {omatRaportit.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.type} · {kello(r.luotu)}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        ) : laji === 'selvitys' || laji === 'kommentti' ? (
          <div className="mt-2">
            <label className="block text-sm font-medium text-ink-body mb-1" htmlFor="raportti-teksti">
              {laji === 'selvitys' ? 'Mitä teit?' : 'Kommentti (voi jättää tyhjäksi)'}
            </label>
            <textarea
              id="raportti-teksti"
              rows={4}
              value={teksti}
              onChange={(e) => setTeksti(e.target.value)}
              placeholder={laji === 'selvitys'
                ? 'Esim. painike asennettiin pääoven viereen ja testattiin.'
                : 'Esim. kaapin lukko on jäykkä.'}
              className="w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-base text-ink-strong"
            />
          </div>
        ) : (
          <p className="text-base text-ink-body mt-2">
            Tehtävästä ei vaadita kirjallista selvitystä.
          </p>
        )}

        {virhe && (
          <p className="mt-3 text-base text-danger-ink bg-danger-soft border border-danger/30 rounded-xl px-4 py-3">
            {virhe}
          </p>
        )}

        <button
          type="button"
          disabled={!kelpaa || tallentaa}
          onClick={() => onValmis({ raporttiId: raporttiId || null, teksti })}
          className="mt-5 w-full bg-accent hover:brightness-110 disabled:opacity-50 text-white text-lg font-bold rounded-xl px-4 py-4 transition-all"
        >
          {tallentaa ? 'Tallennetaan…' : 'Merkitse tehdyksi'}
        </button>
      </div>
    </div>
  );
};
