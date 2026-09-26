// Uuden tai nollatun tunnuksen tietojen toimitus työntekijälle kahta eri kanavaa pitkin:
//
//   SÄHKÖPOSTI: käyttäjätunnus ja kirjautumisosoite — EI KOSKAAN salasanaa
//   TEKSTIVIESTI: pelkkä väliaikainen salasana — EI KOSKAAN käyttäjätunnusta
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

export function rakennaSahkoposti({ nimi, username, osoite, syy, numeroPeitetty }) {
  const tervehdys = nimi ? `Hei ${nimi},` : 'Hei,';
  const alku = syy === 'nollattu'
    ? 'Turvajohto OS -tunnuksesi salasana on nollattu.'
    : 'Sinulle on luotu tunnus Turvajohto OS -järjestelmään.';
  const salasanarivi = numeroPeitetty
    ? `Väliaikainen salasana lähetetään erikseen tekstiviestinä numeroosi ${numeroPeitetty}.`
    : 'Väliaikainen salasana toimitetaan sinulle erikseen.';
  const text = [
    tervehdys,
    '',
    alku,
    '',
    `Käyttäjätunnus: ${username}`,
    `Kirjautuminen: ${osoite}`,
    '',
    salasanarivi,
    '',
    'Ensimmäisellä kirjautumisella:',
    '1. vaihdat väliaikaisen salasanan omaksesi',
    '2. otat käyttöön Authenticator-sovelluksen (esim. Google tai Microsoft Authenticator)',
    '',
    'Jos et odottanut tätä viestiä, ilmoita asiasta esihenkilöllesi.',
    '',
    'Tähän viestiin ei tarvitse vastata.',
  ].join('\n');
  const subject = syy === 'nollattu' ? 'Turvajohto OS: salasana nollattu' : 'Turvajohto OS: käyttäjätunnuksesi';
  return { subject, text };
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
  kanavat, tyontekija, nimi, username, password, puoli, syy,
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
        nimi, username, osoite: kirjautumisosoite(puoli), syy,
        // Mainitaan numero vain jos salasana todella lähtee sinne tekstiviestinä.
        numeroPeitetty: smsValittu ? peitaNumero(numero) : null,
      });
      const r = await lahetaSahkoposti({ to: email, ...viesti });
      tulos.sahkoposti = r.ok
        ? { tila: r.dryRun ? 'kuivaharjoittelu' : 'lahetetty' }
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
