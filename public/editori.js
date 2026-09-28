// Dokumenttieditori omassa ikkunassaan (editori.html?tiedosto=<uploadId>&tila=muokkaus|katselu).
//
// Sivu kysyy palvelimelta editorin osoitteen ja kertakäyttöisen tokenin
// (/api/editori/avaa, kirjautumisevästeellä) ja lähettää tokenin Collaboran iframeen
// POST-lomakkeella — ei URL:ssä, jottei se jää selaimen historiaan. Oikeudet ja vain
// luku -tila ratkaisee palvelin. Ks. server/editori.js.
(function () {
  'use strict';

  var viesti = document.getElementById('viesti');
  var parametrit = new URLSearchParams(window.location.search);
  var uploadId = parametrit.get('tiedosto') || '';
  var tila = parametrit.get('tila') === 'katselu' ? 'katselu' : 'muokkaus';

  function naytaViesti(teksti, virhe, linkki) {
    viesti.style.display = '';
    viesti.textContent = '';
    var p = document.createElement('p');
    if (virhe) p.className = 'virhe';
    p.textContent = teksti;
    if (linkki) {
      p.appendChild(document.createTextNode(' '));
      var a = document.createElement('a');
      a.href = linkki.href;
      a.textContent = linkki.teksti;
      p.appendChild(a);
    }
    viesti.appendChild(p);
  }

  // Juuri luotu tiedosto: tapahtumapuoli tallentaa tiedostolistan hetken viiveellä, joten
  // palvelin ei välttämättä vielä tunne tiedostoa kun tämä sivu aukeaa. 404 yritetään
  // siksi uudelleen muutaman kerran ennen kuin se näytetään virheenä.
  var YRITYKSET = 8;
  var VALI_MS = 750;

  function avaa(yritys) {
    fetch('/api/editori/avaa', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId: uploadId, tila: tila }),
    })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (d) { return { r: r, d: d }; });
      })
      .then(function (v) {
        if (v.r.status === 404 && yritys < YRITYKSET) {
          setTimeout(function () { avaa(yritys + 1); }, VALI_MS);
          return;
        }
        if (v.r.status === 401) {
          naytaViesti('Istunto on vanhentunut.', true, { href: '/', teksti: 'Kirjaudu sisään' });
          return;
        }
        if (!v.r.ok || !v.d || !v.d.ok) {
          naytaViesti((v.d && v.d.error) || 'Dokumentin avaus epäonnistui.', true);
          return;
        }
        kaynnista(v.d);
      })
      .catch(function () {
        naytaViesti('Yhteysvirhe. Päivitä sivu yrittääksesi uudelleen.', true);
      });
  }

  function kaynnista(d) {
    document.title = d.nimi + (d.kirjoitus ? '' : ' (vain luku)') + ' – Turvajohto OS';

    viesti.style.display = 'none';
    // Iframe ja viestinvälitys: editorikehys.js (yhteinen jakosivun kanssa).
    window.TurvajohtoEditori.kaynnista(d, sulje);
  }

  // Selain sallii window.close()in vain ikkunalle jonka skripti tai linkki avasi. Jos
  // sulkeminen ei onnistu (sivu avattu kirjanmerkistä), näytetään ohje. Collabora on
  // tallentanut muutokset jo ennen UI_Close-viestiä.
  function sulje(kehys) {
    window.close();
    setTimeout(function () {
      kehys.remove();
      naytaViesti('Dokumentti on suljettu. Muutokset tallentuvat automaattisesti — voit sulkea tämän välilehden.', false);
    }, 300);
  }

  if (!uploadId) {
    naytaViesti('Tiedostoa ei ole valittu.', true);
  } else {
    avaa(1);
  }
})();
