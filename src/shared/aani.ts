// Äänimerkit ja värinä (erä 23).
//
// Yksi moduuli molemmille puolille: hälytyskeskuksen lyhyt piippaus ja kentän toistuva
// hälytysääni ovat sama koneisto eri kestolla, ja kaksi toteutusta erkanisi toisistaan.
//
// --- MIKSI OSKILLAATTORI EIKÄ ÄÄNITIEDOSTO ----------------------------------------
//
// mp3 pitäisi ladata verkosta juuri sillä hetkellä kun sitä tarvitaan — eli silloin kun
// verkko voi olla poikki. Oskillaattori on selaimessa valmiina.
//
// --- MIKSI TÄMÄ EI KORVAA NATIIVIA -------------------------------------------------
//
// Selain ei voi herättää sammunutta puhelinta. Kun sovellus on taustalla, Chrome
// jäädyttää välilehden muutamassa minuutissa: ajastin ei laukea, ääntä ei kuulu eikä
// mitään tapahdu ennen kuin käyttäjä avaa sovelluksen. Tämä moduuli kattaa sen tapauksen
// jossa sovellus on auki — ja se on vartijan tavallisin tila työvuoron aikana — mutta
// taskussa nukkuvaan puhelimeen tarvitaan natiivi (asennus/NATIIVI.md: täysruutuhälytys)
// ja push. Käyttöliittymän on SANOTTAVA tämä ääneen: hiljainen hälytyssovellus, joka
// näyttää valvovalta, on pahempi kuin sellainen jonka rajat tietää.

// Yksi konteksti koko sovellukselle. Selain rajoittaa avoimien kontekstien määrää, ja
// uuden luominen joka äänimerkille johtaisi siihen että ääni lakkaa toimimasta vuoron
// puolivälissä.
let konteksti: AudioContext | null = null;

// Onko käyttäjä sallinut äänen tässä istunnossa. Selain vaatii eleen, ja ele on tämän
// kytkeminen päälle (tai vuoron aloitus, ks. varmistaAani).
let sallittu = false;

let toistoAjastin: ReturnType<typeof setInterval> | null = null;
let lopetusAjastin: ReturnType<typeof setTimeout> | null = null;

// Kuinka kauan hälytysääni soi jos kukaan ei kuittaa. Kaksi minuuttia: tarpeeksi pitkä
// että puhelin ehditään kaivaa taskusta ja katsoa, tarpeeksi lyhyt ettei se soi koko
// vuoroa autossa jos vartija ei ole kuulolla. Näkymän punainen palkki jää joka
// tapauksessa — ääni on herätys, ei tilatieto.
const SOITON_MAX_MS = 2 * 60 * 1000;

// Toistoväli. Kolme sekuntia on hälytinlaitteiden tavallinen tahti: tarpeeksi tiheä
// ettei sitä luule satunnaiseksi ääneksi, tarpeeksi harva ettei se peitä puhetta.
const TOISTO_MS = 3000;

function haeKonteksti(): AudioContext | null {
  try {
    const Konteksti = window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Konteksti) return null;
    if (!konteksti || konteksti.state === 'closed') konteksti = new Konteksti();
    return konteksti;
  } catch {
    return null;
  }
}

function sointu(alkuS: number, taajuus: number, kesto = 0.22, voimakkuus = 0.12) {
  const ctx = haeKonteksti();
  if (!ctx) return;
  try {
    const oskillaattori = ctx.createOscillator();
    const gain = ctx.createGain();
    oskillaattori.type = 'square';
    oskillaattori.frequency.value = taajuus;
    gain.gain.value = voimakkuus;
    oskillaattori.connect(gain);
    gain.connect(ctx.destination);
    oskillaattori.start(ctx.currentTime + alkuS);
    oskillaattori.stop(ctx.currentTime + alkuS + kesto);
  } catch {
    // Ääni on lisä eikä toiminto: sen epäonnistuminen ei saa kaataa näkymää.
  }
}

