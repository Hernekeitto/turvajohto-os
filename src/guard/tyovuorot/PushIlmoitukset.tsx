// Push-ilmoitusten käyttöönotto tällä laitteella (10.10.2026).
//
// Tilaus on LAITEKOHTAINEN: puhelin ja tietokone tilataan erikseen, ja kumpikin saa
// ilmoitukset. Palvelin lähettää ne (server/index.js: PUSH-ILMOITUKSET) kun työvuoroihin
// tulee muutos, lista julkaistaan tai vuoronvaihto etenee.
//
// Toimii vain julkaistulla sivustolla ja asennetussa sovelluksessa: palvelutyöntekijä
// rekisteröidään vain tuotantobuildissa (src/shared/palvelutyontekija.ts), ja push vaatii
// sen. Kehityspalvelimella komponentti kertoo tämän eikä näytä rikkinäistä nappia.

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';

type Tila = 'tarkistetaan' | 'ei_tuettu' | 'ei_palvelutyontekijaa' | 'estetty' | 'pois' | 'paalla';

const muunnaAvain = (b64: string) => {
  const raaka = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(raaka, (c) => c.charCodeAt(0));
};

async function rekisterointi() {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) || null;
}

export const PushIlmoitukset = () => {
  const [tila, setTila] = useState<Tila>('tarkistetaan');
  const [viesti, setViesti] = useState<string | null>(null);
  const [tyossa, setTyossa] = useState(false);

  const tarkista = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setTila('ei_tuettu');
      return;
    }
    const reg = await rekisterointi();
    if (!reg) { setTila('ei_palvelutyontekijaa'); return; }
    if (Notification.permission === 'denied') { setTila('estetty'); return; }
    setTila((await reg.pushManager.getSubscription()) ? 'paalla' : 'pois');
  }, []);

  useEffect(() => { tarkista(); }, [tarkista]);

  const ota = async () => {
    setTyossa(true);
    setViesti(null);
    try {
      const lupa = await Notification.requestPermission();
      if (lupa !== 'granted') { setTila(lupa === 'denied' ? 'estetty' : 'pois'); return; }
      const reg = await rekisterointi();
      if (!reg) { setTila('ei_palvelutyontekijaa'); return; }
      const avain = await fetch('/api/push/avain', { credentials: 'include' }).then((r) => r.json());
      const tilaus = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: muunnaAvain(avain.publicKey) });
      const r = await fetch('/api/push/tilaus', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tilaus.toJSON()),
      });
      if (!r.ok) { setViesti('Tilauksen tallennus ei onnistunut.'); return; }
      setTila('paalla');
      setViesti('Ilmoitukset otettu käyttöön tällä laitteella.');
    } catch {
      setViesti('Ilmoitusten käyttöönotto ei onnistunut tällä laitteella.');
    } finally {
      setTyossa(false);
    }
  };

  const poista = async () => {
    setTyossa(true);
    const reg = await rekisterointi();
    const tilaus = await reg?.pushManager.getSubscription();
    if (tilaus) {
      await fetch('/api/push/tilaus', {
        method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: tilaus.endpoint }),
      }).catch(() => null);
      await tilaus.unsubscribe().catch(() => null);
    }
    setTyossa(false);
    setTila('pois');
    setViesti('Ilmoitukset poistettu käytöstä tällä laitteella.');
  };

  const testi = async () => {
    setTyossa(true);
    const v = await fetch('/api/push/testi', { method: 'POST', credentials: 'include' }).then((r) => r.json()).catch(() => null);
    setTyossa(false);
    setViesti(v?.ok ? 'Testi-ilmoitus lähetetty. Sen pitäisi näkyä hetken kuluttua.' : v?.error || 'Testi-ilmoitus ei mennyt perille.');
  };

  if (tila === 'tarkistetaan') return null;

  const selite: Record<Tila, string> = {
    tarkistetaan: '',
    ei_tuettu: 'Tämä selain ei tue ilmoituksia.',
    ei_palvelutyontekijaa: 'Ilmoitukset toimivat asennetussa sovelluksessa ja julkaistulla sivustolla.',
    estetty: 'Ilmoitukset on estetty tämän laitteen asetuksista. Salli ne selaimen tai sovelluksen asetuksista.',
    pois: 'Saat ilmoituksen puhelimeen kun työvuoroihisi tulee muutos, lista julkaistaan tai vuoronvaihto etenee.',
    paalla: 'Ilmoitukset ovat käytössä tällä laitteella.',
  };

  return (
    <div className="mb-6 rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-body flex items-start gap-2">
          {tila === 'paalla' ? <Bell size={16} className="text-accent shrink-0 mt-0.5" /> : <BellOff size={16} className="text-ink-subtle shrink-0 mt-0.5" />}
          <span>{selite[tila]}</span>
        </p>
        <div className="flex gap-2">
          {tila === 'pois' && (
            <button type="button" disabled={tyossa} onClick={ota} className="px-3 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg disabled:opacity-60">
              Ota ilmoitukset käyttöön
            </button>
          )}
          {tila === 'paalla' && (
            <>
              <button type="button" disabled={tyossa} onClick={testi} className="px-3 py-1.5 text-sm font-medium text-accent hover:underline disabled:opacity-60">
                Lähetä testi
              </button>
              <button type="button" disabled={tyossa} onClick={poista} className="px-3 py-1.5 text-sm font-medium text-ink-muted hover:text-danger disabled:opacity-60">
                Poista käytöstä
              </button>
            </>
          )}
        </div>
      </div>
      {viesti && <p className="mt-1.5 text-xs text-ink-muted">{viesti}</p>}
    </div>
  );
};
