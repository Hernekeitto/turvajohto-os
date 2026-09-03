// Tiedotteet: kehote kaikkien näkymien yllä ja koko näkymä omalla sivullaan.
//
// KEHOTE ON JUURESSA samasta syystä kuin hälytysvahti: tiedote jonka näkee vain
// tiedotesivulla tavoittaa ne jotka olisivat lukeneet sen muutenkin. Kuittaamaton
// voimassa oleva tiedote on ainoa asia joka nostetaan käyttäjän eteen kesken työn.
//
// VANHENTUNUT TIEDOTE EI ENÄÄ KEHOTA. Kolmen päivän takainen porttiohje ei ole se asia
// jota vuoroon tulevan pitää ensimmäisenä kuitata — se jää historiaan luettavaksi.
import { useEffect, useState } from 'react';
import { Megaphone, Check, Ban, Users, Clock } from 'lucide-react';

import {
  VOIMASSA_VALINNAT, aikaleima, haeKuittaamatta, kuittaaTiedote, lahetaTiedote, onKuitannut,
  onVoimassa, peruTiedote, type Tiedote,
} from '../tiedotteet';

type KehoteProps = {
  ownerId: string | null;
  kayttaja: string;
  tiedotteet: Tiedote[];
  onMuutos: (tiedote: Tiedote) => void;
};

export const TiedoteKehote = ({ ownerId, kayttaja, tiedotteet, onMuutos }: KehoteProps) => {
  const [tyoskentelee, setTyoskentelee] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);

  const odottavat = tiedotteet.filter(
    (t) => t.ownerId === ownerId && onVoimassa(t) && !onKuitannut(t, kayttaja)
  );
  if (odottavat.length === 0) return null;

  const kuittaa = async (t: Tiedote) => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = await kuittaaTiedote(t.id);
      if (tulos.ok && tulos.tiedote) onMuutos(tulos.tiedote);
      else setVirhe(tulos.error || 'Kuittaus ei onnistunut.');
    } finally {
      setTyoskentelee(false);
    }
  };

  return (
    <div className="space-y-3 mb-4">
      {odottavat.map((t) => (
        <div key={t.id} className="bg-warning-soft border-2 border-warning rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Megaphone size={20} className="text-warning-ink shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-warning-ink">{t.otsikko}</p>
              <p className="text-sm text-warning-ink/90 mt-1 whitespace-pre-wrap">{t.viesti}</p>
              <p className="text-xs text-warning-ink/70 mt-1">{t.laatija} · {aikaleima(t.luotu)}</p>
              <button
                type="button"
                disabled={tyoskentelee}
                onClick={() => kuittaa(t)}
                className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-warning-ink hover:opacity-90 disabled:opacity-60 text-white font-bold rounded-lg px-5 py-3 transition-opacity"
              >
                <Check size={18} />
                Kuittaa luetuksi
              </button>
            </div>
          </div>
        </div>
      ))}
      {virhe && (
        <p className="text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">{virhe}</p>
      )}
    </div>
  );
};

type Props = {
  ownerId: string;
  ownerNimi: string;
  kayttaja: string;
  tiedotteet: Tiedote[];
  saaLahettaa: boolean;
  onMuutos: (tiedote: Tiedote) => void;
};

