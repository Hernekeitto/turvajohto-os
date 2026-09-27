// Uuden tai nollatun tunnuksen tietojen toimitus työntekijälle kahta eri kanavaa pitkin:
//
//   SÄHKÖPOSTI: käyttäjätunnus, kirjautumisosoite ja uudelle tunnukselle Authenticator-
//               avain (QR ja tekstinä) — EI KOSKAAN salasanaa
//   TEKSTIVIESTI: pelkkä väliaikainen salasana — EI KOSKAAN tunnusta eikä avainta
//
// Authenticator-avain on toinen tunnistustekijä, joten se kulkee ERI kanavaa kuin
// salasana. Tunnus on arvattavissa nimestä (sukunimi_etunimi): jos salasana ja avain
// kulkisivat molemmat tekstiviestillä, pelkkä pääsy tekstiviesteihin riittäisi koko
// tunnukseen (päätös 27.9.2026). Kirjautuminen vaatii koodin heti salasanan jälkeen
// (index.js: /api/login), joten ilman avainta uusi käyttäjä ei pääse sisään lainkaan.
//
// Kumpikaan viesti ei yksin riitä kirjautumiseen. Tekstiviesti kulkee salaamattomassa
// televerkossa ja sähköposti voi päätyä väärään laatikkoon; kanavien erottelu tarkoittaa,
// että vuoto yhdessä ei vielä anna pääsyä. Tämä on tämän moduulin koko tarkoitus, ja
// viestipohjien testit (tunnuslahetys.test.js) valvovat sitä.
//
// Osoite ja numero luetaan AINA palvelimella työntekijätietueesta, ei pyynnön rungosta —
// sama periaate kuin hätäviesteissä (sms.js). Muuten pääkäyttäjän istunnolla voisi
// ohjata väliaikaisen salasanan mihin numeroon tahansa.
//
// Lähetysfunktiot annetaan parametreina, jotta moduulin voi testata ilman verkkoa.

import { normalisoiNumero } from './bulksms.js';
import { kelpaaOsoitteeksi } from './sahkoposti.js';

export const KANAVAT = ['sahkoposti', 'sms'];

const PUOLEN_POLKU = { guard: 'guard', event: 'event' };

export function kirjautumisosoite(puoli) {
  const juuri = (process.env.PUBLIC_URL || 'https://turvajohto-os.fi').replace(/\/+$/, '');
  const polku = PUOLEN_POLKU[puoli];
  return polku ? `${juuri}/${polku}` : `${juuri}/`;
}

// Numeron loppu näytetään sähköpostissa ("päättyy 67"), jotta vastaanottaja tietää mihin
// salasana tuli, mutta koko numeroa ei kirjoiteta viestiin.
export function peitaNumero(numero) {
  const s = String(numero || '');
  return s.length >= 2 ? `••• ${s.slice(-2)}` : '•••';
}

// Avain neljän merkin ryhmiin: käsin syötettäessä pitkä yhtenäinen base32-jono on helppo
// kirjoittaa väärin. Authenticator-sovellukset hyväksyvät välilyönnit.
export function ryhmitaAvain(avain) {
  return String(avain || '').replace(/\s+/g, '').match(/.{1,4}/g)?.join(' ') || '';
}

const htmlSuojaa = (t) => String(t).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// syy: 'luotu' (uusi tunnus), 'nollattu' (salasana nollattu) tai 'authenticator'
// (Authenticator nollattu, uusi avain; salasana ei muuttunut).
// totp = { secret, qrPng, otpauthUri } uudelle tunnukselle ja Authenticatorin nollaukselle.
export function rakennaSahkoposti({ nimi, username, osoite, syy, numeroPeitetty, totp = null }) {
  const vainAvain = syy === 'authenticator';
  const tervehdys = nimi ? `Hei ${nimi},` : 'Hei,';
  const alku = {
    nollattu: 'Turvajohto OS -tunnuksesi salasana on nollattu.',
    authenticator: 'Turvajohto OS -tunnuksesi Authenticator-avain on vaihdettu. Vanha avain ei enää '
      + 'toimi, joten lisää tili sovellukseen uudelleen alla olevilla tiedoilla. Salasanasi ei muuttunut.',
  }[syy] || 'Sinulle on luotu tunnus Turvajohto OS -järjestelmään.';
  const salasanarivi = numeroPeitetty
    ? `Väliaikainen salasana lähetetään erikseen tekstiviestinä numeroosi ${numeroPeitetty}.`
    : 'Väliaikainen salasana toimitetaan sinulle erikseen.';
  const authKappale = totp
    ? [
      'Authenticator-sovellus (tarvitaan jokaisella kirjautumisella):',
      vainAvain
        ? '1. Poista sovelluksesta vanha Turvajohto OS -tili, jos se on siellä.'
        : '1. Asenna puhelimeesi Google Authenticator tai Microsoft Authenticator.',
      '2. Lisää tili skannaamalla tämän viestin QR-koodi, tai syötä avain käsin',
      `   (aikaperusteinen): ${ryhmitaAvain(totp.secret)}`,
      '3. Kirjautuessa annat salasanan jälkeen sovelluksen näyttämän 6-numeroisen koodin.',
      'Poista tämä viesti, kun olet lisännyt tilin sovellukseen.',
    ].join('\n')
    : null;
  const kappaleet = [
    tervehdys,
    alku,
    `Käyttäjätunnus: ${username}\nKirjautuminen: ${osoite}`,
    ...(vainAvain ? [] : [salasanarivi]),
    ...(authKappale ? [authKappale] : []),
    ...(vainAvain ? [] : ['Ensimmäisellä kirjautumisella vaihdat väliaikaisen salasanan omaksesi.']),
    'Jos et odottanut tätä viestiä, ilmoita asiasta esihenkilöllesi.',
    'Tähän viestiin ei tarvitse vastata.',
  ];
  const text = kappaleet.join('\n\n');
  const subject = {
    nollattu: 'Turvajohto OS: salasana nollattu',
    authenticator: 'Turvajohto OS: uusi Authenticator-avain',
  }[syy] || 'Turvajohto OS: käyttäjätunnuksesi';
  if (!totp) return { subject, text };

  // HTML-versio vain QR-koodin takia. Kuva on viestin sisäinen liite (cid), ei ulkoinen
  // osoite: sähköpostiohjelmat estävät ulkoiset kuvat, eikä avain saa kulkea URL:ssa.
  const osat = kappaleet.map((k) => {
    const p = `<p>${htmlSuojaa(k).replace(/\n/g, '<br>')}</p>`;
    if (k !== authKappale) return p;
    // Puhelimella luettavasta viestistä QR:ää ei voi skannata samalla laitteella, joten
    // otpauth-linkki avaa Authenticatorin suoraan. Avain on jo tekstinä samassa viestissä,
    // joten linkki ei vie sitä minnekään uuteen paikkaan.
    const linkki = totp.otpauthUri
      ? `<p><a href="${htmlSuojaa(totp.otpauthUri)}">Luetko tätä puhelimella? Lisää tili napauttamalla tästä.</a></p>`
      : '';
    return `${p}<p><img src="cid:authenticator-qr" alt="Authenticator QR-koodi" width="220" height="220"></p>${linkki}`;
  });
  return {
    subject,
    text,
    html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.5">${osat.join('')}</div>`,
    attachments: [{ filename: 'authenticator-qr.png', content: totp.qrPng, contentType: 'image/png', cid: 'authenticator-qr' }],
  };
}

