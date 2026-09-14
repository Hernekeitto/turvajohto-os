// Hälytyskeskuksen johdettu tilannekuva: mitä kohteissa on menossa juuri nyt.
//
// Tämä moduuli EI hae mitään eikä päätä mistään. Se kokoaa jo haetuista kokoelmista ne
// luvut ja listat joita päivystäjä katsoo — omana tiedostonaan siksi, että kokoaminen on
// sovelluksen ainoaa oikeaa logiikkaa hälytyskeskuksessa ja se on voitava testata ilman
// selainta (tilannekuva.test.ts).
//
// TÄRKEÄ RAJAUS: nämä funktiot näkevät vain sen datan jonka palvelin on jo antanut
// käyttäjälle. Jos päivystäjällä ei ole oikeutta kierroksiin, kierroslista tulee tänne
// tyhjänä eikä tilannekuva väitä kohteessa olevan hiljaista — kutsuja tietää oikeutensa ja
// kertoo eron käyttäjälle. Puuttuva oikeus ja rauhallinen tilanne EIVÄT saa näyttää
// samalta valvomon ruudulla.

import { onAvoin, type Halytys } from '../shared/halytykset.ts';
import type { Avain, Poikkeama } from '../shared/kalusto';
import type { KalustoTietue } from './kalusto/tyypit';
import { onKuitannut, onVoimassa, type Tiedote } from '../shared/tiedotteet.ts';
import type { Pohja, Suoritus } from '../shared/pohjat';
import type { Jalkiraportti } from '../shared/jalkiraportit';
import type { GuardRaportti, Kierros, TehtavaSuoritus } from './tyypit';

// Kaikki kokoelmat joista tilannekuva kootaan. Yksi olio eikä kymmenen parametria: lista
// kasvaa sitä mukaa kuin GUARD-puolelle tulee kirjattavaa, eikä jokaisen kutsupaikan pidä
// muuttua sen mukana.
export type Lahteet = {
  halytykset: Halytys[];
  kierrokset: Kierros[];
  tehtavat: TehtavaSuoritus[];
  raportit: GuardRaportti[];
  avaimet: Avain[];
  poikkeamat: Poikkeama[];
  // Kalustopankki (erä 20). GUARD-puolen kohteen kalusto tulee TÄSTÄ eikä `avaimet`ista:
  // pankin rivi kuuluu kohteelle silloin kun sen sijoitus osoittaa siihen. `avaimet` on
  // yhä olemassa EVENT-puolen avainrekisteriä varten, ja tapahtuman kalusto luetaan
  // siitä — kaksi eri rekisteriä, koska tapahtuman avain on tapahtuman mittainen.
  kalusto: KalustoTietue[];
  tiedotteet: Tiedote[];
  skenaariot: Suoritus[];
  // Pohjat ovat yksi kokoelma jossa on kolme lajia (patrol = kierrospohja, guide =
  // ohjekortti, play = skenaario), ks. shared/pohjat.ts. Kohteen valikko laskee niistä
  // painikkeiden tiivistelmät; hälytyskeskus ei käytä näitä.
  pohjat: Pohja[];
  jaksoraportit: Jalkiraportti[];
};

export const tyhjatLahteet = (): Lahteet => ({
  halytykset: [], kierrokset: [], tehtavat: [], raportit: [],
  avaimet: [], poikkeamat: [], kalusto: [], tiedotteet: [], skenaariot: [],
  pohjat: [], jaksoraportit: [],
});

// Kiireysjärjestys on kolmiportainen tarkoituksella. Viisi tasoa näyttäisi tarkemmalta
// mutta pakottaisi päivystäjän vertailemaan sävyjä; kolme kertoo sen mitä ruudulta pitää
// nähdä yhdellä silmäyksellä: onko jossain hätä, onko jossain jotain kesken, vai ei.
export type Kiireys = 'kriittinen' | 'varoitus' | 'rauhallinen';

