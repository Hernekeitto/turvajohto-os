// "Tiedostot" yläpalkista (29.9.2026): käyttäjän henkilökohtainen kansio ja tallennustila.
//
// Sama näkymä EVENT- ja GUARD-puolella sekä mobiilissa. Mobiilissa dokumentteja ei
// muokata eikä luoda (käyttäjän päätös 28.9.2026) — esikatselu, lataus, kansiot,
// lataaminen puhelimesta ja jakaminen toimivat.
//
// Kiintiö ja omistajuus ovat palvelimella (server/omattiedostot.js); tämä näyttää tilan ja
// kertoo rajan ylityksestä. Ylityksen yhteydessä tarjotaan lomake lisätilan pyytämiseen.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronRight, Download, FileText, Folder, FolderPlus, HardDrive, Inbox, Pencil, Share2,
  Trash2, Upload, AlertTriangle, CheckCircle2, XCircle, Clock,
} from 'lucide-react';

import { TakaisinLinkki } from './TakaisinLinkki';
import { AvaaEditorissa, Esikatsele, UusiDokumentti } from './Dokumenttieditori';
import { JakoDialogi } from './JakoDialogi';
import {
  LISATILAN_VAIHTOEHDOT, haeOmat, kansionKoko, kuittaaPaatos, lataaTiedosto, luoKansio,
  muotoileKoko, muotoileMt, murupolku, nimeaUudelleen, poistaOma, pyydaLisatilaa,
  type LisatilaPyynto, type OmaKohde, type TallennustilanTila,
} from '../omatTiedostot';

type JaettuMinulle = {
  shareId: string;
  name: string;
  type: string;
  sharedBy?: string;
  sharedAt?: string;
  files: { id: string; name: string; uploadId?: string; size?: number }[];
};

type Props = {
  onTakaisin: () => void;
  // Mobiilissa ei muokata eikä luoda dokumentteja.
  mobiili?: boolean;
};

const pvm = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fi-FI') : '');

