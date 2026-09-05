// Tilatieto: vartijan kuittaus siitä että hän on kentällä ja missä tilanteessa.
//
// Tilatieto tallennetaan TOIMENPIDEKIRJAUKSENA (guardReports, typeId guard_action) eikä
// omana kokoelmanaan. Syy on se, että sillä on jo kaikki mitä tarvitaan — kirjaaja, aika,
// kohde ja teksti — ja se näkyy sellaisenaan hälytyskeskuksen tapahtumavirrassa ja
// kentällä olevien listassa (guard/tilannekuva.ts). Oma kokoelma tarkoittaisi uuden
// tietolajin, oikeussolmun ja säilytysajan keksimistä sille, että vartija sanoo
// olevansa kunnossa.
//
// Kirjaus menee lähtevän jonon kautta, joten se ei katoa katvealueella vaan lähtee kun
// yhteys palaa (ks. shared/jono.ts).
import { useState } from 'react';
import { Send, X } from 'lucide-react';

// Valmiit tilatiedot. Nämä ovat ne viisi asiaa jotka vuoron aikana ilmoitetaan, ja
// valmis nappi on kentällä nopeampi ja luettavampi kuin käsin kirjoitettu teksti.
const VALMIIT = [
  'Kaikki kunnossa',
  'Saavuin kohteeseen',
  'Kierros aloitettu',
  'Kierros päättynyt',
  'Tauolla',
  'Poistun kohteesta',
];

type Props = {
  kohdeNimi: string;
  onLaheta: (teksti: string) => Promise<boolean>;
  onSulje: () => void;
};

export const Tilatieto = ({ kohdeNimi, onLaheta, onSulje }: Props) => {
  const [oma, setOma] = useState('');
  const [lahettaa, setLahettaa] = useState(false);

  const laheta = async (teksti: string) => {
    const siisti = teksti.trim();
    if (!siisti || lahettaa) return;
    setLahettaa(true);
    const ok = await onLaheta(siisti);
    setLahettaa(false);
    if (ok) onSulje();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Sulje"
        onClick={onSulje}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative bg-surface rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[85%] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-bold text-ink-strong">Lähetä tilatieto</h2>
          <button
            type="button"
            onClick={onSulje}
            aria-label="Sulje"
            className="-mt-1 -mr-1 w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-ink-subtle hover:bg-sunken transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-ink-muted mb-4">
          Kirjataan kohteelle {kohdeNimi} ja näkyy hälytyskeskuksessa heti.
        </p>

        <div className="space-y-2 mb-5">
          {VALMIIT.map((teksti) => (
            <button
              key={teksti}
              type="button"
              disabled={lahettaa}
              onClick={() => laheta(teksti)}
              className="w-full text-left rounded-lg border border-line bg-surface hover:bg-sunken px-4 py-3.5 text-[15px] font-medium text-ink transition-colors disabled:opacity-60"
            >
              {teksti}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="block text-sm font-medium text-ink-body mb-1">Oma tilatieto</span>
          <textarea
            value={oma}
            onChange={(e) => setOma(e.target.value)}
            rows={2}
            placeholder="Esim. ovi 3 jäänyt auki, ilmoitettu kiinteistöhuoltoon"
            className="w-full rounded-lg border border-line-strong p-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <button
          type="button"
          disabled={lahettaa || !oma.trim()}
          onClick={() => laheta(oma)}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg py-3 transition-colors disabled:opacity-60"
        >
          <Send size={16} />
          {lahettaa ? 'Lähetetään…' : 'Lähetä'}
        </button>
      </div>
    </div>
  );
};
