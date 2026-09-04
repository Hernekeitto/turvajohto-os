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

// Tuotekohtaiset osat ladataan vasta tarvittaessa: mainossivu on julkinen ja sen
// pitää aueta heti, eikä sen kuulu vetää mukanaan koko sovellusnippua.
const EventApp = lazy(() => import('./App.tsx'))
const GuardApp = lazy(() => import('./guard/GuardApp.tsx'))

type Tuote = 'landing' | 'event' | 'guard'

// Ainoa kohta koko sovelluksessa joka katsoo osoiteriviä. Tuotteiden SISÄINEN
// navigointi toimii edelleen komponenttien omalla tilalla (App.tsx: activeTab),
// joten tässä riittää kolme haaraa.
//
// Polut tulkitaan kirjainkoosta riippumatta, koska osoite kirjoitetaan käsin ja
// jaetaan puheessa muodossa "turvajohto-os.fi/Guard" — kanoninen muoto on silti
// pieni kirjain, ks. normalisoiPolku.
function ratkaiseTuote(pathname: string): Tuote {
  const polku = pathname.replace(/\/+$/, '').toLowerCase()
  if (polku === '/event' || polku.startsWith('/event/')) return 'event'
  if (polku === '/guard' || polku.startsWith('/guard/')) return 'guard'
  return 'landing'
}

// Siivoaa osoiterivin kanoniseen muotoon ilman uudelleenlatausta: /Guard/ -> /guard,
// ja kaikki tuntemattomat polut mainossivulle (/), jotta kirjoitusvirhe ei jätä
// käyttäjää katsomaan mainossivua väärässä osoitteessa.
function normalisoiPolku(tuote: Tuote) {
  const kanoninen = tuote === 'landing' ? '/' : `/${tuote}`
  if (window.location.pathname !== kanoninen) {
    window.history.replaceState(null, '', kanoninen + window.location.search + window.location.hash)
  }
}

const tuote = ratkaiseTuote(window.location.pathname)
normalisoiPolku(tuote)

// Väritokenien arvot ratkeavat juuren data-tuote-attribuutista (ks. index.css), jolloin
// sama komponentti näyttää EVENT-puolella slate/indigo-ilmeeltä ja GUARD-puolella
// ohjeistonsa mukaiselta. Asetetaan ennen ensimmäistä renderöintiä, jottei sivu välähdä
// väärän puolen väreissä. Mainossivu on oma teemansa: se on ainoa tumma näkymä.
document.documentElement.dataset.tuote = tuote === 'landing' ? 'os' : tuote

// Kuvake, otsikko, teemaväri ja manifesti ovat samalla tavalla tuotekohtaisia kuin
// väritokenit, ja ne asetetaan tässä samasta syystä: index.html on yhteinen kaikille
// kolmelle polulle, joten tuotteen tunnus ratkeaa vasta kun polku on tulkittu. Ilman
// manifestia sovellusta ei voi asentaa laitteelle lainkaan (ks. asennus/LUEMINUT.md).
asetaKuvakkeetJaManifesti(tuote)

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
          {tuote === 'guard' ? <GuardApp /> : <EventApp />}
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