export type KohteenTilanne = {
  kohdeId: string;
  lauenneet: number;
  ajastimet: number;
  // Ajastin jonka määräaika on lähimpänä. Päivystäjän on nähtävä kohderivistä kuka on
  // seuraavaksi vastaamassa, ei vain montako ajastinta on käynnissä.
  seuraavaEraantyy: number | null;
  kierroksetKesken: number;
  skenaariotKesken: number;
  kadonneetAvaimet: number;
  avoimetPoikkeamat: number;
  kriittisetPoikkeamat: number;
  tiedotteetVoimassa: number;
  // Viimeisin merkki elämästä kohteesta: kuittaus, kirjaus, kierrospiste. Hiljaisuus on
  // päivystäjälle tieto siinä missä tapahtumakin — kohde jossa ei ole kuulunut mitään
  // koko vuoron aikana on tarkistamisen arvoinen.
  viimeksi: string | null;
  kiireys: Kiireys;
};

const uusin = (a: string | null, b: string | null | undefined) => {
  if (!b) return a;
  if (!a) return b;
  return b > a ? b : a;
};

// Raportin aikaleima. `luotu` on tallennushetki ja `date`+`time` se hetki jonka kirjaaja
// itse ilmoitti — tilannekuvassa käytetään tallennushetkeä, koska se kertoo milloin
// kohteesta viimeksi kuului jotain. Vanhalta kirjaukselta luotu voi puuttua.
const raportinAika = (r: GuardRaportti) =>
  r.luotu || (r.date ? `${r.date}T${r.time || '00:00'}` : null);

export function kohteenTilanne(kohdeId: string, lahteet: Lahteet): KohteenTilanne {
  const halytykset = lahteet.halytykset.filter((h) => h.eventId === kohdeId);
  const lauenneet = halytykset.filter((h) => h.tila === 'lauennut');
  const ajastimet = halytykset.filter((h) => h.tyyppi === 'ajastin' && h.tila === 'kaynnissa');
  const kierroksetKesken = lahteet.kierrokset.filter((k) => k.siteId === kohdeId && k.tila === 'kesken');
  const skenaariotKesken = lahteet.skenaariot.filter((s) => s.ownerId === kohdeId && s.tila === 'kesken');
  const kadonneet = lahteet.avaimet.filter((a) => a.ownerId === kohdeId && a.tila === 'kadonnut');
  const avoimet = lahteet.poikkeamat.filter((p) => p.ownerId === kohdeId && p.tila === 'avoin');
  const tiedotteet = lahteet.tiedotteet.filter((t) => t.ownerId === kohdeId && onVoimassa(t));

  let viimeksi: string | null = null;
  for (const h of halytykset) viimeksi = uusin(viimeksi, h.paattyi || h.laukesi || h.alkoi);
  for (const k of kierroksetKesken) {
    viimeksi = uusin(viimeksi, k.alkoi);
    for (const piste of k.pisteet || []) viimeksi = uusin(viimeksi, piste.kuitattu);
  }
  for (const k of lahteet.kierrokset) {
    if (k.siteId === kohdeId) viimeksi = uusin(viimeksi, k.paattyi);
  }
  for (const t of lahteet.tehtavat) {
    if (t.siteId === kohdeId) viimeksi = uusin(viimeksi, t.aika);
  }
  for (const r of lahteet.raportit) {
    if (r.siteId === kohdeId) viimeksi = uusin(viimeksi, raportinAika(r));
  }

  const kriittisetPoikkeamat = avoimet.filter((p) => p.vakavuus === 'kriittinen').length;
  const kiireys: Kiireys =
    lauenneet.length > 0 || kriittisetPoikkeamat > 0
      ? 'kriittinen'
      : ajastimet.length > 0 || kadonneet.length > 0 || avoimet.length > 0
        ? 'varoitus'
        : 'rauhallinen';

  return {
    kohdeId,
    lauenneet: lauenneet.length,
    ajastimet: ajastimet.length,
    seuraavaEraantyy: ajastimet.reduce<number | null>(
      (pienin, h) => (h.eraantyy && (pienin === null || h.eraantyy < pienin) ? h.eraantyy : pienin),
      null
    ),
    kierroksetKesken: kierroksetKesken.length,
    skenaariotKesken: skenaariotKesken.length,
    kadonneetAvaimet: kadonneet.length,
    avoimetPoikkeamat: avoimet.length,
    kriittisetPoikkeamat,
    tiedotteetVoimassa: tiedotteet.length,
    viimeksi,
    kiireys,
  };
}

