# Asennettava sovellus — manifesti, kuvakkeet, takaisin-painike ja istunto

Tämä hakemisto tekee Turvajohto OS:sta laitteelle asennettavan sovelluksen. Se kattaa
Android-edellytyslistan kohdat 1–5 (`2026-09-04 - Turvajohto OS Android-sovelluksen
edellytykset`). Kohdat 6–8 ovat yhä avoinna, ks. lopun tarkistuslista.

## Mikä on valmiina

| Asia | Tila |
|---|---|
| Web app manifest, erikseen EVENTille ja GUARDille | valmis |
| Kuvakkeet: 192, 512, maskable 192, maskable 512, apple-touch 180, favicon | valmis |
| Manifestin ja kuvakkeiden kytkentä sivulle tuotteen mukaan | valmis |
| Takaisin-painike: näkymät ja modaalit historiaan | valmis, `src/shared/navigointi.ts` |
| Istunto: rajoittamaton sovelluksessa, rajattu selaimessa | valmis, `server/istunto.js` |
| `/.well-known/assetlinks.json` -reitti ja generaattori | valmis, **sisältö tyhjä** |
| Sovelluksen allekirjoitustiiviste assetlinksiin | **puuttuu** — syntyy vasta kun sovellus on olemassa |

Sovellus on siis **jo nyt asennettavissa selaimesta** (Chrome Androidilla: valikko →
_Asenna sovellus_). Play Store on erillinen askel eikä sitä tarvita asennukseen.

## Komennot

```
npm run asennus
```

Kirjoittaa kuvakkeet (`public/kuvakkeet/`) ja manifestit (`public/manifest-event.json`,
`public/manifest-guard.json`). Aja tämä kun kuvake tai manifestin sisältö muuttuu, ja
committaa syntyneet tiedostot — ne ovat versionhallinnassa eikä build tuota niitä.

```
npm run assetlinks -- fi.turvajohto_os.guard=<SHA-256>[,<SHA-256>]
```

Kirjoittaa `public/.well-known/assetlinks.json`. Ilman argumentteja tulostaa ohjeen ja
tiedoston nykyisen sisällön kirjoittamatta mitään.

Kaikki perustelut — miksi scope on `/guard` eikä `/guard/`, miksi maskable-kuvakkeessa
merkki on pienempi, mistä sormenjälki löytyy — ovat skriptien kommenteissa
(`rakenna.mjs`, `assetlinks.mjs`). JSON ei tunne kommentteja, joten ne ovat siellä
missä arvotkin.

## Kaksi manifestia, ei yhtä

Sovellus on kaksi tuotetta samassa osoitteessa (`/event` ja `/guard`), ja `index.html`
on niille yhteinen. Manifestissa taas on tuotteen nimi, `start_url` ja kuvakkeet, ja
sivulla voi olla vain yksi voimassa oleva manifesti kerrallaan.

Siksi manifesti, kuvake, teemaväri ja välilehden otsikko asetetaan ajossa sen mukaan
kumpi tuote polusta ratkesi — samassa kohdassa jossa väriteema asetetaan
(`src/main.tsx` → `src/shared/kuvakkeet.ts`). Yhdellä staattisella manifestilla
vartija saisi kotinäytölleen kuvakkeen joka avaa tapahtumapuolen.

Mainossivu (`/`) ei saa manifestia: se on julkinen esittelysivu johon ei kirjauduta,
eikä sitä ole tarkoitus asentaa. Kuvake sillä on, jottei välilehdellä ole tyhjä paperi.

## Kuvakkeen ilme

Laatta tuotteen tunnusvärillä, merkki valkoisena: EVENT indigo + kalenteri, GUARD
turvavihreä + kilpi, mainossivu tumma + kilpi. Merkit ovat samat lucide-ikonit joita
mainossivu käyttää, ja ne luetaan generaattorissa suoraan `node_modules`ista — käsin
kopioitu polkudata vanhenisi hiljaa sovelluksen oman ikonin päivittyessä.

## Play Store: TWA-polku

Trusted Web Activity on Android-sovellus jonka sisällä on Chrome ilman osoitepalkkia.
Se lataa saman sivuston samasta osoitteesta; erillistä sovelluskoodia ei kirjoiteta.

### 1. Paketin nimi — päätä ensin, sitä ei voi vaihtaa

Paketin nimi on Play Storessa **pysyvä**: sitä ei voi vaihtaa julkaisun jälkeen
koskaan, eikä samaa nimeä voi käyttää uudelleen.

