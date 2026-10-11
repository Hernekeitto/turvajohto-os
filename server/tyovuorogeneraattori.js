// Työvuorolistan generaattori: "täytä avoimet" (erä 7, 10.10.2026).
//
// Generaattori EHDOTTAA, suunnittelija päättää. Ehdotus lasketaan tallentamatta mitään,
// näytetään ruudukossa ja hyväksytään erikseen — jolloin jokainen sijoitus tarkistetaan
// vielä kerran tavallisella tiellä (tyovuorolistat.js: sijoita).
//
// --- Mitä generaattori ei koskaan tee ---------------------------------------------------
//
// Se ei sijoita ketään, jolle syntyisi este TAI TES-poikkeama. Poikkeama vaatii kirjatun
// syyn, ja syy on ihmisen sopimus ("sovittu Virtasen kanssa") — kone ei voi kirjoittaa
// sitä kenenkään puolesta. Vuoro, jota ei voi täyttää ilman poikkeamaa, jää avoimeksi ja
// sen syy kerrotaan.
//
// Se ei koske jo sijoitettuihin vuoroihin eikä alkaneisiin vuoroihin, eikä se sijoita
// työvoimareserviä (reservi kuittaa itse, käyttäjän päätös 10.10.2026).
//
// Se ei teetä ylityötä: kenenkään jakso ei ylitä 120 tuntia generaattorin ehdotuksista.
// Ylityö vaatii työntekijän suostumuksen (työaikalaki 17 §), joten sekin on ihmisen
// sopimus. Ensimmäinen koeajo 10.10.2026 ilman tätä rajaa antoi 160 tunnin jaksoja, kun
// vuoroja oli enemmän kuin tunteja — piste-ero ei riitä rajaksi, kun vaihtoehtoja ei ole.
//
// --- Miten valitaan ----------------------------------------------------------------------
//
// Ahne algoritmi: vuorot käydään läpi vaikeimmasta alkaen (vähiten kelvollisia ehdokkaita),
// ja kuhunkin valitaan pienimmän pistemäärän ehdokas. Pisteet:
//
//   vähimmäistyöaika osa-aikainen jonka sopimuksen minimi ei täyty menee aina edelle
//   tuntivaje        jakson tavoitteesta puuttuva OSUUS vähentää pisteitä: vajaa
//                    jakso täytetään ensin (kuukausipalkka 120 h, osa-aikainen sopimuksen
//                    vähimmäistyöaika)
//   toive           "toivon vuoroa" pienentää, "toivon vapaata"/"en pääse" kasvattaa
//                    paljon — toive on varoitus eikä este, mutta generaattori kunnioittaa sitä
//   varoitukset      jokainen vuoroa koskeva varoitus (putki, pitkä viikonloppu, kortti)
//   tasapuolisuus    jo saadut yö- ja viikonloppuvuorot kasvattavat pisteitä samanlaisessa
//                    vuorossa (TES 10 § soveltamisohje: vuorot jakautuvat tasapuolisesti)
//   jatkuvuus        sama kohde edellisenä päivänä pienentää hieman
//
// Tasapelissä ratkaisee tunnus aakkosjärjestyksessä, jotta sama syöte antaa aina saman
// ehdotuksen — muuten "laske uudelleen" vaihtaisi ihmisiä ilman syytä.

import { tarkistaHenkilo } from './tyoaikatarkistus.js';
import { perehdytetytVuorot } from './vuorot.js';
import { SAANNOLLINEN_H } from './tyovuorolista.js';

