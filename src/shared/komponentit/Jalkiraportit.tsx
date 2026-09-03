// Jälkiraportit (erä 9): tapahtuman purku ja GUARD-puolen jaksoraportti.
//
// Näkymä on kaksiosainen tarkoituksella: ylhäällä JÄÄDYTETYT LUVUT, alla ihmisen
// kirjoittamat havainnot. Luvut kertovat mitä tapahtui, teksti kertoo miksi — ja purku
// jossa on vain toinen puoli on joko tilastoraportti tai muistikuva.
import { useEffect, useState } from 'react';
import {
  ClipboardList, Plus, Printer, Save, Check, LockOpen, Trash2, ChevronLeft, TriangleAlert,
} from 'lucide-react';

import { KoosteNakyma } from './Mittaristo';
import { JAKSOT, aikavaliTekstina, hetki, jakso, paivistaAikavali } from '../analytiikka';
import {
  OSIOT, avaaUudelleen, luoJalkiraportti, merkitseValmiiksi, poistaJalkiraportti,
  tallennaJalkiraportti, tulostaJalkiraportti,
  type Jalkiraportti, type Toimenpide,
} from '../jalkiraportit';

type Props = {
  ownerId: string;
  ownerNimi: string;
  onKohde: boolean;
  raportit: Jalkiraportti[];
  // Lukuoikeus näyttää raportit, muokkausoikeus oikeuttaa laatimaan ja merkitsemään
  // valmiiksi (ks. server/index.js: analytiikanPortti).
  saaMuokata: boolean;
  onMuuttui: () => void;
};

