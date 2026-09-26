// Radiopuhelimen tyyliset äänimerkit PTT-lähetyksen alkamiselle ja loppumiselle (erä 26,
// käyttäjän pyyntö 26.9.2026: "Saammeko lisättyä radiopuhelimen äänimerkit kun lähetys
// alkaa ja loppuu?"). Puhdas Web Audio -oskillaattori lyhyellä verhokäyrällä napsahduksen
// välttämiseksi — ei äänitiedostoa, koska merkki on vain kaksi lyhyttä sävelkorkeutta.
//
// KÄYTTÄJÄT: kayttoPttPalkkia.ts (oma lähetys alkaa/loppuu — sama hookinstanssi ajaa sekä
// työpöydän että mobiilin PTT-painiketta) ja PttYhteenveto.tsx (HÄLKEn kuuntelu: joku
// alkaa/lopettaa puhumisen kanavalla jota kuunnellaan).
//
// OMA AudioContext EIKÄ jaettu aanivastaanotto.ts:n kanssa — se on kuuntelukohtainen ja
// tuhoutuu lopeta()-kutsulla, kun taas tämä on prosessin elinajan yksinkertainen
// singleton. Selaimen autoplay-käytäntö on DOKUMENTTIKOHTAINEN (ei per-AudioContext):
// kun käyttäjä on jo klikannut mitä tahansa sivulla kertaalleen (esim. "Kuuntele"),
// myös TÄMÄN uuden kontekstin resume() toimii — ks. aanivastaanotto.ts:n vastaava
// löydös 26.9.2026 ("PTT-äänikonteksti tila=running" ilman erillistä eleettä juuri
// tälle kontekstille).

let jaettuKonteksti: AudioContext | null = null;

function konteksti(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  if (!jaettuKonteksti) jaettuKonteksti = new AudioContext();
  return jaettuKonteksti;
}

const TAAJUUDET: Record<'alkoi' | 'loppui', number> = { alkoi: 880, loppui: 440 };
const KESTO_S = 0.12;

/**
 * Lyhyt piippaus PTT-lähetyksen alkamiselle ('alkoi', korkeampi sävel) tai
 * loppumiselle ('loppui', matalampi) — sama periaate kuin oikean radiopuhelimen
 * "key/unkey"-äänet. Ei koskaan heitä: puuttuva tai selaimen estämä AudioContext
 * tarkoittaa vain että merkki jää kuulumatta, ei että PTT itse epäonnistuisi.
 */
export function soitaAanimerkki(tyyppi: 'alkoi' | 'loppui'): void {
  try {
    const ctx = konteksti();
    if (!ctx) return;
    void ctx.resume();
    const oskillaattori = ctx.createOscillator();
    const vahvistin = ctx.createGain();
    oskillaattori.type = 'sine';
    oskillaattori.frequency.value = TAAJUUDET[tyyppi];
    const nyt = ctx.currentTime;
    vahvistin.gain.setValueAtTime(0, nyt);
    vahvistin.gain.linearRampToValueAtTime(0.2, nyt + 0.01);
    vahvistin.gain.linearRampToValueAtTime(0, nyt + KESTO_S);
    oskillaattori.connect(vahvistin);
    vahvistin.connect(ctx.destination);
    oskillaattori.start(nyt);
    oskillaattori.stop(nyt + KESTO_S);
  } catch {
    // Kosmeettinen ominaisuus — ei saa koskaan estää itse PTT-toimintoa.
  }
}
