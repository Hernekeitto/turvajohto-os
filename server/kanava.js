// Kaksisuuntainen kanava (WebSocket). Selain saa tiedon muutoksista heti sen sijaan että
// kysyisi niitä ajastimella, ja myöhemmin (erän 3 sijaintiosuus) sama kanava kuljettaa
// tietoa myös kentältä palvelimelle. Siksi tämä on WebSocket eikä palvelinlähetetty
// tapahtumavirta (SSE): toinen suunta tarvitaan joka tapauksessa.
//
// KANAVA EI KULJETA TIETUEIDEN SISÄLTÖÄ. Se kertoo vain mikä kokoelma muuttui ja mitkä
// tietue-id:t — selain hakee sisällön normaalilla GET-pyynnöllä, joka käy läpi saman
// oikeustarkistuksen ja kenttäsuodatuksen kuin ennenkin (permissions.js: readableData).
// Jos kanava lähettäisi sisältöä, jokainen oikeussääntö olisi toteutettava toiseen
// kertaan täällä — ja se toinen toteutus erkanisi ensimmäisestä.
//
// Tapahtumarajaus tehdään silti jo täällä: viesti kerrotaan vain niille istunnoille jotka
// saavat nähdä kyseisen tapahtuman. Muuten kanava vuotaisi tiedon SIITÄ ETTÄ jotain
// tapahtui tapahtumassa johon käyttäjällä ei ole pääsyä.

import { WebSocketServer } from 'ws';

// Kuinka usein palvelin varmistaa että yhteys on elossa. nginx katkaisee hiljaisen
// yhteyden proxy_read_timeoutin mukaan, joten pingin on oltava sitä tiheämpi.
const PING_VALI_MS = 30_000;

let wss = null;

// Kaikki avoimet istunnot. Jokaisella on käyttäjän tunnistetiedot upgrade-hetkeltä.
// Oikeudet luetaan uudelleen jokaisessa lähetyksessä (ks. laheta), jotta tason muutos
// vaikuttaa ilman että käyttäjän on avattava yhteys uudelleen.
const istunnot = new Set();

// Liittää kanavan olemassa olevaan HTTP-palvelimeen. `tunnista` saa upgrade-pyynnön ja
// palauttaa istunnon tiedot tai nullin — index.js antaa sen, koska istunnon tunnistus
// (eväste, JWT, käyttäjätaso) asuu siellä.
export function liitaKanava(palvelin, { polku = '/api/kanava', tunnista, onViesti, onClose }) {
  // maxPayload rajaa selaimelta tulevan viestin koon. Kanavaa pitkin tulee vain
  // sijaintipäivityksiä ja kuittauksia, jotka ovat satoja tavuja — ilman rajaa yksi
  // istunto voisi lähettää satojen megatavujen puskurin ja viedä palvelimen muistin.
  wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  palvelin.on('upgrade', (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== polku) {
      // Ei meidän polkumme. Suljetaan yhteys sen sijaan että jätettäisiin se auki:
      // avoimeksi jätetty upgrade-pyyntö varaa soketin kunnes selain luovuttaa.
      socket.destroy();
      return;
    }

    const istunto = tunnista(req);
    if (!istunto) {
      // 401 ennen kättelyä. Selain saa virheen eikä yhteyttä avata lainkaan.
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.istunto = istunto;
      ws.elossa = true;
      ws.on('pong', () => { ws.elossa = true; });
      // onClose kertoo index.js:lle että TÄMÄ istunto on poissa — esim. puheenvuoro.js
      // vapauttaa sen pitämät puheenvuorot. Kutsutaan sekä closessa että errorissa,
      // koska molemmat tarkoittavat ettei yhteyttä enää ole; puheenvuoro.js:n vapautus
      // on idempotentti, joten kahdesti kutsuminen ei ole ongelma jos molemmat laukeavat.
      ws.on('close', () => { istunnot.delete(ws); onClose?.(ws.istunto); });
      ws.on('error', () => { istunnot.delete(ws); onClose?.(ws.istunto); });
      // Kentältä palvelimelle: sijaintipäivitykset. Tämä moduuli on pelkkä kuljetus —
      // se ei tiedä mitä viestit tarkoittavat, vaan antaa ne index.js:lle joka tuntee
      // oikeudet ja sijaintikerroksen. Kelvoton JSON ohitetaan hiljaa: se ei ole virhe
      // josta kannattaisi kertoa, koska yhteyden toinen pää ei ole luotettu.
      ws.on('message', (data) => {
        if (!onViesti) return;
        let viesti;
        try {
          viesti = JSON.parse(data.toString());
        } catch {
          return;
        }
        if (!viesti || typeof viesti !== 'object') return;
        onViesti(ws.istunto, viesti);
      });
      istunnot.add(ws);
      ws.send(JSON.stringify({ tyyppi: 'tervetuloa', kayttaja: istunto.username }));
    });
  });

  // Kuolleiden yhteyksien siivous. Ilman tätä katkennut mobiiliyhteys jäisi joukkoon
  // ikuisesti ja jokainen lähetys yrittäisi kirjoittaa soketille jota ei ole.
  const ajastin = setInterval(() => {
    for (const ws of istunnot) {
      if (!ws.elossa) {
        ws.terminate();
        istunnot.delete(ws);
        continue;
      }
      ws.elossa = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
        istunnot.delete(ws);
      }
    }
  }, PING_VALI_MS);
  ajastin.unref();

  return wss;
}

