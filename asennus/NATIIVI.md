# Natiivisovellus GUARDin rinnalle — v1:n määrittely

Tämä tiedosto määrittelee sen natiivin osan, joka lisätään `twa-guard`-projektiin
(Bubblewrapin tuottama tavallinen Android-projekti). Se sulkee `LUEMINUT.md`:n avoimet
kohdat **7 (push-ilmoitukset)** ja **8 (sijaintiseurannan juridiikka)**, ja vastaa
samalla siihen rajaukseen jonka `src/shared/sijainninLahetys.ts` kirjaa omaan
kommenttiinsa: selain ei voi paikantaa taustalla lukitulla näytöllä.

**Käyttöliittymä pysyy sivustolla.** Natiivi ei piirrä näkymiä, ei hae kohdelistoja
eikä tallenna kirjauksia. Se tekee viisi asiaa joita Chrome ei saa tehdä, ja yhden
asian jota kotinäytöllä ei muuten ole: widgetin.

## Työnjako

| Ominaisuus | Missä | Miksi siellä |
|---|---|---|
| Kaikki näkymät, kirjaukset, kierrokset, raportit | web | Yksi käyttöliittymä, ei kahta |
| QR- ja viivakoodiskanneri | web | `BarcodeDetector` on Chromessa, ei WebViewissä |
| Lähtevä jono | web | `src/shared/jono.ts` idempotenssi on jo kunnossa; kaksi jonoa samalle kirjaukselle on kaksoislähetys |
| Wake Lock, kamera, tulostus | web | Toimivat jo, eivät parane natiivissa |
| Vuoron taustapalvelu | natiivi | Chrome pysäyttää JavaScriptin sekunneissa |
| Sijainti taskussa olevasta puhelimesta | natiivi | Sama syy |
| Man-down | natiivi | Kiihtyvyysanturi ei kuulu taustalla |
| Hälytys lukitusruudun päälle | natiivi | Webillä ei ole full-screen intentiä |
| Hätäpainike ilmoituksesta ja pika-asetuksista | natiivi | Sovellusta ei tarvitse avata |
| Apupyyntö-widget kotinäytöltä | natiivi | Widgetit ovat natiivin yksinoikeus |
| Laitesidonta | natiivi | Android Keystore; selaimessa tämä ei ole mahdollista |

## Perusta 1: laitesidonta ja silta

Natiivipuoli tarvitsee oman pääsyn palvelimelle. TWA on Chrome, ja istunto on Chromen
HttpOnly-evästeessä (`server/istunto.js`) — taustapalvelu ei näe sitä. Sovellus **ei
silti kirjaudu itse**: kaksi kirjautumislomaketta samalle tunnukselle tarkoittaisi, että
vartija syöttää salasanan ja Authenticator-koodin kahdesti, ja että TOTP-logiikka on
kahdessa paikassa.

Sidonta tehdään kertaluonteisesti:

1. Vartija kirjautuu normaalisti web-käyttöliittymässä. Mikään ei muutu.
2. Sovellus luo Android Keystoreen laitekohtaisen avainparin (`EC P-256`, StrongBox jos
   laite tukee). Yksityinen avain ei poistu laitteesta eikä ole kopioitavissa toiseen
   puhelimeen.
3. Web pyytää `POST /api/laite/sido` ja saa kertakäyttöisen, lyhytikäisen sidontakoodin.
4. Web avaa `turvajohto-guard://sido#koodi=…`. Chrome laukaisee intentin ja palaa
   sivulle; sovelluksen `SiltaActivity` ottaa koodin vastaan.
5. Sovellus kutsuu `POST /api/laite/rekisteroi` koodilla ja julkisella avaimella.
   Palvelin tallentaa julkisen avaimen, laitteen mallin ja sidonta-ajan.
6. Jokainen myöhempi pyyntö allekirjoitetaan avaimella.

**Laitteella EI ole tokenia, ja se on tietoinen muutos alkuperäiseen suunnitelmaan.**
Ensimmäinen muotoilu antoi sovellukselle istuntotokenin. Se hylättiin toteutuksessa,
koska pyyntö on joka tapauksessa allekirjoitettava: token olisi vain toinen tunniste
saman asian päälle ja samalla ainoa laitteella oleva salaisuus jonka voisi varastaa. Nyt
laitteella ei ole levyllä mitään salaista — laitetunnus on julkinen ja avain on
Keystoressa.

### Mitä sidonta suojaa ja mitä ei

Avain **ei vaadi käyttäjän tunnistautumista** (`setUserAuthenticationRequired(false)`).
Tämä on pakko, ei valinta: vuoropalvelun on allekirjoitettava sijainti ja
man-down-hälytys kello kolme yöllä puhelin taskussa ja ruutu lukittuna. Auth-vaatimus
tekisi allekirjoituksesta mahdottoman juuri siinä tilanteessa jota varten koko sovellus
on olemassa.

Siitä seuraa raja joka on sanottava ääneen: **sidonta suojaa avaimen kopioimiselta
toiseen laitteeseen, ei laitteen anastukselta.** Varastettu ja avattu puhelin on pääsy
järjestelmään.

Aiempi muotoilu tässä tiedostossa väitti, että `server/istunto.js`:n ehto "käyttäjä
lukitsee laitteen vahvalla salasanalla" muuttuu laitesidonnan myötä organisatorisesta
tekniseksi. **Se ei pidä paikkaansa.** Ehto pysyy organisatorisena täsmälleen niin kuin
`istunto.js` sen kirjaa, ja sen rinnalla on hälytyskeskuksen tekemä nollaus.
Pakkouloskirjaus toimii silti: `session_invalidated_at` verrataan laitteen
SIDONTA-hetkeen, joten ennen mitätöintiä sidottu laite lakkaa kelpaamasta samalla
sekunnilla kuin selainistunnotkin.

**Kertakäyttökoodi ei ole mikään uusi luottamussuhde.** Se on lyhytikäinen ja syntyy
vain kirjautuneelle selainistunnolle. Se mitä sovellus saa, on täsmälleen se mikä
selaimella jo oli.

### Sidonnan säännöt (päätetty 9.9.2026)

| Sääntö | Päätös |
|---|---|
| Kuka sitoo | **Vartija itse** omalla tunnuksellaan, ilman pääkäyttäjän hyväksyntää |
| Laitteita tunnusta kohden | **Yksi** |
| Laitteen vaihto | **Hälytyskeskus nollaa sidonnan**, minkä jälkeen vartija sitoo uuden laitteen itse |

Vartija sitoo itse, koska kirjautuminen on jo todistanut henkilöllisyyden: pääkäyttäjän
hyväksyntä ensimmäiselle laitteelle tarkoittaisi, että uusi vartija ei pääse vuoroon
ennen kuin joku toinen herää vastaamaan. Yksi laite tunnusta kohden on sekä selkein
("tämä on minun työpuhelimeni") että ainoa jossa "istunto on sidottu laitteeseen"
tarkoittaa oikeasti jotain.

Yhden laitteen raja vaatii purkutien, koska puhelin hajoaa ja vaihtuu. Se on
**hälytyskeskuksella** eikä vain pääkäyttäjällä: laite vaihdetaan keskellä yötä
vuoron alussa, ja se on sama joukko joka muutenkin vastaa kentästä silloin.
Oikeustarkistus on siis pääkäyttäjä **tai** `guard_dispatch`-muokkausoikeus
(`server/permissions.js`), ei `requireAdmin`.

Nollaus on nimenomaan **sidonnan purku eikä uuden laitteen hyväksyntä**: hälytyskeskus ei
näe eikä valitse uutta laitetta, vaan poistaa vanhan ja jättää tilan auki seuraavalle
sidonnalle. Tämä pitää nollauksen turvallisena toimintona — väärin käytettynä se
pahimmillaan pakottaa vartijan sitomaan laitteen uudelleen, eikä anna kenellekään pääsyä
mihinkään. Molemmat päät kirjataan audit-lokiin (`laite_sidottu`, `laite_nollattu`).

## Perusta 2: vuoropalvelu

Vuoropalvelu (foreground service) on astia jossa kaikki muu ajaa. Pysyvä ilmoitus:
**"Vuoro käynnissä · Mäntytie 4"**, jossa on hätäpainike ja "Päätä vuoro".

Elinkaari sidotaan siihen vuoroon joka on jo olemassa laitteen tilana
(`src/guard/mobiili/vuoro.ts`): palvelu käynnistyy kun vartija valitsee kohteen ja
sammuu kun vuoro päätetään, uloskirjautumisesta tai vuoron 24 tunnin vanhenemisesta.
Vuoroa **ei** käynnistetä uudelleen itsestään puhelimen käynnistyttyä: sovellus näyttää
ilmoituksen "Vuoro oli kesken klo 02:14 — jatka?" ja odottaa ihmistä. Itsestään
jatkuva vuoro väittäisi valvovansa jotakuta joka ei ole töissä.

Palvelutyypiksi ilmoitetaan `location|specialUse`. `location` kattaa sijainnin;
`specialUse` on siinä, että man-downin on toimittava myös silloin kun
sijaintiseuranta on organisaatiotasolla pois päältä (`seurantaKaytossa()`). Molemmille
on annettava oma perustelu Play Consolessa.

**`ACCESS_BACKGROUND_LOCATION`-lupaa ei pyydetä eikä tarvita.** Kun palvelu
käynnistetään etualalta ja sen tyyppi on `location`, sijainti saadaan ilman Play-kaupan
tiukimmin valvottua lupaa ja sen erillistä arviointikierrosta. Tämä ei ole pelkkä
kiertotie vaan vastaa tarkalleen nykyistä linjaa: sijaintia on olemassa vain vuoron
aikana. `LUEMINUT.md`:n kohdan 8 huoli koskee siis pienempää lupaa kuin siinä
arvioitiin.

Pysyvä ilmoitus on myös se läpinäkyvyys jota työntekijöiden sijaintitiedon käsittely
vaatii: vartija näkee koko ajan, milloin vuoro on käynnissä — eikä sijaintia kulje
silloin kun ilmoitusta ei ole.

## Ominaisuus 1: sijainnin taustapäivitys

Protokolla on jo olemassa: kanavaviesti `{ tyyppi: 'sijainti', eventId, gps, img }`,
jonka `server/kanava.js` osaa ottaa vastaan. Natiivi lähettää samaa viestiä samaan
osoitteeseen — palvelimelle ei tule uutta sijaintirajapintaa.

- Lähde: `FusedLocationProviderClient`, `PRIORITY_BALANCED_POWER_ACCURACY`, väli 60 s.
- Tarkkuusvaatimus tulee palvelimelta: `server/geofence.js` hylkää yli 50 m tarkkuuden.
  Natiivi ei suodata itse — yksi sääntö yhdessä paikassa.
- Kuvakoordinaattia (`img`) natiivi **ei** laske. Georeferointi on
  `src/shared/georeferointi.ts`:ssä ja sen kaksoiskappale kartalla ja vyöhykesäännössä
  erkanisi; natiivi lähettää pelkän GPS:n, ja vuoron aikana auki oleva web täydentää
  kuvakoordinaatin niin kuin nytkin.

Tämä herättää vyöhykesäännöt oikeasti eloon. `server/geofence.js` on valmis kolmen
väärähälytyssuojansa kanssa; se ei vain saa nyt pingejä taskussa olevalta puhelimelta.

## Ominaisuus 2: man-down natiivina

Algoritmi on olemassa ja testattu: `src/shared/mandown.ts` (`ISKU_RAJA 25`,
`LIIKKUMATTA_POIKKEAMA 0.6`, `ISKUN_JALKEEN_MS 12 s`, `NAYTEVALI_MS 250`,
`VASTAUSAIKA_MS 30 s`). Se portataan Javaan **samoilla vakioilla ja samoilla
testivektoreilla**. Perustelu on sama kuin `server/geofence.js`:n säteenheiton
kaksoiskappaleessa: kaksi toteutusta erkanee, ja silloin sama kaatuminen tunnistettaisiin
puhelimessa ja jätettäisiin tunnistamatta selaimessa.

Anturi kuunnellaan `SENSOR_DELAY_NORMAL`-nopeudella ja näytteistetään samalla 250 ms:n
välillä kuin webissä. Epäily → täysruutukysely (ominaisuus 3) → 30 s vastausaika →
`POST /api/halytys` tyypillä `mandown`. Web-puolen `Halytysvahti` jää paikalleen
sellaisenaan: se on oikea toteutus silloin kun sovellus on auki ruudulla, ja kaksi
rinnakkaista epäilyä estetään sillä, että natiivipalvelu on ainoa joka laukaisee kun
vuoro on käynnissä.

## Ominaisuus 3: täysruutuhälytys

Oma Activity lukitusruudun päälle: `setShowWhenLocked`, `setTurnScreenOn`,
hälytysäänivirta, värinäkuvio, ja vain kaksi painiketta — "Olen kunnossa" ja "Hälytä".

Tähän liittyy reunaehto joka on hyvä tietää etukäteen: Android 14 antaa
`USE_FULL_SCREEN_INTENT`-luvan automaattisesti vain puhelin- ja herätyssovelluksille.
Muut ohjataan myöntämään se asetuksista, ja Play kysyy siitä erillisellä lomakkeella.
Turvallisuussovellus on uskottava perustelu, mutta **päätös ei ole meidän**, joten:

- ilman lupaa hälytys putoaa heads-up-ilmoitukseksi, jolla on silti hälytysääni ja
  värinä — se ei katoa, se vain ei täytä ruutua
- luvan tila näkyy diagnostiikkanäkymässä, eikä sovellus väitä valvovansa enempää kuin
  se luvilla kykenee