// --- Kentällä juuri nyt -------------------------------------------------------------
//
// Vartiointiliikkeessä ei ole erillistä työvuorokirjausta (se on tapahtumapuolen
// checkins), joten "kuka on töissä" johdetaan siitä mitä järjestelmään on tehty. Se on
// arvio eikä totuus, ja se sanotaan käyttöliittymässä ääneen: nimen perässä lukee mistä
// merkintä on ja koska. Vartija joka ei ole koskenut sovellukseen ei näy tässä listassa —
// päivystäjän on tiedettävä se, ei luultava listaa vuorolistaksi.

export type Kentalla = {
  vartija: string;
  kohteet: string[];
  viimeksi: string;
  mita: string;
  // Käynnissä oleva ajastin, jos on. Päivystäjä katsoo tästä kuka on yksin ja milloin
  // hänen on määrä kuitata itsensä kunnossa olevaksi.
  ajastin: Halytys | null;
};

// Kuinka vanha merkintä lasketaan vielä "kentällä olevaksi". Kahdeksan tuntia on tavallisen
// vartiovuoron pituus: sitä lyhyempi ikkuna pudottaisi listalta sen joka aloitti vuoronsa
// kuittaamalla tehtävät ja on sen jälkeen kiertänyt ilman kirjattavaa.
export const KENTALLA_IKKUNA_MS = 8 * 60 * 60 * 1000;

export function kentalla(lahteet: Lahteet, nyt = Date.now(), ikkunaMs = KENTALLA_IKKUNA_MS): Kentalla[] {
  const raja = nyt - ikkunaMs;
  const lista = new Map<string, Kentalla>();

  const merkitse = (vartija: string, kohdeId: string | null, ts: string | null | undefined, mita: string) => {
    if (!vartija || !ts) return;
    const hetki = Date.parse(ts);
    if (!Number.isFinite(hetki) || hetki < raja || hetki > nyt + 60_000) return;
    const entinen = lista.get(vartija);
    if (!entinen) {
      lista.set(vartija, {
        vartija,
        kohteet: kohdeId ? [kohdeId] : [],
        viimeksi: ts,
        mita,
        ajastin: null,
      });
      return;
    }
    if (kohdeId && !entinen.kohteet.includes(kohdeId)) entinen.kohteet.push(kohdeId);
    // Uusin merkintä kertoo mitä henkilö oli viimeksi tekemässä. Vanhempi ei korvaa sitä.
    if (ts > entinen.viimeksi) {
      entinen.viimeksi = ts;
      entinen.mita = mita;
    }
  };

  for (const k of lahteet.kierrokset) {
    const viimeisinPiste = (k.pisteet || [])
      .map((p) => p.kuitattu)
      .filter((p): p is string => !!p)
      .sort()
      .pop();
    merkitse(
      k.vartija,
      k.siteId,
      viimeisinPiste || k.paattyi || k.alkoi,
      k.tila === 'kesken' ? `Kierros kesken: ${k.templateNimi}` : `Kierros ${k.templateNimi}`
    );
  }
  for (const t of lahteet.tehtavat) merkitse(t.vartija, t.siteId, t.aika, `Tehtävä: ${t.tehtavaNimi}`);
  for (const r of lahteet.raportit) {
    merkitse(r.author, r.siteId, raportinAika(r), r.typeId === 'guard_jvreport' ? 'Tapahtumailmoitus' : 'Toimenpidekirjaus');
  }
  for (const s of lahteet.skenaariot) {
    merkitse(s.tekija, s.ownerId, s.paattyi || s.alkoi, `Skenaario: ${s.templateNimi}`);
  }
  for (const p of lahteet.poikkeamat) merkitse(p.ilmoittaja, p.ownerId, p.ilmoitettu, `Varustepoikkeama: ${p.varuste}`);
  for (const h of lahteet.halytykset) {
    merkitse(h.vartija, h.eventId, h.laukesi || h.alkoi, h.tyyppi === 'ajastin' ? 'Ajastin' : 'Hälytys');
  }

  // Avoin hälytys ja käynnissä oleva ajastin nostavat henkilön listalle vaikka merkintä
  // olisi ikkunaa vanhempi: kahdeksan tuntia sitten alkanut ajastin on nimenomaan se
  // tapaus jota päivystäjän on katsottava.
  for (const h of lahteet.halytykset) {
    if (!onAvoin(h) || !h.vartija) continue;
    const entinen = lista.get(h.vartija);
    if (!entinen) {
      lista.set(h.vartija, {
        vartija: h.vartija,
        kohteet: h.eventId ? [h.eventId] : [],
        viimeksi: h.laukesi || h.alkoi,
        mita: h.tyyppi === 'ajastin' ? 'Ajastin käynnissä' : 'Hälytys avoinna',
        ajastin: h.tyyppi === 'ajastin' && h.tila === 'kaynnissa' ? h : null,
      });
      continue;
    }
    if (h.eventId && !entinen.kohteet.includes(h.eventId)) entinen.kohteet.push(h.eventId);
    if (h.tyyppi === 'ajastin' && h.tila === 'kaynnissa') entinen.ajastin = h;
  }

  return [...lista.values()].sort((a, b) => b.viimeksi.localeCompare(a.viimeksi));
}

