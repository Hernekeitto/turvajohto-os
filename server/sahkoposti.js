// Sähköpostin lähetys SMTP:llä. Kuten bulksms.js, tämä moduuli EI tunne Expressiä,
// oikeuksia eikä tietomalleja — se osaa vain lähettää yhden viestin. Mitä lähetetään ja
// kenelle ratkaistaan tunnuslahetys.js:ssä ja index.js:ssä.
//
// PALVELUNTARJOAJASTA RIIPPUMATON: asetukset tulevat ympäristömuuttujista, joten Zoho
// Mailin (smtppro.zoho.eu, vain maksulliset tasot), ZeptoMailin (smtp.zeptomail.eu) tai
// minkä tahansa muun SMTP-palvelun välillä vaihdetaan ilman koodimuutosta.
//
//   SMTP_HOST, SMTP_PORT (oletus 465), SMTP_USER, SMTP_PASS
//   SMTP_FROM       lähettäjäosoite (oletus SMTP_USER). Zohossa sen on oltava tunnuksen
//                   oma osoite tai alias, muuten palvelin vastaa "Relaying disallowed".
//   SMTP_FROM_NAME  näkyvä lähettäjänimi (oletus "Turvajohto OS")
//
// KUIVAHARJOITTELU: ilman SMTP_HOST/USER/PASS-muuttujia kaikki toimii muuten normaalisti,
// mutta viestiä ei lähetetä. Sama periaate kuin BulkSMS:ssä: toiminnon voi rakentaa ja
// todentaa loppuun ennen kuin tunnukset ovat olemassa.

const TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || 20000);

export function onkoKonfiguroitu() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Kevyt muototarkistus. Tarkoitus ei ole validoida RFC 5322:ta vaan torjua ilmeiset
// virheet (tyhjä, puuttuva @, välilyönti, rivinvaihto) ennen kuin ne päätyvät
// SMTP-keskusteluun. Rivinvaihdon esto on myös otsakeinjektion torjuntaa.
export function kelpaaOsoitteeksi(osoite) {
  if (typeof osoite !== 'string') return false;
  const s = osoite.trim();
  return s.length <= 254 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s);
}

let kuljetin = null;

// nodemailer ladataan vasta ensimmäisellä oikealla lähetyksellä. Jos paketti puuttuisi
// palvelimelta, vain sähköposti epäonnistuu — koko rajapinta ei kaadu käynnistyksessä.
async function haeKuljetin() {
  if (kuljetin) return kuljetin;
  const { default: nodemailer } = await import('nodemailer');
  const portti = Number(process.env.SMTP_PORT || 465);
  kuljetin = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: portti,
    // 465 = TLS heti alusta, 587 = STARTTLS. requireTLS estää 587:ssä pudottautumisen
    // salaamattomaan yhteyteen, jos palvelin ei tarjoaisi STARTTLS:ää.
    secure: portti === 465,
    requireTLS: portti !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
    // Ei ulkoisia resursseja viestiin: runko on aina tämän palvelimen muodostamaa tekstiä.
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return kuljetin;
}

export async function lahetaSahkoposti({ to, subject, text }) {
  if (!kelpaaOsoitteeksi(to)) {
    return { ok: false, dryRun: !onkoKonfiguroitu(), virhe: 'Virheellinen sähköpostiosoite.' };
  }
  if (!onkoKonfiguroitu()) return { ok: true, dryRun: true };

  const lahettaja = (process.env.SMTP_FROM || process.env.SMTP_USER).trim();
  const nimi = (process.env.SMTP_FROM_NAME || 'Turvajohto OS').trim();
  try {
    const k = await haeKuljetin();
    const tulos = await k.sendMail({
      from: { name: nimi, address: lahettaja },
      to: to.trim(),
      subject,
      text,
    });
    return { ok: true, dryRun: false, id: tulos?.messageId || null };
  } catch (err) {
    // Virheteksti ei saa sisältää tunnuksia. nodemailerin virheet kertovat koodin ja
    // palvelimen vastauksen (esim. "535 Authentication Failed"), eivät salasanaa.
    const syy = err?.code ? `${err.code}${err.responseCode ? ` ${err.responseCode}` : ''}` : err?.message || 'tuntematon virhe';
    return { ok: false, dryRun: false, virhe: `Sähköpostin lähetys epäonnistui: ${syy}.` };
  }
}
