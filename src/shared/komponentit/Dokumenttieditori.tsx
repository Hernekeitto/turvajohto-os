// Dokumenttieditori (Collabora Online): .odt- ja .odp-tiedostojen muokkaus selaimessa.
//
// Collabora ajetaan samassa domainissa, joten iframe ja lomakkeen lähetys pysyvät
// CSP:n 'self'-rajoissa (frame-src perii default-srcin, form-action 'self'). Editori
// avataan WOPI-tavalla: palvelin antaa editorin osoitteen ja kertakäyttöisen tokenin
// (/api/editori/avaa), ja token lähetetään iframeen POST-lomakkeella — ei URL:ssä,
// jottei se jää selaimen historiaan. Oikeudet ja vain luku -tila ratkaisee palvelin.

import { useEffect, useRef, useState } from 'react';
import { FilePen, X } from 'lucide-react';

type EditorinTila = { kaytossa: boolean; paatteet: string[] };

// Haetaan kerran per sivunlataus: tieto ei muutu kesken istunnon, ja jokainen
// tiedostorivi kysyy samaa.
let tilaLupaus: Promise<EditorinTila> | null = null;
function haeTila(): Promise<EditorinTila> {
  tilaLupaus ??= fetch('/api/editori/tila', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => ({ kaytossa: Boolean(d?.kaytossa), paatteet: Array.isArray(d?.paatteet) ? d.paatteet : [] }))
    .catch(() => ({ kaytossa: false, paatteet: [] }));
  return tilaLupaus;
}

function useEditorinTila(): EditorinTila | null {
  const [tila, setTila] = useState<EditorinTila | null>(null);
  useEffect(() => {
    let voimassa = true;
    haeTila().then((t) => { if (voimassa) setTila(t); });
    return () => { voimassa = false; };
  }, []);
  return tila;
}

type AvattuEditori = { url: string; token: string; ttl: number; kirjoitus: boolean; nimi: string };

// Painike tiedostorivin toimintoihin. Ei näy lainkaan, jos editori ei ole käytössä
// tai tiedostotyyppi ei ole editoitava.
export function AvaaEditorissa({ uploadId, nimi, className }: { uploadId?: string; nimi: string; className?: string }) {
  const tila = useEditorinTila();
  const [avattu, setAvattu] = useState<AvattuEditori | null>(null);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [ladataan, setLadataan] = useState(false);

  const paate = nimi.includes('.') ? nimi.slice(nimi.lastIndexOf('.')).toLowerCase() : '';
  if (!uploadId || !tila?.kaytossa || !tila.paatteet.includes(paate)) return null;

  const avaa = async () => {
    setVirhe(null);
    setLadataan(true);
    try {
      const r = await fetch('/api/editori/avaa', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) throw new Error(d?.error || 'Editorin avaus epäonnistui.');
      setAvattu({ url: d.url, token: d.token, ttl: d.ttl, kirjoitus: d.kirjoitus, nimi: d.nimi || nimi });
    } catch (err) {
      setVirhe(err instanceof Error ? err.message : 'Editorin avaus epäonnistui.');
    } finally {
      setLadataan(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={avaa}
        disabled={ladataan}
        title={virhe || 'Avaa dokumenttieditorissa'}
        className={className || `inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
          virhe ? 'text-danger-ink bg-danger-soft' : 'text-accent bg-sunken hover:bg-line-soft'
        } disabled:opacity-60`}
      >
        <FilePen size={13} />
        {ladataan ? 'Avataan…' : virhe ? 'Ei avautunut' : 'Muokkaa'}
      </button>
      {avattu && <EditoriIkkuna avattu={avattu} sulje={() => setAvattu(null)} />}
    </>
  );
}

function EditoriIkkuna({ avattu, sulje }: { avattu: AvattuEditori; sulje: () => void }) {
  const lomake = useRef<HTMLFormElement>(null);
  const kehys = useRef<HTMLIFrameElement>(null);
  // Iframen nimi on lomakkeen kohde. Uniikki, jotta kaksi auki olevaa editoria (eri
  // välilehdillä samassa ikkunassa) eivät lähetä toistensa kehykseen.
  const [kehyksenNimi] = useState(() => `editori-${Math.random().toString(36).slice(2)}`);
  const lahetetty = useRef(false);

  useEffect(() => {
    // StrictMode ajaa efektin kahdesti kehityksessä — toinen lähetys avaisi editorin
    // uudelleen ja katkaisisi ensimmäisen istunnon.
    if (lahetetty.current) return;
    lahetetty.current = true;
    lomake.current?.submit();
  }, []);

  useEffect(() => {
    // Collaboran viestit tulevat iframesta samasta originista. "Sulje"-painike editorissa
    // lähettää UI_Close; Frame_Ready-viestiin vastataan Host_PostmessageReady, jotta
    // Collabora tietää isäntäsivun kuuntelevan (muuten se ei lähetä UI_Closea).
    const kuuntele = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== kehys.current?.contentWindow) return;
      let viesti: { MessageId?: string; Values?: { Status?: string } } | null = null;
      try { viesti = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      if (viesti?.MessageId === 'App_LoadingStatus' && viesti.Values?.Status === 'Frame_Ready') {
        kehys.current?.contentWindow?.postMessage(
          JSON.stringify({ MessageId: 'Host_PostmessageReady', SendTime: Date.now(), Values: {} }),
          window.location.origin
        );
      }
      if (viesti?.MessageId === 'UI_Close') sulje();
    };
    window.addEventListener('message', kuuntele);
    return () => window.removeEventListener('message', kuuntele);
  }, [sulje]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && e.target === document.body) sulje(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [sulje]);

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-surface" role="dialog" aria-label={`Dokumenttieditori: ${avattu.nimi}`}>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-line bg-surface">
        <FilePen size={16} className="text-accent shrink-0" />
        <p className="text-sm font-medium text-ink truncate flex-1">{avattu.nimi}</p>
        {!avattu.kirjoitus && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-sunken text-ink-body border-line">
            Vain luku
          </span>
        )}
        <button
          type="button"
          onClick={sulje}
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md text-ink-body bg-sunken hover:bg-line-soft"
          title="Sulje editori. Muutokset tallentuvat automaattisesti."
        >
          <X size={13} /> Sulje
        </button>
      </div>
      <form ref={lomake} action={avattu.url} method="post" target={kehyksenNimi} className="hidden">
        <input type="hidden" name="access_token" value={avattu.token} />
        <input type="hidden" name="access_token_ttl" value={String(avattu.ttl)} />
      </form>
      <iframe
        ref={kehys}
        name={kehyksenNimi}
        title={`Dokumenttieditori: ${avattu.nimi}`}
        className="flex-1 w-full border-0"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}