export const Tiedotteet = ({ ownerId, ownerNimi, kayttaja, tiedotteet, saaLahettaa, onMuutos }: Props) => {
  const [otsikko, setOtsikko] = useState('');
  const [viesti, setViesti] = useState('');
  const [voimassa, setVoimassa] = useState(12);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [ilmoitus, setIlmoitus] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);
  const [puuttuvat, setPuuttuvat] = useState<Record<string, { vastaanottajia: number; kuittaamatta: { username: string; nimi: string }[] }>>({});

  const omat = tiedotteet
    .filter((t) => t.ownerId === ownerId)
    .sort((a, b) => String(b.luotu).localeCompare(String(a.luotu)));
  const voimassaOlevat = omat.filter((t) => onVoimassa(t));
  const vanhat = omat.filter((t) => !onVoimassa(t)).slice(0, 20);

  // Kuittaustilanne haetaan vain voimassa oleville: vanhentuneen tiedotteen
  // kuittaamattomien lista ei ole toimenpide vaan historiaa, ja sen laskeminen joka
  // haussa kuormittaisi turhaan.
  useEffect(() => {
    if (!saaLahettaa) return;
    let peruttu = false;
    (async () => {
      for (const t of voimassaOlevat) {
        const tulos = await haeKuittaamatta(t.id);
        if (peruttu || !tulos) continue;
        setPuuttuvat((edelliset) => ({ ...edelliset, [t.id]: tulos }));
      }
    })();
    return () => { peruttu = true; };
    // Riippuvuutena id-lista eikä olio: muuten haku ajettaisiin joka renderillä.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saaLahettaa, voimassaOlevat.map((t) => `${t.id}:${t.kuittaukset.length}`).join(',')]);

  const laheta = async () => {
    setVirhe(null);
    setIlmoitus(null);
    setTyoskentelee(true);
    try {
      const tulos = await lahetaTiedote({ ownerId, otsikko, viesti, voimassaTuntia: voimassa });
      if (tulos.ok && tulos.tiedote) {
        onMuutos(tulos.tiedote);
        setOtsikko('');
        setViesti('');
        setIlmoitus(
          tulos.vastaanottajia
            ? `Tiedote lähetetty. Kuittausta odotetaan ${tulos.vastaanottajia} käyttäjältä.`
            : 'Tiedote lähetetty, mutta yhdelläkään käyttäjällä ei ole oikeutta nähdä sitä — tarkista käyttäjätasot.'
        );
      } else {
        setVirhe(tulos.error || 'Lähetys epäonnistui.');
      }
    } finally {
      setTyoskentelee(false);
    }
  };

  const toiminto = async (tehtava: () => Promise<{ ok: boolean; error?: string; tiedote?: Tiedote }>) => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = await tehtava();
      if (tulos.ok && tulos.tiedote) onMuutos(tulos.tiedote);
      else setVirhe(tulos.error || 'Toiminto epäonnistui.');
    } finally {
      setTyoskentelee(false);
    }
  };

  const rivi = (t: Tiedote) => {
    const tilanne = puuttuvat[t.id];
    return (
      <li key={t.id} className="bg-surface border border-line rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-ink-strong">{t.otsikko}</p>
            <p className="text-xs text-ink-muted mt-0.5">
              {t.laatija} · {aikaleima(t.luotu)}
              {t.peruttu ? ' · PERUTTU' : onVoimassa(t) ? ` · voimassa ${aikaleima(t.vanhenee)} asti` : ' · vanhentunut'}
            </p>
          </div>
          {/* Osoittaja lasketaan ODOTETUISTA vastaanottajista eikä kaikista kuittauksista:
              pääkäyttäjät eivät ole vastaanottajajoukossa (ks. server/index.js:
              tiedotteenVastaanottajat), joten heidän kuittauksensa tuottaisi muuten
              lukemia kuten "1/1 kuitannut, 1 kuittaamatta". Ilman kuittaustilannetta
              näytetään pelkkä kuittausten määrä. */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-sunken text-ink-body border border-line-soft shrink-0">
            <Users size={12} />
            {tilanne && tilanne.vastaanottajia > 0
              ? `${tilanne.vastaanottajia - tilanne.kuittaamatta.length}/${tilanne.vastaanottajia}`
              : t.kuittaukset.length}
            {' '}kuitannut
          </span>
        </div>

        <p className="text-sm text-ink-body mt-2 whitespace-pre-wrap">{t.viesti}</p>

        {onKuitannut(t, kayttaja) ? (
          <p className="text-xs text-success-ink mt-2 inline-flex items-center gap-1">
            <Check size={12} />
            Olet kuitannut tämän
          </p>
        ) : onVoimassa(t) ? (
          <button
            type="button"
            disabled={tyoskentelee}
            onClick={() => toiminto(() => kuittaaTiedote(t.id))}
            className="mt-3 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-4 py-2 transition-colors"
          >
            <Check size={16} />
            Kuittaa luetuksi
          </button>
        ) : null}

        {saaLahettaa && tilanne && tilanne.kuittaamatta.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line-soft">
            <p className="text-xs font-medium text-ink-body mb-1">Kuittaamatta ({tilanne.kuittaamatta.length}):</p>
            <p className="text-xs text-ink-muted">
              {tilanne.kuittaamatta.map((k) => k.nimi).join(', ')}
            </p>
          </div>
        )}

        {saaLahettaa && onVoimassa(t) && (
          <button
            type="button"
            disabled={tyoskentelee}
            onClick={() => toiminto(() => peruTiedote(t.id))}
            className="mt-3 ml-3 inline-flex items-center gap-1.5 text-ink-muted hover:text-danger text-xs font-medium"
          >
            <Ban size={13} />
            Peru tiedote
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-ink-strong">Tiedotteet</h3>
        <p className="text-sm text-ink-muted">
          Viesti kentälle, jonka lukeminen kuitataan. Näkyy sovelluksessa kaikille joilla on
          lukuoikeus — ei tekstiviestinä. {ownerNimi}
        </p>
      </div>

      {virhe && (
        <p className="mb-4 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">{virhe}</p>
      )}
      {ilmoitus && (
        <p className="mb-4 text-sm text-success-ink bg-success-soft border border-success/30 rounded-lg px-4 py-3">{ilmoitus}</p>
      )}

      {saaLahettaa && (
        <div className="bg-surface border border-line rounded-xl p-4 md:p-5 mb-6">
          <h4 className="font-bold text-ink-strong mb-3 flex items-center gap-2">
            <Megaphone size={18} className="text-ink-muted" />
            Uusi tiedote
          </h4>
          <label className="block mb-3">
            <span className="block text-sm font-medium text-ink-body mb-1">Otsikko</span>
            <input
              type="text"
              value={otsikko}
              onChange={(e) => setOtsikko(e.target.value)}
              placeholder="Esim. Portti 3 suljetaan klo 21"
              className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2.5 text-sm text-ink-strong"
            />
          </label>
          <label className="block mb-3">
            <span className="block text-sm font-medium text-ink-body mb-1">Viesti</span>
            <textarea
              value={viesti}
              onChange={(e) => setViesti(e.target.value)}
              rows={3}
              placeholder="Mitä tehdään ja mistä alkaen."
              className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2.5 text-sm text-ink-strong"
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-ink-body mb-1">Kuittausta odotetaan</span>
              <select
                value={voimassa}
                onChange={(e) => setVoimassa(Number(e.target.value))}
                className="bg-sunken border border-line-soft rounded-lg px-3 py-2.5 text-sm text-ink-strong"
              >
                {VOIMASSA_VALINNAT.map((h) => <option key={h} value={h}>{h} tuntia</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={laheta}
              disabled={tyoskentelee}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-sm font-bold rounded-lg px-5 py-3 transition-colors"
            >
              <Megaphone size={16} />
              Lähetä tiedote
            </button>
          </div>
        </div>
      )}

      {voimassaOlevat.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-bold text-ink-strong mb-2 flex items-center gap-1.5">
            <Clock size={14} />
            Voimassa
          </h4>
          <ul className="space-y-3">{voimassaOlevat.map(rivi)}</ul>
        </div>
      )}

      <div>
        <h4 className="text-sm font-bold text-ink-strong mb-2">Aiemmat</h4>
        {vanhat.length === 0 ? (
          <p className="text-sm text-ink-muted bg-sunken border border-line-soft rounded-lg p-4">
            Ei aiempia tiedotteita.
          </p>
        ) : (
          <ul className="space-y-3">{vanhat.map(rivi)}</ul>
        )}
      </div>
    </div>
  );
};
