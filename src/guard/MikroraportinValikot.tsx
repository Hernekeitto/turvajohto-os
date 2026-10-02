// Mikroraportin valikot, pääkäyttäjän osio GUARDin Sovellusasetuksissa (2.10.2026).
//
// Yksi luettelo kaikille kohteille, ja sitä muokataan .ods-taulukkona Toimistossa
// (käyttäjän päätös). Palvelin tarkistaa jokaisen tallennuksen ja ottaa taulukon käyttöön
// vain jos siinä ei ole virheitä (server/mikroluettelo.js). Tämä osio kertoo, mikä versio
// on vartijoilla käytössä ja miksi viimeisin tallennus mahdollisesti hylättiin.
//
// Tila haetaan uudelleen kun ikkuna saa kohdistuksen: taulukkoa muokataan toisessa
// välilehdessä, ja palatessa on nähtävä heti kelpasiko tallennus.
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, ExternalLink, ListTree, RefreshCw, RotateCcw } from 'lucide-react';

import { editorinOsoite } from '../shared/editori';
import { SISAANRAKENNETTU } from './mikroraportti/mikro';

type Taulukko = {
  uploadId: string;
  name: string;
  muokattu?: string;
  muokkaaja?: string;
  versio?: number;
  kayttoonOtettu?: string;
  kayttoonOtti?: string;
  tarkistettu?: string;
  virheet?: string[];
  varoitukset?: string[];
  paikkoja: number;
  otsikoita: number;
};

type Tila = {
  taulukko: Taulukko | null;
  editori: boolean;
  omat: { paikat: { teksti: string; maara: number }[]; otsikot: { teksti: string; maara: number }[] };
};

const aika = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
};

