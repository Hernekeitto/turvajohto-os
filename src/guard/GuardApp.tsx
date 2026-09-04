import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, MapPin, Phone, Building2, GraduationCap, ClipboardList, FileText, ShieldAlert, Info, Settings, Route, QrCode, CloudOff, Siren, BookOpen, ListChecks, Megaphone, KeyRound, BarChart3 } from 'lucide-react';
import { useSession } from '../SessionContext';
import { canView, canEdit } from '../shared/oikeudet';
import { jaotteleSailytysajan } from '../shared/sailytysaika';
import { Ylapalkki } from '../shared/komponentit/Ylapalkki';
import { KohteenHallinta } from './KohteenHallinta';
import { Tehtavat } from './Tehtavat';
import { Raportit } from './Raportit';
import { KohteenTiedot } from './KohteenTiedot';
import { Asetukset } from './Asetukset';
import { avaaJono, kaynnistaAutomatiikka, lisaaJonoon } from '../shared/jono';
import { lueVuorodata, tallennaVuorodata, unohdaVuorodata } from '../shared/vuorodata';
import { unohdaIstunto } from '../shared/istunto';
import { Kierrospohjat } from './Kierrospohjat';
import { Kierros } from './Kierros';
import { Halytykset } from './Halytykset';
import { Halytysvahti } from '../shared/komponentit/Halytysvahti';
import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { haeHalytykset, type Halytys } from '../shared/halytykset';
import { useKanava } from '../shared/kanava';
import { useSijainninLahetys } from '../shared/sijainninLahetys';
import { luoMuunnos } from '../shared/georeferointi';
import { Pohjanakyma } from '../shared/komponentit/Pohjanakyma';
import { haeSuoritukset, type Pohja, type Suoritus } from '../shared/pohjat';
import { Tiedotteet, TiedoteKehote } from '../shared/komponentit/Tiedotteet';
import { haeTiedotteet, onKuitannut, onVoimassa, type Tiedote } from '../shared/tiedotteet';
import { Kalusto } from '../shared/komponentit/Kalusto';
import { haeAvaimet, haePoikkeamat, type Avain, type Poikkeama } from '../shared/kalusto';
import { Mittaristo } from '../shared/komponentit/Mittaristo';
import { Jalkiraportit } from '../shared/komponentit/Jalkiraportit';
import { haeJalkiraportit, type Jalkiraportti } from '../shared/jalkiraportit';
import { useHistorianavigointi, useTakaisinEste } from '../shared/navigointi';
import {
  uusiId, type GuardRaportti, type Kohde, type KohteenTiedosto, type RaporttiTyyppi,
  type TehtavaSuoritus, type Kierrospohja, type Kierros as KierrosTietue,
} from './tyypit';

// Turvajohto GUARD -puolen juurikomponentti. Vastaa näkymien välisestä vaihdosta ja
// kohdedatan lataamisesta; yksittäiset näkymät ovat omissa tiedostoissaan, jotta tänne
// ei synny toista App.tsx:ää.
//
// Kohteet ovat guardSites-kokoelmassa (server/store.js). Kohteen id toimii samana
// oikeusavaimena kuin tapahtuman id EVENT-puolella, joten käyttäjän rajaus tiettyihin
// kohteisiin toimii samalla eventAccess-listalla.

// Kohdelista on GUARDin juurinäkymä: sinne palataan jokaisesta näkymästä ja sieltä
// takaisin-nappi sulkee sovelluksen.
const JUURINAKYMA = 'kohdevalinta';

const tyhjaKohde = (): Kohde => ({
  id: '',
  name: '',
  address: '',
  contactName: '',
  contactPhone: '',
  notes: '',
  perehdytykset: [],
  tehtavat: [],
});

