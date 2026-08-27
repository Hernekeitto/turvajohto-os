// BulkSMS-webhookin tulkinta ja soveltaminen lähetyshistoriaan.
//
// Tässä tiedostossa on tarkoituksella VAIN puhdasta logiikkaa: ei fs:ää, ei Expressiä,
// ei readCollectionia. Jonon tiedostomekaniikka on smsqueue.js:ssä ja kokoelmien luku/
// kirjoitus index.js:ssä, jolloin tämän voi testata ilman palvelinta ja levyä
// (ks. smswebhook.test.js) — sama jako kuin shares.js:llä ja permissions.js:llä.
//
// Webhookin kaksi tapahtumatyyppiä tulevat X-BulkSMS-Event-otsikossa:
//   status-report     = toimituskuittaus lähetetylle viestille (MT)
//   incoming-message  = työntekijän vastaus hätäviestiin (MO, Mobile Originating)
// Kuorma on kummassakin JSON-taulukko Message-objekteja.
import crypto from 'node:crypto';

// Toimitustilat rajapinnasta. ACCEPTED = vastaanotettu lähetettäväksi, SENT = luovutettu
// operaattorille, DELIVERED = perillä puhelimessa, FAILED = ei mennyt perille.
// Vain DELIVERED ja FAILED ovat lopullisia.
export const LOPULLISET_TILAT = new Set(['DELIVERED', 'FAILED']);

// Webhook-osoitteen salaisuus kyselyparametrina (?secret=...). Päätepiste on julkinen —
// sen on oltava, koska BulkSMS kutsuu sitä ilman istuntoa ja dynaamisesta IP-avaruudesta,
// joten palomuurirajausta yksittäisiin osoitteisiin ei voi tehdä. Salaisuus on siis ainoa
// asia joka erottaa aidon toimituskuittauksen väärennetystä.
//
// Vertailu on vakioaikainen: pituusero paljastuisi timingSafeEqualin heitosta, joten
// molemmista lasketaan ensin kiinteämittainen tiiviste (sama kuva kuin shares.js:n
// tokenTasmaa).
export function salaisuusTasmaa(annettu, odotettu) {
  if (typeof annettu !== 'string' || typeof odotettu !== 'string') return false;
  if (annettu === '' || odotettu === '') return false;
  const a = crypto.createHash('sha256').update(annettu).digest();
  const b = crypto.createHash('sha256').update(odotettu).digest();
  return crypto.timingSafeEqual(a, b);
}

// Tunnistaa tapahtuman tyypin otsikosta ja poimii kuormasta viestiobjektit.
// Tuntemattomat tapahtumatyypit (rajapinta voi lisätä uusia) palautetaan omana
// tyyppinään eikä hylätä virheenä — sama eteenpäin yhteensopivuuden periaate kuin
// tuntemattomien JSON-kenttien sivuuttaminen.
export function tulkitseTapahtuma(otsikko, kuorma) {
  const viestit = Array.isArray(kuorma) ? kuorma : kuorma && typeof kuorma === 'object' ? [kuorma] : [];
  if (otsikko === 'status-report') return { tyyppi: 'status', viestit };
  if (otsikko === 'incoming-message') return { tyyppi: 'reply', viestit };
  return { tyyppi: 'tuntematon', viestit };
}

// Peittää numeron samalla tavalla kuin lähetysreitit: kokonaisia puhelinnumeroita ei
// palauteta selaimeen eikä säilytetä lähetyshistoriassa.
export function peitaNumero(numero) {
  if (typeof numero !== 'string' || numero.length < 9) return null;
  return `${numero.slice(0, 5)}…${numero.slice(-3)}`;
}

// Päivittää toimitustilat lähetyshistoriaan. Palauttaa UUDEN taulukon (ei muuta
// parametria paikallaan) ja tiedon siitä muuttuiko mikään — jos ei muuttunut, levylle
// ei kirjoiteta turhaan.
//
// Idempotentti: saman raportin käsittely kahdesti tuottaa saman lopputuloksen. Tämä on
// välttämätöntä, koska jonon kuittaus tapahtuu vasta kirjoituksen jälkeen ja koska
// BulkSMS uusii toimituksen jos päätepiste ei ehdi vastata.
export function soveltaTilaraportit(smsLog, viestit, nyt = new Date()) {
  const lista = Array.isArray(smsLog) ? smsLog : [];
  // messageId -> uusin tila. Jos samassa erässä on kaksi raporttia samalle viestille,
  // jälkimmäinen voittaa (ne saapuvat aikajärjestyksessä).
  const tilat = new Map();
  for (const m of viestit) {
    const id = m?.id === undefined || m?.id === null ? null : String(m.id);
    if (!id) continue;
    const tyyppi = m?.status?.type;
    if (typeof tyyppi !== 'string') continue;
    tilat.set(id, { status: tyyppi, statusId: m?.status?.id || null });
  }
  if (tilat.size === 0) return { smsLog: lista, muuttui: false };

  let muuttui = false;
  const uusi = lista.map((lahetys) => {
    const saajat = Array.isArray(lahetys?.recipients) ? lahetys.recipients : [];
    let osui = false;
    const paivitetyt = saajat.map((saaja) => {
      const tila = saaja?.messageId ? tilat.get(String(saaja.messageId)) : undefined;
      if (!tila) return saaja;
      // Lopullinen tila ei saa perääntyä: verkosta voi saapua vanha SENT-raportti
      // DELIVERED:n jälkeen (uudelleenyritys), eikä sen pidä pyyhkiä lopputulosta.
      if (LOPULLISET_TILAT.has(saaja.status) && !LOPULLISET_TILAT.has(tila.status)) return saaja;
      if (saaja.status === tila.status && saaja.statusId === tila.statusId) return saaja;
      osui = true;
      return { ...saaja, status: tila.status, statusId: tila.statusId, updatedAt: nyt.toISOString() };
    });
    if (!osui) return lahetys;
    muuttui = true;
    return { ...lahetys, recipients: paivitetyt };
  });

  return { smsLog: muuttui ? uusi : lista, muuttui };
}

