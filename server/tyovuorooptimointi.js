// Työvuorolistan tarkka optimointi (11.10.2026).
//
// Ahne generaattori (tyovuorogeneraattori.js) valitsee vuoro kerrallaan eikä palaa
// taaksepäin, joten se ei osaa tavoitella kokonaisuutta: tasan 120 tunnin jaksoja,
// pitkien viikonloppujen kiertoa ja kattavuutta yhtä aikaa. Tämä moduuli muotoilee koko
// listan yhdeksi kokonaislukuoptimoinniksi ja ratkaisee sen HiGHS-ratkaisijalla.
//
// Alun perin suunniteltiin OR-Toolsin CP-SAT:ia, mutta se vaatii Pythonin palvelimelle.
// HiGHS (MIT, WebAssembly, ei riippuvuuksia) ratkaisee saman mallin Node-prosessissa ja
// antaa yhtä lailla todistetun optimin tai aikarajan täyttyessä parhaan löydetyn.
//
// --- Mitä malli takaa ----------------------------------------------------------------------
//
// Samat ehdottomat rajat kuin ahneella generaattorilla: ei estettä, ei TES-poikkeamaa, ei
// yli 120 tunnin jaksoa, ei jo sijoitettuihin eikä alkaneisiin vuoroihin, ei reserviä.
// Rajat on mallissa suoraan (lepoaika vuoroparien välillä, viikkovapaa 30 h ikkunoina,
// jakson tuntikatto), ja lopuksi jokainen henkilö tarkistetaan vielä tavallisella
// tarkistuksella (tyoaikatarkistus.js). Jos tarkistus löytää jotain mitä malli ei
// tuntenut, kyseinen yhdistelmä kielletään ja ratkaistaan uudelleen. Tarkistus on siis
// totuus, malli vain nopea tapa löytää ratkaisu joka läpäisee sen.
//
// Viikkovapaa mallinnetaan tiukemmin kuin TES vaatii: jokaisella viikolla on oltava
// yhtäjaksoinen 30 tunnin vapaa, jonka enin osa on viikolla. 14 vuorokauden keskiarvoa
// (TES 16 §) malli ei käytä — se on poikkeusjoustoa, ei suunnittelun lähtökohta.
//
// --- Mitä tavoitellaan (tärkein ensin) -----------------------------------------------------
//
//   1. jokainen vuoro täytetty
//   2. pitkä vapaa viikonloppu (pe 18 – ma 06) jokaisessa neljän viikon ikkunassa, myös
//      edellisten listojen viikonloput huomioiden — tästä syntyy kierto listalta toiselle
//   3. osa-aikaisten sopimuksen vähimmäistyöaika
//   4. osa-aikaisten lisätunnit vasta kun kuukausipalkkaisille ei mahdu (sovittu 120 h
//      maksetaan joka tapauksessa, käyttäjän päätös 11.10.2026)
//   5. kuukausipalkkaiset tasan 120 tuntiin järjestyksessä (aakkosjärjestys, myöhemmin
//      kohdeprosentti)
//   6. toiveet, sitten yö- ja viikonloppuvuorojen tasaisuus
//
// Painot ovat niin kaukana toisistaan, että järjestys on käytännössä ehdoton.

import { Worker } from 'node:worker_threads';
import { tarkistaHenkilo, aikaMin } from './tyoaikatarkistus.js';
import { perehdytetytVuorot } from './vuorot.js';
import { SAANNOLLINEN_H, paivaksi } from './tyovuorolista.js';
import { laskeEhdotus } from './tyovuorogeneraattori.js';

const MIN_PV = 24 * 60;
const MIN_VK = 7 * MIN_PV;

export const PAINOT = {
  avoin: 100000,
  pitkaViikonloppu: 3000,
  // Ennakointi seuraavalle listalle: viikonloput listan jälkeen lasketaan työviikonlopuiksi.
  // Jos joku päättää listan kolmeen työviikonloppuun, seuraavan listan ensimmäinen on
  // pakko antaa hänelle vapaaksi — ja kun niin käy monelle yhtä aikaa, viikonloppua ei
  // saa miehitettyä (simulaatio 11.10.2026: neljä varoitusta saman listan alussa).
  pitkaViikonloppuEnnakko: [1000, 100],
  alleVahimman: 1000, // tunnilta
  lisatyo: 300, // tunnilta
  taysi: 400, // kuukausipalkkaisen jakso tasan 120 h, + järjestysbonus
  toiveVapaa: 120,
  toiveVuoro: -15,
  tasaisuus: 3,
};