- häiriötilan ohitus (`setBypassDnd`) vaatii käyttäjän erikseen myöntämän
  ilmoituskäytäntöoikeuden; sekin kuuluu samalle tarkistuslistalle

## Ominaisuus 4: pakotetut ilmoitukset ilman FCM:ää

Koska vuoropalvelu pitää joka tapauksessa autentikoitua WebSocket-yhteyttä
(`/api/kanava`), hälytykset, tiedotteet ja apupyynnöt tulevat sitä pitkin. **Ei
VAPID-avaimia, ei Firebase-projektia, ei ulkopuolista välittäjää hälytysketjussa.** Sama
perustelu kuin `sw-pohja.js`:ssä: kirjasto otetaan kun ongelma on kirjaston kokoinen.

FCM tarvitaan vasta yhteen asiaan: vartijan tavoittamiseen silloin kun hänen vuoronsa
**ei** ole käynnissä. Se on oma päätöksensä eikä v1:ssä. Rajaus on kirjattava näkyviin
myös vartijalle — "vuoron ulkopuolella sovellus ei hälytä" on tieto jonka puuttuminen
on vaarallista.

## Ominaisuus 5: hätäpainike sovelluksen ulkopuolelta

Kaksi paikkaa, joista kumpikaan ei vaadi sovelluksen avaamista:

- **pysyvän ilmoituksen painike** — puhelin taskusta, ilmoitusvalikko alas, yksi painallus
- **pika-asetusruutu** (Quick Settings tile) — näkyy myös lukitusruudulta

Molemmat vaativat vahvistuksen: painallus vaihtaa painikkeen tilaan "Vahvista · 5 s".
Webissä sama turva on pitkä painallus (`server/halytys.js` viittaa siihen `panic`-tyypin
kommentissa). `panic` eskaloituu nollaviiveellä, joten vahingossa lähtenyt hälytys
lähettää tekstiviestit heti — siksi vahvistus, ja siksi se on silti vain yksi painallus
lisää.

## Ominaisuus 6: apupyyntö-widget

Kotinäytön widget, jolla vartija pyytää **tukea** ilman että kyse on hädästä: uhkaava
asiakas, ovi jota ei saa yksin kiinni, tilanne jossa toinen ihminen riittää. Tämä on
uusi käsite eikä mikään nykyinen hälytystyyppi vastaa sitä.

### Uusi hälytystyyppi

`server/halytys.js` → `TYYPIT`:

```
apupyynto: {
  label: 'Apupyyntö',
  // Viisi minuuttia, ja eskalointi peruuntuu kuittaukseen: kun joku vahvistaa
  // tulevansa, tekstiviestejä ei tarvita. Jos kukaan ei vastaa viidessä minuutissa,
  // "en ole hädässä, tarvitsen toisen ihmisen" on muuttunut tilanteeksi jossa
  // kenenkään ei tiedetä olevan tulossa.
  eskalointiViiveMs: 5 * 60 * 1000,
  eskaloi: true,
}
```

Olemassa oleva koneisto riittää sellaisenaan: `luoHalytys` syntyy tilassa `lauennut`,
ja eskalointikierros ohittaa kuitatut (`server/halytys.js` rivi ~273). Vartijan
"olen tulossa" on siis tavallinen kuittaus, ja se sekä pysäyttää tekstiviestit että
kertoo pyytäjälle kuka on tulossa.

Vastaavat lisäykset: `HalytysTyyppi` ja `TYYPPI_LABEL` tiedostossa
`src/shared/halytykset.ts`, ja näkyminen `src/guard/Halytyskeskus.tsx`:ssä.

### Kohdistus lähimpiin

Apupyyntö eroaa muista hälytyksistä siinä, että se **kohdistuu**: palvelin laskee
`server/index.js`:n `/api/lahin`-logiikalla lähimmät vartijat samassa kohteessa ja
lähettää heille kanavaviestin, joka avaa heidän puhelimessaan ilmoituksen
"Apupyyntö · Mäntytie 4 · 120 m · [Olen tulossa]". Valvomo näkee pyynnön aina, niin kuin
kaikki hälytykset. Ilman GPS:ää etäisyyttä ei voi laskea, ja silloin pyyntö menee
kaikille kohteen vartijoille — se on oikea epävarmuuden suunta.

### Widgetin muoto

`AppWidgetProvider` + `RemoteViews`. Glance olisi nykyaikaisempi tapa, mutta se vaatii
Composen ja Kotlinin — eikä kumpikaan ole käytettävissä (ks. kielivalinta erässä 10).
Widget on yksi tilarivi ja yksi painike, joten menetettävää ei ole.

| Vuoron tila | Widget näyttää |
|---|---|
| Ei vuoroa | "Vuoro ei käynnissä" harmaana, painike ei reagoi |
| Vuoro käynnissä | Kohteen nimi + **Pyydä apua** |
| Painike painettu | **Vahvista · 5 s**, palautuu itsestään |
| Pyyntö lähetetty | "Apupyyntö lähetetty 14:02" |
| Joku vahvisti | "Matti tulossa · 120 m" |
| Lähetys epäonnistui | "Ei lähtenyt — avaa sovellus" |

Kaksi viimeistä riviä ovat tärkeitä. Widget joka sanoo "lähetetty" silloin kun pyyntö ei
lähtenyt on pahempi kuin widget jota ei ole, koska se veisi ihmiseltä sen tiedon että
hänen on tehtävä asialle jotain itse — sama perustelu jolla `src/shared/halytykset.ts`
jättää hälytykset kokonaan pois lähtevästä jonosta. Widgetin tila päivitetään
vuoropalvelusta heti, ei widgetin omalla päivitysvälillä.

**Hätäpainiketta ei laiteta widgetiin.** Kaksi painiketta vierekkäin kotinäytöllä
tarkoittaa, että pimeässä hanskat kädessä painetaan väärää — ja väärä suunta on se,
jossa apupyyntöä tarkoittava painallus lähettää tekstiviestit koko eskalointilistalle.
Hätäpainike on ilmoituksessa ja pika-asetuksissa, joissa tarkoitus on yksiselitteinen.

## Palvelinmuutokset

| Muutos | Tiedosto |
|---|---|
| `POST /api/laite/sido` — kertakäyttökoodi kirjautuneelle selainistunnolle | `server/index.js` |
| `POST /api/laite/token` — koodi + julkinen avain → laitetoken | `server/index.js` |
| Laitetokenin hyväksyntä `requireAuth`-polulla ja `/api/kanava`-kättelyssä | `server/istunto.js`, `server/kanava.js` |
| Laitelista ja sidonnan nollaus (pääkäyttäjä tai `guard_dispatch`) | `server/index.js`, `server/permissions.js`, `src/shared/asetukset/Kayttajat.tsx` |
| `session_invalidated_at` mitätöi myös laitetokenit | `server/istunto.js` |
| Uusi hälytystyyppi `apupyynto` + kohdistus lähimpiin | `server/halytys.js`, `server/index.js` |
| Audit: `laite_sidottu`, `laite_nollattu`, `apupyynto_lahetetty` | `server/audit.js`-kutsut |
| Sidontakoodille oma nopeusrajoitin | `server/index.js` |
| Sydämenlyönnin kirjaus: `viimeinenLyonti` + `valvontaElossa` (ks. päivätesti 10.9.) | `server/laite.js`, `server/index.js` |
| Valvonnan tila päivystäjän laitelistalla | `src/shared/asetukset/Laitteet.tsx` |

Hälytys- ja sijaintipolut **eivät muutu**. Natiivi puhuu samaa rajapintaa kuin selain.

## Luvat ja Play-politiikka

| Asia | Huomio |
|---|---|
| `POST_NOTIFICATIONS` | Android 13+, ajonaikainen. Ilman tätä mikään hälytys ei näy |
| `ACCESS_FINE_LOCATION` | Ajonaikainen, pyydetään vuoron alkaessa |
| `ACCESS_BACKGROUND_LOCATION` | **Ei pyydetä.** Etualalta käynnistetty palvelu riittää |
| `FOREGROUND_SERVICE_LOCATION`, `..._SPECIAL_USE` | Perustelu Play Consoleen kumpaankin |
| `USE_FULL_SCREEN_INTENT` | Play-lomake; ilman lupaa heads-up-varatie |
| `ACCESS_NOTIFICATION_POLICY` | Vain häiriötilan ohitukseen, käyttäjä myöntää |
| `RECEIVE_BOOT_COMPLETED` | Vain "jatka vuoroa?" -ilmoitukseen, ei automaattiseen jatkoon |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Ohjataan käyttöönotossa |
| Data safety -lomake | `asennus/KAUPPA.md` päivitettävä: sijainti taustapalvelussa, anturidata |
| `assetlinks.json` | Sama allekirjoitustiiviste kuin nyt; sidonta ei muuta tätä |

Samsungin ja Xiaomin omat akkuoptimoinnit on kytkettävä pois käsin — pelkkä
`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` ei riitä niillä. Tämä kuuluu käyttöönotto-ohjeeseen
ja diagnostiikkanäkymän tarkistuslistalle, koska se on yleisin syy siihen että hälytys
ei tule.

## Juridiikka (sulkee LUEMINUT.md kohdan 8)

Taustasijainti on natiivin myötä teknisesti mahdollinen, joten nämä on ratkaistava
**ennen ensimmäistä oikeaa kenttäkäyttöä** — eivät ohjelmistolla:

- **Yhteistoimintamenettely.** Työntekijöiden sijaintitiedon käsittely on
  yhteistoimintalain piirissä. Käsiteltävä ennen käyttöönottoa.
- **Tietosuojaseloste.** `public/tietosuoja.html` kohta 4 (käsittelyperusteet) ja kohta
  sijaintitiedosta päivitettävä: mitä kerätään (GPS ja tarkkuus vuoron aikana),
  kuinka kauan säilytetään, kuka näkee.
- **Vaikutustenarviointi (DPIA).** Järjestelmällinen työntekijöiden sijainnin seuranta
  on GDPR 35 artiklan mukainen todennäköinen DPIA-tapaus. Arvioitava asiantuntijan
  kanssa.
- **Läpinäkyvyys käytännössä.** Pysyvä ilmoitus, uloskirjautuminen unohtaa sijainnin
  (`server/index.js` `/api/logout`), ja vuoron ulkopuolella dataa ei synny. Tämä on
  vahva lähtökohta — mutta se on kirjattava selosteeseen, ei vain koodiin.
- **Man-downin anturidata.** Kiihtyvyysanturin lukemia ei lähetetä palvelimelle
  lainkaan: vain syntynyt hälytys. Tämä kannattaa sanoa selosteessa ääneen, koska
  oletus on toinen.

## Mitä v1 ei sisällä

| Rajattu pois | Miksi |
|---|---|
| FCM | Vuoron aikana WebSocket riittää; vuoron ulkopuolinen tavoittaminen on oma päätös |
| NFC-kierrospisteet | Aito natiivivoitto (toimii sovellus kiinni), mutta v2 |
| Diagnostiikkanäkymä | v1:ssä minimi: lupalista. Täysi "miksi hälytys ei tullut" -näkymä v2 |
| BLE-majakat, body cam | Oma tuote, ei lisäosa |
| Kioskitila, MDM, Play Integrity | Ei ratkaise yhtään todellista ongelmaa tässä |
| WebView-kuori | Hajottaisi QR-skannerin (`BarcodeDetector` puuttuu WebViewistä) |
| iOS | TWA on Android-tekniikka; iOS on oma ratkaisunsa eikä tämän muunnelma |

## Koko

Mitat ovat laskettu, eivät arvattu. Nykyinen järjestelmä (9.9.2026):

| Mitä | Määrä |
|---|---|
| `src/` (TypeScript ja React) | 35 950 riviä |
| `server/` (Node) | 13 312 riviä |
| Testitiedostoja | 29 |
| Committeja | 160, ajalla 11.8.–9.9.2026 |
| `twa-guard` natiivikoodia | **291 riviä**, yksi riippuvuus (`androidbrowserhelper`) |

Natiivi v1 lisää arviolta **4 800–5 500 riviä**, eli noin kymmenen prosenttia nykyiseen.
Jakauma: Android ~3 300, palvelin ~750 (+ testit), web ~600. Suhdeluku on se olennainen
tieto: **natiivi on pieni verrattuna siihen mitä se mahdollistaa**, koska käyttöliittymää
ei kirjoiteta uudelleen.

Työ on myös lähes kokonaan **lisäävää**. Koko v1 koskettaa nykyisestä webistä vain
neljää tiedostoa (`src/shared/halytykset.ts`, `src/guard/Halytyskeskus.tsx`,
`src/shared/asetukset/Kayttajat.tsx`, kirjautumisnäkymä) — eikä lainkaan sitä
12 394 rivin `src/App.tsx`:ää, joka on repon raskain tiedosto. Tämä on syy siihen, että
erät voidaan tehdä peräkkäin ilman että web hajoaa välissä.

## Toteutusjärjestys: erät 10–15

Numerointi jatkaa kehityseriä (erät 1–9 ovat tehty). Se on eri asia kuin
`LUEMINUT.md`:n **kohdat 1–8**, jotka ovat Android-edellytyslista — älä sekoita näitä.

### Miksi tämä järjestys

Kolme asiaa on **tuntemattomia**, ja jokainen niistä voi tehdä osan työstä turhaksi jos
se selviää vasta lopussa:

1. **Pysyykö foreground service pystyssä yön yli oikealla puhelimella?** Samsungin ja
   Xiaomin akkuoptimoinnit tappavat palveluita valmistajan omilla säännöillä. Jos
   palvelu kuolee kolmen tunnin jälkeen, man-down ja sijainti ovat arvottomia — ja ne on
   rakennettu sen päälle.
2. **Myönnetäänkö `USE_FULL_SCREEN_INTENT`?** Päätös on Playn, ei meidän, ja se
   määrää miltä erän 12 hälytys näyttää.
3. **Läpäiseekö allekirjoitettu laitetoken nginxin ja WebSocket-kättelyn?**

Siksi järjestys on tällainen: **erä 10 on pystysuora viipale**, joka ei tee yhtään
ominaisuutta valmiiksi mutta todistaa kohdat 1 ja 3. Vasta sen jälkeen kannattaa
kirjoittaa riviä man-downia.

### Erä 10 — Perusta: silta, laitesidonta, vuoropalvelu

Suurin erä, ja ainoa jota ei voi pilkkoa: sidonta ilman palvelua ei tee mitään, eikä
palvelu ilman sidontaa pääse palvelimelle.

| Osa | Uutta |
|---|---|
| Gradle: `:natiivi`-moduuli, `minSdk 21 → 28` | ~150 |
| `Laiteavain.java` — Keystore, StrongBox, allekirjoitus | ~180 |
| `SidontaActivity.java` + `turvajohto-guard://`-intent | ~120 |
| `Api.java` — OkHttp, allekirjoitetut pyynnöt | ~200 |
| `VuoroService.java` — foreground service, pysyvä ilmoitus, elinkaari | ~280 |
| Palvelin: `/api/laite/sido`, `/api/laite/token`, tokenin tarkistus, laitelista, mitätöinti, audit, rate limit | ~350 + testit ~200 |
| Web: sidontapainike ja laitteen tila · käyttäjähallinnan laitelista | ~270 |

**Valmis kun:** puhelin on sidottu, vuoro käynnistyy, ja palvelimen lokissa näkyy
sydämenlyönti **kahdeksan tunnin yhtäjaksoisen vuoron yli** Samsung- tai
Xiaomi-puhelimella akkuoptimointi pois kytkettynä — ja toinen ajo sen ollessa päällä,
jotta tiedetään kumpi niistä on pakollinen käyttöönoton ehto.

`minSdk` on nostettava 28:aan (Android 9, 2018): laitteen lukitukseen sidotut
Keystore-avaimet, StrongBox, ilmoituskanavat ja pika-asetusruutu edellyttävät sitä. 21
on Bubblewrapin oletus eikä harkittu valinta.

#### Natiivikoodi omaan Gradle-moduuliin

`app/AndroidManifest.xml`, `app/build.gradle` ja juuren `build.gradle` ovat **Bubblewrapin
generoimia** — manifestissa on yhä templaten tyhjät lohkot, ja `gradle.properties`:ssa on
jo varoitus siitä että `bubblewrap update` palauttaa arvot. Natiivikoodi ei siis voi asua
niissä.

Ratkaisu on oma kirjastomoduuli `:natiivi`, jonka manifesti **yhdistetään** app-moduulin
manifestiin käännöksessä: luvat, palvelu ja activity asuvat meidän omistamassamme
hakemistossa. Myös Kotlin-liitännäinen haetaan moduulin omassa `buildscript`-lohkossa
eikä juuren tiedostossa. Generoituihin tiedostoihin jää **kaksi riviä**:
`include ':natiivi'` ja `implementation project(':natiivi')`. Jos päivitys pyyhkii ne,
käännös hajoaa äänekkäästi — se on parempi kuin hiljaa katoava palvelu.

Käännösympäristö on Bubblewrapin oma: JDK 17 (`~/.bubblewrap/jdk`) ja SDK
(`~/.bubblewrap/android_sdk`, android-36). Android Studion JDK on 25, jota Gradle 8.11.1
ei tue — polku on kirjattu `local.properties`:iin.

#### Erä 10 jakautuu kolmeen osaan

Osa 1 vastaa kalleimpaan kysymykseen ilman että palvelinta tarvitaan lainkaan. Jos
palvelu ei selviä yöstä, osia 2 ja 3 ei kannata kirjoittaa siinä muodossa.

| Osa | Sisältö | Todistaa |
|---|---|---|
| **1. Vuoropalvelu ja mittari** | `:natiivi`-moduuli, `VuoroService`, pysyvä ilmoitus, herätelukko, sydämenlyönti laitteen lokiin, `SiltaActivity` | Palvelu pysyy pystyssä yön yli |
| **2. Laitesidonta ja palvelinrajapinta** | Keystore-avain, `/api/laite/sido`, `/api/laite/token`, allekirjoitetut pyynnöt, laitelista | Token kelpaa nginxin läpi |
| **3. Sydämenlyönti palvelimelle** | Paikallinen loki vaihtuu palvelinkutsuun, vuoro käynnistyy web-käyttöliittymästä | Koko ketju päästä päähän |

**Osat 1 ja 2 on toteutettu 9.9.2026.**

Osa 1: `twa-guard/natiivi/`, vuoropalvelu ja mittari.

Osa 2: palvelimella `server/laite.js` ja sen 18 testiä, reitit `/api/laite/sido`,
`/rekisteroi`, `/oma`, `/tila`, `/api/laitteet` ja `/api/laite/:id/nollaa`, kokoelmat
`devices` ja `deviceCodes`. Sovelluksessa `Laiteavain`, `Api`, `Sidonta` ja
`SiltaActivity`n `sido`-haara. Webissä `src/shared/laitteet.ts`, vartijan
`LaiteSidonta`-kortti vuorovalinnassa ja hälytyskeskuksen laitelista asetuksissa.

Palvelinpuoli on **tuotannossa 10.9.2026** (commit `f40d459`). Forgejon post-receive
rakentaa sivuston ja päivittää myös backendin, joten API-reitit tulivat voimaan samalla
pushilla — erillistä uudelleenkäynnistystä ei tarvittu.

Osa 3: sydämenlyönti menee palvelimelle allekirjoitettuna `GET /api/laite/oma`
-kutsuna, `turvajohto-guard://vuoro` vaatii sidonnan, ja vuoro käynnistyy ja päättyy
web-käyttöliittymästä (`src/guard/mobiili/sovellusvuoro.ts`). Uloskirjautuminen
pysäyttää valvonnan ennen istunnon päättämistä.

Lisäksi **vahtikoira** (`Vahtikoira.java`): epätarkka herätys varttitunnin välein
tarkistaa onko palvelu elossa, käynnistää sen tarvittaessa ja kirjaa kuolinhetken.
Tarkka herätys olisi vaatinut `SCHEDULE_EXACT_ALARM`-luvan ja Play-perustelun;
epätarkka riittää, koska Doze päästää sen läpi noin yhdeksän minuutin välein.

**Erä 10 on koodin osalta valmis.** Auki on enää akkumittauksen tulos. Käännös menee läpi ja yhdistetty manifesti on tarkistettu: luvat,
`VuoroService` tyypillä `specialUse`, `SiltaActivity` skeemalla `turvajohto-guard` ja
`minSdkVersion="28"` ovat app-moduulin manifestissa, vaikka niitä ei ole kirjoitettu
sinne.

#### Kieli on Java eikä Kotlin — ja syy on käännösketju

Kotlin oli ensimmäinen valinta, mutta se ei käänny tässä ympäristössä:

```
Caused by: TargetSupportException: Unknown hardware platform: x86
  at org.jetbrains.kotlin.konan.target.HostManager$Companion.hostArch
  at ...NativeCompilerDownloader.<clinit>
```

Kotlin-liitännäinen 2.x alustaa Kotlin/Native-osansa aina, myös puhtaassa
Android-projektissa, eikä se tue 32-bittistä x86-JVM:ää. **Bubblewrapin mukana tuleva
JDK 17 on juuri sellainen** — sama rajoite josta `gradle.properties`:n kekomuistiutus
kertoo. Kotlin vaatisi siis 64-bittisen JDK 17:n asennuksen (Android Studion oma JDK on
25, jota Gradle 8.11.1 ei tue) tai Gradle- ja AGP-ketjun päivityksen. Kumpikaan ei kuulu
erään 10, ja kumpikin vaihtaisi toimivan käännösketjun tuntemattomaan juuri siinä
erässä jonka tarkoitus on vastata yhteen laitekysymykseen.

Moduulin rajapinta ei riipu kielestä, joten vaihto on myöhemmin yksi erillinen muutos.

#### Varoitus: `bubblewrap build` ja `bubblewrap update`

`twa-manifest.json`:iin tehty `minSdkVersion`-muutos rikkoo `manifest-checksum.txt`:n,
jolla Bubblewrap havaitsee käsin tehdyt muokkaukset. Se voi siis tarjoutua
**generoimaan projektin uudelleen** — ja se pyyhkisi `app/build.gradle`:n
riippuvuusrivin ja `minSdkVersion 28`:n. Käännä siis `./gradlew`illa suoraan, ja jos
Bubblewrapia käytetään, tarkista jälkeenpäin molemmat rivit.

#### Yön yli -testin kulku

Testi ajetaan **kaksi kertaa**, ja ero ajojen välillä on se tieto jota haetaan: onko
akkuoptimoinnin poiskytkeminen käyttöönoton **pakollinen ehto vai suositus**.

1. Asenna APK ja avaa `turvajohto-guard://akku` — ensimmäinen ajo akkuoptimointi
   **päällä** (oletustila, eli se mitä vartija saa jos häntä ei ohjata).
2. Käynnistä vuoro: `turvajohto-guard://vuoro?id=testi&nimi=Testikohde`.
3. Jätä puhelin yöksi verkkovirran ulkopuolelle, ruutu sammuneena, ei laturiin.
4. Aamulla: avaa `turvajohto-guard://loki` puhelimessa — loki lähtee jakovalikon kautta
   sähköpostiin tai pilveen. Kaapelilla sama on
   `adb pull /sdcard/Android/data/fi.turvajohto_os.guard/files/vuoroloki.txt`.
5. Toinen ajo samoin, akkuoptimointi **pois**.

Jakoyhteys on olemassa juuri tätä varten: Android 11:stä alkaen tiedostonhallinta ei
pääse hakemistoon `Android/data`, joten ilman sitä kahden yön testi vaatisi
työpöytäkoneen ja kaapelin joka aamu. Sama osoite jää erän 15 diagnostiikkanäkymään.

Lokista luetaan kolme asiaa:

| Rivi lokissa | Mitä se kertoo |
|---|---|
| `vali_s` pysyy ~60 | Herätelukko pitää, lyönti ei veny |
| `uni_s` kasvaa nopeasti | Laite vaipui syvään uneen — herätelukko ei pidä |
| `jarjestelma_kaynnisti_uudelleen` | Järjestelmä tappoi palvelun; `kaynnistys=n` kertoo monennen kerran |
| `akku` alku vs. loppu | Herätelukon hinta prosentteina yössä |

Akunkulutus on tässä yhtä tärkeä mittaus kuin elossapysyminen: jos herätelukko syö yössä
kolmekymmentä prosenttia, kahdeksan tunnin vuoro ei kestä, ja minuutin väli on
harkittava uudelleen ennen erää 11.

**Kesto: 8–10 tuntia, sama molemmissa ajoissa.** Lyhyempi ei kelpaa. Doze syvenee
vaiheittain ja valmistajien omat nukutussäännöt iskevät vasta tuntien päästä, joten
lyhyt ajo mittaisi vain helpon osan. Akkuprosentti raportoidaan yhden prosentin
tarkkuudella, joten tunnin ajossa nähty muutos on enimmäkseen kohinaa. Ja vaatimus
itsessään on vuoron mittainen.

Kaksi mittauksen pilaajaa: aloita **yli 60 prosentista**, koska Android kytkee
virransäästön itsestään noin 15–20 prosentissa ja se muuttaa palvelun käyttäytymistä
kesken ajon — ja pidä puhelin muuten jouten, jottei mitata muiden sovellusten kulutusta.

**Päätössääntö sovitaan ennen datan näkemistä**, jottei tulosta tulkita jälkikäteen
mieleisekseen:

| Kulutus | Johtopäätös |
|---|---|
| alle 0,5 %/h | Herätelukko on halpa, erä 11 nojaa tähän sellaisenaan |
| 0,5–1 %/h | Hyväksyttävä, arvioitava uudelleen kun GPS tulee mukaan |
| yli 1 %/h | Herätelukko vaihdetaan: lyönti siirtyy `AlarmManager.setExactAndAllowWhileIdle`iin |

Luku on **alaraja** eikä lopullinen: erä 10 ei käytä verkkoa eikä GPS:ää lainkaan, ja
varsinaiset kuluttajat tulevat erässä 11.

**Tulos 12.9.2026: 3,81 %/h, ja sääntöä EI noudatettu.** Perustelu on kirjattu erän 11
kohtaan "Akku: päätössääntö oli oikea, mutta sen premissi oli väärä" — sääntö oletti
koko kulutuksen johtuvan herätelukosta, ja vertailumittaus osoitti puhelimen kuluttavan
2,25 %/h ilman valvontaa lainkaan. Sääntö kirjattiin etukäteen juuri siksi ettei tulosta
tulkittaisi jälkikäteen mieleisekseen, joten poikkeaminen siitä kuuluu kirjata yhtä
näkyvästi kuin sääntö itse.

#### Päivätesti 10.9.2026: kierros onnistui, valvonta ei käynnistynyt

