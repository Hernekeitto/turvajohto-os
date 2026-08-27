// Päivämäärien ja kellonaikojen käsittely. Jaettu: kirjaukset, vuorot ja raportit
// aikaleimataan samalla logiikalla kummallakin puolella.

// Tämän päivän päivämäärä <input type="date">-kenttään sopivassa muodossa (YYYY-MM-DD).
// toISOString() yksin antaisi UTC-päivän, joka on Suomen aikaa illalla jo eri vuorokausi.
export const paikallinenPaiva = (d = new Date()) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];

// Yhdistää <input type="date"> ja <input type="time"> -arvot paikalliseksi aikaleimaksi.
// Palauttaa null jos kumpikaan ei kelpaa — kutsuja päättää mitä puuttuvalle ajalle tehdään.
export const yhdistaPaivaJaAika = (pvm?: string, klo?: string) => {
  if (!pvm || !klo) return null;
  const [v, kk, pv] = String(pvm).split('-').map(Number);
  const [t, min] = String(klo).split(':').map(Number);
  if ([v, kk, pv, t, min].some((n) => !Number.isFinite(n))) return null;
  const d = new Date(v, kk - 1, pv, t, min, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Laskurin esitysmuoto: "2 pv 04:31:12" tai "04:31:12" kun alle vuorokausi.
// Ottaa itseisarvon, joten samaa funktiota voi käyttää myös ylitetylle ajalle.
export const muotoileLaskuri = (ms: number) => {
  const sekunnit = Math.floor(Math.abs(ms) / 1000);
  const paivat = Math.floor(sekunnit / 86400);
  const kello = [Math.floor((sekunnit % 86400) / 3600), Math.floor((sekunnit % 3600) / 60), sekunnit % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
  return paivat > 0 ? `${paivat} pv ${kello}` : kello;
};

// Kirjautumishetki aloitussivulle. Aiemmin tässä juoksi kello (formatTime(currentTime)),
// joka näytti kellonajalta mutta kertoi vain nykyhetken — ei siis mitään istunnosta.
export const muotoileKirjautumisaika = (iso?: string | null) => {
  if (!iso) return 'ei tiedossa';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'ei tiedossa';
  return d.toLocaleString('fi-FI', {
    day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};
