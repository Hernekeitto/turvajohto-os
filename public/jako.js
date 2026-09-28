// jako.js: jako.html -sivun skripti.
//
// OMA TIEDOSTONSA eikä inline-skripti: tuotannon CSP (csp.ts) sallii vain script-src 'self',
// joten sivun sisään kirjoitettu skripti estettiin ja sivu jäi tilaan "Ladataan…" (28.9.2026).

// Token luetaan osoitteen hash-osasta (#token) EIKÄ polusta tai kyselyparametrista.
// Hash ei koskaan lähde palvelimelle, joten token ei päädy nginxin access.logiin
// eikä välityspalvelimien lokeihin. Se on merkittävä ero: URL-polku kirjautuu
// jokaisesta pyynnöstä, hash ei kirjaudu mihinkään palvelimen päässä.
const token = location.hash.slice(1);
const kortti = document.getElementById('kortti');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function virhe(viesti) {
  kortti.innerHTML = '<h1>Linkki ei ole käytettävissä</h1><p class="vaimea">' + esc(viesti) + '</p>';
}

async function lataa(fileId, nimi) {
  const salasanaKentta = document.getElementById('salasana');
  // Edellinen virhe pois heti: muuten onnistunut lataus jättäisi ruudulle
  // vanhan "Väärä salasana." -tekstin ja näyttäisi epäonnistuneen.
  const virheP = document.getElementById('virhe');
  if (virheP) virheP.textContent = '';
  const res = await fetch('/api/share/' + encodeURIComponent(token) + '/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, password: salasanaKentta ? salasanaKentta.value : undefined }),
  });
  if (!res.ok) {
    let viesti = 'Lataus epäonnistui.';
    try { viesti = (await res.json()).error || viesti; } catch {}
    const p = document.getElementById('virhe');
    if (p) p.textContent = viesti;
    return;
  }
  // Ladataan blobina, jotta salasana voidaan lähettää rungossa eikä URL:ssa.
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nimi;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function alusta() {
  if (!token) return virhe('Linkistä puuttuu tunniste.');
  let tiedot;
  try {
    const res = await fetch('/api/share/' + encodeURIComponent(token));
    tiedot = await res.json();
    if (!res.ok || !tiedot.ok) return virhe(tiedot.error || 'Linkkiä ei löytynyt.');
  } catch {
    return virhe('Yhteysvirhe. Yritä myöhemmin uudelleen.');
  }

  const tiedostot = tiedot.type === 'folder'
    ? (tiedot.contents || []).filter((f) => f.type === 'file')
    : [{ id: null, name: tiedot.name }];

  const vanhenee = tiedot.expiresAt
    ? '<p class="vaimea">Linkki on voimassa ' + esc(new Date(tiedot.expiresAt).toLocaleString('fi-FI')) + ' asti.</p>'
    : '';

  kortti.innerHTML =
    '<h1>' + esc(tiedot.name) + '</h1>' +
    '<p class="vaimea">' + (tiedot.type === 'folder' ? 'Jaettu kansio' : 'Jaettu tiedosto') + '</p>' +
    (tiedot.requiresPassword
      ? '<input id="salasana" type="password" placeholder="Salasana" autocomplete="off" />'
      : '') +
    '<div id="lista"></div>' +
    '<p id="virhe" class="virhe"></p>' +
    vanhenee;

  const lista = document.getElementById('lista');
  if (tiedostot.length === 0) {
    lista.innerHTML = '<p class="info">Kansiossa ei ole ladattavia tiedostoja.</p>';
    return;
  }
  tiedostot.forEach((f) => {
    const rivi = document.createElement('div');
    rivi.className = 'rivi';
    const nimi = document.createElement('span');
    nimi.className = 'nimi';
    nimi.textContent = f.name;
    const nappi = document.createElement('button');
    nappi.textContent = 'Lataa';
    nappi.addEventListener('click', () => lataa(f.id, f.name));
    rivi.append(nimi, nappi);
    lista.append(rivi);
  });
}

alusta();
