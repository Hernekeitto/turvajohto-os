// Kiinteän (kohde/piiri/alue) PTT-kanavan jäsenten hallinta HÄLKElle (erä 26, jatko
// 26.9.2026, käyttäjän pyyntö: "Lisätään HÄLKE mahdollisuus lisätä ja poistaa
// vartijoita tietyltä kanavalta" — vahvistettu koskemaan myös kiinteitä kanavia).
//
// TIETOINEN POIKKEUS: kiinteän kanavan jäsenyys lasketaan normaalisti vuorosta eikä
// tallenneta lainkaan (server/kanavat.js:n oma yläkommentti). Tämä näkymä hallitsee
// PÄÄLLE menevää poikkeuslistaa (server/index.js: /api/kanavat/:id/jasenpoikkeukset,
// guardKanavaJasenet-kokoelma) — se ei korvaa vuoropohjaista laskentaa, vain
// täydentää sitä. Kolme tilaa per vartija: vuorosta (ei poikkeusta), pakolla lisätty,
// pakolla poistettu.
import { useCallback, useEffect, useState } from 'react';
import { X, Search, UserPlus, UserMinus, Undo2 } from 'lucide-react';

type Vartija = { username: string; nimi: string };
type Poikkeus = { kayttaja: string; tila: 'lisatty' | 'poistettu' };

type Props = {
  kanava: { id: string; nimi: string };
  onSulje: () => void;
};

