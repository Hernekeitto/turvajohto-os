// Laitesidonta: sidontakoodi, laitetietue ja allekirjoitetun pyynnön tarkistus.
//
// Säännöt ovat täällä ja kutsut index.js:ssä, samaan tapaan kuin halytys.js:ssä ja
// geofence.js:ssä. Tämä tiedosto ei lue eikä kirjoita levyä eikä tunne Expressiä.
//
// --- Miksi laitteella EI ole tokenia ------------------------------------------------
//
// Ensimmäinen suunnitelma oli antaa sovellukselle oma istuntotoken, jota se säilyttäisi
// ja lähettäisi jokaisessa pyynnössä. Se hylättiin, koska pyyntö on joka tapauksessa
// allekirjoitettava laitteen omalla avaimella — ja silloin token olisi vain toinen
// tunniste saman asian päälle, ja samalla AINOA laitteella oleva salaisuus jonka voisi
// varastaa. Nyt laitteella ei ole levyllä mitään salaista: yksityinen avain ei poistu
// Keystoresta edes juurioikeuksin, ja laitetunnus on julkinen tieto.
//
// Seuraus on tärkeä ja se on syytä sanoa ääneen: varastettu puhelin on yhä pääsy
// järjestelmään, koska avain on siinä puhelimessa. Sidonta suojaa avaimen KOPIOIMISELTA
// toiseen laitteeseen, ei laitteen anastukselta. Sitä vastaan on kaksi keinoa, ja
// molemmat ovat ihmisen tekoja: laitteen lukitus ja hälytyskeskuksen tekemä nollaus.
//
// --- Mitä pakkouloskirjaus tarkoittaa täällä ----------------------------------------
//
// Selainistunnon mitätöi `session_invalidated_at` verrattuna tokenin myöntöhetkeen
// (index.js getSessionUser). Laitteella ei ole tokenia eikä myöntöhetkeä, joten vertailu
// tehdään SIDONTA-hetkeen: ennen mitätöintiä sidottu laite lakkaa kelpaamasta samalla
// sekunnilla kuin selainistunnotkin. Lupaus on siis sama eikä laitteelle synny omaa
// ohituskaistaa.

import crypto from 'node:crypto';

// Sidontakoodin voimassaolo. Viisi minuuttia riittää siihen että selain avaa intentin ja
// sovellus vastaa; pidempi olisi tarpeeton, koska koodi on kertakäyttöinen ja syntyy
// napin painalluksesta.
export const KOODI_VOIMASSA_MS = 5 * 60 * 1000;

// Koodin pituus ja aakkosto. Aakkostosta puuttuvat 0/O ja 1/I: koodi luetaan normaalisti
// intentistä eikä ihmisen silmällä, mutta jos intent ei jostain syystä laukea, se on
// voitava lukea ruudulta ääneen ilman että kysytään "nolla vai oo".
export const KOODI_PITUUS = 10;
const AAKKOSTO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Kuinka vanha allekirjoitettu pyyntö vielä kelpaa. Viisi minuuttia molempiin suuntiin
// sallii puhelimen kellon tavanomaisen heiton mutta pitää toistoikkunan lyhyenä.
export const AIKAIKKUNA_MS = 5 * 60 * 1000;

// Yksi laite tunnusta kohden (päätös 9.9.2026). Vaihto tapahtuu hälytyskeskuksen
// tekemällä nollauksella, ei toista laitetta lisäämällä.
export const LAITTEITA_TUNNUSTA_KOHDEN = 1;

// Allekirjoituksen versio kanonisen viestin ensimmäisellä rivillä. Ilman tätä kentän
// lisääminen viestiin myöhemmin olisi hiljainen yhteensopivuusrikko: vanha sovellus
// allekirjoittaisi eri merkkijonon kuin palvelin tarkistaa, ja virhe näyttäisi väärältä
// avaimelta.
export const ALLEKIRJOITUS_VERSIO = 'v1';

const tiiviste = (teksti) => crypto.createHash('sha256').update(teksti).digest('hex');

