// BulkSMS.com JSON REST API -asiakas. Tämä moduuli EI tunne Expressiä, oikeuksia eikä
// sovelluksen tietomalleja — se osaa vain muotoilla numeron, laskea viestin pituuden ja
// puhua rajapinnan kanssa. Vastaanottajien ratkaisu ja oikeustarkistukset ovat sms.js:ssä
// ja index.js:ssä, jotta tämän tiedoston voi testata ilman palvelinta (ks. bulksms.test.js).
//
// Rajapintavalinta: JSON REST API (ei EAPI, joka on vanhentunut, eikä SMPP, joka vaatisi
// jatkuvan TCP-istunnon ylläpidon 30 s elossapitoviesteineen — ylimitoitettu satunnaiselle
// hätäviestinnälle). REST on tilaton: yhteys avataan vain kun viesti lähetetään.
//
// TIETOSUOJA: viestin runkoon (body) ei koskaan saa päätyä henkilötunnusta tai muuta
// tarpeetonta arkaluontoista tietoa — tekstiviesti kulkee lopulta salaamattomissa
// televerkoissa, vaikka tämä API-yhteys onkin TLS-salattu. to-kenttään menee pelkkä
// puhelinnumero. Kutsuva koodi vastaa siitä mitä runkoon kirjoitetaan.

const BASE_URL = process.env.BULKSMS_BASE_URL || 'https://api.bulksms.com/v1';

// Hätäviestin on lähdettävä tai epäonnistuttava nopeasti: jumiin jäänyt HTTP-pyyntö on
// pahempi kuin selkeä virhe, koska käyttäjä ei tiedä pitäisikö soittaa sen sijaan.
const TIMEOUT_MS = Number(process.env.BULKSMS_TIMEOUT_MS || 20000);

// Yhdellä POST-pyynnöllä lähetettävien viestien yläraja. BulkSMS sallii 50 000, mutta
// suosittelee pienempää erää (~4000) jotta verkkovirheen jälkeinen uudelleenlähetys on
// käytännöllinen. Tämän sovelluksen mittakaavassa yksikin tapahtuma jää kauas rajasta.
const MAX_BATCH = 4000;

// GSM 03.38 -perusmerkistö. Merkit joita EI ole tässä (eikä laajennustaulukossa) pakottavat
// koko viestin Unicodeksi, jolloin yhden osan pituus putoaa 160 merkistä 70:een. Suomen ä/ö
// ovat perusmerkistössä, mutta esim. tavuviiva-ajatusviiva (–), lainausmerkit (”) ja
// emojit eivät — ne kolminkertaistavat viestin hinnan huomaamatta.
const GSM_PERUS =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';

// Laajennustaulukon merkit mahtuvat GSM-viestiin mutta vievät kaksi merkkipaikkaa
// (escape + merkki). Ilman tätä 160 merkin laskuri näyttäisi liian pitkän viestin sopivan.
const GSM_LAAJENNUS = '^{}\\[~]|€';

// Yhden viestiosan merkkimäärät. Kun viesti pilkotaan useaan osaan, jokaiseen osaan menee
// User Data Header, joka syö tilaa (160 -> 153, 70 -> 67). Jokainen osa myös laskutetaan
// erikseen JA vastaanottajan puhelin näyttää viestin vasta kun kaikki osat ovat saapuneet
// — hätäviestin pitäisi siksi mahtua yhteen osaan.
const RAJAT = {
  TEXT: { yksi: 160, monta: 153 },
  UNICODE: { yksi: 70, monta: 67 },
};

export function onkoKonfiguroitu() {
  return Boolean(process.env.BULKSMS_TOKEN_ID && process.env.BULKSMS_TOKEN_SECRET);
}

// Lähettäjätunnus. Aakkosnumeerinen tunnus (esim. "TURVAJOHTO") vaatii Suomessa
// Traficomin rekisteröinnin, joka astuu voimaan vasta KOLMEN KUUKAUDEN kuluttua
// hyväksynnästä — siihen asti operaattori voi suodattaa viestin tai korvata tunnuksen
// satunnaisella numerolla. Siksi tämä on ympäristömuuttuja eikä koodiin kirjoitettu:
// tuotantoon voi mennä ilman sitä ja kytkeä päälle kun rekisteröinti on valmis.
function lahettajatunnus() {
  const arvo = (process.env.BULKSMS_SENDER_ID || '').trim();
  // Aakkosnumeerisen tunnuksen maksimipituus on 11 merkkiä. Pidempi hylättäisiin
  // rajapinnassa koko lähetyksen osalta, joten se on parempi jättää huomiotta tässä
  // kuin kaataa hätäviesti asetusvirheeseen.
  if (!arvo || arvo.length > 11) return null;
  return arvo;
}