Viiden ja puolen tunnin päivätesti tuotti näennäisen täydellisen tuloksen: kierros
`valmis`, 10/10 pistettä, jokainen `tapa: "qr"` eli oikeasti skannattu, GPS mukana
viimeistä myöten. **Natiivipalvelu ei silti käynnistynyt kertaakaan.** Puhelimen loki
sisälsi vain edellisen yön rivit, eikä loki kierrätä vaan liittää perään — mitään ei siis
kirjoitettu koko päivänä.

Syitä oli kaksi, ja molemmat ovat suunnitteluvirheitä eivätkä laitteen oikkuja:

1. **Kierroksen aloitus ei ole vuoron aloitus.** Silta natiivipalveluun on kiinni vain
   `aloitaVuoro`ssa (`GuardApp.tsx`). `POST /api/kierros` ei koske siihen mitenkään.
2. **Välitys vaikeni.** `kaynnistaSovelluksessa` palautti `void` ja poistui äänettömästi
   kun `display-mode: standalone` oli epätosi. Androidin selainvälilehdessä — jonne
   puhelimen kameralla skannattu QR-linkki vie — vuoro näytti alkaneelta ja valvonta oli
   pois päältä.

Kumpikaan ei näkynyt käyttöliittymässä eikä palvelimella. Se on tämän kohdan varsinainen
opetus: **sidottu laite ei tarkoita käynnissä olevaa valvontaa**, eikä eroa voinut nähdä
mistään.

Korjaukset:

- **Sydämenlyönti jättää jäljen.** Jokainen kelvollinen allekirjoitettu pyyntö merkitsee
  laitteen eläväksi. Tarkka tieto on muistissa, karkea levyllä viiden minuutin välein —
  perustelu kummallekin on `server/laite.js`:n kommentissa. Ilman jakoa joko jokainen
  lyönti kirjoittaisi koko `devices`-kokoelman uudelleen minuutin välein, tai deploy
  unohtaisi kaiken.
- **Välitys kertoo tuloksensa** (`'avattu' | 'ei_tavoitettu'`), ja vuoron aloitus näyttää
  Androidissa varoituksen kun sovellusta ei tavoitettu. Työpöydällä ja iPhonella vaietaan
  yhä: siellä vuoro on käyttöliittymän tila eikä valvontaa.
- **Päivystäjän laitelista näyttää valvonnan tilan** ja päivittyy minuutin välein.

Huomaa mitä `avattu` EI tarkoita: skeema avattiin, ei että palvelu käynnistyi. Ainoa
todiste siitä on palvelimelle saapuva lyönti.

**Päivätesti on uusittava**, koska se ei mitannut natiivipuolta lainkaan: asennettu
sovellus auki, vuoro aloitettuna kohteesta, pysyvä ilmoitus näkyvissä — ja vasta sitten
skannaukset.

#### Jelly Star 9.–11.9.2026: valmistajan pakkopysäytys ja laitteen hallinta

Yön yli -testi ei koskaan päässyt alkuun Unihertz Jelly Starilla, koska palvelu kuoli
minuuteissa. Kolme mitattua ajoa: **10 min 1 s** (10.9 ilta), **5 min 0 s** (11.9 aamu)
ja aiempi kuuden minuutin ajo. Sama allekirjoitettu binääri eli OnePlus Nord 5:llä
tunteja.

Tuntomerkeistä vika tunnistuu **pakkopysäytykseksi** eikä muistinpuutteeksi:

| Havainto | Mitä se sulkee pois |
|---|---|
| `palvelu_tuhottu` puuttuu lokista | `onDestroy` ohitettiin — normaali lopetus |
| Ei `jarjestelma_kaynnisti_uudelleen`-riviä | START_STICKY oli kuollut |
| Vahtikoira ei laukennut 85 minuutissa | Ajastetut herätykset oli peruttu |
| `kulunut_s` vastasi seinäkelloa sekunnilleen | Laite ei ollut käynnistynyt uudelleen |

Pakkopysäytys estää myös lähetykset ja FCM:n. **Mikään minkä sovellus ajastaa itselleen ei
selviä siitä** — vahtikoira, uudelleenkäynnistys ja push ovat kaikki saman muurin takana.
Sovelluspuolen korjausta ei siis ole olemassa.

Nämä oli kokeiltu ja todettu riittämättömiksi ennen kuin hallintaan siirryttiin:
Androidin akkuoptimoinnin poikkeus myönnettynä, sovelluksen akkuasetus
"Rajoittamaton", DuraSpeedia ei tässä ROMissa ole, recents-lukitusta ei ole.

##### Ratkaisu: laitteen omistajuus

Ainoa Androidin tarjoama keino on `DevicePolicyManager.setUserControlDisabledPackages`
(Android 11+), joka poistaa paketilta pakkopysäytyksen myös järjestelmän
asetusnäytöstä. Sen saa kutsua vain laitteen omistaja.

Koodissa kolme osaa: `Omistaja` (DeviceAdminReceiver, pelkkä nimetty osoite),
`res/xml/laitehallinta.xml` (**tyhjä** `uses-policies` — sovellus ei pyydä yhtään
hallintaoikeutta) ja `Laitehallinta.suojaa()`, jota `VuoroService.onCreate` kutsuu joka
vuoron alussa. Suojaus **luetaan takaisin** `getUserControlDisabledPackages`illa eikä
kutsun läpimenoon luoteta: valmistajan ROM voi hyväksyä kutsun ja jättää sen huomiotta,
ja juuri sellaista laitetta varten koko luokka on olemassa.

Loki kertoo tilan joka vuoron alussa, myös silloin kun suojausta ei ole:

```
laitehallinta omistaja=ei                          hallintaa ei ole otettu
laitehallinta omistaja=kylla suojaus=voimassa      hallinta päällä ja se tarttui
laitehallinta omistaja=kylla suojaus=ei_tarttunut  ROM hyväksyi kutsun ja jätti huomiotta
```

##### Hallintaan ottaminen (kertaluontoinen, per laite)

Ehdot: USB-vianetsintä päällä ja **laitteella ei yhtään tiliä** — yksikin Google-tili
estää komennon. Sovellus on asennettava ennen hallintaan ottoa.

```
adb shell dumpsys account | grep Accounts:        # pitää olla 0
adb install -r app-release-signed.apk
adb shell dpm set-device-owner fi.turvajohto_os.guard/fi.turvajohto_os.natiivi.Omistaja
adb shell dumpsys device_policy | grep protectedPackages
```

Viimeinen rivi on riippumaton todiste: se on järjestelmän oma kirjanpito eikä meidän
kirjoittamamme loki. Jelly Starilla 11.9.2026 se tuotti
`protectedPackages=[fi.turvajohto_os.guard]` — **Unihertzin ROM hyväksyi kutsun.**

Kaksi sudenkuoppaa jotka osuivat kohdalle:

- **Sovelluksen uudelleenasennus pyyhkii akkuoptimoinnin poikkeuksen.** Lokin
  `akkuvapautus=ei` paljasti sen. Palautus ilman käyttöliittymää:
  `adb shell dumpsys deviceidle whitelist +fi.turvajohto_os.guard`
- **Poisto ja uudelleenasennus (toisin kuin päivitys) pyyhkii laitesidonnan puhelimen
  päästä.** Palvelimella sidonta jää, ja koska tunnusta kohden sallitaan yksi laite,
  uusi sidonta torjutaan kunnes vanha nollataan hallinnasta.

  **Korjattu 11.9.2026.** Vastakkainen tilanne oli pahempi ja se oli umpikuja: kun
  hälytyskeskus nollaa laitteen, palvelimen sidonta katoaa mutta puhelimen oma jää, eikä
  mikään purkanut sitä — vartija näki "Laite on jo sidottu" vaikka juuri hänen sidontansa
  oli peruttu. `SiltaActivity.sido()` kysyy nyt `GET /api/laite/oma` ennen
  kieltäytymistä ja purkaa paikallisen sidonnan **vain 401:llä**, joka on ainoa vastaus
  jolla on merkitys "tätä laitetta ei enää tunneta". Verkkovirheellä ei pureta koskaan:
  katvealue ei ole sama asia kuin peruttu oikeus, ja purku hävittäisi Keystore-avaimen
  jota ei saa takaisin.

##### Hallinnasta luopuminen

`dpm set-device-owner` on käytännössä yksisuuntainen, ja ilman paluusuuntaa
työsuhdelaitetta ei voi luovuttaa eteenpäin. **Purkutie rakennettiin 11.9.2026:**
`turvajohto-guard://pura-hallinta`.

Se vaatii että hälytyskeskus on ENSIN nollannut laitteen, ja tämä ei ole muotoseikka
vaan ainoa asia joka tekee toiminnosta turvallisen: URL-skeema on avoin kaikille laitteen
sovelluksille, joten ilman tarkistusta mikä tahansa sovellus voisi poistaa
pakkopysäytyksen eston ja tappaa valvonnan — täsmälleen se hyökkäys jota vastaan hallinta
on olemassa. Palvelimen **401** on ainoa hyväksytty vastaus; verkkovirhe ja kaikki muut
koodit torjutaan.

Sidonnaton laite ei pääse tätä tietä lainkaan, jolloin jäljelle jää tehdasasetusten
palautus. Se on tiedostettu hinta siitä että portti on kapea.

##### Zebra ja muut laitteet

Zebran kämmentietokoneet tukevat hallintaan ottoa natiivisti StageNow'lla, eikä niissä
ole vastaavaa tappajaa. Sama koodi kattaa molemmat: ilman hallintaa sovellus toimii
kuten ennenkin, hallinnan kanssa pakkopysäytys on poissa.

Jos vianetsintää ei saa päälle, jäljelle jää QR-provisiointi tehdasasetusten
palautuksen jälkeen. Se ei vaadi vianetsintää mutta pyyhkii laitteen ja vaatii APK:n
tarjoamisen verkosta allekirjoituksen tarkistussumman kera.

##### Sivutuote: hiljenemisraja oli väärin

Sama mittausjakso paljasti palvelinpuolen virheen, joka ei liity Jellyyn lainkaan.
`VALVONTA_HILJENEE_MS` oli kolme minuuttia, mitoitettuna oletukselle "lyönti tulee
minuutin välein". Oletus ei pidä: palvelun lyönti nojaa `Handler.postDelayed`iin, joka
laskee aikaa `uptimeMillis`-kellolla eikä kulje syvässä unessa. Nord 5:llä minuutin väli
venyi Dozessa kuuteen minuuttiin, ja vahti kirjasi **11 väärää `elossa=false`-lukemaa
1 h 24 min aikana täysin terveellä laitteella.**

Korjaus oli kaksiosainen: vahtikoira **lyö** nyt palvelimelle jokaisella herätyksellään
(`setAndAllowWhileIdle` läpäisee Dozen, eli lyönnillä on yläraja jota `postDelayed`illa
ei ollut), ja raja johdetaan siitä välistä.

Raja laskettiin ensin ja se meni väärin: 15 min vahdin väli + 9 min Dozen oletettu jousto
+ 1 min varmuusvara = 25 min. Kuuden tunnin ajo samana iltana mittasi vahdin todelliset
välit, ja ne olivat muuta:

| Vaihe | Vahdin väli |
|---|---|
| Ennen kuin Doze vakiintui | 16–19 min |
| Doze vakiintuneena, kuusi kertaa peräkkäin | **26 min 15 s** |
| Suurin mitattu | **26 min 16 s** |

Dozen jousto on siis yli 11 minuuttia eikä yhdeksän, ja 25 minuutin raja alitti vahdin
oman välin — sama vika jota se oli korjaavinaan. **Raja on nyt 35 min** (mitattu 26 min
16 s + yksi Dozen jaksotusaskel). Luku on MITATTU eikä laskettu, ja regressioesto
`server/laite.test.js`:ssä vahtii nimenomaan mitattua eikä koodin nimellistä väliä.

Se on silti lattia eikä lopullinen: kuuden tunnin ajo ei käynyt kertaakaan syvässä
unessa, joten yön yli -ajo voi venyttää väliä vielä. **Jos herätelukko joskus poistetaan
akun säästämiseksi, tämä luku on mitattava uudelleen ENNEN sitä** — silloin vahdin lyönti
jää ainoaksi signaaliksi jolla on yläraja.

##### Kuuden tunnin ajo 11.9.2026: mitä hallinta kesti ja mitä akku maksoi

Ajo alkoi 12:22:10 ja päättyi 18:33:38 vahingossa tulleeseen uudelleenkäynnistykseen —
**ei ROMin tappamaan.** Aamulla sama laite kuoli viidessä minuutissa.

Uudelleenkäynnistys paljasti samalla oman aukkonsa: valvonta ei palannut itsestään,
koska `BOOT_COMPLETED`-vastaanotinta ei ollut. Vuoro oli auki palvelimella, puhelin
näytti tavalliselta, ja valvonta oli kuollut — ilman yhtäkään vikaa missään.
**Korjattu samana päivänä** (`Kaynnistys.java`): käynnistyksen jälkeen vartijalle
näytetään ilmoitus "Puhelin käynnistyi uudelleen", jota napauttamalla vuoro jatkuu.
Automaattista jatkoa EI tehdä, ja päätös on tietoinen: käynnistyksen syytä ei tiedetä, ja
itsestään käynnistyvä sijainninlähetys silloin kun ihminen luulee olevansa vapaalla on
väärin tavalla jota ei korjata jälkikäteen. Ilmoituksesta lähtevä käynnistys on myös yksi
harvoista tavoista nostaa etualan palvelu taustalta Android 12:sta alkaen, joten ihmisen
napautus on samalla luotettavampi kuin sovelluksen oma yritys.

