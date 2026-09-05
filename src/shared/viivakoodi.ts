// Code-128-viivakoodi. Selaimessa muodostettu, ei kirjastoa eikä palvelinkutsua.
//
// Kolme syytä olla hakematta valmista kirjastoa:
//   - CSP sallii vain 'self'-lähteet (ks. csp.ts), joten CDN ei tule kysymykseen.
//   - npm-kirjastot piirtävät canvakselle ja tuovat mukanaan kaikki symboliikat
//     (EAN, UPC, ITF, Data Matrix); tarvitsemme yhden, ja se on 120 riviä.
//   - Viivakoodi tarvitaan MYÖS tulostettavaan HTML-dokumenttiin (tuloste.ts), joka
//     rakennetaan merkkijonona iframen sisään. Reaktikomponentti ei kelpaa sinne, joten
//     kuvion muodostus on erotettu piirtämisestä: sama koodaus, kaksi ulostuloa.
//
// QR-koodi muodostetaan edelleen PALVELIMELLA (shared/komponentit/QrKoodi.tsx). Ero on
// tarkoituksellinen eikä epäjohdonmukaisuus: QR:n koodaus virheenkorjauksineen on
// kertaluokkaa isompi asia, ja palvelimella se kirjasto on jo olemassa TOTP-koodeja
// varten. Code-128 on niin pieni, että sitä varten ei kannata tehdä verkkokutsua —
// eikä pitäisikään, koska tarrojen esikatselu halutaan avattavaksi myös katkolla.

// Symbolien viivanleveydet. Jokainen merkkijono on kuusi lukua (lopetusmerkki seitsemän)
// jotka luetaan vuorotellen viivaksi ja väliksi ensimmäisestä alkaen. Taulukko on
// standardin oma eikä sitä voi johtaa mistään — indeksi on symbolin arvo.
const KUVIOT = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

// Aloitusmerkki koodisarjalle B ja lopetusmerkki. Käytetään VAIN sarjaa B: se kattaa
// isot ja pienet kirjaimet, numerot ja välimerkit. Sarja C pakkaisi numeroparit puoleen
// tilaan, mutta se tekisi koodaimesta kaksi kertaa mutkikkaamman sellaisen säästön
// vuoksi jota tarrassa ei tarvita — tunnisteemme ovat kirjaimia ja numeroita sekaisin.
const ALOITUS_B = 104;
const LOPETUS = 106;

// Sarjan B merkkialue: väli (32) ... tilde (126). Näiden ulkopuolella olevaa merkkiä ei
// voi koodata, eikä sitä saa hiljaa pudottaa pois — silloin tarraan tulostuisi eri koodi
// kuin mitä kentällä luetaan.
export const SALLITTU_MERKKI = (merkki: string) => {
  const koodi = merkki.charCodeAt(0);
  return koodi >= 32 && koodi <= 126;
};

export const kelpaaViivakoodiksi = (teksti: string) =>
  typeof teksti === 'string' && teksti.length > 0 && teksti.length <= 48
  && [...teksti].every(SALLITTU_MERKKI);

/**
 * Koodaa tekstin Code-128B:ksi ja palauttaa viivojen ja välien leveydet moduuleina.
 * Ensimmäinen luku on VIIVA, seuraava väli, ja niin edelleen. Hiljainen alue (10
 * moduulia molemmin puolin) ei ole mukana — se kuuluu piirtäjälle, koska sen leveys on
 * tulosteessa eri asia kuin ruudulla.
 *
 * Palauttaa null jos teksti ei kelpaa. Ei heitä poikkeusta: kutsuja on tarran
 * esikatselu, jonka on kerrottava syy eikä kaaduttava.
 */
export function code128Leveydet(teksti: string): number[] | null {
  if (!kelpaaViivakoodiksi(teksti)) return null;

  const arvot = [...teksti].map((merkki) => merkki.charCodeAt(0) - 32);

  // Tarkistussumma: aloitusmerkki plus jokainen arvo painotettuna paikallaan (1, 2, 3…),
  // modulo 103. Ilman sitä lukija hyväksyisi vioittuneen koodin.
  let summa = ALOITUS_B;
  arvot.forEach((arvo, i) => { summa += arvo * (i + 1); });
  const tarkiste = summa % 103;

  const symbolit = [ALOITUS_B, ...arvot, tarkiste, LOPETUS];
  const leveydet: number[] = [];
  for (const symboli of symbolit) {
    for (const merkki of KUVIOT[symboli]) leveydet.push(Number(merkki));
  }
  return leveydet;
}

export type ViivakoodiAsetukset = {
  // Yhden moduulin leveys pikseleinä. Tulosteessa käytetään isompaa arvoa kuin ruudulla:
  // liian kapea moduuli katoaa musteen leviämiseen eikä koodi enää lue.
  moduuli?: number;
  korkeus?: number;
  // Luettava teksti viivojen viereen. Standardi ei vaadi sitä, mutta ilman sitä koodia
  // ei voi tarkistaa eikä syöttää käsin silloin kun lukija ei suostu lukemaan.
  naytaTeksti?: boolean;
  // Tikapuuasento: koodi kääntyy neljänneskierroksen niin että viivat ovat vaakasuoria
  // ja koodi juoksee ylhäältä alas. Tätä käytetään kapeassa pystytarrassa, jossa
  // vaakakoodi jäisi niin lyhyeksi ettei se enää lue — tarran korkeus on se mitta joka
  // siinä on runsaasti. Lukijoille asento on yhdentekevä.
  pysty?: boolean;
};

// Hiljainen alue. Standardi vaatii vähintään 10 moduulia; kapeampi reunus on yleisin syy
// siihen että tulostettu viivakoodi ei lue.
export const HILJAINEN_ALUE = 10;

