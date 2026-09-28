import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, FileText, Trash2, Download, Eye, EyeOff, ShieldAlert, Share2, AlertTriangle, Link2,
} from 'lucide-react';
import { muotoileTavut } from '../shared/muotoilu';
import { JakoDialogi, jakolinkinOsoite } from '../shared/komponentit/JakoDialogi';
import { AvaaEditorissa, Esikatsele, UusiDokumentti } from '../shared/komponentit/Dokumenttieditori';
import type { KohteenTiedosto } from './tyypit';

// Kohteen tiedostot: toimeksiantosopimus, pohjapiirros, vartio-ohje ja vastaavat.
//
// Litteä lista eikä kansiorakennetta (toisin kuin tapahtuman tiedostoissa): kohteella on
// tyypillisesti muutama pysyvä dokumentti, ja kansiot olisivat tyhjää rakennetta jota
// kukaan ei tarvitse. Jos tarve muuttuu, eventFiles-mallinen parentId on helppo lisätä.
//
// Tiedostot tallentuvat HETI eivätkä "Tallenna kohde" -napista, koska lataus on oma
// tapahtumansa ja tiedosto on jo palvelimella. Tämä kerrotaan käyttäjälle näkyvästi,
// jottei hän luule menettävänsä latausta peruuttaessaan lomakkeen.
//
// Näkyvyys ja jako (28.9.2026, samat asetukset kuin tapahtuman tiedostoissa):
//  - "Vain ylläpidolle": tiedosto ei näy vartijalle (palvelin rajaa, ks. permissions.js:
//    guardFiles.vaatiiMuokkauksen). Esim. toimeksiantosopimus hintoineen.
//  - "Henkilötietoa": rajoittaa jakamista samoin kuin tapahtumapuolella.
//  - Jaa: linkki, linkki ja salasana tai nimetyt käyttäjät (JakoDialogi).

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
};

type Props = {
  tiedostot: KohteenTiedosto[];
  saaMuokata: boolean;
  onLisaa: (tiedosto: File) => Promise<void>;
  onPoista: (id: string) => Promise<void>;
  onMuuta: (id: string, muutos: Partial<KohteenTiedosto>) => Promise<void>;
  kohdeTallennettu: boolean;
  onAdmin: boolean;
};

const pvm = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' }) : '');

