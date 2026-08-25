// Tiedostojen ja kansioiden jakolinkit.
//
// Jakolinkki antaa pääsyn tiedostoon ILMAN kirjautumista, joten se on turvallisuuden
// kannalta sovelluksen herkin kohta. Suunnitteluperiaatteet:
//
//  1. Token on 256-bittinen (crypto.randomBytes(32)). Arvaaminen ei ole realistinen
//     uhka — vuotaminen on. Linkki päätyy lokeihin, selainhistoriaan ja
//     linkkiesikatseluihin (WhatsApp/Teams hakevat URL:n automaattisesti).
//  2. Siksi VANHENTUMINEN on pääsuoja: vuotanut linkki kuolee itsestään. Ylin
//     määräaika on 65 vrk. Pysyvä linkki on mahdollinen mutta vaatii pääkäyttäjän
//     hyväksynnän (ks. approvalStatus).
//  3. Henkilötietoa sisältävä kohde EI voi olla pelkän linkin takana: salasana on
//     silloin pakollinen ja määräaika lyhyempi.
//  4. Jokainen lataus kirjataan (määrä, aika, IP). Ilman tätä linkin vuotamista ei
//     havaitse mitenkään.
//
// Token itsessään salataan levylle (ks. store.js ENCRYPTED_FIELDS), koska se on
// salasanaan rinnastuva salaisuus.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

// Pisin sallittu määräaika. Tätä pidempi vaatii pääkäyttäjän hyväksynnän.
export const MAX_VOIMASSAOLO_VRK = 65;

// Henkilötietoa sisältävän kohteen jakolinkki vanhenee viimeistään tässä ajassa,
// vaikka käyttäjä valitsisi pidemmän. Lyhyempi altistusaika, kun vuoto olisi vakavampi.
export const HENKILOTIETO_MAX_VRK = 7;

// Hyväksyntää odottava pysyvä linkki toimii tämän ajan. Jos kukaan ei hyväksy, linkki
// kuolee itsestään — unohtunut pyyntö ei saa jättää pysyvää linkkiä auki.
const ODOTUS_VRK = 7;

const VRK_MS = 24 * 60 * 60 * 1000;

