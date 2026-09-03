// Lähtevä jono (erä 6, perusta P7).
//
// Kentällä tehty kirjaus ei saa kadota siihen, että verkko oli poikki. Jono ottaa
// kirjauksen vastaan heti, tallentaa sen laitteelle ja lähettää sen kun yhteys palaa.
//
// --- Neljä suunnitteluperiaatetta -------------------------------------------------
//
// 1. JONO EI KOSKAAN HÄVIÄ KIRJAUSTA ITSE. Pysyvä virhe (esim. oikeuksien puute) ei
//    poista kirjausta vaan merkitsee sen epäonnistuneeksi ja jättää sen näkyviin.
//    Vartija on kirjoittanut sen kerran; järjestelmän ei kuulu päättää että se katoaa.
//    Poistaminen on käyttäjän oma toimi.
//
// 2. TIETUEEN ID SYNTYY SELAIMESSA, ennen kuin verkkoa on. Se on idempotenssin avain:
//    jos vastaus hukkuu ja jono yrittää uudelleen, palvelin tunnistaa saman id:n
//    (server/index.js: /api/kirjaa/:name).
//
// 3. TALLENNUS ON localStorage, ei IndexedDB. Jono on pieni (kymmeniä kirjauksia, ei
//    tuhansia) ja sen on selvittävä sivunlatauksesta ja selaimen sulkemisesta.
//    IndexedDB antaisi lisää tilaa ja asynkronisuutta, mutta myös oman
//    virhetilanteidensa joukon — ja tässä koko jonon on mahduttava muistiin joka
//    tapauksessa, koska se näytetään listana.
//
// 4. JONO ON KÄYTTÄJÄKOHTAINEN. Avain sisältää käyttäjätunnuksen: jaetulla laitteella
//    vuoron vaihtuessa seuraava vartija ei saa nähdä eikä lähettää edellisen kirjauksia
//    omissa nimissään.

export type JonoKirjaus = {
  // Jonon oma id. Eri kuin tietueen id, koska sama tietue voi kulkea eri reiteillä
  // (esim. kierroksen kuittaus ei ole tietue vaan toimenpide).
  id: string;
  polku: string;
  runko: unknown;
  // Mitä tämä on ihmisen kielellä. Näytetään jonolistassa, joten sen on kerrottava
  // käyttäjälle mikä hänen kirjauksistaan on vielä lähettämättä.
  kuvaus: string;
  luotu: string;
  // Toimenpiteen tunniste, jos toimenpide voi olla vain kerran jonossa. Esimerkiksi
  // saman tarkistuspisteen kuittaus: ilman tätä hermostunut painallus verkottomassa
  // tilassa lisäisi jonoon viisi samaa kuittausta, joista neljä palaisi virheellä
  // "piste on jo kuitattu".
  tunniste?: string;
  yritykset: number;
  viimeinenVirhe: string | null;
  // Pysyvä virhe: palvelin torjui pyynnön eikä uudelleenyritys auta. Kirjaus jää
  // listaan käyttäjän nähtäväksi eikä sitä yritetä enää automaattisesti.
  jumissa: boolean;
};

const AVAIN_ETULIITE = 'turvajohto-jono:';

// Uudelleenyritysten väli. Ei eksponentiaalista kasvua: kentällä verkko palaa yleensä
// kokonaan eikä vähitellen, ja pitkä odotus tarkoittaisi että kirjaukset viipyvät
// laitteella turhaan sen jälkeen kun yhteys jo toimii.
export const YRITYSVALI_MS = 20000;

let avain = AVAIN_ETULIITE + 'tuntematon';
let jono: JonoKirjaus[] = [];
const kuuntelijat = new Set<(jono: JonoKirjaus[]) => void>();
let ajastin: ReturnType<typeof setInterval> | null = null;
let lahettaaParhaillaan = false;

const lue = (): JonoKirjaus[] => {
  try {
    const raaka = window.localStorage.getItem(avain);
    const tulos = raaka ? JSON.parse(raaka) : [];
    return Array.isArray(tulos) ? tulos : [];
  } catch {
    // Vioittunut tai estetty localStorage: jono toimii istunnon ajan muistissa.
    return [];
  }
};