// --- Tapahtumavirta -----------------------------------------------------------------
//
// Yksi aikajärjestyksessä oleva lista kaikesta mitä kohteissa on tapahtunut. Päivystäjän
// työn ydin: hälytys kertoo mitä tapahtui juuri nyt, virta kertoo mitä sitä ennen
// tapahtui — ja juuri sitä kysytään ensimmäisenä kun jotain sattuu.

export type Tapahtuma = {
  id: string;
  ts: string;
  kohdeId: string | null;
  taso: Kiireys;
  otsikko: string;
  teksti: string;
  kuka: string | null;
};

// Hälytyshistorian merkintöjen käyttöliittymänimet. Palvelin tallentaa tapahtuman
// tunnuksen (server/halytys.js: merkinta()), ei ihmiselle näytettävää nimeä. Tuntematon
// tunnus on uusi merkintätyyppi eikä virhe: se näytetään yleisnimellä eikä pudoteta pois.
const TAPAHTUMAN_NIMI: Record<string, string> = {
  luotu: 'Hälytys luotu',
  laukesi: 'HÄLYTYS LAUKESI',
  kuittaus: 'Kuittaus ajallaan',
  kuitattu: 'Hälytys kuitattu',
  peruttu: 'Ajastin lopetettu',
  eskalointi: 'Tekstiviestieskalointi',
};

// Merkinnän vakavuus virrassa. Laukeaminen on aina kriittinen. Hälytyksen LUOMINEN on
// kriittinen kaikilla muilla lajeilla paitsi ajastimella: hätäpainikkeen painallus on
// tapahtuma sinänsä, kun taas ajastimen käynnistäminen on vuoron rutiinia.
const merkinnanTaso = (tapahtuma: string, halytys: Halytys): Kiireys => {
  if (tapahtuma === 'laukesi') return 'kriittinen';
  if (tapahtuma === 'luotu') return halytys.tyyppi === 'ajastin' ? 'rauhallinen' : 'kriittinen';
  return 'rauhallinen';
};

