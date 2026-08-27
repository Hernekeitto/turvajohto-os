# Väriteema — miten se toimii ja miten koodia siirretään siihen

Sama komponentti näyttää EVENT-puolella nykyiseltä (slate + indigo) ja GUARD-puolella
graafisen ohjeistonsa mukaiselta ilman että komponentti tietää kummalla puolella se on.
Tämä on koko teemakerroksen syy: vaiheessa 3 App.tsx puretaan jaettuun rakenteeseen, ja
jaetun komponentin on osattava näyttää kahdelta.

Tokenit määritellään `src/index.css`:ssä. Arvot vaihtuvat juuren `data-tuote`-attribuutista,
jonka `main.tsx` asettaa ennen ensimmäistä renderöintiä (`event` | `guard` | `os`).

**Luokat kertovat roolin, eivät väriä.** `bg-surface text-ink-muted border-line`,
ei `bg-white text-slate-500 border-slate-200`.

## Konversiotaulukko

Esiintymämäärät ovat App.tsx:stä 2026-08-27, järjestyksessä yleisimmästä alkaen. Kun purat
komponentin jaettuun kansioon, konvertoi sen luokat tämän mukaan.

### Tekstit

| Nykyinen | Token | Kpl |
|---|---|---|
| `text-slate-900` | `text-ink-strong` | 11 |
| `text-slate-800` | `text-ink` | 180 |
| `text-slate-700` | `text-ink-body` | 193 |
| `text-slate-600` | `text-ink-body` | 151 |
| `text-slate-500` | `text-ink-muted` | 264 |
| `text-slate-400` | `text-ink-subtle` | 155 |
| `text-slate-300` | `text-ink-on-dark-muted` | 14 |
| `text-white` | *(jätä ennalleen)* | 78 |

`text-slate-600` on ainoa mappaus joka muuttaa sävyä: se tummenee `#475569` → `#334155`.
Ero on käytännössä huomaamaton, mutta jos jokin kohta on tarkka, tarkista se silmällä.

`text-white` jätetään sellaisenaan silloin kun se on värillisen napin päällä — se ei ole
teemakysymys vaan seuraa napin väristä. Tummien pintojen (yläpalkki, sivuvalikko) tekstit
sen sijaan kuuluvat `ink-on-dark`-tokeneihin.

### Pinnat ja viivat

| Nykyinen | Token | Kpl | Huom |
|---|---|---|---|
| `bg-white` | `bg-surface` | 147 | |
| `bg-slate-50` | `bg-canvas` tai `bg-sunken` | 175 | **konteksti ratkaisee** |
| `bg-slate-100` | `bg-sunken` | 98 | |
| `bg-slate-200` | `bg-sunken` | 36 | oma token vasta jos erottuvuus kärsii |
| `bg-slate-900` | `bg-surface-dark` | 23 | |
| `bg-slate-800` | `bg-action` tai `bg-surface-dark` | 16 | **konteksti ratkaisee** |
| `bg-slate-700` | `bg-action-hover` | 8 | |
| `border-slate-100` | `border-line-soft` | 111 | |
| `border-slate-200` | `border-line` | 206 | |
| `border-slate-300` | `border-line-strong` | 172 | |
| `divide-slate-200` | `divide-line` | 16 | |
| `divide-slate-100` | `divide-line-soft` | 8 | |

Kaksi kontekstiriippuvaista tapausta:

- `bg-slate-50` on **sivun pohja** → `bg-canvas`, mutta **kortin sisäinen upotettu
  vyöhyke** → `bg-sunken`. Katso mikä elementti on kyseessä, älä korvaa sokkona.
- `bg-slate-800` on **nappi** → `bg-action`, mutta **yläpalkki tai sivuvalikko** →
  `bg-surface-dark`.

### Korostus (indigo)

| Nykyinen | Token | Kpl |
|---|---|---|
| `ring-indigo-500` | `ring-accent` | 119 |
| `text-indigo-600` | `text-accent` | 106 |
| `text-indigo-500` | `text-accent` | 48 |
| `bg-indigo-50` | `bg-accent-soft` | 45 |
| `bg-indigo-600` | `bg-accent` | 29 |
| `bg-indigo-700` | `bg-accent-hover` | 25 |
| `bg-indigo-100` | `bg-accent-soft` | 24 |
| `text-indigo-700` | `text-accent-ink` | 22 |

### Tilavärit

Jokaisella tilalla on kolmikko: täysi väri (palkit, pisteet), `-soft` (merkin tausta) ja
`-ink` (merkin teksti softin päällä).

| Nykyinen | Token | Kpl |
|---|---|---|
| `rose-*` | `danger` / `danger-soft` / `danger-ink` | 234 |
| `amber-*` | `warning` / `warning-soft` / `warning-ink` | 206 |
| `emerald-*` | `success` / `success-soft` / `success-ink` | 162 |
| `blue-*` | `info` / `info-soft` / `info-ink` | 45 |

Nyrkkisääntö sävyistä: `-50`/`-100` → `-soft`, `-500`/`-600` → täysi väri,
`-700`/`-800` → `-ink`.

## Mitä EI konvertoida

**Event-puolen omaa koodia ei konvertoida etukäteen.** Se ei muutu visuaalisesti mihinkään,
joten työ olisi turhaa — konvertoi komponentti vasta kun se siirtyy `shared/`-kansioon ja
alkaa palvella molempia puolia.

**Mainossivun kiinteät tunnusvärit.** `event-accent`, `guard-accent` ja niiden `-bright`
-variantit **eivät** vaihdu teeman mukana. Ne ovat vain mainossivua varten, joka esittää
molemmat puolet rinnakkain. Tuotteiden sisällä käytetään aina `accent`ia.

## Uuden tokenin lisääminen

Lisää se **ensin** `@theme`-lohkoon — se ratkaisee mitkä luokat ylipäänsä syntyvät. Pelkkä
arvon ylikirjoitus `[data-tuote="guard"]`-lohkossa ei luo luokkaa, vaan tuottaa hiljaisen
virheen: luokka ei tee mitään eikä build valita.

Anna sitten arvo jokaiseen kolmeen lohkoon (`@theme` = EVENT, `guard`, `os`) tai varmista,
että oletusarvo kelpaa kaikille.

## Avoin päätös

GUARD-ohjeistossa `accent` ja `success` ovat molemmat `#019765`, eli "paina tästä" ja
"kaikki kunnossa" ovat samanvärisiä. Ne ovat tokenistossa tarkoituksella erillisiä, joten
niiden erottaminen on yhden rivin muutos `index.css`:ssä — ei sadan käyttökohdan.
Kannattaa päättää ennen kuin GUARD-näkymiä on paljon.
