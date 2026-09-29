// Jaa-ikkunan yläosa: tiedoston (tai kansion) voimassa olevat jaot, linkin näyttö ja
// peruutus (28.9.2026). Käytössä molemmissa jakoikkunoissa (App.tsx: jakoModal ja
// JakoDialogi), jotta jo jaetun tiedoston jakaminen uudelleen ei näytä siltä kuin
// tiedostoa ei olisi jaettu lainkaan.
//
// Hakee jaot itse (/api/data/fileShares — palvelin suodattaa oikeuksien mukaan) eikä
// ota niitä propseina, koska kutsujien jakolistat ovat eri muotoisia ja eri tavoin
// ajan tasalla. `paivitys` vaihtuu kun kutsuja tietää jakojen muuttuneen (uusi jako).

import { useCallback, useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import type { JaonLahde } from './JakoDialogi';

type Jako = {
  id: string;
  targetId: string;
  lahde?: string;
  mode?: string;
  allowedUsernames?: string[];
  expiresAt?: string | null;
  revokedAt?: string | null;
  approvalStatus?: string;
  maxDownloads?: number | null;
  downloadCount?: number;
  createdBy?: string;
  createdAt?: string;
  editori?: string;
};

type Props = {
  lahde: JaonLahde;
  targetId: string;
  paivitys?: unknown;
  onMuuttui?: () => void;
};

const pvm = (iso?: string | null) =>
  (iso ? new Date(iso).toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' }) : '');

const jakolinkki = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL}jako.html#${token}`;

// Tapahtumapuolen vanhoilla jaoilla ei ole lahde-kenttää: ne ovat eventFiles-jakoja.
const jaonLahde = (j: Jako): JaonLahde => (
  j.lahde === 'guardFiles' || j.lahde === 'personalFiles' ? j.lahde : 'eventFiles');

export const NykyisetJaot = ({ lahde, targetId, paivitys, onMuuttui }: Props) => {
  const [jaot, setJaot] = useState<Jako[] | null>(null);
  const [linkki, setLinkki] = useState<{ id: string; url: string } | null>(null);
  const [virhe, setVirhe] = useState('');

  const hae = useCallback(() => {
    // Henkilökohtaisten tiedostojen jaot eivät näy kokoelmareitillä (permissions.js),
    // joten omistaja hakee omansa omalta reitiltään samassa muodossa.
    fetch(lahde === 'personalFiles' ? '/api/omat/jaot' : '/api/data/fileShares', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!res?.ok || !Array.isArray(res.data)) return;
        const nyt = Date.now();
        setJaot((res.data as Jako[]).filter((j) => j.targetId === targetId
          && jaonLahde(j) === lahde
          && !j.revokedAt
          // Vanhentunut jako ei enää toimi eikä sitä voi perua — ei näytetä.
          && !(j.expiresAt && new Date(j.expiresAt).getTime() <= nyt)));
      })
      .catch(() => { /* lista jää näyttämättä */ });
  }, [lahde, targetId]);

  useEffect(() => { hae(); }, [hae, paivitys]);

  const naytaLinkki = async (j: Jako) => {
    setVirhe('');
    if (linkki?.id === j.id) { setLinkki(null); return; }
    try {
      const r = await fetch(`/api/shares/${encodeURIComponent(j.id)}/token`, { credentials: 'include' });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok || !d.token) throw new Error(d?.error || 'Linkin haku epäonnistui.');
      setLinkki({ id: j.id, url: jakolinkki(d.token) });
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Linkin haku epäonnistui.');
    }
  };

  const peruuta = async (j: Jako) => {
    if (!window.confirm('Peruutetaanko jako? Linkki lakkaa toimimasta heti.')) return;
    setVirhe('');
    try {
      const r = await fetch(`/api/shares/${encodeURIComponent(j.id)}`, { method: 'DELETE', credentials: 'include' });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) throw new Error(d?.error || 'Peruutus epäonnistui.');
      if (linkki?.id === j.id) setLinkki(null);
      hae();
      onMuuttui?.();
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Peruutus epäonnistui.');
    }
  };

  if (!jaot) return null;

  if (jaot.length === 0) {
    return (
      <p className="mx-5 mt-4 text-xs text-ink-muted bg-sunken border border-line rounded-lg px-3 py-2">
        Tätä ei ole vielä jaettu.
      </p>
    );
  }

  return (
    <div className="mx-5 mt-4 bg-success-soft border border-success/30 rounded-lg p-3">
      <p className="text-sm font-bold text-success-ink flex items-center gap-2 mb-2">
        <Link2 size={15} />
        Jaettu jo ({jaot.length})
      </p>
      <ul className="space-y-2">
        {jaot.map((j) => {
          const tapa = j.mode === 'link' ? 'Linkki'
            : j.mode === 'password' ? 'Linkki + salasana'
              : `Käyttäjät: ${(j.allowedUsernames || []).join(', ') || '–'}`;
          const voimassa = j.mode === 'users'
            ? 'voimassa toistaiseksi'
            : j.expiresAt ? `voimassa ${pvm(j.expiresAt)} asti`
              : j.approvalStatus === 'approved' ? 'pysyvä' : 'odottaa hyväksyntää';
          const taynna = j.maxDownloads != null && (j.downloadCount || 0) >= j.maxDownloads;
          return (
            <li key={j.id} className="bg-surface border border-line rounded-lg p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink-strong">
                    {tapa}
                    {j.editori === 'muokkaus' && <span className="ml-1.5 text-warning-ink">· saa muokata</span>}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {voimassa}
                    {' · '}ladattu {j.downloadCount || 0} kertaa{j.maxDownloads ? ` / ${j.maxDownloads}` : ''}
                    {taynna ? ' (raja täynnä)' : ''}
                    {j.createdBy ? ` · jakaja ${j.createdBy}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {j.mode !== 'users' && (
                    <button
                      type="button"
                      onClick={() => naytaLinkki(j)}
                      className="text-xs font-medium text-accent bg-accent-soft px-2.5 py-1.5 rounded-md"
                    >
                      {linkki?.id === j.id ? 'Piilota linkki' : 'Näytä linkki'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => peruuta(j)}
                    className="text-xs font-medium text-danger-ink bg-danger-soft px-2.5 py-1.5 rounded-md"
                  >
                    Peruuta jako
                  </button>
                </div>
              </div>
              {linkki?.id === j.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="flex-1 min-w-0 bg-sunken border border-line rounded px-2 py-1.5 text-xs font-mono break-all text-ink-strong">
                    {linkki.url}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(linkki.url)}
                    className="text-xs font-bold text-ink-body bg-sunken border border-line px-2.5 py-1.5 rounded-md"
                  >
                    Kopioi
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {virhe && <p className="mt-2 text-xs text-danger-ink">{virhe}</p>}
    </div>
  );
};
