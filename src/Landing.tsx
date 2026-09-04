import { ShieldCheck, CalendarDays, ArrowRight } from 'lucide-react';

// Turvajohto-OS.fi -mainossivu. Ainoa julkinen näkymä koko sovelluksessa: tämä
// renderöidään PasswordGaten ULKOPUOLELLA (ks. main.tsx), joten mitään palvelimen
// dataa ei saa hakea täällä. Tehtävä on kertoa lyhyesti mistä on kyse ja ohjata
// kirjautumaan joko tapahtuma- tai vartiointipuolelle — ei muuta.

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
      'Tilannekuva, TIKE-raportointi ja järjestyksenvalvojan tapahtumailmoitukset, ' +
      'avausvalmius sekä tapahtuman työntekijät ja tiedostot.',
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
      'Kohdekierrokset, vartiovuorot ja kohdekohtaiset poikkeamat — ' +
      'sama raportointi ja työntekijärekisteri kuin tapahtumapuolella.',
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
          <header className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
              Turvajohto <span className="text-guard-accent-bright">OS</span>
            </h1>
            <p className="text-lg text-ink max-w-2xl mx-auto leading-relaxed">
              Turvallisuuden johtamisen työkalut tapahtumiin ja vartiointiin.
              Sama tilannekuva, raportointi ja työntekijärekisteri — kaksi puolta,
              jotka on tehty oman alansa arkeen.
            </p>
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
        Turvajohto OS · Kirjautuminen vaaditaan molemmille puolille
        <span className="mx-2" aria-hidden="true">·</span>
        <a href="/tietosuoja.html" className="underline hover:text-ink-muted transition-colors">
          Tietosuojaseloste
        </a>
      </footer>
    </div>
  );
}
