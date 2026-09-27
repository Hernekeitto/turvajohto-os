// Anastusilmoituksen tuloste (PDF), 27.9.2026.
//
// Kaksi versiota samasta kirjauksesta, koska vastaanottajat tarvitsevat eri asiat:
//
//   poliisi    kaikki tiedot, myös anastajan koko henkilötunnus. Poliisi tunnistaa
//              epäillyn ja käsittelee asian rangaistusvaatimusmenettelyssä, johon
//              kauppiaan suostumus on kirjattu.
//   kauppias   korvausvaatimus ja tapahtuman kuvaus. Henkilötunnuksesta näytetään vain
//              syntymäaikaosa: kauppias tarvitsee henkilön yksilöimiseen nimen ja
//              syntymäajan, eikä koko tunnus kuulu tositteeseen joka kiertää kaupan
//              papereissa. Jos kauppias tarvitsee koko tunnuksen, se tulee poliisilta.
//
// Tuloste on KOPIO tallennetusta kirjauksesta eikä erillinen lomake: kaikki tieto tulee
// tietueesta, ja summat lasketaan samalla funktiolla kuin lomakkeella (anastus.ts), jotta
// paperi ja sovellus eivät voi erota sentilläkään.
import { htmlTeksti, tulostaDokumentti, tulostusDokumentti } from '../shared/tuloste.ts';
import { lomakeRaportille, lomakeTunnusVersioineen } from '../shared/lomakerekisteri.ts';
import { euroina, laskeSummat, riviAlv0Snt } from './anastus.ts';
import type { GuardRaportti } from './tyypit';

export type Vastaanottaja = 'poliisi' | 'kauppias';

// "010190-123A" -> "010190-****". Muu kuin hetun muotoinen arvo peitetään kokonaan.
export const peitaHetu = (hetu: string) => {
  const t = hetu.trim();
  if (!t) return '';
  return /^\d{6}[-+A-Za-z]/.test(t) ? `${t.slice(0, 7)}****` : '••••••••••';
};

const aika = (paikallinen?: string) => {
  if (!paikallinen) return '—';
  const d = new Date(paikallinen);
  if (Number.isNaN(d.getTime())) return paikallinen;
  return d.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
};

const alv = (kanta: number) => `${String(kanta).replace('.', ',')} %`;

const TYYLIT = `
<style>
  table.rivit { width: 100%; border-collapse: collapse; margin: 4px 0 6px; font-size: 10pt; }
  table.rivit th { text-align: left; font-size: 8.5pt; text-transform: uppercase;
    letter-spacing: .06em; color: #64748b; border-bottom: 1px solid #94a3b8; padding: 4px 6px 4px 0; }
  table.rivit td { border-bottom: 1px solid #e2e8f0; padding: 5px 6px 5px 0; vertical-align: top; }
  table.rivit .luku { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  table.summat { margin: 8px 0 14px auto; border-collapse: collapse; font-size: 10pt; }
  table.summat td { padding: 2px 0 2px 24px; font-variant-numeric: tabular-nums; }
  table.summat td.luku { text-align: right; }
  table.summat tr.yht td { border-top: 2px solid #0f172a; font-weight: 700; padding-top: 5px; }
  .ohjeteksti { font-size: 9pt; color: #0f172a; }
  .nimet { display: flex; gap: 28px; margin-top: 14mm; page-break-inside: avoid; }
  .nimet > div { flex: 1; }
  .nimet .viiva { border-bottom: 1px solid #0f172a; height: 12mm; }
  .nimet .selite { font-size: 8.5pt; color: #475569; margin-top: 3px; }
</style>`;