const PISTEET = {
  // Täysin tyhjä jakso. Vaje lasketaan osuutena omasta tavoitteesta, jotta osa-aikaisen
  // 60 h ja kuukausipalkkaisen 120 h täyttyvät samassa tahdissa (koeajo 10.10.2026:
  // tunteina laskettu vaje täytti ensin kuukausipalkkaiset ja jätti osa-aikaisen alle
  // sopimuksen vähimmäistyöajan).
  tuntivaje: -100,
  // Osa-aikainen jonka sopimuksen vähimmäistyöaika ei vielä täyty menee aina edelle
  // (käyttäjän päätös 11.10.2026). Vähimmäistyöaika on sopimuksessa luvattu, mutta
  // kuukausipalkkainen saa palkkansa vajaallakin jaksolla. Ilman tätä vaje jaettiin
  // tasan, ja koeajossa kaikki kolme osa-aikaista jäivät alle miniminsä (40/48, 73/80,
  // 56/60). Arvo on suurempi kuin tyhjän jakson koko tuntivaje, joten järjestys on
  // ehdoton eikä pisteiden painotus.
  vahimmaistyoaika: -200,
  toiveVuoro: -15,
  toiveVapaa: 120,
  varoitus: 20,
  tasapuolisuus: 6,
  jatkuvuus: -4,
};

const onYovuoro = (v) => Number(v.alkaa.slice(11, 13)) >= 20 || Number(v.alkaa.slice(11, 13)) < 4;
const onViikonloppu = (v) => {
  const vp = new Date(`${v.pvm}T00:00:00Z`).getUTCDay();
  return vp === 0 || vp === 6;
};

function tavoite(henkilo) {
  if (henkilo.workTimeType === 'monthly') return SAANNOLLINEN_H;
  if (henkilo.workTimeType === 'parttime') {
    return Number(String(henkilo.minHoursPer3Weeks ?? '').replace(',', '.')) || 0;
  }
  return 0;
}

/**
 * Ehdotus avoimiin vuoroihin. Ei muuta mitään.
 *
 * Palauttaa { ehdotus: [{ vuoroId, username, pisteet }], avoimiksi: [{ vuoroId, syy }] }.
 */
