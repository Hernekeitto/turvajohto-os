// Pohjien ja niiden suoritusten selainpuoli (perusta P6, erä 8).
//
// Yksi moduuli kaikille lajeille samasta syystä kuin palvelimella yksi kokoelma: laji on
// kenttä eikä oma maailmansa. Jos jokainen laji hoitaisi omat kutsunsa, sama virheiden
// käsittely ja sama tallennuslogiikka olisi kolmessa paikassa.
//
// Pohjia EI kirjoiteta kokoelmareitin kautta (/api/data/templates PUT) vaan
// /api/pohjat-reiteillä: kierrospohjan tarkistuspisteillä on token jota selain ei näe, ja
// koko kokoelman tallentaminen selaimesta tyhjentäisi ne. Suoritukset ovat kokonaan
// palvelimen ylläpitämiä.

export type PohjaLaji = 'patrol' | 'guide' | 'play' | 'runsheet';

export type Kohta = {
  id: string;
  teksti: string;
  kuvaus?: string;
  jarjestys: number;
  // Vain skenaariossa ja run sheetissä.
  vastuu?: string;
  // Vain run sheetissä. Muoto "14.00".
  aika?: string;
  // Vain skenaariossa: kriittistä kohtaa ei voi ohittaa suoritusta suljettaessa.
  kriittinen?: boolean;
};

export type Pohja = {
  id: string;
  kind: PohjaLaji;
  ownerId: string;
  omistaja?: 'kohde' | 'tapahtuma';
  nimi: string;
  kuvaus?: string;
  versio: number;
  kohdat?: Kohta[];
  luotu?: string;
  luoja?: string;
  muokattu?: string;
  arkistoitu?: string | null;
};

export type SuoritusKohta = {
  kohtaId: string;
  teksti: string;
  kuvaus: string;
  vastuu: string;
  aika: string;
  kriittinen: boolean;
  kuitattu: string | null;
  kuittaaja: string | null;
  huomio: string;
};

export type Suoritus = {
  id: string;
  kind: PohjaLaji;
  ownerId: string;
  omistaja?: 'kohde' | 'tapahtuma';
  templateId: string;
  templateNimi: string;
  templateVersio: number;
  tekija: string;
  kuvaus: string;
  alkoi: string;
  paattyi: string | null;
  tila: 'kesken' | 'valmis' | 'keskeytetty';
  keskeytysSyy: string;
  huomiot: string;
  kohdat: SuoritusKohta[];
};

// Lajien käyttöliittymätekstit. Palvelin tuntee samat lajit (server/pohjat.js: LAJIT);
// tässä on vain se mitä käyttäjälle sanotaan.
export const LAJIT: Record<Exclude<PohjaLaji, 'patrol'>, {
  nimi: string;
  monikko: string;
  selite: string;
  kohdanNimi: string;
  // Instansoituuko: skenaario ja run sheet käynnistetään, ohjekorttia luetaan.
  suoritetaan: boolean;
  aloitusNappi: string;
}> = {
  guide: {
    nimi: 'Toimintakortti',
    monikko: 'Ohjepankki',
    selite: 'Luettavat toimintaohjeet. Kortti on olemassa sitä hetkeä varten kun joku ei muista mitä tehdä.',
    kohdanNimi: 'Ohjeen kohta',
    suoritetaan: false,
    aloitusNappi: '',
  },
  play: {
    nimi: 'Skenaario',
    monikko: 'Skenaariot',
    selite: 'Mitä tehdään kun tilanne sattuu. Käynnissä olevasta skenaariosta näkee mikä on tehty ja mikä ei.',
    kohdanNimi: 'Toimenpide',
    suoritetaan: true,
    aloitusNappi: 'Käynnistä skenaario',
  },
  runsheet: {
    nimi: 'Run sheet',
    monikko: 'Run sheetit',
    selite: 'Tapahtuman aikataulutettu ajolista. Päivän ajossa kuitataan mitä on tehty ja milloin.',
    kohdanNimi: 'Ajolistan kohta',
    suoritetaan: true,
    aloitusNappi: 'Aloita ajo',
  },
};

export const TILA_LABEL: Record<Suoritus['tila'], string> = {
  kesken: 'Kesken',
  valmis: 'Valmis',
  keskeytetty: 'Keskeytetty',
};

export const kellonaika = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
};

export const kuittaamatta = (s: Suoritus) => (s.kohdat || []).filter((k) => !k.kuitattu).length;
export const kriittisetKuittaamatta = (s: Suoritus) =>
  (s.kohdat || []).filter((k) => k.kriittinen && !k.kuitattu).length;

export type Vastaus = {
  ok: boolean;
  error?: string;
  pohja?: Pohja;
  suoritus?: Suoritus;
  duplikaatti?: boolean;
};

// Yksi kutsupaikka kaikille pohjareiteille. Verkkovirhe palautetaan samassa muodossa kuin
// palvelimen virhe, jotta kutsuja voi näyttää sen sellaisenaan.
async function kutsu(polku: string, metodi: 'POST' | 'PUT' | 'DELETE', runko?: unknown): Promise<Vastaus> {
  try {
    const vastaus = await fetch(polku, {
      method: metodi,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: metodi === 'DELETE' ? undefined : JSON.stringify(runko ?? {}),
    });
    const data = await vastaus.json().catch(() => null);
    if (!vastaus.ok) {
      return { ok: false, error: data?.error || `Palvelin vastasi virheellä ${vastaus.status}.` };
    }
    return data || { ok: false, error: 'Palvelimen vastausta ei voitu lukea.' };
  } catch {
    return { ok: false, error: 'Ei yhteyttä palvelimeen. Muutosta ei tallennettu.' };
  }
}

export const luoPohja = (runko: {
  kind: PohjaLaji; ownerId: string; nimi: string; kuvaus?: string; kohdat: Partial<Kohta>[];
}) => kutsu('/api/pohjat', 'POST', runko);

export const paivitaPohja = (id: string, runko: { nimi?: string; kuvaus?: string; kohdat?: Partial<Kohta>[] }) =>
  kutsu(`/api/pohjat/${encodeURIComponent(id)}`, 'PUT', runko);

export const arkistoiPohja = (id: string) => kutsu(`/api/pohjat/${encodeURIComponent(id)}`, 'DELETE');

export const aloitaSuoritus = (templateId: string, kuvaus?: string) =>
  kutsu('/api/suoritus', 'POST', { templateId, kuvaus });

export const kuittaaKohta = (id: string, kohtaId: string, huomio?: string) =>
  kutsu(`/api/suoritus/${encodeURIComponent(id)}/kohta`, 'POST', { kohtaId, huomio });

export const paataSuoritus = (id: string, runko: { tila: 'valmis' | 'keskeytetty'; syy?: string; huomiot?: string }) =>
  kutsu(`/api/suoritus/${encodeURIComponent(id)}/paata`, 'POST', runko);

async function hae<T>(polku: string): Promise<T[] | null> {
  try {
    const vastaus = await fetch(polku, { credentials: 'include' });
    if (!vastaus.ok) return null;
    const data = await vastaus.json();
    return data?.ok === true && Array.isArray(data.data) ? (data.data as T[]) : null;
  } catch {
    return null;
  }
}

export const haePohjat = () => hae<Pohja>('/api/data/templates');
export const haeSuoritukset = () => hae<Suoritus>('/api/data/templateRuns');
