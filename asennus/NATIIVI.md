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
2. **Sijaintiväli.** 60 s vastaa nykyistä web-väliä. Vuoron kesto ja akun kesto
   ratkaisevat, onko se oikea — mitattava laitteella ennen lukitsemista.
