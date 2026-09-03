// Hälytysten selainpuoli: tyypit, kutsut ja esitysmuodot.
//
// Säännöt ovat palvelimella (server/halytys.js). Tämä tiedosto ei päätä mistään — se
// kysyy ja näyttää. Erityisesti ajastimen määräaikaa EI lasketa täällä: näytöllä juokseva
// laskuri on vain ihmiselle, ja hälytyksen laukaisee palvelin silloinkin kun tämä koodi
// ei ole ajossa (puhelin sammui, selain suljettiin).
//
// HÄLYTYKSIÄ EI LAITETA LÄHTEVÄÄN JONOON. Tämä on tietoinen poikkeus erän 6 sääntöön
// jossa kentällä tehty kirjaus ei saa kadota verkon puutteeseen. Kirjaus voi odottaa
// yhteyttä; hätä ei voi. Jonoon laitettu hätäpainikkeen painallus näyttäisi onnistuneen
// ja lähtisi ehkä puolen tunnin päästä — pahempi kuin selvä virheilmoitus, koska se veisi
// ihmiseltä sen tiedon että hänen on soitettava 112 itse.

// Sama lista kuin server/halytys.js: TYYPIT. 'varuste' on erän 8 kriittinen
// varustepoikkeama, joka eskaloituu tätä samaa ketjua pitkin.
export type HalytysTyyppi = 'ajastin' | 'mandown' | 'panic' | 'geofence' | 'varuste';
export type HalytysTila = 'kaynnissa' | 'lauennut' | 'kuitattu' | 'peruttu';

export type HalytysGps = { lat: number; lon: number; tarkkuus: number | null };

export type Halytys = {
  id: string;
  tyyppi: HalytysTyyppi;
  tila: HalytysTila;
  vartija: string;
  eventId: string | null;
  alkoi: string;
  eraantyy: number | null;
  kestoMin: number | null;
  kuvaus: string;
  laukesi: string | null;
  paattyi: string | null;
  gps: HalytysGps | null;
  vyohyke: { id: string; nimi: string; saanto: string | null } | null;
  kuittaaja: string | null;
  kuittausHuomio: string;
  eskalointi: {
    tila: 'lahetetty' | 'kuivaharjoittelu' | 'epaonnistui';
    ts: string;
    sendId: string | null;
    vastaanottajia: number;
    virhe: string | null;
  } | null;
  historia: { ts: string; tapahtuma: string; user: string | null; teksti: string }[];
};

export const TYYPPI_LABEL: Record<HalytysTyyppi, string> = {
  ajastin: 'Ajastinhälytys',
  mandown: 'Man-down',
  panic: 'Hätäpainike',
  geofence: 'Vyöhykepoikkeama',
  varuste: 'Varustepuute',
};

export const TILA_LABEL: Record<HalytysTila, string> = {
  kaynnissa: 'Käynnissä',
  lauennut: 'LAUENNUT',
  kuitattu: 'Kuitattu',
  peruttu: 'Lopetettu',
};

// Ajastimen kestovaihtoehdot. Napit eikä vapaa kenttä: yksin työskentelevä asettaa
// ajastimen kylmässä hanskat kädessä, eikä silloin kirjoiteta numeroita.
export const AJASTIN_VALINNAT = [5, 10, 15, 30, 60, 120];

export const onAvoin = (h: Halytys) => h.tila === 'kaynnissa' || h.tila === 'lauennut';

// Jäljellä oleva aika millisekunteina. Negatiivinen tarkoittaa että määräaika on mennyt
// mutta palvelimen kierros ei ole vielä ehtinyt laukaista hälytystä — käyttöliittymä
// näyttää sen omana tilanaan eikä väitä hälytyksen jo lauenneen.
export const jaljella = (h: Halytys, nyt = Date.now()) =>
  h.tila === 'kaynnissa' && h.eraantyy ? h.eraantyy - nyt : null;

