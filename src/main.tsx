import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
// Fira Sans — koko Turvajohto OS -ekosysteemin fontti (GUARD-ohjeisto, kohta 3).
// Isännöidään itse npm-paketista eikä haeta Google Fontsilta, koska sovellus menee
// oikeaan käyttöön eikä käyttäjän selaimen kuulu ottaa yhteyttä kolmanteen osapuoleen
// pelkän fontin takia. Importit ovat täällä eivätkä index.css:ssä: Tailwindin oma
// @import-käsittely ei kirjoita fonttien suhteellisia url()-polkuja uudelleen, jolloin
// woff2-tiedostot jäisivät kokonaan pois tuotantobuildista.
// latin-* riittää — suomen ääkköset ovat latin-ext-lohkossa, eikä kyrillistä, kreikkaa
// tai vietnamia tarvita.
import '@fontsource/fira-sans/latin-400.css'
import '@fontsource/fira-sans/latin-400-italic.css'
import '@fontsource/fira-sans/latin-500.css'
import '@fontsource/fira-sans/latin-700.css'
import './index.css'
import Landing from './Landing.tsx'
import PasswordGate from './PasswordGate.tsx'
import { PaivitysKehote } from './shared/komponentit/PaivitysKehote.tsx'
import { JonoTila } from './shared/komponentit/JonoTila.tsx'
import { rekisteroiPalvelutyontekija } from './shared/palvelutyontekija.ts'
import { asetaKuvakkeetJaManifesti } from './shared/kuvakkeet.ts'
import { lueLaitevalinta, ERAPOLKU, MOBIILIPOLKU, TYOPOYTAPOLKU } from './shared/laitevalinta.ts'

// Tuotekohtaiset osat ladataan vasta tarvittaessa: mainossivu on julkinen ja sen
// pitää aueta heti, eikä sen kuulu vetää mukanaan koko sovellusnippua.
const EventApp = lazy(() => import('./App.tsx'))
const GuardApp = lazy(() => import('./guard/GuardApp.tsx'))
// Avainerän taulukkosyöttö on oma sivunsa omassa selainvälilehdessään, ei näkymä
// GuardAppin sisällä: se ei jaa mitään tilaa pankin kanssa eikä sitä tarvitse ladata
// ennen kuin se avataan.
const KalustoEra = lazy(() => import('./guard/kalusto/KalustoEra.tsx').then((m) => ({ default: m.KalustoEra })))

type Tuote = 'landing' | 'event' | 'guard'

// Osoitteen lopussa oleva kenoviiva ei muuta polkua: /guard/ ja /guard ovat sama.
const LOPUN_KENOVIIVAT = /[/]+$/

// Ainoa kohta koko sovelluksessa joka katsoo osoiteriviä. Tuotteiden SISÄINEN
// navigointi toimii edelleen komponenttien omalla tilalla (App.tsx: activeTab),
// joten tässä riittää kolme haaraa.
//
// Polut tulkitaan kirjainkoosta riippumatta, koska osoite kirjoitetaan käsin ja
// jaetaan puheessa muodossa "turvajohto-os.fi/Guard" — kanoninen muoto on silti
// pieni kirjain, ks. normalisoiPolku.
function ratkaiseTuote(pathname: string): Tuote {
  const polku = pathname.replace(LOPUN_KENOVIIVAT, '').toLowerCase()
  if (polku === '/event' || polku.startsWith('/event/')) return 'event'
  if (polku === '/guard' || polku.startsWith('/guard/')) return 'guard'
  return 'landing'
}