| Mittari | Tulos |
|---|---|
| Lyöntejä | 372, epäonnistuneita 0 |
| Lyöntivälejä | 371, **kaikki tasan 60 s** |
| Vahtikoiran laukeamisia | 16, ja jokaisesta `vahti_lyonti palvelin=200` |
| Kuoleman merkkejä | ei yhtään |

`doze=kylla` kytkeytyi klo 14:06 ja pysyi, mutta `uni_s` pysyi viidessä sekunnissa koko
kuusi tuntia: laite oli Dozessa mutta ei vaipunut kertaakaan syvään uneen. Herätelukko
esti sen — ja juuri siksi lyöntiväli ei venynyt sekuntiakaan. Vahvistus tuli vuoron
päättyessä: `uni_s` hyppäsi heti 291 sekuntiin kun lukko vapautui.

**Akku: 73 % → 57 % viidessä tunnissa 20 minuutissa = 3,0 %/h.** Kahdeksan tunnin vuoro
veisi noin 24 prosenttiyksikköä.

Päätössääntö sanoi "yli 1 %/h → herätelukko vaihdetaan", ja luku ylittää sen
kolminkertaisesti. **Sääntö oletti kuitenkin että koko kulutus on herätelukon syytä, eikä
se ole:** yön mittaus valvonta KUOLLEENA kulutti 2,25 %/h. Herätelukon marginaalikustannus
on siis noin 0,75 %/h, ja sekin epävarma koska päivä ja yö eivät ole vertailukelpoisia.
Lukon poistaminen ei palauttaisi kolmea prosenttiyksikköä vaan alle yhden. Suurin
kuluttaja on jokin muu — epäilty on web-sovelluksen sekunnin ajastimet
(`Halytysvahti.tsx`, `Halytykset.tsx`, `src/shared/jono.ts`).

**Ennen erää 11 tarvitaan kontrolloitu vertailu eikä suora uudelleensuunnittelu:** sama
laite, sama kesto, valvonta päällä ja pois, ja web-sovellus suljettuna molemmissa.

### Erä 11 — Kanava ja sijainti

| Osa | Uutta |
|---|---|
| `Kanava.java` — WebSocket, kasvava uudelleenyhdistysviive | ~220 |
| `Sijainti.java` — FusedLocation, 60 s väli | ~150 |
| Kytkentä vuoropalveluun | ~60 |
| Testit | ~100 |

**Valmis kun:** vartija näkyy TIKEn kartalla puhelin taskussa ja ruutu sammuneena, ja
`server/geofence.js` laukaisee vyöhykepoikkeaman ilman että sovellus on auki. Tämä on
ensimmäinen erä joka tuottaa näkyvää hyötyä. Akunkulutus mitataan tässä, ennen kuin 60
sekunnin väli lukitaan.

#### Tila 11.9.2026: ensimmäinen puolisko täyttyi, toinen ei

| Osa | Tila |
|---|---|
| Palvelinpuoli | **Ei vaatinut riviäkään.** Ks. alla |
| `Kanava.java` | Valmis, todennettu laitteella |
| `Sijainti.java` | Valmis, todennettu laitteella |
| Luvat ja FGS-tyyppi | Valmis |
| Vyöhykepoikkeama | **Laukeaa** — ks. alla |

**Palvelinpuoli oli valmis ennestään, ja se oli arvaus kunnes se ajettiin.**
`tunnistaKanava` kutsuu `getSessionUser`ia, joka putoaa laiteallekirjoitukseen kun
evästettä ei ole, ja `laiteIstunto` lukee polun `req.url`ista juuri kanavan kättelyä
varten. Sovelluksella ei ole istuntokeksiä eikä tokenia (perustelu: `server/laite.js`,
"Miksi laitteella EI ole tokenia"), joten kättely allekirjoitetaan samalla neljän
otsakkeen nelikolla kuin HTTP-pyynnöt. `server/e2e-kanava.mjs` todentaa tämän ilman
puhelinta: neljä torjuntaa (allekirjoittamaton, vieras avain, vanhentunut, toistettu) ja
kaksi läpimenoa (kättely ja sijainti soketin yli).

Laitteella 19:04:44 vuoron alkaessa:

```
sijainti_alkoi vali_s=60
sijainti_ei_kanavaa      ← EI VIKA, ks. alla
kanava_auki
kanava_viesti tavuja=45  ← palvelin työnsi alas; erän 12 alassuunta toimii jo
```

**`sijainti_ei_kanavaa` vuoron ensimmäisellä rivillä ei ole vika.** `Kanava.avaa`
käynnistää kättelyn ja palaa heti, kun taas FusedLocation antaa välittömästi viimeksi
tunnetun sijainnin välimuistista — ensimmäinen korjaus ehtii ennen soketin aukeamista ja
pudotetaan. Mitattu hinta on **61 sekuntia**: seuraava korjaus meni läpi ja vartija näkyi
kartalla. Tilanne korjaa itsensä, joten Kanavan ja Sijainnin väliin ei lisätty kytkentää.

##### Ratkaistu: tarkkuus riittää, ja kuvakoordinaatti lasketaan palvelimella

Kaksi estettä löytyi ja molemmat kaatuivat samana päivänä.

**Tarkkuus ei ollut este.** Mitattu 11.9.2026 minuutin välein samalla laitteella:

| Missä | Tarkkuus |
|---|---|
| Sisällä | 100 m seitsemän kertaa peräkkäin, koordinaatit jäätyneinä |
| Ulkona | 12,1 m · 21,0 m · 52,4 m · 20,9 m |

Sisällä luku on tukiasemapaikannusta eikä mittaus — sata metriä tasan, sama piste joka
kerta. Ulkona balanced käyttää satelliitteja ja kolme neljästä alitti 50 metrin
vaatimuksen. `PRIORITY_BALANCED_POWER_ACCURACY` siis riittää, eikä `HIGH_ACCURACY`:n
akkukustannusta tarvitse maksaa. Yksittäiset ylitykset ohitetaan, ja se on oikea käytös:
geofence jättää arvioinnin tekemättä eikä hälytä arvauksen perusteella.

**Varsinainen este oli kuvakoordinaatti.** `arvioi()` vaatii `img`-kentän, koska
vyöhykkeet on piirretty pohjakuvalle, ja natiivi lähettää tarkoituksella pelkän GPS:n.
Poikkeama ei siis olisi lauennut koskaan, tarkkuudesta riippumatta — ja vika olisi ollut
täysin hiljainen.

Ratkaisu on `server/georeferointi.js`: palvelin täydentää kuvakoordinaatin kohteen
kalibroinnista (`mapRef`) kun sitä ei ole. Se on **kolmas tietoinen kaksoiskappale**
samassa perheessä, ja kolme muuta vaihtoehtoa punnittiin: natiivi laskisi itse (kolmas
toteutus, kalibrointi vietävä laitteelle), web täydentäisi (vaatisi sovelluksen olevan
auki — juuri se mitä erä 11 poistaa), tai vyöhykkeet GPS-muotoon (oikeampi pitkällä
tähtäimellä, mutta muuttaa tietomallin ja käyttöliittymän).

Todennettu päästä päähän: `server/e2e-kanava.mjs` lähettää kaksi pelkkää GPS-sijaintia
kalibroidulle kohteelle ja varmistaa että ensimmäinen ei hälytä ja toinen laukaisee
poikkeaman oikealla vyöhykkeen nimellä.

##### Kaksi asiaa jotka tehtiin samana iltana

**Valvonnan tarkistuslista** (`turvajohto-guard://tila`) siirrettiin erästä 15 tähän,
koska sitä tarvittiin heti: kaikki tämän päivän vianetsintä tehtiin kaapelin yli
`adb`:llä, eivätkä vartija ja päivystäjä voi tehdä sitä. Näkymä listaa sidonnan,
laitehallinnan, akkuoptimoinnin, ilmoitus- ja sijaintiluvat, Play-palvelut, vuoron,
palvelun, kanavan ja yhden allekirjoitetun palvelinkutsun tuloksen. Se **ei korjaa
mitään** — korjaava diagnostiikka näyttäisi aina vihreää eikä kukaan saisi tietää että
vika oli olemassa.

**URL-skeeman aukko suljettiin.** `SiltaActivity`:n oma kirjattu turvallisuuskysymys oli
se, että mikä tahansa laitteen sovellus voi lähettää `turvajohto-guard://vuoro`. Erään 11
asti haitta oli olematon; nyt vuoroon on ripustettu sijainnin lähetys, ja väärä vuoro
tarkoittaisi sijaintitiedon syntymistä silloin kun vartija ei ole töissä.

Ratkaisu ei ole lähettäjän tunnistaminen vaan se, ettei sillä ole väliä: sovellus kysyy
`GET /api/vuoro/oma` ja vertaa kohdetta. Totuus vuorosta asuu joka tapauksessa
palvelimella, koska selain luo sen `POST /api/vuoro`:lla ennen kuin avaa osoitteen.
Vieras sovellus ei voi luoda vuoroa eikä siis läpäistä tarkistusta — ja jos vuoro oikeasti
on käynnissä, valvonnan käynnistäminen on oikein riippumatta siitä kuka intentin lähetti.

Verkkovirhe torjutaan, eikä se estä kenttäkäyttöä: laillinen polku on juuri käynyt
palvelimella luomassa vuoron, joten ilman verkkoa sitä ei olisi syntynyt lainkaan.

#### Yön yli -ajo 11.–12.9.2026: kaikki neljä lukua

Ensimmäinen täysimittainen ajo laitteen hallinnan kanssa, sijainti ja kanava mukana.
**13 h 41 min, yhä käynnissä lopetettaessa.**

| Mittari | Tulos |
|---|---|
| Lyöntejä | 822, **kaikki `vali_s=60`**, epäonnistuneita 0 |
| Vahtikoiran laukeamisia | 32, ja jokaisesta `vahti_lyonti palvelin=200` |
| Kuoleman merkkejä | ei yhtään |
| Kanavan katkoja | **0** |
| `uni_s` | 291 s koko yön — ei muuttunut kertaakaan |
| Akku | 85 % → 33 % = **3,81 %/h** |

##### Kanava kesti yön — FCM:ää ei tarvita

Tämä oli yön suurin tuntematon. WebSocket pysyi auki 13 tuntia 41 minuuttia Dozessa
**ilman yhtään katkoa**, eikä `Kanava.java`:n peräytymislogiikkaa tarvittu lainkaan.
Alassuunta kantoi 822 viestiä. Erän 12 täysruutuhälytys ja erän 4 pakotetut ilmoitukset
voivat siis nojata kanavaan, ja FCM jää pois — mikä oli erän 10 alkuperäinen toive mutta
vasta nyt mitattu.

##### Akku: päätössääntö oli oikea, mutta sen premissi oli väärä

Sääntö asetettiin ennen datan näkemistä: *yli 1 %/h → herätelukko vaihdetaan.* Mitattu
luku 3,81 %/h ylittää sen kolminkertaisesti. **Sääntö oletti kuitenkin että koko kulutus
on herätelukon syytä, ja nyt on ensimmäistä kertaa vertailukelpoinen mittaus:**

| | %/h |
|---|---|
| Puhelin ilman valvontaa (yö 10.–11.9.) | 2,25 |
| Valvonta + sijainti + kanava (yö 11.–12.9.) | 3,81 |
| **Valvonnan oma osuus** | **1,56** |

Kahdeksan tunnin vuoro maksaa 30 prosenttiyksikköä, josta valvonnan osuus on 12,5.
Kahdentoista tunnin vuoro 46 prosenttiyksikköä. Molemmat mahtuvat täyteen akkuun
varalla, joten **herätelukko jää.**

Poistaminen säästäisi osan tuosta 1,56:sta — `uni_s` ei kasvanut kertaakaan, eli lukko
esti syvän unen koko yön ja juuri siitä kustannus syntyy. Mutta se venyttäisi lyönnit
Dozen armoille, pakottaisi mittaamaan `VALVONTA_HILJENEE_MS`:n uudelleen ja veisi
sijaintipäivitykset saman venymän alle. Kauppa on huono, ja päätös on siksi **pitää
lukko** vaikka kirjaimellinen sääntö sanoisi toisin.

##### Hiljenemisraja todistettu

| | Väärät `elossa=false` |
|---|---|
| 3 min raja, 84 min ajoa (11.9.) | **11** |
| 35 min raja, 13,7 h ajoa (11.–12.9.) | **0** |

Vahtikoiran suurin väli oli **26 min 16 s** — sekunnilleen sama kuin edellisenä päivänä.
Se ei siis ollut sattuma vaan Dozen todellinen katto, ja 35 minuutin raja on mitoitettu
oikein.

#### v10 12.9.2026: sillan hiljainen kieltäytyminen

Yön lokia lukiessa löytyi oma virhe, jota mikään mittaus ei ollut tarkoitus löytää.
**`SiltaActivity` torjui hiljaa.** Epäonnistunut vuoron aloitus näytti Toastin, joka
katosi muutamassa sekunnissa, eikä jättänyt vuorolokiin riviäkään — ja yksi polku (tyhjä
kohdetunnus) ei näyttänyt edes Toastia.

Miksi tämä on pahempi kuin miltä kuulostaa: koko vuoroloki on rakennettu sitä vastaan,
että valvonnan puuttuminen näyttäisi samalta kuin valvonnan sujuminen. Torjuttu vuoro
näytti jälkikäteen **täsmälleen samalta kuin vuoro jota ei koskaan yritetty aloittaa.**
Kysymykseen "miksi hälytys ei tullut" ei olisi ollut vastausta juuri siinä tapauksessa
jossa vastaus oli olemassa. Aukko oli lokin omassa etuovessa.

