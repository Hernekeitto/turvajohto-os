// Pohjan suoritus: skenaarion läpivienti ja run sheetin ajo.
//
// Sama suhde pohjaan kuin kierroksella kierrospohjaan (kierros.js), ja tarkoituksella eri
// moduuli: kierroksen säännöt ovat todistesääntöjä (kuittaus todistaa että joku oli
// jossain), nämä ovat tilanteenhallinnan sääntöjä (kuittaus kertoo että jokin on tehty).
// Yhteen moduuliin puristettuna kumpikin joukko olisi täynnä toisen erikoistapauksia.
//
// KOLME SÄÄNTÖÄ:
//
//  1. KRIITTISTÄ KOHTAA EI VOI OHITTAA. Skenaario voidaan merkitä hoidetuksi vain jos
//     jokainen kriittiseksi merkitty kohta on kuitattu. Muut kohdat saavat jäädä: pohjassa
//     on tarkoituksella kohtia jotka eivät koske jokaista tilannetta ("jos uhri on
//     tajuton"), ja niiden pakottaminen tekisi sulkemisesta valheellisen.
//
//  2. KESKEYTYS VAATII SYYN. Sama peruste kuin kierroksella: keskeytys on hyväksyttävä,
//     mutta ilman syytä siitä ei ole mitään hyötyä jälkikäteen.
//
//  3. KUITTAUS ON PERUUTTAMATON JA PÄÄTTYNYTTÄ EI AVATA UUDELLEEN. Skenaarion kulku on
//     tapahtumien aikajana, eikä aikajanaa muokata jälkikäteen.
//
// SISÄLTÖ KOPIOIDAAN pohjasta suoritukseen, ei viitata. Pohjaa muokataan kesken
// tapahtuman — usein juuri sen takia mitä tilanteessa opittiin — eikä se saa muuttaa sitä
// mitä tunti sitten tehtiin.

import crypto from 'node:crypto';

export const TILAT = ['kesken', 'valmis', 'keskeytetty'];
export const PAATTYNEET = ['valmis', 'keskeytetty'];

export const onPaattynyt = (suoritus) => PAATTYNEET.includes(suoritus?.tila);

export const SYYN_MIN_PITUUS = 3;
export const SYYN_MAX_PITUUS = 500;
export const HUOMION_MAX_PITUUS = 2000;
export const KOMMENTIN_MAX_PITUUS = 1000;
// Yhden suorituksen tilanneloki. Raja on tallennuksen suoja eikä käytännön raja: pitkäkin
// tilanne tuottaa kymmeniä merkintöjä, ei satoja.
export const KOMMENTTEJA_ENINTAAN = 500;

const teksti = (arvo, max) => String(arvo ?? '').trim().slice(0, max);

// --- Haarautuva skenaario (28.9.2026) -------------------------------------------------
//
// Skenaariossa voi olla VALINTAKOHTIA ("Onko kohteessa tulipalo?"), joiden vaihtoehdoilla
// on omat jatkokohtansa. Rakenne on litteä lista eikä sisäkkäinen puu: kohdan `haara`
// kertoo minkä vaihtoehdon alle se kuuluu, ja kohta ilman haaraa on pääpolulla. Litteänä
// siksi, että store.js:n kenttäsalaus ja versiovertailu osaavat vain `kohdat[].kentta`
// -muotoisen polun, ja siksi että pääpolku voi jatkua haaran jälkeen yhteisenä
// ("Raportoi HÄLKEen" kuuluu molempiin polkuihin).
//
// Kohta on AKTIIVINEN, jos se on pääpolulla tai sen vaihtoehto on valittu ja valinta
// itse on aktiivinen. Valitsematta jääneen polun kohtia ei vaadita eikä lasketa: ne
// eivät koske tätä tilannetta.

export const onValinta = (kohta) => kohta?.tyyppi === 'valinta';

