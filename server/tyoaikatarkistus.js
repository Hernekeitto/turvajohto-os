// Työvuorolistan henkilökohtaiset tarkistukset (erä 3, 10.10.2026).
//
// Kun vartija sijoitetaan vuoroihin, tämä kertoo mitä siitä seuraa: lepoajat, viikkovapaat,
// jakson tunnit, perehdytys ja vartijakortti. Säännöt ovat vartiointialan TES:stä
// (1.4.2025–31.3.2028) ja luvut työaikasäännöistä (tyovuorolista.js: ASETUKSET).
//
// Samaan tapaan kuin muut sääntömoduulit: ei levyä, ei Expressiä. Kutsuja kokoaa
// henkilön, hänen vuoronsa ja kohteet, ja saa takaisin havainnot.
//
// --- Neljä tasoa ----------------------------------------------------------------------
//
//   este       vuoroon ei voi sijoittaa: päällekkäinen vuoro, ei perehdytystä, ei
//              voimassa olevaa vartijakorttia, ei työsuhdetta. Näitä ei ohiteta syyllä.
//   poikkeama  TES-poikkeama joka on kertaluonteisesti sovittavissa työntekijän kanssa
//              (vuorokausilepo, viikkovapaa). Sijoitus vaatii kirjatun syyn (erä 4).
//   varoitus   kerrottava mutta ei estävä: yhdeksän vuoron raja, pitkä viikonloppu,
//              jakson ylitys, kortti vanhenemassa.
//   huomio     tietoa: kuukausipalkkaisen jakso jää vajaaksi.
//
// --- Mitä tämä EI vielä tiedä ------------------------------------------------------------
//
// Poissaolot (vuosiloma, vuosivapaa, sairaus) tulevat erässä 5 toiveiden ja estojen
// mukana. Siihen asti jakson tunnit ovat pelkkiä vuorotunteja: vuosilomaviikon vajaus
// näkyy huomiona, vaikka se on TES 33 §:n mukaan työaikaan rinnastettavaa aikaa.

import { perehdytetytVuorot } from './vuorot.js';
import {
  JAKSON_ENIMMAIS_H, SAANNOLLINEN_H, lisaaPaivia, paivaksi, pvmMerkkijonoksi,
} from './tyovuorolista.js';

const MIN_PV = 24 * 60;
const MIN_VK = 7 * MIN_PV;

// '2026-10-05T22:00' -> minuutit. Paikallinen aika ilman vyöhykettä (ks.
// tyovuorolista.js: suunnitellutVuorot), joten kesäajan vaihtumisyö on tunnin pielessä.
export function aikaMin(ts) {
  const osuma = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(String(ts ?? ''));
  if (!osuma) return null;
  const paiva = paivaksi(osuma[1]);
  return paiva === null ? null : paiva / 60000 + Number(osuma[2]) * 60 + Number(osuma[3]);
}

const pvmMinuuteista = (min) => pvmMerkkijonoksi(Math.floor(min / MIN_PV) * MIN_PV * 60000);

/**
 * Kortin viimeinen voimassaolopäivä. Työntekijäpankissa voimassaolo on kuukausi
 * ('2027-03'), ja kortti on voimassa kuun loppuun. Myös täysi päivämäärä kelpaa.
 */
export function korttiVoimassaAsti(arvo) {
  const s = String(arvo ?? '').trim();
  if (paivaksi(s) !== null) return s;
  const osuma = /^(\d{4})-(\d{2})$/.exec(s);
  if (!osuma || Number(osuma[2]) < 1 || Number(osuma[2]) > 12) return null;
  const seuraavaKuu = Number(osuma[2]) === 12
    ? `${Number(osuma[1]) + 1}-01-01`
    : `${osuma[1]}-${String(Number(osuma[2]) + 1).padStart(2, '0')}-01`;
  return lisaaPaivia(seuraavaKuu, -1);
}

const paivia = (a, b) => Math.round((paivaksi(b) - paivaksi(a)) / (MIN_PV * 60000));

// Suomalainen päivämäärä viestiin.
const fi = (pvm) => {
  const [v, k, p] = String(pvm).split('-');
  return `${Number(p)}.${Number(k)}.${v}`;
};

const tunnit = (min) => String(Math.round(min / 6) / 10).replace('.', ',');