/**
 * Sallii äänen. KUTSUTTAVA KÄYTTÄJÄN ELEESTÄ (painallus) — selain hylkää äänen muuten,
 * eikä siitä kerrota virheenä vaan hiljaisuutena.
 *
 * Palauttaa tiedon siitä onnistuiko lupa. Kutsuja voi näyttää sen: "ääni ei ole päällä"
 * on tieto jonka vartijan on saatava tietää ennen kuin hän luottaa siihen.
 */
export async function varmistaAani(): Promise<boolean> {
  const ctx = haeKonteksti();
  if (!ctx) return false;
  try {
    // Käynnistynyt konteksti voi olla 'suspended' myös luvan jälkeen (välilehti oli
    // taustalla), joten resume kutsutaan joka kerta eikä vain ensimmäisellä.
    if (ctx.state === 'suspended') await ctx.resume();
    sallittu = ctx.state === 'running';
    return sallittu;
  } catch {
    return false;
  }
}

export const onAaniSallittu = () => sallittu;

/** Lyhyt kolmen sävelen merkki. Hälytyskeskuksen uusi lauennut hälytys. */
export function piippaa() {
  sointu(0, 880);
  sointu(0.3, 1175);
  sointu(0.6, 880);
}

function varise(kuvio: number[]) {
  try {
    // Värinä on Androidilla se osa joka toimii myös äänettömässä tilassa, ja vartijan
    // puhelin on usein äänettömällä. Kaikki selaimet eivät tue tätä lainkaan.
    navigator.vibrate?.(kuvio);
  } catch {
    // Ks. yllä.
  }
}

/**
 * Toistuva hälytysääni. Soi kunnes `lopetaHalytys` kutsutaan tai kahden minuutin katto
 * tulee vastaan.
 *
 * Uusi kutsu NOLLAA ajastimet eikä käynnistä toista soittoa päällekkäin: kaksi hälytystä
 * peräkkäin ei saa tarkoittaa kahta päällekkäistä ääntä, koska silloin kumpaakaan ei
 * erota.
 */
export function aloitaHalytys() {
  lopetaHalytys();
  if (!sallittu) return;

  const jakso = () => {
    sointu(0, 988, 0.18, 0.16);
    sointu(0.25, 1319, 0.18, 0.16);
    sointu(0.5, 988, 0.18, 0.16);
    varise([300, 120, 300]);
  };
  jakso();
  toistoAjastin = setInterval(jakso, TOISTO_MS);
  lopetusAjastin = setTimeout(lopetaHalytys, SOITON_MAX_MS);
}

export function lopetaHalytys() {
  if (toistoAjastin) {
    clearInterval(toistoAjastin);
    toistoAjastin = null;
  }
  if (lopetusAjastin) {
    clearTimeout(lopetusAjastin);
    lopetusAjastin = null;
  }
  varise(0 as unknown as number[]);
}

export const soikoHalytys = () => toistoAjastin !== null;

/**
 * Järjestelmäilmoitus. Eri asia kuin ääni: ilmoitus jää ruudulle näkyviin senkin
 * jälkeen kun ääni on vaiennut, ja se näkyy myös lukitulla ruudulla.
 *
 * EI LUPAA KYSYMISTÄ TÄSSÄ. Lupa on kysyttävä käyttäjän eleestä (ks. `pyydaIlmoituslupa`),
 * ja kysyminen väärässä kohdassa polttaa luvan pysyvästi: kertaalleen evätty
 * ilmoituslupa ei palaa ilman selaimen asetuksia.
 */
export function ilmoita(otsikko: string, runko: string, tag?: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification(otsikko, { body: runko, tag, requireInteraction: true });
  } catch {
    // Ilmoitusrajapinta puuttuu tai on estetty. Ääni ja ruutu kertovat silti.
  }
}

export async function pyydaIlmoituslupa(): Promise<boolean> {
  try {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}
