// Pikatoimintojen ja hätätekstiviestien käyttöliittymäpuoli. Erotettu App.tsx:stä:
// nämä ovat vakioita ja puhtaita laskureita, eivät komponentin tilaa.

// ====================== PIKATOIMINNOT / HÄTÄTEKSTIVIESTIT ======================
//
// Nämä ovat käyttöliittymän peilikuva server/sms.js:n ryhmistä ja oletusnapeista.
// Vastaanottajien todellinen ratkaisu ja viestin lähetys tapahtuvat AINA palvelimella
// (ks. server/sms.js ja server/index.js) — selain ei koskaan näe puhelinnumeroita
// kokonaisina eikä puhu BulkSMS:n rajapinnan kanssa. Tämä lista on vain valikon ja
// asetuseditorin tekstejä varten, samaan tapaan kuin canView/canEdit peilaavat
// palvelimen oikeussääntöjä suodattamatta itse dataa.
export const SMS_RYHMAT = [
  { id: 'checked_in', label: 'Sisäänkirjatut työntekijät', selite: 'Tapahtumaan sisäänkirjatut eli oikeasti paikalla olevat.' },
  { id: 'roster', label: 'Kaikki tapahtuman työntekijät', selite: 'Kaikki tapahtumaan merkityt, myös vielä sisäänkirjaamattomat.' },
  { id: 'emergency_numbers', label: 'Tapahtuman hätänumerot', selite: 'Tapahtuman perustietojen osio 14: Turva 1, Turva 2, TIKE ja EA-päivystys.' },
  { id: 'custom', label: 'Oma numerolista', selite: 'Nappiin kirjatut kiinteät numerot, eivät riipu tapahtumasta.' },
];

export const smsRyhmanLabel = (id: string) => SMS_RYHMAT.find((r) => r.id === id)?.label || id;

// Oletusnapit kun smsButtons-kokoelmaa ei ole vielä tallennettu. PIDETTÄVÄ SYNKASSA
// server/sms.js:n OLETUSNAPIT-listan kanssa: palvelin käyttää omaansa lähetykseen, tämä
// on vain se mitä valikossa näkyy ennen ensimmäistä tallennusta.
export const SMS_OLETUSNAPIT = [
  {
    id: 'evacuate',
    label: 'KAIKKIEN ALUEIDEN EVAKUOINTI',
    group: 'checked_in',
    customNumbers: [],
    body: 'TURVAJOHTO {tapahtuma}: EVAKUOINTI. Ohjaa yleiso ulos lahimmasta poistumistiesta ja siirry kokoontumispaikalle. Kuittaa TIKE:lle.',
    repliable: false,
    style: 'danger',
  },
  {
    id: 'authority_own',
    label: 'Oma Turva',
    group: 'emergency_numbers',
    customNumbers: [],
    body: 'TURVAJOHTO {tapahtuma}: Oman turvaorganisaation halytys klo {aika}. Ottakaa yhteys TIKE:en valittomasti.',
    repliable: false,
    style: 'neutral',
  },
  {
    id: 'authority_vira',
    label: 'Turva + VIRA',
    group: 'emergency_numbers',
    customNumbers: [],
    body: 'TURVAJOHTO {tapahtuma}: Turva- ja viranomaishalytys klo {aika}. Viranomaiset halytetty. Ottakaa yhteys TIKE:en.',
    repliable: false,
    style: 'neutral',
  },
  {
    id: 'authority_prep',
    label: 'Varautumistilanne',
    group: 'emergency_numbers',
    customNumbers: [],
    body: 'TURVAJOHTO {tapahtuma}: Varautumistilanne klo {aika}. Kohotettu valmius, ei viela toimenpiteita. Odota ohjeita.',
    repliable: false,
    style: 'neutral',
  },
  {
    id: 'instructions',
    label: 'Lähetä toimintaohjeita',
    group: 'checked_in',
    customNumbers: [],
    body: '',
    repliable: false,
    style: 'neutral',
  },
];

// GSM 03.38 -merkistö viestin pituuslaskuria varten. Sama taulukko kuin
// server/bulksms.js:ssä — toistettu tässä tarkoituksella, koska laskurin on päivityttävä
// jokaisella näppäinpainalluksella eikä sitä voi hakea palvelimelta. Palvelin laskee
// pituuden itse uudelleen lähetyshetkellä; tämä on vain käyttäjäpalautetta.
const GSM_PERUS =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_LAAJENNUS = '^{}\\[~]|€';

// Toimitustilojen esitys. ACCEPTED = otettu vastaan lähetettäväksi, SENT = luovutettu
// operaattorille, DELIVERED = perillä puhelimessa, FAILED = ei mennyt perille.
// DRY_RUN on sovelluksen oma tila kuivaharjoittelulle.
export const SMS_TILA_META: Record<string, { label: string; tone: string }> = {
  DELIVERED: { label: 'Perillä', tone: 'bg-emerald-100 text-emerald-700' },
  SENT: { label: 'Matkalla', tone: 'bg-sky-100 text-sky-700' },
  ACCEPTED: { label: 'Vastaanotettu', tone: 'bg-slate-100 text-slate-600' },
  FAILED: { label: 'Ei mennyt perille', tone: 'bg-rose-100 text-rose-700' },
  DRY_RUN: { label: 'Kuivaharjoittelu', tone: 'bg-amber-100 text-amber-700' },
};
export const smsTilaMeta = (tila: string) => SMS_TILA_META[tila] || { label: tila || 'Tuntematon', tone: 'bg-slate-100 text-slate-600' };

// Yhden lähetyksen toimitustilanne. Sama laskenta kuin server/smswebhook.js:n
// koostaTilanne — toistettu tässä koska frontti laskee sen jo ladatusta datasta eikä
// erillistä kutsua kannata tehdä.
export const koostaSmsTilanne = (lahetys: any) => {
  const saajat = Array.isArray(lahetys?.recipients) ? lahetys.recipients : [];
  const laske = (tila: string) => saajat.filter((s: any) => s?.status === tila).length;
  return {
    yhteensa: saajat.length,
    perilla: laske('DELIVERED'),
    epaonnistui: laske('FAILED'),
    matkalla: laske('ACCEPTED') + laske('SENT'),
    kuivaharjoittelu: laske('DRY_RUN'),
  };
};

export const laskeViestinMitat = (text: string) => {
  const s = typeof text === 'string' ? text : '';
  let septetit = 0;
  let gsm = true;
  for (const ch of Array.from(s)) {
    if (GSM_PERUS.includes(ch)) septetit += 1;
    else if (GSM_LAAJENNUS.includes(ch)) septetit += 2;
    else { gsm = false; break; }
  }
  if (!gsm) {
    const yksikot = s.length;
    const osia = yksikot === 0 ? 1 : yksikot <= 70 ? 1 : Math.ceil(yksikot / 67);
    return { encoding: 'UNICODE', pituus: yksikot, osia, osanRaja: osia > 1 ? 67 : 70 };
  }
  const osia = septetit === 0 ? 1 : septetit <= 160 ? 1 : Math.ceil(septetit / 153);
  return { encoding: 'TEXT', pituus: septetit, osia, osanRaja: osia > 1 ? 153 : 160 };
};
