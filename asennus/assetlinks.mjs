// Digital Asset Links — /.well-known/assetlinks.json.
//
// Ajo:  npm run assetlinks -- <paketti>=<sormenjälki>[,<sormenjälki>] ...
// Esim: npm run assetlinks -- fi.turvajohto_os.guard=A1:B2:...:FF
//
// Kirjoittaa:  public/.well-known/assetlinks.json  (menee buildissa dist/ juureen)
//
// --- Mikä tämä on -------------------------------------------------------------------
//
// Tiedosto kertoo Androidille, että TÄMÄ verkkosivusto tunnustaa nimetyn
// sovelluspaketin omakseen. Ilman sitä Play Storesta asennettu TWA (Trusted Web
// Activity) avaa sivuston Chromen custom tabina: sovelluksen yläreunassa on
// osoitepalkki, joka kertoo käyttäjälle että kyseessä on nettisivu. Sovelluksen koko
// pointti menee siinä.
//
// Yhteys on molemminpuolinen: sovellus nimeää verkkotunnuksen, sivusto nimeää
// sovelluksen. Sen takia tätä tiedostoa EI voi kirjoittaa valmiiksi — se vaatii
// sovelluksen allekirjoitusavaimen tiivisteen, joka syntyy vasta kun sovellus on
// olemassa.
//
// --- Miksi generaattori eikä käsin kirjoitettu tiedosto ------------------------------
//
// Väärä sormenjälki EI NÄY MISSÄÄN. Android hakee tiedoston hiljaa, huomaa ettei
// tiiviste täsmää, ja näyttää osoitepalkin — samoin kuin jos tiedostoa ei olisi
// lainkaan. Virheilmoitusta ei tule sen enempää sovellukseen kuin palvelimen lokiin.
// Siksi muoto tarkistetaan tässä ennen kirjoittamista: yksi puuttuva tavu tai
// välilyönti kopioinnissa on tyypillisin syy siihen että TWA "ei vain toimi".
//
// --- Mistä sormenjälki tulee --------------------------------------------------------
//
// Play Console -> sovellus -> Test and release -> Setup -> App integrity ->
// App signing key certificate -> SHA-256 certificate fingerprint.
//
// TARVITSET TODENNÄKÖISESTI KAKSI TIIVISTETTÄ, ja tämä on se kohta jossa
// sisäinen testaus tyypillisesti kaatuu:
//
//   1. Play-allekirjoitusavain (App signing key). Sillä Google allekirjoittaa
//      kaupasta ladattavan sovelluksen.
//   2. Oma latausavain (Upload key) tai Bubblewrapin luoma android.keystore. Sillä on
//      allekirjoitettu se APK jonka asennat itse kehityksen aikana
//      (`bubblewrap install`), eli juuri se versio jolla testaat ensimmäisenä.
//
// Molemmat voi antaa saman paketin alle pilkulla erotettuna. Oman avaimen tiivisteen
// saa komennolla:
//
//   keytool -list -v -keystore android.keystore -alias android
//
// --- Tarkistus julkaisun jälkeen ----------------------------------------------------
//
//   curl -s https://turvajohto-os.fi/.well-known/assetlinks.json
//
// ja Googlen oma tarkistin, joka kertoo myös miksi yhteys ei kelpaa:
//
//   https://digitalassetlinks.googleapis.com/v1/statements:list
//     ?source.web.site=https://turvajohto-os.fi
//     &relation=delegate_permission/common.handle_all_urls
//
// HUOM NGINX: polku alkaa pisteellä. Jos palvelimen konfiguraatiossa on tavanomainen
// `location ~ /\. { deny all; }`, se estää TÄMÄN tiedoston — ja samalla myös
// Let's Encryptin acme-challengen. Tarkista ylläolevalla curlilla että tiedosto
// todella tulee ulos statuksella 200 ja tyypillä application/json.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const KOHDE = new URL('../public/.well-known/assetlinks.json', import.meta.url)

// Android-paketin nimi: vähintään kaksi pisteellä erotettua segmenttiä, sallitut
// merkit [a-zA-Z0-9_], jokainen segmentti alkaa kirjaimella. ALAVIIVA KELPAA,
// VÄLIVIIVA EI — turvajohto-os.fi ei siis käänny suoraan, ja valittu nimi on
// fi.turvajohto_os.guard.
//
// Isot kirjaimet ovat teknisesti sallittuja, mutta kaupassa käytännössä aina pieniä.
// Nimeä ei voi vaihtaa julkaisun jälkeen koskaan, joten tarkistus on tiukka
// tarkoituksella: tähän ei haluta huomata kirjoitusvirhettä vasta kaupassa.
const PAKETTI = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/

