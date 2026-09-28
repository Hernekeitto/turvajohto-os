// Dokumenttieditorin (Collabora Online) tila ja osoitteet. Komponentit ovat tiedostossa
// komponentit/Dokumenttieditori.tsx; tämä on erillään, jotta sama osoitelogiikka on
// käytettävissä myös näkymissä joissa rivi itse on linkki (VartijanTiedostot).
//
// Editori avautuu omaan välilehteensä (public/editori.html), joka hakee itse tokenin ja
// osoitteen palvelimelta. Oikeudet ja vain luku -tila ratkaisee palvelin.

import { useEffect, useState } from 'react';

export type EditorinTila = { kaytossa: boolean; muokattavat: string[]; esikatseltavat: string[] };

const EI_KAYTOSSA: EditorinTila = { kaytossa: false, muokattavat: [], esikatseltavat: [] };

// Haetaan kerran per sivunlataus: tieto ei muutu kesken istunnon, ja jokainen
// tiedostorivi kysyy samaa.
let tilaLupaus: Promise<EditorinTila> | null = null;
function haeTila(): Promise<EditorinTila> {
  tilaLupaus ??= fetch('/api/editori/tila', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.kaytossa
      ? {
        kaytossa: true,
        muokattavat: Array.isArray(d.muokattavat) ? d.muokattavat : [],
        esikatseltavat: Array.isArray(d.esikatseltavat) ? d.esikatseltavat : [],
      }
      : EI_KAYTOSSA))
    .catch(() => EI_KAYTOSSA);
  return tilaLupaus;
}

export function useEditorinTila(): EditorinTila | null {
  const [tila, setTila] = useState<EditorinTila | null>(null);
  useEffect(() => {
    let voimassa = true;
    haeTila().then((t) => { if (voimassa) setTila(t); });
    return () => { voimassa = false; };
  }, []);
  return tila;
}

export const paate = (nimi: string) => (nimi.includes('.') ? nimi.slice(nimi.lastIndexOf('.')).toLowerCase() : '');

// Tyypit jotka selain näyttää itse. Näille esikatselu on tiedosto sellaisenaan uudessa
// välilehdessä — Collaboran kautta kierrättäminen olisi hitaampaa eikä toisi mitään.
const SELAIN_NAYTTAA = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt']);

export const editorinOsoite = (uploadId: string, tila: 'muokkaus' | 'katselu') =>
  `/editori.html?tiedosto=${encodeURIComponent(uploadId)}&tila=${tila}`;

// Esikatselun osoite: Office-tiedostot editoriin vain luku -tilaan, PDF:t, kuvat ja
// teksti selaimeen. null = tyyppiä ei voi esikatsella (esim. HEIC), vain ladata.
export function esikatselunOsoite(tila: EditorinTila | null, uploadId: string | undefined, nimi: string): string | null {
  if (!uploadId) return null;
  const p = paate(nimi);
  if (SELAIN_NAYTTAA.has(p)) return `/api/uploads/${encodeURIComponent(uploadId)}`;
  if (tila?.kaytossa && tila.esikatseltavat.includes(p)) return editorinOsoite(uploadId, 'katselu');
  return null;
}

// Jakolinkin editorioikeus: saako saaja vain esikatsella vai myös muokata jaettuja
// dokumentteja (server/editori.js: jaonEditoriTila).
export type EditoriOikeus = 'katselu' | 'muokkaus';
