import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck, Plus, Building2, Settings, QrCode, CloudOff, ChevronRight, ShieldOff } from 'lucide-react';
import { useSession } from '../SessionContext';
import { canView, canEdit } from '../shared/oikeudet';
import { jaotteleSailytysajan } from '../shared/sailytysaika';
import { paikallinenPaiva } from '../shared/ajat';
import { Ylapalkki } from '../shared/komponentit/Ylapalkki';
import { KohteenHallinta } from './KohteenHallinta';
import { Tehtavat } from './Tehtavat';
import { Raportit } from './Raportit';
import { KohteenTiedot } from './KohteenTiedot';
import { Asetukset } from './Asetukset';
import { avaaJono, kaynnistaAutomatiikka, kuunteleLahetyksia, lisaaJonoon } from '../shared/jono';
import { lueVuorodata, tallennaVuorodata, unohdaVuorodata } from '../shared/vuorodata';
import { unohdaIstunto } from '../shared/istunto';
import { Kierrospohjat } from './Kierrospohjat';
import { Kierros } from './Kierros';
import { Halytykset } from './Halytykset';
import { Etusivu } from './Etusivu';
import { Sijaintihistoria } from './Sijaintihistoria';
import { Halytyskeskus } from './Halytyskeskus';
import { lueOsoite } from './halke/paneelit';
import { Kohdenakyma } from './Kohdenakyma';
import { kohteenToiminnot, type Toiminto } from './tilannekuva';
import { Halytysvahti } from '../shared/komponentit/Halytysvahti';
import { haeOmaTila, natiiviValvoo } from '../shared/laitteet';
import { TakaisinLinkki } from '../shared/komponentit/TakaisinLinkki';
import { haeHalytykset, TYYPPI_LABEL, type Halytys } from '../shared/halytykset';
import { LIIKKUMATON_MS } from '../shared/mandown';
import { tallennaLaitevalinta, TYOPOYTAPOLKU } from '../shared/laitevalinta';
import {
  MobiiliKehys, type MobiiliIlmoitus, type MobiiliLinkki, type MobiiliPikavalinta,
} from './mobiili/MobiiliKehys';
import { MobiiliEtusivu } from './mobiili/MobiiliEtusivu';
import { Vuorovalinta } from './mobiili/Vuorovalinta';
import { SiirtoValinta } from './mobiili/SiirtoValinta';
import { VuoronKooste as VuoronKoosteNakyma } from './mobiili/VuoronKooste';
import { PakotettuTehtava } from './mobiili/PakotettuTehtava';
import { SiirronRaportti } from './mobiili/SiirronRaportti';
import { Tehtavanjako } from './Tehtavanjako';
import { Skanneri } from './mobiili/Skanneri';
import { Tilatieto } from './mobiili/Tilatieto';
import { HalytystehtavaNakyma } from './mobiili/HalytysTehtava';
import {
  LAJIN_NIMI as TEHTAVAN_LAJI,
  haeKaikkiTehtavat, haeMasterkoodi, haeOmatTehtavat,
  kieltaydy as kieltaydyTehtavasta, lahetaRaportti as sidoRaporttiTehtavaan,
  merkitseVaihe as merkitseTehtavanVaihe, vastaanota as vastaanotaTehtava,
  type Halytystehtava,
} from './halytystehtavat';
import { lueVuoro, tallennaVuoro, unohdaVuoro, type Vuoro } from './mobiili/vuoro';
import { lueAaniasetus, tallennaAaniasetus } from './mobiili/aaniasetus';
import { uudetTehtavat } from './mobiili/halytetyt';
import {
  aloitaHalytys, ilmoita, lopetaHalytys, pyydaIlmoituslupa, varmistaAani,
} from '../shared/aani';
import {
  aloitaVuoroPalvelimella, haeOmaVuoro, haeOmatVuorot, haeVuoronKooste, lisaaVuoroon,
  paataVuoroPalvelimella, myohassaMinuutteina, UNOHTUNUT_VARTIJA_MIN,
  type PalvelimenVuoro, type VuoronKooste, type Vuorokohde, type VuoroVaihtoehto,
} from './vuorot';
import {
  TYHJAT_SIIRROT, haeOmatSiirrot, haeVastaanottajat, kuittaaPakotus,
  merkitseSiirtoValmiiksi, siirraTehtava, vastaaSiirtoon,
  type OmatSiirrot, type Siirto, type Vastaanottaja,
} from './siirrot';
import { kaynnistaSovelluksessa, onAlustaJollaSovellus, paataSovelluksessa } from './mobiili/sovellusvuoro';
import { useKanava, type Sijainti } from '../shared/kanava';
import { useSijainninLahetys } from '../shared/sijainninLahetys';
import { luoMuunnos } from '../shared/georeferointi';
import { Pohjanakyma } from '../shared/komponentit/Pohjanakyma';
import { haeSuoritukset, type Pohja, type Suoritus } from '../shared/pohjat';
import { Tiedotteet, TiedoteKehote } from '../shared/komponentit/Tiedotteet';
import { haeTiedotteet, type Tiedote } from '../shared/tiedotteet';
import { Kalusto } from '../shared/komponentit/Kalusto';
import { haeAvaimet, haePoikkeamat, type Avain, type Poikkeama } from '../shared/kalusto';
import { Kalustopankki } from './kalusto/Kalustopankki';
import { Tyontekijapankki } from './Tyontekijapankki';
import type { Tyontekija } from '../shared/tyontekijat';
import { KalustoKortti } from './kalusto/KalustoKortti';
import { KohteenKalusto } from './kalusto/KohteenKalusto';
import { haeKalusto } from './kalusto/pankki';
import type { KalustoTietue, SijoitusLaji } from './kalusto/tyypit';
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

// GUARDin juurinäkymä on etusivu, jolta valitaan osio: Kohteet (vartijan työ) tai
// Hälytyskeskus (päivystäjän valvomonäkymä). Kohdelista EI ole enää juuri, koska nämä
// kaksi ovat eri työtä eri ihmiselle — kohdelista päivystäjän etusivuna tarkoittaisi
// että hälytystilanne pitää etsiä kohde kerrallaan.
//
// Juurinäkymässä takaisin-nappi poistuu sovelluksesta (ks. shared/navigointi.ts).
const JUURINAKYMA = 'etusivu';

// Etusivun osiot. Erillinen tila eikä johdettu jostain muusta: käyttäjä voi olla
// Kohteet-osiossa ilman että yhtäkään kohdetta on avattu.
// 'kalusto' on Kohteiden ja Hälytyskeskuksen rinnalla eikä kohteen sisällä, koska pankki
// on kohteiden YLI menevä rekisteri: sen kysymys on "mitä yrityksellä on ja missä", ja
// kohteen sisältä katsottuna vastaus olisi aina yhden kohteen mittainen.
type Osio = 'etusivu' | 'kohteet' | 'halytyskeskus' | 'tehtavanjako' | 'kalusto'
  | 'tyontekijat' | 'sijaintihistoria';

// Historiamerkinnän näkymätunniste -> kohteen toiminto. Mobiiliversion takaisin-nappi
// tarvitsee tämän: siellä ei ole kohdevalikkoa johon palata, joten näkymä avataan
// suoraan vuoron kohteelle. 'pohjat' ja 'raportit' puuttuvat tarkoituksella — molemmat
// tunnisteet kattavat kaksi eri näkymää (ohjeet/skenaariot, toimenpide/ilmoitus), eikä
// niistä voi päätellä kumpi oli auki. Niistä palataan etusivulle.
const MOBIILIN_NAKYMAT: Record<string, Toiminto> = {
  kierrokset: 'kierros',
  tehtavat: 'tehtavat',
  halytykset: 'halytykset',
  tiedotteet: 'tiedotteet',
  kalusto: 'kalusto',
  'kohteen-tiedot': 'tiedot',
  mittaristo: 'mittaristo',
  jaksoraportit: 'jaksoraportit',
};

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

// mobiili = puhelimelle tehty kenttäversio (/guard/mobile). Sama data, samat oikeudet ja
// samat näkymät kuin työpöytäversiossa; ero on kuoressa ja etusivussa (ks. mobiili/).
// Yksi komponentti eikä kaksi, koska kaikki hakeminen, tallennus ja oikeuslogiikka ovat
// yhteisiä — kaksi juurta tarkoittaisi kahta kopiota niistä.
// Irrotetun ikkunan paneeli ja seinätaulutila luetaan osoitteesta kerran moduulin
// latautuessa (erä 24). Ei komponentin tilaa: ikkuna on koko elinkaarensa yhtä
// paneelia varten, ja osoitteen muuttaminen kesken käytön tarkoittaisi että sama
// ikkuna vaihtaa merkitystään päivystäjän huomaamatta.
const HALKE_OSOITE = typeof window === 'undefined'
  ? { paneeli: null, taulu: false, vartija: null }
  : lueOsoite(window.location.pathname, window.location.search);