// Puhelinnumero E.164-muotoon (+358401234567). Tallennetut numerot ovat suomalaisessa
// muodossa ("040 123 4567", "+358 40 123 4567", "00358401234567"), ja rajapinta odottaa
// kansainvälistä muotoa. Muunnos tehdään TÄSSÄ eikä lähetyshetkellä improvisoiden, jotta
// kelvoton numero havaitaan ja raportoidaan käyttäjälle ennen lähetystä.
//
// Palauttaa null jos numeroa ei voi tulkita luotettavasti — arvausta ei tehdä, koska
// väärään numeroon lähtenyt hätäviesti on pahempi kuin puuttuva numero, joka näkyy
// vahvistusnäkymässä virheenä.
export function normalisoiNumero(raw, oletusMaakoodi = '358') {
  if (typeof raw !== 'string') return null;
  // Välilyönnit, tavuviivat, sulut ja pilkkumerkinnät pois; plus säilytetään vain alussa.
  let s = raw.trim().replace(/[\s\-().]/g, '');
  if (!s) return null;

  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  else if (s.startsWith('0')) s = `+${oletusMaakoodi}${s.slice(1)}`;
  else if (!s.startsWith('+')) {
    // Ilman etunollaa ja ilman plussaa: hyväksytään vain jos numero alkaa jo maakoodilla
    // (esim. "358401234567"). Muuten kyseessä on lyhytnumero tai kirjausvirhe.
    if (s.startsWith(oletusMaakoodi)) s = `+${s}`;
    else return null;
  }

  if (!/^\+[1-9][0-9]{6,14}$/.test(s)) return null;
  return s;
}

// Viestin merkistökoodaus, pituus ja osien määrä. Käytetään sekä käyttöliittymän
// laskurissa (montako viestiä tästä lähtee ja mitä se maksaa) että lähetyksessä.
export function laskeViesti(text) {
  const s = typeof text === 'string' ? text : '';
  let septetit = 0;
  let gsm = true;
  // Array.from, ei s.length: emoji ja muut BMP:n ulkopuoliset merkit ovat kahden
  // koodiyksikön surrogaattipareja, jotka .length laskisi kahdeksi merkiksi.
  const merkit = Array.from(s);
  for (const ch of merkit) {
    if (GSM_PERUS.includes(ch)) septetit += 1;
    else if (GSM_LAAJENNUS.includes(ch)) septetit += 2;
    else {
      gsm = false;
      break;
    }
  }

  if (!gsm) {
    // Unicode-viestin pituus lasketaan UTF-16-koodiyksikköinä (emoji = 2), koska SMS:n
    // UCS-2-kuormaan mahtuu 70 koodiyksikköä, ei 70 "näkyvää merkkiä".
    const yksikot = s.length;
    const raja = RAJAT.UNICODE;
    const osia = yksikot === 0 ? 1 : yksikot <= raja.yksi ? 1 : Math.ceil(yksikot / raja.monta);
    return { encoding: 'UNICODE', pituus: yksikot, osia, osanRaja: osia > 1 ? raja.monta : raja.yksi };
  }

  const raja = RAJAT.TEXT;
  const osia = septetit === 0 ? 1 : septetit <= raja.yksi ? 1 : Math.ceil(septetit / raja.monta);
  return { encoding: 'TEXT', pituus: septetit, osia, osanRaja: osia > 1 ? raja.monta : raja.yksi };
}

// Rakentaa POST /v1/messages -pyynnön rungon: taulukko, jossa yksi viestiobjekti per
// vastaanottaja. Yksi objekti monella vastaanottajalla olisi lyhyempi, mutta silloin
// vastauksesta ei saisi vastaanottajakohtaisia viesti-id:itä eikä tiloja — ja juuri niiden
// varaan toimitusvalvonta rakennetaan. Kaikki menevät silti YHDESSÄ HTTP-pyynnössä, joten
// verkkoviive ei kertaudu vastaanottajien määrällä.
export function rakennaKuorma(numerot, body, { repliable = false } = {}) {
  const teksti = String(body ?? '');
  const { encoding } = laskeViesti(teksti);
  const tunnus = lahettajatunnus();

  // from jätetään pois kokonaan jos kumpaakaan ei ole asetettu — silloin tilin oma
  // oletusasetus ratkaisee, mikä on turvallisin oletus ennen Traficom-rekisteröintiä.
  let from;
  if (repliable) {
    // Kaksisuuntainen viesti ("Vastaa OK jos olet turvassa") lähtee numeropoolista, jolloin
    // lähettäjänä EI näy aakkosnumeerinen tunnus — siksi rungon on itse alettava
    // tunnisteella. Aakkosnumeeriseen tunnukseen ei voi vastata lainkaan.
    from = { type: 'REPLIABLE' };
  } else if (tunnus) {
    from = tunnus;
  }

  return numerot.map((numero) => ({
    to: numero,
    body: teksti,
    encoding,
    ...(from ? { from } : {}),
  }));
}