// GUARD-puolella on kaksi versiota samaan dataan: työpöytä (/guard) ja puhelimelle
// tehty kenttäversio (/guard/mobile). Osoite ratkaisee kumman saa, koska se on ainoa
// tapa jolla valinnan voi jakaa, kirjanmerkitä ja kirjoittaa käsin.
//
// Tallennettu laitevalinta ohjaa VAIN silloin kun osoite ei sano mitään: asennettu
// sovellus käynnistyy aina /guard-polkuun (manifestin start_url), joten ilman tätä
// mobiiliversion valinnut vartija päätyisi työpöytäversioon joka ainoa kerta.
// Nimenomainen /guard/mobile voittaa aina tallennetun valinnan.
// Onko osoite eräkirjauksen taulukkosivu. Oma haaransa eikä GuardAppin sisäinen
// näkymä, koska sivu avataan window.openilla omaan välilehteensä — silloin se on
// osoite, ja osoitteet tulkitaan tässä tiedostossa.
function onEra(pathname: string): boolean {
  return pathname.replace(LOPUN_KENOVIIVAT, '').toLowerCase() === ERAPOLKU
}

// Onko osoite hälytyskeskuksen irrotettu paneeli (erä 24). Omat osoitteensa, koska
// päivystäjän toinen näyttö on oma IKKUNANSA — ja ikkunan sisältö kulkee osoitteessa,
// ei Reactin tilassa. Ks. src/guard/halke/paneelit.ts.
function onHalkePaneeli(pathname: string): boolean {
  return pathname.replace(LOPUN_KENOVIIVAT, '').toLowerCase().startsWith('/guard/halke/')
}

function ratkaiseGuardMobiili(pathname: string): boolean {
  const polku = pathname.replace(LOPUN_KENOVIIVAT, '').toLowerCase()
  if (polku === MOBIILIPOLKU) return true
  if (polku !== TYOPOYTAPOLKU) return false
  return lueLaitevalinta() === 'mobiili'
}

// Siivoaa osoiterivin kanoniseen muotoon ilman uudelleenlatausta: /Guard/ -> /guard,
// ja kaikki tuntemattomat polut mainossivulle (/), jotta kirjoitusvirhe ei jätä
// käyttäjää katsomaan mainossivua väärässä osoitteessa.
function normalisoiPolku(
  tuote: Tuote, guardMobiili: boolean, era: boolean, halkePaneeli: boolean,
) {
  // Eräkirjauksen osoite on kanoninen sellaisenaan: ilman tätä haaraa normalisointi
  // kirjoittaisi sen /guard:ksi ja välilehti näyttäisi pankin taulukon sijaan.
  if (era) return
  // Sama koskee hälytyskeskuksen paneeleita. Ilman tätä irrotettu ikkuna menettäisi
  // paneelinsa heti latauksessa: normalisointi kirjoittaisi osoitteeksi /guard ennen
  // kuin GuardApp ehtii lukea sen, ja jokainen toiselle näytölle raahattu ikkuna
  // avautuisi koostenäkymään.
  if (halkePaneeli) return
  const kanoninen = tuote === 'landing' ? '/' : guardMobiili ? MOBIILIPOLKU : `/${tuote}`
  if (window.location.pathname !== kanoninen) {
    window.history.replaceState(null, '', kanoninen + window.location.search + window.location.hash)
  }
}

const tuote = ratkaiseTuote(window.location.pathname)
const era = tuote === 'guard' && onEra(window.location.pathname)
const halkePaneeli = tuote === 'guard' && !era && onHalkePaneeli(window.location.pathname)
const guardMobiili = tuote === 'guard' && !era && !halkePaneeli
  && ratkaiseGuardMobiili(window.location.pathname)
// replaceState eikä uudelleenohjaus: sovellusnippu on jo ladattu, ja koko ero on siinä
// mikä komponentti renderöidään. Uudelleenlataus tässä kohdassa maksaisi vartijalle
// yhden ylimääräisen latauksen jokaisella käynnistyksellä.
normalisoiPolku(tuote, guardMobiili, era, halkePaneeli)

// Väritokenien arvot ratkeavat juuren data-tuote-attribuutista (ks. index.css), jolloin
// sama komponentti näyttää EVENT-puolella slate/indigo-ilmeeltä ja GUARD-puolella
// ohjeistonsa mukaiselta. Asetetaan ennen ensimmäistä renderöintiä, jottei sivu välähdä
// väärän puolen väreissä. Mainossivu on oma teemansa: se on ainoa tumma näkymä.
document.documentElement.dataset.tuote = tuote === 'landing' ? 'os' : tuote

