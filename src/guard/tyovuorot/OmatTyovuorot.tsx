// Vartijan työvuorotoiveet (erä 5): toiveet tuleville listoille, omat poissaolot ja
// työvoimareserville avoimet vuorot.
//
// Toive EI ole varaus eikä este. Se näkyy vuorosuunnittelijalle, joka päättää listasta.
// Siksi painikkeet ovat "toivon" eivätkä "varaa", ja näkymä kertoo milloin toiveita ei
// enää voi muuttaa: kun listan julkaisun määräaika on ohi, suunnittelija tekee listaa ja
// sen alla muuttuvat toiveet olisivat hiljaisia muutoksia jo tehtyyn työhön.
//
// Erä 6: omat vuorot julkaistuilta listoilta, julkaisun jälkeiset muutokset kuitattaviksi
// ja vuoronvaihdot. Luonnoslistaa ei näytetä: se ei ole vartijan tiedossa ennen julkaisua.

import { useEffect, useState } from 'react';
import { BellRing, CalendarCheck, CalendarHeart, CalendarOff, Lock, Repeat, Users } from 'lucide-react';

import { TakaisinLinkki } from '../../shared/komponentit/TakaisinLinkki';
import {
  asetaOmaToive, haeOmat, haeVaihtoehdokkaat, kuittaaMuutokset, kuittaaVuoro, peruVaihto, pvm, pyydaVaihto, vastaaVaihtoon,
} from './tyoaika';
import type { OmaLista, OmatNakyma, Toive } from './tyoaika';
import { listanPaivat, paivanOtsikko } from './ruudukko';

type Valmis = Extract<OmatNakyma, { suunniteltava: true }>;

const LAJIT: { laji: Toive['laji']; nimi: string; aktiivinen: string }[] = [
  { laji: 'vuoro', nimi: 'Toivon vuoroa', aktiivinen: 'bg-accent text-white border-accent' },
  { laji: 'vapaa', nimi: 'Toivon vapaata', aktiivinen: 'bg-warning-soft text-warning-ink border-warning/50' },
  { laji: 'este', nimi: 'En pääse', aktiivinen: 'bg-danger/15 text-danger border-danger/40' },
];

export const OmatTyovuorot = ({ onTakaisin }: { onTakaisin: () => void }) => {
  const [tila, setTila] = useState<OmatNakyma | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [ilmoitus, setIlmoitus] = useState<string | null>(null);

  useEffect(() => {
    haeOmat().then((v) => (v.ok ? setTila(v) : setVirhe(v.error)));
  }, []);

  const paivita = (v: Awaited<ReturnType<typeof haeOmat>>, onnistui?: string) => {
    if (v.ok) { setTila(v); setVirhe(null); setIlmoitus(onnistui || null); } else { setVirhe(v.error); setIlmoitus(null); }
  };

  return (
    <div>
      <TakaisinLinkki onClick={onTakaisin}>Takaisin</TakaisinLinkki>
      <h2 className="text-2xl font-bold text-ink-strong mb-1">Työvuorot ja toiveet</h2>
      <p className="text-sm text-ink-muted mb-6 leading-relaxed">
        Kerro tuleville listoille, milloin toivot vuoroa tai vapaata. Vuorosuunnittelija näkee
        toiveesi listaa tehdessään. Toive ei ole varaus: lopullinen lista julkaistaan
        viimeistään kaksi viikkoa ennen jakson alkua.
      </p>

      {virhe && <p className="mb-4 text-sm text-danger">{virhe}</p>}
      {ilmoitus && <p className="mb-4 text-sm text-accent-ink">{ilmoitus}</p>}
      {!tila && !virhe && <p className="text-sm text-ink-muted">Luetaan…</p>}
      {tila && !tila.suunniteltava && (
        <p className="text-sm text-ink-muted">Sinulle ei suunnitella työvuoroja tällä tunnuksella.</p>
      )}

      {tila?.suunniteltava && (
        <>
          {tila.muutokset.length > 0 && <Muutokset tila={tila} onTulos={paivita} />}
          <Vaihtopyynnot tila={tila} onTulos={paivita} />
          <OmatVuorot tila={tila} onTulos={paivita} />
          {tila.poissaolot.length > 0 && <OmatPoissaolot tila={tila} />}
          {tila.reservi && <Avoimet tila={tila} onTulos={paivita} />}
          {tila.listat.length === 0 ? (
            <p className="text-sm text-ink-muted">Työvuorosuunnittelua ei ole vielä otettu käyttöön.</p>
          ) : (
            tila.listat.map((l) => <ListanToiveet key={l.alku} lista={l} tila={tila} onTulos={paivita} />)
          )}
        </>
      )}
    </div>
  );
};