const onYovuoro = (v) => Number(v.alkaa.slice(11, 13)) >= 20 || Number(v.alkaa.slice(11, 13)) < 4;
const onViikonloppu = (v) => {
  const vp = new Date(`${v.pvm}T00:00:00Z`).getUTCDay();
  return vp === 0 || vp === 6;
};

function vahimmais(henkilo) {
  return Number(String(henkilo.minHoursPer3Weeks ?? '').replace(',', '.')) || 0;
}

const pyorista = (x) => Math.round(x * 1e6) / 1e6;

// LP-tiedoston lauseke: [[kerroin, nimi], ...] -> "+ 2 x1 - 0.5 x2", rivitettynä.
function lauseke(termit) {
  const osat = [];
  for (const [k, n] of termit) {
    const kk = pyorista(k);
    if (kk === 0) continue;
    osat.push(`${kk < 0 ? '-' : '+'} ${Math.abs(kk)} ${n}`);
  }
  if (!osat.length) return '0 dummy';
  const rivit = [];
  for (let i = 0; i < osat.length; i += 12) rivit.push(osat.slice(i, i + 12).join(' '));
  return rivit.join('\n  ');
}

/**
 * Rakentaa mallin. Puhdas funktio: palauttaa LP-tekstin ja tiedot ratkaisun tulkintaan.
 * Erillään ratkaisusta, jotta mallia voi testata ilman ratkaisijaa.
 */