/**
 * Henkilön tarkistus yhdelle listalle.
 *
 *   henkilo   { username, nimi, workTimeType, minHoursPer3Weeks, hasGuardCard,
 *               guardCardValidUntil, employmentStart, employmentType, employmentFixedTo }
 *   vuorot    henkilön vuorot (tyovuorolista.js: suunnitellutVuorot -rivejä). Saa sisältää
 *             myös listaa edeltäviä vuoroja: niitä tarvitaan lepoaikojen ja viikkovapaiden
 *             laskemiseen listan alussa, mutta niistä ei raportoida mitään omana asianaan.
 *   kohteet   perehdytyksiä varten
 *   lista     { alku, loppu, jaksot } (tyovuorolista.js: listat)
 *
 * Palauttaa { havainnot, jaksot }. Havainnossa on `vuoroIdt`, jotta käyttöliittymä voi
 * merkitä täsmälleen ne vuorot joita se koskee.
 */
export function tarkistaHenkilo({ henkilo, vuorot, kohteet, asetukset, lista }) {
  const havainnot = [];
  const lisaa = (taso, koodi, viesti, vuoroIdt = []) => havainnot.push({ taso, koodi, viesti, vuoroIdt });

  const alkuMin = paivaksi(lista.alku) / 60000;
  const loppuMin = paivaksi(lista.loppu) / 60000;
  const kaikki = (vuorot || [])
    .map((v) => ({ ...v, a: aikaMin(v.alkaa), l: aikaMin(v.paattyy) }))
    .filter((v) => v.a !== null && v.l !== null)
    .sort((x, y) => x.a - y.a || x.l - y.l);
  const listalla = kaikki.filter((v) => v.a >= alkuMin && v.a < loppuMin);
  const kohdeKartta = new Map((kohteet || []).map((k) => [k?.id, k]));

  // --- Estot: vuorokohtaiset ---------------------------------------------------------

  const ryhma = (ehto) => listalla.filter(ehto).map((v) => v.id);

  const ilmanPerehdytysta = ryhma((v) => !perehdytetytVuorot(kohdeKartta.get(v.siteId), henkilo.username)
    .has(String(v.vuorotyyppiId)));
  if (ilmanPerehdytysta.length) {
    lisaa('este', 'ei_perehdytysta', `Ei perehdytystä ${ilmanPerehdytysta.length === 1 ? 'vuoroon' : `${ilmanPerehdytysta.length} vuoroon`}.`, ilmanPerehdytysta);
  }

  if (henkilo.employmentStart && paivaksi(henkilo.employmentStart) !== null) {
    const ennen = ryhma((v) => v.pvm < henkilo.employmentStart);
    if (ennen.length) lisaa('este', 'tyosuhde', `Työsuhde alkaa vasta ${fi(henkilo.employmentStart)}.`, ennen);
  }
  if (henkilo.employmentType === 'fixed' && paivaksi(henkilo.employmentFixedTo) !== null) {
    const jalkeen = ryhma((v) => v.pvm > henkilo.employmentFixedTo);
    if (jalkeen.length) lisaa('este', 'tyosuhde', `Määräaikainen työsuhde päättyy ${fi(henkilo.employmentFixedTo)}.`, jalkeen);
  }

  // Vartijakortti. Puuttuva kortti on este vain jos vuoroja on — tyhjä lista ei kerro
  // mitään kortista.
  if (listalla.length) {
    const asti = henkilo.hasGuardCard ? korttiVoimassaAsti(henkilo.guardCardValidUntil) : null;
    if (!henkilo.hasGuardCard || !asti) {
      lisaa('este', 'ei_korttia', henkilo.hasGuardCard
        ? 'Vartijakortin voimassaoloa ei ole kirjattu työntekijäpankkiin.'
        : 'Työntekijäpankissa ei ole vartijakorttia.', listalla.map((v) => v.id));
    } else {
      const vanhentunut = ryhma((v) => v.pvm > asti);
      if (vanhentunut.length) {
        lisaa('este', 'kortti_vanhentunut', `Vartijakortti on voimassa ${fi(asti)} asti.`, vanhentunut);
      }
      // Käyttäjän päätös 10.10.2026: varoitus 45 päivää ennen (asetus korttiVaroitusPv).
      const pian = ryhma((v) => v.pvm <= asti && paivia(v.pvm, asti) <= asetukset.korttiVaroitusPv);
      if (pian.length) {
        lisaa('varoitus', 'kortti_vanhenee', `Vartijakortti vanhenee ${fi(asti)} — uusinta on hoidettava ennen sitä.`, pian);
      }
    }
  }

  // --- Peräkkäiset vuorot: päällekkäisyys ja vuorokausilepo -----------------------------
  //
  // Pari raportoidaan jos jälkimmäinen on listalla. Edellisen listan viimeinen vuoro ja
  // tämän ensimmäinen ovat silloin yksi pari, mutta mikään ei raportoidu kahdesti.

  for (let i = 1; i < kaikki.length; i++) {
    const ed = kaikki[i - 1];
    const v = kaikki[i];
    if (v.a < alkuMin || v.a >= loppuMin) continue;
    const vali = v.a - ed.l;
    if (vali < 0) {
      lisaa('este', 'paallekkain', `Päällekkäiset vuorot: ${ed.siteNimi || ed.vuoroNimi} ja ${v.siteNimi || v.vuoroNimi}.`, [ed.id, v.id]);
    } else if (vali < asetukset.vuorokausilepoH * 60) {
      lisaa('poikkeama', 'vuorokausilepo',
        `Lepoaika vuorojen välissä ${tunnit(vali)} h, vaaditaan ${tunnit(asetukset.vuorokausilepoH * 60)} h (TES 15 §).`,
        [ed.id, v.id]);
    }
  }

  // --- Viikoittainen vapaa-aika (TES 16 §) --------------------------------------------
  //
  // Vapaa on vuorojen välinen aukko. Se lasketaan viikolle jolla sen ENIN OSA on (TES 16 §:
  // "kunhan enin osa viikkolevosta sijoittuu sen seitsemän päivän puolelle"). Listan
  // ulkopuolelle jatkuva tuntematon aika lasketaan vain viikon sisäiseltä osaltaan:
  // muuten suunnittelematon tulevaisuus näyttäisi aina riittävältä vapaalta.
  //
  // Jos viikon pisin vapaa jää alle vaatimuksen, kokeillaan 14 vuorokauden keskiarvoa
  // naapuriviikon kanssa, kunhan viikon vapaa on vähintään viikkovapaaMinH.

  const aukot = [];
  for (let i = 0; i <= kaikki.length; i++) {
    aukot.push({
      a: i === 0 ? -Infinity : kaikki[i - 1].l,
      l: i === kaikki.length ? Infinity : kaikki[i].a,
    });
  }
  const viikonVapaa = (ws) => {
    const we = ws + MIN_VK;
    let paras = 0;
    for (const g of aukot) {
      const paallekkain = Math.min(g.l, we) - Math.max(g.a, ws);
      if (paallekkain <= 0) continue;
      const pituus = g.l - g.a;
      const tehollinen = Number.isFinite(pituus)
        ? (paallekkain * 2 >= pituus ? pituus : 0)
        : paallekkain;
      paras = Math.max(paras, tehollinen);
    }
    return paras;
  };
  const vaadittu = asetukset.viikkovapaaH * 60;
  for (let ws = alkuMin; ws < loppuMin; ws += MIN_VK) {
    const viikon = listalla.filter((v) => v.a >= ws && v.a < ws + MIN_VK);
    if (!viikon.length) continue;
    const vapaa = viikonVapaa(ws);
    if (vapaa >= vaadittu) continue;
    const keskiarvoOk = vapaa >= asetukset.viikkovapaaMinH * 60
      && [ws - MIN_VK, ws + MIN_VK].some((n) => (vapaa + viikonVapaa(n)) / 2 >= vaadittu);
    if (keskiarvoOk) continue;
    lisaa('poikkeama', 'viikkovapaa',
      `Viikolla ${fi(pvmMinuuteista(ws))} pisin vapaa on ${tunnit(vapaa)} h, vaaditaan ${asetukset.viikkovapaaH} h yhtäjaksoisesti (TES 16 §).`,
      viikon.map((v) => v.id));
  }

  // --- Vuoroja kahden viikkovapaan välissä (TES 16 § pöytäkirjamerkintä) ---------------
  //
  // Viikkovapaaksi lasketaan vähintään viikkovapaaMinH:n mittainen aukko. Raja on
  // tarkoituksella väljempi kuin varsinainen viikkovapaa: tämä varoitus koskee putken
  // pituutta, ja liian lyhyestä vapaasta on jo oma havaintonsa yllä.
  let putki = [];
  const raportoiPutki = () => {
    if (putki.length > asetukset.vuorojaVapaidenValissa && putki.some((v) => v.a >= alkuMin && v.a < loppuMin)) {
      lisaa('varoitus', 'putki',
        `${putki.length} vuoroa peräkkäin ilman viikkovapaata, enintään ${asetukset.vuorojaVapaidenValissa} (TES 16 §).`,
        putki.filter((v) => v.a >= alkuMin && v.a < loppuMin).map((v) => v.id));
    }
  };
  for (let i = 0; i < kaikki.length; i++) {
    if (i > 0 && kaikki[i].a - kaikki[i - 1].l >= asetukset.viikkovapaaMinH * 60) {
      raportoiPutki();
      putki = [];
    }
    putki.push(kaikki[i]);
  }
  raportoiPutki();

  // --- Pitkä viikonloppu pe 18 – ma 06 (TES 16 §) ----------------------------------------
  //
  // Jokaisessa pitkaViikonloppuVk:n peräkkäisen viikonlopun ikkunassa on oltava yksi
  // vapaa. Listaa edeltävät viikonloput, joilta ei ole vuorotietoa, lasketaan vapaiksi:
  // ennen suunnittelun käyttöönottoa ei voi tietää, eikä arvaus saa tuottaa varoitusta.
  if (listalla.length) {
    const ensimmainenPe = alkuMin + 4 * MIN_PV; // lista alkaa maanantaina
    const viikonloput = [];
    for (let pe = ensimmainenPe - (asetukset.pitkaViikonloppuVk - 1) * MIN_VK; pe < loppuMin; pe += MIN_VK) {
      const a = pe + 18 * 60;
      const l = pe + 3 * MIN_PV + 6 * 60;
      viikonloput.push({ pe, vapaa: !kaikki.some((v) => v.a < l && v.l > a) });
    }
    for (let i = 0; i + asetukset.pitkaViikonloppuVk <= viikonloput.length; i++) {
      const ikkuna = viikonloput.slice(i, i + asetukset.pitkaViikonloppuVk);
      const viimeinen = ikkuna[ikkuna.length - 1];
      if (viimeinen.pe < alkuMin || ikkuna.some((w) => w.vapaa)) continue;
      lisaa('varoitus', 'pitka_viikonloppu',
        `Ei vapaata pitkää viikonloppua (pe 18 – ma 06) ${asetukset.pitkaViikonloppuVk} viikkoon `
        + `${fi(pvmMinuuteista(viimeinen.pe))} mennessä (TES 16 §).`,
        listalla.filter((v) => v.a < viimeinen.pe + 3 * MIN_PV + 6 * 60 && v.l > viimeinen.pe + 18 * 60).map((v) => v.id));
      // Yksi varoitus per putki: seuraavat ikkunat ovat saman vapaan puutteen jatkoa.
      while (i + asetukset.pitkaViikonloppuVk < viikonloput.length && !viikonloput[i + asetukset.pitkaViikonloppuVk].vapaa) i++;
    }
  }

  // --- Jakson tunnit (TES 9 § ja 29 §) ------------------------------------------------

  const jaksot = (lista.jaksot || []).map((j) => {
    const jakson = listalla.filter((v) => v.pvm >= j.alku && v.pvm < j.loppu);
    const min = jakson.reduce((s, v) => s + v.kestoMin, 0);
    return { alku: j.alku, viimeinen: j.viimeinen, tunnit: Math.round(min / 6) / 10, vuoroIdt: jakson.map((v) => v.id) };
  });

  const vahimmais = Number(String(henkilo.minHoursPer3Weeks ?? '').replace(',', '.')) || 0;
  for (const j of jaksot) {
    const jakso = `Jakso ${fi(j.alku)}–${fi(j.viimeinen)}`;
    if (henkilo.workTimeType === 'monthly') {
      if (j.tunnit > JAKSON_ENIMMAIS_H) {
        lisaa('varoitus', 'ylityo', `${jakso}: ${tunnit(j.tunnit * 60)} h. Ylityötä on kaikki yli ${SAANNOLLINEN_H} h, eikä tasoittumisjärjestelykään salli yli ${JAKSON_ENIMMAIS_H} h (TES 9 §).`, j.vuoroIdt);
      } else if (j.tunnit > SAANNOLLINEN_H) {
        lisaa('varoitus', 'ylityo', `${jakso}: ${tunnit(j.tunnit * 60)} h, yli ${SAANNOLLINEN_H} h on ylityötä ellei tasoittumisesta ole merkintää (TES 9 § ja 29 §).`, j.vuoroIdt);
      } else if (j.tunnit < SAANNOLLINEN_H) {
        lisaa('huomio', 'vajaa', `${jakso}: ${tunnit(j.tunnit * 60)} h / ${SAANNOLLINEN_H} h.`, []);
      }
    } else if (henkilo.workTimeType === 'parttime') {
      if (vahimmais > 0 && j.tunnit < vahimmais) {
        lisaa('varoitus', 'alle_vahimman', `${jakso}: ${tunnit(j.tunnit * 60)} h, työsopimuksen vähimmäistyöaika ${tunnit(vahimmais * 60)} h (TES 9 §).`, []);
      }
      if (j.tunnit > SAANNOLLINEN_H) {
        lisaa('varoitus', 'ylityo', `${jakso}: ${tunnit(j.tunnit * 60)} h, yli ${SAANNOLLINEN_H} h on ylityötä (TES 29 §).`, j.vuoroIdt);
      }
    }
  }

  return { havainnot, jaksot };
}

// Tasojen järjestys vakavimmasta lievimpään. Käyttöliittymä järjestää ja värittää tällä.
export const TASOJARJESTYS = ['este', 'poikkeama', 'varoitus', 'huomio'];