export function luoToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// Vakioaikainen vertailu: tavallinen === vuotaisi ajastuksen kautta tietoa siitä
// kuinka monta merkkiä osui oikein.
export function tokenTasmaa(annettu, tallennettu) {
  if (typeof annettu !== 'string' || typeof tallennettu !== 'string') return false;
  const a = Buffer.from(annettu);
  const b = Buffer.from(tallennettu);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Laskee jakolinkin lopullisen vanhentumishetken pyydetystä arvosta.
//
// Palauttaa { expiresAt, approvalStatus, error }. approvalStatus 'pending' tarkoittaa
// että käyttäjä pyysi pysyvää linkkiä eikä ole pääkäyttäjä: linkki toimii ODOTUS_VRK
// ajan ja muuttuu pysyväksi vasta hyväksynnän myötä.
export function ratkaiseVoimassaolo({ expiresAt, ikuinen, henkilotietoa, onAdmin }, nyt = new Date()) {
  const raja = new Date(nyt.getTime() + MAX_VOIMASSAOLO_VRK * VRK_MS);
  const henkiloRaja = new Date(nyt.getTime() + HENKILOTIETO_MAX_VRK * VRK_MS);

  if (ikuinen) {
    // Henkilötietoa sisältävälle kohteelle ei anneta pysyvää linkkiä lainkaan:
    // hyväksyntäkään ei tee siitä perusteltua, koska altistus olisi rajaton.
    if (henkilotietoa) {
      return { error: 'Henkilötietoa sisältävälle kohteelle ei voi luoda pysyvää linkkiä. Valitse määräaika.' };
    }
    if (onAdmin) {
      // Pääkäyttäjä hyväksyisi pyynnön joka tapauksessa itse.
      return { expiresAt: null, approvalStatus: 'approved' };
    }
    return { expiresAt: new Date(nyt.getTime() + ODOTUS_VRK * VRK_MS).toISOString(), approvalStatus: 'pending' };
  }

  if (!expiresAt) return { error: 'Voimassaoloaika vaaditaan.' };
  const pvm = new Date(expiresAt);
  if (Number.isNaN(pvm.getTime())) return { error: 'Virheellinen voimassaoloaika.' };
  if (pvm <= nyt) return { error: 'Voimassaoloajan on oltava tulevaisuudessa.' };
  if (pvm > raja) return { error: `Voimassaoloaika voi olla enintään ${MAX_VOIMASSAOLO_VRK} vrk.` };
  if (henkilotietoa && pvm > henkiloRaja) {
    return { error: `Henkilötietoa sisältävän kohteen linkki voi olla voimassa enintään ${HENKILOTIETO_MAX_VRK} vrk.` };
  }
  return { expiresAt: pvm.toISOString(), approvalStatus: 'none' };
}

// Onko jakolinkki juuri nyt käytettävissä. Yksi funktio, jotta latausreitti ja
// käyttöliittymän tilanäyttö eivät voi olla eri mieltä.
export function jaonTila(share, nyt = new Date()) {
  if (!share) return { ok: false, syy: 'not_found' };
  if (share.revokedAt) return { ok: false, syy: 'revoked' };
  if (share.approvalStatus === 'rejected') return { ok: false, syy: 'rejected' };
  if (share.expiresAt && new Date(share.expiresAt) <= nyt) return { ok: false, syy: 'expired' };
  if (Number.isFinite(share.maxDownloads) && share.maxDownloads > 0
      && (share.downloadCount || 0) >= share.maxDownloads) {
    return { ok: false, syy: 'limit_reached' };
  }
  return { ok: true };
}

export const TILAN_SELITE = {
  not_found: 'Linkkiä ei löytynyt.',
  revoked: 'Jakolinkki on peruutettu.',
  rejected: 'Jakolinkkiä ei ole hyväksytty.',
  expired: 'Jakolinkki on vanhentunut.',
  limit_reached: 'Jakolinkin latausraja on täyttynyt.',
};

export function hashaaSalasana(salasana) {
  return bcrypt.hashSync(salasana, 12);
}

export function salasanaTasmaa(annettu, hash) {
  if (!hash) return true; // ei salasanasuojausta
  if (typeof annettu !== 'string' || annettu === '') return false;
  return bcrypt.compareSync(annettu, hash);
}

// Kansiojaon kattavuus: jaettu kansio kattaa KOKO alipuunsa. Tämä on laskettava
// jokaisella latauksella eikä jakohetkellä — muuten kansioon myöhemmin lisätty
// tiedosto ei näkyisi jaon kautta (tai näkyisi vaikkei pitäisi, jos se siirrettiin pois).
export function kuuluuJakoon(targetId, kohdeId, tiedostot) {
  if (targetId === kohdeId) return true;
  const byId = new Map((tiedostot || []).map((f) => [f.id, f]));
  let solmu = byId.get(kohdeId);
  // Ylöspäin juureen asti. Kierrosuoja: parentId-ketju voi teoriassa olla rikki.
  const nahdyt = new Set();
  while (solmu && solmu.parentId && !nahdyt.has(solmu.id)) {
    nahdyt.add(solmu.id);
    if (solmu.parentId === targetId) return true;
    solmu = byId.get(solmu.parentId);
  }
  return false;
}

// Jakolinkin julkinen esitys (ei tokenia eikä salasanatiivistettä). Käyttöliittymä saa
// tokenin vain luontihetkellä ja erillisellä "näytä linkki" -haulla.
export function julkinenJako(share) {
  const { token: _token, passwordHash: _passwordHash, ...rest } = share || {};
  return { ...rest, hasPassword: !!share?.passwordHash };
}