export function rakennaMalli({
  tietue, lista, vuorot, listanVuorot, henkilot, kohteet, asetukset, muutSijoitukset,
  poissaolot = [], toiveet = [], nytPaikallinen, prioriteetti = null, kiellot = [],
}) {
  const sijoitetut = new Set((tietue?.sijoitukset || []).map((s) => s.vuoroId));
  const avoimet = [...listanVuorot.values()]
    .filter((v) => !sijoitetut.has(v.id) && (!nytPaikallinen || v.alkaa > nytPaikallinen))
    .map((v) => ({ ...v, a: aikaMin(v.alkaa), l: aikaMin(v.paattyy) }))
    .filter((v) => v.a !== null && v.l !== null)
    .sort((x, y) => x.a - y.a || x.id.localeCompare(y.id));
  const kohdeKartta = new Map((kohteet || []).map((k) => [k?.id, k]));
  const sijoitettavat = henkilot.filter((h) => h.workTimeType !== 'oncall');
  const jarjestysLista = Array.isArray(prioriteetti) && prioriteetti.length
    ? prioriteetti
    : [...sijoitettavat].sort((a, b) => String(a.nimi || a.username).localeCompare(String(b.nimi || b.username), 'fi')).map((h) => h.username);

  const kiinteat = new Map(sijoitettavat.map((h) => [h.username, []]));
  for (const s of [...(muutSijoitukset || []), ...(tietue?.sijoitukset || [])]) {
    const v = vuorot.get(s.vuoroId);
    if (v && kiinteat.has(s.username)) kiinteat.get(s.username).push(v);
  }
  const omatPoissaolot = (u) => poissaolot.filter((p) => p.username === u);
  const omatToiveet = (u) => toiveet.filter((t) => t.username === u);
  const tarkista = (h, vuorolista) => tarkistaHenkilo({
    henkilo: h, vuorot: vuorolista, kohteet, asetukset, lista,
    poissaolot: omatPoissaolot(h.username), toiveet: omatToiveet(h.username),
  });

  const alkuMin = paivaksi(lista.alku) / 60000;
  const loppuMin = paivaksi(lista.loppu) / 60000;
  const lepo = asetukset.vuorokausilepoH * 60;
  const vuoronMax = asetukset.vuoronMaxH * 60;
  const viikkovapaa = asetukset.viikkovapaaH * 60;

  const x = []; // { nimi, h, v }
  const perehdytettyja = new Map(avoimet.map((v) => [v.id, 0]));
  const rajoitteet = [];
  const objektiivi = [];
  const binaarit = [];
  const jatkuvat = [];
  let laskuri = 0;
  const uusi = (etuliite, binaari = true) => {
    const n = `${etuliite}${laskuri++}`;
    (binaari ? binaarit : jatkuvat).push(n);
    return n;
  };

  const kielletyt = new Set(kiellot.filter((k) => k.vuoroIdt.length === 1).map((k) => `${k.username}|${k.vuoroIdt[0]}`));

  // --- Muuttujat: kelvolliset (henkilö, vuoro) -parit -----------------------------------
  const henkilonX = new Map(sijoitettavat.map((h) => [h.username, []]));
  const pohja = new Map();
  for (const h of sijoitettavat) {
    const omat = kiinteat.get(h.username);
    pohja.set(h.username, tarkista(h, omat).jaksot);
    for (const v of avoimet) {
      if (!perehdytetytVuorot(kohdeKartta.get(v.siteId), h.username).has(String(v.vuorotyyppiId))) continue;
      perehdytettyja.set(v.id, perehdytettyja.get(v.id) + 1);
      if (kielletyt.has(`${h.username}|${v.id}`)) continue;
      const { havainnot, jaksot } = tarkista(h, [...omat, v]);
      if (havainnot.some((o) => o.vuoroIdt.includes(v.id) && (o.taso === 'este' || o.taso === 'poikkeama'))) continue;
      const jakso = jaksot.find((j) => v.pvm >= j.alku && v.pvm <= j.viimeinen);
      if (jakso && jakso.tunnit > SAANNOLLINEN_H) continue;
      const nimi = uusi('x');
      const rivi = { nimi, h, v };
      x.push(rivi);
      henkilonX.get(h.username).push(rivi);
    }
  }

  // --- Kattavuus ------------------------------------------------------------------------
  const vuoronX = new Map(avoimet.map((v) => [v.id, []]));
  for (const r of x) vuoronX.get(r.v.id).push(r);
  for (const v of avoimet) {
    const rivit = vuoronX.get(v.id);
    if (!rivit.length) continue;
    if (rivit.length > 1) rajoitteet.push(`${lauseke(rivit.map((r) => [1, r.nimi]))} <= 1`);
    const u = uusi('u', false);
    rajoitteet.push(`${lauseke([[1, u], ...rivit.map((r) => [1, r.nimi])])} >= 1`);
    objektiivi.push([PAINOT.avoin, u]);
  }

  // --- Symmetrian katkaisu ----------------------------------------------------------------
  // Samanaikaiset samanlaiset vuorot (Yö vartija paikat 1 ja 2, Ilta vartija 1 ja 2) ovat
  // ratkaisijalle eri vuoroja, ja se kävisi läpi jokaisen ratkaisun myös peilikuvana.
  // Kun vuoroilla on sama kohde, sama aika ja samat kelvolliset tekijät, niiden tekijät
  // järjestetään: ensimmäiseen se, joka on aakkosissa edellä. Vaihto ei muuta mitään
  // muuta, joten optimi säilyy.
  const ryhmat = new Map();
  for (const v of avoimet) {
    const rivit = vuoronX.get(v.id);
    if (rivit.length < 2) continue;
    const avain = `${v.siteId}|${v.a}|${v.l}|${rivit.map((r) => r.h.username).sort().join(',')}`;
    if (!ryhmat.has(avain)) ryhmat.set(avain, []);
    ryhmat.get(avain).push(v);
  }
  for (const ryhma of ryhmat.values()) {
    for (let i = 0; i + 1 < ryhma.length; i++) {
      const ens = new Map(vuoronX.get(ryhma[i].id).map((r) => [r.h.username, r.nimi]));
      const toi = new Map(vuoronX.get(ryhma[i + 1].id).map((r) => [r.h.username, r.nimi]));
      const nimet = [...ens.keys()].sort();
      for (let k = 1; k <= nimet.length; k++) {
        const etu = nimet.slice(0, k);
        rajoitteet.push(`${lauseke([...etu.map((u) => [1, toi.get(u)]), ...etu.map((u) => [-1, ens.get(u)])])} <= 0`);
      }
    }
  }

  const jarjestysNumero = (u) => {
    const i = jarjestysLista.indexOf(u);
    return i < 0 ? jarjestysLista.length : i;
  };
  const kuukausipalkkaiset = sijoitettavat.filter((h) => h.workTimeType === 'monthly').length || 1;
  const yoKatto = uusi('yo', false);
  const vlKatto = uusi('vl', false);
  objektiivi.push([PAINOT.tasaisuus, yoKatto], [PAINOT.tasaisuus, vlKatto]);

  for (const h of sijoitettavat) {
    const omat = henkilonX.get(h.username);
    const kiinteaLista = kiinteat.get(h.username).map((v) => ({ ...v, a: aikaMin(v.alkaa), l: aikaMin(v.paattyy) }));

    // Kiellot joita mallin omat rajat eivät tunteneet (tarkistuksen löydöt edelliseltä
    // kierrokselta): yhdistelmää ei saa valita kokonaan.
    for (const k of kiellot) {
      if (k.username !== h.username || k.vuoroIdt.length < 2) continue;
      const rivit = omat.filter((r) => k.vuoroIdt.includes(r.v.id));
      if (rivit.length === k.vuoroIdt.length) {
        rajoitteet.push(`${lauseke(rivit.map((r) => [1, r.nimi]))} <= ${rivit.length - 1}`);
      }
    }

    // --- Lepoaika ja päällekkäisyys vuoroparien välillä (TES 15 §) -----------------------
    // Välittömästi peräkkäiset vuorot ovat yksi pidennetty vuoro: sallittu jos yhteensä
    // enintään tavallinen enimmäispituus.
    for (let i = 0; i < omat.length; i++) {
      for (let j = i + 1; j < omat.length; j++) {
        const [s, t] = omat[i].v.a <= omat[j].v.a ? [omat[i].v, omat[j].v] : [omat[j].v, omat[i].v];
        if (t.a >= s.l + lepo) continue;
        if (t.a === s.l && t.l - s.a <= vuoronMax) continue;
        rajoitteet.push(`${lauseke([[1, omat[i].nimi], [1, omat[j].nimi]])} <= 1`);
      }
    }

    // --- Viikkovapaa (TES 16 §) -------------------------------------------------------
    // Jokaiselle viikolle valitaan yksi 30 tunnin ikkuna, jonka enin osa on viikolla ja
    // jossa ei ole vuoroja. Ehdokasikkunat alkavat vuoron päättymisestä tai viikon alusta:
    // mikä tahansa vapaa ikkuna voidaan siirtää alkamaan jommastakummasta.
    for (let ws = alkuMin; ws < loppuMin; ws += MIN_VK) {
      const we = ws + MIN_VK;
      const viikolla = omat.filter((r) => r.v.a >= ws && r.v.a < we);
      if (!viikolla.length) continue;
      const alin = ws - viikkovapaa / 2;
      const ylin = we - viikkovapaa / 2;
      const alut = new Set([alin]);
      for (const v of [...kiinteaLista, ...omat.map((r) => r.v)]) if (v.l >= alin && v.l <= ylin) alut.add(v.l);
      const ikkunat = [];
      let vapaaIlmanMuuttujia = false;
      for (const t of alut) {
        const loppu = t + viikkovapaa;
        if (kiinteaLista.some((v) => v.a < loppu && v.l > t)) continue;
        const osuvat = omat.filter((r) => r.v.a < loppu && r.v.l > t);
        if (!osuvat.length) { vapaaIlmanMuuttujia = true; break; }
        ikkunat.push(osuvat);
      }
      if (vapaaIlmanMuuttujia) continue;
      if (!ikkunat.length) {
        rajoitteet.push(`${lauseke(viikolla.map((r) => [1, r.nimi]))} <= 0`);
        continue;
      }
      const valinnat = [];
      for (const osuvat of ikkunat) {
        const r = uusi('r');
        valinnat.push([1, r]);
        for (const o of osuvat) rajoitteet.push(`${lauseke([[1, o.nimi], [1, r]])} <= 1`);
      }
      rajoitteet.push(`${lauseke(valinnat)} >= 1`);
    }

    // --- Pitkä viikonloppu pe 18 – ma 06 (TES 16 §) ------------------------------------
    // Sama ikkunointi kuin tarkistuksessa: edelliset viikonloput lasketaan mukaan, ja
    // viikonloppu jolta ei ole tietoa on vapaa. Lisäksi ennakko: kaksi listan jälkeistä
    // viikonloppua lasketaan työviikonlopuiksi kevyemmällä painolla (PAINOT).
    const vk = asetukset.pitkaViikonloppuVk;
    const viikonloput = [];
    const tulevat = PAINOT.pitkaViikonloppuEnnakko.length;
    for (let pe = alkuMin + 4 * MIN_PV - (vk - 1) * MIN_VK; pe < loppuMin + tulevat * MIN_VK; pe += MIN_VK) {
      if (pe >= loppuMin) { viikonloput.push({ pe, tila: 'tuleva' }); continue; }
      const a = pe + 18 * 60;
      const l = pe + 3 * MIN_PV + 6 * 60;
      const varattu = kiinteaLista.some((v) => v.a < l && v.l > a);
      const osuvat = varattu ? [] : omat.filter((r) => r.v.a < l && r.v.l > a);
      if (varattu) viikonloput.push({ pe, tila: 'varattu' });
      else if (!osuvat.length) viikonloput.push({ pe, tila: 'vapaa' });
      else {
        const y = uusi('y');
        for (const o of osuvat) rajoitteet.push(`${lauseke([[1, o.nimi], [1, y]])} <= 1`);
        viikonloput.push({ pe, tila: 'muuttuja', y });
      }
    }
    for (let i = 0; i + vk <= viikonloput.length; i++) {
      const ikkuna = viikonloput.slice(i, i + vk);
      if (ikkuna[ikkuna.length - 1].pe < alkuMin) continue;
      if (ikkuna.some((w) => w.tila === 'vapaa')) continue;
      const ym = ikkuna.filter((w) => w.tila === 'muuttuja');
      if (!ym.length) continue;
      const tulevia = ikkuna.filter((w) => w.tila === 'tuleva').length;
      const paino = tulevia ? PAINOT.pitkaViikonloppuEnnakko[tulevia - 1] : PAINOT.pitkaViikonloppu;
      if (!paino) continue;
      const puute = uusi('p', false);
      rajoitteet.push(`${lauseke([...ym.map((w) => [1, w.y]), [1, puute]])} >= 1`);
      objektiivi.push([paino, puute]);
    }

    // --- Jakson tunnit ------------------------------------------------------------------
    const jarj = jarjestysNumero(h.username);
    for (const j of lista.jaksot || []) {
      const jaksossa = omat.filter((r) => r.v.pvm >= j.alku && r.v.pvm < j.loppu);
      if (!jaksossa.length) continue;
      const pohjaTunnit = (pohja.get(h.username).find((p) => p.alku === j.alku)?.tunnit) || 0;
      const tilaa = Math.max(0, SAANNOLLINEN_H - pohjaTunnit);
      const tunnit = jaksossa.map((r) => [r.v.kestoMin / 60, r.nimi]);
      rajoitteet.push(`${lauseke(tunnit)} <= ${pyorista(tilaa)}`);
      if (h.workTimeType === 'monthly') {
        // Järjestyksen alkupää ensin: tunti aiemmalle on hieman arvokkaampi, ja täysi
        // jakso saa bonuksen joka on suurempi aiemmalle.
        const tuntipaino = 1 + (kuukausipalkkaiset - Math.min(jarj, kuukausipalkkaiset)) / kuukausipalkkaiset;
        for (const [k, n] of tunnit) objektiivi.push([-tuntipaino * k, n]);
        if (tilaa > 0) {
          const f = uusi('f');
          rajoitteet.push(`${lauseke([...tunnit, [-tilaa, f]])} >= 0`);
          objektiivi.push([-(PAINOT.taysi + 10 * Math.max(0, kuukausipalkkaiset - jarj)), f]);
        }
      } else {
        const minimi = vahimmais(h);
        const tarve = Math.max(0, minimi - pohjaTunnit);
        // alle: vaje minimistä, yli: tunnit minimin yli.
        const alle = uusi('a', false);
        const yli = uusi('e', false);
        rajoitteet.push(`${lauseke([...tunnit, [1, alle]])} >= ${pyorista(tarve)}`);
        rajoitteet.push(`${lauseke([...tunnit, [-1, yli]])} <= ${pyorista(tarve)}`);
        objektiivi.push([PAINOT.alleVahimman, alle], [PAINOT.lisatyo, yli]);
      }
    }

    // --- Toiveet ja tasaisuus ------------------------------------------------------------
    const toiveetPaivittain = new Map(omatToiveet(h.username).map((t) => [t.pvm, t.laji]));
    for (const r of omat) {
      const t = toiveetPaivittain.get(r.v.pvm);
      if (t === 'vapaa' || t === 'este') objektiivi.push([PAINOT.toiveVapaa, r.nimi]);
      else if (t === 'vuoro') objektiivi.push([PAINOT.toiveVuoro, r.nimi]);
    }
    const listalla = (v) => v.pvm >= lista.alku && v.pvm <= lista.viimeinen;
    const kiinteitaYo = kiinteaLista.filter((v) => listalla(v) && onYovuoro(v)).length;
    const kiinteitaVl = kiinteaLista.filter((v) => listalla(v) && onViikonloppu(v)).length;
    const yot = omat.filter((r) => onYovuoro(r.v));
    const vlt = omat.filter((r) => onViikonloppu(r.v));
    if (yot.length) rajoitteet.push(`${lauseke([...yot.map((r) => [1, r.nimi]), [-1, yoKatto]])} <= ${-kiinteitaYo}`);
    if (vlt.length) rajoitteet.push(`${lauseke([...vlt.map((r) => [1, r.nimi]), [-1, vlKatto]])} <= ${-kiinteitaVl}`);
  }

  const lp = [
    'Minimize',
    ` obj: ${lauseke(objektiivi)}`,
    'Subject To',
    ...rajoitteet.map((r, i) => ` c${i}: ${r}`),
    'Bounds',
    ' dummy = 0',
    ...jatkuvat.map((n) => ` ${n} >= 0`),
    'Binary',
    ...binaarit.map((n) => ` ${n}`),
    'End',
  ].join('\n');

  return { lp, x, avoimet, perehdytettyja, sijoitettavat, kiinteat, tarkista };
}

