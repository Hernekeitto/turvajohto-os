// Vuorolokin akkumittauksen lukija (C3).
//
// MIKSI TÄMÄ ON SKRIPTI EIKÄ SILMÄMÄÄRÄINEN LUKU. Aiemmat akkuluvut on laskettu
// ottamalla lokin ensimmäinen ja viimeinen akkuprosentti ja jakamalla kestolla. Se on
// oikein vain jos puhelin purkautui koko ajan — ja juuri sitä ei tiedä ennen kuin katsoo.
// Yksikin kaapeliin kytketty minuutti nostaa prosenttia ja painaa keskiarvon alakanttiin,
// eikä virhe näy tuloksesta mitenkään: se on uskottava luku, vain väärä.
//
// Tämä etsii pisimmän YHTÄJAKSOISEN PURKAUTUMISJAKSON ja laskee kulutuksen siitä. Latausta
// ei siis tarvitse välttää mittauksen aikana — riittää että se tunnistetaan.
//
// Toinen syy: akun ensimmäiset prosentit purkautuvat epälineaarisesti. Skripti raportoi
// sekä koko jakson että 95 %:sta alkavan osuuden, jotta luvut ovat vertailukelpoisia
// aiempien mittausten kanssa (ks. asennus/NATIIVI.md).
//
// AJO:
//   adb shell cat /sdcard/Android/data/fi.turvajohto_os.guard/files/vuoroloki.txt > loki.txt
//   node tyokalut/akkumittaus.mjs loki.txt

import { readFileSync } from 'node:fs';

// Vuoroloki on kiertävä ja kattaa useita vuorokausia. Ilman rajausta skripti vertailee
// keskenään jaksoja jotka eivät liity toisiinsa — eilinen ajo, yön lataus ja tämä vuoro.
// Rajaus on operaattorin tieto: hän tietää milloin kaapeli irtosi, loki ei.
//
//   node tyokalut/akkumittaus.mjs loki.txt --alkaen "2026-09-16 07:50" --asti "2026-09-16 16:00"
const argumentit = process.argv.slice(2);
const lippu = (nimi) => {
  const i = argumentit.indexOf(nimi);
  return i >= 0 ? argumentit[i + 1] : null;
};
// TIEDOSTOJA VOI ANTAA MONTA, ja se on tarpeen eikä mukavuus.
//
// Vuoroloki kiertää 512 kilotavussa: täyttyessään `vuoroloki.txt` nimetään
// `vuoroloki.vanha.txt`:ksi ja kirjoitus jatkuu tyhjään tiedostoon. Kasvuvauhti on noin
// 39 kt/h, joten kierto osuu keskelle pitkää vuoroa — ja silloin mittausikkunan alkupää
// on VANHASSA tiedostossa.
//
// Pelkän `vuoroloki.txt`:n lukeminen ei silloin epäonnistu vaan tuottaa lyhyemmän
// ikkunan, joka näyttää aivan kelvolliselta mittaukselta. Siksi molemmat annetaan aina:
//
//   node tyokalut/akkumittaus.mjs vanha.txt loki.txt
//
// Rivit yhdistetään ja järjestetään ajan mukaan, joten antojärjestyksellä ei ole väliä.
const LIPUT = ['--alkaen', '--asti'];
const tiedostot = argumentit.filter(
  (a, i) => !a.startsWith('--') && !LIPUT.includes(argumentit[i - 1]),
);

const raja = (arvo, nimi) => {
  if (!arvo) return null;
  const d = new Date(arvo.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) {
    console.error(`${nimi}: aikaa "${arvo}" ei voi lukea. Muoto: "2026-09-16 07:50"`);
    process.exit(1);
  }
  return d.getTime();
};
const alkaen = raja(lippu('--alkaen'), '--alkaen');
const asti = raja(lippu('--asti'), '--asti');