// Yhteinen HTTP-kutsu. Autentikaatio-otsikko lähetetään aina proaktiivisesti (ei odoteta
// 401-haastetta) — se säästää yhden verkon kiertoviiveen, mikä on hätätilanteessa
// merkityksellistä.
async function kutsu(polku, { method = 'GET', body } = {}) {
  const tokenId = process.env.BULKSMS_TOKEN_ID;
  const tokenSecret = process.env.BULKSMS_TOKEN_SECRET;
  const auth = Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64');

  const res = await fetch(`${BASE_URL}${polku}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      // Rajapinta vaatii tämän nimenomaisen arvon sekä pyynnöiltä että vastauksilta.
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const teksti = await res.text();
  return { status: res.status, ok: res.ok, data: parsiJson(teksti), raaka: teksti };
}

// Viesti-id:t säilyttävä JSON-jäsennys.
//
// BulkSMS:n viesti-id:t ovat 19-numeroisia kokonaislukuja (esim. 1674813649253834752),
// jotka ylittävät JavaScriptin turvallisen kokonaislukualueen (2^53-1 = 9007199254740991)
// yli tuhatkertaisesti. Tavallinen JSON.parse muuttaa ne liukuluvuiksi ja PYÖRISTÄÄ:
//   1674811778896240640  ->  1674811778896240600
//
// Tämä on hiljainen ja siksi vaarallinen: toimitusraportit toimivat siitä huolimatta,
// koska sekä lähetysvastauksen että webhookin id käyvät saman pyöristyksen läpi ja
// osuvat siksi yhteen. Se on onnenkauppa, ei suunnittelu — heti kun jompikumpi puoli
// tulee eri reittiä (esim. rajapinta palauttaa id:n merkkijonona), vertailu lakkaa
// täsmäämästä eikä mikään kerro miksi.
//
// Korjaus: lainausmerkitään pitkät kokonaisluvut id-kentissä ENNEN jäsennystä, jolloin
// ne pysyvät merkkijonoina läpi koko käsittelyketjun. Regex osuu vain näihin kahteen
// kenttänimeen, joten muut numerot (creditCost, numberOfParts) käyttäytyvät ennallaan.
export function parsiJson(teksti) {
  if (typeof teksti !== 'string' || teksti === '') return null;
  const turvattu = teksti.replace(/"(id|relatedSentMessageId)"(\s*):(\s*)(\d{16,})/g, '"$1"$2:$3"$4"');
  try {
    return JSON.parse(turvattu);
  } catch {
    // Rajapinta lupaa JSONia, mutta välissä oleva proxy voi palauttaa HTML-virhesivun.
    // Ei kaadeta tähän: status kertoo jo mitä tapahtui.
    return null;
  }
}

// Rajapinnan virhevastaus on { type, title, status, detail }. detail on se kenttä joka
// kertoo ihmiselle mikä meni pieleen, joten se näytetään kun se on olemassa.
function virheteksti(vastaus) {
  const d = vastaus.data;
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    const osat = [d.title, d.detail].filter(Boolean);
    if (osat.length > 0) return osat.join(': ');
  }
  if (vastaus.status === 401 || vastaus.status === 403) {
    return `BulkSMS hylkäsi pyynnön (${vastaus.status}) — tarkista API-tunnukset ja saldo.`;
  }
  return `BulkSMS palautti virheen ${vastaus.status}.`;
}

// Lähettää viestin annettuihin numeroihin. Numeroiden on oltava jo E.164-muodossa
// (normalisoiNumero) — tämä ei siivoa niitä uudelleen, jotta lähetyshetkellä ei tehdä
// hiljaisia muunnoksia joita vahvistusnäkymässä ei näytetty.
//
// Ilman API-tunnuksia palautetaan kuivaharjoittelu (dryRun): kaikki muu tapahtuu
// normaalisti (oikeustarkistus, vastaanottajien ratkaisu, audit-loki), mutta yhtään
// viestiä ei lähetetä eikä saldoa kuluteta. Näin toiminnon voi rakentaa ja testata
// loppuun ennen kuin tunnukset ovat olemassa, ja ne kytketään päälle pelkällä
// ympäristömuuttujalla ilman koodimuutosta.
export async function lahetaViestit({ numerot, body, repliable = false, dedupId } = {}) {
  const lista = Array.isArray(numerot) ? numerot : [];
  const mitat = laskeViesti(body);

  if (lista.length === 0) {
    return { ok: false, dryRun: !onkoKonfiguroitu(), virhe: 'Ei yhtään kelvollista vastaanottajaa.', mitat, tulokset: [] };
  }
  if (lista.length > MAX_BATCH) {
    return {
      ok: false,
      dryRun: !onkoKonfiguroitu(),
      virhe: `Liian monta vastaanottajaa yhdessä lähetyksessä (${lista.length}, enintään ${MAX_BATCH}).`,
      mitat,
      tulokset: [],
    };
  }

  if (!onkoKonfiguroitu()) {
    return {
      ok: true,
      dryRun: true,
      mitat,
      tulokset: lista.map((numero) => ({ numero, status: 'DRY_RUN', id: null, osia: mitat.osia })),
    };
  }

  const params = new URLSearchParams();
  // auto-unicode=true: jos runkoon on eksynyt GSM 03.38:n ulkopuolinen merkki (esim.
  // ajatusviiva tai emoji), viesti lähtee Unicodena eikä merkkejä korvata kysymysmerkeillä.
  // Väärin näkyvä hätäohje on pahempi kuin kalliimpi viesti.
  params.set('auto-unicode', 'true');
  // deduplication-id suojaa siltä, että verkkokatkon jälkeen uusittu lähetys menisi
  // vastaanottajille kahteen kertaan. Tunniste vanhenee noin 12 tunnissa.
  if (dedupId !== undefined && dedupId !== null) params.set('deduplication-id', String(dedupId));

  let vastaus;
  try {
    vastaus = await kutsu(`/messages?${params.toString()}`, {
      method: 'POST',
      body: rakennaKuorma(lista, body, { repliable }),
    });
  } catch (err) {
    const syy = err?.name === 'TimeoutError' ? `aikakatkaisu (${TIMEOUT_MS} ms)` : err?.message || 'tuntematon virhe';
    return { ok: false, dryRun: false, mitat, tulokset: [], virhe: `Yhteys BulkSMS-rajapintaan epäonnistui: ${syy}.` };
  }

  if (!vastaus.ok) {
    return { ok: false, dryRun: false, mitat, tulokset: [], virhe: virheteksti(vastaus) };
  }

  // Vastaus on taulukko Message-objekteja. Tuntemattomat kentät sivuutetaan
  // tarkoituksella (rajapinta on eteenpäin yhteensopiva ja voi lisätä uusia kenttiä
  // milloin tahansa) — luetaan vain ne joita oikeasti käytetään.
  const viestit = Array.isArray(vastaus.data) ? vastaus.data : [];
  return {
    ok: true,
    dryRun: false,
    mitat,
    tulokset: viestit.map((m) => ({
      numero: typeof m?.to === 'string' ? m.to : null,
      id: m?.id ?? null,
      status: m?.status?.type || 'ACCEPTED',
      osia: m?.numberOfParts ?? mitat.osia,
      hinta: m?.creditCost ?? null,
    })),
  };
}

// Tilin saldo ja päivittäinen kiintiö. Käytetään käyttöliittymän varoitukseen ennen kuin
// saldo loppuu kesken oikean hätätilanteen. HUOM: /v1/credit/ EI ole saldon päätepiste
// (/credit/transfer on saldon siirto toiselle tilille) — saldo tulee profiilista.
export async function haeSaldo() {
  if (!onkoKonfiguroitu()) return { ok: false, konfiguroitu: false };
  let vastaus;
  try {
    vastaus = await kutsu('/profile');
  } catch (err) {
    const syy = err?.name === 'TimeoutError' ? 'aikakatkaisu' : err?.message || 'tuntematon virhe';
    return { ok: false, konfiguroitu: true, virhe: `Saldon haku epäonnistui: ${syy}.` };
  }
  if (!vastaus.ok) return { ok: false, konfiguroitu: true, virhe: virheteksti(vastaus) };
  const p = vastaus.data || {};
  return {
    ok: true,
    konfiguroitu: true,
    saldo: p.credits?.balance ?? null,
    kiintioJaljella: p.quota?.remaining ?? null,
    kiintioKoko: p.quota?.size ?? null,
  };
}

export const _sisaiset = { GSM_PERUS, GSM_LAAJENNUS, RAJAT, MAX_BATCH };
