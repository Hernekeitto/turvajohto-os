// Osoitehaku kohteen sijoittamiseksi kartalle.
//
// PALVELIMELLA EIKÄ SELAIMESSA, koska selaimen CSP sallii yhteydet vain omaan
// originiin (csp.ts: connect-src 'self'). Se on tarkoituksellista: käyttäjän selain ei
// ota yhteyttä kolmanteen osapuoleen. Tämä reitti on siis ainoa kohta jossa osoite
// lähtee palvelun ulkopuolelle, ja lähtijä on palvelin — ei käyttäjän IP-osoite eikä
// istunto.
//
// LÄHDE ON OpenStreetMapin Nominatim. Se on ilmainen ja avaimeton, mutta sen käyttöehdot
// ovat tiukat, ja tämä moduuli on kirjoitettu niiden mukaan:
//
//   - korkeintaan yksi pyyntö sekunnissa koko palvelimelta (jono alla)
//   - tunnistettava User-Agent
//   - EI hakua kirjoitettaessa (autocomplete on kielletty) — käyttöliittymä hakee vasta
//     kun käyttäjä painaa Hae
//
// Kohteita perustetaan muutama viikossa, joten raja ei tule vastaan. Jos joskus tulee,
// vaihtoehto on Maanmittauslaitoksen geokoodauspalvelu, joka vaatii API-avaimen.
//
// Mitä lähtee: vain käyttäjän kirjoittama hakuteksti. Ei kohteen nimeä, ei asiakasta,
// ei mitään mikä yhdistäisi osoitteen vartiointikohteeksi.

const OSOITE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Turvajohto-OS/1.0 (+https://turvajohto-os.fi)';
const AIKARAJA_MS = 8000;
const VALI_MS = 1100;

export const HAUN_MAX_PITUUS = 200;
export const TULOKSIA_MAX = 5;

/**
 * Hakutekstin siivous. Palauttaa nullin jos tekstillä ei voi hakea — tyhjä, liian lyhyt
 * tai liian pitkä. Pituusraja on väärinkäyttöä vastaan eikä osoitteita varten:
 * suomalainen katuosoite postinumeroineen on alle 80 merkkiä.
 */
export function siivoaHaku(teksti) {
  if (typeof teksti !== 'string') return null;
  const puhdas = teksti.replace(/\s+/g, ' ').trim();
  if (puhdas.length < 3 || puhdas.length > HAUN_MAX_PITUUS) return null;
  return puhdas;
}

/**
 * Nominatimin vastaus meidän muotoomme. Vain rivit joilla on luettava sijainti —
 * rikkinäinen rivi siirtäisi kohteen päiväntasaajalle, ja väärä sijainti on pahempi kuin
 * puuttuva: se kohdentaisi hälytyksiä vartijoille jotka ovat satojen kilometrien päässä.
 */
export function tulkitseVastaus(data) {
  if (!Array.isArray(data)) return [];
  const tulokset = [];
  for (const rivi of data) {
    const lat = Number(rivi?.lat);
    const lon = Number(rivi?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    tulokset.push({
      nimi: String(rivi?.display_name || '').slice(0, 300),
      lat,
      lon,
    });
    if (tulokset.length >= TULOKSIA_MAX) break;
  }
  return tulokset;
}

// Pyynnöt jonoon, jotta palvelimelta lähtee enintään yksi sekunnissa riippumatta siitä
// kuinka moni käyttäjä hakee yhtä aikaa.
let edellinen = Promise.resolve();
let viimeisin = 0;

function vuoroon(tehtava) {
  const tama = edellinen.then(async () => {
    const odota = viimeisin + VALI_MS - Date.now();
    if (odota > 0) await new Promise((r) => setTimeout(r, odota));
    viimeisin = Date.now();
    return tehtava();
  });
  // Epäonnistunut haku ei saa pysäyttää jonoa seuraavilta.
  edellinen = tama.catch(() => {});
  return tama;
}

/**
 * Hae osoitteella. Rajattu Suomeen, koska kartan tiilet ja rajaus ovat Suomi
 * (src/guard/kartta/lataa.ts: SUOMI_RAJAUS) — ulkomainen osuma olisi piste jota kartta
 * ei edes näytä.
 */
export function haeOsoite(haku, { fetchImpl = fetch } = {}) {
  return vuoroon(async () => {
    const url = new URL(OSOITE);
    url.searchParams.set('q', haku);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('countrycodes', 'fi');
    url.searchParams.set('limit', String(TULOKSIA_MAX));
    url.searchParams.set('accept-language', 'fi');

    const vastaus = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(AIKARAJA_MS),
    });
    if (!vastaus.ok) throw new Error(`Osoitepalvelu vastasi ${vastaus.status}.`);
    return tulkitseVastaus(await vastaus.json());
  });
}