const OmatLista = ({ otsikko, rivit }: { otsikko: string; rivit: { teksti: string; maara: number }[] }) => (
  <div>
    <p className="text-sm font-medium text-ink-body mb-1">{otsikko}</p>
    {rivit.length === 0 ? (
      <p className="text-xs text-ink-muted">Ei vielä omia kirjauksia.</p>
    ) : (
      <ul className="text-sm space-y-0.5">
        {rivit.map((r) => (
          <li key={r.teksti} className="flex gap-3">
            <span className="w-8 text-right text-ink-muted tabular-nums">{r.maara}×</span>
            <span className="text-ink-body">{r.teksti}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const MikroraportinValikot = ({ isAdmin }: { isAdmin: boolean }) => {
  const [tila, setTila] = useState<Tila | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tyossa, setTyossa] = useState(false);

  const hae = useCallback(() => {
    fetch('/api/mikroluettelo/tila', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((vastaus) => {
        if (vastaus?.ok) { setTila(vastaus); setVirhe(null); } else setVirhe('Tilan lukeminen ei onnistunut.');
      })
      .catch(() => setVirhe('Tilan lukeminen ei onnistunut: ei yhteyttä palvelimeen.'));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    hae();
    window.addEventListener('focus', hae);
    return () => window.removeEventListener('focus', hae);
  }, [isAdmin, hae]);

  // Luonti tai palautus: palvelin muodostaa taulukon sisäänrakennetusta luettelosta.
  const luo = async (korvaa: boolean) => {
    if (korvaa && !window.confirm(
      'Palautetaanko sisäänrakennettu luettelo? Taulukkoon tehdyt muutokset korvataan, '
      + 'ja vartijoille tulee käyttöön alkuperäinen luettelo.'
    )) return;
    setTyossa(true);
    try {
      const r = await fetch('/api/mikroluettelo/luo', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ luettelo: SISAANRAKENNETTU, korvaa }),
      });
      const vastaus = await r.json().catch(() => null);
      if (!vastaus?.ok) setVirhe(vastaus?.error || 'Taulukon luonti ei onnistunut.');
      hae();
    } catch {
      setVirhe('Taulukon luonti ei onnistunut: ei yhteyttä palvelimeen.');
    } finally {
      setTyossa(false);
    }
  };

  if (!isAdmin) return null;
  const t = tila?.taulukko;
  const hylatty = !!t?.virheet?.length;

  return (
    <div className="bg-surface rounded-xl border border-line shadow-sm p-6 mb-6">
      <h3 className="text-lg font-bold text-ink flex items-center gap-2">
        <ListTree size={18} className="text-accent" />
        Mikroraportin valikot
      </h3>
      <p className="text-sm text-ink-muted mt-1 leading-relaxed">
        Paikat ja otsikot, joista vartija valitsee mikroraportin. Sama luettelo kaikissa kohteissa.
        Muokkaa taulukkoa Toimistossa. Tallennus otetaan käyttöön heti, jos taulukossa ei ole virheitä.
      </p>

      {virhe && <p className="text-sm text-danger mt-3">{virhe}</p>}

      {!tila ? (
        !virhe && <p className="text-sm text-ink-muted mt-3">Luetaan…</p>
      ) : !t ? (
        <div className="mt-4">
          <p className="text-sm text-ink-body">
            Taulukkoa ei ole vielä luotu, joten vartijoilla on käytössä sisäänrakennettu luettelo
            ({SISAANRAKENNETTU.paikat.length} paikkaa, {SISAANRAKENNETTU.tapahtumat.length} otsikkoa).
          </p>
          <button
            type="button"
            disabled={tyossa}
            onClick={() => luo(false)}
            className="mt-3 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-60"
          >
            {tyossa ? 'Luodaan…' : 'Luo taulukko nykyisestä luettelosta'}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 size={18} className="text-success shrink-0 mt-0.5" />
            <p className="text-ink-body">
              Vartijoilla käytössä versio {t.versio || 0}: {t.paikkoja} paikkaa ja {t.otsikoita} otsikkoa.
              {t.kayttoonOtettu && (
                <span className="block text-xs text-ink-muted">
                  Otettu käyttöön {aika(t.kayttoonOtettu)}{t.kayttoonOtti ? ` (${t.kayttoonOtti})` : ''}.
                </span>
              )}
            </p>
          </div>

          {hylatty && (
            <div className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
              <p className="font-medium text-danger-ink flex items-center gap-2">
                <AlertTriangle size={16} />
                Viimeisin tallennus ({aika(t.tarkistettu)}) ei kelpaa. Vartijoilla pysyy versio {t.versio || 0}.
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-0.5 text-danger-ink">
                {t.virheet!.map((v) => <li key={v}>{v}</li>)}
              </ul>
            </div>
          )}

          {!!t.varoitukset?.length && (
            <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
              <p className="font-medium text-warning-ink">Huomioita viimeisimmästä tallennuksesta</p>
              <ul className="mt-2 list-disc pl-5 space-y-0.5 text-warning-ink">
                {t.varoitukset.map((v) => <li key={v}>{v}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {tila.editori ? (
              <a
                href={editorinOsoite(t.uploadId, 'muokkaus')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg"
              >
                <ExternalLink size={16} />
                Avaa Toimistossa
              </a>
            ) : (
              <span className="text-sm text-ink-muted self-center">Toimisto ei ole käytössä tällä palvelimella.</span>
            )}
            <a
              href={`/api/uploads/${encodeURIComponent(t.uploadId)}`}
              download={t.name}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-body bg-sunken hover:bg-line rounded-lg"
            >
              <Download size={16} />
              Lataa taulukko
            </a>
            <button
              type="button"
              onClick={hae}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-body bg-sunken hover:bg-line rounded-lg"
            >
              <RefreshCw size={16} />
              Päivitä tila
            </button>
            <button
              type="button"
              disabled={tyossa}
              onClick={() => luo(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-body bg-sunken hover:bg-line rounded-lg disabled:opacity-60"
            >
              <RotateCcw size={16} />
              Palauta sisäänrakennettu luettelo
            </button>
          </div>
          <p className="text-xs text-ink-muted">
            Taulukkoa muokattu viimeksi {aika(t.muokattu)}{t.muokkaaja ? ` (${t.muokkaaja})` : ''}.
          </p>
        </div>
      )}

      {tila && (
        <div className="mt-6 pt-4 border-t border-line-soft">
          <p className="text-sm font-semibold text-ink-strong">Vartijoiden omat kirjaukset</p>
          <p className="text-xs text-ink-muted mb-3">
            Paikat ja otsikot, jotka vartijat ovat kirjoittaneet itse, koska luettelosta ei löytynyt sopivaa.
            Useimmin toistuvat kannattaa lisätä taulukkoon.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <OmatLista otsikko="Paikat" rivit={tila.omat.paikat} />
            <OmatLista otsikko="Otsikot" rivit={tila.omat.otsikot} />
          </div>
        </div>
      )}
    </div>
  );
};