export const KanavanJasenet = ({ kanava, onSulje }: Props) => {
  const [lataus, setLataus] = useState(true);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [luonnolliset, setLuonnolliset] = useState<string[]>([]);
  const [poikkeukset, setPoikkeukset] = useState<Poikkeus[]>([]);
  const [vartijat, setVartijat] = useState<Vartija[]>([]);
  const [haku, setHaku] = useState('');
  const [kasitellaan, setKasitellaan] = useState<string | null>(null);

  const haeTiedot = useCallback(() => {
    setVirhe(null);
    fetch(`/api/kanavat/${encodeURIComponent(kanava.id)}/jasenpoikkeukset`, { credentials: 'include' })
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (d?.ok) {
          setLuonnolliset(d.luonnolliset || []);
          setPoikkeukset(d.poikkeukset || []);
        } else {
          setVirhe(d?.error || 'Jäsenten haku epäonnistui.');
        }
      })
      .catch(() => setVirhe('Jäsenten haku epäonnistui: ei yhteyttä palvelimeen.'))
      .finally(() => setLataus(false));
  }, [kanava.id]);

  useEffect(() => { haeTiedot(); }, [haeTiedot]);

  useEffect(() => {
    fetch('/api/kanavat/vartijat', { credentials: 'include' })
      .then((r) => r.json().catch(() => null))
      .then((d) => { if (d?.ok) setVartijat(d.vartijat || []); })
      .catch(() => { /* nimet näkyvät tunnuksena jos haku epäonnistuu */ });
  }, []);

  const nimi = (kayttaja: string) => vartijat.find((v) => v.username === kayttaja)?.nimi || kayttaja;

  const aseta = (kayttaja: string, tila: 'lisatty' | 'poistettu') => {
    setKasitellaan(kayttaja);
    fetch(`/api/kanavat/${encodeURIComponent(kanava.id)}/jasenpoikkeukset/${encodeURIComponent(kayttaja)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tila }),
    })
      .then((r) => r.json().catch(() => null))
      .then((d) => { if (d?.ok) haeTiedot(); else setVirhe(d?.error || 'Muutos epäonnistui.'); })
      .catch(() => setVirhe('Muutos epäonnistui: ei yhteyttä palvelimeen.'))
      .finally(() => setKasitellaan(null));
  };

  const peruuta = (kayttaja: string) => {
    setKasitellaan(kayttaja);
    fetch(`/api/kanavat/${encodeURIComponent(kanava.id)}/jasenpoikkeukset/${encodeURIComponent(kayttaja)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
      .then((r) => r.json().catch(() => null))
      .then((d) => { if (d?.ok) haeTiedot(); else setVirhe(d?.error || 'Peruutus epäonnistui.'); })
      .catch(() => setVirhe('Peruutus epäonnistui: ei yhteyttä palvelimeen.'))
      .finally(() => setKasitellaan(null));
  };

  const poistetut = poikkeukset.filter((p) => p.tila === 'poistettu').map((p) => p.kayttaja);
  const lisatyt = poikkeukset.filter((p) => p.tila === 'lisatty').map((p) => p.kayttaja);
  const nykyisetLuonnolliset = luonnolliset.filter((k) => !poistetut.includes(k));
  const efektiiviset = new Set([...nykyisetLuonnolliset, ...lisatyt]);
  const ehdokkaat = vartijat.filter((v) => (
    !efektiiviset.has(v.username)
    && (haku.trim() === '' || v.nimi.toLowerCase().includes(haku.trim().toLowerCase()))
  ));

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Jäsenet: ${kanava.nimi}`}
      onClick={(e) => { if (e.target === e.currentTarget) onSulje(); }}
    >
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-line bg-canvas p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-bold text-ink-strong truncate">Jäsenet: {kanava.nimi}</h3>
          <button
            type="button"
            onClick={onSulje}
            aria-label="Sulje"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-ink-subtle hover:bg-sunken"
          >
            <X size={16} />
          </button>
        </div>

        {lataus && <p className="text-sm text-ink-muted">Ladataan…</p>}
        {virhe && <p className="text-sm text-danger-ink mb-3">{virhe}</p>}

        {!lataus && (
          <div className="flex flex-col gap-5">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-ink-subtle mb-2">Vuorosta</h4>
              {nykyisetLuonnolliset.length === 0 ? (
                <p className="text-sm text-ink-muted">Ei ketään vuorosta juuri nyt.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {nykyisetLuonnolliset.map((k) => (
                    <li key={k} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2">
                      <p className="min-w-0 flex-1 text-sm text-ink-body truncate">{nimi(k)}</p>
                      <button
                        type="button"
                        onClick={() => aseta(k, 'poistettu')}
                        disabled={kasitellaan === k}
                        className="shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger-ink hover:bg-danger-soft disabled:opacity-40"
                      >
                        <UserMinus size={13} /> Poista
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lisatyt.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-ink-subtle mb-2">Pakolla lisätty</h4>
                <ul className="flex flex-col gap-1.5">
                  {lisatyt.map((k) => (
                    <li key={k} className="flex items-center gap-2.5 rounded-lg border border-success/40 bg-success-soft px-3 py-2">
                      <p className="min-w-0 flex-1 text-sm text-ink-body truncate">{nimi(k)}</p>
                      <button
                        type="button"
                        onClick={() => peruuta(k)}
                        disabled={kasitellaan === k}
                        className="shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-subtle hover:bg-sunken disabled:opacity-40"
                      >
                        <Undo2 size={13} /> Peruuta lisäys
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {poistetut.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-ink-subtle mb-2">Pakolla poistettu</h4>
                <ul className="flex flex-col gap-1.5">
                  {poistetut.map((k) => (
                    <li key={k} className="flex items-center gap-2.5 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2">
                      <p className="min-w-0 flex-1 text-sm text-ink-body truncate">{nimi(k)}</p>
                      <button
                        type="button"
                        onClick={() => peruuta(k)}
                        disabled={kasitellaan === k}
                        className="shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-subtle hover:bg-sunken disabled:opacity-40"
                      >
                        <Undo2 size={13} /> Peruuta poisto
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-ink-subtle mb-2">Lisää vartija pakolla</h4>
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 mb-2">
                <Search size={16} className="text-ink-subtle shrink-0" />
                <input
                  type="text"
                  value={haku}
                  onChange={(e) => setHaku(e.target.value)}
                  placeholder="Nimi…"
                  className="flex-1 min-w-0 bg-transparent text-sm text-ink outline-none"
                />
              </div>
              <ul className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {ehdokkaat.length === 0 ? (
                  <p className="text-sm text-ink-muted">Ei tuloksia.</p>
                ) : (
                  ehdokkaat.map((v) => (
                    <li key={v.username} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2">
                      <p className="min-w-0 flex-1 text-sm text-ink-body truncate">{v.nimi}</p>
                      <button
                        type="button"
                        onClick={() => aseta(v.username, 'lisatty')}
                        disabled={kasitellaan === v.username}
                        className="shrink-0 flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        <UserPlus size={13} /> Lisää
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
