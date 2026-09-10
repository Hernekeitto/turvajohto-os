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
//
// --- Miksi tässä näkyy myös VALVONTA eikä vain sidonta ------------------------------
//
// Ne ovat eri asioita, ja niiden sekoittaminen maksoi 10.9.2026 päivätestin: puhelin oli
// sidottu koko päivän, mutta taustapalvelu ei käynnistynyt kertaakaan. Sidonta kertoo että
// laite on tunnistettu, valvonta että se puhuu. Päivystäjä on ainoa joka näkee tämän
// kaikista laitteista yhtä aikaa, joten hän on myös ainoa joka voi huomata sen.

const paiva = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric', year: 'numeric' });
};

const hetki = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tanaan = new Date().toDateString() === d.toDateString();
  const kello = d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
  return tanaan ? `klo ${kello}` : `${paiva(iso)} klo ${kello}`;
};

// Kuinka usein lista päivittyy itsestään. Ilman tätä "valvonta käynnissä" jäisi ruudulle
// sellaisenaan senkin jälkeen kun laite on hiljentynyt — ja pysähtynyt tilatieto on
// pahempi kuin ei tilatietoa, koska se näyttää samalta kuin toimiva.
const PAIVITYSVALI_MS = 60 * 1000;

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

  useEffect(() => {
    const ajastin = window.setInterval(hae, PAIVITYSVALI_MS);
    return () => window.clearInterval(ajastin);
  }, [hae]);

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
                <span className="mt-1 flex items-center gap-1.5 text-sm">
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 rounded-full ${laite.valvontaElossa ? 'bg-success' : 'bg-ink-muted/40'}`}
                  />
                  {laite.valvontaElossa ? (
                    <span className="text-success-ink">Valvonta käynnissä</span>
                  ) : laite.viimeinenLyonti ? (
                    <span className="text-ink-muted">
                      Valvonta ei käynnissä · viimeksi {hetki(laite.viimeinenLyonti)}
                    </span>
                  ) : (
                    <span className="text-ink-muted">Valvonta ei ole käynnistynyt kertaakaan</span>
                  )}
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