if (!tiedostot.length) {
  console.error(
    'Anna lokitiedosto(t): node tyokalut/akkumittaus.mjs [vuoroloki.vanha.txt] vuoroloki.txt'
    + ' [--alkaen "2026-09-16 09:00"] [--asti "…"]',
  );
  process.exit(1);
}

// Rivin muoto (Sydamenlyonti.java):
//   2026-09-16 07:50:33 lyonti n=12 vali_s=60 kulunut_s=720 hereilla_s=31 uni_s=689
//   akku=93 doze=ei akkuvapautus=kylla mittaustila=ei
const AIKA = /^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/;
const kentta = (rivi, nimi) => {
  const osuma = rivi.match(new RegExp(`\\b${nimi}=([^\\s]+)`));
  return osuma ? osuma[1] : null;
};

const rivit = tiedostot
  .flatMap((t) => readFileSync(t, 'utf8').split(/\r?\n/))
  .filter((r) => r.trim() && AIKA.test(r))
  .map((rivi) => {
    const aika = new Date(rivi.match(AIKA)[1].replace(' ', 'T'));
    const akku = Number(kentta(rivi, 'akku'));
    return {
      aika,
      ms: aika.getTime(),
      // akku=-1 tarkoittaa ettei lukemaa saatu. Ei nolla: nolla on akun tila.
      akku: Number.isFinite(akku) && akku >= 0 ? akku : null,
      doze: kentta(rivi, 'doze'),
      vapautus: kentta(rivi, 'akkuvapautus'),
      mittaustila: kentta(rivi, 'mittaustila'),
      tapahtuma: rivi.split(/\s+/)[2] || '',
      vali: Number(kentta(rivi, 'vali_s')),
      rivi,
    };
  })
  .filter((r) => !Number.isNaN(r.ms))
  .filter((r) => (alkaen === null || r.ms >= alkaen) && (asti === null || r.ms <= asti))
  .sort((a, b) => a.ms - b.ms);

if (rivit.length < 2) {
  console.error(`Lokissa on ${rivit.length} kelvollista riviä. Ei mitattavaa.`);
  process.exit(1);
}

const akulliset = rivit.filter((r) => r.akku !== null);

// --- Purkautumisjaksot ---------------------------------------------------------------
//
// Jakso katkeaa kahdesta syystä, ja TOINEN NIISTÄ OPITTIIN VASTA OIKEALLA DATALLA.
//
// 1. Akku NOUSEE. Akku ei nouse itsestään, joten nousu on aina latausta.
//
// 2. Akku seisoo paikallaan liian kauan. Tämä on se jonka ensimmäinen versio jätti
//    tekemättä, ja seuraus oli nolla varoitusta ja täysin uskottava väärä luku:
//    yön laturissa viettänyt puhelin näytti "17,77 h purkautumista, 0,62 %/h", koska
//    100 %:ssa seisova akku ei koskaan noussut eikä siis katkaissut jaksoa. Luku oli
//    kymmenkertaisesti väärässä ja näytti parhaalta mittaukselta koko lokissa.
//
// Syy on datassa eikä tässä: LOKISSA EI OLE LATAUSLIPPUA, joten "laturissa täytenä" ja
// "purkautuu hyvin hitaasti" ovat kirjaimellisesti sama rivi. Ainoa käytettävissä oleva
// erotin on kesto. Todellisella kulutuksella (3–5 %/h) yksi prosentti kestää 12–20
// minuuttia; tunti samaa lukemaa ei ole hidas purkautuminen vaan laturi.
//
// Raja on tarkoituksella reilu: liian tiukka pilkkoisi oikean mittauksen paloiksi, ja
// pilkottu mittaus on vaikeampi huomata vääräksi kuin kokonaan puuttuva.
const TASANNE_MIN = 60;

