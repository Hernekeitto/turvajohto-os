// Collabora-editorin iframe: yhteinen editorisivulle (editori.js) ja jakosivulle
// (jako.js). Erillinen tiedosto CSP:n takia (script-src 'self', ei inline-skriptejä).
//
// TurvajohtoEditori.kaynnista(d, sulje) — d = palvelimen vastaus ({ url, token, ttl, nimi }),
// sulje = kutsutaan kun käyttäjä painaa editorin Sulje-painiketta. Token lähetetään
// iframeen POST-lomakkeella eikä URL:ssä, jottei se jää selaimen historiaan.
// Palauttaa iframe-elementin (kutsuja poistaa sen sulkiessaan).
(function () {
  'use strict';

  function kaynnista(d, sulje) {
    // Toimisto on omassa originissaan (toimisto.turvajohto-os.fi), joten viestit
    // tarkistetaan sitä vasten eikä tämän sivun originia.
    var toimisto = new URL(d.url).origin;
    var nimi = 'editori-' + Math.random().toString(36).slice(2);
    var kehys = document.createElement('iframe');
    kehys.name = nimi;
    kehys.title = 'Dokumenttieditori: ' + d.nimi;
    kehys.allow = 'clipboard-read; clipboard-write; fullscreen';
    kehys.className = 'editorikehys';

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
    lomake.submit();
    lomake.remove();

    // Collaboran viestit tulevat iframesta Toimiston originista. Frame_Ready-viestiin
    // vastataan Host_PostmessageReady, jotta Collabora tietää isäntäsivun kuuntelevan;
    // editorin Sulje-painike lähettää sen jälkeen UI_Close.
    function kuuntele(e) {
      if (e.origin !== toimisto || e.source !== kehys.contentWindow) return;
      var m;
      try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      if (!m) return;
      if (m.MessageId === 'App_LoadingStatus' && m.Values && m.Values.Status === 'Frame_Ready') {
        kehys.contentWindow.postMessage(
          JSON.stringify({ MessageId: 'Host_PostmessageReady', SendTime: Date.now(), Values: {} }),
          toimisto
        );
      }
      if (m.MessageId === 'UI_Close') {
        window.removeEventListener('message', kuuntele);
        sulje(kehys);
      }
    }
    window.addEventListener('message', kuuntele);
    return kehys;
  }

  window.TurvajohtoEditori = { kaynnista: kaynnista };
})();
