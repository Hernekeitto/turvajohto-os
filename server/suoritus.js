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

export const TILAT = ['kesken', 'valmis', 'keskeytetty'];
export const PAATTYNEET = ['valmis', 'keskeytetty'];

export const onPaattynyt = (suoritus) => PAATTYNEET.includes(suoritus?.tila);

export const SYYN_MIN_PITUUS = 3;
export const SYYN_MAX_PITUUS = 500;
export const HUOMION_MAX_PITUUS = 2000;

const teksti = (arvo, max) => String(arvo ?? '').trim().slice(0, max);

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
      tekija,
      // Mistä tilanteesta on kyse. Skenaariopohja on yleinen ("kadonnut lapsi"), ja tämä
      // on se yksittäinen tapaus jota juuri nyt hoidetaan.
      kuvaus: teksti(kuvaus, HUOMION_MAX_PITUUS),
      alkoi: nyt.toISOString(),
      paattyi: null,
      tila: 'kesken',
      keskeytysSyy: '',
      huomiot: '',
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
        })),
    },
  };
}

export const kuittaamattomat = (suoritus) =>
  (suoritus?.kohdat || []).filter((k) => !k.kuitattu);

export const kriittisetKuittaamatta = (suoritus) =>
  (suoritus?.kohdat || []).filter((k) => k.kriittinen && !k.kuitattu);

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
  const kohdat = suoritus?.kohdat || [];
  const kuitatut = kohdat.filter((k) => k.kuitattu).length;
  return {
    kohtia: kohdat.length,
    kuitattu: kuitatut,
    kriittisiaKuittaamatta: kriittisetKuittaamatta(suoritus).length,
    valmisAste: kohdat.length === 0 ? 0 : Math.round((kuitatut / kohdat.length) * 100),
  };
}