// Poimii saapuvat vastaukset (Two-Way SMS) omaksi kokoelmakseen ja liittää ne siihen
// lähetykseen johon vastattiin (relatedSentMessageId). Vastaus jolle ei löydy
// alkuperäistä lähetystä säilytetään silti — se voi olla vanhempaan viestiin tullut
// myöhäinen kuittaus, eikä sen hukkaaminen ole koskaan oikea vaihtoehto
// hätäviestinnässä.
export function soveltaVastaukset(smsLog, smsReplies, viestit, nyt = new Date()) {
  const lahetykset = Array.isArray(smsLog) ? smsLog : [];
  const vanhat = Array.isArray(smsReplies) ? smsReplies : [];
  // Kaksoiskappaleiden esto: sama MO-viesti voi saapua uudelleen jos päätepiste ei
  // ehtinyt vastata 200:lla ensimmäisellä kerralla.
  const nahdyt = new Set(vanhat.map((v) => String(v?.messageId ?? '')));

  const lisatyt = [];
  for (const m of viestit) {
    const id = m?.id === undefined || m?.id === null ? null : String(m.id);
    if (!id || nahdyt.has(id)) continue;
    nahdyt.add(id);

    const liittyy = m?.relatedSentMessageId === undefined || m?.relatedSentMessageId === null
      ? null
      : String(m.relatedSentMessageId);

    // Etsitään mihin lähetykseen ja kenelle vastaus kuuluu, jotta käyttöliittymä voi
    // näyttää "Korhonen Elli vastasi: OK" eikä pelkkää numeroa.
    let sendId = null;
    let nimi = null;
    // eventId periytyy alkuperäisestä lähetyksestä, jotta vastaukset kuuluvat samaan
    // tapahtumarajaukseen kuin muukin data (ks. permissions.js eventScoped). Ilman sitä
    // toisen tapahtuman vastaukset näkyisivät rajatullekin käyttäjälle.
    let eventId = null;
    if (liittyy) {
      for (const lahetys of lahetykset) {
        const saaja = (lahetys?.recipients || []).find((s) => String(s?.messageId ?? '') === liittyy);
        if (saaja) {
          sendId = lahetys.id;
          nimi = saaja.nimi || null;
          eventId = lahetys.eventId || null;
          break;
        }
      }
    }

    lisatyt.push({
      id: `vastaus-${id}`,
      messageId: id,
      sentMessageId: liittyy,
      sendId,
      eventId,
      nimi,
      // Numero peitetään myös vastauksissa: se on työntekijän oma puhelinnumero.
      numero: peitaNumero(typeof m?.from === 'string' ? m.from : null),
      body: typeof m?.body === 'string' ? m.body : '',
      ts: typeof m?.submission?.date === 'string' ? m.submission.date : nyt.toISOString(),
    });
  }

  if (lisatyt.length === 0) return { smsReplies: vanhat, lisatty: 0 };
  // Uusin ensin, samaan tapaan kuin audit-loki ja ilmoitukset.
  return { smsReplies: [...lisatyt, ...vanhat], lisatty: lisatyt.length };
}

// Yhteenveto yhden lähetyksen toimitustilanteesta käyttöliittymää varten.
export function koostaTilanne(lahetys) {
  const saajat = Array.isArray(lahetys?.recipients) ? lahetys.recipients : [];
  const laske = (tila) => saajat.filter((s) => s?.status === tila).length;
  return {
    yhteensa: saajat.length,
    perilla: laske('DELIVERED'),
    epaonnistui: laske('FAILED'),
    // ACCEPTED ja SENT ovat molemmat "matkalla": viesti on otettu vastaan mutta
    // toimituskuittausta ei ole vielä tullut.
    matkalla: laske('ACCEPTED') + laske('SENT'),
    kuivaharjoittelu: laske('DRY_RUN'),
  };
}