export const ajastinTeksti = (ms: number) => {
  const kokonaiset = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(kokonaiset / 60);
  const sek = kokonaiset % 60;
  return `${min}:${String(sek).padStart(2, '0')}`;
};

export const kellonaika = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
};

type Vastaus = { ok: boolean; error?: string; halytys?: Halytys; [k: string]: unknown };

// Yksi kutsupaikka kaikille hälytysreiteille. Verkkovirhe palautetaan samassa muodossa
// kuin palvelimen virhe, jotta kutsuja voi näyttää sen sellaisenaan — hätätilanteessa
// käyttäjän on saatava tietää MITÄ ei onnistunut, ei pelkkää "virhe".
async function kutsu(polku: string, runko?: unknown): Promise<Vastaus> {
  try {
    const vastaus = await fetch(polku, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runko ?? {}),
    });
    const data = await vastaus.json().catch(() => null);
    if (!vastaus.ok) {
      return { ok: false, error: data?.error || `Palvelin vastasi virheellä ${vastaus.status}.`, ...(data || {}) };
    }
    return data || { ok: false, error: 'Palvelimen vastausta ei voitu lukea.' };
  } catch {
    return { ok: false, error: 'Ei yhteyttä palvelimeen. Hälytys EI mennyt perille.' };
  }
}

export const aloitaAjastin = (args: { minuutit: number; eventId: string | null; kuvaus?: string; gps?: HalytysGps | null }) =>
  kutsu('/api/halytys/ajastin', args);

export const jatkaAjastinta = (id: string, minuutit?: number) =>
  kutsu(`/api/halytys/${encodeURIComponent(id)}/jatka`, { minuutit });

export const peruAjastin = (id: string) => kutsu(`/api/halytys/${encodeURIComponent(id)}/peru`);

export const kuittaaHalytys = (id: string, huomio?: string) =>
  kutsu(`/api/halytys/${encodeURIComponent(id)}/kuittaa`, { huomio });

export const laukaiseHalytys = (args: { tyyppi: 'panic' | 'mandown'; eventId: string | null; kuvaus?: string; gps?: HalytysGps | null }) =>
  kutsu('/api/halytys', args);

export async function haeHalytykset(): Promise<Halytys[] | null> {
  try {
    const vastaus = await fetch('/api/data/alerts', { credentials: 'include' });
    if (!vastaus.ok) return null;
    const data = await vastaus.json();
    return data?.ok === true && Array.isArray(data.data) ? (data.data as Halytys[]) : null;
  } catch {
    return null;
  }
}

// Kertaluonteinen paikannus hälytystä varten. EI jatkuvaa seurantaa: tämä kysyy sijainnin
// sillä hetkellä kun hälytys tehdään, ja se on eri asia kuin sijaintiseuranta (erä 3) —
// tämän saa tehdä myös silloin kun seuranta on pois päältä, koska kyse on avunpyynnön
// liitteestä eikä työntekijän valvonnasta.
//
// Aikakatkaisu on lyhyt tarkoituksella: hälytys ei saa odottaa paikannusta. Ilman
// sijaintia lähtevä hälytys on paljon parempi kuin hälytys joka lähtee kymmenen sekuntia
// myöhemmin.
export function haeSijainti(aikakatkaisuMs = 4000): Promise<HalytysGps | null> {
  return new Promise((valmis) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      valmis(null);
      return;
    }
    let vastattu = false;
    const kerran = (arvo: HalytysGps | null) => {
      if (vastattu) return;
      vastattu = true;
      valmis(arvo);
    };
    const ajastin = setTimeout(() => kerran(null), aikakatkaisuMs);
    navigator.geolocation.getCurrentPosition(
      (sijainti) => {
        clearTimeout(ajastin);
        kerran({
          lat: sijainti.coords.latitude,
          lon: sijainti.coords.longitude,
          tarkkuus: sijainti.coords.accuracy ?? null,
        });
      },
      () => {
        clearTimeout(ajastin);
        kerran(null);
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: aikakatkaisuMs }
    );
  });
}
