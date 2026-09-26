// Radiopuhelin-sivu (erä 26, käyttäjän pyyntö 26.9.2026): korvaa pienen, kuvaruutuun
// huonosti sopineen ponnahdusvalikon (PttPainike.tsx:n `PttPainikkeenSisalto`, joka
// jäi mobiilikäytöstä pois) kokoruutuisella sivulla jota vaihdetaan yläpalkin
// radiopuhelin-ikonista (MobiiliKehys.tsx: `radioAuki`). Kaksi välilehteä käyttäjän
// oman jaon mukaan: "Kanavat" (mikä on nyt lähetyksessä/kuuntelussa + muokkaus) ja
// "Ryhmät" (oletusryhmät + haku muille vuorossa oleville yksityisviestiä varten).
//
// SAA `ptt`-TILAN PROPSINA EIKÄ KUTSU usePttPalkkia:aa ITSE — sama rajoite ja sama
// perustelu kuin PttPainike.tsx:n `PttPainikkeenSisalto`:lla oli: MobiiliKehys.tsx on
// ainoa kutsuja koko mobiilipuolella, ja toinen kutsu avaisi toisen mikrofoniefektin
// joka yrittäisi lähettää ääntä kahdesti samalle myönnetylle puheenvuorolle.
//
// KanavaViestit renderöidään TÄSTÄ tiedostosta ILMAN erillistä `fixed`-kääriä, toisin
// kuin PttPainike.tsx:ssä piti tehdä sen 32×32 napin kohdalla — tämän sivun (ja koko
// RadioNakyma-puun) mikään esi-isä `<main>`:iin asti ei ole itse asemoitu, joten
// KanavaViestit.tsx:n `absolute inset-0` kelluu luonnostaan aina .mobiili-kehys asti
// ja täyttää koko ruudun, täsmälleen kuten PttPalkki.tsx:n oma käyttö jo tekee.
import { useState } from 'react';
import {
  MessageSquare, Volume2, VolumeX, ShieldAlert, Search, Send, Radio as RadioIcon,
} from 'lucide-react';

import { usePttPalkkia } from './kayttoPttPalkkia.ts';
import { chipKanavat, hatakanavat, voiMykistaa, type Kanava } from './kanavapalkki.ts';
import { KanavaViestit } from './KanavaViestit.tsx';

type Ptt = ReturnType<typeof usePttPalkkia>;

type Ehdokas = { username: string; nimi: string };

export const RadioNakyma = ({ ptt }: { ptt: Ptt }) => {
  const [valilehti, setValilehti] = useState<'kanavat' | 'ryhmat'>('kanavat');
  const [viestitAuki, setViestitAuki] = useState<Kanava | null>(null);

  const chipit = chipKanavat(ptt.kanavat);
  const hatat = hatakanavat(ptt.kanavat);

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 rounded-xl bg-sunken p-1 mb-3 shrink-0">
        <TabNappi label="Kanavat" aktiivinen={valilehti === 'kanavat'} onClick={() => setValilehti('kanavat')} />
        <TabNappi label="Ryhmät" aktiivinen={valilehti === 'ryhmat'} onClick={() => setValilehti('ryhmat')} />
      </div>

      {ptt.salausVirhe && (
        <p className="mb-3 text-sm text-danger-ink">
          Salauksen alustus epäonnistui: {ptt.salausVirhe} — viestit eivät ole käytettävissä.
        </p>
      )}

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {valilehti === 'kanavat' ? (
          <KanavatValilehti ptt={ptt} chipit={chipit} hatat={hatat} onViestit={setViestitAuki} />
        ) : (
          <RyhmatValilehti ptt={ptt} onViestit={setViestitAuki} />
        )}
      </div>

      {viestitAuki && (
        <KanavaViestit
          machine={ptt.machine}
          omaKayttaja={ptt.omaKayttaja}
          kanava={viestitAuki}
          herate={ptt.viestiHerate}
          onLahetaJono={ptt.yritaLahettaaJono}
          onSulje={() => setViestitAuki(null)}
        />
      )}
    </div>
  );
};