const kirjoita = () => {
  try {
    window.localStorage.setItem(avain, JSON.stringify(jono));
  } catch {
    // Tila lopussa tai yksityinen selaustila. Ei kaadeta sovellusta: jono jää muistiin
    // ja lähtee kun verkko palaa, kunhan sivua ei ladata uudelleen.
  }
  for (const kuuntelija of kuuntelijat) kuuntelija(jono);
};

// Otetaan jono käyttöön tietylle käyttäjälle. Kutsutaan kun istunto on tiedossa.
//
// EI käynnistä ajastinta eikä asenna kuuntelijoita: ne ovat oma kutsunsa
// (kaynnistaAutomatiikka). Ilman tätä eroa moduulin pelkkä käyttöönotto jättäisi
// prosessiin elävän ajastimen, mikä jumitti testiajon ensimmäisellä yrityksellä.
export function avaaJono(kayttaja: string) {
  avain = AVAIN_ETULIITE + (kayttaja || 'tuntematon');
  jono = lue();
  for (const kuuntelija of kuuntelijat) kuuntelija(jono);
}

export function kuunteleJonoa(kuuntelija: (jono: JonoKirjaus[]) => void) {
  kuuntelijat.add(kuuntelija);
  kuuntelija(jono);
  return () => { kuuntelijat.delete(kuuntelija); };
}

export const jononPituus = () => jono.length;

export type LisaysTulos = {
  // Lähtikö kirjaus heti perille.
  lahetetty: boolean;
  // Palvelimen vastaus jos lähetys onnistui. Kutsuja voi käyttää sitä samoin kuin
  // suoraa fetchiä — verkon toimiessa jono ei siis muuta käyttökokemusta lainkaan.
  vastaus?: any;
  // Oliko sama toimenpide jo jonossa.
  joJonossa?: boolean;
};

