// Tuotekohtaiset kuvakkeet, manifesti ja teemaväri sivun otsakkeeseen.
//
// --- Miksi tämä tehdään koodissa eikä index.html:ssä --------------------------------
//
// index.html on YKSI TIEDOSTO joka tarjoillaan kaikille kolmelle polulle (/, /event,
// /guard). Manifesti taas on tuotekohtainen: siinä on tuotteen nimi, start_url ja
// kuvakkeet, ja sivulla voi olla vain yksi voimassa oleva <link rel="manifest">.
// Staattisesti kirjoitettuna joutuisi valitsemaan kumman tuotteen manifesti on
// molempien manifesti — ja vartija saisi kotinäytölleen kuvakkeen joka avaa
// tapahtumapuolen.
//
// Elementit lisätään ennen ensimmäistä renderöintiä (main.tsx), eli samassa
// kohdassa jossa juuren data-tuote asetetaan. Selain lukee manifestin heti kun linkki
// ilmestyy DOM:iin, joten asennettavuus ratkeaa normaalisti — tämä ei ole kiertotie
// vaan sama asia hieman myöhemmin.
//
// --- Kaksi asiaa jotka on pidettävä samana ------------------------------------------
//
// 1. TEEMAVÄRI on tässä JA manifestissa. Molempia tarvitaan: selaimessa osoitepalkin
//    värin ratkaisee <meta name="theme-color">, asennetussa sovelluksessa manifestin
//    theme_color. Arvot ovat samat; jos muutat toista, muuta MYÖS asennus/rakenna.mjs.
//
// 2. TIEDOSTONIMET tulevat asennus/rakenna.mjs:n tuottamista kuvakkeista
//    (public/kuvakkeet/). Nimeämissääntö on `<tuote>-<koko>.png` ja `<tuote>.svg`.

// Sama kolmikko kuin main.tsx:n Tuote. Toistettu tässä tarkoituksella: tämä moduuli
// koskettaa vain otsaketta eikä sen kuuluisi omistaa sovelluksen tuotekäsitettä.
type Tuote = 'landing' | 'event' | 'guard';

// Mainossivun kuvakkeet ovat nimellä "os": tuotteita on kaksi, ja mainossivu on
// kattonimen Turvajohto OS oma ilme (ainoa tumma näkymä).
const KUVAKENIMI: Record<Tuote, string> = {
  landing: 'os',
  event: 'event',
  guard: 'guard',
};

// Selaimen osoitepalkin ja Androidin tilapalkin väri. Sama kuin kyseisen puolen tumma
// yläpalkki (--color-surface-dark), jotta palkin ja sovelluksen väliin ei jää saumaa.
// Mainossivulla se on sivun oma tumma pohja.
const TEEMAVARI: Record<Tuote, string> = {
  landing: '#232f40',
  event: '#0f172a',
  guard: '#1e293b',
};

// Selaimen välilehden otsikko ja iOS:n kotinäytön nimi. index.html:ssä on kaikille
// yhteinen "Turvajohto OS", joka on oikein vain mainossivulla.
const OTSIKKO: Record<Tuote, string> = {
  landing: 'Turvajohto OS',
  event: 'Turvajohto EVENT',
  guard: 'Turvajohto GUARD',
};

const LYHYTNIMI: Record<Tuote, string> = {
  landing: 'Turvajohto',
  event: 'EVENT',
  guard: 'GUARD',
};

// Lisää otsakkeeseen elementin, tai päivittää jo olemassa olevan. Päivitys on tässä
// siksi, että kutsu on turvallinen myös silloin jos index.html joskus saa oman
// favicon-linkkinsä — muuten sivulla olisi kaksi kuvakelinkkiä ja selain valitsisi
// niistä itse.
function otsakkeeseen(elementti: 'link' | 'meta', attribuutit: Record<string, string>) {
  // Tunniste jolla sama elementti löydetään uudelleen: linkeille rel (ja sizes, koska
  // kuvakelinkkejä on useita), metatiedoille name.
  const valitsin =
    elementti === 'link'
      ? `link[rel="${attribuutit.rel}"]${attribuutit.sizes ? `[sizes="${attribuutit.sizes}"]` : ''}`
      : `meta[name="${attribuutit.name}"]`;

  const solmu = document.head.querySelector(valitsin) ?? document.createElement(elementti);
  for (const [nimi, arvo] of Object.entries(attribuutit)) solmu.setAttribute(nimi, arvo);
  if (!solmu.parentNode) document.head.appendChild(solmu);
}

export function asetaKuvakkeetJaManifesti(tuote: Tuote) {
  const nimi = KUVAKENIMI[tuote];

  document.title = OTSIKKO[tuote];

  // SVG-kuvake ensin: sitä tukevat selaimet käyttävät sitä joka koossa. 32 px PNG on
  // varalla niille jotka eivät (Safari alle 16, vanhat Edget).
  otsakkeeseen('link', { rel: 'icon', type: 'image/svg+xml', href: `/kuvakkeet/${nimi}.svg` });
  otsakkeeseen('link', {
    rel: 'icon',
    type: 'image/png',
    sizes: '32x32',
    href: `/kuvakkeet/${nimi}-32.png`,
  });
  // iOS ei lue manifestin kuvakkeita lainkaan: kotinäytölle lisätty sovellus ottaa
  // kuvakkeensa vain tästä.
  otsakkeeseen('link', {
    rel: 'apple-touch-icon',
    sizes: '180x180',
    href: `/kuvakkeet/${nimi}-180.png`,
  });
  otsakkeeseen('meta', { name: 'theme-color', content: TEEMAVARI[tuote] });

  // Mainossivu on julkinen esittelysivu johon ei kirjauduta. Sitä ei ole tarkoitus
  // asentaa, joten se ei saa manifestia — asennettava asia on aina jompi kumpi tuote.
  if (tuote === 'landing') return;

  otsakkeeseen('link', { rel: 'manifest', href: `/manifest-${tuote}.json` });
  // Kertoo iOS:lle ja vanhemmille Androideille että sovellus avataan ilman
  // selainkäyttöliittymää. Androidin nykyinen Chrome lukee tämän manifestin
  // display-kentästä, mutta iOS ei tunne manifestia lainkaan.
  otsakkeeseen('meta', { name: 'mobile-web-app-capable', content: 'yes' });
  otsakkeeseen('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  otsakkeeseen('meta', { name: 'apple-mobile-web-app-title', content: LYHYTNIMI[tuote] });
}