export const OmatTiedostot = ({ onTakaisin, mobiili = false }: Props) => {
  const [kohteet, setKohteet] = useState<OmaKohde[]>([]);
  const [tila, setTila] = useState<TallennustilanTila | null>(null);
  const [pyynnot, setPyynnot] = useState<LisatilaPyynto[]>([]);
  const [jaetut, setJaetut] = useState<JaettuMinulle[]>([]);
  const [kansio, setKansio] = useState<string | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [ilmoitus, setIlmoitus] = useState<string | null>(null);
  const [uusiKansio, setUusiKansio] = useState('');
  const [lataa, setLataa] = useState(false);
  const [jaettava, setJaettava] = useState<OmaKohde | null>(null);
  const [nimettava, setNimettava] = useState<{ id: string; nimi: string } | null>(null);
  const [lomakeAuki, setLomakeAuki] = useState(false);
  const [perustelu, setPerustelu] = useState('');
  const [maara, setMaara] = useState(LISATILAN_VAIHTOEHDOT[0]);
  const [nahdytPaatokset, setNahdytPaatokset] = useState<LisatilaPyynto[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const hae = useCallback(async () => {
    const tulos = await haeOmat();
    if (!tulos.ok) { setVirhe(tulos.error); return; }
    setKohteet(tulos.tiedostot);
    setTila(tulos.tila);
    setPyynnot(tulos.pyynnot);
    // Päätös näytetään tällä kertaa ja kuitataan nähdyksi, jolloin ilmoitus poistuu kellosta.
    const uudet = tulos.pyynnot.filter((p) => p.tila !== 'odottaa' && !p.kuitattu);
    if (uudet.length > 0) {
      setNahdytPaatokset((e) => [...e, ...uudet.filter((u) => !e.some((x) => x.id === u.id))]);
      await Promise.all(uudet.map((p) => kuittaaPaatos(p.id)));
    }
  }, []);

  useEffect(() => {
    hae();
    fetch('/api/shares/for-me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => { if (res?.ok && Array.isArray(res.shares)) setJaetut(res.shares); })
      .catch(() => { /* jaetut jäävät tyhjiksi */ });
  }, [hae]);

  const nykyiset = kohteet
    .filter((k) => (k.parentId || null) === kansio)
    .sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name, 'fi')));
  const polku = murupolku(kohteet, kansio);
  const odottava = pyynnot.find((p) => p.tila === 'odottaa');

  const lahetaTiedostot = async (tiedostot: FileList | null) => {
    if (!tiedostot || tiedostot.length === 0) return;
    setVirhe(null);
    setIlmoitus(null);
    setLataa(true);
    try {
      for (const tiedosto of Array.from(tiedostot)) {
        const tulos = await lataaTiedosto(tiedosto, kansio);
        if (!tulos.ok) {
          setVirhe(`${tiedosto.name}: ${tulos.error}`);
          if (tulos.taynna) setLomakeAuki(true);
          break;
        }
        if (tulos.ylitys) {
          setIlmoitus('Tallennustilasi raja ylittyi. Tiedosto tallennettiin varatilaan, mutta pyydä lisää tilaa tai poista tiedostoja.');
        }
      }
    } finally {
      setLataa(false);
      if (inputRef.current) inputRef.current.value = '';
      hae();
    }
  };

  const luoUusiDokumentti = async (tiedosto: File) => {
    const tulos = await lataaTiedosto(tiedosto, kansio);
    if (!tulos.ok) throw new Error(tulos.error);
    if (tulos.ylitys) setIlmoitus('Tallennustilasi raja ylittyi. Pyydä lisää tilaa tai poista tiedostoja.');
    hae();
    return tulos.uploadId;
  };

  const teeKansio = async () => {
    if (!uusiKansio.trim()) return;
    const tulos = await luoKansio(uusiKansio, kansio);
    if (!tulos.ok) { setVirhe(tulos.error); return; }
    setUusiKansio('');
    hae();
  };

  const poista = async (k: OmaKohde) => {
    const teksti = k.type === 'folder'
      ? `Poistetaanko kansio "${k.name}" ja kaikki sen sisältö? Poistoa ei voi perua.`
      : `Poistetaanko "${k.name}"? Poistoa ei voi perua.`;
    if (!window.confirm(teksti)) return;
    const tulos = await poistaOma(k.id);
    if (!tulos.ok) { setVirhe(tulos.error); return; }
    hae();
  };

  const tallennaNimi = async () => {
    if (!nimettava) return;
    const tulos = await nimeaUudelleen(nimettava.id, nimettava.nimi);
    if (!tulos.ok) { setVirhe(tulos.error); return; }
    setNimettava(null);
    hae();
  };

  const lahetaPyynto = async () => {
    setVirhe(null);
    const tulos = await pyydaLisatilaa(perustelu, maara);
    if (!tulos.ok) { setVirhe(tulos.error); return; }
    setLomakeAuki(false);
    setPerustelu('');
    setIlmoitus('Pyyntö lähetettiin pääkäyttäjälle. Saat ilmoituksen kun se on käsitelty.');
    hae();
  };

  const osuus = tila && tila.raja ? Math.min(100, Math.round((tila.kaytetty / tila.raja) * 100)) : 0;

  return (
    <div className="max-w-4xl">
      <TakaisinLinkki onClick={onTakaisin}>Takaisin</TakaisinLinkki>
      <h2 className="text-2xl font-bold text-ink-strong mb-1">Tiedostot</h2>
      <p className="text-sm text-ink-muted mb-6">
        Oma kansiosi ja tallennustilasi. Tiedostot näkyvät vain sinulle, ellet jaa niitä.
      </p>

      {/* --- Tallennustila --- */}
      {tila && (
        <section className={`mb-6 rounded-xl border p-4 ${tila.ylitys ? 'bg-warning-soft border-warning/40' : 'bg-surface border-line'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-ink-strong flex items-center gap-2">
              <HardDrive size={16} />
              Tallennustila: {muotoileKoko(tila.kaytetty)}
              {tila.raja === null ? ' · ei rajaa' : ` / ${muotoileKoko(tila.raja)}`}
            </p>
            {tila.raja !== null && !odottava && (
              <button
                type="button"
                onClick={() => setLomakeAuki((a) => !a)}
                className="text-xs font-bold text-accent hover:text-accent-hover"
              >
                Pyydä lisää tallennustilaa
              </button>
            )}
          </div>
          {tila.raja !== null && (
            <div className="mt-2 h-2 rounded-full bg-sunken overflow-hidden" role="progressbar" aria-valuenow={osuus} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full ${tila.ylitys ? 'bg-danger' : osuus > 85 ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${osuus}%` }} />
            </div>
          )}
          {tila.ylitys && (
            <p className="mt-3 text-sm text-warning-ink flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              Tallennustilasi raja on ylittynyt. Voit tallentaa vielä enintään {muotoileKoko(tila.puskuri)} rajan yli.
              Poista tiedostoja tai pyydä pääkäyttäjältä lisää tilaa.
            </p>
          )}
          {odottava && (
            <p className="mt-3 text-sm text-ink-body flex gap-2">
              <Clock size={16} className="shrink-0 mt-0.5" />
              Lisätilapyyntösi ({muotoileMt(odottava.pyydettyMt)}) odottaa pääkäyttäjän käsittelyä.
            </p>
          )}
          {lomakeAuki && !odottava && (
            <div className="mt-4 border-t border-line-soft pt-4 space-y-3">
              <p className="text-sm font-bold text-ink-strong">Pyydä lisää tallennustilaa</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pyydettävä määrä">
                {LISATILAN_VAIHTOEHDOT.map((mt) => (
                  <button
                    key={mt}
                    type="button"
                    role="radio"
                    aria-checked={maara === mt}
                    onClick={() => setMaara(mt)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${
                      maara === mt ? 'bg-accent border-accent text-white' : 'bg-surface border-line text-ink-body hover:bg-sunken'
                    }`}
                  >
                    {muotoileMt(mt)}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="block text-sm text-ink-body mb-1">Miksi tarvitset lisää tilaa?</span>
                <textarea
                  value={perustelu}
                  onChange={(e) => setPerustelu(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Esim. tallennan kohteen valvontakuvat kuukauden ajalta"
                  className="w-full bg-sunken border border-line-soft rounded-lg px-3 py-2 text-sm text-ink-strong"
                />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={lahetaPyynto} className="px-4 py-2 text-sm font-bold text-white bg-accent hover:bg-accent-hover rounded-lg">
                  Lähetä pyyntö
                </button>
                <button type="button" onClick={() => setLomakeAuki(false)} className="px-4 py-2 text-sm font-medium text-ink-body bg-sunken rounded-lg">
                  Peruuta
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {nahdytPaatokset.map((p) => (
        <p
          key={p.id}
          className={`mb-4 text-sm rounded-lg px-4 py-3 border flex gap-2 ${
            p.tila === 'hyvaksytty' ? 'bg-success-soft border-success/30 text-success-ink' : 'bg-danger-soft border-danger/30 text-danger-ink'
          }`}
        >
          {p.tila === 'hyvaksytty' ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <XCircle size={16} className="shrink-0 mt-0.5" />}
          {p.tila === 'hyvaksytty'
            ? `Lisätilapyyntösi hyväksyttiin: tallennustilaasi lisättiin ${muotoileMt(p.myonnettyMt)}.`
            : `Lisätilapyyntösi hylättiin.${p.paatoksenSyy ? ` Syy: ${p.paatoksenSyy}` : ''}`}
        </p>
      ))}

      {ilmoitus && (
        <p className="mb-4 text-sm text-ink-body bg-accent-soft border border-accent/30 rounded-lg px-4 py-3">{ilmoitus}</p>
      )}
      {virhe && (
        <p className="mb-4 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">{virhe}</p>
      )}

      {/* --- Murupolku --- */}
      <nav className="flex items-center gap-1 flex-wrap text-sm mb-3" aria-label="Kansiopolku">
        <button
          type="button"
          onClick={() => setKansio(null)}
          className={`px-2 py-1 rounded-md ${kansio === null ? 'font-bold text-ink-strong' : 'text-accent hover:bg-sunken'}`}
        >
          Omat tiedostot
        </button>
        {polku.map((k, i) => (
          <span key={k.id} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-ink-subtle" />
            <button
              type="button"
              onClick={() => setKansio(k.id)}
              className={`px-2 py-1 rounded-md ${i === polku.length - 1 ? 'font-bold text-ink-strong' : 'text-accent hover:bg-sunken'}`}
            >
              {k.name}
            </button>
          </span>
        ))}
      </nav>

      {/* --- Toiminnot --- */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-2 flex-1 min-w-[220px]">
          <input
            type="text"
            value={uusiKansio}
            onChange={(e) => setUusiKansio(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') teeKansio(); }}
            placeholder="Uuden kansion nimi"
            maxLength={120}
            className="flex-1 min-w-0 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink-strong"
          />
          <button
            type="button"
            onClick={teeKansio}
            disabled={!uusiKansio.trim()}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-ink-body bg-sunken hover:bg-line-soft disabled:opacity-50"
          >
            <FolderPlus size={16} />
            Luo kansio
          </button>
        </div>
        {!mobiili && <UusiDokumentti onLuo={luoUusiDokumentti} />}
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => lahetaTiedostot(e.target.files)} />
        <button
          type="button"
          disabled={lataa}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-accent hover:bg-accent-hover disabled:opacity-60 rounded-lg"
        >
          <Upload size={16} />
          {lataa ? 'Lähetetään…' : 'Lisää tiedostoja'}
        </button>
      </div>

      {/* --- Sisältö --- */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden mb-8">
        {nykyiset.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-muted">
            {kansio ? 'Kansio on tyhjä.' : 'Ei vielä tiedostoja. Luo kansio tai lisää tiedostoja yltä.'}
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {nykyiset.map((k) => (
              <li key={k.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {k.type === 'folder'
                    ? <Folder size={18} className="text-accent shrink-0" />
                    : <FileText size={18} className="text-ink-muted shrink-0" />}
                  {nimettava?.id === k.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={nimettava.nimi}
                      onChange={(e) => setNimettava({ id: k.id, nimi: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') tallennaNimi();
                        if (e.key === 'Escape') setNimettava(null);
                      }}
                      onBlur={tallennaNimi}
                      maxLength={120}
                      className="flex-1 min-w-0 bg-sunken border border-line-soft rounded px-2 py-1 text-sm"
                    />
                  ) : k.type === 'folder' ? (
                    <button type="button" onClick={() => setKansio(k.id)} className="text-left min-w-0">
                      <span className="block text-sm font-medium text-ink-strong truncate hover:text-accent">{k.name}</span>
                      <span className="block text-xs text-ink-muted">Kansio · {muotoileKoko(kansionKoko(kohteet, k.id))}</span>
                    </button>
                  ) : (
                    <a href={`/api/uploads/${k.uploadId}`} target="_blank" rel="noreferrer" className="min-w-0">
                      <span className="block text-sm font-medium text-ink-strong truncate hover:text-accent">{k.name}</span>
                      <span className="block text-xs text-ink-muted">{muotoileKoko(k.size)} · {pvm(k.muokattu || k.createdAt)}</span>
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {k.type === 'file' && <Esikatsele uploadId={k.uploadId} nimi={k.name} />}
                  {k.type === 'file' && !mobiili && <AvaaEditorissa uploadId={k.uploadId} nimi={k.name} />}
                  {k.type === 'file' && (
                    <a href={`/api/uploads/${k.uploadId}`} download={k.name} title="Lataa" className="p-1.5 text-ink-muted hover:text-accent">
                      <Download size={15} />
                    </a>
                  )}
                  <button type="button" title="Jaa" onClick={() => setJaettava(k)} className="p-1.5 text-accent hover:text-accent-hover">
                    <Share2 size={15} />
                  </button>
                  <button type="button" title="Nimeä uudelleen" onClick={() => setNimettava({ id: k.id, nimi: k.name })} className="p-1.5 text-ink-muted hover:text-ink-strong">
                    <Pencil size={15} />
                  </button>
                  <button type="button" title="Poista" onClick={() => poista(k)} className="p-1.5 text-ink-muted hover:text-danger">
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- Minulle jaetut --- */}
      <section>
        <h3 className="text-base font-bold text-ink-strong mb-2 flex items-center gap-2">
          <Inbox size={17} />
          Minulle jaetut
        </h3>
        {jaetut.length === 0 ? (
          <p className="text-sm text-ink-muted">Sinulle ei ole jaettu tiedostoja.</p>
        ) : (
          <ul className="space-y-2">
            {jaetut.map((j) => (
              <li key={j.shareId} className="bg-surface border border-line rounded-lg p-3">
                <p className="text-sm font-medium text-ink-strong flex items-center gap-2">
                  {j.type === 'folder' ? <Folder size={15} className="text-accent" /> : <FileText size={15} className="text-ink-muted" />}
                  {j.name}
                  <span className="text-xs font-normal text-ink-muted">· jakaja {j.sharedBy} {pvm(j.sharedAt)}</span>
                </p>
                <ul className="mt-1.5 space-y-1">
                  {j.files.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm pl-6">
                      <a href={`/api/uploads/${t.uploadId}`} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate">
                        {t.name}
                      </a>
                      <span className="text-xs text-ink-subtle">{muotoileKoko(t.size)}</span>
                      <Esikatsele uploadId={t.uploadId} nimi={t.name} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {jaettava && (
        <JakoDialogi
          kohde={{ id: jaettava.id, name: jaettava.name, henkilotietoa: false }}
          lahde="personalFiles"
          saaValitaKayttajia
          onSulje={() => setJaettava(null)}
          onJaettu={() => { /* jaot näkyvät dialogissa itsessään */ }}
        />
      )}
    </div>
  );
};