// Pidetään GSM 03.38 -merkistössä (ä ja ö kuuluvat siihen) ja yhdessä 160 merkin osassa:
// ei ajatusviivoja eikä kaarevia lainausmerkkejä. Salasana omalla rivillään, jottei
// välimerkki näytä kuuluvan siihen. Salasanan merkistö (index.js: arvoSalasana) on
// pelkkiä A-Z, a-z, 2-9.
export function rakennaTekstiviesti({ password }) {
  return `Turvajohto OS\nVäliaikainen salasanasi:\n${password}\nKäyttäjätunnus tuli sähköpostiisi. Vaihda salasana ensimmäisellä kirjautumisella.`;
}

// Kanavavalinnan tulkinta pyynnöstä. Tuntemattomat avaimet ohitetaan; jos yhtään kanavaa
// ei valittu, palautetaan null eikä mitään lähetetä.
export function tulkitseKanavat(lahetys) {
  if (!lahetys || typeof lahetys !== 'object' || Array.isArray(lahetys)) return null;
  const valitut = KANAVAT.filter((k) => lahetys[k] === true);
  return valitut.length ? valitut : null;
}

/**
 * Lähettää valitut viestit. Palauttaa kanavakohtaisen tuloksen, jossa ei ole viestien
 * sisältöä eikä numeroa kokonaisena — tulos menee sellaisenaan selaimeen ja auditlokiin.
 *
 * tila: 'lahetetty' | 'kuivaharjoittelu' | 'ei-yhteystietoa' | 'virhe'
 */
export async function toimitaTunnustiedot({
  kanavat, tyontekija, nimi, username, password, puoli, syy, totp = null,
  lahetaSahkoposti, lahetaSms,
}) {
  const tulos = {};
  const numero = normalisoiNumero(String(tyontekija?.phone || ''));
  const email = String(tyontekija?.email || '').trim();
  const smsValittu = kanavat.includes('sms') && Boolean(numero);

  if (kanavat.includes('sahkoposti')) {
    if (!kelpaaOsoitteeksi(email)) {
      tulos.sahkoposti = { tila: 'ei-yhteystietoa', viesti: 'Työntekijältä puuttuu kelvollinen sähköpostiosoite.' };
    } else {
      const viesti = rakennaSahkoposti({
        // Tervehdykseen ensimmäinen etunimi ("Hei Testi,"). Tunnuksen nimimerkki on
        // muotoa "Sukunimi Etunimet", joka kuulostaisi tervehdyksessä rekisteriotteelta.
        nimi: String(tyontekija?.firstName || '').trim().split(/\s+/)[0] || nimi,
        username, osoite: kirjautumisosoite(puoli), syy, totp,
        // Mainitaan numero vain jos salasana todella lähtee sinne tekstiviestinä.
        numeroPeitetty: smsValittu ? peitaNumero(numero) : null,
      });
      const r = await lahetaSahkoposti({ to: email, ...viesti });
      tulos.sahkoposti = r.ok
        ? { tila: r.dryRun ? 'kuivaharjoittelu' : 'lahetetty', ...(totp ? { authenticator: true } : {}) }
        : { tila: 'virhe', viesti: r.virhe };
    }
  }

  if (kanavat.includes('sms')) {
    if (!numero) {
      tulos.sms = { tila: 'ei-yhteystietoa', viesti: 'Työntekijältä puuttuu kelvollinen puhelinnumero.' };
    } else {
      const r = await lahetaSms({ numerot: [numero], body: rakennaTekstiviesti({ password }) });
      tulos.sms = r.ok
        ? { tila: r.dryRun ? 'kuivaharjoittelu' : 'lahetetty', numero: peitaNumero(numero) }
        : { tila: 'virhe', viesti: r.virhe };
    }
  }

  return tulos;
}