export function tapahtumavirta(lahteet: Lahteet, raja = 40): Tapahtuma[] {
  const virta: Tapahtuma[] = [];

  for (const h of lahteet.halytykset) {
    for (const [i, merkinta] of (h.historia || []).entries()) {
      virta.push({
        id: `halytys-${h.id}-${i}`,
        ts: merkinta.ts,
        kohdeId: h.eventId,
        taso: merkinnanTaso(merkinta.tapahtuma, h),
        otsikko: `${TAPAHTUMAN_NIMI[merkinta.tapahtuma] || 'Hälytys'} · ${h.vartija}`,
        teksti: merkinta.teksti || '',
        kuka: merkinta.user || h.vartija || null,
      });
    }
  }

  for (const k of lahteet.kierrokset) {
    virta.push({
      id: `kierros-alku-${k.id}`,
      ts: k.alkoi,
      kohdeId: k.siteId,
      taso: 'rauhallinen',
      otsikko: 'Kierros aloitettu',
      teksti: k.templateNimi,
      kuka: k.vartija,
    });
    if (k.paattyi) {
      virta.push({
        id: `kierros-loppu-${k.id}`,
        ts: k.paattyi,
        kohdeId: k.siteId,
        taso: k.tila === 'keskeytetty' ? 'varoitus' : 'rauhallinen',
        otsikko: k.tila === 'keskeytetty' ? 'Kierros keskeytetty' : 'Kierros valmis',
        teksti: k.tila === 'keskeytetty' ? k.keskeytysSyy || k.templateNimi : k.templateNimi,
        kuka: k.vartija,
      });
    }
  }

  for (const t of lahteet.tehtavat) {
    virta.push({
      id: `tehtava-${t.id}`,
      ts: t.aika,
      kohdeId: t.siteId,
      taso: 'rauhallinen',
      otsikko: 'Tehtävä kuitattu',
      teksti: t.tehtavaNimi,
      kuka: t.vartija,
    });
  }

  for (const r of lahteet.raportit) {
    const ts = raportinAika(r);
    if (!ts) continue;
    virta.push({
      id: `raportti-${r.id}`,
      ts,
      kohdeId: r.siteId,
      // Tapahtumailmoitus on aina vähintään varoitus: se kirjoitetaan silloin kun
      // kohteessa on puututtu johonkin, ja päivystäjän on tiedettävä siitä samana iltana
      // eikä vasta kuukausiraportissa.
      taso: r.typeId === 'guard_jvreport' ? 'varoitus' : 'rauhallinen',
      otsikko: r.typeId === 'guard_jvreport' ? 'Tapahtumailmoitus' : 'Toimenpide kirjattu',
      teksti: r.summary || r.type || '',
      kuka: r.author,
    });
  }

  for (const p of lahteet.poikkeamat) {
    virta.push({
      id: `poikkeama-${p.id}`,
      ts: p.ilmoitettu,
      kohdeId: p.ownerId,
      taso: p.vakavuus === 'kriittinen' ? 'kriittinen' : 'varoitus',
      otsikko: p.vakavuus === 'kriittinen' ? 'Kriittinen varustepoikkeama' : 'Varustepoikkeama',
      teksti: `${p.varuste}${p.kuvaus ? ` — ${p.kuvaus}` : ''}`,
      kuka: p.ilmoittaja,
    });
    if (p.kasitelty) {
      virta.push({
        id: `poikkeama-kasitelty-${p.id}`,
        ts: p.kasitelty,
        kohdeId: p.ownerId,
        taso: 'rauhallinen',
        otsikko: 'Varustepoikkeama käsitelty',
        teksti: `${p.varuste}${p.kasittelyHuomio ? ` — ${p.kasittelyHuomio}` : ''}`,
        kuka: p.kasittelija,
      });
    }
  }

  for (const a of lahteet.avaimet) {
    for (const [i, merkinta] of (a.historia || []).entries()) {
      virta.push({
        id: `avain-${a.id}-${i}`,
        ts: merkinta.ts,
        kohdeId: a.ownerId,
        taso: merkinta.tapahtuma === 'kadonnut' ? 'varoitus' : 'rauhallinen',
        otsikko: `Avain ${a.tunnus}`,
        teksti: merkinta.teksti || '',
        kuka: merkinta.user || merkinta.haltija || null,
      });
    }
  }

  for (const t of lahteet.tiedotteet) {
    virta.push({
      id: `tiedote-${t.id}`,
      ts: t.luotu,
      kohdeId: t.ownerId,
      taso: 'rauhallinen',
      otsikko: 'Tiedote lähetetty',
      teksti: t.otsikko,
      kuka: t.laatija,
    });
  }

  for (const s of lahteet.skenaariot) {
    virta.push({
      id: `skenaario-${s.id}`,
      ts: s.alkoi,
      kohdeId: s.ownerId,
      taso: 'varoitus',
      otsikko: 'Skenaario käynnistetty',
      teksti: s.templateNimi,
      kuka: s.tekija,
    });
  }

  return virta
    .filter((t) => !!t.ts)
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, raja);
}