/** Tulosteen HTML. Erillään tulostuksesta, jotta sen voi testata ilman selainta. */
export function anastustulosteHtml(r: GuardRaportti, vastaanottaja: Vastaanottaja): string {
  const tuotteet = r.theftItems || [];
  const kulut = r.theftOtherCosts || [];
  const s = laskeSummat(tuotteet, kulut);
  const nimi = [r.subjectLastName, r.subjectFirstNames].filter(Boolean).join(' ');
  const hetu = r.subjectPersonalId
    ? (vastaanottaja === 'poliisi' ? r.subjectPersonalId : peitaHetu(r.subjectPersonalId))
    : '';
  const suostumus = r.theftPenaltyOrderConsent === true ? 'Kyllä'
    : r.theftPenaltyOrderConsent === false ? 'Ei' : 'Ei vastattu';

  const tuoterivit = tuotteet.map((t) => `<tr>
    <td>${htmlTeksti(t.nimi)}</td>
    <td class="luku">${euroina(Math.round(t.hinta * 100))}</td>
    <td class="luku">${alv(t.alv)}</td>
    <td class="luku">${euroina(riviAlv0Snt(t))}</td>
  </tr>`).join('');

  const kulurivit = kulut.map((k) => `<tr>
    <td>${htmlTeksti(k.selite)}</td>
    <td class="luku">${euroina(Math.round(k.summa * 100))}</td>
  </tr>`).join('');

  // Taulukot ja allekirjoitukset menevät huomio-kenttään, koska se on tulostusDokumentin
  // ainoa kenttä joka ei escapetä sisältöään — kaikki käyttäjän teksti escapetaan tässä.
  const huomio = `${TYYLIT}
<h2>Anastetut tuotteet</h2>
<table class="rivit">
  <thead><tr><th>Tuote</th><th class="luku">Hinta (sis. ALV)</th><th class="luku">ALV</th><th class="luku">ALV 0</th></tr></thead>
  <tbody>${tuoterivit || '<tr><td colspan="4">—</td></tr>'}</tbody>
</table>
<table class="summat">
  <tr><td>Yhteishinta (sis. ALV)</td><td class="luku">${euroina(s.verollinenSnt)}</td></tr>
  <tr><td>ALV</td><td class="luku">${euroina(s.alvSnt)}</td></tr>
  <tr><td>Yhteensä ALV 0</td><td class="luku">${euroina(s.alv0Snt)}</td></tr>
</table>
${kulut.length > 0 ? `<h2>Muut kulut</h2>
<table class="rivit">
  <thead><tr><th>Selite</th><th class="luku">Summa</th></tr></thead>
  <tbody>${kulurivit}</tbody>
</table>` : ''}
<table class="summat">
  <tr><td>Tuotteet ALV 0</td><td class="luku">${euroina(s.alv0Snt)}</td></tr>
  <tr><td>Muut kulut</td><td class="luku">${euroina(s.muutKulutSnt)}</td></tr>
  <tr class="yht"><td>Korvausvaatimus yhteensä</td><td class="luku">${euroina(s.vaatimusSnt)}</td></tr>
</table>
<p class="ohjeteksti">Korvausta vaaditaan tuotteiden arvonlisäverottomasta hinnasta.</p>
${vastaanottaja === 'kauppias' && r.subjectPersonalId
    ? '<p class="ohjeteksti">Henkilötunnuksen loppuosa on peitetty. Koko tunnus on toimitettu poliisille.</p>'
    : ''}
<div class="nimet">
  <div>
    <div class="viiva"></div>
    <div class="selite">Vartijan allekirjoitus · ${htmlTeksti(r.author)}</div>
  </div>
  <div>
    <div class="viiva"></div>
    <div class="selite">Korvauksen vaatijan allekirjoitus</div>
  </div>
</div>`;

  const lomake = lomakeRaportille('guard_theft');
  const alatunniste = [
    lomake ? lomakeTunnusVersioineen(lomake.koodi, '01') : null,
    vastaanottaja === 'poliisi' ? 'Poliisin kappale' : 'Kauppiaan kappale',
    `Tulostettu ${new Date().toLocaleString('fi-FI')}`,
  ].filter(Boolean).join(' · ');

  return tulostusDokumentti({
    otsikko: 'Anastusilmoitus',
    tunniste: r.id.slice(0, 8).toUpperCase(),
    meta: [
      { otsikko: 'Kohde', arvo: r.place },
      { otsikko: 'Anastus tapahtui', arvo: aika(r.theftAt) },
      { otsikko: 'Kassalinja ylitettiin', arvo: aika(r.theftCheckoutAt) },
      { otsikko: 'Kiinniotto', arvo: aika(r.theftDetainedAt) },
      { otsikko: 'Vartija', arvo: r.author },
      { otsikko: 'Korvausvaatimus', arvo: euroina(s.vaatimusSnt) },
    ],
    kentat: [
      { otsikko: 'Kohteen yhteystiedot', arvo: r.theftSiteContact || '—' },
      { otsikko: 'Korvauksen vaatija', arvo: r.theftClaimant || '—' },
      { otsikko: 'Suostuu rangaistusvaatimusmenettelyyn', arvo: suostumus },
      { otsikko: 'Anastaja', arvo: [nimi, hetu].filter(Boolean).join(' · ') || 'Ei tiedossa' },
      { otsikko: 'Vartijan havainnot', arvo: r.description || '—' },
    ],
    huomio,
    alatunniste,
  });
}

export const tulostaAnastusilmoitus = (r: GuardRaportti, vastaanottaja: Vastaanottaja) =>
  tulostaDokumentti(anastustulosteHtml(r, vastaanottaja));