export const KohteenTiedostot = ({
  tiedostot,
  saaMuokata,
  onLisaa,
  onPoista,
  onMuuta,
  kohdeTallennettu,
  onAdmin,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lataa, setLataa] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [jaot, setJaot] = useState<Jako[]>([]);
  const [jaettava, setJaettava] = useState<KohteenTiedosto | null>(null);
  const [naytettyLinkki, setNaytettyLinkki] = useState<{ id: string; url: string } | null>(null);

  const idt = tiedostot.map((t) => t.id).join(',');
  const haeJaot = useCallback(() => {
    if (!saaMuokata) return;
    const omat = new Set(idt.split(','));
    fetch('/api/data/fileShares', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.ok && Array.isArray(res.data)) {
          setJaot(res.data.filter((j: Jako) => j.lahde === 'guardFiles' && omat.has(j.targetId) && !j.revokedAt));
        }
      })
      .catch(() => { /* jakolista jää tyhjäksi */ });
  }, [saaMuokata, idt]);

  useEffect(() => { haeJaot(); }, [haeJaot]);

  const valitse = async (tiedosto: File | undefined) => {
    if (!tiedosto) return;
    setVirhe(null);
    setLataa(true);
    try {
      await onLisaa(tiedosto);
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Tiedoston lähetys epäonnistui.');
    } finally {
      setLataa(false);
      // Nollataan, jotta saman tiedoston voi valita uudelleen jos ensimmäinen yritys
      // epäonnistui — muuten change-tapahtuma ei laukea toista kertaa.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // Uusi tyhjä dokumentti: lisätään samaa reittiä kuin ladattu tiedosto (onLisaa), ja
  // editoria varten tarvittava latauksen id luetaan palvelimelta tallennuksen jälkeen.
  // onLisaa ei palauta tietuetta, joten uusi tunnistetaan siitä ettei sen id ollut
  // listassa ennen lisäystä. onLisaa odottaa palvelimen hyväksynnän, joten tietue on
  // haettaessa varmasti jo tallessa.
  const luoDokumentti = async (tiedosto: File) => {
    const ennen = new Set(tiedostot.map((t) => t.id));
    await onLisaa(tiedosto);
    const r = await fetch('/api/data/guardFiles', { credentials: 'include' });
    const res = await r.json().catch(() => null);
    const uusi = (Array.isArray(res?.data) ? (res.data as KohteenTiedosto[]) : [])
      .find((t) => !ennen.has(t.id) && t.name === tiedosto.name);
    return uusi?.uploadId;
  };

  // Poisto kysyy vahvistuksen, kuten tapahtuman tiedostoissa (App.tsx:
  // poistaTiedostoTaiKansio): tiedosto ja sen jakolinkit katoavat pysyvästi.
  const poista = (t: KohteenTiedosto) => {
    const voimassa = jaot.filter((j) => j.targetId === t.id).length;
    const jakoVaroitus = voimassa > 0
      ? `\n\nHUOM: tiedostolla on ${voimassa} voimassa olevaa jakoa, jotka lakkaavat toimimasta.`
      : '';
    if (!window.confirm(`Poistetaanko "${t.name}"? Tätä ei voi perua.${jakoVaroitus}`)) return;
    onPoista(t.id);
  };

  const muuta = async (id: string, muutos: Partial<KohteenTiedosto>) => {
    setVirhe(null);
    try {
      await onMuuta(id, muutos);
    } catch (e) {
      setVirhe(e instanceof Error ? e.message : 'Muutoksen tallennus epäonnistui.');
    }
  };

  const jakoKutsu = async (polku: string, metodi: 'GET' | 'POST' | 'DELETE', runko?: unknown) => {
    setVirhe(null);
    try {
      const r = await fetch(polku, {
        method: metodi,
        credentials: 'include',
        headers: runko ? { 'Content-Type': 'application/json' } : undefined,
        body: runko ? JSON.stringify(runko) : undefined,
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        setVirhe(data?.error || 'Toiminto epäonnistui.');
        return null;
      }
      return data;
    } catch {
      setVirhe('Yhteysvirhe. Yritä uudelleen.');
      return null;
    }
  };

  const naytaLinkki = async (jako: Jako) => {
    const data = await jakoKutsu(`/api/shares/${encodeURIComponent(jako.id)}/token`, 'GET');
    if (data?.token) setNaytettyLinkki({ id: jako.id, url: jakolinkinOsoite(data.token) });
  };

  const peruuta = async (jako: Jako) => {
    if (!window.confirm('Peruutetaanko jako? Linkki lakkaa toimimasta heti.')) return;
    if (await jakoKutsu(`/api/shares/${encodeURIComponent(jako.id)}`, 'DELETE')) haeJaot();
  };

  const hyvaksy = async (jako: Jako, hyvaksytaan: boolean) => {
    if (await jakoKutsu(`/api/shares/${encodeURIComponent(jako.id)}/approval`, 'POST', { approve: hyvaksytaan })) haeJaot();
  };

  if (!kohdeTallennettu) {
    return (
      <div className="bg-sunken border border-line rounded-lg p-6 text-center">
        <FileText className="w-8 h-8 text-ink-subtle mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-ink-muted">
          Tallenna kohde ensin, niin voit liittää siihen tiedostoja.
        </p>
      </div>
    );
  }

  const nimi = (id: string) => tiedostot.find((t) => t.id === id)?.name || 'Poistettu tiedosto';
  const odottavat = jaot.filter((j) => j.approvalStatus === 'pending');

  return (
    <div>
      <p className="text-sm text-ink-muted mb-4">
        Kohteeseen liittyvät asiakirjat: toimeksiantosopimus, pohjapiirros, vartio-ohje.
        Tiedostot tallentuvat heti — niitä ei tarvitse erikseen tallentaa kohteen mukana.
        Vartijat näkevät tiedostot vartijanäkymän Tiedostot-kansiosta, ellei tiedostoa ole
        rajattu vain ylläpidolle.
      </p>

      {virhe && (
        <p className="mb-4 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
          {virhe}
        </p>
      )}

      {onAdmin && odottavat.length > 0 && (
        <div className="mb-6 bg-warning-soft border border-warning/40 rounded-lg p-4">
          <p className="text-sm font-bold text-warning-ink flex items-center gap-2 mb-2">
            <AlertTriangle size={16} />
            Pysyviä jakolinkkejä odottaa hyväksyntää ({odottavat.length})
          </p>
          <ul className="space-y-2">
            {odottavat.map((j) => (
              <li key={j.id} className="bg-surface border border-line rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-ink-strong min-w-0">
                  {nimi(j.targetId)}
                  <span className="text-xs text-ink-muted"> · pyytäjä {j.createdBy} · väliaikaisesti {pvm(j.expiresAt)} asti</span>
                </span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => hyvaksy(j, true)} className="text-xs font-bold text-success-ink bg-success-soft px-3 py-1.5 rounded-md">
                    Hyväksy pysyväksi
                  </button>
                  <button type="button" onClick={() => hyvaksy(j, false)} className="text-xs font-medium text-danger-ink bg-danger-soft px-3 py-1.5 rounded-md">
                    Hylkää
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tiedostot.length > 0 && (
        <div className="border border-line rounded-lg divide-y divide-line-soft mb-6">
          {tiedostot.map((t) => {
            const tiedostonJaot = jaot.filter((j) => j.targetId === t.id).length;
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <FileText size={16} className="text-accent shrink-0" />
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm font-medium text-ink truncate">{t.name}</p>
                  <p className="text-xs text-ink-muted">
                    {t.lisatty?.slice(0, 10)}
                    {t.lisaaja ? ` · ${t.lisaaja}` : ''}
                    {typeof t.size === 'number' ? ` · ${muotoileTavut(t.size)}` : ''}
                  </p>
                  <p className="flex flex-wrap gap-1.5 mt-1">
                    {t.vainYllapito && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-sunken text-ink-body border-line">
                        Vain ylläpidolle
                      </span>
                    )}
                    {t.containsPersonalData && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-danger-soft text-danger-ink border-danger/30">
                        Henkilötietoa
                      </span>
                    )}
                    {tiedostonJaot > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-success-soft text-success-ink border-success/30">
                        Jaettu ({tiedostonJaot})
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Esikatsele uploadId={t.uploadId} nimi={t.name} />
                  <AvaaEditorissa uploadId={t.uploadId} nimi={t.name} />
                  <a
                    href={`/api/uploads/${t.uploadId}`}
                    download={t.name}
                    className="text-ink-body hover:text-accent transition-colors p-1"
                    title="Lataa tiedosto"
                  >
                    <Download size={16} />
                  </a>
                  {saaMuokata && (
                    <>
                      <button
                        type="button"
                        onClick={() => muuta(t.id, { vainYllapito: !t.vainYllapito })}
                        title={t.vainYllapito ? 'Näytä myös vartijoille' : 'Rajaa vain ylläpidolle'}
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
                          t.vainYllapito ? 'text-ink-body bg-sunken hover:bg-line-soft' : 'text-success-ink bg-success-soft hover:opacity-80'
                        }`}
                      >
                        {t.vainYllapito ? <EyeOff size={13} /> : <Eye size={13} />}
                        {t.vainYllapito ? 'Vain ylläpidolle' : 'Näkyy vartijoille'}
                      </button>
                      <button
                        type="button"
                        onClick={() => muuta(t.id, { containsPersonalData: !t.containsPersonalData })}
                        title="Merkitse sisältääkö tiedosto henkilötietoa. Vaikuttaa siihen miten sen voi jakaa."
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
                          t.containsPersonalData ? 'text-danger-ink bg-danger-soft' : 'text-ink-muted bg-sunken hover:bg-line-soft'
                        }`}
                      >
                        <ShieldAlert size={13} />
                        {t.containsPersonalData ? 'Henkilötietoa' : 'Ei henkilötietoa'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setJaettava(t)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-accent bg-accent-soft px-2.5 py-1.5 rounded-md"
                      >
                        <Share2 size={13} />
                        Jaa
                      </button>
                      <button
                        type="button"
                        onClick={() => poista(t)}
                        className="text-ink-subtle hover:text-danger transition-colors p-1"
                        title="Poista tiedosto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {saaMuokata && jaot.length > 0 && (
        <div className="mb-6 bg-sunken border border-line rounded-lg p-4">
          <h4 className="text-sm font-bold text-ink-strong mb-3 flex items-center gap-2">
            <Link2 size={15} />
            Voimassa olevat jaot
          </h4>
          <ul className="space-y-2">
            {jaot.map((j) => {
              const tapa = j.mode === 'link' ? 'Linkki'
                : j.mode === 'password' ? 'Linkki + salasana'
                  : `Käyttäjät (${(j.allowedUsernames || []).length})`;
              return (
                <li key={j.id} className="bg-surface border border-line rounded-lg p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-strong truncate">{nimi(j.targetId)}</p>
                      <p className="text-xs text-ink-muted">
                        {tapa} · {j.mode === 'users'
                          ? 'voimassa toistaiseksi'
                          : j.expiresAt ? `voimassa ${pvm(j.expiresAt)} asti`
                            : j.approvalStatus === 'approved' ? 'pysyvä' : 'odottaa hyväksyntää'}
                        {' · '}ladattu {j.downloadCount || 0} kertaa{j.maxDownloads ? ` / ${j.maxDownloads}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {j.mode !== 'users' && (
                        <button type="button" onClick={() => naytaLinkki(j)} className="text-xs font-medium text-accent bg-accent-soft px-3 py-1.5 rounded-md">
                          Näytä linkki
                        </button>
                      )}
                      <button type="button" onClick={() => peruuta(j)} className="text-xs font-medium text-danger-ink bg-danger-soft px-3 py-1.5 rounded-md">
                        Peruuta
                      </button>
                    </div>
                  </div>
                  {naytettyLinkki?.id === j.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="flex-1 min-w-0 bg-sunken border border-line rounded px-2 py-1.5 text-xs font-mono break-all text-ink-strong">
                        {naytettyLinkki.url}
                      </code>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(naytettyLinkki.url)}
                        className="text-xs font-bold text-ink-body bg-sunken border border-line px-3 py-1.5 rounded-md"
                      >
                        Kopioi
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {saaMuokata && (
        <>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => valitse(e.target.files?.[0])}
          />
          <div className="flex flex-wrap items-start gap-2">
            <button
              type="button"
              disabled={lataa}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-60"
            >
              <Upload size={16} />
              {lataa ? 'Lähetetään…' : 'Lisää tiedosto'}
            </button>
            <UusiDokumentti onLuo={luoDokumentti} />
          </div>
          <p className="text-xs text-ink-subtle mt-2">
            Enintään 15 Mt. Tuetut tiedostotyypit: kuvat, PDF ja tavalliset asiakirjamuodot.
          </p>
        </>
      )}

      {tiedostot.length === 0 && !saaMuokata && (
        <p className="text-sm text-ink-muted">Kohteeseen ei ole liitetty tiedostoja.</p>
      )}

      {jaettava && (
        <JakoDialogi
          kohde={{ id: jaettava.id, name: jaettava.name, henkilotietoa: jaettava.containsPersonalData === true }}
          lahde="guardFiles"
          saaValitaKayttajia={onAdmin}
          onSulje={() => setJaettava(null)}
          onJaettu={haeJaot}
        />
      )}
    </div>
  );
};
