// Content-Security-Policy — yksi lähde koko sovellukselle.
//
// TUOTANNOSSA OTSAKKEEN LÄHETTÄÄ NGINX, ei tämä tiedosto. Sovellusnippu on staattinen,
// eikä sen tarjoilija ole Node vaan nginx, joten CSP on siellä missä HTML lähtee
// matkaan. Miksi se on silti täällä:
//
// 1. KEHITYKSESSÄ EI OLLUT CSP:tä LAINKAAN. Rikkomus näkyi vasta tuotannossa, ja siellä
//    se näkyy hiljaisena: estetty tyyli tai skripti ei kaada mitään, se vain jättää
//    tekemättä. Vite lukee tämän ja lähettää saman otsakkeen dev- ja preview-palvelimessa,
//    joten sama rikkomus tulee esiin konsolissa jo kehitettäessä.
//
// 2. PALVELIMEN KONFIGURAATIO EI OLE VERSIONHALLINNASSA. Ilman tätä tiedostoa
//    sovelluksen rajoituksia ei voi lukea koodista eikä perustella missään — ja
//    kysymykseen "miksi style-src sallii unsafe-inlinen" ei olisi vastausta.
//
// Jos muutat tätä, muuta MYÖS nginxin konfiguraatio palvelimella (alla oleva rivi).
// Ne eivät ole yhteydessä toisiinsa automaattisesti.

// Direktiivit ja niiden perustelut. Järjestys on merkityksetön; ryhmittely on lukijalle.
const DIREKTIIVIT = {
  // Kaikki mitä ei ole erikseen sallittu tulee samasta originista.
  'default-src': ["'self'"],

  // Ei inline-skriptejä eikä evalia. index.html lataa yhden moduulin src-attribuutilla,
  // ja kaikki muu on niputettu — joten 'self' riittää eikä poikkeuksia tarvita.
  'script-src': ["'self'"],

  // 'unsafe-inline' on TÄSSÄ TARPEEN kahdesta syystä, eikä kumpaakaan voi poistaa
  // ilman että toiminto muuttuu:
  //
  //   - Kartta ja mittaristo asettavat elementtien paikat ja koot style-attribuutilla
  //     (vyöhykkeen nimilappu, kirjausmerkki, pylvään korkeus). Ne ovat laskettuja
  //     arvoja, eivät luokkia — tyylitiedostoon niitä ei voi siirtää.
  //   - Tuloste (shared/tuloste.ts) rakentaa oman dokumenttinsa <style>-lohkolla
  //     iframen sisään. Se perii sovelluksen CSP:n, joten ilman tätä PDF-tuloste olisi
  //     tyylitön.
  //
  // Riski on tiedossa ja rajattu: script-src EI salli inlineä, joten tämä ei avaa
  // skriptien injektointia — vain tyylit.
  'style-src': ["'self'", "'unsafe-inline'"],

  // data: on QR-koodeja varten. Ne muodostetaan selaimessa (tarrat, TOTP-koodi,
  // ilmoitusjuliste) eivätkä ne käy palvelimella missään vaiheessa.
  'img-src': ["'self'", 'data:'],

  // Fira Sans isännöidään itse npm-paketista, jottei käyttäjän selain ota yhteyttä
  // kolmanteen osapuoleen (ks. main.tsx).
  'font-src': ["'self'"],

  // API-kutsut ja kanavan WebSocket (/api/kanava). CSP3:ssa 'self' kattaa saman
  // originin ws/wss-yhteyden, ja tuotannossa kanava on toiminut tämän otsakkeen kanssa
  // erästä 3 asti. Jos kanava joskus lakkaa toimimasta selaimessa jossa se ennen toimi,
  // tämä rivi on ensimmäinen tarkistettava — lisäys olisi silloin 'wss://turvajohto-os.fi'.
  'connect-src': ["'self'"],

  // HUOM: worker-src ei ole tässä, vaikka palvelutyöntekijä (erä 6) sitä koskee. Se
  // periytyy ketjussa worker-src -> child-src -> default-src, joten 'self' kattaa sen
  // jo. Direktiivi on jätetty pois tarkoituksella, jotta TÄMÄ MERKKIJONO ON TÄSMÄLLEEN
  // SAMA kuin tuotannon nginxissä — kaksi lähes samanlaista CSP:tä on pahempi kuin yksi,
  // koska eron huomaa vasta kun jokin toimii vain toisessa ympäristössä.

  // Ei plugineja. Liitteet avataan tavallisina linkkeinä (<a href>), joten mitään
  // upotettavaa ei ole — PDF:kin aukeaa selaimen omaan katseluun.
  'object-src': ["'none'"],

  // Estää <base>-tagilla tehtävän polkujen kaappauksen.
  'base-uri': ["'self'"],

  // Lomake ei saa lähettää tietoja ulos sovelluksesta.
  'form-action': ["'self'"],

  // Clickjacking-suoja. Sama asia kuin X-Frame-Options, joka on myös asetettu —
  // vanhempien selainten takia molemmat.
  'frame-ancestors': ["'self'"],
};

export const CSP = Object.entries(DIREKTIIVIT)
  .map(([direktiivi, arvot]) => `${direktiivi} ${arvot.join(' ')}`)
  .join('; ');

// Muut turvaotsakkeet, samat kuin tuotannon nginxissä. Nämä ovat kehityksessä mukana
// samasta syystä kuin CSP: ero kehityksen ja tuotannon välillä on ero jota kukaan ei
// huomaa ennen kuin se rikkoo jotain.
export const TURVAOTSAKKEET = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// --- Vastine nginxiin --------------------------------------------------------------
//
// Palvelimen konfiguraatiossa (/etc/nginx/sites-available/turvajohto-os, server-lohko)
// pitää olla tätä vastaava rivi. Tuotannossa se on jo, ja tämä on sen kirjattu muoto:
//
//   add_header Content-Security-Policy "<CSP-vakion arvo>" always;
//   add_header X-Content-Type-Options "nosniff" always;
//   add_header X-Frame-Options "SAMEORIGIN" always;
//   add_header Referrer-Policy "strict-origin-when-cross-origin" always;
//   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
//
// HSTS on vain nginxissä: se koskee koko sivustoa eikä sovellusta, eikä sillä ole
// mieltä kehityksen http-osoitteessa.
//
// Nykyisen tuotanto-otsakkeen voi tarkistaa komennolla:
//   curl -sI https://turvajohto-os.fi/event | grep -i content-security
