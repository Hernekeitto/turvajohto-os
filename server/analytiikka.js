// Analytiikan laskenta (erä 9, perusta P8 = aggregointi).
//
// PUHDAS MODUULI: ei levyä, ei oikeuksia, ei Expressiä. Se saa valmiiksi suodatetut
// tietueet ja palauttaa luvut. Syy on sama kuin halytys.js:llä ja kierros.js:llä —
// laskusääntö on se osa jonka on oltava testattavissa ilman palvelinta, ja
// oikeusrajaus tehdään ENNEN tätä (index.js) eikä täällä.
//
// MIKSI LASKENTA ON PALVELIMELLA EIKÄ SELAIMESSA
// Selain näkee vain ne tietueet jotka se on ehtinyt ladata, ja jälkiraportin luvut on
// voitava jäädyttää sellaisina kuin ne olivat laskentahetkellä. Kumpikaan ei onnistu
// jos summa lasketaan siitä taulukosta joka sattuu olemaan välimuistissa.
//
// AGGREGAATTI EI SAA KERTOA ENEMPÄÄ KUIN RIVI. Luvut lasketaan vain niistä tietueista
// jotka käyttäjä saisi lukea rivinä (index.js suodattaa readableDatalla ennen kutsua).
// Muuten "vyöhykkeellä 3 kirjausta" vuotaisi juuri sen tiedon jonka rivikohtainen
// oikeus on tarkoitettu estämään.
//
// Laskenta ei kosketa yhtäkään salattua kenttää: typeId, status, severity, zoneId ja
// aikaleimat ovat selväkielisiä levyllä (store.js: ENCRYPTED_FIELDS), koska niillä
// suodatetaan. Vapaa teksti ei ole tässä mukana eikä sen kuulukaan olla.

// Kaikki aikaperustainen ryhmittely tehdään Suomen ajassa eikä UTC:ssä. Palvelin ajaa
// UTC:ssä, joten UTC-tunneilla laskettu "vilkkain tunti" näyttäisi kesällä kolme tuntia
// väärää aikaa — ja juuri tuntijakauma on se luku jonka perusteella vuoroja mitoitetaan.
const TZ = 'Europe/Helsinki';

// sv-SE antaa ISO-muotoisen päivän (2026-09-03) ilman erillistä paikkausta.
const PAIVA = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const TUNTI = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, hour: '2-digit', hour12: false });

export const paikallinenPaiva = (ms) => PAIVA.format(new Date(ms));
export const paikallinenTunti = (ms) => Number(TUNTI.format(new Date(ms)).slice(0, 2));

// Kirjauksen aikaleima. Ketju on olemassa siksi että aineistossa on kolmea sukupolvea:
// EVENT-puolen kirjaukset käyttävät createdAt:ia, GUARD-puolen luotu-kenttää (sama
// kahtiajako kuin kirjaukset.js: sailytysaikaPaattynyt), ja erän 1 migraatiota vanhemmat
// kirjaukset eivät kumpaakaan — niissä on vain käyttäjän itsensä kirjoittama päivä ja
// kellonaika.
//
// date+time on VIIMEINEN vaihtoehto eikä ensimmäinen: se on se hetki jonka kirjaaja
// ilmoitti tapahtuneeksi, kun taas createdAt on se hetki jolloin kirjaus syntyi.
// Vasteaikaa mitataan kirjauksen syntymisestä, joten oikea järjestys on tämä.
export function luontiaika(tietue) {
  const suora = aikaMs(tietue?.createdAt) ?? aikaMs(tietue?.luotu);
  if (suora !== null) return suora;
  return kentistaMs(tietue?.date, tietue?.time);
}

// ISO-merkkijono millisekunneiksi, tai null. Tyhjä ja roska ovat molemmat null:
// aikaleima jota ei voi lukea ei ole vuoden 1970 alku.
export function aikaMs(arvo) {
  if (typeof arvo !== 'string' || !arvo.trim()) return null;
  const ms = Date.parse(arvo);
  return Number.isNaN(ms) ? null : ms;
}

// Päivä ja kellonaika erillisistä kentistä. Kellonajassa esiintyy sekä '14:10' että
// '19.06' — molemmat ovat käyttäjän itse kirjoittamia eikä kumpaakaan voi hylätä.
// Aika tulkitaan Suomen ajassa, koska käyttäjä kirjoitti sen seinäkellosta.
function kentistaMs(paiva, kello) {
  if (typeof paiva !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(paiva)) return null;
  const osat = String(kello || '').match(/^(\d{1,2})[:.](\d{2})$/);
  const h = osat ? Number(osat[1]) : 12;
  const min = osat ? Number(osat[2]) : 0;
  if (h > 23 || min > 59) return null;
  // Suomen siirtymä vaihtelee kesäajan mukaan, joten sitä ei voi kovakoodata. Tulkitaan
  // aika ensin UTC:nä ja korjataan sillä siirtymällä joka on voimassa juuri silloin.
  const arvio = Date.UTC(...paiva.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n)), h, min);
  return arvio - siirtymaMs(arvio);
}