export default function GuardApp({ mobiili = false }: { mobiili?: boolean }) {
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
  // Hälytyskeskus on OMA solmunsa eikä guard_alarms. Ero on olennainen: hälytysten
  // näkeminen on jokaisen kentällä olevan oikeus (ilman sitä ei voi hälyttää), kun taas
  // hälytyskeskus näyttää kaikkien kohteiden tilanteen yhtä aikaa. Jos ne olisivat sama
  // oikeus, jokainen vartija näkisi koko yrityksen valvomonäkymän.
  const saaNahdaHalytyskeskus = isAdmin || canView(perms, null, 'guard_dispatch');
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
  // Kalustopankki (erä 20). LUKU = näet pankin ja voit PYYTÄÄ kalustoa kohteelle,
  // MUOKKAUS = jyvität ja RATKAISET pyynnöt. Sama jako kuin varustepoikkeamalla, ja sama
  // tarkistus on palvelimella (server/index.js: saaNahdaPankin / saaHallitaPankkia) —
  // tämä vain piilottaa napit joita ei saisi painaa.
  const saaNahdaPankin = isAdmin || canView(perms, null, 'guard_assets');
  const saaHallitaPankkia = isAdmin || canEdit(perms, null, 'guard_assets');
  // Vartijan kalustonäkyvyys (erä 20b). Eri solmu ja eri näkymä: ei pankkia vaan sen
  // kohteen kalusto jossa vartija on vuorossa. RAJAUS ON PALVELIMELLA (index.js +
  // kalusto.js) — tämä lippu päättää vain mitä käyttöliittymässä näytetään, eikä sen
  // varaan saa laskea mitään. Selain saa jo valmiiksi rajatun listan.
  const saaNahdaVuoronKaluston = saaNahdaPankin || canView(perms, null, 'guard_site_assets');
  // Työntekijäpankki. SAMA SOLMU KUIN EVENTISSÄ eikä guard_-omaa: rekisteri on yrityksen
  // eikä tuotteen, ja solmu on jo globaali ilman tuoteporttia (server/permissions.js).
  // Tunnus jolla on oikeus näkee saman pankin kummalta puolelta tahansa.
  const saaNahdaTyontekijat = isAdmin || canView(perms, null, 'global_employee_bank');
  const saaMuokataTyontekijoita = isAdmin || canEdit(perms, null, 'global_employee_bank');
  // Varustepoikkeama on vikailmoitus eikä omaisuuskirjanpito, joten sillä on yhä oma
  // solmunsa. ILMOITTAMINEN riittää lukuoikeudella — sen huomaa se joka käyttää
  // varustetta; sulkeminen on väite siitä että asia on kunnossa.
  const saaKasitellaPoikkeamia = isAdmin || canEdit(perms, null, 'guard_equipment');
  // Kohteen Kalusto-näkymä näyttää molemmat: kohteelle jyvitetyn kaluston ja
  // varustepoikkeamat. Kumpi tahansa oikeus riittää valikkopainikkeen näkymiseen, koska
  // näkymän sisällä välilehdet ovat omien oikeuksiensa takana.
  const saaNahdaKalustoa = saaNahdaVuoronKaluston || canView(perms, null, 'guard_equipment');
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
  // Vartijoiden sijainnit (erä 23). Oma solmunsa: tilannekuvan näkeminen ja henkilöstön
  // sijainnin näkeminen ovat eri asioita, ja jälkimmäinen on teknistä valvontaa.
  const saaNahdaSijainnit = isAdmin || canView(perms, null, 'guard_locations');
  // Sijaintihistoria (erä 24). ERI SOLMU kuin yllä, eikä se ole hienojakoisuutta
  // hienojakoisuuden vuoksi: nykyisen sijainnin näkeminen vanhenee 30 minuutissa ja
  // tarvitaan tehtävän kohdentamiseen, jälki kattaa 45 vuorokautta eikä sitä tarvita
  // yhdenkään tehtävän hoitamiseen. Katselupiiri on siksi pienempi.
  const saaNahdaSijaintihistorian = isAdmin || canView(perms, null, 'guard_location_history');
  const saaNahdaRaportit = isAdmin
    || canView(perms, null, 'guard_site_info')
    || canView(perms, null, 'guard_report_action')
    || canView(perms, null, 'guard_report_jv');

  // Avoinna oleva osio. Etusivulta mennään joko kohteisiin tai hälytyskeskukseen; kaikki
  // muut näkymät avautuvat näiden sisältä.
  // Irrotettu hälytyskeskusikkuna avautuu suoraan omaan paneeliinsa (erä 24): sen
  // etusivu olisi ylimääräinen klikkaus joka kerta kun valvomon kone käynnistetään.
  const [osio, setOsio] = useState<Osio>(HALKE_OSOITE.paneeli ? 'halytyskeskus' : 'etusivu');
  // Kohde jonka valikko on auki. Kohdelistan ja yksittäisten näkymien VÄLISSÄ oleva taso:
  // täältä valitaan mitä kohteessa tehdään, ja tänne palataan kun näkymä suljetaan.
  // Erillinen kaikista `*Kohde`-tiloista, koska ne kertovat MIKÄ näkymä on auki — tämä
  // kertoo minkä kohteen valikossa ollaan silloinkin kun yhtään näkymää ei ole auki.
  const [valittuKohde, setValittuKohde] = useState<Kohde | null>(null);

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
  const [tyontekijat, setTyontekijat] = useState<Tyontekija[]>([]);
  // Erillinen lippu: tyhjä rekisteri ja epäonnistunut haku eivät saa näyttää samalta,
  // koska pankkinäkymä tallentaa koko kokoelman kerralla.
  const [tyontekijatLadattu, setTyontekijatLadattu] = useState(false);
  const [tiedostot, setTiedostot] = useState<KohteenTiedosto[]>([]);
  const [tiedostotLadattu, setTiedostotLadattu] = useState(false);
  const [suoritukset, setSuoritukset] = useState<TehtavaSuoritus[]>([]);
  // Kohde jonka tehtäviä ollaan kuittaamassa. Erillinen lomake-tilasta: sama kohde voi
  // olla auki joko hallintaa tai kuittausta varten, eikä niitä pidä sekoittaa.
  const [tehtavaKohde, setTehtavaKohde] = useState<Kohde | null>(null);
  const [raportit, setRaportit] = useState<GuardRaportti[]>([]);
  // `tehtavaId` on mukana kun raportti kirjoitetaan hälytystehtävälle (erä 22): silloin
  // tallennuksen jälkeen pyydetään lupa poistua. Ilman sitä raportti on tavallinen
  // kirjaus eikä poistumispyyntö, ja ero on vartijalle olennainen.
  const [raporttiKohde, setRaporttiKohde] = useState<
    { kohde: Kohde; tyyppi: RaporttiTyyppi; tehtavaId?: string } | null
  >(null);
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
  // Hälytystehtävät (erä 22). ERI ASIA KUIN `halytykset` yllä: ne ovat vartijan omia
  // turvahälytyksiä, nämä ovat hälytyskeskuksen antamia keikkoja. Oma kokoelmansa, oma
  // reittinsä ja oma näkymänsä — ks. halytystehtavat.ts.
  const [tehtavat, setTehtavat] = useState<Halytystehtava[]>([]);
  // Millä nimellä vastaanotto kirjautuu hälytyskeskuksen ruudulle. Vuoron nimi jos vuoro
  // on, muuten nimimerkki. Näytetään etukäteen: on hyvä tietää ennen kuin painaa.
  const [yksikonNimi, setYksikonNimi] = useState('');
  const [avattuTehtava, setAvattuTehtava] = useState<string | null>(null);
  const [tehtavaTyoskentelee, setTehtavaTyoskentelee] = useState(false);
  const [tehtavaVirhe, setTehtavaVirhe] = useState<string | null>(null);
  // Poistumispyyntö joka odottaa raportin lähtemistä jonosta. Kirjaus menee jonon kautta
  // (erä 6), pyyntö ei — joten verkottomassa tilassa raportti on tehty mutta lupaa ei voi
  // vielä pyytää. Pyyntö lähtee itsestään heti kun raportti on perillä.
  const [odottavaSidonta, setOdottavaSidonta] = useState<
    { tehtavaId: string; raporttiId: string } | null
  >(null);
  // Hälytyskeskuksen oma lista: KAIKKI tehtävät kaikista kohteista, ei vain omat.
  // Erillinen `tehtavat`-tilasta, koska ne ovat eri kysymys: vartijan lista on "mitä
  // minun pitää tehdä", päivystäjän "mitä on menossa". Sama lista molemmille tarkoittaisi
  // että päivystäjä näkee vain ne keikat joihin hänet on kohdennettu.
  const [keskuksenTehtavat, setKeskuksenTehtavat] = useState<Halytystehtava[]>([]);
  const [saaMuokataTehtavia, setSaaMuokataTehtavia] = useState(false);
  // Viimeksi tiedetyt sijainnit hälytyskeskusta varten. Muistissa vain: palvelin ei
  // tallenna sijaintihistoriaa levylle (server/sijainti.js), eikä selain saa tehdä
  // siitä pysyvää omin päin.
  const [sijainnit, setSijainnit] = useState<Sijainti[]>([]);
  // Onko hälytysääni käytössä tällä laitteella (erä 23).
  //
  // Laitteen tila eikä palvelimen: selaimen äänilupa on laitekohtainen, eikä sama tunnus
  // toisella puhelimella peri toisen puhelimen lupaa. `armed` kertoo onko lupa oikeasti
  // saatu — pelkkä käyttäjän valinta ei riitä, koska selain voi hylätä sen hiljaa.
  const [aaniValittu, setAaniValittu] = useState(() => lueAaniasetus());
  const [aaniArmed, setAaniArmed] = useState(false);
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
  // Kalustopankki (erä 20). Yksi lista jota sekä pankkinäkymä että kohteen
  // kalustorekisteri lukevat — kohteen kalusto on pankin rivejä joiden sijoitus osoittaa
  // kohteeseen, ei oma kokoelmansa.
  const [pankki, setPankki] = useState<KalustoTietue[]>([]);
  const [pankkiLadattu, setPankkiLadattu] = useState(false);
  // Kohteen kalustorekisteristä avattu esine. Erillinen pankin omasta valinnasta, koska
  // kohdenäkymä on eri paikassa näkymäpuussa eikä sen kortti saa jäädä auki kun
  // kohteesta poistutaan.
  const [kohteenEsine, setKohteenEsine] = useState<KalustoTietue | null>(null);
  const [mittariKohde, setMittariKohde] = useState<Kohde | null>(null);
  const [jaksoKohde, setJaksoKohde] = useState<Kohde | null>(null);
  const [jalkiraportit, setJalkiraportit] = useState<Jalkiraportti[]>([]);
  // Onko selain saanut luvan liikeantureihin.
  //
  // EI sama asia kuin man-downin päälläolo, vaikka vanha käyttöliittymä sekoitti ne
  // yhdeksi kytkimeksi. Päälläolo on kohteen asetus palvelimella; tämä on selaimen
  // tekninen ehto, joka on iOS:ssä kysyttävä käyttäjän eleestä eikä sitä voi myöntää
  // palvelimelta. Tila on tarkoituksella vain tämän sivunlatauksen mittainen: lupa
  // kysytään eleestä, ja muistiin tallennettu "kyllä" ei todistaisi että selain yhä
  // antaa sen.
  const [liikelupa, setLiikelupa] = useState(false);

  // Valvooko puhelinsovellus juuri nyt. Jos valvoo, selain VÄISTYY man-downista.
  //
  // Sovellus tekee saman työn paremmin: se toimii taskussa ruudun ollessa sammuksissa,
  // kun taas selaimen liiketunnistus vaatii sivun olevan auki ja näkyvissä. Molempien
  // yhtaikainen valvonta ei olisi vaarallista — palvelin palauttaa saman hälytyksen
  // eikä luo toista — mutta se kysyisi vartijalta saman kysymyksen kahdesti kahdesta
  // eri paikasta, ja kahdesti kysytty "oletko kunnossa" opettaa ohittamaan sen.
  const [natiivi, setNatiivi] = useState(false);

  // Selaimissa joissa erillistä lupaa ei ole, se katsotaan saaduksi heti.
  //
  // Vain iOS vaatii DeviceMotionEvent.requestPermissionin, ja vain se on kysyttävä
  // käyttäjän eleestä. Muualla napin näyttäminen pyytäisi vartijaa tekemään turhan
  // klikkauksen — ja turha klikkaus opettaa ohittamaan ne kaikki, myös sen joka
  // jonain päivänä merkitsee jotain.
  useEffect(() => {
    const rajapinta = (window as unknown as {
      DeviceMotionEvent?: { requestPermission?: () => Promise<string> };
    }).DeviceMotionEvent;
    if (rajapinta && typeof rajapinta.requestPermission !== 'function') {
      setLiikelupa(true);
    }
  }, []);
  // Vuoro (vain mobiiliversio): kohde jossa vartija on nyt töissä. Laitteen tilaa, ei
  // palvelimen tietue — ks. mobiili/vuoro.ts.
  const [vuoro, setVuoro] = useState<Vuoro | null>(null);
  // Palvelimen vuorotietue: tehtävät ja kierrokset lähteineen. Erillään `vuoro`sta, joka
  // on laitteen kevyt kopio siitä missä ollaan töissä — sitä lukee moni näkymä, eikä sen
  // muotoa muuteta tässä erässä.
  const [palvelimenVuoro, setPalvelimenVuoro] = useState<PalvelimenVuoro | null>(null);
  const [vuorovaihtoehdot, setVuorovaihtoehdot] = useState<Vuorokohde[]>([]);
  const [vuorotLadattu, setVuorotLadattu] = useState(false);
  const [ilmanPerehdytysta, setIlmanPerehdytysta] = useState(0);
  const [vuoroVirhe, setVuoroVirhe] = useState<string | null>(null);
  const [vuoroaAloitetaan, setVuoroaAloitetaan] = useState(false);
  const [vuoroonLisataan, setVuoroonLisataan] = useState(false);
  const [lisaysVirhe, setLisaysVirhe] = useState<string | null>(null);
  // Siirrot (erä 18). Omana tilanaan eikä osana vuoroa: siirretty kierros voi olla eri
  // kohteessa kuin vartijan oma vuoro, ja juuri se on ominaisuuden tarkoitus.
  const [siirrot, setSiirrot] = useState<OmatSiirrot>(TYHJAT_SIIRROT);
  const [siirtoVastataan, setSiirtoVastataan] = useState(false);
  const [siirrettava, setSiirrettava] = useState<{ laji: 'tehtava' | 'kierros'; id: string; nimi: string } | null>(null);
  const [vastaanottajat, setVastaanottajat] = useState<Vastaanottaja[]>([]);
  const [vastaanottajatLadattu, setVastaanottajatLadattu] = useState(false);
  const [siirtoLahetetaan, setSiirtoLahetetaan] = useState(false);
  const [siirtoVirhe, setSiirtoVirhe] = useState<string | null>(null);
  const [pakotustaKuitataan, setPakotustaKuitataan] = useState(false);
  // Vuoron kooste näytetään päättämisen jälkeen. Oma tilansa eikä osa vuoroa: vuoro on
  // jo päättynyt siinä vaiheessa kun kooste on ruudulla.
  const [kooste, setKooste] = useState<VuoronKooste | null>(null);
  const [koosteAuki, setKoosteAuki] = useState(false);
  const [koostettaHaetaan, setKoostettaHaetaan] = useState(false);
  const [kameraAuki, setKameraAuki] = useState(false);
  const [tilatietoAuki, setTilatietoAuki] = useState(false);
  // Skannauksen tulos: puhelimen kamera avasi /guard?piste=<token>, ja palvelin kertoo
  // mitä siitä seurasi. Näytetään bannerina, koska käyttäjä tuli sivulle kameran kautta
  // eikä hän tiedä mitä sovelluksessa tapahtui.
  const [skannaus, setSkannaus] = useState<{ tyyppi: 'ok' | 'virhe'; viesti: string } | null>(null);
  // Vuoro alkoi, mutta natiivipalvelua ei tavoitettu. Tämä on oma tilansa eikä `virhe`:
  // vuoro ITSE onnistui, ja käyttöliittymä toimii normaalisti — vain taustavalvonta
  // puuttuu. Ero on se mikä 10.9.2026 jäi kertomatta ja maksoi koko päivätestin.
  const [valvontaVaroitus, setValvontaVaroitus] = useState(false);
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

  // Kohdelista haetaan myös pelkälle päivystäjälle. Hälytyskeskus näyttää kohteiden nimet,
  // osoitteet ja hälytysnumerot — ilman niitä lauennut hälytys kertoisi vain tunnisteen
  // eikä sitä minne pitää soittaa. Palvelin sallii tämän saman solmun nojalla
  // (server/permissions.js: guardSites.view sisältää guard_dispatchin).
  const saaHakeaKohteet = saaNahda || saaNahdaHalytyskeskus;

  useEffect(() => {
    if (!saaHakeaKohteet) return;
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
  }, [saaHakeaKohteet, session?.username]);

  useEffect(() => {
    if (!saaNahda) return;
    // 403 on tässä normaali lopputulos eikä virhe: kaikilla GUARD-käyttäjillä ei ole
    // oikeutta koko yrityksen työntekijärekisteriin. Silloin perehdytyslistaan
    // kirjoitetaan nimi käsin.
    fetch('/api/data/employees', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true && Array.isArray(res.data)) {
          setTyontekijat(res.data);
          setTyontekijatLadattu(true);
        }
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

  // Nämä kaksi olivat KERTAHAKUJA vaikutuslistallaan, ja se oli vika (19.9.2026).
  //
  // Palvelin työntää molemmista muutosviestin kanavaan (server/index.js: /api/kirjaa),
  // mutta selain ei kuunnellut niitä eikä kysellyt uudelleen — joten kentältä tullut
  // toimenpidekirjaus, tapahtumailmoitus tai tilatieto EI ILMESTYNYT päivystäjän ruudulle
  // koskaan ilman sivun uudelleenlatausta. Vika oli näkymätön niin kauan kuin näitä
  // katsottiin tapahtumavirrasta muun seassa; oma tilatietopaneeli teki siitä ilmeisen.
  const haeTehtavasuoritukset = useCallback(() => {
    if (!saaNahdaTehtavat) return;
    fetch('/api/data/guardTaskRuns', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true && Array.isArray(res.data)) setSuoritukset(res.data);
      })
      .catch(() => { /* virhe näkyy tyhjänä suorituslistana */ });
  }, [saaNahdaTehtavat]);

  useEffect(() => { haeTehtavasuoritukset(); }, [haeTehtavasuoritukset]);

  const haeRaportit = useCallback(() => {
    if (!saaNahdaRaportit) return;
    fetch('/api/data/guardReports', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res && res.ok === true && Array.isArray(res.data)) setRaportit(res.data);
      })
      .catch(() => { /* virhe näkyy tyhjänä raporttilistana */ });
  }, [saaNahdaRaportit]);

  useEffect(() => { haeRaportit(); }, [haeRaportit]);

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

  // Kalustopankki. Palvelimen ylläpitämä kokoelma, joten tänne tulee vain luettua tilaa —
  // jokainen muutos tehdään /api/kalusto-reiteillä ja haetaan sen jälkeen uudelleen.
  // `pankkiLadattu` erottaa tyhjän pankin epäonnistuneesta hausta: ilman sitä "ei
  // kalustoa" näkyisi myös silloin kun haku kaatui.
  const paivitaPankki = useCallback(() => {
    if (!saaNahdaVuoronKaluston) return;
    haeKalusto().then((lista) => {
      if (!lista) return;
      setPankki(lista);
      setPankkiLadattu(true);
    });
  }, [saaNahdaVuoronKaluston]);

  useEffect(() => { paivitaPankki(); }, [paivitaPankki]);

  // Työntekijäpankin tallennus. Koko kokoelma kerralla, kuten kohdelistallakin — palvelin
  // vertaa uutta vanhaan ja hylkää romahduksen (server/index.js). Näkymä ei kutsu tätä
  // ennen onnistunutta hakua, koska `tyontekijatLadattu` on sen renderöinnin ehtona.
  const tallennaTyontekijat = async (lista: Tyontekija[]) => {
    setVirhe(null);
    try {
      // Viimeisen tietueen poisto tarvitsee ?allowEmpty=1, muuten romahdussuoja hylkää
      // sen virheellä joka ei kerro käyttäjälle mitään.
      const r = await fetch(`/api/data/employees${lista.length === 0 ? '?allowEmpty=1' : ''}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(lista),
      });
      const res = await r.json().catch(() => null);
      if (r.ok && res && res.ok === true) {
        setTyontekijat(lista);
        return true;
      }
      setVirhe(res?.error || 'Työntekijöiden tallennus epäonnistui.');
      return false;
    } catch {
      setVirhe('Ei yhteyttä palvelimeen. Muutosta ei tallennettu.');
      return false;
    }
  };

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

  // Milloin palvelin viimeksi vastasi hälytyshakuun. Hälytyskeskus näyttää tämän iän
  // tilamerkissä: soketin tila kertoo vain onko putki auki, ikä kertoo tuleeko siitä
  // mitään. EI aseteta epäonnistuneesta hausta — silloin nimenomaan ei saatu tietoa, ja
  // iän nollaaminen väittäisi päinvastaista.
  const [halytyksetPaivitetty, setHalytyksetPaivitetty] = useState<number | null>(null);

  // Hälytykset luetaan samalta kokoelmareitiltä kuin muutkin, mutta niitä EI koskaan
  // kirjoiteta takaisin: kokoelma on palvelimen ylläpitämä.
  const paivitaHalytykset = useCallback(() => {
    if (!saaNahdaHalytykset) return;
    haeHalytykset().then((lista) => {
      if (!lista) return;
      setHalytykset(lista);
      setHalytyksetPaivitetty(Date.now());
    });
  }, [saaNahdaHalytykset]);

  useEffect(() => { paivitaHalytykset(); }, [paivitaHalytykset]);

  // Hälytyskeskuksen varakysely (ks. Halytyskeskus: VARMISTUS_MS).
  //
  // Kanava tuo muutokset itsestään; tämä on sitä varten että katkennut kanava ei jätä
  // päivystäjää katsomaan pysähtynyttä kuvaa. Aiemmin varakysely haki VAIN hälytykset,
  // jolloin kanavan katketessa hälytykset päivittyivät ja kaikki muu jäätyi — ja ruutu
  // näytti toimivalta, koska sen näkyvin osa liikkui.
  //
  // Kolme kokoelmaa eikä kaikkia: nämä ovat ne joista tapahtumavirta ja tilatietolista
  // koostuvat ja jotka muuttuvat kesken vuoron. Jokainen kysely lataa koko kokoelman,
  // joten lista on pidettävä lyhyenä — ja jokainen irrotettu paneeli-ikkuna kysyy omansa.
  const paivitaTilannekuva = useCallback(() => {
    paivitaHalytykset();
    haeRaportit();
    haeTehtavasuoritukset();
  }, [paivitaHalytykset, haeRaportit, haeTehtavasuoritukset]);

  // Hälytystehtävät. Oma reittinsä eikä kokoelmahaku, koska kohdennus (vuoro, piirivuoro,
  // etäisyys) lasketaan palvelimella pyyntökohtaisesti — kokoelmahaku rajaisi vartijan
  // kohdeoikeuksien mukaan ja sulkisi ulos juuri sen jolle hälytys on tarkoitettu.
  //
  // EI OIKEUSEHTOA. Hälytystehtävä tulee kaikille joille se on kohdennettu, eikä
  // sivukartan solmu ratkaise sitä — palvelin päättää kenelle lista on tyhjä.
  const paivitaTehtavat = useCallback(() => {
    haeOmatTehtavat().then((tulos) => {
      if (!tulos) return;
      setTehtavat(tulos.tehtavat);
      setYksikonNimi(tulos.yksikko);
    });
  }, []);

  useEffect(() => { paivitaTehtavat(); }, [paivitaTehtavat]);

  // Uusi hälytystehtävä soittaa äänen ja värisyttää (erä 23, korjattu erässä 25).
  //
  // YKSI HÄLYTYS YHTÄ KEIKKAA KOHDEN, ja se ratkaistaan LAITTEEN MUISTISTA eikä
  // edellisestä hausta (mobiili/halytetyt.ts). Erässä 23 vertailukohtana oli edellinen
  // lista, ja se tuotti kaksi toistoa joita kentällä ei voinut erottaa toisistaan:
  //
  //   1. Käynnistys. `tehtavat` on aluksi tyhjä ja täyttyy vasta kun haku vastaa, joten
  //      jokainen avoin keikka oli "uusi" joka ainoalla avauksella. Kuittaus, puhelin
  //      taskuun, ruutu lukkoon — ja seuraava avaus hälytti samasta keikasta uudelleen.
  //   2. Kohdennuksen heilahtelu. Sädekohdennus lukee vartijan viimeksi tiedettyä
  //      sijaintia, joka vanhenee puolessa tunnissa; vanhentuessaan keikka katosi
  //      listalta ja palatessaan näytti uudelta.
  //
  // EI HÄLYTETÄ KEIKASTA JOHON VARTIJA ON JO VASTANNUT, vaikka laitteen muisti olisi
  // tyhjä (uusi puhelin, tyhjennetty selain). Vastaanotettu tai kieltäydytty keikka on
  // nähty, ja nähdystä keikasta hälyttäminen opettaa olemaan luottamatta ääneen.
  useEffect(() => {
    if (tehtavat.length === 0) {
      // Lista tyhjeni: keikka on hoidettu tai peruttu, eikä ääni saa jäädä soimaan
      // tyhjän listan päälle.
      lopetaHalytys();
      return;
    }

    // uudetTehtavat MERKITSEE palauttamansa samalla kertaa, joten kaksi peräkkäistä
    // hakua ei ehdi lukea samaa tunnistetta uutena.
    const uudet = new Set(uudetTehtavat(tehtavat.map((t) => t.id)));
    const halytettavat = tehtavat.filter(
      (t) => uudet.has(t.id)
        && !(t.yksikot || []).some((y) => y.vartija === session?.username)
    );
    if (halytettavat.length === 0) return;

    if (aaniValittu && aaniArmed) aloitaHalytys();
    for (const t of halytettavat) {
      ilmoita(`${TEHTAVAN_LAJI[t.laji].toUpperCase()} · ${t.siteNimi}`,
        t.silmukka ? `Silmukka: ${t.silmukka}` : 'Avaa sovellus ja ota tehtävä vastaan.', t.id);
    }
  }, [tehtavat, aaniValittu, aaniArmed, session?.username]);

  // Ääni vaikenee kun sovellus suljetaan. Ilman tätä ajastin jäisi pyörimään
  // komponentin purkamisen jälkeen.
  useEffect(() => lopetaHalytys, []);

  // Hälytyskeskuksen lista. Oma hakunsa ja oma oikeusehtonsa: se palauttaa kaikki
  // tehtävät kaikista kohteista, mikä on päivystäjän oikeus eikä vartijan.
  const paivitaKeskuksenTehtavat = useCallback(() => {
    if (!saaNahdaHalytyskeskus) return;
    haeKaikkiTehtavat().then((tulos) => {
      if (!tulos) return;
      setKeskuksenTehtavat(tulos.tehtavat);
      setSaaMuokataTehtavia(tulos.saaMuokata);
    });
  }, [saaNahdaHalytyskeskus]);

  useEffect(() => { paivitaKeskuksenTehtavat(); }, [paivitaKeskuksenTehtavat]);

  // Sijaintien listahaku. Kanava työntää yksittäiset päivitykset, mutta listaa
  // tarvitaan silti: kanavalta ei tule niitä sijainteja jotka on lähetetty ennen kuin
  // tämä näkymä avattiin, eli käytännössä kaikkia.
  //
  // Ajastin on harva (60 s), koska kanava hoitaa tuoreuden. Tämä on varmistus sen
  // varalta että kanava on poikki — ja silloin ikäleima kertoo totuuden itsestään.
  const paivitaSijainnit = useCallback(() => {
    if (!saaNahdaSijainnit) return;
    fetch('/api/sijainnit', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.ok) setSijainnit(data.sijainnit || []); })
      .catch(() => { /* Verkkovirhe: lista jää ennalleen, ikäleima vanhenee näkyvästi. */ });
  }, [saaNahdaSijainnit]);

  useEffect(() => {
    if (!saaNahdaSijainnit) return undefined;
    paivitaSijainnit();
    const ajastin = window.setInterval(paivitaSijainnit, 60_000);
    return () => window.clearInterval(ajastin);
  }, [saaNahdaSijainnit, paivitaSijainnit]);

  // Odottava poistumispyyntö lähtee heti kun sen raportti on mennyt jonosta perille.
  // Ilman tätä vartija jäisi kohteeseen odottamaan lupaa jota kukaan ei ole pyytänyt.
  useEffect(() => {
    if (!odottavaSidonta) return undefined;
    return kuunteleLahetyksia((ilmoitus) => {
      if (ilmoitus.polku !== '/api/kirjaa/guardReports') return;
      if ((ilmoitus.runko as { id?: string } | null)?.id !== odottavaSidonta.raporttiId) return;
      setOdottavaSidonta(null);
      sidoRaporttiTehtavaan(odottavaSidonta.tehtavaId, odottavaSidonta.raporttiId).then((tulos) => {
        if (tulos.ok) {
          setTehtavaVirhe(null);
          paivitaTehtavat();
        } else {
          setTehtavaVirhe(tulos.error || 'Poistumisluvan pyyntö epäonnistui.');
        }
      });
    });
  }, [odottavaSidonta, paivitaTehtavat]);

  // Kanava. GUARD-puoli ei ole tähän asti tarvinnut sitä, mutta hälytys on juuri se
  // tieto jota ei voi jäädä odottamaan seuraavaa sivunlatausta: lauennut ajastin on
  // näytettävä vartijalle heti, ja valvomon kuittaus on näytettävä hänelle heti.
  //
  // Sama yhteys kuljettaa myös sijainnin kentältä palvelimelle (erä 3).
  const { laheta: lahetaKanavalle, yhdistetty } = useKanava({
    // Kanava työntää yhden vartijan sijainnin heti kun se päivittyy. Korvataan rivi
    // tunnuksen perusteella eikä lisätä: sama vartija lähettää monta kertaa vuorossa,
    // ja lista kasvaisi muuten yhdeksi pitkäksi historiaksi.
    onSijainnit: (uudet) => setSijainnit((edelliset) => {
      const tunnukset = new Set(uudet.map((s) => s.username));
      return [...edelliset.filter((s) => !tunnukset.has(s.username)), ...uudet];
    }),
    onMuutos: (kokoelma) => {
      if (kokoelma === 'alerts') paivitaHalytykset();
      if (kokoelma === 'guardDispatch') {
        paivitaTehtavat();
        paivitaKeskuksenTehtavat();
      }
      if (kokoelma === 'patrolRuns') haeKierrokset();
      // Kenttäkirjaukset: tapahtumailmoitus, toimenpide ja tilatieto. Nämä puuttuivat
      // listalta, joten palvelimen työntämä muutos tuli perille ja jäi huomiotta.
      if (kokoelma === 'guardReports') haeRaportit();
      if (kokoelma === 'guardTaskRuns') haeTehtavasuoritukset();
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
  // Vuoron kohde (mobiiliversio). Koko mobiilinäkymä on yhden kohteen näkymä: vartija
  // on vuorossa yhdessä kohteessa kerrallaan, ja kaikki mitä hän kirjaa kohdistuu siihen.
  const vuoroKohde = vuoro ? kohteet.find((k) => k.id === vuoro.kohdeId) || null : null;

  const aktiivinenKohde = kierrosKohde || halytysKohde || tehtavaKohde || tietoKohde
    || raporttiKohde?.kohde || vuoroKohde || (kohteet.length === 1 ? kohteet[0] : null);

  // Man-down-asetus tulee KOHTEELTA eikä selaimen tallenteesta.
  //
  // 12.9.2026 asti se asui localStoragessa, ja se oli väärä paikka kahdesta syystä.
  // Vartija saattoi kytkeä valvonnan pois kenenkään näkemättä — man-down on työnantajan
  // turvallisuusasetus eikä työntekijän valinta — ja raja oli laitekohtainen, joten sama
  // vartija sai eri valvonnan sen mukaan millä puhelimella hän sattui kirjautumaan.
  // Natiivisovellus ei myöskään päässyt selaimen tallenteeseen käsiksi lainkaan, ja juuri
  // se sovellus man-downin oikeasti ajaa taskussa.
  //
  // Asetus luetaan VUOROKOHTEELTA eikä aktiivisesta kohteesta: valvonta koskee sitä
  // kohdetta jossa vartija on töissä, ei sitä jonka tietoja hän sattuu selaamaan.
  // Rajat tarkistetaan täälläkin, koska tietue tulee palvelimelta kokoelmana eikä
  // validoituna arvona — sama sääntö kuin server/halytys.js mandownAsetukset.
  const mandown = vuoroKohde?.mandown?.paalla === true;
  const mandownMin = Math.min(60, Math.max(30, Math.round(
    Number(vuoroKohde?.mandown?.liikkumatonMin) || LIIKKUMATON_MS / 60000
  )));

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

  // Puhelinsovelluksen tila. Kysytään vain kun sillä on merkitystä eli man-down on
  // kohteella päällä — turha kysely joka minuutti olisi kuormaa asiasta jota kukaan
  // ei katso.
  //
  // Väli on minuutti eli sama kuin sovelluksen sydämenlyönti. Tiheämpi kysely ei voi
  // tuottaa tuoreempaa tietoa kuin mitä palvelimella on.
  useEffect(() => {
    if (!mandown) {
      setNatiivi(false);
      return;
    }
    let voimassa = true;
    const tarkista = async () => {
      const tila = await haeOmaTila().catch(() => null);
      if (voimassa) setNatiivi(natiiviValvoo(tila));
    };
    tarkista();
    const ajastin = window.setInterval(tarkista, 60_000);
    return () => {
      voimassa = false;
      window.clearInterval(ajastin);
    };
  }, [mandown]);

  // Vuoron palautus. Laitteen tallenne luetaan ensin, jotta näkymä on oikea heti eikä
  // vilku tyhjänä verkon ajan — mutta se on kopio, ja palvelin voittaa ristiriidassa.
  //
  // Tallenne on käyttäjäkohtainen samasta syystä kuin ennenkin: jaetulla puhelimella
  // edellisen vartijan vuoro ei saa jäädä seuraavan päälle.
  useEffect(() => {
    if (!mobiili) return undefined;
    const kayttaja = session?.username || '';
    setVuoro(lueVuoro(kayttaja));

    let voimassa = true;
    haeOmaVuoro().then((palvelimelta) => {
      if (!voimassa) return;
      // undefined = ei tavoitettu. Silloin laitteen tallenne jää voimaan: katvealue ei saa
      // päättää vartijan vuoroa hänen puolestaan.
      if (palvelimelta === undefined) return;
      setPalvelimenVuoro(palvelimelta);
      if (palvelimelta) {
        const paivitetty: Vuoro = {
          kohdeId: palvelimelta.siteId,
          kohdeNimi: palvelimelta.siteNimi,
          alkoi: palvelimelta.alkoi,
          vuoroId: palvelimelta.id,
          vuorotyyppiNimi: palvelimelta.vuorotyyppiNimi,
        };
        tallennaVuoro(kayttaja, paivitetty);
        setVuoro(paivitetty);
      } else {
        // Palvelin sanoo ettei vuoroa ole: laitteelle jäänyt tallenne on vanhentunut.
        unohdaVuoro();
        setVuoro(null);
      }
    });
    return () => { voimassa = false; };
  }, [mobiili, session?.username]);

  // Tunnus on riippuvuus eikä koriste: siirrot ovat kysyjän omia, ja jaetulla
  // puhelimella seuraava vartija ei saa nähdä edellisen siirtoja. Ilman istuntoa ei ole
  // mitään haettavaa.
  const paivitaSiirrot = useCallback(async () => {
    if (!mobiili || !session?.username) return;
    setSiirrot(await haeOmatSiirrot());
  }, [mobiili, session?.username]);

  useEffect(() => { void paivitaSiirrot(); }, [paivitaSiirrot, vuoro?.vuoroId]);

  // Vuorovaihtoehdot haetaan vasta kun vuoroa ei ole: listaa tarvitaan vain
  // kirjautumisnäkymässä, eikä sitä kannata pitää ajan tasalla kesken vuoron.
  useEffect(() => {
    if (!mobiili || vuoro) return undefined;
    let voimassa = true;
    haeOmatVuorot()
      .then((tulos) => {
        if (!voimassa) return;
        setVuorovaihtoehdot(tulos.kohteet);
        setIlmanPerehdytysta(tulos.ilmanPerehdytysta);
      })
      .catch(() => {})
      .finally(() => { if (voimassa) setVuorotLadattu(true); });
    return () => { voimassa = false; };
  }, [mobiili, vuoro, session?.username]);

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

  // Kierrospisteen kuittaus tokenilla. Sama koodi palvelee kahta reittiä: puhelimen oma
  // kamera avaa /guard?piste=<token> (efekti alla), ja mobiiliversion kameraskanneri lukee
  // saman tarran poistumatta sovelluksesta (mobiili/Skanneri.tsx). Ilman tätä jaettuna
  // skannauksen säännöt — sijainti todisteeksi, ehdotus aloittamattomasta kierroksesta —
  // olisivat kahtena kappaleena, ja toinen jäisi ennen pitkää jälkeen.
  const kuittaaPiste = async (token: string) => {
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
    kuittaaPiste(token);
  }, [ladattu, saaKiertaa, kohteet]);

  // Kalustokilven skannaus (erä 20). Sama reitti kuin tarkistuspisteellä — puhelimen oma
  // kamera avaa /guard?kalusto=TJ-ASU-0117 — mutta parametri on TUNNUS eikä token, eikä
  // skannaus kuittaa mitään. Kilpi vain kertoo mikä esine on kädessä, ja vastaus on
  // esineen kortti.
  //
  // Tunnus jätetään tilaan eikä poisteta heti: kortti avataan tunnuksen perusteella, ja
  // se on suljettava ennen kuin tunnus unohdetaan. Osoiterivi siivotaan silti heti,
  // koska muuten sivun lataus avaisi saman kortin uudelleen.
  const [skannattuKalusto, setSkannattuKalusto] = useState<string | null>(null);
  const kalustoSkannausTehty = useRef(false);
  useEffect(() => {
    if (kalustoSkannausTehty.current) return;
    const tunnus = new URLSearchParams(window.location.search).get('kalusto');
    if (!tunnus) return;
    kalustoSkannausTehty.current = true;
    window.history.replaceState(window.history.state, '', window.location.pathname);
    if (!saaNahdaPankin) {
      setVirhe('Sinulla ei ole oikeutta kalustopankkiin.');
      return;
    }
    setSkannattuKalusto(tunnus);
    nollaaNakymat();
    setOsio('kalusto');
  }, [saaNahdaPankin]);

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

  // --- Hälytystehtävien toiminnot (erä 22) ------------------------------------------

  const avattu = tehtavat.find((t) => t.id === avattuTehtava) || null;

  // Yksi kutsupaikka kaikille tehtävän muutoksille.
  //
  // Onnistuneen muutoksen jälkeen lista HAETAAN UUDELLEEN eikä palvelimen palauttamaa
  // tietuetta liitetä tilaan. Muutosreitit palauttavat raa'an tietueen ilman kohdennuksen
  // kenttiä (peruste, toiminnot, kohde), jotka syntyvät vasta listareitillä — liitettynä
  // ne katoaisivat ja näkymä väittäisi ettei kohteella ole avaimia.
  const tehtavaToiminto = async (
    kutsu: () => Promise<{ ok: boolean; error?: string }>
  ) => {
    setTehtavaVirhe(null);
    setTehtavaTyoskentelee(true);
    try {
      const tulos = await kutsu();
      if (tulos.ok) {
        paivitaTehtavat();
        paivitaKeskuksenTehtavat();
      }
      else setTehtavaVirhe(tulos.error || 'Toiminto epäonnistui.');
      return tulos.ok;
    } finally {
      setTehtavaTyoskentelee(false);
    }
  };

  // Avatun hälytystehtävän toiminnot. PALVELIN PÄÄTTÄÄ MITKÄ RIVIT OVAT MAHDOLLISIA
  // (`toiminnot`), ja tämä vain piirtää ne — valikon rivi joka tuottaa 400-virheen on
  // huonompi kuin puuttuva rivi.
  //
  // "Ota vastaan" ja "Ota vastaan ja lähde ajoon" ovat molemmat listassa samasta syystä
  // kuin esimerkkikuvassa: auton ratissa toista painallusta ei ole.
  const tehtavanValinnat: MobiiliPikavalinta[] = avattu?.toiminnot
    ? [
      ...(avattu.toiminnot.vastaanota
        ? [
          { id: 'tehtava-vastaanota', label: 'Ota tehtävä vastaan' },
          { id: 'tehtava-vastaanota-ajoon', label: 'Ota vastaan ja lähde ajoon' },
        ]
        : []),
      ...(avattu.toiminnot.ajoon && !avattu.toiminnot.vastaanota
        ? [{ id: 'tehtava-ajoon', label: 'Lähde ajoon' }] : []),
      ...(avattu.toiminnot.paikalla && !avattu.toiminnot.vastaanota
        ? [{ id: 'tehtava-paikalla', label: 'Olen paikalla' }] : []),
      // Kieltäytyminen on peruutettavissa: kieltäytynyt voi yhä ottaa tehtävän vastaan,
      // joten erillistä vahvistusta ei tarvita. Punainen riittää.
      ...(avattu.toiminnot.kieltaydy
        ? [{ id: 'tehtava-kieltaydy', label: 'Kieltäydy tehtävästä', vaara: true }] : []),
    ]
    : [];

  const tehtavanValinta = (id: string) => {
    if (!avattu) return;
    if (id === 'tehtava-vastaanota') tehtavaToiminto(() => vastaanotaTehtava(avattu.id));
    else if (id === 'tehtava-vastaanota-ajoon') tehtavaToiminto(() => vastaanotaTehtava(avattu.id, true));
    else if (id === 'tehtava-ajoon') tehtavaToiminto(() => merkitseTehtavanVaihe(avattu.id, 'ajoon'));
    else if (id === 'tehtava-paikalla') tehtavaToiminto(() => merkitseTehtavanVaihe(avattu.id, 'paikalla'));
    else if (id === 'tehtava-kieltaydy') tehtavaToiminto(() => kieltaydyTehtavasta(avattu.id));
  };

  // Äänikytkin sivuvalikossa. Painallus on se ele jonka selain vaatii, joten lupa
  // varmistetaan samassa — erillinen "salli ääni" -vaihe jäisi tekemättä.
  const vaihdaAani = async (paalla: boolean) => {
    setAaniValittu(paalla);
    tallennaAaniasetus(paalla);
    if (!paalla) {
      lopetaHalytys();
      setAaniArmed(false);
      return;
    }
    setAaniArmed(await varmistaAani());
    await pyydaIlmoituslupa();
  };

  const avaaTehtava = (id: string) => {
    // Avaaminen on kuittaus: vartija on nähnyt hälytyksen, joten ääni vaikenee. Se ei
    // tarkoita että tehtävä olisi otettu vastaan — vastaanotto on oma painalluksensa.
    lopetaHalytys();
    nollaaAlanakymat();
    setTehtavaVirhe(null);
    setAvattuTehtava(id);
  };

  // Raportti hälytystehtävälle.
  //
  // KIRJAUS MENEE JONON KAUTTA kuten kaikki muukin kentällä tehty (erä 6): raporttia ei
  // saa hukata siihen että verkko oli poikki. Poistumispyyntö sen sijaan EI mene jonoon —
  // se on hälytysliikennettä, ja jonoon jäänyt "olen valmis, saanko lähteä" näyttäisi
  // onnistuneen ja lähtisi ehkä puolen tunnin päästä.
  //
  // Näistä kahdesta seuraa kolmas tilanne: raportti on jonossa eikä pyyntöä voi vielä
  // tehdä. Se SANOTAAN ääneen ja sidonta jää odottamaan lähetystä (odottavaSidonta),
  // jolloin lupa pyydetään itsestään heti kun yhteys palaa.
  const tallennaTehtavanRaportti = async (raportti: GuardRaportti, tehtavaId: string) => {
    setRaportit((edelliset) => [...edelliset, raportti]);
    const tulos = await lisaaJonoon({
      polku: '/api/kirjaa/guardReports',
      runko: raportti,
      kuvaus: `${raportti.type}: ${raportti.place || ''}`.trim(),
      tunniste: `guardReport:${raportti.id}`,
    });
    if (!tulos.lahetetty) {
      setOdottavaSidonta({ tehtavaId, raporttiId: raportti.id });
      setTehtavaVirhe(
        'Raportti odottaa lähetystä. Poistumislupaa ei voi pyytää ennen kuin yhteys palaa — '
        + 'älä poistu kohteesta.'
      );
      return true;
    }
    await tehtavaToiminto(() => sidoRaporttiTehtavaan(tehtavaId, raportti.id));
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
    if (!(await tallenna(uudet))) return;
    setLomake(null);
    // Valikko jää auki muokatulle kohteelle, joten sen kopio on päivitettävä: muuten
    // otsikossa ja tiedoissa lukisi vanha nimi kunnes listaan palataan.
    setValittuKohde((edellinen) => (edellinen && edellinen.id === kohde.id ? kohde : edellinen));
  };

  const poista = async () => {
    if (!poistettava) return;
    const jaljelle = kohteet.filter((k) => k.id !== poistettava.id);
    if (!(await tallenna(jaljelle, { salliTyhja: jaljelle.length === 0 }))) return;
    setPoistettava(null);
    // Poistetun kohteen valikkoa ei jätetä auki — se näyttäisi kohteelta joka on olemassa.
    setValittuKohde((edellinen) => (edellinen && edellinen.id === poistettava.id ? null : edellinen));
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
  // Rakenne on kolmitasoinen: etusivu → osio (Kohteet tai Hälytyskeskus) → kohteen
  // valikko → yksittäinen näkymä. Kohteen näkymät ovat keskenään yhden tason syvyydellä
  // — jokainen aukeaa valikon painikkeesta ja jokaisen paluulinkki vie samaan valikkoon —
  // joten niiden sulkeminen on aina sama toimenpide.
  //
  // Tämä nollaa VAIN näkymät, ei valittua kohdetta: näkymän sulkeminen palaa kohteen
  // valikkoon eikä kohdelistaan.
  const nollaaAlanakymat = () => {
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
    setKohteenEsine(null);
    setMittariKohde(null);
    setJaksoKohde(null);
    setAvattuTehtava(null);
  };

  // Nollaa myös valitun kohteen: käytetään silloin kun poistutaan koko kohteesta
  // (kohdelistaan, etusivulle tai hälytyskeskukseen).
  const nollaaNakymat = () => {
    nollaaAlanakymat();
    setValittuKohde(null);
  };

  // Nykyisen näkymän tunniste historiaa varten. Järjestys on SAMA kuin alla olevassa
  // renderöintiketjussa — jos ne eroaisivat, historia kertoisi eri näkymän kuin
  // ruudulla on.
  const nakyma =
    asetuksissa ? 'asetukset'
      : avattuTehtava ? 'halytystehtava'
      : osio === 'halytyskeskus' ? 'halytyskeskus'
      : osio === 'kalusto' ? 'kalustopankki'
      : osio === 'tyontekijat' ? 'tyontekijapankki'
      : osio === 'sijaintihistoria' ? 'sijaintihistoria'
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
      : valittuKohde ? 'kohde'
      : osio === 'kohteet' ? 'kohdevalinta'
      : JUURINAKYMA;

  // Takaisin-nappi purkaa yhden tason: näkymästä kohteen valikkoon, valikosta
  // kohdelistaan, kohdelistasta ja hälytyskeskuksesta etusivulle, etusivulta ulos
  // sovelluksesta. Taso luetaan historiamerkinnästä, koska se on ainoa tieto jonka
  // merkintä kuljettaa.
  //
  // 'kohde' on tässä poikkeus: merkinnässä ei ole kohteen id:tä, mutta sitä ei tarvitakaan
  // — valittu kohde on yhä tilassa, ja tason purkaminen tarkoittaa vain avoimen näkymän
  // sulkemista. Sen sijaan kohdelistaan (ja ylemmäs) palattaessa valinta on nollattava,
  // muuten lista näyttäisi listalta mutta seuraava takaisin veisi vanhaan kohteeseen.
  const siirry = (tunniste: string) => {
    if (mobiili) {
      // Mobiiliversiossa on kaksi tasoa: etusivu ja siitä avattu näkymä. Kohdelistaa ja
      // kohteen valikkoa ei ole, joten purettava taso on aina sama.
      nollaaNakymat();
      setOsio('etusivu');
      const toiminto = MOBIILIN_NAKYMAT[tunniste];
      if (toiminto && vuoroKohde) avaaToiminto(toiminto, vuoroKohde);
      return;
    }
    if (tunniste === 'kohde') {
      nollaaAlanakymat();
      setOsio('kohteet');
      return;
    }
    nollaaNakymat();
    setOsio(
      tunniste === 'halytyskeskus' ? 'halytyskeskus'
        // Kalustopankki on etusivun osio siinä missä hälytyskeskus, joten takaisin-nappi
        // purkaa sen samalla tavalla yhdeksi tasoksi.
        : tunniste === 'kalustopankki' ? 'kalusto'
          : tunniste === 'tyontekijapankki' ? 'tyontekijat'
          : tunniste === 'sijaintihistoria' ? 'sijaintihistoria'
          : tunniste === JUURINAKYMA ? 'etusivu'
            : 'kohteet'
    );
  };

  // Yläpalkin logo vie etusivulle. Se on koko sovelluksen juuri, ei enää kohdelista.
  const paluuEtusivulle = () => {
    nollaaNakymat();
    setOsio('etusivu');
  };

  // Kohteen valikon painike avaa oikean näkymän. Yksi kytkin eikä kolmetoista propsia:
  // valikko kertoo MITÄ käyttäjä valitsi, ja näkymätilat ovat tämän komponentin asia.
  const avaaToiminto = (toiminto: Toiminto, kohde: Kohde) => {
    if (toiminto === 'tehtavat') setTehtavaKohde(kohde);
    else if (toiminto === 'kierros') setKierrosKohde(kohde);
    else if (toiminto === 'kierrospohjat') setPohjaKohde(kohde);
    else if (toiminto === 'kalusto') setKalustoKohde(kohde);
    else if (toiminto === 'mittaristo') setMittariKohde(kohde);
    else if (toiminto === 'jaksoraportit') setJaksoKohde(kohde);
    else if (toiminto === 'tiedotteet') setTiedoteKohde(kohde);
    else if (toiminto === 'ohjeet') setPohjaNakyma({ kohde, laji: 'guide' });
    else if (toiminto === 'skenaariot') setPohjaNakyma({ kohde, laji: 'play' });
    else if (toiminto === 'halytykset') setHalytysKohde(kohde);
    else if (toiminto === 'toimenpide') setRaporttiKohde({ kohde, tyyppi: 'guard_action' });
    else if (toiminto === 'ilmoitus') setRaporttiKohde({ kohde, tyyppi: 'guard_jvreport' });
    else if (toiminto === 'tiedot') setTietoKohde(kohde);
  };

  // Kaikki kokoelmat yhtenä oliona tilannekuvan laskentaa varten (ks. tilannekuva.ts).
  // useMemo eikä pelkkä olioliteraali: hälytyskeskuksessa juoksee sekuntikello, ja uusi
  // olio joka renderöinnillä laskisi tapahtumavirran ja kohdetilanteet uudelleen kerran
  // sekunnissa.
  const lahteet = useMemo(() => ({
    halytykset,
    kierrokset,
    tehtavat: suoritukset,
    raportit,
    avaimet,
    poikkeamat,
    kalusto: pankki,
    tiedotteet,
    skenaariot: pohjaSuoritukset,
    pohjat: pohjat as unknown as Pohja[],
    jaksoraportit: jalkiraportit,
  }), [
    halytykset, kierrokset, suoritukset, raportit, avaimet, poikkeamat, pankki, tiedotteet,
    pohjaSuoritukset, pohjat, jalkiraportit,
  ]);

  // --- Mobiiliversion toiminnot ----------------------------------------------------

  // Vuoron aloitus kulkee PALVELIMEN KAUTTA (erä 17), eikä se ole muotoseikka: perehdytys
  // ja vuoroikkuna tarkistetaan siellä, eikä niitä voi tarkistaa laitteella. Siksi
  // aloitus on ainoa kohta koko mobiilipuolella joka vaatii yhteyden — työn tekeminen ei
  // vaadi, mutta työn aloittaminen ilman oikeustarkistusta olisi eri asia.
  const aloitaVuoro = async (siteId: string, vaihtoehto: VuoroVaihtoehto) => {
    setVuoroVirhe(null);
    setVuoroaAloitetaan(true);
    const tulos = await aloitaVuoroPalvelimella(siteId, vaihtoehto.id).catch(() => null);
    setVuoroaAloitetaan(false);

    if (!tulos || !tulos.ok) {
      setVuoroVirhe(tulos
        ? tulos.virhe
        : 'Vuoroa ei voitu aloittaa: palvelimeen ei saatu yhteyttä. Vuoron aloitus vaatii verkon, koska perehdytys tarkistetaan palvelimella.');
      return;
    }

    const uusi: Vuoro = {
      kohdeId: tulos.vuoro.siteId,
      kohdeNimi: tulos.vuoro.siteNimi,
      alkoi: tulos.vuoro.alkoi,
      vuoroId: tulos.vuoro.id,
      vuorotyyppiNimi: tulos.vuoro.vuorotyyppiNimi,
    };
    tallennaVuoro(session?.username || '', uusi);
    setPalvelimenVuoro(tulos.vuoro);
    setVuoro(uusi);
    // Hälytysääni avataan TÄSSÄ eikä erillisellä painikkeella (erä 23). Selain vaatii
    // äänelle käyttäjän eleen, ja vuoron aloitus on se ele jonka vartija tekee joka
    // vuorossa — erillinen "salli ääni" -nappi jäisi painamatta juuri niiltä joiden
    // takia koko ääni tehtiin. Ilmoituslupa kysytään samassa eleessä samasta syystä.
    if (aaniValittu) {
      setAaniArmed(await varmistaAani());
      await pyydaIlmoituslupa();
    }
    // Natiivipalvelu käynnistetään vasta kun vuoro on tallessa: jos sovelluksen avaaminen
    // vie näkymän hetkeksi pois, palaava käyttöliittymä lukee vuoron varastosta.
    const valitys = kaynnistaSovelluksessa(uusi);
    // Varoitetaan vain siellä missä sovellus on olemassa. Työpöydällä ja iPhonella vuoro
    // on käyttöliittymän tila eikä valvontaa, eikä siitä ole mitään kerrottavaa.
    setValvontaVaroitus(valitys === 'ei_tavoitettu' && onAlustaJollaSovellus());
  };

  // Tehtävän tai kierroksen lisäys omaan vuoroon kohteen hakemistosta. Palvelin
  // hyväksyy vain kohteen omasta hakemistosta ja merkitsee lähteen `itse_lisatty`,
  // joten jälkikäteen erottuu mikä oli suunniteltua työtä ja mikä tuli vuoron aikana.
  const lisaaOmaanVuoroon = async (laji: 'tehtava' | 'kierros', kohdeId: string) => {
    if (!vuoro?.vuoroId) return;
    setLisaysVirhe(null);
    setVuoroonLisataan(true);
    const tulos = await lisaaVuoroon(vuoro.vuoroId, laji, kohdeId);
    setVuoroonLisataan(false);
    if (!tulos.ok) {
      setLisaysVirhe(tulos.virhe);
      return;
    }
    setPalvelimenVuoro(tulos.vuoro);
  };

  // --- Tehtävän siirto (erä 18) ----------------------------------------------------

  const avaaSiirto = async (laji: 'tehtava' | 'kierros', id: string, nimi: string) => {
    setSiirrettava({ laji, id, nimi });
    setSiirtoVirhe(null);
    setVastaanottajatLadattu(false);
    setVastaanottajat(await haeVastaanottajat());
    setVastaanottajatLadattu(true);
  };

  const lahetaSiirto = async (saaja: string, viesti: string) => {
    if (!siirrettava) return;
    setSiirtoVirhe(null);
    setSiirtoLahetetaan(true);
    const tulos = await siirraTehtava(saaja, siirrettava.laji, siirrettava.id, viesti);
    setSiirtoLahetetaan(false);
    if (!tulos.ok) {
      setSiirtoVirhe(tulos.virhe);
      return;
    }
    setSiirrettava(null);
    await paivitaSiirrot();
  };

  // Vastauksen jälkeen haetaan sekä siirrot ETTÄ vuoro: hyväksytty siirto voi avata
  // kohteen jota vartija ei aiemmin nähnyt, eikä vanha kohdelista kerro siitä mitään.
  const vastaaSiirtoPyyntoon = async (id: string, hyvaksy: boolean) => {
    setSiirtoVastataan(true);
    const tulos = await vastaaSiirtoon(id, hyvaksy);
    setSiirtoVastataan(false);
    if (!tulos.ok) {
      setVirhe(tulos.virhe);
      return;
    }
    await paivitaSiirrot();
    if (hyvaksy) paivitaKohteet();
  };

  // Pakotuksen kuittaus. Ei ole hyväksyntä: tehtävä on jo vartijan, ja kuittaus kertoo
  // vain että määräys on nähty. Kohdelista haetaan perään, koska pakotus voi koskea
  // kohdetta jota vartija ei aiemmin nähnyt.
  const kuittaaMaarays = async (id: string) => {
    setPakotustaKuitataan(true);
    await kuittaaPakotus(id);
    setPakotustaKuitataan(false);
    await paivitaSiirrot();
    paivitaKohteet();
  };

  // Pakotetun tehtävän merkitseminen tehdyksi (18.9.2026).
  //
  // Eri asia kuin kuittaus yllä: kuittaus kertoo että määräys on nähty, tämä että työ on
  // tehty ja vaadittu raportti kirjoitettu. Palvelin vaatii kuittauksen ensin.
  const [tehtavaValmiiksi, setTehtavaValmiiksi] = useState<Siirto | null>(null);
  const [valmiiksiTallentaa, setValmiiksiTallentaa] = useState(false);
  const [valmiiksiVirhe, setValmiiksiVirhe] = useState<string | null>(null);

  const merkitseTehdyksi = async (arvot: { raporttiId: string | null; teksti: string }) => {
    if (!tehtavaValmiiksi) return;
    setValmiiksiTallentaa(true);
    setValmiiksiVirhe(null);
    const tulos = await merkitseSiirtoValmiiksi(tehtavaValmiiksi.id, arvot);
    setValmiiksiTallentaa(false);
    if (!tulos.ok) {
      setValmiiksiVirhe(tulos.error || 'Merkintä ei onnistunut.');
      return;
    }
    setTehtavaValmiiksi(null);
    await paivitaSiirrot();
  };

  // Kohdelistan uudelleenhaku. Hyväksytty siirto voi avata kohteen jota vartija ei
  // aiemmin nähnyt (server/index.js: siirtojenAvaamatKohteet), eikä käynnistyksessä
  // haettu lista kerro siitä mitään.
  const paivitaKohteet = () => {
    fetch('/api/data/guardSites', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.ok === true && Array.isArray(res.data)) setKohteet(res.data);
      })
      .catch(() => {
        // Epäonnistuminen ei saa kaataa siirron hyväksyntää: siirto on jo tallessa
        // palvelimella, ja kohdelista päivittyy viimeistään seuraavassa latauksessa.
      });
  };

  // Päättäminen ei jää verkon varaan. Palvelimelle lähetetään pyyntö, mutta laitteen
  // vuoro päättyy joka tapauksessa: katvealueelle jäänyt pyyntö tarkoittaisi muuten,
  // ettei vartija pääse ulos vuorosta ennen kuin verkko palaa.
  const paataVuoro = () => {
    // Kooste haetaan VASTA päättämisen jälkeen, jotta päättymisaika ja viimeiset
    // kuittaukset ovat mukana. Se ei estä vuoron päättymistä: näkymä vapautuu heti, ja
    // kooste ilmestyy kun se on valmis.
    const paattyva = vuoro?.vuoroId;
    if (paattyva) {
      setKoosteAuki(true);
      setKoostettaHaetaan(true);
      setKooste(null);
      void paataVuoroPalvelimella(paattyva)
        .then(() => haeVuoronKooste(paattyva))
        .then((tulos) => setKooste(tulos))
        .finally(() => setKoostettaHaetaan(false));
    }
    paataSovelluksessa();
    unohdaVuoro();
    setVuoro(null);
    setValvontaVaroitus(false);
    setPalvelimenVuoro(null);
    setVuorotLadattu(false);
    setVuoroVirhe(null);
    setLisaysVirhe(null);
    nollaaNakymat();
    setOsio('etusivu');
  };

  // Työpöytäversioon vaihtaminen lataa sivun uudelleen: versio ratkeaa osoitteesta ennen
  // ensimmäistä renderöintiä (main.tsx). Valinta tallennetaan, jotta asennettu sovellus
  // avautuu jatkossa siihen versioon johon käyttäjä vaihtoi.
  const vaihdaTyopoydalle = () => {
    tallennaLaitevalinta('tyopoyta');
    window.location.assign(TYOPOYTAPOLKU);
  };

  // Kameran lukema koodi. Kaksi tarralajia, yksi reitti:
  //
  //   QR-tarra    sisältää osoitteen /guard?piste=<token>, josta token luetaan.
  //   viivakoodi  on pisteen koodi sellaisenaan (Code-128 ei mahduta 43 merkin tokenia
  //               luettavan levyiseen tarraan, ks. server/pohjat.js).
  //
  // Kumpaakaan ei tulkita täällä sen pidemmälle: palvelin tietää mikä koodi kuuluu
  // mihinkin pisteeseen, ja se myös kertoo jos luettu koodi ei kuulu mihinkään. Selain
  // ei voi tuota tietää — se näkee vain ne pohjat jotka se on hakenut.
  const kasitteleSkannaus = (arvo: string) => {
    setKameraAuki(false);
    let koodi = arvo.trim();
    try {
      const token = new URL(arvo, window.location.origin).searchParams.get('piste');
      if (token) koodi = token;
    } catch {
      // Ei osoite vaan pelkkä koodi. Se on viivakoodin tavallisin muoto.
    }
    if (!koodi) return;
    kuittaaPiste(koodi);
  };

  // Tilatieto kirjataan toimenpidekirjauksena (ks. mobiili/Tilatieto.tsx). Menee saman
  // lähtevän jonon kautta kuin muutkin kenttäkirjaukset, joten se ei katoa katvealueella.
  const lahetaTilatieto = async (teksti: string) => {
    if (!vuoroKohde) return false;
    const hetki = new Date();
    return tallennaRaportti({
      id: uusiId(),
      siteId: vuoroKohde.id,
      typeId: 'guard_action',
      type: 'Tilatieto',
      author: session?.nickname || '',
      date: paikallinenPaiva(hetki),
      time: hetki.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }),
      place: vuoroKohde.name,
      summary: teksti,
      description: teksti,
      luotu: hetki.toISOString(),
      // EI 'open'. Tilatieto ei ole avoin poikkeama jota joku sulkee myöhemmin, vaan
      // merkintä siitä missä vartija on. Avoimena se kasvattaisi hälytyskeskuksen
      // avointen listaa joka kerta kun joku sanoo olevansa kunnossa.
      status: null,
      severity: null,
      zoneId: null,
      assignedTo: null,
      closedAt: null,
      closedBy: null,
      attachments: [],
      corrections: [],
    });
  };

  // Sivuvalikon linkit. Neljä ensimmäistä ovat luonnoksesta; loput ovat mukana siksi,
  // että ilman niitä mobiiliversiossa ei pääsisi lainkaan hätäpainikkeeseen eikä
  // raportointiin. Jokainen rivi on oikeuden takana: valikossa näkyy vain se mitä
  // tunnuksella saa tehdä.
  const mobiiliLinkit: MobiiliLinkki[] = vuoroKohde
    ? [
      ...(saaNahdaKalustoa ? [{ id: 'kalusto', label: 'Kalusto' }] : []),
      ...(saaNahdaTiedotteet ? [{ id: 'tiedotteet', label: 'Tiedotteet' }] : []),
      ...(saaNahdaOhjeet ? [{ id: 'ohjeet', label: 'Työvuoron ohjeet' }] : []),
      ...(saaNahdaSkenaariot ? [{ id: 'skenaariot', label: 'Skenaariot' }] : []),
      ...(saaNahdaHalytykset ? [{ id: 'halytykset', label: 'Hälytykset ja hätäpainike' }] : []),
      ...(saaKirjataToimenpiteen ? [{ id: 'toimenpide', label: 'Kirjaa toimenpide' }] : []),
      ...(saaKirjataIlmoituksen ? [{ id: 'ilmoitus', label: 'Tapahtumailmoitus' }] : []),
      ...(saaNahdaTiedot ? [{ id: 'tiedot', label: 'Kohteen tiedot' }] : []),
      // 'Vaihda kohdetta' päätti ennen vain laitteen tilan. Erässä 17 se päättää vuoron
      // myös palvelimella, joten nimi kertoo sen: vuoron päättyminen on kirjaus, ja
      // painike joka aliarvioi tekonsa on pahempi kuin pitkä nimi.
      { id: 'vaihda-kohde', label: 'Vaihda vuoroa (päättää nykyisen)' },
    ]
    : [];

  // Sivuvalikosta siirrytään suoraan näkymästä toiseen, ja siksi edellinen on
  // suljettava ensin. Työpöytäversiossa tätä ei tarvita, koska siellä näkymään mennään
  // aina kohteen valikon kautta ja valikkoon paluu nollaa tilat. Ilman nollausta kaksi
  // näkymätilaa oli yhtä aikaa päällä: ruudulla oli Kalusto mutta palkissa luki
  // "Hälytykset", koska otsikko ja renderöintiketju lukevat tiloja eri järjestyksessä.
  const avaaMobiiliLinkki = (id: string) => {
    if (id === 'vaihda-kohde') {
      paataVuoro();
      return;
    }
    if (!vuoroKohde) return;
    nollaaAlanakymat();
    avaaToiminto(id as Toiminto, vuoroKohde);
  };

  // Ilmoituskello: avoimet hälytykset. Oma hälytys näkyy myös toisesta kohteesta —
  // vartija on voinut painaa hätäpainiketta ennen kuin vaihtoi vuoron kohdetta.
  //
  // Hälytystehtävät (erä 22) ovat listan kärjessä eivätkä oikeusehdon takana: hälytys
  // tulee kaikille joille se on kohdennettu, ja palvelin on jo päättänyt kenelle lista
  // on tyhjä. Murtohälytys erottuu versaaleilla — se on ainoa laji joka on
  // määritelmällisesti kiireellinen, kun vartijakutsu ja ovenavaus ovat sovittua työtä.
  const tehtavaIlmoitukset: MobiiliIlmoitus[] = tehtavat.map((t) => ({
    id: `tehtava:${t.id}`,
    otsikko: t.laji === 'murto' ? TEHTAVAN_LAJI[t.laji].toUpperCase() : TEHTAVAN_LAJI[t.laji],
    kuvaus: `Kohde: ${t.siteNimi}`,
    taso: t.laji === 'murto' ? ('kriittinen' as const) : ('varoitus' as const),
  }));

  const omatHalytysIlmoitukset: MobiiliIlmoitus[] = saaNahdaHalytykset
    ? halytykset
      .filter((h) => (h.tila === 'lauennut' || h.tila === 'kaynnissa')
        && (h.eventId === vuoroKohde?.id || h.vartija === session?.username))
      .map((h) => ({
        id: h.id,
        otsikko: TYYPPI_LABEL[h.tyyppi],
        kuvaus: h.kuvaus || (h.tila === 'lauennut' ? 'Lauennut' : 'Käynnissä'),
        taso: h.tila === 'lauennut' ? ('kriittinen' as const) : ('varoitus' as const),
      }))
    : [];

  // Tikittävä kello minuutin tarkkuudella. Tarvitaan siihen että myöhästymishuomio
  // ilmestyy KESKEN vuoron: oma vuoro haetaan kerran sovellusta avattaessa, joten ilman
  // tätä ilmoitus näkyisi vain jos vartija sattuu avaamaan sovelluksen uudelleen
  // päättymisajan jälkeen — eli juuri silloin kun hän ei sitä enää tarvitse.
  //
  // Minuutti eikä sekunti: näytettävä luku on minuutteja, ja sekunnin välein pyörivä
  // uudelleenrenderöinti maksaisi akkua kentällä ilman että mikään muuttuu.
  const [nyt, setNyt] = useState(() => Date.now());
  useEffect(() => {
    const ajastin = window.setInterval(() => setNyt(Date.now()), 60_000);
    return () => window.clearInterval(ajastin);
  }, []);

  // UNOHTUNUT VUORO (käyttäjän päätös 15.9.2026). Kymmenen minuuttia yli ilmoitetun
  // päättymisajan, ja vartija saa huomion omaan sovellukseensa.
  //
  // TÄMÄ ON MUISTUTUS EIKÄ HÄLYTYS, ja taso on siksi `perus`. Vuoron päättäminen kuuluu
  // vartijan työvelvollisuuteen, ja useimmiten kyse on siitä että vuoronvaihto venyi
  // viisi minuuttia — ei siitä että jotain on sattunut. Kriittinen taso tekisi tästä
  // ilmoituksen joka tulee joka vuorossa ja jota kukaan ei lue.
  //
  // Viiden minuutin päästä tästä sama asia nousee hälytyskeskuksen listaan, ja silloin
  // se on päivystäjän selvitettävä. Tämä on vartijan mahdollisuus hoitaa se itse ensin.
  //
  // Lasketaan `nyt`-tilasta eikä haun hetkestä: oma vuoro haetaan kerran sovellusta
  // avattaessa, joten ilman tikittävää kelloa huomio ei ilmestyisi koskaan kesken vuoron.
  const vuoroMyohassaMin = myohassaMinuutteina(palvelimenVuoro?.paattyyArvio, nyt);
  const unohtunutVuoroIlmoitus: MobiiliIlmoitus[] =
    vuoroMyohassaMin !== null && vuoroMyohassaMin >= UNOHTUNUT_VARTIJA_MIN
      ? [{
        id: 'vuoro-myohassa',
        otsikko: 'Vuoro on yhä käynnissä',
        kuvaus: `${vuoroMyohassaMin} min yli päättymisajan. Päätä vuoro jos olet lopettanut.`,
        taso: 'perus' as const,
      }]
      : [];

  const mobiiliIlmoitukset: MobiiliIlmoitus[] = [
    ...tehtavaIlmoitukset, ...omatHalytysIlmoitukset, ...unohtunutVuoroIlmoitus,
  ];

  const avaaIlmoitus = (id: string) => {
    if (id.startsWith('tehtava:')) {
      avaaTehtava(id.slice('tehtava:'.length));
      return;
    }
    const halytys = halytykset.find((h) => h.id === id);
    const kohde = kohteet.find((k) => k.id === halytys?.eventId) || vuoroKohde;
    if (!kohde) return;
    // Sama nollaus kuin valikossa: ilmoituksesta hypätään suoraan avoimen näkymän päälle.
    nollaaAlanakymat();
    avaaToiminto('halytykset', kohde);
  };

  useHistorianavigointi(nakyma, siirry);

  // Poistovahvistus on modaali: takaisin peruu sen eikä vie kohdelistaan.
  useTakaisinEste(!!poistettava, () => setPoistettava(null));
  // Kohteen kalustorekisteristä avattu esineen kortti. Este on täällä eikä kortissa
  // samasta syystä kuin yllä: hook on kutsuttava komponentista joka on jo mountattu,
  // muuten StrictModen kaksoisajo sulkee modaalin heti sen avauduttua.
  useTakaisinEste(!!kohteenEsine, () => setKohteenEsine(null));

  const kirjauduUlos = async () => {
    // Laitteelle ei jää työtietoja uloskirjautumisen jälkeen. Jonoa EI tyhjennetä:
    // lähettämätön kirjaus on tehtyä työtä, ja se odottaa seuraavaa kirjautumista.
    // Valvonta lopetetaan ENNEN uloskirjautumista. Muuten laitteelle jäisi pyörimään
    // palvelu, joka jakaa sijaintia tunnuksella jolla ei enää ole istuntoa — ja se on
    // täsmälleen se tilanne jota "vapaa-ajalla ei seurata" ei saa tarkoittaa.
    paataSovelluksessa();
    unohdaVuorodata();
    unohdaVuoro();
    unohdaIstunto();
    await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    window.location.reload();
  };

  const ylapalkki = (alaotsikko: string) => (
    <Ylapalkki
      tuoteNimi="Turvajohto GUARD"
      alaotsikko={alaotsikko}
      onLogo={paluuEtusivulle}
      // GUARD-puolella ei ole vielä ilmoituksia eikä salasananvaihtoa: molemmat odottavat
      // purkamista jaetuksi App.tsx:stä. Uloskirjautuminen toimii jo.
      ilmoitukset={[]}
      onIlmoitus={() => {}}
      nimimerkki={session?.nickname || ''}
      isAdmin={!!isAdmin}
      onLogout={kirjauduUlos}
    />
  );

  // Sovellukseen pääsee jos edes toinen etusivun osio on käytettävissä. Pelkkä
  // hälytyskeskusoikeus riittää: päivystäjä ei välttämättä saa nähdä kohteiden hallintaa.
  if (!saaNahda && !saaNahdaHalytyskeskus) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col">
        {ylapalkki('Vartiointi')}
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-md bg-surface border border-line rounded-xl p-6 text-center">
            <h2 className="font-bold mb-2 text-ink-strong">Ei näkyvyysoikeutta</h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Käyttäjätasollasi ei ole oikeutta Kohdevalintaan eikä Hälytyskeskukseen.
              Pääkäyttäjä voi lisätä ne Sovellusasetusten Käyttäjätasot-osiosta.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Näkymän nimi palkkiin. Sama järjestys kuin renderöintiketjussa alla — jos ne
  // eroaisivat, palkissa lukisi eri näkymä kuin ruudulla on.
  const nakymanNimi = asetuksissa ? 'Sovellusasetukset'
    : avattu ? `${TEHTAVAN_LAJI[avattu.laji]} — ${avattu.siteNimi}`
    : osio === 'halytyskeskus' ? 'Hälytyskeskus'
    : osio === 'kalusto' ? 'Kalustopankki'
    : osio === 'tyontekijat' ? 'Työntekijäpankki'
    : osio === 'sijaintihistoria' ? 'Sijaintihistoria'
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
    : valittuKohde ? valittuKohde.name
    : osio === 'kohteet' ? 'Kohdevalinta'
    : 'Vartiointi';

  // Näkymien sisältö omana muuttujanaan, koska se renderöidään kahteen eri kuoreen:
  // työpöydän yläpalkin alle ja mobiiliversion puhelinkehykseen. Sisältö on molemmissa
  // sama — ero on kuoressa ja etusivussa, ei siinä mitä näkymät näyttävät.
  const runko = (
    <>
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
          // Kolme ehtoa. Kohteen asetus ja selaimen lupa ovat edellytyksiä; natiivin
          // valvonta on este. Kumpi tahansa edellytys yksin tarkoittaisi kuuntelijaa joka
          // ei koskaan saa näytteitä, eli valvontaa joka näyttää päällä olevalta olematta
          // sitä.
          mandown={mandown && liikelupa && !natiivi}
          liikkumatonMin={mandownMin}
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

      {/* Vuoro käynnistyi ilman taustavalvontaa. Tämä ei ole virhe vaan tila josta on
          kerrottava: vartija luulee muuten olevansa valvonnan piirissä. Ei suljettavissa
          niin kuin skannausbanneri — se palaisi joka tapauksessa vasta seuraavassa
          vuoron aloituksessa, ja siihen mennessä koko vuoro olisi ohi. */}
      {/* Pakotettu tehtävä estää muun käytön kunnes se on kuitattu. Ylin z-taso ja
          ennen muita modaaleja: määräys jonka voi ohittaa toisen ikkunan alle ei ole
          määräys. Yksi kerrallaan — jono purkautuu kuittaus kerrallaan. */}
      {mobiili && siirrot.pakotukset.length > 0 && (
        <PakotettuTehtava
          pakotus={siirrot.pakotukset[0]}
          kuitataan={pakotustaKuitataan}
          onKuittaa={kuittaaMaarays}
        />
      )}

      {/* Valmiiksi merkintä on PakotettuTehtava-modaalin jälkeen matalammalla z-tasolla:
          kuittaamaton määräys on aina päällimmäisenä, koska sen on pysäytettävä ruutu. */}
      {tehtavaValmiiksi && (
        <SiirronRaportti
          siirto={tehtavaValmiiksi}
          omatRaportit={raportit.filter(
            (r) => r.author === session?.username && r.siteId === tehtavaValmiiksi.siteId
          )}
          tallentaa={valmiiksiTallentaa}
          virhe={valmiiksiVirhe}
          onSulje={() => { setTehtavaValmiiksi(null); setValmiiksiVirhe(null); }}
          onValmis={merkitseTehdyksi}
        />
      )}

      {koosteAuki && (
        <VuoronKoosteNakyma
          kooste={kooste}
          ladataan={koostettaHaetaan}
          onSulje={() => { setKoosteAuki(false); setKooste(null); }}
        />
      )}

      {siirrettava && (
        <SiirtoValinta
          tehtavaNimi={siirrettava.nimi}
          vastaanottajat={vastaanottajat}
          ladattu={vastaanottajatLadattu}
          lahettaa={siirtoLahetetaan}
          virhe={siirtoVirhe}
          onSiirra={lahetaSiirto}
          onSulje={() => setSiirrettava(null)}
        />
      )}

      {valvontaVaroitus && (
        <div className="mb-6 flex items-start gap-3 rounded-lg px-4 py-3 border bg-danger-soft border-danger/30 text-danger-ink">
          <ShieldOff size={18} className="shrink-0 mt-0.5" />
          <p className="text-sm flex-1">
            <strong className="font-semibold">Taustavalvonta ei ole käynnissä.</strong>{' '}
            Vuoro on alkanut ja työn voi tehdä normaalisti, mutta puhelin ei valvo taustalla:
            tämä on selain eikä asennettu sovellus. Avaa Turvajohto GUARD -sovellus ja aloita
            vuoro siellä uudelleen.
          </p>
        </div>
      )}

      {asetuksissa ? (
        <Asetukset
          raportit={raportit}
          isAdmin={!!isAdmin}
          onHavita={havitaVanhentuneet}
          onTakaisin={() => setAsetuksissa(false)}
        />
      ) : avattu ? (
        <HalytystehtavaNakyma
          tehtava={avattu}
          kayttaja={session?.username || ''}
          yksikko={yksikonNimi}
          tyoskentelee={tehtavaTyoskentelee}
          virhe={tehtavaVirhe}
          // Raportointi on tapahtumailmoitus, ja sen kirjaaminen on oma oikeutensa
          // (guard_report_jv). Ilman oikeutta painiketta ei näytetä — näkymä kertoo sen
          // itse, koska muuten vartija etsisi puuttuvaa nappia.
          onRaportoi={saaKirjataIlmoituksen && avattu.kohde
            ? () => {
                const kohde = kohteet.find((k) => k.id === avattu.siteId);
                setAvattuTehtava(null);
                setRaporttiKohde({
                  // Hälytys voi tulla kohteesta jonka tietueeseen vartijalla ei ole
                  // pääsyä, jolloin `kohteet` ei sisällä sitä. Lomake tarvitsee kohteesta
                  // vain id:n ja nimen, ja ne tulevat tehtävältä.
                  kohde: kohde || { ...tyhjaKohde(), id: avattu.siteId, name: avattu.siteNimi },
                  tyyppi: 'guard_jvreport',
                  tehtavaId: avattu.id,
                });
              }
            : null}
          onMasterkoodi={async () => {
            const tulos = await haeMasterkoodi(avattu.id);
            if (!tulos.ok) setTehtavaVirhe(tulos.error || 'Koodia ei saatu.');
            return tulos.masterkoodi ?? null;
          }}
          // Työpöytäversiossa toiminnot ovat sivulla, koska kolmen pisteen valikkoa ei
          // ole. Mobiilissa tyhjä: siellä ne ovat valikossa.
          toiminnot={mobiili ? [] : tehtavanValinnat}
          onToiminto={tehtavanValinta}
        />
      ) : osio === 'tyontekijat' ? (
        <Tyontekijapankki
          tyontekijat={tyontekijat}
          ladattu={tyontekijatLadattu}
          saaMuokata={saaMuokataTyontekijoita}
          onTallenna={tallennaTyontekijat}
          onTakaisin={() => setOsio('etusivu')}
        />
      ) : osio === 'sijaintihistoria' ? (
        <Sijaintihistoria onTakaisin={() => setOsio('etusivu')} />
      ) : osio === 'tehtavanjako' ? (
        <Tehtavanjako onTakaisin={() => setOsio('etusivu')} />
      ) : osio === 'kalusto' ? (
        <Kalustopankki
          kalusto={pankki}
          kohteet={kohteet.map((k) => ({ id: k.id, nimi: k.name }))}
          // Työntekijäpankki on oman oikeutensa takana (global_employee_bank). Jos sitä ei
          // ole, lista on tyhjä eikä henkilölle voi luovuttaa — se on oikea lopputulos:
          // luovutustositteessa lukeva nimi ei saa olla käsin kirjoitettua arvausta.
          tyontekijat={tyontekijat
            .filter((t) => t.id && t.name)
            .map((t) => ({ id: t.id as string, nimi: t.name as string, displayId: t.displayId }))}
          saaHallita={saaHallitaPankkia}
          omaTunnus={session?.username || ''}
          omaNimi={session?.nickname || session?.username || ''}
          ladattu={pankkiLadattu}
          onMuuttui={paivitaPankki}
          onTakaisin={() => setOsio('etusivu')}
          avaaTunnus={skannattuKalusto}
          onAvausKasitelty={() => setSkannattuKalusto(null)}
        />
      ) : osio === 'halytyskeskus' ? (
        <Halytyskeskus
          kohteet={kohteet}
          lahteet={lahteet}
          kayttaja={session?.username || ''}
          saaKuitata={saaKuitataHalytyksia}
          oikeudet={{
            kierrokset: saaNahdaKierrokset,
            kalusto: saaNahdaKalustoa,
            tiedotteet: saaNahdaTiedotteet,
            sijainnit: saaNahdaSijainnit,
            raportit: saaNahdaRaportit,
          }}
          sijainnit={sijainnit}
          paneeli={HALKE_OSOITE.paneeli}
          taulu={HALKE_OSOITE.taulu}
          vartijaIkkuna={HALKE_OSOITE.vartija}
          yhteys={yhdistetty}
          paivitetty={halytyksetPaivitetty}
          sijaintiseuranta={session?.sijaintiseuranta === true}
          tehtavat={keskuksenTehtavat}
          saaMuokataTehtavia={saaMuokataTehtavia}
          onTehtavaMuutos={() => { paivitaKeskuksenTehtavat(); paivitaTehtavat(); }}
          onMuutos={paivitaHalytys}
          onVirkista={paivitaTilannekuva}
          // Kohderivistä pääsee kohteen valikkoon. Osio vaihtuu samalla kohteisiin,
          // koska valikon paluulinkki vie kohdelistaan — ja siksi tämä vaatii
          // oikeuden kohdelistaan, ettei linkki vie listaan jota ei saa nähdä.
          onAvaaKohde={saaNahda
            ? (kohde) => { setOsio('kohteet'); setValittuKohde(kohde); }
            : null}
          onTakaisin={paluuEtusivulle}
        />
      ) : raporttiKohde ? (
        <Raportit
          kohde={raporttiKohde.kohde}
          tyyppi={raporttiKohde.tyyppi}
          vartija={session?.nickname || ''}
          // Hälytystehtävälle kirjoitettu raportti on samalla poistumispyyntö: sen
          // jälkeen odotetaan hälytyskeskuksen hyväksyntää eikä palata kohdevalikkoon.
          onTallenna={raporttiKohde.tehtavaId
            ? (r) => tallennaTehtavanRaportti(r, raporttiKohde.tehtavaId as string)
            : tallennaRaportti}
          tallennaLabel={raporttiKohde.tehtavaId ? 'Lähetä raportti ja poistu' : undefined}
          onTakaisin={() => {
            const tehtavaId = raporttiKohde.tehtavaId;
            setRaporttiKohde(null);
            if (tehtavaId) setAvattuTehtava(tehtavaId);
          }}
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
          <TakaisinLinkki onClick={() => setKalustoKohde(null)}>Takaisin kohteeseen</TakaisinLinkki>
          <Kalusto
            ownerId={kalustoKohde.id}
            ownerNimi={kalustoKohde.name}
            avaimet={avaimet}
            poikkeamat={poikkeamat}
            // GUARD-puolella kohteen avaimet tulevat kalustopankista, joten vanhaa
            // avainrekisteriä ei muokata täältä lainkaan. Propsi on yhä olemassa
            // EVENT-puolta varten (src/App.tsx), jossa avainrekisteri jatkaa ennallaan.
            saaMuokataAvaimia={false}
            saaKasitellaPoikkeamia={saaKasitellaPoikkeamia}
            onAvaimetMuuttui={paivitaAvaimet}
            onPoikkeamatMuuttui={paivitaPoikkeamat}
            aloitusValilehti="avaimet"
            avainOtsikko="Kohteen kalusto"
            avainNakyma={saaNahdaVuoronKaluston ? (
              <KohteenKalusto
                kohde={{ id: kalustoKohde.id, nimi: kalustoKohde.name }}
                kalusto={pankki}
                ladattu={pankkiLadattu}
                omaTunnus={session?.username || ''}
                saaHallita={saaHallitaPankkia}
                saaPyytaa={saaNahdaPankin}
                omaEmployeeId={session?.employeeId || null}
                onMuuttui={paivitaPankki}
                onAvaa={setKohteenEsine}
              />
            ) : (
              <p className="text-sm text-ink-muted">
                Sinulla ei ole oikeutta kalustopankkiin. Varustepoikkeamat näkyvät toisella
                välilehdellä.
              </p>
            )}
          />
          {/* Kohteen kalustorekisteristä avattu esine. Sama kortti kuin pankissa — ilman
              muokkausoikeutta se näyttää tiedot ja historian mutta ei siirtonappeja. */}
          {kohteenEsine && (
            <KalustoKortti
              esine={pankki.find((e) => e.id === kohteenEsine.id) || kohteenEsine}
              kohteet={kohteet.map((k) => ({ id: k.id, nimi: k.name }))}
              tyontekijat={tyontekijat
                .filter((t) => t.id && t.name)
                .map((t) => ({ id: t.id as string, nimi: t.name as string }))}
              kantajat={pankki
                .filter((e) => (e.laji === 'ajoneuvo' || e.laji === 'avainkaappi') && e.tila !== 'poistettu')
                .map((e) => ({ id: e.id, nimi: `${e.nimi} (${e.tunnus})`, laji: e.laji as SijoitusLaji }))}
              kalusto={pankki}
              saaHallita={saaHallitaPankkia}
              omaTunnus={session?.username || ''}
              onMuuttui={paivitaPankki}
              onSulje={() => setKohteenEsine(null)}
              // Kilpitulostus on pankin toiminto: kilpiä tulostetaan arkillinen kerrallaan,
              // eikä kohdenäkymässä ole sitä valintalistaa johon arkki kootaan.
              onTulostaKilpi={() => { setKohteenEsine(null); setKalustoKohde(null); setOsio('kalusto'); }}
            />
          )}
        </div>
      ) : mittariKohde ? (
        <div className="max-w-5xl">
          <TakaisinLinkki onClick={() => setMittariKohde(null)}>Takaisin kohteeseen</TakaisinLinkki>
          <Mittaristo ownerId={mittariKohde.id} ownerNimi={mittariKohde.name} onKohde />
        </div>
      ) : jaksoKohde ? (
        <div className="max-w-5xl">
          <TakaisinLinkki onClick={() => setJaksoKohde(null)}>Takaisin kohteeseen</TakaisinLinkki>
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
          <TakaisinLinkki onClick={() => setTiedoteKohde(null)}>Takaisin kohteeseen</TakaisinLinkki>
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
          <TakaisinLinkki onClick={() => setPohjaNakyma(null)}>Takaisin kohteeseen</TakaisinLinkki>
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
          liikelupa={liikelupa}
          onLiikelupa={setLiikelupa}
          natiivi={natiivi}
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
          // Siirto koskee vain omaa käynnissä olevaa vuoroa TÄSSÄ kohteessa — ei
          // esimiehen selailemaa toista kohdetta, jossa "siirrä toiselle vartijalle"
          // ei tarkoittaisi mitään (kenen vuorosta?).
          vuoroKaynnissa={!!palvelimenVuoro && vuoroKohde?.id === kierrosKohde.id}
          vuoronPohjaIdt={vuoroKohde?.id === kierrosKohde.id
            ? (palvelimenVuoro?.pohjat || []).map((x) => x.id)
            : []}
          onSiirra={avaaSiirto}
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
          pohjat={pohjat.filter((po) => po.ownerId === lomake.id && !po.arkistoitu)}
          tiedostot={tiedostot.filter((t) => t.siteId === lomake.id)}
          onLisaaTiedosto={lisaaTiedosto}
          onPoistaTiedosto={poistaTiedosto}
          onLataaKartta={lataaKartta}
          saaMuokata={saaMuokata}
        />
      ) : valittuKohde ? (
        <Kohdenakyma
          kohde={valittuKohde}
          tiivistelmat={kohteenToiminnot(valittuKohde.id, lahteet, {
            tehtaviaMaaritelty: valittuKohde.tehtavat?.length || 0,
            kayttaja: session?.username || '',
          })}
          sallitut={{
            tehtavat: saaNahdaTehtavat && (valittuKohde.tehtavat?.length || 0) > 0,
            kierros: saaNahdaKierrokset,
            kierrospohjat: saaNahdaPohjat,
            kalusto: saaNahdaKalustoa,
            mittaristo: saaNahdaMittarit,
            jaksoraportit: saaNahdaJaksoraportit,
            tiedotteet: saaNahdaTiedotteet,
            ohjeet: saaNahdaOhjeet,
            skenaariot: saaNahdaSkenaariot,
            halytykset: saaNahdaHalytykset,
            toimenpide: saaKirjataToimenpiteen,
            ilmoitus: saaKirjataIlmoituksen,
            tiedot: saaNahdaTiedot,
          }}
          saaMuokata={saaMuokata}
          onValitse={(toiminto) => avaaToiminto(toiminto, valittuKohde)}
          onHallitse={() => setLomake({
            ...valittuKohde,
            perehdytykset: [...(valittuKohde.perehdytykset || [])],
            tehtavat: (valittuKohde.tehtavat || []).map((t) => ({ ...t, kohdat: [...t.kohdat] })),
          })}
          onPoista={() => setPoistettava(valittuKohde)}
          onTakaisin={() => setValittuKohde(null)}
        />
      ) : osio === 'etusivu' && mobiili ? (
        /* Mobiiliversion etusivu on vuoron työ, ei osiovalinta: kentällä ei valita
           työpöydän ja hälytyskeskuksen väliltä vaan tehdään se mitä vuoroon
           kuuluu. Ilman vuoroa kysytään ensin kohde — arvattu kohde tarkoittaisi
           että hätäpainike hälyttää väärän kohteen numeroihin. */
        vuoroKohde ? (
          <MobiiliEtusivu
            vuoronPohjaIdt={(palvelimenVuoro?.pohjat || []).map((x) => x.id)}
            vuoronTehtavaIdt={(palvelimenVuoro?.tehtavat || []).map((x) => x.id)}
            vuoroKaynnissa={!!palvelimenVuoro}
            lisataan={vuoroonLisataan}
            lisaysVirhe={lisaysVirhe}
            onLisaaVuoroon={lisaaOmaanVuoroon}
            onTeeSiirto={setTehtavaValmiiksi}
            siirrot={siirrot}
            siirtoVastataan={siirtoVastataan}
            onVastaaSiirtoon={vastaaSiirtoPyyntoon}
            kohde={vuoroKohde}
            pohjat={pohjat}
            kierrokset={kierrokset}
            halytykset={halytykset}
            halytystehtavat={tehtavat}
            kayttaja={session?.username || ''}
            onHalytystehtava={avaaTehtava}
            suoritukset={suoritukset}
            sallitut={{
              kierrokset: saaNahdaKierrokset,
              tehtavat: saaNahdaTehtavat,
              halytykset: saaNahdaHalytykset,
            }}
            onKierros={() => setKierrosKohde(vuoroKohde)}
            onTehtavat={() => setTehtavaKohde(vuoroKohde)}
            onHalytykset={() => setHalytysKohde(vuoroKohde)}
          />
        ) : (
          <Vuorovalinta
            kohteet={vuorovaihtoehdot}
            ladattu={vuorotLadattu}
            ilmanPerehdytysta={ilmanPerehdytysta}
            virhe={vuoroVirhe}
            aloittaa={vuoroaAloitetaan}
            onValitse={aloitaVuoro}
          />
        )
      ) : osio === 'etusivu' ? (
        <Etusivu
          saaNahdaKohteet={saaNahda}
          saaNahdaHalytyskeskus={saaNahdaHalytyskeskus}
          saaNahdaAsetukset={saaNahdaAsetukset}
          saaJakaaTehtavia={saaNahdaHalytyskeskus || !!isAdmin}
          saaNahdaKalusto={saaNahdaPankin}
          saaNahdaTyontekijat={saaNahdaTyontekijat}
          saaNahdaSijaintihistorian={saaNahdaSijaintihistorian}
          kohteita={kohteet.length}
          lauenneita={halytykset.filter((h) => h.tila === 'lauennut').length}
          ajastimia={halytykset.filter((h) => h.tyyppi === 'ajastin' && h.tila === 'kaynnissa').length}
          kierroksiaKesken={kierrokset.filter((k) => k.tila === 'kesken').length}
          kalustoa={pankki.filter((e) => e.tila !== 'poistettu').length}
          kalustopyyntoja={pankki.filter((e) => e.pyynto).length}
          kadonnuttaKalustoa={pankki.filter((e) => e.tila === 'kadonnut').length}
          onKohteet={() => setOsio('kohteet')}
          onKalusto={() => setOsio('kalusto')}
          onHalytyskeskus={() => setOsio('halytyskeskus')}
          onTehtavanjako={() => setOsio('tehtavanjako')}
          onTyontekijat={() => setOsio('tyontekijat')}
          onSijaintihistoria={() => setOsio('sijaintihistoria')}
          onAsetukset={() => setAsetuksissa(true)}
        />
      ) : (
        <>
          <TakaisinLinkki onClick={paluuEtusivulle}>Takaisin etusivulle</TakaisinLinkki>
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

          {/* Kohdelistalla on VAIN kohteet ja niiden perustiedot. Toiminnot ovat
              kohteen omalla sivulla (Kohdenakyma), koska kortin alareunaan ladottuna
              ne olivat kymmenen sanan rivi jossa jokainen sana oli eri työ — ja lista
              oli sitä sekavampi mitä enemmän oikeuksia käyttäjällä oli. */}
          {kohteet.length === 0 ? (
            <div className="bg-surface border border-line rounded-xl p-10 text-center">
              <Building2 className="w-10 h-10 text-ink-subtle mx-auto mb-4" strokeWidth={1.5} />
              <p className="text-sm text-ink-muted">
                {ladattu ? 'Yhtään kohdetta ei ole vielä lisätty.' : 'Ladataan kohteita…'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {kohteet.map((kohde) => (
                <button
                  key={kohde.id}
                  type="button"
                  onClick={() => setValittuKohde(kohde)}
                  className="text-left bg-surface border border-line hover:bg-sunken hover:border-line-strong rounded-xl p-5 transition-colors flex items-start gap-3"
                >
                  <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink-strong">{kohde.name}</span>
                    {(kohde.contactName || kohde.contactPhone) && (
                      <span className="block text-sm text-ink-body mt-1">
                        {[kohde.contactName, kohde.contactPhone].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {kohde.address && (
                      <span className="block text-sm text-ink-muted mt-0.5">{kohde.address}</span>
                    )}
                  </span>
                  <ChevronRight size={18} className="text-ink-subtle shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );

  // Mobiiliversio (/guard/mobile). Kehys tuo oman palkkinsa, sivuvalikkonsa ja
  // pikavalikkonsa. Kamera ja tilatieto ovat kehyksen sisällä, koska ne peittävät koko
  // puhelimen ruudun — ne eivät ole näkymiä joihin navigoidaan vaan päällekkäisiä
  // työkaluja jotka suljetaan siihen mistä ne avattiin.
  if (mobiili) {
    return (
      <MobiiliKehys
        otsikko={nakymanNimi}
        vuoro={vuoro ? { nimi: vuoroKohde?.name || vuoro.kohdeNimi, alkoi: vuoro.alkoi } : null}
        ilmoitukset={mobiiliIlmoitukset}
        onIlmoitus={avaaIlmoitus}
        linkit={mobiiliLinkit}
        onLinkki={avaaMobiiliLinkki}
        mandown={mandown}
        mandownMin={mandownMin}
        // Sama ehto kuin useSijainninLahetys-kutsussa, eikä pelkkä session-lippu: ilman
        // aktiivista kohdetta selain ei lähetä mitään, ja "näkyy hälytyskeskukselle"
        // olisi silloin väärä lupaus kumpaankin suuntaan.
        sijaintiPaalla={session?.sijaintiseuranta === true && !!aktiivinenKohde}
        aaniValittu={aaniValittu}
        aaniArmed={aaniArmed}
        onAani={vaihdaAani}
        liikelupa={liikelupa}
        natiivi={natiivi}
        onKamera={() => setKameraAuki(true)}
        onTilatieto={saaKirjataToimenpiteen && vuoroKohde ? () => setTilatietoAuki(true) : null}
        onPaataVuoro={vuoro ? paataVuoro : null}
        onTyopoyta={vaihdaTyopoydalle}
        onLogout={kirjauduUlos}
        pikavalinnat={tehtavanValinnat}
        onPikavalinta={tehtavanValinta}
        // Avatusta hälytystehtävästä palataan, ei avata sivuvalikkoa.
        onTakaisin={avattu ? () => setAvattuTehtava(null) : null}
      >
        {runko}
        {kameraAuki && (
          <Skanneri onLoytyi={kasitteleSkannaus} onSulje={() => setKameraAuki(false)} />
        )}
        {tilatietoAuki && vuoroKohde && (
          <Tilatieto
            kohdeNimi={vuoroKohde.name}
            onLaheta={lahetaTilatieto}
            onSulje={() => setTilatietoAuki(false)}
          />
        )}
      </MobiiliKehys>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {ylapalkki(nakymanNimi)}

      <main className="flex-1 p-6 md:p-10">
        <div className="max-w-5xl mx-auto">
          {runko}
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