// Kenttäversion perustekstikoko on isompi kuin työpöytäversion, ja se asetetaan JUUREEN
// eikä komponentteihin: Tailwindin mitat ovat rem-yksiköitä, joten yksi juuren arvo
// suurentaa tekstin, painikkeet ja välit samassa suhteessa — myös niissä näkymissä
// (kierros, hälytykset, raportointi) jotka ovat yhteisiä työpöytäversion kanssa eikä
// niitä siksi voi kirjoittaa mobiilia varten uudelleen.
//
// Ilman tätä puhelimessa luki 14 pikselin leipätekstiä: koko joka on tietokoneen
// näytöllä oikea ja kädessä liian pieni.
if (guardMobiili) document.documentElement.dataset.laite = 'mobiili'

// Kuvake, otsikko, teemaväri ja manifesti ovat samalla tavalla tuotekohtaisia kuin
// väritokenit, ja ne asetetaan tässä samasta syystä: index.html on yhteinen kaikille
// kolmelle polulle, joten tuotteen tunnus ratkeaa vasta kun polku on tulkittu. Ilman
// manifestia sovellusta ei voi asentaa laitteelle lainkaan (ks. asennus/LUEMINUT.md).
asetaKuvakkeetJaManifesti(tuote)

// Kenttäversio piirretään ruudun reunasta reunaan, myös lovien ja pyöristettyjen
// kulmien alle. Ilman viewport-fit=cover selaimen env(safe-area-inset-*) on aina nolla,
// jolloin mobiilikuoren yläpalkki jäisi asennetussa sovelluksessa kellon ja akun alle —
// eli juuri se turvaväli jota varten insetit ovat olemassa jäisi laskematta.
//
// VAIN mobiiliversiolle: sama index.html palvelee mainossivua ja EVENT-puolta, jotka
// eivät varaa turvaväliä eivätkä siksi saa piirtyä lovien alle.
if (guardMobiili) {
  document.querySelector('meta[name="viewport"]')
    ?.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
}

// Näytetään latauksen ajaksi tyhjä sivu eikä pyörivää indikaattoria: nippu tulee
// samalta palvelimelta millisekunneissa, ja välähtävä spinneri näyttäisi virheeltä.
const Latautuu = <div className="min-h-screen bg-canvas" />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {tuote === 'landing' ? (
      <Landing />
    ) : (
      <Suspense fallback={Latautuu}>
        <PasswordGate tuote={tuote}>
          {tuote === 'guard'
            ? (era ? <KalustoEra /> : <GuardApp mobiili={guardMobiili} />)
            : <EventApp />}
        </PasswordGate>
      </Suspense>
    )}
    {/* Päivityskehote on molempien puolien ulkopuolella, koska päivitys koskee koko
        sovellusnippua. Mainossivulla se ei näy: sinne ei kirjauduta eikä siellä ole
        mitään kesken. */}
    {tuote !== 'landing' && <PaivitysKehote />}
    {/* Lähtevä jono on molempien puolien ulkopuolella samasta syystä kuin päivityskehote:
        kirjaus voi olla lähettämättä kummalla puolella tahansa, ja kahtena kappaleena
        sama ilmoitus olisi kaksi paikkaa joita pitää muistaa päivittää.

        Komponentti näyttää itsensä vain kun jonossa on jotain, ja jono on tyhjä kunnes
        sovellus avaa sen kirjautuneen käyttäjän tunnuksella — joten se ei voi vuotaa
        edellisen käyttäjän kirjauksia siinäkään hetkessä ennen kirjautumista. */}
    {tuote !== 'landing' && <JonoTila />}
  </StrictMode>,
)

// Rekisteröidään vasta renderöinnin jälkeen: palvelutyöntekijä on offline-tuki, ei
// ehto sovelluksen käynnistymiselle.
rekisteroiPalvelutyontekija()
