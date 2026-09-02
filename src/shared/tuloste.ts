// Tulosteet (PDF). Jaettu: raportin, työsopimuksen ja tulevien vartiointidokumenttien
// tulostusasu tulee samasta paikasta molemmilla puolilla.

// ---------------------------------------------------------------------------
// Raportin tulostusversio (PDF)
//
// PDF tuotetaan selaimen omalla tulostustoiminnolla ("Tallenna PDF-tiedostona")
// eikä erillisellä PDF-kirjastolla. Perustelut:
//   - ei uutta riippuvuutta (nykyinen bundle on jo ~520 kB)
//   - ääkköset toimivat oikein ilman fontin upottamista; jsPDF vaatisi erillisen
//     TTF-fontin ja pdf-lib rajoittuisi WinAnsi-merkistöön
//   - sivutus, sivunumerot ja marginaalit tulevat selaimelta
//   - sama dokumentti voidaan tulostaa myös paperille viranomaista varten
//   - toimii suljetussa verkossa, koska mitään ei haeta ulkopuolelta
//
// Dokumentti kirjoitetaan omaan ikkunaansa eikä sovelluksen DOMiin, jottei
// sovelluksen oma tyyli vuoda tulosteeseen.
// ---------------------------------------------------------------------------

// Kaikki tulosteeseen menevä teksti on käyttäjän syöttämää, joten se escapetaan.
export const htmlTeksti = (arvo: unknown) =>
  String(arvo ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const PDF_TYYLIT = `
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a; margin: 0; font-size: 11pt; line-height: 1.5; }
  .tunnus { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 18px; gap: 16px; }
  .tunnus .sovellus { font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; color: #475569; }
  .tunnus h1 { font-size: 16pt; margin: 2px 0 0; }
  .tunnus .id { font-family: ui-monospace, "Courier New", monospace; font-size: 10pt;
    text-align: right; white-space: nowrap; }
  .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; margin: 0 0 18px; }
  .meta > div { border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .meta dt { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
  .meta dd { margin: 2px 0 0; font-weight: 600; }
  h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: .06em; color: #475569;
    margin: 18px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
  .kentta { margin-bottom: 10px; page-break-inside: avoid; }
  .kentta .otsikko { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
  .kentta .arvo { white-space: pre-wrap; margin-top: 1px; }
  .tyhja-rivi { border-bottom: 1px solid #94a3b8; height: 22px; margin-top: 4px; }
  .huomio { margin-top: 22px; border-top: 1px solid #e2e8f0; padding-top: 8px;
    font-size: 8.5pt; color: #475569; page-break-inside: avoid; }
  .huomio strong { color: #0f172a; }
  .alatunniste { margin-top: 10px; font-size: 8pt; color: #64748b;
    font-family: ui-monospace, "Courier New", monospace; page-break-inside: avoid; }
  @media screen {
    body { background: #f1f5f9; padding: 24px; }
    .arkki { background: #fff; max-width: 210mm; margin: 0 auto; padding: 18mm 16mm;
      box-shadow: 0 2px 12px rgba(15, 23, 42, .12); }
    .ohje { max-width: 210mm; margin: 0 auto 16px; font-size: 10pt; color: #334155;
      background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; }
  }
  @media print { .ohje { display: none; } .arkki { padding: 0; box-shadow: none; } }
`;

type TulosteMeta = { otsikko: string; arvo?: string };
// tyhja: kentästä piirretään tyhjä kirjoitusrivi arvon sijaan (tyhjät lomakepohjat).
type TulosteKentta = { otsikko: string; arvo?: string; tyhja?: boolean };
type TulosteOsat = {
  otsikko: string;
  tunniste?: string;
  meta: TulosteMeta[];
  kentat: TulosteKentta[];
  huomio: string;
  // Lomaketunnus, pohjaversio ja lakiviite ("TI-01 v1.0 · LYTP 33 § ja VNA 874/2016 18 §").
  // Erillään huomiosta, koska tämä on paperin yksilöivä tieto eikä ohje lukijalle: siitä
  // näkee jälkikäteen millä pohjaversiolla tuloste on tehty.
  alatunniste?: string;
};

// Kokoaa valmiin, itsenäisen HTML-dokumentin.
export const tulostusDokumentti = ({ otsikko, tunniste, meta, kentat, huomio, alatunniste }: TulosteOsat) => `<!doctype html>
<html lang="fi"><head><meta charset="utf-8"><title>${htmlTeksti(tunniste || otsikko)}</title>
<style>${PDF_TYYLIT}</style></head><body>
<div class="arkki">
  <div class="tunnus">
    <div><div class="sovellus">Turvajohto OS</div><h1>${htmlTeksti(otsikko)}</h1></div>
    ${tunniste ? `<div class="id">${htmlTeksti(tunniste)}</div>` : ''}
  </div>
  <dl class="meta">${meta.map((m) => `<div><dt>${htmlTeksti(m.otsikko)}</dt><dd>${htmlTeksti(m.arvo || '—')}</dd></div>`).join('')}</dl>
  ${kentat.map((k) => `<div class="kentta"><div class="otsikko">${htmlTeksti(k.otsikko)}</div>${
    k.tyhja ? '<div class="tyhja-rivi"></div>' : `<div class="arvo">${htmlTeksti(k.arvo)}</div>`
  }</div>`).join('')}
  <div class="huomio">${huomio}</div>
  ${alatunniste ? `<div class="alatunniste">${htmlTeksti(alatunniste)}</div>` : ''}
</div></body></html>`;

// ---------------------------------------------------------------------------
// Yleisöilmoituksen juliste (A4)
//
// Eri dokumentti kuin raporttituloste eikä sen variantti: tämä ei ole asiakirja jota
// arkistoidaan vaan kyltti joka luetaan kolmen metrin päästä. Siksi oma taittonsa —
// iso QR-koodi, muutama sana ja hätänumero — eikä metatietoja, lakiviitteitä tai
// lomaketunnusta.
//
// Juliste tulostetaan mustavalkoisena tarkoituksella: se päätyy toimiston
// lasertulostimeen, ja värillinen tausta söisi väriainetta ja heikentäisi QR-koodin
// kontrastia.
// ---------------------------------------------------------------------------
const JULISTE_TYYLIT = `
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #000; margin: 0; }
  .arkki { display: flex; flex-direction: column; align-items: center; text-align: center;
    min-height: 269mm; padding: 4mm 0; }
  .yla { font-size: 12pt; letter-spacing: .18em; text-transform: uppercase; }
  h1 { font-size: 40pt; line-height: 1.05; margin: 6mm 0 4mm; }
  .ohje { font-size: 18pt; margin: 0 0 8mm; max-width: 150mm; }
  .qr { border: 2px solid #000; padding: 5mm; }
  .qr img { display: block; width: 95mm; height: 95mm; }
  .osoite { font-family: ui-monospace, "Courier New", monospace; font-size: 11pt;
    margin: 5mm 0 0; word-break: break-all; max-width: 150mm; }
  .osoite span { display: block; font-family: inherit; font-size: 10pt; margin-bottom: 1mm; }
  .hata { margin-top: auto; border: 3px solid #000; padding: 4mm 8mm; font-size: 20pt; font-weight: 700; }
  .paikka { margin-top: 6mm; font-size: 10pt; }
  @media screen {
    body { background: #f1f5f9; padding: 20px; }
    .arkki { background: #fff; width: 210mm; margin: 0 auto; padding: 14mm;
      box-shadow: 0 2px 12px rgba(15, 23, 42, .12); }
  }
`;

type JulisteOsat = {
  tapahtuma: string;
  // Julisteen fyysinen sijainti ("Portti 3, itäaita"). Painetaan pienellä alareunaan:
  // se on ylläpitäjää varten, jotta oikea juliste löydetään maastosta kun se pitää
  // vaihtaa tai poistaa.
  paikka: string;
  osoite: string;
  qrDataUri: string;
};

export const julisteDokumentti = ({ tapahtuma, paikka, osoite, qrDataUri }: JulisteOsat) => `<!doctype html>
<html lang="fi"><head><meta charset="utf-8"><title>${htmlTeksti(`Ilmoitusjuliste – ${paikka}`)}</title>
<style>${JULISTE_TYYLIT}</style></head><body>
<div class="arkki">
  <div class="yla">${htmlTeksti(tapahtuma)}</div>
  <h1>Huomasitko jotain?</h1>
  <p class="ohje">Kerro siitä turvallisuushenkilöstölle. Skannaa koodi puhelimen kameralla.</p>
  <div class="qr"><img src="${htmlTeksti(qrDataUri)}" alt=""></div>
  <p class="osoite"><span>Tai kirjoita osoite selaimeen:</span>${htmlTeksti(osoite)}</p>
  <div class="hata">Hätätilanteessa soita 112</div>
  <p class="paikka">${htmlTeksti(paikka)}</p>
</div></body></html>`;

// Tulostaa dokumentin näkymättömän iframen kautta. Tässä EI käytetä
// window.openia: sovelluksen sisäinen selain ja moni työpaikkaympäristö estää
// ponnahdusikkunat oletuksena, jolloin koko toiminto katkeaisi. Iframe toimii
// aina, koska se on osa samaa sivua.
export const tulostaDokumentti = (html: string) => {
  const kehys = document.createElement('iframe');
  kehys.setAttribute('aria-hidden', 'true');
  kehys.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  kehys.srcdoc = html;
  kehys.onload = () => {
    const ikkuna = kehys.contentWindow;
    if (!ikkuna) return;
    // Siivotaan vasta kun tulostusdialogi on suljettu. afterprint ei laukea
    // kaikissa selaimissa, joten varmistuksena myös ajastin.
    let siivottu = false;
    const siivoa = () => { if (!siivottu) { siivottu = true; kehys.remove(); } };
    ikkuna.addEventListener('afterprint', siivoa);
    setTimeout(siivoa, 60000);
    ikkuna.focus();
    ikkuna.print();
  };
  document.body.appendChild(kehys);
};
