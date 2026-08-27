// Pikatoimintonappien vastaanottajaryhmät ja niiden ratkaisu sovelluksen omasta datasta.
//
// KESKEINEN TIETOTURVAPERIAATE: puhelinnumerot ratkaistaan AINA palvelimella tämän
// moduulin kautta, eikä niitä koskaan oteta pyynnön rungosta. Selain lähettää vain
// napin id:n ja tapahtuman — jos numerot tulisivat clientiltä, kuka tahansa kirjautunut
// (tai devtoolsia käyttävä) voisi lähettää tililtä viestejä mihin tahansa numeroon
// tilin saldolla. Sama syy miksi permissions.js on olemassa: frontti suodattaa vain
// käyttöliittymän.
//
// Nappikonfiguraatio ei ole tapahtumakohtainen (yksi lista koko sovellukselle), mutta
// RYHMÄT ratkaistaan aina valitun tapahtuman kontekstissa: sama "Evakuointi"-nappi
// tavoittaa FestivaaliX:ssä eri ihmiset kuin toisessa tapahtumassa. Näin nappeja ei
// tarvitse määritellä uudelleen jokaiselle tapahtumalle.

import { normalisoiNumero } from './bulksms.js';

// Legacy-data (tallennettu ennen eventId-kenttää) kuuluu FestivaaliXään — sama oletus
// kuin permissions.js:ssä ja src/App.tsx:n suodatuksissa.
const legacyEventId = (item) => item?.eventId || 'fesx';

// Sisäänkirjausrivin tila: 'pending' (merkitty tapahtumaan), 'checked_in', 'checked_out'.
// Oletus on 'checked_in', koska ennen tilakenttää tallennetut rivit olivat sisäänkirjauksia
// (sama oletus kuin src/App.tsx: getEmpStatus).
const rivinTila = (rivi) => rivi?.status || 'checked_in';

export const RYHMAT = {
  checked_in: {
    label: 'Sisäänkirjatut työntekijät',
    selite: 'Tapahtumaan sisäänkirjatut eli oikeasti paikalla olevat.',
  },
  roster: {
    label: 'Kaikki tapahtuman työntekijät',
    selite: 'Kaikki tapahtumaan merkityt, myös ne joita ei ole vielä kirjattu sisään.',
  },
  emergency_numbers: {
    label: 'Tapahtuman hätänumerot',
    selite: 'Tapahtuman perustietojen osio 14: Turva 1, Turva 2, TIKE ja EA-päivystys.',
  },
  custom: {
    label: 'Oma numerolista',
    selite: 'Nappiin kirjatut kiinteät numerot, eivät riipu tapahtumasta.',
  },
};

export const RYHMA_IDT = Object.keys(RYHMAT);

// Oletusnapit ensimmäistä käyttökertaa varten (kun smsButtons-kokoelmaa ei ole vielä
// tallennettu). Vastaavat sitä mitä Pikatoiminnot-valikossa oli ennen kuin napit
// muuttuivat konfiguroitaviksi. Tekstit on kirjoitettu tarkoituksella lyhyiksi: alle 160
// GSM-merkin viesti lähtee yhtenä osana, jolloin se on halvin JA nopein — usean osan
// viestin puhelin näyttää vasta kun kaikki osat ovat saapuneet.
//
// Jokainen runko alkaa tunnisteella "TURVAJOHTO:", koska lähettäjänä näkyy toistaiseksi
// numero eikä nimi: aakkosnumeerinen lähettäjätunnus vaatii Traficomin rekisteröinnin,
// joka astuu voimaan vasta kolmen kuukauden kuluttua hyväksynnästä.
export const OLETUSNAPIT = [
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
    // Tyhjä runko = nappi avaa vapaan tekstikentän. Vahvistusnäkymä ei salli lähetystä
    // tyhjällä tekstillä, joten tämä ei voi lähteä vahingossa sisällöttömänä.
    body: '',
    repliable: false,
    style: 'neutral',
  },
];

// Napin normalisointi: levyltä luettu tietue voi olla vajaa (vanha versio, käsin
// muokattu tiedosto), eikä puuttuva kenttä saa kaataa lähetystä.
export function normalisoiNappi(nappi) {
  const group = RYHMA_IDT.includes(nappi?.group) ? nappi.group : 'checked_in';
  return {
    id: String(nappi?.id ?? ''),
    label: String(nappi?.label ?? '').trim() || '(nimetön)',
    group,
    customNumbers: Array.isArray(nappi?.customNumbers) ? nappi.customNumbers.filter((n) => typeof n === 'string') : [],
    body: typeof nappi?.body === 'string' ? nappi.body : '',
    repliable: nappi?.repliable === true,
    style: nappi?.style === 'danger' ? 'danger' : 'neutral',
  };
}

// Palauttaa käytössä olevat napit: levylle tallennettu lista, tai oletukset jos kokoelmaa
// ei ole vielä koskaan tallennettu (null). Tyhjä taulukko on eri asia kuin null — se
// tarkoittaa että käyttäjä on tarkoituksella poistanut kaikki napit.
export function kaytossaOlevatNapit(tallennetut) {
  if (!Array.isArray(tallennetut)) return OLETUSNAPIT.map(normalisoiNappi);
  return tallennetut.map(normalisoiNappi);
}