let highsLupaus = null;

// Palauttaa { tila, arvot: Map(nimi -> arvo) } annetuille muuttujille. Aloitusratkaisu
// (muuttujien nimet joiden arvo on 1) annetaan ratkaisijalle vihjeenä: se aloittaa siitä
// eikä tyhjästä, joten tulos ei voi olla vihjettä huonompi.
async function ratkaise(lp, aikarajaS, nimet, aloitus = []) {
  if (!highsLupaus) highsLupaus = import('highs').then(({ default: lataa }) => lataa());
  const highs = await highsLupaus;
  const malli = highs.createModel();
  try {
    malli.readModel({ format: 'lp', data: lp });
    malli.options.set({
      time_limit: Math.max(1, aikarajaS),
      mip_rel_gap: 1e-6,
      output_flag: false,
      log_to_console: false,
    });
    const indeksit = new Map(nimet.map((n) => [n, malli.getColByName(n)]));
    if (aloitus.length) {
      const ykkoset = new Set(aloitus);
      const pari = nimet.map((n) => [indeksit.get(n), ykkoset.has(n) ? 1 : 0]).sort((a, b) => a[0] - b[0]);
      try {
        malli.setSolution({ indices: pari.map((p) => p[0]), values: pari.map((p) => p[1]) });
      } catch { /* kelpaamaton vihje ei estä ratkaisua */ }
    }
    malli.run();
    const tilat = highs.constants.modelStatus || {};
    const koodi = malli.getModelStatus();
    const tila = koodi === tilat.optimal ? 'optimi' : koodi === tilat.timeLimit ? 'aikaraja' : String(koodi);
    const arvot = new Map();
    try {
      const { colValue } = malli.getSolution();
      for (const [n, i] of indeksit) arvot.set(n, colValue[i]);
    } catch { /* ei ratkaisua */ }
    return { tila, arvot };
  } finally {
    malli.dispose();
  }
}

