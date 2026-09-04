// Sovelluskuvakkeet ja web app manifestit — yksi lähde, generoitu tulos.
//
// Ajo:  npm run asennus
// Kirjoittaa:  public/kuvakkeet/*  ja  public/manifest-event.json, public/manifest-guard.json
//
// TULOS ON VERSIONHALLINNASSA, tämä skripti ei ole osa buildia. Kuvakkeet muuttuvat
// kerran vuodessa jos silloinkaan, eikä `npm run build` saa riippua kuvarasteroijasta.
// Aja tämä käsin kun ilme tai manifestin sisältö muuttuu, ja committaa syntyneet
// tiedostot mukaan.
//
// --- Miksi generaattori eikä käsin kirjoitetut tiedostot -----------------------------
//
// 1. MANIFESTIIN EI VOI KIRJOITTAA KOMMENTTEJA. JSON ei tunne niitä, ja manifestin
//    jokainen kenttä on päätös jota ei voi lukea arvosta (miksi GUARD on lukittu
//    pystyasentoon mutta EVENT ei? miksi scope on /guard eikä /guard/?). Perustelut
//    ovat siksi täällä, samassa tiedostossa arvojen kanssa.
//
// 2. KUVAKELISTA EI SAA ERKAANTUA TIEDOSTOISTA. Manifestin `icons` ja levyllä olevat
//    PNG:t syntyvät tässä samasta taulukosta, joten manifesti ei voi viitata
//    kuvakkeeseen jota ei ole — se on Chromen asennusnappia koskeva virhe joka näkyisi
//    vasta oikealla puhelimella.
//
// 3. LAATAN GEOMETRIA ON SAMA KAHDESSAKYMMENESSÄ TIEDOSTOSSA. Käsin ylläpidettynä
//    kolme tuotetta kertaa kuusi kokoa tarkoittaa parikymmentä lähes samanlaista
//    SVG:tä, joista yksi on aina eri.
//
// --- Kuvakkeen merkki tulee lucidesta -----------------------------------------------
//
// Sovellus käyttää lucide-reactia (mainossivu: CalendarDays EVENTille, ShieldCheck
// GUARDille), ja kuvake lukee TÄSMÄLLEEN samat polut suoraan node_modulesista. Käsin
// kopioitu polkudata näyttäisi oikealta tänään ja vanhentuisi hiljaa: sovelluksen
// ikoni päivittyisi kirjaston mukana ja aloitusnäytön kuvake jäisi entiselleen.
//
// lucide on ISC-lisensoitu, eli polkudatan käyttö tässä on sallittua.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const JUURI = new URL('../', import.meta.url)
const KUVAKEHAKEMISTO = new URL('public/kuvakkeet/', JUURI)

