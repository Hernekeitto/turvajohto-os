// PTT-kanavan viestiketju (erä 26, vaihe 5, viipale 5b). Rakentuu kokonaan vaiheen 3
// valmiiden moduulien päälle (src/shared/viestit.ts, viestijono.ts, salatutliitteet.ts,
// olm.ts) — tämä tiedosto ei tee mitään kryptografiaa itse, vain näyttää ja kerää syötteen.
//
// EPHEMERAL-MUISTUTUS (suunnitelman kohta 6): keskustelu ei ole pysyvä arkisto, se
// poistuu vuoron mukana (server/index.js: vuoron/hälytyksen elinkaari — ks. Obsidian
// "vaihe 3 -suunnitelma" kohta 7, joka on yhä toteuttamatta). Käyttöliittymä sanoo tämän
// ääneen samalla läpinäkyvyysperiaatteella kuin taustaherätyksen rajoite MobiiliKehyksessä.
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { OlmMachine } from '@matrix-org/matrix-sdk-crypto-wasm';
import { X, Send, Paperclip, Check, CheckCheck } from 'lucide-react';

import { haeJaPuraViestit, lahetaLiiteviesti, kuittaaViesti, type Viesti } from '../../shared/viestit.ts';
import { jonotaTekstiviesti, jonossaOlevat, type JonoRivi } from '../../shared/viestijono.ts';
import { haeJaPuraLiite, LIITTEEN_ENIMMAISKOKO, type Liiteosoitin } from '../../shared/salatutliitteet.ts';
import type { Kanava } from './kanavapalkki.ts';
import type { ViestiHerate } from './kayttoPttPalkkia.ts';
import {
  yhdistaViestit, kuittaustiivistelma, paattelePaattyyppi, onLiite, type NaytettavaViesti,
} from './viestinakyma.ts';

const JONO_TARKISTUSVALI_MS = 2_000;

type Props = {
  machine: OlmMachine | null;
  omaKayttaja: string | null;
  kanava: Kanava;
  herate: ViestiHerate;
  onLahetaJono: () => void;
  onSulje: () => void;
};

