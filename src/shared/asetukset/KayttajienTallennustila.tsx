// Sovellusasetukset > Käyttäjien tallennustila (29.9.2026). Vain pääkäyttäjälle.
//
// Käyttäjien henkilökohtaisten kansioiden käyttö ja rajat, lisätilapyyntöjen käsittely ja
// henkilökohtaisten tiedostojen pysyvien jakolinkkien hyväksyntä. Säännöt ovat
// palvelimella (server/omattiedostot.js); tämä on hallinnan näkymä.
import { useCallback, useEffect, useState } from 'react';
import { Users, Check, X, Plus, Link2 } from 'lucide-react';

import { muotoileKoko, muotoileMt, type LisatilaPyynto } from '../omatTiedostot';

type Kayttaja = {
  username: string;
  nickname: string;
  roleId: string | null;
  admin: boolean;
  kaytetty: number;
  raja: number | null;
  lisatila: number;
  tiedostoja: number;
};

type OdottavaJako = { id: string; nimi: string; createdBy?: string; expiresAt?: string | null };

const pvm = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' }) : '');

export const KayttajienTallennustila = ({ isAdmin }: { isAdmin: boolean }) => {
  const [kayttajat, setKayttajat] = useState<Kayttaja[]>([]);
  const [pyynnot, setPyynnot] = useState<LisatilaPyynto[]>([]);
  const [jaot, setJaot] = useState<OdottavaJako[]>([]);
  const [vaihtoehdot, setVaihtoehdot] = useState<number[]>([500, 1024, 2048, 5120]);
  const [maarat, setMaarat] = useState<Record<string, number>>({});
  const [virhe, setVirhe] = useState<string | null>(null);

  const hae = useCallback(() => {
    fetch('/api/tallennustila/kayttajat', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) { setVirhe(d?.error || 'Tietojen haku epäonnistui.'); return; }
        setKayttajat(d.kayttajat);
        setPyynnot(d.pyynnot);
        setJaot(d.odottavatJaot || []);
        if (Array.isArray(d.vaihtoehdot)) setVaihtoehdot(d.vaihtoehdot);
      })
      .catch(() => setVirhe('Ei yhteyttä palvelimeen.'));
  }, []);

  useEffect(() => { if (isAdmin) hae(); }, [isAdmin, hae]);
  if (!isAdmin) return null;

  const kutsu = async (polku: string, runko: unknown) => {
    setVirhe(null);
    try {
      const r = await fetch(polku, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(runko),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) setVirhe(d?.error || 'Toiminto epäonnistui.');
    } catch {
      setVirhe('Ei yhteyttä palvelimeen.');
    }
    hae();
  };

  const kasittele = (p: LisatilaPyynto, hyvaksy: boolean) => {
    if (hyvaksy) {
      kutsu(`/api/tallennustila/pyynto/${encodeURIComponent(p.id)}`, { hyvaksy: true, maaraMt: maarat[p.id] ?? p.pyydettyMt });
      return;
    }
    const syy = window.prompt('Hylkäyksen syy (näytetään käyttäjälle, valinnainen):', '');
    if (syy === null) return;
    kutsu(`/api/tallennustila/pyynto/${encodeURIComponent(p.id)}`, { hyvaksy: false, syy });
  };

  const myonna = (k: Kayttaja) => {
    const maara = maarat[`k:${k.username}`] ?? vaihtoehdot[0];
    if (!window.confirm(`Myönnetäänkö käyttäjälle ${k.nickname} ${muotoileMt(maara)} lisää tallennustilaa?`)) return;
    kutsu('/api/tallennustila/myonna', { username: k.username, maaraMt: maara });
  };

  const odottavat = pyynnot.filter((p) => p.tila === 'odottaa');
  const kasitellyt = pyynnot.filter((p) => p.tila !== 'odottaa').slice(0, 10);

  const maaraValinta = (avain: string, oletus: number) => (
    <select
      value={maarat[avain] ?? oletus}
      onChange={(e) => setMaarat((m) => ({ ...m, [avain]: Number(e.target.value) }))}
      className="bg-sunken border border-line-soft rounded-md px-2 py-1 text-xs text-ink-strong"
    >
      {[...new Set([...vaihtoehdot, oletus])].sort((a, b) => a - b).map((mt) => (
        <option key={mt} value={mt}>{muotoileMt(mt)}</option>
      ))}
    </select>
  );

  return (
    <section className="bg-surface border border-line rounded-xl p-5 mb-6">
      <h3 className="text-lg font-bold text-ink-strong flex items-center gap-2 mb-1">
        <Users size={18} />
        Käyttäjien tallennustila
      </h3>
      <p className="text-sm text-ink-muted mb-4">
        Henkilökohtaiset kansiot: Vartija-taso 500 Mt, muut 5 Gt, pääkäyttäjä ilman rajaa.
        Rajan yli saa tallentaa enintään 500 Mt, ja käyttäjä saa siitä ilmoituksen.
      </p>

      {virhe && <p className="mb-3 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-3 py-2">{virhe}</p>}

      <h4 className="text-sm font-bold text-ink-strong mb-2">Lisätilapyynnöt ({odottavat.length})</h4>
      {odottavat.length === 0 ? (
        <p className="text-sm text-ink-muted mb-5">Ei käsittelyä odottavia pyyntöjä.</p>
      ) : (
        <ul className="space-y-2 mb-5">
          {odottavat.map((p) => (
            <li key={p.id} className="bg-warning-soft border border-warning/40 rounded-lg p-3">
              <p className="text-sm text-ink-strong">
                <strong>{p.nimimerkki}</strong> pyytää {muotoileMt(p.pyydettyMt)}
                <span className="text-xs text-ink-muted"> · {pvm(p.luotu)}</span>
              </p>
              <p className="text-sm text-ink-body mt-1 whitespace-pre-wrap">{p.perustelu}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs text-ink-muted">Myönnettävä:</span>
                {maaraValinta(p.id, p.pyydettyMt)}
                <button type="button" onClick={() => kasittele(p, true)} className="inline-flex items-center gap-1 text-xs font-bold text-success-ink bg-success-soft px-3 py-1.5 rounded-md">
                  <Check size={13} /> Hyväksy
                </button>
                <button type="button" onClick={() => kasittele(p, false)} className="inline-flex items-center gap-1 text-xs font-medium text-danger-ink bg-danger-soft px-3 py-1.5 rounded-md">
                  <X size={13} /> Hylkää
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {jaot.length > 0 && (
        <>
          <h4 className="text-sm font-bold text-ink-strong mb-2 flex items-center gap-2"><Link2 size={14} /> Pysyviä jakolinkkejä odottaa hyväksyntää</h4>
          <ul className="space-y-2 mb-5">
            {jaot.map((j) => (
              <li key={j.id} className="bg-sunken border border-line rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-ink-strong">{j.nimi}<span className="text-xs text-ink-muted"> · {j.createdBy} · väliaikaisesti {pvm(j.expiresAt)} asti</span></span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => kutsu(`/api/shares/${encodeURIComponent(j.id)}/approval`, { approve: true })} className="text-xs font-bold text-success-ink bg-success-soft px-3 py-1.5 rounded-md">Hyväksy pysyväksi</button>
                  <button type="button" onClick={() => kutsu(`/api/shares/${encodeURIComponent(j.id)}/approval`, { approve: false })} className="text-xs font-medium text-danger-ink bg-danger-soft px-3 py-1.5 rounded-md">Hylkää</button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4 className="text-sm font-bold text-ink-strong mb-2">Käyttö</h4>
      <div className="overflow-x-auto mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted border-b border-line">
              <th className="py-2 pr-3 font-medium">Käyttäjä</th>
              <th className="py-2 pr-3 font-medium">Käytetty</th>
              <th className="py-2 pr-3 font-medium">Raja</th>
              <th className="py-2 font-medium">Lisää tilaa</th>
            </tr>
          </thead>
          <tbody>
            {kayttajat.map((k) => {
              const yli = k.raja !== null && k.kaytetty > k.raja;
              return (
                <tr key={k.username} className="border-b border-line-soft">
                  <td className="py-2 pr-3">
                    <span className="text-ink-strong">{k.nickname}</span>
                    <span className="block text-xs text-ink-subtle">{k.admin ? 'Pääkäyttäjä' : k.roleId || 'ei tasoa'} · {k.tiedostoja} tiedostoa</span>
                  </td>
                  <td className={`py-2 pr-3 tabular-nums ${yli ? 'text-danger-ink font-bold' : 'text-ink-body'}`}>
                    {muotoileKoko(k.kaytetty)}{yli ? ' (yli rajan)' : ''}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-ink-body">
                    {k.raja === null ? 'Ei rajaa' : muotoileKoko(k.raja)}
                    {k.lisatila > 0 && <span className="block text-xs text-ink-subtle">sis. lisätilaa {muotoileKoko(k.lisatila)}</span>}
                  </td>
                  <td className="py-2">
                    {k.raja !== null && (
                      <span className="flex items-center gap-1.5">
                        {maaraValinta(`k:${k.username}`, vaihtoehdot[0])}
                        <button type="button" onClick={() => myonna(k)} title="Myönnä lisätilaa" className="p-1 text-accent hover:text-accent-hover">
                          <Plus size={15} />
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {kasitellyt.length > 0 && (
        <>
          <h4 className="text-sm font-bold text-ink-strong mb-2">Viimeksi käsitellyt</h4>
          <ul className="text-xs text-ink-body space-y-1">
            {kasitellyt.map((p) => (
              <li key={p.id}>
                {pvm(p.kasitelty)} · {p.nimimerkki} · {p.tila === 'hyvaksytty' ? `hyväksytty ${muotoileMt(p.myonnettyMt)}` : 'hylätty'}
                {p.kasittelija ? ` (${p.kasittelija})` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};