// Suomen aikavyöhykkeen siirtymä annettuna hetkenä, millisekunteina.
function siirtymaMs(ms) {
  const d = new Date(ms);
  const paikallinen = new Date(d.toLocaleString('en-US', { timeZone: TZ }));
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  return paikallinen.getTime() - utc.getTime();
}

// --- Aikaikkuna --------------------------------------------------------------------

// Ikkuna on aina puoliavoin [alku, loppu): muuten sama kirjaus laskettaisiin kahdesti
// kun peräkkäisiä jaksoja verrataan toisiinsa. Kumpikin pää saa puuttua.
export function teeIkkuna({ alku, loppu } = {}) {
  const alkuMs = aikaMs(alku);
  const loppuMs = aikaMs(loppu);
  if (alkuMs !== null && loppuMs !== null && loppuMs <= alkuMs) return null;
  return { alkuMs, loppuMs, alku: alkuMs === null ? null : alku, loppu: loppuMs === null ? null : loppu };
}

export function osuu(ms, ikkuna) {
  if (ms === null) return false;
  if (!ikkuna) return true;
  if (ikkuna.alkuMs !== null && ms < ikkuna.alkuMs) return false;
  if (ikkuna.loppuMs !== null && ms >= ikkuna.loppuMs) return false;
  return true;
}

// --- Tilastoapurit -----------------------------------------------------------------

// MEDIAANI EIKÄ KESKIARVO. Yksi yön yli auki jäänyt kirjaus siirtää keskiarvon tunneista
// puoleen vuorokauteen, ja luku jonka jokainen tietää olevan väärin jätetään katsomatta.
// Mediaani kertoo tyypillisen tapauksen ja p90 sen hännän jota varten resurssit
// mitoitetaan; molemmat tarvitaan, kumpikaan ei yksin riitä.
//
// Tyhjästä joukosta palautetaan null eikä nollaa. Nolla vasteaika näyttäisi mittaristossa
// täydelliseltä tulokselta silloin kun tapauksia ei ole ollut yhtäkään.
export function tunnusluvut(arvot) {
  const kelvot = (Array.isArray(arvot) ? arvot : []).filter((a) => Number.isFinite(a)).sort((a, b) => a - b);
  if (kelvot.length === 0) return null;
  return {
    n: kelvot.length,
    mediaani: prosenttipiste(kelvot, 0.5),
    p90: prosenttipiste(kelvot, 0.9),
    min: kelvot[0],
    max: kelvot[kelvot.length - 1],
  };
}

// Lähin havainto (nearest-rank) eikä interpoloitu: vasteaika on aina jonkun oikean
// tapauksen kesto, ja keksitty välimuoto olisi luku jota ei ole tapahtunut.
function prosenttipiste(jarjestetty, osuus) {
  const i = Math.min(jarjestetty.length - 1, Math.max(0, Math.ceil(osuus * jarjestetty.length) - 1));
  return jarjestetty[i];
}

// Jakauma laskevassa järjestyksessä. Tasapelit ratkaistaan avaimella, jotta kaksi
// peräkkäistä laskentaa samasta aineistosta antaa saman järjestyksen — vaihtuva
// rivijärjestys näyttäisi muutokselta jota ei ole tapahtunut.
export function jakauma(rivit, avainFn, nimiFn = null) {
  const laskuri = new Map();
  for (const rivi of rivit || []) {
    const id = avainFn(rivi);
    const avain = id === undefined || id === null || id === '' ? null : String(id);
    const nykyinen = laskuri.get(avain);
    if (nykyinen) nykyinen.kpl += 1;
    else laskuri.set(avain, { id: avain, nimi: nimiFn ? nimiFn(rivi, avain) : avain, kpl: 1 });
  }
  return [...laskuri.values()].sort((a, b) => b.kpl - a.kpl || String(a.id).localeCompare(String(b.id)));
}

// --- Kirjaukset --------------------------------------------------------------------

// Poikkeamatyypit joilla tilamalli on mielekäs. Sama lista kuin frontin
// src/shared/kirjaukset.ts: POIKKEAMATYYPIT — sisäänkirjausta tai sääraporttia ei
// "suljeta", joten niitä ei saa laskea mukaan vasteaikaan eikä avoimien määrään.
export const POIKKEAMATYYPIT = [
  'jvaction', 'jvreport', 'firstaid', 'threat', 'fence', 'damage',
  'guard_action', 'guard_jvreport', 'public',
];

