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

const tiedosto = process.argv[2];
if (!tiedosto) {
  console.error('Anna lokitiedosto: node tyokalut/akkumittaus.mjs <vuoroloki.txt>');
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

const rivit = readFileSync(tiedosto, 'utf8')
  .split(/\r?\n/)
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
  .sort((a, b) => a.ms - b.ms);

if (rivit.length < 2) {
  console.error(`Lokissa on ${rivit.length} kelvollista riviä. Ei mitattavaa.`);
  process.exit(1);
}

const akulliset = rivit.filter((r) => r.akku !== null);

// --- Purkautumisjaksot ---------------------------------------------------------------
//
// Jakso katkeaa kun akku NOUSEE. Yhden prosentin nousu riittää: akku ei nouse itsestään,
// joten nousu on aina latausta. Laskeva ja tasainen kuuluvat samaan jaksoon.
const jaksot = [];
let nykyinen = [akulliset[0]];
for (let i = 1; i < akulliset.length; i += 1) {
  if (akulliset[i].akku > akulliset[i - 1].akku) {
    jaksot.push(nykyinen);
    nykyinen = [akulliset[i]];
  } else {
    nykyinen.push(akulliset[i]);
  }
}
jaksot.push(nykyinen);

const kesto = (j) => (j[j.length - 1].ms - j[0].ms) / 3_600_000;
const pudotus = (j) => j[0].akku - j[j.length - 1].akku;
const nopeus = (j) => (kesto(j) > 0 ? pudotus(j) / kesto(j) : null);

// Pisin AJALLISESTI, ei riveiltään: rivien määrä kertoo lyönneistä, ei kestosta.
const kelvolliset = jaksot.filter((j) => j.length >= 2 && kesto(j) > 0);
const pisin = kelvolliset.sort((a, b) => kesto(b) - kesto(a))[0];

// Aikaleimat tulostetaan PAIKALLISENA, koska lokiin ne on kirjoitettu paikallisena
// eikä vyöhyketietoa ole. `toISOString` siirtäisi ne UTC:hen, jolloin ruudulla lukisi
// eri kellonaika kuin lokitiedostossa — ja mittauksen alkuhetkeä etsitään lokista.
const pad = (n) => String(n).padStart(2, '0');
const kello = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
  + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const luku = (n, d = 2) => (n === null || !Number.isFinite(n) ? '—' : n.toFixed(d));

console.log(`=== Akkumittaus: ${tiedosto}`);
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
    + `= ${luku(nopeus(j))} %/h${j === pisin ? '   <= pisin' : ''}`,
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