// Lisää kirjauksen jonoon ja yrittää lähettää sen heti.
export async function lisaaJonoon(kirjaus: {
  polku: string; runko: unknown; kuvaus: string; tunniste?: string;
}): Promise<LisaysTulos> {
  if (kirjaus.tunniste && jono.some((k) => k.tunniste === kirjaus.tunniste)) {
    return { lahetetty: false, joJonossa: true };
  }
  jono = [...jono, {
    id: `j-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    polku: kirjaus.polku,
    runko: kirjaus.runko,
    kuvaus: kirjaus.kuvaus,
    tunniste: kirjaus.tunniste,
    luotu: new Date().toISOString(),
    yritykset: 0,
    viimeinenVirhe: null,
    jumissa: false,
  }];
  kirjoita();
  const tulos = await tyhjennaJono();
  return { lahetetty: tulos.lahetetty > 0, vastaus: tulos.viimeinenVastaus };
}

// Onko toimenpide jonossa odottamassa. Näkymät merkitsevät sen perusteella kohdan
// "odottaa lähetystä" — tieto säilyy sivunlatauksen yli, koska se on jonossa eikä
// komponentin tilassa.
export const onJonossa = (tunniste: string) => jono.some((k) => k.tunniste === tunniste);

export function poistaJonosta(id: string) {
  jono = jono.filter((k) => k.id !== id);
  kirjoita();
}

// Merkitsee jumiin jääneen kirjauksen yritettäväksi uudelleen. Käyttäjä tekee tämän
// silloin kun hän tietää tilanteen korjautuneen (esim. oikeudet lisätty).
export function yritaUudelleen(id: string) {
  jono = jono.map((k) => (k.id === id ? { ...k, jumissa: false, viimeinenVirhe: null } : k));
  kirjoita();
  return tyhjennaJono();
}

// Lähettää jonon alusta loppuun. Järjestys säilyy: kirjaukset ovat aikajärjestyksessä,
// ja esimerkiksi kierroksen kuittaus ennen sen päättämistä on lähetettävä siinä
// järjestyksessä.
export async function tyhjennaJono() {
  if (lahettaaParhaillaan) return { lahetetty: 0, epaonnistui: 0, viimeinenVastaus: undefined };
  lahettaaParhaillaan = true;
  let lahetetty = 0;
  let epaonnistui = 0;
  let viimeinenVastaus: any;
  try {
    for (const kirjaus of [...jono]) {
      if (kirjaus.jumissa) continue;
      const tulos = await laheta(kirjaus);
      if (tulos.tila === 'ok') {
        viimeinenVastaus = tulos.vastaus;
        jono = jono.filter((k) => k.id !== kirjaus.id);
        lahetetty += 1;
        kirjoita();
      } else if (tulos.tila === 'jumissa') {
        epaonnistui += 1;
        // Pysyvä virhe: ei yritetä seuraaviakaan heti perään, koska sama syy (esim.
        // istunto vanhentunut) koskee todennäköisesti niitä kaikkia.
        break;
      } else {
        epaonnistui += 1;
        // Verkkovirhe: lopetetaan tältä erää. Seuraava yritys tulee ajastimelta tai
        // online-tapahtumasta.
        break;
      }
    }
  } finally {
    lahettaaParhaillaan = false;
  }
  return { lahetetty, epaonnistui, viimeinenVastaus };
}

type LahetysTulos = { tila: 'ok' | 'verkko' | 'jumissa'; vastaus?: any };

async function laheta(kirjaus: JonoKirjaus): Promise<LahetysTulos> {
  const merkitse = (muutos: Partial<JonoKirjaus>) => {
    jono = jono.map((k) => (k.id === kirjaus.id
      ? { ...k, yritykset: k.yritykset + 1, ...muutos }
      : k));
    kirjoita();
  };
  try {
    const res = await fetch(kirjaus.polku, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      // toisto kertoo palvelimelle, että kyse voi olla jo perille menneen pyynnön
      // uusinnasta. Lippu lisätään VASTA ensimmäisen yrityksen jälkeen: ensimmäisellä
      // kerralla "on jo kuitattu" on oikea virhe eikä toisto.
      body: JSON.stringify(
        kirjaus.yritykset > 0 && kirjaus.runko && typeof kirjaus.runko === 'object'
          ? { ...(kirjaus.runko as object), toisto: true }
          : kirjaus.runko
      ),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) return { tila: 'ok', vastaus: data };
    // 5xx on palvelimen ohimenevä ongelma: yritetään myöhemmin uudelleen.
    if (res.status >= 500) {
      merkitse({ viimeinenVirhe: `Palvelinvirhe ${res.status}` });
      return { tila: 'verkko' };
    }
    // 4xx on pysyvä: uudelleenyritys tuottaisi saman vastauksen.
    merkitse({ jumissa: true, viimeinenVirhe: data?.error || `Virhe ${res.status}` });
    return { tila: 'jumissa' };
  } catch {
    merkitse({ viimeinenVirhe: 'Ei yhteyttä' });
    return { tila: 'verkko' };
  }
}

// Automaattinen tyhjennys: ajastin, verkon palautuminen ja sovelluksen palaaminen
// näkyviin. Kutsutaan kerran sovelluksen käynnistyessä.
export function kaynnistaAutomatiikka() {
  if (ajastin !== null) return;
  // Yritetään heti. Ilman tätä sivunlatauksen jälkeen odotettaisiin ensimmäistä
  // ajastinlaukausta, vaikka verkko toimisi — ja lyhyeksi jäävä käynti sovelluksessa
  // ei tyhjentäisi jonoa lainkaan. Tämä puute näkyi selaintestissä.
  if (jono.length > 0) tyhjennaJono();
  ajastin = setInterval(() => { if (jono.length > 0) tyhjennaJono(); }, YRITYSVALI_MS);
  window.addEventListener('online', () => { tyhjennaJono(); });
  // Sovelluksen palatessa näkyviin: puhelin on voinut olla taskussa tuntikausia, eikä
  // online-tapahtuma välttämättä laukea jos verkko palasi näytön ollessa sammuksissa.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && jono.length > 0) tyhjennaJono();
  });
}

// Testejä varten: nollaa moduulin tila.
export function nollaaJono() {
  jono = [];
  kuuntelijat.clear();
  if (ajastin !== null) { clearInterval(ajastin); ajastin = null; }
  lahettaaParhaillaan = false;
}