export const onPoikkeama = (tietue) => POIKKEAMATYYPIT.includes(tietue?.typeId);

export function kirjaustenKooste(kirjaukset, { ikkuna = null, vyohykkeet = [] } = {}) {
  const kaikki = Array.isArray(kirjaukset) ? kirjaukset : [];
  const ajalliset = [];
  let ajattomia = 0;

  for (const k of kaikki) {
    const ms = luontiaika(k);
    // Aikaleimaton kirjaus ei putoa hiljaa pois. Se ei voi olla aikajakaumassa, mutta
    // sen olemassaolo kerrotaan: mittari joka jättää rivejä mainitsematta on
    // valheellinen tavalla jota lukija ei voi havaita.
    if (ms === null) { ajattomia += 1; continue; }
    if (osuu(ms, ikkuna)) ajalliset.push({ ...k, __ms: ms });
  }

  const nimet = new Map((Array.isArray(vyohykkeet) ? vyohykkeet : []).map((v) => [String(v?.id), v?.nimi || '']));
  const poikkeamat = ajalliset.filter(onPoikkeama);

  const tunneittain = Array.from({ length: 24 }, () => 0);
  for (const k of ajalliset) tunneittain[paikallinenTunti(k.__ms)] += 1;

  return {
    yhteensa: ajalliset.length,
    poikkeamia: poikkeamat.length,
    ajattomia,
    tyypeittain: jakauma(ajalliset, (k) => k.typeId, (k, id) => k.type || id || 'Tuntematon'),
    vyohykkeittain: jakauma(
      ajalliset,
      (k) => k.zoneId,
      (k, id) => (id === null ? 'Ei vyöhykettä' : nimet.get(id) || 'Poistettu vyöhyke'),
    ),
    vakavuuksittain: jakauma(ajalliset.filter((k) => Number(k.severity) >= 1), (k) => Number(k.severity)),
    tiloittain: jakauma(poikkeamat, (k) => k.status || 'open'),
    tunneittain,
    paivittain: jakauma(ajalliset, (k) => paikallinenPaiva(k.__ms)).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    vilkkainTunti: huippu(tunneittain),
  };
}

const huippu = (tunnit) => {
  const max = Math.max(...tunnit);
  return max === 0 ? null : { tunti: tunnit.indexOf(max), kpl: max };
};

// --- Vasteajat ---------------------------------------------------------------------

// Vasteaika = kirjauksen syntymisestä sen sulkemiseen.
//
// AVOIMET RAPORTOIDAAN AINA SULJETTUJEN RINNALLA. Jos mittari laskisi vain suljetut, se
// paranisi sitä mukaa kuin vaikeat tapaukset jäävät auki — hitaimmat putoaisivat
// laskennasta juuri siksi että ne ovat hitaita. Avoimien määrä ja vanhimman ikä ovat
// tässä sen takia, eivät koristeena.
export function vasteajat(kirjaukset, { ikkuna = null, nyt = new Date() } = {}) {
  const hetki = nyt instanceof Date ? nyt.getTime() : Number(nyt);
  const kestot = [];
  let virheellisia = 0;
  let avoimia = 0;
  let vanhinAvoinMs = null;

  for (const k of Array.isArray(kirjaukset) ? kirjaukset : []) {
    if (!onPoikkeama(k)) continue;
    const alku = luontiaika(k);
    if (alku === null || !osuu(alku, ikkuna)) continue;

    const suljettu = aikaMs(k.closedAt);
    if (suljettu === null || k.status !== 'closed') {
      avoimia += 1;
      const ika = hetki - alku;
      if (ika > 0 && (vanhinAvoinMs === null || ika > vanhinAvoinMs)) vanhinAvoinMs = ika;
      continue;
    }
    // Sulkeminen ennen kirjaamista on mahdollinen: kellon siirto tai käsin korjattu
    // aikaleima. Negatiivinen kesto laskisi mediaanin alaspäin, joten se erotetaan
    // omaksi luvukseen sen sijaan että se hylättäisiin äänettömästi.
    if (suljettu < alku) { virheellisia += 1; continue; }
    kestot.push(suljettu - alku);
  }

  return { sulkeminen: tunnusluvut(kestot), avoimia, vanhinAvoinMs, virheellisia };
}

// --- Kierrokset --------------------------------------------------------------------