export type ViivakoodiKuvio = {
  // Viivat vasemmalta oikealle: alkukohta ja leveys moduuleina (hiljainen alue mukana).
  viivat: { x: number; leveys: number }[];
  leveysModuuleina: number;
};

/**
 * Muuntaa leveyslistan piirrettäviksi viivoiksi. Erillinen vaihe, koska sekä SVG-
 * merkkijono (tuloste) että React-komponentti (esikatselu) tarvitsevat täsmälleen saman
 * geometrian — kaksi laskentaa tarkoittaisi kahta tapaa piirtää eri koodi.
 */
export function viivakoodiKuvio(teksti: string): ViivakoodiKuvio | null {
  const leveydet = code128Leveydet(teksti);
  if (!leveydet) return null;
  const viivat: { x: number; leveys: number }[] = [];
  let x = HILJAINEN_ALUE;
  leveydet.forEach((leveys, i) => {
    // Parilliset alkiot ovat viivoja, parittomat välejä.
    if (i % 2 === 0) viivat.push({ x, leveys });
    x += leveys;
  });
  return { viivat, leveysModuuleina: x + HILJAINEN_ALUE };
}

// Piirtomitat. Yksi lasku sekä SVG-merkkijonolle (tuloste) että komponentille
// (esikatselu): jos ne laskisivat mittansa erikseen, esikatselu näyttäisi ennen pitkää
// eri tarraa kuin mikä tulostuu.
//
// PYSTYASENNOSSA sisältö piirretään edelleen vaakaan ja käännetään ryhmänä. Kääntäminen
// vasta lopussa tarkoittaa, että koodin geometria on molemmissa asennoissa sama —
// pystyversiota ei siis voi vahingossa piirtää eri levyisillä viivoilla.
//
// Käännös on neljännes myötäpäivään ja teksti piirretään sisällössä viivojen YLÄPUOLELLE.
// Kääntyneenä se asettuu viivojen oikealle puolelle ja luetaan ylhäältä alas — sama
// asettelu kuin tarraluonnoksessa.
export type ViivakoodiMitat = {
  // Näkymän mitat kääntö huomioiden.
  leveys: number;
  korkeus: number;
  // Sisällön mitat ennen kääntöä.
  sisaltoLeveys: number;
  viivanKorkeus: number;
  viivatY: number;
  tekstiY: number;
  tekstiX: number;
  // Ryhmän muunnos, tai null jos sisältö piirretään sellaisenaan.
  muunnos: string | null;
};

export function viivakoodiMitat(
  kuvio: ViivakoodiKuvio,
  asetukset: ViivakoodiAsetukset = {}
): ViivakoodiMitat {
  const { moduuli = 2, korkeus = 60, naytaTeksti = true, pysty = false } = asetukset;
  const tekstiKorkeus = naytaTeksti ? 14 : 0;
  const sisaltoLeveys = kuvio.leveysModuuleina * moduuli;
  const sisaltoKorkeus = korkeus + tekstiKorkeus;
  return {
    leveys: pysty ? sisaltoKorkeus : sisaltoLeveys,
    korkeus: pysty ? sisaltoLeveys : sisaltoKorkeus,
    sisaltoLeveys,
    viivanKorkeus: korkeus,
    // Vaaka: viivat ylhäällä ja teksti alla. Pysty: teksti ensin, jotta se kääntyy
    // viivojen oikealle puolelle.
    viivatY: pysty ? tekstiKorkeus : 0,
    tekstiY: pysty ? 11 : korkeus + 12,
    tekstiX: sisaltoLeveys / 2,
    muunnos: pysty ? `translate(${sisaltoKorkeus},0) rotate(90)` : null,
  };
}

const turvallinen = (teksti: string) => teksti.replace(/[<&>]/g, '');

/**
 * Viivakoodi valmiina SVG-merkkijonona. Käytetään tulostedokumentissa, joka rakennetaan
 * merkkijonona iframen sisään (tuloste.ts) — siellä ei voi renderöidä komponenttia.
 *
 * Palauttaa tyhjän merkkijonon jos teksti ei kelpaa. Tulosteessa se on oikea
 * käyttäytyminen: tarra tulostuu ilman koodia ja puute näkyy heti, kun taas heitetty
 * poikkeus jättäisi koko arkin tulostumatta.
 */
export function viivakoodiSvg(teksti: string, asetukset: ViivakoodiAsetukset = {}): string {
  const { moduuli = 2, naytaTeksti = true } = asetukset;
  const kuvio = viivakoodiKuvio(teksti);
  if (!kuvio) return '';
  const mitat = viivakoodiMitat(kuvio, asetukset);
  const viivat = kuvio.viivat
    .map((v) => `<rect x="${v.x * moduuli}" y="${mitat.viivatY}" width="${v.leveys * moduuli}"`
      + ` height="${mitat.viivanKorkeus}"/>`)
    .join('');
  const luettava = naytaTeksti
    ? `<text x="${mitat.tekstiX}" y="${mitat.tekstiY}" text-anchor="middle"`
      + ` font-family="monospace" font-size="12" letter-spacing="1">${turvallinen(teksti)}</text>`
    : '';
  const sisalto = `<g fill="#000">${viivat}</g>${luettava}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${mitat.leveys}" height="${mitat.korkeus}"`
    + ` viewBox="0 0 ${mitat.leveys} ${mitat.korkeus}" role="img" aria-label="Viivakoodi ${turvallinen(teksti)}">`
    + `<rect width="${mitat.leveys}" height="${mitat.korkeus}" fill="#fff"/>`
    + (mitat.muunnos ? `<g transform="${mitat.muunnos}">${sisalto}</g>` : sisalto)
    + '</svg>';
}