export default function GuardApp() {
  const session = useSession();
  const isAdmin = session?.role === 'admin';
  const perms = session?.permissions || {};
  // Kohdevalinta on globaali solmu (ks. server/permissions.js: GLOBAL_NODES), joten
  // tarkistus tehdään aina __default__-asetusta vasten — siksi eventId on null.
  const saaNahda = isAdmin || canView(perms, null, 'guard_sites');
  const saaMuokata = isAdmin || canEdit(perms, null, 'guard_sites');
  // Tehtävien kuittaus on oma oikeutensa: vartija kuittaa tehtäviä mutta ei välttämättä
  // saa muokata kohteen perustietoja.
  const saaNahdaTehtavat = isAdmin || canView(perms, null, 'guard_tasks');
  const saaKuitata = isAdmin || canEdit(perms, null, 'guard_tasks');
  const saaNahdaTiedot = isAdmin || canView(perms, null, 'guard_site_info');
  // Kierroksilla on kaksi eri oikeutta tarkoituksella: pohjan laatiminen on esimiehen
  // työtä, kierroksen kulkeminen vartijan. Jos vartija saisi muokata pohjaa, "kierros
  // tehty kokonaan" tarkoittaisi vain sitä että hän poisti pisteet joita ei ehtinyt käydä.
  const saaNahdaPohjat = isAdmin || canView(perms, null, 'guard_patrol_templates');
  const saaMuokataPohjia = isAdmin || canEdit(perms, null, 'guard_patrol_templates');
  const saaNahdaKierrokset = isAdmin || canView(perms, null, 'guard_patrols');
  const saaKiertaa = isAdmin || canEdit(perms, null, 'guard_patrols');
  // Hälytykset. NÄKEMINEN OIKEUTTAA MYÖS HÄLYTTÄMÄÄN (ks. guard/sivukartta.ts):
  // muokkausoikeuden vaatiminen tarkoittaisi että osa kentällä olevista ei voisi
  // hälyttää. Muokkausoikeus tarvitaan vain toisen hälytyksen kuittaamiseen — oman
  // hälytyksensä saa kuitata aina.
  const saaNahdaHalytykset = isAdmin || canView(perms, null, 'guard_alarms');
  const saaKuitataHalytyksia = isAdmin || canEdit(perms, null, 'guard_alarms');
  // Ohjepankki ja skenaariot (erä 8). Näkeminen riittää käyttöön: ohjekortin lukeminen ja
  // skenaarion käynnistäminen ovat saman tietueen lukemista. Muokkausoikeus ratkaisee kuka
  // laatii pohjat — se on esimiehen työtä samalla tavalla kuin kierrospohjat.
  const saaNahdaOhjeet = isAdmin || canView(perms, null, 'guard_guides');
  const saaMuokataOhjeita = isAdmin || canEdit(perms, null, 'guard_guides');
  const saaNahdaSkenaariot = isAdmin || canView(perms, null, 'guard_plays');
  const saaMuokataSkenaarioita = isAdmin || canEdit(perms, null, 'guard_plays');
  // Tiedotteet: lukuoikeus näyttää ja oikeuttaa kuittaamaan, muokkausoikeus lähettämään.
  const saaNahdaTiedotteet = isAdmin || canView(perms, null, 'guard_broadcast');
  const saaLahettaaTiedotteita = isAdmin || canEdit(perms, null, 'guard_broadcast');
  // Kalusto: avaimet ja varustepoikkeamat. Avainrekisterin muutokset vaativat
  // muokkausoikeuden, koska luovutusmerkintä kertoo kuka pääsee sisään. Poikkeaman
  // ILMOITTAMINEN riittää lukuoikeudella — sen huomaa se joka käyttää varustetta.
  const saaNahdaKalustoa = isAdmin || canView(perms, null, 'guard_keys') || canView(perms, null, 'guard_equipment');
  const saaMuokataAvaimia = isAdmin || canEdit(perms, null, 'guard_keys');
  const saaKasitellaPoikkeamia = isAdmin || canEdit(perms, null, 'guard_equipment');
  // Mittaristo ja jaksoraportit (erä 9). Erilliset oikeudet: mittaristo näyttää lukuja,
  // jaksoraportti on dokumentti joka lähtee toimeksiantajalle. Palvelin laskee luvut vain
  // niistä tietueista jotka käyttäjä saisi lukea rivinä, joten mittariston lukuoikeus ei
  // ohita kirjausten omia oikeuksia.
  const saaNahdaMittarit = isAdmin || canView(perms, null, 'guard_analytics');
  const saaNahdaJaksoraportit = isAdmin || canView(perms, null, 'guard_debrief');
  const saaLaatiaJaksoraportteja = isAdmin || canEdit(perms, null, 'guard_debrief');
  // Raportointi on jaettu lomaketyypeittäin: tapahtumailmoitus sisältää kohdehenkilötiedot
  // ja voi olla eri joukolla ihmisiä kuin päivittäinen toimenpidekirjaus.
  const saaKirjataToimenpiteen = isAdmin || canEdit(perms, null, 'guard_report_action');
  const saaKirjataIlmoituksen = isAdmin || canEdit(perms, null, 'guard_report_jv');
  // Sovellusasetukset on oma solmunsa (guard_settings), ei EVENTin 'settings': muuten
  // toisen puolen asetusoikeus avaisi myös tämän puolen asetukset.
  const saaNahdaAsetukset = isAdmin || canView(perms, null, 'guard_settings');
  const saaNahdaRaportit = isAdmin
    || canView(perms, null, 'guard_site_info')
    || canView(perms, null, 'guard_report_action')
    || canView(perms, null, 'guard_report_jv');

  const [kohteet, setKohteet] = useState<Kohde[]>([]);
  // Ladattu vasta onnistuneen haun jälkeen. Tallennus on estetty siihen asti: ilman tätä
  // epäonnistunut haku (verkkovirhe, oikeuksien puute) jättäisi tilan tyhjäksi ja
  // seuraava tallennus pyyhkisi koko kokoelman palvelimelta. Sama suoja kuin App.tsx:ssä.
  const [ladattu, setLadattu] = useState(false);
  const [virhe, setVirhe] = useState<string | null>(null);
  const [tallentaa, setTallentaa] = useState(false);
  // null = lista näkyvissä, muuten muokattavana oleva kohde (uudella id === '').
  const [lomake, setLomake] = useState<Kohde | null>(null);
  const [poistettava, setPoistettava] = useState<Kohde | null>(null);
  // Työntekijäpankki perehdytysvalintaa varten. Jää tyhjäksi jos käyttäjällä ei ole
  // siihen lukuoikeutta — silloin perehdytettävän nimi kirjoitetaan käsin.
  const [tyontekijat, setTyontekijat] = useState<{ id?: string; name?: string; displayId?: number | null }[]>([]);
  const [tiedostot, setTiedostot] = useState<KohteenTiedosto[]>([]);
  const [tiedostotLadattu, setTiedostotLadattu] = useState(false);
  const [suoritukset, setSuoritukset] = useState<TehtavaSuoritus[]>([]);
  // Kohde jonka tehtäviä ollaan kuittaamassa. Erillinen lomake-tilasta: sama kohde voi
  // olla auki joko hallintaa tai kuittausta varten, eikä niitä pidä sekoittaa.
  const [tehtavaKohde, setTehtavaKohde] = useState<Kohde | null>(null);
  const [raportit, setRaportit] = useState<GuardRaportti[]>([]);
  const [raporttiKohde, setRaporttiKohde] = useState<{ kohde: Kohde; tyyppi: RaporttiTyyppi } | null>(null);
  const [tietoKohde, setTietoKohde] = useState<Kohde | null>(null);
  const [asetuksissa, setAsetuksissa] = useState(false);
  // Kierrospohjat ja kierrokset. Kumpaakaan ei tallenneta täältä kokoelmareitin kautta:
  // pohjilla token syntyy palvelimella, kierroksilla säännöt ovat palvelimella.
  const [pohjat, setPohjat] = useState<Kierrospohja[]>([]);
  const [kierrokset, setKierrokset] = useState<KierrosTietue[]>([]);
  const [pohjaKohde, setPohjaKohde] = useState<Kohde | null>(null);
  const [kierrosKohde, setKierrosKohde] = useState<Kohde | null>(null);
  // Hälytykset (erä 7). Palvelimen ylläpitämä kokoelma: tänne tulee vain luettua tilaa,
  // ja jokainen muutos tehdään /api/halytys-reiteillä.
  const [halytykset, setHalytykset] = useState<Halytys[]>([]);
  const [halytysKohde, setHalytysKohde] = useState<Kohde | null>(null);
  // Pohjanäkymä (erä 8): sama näkymä kahdelle lajille, joten tilassa on myös laji.
  const [pohjaNakyma, setPohjaNakyma] = useState<{ kohde: Kohde; laji: 'guide' | 'play' } | null>(null);
  // Pohjien suoritukset. Nimi on eri kuin tehtäväsuorituksilla (`suoritukset`), koska ne
  // ovat eri kokoelma ja eri asia: tehtävä on kohteen vakiotyö, skenaario on tilanne.
  const [pohjaSuoritukset, setPohjaSuoritukset] = useState<Suoritus[]>([]);
  const [tiedotteet, setTiedotteet] = useState<Tiedote[]>([]);
  const [tiedoteKohde, setTiedoteKohde] = useState<Kohde | null>(null);
  const [avaimet, setAvaimet] = useState<Avain[]>([]);
  const [poikkeamat, setPoikkeamat] = useState<Poikkeama[]>([]);
  const [kalustoKohde, setKalustoKohde] = useState<Kohde | null>(null);
  const [mittariKohde, setMittariKohde] = useState<Kohde | null>(null);
  const [jaksoKohde, setJaksoKohde] = useState<Kohde | null>(null);
  const [jalkiraportit, setJalkiraportit] = useState<Jalkiraportti[]>([]);
  // Man-down päällä/pois säilyy laitteella: vartija kytkee sen kerran vuoron alussa,
  // eikä asetus saa nollautua sivun latauksesta kesken vuoron.
  const [mandown, setMandown] = useState(false);
  // Skannauksen tulos: puhelimen kamera avasi /guard?piste=<token>, ja palvelin kertoo
  // mitä siitä seurasi. Näytetään bannerina, koska käyttäjä tuli sivulle kameran kautta
  // eikä hän tiedä mitä sovelluksessa tapahtui.
  const [skannaus, setSkannaus] = useState<{ tyyppi: 'ok' | 'virhe'; viesti: string } | null>(null);
  const skannausTehty = useRef(false);
  // Aikaleima siitä milloin näytettävät tiedot on tallennettu laitteelle. Ei-null
  // tarkoittaa, että ollaan offline-tilassa ja katsotaan tallennetta.
  const [offlineTiedot, setOfflineTiedot] = useState<string | null>(null);

  // Lähtevä jono avataan käyttäjäkohtaisena: jaetulla laitteella vuoron vaihtuessa
  // seuraava vartija ei saa nähdä eikä lähettää edellisen kirjauksia omissa nimissään.
  useEffect(() => {
    avaaJono(session?.username || '');
    kaynnistaAutomatiikka();
  }, [session?.username]);

  useEffect(() => {
    if (!saaNahda) return;
    // Paluu tallenteeseen tehdään MILLE TAHANSA epäonnistuneelle haulle eikä vain
    // fetchin hylkäykselle. Kentällä katkos näkyy yhtä usein 502:na tai 504:na
    // (nginx pystyssä, backend nurin) tai kirjautumissivuna (kytäköverkko) kuin
    // puhtaana verkkovirheenä — ja vartijalle ne kaikki ovat sama tilanne.
    const paluuTallenteeseen = () => {
      const tallenne = lueVuorodata(session?.username || '');
      if (tallenne) {
        setKohteet(tallenne.kohteet);
        setPohjat(tallenne.pohjat);
        setKierrokset(tallenne.kierrokset);
        setOfflineTiedot(tallenne.tallennettu);
      } else {
        setVirhe('Kohteita ei voitu hakea: ei yhteyttä palvelimeen.');
      }
    };
    fetch('/api/data/guardSites', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true) {
          if (Array.isArray(res.data)) setKohteet(res.data);
          setLadattu(true);
        } else {
          paluuTallenteeseen();
        }
      })
      .catch(() => {
        // Sama paluu kuin epäonnistuneelle vastaukselle.
        //
        // HUOM: ladattu EI mene todeksi. Tallenne on riisuttu kopio (ei perehdytyksiä),
        // eikä sillä saa kirjoittaa kohteita takaisin palvelimelle: se pyyhkisi
        // perehdytyslistat. Kohteiden muokkaus on siis offline-tilassa estetty, ja se on
        // oikein — kohteita hallitaan valvomossa.
        paluuTallenteeseen();
      });
  }, [saaNahda, session?.username]);

  useEffect(() => {
    if (!saaNahda) return;
    // 403 on tässä normaali lopputulos eikä virhe: kaikilla GUARD-käyttäjillä ei ole
    // oikeutta koko yrityksen työntekijärekisteriin. Silloin perehdytyslistaan
    // kirjoitetaan nimi käsin.
    fetch('/api/data/employees', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true && Array.isArray(res.data)) setTyontekijat(res.data);
      })
      .catch(() => { /* ei kriittinen */ });
  }, [saaNahda]);

  useEffect(() => {
    if (!saaNahda) return;
    fetch('/api/data/guardFiles', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true) {
          if (Array.isArray(res.data)) setTiedostot(res.data);
          setTiedostotLadattu(true);
        }
      })
      .catch(() => { /* virhe näkyy tiedostovälilehdellä tyhjänä listana */ });
  }, [saaNahda]);

  useEffect(() => {
    if (!saaNahdaTehtavat) return;
    fetch('/api/data/guardTaskRuns', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true && Array.isArray(res.data)) setSuoritukset(res.data);
      })
      .catch(() => { /* virhe näkyy tyhjänä suorituslistana */ });
  }, [saaNahdaTehtavat]);

  useEffect(() => {
    if (!saaNahdaRaportit) return;
    fetch('/api/data/guardReports', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true && Array.isArray(res.data)) setRaportit(res.data);
      })
      .catch(() => { /* virhe näkyy tyhjänä raporttilistana */ });
  }, [saaNahdaRaportit]);

  // Kierrospohjat ja kierrokset haetaan erikseen, koska niiden oikeudet ovat eri solmuja
  // kuin kohteiden. Molemmat luetaan normaalilta kokoelmareitiltä (kirjoitus ei kulje
  // sitä kautta), joten palvelin suodattaa ne käyttäjän oikeuksien mukaan.
  const haePohjat = () => {
    fetch('/api/data/templates', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => { if (res && res.ok === true && Array.isArray(res.data)) setPohjat(res.data); })
      .catch(() => { /* virhe näkyy tyhjänä pohjalistana */ });
  };

  const haeKierrokset = () => {
    fetch('/api/data/patrolRuns', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => { if (res && res.ok === true && Array.isArray(res.data)) setKierrokset(res.data); })
      .catch(() => { /* virhe näkyy tyhjänä kierroslistana */ });
  };

  const paivitaPohjaSuoritukset = useCallback(() => {
    if (!saaNahdaSkenaariot) return;
    haeSuoritukset().then((lista) => { if (lista) setPohjaSuoritukset(lista); });
  }, [saaNahdaSkenaariot]);

  const paivitaTiedotteet = useCallback(() => {
    if (!saaNahdaTiedotteet) return;
    haeTiedotteet().then((lista) => { if (lista) setTiedotteet(lista); });
  }, [saaNahdaTiedotteet]);

  useEffect(() => { paivitaTiedotteet(); }, [paivitaTiedotteet]);

  const paivitaAvaimet = useCallback(() => {
    if (!saaNahdaKalustoa) return;
    haeAvaimet().then((lista) => { if (lista) setAvaimet(lista); });
  }, [saaNahdaKalustoa]);
  const paivitaPoikkeamat = useCallback(() => {
    if (!saaNahdaKalustoa) return;
    haePoikkeamat().then((lista) => { if (lista) setPoikkeamat(lista); });
  }, [saaNahdaKalustoa]);

  useEffect(() => { paivitaAvaimet(); paivitaPoikkeamat(); }, [paivitaAvaimet, paivitaPoikkeamat]);

  // Jälkiraportit haetaan tavalliselta kokoelmareitiltä, mutta niitä ei koskaan
  // kirjoiteta takaisin: kokoelma on palvelimen ylläpitämä (jäädytetyt luvut, lukitus).
  const paivitaJalkiraportit = useCallback(() => {
    if (!saaNahdaJaksoraportit) return;
    haeJalkiraportit().then((lista) => { if (lista) setJalkiraportit(lista); });
  }, [saaNahdaJaksoraportit]);

  useEffect(() => { paivitaJalkiraportit(); }, [paivitaJalkiraportit]);

  const paivitaTiedote = (tiedote: Tiedote) => {
    setTiedotteet((edelliset) => {
      const tunnettu = edelliset.some((t) => t.id === tiedote.id);
      return tunnettu ? edelliset.map((t) => (t.id === tiedote.id ? tiedote : t)) : [tiedote, ...edelliset];
    });
  };

  useEffect(() => {
    // Pohjat tarvitaan myös ohjepankkiin ja skenaarioihin: ne ovat samassa kokoelmassa
    // kuin kierrospohjat (perusta P6), ja palvelin suodattaa lajikohtaisesti.
    if (saaNahdaPohjat || saaNahdaKierrokset || saaNahdaOhjeet || saaNahdaSkenaariot) haePohjat();
    if (saaNahdaKierrokset) haeKierrokset();
    paivitaPohjaSuoritukset();
  }, [saaNahdaPohjat, saaNahdaKierrokset, saaNahdaOhjeet, saaNahdaSkenaariot, paivitaPohjaSuoritukset]);

  const paivitaPohjaSuoritus = (suoritus: Suoritus) => {
    setPohjaSuoritukset((edelliset) => {
      const tunnettu = edelliset.some((s) => s.id === suoritus.id);
      return tunnettu ? edelliset.map((s) => (s.id === suoritus.id ? suoritus : s)) : [suoritus, ...edelliset];
    });
  };

  // Hälytykset luetaan samalta kokoelmareitiltä kuin muutkin, mutta niitä EI koskaan
  // kirjoiteta takaisin: kokoelma on palvelimen ylläpitämä.
  const paivitaHalytykset = useCallback(() => {
    if (!saaNahdaHalytykset) return;
    haeHalytykset().then((lista) => { if (lista) setHalytykset(lista); });
  }, [saaNahdaHalytykset]);

  useEffect(() => { paivitaHalytykset(); }, [paivitaHalytykset]);

  // Kanava. GUARD-puoli ei ole tähän asti tarvinnut sitä, mutta hälytys on juuri se
  // tieto jota ei voi jäädä odottamaan seuraavaa sivunlatausta: lauennut ajastin on
  // näytettävä vartijalle heti, ja valvomon kuittaus on näytettävä hänelle heti.
  //
  // Sama yhteys kuljettaa myös sijainnin kentältä palvelimelle (erä 3).
  const { laheta: lahetaKanavalle } = useKanava({
    onMuutos: (kokoelma) => {
      if (kokoelma === 'alerts') paivitaHalytykset();
      if (kokoelma === 'patrolRuns') haeKierrokset();
      if (kokoelma === 'templates') haePohjat();
      if (kokoelma === 'templateRuns') paivitaPohjaSuoritukset();
      if (kokoelma === 'broadcasts') paivitaTiedotteet();
      if (kokoelma === 'keys') paivitaAvaimet();
      if (kokoelma === 'equipmentIssues') paivitaPoikkeamat();
      if (kokoelma === 'debriefs') paivitaJalkiraportit();
    },
  });

  // Kohde jonka näkymässä ollaan. Sijainti liitetään siihen, koska vyöhykesäännöt ja
  // hälytysnumerot ovat kohteen omia — yhden kohteen vuorossa (tavallisin tapaus) se on
  // suoraan ainoa kohde.
  const aktiivinenKohde = kierrosKohde || halytysKohde || tehtavaKohde || tietoKohde
    || raporttiKohde?.kohde || (kohteet.length === 1 ? kohteet[0] : null);

  // Sijainnin lähetys. Kytkin on palvelimella (SIJAINTISEURANTA), ja istunto kertoo sen
  // tilan — ilman tätä selain kysyisi paikannuslupaa toimintoon jota ei ole olemassa.
  //
  // Kuvakoordinaatti lasketaan kohteen kalibroinnista jos sellainen on. Ilman
  // kalibrointia sijainti lähtee pelkkänä GPS:nä: se riittää hälytyksen sijaintiin ja
  // lähimmän hakuun, mutta vyöhykesäännöt tarvitsevat kohdan pohjakuvalla.
  useSijainninLahetys({
    kaytossa: session?.sijaintiseuranta === true && !!aktiivinenKohde,
    eventId: aktiivinenKohde?.id || null,
    laheta: lahetaKanavalle,
    muunnos: luoMuunnos((aktiivinenKohde as { mapRef?: never[] } | null)?.mapRef),
  });

  const vaihdaMandown = (paalla: boolean) => {
    setMandown(paalla);
    try {
      window.localStorage.setItem('turvajohto-mandown', paalla ? '1' : '0');
    } catch {
      // Yksityinen selaustila: asetus jää voimaan vain tämän sivunlatauksen ajaksi.
    }
  };

  useEffect(() => {
    try {
      setMandown(window.localStorage.getItem('turvajohto-mandown') === '1');
    } catch {
      // Ei tallennettua asetusta.
    }
  }, []);

  const paivitaHalytys = (halytys: Halytys) => {
    setHalytykset((edelliset) => {
      const tunnettu = edelliset.some((h) => h.id === halytys.id);
      return tunnettu ? edelliset.map((h) => (h.id === halytys.id ? halytys : h)) : [halytys, ...edelliset];
    });
  };

  // Palvelimelta palautuva kierros korvaa listassa olevan. Tila ei ole tässä
  // "totuus" vaan näkymä palvelimen tilaan: jokainen muutos on jo tallennettu kun se
  // saapuu tänne.
  // Tallennetaan kuluvan vuoron työtiedot laitteelle aina kun ne on haettu onnistuneesti.
  // Tallenne on riisuttu: ei raportteja, ei työntekijöitä, ei perehdytyksiä
  // (ks. shared/vuorodata.ts).
  useEffect(() => {
    if (!ladattu || !session?.username) return;
    tallennaVuorodata(session.username, { kohteet, pohjat, kierrokset });
  }, [ladattu, session?.username, kohteet, pohjat, kierrokset]);

  const paivitaKierros = (kierros: KierrosTietue) => {
    setKierrokset((edelliset) => {
      const tunnettu = edelliset.some((k) => k.id === kierros.id);
      return tunnettu ? edelliset.map((k) => (k.id === kierros.id ? kierros : k)) : [kierros, ...edelliset];
    });
  };

  // QR-tarran skannaus. Puhelimen oma kamera avaa /guard?piste=<token>, joten sovellus
  // näkee tokenin osoiteriviltä. Palvelin selvittää mihin pohjaan piste kuuluu ja onko
  // vartijalla siihen kesken oleva kierros — selain ei tiedä kummastakaan mitään.
  //
  // Token poistetaan osoiteriviltä heti: se ei ole salaisuus, mutta osoiterivillä
  // roikkuva token johtaisi kaksoiskuittausyritykseen jokaisella sivun latauksella.
  useEffect(() => {
    // Odotetaan kohdelistaa: ilman sitä oikeaa kierrosnäkymää ei osata avata. Token
    // luetaan vasta täällä, koska sen poistaminen osoiteriviltä liian aikaisin
    // hukkaisi koko skannauksen. Ref varmistaa yhden ajon: kohdelista on riippuvuus
    // (sitä luetaan alla), mutta skannaus saa tapahtua vain kerran.
    if (!ladattu || skannausTehty.current) return;
    const token = new URLSearchParams(window.location.search).get('piste');
    if (!token) return;
    skannausTehty.current = true;
    // Nykyinen tila säilytetään: siinä on navigoinnin näkymätunniste (shared/navigointi),
    // ja sen nollaaminen tekisi ensimmäisestä takaisin-painalluksesta tehottoman.
    window.history.replaceState(window.history.state, '', window.location.pathname);
    if (!saaKiertaa) {
      setSkannaus({ tyyppi: 'virhe', viesti: 'Sinulla ei ole oikeutta kuitata kierrospisteitä.' });
      return;
    }
    // EI peruutuslippua eikä siivousfunktiota. Se olisi tavanomainen tapa suojata
    // purettua komponenttia, mutta tässä se rikkoi koko toiminnon: StrictMode ajaa
    // efektin kehityksessä kahdesti, jolloin ensimmäisen ajon siivous perui juuri sen
    // ainoan kuittauksen — piste kuitattiin palvelimella mutta käyttöliittymä ei
    // kertonut siitä mitään. Kertaluontoisuus tulee refistä, ja tämä komponentti on
    // sovelluksen juuri joka ei purkaudu kesken kaiken.
    const kuittaa = async () => {
      const gps = await new Promise<{ lat: number; lon: number } | null>((valmis) => {
        if (!navigator.geolocation) return valmis(null);
        navigator.geolocation.getCurrentPosition(
          (s) => valmis({ lat: s.coords.latitude, lon: s.coords.longitude }),
          () => valmis(null),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
        );
      });
      try {
        const res = await fetch('/api/kierros/skannaus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token, gps }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok) {
          paivitaKierros(data.kierros);
          setSkannaus({ tyyppi: 'ok', viesti: `Tarkistuspiste "${data.pisteNimi}" kuitattu.` });
          const kohde = kohteet.find((k) => k.id === data.kierros.siteId);
          if (kohde) setKierrosKohde(kohde);
        } else {
          setSkannaus({ tyyppi: 'virhe', viesti: data?.error || 'Kuittaus epäonnistui.' });
          // Ehdotus tulee kun kierrosta ei ole vielä aloitettu: viedään käyttäjä sen
          // kohteen kierrosnäkymään, jotta aloitus on yhden painalluksen päässä.
          const kohde = data?.ehdotus && kohteet.find((k) => k.id === data.ehdotus.siteId);
          if (kohde) setKierrosKohde(kohde);
        }
      } catch {
        setSkannaus({ tyyppi: 'virhe', viesti: 'Kuittaus epäonnistui: ei yhteyttä palvelimeen.' });
      }
    };
    kuittaa();
  }, [ladattu, saaKiertaa, kohteet]);

  // Raportti lisätään uutena tietueena samalla periaatteella kuin tehtäväsuoritus:
  // kirjattua raporttia ei muokata jälkikäteen, vaan tarvittaessa kirjataan uusi.
  // Raportti menee LÄHTEVÄN JONON kautta yhtenä tietueena eikä koko kokoelmana.
  //
  // Kaksi syytä. Kentällä verkko voi olla poikki, ja silloin kirjaus jää jonoon ja
  // lähtee itsestään kun yhteys palaa — vartijan ei tarvitse muistaa mitään. Ja koko
  // kokoelman tallennus vanhentuneesta selaimesta pyyhkisi kaiken mitä muut ovat
  // sillä välin kirjanneet (ks. server/index.js: /api/kirjaa/:name).
  const tallennaRaportti = async (raportti: GuardRaportti) => {
    // Näytetään heti omassa listassa: kirjaus on tehty, vaikka se olisi vielä matkalla.
    setRaportit((edelliset) => [...edelliset, raportti]);
    const tulos = await lisaaJonoon({
      polku: '/api/kirjaa/guardReports',
      runko: raportti,
      kuvaus: `${raportti.type}: ${raportti.place || ''}`.trim(),
      tunniste: `guardReport:${raportti.id}`,
    });
    if (!tulos.lahetetty) {
      // Ei virhe vaan tilanne: JonoTila kertoo että kirjaus odottaa lähetystä.
      setVirhe(null);
    }
    return true;
  };

  // Tehtäväsuoritus lisätään aina uutena tietueena eikä koskaan korvaa aiempaa: sama
  // kierros ajetaan joka vuorossa uudelleen, ja jokainen kerta on oma merkintänsä lokissa.
  // Sama kuin raporteilla: yksi tietue jonon kautta. Tehtäväsuoritus on jo valmiiksi
  // vain lisättävä eikä koskaan muutettava, joten lisäysreitti sopii sille sellaisenaan.
  const suoritaTehtava = async (suoritus: TehtavaSuoritus) => {
    setSuoritukset((edelliset) => [...edelliset, suoritus]);
    await lisaaJonoon({
      polku: '/api/kirjaa/guardTaskRuns',
      runko: suoritus,
      kuvaus: `Tehtävä: ${suoritus.tehtavaNimi}`,
      tunniste: `taskRun:${suoritus.id}`,
    });
    return true;
  };

  // Tiedoston lisäys on kaksivaiheinen: itse tiedosto menee uploads-hakemistoon ja siitä
  // saatu id tallennetaan guardFiles-kokoelmaan. Jos jälkimmäinen epäonnistuu, liite jää
  // orvoksi levylle — palvelimen roskienkeruu siivoaa sen armonajan jälkeen (uploads.js).
  const lisaaTiedosto = async (tiedosto: File) => {
    if (!lomake?.id) throw new Error('Tallenna kohde ennen tiedostojen lisäämistä.');
    if (!tiedostotLadattu) throw new Error('Tiedostoja ei ole vielä ladattu — yritä hetken kuluttua uudelleen.');
    const lomakedata = new FormData();
    lomakedata.append('file', tiedosto);
    const lataus = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: lomakedata });
    const latausRes = await lataus.json().catch(() => null);
    if (!lataus.ok || !latausRes?.ok) {
      throw new Error(latausRes?.error || 'Tiedoston lähetys epäonnistui.');
    }
    const merkinta: KohteenTiedosto = {
      id: uusiId(),
      siteId: lomake.id,
      name: latausRes.name || tiedosto.name,
      uploadId: latausRes.id,
      size: latausRes.size,
      lisatty: new Date().toISOString(),
      lisaaja: session?.nickname || undefined,
    };
    const uudet = [...tiedostot, merkinta];
    const r = await fetch('/api/data/guardFiles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(uudet),
    });
    const res = await r.json().catch(() => null);
    if (!r.ok || !res?.ok) throw new Error(res?.error || 'Tiedoston tallennus epäonnistui.');
    setTiedostot(uudet);
  };

  // Pohjakartta EI mene guardFiles-kokoelmaan vaan kohteen omaan kenttään, samoin kuin
  // tapahtuman kartta (App.tsx: tallennaPohjakartta). Se ei ole kohteen asiakirja vaan
  // se pinta jonka päälle vyöhykkeet piirretään, eikä sen kuulu näkyä tiedostolistassa.
  // Kartta tallentuu kohteen mukana vasta kun kohde tallennetaan.
  const lataaKartta = async (tiedosto: File) => {
    const lomakedata = new FormData();
    lomakedata.append('file', tiedosto);
    const lataus = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: lomakedata });
    const latausRes = await lataus.json().catch(() => null);
    if (!lataus.ok || !latausRes?.ok) {
      throw new Error(latausRes?.error || 'Kartan lähetys epäonnistui.');
    }
    setLomake((edellinen) =>
      edellinen ? { ...edellinen, mapUploadId: latausRes.id, mapUploadName: latausRes.name || tiedosto.name } : edellinen
    );
  };

  const poistaTiedosto = async (id: string) => {
    const jaljelle = tiedostot.filter((t) => t.id !== id);
    const r = await fetch(`/api/data/guardFiles${jaljelle.length === 0 ? '?allowEmpty=1' : ''}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(jaljelle),
    });
    const res = await r.json().catch(() => null);
    if (r.ok && res?.ok) setTiedostot(jaljelle);
    else setVirhe(res?.error || 'Tiedoston poisto epäonnistui.');
  };

  // salliTyhja=true ohittaa palvelimen romahdussuojan, joka muuten hylkää tallennuksen
  // joka korvaisi olemassa olevan datan tyhjällä (server/index.js: wouldWipeNonEmptyCollection).
  // Suoja on oikea oletus — epäonnistunut haku + automaattitallennus voisi muuten pyyhkiä
  // koko kokoelman — mutta VIIMEISEN kohteen tarkoituksellinen poisto on eri asia, ja ilman
  // tätä se epäonnistuisi harhaanjohtavaan virheeseen. HUOM: palvelin hyväksyy allowEmptyn
  // vain adminilta, joten muut eivät voi poistaa viimeistä kohdetta.
  const tallenna = async (uudet: Kohde[], { salliTyhja = false } = {}) => {
    if (!ladattu) {
      setVirhe('Kohteita ei ole vielä ladattu — muutosta ei tallennettu.');
      return false;
    }
    setTallentaa(true);
    setVirhe(null);
    try {
      const r = await fetch(`/api/data/guardSites${salliTyhja ? '?allowEmpty=1' : ''}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(uudet),
      });
      const res = await r.json().catch(() => null);
      if (r.ok && res && res.ok === true) {
        setKohteet(uudet);
        return true;
      }
      setVirhe(`Tallennus epäonnistui: ${(res && res.error) || `virhe ${r.status}`}`);
      return false;
    } catch {
      setVirhe('Tallennus epäonnistui: ei yhteyttä palvelimeen.');
      return false;
    } finally {
      setTallentaa(false);
    }
  };

  const tallennaLomake = async () => {
    if (!lomake) return;
    const nimi = lomake.name.trim();
    if (!nimi) {
      setVirhe('Kohteella on oltava nimi.');
      return;
    }
    const uusi = !lomake.id;
    const kohde: Kohde = { ...lomake, name: nimi, id: lomake.id || uusiId() };
    const uudet = uusi
      ? [...kohteet, kohde]
      : kohteet.map((k) => (k.id === kohde.id ? kohde : k));
    if (await tallenna(uudet)) setLomake(null);
  };

  const poista = async () => {
    if (!poistettava) return;
    const jaljelle = kohteet.filter((k) => k.id !== poistettava.id);
    if (await tallenna(jaljelle, { salliTyhja: jaljelle.length === 0 })) setPoistettava(null);
  };

  // Vanhentuneiden raporttien havitys. Sama kaksivaiheinen vahvistus kuin
  // tapahtumapuolella: poisto on peruuttamaton ja koskee lakisaateisesti sailytettya
  // aineistoa, joten pelkka OK-nappi ei riita.
  const havitaVanhentuneet = async () => {
    const { vanhentuneet } = jaotteleSailytysajan(
      raportit.map((r) => ({ ...r, createdAt: r.luotu || null }))
    );
    if (vanhentuneet.length === 0) return;
    const rivi = String.fromCharCode(10);
    const vahvistus = window.prompt(
      [
        `HÄVITETÄÄN ${vanhentuneet.length} ilmoitusta pysyvästi.`,
        '',
        'Näiden lakisääteinen säilytysaika (2 vuotta laatimisvuoden päättymisestä)',
        'on umpeutunut. Poistoa ei voi perua, ja myös liitetiedostot poistetaan.',
        '',
        'Vahvista kirjoittamalla: HÄVITÄ',
      ].join(rivi)
    );
    if (vahvistus === null) return;
    if (vahvistus.trim().toUpperCase() !== 'HÄVITÄ') {
      window.alert('Vahvistus ei täsmää — mitään ei poistettu.');
      return;
    }
    const poistettavat = new Set(vanhentuneet.map((r: any) => r.id));
    const jaljelle = raportit.filter((r) => !poistettavat.has(r.id));
    try {
      const r = await fetch(`/api/data/guardReports${jaljelle.length === 0 ? '?allowEmpty=1' : ''}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(jaljelle),
      });
      const res = await r.json().catch(() => null);
      if (!r.ok || !res?.ok) {
        setVirhe(res?.error || 'Hävitys epäonnistui.');
        return;
      }
      setRaportit(jaljelle);
      window.alert(`${vanhentuneet.length} ilmoitusta hävitettiin pysyvästi.`);
    } catch {
      setVirhe('Hävitys epäonnistui: ei yhteyttä palvelimeen.');
    }
  };

  // --- Näkymät ja takaisin-painike --------------------------------------------------
  //
  // GUARDin näkymät ovat kaikki YHDEN tason syvyydellä kohdelistasta: jokainen aukeaa
  // kohderivin painikkeesta ja jokaisen paluulinkki sanoo "Takaisin kohdelistaan".
  // Siksi näkymän sulkeminen on aina sama toimenpide — kaikkien nollaus — eikä
  // näkymäkohtaista paluuta tarvita.
  const nollaaNakymat = () => {
    setLomake(null);
    setPoistettava(null);
    setTehtavaKohde(null);
    setRaporttiKohde(null);
    setTietoKohde(null);
    setAsetuksissa(false);
    setPohjaKohde(null);
    setKierrosKohde(null);
    setHalytysKohde(null);
    setPohjaNakyma(null);
    setTiedoteKohde(null);
    setKalustoKohde(null);
    setMittariKohde(null);
    setJaksoKohde(null);
  };

  // Nykyisen näkymän tunniste historiaa varten. Järjestys on SAMA kuin alla olevassa
  // renderöintiketjussa — jos ne eroaisivat, historia kertoisi eri näkymän kuin
  // ruudulla on.
  const nakyma =
    asetuksissa ? 'asetukset'
      : raporttiKohde ? 'raportit'
      : tietoKohde ? 'kohteen-tiedot'
      : kalustoKohde ? 'kalusto'
      : mittariKohde ? 'mittaristo'
      : jaksoKohde ? 'jaksoraportit'
      : tiedoteKohde ? 'tiedotteet'
      : pohjaNakyma ? 'pohjat'
      : halytysKohde ? 'halytykset'
      : kierrosKohde ? 'kierrokset'
      : pohjaKohde ? 'kierrospohjat'
      : tehtavaKohde ? 'tehtavat'
      : lomake ? 'kohteen-hallinta'
      : JUURINAKYMA;

  // Takaisin-nappi vie kohdelistaan. Jos merkintä osoittaa johonkin muuhun näkymään,
  // sinne ei yritetä palata: näkymä tarvitsisi kohteen jota historiamerkinnässä ei ole,
  // ja Androidin asennetussa sovelluksessa ei ole eteenpäin-nappia jolla sellaiseen
  // merkintään ylipäätään päätyisi.
  useHistorianavigointi(nakyma, nollaaNakymat);

  // Poistovahvistus on modaali: takaisin peruu sen eikä vie kohdelistaan.
  useTakaisinEste(!!poistettava, () => setPoistettava(null));

  const kirjauduUlos = async () => {
    // Laitteelle ei jää työtietoja uloskirjautumisen jälkeen. Jonoa EI tyhjennetä:
    // lähettämätön kirjaus on tehtyä työtä, ja se odottaa seuraavaa kirjautumista.
    unohdaVuorodata();
    unohdaIstunto();
    await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    window.location.reload();
  };

  const ylapalkki = (alaotsikko: string) => (
    <Ylapalkki
      tuoteNimi="Turvajohto GUARD"
      alaotsikko={alaotsikko}
      onLogo={nollaaNakymat}
      // GUARD-puolella ei ole vielä ilmoituksia eikä salasananvaihtoa: molemmat odottavat
      // purkamista jaetuksi App.tsx:stä. Uloskirjautuminen toimii jo.
      ilmoitukset={[]}
      onIlmoitus={() => {}}
      nimimerkki={session?.nickname || ''}
      isAdmin={!!isAdmin}
      onLogout={kirjauduUlos}
    />
  );

  if (!saaNahda) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col">
        {ylapalkki('Vartiointi')}
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-md bg-surface border border-line rounded-xl p-6 text-center">
            <h2 className="font-bold mb-2 text-ink-strong">Ei näkyvyysoikeutta kohteisiin</h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Käyttäjätasollasi ei ole oikeutta Kohdevalintaan. Pääkäyttäjä voi lisätä sen
              Sovellusasetusten Käyttäjätasot-osiosta.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {ylapalkki(
        asetuksissa ? 'Sovellusasetukset'
          : raporttiKohde ? 'Raportointi'
          : tietoKohde ? 'Kohteen tiedot'
          : halytysKohde ? 'Hälytykset'
          : pohjaNakyma ? (pohjaNakyma.laji === 'guide' ? 'Ohjepankki' : 'Skenaariot')
          : tiedoteKohde ? 'Tiedotteet'
          : kalustoKohde ? 'Kalusto'
          : mittariKohde ? 'Mittaristo'
          : jaksoKohde ? 'Jaksoraportit'
          : kierrosKohde ? 'Kierrokset'
          : pohjaKohde ? 'Kierrospohjat'
          : tehtavaKohde ? 'Työvuoron tehtävät'
          : lomake ? (lomake.id ? 'Kohteen hallinta' : 'Uusi kohde')
          : 'Kohdevalinta'
      )}

      <main className="flex-1 p-6 md:p-10">
        <div className="max-w-5xl mx-auto">
          {/* Hälytysvahti on ENSIMMÄISENÄ ja kaikissa näkymissä. Ajastimen laskuri,
              man-down-kysely ja lauennut hälytys eivät saa olla yhden näkymän takana:
              vartija ei ole hälytysnäkymässä silloin kun hälytys laukeaa. */}
          {/* Tiedotekehote hälytysvahdin vieressä ja samasta syystä: kuittaamaton tiedote
              on nostettava käyttäjän eteen kesken työn, ei odotettava että hän avaa
              tiedotesivun. Aktiivinen kohde ratkaisee minkä kohteen tiedotteet näytetään. */}
          {saaNahdaTiedotteet && (
            <TiedoteKehote
              ownerId={aktiivinenKohde?.id || null}
              kayttaja={session?.username || ''}
              tiedotteet={tiedotteet}
              onMuutos={paivitaTiedote}
            />
          )}
          {saaNahdaHalytykset && (
            <Halytysvahti
              eventId={aktiivinenKohde?.id || null}
              kayttaja={session?.username || ''}
              halytykset={halytykset}
              onMuutos={paivitaHalytys}
              onVirkista={paivitaHalytykset}
              mandown={mandown}
            />
          )}

          {virhe && (
            <p className="mb-6 text-sm text-danger-ink bg-danger-soft border border-danger/30 rounded-lg px-4 py-3">
              {virhe}
            </p>
          )}

          {offlineTiedot && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3">
              <CloudOff size={18} className="text-warning-ink shrink-0 mt-0.5" />
              <p className="text-sm text-warning-ink">
                <span className="font-medium">Ei yhteyttä palvelimeen.</span>{' '}
                Näytössä ovat laitteelle tallennetut työtiedot{' '}
                {new Date(offlineTiedot).toLocaleString('fi-FI')}. Kierroksen voi tehdä
                normaalisti — kuittaukset lähtevät kun yhteys palaa.
              </p>
            </div>
          )}

          {/* Skannauksen tulos. Oma bannerinsa eikä `virhe`: käyttäjä tuli sivulle
              puhelimen kameralla eikä tiedä mitä sovelluksessa tapahtui, joten myös
              onnistuminen on kerrottava. */}
          {skannaus && (
            <div
              className={`mb-6 flex items-start gap-3 rounded-lg px-4 py-3 border ${skannaus.tyyppi === 'ok' ? 'bg-success-soft border-success/30 text-success-ink' : 'bg-danger-soft border-danger/30 text-danger-ink'}`}
            >
              <QrCode size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm flex-1">{skannaus.viesti}</p>
              <button
                type="button"
                onClick={() => setSkannaus(null)}
                className="text-xs font-medium underline shrink-0"
              >
                Sulje
              </button>
            </div>
          )}

          {asetuksissa ? (
            <Asetukset
              raportit={raportit}
              isAdmin={!!isAdmin}
              onHavita={havitaVanhentuneet}
              onTakaisin={() => setAsetuksissa(false)}
            />
          ) : raporttiKohde ? (
            <Raportit
              kohde={raporttiKohde.kohde}
              tyyppi={raporttiKohde.tyyppi}
              vartija={session?.nickname || ''}
              onTallenna={tallennaRaportti}
              onTakaisin={() => setRaporttiKohde(null)}
            />
          ) : tietoKohde ? (
            <KohteenTiedot
              kohde={tietoKohde}
              tiedostot={tiedostot}
              suoritukset={suoritukset}
              raportit={raportit}
              kierrokset={kierrokset}
              onTakaisin={() => setTietoKohde(null)}
            />
          ) : kalustoKohde ? (
            <div className="max-w-3xl">
              <TakaisinLinkki onClick={() => setKalustoKohde(null)}>Takaisin kohdelistaan</TakaisinLinkki>
              <Kalusto
                ownerId={kalustoKohde.id}
                ownerNimi={kalustoKohde.name}
                avaimet={avaimet}
                poikkeamat={poikkeamat}
                saaMuokataAvaimia={saaMuokataAvaimia}
                saaKasitellaPoikkeamia={saaKasitellaPoikkeamia}
                onAvaimetMuuttui={paivitaAvaimet}
                onPoikkeamatMuuttui={paivitaPoikkeamat}
                aloitusValilehti="avaimet"
              />
            </div>
          ) : mittariKohde ? (
            <div className="max-w-5xl">
              <TakaisinLinkki onClick={() => setMittariKohde(null)}>Takaisin kohdelistaan</TakaisinLinkki>
              <Mittaristo ownerId={mittariKohde.id} ownerNimi={mittariKohde.name} onKohde />
            </div>
          ) : jaksoKohde ? (
            <div className="max-w-5xl">
              <TakaisinLinkki onClick={() => setJaksoKohde(null)}>Takaisin kohdelistaan</TakaisinLinkki>
              <Jalkiraportit
                ownerId={jaksoKohde.id}
                ownerNimi={jaksoKohde.name}
                onKohde
                raportit={jalkiraportit}
                saaMuokata={saaLaatiaJaksoraportteja}
                onMuuttui={paivitaJalkiraportit}
              />
            </div>
          ) : tiedoteKohde ? (
            <div className="max-w-3xl">
              <TakaisinLinkki onClick={() => setTiedoteKohde(null)}>Takaisin kohdelistaan</TakaisinLinkki>
              <Tiedotteet
                ownerId={tiedoteKohde.id}
                ownerNimi={tiedoteKohde.name}
                kayttaja={session?.username || ''}
                tiedotteet={tiedotteet}
                saaLahettaa={saaLahettaaTiedotteita}
                onMuutos={paivitaTiedote}
              />
            </div>
          ) : pohjaNakyma ? (
            <div className="max-w-3xl">
              <TakaisinLinkki onClick={() => setPohjaNakyma(null)}>Takaisin kohdelistaan</TakaisinLinkki>
              <p className="text-sm text-ink-muted mb-4">{pohjaNakyma.kohde.name}</p>
              <Pohjanakyma
                laji={pohjaNakyma.laji}
                ownerId={pohjaNakyma.kohde.id}
                ownerNimi={pohjaNakyma.kohde.name}
                pohjat={pohjat as unknown as Pohja[]}
                suoritukset={pohjaSuoritukset}
                saaMuokata={pohjaNakyma.laji === 'guide' ? saaMuokataOhjeita : saaMuokataSkenaarioita}
                onPohjatMuuttui={haePohjat}
                onSuoritusMuuttui={paivitaPohjaSuoritus}
              />
            </div>
          ) : halytysKohde ? (
            <Halytykset
              kohde={halytysKohde}
              halytykset={halytykset}
              kayttaja={session?.username || ''}
              saaKuitata={saaKuitataHalytyksia}
              mandown={mandown}
              onMandown={vaihdaMandown}
              onMuutos={paivitaHalytys}
              onTakaisin={() => setHalytysKohde(null)}
            />
          ) : kierrosKohde ? (
            <Kierros
              kohde={kierrosKohde}
              pohjat={pohjat}
              kierrokset={kierrokset}
              saaKiertaa={saaKiertaa}
              onPaivita={paivitaKierros}
              onTakaisin={() => setKierrosKohde(null)}
            />
          ) : pohjaKohde ? (
            <Kierrospohjat
              kohde={pohjaKohde}
              pohjat={pohjat}
              saaMuokata={saaMuokataPohjia}
              onTallennettu={haePohjat}
              onTakaisin={() => setPohjaKohde(null)}
            />
          ) : tehtavaKohde ? (
            <Tehtavat
              kohde={tehtavaKohde}
              suoritukset={suoritukset}
              vartija={session?.nickname || ''}
              saaKuitata={saaKuitata}
              onSuorita={suoritaTehtava}
              onTakaisin={() => setTehtavaKohde(null)}
            />
          ) : lomake ? (
            <KohteenHallinta
              kohde={lomake}
              onChange={setLomake}
              onTallenna={tallennaLomake}
              onPeruuta={() => setLomake(null)}
              tallentaa={tallentaa}
              tyontekijat={tyontekijat}
              tiedostot={tiedostot.filter((t) => t.siteId === lomake.id)}
              onLisaaTiedosto={lisaaTiedosto}
              onPoistaTiedosto={poistaTiedosto}
              onLataaKartta={lataaKartta}
              saaMuokata={saaMuokata}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-ink-strong mb-1">Kohteet</h2>
                  <p className="text-sm text-ink-muted">
                    Vartiointikohteet ja niiden perustiedot. Kierrokset, vuorot ja poikkeamat
                    kirjataan aina kohteelle.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {saaNahdaAsetukset && (
                    <button
                      type="button"
                      onClick={() => setAsetuksissa(true)}
                      className="inline-flex items-center gap-2 bg-surface hover:bg-sunken text-ink-body border border-line text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
                    >
                      <Settings size={16} />
                      Sovellusasetukset
                    </button>
                  )}
                  {saaMuokata && (
                    <button
                      type="button"
                      onClick={() => setLomake(tyhjaKohde())}
                      className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
                    >
                      <Plus size={16} />
                      Uusi kohde
                    </button>
                  )}
                </div>
              </div>

              {kohteet.length === 0 ? (
                <div className="bg-surface border border-line rounded-xl p-10 text-center">
                  <Building2 className="w-10 h-10 text-ink-subtle mx-auto mb-4" strokeWidth={1.5} />
                  <p className="text-sm text-ink-muted">
                    {ladattu ? 'Yhtään kohdetta ei ole vielä lisätty.' : 'Ladataan kohteita…'}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {kohteet.map((kohde) => (
                    <div
                      key={kohde.id}
                      className="bg-surface border border-line rounded-xl p-5 flex flex-col"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
                        <h3 className="font-bold text-ink-strong flex-1">{kohde.name}</h3>
                      </div>
                      <div className="space-y-1.5 text-sm text-ink-muted flex-1">
                        {kohde.address && (
                          <p className="flex items-start gap-2">
                            <MapPin size={14} className="shrink-0 mt-0.5" />
                            {kohde.address}
                          </p>
                        )}
                        {(kohde.contactName || kohde.contactPhone) && (
                          <p className="flex items-start gap-2">
                            <Phone size={14} className="shrink-0 mt-0.5" />
                            {[kohde.contactName, kohde.contactPhone].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {kohde.notes && (
                          <p className="text-xs text-ink-subtle pt-1 leading-relaxed">{kohde.notes}</p>
                        )}
                      </div>

                      {/* Kohteen sisältö lukuina: kertoo yhdellä silmäyksellä onko kohde
                          valmis vartioitavaksi vai vasta perustettu. */}
                      {((kohde.perehdytykset?.length || 0) > 0 || (kohde.tehtavat?.length || 0) > 0) && (
                        <div className="flex flex-wrap gap-3 pt-3 text-xs text-ink-muted">
                          {(kohde.perehdytykset?.length || 0) > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <GraduationCap size={13} />
                              {kohde.perehdytykset?.length} perehdytetty
                            </span>
                          )}
                          {(kohde.tehtavat?.length || 0) > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                              <ClipboardList size={13} />
                              {kohde.tehtavat?.length} tehtävää
                            </span>
                          )}
                        </div>
                      )}

                      {/* Vartijan päivittäiset toiminnot. Jokainen on oman oikeutensa
                          takana, joten kortti näyttää vain sen mitä käyttäjä voi tehdä. */}
                      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-4 mt-3 border-t border-line-soft">
                        {saaNahdaTehtavat && (kohde.tehtavat?.length || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => setTehtavaKohde(kohde)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <ClipboardList size={14} />
                            Tehtävät
                          </button>
                        )}
                        {saaNahdaKierrokset && (
                          <button
                            type="button"
                            onClick={() => setKierrosKohde(kohde)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <Route size={14} />
                            Kierros
                            {/* Kesken oleva kierros näkyy kortissa: unohtunut avoin kierros
                                on yleisin tapa saada vuoro näyttämään tekemättömältä. */}
                            {kierrokset.some((k) => k.siteId === kohde.id && k.tila === 'kesken') && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning-soft text-warning-ink border border-warning/30">
                                kesken
                              </span>
                            )}
                          </button>
                        )}
                        {saaNahdaKalustoa && (
                          <button
                            type="button"
                            onClick={() => setKalustoKohde(kohde)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <KeyRound size={14} />
                            Kalusto
                            {avaimet.some((a) => a.ownerId === kohde.id && a.tila === 'kadonnut') && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-soft text-danger-ink border border-danger/30">
                                avain kadonnut
                              </span>
                            )}
                            {poikkeamat.some((p) => p.ownerId === kohde.id && p.tila === 'avoin') && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning-soft text-warning-ink border border-warning/30">
                                poikkeama
                              </span>
                            )}
                          </button>
                        )}
                        {saaNahdaMittarit && (
                          <button
                            type="button"
                            onClick={() => setMittariKohde(kohde)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <BarChart3 size={14} />
                            Mittaristo
                          </button>
                        )}
                        {saaNahdaJaksoraportit && (
                          <button
                            type="button"
                            onClick={() => setJaksoKohde(kohde)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <ClipboardList size={14} />
                            Jaksoraportit
                            {jalkiraportit.some((r) => r.ownerId === kohde.id && r.tila === 'luonnos') && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning-soft text-warning-ink border border-warning/30">
                                luonnos
                              </span>
                            )}
                          </button>
                        )}
                        {saaNahdaTiedotteet && (
                          <button
                            type="button"
                            onClick={() => setTiedoteKohde(kohde)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <Megaphone size={14} />
                            Tiedotteet
                            {tiedotteet.some((t) => t.ownerId === kohde.id && onVoimassa(t) && !onKuitannut(t, session?.username || '')) && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning-soft text-warning-ink border border-warning/30">
                                kuittaamatta
                              </span>
                            )}
                          </button>
                        )}
                        {saaNahdaOhjeet && (
                          <button
                            type="button"
                            onClick={() => setPohjaNakyma({ kohde, laji: 'guide' })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <BookOpen size={14} />
                            Ohjeet
                          </button>
                        )}
                        {saaNahdaSkenaariot && (
                          <button
                            type="button"
                            onClick={() => setPohjaNakyma({ kohde, laji: 'play' })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <ListChecks size={14} />
                            Skenaariot
                            {pohjaSuoritukset.some((s) => s.ownerId === kohde.id && s.tila === 'kesken') && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning-soft text-warning-ink border border-warning/30">
                                kesken
                              </span>
                            )}
                          </button>
                        )}
                        {saaNahdaHalytykset && (
                          <button
                            type="button"
                            onClick={() => setHalytysKohde(kohde)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <Siren size={14} />
                            Hälytykset
                            {/* Lauennut hälytys näkyy kortissa: sitä ei saa joutua
                                etsimään näkymän sisältä. */}
                            {halytykset.some((h) => h.eventId === kohde.id && h.tila === 'lauennut') && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-danger-soft text-danger-ink border border-danger/30">
                                lauennut
                              </span>
                            )}
                            {halytykset.some((h) => h.eventId === kohde.id && h.tila === 'kaynnissa') && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning-soft text-warning-ink border border-warning/30">
                                ajastin
                              </span>
                            )}
                          </button>
                        )}
                        {saaKirjataToimenpiteen && (
                          <button
                            type="button"
                            onClick={() => setRaporttiKohde({ kohde, tyyppi: 'guard_action' })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <FileText size={14} />
                            Toimenpide
                          </button>
                        )}
                        {saaKirjataIlmoituksen && (
                          <button
                            type="button"
                            onClick={() => setRaporttiKohde({ kohde, tyyppi: 'guard_jvreport' })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                          >
                            <ShieldAlert size={14} />
                            Tapahtumailmoitus
                          </button>
                        )}
                        {saaNahdaTiedot && (
                          <button
                            type="button"
                            onClick={() => setTietoKohde(kohde)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-body hover:text-accent transition-colors ml-auto"
                          >
                            <Info size={14} />
                            Kohteen tiedot
                          </button>
                        )}
                      </div>

                      {(saaMuokata || saaNahdaPohjat) && (
                        <div className="flex gap-2 pt-3 border-t border-line-soft">
                          {saaNahdaPohjat && (
                            <button
                              type="button"
                              onClick={() => setPohjaKohde(kohde)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-body hover:text-accent transition-colors"
                            >
                              <QrCode size={14} />
                              Kierrospohjat
                            </button>
                          )}
                          {saaMuokata && (
                            <>
                              <button
                                type="button"
                                onClick={() => setLomake({
                                  ...kohde,
                                  perehdytykset: [...(kohde.perehdytykset || [])],
                                  tehtavat: (kohde.tehtavat || []).map((t) => ({ ...t, kohdat: [...t.kohdat] })),
                                })}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-body hover:text-accent transition-colors"
                              >
                                <Pencil size={14} />
                                Hallitse
                              </button>
                              <button
                                type="button"
                                onClick={() => setPoistettava(kohde)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-danger transition-colors ml-auto"
                              >
                                <Trash2 size={14} />
                                Poista
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {poistettava && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-xl shadow-xl border border-line max-w-sm w-full p-6">
            <h3 className="font-bold text-ink-strong mb-2">Poistetaanko kohde?</h3>
            <p className="text-sm text-ink-muted leading-relaxed mb-6">
              <strong className="text-ink">{poistettava.name}</strong> poistetaan pysyvästi.
              Kohteelle kirjattuja tietoja ei poisteta tämän mukana.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPoistettava(null)}
                className="px-4 py-2 text-sm font-medium text-ink-body bg-sunken hover:bg-line rounded-lg transition-colors"
              >
                Peruuta
              </button>
              <button
                type="button"
                disabled={tallentaa}
                onClick={poista}
                className="px-4 py-2 text-sm font-medium text-white bg-danger hover:brightness-95 rounded-lg transition-colors disabled:opacity-60"
              >
                {tallentaa ? 'Poistetaan…' : 'Poista kohde'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