// Korvaa rungon paikkamerkit. Tarkoituksella hyvin rajallinen joukko: mitä enemmän
// dynaamista sisältöä hätäviestiin, sitä suurempi riski että se venyy yli 160 merkin
// tai että siihen päätyy tietoa jota televerkkoon ei kuulu.
export function taytaPaikkamerkit(body, { tapahtumanNimi = '', nyt = new Date() } = {}) {
  const aika = `${String(nyt.getHours()).padStart(2, '0')}.${String(nyt.getMinutes()).padStart(2, '0')}`;
  return String(body ?? '')
    .replace(/\{tapahtuma\}/g, tapahtumanNimi)
    .replace(/\{aika\}/g, aika)
    .trim();
}

// Työntekijäpankin puhelinnumero rosteririville. Ensisijaisesti employeeId:llä (rosterirvi
// sidotaan pankkiin sitä lisättäessä), toissijaisesti nimellä — vanhoilla riveillä ei ole
// employeeId-kenttää lainkaan, eivätkä ne muuten löytäisi numeroaan.
function numeroTyontekijalle(rivi, employees) {
  const lista = Array.isArray(employees) ? employees : [];
  if (rivi?.employeeId) {
    const osuma = lista.find((e) => e?.id === rivi.employeeId);
    if (osuma?.phone) return osuma.phone;
  }
  if (rivi?.name) {
    const osuma = lista.find((e) => e?.name === rivi.name);
    if (osuma?.phone) return osuma.phone;
  }
  return null;
}

// Ratkaisee napin vastaanottajat. Palauttaa AINA myös ne joilta numero puuttuu tai on
// kelvoton (`numero: null`, `syy`), jotta vahvistusnäkymä voi kertoa käyttäjälle ketkä
// jäävät ilman viestiä — hätätilanteessa on oleellista tietää kuka EI saanut ohjetta.
export function ratkaiseVastaanottajat(nappi, { eventId, checkins, employees, events }) {
  const n = normalisoiNappi(nappi);
  const kaikkiKirjaukset = Array.isArray(checkins) ? checkins : [];
  const tapahtumat = Array.isArray(events) ? events : [];

  if (n.group === 'custom') {
    return n.customNumbers.map((raaka) => {
      const numero = normalisoiNumero(raaka);
      return {
        // Omalla numerolistalla ei ole nimiä, joten tunnisteena on numero itse — mutta
        // PEITETTYNÄ. Kutsuvat reitit peittävät `numero`-kentän ennen selaimeen
        // palauttamista, joten selväkielinen numero tässä olisi vuoto ohi sen suojan:
        // se päätyisi lähetyshistoriaan, vastauksiin ja käyttöliittymään sellaisenaan.
        nimi: numero ? `${numero.slice(0, 5)}…${numero.slice(-3)}` : raaka,
        rooli: 'Oma numerolista',
        numero,
        ...(numero ? {} : { syy: 'Numeroa ei voi tulkita.' }),
      };
    });
  }

  if (n.group === 'emergency_numbers') {
    const tapahtuma = tapahtumat.find((e) => e?.id === eventId);
    const fd = tapahtuma?.formData || {};
    const kentat = [
      { key: 'phoneTurva1', nimi: 'Turva 1', rooli: 'Turvallisuuspäällikkö' },
      { key: 'phoneTurva2', nimi: 'Turva 2', rooli: 'Turvajohto' },
      { key: 'phoneTike', nimi: 'TIKE', rooli: 'Tilannekeskus' },
      { key: 'phoneFirstAid', nimi: 'EA-päivystys', rooli: 'Ensiapu' },
    ];
    return kentat
      // Tyhjä hätänumerokenttä jätetään kokonaan pois: se ei ole "puuttuva numero"
      // vaan tapahtuma jossa kyseistä roolia ei ole täytetty lainkaan.
      .filter(({ key }) => typeof fd[key] === 'string' && fd[key].trim() !== '')
      .map(({ key, nimi, rooli }) => {
        const numero = normalisoiNumero(fd[key]);
        return { nimi, rooli, numero, ...(numero ? {} : { syy: `Numeroa "${fd[key]}" ei voi tulkita.` }) };
      });
  }

  const tapahtumanRivit = kaikkiKirjaukset.filter((r) => legacyEventId(r) === eventId);
  const rivit = n.group === 'checked_in'
    ? tapahtumanRivit.filter((r) => rivinTila(r) === 'checked_in')
    : tapahtumanRivit;

  return rivit.map((rivi) => {
    const raaka = numeroTyontekijalle(rivi, employees);
    const numero = raaka ? normalisoiNumero(raaka) : null;
    return {
      nimi: rivi?.nickname ? `${rivi.name} (${rivi.nickname})` : rivi?.name || '(nimetön)',
      rooli: rivi?.role || '',
      numero,
      ...(numero
        ? {}
        : { syy: raaka ? `Numeroa "${raaka}" ei voi tulkita.` : 'Puhelinnumero puuttuu työntekijäpankista.' }),
    };
  });
}