// --- Tuotteet -----------------------------------------------------------------------
//
// Kolme kuvakesarjaa, joista kaksi on asennettavia sovelluksia ja yksi pelkkä favicon.
//
// Värit ovat src/index.css:n tokeneista. Ne on tässä kirjoitettu auki eikä luettu
// CSS:stä, koska kuvake ei ole teema vaan tunnus: jos jonain päivänä GUARDin accent
// vaihtuu käyttöliittymässä, aloitusnäytön kuvakkeen vaihtaminen on erillinen päätös
// (asennetun sovelluksen kuvake vaihtuu käyttäjän kotinäytöllä ilman että hän pyysi).
const TUOTTEET = [
  {
    id: 'event',
    // Laatan väri = tuotteen accent, merkki valkoisena. Väri kantaa tunnistuksen
    // sovelluslaatikossa; muoto kertoo kummasta tuotteesta on kyse.
    laatta: '#4f46e5',
    merkki: 'calendar-days',
    manifesti: {
      name: 'Turvajohto EVENT',
      short_name: 'EVENT',
      description:
        'Tapahtumaturvallisuuden tilannekuva, TIKE-raportointi ja järjestyksenvalvojan '
        + 'tapahtumailmoitukset.',
      // Yläpalkin väri EVENT-puolella (--color-surface-dark). Android maalaa
      // tilapalkin tällä, joten väärä arvo näkyy saumana palkin ja sovelluksen välissä.
      theme_color: '#0f172a',
      // Käynnistysruudun pohja = sivun pohjaväri (--color-canvas). Sama väri jonka
      // käyttäjä näkee heti kun sovellus on latautunut, eli ruutu ei välähdä.
      background_color: '#f8fafc',
      // EVENTiä käytetään myös komentopaikan tabletilla ja läppärillä vaakasuunnassa
      // (tilannekuva, taulukot), joten asentoa EI lukita. Vertaa GUARDiin alla.
      orientation: 'any',
    },
  },
  {
    id: 'guard',
    laatta: '#019765',
    merkki: 'shield-check',
    manifesti: {
      name: 'Turvajohto GUARD',
      short_name: 'GUARD',
      description: 'Vartioinnin kohdekierrokset, vuorot ja poikkeamakirjaukset kentällä.',
      theme_color: '#1e293b',
      background_color: '#f4f5f8',
      // GUARD on puhelinsovellus hanskat kädessä: yhdellä kädellä pystyasennossa.
      // Lukitus estää sen että kierroksella taskusta kaivettu puhelin kääntää näkymän
      // vaakaan siksi että laite oli kallellaan.
      orientation: 'portrait',
    },
  },
  {
    // Mainossivu (/). EI MANIFESTIA: sivu on julkinen esittelysivu johon ei kirjauduta,
    // eikä sitä ole tarkoitus asentaa — asennettava asia on aina jompi kumpi tuote.
    // Kuvakkeita tarvitaan silti, koska ilman niitä selaimen välilehdellä on tyhjä
    // paperi ja /favicon.ico jää 404:ksi.
    id: 'os',
    // Mainossivu on ainoa tumma näkymä (--color-canvas [data-tuote="os"]), ja laatta
    // seuraa sitä.
    laatta: '#232f40',
    merkki: 'shield',
    manifesti: null,
  },
]

// --- Kuvakkeiden muunnelmat ---------------------------------------------------------
//
// Kolme geometriaa, ja jokaiselle on oma syynsä. Nämä eivät ole makuasioita vaan
// alustojen vaatimuksia:
//
//   laatta   Pyöristetty laatta läpinäkyvällä marginaalilla. Manifestin `purpose: any`
//            ja selaimen favicon. Chrome piirtää tämän SELLAISENAAN (asennusdialogi,
//            tehtävänvaihtaja, käynnistysruutu), joten kuvakkeen on oltava valmiiksi
//            oikean muotoinen — täyteen reunaan asti maalattu neliö näyttäisi siellä
//            viimeistelemättömältä.
//
//   maskable Reunasta reunaan maalattu pohja, merkki pienempänä keskellä. Android
//            LEIKKAA kuvakkeen laitteen oman muodon mukaan (ympyrä, squircle,
//            pisara) ja takaa vain keskellä olevan 80 %:n ympyrän. Ilman tätä
//            muunnelmaa laatan kulmat leikkautuisivat pois ja merkki jäisi liian
//            lähelle leikkausrajaa.
//
//   tayteen  Reunasta reunaan maalattu pohja, merkki normaalikoossa. apple-touch-icon:
//            iOS pyöristää kuvakkeen itse eikä kunnioita läpinäkyvyyttä (läpinäkyvä
//            tausta muuttuu siellä mustaksi).
const MUUNNELMAT = {
  laatta: { taytaReuna: false, merkkiOsuus: 0.54 },
  maskable: { taytaReuna: true, merkkiOsuus: 0.46 },
  tayteen: { taytaReuna: true, merkkiOsuus: 0.54 },
}

// Piirretään aina 512:n ruudukolle ja rasteroidaan haluttuun kokoon: yksi geometria,
// ei kokokohtaisia erikoistapauksia.
const RUUDUKKO = 512

// Laatan pyöristys, 22 % laatan leveydestä. Sama suuruusluokka kuin Androidin ja iOSin
// omissa kuvakkeissa; selvästi pyöreämpi jäisi leijumaan, selvästi terävämpi näyttäisi
// ruudulta eikä sovellukselta.
const PYORISTYS_OSUUS = 0.22

// Läpinäkyvä marginaali laattamuunnelmassa, 3 % reunasta. Riittää siihen ettei laatta
// kosketa kuvakkeen reunaa (Chrome ei jätä sinne omaa väliä), muttei tuhlaa pikseleitä
// pienissä koissa.
const MARGINAALI_OSUUS = 0.03

