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
  // Vain skenaariossa: valintakohta ("Onko tulipalo?") ja sen vaihtoehdot. Kohdan `haara`
  // on sen vaihtoehdon id jonka alle kohta kuuluu; ilman haaraa kohta on pääpolulla.
  // Ks. server/suoritus.js: aktiivisetKohdat.
  tyyppi?: 'valinta';
  vaihtoehdot?: Vaihtoehto[];
  haara?: string;
};

export type Vaihtoehto = { id: string; teksti: string };

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
  // Vain skenaariossa: näkyykö käynnistetty tilanne HÄLKE:ssä. Puuttuva = kyllä.
  halke?: boolean;
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
  tyyppi?: 'valinta';
  vaihtoehdot?: Vaihtoehto[];
  haara?: string;
  // Valintakohdan valittu vaihtoehto.
  valittu?: string | null;
};

// Tilannelokin merkintä. `jarjestelma` = palvelimen kirjaama polun valinta.
export type Kommentti = {
  id: string;
  aika: string;
  tekija: string | null;
  teksti: string;
  jarjestelma?: boolean;
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
  kommentit?: Kommentti[];
  halke?: boolean;
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

// Haarautuvan skenaarion aktiiviset kohdat: pääpolku ja valittujen vaihtoehtojen kohdat.
// Sama sääntö kuin palvelimella (server/suoritus.js: aktiivisetKohdat); valitsematta jääneen
// polun kohtia ei näytetä, lasketa eikä vaadita.
type Haarautuva = { haara?: string; tyyppi?: 'valinta'; vaihtoehdot?: Vaihtoehto[]; valittu?: string | null };

export function aktiivisetKohdat<K extends Haarautuva>(kohdat: K[] | undefined): K[] {
  const lista = kohdat || [];
  const valintaVaihtoehdolle = new Map<string, K>();
  for (const k of lista) {
    if (k.tyyppi !== 'valinta') continue;
    for (const v of k.vaihtoehdot || []) valintaVaihtoehdolle.set(v.id, k);
  }
  const aktiivinen = (kohta: K, syvyys: number): boolean => {
    if (!kohta.haara) return true;
    const valinta = valintaVaihtoehdolle.get(kohta.haara);
    if (!valinta || syvyys > 50) return false;
    return valinta.valittu === kohta.haara && aktiivinen(valinta, syvyys + 1);
  };
  return lista.filter((k) => aktiivinen(k, 0));
}

export const aktiivisia = (s: Suoritus) => aktiivisetKohdat(s.kohdat).length;
export const kuittaamatta = (s: Suoritus) => aktiivisetKohdat(s.kohdat).filter((k) => !k.kuitattu).length;
export const kriittisetKuittaamatta = (s: Suoritus) =>
  aktiivisetKohdat(s.kohdat).filter((k) => k.kriittinen && !k.kuitattu).length;

// Näkyykö suoritus HÄLKE:ssä. Ennen asetusta käynnistetyt näkyvät.
export const naytetaanHalkessa = (s: Suoritus) => s.halke !== false;

// Tilannekuvan valitut polut: "Onko tulipalo?" → "On tulipalo".
export const valitutPolut = (s: Suoritus) => aktiivisetKohdat(s.kohdat)
  .filter((k) => k.tyyppi === 'valinta' && k.valittu)
  .map((k) => ({
    kysymys: k.teksti,
    vastaus: (k.vaihtoehdot || []).find((v) => v.id === k.valittu)?.teksti || '',
  }));

// Tilanneloki aikajärjestyksessä: aloitus, kuittaukset, kommentit ja päättyminen. Polun
// valinnat tulevat kommentteina, koska palvelin kirjaa jokaisen valinnan ja vaihdon sinne.
export type LokiRivi = {
  id: string;
  aika: string;
  tekija: string | null;
  teksti: string;
  laji: 'tila' | 'kuittaus' | 'kommentti' | 'valinta';
};

export function tilanneloki(s: Suoritus): LokiRivi[] {
  const rivit: LokiRivi[] = [{
    id: `${s.id}:alku`, aika: s.alkoi, tekija: s.tekija, laji: 'tila',
    teksti: s.kuvaus ? `Skenaario käynnistetty: ${s.kuvaus}` : 'Skenaario käynnistetty',
  }];
  for (const k of s.kohdat || []) {
    if (!k.kuitattu || k.tyyppi === 'valinta') continue;
    rivit.push({
      id: `${s.id}:${k.kohtaId}`, aika: k.kuitattu, tekija: k.kuittaaja, laji: 'kuittaus',
      teksti: k.huomio ? `${k.teksti} – ${k.huomio}` : k.teksti,
    });
  }
  for (const c of s.kommentit || []) {
    rivit.push({ id: c.id, aika: c.aika, tekija: c.tekija, teksti: c.teksti, laji: c.jarjestelma ? 'valinta' : 'kommentti' });
  }
  if (s.paattyi) {
    rivit.push({
      id: `${s.id}:loppu`, aika: s.paattyi, tekija: null, laji: 'tila',
      teksti: s.tila === 'keskeytetty' ? `Keskeytetty: ${s.keskeytysSyy}` : 'Merkitty hoidetuksi',
    });
  }
  return rivit.sort((a, b) => String(a.aika).localeCompare(String(b.aika)));
}

export type Vastaus = {
  ok: boolean;
  error?: string;
  pohja?: Pohja;
  suoritus?: Suoritus;
  duplikaatti?: boolean;
  // Käynnistys liitti käyttäjän samasta pohjasta jo käynnissä olevaan suoritukseen.
  liittyi?: boolean;
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
  kind: PohjaLaji; ownerId: string; nimi: string; kuvaus?: string; kohdat: Partial<Kohta>[]; halke?: boolean;
}) => kutsu('/api/pohjat', 'POST', runko);

export const paivitaPohja = (id: string, runko: {
  nimi?: string; kuvaus?: string; kohdat?: Partial<Kohta>[]; halke?: boolean;
}) =>
  kutsu(`/api/pohjat/${encodeURIComponent(id)}`, 'PUT', runko);

export const arkistoiPohja = (id: string) => kutsu(`/api/pohjat/${encodeURIComponent(id)}`, 'DELETE');

export const aloitaSuoritus = (templateId: string, kuvaus?: string) =>
  kutsu('/api/suoritus', 'POST', { templateId, kuvaus });

export const kuittaaKohta = (id: string, kohtaId: string, huomio?: string) =>
  kutsu(`/api/suoritus/${encodeURIComponent(id)}/kohta`, 'POST', { kohtaId, huomio });

export const valitsePolku = (id: string, kohtaId: string, vaihtoehtoId: string) =>
  kutsu(`/api/suoritus/${encodeURIComponent(id)}/valinta`, 'POST', { kohtaId, vaihtoehtoId });

export const lisaaKommentti = (id: string, teksti: string) =>
  kutsu(`/api/suoritus/${encodeURIComponent(id)}/kommentti`, 'POST', { teksti });

export const paataSuoritus =(id: string, runko: { tila: 'valmis' | 'keskeytetty'; syy?: string; huomiot?: string }) =>
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