// --- Kohteen valikko ----------------------------------------------------------------
//
// Kohdetta painettaessa aukeaa valikko, jossa jokainen toiminto on oma painikkeensa ja
// jokaisen painikkeen alla lukee mitä kohteessa on sen osalta tehty. Tiivistelmät
// lasketaan täällä eikä näkymässä, jotta ne voi testata — ja koska sama sääntö toistuu
// joka painikkeessa: LUKU KERTOO TEHDYN TYÖN, huomio kertoo sen mikä on kesken.
//
// Tyhjä kohde saa oman tekstinsä ("Ei vielä kierroksia") eikä nollaa: nolla näyttää
// mittarilta, ja "0 kierrosta" luetaan helposti niin että jotain on mennyt pieleen.

export type Toiminto =
  | 'tehtavat' | 'kierros' | 'kierrospohjat' | 'kalusto' | 'mittaristo' | 'jaksoraportit'
  | 'tiedotteet' | 'ohjeet' | 'skenaariot' | 'halytykset' | 'toimenpide' | 'ilmoitus'
  | 'tiedot';

export type Tiivistelma = {
  // Painikkeen alle tuleva rivi: mitä kohteessa on tämän toiminnon osalta tehty.
  teksti: string;
  // Merkki joka nostetaan painikkeeseen värillisenä. null kun kaikki on kunnossa —
  // merkki jokaisessa painikkeessa ei kertoisi mitään.
  huomio: { teksti: string; taso: Kiireys } | null;
};