// Kattavuus = kuitatut tarkistuspisteet kaikista pisteistä joita kierroksilla oli.
// Laskenta on pistetasolla eikä kierroskohtaisten prosenttien keskiarvo: kolmen pisteen
// kierros ja kolmenkymmenen pisteen kierros eivät ole yhtä painavia, ja keskiarvojen
// keskiarvo antaisi niille saman painon.
export function kierrostenKooste(ajot, { ikkuna = null } = {}) {
  const mukana = (Array.isArray(ajot) ? ajot : []).filter((a) => osuu(aikaMs(a?.alkoi), ikkuna));

  let pisteita = 0;
  let kuitattuja = 0;
  const kestot = [];

  for (const ajo of mukana) {
    const pisteet = Array.isArray(ajo.pisteet) ? ajo.pisteet : [];
    pisteita += pisteet.length;
    kuitattuja += pisteet.filter((p) => !!p?.kuitattu).length;
    const alku = aikaMs(ajo.alkoi);
    const loppu = aikaMs(ajo.paattyi);
    if (alku !== null && loppu !== null && loppu > alku) kestot.push(loppu - alku);
  }

  const tiloittain = jakauma(mukana, (a) => a.tila || 'kesken');
  const laske = (tila) => tiloittain.find((t) => t.id === tila)?.kpl || 0;

  return {
    ajoja: mukana.length,
    valmiit: laske('valmis'),
    keskeytetyt: laske('keskeytetty'),
    kesken: laske('kesken'),
    pisteita,
    kuitattuja,
    // Kattavuus on null eikä 0 % kun kierroksia ei ole ajettu: "0 % kattavuus" olisi
    // väite huonosta suorituksesta, kun oikea tieto on ettei mitään ole mitattu.
    kattavuus: pisteita === 0 ? null : kuitattuja / pisteita,
    kestot: tunnusluvut(kestot),
  };
}

// --- Hälytykset --------------------------------------------------------------------

// Kuittausvaste = hälytyksen laukeamisesta siihen kun joku kuittasi sen.
//
// Mitataan LAUKEAMISESTA eikä käynnistämisestä: ajastinhälytys on käynnissä koko sen
// ajan jonka vartija on sopinut olevansa poissa, eikä se aika ole vasteaikaa. Vaste
// alkaa siitä hetkestä kun hälytys näkyi valvomossa.
//
// Perutut jätetään pois: vartijan itse peruma ajastin ei ole tapaus johon olisi
// vastattu, ja mukaan laskettuna ne painaisivat mediaanin lähelle nollaa.
export function halytystenKooste(halytykset, { ikkuna = null } = {}) {
  const mukana = (Array.isArray(halytykset) ? halytykset : []).filter((h) => osuu(aikaMs(h?.alkoi), ikkuna));

  const vasteet = [];
  let eskaloituja = 0;
  for (const h of mukana) {
    if (h?.eskalointi && h.eskalointi.tila !== 'ei') eskaloituja += 1;
    if (h?.tila !== 'kuitattu') continue;
    const laukesi = aikaMs(h.laukesi);
    const paattyi = aikaMs(h.paattyi);
    if (laukesi === null || paattyi === null || paattyi < laukesi) continue;
    vasteet.push(paattyi - laukesi);
  }

  const tiloittain = jakauma(mukana, (h) => h.tila);
  const laske = (tila) => tiloittain.find((t) => t.id === tila)?.kpl || 0;

  return {
    yhteensa: mukana.length,
    tyypeittain: jakauma(mukana, (h) => h.tyyppi),
    avoimia: laske('kaynnissa') + laske('lauennut'),
    kuitattuja: laske('kuitattu'),
    perutut: laske('peruttu'),
    eskaloituja,
    kuittausvaste: tunnusluvut(vasteet),
  };
}

// --- Koko kooste -------------------------------------------------------------------

// Yksi rakenne joka menee sekä mittaristoon että jälkiraporttiin jäädytettynä. Jos
// jälkiraportti laskisi lukunsa itse, sama raportti näyttäisi eri luvut ensi kuussa —
// kirjauksia suljetaan, korjataan ja poistetaan säilytysajan päätyttyä.
export function kooste({
  kirjaukset = [],
  kierrokset = [],
  halytykset = [],
  vyohykkeet = [],
  ikkuna = null,
  nyt = new Date(),
} = {}) {
  return {
    ikkuna: ikkuna ? { alku: ikkuna.alku, loppu: ikkuna.loppu } : { alku: null, loppu: null },
    laskettu: (nyt instanceof Date ? nyt : new Date(nyt)).toISOString(),
    kirjaukset: kirjaustenKooste(kirjaukset, { ikkuna, vyohykkeet }),
    vasteajat: vasteajat(kirjaukset, { ikkuna, nyt }),
    kierrokset: kierrostenKooste(kierrokset, { ikkuna }),
    halytykset: halytystenKooste(halytykset, { ikkuna }),
  };
}