/**
 * Optimoitu ehdotus avoimiin vuoroihin. Sama syöte ja sama paluumuoto kuin
 * tyovuorogeneraattori.js: laskeEhdotus, lisäksi `optimi` jossa ratkaisun tiedot.
 */
export async function laskeOptimi(syote, { aikarajaS = 35, kierroksia = 8 } = {}) {
  const alkoi = Date.now();
  const kiellot = [];
  let malli;
  let valitut = [];
  let tila = '';
  let kierros = 0;
  let loydot = [];
  for (; kierros < kierroksia; kierros++) {
    malli = rakennaMalli({ ...syote, kiellot });
    const jaljella = aikarajaS - (Date.now() - alkoi) / 1000;
    if (jaljella < 1 && kierros > 0) break;
    // Aloitusratkaisu: ensimmäisellä kierroksella ahne generaattori, sen jälkeen edellinen
    // ratkaisu ilman kiellettyjä yhdistelmiä.
    const aloitus = kierros === 0 ? ahneAloitus(syote, malli) : valitut.map((r) => malli.x.find((y) => y.h.username === r.h.username && y.v.id === r.v.id)?.nimi).filter(Boolean);
    const tulos = await ratkaise(malli.lp, jaljella, malli.x.map((r) => r.nimi), aloitus);
    tila = tulos.tila;
    valitut = malli.x.filter((r) => (tulos.arvot.get(r.nimi) ?? 0) > 0.5);

    // Tarkistus on totuus: kielletään mallin ohi päässeet yhdistelmät ja ratkaistaan uudelleen.
    loydot = tarkistaValinnat(malli, valitut);
    if (!loydot.length) break;
    for (const l of loydot) kiellot.push(l);
  }

  // Jos kierrokset loppuivat kesken, jätetään ristiriitaiset vuorot pois — ehdotukseen ei
  // saa jäädä estettä eikä poikkeamaa.
  if (loydot.length) {
    const pois = new Set(loydot.map((l) => `${l.username}|${l.vuoroIdt[l.vuoroIdt.length - 1]}`));
    valitut = valitut.filter((r) => !pois.has(`${r.h.username}|${r.v.id}`));
    // Toinen kierros varmuuden vuoksi: poiston jälkeenkin voi jäädä ketju.
    for (let i = 0; i < 5; i++) {
      const jaljella = tarkistaValinnat(malli, valitut);
      if (!jaljella.length) break;
      const p2 = new Set(jaljella.map((l) => `${l.username}|${l.vuoroIdt[l.vuoroIdt.length - 1]}`));
      valitut = valitut.filter((r) => !p2.has(`${r.h.username}|${r.v.id}`));
    }
  }

  const ehdotus = valitut
    .map((r) => ({ vuoroId: r.v.id, username: r.h.username, pisteet: 0 }))
    .sort((a, b) => a.vuoroId.localeCompare(b.vuoroId));
  const taytetyt = new Set(ehdotus.map((e) => e.vuoroId));
  const kelvollisia = new Map();
  for (const r of malli.x) kelvollisia.set(r.v.id, (kelvollisia.get(r.v.id) || 0) + 1);
  const avoimiksi = malli.avoimet.filter((v) => !taytetyt.has(v.id)).map((v) => ({
    vuoroId: v.id,
    syy: !malli.perehdytettyja.get(v.id)
      ? 'Kukaan ei ole perehdytetty tähän vuoroon.'
      : !kelvollisia.get(v.id)
        ? `Jokaiselle perehdytetylle tulisi este, TES-poikkeama tai yli ${SAANNOLLINEN_H} h jakso.`
        : `Ei mahdu kenellekään muiden vuorojen lisäksi ilman estettä, TES-poikkeamaa tai yli ${SAANNOLLINEN_H} h jaksoa.`,
  }));
  const alkuVuoro = new Map(malli.avoimet.map((v) => [v.id, v.alkaa]));
  ehdotus.sort((a, b) => alkuVuoro.get(a.vuoroId).localeCompare(alkuVuoro.get(b.vuoroId)));
  avoimiksi.sort((a, b) => alkuVuoro.get(a.vuoroId).localeCompare(alkuVuoro.get(b.vuoroId)));

  return {
    ehdotus,
    avoimiksi,
    optimi: {
      tila,
      kierroksia: kierros + 1,
      sekuntia: Math.round((Date.now() - alkoi) / 100) / 10,
      muuttujia: malli.x.length,
    },
  };
}