export const KanavaViestit = ({ machine, omaKayttaja, kanava, herate, onLahetaJono, onSulje }: Props) => {
  const [viestit, setViestit] = useState<Viesti[]>([]);
  const [jono, setJono] = useState<JonoRivi[]>(() => jonossaOlevat());
  const [lataus, setLataus] = useState(true);
  const [teksti, setTeksti] = useState('');
  const [liiteLataus, setLiiteLataus] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [avatutLiitteet, setAvatutLiitteet] = useState<Record<string, string>>({});
  const listaRef = useRef<HTMLDivElement>(null);

  const haeViestit = useCallback(() => {
    if (!machine) return;
    haeJaPuraViestit(machine, kanava.id).then((v) => {
      setViestit(v);
      setLataus(false);
      // Automaattiset kuittaukset: toimitus heti kun viesti on purettu ja näkyy tässä
      // ketjussa, ja hätäkanavalla myös luku (server/kuittaukset.js: sallitutKuittaustyypit
      // sallii lukukuittauksen vain sille). Ei koske omia viestejä.
      for (const viesti of v) {
        if (viesti.lahettaja === omaKayttaja) continue;
        const omat = new Set(viesti.kuittaukset.filter((k) => k.kayttaja === omaKayttaja).map((k) => k.tyyppi));
        if (!omat.has('toimitus')) kuittaaViesti(viesti.id, 'toimitus').catch(() => {});
        if (kanava.tyyppi === 'hata' && !omat.has('luku')) kuittaaViesti(viesti.id, 'luku').catch(() => {});
      }
    }).catch(() => setLataus(false));
  }, [machine, kanava.id, kanava.tyyppi, omaKayttaja]);

  useEffect(() => {
    if (!machine) return;
    if (herate.kanavaId === null || herate.kanavaId === kanava.id) haeViestit();
  }, [machine, herate, kanava.id, haeViestit]);

  // Jonon tila on pelkkää localStoragea eikä kanavan omasta WS-herätteestä näkyvä — luetaan
  // säännöllisesti sen ajan kun ketju on auki, jotta "lähetetään…" -rivi katoaa kun
  // taustalla pyörivä uudelleenyritys (kayttoPttPalkkia.ts) onnistuu.
  //
  // PALVELIN EI LÄHETÄ uusi_viesti-herätettä LÄHETTÄJÄLLE ITSELLEEN (server/index.js:
  // kerroViestista suodattaa pois `istunto.username === viesti.lahettaja`, tarkoituksella
  // — lähettäjä tietää jo oman viestinsä). Siksi omaa juuri lähetettyä viestiä EI näkyisi
  // ketjussa lainkaan ilman tätä: kun tämän kanavan jonorivi katoaa (onnistui), haetaan
  // viestit uudelleen, koska mikään WS-heräte ei kerro siitä.
  useEffect(() => {
    const ajastin = setInterval(() => {
      setJono((edellinen) => {
        const uusi = jonossaOlevat();
        const omiaEnnen = edellinen.filter((r) => r.kanavaId === kanava.id).length;
        const omiaNyt = uusi.filter((r) => r.kanavaId === kanava.id).length;
        if (omiaNyt < omiaEnnen) haeViestit();
        return uusi;
      });
    }, JONO_TARKISTUSVALI_MS);
    return () => clearInterval(ajastin);
  }, [kanava.id, haeViestit]);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
  }, [viestit, jono]);

  useEffect(() => () => {
    for (const url of Object.values(avatutLiitteet)) URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avaaLiite = useCallback((osoitin: Liiteosoitin) => {
    if (avatutLiitteet[osoitin.liiteId]) return;
    haeJaPuraLiite(osoitin).then((url) => {
      setAvatutLiitteet((edelliset) => ({ ...edelliset, [osoitin.liiteId]: url }));
    }).catch(() => setVirhe('Liitteen avaaminen epäonnistui.'));
  }, [avatutLiitteet]);

  const laheta = () => {
    const sisalto = teksti.trim();
    if (!sisalto) return;
    jonotaTekstiviesti(kanava.id, sisalto);
    setTeksti('');
    setJono(jonossaOlevat());
    onLahetaJono();
  };

  const valitseLiite = (e: ChangeEvent<HTMLInputElement>) => {
    const tiedosto = e.target.files?.[0];
    e.target.value = '';
    if (!tiedosto || !machine || !omaKayttaja) return;
    if (tiedosto.size > LIITTEEN_ENIMMAISKOKO) {
      setVirhe('Liite on liian suuri (enintään 15 Mt).');
      return;
    }
    setVirhe(null);
    setLiiteLataus(true);
    lahetaLiiteviesti(machine, omaKayttaja, kanava.id, tiedosto, paattelePaattyyppi(tiedosto.type))
      .then((tulos) => {
        setLiiteLataus(false);
        if (!tulos.ok) setVirhe(tulos.error);
        else haeViestit();
      });
  };

  const rivit = yhdistaViestit(viestit, jono, kanava.id);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-surface">
      <header className="shrink-0 flex items-center gap-2 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-surface-dark text-ink-on-dark">
        <button
          type="button"
          onClick={onSulje}
          aria-label="Sulje viestit"
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-white/10"
        >
          <X size={24} />
        </button>
        <p className="flex-1 min-w-0 truncate text-base font-medium">{kanava.nimi}</p>
      </header>

      <p className="shrink-0 px-3 py-1.5 text-xs text-ink-muted bg-sunken border-b border-line-soft">
        Tämä keskustelu poistuu vuoron päätyttyä — ei pysyvä arkisto.
      </p>

      <div ref={listaRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {lataus && rivit.length === 0 && <p className="text-sm text-ink-muted text-center mt-4">Haetaan viestejä…</p>}
        {!lataus && rivit.length === 0 && <p className="text-sm text-ink-muted text-center mt-4">Ei vielä viestejä.</p>}
        {rivit.map((rivi) => (
          <ViestiKupla
            key={rivi.tila === 'lahetetty' ? rivi.viesti.id : rivi.jonoId}
            rivi={rivi}
            omaKayttaja={omaKayttaja}
            kanava={kanava}
            avattuUrl={rivi.tila === 'lahetetty' && onLiite(rivi.viesti.sisalto) ? avatutLiitteet[rivi.viesti.sisalto.liiteId] : undefined}
            onAvaaLiite={avaaLiite}
          />
        ))}
      </div>

      {virhe && <p className="shrink-0 px-3 py-1.5 text-sm text-danger bg-danger-soft">{virhe}</p>}

      <div className="shrink-0 flex items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-line-soft">
        <label className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-ink-muted hover:bg-sunken cursor-pointer">
          <Paperclip size={22} />
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            disabled={!machine || liiteLataus}
            onChange={valitseLiite}
          />
        </label>
        <input
          type="text"
          value={teksti}
          onChange={(e) => setTeksti(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') laheta(); }}
          placeholder="Viesti…"
          className="flex-1 min-w-0 rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink"
        />
        <button
          type="button"
          onClick={laheta}
          disabled={!teksti.trim()}
          aria-label="Lähetä"
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-accent text-white disabled:opacity-40"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

const ViestiKupla = ({
  rivi, omaKayttaja, kanava, avattuUrl, onAvaaLiite,
}: {
  rivi: NaytettavaViesti; omaKayttaja: string | null; kanava: Kanava;
  avattuUrl: string | undefined; onAvaaLiite: (osoitin: Liiteosoitin) => void;
}) => {
  if (rivi.tila === 'jonossa') {
    return (
      <div className="self-end max-w-[80%] rounded-xl rounded-br-sm bg-accent-soft px-3 py-2">
        <p className="text-sm text-ink whitespace-pre-wrap break-words">{rivi.teksti}</p>
        <p className="text-xs text-ink-muted italic mt-0.5">lähetetään…</p>
      </div>
    );
  }

  const { viesti } = rivi;
  const oma = viesti.lahettaja === omaKayttaja;

  return (
    <div className={`max-w-[80%] rounded-xl px-3 py-2 ${oma ? 'self-end rounded-br-sm bg-accent-soft' : 'self-start rounded-bl-sm bg-sunken'}`}>
      {!oma && <p className="text-xs font-bold text-ink-muted mb-0.5">{viesti.lahettaja}</p>}
      <SisaltoNaytto sisalto={viesti.sisalto} avattuUrl={avattuUrl} onAvaaLiite={onAvaaLiite} />
      {oma && <Kuittausrivi viesti={viesti} kanava={kanava} />}
    </div>
  );
};

const SisaltoNaytto = ({
  sisalto, avattuUrl, onAvaaLiite,
}: { sisalto: unknown; avattuUrl: string | undefined; onAvaaLiite: (osoitin: Liiteosoitin) => void }) => {
  if (sisalto === null) return <p className="text-sm text-ink-muted italic">Odottaa avainta…</p>;

  if (onLiite(sisalto)) {
    if (sisalto.msgtype === 'm.image') {
      if (!avattuUrl) {
        // Kuvat haetaan ja puretaan heti — pieniä ja keskeisiä keskustelun luettavuudelle.
        onAvaaLiite(sisalto);
        return <p className="text-sm text-ink-muted italic">Ladataan kuvaa…</p>;
      }
      return <img src={avattuUrl} alt={sisalto.nimi || 'Liite'} className="max-w-full rounded-lg" />;
    }
    if (avattuUrl && sisalto.msgtype === 'm.video') {
      return <video src={avattuUrl} controls className="max-w-full rounded-lg" />;
    }
    return (
      <button
        type="button"
        onClick={() => onAvaaLiite(sisalto)}
        className="text-sm font-medium text-accent-ink underline"
      >
        {sisalto.msgtype === 'm.video' ? 'Näytä video' : `Lataa: ${sisalto.nimi || 'tiedosto'}`}
      </button>
    );
  }

  const teksti = typeof sisalto === 'object' && sisalto !== null && 'body' in sisalto
    ? String((sisalto as { body: unknown }).body) : null;
  return <p className="text-sm text-ink whitespace-pre-wrap break-words">{teksti ?? '(tuntematon sisältö)'}</p>;
};

const Kuittausrivi = ({ viesti, kanava }: { viesti: Viesti; kanava: Kanava }) => {
  const { toimitettu, luettu } = kuittaustiivistelma(viesti.kuittaukset, kanava.tyyppi);
  if (toimitettu === 0 && !luettu) return null;
  return (
    <p className="flex items-center gap-1 mt-1 text-xs text-ink-muted">
      {luettu ? <CheckCheck size={13} className="text-accent-ink" /> : <Check size={13} />}
      {luettu ? `luettu (${luettu})` : `toimitettu (${toimitettu})`}
    </p>
  );
};