export function aktiivisetKohdat(kohdat) {
  const lista = Array.isArray(kohdat) ? kohdat : [];
  const valintaVaihtoehdolle = new Map();
  for (const k of lista) {
    if (!onValinta(k)) continue;
    for (const v of k.vaihtoehdot || []) valintaVaihtoehdolle.set(v.id, k);
  }
  const aktiivinen = (kohta, syvyys) => {
    if (!kohta.haara) return true;
    const valinta = valintaVaihtoehdolle.get(kohta.haara);
    // Syvyysraja suojaa rikkinäiseltä tietueelta jossa haarat viittaisivat kehään.
    if (!valinta || syvyys > 50) return false;
    return valinta.valittu === kohta.haara && aktiivinen(valinta, syvyys + 1);
  };
  return lista.filter((k) => aktiivinen(k, 0));
}

const kommentti = ({ teksti: sisalto, tekija, nyt, jarjestelma = false, id }) => ({
  id,
  aika: nyt.toISOString(),
  tekija: tekija || null,
  teksti: sisalto,
  ...(jarjestelma ? { jarjestelma: true } : {}),
});

const uusiId = () => crypto.randomUUID();

// Luo suorituksen pohjasta. Kohdat kopioidaan teksteineen, vastuineen ja kriittisyyksineen.
export function aloitaSuoritus({ pohja, ownerId, tekija, id, kuvaus, nyt = new Date() }) {
  const kohdat = Array.isArray(pohja?.kohdat) ? pohja.kohdat : [];
  if (kohdat.length === 0) {
    return { ok: false, error: 'Pohjassa ei ole yhtään kohtaa.' };
  }
  if (pohja.arkistoitu) {
    return { ok: false, error: 'Pohja on poistettu käytöstä.' };
  }
  return {
    ok: true,
    suoritus: {
      id,
      kind: pohja.kind,
      ownerId,
      templateId: pohja.id,
      // Nimi ja versio kopioidaan: suoritus on luettava vaikka pohja poistettaisiin.
      templateNimi: pohja.nimi,
      templateVersio: pohja.versio ?? 1,
      // Näkyykö käynnissä oleva tilanne HÄLKE:ssä. Pohjan laatijan päätös (palohälytys kyllä,
      // rutiinitarkistus ei); kopioidaan, jotta pohjan muokkaus ei siirrä käynnissä olevaa
      // tilannetta pois päivystäjän ruudulta. Puuttuva = kyllä, kuten ennen asetusta.
      halke: pohja.halke !== false,
      tekija,
      // Mistä tilanteesta on kyse. Skenaariopohja on yleinen ("kadonnut lapsi"), ja tämä
      // on se yksittäinen tapaus jota juuri nyt hoidetaan.
      kuvaus: teksti(kuvaus, HUOMION_MAX_PITUUS),
      alkoi: nyt.toISOString(),
      paattyi: null,
      tila: 'kesken',
      keskeytysSyy: '',
      huomiot: '',
      // Tilanneloki: vartijoiden ja päivystäjän kirjoittamat merkinnät tilanteen edetessä
      // sekä järjestelmän merkinnät polun valinnoista. Vain lisätään, ei muokata.
      kommentit: [],
      kohdat: [...kohdat]
        .sort((a, b) => (a.jarjestys ?? 0) - (b.jarjestys ?? 0))
        .map((k) => ({
          kohtaId: k.id,
          teksti: k.teksti,
          kuvaus: k.kuvaus || '',
          vastuu: k.vastuu || '',
          aika: k.aika || '',
          kriittinen: k.kriittinen === true,
          kuitattu: null,
          kuittaaja: null,
          huomio: '',
          ...(k.haara ? { haara: k.haara } : {}),
          ...(onValinta(k)
            ? {
                tyyppi: 'valinta',
                vaihtoehdot: (k.vaihtoehdot || []).map((v) => ({ id: v.id, teksti: v.teksti })),
                valittu: null,
              }
            : {}),
        })),
    },
  };
}

export const kuittaamattomat = (suoritus) =>
  aktiivisetKohdat(suoritus?.kohdat).filter((k) => !k.kuitattu);

