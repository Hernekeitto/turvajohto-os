// Anastusilmoituksen tuloste (PDF), 27.9.2026. Täydennetty 28.9.2026 vanhan paperipohjan
// kysymyksillä, ja kentät ovat samassa järjestyksessä kuin pohjassa.
//
// Kaksi kappaletta samasta kirjauksesta: poliisin ja kauppiaan. Sisältö on sama, myös
// anastajan koko henkilötunnus molemmissa (käyttäjän päätös 27.9.2026: kauppias
// tarvitsee sen korvausvaatimukseen). Kappaleet eroavat vain alatunnisteen merkinnästä,
// jotta paperista näkee kenelle se on luovutettu.
//
// Tuloste on KOPIO tallennetusta kirjauksesta eikä erillinen lomake: kaikki tieto tulee
// tietueesta, ja summat lasketaan samalla funktiolla kuin lomakkeella (anastus.ts), jotta
// paperi ja sovellus eivät voi erota sentilläkään.
import { htmlTeksti, tulostaDokumentti, tulostusDokumentti } from '../shared/tuloste.ts';
import { lomakeRaportille, lomakeTunnusVersioineen } from '../shared/lomakerekisteri.ts';
import {
  TUOTTEEN_TILAT, euroina, kappaleet, raportinSummat, riviAlv0Snt, riviVerollinenSnt,
} from './anastus.ts';
import type { GuardRaportti } from './tyypit';

export type Vastaanottaja = 'poliisi' | 'kauppias';

const aika = (paikallinen?: string) => {
  if (!paikallinen) return '—';
  const d = new Date(paikallinen);
  if (Number.isNaN(d.getTime())) return paikallinen;
  return d.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
};

const alv = (kanta: number) => `${String(kanta).replace('.', ',')} %`;

const kylla = (v?: boolean | null) => (v === true ? 'Kyllä' : v === false ? 'Ei' : 'Ei vastattu');
const suostuu = (v?: boolean | null) => (v === true ? 'Suostuu' : v === false ? 'Ei' : 'Ei vastattu');

const HENKILOLLISYYS: Record<string, string> = {
  henkilokortti: 'Henkilökortti', ajokortti: 'Ajokortti', passi: 'Passi', ei: 'Ei todettu',
};

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
  const s = raportinSummat(r);
  const vaatii = r.theftClaimsCompensation !== false;
  const nimi = [r.subjectLastName, r.subjectFirstNames].filter(Boolean).join(' ');
  const postiosoite = [r.theftSubjectPostalCode, r.theftSubjectPostOffice].filter(Boolean).join(' ');
  const osoite = [r.subjectAddress, postiosoite].filter(Boolean).join(', ');
  const tuotteidenAlv0 = s.vaatimusSnt - s.muutKulutSnt - s.tuotesuojaSnt;

  const tuoterivit = tuotteet.map((t) => `<tr>
    <td>${htmlTeksti(t.nimi)}</td>
    <td class="luku">${kappaleet(t)}</td>
    <td class="luku">${euroina(Math.round(t.hinta * 100))}</td>
    <td class="luku">${alv(t.alv)}</td>
    <td class="luku">${euroina(riviVerollinenSnt(t))}</td>
    <td class="luku">${euroina(riviAlv0Snt(t))}</td>
    <td>${TUOTTEEN_TILAT.find((x) => x.id === t.tila)?.nimi || ''}</td>
  </tr>`).join('');

  const kulurivit = kulut.map((k) => `<tr>
    <td>${htmlTeksti(k.selite)}</td>
    <td class="luku">${euroina(Math.round(k.summa * 100))}</td>
  </tr>`).join('');

  const vaatimukset = vaatii
    ? `${kulut.length > 0 ? `<table class="rivit">
  <thead><tr><th>Muut kulut</th><th class="luku">Summa</th></tr></thead>
  <tbody>${kulurivit}</tbody>