const uusiToimenpide = (): Toimenpide => ({
  id: `tp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  teksti: '', vastuu: '', maarapaiva: '', tehty: false,
});

export const Jalkiraportit = ({ ownerId, ownerNimi, onKohde, raportit, saaMuokata, onMuuttui }: Props) => {
  const [avattuId, setAvattuId] = useState<string | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tyoskentelee, setTyoskentelee] = useState(false);

  const [uusiNimi, setUusiNimi] = useState('');
  const [uusiJakso, setUusiJakso] = useState('30vrk');
  const [uusiAlku, setUusiAlku] = useState('');
  const [uusiLoppu, setUusiLoppu] = useState('');

  // Luonnos on paikallinen kunnes se tallennetaan: kirjoittaminen ei saa lähettää
  // pyyntöä joka näppäimen painalluksella, eikä purkupalaverissa ole aikaa odottaa
  // verkkoa jokaisen lauseen välissä.
  const [luonnos, setLuonnos] = useState<Partial<Jalkiraportti> | null>(null);
  const [tallentamatta, setTallentamatta] = useState(false);
  const [avausSyy, setAvausSyy] = useState('');

  const omat = raportit
    .filter((r) => r.ownerId === ownerId)
    .sort((a, b) => String(b.luotu).localeCompare(String(a.luotu)));
  const avattu = omat.find((r) => r.id === avattuId) || null;

  // Palvelimen versio korvaa luonnoksen kun raportti vaihtuu tai kun sen tila muuttuu
  // (valmis/avattu). Tallentamatonta tekstiä ei kuitenkaan pyyhitä alta pois.
  useEffect(() => {
    if (!avattu) { setLuonnos(null); setTallentamatta(false); return; }
    if (tallentamatta) return;
    setLuonnos({
      yhteenveto: avattu.yhteenveto, onnistui: avattu.onnistui,
      kehitettavaa: avattu.kehitettavaa, oppi: avattu.oppi,
      toimenpiteet: avattu.toimenpiteet || [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avattu?.id, avattu?.tila, avattu?.muokattu]);

  const aja = async (tehtava: () => Promise<{ ok: boolean; error?: string }>, jalkeen?: () => void) => {
    setVirhe(null);
    setTyoskentelee(true);
    try {
      const tulos = await tehtava();
      if (tulos.ok) { jalkeen?.(); onMuuttui(); }
      else setVirhe(tulos.error || 'Toiminto epäonnistui.');
      return tulos.ok;
    } finally {
      setTyoskentelee(false);
    }
  };

  const luo = async () => {
    const vali = uusiJakso === 'oma' ? paivistaAikavali(uusiAlku, uusiLoppu) : jakso(uusiJakso);
    const tulos = await aja(
      () => luoJalkiraportti({ ownerId, nimi: uusiNimi, alku: vali.alku, loppu: vali.loppu }),
      () => { setUusiNimi(''); setUusiAlku(''); setUusiLoppu(''); },
    );
    if (tulos) setAvattuId(null);
  };

  const tallenna = async () => {
    if (!avattu || !luonnos) return;
    const ok = await aja(() => tallennaJalkiraportti(avattu.id, luonnos));
    if (ok) setTallentamatta(false);
  };

  const paivitaLuonnos = (muutos: Partial<Jalkiraportti>) => {
    setLuonnos((edellinen) => ({ ...(edellinen || {}), ...muutos }));
    setTallentamatta(true);
  };

  const toimenpiteet = (luonnos?.toimenpiteet || []) as Toimenpide[];
  const muutaToimenpide = (id: string, muutos: Partial<Toimenpide>) =>
    paivitaLuonnos({ toimenpiteet: toimenpiteet.map((t) => (t.id === id ? { ...t, ...muutos } : t)) });

  // --- Yksittäinen raportti ---------------------------------------------------------

  if (avattu) {
    const lukittu = avattu.tila === 'valmis';
    const saaKirjoittaa = saaMuokata && !lukittu;
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => { setAvattuId(null); setTallentamatta(false); setVirhe(null); }}
          className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink-strong"
        >
          <ChevronLeft size={16} /> Kaikki jälkiraportit
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-ink-strong">{avattu.nimi}</h2>
            <p className="text-sm text-ink-muted mt-1">
              {aikavaliTekstina(avattu.ikkuna)} · laatinut {avattu.laatija || '—'} {hetki(avattu.luotu)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`self-center px-2.5 py-1 rounded-full text-xs font-bold border ${
              lukittu ? 'bg-success-soft text-success-ink border-success/30' : 'bg-warning-soft text-warning-ink border-warning/30'
            }`}
            >
              {lukittu ? 'Valmis' : 'Luonnos'}
            </span>
            <button
              type="button"
              onClick={() => tulostaJalkiraportti(avattu, ownerNimi)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-surface text-sm font-medium text-ink-body hover:bg-sunken"
            >
              <Printer size={16} /> Tulosta
            </button>
            {saaKirjoittaa && (
              <button
                type="button"
                onClick={tallenna}
                disabled={tyoskentelee || !tallentamatta}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
              >
                <Save size={16} /> {tallentamatta ? 'Tallenna' : 'Tallennettu'}
              </button>
            )}
            {saaKirjoittaa && (
              <button
                type="button"
                onClick={async () => { if (tallentamatta) await tallenna(); aja(() => merkitseValmiiksi(avattu.id)); }}
                disabled={tyoskentelee}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-success/40 bg-success-soft text-success-ink text-sm font-medium disabled:opacity-50"
              >
                <Check size={16} /> Merkitse valmiiksi
              </button>
            )}
          </div>
        </div>

        {virhe && <div className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger-ink">{virhe}</div>}

        {/* Valmis raportti avataan vain syyn kanssa. Ilman merkintää jaettu dokumentti
            voisi muuttua toiseksi ilman että kukaan huomaa. */}
        {lukittu && saaMuokata && (
          <div className="rounded-xl border border-line bg-sunken p-4">
            <p className="text-sm font-bold text-ink-strong">Raportti on merkitty valmiiksi {hetki(avattu.valmis?.ts)}</p>
            <p className="text-xs text-ink-muted mt-1">
              Avaaminen kirjataan historiaan. Kerro miksi raporttia on muutettava.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <input
                value={avausSyy}
                onChange={(e) => setAvausSyy(e.target.value)}
                placeholder="Syy avaamiseen"
                className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
              />
              <button
                type="button"
                onClick={() => aja(() => avaaUudelleen(avattu.id, avausSyy), () => setAvausSyy(''))}
                disabled={tyoskentelee || !avausSyy.trim()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-surface text-sm font-medium text-ink-body hover:bg-sunken disabled:opacity-50"
              >
                <LockOpen size={16} /> Avaa uudelleen
              </button>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-bold text-ink-strong mb-2">Jäädytetyt luvut</h3>
          <p className="text-xs text-ink-muted mb-3">
            Luvut on laskettu {hetki(avattu.kooste?.laskettu)} eivätkä ne muutu, vaikka kirjauksia
            suljettaisiin tai korjattaisiin jälkikäteen.
          </p>
          <KoosteNakyma kooste={avattu.kooste} onKohde={onKohde} />
        </div>

        <div className="space-y-3">
          {OSIOT.map((osio) => (
            <div key={osio.id} className="bg-surface border border-line rounded-xl p-4">
              <label className="block">
                <span className="text-sm font-bold text-ink-strong">{osio.nimi}</span>
                <span className="block text-xs text-ink-muted mt-0.5 mb-2">{osio.ohje}</span>
                <textarea
                  value={(luonnos?.[osio.id] as string) ?? ''}
                  onChange={(e) => paivitaLuonnos({ [osio.id]: e.target.value } as Partial<Jalkiraportti>)}
                  disabled={!saaKirjoittaa}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body disabled:bg-sunken disabled:text-ink-muted"
                />
              </label>
            </div>
          ))}
        </div>

        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
            <h3 className="text-sm font-bold text-ink-strong">Toimenpiteet</h3>
            {saaKirjoittaa && (
              <button
                type="button"
                onClick={() => paivitaLuonnos({ toimenpiteet: [...toimenpiteet, uusiToimenpide()] })}
                className="inline-flex items-center gap-1 text-sm font-medium text-accent"
              >
                <Plus size={16} /> Lisää
              </button>
            )}
          </div>
          <p className="text-xs text-ink-muted mb-3">
            Havainto ilman vastuuta ja määräpäivää on mielipide. Tämä on se osa raportista
            jota luetaan seuraavaa tapahtumaa suunniteltaessa.
          </p>
          {toimenpiteet.length === 0 ? (
            <p className="text-sm text-ink-muted">Ei toimenpiteitä.</p>
          ) : (
            <ul className="space-y-3">
              {toimenpiteet.map((t) => (
                <li key={t.id} className="border border-line-soft rounded-lg p-3 space-y-2">
                  <div className="flex gap-2 items-start">
                    <input
                      type="checkbox"
                      checked={t.tehty}
                      onChange={(e) => muutaToimenpide(t.id, { tehty: e.target.checked })}
                      disabled={!saaKirjoittaa}
                      className="mt-2"
                      aria-label="Toimenpide tehty"
                    />
                    <input
                      value={t.teksti}
                      onChange={(e) => muutaToimenpide(t.id, { teksti: e.target.value })}
                      disabled={!saaKirjoittaa}
                      placeholder="Mitä tehdään"
                      className={`flex-1 px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body disabled:bg-sunken ${t.tehty ? 'line-through text-ink-muted' : ''}`}
                    />
                    {saaKirjoittaa && (
                      <button
                        type="button"
                        onClick={() => paivitaLuonnos({ toimenpiteet: toimenpiteet.filter((x) => x.id !== t.id) })}
                        className="p-2 text-ink-muted hover:text-danger-ink"
                        aria-label="Poista toimenpide"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pl-6">
                    <input
                      value={t.vastuu}
                      onChange={(e) => muutaToimenpide(t.id, { vastuu: e.target.value })}
                      disabled={!saaKirjoittaa}
                      placeholder="Vastuu"
                      className="px-3 py-1.5 rounded-lg border border-line bg-surface text-sm text-ink-body disabled:bg-sunken"
                    />
                    <input
                      type="date"
                      value={t.maarapaiva}
                      onChange={(e) => muutaToimenpide(t.id, { maarapaiva: e.target.value })}
                      disabled={!saaKirjoittaa}
                      className="px-3 py-1.5 rounded-lg border border-line bg-surface text-sm text-ink-body disabled:bg-sunken"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(avattu.historia || []).length > 1 && (
          <div className="bg-surface border border-line rounded-xl p-4">
            <h3 className="text-sm font-bold text-ink-strong mb-2">Historia</h3>
            <ul className="space-y-1 text-sm text-ink-body">
              {avattu.historia.map((h, i) => (
                <li key={`${h.ts}-${i}`} className="flex flex-wrap gap-x-2">
                  <span className="text-ink-muted tabular-nums">{hetki(h.ts)}</span>
                  <span className="font-medium">{h.user || '—'}</span>
                  <span className="text-ink-muted">{h.teksti}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {saaMuokata && !lukittu && (
          <button
            type="button"
            onClick={() => aja(() => poistaJalkiraportti(avattu.id), () => setAvattuId(null))}
            disabled={tyoskentelee}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-danger/30 text-sm font-medium text-danger-ink hover:bg-danger-soft disabled:opacity-50"
          >
            <Trash2 size={16} /> Poista luonnos
          </button>
        )}
      </div>
    );
  }

  // --- Lista ------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-ink-strong flex items-center gap-2">
          <ClipboardList size={26} className="text-accent" />
          {onKohde ? 'Jaksoraportit' : 'Jälkiraportit'}
        </h2>
        <p className="text-sm text-ink-muted mt-1">
          {ownerNimi} · {onKohde
            ? 'Jakson luvut ja havainnot koosteena toimeksiantajalle.'
            : 'Tapahtuman purku: luvut, havainnot ja toimenpiteet seuraavaa kertaa varten.'}
        </p>
      </div>

      {virhe && <div className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger-ink">{virhe}</div>}

      {saaMuokata && (
        <div className="bg-surface border border-line rounded-xl p-4">
          <h3 className="text-sm font-bold text-ink-strong mb-3">Uusi raportti</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex-1 min-w-[220px]">
              <span className="block text-xs text-ink-muted mb-1">Nimi</span>
              <input
                value={uusiNimi}
                onChange={(e) => setUusiNimi(e.target.value)}
                placeholder={onKohde ? 'Syyskuun jaksoraportti' : 'Purku — kesäfestari 2026'}
                className="w-full px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
              />
            </label>
            <label>
              <span className="block text-xs text-ink-muted mb-1">Aikaväli</span>
              <select
                value={uusiJakso}
                onChange={(e) => setUusiJakso(e.target.value)}
                className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body"
              >
                {JAKSOT.map((j) => <option key={j.id} value={j.id}>{j.nimi}</option>)}
                <option value="oma">Oma aikaväli</option>
              </select>
            </label>
            {uusiJakso === 'oma' && (
              <>
                <label>
                  <span className="block text-xs text-ink-muted mb-1">Alkaa</span>
                  <input type="date" value={uusiAlku} onChange={(e) => setUusiAlku(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body" />
                </label>
                <label>
                  <span className="block text-xs text-ink-muted mb-1">Päättyy</span>
                  <input type="date" value={uusiLoppu} onChange={(e) => setUusiLoppu(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink-body" />
                </label>
              </>
            )}
            <button
              type="button"
              onClick={luo}
              disabled={tyoskentelee || !uusiNimi.trim() || (uusiJakso === 'oma' && !(uusiAlku && uusiLoppu))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
            >
              <Plus size={16} /> Luo ja jäädytä luvut
            </button>
          </div>
          <p className="text-xs text-ink-muted mt-3 flex items-start gap-2">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            Luvut lasketaan kerran luontihetkellä. Jos jakso on vielä kesken, luo raportti vasta
            sen päätyttyä — muuten kooste kertoo vain siihenastisen tilanteen.
          </p>
        </div>
      )}

      {omat.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Ei vielä yhtään raporttia.{saaMuokata ? '' : ' Raportin laatiminen vaatii muokkausoikeuden.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {omat.map((r) => {
            const avoimia = (r.toimenpiteet || []).filter((t) => !t.tehty).length;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => { setAvattuId(r.id); setTallentamatta(false); setVirhe(null); }}
                  className="w-full text-left bg-surface border border-line rounded-xl p-4 hover:bg-sunken"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink-strong">{r.nimi}</p>
                      <p className="text-sm text-ink-muted mt-0.5">
                        {aikavaliTekstina(r.ikkuna)} · {r.laatija || '—'} · {hetki(r.luotu)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {avoimia > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning-soft text-warning-ink border border-warning/30">
                          {avoimia} avointa toimenpidettä
                        </span>
                      )}
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                        r.tila === 'valmis' ? 'bg-success-soft text-success-ink border-success/30' : 'bg-warning-soft text-warning-ink border-warning/30'
                      }`}
                      >
                        {r.tila === 'valmis' ? 'Valmis' : 'Luonnos'}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