const TabNappi = ({ label, aktiivinen, onClick }: { label: string; aktiivinen: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={aktiivinen}
    className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
      aktiivinen ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'
    }`}
  >
    {label}
  </button>
);

const KanavatValilehti = ({
  ptt, chipit, hatat, onViestit,
}: { ptt: Ptt; chipit: Kanava[]; hatat: Kanava[]; onViestit: (k: Kanava) => void }) => (
  <div className="flex flex-col gap-2">
    {hatat.map((h) => (
      <div key={h.id} className="flex items-center gap-2.5 rounded-xl bg-danger-soft border border-danger/40 px-3.5 py-3">
        <ShieldAlert size={18} className="text-danger shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-danger-ink truncate">{h.nimi}</p>
          <p className="text-xs text-ink-muted truncate">
            {ptt.tilat[h.id]
              ? (ptt.tilat[h.id]?.mina ? 'Lähetät' : `Kuuntelet: ${ptt.tilat[h.id]?.kayttaja}`)
              : h.haltePidaHengissa
                ? `Linja pakotettu auki — ${h.haltePidaHengissa.kayttaja}`
                : 'Vapaana'}
          </p>
        </div>
        {ptt.tilat[h.id]?.mina && (
          <button
            type="button"
            onClick={() => ptt.vapautaPuheenvuoro(h.id)}
            className="shrink-0 rounded-lg bg-danger/20 px-2.5 py-1.5 text-xs font-bold text-danger-ink"
          >
            Lopeta
          </button>
        )}
        <button
          type="button"
          onClick={() => onViestit(h)}
          aria-label={`Viestit: ${h.nimi}`}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-danger-ink hover:bg-white/30"
        >
          <MessageSquare size={17} />
        </button>
      </div>
    ))}

    {chipit.length === 0 && hatat.length === 0 && (
      <p className="text-sm text-ink-muted text-center py-6">Ei kanavia juuri nyt.</p>
    )}

    {chipit.map((k) => {
      const tila = ptt.tilat[k.id];
      const aktiivinen = k.id === ptt.aktiivinenId;
      const mykistetty = ptt.mykistetyt.has(k.id);
      return (
        <div
          key={k.id}
          className={`rounded-xl border px-3.5 py-3 ${
            aktiivinen ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
          }`}
        >
          <button type="button" onClick={() => ptt.setAktiivinenId(k.id)} className="w-full flex items-center gap-2.5 text-left">
            {tila && <span className="w-2 h-2 shrink-0 rounded-full bg-danger animate-pulse" aria-hidden="true" />}
            <div className={`min-w-0 flex-1 ${mykistetty ? 'opacity-50' : ''}`}>
              <p className="text-sm font-bold text-ink truncate">{k.nimi || k.id}</p>
              <p className="text-xs text-ink-muted truncate">
                {tila ? (tila.mina ? 'LÄHETÄT' : `Kuuntelet: ${tila.kayttaja}`) : aktiivinen ? 'Valittu lähetykseen' : 'Vapaana'}
              </p>
            </div>
            {aktiivinen && <RadioIcon size={16} className="text-accent shrink-0" />}
          </button>
          <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-line-soft">
            {voiMykistaa(k) && (
              <button
                type="button"
                onClick={() => ptt.asetaMykistys(k.id, !mykistetty)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-ink-subtle hover:bg-sunken"
              >
                {mykistetty ? <VolumeX size={14} /> : <Volume2 size={14} />}
                {mykistetty ? 'Ei kuunnella' : 'Kuunnellaan'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onViestit(k)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-ink-subtle hover:bg-sunken"
            >
              <MessageSquare size={14} />
              Viestit
            </button>
          </div>
        </div>
      );
    })}
  </div>
);

const RyhmatValilehti = ({ ptt, onViestit }: { ptt: Ptt; onViestit: (k: Kanava) => void }) => {
  const oletusryhmat = ptt.kanavat.filter((k) => k.tyyppi === 'kohde' || k.tyyppi === 'alue');
  const omatViestit = ptt.kanavat.filter((k) => k.tyyppi === 'dm');

  const [haku, setHaku] = useState('');
  const [ehdokkaat, setEhdokkaat] = useState<Ehdokas[] | null>(null);
  const [hakuVirhe, setHakuVirhe] = useState<string | null>(null);
  const [lahetetaanKayttajalle, setLahetetaanKayttajalle] = useState<string | null>(null);

  const haeEhdokkaat = () => {
    setHakuVirhe(null);
    fetch('/api/kanavat/dm/ehdokkaat', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setEhdokkaat(d.ehdokkaat || []);
        else setHakuVirhe(d?.error || 'Haku epäonnistui.');
      })
      .catch(() => setHakuVirhe('Haku epäonnistui: ei yhteyttä palvelimeen.'));
  };

  const aloitaViesti = (vastaanottaja: string) => {
    setLahetetaanKayttajalle(vastaanottaja);
    fetch('/api/kanavat/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ vastaanottaja }),
    })
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        setLahetetaanKayttajalle(null);
        if (d?.ok && d.kanava) onViestit(d.kanava as Kanava);
        else setHakuVirhe(d?.error || 'Viestin aloitus epäonnistui.');
      })
      .catch(() => {
        setLahetetaanKayttajalle(null);
        setHakuVirhe('Viestin aloitus epäonnistui: ei yhteyttä palvelimeen.');
      });
  };

  const suodatetut = (ehdokkaat || []).filter((e) => (
    haku.trim() === '' || e.nimi.toLowerCase().includes(haku.trim().toLowerCase())
  ));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-subtle mb-2">Oletusryhmät</h3>
        {oletusryhmat.length === 0 ? (
          <p className="text-sm text-ink-muted">Ei oletusryhmiä — vuoro ei ole käynnissä.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {oletusryhmat.map((k) => <RyhmaRivi key={k.id} kanava={k} onAvaa={() => onViestit(k)} />)}
          </div>
        )}
      </div>

      {omatViestit.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-subtle mb-2">Omat viestiketjut</h3>
          <div className="flex flex-col gap-1.5">
            {omatViestit.map((k) => <RyhmaRivi key={k.id} kanava={k} onAvaa={() => onViestit(k)} />)}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-subtle mb-2">Hae vartija</h3>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
          <Search size={16} className="text-ink-subtle shrink-0" />
          <input
            type="text"
            value={haku}
            onChange={(e) => { setHaku(e.target.value); if (ehdokkaat === null) haeEhdokkaat(); }}
            onFocus={() => { if (ehdokkaat === null) haeEhdokkaat(); }}
            placeholder="Nimi…"
            className="flex-1 min-w-0 bg-transparent text-sm text-ink outline-none"
          />
        </div>

        {hakuVirhe && <p className="text-sm text-danger-ink mt-2">{hakuVirhe}</p>}

        {ehdokkaat !== null && (
          <div className="flex flex-col gap-1.5 mt-2">
            {suodatetut.length === 0 ? (
              <p className="text-sm text-ink-muted py-2">Ei muita vuorossa olevia juuri nyt.</p>
            ) : (
              suodatetut.map((e) => (
                <div key={e.username} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5">
                  <p className="min-w-0 flex-1 text-sm font-medium text-ink truncate">{e.nimi}</p>
                  <button
                    type="button"
                    onClick={() => aloitaViesti(e.username)}
                    disabled={lahetetaanKayttajalle === e.username}
                    aria-label={`Lähetä viesti: ${e.nimi}`}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    <Send size={13} />
                    Viesti
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const RyhmaRivi = ({ kanava, onAvaa }: { kanava: Kanava; onAvaa: () => void }) => (
  <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5">
    <p className="min-w-0 flex-1 text-sm font-medium text-ink truncate">{kanava.nimi || kanava.id}</p>
    <button
      type="button"
      onClick={onAvaa}
      aria-label={`Avaa viestit: ${kanava.nimi}`}
      className="shrink-0 flex items-center gap-1.5 rounded-lg py-1.5 px-2.5 text-xs font-medium text-ink-subtle hover:bg-sunken"
    >
      <MessageSquare size={14} />
      Viestit
    </button>
  </div>
);