// Vakioaikainen vertailu. Sama peruste kuin jakolinkkien tokeneilla index.js:ssä:
// vastausaika ei saa kertoa kuinka moni merkki osui.
function tasmaa(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

/**
 * Uusi sidontakoodi kirjautuneelle käyttäjälle.
 *
 * Palautetaan koodi selkokielisenä KERRAN — kutsuja lähettää sen selaimelle eikä sitä
 * voi enää myöhemmin lukea. Tietueeseen jää vain tiiviste, samasta syystä kuin
 * salasanoista: sidontakoodi on lyhytikäinen mutta se on silti pääsy tunnukseen.
 */
export function luoKoodi({ kayttaja, nyt = Date.now(), satunnainen = oletusSatunnainen }) {
  const koodi = satunnainen(KOODI_PITUUS);
  return {
    koodi,
    tietue: {
      kayttaja,
      tiiviste: tiiviste(koodi),
      luotu: new Date(nyt).toISOString(),
      eraantyy: nyt + KOODI_VOIMASSA_MS,
    },
  };
}

function oletusSatunnainen(pituus) {
  // crypto.randomInt eikä Math.random: koodi on pääsy tunnukseen viiden minuutin ajan.
  let ulos = '';
  for (let i = 0; i < pituus; i += 1) ulos += AAKKOSTO[crypto.randomInt(AAKKOSTO.length)];
  return ulos;
}

/**
 * Kelpaako annettu koodi tietueeseen. Erillinen funktio, koska sama tarkistus tarvitaan
 * sekä rekisteröinnissä että testeissä, ja koska virheen SYY ei saa vuotaa kutsujalle:
 * palautetaan totuusarvo ja erikseen syy lokia varten.
 */
export function kelpaakoKoodi(tietue, koodi, nyt = Date.now()) {
  if (!tietue) return { ok: false, syy: 'tuntematon' };
  if (tietue.kaytetty) return { ok: false, syy: 'kaytetty' };
  if (nyt > tietue.eraantyy) return { ok: false, syy: 'vanhentunut' };
  if (!tasmaa(tietue.tiiviste, tiiviste(String(koodi || '')))) return { ok: false, syy: 'vaara' };
  return { ok: true, syy: null };
}

/**
 * Uusi laitetietue. `julkinenAvain` on Androidin `PublicKey.getEncoded()` eli X.509
 * SPKI DER base64:na — sellaisenaan se mitä `crypto.createPublicKey` osaa lukea, joten
 * muotoa ei muunneta kummassakaan päässä.
 */
export function laitteenTietue({ kayttaja, julkinenAvain, malli, nyt = Date.now() }) {
  return {
    id: crypto.randomUUID(),
    kayttaja,
    julkinenAvain,
    // Laitteen oma ilmoitus itsestään ("Samsung SM-S911B, Android 14"). Näytetään
    // hälytyskeskukselle nollausnäkymässä, jotta oikea laite on tunnistettavissa
    // silloin kun vartija soittaa ja sanoo puhelimensa hajonneen.
    malli: String(malli || '').slice(0, 120),
    sidottu: new Date(nyt).toISOString(),
    sidottuMs: nyt,
  };
}

/**
 * Onko avain luettavissa. Kelvoton avain on hylättävä REKISTERÖINNISSÄ eikä vasta
 * ensimmäisessä allekirjoitetussa pyynnössä — muuten sidonta näyttäisi onnistuvan ja
 * laite olisi käyttökelvoton vasta kentällä.
 */
export function lueAvain(julkinenAvain) {
  try {
    const avain = crypto.createPublicKey({
      key: Buffer.from(String(julkinenAvain || ''), 'base64'),
      format: 'der',
      type: 'spki',
    });
    // Vain EC. RSA toimisi teknisesti, mutta sovellus luo P-256-avaimen ja yksi
    // hyväksytty muoto on helpompi pitää oikeana kuin kaksi.
    if (avain.asymmetricKeyType !== 'ec') return null;
    return avain;
  } catch {
    return null;
  }
}

/**
 * Se merkkijono jonka laite allekirjoittaa ja palvelin tarkistaa. Rivinvaihdolla erotetut
 * kentät eikä JSON: JSON-serialisoinnin kenttäjärjestys ja välilyönnit voivat erota
 * alustojen välillä, ja allekirjoitus rikkoutuisi näkymättömästä syystä.
 *
 * Runko on mukana TIIVISTEENÄ eikä sellaisenaan, jotta sama funktio kelpaa myös
 * suurille pyynnöille eikä koko runkoa tarvitse pitää muistissa kahdesti.
 */
export function kanoninenViesti({ laiteId, metodi, polku, aika, nonce, runko = '' }) {
  return [
    ALLEKIRJOITUS_VERSIO,
    laiteId,
    String(metodi || '').toUpperCase(),
    polku,
    String(aika),
    nonce,
    tiiviste(runko),
  ].join('\n');
}

/**
 * Allekirjoitetun pyynnön tarkistus.
 *
 * Neljä ehtoa, ja jokaisella on oma tehtävänsä:
 *   1. AIKA  — pyyntö ei saa olla vanha eikä tulevaisuudesta (toiston ikkuna).
 *   2. NONCE — sama pyyntö ei kelpaa kahdesti (toisto ikkunan sisällä).
 *   3. AVAIN — allekirjoitus täsmää laitteen julkiseen avaimeen.
 *   4. AIKARAJA — sidonta ei saa olla mitätöity eikä vanhempi kuin istunnon yläraja.
 *
 * `onkoNahty` ja `merkitseNahdyksi` tulevat kutsujalta, koska nonce-muisti on tilaa eikä
 * sääntö. Ilman niitä tämä moduuli tarvitsisi oman elinkaarensa.
 */
export function tarkistaAllekirjoitus({
  laite,
  metodi,
  polku,
  aika,
  nonce,
  allekirjoitus,
  runko = '',
  nyt = Date.now(),
  onkoNahty = () => false,
  mitatoityMs = null,
  ylarajaMs = null,
}) {
  if (!laite) return { ok: false, syy: 'tuntematon_laite' };

  const hetki = Number(aika);
  if (!Number.isFinite(hetki)) return { ok: false, syy: 'aika_puuttuu' };
  if (Math.abs(nyt - hetki) > AIKAIKKUNA_MS) return { ok: false, syy: 'aika_ikkunan_ulkona' };

  if (!nonce || String(nonce).length < 8) return { ok: false, syy: 'nonce_puuttuu' };
  if (onkoNahty(String(nonce))) return { ok: false, syy: 'toisto' };

  // Pakkouloskirjaus koskee myös laitetta. Vertailu sidontahetkeen, ks. tiedoston
  // alun perustelu.
  if (mitatoityMs && laite.sidottuMs < mitatoityMs) return { ok: false, syy: 'mitatoity' };
  if (ylarajaMs && nyt - laite.sidottuMs > ylarajaMs) return { ok: false, syy: 'vanhentunut_sidonta' };

  const avain = lueAvain(laite.julkinenAvain);
  if (!avain) return { ok: false, syy: 'avain_kelvoton' };

  let kelpaa = false;
  try {
    kelpaa = crypto.verify(
      'sha256',
      Buffer.from(kanoninenViesti({ laiteId: laite.id, metodi, polku, aika: hetki, nonce, runko })),
      avain,
      Buffer.from(String(allekirjoitus || ''), 'base64')
    );
  } catch {
    kelpaa = false;
  }
  if (!kelpaa) return { ok: false, syy: 'allekirjoitus' };

  return { ok: true, syy: null };
}

/**
 * Nonce-muisti: nähdyt tunnisteet aikaikkunan ajan.
 *
 * Muistissa eikä levyllä, ja se on tietoinen rajaus. Palvelimen uudelleenkäynnistys
 * unohtaa nähdyt noncet, jolloin viiden minuutin ikkunan sisällä kaapattu pyyntö olisi
 * teoriassa toistettavissa kerran. Vaihtoehto olisi kirjoittaa levylle jokaisesta
 * pyynnöstä — hinta joka maksettaisiin joka minuutti sen varalta että palvelin
 * käynnistyy uudelleen juuri väärällä hetkellä.
 */
export function luoNonceMuisti(ikkunaMs = AIKAIKKUNA_MS) {
  const nahdyt = new Map();

  const siivoa = (nyt) => {
    for (const [avain, hetki] of nahdyt) {
      if (nyt - hetki > ikkunaMs) nahdyt.delete(avain);
    }
  };

  return {
    onkoNahty(nonce, nyt = Date.now()) {
      siivoa(nyt);
      return nahdyt.has(nonce);
    },
    merkitse(nonce, nyt = Date.now()) {
      nahdyt.set(nonce, nyt);
    },
    get koko() {
      return nahdyt.size;
    },
  };
}