// Aikaleima painikkeen riville. Tänään pelkkä kello, muuten myös päivä: "viimeisin
// 3.9. klo 23.40" on eri tieto kuin "viimeisin klo 23.40", ja vuorossa se ero ratkaisee.
export const lyhytAika = (iso: string | null | undefined, nyt = Date.now()) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const kello = `klo ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
  const tanaan = new Date(nyt);
  const samaPaiva = d.getFullYear() === tanaan.getFullYear()
    && d.getMonth() === tanaan.getMonth()
    && d.getDate() === tanaan.getDate();
  return samaPaiva ? kello : `${d.getDate()}.${d.getMonth() + 1}. ${kello}`;
};

const uusinAika = (aikaleimat: (string | null | undefined)[]) =>
  aikaleimat.filter((a): a is string => !!a).sort().pop() || null;

const monikko = (maara: number, yksikko: string, monikkomuoto: string) =>
  `${maara} ${maara === 1 ? yksikko : monikkomuoto}`;

type Konteksti = {
  // Kohteelle määritellyt tehtävät. Ne ovat kohteen omassa tietueessa eivätkä
  // kokoelmassa, joten ne annetaan erikseen.
  tehtaviaMaaritelty: number;
  kayttaja: string;
  nyt?: number;
};

export function kohteenToiminnot(
  kohdeId: string,
  lahteet: Lahteet,
  { tehtaviaMaaritelty, kayttaja, nyt = Date.now() }: Konteksti
): Record<Toiminto, Tiivistelma> {
  const kierrokset = lahteet.kierrokset.filter((k) => k.siteId === kohdeId);
  const valmiit = kierrokset.filter((k) => k.tila === 'valmis');
  const kesken = kierrokset.filter((k) => k.tila === 'kesken');
  const tehtavat = lahteet.tehtavat.filter((t) => t.siteId === kohdeId);
  const toimenpiteet = lahteet.raportit.filter((r) => r.siteId === kohdeId && r.typeId === 'guard_action');
  const ilmoitukset = lahteet.raportit.filter((r) => r.siteId === kohdeId && r.typeId === 'guard_jvreport');
  // Kohteen kalusto on pankin rivejä joiden sijoitus osoittaa tähän kohteeseen (erä 20).
  // Avoimet pyynnöt lasketaan erikseen ja koko pankista, koska pyydetty esine EI ole
  // vielä kohteella — se on juuri se mitä valikon tiivistelmän on kerrottava.
  const kalusto = lahteet.kalusto.filter(
    (e) => e.sijoitusLaji === 'kohde' && e.sijoitusId === kohdeId && e.tila !== 'poistettu'
  );
  const kadonneet = kalusto.filter((e) => e.tila === 'kadonnut');
  const kalustopyynnot = lahteet.kalusto.filter((e) => e.pyynto?.kohdeId === kohdeId);
  const poikkeamat = lahteet.poikkeamat.filter((p) => p.ownerId === kohdeId && p.tila === 'avoin');
  const tiedotteet = lahteet.tiedotteet.filter((t) => t.ownerId === kohdeId && onVoimassa(t, nyt));
  const kuittaamatta = tiedotteet.filter((t) => !onKuitannut(t, kayttaja));
  const jaksoraportit = lahteet.jaksoraportit.filter((r) => r.ownerId === kohdeId);
  const luonnokset = jaksoraportit.filter((r) => r.tila === 'luonnos');
  const pohjat = (laji: Pohja['kind']) =>
    lahteet.pohjat.filter((p) => p.ownerId === kohdeId && p.kind === laji && !p.arkistoitu);
  const kierrospohjat = pohjat('patrol');
  const skenaariopohjat = pohjat('play');
  const ohjeet = pohjat('guide');
  const skenaariotKesken = lahteet.skenaariot.filter((s) => s.ownerId === kohdeId && s.tila === 'kesken');
  const halytykset = lahteet.halytykset.filter((h) => h.eventId === kohdeId);
  const lauenneet = halytykset.filter((h) => h.tila === 'lauennut');
  const ajastimet = halytykset.filter((h) => h.tyyppi === 'ajastin' && h.tila === 'kaynnissa');

  // Tarkistuspisteitä yhteensä. Kierrospohjan pisteet ovat `pisteet`-kentässä, jota
  // pohjien yhteinen tyyppi ei tunne — se on kierrospohjan oma laajennus (guard/tyypit.ts).
  const pisteita = kierrospohjat.reduce(
    (summa, p) => summa + ((p as { pisteet?: unknown[] }).pisteet?.length || 0),
    0
  );

  const viimeisinKierros = uusinAika(kierrokset.map((k) => k.paattyi || k.alkoi));
  const viimeisinToimenpide = uusinAika(toimenpiteet.map((r) => r.luotu || r.date));
  const viimeisinIlmoitus = uusinAika(ilmoitukset.map((r) => r.luotu || r.date));
  const viimeisinTehtava = uusinAika(tehtavat.map((t) => t.aika));

  return {
    tehtavat: {
      teksti: tehtaviaMaaritelty === 0
        ? 'Kohteelle ei ole määritelty tehtäviä'
        : `${monikko(tehtaviaMaaritelty, 'tehtävä', 'tehtävää')} · ${
          viimeisinTehtava ? `viimeisin kuittaus ${lyhytAika(viimeisinTehtava, nyt)}` : 'ei kuittauksia'}`,
      huomio: null,
    },
    kierros: {
      teksti: kierrokset.length === 0
        ? 'Ei vielä kierroksia'
        : `${monikko(valmiit.length, 'kierros tehty', 'kierrosta tehty')}${
          viimeisinKierros ? ` · viimeisin ${lyhytAika(viimeisinKierros, nyt)}` : ''}`,
      huomio: kesken.length > 0 ? { teksti: 'kesken', taso: 'varoitus' } : null,
    },
    kierrospohjat: {
      teksti: kierrospohjat.length === 0
        ? 'Ei kierrospohjia — kierrosta ei voi aloittaa'
        : `${monikko(kierrospohjat.length, 'pohja', 'pohjaa')} · ${monikko(pisteita, 'tarkistuspiste', 'tarkistuspistettä')}`,
      // Ilman pohjaa kierrosta ei voi kulkea, joten tyhjä on tässä huomio eikä neutraali tila.
      huomio: kierrospohjat.length === 0 ? { teksti: 'puuttuu', taso: 'varoitus' } : null,
    },
    kalusto: {
      // Odottava pyyntö EI saa jäädä tyhjän tilan taakse. Juuri se on tilanne jossa
      // kohteella ei ole kalustoa: "Ei kalustoa eikä poikkeamia" olisi totta mutta
      // salaisi sen että asialle on jo tehty jotain ja se odottaa toista ihmistä.
      teksti: kalusto.length === 0 && poikkeamat.length === 0 && kalustopyynnot.length === 0
        ? 'Ei kalustoa eikä poikkeamia'
        : `${monikko(kalusto.length, 'esine', 'esinettä')} kohteella${
          kalustopyynnot.length > 0 ? ` · ${monikko(kalustopyynnot.length, 'pyyntö', 'pyyntöä')} odottaa` : ''}${
          poikkeamat.length > 0 ? ` · ${monikko(poikkeamat.length, 'poikkeama', 'poikkeamaa')} avoinna` : ''}`,
      huomio: kadonneet.length > 0
        ? { teksti: 'kalustoa kadonnut', taso: 'kriittinen' }
        : poikkeamat.some((p) => p.vakavuus === 'kriittinen')
          ? { teksti: 'kriittinen poikkeama', taso: 'kriittinen' }
          : poikkeamat.length > 0
            ? { teksti: 'poikkeama', taso: 'varoitus' }
            : kalustopyynnot.length > 0
              ? { teksti: 'pyyntö odottaa', taso: 'varoitus' }
              : null,
    },
    mittaristo: {
      // Mittaristo hakee lukunsa palvelimelta valitulta aikaväliltä (/api/analytiikka),
      // joten tähän ei lasketa lukua: se olisi eri luku kuin se jonka näkymä näyttää.
      teksti: 'Kirjaukset, kierrokset ja hälytykset lukuina',
      huomio: null,
    },
    jaksoraportit: {
      teksti: jaksoraportit.length === 0
        ? 'Ei jaksoraportteja'
        : monikko(jaksoraportit.length, 'raportti', 'raporttia'),
      huomio: luonnokset.length > 0 ? { teksti: 'luonnos', taso: 'varoitus' } : null,
    },
    tiedotteet: {
      teksti: tiedotteet.length === 0
        ? 'Ei voimassa olevia tiedotteita'
        : `${monikko(tiedotteet.length, 'tiedote', 'tiedotetta')} voimassa`,
      huomio: kuittaamatta.length > 0 ? { teksti: 'kuittaamatta', taso: 'varoitus' } : null,
    },
    ohjeet: {
      teksti: ohjeet.length === 0 ? 'Ei ohjekortteja' : monikko(ohjeet.length, 'ohjekortti', 'ohjekorttia'),
      huomio: null,
    },
    skenaariot: {
      teksti: skenaariopohjat.length === 0
        ? 'Ei skenaariopohjia'
        : monikko(skenaariopohjat.length, 'skenaario', 'skenaariota'),
      huomio: skenaariotKesken.length > 0 ? { teksti: 'kesken', taso: 'varoitus' } : null,
    },
    halytykset: {
      teksti: halytykset.length === 0
        ? 'Ei hälytyksiä tässä kohteessa'
        : `${monikko(halytykset.length, 'hälytys', 'hälytystä')} kaikkiaan`,
      huomio: lauenneet.length > 0
        ? { teksti: 'lauennut', taso: 'kriittinen' }
        : ajastimet.length > 0
          ? { teksti: 'ajastin', taso: 'varoitus' }
          : null,
    },
    toimenpide: {
      teksti: toimenpiteet.length === 0
        ? 'Ei toimenpidekirjauksia'
        : `${monikko(toimenpiteet.length, 'kirjaus', 'kirjausta')} · viimeisin ${lyhytAika(viimeisinToimenpide, nyt)}`,
      huomio: null,
    },
    ilmoitus: {
      teksti: ilmoitukset.length === 0
        ? 'Ei tapahtumailmoituksia'
        : `${monikko(ilmoitukset.length, 'ilmoitus', 'ilmoitusta')} · viimeisin ${lyhytAika(viimeisinIlmoitus, nyt)}`,
      huomio: null,
    },
    tiedot: {
      teksti: 'Kooste kohteen tapahtumista ja tiedostoista',
      huomio: null,
    },
  };
}