// Ahneen generaattorin keskitetty ehdotus mallin muuttujiksi. Ahne ei tunne mallin
// tiukempaa viikkovapaata, joten vihje voi olla mallille kelpaamaton — silloin ratkaisija
// ohittaa sen.
function ahneAloitus(syote, malli) {
  try {
    const { ehdotus } = laskeEhdotus({ ...syote, tapa: 'keskitetty' });
    const nimi = new Map(malli.x.map((r) => [`${r.h.username}|${r.v.id}`, r.nimi]));
    return ehdotus.map((e) => nimi.get(`${e.username}|${e.vuoroId}`)).filter(Boolean);
  } catch {
    return [];
  }
}

// Havainnot joita ehdotukseen ei saa jäädä: este, poikkeama, putki (yli yhdeksän vuoroa
// ilman viikkovapaata) ja ylityö. Palauttaa kiellot: henkilö ja ne UUDET vuorot joiden
// yhdistelmä havainnon aiheutti.
function tarkistaValinnat(malli, valitut) {
  const kiellot = [];
  const henkiloittain = new Map();
  for (const r of valitut) {
    if (!henkiloittain.has(r.h.username)) henkiloittain.set(r.h.username, { h: r.h, rivit: [] });
    henkiloittain.get(r.h.username).rivit.push(r);
  }
  for (const { h, rivit } of henkiloittain.values()) {
    const uudet = new Set(rivit.map((r) => r.v.id));
    const { havainnot } = malli.tarkista(h, [...malli.kiinteat.get(h.username), ...rivit.map((r) => r.v)]);
    for (const o of havainnot) {
      const vakava = o.taso === 'este' || o.taso === 'poikkeama' || o.koodi === 'putki' || o.koodi === 'ylityo';
      if (!vakava) continue;
      const idt = o.vuoroIdt.filter((id) => uudet.has(id));
      if (!idt.length) continue;
      kiellot.push({ username: h.username, vuoroIdt: idt, koodi: o.koodi });
    }
  }
  return kiellot;
}

