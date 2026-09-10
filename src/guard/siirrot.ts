// Tehtävänsiirron selainpuoli: tyypit ja kutsut (erä 18).
//
// Säännöt ovat palvelimella (server/siirto.js). Tämä tiedosto ei päätä mistään.
//
// --- Miksi siirto ei ole osa vuoroa ------------------------------------------------
//
// Siirretty kierros voi olla eri kohteessa kuin saajan oma vuoro — piirivartija tulee
// ajamaan kauppakeskusvartijan kierroksen. Siksi siirto on oma tietueensa, ja vartijan
// työlista syntyy yhdistämällä vuoron omat tehtävät, hyväksytyt siirrot ja hälytykset.
// Lista on VARTIJAN, vuoro vain kylvää sen (päätös 10.9.2026).

export type SiirronTila = 'odottaa' | 'hyvaksytty' | 'hylatty' | 'peruttu' | 'kuitattu';

export type Siirto = {
  id: string;
  laji: 'tehtava' | 'kierros';
  kohdeId: string;
  nimi: string;
  siteId: string;
  siteNimi: string;
  antaja: string;
  saaja: string;
  vuoroId: string | null;
  // 'siirto' = hyväksytään tai hylätään. 'pakotus' = kuitataan (erä 19).
  tapa: 'siirto' | 'pakotus';
  tila: SiirronTila;
  viesti: string;
  luotu: string;
  ratkaistu: string | null;
};

export type OmatSiirrot = {
  // Mihin minun on vastattava.
  saapuvat: Siirto[];
  // Mikä on jo minun tehtävänäni.
  hyvaksytyt: Siirto[];
  // Mitä odotan toiselta. Antajan listalla tehtävä säilyy kunnes saaja hyväksyy, joten
  // antajan on nähtävä missä pyyntö menee.
  lahtevat: Siirto[];
};

export type Vastaanottaja = { username: string; nimi: string; kohde: string };

export const TYHJAT_SIIRROT: OmatSiirrot = { saapuvat: [], hyvaksytyt: [], lahtevat: [] };

export async function haeOmatSiirrot(): Promise<OmatSiirrot> {
  try {
    const vastaus = await fetch('/api/siirrot/omat', { credentials: 'include' });
    if (!vastaus.ok) return TYHJAT_SIIRROT;
    const data = await vastaus.json();
    if (!data?.ok) return TYHJAT_SIIRROT;
    return {
      saapuvat: data.saapuvat || [],
      hyvaksytyt: data.hyvaksytyt || [],
      lahtevat: data.lahtevat || [],
    };
  } catch {
    return TYHJAT_SIIRROT;
  }
}

/**
 * Ketkä ovat nyt vuorossa. Palvelin vaatii että kysyjä on itse vuorossa — siirtää voi
 * vain omasta vuorostaan, eikä vuorottomalle kuulu tieto siitä kuka on missäkin kentällä.
 */
export async function haeVastaanottajat(): Promise<Vastaanottaja[]> {
  try {
    const vastaus = await fetch('/api/siirrot/vastaanottajat', { credentials: 'include' });
    if (!vastaus.ok) return [];
    const data = await vastaus.json();
    return data?.ok ? (data.vastaanottajat || []) : [];
  } catch {
    return [];
  }
}

const posti = async (polku: string, runko: unknown) => {
  try {
    const vastaus = await fetch(polku, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runko),
    });
    const data = await vastaus.json().catch(() => null);
    if (!vastaus.ok || !data?.ok) {
      return { ok: false as const, virhe: data?.error || 'Toiminto ei onnistunut.' };
    }
    return { ok: true as const, siirto: data.siirto as Siirto };
  } catch {
    return { ok: false as const, virhe: 'Palvelimeen ei saatu yhteyttä.' };
  }
};

export const siirraTehtava = (
  saaja: string,
  laji: 'tehtava' | 'kierros',
  kohdeId: string,
  viesti = '',
) => posti('/api/siirto', { saaja, laji, kohdeId, viesti });

export const vastaaSiirtoon = (id: string, hyvaksy: boolean) =>
  posti(`/api/siirto/${encodeURIComponent(id)}/vastaa`, { hyvaksy });

export const peruSiirto = (id: string) =>
  posti(`/api/siirto/${encodeURIComponent(id)}/peru`, {});