export function laskeEhdotus({
  tietue, lista, vuorot, listanVuorot, henkilot, kohteet, asetukset, muutSijoitukset,
  poissaolot = [], toiveet = [], nytPaikallinen,
}) {
  const sijoitetut = new Set((tietue?.sijoitukset || []).map((s) => s.vuoroId));
  const avoimet = [...listanVuorot.values()].filter((v) => !sijoitetut.has(v.id) && (!nytPaikallinen || v.alkaa > nytPaikallinen));
  const kohdeKartta = new Map((kohteet || []).map((k) => [k?.id, k]));
  const sijoitettavat = henkilot.filter((h) => h.workTimeType !== 'oncall');

  // Työtila: henkilöittäin vuorot (myös edellisten listojen), jota ehdotukset kasvattavat.
  const omat = new Map(sijoitettavat.map((h) => [h.username, []]));
  for (const s of [...muutSijoitukset, ...(tietue?.sijoitukset || [])]) {
    const v = vuorot.get(s.vuoroId);
    if (v && omat.has(s.username)) omat.get(s.username).push(v);
  }
  const omatPoissaolot = (u) => poissaolot.filter((p) => p.username === u);
  const omatToiveet = (u) => toiveet.filter((t) => t.username === u);

  const perehdytetyt = (v) => sijoitettavat.filter((h) => perehdytetytVuorot(kohdeKartta.get(v.siteId), h.username)
    .has(String(v.vuorotyyppiId)));

  // Vaikeimmat ensin: vähiten perehdytettyjä, sitten aikajärjestys. Järjestys lasketaan
  // kerran perehdytyksestä — kelvollisuus muuttuu matkan varrella, mutta perehdytys ei.
  const jarjestys = avoimet
    .map((v) => ({ v, ehdokkaita: perehdytetyt(v).length }))
    .sort((a, b) => a.ehdokkaita - b.ehdokkaita || a.v.alkaa.localeCompare(b.v.alkaa) || a.v.id.localeCompare(b.v.id));

  const ehdotus = [];
  const avoimiksi = [];

  for (const { v } of jarjestys) {
    const ehdokkaat = perehdytetyt(v);
    if (!ehdokkaat.length) { avoimiksi.push({ vuoroId: v.id, syy: 'Kukaan ei ole perehdytetty tähän vuoroon.' }); continue; }

    let paras = null;
    let estyneita = 0;
    let taynna = 0;
    for (const h of ehdokkaat) {
      const kokeilu = [...omat.get(h.username), v];
      const { havainnot, jaksot } = tarkistaHenkilo({
        henkilo: h, vuorot: kokeilu, kohteet, asetukset, lista,
        poissaolot: omatPoissaolot(h.username), toiveet: omatToiveet(h.username),
      });
      const koskevat = havainnot.filter((x) => x.vuoroIdt.includes(v.id));
      if (koskevat.some((x) => x.taso === 'este' || x.taso === 'poikkeama')) { estyneita += 1; continue; }

      // Tunnit tämän vuoron kanssa siinä jaksossa johon vuoro kuuluu. Mukana poissaolojen
      // työaikaan rinnastettavat tunnit (TES 33 §), joten lomaviikolla katto tulee vastaan
      // aikaisemmin — kuten pitääkin.
      const jakso = jaksot.find((j) => v.pvm >= j.alku && v.pvm <= j.viimeinen);
      const tunnitNyt = jakso ? jakso.tunnit : 0;
      if (tunnitNyt > SAANNOLLINEN_H) { taynna += 1; continue; }
      const ennen = tunnitNyt - v.kestoMin / 60;
      const tav = tavoite(h);
      let pisteet = 0;
      if (tav > 0) pisteet += (Math.max(0, tav - ennen) / tav) * PISTEET.tuntivaje;
      if (h.workTimeType === 'parttime' && tav > 0 && ennen < tav) pisteet += PISTEET.vahimmaistyoaika;
      const toive = omatToiveet(h.username).find((t) => t.pvm === v.pvm);
      if (toive?.laji === 'vuoro') pisteet += PISTEET.toiveVuoro;
      if (toive?.laji === 'vapaa' || toive?.laji === 'este') pisteet += PISTEET.toiveVapaa;
      pisteet += koskevat.filter((x) => x.taso === 'varoitus' && x.koodi !== 'toive').length * PISTEET.varoitus;
      const listanOmat = omat.get(h.username).filter((x) => x.pvm >= lista.alku);
      if (onYovuoro(v)) pisteet += listanOmat.filter(onYovuoro).length * PISTEET.tasapuolisuus;
      if (onViikonloppu(v)) pisteet += listanOmat.filter(onViikonloppu).length * PISTEET.tasapuolisuus;
      const eilen = new Date(Date.parse(`${v.pvm}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
      if (omat.get(h.username).some((x) => x.pvm === eilen && x.siteId === v.siteId)) pisteet += PISTEET.jatkuvuus;

      if (!paras || pisteet < paras.pisteet || (pisteet === paras.pisteet && h.username < paras.username)) {
        paras = { username: h.username, pisteet };
      }
    }

    if (!paras) {
      avoimiksi.push({
        vuoroId: v.id,
        syy: taynna === ehdokkaat.length
          ? `Kaikkien perehdytettyjen jakso ylittäisi ${SAANNOLLINEN_H} h. Ylityö vaatii työntekijän suostumuksen.`
          : estyneita === ehdokkaat.length
            ? 'Jokaiselle perehdytetylle tulisi este tai TES-poikkeama (esim. lepoaika tai poissaolo).'
            : `Perehdytetyiltä tulisi joko este, TES-poikkeama tai yli ${SAANNOLLINEN_H} h jakso.`,
      });
      continue;
    }
    ehdotus.push({ vuoroId: v.id, username: paras.username, pisteet: Math.round(paras.pisteet * 10) / 10 });
    omat.get(paras.username).push(v);
  }

  // Näytetään aikajärjestyksessä, vaikka laskettiin vaikeimmasta alkaen.
  const alku = (id) => listanVuorot.get(id)?.alkaa || '';
  ehdotus.sort((a, b) => alku(a.vuoroId).localeCompare(alku(b.vuoroId)));
  avoimiksi.sort((a, b) => alku(a.vuoroId).localeCompare(alku(b.vuoroId)));
  return { ehdotus, avoimiksi };
}
