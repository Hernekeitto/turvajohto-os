import { ShieldCheck, CalendarDays, ArrowRight } from 'lucide-react';

// Turvajohto-OS.fi -mainossivu. Ainoa julkinen näkymä koko sovelluksessa: tämä
// renderöidään PasswordGaten ULKOPUOLELLA (ks. main.tsx), joten mitään palvelimen
// dataa ei saa hakea täällä. Tehtävä on kertoa lyhyesti mistä on kyse ja ohjata
// kirjautumaan joko tapahtuma- tai vartiointipuolelle — ei muuta.

// Tekijänoikeusvuosi on KIINTEÄ eikä new Date().getFullYear(). Sivusta otetaan
// tallenne Internet Archiveen osoittamaan milloin palvelu on ollut olemassa, ja
// juokseva vuosiluku näyttäisi tallenteessa sen vuoden jona tallennetta katsotaan
// — eli juuri sen tiedon jota merkinnän on tarkoitus todistaa. Päivitetään käsin.
const JULKAISUVUOSI = 2026;

type Tuote = {
  polku: string;
  nimi: string;
  alaotsikko: string;
  kuvaus: string;
  Ikoni: typeof ShieldCheck;
  // Kortin korostusväri: kumpikin kortti käyttää oman puolensa omaa väriä — Event
  // sovelluksen indigoa, Guard graafisen ohjeistonsa turvavihreää.
  korostus: string;
  korostusHover: string;
  ikoniVari: string;
};

const TUOTTEET: Tuote[] = [
  {
    polku: '/event',
    nimi: 'Turvajohto EVENT',
    alaotsikko: 'Tapahtumaturvallisuus',
    kuvaus:
      'Turvajohto EVENT on luotu massatapahtumien ja järjestyksenvalvonnan ' +
      'dynaamiseen johtamiseen! Lopeta monien eri järjestelmien yhteiskäyttö ja ' +
      'ota kaikki turvallisuuden osa-alueet digitaalisesti haltuun yhdestä paikasta!',
    Ikoni: CalendarDays,
    korostus: 'bg-event-accent',
    korostusHover: 'hover:brightness-110',
    ikoniVari: 'text-event-accent-bright',
  },
  {
    polku: '/guard',
    nimi: 'Turvajohto GUARD',
    alaotsikko: 'Vartiointi',
    kuvaus:
      'Perinteinen liikkuva vartiointi ja kohdevartiointi vaativat oikeat työkalut. Siksi ' +
      'loimme Turvajohto GUARDin – ammattilaisten ohjelmiston, joka on rakennettu ' +
      'vaativaan kenttätyöhön! Turvajohto GUARD ei ole vain ohjelmisto. ' +
      'Se on sinun digitaalinen työpari.',
    Ikoni: ShieldCheck,
    korostus: 'bg-guard-accent',
    korostusHover: 'hover:brightness-110',
    ikoniVari: 'text-guard-accent-bright',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas text-ink-strong flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-4xl">
          <header className="mb-12">
            {/* "OS" on kattonimen tunnus, ei kummankaan tuotteen. Se käyttää EVENTin
                indigoa eikä GUARDin turvavihreää: vihreä sitoi otsikon visuaalisesti
                vartiointipuoleen, vaikka OS kattaa molemmat. */}
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 text-center">
              Turvajohto <span className="text-event-accent-bright">OS</span>
            </h1>
            {/* Leipäteksti on vasemmalle tasattua vaikka otsikko on keskitetty:
                keskitetty kappale on tämän mittaisena raskas lukea. */}
            <div className="max-w-3xl mx-auto space-y-4">
              <p className="text-base sm:text-lg text-ink leading-relaxed">
                Turvajohto OS on suomalainen, koko turvallisuusalalle suunniteltu
                edistyksellinen ohjelmistoalusta, joka yhdistää tapahtumaturvallisuuden,
                järjestyksenvalvonnan ja perinteisen vartioinnin tietohallinnan
                saumattomaksi kokonaisuudeksi. Tämä moderni ja käyttäjien tarpeeseen
                kehitetty SaaS-palvelu tarjoaa turvallisuusjohdolle reaaliaikaisen ja
                keskitetyn tilannekuvan, jonka ytimessä on dynaaminen valvomokojelauta
                aktiivisine hälytyksineen, lokikirjauksineen ja poikkeamaseurantoineen.
                Järjestelmä on digitaalinen sydän, joka poistaa paperilomakkeet ja pitää
                osa-alueiden langat tiukasti yksissä käsissä.
              </p>
              <p className="text-base sm:text-lg text-ink-strong font-medium leading-relaxed">
                Turvajohto OS on koko turvallisuusalan käyttöjärjestelmä. Se korvaa useat
                irralliset ohjelmistot yhdellä älykkäällä ja skaalautuvalla ratkaisulla,
                jollaista ei löydy muualta.
              </p>
            </div>
          </header>

          <div className="grid gap-5 sm:grid-cols-2">
            {TUOTTEET.map(({ polku, nimi, alaotsikko, kuvaus, Ikoni, korostus, korostusHover, ikoniVari }) => (
              <a
                key={polku}
                href={polku}
                className="group flex flex-col bg-surface hover:bg-sunken border border-line hover:border-line-strong rounded-2xl p-6 transition-colors"
              >
                <Ikoni className={`w-8 h-8 mb-4 ${ikoniVari}`} strokeWidth={1.75} />
                <h2 className="text-xl font-bold mb-1 text-ink-strong">{nimi}</h2>
                <p className="text-sm font-medium text-ink-muted mb-3">{alaotsikko}</p>
                <p className="text-sm text-ink leading-relaxed mb-6 flex-1">{kuvaus}</p>
                <span
                  className={`inline-flex items-center justify-center gap-2 ${korostus} ${korostusHover} text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-all`}
                >
                  Kirjaudu sisään
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </main>

      {/* Tietosuojaseloste linkitetään mainossivulta, koska Google Play edellyttää
          selosteelle julkista osoitetta ja arvioija etsii sen nimenomaan täältä —
          sovelluksen sisään hän ei pääse. Tavallinen <a>, ei reititystä: sivu on
          staattinen HTML (public/tietosuoja.html) eikä osa sovellusnippua. */}
      <footer className="text-center text-xs text-ink-subtle pb-8 px-6">
        © {JULKAISUVUOSI} Turvajohto OS. Kaikki oikeudet pidätetään.
        <span className="mx-2" aria-hidden="true">·</span>
        <a href="/tietosuoja.html" className="underline hover:text-ink-muted transition-colors">
          Tietosuojaseloste
        </a>
      </footer>
    </div>
  );
}