// Merkin viivanpaksuus lucide-ikonin 24×24-ruudukolla. 2 on lucide-oletus, eli
// kuvakkeen merkki on täsmälleen yhtä paksu kuin sama ikoni sovelluksen sisällä.
const VIIVANPAKSUUS = 2

// --- Lucide-merkin lukeminen --------------------------------------------------------
//
// lucide-reactin ikonimoduuli on ESM-tiedosto joka rakentaa React-komponentin, joten
// sitä ei voi importoida Nodessa ilman Reactia. Polkudata on siinä silti tavallisena
// taulukkona, ja se luetaan tekstinä:
//
//   const __iconNode = [
//     ["path", { d: "M8 2v3", key: "1ioesn" }],
//     ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", key: "h1oib" }]
//   ];
//
// Jos lucide joskus vaihtaa tämän muodon, skripti kaatuu selvään virheeseen alla eikä
// tuota hiljaa tyhjää kuvaketta.
function lueMerkki(nimi) {
  const polku = new URL(`node_modules/lucide-react/dist/esm/icons/${nimi}.mjs`, JUURI)
  let lahde
  try {
    lahde = readFileSync(polku, 'utf8')
  } catch {
    throw new Error(
      `Lucide-ikonia "${nimi}" ei loytynyt (${fileURLToPath(polku)}). Aja ensin npm install.`,
    )
  }

  const taulukko = lahde.match(/const __iconNode = \[([\s\S]*?)\];/)
  if (!taulukko) {
    throw new Error(`Lucide-ikonin "${nimi}" muoto on muuttunut: __iconNode puuttuu.`)
  }

  const solmut = [...taulukko[1].matchAll(/\[\s*"(\w+)"\s*,\s*\{([^}]*)\}\s*\]/g)].map(
    ([, elementti, attribuutit]) => ({
      elementti,
      attribuutit: Object.fromEntries(
        [...attribuutit.matchAll(/(\w+):\s*"([^"]*)"/g)]
          // key on lucide-reactin oma React-avain eikä SVG-attribuutti.
          .filter(([, avain]) => avain !== 'key')
          .map(([, avain, arvo]) => [avain, arvo]),
      ),
    }),
  )

  if (solmut.length === 0) {
    throw new Error(`Lucide-ikonin "${nimi}" polkudataa ei osattu lukea.`)
  }
  return solmut
}

// --- SVG:n rakentaminen -------------------------------------------------------------