export const kriittisetKuittaamatta = (suoritus) =>
  aktiivisetKohdat(suoritus?.kohdat).filter((k) => k.kriittinen && !k.kuitattu);

// Polun valinta valintakohdassa.
//
// Valintaa SAA VAIHTAA kesken tilanteen, toisin kuin kuittausta: "ei tulipaloa" voi
// muuttua tulipaloksi kymmenessä minuutissa, eikä vartijaa saa pakottaa keskeyttämään
// skenaariota ja aloittamaan uutta. Vaihto ei pyyhi historiaa: jokainen valinta kirjataan
// tilannelokiin, ja vanhan polun jo kuitatut kohdat säilyvät tietueessa kuittauksineen
// (ne vain eivät ole enää aktiivisia).
export function valitsePolku({ suoritus, kohtaId, vaihtoehtoId, tekija, nyt = new Date(), toisto = false }) {
  if (onPaattynyt(suoritus)) return { ok: false, error: 'Suoritus on jo päättynyt.' };
  const kohta = (suoritus?.kohdat || []).find((k) => k.kohtaId === kohtaId);
  if (!kohta || !onValinta(kohta)) return { ok: false, error: 'Valintakohtaa ei löytynyt tästä suorituksesta.' };
  if (!aktiivisetKohdat(suoritus.kohdat).includes(kohta)) {
    return { ok: false, error: 'Tämä valinta ei kuulu valittuun polkuun.' };
  }
  const vaihtoehto = (kohta.vaihtoehdot || []).find((v) => v.id === vaihtoehtoId);
  if (!vaihtoehto) return { ok: false, error: 'Tuntematon vaihtoehto.' };
  if (kohta.valittu === vaihtoehtoId) {
    if (toisto) return { ok: true, suoritus, duplikaatti: true };
    return { ok: false, error: `"${vaihtoehto.teksti}" on jo valittu.` };
  }

  const edellinen = (kohta.vaihtoehdot || []).find((v) => v.id === kohta.valittu);
  const merkinta = edellinen
    ? `${kohta.teksti}: polku vaihdettu "${edellinen.teksti}" → "${vaihtoehto.teksti}"`
    : `${kohta.teksti}: ${vaihtoehto.teksti}`;
  const kommentit = Array.isArray(suoritus.kommentit) ? suoritus.kommentit : [];
  return {
    ok: true,
    suoritus: {
      ...suoritus,
      kommentit: [
        ...kommentit,
        kommentti({ id: uusiId(), teksti: merkinta, tekija, nyt, jarjestelma: true }),
      ].slice(-KOMMENTTEJA_ENINTAAN),
      kohdat: suoritus.kohdat.map((k) => (k.kohtaId === kohtaId
        ? { ...k, valittu: vaihtoehtoId, kuitattu: nyt.toISOString(), kuittaaja: tekija || null }
        : k)),
    },
  };
}

// Merkintä tilannelokiin. Sallittu vain käynnissä olevaan suoritukseen: loki on
// tapahtumien aikajana, ja päättyneen tilanteen jälkikommentit kuuluvat raporttiin.
export function lisaaKommentti({ suoritus, teksti: sisalto, tekija, nyt = new Date(), id = uusiId() }) {
  if (onPaattynyt(suoritus)) return { ok: false, error: 'Suoritus on jo päättynyt.' };
  const puhdas = teksti(sisalto, KOMMENTIN_MAX_PITUUS);
  if (puhdas.length === 0) return { ok: false, error: 'Kirjoita merkintä.' };
  const kommentit = Array.isArray(suoritus?.kommentit) ? suoritus.kommentit : [];
  if (kommentit.length >= KOMMENTTEJA_ENINTAAN) {
    return { ok: false, error: 'Tilannelokiin ei mahdu enempää merkintöjä.' };
  }
  return {
    ok: true,
    suoritus: { ...suoritus, kommentit: [...kommentit, kommentti({ id, teksti: puhdas, tekija, nyt })] },
  };
}