v10 kirjaa jokaisen polun joka päättyy johonkin muuhun kuin tehtyyn työhön:

| Tapahtuma | Syyt |
|---|---|
| `aloitus_hylatty` | `kohde_puuttuu` · `ei_sidontaa` · `ei_varmistusta` · `sidonta_purettu` · `palvelin_<koodi>` · `vuoroa_ei_palvelimella` · `vaara_kohde` · `vastaus_lukukelvoton` |
| `sidonta_hylatty` | `koodi_puuttuu` · `sidonta_voimassa` · `ei_varmistusta` · `ei_yhteytta` · `palvelin_<koodi>` |
| `hallinnan_purku_hylatty` | `ei_omistaja` · `ei_sidontaa` · `ei_varmistusta` · `yha_kaytossa` |
| `silta_tuntematon_komento` | vieras osoite — havainto, ei vika |
| `paatos_ohitettu` | `ei_tallennettua_vuoroa` |
| `sidonta_onnistui` | — |

Tapahtumanimi `aloitus_hylatty` on **sama jota `VuoroService` jo käytti** omasta
torjunnastaan. Yksi haku löytää siis kaikki torjutut aloitukset riippumatta kerroksesta,
ja se on tärkeämpää kuin että lokista näkisi kerroksen — kerroksen kertoo syy.

Kolme yksityiskohtaa jotka ratkaistiin samalla:

**Syy ja perustelu samassa oliossa.** Lokitunnus ja vartijalle näytettävä lause kulkevat
yhtenä `Este`-oliona. Luokan koko vika oli se, että toinen niistä puuttui; yhtenä oliona
uutta torjuntaa ei voi lisätä kirjaamatta sitä, koska kääntäjä vaatii molemmat. Lokiin ei
kirjoiteta lausetta: sen sanamuodon korjaus rikkoisi jokaisen vanhaan lokiin tehdyn haun.

**Torjunta kirjataan taustasäikeessä**, ei pääsäikeen takaisinkutsussa. Torjunta on
tapahtunut riippumatta siitä ehtiikö activity elää siihen asti että Toast näytetään — ja
juuri se ehto tekisi lokista epäluotettavan.

**Vieraat arvot siivotaan ennen lokiin kirjoittamista.** Lokiin päätyvät kohdetunnukset ja
osoitteet tulevat intentistä, jonka voi lähettää mikä tahansa laitteen sovellus. Ilman
suodatusta rivinvaihdon sisältävä arvo antaisi ulkopuoliselle keinon kirjoittaa
vuorolokiin haluamiaan — myös uskottavia — rivejä. Väärennettävissä oleva mittari on
huonompi kuin rikkinäinen, koska se näyttää ehjältä.

#### v11 12.9.2026: loki antoi vahtikoiralle kunnian ihmisen työstä

v10:n asennus paljasti heti toisen vian, ja se löytyi juuri siksi että lokia luettiin
tarkasti. Asennus tappoi palvelun, valvonta palasi 76 sekunnin kuluttua, ja loki sanoi:

```
09:40:26 sovellus_paivitettiin vuoro_kesken kohde=b1020fdc-…
09:41:42 palvelu_luotu
09:41:42 vahti_jatkoi_vuoroa      ← vahtikoira ei ollut ajanut kertaakaan
```

**Vahtikoira ei elvyttänyt mitään.** Sen elvytyspolku kirjoittaa aina ensin
`vahti_havaitsi_kuolleen` ja sen jälkeen `vahti_kaynnisti_uudelleen`; kumpaakaan ei ollut.
Herätys oli yhä jonossa ja ajastettiin uudelleen vasta kello 09:41:42 — eli palvelun oman
käynnistyksen toimesta (`VuoroService:235`), ei vahdin. Todellinen elvyttäjä oli ihminen,
joka napautti "Sovellus päivitettiin" -ilmoitusta.

Syy: `ACTION_JATKA`-komennolla oli **kaksi lähettäjää**, `Vahtikoira` ja
`Ilmoitukset`in `PendingIntent`, ja molemmat tuottivat saman lokirivin.

**Miksi tämä on pahempi kuin edellinen vika.** Puuttuvasta rivistä tietää ettei tiedä;
väärä nimi luetaan luottavaisesti. Käytännön seuraus on suora: kysymykseen "kuinka monta
kertaa vahtikoira pelasti vuoron" olisi saatu liian suuri luku, ja juuri sillä luvulla
perustellaan tarvitaanko vahtikoiraa lainkaan. Yön yli -ajon luvut ovat kunnossa, koska
kukaan ei nukkuessaan napauttanut mitään — mutta se on tuuria eikä rakennetta.

Korjaus: ilmoitus lähettää `ACTION_JATKA_ILMOITUKSESTA` ja kirjaa
**`ihminen_jatkoi_vuoroa`**. Sama lopputulos, eri syy, eri nimi. Perustelu on koodissa
vakion vieressä eikä vain tässä, koska seuraava lukija näkee ensin kaksi vakiota jotka
tekevät saman asian ja kysyy miksi.

**Sivutuote: päivitys ja bootti eivät ole sama vikatila.** Pakettia vaihdettaessa
vahtikoiran herätys **säilyy** jonossa (mitattu: yliaikainen, ikkuna +11 min), kun taas
uudelleenkäynnistyksessä herätykset peruuntuvat. `Kaynnistys`in kuvaus sanoo ne
samanlaisiksi, ja se pitää paikkansa vain palvelun kuoleman osalta — ei elpymisen.
Päivityksestä valvonta palaa itsestään viimeistään vahdin ikkunan sisällä, bootista ei
palaa ilman napautusta.

### Erä 12 — Man-down ja täysruutuhälytys

| Osa | Uutta |
|---|---|
| `Mandown.java` portattu `src/shared/mandown.ts`:stä | ~140 |
| `MandownTest.java` — samat testivektorit kuin webissä | ~150 |
| `Anturit.java` — SensorManager, 250 ms näytteistys | ~100 |
| `HalytysActivity.java` — lukitusruudun päälle, ääni, värinä | ~250 |
| Ilmoituskanavat ja varatie ilman full-screen-lupaa | ~150 |
| Web: `Halytysvahti` väistää kun natiivi vuoro on päällä | ~40 |

**Valmis kun:** puhelin taskussa, vartija makaa liikkumatta viisi minuuttia → kysely
herättää ruudun → vastaamatta jättäminen tuottaa `mandown`-hälytyksen valvomoon.
Testivektorien on mentävä läpi sekä Javassa että TypeScriptissä.

#### Tila 12.9.2026: toiminnallisesti valmis, kaksi mittausta auki

| Osa | Tila |
|---|---|
| `Mandown.java` + `MandownTest.java` | Valmis — 13 Java-, 12 TS-testiä |
| Kuljetus palvelimelle | **Ei vaatinut riviäkään** — ks. alla |
| Asetus palvelimelle + web-käyttöliittymä | Valmis |
| `Anturit.java` | **Todennettu laitteella** |
| `HalytysActivity` ja `Kysely` | **Todennettu laitteella** |
| Selain väistyy natiivin tieltä | Valmis, ei todennettu ajossa |

Todennus laitteella 12.9.2026:

```
10:42:05 anturi_alkoi vali_ms=250 liikkumaton_min=5
10:47:23 anturi_epaily laji=liikkumaton        ← 5 min 18 s
10:47:23 kysely_alkoi laji=liikkumaton vastausaika_s=30
10:47:41 kysely_kuitattu laji=liikkumaton      ← 18 s vastausaikaa käytetty
```

`kysely_nakyma_estyi` puuttuu, eli täysruutuaie meni läpi ja näkymä nousi lukitusruudun
päälle. `halytys_lahetetty` puuttuu, eli nappi peruu oikeasti eikä hälytystä syntynyt.

**Palvelinpuoli oli valmis ennestään, taas.** `/api/halytys` on `requireAuth`in takana,
joka putoaa laiteallekirjoitukseen kun evästettä ei ole. Koodi näytti tukevan tätä mutta
sitä ei ollut ajettu tältä polulta. `server/e2e-halytys.mjs` todentaa sen ilman puhelinta:
12 väitettä, joista tärkein natiivin kannalta on **toistopainallus** — sovellus yrittää
uudelleen kun verkko takkuaa, ja palvelin palauttaa saman hälytyksen sen sijaan että loisi
toisen. Yksi kaatuminen, yksi tekstiviesti. Ilman sitä idempotenssi olisi pitänyt rakentaa
sovellukseen.

Löytyi myös kaksi käyttöönoton ehtoa joita ei voi päätellä mistään muualta: vartijan
tunnuksella on oltava **`tuotteet: ['guard']`** (muuten `/api/vuoro/oma` torjutaan eikä
vuoro käynnisty) ja **`guard_alarms`-katseluoikeus** (muuten man-down torjutaan 403:lla
vaikka allekirjoitus olisi moitteeton). Molemmat on kirjattu e2e-tiedostoon siihen
kohtaan jossa ne kaatoivat testin.

##### Kolme rakenneratkaisua

**Ajastin on `Kysely`ssä eikä näkymässä.** Näkymä on mahdollisuus perua, ei hälytyksen
edellytys. Android 14:stä alkaen `USE_FULL_SCREEN_INTENT` myönnetään automaattisesti vain
puhelu- ja herätyssovelluksille, eikä tämä ole kumpikaan — jos hälytys riippuisi
näkymästä, man-down vaikenisi juuri niillä laitteilla joilla se eniten tarvitaan. Näkymän
epäonnistuminen kirjataan ja hälytys lähtee silti.

**Vain nappi peruu.** Näkymän sulkeminen, takaisin-painike tai sovelluksen tappaminen
eivät peru mitään: kaatunut ihminen ei paina nappia, mutta taskussa oleva puhelin voi
sulkea näkymän itsestään.

**Toinen kysely avoimen päälle ohitetaan.** Liikkumattomuussääntö tuottaa epäilyn
uudelleen joka viidennellä minuutilla. Ilman ohitusta jokainen niistä nollaisi
vastausajan alusta eikä hälytys lähtisi koskaan — sääntö olisi estänyt oman toimintansa.

##### Asetus siirtyi selaimen localStoragesta palvelimelle

Man-downin päällä/pois ja liikkumattomuusraja asuivat selaimen tallenteessa. Se oli väärä
paikka kahdesta syystä: natiivisovellus ei pääse siihen käsiksi lainkaan — ja juuri se
sovellus man-downin ajaa, koska selain ei ole auki taskussa — ja tärkeämmin, **man-down on
työnantajan turvallisuusasetus eikä työntekijän valinta.** localStoragessa vartija saattoi
kytkeä oman valvontansa pois kenenkään näkemättä, ja raja oli laitekohtainen: sama vartija
sai eri valvonnan sen mukaan millä puhelimella hän sattui kirjautumaan.

Asetus on nyt kohteen tietueessa ja kulkee `/api/vuoro/oma`-vastauksessa, eli **samassa
kutsussa jonka sovellus jo tekee** varmistaakseen että vuoro on olemassa. Nolla uutta
päätepistettä. Oma päätepiste olisi toinen pyyntö joka voi epäonnistua erikseen, ja
silloin sovelluksen pitäisi päättää mitä tehdä vuorolla jonka asetusta se ei tiedä.

**Oletus on pois päältä**, ja pois päältä oleminen tehdään näkyväksi: sovellus kirjaa
`mandown_pois_kaytosta` vuoron alussa ja tarkistuslista näyttää sen. Hiljainen
käyttöönotto jokaisessa olemassa olevassa kohteessa tarkoittaisi yöllisiä kyselyitä ilman
että kukaan on niin päättänyt; hiljainen poissaolo taas olisi valvonta jota ei ole eikä
siitä tiedä kukaan.

Vartijan kytkin muuttui **tilanäytöksi** sekä hälytysnäkymässä että mobiilivalikossa. Tila
näytetään silti, koska vartijan on tiedettävä valvotaanko häntä — tyhjä kohta olisi arvaus.

##### Testaamatta laitteella

Kaatumissääntö (isku + liikkumattomuus). Koko ketju hälytykseen asti testattiin
päiväajossa 12.9. — ks. alla.

#### Päiväajo 12.–13.9.2026: 13 h 36 min vartijan mukana

Puhelin v13:lla mukana tavallisessa päivässä, kaapeli irti 12:00, kytketty takaisin
01:36. Tarkoitus oli vastata neljään kysymykseen; **kaksi sai vastauksen, kaksi ei**, ja
syy näkyy samassa datassa.

| | |
|---|---|
| Kesto | 13 h 36 min |
| Lyöntejä | 817, **nolla palvelun kuolemaa**, nolla vahdin elvytystä |
| Kanavakatkoja | 1, korjautui itsestään |
| Anturinäytteitä | 173 917 eli ~11 000/h (~183/min), tasaisena koko ajon |
| Akku | 97 % → 33 % = **4,70 %/h** |

##### Vastasi: anturi ei pysähdy, ja hälytysketju toimii

Näytelaskuri kulki tasaisena alusta loppuun. Se oli lokissa juuri tätä varten, ja
pysähtynyt luku olisi ollut man-downin hiljainen kuolema.

Hälytysketju todistui **vahingossa** kello 13:03 — kyselyyn ei ehditty vastata:

```
13:03:06 anturi_epaily laji=liikkumaton
13:03:06 kysely_alkoi vastausaika_s=30
13:03:36 kysely_vastaamatta
13:03:36 halytys_lahetetty tyyppi=mandown syy=liikkumaton
```

##### Tärkein löydös: liikkumattomuussääntö valvoo työasentoa, ei vartijaa

