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

    var nimi = 'editori-' + Math.random().toString(36).slice(2);
    var kehys = document.createElement('iframe');
    kehys.name = nimi;
    kehys.title = 'Dokumenttieditori: ' + d.nimi;
    kehys.allow = 'clipboard-read; clipboard-write; fullscreen';

    var lomake = document.createElement('form');
    lomake.action = d.url;
    lomake.method = 'post';
    lomake.target = nimi;
    lomake.style.display = 'none';
    [['access_token', d.token], ['access_token_ttl', String(d.ttl)]].forEach(function (kentta) {
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = kentta[0];
      input.value = kentta[1];
      lomake.appendChild(input);
    });

    document.body.appendChild(kehys);
    document.body.appendChild(lomake);
    viesti.style.display = 'none';
    lomake.submit();

    // Collaboran viestit tulevat iframesta samasta originista. Frame_Ready-viestiin
    // vastataan Host_PostmessageReady, jotta Collabora tietää isäntäsivun kuuntelevan;
    // editorin Sulje-painike lähettää sen jälkeen UI_Close.
    window.addEventListener('message', function (e) {
      if (e.origin !== window.location.origin || e.source !== kehys.contentWindow) return;
      var m;
      try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      if (!m) return;
      if (m.MessageId === 'App_LoadingStatus' && m.Values && m.Values.Status === 'Frame_Ready') {
        kehys.contentWindow.postMessage(
          JSON.stringify({ MessageId: 'Host_PostmessageReady', SendTime: Date.now(), Values: {} }),
          window.location.origin
        );
      }
      if (m.MessageId === 'UI_Close') sulje(kehys);
    });
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
