# Asennettava sovellus — manifesti, kuvakkeet ja Digital Asset Links

Tämä hakemisto tekee Turvajohto OS:sta laitteelle asennettavan sovelluksen. Se kattaa
Android-edellytyslistan kohdat 1–4 (`2026-09-04 - Turvajohto OS Android-sovelluksen
edellytykset`). Kohdat 5–8 ovat yhä avoinna, ks. lopun tarkistuslista.

## Mikä on valmiina

| Asia | Tila |
|---|---|
| Web app manifest, erikseen EVENTille ja GUARDille | valmis |
| Kuvakkeet: 192, 512, maskable 192, maskable 512, apple-touch 180, favicon | valmis |
| Manifestin ja kuvakkeiden kytkentä sivulle tuotteen mukaan | valmis |
| Takaisin-painike: näkymät ja modaalit historiaan | valmis, `src/shared/navigointi.ts` |
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

```
npx @bubblewrap/cli init --manifest https://turvajohto-os.fi/manifest-guard.json
npx @bubblewrap/cli build
```

Bubblewrap lukee nimen, värit, orientaation ja kuvakkeet manifestista, joten ne ovat
jo kunnossa. Se kysyy paketin nimen ja luo allekirjoitusavaimen (`android.keystore`)
— **ota avaimesta ja sen salasanasta varmuuskopio heti**: ilman sitä sovellusta ei voi
enää päivittää.

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

- **Tietosuojaseloste julkisesti saatavilla** — pakollinen. Sovellus käsittelee
  henkilötunnuksia ja sijaintia, joten tämä ei ole muotoseikka.
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

## Ennen kenttäkäyttöä: mitä on yhä auki

Nämä eivät estä asennusta mutta koskevat käyttökelpoisuutta. Numerointi seuraa
edellytyslistaa.

**5. Istunnon kesto — päätös tehty, toteutus auki.** Sovelluksessa istuntoa **ei
rajoiteta**: laitteen lukituksen vahva salasana on latauksen ehto, ja poikkeustapausta
varten GUARD TIKE saa myöhemmin oikeuden pakkokirjata käyttäjän ulos.

Nykytila palvelimella: `server/index.js` `USER_SESSION_MINUTES = 60` on **liukuva
joutokäyntiraja** — jokainen kirjautunut pyyntö pidentää istuntoa tunnilla, joten
aktiivikäyttö ei katkea, mutta tunti taskussa kirjaa ulos. Juuri se on kentällä
kestämätöntä. Pakkouloskirjaukselle on jo olemassa koneisto: `session_invalidated_at`
mitätöi käyttäjän kaikki istunnot (`server/index.js`, `getSessionUser`), eli GUARD
TIKEn toiminto on käyttöliittymä ja oikeus olemassa olevan päälle — ei uutta
istuntologiikkaa.

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