// Kertoo avoimille istunnoille että kokoelma muuttui. `muutokset` on authorizeWriten
// tuottama lista { action, id, eventId } — sama jonka audit-loki saa.
//
// `saaNahda(istunto, eventId)` ratkaisee kenelle muutos kerrotaan. index.js antaa sen,
// koska tapahtumarajauksen logiikka on permissions.js:ssä.
export function laheta(kokoelma, muutokset, { saaNahda, lahettaja } = {}) {
  if (!wss || istunnot.size === 0) return 0;
  const lista = Array.isArray(muutokset) ? muutokset : [];
  if (lista.length === 0) return 0;

  let lahetetty = 0;
  for (const ws of istunnot) {
    if (ws.readyState !== ws.OPEN) continue;
    // Lähettäjä itse tietää jo mitä teki, ja hänen tilansa on jo oikea. Turha herätys
    // aiheuttaisi vain ylimääräisen GETin heti tallennuksen jälkeen.
    if (lahettaja && ws.istunto?.username === lahettaja) continue;

    const omat = saaNahda
      ? lista.filter((m) => saaNahda(ws.istunto, m.eventId))
      : lista;
    if (omat.length === 0) continue;

    try {
      ws.send(JSON.stringify({
        tyyppi: 'muutos',
        kokoelma,
        // Vain metatiedot: id ja toiminto. Sisältö haetaan GETillä.
        muutokset: omat.map((m) => ({ action: m.action, id: m.id, eventId: m.eventId })),
      }));
      lahetetty++;
    } catch {
      // Yhden istunnon epäonnistuminen ei saa estää muita.
      istunnot.delete(ws);
    }
  }
  return lahetetty;
}

// Vapaamuotoinen viesti valituille istunnoille. `suodatin` saa istunnon ja päättää
// kenelle viesti menee — kutsuja tuntee oikeussäännöt, tämä moduuli ei.
export function lahetaViesti(viesti, { suodatin } = {}) {
  if (!wss || istunnot.size === 0) return 0;
  let lahetetty = 0;
  for (const ws of istunnot) {
    if (ws.readyState !== ws.OPEN) continue;
    if (suodatin && !suodatin(ws.istunto)) continue;
    try {
      ws.send(JSON.stringify(viesti));
      lahetetty++;
    } catch {
      istunnot.delete(ws);
    }
  }
  return lahetetty;
}

// Avointen yhteyksien määrä. Käytetään tallennustilan tapaan diagnostiikkaan.
export const avoimiaYhteyksia = () => istunnot.size;