// 3. Lokissa on AUKKO. Tämäkin löytyi oikealla datalla: vuoro päättyi 21:02 ja alkoi
//    uudelleen 07:50, eikä väliltä ole riviäkään. Ilman tätä katkoa jakso liimautui
//    aukon yli ja tuotti "12,77 h, 100 % → 89 %" — luku joka sisälsi yhdentoista tunnin
//    ajan jolta ei ole mitään tietoa. Palvelu ei kirjaa riviä kertoakseen ettei se
//    kirjaa rivejä, joten aukko on tunnistettava aikaleimoista.
//
//    Lyönti on minuutin välein, joten kymmenen minuuttia on jo selvästi poikkeavaa
//    eikä normaalin vaihtelun rajoissa.
const KATKO_MIN = 10;

const jaksot = [];
let nykyinen = [akulliset[0]];
// Milloin nykyinen lukema nähtiin ensimmäisen kerran — tasanteen pituus mitataan siitä.
let tasanteenAlku = akulliset[0];
const katkaise = (rivi) => {
  jaksot.push(nykyinen);
  nykyinen = [rivi];
  tasanteenAlku = rivi;
};

for (let i = 1; i < akulliset.length; i += 1) {
  const r = akulliset[i];
  if ((r.ms - akulliset[i - 1].ms) / 60_000 > KATKO_MIN) {
    katkaise(r);
    continue;
  }
  if (r.akku > akulliset[i - 1].akku) {
    katkaise(r);
    continue;
  }
  if (r.akku < akulliset[i - 1].akku) {
    tasanteenAlku = r;
  } else if ((r.ms - tasanteenAlku.ms) / 60_000 > TASANNE_MIN) {
    // Tasanne venyi yli rajan: katkaistaan siitä kohdasta jossa lukema viimeksi vaihtui,
    // jotta laturissa seisottu aika ei jää kummankaan jakson kestoon.
    const katkaisukohta = nykyinen.indexOf(tasanteenAlku);
    if (katkaisukohta > 0) nykyinen = nykyinen.slice(0, katkaisukohta + 1);
    katkaise(r);
    continue;
  }
  nykyinen.push(r);
}
jaksot.push(nykyinen);

const kesto = (j) => (j[j.length - 1].ms - j[0].ms) / 3_600_000;
const pudotus = (j) => j[0].akku - j[j.length - 1].akku;
const nopeus = (j) => (kesto(j) > 0 ? pudotus(j) / kesto(j) : null);

// Pisin AJALLISESTI, ei riveiltään: rivien määrä kertoo lyönneistä, ei kestosta.
const kelvolliset = jaksot.filter((j) => j.length >= 2 && kesto(j) > 0);

// Mitattavaksi kelpaa vain jakso jossa akku OIKEASTI laski. Laturissa täytenä seisova
// puhelin tuottaa tasanteen joka kestää tasan TASANNE_MIN minuuttia ja näyttää
// muodollisesti purkautumisjaksolta — nollan prosentin nopeudella. Ilman tätä rajausta
// tunnin laturitasanne voisi voittaa 50 minuutin oikean mittauksen pelkällä kestollaan.
const pisin = kelvolliset
  .filter((j) => pudotus(j) >= 1)
  .sort((a, b) => kesto(b) - kesto(a))[0];

// Aikaleimat tulostetaan PAIKALLISENA, koska lokiin ne on kirjoitettu paikallisena
// eikä vyöhyketietoa ole. `toISOString` siirtäisi ne UTC:hen, jolloin ruudulla lukisi
// eri kellonaika kuin lokitiedostossa — ja mittauksen alkuhetkeä etsitään lokista.
const pad = (n) => String(n).padStart(2, '0');
const kello = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
  + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const luku = (n, d = 2) => (n === null || !Number.isFinite(n) ? '—' : n.toFixed(d));

console.log(`=== Akkumittaus: ${tiedostot.join(' + ')}`);
console.log(`Rivejä ${rivit.length}, akkulukema ${akulliset.length} rivillä`);
console.log(`Loki alkaa ${kello(rivit[0].aika)}, päättyy ${kello(rivit[rivit.length - 1].aika)}`);
console.log(`Kesto yhteensä ${luku((rivit[rivit.length - 1].ms - rivit[0].ms) / 3_600_000)} h`);