// Yhden kohdan kuittaus.
//
// `toisto` kertoo että kirjaus tulee lähtevästä jonosta (erä 6): jo kuitattu kohta ei ole
// silloin virhe vaan sama kuittaus uudelleen, ja vastaus on ok jotta jono poistaa sen
// listaltaan. Ilman tätä katkenneen yhteyden jälkeen jonoon jäänyt kuittaus jäisi ikuisesti
// yrittämään ja näyttäisi vartijalle virhettä joka ei ole virhe.
export function kuittaaKohta({ suoritus, kohtaId, tekija, huomio, nyt = new Date(), toisto = false }) {
  if (onPaattynyt(suoritus)) {
    return { ok: false, error: 'Suoritus on jo päättynyt.' };
  }
  const kohta = (suoritus?.kohdat || []).find((k) => k.kohtaId === kohtaId);
  if (!kohta) return { ok: false, error: 'Kohtaa ei löytynyt tästä suorituksesta.' };
  if (onValinta(kohta)) return { ok: false, error: 'Valintakohta kuitataan valitsemalla polku.' };
  if (!aktiivisetKohdat(suoritus.kohdat).includes(kohta)) {
    return { ok: false, error: `"${kohta.teksti}" ei kuulu valittuun polkuun.` };
  }
  if (kohta.kuitattu) {
    if (toisto) return { ok: true, suoritus, duplikaatti: true };
    return { ok: false, error: `"${kohta.teksti}" on jo kuitattu.` };
  }

  return {
    ok: true,
    suoritus: {
      ...suoritus,
      kohdat: suoritus.kohdat.map((k) => (k.kohtaId === kohtaId
        ? {
            ...k,
            kuitattu: nyt.toISOString(),
            kuittaaja: tekija || null,
            huomio: teksti(huomio, HUOMION_MAX_PITUUS),
          }
        : k)),
    },
  };
}

// Suorituksen päättäminen. Valmis vaatii kriittiset kohdat, keskeytys vaatii syyn.
export function paataSuoritus({ suoritus, tila, syy, huomiot, nyt = new Date(), toisto = false }) {
  if (onPaattynyt(suoritus)) {
    if (toisto) return { ok: true, suoritus, duplikaatti: true };
    return { ok: false, error: 'Suoritus on jo päättynyt.' };
  }
  if (tila !== 'valmis' && tila !== 'keskeytetty') {
    return { ok: false, error: 'Anna päättymisen tila.' };
  }

  if (tila === 'valmis') {
    const puuttuvat = kriittisetKuittaamatta(suoritus);
    if (puuttuvat.length > 0) {
      return {
        ok: false,
        error: puuttuvat.length === 1
          ? `Kriittinen kohta "${puuttuvat[0].teksti}" on kuittaamatta. Merkitse se tehdyksi tai keskeytä syyn kanssa.`
          : `${puuttuvat.length} kriittistä kohtaa on kuittaamatta. Merkitse ne tehdyiksi tai keskeytä syyn kanssa.`,
      };
    }
  }

  const puhdasSyy = teksti(syy, SYYN_MAX_PITUUS);
  if (tila === 'keskeytetty' && puhdasSyy.length < SYYN_MIN_PITUUS) {
    return { ok: false, error: 'Kerro lyhyesti miksi suoritus keskeytettiin.' };
  }

  return {
    ok: true,
    suoritus: {
      ...suoritus,
      tila,
      paattyi: nyt.toISOString(),
      keskeytysSyy: tila === 'keskeytetty' ? puhdasSyy : '',
      huomiot: teksti(huomiot, HUOMION_MAX_PITUUS),
    },
  };
}

// Kooste luetteloita ja raportteja varten.
export function kooste(suoritus) {
  const kohdat = aktiivisetKohdat(suoritus?.kohdat);
  const kuitatut = kohdat.filter((k) => k.kuitattu).length;
  return {
    kohtia: kohdat.length,
    kuitattu: kuitatut,
    kriittisiaKuittaamatta: kriittisetKuittaamatta(suoritus).length,
    valmisAste: kohdat.length === 0 ? 0 : Math.round((kuitatut / kohdat.length) * 100),
  };
}