Sallitut merkit ovat `[a-zA-Z0-9_]`, segmenttejä on vähintään kaksi ja jokainen niistä
alkaa kirjaimella. **Alaviiva siis kelpaa, väliviiva ei** — `fi.turvajohto-os.guard` ei
ole kelvollinen tunnus, mutta `fi.turvajohto_os.guard` on, ja se on lähempänä
verkkotunnusta `turvajohto-os.fi` kuin väliviivan pudottaminen. Valittu nimeäminen:

- `fi.turvajohto_os.guard` — Turvajohto GUARD
- `fi.turvajohto_os.event` — Turvajohto EVENT (jos EVENTistäkin tehdään sovellus)

Kaksi tuotetta tarkoittaa **kahta sovellusta kaupassa**, koska TWA:lla on yksi
aloitusosoite. Testisovellukseksi riittää toinen; sama `assetlinks.json` voi silti
nimetä molemmat.

### 2. Sovelluksen kääriminen

Aja **repon ULKOPUOLELLA** omassa hakemistossaan (esim. `C:\Users\Arttu\Documents\twa-guard`):
Bubblewrap tuottaa Android-projektin, avainvaraston ja gradle-roinaa, eikä mikään siitä
kuulu sivuston repoon.

```
npx @bubblewrap/cli init --manifest https://turvajohto-os.fi/manifest-guard.json
```

**Java puuttuu tästä koneesta** (4.9.2026). Bubblewrap tarjoutuu lataamaan oman JDK:nsa
ja Android SDK:nsa `~/.bubblewrap`-hakemistoon, noin gigatavun verran — hyväksy se, sillä
erillistä Android Studiota ei tarvita.

Manifestista tulevat valmiina nimi, lyhyt nimi, värit, orientaatio, aloitusosoite ja
kuvakkeet. Loput se kysyy, ja näistä neljä on päätöksiä eikä muodollisuuksia:

| Kysymys | Vastaus | Miksi |
|---|---|---|
| Application ID | `fi.turvajohto_os.guard` | Pysyvä, ei vaihdettavissa julkaisun jälkeen |
| Display mode | `standalone` | Sama kuin manifestissa |
| Fallback behaviour | `customtabs` | Oletus; webview menettää palvelutyöntekijän |
| **Notification delegation** | **ei** | Ks. alla |
| **Request geolocation permission** | **ei** | Ks. alla |
| Key store / passwords | uusi avain, **kirjoita salasana talteen** | Ks. alla |
| App version / versionCode | `1` / `1` | Sisäinen testi |

**Ilmoitusdelegointi = ei, vaikka push on suunnitteilla (kohta 7).** Delegointi lisää
sovellukseen `POST_NOTIFICATIONS`-oikeuden. Oikeus jota sovellus ei käytä on Play-arviossa
turhaa selitettävää ja Data safety -lomakkeessa väärä vastaus. Kytketään päälle siinä
versiossa joka oikeasti lähettää ilmoituksia — se on uusi build, ei uusi paketti.

**Sijaintidelegointi = ei tässä vaiheessa.** Sijaintiseuranta on kytketty pois ja sen
juridiikka on yhä auki (kohta 8), eikä `ACCESS_FINE_LOCATION` kuulu sovellukseen jossa
toimintoa ei käytetä — se on Play Storen tarkimmin valvottuja oikeuksia. **Huom: kun
sijainti joskus otetaan käyttöön, selaimen paikannus on testattava nimenomaan TWA:n
sisällä** — TWA:ssa sijaintilupa on isäntäsovelluksen eikä Chromen, ja tämä on
tarkistettava laitteella eikä pääteltävä.

**Avainvarasto: tästä ei ole paluuta.** Bubblewrap luo `android.keystore`-tiedoston ja
kysyy sille salasanan. Jos tiedosto tai salasana katoaa, **sovellusta ei voi enää
koskaan päivittää** — ainoa tie olisi uusi paketti uudella nimellä, eli käytännössä uusi
sovellus kaupassa. Ota molemmista varmuuskopio heti, äläkä jätä avainta vain tähän
hakemistoon.

Sitten build ja asennus omaan puhelimeen (USB-debug päällä):

```
npx @bubblewrap/cli build
npx @bubblewrap/cli install
```

Ensimmäinen asennus näyttää **osoitepalkin**, ja se on odotettua: `assetlinks.json` on
vielä tyhjä. Se korjataan kohdassa 3.

### 3. Digital Asset Links — tässä testaus tyypillisesti kaatuu

`assetlinks.json` kertoo Androidille että sivusto tunnustaa sovelluksen omakseen.
Ilman kelvollista tiedostoa sovellus avaa sivuston osoitepalkin kanssa, eli näyttää
nettisivulta — eikä virheestä tule ilmoitusta mihinkään.