function svgKuvake({ laatta, merkki, muunnelma, viivanpaksuus = VIIVANPAKSUUS }) {
  const { taytaReuna, merkkiOsuus } = MUUNNELMAT[muunnelma]

  // Liukuluvut pyöristetään ennen SVG:hen kirjoittamista: 105.88159999999999 on
  // rasteroijalle sama luku kuin 105.882, mutta tiedostoon jäävänä tekstinä se on
  // pelkkää melua.
  const lyhennä = (luku) => Number(luku.toFixed(3))

  const marginaali = taytaReuna ? 0 : RUUDUKKO * MARGINAALI_OSUUS
  const laattaKoko = RUUDUKKO - 2 * marginaali
  // Täyteen maalattu pohja EI ole pyöristetty: Android ja iOS leikkaavat sen itse, ja
  // valmiiksi pyöristetty kulma näkyisi siellä kuvakkeen sisällä olevana kaarena.
  const pyoristys = taytaReuna ? 0 : laattaKoko * PYORISTYS_OSUUS

  // lucide-merkit piirretään 24×24-ruudukolle. Skaalataan se halutun kokoiseksi ja
  // keskitetään; viivanpaksuus skaalautuu mukana, joten merkki näyttää samalta kuin
  // sovelluksen ikonit.
  const merkkiKoko = RUUDUKKO * merkkiOsuus
  const skaala = merkkiKoko / 24
  const siirto = (RUUDUKKO - merkkiKoko) / 2

  const elementit = merkki
    .map(({ elementti, attribuutit }) => {
      const attr = Object.entries(attribuutit)
        .map(([avain, arvo]) => `${avain}="${arvo}"`)
        .join(' ')
      return `      <${elementti} ${attr}/>`
    })
    .join('\n')

  // stroke-linecap="round" on lucide-merkeille pakollinen eikä koriste: kalenterin
  // päivämerkit ovat polkuja joiden pituus on 0.01 ("M8 13h.01"), ja ne piirtyvät
  // pisteiksi VAIN pyöreällä viivanpäällä. Ilman sitä kalenteri on tyhjä.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RUUDUKKO} ${RUUDUKKO}" width="${RUUDUKKO}" height="${RUUDUKKO}">
  <rect x="${lyhennä(marginaali)}" y="${lyhennä(marginaali)}" width="${lyhennä(laattaKoko)}" height="${lyhennä(laattaKoko)}" rx="${lyhennä(pyoristys)}" fill="${laatta}"/>
  <g transform="translate(${lyhennä(siirto)} ${lyhennä(siirto)}) scale(${lyhennä(skaala)})"
     fill="none" stroke="#ffffff" stroke-width="${viivanpaksuus}"
     stroke-linecap="round" stroke-linejoin="round">
${elementit}
  </g>
</svg>
`
}

function kirjoitaPng(svg, koko, tiedosto) {
  const rasteri = new Resvg(svg, { fitTo: { mode: 'width', value: koko } })
  writeFileSync(new URL(tiedosto, KUVAKEHAKEMISTO), rasteri.render().asPng())
}

// --- Kuvakkeiden koot ---------------------------------------------------------------
//
// Jokaisella koolla on käyttäjä, eikä listaan lisätä kokoja varmuuden vuoksi:
//
//   192 + 512 any        Chromen asennusvaatimus. 192 on kotinäytön kuvake, 512
//                        käynnistysruutu ja kaupan generoima kuvake (Bubblewrap
//                        lukee tämän TWA:n launcher-ikoniksi).
//   192 + 512 maskable   Androidin adaptiivinen kuvake, ks. MUUNNELMAT.
//   180 tayteen          apple-touch-icon. iOS ei lue manifestin kuvakkeita lainkaan.
//   32 laatta            Selaimen välilehti niissä selaimissa jotka eivät tue
//                        SVG-faviconia (Safari alle 16, vanhat Edget).
const KOOT = [
  { koko: 192, muunnelma: 'laatta', purpose: 'any' },
  { koko: 512, muunnelma: 'laatta', purpose: 'any' },
  { koko: 192, muunnelma: 'maskable', purpose: 'maskable' },
  { koko: 512, muunnelma: 'maskable', purpose: 'maskable' },
  { koko: 180, muunnelma: 'tayteen', purpose: null },
  // Viivanpaksuus on tässä ainoassa koossa lucide-oletusta suurempi. 32 pikselissä
  // merkki on 17 pikseliä leveä ja oletusviiva ohenee 1,4 pikseliin, jolloin
  // kalenterin päivämerkit haalistuvat välilehdellä lähes näkymättömiin.
  { koko: 32, muunnelma: 'laatta', purpose: null, viivanpaksuus: 2.5 },
]

function tiedostonimi(id, { koko, muunnelma }) {
  return muunnelma === 'maskable' ? `${id}-maskable-${koko}.png` : `${id}-${koko}.png`
}

// --- Manifestin rakentaminen --------------------------------------------------------
function manifesti(tuote, kuvakkeet) {
  const polku = `/${tuote.id}`
  return {
    '//': 'Generoitu tiedosto. Lähde ja perustelut: asennus/rakenna.mjs — älä muokkaa käsin.',

    // Sovelluksen pysyvä henkilöllisyys. Ilman tätä identiteetti on start_url, ja
    // start_urlin muuttaminen tekisi asennetusta sovelluksesta selaimen silmissä
    // ERI sovelluksen — käyttäjälle se näkyisi kahtena kuvakkeena kotinäytöllä.
    id: polku,

    name: tuote.manifesti.name,
    // Kotinäytön kuvakkeen alla näkyvä nimi. Android katkaisee noin 12 merkin jälkeen,
    // joten "Turvajohto GUARD" olisi siellä "Turvajohto G…".
    short_name: tuote.manifesti.short_name,
    description: tuote.manifesti.description,
    lang: 'fi',
    dir: 'ltr',

    // HUOM: scope ilman kenoviivaa, ja start_url samassa muodossa.
    //
    // Sovelluksen kanoninen osoite on /guard EIKÄ /guard/ (main.tsx normalisoiPolku
    // siivoaa kenoviivan pois heti latauksessa). Jos scope olisi "/guard/", niin
    // normalisointi siirtäisi sovelluksen ULOS omasta scopestaan ensimmäisellä
    // sekunnilla — ja standalone-tilassa se tarkoittaa että selaimen osoitepalkki
    // ilmestyy näkyviin, eli juuri se mitä sovelluksella yritetään välttää.
    start_url: polku,
    scope: polku,

    // standalone = ei selaimen käyttöliittymää.
    //
    // VAROITUS, ks. asennus/LUEMINUT.md: tässä tilassa Androidin takaisin-nappi SULKEE
    // sovelluksen, koska navigointi on komponentin tilassa eikä selaimen historiassa.
    // Se on tiedossa oleva puute (Android-edellytyslistan kohta 4) eikä manifestin
    // korjattavissa.
    display: 'standalone',
    orientation: tuote.manifesti.orientation,

    theme_color: tuote.manifesti.theme_color,
    background_color: tuote.manifesti.background_color,

    icons: kuvakkeet,

    // Sovellus ei ole peli eikä viihdettä; kaupan luokitus on työkalu.
    categories: ['business', 'productivity'],

    // Ei ehdota Play Storen versiota selaimessa. Kun TWA on kaupassa, tähän voi lisätä
    // related_applications-listan ja vaihtaa arvon todeksi — silloin selain lakkaa
    // tarjoamasta omaa asennustaan ja ohjaa kauppaan. Sitä ennen arvo on false, koska
    // selainasennus on tällä hetkellä ainoa tapa saada sovellus laitteeseen.
    prefer_related_applications: false,
  }
}

// --- Ajo ----------------------------------------------------------------------------

mkdirSync(KUVAKEHAKEMISTO, { recursive: true })

const kirjoitetut = []

for (const tuote of TUOTTEET) {
  const merkki = lueMerkki(tuote.merkki)
  const manifestiKuvakkeet = []

  // Tuotteen SVG-favicon. Laatta-muunnelma, koska sitä käytetään välilehdellä.
  const svgFavicon = `${tuote.id}.svg`
  writeFileSync(
    new URL(svgFavicon, KUVAKEHAKEMISTO),
    svgKuvake({ laatta: tuote.laatta, merkki, muunnelma: 'laatta' }),
  )
  kirjoitetut.push(`public/kuvakkeet/${svgFavicon}`)

  for (const koko of KOOT) {
    // Manifestin kuvakekoot syntyvät vain niille tuotteille joilla on manifesti.
    // Mainossivulle riittää favicon ja apple-touch-icon; 512-kokoinen adaptiivinen
    // kuvake sivulle jota ei voi asentaa olisi vain tiedosto jota kukaan ei pyydä.
    if (koko.purpose && !tuote.manifesti) continue

    const svg = svgKuvake({
      laatta: tuote.laatta,
      merkki,
      muunnelma: koko.muunnelma,
      viivanpaksuus: koko.viivanpaksuus,
    })
    const nimi = tiedostonimi(tuote.id, koko)
    kirjoitaPng(svg, koko.koko, nimi)
    kirjoitetut.push(`public/kuvakkeet/${nimi}`)

    if (koko.purpose) {
      manifestiKuvakkeet.push({
        src: `/kuvakkeet/${nimi}`,
        sizes: `${koko.koko}x${koko.koko}`,
        type: 'image/png',
        // any ja maskable ovat ERI merkinnät eikä yhtä "any maskable" -riviä: sama
        // tiedosto ei voi olla molempia, koska maskable-versiossa merkki on pienempi
        // ja pohja reunasta reunaan.
        purpose: koko.purpose,
      })
    }
  }

  if (tuote.manifesti) {
    const tiedosto = `manifest-${tuote.id}.json`
    writeFileSync(
      new URL(`public/${tiedosto}`, JUURI),
      JSON.stringify(manifesti(tuote, manifestiKuvakkeet), null, 2) + '\n',
    )
    kirjoitetut.push(`public/${tiedosto}`)
  }
}

console.log(`Kirjoitettiin ${kirjoitetut.length} tiedostoa:`)
for (const tiedosto of kirjoitetut) console.log(`  ${tiedosto}`)