| Klo | Epäilyjä |
|---|---|
| 12:10–13:03 | **14** |
| 13:03–01:36 | **0** |

Neljätoista kyselyä 53 minuutissa pöydän ääressä, sitten ei yhtäkään 12,5 tuntiin
liikkeessä. Sääntö ei siis erottele vaarassa olevaa vartijaa turvallisesta vaan istuvan
kävelevästä — ja porttikopissa tai valvomossa istuminen on koko työ.

Turhaan toistuva "oletko kunnossa" opetetaan painamaan katsomatta, ja se on tämän
toiminnon pahin mahdollinen lopputulos. **Viiden minuutin oletus on väärä.** Oikea rakenne
on kolme kerrosta eri kysymyksillä (päätetty 12.9., ks. "Vuoron kuittausväli"):

| Kerros | Mihin vastaa | Aika |
|---|---|---|
| `kaatuminen` | Iskeytyikö vartija maahan | 12 s |
| Kuittausväli | Onko vartija kunnossa ylipäätään | 60 min, säädettävä |
| `liikkumaton` | Onko laite ollut epätavallisen kauan liikkumatta | **30–60 min, varmistin** |

##### EI vastannut: Doze eikä man-downin akkuhinta

**Puhelin ei ollut Dozessa kertaakaan.** Kaikissa 2 580 lokirivissä kello 12:n jälkeen
lukee `doze=ei`; yön yli -ajossa 11.–12.9. luki `doze=kylla`. Ajo ei siis kerro mitään
siitä kestääkö anturi Dozen — sitä tilaa ei syntynyt.

Sama havainto selittää epäilyjen puuttumisen illalla: puhelin oli liikkeessä tai
käsittelyssä. **Kaksi toisistaan riippumatonta mittaria sanovat samaa**, ja siksi selitys
kelpaa.

Akkuluku on siksi ylälaidan arvio eikä mittaus:

| Ikkuna | Kulutus |
|---|---|
| Koko ajo 12:00–01:36 | 4,70 %/h |
| Rauhoittunut 15:00–22:00 | 4,00 %/h |
| Ilta 22:00–01:30 | 5,14 %/h |
| **Vertailu:** yön yli -ajo ilman man-downia | 3,81 %/h |

Vertailuluku mitattiin liikkumattomasta puhelimesta ruutu sammuksissa, tämä mukana
kannetusta. Ero 0,2–0,9 %/h on siis man-downin hinta **plus käyttäjän oma käyttö**, eikä
niitä voi tästä datasta erottaa. Man-downin oma kustannus näyttää pieneltä — mutta sitä ei
ole mitattu, eikä sitä pidä esittää mitattuna.

##### Yhä auki: yksi kontrolloitu ajo

Puhelin pöydälle, ruutu kiinni, ei koskea, yön yli, man-down päällä. Sama koe kuin
11.–12.9. yhdellä muuttujalla. Se ratkaisee molemmat avoimet luvut kerralla — ja jos
`doze=ei` toistuu silloinkin, syy ei ole liikkeessä vaan anturikuuntelussa, ja silloin
man-downin todellinen hinta on Dozen menetys eikä anturin virta.

#### v13 12.9.2026: anturin lepolukema ei ole 9,81

Man-down oli päällä ja anturi toimitti näytteitä, mutta liikkumattomuutta ei havaittu
kertaakaan kymmenessä minuutissa. Vika ei ollut anturissa eikä koodissa vaan **säännön
oletuksessa.**

Luettu laitteen omasta anturipuskurista (`dumpsys sensorservice`), 50 näytettä puhelin
liikkumatta pöydällä:

| | |
|---|---|
| Voimakkuus | 10,285 – 10,437, keskiarvo **10,378** |
| Poikkeama 9,81:stä | **+0,568** |
| Yli 0,6 rajan | **8 / 50 eli 16 %** |
| Peräkkäisten ero | keskiarvo 0,026, suurin **0,110** |

Sääntö oli `|voimakkuus − 9,81| ≤ 0,6`. Anturin puolen yksikön kalibrointipoikkeama söi
toleranssista 0,57 ja jäljelle jäi 0,03. Joka kuudes näyte nollasi paikallaanolon, eikä
viisi minuuttia täyttynyt koskaan. **Vika ei näkynyt minään muuna kuin hiljaisuutena.**

Paikallaanolo mitataan nyt peräkkäisten näytteiden erosta (`LIIKKUMATTA_MUUTOS = 0,35`).
Kalibrointipoikkeama on sama molemmissa näytteissä ja kumoutuu erotuksessa. Raja on
kolminkertainen mitattuun lepokohinaan nähden — mitattu eikä arvattu.

**Sama vika oli selaimen toteutuksessa**, eikä sitä olisi huomattu sieltä: se olisi vain
jättänyt hälyttämättä. Korjattu molempiin samoilla testivektoreilla.

Kaksi seurausta jotka testit paljastivat ja jotka on muistettava sääntöä muutettaessa:

**Iskun jälkeen vertailukohta on tyhjennettävä.** Ensimmäinen näyte iskun jälkeen putoaa
35:stä kymmeneen, ja muutossääntö lukisi sen liikkeeksi — se nollaisi juuri kirjatun
iskun, eikä kaatumista voisi havaita koskaan.

**Vakiona pysyvä luku on nyt paikallaan riippumatta arvostaan.** Testivektoreissa liike on
esitettävä heiluvana arvona. Vanhoissa vektoreissa liikettä esitettiin antamalla arvo
kaukana 9,81:stä — mikä on vanhan säännön virhe pienoiskoossa.

#### v20 13.9.2026: hälytysääni ei ollut koskaan herätysäänellä

Ääni oli kentällä hiljainen, vaikka herätyskanava nostettiin kyselyn ajaksi täysille.
Mittarit sulkivat pois väärän selityksen ennen kuin koodiin koskettiin:
`kysely_aanta_ei_voitu_korottaa` esiintyi lokissa **0 kertaa** ja `dumpsys audio` näytti
tason palautuneen kyselyn jälkeen. Nosto siis toimi. Vika oli muualla.

Vika oli kutsujärjestyksessä:

```java
aani = MediaPlayer.create(this, R.raw.halytys);   // valmistelee soittimen (prepare)
aani.setAudioAttributes(... USAGE_ALARM ...);     // liian myöhään
```

`create()` kutsuu `prepare()`:n ennen kuin se palaa, ja äänen määreet on asetettava
**ennen** valmistelua. `USAGE_ALARM` ei siis päätynyt soittimeen kertaakaan: ääni kulki
mediakanavaa, noudatti median voimakkuutta eikä ohittanut äänetöntä tilaa.

**Tämä tarkoittaa, ettei äänettömän tilan ohitus ollut koskaan toiminut.** Se oli
kirjattuna koodin kommentteihin ominaisuutena koko erän 12 ajan, ja se oli koko ajan
olettamus. Ilmoituskanava (`halytys2`) oli määritelty oikein — kanavan määreet asetetaan
eri rajapinnan kautta — joten ilmoituksen ääni tuli herätyskanavaa ja näkymän ääni ei.
Kaksi ääntä samasta kyselystä kulki siis eri kanavia, mikä selittää myös sen miksi ne
kuulostivat erilaisilta.

Soitin rakennetaan nyt käsin siinä järjestyksessä jonka rajapinta vaatii: `new
MediaPlayer()` → `setAudioAttributes` → `setDataSource` → `prepare()` → `start()`.

##### Todennus laitteella

| Mittari | Arvo |
|---|---|
| `dumpsys audio` aktiivinen soitin | `MediaPlayer state:started` **`usage=USAGE_ALARM`** |
| Lokirivi | `kysely_aani_alkoi kanava=halytys taso=15/15` |
| Puhelimen tila kokeen aikana | äänetön |
| Vartijan havainto | ääni soi kovaa |

Kolme riippumatonta mittaria ja yksi korvin tehty havainto. Aiemmin sama `dumpsys`-rivi
olisi lukenut `usage=USAGE_MEDIA`; se on se yksi merkkijono joka erottaa korjatun
toteutuksen rikkinäisestä, eikä sitä ollut katsottu kertaakaan.

##### Onnistuminen kirjataan, ei vain epäonnistuminen

`kysely_aani_alkoi` on uusi rivi. Perustelu on sama kuin muuallakin: "ääni ei kuulunut" on
kentältä tuleva havainto joka voi tarkoittaa kolmea eri asiaa — soitin ei käynnistynyt,
taso oli nollassa, tai ääni soi mutta puhelin oli laukussa. Ilman tätä riviä niitä ei
pysty erottamaan jälkikäteen. Eilen ei pystynyt.

Samalla `vapautaSoitin()` ajetaan ennen uuden soittimen luomista. Ääni käynnistetään
kahdesta paikasta — näkymän luonnista ja epäonnistuneen tunnistuksen jälkeen — ja
päällekkäin soivat soittimet olivat se mikä kentällä kuultiin kahtena äänenä.

#### v20 13.9.2026: liikkumattomuusraja 5 min → 30–60 min

Edellisen päivän kenttäajo (yllä) osoitti viiden minuutin rajan kelvottomaksi. Muutos
tehtiin molempiin kieliin ja palvelimeen:

| | Ennen | Nyt |
|---|---|---|
| Alaraja | 5 min | **30 min** |
| Yläraja | 60 min | 60 min |
| Oletus | 5 min | **60 min** |
| Valikko käyttöliittymässä | 5/10/15/20/30/45/60 | **30/45/60** |

Iskun jälkeinen 12 sekuntia **ei** muuttunut. Kaatuminen tunnistetaan kiihtyvyyspiikistä
eikä ajasta, ja siinä minuuttien odottaminen olisi vaarallista.

**Jo tallennettu 5 luetaan 30:ksi.** Alaraja nostetaan lukuhetkellä eikä tietuetta
muuteta. Vaihtoehto olisi ollut kunnioittaa vanhaa arvoa, eli jättää tunnetusti liian
tiheä kysely voimaan niissä kohteissa jotka ehtivät sen tallentaa. Tästä on oma testi,
jotta muutos ei katoa myöhemmässä siivouksessa.

Todennettu laitteessa asti: `anturi_alkoi vali_ms=250 liikkumaton_min=30`.

##### Sivulöydös: `Number(null)` on nolla eikä NaN

Rajojen muuttaminen paljasti virheen joka oli ollut olemassa alusta asti:

```js
const luku = Number(raaka?.liikkumatonMin);   // Number(null) === 0
```

Puuttuva asetus puristui **alarajaan** sen sijaan että olisi pudonnut oletukseen. Niin
kauan kuin alaraja ja oletus olivat sama luku 5, virhe ei näkynyt missään — testi
`min(null) === MANDOWN_OLETUS_MIN` meni läpi väärästä syystä. Se paljastui vasta sinä
hetkenä kun luvut erosivat toisistaan.

Ero on merkityksellinen juuri turva-asetuksessa: tallentamaton arvo ei saa näyttää
tarkoituksella valitulta tiheimmältä rajalta. Korjattu yhteiseen `minuutitRajoissa`-
apuriin, joka kattaa myös kuittausvälin — samassa funktiossa oli sama virhe.

##### Jäljellä erän 12 avoimista kohdista

Kontrolloitu yön yli -ajo on yhä tekemättä: puhelin pöydälle, ruutu kiinni, ei koskea,
man-down päällä. Se ratkaisee molemmat mittaamatta jääneet luvut — kestääkö anturi Dozen
ja mikä on man-downin todellinen akkuhinta. Muuttunut liikkumattomuusraja ei vaikuta
kokeeseen: 30 minuuttia täyttyy yön aikana yhtä varmasti kuin viisi.

#### v21 13.9.2026: yksi tapahtuma, yksi nimi

Päivystäjä pyysi tarkistuksen, vartija kuittasi yhdessätoista sekunnissa, ja
hälytyskeskus näytti tyhjää. Kysymys kuului: meninkö minä pieleen vai järjestelmä?
Kumpikaan ei ollut mennyt — mutta sen selvittäminen vaati laitteen lokin lukemista, eikä
se ole vastaus jonka päivystäjä voi saada kello kolme yöllä.

Taustalla oli kaksi erillistä vikaa, molemmat samaa lajia: **sama asia oli nimetty
kahdella eri tavalla.**

##### 1. Lokirivin nimi vaihtui haaran mukaan

| Tilanne | Rivi ennen | Rivi nyt |
|---|---|---|
| Rutiinikuittaus | `kuittaus_kuitattu vali_min=60` | `kuittaus_kuitattu jatkui=kylla vali_min=60` |
| Pakotettu tarkistus | `tarkistus_kuitattu ajastin_peruttu` | `kuittaus_kuitattu jatkui=ei ajastin_peruttu` |

Haku `kuittaus_` löysi vain puolet kuittauksista. **Minä itse tein juuri sen virheen
saman päivän aikana**: hain lokista `kuittaus_|halytys_|kysely_`, vartijan kuittaus ei
osunut hakuun, ja ilmoitin käyttäjälle että kaksi hälytystä oli jäänyt auki. Ne eivät
olleet. Väärä nimi ei ole tyylivirhe vaan se, ettei tapahtumaa löydä silloin kun sitä
etsitään — ja se on tämän lokin ainoa tehtävä.

Työnjako on nyt kirjattu koodiin: `tarkistus_*` kertoo pyynnön saapumisesta
palvelimelta, `kuittaus_*` kyselyn koko elinkaaresta. Haara on kentässä `jatkui=` eikä
rivin nimessä. Kenttä kertoo mitä kuittaus **teki ajastimelle** eikä kuka kyselyn
aiheutti — pakotettu tarkistus kohteessa jolla on rutiinivalvonta jatkaa rutiinia, ja
silloin `jatkui=kylla` on totta riippumatta siitä että päivystäjä painoi nappia.

