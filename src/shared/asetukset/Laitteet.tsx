import { useCallback, useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';

import { haeLaitteet, nollaaSidonta, type Laite } from '../laitteet';

// Sidotut laitteet: kenellä on laite, mikä se on ja milloin se sidottiin.
//
// Nollausoikeus on pääkäyttäjällä ja hälytyskeskuksella (`guard_dispatch`), ei pelkällä
// pääkäyttäjällä — laite vaihdetaan keskellä yötä vuoron alussa, ja silloin päivystäjä on
// se joka on paikalla. Oikeus tarkistetaan palvelimella; tämä näkymä hakee listan ja
// kertoo suoraan jos hakua ei sallita.
//
// NOLLAUS ON PURKU EIKÄ HYVÄKSYNTÄ. Painike poistaa vanhan sidonnan ja jättää tilan auki
// seuraavalle; se ei näe eikä valitse uutta laitetta. Siksi väärin painettu nollaus
// pahimmillaan pakottaa vartijan sitomaan puhelimensa uudelleen eikä anna kenellekään
// pääsyä mihinkään — ja siksi vahvistuskysymys riittää tähän.

const paiva = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric', year: 'numeric' });
};

export const Laitteet = () => {
  const [laitteet, setLaitteet] = useState<Laite[]>([]);
  const [sallittu, setSallittu] = useState(true);
  const [ladattu, setLadattu] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);

  const hae = useCallback(async () => {
    const tulos = await haeLaitteet().catch(() => ({ ok: false, laitteet: [] as Laite[] }));
    setSallittu(tulos.ok);
    setLaitteet(tulos.laitteet);
    setLadattu(true);
  }, []);

  useEffect(() => { hae(); }, [hae]);

  const nollaa = async (laite: Laite) => {
    if (!window.confirm(
      `Nollataanko käyttäjän ${laite.kayttaja} laitesidonta (${laite.malli})?\n\n`
      + 'Puhelin lakkaa toimimasta taustalla heti. Vartija voi sitoa uuden laitteen itse '
      + 'kirjautumalla siihen.'
    )) return;

    setVirhe(null);
    const tulos = await nollaaSidonta(laite.id);
    if (!tulos.ok) {
      setVirhe(tulos.virhe || 'Nollaus ei onnistunut.');
      return;
    }
    hae();
  };

  return (
    <div className="bg-surface rounded-xl border border-line shadow-sm p-6 mb-6">
      <h3 className="text-lg font-bold text-ink flex items-center gap-2">
        <Smartphone size={18} className="text-accent" />
        Sidotut laitteet
      </h3>

      {!ladattu ? (
        <p className="text-sm text-ink-muted mt-3">Haetaan laitteita…</p>
      ) : !sallittu ? (
        <p className="text-sm text-ink-muted mt-3">
          Laitesidonnat näkyvät pääkäyttäjälle ja hälytyskeskukselle.
        </p>
      ) : laitteet.length === 0 ? (
        <p className="text-sm text-ink-muted mt-3">
          Yhtään laitetta ei ole sidottu. Vartija sitoo laitteen itse kirjautumalla siihen
          sovelluksessa.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {laitteet.map((laite) => (
            <li key={laite.id} className="py-3 flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink truncate">{laite.kayttaja}</span>
                <span className="block text-sm text-ink-muted truncate">
                  {laite.malli || 'Tuntematon laite'}
                  {laite.sidottu && ` · sidottu ${paiva(laite.sidottu)}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => nollaa(laite)}
                className="shrink-0 text-sm font-medium text-danger hover:underline"
              >
                Nollaa sidonta
              </button>
            </li>
          ))}
        </ul>
      )}

      {virhe && <p className="text-sm text-danger mt-3">{virhe}</p>}
    </div>
  );
};
