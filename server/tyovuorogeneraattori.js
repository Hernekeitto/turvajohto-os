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
//   lisätyö          osa-aikainen minimin yli menee aina kuukausipalkkaisten jälkeen
//   tuntivaje        jakson tavoitteesta puuttuva OSUUS vähentää pisteitä: vajaa
//                    jakso täytetään ensin (kuukausipalkka 120 h, osa-aikainen sopimuksen
//                    vähimmäistyöaika)
//   toive           "toivon vuoroa" pienentää, "toivon vapaata"/"en pääse" kasvattaa
//                    paljon — toive on varoitus eikä este, mutta generaattori kunnioittaa sitä
//   varoitukset      jokainen vuoroa koskeva varoitus (putki, pitkä viikonloppu). Kortin
//                    vanhenemisvaroitus ei vaikuta: kortti on voimassa vuoron aikana, tai
//                    sijoitus olisi este — varoitus on muistutus uusinnasta, ei syy jättää
//                    vartijaa ilman vuoroja (koeajo 11.10.2026: 65 h muiden ~95 h)
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
  // Osa-aikaisen tunnit minimin yli: vasta kun yhdellekään kuukausipalkkaiselle ei voi
  // antaa vuoroa (käyttäjän päätös 11.10.2026). Kuukausipalkkaiselle maksetaan sovittu
  // 120 h joka tapauksessa, joten vuoro osa-aikaiselle hänen sijastaan on maksettu tunti
  // kahteen kertaan. Arvo on suurempi kuin tyhjän jakson tuntivaje, joten järjestys on
  // ehdoton: minimi → kuukausipalkkaiset kohti 120 h → osa-aikaisten lisätunnit.
  lisatyo: 150,
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
  poissaolot = [], toiveet = [], nytPaikallinen, tapa = 'tasainen', prioriteetti = null,
}) {
  const sijoitetut = new Set((tietue?.sijoitukset || []).map((s) => s.vuoroId));
  const avoimet = [...listanVuorot.values()].filter((v) => !sijoitetut.has(v.id) && (!nytPaikallinen || v.alkaa > nytPaikallinen));
  const kohdeKartta = new Map((kohteet || []).map((k) => [k?.id, k]));
  const sijoitettavat = henkilot.filter((h) => h.workTimeType !== 'oncall');

  // Keskitetty täyttö (käyttäjän päätös 11.10.2026): kuukausipalkkaiset täytetään 120
  // tuntiin yksi kerrallaan järjestyksessä, eikä vajetta jaeta tasan. Sovittu 120 h
  // maksetaan joka tapauksessa, joten vähemmillä ihmisillä täysin tunnein on halvempi
  // kuin monella vajain tunnein. Järjestys on nyt aakkosjärjestys; tulevaisuudessa siihen
  // tulee kohdeprosentti (100 % Prisma Kalevaa = vakitekijä, täytetään ensin).
  //
  // Kaksi vaihetta: ensin tavallinen kattava jako, sitten keskitys (ks. alempana).
  // Suora keskittäminen ensimmäisessä vaiheessa jätti vuoroja avoimiksi: järjestyksen
  // ensimmäiset vapaapäivät osuivat samoille päiville, ja viimeisen olisi pitänyt tehdä
  // sekä aamu että ilta (koeajo 11.10.2026).
  const keskitetty = tapa === 'keskitetty';
  const jarjestysLista = Array.isArray(prioriteetti) && prioriteetti.length
    ? prioriteetti
    : [...sijoitettavat].sort((a, b) => String(a.nimi || a.username).localeCompare(String(b.nimi || b.username), 'fi')).map((h) => h.username);
  const jarjestysNumero = (u) => {
    const i = jarjestysLista.indexOf(u);
    return i < 0 ? jarjestysLista.length : i;
  };

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
    .sort((a, b) => a.ehdokkaita - b.ehdokkaita
      || a.v.alkaa.localeCompare(b.v.alkaa) || a.v.id.localeCompare(b.v.id));

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
      if (h.workTimeType === 'parttime' && tav > 0) pisteet += ennen < tav ? PISTEET.vahimmaistyoaika : PISTEET.lisatyo;
      const toive = omatToiveet(h.username).find((t) => t.pvm === v.pvm);
      if (toive?.laji === 'vuoro') pisteet += PISTEET.toiveVuoro;
      if (toive?.laji === 'vapaa' || toive?.laji === 'este') pisteet += PISTEET.toiveVapaa;
      pisteet += koskevat.filter((x) => x.taso === 'varoitus' && x.koodi !== 'toive' && x.koodi !== 'kortti_vanhenee').length * PISTEET.varoitus;
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

  // --- Korjauskierros (11.10.2026) ---------------------------------------------------
  //
  // Ahne valinta ei palaa taaksepäin: kun aiemmat vuorot on jaettu, myöhempi vuoro voi
  // jäädä avoimeksi vaikka se olisi täytettävissä siirtämällä yksi aiempi vuoro toiselle.
  // Keskitetty täyttö tekee tästä tavallista: kun ensimmäiset täytetään 120 tuntiin
  // aikajärjestyksessä, viimeiselle jää vuoroja joihin hänen lepoaikansa eivät riitä
  // (koeajo: 5 vuoroa avoimeksi kolmen hengen listalla).
  //
  // Jokaiselle avoimelle vuorolle O: ehdokas p, jonka ainoa este on yksi hänen omista
  // EHDOTETUISTA vuoroistaan S (ei jo tehty sijoitus — niihin ei kosketa). Jos S:n voi
  // antaa jollekulle toiselle q ilman estettä tai poikkeamaa ja yli 120 h, S siirtyy q:lle
  // ja O p:lle. Yksi siirto per avoin vuoro; ketjuja ei tehdä.
  const vuoroKartta = new Map(avoimet.map((v) => [v.id, v]));
  const ehdotetut = new Map(ehdotus.map((e) => [e.vuoroId, e]));
  const kelpaa = (h, vuorolista, kohdeId) => {
    const { havainnot, jaksot } = tarkistaHenkilo({
      henkilo: h, vuorot: vuorolista, kohteet, asetukset, lista,
      poissaolot: omatPoissaolot(h.username), toiveet: omatToiveet(h.username),
    });
    const kohde = vuoroKartta.get(kohdeId);
    const jakso = jaksot.find((j) => kohde.pvm >= j.alku && kohde.pvm <= j.viimeinen);
    const estavat = havainnot.filter((x) => (x.taso === 'este' || x.taso === 'poikkeama') && x.vuoroIdt.includes(kohdeId));
    return { estavat, yli: (jakso ? jakso.tunnit : 0) > SAANNOLLINEN_H };
  };
  const korjatut = new Set();
  for (const a of avoimiksi) {
    const o = vuoroKartta.get(a.vuoroId);
    let tehty = false;
    for (const p of perehdytetyt(o)) {
      if (tehty) break;
      const pOmat = omat.get(p.username);
      const kokeilu = kelpaa(p, [...pOmat, o], o.id);
      if (kokeilu.yli || !kokeilu.estavat.length) continue;
      // Esteen aiheuttajat: p:n muut vuorot samoissa havainnoissa. Vain yksi, ja sen on
      // oltava generaattorin oma ehdotus.
      const syylliset = [...new Set(kokeilu.estavat.flatMap((x) => x.vuoroIdt).filter((id) => id !== o.id))];
      if (syylliset.length !== 1 || ehdotetut.get(syylliset[0])?.username !== p.username) continue;
      const s = vuoroKartta.get(syylliset[0]);
      const pIlman = pOmat.filter((x) => x.id !== s.id);
      const pUusi = kelpaa(p, [...pIlman, o], o.id);
      if (pUusi.yli || pUusi.estavat.length) continue;
      for (const q of perehdytetyt(s)) {
        if (q.username === p.username) continue;
        const qUusi = kelpaa(q, [...omat.get(q.username), s], s.id);
        if (qUusi.yli || qUusi.estavat.length) continue;
        // Siirto: S → q, O → p.
        omat.set(p.username, [...pIlman, o]);
        omat.get(q.username).push(s);
        ehdotetut.get(s.id).username = q.username;
        const uusi = { vuoroId: o.id, username: p.username, pisteet: 0 };
        ehdotus.push(uusi);
        ehdotetut.set(o.id, uusi);
        korjatut.add(o.id);
        tehty = true;
        break;
      }
    }
  }
  const avoimiksiJaljelle = avoimiksi.filter((a) => !korjatut.has(a.vuoroId));
  avoimiksi.length = 0;
  avoimiksi.push(...avoimiksiJaljelle);

  // --- Keskitys (tapa 'keskitetty', 11.10.2026) --------------------------------------
  //
  // Kattavan jaon jälkeen vuoroja siirretään järjestyksen viimeisiltä ensimmäisille
  // kuukausipalkkaisille, kunnes nämä ovat 120 tunnissa. Vuoro vain vaihtaa omistajaa,
  // joten yhtään vuoroa ei avata. Siirto tehdään vain kun vastaanottajalle ei tule estettä
  // tai poikkeamaa eikä yli 120 tuntia, ja osa-aikaiselta ei oteta vuoroa minimin alle.
  // Varoitusta (putki, pitkä viikonloppu) ei hyväksytä vastaanottajalle: täysi jakso ei
  // saa tarkoittaa yhdeksää peräkkäistä vuoroa ilman viikkovapaata.
  if (keskitetty) {
    const tunnitJaksolla = (u, vuoro) => {
      const h = sijoitettavat.find((x) => x.username === u);
      const { jaksot } = tarkistaHenkilo({
        henkilo: h, vuorot: omat.get(u), kohteet, asetukset, lista,
        poissaolot: omatPoissaolot(u), toiveet: omatToiveet(u),
      });
      return jaksot.find((j) => vuoro.pvm >= j.alku && vuoro.pvm <= j.viimeinen)?.tunnit || 0;
    };
    const vastaanottajat = jarjestysLista
      .map((u) => sijoitettavat.find((h) => h.username === u))
      .filter((h) => h && h.workTimeType === 'monthly');
    let siirtyi = true;
    while (siirtyi) {
      siirtyi = false;
      for (const r of vastaanottajat) {
        // Lahjoittajat järjestyksen lopusta alkaen; vain generaattorin omia ehdotuksia.
        const lahjoitettavat = ehdotus
          .filter((e) => jarjestysNumero(e.username) > jarjestysNumero(r.username) && perehdytetyt(vuoroKartta.get(e.vuoroId)).some((h) => h.username === r.username))
          .sort((a, b) => jarjestysNumero(b.username) - jarjestysNumero(a.username));
        for (const e of lahjoitettavat) {
          const s = vuoroKartta.get(e.vuoroId);
          if (tunnitJaksolla(r.username, s) + s.kestoMin / 60 > SAANNOLLINEN_H) continue;
          const antaja = sijoitettavat.find((h) => h.username === e.username);
          if (antaja.workTimeType === 'parttime' && tunnitJaksolla(antaja.username, s) - s.kestoMin / 60 < tavoite(antaja)) continue;
          const { havainnot } = tarkistaHenkilo({
            henkilo: r, vuorot: [...omat.get(r.username), s], kohteet, asetukset, lista,
            poissaolot: omatPoissaolot(r.username), toiveet: omatToiveet(r.username),
          });
          if (havainnot.some((x) => x.vuoroIdt.includes(s.id) && x.taso !== 'huomio' && x.koodi !== 'kortti_vanhenee')) continue;
          omat.set(e.username, omat.get(e.username).filter((x) => x.id !== s.id));
          omat.get(r.username).push(s);
          e.username = r.username;
          siirtyi = true;
        }
      }
    }
  }

  // Näytetään aikajärjestyksessä, vaikka laskettiin vaikeimmasta alkaen.
  const alku = (id) => listanVuorot.get(id)?.alkaa || '';
  ehdotus.sort((a, b) => alku(a.vuoroId).localeCompare(alku(b.vuoroId)));
  avoimiksi.sort((a, b) => alku(a.vuoroId).localeCompare(alku(b.vuoroId)));
  return { ehdotus, avoimiksi };
}