##### 2. Historiamerkinnällä oli kaksi muotoa

`/api/vuoro/tarkistus` kokosi oman historiamerkintänsä käsin ja käytti eri avainnimiä
kuin `halytys.js`:n `merkinta()`: `laji` eikä `tapahtuma`, `aika` eikä `ts`. Selaimen
`Halytys`-tyyppi lupaa `{ ts, tapahtuma, user, teksti }`, joten nämä merkinnät **eivät
vastanneet omaa tyyppiään** — mikään ei kaatunut, ne vain eivät löytyneet sieltä mistä
niitä olisi etsitty. `merkinta` on nyt viety ulos ja endpoint käyttää sitä.

##### 3. Onnistunut tarkistus ei näkynyt hälytyskeskuksessa

Käynnissä oleva ajastin näkyy omassa osiossaan, mutta vain niin kauan kuin se on
käynnissä. Nopeasti kuitattu tarkistus on ruudulla kymmenen sekuntia, ja peruttu tietue
putoaa sen jälkeen kaikista listoista. Päivystäjän näkökulmasta **onnistunut tarkistus
näytti täsmälleen samalta kuin tarkistus jota ei koskaan pyydetty.**

Uusi osio "Pyydetyt tarkistukset" listaa kahdentoista tunnin ajalta jokaisen pyydetyn
tarkistuksen lopputuloksineen ja vastausaikoineen. Kaksitoista tuntia kattaa yhden
vuoron: vuoron alussa pyydetyn tarkistuksen on näyttävä vielä sen lopussa.

Kolme yksityiskohtaa joilla on merkitys:

**Tunnistus historiamerkinnästä eikä tilasta.** `peruttu` syntyy myös vuoron päättyessä,
eikä sitä pidä esittää tarkistuksena.

**Lopputulos luetaan historian viimeisestä merkinnästä.** Jos ajastimen lopetti joku muu
kuin vartija itse, rivillä lukee kuka — ei "Vartija kuittasi". Sama sääntö kuin
lokiriveissä: väärä nimi on pahempi kuin puuttuva tieto.

**Vastausaika lasketaan pyynnöstä eikä ajastimen alusta.** Pakotettu tarkistus siirtää jo
olemassa olevaa ajastinta, jonka `alkoi` voi olla tuntien takaa.

Todennettu esikatselussa kuudella tietueella, joista neljän kuuluu näkyä ja kahden ei:

| Tapaus | Rivi |
|---|---|
| Kuittasi 11 s | `Vartija kuittasi · vastasi 0:11` |
| Kesken | `Odottaa vastausta` |
| Ei vastannut | `Ei vastannut — hälytys lähti` |
| Muu lopetti | `paivystaja.koski lopetti ajastimen` |
| Ajastin ilman tarkistuspyyntöä | ei listalla |
| Tarkistus 13 h sitten | ei listalla |

##### Ensimmäinen julkaisu ei korjannut mitään — ja vain tuotannon data kertoi sen

Osio julkaistiin, ja se näytti tyhjää. Käyttöliittymä oli oikein; **palvelin ei kirjoita
tarkistusmerkintää siinä haarassa joka oikeasti ajetaan.**

`/api/vuoro/tarkistus` toimii kahdella tavalla. Jos vartijalla on ajastin käynnissä, se
siirretään — ja siihen haaraan merkintä oli kirjoitettu. Jos ajastinta ei ole, luodaan
uusi, eikä siihen haaraan kirjoitettu mitään. Kohteella jolla ei ole rutiinikuittausta
**ei koskaan ole ajastinta siirrettäväksi**, joten käytännössä ajetaan aina jälkimmäinen.

Pahempi seuraus kuin puuttuva rivi listalla: `luoAjastin` merkitsee luojaksi **vartijan**,
koska ajastin on hänen nimissään. Päivystäjän pyytämä tarkistus tallentui siis tietueena
josta ei voinut päätellä kuka sen pyysi. Neljä peräkkäistä tarkistusta 13.9. näyttää
tietokannassa tältä:

```
{"ts":"...11:36:09Z","tapahtuma":"luotu","user":"Turva051","teksti":"Ajastin 2 min"}
{"ts":"...11:36:24Z","tapahtuma":"peruttu","user":"Turva051","teksti":""}
```

Vartija näyttää luoneen ja peruneen oman ajastimensa. Päivystäjää ei mainita missään.

**Vian löysi vain tuotannon tietueiden lukeminen.** Käyttöliittymä näytti tyhjää listaa,
mikä on täsmälleen sama havainto kuin ennen koko korjausta — jos olisin kysynyt
käyttäjältä "näkyykö rivi", vastaus "ei" olisi ollut yhtä yhteensopiva sen kanssa että
julkaisu ei ollut mennyt läpi, että selain oli välimuistissa, tai että osio on rikki.
Kolme eri syytä, sama oire, eikä mitään tapaa erottaa niitä ilman dataa.

##### Testi joka olisi estänyt tämän

`/api/vuoro/tarkistus` ei ollut e2e-ajossa lainkaan. Nyt on, molemmat haarat erikseen:

| Väite | |
|---|---|
| `paivystaja saa pyytaa tarkistusta` | 200 |
| `UUSI ajastin saa tarkistusmerkinnan` | haara: ei käynnissä olevaa ajastinta |
| `merkinnasta selviaa kuka pyysi ja milloin` | kentät `ts` ja `user`, ei `aika` ja `laji` |
| `toinen pyynto siirtaa saman ajastimen` | ei luo uutta |
| `SIIRRETTY ajastin saa oman tarkistusmerkintansa` | haara: ajastin jo käynnissä |

Testi todennettiin poistamalla korjaus hetkeksi: kaikki kolme merkintäväitettä kaatuvat
ilman sitä. Läpimenevä testi jota ei ole nähty kaatumassa ei todista mitään.

#### v22 13.9.2026: mittaustila — koe ei ollut mahdollinen sellaisenaan

Erän 12 avoin kohta kuului: "puhelin pöydälle, ruutu kiinni, ei koskea, yön yli, man-down
päällä". Kun ajoa oltiin aloittamassa, kävi ilmi ettei se voi mitata sitä mitä sen on
tarkoitus mitata.

Paikallaan makaava puhelin laukaisee liikkumattomuussäännön noin 32 minuutin välein
(30 min raja + 2 min vastausaika). Yön aikana se tarkoittaa noin **19 kyselyä**, ja
jokainen niistä

- sytyttää ruudun ja soittaa hälytysäänen täysillä → **estää Dozen ja kuluttaa akkua**,
  eli tuhoaa molemmat mittaukset,
- jää vastaamatta → **on oikea hälytys**. Eskaloinnin tila tarkistettiin ennen ajoa:
  `dryRun: false`. Tekstiviestit olisivat lähteneet oikeasti, noin 19 kappaletta yön
  aikana, saldosta 177.

Suunnitelma kirjoitettiin kun raja oli 5 minuuttia, jolloin sama ristiriita olisi ollut
vielä pahempi — mitattuna 14 kyselyä 53 minuutissa. Ristiriitaa ei huomattu silloin.

**Mitattavat asiat ovat anturikuuntelun ominaisuuksia, eivät säännön.** Kestääkö anturi
Dozen ja paljonko se maksaa akkua — kumpikaan ei riipu siitä laukeaako sääntö. Sääntö ei
siis ole mittauksen kohde vaan sen este.

##### Mittaustila

`Mittaustila`-kytkin diagnostiikkanäkymässä. Anturi käy normaalisti — näytteenotto,
näytelaskuri, iskun tunnistus — ja vain liikkumattomuussääntö vaimennetaan.

Iskun tunnistus jää päälle tarkoituksella. Se ei laukea paikallaan makaavasta puhelimesta
eikä siis häiritse mittausta, ja sen sammuttaminen tekisi kytkimestä vaarallisemman kuin
se on.

**Kolme suojaa sitä vastaan että kytkin jää huomaamatta päälle.** Turva-asetuksen hiljainen
poiskytkentä on pahempi vika kuin mikään mitä sillä mitataan:

| Suoja | |
|---|---|
| `mittaustila=kylla\|ei` **jokaisella** lokirivillä | Puuttuva kenttä kertoisi vain että versio on vanha. Aina läsnä oleva kenttä kertoo tilan yksiselitteisesti. |
| `anturi_epaily_vaimennettu laji=liikkumaton` | Kirjataan silloin kun vaimennus tapahtuu. Jälkiselvityksessä näkyy mitkä kyselyt jäivät tekemättä ja milloin — ja se on itsessään mittaustulos. |
| Vuoron päättyminen sammuttaa | Kytkin ei elä yli vuoron. Unohtaminen maksaa korkeintaan yhden vuoron. |

Lisäksi diagnostiikkanäkymässä on rivi `Mittaustila` myös pois päältä ollessa, ja napissa
lukee nykyinen tila eikä pelkkä toiminto.

##### Mitä ajo EI vastaa

Tämä ajo mittaa anturikuuntelun hinnan ja Doze-kestävyyden. Se **ei** vastaa siihen
lähteekö man-down-hälytys dozeavasta puhelimesta kello kolme yöllä — se on eri koe, ja se
on yhä tekemättä. Se vaatii eskaloinnin kuivaharjoitteluun ja valmiuden siihen että
puhelin soi puolen tunnin välein.

### Erä 13 — Hätäpainike sovelluksen ulkopuolelta

| Osa | Uutta |
|---|---|
| Pysyvän ilmoituksen painike + vahvistus | ~120 |
| `HataTile.java` — pika-asetusruutu | ~130 |

Pienin erä, noin 250 riviä. Sopii tehtäväksi sillä aikaa kun erän 12 kenttätestit ja
Play-lomakkeet ovat kesken.

### Erä 14 — Apupyyntö ja widget

| Osa | Uutta |
|---|---|
| Palvelin: tyyppi `apupyynto`, kohdistus lähimpiin, kanavaviesti | ~200 + testit ~150 |
| Web: tyyppi, label, näkyminen valvomossa, "Olen tulossa" | ~200 |
| `ApuWidget.java`, `ApuReceiver.java`, kolme RemoteViews-tilaa | ~300 + XML ~150 |
| Vastaanottajan ilmoitus ja kuittaus | ~120 |

**Valmis kun:** widgetin painallus kotinäytöltä tuottaa apupyynnön, lähin vartija saa
ilmoituksen etäisyydellä, ja hänen kuittauksensa näkyy widgetissä tekstinä
"Matti tulossa" **ja** pysäyttää eskaloinnin.

### Erä 15 — Julkaisu: diagnostiikka, Play ja juridiikka

| Osa | Uutta |
|---|---|
| `Diagnostiikka.java` — lupien ja akkuoptimoinnin tarkistuslista | ~200 |
| Akkuoptimoinnin ohjaus ja valmistajakohtaiset ohjeet | ~80 |
| `asennus/KAUPPA.md`: data safety, FGS-perustelut | paperityö |
| `public/tietosuoja.html`: sijainti ja anturidata | paperityö |

### Rinnakkain: paperityö on latenssia, ei työmäärää

Nämä eivät vie päiviä vaan **odottavat päiviä**, joten ne on pantava liikkeelle heti kun
erä 10 tuottaa ensimmäisen AAB:n — ei erässä 15:

- `USE_FULL_SCREEN_INTENT` -ilmoituslomake Playlle
- foreground-palvelutyyppien (`location`, `specialUse`) perustelut
- data safety -lomakkeen päivitys
- **YT-menettely ja DPIA** — pisin latenssi kaikista, eikä sitä voi nopeuttaa koodilla

### Kokonaisaikataulu

Historiallinen vauhti tässä projektissa on noin 160 committia ja 49 000 riviä
29 vuorokaudessa, eli yksi erä on ollut 2–4 aktiivista päivää. Natiivissa on kaksi
lisäkitkaa joita webissä ei ollut: **jokainen muutos on testattava oikealla laitteella**,
ja kenttätestit kestävät kokonaisen vuoron reaaliajassa. Realistinen haarukka on siis
**4–6 viikkoa** erille 10–15, ja sen sisällä erä 10 on noin kolmannes.

Kalenterin määrää käytännössä juridiikka, ei koodi.

## Avoimet päätökset

1. **Apupyynnön kuittauksen merkitys.** Onko "Olen tulossa" pelkkä kuittaus vai pitääkö
   saapumisesta jäädä erillinen merkintä jälkiraporttiin?
2. ~~**Sijaintiväli.**~~ **Ratkaistu 12.9.2026:** 60 s jää. Yön yli -ajossa valvonnan
   oma kulutus oli 1,56 %/h, eli kahdeksan tunnin vuoro maksaa 12,5 prosenttiyksikköä.
   Ks. "Yön yli -ajo 11.–12.9.2026".
3. **Diagnostiikkanäkymään ei pääse sovelluksesta.** `DiagnostiikkaActivity` on
   `exported="false"` eikä sillä ole omaa intent-suodatinta, joten se avautuu vain
   napautetusta `turvajohto-guard://tila` -linkistä. Selaimen osoiteriville kirjoitettuna
   Chrome tekee siitä haun, eikä koko web-käyttöliittymässä ole linkkiä siihen. Näkymä on
   rakennettu vastaamaan vartijan ja päivystäjän kysymykseen "miksi hälytys ei tullut" —
   eivätkä he pääse siihen käsiksi. Havaittu 13.9.2026 kun käyttäjä ei saanut sitä auki.
