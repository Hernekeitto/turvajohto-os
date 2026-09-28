// ilmoitus.js: ilmoitus.html -sivun skripti.
//
// OMA TIEDOSTONSA eikä inline-skripti: tuotannon CSP (csp.ts) sallii vain script-src 'self',
// joten sivun sisään kirjoitettu skripti estettiin ja sivu jäi tilaan "Ladataan…" (28.9.2026).

// Token luetaan osoitteen hash-osasta (#token) EIKÄ polusta tai kyselyparametrista.
// Sama ratkaisu kuin jakolinkeillä (jako.html) ja samasta syystä: hash ei lähde
// palvelimelle, joten token ei päädy nginxin access.logiin. Tässä token ei ole
// salaisuus — se on julisteessa aidassa — mutta se on silti ainoa asia joka
// oikeuttaa kirjoittamaan järjestelmään ilman kirjautumista, eikä sen kuulu kertyä
// lokeihin joissa sitä ei tarvita.
const token = location.hash.slice(1);
const kortti = document.getElementById('kortti');

// Kenttien pituusrajat ovat samat kuin palvelimen julkinen.js:n RAJAT. Selaimen raja
// on käyttömukavuutta varten (kirjoittaja näkee rajan ennen kuin törmää siihen);
// palvelin katkaisee tekstin joka tapauksessa, koska selaimeen ei voi luottaa.
const RAJAT = { kuvaus: 2000, paikka: 200, yhteystieto: 200 };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function virhe(viesti) {
  kortti.innerHTML =
    '<h1>Ilmoitusta ei voi lähettää</h1>' +
    '<p class="vaimea">' + esc(viesti) + '</p>' +
    '<p class="hata">Hätätilanteessa soita aina 112.</p>';
}

function kiitos() {
  kortti.innerHTML =
    '<div class="valmis">' +
    '<div class="merkki">✓</div>' +
    '<h1>Kiitos ilmoituksesta</h1>' +
    '<p class="vaimea">Ilmoitus on välitetty tapahtuman turvallisuusvalvomoon. ' +
    'Sitä ei julkaista, eikä siihen vastata tämän lomakkeen kautta.</p>' +
    '<p class="hata">Jos tilanne on kiireellinen tai vaarallinen, soita 112.</p>' +
    '</div>';
}

async function laheta(nappi) {
  const kuvaus = document.getElementById('kuvaus').value;
  const paikka = document.getElementById('paikka').value;
  const yhteystieto = document.getElementById('yhteystieto').value;
  const virheP = document.getElementById('virhe');
  virheP.textContent = '';

  if (kuvaus.trim().length < 3) {
    virheP.textContent = 'Kirjoita lyhyt kuvaus havainnosta.';
    return;
  }
  nappi.disabled = true;
  nappi.textContent = 'Lähetetään…';
  try {
    const res = await fetch('/api/julkinen/' + encodeURIComponent(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kuvaus, paikka, yhteystieto }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.ok) return kiitos();
    virheP.textContent = (data && data.error) || 'Lähetys epäonnistui. Yritä uudelleen.';
  } catch {
    virheP.textContent = 'Yhteysvirhe. Tarkista verkkoyhteys ja yritä uudelleen.';
  }
  nappi.disabled = false;
  nappi.textContent = 'Lähetä ilmoitus';
}

function lomake(tiedot) {
  kortti.innerHTML =
    '<h1>Ilmoita havainnosta</h1>' +
    '<p class="vaimea">' +
    (tiedot.tapahtuma ? esc(tiedot.tapahtuma) : 'Tapahtuma') +
    (tiedot.paikka ? ' · ' + esc(tiedot.paikka) : '') +
    '</p>' +
    '<p class="hata">Tämä ei ole hätänumero. Hätätilanteessa soita 112.</p>' +
    '<label for="kuvaus">Mitä havaitsit?</label>' +
    '<textarea id="kuvaus" maxlength="' + RAJAT.kuvaus + '" ' +
    'placeholder="Kerro lyhyesti mitä näit ja milloin."></textarea>' +
    '<div class="laskuri" id="laskuri">0 / ' + RAJAT.kuvaus + '</div>' +
    '<label for="paikka">Missä? <span class="valinnainen">(valinnainen)</span></label>' +
    '<input id="paikka" maxlength="' + RAJAT.paikka + '" ' +
    'placeholder="' + esc(tiedot.paikka || 'Esimerkiksi portin numero tai lähin rakennus') + '" />' +
    '<label for="yhteystieto">Yhteystietosi <span class="valinnainen">(valinnainen)</span></label>' +
    '<input id="yhteystieto" maxlength="' + RAJAT.yhteystieto + '" ' +
    'placeholder="Puhelin tai sähköposti, jos saamme ottaa yhteyttä" />' +
    '<p class="virhe" id="virhe"></p>' +
    '<button id="laheta">Lähetä ilmoitus</button>' +
    '<p class="tietosuoja">Ilmoitus menee tapahtuman turvallisuudesta vastaavalle ' +
    'henkilöstölle, joka käy sen läpi. Anna yhteystietosi vain jos haluat että sinuun ' +
    'voidaan olla yhteydessä — ilmoituksen voi tehdä myös nimettömänä. Älä kirjoita ' +
    'lomakkeeseen henkilötunnusta tai terveystietoja. Ilmoituksesta ei tallenneta ' +
    'sijaintiasi eikä IP-osoitettasi.</p>';

  const kuvaus = document.getElementById('kuvaus');
  const laskuri = document.getElementById('laskuri');
  kuvaus.addEventListener('input', () => {
    laskuri.textContent = kuvaus.value.length + ' / ' + RAJAT.kuvaus;
  });
  const nappi = document.getElementById('laheta');
  nappi.addEventListener('click', () => laheta(nappi));
}

async function alusta() {
  if (!token) return virhe('Linkistä puuttuu tunniste. Skannaa QR-koodi uudelleen.');
  let tiedot;
  try {
    const res = await fetch('/api/julkinen/' + encodeURIComponent(token));
    tiedot = await res.json();
    if (!res.ok || !tiedot.ok) return virhe(tiedot.error || 'Linkki ei ole käytettävissä.');
  } catch {
    return virhe('Yhteysvirhe. Yritä myöhemmin uudelleen.');
  }
  lomake(tiedot);
}

alusta();