// SHA-256 heksana, 32 tavua kaksoispisteillä.
const SORMENJALKI = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i

const argumentit = process.argv.slice(2)

if (argumentit.length === 0 || argumentit.includes('--apua')) {
  let nykyinen = '(tiedostoa ei ole)'
  try {
    nykyinen = readFileSync(KOHDE, 'utf8').trim()
  } catch {
    // Tiedostoa ei ole vielä — se on ensimmäisellä kerralla normaali tilanne.
  }

  console.log(`Käyttö:
  npm run assetlinks -- <paketti>=<sormenjälki>[,<sormenjälki>] [<paketti>=...]
  npm run assetlinks -- --tyhjenna     (kirjoittaa tyhjän listan)

Esimerkki (Play-avain ja oma latausavain samalle paketille):
  npm run assetlinks -- fi.turvajohto_os.guard=A1:B2:C3:...:FF,D4:E5:F6:...:00

Nykyinen public/.well-known/assetlinks.json:
${nykyinen}

Sormenjäljen löytäminen ja tarkistuskomennot: ks. tämän tiedoston kommentit.`)
  process.exit(argumentit.length === 0 ? 1 : 0)
}

const lauseet = []

if (!argumentit.includes('--tyhjenna')) {
  for (const argumentti of argumentit) {
    const [paketti, sormenjaljet] = argumentti.split('=')

    if (!paketti || !sormenjaljet) {
      console.error(`Virheellinen argumentti "${argumentti}". Odotettu muoto: paketti=sormenjälki`)
      process.exit(1)
    }
    if (!PAKETTI.test(paketti)) {
      console.error(
        `"${paketti}" ei ole kelvollinen Android-paketin nimi.\n`
        + 'Odotettu muoto on esim. fi.turvajohto_os.guard: pieniä kirjaimia, segmentti\n'
        + 'alkaa aina kirjaimella, alaviiva kelpaa mutta VÄLIVIIVA EI\n'
        + '(turvajohto-os.fi ei siis käänny muotoon fi.turvajohto-os).',
      )
      process.exit(1)
    }

    // Set: sama tiiviste kahdesti on tyypillinen kopiointivirhe (latausavain ja
    // Play-avain sekaisin), eikä Androidille ole mitään hyötyä toistosta.
    const lista = [...new Set(sormenjaljet.split(',').map((jalki) => jalki.trim().toUpperCase()))]
    for (const jalki of lista) {
      if (!SORMENJALKI.test(jalki)) {
        console.error(
          `Sormenjälki ei kelpaa paketille ${paketti}:\n  ${jalki}\n`
          + 'Odotettu muoto on 32 heksatavua kaksoispisteillä eroteltuna\n'
          + '(A1:B2:...:FF, yhteensä 95 merkkiä). Kopioi arvo Play Consolesta\n'
          + 'kokonaisuudessaan — katkennut tiiviste ei näy virheenä missään muualla.',
        )
        process.exit(1)
      }
    }

    lauseet.push({
      // Ainoa Androidin TWA:lle merkitsevä relaatio: sivusto delegoi kaikkien
      // osoitteidensa käsittelyn tälle sovellukselle.
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: paketti,
        sha256_cert_fingerprints: lista,
      },
    })
  }
}

mkdirSync(new URL('.', KOHDE), { recursive: true })
writeFileSync(KOHDE, JSON.stringify(lauseet, null, 2) + '\n')

console.log(`Kirjoitettiin public/.well-known/assetlinks.json (${lauseet.length} lausetta).`)
for (const lause of lauseet) {
  console.log(
    `  ${lause.target.package_name}: ${lause.target.sha256_cert_fingerprints.length} sormenjälkeä`,
  )
}
if (lauseet.length === 0) {
  console.log(
    '\nTyhjä lista tarkoittaa Androidille samaa kuin puuttuva tiedosto: TWA näyttää\n'
    + 'osoitepalkin. Tiedosto on silti hyödyllinen, koska sillä voi tarkistaa että\n'
    + 'palvelin todella tarjoilee /.well-known/-polun.',
  )
}
