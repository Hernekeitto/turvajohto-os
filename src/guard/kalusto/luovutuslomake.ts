// Kaluston luovutustosite: paperi jonka vartija allekirjoittaa.
//
// KIRJAUS ENSIN, PAPERI SITTEN. Luovutus tapahtuu sovelluksessa (siirto henkilölle), ja
// tämä tuloste on siitä otettu tosite. Järjestys on tärkeä eikä sattuma: jos paperi
// tulostettaisiin ensin ja kirjaus tehtäisiin "kun ehtii", rekisteri ja todellisuus
// eroaisivat juuri siinä hetkessä jolloin tieto on tärkein — eli kun tavara on jo
// lähtenyt kädestä.
//
// Tosite on siksi LUETTELO REKISTERIN TILASTA eikä lomake johon kirjoitetaan: kaikki
// kentät on täytetty valmiiksi, ja tyhjää on vain allekirjoitusriveillä. Tyhjä
// täytettävä lomake olisi toinen totuus samasta asiasta.
//
// Allekirjoitettu paperi skannataan kohteen tiedostoihin tai arkistoidaan mapissa —
// sovellus ei ota sitä vastaan, eikä sen kuulukaan: skannaus on jo olemassa oleva reitti
// (guardFiles), ja piirretty kosketusnäyttöallekirjoitus olisi heikompi todiste kuin
// nimikirjoitus paperilla.

import { muotoileTunniste } from '../../shared/tunnisteet';
import { htmlTeksti, tulostaDokumentti, tulostusDokumentti } from '../../shared/tuloste';
import { LAJIT } from './lajit';
import type { KalustoTietue } from './tyypit';

// Yksi rivi tositteen taulukossa. Sarjanumero ja koko ovat mukana, koska tosite on
// todiste yksilöidystä esineestä: "takki" ei yksilöi mitään, "TJ-ASU-0117, koko L" yksilöi.
const rivi = (esine: KalustoTietue) => {
  const lisat = [
    esine.alalaji,
    typeof esine.lisatiedot?.koko === 'string' && esine.lisatiedot.koko ? `koko ${esine.lisatiedot.koko}` : '',
    esine.sarjanumero ? `sarjanro ${esine.sarjanumero}` : '',
    typeof esine.lisatiedot?.lupanumero === 'string' && esine.lisatiedot.lupanumero
      ? `lupa ${esine.lisatiedot.lupanumero}` : '',
  ].filter(Boolean).join(' · ');
  return `<tr>
    <td class="tunnus">${htmlTeksti(esine.tunnus)}</td>
    <td>${htmlTeksti(esine.nimi)}${lisat ? `<br><span class="lisat">${htmlTeksti(lisat)}</span>` : ''}</td>
    <td>${htmlTeksti(LAJIT[esine.laji]?.nimi || esine.laji)}</td>
    <td class="kuittaus"></td>
  </tr>`;
};