const OmatPoissaolot = ({ tila }: { tila: Valmis }) => (
  <section className="mb-6">
    <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-2">
      <CalendarOff size={18} className="text-accent" />
      Kirjatut poissaolot
    </h3>
    <ul className="bg-surface rounded-xl border border-line divide-y divide-line-soft">
      {tila.poissaolot.map((p) => (
        <li key={p.id} className="px-4 py-2 text-sm text-ink-body">
          {tila.poissaololajit[p.laji] || p.laji} {pvm(p.alku)}–{pvm(p.loppu)}
        </li>
      ))}
    </ul>
  </section>
);

// Työvoimareservi (käyttäjän päätös 10.10.2026): reservi ei saa vuoroja listaan
// sijoitettuina vaan kuittaa avoimen vuoron itse. Palvelin tarkistaa kuittauksen samoin
// säännöin kuin suunnittelijan sijoituksen; poikkeamaa ei voi kuitata itse.
const Avoimet = ({ tila, onTulos }: { tila: Valmis; onTulos: (v: Awaited<ReturnType<typeof haeOmat>>, ok?: string) => void }) => {
  const [tyossa, setTyossa] = useState<string | null>(null);
  const kuittaa = async (id: string, kuvaus: string) => {
    if (!window.confirm(`Otetaanko vuoro: ${kuvaus}?`)) return;
    setTyossa(id);
    const v = await kuittaaVuoro(id);
    setTyossa(null);
    onTulos(v, `Vuoro otettu: ${kuvaus}.`);
  };
  return (
    <section className="mb-8">
      <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-1">
        <Users size={18} className="text-accent" />
        Avoimet vuorot
      </h3>
      <p className="text-xs text-ink-muted mb-2">
        Vuorot joihin sinut on perehdytetty ja joihin ei ole vielä ketään. Kuittaus sitoo sinut vuoroon.
      </p>
      {tila.avoimet.length === 0 ? (
        <p className="text-sm text-ink-muted">Ei avoimia vuoroja juuri nyt.</p>
      ) : (
        <ul className="bg-surface rounded-xl border border-line divide-y divide-line-soft">
          {tila.avoimet.map((v) => {
            const o = paivanOtsikko(v.pvm);
            const kuvaus = `${o.viikonpaiva} ${pvm(v.pvm)} ${v.alkaa.slice(11)}–${v.paattyy.slice(11)}, ${v.siteNimi}`;
            return (
              <li key={v.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">
                  <span className="font-medium text-ink-strong">{o.viikonpaiva} {pvm(v.pvm)} {v.alkaa.slice(11)}–{v.paattyy.slice(11)}</span>
                  <span className="block text-xs text-ink-muted">{v.siteNimi} · {v.vuoroNimi}</span>
                </span>
                <button
                  type="button"
                  disabled={tyossa !== null}
                  onClick={() => kuittaa(v.id, kuvaus)}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-60"
                >
                  {tyossa === v.id ? 'Otetaan…' : 'Ota vuoro'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const ListanToiveet = ({
  lista, tila, onTulos,
}: { lista: OmaLista; tila: Valmis; onTulos: (v: Awaited<ReturnType<typeof haeOmat>>) => void }) => {
  const [tyossa, setTyossa] = useState<string | null>(null);
  const [huomit, setHuomit] = useState<Record<string, string>>({});
  const toive = (p: string) => tila.toiveet.find((t) => t.pvm === p);
  const paivat = listanPaivat({ alku: lista.alku, loppu: lista.loppu } as never).filter((p) => p >= tila.tanaan);
  const toiveita = paivat.filter((p) => toive(p)).length;

  const aseta = async (p: string, laji: string | null, huom?: string) => {
    setTyossa(p);
    onTulos(await asetaOmaToive(p, laji, huom));
    setTyossa(null);
  };

  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h3 className="text-lg font-bold text-ink flex items-center gap-2">
          <CalendarHeart size={18} className="text-accent" />
          {pvm(lista.alku)} – {pvm(lista.viimeinen)}
        </h3>
        <span className="text-xs text-ink-muted">
          {lista.lukittu
            ? 'Toiveet lukittu: listaa laaditaan'
            : `Toiveet viimeistään ${pvm(lista.julkaistavaViimeistaan)}`}
          {toiveita > 0 && ` · ${toiveita} ${toiveita === 1 ? 'toive' : 'toivetta'}`}
        </span>
      </div>
      {lista.lukittu ? (
        <p className="text-sm text-ink-muted flex items-center gap-2">
          <Lock size={14} />
          Muutokset tälle listalle sovitaan vuorosuunnittelijan kanssa.
        </p>
      ) : (
        <ul className="bg-surface rounded-xl border border-line divide-y divide-line-soft">
          {paivat.map((p) => {
            const o = paivanOtsikko(p);
            const t = toive(p);
            return (
              <li key={p} className={`px-3 py-2 ${o.viikonloppu ? 'bg-sunken' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-20 text-sm text-ink-strong">
                    <span className="font-medium">{o.viikonpaiva}</span> {o.paiva}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {LAJIT.map((l) => {
                      const valittu = t?.laji === l.laji;
                      return (
                        <button
                          key={l.laji}
                          type="button"
                          aria-pressed={valittu}
                          disabled={tyossa === p}
                          onClick={() => aseta(p, valittu ? null : l.laji, valittu ? undefined : huomit[p])}
                          className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-60 ${
                            valittu ? l.aktiivinen : 'border-line text-ink-body hover:bg-sunken'
                          }`}
                        >
                          {l.nimi}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {t && (
                  <input
                    maxLength={200}
                    placeholder="Lisätieto suunnittelijalle (vapaaehtoinen)"
                    value={huomit[p] ?? t.huom ?? ''}
                    onChange={(e) => setHuomit({ ...huomit, [p]: e.target.value })}
                    onBlur={() => {
                      const uusi = (huomit[p] ?? '').trim();
                      if (huomit[p] !== undefined && uusi !== (t.huom || '')) aseta(p, t.laji, uusi);
                    }}
                    className="mt-1.5 w-full bg-surface border border-line-soft rounded-md px-2 py-1 text-xs text-ink"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

// --- Erä 6: muutokset, omat vuorot ja vaihdot ------------------------------------------------

type Tulos = (v: Awaited<ReturnType<typeof haeOmat>>, ok?: string) => void;

const vuoronTeksti = (v: { pvm: string; alkaa?: string; paattyy?: string; siteNimi?: string; vuoroNimi?: string }) => {
  const o = paivanOtsikko(v.pvm);
  const aika = v.alkaa && v.paattyy ? ` ${v.alkaa.slice(11)}–${v.paattyy.slice(11)}` : '';
  return `${o.viikonpaiva} ${pvm(v.pvm)}${aika}${v.siteNimi ? `, ${v.siteNimi}` : ''}`;
};

// Julkaisun jälkeiset muutokset omiin vuoroihin. Kuittaus kertoo suunnittelijalle, että
// vartija on nähnyt muutoksen — siksi se on erillinen painallus eikä näkymän avaaminen.
const Muutokset = ({ tila, onTulos }: { tila: Valmis; onTulos: Tulos }) => {
  const [tyossa, setTyossa] = useState(false);
  return (
    <section className="mb-6 rounded-xl border border-warning/40 bg-warning-soft p-4">
      <h3 className="font-bold text-warning-ink flex items-center gap-2">
        <BellRing size={18} />
        Muutoksia vuoroihisi
      </h3>
      <ul className="mt-2 space-y-1.5 text-sm text-warning-ink">
        {tila.muutokset.map((m, i) => (
          <li key={i}>
            <span className="font-medium">{m.suunta === 'sait' ? 'Uusi vuoro' : 'Vuoro poistettu'}:</span> {vuoronTeksti(m)}
            <span className="block text-xs">Syy: {m.syy}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={tyossa}
        onClick={async () => { setTyossa(true); onTulos(await kuittaaMuutokset()); setTyossa(false); }}
        className="mt-3 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-60"
      >
        Kuittaa nähdyksi
      </button>
    </section>
  );
};

// Omat julkaistut vuorot. Vuoron voi tarjota kollegalle: kollega hyväksyy, suunnittelija
// vahvistaa. Avoin pyyntö näkyy vuoron kohdalla, eikä samasta vuorosta voi tehdä toista.
const OmatVuorot = ({ tila, onTulos }: { tila: Valmis; onTulos: Tulos }) => {
  const [tarjottava, setTarjottava] = useState<string | null>(null);
  const [ehdokkaat, setEhdokkaat] = useState<{ username: string; nimi: string }[] | null>(null);
  const [saaja, setSaaja] = useState('');
  const [viesti, setViesti] = useState('');
  const [virhe, setVirhe] = useState<string | null>(null);

  const avaa = async (vuoroId: string) => {
    setTarjottava(vuoroId);
    setEhdokkaat(null);
    setSaaja('');
    setViesti('');
    setVirhe(null);
    const v = await haeVaihtoehdokkaat(vuoroId);
    if (v.ok) setEhdokkaat(v.ehdokkaat); else setVirhe(v.error);
  };
  const laheta = async (kuvaus: string) => {
    const v = await pyydaVaihto(tarjottava as string, saaja, viesti);
    if (!v.ok) { setVirhe(v.error); return; }
    setTarjottava(null);
    onTulos(v, `Vaihtopyyntö lähetetty: ${kuvaus}.`);
  };
  const avoinPyynto = (vuoroId: string) => tila.vaihdot.find((x) => x.vuoroId === vuoroId && x.rooli === 'antaja'
    && (x.tila === 'odottaa_saajaa' || x.tila === 'odottaa_suunnittelijaa'));

  return (
    <section className="mb-8">
      <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-2">
        <CalendarCheck size={18} className="text-accent" />
        Omat vuorot
      </h3>
      {tila.omatVuorot.length === 0 ? (
        <p className="text-sm text-ink-muted">Ei julkaistuja tulevia vuoroja.</p>
      ) : (
        <ul className="bg-surface rounded-xl border border-line divide-y divide-line-soft">
          {tila.omatVuorot.map((v) => {
            const kuvaus = vuoronTeksti(v);
            const pyynto = avoinPyynto(v.vuoroId);
            return (
              <li key={v.vuoroId} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">
                    <span className="font-medium text-ink-strong">{kuvaus}</span>
                    {v.vuoroNimi && <span className="block text-xs text-ink-muted">{v.vuoroNimi}</span>}
                  </span>
                  {pyynto ? (
                    <span className="text-xs text-warning-ink">Vaihto: {tila.vaihdonTilat[pyynto.tila]}</span>
                  ) : tarjottava !== v.vuoroId && (
                    <button type="button" onClick={() => avaa(v.vuoroId)} className="text-xs font-medium text-accent hover:underline">
                      Tarjoa vaihtoon
                    </button>
                  )}
                </div>
                {tarjottava === v.vuoroId && (
                  <div className="mt-2 space-y-2">
                    {!ehdokkaat && !virhe && <p className="text-xs text-ink-muted">Haetaan kollegoita…</p>}
                    {ehdokkaat && ehdokkaat.length === 0 && (
                      <p className="text-xs text-ink-muted">Kukaan muu ei ole perehdytetty tähän vuoroon.</p>
                    )}
                    {ehdokkaat && ehdokkaat.length > 0 && (
                      <>
                        <select value={saaja} onChange={(e) => setSaaja(e.target.value)} className="w-full bg-surface border border-line rounded-md px-2 py-1.5 text-sm text-ink">
                          <option value="">Kenelle?</option>
                          {ehdokkaat.map((e) => <option key={e.username} value={e.username}>{e.nimi}</option>)}
                        </select>
                        <input
                          maxLength={300}
                          value={viesti}
                          onChange={(e) => setViesti(e.target.value)}
                          placeholder="Viesti kollegalle (vapaaehtoinen)"
                          className="w-full bg-surface border border-line rounded-md px-2 py-1.5 text-sm text-ink"
                        />
                      </>
                    )}
                    {virhe && <p className="text-xs text-danger">{virhe}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!saaja}
                        onClick={() => laheta(kuvaus)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-60"
                      >
                        Lähetä pyyntö
                      </button>
                      <button type="button" onClick={() => setTarjottava(null)} className="px-3 py-1.5 text-xs font-medium text-ink-muted">
                        Peruuta
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

// Vaihtopyynnöt: saapuneet (hyväksy/hylkää) ja omat lähetetyt (peru).
const Vaihtopyynnot = ({ tila, onTulos }: { tila: Valmis; onTulos: Tulos }) => {
  const [tyossa, setTyossa] = useState<string | null>(null);
  const nakyvat = tila.vaihdot.filter((v) => v.tila === 'odottaa_saajaa' || v.tila === 'odottaa_suunnittelijaa'
    || v.rooli === 'antaja');
  if (!nakyvat.length) return null;
  const tee = async (id: string, toiminto: () => ReturnType<typeof haeOmat>, ok: string) => {
    setTyossa(id);
    onTulos(await toiminto(), ok);
    setTyossa(null);
  };
  return (
    <section className="mb-8">
      <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-2">
        <Repeat size={18} className="text-accent" />
        Vuoronvaihdot
      </h3>
      <ul className="bg-surface rounded-xl border border-line divide-y divide-line-soft">
        {nakyvat.map((v) => (
          <li key={v.id} className="px-4 py-2.5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium text-ink-strong">
                  {v.rooli === 'saaja' ? `${v.toinen} tarjoaa sinulle vuoroa` : `Tarjottu: ${v.toinen}`}
                </span>
                <span className="block text-xs text-ink-muted">{vuoronTeksti(v)} · {tila.vaihdonTilat[v.tila] || v.tila}</span>
                {v.viesti && <span className="block text-xs text-ink-body">Viesti: {v.viesti}</span>}
              </span>
              {v.rooli === 'saaja' && v.tila === 'odottaa_saajaa' && (
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={tyossa === v.id}
                    onClick={() => tee(v.id, () => vastaaVaihtoon(v.id, true), 'Hyväksytty. Vuorosuunnittelija vahvistaa vaihdon.')}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-60"
                  >
                    Otan vuoron
                  </button>
                  <button
                    type="button"
                    disabled={tyossa === v.id}
                    onClick={() => tee(v.id, () => vastaaVaihtoon(v.id, false), 'Pyyntö hylätty.')}
                    className="px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-danger"
                  >
                    En ota
                  </button>
                </span>
              )}
              {v.rooli === 'antaja' && (v.tila === 'odottaa_saajaa' || v.tila === 'odottaa_suunnittelijaa') && (
                <button
                  type="button"
                  disabled={tyossa === v.id}
                  onClick={() => tee(v.id, () => peruVaihto(v.id), 'Pyyntö peruttu.')}
                  className="text-xs font-medium text-ink-muted hover:text-danger"
                >
                  Peru
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