if (jaksot.length > 1) {
  console.log(`\nLATAUSKATKOJA: ${jaksot.length - 1} kpl — akku nousi, eli laite oli virrassa.`);
  console.log('Kokonaiskeskiarvo olisi siis harhainen. Luvut lasketaan jaksoittain.');
}

console.log('\n--- Purkautumisjaksot ---');
for (const j of kelvolliset) {
  console.log(
    `${kello(j[0].aika)} → ${kello(j[j.length - 1].aika)}  `
    + `${luku(kesto(j))} h  ${j[0].akku} % → ${j[j.length - 1].akku} %  `
    + `= ${luku(nopeus(j))} %/h`
    + (j === pisin ? '   <= mitattu' : '')
    + (pudotus(j) < 1 ? '   (ei laskua — laturi)' : ''),
  );
}

if (!pisin) {
  console.log('\nEi yhtään kelvollista purkautumisjaksoa.');
  process.exit(0);
}

console.log(`\n=== TULOS: ${luku(nopeus(pisin))} %/h`);
console.log(`    (pisin yhtäjaksoinen purkautuminen, ${luku(kesto(pisin))} h)`);

// Akun ensimmäiset prosentit purkautuvat epälineaarisesti, joten täydestä alkava luku on
// aina hieman optimistinen. Tämä on sama rajaus jota aiemmissa mittauksissa on käytetty.
const alle95 = pisin.filter((r) => r.akku <= 95);
if (alle95.length >= 2 && pisin[0].akku > 95) {
  const j = [alle95[0], ...alle95.slice(1)];
  console.log(`    95 %:sta alkaen: ${luku(nopeus(j))} %/h (${luku(kesto(j))} h)`);
}

// --- Mitä muuta lokista on luettava --------------------------------------------------
//
// Nämä eivät ole koristeita. Akkuluku on tulkittavissa vain jos tiedetään missä tilassa
// puhelin oli: Dozessa vai hereillä, akkuoptimoinnista vapautettuna vai ei, ja oliko
// valvonta vaimennettu mittaustilalla.
const laske = (nimi) => {
  const arvot = {};
  for (const r of rivit) {
    const v = r[nimi] ?? 'puuttuu';
    arvot[v] = (arvot[v] || 0) + 1;
  }
  return Object.entries(arvot).map(([k, v]) => `${k} ${v}`).join(', ');
};

console.log('\n--- Olosuhteet ---');
console.log(`doze:         ${laske('doze')}`);
console.log(`akkuvapautus: ${laske('vapautus')}`);
console.log(`mittaustila:  ${laske('mittaustila')}`);

// Lyöntiväli kertoo pysyikö palvelu hengissä. Katkos näkyy pitkänä välinä kahden rivin
// aikaleimojen VÄLILLÄ — ei siinä mitä rivillä lukee, koska kuollut palvelu ei kirjaa
// riviä kertoakseen kuolleensa.
let pisinVali = 0;
let pisinValiKohta = null;
for (let i = 1; i < rivit.length; i += 1) {
  const vali = (rivit[i].ms - rivit[i - 1].ms) / 1000;
  if (vali > pisinVali) {
    pisinVali = vali;
    pisinValiKohta = rivit[i - 1].aika;
  }
}
console.log(
  `\nPisin katko rivien välillä: ${luku(pisinVali, 0)} s`
  + (pisinValiKohta ? ` (${kello(pisinValiKohta)} jälkeen)` : ''),
);
if (pisinVali > 180) {
  console.log('HUOM: yli kolme minuuttia. Palvelu oli poissa tai laite oli sammuksissa.');
}

const muut = rivit.filter((r) => r.tapahtuma && r.tapahtuma !== 'lyonti');
if (muut.length) {
  console.log(`\n--- Muut tapahtumat (${muut.length}) ---`);
  for (const r of muut.slice(0, 40)) console.log(r.rivi);
  if (muut.length > 40) console.log(`… ja ${muut.length - 40} riviä lisää`);
}