// --- Ajo taustasäikeessä ------------------------------------------------------------------
//
// Ratkaisu vie sekunteja ja WebAssembly on synkroninen: pääsäikeessä se pysäyttäisi koko
// palvelimen, myös hälytykset. Siksi ratkaisu ajetaan worker-säikeessä, ja kerrallaan vain
// yksi (palvelimella on 2 Gt muistia).

let kaynnissa = false;

export function optimoiTaustalla(syote, { aikarajaS = 35 } = {}) {
  if (kaynnissa) return Promise.resolve({ ok: false, varattu: true });
  kaynnissa = true;
  return new Promise((resolve) => {
    const tyo = new Worker(new URL('./tyovuorooptimointi.tyo.js', import.meta.url), {
      workerData: { syote, aikarajaS },
      resourceLimits: { maxOldGenerationSizeMb: 512 },
    });
    let valmis = false;
    const lopeta = (arvo) => {
      if (valmis) return;
      valmis = true;
      kaynnissa = false;
      clearTimeout(vahti);
      tyo.terminate().catch(() => {});
      resolve(arvo);
    };
    const vahti = setTimeout(() => lopeta({ ok: false, virhe: 'Optimointi ei valmistunut ajassa.' }), (aikarajaS + 20) * 1000);
    tyo.once('message', (viesti) => lopeta(viesti));
    tyo.once('error', (e) => lopeta({ ok: false, virhe: String(e?.message || e) }));
    tyo.once('exit', (koodi) => lopeta({ ok: false, virhe: `Optimointi päättyi (koodi ${koodi}).` }));
  });
}