// Taulukko ja allekirjoitusrivit menevät `huomio`-kenttään, koska se on ainoa
// tulostusDokumentin kenttä joka ei escapetä sisältöään (ks. shared/tuloste.ts) —
// kaikki käyttäjän syöttämä teksti escapetaan täällä erikseen htmlTeksti-funktiolla.
const sisalto = (esineet: KalustoTietue[], vastaanottaja: string) => `
<style>
  table.kalusto { width: 100%; border-collapse: collapse; margin: 4px 0 18px; font-size: 10pt; }
  table.kalusto th { text-align: left; font-size: 8.5pt; text-transform: uppercase;
    letter-spacing: .06em; color: #64748b; border-bottom: 1px solid #94a3b8; padding: 4px 6px 4px 0; }
  table.kalusto td { border-bottom: 1px solid #e2e8f0; padding: 6px 6px 6px 0; vertical-align: top; }
  table.kalusto td.tunnus { font-family: ui-monospace, "Courier New", monospace; white-space: nowrap; }
  table.kalusto td.kuittaus { width: 22mm; border-bottom: 1px solid #94a3b8; }
  table.kalusto .lisat { color: #475569; font-size: 8.5pt; }
  .ehdot { font-size: 9pt; color: #0f172a; line-height: 1.55; }
  .ehdot li { margin-bottom: 3px; }
  .nimet { display: flex; gap: 28px; margin-top: 16mm; page-break-inside: avoid; }
  .nimet > div { flex: 1; }
  .nimet .viiva { border-bottom: 1px solid #0f172a; height: 12mm; }
  .nimet .selite { font-size: 8.5pt; color: #475569; margin-top: 3px; }
</style>
<table class="kalusto">
  <thead><tr><th>Tunnus</th><th>Esine</th><th>Laji</th><th>Kuittaus</th></tr></thead>
  <tbody>${esineet.map(rivi).join('')}</tbody>
</table>
<div class="ehdot">
  <strong>Vastaanottajan vastuu</strong>
  <ul>
    <li>Kalusto on vartioimisliikkeen omaisuutta ja luovutetaan työtehtävien hoitamista varten.</li>
    <li>Kalustoa ei luovuteta edelleen kolmannelle eikä käytetä työtehtävien ulkopuolella.</li>
    <li>Katoamisesta, vaurioitumisesta ja anastuksesta on ilmoitettava esimiehelle viipymättä.</li>
    <li>Kalusto palautetaan työsuhteen päättyessä tai pyydettäessä.</li>
    <li>Voimankäyttövälineen hallussapito edellyttää voimassa olevaa koulutusta ja kortin mukanaoloa.</li>
  </ul>
</div>
<div class="nimet">
  <div>
    <div class="viiva"></div>
    <div class="selite">Luovuttajan allekirjoitus ja nimenselvennys</div>
  </div>
  <div>
    <div class="viiva"></div>
    <div class="selite">Vastaanottajan allekirjoitus · ${htmlTeksti(vastaanottaja)}</div>
  </div>
</div>`;

type Vastaanottaja = { nimi: string; displayId?: number | null };

/**
 * Tulostaa luovutustositteen yhdelle henkilölle luovutetusta kalustosta.
 *
 * `esineet` on se joukko joka henkilöllä ON REKISTERISSÄ juuri nyt, ei valinta lomakkeelle.
 */
export function tulostaLuovutuslomake({
  vastaanottaja, esineet, luovuttaja, paiva = new Date(),
}: {
  vastaanottaja: Vastaanottaja;
  esineet: KalustoTietue[];
  luovuttaja: string;
  paiva?: Date;
}) {
  const tunniste = muotoileTunniste(vastaanottaja.displayId);
  const pvm = paiva.toLocaleDateString('fi-FI');

  tulostaDokumentti(tulostusDokumentti({
    otsikko: 'Kaluston luovutustosite',
    // Tunnisteeksi päivä ja henkilön numero eikä juokseva tositenumero: tosite on kopio
    // rekisterin tilasta, ja rekisterissä on jo jokaisen esineen oma historia. Juokseva
    // numero lupaisi arkiston jota ei ole.
    tunniste: `${pvm}${tunniste ? ` · ${tunniste}` : ''}`,
    meta: [
      { otsikko: 'Vastaanottaja', arvo: `${vastaanottaja.nimi}${tunniste ? ` ${tunniste}` : ''}` },
      { otsikko: 'Luovuttaja', arvo: luovuttaja },
      { otsikko: 'Päiväys', arvo: pvm },
      { otsikko: 'Esineitä', arvo: String(esineet.length) },
    ],
    kentat: [],
    huomio: sisalto(esineet, vastaanottaja.nimi),
    alatunniste: 'Turvajohto GUARD · kalustopankki · tosite vastaa rekisterin tilaa tulostushetkellä',
  }));
}