</table>` : ''}
<table class="summat">
  <tr><td>Korvaamattomat tuotteet ALV 0</td><td class="luku">${euroina(tuotteidenAlv0)}</td></tr>
  <tr><td>Tuotesuojahälyttimet (${r.theftTagsBroken || 0} kpl)</td><td class="luku">${euroina(s.tuotesuojaSnt)}</td></tr>
  <tr><td>Muut kulut</td><td class="luku">${euroina(s.muutKulutSnt)}</td></tr>
  <tr class="yht"><td>Korvaussumma yhteensä</td><td class="luku">${euroina(s.vaatimusSnt)}</td></tr>
</table>
<p class="ohjeteksti">Korvausta vaaditaan tuotteiden arvonlisäverottomasta hinnasta. Jo korvattua tuotetta ei vaadita uudelleen.</p>`
    : '';

  // Taulukot ja allekirjoitukset menevät huomio-kenttään, koska se on tulostusDokumentin
  // ainoa kenttä joka ei escapetä sisältöään — kaikki käyttäjän teksti escapetaan tässä.
  const huomio = `${TYYLIT}
<h2>Tietoja anastetusta omaisuudesta</h2>
<table class="rivit">
  <thead><tr><th>Tavaran nimike</th><th class="luku">Kpl</th><th class="luku">Kpl-hinta</th><th class="luku">ALV</th><th class="luku">Yhteensä</th><th class="luku">ALV 0</th><th>Tila</th></tr></thead>
  <tbody>${tuoterivit || '<tr><td colspan="7">—</td></tr>'}</tbody>
</table>
<table class="summat">
  <tr><td>Anastetun omaisuuden arvo (sis. ALV)</td><td class="luku">${euroina(s.verollinenSnt)}</td></tr>
  <tr><td>Turmeltuneen omaisuuden arvo</td><td class="luku">${euroina(s.turmeltunutSnt)}</td></tr>
  <tr><td>Korvatun omaisuuden arvo</td><td class="luku">${euroina(s.korvattuSnt)}</td></tr>
  <tr><td>ALV</td><td class="luku">${euroina(s.alvSnt)}</td></tr>
  <tr><td>Yhteensä ALV 0</td><td class="luku">${euroina(s.alv0Snt)}</td></tr>
</table>
<h2>Vaatimukset</h2>
<p class="ohjeteksti">Asianomistaja esittää korvausvaatimuksen: <strong>${kylla(r.theftClaimsCompensation)}</strong></p>
${vaatimukset}
<div class="nimet">
  <div>
    <div class="viiva"></div>
    <div class="selite">Ilmoittajan allekirjoitus · ${htmlTeksti(r.theftReporter || r.author)}</div>
  </div>
  <div>
    <div class="viiva"></div>
    <div class="selite">Asianomistajan allekirjoitus</div>
  </div>
</div>`;

  const lomake = lomakeRaportille('guard_theft');
  const alatunniste = [
    lomake ? lomakeTunnusVersioineen(lomake.koodi, '01') : null,
    vastaanottaja === 'poliisi' ? 'Poliisin kappale' : 'Kauppiaan kappale',
    `Tulostettu ${new Date().toLocaleString('fi-FI')}`,
  ].filter(Boolean).join(' · ');

  // Kentät paperipohjan järjestyksessä. Tyhjät vapaaehtoiset kentät jätetään pois, jotta
  // tuloste pysyy luettavana; kyllä/ei-kysymykset näytetään aina, koska "ei vastattu" on
  // tieto sekin.
  const kentta = (otsikko: string, arvo?: string | null, aina = false) =>
    (aina || (arvo && arvo.trim()) ? [{ otsikko, arvo: arvo?.trim() || '—' }] : []);

  return tulostusDokumentti({
    otsikko: 'Anastusilmoitus',
    tunniste: r.id.slice(0, 8).toUpperCase(),
    meta: [
      { otsikko: 'Tapahtumapaikka', arvo: r.theftPlace || r.place },
      { otsikko: 'Anastus tapahtui', arvo: aika(r.theftAt) },
      { otsikko: 'Kassalinja ylitettiin', arvo: aika(r.theftCheckoutAt) },
      { otsikko: 'Kiinniottopaikka', arvo: r.theftDetentionPlace || '—' },
      { otsikko: 'Kiinniotto', arvo: aika(r.theftDetainedAt) },
      { otsikko: 'Korvausvaatimus', arvo: vaatii ? euroina(s.vaatimusSnt) : 'Ei esitetty' },
    ],
    kentat: [
      ...kentta('Kohteen yhteystiedot', r.theftSiteContact),
      ...kentta('Asianomistaja (liikkeen toiminimi ja katuosoite)', r.theftClaimant, true),
      ...kentta('Y-tunnus', r.theftBusinessId),
      ...kentta('Rangaistusta vaatii', r.theftPenaltyClaimant),
      ...kentta('Kirjallinen menettely', suostuu(r.theftWrittenProcedureConsent), true),
      ...kentta('Rangaistusvaatimusmenettely', suostuu(r.theftPenaltyOrderConsent), true),
      ...kentta('Anastustapa', r.theftMethod),
      ...kentta('Vartijan havainnot', r.description, true),
      ...kentta('Kiinniotetun ajoneuvo', r.theftVehicle),
      ...(r.theftTagsBroken
        ? kentta('Rikottuja tuotesuojahälyttimiä', `${r.theftTagsBroken} kpl, korvattava summa ${euroina(s.tuotesuojaSnt)}`)
        : []),
      ...kentta('Kiinniotettu käyttäytyi väkivaltaisesti', kylla(r.theftViolent), true),
      ...(r.theftResistedGuard ? kentta('Järjestystä ylläpitävän henkilön vastustaminen', 'Kyllä') : []),
      ...kentta('Kiinniotettu', [nimi, r.subjectPersonalId].filter(Boolean).join(' · ') || 'Ei tiedossa', true),
      ...kentta('Osoite', osoite),
      ...kentta('Henkilöllisyys todettu', HENKILOLLISYYS[r.theftIdVerified || ''] || 'Ei vastattu', true),
      ...kentta('Holhooja, osoite ja puhelin', r.theftGuardian),
      ...kentta('Muita tietoja', r.theftOtherInfo),
      ...kentta('Mukana olleet', r.theftAccompanying),
      ...kentta('Ilmoittaja', r.theftReporter || r.author, true),
      ...kentta('Kiinniottaja', r.theftDetainer),
      ...kentta('Todistajat', r.theftWitnesses),
      ...kentta('Videotallenne', r.theftVideo ? 'On' : 'Ei', true),
      ...kentta('Ilmoitettu poliisille', kylla(r.theftReportedToPolice), true),
      ...kentta('Luovutettu poliisille', kylla(r.theftHandedToPolice), true),
      ...kentta('Muut toimenpiteet', r.theftOtherActions),
      ...(r.theftReleasedAt || r.theftReleasedBy
        ? kentta('Vapautettu poliisin luvalla', [r.theftReleasedAt ? aika(r.theftReleasedAt) : '', r.theftReleasedBy || '']
          .filter(Boolean).join(' · '))
        : []),
    ],
    huomio,
    alatunniste,
  });
}

export const tulostaAnastusilmoitus = (r: GuardRaportti, vastaanottaja: Vastaanottaja) =>
  tulostaDokumentti(anastustulosteHtml(r, vastaanottaja));