Tarvitset **kaksi** SHA-256-tiivistettä, ja tämä on se kohta joka yleensä unohtuu:

1. **Play-allekirjoitusavain.** Play Console → Test and release → Setup → App
   integrity → App signing key certificate → SHA-256. Tällä Google allekirjoittaa
   kaupasta ladattavan sovelluksen.
2. **Oma avain**, jolla Bubblewrap allekirjoitti sen APK:n jonka asennat itse
   kehityksen aikana (`bubblewrap install`) — eli juuri sen version jolla testaat
   ensimmäisenä:
   ```
   keytool -list -v -keystore android.keystore -alias android
   ```

Molemmat samalle paketille pilkulla eroteltuna:

```
npm run assetlinks -- fi.turvajohto_os.guard=<PLAY-SHA256>,<OMA-SHA256>
```

Sitten julkaise sivusto ja tarkista että tiedosto todella tulee ulos:

```
curl -si https://turvajohto-os.fi/.well-known/assetlinks.json | head -20
```

Statuksen on oltava `200` ja tyypin `application/json`. **Tarkista tämä ennen kuin
asennat sovelluksen**, koska nginxin tavanomainen `location ~ /\. { deny all; }`
estäisi polun (ja samalla Let's Encryptin acme-challengen). Googlen oma tarkistin
kertoo myös syyn jos yhteys ei kelpaa:

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://turvajohto-os.fi&relation=delegate_permission/common.handle_all_urls
```

### 4. Play Consolen paperit (ei koodia)

- **Tietosuojaseloste julkisesti saatavilla** — pakollinen. Kirjoitettu 5.9.2026:
  `public/tietosuoja.html`, linkitetty mainossivun alareunasta. Sisällön avoimet
  kohdat: ks. "Tietosuojaselosteen avoimet kohdat" alempana. Sovellus käsittelee
  henkilötunnuksia ja sijaintia, joten se ei ole muotoseikka vaan asiakirja jonka
  sisällön on vastattava sitä mitä sovellus oikeasti tekee.
- **Data safety -lomake**: mitä kerätään, mihin, kenelle jaetaan, salataanko siirrossa.
- Käyttöoikeuksien perustelut, erityisesti sijainti ja kamera.
- **Testitunnukset arvioijalle.** Sovellus ei ole julkinen: siihen kirjaudutaan, ja
  arvioija hylkää sovelluksen jonka sisään ei pääse.
- Sisäinen testaus (internal testing) on oikea kanava ensimmäiselle versiolle: se ei
  vaadi arviointia ja jakelu tapahtuu linkillä.

## Takaisin-painike (kohta 4, tehty)

`display: standalone` tarkoittaa, että Androidin takaisin-nappi on sovelluksen ainoa
paluunappi — ja jos historiassa ei ole mitään, se **sulkee sovelluksen** kesken
lomakkeen tai kirjauksen. Navigointi on komponentin tilassa (EVENT: `activeTab` ja
ylätason `viewing*`-tilat, GUARD: `*Kohde`-tilat), joten historiaan piti viedä ne.

Toteutus on `src/shared/navigointi.ts`, kaksi hookia:

- `useHistorianavigointi(nakyma, siirry)` — kutsutaan kertaalleen sovelluksen
  juuressa. `nakyma` on näkymätunniste, joka **johdetaan** sovelluksen omista tiloista
  (ei uutta rinnakkaista navigointitilaa), ja `siirry` asettaa tilat takaisin-napin
  pyytämään näkymään.
- `useTakaisinEste(auki, sulje)` — tekee modaalista takaisin-napilla suljettavan.
  Modaali saa oman historiamerkintänsä, jonka takaisin kuluttaa: **näkymä ei vaihdu,
  vain päällimmäinen modaali sulkeutuu.** Kytketty EVENTin yhdeksään ja GUARDin yhteen
  modaaliin.

Osoiterivi ei muutu: näkymä kuljetetaan `history.pushState`in tilaobjektissa. Omat
osoitteet näkymille vaatisivat nginxiltä polkukohtaisen ohjauksen index.html:ään ja
rikkoisivat manifestin scopen — eikä näkymien jakaminen linkkinä ole tavoite, koska
sovellukseen kirjaudutaan.

Malli on "yksi merkintä yhtä siirtymää kohti": myös sovelluksen oma paluulinkki työntää
merkinnän, joten takaisin-nappi peruu käyttäjän viimeisen siirtymän kumpaan suuntaan
tahansa. Se on sama käyttäytyminen kuin tavallisella verkkosivulla. Juurinäkymässä
(EVENT: etusivu, GUARD: kohdevalinta) takaisin poistuu sovelluksesta, kuten pitääkin.

**Mikä ei ole historiassa:** näkymien sisäinen selailu — tapahtuman tiedostojen
kansiopolku, kierrospohjan sisäiset vaiheet — eikä kesken olevan lomakkeen
varmistuskysely ("haluatko varmasti poistua"). Takaisin peruu näkymän, ei kirjoitettua
tekstiä; kenttien sisältö säilyy sovelluksen tilassa, joten se on paikallaan kun
näkymään palataan.

## Istunnon kesto (kohta 5, tehty)

**Sovelluksessa istuntoa ei rajoiteta. Selaimessa rajoitetaan.** Kesto ja sen
perustelut ovat `server/istunto.js`:ssä:

| Missä | Kesto |
|---|---|
| Asennettu sovellus | ei rajoitettu (tekninen yläraja 365 vrk, liukuva) |
| Selain, pääkäyttäjä | 12 h kiinteä |
| Selain, muu käyttäjä | 60 min liukuva |

Aiempi 60 minuutin raja oli **joutokäyntiraja**: aktiivikäyttö ei katkennut, mutta
tunti taskussa kirjasi ulos. Kentällä juuri se on kestämätöntä. Selaimessa sama raja
on paikallaan, koska siellä istunto on auki työaseman selaimessa joka voi jäädä
vartioimatta.

Rajoittamattoman istunnon tekninen yläraja on **vuosi ja liukuva**, eli vuoro, viikko
tai kuukauden loma ei katkaise sitä. Se ei siis ole kenttäkäytön raja vaan varmistus:
laite joka katoaa käytöstä kokonaan ei jää kirjautuneeksi ikuisesti siinäkään
tapauksessa ettei pakkouloskirjausta muisteta tehdä. Yhden vakion muutos jos linja
muuttuu.

**Miten palvelin tietää kummasta on kyse.** Selain kertoo sen kirjautumisen yhteydessä
(`display-mode: standalone`, `src/shared/asennettu.ts`), ja palvelin leivoo tiedon
allekirjoitettuun tokeniin. Siksi istunnon pituus päätetään kirjautumishetkellä eikä
joka pyynnössä: muuten sama eväste vaihtaisi pituuttaan sen mukaan kummasta viimeisin
pyyntö tuli, ja selaimessa käynti lyhentäisi kentällä olevan vartijan istunnon.
Kirjautumisen laji (`sovellus` / `selain`) menee myös audit-lokiin.

Palvelin ei voi päätellä tätä itse: TWA on tavallinen Chrome, ja sen ainoa tunnistettava
piirre (`X-Requested-With`) tulee vain sivulatauksessa jonka tarjoilee nginx. Väittämä
on siis väärennettävissä — mutta vain omalla tunnuksella kirjautumalla, eli kyse ei ole
hyökkäyspolusta vaan siitä että käyttäjä voisi ohittaa oman selainistuntonsa aikarajan.
Saman voi tehdä liikuttamalla hiirtä.

**Mihin rajoittamattoman istunnon hallittavuus perustuu.** Kaksi asiaa, ja molempien on
pidettävä:

1. **Laitteen lukitus vahvalla salasanalla on sovelluksen asentamisen ehto.** Tämä on
   organisatorinen ehto — palvelin ei voi tarkistaa sitä.
2. **Pakkouloskirjaus.** `session_invalidated_at` mitätöi käyttäjän KAIKKI istunnot
   välittömästi, myös rajoittamattoman (`server/index.js`, `getSessionUser`). Koneisto
   on jo olemassa, joten GUARD TIKEn tuleva toiminto on käyttöliittymä ja oikeus
   olemassa olevan päälle — ei uutta istuntologiikkaa. Front pollaa `/api/session`:ia
   30 s välein juuri tätä varten, ja **se pollaus jää päälle myös sovelluksessa**;
   vain automaattinen uloskirjaus joutokäynnistä on siellä pois.

## Ennen kenttäkäyttöä: mitä on yhä auki

Nämä eivät estä asennusta mutta koskevat käyttökelpoisuutta. Numerointi seuraa
edellytyslistaa.

**6. Palvelutyöntekijän päivitys asennettuna.** Selaimessa käyttäjä voi aina ladata
sivun uudelleen; asennetussa sovelluksessa ei voi. Jos palvelutyöntekijä jää jumiin
vanhaan versioon, ulospääsyä ei ole. Testattava erikseen asennettuna.

Tähän liittyy tiedossa oleva raja: palvelutyöntekijän versio (`vite.config.ts`)
lasketaan **nippujen tiedostonimistä**, eikä `public/`-hakemiston sisältö vaikuta
siihen. Jos vaihdat pelkän kuvakkeen tai manifestin ilman koodimuutosta, versio pysyy
samana ja laitteille jää vanha kopio välimuistiin. Käytännössä kuvake vaihtuu koodin
mukana, mutta jos joskus vaihtuu yksinään, tee samalla jokin koodimuutos.

**7. Push-ilmoitukset.** Hälytykset tavoittavat vain auki olevan sovelluksen. Natiivin
tärkein lisäarvo olisi juuri se että hälytys tavoittaa taskussa olevan puhelimen —
ilman pushia sovellus on sama kuin selain, omalla kuvakkeella. Oma eränsä
(Web Push tai FCM, tilausten hallinta, kytkentä erän 7 hälytysketjuun).

**8. Sijaintiseurannan juridiikka.** Natiivisovellus tekee taustasijainnista teknisesti
mahdollisen ja Play Store kysyy siitä erikseen
(`ACCESS_BACKGROUND_LOCATION` on tiukimmin valvottuja oikeuksia). Panokset nousevat:
selaimessa seuranta loppuu kun välilehti suljetaan.

## Tietosuojaselosteen avoimet kohdat

`public/tietosuoja.html` on **paikkansapitävä kuvaus järjestelmästä**: sisältö on
johdettu siitä mitä koodi oikeasti tekee (kenttäsalaus `server/store.js`, säilytysajat
`src/shared/sailytysaika.ts`, sijainti `server/sijainti.js`, tekstiviestit
`server/bulksms.js`).

Se **ei ole oikeudellinen tarkistus.** Alla olevat kohdat olivat aiemmin
HTML-kommentteina itse selostetiedostossa. Ne siirrettiin tänne 9.9.2026, koska
HTML-kommentti lähtee selaimelle sellaisenaan: se näkyy kenelle tahansa joka avaa
sivun lähdekoodin, ja päätyy myös Internet Archiven tallenteeseen pysyvästi. Julkisessa
asiakirjassa oleva "nämä perusteet pitäisi vielä tarkistaa" heikentää juuri sitä mitä
asiakirjan on tarkoitus osoittaa — myös kommenttina.

**Käsittelyperusteet (seloste kohta 4).** Käytävä läpi asiantuntijan kanssa ennen kuin
sovellukseen viedään ensimmäinen oikea henkilötieto. Erityisesti:

- henkilötunnuksen käsittelyn peruste
- toimenpiteiden kohteena olleiden henkilöiden tietojen käsittely (rikosasioihin
  liittyvä tieto)
- mahdollinen sijaintiseuranta

Nämä eivät ratkea ohjelmistolla.

**Hätäviestien siirto EU:n ulkopuolelle (seloste kohta 7).** Ennen hätäviestien
käyttöönottoa on selvitettävä BulkSMS:n palvelinsijainti ja siirron peruste
(vakiolausekkeet tai muu GDPR 46 artiklan mekanismi), ja kirjattava se selosteen
kohtaan 7 täsmällisesti. Ks. myös Traficom-tunnus, joka on erikseen auki.

**Rekisterinpitäjän yhteystieto (seloste kohta 1).** Selosteessa lukee
`tietosuoja@turvajohto-os.fi`. **Osoite ei ole vielä toiminnassa** — se on aktivoitava
ennen kuin sovellukseen viedään ensimmäinen oikea henkilötieto tai seloste annetaan
Play Consolelle. Rekisteröidyn pyyntö saapuu juuri tähän osoitteeseen, ja
toimimattomaan osoitteeseen lähetetty pyyntö on selosteen lupauksen rikkomus.

## Testaus omalla puhelimella ilman Play Storea

1. Avaa `https://turvajohto-os.fi/guard` Chromella Androidissa.
2. Valikko → _Lisää aloitusnäyttöön_ / _Asenna sovellus_.
3. Sovellus avautuu ilman selainpalkkia, oma kuvake kotinäytöllä.
4. Tarkista: kuvake ei ole leikkautunut (maskable toimii), tilapalkin väri on tumma,
   näkymä pysyy pystyasennossa (GUARD), takaisin-nappi palaa edelliseen näkymään ja
   sulkee avoimen modaalin — ja **vasta juurinäkymässä sulkee sovelluksen**.

Työpöydällä sama on tarkistettavissa `npm run preview` -palvelimessa: Chromen
DevTools → Application → Manifest näyttää manifestin, kuvakkeet ja
asennettavuusvirheet. `npm run dev` ei rekisteröi palvelutyöntekijää, joten
asennusnappi ei näy siellä.
